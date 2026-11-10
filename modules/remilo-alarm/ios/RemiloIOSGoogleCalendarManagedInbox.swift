import Foundation

/// Provider observations are staged separately from alarm mutations. Saving a
/// page and its Google continuation together makes interruptions safe to replay.
@MainActor
final class RemiloIOSGoogleCalendarManagedInbox {
    typealias Journal = RemiloIOSGoogleCalendarManagedSetupJournal
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Mode = RemiloIOSGoogleCalendarImport.Mode
    typealias Failure = RemiloIOSGoogleCalendarFailure

    struct Scope: Codable, Equatable, Sendable {
        let binding: Journal.Binding
        let policy: Journal.Policy
        var heldEventIDs: Set<String>? = nil
        var resumedEventIDs: Set<String>? = nil
    }

    struct Observation: Codable, Equatable, Sendable {
        enum Kind: Codable, Equatable, Sendable {
            case oneTime
            case recurringMaster
            case changedInstance(masterID: String)
            case needsReview(reason: String)
            case removed
        }

        let eventID: String
        let etag: String?
        let kind: Kind
        let importMode: Mode
        let initialRecovery: Bool
        var instanceCancelled: Bool? = nil
    }

    struct Request: Sendable {
        let scope: Scope
        let version: Int
        let since: Transport.SyncCheckpoint?
        let next: Transport.PageCursor?
    }

    struct Progress: Sendable {
        let scope: Scope
        let pages: Int
        let initialComplete: Bool
        let continuation: Bool
        let pending: [Observation]
    }

    struct Permit: Codable, Equatable, Sendable {
        let scope: Scope
        let observation: Observation

        var source: RemiloIOSGoogleCalendarImport.SourceKey {
            .init(subject: scope.binding.account.subject, calendarID: scope.binding.record.id, eventID: observation.eventID)
        }
    }

    private struct State: Codable {
        var schemaVersion = 1
        var scope: Scope
        var version = 0
        var initialComplete = false
        var since: Transport.SyncCheckpoint?
        var next: Transport.PageCursor?
        var observations: [String: Observation] = [:]
    }

    private let directory: URL
    private var file: URL { directory.appendingPathComponent("managed-inbox.json") }

    init(directory: URL) { self.directory = directory }

    func request(_ scope: Scope) throws -> Request {
        let state = try read(scope)
        return Request(scope: scope, version: state.version, since: state.since, next: state.next)
    }

    func record(_ page: Transport.Page<Transport.Event>, request: Request, now: Int64) throws {
        var state = try read(request.scope)
        guard state.version == request.version, (page.next == nil) != (page.checkpoint == nil) else { throw Failure.invalidResponse }
        let initial = request.scope.binding.initialImport
        let mode = state.initialComplete ? request.scope.policy.importMode : initial?.mode ?? .none
        let recovery = !state.initialComplete && (initial?.recoveringExistingCalendar ?? true)
        for event in page.items {
            let existing = state.observations[event.id]
            if request.scope.resumedEventIDs?.contains(event.id) == true, case .needsReview? = existing?.kind { continue }
            if let kind = Self.classify(event, zoneID: request.scope.binding.record.zoneId, now: now) {
                let instanceCancelled: Bool?
                if case .changedInstance = kind { instanceCancelled = event.cancelled }
                else { instanceCancelled = nil }
                state.observations[event.id] = Observation(eventID: event.id, etag: event.strongETag, kind: kind,
                    importMode: existing?.importMode ?? mode, initialRecovery: existing?.initialRecovery ?? recovery,
                    instanceCancelled: instanceCancelled)
            } else if let existing {
                state.observations[event.id] = Observation(eventID: event.id, etag: event.strongETag,
                    kind: .needsReview(reason: "ELAPSED_EVENT"), importMode: existing.importMode, initialRecovery: existing.initialRecovery)
            }
        }
        guard state.observations.count <= 10_000 else { throw Failure.discoveryLimit }
        state.next = page.next
        if let checkpoint = page.checkpoint {
            state.since = checkpoint
            state.initialComplete = true
        }
        try advance(&state)
    }

    /// An expired Google token restarts the read. Only explicit provider
    /// cancellations are removals, so the saved observations survive a rebuild.
    func expire(_ request: Request) throws {
        var state = try read(request.scope)
        guard state.version == request.version, request.since != nil else { throw Failure.syncTokenExpired }
        state.since = nil
        state.next = nil
        try advance(&state)
    }

    func progress(_ scope: Scope, pages: Int, continuation: Bool) throws -> Progress {
        let state = try read(scope)
        return Progress(scope: scope, pages: pages, initialComplete: state.initialComplete,
                        continuation: continuation, pending: state.observations.values
                            .filter { scope.heldEventIDs?.contains($0.eventID) != true }
                            .sorted { $0.eventID < $1.eventID })
    }

