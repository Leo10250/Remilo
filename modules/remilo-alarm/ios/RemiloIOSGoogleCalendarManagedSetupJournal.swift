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

    enum Target: Codable, Equatable, Sendable {
        case select(calendarID: String)
        case create(zoneID: String)
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
        fileprivate let bindingRevision: Int
        fileprivate let authEpoch: Int
        fileprivate let checkedAtMs: Int64
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
    }

    struct View: Equatable, Sendable {
        let bindingRevision: Int
        let authEpoch: Int
        let policy: Policy
        let binding: Binding?
        let pendingOperationID: UUID?
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
        return View(bindingRevision: state.bindingRevision, authEpoch: state.authEpoch, policy: state.policy,
                    binding: binding, pendingOperationID: pending)
    }

    func operation(_ id: UUID, viewingAs account: Account) throws -> Entry? {
        guard let entry = try read().operations[id], Self.sameOwner(entry.account, account) else { return nil }
        return entry
    }

    func incomingScope(_ account: Account) throws -> RemiloIOSGoogleCalendarManagedInbox.Scope {
        let state = try read()
        guard let binding = state.binding, binding.belongs(to: account), binding.account.accountGeneration == account.accountGeneration,
              binding.revision == state.bindingRevision, binding.authEpoch == state.authEpoch,
              state.pendingOperationID == nil, state.policy.automaticImport else { throw Failure.staleConnection }
        return .init(binding: binding, policy: state.policy)
    }

    func managedInbox() -> RemiloIOSGoogleCalendarManagedInbox { .init(directory: directory) }

    func review(_ discovery: Connection.ManagedDiscoveryResult, account: Account, policy: Policy? = nil,
                calendarZoneID: String, replacing: UUID? = nil, freshInstallation: Bool = false) throws -> Review {
        guard account.connectionRevision > 0, account.accountGeneration > 0 else { throw Failure.invalidInput }
        guard discovery.account == account, discovery.preparingCreation == nil else { throw Failure.staleConnection }
        let state = try read()
        let proposed = policy ?? state.policy
        guard proposed.revision == state.policy.revision else { throw Rejection.stalePreview }
        guard (0...1439).contains(proposed.allDayAlarmMinutes) else { throw Failure.invalidInput }
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
