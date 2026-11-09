import AlarmKit
import BackgroundTasks
import Foundation
import OSLog
import UIKit

/// Reconciles registrations when the native process has an opportunity to run.
@MainActor
final class RemiloIOSRecovery {
    static let shared = RemiloIOSRecovery()
    private static let refreshID = "com.remilo.app.delivery-refresh"
    private static let backgroundDeliveryBudget = 16

    private let log = Logger(subsystem: "com.remilo.app", category: "DeliveryRecovery")
    private var observers: [NSObjectProtocol] = []
    private var foregroundWork: Task<Void, Never>?
    private var foregroundPassRequested = false
    private var refreshRegistered = false
    private var refreshRequestWork: Task<Void, Never>?
    private var refreshRequestNeeded = false
    private var backgroundRun: (id: UUID, task: BGAppRefreshTask, work: Task<Void, Never>)?

    func install() {
        guard observers.isEmpty else { return }
        let center = NotificationCenter.default
        refreshRegistered = BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.refreshID, using: .main
        ) { task in
            MainActor.assumeIsolated {
                self.handleRefresh(task)
            }
        }
        for name in [
            UIApplication.didBecomeActiveNotification,
            UIApplication.protectedDataDidBecomeAvailableNotification,
            UIApplication.significantTimeChangeNotification,
            .NSSystemTimeZoneDidChange,
        ] {
            observers.append(center.addObserver(forName: name, object: nil, queue: nil) { _ in
                Task { @MainActor in self.requestForegroundPass() }
            })
        }
        for name in [UIApplication.didEnterBackgroundNotification, .remiloIOSChange] {
            observers.append(center.addObserver(forName: name, object: nil, queue: nil) { _ in
                Task { @MainActor in self.requestRefreshSubmission() }
            })
        }
        Task {
            for await _ in AlarmManager.shared.alarmUpdates { requestForegroundPass() }
        }
        Task {
            for await _ in AlarmManager.shared.authorizationUpdates { requestForegroundPass() }
        }
        requestForegroundPass()
    }

    private func requestForegroundPass() {
        guard UIApplication.shared.applicationState == .active else { return }
        foregroundPassRequested = true
        guard foregroundWork == nil else { return }
        foregroundWork = Task {
            defer { foregroundWork = nil }
            while foregroundPassRequested {
                // Several activation and clock notifications may describe the same transition.
                try? await Task.sleep(for: .milliseconds(200))
                foregroundPassRequested = false
                guard UIApplication.shared.applicationState == .active else { return }
                do {
                    try await RemiloIOSEngine.shared.reconcile()
                } catch {
                    log.error("Could not reconcile delivery in the foreground")
                }
                requestRefreshSubmission()
            }
        }
    }

    @discardableResult
    private func requestRefreshSubmission() -> Task<Void, Never>? {
        guard refreshRegistered, UIApplication.shared.backgroundRefreshStatus == .available else { return nil }
        refreshRequestNeeded = true
        if let refreshRequestWork { return refreshRequestWork }
        let work = Task {
            defer { refreshRequestWork = nil }
            while refreshRequestNeeded {
                refreshRequestNeeded = false
                await submitRefreshIfNeeded()
            }
        }
        refreshRequestWork = work
        return work
    }

    private func submitRefreshIfNeeded() async {
        let scheduler = BGTaskScheduler.shared
        let existing = await scheduler.pendingTaskRequests().first { $0.identifier == Self.refreshID }
        guard let state = try? RemiloIOSEngine.shared.read() else { return }
        let now = Date()
        let nowMs = iosMillis(now)
        let rolling = state.reminders.values.lazy.filter {
            $0.active && ($0.segmentID != nil || $0.routineID != nil)
        }
        let nextRollingTarget = rolling.compactMap {
            $0.registration?.targetMs
        }.filter { $0 > nowMs }.min()
        let hasRetryableWork = state.outbox.contains { work in
            work.action == .cancel || state.reminders[work.registration.occurrenceID]?.deliveryState == "Pending"
        } || rolling.contains {
            guard let registration = $0.registration, registration.targetMs <= nowMs else { return false }
            return $0.deliveryState == "Scheduled" || $0.deliveryState == "Alerting"
        }
        var earliest = nextRollingTarget.map { max(now.addingTimeInterval(15 * 60), iosDate($0).addingTimeInterval(60)) }
        if hasRetryableWork {
            let retry = now.addingTimeInterval(60 * 60)
            earliest = earliest.map { min($0, retry) } ?? retry
        }
        guard let earliest else {
            if existing != nil { scheduler.cancel(taskRequestWithIdentifier: Self.refreshID) }
            return
        }
        if let existing, (existing.earliestBeginDate ?? .distantPast) <= earliest { return }
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshID)
        request.earliestBeginDate = earliest
        do {
            try scheduler.submit(request)
        } catch {
            log.debug("Background delivery refresh is unavailable")
        }
    }

    private func handleRefresh(_ task: BGTask) {
        guard let task = task as? BGAppRefreshTask, backgroundRun == nil else {
            task.setTaskCompleted(success: false)
            return
        }
        let id = UUID()
        task.expirationHandler = {
            Task { @MainActor in
                guard self.backgroundRun?.id == id else { return }
                self.backgroundRun?.work.cancel()
                self.completeRefresh(id, success: false)
            }
        }
        let work = Task {
            do {
                await requestRefreshSubmission()?.value
                try Task.checkCancellation()
                try await RemiloIOSEngine.shared.reconcile(maximumDeliveryOperations: Self.backgroundDeliveryBudget)
                try Task.checkCancellation()
                await requestRefreshSubmission()?.value
                completeRefresh(id, success: !Task.isCancelled)
            } catch {
                completeRefresh(id, success: false)
            }
        }
        backgroundRun = (id, task, work)
    }

    private func completeRefresh(_ id: UUID, success: Bool) {
        guard let run = backgroundRun, run.id == id else { return }
        backgroundRun = nil
        run.task.expirationHandler = nil
        run.task.setTaskCompleted(success: success)
    }
}
