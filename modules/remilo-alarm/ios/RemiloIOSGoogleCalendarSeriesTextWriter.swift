import Foundation

/// The local import baseline identifies unsent work. Once a PATCH can leave
/// the device, keep its exact request until read-back or a definitive result.
@MainActor
final class RemiloIOSGoogleCalendarSeriesTextWriter {
    typealias Runtime = RemiloIOSGoogleCalendarRuntime
    typealias Import = Runtime.Import
    typealias Journal = Runtime.ImportJournal
    typealias Failure = Runtime.Failure
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Lease = RemiloIOSGoogleCalendarManualLink.ManagedLease
    typealias Account = Import.Account

    private struct Send: Codable, Equatable, Sendable {
        let id: UUID
        let importID: UUID
        let account: Account
        let lease: Lease
        let baselineETag: String
        let source: Import.Source
        let local: IOSCalendarSeriesTextSnapshot
        var desiredSchedule: Import.Event.Schedule? = nil

        func patch() throws -> Writer.Patch {
            try .init(series: id, account: account, snapshot: local, source: source, lease: lease,
                      desiredSchedule: desiredSchedule)
        }

        var desiredFields: Import.Event.Fields {
            .init(title: local.title, notes: local.notes, schedule: desiredSchedule ?? source.fields.schedule)
        }
    }

    private struct InstanceSend: Codable, Equatable, Sendable {
        enum Outcome: Codable, Equatable, Sendable {
            case confirmed(String), review(String)
        }

        let id: UUID
        let account: Account
        let binding: Journal.SeriesInstanceExport
        let observed: Writer.InstanceObservation
        let edit: IOSCalendarSeriesInstanceEdit
        let desired: Import.Event.Fields
        var outcome: Outcome? = nil

        var importID: UUID { binding.receipt.operationID }

        func patch() throws -> Writer.Patch {
            try .init(instance: id, account: account, local: .init(occurrenceID: edit.occurrenceID,
                revision: edit.revision, generation: edit.generation), observed: observed, lease: binding.lease, desired: desired)
        }
    }

    private struct State: Codable {
        var version = 1
        var sent: [UUID: Send] = [:]
        var instances: [UUID: InstanceSend]? = nil
    }

    private let directory: URL
    private let connection: Runtime.Connection
    private let imports: Journal
    private let local: Runtime.SeriesTextAuthority
    private let canRead: @MainActor @Sendable () -> Bool
    private let activeLease: @MainActor @Sendable (Account) throws -> Lease?
    private var running = false
    private var readbackCursor: String?
    private var instanceReadbackCursor: String?
    private var instanceSendCursor: String?
    var isRunning: Bool { running }

    init(directory: URL, connection: Runtime.Connection, imports: Journal, local: Runtime.SeriesTextAuthority,
         canRead: @escaping @MainActor @Sendable () -> Bool,
         activeLease: @escaping @MainActor @Sendable (Account) throws -> Lease?) {
        self.directory = directory
        self.connection = connection
        self.imports = imports
        self.local = local
        self.canRead = canRead
        self.activeLease = activeLease
    }

    func unconfirmedImports(viewingAs account: Account) throws -> Set<UUID> {
        let masters = try savedSends(viewingAs: account).map(\.importID)
        let instances = try savedInstances(viewingAs: account)
            .filter { $0.account.accountGeneration == account.accountGeneration }.map(\.importID)
        return Set(masters + instances)
    }

