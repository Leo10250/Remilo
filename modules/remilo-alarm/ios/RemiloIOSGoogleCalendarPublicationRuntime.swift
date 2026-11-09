import Foundation

@MainActor
final class RemiloIOSGoogleCalendarPublicationRuntime {
    typealias Publication = RemiloIOSGoogleCalendarPublication
    typealias Journal = RemiloIOSGoogleCalendarPublicationJournal
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias ManagedLease = Journal.ManagedLease

    enum Rejection: String, Error {
        case stalePreview = "STALE_PREVIEW"
        case selectionRequired = "SELECTION_REQUIRED"
        case ineligible = "INELIGIBLE"
    }

    struct LocalSnapshot: Codable, Equatable, Sendable {
        let version: Publication.Local
        let fields: Publication.Event.Fields
    }

    struct LocalAuthority: Sendable {
        typealias Checkpoint = @MainActor @Sendable () throws -> Writer.Permission
        let read: @MainActor @Sendable (String) throws -> LocalSnapshot?
        let permit: @MainActor @Sendable (LocalSnapshot, @escaping Checkpoint) async throws -> Writer.Permission
        var permitsManagedExport: @MainActor @Sendable (String, UUID, ManagedLease, Publication.Account) throws -> Bool = { _, _, _, _ in false }
    }

    struct ManagedCandidate: Sendable {
        let occurrenceID: String
        let operationID: UUID
        let lease: ManagedLease
        let calendarName: String
    }

    struct Preview: Sendable {
        let local: LocalSnapshot
        let account: Publication.Account
        let calendar: RemiloIOSCalendarOwnedRecord
        let email: String
        let fingerprint: String
        let checkedAtMs: Int64
    }

    struct Status: Sendable {
        let entry: Journal.Entry
        let readOnly: Bool
        let differs: Bool
        let canReviewAgain: Bool

        var canRetry: Bool { entry.phase == .sent || (entry.phase == .waiting && !readOnly) }
    }

    private let connection: Connection
    private let journal: Journal
    private let local: LocalAuthority
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let now: @Sendable () -> Int64
    private var previews: [Preview] = []
    private var running = Set<UUID>()
    private var managedCursor: String?

    init(connection: Connection, journal: Journal, local: LocalAuthority,
         canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.connection = connection
        self.journal = journal
        self.local = local
        self.canUseForeground = canUseForeground
        self.now = now
    }

    func selectDestination(_ calendarID: String, operationID: UUID, expectedConnectionRevision: Int) async throws -> Int {
        try requireForeground()
        return try await connection.selectPublicationDestination(operationID: operationID, expectedRevision: expectedConnectionRevision,
                                                                 calendarID: calendarID, canCommit: canUseForeground)
    }

    func preview(occurrenceID: String, expectedConnectionRevision: Int) throws -> Preview {
        let account = try viewingAccount(expectedConnectionRevision)
        let view = try connection.view()
        guard let destination = view.publicationDestination else { throw Rejection.selectionRequired }
        guard let snapshot = try local.read(occurrenceID) else { throw Rejection.ineligible }
        try journal.requireUnreserved(occurrenceID)
        let validation = try makeRequest(UUID(), account: account, calendarID: destination.id, snapshot: snapshot)
        let checked = now()
        previews.removeAll {
            $0.account != account || !fresh($0, at: checked) || $0.local.version.occurrenceID == occurrenceID
        }
        if previews.count == 8 { previews.removeFirst() }
        let result = Preview(local: snapshot, account: account, calendar: destination, email: view.email,
                             fingerprint: try validation.fingerprint().base64EncodedString(), checkedAtMs: checked)
        previews.append(result)
        return result
    }

    func confirm(operationID: UUID, occurrenceID: String, expectedLocalRevision: Int,
                 expectedConnectionRevision: Int, fingerprint: String) async throws -> Journal.Entry {
        let viewer = try viewingAccount(expectedConnectionRevision)
        if let saved = try journal.operation(operationID, viewingAs: viewer) {
            guard saved.managedLease == nil, saved.identity.local.occurrenceID == occurrenceID, saved.identity.local.revision == expectedLocalRevision,
                  saved.identity.account.connectionRevision == expectedConnectionRevision,
                  saved.reviewFingerprint == fingerprint else { throw Failure.operationReused }
            return try await run(saved, viewer: viewer)
        }
        guard let review = previews.first(where: { $0.fingerprint == fingerprint }), fresh(review, at: now()),
              review.account == viewer, review.local.version.occurrenceID == occurrenceID,
              review.local.version.revision == expectedLocalRevision,
              try local.read(occurrenceID) == review.local else { throw Rejection.stalePreview }
        try connection.requirePublicationSend(account: viewer, calendarID: review.calendar.id)
        let request = try makeRequest(operationID, account: viewer, calendarID: review.calendar.id, snapshot: review.local)
        let entry = try journal.capture(request, reviewFingerprint: fingerprint, calendarName: review.calendar.name)
        return try await run(entry, viewer: viewer)
    }

