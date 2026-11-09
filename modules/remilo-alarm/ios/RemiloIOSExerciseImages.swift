import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import libwebp

/// Immutable local image files shared by routine authoring and portable backup.
struct RemiloIOSExerciseImages: Sendable {
    struct Metadata: Sendable {
        let id: String
        let width: Int
        let height: Int
        let bytes: Int

        func bridge(at url: URL, lease: String? = nil) -> [String: Any] {
            var result: [String: Any] = ["id": id, "uri": url.absoluteString, "width": width, "height": height]
            if let lease { result["lease"] = lease }
            return result
        }
    }

    struct Normalized: Sendable {
        let data: Data
        let metadata: Metadata
    }

    enum Failure: String, Error {
        case sourceTooLarge = "IMAGE_SOURCE_TOO_LARGE"
        case outputTooLarge = "IMAGE_OUTPUT_TOO_LARGE"
        case unsupported = "IMAGE_UNSUPPORTED"
        case unreadable = "IMAGE_UNREADABLE"
    }

    static let sourceLimit = 50 * 1024 * 1024
    private static let outputLimit = 4 * 1024 * 1024
    private static let maxEdge = 2048
    private static let readOptions = [kCGImageSourceShouldCache as String: false] as CFDictionary
    private static let fileChanges = NSLock()

    let root: URL

    static func local() throws -> Self {
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        return Self(root: support.appendingPathComponent("exercise-images", isDirectory: true))
    }

    static func exists(_ id: String) -> Bool { (try? local().existingURL(id)) != nil }
    static func fileURL(_ id: String) throws -> URL { try local().contentURL(id) }
    static func metadata(_ id: String) throws -> Metadata { try local().readMetadata(id) }

    @discardableResult
    static func install(_ bytes: Data, expectedID: String) throws -> URL {
        try local().publish(bytes, expectedID: expectedID)
    }

    func contentURL(_ id: String) throws -> URL {
        guard Self.validID(id) else { throw Failure.unreadable }
        return root.appendingPathComponent(id + ".webp", isDirectory: false)
    }

    func existingURL(_ id: String) throws -> URL {
        let url = try contentURL(id)
        guard try url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile == true else {
            throw Failure.unreadable
        }
        return url
    }

    func readMetadata(_ id: String) throws -> Metadata {
        let url = try existingURL(id)
        guard let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              size > 0, size <= Self.outputLimit,
              let source = CGImageSourceCreateWithURL(url as CFURL, Self.readOptions) else {
            throw Failure.unreadable
        }
        return try Self.webpMetadata(source, id: id, count: size)
    }

    @discardableResult
    func publish(_ bytes: Data, expectedID: String) throws -> URL {
        guard bytes.count <= Self.outputLimit else { throw Failure.outputTooLarge }
        guard Self.validID(expectedID), Self.hash(bytes) == expectedID, !Self.isAnimatedWebP(bytes),
              let source = CGImageSourceCreateWithData(bytes as CFData, Self.readOptions) else {
            throw Failure.unreadable
        }
        _ = try Self.webpMetadata(source, id: expectedID, count: bytes.count)
        return try write(bytes, id: expectedID)
    }

    func publish(_ image: Normalized) throws -> URL {
        try write(image.data, id: image.metadata.id)
    }

