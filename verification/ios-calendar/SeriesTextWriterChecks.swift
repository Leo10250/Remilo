import Foundation

@MainActor
enum SeriesTextWriterChecks {
    private typealias Service = RemiloIOSGoogleCalendarSeriesTextWriter
    private typealias Inbox = RemiloIOSGoogleCalendarManagedInbox
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    readOnly: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date,
                    editsSchedule: Bool = false) async throws {
        if editsSchedule { try recurrenceEncoding() }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-series-write-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = Fixture(directory: directory, email: access.account.email, editsSchedule: editsSchedule)
        let connection = Service.Runtime.Connection(configuration: configuration, store: .init(directory: directory),
            http: .init(send: { request, _, _ in try await fixture.send(request) }), now: now)
        let clock: @Sendable () -> Int64 = { Int64(now().timeIntervalSince1970 * 1_000) }
        let imports = Service.Journal(directory: directory, now: clock)
        let initial = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in readOnly }
        let granted = try await connection.connectFromUserAction(expectedRevision: initial.revision, consent: .writeOwnedEvents) { _, _ in access }
        let account = try connection.account(expectedRevision: granted.revision)
        let calendar = try JSONDecoder().decode(RemiloIOSGoogleCalendarTransport.OwnedCalendar.self,
                                                from: JSONSerialization.data(withJSONObject: fixture.calendar))
        let binding = Inbox.Journal.Binding(operationID: UUID(), account: account, record: try .init(calendar),
                                            revision: 1, authEpoch: 1, initialImport: nil)
        let lease = binding.linkLease
        let policy = Inbox.Journal.Policy(importMode: .none)
        let scope = Inbox.Scope(binding: binding, policy: policy)
        let review = try await connection.prepareImport(expectedRevision: granted.revision, calendarID: lease.calendarID,
            eventID: Fixture.master, recurringChoices: .init(mode: .none), managedLease: lease, canRead: { true })
        let permit = Inbox.Permit(scope: scope, observation: .init(eventID: Fixture.master, etag: review.source.etag,
            kind: .recurringMaster, importMode: .none, initialRecovery: false))
        let id = try await imports.captureManaged(permit, review: review, choices: .init(mode: .none, allDayAlarmMinutes: policy.allDayAlarmMinutes))
        let local = Service.Journal.LocalReceipt(id: "family", kind: .series, status: .applied, eligibleForLink: true)
        let imported = try await imports.run(id, authority: .init(current: { $0 == account },
            observe: { .init(source: $0.source, recurrenceEvidence: $0.recurrenceEvidence) },
            managedCurrent: { $0 == permit && $1 == account }), scheduler: .init(receipt: { _ in local }, create: { _, allows in
                guard try await allows() else { return .rejected("STALE_CONNECTION") }
                return .acknowledged(local)
            }))
        precondition(imported.relationship == .automaticRequested)
        let scheduleEdit: IOSCalendarSeriesTextSnapshot.ScheduleEdit?
        if editsSchedule {
            let rule = try RemiloIOSRecurrence.Rule(anchor: "2027-03-15T11:00", frequency: "weekly", weekdays: [1],
                                                    count: 1, zoneID: "UTC", endOffsetMs: 2_700_000)
            scheduleEdit = .init(baseline: try review.recurringRule()!, current: rule, hasFutureExceptions: false)
        } else { scheduleEdit = nil }
        let snapshot = IOSCalendarSeriesTextSnapshot(familyID: local.id, segmentID: "replacement", revision: 1,
            title: editsSchedule ? review.source.fields.title : "Remilo edit", notes: review.source.fields.notes, scheduleEdit: scheduleEdit)
        func service() -> Service {
            .init(directory: directory, connection: connection, imports: imports,
                  local: .init(read: { $0 == snapshot.familyID ? snapshot : nil }, apply: { _, _, _, _, _ in
                      preconditionFailure("Outbound sync does not edit local reminders")
                  }, permit: { current, checkpoint in
                      guard fixture.allowCheckpoint && current == snapshot else { return nil }
                      return try checkpoint()
                  }, acknowledgeSchedule: { current, allows in
                      guard try allows(), current == snapshot else { return false }
                      precondition(fixture.revealedAuditCount > 0, "Google instances must agree before the local baseline advances")
                      fixture.acknowledgedSchedule = true
                      return true
                  }), canRead: { true }, activeLease: { $0.accountGeneration == account.accountGeneration ? lease : nil })
        }
        let first = service()
        _ = try await first.sync(expectedRevision: granted.revision)
        precondition(fixture.writes == 0)
        fixture.allowCheckpoint = true
        _ = try await first.sync(expectedRevision: granted.revision)
        let pending = try first.unconfirmedImports(viewingAs: account)
        precondition(fixture.writes == 1 && pending == Set([id]))
        let observation = Inbox.Observation(eventID: Fixture.master, etag: Fixture.updatedETag, kind: .recurringMaster,
                                            importMode: .none, initialRecovery: false)
        let staged = Inbox.Progress(scope: scope, pages: 1, initialComplete: true, continuation: false, pending: [observation])
        let waiting = try await imports.reconcileManagedSeries(staged, viewingAs: account, limit: 10, allowTextTransfers: true,
                                                               waitingExports: pending)
        precondition(waiting.isEmpty, "Incoming scan must wait for the sent write's exact outcome")
        fixture.reveal = true
        let renewed = try await connection.connectFromUserAction(expectedRevision: granted.revision, consent: .reauthorizeCurrentAccount) { _, _ in readOnly }
        let resumed = service()
        let confirmed = try await resumed.sync(expectedRevision: renewed.revision)
        let remaining = try resumed.unconfirmedImports(viewingAs: account)
        let saved = try await imports.seriesTextExports(viewingAs: account, lease: lease)
        precondition(confirmed && fixture.writes == 1 && remaining.isEmpty)
        precondition(saved.count == 1 && saved[0].baseline.etag == Fixture.updatedETag && !saved[0].baseline.differs(from: snapshot))
        precondition(fixture.acknowledgedSchedule == editsSchedule)
        if !editsSchedule {
            let viewer = try connection.account(expectedRevision: renewed.revision)
            let child = Inbox.Observation(eventID: Fixture.child, etag: #""child-v1""#, kind: .changedInstance(masterID: Fixture.master),
                                          importMode: .none, initialRecovery: false, instanceCancelled: false)
            let changes = Inbox.Progress(scope: scope, pages: 1, initialComplete: true, continuation: false, pending: [child])
            let pendingInstance = try await imports.reconcileManagedSeries(changes, viewingAs: viewer, limit: 10, allowInstanceTransfers: true)
            guard let work = pendingInstance.first?.instanceWork else { preconditionFailure("Expected child work on the confirmed master") }
            let observed = try await connection.observeManagedInstance(work, account: viewer, budget: .init(), canRead: { true })
            let movedStart = try RemiloIOSGoogleCalendarEvent.timestamp("2027-03-15T14:00:00Z")
            precondition(observed.identity.eventID == Fixture.child && observed.identity.nominalSlot == "2027-03-15T10:00" &&
                         observed.fields.schedule.eventStartMs == movedStart)
            fixture.childMaster = "unrelated-master"
            do {
                _ = try await connection.observeManagedInstance(work, account: viewer, budget: .init(), canRead: { true })
                preconditionFailure("A child of a different master cannot be applied")
            } catch Service.Import.Failure.staleRemote {}
        }
    }

    private static func recurrenceEncoding() throws {
        let utc = RemiloIOSGoogleCalendarEvent.utc
        let weekly = try RemiloIOSRecurrence.Rule(anchor: "2027-03-16T10:00", frequency: "weekly", interval: 2,
                                                  weekdays: [1], count: 2, zoneID: "UTC")
        let normalized = try RemiloIOSGoogleCalendarRule.schedule(weekly)
        let first = try RemiloIOSGoogleCalendarEvent.timestamp("2027-03-29T10:00:00Z")
        precondition(normalized.eventStartMs == first &&
                     normalized.recurrence == ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;WKST=MO;COUNT=2"])
        let allDay = try RemiloIOSRecurrence.Rule(anchor: "2027-03-15T00:00", frequency: "daily", zoneID: "UTC",
            endExclusive: "2027-03-17T00:00", allDay: true, endOffsetMs: 86_400_000)
        let bounded = try RemiloIOSGoogleCalendarRule.schedule(allDay)
        precondition(bounded.recurrence == ["RRULE:FREQ=DAILY;INTERVAL=1;WKST=MO;UNTIL=20270316"])
        let fractional = try RemiloIOSRecurrence.Rule(anchor: "2027-03-15T10:00:00.123", frequency: "daily",
            zoneID: "UTC", endExclusive: "2027-03-16T10:00:00.124")
        let exact = try RemiloIOSGoogleCalendarRule.schedule(fractional)
        let decoded = try RemiloIOSGoogleCalendarRule.decode(exact.recurrence!, anchor: fractional.anchor,
            startMs: exact.eventStartMs, zoneID: "UTC", zone: utc, allDay: false, duration: fractional.endOffsetMs)
        let slots = try RemiloIOSRecurrence.future(decoded.rule, afterMs: -1, deviceZone: utc, mode: "None", limit: 3)
        precondition(slots.count == 2 && slots[1].nominalSlot == "2027-03-16T10:00:00.123")
    }

    @MainActor
    private final class Fixture {
        static let master = "series-master"
        static let child = "moved-child"
        static let updatedETag = #""series-v2""#
        private let directory: URL
        private let editsSchedule: Bool
        let calendar: [String: String]
        var allowCheckpoint = false
        var reveal = false
        var acknowledgedSchedule = false
        var childMaster = Fixture.master
        private(set) var revealedAuditCount = 0
        private(set) var writes = 0

        init(directory: URL, email: String, editsSchedule: Bool) {
            self.directory = directory
            self.editsSchedule = editsSchedule
            calendar = ["id": "series-calendar", "summary": "Remilo", "timeZone": "UTC", "accessRole": "owner", "dataOwner": email]
        }

        private func body(_ value: [String: Any], status: Int = 200) throws -> HTTP.Response {
            .init(status: status, body: try JSONSerialization.data(withJSONObject: value))
        }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            let url = request.url!
            let moved = editsSchedule && writes > 0
            let start = ["dateTime": moved ? "2027-03-15T11:00:00Z" : "2027-03-15T10:00:00Z", "timeZone": "UTC"]
            let end = ["dateTime": moved ? "2027-03-15T11:45:00Z" : "2027-03-15T10:30:00Z", "timeZone": "UTC"]
            let updatedRule = "RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;WKST=MO;COUNT=1"
            let master: [String: Any] = ["id": Self.master, "etag": writes == 0 ? #""series-v1""# : Self.updatedETag,
                "summary": writes == 0 || editsSchedule ? "Original title" : "Remilo edit", "description": "Original notes",
                "start": start, "end": end, "recurrence": [moved ? updatedRule : "RRULE:FREQ=DAILY;COUNT=1"]]
            if request.httpMethod == "PATCH" {
                precondition(url.lastPathComponent == Self.master && writes == 0 && request.value(forHTTPHeaderField: "If-Match") == #""series-v1""#)
                let stored = try String(contentsOf: directory.appendingPathComponent("series-text-writes.json"), encoding: .utf8)
                precondition(stored.contains(Self.master), "Checkpoint must already be durable when the PATCH leaves")
                let payload = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
                if editsSchedule {
                    precondition(Set(payload.keys) == ["start", "end", "recurrence"] &&
                                 (payload["start"] as? [String: String])?["dateTime"] == "2027-03-15T11:00:00Z" &&
                                 (payload["end"] as? [String: String])?["dateTime"] == "2027-03-15T11:45:00Z" &&
                                 payload["recurrence"] as? [String] == [updatedRule])
                } else {
                    precondition(payload as? [String: String] == ["summary": "Remilo edit"], "Preserve recurrence, notes, and delivery settings")
                }
                writes += 1
                return try body([:], status: 503)
            }
            if url.path.contains("/calendarList/") { return try body(calendar) }
            if url.lastPathComponent == "instances" {
                if reveal { revealedAuditCount += 1 }
                return try body(["items": [["id": "original-instance", "recurringEventId": Self.master,
                    "originalStartTime": start, "start": start, "end": end]]])
            }
            if url.lastPathComponent == "events" {
                let changed = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains { $0.name == "syncToken" } == true
                return try body(["items": changed ? [] : [master], "nextSyncToken": "checkpoint"])
            }
            if url.lastPathComponent == Self.child {
                return try body(["id": Self.child, "etag": #""child-v1""#, "recurringEventId": childMaster,
                    "originalStartTime": start, "summary": "Moved", "start": ["dateTime": "2027-03-15T14:00:00Z", "timeZone": "UTC"],
                    "end": ["dateTime": "2027-03-15T14:30:00Z", "timeZone": "UTC"]])
            }
            precondition(url.lastPathComponent == Self.master)
            if writes > 0 && !reveal { return try body([:], status: 503) }
            return try body(master)
        }
    }
}
