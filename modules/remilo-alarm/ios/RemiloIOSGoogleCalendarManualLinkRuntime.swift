import CryptoKit
import Foundation

/// Native explicit review and association. The existing relationship and its
/// immutable provider identity are checked independently of the publishing destination.
@MainActor
final class RemiloIOSGoogleCalendarManualLinkRuntime {
    typealias Link = RemiloIOSGoogleCalendarManualLink
    typealias Store = RemiloIOSGoogleCalendarManualLinkStore
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias ImportJournal = RemiloIOSGoogleCalendarImportJournal
    typealias Publication = RemiloIOSGoogleCalendarPublicationRuntime
    typealias Account = Link.Publication.Account
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Managed = RemiloIOSGoogleCalendarManagedSetupJournal

    enum Checkpoint: Sendable {
        case agreement(Store.Receipt)
        case observation(Store.Record)
        case transfer(Store.Operation)
        case send(Writer.Permission)
    }

    struct LocalResult: Sendable {
        let snapshot: Publication.LocalSnapshot
        let status: String
    }

    enum AutomaticPass: Sendable {
        case observed(Store.Record)
        case transfer(Store.Operation)
    }

    struct SyncStatus: Sendable {
        enum State: String, Sendable {
            case confirmed = "Confirmed", paused = "Paused", pending = "UpdatePending"
            case review = "Review", deferred = "Deferred", unconfirmed = "Unconfirmed"
        }

        let mode: String
        let state: State
        var reason = ""
        var needsReview = false

        var automatic: Bool {
            mode == "Automatic" && [.confirmed, .pending, .deferred].contains(state)
        }
    }

    struct AssociationStatus: Sendable {
        let request: Store.AssociationRequest
        let transfer: Store.Operation?
        let running: Bool
        let currentScope: Bool
    }

    struct ResumeRow: Sendable {
        let occurrenceID: String
        let title: String
        let approval: Managed.ResumeLink?
        let reason: String?
        var inbound: [String] = []
        var outbound: [String] = []

        var itemID: String { "association:" + occurrenceID }
    }

    private struct ResumeSnapshot: Encodable {
        let id: UUID
        let record: Store.Record
        let local: Publication.LocalSnapshot
        let remote: Link.Observation
    }

    struct LocalAuthority: Sendable {
        typealias Commit = @MainActor @Sendable () throws -> Checkpoint
        typealias Permission = @MainActor @Sendable () throws -> Bool
        let read: @MainActor @Sendable (String) throws -> Publication.LocalSnapshot?
        let permit: @MainActor @Sendable (Publication.LocalSnapshot, @escaping Commit) async throws -> Checkpoint
        var timing: @MainActor @Sendable (Publication.LocalSnapshot, Link.Event.Fields) throws -> Link.Timing? = { _, _ in nil }
        var receipt: @MainActor @Sendable (Link.Transfer) throws -> LocalResult? = { _ in nil }
        var apply: @MainActor @Sendable (Link.Transfer, @escaping Permission) async throws -> LocalResult = { _, _ in
            throw Link.Failure.unsupported
        }
        var lifecycleRevision: @MainActor @Sendable (String) throws -> Int? = { _ in nil }
    }

    private struct Command: Encodable {
        let kind: String
        let connectionRevision: Int
        let reviewID: UUID?
        let occurrenceID: String?
        let linkRevision: Int?
        let selections: [String: String]?
        var activationRevision: Int? = nil

