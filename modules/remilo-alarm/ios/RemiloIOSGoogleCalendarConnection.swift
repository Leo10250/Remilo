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

/// One process-owned actor serializes the protected connection and discovery
/// checkpoints. It never owns reminder state or holds a lock across HTTP.
actor RemiloIOSGoogleCalendarConnection {
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Purpose = RemiloIOSGoogleCalendarPurpose
    typealias State = RemiloIOSCalendarConnectionState
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Authorize = @Sendable (_ expectedSubject: String?, _ purpose: Purpose) async throws -> RemiloIOSGoogleCalendarAccess

    enum Consent: Equatable, Sendable {
        case connectOrChangeAccount, reauthorizeCurrentAccount, managedCreation
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
        let revocation: RemiloIOSCalendarRevocation
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
    func connectFromUserAction(expectedRevision: Int, consent: Consent, authorize: Authorize) async throws -> View {
        guard let configuration else { throw Failure.invalidConfiguration }
        guard revocationInFlight == nil else { throw Failure.revocationInProgress }
        guard !consentInFlight else { throw Failure.needsAccess }
        let original = try store.read()
        guard original.revision == expectedRevision else { throw Failure.staleConnection }
        let subject: String?
        let purpose: Purpose
        switch consent {
        case .connectOrChangeAccount:
            subject = nil
            purpose = .ownedCalendars
        case .reauthorizeCurrentAccount, .managedCreation:
            guard let account = original.account, original.connected, account.clientID == configuration.clientID else {
                throw Failure.needsAccess
            }
            subject = account.subject
            purpose = consent == .managedCreation ? .createManagedCalendar : .ownedCalendars
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
        current.revision = try advance(current.revision)
        current.connected = true
        current.account = State.Account(subject: access.account.subject, email: access.account.email, clientID: access.clientID)
        current.revocation = .notRequested
        current.discovery = nil
        guard let fence = Fence(current) else { throw Failure.staleConnection }
        try store.write(current)
        cancelReads()
        credentials = LiveAccess(fence: fence, access: access)
        return project(current)
    }

    func disconnect(operationID: String, expectedRevision: Int) async throws -> DisconnectResult {
        guard !operationID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              operationID.utf8.count <= 200 else { throw Failure.invalidInput }
        var state = try store.read()
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

    func browseEvents(expectedRevision: Int, calendarID: String, from: String, until: String,
                      nextCursor: EventCursor? = nil, zone: TimeZone = .current,
                      dispositions: [Event.SourceKey: Event.SourceDisposition] = [:]) async throws -> EventPage {
        let live = try requireAccess(expectedRevision)
        let range = try Event.Range(from: from, until: until, zone: zone)
        if let nextCursor, nextCursor.fence != live.fence || nextCursor.calendarID != calendarID || nextCursor.range != range {
            throw Failure.staleCursor
        }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        let calendar = try await read(live) { transport, access in
            try await transport.ownedCalendar(access, id: calendarID, budget: budget)
        }
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
        let access: Access
        if configuration == nil { access = .unavailable }
        else if !connected { access = .disconnected }
        else if let credentials, credentials.fence == Fence(state), credentials.access.supports(.ownedCalendars, now: now()) {
            access = credentials.access.supports(.createManagedCalendar, now: now()) ? .managedCreation : .ownedCalendars
        } else { access = .needsAccess }
        return View(revision: state.revision, accountGeneration: state.accountGeneration, connected: connected,
                    available: configuration != nil, email: state.account?.email ?? "", access: access,
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
