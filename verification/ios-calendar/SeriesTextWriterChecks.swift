import Foundation

@MainActor
enum SeriesTextWriterChecks {
    private typealias Service = RemiloIOSGoogleCalendarSeriesTextWriter
    private typealias Inbox = RemiloIOSGoogleCalendarManagedInbox
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    readOnly: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-series-write-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = Fixture(directory: directory, email: access.account.email)
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
        let snapshot = IOSCalendarSeriesTextSnapshot(familyID: local.id, segmentID: "replacement", revision: 1,
                                                     title: "Remilo edit", notes: review.source.fields.notes)
        func service() -> Service {
            .init(directory: directory, connection: connection, imports: imports,
                  local: .init(read: { $0 == snapshot.familyID ? snapshot : nil }, apply: { _, _, _, _, _ in
                      preconditionFailure("Outbound sync does not edit local reminders")
                  }, permit: { current, checkpoint in
                      guard fixture.allowCheckpoint && current == snapshot else { return nil }
                      return try checkpoint()
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
    }

    @MainActor
    private final class Fixture {
        static let master = "series-master"
        static let updatedETag = #""series-v2""#
        private let directory: URL
        let calendar: [String: String]
        var allowCheckpoint = false
        var reveal = false
        private(set) var writes = 0

        init(directory: URL, email: String) {
            self.directory = directory
            calendar = ["id": "series-calendar", "summary": "Remilo", "timeZone": "UTC", "accessRole": "owner", "dataOwner": email]
        }

        private func body(_ value: [String: Any], status: Int = 200) throws -> HTTP.Response {
            .init(status: status, body: try JSONSerialization.data(withJSONObject: value))
        }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            let url = request.url!
            let start = ["dateTime": "2027-03-15T10:00:00Z", "timeZone": "UTC"]
            let end = ["dateTime": "2027-03-15T10:30:00Z", "timeZone": "UTC"]
            let master: [String: Any] = ["id": Self.master, "etag": writes == 0 ? #""series-v1""# : Self.updatedETag,
                "summary": writes == 0 ? "Original title" : "Remilo edit", "description": "Original notes",
                "start": start, "end": end, "recurrence": ["RRULE:FREQ=DAILY;COUNT=1"]]
            if request.httpMethod == "PATCH" {
                precondition(url.lastPathComponent == Self.master && writes == 0 && request.value(forHTTPHeaderField: "If-Match") == #""series-v1""#)
                let stored = try String(contentsOf: directory.appendingPathComponent("series-text-writes.json"), encoding: .utf8)
                precondition(stored.contains(Self.master), "Checkpoint must already be durable when the PATCH leaves")
                let payload = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: String]
                precondition(payload == ["summary": "Remilo edit"], "Preserve recurrence, notes, and delivery settings")
                writes += 1
                return try body([:], status: 503)
            }
            if url.path.contains("/calendarList/") { return try body(calendar) }
            if url.lastPathComponent == "instances" {
                return try body(["items": [["id": "original-instance", "recurringEventId": Self.master,
                    "originalStartTime": start, "start": start, "end": end]]])
            }
            if url.lastPathComponent == "events" {
                let changed = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains { $0.name == "syncToken" } == true
                return try body(["items": changed ? [] : [master], "nextSyncToken": "checkpoint"])
            }
            precondition(url.lastPathComponent == Self.master)
            if writes > 0 && !reveal { return try body([:], status: 503) }
            return try body(master)
        }
    }
}
