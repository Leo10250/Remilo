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

    struct LocalAuthority: Sendable {
        typealias Commit = @MainActor @Sendable () throws -> Store.Receipt
        let read: @MainActor @Sendable (String) throws -> Publication.LocalSnapshot?
        let permit: @MainActor @Sendable (Publication.LocalSnapshot, @escaping Commit) async throws -> Store.Receipt
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

    func preview(_ occurrenceID: String, expectedConnectionRevision: Int) async throws -> Link.Review {
        let account = try viewer(expectedConnectionRevision)
        guard let snapshot = try local.read(occurrenceID) else { throw Link.Failure.ineligible }
        let evidence = try await resolveEvidence(occurrenceID, account: account)
        let saved = try existingLink(occurrenceID, evidence: evidence)
        let remote = try await connection.observeManualLink(evidence, account: account, canRead: canUseForeground)
        guard try viewer(expectedConnectionRevision) == account, try local.read(occurrenceID) == snapshot,
              try existingLink(occurrenceID, evidence: evidence)?.revision == saved?.revision else { throw Link.Failure.stalePreview }
        let checked = now()
        reviews.removeAll { $0.account != account || !$0.valid(at: checked) || $0.local.version.occurrenceID == occurrenceID }
        if reviews.count == 8 { reviews.removeFirst() }
        let review = Link.Review(id: UUID(), account: account, evidence: evidence, local: snapshot, remote: remote,
                                 linkRevision: saved?.revision, baseline: saved?.baseline, checkedAtMs: checked)
        reviews.append(review)
        return review
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
        return try await local.permit(review.local) { [self] in
            if let receipt = try store.receipt(operationID: operationID, fingerprint: fingerprint, viewingAs: account) { return receipt }
            guard canUseForeground(), try connection.isCurrentAccount(account) else { throw Failure.staleConnection }
            guard review.valid(at: now()) else { throw Link.Failure.stalePreview }
            return try store.attach(operationID: operationID, fingerprint: fingerprint, viewingAs: account,
                                    occurrenceID: review.local.version.occurrenceID, source: observed.source,
                                    origin: review.evidence.origin, expectedRevision: review.linkRevision ?? 0,
                                    calendarName: observed.calendarName, baseline: baseline, observedAtMs: now())
        }
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
