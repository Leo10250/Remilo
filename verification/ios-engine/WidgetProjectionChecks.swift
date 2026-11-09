import Foundation

enum WidgetProjectionChecks {
    @MainActor
    static func run() async throws {
        try projection()
        try await exactWidgetAction()
        print("iOS widget snapshot and action checks passed")
    }

    private static func projection() throws {
        let zone = TimeZone(identifier: "America/Los_Angeles")!
        let now = iosMillis(ISO8601DateFormatter().date(from: "2026-03-08T08:00:00Z")!)
        var state = IOSDatabase()
        state.reminders["past"] = record("past", alert: now - 1, next: now + 180_000_000)
        state.reminders["today"] = record("today", alert: now + 3_600_000)
        state.reminders["future"] = record("future", alert: now + 86_400_000)
        state.reminders["test"] = record("test", alert: now + 1, isTest: true)
        state.reminders["routine"] = record("routine", alert: now + 1, routineID: "plan")
        state.reminders["complete"] = record("complete", alert: now + 1, completed: true)
        let step = IOSRoutineStep(
            id: "step", name: "Interval", target: "", notes: "private-step-note", illustration: nil,
            customImageId: "private-image", sharedStepId: nil,
            exerciseTarget: IOSExerciseTarget(sets: 3, duration: .init(value: 40, unit: "sec"))
        )
        let version = IOSRoutineVersion(
            effectiveDate: "2026-03-08", revision: 1, title: "Routine title", minutes: 600, mode: "Alarm",
            notes: "private-routine-note", sound: "system", vibration: false, listID: nil,
            authoringMode: "ByWeekday", presentationPreset: "Exercise",
            days: Array(repeating: IOSRoutineDay(exercises: [step]), count: 7)
        )
        state.routines["plan"] = IOSRoutinePlan(id: "plan", startsOn: "2026-03-08", versions: [version])
        var trashed = IOSRoutinePlan(id: "trashed", startsOn: "2026-03-08", versions: [version])
        trashed.state = "Trashed"
        state.routines["trashed"] = trashed
        let occurrence = RemiloIOSSeries.occurrenceID("plan", "2026-03-08")
        state.reminders[occurrence] = record(occurrence, alert: now + 1, routineID: "plan")
        state.routineSessions[occurrence] = IOSRoutineSession(
            routineID: "plan", occurrenceID: occurrence, date: "2026-03-08", versionRevision: 1, steps: [step]
        )
        let snapshot = RemiloIOSWidgetProjection.snapshot(state, at: now, in: zone, language: "zh-Hans")
        assert(snapshot.date == "2026-03-08")
        assert(snapshot.dayEndsAtMs - snapshot.dayStartsAtMs == 23 * 60 * 60 * 1_000)
        assert(snapshot.isCurrent(at: iosDate(now), in: zone))
        assert(!snapshot.isCurrent(at: iosDate(snapshot.dayEndsAtMs), in: zone))
        assert(!snapshot.isCurrent(at: iosDate(now), in: TimeZone(identifier: "America/New_York")!))
        assert(snapshot.reminderCount == 2 && snapshot.reminders.map(\.id) == ["past", "today"])
        assert(snapshot.routines.map(\.id) == ["plan"])
        assert(snapshot.routines.first?.occurrenceID == occurrence)
        assert(snapshot.routines.first?.current?.target == "3 组 × 40 秒")
        let bytes = try JSONEncoder().encode(snapshot)
        let text = String(decoding: bytes, as: UTF8.self)
        assert(!text.contains("private"))
        let decoded = try JSONDecoder().decode(RemiloWidgetSnapshot.self, from: bytes)
        assert(decoded == snapshot)
        let group = "group.com.remilo.app.widgets"
        assert(RemiloWidgetSnapshotFile.appGroup(sideloadedGroups: nil) == group)
        assert(RemiloWidgetSnapshotFile.appGroup(sideloadedGroups: [group + ".A1B2C3D4E5"]) == group + ".A1B2C3D4E5")
        assert(RemiloWidgetSnapshotFile.appGroup(sideloadedGroups: [group + ".INVALID", "group.other.app"]) == nil)
        assert(RemiloWidgetSnapshotFile.appGroup(sideloadedGroups: [group + ".A1B2C3D4E5", group + ".F1G2H3I4J5"]) == nil)
    }

