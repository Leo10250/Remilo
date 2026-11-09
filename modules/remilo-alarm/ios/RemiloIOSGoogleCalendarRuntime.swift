import Foundation
#if os(iOS)
import UIKit
#endif

/// The native foreground entry for Calendar. Connection owns credential and
/// revision serialization. The runtime owns the app's single live composition
/// and never exposes a credential, raw response, or Google page token.
@MainActor
final class RemiloIOSGoogleCalendarRuntime {
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias ImportJournal = RemiloIOSGoogleCalendarImportJournal

    enum Authorization: Equatable { case connectOrChangeAccount, reauthorizeCurrentAccount, writeOwnedEvents }

    private let connection: Connection
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let authorize: Connection.Authorize
    private let importJournal: ImportJournal
    private let scheduler: ImportJournal.Scheduler
    let publication: RemiloIOSGoogleCalendarPublicationRuntime?
    let manualLink: RemiloIOSGoogleCalendarManualLinkRuntime?
    private var reviews: [Import.Review] = []

    init(connection: Connection, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         importJournal: ImportJournal, scheduler: ImportJournal.Scheduler,
         publication: RemiloIOSGoogleCalendarPublicationRuntime? = nil,
         manualLink: RemiloIOSGoogleCalendarManualLinkRuntime? = nil,
         authorize: @escaping Connection.Authorize) {
        self.connection = connection
        self.canUseForeground = canUseForeground
        self.importJournal = importJournal
        self.scheduler = scheduler
        self.publication = publication
        self.manualLink = manualLink
        self.authorize = authorize
    }

    func view() async throws -> Connection.View {
        try requireForeground()
        return try connection.view()
    }

    func authorizeFromUserAction(expectedRevision: Int, intent: Authorization) async throws -> Connection.View {
        try requireForeground()
        let consent: Connection.Consent
        switch intent {
        case .connectOrChangeAccount: consent = .connectOrChangeAccount
        case .reauthorizeCurrentAccount: consent = .reauthorizeCurrentAccount
        case .writeOwnedEvents: consent = .writeOwnedEvents
        }
        let view = try await connection.connectFromUserAction(
            expectedRevision: expectedRevision, consent: consent, canCommit: canUseForeground
        ) {
            [authorize, canUseForeground] subject, purpose in
            guard await canUseForeground() else { throw Failure.needsAccess }
            let access = try await authorize(subject, purpose)
            guard await canUseForeground() else { throw Failure.needsAccess }
            return access
        }
        try requireForeground()
        reviews.removeAll()
        return view
    }

    func disconnectFromUserAction(operationID: String, expectedRevision: Int) async throws -> Connection.DisconnectResult {
        try requireForeground()
        let disconnected = try await connection.disconnect(operationID: operationID, expectedRevision: expectedRevision)
        reviews.removeAll { $0.account.connectionRevision <= expectedRevision }
        return disconnected
    }

    func ownedCalendars(expectedRevision: Int, cursor: Connection.Cursor? = nil) async throws -> Connection.OwnedPage {
        try requireForeground()
        let page = try await connection.ownedCalendars(expectedRevision: expectedRevision, nextCursor: cursor)
        try requireForeground()
        return page
    }

    /// `until` is the exclusive civil date used by the shared Calendar DTO.
    func browseEvents(expectedRevision: Int, calendarID: String, from: String, until: String,
                      cursor: Connection.EventCursor? = nil, zone: TimeZone = .current) async throws -> Connection.EventPage {
        try requireForeground()
        let page = try await connection.browseEvents(expectedRevision: expectedRevision, calendarID: calendarID,
                                                     from: from, until: until, nextCursor: cursor, zone: zone, canRead: canUseForeground)
        try requireForeground()
        let account = try connection.account(expectedRevision: page.connectionRevision)
        let reserved = try await reservedEvents(account, calendarID: calendarID)
        try requireCurrentAccount(account)
        let rows = page.items.filter { !reserved.contains($0.eventId) }
        return Connection.EventPage(items: rows, nextCursor: page.nextCursor, connectionRevision: page.connectionRevision,
                                    calendarName: page.calendarName)
    }

    func prepareImport(expectedRevision: Int, calendarID: String, eventID: String, choices: Import.Choices) async throws -> Import.Review {
        try requireForeground()
        let review = try await connection.prepareImport(expectedRevision: expectedRevision, calendarID: calendarID,
                                                       eventID: eventID, recurringChoices: choices, canRead: canUseForeground)
        try requireForeground()
        let source = review.source.key
        let reserved = try await reservedEvents(review.account, calendarID: source.calendarID)
        try requireCurrentAccount(review.account)
        guard !reserved.contains(source.eventID) else { throw Import.Failure.alreadyImported }
        reviews.removeAll { $0.source.key == review.source.key || !$0.valid(at: review.checkedAtMs) }
        if reviews.count == 8 { reviews.removeFirst() }
        reviews.append(review)
        return review
    }

    func confirmImport(operationID: UUID, reviewID: UUID, expectedRevision: Int,
                       choices: Import.Choices) async throws -> ImportJournal.Receipt {
        try requireForeground()
        let account = try connection.account(expectedRevision: expectedRevision)
        guard let review = reviews.first(where: { $0.id == reviewID }), review.account == account else {
            throw Import.Failure.stalePreview
        }
        guard !choices.automaticSync, !choices.disableGoogleReminders else { throw Import.Failure.invalidInput }
        if try outboundAndLinkedEvents(account, calendarID: review.source.key.calendarID).contains(review.source.key.eventID) {
            throw Import.Failure.alreadyImported
        }
        let saved = try await importJournal.capture(operationID: operationID, review: review, choices: choices)
        if let saved {
            try requireCurrentAccount(account)
            return saved
        }
        return try await runImport(operationID, viewingAs: account)
    }

