import AlarmKit
import AppIntents
import ExpoModulesCore
import Foundation
import OSLog
import SwiftUI
import UIKit
import UserNotifications

struct IOSReminderRegistration: Codable {
    let occurrenceID: String
    let generation: Int
    let systemID: UUID
    let targetMs: Int64
    let mode: String
    let language: String
    var isTest: Bool? = nil
    var sound: String? = nil
    var isRoutine: Bool? = nil
}

enum IOSDeliveryFailure: Error {
    case denied
    case elapsed
    case unsupportedMode
    case unconfirmed
}

private enum IOSDeliveryAuthorization: String {
    case notDetermined
    case denied
    case authorized
}

private struct ReminderAlarmMetadata: AlarmMetadata {}

@MainActor
enum RemiloIOSDelivery {
    static func register(_ registration: IOSReminderRegistration) async throws {
        let date = Date(timeIntervalSince1970: Double(registration.targetMs) / 1_000)
        switch registration.mode {
        case "Alarm":
            let manager = AlarmManager.shared
            guard manager.authorizationState == .authorized else { throw IOSDeliveryFailure.denied }
            guard try !manager.alarms.contains(where: { $0.id == registration.systemID }) else { return }
            guard date > Date() else { throw IOSDeliveryFailure.elapsed }
            let configuration = AlarmManager.AlarmConfiguration<ReminderAlarmMetadata>.alarm(
                schedule: .fixed(date),
                attributes: alarmAttributes(registration),
                stopIntent: RemiloDismissAlarmIntent(registration),
                secondaryIntent: registration.isTest == true ? nil : RemiloOpenAlarmIntent(registration),
                sound: registration.sound == "remilo" ? .named(RemiloIOSSound.resourceName) : .default
            )
            _ = try await manager.schedule(id: registration.systemID, configuration: configuration)
        case "Notification":
            let center = UNUserNotificationCenter.current()
            guard await notificationAuthorization() == .authorized else { throw IOSDeliveryFailure.denied }
            let identifier = registration.systemID.uuidString
            let pending = await center.pendingNotificationRequests()
            if pending.contains(where: { $0.identifier == identifier }) { return }
            let delivered = await center.deliveredNotifications()
            if delivered.contains(where: { $0.request.identifier == identifier }) { return }
            let remaining = date.timeIntervalSinceNow
            guard remaining > 0 else { throw IOSDeliveryFailure.elapsed }
            let content = UNMutableNotificationContent()
            let titleCopy = registration.isRoutine == true ? IOSDeliveryCopy.routine : IOSDeliveryCopy.reminder
            content.title = titleCopy.forLanguage(registration.language)
            if registration.isRoutine != true {
                content.sound = registration.sound == "remilo"
                    ? .named(UNNotificationSoundName(rawValue: RemiloIOSSound.resourceName))
                    : .default
            }
            content.categoryIdentifier = RemiloNotificationActions.categoryID(registration.language, routine: registration.isRoutine == true)
            content.userInfo = [
                RemiloNotificationActions.occurrenceKey: registration.occurrenceID,
                RemiloNotificationActions.generationKey: registration.generation,
                RemiloNotificationActions.routineKey: registration.isRoutine == true,
            ]
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: remaining, repeats: false)
            try await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            let registered = await center.pendingNotificationRequests()
            if !registered.contains(where: { $0.identifier == identifier }) {
                let delivered = await center.deliveredNotifications()
                guard delivered.contains(where: { $0.request.identifier == identifier }) else {
                    throw IOSDeliveryFailure.unconfirmed
                }
            }
        default:
            throw IOSDeliveryFailure.unsupportedMode
        }
    }

    static func cancel(_ registration: IOSReminderRegistration) async throws {
        switch registration.mode {
        case "Alarm":
            let manager = AlarmManager.shared
            guard try manager.alarms.contains(where: { $0.id == registration.systemID }) else { return }
            do {
                try manager.cancel(id: registration.systemID)
            } catch {
                // A one-shot alarm may have disappeared while cancellation was in flight.
                guard try !manager.alarms.contains(where: { $0.id == registration.systemID }) else { throw error }
            }
        case "Notification":
            let center = UNUserNotificationCenter.current()
            let identifiers = [registration.systemID.uuidString]
            center.removePendingNotificationRequests(withIdentifiers: identifiers)
            center.removeDeliveredNotifications(withIdentifiers: identifiers)
        default:
            throw IOSDeliveryFailure.unsupportedMode
        }
    }

    static func observedStates() async throws -> [UUID: String] {
        var states: [UUID: String] = [:]
        if AlarmManager.shared.authorizationState == .authorized {
            for alarm in try AlarmManager.shared.alarms {
                states[alarm.id] = alarm.state == .alerting ? "Alerting" : "Scheduled"
            }
        }
        let center = UNUserNotificationCenter.current()
        for request in await center.pendingNotificationRequests() {
            if let id = UUID(uuidString: request.identifier) { states[id] = "Scheduled" }
        }
        for notification in await center.deliveredNotifications() {
            if let id = UUID(uuidString: notification.request.identifier) { states[id] = "Notified" }
        }
        return states
    }

    static func capabilities() async -> [String: Any] {
        let alarm = alarmAuthorization()
        let notifications = await notificationAuthorization()
        return [
            "alarmAuthorization": alarm.rawValue,
            "notificationAuthorization": notifications.rawValue,
            "exactAlarms": alarm == .authorized,
            "notifications": notifications == .authorized,
            "channelEnabled": alarm == .authorized,
            "notificationChannelEnabled": notifications == .authorized,
            "fullScreen": alarm == .authorized,
            "unlocked": UIApplication.shared.isProtectedDataAvailable,
            "observedAtMs": Date().timeIntervalSince1970 * 1_000,
            "activeSessionId": "",
            "activeSessionActions": NSNull()
        ]
    }

    static func openSettings(_ kind: String) async throws {
        if kind == "exact", alarmAuthorization() == .notDetermined {
            _ = try await AlarmManager.shared.requestAuthorization()
            return
        }
        if kind == "notifications", await notificationAuthorization() == .notDetermined {
            _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
            return
        }
        let settings = kind == "notifications"
            ? UIApplication.openNotificationSettingsURLString
            : UIApplication.openSettingsURLString
        if let url = URL(string: settings) {
            _ = await UIApplication.shared.open(url)
        }
    }

    private static func alarmAuthorization() -> IOSDeliveryAuthorization {
        switch AlarmManager.shared.authorizationState {
        case .notDetermined: return .notDetermined
        case .authorized: return .authorized
        case .denied: return .denied
        @unknown default: return .denied
        }
    }

    private static func notificationAuthorization() async -> IOSDeliveryAuthorization {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        switch settings.authorizationStatus {
        case .notDetermined: return .notDetermined
        case .authorized, .provisional, .ephemeral: return .authorized
        case .denied: return .denied
        @unknown default: return .denied
        }
    }

    private static func alarmAttributes(_ registration: IOSReminderRegistration) -> AlarmAttributes<ReminderAlarmMetadata> {
        // Keep authored content out of system storage, and resolve the label before handing it off.
        let language = registration.language
        let isRoutine = registration.isRoutine == true
        let titleCopy = registration.isTest == true ? IOSDeliveryCopy.testAlarm : isRoutine ? IOSDeliveryCopy.routine : IOSDeliveryCopy.reminder
        let title = LocalizedStringResource(stringLiteral: titleCopy.forLanguage(language))
        let actionsCopy = isRoutine ? IOSDeliveryCopy.startRoutine : IOSDeliveryCopy.actions
        let actions = registration.isTest == true ? nil : AlarmButton(
            text: LocalizedStringResource(stringLiteral: actionsCopy.forLanguage(language)),
            textColor: .white,
            systemImageName: isRoutine ? "play.fill" : "ellipsis"
        )
        let behavior: AlarmPresentation.Alert.SecondaryButtonBehavior? = actions == nil ? nil : .custom
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
            alert = .init(title: title, secondaryButton: actions, secondaryButtonBehavior: behavior)
        } else {
            let dismiss = AlarmButton(
                text: LocalizedStringResource(stringLiteral: IOSDeliveryCopy.dismiss.forLanguage(language)),
                textColor: .white,
                systemImageName: "stop.fill"
            )
            alert = .init(title: title, stopButton: dismiss, secondaryButton: actions, secondaryButtonBehavior: behavior)
        }
        return AlarmAttributes(presentation: AlarmPresentation(alert: alert), metadata: ReminderAlarmMetadata(), tintColor: .purple)
    }
}

