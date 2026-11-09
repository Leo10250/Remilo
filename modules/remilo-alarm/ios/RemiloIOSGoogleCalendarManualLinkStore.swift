import CryptoKit
import Foundation

/// Manual relationships live beside the other protected Calendar state.
/// Mutations are synchronous so the engine can fence its local snapshot at commit.
@MainActor
final class RemiloIOSGoogleCalendarManualLinkStore {
    typealias Source = RemiloIOSGoogleCalendarManualLink.Source
    typealias Origin = RemiloIOSGoogleCalendarManualLink.Origin
    typealias Account = RemiloIOSGoogleCalendarPublication.Account
    typealias Baseline = RemiloIOSGoogleCalendarComparison.Baseline
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Link = RemiloIOSGoogleCalendarManualLink
    typealias Transfer = Link.Transfer
    typealias LocalSnapshot = RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport

    enum Rejection: String, Error {
        case stalePreview = "STALE_PREVIEW"
        case sourceReserved = "ALREADY_IMPORTED"
        case ineligible = "INELIGIBLE"
        case operationPending = "OPERATION_PENDING"
    }

    enum LinkState: String, Codable, Equatable, Sendable { case linked, detached }

    enum Availability: String, Codable, Equatable, Sendable {
        case available = "Available", unavailable = "Unavailable", deleted = "Deleted"
    }

    struct Check: Codable, Equatable, Sendable {
        let attemptedAtMs: Int64
        let observedAtMs: Int64?
        let availability: Availability?
        let availabilityReason: String
        let remoteDiffers: Bool?
        let errorCode: String
        let requiresReview: Bool
    }

    enum CheckResult: Sendable {
        case available(Link.Observation)
        case unavailable(String)
        case deleted(String)
        case failed(String)
    }

    enum AutomaticIssue: String, Codable, Equatable, Sendable { case review, ringing }

    struct AutomaticConsent: Codable, Equatable, Sendable {
        enum Phase: String, Codable, Equatable, Sendable { case pending, active }

        let phase: Phase
        let activationRevision: Int
        let lifecycleRevision: Int
        let accountGeneration: Int
        let operationID: UUID?
        fileprivate(set) var issue: AutomaticIssue? = nil
        var managedLease: Link.ManagedLease? = nil
    }

    struct Record: Codable, Equatable, Sendable {
        let occurrenceID: String
        let source: Source
        let origin: Origin
        fileprivate(set) var revision: Int
        let state: LinkState
        let baseline: Baseline?
        let calendarName: String
        let observedAtMs: Int64?
        fileprivate(set) var check: Check? = nil
        fileprivate(set) var automatic: AutomaticConsent? = nil
    }

    struct Receipt: Codable, Equatable, Sendable {
        let occurrenceID: String
        let revision: Int
        let state: LinkState
    }

    enum Phase: String, Codable, Equatable, Sendable {
        case waiting, localApplied, sent, confirmed, failed, cancelled

        var pending: Bool { self == .waiting || self == .localApplied || self == .sent }
    }

