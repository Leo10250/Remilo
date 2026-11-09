import Foundation

@MainActor
enum ConnectionChecks {
    private typealias Connection = RemiloIOSGoogleCalendarConnection
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    now: @escaping @Sendable () -> Date) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-calendar-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = RemiloIOSGoogleCalendarStore(directory: directory)
        let fixture = Fixture()
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let connection = Connection(configuration: configuration, store: store, http: http, now: now)
        let authorize: Connection.Authorize = { subject, purpose in
            precondition(subject == nil || subject == "subject-A")
            if purpose == .createManagedCalendar { throw Failure.needsAccess }
            return access
        }

        let initial = try connection.view()
        precondition(initial.revision == 0 && initial.available && initial.access == .disconnected)
        try await rejects(.needsAccess) { _ = try await connection.ownedCalendars(expectedRevision: 0) }
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount,
                                                                  authorize: authorize)
        precondition(connected.revision == 1 && connected.accountGeneration == 1 && connected.access == .ownedCalendars)
        try await rejects(.needsAccess) {
            _ = try await connection.connectFromUserAction(expectedRevision: 1, consent: .managedCreation, authorize: authorize)
        }
        let stillConnected = try connection.view()
        precondition(stillConnected.revision == 1 && stillConnected.access == .ownedCalendars)
        let bytes = try String(contentsOf: directory.appendingPathComponent("connection.json"), encoding: .utf8)
        precondition(bytes.contains("subject-A") && !bytes.contains("fixture-bearer") && !bytes.contains("refresh_token"))

        let relaunched = Connection(configuration: configuration, store: store, http: http, now: now)
        let retained = try relaunched.view()
        precondition(retained.connected && retained.access == .needsAccess && retained.revision == 1)
        try await rejects(.needsAccess) { _ = try await relaunched.ownedCalendars(expectedRevision: 1) }

        let first = try await connection.discoverOwnedCalendars(expectedRevision: 1)
        precondition(first.items.count == 10 && !first.complete)
        let checkpoint = try connection.discoveryProgress(expectedRevision: 1)
        precondition(checkpoint?.id == first.id && checkpoint?.items == first.items)
        let completed = try await connection.discoverOwnedCalendars(expectedRevision: 1, resume: first.id)
        precondition(completed.complete && completed.items.count == 12)
        precondition(completed.items.allSatisfy { $0.id.hasPrefix("owned-") })
        let discoveryRequests = await fixture.calendarRequests
        precondition(discoveryRequests == 12)

        let file = directory.appendingPathComponent("connection.json")
        let beforeBrowse = try Data(contentsOf: file)
        let zone = TimeZone(identifier: "America/Los_Angeles")!
        let firstEvents = try await connection.browseEvents(
            expectedRevision: 1, calendarID: "owned-0", from: "2027-03-14", until: "2027-03-15", zone: zone,
            dispositions: [.init(subject: "subject-A", calendarID: "owned-0", eventID: "pending-source"): .hidden]
        )
        precondition(firstEvents.items.map(\.eventId) == ["meeting"] && firstEvents.items[0].unsupportedReason == .meeting)
        precondition(firstEvents.connectionRevision == 1 && firstEvents.calendarName == "Calendar 0")
        let eventCursor = firstEvents.nextCursor!
        try await rejects(.staleCursor) {
            _ = try await connection.browseEvents(expectedRevision: 1, calendarID: "owned-0", from: "2027-03-14",
                                                  until: "2027-03-16", nextCursor: eventCursor, zone: zone)
        }
        let nextEvents = try await connection.browseEvents(expectedRevision: 1, calendarID: "owned-0", from: "2027-03-14",
                                                           until: "2027-03-15", nextCursor: eventCursor, zone: zone)
        precondition(nextEvents.items.first?.fields?.title == "下一页" && nextEvents.nextCursor == nil)
        let afterBrowse = try Data(contentsOf: file)
        precondition(afterBrowse == beforeBrowse)
        let eventRequests = await fixture.eventRequests
        precondition(eventRequests == 2)

        await fixture.holdNextRead()
        let delayedRead = Task { try await connection.ownedCalendars(expectedRevision: 1) }
        await fixture.readGate.waitUntilHeld()
        let disconnect = Task { try await connection.disconnect(operationID: "disconnect", expectedRevision: 1) }
        await fixture.revokeGate.waitUntilHeld()
        let during = try connection.view()
        precondition(!during.connected && during.revision == 2 && during.accountGeneration == 2 && during.revocation == .pending)
        let pendingReplay = try await connection.disconnect(operationID: "disconnect", expectedRevision: 1)
        precondition(pendingReplay.revision == 2 && pendingReplay.revocation == .pending)
        try await rejects(.operationReused) {
            _ = try await connection.disconnect(operationID: "disconnect", expectedRevision: 2)
        }
        try await rejects(.revocationInProgress) {
            _ = try await connection.connectFromUserAction(expectedRevision: 2, consent: .connectOrChangeAccount,
                                                           authorize: authorize)
        }
        await fixture.readGate.release()
        try await rejects(.staleConnection) { _ = try await delayedRead.value }
        await fixture.revokeGate.release()
        let revoked = try await disconnect.value
        precondition(revoked.revocation == .revoked)
        let revocations = await fixture.revocationRequests
        precondition(revocations == 1)
        let replay = try await relaunched.disconnect(operationID: "disconnect", expectedRevision: 1)
        precondition(replay.revision == 2 && replay.revocation == .revoked)

        let consentGate = Gate()
        let delayedConsent = Task {
            try await connection.connectFromUserAction(expectedRevision: 2, consent: .connectOrChangeAccount) { _, _ in
                await consentGate.hold()
                return access
            }
        }
        await consentGate.waitUntilHeld()
        let noLiveGrant = try await connection.disconnect(operationID: "cancel-consent", expectedRevision: 2)
        precondition(noLiveGrant.revision == 3 && noLiveGrant.revocation == .unconfirmed)
        await consentGate.release()
        try await rejects(.staleConnection) { _ = try await delayedConsent.value }
        let final = try connection.view()
        precondition(!final.connected && final.revocation == .unconfirmed && final.revision == 3)

        let future = Data(#"{"schemaVersion":99}"#.utf8)
        try future.write(to: file, options: .atomic)
        do {
            _ = try store.read()
            preconditionFailure("Unknown schema must fail closed")
        } catch RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema {}
        let preserved = try Data(contentsOf: file)
        precondition(preserved == future)
        try await publicationDestinationChecks(configuration: configuration, readAccess: access, now: now)
    }

    private static func publicationDestinationChecks(
        configuration: RemiloIOSGoogleCalendarConfiguration, readAccess: RemiloIOSGoogleCalendarAccess,
        now: @escaping @Sendable () -> Date
    ) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-calendar-destination-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = RemiloIOSGoogleCalendarStore(directory: directory)
        let fixture = PublicationFixture()
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let connection = Connection(configuration: configuration, store: store, http: http, now: now)
        let authorize: Connection.Authorize = { subject, purpose in
            precondition(subject == nil || subject == "subject-A")
            precondition(purpose == .ownedCalendars || purpose == .writeOwnedEvents)
            return readAccess
        }

        try await rejects(.needsAccess) {
            _ = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount, canCommit: { false }) { _, _ in
                preconditionFailure("A closed foreground must not start consent")
            }
        }
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount,
                                                                  authorize: authorize)
        precondition(connected.access == .ownedCalendars && !connected.canWriteOwnedEvents)
        let unselected = try await connection.publicationDestination(expectedRevision: connected.revision)
        precondition(unselected == nil)
        try await rejects(.notOwner) {
            _ = try await connection.selectPublicationDestination(operationID: UUID(), expectedRevision: connected.revision,
                                                                  calendarID: "writer")
        }

        let selectionID = UUID()
        let selection = Task {
            try await connection.selectPublicationDestination(operationID: selectionID, expectedRevision: connected.revision,
                                                               calendarID: "owned")
        }
        let duplicate = try await connection.selectPublicationDestination(operationID: selectionID, expectedRevision: connected.revision,
                                                                           calendarID: "owned")
        let revision = try await selection.value
        precondition(revision == 2 && duplicate == revision)
        try await rejects(.operationReused) {
            _ = try await connection.selectPublicationDestination(operationID: selectionID, expectedRevision: connected.revision,
                                                                  calendarID: "writer")
        }
        try await rejects(.operationReused) {
            _ = try await connection.disconnect(operationID: selectionID.uuidString, expectedRevision: revision)
        }
        let repeated = try await connection.selectPublicationDestination(operationID: UUID(), expectedRevision: revision,
                                                                         calendarID: "owned")
        precondition(repeated == revision)
        let destination = try await connection.publicationDestination(expectedRevision: revision)
        precondition(destination?.calendar.name == "Personal" && destination?.account.subject == "subject-A")
        try await rejects(.needsAccess) {
            _ = try await connection.publicationDestination(expectedRevision: revision, canRead: { false })
        }
        let relaunched = Connection(configuration: configuration, store: store, http: http, now: now)
        let retained = try relaunched.view()
        precondition(retained.revision == revision && retained.publicationDestination?.id == "owned"
                     && retained.access == .needsAccess && !retained.canWriteOwnedEvents)
        await fixture.setOwner(false)
        try await rejects(.notOwner) { _ = try await connection.publicationDestination(expectedRevision: revision) }
        await fixture.setOwner(true)
        try await rejects(.needsAccess) {
            try connection.requirePublicationSend(account: connection.account(expectedRevision: revision), calendarID: "owned")
        }
        try await rejects(.needsAccess) {
            _ = try await connection.connectFromUserAction(expectedRevision: revision, consent: .writeOwnedEvents,
                                                           authorize: authorize)
        }
        let stillReadOnly = try connection.view()
        precondition(stillReadOnly.revision == revision && !stillReadOnly.canWriteOwnedEvents
                     && stillReadOnly.publicationDestination?.id == "owned")

        let authorization = RemiloIOSGoogleCalendarAuthorization(http: http, now: now)
        let writeGrant = try RemiloIOSGoogleCalendarGrant(token: "publication-write", scopes: Connection.Purpose.writeOwnedEvents.required,
                                                          expiresAt: now().addingTimeInterval(3_600))
        let writeAccess = try await authorization.verify(writeGrant, configuration: configuration, expectedSubject: "subject-A",
                                                          purpose: .writeOwnedEvents)
        let upgraded = try await connection.connectFromUserAction(expectedRevision: revision, consent: .writeOwnedEvents) { subject, purpose in
            precondition(subject == "subject-A" && purpose == .writeOwnedEvents)
            return writeAccess
        }
        precondition(upgraded.revision == 3 && upgraded.accountGeneration == connected.accountGeneration
                     && upgraded.access == .ownedCalendars && upgraded.canWriteOwnedEvents && upgraded.publicationDestination?.id == "owned")
        let captured = try connection.account(expectedRevision: upgraded.revision)
        try connection.requirePublicationSend(account: captured, calendarID: "owned")
        try await rejects(.staleConnection) { try connection.requirePublicationSend(account: captured, calendarID: "writer") }
        let refreshed = try await connection.connectFromUserAction(expectedRevision: upgraded.revision, consent: .reauthorizeCurrentAccount,
                                                                   authorize: authorize)
        precondition(refreshed.revision == 4 && !refreshed.canWriteOwnedEvents && refreshed.publicationDestination?.id == "owned")
        try await rejects(.staleConnection) { try connection.requirePublicationSend(account: captured, calendarID: "owned") }
        let canRecover = try await connection.withPublicationAccess(captured: captured, expectedRevision: refreshed.revision) { _, grant in
            grant.supports(.ownedCalendars, now: now()) && !grant.supports(.writeOwnedEvents, now: now())
        }
        precondition(canRecover)

        let otherGrant = try RemiloIOSGoogleCalendarGrant(token: "publication-other", scopes: Connection.Purpose.ownedCalendars.required,
                                                          expiresAt: now().addingTimeInterval(3_600))
        let otherAccess = try await authorization.verify(otherGrant, configuration: configuration, expectedSubject: "subject-B")
        try await rejects(.accountChanged) {
            _ = try await connection.connectFromUserAction(expectedRevision: refreshed.revision, consent: .writeOwnedEvents) { _, _ in otherAccess }
        }
        let switched = try await connection.connectFromUserAction(expectedRevision: refreshed.revision, consent: .connectOrChangeAccount) { _, _ in
            otherAccess
        }
        precondition(switched.revision == 5 && switched.accountGeneration == 2 && switched.email == refreshed.email
                     && switched.publicationDestination == nil)
        try await rejects(.accountChanged) {
            _ = try await connection.withPublicationAccess(captured: captured, expectedRevision: switched.revision) { _, _ in true }
        }
        let newDestination = try await connection.selectPublicationDestination(operationID: UUID(), expectedRevision: switched.revision,
                                                                              calendarID: "owned")
        let disconnected = try await connection.disconnect(operationID: "publication-disconnect", expectedRevision: newDestination)
        precondition(disconnected.revision == 7 && disconnected.revocation == .revoked)
        let replay = try await connection.selectPublicationDestination(operationID: selectionID, expectedRevision: connected.revision,
                                                                       calendarID: "owned")
        let final = try connection.view()
        precondition(replay == revision && !final.connected && final.publicationDestination == nil)
        let bytes = try String(contentsOf: directory.appendingPathComponent("connection.json"), encoding: .utf8)
        precondition(!bytes.contains("publication-write") && !bytes.contains("publication-other"))
    }

    private static func rejects(_ expected: Failure, _ block: () async throws -> Void) async throws {
        do {
            try await block()
            preconditionFailure("Expected \(expected.rawValue)")
        } catch let failure as Failure {
            precondition(failure == expected)
        }
    }

    private actor Gate {
        private var holding: CheckedContinuation<Void, Never>?
        private var observing: CheckedContinuation<Void, Never>?

        func hold() async {
            await withCheckedContinuation { continuation in
                holding = continuation
                observing?.resume()
                observing = nil
            }
        }

        func waitUntilHeld() async {
            if holding != nil { return }
            await withCheckedContinuation { observing = $0 }
        }

        func release() {
            holding?.resume()
            holding = nil
        }
    }

    private actor Fixture {
        let readGate = Gate()
        let revokeGate = Gate()
        private(set) var calendarRequests = 0
        private(set) var eventRequests = 0
        private(set) var revocationRequests = 0
        private var holdRead = false

        func holdNextRead() { holdRead = true }

        func send(_ request: URLRequest) async throws -> HTTP.Response {
            guard let url = request.url else { throw Failure.invalidInput }
            if url.path == "/revoke" {
                revocationRequests += 1
                precondition(url.query == nil && request.httpMethod == "POST")
                precondition(request.httpBody == Data("token=fixture-bearer".utf8))
                await revokeGate.hold()
                return HTTP.Response(status: 200, body: Data())
            }
            if url.path.hasSuffix("/calendarList/owned-0") {
                return HTTP.Response(status: 200, body: Data(#"{"id":"owned-0","accessRole":"owner","summary":"Calendar 0","timeZone":"America/Los_Angeles"}"#.utf8))
            }
            if url.path.hasSuffix("/calendars/owned-0/events") {
                eventRequests += 1
                let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
                precondition(query.contains(URLQueryItem(name: "singleEvents", value: "false")))
                precondition(query.contains(URLQueryItem(name: "timeMin", value: "2027-03-14T08:00:00Z")))
                precondition(query.contains(URLQueryItem(name: "timeMax", value: "2027-03-15T07:00:00Z")))
                if query.contains(URLQueryItem(name: "pageToken", value: "event-page")) {
                    return HTTP.Response(status: 200, body: Data(#"{"items":[{"id":"next","summary":"下一页","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"}}]}"#.utf8))
                }
                return HTTP.Response(status: 200, body: Data(#"{"items":[{"id":"meeting","attendeesOmitted":true},{"id":"pending-source"}],"nextPageToken":"event-page"}"#.utf8))
            }
            calendarRequests += 1
            if holdRead {
                holdRead = false
                await readGate.hold()
            }
            let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "pageToken" }?.value
            let index = token.flatMap(Int.init) ?? 0
            let items = [
                ["id": "owned-\(index)", "accessRole": "owner", "summary": "Calendar \(index)", "timeZone": "UTC"],
                ["id": "writer-\(index)", "accessRole": "writer", "summary": "Shared calendar"],
            ]
            var payload: [String: Any] = ["items": items]
            if index < 11 { payload["nextPageToken"] = String(index + 1) }
            return HTTP.Response(status: 200, body: try JSONSerialization.data(withJSONObject: payload))
        }
    }

    private actor PublicationFixture {
        private var owner = true

        func setOwner(_ value: Bool) { owner = value }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            guard let url = request.url else { throw Failure.invalidInput }
            if url.path == "/revoke" {
                precondition(request.httpMethod == "POST" && request.httpBody == Data("token=publication-other".utf8))
                return .init(status: 200, body: Data())
            }
            precondition(request.httpMethod == "GET")
            if url.path == "/v1/userinfo" {
                let subject = request.value(forHTTPHeaderField: "Authorization") == "Bearer publication-other" ? "subject-B" : "subject-A"
                let user: [String: Any] = ["sub": subject, "email": "owner@example.test", "email_verified": true]
                return .init(status: 200, body: try JSONSerialization.data(withJSONObject: user))
            }
            let id = url.lastPathComponent
            precondition(url.path.hasPrefix("/calendar/v3/users/me/calendarList/") && ["owned", "writer"].contains(id))
            let role = id == "owned" && owner ? "owner" : "writer"
            let calendar = ["id": id, "accessRole": role, "summary": "Personal", "timeZone": "America/Los_Angeles"]
            return .init(status: 200, body: try JSONSerialization.data(withJSONObject: calendar))
        }
    }
}
