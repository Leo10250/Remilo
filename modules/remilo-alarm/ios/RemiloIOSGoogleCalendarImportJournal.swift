import CryptoKit
import Foundation

actor RemiloIOSGoogleCalendarImportJournal {
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias Failure = Import.Failure
    typealias Inbox = RemiloIOSGoogleCalendarManagedInbox

    struct LocalReceipt: Codable, Equatable, Sendable {
        enum Kind: String, Codable, Sendable { case reminder, series }
        enum Status: String, Codable, Sendable {
            case applied = "Applied", scheduled = "Scheduled", blocked = "Blocked", pending = "Pending", partial = "Partial"
        }

        let id: String
        let kind: Kind
        let status: Status
        let eligibleForLink: Bool
    }

    enum LocalResult: Sendable { case acknowledged(LocalReceipt), rejected(String) }

    struct Scheduler: Sendable {
        typealias Permit = @MainActor @Sendable () throws -> Bool
        let receipt: @Sendable (Import.Command) async throws -> LocalReceipt?
        let create: @Sendable (Import.Command, @escaping Permit) async throws -> LocalResult
    }

    struct Authority: Sendable {
        let current: @MainActor @Sendable (Import.Account) throws -> Bool
        let observe: @Sendable (Import.Review) async throws -> Import.Observation
        var managedCurrent: (@MainActor @Sendable (RemiloIOSGoogleCalendarManagedInbox.Permit, Import.Account) throws -> Bool)? = nil

        func scoped(to permit: RemiloIOSGoogleCalendarManagedInbox.Permit?) -> Self {
            guard let permit else { return self }
            return Self(current: { [current, managedCurrent] account in
                guard try current(account) else { return false }
                return try managedCurrent?(permit, account) ?? false
            }, observe: observe)
        }
    }

    struct ManagedWork: Sendable {
        let id: UUID
        let permit: RemiloIOSGoogleCalendarManagedInbox.Permit
    }

    struct ManagedLinkWork: Sendable {
        let permit: RemiloIOSGoogleCalendarManagedInbox.Permit
        let receipt: Receipt
    }

    private enum ManagedLinkDisposition: Codable {
        case settled
        case needsReview(String)
    }

    struct RecurringIssue: Codable, Equatable, Sendable {
        let eventID: String
        let etag: String?
        let code: String
    }

    struct RecurringObservationResult: Sendable {
        let observation: Inbox.Observation
        let recordedIssue: Bool
        var textWork: SeriesTextWork? = nil
    }

    struct RecurringInstanceVersion: Codable, Equatable, Sendable {
        let identity: Import.Event.InstanceIdentity
        let etag: String?

        func matches(_ observation: Inbox.Observation) -> Bool {
            guard identity.eventID == observation.eventID, identity.cancelled == observation.instanceCancelled else { return false }
            if identity.cancelled { return true }
            return etag != nil && etag == observation.etag
        }
    }

    struct SeriesTextBaseline: Codable, Equatable, Sendable {
        let etag: String
        private let title: Data
        private let notes: Data
        private let schedule: Data

        init(_ source: Import.Source) throws {
            try self.init(etag: source.etag, fields: source.fields)
        }

        init(etag: String, fields: Import.Event.Fields) throws {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            self.etag = etag
            title = Self.digest(fields.title)
            notes = Self.digest(fields.notes)
            schedule = Data(SHA256.hash(data: try encoder.encode(fields.schedule)))
        }

        func accepts(local: IOSCalendarSeriesTextSnapshot, remote: Import.Source, allowSchedule: Bool) throws -> Bool {
            let next = try Self(remote)
            // Apply inbound text only when each group is already equal or
            // still has the last common value on the local side.
            return (allowSchedule || schedule == next.schedule) && (title == Self.digest(local.title) || next.title == Self.digest(local.title)) &&
                (notes == Self.digest(local.notes) || next.notes == Self.digest(local.notes))
        }

        func scheduleDiffers(from source: Import.Source) throws -> Bool {
            try Self(source).schedule != schedule
        }

        fileprivate static func digest(_ value: String) -> Data {
            Data(SHA256.hash(data: Data(value.utf8)))
        }

        func differs(from local: IOSCalendarSeriesTextSnapshot) -> Bool {
            title != Self.digest(local.title) || notes != Self.digest(local.notes)
        }

        func acceptsExport(local: IOSCalendarSeriesTextSnapshot, remote: Import.Source, desiredSchedule: Import.Event.Schedule?) throws -> Bool {
            let current = try Self(remote)
            return (schedule == current.schedule || desiredSchedule == remote.fields.schedule) &&
                (title == current.title || local.title == remote.fields.title) &&
                (notes == current.notes || local.notes == remote.fields.notes)
        }
    }

    struct SeriesTextWork: Sendable {
        let receipt: Receipt
        let permit: Inbox.Permit
        let baseline: SeriesTextBaseline?
        let exceptions: [RecurringInstanceVersion]?

        var operationKey: String {
            receipt.operationID.uuidString.lowercased() + ":" + SeriesTextBaseline.digest(permit.observation.etag ?? "").base64EncodedString()
        }

        func accepts(local: IOSCalendarSeriesTextSnapshot, review: Import.Review, allowSchedule: Bool = false) throws -> Bool {
            let source = review.source
            guard source.key == receipt.source, source.etag == permit.observation.etag,
                  let proof = review.recurrenceEvidence, !source.fields.title.isEmpty else { return false }
            if let baseline {
                guard try baseline.accepts(local: local, remote: source, allowSchedule: allowSchedule) else { return false }
                // An exception can age out of this audit window. Any exception
                // returned now must match the provider version we imported.
                return proof.exceptions.allSatisfy { candidate in
                    exceptions?.contains(where: { known in
                        known.identity == candidate.identity && (known.identity.cancelled || known.etag == candidate.etag)
                    }) == true
                }
            }
            return source.etag == receipt.reviewedETag && local.title == source.fields.title && local.notes == source.fields.notes
        }

        func scheduleChange(for review: Import.Review) throws -> IOSCalendarSeriesScheduleChange? {
            guard try baseline?.scheduleDiffers(from: review.source) == true, let rule = try review.recurringRule() else { return nil }
            let fields = review.source.fields
            return .init(rule: rule, eventStartMs: fields.schedule.eventStartMs, eventEndMs: fields.schedule.eventEndMs,
                         title: fields.title, notes: fields.notes)
        }
    }

    struct SeriesTextExport: Sendable {
        let receipt: Receipt
        let baseline: SeriesTextBaseline
        let exceptions: [RecurringInstanceVersion]

        func accepts(local: IOSCalendarSeriesTextSnapshot, review: Import.Review,
                     desiredSchedule: Import.Event.Schedule? = nil) throws -> Bool {
            guard local.familyID == receipt.local?.id, review.source.key == receipt.source,
                  let proof = review.recurrenceEvidence,
                  try baseline.acceptsExport(local: local, remote: review.source, desiredSchedule: desiredSchedule) else { return false }
            if desiredSchedule != nil, local.scheduleEdit?.hasFutureExceptions == true || !proof.exceptions.isEmpty { return false }
            return proof.exceptions.allSatisfy { candidate in
                exceptions.contains { $0.identity == candidate.identity && ($0.identity.cancelled || $0.etag == candidate.etag) }
            }
        }
    }

    struct Receipt: Codable, Equatable, Sendable {
        enum Suppression: String, Codable, Sendable { case none, deferredUntilLocalDelivery, requiresRemoteCheck, suspended }

        let operationID: UUID
        let source: Import.SourceKey
        let reviewedETag: String
        let account: Import.Account
        let local: LocalReceipt?
        let relationship: Import.Relationship?
        let suppression: Suppression
        let errorCode: String?
    }

    struct SavedOperation: Sendable {
        enum Phase: Equatable, Sendable { case waiting, checking, creating, submitted, settled }

        let operationID: UUID
        let account: Import.Account
        let source: Import.SourceKey
        let phase: Phase
        let calendarName: String?
        let title: String?
        let receipt: Receipt?
        let recurringIssue: RecurringIssue?

        init(receipt: Receipt, recurringIssue: RecurringIssue? = nil) {
            self.init(operationID: receipt.operationID, account: receipt.account, source: receipt.source,
                      phase: .settled, calendarName: nil, title: nil, receipt: receipt, recurringIssue: recurringIssue)
        }

        fileprivate init(operationID: UUID, account: Import.Account, source: Import.SourceKey, phase: Phase,
                         calendarName: String?, title: String?, receipt: Receipt?, recurringIssue: RecurringIssue? = nil) {
            self.operationID = operationID
            self.account = account
            self.source = source
            self.phase = phase
            self.calendarName = calendarName
            self.title = title
            self.receipt = receipt
            self.recurringIssue = recurringIssue
        }
    }

    private struct Request: Encodable {
        let operationID: UUID
        let review: Import.Review
        let choices: Import.Choices

        func fingerprint() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }
    }

    private struct Entry: Codable {
        let fingerprint: Data
        let source: Import.SourceKey
        var createdAtMs: Int64?
        var capture: Import.Capture?
        var submitted = false
        var receipt: Receipt?
        var managed: RemiloIOSGoogleCalendarManagedInbox.Permit?
        var managedLink: ManagedLinkDisposition?
        var recurringInstances: [RecurringInstanceVersion]?
        var recurringIssue: RecurringIssue?
        var seriesTextBaseline: SeriesTextBaseline?
    }

    private struct State: Codable {
        let schemaVersion: Int
        var entries: [UUID: Entry]

        init() {
            schemaVersion = 1
            entries = [:]
        }
    }

    private struct Header: Decodable { let schemaVersion: Int }
    private let directory: URL
    private let now: @Sendable () -> Int64
    private var running = Set<UUID>()
    private var file: URL { directory.appendingPathComponent("import-journal.json", isDirectory: false) }

    init(directory: URL, now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.directory = directory
        self.now = now
    }

    static func local() throws -> RemiloIOSGoogleCalendarImportJournal {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return RemiloIOSGoogleCalendarImportJournal(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    /// This capture is a consequence of confirmation, not of opening a preview.
    /// The current connection is revalidated before any new local create.
    func capture(operationID: UUID, review: Import.Review, choices: Import.Choices) throws -> Receipt? {
        try capture(operationID: operationID, review: review, choices: choices, managed: nil)
    }

    func captureManaged(_ permit: RemiloIOSGoogleCalendarManagedInbox.Permit, review: Import.Review,
                        choices: Import.Choices) throws -> UUID {
        guard permit.source == review.source.key, permit.observation.etag == review.source.etag,
              permit.scope.binding.belongs(to: review.account), permit.scope.binding.account.accountGeneration == review.account.accountGeneration,
              choices.mode == permit.observation.importMode, choices.allDayAlarmMinutes == permit.scope.policy.allDayAlarmMinutes,
              choices.title == nil, choices.alarmAtMs == nil, choices.listID == nil,
              choices.automaticSync, !choices.disableGoogleReminders else {
            throw Failure.staleRemote
        }
        if let existing = try read().entries.first(where: {
            $0.value.managed == permit && $0.value.receipt?.errorCode != Failure.staleConnection.rawValue
        }) { return existing.key }
        let id = UUID()
        _ = try capture(operationID: id, review: review, choices: choices, managed: permit)
        return id
    }

    func pendingManaged(viewingAs account: Import.Account) throws -> [ManagedWork] {
        try read().entries.sorted {
            ($0.value.createdAtMs ?? 0, $0.key.uuidString) < ($1.value.createdAtMs ?? 0, $1.key.uuidString)
        }.compactMap { id, entry in
            guard entry.receipt == nil, let permit = entry.managed, permit.scope.binding.belongs(to: account) else { return nil }
            return ManagedWork(id: id, permit: permit)
        }
    }

    func managedPermit(_ id: UUID, viewingAs account: Import.Account) throws -> RemiloIOSGoogleCalendarManagedInbox.Permit? {
        guard let permit = try read().entries[id]?.managed, permit.scope.binding.belongs(to: account) else { return nil }
        return permit
    }

    func pendingManagedLinks(viewingAs account: Import.Account) throws -> [ManagedLinkWork] {
        try read().entries.sorted { ($0.value.createdAtMs ?? 0, $0.key.uuidString) < ($1.value.createdAtMs ?? 0, $1.key.uuidString) }
            .compactMap { _, entry in
                guard entry.managedLink == nil, let permit = entry.managed, permit.scope.binding.belongs(to: account),
                      let receipt = entry.receipt, receipt.local?.kind == .reminder,
                      receipt.relationship == .automaticRequested else { return nil }
                return ManagedLinkWork(permit: permit, receipt: receipt)
            }
    }

    func finishManagedLink(_ work: ManagedLinkWork, reason: String?) throws {
        var state = try read()
        let id = work.receipt.operationID
        guard var entry = state.entries[id], entry.receipt == work.receipt, entry.managed == work.permit else { throw Failure.operationReused }
        guard entry.managedLink == nil else { return }
        entry.managedLink = reason.map(ManagedLinkDisposition.needsReview) ?? .settled
        state.entries[id] = entry
        try write(state)
    }

    /// Save changes against an existing series before clearing observations
    /// from the inbox. Replaying the same provider version is harmless.
    func reconcileManagedSeries(_ scan: Inbox.Progress, viewingAs account: Import.Account,
                                limit: Int, allowTextTransfers: Bool = false,
                                waitingExports: Set<UUID> = []) throws -> [RecurringObservationResult] {
        guard limit > 0, scan.initialComplete, !scan.continuation, scan.scope.binding.belongs(to: account),
              scan.scope.binding.account.accountGeneration == account.accountGeneration,
              scan.scope.policy.automaticImport else { return [] }
        var state = try read()
        var masters: [String: UUID] = [:]
        for (id, entry) in state.entries {
            guard let origin = entry.managed, origin.scope.binding.linkLease == scan.scope.binding.linkLease,
                  let receipt = entry.receipt, receipt.local?.kind == .series, receipt.relationship == .automaticRequested,
                  receipt.account.subject == account.subject, receipt.account.clientID == account.clientID,
                  receipt.account.accountGeneration == account.accountGeneration else { continue }
            masters[receipt.source.eventID] = id
        }
        var results: [RecurringObservationResult] = []
        for observation in scan.pending {
            let masterID: String
            if case .changedInstance(let id) = observation.kind { masterID = id }
            else { masterID = observation.eventID }
            guard let id = masters[masterID], var entry = state.entries[id], let receipt = entry.receipt else { continue }
            if waitingExports.contains(id), observation.kind == .recurringMaster { continue }
            let reviewedVersion = entry.seriesTextBaseline?.etag ?? receipt.reviewedETag
            let needsTextCheck = entry.seriesTextBaseline == nil ? observation.etag == reviewedVersion : observation.etag != reviewedVersion
            if allowTextTransfers, observation.kind == .recurringMaster, observation.etag != nil, entry.recurringIssue == nil,
               needsTextCheck,
               !scan.pending.contains(where: { item in
                   guard item.kind == .changedInstance(masterID: masterID) else { return false }
                   return entry.recurringInstances?.contains(where: { $0.matches(item) }) != true
               }) {
                results.append(.init(observation: observation, recordedIssue: false,
                    textWork: .init(receipt: receipt, permit: .init(scope: scan.scope, observation: observation),
                                    baseline: entry.seriesTextBaseline, exceptions: entry.recurringInstances)))
                if results.count == limit { break }
                continue
            }
            let unchanged: Bool
            if case .changedInstance = observation.kind {
                unchanged = entry.recurringInstances?.contains(where: { $0.matches(observation) }) == true
            } else {
                unchanged = observation.kind == .recurringMaster && reviewedVersion == observation.etag
            }
            var recorded = false
            if !unchanged {
                let code: String
                switch observation.kind {
                case .removed: code = "REMOTE_REMOVED"
                case .needsReview(let reason): code = reason
                default: code = Failure.staleRemote.rawValue
                }
                // One review covers the family. Explicit removal supersedes a
                // version change so it cannot be lost during an inbox replay.
                if entry.recurringIssue == nil || (entry.recurringIssue?.code != code && code == "REMOTE_REMOVED") {
                    entry.recurringIssue = RecurringIssue(eventID: observation.eventID, etag: observation.etag, code: code)
                    state.entries[id] = entry
                    recorded = true
                }
            }
            results.append(.init(observation: observation, recordedIssue: recorded))
            if results.count == limit { break }
        }
        if results.contains(where: \.recordedIssue) { try write(state) }
        return results
    }

    func finishSeriesText(_ work: SeriesTextWork, confirmed review: Import.Review?, reason: String?) throws {
        var state = try read()
        let id = work.receipt.operationID
        guard var entry = state.entries[id], entry.receipt == work.receipt, entry.seriesTextBaseline == work.baseline,
              entry.recurringIssue == nil, entry.managed?.scope.binding.linkLease == work.permit.scope.binding.linkLease else {
            throw Failure.stalePreview
        }
        if let review {
            guard reason == nil, review.source.key == work.receipt.source, review.source.etag == work.permit.observation.etag,
                  let proof = review.recurrenceEvidence else { throw Failure.staleRemote }
            entry.seriesTextBaseline = try SeriesTextBaseline(review.source)
            if entry.recurringInstances == nil {
                entry.recurringInstances = proof.exceptions.map { .init(identity: $0.identity, etag: $0.etag) }
            }
        } else if let reason {
            entry.recurringIssue = .init(eventID: work.permit.observation.eventID, etag: work.permit.observation.etag, code: reason)
        } else {
            throw Failure.invalidInput
        }
        state.entries[id] = entry
        try write(state)
    }

    func seriesTextExports(viewingAs account: Import.Account,
                           lease: RemiloIOSGoogleCalendarManualLink.ManagedLease) throws -> [SeriesTextExport] {
        try read().entries.values.compactMap { entry in
            guard let receipt = entry.receipt, receipt.local?.kind == .series, receipt.relationship == .automaticRequested,
                  receipt.account.subject == account.subject, receipt.account.clientID == account.clientID,
                  receipt.account.accountGeneration == account.accountGeneration, entry.managed?.scope.binding.linkLease == lease,
                  entry.recurringIssue == nil, let baseline = entry.seriesTextBaseline,
                  let exceptions = entry.recurringInstances else { return nil }
            return .init(receipt: receipt, baseline: baseline, exceptions: exceptions)
        }.sorted { $0.receipt.operationID.uuidString < $1.receipt.operationID.uuidString }
    }

    func finishSeriesTextExport(_ id: UUID, lease: RemiloIOSGoogleCalendarManualLink.ManagedLease, expectedBaseline: String,
                                confirmed: SeriesTextBaseline?, reason: String?) throws {
        var state = try read()
        guard var entry = state.entries[id], let receipt = entry.receipt, entry.managed?.scope.binding.linkLease == lease,
              entry.seriesTextBaseline?.etag == expectedBaseline, entry.recurringIssue == nil else { return }
        if let confirmed { entry.seriesTextBaseline = confirmed }
        else if let reason { entry.recurringIssue = .init(eventID: receipt.source.eventID, etag: expectedBaseline, code: reason) }
        else { throw Failure.invalidInput }
        state.entries[id] = entry
        try write(state)
    }

    private func capture(operationID: UUID, review: Import.Review, choices: Import.Choices,
                         managed: RemiloIOSGoogleCalendarManagedInbox.Permit?) throws -> Receipt? {
        let fingerprint = try Request(operationID: operationID, review: review, choices: choices).fingerprint()
        var state = try read()
        if let existing = state.entries[operationID] {
            guard existing.fingerprint == fingerprint, existing.managed == managed else { throw Failure.operationReused }
            return existing.receipt
        }
        for existing in state.entries.values where existing.source == review.source.key {
            if existing.receipt?.local != nil { throw Failure.alreadyImported }
            if existing.receipt == nil { throw Failure.operationPending }
        }
        let capturedAt = now()
        let capture = try Import.Capture(operationID: operationID, review: review, choices: choices, now: capturedAt)
        state.entries[operationID] = Entry(fingerprint: fingerprint, source: review.source.key, createdAtMs: capturedAt,
                                          capture: capture, managed: managed)
        try write(state)
        return nil
    }

    func account(for operationID: UUID) throws -> Import.Account? {
        let entry = try read().entries[operationID]
        return entry?.receipt?.account ?? entry?.capture?.review.account
    }

    func savedOperation(_ operationID: UUID, viewingAs viewer: Import.Account) throws -> SavedOperation? {
        guard let entry = try read().entries[operationID] else { return nil }
        return savedOperation(operationID, entry: entry, viewingAs: viewer)
    }

    func savedOperations(viewingAs viewer: Import.Account) throws -> [SavedOperation] {
        let entries = try read().entries
        let visible = entries.compactMap { operationID, entry -> (SavedOperation, Int64)? in
            guard let operation = savedOperation(operationID, entry: entry, viewingAs: viewer) else { return nil }
            return (operation, entry.createdAtMs ?? entry.capture?.review.checkedAtMs ?? 0)
        }
        return visible.sorted { lhs, rhs in
            if (lhs.0.receipt == nil) != (rhs.0.receipt == nil) { return lhs.0.receipt == nil }
            if lhs.1 != rhs.1 { return lhs.1 > rhs.1 }
            return lhs.0.operationID.uuidString < rhs.0.operationID.uuidString
        }.prefix(64).map { $0.0 }
    }

    private func savedOperation(_ operationID: UUID, entry: Entry, viewingAs viewer: Import.Account) -> SavedOperation? {
        guard let owner = entry.receipt?.account ?? entry.capture?.review.account,
              owner.subject == viewer.subject, owner.clientID == viewer.clientID else { return nil }
        if let receipt = entry.receipt { return SavedOperation(receipt: receipt, recurringIssue: entry.recurringIssue) }
        guard let capture = entry.capture else { return nil }
        let phase: SavedOperation.Phase
        if running.contains(operationID) { phase = entry.submitted ? .creating : .checking }
        else { phase = entry.submitted ? .submitted : .waiting }
        return SavedOperation(operationID: operationID, account: owner, source: entry.source, phase: phase,
                              calendarName: capture.review.calendarName, title: capture.command.title, receipt: nil)
    }

    func reservedEvents(subject: String, calendarID: String) throws -> Set<String> {
        Set(try read().entries.values.compactMap { entry in
            guard entry.source.subject == subject, entry.source.calendarID == calendarID,
                  entry.receipt == nil || entry.receipt?.local != nil else { return nil }
            return entry.source.eventID
        })
    }

    func importedSource(_ occurrenceID: String, viewingAs account: Import.Account) throws -> Import.SourceKey? {
        let matches = try read().entries.values.compactMap { entry -> Import.SourceKey? in
            guard let receipt = entry.receipt, receipt.account.subject == account.subject, receipt.account.clientID == account.clientID,
                  receipt.local?.kind == .reminder, receipt.local?.id == occurrenceID else { return nil }
            return receipt.source
        }
        guard matches.count <= 1 else { throw Failure.invalidInput }
        return matches.first
    }

    func run(_ operationID: UUID, authority: Authority, scheduler: Scheduler) async throws -> Receipt {
        let state = try read()
        guard let entry = state.entries[operationID] else { throw Failure.notFound }
        let authority = authority.scoped(to: entry.managed)
        if let receipt = entry.receipt { return receipt }
        guard let capture = entry.capture else { throw Failure.notFound }
        let fingerprint = try Request(operationID: operationID, review: capture.review, choices: capture.choices).fingerprint()
        guard fingerprint == entry.fingerprint, capture.operationID == operationID else { throw Failure.operationReused }
        guard running.insert(operationID).inserted else { throw Failure.operationPending }
        defer { running.remove(operationID) }

        // A committed scheduler receipt is authoritative even when the preview,
        // alarm time, source or connection became stale after the local commit.
        if entry.submitted, let recovered = try await scheduler.receipt(capture.command) {
            return try await acknowledge(capture, local: recovered, authority: authority, scheduler: scheduler)
        }
        do {
            guard capture.review.valid(at: now()) else { throw Failure.stalePreview }
            guard try await authority.current(capture.review.account) else { throw Failure.staleConnection }
            let observed = try await authority.observe(capture.review)
            guard capture.review.matches(observed) else { throw Failure.staleRemote }
            guard try await authority.current(capture.review.account) else { throw Failure.staleConnection }
            let revalidated = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: now())
            guard revalidated.command == capture.command else { throw Failure.operationReused }
        } catch let failure as Failure {
            return try reject(capture, code: failure.rawValue)
        } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
            return try reject(capture, code: failure.rawValue)
        } catch is Import.Event.Reason {
            return try reject(capture, code: Failure.staleRemote.rawValue)
        } catch let failure as RemiloIOSGoogleCalendarFailure {
            switch failure {
            case .notFound, .notOwner: return try reject(capture, code: Failure.staleRemote.rawValue)
            case .staleConnection, .accountChanged: return try reject(capture, code: Failure.staleConnection.rawValue)
            default: throw failure
            }
        }
        try Task.checkCancellation()
        var current = try read()
        current.entries[operationID]?.submitted = true
        try write(current)
        let clock = now
        let result: LocalResult
        do {
            result = try await scheduler.create(capture.command) {
                _ = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: clock())
                return try authority.current(capture.review.account)
            }
        } catch let failure as Failure {
            result = .rejected(failure.rawValue)
        }
        switch result {
        case .acknowledged(let local): return try await acknowledge(capture, local: local, authority: authority, scheduler: scheduler)
        case .rejected(let code):
            if let recovered = try await scheduler.receipt(capture.command) {
                return try await acknowledge(capture, local: recovered, authority: authority, scheduler: scheduler)
            }
            return try reject(capture, code: code)
        }
    }

    private func acknowledge(_ capture: Import.Capture, local: LocalReceipt, authority: Authority, scheduler: Scheduler) async throws -> Receipt {
        let latest = try? await scheduler.receipt(capture.command)
        let current = (try? await authority.current(capture.review.account)) == true
        let authorized = current && latest?.id == local.id && latest?.eligibleForLink == true
        let observedLocal = latest?.id == local.id ? latest ?? local : local
        let relationship: Import.Relationship = authorized ? (capture.choices.automaticSync ? .automaticRequested : .manual) : .suspended
        let suppression: Receipt.Suppression
        if !capture.choices.disableGoogleReminders { suppression = .none }
        else if !authorized { suppression = .suspended }
        else if [.blocked, .pending, .partial].contains(observedLocal.status) { suppression = .deferredUntilLocalDelivery }
        else { suppression = .requiresRemoteCheck }
        let receipt = Receipt(operationID: capture.operationID, source: capture.review.source.key,
                              reviewedETag: capture.review.source.etag, account: capture.review.account, local: observedLocal,
                              relationship: relationship, suppression: suppression, errorCode: nil)
        return try finalize(receipt)
    }

    private func reject(_ capture: Import.Capture, code: String) throws -> Receipt {
        try finalize(Receipt(operationID: capture.operationID, source: capture.review.source.key,
                             reviewedETag: capture.review.source.etag, account: capture.review.account, local: nil,
                             relationship: nil, suppression: .none, errorCode: code))
    }

    private func finalize(_ receipt: Receipt) throws -> Receipt {
        var state = try read()
        guard var entry = state.entries[receipt.operationID] else { throw Failure.notFound }
        if let confirmed = entry.receipt { return confirmed }
        if receipt.local?.kind == .series, let proof = entry.capture?.review.recurrenceEvidence {
            entry.recurringInstances = proof.exceptions.map { .init(identity: $0.identity, etag: $0.etag) }
            if entry.managed != nil, let source = entry.capture?.review.source {
                entry.seriesTextBaseline = try SeriesTextBaseline(source)
            }
        }
        entry.capture = nil // no completed preview content in the recovery journal
        entry.receipt = receipt
        state.entries[receipt.operationID] = entry
        try write(state)
        return receipt
    }

    private func read() throws -> State {
        do {
            let data = try Data(contentsOf: file)
            let decoder = JSONDecoder()
            guard try decoder.decode(Header.self, from: data).schemaVersion == 1 else {
                throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema
            }
            return try decoder.decode(State.self, from: data)
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
