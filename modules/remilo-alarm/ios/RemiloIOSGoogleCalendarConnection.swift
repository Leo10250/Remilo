import Foundation

struct RemiloIOSCalendarOwnedRecord: Codable, Equatable, Sendable {
    let id: String
    let name: String
    let zoneId: String
    let underlyingName: String?
    let dataOwner: String?
    let primary: Bool

    init(_ calendar: RemiloIOSGoogleCalendarTransport.OwnedCalendar) throws {
        guard [calendar.displayName, calendar.summary, calendar.timeZone, calendar.dataOwner]
            .allSatisfy({ ($0?.utf8.count ?? 0) <= 4096 }) else { throw RemiloIOSGoogleCalendarFailure.responseLimit }
        id = calendar.id
        name = calendar.displayName ?? ""
        zoneId = calendar.timeZone ?? ""
        underlyingName = calendar.summary
        dataOwner = calendar.dataOwner
        primary = calendar.primary == true
    }
}

/// One process-owned connection serializes protected metadata. Sharing the
/// scheduler's isolation lets a native commit check permission synchronously.
@MainActor
final class RemiloIOSGoogleCalendarConnection {
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Purpose = RemiloIOSGoogleCalendarPurpose
    typealias State = RemiloIOSCalendarConnectionState
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias WriteTransport = RemiloIOSGoogleCalendarWriteTransport
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias Authorize = @Sendable (_ expectedSubject: String?, _ purpose: Purpose) async throws -> RemiloIOSGoogleCalendarAccess

    enum Consent: Equatable, Sendable {
        case connectOrChangeAccount, reauthorizeCurrentAccount, writeOwnedEvents, managedCreation
    }

    enum Access: String, Sendable {
        case unavailable, disconnected, needsAccess, ownedCalendars, managedCreation
    }

    struct View: Sendable {
        let revision: Int
        let accountGeneration: Int
        let connected: Bool
        let available: Bool
        let email: String
        let access: Access
        let canWriteOwnedEvents: Bool
        let publicationDestination: RemiloIOSCalendarOwnedRecord?
        let revocation: RemiloIOSCalendarRevocation
    }

    struct PublicationDestination: Sendable {
        let account: Import.Account
        let calendar: RemiloIOSCalendarOwnedRecord
    }

    struct DisconnectResult: Sendable {
        let revision: Int
        let revocation: RemiloIOSCalendarRevocation
    }

    struct Cursor: Sendable {
        fileprivate let fence: Fence
        fileprivate let page: Transport.PageCursor
    }

    struct OwnedPage: Sendable {
        let items: [RemiloIOSCalendarOwnedRecord]
        let nextCursor: Cursor?
        let connectionRevision: Int
    }

    struct EventCursor: Sendable {
        fileprivate let fence: Fence
        fileprivate let calendarID: String
        fileprivate let range: Event.Range
        fileprivate let page: Transport.PageCursor
    }

    struct EventPage: Sendable {
        let items: [Event.Row]
        let nextCursor: EventCursor?
        let connectionRevision: Int
        let calendarName: String
    }

    struct Discovery: Sendable {
        let id: UUID
        let connectionRevision: Int
        let items: [RemiloIOSCalendarOwnedRecord]
        let complete: Bool
    }

    fileprivate struct Fence: Equatable, Sendable {
        let revision: Int
        let accountGeneration: Int
        let subject: String
        let clientID: String

        init?(_ state: State) {
            guard state.connected, let account = state.account else { return nil }
            revision = state.revision
            accountGeneration = state.accountGeneration
            subject = account.subject
            clientID = account.clientID
        }

        var importAccount: Import.Account {
            Import.Account(subject: subject, clientID: clientID, connectionRevision: revision,
                           accountGeneration: accountGeneration)
        }
    }

    private struct LiveAccess: Sendable {
        let fence: Fence
        let access: RemiloIOSGoogleCalendarAccess
    }

    private let configuration: RemiloIOSGoogleCalendarConfiguration?
    private let store: RemiloIOSGoogleCalendarStore
    private let http: RemiloIOSGoogleCalendarHTTP
    private let transport: Transport
    private let now: @Sendable () -> Date
    private var credentials: LiveAccess?
    private var consentInFlight = false
    private var revocationInFlight: String?
    private var discoveryInFlight = false
    private var reads: [UUID: @Sendable () -> Void] = [:]

