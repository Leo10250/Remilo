import Foundation

/// Read-only presentation data shared with the widget extension. The app owns authored state and progress.
struct RemiloWidgetSnapshot: Codable, Equatable {
    struct Reminder: Codable, Equatable {
        let id: String
        let title: String
        let agendaAtMs: Int64
        let overdueAtMs: Int64
        let allDay: Bool
    }

    struct Routine: Codable, Equatable {
        enum State: String, Codable { case ready, inProgress, complete, skipped, paused, rest, unavailable }

        struct Step: Codable, Equatable {
            let id: String
            let name: String
            let target: String
        }

        let id: String
        let title: String
        let state: State
        let occurrenceID: String?
        let revision: Int?
        let done: Int
        let total: Int
        let current: Step?
        let nextName: String?
    }

    let schemaVersion: Int
    let date: String
    let dayStartsAtMs: Int64
    let dayEndsAtMs: Int64
    let zoneID: String
    let language: String
    let reminders: [Reminder]
    let reminderCount: Int
    let routines: [Routine]

    static let currentVersion = 1

    func isCurrent(at instant: Date, in zone: TimeZone) -> Bool {
        let milliseconds = instant.timeIntervalSince1970 * 1_000
        return zone.identifier == zoneID && milliseconds >= Double(dayStartsAtMs) && milliseconds < Double(dayEndsAtMs)
    }
}

enum RemiloWidgetSnapshotFile {
    private static let group = "group.com.remilo.app.widgets"

    static var isAvailable: Bool { fileURL() != nil }

    static func appGroup(sideloadedGroups: [String]?) -> String? {
        guard let sideloadedGroups else { return group }
        if sideloadedGroups.contains(group) { return group }
        let prefix = group + "."
        let matches = sideloadedGroups.filter { candidate in
            guard candidate.hasPrefix(prefix) else { return false }
            let suffix = candidate.dropFirst(prefix.count)
            return suffix.utf8.count == 10 && suffix.utf8.allSatisfy { (48...57).contains($0) || (65...90).contains($0) }
        }
        return matches.count == 1 ? matches.first : nil
    }

    static func read() throws -> RemiloWidgetSnapshot? {
        guard let file = fileURL() else { return nil }
        let snapshot = try JSONDecoder().decode(RemiloWidgetSnapshot.self, from: Data(contentsOf: file))
        return snapshot.schemaVersion == RemiloWidgetSnapshot.currentVersion ? snapshot : nil
    }

    /// A repeat write with the same visible state needs no WidgetKit timeline request.
    static func publish(_ snapshot: RemiloWidgetSnapshot) throws -> Bool {
        guard let file = fileURL() else { return false }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let bytes = try encoder.encode(snapshot)
        if let existing = try? Data(contentsOf: file), existing == bytes { return false }
        var directory = file.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        #if os(iOS)
        try bytes.write(to: file, options: [.atomic, .completeFileProtection])
        #else
        try bytes.write(to: file, options: .atomic)
        #endif
        return true
    }

    private static func fileURL() -> URL? {
        #if os(iOS)
        let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String]
        guard let groupID = appGroup(sideloadedGroups: groups) else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Application Support", isDirectory: true)
            .appendingPathComponent("RemiloWidgets", isDirectory: true)
            .appendingPathComponent("snapshot-v1.json")
        #else
        return nil
        #endif
    }
}
