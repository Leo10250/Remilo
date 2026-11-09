import AlarmKit
import AppIntents
import Foundation
import OSLog
import SwiftUI

struct ProbeRecord: Codable {
    let occurrenceID: UUID
    var alarmID: UUID
    var fireAt: Date
    var previousAlarmID: UUID?
    var postponedAt: Date?
    var doneAt: Date?
}

struct ProbeSnapshot {
    let record: ProbeRecord?
    let authorization: AlarmManager.AuthorizationState
    let registeredIDs: [UUID]?
}

enum ProbeError: LocalizedError {
    case busy
    case authorizationRequired
    case resetRequired
    case operationFailed

    var errorDescription: String? {
        switch self {
        case .busy: String(localized: "error.busy")
        case .authorizationRequired: String(localized: "error.authorization")
        case .resetRequired: String(localized: "error.reset")
        case .operationFailed: String(localized: "error.operation")
        }
    }
}

private struct ProbeMetadata: AlarmMetadata {}

@MainActor
final class ProbeEngine {
    static let shared = ProbeEngine()
    static let log = Logger(subsystem: "com.remilo.alarmkit-probe", category: "Probe")

    private let manager = AlarmManager.shared
    private let postponeDelay: TimeInterval = 60
    // Scheduling and permission prompts suspend, so keep competing mutations out.
    private var changing = false

    private init() {}

    func snapshot() throws -> ProbeSnapshot {
        let authorization = manager.authorizationState
        return ProbeSnapshot(
            record: try read(),
            authorization: authorization,
            registeredIDs: authorization == .authorized ? try registeredIDs() : nil
        )
    }

    func schedule(after delay: TimeInterval) async throws {
        try beginChange()
        defer { changing = false }

        let currentAuthorization = manager.authorizationState
        let authorization = currentAuthorization == .notDetermined
            ? try await manager.requestAuthorization()
            : currentAuthorization
        guard authorization == .authorized else {
            throw ProbeError.authorizationRequired
        }
        guard try registeredIDs().isEmpty else { throw ProbeError.resetRequired }

        let record = ProbeRecord(
            occurrenceID: UUID(), alarmID: UUID(), fireAt: Date().addingTimeInterval(delay)
        )
        try await registerAndSave(record)
    }

    func complete(alarmID: String) throws {
        try beginChange()
        defer { changing = false }

        guard var record = try currentRecord(for: alarmID) else { return }
        record.doneAt = Date()
        // AlarmKit owns stopping the sound when the primary button is pressed.
        try write(record)
    }

    func postpone(alarmID: String) async throws {
        try beginChange()
        defer { changing = false }

        guard var record = try currentRecord(for: alarmID) else { return }
        let previousID = record.alarmID
        let now = Date()
        record.previousAlarmID = previousID
        record.alarmID = UUID()
        record.postponedAt = now
        record.fireAt = now.addingTimeInterval(postponeDelay)
        try await registerAndSave(record)
        try cancelIfPresent(previousID)
    }

    func reset() throws {
        try beginChange()
        defer { changing = false }

        // The standalone bundle has no alarms other than those created by this probe.
        for id in try registeredIDs() {
            try cancelIfPresent(id)
        }
        try write(nil)
    }

    private func beginChange() throws {
        guard !changing else { throw ProbeError.busy }
        changing = true
    }

    private func currentRecord(for alarmID: String) throws -> ProbeRecord? {
        guard let id = UUID(uuidString: alarmID), let record = try read(),
              record.alarmID == id, record.doneAt == nil else { return nil }
        return record
    }

    private func registeredIDs() throws -> [UUID] {
        try manager.alarms.map(\.id).sorted { $0.uuidString < $1.uuidString }
    }

    private func cancelIfPresent(_ id: UUID) throws {
        guard try registeredIDs().contains(id) else { return }
        do {
            try manager.cancel(id: id)
        } catch {
            // The daemon may remove the alarm between listing and cancelling it.
            guard (try? registeredIDs().contains(id)) == false else { throw error }
        }
    }

    private func registerAndSave(_ record: ProbeRecord) async throws {
        let id = record.alarmID.uuidString
        let configuration = AlarmManager.AlarmConfiguration<ProbeMetadata>.alarm(
            schedule: .fixed(record.fireAt),
            attributes: ProbeEngine.attributes(),
            stopIntent: CompleteProbeIntent(alarmID: id),
            secondaryIntent: PostponeProbeIntent(alarmID: id),
            sound: .default
        )
        _ = try await manager.schedule(id: record.alarmID, configuration: configuration)
        do {
            try write(record)
        } catch {
            // An unrecorded alarm cannot accept a matching action. Try to remove it.
            do {
                try cancelIfPresent(record.alarmID)
            } catch {
                Self.log.error("Alarm rollback failed: \(String(describing: error), privacy: .private)")
            }
            throw error
        }
    }

    private static func attributes() -> AlarmAttributes<ProbeMetadata> {
        let title: LocalizedStringResource = "alarm.title"
        let postpone = AlarmButton(text: "alarm.postpone", textColor: .white, systemImageName: "clock")
        let alert: AlarmPresentation.Alert
        if #available(iOS 26.1, *) {
            alert = .init(title: title, secondaryButton: postpone, secondaryButtonBehavior: .custom)
        } else {
            let done = AlarmButton(text: "alarm.done", textColor: .white, systemImageName: "checkmark")
            alert = .init(title: title, stopButton: done, secondaryButton: postpone, secondaryButtonBehavior: .custom)
        }
        return AlarmAttributes(presentation: AlarmPresentation(alert: alert), metadata: ProbeMetadata(), tintColor: .blue)
    }

    private func recordURL() throws -> URL {
        try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        ).appendingPathComponent("alarm-probe.json")
    }

    private func read() throws -> ProbeRecord? {
        do {
            return try JSONDecoder().decode(ProbeRecord?.self, from: Data(contentsOf: recordURL()))
        } catch CocoaError.fileReadNoSuchFile {
            return nil
        }
    }

    private func write(_ record: ProbeRecord?) throws {
        try JSONEncoder().encode(record).write(
            to: recordURL(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
        )
    }
}

struct CompleteProbeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "alarm.done"
    static var supportedModes: IntentModes { .background }
    static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

    @Parameter(title: "field.alarmID") var alarmID: String

    init() { alarmID = "" }
    init(alarmID: String) { self.alarmID = alarmID }

    @MainActor
    func perform() async throws -> some IntentResult {
        do { try ProbeEngine.shared.complete(alarmID: alarmID) }
        catch {
            ProbeEngine.log.error("Completion failed: \(String(describing: error), privacy: .private)")
            throw (error as? ProbeError) ?? ProbeError.operationFailed
        }
        return .result()
    }
}

struct PostponeProbeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "alarm.postpone"
    static var supportedModes: IntentModes { .background }
    static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

    @Parameter(title: "field.alarmID") var alarmID: String

    init() { alarmID = "" }
    init(alarmID: String) { self.alarmID = alarmID }

    @MainActor
    func perform() async throws -> some IntentResult {
        do { try await ProbeEngine.shared.postpone(alarmID: alarmID) }
        catch {
            ProbeEngine.log.error("Postponement failed: \(String(describing: error), privacy: .private)")
            throw (error as? ProbeError) ?? ProbeError.operationFailed
        }
        return .result()
    }
}
