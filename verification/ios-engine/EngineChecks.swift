import Foundation

// The fixture compiles the actual engine and replaces only the OS delivery boundary.
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

enum IOSDeliveryFailure: Error { case denied, elapsed }

enum RemiloIOSExerciseImages {
    static func exists(_ id: String) -> Bool { false }
}

@MainActor
struct RemiloIOSExerciseMedia {
    static let shared = Self()
    func collect(referenced: Set<String>) throws {}
}

extension Notification.Name {
    static let remiloIOSChange = Notification.Name("remilo.ios.change")
}

@MainActor
enum RemiloIOSDelivery {
    static var registrations: [UUID: IOSReminderRegistration] = [:]
    static var alerting = Set<UUID>()
    static var attempts: [UUID] = []
    static var onRegister: ((IOSReminderRegistration) throws -> Void)?
    static var denied = false

    static func register(_ registration: IOSReminderRegistration) async throws {
        attempts.append(registration.systemID)
        try onRegister?(registration)
        if denied { throw IOSDeliveryFailure.denied }
        registrations[registration.systemID] = registration
    }

    static func cancel(_ registration: IOSReminderRegistration) async throws {
        registrations.removeValue(forKey: registration.systemID)
    }

    static func observedStates() async throws -> [UUID: String] {
        registrations.mapValues { alerting.contains($0.systemID) ? "Alerting" : "Scheduled" }
    }
}

@MainActor
final class FixtureStore {
    enum Failure: Error { case writeInterrupted }

    private let url: URL
    var interruptNextWrite = false

    init() {
        url = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-engine-\(UUID()).json")
    }

    func load() throws -> IOSDatabase {
        do { return try JSONDecoder().decode(IOSDatabase.self, from: Data(contentsOf: url)) }
        catch CocoaError.fileReadNoSuchFile { return IOSDatabase() }
    }

    func save(_ state: IOSDatabase) throws {
        if interruptNextWrite {
            interruptNextWrite = false
            throw Failure.writeInterrupted
        }
        try JSONEncoder().encode(state).write(to: url, options: .atomic)
    }

    func engine() -> RemiloIOSEngine { RemiloIOSEngine(loadDatabase: load, saveDatabase: save) }

    func remove() { try? FileManager.default.removeItem(at: url) }
}

@main
@MainActor
struct EngineChecks {
    static func main() async throws {
        try await interruptedAcknowledgementReplaysSameRegistration()
        try await deniedRegistrationRecoversAndStaleDeliveryCannotComplete()
        try await recurringPauseAndSplitPreserveIndependentOccurrences()
        try await expiredAcceptedRegistrationIsNotReplayed()
        try await alarmDismissalLeavesReminderOpen()
        try await routineEditsRetainProgressAndTrashRestoresFamily()
        try routineAlarmActionsKeepDatedProgress()
        try await pausedRoutineDoesNotCreateHistoryForUnopenedDates()
        try await groupCompletionDoesNotTouchLaterArrivals()
        try await preparedImportCommitsOnceAndReplaysAfterStageRemoval()
        #if REMILO_WIDGET_FIXTURE
        try await WidgetProjectionChecks.run()
        #endif
        print("Remilo iOS native engine checks passed")
    }

    private static func interruptedAcknowledgementReplaysSameRegistration() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.onRegister = nil
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let command = createCommand(id: "interrupted")
        RemiloIOSDelivery.onRegister = { registration in
            let durable = try store.load()
            precondition(durable.reminders[registration.occurrenceID]?.registration?.systemID == registration.systemID)
            precondition(durable.outbox.contains { $0.registration.systemID == registration.systemID })
            store.interruptNextWrite = true
        }
        do {
            _ = try await store.engine().apply(command)
            preconditionFailure("Expected an interrupted write after platform registration")
        } catch FixtureStore.Failure.writeInterrupted {}
        RemiloIOSDelivery.onRegister = nil

