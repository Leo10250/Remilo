import Foundation

enum PublicationChecks {
    private typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    private typealias Publication = RemiloIOSGoogleCalendarPublication
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private static let calendar = "owned/id@example.test"
    private static let zone = "America/Los_Angeles"

    static func run(access: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date) async throws {
        let request = try makeRequest(access)
        precondition(request.eventID == "93ef9c833ce630dbb744728da6abc718")
        let replay = try JSONDecoder().decode(Publication.Request.self, from: JSONEncoder().encode(request))
        let firstFingerprint = try request.fingerprint()
        let replayFingerprint = try replay.fingerprint()
        precondition(replay == request && replayFingerprint == firstFingerprint)
        let anotherOperation = try makeRequest(access)
        precondition(anotherOperation.operationID != request.operationID && anotherOperation.eventID == request.eventID)

        let noPermit = Fixture(.missing, request: request)
        let denied = try await writer(noPermit, now).publish(request, access: access, phase: .notSent) { _ in .denied(.needsAccess) }
        guard case .notSent(.needsAccess) = denied else { preconditionFailure("No owner permission must mean no POST") }
        let deniedWrites = await noPermit.writes
        precondition(deniedWrites == 0)

        let duplicate = Fixture(.duplicate, request: request)
        let duplicateResult = try await writer(duplicate, now).publish(request, access: access, phase: .notSent) { captured in
            precondition(captured == request)
            return await duplicate.permit()
        }
        guard case .confirmed(let duplicateConfirmation) = duplicateResult else { preconditionFailure("Read back the same ID after 409") }
        precondition(duplicateConfirmation.eventID == request.eventID && !duplicateConfirmation.remoteDiffers)
        let duplicateWrites = await duplicate.writes
        precondition(duplicateWrites == 1)

        let committed = Fixture(.uncertainButCreated, request: request)
        let confirmed = try await writer(committed, now).publish(request, access: access, phase: .notSent) { _ in await committed.permit() }
        guard case .confirmed(let recovered) = confirmed else { preconditionFailure("Read back accepted event after uncertain POST") }
        precondition(recovered.eventID == request.eventID)

        let uncertain = Fixture(.missing, request: request)
        let uncertainWriter = writer(uncertain, now)
        let first = try await uncertainWriter.publish(request, access: access, phase: .notSent) { _ in await uncertain.permit() }
        guard case .unconfirmed = first else { preconditionFailure("An ambiguous POST with no exact readback stays unconfirmed") }
        let afterRestart = try await uncertainWriter.publish(request, access: access, phase: .sent) { _ in
            preconditionFailure("A sent retry cannot ask to POST")
        }
        guard case .unconfirmed = afterRestart else { preconditionFailure("A sent retry remains read-only") }
        let uncertainWrites = await uncertain.writes
        precondition(uncertainWrites == 1)

        let concurrent = Fixture(.uncertainButCreated, request: request)
        let concurrentWriter = writer(concurrent, now)
        async let firstAttempt = concurrentWriter.publish(request, access: access, phase: .notSent) { _ in await concurrent.permit() }
        async let secondAttempt = concurrentWriter.publish(request, access: access, phase: .notSent) { _ in await concurrent.permit() }
        _ = try await (firstAttempt, secondAttempt)
        let concurrentWrites = await concurrent.writes
        precondition(concurrentWrites == 1)

        let edited = Fixture(.existingEdited, request: request)
        let editedResult = try await writer(edited, now).publish(request, access: access, phase: .notSent) { _ in
            preconditionFailure("A recognized manual event is never overwritten")
        }
        guard case .confirmed(let editedConfirmation) = editedResult else { preconditionFailure("Recognize the edited manual copy") }
        precondition(editedConfirmation.remoteDiffers && editedConfirmation.htmlLink == nil)
        let foreign = Fixture(.foreign, request: request)
        let conflict = try await writer(foreign, now).publish(request, access: access, phase: .notSent) { _ in
            preconditionFailure("Foreign remote identity cannot authorize a write")
        }
        guard case .conflict(.foreignIdentity) = conflict else { preconditionFailure("Foreign marker must conflict") }
        let removed = Fixture(.removed, request: request)
        let removedResult = try await writer(removed, now).publish(request, access: access, phase: .notSent) { _ in
            preconditionFailure("A cancelled remote resource cannot be recreated")
        }
        guard case .conflict(.removed) = removedResult else { preconditionFailure("An explicit cancellation is a conflict") }

        try await patchChecks(request: request, access: access, now: now)
        let allDay = try Event.fields(["start": ["date": "2027-03-14"], "end": ["date": "2027-03-15"]], calendarZone: zone)
        let bounds = try Publication.Bounds(allDay.fields.schedule)
        precondition(bounds.start.date == "2027-03-14" && bounds.end.date == "2027-03-15" && bounds.end.dateTime == nil)
    }