    func recoverImport(operationID: UUID, expectedRevision: Int) async throws -> ImportJournal.Receipt {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        guard let original = try await importJournal.account(for: operationID),
              original.subject == viewer.subject, original.clientID == viewer.clientID else { throw Import.Failure.notFound }
        try requireCurrentAccount(viewer)
        return try await runImport(operationID, viewingAs: viewer)
    }

    func savedImportOperation(_ id: UUID, expectedRevision: Int) async throws -> ImportJournal.SavedOperation? {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        let result = try await importJournal.savedOperation(id, viewingAs: viewer)
        try requireCurrentAccount(viewer)
        return result
    }

    func savedImportOperations(expectedRevision: Int) async throws -> [ImportJournal.SavedOperation] {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        let result = try await importJournal.savedOperations(viewingAs: viewer)
        try requireCurrentAccount(viewer)
        return result
    }

    private func runImport(_ operationID: UUID, viewingAs viewer: Import.Account) async throws -> ImportJournal.Receipt {
        let authority = ImportJournal.Authority(current: { [connection, canUseForeground] captured in
            guard canUseForeground() else { return false }
            return try connection.isCurrentAccount(captured)
        }, observe: { [connection, canUseForeground] review in
            try await connection.observeImport(review, canRead: canUseForeground)
        })
        let receipt = try await importJournal.run(operationID, authority: authority, scheduler: scheduler)
        try requireCurrentAccount(viewer)
        return receipt
    }

    private func requireCurrentAccount(_ account: Import.Account) throws {
        try requireForeground()
        guard try connection.isCurrentAccount(account) else { throw Failure.staleConnection }
    }

    private func reservedEvents(_ account: Import.Account, calendarID: String) async throws -> Set<String> {
        let imported = try await importJournal.reservedEvents(subject: account.subject, calendarID: calendarID)
        return try imported.union(outboundAndLinkedEvents(account, calendarID: calendarID))
    }

    private func outboundAndLinkedEvents(_ account: Import.Account, calendarID: String) throws -> Set<String> {
        let outgoing = try publication?.reservedEvents(viewingAs: account, calendarID: calendarID) ?? []
        let linked = try manualLink?.reservedEvents(viewingAs: account, calendarID: calendarID) ?? []
        return outgoing.union(linked)
    }

    private func requireForeground() throws {
        guard canUseForeground() else { throw Failure.needsAccess }
    }

    #if os(iOS)
    private static var live: RemiloIOSGoogleCalendarRuntime?

    static func reconcileManualLinkPurges() throws {
        guard foregroundWindow() != nil else { return }
        let purged = try RemiloIOSEngine.shared.read().purgedLocalOccurrences ?? []
        guard !purged.isEmpty else { return }
        try RemiloIOSGoogleCalendarManualLinkStore.local().redactPurged(purged)
    }

    /// Missing or mismatched signed-bundle configuration keeps the runtime
    /// unavailable without opening protected storage.
    static func configuredForegroundRuntime() throws -> RemiloIOSGoogleCalendarRuntime? {
        guard let configuration = RemiloIOSGoogleCalendarConfiguration() else { return nil }
        guard foregroundWindow() != nil else { throw Failure.needsAccess }
        try reconcileManualLinkPurges()
        if let live { return live }
        let connection = try Connection(configuration: configuration, store: .local())
        let presenter = RemiloIOSGoogleCalendarWebAuthorization()
        let canUseForeground: @MainActor @Sendable () -> Bool = { Self.foregroundWindow() != nil }
        let imports = try ImportJournal.local()
        let publication = try RemiloIOSGoogleCalendarPublicationRuntime(
            connection: connection, journal: .local(), local: .localEngine(.shared), canUseForeground: canUseForeground
        )
        let manualLink = try RemiloIOSGoogleCalendarManualLinkRuntime(
            connection: connection, publication: publication, imports: imports, store: .local(),
            local: .localEngine(.shared), canUseForeground: canUseForeground
        )
        let runtime = RemiloIOSGoogleCalendarRuntime(
            connection: connection, canUseForeground: canUseForeground,
            importJournal: imports, scheduler: .localEngine(.shared), publication: publication, manualLink: manualLink
        ) {
            subject, purpose in
            try await Self.authorize(presenter: presenter, subject: subject, purpose: purpose)
        }
        live = runtime
        return runtime
    }

    private static func authorize(presenter: RemiloIOSGoogleCalendarWebAuthorization, subject: String?,
                                  purpose: RemiloIOSGoogleCalendarPurpose) async throws -> RemiloIOSGoogleCalendarAccess {
        guard let window = foregroundWindow() else { throw Failure.needsAccess }
        return try await presenter.authorizeFromUserAction(presentingWindow: window, purpose: purpose, expectedSubject: subject)
    }

    private static func foregroundWindow() -> UIWindow? {
        guard UIApplication.shared.isProtectedDataAvailable else { return nil }
        return UIApplication.shared.connectedScenes.lazy.compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }.compactMap(\.keyWindow).first
    }
    #endif
}
