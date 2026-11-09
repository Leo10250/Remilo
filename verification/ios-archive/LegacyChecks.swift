import Foundation

extension ArchiveChecks {
    static func verifyLegacy() throws {
        // Same exact names and timestamps as Android's BackupCodecTest v1 fixture.
        var root: [String: Any] = ["format": "Remilo", "version": 1, "exportedAtMs": 500]
        var record: [String: Any] = [
            "id": "one-off", "title": "Reminder", "eventStartMs": 1_000, "eventEndMs": 2_000,
            "dueAtMs": 1_500, "alarmAtMs": 1_000, "createdAtMs": 500, "completed": false,
            "mode": "Alarm", "allDay": false, "zoneId": "UTC", "dueLinked": false,
            "alarmLinked": true, "sound": "remilo", "vibration": false,
        ]
        let input = [
            ("one-off", "Work"), ("lowercase", "work"), ("spaced", " Work "), ("no-list", ""),
        ]
        root["reminders"] = input.map { id, name in
            var row = record
            row["id"] = id
            row["listName"] = name
            return row
        }
        let one = try RemiloIOSPortableContent.decode(JSONSerialization.data(withJSONObject: root))
        precondition(one.reminders["one-off"]?.listID == "3511f868-8097-32b4-acd3-7315f3fe8401")
        precondition(one.reminders["lowercase"]?.listID == "9a094a6d-f228-36d4-a403-7dfd8a64c2a9")
        precondition(one.reminders["spaced"]?.listID == "fc344e9c-1f2e-3015-b9e8-6a488ecf1343")
        precondition(one.reminders["no-list"]?.listID == nil)
        precondition(Set(one.lists.values.map(\.name)) == ["Work", "work", " Work "])

        record["deleted"] = true
        root["reminders"] = [record]
        let corrupt = try JSONSerialization.data(withJSONObject: root)
        try expectFailure { _ = try RemiloIOSPortableContent.decode(corrupt) }
        root["version"] = 2
        let two = try RemiloIOSPortableContent.decode(JSONSerialization.data(withJSONObject: root))
        precondition(two.reminders["one-off"]?.deleted == true)
        try verifyLegacyRoutineRevisions()
    }

    static func verifyLegacyRoutineRevisions() throws {
        let planID = "legacy-routine"
        let start = "2027-01-07"
        let later = "2027-01-14"
        let due = try RemiloIOSRoutineAuthoring.time(start, minutes: 480, in: TimeZone(secondsFromGMT: 0)!)
        let step = IOSRoutineStep(
            id: "legacy-step", name: "Stretch", target: "30 sec", notes: "", illustration: nil,
            customImageId: nil, sharedStepId: nil, exerciseTarget: nil
        )
        let days = (0..<7).map { IOSRoutineDay(exercises: $0 == 3 ? [step] : []) }
        func version(_ date: String, revision: Int) -> IOSRoutineVersion {
            IOSRoutineVersion(
                effectiveDate: date, revision: revision, title: "Exercise", minutes: 480, mode: "Notification",
                notes: "", sound: "remilo", vibration: false, listID: nil, authoringMode: "ByWeekday",
                presentationPreset: "Exercise", days: days
            )
        }
        var state = IOSDatabase()
        state.routines[planID] = IOSRoutinePlan(
            id: planID, startsOn: start, versions: [version(start, revision: 1), version(later, revision: 2)], revision: 2
        )
        let id = RemiloIOSSeries.occurrenceID(planID, start)
        state.reminders[id] = IOSReminder(
            id: id, title: "Exercise", notes: "", listID: nil, eventStartMs: due,
            eventEndMs: due + 1_800_000, dueAtMs: due, alarmAtMs: due, zoneID: "UTC", mode: "Notification",
            allDay: false, dueLinked: true, alarmLinked: true, sound: "remilo", routineID: planID, nominalSlot: start
        )
        state.routineSessions[id] = IOSRoutineSession(
            routineID: planID, occurrenceID: id, date: start, versionRevision: 1, steps: [step], ended: true
        )
        let current = try RemiloIOSPortableContent.encode(state, now: due)
        var root = try JSONSerialization.jsonObject(with: current) as! [String: Any]
        root["version"] = 5
        root.removeValue(forKey: "images")
        root.removeValue(forKey: "purgedRoutines")
        let plans = root["routines"] as! [[String: Any]]
        root["routines"] = plans.map { raw in
            var plan = raw
            for key in ["revision", "priorState", "trashedAtMs", "trashIntervals"] { plan.removeValue(forKey: key) }
            return plan
        }
        let versions = root["routineVersions"] as! [[String: Any]]
        root["routineVersions"] = versions.reversed().map { raw in
            var version = raw
            for key in ["revision", "notes", "sound", "vibration", "authoringMode", "presentationPreset"] {
                version.removeValue(forKey: key)
            }
            return version
        }
        let sessions = root["routineSessions"] as! [[String: Any]]
        root["routineSessions"] = sessions.map { raw in
            var session = raw
            session.removeValue(forKey: "versionRevision")
            return session
        }
        let restored = try RemiloIOSPortableContent.decode(JSONSerialization.data(withJSONObject: root))
        precondition(restored.routines[planID]?.revision == 2)
        precondition(restored.routines[planID]?.versions.first { $0.effectiveDate == start }?.revision == 1)
        precondition(restored.routines[planID]?.versions.first { $0.effectiveDate == later }?.revision == 2)
        precondition(restored.routineSessions[id]?.versionRevision == 1)
        precondition(restored.routineSessions[id]?.steps.first?.target == "30 sec")
    }
}
