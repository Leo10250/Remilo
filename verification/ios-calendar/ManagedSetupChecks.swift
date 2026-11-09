import Foundation

@MainActor
enum ManagedSetupChecks {
    private typealias Setup = RemiloIOSGoogleCalendarManagedSetup
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private typealias Runtime = RemiloIOSGoogleCalendarRuntime
    private typealias LinkRuntime = RemiloIOSGoogleCalendarManualLinkRuntime
    private typealias Publication = RemiloIOSGoogleCalendarPublicationRuntime

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
        let setup = Setup(connection: connection, journal: journal, canUseForeground: { true }, freshInstallation: { true }, now: now) { subject, purpose in
            try await fixture.consent(subject, purpose)
        }
        let incomingBeforeSetup = try setup.hasActiveIncomingBinding(expectedRevision: connected.revision)
        precondition(!incomingBeforeSetup, "A connected account alone does not trigger managed imports")
        let proposal = try await setup.preview(expectedRevision: connected.revision, zoneID: "UTC")
        guard let review = proposal.review, review.target == .create(zoneID: "UTC") else {
            preconditionFailure("Complete read-only discovery must precede a proposed creation")
        }
        precondition(review.initialImport == .init(mode: .alarm, recoveringExistingCalendar: false))
        let id = UUID()
        let capture = try setup.capture(id, reviewID: review.id, expectedRevision: connected.revision)
        let replay = try setup.capture(id, reviewID: review.id, expectedRevision: connected.revision)
        precondition(capture == replay && proposal.sample == nil && fixture.posts == 0 && fixture.consents.isEmpty)
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
            let policy = Setup.Journal.Policy(exportNewReminders: false, allDayAlarmMinutes: 495)
            let replacement = try await setup.preview(expectedRevision: revision, policy: policy, zoneID: "UTC", replacement: true)
            guard let review = replacement.review, review.target == .select(calendarID: Fixture.calendarID) else {
                preconditionFailure("Review the available calendar before adoption")
            }
            precondition(review.initialImport == .init(mode: .none, recoveringExistingCalendar: true) && review.policy.importMode == .alarm,
                         "Recovery starts silently and preserves the reviewed continuing default")
            let upgrade = try journal.review(replacement.discovery, account: authorized.account, calendarZoneID: "UTC", replacing: id)
            precondition(upgrade.initialImport == .init(mode: .alarm, recoveringExistingCalendar: false),
                         "An existing installation uses its reviewed policy when adopting a calendar")
            guard let sample = replacement.sample else { preconditionFailure("Show context for an existing calendar") }
            precondition(sample.inspectedCount == 5 && !sample.complete && sample.items.map(\.title) == ["Upcoming", "Meeting"])
            precondition(sample.items.map(\.kind) == [.ongoingOrUpcoming, .review(.meeting)] && fixture.samples == 1 && fixture.posts == 0,
                         "A bounded sample skips ended events and instances without granting import authority")
            let selected = UUID()
            _ = try setup.capture(selected, reviewID: review.id, expectedRevision: revision)
            let result = try await setup.advance(selected, expectedRevision: revision)
            guard case .finished(let entry) = result, entry.phase == .confirmed else { preconditionFailure("Adopt the exact reviewed calendar") }
            let saved = try setup.view(expectedRevision: revision)
            let incomingAfterSetup = try setup.hasActiveIncomingBinding(expectedRevision: revision)
            precondition(incomingAfterSetup)
            let defaultExport = try setup.outgoingBinding(explicit: false)
            let explicitExport = try setup.outgoingBinding(explicit: true)
            precondition(defaultExport == nil && explicitExport == saved.binding,
                         "Disabling default export leaves an explicit per-reminder choice available")
            let old = try setup.operation(id, expectedRevision: revision)
            precondition(saved.binding?.record.id == Fixture.calendarID && saved.binding?.initialImport == review.initialImport &&
                         old?.retired == true && fixture.posts == 0)
            fixture.startIncoming()
            let partial = try await setup.scanIncoming(expectedRevision: revision)
            precondition(partial.pages == 10 && partial.continuation && !partial.initialComplete &&
                         partial.pending.first?.importMode == .some(.none) && partial.pending.first?.initialRecovery == true)
            let reopened = Setup(connection: connection, journal: .init(directory: directory), canUseForeground: { true }, now: now) { _, _ in
                preconditionFailure("An authorized read pass never opens consent")
            }
            let completed = try await reopened.scanIncoming(expectedRevision: revision)
            precondition(completed.pages == 2 && !completed.continuation && completed.initialComplete &&
                         fixture.initialPages == Array(0..<12), "Resume the durable provider page without replaying the first ten")
            let delta = try await reopened.scanIncoming(expectedRevision: revision)
            let byID = Dictionary(uniqueKeysWithValues: delta.pending.map { ($0.eventID, $0) })
            precondition(byID["recovered"]?.importMode == .some(.none) && byID["recovered"]?.etag == "\"v2\"" &&
                         byID["continuing"]?.importMode == .some(.alarm) && byID["cancelled"]?.kind == .removed)
            let expired = try await reopened.scanIncoming(expectedRevision: revision)
            precondition(expired.pages == 0 && expired.continuation && expired.initialComplete && expired.pending == delta.pending)
            let rebuilt = try await reopened.scanIncoming(expectedRevision: revision)
            precondition(rebuilt.pending == delta.pending && fixture.deltaTokens == ["baseline", "next"],
                         "Rebuild after token expiry without inferring removals from absent events")
            let local = LocalImports()
            let scheduler = Runtime.ImportJournal.Scheduler(receipt: { await local.receipts[$0.id] }, create: { command, permit in
                try await local.create(command, permit: permit)
            })
            let nowMs: @Sendable () -> Int64 = { Int64((now().timeIntervalSince1970 * 1_000).rounded()) }
            let publication = Publication(connection: connection, journal: .init(directory: directory),
                local: .init(read: { local.snapshot($0) }, permit: { _, _ in preconditionFailure("Import attachment never publishes") }),
                canUseForeground: { true }, now: nowMs)
            func runtime() -> (Runtime, LinkRuntime) {
                let imports = Runtime.ImportJournal(directory: directory, now: nowMs)
                let setupJournal = Setup.Journal(directory: directory)
                let links = LinkRuntime(connection: connection, publication: publication, imports: imports, store: .init(directory: directory),
                    local: .init(read: { local.snapshot($0) }, permit: { snapshot, commit in
                        guard local.snapshot(snapshot.version.occurrenceID) == snapshot else { throw LinkRuntime.Link.Failure.stalePreview }
                        return try commit()
                    }, lifecycleRevision: { local.snapshot($0) == nil ? nil : 0 }),
                    canUseForeground: { true }, now: nowMs,
                    allowsManagedLease: { try setupJournal.permitsLink($0, account: $1) })
                let calendar = Runtime(connection: connection, canUseForeground: { true },
                        importJournal: imports, scheduler: scheduler, manualLink: links,
                        managedSetupJournal: setupJournal, managedImportSound: { .system }) { _, _ in
                    preconditionFailure("Managed import uses the saved grant")
                }
                return (calendar, links)
            }
            do {
                _ = try await runtime().0.syncManagedIncoming(expectedRevision: revision)
                preconditionFailure("Simulate interruption after the scheduler has stored the local receipt")
            } catch LocalImports.Failure.interrupted {}
            let (resumedRuntime, resumedLinks) = runtime()
            let resumed = try await resumedRuntime.syncManagedIncoming(expectedRevision: revision)
            precondition(resumed.imported == 2 && resumed.linked == 2 && resumed.needsReview == 1 && local.commands.count == 2,
                         "Recover and attach the committed receipt, and reject the event that changed between list and lookup")
            let allDay = local.commands.first { $0.title == "all-day" }
            let recovered = local.commands.first { $0.title == "recovered" }
            let alarm = try Runtime.Import.Event.timestamp("2030-01-01T08:15:00Z")
            precondition(allDay?.mode == .some(.alarm) && allDay?.alarmAtMs == alarm && allDay?.alarmLinked == true && allDay?.sound == .system)
            precondition(recovered?.mode == .some(.none) && !local.commands.contains { $0.title == "continuing" })
            let repeated = try await runtime().0.syncManagedIncoming(expectedRevision: revision)
            precondition(repeated.imported == 0 && repeated.linked == 0 && local.commands.count == 2 && fixture.posts == 0,
                         "An import checkpoint cannot duplicate a reminder or send a write to Google")
            let candidates = try resumedLinks.automaticCandidates(expectedConnectionRevision: revision, inspectUnchanged: true)
            guard let lease = saved.binding?.linkLease, candidates.count == 2,
                  let recoveredLink = candidates.first(where: { $0.source.eventID == "recovered" }),
                  let activation = recoveredLink.automatic?.activationRevision else {
                preconditionFailure("Both links are ready to inspect")
            }
            precondition(candidates.allSatisfy { $0.automatic?.managedLease == lease && $0.baseline != nil })
            let rediscovered = try await connection.discoverManagedCalendars(expectedRevision: revision, savedID: Fixture.calendarID,
                                                                              canRead: { true })
            let replacementReview = try journal.review(rediscovered, account: authorized.account, calendarZoneID: "UTC")
            _ = try journal.capture(operationID: UUID(), review: replacementReview, currentAccount: authorized.account)
            let incomingDuringReplacement = try setup.hasActiveIncomingBinding(expectedRevision: revision)
            precondition(!incomingDuringReplacement)
            do {
                _ = try setup.outgoingBinding(explicit: true)
                preconditionFailure("Do not capture even an explicit export against a binding being replaced")
            } catch Failure.staleConnection {}
            let revoked = try resumedLinks.automaticCandidates(expectedConnectionRevision: revision, inspectUnchanged: true)
            precondition(revoked.isEmpty, "Starting a replacement fences existing managed links")
            do {
                _ = try await resumedLinks.syncAutomatic(recoveredLink.occurrenceID, expectedConnectionRevision: revision,
                    expectedLinkRevision: recoveredLink.revision, expectedActivationRevision: activation)
                preconditionFailure("A direct retry must also reject a retired managed link")
            } catch LinkRuntime.Link.Failure.ineligible {}
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
    private final class LocalImports {
        enum Failure: Error { case interrupted }
        private(set) var receipts: [String: Runtime.ImportJournal.LocalReceipt] = [:]
        private(set) var commands: [Runtime.Import.Command] = []