        func fingerprint() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }
    }

    private let connection: Connection
    private let publication: Publication
    private let imports: ImportJournal
    private let store: Store
    private let local: LocalAuthority
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let now: @Sendable () -> Int64
    private let notifyStatusChange: @MainActor @Sendable () -> Void
    private let allowsManagedLease: @MainActor @Sendable (Link.ManagedLease, Account) throws -> Bool
    private var reviews: [Link.Review] = []
    private var running = Set<UUID>()
    private var checkingLinks = Set<String>()
    private var associationWorkers = Set<UUID>()

    init(connection: Connection, publication: Publication, imports: ImportJournal, store: Store,
         local: LocalAuthority, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) },
         allowsManagedLease: @escaping @MainActor @Sendable (Link.ManagedLease, Account) throws -> Bool = { _, _ in false },
         notifyStatusChange: @escaping @MainActor @Sendable () -> Void = {}) {
        self.connection = connection
        self.publication = publication
        self.imports = imports
        self.store = store
        self.local = local
        self.canUseForeground = canUseForeground
        self.now = now
        self.allowsManagedLease = allowsManagedLease
        self.notifyStatusChange = notifyStatusChange
    }

    /// A settled import can establish its common baseline without writing to
    /// either copy. Reopen and retry the durable receipt if interrupted here.
    func attachManagedImport(_ work: ImportJournal.ManagedLinkWork, expectedConnectionRevision: Int,
                             budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws {
        let account = try viewer(expectedConnectionRevision)
        let lease = work.permit.scope.binding.linkLease
        let receipt = work.receipt
        guard receipt.relationship == .automaticRequested, let imported = receipt.local, imported.kind == .reminder,
              receipt.source == work.permit.source, receipt.reviewedETag == work.permit.observation.etag,
              try permitsManagedLease(lease, account: account) else { throw Link.Failure.stalePreview }
        let source = Link.Source(subject: receipt.source.subject, clientID: account.clientID,
                                 calendarID: receipt.source.calendarID, eventID: receipt.source.eventID)
        if let existing = try store.link(imported.id) {
            guard existing.source == source, existing.origin == .imported else { throw Link.Failure.ineligible }
            return
        }
        guard let snapshot = try local.read(imported.id), let lifecycle = try local.lifecycleRevision(imported.id) else {
            throw Link.Failure.ineligible
        }
        let evidence = Link.Evidence.imported(source)
        let remote = try await connection.observeManualLink(evidence, account: account, managedLease: lease, budget: budget,
            canRead: { [canUseForeground, allowsManagedLease] in
                canUseForeground() && (try? allowsManagedLease(lease, account)) == true
            })
        guard remote.etag == receipt.reviewedETag, remote.fields == snapshot.fields else { throw Link.Failure.staleRemote }
        let checkpoint = try await local.permit(snapshot) { [self] in
            guard canUseForeground(), try connection.isCurrentAccount(account),
                  try permitsManagedLease(lease, account: account),
                  try local.lifecycleRevision(imported.id) == lifecycle else { throw Link.Failure.stalePreview }
            return .observation(try store.attachManaged(viewingAs: account, occurrenceID: imported.id, remote: remote,
                                                        lifecycleRevision: lifecycle, lease: lease, observedAtMs: now()))
        }
        guard case .observation = checkpoint else { throw Failure.invalidResponse }
    }

    func attachManagedPublication(_ entry: Publication.Journal.Entry, expectedConnectionRevision: Int,
                                  budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws {
        let account = try viewer(expectedConnectionRevision)
        let identity = entry.identity
        let id = identity.local.occurrenceID
        guard let lease = entry.managedLease, lease.publication == true,
              try publication.permitsManagedLink(entry, viewingAs: account) else { throw Link.Failure.stalePreview }
        let evidence = Link.Evidence.published(identity)
        if let existing = try store.link(id) {
            guard existing.source == evidence.source, existing.origin == .published else { throw Link.Failure.ineligible }
            return
        }
        guard let snapshot = try local.read(id), let lifecycle = try local.lifecycleRevision(id) else { throw Link.Failure.ineligible }
        let remote = try await connection.observeManualLink(evidence, account: account, managedLease: lease, budget: budget,
            canRead: { [self] in
                canUseForeground() && (try? publication.permitsManagedLink(entry, viewingAs: account)) == true
            })
        // The exact sent fields are the baseline even if the user has edited
        // the reminder since dispatch. The next link pass can send that edit.
        guard try identity.matches(remote.fields) else { throw Link.Failure.staleRemote }
        let checkpoint = try await local.permit(snapshot) { [self] in
            guard canUseForeground(), try connection.isCurrentAccount(account),
                  try publication.permitsManagedLink(entry, viewingAs: account),
                  try local.lifecycleRevision(id) == lifecycle else { throw Link.Failure.stalePreview }
            return .observation(try store.attachManaged(viewingAs: account, occurrenceID: id, remote: remote,
                                                        lifecycleRevision: lifecycle, lease: lease, observedAtMs: now()))
        }
        guard case .observation = checkpoint else { throw Failure.invalidResponse }
    }

    func preview(_ occurrenceID: String, expectedConnectionRevision: Int, superseding: UUID? = nil) async throws -> Link.Review {
        try await prepareReview(occurrenceID, expectedConnectionRevision: expectedConnectionRevision, superseding: superseding)
    }

    func previewActivation(_ occurrenceID: String, expectedConnectionRevision: Int,
                           expectedLinkRevision: Int) async throws -> Link.Review {
        try await prepareReview(occurrenceID, expectedConnectionRevision: expectedConnectionRevision,
                                activationLinkRevision: expectedLinkRevision)
    }

    private func prepareReview(_ occurrenceID: String, expectedConnectionRevision: Int, superseding: UUID? = nil,
                               activationLinkRevision: Int? = nil) async throws -> Link.Review {
        let account = try viewer(expectedConnectionRevision)
        guard let snapshot = try local.read(occurrenceID) else { throw Link.Failure.ineligible }
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        let saved = try existingLink(occurrenceID, evidence: evidence)
        let lifecycleRevision: Int?
        if let activationLinkRevision {
            guard saved?.state == .linked, saved?.revision == activationLinkRevision,
                  let current = try local.lifecycleRevision(occurrenceID) else { throw Link.Failure.stalePreview }
            lifecycleRevision = current
        } else {
            lifecycleRevision = nil
        }
        let pending = try store.pendingTransfer(occurrenceID: occurrenceID, source: evidence.source, viewingAs: account)
        guard pending?.operationID == superseding else {
            throw pending == nil ? Store.Rejection.stalePreview : Store.Rejection.operationPending
        }
        let remote = try await connection.observeManualLink(evidence, account: account, canRead: canUseForeground)
        guard try viewer(expectedConnectionRevision) == account, try local.read(occurrenceID) == snapshot,
              try existingLink(occurrenceID, evidence: evidence)?.revision == saved?.revision else { throw Link.Failure.stalePreview }
        if let lifecycleRevision, try local.lifecycleRevision(occurrenceID) != lifecycleRevision { throw Link.Failure.stalePreview }
        let checked = now()
        reviews.removeAll { $0.account != account || !$0.valid(at: checked) || $0.local.version.occurrenceID == occurrenceID }
        if reviews.count == 8 { reviews.removeFirst() }
        var review = Link.Review(id: UUID(), account: account, evidence: evidence, local: snapshot, remote: remote,
                                 linkRevision: saved?.revision, baseline: saved?.baseline, checkedAtMs: checked)
        review.activationLifecycleRevision = lifecycleRevision
        if let pending {
            guard pending.phase == .sent, !running.contains(pending.operationID),
                  try store.pendingTransfer(occurrenceID: occurrenceID, source: evidence.source, viewingAs: account)?.operationID == pending.operationID,
                  let transfer = pending.transfer, let readback = pending.readback,
                  remote.etag != transfer.remote.etag, try !readback.matches(remote.fields) else {
                throw Store.Rejection.operationPending
            }
            review.supersedingOperationID = pending.operationID
        }
        review.remiloTiming = try local.timing(snapshot, snapshot.fields)
        let googleSchedule = Link.Event.Fields(title: snapshot.fields.title, notes: snapshot.fields.notes, schedule: remote.fields.schedule)
        do { review.googleTiming = try local.timing(snapshot, googleSchedule) }
        catch let failure as Link.LocalFailure { review.manualScheduleBlocked = failure.code }
        reviews.append(review)
        return review
    }

    func canLink(_ occurrenceID: String, expectedConnectionRevision: Int) async throws -> Bool {
        let account = try viewer(expectedConnectionRevision)
        guard try local.read(occurrenceID) != nil else { return false }
        do {
            let evidence = try await resolveEvidence(occurrenceID, account: account)
            _ = try existingLink(occurrenceID, evidence: evidence)
            return try local.read(occurrenceID) != nil
        } catch Link.Failure.ineligible { return false }
    }

    func check(_ occurrenceID: String, expectedConnectionRevision: Int, expectedLinkRevision: Int) async throws -> Store.Record {
        let account = try viewer(expectedConnectionRevision)
        guard let record = try store.link(occurrenceID), record.source.belongs(to: account),
              record.state == .linked, try local.read(occurrenceID) != nil else {
            throw Link.Failure.ineligible
        }
        guard record.revision == expectedLinkRevision else { throw Link.Failure.stalePreview }
        guard checkingLinks.insert(occurrenceID).inserted else { throw Store.Rejection.operationPending }
        defer { checkingLinks.remove(occurrenceID) }

        let attemptedAt = now()
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        guard evidence.source == record.source, evidence.origin == record.origin else { throw Link.Failure.stalePreview }
        let result = try await inspectLink(evidence, account: account)
        try Task.checkCancellation()
        guard let snapshot = try local.read(occurrenceID) else { throw Link.Failure.stalePreview }
        return try await recordObservation(record, result: result, snapshot: snapshot, account: account, attemptedAt: attemptedAt)
    }

    func confirmAgreement(operationID: UUID, reviewID: UUID, expectedConnectionRevision: Int,
                          choices: [Link.Comparison.Group: Link.Comparison.Side]) async throws -> Store.Receipt {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: "agree", connectionRevision: expectedConnectionRevision,
                                      reviewID: reviewID, occurrenceID: nil, linkRevision: nil,
                                      selections: Dictionary(uniqueKeysWithValues: choices.map { ($0.key.rawValue, $0.value.rawValue) }))
            .fingerprint()
        if let receipt = try store.receipt(operationID: operationID, fingerprint: fingerprint, viewingAs: account) { return receipt }
        guard let review = reviews.first(where: { $0.id == reviewID && $0.account == account }),
              review.valid(at: now()), review.activationLifecycleRevision == nil else {
            throw Link.Failure.stalePreview
        }
        let result = try review.resolve(choices)
        guard result.inbound.isEmpty, result.outbound.isEmpty else { throw Link.Failure.resolutionRequired }
        let observed = try await connection.observeManualLink(review.evidence, account: account, canRead: canUseForeground)
        let baseline = try review.commonBaseline(after: observed)
        let checkpoint = try await local.permit(review.local) { [self] in
            if let receipt = try store.receipt(operationID: operationID, fingerprint: fingerprint, viewingAs: account) {
                return .agreement(receipt)
            }
            guard canUseForeground(), try connection.isCurrentAccount(account) else { throw Failure.staleConnection }
            guard review.valid(at: now()) else { throw Link.Failure.stalePreview }
            return .agreement(try store.attach(operationID: operationID, fingerprint: fingerprint, viewingAs: account,
                                    occurrenceID: review.local.version.occurrenceID, source: observed.source,
                                    origin: review.evidence.origin, expectedRevision: review.linkRevision ?? 0,
                                    calendarName: observed.calendarName, baseline: baseline, observedAtMs: now()))
        }
        guard case .agreement(let receipt) = checkpoint else { throw Failure.invalidResponse }
        return receipt
    }

    func resolve(operationID: UUID, reviewID: UUID, expectedConnectionRevision: Int,
                 choices: [Link.Comparison.Group: Link.Comparison.Side], updating: Bool,
                 activating: Bool = false) async throws -> Store.Operation {
        let account = try viewer(expectedConnectionRevision)
        let kind = activating ? "activate" : updating ? "update" : "link"
        let fingerprint = try Command(kind: kind, connectionRevision: expectedConnectionRevision,
                                      reviewID: reviewID, occurrenceID: nil, linkRevision: nil,
                                      selections: Dictionary(uniqueKeysWithValues: choices.map { ($0.key.rawValue, $0.value.rawValue) }))
            .fingerprint()
        if let operation = try store.transferOperation(operationID, viewingAs: account, fingerprint: fingerprint) {
            return try await run(operation, viewer: account)
        }
        guard let review = reviews.first(where: { $0.id == reviewID && $0.account == account }), review.valid(at: now()) else {
            throw Link.Failure.stalePreview
        }
        let existing = try existingLink(review.local.version.occurrenceID, evidence: review.evidence)
        guard (existing?.state == .linked) == updating, existing?.revision == review.linkRevision,
              (review.activationLifecycleRevision != nil) == activating else { throw Link.Failure.stalePreview }
        let selected = try review.resolve(choices)
        guard !selected.desired.title.isEmpty else { throw Link.LocalFailure(code: "TITLE_REQUIRED") }
        let automatic = review.activationLifecycleRevision.map {
            Link.AutomaticAuthority(kind: .activation, activationRevision: review.linkRevision ?? 0, lifecycleRevision: $0)
        }
        let transfer = Link.Transfer(operationID: operationID, account: account, evidence: review.evidence, local: review.local,
                                     remote: review.remote, desired: selected.desired, linkRevision: review.linkRevision ?? 0,
                                     checkedAtMs: review.checkedAtMs, automatic: automatic)
        if transfer.needsLocal { _ = try local.timing(transfer.local, transfer.desired) }
        if transfer.needsRemote { _ = try Writer.Patch(transfer) }
        if transfer.needsRemote || activating {
            try connection.requireManualLinkWrite(account: account)
        }
        if review.supersedingOperationID != nil {
            let observed = try await observe(review.evidence, account: account)
            guard review.remote.matches(observed) else { throw Link.Failure.staleRemote }
        }
        let captured = try await local.permit(review.local) { [self] in
            try requireLive(transfer)
            guard review.valid(at: now()) else { throw Link.Failure.stalePreview }
            if let superseding = review.supersedingOperationID, running.contains(superseding) {
                throw Store.Rejection.operationPending
            }
            return .transfer(try store.captureTransfer(transfer, fingerprint: fingerprint,
                                                       superseding: review.supersedingOperationID))
        }
        guard case .transfer(let operation) = captured else { throw Failure.invalidResponse }
        return try await run(operation, viewer: account)
    }

    func retry(_ id: UUID, expectedConnectionRevision: Int) async throws -> Store.Operation {
        let account = try viewer(expectedConnectionRevision)
        guard let operation = try store.transferOperation(id, viewingAs: account) else { throw Failure.notFound }
        return try await run(operation, viewer: account)
    }

    func transferOperation(_ id: UUID, expectedConnectionRevision: Int) throws -> Store.Operation? {
        try store.transferOperation(id, viewingAs: viewer(expectedConnectionRevision))
    }

    func transferOperations(expectedConnectionRevision: Int) throws -> [Store.Operation] {
        try store.transferOperations(viewingAs: viewer(expectedConnectionRevision))
    }

    func unlink(operationID: UUID, occurrenceID: String, expectedConnectionRevision: Int,
                expectedLinkRevision: Int) throws -> Store.Receipt {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: "unlink", connectionRevision: expectedConnectionRevision,
                                      reviewID: nil, occurrenceID: occurrenceID, linkRevision: expectedLinkRevision,
                                      selections: nil).fingerprint()
        return try store.detach(operationID: operationID, fingerprint: fingerprint, viewingAs: account,
                                occurrenceID: occurrenceID, expectedRevision: expectedLinkRevision)
    }

    func disableAutomatic(operationID: UUID, occurrenceID: String, expectedConnectionRevision: Int,
                          expectedLinkRevision: Int) throws -> Store.Receipt {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: "disableAutomatic", connectionRevision: expectedConnectionRevision,
                                      reviewID: nil, occurrenceID: occurrenceID, linkRevision: expectedLinkRevision,
                                      selections: nil).fingerprint()
        return try store.disableAutomatic(operationID: operationID, fingerprint: fingerprint, viewingAs: account,
                                          occurrenceID: occurrenceID, expectedRevision: expectedLinkRevision)
    }

    func reviewManagedResume(_ binding: Managed.Binding, policy: Managed.Policy, account: Account,
                             canRead: @escaping @MainActor @Sendable () -> Bool) async throws -> [ResumeRow] {
        let records = try store.links(viewingAs: account).filter { record in
            guard record.state == .linked, let consent = record.automatic, consent.phase == .active,
                  consent.accountGeneration == account.accountGeneration, let lease = consent.managedLease,
                  Managed.sameDestination(lease, as: binding), lease.authEpoch <= binding.authEpoch else { return false }
            return lease.publication == true || policy.automaticImport
        }
        guard records.count <= 500 else { throw Failure.discoveryLimit }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var rows: [ResumeRow] = []
        for record in records {
            let id = record.occurrenceID
            guard let snapshot = try local.read(id) else { continue }
            do {
                let (approval, changes) = try await inspectManagedResume(id: UUID(), record: record, snapshot: snapshot, account: account,
                                                                        budget: budget, canRead: canRead)
                rows.append(.init(occurrenceID: id, title: snapshot.fields.title, approval: approval, reason: nil,
                                  inbound: changes.inbound.map(\.rawValue).sorted(), outbound: changes.outbound.map(\.rawValue).sorted()))
            } catch {
                guard let reason = resumeReviewFailure(error) else { throw error }
                rows.append(.init(occurrenceID: id, title: snapshot.fields.title, approval: nil, reason: reason))
            }
        }
        return rows
    }

    @discardableResult
    func validateManagedResume(_ approval: Managed.ResumeLink, account: Account, budget: RemiloIOSGoogleCalendarHTTP.Budget,
                               canRead: @escaping @MainActor @Sendable () -> Bool) async throws -> (Store.Record, Publication.LocalSnapshot) {
        let id = approval.occurrenceID
        guard let record = try store.link(id), record.source == approval.source, record.revision == approval.linkRevision,
              record.automatic?.managedLease == approval.priorLease, let snapshot = try local.read(id) else {
            throw Link.Failure.stalePreview
        }
        let (current, _) = try await inspectManagedResume(id: approval.id, record: record, snapshot: snapshot,
                                                          account: account, budget: budget, canRead: canRead)
        guard current == approval else { throw Link.Failure.stalePreview }
        return (record, snapshot)
    }

    func applyManagedResume(_ approval: Managed.ResumeLink, lease: Link.ManagedLease, account: Account,
                            budget: RemiloIOSGoogleCalendarHTTP.Budget,
                            canRead: @escaping @MainActor @Sendable () -> Bool) async throws {
        let id = approval.occurrenceID
        guard canRead(), try permitsManagedLease(lease, account: account) else { throw Failure.staleConnection }
        if let saved = try store.link(id)?.automatic, saved.resumeID == approval.id, saved.managedLease == lease { return }
        try connection.requireManualLinkWrite(account: account)
        let (record, snapshot) = try await validateManagedResume(approval, account: account, budget: budget, canRead: canRead)
        _ = try await local.permit(snapshot) { [self] in
            try Task.checkCancellation()
            guard canRead(), try permitsManagedLease(lease, account: account) else { throw Failure.staleConnection }
            try connection.requireManualLinkWrite(account: account)
            guard try local.lifecycleRevision(id) == record.automatic?.lifecycleRevision else { throw Link.Failure.stalePreview }
            return .observation(try store.resumeManaged(record, id: approval.id, lease: lease, account: account))
        }
    }

    func resumeReviewFailure(_ error: Error) -> String? {
        if let failure = error as? Link.LocalFailure { return failure.code }
        return reviewFailure(error)
    }

    private func inspectManagedResume(id: UUID, record: Store.Record, snapshot: Publication.LocalSnapshot, account: Account,
                                      budget: RemiloIOSGoogleCalendarHTTP.Budget,
                                      canRead: @escaping @MainActor @Sendable () -> Bool) async throws
        -> (Managed.ResumeLink, Link.Comparison.Result) {
        let occurrenceID = record.occurrenceID
        guard canRead(), let consent = record.automatic, consent.accountGeneration == account.accountGeneration,
              let lease = consent.managedLease else { throw Failure.staleConnection }
        func requireReviewedState() throws {
            guard try store.link(occurrenceID) == record, try local.read(occurrenceID) == snapshot,
                  try local.lifecycleRevision(occurrenceID) == consent.lifecycleRevision else { throw Link.Failure.stalePreview }
            guard record.check?.requiresReview != true, consent.issue != .review else { throw Link.Failure.resolutionRequired }
            guard try store.pendingTransfer(occurrenceID: occurrenceID, source: record.source, viewingAs: account) == nil,
                  try !store.pendingAssociationOccurrenceIDs(viewingAs: account).contains(occurrenceID) else {
                throw Store.Rejection.operationPending
            }
        }
        try requireReviewedState()
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        guard evidence.source == record.source, evidence.origin == record.origin else { throw Link.Failure.stalePreview }
        let remote = try await connection.observeManualLink(evidence, account: account, managedLease: lease, budget: budget, canRead: canRead)
        try requireReviewedState()
        let comparison = Link.Comparison.compare(local: snapshot.fields, remote: remote.fields, baseline: record.baseline)
        guard comparison.conflicts.isEmpty, !comparison.desired.title.isEmpty else { throw Link.Failure.resolutionRequired }
        let transfer = Link.Transfer(operationID: id, account: account, evidence: evidence, local: snapshot, remote: remote,
                                     desired: comparison.desired, linkRevision: record.revision, checkedAtMs: now())
        if transfer.needsLocal { _ = try local.timing(snapshot, comparison.desired) }
        if transfer.needsRemote { _ = try Writer.Patch(transfer) }
        // Retain a proof of the exact review across restart without copying
        // private event or reminder content into the setup journal.
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let reviewed = ResumeSnapshot(id: id, record: record, local: snapshot, remote: remote)
        let digest = Data(SHA256.hash(data: try encoder.encode(reviewed)))
        return (.init(id: id, occurrenceID: occurrenceID, source: record.source, linkRevision: record.revision,
                      priorLease: lease, reviewedDigest: digest), comparison)
    }

    func automaticCandidates(expectedConnectionRevision: Int, inspectUnchanged: Bool) throws -> [Store.Record] {
        let account = try viewer(expectedConnectionRevision)
        try connection.requireManualLinkWrite(account: account)
        let pending = try store.transferOperations(viewingAs: account).filter { $0.phase.pending }
        let blocked = try store.pendingAssociationOccurrenceIDs(viewingAs: account)
            .union(pending.filter { $0.transfer?.automatic?.kind != .transfer }.map(\.occurrenceID))
        return try store.links(viewingAs: account).filter { record in
            let id = record.occurrenceID
            guard !blocked.contains(id), record.state == .linked, record.check?.requiresReview != true,
                  let consent = record.automatic, consent.phase == .active, consent.issue != .review,
                  consent.accountGeneration == account.accountGeneration,
                  try permitsManagedLease(consent.managedLease, account: account),
                  try local.lifecycleRevision(id) == consent.lifecycleRevision,
                  let snapshot = try local.read(id) else { return false }
            return inspectUnchanged || !matchesBaseline(snapshot.fields, record.baseline)
        }
    }

    func syncAutomatic(_ occurrenceID: String, expectedConnectionRevision: Int, expectedLinkRevision: Int,
                       expectedActivationRevision: Int, inspectUnchanged: Bool = true,
                       operationID requestedID: UUID? = nil) async throws -> AutomaticPass {
        let account = try viewer(expectedConnectionRevision)
        guard let record = try store.link(occurrenceID), record.source.belongs(to: account), record.state == .linked,
              let consent = record.automatic, consent.phase == .active, consent.issue != .review,
              record.check?.requiresReview != true, consent.accountGeneration == account.accountGeneration,
              try permitsManagedLease(consent.managedLease, account: account) else {
            throw Link.Failure.ineligible
        }
        guard record.revision == expectedLinkRevision, consent.activationRevision == expectedActivationRevision,
              let snapshot = try local.read(occurrenceID),
              try local.lifecycleRevision(occurrenceID) == consent.lifecycleRevision else { throw Link.Failure.stalePreview }
        guard inspectUnchanged || !matchesBaseline(snapshot.fields, record.baseline) else { throw Link.Failure.ineligible }
        if requestedID == nil, try store.pendingAssociationOccurrenceIDs(viewingAs: account).contains(occurrenceID) {
            throw Store.Rejection.operationPending
        }
        try connection.requireManualLinkWrite(account: account)
        guard checkingLinks.insert(occurrenceID).inserted else { throw Store.Rejection.operationPending }
        defer { checkingLinks.remove(occurrenceID) }
        if let pending = try store.pendingTransfer(occurrenceID: occurrenceID, source: record.source, viewingAs: account) {
            guard pending.transfer?.automatic?.kind == .transfer,
                  requestedID == nil || pending.operationID == requestedID else { throw Store.Rejection.operationPending }
            return .transfer(try await run(pending, viewer: account))
        }

        let attemptedAt = now()
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        guard evidence.source == record.source, evidence.origin == record.origin else { throw Link.Failure.stalePreview }
        let result = try await inspectLink(evidence, account: account, managedLease: consent.managedLease)
        guard case .available(let remote) = result else {
            return .observed(try await recordObservation(record, result: result, snapshot: snapshot, account: account,
                                                        attemptedAt: attemptedAt))
        }
        let comparison = Link.Comparison.compare(local: snapshot.fields, remote: remote.fields, baseline: record.baseline)
        if !comparison.conflicts.isEmpty || comparison.desired.title.isEmpty {
            return .observed(try await recordAutomaticIssue(.review, record: record, snapshot: snapshot, account: account))
        }
        let desired = comparison.desired
        if snapshot.fields == remote.fields, consent.issue == nil, matchesBaseline(desired, record.baseline) {
            return .observed(try await recordObservation(record, result: result, snapshot: snapshot, account: account,
                                                        attemptedAt: attemptedAt))
        }
        let operationID = requestedID ?? UUID()
        let authority = Link.AutomaticAuthority(kind: .transfer, activationRevision: consent.activationRevision,
                                                lifecycleRevision: consent.lifecycleRevision, managedLease: consent.managedLease)
        let transfer = Link.Transfer(operationID: operationID, account: account, evidence: evidence, local: snapshot,
                                     remote: remote, desired: desired, linkRevision: record.revision, checkedAtMs: attemptedAt,
                                     automatic: authority)
        do {
            if transfer.needsLocal { _ = try local.timing(snapshot, desired) }
            if transfer.needsRemote { _ = try Writer.Patch(transfer) }
        } catch let failure as Link.LocalFailure {
            let issue: Store.AutomaticIssue = failure.code == "RINGING_DEFERRED" ? .ringing : .review
            return .observed(try await recordAutomaticIssue(issue, record: record, snapshot: snapshot, account: account))
        } catch Link.Failure.unsupported {
            return .observed(try await recordAutomaticIssue(.review, record: record, snapshot: snapshot, account: account))
        }
        let fingerprint = try Command(kind: "automaticTransfer", connectionRevision: expectedConnectionRevision,
                                      reviewID: operationID, occurrenceID: occurrenceID, linkRevision: record.revision,
                                      selections: nil).fingerprint()
        let captured = try await local.permit(snapshot) { [self] in
            try requireLive(transfer)
            return .transfer(try store.captureTransfer(transfer, fingerprint: fingerprint))
        }
        guard case .transfer(let operation) = captured else { throw Failure.invalidResponse }
        let settled = try await run(operation, viewer: account)
        try await refreshAfterConditionalFailure(settled, account: account)
        return .transfer(settled)
    }

    func requestAssociationSync(_ id: UUID, occurrenceID: String, expectedConnectionRevision: Int,
                                expectedLinkRevision: Int, expectedActivationRevision: Int) throws -> Store.AssociationRequest {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: "associationSync", connectionRevision: expectedConnectionRevision,
                                      reviewID: nil, occurrenceID: occurrenceID, linkRevision: expectedLinkRevision,
                                      selections: nil, activationRevision: expectedActivationRevision).fingerprint()
        if let existing = try store.associationRequest(id, viewingAs: account, fingerprint: fingerprint) {
            startAssociation(existing, viewer: account)
            return existing
        }
        guard let record = try store.link(occurrenceID), record.revision == expectedLinkRevision,
              let consent = record.automatic, consent.activationRevision == expectedActivationRevision,
              try permitsManagedLease(consent.managedLease, account: account),
              try local.lifecycleRevision(occurrenceID) == consent.lifecycleRevision else { throw Link.Failure.stalePreview }
        guard !checkingLinks.contains(occurrenceID) else { throw Store.Rejection.operationPending }
        try connection.requireManualLinkWrite(account: account)
        let request = try store.captureAssociationRequest(id, fingerprint: fingerprint, record: record, viewingAs: account, at: now())
        startAssociation(request, viewer: account)
        return request
    }

    func associationStatus(_ id: UUID, expectedConnectionRevision: Int) throws -> AssociationStatus? {
        let account = try viewer(expectedConnectionRevision)
        guard let request = try store.associationRequest(id, viewingAs: account) else { return nil }
        let transfer = try store.transferOperation(id, viewingAs: account)
        return AssociationStatus(request: request, transfer: transfer, running: associationWorkers.contains(id),
                                 currentScope: try associationScopeMatches(request, viewer: account, transfer: transfer))
    }

    func latestAssociationRequests(expectedConnectionRevision: Int) throws -> [String: UUID] {
        try store.latestAssociationRequests(viewingAs: viewer(expectedConnectionRevision))
    }

    func retryAssociation(_ id: UUID, expectedConnectionRevision: Int) throws {
        let account = try viewer(expectedConnectionRevision)
        guard let request = try store.associationRequest(id, viewingAs: account) else { throw Failure.notFound }
        startAssociation(request, viewer: account)
    }

    func resumeAssociationRequests(expectedConnectionRevision: Int, limit: Int) throws {
        let account = try viewer(expectedConnectionRevision)
        for request in try store.pendingAssociationRequests(viewingAs: account).prefix(limit) {
            startAssociation(request, viewer: account)
        }
    }

    private func startAssociation(_ request: Store.AssociationRequest, viewer account: Account) {
        guard request.outcome == nil, associationWorkers.insert(request.operationID).inserted else { return }
        Task { [self] in
            let prior = try? store.transferOperation(request.operationID, viewingAs: account)
            defer {
                associationWorkers.remove(request.operationID)
                let saved = try? store.associationRequest(request.operationID, viewingAs: account)
                let transfer = try? store.transferOperation(request.operationID, viewingAs: account)
                if saved != request || transfer != prior { notifyStatusChange() }
            }
            do {
                try await runAssociation(request, viewer: account)
            } catch {
                if let failure = error as? Failure, [.network, .retry, .budget, .apiError, .invalidResponse].contains(failure) {
                    if let saved = try? store.transferOperation(request.operationID, viewingAs: account), saved.phase.pending { return }
                    _ = try? store.finishAssociationRequest(request, outcome: .failed, at: now(), checked: false, reason: failure.rawValue)
                }
            }
        }
    }

    private func associationScopeMatches(_ request: Store.AssociationRequest, viewer account: Account,
                                         transfer: Store.Operation? = nil) throws -> Bool {
        guard request.account == account, let record = try store.link(request.occurrenceID), record.state == .linked,
              record.source == request.source, record.revision == (transfer?.resultLinkRevision ?? request.linkRevision),
              let consent = record.automatic, consent.phase == .active,
              consent.activationRevision == request.activationRevision, consent.accountGeneration == account.accountGeneration,
              try permitsManagedLease(consent.managedLease, account: account),
              try local.lifecycleRevision(request.occurrenceID) == request.lifecycleRevision else { return false }
        return true
    }

    private func runAssociation(_ request: Store.AssociationRequest, viewer account: Account) async throws {
        let id = request.operationID
        if let transfer = try store.transferOperation(id, viewingAs: account) {
            let outcome = try await run(transfer, viewer: account)
            try await refreshAfterConditionalFailure(outcome, account: account)
            try finishAssociation(request, transfer: outcome, viewer: account)
            return
        }
        guard try associationScopeMatches(request, viewer: account) else {
            _ = try store.finishAssociationRequest(request, outcome: .scopeChanged, at: now(), checked: false)
            return
        }
        if try store.link(request.occurrenceID)?.automatic?.issue == .review {
            _ = try store.finishAssociationRequest(request, outcome: .needsReview, at: now(), checked: false)
            return
        }
        let pass = try await syncAutomatic(request.occurrenceID, expectedConnectionRevision: account.connectionRevision,
                                           expectedLinkRevision: request.linkRevision, expectedActivationRevision: request.activationRevision,
                                           operationID: id)
        switch pass {
        case .transfer(let transfer):
            try finishAssociation(request, transfer: transfer, viewer: account)
        case .observed(let record):
            let outcome: Store.AssociationOutcome
            let error = record.check?.errorCode
            var checked = true
            if record.automatic?.issue == .review { outcome = .needsReview }
            else if record.automatic?.issue == .ringing || record.check?.requiresReview == true { outcome = .paused }
            else if let error, !error.isEmpty {
                checked = false
                outcome = ["AUTH", "NEEDS_ACCESS"].contains(error) ? .accessRequired : .failed
            } else { outcome = .noChanges }
            _ = try store.finishAssociationRequest(request, outcome: outcome, at: now(), checked: checked,
                                                   reason: error.flatMap { $0.isEmpty ? nil : $0 })
        }
    }

    private func finishAssociation(_ request: Store.AssociationRequest, transfer: Store.Operation, viewer account: Account) throws {
        guard !transfer.phase.pending else { return }
        let outcome: Store.AssociationOutcome
        var checked = false
        var changed = false
        let record = try store.link(request.occurrenceID)
        if record?.source == request.source, record?.check?.requiresReview == true {
            outcome = .paused
            checked = true
        } else if try !associationScopeMatches(request, viewer: account, transfer: transfer) {
            outcome = .scopeChanged
        } else if transfer.phase == .confirmed {
            checked = true
            changed = transfer.localApplied || transfer.remoteAttempted
            outcome = changed ? .synced : .noChanges
        } else {
            outcome = record?.automatic?.issue == .review ? .needsReview : .failed
        }
        _ = try store.finishAssociationRequest(request, outcome: outcome, at: now(), checked: checked, changed: changed,
                                               reason: transfer.reason)
    }

    private func refreshAfterConditionalFailure(_ operation: Store.Operation, account: Account) async throws {
        guard operation.kind == "AutomaticCalendarTransfer", operation.phase == .failed,
              operation.reason == Link.Failure.staleRemote.rawValue, operation.account == account,
              let record = try store.link(operation.occurrenceID), record.revision == operation.linkRevision,
              record.source == operation.source, let consent = record.automatic, consent.phase == .active,
              consent.accountGeneration == account.accountGeneration,
              try permitsManagedLease(consent.managedLease, account: account),
              try local.lifecycleRevision(operation.occurrenceID) == consent.lifecycleRevision,
              let snapshot = try local.read(operation.occurrenceID) else { return }
        let attemptedAt = now()
        let evidence = try await resolveEvidence(operation.occurrenceID, account: account)
        guard evidence.source == operation.source, evidence.origin == operation.origin else { throw Link.Failure.stalePreview }
        let result = try await inspectLink(evidence, account: account, managedLease: consent.managedLease)
        if case .available(let remote) = result,
           !Link.Comparison.compare(local: snapshot.fields, remote: remote.fields, baseline: record.baseline).conflicts.isEmpty {
            _ = try await recordAutomaticIssue(.review, record: record, snapshot: snapshot, account: account)
        } else {
            _ = try await recordObservation(record, result: result, snapshot: snapshot, account: account, attemptedAt: attemptedAt)
        }
    }

    private func matchesBaseline(_ fields: Link.Event.Fields, _ baseline: Link.Comparison.Baseline?) -> Bool {
        baseline?.title == fields.title && baseline?.notes == fields.notes && baseline?.schedule == fields.schedule
    }

    func links(expectedConnectionRevision: Int) throws -> [Store.Record] {
        try store.links(viewingAs: viewer(expectedConnectionRevision))
    }

    func savedSyncStatuses(_ view: Connection.View) throws -> [String: SyncStatus] {
        let account = try viewer(view.revision)
        let pending = try store.transferOperations(viewingAs: account).filter { $0.phase.pending }
        let byID = Dictionary(grouping: pending, by: \.occurrenceID)
        return try Dictionary(uniqueKeysWithValues: store.links(viewingAs: account).map { record in
            let id = record.occurrenceID
            let status = try savedSyncStatus(record, pending: byID[id]?.first, view: view, snapshot: local.read(id))
            return (id, status)
        })
    }

    func savedSyncStatus(_ record: Store.Record, pending: Store.Operation?, view: Connection.View,
                         snapshot: Publication.LocalSnapshot?) throws -> SyncStatus {
        guard record.state == .linked else { return .init(mode: "Manual", state: .confirmed) }
        let sourceIssue: String?
        if record.check?.requiresReview == true {
            switch record.check?.availability {
            case .deleted: sourceIssue = "RemoteDeleted"
            case .unavailable: sourceIssue = record.check?.availabilityReason == "NOT_OWNER" ? "NotOwner" : "RemoteUnavailable"
            default: sourceIssue = "ReviewRequired"
            }
        } else { sourceIssue = nil }
        guard let consent = record.automatic else {
            guard let sourceIssue else { return .init(mode: "Manual", state: .confirmed) }
            return .init(mode: "Manual", state: .paused, reason: sourceIssue, needsReview: snapshot != nil)
        }
        let mode = consent.phase == .active ? "Automatic" : "Pending"
        guard consent.accountGeneration == view.accountGeneration else { return .init(mode: mode, state: .paused, reason: "AccountChanged") }
        guard let snapshot else { return .init(mode: mode, state: .paused, reason: "LocalTerminal") }
        guard try local.lifecycleRevision(record.occurrenceID) == consent.lifecycleRevision else {
            return .init(mode: mode, state: .paused, reason: "StaleAuthorization")
        }
        let currentOperation = pending.flatMap { operation -> Store.Operation? in
            guard let authority = operation.transfer?.automatic, operation.linkRevision == record.revision,
                  operation.account.accountGeneration == consent.accountGeneration,
                  authority.activationRevision == consent.activationRevision, authority.lifecycleRevision == consent.lifecycleRevision,
                  authority.managedLease == consent.managedLease else { return nil }
            return operation
        }
        let sent = currentOperation?.phase == .sent
        if !sent, let lease = consent.managedLease, try !permitsManagedLease(lease, account: viewer(view.revision)) {
            if let sourceIssue { return .init(mode: mode, state: .paused, reason: sourceIssue, needsReview: true) }
            if consent.issue == .review { return .init(mode: mode, state: .review, reason: "ChangesNeedReview", needsReview: true) }
            return .init(mode: mode, state: .paused, reason: "StaleAuthorization")
        }
        let accessFailed = ["AUTH", "NEEDS_ACCESS", "ACCOUNT_MISMATCH", "ACCOUNT_CHANGED"].contains(record.check?.errorCode ?? "")
        guard (view.access == .ownedCalendars || view.access == .managedCreation), view.canWriteOwnedEvents, !accessFailed else {
            return .init(mode: mode, state: .paused, reason: "AccessRequired", needsReview: true)
        }
        if sent { return .init(mode: mode, state: .unconfirmed, reason: "UnconfirmedWrite", needsReview: true) }
        if let sourceIssue { return .init(mode: mode, state: .paused, reason: sourceIssue, needsReview: true) }
        if consent.issue == .review { return .init(mode: mode, state: .review, reason: "ChangesNeedReview", needsReview: true) }
        if consent.issue == .ringing { return .init(mode: mode, state: .deferred, reason: "Ringing") }
        let fields = snapshot.fields
        let differs = record.baseline?.title.map { $0 != fields.title } == true ||
            record.baseline?.notes.map { $0 != fields.notes } == true ||
            record.baseline?.schedule.map { $0 != fields.schedule } == true
        let updatePending = consent.phase == .pending || currentOperation != nil || differs || record.check?.remoteDiffers == true
        return .init(mode: mode, state: updatePending ? .pending : .confirmed)
    }

    func operation(_ id: UUID, expectedConnectionRevision: Int) throws -> Store.Receipt? {
        try store.operation(id, viewingAs: viewer(expectedConnectionRevision))
    }

    func reservedEvents(viewingAs account: Account, calendarID: String) throws -> Set<String> {
        try store.reservedEvents(viewingAs: account, calendarID: calendarID)
    }

    private func run(_ operation: Store.Operation, viewer account: Account) async throws -> Store.Operation {
        switch operation.phase {
        case .confirmed, .failed, .cancelled: return operation
        case .waiting, .localApplied, .sent: break
        }
        guard running.insert(operation.operationID).inserted else { throw RemiloIOSGoogleCalendarImport.Failure.operationPending }
        defer { running.remove(operation.operationID) }
        do {
            if operation.phase == .sent { return try await checkSent(operation, viewer: account) }
            guard let transfer = operation.transfer else { throw Failure.invalidResponse }
            return try await applyUnsent(operation, transfer: transfer, viewer: account)
        } catch {
            guard let reason = reviewFailure(error) else { throw error }
            let current = try currentOperation(operation.operationID, account: account)
            if let transfer = current.transfer, let loss = sourceLoss(error) {
                try await suspendAutomaticSource(transfer, result: loss, account: account)
            }
            if current.phase == .sent {
                if reason == Link.Failure.remoteRemoved.rawValue {
                    return try store.failReadback(current.operationID, viewingAs: account, reason: reason)
                }
                throw error
            }
            guard let transfer = current.transfer else { return current }
            return try store.failTransfer(transfer, reason: reason)
        }
    }

    private func applyUnsent(_ operation: Store.Operation, transfer: Link.Transfer, viewer account: Account) async throws -> Store.Operation {
        var current = operation
        if current.phase == .waiting, transfer.needsLocal, let recovered = try local.receipt(transfer) {
            current = try store.recordLocal(transfer, after: recovered.snapshot, status: recovered.status)
        }
        guard account == transfer.account else { throw Failure.staleConnection }
        try requireLive(transfer)
        try store.requireTransferAuthority(transfer, phase: current.phase)
        if current.phase == .waiting {
            let observed = try await observe(transfer.evidence, account: account, managedLease: transfer.automatic?.managedLease)
            guard transfer.remote.matches(observed) else { throw Link.Failure.staleRemote }
            if transfer.needsLocal {
                let applied = try await local.apply(transfer) { [self] in
                    try requireLive(transfer)
                    try store.requireTransferAuthority(transfer)
                    if transfer.needsRemote { try connection.requireManualLinkWrite(account: account) }
                    return true
                }
                current = try store.recordLocal(transfer, after: applied.snapshot, status: applied.status)
            } else {
                let recorded = try await local.permit(transfer.local) { [self] in
                    try requireLive(transfer)
                    try store.requireTransferAuthority(transfer)
                    return .transfer(try store.recordLocal(transfer, after: transfer.local, status: nil))
                }
                guard case .transfer(let recordedOperation) = recorded else { throw Failure.invalidResponse }
                current = recordedOperation
            }
        }
        guard let snapshot = current.localAfter, snapshot.fields == transfer.desired,
              try local.read(transfer.occurrenceID) == snapshot else { throw Link.Failure.stalePreview }
        try requireLive(transfer)
        try store.requireTransferAuthority(transfer, phase: .localApplied)
        if transfer.needsRemote {
            try connection.requireManualLinkWrite(account: account)
            let patch = try Writer.Patch(transfer)
            let outcome = try await connection.withPublicationAccess(captured: account, expectedRevision: account.connectionRevision,
                                                                      canRead: canUseForeground) { [self] writer, access in
                try await writer.patch(patch, access: access, phase: .notSent) { _ in
                    try await self.sendPermit(transfer, snapshot: snapshot)
                }
            }
            switch outcome {
            case .confirmed: break
            case .unconfirmed: return try currentOperation(transfer.operationID, account: account)
            case .staleRemote: return try store.failTransfer(transfer, reason: Link.Failure.staleRemote.rawValue)
            case .remoteRemoved: throw Link.Failure.remoteRemoved
            case .remoteUnavailable: throw Failure.remoteUnavailable
            case .notSent(let failure): throw failure
            case .rejected(let failure):
                if let loss = sourceLoss(failure) {
                    try await suspendAutomaticSource(transfer, result: loss, account: account)
                }
                return try store.failTransfer(transfer, reason: failure.rawValue)
            }
        }
        let observed = try await observe(transfer.evidence, account: account,
                                         managedLease: transfer.needsRemote ? nil : transfer.automatic?.managedLease)
        if observed.fields != transfer.desired {
            let latest = try currentOperation(transfer.operationID, account: account)
            if latest.phase == .sent { return latest }
            throw Link.Failure.staleRemote
        }
        return try await finish(transfer, snapshot: snapshot, remote: observed, viewer: account)
    }

    private func sendPermit(_ transfer: Link.Transfer, snapshot: Publication.LocalSnapshot) async throws -> Writer.Permission {
        let checkpoint = try await local.permit(snapshot) { [self] in
            guard canUseForeground() else { return .send(.denied(.needsAccess)) }
            try requireLive(transfer)
            try connection.requireManualLinkWrite(account: transfer.account)
            return .send(try store.beginSend(transfer, after: snapshot))
        }
        guard case .send(let permission) = checkpoint else { throw Failure.invalidResponse }
        return permission
    }

    private func checkSent(_ operation: Store.Operation, viewer account: Account) async throws -> Store.Operation {
        guard let readback = operation.readback else { throw Failure.invalidResponse }
        let remote: Link.Observation
        do { remote = try await observe(readback.evidence, account: account) }
        catch Failure.remoteUnavailable {
            if let transfer = operation.transfer {
                try await suspendAutomaticSource(transfer, result: .unavailable(Failure.remoteUnavailable.rawValue), account: account)
            }
            return operation
        }
        guard try readback.matches(remote.fields) else { return operation }
        if let transfer = operation.transfer, let snapshot = operation.localAfter, transfer.account == account {
            return try await finish(transfer, snapshot: snapshot, remote: remote, viewer: account)
        }
        return try store.confirmReadback(operation.operationID, viewingAs: account, observedRemote: remote)
    }

    private func finish(_ transfer: Link.Transfer, snapshot: Publication.LocalSnapshot, remote: Link.Observation,
                        viewer account: Account) async throws -> Store.Operation {
        let currentLocal: Publication.LocalSnapshot
        if transfer.automatic?.kind == .transfer, try currentOperation(transfer.operationID, account: account).phase == .sent {
            currentLocal = try local.read(transfer.occurrenceID) ?? snapshot
        } else {
            currentLocal = snapshot
        }
        do {
            let checkpoint = try await local.permit(currentLocal) { [self] in
                try requireLive(transfer)
                return .transfer(try store.confirmTransfer(transfer, observedLocal: currentLocal, observedRemote: remote,
                                                           observedAtMs: now(), advanceLink: true,
                                                           acceptNewerAutomaticLocal: currentLocal != snapshot))
            }
            guard case .transfer(let operation) = checkpoint else { throw Failure.invalidResponse }
            return operation
        } catch {
            guard reviewFailure(error) != nil else { throw error }
            let current = try currentOperation(transfer.operationID, account: account)
            guard current.phase == .sent else { throw error }
            if try hasCurrentAutomaticAuthority(transfer, account: account) { return current }
            return try store.confirmReadback(transfer.operationID, viewingAs: account, observedRemote: remote)
        }
    }

    private func hasCurrentAutomaticAuthority(_ transfer: Link.Transfer, account: Account) throws -> Bool {
        guard let authority = transfer.automatic, authority.kind == .transfer, transfer.account == account,
              (try? viewer(account.connectionRevision)) == account,
              let record = try store.link(transfer.occurrenceID), record.state == .linked,
              record.revision == transfer.linkRevision, record.source == transfer.evidence.source,
              record.check?.requiresReview != true, let consent = record.automatic, consent.phase == .active,
              consent.activationRevision == authority.activationRevision, consent.lifecycleRevision == authority.lifecycleRevision,
              consent.managedLease == authority.managedLease, try permitsManagedLease(consent.managedLease, account: account),
              consent.accountGeneration == account.accountGeneration else { return false }
        return try local.lifecycleRevision(transfer.occurrenceID) == authority.lifecycleRevision
    }

    private func observe(_ evidence: Link.Evidence, account: Account, managedLease: Link.ManagedLease? = nil) async throws -> Link.Observation {
        try await connection.observeManualLink(evidence, account: account, managedLease: managedLease, canRead: canUseForeground)
    }

    private func recordObservation(_ record: Store.Record, result: Store.CheckResult, snapshot: Publication.LocalSnapshot,
                                   account: Account, attemptedAt: Int64) async throws -> Store.Record {
        let checkpoint = try await local.permit(snapshot) { [self] in
            try Task.checkCancellation()
            guard try viewer(account.connectionRevision) == account else { throw Failure.staleConnection }
            return .observation(try store.observe(record, viewingAs: account, result: result, at: attemptedAt))
        }
        guard case .observation(let observed) = checkpoint else { throw Failure.invalidResponse }
        return observed
    }

    private func recordAutomaticIssue(_ issue: Store.AutomaticIssue, record: Store.Record, snapshot: Publication.LocalSnapshot,
                                      account: Account) async throws -> Store.Record {
        let checkpoint = try await local.permit(snapshot) { [self] in
            try Task.checkCancellation()
            guard try viewer(account.connectionRevision) == account,
                  try local.lifecycleRevision(record.occurrenceID) == record.automatic?.lifecycleRevision else {
                throw Link.Failure.stalePreview
            }
            return .observation(try store.recordAutomaticIssue(record, viewingAs: account, issue: issue))
        }
        guard case .observation(let updated) = checkpoint else { throw Failure.invalidResponse }
        return updated
    }

    private func suspendAutomaticSource(_ transfer: Link.Transfer, result: Store.CheckResult, account: Account) async throws {
        guard try hasCurrentAutomaticAuthority(transfer, account: account),
              let record = try store.link(transfer.occurrenceID), let snapshot = try local.read(transfer.occurrenceID) else { return }
        do {
            _ = try await recordObservation(record, result: result, snapshot: snapshot, account: account, attemptedAt: now())
        } catch {
            guard try !hasCurrentAutomaticAuthority(transfer, account: account) else { throw error }
        }
    }

    private func sourceLoss(_ error: Error) -> Store.CheckResult? {
        if let failure = error as? Link.Failure {
            switch failure {
            case .remoteRemoved: return .deleted("REMOTE_DELETED")
            case .foreignIdentity, .unsupported: return .unavailable(failure.rawValue)
            default: return nil
            }
        }
        if let failure = error as? Failure, [.remoteUnavailable, .notFound, .notOwner, .forbidden].contains(failure) {
            return .unavailable(failure.rawValue)
        }
        return nil
    }

    private func inspectLink(_ evidence: Link.Evidence, account: Account, managedLease: Link.ManagedLease? = nil) async throws -> Store.CheckResult {
        do {
            return .available(try await observe(evidence, account: account, managedLease: managedLease))
        } catch let failure as Failure {
            if let result = sourceLoss(failure) { return result }
            switch failure {
            case .auth, .needsAccess, .network, .retry:
                return .failed(failure.rawValue)
            case .budget:
                return .failed(Failure.retry.rawValue)
            case .invalidResponse, .responseLimit, .badRequest, .apiError:
                return .failed(Failure.apiError.rawValue)
            default: throw failure
            }
        } catch is Link.Event.Reason {
            return .failed(Failure.apiError.rawValue)
        } catch {
            if let result = sourceLoss(error) { return result }
            throw error
        }
    }

    private func requireLive(_ transfer: Link.Transfer) throws {
        try Task.checkCancellation()
        guard canUseForeground() else { throw Failure.needsAccess }
        guard try viewer(transfer.account.connectionRevision) == transfer.account else { throw Failure.staleConnection }
        guard try connection.isCurrentAccount(transfer.account) else { throw Failure.needsAccess }
        if let automatic = transfer.automatic {
            guard try local.lifecycleRevision(transfer.occurrenceID) == automatic.lifecycleRevision,
                  try permitsManagedLease(automatic.managedLease, account: transfer.account) else {
                throw Link.Failure.stalePreview
            }
            try connection.requireManualLinkWrite(account: transfer.account)
        }
    }

    private func permitsManagedLease(_ lease: Link.ManagedLease?, account: Account) throws -> Bool {
        guard let lease else { return true }
        return try allowsManagedLease(lease, account)
    }

    private func currentOperation(_ id: UUID, account: Account) throws -> Store.Operation {
        guard let operation = try store.transferOperation(id, viewingAs: account) else { throw Failure.notFound }
        return operation
    }

    private func reviewFailure(_ error: Error) -> String? {
        switch error {
        case let failure as Link.Failure: return failure.rawValue
        case let failure as Store.Rejection: return failure.rawValue
        case let failure as Link.Event.Reason: return failure.rawValue
        case let failure as Link.LocalFailure: return failure.code == "RINGING_DEFERRED" ? nil : failure.code
        case let failure as Failure:
            switch failure {
            case .staleConnection, .accountChanged, .notOwner, .notFound, .remoteUnavailable, .forbidden, .badRequest:
                return failure.rawValue
            default: return nil
            }
        default: return nil
        }
    }

    private func resolveEvidence(_ occurrenceID: String, account: Account) async throws -> Link.Evidence {
        let imported = try await imports.importedSource(occurrenceID, viewingAs: account)
        guard try viewer(account.connectionRevision) == account else { throw Failure.staleConnection }
        let published = try publication.publishedIdentity(occurrenceID, viewingAs: account)
        switch (imported, published) {
        case (let source?, nil):
            return .imported(.init(subject: source.subject, clientID: account.clientID,
                                   calendarID: source.calendarID, eventID: source.eventID))
        case (nil, let identity?): return .published(identity)
        default: throw Link.Failure.ineligible
        }
    }

    private func existingLink(_ occurrenceID: String, evidence: Link.Evidence) throws -> Store.Record? {
        let existing = try store.link(occurrenceID)
        guard existing == nil || existing?.source == evidence.source else { throw Link.Failure.ineligible }
        return existing
    }

    private func viewer(_ revision: Int) throws -> Account {
        guard canUseForeground() else { throw Failure.needsAccess }
        return try connection.savedAccount(expectedRevision: revision)
    }
}