    func sync(expectedRevision: Int) async throws -> Bool {
        guard canRead(), !running else { return false }
        running = true
        defer { running = false }
        let account = try connection.savedAccount(expectedRevision: expectedRevision)
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var changed = false
        if let instanceExport = local.instanceExport {
            changed = try await recoverInstances(account, authority: instanceExport, budget: budget)
        }
        let pending = try savedSends(viewingAs: account)
        let start = readbackCursor.flatMap { cursor in pending.firstIndex { $0.importID.uuidString > cursor } } ?? 0
        for offset in 0..<min(pending.count, 4) {
            guard canRead(), budget.hasTimeRemaining else { break }
            let work = pending[(start + offset) % pending.count]
            readbackCursor = work.importID.uuidString
            do {
                let settled = try await advance(work, viewer: account, phase: .sent, budget: budget)
                changed = changed || settled
            } catch Failure.budget { return changed }
            catch is Failure { continue }
        }
        guard canRead(), budget.hasTimeRemaining, let lease = try activeLease(account),
              (try? connection.requireManualLinkWrite(account: account)) != nil else { return changed }
        let reserved = try read()
        var attempted = 0
        let readLocal = local.readForExport ?? local.read
        for binding in try await imports.seriesTextExports(viewingAs: account, lease: lease) {
            guard attempted < 4, canRead(), budget.hasTimeRemaining, try activeLease(account) == lease else { break }
            let receipt = binding.receipt
            guard reserved.sent[receipt.operationID] == nil, reserved.instances?[receipt.operationID] == nil,
                  let family = receipt.local?.id,
                  let snapshot = try readLocal(family),
                  binding.baseline.differs(from: snapshot) || snapshot.scheduleEdit != nil else { continue }
            attempted += 1
            let review: Import.Review
            let desiredSchedule: Import.Event.Schedule?
            do {
                desiredSchedule = try snapshot.scheduleEdit.map { try RemiloIOSGoogleCalendarRule.schedule($0.current) }
                review = try await connection.prepareImport(expectedRevision: expectedRevision, calendarID: lease.calendarID,
                    eventID: receipt.source.eventID, recurringChoices: .init(mode: .none), managedLease: lease, budget: budget,
                    canRead: { [self] in canRead() && (try? activeLease(account)) == lease })
            } catch let failure as Import.Event.Reason {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: failure.rawValue)
                changed = true
                continue
            } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: failure.rawValue)
                changed = true
                continue
            }
            guard try activeLease(account) == lease else { break }
            guard desiredSchedule == nil || local.acknowledgeSchedule != nil,
                  desiredSchedule.map({ !$0.allDay || $0.zoneId == lease.zoneID }) ?? true,
                  try binding.accepts(local: snapshot, review: review, desiredSchedule: desiredSchedule) else {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: Import.Failure.staleRemote.rawValue)
                changed = true
                continue
            }
            let work = Send(id: UUID(), importID: receipt.operationID, account: account, lease: lease,
                            baselineETag: binding.baseline.etag, source: review.source, local: snapshot,
                            desiredSchedule: desiredSchedule)
            let settled: Bool
            if work.desiredFields == review.source.fields {
                settled = try await finish(work, viewer: account, confirmed: .init(review.source), reason: nil)
            } else {
                settled = try await advance(work, viewer: account, phase: .notSent, budget: budget)
            }
            changed = changed || settled
        }
        if let instanceExport = local.instanceExport {
            let settled = try await sendInstances(account, lease: lease, authority: instanceExport, budget: budget)
            changed = changed || settled
        }
        return changed
    }

    private func recoverInstances(_ account: Account, authority: Runtime.SeriesTextAuthority.InstanceExport,
                                  budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        let pending = try savedInstances(viewingAs: account)
        let start = instanceReadbackCursor.flatMap { cursor in pending.firstIndex { $0.importID.uuidString > cursor } } ?? 0
        var changed = false
        for offset in 0..<min(pending.count, 4) {
            guard canRead(), budget.hasTimeRemaining else { break }
            let work = pending[(start + offset) % pending.count]
            instanceReadbackCursor = work.importID.uuidString
            do {
                let settled = try await advanceInstance(work, viewer: account, phase: .sent, authority: authority, budget: budget)
                changed = changed || settled
            } catch Failure.budget { break }
            catch is Failure { continue }
        }
        return changed
    }

    private func sendInstances(_ account: Account, lease: Lease, authority: Runtime.SeriesTextAuthority.InstanceExport,
                               budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        let bindings = try await imports.seriesTextExports(viewingAs: account, lease: lease)
        let reserved = try read()
        let start = instanceSendCursor.flatMap { cursor in bindings.firstIndex { $0.receipt.operationID.uuidString > cursor } } ?? 0
        var attempted = 0
        var changed = false
        for offset in bindings.indices {
            guard attempted < 4, canRead(), budget.hasTimeRemaining, try activeLease(account) == lease else { break }
            let binding = bindings[(start + offset) % bindings.count]
            let id = binding.receipt.operationID
            guard reserved.sent[id] == nil, reserved.instances?[id] == nil, let family = binding.receipt.local?.id,
                  let edit = try authority.read(family, 1).first, !binding.baseline.differs(from: edit.series) else { continue }
            attempted += 1
            instanceSendCursor = id.uuidString
            do {
                let settled = try await sendInstance(edit, binding: binding, account: account, lease: lease, authority: authority, budget: budget)
                changed = changed || settled
            } catch Failure.budget { break }
            catch is Failure { continue }
        }
        return changed
    }

    private func sendInstance(_ edit: IOSCalendarSeriesInstanceEdit, binding: Journal.SeriesTextExport, account: Account,
                              lease: Lease, authority: Runtime.SeriesTextAuthority.InstanceExport,
                              budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        let observed: Writer.InstanceObservation
        do {
            observed = try await connection.withPublicationAccess(captured: account, expectedRevision: account.connectionRevision,
                canRead: canRead) { writer, access in
                    try await writer.resolveInstance(access: access, lease: lease, masterID: binding.receipt.source.eventID,
                        masterETag: binding.baseline.etag, nominalSlot: edit.nominalSlot, budget: budget)
                }
        } catch Import.Failure.staleRemote {
            // The inbound pass must inspect a newer master before this child can be written.
            return false
        } catch let reason as Import.Event.Reason {
            guard canRead(), try activeLease(account) == lease else { return false }
            try await imports.finishSeriesTextExport(binding.receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                     confirmed: nil, reason: reason.rawValue)
            return true
        }
        guard canRead(), try activeLease(account) == lease else { return false }
        guard let child = binding.instanceExport(observed, edit: edit) else {
            try await imports.finishSeriesTextExport(binding.receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                     confirmed: nil, reason: Import.Failure.staleRemote.rawValue)
            return true
        }
        let before = Self.googleFields(edit.baseline)
        let comparison = RemiloIOSGoogleCalendarComparison.compare(local: Self.googleFields(edit.desired), remote: observed.fields,
            baseline: .init(title: before.title, notes: before.notes, schedule: before.schedule))
        guard comparison.conflicts.isEmpty, !comparison.desired.title.isEmpty else {
            try await imports.finishSeriesInstanceExport(child, etag: nil, reason: Import.Failure.staleRemote.rawValue)
            return true
        }
        let work = InstanceSend(id: UUID(), account: account, binding: child, observed: observed, edit: edit, desired: comparison.desired)
        if work.desired == observed.fields {
            return try await finishInstance(work, outcome: .confirmed(observed.etag), viewer: account, authority: authority)
        }
        do {
            return try await advanceInstance(work, viewer: account, phase: .notSent, authority: authority, budget: budget)
        } catch Failure.invalidInput {
            return try await finishInstance(work, outcome: .review(Failure.invalidInput.rawValue), viewer: account, authority: authority)
        }
    }

    private func advanceInstance(_ work: InstanceSend, viewer: Account, phase: Writer.Phase,
                                 authority: Runtime.SeriesTextAuthority.InstanceExport,
                                 budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        if let outcome = work.outcome {
            return try await finishInstance(work, outcome: outcome, viewer: viewer, authority: authority)
        }
        let patch = try work.patch()
        let result = try await connection.withPublicationAccess(captured: work.account, expectedRevision: viewer.connectionRevision,
            canRead: canRead) { [self] writer, access in
                try await writer.patch(patch, access: access, phase: phase, budget: budget) { _ in
                    guard try await imports.permitsSeriesInstanceExport(work.binding) else { return .denied(.staleConnection) }
                    return try await authority.permit(work.edit) { [self] in
                        try beginInstance(work)
                    } ?? .denied(.staleConnection)
                }
            }
        let outcome: InstanceSend.Outcome
        switch result {
        case .confirmed(let event):
            guard let etag = event.strongETag else { return false }
            outcome = .confirmed(etag)
        case .staleRemote: outcome = .review(Import.Failure.staleRemote.rawValue)
        case .remoteRemoved: outcome = .review("REMOTE_REMOVED")
        case .rejected(let failure): outcome = .review(failure.rawValue)
        case .unconfirmed, .notSent, .remoteUnavailable: return false
        }
        return try await finishInstance(work, outcome: outcome, viewer: viewer, authority: authority)
    }

    private func finishInstance(_ work: InstanceSend, outcome: InstanceSend.Outcome, viewer: Account,
                                authority: Runtime.SeriesTextAuthority.InstanceExport) async throws -> Bool {
        var state = try read()
        if let saved = state.instances?[work.importID], saved.id == work.id {
            var settled = work
            settled.outcome = outcome
            if settled != saved {
                state.instances?[work.importID] = settled
                try write(state)
            }
        } else if case .confirmed = outcome {
            // A read can prove that Google already agrees without sending a PATCH.
            // Save that confirmation under the same authority before changing either baseline.
            guard try await imports.permitsSeriesInstanceExport(work.binding) else { return false }
            let checkpoint = try await authority.permit(work.edit) { [self] in try beginInstance(work, outcome: outcome) }
            guard case .granted? = checkpoint else { return false }
        }
        if work.account.accountGeneration == viewer.accountGeneration {
            guard canRead(), let lease = try activeLease(viewer) else { return false }
            if lease == work.binding.lease {
                guard try await acknowledgeInstance(work, outcome: outcome, viewer: viewer, authority: authority) else { return false }
            }
        }
        try removeInstance(work)
        return true
    }

    private func acknowledgeInstance(_ work: InstanceSend, outcome: InstanceSend.Outcome, viewer: Account,
                                     authority: Runtime.SeriesTextAuthority.InstanceExport) async throws -> Bool {
        // If the journal has already advanced, or the binding has been retired,
        // this checkpoint cannot authorize another native mutation.
        guard try await imports.permitsSeriesInstanceExport(work.binding) else { return true }
        guard canRead(), try activeLease(viewer) == work.binding.lease else { return false }
        switch outcome {
        case .review(let reason):
            try await imports.finishSeriesInstanceExport(work.binding, etag: nil, reason: reason)
        case .confirmed(let etag):
            let schedule = work.desired.schedule
            let confirmation = IOSCalendarSeriesInstanceConfirmation(operationID: work.id, edit: work.edit,
                eventID: work.binding.identity.eventID, fields: .init(title: work.desired.title, notes: work.desired.notes,
                    eventStartMs: schedule.eventStartMs, eventEndMs: schedule.eventEndMs, allDay: schedule.allDay, zoneID: schedule.zoneId))
            let result = try await authority.acknowledge(confirmation) { [self] in
                canRead() && (try? activeLease(viewer)) == work.binding.lease
            }
            guard canRead(), try activeLease(viewer) == work.binding.lease else { return false }
            switch result {
            case .applied, .ignored:
                try await imports.finishSeriesInstanceExport(work.binding, etag: etag, reason: nil)
            case .deferred: return false
            case .needsReview, .elapsedAlert:
                try await imports.finishSeriesInstanceExport(work.binding, etag: nil,
                    reason: result == .elapsedAlert ? "ELAPSED_ALERT" : Import.Failure.staleRemote.rawValue)
            }
        }
        return true
    }

    private func beginInstance(_ work: InstanceSend, outcome: InstanceSend.Outcome? = nil) throws -> Writer.Permission {
        guard canRead(), try activeLease(work.account) == work.binding.lease else { return .denied(.staleConnection) }
        try connection.requireManualLinkWrite(account: work.account)
        var state = try read()
        if let existing = state.instances?[work.importID] { return existing == work ? .alreadySent : .denied(.retry) }
        guard state.sent[work.importID] == nil else { return .denied(.retry) }
        var saved = work
        saved.outcome = outcome
        var instances = state.instances ?? [:]
        instances[work.importID] = saved
        state.instances = instances
        try write(state)
        return .granted
    }

    private func removeInstance(_ work: InstanceSend) throws {
        var state = try read()
        if state.instances?[work.importID]?.id == work.id {
            state.instances?.removeValue(forKey: work.importID)
            try write(state)
        }
    }

    private static func googleFields(_ fields: IOSCalendarSeriesInstanceEdit.Fields) -> Import.Event.Fields {
        .init(title: fields.title, notes: fields.notes, schedule: .init(eventStartMs: fields.eventStartMs,
            eventEndMs: fields.eventEndMs, allDay: fields.allDay, zoneId: fields.zoneID, recurrence: nil))
    }

    private func advance(_ work: Send, viewer: Account, phase: Writer.Phase,
                         budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        let patch = try work.patch()
        let outcome = try await connection.withPublicationAccess(
            captured: work.account, expectedRevision: viewer.connectionRevision, canRead: canRead
        ) { [self] writer, access in
            try await writer.patch(patch, access: access, phase: phase, budget: budget) { _ in
                try await local.permit(work.local) { [self] in
                    guard canRead(), try activeLease(work.account) == work.lease else { return .denied(.staleConnection) }
                    try connection.requireManualLinkWrite(account: work.account)
                    return try beginSend(work)
                } ?? .denied(.staleConnection)
            }
        }
        let next: Journal.SeriesTextBaseline?
        let reason: String?
        switch outcome {
        case .confirmed(let event):
            guard let etag = event.strongETag else { return false }
            if work.desiredSchedule != nil, work.account.accountGeneration == viewer.accountGeneration,
               try activeLease(viewer) == work.lease {
                if let problem = try await scheduleReadbackIssue(work, viewer: viewer, etag: etag, budget: budget) {
                    return try await finish(work, viewer: viewer, confirmed: nil, reason: problem)
                }
            }
            next = try .init(etag: etag, fields: work.desiredFields)
            reason = nil
        case .staleRemote:
            next = nil
            reason = Import.Failure.staleRemote.rawValue
        case .remoteRemoved:
            next = nil
            reason = "REMOTE_REMOVED"
        case .rejected(let failure):
            next = nil
            reason = failure.rawValue
        case .unconfirmed, .notSent, .remoteUnavailable:
            return false
        }
        return try await finish(work, viewer: viewer, confirmed: next, reason: reason)
    }

    private func scheduleReadbackIssue(_ work: Send, viewer: Account, etag: String,
                                       budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> String? {
        do {
            let review = try await connection.prepareImport(expectedRevision: viewer.connectionRevision, calendarID: work.lease.calendarID,
                eventID: work.source.key.eventID, recurringChoices: .init(mode: .none), managedLease: work.lease, budget: budget,
                canRead: { [self] in canRead() && (try? activeLease(viewer)) == work.lease })
            guard review.source.etag == etag, review.source.fields == work.desiredFields,
                  let proof = review.recurrenceEvidence, proof.exceptions.isEmpty, !proof.ordinarySlots.isEmpty else {
                return Import.Failure.staleRemote.rawValue
            }
            return nil
        } catch let failure as Import.Event.Reason {
            return failure.rawValue
        } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
            return failure.rawValue
        } catch let failure as Import.Failure {
            return failure.rawValue
        }
    }

    private func finish(_ work: Send, viewer: Account, confirmed: Journal.SeriesTextBaseline?, reason: String?) async throws -> Bool {
        if work.account.accountGeneration == viewer.accountGeneration, try activeLease(viewer) == work.lease {
            var settled = confirmed
            var issue = reason
            if settled != nil, work.desiredSchedule != nil {
                let acknowledged = try await local.acknowledgeSchedule?(work.local) { [self] in
                    canRead() && (try? activeLease(viewer)) == work.lease
                }
                if acknowledged != true {
                    settled = nil
                    issue = Import.Failure.staleRemote.rawValue
                }
            }
            if try activeLease(viewer) == work.lease {
                try await imports.finishSeriesTextExport(work.importID, lease: work.lease, expectedBaseline: work.baselineETag,
                                                         confirmed: settled, reason: issue)
            }
        }
        var state = try read()
        if state.sent[work.importID] == work {
            state.sent.removeValue(forKey: work.importID)
            try write(state)
        }
        return true
    }

    private func beginSend(_ work: Send) throws -> Writer.Permission {
        var state = try read()
        if let saved = state.sent[work.importID] { return saved == work ? .alreadySent : .denied(.retry) }
        guard state.instances?[work.importID] == nil else { return .denied(.retry) }
        state.sent[work.importID] = work
        try write(state)
        return .granted
    }

    private var file: URL { directory.appendingPathComponent("series-text-writes.json") }

    private func savedSends(viewingAs account: Account) throws -> [Send] {
        try read().sent.values.filter { $0.account.subject == account.subject && $0.account.clientID == account.clientID }
            .sorted { $0.importID.uuidString < $1.importID.uuidString }
    }

    private func savedInstances(viewingAs account: Account) throws -> [InstanceSend] {
        try (read().instances ?? [:]).values
            .filter { $0.account.subject == account.subject && $0.account.clientID == account.clientID }
            .sorted { $0.importID.uuidString < $1.importID.uuidString }
    }

    private func read() throws -> State {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: file))
            guard state.version == 1 else { throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema }
            return state
        } catch CocoaError.fileReadNoSuchFile { return State() }
    }

    private func write(_ state: State) throws {
        #if os(iOS)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.complete])
        var protected = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try protected.setResourceValues(values)
        let options: Data.WritingOptions = [.atomic, .completeFileProtection]
        #else
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let options: Data.WritingOptions = .atomic
        #endif
        try JSONEncoder().encode(state).write(to: file, options: options)
    }
}
