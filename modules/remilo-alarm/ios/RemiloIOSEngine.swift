import CryptoKit
import Foundation

/// All native mutations and delivery reconciliation share this process-owned queue.
@MainActor
final class RemiloIOSEngine {
    static let shared = RemiloIOSEngine(
        imageExists: RemiloIOSExerciseImages.exists,
        collectImages: { try RemiloIOSExerciseMedia.shared.collect(referenced: $0) }
    )

    private var database: IOSDatabase?
    private var busy = false
    private var waiting: [CheckedContinuation<Void, Never>] = []
    private let loadDatabase: () throws -> IOSDatabase
    private let saveDatabase: (IOSDatabase) throws -> Void
    let imageExists: (String) -> Bool
    private let collectImages: (Set<String>) throws -> Void

    init(
        loadDatabase: @escaping () throws -> IOSDatabase = IOSStore.read,
        saveDatabase: @escaping (IOSDatabase) throws -> Void = IOSStore.write,
        imageExists: @escaping (String) -> Bool = { _ in false },
        collectImages: @escaping (Set<String>) throws -> Void = { _ in }
    ) {
        self.loadDatabase = loadDatabase
        self.saveDatabase = saveDatabase
        self.imageExists = imageExists
        self.collectImages = collectImages
    }

    func apply(_ payload: [String: Any]) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        do {
            let input = IOSInput(values: payload)
            let kind = try input.text("kind", maximum: 60)
            guard kind != "TestAlarm" else { throw IOSInputFailure("UNSUPPORTED") }
            return try await execute(input, kind: kind)
        } catch let error as IOSInputFailure {
            return error.bridge
        } catch let error as RemiloIOSRecurrence.InvalidRule {
            return IOSInputFailure("INVALID_INPUT", field: error.field).bridge
        }
    }

    func scheduleTestAlarm(operationId: String) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        do {
            return try await execute(IOSInput(values: ["kind": "TestAlarm", "operationId": operationId]), kind: "TestAlarm")
        } catch let error as IOSInputFailure {
            return error.bridge
        }
    }

    func applyImport(
        handle: String, copies: [String], operationID: String,
        load: @escaping () async throws -> IOSPreparedImport
    ) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        return try await execute(
            IOSInput(values: ["kind": "Import", "operationId": operationID, "handle": handle, "copyIds": copies.sorted()]),
            kind: "Import", loadImport: load
        )
    }

    func performSystemAction(kind: String, occurrenceID: String, generation: Int) async throws {
        guard ["CompleteDelivery", "DismissDelivery", "Snooze"].contains(kind) else { return }
        let result = try await apply([
            "kind": kind, "occurrenceId": occurrenceID, "expectedGeneration": generation,
            "operationId": "ios-delivery:\(kind):\(occurrenceID):\(generation)",
        ])
        if result["status"] as? String == "Rejected",
           !["STALE_GENERATION", "NOT_FOUND", "NOT_ELIGIBLE"].contains(result["errorCode"] as? String ?? "") {
            throw IOSInputFailure(result["errorCode"] as? String ?? "INVALID_INPUT")
        }
    }

    func performRoutineDelivery(kind: String, occurrenceID: String, generation: Int) async throws -> [String: Any] {
        guard ["StartRoutineDelivery", "DismissRoutineDelivery"].contains(kind) else { throw IOSInputFailure("UNSUPPORTED") }
        let result = try await apply([
            "kind": kind, "occurrenceId": occurrenceID, "expectedGeneration": generation,
            "operationId": "ios-delivery:\(kind):\(occurrenceID):\(generation)",
        ])
        if result["status"] as? String == "Rejected",
           !["STALE_GENERATION", "NOT_FOUND", "NOT_ELIGIBLE"].contains(result["errorCode"] as? String ?? "") {
            throw IOSInputFailure(result["errorCode"] as? String ?? "INVALID_INPUT")
        }
        return result
    }

    func reconcile(maximumDeliveryOperations: Int? = nil) async throws {
        await acquire()
        defer { release() }
        try Task.checkCancellation()
        var state = try read()
        let now = iosMillis(Date())
        let updatedSeries = try replenishSeries(state: &state, now: now)
        let updatedRoutines = try replenishRoutines(state: &state, now: now)
        try Task.checkCancellation()
        let observed = try? await RemiloIOSDelivery.observedStates()
        try Task.checkCancellation()
        let queued = Set(state.outbox.filter { $0.action == .register }.map { $0.registration.systemID })
        if let observed {
            for record in state.reminders.values where record.active {
                if let registration = record.registration, observed[registration.systemID] == nil,
                   !queued.contains(registration.systemID), registration.targetMs > now {
                    state.outbox.append(IOSDeliveryWork(action: .register, registration: registration))
                }
            }
        }
        if updatedSeries || updatedRoutines || state.outbox.count != database?.outbox.count {
            try commit(state, notify: updatedSeries || updatedRoutines)
        }
        try await drain(maximumOperations: maximumDeliveryOperations)
        if let observed { try observeElapsed(now: now, observed: observed) }
        if maximumDeliveryOperations == nil { try? collectImages(state.referencedImages) }
    }

    func query(_ filter: [String: Any], cursor: String?) throws -> [String: Any] {
        RemiloIOSProjection.query(filter, cursor: cursor, state: try read(), now: iosMillis(Date()))
    }

    func occurrence(_ id: String) throws -> [String: Any]? {
        let state = try read()
        guard let record = state.reminders[id], !record.isTest else { return nil }
        return RemiloIOSProjection.occurrence(
            record, state: state, now: iosMillis(Date()), calendar: RemiloIOSProjection.localCalendar, includeHistory: true
        )
    }

    func settings() throws -> [String: Any] { try read().settings.bridge }

    func lists() throws -> [[String: Any]] {
        let state = try read()
        let now = iosMillis(Date())
        return state.lists.values.sorted { a, b in
            let order = a.name.localizedCaseInsensitiveCompare(b.name)
            return order == .orderedSame ? a.id < b.id : order == .orderedAscending
        }.map { RemiloIOSProjection.list($0, state: state, now: now) }
    }

    func preview(_ draft: [String: Any]) throws -> [String: Any] {
        let state = try read()
        // The editor can preview dates while its title field is still empty.
        var fields = draft
        fields["title"] = "Remilo"
        let now = iosMillis(Date())
        let record = try RemiloIOSProjection.draft(IOSInput(values: fields), id: "", previous: nil, state: state, now: now)
        var upcoming: [[String: Any]] = []
        if let recurrence = draft["recurrence"] as? [String: Any] {
            let rule = try RemiloIOSSeries.rule(for: record, spec: recurrence)
            upcoming = try RemiloIOSRecurrence.future(rule, afterMs: now, deviceZone: .current, mode: record.mode, limit: 3)
                .map(RemiloIOSSeries.slotProjection)
        } else if draft["recurrence"] != nil && !(draft["recurrence"] is NSNull) {
            throw IOSInputFailure("INVALID_INPUT", field: "recurrence")
        }
        return [
            "eventStartMs": record.eventStartMs, "eventEndMs": record.eventEndMs,
            "dueAtMs": record.dueAtMs, "alarmAtMs": record.alarmAtMs,
            "warnings": [String](), "upcoming": upcoming,
        ]
    }

    private func acquire() async {
        if !busy {
            busy = true
            return
        }
        await withCheckedContinuation { waiting.append($0) }
    }

    private func release() {
        if waiting.isEmpty { busy = false }
        else { waiting.removeFirst().resume() }
    }

    func read() throws -> IOSDatabase {
        if let database { return database }
        let state = try loadDatabase()
        database = state
        return state
    }

    private func commit(_ state: IOSDatabase, notify: Bool = true) throws {
        try saveDatabase(state)
        database = state
        if notify { NotificationCenter.default.post(name: .remiloIOSChange, object: nil) }
    }

    private func execute(
        _ input: IOSInput, kind: String, loadImport: (() async throws -> IOSPreparedImport)? = nil
    ) async throws -> [String: Any] {
        let operationID = try input.text("operationId", maximum: 200)
        guard !operationID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw input.invalid("operationId") }
        guard JSONSerialization.isValidJSONObject(input.values) else { throw input.invalid("operationId") }
        let canonical = try JSONSerialization.data(withJSONObject: input.values, options: [.sortedKeys])
        let fingerprint = Data(SHA256.hash(data: canonical))
        var state = try read()
        if let receipt = state.receipts[operationID] {
            guard receipt.fingerprint == fingerprint else { throw IOSInputFailure("OPERATION_REUSED") }
            if !receipt.finalized {
                try await drain()
                return try finalize(operationID)
            }
            return try result(from: receipt.result)
        }

        let now = iosMillis(Date())
        let applied: [String: Any]
        var occurrenceID: String?
        var registrationID: UUID?
        var seriesSegmentID: String?
        var imported: RemiloIOSPortableContent.Bundle?
        var groupRegistrationIDs: [String: UUID]?
        switch kind {
        case "Create", "TestAlarm":
            let id = UUID().uuidString
            var draft = input
            if kind == "TestAlarm" {
                draft = IOSInput(values: ["title": "Remilo", "alarmAtMs": now + 15_000])
            }
            guard draft.values["recurrence"] == nil || draft.values["recurrence"] is NSNull else {
                throw IOSInputFailure("UNSUPPORTED", field: "recurrence")
            }
            if let disposition = draft.values["calendarDisposition"] as? String, disposition == "Managed" {
                throw IOSInputFailure("UNSUPPORTED", field: "calendarDisposition")
            }
            var record = try RemiloIOSProjection.draft(draft, id: id, previous: nil, state: state, now: now)
            record.createdAtMs = now
            guard record.mode == "None" || record.alarmAtMs > now else { throw input.invalid("alarmAtMs") }
            record.isTest = kind == "TestAlarm"
            record.history.append(IOSHistory(kind: "Create", atMs: now, targetMs: nil))
            replaceRegistration(&record, target: record.alarmAtMs, state: &state, now: now)
            state.reminders[id] = record
            occurrenceID = id
            registrationID = record.registration?.systemID
            applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
        case "Edit", "Done", "Reopen", "Delete", "UndoDelete", "Skip", "Purge", "CompleteDelivery", "Stop", "DismissDelivery", "Snooze", "Postpone":
            let id = try input.text("occurrenceId", maximum: 200)
            guard var record = state.reminders[id] else { throw IOSInputFailure("NOT_FOUND") }
            guard record.routineID == nil else { throw IOSInputFailure("NOT_ELIGIBLE") }
            occurrenceID = id
            let schedules = try mutate(&record, kind: kind, input: input, state: &state, now: now)
            if kind == "Purge" {
                state.reminders.removeValue(forKey: id)
                if let segmentID = record.segmentID, let nominal = record.nominalSlot {
                    state.excludedOccurrences.insert(id)
                    var exclusions = state.portableExclusions ?? [:]
                    exclusions[id] = IOSPortableExclusion(segmentID: segmentID, nominalSlot: nominal)
                    state.portableExclusions = exclusions
                }
                try redactReceipts(for: id, state: &state)
                applied = ["status": "Applied", "occurrenceId": id]
            } else {
                state.reminders[id] = record
                registrationID = schedules ? record.registration?.systemID : nil
                applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
            }
        case "CreateSeries", "EditSeries", "EditFollowing", "PauseSeries", "ResumeSeries":
            let segment = try mutateSeries(kind, input: input, state: &state, now: now)
            seriesSegmentID = segment.id
            applied = ["status": "Applied", "segmentId": segment.id]
        case "CreateRoutine", "EditRoutine", "PauseRoutine", "ResumeRoutine", "TrashRoutine", "RestoreRoutine", "PurgeRoutine":
            applied = try mutateRoutinePlan(kind, input: input, state: &state, now: now)
            occurrenceID = (applied["routine"] as? [String: Any])?["id"] as? String ?? (applied["occurrenceId"] as? String)
        case "SetRoutineExercise", "CorrectRoutineExercise", "SkipRoutineDay", "UndoSkipRoutineDay":
            applied = try mutateRoutineDay(kind, input: input, state: &state, now: now)
            occurrenceID = input.values["occurrenceId"] as? String
        case "StartRoutineDelivery", "DismissRoutineDelivery":
            applied = try mutateRoutineDelivery(kind, input: input, state: &state, now: now)
            occurrenceID = input.values["occurrenceId"] as? String
        case "DismissRoutineAlarm", "SnoozeRoutineAlarm":
            let record = try mutateRoutineAlarm(kind, input: input, state: &state, now: now)
            occurrenceID = record.id
            registrationID = record.registration?.systemID
            applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
        case "CreateList", "RenameList", "RemoveList":
            applied = try mutateList(kind, input: input, state: &state, now: now)
        case "Settings":
            try mutateSettings(input, state: &state)
            applied = ["status": "Applied"]
        case "DoneAll", "StopAll", "SnoozeAll", "PostponeAll":
            let observed = try await RemiloIOSDelivery.observedStates()
            let group = try mutateDeliveryGroup(kind, input: input, state: &state, now: now, observed: observed)
            applied = group.result
            groupRegistrationIDs = group.registrations
        case "Import":
            guard let loadImport, let copies = input.values["copyIds"] as? [String] else {
                throw IOSInputFailure("UNSUPPORTED")
            }
            let prepared = try await loadImport()
            let plan = try RemiloIOSPortableContent.planImport(
                prepared.content, against: state, copyIDs: Set(copies), operationID: operationID
            )
            let images = iosRoutineImageIDs(plan.additions.routines, plan.additions.routineSessions)
            try await prepared.installImages?(images)
            mergeImport(plan.additions, state: &state, now: now)
            imported = plan.additions
            applied = ["status": "Applied", "added": plan.added, "preserved": plan.preserved]
        default:
            throw IOSInputFailure("UNSUPPORTED")
        }

        _ = try replenishSeries(state: &state, now: now)
        _ = try replenishRoutines(state: &state, now: now)
        let importRegistrationIDs = imported.map { additions in
            Set(state.reminders.values.compactMap { record in
                let included = additions.reminders[record.id] != nil
                    || record.segmentID.map { additions.series[$0] != nil } == true
                    || record.routineID.map { additions.routines[$0] != nil } == true
                return included ? record.registration?.systemID : nil
            })
        }
        let needsDeliveryResult = registrationID != nil || seriesSegmentID != nil
            || importRegistrationIDs != nil || groupRegistrationIDs != nil
        state.receipts[operationID] = IOSOperationReceipt(
            fingerprint: fingerprint, occurrenceID: occurrenceID, registrationID: registrationID,
            seriesSegmentID: seriesSegmentID, seriesRevision: seriesSegmentID.flatMap { state.series[$0]?.revision },
            importRegistrationIDs: importRegistrationIDs, groupRegistrationIDs: groupRegistrationIDs,
            result: try JSONSerialization.data(withJSONObject: applied), finalized: !needsDeliveryResult
        )
        try commit(state)
        try await drain()
        if needsDeliveryResult { return try finalize(operationID) }
        return applied
    }

    func mutate(
        _ record: inout IOSReminder, kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64
    ) throws -> Bool {
        let deliveryAction = ["CompleteDelivery", "Stop", "DismissDelivery", "Snooze", "Postpone"].contains(kind)
        if deliveryAction {
            let expected = try input.integer("expectedGeneration", range: 0...Int64.max)
            guard record.active, record.mode != "None", record.generation == expected else {
                throw IOSInputFailure("STALE_GENERATION")
            }
        } else {
            let expected = try input.integer("expectedRevision", range: 0...Int64.max)
            guard !record.isTest, record.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
        }
        var target: Int64?
        var changeRegistration = true
        var historyKind = kind
        var adjustment = record.adjustment
        switch kind {
        case "Edit":
            guard !record.deleted else { throw IOSInputFailure("IN_TRASH") }
            let updated = try RemiloIOSProjection.draft(input, id: record.id, previous: record, state: state, now: now)
            let timeChanged = updated.mode != record.mode || updated.alarmAtMs != record.alarmAtMs
            changeRegistration = timeChanged || (updated.sound ?? "remilo") != (record.sound ?? "remilo")
            if timeChanged, updated.active, updated.mode != "None", updated.alarmAtMs <= now {
                throw input.invalid("alarmAtMs")
            }
            record = updated
            if record.segmentID != nil { record.independent = true }
            target = timeChanged ? updated.alarmAtMs : updated.nextAlertMs
            if timeChanged {
                adjustment = nil
                record.retainedAlertMs = nil
            }
        case "Done", "CompleteDelivery", "Stop":
            guard record.active else { throw IOSInputFailure("STALE_REVISION") }
            record.retainedAlertMs = record.nextAlertMs ?? record.retainedAlertMs
            record.completed = true
            historyKind = "Done"
        case "DismissDelivery":
            guard (record.nextAlertMs ?? record.alarmAtMs) <= now else { throw IOSInputFailure("NOT_ELIGIBLE") }
            record.retainedAlertMs = record.nextAlertMs ?? record.retainedAlertMs
            historyKind = "Stop"
        case "Reopen":
            guard (record.completed || record.skipped == true), !record.deleted else { throw IOSInputFailure("STALE_REVISION") }
            record.completed = false
            record.skipped = false
            if record.segmentID != nil { record.independent = true }
            target = record.retainedAlertMs ?? record.alarmAtMs
            record.retainedAlertMs = nil
        case "Delete":
            guard !record.deleted else { throw IOSInputFailure("STALE_REVISION") }
            record.retainedAlertMs = record.nextAlertMs ?? record.retainedAlertMs
            record.deleted = true
        case "UndoDelete":
            guard record.deleted else { throw IOSInputFailure("STALE_REVISION") }
            record.deleted = false
            if record.segmentID != nil { record.independent = true }
            target = record.retainedAlertMs ?? record.alarmAtMs
            if record.active { record.retainedAlertMs = nil }
        case "Skip":
            guard record.segmentID != nil, record.active else { throw IOSInputFailure("STALE_REVISION") }
            record.retainedAlertMs = record.nextAlertMs ?? record.retainedAlertMs
            record.skipped = true
        case "Purge":
            guard record.deleted else { throw IOSInputFailure("STALE_REVISION") }
        case "Snooze":
            if input.values["expectedSnoozeMinutes"] != nil {
                let expected = try input.integer("expectedSnoozeMinutes", range: 1...1_440)
                guard state.settings.snoozeMinutes == expected else { throw IOSInputFailure("STALE_GENERATION") }
            }
            target = now + Int64(state.settings.snoozeMinutes) * 60_000
            if record.segmentID != nil { record.independent = true }
            adjustment = "Snoozed"
        case "Postpone":
            let time = try input.integer("alarmAtMs", range: RemiloIOSProjection.epoch)
            guard time > now else { throw input.invalid("alarmAtMs") }
            target = time
            if record.segmentID != nil { record.independent = true }
            adjustment = "Postponed"
        default:
            throw IOSInputFailure("UNSUPPORTED")
        }

        if !["Snooze", "Postpone"].contains(kind) { record.revision += 1 }
        record.history.append(IOSHistory(kind: historyKind, atMs: now, targetMs: target))
        if changeRegistration {
            replaceRegistration(&record, target: target, state: &state, now: now)
            record.adjustment = adjustment
            if kind == "DismissDelivery" { record.deliveryState = "Stopped" }
        }
        return changeRegistration && record.registration != nil
    }

    func replaceRegistration(_ record: inout IOSReminder, target: Int64?, state: inout IOSDatabase, now: Int64) {
        if let previous = record.registration {
            state.outbox.removeAll { $0.action == .register && $0.registration.systemID == previous.systemID }
            state.outbox.append(IOSDeliveryWork(action: .cancel, registration: previous))
        }
        record.generation += 1
        record.registration = nil
        record.nextAlertMs = nil
        if record.deleted { record.deliveryState = "Deleted"; return }
        if record.completed { record.deliveryState = "Completed"; return }
        if record.skipped == true { record.deliveryState = "Skipped"; return }
        if record.mode == "None" { record.deliveryState = "NoAlert"; return }
        guard let target, target > now else {
            record.deliveryState = "Missed"
            return
        }
        let registration = IOSReminderRegistration(
            occurrenceID: record.id, generation: record.generation, systemID: UUID(),
            targetMs: target, mode: record.mode, language: deliveryLanguage(state.settings.language),
            isTest: record.isTest ? true : nil, sound: record.sound ?? "remilo", isRoutine: record.routineID == nil ? nil : true
        )
        record.registration = registration
        record.nextAlertMs = target
        record.deliveryState = "Pending"
        state.outbox.append(IOSDeliveryWork(action: .register, registration: registration))
    }

    private func deliveryLanguage(_ language: String) -> String {
        if language == "zh-Hans" || language == "en" { return language }
        let preferred = Bundle.preferredLocalizations(from: ["en", "zh-Hans"]).first
        return preferred == "zh-Hans" ? "zh-Hans" : "en"
    }

    @discardableResult
    private func drain(maximumOperations: Int? = nil) async throws -> Int {
        var state = try read()
        let now = iosMillis(Date())
        let notifications = state.reminders.values.compactMap { record -> RemiloIOSCoverage.Candidate? in
            guard record.active, let delivery = record.registration, delivery.mode == "Notification",
                  delivery.targetMs > now else { return nil }
            let source = record.independent == true ? nil : record.routineID ?? record.segmentID
            return RemiloIOSCoverage.Candidate(
                occurrenceID: record.id, targetMs: delivery.targetMs, rollingSourceID: source,
                retain: record.deliveryState == "Scheduled"
            )
        }
        // Leave headroom below the OS's observed pending-request capacity.
        let admitted = RemiloIOSCoverage.admitted(notifications, limit: 48, now: now)
        state.outbox.sort { lhs, rhs in
            if lhs.action != rhs.action { return lhs.action == .cancel }
            return (lhs.registration.targetMs, lhs.registration.systemID.uuidString)
                < (rhs.registration.targetMs, rhs.registration.systemID.uuidString)
        }
        var blockedOccurrences = Set<String>()
        var operations = 0
        var index = 0
        while index < state.outbox.count && operations < (maximumOperations ?? .max) {
            try Task.checkCancellation()
            let work = state.outbox[index]
            let registration = work.registration
            let id = registration.occurrenceID
            if blockedOccurrences.contains(id) { index += 1; continue }
            if work.action == .cancel {
                operations += 1
                do {
                    try await RemiloIOSDelivery.cancel(registration)
                } catch {
                    blockedOccurrences.insert(id)
                    index += 1
                    continue
                }
                state.outbox.remove(at: index)
                try commit(state, notify: false)
                continue
            }

            guard var record = state.reminders[id], record.active,
                  record.registration?.systemID == registration.systemID else {
                state.outbox.remove(at: index)
                try commit(state, notify: false)
                continue
            }
            if registration.mode == "Notification", registration.targetMs > now, !admitted.contains(id) {
                index += 1
                continue
            }
            var removeWork = true
            operations += 1
            do {
                try await RemiloIOSDelivery.register(registration)
                record.deliveryState = "Scheduled"
            } catch IOSDeliveryFailure.elapsed {
                record.deliveryState = record.deliveryState == "Blocked" ? "Missed" : "DeliveryUnconfirmed"
                record.nextAlertMs = nil
            } catch IOSDeliveryFailure.denied {
                let future = registration.targetMs > iosMillis(Date())
                record.deliveryState = future ? "Blocked" : "Missed"
                if !future { record.nextAlertMs = nil }
                removeWork = !future
            } catch {
                let future = registration.targetMs > iosMillis(Date())
                record.deliveryState = future ? "Pending" : "Missed"
                if !future { record.nextAlertMs = nil }
                removeWork = !future
            }
            let changed = record.deliveryState != state.reminders[id]?.deliveryState
            state.reminders[id] = record
            if removeWork { state.outbox.remove(at: index) }
            else { index += 1 }
            if changed || removeWork { try commit(state, notify: changed) }
        }
        return operations
    }

    private func observeElapsed(now: Int64, observed: [UUID: String]) throws {
        var state = try read()
        var changed = false
        for (id, var record) in state.reminders where record.active {
            guard let registration = record.registration, registration.targetMs <= now,
                  ["Scheduled", "Alerting"].contains(record.deliveryState) else { continue }
            let outcome = observed[registration.systemID] ?? (record.deliveryState == "Alerting" ? "Interrupted" : "DeliveryUnconfirmed")
            guard outcome != record.deliveryState else { continue }
            record.deliveryState = outcome
            if outcome != "Scheduled" && outcome != "Alerting" { record.nextAlertMs = nil }
            state.reminders[id] = record
            changed = true
        }
        if changed { try commit(state) }
    }

    private func finalize(_ operationID: String) throws -> [String: Any] {
        var state = try read()
        guard var receipt = state.receipts[operationID] else { throw IOSInputFailure("NOT_FOUND") }
        var output = try result(from: receipt.result)
        if !receipt.finalized, let id = receipt.occurrenceID, let record = state.reminders[id],
           let systemID = receipt.registrationID, record.registration?.systemID == systemID {
            // Keep the captured occurrence revision and authored fields stable across retries.
            output["status"] = commandStatus(record)
            if var occurrence = output["occurrence"] as? [String: Any] {
                occurrence["deliveryState"] = record.deliveryState
                occurrence["nextAlertMs"] = iosBridgeValue(record.nextAlertMs)
                output["occurrence"] = occurrence
            }
        }
        if !receipt.finalized, let id = receipt.seriesSegmentID, let segment = state.series[id],
           segment.revision == receipt.seriesRevision {
            let states = Set(state.reminders.values.lazy.filter {
                $0.segmentID == id && $0.independent != true && $0.active && $0.registration != nil
            }.map(\.deliveryState))
            if states.contains("Blocked") { output["status"] = "Blocked" }
            else if states.contains("Pending") { output["status"] = "Pending" }
            else if states.contains("Scheduled") { output["status"] = "Scheduled" }
        }
        if !receipt.finalized, let ids = receipt.importRegistrationIDs {
            output["blocked"] = state.reminders.values.filter {
                guard let registration = $0.registration, ids.contains(registration.systemID) else { return false }
                return !["Scheduled", "Alerting", "Notified"].contains($0.deliveryState)
            }.count
        }
        if !receipt.finalized, let ids = receipt.groupRegistrationIDs {
            output = finalizeDeliveryGroup(output, registrations: ids, state: state)
        }
        receipt.result = try JSONSerialization.data(withJSONObject: output)
        receipt.finalized = true
        state.receipts[operationID] = receipt
        try commit(state, notify: false)
        return output
    }

    private func commandStatus(_ record: IOSReminder) -> String {
        switch record.deliveryState {
        case "Scheduled", "Blocked", "Pending": record.deliveryState
        case "Missed", "DeliveryUnconfirmed": "Blocked"
        default: "Applied"
        }
    }

    private func result(for record: IOSReminder, state: IOSDatabase, now: Int64, scheduling: Bool) -> [String: Any] {
        [
            "status": scheduling ? commandStatus(record) : "Applied",
            "occurrenceId": record.id, "generation": record.generation,
            "occurrence": RemiloIOSProjection.occurrence(record, state: state, now: now, calendar: RemiloIOSProjection.localCalendar),
        ]
    }

    private func result(from data: Data) throws -> [String: Any] {
        guard let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return result
    }

    func redactReceipts(for id: String, state: inout IOSDatabase) throws {
        for (operationID, var receipt) in state.receipts where receipt.occurrenceID == id {
            var output = try result(from: receipt.result)
            output.removeValue(forKey: "occurrence")
            output.removeValue(forKey: "routine")
            output.removeValue(forKey: "routineSession")
            receipt.result = try JSONSerialization.data(withJSONObject: output)
            receipt.finalized = true
            state.receipts[operationID] = receipt
        }
    }

    private func mutateList(_ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64) throws -> [String: Any] {
        let id = kind == "CreateList" ? UUID().uuidString : try input.text("listId", maximum: 200)
        var list = IOSList(id: id, name: "")
        if kind != "CreateList" {
            guard let current = state.lists[id] else { throw IOSInputFailure("NOT_FOUND") }
            let expected = try input.integer("expectedRevision", range: 0...Int64.max)
            guard current.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
            list = current
            list.revision += 1
        }
        if kind == "RemoveList" {
            state.lists.removeValue(forKey: id)
            for (key, var reminder) in state.reminders where reminder.listID == id {
                reminder.listID = nil
                reminder.revision += 1
                state.reminders[key] = reminder
            }
            for (key, var segment) in state.series where segment.template.listID == id {
                segment.template.listID = nil
                segment.revision += 1
                state.series[key] = segment
            }
            for (key, var plan) in state.routines {
                let matching = plan.versions.indices.filter { plan.versions[$0].listID == id }
                guard !matching.isEmpty else { continue }
                for index in matching { plan.versions[index].listID = nil }
                plan.revision += 1
                state.routines[key] = plan
            }
            return ["status": "Applied", "list": NSNull()]
        }
        let name = try input.text("name", maximum: 200).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !state.lists.values.contains(where: {
            $0.id != id && $0.name.caseInsensitiveCompare(name) == .orderedSame
        }) else { throw input.invalid("name") }
        list.name = name
        state.lists[id] = list
        return ["status": "Applied", "list": RemiloIOSProjection.list(list, state: state, now: now)]
    }

    private func mutateSettings(_ input: IOSInput, state: inout IOSDatabase) throws {
        var settings = state.settings
        let expected = try input.integer("expectedRevision", range: 0...Int64.max)
        guard settings.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
        settings.snoozeMinutes = Int(try input.integer("snoozeMinutes", fallback: Int64(settings.snoozeMinutes), range: 1...1_440))
        settings.tomorrowMorning = Int(try input.integer("tomorrowMorning", fallback: Int64(settings.tomorrowMorning), range: 0...1_439))
        settings.tomorrowAfternoon = Int(try input.integer("tomorrowAfternoon", fallback: Int64(settings.tomorrowAfternoon), range: 0...1_439))
        settings.tomorrowEvening = Int(try input.integer("tomorrowEvening", fallback: Int64(settings.tomorrowEvening), range: 0...1_439))
        settings.theme = try input.choice("theme", fallback: settings.theme, from: ["system", "light", "dark"])
        settings.atmosphere = try input.choice("atmosphere", fallback: settings.atmosphere, from: ["automatic", "sunrise", "sky", "evening", "night"])
        settings.language = try input.choice("language", fallback: settings.language, from: ["system", "en", "zh-Hans"])
        settings.sound = try input.choice("sound", fallback: settings.alertSound, from: ["remilo", "system"])
        if input.values["vibration"] as? Bool == true {
            throw IOSInputFailure("UNSUPPORTED")
        }
        settings.revision += 1
        state.settings = settings
    }
}
