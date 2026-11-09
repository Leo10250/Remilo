import CoreFoundation
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import ZIPFoundation

/// File transport for Android's PortableFiles and BackupCodec. The native store
/// validates and merges the unchanged manifest before publishing any content.
/// Run this synchronous I/O away from the serialized reminder mutation path.
struct RemiloIOSPortableArchive: Sendable {
    struct Media: Sendable {
        let id: String
        let width: Int
        let height: Int
        let bytes: Int

        var path: String { "media/\(id).webp" }
    }

    struct Staged: Sendable {
        let handle: String
        let metadata: Data
        let version: Int
        let images: [Media]
        let directory: URL

        func imageURL(_ image: Media) -> URL { directory.appendingPathComponent(image.path) }
    }

    struct Export: Sendable {
        let url: URL
        let imageCount: Int
        let bytes: Int
    }

    enum Failure: Error { case invalidSource, invalidArchive, invalidManifest, invalidImage, limit }

    private struct Manifest {
        let version: Int
        let images: [Media]
    }

    private static let archiveLimit = 200 * 1024 * 1024
    private static let metadataLimit = 10_000_000
    private static let imageLimit = 4 * 1024 * 1024
    private static let recordsLimit = 10_000
    private static let chunkSize = 64 * 1024
    private static let content = "content.json"
    private static let sha256 = try! NSRegularExpression(pattern: #"\A[a-f0-9]{64}\z"#)

    let stagingRoot: URL
    let exportRoot: URL

    static func live() throws -> Self {
        let cache = try FileManager.default.url(
            for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        return Self(
            stagingRoot: cache.appendingPathComponent("remilo-prepared-imports", isDirectory: true),
            exportRoot: cache.appendingPathComponent("remilo-exports", isDirectory: true)
        )
    }

    func stage(from source: URL) throws -> Staged {
        guard source.isFileURL else { throw Failure.invalidSource }
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        let inputSize = try Self.regularFileSize(source)
        guard inputSize > 0, inputSize <= Self.archiveLimit else { throw Failure.limit }

        let handle = UUID().uuidString.lowercased()
        let directory = try stagedDirectory(handle)
        try Self.createPrivateDirectory(stagingRoot)
        do {
            try Self.createPrivateDirectory(directory)
            let input = try FileHandle(forReadingFrom: source)
            defer { try? input.close() }
            let prefix = try input.read(upToCount: 2) ?? Data()
            try input.seek(toOffset: 0)
            let isArchive = prefix == Data([0x50, 0x4b])
            let local = directory.appendingPathComponent(isArchive ? "source.zip" : Self.content)
            try Self.write(to: local) { output in
                var copied = 0
                while let chunk = try input.read(upToCount: Self.chunkSize), !chunk.isEmpty {
                    copied += chunk.count
                    guard copied <= (isArchive ? Self.archiveLimit : Self.metadataLimit) else {
                        throw Failure.limit
                    }
                    try output.write(contentsOf: chunk)
                }
            }
            if isArchive {
                try Self.extract(local, into: directory)
                try FileManager.default.removeItem(at: local)
            }
            let staged = try validate(handle)
            guard isArchive ? staged.version >= 7 : staged.images.isEmpty else { throw Failure.invalidManifest }
            return staged
        } catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
    }

    func validate(_ handle: String) throws -> Staged {
        let directory = try stagedDirectory(handle)
        let metadataURL = directory.appendingPathComponent(Self.content)
        guard (1...Self.metadataLimit).contains(try Self.regularFileSize(metadataURL)) else {
            throw Failure.limit
        }
        let metadata = try Data(contentsOf: metadataURL)
        let manifest = try Self.manifest(metadata)
        let expectedTopLevel: Set<String> = manifest.images.isEmpty ? [Self.content] : [Self.content, "media"]
        guard Set(try FileManager.default.contentsOfDirectory(atPath: directory.path)) == expectedTopLevel else {
            throw Failure.invalidArchive
        }
        if !manifest.images.isEmpty {
            let media = directory.appendingPathComponent("media", isDirectory: true)
            let names = Set(try FileManager.default.contentsOfDirectory(atPath: media.path))
            guard names == Set(manifest.images.map { "\($0.id).webp" }) else { throw Failure.invalidArchive }
        }
        let result = Staged(
            handle: handle, metadata: metadata, version: manifest.version, images: manifest.images, directory: directory
        )
        for image in result.images {
            try autoreleasepool { _ = try Self.verifiedImage(image, at: result.imageURL(image)) }
        }
        return result
    }

    @discardableResult
    func release(_ handle: String) throws -> Bool {
        let directory = try stagedDirectory(handle)
        do {
            try FileManager.default.removeItem(at: directory)
            return true
        } catch let error as CocoaError where error.code == .fileNoSuchFile {
            return false
        }
    }

    func export(metadata: Data, imageURLs: [String: URL]) throws -> Export {
        let manifest = try Self.manifest(metadata)
        guard manifest.version == 9, Set(imageURLs.keys) == Set(manifest.images.map(\.id)) else {
            throw Failure.invalidManifest
        }
        try Self.createPrivateDirectory(exportRoot)
        let url = exportRoot.appendingPathComponent("remilo-\(UUID().uuidString.lowercased()).remilo")
        do {
            try Self.writeArchive(to: url, metadata: metadata, images: manifest.images, imageURLs: imageURLs)
            let bytes = try Self.regularFileSize(url)
            guard bytes <= Self.archiveLimit else { throw Failure.limit }
            return Export(url: url, imageCount: manifest.images.count, bytes: bytes)
        } catch {
            try? FileManager.default.removeItem(at: url)
            throw error
        }
    }

    private func stagedDirectory(_ handle: String) throws -> URL {
        guard let id = UUID(uuidString: handle), id.uuidString.lowercased() == handle else {
            throw Failure.invalidSource
        }
        return stagingRoot.appendingPathComponent(handle, isDirectory: true)
    }

    private static func createPrivateDirectory(_ url: URL) throws {
        var attributes: [FileAttributeKey: Any] = [.posixPermissions: 0o700]
        #if os(iOS)
        attributes[.protectionKey] = FileProtectionType.completeUntilFirstUserAuthentication
        #endif
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: attributes)
    }

    private static func regularFileSize(_ url: URL) throws -> Int {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              let size = (attributes[.size] as? NSNumber)?.intValue else { throw Failure.invalidSource }
        return size
    }

    private static func write(to url: URL, consume: (FileHandle) throws -> Void) throws {
        guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.posixPermissions: 0o600])
        else { throw Failure.invalidSource }
        let file = try FileHandle(forWritingTo: url)
        do {
            try consume(file)
            try file.close()
        } catch {
            try? file.close()
            throw error
        }
    }

    private static func number(_ value: Any?, in range: ClosedRange<Int>) -> Int? {
        guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID(),
              let integer = Int(exactly: value.doubleValue), range.contains(integer) else { return nil }
        return integer
    }

    private static func isDigest(_ text: String) -> Bool {
        text.utf8.count == 64 && sha256.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
    }

    private static func manifest(_ metadata: Data) throws -> Manifest {
        guard (1...metadataLimit).contains(metadata.count) else { throw Failure.limit }
        guard String(data: metadata, encoding: .utf8) != nil,
              let root = try JSONSerialization.jsonObject(with: metadata) as? [String: Any],
              root["format"] as? String == "Remilo",
              let version = number(root["version"], in: 1...9) else { throw Failure.invalidManifest }
        let sections = [
            ("reminders", 1), ("lists", 3), ("purgedOccurrences", 4), ("routines", 5),
            ("routineVersions", 5), ("routineSessions", 5), ("images", 7), ("purgedRoutines", 7)
        ]
        for (key, introduced) in sections {
            if version >= introduced {
                guard let values = root[key] as? [Any], values.count <= recordsLimit else {
                    throw Failure.invalidManifest
                }
            } else if let value = root[key], (value as? [Any])?.isEmpty != true {
                throw Failure.invalidManifest
            }
        }
        for (key, limit) in [("series", recordsLimit), ("history", 100_000)] {
            if let value = root[key] {
                guard let values = value as? [[String: Any]], values.count <= limit else {
                    throw Failure.invalidManifest
                }
            }
        }
        var ids = Set<String>()
        var total = metadata.count
        let images = try (root["images"] as? [Any] ?? []).map { value -> Media in
            guard let image = value as? [String: Any], let id = image["id"] as? String,
                  isDigest(id), ids.insert(id).inserted, image["mime"] as? String == "image/webp",
                  let width = number(image["width"], in: 1...2048), let height = number(image["height"], in: 1...2048),
                  let bytes = number(image["bytes"], in: 1...imageLimit) else { throw Failure.invalidManifest }
            total += bytes
            guard total <= archiveLimit else { throw Failure.limit }
            return Media(id: id, width: width, height: height, bytes: bytes)
        }
        return Manifest(version: version, images: images)
    }

    private static func verifiedImage(_ image: Media, at url: URL) throws -> Data {
        guard try regularFileSize(url) == image.bytes else { throw Failure.invalidImage }
        let data = try Data(contentsOf: url)
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard data.count == image.bytes, digest == image.id,
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetType(source) as String? == UTType.webP.identifier,
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
              properties[kCGImagePropertyPixelWidth as String] as? Int == image.width,
              properties[kCGImagePropertyPixelHeight as String] as? Int == image.height,
              let decoded = CGImageSourceCreateImageAtIndex(
                source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary
              ),
              decoded.width == image.width, decoded.height == image.height,
              CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete else { throw Failure.invalidImage }
        return data
    }

    private static func extract(_ source: URL, into directory: URL) throws {
        let expectedEntries = try zipEntryCount(source)
        let archive = try Archive(url: source, accessMode: .read)
        var names = Set<String>()
        var total = 0
        for entry in archive {
            let path = entry.path
            guard entry.type == .file, names.insert(path).inserted else { throw Failure.invalidArchive }
            if path.hasPrefix("media/") {
                try createPrivateDirectory(directory.appendingPathComponent("media", isDirectory: true))
            }
            try write(to: directory.appendingPathComponent(path)) { output in
                var written = 0
                var emptyChunks = 0
                let checksum = try archive.extract(entry, bufferSize: chunkSize) { chunk in
                    if chunk.isEmpty {
                        emptyChunks += 1
                        guard emptyChunks <= archiveLimit / chunkSize + 1 else { throw Failure.invalidArchive }
                        return
                    }
                    written += chunk.count
                    total += chunk.count
                    guard UInt64(written) <= entry.uncompressedSize, total <= archiveLimit else {
                        throw Failure.limit
                    }
                    try output.write(contentsOf: chunk)
                }
                guard UInt64(written) == entry.uncompressedSize, checksum == entry.checksum else {
                    throw Failure.invalidArchive
                }
            }
        }
        guard names.contains(content), names.count == expectedEntries else { throw Failure.invalidArchive }
    }

    // The format limits fit ZIP32. Check local headers, data descriptors and
    // directory offsets before handing untrusted data to the ZIP decompressor.
    private static func zipEntryCount(_ url: URL) throws -> Int {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        let fileSize = try regularFileSize(url)
        let endSize = 22
        let tailStart = max(0, fileSize - endSize - Int(UInt16.max))
        let tail = try read(file, at: tailStart, count: fileSize - tailStart)
        guard tail.count >= endSize,
              let end = (0...(tail.count - endSize)).reversed().first(where: { tail.u32($0) == 0x06054b50 }),
              end + endSize + tail.u16(end + 20) == tail.count,
              tail.u16(end + 4) == 0, tail.u16(end + 6) == 0 else { throw Failure.invalidArchive }
        let entryCount = tail.u16(end + 10)
        let directoryStart = tail.u32(end + 16)
        let directoryEnd = tailStart + end
        guard (1...(recordsLimit + 1)).contains(entryCount), tail.u16(end + 8) == entryCount,
              directoryStart + tail.u32(end + 12) == directoryEnd else { throw Failure.invalidArchive }
        if directoryEnd >= 20, try read(file, at: directoryEnd - 20, count: 4).u32(0) == 0x07064b50 {
            throw Failure.invalidArchive
        }

        var cursor = directoryStart
        var total = 0
        var names = Set<String>()
        var localRanges: [Range<Int>] = []
        for _ in 0..<entryCount {
            guard cursor + 46 <= directoryEnd else { throw Failure.invalidArchive }
            let header = try read(file, at: cursor, count: 46)
            let flags = header.u16(8)
            let method = header.u16(10)
            let crc = header.u32(16)
            let compressed = header.u32(20)
            let expanded = header.u32(24)
            let nameSize = header.u16(28)
            let extraSize = header.u16(30)
            let offset = header.u32(42)
            let next = cursor + 46 + nameSize + extraSize + header.u16(32)
            // Allow UTF-8, DEFLATE compression options and data descriptors.
            guard header.u32(0) == 0x02014b50, header.u16(6) < 45, header.u16(34) == 0,
                  flags & ~0x080e == 0, method == 8 || (method == 0 && compressed == expanded),
                  (1...75).contains(nameSize), next <= directoryEnd, offset + 30 <= directoryStart,
                  compressed > 0, expanded > 0 else { throw Failure.invalidArchive }
            let name = try read(file, at: cursor + 46, count: nameSize)
            guard let path = String(data: name, encoding: .utf8), names.insert(path).inserted else {
                throw Failure.invalidArchive
            }
            let metadata = path == content
            guard metadata || (path.hasPrefix("media/") && path.hasSuffix(".webp") &&
                                isDigest(String(path.dropFirst(6).dropLast(5)))) else {
                throw Failure.invalidArchive
            }
            total += expanded
            guard expanded <= (metadata ? metadataLimit : imageLimit), total <= archiveLimit else {
                throw Failure.limit
            }
            try checkExtraFields(read(file, at: cursor + 46 + nameSize, count: extraSize))

            let local = try read(file, at: offset, count: 30)
            let localExtra = local.u16(28)
            let dataEnd = offset + 30 + nameSize + localExtra + compressed
            guard local.u32(0) == 0x04034b50, local.u16(4) < 45, local.u16(6) == flags,
                  local.u16(8) == method, local.u16(26) == nameSize, dataEnd <= directoryStart,
                  try read(file, at: offset + 30, count: nameSize) == name else { throw Failure.invalidArchive }
            try checkExtraFields(read(file, at: offset + 30 + nameSize, count: localExtra))
            var localEnd = dataEnd
            if flags & 0x08 != 0 {
                guard dataEnd + 12 <= directoryStart else { throw Failure.invalidArchive }
                let signed = try read(file, at: dataEnd, count: 4).u32(0) == 0x08074b50
                let start = dataEnd + (signed ? 4 : 0)
                localEnd = start + 12
                guard localEnd <= directoryStart else { throw Failure.invalidArchive }
                let descriptor = try read(file, at: start, count: 12)
                guard descriptor.u32(0) == crc, descriptor.u32(4) == compressed,
                      descriptor.u32(8) == expanded else { throw Failure.invalidArchive }
            } else {
                guard local.u32(14) == crc, local.u32(18) == compressed,
                      local.u32(22) == expanded else { throw Failure.invalidArchive }
            }
            localRanges.append(offset..<localEnd)
            cursor = next
        }
        guard cursor == directoryEnd, names.contains(content) else { throw Failure.invalidArchive }
        var localEnd = 0
        for range in localRanges.sorted(by: { $0.lowerBound < $1.lowerBound }) {
            guard range.lowerBound == localEnd else { throw Failure.invalidArchive }
            localEnd = range.upperBound
        }
        guard localEnd == directoryStart else { throw Failure.invalidArchive }
        return entryCount
    }

    private static func read(_ file: FileHandle, at offset: Int, count: Int) throws -> Data {
        if count == 0 { return Data() }
        try file.seek(toOffset: UInt64(offset))
        guard let data = try file.read(upToCount: count), data.count == count else { throw Failure.invalidArchive }
        return data
    }

    private static func checkExtraFields(_ fields: Data) throws {
        var cursor = 0
        while cursor < fields.count {
            guard fields.count - cursor >= 4, fields.u16(cursor) != 1 else { throw Failure.invalidArchive }
            cursor += 4 + fields.u16(cursor + 2)
        }
        guard cursor == fields.count else { throw Failure.invalidArchive }
    }

    private static func writeArchive(
        to url: URL, metadata: Data, images: [Media], imageURLs: [String: URL]
    ) throws {
        let archive = try Archive(url: url, accessMode: .create)
        try add(content, data: metadata, compression: .deflate, to: archive)
        for image in images {
            guard let url = imageURLs[image.id] else { throw Failure.invalidManifest }
            try autoreleasepool {
                let data = try verifiedImage(image, at: url)
                try add(image.path, data: data, compression: .none, to: archive)
            }
        }
    }

    private static func add(_ path: String, data: Data, compression: CompressionMethod, to archive: Archive) throws {
        try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(data.count), permissions: 0o600,
                             compressionMethod: compression) { position, size in
            let start = Int(position)
            return data.subdata(in: start..<(start + size))
        }
    }
}

private extension Data {
    func u16(_ offset: Int) -> Int { Int(self[offset]) | Int(self[offset + 1]) << 8 }
    func u32(_ offset: Int) -> Int { u16(offset) | u16(offset + 2) << 16 }
}