    private static func patchChecks(request: Publication.Request, access: RemiloIOSGoogleCalendarAccess,
                                    now: @escaping @Sendable () -> Date) async throws {
        let original = try Fixture.remote(request: request, edited: false)
        let desired = Event.Fields(title: request.fields.title, notes: "只改备注", schedule: request.fields.schedule)
        let patch = try Writer.Patch(operationID: UUID(), account: request.account, local: request.local, calendarID: calendar,
                                     reviewedRemote: original, calendarZone: zone, desired: desired)
        let stale = Fixture(.stalePatch, request: request)
        let staleResult = try await writer(stale, now).patch(patch, access: access, phase: .notSent) { _ in await stale.permit() }
        guard case .staleRemote = staleResult else { preconditionFailure("HTTP 412 must require fresh comparison") }
        let staleWrites = await stale.writes
        precondition(staleWrites == 1)
        let delayed = Fixture(.uncertainPatch, request: request)
        let delayedWriter = writer(delayed, now)
        let patched = try await delayedWriter.patch(patch, access: access, phase: .notSent) { _ in await delayed.permit() }
        guard case .confirmed = patched else { preconditionFailure("A matching sparse patch must reconcile read-only") }
        let patchedRetry = try await delayedWriter.patch(patch, access: access, phase: .sent) { _ in
            preconditionFailure("A sent patch retry cannot request a second PATCH")
        }
        guard case .confirmed = patchedRetry else { preconditionFailure("Retain the matching readback") }
        let delayedWrites = await delayed.writes
        precondition(delayedWrites == 1)
    }

    private static func makeRequest(_ access: RemiloIOSGoogleCalendarAccess) throws -> Publication.Request {
        let account = Publication.Account(subject: access.account.subject, clientID: access.clientID,
                                          connectionRevision: 1, accountGeneration: 1)
        let start = try Event.timestamp("2027-03-15T09:00:00.123-07:00")
        let end = try Event.timestamp("2027-03-15T09:30:00.456-07:00")
        let fields = Event.Fields(title: "读书", notes: "  原始备注\n另起一行", schedule: Event.Schedule(
            eventStartMs: start, eventEndMs: end, allDay: false, zoneId: zone, recurrence: nil
        ))
        return try Publication.Request(operationID: UUID(), account: account,
                                       local: Publication.Local(occurrenceID: "local-123", revision: 2, generation: 3),
                                       calendarID: calendar, reviewed: fields, source: .localOneOff)
    }

    private static func writer(_ fixture: Fixture, _ now: @escaping @Sendable () -> Date) -> Writer {
        Writer(http: HTTP(send: { request, _, _ in try await fixture.send(request) }), now: now)
    }

