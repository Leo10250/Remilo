import CoreFoundation
import Foundation

struct IOSCalendarExportIntent: Codable, Equatable, Sendable {
    struct Scope: Codable, Equatable, Sendable {
        let setupID: UUID
        let bindingRevision: Int
        let authEpoch: Int
        let accountGeneration: Int
    }

    let operationID: UUID
    let scope: Scope
}

struct IOSReminder: Codable {
    var id: String
    var title: String
    var notes: String
    var listID: String?
    var eventStartMs: Int64
    var eventEndMs: Int64
    var dueAtMs: Int64
    var alarmAtMs: Int64
    var zoneID: String
    var mode: String
    var allDay: Bool
    var dueLinked: Bool
    var alarmLinked: Bool
    var sound: String? = nil
    var segmentID: String? = nil
    var routineID: String? = nil
    var nominalSlot: String? = nil
    var independent: Bool? = nil
    var deferredSeriesOverride: Bool? = nil
    var skipped: Bool? = nil
    var completed = false
    var deleted = false
    var revision = 1
    // The last authored revision that changed one-time Calendar authority.
    var calendarLifecycleRevision: Int? = nil
    var calendarInstanceID: String? = nil
    var calendarInstanceEditBaseline: IOSCalendarSeriesInstanceEdit.Fields? = nil
    var calendarExportIntent: IOSCalendarExportIntent? = nil
    var generation = 0
    var deliveryState = "NoAlert"
    var nextAlertMs: Int64?
    var retainedAlertMs: Int64?
    var registration: IOSReminderRegistration?
    var adjustment: String?
    var history: [IOSHistory] = []
    var isTest = false
    var createdAtMs: Int64? = nil
    var vibration: Bool? = nil

    var active: Bool { !completed && !deleted && skipped != true }
    var isCalendarOneTime: Bool { !isTest && segmentID == nil && routineID == nil }
    var agendaAtMs: Int64 { mode == "None" ? eventStartMs : (nextAlertMs ?? alarmAtMs) }
    var overdueAtMs: Int64 {
        if mode != "None" { return alarmAtMs }
        return allDay ? eventEndMs : eventStartMs
    }
    var collectionAtMs: Int64 {
        let kind = deleted ? "Delete" : (skipped == true ? "Skip" : "Done")
        return history.last { $0.kind == kind }?.atMs ?? eventStartMs
    }

    func overdue(at now: Int64) -> Bool { routineID == nil && active && overdueAtMs < now }

    mutating func deferSeriesOverride(target: Int64) {
        deferredSeriesOverride = true
        nextAlertMs = target
        deliveryState = "Pending"
    }
}

struct IOSHistory: Codable {
    let kind: String
    let atMs: Int64
    let targetMs: Int64?
    var portableID: String? = nil
}

struct IOSList: Codable {
    let id: String
    var name: String
    var revision = 1
    var createdAtMs: Int64? = nil
}

struct IOSPortableExclusion: Codable {
    let segmentID: String
    let nominalSlot: String
}

struct IOSSeriesSegment: Codable {
    let id: String
    let familyID: String
    var template: IOSReminder
    var rule: RemiloIOSRecurrence.Rule
    let createdAtMs: Int64
    var revision = 1
    var state = "Active"
    var materializedThrough: String?
    var calendarBaselineRule: RemiloIOSRecurrence.Rule? = nil
}

struct IOSSettings: Codable {
    var revision = 0
    var snoozeMinutes = 10
    var tomorrowMorning = 600
    var tomorrowAfternoon = 840
    var tomorrowEvening = 1020
    var theme = "system"
    var atmosphere = "automatic"
    var language = "system"
    var sound: String? = nil

    var alertSound: String { sound ?? "remilo" }

    var bridge: [String: Any] {
        [
            "revision": revision, "snoozeMinutes": snoozeMinutes,
            "tomorrowMorning": tomorrowMorning, "tomorrowAfternoon": tomorrowAfternoon,
            "tomorrowEvening": tomorrowEvening, "theme": theme, "atmosphere": atmosphere,
            "language": language, "sound": alertSound, "vibration": false,
        ]
    }
}

struct IOSOperationReceipt: Codable {
    let fingerprint: Data
    let occurrenceID: String?
    let registrationID: UUID?
    var seriesSegmentID: String? = nil
    var seriesRevision: Int? = nil
    var importRegistrationIDs: Set<UUID>? = nil
    var groupRegistrationIDs: [String: UUID]? = nil
    var result: Data
    var finalized: Bool
}

struct IOSDeliveryWork: Codable {
    enum Action: String, Codable { case cancel, register }
    let action: Action
    let registration: IOSReminderRegistration
}