        func snapshot(_ id: String) -> Publication.LocalSnapshot? {
            guard let command = commands.first(where: { $0.id == id }) else { return nil }
            return .init(version: .init(occurrenceID: id, revision: 1, generation: 1),
                         fields: .init(title: command.title, notes: command.notes, schedule: command.schedule))
        }

        func create(_ command: Runtime.Import.Command, permit: Runtime.ImportJournal.Scheduler.Permit) throws -> Runtime.ImportJournal.LocalResult {
            guard try permit() else { return .rejected("STALE_CONNECTION") }
            precondition(receipts[command.id] == nil)
            commands.append(command)
            let receipt = Runtime.ImportJournal.LocalReceipt(id: command.id, kind: .reminder, status: .applied, eligibleForLink: true)
            receipts[command.id] = receipt
            if commands.count == 1 { throw Failure.interrupted }
            return .acknowledged(receipt)
        }
    }

    @MainActor
    private final class Fixture {
        static let calendarID = "managed@example.test"
        let email: String
        let creation: RemiloIOSGoogleCalendarAccess
        private var name: String?
        private var marker: String?
        private(set) var posts = 0
        private(set) var samples = 0
        private var incoming = false
        private(set) var initialPages: [Int] = []
        private(set) var deltaTokens: [String] = []
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