    struct Operation: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Account
        let source: Source
        let origin: Origin
        let occurrenceID: String
        let linkRevision: Int
        let kind: String
        fileprivate(set) var calendarName: String
        let checkedAtMs: Int64
        fileprivate(set) var phase: Phase = .waiting
        fileprivate(set) var localApplied = false
        fileprivate(set) var remoteAttempted = false
        fileprivate(set) var localStatus: String?
        fileprivate(set) var reason: String?
        fileprivate(set) var resultLinkRevision: Int?
        fileprivate(set) var transfer: Transfer?
        fileprivate(set) var localAfter: LocalSnapshot?
        fileprivate(set) var readback: Link.Readback?
        fileprivate(set) var erased = false
    }

    enum AssociationOutcome: String, Codable, Equatable, Sendable {
        case noChanges = "NoChanges", synced = "Synced", needsReview = "NeedsReview"
        case accessRequired = "AccessRequired", paused = "Paused", failed = "Failed", scopeChanged = "ScopeChanged"
    }

    struct AssociationRequest: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Account
        let occurrenceID: String
        let source: Source
        let linkRevision: Int
        let activationRevision: Int
        let lifecycleRevision: Int
        let startedAtMs: Int64
        fileprivate(set) var outcome: AssociationOutcome? = nil
        fileprivate(set) var finishedAtMs: Int64? = nil
        fileprivate(set) var checked = false
        fileprivate(set) var changed = false
        fileprivate(set) var reason: String? = nil
    }

    private struct Reservation: Hashable {
        let subject: String
        let calendarID: String
        let eventID: String

        init(_ source: Source) {
            subject = source.subject
            calendarID = source.calendarID
            eventID = source.eventID
        }
    }

    private struct StoredReceipt: Codable {
        let subject: String
        let clientID: String
        let fingerprint: Data
        let requestDigest: Data
        let result: Receipt

        func belongs(to account: Account) -> Bool {
            account.subject == subject && account.clientID == clientID
        }
    }

    private struct State: Codable {
        var schemaVersion = 1
        var links: [String: Record] = [:]
        var receipts: [UUID: StoredReceipt] = [:]
        var transfers: [UUID: StoredTransfer]?
        var associationRequests: [UUID: StoredAssociationRequest]?
    }

    private struct StoredAssociationRequest: Codable {
        let fingerprint: Data
        let sequence: Int
        var request: AssociationRequest
    }

    private struct StoredTransfer: Codable {
        let fingerprint: Data
        let requestDigest: Data
        let superseding: UUID?
        var operation: Operation
    }

    private struct Request: Encodable {
        let state: LinkState
        let occurrenceID: String
        let expectedRevision: Int
        let source: Source?
        let origin: Origin?
        let baseline: Baseline?
        var disabling: Account? = nil

        func digest() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }
    }

    private static let maximumRevision = 9_007_199_254_740_991
    private static let epoch: ClosedRange<Int64> = 0...253_402_300_799_999
    private let directory: URL
    private var file: URL { directory.appendingPathComponent("manual-links.json", isDirectory: false) }

    init(directory: URL) { self.directory = directory }

    static func local() throws -> RemiloIOSGoogleCalendarManualLinkStore {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return Self(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    func link(_ occurrenceID: String) throws -> Record? { try read().links[occurrenceID] }

    func links(viewingAs account: Account) throws -> [Record] {
        try read().links.values.filter { Self.belongs($0.source, to: account) }.sorted { $0.occurrenceID < $1.occurrenceID }
    }

    func associationRequest(_ id: UUID, viewingAs account: Account, fingerprint: Data? = nil) throws -> AssociationRequest? {
        let state = try read()
        guard let saved = state.associationRequests?[id], saved.request.source.belongs(to: account) else { return nil }
        if let fingerprint, fingerprint != saved.fingerprint { throw Failure.operationReused }
        return saved.request
    }

    func captureAssociationRequest(_ id: UUID, fingerprint: Data, record: Record,
                                   viewingAs account: Account, at time: Int64) throws -> AssociationRequest {
        guard fingerprint.count == 32, Self.epoch.contains(time) else { throw Failure.invalidInput }
        var state = try read()
        if let saved = state.associationRequests?[id] {
            guard saved.fingerprint == fingerprint, saved.request.account == account else { throw Failure.operationReused }
            return saved.request
        }
        guard state.receipts[id] == nil, state.transfers?[id] == nil else { throw Failure.operationReused }
        guard state.links[record.occurrenceID] == record else { throw Rejection.stalePreview }
        guard record.source.belongs(to: account), record.state == .linked, record.check?.requiresReview != true,
              let consent = record.automatic, consent.phase == .active, consent.accountGeneration == account.accountGeneration else {
            throw Rejection.ineligible
        }
        try requireUnreserved(record.occurrenceID, source: record.source, in: state)
        if (state.associationRequests ?? [:]).values.contains(where: {
            $0.request.occurrenceID == record.occurrenceID && $0.request.linkRevision == record.revision
                && $0.request.outcome == nil && $0.request.account == account
        }) { throw Rejection.operationPending }
        let request = AssociationRequest(operationID: id, account: account, occurrenceID: record.occurrenceID, source: record.source,
                                         linkRevision: record.revision, activationRevision: consent.activationRevision,
                                         lifecycleRevision: consent.lifecycleRevision, startedAtMs: time)
        var requests = state.associationRequests ?? [:]
        requests[id] = StoredAssociationRequest(fingerprint: fingerprint, sequence: requests.count + 1, request: request)
        state.associationRequests = requests
        try write(state)
        return request
    }

    func finishAssociationRequest(_ request: AssociationRequest, outcome: AssociationOutcome, at time: Int64,
                                  checked: Bool, changed: Bool = false, reason: String? = nil) throws -> AssociationRequest {
        guard Self.epoch.contains(time), reason.map(Self.validReason) ?? true,
              !changed || (checked && outcome == .synced) else { throw Failure.invalidInput }
        var state = try read()
        guard var saved = state.associationRequests?[request.operationID], saved.request.account == request.account else {
            throw Failure.notFound
        }
        if saved.request.outcome != nil { return saved.request }
        guard saved.request == request else { throw Rejection.stalePreview }
        saved.request.outcome = outcome
        saved.request.finishedAtMs = time
        saved.request.checked = checked
        saved.request.changed = changed
        saved.request.reason = reason
        state.associationRequests?[request.operationID] = saved
        try write(state)
        return saved.request
    }

    func pendingAssociationOccurrenceIDs(viewingAs account: Account) throws -> Set<String> {
        let state = try read()
        return Set((state.associationRequests ?? [:]).values.compactMap { saved in
            let request = saved.request
            guard request.outcome == nil, request.account == account,
                  state.links[request.occurrenceID]?.revision == request.linkRevision else { return nil }
            return request.occurrenceID
        })
    }

    func pendingAssociationRequests(viewingAs account: Account) throws -> [AssociationRequest] {
        try (read().associationRequests ?? [:]).values
            .filter { $0.request.outcome == nil && $0.request.account == account }
            .sorted { $0.sequence < $1.sequence }.map(\.request)
    }

    func latestAssociationRequests(viewingAs account: Account) throws -> [String: UUID] {
        let ordered = try (read().associationRequests ?? [:]).values
            .filter { $0.request.source.belongs(to: account) }.sorted { $0.sequence > $1.sequence }
        return Dictionary(ordered.map { ($0.request.occurrenceID, $0.request.operationID) }, uniquingKeysWith: { first, _ in first })
    }

    /// An explicit check records an observation, never new authority or a baseline.
    /// Compare the captured record after I/O. Wall-clock timestamps are display metadata.
    func observe(_ record: Record, viewingAs account: Account, result: CheckResult, at time: Int64) throws -> Record {
        guard Self.epoch.contains(time) else { throw Failure.invalidInput }
        guard record.source.belongs(to: account) else { throw Failure.accountChanged }
        var state = try read()
        guard let current = state.links[record.occurrenceID], current.source.belongs(to: account) else { throw Failure.notFound }
        guard current == record else { throw Rejection.stalePreview }
        guard current.state == .linked else { throw Rejection.ineligible }
        let previous = current.check
        let requiresReview = previous?.requiresReview == true
        let check: Check
        switch result {
        case .available(let observed):
            guard observed.source == current.source else { throw Link.Failure.staleRemote }
            check = Check(attemptedAtMs: time, observedAtMs: time, availability: .available, availabilityReason: "",
                          remoteDiffers: Self.remoteDiffers(observed.fields, baseline: current.baseline), errorCode: "",
                          requiresReview: requiresReview)
        case .unavailable(let reason):
            check = Check(attemptedAtMs: time, observedAtMs: time, availability: .unavailable,
                          availabilityReason: Self.checkCode(reason, fallback: "REMOTE_UNAVAILABLE"), remoteDiffers: nil,
                          errorCode: "", requiresReview: true)
        case .deleted(let reason):
            check = Check(attemptedAtMs: time, observedAtMs: time, availability: .deleted,
                          availabilityReason: Self.checkCode(reason, fallback: "REMOTE_DELETED"), remoteDiffers: nil,
                          errorCode: "", requiresReview: true)
        case .failed(let code):
            check = Check(attemptedAtMs: time, observedAtMs: previous?.observedAtMs, availability: previous?.availability,
                          availabilityReason: previous?.availabilityReason ?? "", remoteDiffers: previous?.remoteDiffers,
                          errorCode: Self.checkCode(code, fallback: "API_ERROR"), requiresReview: requiresReview)
        }
        let lostSource: Bool
        switch result {
        case .unavailable, .deleted: lostSource = true
        case .available, .failed: lostSource = false
        }
        let fence = check.requiresReview && !requiresReview || lostSource && current.automatic != nil
        guard !fence || current.revision < Self.maximumRevision else { throw RemiloIOSGoogleCalendarStore.Failure.invalidState }
        var updated = current
        updated.check = check
        if fence { updated.revision += 1 }
        if lostSource { updated.automatic = nil }
        if updated != current {
            state.links[current.occurrenceID] = updated
            try write(state)
        }
        return updated
    }

    func recordAutomaticIssue(_ record: Record, viewingAs account: Account, issue: AutomaticIssue) throws -> Record {
        guard record.source.belongs(to: account) else { throw Failure.accountChanged }
        var state = try read()
        guard var current = state.links[record.occurrenceID], current == record else { throw Rejection.stalePreview }
        guard current.state == .linked, current.check?.requiresReview != true, let consent = current.automatic,
              consent.phase == .active, consent.accountGeneration == account.accountGeneration,
              consent.issue != .review || issue == .review else { throw Rejection.ineligible }
        try requireUnreserved(current.occurrenceID, source: current.source, in: state)
        if consent.issue != issue {
            current.automatic?.issue = issue
            state.links[current.occurrenceID] = current
            try write(state)
        }
        return current
    }

    func reservedEvents(viewingAs account: Account, calendarID: String) throws -> Set<String> {
        let state = try read()
        let pending = (state.transfers ?? [:]).values.filter { $0.operation.phase.pending }
        let sources = state.links.values.map(\.source) + pending.map(\.operation.source)
        return Set(sources.compactMap { source in
            guard source.subject == account.subject, source.calendarID == calendarID else { return nil }
            return source.eventID
        })
    }

    /// A same-owner retry can recover this exact result before reopening a preview.
    func receipt(operationID: UUID, fingerprint: Data, viewingAs account: Account) throws -> Receipt? {
        guard fingerprint.count == 32 else { throw Failure.invalidInput }
        let state = try read()
        if let existing = state.transfers?[operationID]?.operation, existing.source.belongs(to: account) {
            throw Failure.operationReused
        }
        guard let saved = state.receipts[operationID], saved.belongs(to: account) else { return nil }
        guard saved.fingerprint == fingerprint else { throw Failure.operationReused }
        return saved.result
    }

    func operation(_ id: UUID, viewingAs account: Account) throws -> Receipt? {
        guard let saved = try read().receipts[id], saved.belongs(to: account) else { return nil }
        return saved.result
    }

    /// Only the runtime's confirmed common groups may be supplied as a baseline.
    func attach(operationID: UUID, fingerprint: Data, viewingAs account: Account, occurrenceID: String,
                source: Source, origin: Origin, expectedRevision: Int, calendarName: String,
                baseline: Baseline?, observedAtMs: Int64) throws -> Receipt {
        guard Self.belongs(source, to: account) else { throw Failure.accountChanged }
        guard Self.valid(source), Self.validID(occurrenceID, maximum: 200), Self.valid(baseline),
              fingerprint.count == 32, (0..<Self.maximumRevision).contains(expectedRevision),
              calendarName.utf8.count <= 4_096, Self.epoch.contains(observedAtMs) else { throw Failure.invalidInput }
        let request = Request(state: .linked, occurrenceID: occurrenceID, expectedRevision: expectedRevision,
                              source: source, origin: origin, baseline: baseline)
        let digest = try request.digest()
        var state = try read()
        if let replay = try replay(operationID, fingerprint: fingerprint, digest: digest, account: account, in: state) { return replay }
        try requireLink(occurrenceID, source: source, origin: origin, revision: expectedRevision, in: state)
        try requireUnreserved(occurrenceID, source: source, in: state)
        let record = Record(occurrenceID: occurrenceID, source: source, origin: origin, revision: expectedRevision + 1,
                            state: .linked, baseline: baseline, calendarName: calendarName, observedAtMs: observedAtMs)
        return try commit(record, operationID: operationID, fingerprint: fingerprint, digest: digest, account: account, state: &state)
    }

    /// The import receipt and this record witness the same source. An existing
    /// manual or detached record must never regain automatic consent here.
    func attachManagedImport(viewingAs account: Account, occurrenceID: String, remote: Link.Observation,
                             lifecycleRevision: Int, lease: Link.ManagedLease, observedAtMs: Int64) throws -> Record {
        let source = remote.source
        let baseline = Baseline(title: remote.fields.title, notes: remote.fields.notes, schedule: remote.fields.schedule)
        guard Self.belongs(source, to: account), source.calendarID == lease.calendarID,
              remote.calendarZone == lease.zoneID, Self.valid(source), Self.validID(occurrenceID, maximum: 200),
              Self.valid(baseline), remote.calendarName.utf8.count <= 4_096, Self.epoch.contains(observedAtMs),
              (1...Self.maximumRevision).contains(account.accountGeneration), (0...Self.maximumRevision).contains(lifecycleRevision),
              lease.bindingRevision > 0, lease.authEpoch > 0 else { throw Failure.invalidInput }
        var state = try read()
        if let existing = state.links[occurrenceID] {
            guard existing.source == source, existing.origin == .imported else { throw Rejection.ineligible }
            return existing
        }
        try requireUnreserved(occurrenceID, source: source, in: state)
        let consent = AutomaticConsent(phase: .active, activationRevision: 1, lifecycleRevision: lifecycleRevision,
                                       accountGeneration: account.accountGeneration, operationID: nil, managedLease: lease)
        let record = Record(occurrenceID: occurrenceID, source: source, origin: .imported, revision: 1, state: .linked,
                            baseline: baseline, calendarName: remote.calendarName, observedAtMs: observedAtMs, automatic: consent)
        state.links[occurrenceID] = record
        try write(state)
        return record
    }

    func detach(operationID: UUID, fingerprint: Data, viewingAs account: Account, occurrenceID: String,
                expectedRevision: Int) throws -> Receipt {
        guard Self.validID(occurrenceID, maximum: 200), fingerprint.count == 32,
              (1..<Self.maximumRevision).contains(expectedRevision) else { throw Failure.invalidInput }
        let request = Request(state: .detached, occurrenceID: occurrenceID, expectedRevision: expectedRevision,
                              source: nil, origin: nil, baseline: nil)
        let digest = try request.digest()
        var state = try read()
        if let replay = try replay(operationID, fingerprint: fingerprint, digest: digest, account: account, in: state) { return replay }
        guard let previous = state.links[occurrenceID], Self.belongs(previous.source, to: account) else { throw Failure.notFound }
        guard previous.revision == expectedRevision else { throw Rejection.stalePreview }
        guard previous.state == .linked else { throw Rejection.ineligible }
        let record = Record(occurrenceID: occurrenceID, source: previous.source, origin: previous.origin,
                            revision: previous.revision + 1, state: .detached, baseline: nil,
                            calendarName: previous.calendarName, observedAtMs: nil)
        return try commit(record, operationID: operationID, fingerprint: fingerprint, digest: digest, account: account, state: &state)
    }

    func disableAutomatic(operationID: UUID, fingerprint: Data, viewingAs account: Account, occurrenceID: String,
                          expectedRevision: Int) throws -> Receipt {
        guard Self.validID(occurrenceID, maximum: 200), fingerprint.count == 32,
              (1..<Self.maximumRevision).contains(expectedRevision),
              (1...Self.maximumRevision).contains(account.connectionRevision),
              (1...Self.maximumRevision).contains(account.accountGeneration) else { throw Failure.invalidInput }
        let request = Request(state: .linked, occurrenceID: occurrenceID, expectedRevision: expectedRevision,
                              source: nil, origin: nil, baseline: nil, disabling: account)
        let digest = try request.digest()
        var state = try read()
        if let replay = try replay(operationID, fingerprint: fingerprint, digest: digest, account: account, in: state) { return replay }
        guard var record = state.links[occurrenceID], record.source.belongs(to: account) else { throw Failure.notFound }
        guard record.revision == expectedRevision else { throw Rejection.stalePreview }
        guard record.state == .linked, record.automatic != nil else { throw Rejection.ineligible }
        record.automatic = nil
        record.revision += 1
        return try commit(record, operationID: operationID, fingerprint: fingerprint, digest: digest, account: account, state: &state)
    }

    func pendingTransfer(occurrenceID: String, source: Source, viewingAs account: Account) throws -> Operation? {
        guard source.belongs(to: account) else { return nil }
        let state = try read()
        return (state.transfers ?? [:]).values.first {
            $0.operation.phase.pending && $0.operation.occurrenceID == occurrenceID && $0.operation.source == source
        }?.operation
    }

    func captureTransfer(_ transfer: Transfer, fingerprint: Data, superseding: UUID? = nil) throws -> Operation {
        guard fingerprint.count == 32, Self.valid(transfer), transfer.automatic == nil || superseding == nil else {
            throw Failure.invalidInput
        }
        let digest = try transferDigest(transfer)
        let id = transfer.operationID
        var state = try read()
        guard state.receipts[id] == nil else { throw Failure.operationReused }
        if let request = state.associationRequests?[id]?.request {
            guard request.account == transfer.account, request.occurrenceID == transfer.occurrenceID,
                  request.source == transfer.evidence.source, request.linkRevision == transfer.linkRevision,
                  transfer.automatic?.kind == .transfer, transfer.automatic?.activationRevision == request.activationRevision,
                  transfer.automatic?.lifecycleRevision == request.lifecycleRevision else { throw Failure.operationReused }
            if request.outcome != nil, state.transfers?[id] == nil { throw Failure.operationReused }
        }
        if let saved = state.transfers?[id] {
            guard saved.fingerprint == fingerprint, saved.requestDigest == digest, saved.superseding == superseding else {
                throw Failure.operationReused
            }
            return saved.operation
        }
        if (state.associationRequests ?? [:]).values.contains(where: {
            $0.request.operationID != id && $0.request.occurrenceID == transfer.occurrenceID
                && $0.request.linkRevision == transfer.linkRevision && $0.request.account == transfer.account && $0.request.outcome == nil
        }) { throw Rejection.operationPending }
        let source = transfer.evidence.source
        let origin = transfer.evidence.origin
        try requireLink(transfer.occurrenceID, source: source, origin: origin, revision: transfer.linkRevision, in: state)
        if let superseding {
            var previous = try scopedTransfer(superseding, account: transfer.account, in: state)
            guard previous.operation.phase == .sent, !previous.operation.erased,
                  previous.operation.occurrenceID == transfer.occurrenceID, previous.operation.source == source,
                  previous.operation.origin == origin, let old = previous.operation.transfer else {
                throw Rejection.stalePreview
            }
            guard old.remote.etag != transfer.remote.etag else { throw Link.Failure.staleRemote }
            // This settlement is written only when the replacement capture also succeeds.
            settle(&previous.operation, phase: .cancelled, reason: "SUPERSEDED")
            state.transfers?[superseding] = previous
        }
        try requireUnreserved(transfer.occurrenceID, source: source, in: state)
        let kind: String
        switch transfer.automatic?.kind {
        case .activation:
            guard var record = state.links[transfer.occurrenceID], record.state == .linked, record.automatic?.phase != .pending,
                  let authority = transfer.automatic, authority.managedLease == nil else { throw Rejection.ineligible }
            record.automatic = AutomaticConsent(phase: .pending, activationRevision: authority.activationRevision,
                                                lifecycleRevision: authority.lifecycleRevision,
                                                accountGeneration: transfer.account.accountGeneration, operationID: id)
            state.links[record.occurrenceID] = record
            kind = "EnableAutomaticCalendarSync"
        case .transfer:
            _ = try requireAutomaticAuthority(transfer, in: state)
            let comparison = Link.Comparison.compare(local: transfer.local.fields, remote: transfer.remote.fields,
                                                     baseline: state.links[transfer.occurrenceID]?.baseline)
            guard comparison.conflicts.isEmpty, comparison.desired == transfer.desired else { throw Link.Failure.resolutionRequired }
            kind = "AutomaticCalendarTransfer"
        case nil:
            kind = state.links[transfer.occurrenceID]?.state == .linked ? "ApplyCalendarResolution" : "EnableCalendarLink"
            if let superseding, state.links[transfer.occurrenceID]?.automatic?.operationID == superseding {
                // The replacement is already bound to this exact link revision. Its reservation
                // and cancellation of the old job fence the superseded Pending activation.
                state.links[transfer.occurrenceID]?.automatic = nil
            }
        }
        let operation = Operation(operationID: id, account: transfer.account, source: source, origin: origin,
                                  occurrenceID: transfer.occurrenceID, linkRevision: transfer.linkRevision,
                                  kind: kind, calendarName: transfer.remote.calendarName, checkedAtMs: transfer.checkedAtMs,
                                  transfer: transfer)
        return try save(StoredTransfer(fingerprint: fingerprint, requestDigest: digest, superseding: superseding,
                                      operation: operation), state: &state)
    }

    func transferOperation(_ id: UUID, viewingAs account: Account, fingerprint: Data? = nil) throws -> Operation? {
        guard fingerprint == nil || fingerprint?.count == 32 else { throw Failure.invalidInput }
        let state = try read()
        if fingerprint != nil, let existing = state.receipts[id], existing.belongs(to: account) { throw Failure.operationReused }
        guard let saved = state.transfers?[id], saved.operation.source.belongs(to: account) else { return nil }
        if let fingerprint, saved.fingerprint != fingerprint { throw Failure.operationReused }
        return saved.operation
    }

    func transferOperations(viewingAs account: Account) throws -> [Operation] {
        let state = try read()
        return (state.transfers ?? [:]).values.map(\.operation).filter { $0.source.belongs(to: account) }.sorted { lhs, rhs in
            if lhs.checkedAtMs != rhs.checkedAtMs { return lhs.checkedAtMs > rhs.checkedAtMs }
            return lhs.operationID.uuidString < rhs.operationID.uuidString
        }
    }

    /// Check inside the engine gate before committing the captured local change.
    func requireTransferAuthority(_ transfer: Transfer, phase: Phase = .waiting) throws {
        let state = try read()
        let saved = try exactTransfer(transfer, in: state)
        guard phase == .waiting || phase == .localApplied, saved.operation.phase == phase, !saved.operation.erased else {
            throw Rejection.stalePreview
        }
        try requireLink(transfer.occurrenceID, source: transfer.evidence.source, origin: transfer.evidence.origin,
                        revision: transfer.linkRevision, in: state)
        _ = try requireAutomaticAuthority(transfer, in: state)
    }

    /// The engine receipt is already authoritative at this point. Record it
    /// even if a later unlink invalidated permission for the remote phase.
    func recordLocal(_ transfer: Transfer, after snapshot: LocalSnapshot, status: String?) throws -> Operation {
        var state = try read()
        var saved = try exactTransfer(transfer, in: state)
        guard saved.operation.phase.pending, !saved.operation.erased else { return saved.operation }
        guard Self.validLocalResult(snapshot, transfer: transfer), Self.validLocalStatus(status, applied: transfer.needsLocal) else {
            throw Failure.invalidInput
        }
        if saved.operation.phase != .waiting {
            guard saved.operation.localAfter == snapshot else { throw Failure.operationReused }
            return saved.operation
        }
        saved.operation.phase = .localApplied
        saved.operation.localApplied = transfer.needsLocal
        saved.operation.localAfter = snapshot
        saved.operation.localStatus = status
        return try save(saved, state: &state)
    }

    /// The engine owns the exact local-version permit. This synchronous
    /// checkpoint must succeed before the caller can dispatch the PATCH.
    func beginSend(_ transfer: Transfer, after snapshot: LocalSnapshot) throws -> Writer.Permission {
        var state = try read()
        var saved = try exactTransfer(transfer, in: state)
        if saved.operation.phase == .cancelled { return .denied(.cancelled) }
        if saved.operation.remoteAttempted { return .alreadySent }
        guard saved.operation.phase == .localApplied, !saved.operation.erased else { return .denied(.cancelled) }
        guard transfer.needsRemote, saved.operation.localAfter == snapshot else { throw Rejection.stalePreview }
        try requireLink(transfer.occurrenceID, source: transfer.evidence.source, origin: transfer.evidence.origin,
                        revision: transfer.linkRevision, in: state)
        _ = try requireAutomaticAuthority(transfer, in: state)
        saved.operation.phase = .sent
        saved.operation.remoteAttempted = true
        saved.operation.readback = try transfer.readback()
        _ = try save(saved, state: &state)
        return .granted
    }

    func confirmTransfer(_ transfer: Transfer, observedLocal: LocalSnapshot?, observedRemote: Link.Observation,
                         observedAtMs: Int64, advanceLink: Bool, acceptNewerAutomaticLocal: Bool = false) throws -> Operation {
        var state = try read()
        var saved = try exactTransfer(transfer, in: state)
        guard saved.operation.phase.pending else { return saved.operation }
        guard saved.operation.phase == .localApplied || saved.operation.phase == .sent,
              observedRemote.source == saved.operation.source, observedRemote.fields == transfer.desired,
              Self.epoch.contains(observedAtMs), observedRemote.calendarName.utf8.count <= 4_096 else {
            throw Link.Failure.staleRemote
        }
        if advanceLink {
            guard !saved.operation.erased, let observedLocal, let agreedLocal = saved.operation.localAfter else {
                throw Rejection.stalePreview
            }
            if observedLocal != agreedLocal {
                let agreed = agreedLocal.version
                let current = observedLocal.version
                guard acceptNewerAutomaticLocal, saved.operation.phase == .sent, transfer.automatic?.kind == .transfer,
                      agreedLocal.fields == transfer.desired, current.occurrenceID == agreed.occurrenceID,
                      (agreed.revision...Self.maximumRevision).contains(current.revision),
                      (agreed.generation...Self.maximumRevision).contains(current.generation),
                      current.revision > agreed.revision || current.generation > agreed.generation else { throw Rejection.stalePreview }
            }
            try requireLink(transfer.occurrenceID, source: transfer.evidence.source, origin: transfer.evidence.origin,
                            revision: transfer.linkRevision, in: state)
            let consent = try requireAutomaticAuthority(transfer, in: state)
            let automatic = consent.map {
                AutomaticConsent(phase: .active, activationRevision: $0.activationRevision,
                                 lifecycleRevision: $0.lifecycleRevision, accountGeneration: $0.accountGeneration,
                                 operationID: nil, managedLease: $0.managedLease)
            }
            let desired = transfer.desired
            let baseline = Baseline(title: desired.title, notes: desired.notes, schedule: desired.schedule)
            let revision = transfer.linkRevision + 1
            state.links[transfer.occurrenceID] = Record(
                occurrenceID: transfer.occurrenceID, source: transfer.evidence.source, origin: transfer.evidence.origin,
                revision: revision, state: .linked, baseline: baseline, calendarName: observedRemote.calendarName,
                observedAtMs: observedAtMs, automatic: automatic
            )
            saved.operation.resultLinkRevision = revision
        } else if saved.operation.phase != .sent {
            guard let observedLocal, observedLocal == saved.operation.localAfter else { throw Rejection.stalePreview }
        }
        settle(&saved.operation, phase: .confirmed, reason: nil)
        return try save(saved, state: &state)
    }

    /// Read-only acknowledgement after an old write. This never advances a
    /// link, even if the remote event still matches the original intended fields.
    func confirmReadback(_ id: UUID, viewingAs account: Account, observedRemote: Link.Observation) throws -> Operation {
        var state = try read()
        var saved = try scopedTransfer(id, account: account, in: state)
        guard saved.operation.phase.pending else { return saved.operation }
        guard saved.operation.phase == .sent, let readback = saved.operation.readback,
              observedRemote.source == saved.operation.source, try readback.matches(observedRemote.fields) else {
            throw Link.Failure.staleRemote
        }
        settle(&saved.operation, phase: .confirmed, reason: nil)
        return try save(saved, state: &state)
    }

    func failTransfer(_ transfer: Transfer, reason: String, cancelled: Bool = false) throws -> Operation {
        guard Self.validReason(reason) else { throw Failure.invalidInput }
        var state = try read()
        var saved = try exactTransfer(transfer, in: state)
        guard saved.operation.phase.pending, !saved.operation.erased else { return saved.operation }
        settle(&saved.operation, phase: cancelled ? .cancelled : .failed, reason: reason)
        return try save(saved, state: &state)
    }

    func failReadback(_ id: UUID, viewingAs account: Account, reason: String) throws -> Operation {
        guard Self.validReason(reason) else { throw Failure.invalidInput }
        var state = try read()
        var saved = try scopedTransfer(id, account: account, in: state)
        guard saved.operation.phase.pending else { return saved.operation }
        guard saved.operation.phase == .sent else { throw Rejection.stalePreview }
        settle(&saved.operation, phase: .failed, reason: reason)
        return try save(saved, state: &state)
    }

    /// The engine supplies durable purge tombstones. Keep the reservation and
    /// exact historical receipts while dropping the saved agreement and label.
    func redactPurged(_ occurrenceIDs: Set<String>) throws {
        guard !occurrenceIDs.isEmpty else { return }
        var state = try read()
        var changed = false
        for id in occurrenceIDs {
            guard let previous = state.links[id], previous.state == .linked || !previous.calendarName.isEmpty else { continue }
            guard previous.revision < Self.maximumRevision else { throw RemiloIOSGoogleCalendarStore.Failure.invalidState }
            state.links[id] = Record(occurrenceID: id, source: previous.source, origin: previous.origin,
                                     revision: previous.revision + 1, state: .detached, baseline: nil,
                                     calendarName: "", observedAtMs: nil)
            changed = true
        }
        for (id, var saved) in state.transfers ?? [:] where occurrenceIDs.contains(saved.operation.occurrenceID) && !saved.operation.erased {
            saved.operation.erased = true
            saved.operation.calendarName = ""
            if saved.operation.phase == .waiting || saved.operation.phase == .localApplied {
                settle(&saved.operation, phase: .cancelled, reason: "LOCAL_REMOVED")
            } else {
                // Sent work can still be checked by its source and digest.
                saved.operation.transfer = nil
                saved.operation.localAfter = nil
            }
            state.transfers?[id] = saved
            changed = true
        }
        if changed { try write(state) }
    }

    private func requireLink(_ occurrenceID: String, source: Source, origin: Origin, revision: Int, in state: State) throws {
        let previous = state.links[occurrenceID]
        guard (previous?.revision ?? 0) == revision else { throw Rejection.stalePreview }
        if let previous, previous.source != source || previous.origin != origin { throw Rejection.sourceReserved }
        let reservation = Reservation(source)
        guard !state.links.values.contains(where: { $0.occurrenceID != occurrenceID && Reservation($0.source) == reservation }) else {
            throw Rejection.sourceReserved
        }
    }

    private func requireAutomaticAuthority(_ transfer: Transfer, in state: State) throws -> AutomaticConsent? {
        guard let authority = transfer.automatic else { return nil }
        guard let record = state.links[transfer.occurrenceID], record.state == .linked,
              let consent = record.automatic, consent.activationRevision == authority.activationRevision,
              consent.lifecycleRevision == authority.lifecycleRevision,
              consent.managedLease == authority.managedLease,
              consent.accountGeneration == transfer.account.accountGeneration else { throw Rejection.stalePreview }
        switch authority.kind {
        case .activation:
            guard consent.phase == .pending, consent.operationID == transfer.operationID else { throw Rejection.stalePreview }
        case .transfer:
            guard consent.phase == .active, consent.issue != .review, record.check?.requiresReview != true else {
                throw Rejection.stalePreview
            }
        }
        return consent
    }

    private func requireUnreserved(_ occurrenceID: String, source: Source, in state: State) throws {
        let reservation = Reservation(source)
        if (state.transfers ?? [:]).values.contains(where: {
            let operation = $0.operation
            return operation.phase.pending && (operation.occurrenceID == occurrenceID || Reservation(operation.source) == reservation)
        }) { throw Rejection.operationPending }
    }

    private func transferDigest(_ transfer: Transfer) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return Data(SHA256.hash(data: try encoder.encode(transfer)))
    }

    private func exactTransfer(_ transfer: Transfer, in state: State) throws -> StoredTransfer {
        guard let saved = state.transfers?[transfer.operationID] else { throw Failure.notFound }
        guard saved.requestDigest == (try transferDigest(transfer)) else { throw Failure.operationReused }
        return saved
    }

    private func scopedTransfer(_ id: UUID, account: Account, in state: State) throws -> StoredTransfer {
        guard let saved = state.transfers?[id], saved.operation.source.belongs(to: account) else { throw Failure.notFound }
        return saved
    }

    private func settle(_ operation: inout Operation, phase: Phase, reason: String?) {
        operation.phase = phase
        operation.reason = reason
        operation.transfer = nil
        operation.localAfter = nil
        operation.readback = nil
    }

    private func save(_ saved: StoredTransfer, state: inout State) throws -> Operation {
        let operation = saved.operation
        if !operation.phase.pending, var record = state.links[operation.occurrenceID],
           record.automatic?.phase == .pending, record.automatic?.operationID == operation.operationID {
            guard record.revision < Self.maximumRevision else { throw RemiloIOSGoogleCalendarStore.Failure.invalidState }
            record.revision += 1
            record.automatic = nil
            state.links[operation.occurrenceID] = record
        }
        var transfers = state.transfers ?? [:]
        transfers[operation.operationID] = saved
        state.transfers = transfers
        try write(state)
        return operation
    }

    private func replay(_ operationID: UUID, fingerprint: Data, digest: Data, account: Account, in state: State) throws -> Receipt? {
        guard state.transfers?[operationID] == nil, state.associationRequests?[operationID] == nil else { throw Failure.operationReused }
        guard let saved = state.receipts[operationID] else { return nil }
        guard saved.belongs(to: account), saved.fingerprint == fingerprint, saved.requestDigest == digest else {
            throw Failure.operationReused
        }
        return saved.result
    }

    private func commit(_ record: Record, operationID: UUID, fingerprint: Data, digest: Data, account: Account,
                        state: inout State) throws -> Receipt {
        let result = Receipt(occurrenceID: record.occurrenceID, revision: record.revision, state: record.state)
        state.links[record.occurrenceID] = record
        state.receipts[operationID] = StoredReceipt(subject: account.subject, clientID: account.clientID,
                                                   fingerprint: fingerprint, requestDigest: digest, result: result)
        try write(state)
        return result
    }

    private static func belongs(_ source: Source, to account: Account) -> Bool {
        source.subject == account.subject && source.clientID == account.clientID
    }

    private static func valid(_ source: Source) -> Bool {
        validID(source.subject, maximum: 255) && validID(source.clientID, maximum: 255)
            && validID(source.calendarID, maximum: 4_096) && validID(source.eventID, maximum: 4_096)
    }

    private static func validID(_ value: String, maximum: Int) -> Bool {
        (1...maximum).contains(value.utf8.count) && value != "." && value != ".."
            && value == value.trimmingCharacters(in: .whitespacesAndNewlines)
            && !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
    }

    private static func valid(_ baseline: Baseline?) -> Bool {
        guard let baseline else { return true }
        if let title = baseline.title,
           title.isEmpty || title.utf16.count > 200 || title != title.trimmingCharacters(in: .whitespacesAndNewlines) { return false }
        if let notes = baseline.notes, notes.utf16.count > 10_000 { return false }
        if let schedule = baseline.schedule, (try? RemiloIOSGoogleCalendarPublication.Bounds(schedule)) == nil { return false }
        return true
    }

    private static func remoteDiffers(_ fields: Link.Event.Fields, baseline: Baseline?) -> Bool? {
        guard let baseline else { return nil }
        let changes = [
            baseline.title.map { $0 != fields.title },
            baseline.notes.map { $0 != fields.notes },
            baseline.schedule.map { $0 != fields.schedule },
        ].compactMap { $0 }
        return changes.isEmpty ? nil : changes.contains(true)
    }

    private static func checkCode(_ code: String, fallback: String) -> String {
        if Failure(rawValue: code) != nil || Link.Failure(rawValue: code) != nil || Link.Event.Reason(rawValue: code) != nil
            || code == "REMOTE_DELETED" { return code }
        return fallback
    }

    private static func validCheck(_ record: Record) -> Bool {
        guard let check = record.check else { return true }
        guard record.state == .linked, epoch.contains(check.attemptedAtMs),
              check.errorCode.isEmpty || checkCode(check.errorCode, fallback: "") == check.errorCode else { return false }
        if let observed = check.observedAtMs, !epoch.contains(observed) { return false }
        switch check.availability {
        case .available:
            return check.observedAtMs != nil && check.availabilityReason.isEmpty
        case .unavailable, .deleted:
            return check.observedAtMs != nil && !check.availabilityReason.isEmpty
                && checkCode(check.availabilityReason, fallback: "") == check.availabilityReason
                && check.remoteDiffers == nil && check.requiresReview
        case nil:
            return check.observedAtMs == nil && check.availabilityReason.isEmpty && check.remoteDiffers == nil
                && !check.requiresReview && !check.errorCode.isEmpty
        }
    }

    private static func valid(_ transfer: Transfer) -> Bool {
        let source = transfer.evidence.source
        let version = transfer.local.version
        let desired = transfer.desired
        let remote = transfer.remote.fields
        let local = transfer.local.fields
        if let authority = transfer.automatic {
            guard (1..<maximumRevision).contains(authority.activationRevision),
                  authority.lifecycleRevision >= 0, authority.lifecycleRevision <= version.revision else { return false }
            switch authority.kind {
            case .activation: guard authority.activationRevision == transfer.linkRevision else { return false }
            case .transfer: guard authority.activationRevision < transfer.linkRevision else { return false }
            }
        }
        return source.belongs(to: transfer.account) && valid(source) && transfer.remote.source == source
            && (1...maximumRevision).contains(transfer.account.connectionRevision)
            && (1...maximumRevision).contains(transfer.account.accountGeneration)
            && (0..<maximumRevision).contains(transfer.linkRevision) && epoch.contains(transfer.checkedAtMs)
            && validID(version.occurrenceID, maximum: 200) && (1...maximumRevision).contains(version.revision)
            && (0...maximumRevision).contains(version.generation)
            && Link.Transport.Event.validatedStrongETag(transfer.remote.etag) != nil
            && transfer.remote.calendarName.utf8.count <= 4_096
            && valid(Baseline(title: desired.title, notes: desired.notes, schedule: desired.schedule))
            && valid(Baseline(title: local.title, notes: local.notes, schedule: local.schedule))
            && valid(Baseline(title: remote.title.isEmpty ? nil : remote.title, notes: remote.notes, schedule: remote.schedule))
    }

    private static func validLocalResult(_ snapshot: LocalSnapshot, transfer: Transfer) -> Bool {
        if !transfer.needsLocal { return snapshot == transfer.local }
        let before = transfer.local.version
        let after = snapshot.version
        return snapshot.fields == transfer.desired && after.occurrenceID == before.occurrenceID
            && after.revision == before.revision + 1 && after.revision <= maximumRevision
            && (before.generation...before.generation + 1).contains(after.generation) && after.generation <= maximumRevision
    }

    private static func validLocalStatus(_ status: String?, applied: Bool) -> Bool {
        if let status { return applied && ["Applied", "Pending", "Scheduled", "Blocked", "Partial"].contains(status) }
        return !applied
    }

    private static func validReason(_ reason: String) -> Bool {
        (1...96).contains(reason.utf8.count) && reason.utf8.allSatisfy { (65...90).contains($0) || (48...57).contains($0) || $0 == 95 }
    }

    private static func validConsent(_ record: Record, in state: State) -> Bool {
        guard let consent = record.automatic else { return true }
        guard record.state == .linked, (1..<maximumRevision).contains(consent.activationRevision),
              (0...maximumRevision).contains(consent.lifecycleRevision),
              (1...maximumRevision).contains(consent.accountGeneration) else { return false }
        switch consent.phase {
        case .active:
            return consent.operationID == nil && consent.activationRevision < record.revision
                && record.check?.requiresReview != true && record.baseline?.title != nil
                && record.baseline?.notes != nil && record.baseline?.schedule != nil
        case .pending:
            guard let id = consent.operationID, let operation = state.transfers?[id]?.operation,
                  let authority = operation.transfer?.automatic else { return false }
            return operation.phase.pending && operation.kind == "EnableAutomaticCalendarSync"
                && operation.occurrenceID == record.occurrenceID && operation.source == record.source
                && operation.origin == record.origin && operation.linkRevision == record.revision
                && consent.activationRevision == record.revision && authority.kind == .activation
                && authority.activationRevision == consent.activationRevision && authority.lifecycleRevision == consent.lifecycleRevision
                && operation.account.accountGeneration == consent.accountGeneration && consent.issue == nil
        }
    }

    private func read() throws -> State {
        do {
            let bytes = try Data(contentsOf: file)
            let decoder = JSONDecoder()
            guard try decoder.decode(Header.self, from: bytes).schemaVersion == 1 else {
                throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema
            }
            let state = try decoder.decode(State.self, from: bytes)
            var reservations = Set<Reservation>()
            for (id, record) in state.links {
                let observationValid: Bool
                switch record.state {
                case .linked: observationValid = record.observedAtMs.map(Self.epoch.contains) == true
                case .detached: observationValid = record.observedAtMs == nil && record.baseline == nil
                }
                guard id == record.occurrenceID, Self.validID(id, maximum: 200),
                      (1...Self.maximumRevision).contains(record.revision), Self.valid(record.source), Self.valid(record.baseline),
                      record.calendarName.utf8.count <= 4_096, observationValid, Self.validCheck(record), Self.validConsent(record, in: state),
                      reservations.insert(Reservation(record.source)).inserted else {
                    throw RemiloIOSGoogleCalendarStore.Failure.invalidState
                }
            }
            for receipt in state.receipts.values {
                let result = receipt.result
                guard receipt.fingerprint.count == 32, receipt.requestDigest.count == 32,
                      let record = state.links[result.occurrenceID], record.source.subject == receipt.subject,
                      record.source.clientID == receipt.clientID, (1...record.revision).contains(result.revision),
                      result.revision != record.revision || result.state == record.state else {
                    throw RemiloIOSGoogleCalendarStore.Failure.invalidState
                }
            }
            try validateTransfers(state)
            try validateAssociationRequests(state)
            return state
        } catch CocoaError.fileReadNoSuchFile { return State() }
    }

    private func validateAssociationRequests(_ state: State) throws {
        let invalid = RemiloIOSGoogleCalendarStore.Failure.invalidState
        var sequences = Set<Int>()
        for (id, saved) in state.associationRequests ?? [:] {
            let request = saved.request
            guard request.operationID == id, state.receipts[id] == nil, saved.fingerprint.count == 32,
                  (1...(state.associationRequests?.count ?? 1)).contains(saved.sequence), sequences.insert(saved.sequence).inserted,
                  Self.valid(request.source), request.source.belongs(to: request.account),
                  (1...Self.maximumRevision).contains(request.account.connectionRevision),
                  (1...Self.maximumRevision).contains(request.account.accountGeneration),
                  Self.validID(request.occurrenceID, maximum: 200),
                  (1...Self.maximumRevision).contains(request.linkRevision),
                  (1...request.linkRevision).contains(request.activationRevision),
                  (0...Self.maximumRevision).contains(request.lifecycleRevision), Self.epoch.contains(request.startedAtMs),
                  let record = state.links[request.occurrenceID], record.source == request.source,
                  record.revision >= request.linkRevision else { throw invalid }
            if let transfer = state.transfers?[id]?.operation {
                guard transfer.kind == "AutomaticCalendarTransfer", transfer.account == request.account,
                      transfer.occurrenceID == request.occurrenceID, transfer.source == request.source,
                      transfer.linkRevision == request.linkRevision else { throw invalid }
            }
            if let finished = request.finishedAtMs {
                guard request.outcome != nil, Self.epoch.contains(finished),
                      !request.changed || (request.checked && request.outcome == .synced),
                      request.reason.map(Self.validReason) ?? true else { throw invalid }
            } else {
                guard request.outcome == nil, !request.checked, !request.changed, request.reason == nil else { throw invalid }
            }
        }
    }

    private func validateTransfers(_ state: State) throws {
        var pendingOccurrences = Set<String>()
        var pendingSources = Set<Reservation>()
        var superseded = Set<UUID>()
        let invalid = RemiloIOSGoogleCalendarStore.Failure.invalidState
        for (id, saved) in state.transfers ?? [:] {
            let operation = saved.operation
            let manual = ["EnableCalendarLink", "ApplyCalendarResolution"].contains(operation.kind)
            let automatic = ["EnableAutomaticCalendarSync", "AutomaticCalendarTransfer"].contains(operation.kind)
            guard id == operation.operationID, state.receipts[id] == nil, saved.fingerprint.count == 32,
                  saved.requestDigest.count == 32, Self.valid(operation.source), operation.source.belongs(to: operation.account),
                  (1...Self.maximumRevision).contains(operation.account.connectionRevision),
                  (1...Self.maximumRevision).contains(operation.account.accountGeneration),
                  (0..<Self.maximumRevision).contains(operation.linkRevision), Self.epoch.contains(operation.checkedAtMs),
                  Self.validID(operation.occurrenceID, maximum: 200), operation.calendarName.utf8.count <= 4_096,
                  !operation.erased || operation.calendarName.isEmpty,
                  manual || (automatic && operation.linkRevision > 0 && saved.superseding == nil),
                  Self.validLocalStatus(operation.localStatus, applied: operation.localApplied),
                  operation.reason.map(Self.validReason) ?? true else { throw invalid }
            if let predecessor = saved.superseding {
                guard predecessor != id, superseded.insert(predecessor).inserted,
                      let previous = state.transfers?[predecessor]?.operation,
                      previous.phase == .cancelled, previous.reason == "SUPERSEDED", previous.remoteAttempted,
                      previous.occurrenceID == operation.occurrenceID, previous.source == operation.source,
                      previous.origin == operation.origin else { throw invalid }
            }
            if operation.linkRevision != 0 || operation.resultLinkRevision != nil {
                guard let linked = state.links[operation.occurrenceID], linked.source == operation.source,
                      linked.origin == operation.origin, linked.revision >= operation.linkRevision else {
                    throw invalid
                }
            }
            if let result = operation.resultLinkRevision {
                guard operation.phase == .confirmed, result == operation.linkRevision + 1,
                      let linked = state.links[operation.occurrenceID], linked.revision >= result else { throw invalid }
            }
            if operation.phase.pending {
                guard pendingOccurrences.insert(operation.occurrenceID).inserted,
                      pendingSources.insert(Reservation(operation.source)).inserted else { throw invalid }
            }
            if let transfer = operation.transfer {
                guard Self.valid(transfer), transfer.operationID == id, transfer.account == operation.account,
                      transfer.evidence.source == operation.source, transfer.evidence.origin == operation.origin,
                      transfer.occurrenceID == operation.occurrenceID, transfer.linkRevision == operation.linkRevision,
                      transfer.checkedAtMs == operation.checkedAtMs, try transferDigest(transfer) == saved.requestDigest else { throw invalid }
                switch transfer.automatic?.kind {
                case .activation: guard operation.kind == "EnableAutomaticCalendarSync" else { throw invalid }
                case .transfer: guard operation.kind == "AutomaticCalendarTransfer" else { throw invalid }
                case nil: guard manual else { throw invalid }
                }
                if let after = operation.localAfter {
                    guard Self.validLocalResult(after, transfer: transfer), operation.localApplied == transfer.needsLocal else { throw invalid }
                }
                if let readback = operation.readback, try transfer.readback() != readback { throw invalid }
            }
            switch operation.phase {
            case .waiting:
                guard !operation.erased, operation.transfer != nil, operation.localAfter == nil, operation.readback == nil,
                      !operation.localApplied, !operation.remoteAttempted, operation.reason == nil else { throw invalid }
            case .localApplied:
                guard !operation.erased, operation.transfer != nil, operation.localAfter != nil, operation.readback == nil,
                      !operation.remoteAttempted, operation.reason == nil else { throw invalid }
            case .sent:
                guard operation.remoteAttempted, let readback = operation.readback, readback.evidence.source == operation.source,
                      readback.evidence.origin == operation.origin, readback.desiredDigest.count == 32,
                      (operation.transfer == nil) == operation.erased, (operation.localAfter == nil) == operation.erased,
                      operation.reason == nil else { throw invalid }
            case .confirmed, .failed, .cancelled:
                guard operation.transfer == nil, operation.localAfter == nil, operation.readback == nil,
                      (operation.reason == nil) == (operation.phase == .confirmed) else { throw invalid }
            }
        }
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

    private struct Header: Decodable { let schemaVersion: Int }
}
