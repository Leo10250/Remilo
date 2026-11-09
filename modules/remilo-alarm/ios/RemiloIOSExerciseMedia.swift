import Foundation
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/// Presents PhotosUI and leases the normalized result. Only the engine attaches
/// an image identity to durable authored content.
@MainActor
final class RemiloIOSExerciseMedia: NSObject, PHPickerViewControllerDelegate {
    static let shared = RemiloIOSExerciseMedia()

    private struct Request {
        let token: UUID
        let lease: String
        let result: CheckedContinuation<[String: Any]?, Error>
        var loading: Progress?
    }

    private struct Lease {
        let id: String
        let renewed: Date
    }

    nonisolated private static let io = DispatchQueue(label: "com.remilo.app.exercise-images", qos: .userInitiated)
    private static let lifetime: TimeInterval = 24 * 60 * 60
    private var pending: Request?
    private weak var picker: PHPickerViewController?
    private var leases: [String: Lease] = [:]
    private var recentlyReleased: [String: Date] = [:]
    private var lastCollection: Date?

    func choose(_ request: String) async throws -> [String: Any]? {
        try Self.validateLease(request)
        let token = UUID()
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { result in
                guard !Task.isCancelled else { result.resume(returning: nil); return }
                guard pending == nil, let presenter = Self.presenter(), !presenter.isBeingDismissed else {
                    result.resume(throwing: IOSInputFailure("IMAGE_UNREADABLE"))
                    return
                }
                var configuration = PHPickerConfiguration()
                configuration.filter = .images
                configuration.selectionLimit = 1
                configuration.preferredAssetRepresentationMode = .current
                let controller = PHPickerViewController(configuration: configuration)
                controller.delegate = self
                // The picker Cancel action provides a delegate result. Prevent a drag from bypassing it.
                controller.isModalInPresentation = true
                pending = Request(token: token, lease: request, result: result)
                picker = controller
                presenter.present(controller, animated: true)
            }
        } onCancel: {
            Task { @MainActor in self.cancel(token) }
        }
    }

    func get(_ id: String, lease: String?) throws -> [String: Any]? {
        let images = try RemiloIOSExerciseImages.local()
        guard let url = try? images.existingURL(id), let metadata = try? images.readMetadata(id) else { return nil }
        if let lease { try self.lease(id, lease: lease) }
        return metadata.bridge(at: url)
    }

    func lease(_ id: String, lease: String) throws {
        try Self.validateLease(lease)
        guard RemiloIOSExerciseImages.exists(id) else { throw IOSInputFailure("IMAGE_UNREADABLE") }
        leases[lease] = Lease(id: id, renewed: Date())
    }

    @discardableResult
    func release(_ lease: String) throws -> Bool {
        try Self.validateLease(lease)
        let keys = leases.keys.filter { $0 == lease || $0.hasPrefix(lease + ":") }
        let now = Date()
        for key in keys {
            if let removed = leases.removeValue(forKey: key) { recentlyReleased[removed.id] = now }
        }
        if let pending, pending.lease == lease { cancel(pending.token) }
        return true
    }

    /// The caller supplies every durable reference, including history and Trash.
    /// Serialize this with the engine's reference mutations.
    func collect(referenced: Set<String>) throws {
        let now = Date()
        if let lastCollection, now.timeIntervalSince(lastCollection) < 60 * 60 { return }
        lastCollection = now
        let cutoff = now.addingTimeInterval(-Self.lifetime)
        leases = leases.filter { $0.value.renewed >= cutoff }
        recentlyReleased = recentlyReleased.filter { $0.value >= cutoff }
        let keep = referenced.union(leases.values.map(\.id)).union(recentlyReleased.keys)
        try RemiloIOSExerciseImages.local().collect(keeping: keep, before: cutoff)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard self.picker === picker, let request = pending else { return }
        self.picker = nil
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider else {
            finish(request.token, result: .success(nil))
            return
        }
        guard let identifier = provider.registeredTypeIdentifiers.first(where: {
            UTType($0)?.conforms(to: .image) == true
        }) else {
            finish(request.token, result: .failure(IOSInputFailure("IMAGE_UNSUPPORTED")))
            return
        }
        let token = request.token
        pending?.loading = provider.loadFileRepresentation(forTypeIdentifier: identifier) { url, _ in
            // The provider owns this temporary URL. Open it while the callback is active.
            // The open descriptor keeps the file readable after the provider unlinks it.
            guard let url, let file = try? FileHandle(forReadingFrom: url) else {
                Task { @MainActor in self.finish(token, result: .failure(IOSInputFailure("IMAGE_UNREADABLE"))) }
                return
            }
            Self.io.async {
                defer { try? file.close() }
                let normalized = Result { () -> (RemiloIOSExerciseImages.Metadata, URL) in
                    let source = try RemiloIOSExerciseImages.readSource(file)
                    let image = try RemiloIOSExerciseImages.normalize(source)
                    let url = try RemiloIOSExerciseImages.local().publish(image)
                    return (image.metadata, url)
                }
                Task { @MainActor in self.accept(token, normalized) }
            }
        }
    }

    private func accept(_ token: UUID, _ normalized: Result<(RemiloIOSExerciseImages.Metadata, URL), Error>) {
        guard let pending, pending.token == token else { return }
        do {
            let (metadata, url) = try normalized.get()
            try lease(metadata.id, lease: pending.lease)
            finish(token, result: .success(metadata.bridge(at: url, lease: pending.lease)))
        } catch let error as RemiloIOSExerciseImages.Failure {
            finish(token, result: .failure(IOSInputFailure(error.rawValue)))
        } catch CocoaError.fileWriteOutOfSpace {
            finish(token, result: .failure(IOSInputFailure("IMAGE_STORAGE_FULL")))
        } catch {
            finish(token, result: .failure(IOSInputFailure("IMAGE_UNREADABLE")))
        }
    }

    private func cancel(_ token: UUID) {
        guard let pending, pending.token == token else { return }
        pending.loading?.cancel()
        picker?.dismiss(animated: true)
        picker = nil
        finish(token, result: .success(nil))
    }

    private func finish(_ token: UUID, result: Result<[String: Any]?, Error>) {
        guard let pending, pending.token == token else { return }
        self.pending = nil
        pending.result.resume(with: result)
    }

    private static func validateLease(_ value: String) throws {
        guard (1...200).contains(value.utf8.count) else { throw IOSInputFailure("IMAGE_UNREADABLE") }
    }

    private static func presenter() -> UIViewController? {
        let window = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }
            .flatMap(\.windows).first(where: \.isKeyWindow)
        guard var controller = window?.rootViewController else { return nil }
        while let visible = controller.presentedViewController
            ?? (controller as? UINavigationController)?.visibleViewController
            ?? (controller as? UITabBarController)?.selectedViewController {
            controller = visible
        }
        return controller
    }
}
