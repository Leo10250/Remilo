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

    enum Checkpoint: Sendable {
        case agreement(Store.Receipt)
        case transfer(Store.Operation)
        case send(Writer.Permission)
    }

    struct LocalResult: Sendable {
        let snapshot: Publication.LocalSnapshot
        let status: String
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
    }

    private struct Command: Encodable {
        let kind: String
        let connectionRevision: Int
        let reviewID: UUID?
        let occurrenceID: String?
        let linkRevision: Int?
        let selections: [String: String]?

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
    private var reviews: [Link.Review] = []
    private var running = Set<UUID>()

    init(connection: Connection, publication: Publication, imports: ImportJournal, store: Store,
         local: LocalAuthority, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.connection = connection
        self.publication = publication
        self.imports = imports
        self.store = store
        self.local = local
        self.canUseForeground = canUseForeground
        self.now = now
    }

    func preview(_ occurrenceID: String, expectedConnectionRevision: Int, superseding: UUID? = nil) async throws -> Link.Review {
        let account = try viewer(expectedConnectionRevision)
        guard let snapshot = try local.read(occurrenceID) else { throw Link.Failure.ineligible }
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        let saved = try existingLink(occurrenceID, evidence: evidence)
        let pending = try store.pendingTransfer(occurrenceID: occurrenceID, source: evidence.source, viewingAs: account)
        guard pending?.operationID == superseding else {
            throw pending == nil ? Store.Rejection.stalePreview : Store.Rejection.operationPending
        }
        let remote = try await connection.observeManualLink(evidence, account: account, canRead: canUseForeground)
        guard try viewer(expectedConnectionRevision) == account, try local.read(occurrenceID) == snapshot,
              try existingLink(occurrenceID, evidence: evidence)?.revision == saved?.revision else { throw Link.Failure.stalePreview }
        let checked = now()
        reviews.removeAll { $0.account != account || !$0.valid(at: checked) || $0.local.version.occurrenceID == occurrenceID }
        if reviews.count == 8 { reviews.removeFirst() }
        var review = Link.Review(id: UUID(), account: account, evidence: evidence, local: snapshot, remote: remote,
                                 linkRevision: saved?.revision, baseline: saved?.baseline, checkedAtMs: checked)
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

    func confirmAgreement(operationID: UUID, reviewID: UUID, expectedConnectionRevision: Int,
                          choices: [Link.Comparison.Group: Link.Comparison.Side]) async throws -> Store.Receipt {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: "agree", connectionRevision: expectedConnectionRevision,
                                      reviewID: reviewID, occurrenceID: nil, linkRevision: nil,
                                      selections: Dictionary(uniqueKeysWithValues: choices.map { ($0.key.rawValue, $0.value.rawValue) }))
            .fingerprint()
        if let receipt = try store.receipt(operationID: operationID, fingerprint: fingerprint, viewingAs: account) { return receipt }
        guard let review = reviews.first(where: { $0.id == reviewID && $0.account == account }), review.valid(at: now()) else {
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
                 choices: [Link.Comparison.Group: Link.Comparison.Side], updating: Bool) async throws -> Store.Operation {
        let account = try viewer(expectedConnectionRevision)
        let fingerprint = try Command(kind: updating ? "update" : "link", connectionRevision: expectedConnectionRevision,
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
        guard (existing?.state == .linked) == updating, existing?.revision == review.linkRevision else { throw Link.Failure.stalePreview }
        let selected = try review.resolve(choices)
        guard !selected.desired.title.isEmpty else { throw Link.LocalFailure(code: "TITLE_REQUIRED") }
        let transfer = Link.Transfer(operationID: operationID, account: account, evidence: review.evidence, local: review.local,
                                     remote: review.remote, desired: selected.desired, linkRevision: review.linkRevision ?? 0,
                                     checkedAtMs: review.checkedAtMs)
        if transfer.needsLocal { _ = try local.timing(transfer.local, transfer.desired) }
        if transfer.needsRemote {
            _ = try Writer.Patch(transfer)
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

    func links(expectedConnectionRevision: Int) throws -> [Store.Record] {
        try store.links(viewingAs: viewer(expectedConnectionRevision))
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
            let observed = try await observe(transfer.evidence, account: account)
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
            case .remoteRemoved: return try store.failTransfer(transfer, reason: Link.Failure.remoteRemoved.rawValue)
            case .remoteUnavailable: throw Failure.remoteUnavailable
            case .notSent(let failure): throw failure
            case .rejected(let failure): return try store.failTransfer(transfer, reason: failure.rawValue)
            }
        }
        let observed = try await observe(transfer.evidence, account: account)
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
        catch Failure.remoteUnavailable { return operation }
        guard try readback.matches(remote.fields) else { return operation }
        if let transfer = operation.transfer, let snapshot = operation.localAfter, transfer.account == account {
            return try await finish(transfer, snapshot: snapshot, remote: remote, viewer: account)
        }
        return try store.confirmReadback(operation.operationID, viewingAs: account, observedRemote: remote)
    }

    private func finish(_ transfer: Link.Transfer, snapshot: Publication.LocalSnapshot, remote: Link.Observation,
                        viewer account: Account) async throws -> Store.Operation {
        do {
            let checkpoint = try await local.permit(snapshot) { [self] in
                try requireLive(transfer)
                return .transfer(try store.confirmTransfer(transfer, observedLocal: snapshot, observedRemote: remote,
                                                           observedAtMs: now(), advanceLink: true))
            }
            guard case .transfer(let operation) = checkpoint else { throw Failure.invalidResponse }
            return operation
        } catch {
            guard reviewFailure(error) != nil else { throw error }
            let current = try currentOperation(transfer.operationID, account: account)
            guard current.phase == .sent else { throw error }
            return try store.confirmReadback(transfer.operationID, viewingAs: account, observedRemote: remote)
        }
    }

    private func observe(_ evidence: Link.Evidence, account: Account) async throws -> Link.Observation {
        try await connection.observeManualLink(evidence, account: account, canRead: canUseForeground)
    }

    private func requireLive(_ transfer: Link.Transfer) throws {
        guard canUseForeground() else { throw Failure.needsAccess }
        guard try viewer(transfer.account.connectionRevision) == transfer.account else { throw Failure.staleConnection }
        guard try connection.isCurrentAccount(transfer.account) else { throw Failure.needsAccess }
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
