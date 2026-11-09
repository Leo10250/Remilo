import Foundation

enum ImportChecks {
    private typealias Import = RemiloIOSGoogleCalendarImport
    private typealias Journal = RemiloIOSGoogleCalendarImportJournal
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private typealias Transport = RemiloIOSGoogleCalendarTransport
    private static let account = Import.Account(subject: "subject-A", clientID: "fixture-client", connectionRevision: 2, accountGeneration: 1)

    static func run() async throws {
        let now = try Event.timestamp("2027-03-15T08:00:00Z")
        let calendar = try JSONDecoder().decode(Transport.OwnedCalendar.self, from: Data(#"{"id":"owned","timeZone":"UTC","accessRole":"owner"}"#.utf8))
        let event = try remote(id: "one-off", etag: #""reviewed""#)
        let review = try Import.Review(account: account, calendar: calendar, event: event, now: now)
        let choices = Import.Choices(mode: .notification, alarmAtMs: now + 10 * 60_000, sound: .system,
                                     automaticSync: false, disableGoogleReminders: true)
        let operation = UUID()
        let captured = try Import.Capture(operationID: operation, review: review, choices: choices, now: now)
        precondition(captured.command.title == "读书" && captured.command.notes == "  原始备注\n换行  ")
        precondition(captured.command.alarmAtMs == now + 10 * 60_000 && !captured.command.alarmLinked)
        precondition(captured.command.schedule.zoneId == "UTC" && captured.command.mode == .notification)
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-calendar-import-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let journal = Journal(directory: path, now: { now })
        let scheduled = LocalFixture(loseReply: true, status: .blocked)
        let scheduler = adapter(scheduled)
        let available = authority(review.source)
        _ = try await journal.capture(operationID: operation, review: review, choices: choices)
        _ = try await journal.capture(operationID: operation, review: review, choices: choices)
        let capturedAccount = try await journal.account(for: operation)
        precondition(capturedAccount == account)
        let resumedOwner = Import.Account(subject: account.subject, clientID: account.clientID, connectionRevision: 3, accountGeneration: 2)
        let otherAccount = Import.Account(subject: "subject-B", clientID: account.clientID, connectionRevision: 3, accountGeneration: 2)
        let waiting = try await journal.savedOperation(operation, viewingAs: resumedOwner)
        let hidden = try await journal.savedOperation(operation, viewingAs: otherAccount)
        let foreignList = try await journal.savedOperations(viewingAs: otherAccount)
        precondition(waiting?.phase == .waiting && waiting?.title == "读书" && hidden == nil && foreignList.isEmpty)
        try await rejects(.operationPending) {
            _ = try await journal.capture(operationID: UUID(), review: review, choices: choices)
        }
        try await rejects(.operationReused) {
            _ = try await journal.capture(operationID: operation, review: review, choices: Import.Choices(mode: .none))
        }
        do {
            _ = try await journal.run(operation, authority: available, scheduler: scheduler)
            preconditionFailure("Expected a lost scheduler reply")
        } catch LocalFixture.LostReply.outcomeUnknown {}
        let recreated = Journal(directory: path, now: { now + 3_600_000 })
        let disconnected = Journal.Authority(current: { _ in false }, observe: { _ in
            preconditionFailure("An existing durable scheduler receipt must be checked before the stale remote")
        })
        let recovered = try await recreated.run(operation, authority: disconnected, scheduler: scheduler)
        precondition(recovered.local?.status == .blocked && recovered.relationship == .suspended && recovered.suppression == .suspended)
        let exact = try await recreated.capture(operationID: operation, review: review, choices: choices)
        precondition(exact == recovered)
        let recoveredAccount = try await recreated.account(for: operation)
        let unknownAccount = try await recreated.account(for: UUID())
        precondition(recoveredAccount == account && unknownAccount == nil)
        let confirmed = try await recreated.savedOperation(operation, viewingAs: resumedOwner)
        precondition(confirmed?.phase == .settled && confirmed?.title == nil && confirmed?.receipt?.local?.status == .blocked)
        let attempts = await scheduled.attempts
        precondition(attempts == 1)
        let state = try String(contentsOf: path.appendingPathComponent("import-journal.json"), encoding: .utf8)
        precondition(!state.contains("原始备注") && state.contains("one-off"))
        try await rejects(.alreadyImported) {
            _ = try await journal.capture(operationID: UUID(), review: review, choices: choices)
        }

        let changedEvent = try remote(id: "stale", etag: #""before""#)
        let old = try Import.Review(account: account, calendar: calendar, event: changedEvent, now: now)
        let newer = try Import.Source(account: account, calendar: calendar, event: remote(id: "stale", etag: #""after""#))
        let changed = UUID()
        _ = try await journal.capture(operationID: changed, review: old, choices: Import.Choices())
        let stale = try await journal.run(changed, authority: authority(newer), scheduler: scheduler)
        precondition(stale.errorCode == "STALE_REMOTE" && stale.local == nil)
        let finalAttempts = await scheduled.attempts
        precondition(finalAttempts == 1)

        let healthy = LocalFixture(loseReply: false, status: .pending)
        let pendingReview = try Import.Review(account: account, calendar: calendar, event: remote(id: "pending", etag: #""etag""#), now: now)
        let pendingOperation = UUID()
        _ = try await journal.capture(operationID: pendingOperation, review: pendingReview, choices: choices)
        let pending = try await journal.run(pendingOperation, authority: authority(pendingReview.source), scheduler: adapter(healthy))
        precondition(pending.local?.status == .pending && pending.relationship == .manual && pending.suppression == .deferredUntilLocalDelivery)
        try await revokedBeforeCommit(journal, calendar: calendar, now: now)
        try expiryAndRecurrence(calendar, now: now)
        try finalAllDayAlarm(calendar)
        try await exactRecurringExceptions(journal, calendar: calendar, now: now)
    }

    @MainActor
    private static func revokedBeforeCommit(_ journal: Journal, calendar: Transport.OwnedCalendar, now: Int64) async throws {
        let event = try remote(id: "revoked-before-commit", etag: #""etag""#)
        let review = try Import.Review(account: account, calendar: calendar, event: event, now: now)
        let operation = UUID()
        _ = try await journal.capture(operationID: operation, review: review, choices: .init())
        let epoch = AuthorityFixture()
        let authority = Journal.Authority(current: { $0 == account && epoch.available }, observe: { _ in
            Import.Observation(source: review.source, recurrenceEvidence: nil)
        })
        let fixture = LocalFixture(loseReply: false, status: .scheduled)
        let (queued, markQueued) = AsyncStream<Void>.makeStream()
        let (release, resume) = AsyncStream<Void>.makeStream()
        let scheduler = Journal.Scheduler(receipt: { try await fixture.receipt($0) }, create: { command, permit in
            markQueued.yield(())
            markQueued.finish()
            for await _ in release { break }
            return try await fixture.create(command, permit: permit)
        })
        let pending = Task { try await journal.run(operation, authority: authority, scheduler: scheduler) }
        var entered = queued.makeAsyncIterator()
        _ = await entered.next()
        epoch.available = false
        resume.yield(())
        resume.finish()
        let denied = try await pending.value
        let attempts = await fixture.attempts
        precondition(denied.errorCode == "STALE_CONNECTION" && denied.local == nil && attempts == 0)
    }

    @MainActor
    private final class AuthorityFixture { var available = true }

    private static func expiryAndRecurrence(_ calendar: Transport.OwnedCalendar, now: Int64) throws {
        let past = try remote(id: "past", etag: #""past""#, date: "2027-03-14")
        let pastReview = try Import.Review(account: account, calendar: calendar, event: past, now: now)
        do {
            _ = try Import.Capture(operationID: UUID(), review: pastReview, choices: .init(), now: now)
            preconditionFailure("An elapsed alert requires an explicit future target or No alert")
        } catch Import.Failure.alertExpired {}
        let noAlert = try Import.Capture(operationID: UUID(), review: pastReview, choices: .init(mode: .none), now: now)
        precondition(noAlert.command.mode == .none && noAlert.command.alarmAtMs < now)

        let master = try remote(id: "master", etag: #""master""#, recurrence: ["RRULE:FREQ=DAILY;UNTIL=20270316T083000Z"])
        do {
            _ = try Import.Review(account: account, calendar: calendar, event: master, now: now)
            preconditionFailure("A recurrence needs native Google instances and exception audit evidence")
        } catch Import.Failure.recurrenceReviewRequired {}
        let identity = Event.InstanceIdentity(eventID: "google-instance-id", masterID: "master",
                                              nominalSlot: "2027-03-15T09:00", cancelled: false)
        let slot = try Import.AuditedSlot(identity: identity, startMs: Event.timestamp("2027-03-15T09:00:00Z"),
                                          endMs: Event.timestamp("2027-03-15T09:30:00Z"))
        let proof = Import.RecurrenceEvidence(referenceMs: now, alertPolicy: .init(enabled: true, offsetMs: nil),
                                             masterETag: #""master""#, exceptions: [], ordinarySlots: [slot])
        let reviewed = try Import.Review(account: account, calendar: calendar, event: master, now: now, recurrenceEvidence: proof)
        let capture = try Import.Capture(operationID: UUID(), review: reviewed, choices: .init(), now: now)
        precondition(capture.command.rule?.endExclusive == "2027-03-16T08:30:00.001")
        precondition(capture.command.rule?.payload["zoneMode"] as? String == "pinned")
        precondition(reviewed.matches(Import.Observation(source: reviewed.source, recurrenceEvidence: proof)))
        precondition(!reviewed.matches(Import.Observation(source: reviewed.source, recurrenceEvidence: nil)))
    }

    private static func exactRecurringExceptions(_ journal: Journal, calendar: Transport.OwnedCalendar, now: Int64) async throws {
        typealias Exception = RemiloIOSGoogleCalendarRecurringReview.Exception
        let master = try remote(id: "exception-master", etag: #""master""#, recurrence: ["RRULE:FREQ=DAILY;COUNT=5"])
        let skipped = Exception(identity: Event.InstanceIdentity(eventID: "google-skip", masterID: master.id,
                                                                 nominalSlot: "2027-03-15T09:00", cancelled: true), etag: nil, fields: nil)
        let movedIdentity = Event.InstanceIdentity(eventID: "google-move", masterID: master.id,
                                                   nominalSlot: "2027-03-16T09:00", cancelled: false)
        let movedStart = try Event.timestamp("2027-03-17T10:00:00Z")
        let moved = Event.Fields(title: "", notes: "  moved notes\n", schedule: Event.Schedule(
            eventStartMs: movedStart, eventEndMs: movedStart + 1_800_000, allDay: false, zoneId: "UTC", recurrence: nil
        ))
        let movedException = Exception(identity: movedIdentity, etag: #""moved-v1""#, fields: moved)
        let ordinary = try (17...19).map { day in
            let identity = Event.InstanceIdentity(eventID: "ordinary-\(day)", masterID: master.id,
                                                  nominalSlot: "2027-03-\(day)T09:00", cancelled: false)
            let start = try Event.timestamp("2027-03-\(day)T09:00:00Z")
            return Import.AuditedSlot(identity: identity, startMs: start, endMs: start + 1_800_000)
        }
        let evidence = Import.RecurrenceEvidence(referenceMs: now, alertPolicy: .init(enabled: true, offsetMs: -1_800_000), masterETag: #""master""#,
                                                 exceptions: [skipped, movedException], ordinarySlots: ordinary)
        let review = try Import.Review(account: account, calendar: calendar, event: master, now: now, recurrenceEvidence: evidence)
        let decoded = try JSONDecoder().decode(Import.Review.self, from: JSONEncoder().encode(review))
        precondition(decoded == review)
        let choices = Import.Choices(mode: .alarm, alarmAtMs: now + 1_800_000, automaticSync: false)
        let upcoming = try review.upcoming(choices, after: now)
        precondition(upcoming.map(\.nominalSlot) == ["2027-03-17T09:00", movedIdentity.nominalSlot, "2027-03-18T09:00"])
        precondition(upcoming[1].eventStartMs == movedStart && upcoming[1].alarmAtMs == movedStart - 1_800_000)
        let id = UUID()
        let capture = try Import.Capture(operationID: id, review: review, choices: choices, now: now)
        let overrides = capture.command.payload["nativeCalendarExceptions"] as! [[String: Any]]
        precondition(overrides[0]["kind"] as? String == "Skip" && overrides[0]["nominalSlot"] as? String == skipped.identity.nominalSlot)
        precondition(overrides[1]["kind"] as? String == "Override" && overrides[1]["nominalSlot"] as? String == movedIdentity.nominalSlot)
        precondition(overrides[1]["title"] as? String == "读书" && overrides[1]["notes"] as? String == moved.notes)
        precondition(overrides[1]["alarmAtMs"] as? Int64 == movedStart - 1_800_000 && overrides[1]["dueAtMs"] as? Int64 == movedStart)
        precondition(overrides[1]["alertEligible"] as? Bool == true)
        do {
            _ = try Import.Capture(operationID: UUID(), review: review, choices: .init(mode: .none), now: now)
            preconditionFailure("A changed delivery policy needs a fresh exception scan")
        } catch Import.Failure.recurrenceReviewRequired {}

        let historicalFields = Event.Fields(title: "Historical move", notes: "", schedule: .init(
            eventStartMs: now - 3_600_000, eventEndMs: now - 1_800_000, allDay: false, zoneId: "UTC", recurrence: nil
        ))
        let historical = Import.RecurrenceEvidence(referenceMs: now, alertPolicy: evidence.alertPolicy, masterETag: evidence.masterETag,
                                                    exceptions: [skipped, Exception(identity: movedIdentity, etag: movedException.etag, fields: historicalFields)],
                                                    ordinarySlots: ordinary)
        let historicalReview = try Import.Review(account: account, calendar: calendar, event: master, now: now, recurrenceEvidence: historical)
        let historicalUpcoming = try historicalReview.upcoming(choices, after: now)
        precondition(historicalUpcoming.map(\.nominalSlot) == ordinary.map(\.nominalSlot))
        let historicalCapture = try Import.Capture(operationID: UUID(), review: historicalReview, choices: choices, now: now)
        let historicalOverrides = historicalCapture.command.payload["nativeCalendarExceptions"] as! [[String: Any]]
        precondition(historicalOverrides[1]["nominalSlot"] as? String == movedIdentity.nominalSlot)
        precondition(historicalOverrides[1]["alertEligible"] as? Bool == false)

        let changed = Import.RecurrenceEvidence(referenceMs: now, alertPolicy: evidence.alertPolicy, masterETag: evidence.masterETag, exceptions: [
            skipped, Exception(identity: movedIdentity, etag: #""moved-v2""#, fields: moved),
        ], ordinarySlots: ordinary)
        _ = try await journal.capture(operationID: id, review: review, choices: choices)
        let authority = Journal.Authority(current: { $0 == account }, observe: { capture in
            precondition(capture.recurrenceEvidence?.referenceMs == now)
            return Import.Observation(source: review.source, recurrenceEvidence: changed)
        })
        let local = LocalFixture(loseReply: false, status: .scheduled)
        let rejected = try await journal.run(id, authority: authority, scheduler: adapter(local))
        let attempts = await local.attempts
        precondition(rejected.errorCode == "STALE_REMOTE" && rejected.local == nil && attempts == 0)
    }

    private static func finalAllDayAlarm(_ calendar: Transport.OwnedCalendar) throws {
        let id = "last-all-day"
        let etag = #""last-all-day""#
        let json = try JSONSerialization.data(withJSONObject: [
            "id": id, "etag": etag, "summary": "Read",
            "start": ["date": "2027-03-13"], "end": ["date": "2027-03-14"],
            "recurrence": ["RRULE:FREQ=DAILY;COUNT=2"],
        ] as [String: Any])
        let master = Transport.Event(id: id, etag: etag, cancelled: false, json: json)
        let last = Event.InstanceIdentity(eventID: "last-slot", masterID: id, nominalSlot: "2027-03-14T00:00", cancelled: false)
        let start = try Event.timestamp("2027-03-14T00:00:00Z")
        let end = try Event.timestamp("2027-03-15T00:00:00Z")
        let cutoff = try Event.timestamp("2027-03-14T08:59:00Z")
        let alarm = try Event.timestamp("2027-03-14T09:00:00Z")
        let slot = Import.AuditedSlot(identity: last, startMs: start, endMs: end)
        let proof = Import.RecurrenceEvidence(referenceMs: cutoff, alertPolicy: .init(enabled: true, offsetMs: nil),
                                             masterETag: etag, exceptions: [], ordinarySlots: [slot])
        let review = try Import.Review(account: account, calendar: calendar, event: master, now: cutoff, recurrenceEvidence: proof)
        let next = try review.upcoming(.init(), after: cutoff)
        let elapsed = try review.upcoming(.init(), after: alarm)
        precondition(next == [.init(nominalSlot: last.nominalSlot, eventStartMs: start, alarmAtMs: alarm)] && elapsed.isEmpty)
        _ = try Import.Capture(operationID: UUID(), review: review, choices: .init(), now: cutoff)
        do {
            _ = try Import.Capture(operationID: UUID(), review: review, choices: .init(), now: alarm)
            preconditionFailure("The final occurrence must not register after its alarm elapsed")
        } catch Import.Failure.alertExpired {}
    }

    private static func remote(id: String, etag: String, date: String = "2027-03-15", recurrence: [String]? = nil) throws -> Transport.Event {
        var fields: [String: Any] = [
            "id": id, "etag": etag, "summary": "读书", "description": "  原始备注\n换行  ",
            "start": ["dateTime": date + "T09:00:00Z", "timeZone": "UTC"],
            "end": ["dateTime": date + "T09:30:00Z", "timeZone": "UTC"],
        ]
        fields["recurrence"] = recurrence
        return Transport.Event(id: id, etag: etag, cancelled: false, json: try JSONSerialization.data(withJSONObject: fields))
    }

    private static func authority(_ source: Import.Source) -> Journal.Authority {
        Journal.Authority(current: { $0 == account }, observe: { review in
            precondition(review.source.key == source.key)
            return Import.Observation(source: source, recurrenceEvidence: nil)
        })
    }

    private static func adapter(_ fixture: LocalFixture) -> Journal.Scheduler {
        Journal.Scheduler(receipt: { try await fixture.receipt($0) }, create: { try await fixture.create($0, permit: $1) })
    }

    private static func rejects(_ expected: Import.Failure, _ block: () async throws -> Void) async throws {
        do {
            try await block()
            preconditionFailure("Expected \(expected.rawValue)")
        } catch let failure as Import.Failure { precondition(failure == expected) }
    }

    private actor LocalFixture {
        enum LostReply: Error { case outcomeUnknown }
        private let loseReply: Bool
        private let status: Journal.LocalReceipt.Status
        private var saved: (Import.Command, Journal.LocalReceipt)?
        private(set) var attempts = 0

        init(loseReply: Bool, status: Journal.LocalReceipt.Status) {
            self.loseReply = loseReply
            self.status = status
        }

        func receipt(_ command: Import.Command) throws -> Journal.LocalReceipt? {
            guard let saved else { return nil }
            precondition(command == saved.0)
            return saved.1
        }

        func create(_ command: Import.Command, permit: Journal.Scheduler.Permit) async throws -> Journal.LocalResult {
            guard try await permit() else { return .rejected("STALE_CONNECTION") }
            precondition(command.id.hasPrefix(Import.Command.privatePrefix) && saved == nil)
            attempts += 1
            let receipt = Journal.LocalReceipt(id: "one-native-id", kind: .reminder, status: status, eligibleForLink: true)
            saved = (command, receipt)
            if loseReply { throw LostReply.outcomeUnknown }
            return .acknowledged(receipt)
        }
    }
}
