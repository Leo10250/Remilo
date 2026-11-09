import Foundation

@MainActor
enum RuntimeChecks {
    private typealias Runtime = RemiloIOSGoogleCalendarRuntime
    private typealias Connection = Runtime.Connection
    private typealias Failure = Runtime.Failure
    private typealias ImportFailure = Connection.Import.Failure
    private typealias Import = Runtime.Import
    private typealias Journal = Runtime.ImportJournal
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    now: Date) async throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-calendar-runtime-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let clock = Clock(now)
        let foreground = Foreground()
        let fixture = Fixture()
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let connection = Connection(configuration: configuration, store: .init(directory: path), http: http, now: { clock.now() })
        let otherGrant = try RemiloIOSGoogleCalendarGrant(token: "fixture-other-bearer", scopes: RemiloIOSGoogleCalendarPurpose.ownedCalendars.required,
                                                          expiresAt: now.addingTimeInterval(60))
        let otherAccount = try await RemiloIOSGoogleCalendarAuthorization(http: http, now: { clock.now() }).verify(
            otherGrant, configuration: configuration, expectedSubject: "subject-B"
        )
        let accounts = Accounts(original: access, other: otherAccount)
        let local = LocalImports()
        let scheduler = Journal.Scheduler(receipt: { await local.receipts[$0.id] }, create: { try await local.create($0, permit: $1) })
        let authorize: Connection.Authorize = { subject, purpose in
            try await accounts.authorize(expectedSubject: subject, purpose: purpose)
        }
        func newRuntime() -> Runtime {
            let journal = Journal(directory: path, now: { Int64((clock.now().timeIntervalSince1970 * 1_000).rounded()) })
            return Runtime(connection: connection, canUseForeground: { foreground.active },
                           importJournal: journal, scheduler: scheduler, authorize: authorize)
        }
        let runtime = newRuntime()
        let choices = Import.Choices(mode: .none, automaticSync: false)

        foreground.active = false
        try await rejects(.needsAccess) { _ = try await runtime.view() }
        try await rejects(.needsAccess) { _ = try await runtime.authorizeFromUserAction(expectedRevision: 0, intent: .connectOrChangeAccount) }
        let closedRequests = await accounts.requests
        precondition(closedRequests.isEmpty)
        foreground.active = true
        let connected = try await runtime.authorizeFromUserAction(expectedRevision: 0, intent: .connectOrChangeAccount)
        precondition(connected.revision == 1 && connected.accountGeneration == 1)
        let calendars = try await runtime.ownedCalendars(expectedRevision: connected.revision)
        precondition(calendars.items.map(\.id) == ["owned"] && calendars.connectionRevision == connected.revision)
        let first = try await page(runtime, revision: connected.revision)
        precondition(first.items.map(\.eventId) == ["ordinary", "family"] && first.items[0].fields?.title == "提醒")
        precondition(first.items[1].fields?.schedule.recurrence == ["RRULE:FREQ=DAILY;INTERVAL=1;WKST=MO;COUNT=3"])
        precondition(first.items[1].unsupportedReason == nil)
        let cursor = first.nextCursor!
        let next = try await page(runtime, revision: connected.revision, cursor: cursor)
        precondition(next.items.map(\.eventId) == ["next"] && next.nextCursor == nil)
        try await rejects(.notOwner) { _ = try await page(runtime, revision: connected.revision, calendarID: "writer") }
        try await rejects(.invalidRange) {
            _ = try await runtime.browseEvents(expectedRevision: connected.revision, calendarID: "owned",
                                               from: "2027-03-15", until: "2028-03-16")
        }
        let reviewed = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                       eventID: "ordinary", choices: choices)
        precondition(reviewed.account.subject == "subject-A" && reviewed.account.accountGeneration == connected.accountGeneration)
        precondition(reviewed.account.connectionRevision == connected.revision && reviewed.source.key.calendarID == "owned")
        precondition(reviewed.source.etag == "\"exact\"" && reviewed.source.fields.title == "更新后的标题")
        precondition(reviewed.source.fields.notes == "  Original notes\n" && reviewed.googleReminders == .disabled)
        try await rejects(.notOwner) {
            _ = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "writer",
                                                eventID: "ordinary", choices: choices)
        }
        let rejectedEvents: [(String, ImportFailure)] = [
            ("weak", .staleRemote), ("missing", .staleRemote), ("removed", .staleRemote),
        ]
        for (eventID, expected) in rejectedEvents {
            do {
                _ = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                    eventID: eventID, choices: choices)
                preconditionFailure("Expected a reviewed import rejection")
            } catch let error as ImportFailure { precondition(error == expected) }
        }

        await fixture.changeEventTag()
        let staleReview = try await runtime.confirmImport(operationID: UUID(), reviewID: reviewed.id,
                                                          expectedRevision: connected.revision, choices: choices)
        precondition(staleReview.errorCode == ImportFailure.staleRemote.rawValue && local.receipts.isEmpty)
        let fresh = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                    eventID: "ordinary", choices: choices)
        do {
            _ = try await runtime.confirmImport(operationID: UUID(), reviewID: fresh.id,
                                                expectedRevision: connected.revision, choices: .init(mode: .none))
            preconditionFailure("One-off import cannot enable automatic Google actions")
        } catch ImportFailure.invalidInput {}
        let operationID = UUID()
        let imported = try await runtime.confirmImport(operationID: operationID, reviewID: fresh.id,
                                                        expectedRevision: connected.revision, choices: choices)
        precondition(imported.local?.id == "local-fixture" && imported.relationship == .manual && imported.suppression == .none)
        precondition(local.receipts.count == 1)
        let afterImport = try await page(runtime, revision: connected.revision)
        precondition(afterImport.items.map(\.eventId) == ["family"] && afterImport.nextCursor != nil)
        do {
            _ = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                eventID: "ordinary", choices: choices)
            preconditionFailure("A direct review cannot bypass a source reservation")
        } catch ImportFailure.alreadyImported {}

        let staleSeries = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                           eventID: "family", choices: choices)
        await fixture.changeCancellationTag()
        let rejectedSeries = try await runtime.confirmImport(operationID: UUID(), reviewID: staleSeries.id,
                                                             expectedRevision: connected.revision, choices: choices)
        precondition(rejectedSeries.errorCode == ImportFailure.staleRemote.rawValue && local.receipts.count == 1)
        let recurring = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                        eventID: "family", choices: choices)
        precondition(recurring.recurrenceEvidence?.exceptions.map(\.identity.nominalSlot) == ["2027-03-15T00:00"])
        precondition(recurring.recurrenceEvidence?.ordinarySlots.map(\.nominalSlot) == ["2027-03-14T00:00", "2027-03-16T00:00"])
        let recurringOperation = UUID()
        let importedSeries = try await runtime.confirmImport(operationID: recurringOperation, reviewID: recurring.id,
                                                              expectedRevision: connected.revision, choices: choices)
        precondition(importedSeries.local?.id == "series-fixture" && importedSeries.local?.kind == .series
                     && importedSeries.relationship == .manual && importedSeries.suppression == .none)
        let afterSeries = try await page(runtime, revision: connected.revision)
        precondition(afterSeries.items.isEmpty && afterSeries.nextCursor != nil)

        let refresh = try await runtime.authorizeFromUserAction(expectedRevision: connected.revision, intent: .reauthorizeCurrentAccount)
        precondition(refresh.revision == 2 && refresh.accountGeneration == connected.accountGeneration)
        try await rejects(.staleCursor) { _ = try await page(runtime, revision: refresh.revision, cursor: cursor) }
        try await rejects(.staleConnection) {
            _ = try await runtime.prepareImport(expectedRevision: connected.revision, calendarID: "owned",
                                                eventID: "ordinary", choices: choices)
        }
        let relaunched = newRuntime()
        let recovered = try await relaunched.recoverImport(operationID: operationID, expectedRevision: refresh.revision)
        let recoveredSeries = try await relaunched.recoverImport(operationID: recurringOperation, expectedRevision: refresh.revision)
        precondition(recovered == imported && recoveredSeries == importedSeries && local.receipts.count == 2)

        await fixture.holdEvents()
        let backgroundRead = Task {
            try await runtime.prepareImport(expectedRevision: refresh.revision, calendarID: "owned",
                                            eventID: "next", choices: choices)
        }
        await fixture.waitForHeldEvents()
        foreground.active = false
        await fixture.releaseEvents()
        try await rejects(.needsAccess) { _ = try await backgroundRead.value }
        foreground.active = true

        await fixture.holdOwnership()
        let backgroundBeforeEvent = Task {
            try await runtime.prepareImport(expectedRevision: refresh.revision, calendarID: "owned",
                                            eventID: "no-event-expected", choices: choices)
        }
        await fixture.waitForHeldEvents()
        foreground.active = false
        await fixture.releaseEvents()
        try await rejects(.needsAccess) { _ = try await backgroundBeforeEvent.value }
        foreground.active = true

        await accounts.selectOtherAccount()
        try await rejects(.accountChanged) {
            _ = try await runtime.authorizeFromUserAction(expectedRevision: refresh.revision, intent: .reauthorizeCurrentAccount)
        }
        let unchanged = try await runtime.view()
        precondition(unchanged.revision == refresh.revision && unchanged.accountGeneration == refresh.accountGeneration)
        await fixture.holdEvents()
        let oldAccountRead = Task { try await page(runtime, revision: refresh.revision) }
        await fixture.waitForHeldEvents()
        let switched = try await runtime.authorizeFromUserAction(expectedRevision: refresh.revision, intent: .connectOrChangeAccount)
        precondition(switched.revision == 3 && switched.accountGeneration == 2 && switched.email == refresh.email)
        await fixture.releaseEvents()
        try await rejects(.staleConnection) { _ = try await oldAccountRead.value }
        do {
            _ = try await relaunched.recoverImport(operationID: operationID, expectedRevision: switched.revision)
            preconditionFailure("Another Google subject cannot recover the prior receipt")
        } catch ImportFailure.notFound {}

        await fixture.holdEvents()
        let expiring = Task { try await page(runtime, revision: switched.revision) }
        await fixture.waitForHeldEvents()
        clock.advance(by: 61)
        await fixture.releaseEvents()
        try await rejects(.needsAccess) { _ = try await expiring.value }
        let expired = try await runtime.view()
        precondition(expired.connected && expired.access == .needsAccess)
        let disconnect = try await runtime.disconnectFromUserAction(operationID: "fixture-disconnect", expectedRevision: switched.revision)
        let replay = try await runtime.disconnectFromUserAction(operationID: "fixture-disconnect", expectedRevision: switched.revision)
        precondition(disconnect.revision == 4 && replay.revision == 4 && replay.revocation == .revoked)
        let disconnected = try await runtime.view()
        precondition(!disconnected.connected && disconnected.accountGeneration == 3)
        let requests = await accounts.requests
        precondition(requests == [nil, "subject-A", "subject-A", nil])
        let revocations = await fixture.revocations
        precondition(revocations == 1)
    }

    private static func page(_ runtime: Runtime, revision: Int, calendarID: String = "owned",
                             cursor: Connection.EventCursor? = nil) async throws -> Connection.EventPage {
        try await runtime.browseEvents(expectedRevision: revision, calendarID: calendarID, from: "2027-03-14",
                                       until: "2027-03-15", cursor: cursor, zone: TimeZone(identifier: "America/Los_Angeles")!)
    }

    private static func rejects(_ expected: Failure, _ block: () async throws -> Void) async throws {
        do {
            try await block()
            preconditionFailure("Expected \(expected.rawValue)")
        } catch let failure as Failure { precondition(failure == expected) }
    }

    @MainActor
    private final class Foreground { var active = true }

    @MainActor
    private final class LocalImports {
        private(set) var receipts: [String: Journal.LocalReceipt] = [:]

        func create(_ command: Import.Command, permit: Journal.Scheduler.Permit) throws -> Journal.LocalResult {
            guard try permit() else { return .rejected(ImportFailure.staleConnection.rawValue) }
            let receipt: Journal.LocalReceipt
            precondition(command.mode == .none)
            if let rule = command.rule {
                precondition(command.title == "Family" && rule.count == 3)
                precondition(command.exceptions == [.skip(nominalSlot: "2027-03-15T00:00")])
                receipt = .init(id: "series-fixture", kind: .series, status: .applied, eligibleForLink: true)
            } else {
                precondition(command.title == "更新后的标题" && command.notes == "  Original notes\n")
                receipt = .init(id: "local-fixture", kind: .reminder, status: .applied, eligibleForLink: true)
            }
            precondition(receipts.updateValue(receipt, forKey: command.id) == nil)
            return .acknowledged(receipt)
        }
    }

    private final class Clock: @unchecked Sendable {
        private let lock = NSLock()
        private var value: Date

        init(_ now: Date) { value = now }

        func now() -> Date { lock.withLock { value } }

        func advance(by seconds: TimeInterval) { lock.withLock { value.addTimeInterval(seconds) } }
    }

    private actor Accounts {
        let original: RemiloIOSGoogleCalendarAccess
        let other: RemiloIOSGoogleCalendarAccess
        private var useOther = false
        private(set) var requests: [String?] = []

        init(original: RemiloIOSGoogleCalendarAccess, other: RemiloIOSGoogleCalendarAccess) {
            self.original = original
            self.other = other
        }

        func selectOtherAccount() { useOther = true }

        func authorize(expectedSubject: String?, purpose: RemiloIOSGoogleCalendarPurpose) throws -> RemiloIOSGoogleCalendarAccess {
            precondition(purpose == .ownedCalendars)
            requests.append(expectedSubject)
            return useOther ? other : original
        }
    }

    private actor Fixture {
        private enum ReadKind: Equatable { case ownership, event }
        private var holdNext: ReadKind?
        private var held: CheckedContinuation<Void, Never>?
        private var waiting: CheckedContinuation<Void, Never>?
        private var eventTag = "exact"
        private var cancellationTag = "initial"
        private(set) var revocations = 0

        func holdEvents() { holdNext = .event }
        func holdOwnership() { holdNext = .ownership }
        func changeEventTag() { eventTag = "updated" }
        func changeCancellationTag() { cancellationTag = "changed" }

        func waitForHeldEvents() async {
            if held != nil { return }
            await withCheckedContinuation { waiting = $0 }
        }

        func releaseEvents() {
            held?.resume()
            held = nil
        }

        private func pauseIfHeld(_ kind: ReadKind) async {
            guard holdNext == kind else { return }
            holdNext = nil
            await withCheckedContinuation { continuation in
                held = continuation
                waiting?.resume()
                waiting = nil
            }
        }

        func send(_ request: URLRequest) async throws -> HTTP.Response {
            let url = request.url!
            if url.path == "/revoke" {
                precondition(request.httpMethod == "POST" && request.httpBody == Data("token=fixture-other-bearer".utf8))
                revocations += 1
                return reply("{}")
            }
            precondition(request.httpMethod == "GET")
            if url.path == "/v1/userinfo" {
                precondition(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-other-bearer")
                return reply(#"{"sub":"subject-B","email":"owner@example.test","email_verified":true}"#)
            }
            switch url.path {
            case "/calendar/v3/users/me/calendarList":
                return reply(#"{"items":[{"id":"owned","accessRole":"owner","timeZone":"America/Los_Angeles"},{"id":"writer","accessRole":"writer"}]}"#)
            case "/calendar/v3/users/me/calendarList/owned":
                await pauseIfHeld(.ownership)
                return reply(#"{"id":"owned","accessRole":"owner","timeZone":"America/Los_Angeles","summary":"Owned"}"#)
            case "/calendar/v3/users/me/calendarList/writer":
                return reply(#"{"id":"writer","accessRole":"writer"}"#)
            case "/calendar/v3/calendars/owned/events/ordinary":
                await pauseIfHeld(.event)
                return reply(#"{"id":"ordinary","etag":"\"\#(eventTag)\"","summary":"更新后的标题","description":"  Original notes\n","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"},"reminders":{"useDefault":false}}"#)
            case "/calendar/v3/calendars/owned/events/next":
                await pauseIfHeld(.event)
                return reply(#"{"id":"next","etag":"\"next\"","summary":"Next","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"}}"#)
            case "/calendar/v3/calendars/owned/events/weak":
                return reply(#"{"id":"weak","etag":"W/\"stale\""}"#)
            case "/calendar/v3/calendars/owned/events/missing":
                return reply("{}", status: 404)
            case "/calendar/v3/calendars/owned/events/removed":
                return reply(#"{"id":"removed","status":"cancelled"}"#)
            case "/calendar/v3/calendars/owned/events/family":
                return reply(#"{"id":"family","etag":"\"family\"","summary":"Family","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"},"recurrence":["RRULE:FREQ=DAILY;COUNT=3"]}"#)
            case "/calendar/v3/calendars/owned/events/family/instances":
                let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
                let original = query?.first(where: { $0.name == "originalStart" })?.value
                guard let original, ["2027-03-14", "2027-03-16"].contains(original),
                      let day = Int(original.suffix(2)) else { preconditionFailure("Unexpected ordinary instance") }
                return reply(#"{"items":[{"id":"instance-\#(day)","summary":"Family","recurringEventId":"family","originalStartTime":{"date":"\#(original)"},"start":{"date":"\#(original)"},"end":{"date":"2027-03-\#(day + 1)"}}]}"#)
            case "/calendar/v3/calendars/owned/events":
                let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
                if query.contains(.init(name: "showDeleted", value: "true")) {
                    if query.contains(.init(name: "syncToken", value: "family-snapshot")) {
                        return reply(#"{"nextSyncToken":"family-current"}"#)
                    }
                    return reply(#"{"items":[{"id":"cancelled-15","etag":"\"\#(cancellationTag)\"","recurringEventId":"family","status":"cancelled","originalStartTime":{"date":"2027-03-15"}}],"nextSyncToken":"family-snapshot"}"#)
                }
                precondition(query.contains(.init(name: "timeMin", value: "2027-03-14T08:00:00Z")))
                precondition(query.contains(.init(name: "timeMax", value: "2027-03-15T07:00:00Z")))
                await pauseIfHeld(.event)
                if query.contains(.init(name: "pageToken", value: "next-page")) {
                    return reply(#"{"items":[{"id":"next","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"}}]}"#)
                }
                return reply(#"{"items":[{"id":"ordinary","summary":"提醒","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"}},{"id":"family","summary":"Family","start":{"date":"2027-03-14"},"end":{"date":"2027-03-15"},"recurrence":["RRULE:FREQ=DAILY;COUNT=3"]}],"nextPageToken":"next-page"}"#)
            default: preconditionFailure("Unexpected Calendar fixture path \(url.path)")
            }
        }

        private func reply(_ body: String, status: Int = 200) -> HTTP.Response { .init(status: status, body: Data(body.utf8)) }
    }
}
