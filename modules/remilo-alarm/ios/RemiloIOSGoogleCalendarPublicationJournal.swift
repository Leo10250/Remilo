import Foundation

/// The synchronous send checkpoint shares isolation with the reminder engine.
/// Transport may await before or after it, but never during the local permit.
@MainActor
final class RemiloIOSGoogleCalendarPublicationJournal {
    typealias Publication = RemiloIOSGoogleCalendarPublication
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias ManagedLease = RemiloIOSGoogleCalendarManualLink.ManagedLease

    enum Rejection: String, Error {
        case alreadyPublished = "ALREADY_PUBLISHED"
        case operationPending = "OPERATION_PENDING"
    }

    enum Phase: String, Codable, Sendable {
        case waiting, sent, published, conflict, failed, cancelled

        var reservesIdentity: Bool { self == .waiting || self == .sent || self == .published }
    }

    enum ManagedLinkDisposition: Codable, Equatable, Sendable {
        case attached
        case needsReview(String)
    }

    struct Entry: Codable, Equatable, Sendable {
        let identity: Publication.ReadbackIdentity
        let reviewFingerprint: String
        let calendarName: String
        let capturedAtMs: Int64
        let managedLease: ManagedLease?
        fileprivate(set) var phase: Phase = .waiting
        fileprivate(set) var retired = false
        fileprivate(set) var confirmation: Publication.Confirmation?
        fileprivate(set) var confirmedAtMs: Int64?
        fileprivate(set) var reason: String?
        fileprivate(set) var managedLink: ManagedLinkDisposition?
    }

    private struct State: Codable {
        var schemaVersion = 1
        var operations: [UUID: Entry] = [:]
    }

    private let directory: URL
    private let now: @Sendable () -> Int64
    private var file: URL { directory.appendingPathComponent("publication-journal.json", isDirectory: false) }

    init(directory: URL, now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.directory = directory
        self.now = now
    }

