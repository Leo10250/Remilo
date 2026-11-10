import Foundation

/// Runs reviewed managed setup in the foreground. Google I/O stays outside
/// the journal's synchronous permission and binding mutations.
@MainActor
final class RemiloIOSGoogleCalendarManagedSetup {
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias Journal = RemiloIOSGoogleCalendarManagedSetupJournal
    typealias Account = Journal.Account
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Inbox = RemiloIOSGoogleCalendarManagedInbox

    struct Preview: Sendable {
        let discovery: Connection.ManagedDiscoveryResult
        let review: Journal.Review?
        let sample: Connection.ManagedSample?
    }

    enum Progress: Sendable {
        case pending(Journal.Entry)
        case finished(Journal.Entry)
    }

    private let connection: Connection
    private let journal: Journal
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let authorize: Connection.Authorize
    private let freshInstallation: @MainActor () throws -> Bool
    private let inbox: Inbox
    private let now: @Sendable () -> Date
    private var reviews: [Journal.Review] = []
    private var running: Set<UUID> = []
    private var scanningIncoming = false

    init(connection: Connection, journal: Journal, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         freshInstallation: @escaping @MainActor () throws -> Bool = { false },
         now: @escaping @Sendable () -> Date = { Date() },
         authorize: @escaping Connection.Authorize) {
        self.connection = connection
        self.journal = journal
        self.canUseForeground = canUseForeground
        self.authorize = authorize
        self.freshInstallation = freshInstallation
        self.inbox = journal.managedInbox()
        self.now = now
    }

    /// One bounded foreground pass. The durable inbox stages source versions
    /// for subsequent exact import or reconciliation, independent of delivery.
    func scanIncoming(expectedRevision: Int, budget: RemiloIOSGoogleCalendarHTTP.Budget = .init()) async throws -> Inbox.Progress {
        guard !scanningIncoming else { throw Journal.Rejection.operationPending }
        scanningIncoming = true
        defer { scanningIncoming = false }
        let account = try currentAccount(expectedRevision)
        let scope = try journal.incomingScope(account)
        let calendar = try await connection.verifyManagedAdoption(calendarID: scope.binding.record.id, account: account,
                                                                  budget: budget, canRead: canUseForeground)
        let fence: @MainActor @Sendable () throws -> Void = { [self] in
            guard try currentAccount(expectedRevision) == account, try journal.incomingScope(account) == scope else {
                throw Failure.staleConnection
            }
        }
        try fence()
        guard calendar.zoneId == scope.binding.record.zoneId else { throw Journal.Rejection.stalePreview }
        var pages = 0
        while pages < 10 {
            let request = try inbox.request(scope)
            let page: Connection.Transport.Page<Connection.Transport.Event>
            do {
                page = try await connection.managedEventPage(request, account: account, budget: budget, beforeRead: fence)
            } catch Failure.budget {
                try fence()
                return try inbox.progress(scope, pages: pages, continuation: true)
            } catch Failure.syncTokenExpired {
                try fence()
                try inbox.expire(request)
                return try inbox.progress(scope, pages: pages, continuation: true)
            }
            try fence()
            try inbox.record(page, request: request, now: Int64((now().timeIntervalSince1970 * 1_000).rounded()))
            pages += 1
            if page.next == nil { return try inbox.progress(scope, pages: pages, continuation: false) }
        }
        return try inbox.progress(scope, pages: pages, continuation: true)
    }

    func view(expectedRevision: Int) throws -> Journal.View {
        try requireForeground()
        do { return try journal.view(viewingAs: connection.savedAccount(expectedRevision: expectedRevision)) }
        catch Failure.needsAccess { return try journal.view() }
    }

    func outgoingBinding(explicit: Bool) throws -> Journal.Binding? {
        try requireForeground()
        let account = try connection.savedAccount(expectedRevision: connection.view().revision)
        return try journal.outgoingBinding(account, explicit: explicit)
    }

    func hasActiveIncomingBinding(expectedRevision: Int) throws -> Bool {
        let account = try currentAccount(expectedRevision)
        do {
            _ = try journal.incomingScope(account)
            return true
        } catch Failure.staleConnection { return false }
    }

    func activeSeriesLease(_ account: Account) throws -> RemiloIOSGoogleCalendarManualLink.ManagedLease? {
        guard canUseForeground(), try connection.isCurrentAccount(account) else { return nil }
        do { return try journal.incomingScope(account).binding.linkLease }
        catch Failure.staleConnection { return nil }
    }

