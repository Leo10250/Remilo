import AlarmKit
import Foundation
import OSLog
import SwiftUI

@main
struct AlarmKitProbeApp: App {
    var body: some Scene {
        WindowGroup { ProbeView() }
    }
}

private struct ProbeView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var snapshot: ProbeSnapshot?
    @State private var issue: String?
    @State private var working = false

    private let engine = ProbeEngine.shared

    var body: some View {
        NavigationStack {
            List {
                Section("section.controls") {
                    Button("action.schedule") { Task { await run { try await engine.schedule(after: 60) } } }
                    Button("action.scheduleReboot") { Task { await run { try await engine.schedule(after: 180) } } }
                    Button("action.refresh") { Task { await run {} } }
                    Button("action.reset", role: .destructive) { Task { await run { try engine.reset() } } }
                }
                .disabled(working)

                if let issue {
                    Section("section.issue") { Text(verbatim: issue) }
                }

                if let snapshot {
                    Section("section.status") {
                        LabeledContent("field.permission") { Text(permission(for: snapshot.authorization)) }
                        if let record = snapshot.record {
                            Text(status(for: record, in: snapshot))
                            dateRow("field.fireAt", record.fireAt)
                            if let postponedAt = record.postponedAt { dateRow("field.postponedAt", postponedAt) }
                            if let doneAt = record.doneAt { dateRow("field.doneAt", doneAt) }
                            idRow("field.occurrenceID", record.occurrenceID)
                            idRow("field.alarmID", record.alarmID)
                            if let previousID = record.previousAlarmID { idRow("field.previousAlarmID", previousID) }
                        } else {
                            Text("status.empty")
                        }
                    }

                    Section("section.registry") {
                        if let ids = snapshot.registeredIDs {
                            if ids.isEmpty { Text("registry.empty") }
                            ForEach(ids, id: \.self) { id in
                                Text(verbatim: id.uuidString)
                                    .font(.footnote.monospaced())
                                    .textSelection(.enabled)
                            }
                        } else {
                            Text("registry.unavailable")
                        }
                    }
                }
            }
            .navigationTitle("screen.title")
        }
        .task(id: scenePhase) {
            if scenePhase == .active { await run {} }
        }
    }

    private func permission(for state: AlarmManager.AuthorizationState) -> LocalizedStringKey {
        switch state {
        case .authorized: "permission.allowed"
        case .denied: "permission.denied"
        case .notDetermined: "permission.pending"
        @unknown default: "permission.unknown"
        }
    }

    private func status(for record: ProbeRecord, in snapshot: ProbeSnapshot) -> LocalizedStringKey {
        if record.doneAt != nil { return "status.done" }
        guard let ids = snapshot.registeredIDs else { return "status.unconfirmed" }
        if !ids.contains(record.alarmID) { return "status.missing" }
        if let previousID = record.previousAlarmID, ids.contains(previousID) { return "status.postponePartial" }
        return record.postponedAt == nil ? "status.scheduled" : "status.postponed"
    }

    private func dateRow(_ title: LocalizedStringKey, _ value: Date) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
            Text(value, format: .dateTime.year().month().day().hour().minute().second())
                .foregroundStyle(.secondary)
        }
    }

    private func idRow(_ title: LocalizedStringKey, _ value: UUID) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
            Text(verbatim: value.uuidString)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
    }

    private func run(_ operation: @MainActor () async throws -> Void) async {
        guard !working else { return }
        working = true
        issue = nil
        defer { working = false }

        do {
            try await operation()
        } catch {
            report(error)
        }

        do {
            snapshot = try engine.snapshot()
        } catch {
            snapshot = nil
            if issue == nil { report(error) }
        }
    }

    private func report(_ error: Error) {
        ProbeEngine.log.error("Probe operation failed: \(String(describing: error), privacy: .private)")
        issue = ((error as? ProbeError) ?? .operationFailed).errorDescription
    }
}