        let engine = store.engine()
        let retry = try await engine.apply(command)
        precondition(retry["status"] as? String == "Scheduled")
        precondition(RemiloIOSDelivery.attempts.count == 2)
        precondition(Set(RemiloIOSDelivery.attempts).count == 1)
        let persisted = try store.load()
        precondition(persisted.reminders.count == 1 && persisted.outbox.isEmpty)
        let replay = try await engine.apply(command)
        precondition(retry["occurrenceId"] as? String == replay["occurrenceId"] as? String)
        var changed = command
        changed["title"] = "Different input"
        let rejected = try await engine.apply(changed)
        precondition(rejected["errorCode"] as? String == "OPERATION_REUSED")
    }

    private static func deniedRegistrationRecoversAndStaleDeliveryCannotComplete() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.denied = false
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        RemiloIOSDelivery.denied = true
        let engine = store.engine()
        let command = createCommand(id: "denied")
        let created = try await engine.apply(command)
        precondition(created["status"] as? String == "Blocked")
        let id = created["occurrenceId"] as! String
        let oldGeneration = created["generation"] as! Int
        RemiloIOSDelivery.denied = false
        try await engine.reconcile()
        let recovered = try engine.occurrence(id)
        precondition(recovered?["deliveryState"] as? String == "Scheduled")
        let exact = try await engine.apply(command)
        precondition(exact["status"] as? String == "Blocked")

        let postponed = try await engine.apply([
            "kind": "Postpone", "operationId": "postpone", "occurrenceId": id,
            "expectedGeneration": oldGeneration, "alarmAtMs": iosMillis(Date()) + 7_200_000,
        ])
        precondition(postponed["status"] as? String == "Scheduled")
        let moved = postponed["occurrence"] as! [String: Any]
        precondition(moved["overdueAtMs"] as? Int64 == recovered?["overdueAtMs"] as? Int64)
        precondition(moved["nextAlertMs"] as? Int64 != recovered?["nextAlertMs"] as? Int64)
        precondition(RemiloIOSDelivery.registrations.count == 1)
        try await engine.performSystemAction(kind: "CompleteDelivery", occurrenceID: id, generation: oldGeneration)
        let afterStaleAction = try engine.occurrence(id)
        precondition(afterStaleAction?["completed"] as? Bool == false)

        let current = postponed["generation"] as! Int
        try await engine.performSystemAction(kind: "CompleteDelivery", occurrenceID: id, generation: current)
        try await engine.performSystemAction(kind: "CompleteDelivery", occurrenceID: id, generation: current)
        let completed = try engine.occurrence(id)
        precondition(completed?["completed"] as? Bool == true)
        let history = completed?["history"] as? [[String: Any]] ?? []
        precondition(history.filter { $0["kind"] as? String == "Done" }.count == 1)
        precondition(RemiloIOSDelivery.registrations.isEmpty)
    }

    private static func createCommand(id: String) -> [String: Any] {
        ["kind": "Create", "operationId": id, "title": "Private title", "alarmAtMs": iosMillis(Date()) + 3_600_000]
    }

    private static func recurringPauseAndSplitPreserveIndependentOccurrences() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let start = iosMillis(Date()) + 7_200_000
        let rule: [String: Any] = ["frequency": "daily", "interval": 1, "count": 4, "zoneMode": "pinned"]
        let created = try await engine.apply([
            "kind": "CreateSeries", "operationId": "series", "title": "Daily work", "zoneId": "UTC",
            "eventStartMs": start, "alarmAtMs": start, "recurrence": rule,
        ])
        precondition(created["status"] as? String == "Scheduled")
        let segmentID = created["segmentId"] as! String
        let initialState = try store.load()
        let initial = initialState.reminders.values.sorted { $0.alarmAtMs < $1.alarmAtMs }
        precondition(initial.count == 2 && RemiloIOSDelivery.registrations.count == 2)
        let first = initial[0]
        let second = initial[1]
        let edited = try engine.getSeriesDraft(segmentID, nominal: second.nominalSlot!)
        precondition(edited["remainingCount"] as? Int == 3)

        let postpone = try await engine.apply([
            "kind": "Postpone", "operationId": "postpone-slot", "occurrenceId": first.id,
            "expectedGeneration": first.generation, "alarmAtMs": start + 600_000,
        ])
        precondition(postpone["status"] as? String == "Scheduled" && RemiloIOSDelivery.registrations.count == 3)
        let savedAfterMove = try store.load()
        precondition(savedAfterMove.reminders[first.id]?.nominalSlot == first.nominalSlot)
        precondition(savedAfterMove.reminders[first.id]?.independent == true)

        _ = try await engine.apply([
            "kind": "PauseSeries", "operationId": "pause-family", "segmentId": segmentID, "expectedRevision": 1,
        ])
        precondition(RemiloIOSDelivery.registrations.count == 1)
        precondition(RemiloIOSDelivery.registrations.values.first?.occurrenceID == first.id)

        let split = try await engine.apply([
            "kind": "EditFollowing", "operationId": "split-family", "segmentId": segmentID,
            "expectedRevision": 2, "nominalSlot": second.nominalSlot!, "title": "Changed from slot two",
            "recurrence": ["frequency": "daily", "interval": 1, "count": 3, "zoneMode": "pinned"],
        ])
        let newID = split["segmentId"] as! String
        let splitState = try store.load()
        precondition(splitState.series[newID]?.familyID == segmentID)
        precondition(splitState.series[newID]?.state == "Paused")
        precondition(splitState.series[segmentID]?.rule.endExclusive == second.nominalSlot)
        precondition(splitState.reminders[first.id]?.independent == true && RemiloIOSDelivery.registrations.count == 1)

        _ = try await engine.apply([
            "kind": "ResumeSeries", "operationId": "resume-family", "segmentId": newID, "expectedRevision": 1,
        ])
        precondition(RemiloIOSDelivery.registrations.count == 3)
        let result = try store.load()
        precondition(result.reminders[second.id]?.skipped == true)
        precondition(result.reminders[first.id]?.nominalSlot == first.nominalSlot)
    }

    private static func expiredAcceptedRegistrationIsNotReplayed() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let past = iosMillis(Date()) - 60_000
        var reminder = IOSReminder(
            id: "past", title: "Already scheduled", notes: "", listID: nil, eventStartMs: past,
            eventEndMs: past + 1_800_000, dueAtMs: past, alarmAtMs: past,
            zoneID: "UTC", mode: "Alarm", allDay: false, dueLinked: true, alarmLinked: true
        )
        reminder.deliveryState = "Scheduled"
        reminder.generation = 1
        reminder.nextAlertMs = past
        reminder.registration = IOSReminderRegistration(
            occurrenceID: reminder.id, generation: reminder.generation, systemID: UUID(),
            targetMs: past, mode: "Alarm", language: "en"
        )
        var state = IOSDatabase()
        state.reminders[reminder.id] = reminder
        try store.save(state)

        let engine = store.engine()
        try await engine.reconcile()
        let recovered = try engine.occurrence(reminder.id)
        precondition(recovered?["deliveryState"] as? String == "DeliveryUnconfirmed")
        precondition(recovered?["completed"] as? Bool == false)
        precondition(RemiloIOSDelivery.attempts.isEmpty)
    }

    private static func alarmDismissalLeavesReminderOpen() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let past = iosMillis(Date()) - 1_000
        var record = IOSReminder(
            id: "dismissed", title: "Keep me open", notes: "", listID: nil, eventStartMs: past,
            eventEndMs: past + 60_000, dueAtMs: past, alarmAtMs: past,
            zoneID: "UTC", mode: "Alarm", allDay: false, dueLinked: true, alarmLinked: true
        )
        record.generation = 1
        record.deliveryState = "Alerting"
        var database = IOSDatabase()
        database.reminders[record.id] = record
        try store.save(database)

        let engine = store.engine()
        try await engine.performSystemAction(kind: "DismissDelivery", occurrenceID: record.id, generation: 1)
        try await engine.performSystemAction(kind: "DismissDelivery", occurrenceID: record.id, generation: 1)
        let state = try store.load()
        let dismissed = state.reminders[record.id]
        precondition(dismissed?.completed == false && dismissed?.deliveryState == "Stopped")
        precondition(dismissed?.history.map(\.kind) == ["Stop"])
    }

    private static func routineEditsRetainProgressAndTrashRestoresFamily() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let today = RemiloIOSRoutineAuthoring.localDate(Date(), in: .current)
        func days(_ firstName: String) -> [[String: Any]] {
            (0..<7).map { day in
                let steps = [
                    ["id": "first-\(day)", "name": firstName, "notes": "", "target": ""],
                    ["id": "second-\(day)", "name": "Second step", "notes": "", "target": ""],
                ]
                return ["type": "Exercises", "exercises": steps]
            }
        }
        let draft: [String: Any] = ["title": "Offline plan", "mode": "None", "minutes": 720, "days": days("First step")]
        let created = try await engine.apply(draft.merging([
            "kind": "CreateRoutine", "startsOn": today, "operationId": "create-routine",
        ]) { _, new in new })
        let plan = created["routine"] as! [String: Any]
        let routineID = plan["id"] as! String
        let session = try await engine.getRoutineSession(routineID, date: today)!
        let occurrenceID = session["occurrenceId"] as! String
        let stepID = (session["steps"] as! [[String: Any]])[0]["id"] as! String
        let command: [String: Any] = [
            "kind": "SetRoutineExercise", "operationId": "check-step", "occurrenceId": occurrenceID, "date": today,
            "expectedRevision": 0, "stepId": stepID, "completed": true,
        ]
        let checked = try await engine.apply(command)
        precondition((checked["routineSession"] as? [String: Any])?["completedCount"] as? Int == 1)
        _ = try await engine.apply(draft.merging([
            "kind": "EditRoutine", "routineId": routineID, "operationId": "edit-routine", "expectedRevision": 1,
            "days": days("Updated first step"),
        ]) { _, new in new })
        let edited = try await store.engine().getRoutineSession(routineID, date: today)!
        precondition(edited["occurrenceId"] as? String == occurrenceID)
        precondition(edited["completedCount"] as? Int == 1)
        precondition((edited["steps"] as? [[String: Any]])?.first?["name"] as? String == "Updated first step")
        let ordinary = try await engine.apply([
            "kind": "Done", "occurrenceId": occurrenceID, "expectedRevision": 1, "operationId": "ordinary-done",
        ])
        precondition(ordinary["errorCode"] as? String == "NOT_ELIGIBLE")
        _ = try await engine.apply([
            "kind": "TrashRoutine", "routineId": routineID, "expectedRevision": 2, "operationId": "trash-routine",
        ])
        let trash = try engine.query(["view": "deleted"], cursor: nil)["items"] as! [[String: Any]]
        precondition(trash.count == 1 && trash.first?["routineFamily"] != nil)
        _ = try await engine.apply([
            "kind": "RestoreRoutine", "routineId": routineID, "expectedRevision": 3, "operationId": "restore-routine",
        ])
        let restored = try await store.engine().getRoutineSession(routineID, date: today)
        precondition(restored?["completedCount"] as? Int == 1)
    }

    private static func routineAlarmActionsKeepDatedProgress() throws {
        let date = "2026-07-20"
        let zone = TimeZone(secondsFromGMT: 0)!
        let start = try RemiloIOSRoutineAuthoring.time(date, minutes: 0, in: zone)
        let close = try RemiloIOSRoutineAuthoring.closeAt(date, in: zone)
        let prompt = close - 30 * 60_000
        let now = close - 20 * 60_000
        let registration = IOSReminderRegistration(
            occurrenceID: "day", generation: 3, systemID: UUID(), targetMs: prompt,
            mode: "Alarm", language: "en", isRoutine: true
        )
        var reminder = IOSReminder(
            id: "day", title: "Routine", notes: "", listID: nil, eventStartMs: start, eventEndMs: close,
            dueAtMs: prompt, alarmAtMs: prompt, zoneID: zone.identifier, mode: "Alarm", allDay: true,
            dueLinked: false, alarmLinked: false, routineID: "plan", nominalSlot: date
        )
        reminder.generation = 3
        reminder.registration = registration
        reminder.deliveryState = "Alerting"
        reminder.nextAlertMs = prompt
        let steps = ["first", "second"].map {
            IOSRoutineStep(id: $0, name: $0, target: "", notes: "", illustration: nil,
                           customImageId: nil, sharedStepId: nil, exerciseTarget: nil)
        }
        var seed = IOSDatabase()
        seed.reminders[reminder.id] = reminder
        seed.routines["plan"] = IOSRoutinePlan(id: "plan", startsOn: date, versions: [])
        seed.routineSessions[reminder.id] = IOSRoutineSession(
            routineID: "plan", occurrenceID: reminder.id, date: date, versionRevision: 1, steps: steps,
            revision: 2, done: ["first"], started: true
        )
        let engine = RemiloIOSEngine(loadDatabase: { seed })
        let capture = try engine.captureRoutineAlarm(occurrenceID: reminder.id, generation: 3,
                                                     registrationID: registration.systemID, now: now, zone: zone)
        precondition(capture.date == date && capture.snoozeMinutes == 10 && capture.closesAtMs == close)
        let input: [String: Any] = [
            "occurrenceId": reminder.id, "expectedGeneration": 3, "expectedSessionId": capture.registrationID.uuidString,
            "date": date, "expectedSnoozeMinutes": 10,
        ]
        func rejects(_ code: String, at time: Int64? = nil, changed: [String: Any] = [:]) throws {
            var state = seed
            do {
                _ = try engine.mutateRoutineAlarm("SnoozeRoutineAlarm", input: IOSInput(values: input.merging(changed) { _, new in new }),
                                                  state: &state, now: time ?? now, zone: zone)
                preconditionFailure("Expected \(code)")
            } catch let failure as IOSInputFailure {
                precondition(failure.code == code)
                precondition(state.reminders[reminder.id]?.registration?.systemID == capture.registrationID)
                precondition(state.outbox.isEmpty)
            }
        }
        try rejects("STALE_GENERATION", changed: ["expectedSessionId": UUID().uuidString])
        try rejects("STALE_GENERATION", changed: ["expectedGeneration": 2])
        try rejects("STALE_SNOOZE", changed: ["expectedSnoozeMinutes": 15])
        try rejects("DAY_ENDED", changed: ["date": "2026-07-19"])
        try rejects("DAY_ENDED", at: close - 10 * 60_000)
        try rejects("DAY_ENDED", at: close)

        var snoozed = seed
        let moved = try engine.mutateRoutineAlarm("SnoozeRoutineAlarm", input: IOSInput(values: input),
                                                  state: &snoozed, now: now, zone: zone)
        precondition(moved.nextAlertMs == now + 10 * 60_000 && moved.generation == 4 && moved.alarmAtMs == prompt)
        precondition(snoozed.outbox.map(\.action) == [.cancel, .register])
        precondition(snoozed.routineSessions[reminder.id]?.done == Set(["first"]) && !moved.completed)

        var dismissed = seed
        let stopped = try engine.mutateRoutineAlarm("DismissRoutineAlarm", input: IOSInput(values: input),
                                                    state: &dismissed, now: now, zone: zone)
        precondition(stopped.registration == nil && stopped.deliveryState == "Stopped" && !stopped.completed)
        precondition(dismissed.routineSessions[reminder.id]?.done == Set(["first"]))
        precondition(dismissed.routineSessions[reminder.id]?.revision == 2)
    }

    private static func preparedImportCommitsOnceAndReplaysAfterStageRemoval() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let future = iosMillis(Date()) + 3_600_000
        let reminder = IOSReminder(
            id: "imported", title: "Imported reminder", notes: "", listID: nil, eventStartMs: future,
            eventEndMs: future + 60_000, dueAtMs: future, alarmAtMs: future,
            zoneID: "UTC", mode: "Alarm", allDay: false, dueLinked: true, alarmLinked: true
        )
        let bundle = RemiloIOSPortableContent.Bundle(reminders: [reminder.id: reminder])
        let result = try await engine.applyImport(handle: "prepared", copies: [], operationID: "restore-once") {
            IOSPreparedImport(content: bundle)
        }
        precondition(result["added"] as? Int == 1 && result["blocked"] as? Int == 0)
        let stored = try store.load()
        precondition(stored.reminders[reminder.id]?.registration == nil)

        let recovered = try await store.engine().applyImport(handle: "prepared", copies: [], operationID: "restore-once") {
            preconditionFailure("An exact retry can recover after the original stage was released")
        }
        precondition(recovered["added"] as? Int == 1)
        let persisted = try store.load()
        precondition(persisted.reminders.count == 1)
    }

    private static func pausedRoutineDoesNotCreateHistoryForUnopenedDates() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let today = RemiloIOSRoutineAuthoring.localDate(Date(), in: .current)
        let days: [[String: Any]] = (0..<7).map {
            ["type": "Exercises", "exercises": [["id": "step-\($0)", "name": "Read", "target": "", "notes": ""]]]
        }
        let created = try await engine.apply([
            "kind": "CreateRoutine", "operationId": "daily-routine", "title": "Read", "mode": "None",
            "startsOn": today, "minutes": 720, "days": days,
        ])
        let id = (created["routine"] as! [String: Any])["id"] as! String
        var unattended = try store.load()
        let missedDay = try RemiloIOSRoutineAuthoring.date(today, plusDays: 3)
        let followingWeek = try RemiloIOSRoutineAuthoring.time(
            RemiloIOSRoutineAuthoring.date(today, plusDays: 6), minutes: 720, in: .current
        )
        _ = try engine.replenishRoutines(state: &unattended, now: followingWeek)
        let missedID = RemiloIOSSeries.occurrenceID(id, missedDay)
        precondition(unattended.routineSessions[missedID]?.ended == true)
        precondition(unattended.reminders[missedID]?.registration == nil)

        _ = try await engine.apply([
            "kind": "PauseRoutine", "operationId": "pause-daily-routine", "routineId": id, "expectedRevision": 1,
        ])
        var state = try store.load()
        let skipped = try RemiloIOSRoutineAuthoring.date(today, plusDays: 1)
        let now = try RemiloIOSRoutineAuthoring.time(
            RemiloIOSRoutineAuthoring.date(today, plusDays: 2), minutes: 720, in: .current
        )
        _ = try engine.replenishRoutines(state: &state, now: now)
        precondition(state.routineSessions[RemiloIOSSeries.occurrenceID(id, skipped)] == nil)
        precondition(state.routineSessions[RemiloIOSSeries.occurrenceID(id, today)]?.ended == true)
    }

    private static func groupCompletionDoesNotTouchLaterArrivals() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.alerting = []
        }
        let past = iosMillis(Date()) - 1_000
        var state = IOSDatabase()
        for id in ["one", "two", "later"] {
            var record = IOSReminder(
                id: id, title: id, notes: "", listID: nil, eventStartMs: past,
                eventEndMs: past + 60_000, dueAtMs: past, alarmAtMs: past,
                zoneID: "UTC", mode: "Alarm", allDay: false, dueLinked: true, alarmLinked: true
            )
            record.generation = 1
            record.deliveryState = "Alerting"
            let registration = IOSReminderRegistration(
                occurrenceID: id, generation: 1, systemID: UUID(), targetMs: past, mode: "Alarm", language: "en"
            )
            record.registration = registration
            RemiloIOSDelivery.registrations[registration.systemID] = registration
            if id != "later" { RemiloIOSDelivery.alerting.insert(registration.systemID) }
            state.reminders[id] = record
        }
        try store.save(state)
        let engine = store.engine()
        let captured = try await engine.activeDeliveryGroup()!
        RemiloIOSDelivery.alerting.insert(state.reminders["later"]!.registration!.systemID)
        let second = state.reminders["two"]!.registration!.systemID
        let command: [String: Any] = [
            "kind": "DoneAll", "operationId": "complete-captured",
            "expectedSessionId": captured["sessionId"]!, "members": captured["members"]!,
        ]
        RemiloIOSDelivery.alerting.remove(second)
        let stale = try await engine.apply(command)
        precondition(stale["errorCode"] as? String == "STALE_MEMBERS")
        let afterStale = try store.load()
        precondition(afterStale.reminders["one"]?.completed == false)
        RemiloIOSDelivery.alerting.insert(second)
        let result = try await engine.apply(command)
        let updated = try store.load()
        precondition(result["count"] as? Int == 2)
        precondition(updated.reminders["one"]?.completed == true && updated.reminders["two"]?.completed == true)
        precondition(updated.reminders["later"]?.completed == false && RemiloIOSDelivery.registrations.count == 1)
    }
}