    func permitsIncoming(_ permit: Inbox.Permit, account: Account) throws -> Bool {
        guard canUseForeground(), try connection.isCurrentAccount(account) else { return false }
        let scope: Inbox.Scope
        do { scope = try journal.incomingScope(account) }
        catch Failure.staleConnection { return false }
        guard scope == permit.scope else { return false }
        return try inbox.permits(permit)
    }

    func finishIncoming(_ permit: Inbox.Permit, account: Account, reviewReason: String?) throws {
        guard canUseForeground(), try connection.isCurrentAccount(account) else { throw Failure.staleConnection }
        let scope: Inbox.Scope
        do { scope = try journal.incomingScope(account) }
        catch Failure.staleConnection { return }
        guard scope == permit.scope else { return }
        try inbox.finish(permit, reviewReason: reviewReason)
    }

    func operation(_ id: UUID, expectedRevision: Int) throws -> Journal.Entry? {
        try requireForeground()
        return try journal.operation(id, viewingAs: connection.savedAccount(expectedRevision: expectedRevision))
    }

    /// A same-account read grant can inspect a sent receipt after its lease or
    /// binding changes. This entry point never authorizes or activates setup.
    func inspectCreation(_ id: UUID, expectedRevision: Int) async throws -> Connection.ManagedCreationCheck {
        let account = try currentAccount(expectedRevision)
        guard let entry = try journal.operation(id, viewingAs: account) else { throw Failure.notFound }
        return try await observeCreation(entry, account: account)
    }

    func preview(expectedRevision: Int, selectedID: String? = nil, policy: Journal.Policy? = nil,
                 zoneID: String, replacement: Bool = false) async throws -> Preview {
        let account = try currentAccount(expectedRevision)
        let state = try journal.view(viewingAs: account)
        let resume = try connection.managedDiscoveryContinuation(account, purpose: .setup, allowCompleted: selectedID != nil)
        let discovery = try await connection.discoverManagedCalendars(
            expectedRevision: expectedRevision, resume: resume, savedID: state.binding?.record.id, selectedID: selectedID,
            replacingUnavailable: replacement, canRead: canUseForeground
        )
        let sample = try await connection.sampleManagedCalendar(discovery, canRead: canUseForeground)
        guard try currentAccount(expectedRevision) == account, try journal.view(viewingAs: account) == state else {
            throw Journal.Rejection.stalePreview
        }
        guard discovery.selection.outcome == .create || discovery.selection.outcome == .candidate else {
            return Preview(discovery: discovery, review: nil, sample: nil)
        }
        let replacing = replacement ? state.pendingOperationID ?? state.binding?.operationID : nil
        let review = try journal.review(discovery, account: account, policy: policy, calendarZoneID: zoneID,
                                        replacing: replacing, freshInstallation: freshInstallation())
        reviews.removeAll { $0.account != account }
        if reviews.count == 8 { reviews.removeFirst() }
        reviews.append(review)
        return Preview(discovery: discovery, review: review, sample: sample)
    }

    func capture(_ id: UUID, reviewID: UUID, expectedRevision: Int) throws -> Journal.Entry {
        try requireForeground()
        let account = try connection.savedAccount(expectedRevision: expectedRevision)
        if let saved = try journal.operation(id, viewingAs: account) {
            guard saved.review.id == reviewID else { throw Failure.operationReused }
            return saved
        }
        guard let review = reviews.first(where: { $0.id == reviewID }) else { throw Journal.Rejection.stalePreview }
        return try journal.capture(operationID: id, review: review, currentAccount: currentAccount(expectedRevision))
    }

    /// Only a confirmed operation can trigger incremental consent. Granting it
    /// advances the operation's lease but performs no Calendar I/O.
    func authorizeFromUserAction(_ id: UUID, expectedRevision: Int) async throws -> Journal.Entry {
        try requireForeground()
        let before = try connection.savedAccount(expectedRevision: expectedRevision)
        let entry = try pending(id, account: before)
        let consent: Connection.Consent
        if entry.phase == .captured, entry.creationRequest != nil { consent = .managedCreation }
        else if needsWrite(entry) { consent = .writeOwnedEvents }
        else { consent = .reauthorizeCurrentAccount }
        let updated = try await connection.connectFromUserAction(expectedRevision: expectedRevision, consent: consent, canCommit: canUseForeground) {
            [authorize, canUseForeground] subject, purpose in
            guard await canUseForeground() else { throw Failure.needsAccess }
            return try await authorize(subject, purpose)
        }
        return try journal.reauthorize(id, from: before, to: currentAccount(updated.revision))
    }