    private func write(_ bytes: Data, id: String) throws -> URL {
        Self.fileChanges.lock()
        defer { Self.fileChanges.unlock() }
        let destination = try contentURL(id)
        if let existing = try? existingURL(id),
           let size = try? existing.resourceValues(forKeys: [.fileSizeKey]).fileSize,
           size == bytes.count, try Data(contentsOf: existing) == bytes {
            try FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: existing.path)
            return destination
        }
        var options: Data.WritingOptions = .atomic
        #if os(iOS)
        options.insert(.completeFileProtectionUntilFirstUserAuthentication)
        #endif
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try bytes.write(to: destination, options: options)
        return destination
    }

    func collect(keeping keep: Set<String>, before cutoff: Date) throws {
        Self.fileChanges.lock()
        defer { Self.fileChanges.unlock() }
        let keys: Set<URLResourceKey> = [.isRegularFileKey, .contentModificationDateKey]
        let files: [URL]
        do {
            files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: Array(keys))
        } catch CocoaError.fileReadNoSuchFile { return }
        for url in files where url.pathExtension == "webp" {
            let id = url.deletingPathExtension().lastPathComponent
            guard Self.validID(id), !keep.contains(id),
                  let values = try? url.resourceValues(forKeys: keys), values.isRegularFile == true,
                  let modified = values.contentModificationDate, modified < cutoff else { continue }
            try FileManager.default.removeItem(at: url)
        }
    }

    static func readSource(_ file: FileHandle) throws -> Data {
        var source = Data()
        while let chunk = try file.read(upToCount: min(64 * 1024, sourceLimit - source.count + 1)), !chunk.isEmpty {
            source.append(chunk)
            guard source.count <= sourceLimit else { throw Failure.sourceTooLarge }
        }
        return source
    }

    static func normalize(_ bytes: Data) throws -> Normalized {
        guard bytes.count <= sourceLimit else { throw Failure.sourceTooLarge }
        guard !isAnimatedWebP(bytes) else { throw Failure.unsupported }
        guard let source = CGImageSourceCreateWithData(bytes as CFData, readOptions),
              let sourceType = CGImageSourceGetType(source) else { throw Failure.unreadable }
        let identifier = sourceType as String
        guard identifier != UTType.gif.identifier, UTType(identifier)?.conforms(to: .image) == true,
              CGImageSourceGetCount(source) <= 1 else { throw Failure.unsupported }
        let options: [String: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways as String: true,
            kCGImageSourceCreateThumbnailWithTransform as String: true,
            kCGImageSourceThumbnailMaxPixelSize as String: maxEdge,
            kCGImageSourceShouldCacheImmediately as String: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
              CGImageSourceGetStatusAtIndex(source, 0) == .statusComplete,
              (1...maxEdge).contains(image.width), (1...maxEdge).contains(image.height) else {
            throw Failure.unreadable
        }
        let data = try webp(image)
        return Normalized(data: data, metadata: Metadata(id: hash(data), width: image.width,
                                                         height: image.height, bytes: data.count))
    }

    private static func webp(_ image: CGImage) throws -> Data {
        let rowBytes = image.width * 4
        let layout = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8,
                                      bytesPerRow: rowBytes, space: space, bitmapInfo: layout),
              let pixels = context.data?.assumingMemoryBound(to: UInt8.self) else { throw Failure.unreadable }
        context.setBlendMode(.copy)
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        // Core Graphics draws premultiplied RGBA. The WebP encoder expects straight alpha.
        for i in stride(from: 0, to: rowBytes * image.height, by: 4) {
            let alpha = Int(pixels[i + 3])
            if alpha > 0 && alpha < 255 {
                for component in i..<(i + 3) {
                    pixels[component] = UInt8(clamping: (Int(pixels[component]) * 255 + alpha / 2) / alpha)
                }
            }
        }
        var encoded: UnsafeMutablePointer<UInt8>?
        let count = WebPEncodeRGBA(pixels, Int32(image.width), Int32(image.height), Int32(rowBytes), 90, &encoded)
        guard count > 0, let encoded else { throw Failure.unreadable }
        defer { WebPFree(encoded) }
        guard count <= outputLimit else { throw Failure.outputTooLarge }
        return Data(bytes: encoded, count: count)
    }

    private static func webpMetadata(_ source: CGImageSource, id: String, count: Int) throws -> Metadata {
        guard let sourceType = CGImageSourceGetType(source), sourceType as String == UTType.webP.identifier,
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, readOptions) as? [String: Any],
              let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
              let height = properties[kCGImagePropertyPixelHeight as String] as? Int,
              (1...maxEdge).contains(width), (1...maxEdge).contains(height) else { throw Failure.unreadable }
        return Metadata(id: id, width: width, height: height, bytes: count)
    }

    private static func isAnimatedWebP(_ bytes: Data) -> Bool {
        let start = bytes.startIndex
        return bytes.count >= 21 && bytes.prefix(4) == Data("RIFF".utf8)
            && bytes[(start + 8)..<(start + 16)] == Data("WEBPVP8X".utf8) && bytes[start + 20] & 2 != 0
    }

    private static func validID(_ id: String) -> Bool {
        id.utf8.count == 64 && id.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    private static func hash(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }
}
