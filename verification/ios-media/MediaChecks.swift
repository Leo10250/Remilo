import CoreGraphics
import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import libwebp

@main
enum MediaChecks {
    private struct Failure: Error { let message: String }

    static func main() throws {
        let source = try fixture()
        let normalized = try RemiloIOSExerciseImages.normalize(source)
        let meta = normalized.metadata
        try check(meta.width == 512 && meta.height == 2048, "honor rotation and scale the entire frame")
        try check(meta.id == digest(normalized.data), "use the encoded portable bytes for identity")
        try check(meta.bytes == normalized.data.count && meta.bytes <= 4 * 1024 * 1024, "report bounded WebP bytes")
        try checkFrame(normalized.data, meta)

        let root = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-media-\(UUID())")
        defer { try? FileManager.default.removeItem(at: root) }
        let store = RemiloIOSExerciseImages(root: root)
        let url = try store.publish(normalized)
        try check(url.lastPathComponent == "\(meta.id).webp", "store portable filenames")
        try check(try store.readMetadata(meta.id).height == meta.height, "read normalized dimensions")
        try check(try store.publish(normalized.data, expectedID: meta.id) == url, "reuse an identical portable file")
        try rejects(.unreadable) { _ = try store.publish(normalized.data, expectedID: String(repeating: "0", count: 64)) }
        try rejects(.unreadable) { _ = try store.contentURL("../outside") }

        let cutoff = Date(timeIntervalSinceNow: -60)
        try FileManager.default.setAttributes([.modificationDate: cutoff.addingTimeInterval(-60)], ofItemAtPath: url.path)
        try store.collect(keeping: [meta.id], before: cutoff)
        try check(FileManager.default.fileExists(atPath: url.path), "retain a durable or leased image")
        try store.collect(keeping: [], before: cutoff)
        try check(!FileManager.default.fileExists(atPath: url.path), "remove an aged orphan")

        let gif = Data(base64Encoded: "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==")!
        try rejects(.unsupported) { _ = try RemiloIOSExerciseImages.normalize(gif) }
        try rejects(.unreadable) { _ = try RemiloIOSExerciseImages.normalize(Data("invalid".utf8)) }
        try rejects(.sourceTooLarge) {
            _ = try RemiloIOSExerciseImages.normalize(Data(count: RemiloIOSExerciseImages.sourceLimit + 1))
        }
        print("Swift exercise media checks passed")
    }

    private static func fixture() throws -> Data {
        let layout = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.noneSkipLast.rawValue
        guard let context = CGContext(data: nil, width: 2400, height: 600, bitsPerComponent: 8,
                                      bytesPerRow: 9600, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: layout) else {
            throw Failure(message: "create fixture pixels")
        }
        context.setFillColor(red: 1, green: 0, blue: 0, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 1200, height: 600))
        context.setFillColor(red: 0, green: 0, blue: 1, alpha: 1)
        context.fill(CGRect(x: 1200, y: 0, width: 1200, height: 600))
        let source = NSMutableData()
        guard let image = context.makeImage(),
              let destination = CGImageDestinationCreateWithData(source, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw Failure(message: "create fixture encoder")
        }
        CGImageDestinationAddImage(destination, image, [kCGImagePropertyOrientation as String: 6] as CFDictionary)
        try check(CGImageDestinationFinalize(destination), "encode fixture JPEG")
        return source as Data
    }

    private static func checkFrame(_ data: Data, _ meta: RemiloIOSExerciseImages.Metadata) throws {
        var width: Int32 = 0
        var height: Int32 = 0
        let rgba = data.withUnsafeBytes { source in
            WebPDecodeRGBA(source.bindMemory(to: UInt8.self).baseAddress, source.count, &width, &height)
        }
        guard let rgba else { throw Failure(message: "decode resulting WebP") }
        defer { WebPFree(rgba) }
        try check(width == Int32(meta.width) && height == Int32(meta.height), "WebP matches reported dimensions")
        let upper = (16 * meta.width + meta.width / 2) * 4
        let lower = ((meta.height - 16) * meta.width + meta.width / 2) * 4
        try check(rgba[upper] > 220 && rgba[upper + 2] < 30, "retain the former left edge after clockwise rotation")
        try check(rgba[lower] < 30 && rgba[lower + 2] > 220, "retain the former right edge after clockwise rotation")
    }

    private static func digest(_ bytes: Data) -> String {
        SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
    }

    private static func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        if try !condition() { throw Failure(message: message) }
    }

    private static func rejects(_ expected: RemiloIOSExerciseImages.Failure, _ action: () throws -> Void) throws {
        do { try action() }
        catch let failure as RemiloIOSExerciseImages.Failure where failure == expected { return }
        throw Failure(message: "expected \(expected.rawValue)")
    }
}