    @MainActor
    private static func exactWidgetAction() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let zone = TimeZone.current
        let today = RemiloIOSRoutineAuthoring.localDate(Date(), in: zone)
        let steps = [
            ["id": "first", "name": "Private first", "target": "", "notes": ""],
            ["id": "second", "name": "Private second", "target": "", "notes": ""],
        ]
        let created = try await engine.apply([
            "kind": "CreateRoutine", "startsOn": today, "operationId": "create-widget-routine",
            "title": "Private routine", "mode": "None", "minutes": 720,
            "days": Array(repeating: ["type": "Exercises", "exercises": steps] as [String: Any], count: 7),
        ])
        precondition(created["status"] as? String == "Applied")
        let now = iosMillis(Date())
        let projected = try RemiloIOSWidgetProjection.snapshot(store.load(), at: now, in: zone, language: "en").routines[0]
        let first = RemiloWidgetDoneAction(
            occurrenceID: projected.occurrenceID!, date: today, revision: projected.revision!, stepID: projected.current!.id
        )!
        precondition(Set(first.command.keys) == [
            "kind", "operationId", "occurrenceId", "date", "stepId", "expectedRevision", "completed",
        ])
        precondition(RemiloWidgetDoneAction(occurrenceID: "invalid", date: today, revision: 0, stepID: "first") == nil)
        precondition(RemiloWidgetDoneAction(occurrenceID: first.occurrenceID, date: "not-a-date", revision: 0, stepID: "first") == nil)
        precondition(RemiloWidgetDoneAction(occurrenceID: first.occurrenceID, date: "2026-02-31", revision: 0, stepID: "first") == nil)
        let result = try await engine.apply(first.command)
        precondition(result["status"] as? String == "Applied")

        let restarted = store.engine()
        let replay = try await restarted.apply(first.command)
        precondition(replay["status"] as? String == "Applied")
        let afterReplay = try store.load()
        let session = afterReplay.routineSessions[first.occurrenceID]!
        precondition(session.changes.count == 1 && session.changes.first?.id == first.operationID)
        let secondID = session.steps[1].id
        let stale = RemiloWidgetDoneAction(occurrenceID: first.occurrenceID, date: today, revision: first.revision, stepID: secondID)!
        let rejected = try await restarted.apply(stale.command)
        precondition(rejected["errorCode"] as? String == "STALE_REVISION")
        let wrongDate = try RemiloIOSRoutineAuthoring.date(today, plusDays: -1)
        let oldDay = RemiloWidgetDoneAction(occurrenceID: first.occurrenceID, date: wrongDate, revision: session.revision, stepID: secondID)!
        let expired = try await restarted.apply(oldDay.command)
        precondition(expired["errorCode"] as? String == "STALE_DATE")

        let second = RemiloWidgetDoneAction(occurrenceID: first.occurrenceID, date: today, revision: session.revision, stepID: secondID)!
        precondition(first.operationID != second.operationID && stale.operationID != second.operationID)
        store.interruptNextWrite = true
        do {
            _ = try await restarted.apply(second.command)
            preconditionFailure("Expected an interrupted widget write")
        } catch FixtureStore.Failure.writeInterrupted {}
        let retried = try await restarted.apply(second.command)
        precondition(retried["status"] as? String == "Applied")
        let complete = try store.load()
        precondition(complete.reminders[first.occurrenceID]?.completed == true)
        precondition(complete.routineSessions[first.occurrenceID]?.changes.map(\.id) == [first.operationID, second.operationID])
    }

    private static func record(
        _ id: String, alert: Int64, next: Int64? = nil, isTest: Bool = false, routineID: String? = nil, completed: Bool = false
    ) -> IOSReminder {
        IOSReminder(
            id: id, title: id, notes: "private-reminder-note", eventStartMs: alert,
            eventEndMs: alert + 60_000, dueAtMs: alert, alarmAtMs: alert,
            zoneID: "America/Los_Angeles", mode: "Alarm", allDay: false, dueLinked: true, alarmLinked: true,
            routineID: routineID, completed: completed, nextAlertMs: next, isTest: isTest
        )
    }
}