        func startIncoming() { incoming = true }

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
            if url.lastPathComponent == "events" {
                if incoming { return try incomingPage(url) }
                precondition(url.deletingLastPathComponent().lastPathComponent == Self.calendarID && samples == 0)
                samples += 1
                let future = ["dateTime": "2030-01-01T10:00:00Z", "timeZone": "UTC"]
                let futureEnd = ["dateTime": "2030-01-01T11:00:00Z", "timeZone": "UTC"]
                let events: [[String: Any]] = [
                    ["id": "past", "summary": "Ended", "start": ["dateTime": "2020-01-01T10:00:00Z", "timeZone": "UTC"],
                     "end": ["dateTime": "2020-01-01T11:00:00Z", "timeZone": "UTC"]],
                    ["id": "upcoming", "summary": "Upcoming", "start": future, "end": futureEnd],
                    ["id": "meeting", "summary": "Meeting", "start": future, "end": futureEnd, "attendees": [["email": "other@example.test"]]],
                    ["id": "instance", "summary": "Instance", "start": future, "end": futureEnd, "recurringEventId": "master"],
                    ["id": "cancelled", "status": "cancelled"],
                ]
                return .init(status: 200, body: try JSONSerialization.data(withJSONObject: ["items": events, "nextPageToken": "more"]))
            }
            if url.deletingLastPathComponent().lastPathComponent == "events" {
                let id = url.lastPathComponent
                let event = id == "all-day" ? allDayEvent() : timedEvent(id, version: "v2")
                return .init(status: 200, body: try JSONSerialization.data(withJSONObject: event))
            }
            precondition(url.lastPathComponent == Self.calendarID)
            guard let record else { return .init(status: 404, body: Data("{}".utf8)) }
            return .init(status: 200, body: try JSONEncoder().encode(record))
        }

