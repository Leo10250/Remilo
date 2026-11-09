import ExpoModulesCore
import Foundation
import OSLog
import UIKit
import WidgetKit

public final class RemiloIOSWidgetAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        MainActor.assumeIsolated { RemiloIOSWidgetPublisher.shared.install() }
        return true
    }
}

@MainActor
final class RemiloIOSWidgetPublisher {
    static let shared = RemiloIOSWidgetPublisher()

    private let log = Logger(subsystem: "com.remilo.app", category: "WidgetSnapshot")
    private var observers: [NSObjectProtocol] = []
    private var pending: Task<Void, Never>?

    func install() {
        guard observers.isEmpty, RemiloWidgetSnapshotFile.isAvailable else { return }
        let center = NotificationCenter.default
        for name in [
            .remiloIOSChange,
            UIApplication.didBecomeActiveNotification,
            UIApplication.protectedDataDidBecomeAvailableNotification,
            UIApplication.significantTimeChangeNotification,
            .NSSystemTimeZoneDidChange,
        ] {
            observers.append(center.addObserver(forName: name, object: nil, queue: nil) { _ in
                Task { @MainActor in self.requestPublish() }
            })
        }
        requestPublish()
    }

    private func requestPublish() {
        guard pending == nil else { return }
        pending = Task {
            defer { pending = nil }
            try? await Task.sleep(for: .milliseconds(250))
            if UIApplication.shared.isProtectedDataAvailable { try? await RemiloIOSWidgetProfiles.shared.reconcile() }
            publishCurrent()
        }
    }

    func publishCurrent() {
        guard UIApplication.shared.isProtectedDataAvailable else { return }
        do {
            let state = try RemiloIOSEngine.shared.read()
            let profiles = (try? RemiloIOSWidgetProfiles.shared.profiles()) ?? []
            let snapshot = RemiloIOSWidgetProjection.snapshot(
                state, at: iosMillis(Date()), in: .current, language: RemiloIOSLanguage.resolve(state.settings.language),
                profiles: profiles
            )
            if try RemiloWidgetSnapshotFile.publish(snapshot) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch {
            log.error("Could not refresh widget data")
        }
    }
}