public struct RemiloAlarmIntentsPackage: AppIntentsPackage {}

struct RemiloDismissAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Dismiss alarm"
    static var supportedModes: IntentModes { .background }
    static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Reminder ID") var occurrenceID: String
    @Parameter(title: "Delivery generation") var generation: Int
    @Parameter(title: "Routine delivery") var isRoutine: Bool

    init() {}

    init(_ registration: IOSReminderRegistration) {
        occurrenceID = registration.occurrenceID
        generation = registration.generation
        isRoutine = registration.isRoutine == true
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        // AlarmKit invokes the same intent for swipe and physical-button dismissals.
        if isRoutine {
            _ = try await RemiloIOSEngine.shared.performRoutineDelivery(
                kind: "DismissRoutineDelivery", occurrenceID: occurrenceID, generation: generation
            )
        } else {
            try await RemiloIOSEngine.shared.performSystemAction(
                kind: "DismissDelivery", occurrenceID: occurrenceID, generation: generation
            )
        }
        return .result()
    }
}

struct RemiloOpenAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Reminder actions"
    static var supportedModes: IntentModes { .foreground(.immediate) }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresLocalDeviceAuthentication }
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Reminder ID") var occurrenceID: String
    @Parameter(title: "Delivery generation") var generation: Int
    @Parameter(title: "Routine delivery") var isRoutine: Bool

    init() {}

    init(_ registration: IOSReminderRegistration) {
        occurrenceID = registration.occurrenceID
        generation = registration.generation
        isRoutine = registration.isRoutine == true
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        if isRoutine {
            try await RemiloIOSDeliveryRequests.startRoutine(occurrenceID: occurrenceID, generation: generation)
        } else {
            RemiloIOSDeliveryRequests.enqueue(.reminder(occurrenceID))
        }
        return .result()
    }
}

