import CryptoKit
import Foundation

/// All native mutations and delivery reconciliation share this process-owned queue.
@MainActor
final class RemiloIOSEngine {
    static let calendarCreatePrefix = "ios-calendar-import:"
    nonisolated static let calendarInboundPrefix = "ios-calendar-link:"
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

    func apply(_ payload: [String: Any], managedExportScope: ((Bool) -> IOSCalendarExportIntent.Scope?)? = nil) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        do {
            let input = IOSInput(values: payload)
            let kind = try input.text("kind", maximum: 60)
            guard kind != "TestAlarm" else { throw IOSInputFailure("UNSUPPORTED") }
            let operationID = try input.text("operationId", maximum: 200)
            guard !Self.reservedCalendarOperationID(operationID), payload["nativeCalendarAnchor"] == nil,
                  payload["nativeCalendarEndExclusive"] == nil, payload["nativeCalendarExceptions"] == nil else {
                throw IOSInputFailure("UNSUPPORTED")
            }
            return try await execute(input, kind: kind, managedExportScope: managedExportScope)
        } catch let error as IOSInputFailure {
            return error.bridge
        } catch let error as RemiloIOSRecurrence.InvalidRule {
            return IOSInputFailure("INVALID_INPUT", field: error.field).bridge
        }
    }

    /// Native Calendar capture only. The ordinary Expo command entry never
    /// supplies these exact source-derived recurrence bounds and exceptions.
    func applyCalendarCreate(_ payload: [String: Any], authorize: @escaping @MainActor @Sendable () throws -> Bool) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        do {
            let input = IOSInput(values: payload)
            let kind = try input.text("kind", maximum: 60)
            if let recovered = try calendarCreateReceipt(payload) { return recovered }
            try Task.checkCancellation()
            let bounds: (anchor: String, endExclusive: String?)?
            if kind == "CreateSeries" {
                let anchor = try input.text("nativeCalendarAnchor", maximum: 24)
                guard !anchor.isEmpty else { throw input.invalid("nativeCalendarAnchor") }
                let end = payload["nativeCalendarEndExclusive"] == nil || payload["nativeCalendarEndExclusive"] is NSNull
                    ? nil : try input.text("nativeCalendarEndExclusive", maximum: 24)
                bounds = (anchor, end)
            } else {
                guard payload["nativeCalendarAnchor"] == nil, payload["nativeCalendarEndExclusive"] == nil,
                      payload["nativeCalendarExceptions"] == nil else {
                    throw IOSInputFailure("UNSUPPORTED")
                }
                bounds = nil
            }
            _ = try await execute(input, kind: kind, calendarBounds: bounds, calendarPermit: authorize)
            guard let committed = try calendarCreateReceipt(payload) else { throw IOSInputFailure("NOT_FOUND") }
            return committed
        } catch let error as IOSInputFailure {
            return error.bridge
        } catch let error as RemiloIOSRecurrence.InvalidRule {
            return IOSInputFailure("INVALID_INPUT", field: error.field).bridge
        }
    }

    func calendarCreateReceipt(_ payload: [String: Any]) throws -> [String: Any]? {
        let input = IOSInput(values: payload)
        let kind = try input.text("kind", maximum: 60)
        let operationID = try input.text("operationId", maximum: 200)
        guard ["Create", "CreateSeries"].contains(kind), operationID.hasPrefix(Self.calendarCreatePrefix),
              UUID(uuidString: String(operationID.dropFirst(Self.calendarCreatePrefix.count))) != nil else {
            throw IOSInputFailure("UNSUPPORTED")
        }
        let state = try read()
        guard let receipt = state.receipts[operationID] else { return nil }
        guard receipt.fingerprint == (try fingerprint(input)) else { throw IOSInputFailure("OPERATION_REUSED") }
        let stored = try result(from: receipt.result)
        let id: String
        let eligible: Bool
        if kind == "CreateSeries", let segmentID = receipt.seriesSegmentID {
            id = segmentID
            eligible = state.series[segmentID]?.state == "Active" && state.series[segmentID]?.revision == receipt.seriesRevision
        } else if kind == "Create", let occurrenceID = receipt.occurrenceID {
            id = occurrenceID
            let captured = stored["occurrence"] as? [String: Any]
            let record = state.reminders[occurrenceID]
            eligible = record?.active == true && record?.revision == (captured?["revision"] as? Int)
                && record?.generation == (stored["generation"] as? Int)
        } else { throw IOSInputFailure("OPERATION_REUSED") }
        let status = receipt.finalized ? (stored["status"] as? String ?? "Pending") : "Pending"
        return ["status": status, "localId": id, "localKind": kind == "CreateSeries" ? "series" : "reminder",
                "eligibleForLink": eligible]
    }

    func calendarInboundReceipt(operationID: UUID, for snapshot: IOSCalendarOneTimeSnapshot,
                                change: IOSCalendarInboundChange) throws -> [String: Any]? {
        let input = change.input(operationID: operationID, snapshot: snapshot)
        let id = try input.text("operationId", maximum: 200)
        guard let receipt = try read().receipts[id] else { return nil }
        guard receipt.fingerprint == (try fingerprint(input)) else { throw IOSInputFailure("OPERATION_REUSED") }
        return try result(from: receipt.result)
    }

    func applyCalendarInbound(operationID: UUID, for snapshot: IOSCalendarOneTimeSnapshot,
                              change: IOSCalendarInboundChange,
                              authorize: @escaping @MainActor @Sendable () throws -> Bool) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        return try await execute(change.input(operationID: operationID, snapshot: snapshot), kind: "ApplyCalendarInbound",
                                 calendarPermit: authorize, calendarInbound: (snapshot, change))
    }

    func withCalendarPublicationPermit<Value: Sendable>(for snapshot: IOSCalendarOneTimeSnapshot,
                                                          commit: @MainActor @Sendable () throws -> Value) async throws -> Value {
        try await withCalendarOneTimePermit(for: snapshot, purpose: .publication, commit: commit)
    }

    /// Only the synchronous authority check and durable Calendar checkpoint run under this permit.
    func withCalendarOneTimePermit<Value: Sendable>(for snapshot: IOSCalendarOneTimeSnapshot,
                                                    purpose: IOSCalendarOneTimeSnapshot.Purpose,
                                                    commit: @MainActor @Sendable () throws -> Value) async throws -> Value {
        await acquire()
        defer { release() }
        try Task.checkCancellation()
        typealias Failure = IOSCalendarOneTimeSnapshot.Failure
        let current: IOSCalendarOneTimeSnapshot
        do { current = try calendarOneTimeSnapshot(snapshot.occurrenceID, for: purpose) }
        catch is Failure { throw Failure.stalePreview }
        guard current == snapshot else { throw Failure.stalePreview }
        return try commit()
    }

    func calendarLifecycleRevision(_ occurrenceID: String) throws -> Int? {
        guard let record = try read().reminders[occurrenceID], record.id == occurrenceID,
              record.active, record.isCalendarOneTime else { return nil }
        return record.calendarLifecycleRevision ?? 0
    }

    func calendarSeriesTextSnapshot(_ familyID: String) throws -> IOSCalendarSeriesTextSnapshot? {
        Self.calendarSeriesTextSnapshot(familyID, in: try read())
    }

    func calendarSeriesExportSnapshot(_ familyID: String) throws -> IOSCalendarSeriesTextSnapshot? {
        Self.calendarSeriesTextSnapshot(familyID, in: try read(), includeScheduleEdit: true)
    }

    private static func calendarSeriesTextSnapshot(_ familyID: String, in state: IOSDatabase,
                                                    includeScheduleEdit: Bool = false) -> IOSCalendarSeriesTextSnapshot? {
        guard let root = state.series[familyID], root.familyID == familyID,
              state.receipts.contains(where: { $0.key.hasPrefix(calendarCreatePrefix) && $0.value.seriesSegmentID == familyID }) else { return nil }
        let current = state.series.values.filter { $0.familyID == familyID && $0.state != "Archived" }
        guard current.count == 1, let segment = current.first, segment.state == "Active" else { return nil }
        let baseline = root.calendarBaselineRule ?? root.rule
        let edit: IOSCalendarSeriesTextSnapshot.ScheduleEdit?
        if segment.rule.hasSameEventSchedule(as: baseline) {
            edit = nil
        } else {
            guard includeScheduleEdit else { return nil }
            let now = iosMillis(Date())
            let exceptions = state.reminders.values.contains { record in
                guard record.active, record.independent == true, let segmentID = record.segmentID,
                      state.series[segmentID]?.familyID == familyID, record.eventEndMs > now || record.agendaAtMs > now else { return false }
                return record.history.contains { $0.kind == "Edit" || $0.kind == "Create" }
            }
            edit = .init(baseline: baseline, current: segment.rule, hasFutureExceptions: exceptions)
        }
        return .init(familyID: familyID, segmentID: segment.id, revision: segment.revision,
                     title: segment.template.title, notes: segment.template.notes, scheduleEdit: edit)
    }

    func withCalendarSeriesTextPermit<Value: Sendable>(for snapshot: IOSCalendarSeriesTextSnapshot,
                                                       commit: @MainActor @Sendable () throws -> Value) async throws -> Value? {
        await acquire()
        defer { release() }
        try Task.checkCancellation()
        guard try calendarSeriesExportSnapshot(snapshot.familyID) == snapshot else { return nil }
        return try commit()
    }

    func acknowledgeCalendarSeriesExport(_ snapshot: IOSCalendarSeriesTextSnapshot,
                                         authorize: @MainActor @Sendable () throws -> Bool) async throws -> Bool {
        guard let edit = snapshot.scheduleEdit else { return true }
        await acquire()
        defer { release() }
        try Task.checkCancellation()
        var state = try read()
        guard var root = state.series[snapshot.familyID], root.id == root.familyID,
              state.receipts.contains(where: { $0.key.hasPrefix(Self.calendarCreatePrefix) && $0.value.seriesSegmentID == root.id }),
              try authorize() else { return false }
        let current = root.calendarBaselineRule ?? root.rule
        if current.hasSameEventSchedule(as: edit.current) { return true }
        guard current.hasSameEventSchedule(as: edit.baseline) else { return false }
        root.calendarBaselineRule = edit.current
        state.series[root.id] = root
        try commit(state, notify: false)
        return true
    }

    func applyCalendarSeriesText(operationKey: String, snapshot: IOSCalendarSeriesTextSnapshot, title: String, notes: String,
                                 authorize: @MainActor @Sendable () throws -> Bool) async throws -> Bool {
        await acquire()
        defer { release() }
        let operationID = Self.calendarInboundPrefix + "series:" + operationKey
        let input = IOSInput(values: ["operationId": operationID, "familyId": snapshot.familyID, "title": title, "notes": notes])
        let fingerprint = try fingerprint(input)
        var state = try read()
        try Task.checkCancellation()
        let current = Self.calendarSeriesTextSnapshot(snapshot.familyID, in: state)
        if let receipt = state.receipts[operationID] {
            guard receipt.fingerprint == fingerprint else { throw IOSInputFailure("OPERATION_REUSED") }
            guard current?.title == title, current?.notes == notes else { return false }
            return try authorize()
        }
        guard (1...200).contains(title.utf16.count), title == title.trimmingCharacters(in: .whitespacesAndNewlines),
              notes.utf16.count <= 10_000 else { throw IOSInputFailure("INVALID_INPUT") }
        guard current == snapshot,
              var segment = state.series[snapshot.segmentID], try authorize() else { return false }
        if snapshot.title == title && snapshot.notes == notes { return true }

        segment.template.title = title
        segment.template.notes = notes
        segment.revision += 1
        state.series[segment.id] = segment
        let now = iosMillis(Date())
        for (id, var record) in state.reminders where record.segmentID == segment.id && record.active &&
            (record.eventEndMs > now || record.agendaAtMs > now) {
            // Imported exceptions have Create history. Local authored overrides
            // have Edit history. A postponement alone still inherits series text.
            if record.independent == true && record.history.contains(where: { $0.kind == "Create" || $0.kind == "Edit" }) { continue }
            if record.title == snapshot.title { record.title = title }
            if record.notes == snapshot.notes { record.notes = notes }
            guard record.title != state.reminders[id]?.title || record.notes != state.reminders[id]?.notes else { continue }
            record.revision += 1
            state.reminders[id] = record
        }
        state.receipts[operationID] = IOSOperationReceipt(fingerprint: fingerprint, occurrenceID: nil, registrationID: nil,
            result: try JSONSerialization.data(withJSONObject: ["status": "Applied"]), finalized: true)
        try commit(state)
        return true
    }

    func applyCalendarSeriesSchedule(operationKey: String, snapshot: IOSCalendarSeriesTextSnapshot,
                                     change: IOSCalendarSeriesScheduleChange,
                                     authorize: @MainActor @Sendable () throws -> Bool) async throws -> IOSCalendarSeriesScheduleResult {
        await acquire()
        defer { release() }
        let operationID = Self.calendarInboundPrefix + "series-schedule:" + operationKey
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let fingerprint = Data(SHA256.hash(data: try encoder.encode(change)))
        var state = try read()
        try Task.checkCancellation()
        guard try authorize() else { return .deferred }
        let current = Self.calendarSeriesTextSnapshot(snapshot.familyID, in: state)
        if let receipt = state.receipts[operationID] {
            guard receipt.fingerprint == fingerprint, receipt.seriesSegmentID == snapshot.familyID else {
                throw IOSInputFailure("OPERATION_REUSED")
            }
            guard current?.title == change.title, current?.notes == change.notes,
                  state.series[snapshot.familyID]?.calendarBaselineRule?.hasSameEventSchedule(as: change.rule) == true else {
                return .needsReview
            }
            try await drain()
            return .applied
        }
        guard current == snapshot else { return .deferred }
        let now = iosMillis(Date())
        let result = try reconcileCalendarSeriesSchedule(snapshot, change: change, state: &state, now: now)
        guard case .applied = result else { return result }
        try Task.checkCancellation()
        guard try authorize() else { return .deferred }
        state.receipts[operationID] = IOSOperationReceipt(fingerprint: fingerprint, occurrenceID: nil, registrationID: nil,
            seriesSegmentID: snapshot.familyID, result: try JSONSerialization.data(withJSONObject: ["status": "Applied"]), finalized: true)
        try commit(state)
        try await drain()
        return .applied
    }

    func scheduleTestAlarm(operationId: String) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        do {
            guard !Self.reservedCalendarOperationID(operationId) else { throw IOSInputFailure("UNSUPPORTED") }
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
        guard !Self.reservedCalendarOperationID(operationID) else { throw IOSInputFailure("UNSUPPORTED") }
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

    func canOpenAlarmReminderActions(occurrenceID: String, generation: Int, registrationID: UUID?,
                                     now: Int64 = iosMillis(Date())) throws -> Bool {
        guard let record = try read().reminders[occurrenceID], record.active, !record.isTest,
              record.routineID == nil, record.mode == "Alarm", record.generation == generation,
              let registration = record.registration, registration.mode == "Alarm",
              registrationID == nil || registration.systemID == registrationID else { return false }
        // The intent can arrive before reconciliation projects the AlarmKit alerting state.
        return registration.targetMs <= now
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
        _ input: IOSInput, kind: String, loadImport: (() async throws -> IOSPreparedImport)? = nil,
        calendarBounds: (anchor: String, endExclusive: String?)? = nil,
        calendarPermit: (@MainActor @Sendable () throws -> Bool)? = nil,
        calendarInbound: (snapshot: IOSCalendarOneTimeSnapshot, change: IOSCalendarInboundChange)? = nil,
        managedExportScope: ((Bool) -> IOSCalendarExportIntent.Scope?)? = nil
    ) async throws -> [String: Any] {
        let operationID = try input.text("operationId", maximum: 200)
        guard !operationID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw input.invalid("operationId") }
        let fingerprint = try self.fingerprint(input)
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
            var record = try RemiloIOSProjection.draft(draft, id: id, previous: nil, state: state, now: now)
            record.createdAtMs = now
            guard record.mode == "None" || record.alarmAtMs > now else { throw input.invalid("alarmAtMs") }
            record.isTest = kind == "TestAlarm"
            let choice = draft.values["calendarDisposition"] as? String ?? "Default"
            let scope = kind == "Create" && calendarPermit == nil && ["Default", "Managed"].contains(choice)
                ? managedExportScope?(choice == "Managed") : nil
            if choice == "Managed", scope == nil { throw IOSInputFailure("UNSUPPORTED", field: "calendarDisposition") }
            // Commit the intent alongside the reminder, before delivery awaits.
            record.calendarExportIntent = scope.map { .init(operationID: UUID(), scope: $0) }
            record.history.append(IOSHistory(kind: "Create", atMs: now, targetMs: nil))
            replaceRegistration(&record, target: record.alarmAtMs, state: &state, now: now)
            state.reminders[id] = record
            occurrenceID = id
            registrationID = record.registration?.systemID
            applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
        case "ApplyCalendarInbound":
            guard let calendarInbound, calendarPermit != nil else { throw IOSInputFailure("UNSUPPORTED") }
            let projection = try calendarInboundProjection(for: calendarInbound.snapshot, change: calendarInbound.change,
                                                           state: state, now: now)
            var record = projection.record
            if projection.changed {
                record.revision += 1
                record.history.append(IOSHistory(kind: "Edit", atMs: now, targetMs: nil))
                if projection.replacesRegistration {
                    record.adjustment = nil
                    record.retainedAlertMs = nil
                    replaceRegistration(&record, target: record.alarmAtMs, state: &state, now: now)
                    registrationID = record.registration?.systemID
                }
                state.reminders[record.id] = record
            }
            occurrenceID = record.id
            applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
        case "Edit", "Done", "Reopen", "Delete", "UndoDelete", "Skip", "Purge", "CompleteDelivery", "Stop", "DismissDelivery", "Snooze", "Postpone":
            let id = try input.text("occurrenceId", maximum: 200)
            guard var record = state.reminders[id] else { throw IOSInputFailure("NOT_FOUND") }
            if let routineID = record.routineID {
                guard ["Delete", "UndoDelete", "Purge"].contains(kind) else { throw IOSInputFailure("NOT_ELIGIBLE") }
                guard let plan = state.routines[routineID], state.routineSessions[id]?.routineID == routineID else {
                    throw IOSInputFailure("NOT_FOUND")
                }
                guard plan.state != "Trashed" else { throw IOSInputFailure("IN_TRASH") }
            }
            occurrenceID = id
            let schedules = try mutate(&record, kind: kind, input: input, state: &state, now: now)
            if kind == "Purge" {
                state.reminders.removeValue(forKey: id)
                if let routineID = record.routineID {
                    guard let session = state.routineSessions.removeValue(forKey: id), var plan = state.routines[routineID] else {
                        throw IOSInputFailure("NOT_FOUND")
                    }
                    try RemiloIOSPortableContent.excludeRoutineSession(session, from: &plan)
                    state.routines[plan.id] = plan
                    state.purgedLocalOccurrences = (state.purgedLocalOccurrences ?? []).union([id])
                } else if let segmentID = record.segmentID, let nominal = record.nominalSlot {
                    state.excludedOccurrences.insert(id)
                    var exclusions = state.portableExclusions ?? [:]
                    exclusions[id] = IOSPortableExclusion(segmentID: segmentID, nominalSlot: nominal)
                    state.portableExclusions = exclusions
                } else if record.segmentID == nil {
                    // One-off tombstones are local. Portable exclusions require a recurrence slot.
                    state.purgedLocalOccurrences = (state.purgedLocalOccurrences ?? []).union([id])
                }
                try redactReceipts(for: id, state: &state)
                applied = ["status": "Applied", "occurrenceId": id]
            } else {
                state.reminders[id] = record
                if record.routineID != nil && (kind == "Delete" || kind == "UndoDelete") {
                    state.routineSessions[id]?.revision += 1
                }
                registrationID = schedules ? record.registration?.systemID : nil
                applied = result(for: record, state: state, now: now, scheduling: registrationID != nil)
            }
        case "CreateSeries", "EditSeries", "EditFollowing", "PauseSeries", "ResumeSeries":
            let segment = try mutateSeries(kind, input: input, state: &state, now: now, calendarBounds: calendarBounds)
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

        if calendarInbound == nil {
            _ = try replenishSeries(state: &state, now: now)
            _ = try replenishRoutines(state: &state, now: now)
        }
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
        if let calendarPermit {
            try Task.checkCancellation()
            // Calendar connection authority and this durable write share MainActor.
            guard try calendarPermit() else { throw IOSInputFailure("STALE_CONNECTION") }
        }
        try commit(state)
        if calendarInbound == nil || needsDeliveryResult { try await drain() }
        if needsDeliveryResult { return try finalize(operationID) }
        return applied
    }

    private func fingerprint(_ input: IOSInput) throws -> Data {
        guard JSONSerialization.isValidJSONObject(input.values) else { throw input.invalid("operationId") }
        let canonical = try JSONSerialization.data(withJSONObject: input.values, options: [.sortedKeys])
        return Data(SHA256.hash(data: canonical))
    }

    private static func reservedCalendarOperationID(_ id: String) -> Bool {
        id.hasPrefix(calendarCreatePrefix) || id.hasPrefix(calendarInboundPrefix)
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
        var restoredRoutineState: String?
        switch kind {
        case "Edit":
            guard !record.deleted else { throw IOSInputFailure("IN_TRASH") }
            let updated = try RemiloIOSProjection.draft(input, id: record.id, previous: record, state: state, now: now)
            let timeChanged = updated.mode != record.mode || updated.alarmAtMs != record.alarmAtMs
            let soundChanged = (updated.sound ?? "remilo") != (record.sound ?? "remilo")
            changeRegistration = timeChanged || (soundChanged && (record.deferredSeriesOverride != true || record.registration != nil))
            if timeChanged, updated.active, updated.mode != "None", updated.alarmAtMs <= now {
                throw input.invalid("alarmAtMs")
            }
            record = updated
            if record.segmentID != nil { record.independent = true }
            target = timeChanged ? updated.alarmAtMs : updated.nextAlertMs
            if timeChanged {
                adjustment = nil
                record.retainedAlertMs = nil
                record.deferredSeriesOverride = nil
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
            record.deferredSeriesOverride = nil
        case "Delete":
            guard !record.deleted else { throw IOSInputFailure("STALE_REVISION") }
            record.retainedAlertMs = record.nextAlertMs ?? record.retainedAlertMs
            record.deleted = true
        case "UndoDelete":
            guard record.deleted else { throw IOSInputFailure("STALE_REVISION") }
            record.deleted = false
            if record.segmentID != nil { record.independent = true }
            target = record.retainedAlertMs ?? record.alarmAtMs
            if record.active {
                record.retainedAlertMs = nil
                record.deferredSeriesOverride = nil
                if record.mode != "None", let session = state.routineSessions[record.id], let plan = state.routines[session.routineID] {
                    let close = try RemiloIOSRoutineAuthoring.closeAt(session.date, in: .current)
                    if session.ended || now >= close { restoredRoutineState = "Expired" }
                    else if plan.state != "Active" { restoredRoutineState = "Paused" }
                    if restoredRoutineState != nil || (target ?? close) >= close { target = nil }
                }
            }
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
            record.deferredSeriesOverride = nil
            adjustment = "Snoozed"
        case "Postpone":
            let time = try input.integer("alarmAtMs", range: RemiloIOSProjection.epoch)
            guard time > now else { throw input.invalid("alarmAtMs") }
            target = time
            if record.segmentID != nil { record.independent = true }
            record.deferredSeriesOverride = nil
            adjustment = "Postponed"
        default:
            throw IOSInputFailure("UNSUPPORTED")
        }

        if !["Snooze", "Postpone"].contains(kind) { record.revision += 1 }
        if record.isCalendarOneTime, ["Done", "CompleteDelivery", "Stop", "Delete", "Reopen", "UndoDelete"].contains(kind) {
            record.calendarLifecycleRevision = record.revision
            record.calendarExportIntent = nil
        }
        record.history.append(IOSHistory(kind: historyKind, atMs: now, targetMs: target))
        if changeRegistration {
            replaceRegistration(&record, target: target, state: &state, now: now)
            record.adjustment = adjustment
            if kind == "DismissDelivery" { record.deliveryState = "Stopped" }
            if let restoredRoutineState { record.deliveryState = restoredRoutineState }
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
            isTest: record.isTest ? true : nil, sound: record.sound ?? "remilo", isRoutine: record.routineID == nil ? nil : true,
            deferredSeriesOverride: record.deferredSeriesOverride
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
            let source = record.independent == true && record.deferredSeriesOverride != true ? nil : record.routineID ?? record.segmentID
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
        var pendingOverrideCancellation = false
        var operations = 0
        var index = 0
        while index < state.outbox.count && operations < (maximumOperations ?? .max) {
            try Task.checkCancellation()
            let work = state.outbox[index]
            let registration = work.registration
            let id = registration.occurrenceID
            let cancelsFutureOverride = work.action == .cancel && registration.targetMs > now
                && registration.deferredSeriesOverride == true
            if blockedOccurrences.contains(id) {
                pendingOverrideCancellation = pendingOverrideCancellation || cancelsFutureOverride
                index += 1
                continue
            }
            if work.action == .cancel {
                operations += 1
                do {
                    try await RemiloIOSDelivery.cancel(registration)
                } catch {
                    blockedOccurrences.insert(id)
                    pendingOverrideCancellation = pendingOverrideCancellation || cancelsFutureOverride
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
            if pendingOverrideCancellation && registration.deferredSeriesOverride == true {
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
            let includesOverrides = operationID.hasPrefix(Self.calendarCreatePrefix)
            let states = Set(state.reminders.values.lazy.filter {
                $0.segmentID == id && $0.active && $0.registration != nil
                    && ($0.independent != true || (includesOverrides && $0.deferredSeriesOverride == true))
            }.map(\.deliveryState))
            if states.contains("Blocked") { output["status"] = "Blocked" }
            else if states.contains("Pending") { output["status"] = "Pending" }
            else if states.contains("Scheduled") { output["status"] = "Scheduled" }
            else if includesOverrides, state.reminders.values.contains(where: {
                $0.segmentID == id && $0.active && $0.deferredSeriesOverride == true && $0.deliveryState == "Pending"
            }) { output["status"] = "Pending" }
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
