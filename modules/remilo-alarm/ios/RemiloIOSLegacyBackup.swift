import Foundation

/// Upgrade historical Android backup fields before the current content validator.
/// Fields unavailable in a source version must be absent or carry an inert default.
enum RemiloIOSLegacyBackup {
    typealias Content = RemiloIOSPortableContent

    static func upgrade(_ source: [String: Any], version: Int) throws -> [String: Any] {
        var result = source
        result["version"] = 9
        if result["exportedAtMs"] == nil { result["exportedAtMs"] = 0 }
        if version < 4 { try legacyDefault(&result, "purgedOccurrences", [Any]()) }
        if version < 5 {
            for key in ["routines", "routineVersions", "routineSessions"] {
                try legacyDefault(&result, key, [Any]())
            }
        }
        if version < 7 {
            for key in ["images", "purgedRoutines"] { try legacyDefault(&result, key, [Any]()) }
        }

        if version < 3 { try legacyDefault(&result, "lists", [Any]()) }
        if version == 1 { try legacyDefault(&result, "series", [Any]()) }
        var derivedLists: [Data: IOSList] = [:]
        func record(_ raw: [String: Any]) throws -> [String: Any] {
            var row = raw
            if version == 1 {
                for key in ["deleted", "exception", "skipped"] { try legacyDefault(&row, key, false) }
                for key in ["segmentId", "nominalSlot"] { try legacyDefault(&row, key, NSNull()) }
            }
            if version < 5 { try legacyDefault(&row, "routineId", NSNull()) }
            if version < 3 {
                try legacyDefault(&row, "listId", NSNull())
                let input = IOSInput(values: row)
                let name = try input.text("listName", maximum: 60)
                if !name.isEmpty {
                    let key = Data(name.utf8)
                    let id = RemiloIOSSeries.namedUUID("remilo:list:\(name)")
                    if derivedLists[key] == nil {
                        derivedLists[key] = IOSList(
                            id: id, name: name, createdAtMs: try input.integer("createdAtMs", range: Content.clockRange)
                        )
                    }
                    row["listId"] = id
                }
            }
            return row
        }
        result["series"] = try Content.objects(result, key: "series", optional: true).map { raw in
            var segment = raw
            guard let template = raw["template"] as? [String: Any] else { throw invalid("template") }
            segment["template"] = try record(template)
            return segment
        }
        result["reminders"] = try Content.objects(result, key: "reminders").map(record)
        if version < 3 {
            result["lists"] = derivedLists.values.sorted { $0.id < $1.id }.map {
                ["id": $0.id, "name": $0.name, "createdAtMs": $0.createdAtMs ?? 0] as [String: Any]
            }
        }
        if version >= 5 { try upgradeRoutines(&result, version: version) }
        return result
    }

    private static func upgradeRoutines(_ root: inout [String: Any], version: Int) throws {
        let versions = try Content.objects(root, key: "routineVersions")
        var legacyRevisions: [String: [String: Int]] = [:]
        if version == 5 {
            var dates: [String: Set<String>] = [:]
            for fields in versions {
                let input = IOSInput(values: fields)
                let id = try Content.nonblank(input, "routineId")
                let date = try Content.nonblank(input, "effectiveDate", maximum: 10)
                guard dates[id, default: []].insert(date).inserted else { throw invalid("routineVersions") }
            }
            for (id, days) in dates {
                legacyRevisions[id] = Dictionary(uniqueKeysWithValues: days.sorted().enumerated().map { ($0.element, $0.offset + 1) })
            }
        }

        root["routines"] = try Content.objects(root, key: "routines").map { raw in
            var row = raw
            let input = IOSInput(values: raw)
            let id = try Content.nonblank(input, "id")
            if version == 5 {
                guard let revisions = legacyRevisions[id] else { throw invalid("routineVersions") }
                try legacyDefault(&row, "revision", revisions.count)
            }
            if version < 7 {
                let state = try input.choice("state", fallback: "", from: ["Active", "Paused"])
                try legacyDefault(&row, "priorState", state)
                try legacyDefault(&row, "trashedAtMs", 0)
                try legacyDefault(&row, "trashIntervals", [Any]())
            }
            return row
        }
        root["routineVersions"] = try versions.map { raw in
            var row = raw
            let input = IOSInput(values: raw)
            if version == 5 {
                let id = try Content.nonblank(input, "routineId")
                let date = try Content.nonblank(input, "effectiveDate", maximum: 10)
                guard let revision = legacyRevisions[id]?[date] else { throw invalid("routineVersions") }
                try legacyDefault(&row, "revision", revision)
                try legacyDefault(&row, "notes", "")
                try legacyDefault(&row, "sound", "remilo")
                try legacyDefault(&row, "vibration", false)
            }
            if version < 8 {
                try legacyDefault(&row, "authoringMode", "ByWeekday")
                try legacyDefault(&row, "presentationPreset", "Exercise")
            }
            row["days"] = try Content.objects(row, key: "days", maximum: 7).map { rawDay in
                var day = rawDay
                day["exercises"] = try steps(day, key: "exercises", version: version)
                return day
            }
            return row
        }
        root["routineSessions"] = try Content.objects(root, key: "routineSessions").map { raw in
            var row = raw
            let input = IOSInput(values: raw)
            if version == 5 {
                let id = try Content.nonblank(input, "routineId")
                let date = try Content.nonblank(input, "versionDate", maximum: 10)
                guard let revision = legacyRevisions[id]?[date] else { throw invalid("routineSessions") }
                try legacyDefault(&row, "versionRevision", revision)
            }
            let snapshot = try steps(row, key: "steps", version: version)
            if version < 7 {
                let changes = try Content.objects(row, key: "changes", maximum: 100_000)
                guard !snapshot.isEmpty, !changes.contains(where: { $0["kind"] as? String == "EditRoutine" }) else {
                    throw invalid("routineSessions")
                }
            }
            row["steps"] = snapshot
            return row
        }
    }

    private static func steps(_ owner: [String: Any], key: String, version: Int) throws -> [[String: Any]] {
        try Content.objects(owner, key: key, maximum: 100).map { raw in
            var step = raw
            if version < 7 { try legacyDefault(&step, "customImageId", "") }
            if version < 8, step["sharedStepId"] != nil { throw invalid("sharedStepId") }
            if step["exerciseTarget"] != nil { throw invalid("exerciseTarget") }
            return step
        }
    }

    private static func legacyDefault(_ owner: inout [String: Any], _ key: String, _ fallback: Any) throws {
        if let value = owner[key] {
            let source = try JSONSerialization.data(withJSONObject: [value], options: [.sortedKeys])
            let expected = try JSONSerialization.data(withJSONObject: [fallback], options: [.sortedKeys])
            guard source == expected else { throw invalid(key) }
        }
        owner[key] = fallback
    }

    private static func invalid(_ field: String) -> IOSInputFailure { IOSInputFailure("INVALID_INPUT", field: field) }
}