    init(configuration: RemiloIOSGoogleCalendarConfiguration?, store: RemiloIOSGoogleCalendarStore,
         http: RemiloIOSGoogleCalendarHTTP = .init(), now: @escaping @Sendable () -> Date = { Date() }) {
        self.configuration = configuration
        self.store = store
        self.http = http
        self.now = now
        self.transport = Transport(http: http, now: now)
    }

    func view() throws -> View { project(try store.read()) }

    /// The presenter must be invoked by an explicit user action. Its UIKit
    /// implementation also checks foreground and protected-data availability.
    func connectFromUserAction(expectedRevision: Int, consent: Consent, canCommit: @MainActor () -> Bool = { true },
                               authorize: Authorize) async throws -> View {
        guard let configuration else { throw Failure.invalidConfiguration }
        guard revocationInFlight == nil else { throw Failure.revocationInProgress }
        guard !consentInFlight, canCommit() else { throw Failure.needsAccess }
        let original = try store.read()
        guard original.revision == expectedRevision else { throw Failure.staleConnection }
        let subject: String?
        let purpose: Purpose
        switch consent {
        case .connectOrChangeAccount:
            subject = nil
            purpose = .ownedCalendars
        case .reauthorizeCurrentAccount, .writeOwnedEvents, .managedCreation:
            guard let account = original.account, original.connected, account.clientID == configuration.clientID else {
                throw Failure.needsAccess
            }
            subject = account.subject
            switch consent {
            case .writeOwnedEvents: purpose = .writeOwnedEvents
            case .managedCreation: purpose = .createManagedCalendar
            default: purpose = .ownedCalendars
            }
        }

        try Task.checkCancellation()
        consentInFlight = true
        defer { consentInFlight = false }
        let access: RemiloIOSGoogleCalendarAccess
        do {
            access = try await authorize(subject, purpose)
        } catch {
            guard try store.read().revision == original.revision else { throw Failure.staleConnection }
            throw error
        }
        try Task.checkCancellation()
        var current = try store.read()
        guard current.revision == original.revision, current.accountGeneration == original.accountGeneration else {
            throw Failure.staleConnection
        }
        guard access.clientID == configuration.clientID, subject == nil || subject == access.account.subject else {
            throw Failure.accountChanged
        }
        guard access.supports(purpose, now: now()) else { throw Failure.needsAccess }
        let changedAccount = current.account?.subject != access.account.subject || current.account?.clientID != access.clientID
        if !current.connected || changedAccount { current.accountGeneration = try advance(current.accountGeneration) }
        if changedAccount { current.publicationDestination = nil }
        current.revision = try advance(current.revision)
        current.connected = true
        current.account = State.Account(subject: access.account.subject, email: access.account.email, clientID: access.clientID)
        current.revocation = .notRequested
        current.discovery = nil
        guard let fence = Fence(current) else { throw Failure.staleConnection }
        guard canCommit() else { throw Failure.needsAccess }
        try store.write(current)
        cancelReads()
        credentials = LiveAccess(fence: fence, access: access)
        return project(current)
    }

    func disconnect(operationID: String, expectedRevision: Int) async throws -> DisconnectResult {
        guard !operationID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              operationID.utf8.count <= 200 else { throw Failure.invalidInput }
        var state = try store.read()
        guard state.destinationReceipts?[operationID] == nil else { throw Failure.operationReused }
        if let receipt = state.disconnectReceipts[operationID] {
            guard receipt.expectedRevision == expectedRevision else { throw Failure.operationReused }
            return DisconnectResult(revision: receipt.revision,
                                    revocation: revocation(receipt.revocation, inFlight: revocationInFlight == operationID))
        }
        guard state.revision == expectedRevision else { throw Failure.staleConnection }
        guard revocationInFlight == nil else { throw Failure.revocationInProgress }
        try Task.checkCancellation()
        let live = credentials.flatMap { Fence(state) == $0.fence ? $0.access : nil }
        let unfinishedConsent = consentInFlight
        let revocationStatus: RemiloIOSCalendarRevocation
        if live != nil { revocationStatus = .pending }
        else if state.connected || unfinishedConsent { revocationStatus = .unconfirmed }
        else { revocationStatus = revocation(state.revocation, inFlight: false) }
        let revision = try advance(state.revision)
        state.revision = revision
        state.accountGeneration = try advance(state.accountGeneration)
        state.connected = false
        state.discovery = nil
        state.publicationDestination = nil
        state.revocation = revocationStatus
        state.disconnectReceipts[operationID] = State.DisconnectReceipt(expectedRevision: expectedRevision, revision: revision,
                                                                        revocation: revocationStatus)
        try store.write(state)
        credentials = nil
        cancelReads()
        guard let live else { return DisconnectResult(revision: revision, revocation: revocationStatus) }

        revocationInFlight = operationID
        defer { revocationInFlight = nil }
        let result: RemiloIOSCalendarRevocation
        do {
            try await live.revoke(using: http)
            result = unfinishedConsent ? .unconfirmed : .revoked
        } catch {
            result = .unconfirmed
        }
        var current = try store.read()
        if current.revision == revision, !current.connected, current.disconnectReceipts[operationID]?.revision == revision {
            current.revocation = result
            current.disconnectReceipts[operationID]?.revocation = result
            try store.write(current)
        }
        return DisconnectResult(revision: revision, revocation: result)
    }