    private actor Fixture {
        enum Scenario: Equatable { case duplicate, uncertainButCreated, missing, existingEdited, foreign, removed, stalePatch, uncertainPatch }
        private let scenario: Scenario
        private let request: Publication.Request
        private var sent = false
        private var result: Data?
        private(set) var writes = 0

        init(_ scenario: Scenario, request: Publication.Request) {
            self.scenario = scenario
            self.request = request
        }

        func permit() -> Writer.Permission {
            if sent { return .alreadySent }
            sent = true
            return .granted
        }

        func send(_ wire: URLRequest) throws -> HTTP.Response {
            let url = wire.url!
            precondition(url.absoluteString.contains("owned%2Fid%40example.test"))
            if url.path.contains("/calendarList/") {
                return HTTP.Response(status: 200, body: Data(#"{"id":"owned/id@example.test","accessRole":"owner","timeZone":"America/Los_Angeles"}"#.utf8))
            }
            if wire.httpMethod == nil || wire.httpMethod == "GET" {
                precondition(url.path.hasSuffix(request.eventID))
                if let result { return HTTP.Response(status: 200, body: result) }
                switch scenario {
                case .existingEdited, .foreign, .stalePatch, .uncertainPatch:
                    let remote = try Self.remote(request: request, edited: scenario == .existingEdited, foreign: scenario == .foreign)
                    return HTTP.Response(status: 200, body: remote.json)
                case .removed:
                    let cancelled = ["id": request.eventID, "status": "cancelled"]
                    return HTTP.Response(status: 200, body: try JSONSerialization.data(withJSONObject: cancelled))
                default: return HTTP.Response(status: 404, body: Data())
                }
            }
            precondition(sent && writes == 0 && url.query == "sendUpdates=none")
            precondition(wire.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-bearer")
            writes += 1
            let body = try JSONSerialization.jsonObject(with: wire.httpBody!) as! [String: Any]
            if wire.httpMethod == "PATCH" {
                precondition(wire.value(forHTTPHeaderField: "If-Match") == #""before""#)
                precondition(Set(body.keys) == Set(["description"]) && body["description"] as? String == "只改备注")
                if scenario == .stalePatch { return HTTP.Response(status: 412, body: Data()) }
                let previous = try Self.remote(request: request, edited: false)
                var updated = try JSONSerialization.jsonObject(with: previous.json) as! [String: Any]
                updated["description"] = body["description"]
                updated["etag"] = #""after""#
                result = try JSONSerialization.data(withJSONObject: updated)
                return HTTP.Response(status: 503, body: Data())
            }
            precondition(wire.httpMethod == "POST" && wire.value(forHTTPHeaderField: "If-Match") == nil)
            precondition(body["id"] as? String == request.eventID && body["attendees"] == nil)
            precondition(body["visibility"] as? String == "private" && body["transparency"] as? String == "opaque")
            precondition((body["start"] as? [String: String])?["dateTime"] == "2027-03-15T16:00:00.123Z")
            precondition((body["start"] as? [String: String])?["timeZone"] == PublicationChecks.zone)
            let reminders = body["reminders"] as! [String: Any]
            precondition(reminders["useDefault"] as? Bool == false && (reminders["overrides"] as? [Any])?.isEmpty == true)
            if scenario != .missing { result = try JSONSerialization.data(withJSONObject: body) }
            return HTTP.Response(status: scenario == .duplicate ? 409 : 503, body: Data())
        }

        nonisolated static func remote(request: Publication.Request, edited: Bool, foreign: Bool = false) throws -> Writer.Transport.Event {
            let payload: [String: Any] = [
                "id": request.eventID, "etag": #""before""#, "summary": edited ? "Google edited the title" : request.fields.title,
                "description": request.fields.notes, "location": "A field Remilo must preserve",
                "start": ["dateTime": "2027-03-15T16:00:00.123Z", "timeZone": PublicationChecks.zone],
                "end": ["dateTime": "2027-03-15T16:30:00.456Z", "timeZone": PublicationChecks.zone],
                "extendedProperties": ["private": ["remiloPublication": foreign ? "other" : request.eventID]],
                "htmlLink": "https://calendar.google.com@foreign.example.test/",
            ]
            return Writer.Transport.Event(id: request.eventID, etag: #""before""#, cancelled: false,
                                          json: try JSONSerialization.data(withJSONObject: payload))
        }
    }
}