extension Notification.Name {
    static let remiloIOSDeliveryRequested = Notification.Name("remilo.ios.delivery.requested")
}

@MainActor
enum RemiloIOSDeliveryRequests {
    enum Request: Equatable {
        case postpone(String, Int)
        case reminder(String)
        case routine(String, String)

        var bridge: [String: Any] {
            switch self {
            case let .postpone(id, generation):
                return ["kind": "Single", "occurrenceId": id, "expectedGeneration": generation]
            case let .reminder(id):
                return ["kind": "ReminderActions", "occurrenceId": id]
            case let .routine(id, date):
                return ["kind": "Routine", "routineId": id, "date": date]
            }
        }
    }

    private static var waiting: [Request] = []

    static func enqueue(_ request: Request) {
        guard !waiting.contains(request) else { return }
        waiting.append(request)
        NotificationCenter.default.post(name: .remiloIOSDeliveryRequested, object: nil)
    }

    static func startRoutine(occurrenceID: String, generation: Int) async throws {
        let result = try await RemiloIOSEngine.shared.performRoutineDelivery(
            kind: "StartRoutineDelivery", occurrenceID: occurrenceID, generation: generation
        )
        if let routineID = result["routineId"] as? String, let date = result["date"] as? String {
            enqueue(.routine(routineID, date))
        }
    }

    static func takeAll() -> [[String: Any]] {
        let requests = waiting
        waiting.removeAll()
        return requests.map(\.bridge)
    }
}

private final class RemiloNotificationActions: NSObject, UNUserNotificationCenterDelegate {
    static let shared = RemiloNotificationActions()
    static let occurrenceKey = "remiloOccurrence"
    static let generationKey = "remiloGeneration"
    static let routineKey = "remiloRoutine"
    private static let doneID = "remilo-mark-done"
    private static let postponeID = "remilo-postpone"
    private static let startID = "remilo-start-routine"
    private static let log = Logger(subsystem: "com.remilo.app", category: "NotificationActions")

    static func categoryID(_ language: String, routine: Bool) -> String {
        (routine ? "remilo-routine-" : "remilo-reminder-") + (language == "zh-Hans" ? "zh-Hans" : "en")
    }

    static func categories() -> Set<UNNotificationCategory> {
        Set(["en", "zh-Hans"].flatMap { language in
            let done = UNNotificationAction(identifier: doneID, title: IOSDeliveryCopy.done.forLanguage(language))
            let postpone = UNNotificationAction(
                identifier: postponeID, title: IOSDeliveryCopy.postpone.forLanguage(language), options: [.foreground]
            )
            let start = UNNotificationAction(
                identifier: startID, title: IOSDeliveryCopy.startRoutine.forLanguage(language), options: [.foreground]
            )
            return [
                UNNotificationCategory(identifier: categoryID(language, routine: false), actions: [done, postpone], intentIdentifiers: [], options: []),
                UNNotificationCategory(identifier: categoryID(language, routine: true), actions: [start], intentIdentifiers: [], options: []),
            ]
        })
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter, willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        guard let occurrenceID = info[Self.occurrenceKey] as? String,
              let generation = info[Self.generationKey] as? Int else { return }
        let routine = info[Self.routineKey] as? Bool == true
        switch response.actionIdentifier {
        case Self.doneID:
            do {
                try await RemiloIOSEngine.shared.performSystemAction(
                    kind: "CompleteDelivery", occurrenceID: occurrenceID, generation: generation
                )
            } catch {
                Self.log.error("Could not apply a notification action")
            }
        case Self.postponeID:
            if !routine { await RemiloIOSDeliveryRequests.enqueue(.postpone(occurrenceID, generation)) }
        case Self.startID, UNNotificationDefaultActionIdentifier:
            if routine {
                do {
                    try await RemiloIOSDeliveryRequests.startRoutine(occurrenceID: occurrenceID, generation: generation)
                } catch {
                    Self.log.error("Could not open a routine notification")
                }
            } else if response.actionIdentifier == UNNotificationDefaultActionIdentifier {
                await RemiloIOSDeliveryRequests.enqueue(.reminder(occurrenceID))
            }
        default:
            return
        }
    }
}

public final class RemiloIOSAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = RemiloNotificationActions.shared
        center.setNotificationCategories(RemiloNotificationActions.categories())
        MainActor.assumeIsolated { RemiloIOSRecovery.shared.install() }
        return true
    }
}