    func ownedCalendars(expectedRevision: Int, nextCursor: Cursor? = nil) async throws -> OwnedPage {
        let live = try requireAccess(expectedRevision)
        if let nextCursor, nextCursor.fence != live.fence { throw Failure.staleConnection }
        let page = try await readOwnedPage(live, next: nextCursor?.page, budget: .init())
        return OwnedPage(items: try page.items.map(RemiloIOSCalendarOwnedRecord.init),
                         nextCursor: page.next.map { Cursor(fence: live.fence, page: $0) }, connectionRevision: live.fence.revision)
    }

    /// Selecting a manual destination is read-only on Google. Capture the exact
    /// resulting revision so an acknowledged selection never retargets a retry.
    func selectPublicationDestination(operationID: UUID, expectedRevision: Int, calendarID: String,
                                      canCommit: @MainActor () -> Bool = { true }) async throws -> Int {
        let id = operationID.uuidString
        func replay(_ state: State) throws -> Int? {
            guard state.disconnectReceipts[id] == nil else { throw Failure.operationReused }
            guard let receipt = state.destinationReceipts?[id] else { return nil }
            guard receipt.calendarID == calendarID, receipt.expectedRevision == expectedRevision else {
                throw Failure.operationReused
            }
            return receipt.revision
        }

        guard canCommit() else { throw Failure.needsAccess }
        if let revision = try replay(store.read()) { return revision }
        let live = try requireAccess(expectedRevision)
        let calendar: RemiloIOSCalendarOwnedRecord
        do {
            calendar = try await verifiedPublicationCalendar(calendarID, live: live)
        } catch {
            guard canCommit() else { throw Failure.needsAccess }
            if let revision = try replay(store.read()) { return revision }
            throw error
        }
        guard canCommit() else { throw Failure.needsAccess }
        var state = try current(live.fence)
        if let revision = try replay(state) { return revision }
        if state.publicationDestination?.calendar.id != calendar.id {
            state.revision = try advance(state.revision)
            state.discovery = nil
        }
        state.publicationDestination = .init(subject: live.fence.subject, clientID: live.fence.clientID, calendar: calendar)
        var receipts = state.destinationReceipts ?? [:]
        receipts[id] = .init(calendarID: calendar.id, expectedRevision: expectedRevision, revision: state.revision)
        state.destinationReceipts = receipts
        guard let fence = Fence(state) else { throw Failure.staleConnection }
        try store.write(state)
        if fence != live.fence {
            credentials = LiveAccess(fence: fence, access: live.access)
            cancelReads()
        }
        return state.revision
    }

    func publicationDestination(expectedRevision: Int, canRead: @MainActor () -> Bool = { true }) async throws -> PublicationDestination? {
        guard canRead() else { throw Failure.needsAccess }
        let live = try requireAccess(expectedRevision)
        let state = try current(live.fence)
        guard let destination = state.publicationDestination else { return nil }
        let calendar = try await verifiedPublicationCalendar(destination.calendar.id, live: live)
        guard canRead() else { throw Failure.needsAccess }
        return PublicationDestination(account: live.fence.importAccount, calendar: calendar)
    }

    /// This synchronous check is called under the scheduler's mutation gate
    /// immediately before the journal commits the sent checkpoint.
    func requirePublicationSend(account: Import.Account, calendarID: String) throws {
        let live = try requireAccess(account.connectionRevision)
        let state = try current(live.fence)
        guard live.fence.importAccount == account, state.publicationDestination?.calendar.id == calendarID else {
            throw Failure.staleConnection
        }
        guard live.access.supports(.writeOwnedEvents, now: now()) else { throw Failure.needsAccess }
    }

