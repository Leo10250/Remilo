import Foundation

enum ManagedCreationChecks {
    private typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private typealias Failure = RemiloIOSGoogleCalendarFailure

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
