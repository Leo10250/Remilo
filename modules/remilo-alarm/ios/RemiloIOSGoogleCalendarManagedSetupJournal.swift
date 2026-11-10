import Foundation

/// Serializes setup authority, the creation receipt and the binding. Network
/// observations may arrive later, but every mutation here is synchronous.
@MainActor
final class RemiloIOSGoogleCalendarManagedSetupJournal {
    typealias Account = RemiloIOSGoogleCalendarPublication.Account
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias Discovery = RemiloIOSGoogleCalendarManagedDiscovery
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Record = RemiloIOSCalendarOwnedRecord
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Lease = RemiloIOSGoogleCalendarManualLink.ManagedLease
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias Inbox = RemiloIOSGoogleCalendarManagedInbox

    enum Rejection: String, Error {
        case stalePreview = "STALE_PREVIEW"
        case discoveryIncomplete = "DISCOVERY_INCOMPLETE"
        case selectionRequired = "SELECTION_REQUIRED"
        case operationPending = "OPERATION_PENDING"
        case creationUnconfirmed = "CREATION_UNCONFIRMED"
    }

    struct Policy: Codable, Equatable, Sendable {
        var revision = 1
        var automaticImport = true
        var exportNewReminders = true
        var importMode: RemiloIOSGoogleCalendarImport.Mode = .alarm
        var allDayAlarmMinutes = 540
        var disableGoogleReminders = false
    }

    struct PolicyReview: Sendable {
        let id: UUID
        let account: Account
        let bindingRevision: Int
        let authEpoch: Int
        let policy: Policy
        let expiresAtMs: Int64
    }

    struct PolicyReceipt: Codable, Equatable, Sendable {
        let account: Account
        let reviewID: UUID
        let revision: Int
        let policy: Policy
    }

    enum Target: Codable, Equatable, Sendable {
        case select(calendarID: String)
        case create(zoneID: String)

        var selectedCalendarID: String {
            if case .select(let id) = self { return id }
            return ""
        }
    }

    struct InitialImport: Codable, Equatable, Sendable {
        let mode: RemiloIOSGoogleCalendarImport.Mode
        let recoveringExistingCalendar: Bool
    }

    struct Review: Codable, Equatable, Sendable {
        let id: UUID
        let account: Account
        let scanID: UUID
        let policy: Policy
        let target: Target
        let calendarName: String
        let calendarZoneID: String
        let replacesOperationID: UUID?
        let initialImport: InitialImport?
        let bindingRevision: Int
        fileprivate let authEpoch: Int
        fileprivate let checkedAtMs: Int64

        var expiresAtMs: Int64 { checkedAtMs + 600_000 }
    }

    enum Phase: String, Codable, Sendable { case captured, sent, confirmed, rejected }

    struct Entry: Codable, Equatable, Sendable {
        let operationID: UUID
        let review: Review
        let bindingRevision: Int
        let authEpoch: Int
        fileprivate(set) var account: Account
        fileprivate(set) var phase: Phase = .captured
        fileprivate(set) var retired = false
        fileprivate(set) var sentRequest: Writer.ManagedCreation?
        fileprivate(set) var returnedCalendarID: String?
        fileprivate(set) var confirmedCalendar: Record?
        fileprivate(set) var reason: String?

        var creationRequest: Writer.ManagedCreation? {
            guard case .create(let zoneID) = review.target else { return nil }
            return Writer.ManagedCreation(operationID: operationID, account: account, zoneID: zoneID)
        }
    }

    struct Binding: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Account
        let record: Record
        let revision: Int
        let authEpoch: Int
        let initialImport: InitialImport?

        func belongs(to account: Account) -> Bool {
            self.account.subject == account.subject && self.account.clientID == account.clientID
        }

        var linkLease: RemiloIOSGoogleCalendarManualLink.ManagedLease {
            .init(setupID: operationID, bindingRevision: revision, authEpoch: authEpoch, calendarID: record.id, zoneID: record.zoneId)
        }

