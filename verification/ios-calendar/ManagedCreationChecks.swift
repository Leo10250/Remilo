import Foundation

enum ManagedCreationChecks {
    private typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias Journal = RemiloIOSGoogleCalendarManagedSetupJournal
    private typealias Connection = RemiloIOSGoogleCalendarConnection

    static func run(access: RemiloIOSGoogleCalendarAccess, writeOnly: RemiloIOSGoogleCalendarAccess,
                    now: @escaping @Sendable () -> Date) async throws {
        let account = Writer.Publication.Account(subject: access.account.subject, clientID: access.clientID,
                                                 connectionRevision: 2, accountGeneration: 1)
        let capture = Writer.ManagedCreation(operationID: UUID(uuidString: "00112233-4455-6677-8899-aabbccddeeff")!,
                                             account: account, zoneID: "America/Los_Angeles")
        let fixture = Fixture(capture: capture, status: 201, body: #"{"id":"generated-id@example.test"}"#)
        let writer = Writer(http: HTTP(send: { request, _, _ in try await fixture.send(request) }), now: now)
        do {
            _ = try await writer.createManagedCalendar(capture, access: writeOnly, phase: .notSent) { _ in
                preconditionFailure("An event write grant cannot authorize calendar creation")
            }
            preconditionFailure("Creation must require calendar creation consent")
        } catch Failure.needsAccess {}

        let expired = try await writer.createManagedCalendar(capture, access: access, phase: .notSent,
                                                             budget: .init(duration: .seconds(-1))) { _ in
            preconditionFailure("An expired budget cannot claim the send checkpoint")
        }
        guard case .notSent(.budget) = expired else { preconditionFailure("An expired budget leaves the request unsent") }

        let denied = try await writer.createManagedCalendar(capture, access: access, phase: .notSent) { captured in
            precondition(captured == capture)
            return .denied(.staleConnection)
        }
        guard case .notSent(.staleConnection) = denied else { preconditionFailure("The durable checkpoint may deny a send") }
        let sent = try await writer.createManagedCalendar(capture, access: access, phase: .sent) { _ in
            preconditionFailure("A previously sent request cannot claim the send checkpoint again")
        }
        guard case .unconfirmed(nil) = sent else { preconditionFailure("A previously sent request needs caller recovery") }
        let untouched = await fixture.requests
        precondition(untouched == 0, "Scope, budget, denial and sent checks perform no HTTP")

        let first = try await writer.createManagedCalendar(capture, access: access, phase: .notSent) { captured in
            await fixture.permit(captured)
        }
        guard case .returnedID("generated-id@example.test") = first else {
            preconditionFailure("Return the server-assigned ID directly to the durable caller")
        }
        let duplicateClaim = try await writer.createManagedCalendar(capture, access: access, phase: .notSent) { captured in
            await fixture.permit(captured)
        }
        guard case .unconfirmed(nil) = duplicateClaim else { preconditionFailure("A duplicate checkpoint claim cannot send again") }
        let total = await fixture.requests
        precondition(total == 1, "Transport sends exactly one POST and performs no readback before the ID can be saved")

        try await responseChecks(capture: capture, access: access, now: now)
        try await connectionChecks(operationID: capture.operationID, access: access, now: now)
    }

    private static func responseChecks(capture: Writer.ManagedCreation, access: RemiloIOSGoogleCalendarAccess,
                                       now: @escaping @Sendable () -> Date) async throws {
        let uncertain: [(status: Int, failure: Failure)] = [(503, .retry), (201, .invalidResponse)]
        for (status, failure) in uncertain {
            let fixture = Fixture(capture: capture, status: status, body: #"{"summary":"Remilo"}"#)
            let writer = Writer(http: HTTP(send: { request, _, _ in try await fixture.send(request) }), now: now)
            let result = try await writer.createManagedCalendar(capture, access: access, phase: .notSent) { captured in
                await fixture.permit(captured)
            }
            guard case .unconfirmed(let reason) = result, reason == failure else {
                preconditionFailure("An uncertain provider result requires read-only recovery")
            }
            let retry = try await writer.createManagedCalendar(capture, access: access, phase: .sent) { _ in
                preconditionFailure("An uncertain POST cannot be sent again")
            }
            guard case .unconfirmed(nil) = retry else { preconditionFailure("Defer recovery to the durable caller") }
            let attempts = await fixture.requests
            precondition(attempts == 1, "An ambiguous POST is never retried by transport")
        }

        let rejected = Fixture(capture: capture, status: 400, body: "{}")
        let writer = Writer(http: HTTP(send: { request, _, _ in try await rejected.send(request) }), now: now)
        let result = try await writer.createManagedCalendar(capture, access: access, phase: .notSent) { captured in
            await rejected.permit(captured)
        }
        guard case .rejected(.badRequest) = result else { preconditionFailure("A definite provider rejection is reported separately") }
        let attempts = await rejected.requests
        precondition(attempts == 1)
    }

    @MainActor
    private static func connectionChecks(operationID: UUID, access: RemiloIOSGoogleCalendarAccess,
                                         now: @escaping @Sendable () -> Date) async throws {
        let bundle = "com.remilo.app.fixture"
        let scheme = access.clientID.split(separator: ".").reversed().joined(separator: ".")
        guard let configuration = RemiloIOSGoogleCalendarConfiguration(clientID: access.clientID, registeredBundleID: bundle,
                                                                        bundleID: bundle, urlSchemes: [scheme]) else {
            preconditionFailure("Managed creation fixture requires a valid configuration")
        }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-managed-send-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = ConnectionFixture(access: access)
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let connection = Connection(configuration: configuration, store: .init(directory: directory), http: http, now: now)
        fixture.connection = connection
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in access }
        let account = try connection.account(expectedRevision: connected.revision)
        let capture = Writer.ManagedCreation(operationID: operationID, account: account, zoneID: "UTC")
        let staleScan = try await connection.discoverManagedCalendars(expectedRevision: connected.revision, canRead: { true })
        let scan = try await connection.discoverManagedCalendars(expectedRevision: connected.revision, preparingCreation: operationID, canRead: { true })
        precondition(staleScan.selection.outcome == .create && scan.selection.outcome == .create && staleScan.scanID != scan.scanID)

        try await expectStaleSend(capture, discovery: staleScan, connection: connection)
        let staleAccount = Writer.Publication.Account(subject: "previous-subject", clientID: account.clientID,
                                                      connectionRevision: account.connectionRevision, accountGeneration: account.accountGeneration)
        try await expectStaleSend(.init(operationID: operationID, account: staleAccount, zoneID: "UTC"),
                                  discovery: scan, connection: connection)
        precondition(fixture.requests == ["GET", "GET"], "Stale setup and account captures perform no HTTP")

        let journal = Journal(directory: directory)
        let review = try journal.review(staleScan, account: account, calendarZoneID: "UTC")
        let entry = try journal.capture(operationID: operationID, review: review, currentAccount: account)
        let replay = try journal.capture(operationID: operationID, review: review, currentAccount: account)
        precondition(entry == replay && entry.phase == .captured && entry.creationRequest == capture)
        let otherReview = try Journal(directory: directory.appendingPathComponent("separate-review"))
            .review(staleScan, account: account, calendarZoneID: "America/Los_Angeles")
        do {
            _ = try journal.capture(operationID: operationID, review: otherReview, currentAccount: account)
            preconditionFailure("An operation ID may only replay the exact capture")
        } catch Failure.operationReused {}

        let result = try await connection.sendManagedCreation(capture, discovery: scan, canSend: { true }, permit: { reviewed in
            precondition(reviewed == capture)
            let permit = try journal.beginSend(reviewed, currentAccount: account)
            guard case .granted = permit else { preconditionFailure("Claim the durable send exactly once") }
            fixture.permit(reviewed)
            return permit
        }, rememberReturnedID: { id, reviewed in
            try fixture.remember(id, capture: reviewed)
            try journal.rememberReturnedID(id, for: reviewed)
        })
        guard case .returnedID("generated-id@example.test") = result else {
            preconditionFailure("A sent request keeps the provider ID through same-subject reauthorization")
        }
        precondition(fixture.remembered?.id == "generated-id@example.test" && fixture.remembered?.capture == capture,
                     "Checkpoint the returned ID against the original captured operation")
        precondition(fixture.requests == ["GET", "GET", "POST"], "Creation send performs no ownership readback")
        let refreshedAccount = try connection.account(expectedRevision: connected.revision + 1)
        let reopened = Journal(directory: directory)
        let receipt = try reopened.operation(operationID, viewingAs: refreshedAccount)
        precondition(receipt?.sentRequest == capture && receipt?.returnedCalendarID == "generated-id@example.test" && receipt?.phase == .sent,
                     "The exact returned ID is durable before any provider validation")
        let privateView = try reopened.view(viewingAs: staleAccount)
        precondition(privateView.binding == nil && privateView.pendingOperationID == nil)
        let authorized = try reopened.reauthorize(operationID, from: account, to: refreshedAccount)
        let missing = try await connection.checkManagedCreation(capture, expectedRevision: refreshedAccount.connectionRevision,
                                                                 returnedID: authorized.returnedCalendarID, canRead: { true })
        guard case .unconfirmed = missing else { preconditionFailure("A missing CalendarList entry remains unconfirmed") }
        let afterMissing = try reopened.operation(operationID, viewingAs: refreshedAccount)
        precondition(afterMissing?.returnedCalendarID == receipt?.returnedCalendarID, "Keep the ID after an interrupted check")
        let verified = try await connection.checkManagedCreation(capture, expectedRevision: refreshedAccount.connectionRevision,
                                                                  returnedID: authorized.returnedCalendarID, canRead: { true })
        guard case .verified(let calendar) = verified else { preconditionFailure("Retry the exact original identity") }
        let observation = Journal.Observation(record: calendar, account: refreshedAccount, verifiedEmail: access.account.email)
        let confirmed = try reopened.activate(operationID, observation: observation, currentAccount: refreshedAccount)
        let view = try reopened.view(viewingAs: refreshedAccount)
        precondition(confirmed.phase == .confirmed && view.pendingOperationID == nil && view.binding?.record.id == calendar.id,
                     "Activate the binding and receipt together")
        precondition(fixture.requests == ["GET", "GET", "POST", "GET EXACT", "GET EXACT"], "Recovery never creates a second calendar")

        let replacementScan = try await connection.discoverManagedCalendars(expectedRevision: refreshedAccount.connectionRevision, canRead: { true })
        let replacement = try reopened.review(replacementScan, account: refreshedAccount, calendarZoneID: "UTC", replacing: operationID)
        let replacementID = UUID()
        let replacementEntry = try reopened.capture(operationID: replacementID, review: replacement, currentAccount: refreshedAccount)
        guard let replacementRequest = replacementEntry.creationRequest else { preconditionFailure("Capture a reviewed replacement") }
        let replacementPermit = try reopened.beginSend(replacementRequest, currentAccount: refreshedAccount)
        guard case .granted = replacementPermit else { preconditionFailure("Capture the replacement send checkpoint") }
        try reopened.retire(replacementID, currentAccount: refreshedAccount)
        let retired = try reopened.rememberReturnedID("late-id@example.test", for: replacementRequest)
        precondition(retired.retired && retired.returnedCalendarID == "late-id@example.test", "Late receipts survive retirement")
        do {
            _ = try reopened.activate(replacementID, observation: observation, currentAccount: refreshedAccount)
            preconditionFailure("A retired request cannot change the current binding")
        } catch Failure.staleConnection {}
    }

    @MainActor
    private static func expectStaleSend(_ capture: Writer.ManagedCreation, discovery: Connection.ManagedDiscoveryResult,
                                        connection: Connection) async throws {
        do {
            _ = try await connection.sendManagedCreation(capture, discovery: discovery, canSend: { true }, permit: { _ in
                preconditionFailure("A stale capture cannot claim the send checkpoint")
            }, rememberReturnedID: { _, _ in
                preconditionFailure("A stale capture cannot receive a provider ID")
            })
            preconditionFailure("Creation must reject stale discovery or account evidence")
        } catch Failure.staleConnection {}
    }

    @MainActor
    private final class ConnectionFixture {
        private let access: RemiloIOSGoogleCalendarAccess
        private var permitted: Writer.ManagedCreation?
        private(set) var requests: [String] = []
        private(set) var remembered: (id: String, capture: Writer.ManagedCreation)?
        weak var connection: Connection?

        init(access: RemiloIOSGoogleCalendarAccess) { self.access = access }

        func permit(_ capture: Writer.ManagedCreation) {
            precondition(permitted == nil && requests == ["GET", "GET"])
            permitted = capture
        }

        func send(_ request: URLRequest) async throws -> HTTP.Response {
            if request.httpMethod == "GET", request.url?.path == "/calendar/v3/users/me/calendarList" {
                requests.append("GET")
                return .init(status: 200, body: Data(#"{"items":[]}"#.utf8))
            }
            if request.httpMethod == "GET", request.url?.path == "/calendar/v3/users/me/calendarList/generated-id@example.test", let permitted {
                let firstLookup = !requests.contains("GET EXACT")
                requests.append("GET EXACT")
                if firstLookup { return .init(status: 404, body: Data("{}".utf8)) }
                let fields: [String: String] = ["id": "generated-id@example.test", "summary": "Remilo", "timeZone": "UTC",
                                                "description": RemiloIOSGoogleCalendarManagedDiscovery.marker(permitted.operationID),
                                                "accessRole": "owner", "dataOwner": access.account.email]
                return .init(status: 200, body: try JSONEncoder().encode(fields))
            }
            guard let connection, let permitted, request.httpMethod == "POST", request.url?.path == "/calendar/v3/calendars" else {
                preconditionFailure("Creation requires the captured permit and exact POST, with no ownership lookup")
            }
            precondition(requests == ["GET", "GET"])
            requests.append("POST")
            let account = permitted.account
            let access = self.access
            let refreshed = try await connection.connectFromUserAction(expectedRevision: account.connectionRevision,
                                                                       consent: .reauthorizeCurrentAccount) { subject, purpose in
                precondition(subject == account.subject && purpose == .ownedCalendars)
                return access
            }
            precondition(refreshed.revision == account.connectionRevision + 1 && refreshed.accountGeneration == account.accountGeneration)
            return .init(status: 201, body: Data(#"{"id":"generated-id@example.test"}"#.utf8))
        }

        func remember(_ id: String, capture: Writer.ManagedCreation) throws {
            guard let connection else { preconditionFailure("Missing test connection") }
            let live = try connection.view()
            precondition(live.revision == capture.account.connectionRevision + 1 && capture == permitted && remembered == nil,
                         "Remember the original capture after reauthorization completes")
            remembered = (id, capture)
        }
    }

    private actor Fixture {
        private let capture: Writer.ManagedCreation
        private let response: HTTP.Response
        private var checkpoint = false
        private(set) var requests = 0

        init(capture: Writer.ManagedCreation, status: Int, body: String) {
            self.capture = capture
            response = .init(status: status, body: Data(body.utf8))
        }

        func permit(_ reviewed: Writer.ManagedCreation) -> Writer.Permission {
            precondition(reviewed == capture && requests <= 1, "Checkpoint the exact captured operation before dispatch")
            guard !checkpoint else { return .alreadySent }
            precondition(requests == 0)
            checkpoint = true
            return .granted
        }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            precondition(checkpoint && requests == 0, "Every POST must follow a single durable checkpoint claim")
            requests += 1
            precondition(request.httpMethod == "POST" &&
                         request.url?.absoluteString == "https://www.googleapis.com/calendar/v3/calendars",
                         "Transport owns only the exact creation request")
            precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-bearer")
            precondition(request.value(forHTTPHeaderField: "Content-Type") == "application/json; charset=UTF-8")
            let body = try JSONDecoder().decode([String: String].self, from: request.httpBody ?? Data())
            precondition(body == [
                "summary": "Remilo",
                "description": "Remilo managed calendar v1\nSetup reference: 00112233-4455-6677-8899-aabbccddeeff",
                "timeZone": "America/Los_Angeles",
            ], "Send only the managed name, exact operation marker, and reviewed time zone")
            return response
        }
    }
}
