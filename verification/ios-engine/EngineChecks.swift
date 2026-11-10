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
    var deferredSeriesOverride: Bool? = nil
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
    static var onCancel: ((IOSReminderRegistration) throws -> Void)?
    static var denied = false

    static func register(_ registration: IOSReminderRegistration) async throws {
        attempts.append(registration.systemID)
        try onRegister?(registration)
        if denied { throw IOSDeliveryFailure.denied }
        registrations[registration.systemID] = registration
    }

    static func cancel(_ registration: IOSReminderRegistration) async throws {
        try onCancel?(registration)
        registrations.removeValue(forKey: registration.systemID)
    }

    static func isAlarmAlerting(_ id: UUID) throws -> Bool { alerting.contains(id) }

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
        try await datedRoutineTrashPreservesProgressAndPurgeSurvivesRestore()
        try routineAlarmActionsKeepDatedProgress()
        try await calendarCreateUsesExactLocalReceiptAndBounds()
        try await calendarExportIntentSurvivesInterruptedAcknowledgement()
        try calendarInstallationOriginComesFromNativeStateCreation()
        try await calendarSeriesExceptionsAreAtomicAndBounded()
        try await calendarSeriesTextPreservesDelivery()
        try await calendarSeriesSchedulePreservesLocalState()
        try await calendarSeriesInstancePreservesOriginalSlot()
        try await calendarSeriesAllowsAFutureMoveAfterItsLastOriginal()
        try await queuedCalendarCreateChecksAuthorityBeforeWriting()
        try await queuedCalendarReviewRechecksLocalVersion()
        try await calendarLifecycleTracksTerminalRoundTrips()
        try await calendarInboundPreservesDeliveryAndFencesRinging()
        try await calendarInboundReplaysInterruptedDelivery()
        try calendarInboundProjectsIndependentAndAllDayTiming()
        try await pausedRoutineDoesNotCreateHistoryForUnopenedDates()
        try await groupCompletionDoesNotTouchLaterArrivals()
        try await preparedImportCommitsOnceAndReplaysAfterStageRemoval()
        try await purgedOneOffRequiresExplicitBackupCopyAfterRestart()
        try await materializationRespectsOccupiedAndPurgedOccurrenceIDs()
        #if REMILO_WIDGET_FIXTURE
        try await WidgetProjectionChecks.run()
        #endif
        print("Remilo iOS native engine checks passed")
    }

    private static func calendarInstallationOriginComesFromNativeStateCreation() throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-install-\(UUID()).json")
        defer { try? FileManager.default.removeItem(at: path) }
        let fresh = try IOSStore.read(at: path)
        precondition(fresh.isFreshCalendarInstallation)
        try JSONEncoder().encode(fresh).write(to: path)
        let reopened = try IOSStore.read(at: path)
        precondition(reopened.isFreshCalendarInstallation)
        try JSONEncoder().encode(IOSDatabase()).write(to: path)
        let oldEmptyInstall = try IOSStore.read(at: path)
        precondition(oldEmptyInstall.reminders.isEmpty && !oldEmptyInstall.isFreshCalendarInstallation,
                     "An empty preexisting state file is an upgrade, not a fresh install")
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
        let originalRegistration = try store.load().reminders[id]!.registration!
        let currentHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: oldGeneration, registrationID: originalRegistration.systemID,
            now: originalRegistration.targetMs
        )
        let legacyHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: oldGeneration, registrationID: nil, now: originalRegistration.targetMs
        )
        let prematureHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: oldGeneration, registrationID: originalRegistration.systemID,
            now: originalRegistration.targetMs - 1
        )
        let mismatchedHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: oldGeneration, registrationID: UUID(), now: originalRegistration.targetMs
        )
        precondition(currentHandoff && legacyHandoff && !prematureHandoff && !mismatchedHandoff)
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
        let replacement = try store.load().reminders[id]!.registration!
        let staleHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: oldGeneration, registrationID: nil, now: replacement.targetMs
        )
        let replacementHandoff = try engine.canOpenAlarmReminderActions(
            occurrenceID: id, generation: replacement.generation, registrationID: replacement.systemID,
            now: replacement.targetMs
        )
        precondition(!staleHandoff && replacementHandoff)
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

    private static func calendarExportIntentSurvivesInterruptedAcknowledgement() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.onRegister = nil
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let initial = store.engine()
        let old = try await initial.apply(createCommand(id: "calendar-export-before-setup"))
        let oldID = old["occurrenceId"] as! String
        let scope = IOSCalendarExportIntent.Scope(setupID: UUID(), bindingRevision: 3, authEpoch: 2, accountGeneration: 1)
        var excluded = createCommand(id: "calendar-export-local-only")
        excluded["calendarDisposition"] = "LocalOnly"
        let local = try await initial.apply(excluded, managedExportScope: { _ in
            preconditionFailure("Local only must not consult or capture a managed binding")
        })
        let localID = local["occurrenceId"] as! String

        let command = createCommand(id: "calendar-export-managed")
        RemiloIOSDelivery.onRegister = { _ in store.interruptNextWrite = true }
        do {
            _ = try await initial.apply(command, managedExportScope: { _ in scope })
            preconditionFailure("Expected a write interruption after the reminder and intent commit")
        } catch FixtureStore.Failure.writeInterrupted {}
        RemiloIOSDelivery.onRegister = nil
        let committed = try store.load()
        guard let exported = committed.reminders.values.first(where: { $0.calendarExportIntent?.scope == scope }),
              let captured = exported.calendarExportIntent else { preconditionFailure("No intent on the committed reminder") }
        precondition(committed.reminders[oldID]?.calendarExportIntent == nil &&
                     committed.reminders[localID]?.calendarExportIntent == nil)
        let backup = try RemiloIOSPortableContent.encode(committed, now: iosMillis(Date()))
        let restored = try RemiloIOSPortableContent.decode(backup, availableImageIDs: [])
        precondition(restored.reminders[exported.id] != nil &&
                     restored.reminders.values.allSatisfy { $0.calendarExportIntent == nil })
        let restarted = store.engine()
        let result = try await restarted.apply(command, managedExportScope: { _ in
            preconditionFailure("A durable create receipt must never acquire a new export binding")
        })
        precondition(result["occurrenceId"] as? String == exported.id)
        let afterReplay = try store.load()
        precondition(afterReplay.reminders.count == 3 && afterReplay.reminders[exported.id]?.calendarExportIntent == captured)

        func apply(_ kind: String) async throws {
            let current = try store.load().reminders[exported.id]!
            _ = try await restarted.apply([
                "kind": kind, "operationId": "calendar-export-" + kind, "occurrenceId": exported.id,
                "expectedRevision": current.revision,
            ])
        }
        try await apply("Delete")
        try await apply("UndoDelete")
        let afterRestore = try store.load()
        precondition(afterRestore.reminders[exported.id]?.active == true &&
                     afterRestore.reminders[exported.id]?.calendarExportIntent == nil,
                     "Restoring local work must not restart a retired publication")
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
        record.calendarLifecycleRevision = record.revision
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
        precondition(dismissed?.calendarLifecycleRevision == record.revision)
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

    private static func datedRoutineTrashPreservesProgressAndPurgeSurvivesRestore() async throws {
        let store = FixtureStore()
        let receiver = FixtureStore()
        defer { store.remove(); receiver.remove() }
        let engine = store.engine()
        let zone = TimeZone.current
        let today = RemiloIOSRoutineAuthoring.localDate(Date(), in: zone)
        let tomorrow = try RemiloIOSRoutineAuthoring.date(today, plusDays: 1)
        let created = try await engine.apply(routineDraft().merging([
            "kind": "CreateRoutine", "startsOn": today, "operationId": "create-for-dated-trash",
        ]) { _, new in new })
        let routineID = (created["routine"] as! [String: Any])["id"] as! String
        let id = RemiloIOSSeries.occurrenceID(routineID, today)
        let nextID = RemiloIOSSeries.occurrenceID(routineID, tomorrow)

        func content(_ kind: String, revision: Int? = nil) async throws -> [String: Any] {
            let state = try store.load()
            return try await engine.apply([
                "kind": kind, "operationId": UUID().uuidString, "occurrenceId": id,
                "expectedRevision": revision ?? state.reminders[id]!.revision,
            ])
        }
        func progress(_ kind: String) async throws -> [String: Any] {
            let saved = try store.load().routineSessions[id]!
            return try await engine.apply([
                "kind": kind, "operationId": UUID().uuidString, "occurrenceId": id, "date": today,
                "expectedRevision": saved.revision, "stepId": saved.steps[0].id, "completed": true,
            ])
        }
        let skipped = try await progress("SkipRoutineDay")
        precondition(skipped["status"] as? String == "Applied")
        let captured = try store.load().routineSessions[id]!.revision
        let stale = try await content("Delete", revision: 0)
        precondition(stale["errorCode"] as? String == "STALE_REVISION")
        let trashSkipped = try await content("Delete")
        precondition(trashSkipped["status"] as? String == "Applied")
        let restoreSkipped = try await content("UndoDelete")
        precondition(restoreSkipped["status"] as? String == "Applied")
        let skipRestored = try store.load()
        precondition(skipRestored.reminders[id]?.skipped == true && skipRestored.reminders[id]?.registration == nil)
        let oldDayAction = try await engine.apply([
            "kind": "UndoSkipRoutineDay", "operationId": "old-day-action", "occurrenceId": id, "date": today,
            "expectedRevision": captured,
        ])
        precondition(oldDayAction["errorCode"] as? String == "STALE_REVISION")

        _ = try await progress("UndoSkipRoutineDay")
        _ = try await progress("SetRoutineExercise")
        let completed = try store.load()
        let steps = completed.routineSessions[id]!.done
        precondition(completed.reminders[id]?.completed == true && steps.count == 1 && completed.reminders[nextID] != nil)
        let trashDone = try await content("Delete")
        precondition(trashDone["status"] as? String == "Applied")
        let trashRows = try engine.query(["view": "deleted"], cursor: nil)["items"] as! [[String: Any]]
        precondition(trashRows.count == 1 && trashRows[0]["id"] as? String == id && trashRows[0]["routineFamily"] == nil)
        let restoreDone = try await content("UndoDelete")
        precondition(restoreDone["status"] as? String == "Applied")
        let doneRestored = try store.load()
        precondition(doneRestored.routineSessions[id]?.done == steps && doneRestored.reminders[id]?.completed == true)
        precondition(doneRestored.reminders[id]?.registration == nil && doneRestored.routines[routineID]?.state == "Active")

        _ = try await content("Delete")
        let now = iosMillis(Date())
        let inTrash = try store.load()
        let oldBackup = try RemiloIOSPortableContent.encode(inTrash, now: now)
        let olderBundle = try RemiloIOSPortableContent.decode(oldBackup)
        let originalSlot = olderBundle.routines[routineID]!.portableSlots![today]!
        let wireID = RemiloIOSSeries.occurrenceID(originalSlot.segmentID, originalSlot.nominalSlot)
        let purged = try await content("Purge")
        precondition(purged["status"] as? String == "Applied")
        let restarted = store.engine()
        try await restarted.reconcile()
        let persisted = try store.load()
        precondition(persisted.reminders[id] == nil && persisted.routineSessions[id] == nil && persisted.isPurgedOccurrence(id))
        precondition(persisted.routineSessions[nextID]?.date == tomorrow && persisted.routines[routineID]?.state == "Active")
        let missing = try await restarted.getRoutineSession(routineID, date: today)
        precondition(missing == nil)
        let newerBundle = try RemiloIOSPortableContent.decode(RemiloIOSPortableContent.encode(persisted, now: now))
        precondition(newerBundle.routines[routineID]?.portableExclusions?[wireID]?.nominalSlot == originalSlot.nominalSlot)
        precondition(newerBundle.routineSessions[id] == nil && newerBundle.routineSessions[nextID] != nil)
        var nextDay = persisted
        let nextDayTime = try RemiloIOSRoutineAuthoring.closeAt(today, in: zone) + 60_000
        _ = try restarted.replenishRoutines(state: &nextDay, now: nextDayTime)
        precondition(nextDay.routines[routineID]?.historyThrough == today && nextDay.routineSessions[id] == nil)

        let incoming = receiver.engine()
        _ = try await incoming.applyImport(handle: "older-routine", copies: [], operationID: "restore-routine-before-purge") {
            IOSPreparedImport(content: olderBundle)
        }
        let imported = try receiver.load()
        precondition(imported.reminders[id]?.deleted == true)
        let purgedImported = try await incoming.apply([
            "kind": "Purge", "operationId": "purge-imported-date", "occurrenceId": id,
            "expectedRevision": imported.reminders[id]!.revision,
        ])
        precondition(purgedImported["status"] as? String == "Applied")
        let roundTrip = try RemiloIOSPortableContent.decode(RemiloIOSPortableContent.encode(receiver.load(), now: now))
        precondition(roundTrip.routines[routineID]?.portableExclusions?[wireID]?.segmentID == originalSlot.segmentID)
        precondition(roundTrip.routineSessions[id] == nil && roundTrip.routineSessions[nextID] != nil)
        receiver.remove()
        let fresh = receiver.engine()
        _ = try await fresh.applyImport(handle: "routine-after-purge", copies: [], operationID: "restore-routine-exclusion") {
            IOSPreparedImport(content: roundTrip)
        }
        let restoredMissing = try await fresh.getRoutineSession(routineID, date: today)
        precondition(restoredMissing == nil)
    }

    private static func routineDraft() -> [String: Any] {
        let days: [[String: Any]] = (0..<7).map { day in
            ["type": "Exercises", "exercises": [["id": "step-\(day)", "name": "Read", "target": "", "notes": ""]]]
        }
        return ["title": "Dated routine", "mode": "None", "minutes": 720, "days": days]
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

    private static func calendarCreateUsesExactLocalReceiptAndBounds() async throws {
        let store = FixtureStore()
        RemiloIOSDelivery.registrations = [:]
        RemiloIOSDelivery.attempts = []
        defer {
            store.remove()
            RemiloIOSDelivery.onRegister = nil
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let operation = "ios-calendar-import:" + UUID().uuidString.lowercased()
        let draft = createCommand(id: operation)
        let untrusted = try await engine.apply(draft)
        precondition(untrusted["errorCode"] as? String == "UNSUPPORTED")
        let testAlarm = try await engine.scheduleTestAlarm(operationId: operation)
        precondition(testAlarm["errorCode"] as? String == "UNSUPPORTED")
        do {
            _ = try await engine.applyImport(handle: "fixture", copies: [], operationID: operation) {
                preconditionFailure("Portable import must reject the Calendar operation namespace before loading the archive")
            }
            preconditionFailure("Expected the reserved Calendar operation namespace to be rejected")
        } catch let failure as IOSInputFailure {
            precondition(failure.code == "UNSUPPORTED")
        }
        let stale = try await engine.applyCalendarCreate(draft, authorize: { false })
        precondition(stale["errorCode"] as? String == "STALE_CONNECTION")
        let uncommitted = try engine.calendarCreateReceipt(draft)
        precondition(uncommitted == nil)
        RemiloIOSDelivery.onRegister = { _ in store.interruptNextWrite = true }
        do {
            _ = try await engine.applyCalendarCreate(draft, authorize: { true })
            preconditionFailure("Expected scheduler acknowledgement write interruption")
        } catch FixtureStore.Failure.writeInterrupted {}
        RemiloIOSDelivery.onRegister = nil
        let restarted = store.engine()
        let recovered = try await restarted.applyCalendarCreate(draft) {
            preconditionFailure("A durable local create receipt must not reauthorize")
        }
        precondition(recovered["status"] as? String == "Pending" && recovered["eligibleForLink"] as? Bool == true)
        let persisted = try store.load()
        precondition(persisted.reminders.count == 1 && RemiloIOSDelivery.attempts.count == 1)
        let importedID = recovered["localId"] as! String
        let imported = try restarted.calendarOneTimeSnapshot(importedID, for: .manualLink)
        precondition(imported.title == "Private title" && imported.occurrenceID == importedID)
        let linkPermit = try await restarted.withCalendarOneTimePermit(for: imported, purpose: .manualLink) { true }
        precondition(linkPermit)
        do {
            _ = try restarted.calendarPublicationSnapshot(importedID)
            preconditionFailure("A committed Calendar import must stay ineligible while its journal receipt is pending")
        } catch IOSCalendarOneTimeSnapshot.Failure.alreadyImported {}
        do {
            let _: Bool = try await restarted.withCalendarPublicationPermit(for: imported) {
                preconditionFailure("A manual link snapshot cannot authorize publication of imported work")
            }
            preconditionFailure("Expected imported publication to remain ineligible at the send checkpoint")
        } catch IOSCalendarOneTimeSnapshot.Failure.stalePreview {}

        let format = ISO8601DateFormatter()
        let first = iosMillis(format.date(from: "2037-01-04T09:00:00Z")!)
        let anchor = "2037-01-04T09:00"
        let bound = "2037-01-05T08:30:00.001"
        let series: [String: Any] = [
            "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString.lowercased(),
            "title": "Calendar family", "mode": "None", "zoneId": "UTC",
            "eventStartMs": first, "eventEndMs": first + 1_800_000, "dueAtMs": first, "alarmAtMs": first,
            "recurrence": ["frequency": "daily", "interval": 1, "zoneMode": "pinned", "until": "2037-01-05"],
            "nativeCalendarAnchor": anchor, "nativeCalendarEndExclusive": bound,
        ]
        var foreign = series
        foreign["operationId"] = UUID().uuidString
        let blocked = try await restarted.apply(foreign)
        precondition(blocked["errorCode"] as? String == "UNSUPPORTED")
        let created = try await restarted.applyCalendarCreate(series, authorize: { true })
        precondition(created["localKind"] as? String == "series" && created["eligibleForLink"] as? Bool == true)
        let stored = try store.load()
        let rule = stored.series[created["localId"] as! String]!.rule
        precondition(rule.zoneID == TimeZone(identifier: "UTC")?.identifier && rule.anchor == anchor && rule.endExclusive == bound)
        let slots = try RemiloIOSRecurrence.future(rule, afterMs: first - 1, deviceZone: .current, mode: "None", limit: 2)
        precondition(slots.count == 1 && slots[0].eventStartMs == first)

        // São Paulo advanced from midnight to 01:00 on this civil date.
        let gapStart = iosMillis(format.date(from: "2018-11-04T03:00:00Z")!)
        let nextMidnight = iosMillis(format.date(from: "2018-11-05T02:00:00Z")!)
        let gapAlert = iosMillis(format.date(from: "2018-11-04T11:00:00Z")!)
        let allDay: [String: Any] = [
            "kind": "Create", "operationId": "ios-calendar-import:" + UUID().uuidString.lowercased(),
            "title": "Calendar all-day", "mode": "None", "zoneId": "America/Sao_Paulo", "allDay": true,
            "eventStartMs": gapStart, "eventEndMs": nextMidnight, "dueAtMs": nextMidnight, "alarmAtMs": gapAlert,
        ]
        let allDayResult = try await restarted.applyCalendarCreate(allDay, authorize: { true })
        let allDayState = try store.load()
        let allDayRecord = allDayState.reminders[allDayResult["localId"] as! String]!
        precondition(allDayRecord.eventStartMs == gapStart && allDayRecord.eventEndMs == nextMidnight)
        let allDayRule = try RemiloIOSSeries.rule(for: allDayRecord, spec: ["frequency": "daily", "zoneMode": "pinned"],
                                                calendarBounds: ("2018-11-04T00:00", nil))
        let gapSlots = try RemiloIOSRecurrence.future(allDayRule, afterMs: gapStart - 1, deviceZone: .current, limit: 2)
        precondition(gapSlots.count == 2 && gapSlots[0].alarmAtMs == gapAlert && gapSlots[1].alarmAtMs == nextMidnight + 9 * 3_600_000)
    }

    private static func calendarSeriesExceptionsAreAtomicAndBounded() async throws {
        let store = FixtureStore()
        let restoredStore = FixtureStore()
        defer {
            store.remove()
            restoredStore.remove()
            RemiloIOSDelivery.onRegister = nil
            RemiloIOSDelivery.onCancel = nil
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let zone = TimeZone(identifier: "UTC")!
        let now = iosMillis(Date())
        let start = now / 60_000 * 60_000 + 7_200_000
        let day: Int64 = 86_400_000
        let anchor = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(start, zone: zone))
        var originals = [anchor]
        var exceptions: [[String: Any]] = [["kind": "Skip", "nominalSlot": anchor]]
        for index in 1...10 {
            let original = start + Int64(index) * day
            let nominal = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(original, zone: zone))
            originals.append(nominal)
            let actual = original + (index == 10 ? -10 * day + 3_600_000 : 3_600_000)
            exceptions.append(calendarOverride(nominal: nominal, actual: actual, title: "Moved \(index)"))
        }
        let historicalOriginal = start + 11 * day
        let historicalNominal = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(historicalOriginal, zone: zone))
        let historicalActual = start - 5 * 3_600_000
        originals.append(historicalNominal)
        exceptions.append(calendarOverride(nominal: historicalNominal, actual: historicalActual,
                                           title: "Historical move", alertEligible: false))
        let operationID = "ios-calendar-import:" + UUID().uuidString.lowercased()
        let series: [String: Any] = [
            "kind": "CreateSeries", "operationId": operationID, "title": "Calendar series",
            "mode": "Alarm", "sound": "system", "zoneId": "UTC", "eventStartMs": start, "eventEndMs": start + 1_800_000,
            "dueAtMs": start, "alarmAtMs": start, "nativeCalendarAnchor": anchor,
            "recurrence": ["frequency": "daily", "count": 15, "zoneMode": "pinned"],
            "nativeCalendarExceptions": exceptions,
        ]
        var publicSeries = series
        publicSeries["operationId"] = "fixture-public-series"
        publicSeries.removeValue(forKey: "nativeCalendarAnchor")
        let publicResult = try await engine.apply(publicSeries)
        precondition(publicResult["errorCode"] as? String == "UNSUPPORTED")
        var oneOff = createCommand(id: operationID)
        oneOff["nativeCalendarExceptions"] = exceptions
        let oneOffResult = try await engine.applyCalendarCreate(oneOff, authorize: { true })
        precondition(oneOffResult["errorCode"] as? String == "UNSUPPORTED")
        var duplicate = series
        duplicate["nativeCalendarExceptions"] = exceptions + [exceptions[0]]
        let duplicateResult = try await engine.applyCalendarCreate(duplicate, authorize: { true })
        precondition(duplicateResult["errorCode"] as? String == "INVALID_INPUT")
        var expired = series
        var expiredRows = exceptions
        expiredRows[1]["alarmAtMs"] = now - 1
        expired["nativeCalendarExceptions"] = expiredRows
        let expiredResult = try await engine.applyCalendarCreate(expired, authorize: { true })
        precondition(expiredResult["errorCode"] as? String == "ALERT_EXPIRED")
        var ineligible = series
        var ineligibleRows = exceptions
        ineligibleRows[1]["alertEligible"] = false
        ineligible["nativeCalendarExceptions"] = ineligibleRows
        let ineligibleResult = try await engine.applyCalendarCreate(ineligible, authorize: { true })
        precondition(ineligibleResult["errorCode"] as? String == "INVALID_INPUT")
        let stale = try await engine.applyCalendarCreate(series, authorize: { false })
        precondition(stale["errorCode"] as? String == "STALE_CONNECTION")
        let rejected = try store.load()
        precondition(rejected.series.isEmpty && rejected.reminders.isEmpty && rejected.receipts.isEmpty
                     && RemiloIOSDelivery.attempts.isEmpty)

        RemiloIOSDelivery.onRegister = { _ in
            let durable = try store.load()
            let id = durable.receipts[operationID]!.seriesSegmentID!
            let captured = originals.map { durable.reminders[RemiloIOSSeries.occurrenceID(id, $0)] }
            precondition(captured.allSatisfy { $0?.independent == true } && captured[0]?.skipped == true)
        }
        let result = try await engine.applyCalendarCreate(series, authorize: { true })
        RemiloIOSDelivery.onRegister = nil
        precondition(result["status"] as? String == "Scheduled" && result["localKind"] as? String == "series")
        let segmentID = result["localId"] as! String
        let ids = originals.map { RemiloIOSSeries.occurrenceID(segmentID, $0) }
        let committed = try store.load()
        precondition(committed.reminders[ids[0]]?.deliveryState == "Skipped" && committed.reminders[ids[0]]?.registration == nil)
        let moved = committed.reminders[ids[10]]!
        precondition(moved.nominalSlot == originals[10] && moved.eventStartMs == start + 3_600_000)
        precondition(moved.title == "Moved 10" && moved.notes == "Authored exception" && moved.sound == "system")
        precondition(moved.registration?.targetMs == moved.alarmAtMs && RemiloIOSDelivery.registrations.count == 10)
        let historical = committed.reminders[ids[11]]!
        precondition(historical.eventStartMs == historicalActual && historical.nominalSlot == historicalNominal)
        precondition(historical.deliveryState == "Missed" && historical.nextAlertMs == nil && historical.registration == nil)
        let dormant = committed.reminders[ids[8]]!
        precondition(dormant.deliveryState == "Pending" && dormant.nextAlertMs == dormant.alarmAtMs && dormant.registration == nil)
        var recoveredState = committed
        _ = try engine.replenishSeries(state: &recoveredState, now: dormant.alarmAtMs + 1)
        precondition(recoveredState.reminders[dormant.id]?.deliveryState == "Missed")
        precondition(recoveredState.reminders[ids[9]]?.registration?.targetMs == committed.reminders[ids[9]]?.alarmAtMs)
        precondition(recoveredState.reminders[historical.id]?.eventStartMs == historicalActual
                     && recoveredState.reminders[historical.id]?.registration == nil)

        let restarted = store.engine()
        let recovered = try await restarted.applyCalendarCreate(series) {
            preconditionFailure("The durable series receipt must not reauthorize")
        }
        precondition(recovered["localId"] as? String == segmentID && RemiloIOSDelivery.attempts.count == 10)
        let changed = try await restarted.applyCalendarCreate(duplicate, authorize: { true })
        precondition(changed["errorCode"] as? String == "OPERATION_REUSED")
        let explicitTarget = moved.alarmAtMs + 600_000
        _ = try await restarted.apply([
            "kind": "Postpone", "operationId": "override-postpone", "occurrenceId": moved.id,
            "expectedGeneration": moved.generation, "alarmAtMs": explicitTarget,
        ])
        _ = try await restarted.apply([
            "kind": "PauseSeries", "operationId": "pause-imported-series", "segmentId": segmentID, "expectedRevision": 1,
        ])
        let paused = try store.load()
        precondition(paused.reminders[moved.id]?.deferredSeriesOverride == nil)
        precondition(paused.reminders[moved.id]?.registration?.targetMs == explicitTarget)
        precondition(paused.reminders[dormant.id]?.registration != nil && RemiloIOSDelivery.registrations.count == 9)

        let archive = try RemiloIOSPortableContent.decode(RemiloIOSPortableContent.encode(paused, now: now))
        precondition(archive.reminders[moved.id]?.nominalSlot == originals[10] && archive.reminders[ids[0]]?.skipped == true)
        let preview = try RemiloIOSPortableContent.preview(archive, against: IOSDatabase(), now: now)
        let families = preview["items"] as! [[String: Any]]
        precondition(families.first?["futureAlert"] as? Bool == true)
        let copy = try RemiloIOSPortableContent.planImport(archive, against: paused, copyIDs: [segmentID], operationID: "copy-family")
        let copiedSegment = copy.additions.series.values.first!
        precondition(copy.additions.reminders[RemiloIOSSeries.occurrenceID(copiedSegment.id, anchor)]?.skipped == true)
        RemiloIOSDelivery.registrations = [:]
        _ = try await restoredStore.engine().applyImport(handle: "fixture", copies: [], operationID: "restore-series") {
            IOSPreparedImport(content: archive)
        }
        let restored = try restoredStore.load()
        precondition(restored.reminders[moved.id]?.registration?.targetMs == explicitTarget)
        precondition(restored.reminders[ids[9]]?.registration == nil && restored.reminders[ids[9]]?.nextAlertMs != nil)
        precondition(restored.reminders[ids[0]]?.skipped == true && RemiloIOSDelivery.registrations.count == 9)
        precondition(restored.reminders[historical.id]?.deliveryState == "Missed"
                     && restored.reminders[historical.id]?.eventStartMs == historicalActual)

        let earlierStart = start - 3_600_000
        let earlier = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(earlierStart, zone: zone))
        let earlierSeries: [String: Any] = [
            "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString,
            "title": "Earlier Calendar series", "mode": "Alarm", "zoneId": "UTC", "nativeCalendarAnchor": earlier,
            "eventStartMs": earlierStart, "eventEndMs": earlierStart + 1_800_000, "dueAtMs": earlierStart, "alarmAtMs": earlierStart,
            "recurrence": ["frequency": "daily", "count": 1, "zoneMode": "pinned"],
            "nativeCalendarExceptions": [calendarOverride(nominal: earlier, actual: earlierStart, title: "Earlier move")],
        ]
        RemiloIOSDelivery.onCancel = { _ in throw IOSDeliveryFailure.denied }
        let earlierResult = try await restoredStore.engine().applyCalendarCreate(earlierSeries, authorize: { true })
        let earlierID = RemiloIOSSeries.occurrenceID(earlierResult["localId"] as! String, earlier)
        precondition(earlierResult["status"] as? String == "Pending" && RemiloIOSDelivery.registrations.count == 9)
        precondition(!RemiloIOSDelivery.registrations.values.contains { $0.occurrenceID == earlierID })
        RemiloIOSDelivery.onCancel = nil
        try await restoredStore.engine().reconcile()
        precondition(RemiloIOSDelivery.registrations.count == 9)
        precondition(RemiloIOSDelivery.registrations.values.contains { $0.occurrenceID == earlierID })

        let admitted = try restoredStore.load().reminders[earlierID]!.registration!
        RemiloIOSDelivery.onCancel = { registration in
            if registration.systemID == admitted.systemID { throw IOSDeliveryFailure.denied }
        }
        let retargeted = try await restoredStore.engine().apply([
            "kind": "Postpone", "operationId": "retarget-admitted-override", "occurrenceId": earlierID,
            "expectedGeneration": admitted.generation, "alarmAtMs": admitted.targetMs + 120_000,
        ])
        let queued = try restoredStore.load()
        precondition(retargeted["status"] as? String == "Pending" && queued.reminders[earlierID]?.deferredSeriesOverride == nil)
        precondition(queued.outbox.contains {
            $0.action == .cancel && $0.registration.systemID == admitted.systemID && $0.registration.deferredSeriesOverride == true
        })
        precondition(RemiloIOSDelivery.registrations.count == 9)
        precondition(!RemiloIOSDelivery.registrations.values.contains { $0.occurrenceID == dormant.id })
        RemiloIOSDelivery.onCancel = nil
        try await restoredStore.engine().reconcile()
        precondition(RemiloIOSDelivery.registrations.count == 10)
        precondition(RemiloIOSDelivery.registrations.values.contains { $0.occurrenceID == dormant.id })
    }

    private static func calendarSeriesTextPreservesDelivery() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let start = iosMillis(Date()) / 60_000 * 60_000 + 7_200_000
        let zone = TimeZone(identifier: "UTC")!
        let anchor = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(start, zone: zone))
        let created = try await engine.applyCalendarCreate([
            "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString,
            "title": "Old series title", "notes": "Old notes", "mode": "Alarm", "zoneId": "UTC",
            "eventStartMs": start, "eventEndMs": start + 1_800_000, "dueAtMs": start, "alarmAtMs": start,
            "nativeCalendarAnchor": anchor, "recurrence": ["frequency": "daily", "count": 5, "zoneMode": "pinned"],
            "nativeCalendarExceptions": [calendarOverride(nominal: anchor, actual: start + 3_600_000, title: "Moved exception")],
        ], authorize: { true })
        let segment = created["localId"] as! String
        let exceptionID = RemiloIOSSeries.occurrenceID(segment, anchor)
        let initial = try store.load()
        let ordinary = initial.reminders.values.filter { $0.segmentID == segment && $0.independent != true }
            .min(by: { $0.eventStartMs < $1.eventStartMs })!
        let postponed = try await engine.apply([
            "kind": "Postpone", "operationId": "fixture-postpone-series-text", "occurrenceId": ordinary.id,
            "expectedGeneration": ordinary.generation, "alarmAtMs": ordinary.alarmAtMs + 600_000,
        ])
        precondition(postponed["status"] as? String == "Scheduled")
        let baseline = try store.load()
        let snapshot = try engine.calendarSeriesTextSnapshot(segment)!
        let attemptCount = RemiloIOSDelivery.attempts.count
        let key = UUID().uuidString
        let fenced = try await engine.applyCalendarSeriesText(operationKey: key, snapshot: snapshot, title: "Google title",
                                                              notes: "Google notes", authorize: { false })
        let untouched = try store.load()
        precondition(!fenced && untouched.series[segment]?.template.title == "Old series title")
        let applied = try await engine.applyCalendarSeriesText(operationKey: key, snapshot: snapshot, title: "Google title",
                                                               notes: "Google notes", authorize: { true })
        let restarted = store.engine()
        let committed = try restarted.calendarSeriesTextSnapshot(segment)!
        let replay = try await restarted.applyCalendarSeriesText(operationKey: key, snapshot: committed, title: "Google title",
                                                                 notes: "Google notes", authorize: { true })
        let after = try store.load()
        precondition(applied && replay && committed.revision == snapshot.revision + 1 && after.series[segment]?.revision == committed.revision)
        precondition(after.reminders[exceptionID]?.title == "Moved exception" && after.reminders[exceptionID]?.notes == "Authored exception")
        precondition(after.reminders[ordinary.id]?.title == "Google title" && after.reminders[ordinary.id]?.notes == "Google notes")
        precondition(after.reminders[ordinary.id]?.registration?.targetMs == ordinary.alarmAtMs + 600_000 &&
                     after.reminders[ordinary.id]?.registration?.systemID == baseline.reminders[ordinary.id]?.registration?.systemID)
        precondition(Set(after.reminders.keys) == Set(baseline.reminders.keys) && RemiloIOSDelivery.attempts.count == attemptCount)
        _ = try await restarted.apply([
            "kind": "PauseSeries", "operationId": "fixture-pause-series-text", "segmentId": segment, "expectedRevision": committed.revision,
        ])
        let paused = try restarted.calendarSeriesTextSnapshot(segment)
        precondition(paused == nil)
        _ = try await restarted.apply([
            "kind": "ResumeSeries", "operationId": "fixture-resume-series-text", "segmentId": segment,
            "expectedRevision": committed.revision + 1,
        ])
        let beforeEdit = try restarted.calendarSeriesTextSnapshot(segment)!
        let replacement = try await restarted.apply([
            "kind": "EditSeries", "operationId": "fixture-edit-series-text", "segmentId": segment,
            "expectedRevision": beforeEdit.revision, "title": "Local series edit", "alarmAtMs": start + 120_000,
            "recurrence": ["frequency": "daily", "count": 5, "zoneMode": "pinned"],
        ])
        let edited = try restarted.calendarSeriesTextSnapshot(segment)!
        precondition(edited.familyID == segment && edited.segmentID != segment && replacement["segmentId"] as? String == edited.segmentID &&
                     edited.title == "Local series edit")
        let stalePermit: Bool? = try await restarted.withCalendarSeriesTextPermit(for: beforeEdit) {
            preconditionFailure("A replaced local segment cannot authorize a write")
        }
        let currentPermit = try await restarted.withCalendarSeriesTextPermit(for: edited) { true }
        precondition(stalePermit == nil && currentPermit == true)
        let split = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(start + 86_400_000, zone: zone))
        _ = try await restarted.apply([
            "kind": "EditFollowing", "operationId": "fixture-split-series-text", "segmentId": edited.segmentID,
            "expectedRevision": edited.revision, "nominalSlot": split, "title": "Following segment",
            "recurrence": ["frequency": "daily", "count": 4, "zoneMode": "pinned"],
        ])
        let splitFamily = try restarted.calendarSeriesTextSnapshot(segment)
        precondition(splitFamily == nil, "A change to the event structure needs a series schedule reconciliation")
    }

    private static func calendarSeriesSchedulePreservesLocalState() async throws {
        let zone = TimeZone(identifier: "UTC")!
        let start = iosMillis(Date()) / 60_000 * 60_000 + 7_200_000
        let anchor = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(start, zone: zone))
        func create(_ engine: RemiloIOSEngine, exceptions: [[String: Any]]) async throws -> String {
            let result = try await engine.applyCalendarCreate([
                "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString,
                "title": "Old schedule", "mode": "Alarm", "zoneId": "UTC",
                "eventStartMs": start, "eventEndMs": start + 1_800_000, "dueAtMs": start, "alarmAtMs": start,
                "nativeCalendarAnchor": anchor, "recurrence": ["frequency": "daily", "count": 6, "zoneMode": "pinned"],
                "nativeCalendarExceptions": exceptions,
            ], authorize: { true })
            return result["localId"] as! String
        }
        func change(startMs: Int64, duration: Int64, count: Int) throws -> IOSCalendarSeriesScheduleChange {
            let nominal = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(startMs, zone: zone))
            let rule = try RemiloIOSRecurrence.Rule(anchor: nominal, frequency: "daily", count: count, zoneID: "UTC", endOffsetMs: duration)
            return .init(rule: rule, eventStartMs: startMs, eventEndMs: startMs + duration, title: "Google schedule", notes: "Changed duration")
        }
        let store = FixtureStore()
        let cleanStore = FixtureStore()
        defer {
            store.remove()
            cleanStore.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
            RemiloIOSDelivery.alerting = []
        }
        let engine = store.engine()
        let family = try await create(engine, exceptions: [calendarOverride(nominal: anchor, actual: start + 3_600_000, title: "Authored move")])
        let initial = try store.load()
        let ordinary = initial.reminders.values.filter { $0.segmentID == family && $0.independent != true }
            .sorted { $0.eventStartMs < $1.eventStartMs }
        let held = ordinary[0]
        let completed = ordinary[1]
        let postponedAt = held.alarmAtMs + 600_000
        _ = try await engine.apply(["kind": "Postpone", "operationId": "series-schedule-postpone", "occurrenceId": held.id,
                                    "expectedGeneration": held.generation, "alarmAtMs": postponedAt])
        _ = try await engine.apply(["kind": "Done", "operationId": "series-schedule-done", "occurrenceId": completed.id,
                                    "expectedRevision": completed.revision])
        let before = try store.load()
        let current = before.reminders.values.first { $0.segmentID == family && $0.active && $0.independent != true && $0.registration != nil }!
        let registration = current.registration!.systemID
        let snapshot = try engine.calendarSeriesTextSnapshot(family)!
        let durationChange = try change(startMs: start, duration: 2_700_000, count: 5)
        RemiloIOSDelivery.alerting.insert(registration)
        let ringing = try await engine.applyCalendarSeriesSchedule(operationKey: "duration", snapshot: snapshot, change: durationChange, authorize: { true })
        let whileRinging = try engine.calendarSeriesTextSnapshot(family)
        precondition(ringing == .deferred && whileRinging == snapshot)
        RemiloIOSDelivery.alerting.remove(registration)
        let applied = try await engine.applyCalendarSeriesSchedule(operationKey: "duration", snapshot: snapshot, change: durationChange, authorize: { true })
        let reopened = store.engine()
        let confirmed = try reopened.calendarSeriesTextSnapshot(family)!
        let replay = try await reopened.applyCalendarSeriesSchedule(operationKey: "duration", snapshot: confirmed, change: durationChange, authorize: { true })
        let after = try store.load()
        let move = RemiloIOSSeries.occurrenceID(family, anchor)
        precondition(applied == .applied && replay == .applied && confirmed.segmentID == family &&
                     confirmed.revision == snapshot.revision + 1 && after.series[family]?.revision == confirmed.revision)
        precondition(after.reminders[held.id]?.eventEndMs == held.eventStartMs + 2_700_000 &&
                     after.reminders[held.id]?.registration?.targetMs == postponedAt &&
                     after.reminders[held.id]?.registration?.systemID == before.reminders[held.id]?.registration?.systemID)
        precondition(after.reminders[completed.id]?.completed == true && after.reminders[completed.id]?.eventEndMs == completed.eventEndMs &&
                     after.reminders[move]?.title == "Authored move" && after.reminders[move]?.eventEndMs == before.reminders[move]?.eventEndMs)
        let unsafe = try change(startMs: start + 1_800_000, duration: 2_700_000, count: 5)
        let review = try await reopened.applyCalendarSeriesSchedule(operationKey: "shift-with-local-work", snapshot: confirmed,
                                                                    change: unsafe, authorize: { true })
        let afterReview = try reopened.calendarSeriesTextSnapshot(family)
        precondition(review == .needsReview && afterReview == confirmed)

        RemiloIOSDelivery.registrations = [:]
        let clean = cleanStore.engine()
        let cleanFamily = try await create(clean, exceptions: [])
        let old = try cleanStore.load()
        let cleanSnapshot = try clean.calendarSeriesTextSnapshot(cleanFamily)!
        let elapsedRule = try RemiloIOSRecurrence.Rule(anchor: anchor, frequency: "daily", count: 6, zoneID: "Asia/Tokyo")
        let elapsedStart = start - 9 * 3_600_000
        let elapsedChange = IOSCalendarSeriesScheduleChange(rule: elapsedRule, eventStartMs: elapsedStart, eventEndMs: elapsedStart + 1_800_000,
                                                           title: "Earlier time zone", notes: "")
        let elapsed = try await clean.applyCalendarSeriesSchedule(operationKey: "elapsed", snapshot: cleanSnapshot,
                                                                  change: elapsedChange, authorize: { true })
        let afterElapsed = try clean.calendarSeriesTextSnapshot(cleanFamily)
        precondition(elapsed == .elapsedAlert && afterElapsed == cleanSnapshot)
        let shifted = try await clean.applyCalendarSeriesSchedule(operationKey: "shift", snapshot: cleanSnapshot, change: unsafe, authorize: { true })
        let revised = try cleanStore.load()
        let oldID = RemiloIOSSeries.occurrenceID(cleanFamily, anchor)
        let newID = RemiloIOSSeries.occurrenceID(cleanFamily, unsafe.rule.anchor)
        precondition(shifted == .applied && revised.reminders[oldID]?.deliveryState == "Replaced" &&
                     revised.reminders[newID]?.registration?.targetMs == unsafe.eventStartMs)
        precondition(RemiloIOSDelivery.registrations[old.reminders[oldID]!.registration!.systemID] == nil)
        let synced = try clean.calendarSeriesTextSnapshot(cleanFamily)!
        let localStart = unsafe.eventStartMs + 3_600_000
        _ = try await clean.apply([
            "kind": "EditSeries", "operationId": "fixture-outbound-schedule-edit", "segmentId": synced.segmentID,
            "expectedRevision": synced.revision, "eventStartMs": localStart, "eventEndMs": localStart + 2_700_000,
            "alarmAtMs": localStart, "recurrence": ["frequency": "daily", "count": 5, "zoneMode": "pinned"],
        ])
        let outbound = try clean.calendarSeriesExportSnapshot(cleanFamily)!
        let forInbound = try clean.calendarSeriesTextSnapshot(cleanFamily)
        let sendPermit = try await clean.withCalendarSeriesTextPermit(for: outbound) { true }
        precondition(forInbound == nil && outbound.scheduleEdit?.baseline.hasSameEventSchedule(as: unsafe.rule) == true &&
                     outbound.scheduleEdit?.hasFutureExceptions == false && sendPermit == true)
        let registrations = RemiloIOSDelivery.registrations.keys.sorted { $0.uuidString < $1.uuidString }
        let refused = try await clean.acknowledgeCalendarSeriesExport(outbound, authorize: { false })
        let pending = try clean.calendarSeriesExportSnapshot(cleanFamily)
        precondition(!refused && pending == outbound)
        let confirmedExport = try await clean.acknowledgeCalendarSeriesExport(outbound, authorize: { true })
        let reopenedExport = cleanStore.engine()
        let replayedExport = try await reopenedExport.acknowledgeCalendarSeriesExport(outbound, authorize: { true })
        let baselineExport = try reopenedExport.calendarSeriesTextSnapshot(cleanFamily)
        precondition(confirmedExport && replayedExport && baselineExport?.segmentID == outbound.segmentID && baselineExport?.scheduleEdit == nil)
        precondition(registrations == RemiloIOSDelivery.registrations.keys.sorted { $0.uuidString < $1.uuidString })
    }

    private static func calendarSeriesInstancePreservesOriginalSlot() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.alerting = []
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let start = iosMillis(Date()) / 60_000 * 60_000 + 7_200_000
        let zone = TimeZone(identifier: "UTC")!
        let anchor = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(start, zone: zone))
        let created = try await engine.applyCalendarCreate([
            "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString,
            "title": "Series", "mode": "Alarm", "zoneId": "UTC", "alarmLinked": true,
            "eventStartMs": start, "eventEndMs": start + 1_800_000, "dueAtMs": start, "alarmAtMs": start,
            "nativeCalendarAnchor": anchor, "recurrence": ["frequency": "daily", "count": 4, "zoneMode": "pinned"],
        ], authorize: { true })
        let family = created["localId"] as! String
        let before = try store.load()
        let ordinary = before.reminders.values.filter { $0.segmentID == family }.sorted { $0.eventStartMs < $1.eventStartMs }
        let original = ordinary[0]
        let terminal = ordinary[1]
        let postponement = start + 5_400_000
        _ = try await engine.apply(["kind": "Postpone", "operationId": "instance-postpone", "occurrenceId": original.id,
                                    "expectedGeneration": original.generation, "alarmAtMs": postponement])
        _ = try await engine.apply(["kind": "Done", "operationId": "instance-done", "occurrenceId": terminal.id,
                                    "expectedRevision": terminal.revision])
        let postponed = try store.load().reminders[original.id]!
        let snapshot = try engine.calendarSeriesTextSnapshot(family)!
        func change(_ record: IOSReminder, eventID: String) -> IOSCalendarSeriesInstanceChange {
            let moved = record.eventStartMs + 3_600_000
            return .init(eventID: eventID, nominalSlot: record.nominalSlot!, previouslyImported: false,
                         title: "Google exception", notes: "Moved occurrence", eventStartMs: moved, eventEndMs: moved + 1_800_000,
                         allDay: false, zoneID: "UTC")
        }
        let update = change(original, eventID: "google-moved")
        RemiloIOSDelivery.alerting.insert(postponed.registration!.systemID)
        let ringing = try await engine.applyCalendarSeriesInstance(operationKey: "first", snapshot: snapshot, change: update, authorize: { true })
        RemiloIOSDelivery.alerting.remove(postponed.registration!.systemID)
        let applied = try await engine.applyCalendarSeriesInstance(operationKey: "first", snapshot: snapshot, change: update, authorize: { true })
        let ignored = try await engine.applyCalendarSeriesInstance(operationKey: "done", snapshot: snapshot,
                                                                 change: change(terminal, eventID: "google-terminal"), authorize: { true })
        let reopened = store.engine()
        let replay = try await reopened.applyCalendarSeriesInstance(operationKey: "first", snapshot: snapshot, change: update, authorize: { true })
        let after = try store.load()
        let moved = after.reminders[original.id]!
        precondition(ringing == .deferred && applied == .applied && replay == .applied && ignored == .ignored)
        precondition(moved.calendarInstanceID == update.eventID && moved.nominalSlot == original.nominalSlot &&
                     moved.eventStartMs == update.eventStartMs && moved.title == update.title && moved.alarmAtMs == update.eventStartMs)
        precondition(moved.registration?.systemID == postponed.registration?.systemID && moved.nextAlertMs == postponement &&
                     moved.revision == postponed.revision + 1 && after.reminders[terminal.id]?.completed == true)
        _ = try await reopened.apply(["kind": "Reopen", "operationId": "instance-reopen", "occurrenceId": terminal.id,
                                      "expectedRevision": after.reminders[terminal.id]!.revision])
        let ignoredReplay = try await reopened.applyCalendarSeriesInstance(operationKey: "done", snapshot: snapshot,
            change: change(terminal, eventID: "google-terminal"), authorize: { true })
        let needsReview = try await reopened.applyCalendarSeriesInstance(operationKey: "new-version", snapshot: snapshot,
            change: change(terminal, eventID: "google-terminal"), authorize: { true })
        let final = try store.load().reminders[terminal.id]!
        precondition(ignoredReplay == .ignored && needsReview == .needsReview && final.calendarInstanceID == nil)
    }

    private static func calendarSeriesAllowsAFutureMoveAfterItsLastOriginal() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let now = iosMillis(Date())
        let original = now / 60_000 * 60_000 - 86_400_000
        let actual = original + 2 * 86_400_000
        let anchor = try RemiloIOSRecurrence.canonicalNominal(RemiloIOSSeries.civil(original, zone: TimeZone(identifier: "UTC")!))
        let result = try await store.engine().applyCalendarCreate([
            "kind": "CreateSeries", "operationId": "ios-calendar-import:" + UUID().uuidString,
            "title": "Finite Calendar series", "mode": "None", "zoneId": "UTC", "nativeCalendarAnchor": anchor,
            "eventStartMs": original, "eventEndMs": original + 1_800_000, "dueAtMs": original, "alarmAtMs": original,
            "recurrence": ["frequency": "daily", "count": 1, "zoneMode": "pinned"],
            "nativeCalendarExceptions": [calendarOverride(nominal: anchor, actual: actual, title: "Future move", alertEligible: false)],
        ], authorize: { true })
        let id = RemiloIOSSeries.occurrenceID(result["localId"] as! String, anchor)
        let persisted = try store.load()
        precondition(persisted.reminders.count == 1 && persisted.reminders[id]?.eventStartMs == actual)
        precondition(persisted.reminders[id]?.deliveryState == "NoAlert" && persisted.reminders[id]?.nextAlertMs == nil)
    }

    private static func calendarOverride(nominal: String, actual: Int64, title: String, alertEligible: Bool = true) -> [String: Any] {
        ["kind": "Override", "nominalSlot": nominal, "title": title, "notes": "Authored exception",
         "eventStartMs": actual, "eventEndMs": actual + 1_800_000, "allDay": false, "zoneId": "UTC",
         "dueAtMs": actual, "alarmAtMs": actual - 300_000, "alarmLinked": false, "alertEligible": alertEligible]
    }

    private static func queuedCalendarCreateChecksAuthorityBeforeWriting() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let (held, markHeld) = AsyncStream<Void>.makeStream()
        let (release, resume) = AsyncStream<Void>.makeStream()
        let earlier = Task {
            try await engine.applyImport(handle: "queue-hold", copies: [], operationID: "queue-hold") {
                markHeld.yield(())
                markHeld.finish()
                for await _ in release { break }
                return IOSPreparedImport(content: .init())
            }
        }
        var heldIterator = held.makeAsyncIterator()
        _ = await heldIterator.next()
        let proof = CalendarCommitProof()
        let draft = createCommand(id: "ios-calendar-import:" + UUID().uuidString.lowercased())
        let (queued, markQueued) = AsyncStream<Void>.makeStream()
        let later = Task {
            markQueued.yield(())
            markQueued.finish()
            return try await engine.applyCalendarCreate(draft) {
                proof.checks += 1
                return proof.current
            }
        }
        var queuedIterator = queued.makeAsyncIterator()
        _ = await queuedIterator.next()
        precondition(proof.checks == 0)
        proof.current = false
        resume.yield(())
        resume.finish()
        _ = try await earlier.value
        let denied = try await later.value
        let saved = try store.load()
        let receipt = try engine.calendarCreateReceipt(draft)
        precondition(denied["errorCode"] as? String == "STALE_CONNECTION" && proof.checks == 1)
        precondition(saved.reminders.isEmpty && saved.outbox.isEmpty && receipt == nil)
        var invalid = draft
        invalid["title"] = ""
        let invalidResult = try await engine.applyCalendarCreate(invalid) {
            preconditionFailure("Invalid commands must fail validation before the commit permit")
        }
        precondition(invalidResult["errorCode"] as? String == "INVALID_INPUT" && invalidResult["errorField"] as? String == "title")
    }

    @MainActor
    private final class CalendarCommitProof {
        var current = true
        var checks = 0
    }

    private static func queuedCalendarReviewRechecksLocalVersion() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let start = iosMillis(Date()) + 3_600_000
        let end = start + 1_800_000
        let zone = "America/Los_Angeles"
        let created = try await engine.apply([
            "kind": "Create", "operationId": "local-publication-source", "title": "Authored title", "notes": "Authored notes",
            "eventStartMs": start, "eventEndMs": end, "alarmAtMs": start, "zoneId": zone,
        ])
        let id = created["occurrenceId"] as! String
        let snapshot = try engine.calendarPublicationSnapshot(id)
        precondition(snapshot == IOSCalendarOneTimeSnapshot(occurrenceID: id, revision: 1,
            generation: created["generation"] as! Int, title: "Authored title", notes: "Authored notes",
            eventStartMs: start, eventEndMs: end, allDay: false, zoneID: zone))
        let attempts = RemiloIOSDelivery.attempts
        store.interruptNextWrite = true
        let permitted = try await engine.withCalendarPublicationPermit(for: snapshot) { true }
        precondition(permitted && store.interruptNextWrite && RemiloIOSDelivery.attempts == attempts)
        store.interruptNextWrite = false

        let (held, markHeld) = AsyncStream<Void>.makeStream()
        let (release, resume) = AsyncStream<Void>.makeStream()
        let earlier = Task {
            try await engine.applyImport(handle: "publication-queue-hold", copies: [], operationID: "publication-queue-hold") {
                markHeld.yield(())
                markHeld.finish()
                for await _ in release { break }
                return IOSPreparedImport(content: .init())
            }
        }
        var heldIterator = held.makeAsyncIterator()
        _ = await heldIterator.next()
        let (queued, markQueued) = AsyncStream<Void>.makeStream()
        let postpone = Task {
            markQueued.yield(())
            markQueued.finish()
            return try await engine.apply([
                "kind": "Postpone", "occurrenceId": id, "operationId": "publication-postpone",
                "expectedGeneration": snapshot.generation, "alarmAtMs": start + 60_000,
            ])
        }
        var queuedIterator = queued.makeAsyncIterator()
        _ = await queuedIterator.next()
        resume.yield(())
        resume.finish()
        do {
            let _: Bool = try await engine.withCalendarOneTimePermit(for: snapshot, purpose: .manualLink) {
                preconditionFailure("A link queued behind a new delivery generation must not reach the checkpoint")
            }
            preconditionFailure("Expected a stale link preview")
        } catch IOSCalendarOneTimeSnapshot.Failure.stalePreview {}
        _ = try await earlier.value
        let postponed = try await postpone.value
        precondition(postponed["status"] as? String == "Scheduled")
        let next = try engine.calendarPublicationSnapshot(id)
        precondition(next.revision == snapshot.revision && next.generation != snapshot.generation)
        do {
            let _: Bool = try await engine.withCalendarPublicationPermit(for: snapshot) {
                preconditionFailure("The old local version must remain stale for publication")
            }
            preconditionFailure("Expected a stale publication preview")
        } catch IOSCalendarOneTimeSnapshot.Failure.stalePreview {}
        _ = try await engine.apply([
            "kind": "Delete", "occurrenceId": id, "operationId": "publication-delete", "expectedRevision": next.revision,
        ])
        do {
            _ = try engine.calendarPublicationSnapshot(id)
            preconditionFailure("A reminder in Trash cannot be published")
        } catch IOSCalendarOneTimeSnapshot.Failure.ineligible {}
    }

    private static func calendarLifecycleTracksTerminalRoundTrips() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        var engine = store.engine()
        let created = try await engine.apply(createCommand(id: "calendar-lifecycle-create"))
        let id = created["occurrenceId"] as! String
        func record() throws -> IOSReminder { try store.load().reminders[id]! }
        func check(_ epoch: Int?, active: Bool) throws {
            let persisted = try record()
            let actual = try engine.calendarLifecycleRevision(id)
            let expected: Int? = active ? (epoch ?? 0) : nil
            precondition(persisted.calendarLifecycleRevision == epoch)
            precondition(actual == expected)
        }
        func authored(_ kind: String, operation: String) throws -> [String: Any] {
            ["kind": kind, "occurrenceId": id, "operationId": operation, "expectedRevision": try record().revision]
        }
        try check(nil, active: true)
        let done = try authored("Done", operation: "calendar-lifecycle-done")
        _ = try await engine.apply(done)
        try check(2, active: false)

        engine = store.engine()
        _ = try await engine.apply(authored("Reopen", operation: "calendar-lifecycle-reopen"))
        try check(3, active: true)
        _ = try await engine.apply(done)
        try check(3, active: true)

        var edit = try authored("Edit", operation: "calendar-lifecycle-edit")
        edit["title"] = "Renamed without reopening"
        _ = try await engine.apply(edit)
        try check(3, active: true)
        let edited = try record()
        precondition(edited.revision == 4)
        try await engine.performSystemAction(kind: "Snooze", occurrenceID: id, generation: edited.generation)
        try check(3, active: true)
        let snoozed = try record()
        _ = try await engine.apply([
            "kind": "Postpone", "occurrenceId": id, "operationId": "calendar-lifecycle-postpone",
            "expectedGeneration": snoozed.generation, "alarmAtMs": iosMillis(Date()) + 3_600_000,
        ])
        try check(3, active: true)

        let delete = try authored("Delete", operation: "calendar-lifecycle-delete")
        _ = try await engine.apply(delete)
        try check(5, active: false)
        _ = try await engine.apply(authored("UndoDelete", operation: "calendar-lifecycle-restore"))
        try check(6, active: true)
        _ = try await engine.apply(delete)
        try check(6, active: true)

        let restored = try record()
        try await engine.performSystemAction(kind: "CompleteDelivery", occurrenceID: id, generation: restored.generation)
        try check(7, active: false)
        _ = try await engine.apply(authored("Reopen", operation: "calendar-lifecycle-reopen-delivery"))
        try check(8, active: true)
        let reopened = try record()
        _ = try await engine.apply([
            "kind": "Stop", "occurrenceId": id, "operationId": "calendar-lifecycle-legacy-stop",
            "expectedGeneration": reopened.generation,
        ])
        try check(9, active: false)

        let archive = try RemiloIOSPortableContent.encode(store.load(), now: iosMillis(Date()))
        let portable = try RemiloIOSPortableContent.decode(archive, availableImageIDs: [])
        precondition(!String(decoding: archive, as: UTF8.self).contains("calendarLifecycleRevision"))
        precondition(portable.reminders[id]?.completed == true && portable.reminders[id]?.calendarLifecycleRevision == nil)
    }

    private static func calendarInboundPreservesDeliveryAndFencesRinging() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.alerting = []
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let list = try await engine.apply(["kind": "CreateList", "operationId": "inbound-list", "name": "Private list"])
        let listID = (list["list"] as! [String: Any])["id"] as! String
        let start = iosMillis(Date()) + 3_600_000
        let source = try await engine.apply([
            "kind": "Create", "operationId": "inbound-source", "title": "Original title", "notes": "Original notes",
            "eventStartMs": start, "alarmAtMs": start, "zoneId": "UTC", "sound": "system", "listId": listID,
        ])
        let id = source["occurrenceId"] as! String
        let original = try store.load().reminders[id]!
        let registrationID = original.registration!.systemID
        RemiloIOSDelivery.alerting.insert(registrationID)
        let snapshot = try engine.calendarOneTimeSnapshot(id, for: .manualLink)
        let metadata = IOSCalendarInboundChange(title: "Reviewed title", notes: "Reviewed notes", schedule: .init(original))
        let metadataOperation = UUID()
        let publicResult = try await engine.apply(metadata.input(operationID: metadataOperation, snapshot: snapshot).values)
        precondition(publicResult["errorCode"] as? String == "UNSUPPORTED")
        let privateID = RemiloIOSEngine.calendarInboundPrefix + metadataOperation.uuidString.lowercased()
        let test = try await engine.scheduleTestAlarm(operationId: privateID)
        precondition(test["errorCode"] as? String == "UNSUPPORTED")
        do {
            _ = try await engine.applyImport(handle: "calendar-inbound", copies: [], operationID: privateID) {
                preconditionFailure("Portable imports must reject the reserved Calendar link namespace")
            }
            preconditionFailure("Expected reserved Calendar link namespace to be rejected")
        } catch let error as IOSInputFailure { precondition(error.code == "UNSUPPORTED") }
        let attempts = RemiloIOSDelivery.attempts
        let result = try await engine.applyCalendarInbound(operationID: metadataOperation, for: snapshot, change: metadata, authorize: { true })
        let renamed = try store.load().reminders[id]!
        precondition(result["status"] as? String == "Applied" && renamed.title == metadata.title && renamed.notes == metadata.notes)
        precondition(renamed.generation == original.generation && renamed.registration?.systemID == registrationID
                     && RemiloIOSDelivery.attempts == attempts && RemiloIOSDelivery.alerting.contains(registrationID))
        let changedSchedule = IOSCalendarInboundChange(title: renamed.title, notes: renamed.notes,
            schedule: .init(eventStartMs: start + 600_000, eventEndMs: renamed.eventEndMs + 600_000, allDay: false, zoneID: "UTC"))
        let reviewed = try engine.calendarOneTimeSnapshot(id, for: .manualLink)
        let deferred = UUID()
        do {
            _ = try await engine.applyCalendarInbound(operationID: deferred, for: reviewed, change: changedSchedule) {
                preconditionFailure("A ringing alarm cannot reach the Calendar commit permit for a schedule change")
            }
            preconditionFailure("Expected ringing schedule change to be deferred")
        } catch let error as IOSInputFailure { precondition(error.code == "RINGING_DEFERRED") }
        let deferredReceipt = try engine.calendarInboundReceipt(operationID: deferred, for: reviewed, change: changedSchedule)
        precondition(deferredReceipt == nil)
        RemiloIOSDelivery.alerting.remove(registrationID)
        let target = start + 3_600_000
        _ = try await engine.apply([
            "kind": "Postpone", "operationId": "inbound-postpone", "occurrenceId": id,
            "expectedGeneration": renamed.generation, "alarmAtMs": target,
        ])
        let postponed = try store.load().reminders[id]!
        let moving = try engine.calendarOneTimeSnapshot(id, for: .manualLink)
        let past = start - 7_200_000
        let move = IOSCalendarInboundChange(title: postponed.title, notes: postponed.notes,
            schedule: .init(eventStartMs: past, eventEndMs: past + 1_800_000, allDay: false, zoneID: "UTC"))
        let timing = try engine.previewCalendarInbound(for: moving, change: move)
        precondition(timing.dueAtMs == past && timing.alarmAtMs == past && timing.retainedAlertMs == target)
        let moveOperation = UUID()
        do {
            _ = try await engine.applyCalendarInbound(operationID: moveOperation, for: moving, change: move, authorize: { false })
            preconditionFailure("A stale Calendar authority must prevent local commit")
        } catch let error as IOSInputFailure { precondition(error.code == "STALE_CONNECTION") }
        let blockedReceipt = try engine.calendarInboundReceipt(operationID: moveOperation, for: moving, change: move)
        precondition(blockedReceipt == nil)
        let beforeMove = RemiloIOSDelivery.attempts
        _ = try await engine.applyCalendarInbound(operationID: moveOperation, for: moving, change: move, authorize: { true })
        let moved = try store.load().reminders[id]!
        precondition(moved.eventStartMs == past && moved.alarmAtMs == past && moved.nextAlertMs == target)
        precondition(moved.adjustment == "Postponed" && moved.generation == postponed.generation
                     && moved.registration?.systemID == postponed.registration?.systemID && RemiloIOSDelivery.attempts == beforeMove)
        precondition(moved.sound == "system" && moved.listID == listID && moved.mode == "Alarm")
    }

    private static func calendarInboundReplaysInterruptedDelivery() async throws {
        let store = FixtureStore()
        defer {
            store.remove()
            RemiloIOSDelivery.onRegister = nil
            RemiloIOSDelivery.registrations = [:]
            RemiloIOSDelivery.attempts = []
        }
        let engine = store.engine()
        let created = try await engine.apply(createCommand(id: "inbound-replay-source"))
        let id = created["occurrenceId"] as! String
        let snapshot = try engine.calendarOneTimeSnapshot(id, for: .manualLink)
        let change = IOSCalendarInboundChange(title: snapshot.title, notes: snapshot.notes,
            schedule: .init(eventStartMs: snapshot.eventStartMs + 600_000, eventEndMs: snapshot.eventEndMs + 600_000,
                            allDay: false, zoneID: snapshot.zoneID))
        let timing = try engine.previewCalendarInbound(for: snapshot, change: change)
        let operation = UUID()
        RemiloIOSDelivery.onRegister = { _ in store.interruptNextWrite = true }
        do {
            _ = try await engine.applyCalendarInbound(operationID: operation, for: snapshot, change: change, authorize: { true })
            preconditionFailure("Expected an interrupted acknowledgement after the inbound schedule commit")
        } catch FixtureStore.Failure.writeInterrupted {}
        RemiloIOSDelivery.onRegister = nil
        let restarted = store.engine()
        let pending = try restarted.calendarInboundReceipt(operationID: operation, for: snapshot, change: change)
        precondition(pending?["status"] as? String == "Pending")
        let recovered = try await restarted.applyCalendarInbound(operationID: operation, for: snapshot, change: change) {
            preconditionFailure("A committed Calendar mutation is recovered from its exact engine receipt")
        }
        let row = try store.load().reminders[id]!
        precondition(recovered["status"] as? String == "Scheduled" && row.alarmAtMs == timing.alarmAtMs)
        precondition(row.generation == snapshot.generation + 1 && row.history.filter { $0.kind == "Edit" }.count == 1)
        precondition(RemiloIOSDelivery.attempts.suffix(2) == [row.registration!.systemID, row.registration!.systemID])
        do {
            _ = try restarted.calendarInboundReceipt(operationID: operation, for: snapshot,
                change: .init(title: "Different", notes: change.notes, schedule: change.schedule))
            preconditionFailure("An operation ID cannot recover a different reviewed choice")
        } catch let error as IOSInputFailure { precondition(error.code == "OPERATION_REUSED") }
    }

    private static func calendarInboundProjectsIndependentAndAllDayTiming() throws {
        let format = ISO8601DateFormatter()
        let january = iosMillis(format.date(from: "2037-01-08T00:00:00Z")!)
        let midnight = iosMillis(format.date(from: "2037-01-10T08:00:00Z")!)
        let day: Int64 = 86_400_000
        let clock: Int64 = 33_345_123
        var old = IOSReminder(id: "inbound-allday", title: "All day", notes: "", listID: nil,
            eventStartMs: january, eventEndMs: january + day, dueAtMs: january + day, alarmAtMs: january + clock,
            zoneID: "UTC", mode: "Notification", allDay: true, dueLinked: true, alarmLinked: true)
        let change = IOSCalendarInboundChange(title: old.title, notes: old.notes,
            schedule: .init(eventStartMs: midnight, eventEndMs: midnight + day, allDay: true, zoneID: "America/Los_Angeles"))
        let linked = try IOSCalendarInboundProjection(change, from: old, state: .init(), now: january - 1)
        precondition(linked.timing.dueAtMs == midnight + day && linked.timing.alarmAtMs == midnight + clock && linked.replacesRegistration)
        old.allDay = false
        let timedToAllDay = try IOSCalendarInboundProjection(change, from: old, state: .init(), now: january - 1)
        precondition(timedToAllDay.timing == linked.timing && timedToAllDay.record.allDay)
        do {
            _ = try IOSCalendarInboundProjection(change, from: old, state: .init(), now: midnight + clock)
            preconditionFailure("An elapsed newly authored alert must not be scheduled")
        } catch let error as IOSInputFailure { precondition(error.code == "ELAPSED_ALERT") }
        old.dueLinked = false
        old.alarmLinked = false
        let independent = try IOSCalendarInboundProjection(change, from: old, state: .init(), now: midnight + clock)
        precondition(independent.timing.dueAtMs == old.dueAtMs && independent.timing.alarmAtMs == old.alarmAtMs
                     && !independent.replacesRegistration && independent.timing.mode == "Notification")
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

    private static func purgedOneOffRequiresExplicitBackupCopyAfterRestart() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let engine = store.engine()
        let now = iosMillis(Date())
        var command = createCommand(id: "create-before-purge")
        command["mode"] = "None"
        let created = try await engine.apply(command)
        let id = created["occurrenceId"] as! String
        let beforeTrash = try store.load()
        let oldBackup = try RemiloIOSPortableContent.encode(beforeTrash, now: now)
        let bundle = try RemiloIOSPortableContent.decode(oldBackup)
        precondition(bundle.reminders[id] != nil)

        let trashed = try await engine.apply([
            "kind": "Delete", "operationId": "trash-before-purge", "occurrenceId": id,
            "expectedRevision": beforeTrash.reminders[id]!.revision,
        ])
        precondition(trashed["status"] as? String == "Applied")
        let inTrash = try store.load()
        let beforePurgeBackup = try RemiloIOSPortableContent.encode(inTrash, now: now)
        let purged = try await engine.apply([
            "kind": "Purge", "operationId": "purge-one-off", "occurrenceId": id,
            "expectedRevision": inTrash.reminders[id]!.revision,
        ])
        precondition(purged["status"] as? String == "Applied")

        let restarted = store.engine()
        let persisted = try restarted.read()
        precondition(persisted.reminders[id] == nil && persisted.isPurgedOccurrence(id))
        let afterPurgeBackup = try RemiloIOSPortableContent.encode(persisted, now: now)
        precondition(beforePurgeBackup == afterPurgeBackup)
        let preview = try RemiloIOSPortableContent.preview(bundle, against: persisted, now: now)
        let rows = preview["items"] as! [[String: Any]]
        precondition(rows.count == 1 && rows[0]["id"] as? String == id && rows[0]["conflict"] as? Bool == true)
        let preserved = try await restarted.applyImport(handle: "older-backup", copies: [], operationID: "keep-purged") {
            IOSPreparedImport(content: bundle)
        }
        precondition(preserved["added"] as? Int == 0 && preserved["preserved"] as? Int == 1)
        let stillPurged = try store.load()
        precondition(stillPurged.reminders.isEmpty && stillPurged.isPurgedOccurrence(id))

        let copied = try await restarted.applyImport(handle: "older-backup", copies: [id], operationID: "copy-purged") {
            IOSPreparedImport(content: bundle)
        }
        precondition(copied["added"] as? Int == 1 && copied["preserved"] as? Int == 0)
        let withCopy = try store.load()
        let copyID = RemiloIOSSeries.namedUUID("copy-purged:\(id)")
        precondition(copyID != id && withCopy.reminders.count == 1 && withCopy.reminders[id] == nil)
        precondition(withCopy.reminders[copyID]?.title == bundle.reminders[id]?.title && withCopy.isPurgedOccurrence(id))
    }

    private static func materializationRespectsOccupiedAndPurgedOccurrenceIDs() async throws {
        let store = FixtureStore()
        defer { store.remove() }
        let now = iosMillis(Date())
        let zone = TimeZone.current
        let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone)
        let tomorrow = try RemiloIOSRoutineAuthoring.date(today, plusDays: 1)
        let routineID = "collision-routine"
        let seriesID = "collision-series"
        let occupiedDate = RemiloIOSSeries.occurrenceID(routineID, today)
        let purgedDate = RemiloIOSSeries.occurrenceID(routineID, tomorrow)
        let version = try RemiloIOSRoutineAuthoring.version(routineDraft(), effectiveDate: today, revision: 1,
                                                          previous: nil, listExists: { _ in false }, imageExists: { _ in false })
        let start = now + 3_600_000
        let utc = TimeZone(secondsFromGMT: 0)!
        let rule = try RemiloIOSRecurrence.Rule(anchor: RemiloIOSSeries.civil(start, zone: utc), frequency: "daily",
                                               zoneID: utc.identifier)
        let slots = try RemiloIOSRecurrence.future(rule, afterMs: now, deviceZone: zone, mode: "None", limit: 4)
        let slotIDs = slots.map { RemiloIOSSeries.occurrenceID(seriesID, $0.nominalSlot) }
        func reminder(_ id: String, title: String) -> IOSReminder {
            IOSReminder(id: id, title: title, notes: "Existing one-off", listID: nil, eventStartMs: start,
                        eventEndMs: start + 1_800_000, dueAtMs: start, alarmAtMs: start, zoneID: utc.identifier,
                        mode: "None", allDay: false, dueLinked: true, alarmLinked: true)
        }
        var seeded = IOSDatabase()
        seeded.routines[routineID] = IOSRoutinePlan(id: routineID, startsOn: today, versions: [version])
        seeded.series[seriesID] = IOSSeriesSegment(id: seriesID, familyID: seriesID, template: reminder("template", title: "Daily"),
                                                  rule: rule, createdAtMs: now)
        seeded.reminders[slotIDs[0]] = reminder(slotIDs[0], title: "Occupied series ID")
        seeded.reminders[occupiedDate] = reminder(occupiedDate, title: "Occupied routine ID")
        seeded.purgedLocalOccurrences = [slotIDs[1], purgedDate]
        try store.save(seeded)

        let engine = store.engine()
        try await engine.reconcile()
        let state = try store.load()
        precondition(state.reminders[slotIDs[0]]?.title == "Occupied series ID" && state.reminders[slotIDs[0]]?.segmentID == nil)
        precondition(state.reminders[slotIDs[1]] == nil && state.reminders[slotIDs[2]]?.segmentID == seriesID)
        precondition(state.reminders[slotIDs[3]]?.segmentID == seriesID)
        precondition(state.reminders[occupiedDate]?.title == "Occupied routine ID" && state.routineSessions[occupiedDate] == nil)
        precondition(state.reminders[purgedDate] == nil && state.routineSessions[purgedDate] == nil)
        let laterDates = try [2, 3].map { try RemiloIOSRoutineAuthoring.date(today, plusDays: $0) }
        precondition(laterDates.allSatisfy { state.routineSessions[RemiloIOSSeries.occurrenceID(routineID, $0)]?.date == $0 })
        let occupiedSession = try await engine.getRoutineSession(routineID, date: today)
        let purgedSession = try await engine.getRoutineSession(routineID, date: tomorrow)
        precondition(occupiedSession == nil && purgedSession == nil)
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
        precondition(updated.reminders["one"]?.calendarLifecycleRevision == 2 && updated.reminders["two"]?.calendarLifecycleRevision == 2)
        precondition(updated.reminders["later"]?.calendarLifecycleRevision == nil)
    }
}