        var exportLease: RemiloIOSGoogleCalendarManualLink.ManagedLease {
            var lease = linkLease
            lease.publication = true
            return lease
        }
    }

    struct View: Equatable, Sendable {
        let bindingRevision: Int
        let authEpoch: Int
        let policy: Policy
        let binding: Binding?
        let pendingOperationID: UUID?
        let retiredCreationOperationID: UUID?
        let mode: Mode
    }

    enum Mode: String, Codable, Equatable, Sendable {
        case enabled = "Enabled", paused = "Paused", disabled = "Disabled"
    }

    struct SyncRequest: Codable, Equatable, Sendable {
        enum Outcome: String, Codable, Sendable {
            case pending = "Pending", noChanges = "NoChanges", synced = "Synced"
            case needsReview = "NeedsReview", accessRequired = "AccessRequired", unconfirmed = "Unconfirmed"
            case paused = "Paused", failed = "Failed", notChecked = "NotChecked"
        }

        struct Child: Codable, Equatable, Sendable {
            let id: UUID
            let occurrenceID: String
            let linkRevision: Int
            let activationRevision: Int
        }

        let id: UUID
        let account: Account
        let bindingRevision: Int
        let authEpoch: Int
        let sequence: Int
        let setupOperationID: UUID?
        var startedAtMs: Int64?
        var finishedAtMs: Int64?
        var outcome: Outcome?
        var reason: String?
        var children: [Child]?
        var changedSeries: Set<String>?
        var checked = 0
        var changed = 0
        var pages = 0
        var imported = 0
        var published = 0
        var review = 0
        var pending = 0

        var retryable: Bool { outcome == nil || outcome == .pending || outcome == .unconfirmed }
    }

    struct ModeReceipt: Codable, Equatable, Sendable {
        let account: Account
        let expectedRevision: Int
        let revision: Int
        let mode: Mode
        var reviewID: UUID? = nil
        var selections: [String]? = nil
    }

    struct ResumeExport: Codable, Equatable, Sendable {
        let operationID: UUID
        let local: RemiloIOSGoogleCalendarPublication.Local
        let originLease: Lease
        let waitingLease: Lease?

        var itemID: String { "export:" + local.occurrenceID }
    }

    struct ResumeImport: Codable, Equatable, Sendable {
        let observation: Inbox.Observation
        let review: Import.Review
        let choices: Import.Choices

        var itemID: String { "candidate:" + observation.eventID }
    }

    struct ResumeLink: Codable, Equatable, Sendable {
        let id: UUID
        let occurrenceID: String
        let source: RemiloIOSGoogleCalendarManualLink.Source
        let linkRevision: Int
        let priorLease: Lease
        let reviewedDigest: Data

        var itemID: String { "association:" + occurrenceID }
    }

    struct ResumeSeries: Codable, Equatable, Sendable {
        let importID: UUID
        let familyID: String
        let source: Import.SourceKey
        let priorLease: Lease
        let observation: Inbox.Observation
        let digest: Data

        var itemID: String { "association:" + familyID }
    }

    struct ResumeReview: Sendable {
        let id: UUID
        let account: Account
        let binding: Binding
        let bindingRevision: Int
        let authEpoch: Int
        let policy: Policy
        let exports: [ResumeExport]
        let imports: [ResumeImport]
        let links: [ResumeLink]
        let series: [ResumeSeries]
        let expiresAtMs: Int64
    }

    /// Built from an exact CalendarList lookup. For a lost creation response,
    /// the recovery candidate comes from a completed exact-marker scan.
    struct Observation: Sendable {
        let record: Record
        let account: Account
        let verifiedEmail: String
        let recoveryCandidateID: String?

        init(record: Record, account: Account, verifiedEmail: String, recoveryCandidateID: String? = nil) {
            self.record = record
            self.account = account
            self.verifiedEmail = verifiedEmail
            self.recoveryCandidateID = recoveryCandidateID
        }
    }

    private struct State: Codable {
        var schemaVersion = 1
        var bindingRevision = 1
        var authEpoch = 0
        var policy = Policy()
        var binding: Binding?
        var pendingOperationID: UUID?
        var operations: [UUID: Entry] = [:]
        var savedMode: Mode?
        var modeReceipts: [UUID: ModeReceipt]?
        var stoppedCreationID: UUID?
        var resumedExports: [ResumeExport]?
        var heldIncomingIDs: Set<String>?
        var heldIncomingObservations: [Inbox.Observation]?
        var resumedIncomingIDs: Set<String>?
        var resumedImports: [ResumeImport]?
        var resumedLinkProofs: [ResumeLink]?
        var resumedSeriesProofs: [ResumeSeries]?
        var resumeCheckpointScope: Inbox.Scope?
        var resetIncomingCursor: Bool?
        var initialAllDayAlarmMinutes: Int?
        var policyReceipts: [UUID: PolicyReceipt]?
        var syncRequests: [UUID: SyncRequest]?

        var mode: Mode { savedMode ?? (binding == nil ? .disabled : .enabled) }
    }

    private let directory: URL
    private let now: @Sendable () -> Int64
    private var file: URL { directory.appendingPathComponent("managed-setup-journal.json", isDirectory: false) }

    init(directory: URL, now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.directory = directory
        self.now = now
    }

    static func local() throws -> RemiloIOSGoogleCalendarManagedSetupJournal {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return Self(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    func view(viewingAs account: Account? = nil) throws -> View {
        let state = try read()
        let binding: Binding? = state.binding.flatMap { binding in
            guard let account, binding.belongs(to: account) else { return nil }
            return binding
        }
        let pending: UUID? = state.pendingOperationID.flatMap { id in
            guard let account, let entry = state.operations[id], Self.sameOwner(entry.account, account) else { return nil }
            return id
        }
        let retiredCreation: UUID? = state.stoppedCreationID.flatMap { id in
            guard let account, let entry = state.operations[id], Self.sameOwner(entry.account, account),
                  entry.retired, entry.phase == .sent, entry.returnedCalendarID == nil else { return nil }
            return id
        }
        return View(bindingRevision: state.bindingRevision, authEpoch: state.authEpoch, policy: state.policy,
                    binding: binding, pendingOperationID: pending, retiredCreationOperationID: retiredCreation,
                    mode: binding != nil || pending != nil ? state.mode : .disabled)
    }

    func operation(_ id: UUID, viewingAs account: Account) throws -> Entry? {
        guard let entry = try read().operations[id], Self.sameOwner(entry.account, account) else { return nil }
        return entry
    }

    func modeOperation(_ id: UUID, viewingAs account: Account) throws -> ModeReceipt? {
        guard let receipt = try read().modeReceipts?[id], Self.sameOwner(receipt.account, account) else { return nil }
        return receipt
    }

    private static func current(_ request: SyncRequest, state: State, account: Account) -> Bool {
        request.account == account && request.bindingRevision == state.bindingRevision && request.authEpoch == state.authEpoch &&
            request.setupOperationID == state.pendingOperationID
    }

    func captureSyncRequest(_ id: UUID, account: Account) throws -> SyncRequest {
        var state = try read()
        if let saved = state.syncRequests?[id] {
            guard Self.sameOwner(saved.account, account) else { throw Failure.operationReused }
            return saved
        }
        guard state.operations[id] == nil, state.modeReceipts?[id] == nil, state.policyReceipts?[id] == nil else {
            throw Failure.operationReused
        }
        var requests = state.syncRequests ?? [:]
        let request = SyncRequest(id: id, account: account, bindingRevision: state.bindingRevision,
                                  authEpoch: state.authEpoch, sequence: requests.count + 1, setupOperationID: state.pendingOperationID)
        requests[id] = request
        state.syncRequests = requests
        try write(state)
        return request
    }

    func syncRequest(_ id: UUID, account: Account) throws -> (request: SyncRequest, current: Bool)? {
        let state = try read()
        guard let request = state.syncRequests?[id], Self.sameOwner(request.account, account) else { return nil }
        return (request, Self.current(request, state: state, account: account))
    }

    func latestSyncRequest(account: Account, pendingOnly: Bool = false) throws -> SyncRequest? {
        let state = try read()
        let latest = state.syncRequests?.values.filter { Self.current($0, state: state, account: account) }
            .max { $0.sequence < $1.sequence }
        return pendingOnly && latest?.retryable != true ? nil : latest
    }

    func checkpointSyncRequest(_ request: SyncRequest, account: Account) throws {
        var state = try read()
        guard let saved = state.syncRequests?[request.id], saved.sequence == request.sequence,
              Self.current(saved, state: state, account: account), saved.retryable else { throw Failure.staleConnection }
        state.syncRequests?[request.id] = request
        try write(state)
    }

    func reviewPolicy(_ proposed: Policy, account: Account) throws -> PolicyReview {
        let state = try read()
        guard state.pendingOperationID == nil, state.binding?.belongs(to: account) != false,
              proposed.revision == state.policy.revision else { throw Rejection.stalePreview }
        guard (0...1439).contains(proposed.allDayAlarmMinutes), !proposed.disableGoogleReminders else { throw Failure.invalidInput }
        return .init(id: UUID(), account: account, bindingRevision: state.bindingRevision, authEpoch: state.authEpoch,
                     policy: proposed, expiresAtMs: now() + 600_000)
    }

    func policyOperation(_ id: UUID, account: Account) throws -> PolicyReceipt? {
        guard let receipt = try read().policyReceipts?[id], Self.sameOwner(receipt.account, account) else { return nil }
        return receipt
    }

    func policyReplay(_ id: UUID, reviewID: UUID, account: Account) throws -> PolicyReceipt? {
        let state = try read()
        if let receipt = state.policyReceipts?[id] {
            guard Self.sameOwner(receipt.account, account), receipt.reviewID == reviewID else { throw Failure.operationReused }
            return receipt
        }
        guard state.operations[id] == nil, state.modeReceipts?[id] == nil, state.syncRequests?[id] == nil else {
            throw Failure.operationReused
        }
        return nil
    }

    func applyPolicy(_ review: PolicyReview, operationID: UUID, account: Account) throws -> PolicyReceipt {
        if let saved = try policyReplay(operationID, reviewID: review.id, account: account) { return saved }
        var state = try read()
        guard review.account == account, state.pendingOperationID == nil, state.binding?.belongs(to: account) != false,
              state.bindingRevision == review.bindingRevision, state.authEpoch == review.authEpoch,
              state.policy.revision == review.policy.revision, now() <= review.expiresAtMs else { throw Rejection.stalePreview }
        if let binding = state.binding, state.mode != .disabled {
            let prior = Self.inboxScope(binding, in: state)
            state.resumeCheckpointScope = try savedIncomingScope(prior, in: state)
            if state.initialAllDayAlarmMinutes == nil,
               try !managedInbox().progress(state.resumeCheckpointScope ?? prior, pages: 0, continuation: false).initialComplete {
                state.initialAllDayAlarmMinutes = state.policy.allDayAlarmMinutes
            }
            if !state.policy.automaticImport && review.policy.automaticImport { state.resetIncomingCursor = true }
        }
        var policy = review.policy
        policy.revision = try Self.advance(state.policy.revision)
        state.bindingRevision = try Self.advance(state.bindingRevision)
        state.policy = policy
        let receipt = PolicyReceipt(account: account, reviewID: review.id, revision: state.bindingRevision, policy: policy)
        var receipts = state.policyReceipts ?? [:]
        receipts[operationID] = receipt
        state.policyReceipts = receipts
        try write(state)
        return receipt
    }

    func incomingScope(_ account: Account) throws -> RemiloIOSGoogleCalendarManagedInbox.Scope {
        let state = try read()
        let binding = try Self.activeBinding(in: state, account: account)
        return Self.inboxScope(binding, in: state)
    }

    func outgoingBinding(_ account: Account, explicit: Bool) throws -> Binding? {
        let state = try read()
        guard explicit || state.policy.exportNewReminders else { return nil }
        return try Self.activeBinding(in: state, account: account)
    }

    /// A paused binding can still identify held intent. Only activeBinding can
    /// grant authority to send it or associate a read-back with a reminder.
    func captureOutgoingBinding(_ account: Account, explicit: Bool) throws -> Binding? {
        let state = try read()
        guard (explicit || state.policy.exportNewReminders), state.pendingOperationID == nil else { return nil }
        if state.mode == .paused { return Self.heldBinding(in: state, account: account) }
        return try Self.activeBinding(in: state, account: account)
    }

    func heldBinding(_ account: Account) throws -> Binding? {
        Self.heldBinding(in: try read(), account: account)
    }

    func heldIncomingScope(_ account: Account) throws -> RemiloIOSGoogleCalendarManagedInbox.Scope? {
        let state = try read()
        guard let binding = Self.heldBinding(in: state, account: account) else { return nil }
        return Self.inboxScope(binding, in: state)
    }

    private static func inboxScope(_ binding: Binding, in state: State) -> Inbox.Scope {
        .init(binding: binding, policy: state.policy, heldEventIDs: state.heldIncomingIDs, resumedEventIDs: state.resumedIncomingIDs,
              initialAllDayAlarmMinutes: state.initialAllDayAlarmMinutes)
    }

    func heldIncomingObservations(_ account: Account) throws -> [Inbox.Observation] {
        let state = try read()
        guard state.policy.automaticImport, let binding = Self.heldBinding(in: state, account: account) else { return [] }
        return try collectHeldIncoming(binding, state: state)
    }

    private func collectHeldIncoming(_ binding: Binding, state: State) throws -> [Inbox.Observation] {
        var byID: [String: Inbox.Observation] = [:]
        for eventID in state.heldIncomingIDs ?? [] {
            byID[eventID] = .init(eventID: eventID, etag: nil, kind: .needsReview(reason: "STALE_REMOTE"),
                                 importMode: .none, initialRecovery: true)
        }
        for observation in state.heldIncomingObservations ?? [] { byID[observation.eventID] = observation }
        for approval in state.resumedImports ?? [] { byID[approval.observation.eventID] = approval.observation }
        let current = Self.inboxScope(binding, in: state)
        let saved = try savedIncomingScope(current, in: state)
        for observation in try managedInbox().staged(saved ?? current) {
            if let prior = byID[observation.eventID] {
                byID[observation.eventID] = .init(eventID: observation.eventID, etag: observation.etag, kind: observation.kind,
                    importMode: prior.importMode, initialRecovery: prior.initialRecovery, instanceCancelled: observation.instanceCancelled,
                    initialCohort: prior.initialCohort ?? observation.initialCohort,
                    allDayAlarmMinutes: prior.allDayAlarmMinutes ?? observation.allDayAlarmMinutes)
            } else {
                byID[observation.eventID] = observation
            }
        }
        return byID.values.sorted { $0.eventID < $1.eventID }
    }

    private func savedIncomingScope(_ current: Inbox.Scope, in state: State) throws -> Inbox.Scope? {
        try managedInbox().savedScope(matching: [current] + (state.resumeCheckpointScope.map { [$0] } ?? []))
    }

    func resumeInboxCheckpoint(_ scope: Inbox.Scope, account: Account) throws {
        var state = try read()
        guard let binding = try? Self.activeBinding(in: state, account: account), Self.inboxScope(binding, in: state) == scope else {
            throw Failure.staleConnection
        }
        if let prior = state.resumeCheckpointScope {
            let reviewed = (state.resumedImports ?? []).map(\.observation) + (state.resumedSeriesProofs ?? []).map(\.observation)
            try managedInbox().resumeCheckpoint(from: prior, to: scope, reviewed: reviewed, resetCursor: state.resetIncomingCursor == true)
        }
        if state.resetIncomingCursor == true {
            state.resetIncomingCursor = nil
            try write(state)
        }
    }

    func resumedImports(_ account: Account) throws -> [ResumeImport] {
        let state = try read()
        guard (try? Self.activeBinding(in: state, account: account)) != nil else { return [] }
        return state.resumedImports ?? []
    }

    func finishResumedImport(_ approval: ResumeImport, scope: Inbox.Scope, account: Account) throws {
        var state = try read()
        guard let binding = try? Self.activeBinding(in: state, account: account), Self.inboxScope(binding, in: state) == scope,
              var approvals = state.resumedImports, approvals.contains(approval) else { return }
        approvals.removeAll { $0 == approval }
        state.resumedImports = approvals.isEmpty ? nil : approvals
        try write(state)
    }

    nonisolated static func sameDestination(_ lease: Lease, as binding: Binding) -> Bool {
        lease.setupID == binding.operationID && lease.calendarID == binding.record.id && lease.zoneID == binding.record.zoneId
    }

    func resumedLinks(_ account: Account) throws -> [(ResumeLink, Lease)] {
        let state = try read()
        guard let binding = try? Self.activeBinding(in: state, account: account) else { return [] }
        return (state.resumedLinkProofs ?? []).map { item in
            (item, item.priorLease.publication == true ? binding.exportLease : binding.linkLease)
        }
    }

    func finishResumedLink(_ approval: ResumeLink, lease: Lease, account: Account) throws {
        guard try resumedLinks(account).contains(where: { $0.0 == approval && $0.1 == lease }) else { return }
        var state = try read()
        state.resumedLinkProofs?.removeAll { $0 == approval }
        try write(state)
    }

    func resumedSeries(_ account: Account) throws -> [ResumeSeries] {
        let state = try read()
        guard (try? Self.activeBinding(in: state, account: account)) != nil else { return [] }
        return state.resumedSeriesProofs ?? []
    }

    func finishResumedSeries(_ approval: ResumeSeries, lease: Lease, account: Account) throws {
        guard try incomingScope(account).binding.linkLease == lease, try resumedSeries(account).contains(approval) else { return }
        var state = try read()
        state.resumedSeriesProofs?.removeAll { $0 == approval }
        try write(state)
    }

    func holdsExport(_ lease: Lease, account: Account) throws -> Bool {
        let state = try read()
        guard state.mode != .disabled, let binding = state.binding, binding.belongs(to: account),
              binding.account.accountGeneration == account.accountGeneration, Self.sameDestination(lease, as: binding) else { return false }
        return state.mode == .paused || lease != binding.exportLease
    }

    func resumedExports(_ account: Account) throws -> [ResumeExport] {
        let state = try read()
        guard (try? Self.activeBinding(in: state, account: account)) != nil else { return [] }
        return state.resumedExports ?? []
    }

    func reviewResume(account: Account, binding: Binding, exports: [ResumeExport], imports: [ResumeImport] = [],
                      links: [ResumeLink] = [], series: [ResumeSeries] = []) throws -> ResumeReview {
        let state = try read()
        let associationIDs = links.map(\.itemID) + series.map(\.itemID)
        guard state.pendingOperationID == nil, Self.heldBinding(in: state, account: account) == binding,
              exports.count + imports.count + associationIDs.count <= 500, Set(exports.map(\.itemID)).count == exports.count,
              Set(exports.map(\.operationID)).count == exports.count,
              exports.allSatisfy({ Self.sameDestination($0.originLease, as: binding) &&
                  ($0.waitingLease.map { Self.sameDestination($0, as: binding) } ?? true) }) else { throw Rejection.stalePreview }
        let known = try Set(heldIncomingObservations(account).map(\.eventID))
        guard Set(imports.map(\.itemID)).count == imports.count,
              imports.allSatisfy({ item in
                  known.contains(item.observation.eventID) && item.review.account == account &&
                    item.review.source.key == .init(subject: account.subject, calendarID: binding.record.id, eventID: item.observation.eventID) &&
                    item.review.source.etag == item.observation.etag && item.choices.mode == item.observation.importMode &&
                    item.choices.allDayAlarmMinutes == (item.observation.allDayAlarmMinutes ?? state.policy.allDayAlarmMinutes) &&
                    item.choices.automaticSync && !item.choices.disableGoogleReminders
              }) else { throw Rejection.stalePreview }
        guard Set(associationIDs).count == associationIDs.count, links.allSatisfy({ item in
            let lease = item.priorLease
            return item.source.belongs(to: account) && item.source.calendarID == lease.calendarID &&
                item.reviewedDigest.count == 32 && Self.sameDestination(lease, as: binding) &&
                lease.authEpoch <= binding.authEpoch
        }) else { throw Rejection.stalePreview }
        let incomingIDs = imports.map { $0.observation.eventID } + series.map { $0.observation.eventID }
        guard Set(incomingIDs).count == incomingIDs.count, series.allSatisfy({ item in
            item.source.subject == account.subject && item.source.calendarID == binding.record.id &&
                item.observation.eventID == item.source.eventID && item.observation.kind == .recurringMaster &&
                item.observation.etag != nil && item.digest.count == 32 && item.priorLease.publication != true &&
                Self.sameDestination(item.priorLease, as: binding) && item.priorLease.authEpoch <= binding.authEpoch
        }) else { throw Rejection.stalePreview }
        return .init(id: UUID(), account: account, binding: binding, bindingRevision: state.bindingRevision,
                     authEpoch: state.authEpoch, policy: state.policy, exports: exports, imports: imports, links: links, series: series,
                     expiresAtMs: now() + 600_000)
    }

    func resumeReplay(_ operationID: UUID, reviewID: UUID, selections: [String], account: Account) throws -> ModeReceipt? {
        let state = try read()
        if let receipt = state.modeReceipts?[operationID] {
            guard Self.sameOwner(receipt.account, account), receipt.mode == .enabled, receipt.reviewID == reviewID,
                  receipt.selections == selections else { throw Failure.operationReused }
            return receipt
        }
        guard state.operations[operationID] == nil, state.syncRequests?[operationID] == nil,
              state.policyReceipts?[operationID] == nil else { throw Failure.operationReused }
        return nil
    }

    func resume(_ review: ResumeReview, operationID: UUID, selections: [String], account: Account,
                verified: Record) throws -> ModeReceipt {
        if let receipt = try resumeReplay(operationID, reviewID: review.id, selections: selections, account: account) { return receipt }
        var state = try read()
        guard account == review.account, state.pendingOperationID == nil,
              Self.heldBinding(in: state, account: account) == review.binding,
              state.bindingRevision == review.bindingRevision, state.authEpoch == review.authEpoch,
              state.policy == review.policy, now() <= review.expiresAtMs,
              verified.id == review.binding.record.id, verified.zoneId == review.binding.record.zoneId else { throw Rejection.stalePreview }
        let approved = review.exports.filter { selections.contains($0.itemID) }
        let approvedImports = review.imports.filter { selections.contains($0.itemID) }
        let approvedLinks = review.links.filter { selections.contains($0.itemID) }
        let approvedSeries = review.series.filter { selections.contains($0.itemID) }
        let approvedIDs = Set(approvedImports.map { $0.observation.eventID } + approvedSeries.map { $0.observation.eventID })
        guard approved.count + approvedImports.count + approvedLinks.count + approvedSeries.count == selections.count else {
            throw Failure.invalidInput
        }
        let old = Self.inboxScope(review.binding, in: state)
        let saved = try savedIncomingScope(old, in: state)
        let inbox = try managedInbox().progress(saved ?? old, pages: 0, continuation: false)
        let held = try collectHeldIncoming(review.binding, state: state).filter { !approvedIDs.contains($0.eventID) }
        guard held.count <= 10_000 else { throw Failure.discoveryLimit }
        state.heldIncomingIDs = held.isEmpty ? nil : Set(held.map(\.eventID))
        state.heldIncomingObservations = held.isEmpty ? nil : held
        state.resumeCheckpointScope = saved
        let initialImport: InitialImport? = inbox.initialComplete
            ? .init(mode: state.policy.importMode, recoveringExistingCalendar: false) : review.binding.initialImport
        if inbox.initialComplete { state.initialAllDayAlarmMinutes = nil }
        state.bindingRevision = try Self.advance(state.bindingRevision)
        state.authEpoch = try Self.advance(state.authEpoch)
        state.binding = .init(operationID: review.binding.operationID, account: account, record: verified,
            revision: state.bindingRevision, authEpoch: state.authEpoch, initialImport: initialImport)
        state.savedMode = .enabled
        state.resumedExports = approved
        state.resumedIncomingIDs = approvedIDs.isEmpty ? nil : approvedIDs
        state.resumedImports = approvedImports.isEmpty ? nil : approvedImports
        state.resumedLinkProofs = approvedLinks.isEmpty ? nil : approvedLinks
        state.resumedSeriesProofs = approvedSeries.isEmpty ? nil : approvedSeries
        let receipt = ModeReceipt(account: account, expectedRevision: review.bindingRevision, revision: state.bindingRevision,
                                  mode: .enabled, reviewID: review.id, selections: selections)
        var receipts = state.modeReceipts ?? [:]
        receipts[operationID] = receipt
        state.modeReceipts = receipts
        try write(state)
        return receipt
    }

    private static func heldBinding(in state: State, account: Account) -> Binding? {
        guard state.mode == .paused, let binding = state.binding, binding.belongs(to: account),
              binding.account.accountGeneration == account.accountGeneration else { return nil }
        return binding
    }

    private static func activeBinding(in state: State, account: Account) throws -> Binding {
        // The binding revision in a lease identifies the authorization grant.
        // Policy edits advance the editable revision without replacing the grant.
        guard state.mode == .enabled, let binding = state.binding, binding.belongs(to: account),
              binding.account.accountGeneration == account.accountGeneration,
              binding.revision <= state.bindingRevision, binding.authEpoch == state.authEpoch,
              state.pendingOperationID == nil else { throw Failure.staleConnection }
        return binding
    }

    func changeMode(_ mode: Mode, operationID: UUID, expectedRevision: Int, account: Account) throws -> ModeReceipt {
        guard mode == .paused || mode == .disabled else { throw Failure.invalidInput }
        var state = try read()
        if let saved = state.modeReceipts?[operationID] {
            guard Self.sameOwner(saved.account, account), saved.expectedRevision == expectedRevision,
                  saved.mode == mode else { throw Failure.operationReused }
            return saved
        }
        guard state.operations[operationID] == nil, state.syncRequests?[operationID] == nil,
              state.policyReceipts?[operationID] == nil else { throw Failure.operationReused }
        guard expectedRevision == state.bindingRevision else { throw Rejection.stalePreview }
        let ownsBinding = state.binding?.belongs(to: account) == true
        let pending = state.pendingOperationID.flatMap { state.operations[$0] }
        let ownsPending = pending.map { Self.sameOwner($0.account, account) } == true
        // The journal has one active scope. Do not mutate another account's
        // pending setup when applying a command from a previously bound account.
        guard pending == nil || ownsPending else { throw Failure.staleConnection }
        guard ownsBinding || ownsPending else { throw Failure.notFound }
        if mode == .paused, !ownsBinding || state.mode == .disabled { throw Failure.invalidInput }
        if var pending {
            pending.retired = true
            state.operations[pending.operationID] = pending
            state.pendingOperationID = nil
            if pending.phase == .sent, pending.returnedCalendarID == nil { state.stoppedCreationID = pending.operationID }
        }
        state.bindingRevision = try Self.advance(state.bindingRevision)
        state.authEpoch = try Self.advance(state.authEpoch)
        state.savedMode = mode
        state.resumedLinkProofs = nil
        state.resumedSeriesProofs = nil
        if mode == .disabled { state.resumedImports = nil }
        let receipt = ModeReceipt(account: account, expectedRevision: expectedRevision, revision: state.bindingRevision, mode: mode)
        var receipts = state.modeReceipts ?? [:]
        receipts[operationID] = receipt
        state.modeReceipts = receipts
        try write(state)
        return receipt
    }

    func managedInbox() -> RemiloIOSGoogleCalendarManagedInbox { .init(directory: directory) }

    func permitsLink(_ lease: RemiloIOSGoogleCalendarManualLink.ManagedLease, account: Account) throws -> Bool {
        do {
            if lease.publication == true { return try outgoingBinding(account, explicit: true)?.exportLease == lease }
            return try incomingScope(account).binding.linkLease == lease
        }
        catch Failure.staleConnection { return false }
    }

    func review(_ discovery: Connection.ManagedDiscoveryResult, account: Account, policy: Policy? = nil,
                calendarZoneID: String, replacing: UUID? = nil, freshInstallation: Bool = false) throws -> Review {
        guard account.connectionRevision > 0, account.accountGeneration > 0 else { throw Failure.invalidInput }
        guard discovery.account == account, discovery.preparingCreation == nil else { throw Failure.staleConnection }
        let state = try read()
        let proposed = policy ?? state.policy
        guard proposed.revision == state.policy.revision else { throw Rejection.stalePreview }
        guard (0...1439).contains(proposed.allDayAlarmMinutes), !proposed.disableGoogleReminders else { throw Failure.invalidInput }
        let target: Target
        let name: String
        let zoneID: String
        let recovering: Bool
        switch discovery.selection.outcome {
        case .incomplete: throw Rejection.discoveryIncomplete
        case .savedUnavailable: throw discovery.selection.savedFailure ?? Failure.remoteUnavailable
        case .choose: throw Rejection.selectionRequired
        case .create:
            guard (try? RemiloIOSGoogleCalendarEvent.namedZone(calendarZoneID)) != nil else { throw Failure.invalidZone }
            target = .create(zoneID: calendarZoneID)
            name = "Remilo"
            zoneID = calendarZoneID
            recovering = false
        case .candidate:
            guard let candidate = discovery.selection.selected else { throw Rejection.selectionRequired }
            if let failure = candidate.failure { throw failure }
            target = .select(calendarID: candidate.record.id)
            name = candidate.record.name
            zoneID = candidate.record.zoneId
            recovering = freshInstallation
        }

        if let pending = state.pendingOperationID, let entry = state.operations[pending], Self.sameOwner(entry.account, account) {
            guard replacing == pending else { throw Rejection.operationPending }
        } else if let binding = state.binding, binding.belongs(to: account),
                  target != .select(calendarID: binding.record.id) {
            guard replacing == binding.operationID else { throw Rejection.selectionRequired }
        } else if replacing != nil {
            throw Rejection.stalePreview
        }
        return Review(id: UUID(), account: account, scanID: discovery.scanID, policy: proposed, target: target,
                      calendarName: name, calendarZoneID: zoneID, replacesOperationID: replacing,
                      initialImport: InitialImport(mode: recovering ? .none : proposed.importMode, recoveringExistingCalendar: recovering),
                      bindingRevision: state.bindingRevision, authEpoch: state.authEpoch, checkedAtMs: now())
    }

    func capture(operationID: UUID, review: Review, currentAccount: Account) throws -> Entry {
        var state = try read()
        guard state.modeReceipts?[operationID] == nil, state.syncRequests?[operationID] == nil,
              state.policyReceipts?[operationID] == nil else { throw Failure.operationReused }
        if let existing = state.operations[operationID] {
            guard Self.sameOwner(existing.account, currentAccount), existing.review == review else { throw Failure.operationReused }
            return existing
        }
        let (age, overflow) = now().subtractingReportingOverflow(review.checkedAtMs)
        guard review.account == currentAccount else { throw Failure.staleConnection }
        guard review.bindingRevision == state.bindingRevision, review.authEpoch == state.authEpoch,
              review.policy.revision == state.policy.revision, !overflow, (0...600_000).contains(age) else {
            throw Rejection.stalePreview
        }
        if let pending = state.pendingOperationID, var prior = state.operations[pending] {
            if Self.sameOwner(prior.account, currentAccount), pending != review.replacesOperationID {
                throw Rejection.operationPending
            }
            prior.retired = true
            state.operations[pending] = prior
        }
        state.bindingRevision = try Self.advance(state.bindingRevision)
        state.authEpoch = try Self.advance(state.authEpoch)
        let entry = Entry(operationID: operationID, review: review, bindingRevision: state.bindingRevision,
                          authEpoch: state.authEpoch, account: currentAccount)
        state.pendingOperationID = operationID
        state.operations[operationID] = entry
        try write(state)
        return entry
    }

    /// Only an explicit same-account consent result can replace the original lease.
    func reauthorize(_ id: UUID, from: Account, to: Account) throws -> Entry {
        var state = try read()
        var entry = try active(id, currentAccount: from, in: state)
        guard Self.sameOwner(from, to), from.accountGeneration == to.accountGeneration,
              to.connectionRevision == (try Self.advance(from.connectionRevision)) else { throw Failure.staleConnection }
        entry.account = to
        state.operations[id] = entry
        try write(state)
        return entry
    }

    func recordSetupSelectionRequired(_ id: UUID, currentAccount: Account) throws {
        var state = try read()
        var entry = try active(id, currentAccount: currentAccount, in: state)
        guard entry.phase == .captured else { throw Failure.staleConnection }
        entry.reason = Rejection.selectionRequired.rawValue
        state.operations[id] = entry
        try write(state)
    }

    /// Called at the last synchronous point before dispatch, with current live authority.
    func beginSend(_ request: Writer.ManagedCreation, currentAccount: Account) throws -> Writer.Permission {
        var state = try read()
        var entry = try active(request.operationID, currentAccount: currentAccount, in: state)
        guard entry.creationRequest == request else { throw Failure.operationReused }
        if entry.phase == .sent { return .alreadySent }
        guard entry.phase == .captured else { throw Failure.invalidInput }
        entry.phase = .sent
        entry.sentRequest = request
        state.operations[request.operationID] = entry
        try write(state)
        return .granted
    }

    /// This records evidence for the exact sent request even if the user has
    /// since retired it. It cannot change the current binding or lease.
    @discardableResult
    func rememberReturnedID(_ calendarID: String, for request: Writer.ManagedCreation) throws -> Entry {
        guard RemiloIOSGoogleCalendarTransport.validIdentity(calendarID) else { throw Failure.invalidResponse }
        var state = try read()
        guard var entry = state.operations[request.operationID] else { throw Failure.notFound }
        guard entry.sentRequest == request else { throw Failure.operationReused }
        guard entry.phase == .sent || entry.phase == .confirmed else { throw Failure.invalidResponse }
        if let saved = entry.returnedCalendarID {
            guard saved == calendarID else { throw Failure.invalidResponse }
            return entry
        }
        if let confirmed = entry.confirmedCalendar, confirmed.id != calendarID { throw Failure.invalidResponse }
        entry.returnedCalendarID = calendarID
        state.operations[request.operationID] = entry
        try write(state)
        return entry
    }

    /// Use only for a definitive rejection classified by the creation transport.
    @discardableResult
    func recordCreationRejection(_ reason: Failure, for request: Writer.ManagedCreation) throws -> Entry {
        guard [.badRequest, .auth, .forbidden].contains(reason) else { throw Failure.invalidInput }
        var state = try read()
        guard var entry = state.operations[request.operationID] else { throw Failure.notFound }
        guard entry.sentRequest == request else { throw Failure.operationReused }
        if entry.phase == .rejected, entry.reason == reason.rawValue { return entry }
        guard entry.phase == .sent, entry.returnedCalendarID == nil else { throw Failure.invalidResponse }
        entry.phase = .rejected
        entry.reason = reason.rawValue
        state.operations[request.operationID] = entry
        try write(state)
        return entry
    }

    @discardableResult
    func activate(_ id: UUID, observation: Observation, currentAccount: Account) throws -> Entry {
        var state = try read()
        guard observation.account == currentAccount else { throw Failure.staleConnection }
        if let confirmed = state.operations[id], confirmed.phase == .confirmed,
           confirmed.account == currentAccount, confirmed.confirmedCalendar?.id == observation.record.id,
           let binding = state.binding, binding.operationID == id, binding.belongs(to: currentAccount),
           binding.revision == state.bindingRevision, binding.authEpoch == state.authEpoch { return confirmed }
        var entry = try active(id, currentAccount: currentAccount, in: state)
        let record = observation.record
        if let failure = Discovery.eligibility(record, verifiedEmail: observation.verifiedEmail) { throw failure }
        switch entry.review.target {
        case .select(let calendarID):
            guard entry.phase == .captured, record.id == calendarID else { throw Failure.invalidResponse }
        case .create:
            let expectedID = entry.returnedCalendarID ?? observation.recoveryCandidateID
            guard entry.phase == .sent, record.id == expectedID, record.setupReference == id else {
                throw Rejection.creationUnconfirmed
            }
        }
        entry.phase = .confirmed
        entry.confirmedCalendar = record
        state.binding = Binding(operationID: id, account: currentAccount, record: record,
                                revision: entry.bindingRevision, authEpoch: entry.authEpoch, initialImport: entry.review.initialImport)
        state.policy = entry.review.policy
        state.policy.revision = try Self.advance(state.policy.revision)
        state.savedMode = .enabled
        state.resumedExports = nil
        state.heldIncomingIDs = nil
        state.heldIncomingObservations = nil
        state.resumedIncomingIDs = nil
        state.resumedImports = nil
        state.resumedLinkProofs = nil
        state.resumedSeriesProofs = nil
        state.resumeCheckpointScope = nil
        state.resetIncomingCursor = nil
        state.initialAllDayAlarmMinutes = nil
        state.pendingOperationID = nil
        state.operations[id] = entry
        try write(state)
        return entry
    }

    @discardableResult
    func retire(_ id: UUID, currentAccount: Account) throws -> Entry {
        var state = try read()
        guard var entry = state.operations[id] else { throw Failure.notFound }
        guard entry.account == currentAccount else { throw Failure.staleConnection }
        if entry.retired { return entry }
        entry = try active(id, currentAccount: currentAccount, in: state)
        entry.retired = true
        state.bindingRevision = try Self.advance(state.bindingRevision)
        state.authEpoch = try Self.advance(state.authEpoch)
        state.pendingOperationID = nil
        state.operations[id] = entry
        try write(state)
        return entry
    }

    private func active(_ id: UUID, currentAccount: Account, in state: State) throws -> Entry {
        guard let entry = state.operations[id] else { throw Failure.notFound }
        guard !entry.retired, entry.account == currentAccount, state.pendingOperationID == id,
              state.bindingRevision == entry.bindingRevision, state.authEpoch == entry.authEpoch,
              state.policy.revision == entry.review.policy.revision else { throw Failure.staleConnection }
        return entry
    }

    private static func sameOwner(_ lhs: Account, _ rhs: Account) -> Bool {
        lhs.subject == rhs.subject && lhs.clientID == rhs.clientID
    }

    private static func advance(_ revision: Int) throws -> Int {
        let (next, overflow) = revision.addingReportingOverflow(1)
        guard !overflow else { throw Failure.invalidInput }
        return next
    }

    private func read() throws -> State {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: file))
            guard state.schemaVersion == 1 else { throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema }
            if let id = state.pendingOperationID {
                guard let entry = state.operations[id], entry.operationID == id, !entry.retired,
                      entry.bindingRevision == state.bindingRevision, entry.authEpoch == state.authEpoch else {
                    throw RemiloIOSGoogleCalendarStore.Failure.invalidState
                }
            }
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