    func retry(_ operationID: UUID, expectedConnectionRevision: Int) async throws -> Journal.Entry {
        let viewer = try viewingAccount(expectedConnectionRevision)
        guard let saved = try journal.operation(operationID, viewingAs: viewer) else { throw Failure.notFound }
        return try await run(saved, viewer: viewer)
    }

    func retire(_ operationID: UUID, expectedConnectionRevision: Int) throws -> Journal.Entry {
        try journal.retire(operationID, viewingAs: viewingAccount(expectedConnectionRevision))
    }

    func operations(expectedConnectionRevision: Int) throws -> [Status] {
        try journal.operations(viewingAs: viewingAccount(expectedConnectionRevision)).map(status)
    }

    func status(_ entry: Journal.Entry) throws -> Status {
        let snapshot = try local.read(entry.identity.local.occurrenceID)
        let localDiffers = try snapshot.map { try entry.identity.matches($0.fields) == false } ?? false
        return Status(entry: entry, readOnly: entry.retired || snapshot == nil,
                      differs: localDiffers || entry.confirmation?.remoteDiffers == true,
                      canReviewAgain: snapshot != nil && (entry.phase == .failed || entry.phase == .cancelled))
    }

    func reservedEvents(viewingAs account: Publication.Account, calendarID: String) throws -> Set<String> {
        try journal.reservedEvents(viewingAs: account, calendarID: calendarID)
    }

    func publishedIdentity(_ occurrenceID: String, viewingAs account: Publication.Account) throws -> Publication.ReadbackIdentity? {
        try journal.operations(viewingAs: account).first {
            $0.identity.local.occurrenceID == occurrenceID && $0.phase == .published && $0.confirmation != nil
        }?.identity
    }

    func pendingManagedLinks(expectedConnectionRevision: Int) throws -> [Journal.Entry] {
        try journal.operations(viewingAs: viewingAccount(expectedConnectionRevision)).filter {
            $0.managedLease != nil && $0.phase == .published && !$0.retired && $0.managedLink == nil
        }
    }

    func permitsManagedLink(_ entry: Journal.Entry, viewingAs account: Publication.Account) throws -> Bool {
        let identity = entry.identity
        guard let lease = entry.managedLease, entry.phase == .published, !entry.retired,
              entry.managedLink == nil, entry.confirmation?.remoteDiffers == false,
              identity.account.accountGeneration == account.accountGeneration,
              try journal.operation(identity.operationID, viewingAs: account) == entry else { return false }
        return try local.permitsManagedExport(identity.local.occurrenceID, identity.operationID, lease, account)
    }

    func finishManagedLink(_ entry: Journal.Entry, reason: String?) throws {
        try journal.finishManagedLink(entry, reason: reason)
    }

    /// The native engine supplies active intents. Already-sent operations also
    /// get a read-back opportunity after the originating intent is retired.
    func syncManaged(_ candidates: [ManagedCandidate], expectedConnectionRevision: Int) async throws -> [Journal.Entry] {
        let viewer = try viewingAccount(expectedConnectionRevision)
        let saved = Dictionary(uniqueKeysWithValues: try journal.operations(viewingAs: viewer)
            .filter { $0.managedLease != nil }.map { ($0.identity.operationID, $0) })
        let candidateByID = Dictionary(candidates.map { ($0.operationID, $0) }, uniquingKeysWith: { first, _ in first })
        let pending = Set(saved.values.filter { $0.phase == .sent || $0.phase == .waiting }.map(\.identity.operationID))
            .union(candidates.filter { saved[$0.operationID] == nil }.map(\.operationID))
        let ids = pending.sorted { $0.uuidString < $1.uuidString }
        guard !ids.isEmpty else { return [] }
        let start = managedCursor.flatMap { cursor in ids.firstIndex { $0.uuidString > cursor } } ?? 0
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var results: [Journal.Entry] = []
        for offset in 0..<min(ids.count, 4) {
            guard !Task.isCancelled, budget.hasTimeRemaining, try viewingAccount(expectedConnectionRevision) == viewer else { break }
            let id = ids[(start + offset) % ids.count]
            managedCursor = id.uuidString
            guard !running.contains(id) else { continue }
            do {
                let result: Journal.Entry
                if let entry = saved[id], entry.phase == .sent || candidateByID[id] == nil {
                    result = try await run(entry, viewer: viewer, budget: budget)
                } else if let candidate = candidateByID[id],
                          let entry = try captureManaged(candidate, viewer: viewer) {
                    result = try await run(entry, viewer: viewer, budget: budget)
                } else {
                    continue
                }
                if saved[id] != result { results.append(result) }
            } catch Journal.Rejection.alreadyPublished { continue }
            catch Journal.Rejection.operationPending { continue }
            catch Failure.budget { break }
            catch Failure.staleConnection { break }
            catch is Failure { continue }
            catch is RemiloIOSGoogleCalendarManualLink.Failure { continue }
        }
        return results
    }

