import Foundation

struct IOSRoutinePause: Codable {
    let fromMs: Int64
    var untilMs: Int64?

    func contains(_ time: Int64) -> Bool {
        fromMs <= time && (untilMs.map { time < $0 } ?? true)
    }
}

struct IOSRoutinePlan: Codable {
    let id: String
    let startsOn: String
    var versions: [IOSRoutineVersion]
    var state = "Active"
    var revision = 1
    var pauses: [IOSRoutinePause] = []
    var trashIntervals: [IOSRoutinePause] = []
    var trashedAtMs: Int64?
    var preTrashState: String?
    // Preserve Android's wire lineage without feeding it to iOS series delivery.
    var portableSegments: [IOSSeriesSegment]?
    var portableVersionRevision: Int?
    var portableSlots: [String: IOSPortableExclusion]?
    var portableUnboundReminders: [IOSReminder]?
    var portableExclusions: [String: IOSPortableExclusion]?

    var latest: IOSRoutineVersion? { versions.max { $0.revision < $1.revision } }

    var bridge: [String: Any] {
        var output = latest?.bridge ?? [:]
        output["id"] = id
        output["startsOn"] = startsOn
        output["state"] = state
        output["revision"] = revision
        return output
    }

    func version(on date: String) -> IOSRoutineVersion? {
        versions.filter { $0.effectiveDate <= date }.max {
            ($0.effectiveDate, $0.revision) < ($1.effectiveDate, $1.revision)
        }
    }
}

struct IOSRoutineChange: Codable {
    let id: String
    let kind: String
    let stepID: String?
    let completed: Bool?
    let atMs: Int64

    var bridge: [String: Any] {
        ["id": id, "kind": kind, "stepId": iosBridgeValue(stepID), "completed": iosBridgeValue(completed), "atMs": atMs]
    }
}

struct IOSRoutineSession: Codable {
    let routineID: String
    let occurrenceID: String
    let date: String
    var versionRevision: Int
    var steps: [IOSRoutineStep]
    var revision = 0
    var ended = false
    var done: Set<String> = []
    var changes: [IOSRoutineChange] = []

    func bridge(record: IOSReminder, plan: IOSRoutinePlan, now: Int64, zone: TimeZone) -> [String: Any]? {
        guard let version = plan.versions.first(where: { $0.revision == versionRevision }),
              let ends = try? RemiloIOSRoutineAuthoring.closeAt(date, in: zone) else { return nil }
        let closed = ended || now >= ends
        let skipped = record.skipped == true
        let state: String
        if steps.isEmpty { state = "Rest" }
        else if skipped { state = "Skipped" }
        else if record.completed { state = "Completed" }
        else if closed { state = done.isEmpty ? "NotCompleted" : "PartiallyCompleted" }
        else if plan.state == "Paused" { state = "Paused" }
        else if date > RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone) { state = "Upcoming" }
        else { state = done.isEmpty ? "Ready" : "InProgress" }
        return [
            "occurrenceId": occurrenceID, "routineId": routineID, "date": date, "title": record.title,
            "revision": revision, "deleted": record.deleted, "ended": closed, "endsAtMs": ends,
            "completedCount": done.count, "totalCount": steps.count, "state": state, "completed": record.completed,
            "skipped": skipped, "notes": version.notes, "mode": version.mode, "minutes": version.minutes,
            "sound": version.sound, "vibration": version.vibration, "authoringMode": version.authoringMode,
            "presentationPreset": version.presentationPreset, "changes": changes.map(\.bridge),
            "steps": steps.map { step in step.bridge.merging(["completed": done.contains(step.id)]) { _, new in new } },
        ]
    }

    static func upcoming(
        plan: IOSRoutinePlan, version: IOSRoutineVersion, date: String, zone: TimeZone, today: String
    ) throws -> [String: Any] {
        let steps = try RemiloIOSRoutineAuthoring.day(date, in: version).exercises
        let state = steps.isEmpty ? "Rest" : plan.state == "Paused" ? "Paused" : "Upcoming"
        return [
            "routineId": plan.id, "date": date, "title": version.title, "revision": 0, "deleted": false,
            "ended": date < today, "endsAtMs": try RemiloIOSRoutineAuthoring.closeAt(date, in: zone),
            "completedCount": 0, "totalCount": steps.count, "state": state, "completed": false, "skipped": false,
            "notes": version.notes, "mode": version.mode, "minutes": version.minutes, "sound": version.sound,
            "vibration": version.vibration, "authoringMode": version.authoringMode,
            "presentationPreset": version.presentationPreset, "changes": [[String: Any]](),
            "steps": steps.map { step in step.bridge.merging(["completed": false]) { _, new in new } },
        ]
    }
}