    /// A current read grant for the captured subject and OAuth client may
    /// inspect the original event after reauthorization. The send permit
    /// separately requires the exact capture epoch, destination and write grant.
    func withPublicationAccess<Value: Sendable>(
        captured: Import.Account, expectedRevision: Int, canRead: @MainActor () -> Bool = { true },
        operation: @escaping @Sendable (WriteTransport, RemiloIOSGoogleCalendarAccess) async throws -> Value
    ) async throws -> Value {
        guard canRead() else { throw Failure.needsAccess }
        let live = try requireAccess(expectedRevision)
        guard captured.matches(live.access) else { throw Failure.accountChanged }
        let writer = WriteTransport(http: http, now: now)
        let result = try await read(live) { _, access in try await operation(writer, access) }
        guard canRead() else { throw Failure.needsAccess }
        return result
    }

    private func verifiedPublicationCalendar(_ calendarID: String, live: LiveAccess) async throws -> RemiloIOSCalendarOwnedRecord {
        let calendar = try await read(live) { transport, access in
            try await transport.ownedCalendar(access, id: calendarID, budget: .init())
        }
        return try RemiloIOSCalendarOwnedRecord(calendar)
    }

    func observeManualLink(_ evidence: RemiloIOSGoogleCalendarManualLink.Evidence, account: Import.Account,
                           canRead: @escaping @MainActor @Sendable () -> Bool) async throws
        -> RemiloIOSGoogleCalendarManualLink.Observation {
        let live = try requireAccess(account.connectionRevision)
        let source = evidence.source
        guard live.fence.importAccount == account, source.belongs(to: account) else { throw Failure.staleConnection }
        let beforeRead = importReadPermission(account, canRead: canRead)
        let observation = try await read(live) { transport, access in
            let budget = RemiloIOSGoogleCalendarHTTP.Budget()
            try await beforeRead()
            let calendar = try await transport.ownedCalendar(access, id: source.calendarID, budget: budget)
            try await beforeRead()
            let result = try await transport.lookup(access, calendarID: calendar.id, eventID: source.eventID, budget: budget)
            return try RemiloIOSGoogleCalendarManualLink.Observation(evidence: evidence, calendar: calendar, lookup: result)
        }
        guard canRead() else { throw Failure.needsAccess }
        return observation
    }

    func browseEvents(expectedRevision: Int, calendarID: String, from: String, until: String,
                      nextCursor: EventCursor? = nil, zone: TimeZone = .current,
                      dispositions: [Event.SourceKey: Event.SourceDisposition] = [:],
                      canRead: @MainActor () -> Bool = { true }) async throws -> EventPage {
        let live = try requireAccess(expectedRevision)
        let range = try Event.Range(from: from, until: until, zone: zone)
        if let nextCursor, nextCursor.fence != live.fence || nextCursor.calendarID != calendarID || nextCursor.range != range {
            throw Failure.staleCursor
        }
        guard canRead() else { throw Failure.needsAccess }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        let calendar = try await read(live) { transport, access in
            try await transport.ownedCalendar(access, id: calendarID, budget: budget)
        }
        guard canRead() else { throw Failure.needsAccess }
        let page = try await read(live) { transport, access in
            try await transport.events(access, calendarID: calendarID, listing: .masters(from: range.from, until: range.until),
                                       next: nextCursor?.page, budget: budget)
        }
        let items = page.items.compactMap { event in
            let key = Event.SourceKey(subject: live.fence.subject, calendarID: calendarID, eventID: event.id)
            return Event.row(event, calendarZone: calendar.timeZone ?? "", disposition: dispositions[key] ?? .unassociated)
        }
        let next = page.next.map { EventCursor(fence: live.fence, calendarID: calendarID, range: range, page: $0) }
        return EventPage(items: items, nextCursor: next, connectionRevision: live.fence.revision,
                         calendarName: calendar.displayName ?? "")
    }