    /// This never prompts for consent. The caller can resume a partial pass
    /// using the native checkpoint retained for this exact operation.
    func advance(_ id: UUID, expectedRevision: Int) async throws -> Progress {
        let account = try currentAccount(expectedRevision)
        if let entry = try journal.operation(id, viewingAs: account), entry.phase == .confirmed || entry.phase == .rejected {
            return .finished(entry)
        }
        guard running.insert(id).inserted else { throw Journal.Rejection.operationPending }
        defer { running.remove(id) }
        var entry = try pending(id, account: account)
        if entry.phase == .captured, needsWrite(entry) { try connection.requireManualLinkWrite(account: account) }

        let record: Journal.Record
        if case .select(let calendarID) = entry.review.target {
            record = try await connection.verifyManagedAdoption(calendarID: calendarID, account: account, canRead: canUseForeground)
        } else {
            if entry.phase == .captured, let request = entry.creationRequest {
                guard try connection.view().access == .managedCreation else { throw Failure.needsAccess }
                let state = try journal.view(viewingAs: account)
                let resume = try connection.managedDiscoveryContinuation(account, purpose: .prepareCreation(id))
                let discovery = try await connection.discoverManagedCalendars(
                    expectedRevision: expectedRevision, resume: resume, savedID: state.binding?.record.id,
                    replacingUnavailable: entry.review.replacesOperationID != nil, preparingCreation: id, canRead: canUseForeground
                )
                if discovery.selection.outcome == .incomplete { return .pending(try pending(id, account: account)) }
                guard discovery.selection.outcome == .create else { throw Journal.Rejection.selectionRequired }
                let outcome = try await connection.sendManagedCreation(request, discovery: discovery, canSend: canUseForeground,
                    permit: { [journal] sent in try journal.beginSend(sent, currentAccount: account) },
                    rememberReturnedID: { [journal] calendarID, sent in
                        _ = try journal.rememberReturnedID(calendarID, for: sent)
                    })
                switch outcome {
                case .returnedID, .unconfirmed: break
                case .rejected(let reason): return .finished(try journal.recordCreationRejection(reason, for: request))
                case .notSent(let reason): throw reason
                }
                entry = try pending(id, account: currentAccount(expectedRevision))
            }
            let result = try await observeCreation(entry, account: account)
            guard case .verified(let verified) = result else {
                return .pending(try pending(id, account: currentAccount(expectedRevision)))
            }
            record = verified
        }

        guard try currentAccount(expectedRevision) == account else { throw Failure.staleConnection }
        if needsWrite(entry) { try connection.requireManualLinkWrite(account: account) }
        let observation = Journal.Observation(record: record, account: account, verifiedEmail: try connection.view().email,
            recoveryCandidateID: entry.phase == .sent && entry.returnedCalendarID == nil ? record.id : nil)
        return .finished(try journal.activate(id, observation: observation, currentAccount: account))
    }

    private func observeCreation(_ entry: Journal.Entry, account: Account) async throws -> Connection.ManagedCreationCheck {
        guard entry.phase == .sent, let request = entry.sentRequest else { throw Failure.invalidInput }
        let resume: UUID?
        if entry.returnedCalendarID == nil {
            resume = try connection.managedDiscoveryContinuation(account, purpose: .recoverCreation(entry.operationID))
        } else { resume = nil }
        return try await connection.checkManagedCreation(request, expectedRevision: account.connectionRevision,
            returnedID: entry.returnedCalendarID, resume: resume, canRead: canUseForeground)
    }

    private func pending(_ id: UUID, account: Account) throws -> Journal.Entry {
        guard let entry = try journal.operation(id, viewingAs: account) else { throw Failure.notFound }
        guard entry.account == account, !entry.retired, entry.phase == .captured || entry.phase == .sent,
              try journal.view(viewingAs: account).pendingOperationID == id else { throw Failure.staleConnection }
        return entry
    }

    private func needsWrite(_ entry: Journal.Entry) -> Bool {
        let policy = entry.review.policy
        return policy.exportNewReminders || (policy.automaticImport && policy.disableGoogleReminders)
    }

    private func currentAccount(_ revision: Int) throws -> Account {
        try requireForeground()
        return try connection.account(expectedRevision: revision)
    }

    private func requireForeground() throws {
        guard canUseForeground() else { throw Failure.needsAccess }
        try Task.checkCancellation()
    }
}