        private func incomingPage(_ url: URL) throws -> HTTP.Response {
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let payload: [String: Any]
            if let token = query.first(where: { $0.name == "syncToken" })?.value {
                deltaTokens.append(token)
                if token == "next" { return .init(status: 410, body: Data("{}".utf8)) }
                switch token {
                case "baseline":
                    payload = ["items": [timedEvent("recovered", version: "v2"), timedEvent("continuing", version: "v1"),
                                         ["id": "cancelled", "status": "cancelled"]], "nextSyncToken": "next"]
                case "rebuilt": payload = ["items": [allDayEvent()], "nextSyncToken": "stable"]
                case "stable": payload = ["items": [], "nextSyncToken": "stable"]
                default: preconditionFailure("Unexpected provider checkpoint")
                }
            } else if deltaTokens.last == "next" {
                precondition(!query.contains { $0.name == "pageToken" })
                payload = ["items": [], "nextSyncToken": "rebuilt"]
            } else {
                let page = query.first(where: { $0.name == "pageToken" })?.value.flatMap(Int.init) ?? 0
                initialPages.append(page)
                let tokenKey = page == 11 ? "nextSyncToken" : "nextPageToken"
                payload = ["items": page == 0 ? [timedEvent("recovered", version: "v1")] : [],
                           tokenKey: page == 11 ? "baseline" : String(page + 1)]
            }
            return .init(status: 200, body: try JSONSerialization.data(withJSONObject: payload))
        }

        private func timedEvent(_ id: String, version: String) -> [String: Any] {
            ["id": id, "etag": "\"\(version)\"", "summary": id,
             "start": ["dateTime": "2030-01-01T10:00:00Z", "timeZone": "UTC"],
             "end": ["dateTime": "2030-01-01T11:00:00Z", "timeZone": "UTC"]]
        }

        private func allDayEvent() -> [String: Any] {
            ["id": "all-day", "etag": "\"v1\"", "summary": "all-day",
             "start": ["date": "2030-01-01"], "end": ["date": "2030-01-02"]]
        }
    }
}