    func staged(_ scope: Scope) throws -> [Observation] {
        Array(try read(scope).observations.values)
    }

    func savedScope(matching scopes: [Scope]) throws -> Scope? {
        guard let saved = try savedState(), scopes.contains(saved.scope) else { return nil }
        return saved.scope
    }

    func resumeCheckpoint(from prior: Scope, to current: Scope, reviewed: [Observation]) throws {
        guard prior != current, var saved = try savedState(), saved.scope == prior else { return }
        guard Journal.sameDestination(prior.binding.linkLease, as: current.binding),
              prior.binding.account.subject == current.binding.account.subject,
              prior.binding.account.clientID == current.binding.account.clientID,
              prior.binding.account.accountGeneration == current.binding.account.accountGeneration,
              prior.policy == current.policy, prior.binding.authEpoch < current.binding.authEpoch else {
            throw Failure.staleConnection
        }
        saved.scope = current
        for observation in reviewed where current.resumedEventIDs?.contains(observation.eventID) == true {
            saved.observations[observation.eventID] = observation
        }
        try advance(&saved)
    }

    func reviewedPermit(_ reviewed: Observation, scope: Scope) throws -> Permit? {
        var state = try read(scope)
        guard scope.resumedEventIDs?.contains(reviewed.eventID) == true, state.initialComplete, state.next == nil,
              state.since != nil, reviewed.etag != nil, [.oneTime, .recurringMaster].contains(reviewed.kind) else {
            throw Failure.staleConnection
        }
        let current = state.observations[reviewed.eventID]
        if case .needsReview? = current?.kind { return nil }
        guard current?.kind == reviewed.kind, current?.etag == reviewed.etag else {
            state.observations[reviewed.eventID] = .init(eventID: reviewed.eventID, etag: current?.etag,
                kind: .needsReview(reason: "STALE_REMOTE"), importMode: reviewed.importMode, initialRecovery: reviewed.initialRecovery)
            try advance(&state)
            return nil
        }
        if current != reviewed {
            state.observations[reviewed.eventID] = reviewed
            try advance(&state)
        }
        return .init(scope: scope, observation: reviewed)
    }

    func permits(_ permit: Permit) throws -> Bool {
        try contains(permit) && [.oneTime, .recurringMaster].contains(permit.observation.kind)
    }

    func permitsInstance(_ permit: Permit) throws -> Bool {
        guard case .changedInstance = permit.observation.kind, permit.observation.instanceCancelled == false else { return false }
        return try contains(permit)
    }

    private func contains(_ permit: Permit) throws -> Bool {
        let state = try read(permit.scope)
        return permit.scope.heldEventIDs?.contains(permit.observation.eventID) != true &&
            state.initialComplete && state.next == nil && state.since != nil && permit.observation.etag != nil &&
            state.observations[permit.observation.eventID] == permit.observation
    }

    func finish(_ permit: Permit, reviewReason: String?) throws {
        var state = try read(permit.scope)
        let event = permit.observation
        guard state.observations[event.eventID] == event else { return }
        if let reviewReason {
            state.observations[event.eventID] = Observation(eventID: event.eventID, etag: event.etag,
                kind: .needsReview(reason: reviewReason), importMode: event.importMode, initialRecovery: event.initialRecovery)
        } else {
            state.observations.removeValue(forKey: event.eventID)
        }
        try advance(&state)
    }

    private static func classify(_ event: Transport.Event, zoneID: String, now: Int64) -> Observation.Kind? {
        if let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any],
           let masterID = object["recurringEventId"] as? String, Transport.validIdentity(masterID), masterID != event.id {
            return .changedInstance(masterID: masterID)
        }
        if event.cancelled { return .removed }
        guard let row = Event.row(event, calendarZone: zoneID) else { return .needsReview(reason: "INVALID_EVENT") }
        if let reason = row.unsupportedReason { return .needsReview(reason: reason.rawValue) }
        guard let schedule = row.fields?.schedule else { return .needsReview(reason: "INVALID_EVENT") }
        if schedule.recurrence != nil { return .recurringMaster }
        return schedule.eventEndMs > now ? .oneTime : nil
    }

    private func read(_ scope: Scope) throws -> State {
        if let saved = try savedState(), saved.scope == scope { return saved }
        return State(scope: scope)
    }

    private func savedState() throws -> State? {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: file))
            guard state.schemaVersion == 1 else { throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema }
            return state
        } catch CocoaError.fileReadNoSuchFile { return nil }
    }

    private func advance(_ state: inout State) throws {
        let (next, overflow) = state.version.addingReportingOverflow(1)
        guard !overflow else { throw Failure.invalidInput }
        state.version = next
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