    func prepareImport(expectedRevision: Int, calendarID: String, eventID: String, recurringChoices: Import.Choices?,
                       canRead: @escaping @MainActor @Sendable () -> Bool) async throws -> Import.Review {
        let live = try requireAccess(expectedRevision)
        guard canRead() else { throw Failure.needsAccess }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        let calendar = try await read(live) { transport, access in
            try await transport.ownedCalendar(access, id: calendarID, budget: budget)
        }
        guard canRead() else { throw Failure.needsAccess }
        let lookup = try await read(live) { transport, access in
            try await transport.lookup(access, calendarID: calendar.id, eventID: eventID, budget: budget)
        }
        guard case .found(let event) = lookup, !event.cancelled else { throw Import.Failure.staleRemote }
        let reviewedAt = Int64((now().timeIntervalSince1970 * 1_000).rounded())
        let account = live.fence.importAccount
        var evidence: Import.RecurrenceEvidence?
        if let recurringChoices {
            let source = try Import.Source(account: account, calendar: calendar, event: event)
            if source.fields.schedule.recurrence != nil {
                let policy = try Import.alertPolicy(for: source, choices: recurringChoices)
                let beforeRead = importReadPermission(account, canRead: canRead)
                evidence = try await read(live) { transport, access in
                    try await RemiloIOSGoogleCalendarRecurringReview.inspect(
                        access: access, calendar: calendar, master: event, now: reviewedAt, alertPolicy: policy,
                        transport: transport, budget: budget, beforeRead: beforeRead
                    )
                }
            }
        }
        return try Import.Review(account: account, calendar: calendar, event: event, now: reviewedAt, recurrenceEvidence: evidence)
    }

    func account(expectedRevision: Int) throws -> Import.Account {
        try requireAccess(expectedRevision).fence.importAccount
    }

    /// Saved results and preview context are local projections. They never
    /// acquire credentials or authorize Google I/O.
    func savedAccount(expectedRevision: Int) throws -> Import.Account {
        let state = try store.read()
        guard state.revision == expectedRevision else { throw Failure.staleConnection }
        guard let configuration, let fence = Fence(state), fence.clientID == configuration.clientID else {
            throw Failure.needsAccess
        }
        return fence.importAccount
    }

    func isCurrentAccount(_ captured: Import.Account) throws -> Bool {
        do { return try account(expectedRevision: captured.connectionRevision) == captured }
        catch Failure.staleConnection { return false }
        catch Failure.needsAccess { return false }
    }

    func observeImport(_ review: Import.Review,
                       canRead: @escaping @MainActor @Sendable () -> Bool) async throws -> Import.Observation {
        let captured = review.account
        let live = try requireAccess(captured.connectionRevision)
        guard live.fence.importAccount == captured else { throw Failure.staleConnection }
        let beforeRead = importReadPermission(captured, canRead: canRead)
        return try await read(live) { transport, access in
            let budget = RemiloIOSGoogleCalendarHTTP.Budget()
            return try await Import.observe(review.source.key, account: captured, access: access, transport: transport,
                                            budget: budget, beforeRead: beforeRead) { calendar, event in
                guard let previous = review.recurrenceEvidence, event.strongETag == previous.masterETag else {
                    throw Import.Failure.staleRemote
                }
                return try await RemiloIOSGoogleCalendarRecurringReview.inspect(
                    access: access, calendar: calendar, master: event, now: previous.referenceMs, alertPolicy: previous.alertPolicy,
                    transport: transport, budget: budget, beforeRead: beforeRead
                )
            }
        }
    }

    private func importReadPermission(_ account: Import.Account, canRead: @escaping @MainActor @Sendable () -> Bool)
        -> @Sendable () async throws -> Void {
        { [self] in try await requireCurrentImportRead(account, canRead: canRead) }
    }

    private func requireCurrentImportRead(_ account: Import.Account, canRead: @MainActor () -> Bool) throws {
        guard canRead() else { throw CancellationError() }
        guard try isCurrentAccount(account) else { throw Failure.staleConnection }
    }

    /// A fresh explicit scan clears prior observations. A resumed scan continues
    /// the exact native cursor and yields after ten pages or its shared I/O budget.
    func discoverOwnedCalendars(expectedRevision: Int, resume: UUID? = nil) async throws -> Discovery {
        guard !discoveryInFlight else { throw Failure.invalidInput }
        let live = try requireAccess(expectedRevision)
        var state = try current(live.fence)
        var checkpoint: State.Discovery
        if let resume {
            guard let saved = state.discovery, saved.id == resume else { throw Failure.staleConnection }
            checkpoint = saved
        } else {
            checkpoint = State.Discovery(id: UUID())
            state.discovery = checkpoint
            try store.write(state)
        }
        discoveryInFlight = true
        defer { discoveryInFlight = false }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        for _ in 0..<10 where !checkpoint.complete {
            let page: Transport.Page<Transport.OwnedCalendar>
            do {
                page = try await readOwnedPage(live, next: checkpoint.next, budget: budget)
            } catch Failure.budget { break }
            var current = try current(live.fence)
            guard current.discovery?.id == checkpoint.id else { throw Failure.staleConnection }
            for calendar in page.items { checkpoint.candidates[calendar.id] = try RemiloIOSCalendarOwnedRecord(calendar) }
            guard checkpoint.candidates.count <= 10_000 else { throw Failure.discoveryLimit }
            checkpoint.next = page.next
            checkpoint.complete = page.next == nil
            current.discovery = checkpoint
            try store.write(current)
        }
        return project(checkpoint, revision: live.fence.revision)
    }

