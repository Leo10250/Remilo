import Foundation

enum RecurringReviewChecks {
    private typealias Review = RemiloIOSGoogleCalendarRecurringReview
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private static let calendarID = "owned/calendar@example.test"
    private static let masterID = "master+group"
    private static let reference = "2027-03-14T07:00:00Z"

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    now: @escaping @Sendable () -> Date) async throws {
        let good = Fixture(.valid)
        let result = try await inspect(access, now: now, fixture: good)
        let referenceMs = try Event.timestamp(reference)
        let encoded = try JSONEncoder().encode(result)
        let decoded = try JSONDecoder().decode(Review.Inspection.self, from: encoded)
        precondition(result.referenceMs == referenceMs && result.masterETag == "\"master-v1\"" && decoded == result)
        precondition(result.exceptions.map(\.identity.eventID) == ["cancelled", "moved"])
        precondition(result.exceptions[0].identity.cancelled && result.exceptions[0].fields == nil)
        let movedAt = try Event.timestamp("2027-03-20T07:00:00Z")
        precondition(result.exceptions[1].identity.nominalSlot == "2027-03-15T00:00")
        precondition(result.exceptions[1].fields?.schedule.eventStartMs == movedAt && result.exceptions[1].fields?.notes == "  moved notes\n")
        precondition(result.ordinarySlots.map(\.nominalSlot) == ["2027-03-16T00:00", "2027-03-17T00:00", "2027-03-18T00:00"])
        let originals = await good.originalStarts
        let fences = await good.fences
        precondition(originals == ["2027-03-16", "2027-03-17", "2027-03-18"] && fences == 9)
        let morning = try await inspect(access, now: now, fixture: Fixture(.valid), cutoff: "2027-03-14T15:00:00Z",
                                        alertPolicy: .init(enabled: true, offsetMs: nil))
        precondition(morning.exceptions.first?.identity.eventID == "cancelled")

        let stale = Fixture(.staleMaster)
        do {
            _ = try await inspect(access, now: now, fixture: stale)
            preconditionFailure("A changed master cannot produce inspection evidence")
        } catch RemiloIOSGoogleCalendarImport.Failure.staleRemote {}
        let staleOriginals = await stale.originalStarts
        precondition(staleOriginals.isEmpty)

        do {
            _ = try await inspect(access, now: now, fixture: Fixture(.mismatchedSlot))
            preconditionFailure("A nonmatching ordinary instance cannot produce inspection evidence")
        } catch Review.Failure.mismatch {}

        for scenario in [Fixture.Scenario.changedChild, .newChild, .deletedChild, .expiredCheckpoint] {
            let fixture = Fixture(scenario)
            do {
                _ = try await inspect(access, now: now, fixture: fixture)
                preconditionFailure("Changed or uncheckable exception evidence cannot pass with an unchanged master")
            } catch RemiloIOSGoogleCalendarImport.Failure.staleRemote {}
            let masterLookups = await fixture.masterLookups
            let deltaReads = await fixture.deltaReads
            precondition(masterLookups == 2 && deltaReads == (scenario == .expiredCheckpoint ? 1 : 2))
        }

        let lost = Fixture(.lostOwnership)
        do {
            _ = try await inspect(access, now: now, fixture: lost)
            preconditionFailure("Lost ownership cannot produce inspection evidence")
        } catch Review.Transport.Failure.notOwner {}
        let lostDeltaReads = await lost.deltaReads
        precondition(lostDeltaReads == 0)

        let long = Fixture(.deltaPageLimit)
        do {
            _ = try await inspect(access, now: now, fixture: long)
            preconditionFailure("A delta that exceeds the page limit cannot produce inspection evidence")
        } catch Review.Failure.reviewLimit {}
        let longDeltaReads = await long.deltaReads
        precondition(longDeltaReads == 10)
        try await nativeReadback(configuration, referenceMs: referenceMs)
    }

    @MainActor
    private static func nativeReadback(_ configuration: RemiloIOSGoogleCalendarConfiguration, referenceMs: Int64) async throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-recurring-review-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let fixture = Fixture(.valid)
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let date = Date(timeIntervalSince1970: Double(referenceMs) / 1_000)
        let now: @Sendable () -> Date = { date }
        let grant = try RemiloIOSGoogleCalendarGrant(token: "recurrence-test-grant", scopes: RemiloIOSGoogleCalendarPurpose.ownedCalendars.required,
                                                      expiresAt: date.addingTimeInterval(3_600))
        let access = try await RemiloIOSGoogleCalendarAuthorization(http: http, now: now)
            .verify(grant, configuration: configuration, expectedSubject: "recurrence-owner")
        let connection = RemiloIOSGoogleCalendarConnection(configuration: configuration, store: .init(directory: path), http: http, now: now)
        let view = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in access }
        let review = try await connection.prepareImport(expectedRevision: view.revision, calendarID: calendarID, eventID: masterID,
                                                         recurringChoices: .init(mode: .none), canRead: { true })
        precondition(review.recurrenceEvidence?.referenceMs == referenceMs && review.recurrenceEvidence?.exceptions.count == 2)
        let matching = try await connection.observeImport(review, canRead: { true })
        precondition(review.matches(matching))
        await fixture.editStoredChild()
        let changed = try await connection.observeImport(review, canRead: { true })
        precondition(changed.source == review.source && !review.matches(changed))
    }

    private static func inspect(_ access: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date,
                                fixture: Fixture, cutoff: String = reference,
                                alertPolicy: Review.AlertPolicy = .eventsOnly) async throws -> Review.Inspection {
        let transport = Review.Transport(http: HTTP(send: { request, _, _ in try await fixture.send(request) }), now: now)
        let budget = HTTP.Budget()
        let calendar = try await transport.ownedCalendar(access, id: calendarID, budget: budget)
        let lookup = try await transport.lookup(access, calendarID: calendarID, eventID: masterID, budget: budget)
        guard case .found(let master) = lookup else { preconditionFailure("Fixture master missing") }
        return try await Review.inspect(access: access, calendar: calendar, master: master,
                                        now: Event.timestamp(cutoff), alertPolicy: alertPolicy, transport: transport, budget: budget) {
            await fixture.checkFence()
        }
    }

    private actor Fixture {
        enum Scenario: Equatable {
            case valid, staleMaster, mismatchedSlot, changedChild, newChild, deletedChild
            case expiredCheckpoint, lostOwnership, deltaPageLimit
        }
        let scenario: Scenario
        private(set) var originalStarts: [String] = []
        private(set) var fences = 0
        private(set) var masterLookups = 0
        private(set) var deltaReads = 0
        private var ownerLookups = 0
        private var childETag = "\"exception\""

        init(_ scenario: Scenario) { self.scenario = scenario }
        func checkFence() { fences += 1 }
        func editStoredChild() { childETag = "\"new-child-version\"" }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            let url = request.url!
            if url.host == "openidconnect.googleapis.com" {
                precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer recurrence-test-grant")
                return try reply(["sub": "recurrence-owner", "email": "owner@example.test", "email_verified": true])
            }
            let parts = URLComponents(url: url, resolvingAgainstBaseURL: false)!
            let query = Dictionary(uniqueKeysWithValues: (parts.queryItems ?? []).map { ($0.name, $0.value ?? "") })
            precondition(request.httpMethod == "GET" && parts.percentEncodedPath.contains("owned%2Fcalendar%40example.test"))
            if parts.percentEncodedPath.contains("/calendarList/") {
                ownerLookups += 1
                let role = scenario == .lostOwnership && ownerLookups > 1 ? "reader" : "owner"
                return try reply(["id": calendarID, "accessRole": role, "timeZone": "America/Los_Angeles"])
            }
            if parts.percentEncodedPath.hasSuffix("/instances") {
                precondition(parts.percentEncodedPath.contains("master%2Bgroup"))
                precondition(query["showDeleted"] == "true" && query["maxResults"] == "100")
                let start = query["originalStart"]!
                originalStarts.append(start)
                let day = Int(start.suffix(2))!
                let actualDay = scenario == .mismatchedSlot ? day + 1 : day
                return try reply(["items": [[
                    "id": "ordinary-\(day)", "recurringEventId": masterID, "summary": "Read",
                    "originalStartTime": ["date": start], "start": ["date": "2027-03-\(actualDay)"], "end": ["date": "2027-03-\(actualDay + 1)"],
                ]]])
            }
            if parts.percentEncodedPath.hasSuffix("/events") {
                precondition(query["singleEvents"] == "false" && query["showDeleted"] == "true" && query["maxResults"] == "100")
                if let token = query["syncToken"] {
                    precondition(token == "complete+/=" && url.absoluteString.contains("syncToken=complete%2B%2F%3D"))
                    return try delta(page: query["pageToken"])
                }
                if query["pageToken"] == nil {
                    return try reply(["items": [["id": "unrelated", "recurringEventId": "other"]], "nextPageToken": "next+/="])
                }
                precondition(query["pageToken"] == "next+/=" && url.absoluteString.contains("next%2B%2F%3D"))
                return try reply(["items": [
                    master(etag: scenario == .staleMaster ? "\"changed\"" : "\"master-v1\""),
                    ["id": "past", "recurringEventId": masterID, "originalStartTime": ["date": "2027-03-13"],
                     "start": ["date": "2027-03-13"], "summary": String(repeating: "x", count: 201)],
                    ["id": "cancelled", "recurringEventId": masterID, "status": "cancelled", "originalStartTime": ["date": "2027-03-14"]],
                    ["id": "moved", "recurringEventId": masterID, "etag": childETag, "summary": "Moved", "description": "  moved notes\n",
                     "originalStartTime": ["date": "2027-03-15"], "start": ["date": "2027-03-20"], "end": ["date": "2027-03-21"]],
                ], "nextSyncToken": "complete+/="])
            }
            precondition(parts.percentEncodedPath.hasSuffix("/master%2Bgroup"))
            masterLookups += 1
            return try reply(master(etag: "\"master-v1\""))
        }

        private func delta(page: String?) throws -> HTTP.Response {
            deltaReads += 1
            precondition(ownerLookups == masterLookups && ownerLookups >= 2 && ownerLookups.isMultiple(of: 2))
            if scenario == .expiredCheckpoint { return .init(status: 410, body: Data()) }
            if scenario == .deltaPageLimit {
                return try reply(["nextPageToken": "delta-\(deltaReads)"])
            }
            guard let page else {
                return try reply(["items": [["id": "unrelated", "recurringEventId": "other"]], "nextPageToken": "delta+/="])
            }
            precondition(page == "delta+/=")
            let items: [[String: Any]]
            switch scenario {
            case .changedChild:
                items = [["id": "moved", "recurringEventId": masterID, "etag": "\"exception-v2\"", "summary": "Moved again",
                          "originalStartTime": ["date": "2027-03-15"], "start": ["date": "2027-03-21"], "end": ["date": "2027-03-22"]]]
            case .newChild:
                items = [["id": "newly-cancelled", "recurringEventId": masterID, "status": "cancelled",
                          "originalStartTime": ["date": "2027-03-19"]]]
            case .deletedChild:
                items = [["id": "moved", "status": "cancelled"]]
            default:
                items = [["id": "unrelated-tombstone", "status": "cancelled"]]
            }
            return try reply(["items": items, "nextSyncToken": "delta-complete"])
        }

        private func master(etag: String) -> [String: Any] {
            ["id": masterID, "etag": etag, "summary": "Read", "start": ["date": "2027-03-13"], "end": ["date": "2027-03-14"],
             "recurrence": ["RRULE:FREQ=DAILY;COUNT=7"]]
        }

        private func reply(_ object: [String: Any]) throws -> HTTP.Response {
            .init(status: 200, body: try JSONSerialization.data(withJSONObject: object))
        }
    }
}