    private func captureManaged(_ candidate: ManagedCandidate, viewer: Publication.Account) throws -> Journal.Entry? {
        guard let snapshot = try local.read(candidate.occurrenceID),
              try local.permitsManagedExport(candidate.occurrenceID, candidate.operationID, candidate.lease, viewer) else { return nil }
        let request = try makeRequest(candidate.operationID, account: viewer, calendarID: candidate.lease.calendarID, snapshot: snapshot)
        return try journal.capture(request, reviewFingerprint: request.fingerprint().base64EncodedString(),
                                   calendarName: candidate.calendarName, managedLease: candidate.lease)
    }

    private func run(_ entry: Journal.Entry, viewer: Publication.Account,
                     budget: RemiloIOSGoogleCalendarHTTP.Budget = .init()) async throws -> Journal.Entry {
        let identity = entry.identity
        guard entry.phase == .waiting || entry.phase == .sent else { return entry }
        guard running.insert(identity.operationID).inserted else { throw Journal.Rejection.operationPending }
        defer { running.remove(identity.operationID) }
        let outcome: Publication.Outcome
        if entry.phase == .sent {
            outcome = try await connection.withPublicationAccess(
                captured: identity.account, expectedRevision: viewer.connectionRevision, canRead: canUseForeground
            ) { writer, access in
                try await writer.checkPublication(identity, access: access, budget: budget)
            }
        } else {
            guard identity.account == viewer, let snapshot = try local.read(identity.local.occurrenceID),
                  snapshot.version == identity.local else {
                return try journal.retire(identity.operationID, viewingAs: viewer)
            }
            let request = try makeRequest(identity.operationID, account: viewer, calendarID: identity.calendarID, snapshot: snapshot)
            guard try request.readbackIdentity() == identity else {
                return try journal.retire(identity.operationID, viewingAs: viewer)
            }
            if let lease = entry.managedLease,
               try !local.permitsManagedExport(identity.local.occurrenceID, identity.operationID, lease, viewer) {
                return try journal.retire(identity.operationID, viewingAs: viewer)
            }
            try requireSend(request, managedLease: entry.managedLease)
            do {
                outcome = try await connection.withPublicationAccess(
                    captured: identity.account, expectedRevision: viewer.connectionRevision, canRead: canUseForeground
                ) { [self] writer, access in
                    try await writer.publish(request, access: access, phase: .notSent, budget: budget,
                                             managedLease: entry.managedLease) { captured in
                        try await self.permit(snapshot, request: captured, managedLease: entry.managedLease)
                    }
                }
            } catch Rejection.stalePreview {
                if entry.managedLease != nil { return entry }
                return try journal.retire(identity.operationID, viewingAs: viewer)
            }
        }
        guard try viewingAccount(viewer.connectionRevision) == viewer else { throw Failure.staleConnection }
        return try journal.record(identity, outcome: outcome)
    }

    private func permit(_ snapshot: LocalSnapshot, request: Publication.Request, managedLease: ManagedLease?) async throws -> Writer.Permission {
        try await local.permit(snapshot) { [self] in
            guard canUseForeground() else { return .denied(.needsAccess) }
            try requireSend(request, managedLease: managedLease)
            return try journal.beginSend(request)
        }
    }

    private func requireSend(_ request: Publication.Request, managedLease: ManagedLease?) throws {
        if let managedLease {
            guard try local.permitsManagedExport(request.local.occurrenceID, request.operationID, managedLease, request.account) else {
                throw Rejection.stalePreview
            }
            try connection.requireManualLinkWrite(account: request.account)
        } else {
            try connection.requirePublicationSend(account: request.account, calendarID: request.calendarID)
        }
    }

    private func makeRequest(_ operationID: UUID, account: Publication.Account, calendarID: String,
                             snapshot: LocalSnapshot) throws -> Publication.Request {
        try Publication.Request(operationID: operationID, account: account, local: snapshot.version,
                                calendarID: calendarID, reviewed: snapshot.fields, source: .localOneOff)
    }

    private func fresh(_ preview: Preview, at now: Int64) -> Bool {
        now >= preview.checkedAtMs && now - preview.checkedAtMs <= 600_000
    }

    private func viewingAccount(_ revision: Int) throws -> Publication.Account {
        try requireForeground()
        return try connection.savedAccount(expectedRevision: revision)
    }

    private func requireForeground() throws {
        guard canUseForeground() else { throw Failure.needsAccess }
    }
}