    static func local() throws -> RemiloIOSGoogleCalendarPublicationJournal {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return RemiloIOSGoogleCalendarPublicationJournal(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    func capture(_ request: Publication.Request, reviewFingerprint: String, calendarName: String,
                 managedLease: ManagedLease? = nil) throws -> Entry {
        let identity = try request.validated().readbackIdentity()
        guard Data(base64Encoded: reviewFingerprint)?.count == 32,
              managedLease.map({ $0.publication == true && $0.calendarID == identity.calendarID }) ?? true else { throw Failure.invalidInput }
        guard calendarName.utf8.count <= 4096 else { throw Failure.responseLimit }
        var state = try read()
        if let existing = state.operations[request.operationID] {
            guard existing.managedLease == managedLease else { throw Failure.operationReused }
            if existing.identity == identity, existing.reviewFingerprint == reviewFingerprint { return existing }
            // Managed intents can refresh their snapshot before dispatch. The
            // event identity and binding stay fixed across edits and retries.
            guard managedLease != nil, existing.phase == .waiting,
                  Self.sameOwner(existing.identity.account, identity.account),
                  existing.identity.account.accountGeneration == identity.account.accountGeneration,
                  existing.identity.account.connectionRevision <= identity.account.connectionRevision,
                  existing.identity.local.occurrenceID == identity.local.occurrenceID,
                  existing.identity.local.revision <= identity.local.revision,
                  existing.identity.local.generation <= identity.local.generation,
                  existing.identity.eventID == identity.eventID else { throw Failure.operationReused }
        } else {
            try requireUnreserved(identity.local.occurrenceID, in: state)
        }
        let entry = Entry(identity: identity, reviewFingerprint: reviewFingerprint, calendarName: calendarName,
                          capturedAtMs: state.operations[request.operationID]?.capturedAtMs ?? now(), managedLease: managedLease)
        state.operations[request.operationID] = entry
        try write(state)
        return entry
    }

    func requireUnreserved(_ occurrenceID: String) throws {
        try requireUnreserved(occurrenceID, in: read())
    }

    func operation(_ id: UUID, viewingAs account: Publication.Account) throws -> Entry? {
        guard let entry = try read().operations[id], Self.sameOwner(entry.identity.account, account) else { return nil }
        return entry
    }

    func operations(viewingAs account: Publication.Account) throws -> [Entry] {
        try read().operations.values.filter { Self.sameOwner($0.identity.account, account) }.sorted { lhs, rhs in
            if lhs.capturedAtMs != rhs.capturedAtMs { return lhs.capturedAtMs > rhs.capturedAtMs }
            return lhs.identity.operationID.uuidString < rhs.identity.operationID.uuidString
        }
    }

    func reservedEvents(viewingAs account: Publication.Account, calendarID: String) throws -> Set<String> {
        Set(try read().operations.values.compactMap { entry in
            guard Self.sameOwner(entry.identity.account, account), entry.identity.calendarID == calendarID,
                  entry.phase.reservesIdentity else { return nil }
            return entry.identity.eventID
        })
    }

    func finishManagedLink(_ entry: Entry, reason: String?) throws {
        var state = try read()
        let id = entry.identity.operationID
        guard var saved = state.operations[id], saved.identity == entry.identity,
              saved.phase == .published, saved.managedLease != nil else { throw Failure.operationReused }
        guard saved.managedLink == nil else { return }
        saved.managedLink = reason.map(ManagedLinkDisposition.needsReview) ?? .attached
        state.operations[id] = saved
        try write(state)
    }

    /// Call only inside the engine permit after rechecking the active local
    /// snapshot and the exact connection revision, write grant and destination.
    func beginSend(_ request: Publication.Request) throws -> Writer.Permission {
        let identity = try request.validated().readbackIdentity()
        var state = try read()
        guard var entry = state.operations[request.operationID] else { throw Failure.notFound }
        guard entry.identity == identity else { throw Failure.operationReused }
        switch entry.phase {
        case .sent, .published: return .alreadySent
        case .cancelled: return .denied(.cancelled)
        case .conflict, .failed: return .denied(.invalidInput)
        case .waiting:
            entry.phase = .sent
            entry.reason = nil
            state.operations[request.operationID] = entry
            try write(state)
            return .granted
        }
    }

    func record(_ identity: Publication.ReadbackIdentity, outcome: Publication.Outcome) throws -> Entry {
        var state = try read()
        guard var entry = state.operations[identity.operationID] else { throw Failure.notFound }
        guard entry.identity == identity else { throw Failure.operationReused }
        guard entry.phase == .waiting || entry.phase == .sent else { return entry }
        switch outcome {
        case .confirmed(let result):
            guard result.eventID == identity.eventID else { throw Failure.invalidResponse }
            entry.phase = .published
            entry.confirmation = result
            entry.confirmedAtMs = now()
            entry.reason = nil
        case .conflict(let reason):
            entry.phase = .conflict
            entry.reason = reason.rawValue
        case .notSent(let reason):
            guard entry.phase == .waiting else { return entry }
            entry.reason = reason.rawValue
        case .rejected(let reason):
            guard entry.phase == .sent else { throw Failure.invalidResponse }
            entry.phase = .failed
            entry.reason = reason.rawValue
        case .unconfirmed(let reason):
            guard entry.phase == .sent else { throw Failure.invalidResponse }
            entry.reason = reason?.rawValue
        }
        state.operations[identity.operationID] = entry
        try write(state)
        return entry
    }

    /// Retiring an unsent operation removes its write permit. A sent operation
    /// keeps only its exact read-back identity and can never regain a permit.
    func retire(_ id: UUID, viewingAs account: Publication.Account) throws -> Entry {
        var state = try read()
        guard var entry = state.operations[id], Self.sameOwner(entry.identity.account, account) else { throw Failure.notFound }
        if entry.retired { return entry }
        entry.retired = true
        if entry.phase == .waiting {
            entry.phase = .cancelled
            entry.reason = nil
        }
        state.operations[id] = entry
        try write(state)
        return entry
    }

    private static func sameOwner(_ lhs: Publication.Account, _ rhs: Publication.Account) -> Bool {
        lhs.subject == rhs.subject && lhs.clientID == rhs.clientID
    }

    private func requireUnreserved(_ occurrenceID: String, in state: State) throws {
        for entry in state.operations.values where entry.identity.local.occurrenceID == occurrenceID && entry.phase.reservesIdentity {
            if entry.phase == .published { throw Rejection.alreadyPublished }
            throw Rejection.operationPending
        }
    }

    private func read() throws -> State {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: file))
            guard state.schemaVersion == 1 else { throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema }
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