    func discoveryProgress(expectedRevision: Int) throws -> Discovery? {
        let state = try store.read()
        guard state.revision == expectedRevision else { throw Failure.staleConnection }
        guard state.connected, configuration?.clientID == state.account?.clientID else { return nil }
        return state.discovery.map { project($0, revision: state.revision) }
    }

    private func readOwnedPage(_ live: LiveAccess, next: Transport.PageCursor?, budget: RemiloIOSGoogleCalendarHTTP.Budget)
        async throws -> Transport.Page<Transport.OwnedCalendar> {
        try await read(live) { transport, access in
            try await transport.ownedCalendars(access, next: next, budget: budget)
        }
    }

    private func read<Value: Sendable>(_ live: LiveAccess,
                                       operation: @escaping @Sendable (Transport, RemiloIOSGoogleCalendarAccess) async throws -> Value)
        async throws -> Value {
        _ = try current(live.fence)
        try Task.checkCancellation()
        let id = UUID()
        let task = Task { try await operation(transport, live.access) }
        reads[id] = { task.cancel() }
        defer { reads.removeValue(forKey: id) }
        let result: Value
        do {
            result = try await withTaskCancellationHandler { try await task.value } onCancel: { task.cancel() }
        } catch {
            _ = try current(live.fence)
            if let failure = error as? Failure, failure == .auth || failure == .needsAccess {
                credentials = nil
                cancelReads()
            }
            throw error
        }
        _ = try current(live.fence)
        guard live.access.supports(.ownedCalendars, now: now()) else { throw Failure.needsAccess }
        try Task.checkCancellation()
        return result
    }

    private func requireAccess(_ revision: Int) throws -> LiveAccess {
        let state = try store.read()
        guard state.revision == revision else { throw Failure.staleConnection }
        guard let configuration, let credentials, Fence(state) == credentials.fence,
              credentials.access.clientID == configuration.clientID,
              credentials.access.supports(.ownedCalendars, now: now()) else { throw Failure.needsAccess }
        return credentials
    }

    private func current(_ fence: Fence) throws -> State {
        let state = try store.read()
        guard Fence(state) == fence, credentials?.fence == fence else { throw Failure.staleConnection }
        return state
    }

    private func cancelReads() {
        for cancel in reads.values { cancel() }
    }

    private func project(_ state: State) -> View {
        let connected = state.connected && configuration?.clientID == state.account?.clientID
        let grant = credentials.flatMap { $0.fence == Fence(state) ? $0.access : nil }
        let checkedAt = now()
        let access: Access
        if configuration == nil { access = .unavailable }
        else if !connected { access = .disconnected }
        else if let grant, grant.supports(.ownedCalendars, now: checkedAt) {
            access = grant.supports(.createManagedCalendar, now: checkedAt) ? .managedCreation : .ownedCalendars
        } else { access = .needsAccess }
        return View(revision: state.revision, accountGeneration: state.accountGeneration, connected: connected,
                    available: configuration != nil, email: state.account?.email ?? "", access: access,
                    canWriteOwnedEvents: connected && grant?.supports(.writeOwnedEvents, now: checkedAt) == true,
                    publicationDestination: connected ? state.publicationDestination?.calendar : nil,
                    revocation: revocation(state.revocation, inFlight: revocationInFlight != nil))
    }

    private func project(_ discovery: State.Discovery, revision: Int) -> Discovery {
        let items = discovery.candidates.values.sorted { ($0.name, $0.id) < ($1.name, $1.id) }
        return Discovery(id: discovery.id, connectionRevision: revision, items: items, complete: discovery.complete)
    }

    private func revocation(_ stored: RemiloIOSCalendarRevocation, inFlight: Bool) -> RemiloIOSCalendarRevocation {
        stored == .pending && !inFlight ? .unconfirmed : stored
    }

    private func advance(_ counter: Int) throws -> Int {
        guard counter < 9_007_199_254_740_991 else { throw Failure.invalidInput }
        return counter + 1
    }
}
