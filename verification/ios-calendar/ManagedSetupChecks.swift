import Foundation

@MainActor
enum ManagedSetupChecks {
    private typealias Setup = RemiloIOSGoogleCalendarManagedSetup
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, readOnly: RemiloIOSGoogleCalendarAccess,
                    creation: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date) async throws {
        try await check(configuration: configuration, readOnly: readOnly, creation: creation, now: now, appearingCandidate: true)
        try await check(configuration: configuration, readOnly: readOnly, creation: creation, now: now, appearingCandidate: false)
    }

    private static func check(configuration: RemiloIOSGoogleCalendarConfiguration, readOnly: RemiloIOSGoogleCalendarAccess,
                              creation: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date,
                              appearingCandidate: Bool) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-managed-flow-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = Fixture(email: readOnly.account.email, creation: creation)
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let connection = Setup.Connection(configuration: configuration, store: .init(directory: directory), http: http, now: now)
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in readOnly }
        let journal = Setup.Journal(directory: directory)
        let setup = Setup(connection: connection, journal: journal, canUseForeground: { true }) { subject, purpose in
            try await fixture.consent(subject, purpose)
        }
        let proposal = try await setup.preview(expectedRevision: connected.revision, zoneID: "UTC")
        guard let review = proposal.review, review.target == .create(zoneID: "UTC") else {
            preconditionFailure("Complete read-only discovery must precede a proposed creation")
        }
        let id = UUID()
        let capture = try setup.capture(id, reviewID: review.id, expectedRevision: connected.revision)
        let replay = try setup.capture(id, reviewID: review.id, expectedRevision: connected.revision)
        precondition(capture == replay && fixture.posts == 0 && fixture.consents.isEmpty)
        do {
            _ = try await setup.advance(id, expectedRevision: connected.revision)
            preconditionFailure("A native retry must never request consent or send without a grant")
        } catch Failure.needsAccess {}
        precondition(fixture.posts == 0 && fixture.consents.isEmpty)
        let authorized = try await setup.authorizeFromUserAction(id, expectedRevision: connected.revision)
        let revision = authorized.account.connectionRevision
        precondition(fixture.posts == 0 && fixture.consents == [.createManagedCalendar])

        if appearingCandidate {
            fixture.reveal(name: "Remilo", marker: nil)
            do {
                _ = try await setup.advance(id, expectedRevision: revision)
                preconditionFailure("A newly appeared calendar requires another review")
            } catch Setup.Journal.Rejection.selectionRequired {}
            precondition(fixture.posts == 0, "Recheck discovery after consent before claiming a send")
            let replacement = try await setup.preview(expectedRevision: revision, zoneID: "UTC", replacement: true)
            guard let review = replacement.review, review.target == .select(calendarID: Fixture.calendarID) else {
                preconditionFailure("Review the available calendar before adoption")
            }
            let selected = UUID()
            _ = try setup.capture(selected, reviewID: review.id, expectedRevision: revision)
            let result = try await setup.advance(selected, expectedRevision: revision)
            guard case .finished(let entry) = result, entry.phase == .confirmed else { preconditionFailure("Adopt the exact reviewed calendar") }
            let saved = try setup.view(expectedRevision: revision)
            let old = try setup.operation(id, expectedRevision: revision)
            precondition(saved.binding?.record.id == Fixture.calendarID && old?.retired == true && fixture.posts == 0)
            return
        }

        let first = try await setup.advance(id, expectedRevision: revision)
        guard case .pending(let entry) = first, entry.phase == .sent, entry.returnedCalendarID == nil else {
            preconditionFailure("An uncertain creation remains sent and unconfirmed")
        }
        precondition(fixture.posts == 1)
        fixture.reveal(name: "Renamed after creation", marker: Setup.Journal.Discovery.marker(id))
        let reopened = Setup(connection: connection, journal: .init(directory: directory), canUseForeground: { true }) { _, _ in
            preconditionFailure("A sent operation with current read access must recover without consent")
        }
        let observed = try await reopened.inspectCreation(id, expectedRevision: revision)
        guard case .verified(let observedCalendar) = observed, observedCalendar.id == Fixture.calendarID else {
            preconditionFailure("Inspect the exact marker without enabling a binding")
        }
        let beforeActivation = try reopened.view(expectedRevision: revision)
        precondition(beforeActivation.binding == nil && beforeActivation.pendingOperationID == id && fixture.posts == 1)
        let second = try await reopened.advance(id, expectedRevision: revision)
        guard case .finished(let confirmed) = second, confirmed.phase == .confirmed else {
            preconditionFailure("Recover the original operation through its unique marker")
        }
        let state = try reopened.view(expectedRevision: revision)
        precondition(state.binding?.record.name == "Renamed after creation" && state.pendingOperationID == nil && fixture.posts == 1)
    }

    @MainActor
    private final class Fixture {
        static let calendarID = "managed@example.test"
        let email: String
        let creation: RemiloIOSGoogleCalendarAccess
        private var name: String?
        private var marker: String?
        private(set) var posts = 0
        private(set) var consents: [RemiloIOSGoogleCalendarPurpose] = []

        init(email: String, creation: RemiloIOSGoogleCalendarAccess) {
            self.email = email
            self.creation = creation
        }

        func consent(_ subject: String?, _ purpose: RemiloIOSGoogleCalendarPurpose) throws -> RemiloIOSGoogleCalendarAccess {
            precondition(subject == creation.account.subject && purpose == .createManagedCalendar)
            consents.append(purpose)
            return creation
        }

        func reveal(name: String, marker: String?) {
            self.name = name
            self.marker = marker
        }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            guard let url = request.url else { throw Failure.invalidInput }
            if request.httpMethod == "POST", url.path == "/calendar/v3/calendars" {
                posts += 1
                precondition(posts == 1 && name == nil, "A lost response or new candidate must not create a duplicate")
                return .init(status: 503, body: Data("{}".utf8))
            }
            precondition(request.httpMethod == "GET")
            let record = name.map { name -> [String: String] in
                var value = ["id": Self.calendarID, "summary": name, "dataOwner": email, "accessRole": "owner", "timeZone": "UTC"]
                value["description"] = marker
                return value
            }
            if url.path == "/calendar/v3/users/me/calendarList" {
                return .init(status: 200, body: try JSONEncoder().encode(["items": record.map { [$0] } ?? []]))
            }
            precondition(url.lastPathComponent == Self.calendarID)
            guard let record else { return .init(status: 404, body: Data("{}".utf8)) }
            return .init(status: 200, body: try JSONEncoder().encode(record))
        }
    }
}