struct IOSDatabase: Codable {
    var schemaVersion = 1
    private var freshCalendarInstallation: Bool?
    var reminders: [String: IOSReminder] = [:]
    var lists: [String: IOSList] = [:]
    var settings = IOSSettings()
    var receipts: [String: IOSOperationReceipt] = [:]
    var outbox: [IOSDeliveryWork] = []
    private var seriesSegments: [String: IOSSeriesSegment]?
    private var seriesExclusions: Set<String>?
    var purgedLocalOccurrences: Set<String>?
    var portableExclusions: [String: IOSPortableExclusion]?
    var purgedRoutines: Set<String>?
    private var routinePlans: [String: IOSRoutinePlan]?
    private var routineDates: [String: IOSRoutineSession]?

    var isFreshCalendarInstallation: Bool { freshCalendarInstallation == true }

    static func freshInstallation() -> Self {
        var state = Self()
        state.freshCalendarInstallation = true
        return state
    }

    var series: [String: IOSSeriesSegment] {
        get { seriesSegments ?? [:] }
        set { seriesSegments = newValue }
    }

    var excludedOccurrences: Set<String> {
        get { seriesExclusions ?? [] }
        set { seriesExclusions = newValue }
    }

    func isPurgedOccurrence(_ id: String) -> Bool {
        seriesExclusions?.contains(id) == true || purgedLocalOccurrences?.contains(id) == true
    }

    var routines: [String: IOSRoutinePlan] {
        get { routinePlans ?? [:] }
        set { routinePlans = newValue }
    }

    var routineSessions: [String: IOSRoutineSession] {
        get { routineDates ?? [:] }
        set { routineDates = newValue }
    }

    var referencedImages: Set<String> {
        iosRoutineImageIDs(routines, routineSessions)
    }
}

func iosRoutineImageIDs(
    _ plans: [String: IOSRoutinePlan], _ sessions: [String: IOSRoutineSession]
) -> Set<String> {
    let authored = plans.values.lazy.flatMap(\.versions).flatMap(\.days).flatMap(\.exercises)
    let snapshots = sessions.values.lazy.flatMap(\.steps)
    return Set(authored.compactMap(\.customImageId)).union(snapshots.compactMap(\.customImageId))
}

enum IOSStore {
    private enum Failure: Error { case unsupportedSchema }

    static func read() throws -> IOSDatabase {
        try read(at: url())
    }

    static func read(at stateURL: URL) throws -> IOSDatabase {
        do {
            let data = try Data(contentsOf: stateURL)
            let header = try JSONDecoder().decode(Version.self, from: data)
            guard header.schemaVersion == 1 else { throw Failure.unsupportedSchema }
            return try JSONDecoder().decode(IOSDatabase.self, from: data)
        } catch CocoaError.fileReadNoSuchFile {
            return IOSDatabase.freshInstallation()
        }
    }

    static func write(_ state: IOSDatabase) throws {
        var options: Data.WritingOptions = [.atomic]
        #if os(iOS)
        options.insert(.completeFileProtectionUntilFirstUserAuthentication)
        #endif
        try JSONEncoder().encode(state).write(to: url(), options: options)
    }

    private struct Version: Decodable { let schemaVersion: Int }

    private static func url() throws -> URL {
        try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        ).appendingPathComponent("remilo-state.json")
    }
}

struct IOSInputFailure: Error {
    let code: String
    let field: String?

    init(_ code: String, field: String? = nil) {
        self.code = code
        self.field = field
    }

    var bridge: [String: Any] {
        var result: [String: Any] = ["status": "Rejected", "errorCode": code]
        if let field { result["errorField"] = field }
        return result
    }
}

struct IOSInput {
    let values: [String: Any]

    func text(_ key: String, fallback: String = "", maximum: Int) throws -> String {
        guard let raw = values[key] else { return fallback }
        guard let value = raw as? String, value.utf16.count <= maximum else { throw invalid(key) }
        return value
    }

    func choice(_ key: String, fallback: String, from allowed: Set<String>) throws -> String {
        let value = try text(key, fallback: fallback, maximum: 32)
        guard allowed.contains(value) else { throw invalid(key) }
        return value
    }

    func flag(_ key: String, fallback: Bool) throws -> Bool {
        guard let raw = values[key] else { return fallback }
        guard let number = raw as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
            throw invalid(key)
        }
        return number.boolValue
    }

    func integer(_ key: String, fallback: Int64? = nil, range: ClosedRange<Int64>) throws -> Int64 {
        guard let raw = values[key] else {
            if let fallback, range.contains(fallback) { return fallback }
            throw invalid(key)
        }
        guard let number = raw as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              let value = Int64(exactly: number.doubleValue), range.contains(value) else {
            throw invalid(key)
        }
        return value
    }

    func invalid(_ field: String) -> IOSInputFailure { IOSInputFailure("INVALID_INPUT", field: field) }
}

func iosBridgeValue<T>(_ value: T?) -> Any {
    if let value { return value }
    return NSNull()
}

func iosMillis(_ date: Date) -> Int64 { Int64((date.timeIntervalSince1970 * 1_000).rounded()) }

func iosDate(_ millis: Int64) -> Date { Date(timeIntervalSince1970: Double(millis) / 1_000) }
