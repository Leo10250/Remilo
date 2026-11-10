import Foundation

@MainActor
enum SeriesTextWriterChecks {
    private typealias Service = RemiloIOSGoogleCalendarSeriesTextWriter
    private typealias Inbox = RemiloIOSGoogleCalendarManagedInbox
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    readOnly: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date,
                    editsSchedule: Bool = false, editsInstance: Bool = false, resumes: Bool = false) async throws {
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
        let policy = Inbox.Journal.Policy(importMode: .none)
        let managed = Inbox.Journal(directory: directory, now: clock)
        let setup = RemiloIOSGoogleCalendarManagedSetup(connection: connection, journal: managed, canUseForeground: { true }, now: now) { _, _ in
            preconditionFailure("An existing calendar uses the saved grant")
        }
        let scope: Inbox.Scope
        if resumes {
            let preview = try await setup.preview(expectedRevision: granted.revision, policy: policy, zoneID: "UTC")
            guard let review = preview.review else { preconditionFailure("Adopt the owned calendar") }
            let id = UUID()
            _ = try setup.capture(id, reviewID: review.id, expectedRevision: granted.revision, selectedCalendarID: binding.record.id)
            _ = try await setup.advance(id, expectedRevision: granted.revision)
            scope = try managed.incomingScope(account)
        } else {
            scope = .init(binding: binding, policy: policy)
        }
        let lease = scope.binding.linkLease
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
        if resumes {
            try await resumeChecks(fixture, directory: directory, connection: connection, imports: imports, setup: setup,
                                   managed: managed, account: account, receipt: imported, source: review.source, prior: scope)
            return
        }
        if editsInstance {
            try await instanceSync(fixture, directory: directory, connection: connection, imports: imports, account: account,
                                   scope: scope, master: review.source, importID: id, access: access, readOnly: readOnly)
            return
        }
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
            try await instanceWrite(fixture, account: account, lease: lease, access: access, readOnly: readOnly, now: now)
        }
    }

    private static func resumeChecks(_ fixture: Fixture, directory: URL, connection: Service.Runtime.Connection, imports: Service.Journal,
                                     setup: RemiloIOSGoogleCalendarManagedSetup, managed: Inbox.Journal,
                                     account: Service.Account, receipt: Service.Journal.Receipt, source: Service.Import.Source,
                                     prior: Inbox.Scope) async throws {
        let revision = account.connectionRevision
        let family = receipt.local!.id
        fixture.localSeries = .init(familyID: family, segmentID: family, revision: 1, title: source.fields.title, notes: source.fields.notes)
        func runtime() -> Service.Runtime {
            .init(connection: connection, canUseForeground: { true }, importJournal: .init(directory: directory),
                  scheduler: .init(receipt: { _ in nil }, create: { _, _ in preconditionFailure("Resume never copies an imported series") }),
                  managedSetupJournal: managed, seriesText: .init(
                    read: { $0 == family ? fixture.localSeries : nil },
                    apply: { _, snapshot, title, notes, allows in
                        guard try allows(), fixture.localSeries == snapshot else { return false }
                        fixture.localSeries = .init(familyID: family, segmentID: family, revision: snapshot.revision + 1,
                                                    title: title, notes: notes)
                        return true
                    }, permit: { _, _ in preconditionFailure("Resume never sends a PATCH") },
                    resumePermit: { snapshot, checkpoint in
                        guard snapshot == fixture.localSeries else { return nil }
                        return try await checkpoint()
                    })) { _, _ in preconditionFailure("Resume uses the saved grant") }
        }
        func pause() throws {
            let view = try setup.view(expectedRevision: revision)
            _ = try setup.changeMode(.paused, operationID: UUID(), expectedRevision: view.bindingRevision, expectedConnectionRevision: revision)
        }
        func confirm(_ reviewID: UUID, items: [String], runtime: Service.Runtime) async throws {
            _ = try await setup.confirmResume(UUID(), reviewID: reviewID, selectedItemIDs: items, expectedRevision: revision,
                validateSeries: runtime.validateHeldSeries) { _, _, _ in }
        }

        _ = try await setup.scanIncoming(expectedRevision: revision)
        try pause()
        let first = runtime()
        let skipped = try await setup.previewResume(expectedRevision: revision, series: first.reviewHeldSeries) { _, _ in [] }
        precondition(skipped.series.count == 1 && skipped.series[0].approval != nil)
        try await confirm(skipped.review.id, items: [], runtime: first)
        let skippedPass = try await runtime().syncManagedIncoming(expectedRevision: revision)
        let skippedScope = try managed.incomingScope(account)
        let skippedExports = try await imports.seriesTextExports(viewingAs: account, lease: skippedScope.binding.linkLease)
        let skippedSummary = try await runtime().savedSyncSummary()
        precondition(skippedPass.resumedSeries == 0 && skippedExports.isEmpty && skippedSummary.automatic == 0,
                     "An unselected series keeps its original lease")

        try pause()
        fixture.resumeTitle = "Changed in Google"
        fixture.resumeETag = #""resume-v2""#
        let current = runtime()
        let reviewed = try await setup.previewResume(expectedRevision: revision, series: current.reviewHeldSeries) { _, _ in [] }
        precondition(reviewed.series[0].inbound == ["title"] && reviewed.series[0].approval != nil)
        fixture.resumeETag = #""resume-v3""#
        do {
            try await confirm(reviewed.review.id, items: [reviewed.series[0].itemID], runtime: current)
            preconditionFailure("A changed master version must return to review")
        } catch Service.Import.Failure.stalePreview {}
        fixture.resumeETag = #""resume-v2""#
        try await confirm(reviewed.review.id, items: [reviewed.series[0].itemID], runtime: current)
        let resumed = try await runtime().syncManagedIncoming(expectedRevision: revision)
        let active = try managed.incomingScope(account)
        let exports = try await imports.seriesTextExports(viewingAs: account, lease: active.binding.linkLease)
        let original = try await imports.seriesTextExports(viewingAs: account, lease: prior.binding.linkLease)
        precondition(resumed.resumedSeries == 1 && resumed.updatedSeries == 1 && resumed.imported == 0 &&
                     original.isEmpty && exports.first?.receipt == receipt && exports.first?.baseline.etag == fixture.resumeETag &&
                     fixture.localSeries?.title == fixture.resumeTitle && fixture.writes == 0)
        let repeated = try await runtime().syncManagedIncoming(expectedRevision: revision)
        let activeSummary = try await runtime().savedSyncSummary()
        precondition(repeated.resumedSeries == 0 && repeated.updatedSeries == 0 && fixture.localSeries?.revision == 2 &&
                     activeSummary.automatic == 1 && activeSummary.reminderReview == 0)
    }

    private static func instanceSync(_ fixture: Fixture, directory: URL, connection: Service.Runtime.Connection,
                                     imports: Service.Journal, account: Service.Account, scope: Inbox.Scope,
                                     master: Service.Import.Source, importID: UUID, access: RemiloIOSGoogleCalendarAccess,
                                     readOnly: RemiloIOSGoogleCalendarAccess) async throws {
        fixture.resolveChild = true
        fixture.googleChildNotes = "Google added notes"
        let lease = scope.binding.linkLease
        let series = IOSCalendarSeriesTextSnapshot(familyID: "family", segmentID: "family", revision: 1,
            title: master.fields.title, notes: master.fields.notes)
        let start = try RemiloIOSGoogleCalendarEvent.timestamp("2027-03-15T14:00:00Z")
        let baseline = IOSCalendarSeriesInstanceEdit.Fields(title: "Moved", notes: "", eventStartMs: start,
            eventEndMs: start + 1_800_000, allDay: false, zoneID: "UTC")
        let desired = IOSCalendarSeriesInstanceEdit.Fields(title: "Edited occurrence", notes: "", eventStartMs: start + 3_600_000,
            eventEndMs: start + 5_400_000, allDay: false, zoneID: "UTC")
        let edit = IOSCalendarSeriesInstanceEdit(series: series, occurrenceID: "occurrence", nominalSlot: "2027-03-15T10:00",
            knownEventID: nil, revision: 2, generation: 1, baseline: baseline, desired: desired)
        fixture.instanceEdit = edit
        func service() -> Service {
            .init(directory: directory, connection: connection, imports: imports, local: .init(read: { _ in series },
                apply: { _, _, _, _, _ in preconditionFailure("Expected only occurrence work") },
                permit: { _, _ in preconditionFailure("The master has no local edit") },
                instanceExport: .init(read: { _, _ in fixture.instanceEdit.map { [$0] } ?? [] },
                    permit: { current, checkpoint in
                        guard fixture.allowCheckpoint, fixture.instanceEdit == current else { return nil }
                        return try checkpoint()
                    }, acknowledge: { confirmation, permits in
                        guard try permits(), fixture.allowInstanceAcknowledgement else { return .deferred }
                        precondition(confirmation.edit == edit && confirmation.eventID == Fixture.child &&
                                     confirmation.fields.title == desired.title && confirmation.fields.notes == fixture.googleChildNotes &&
                                     confirmation.fields.eventStartMs == desired.eventStartMs)
                        fixture.confirmedInstance = confirmation.fields
                        fixture.instanceEdit = nil
                        return .applied
                    })), canRead: { true },
                activeLease: { !fixture.seriesHeld && $0.accountGeneration == account.accountGeneration ? lease : nil },
                heldLease: { fixture.seriesHeld && $0.accountGeneration == account.accountGeneration ? lease : nil })
        }
        let writer = service()
        _ = try await writer.sync(expectedRevision: account.connectionRevision)
        precondition(fixture.childWrites == 0)
        fixture.allowCheckpoint = true
        _ = try await writer.sync(expectedRevision: account.connectionRevision)
        let pending = try writer.unconfirmedImports(viewingAs: account)
        precondition(pending == [importID] && fixture.childWrites == 1 && fixture.confirmedInstance == nil)
        let observation = Inbox.Observation(eventID: Fixture.child, etag: #""child-v2""#, kind: .changedInstance(masterID: Fixture.master),
            importMode: .none, initialRecovery: false, instanceCancelled: false)
        let scan = Inbox.Progress(scope: scope, pages: 1, initialComplete: true, continuation: false, pending: [observation])
        let waiting = try await imports.reconcileManagedSeries(scan, viewingAs: account, limit: 2, allowInstanceTransfers: true, waitingExports: pending)
        precondition(waiting.isEmpty)
        fixture.revealChildWrite = true
        let renewed = try await connection.connectFromUserAction(expectedRevision: account.connectionRevision, consent: .reauthorizeCurrentAccount) { _, _ in readOnly }
        fixture.seriesHeld = true
        fixture.allowInstanceAcknowledgement = true
        let paused = service()
        _ = try await paused.sync(expectedRevision: renewed.revision)
        let held = try paused.unconfirmedImports(viewingAs: account)
        precondition(held == [importID] && fixture.childWrites == 1 && fixture.confirmedInstance == nil)
        fixture.seriesHeld = false
        fixture.allowInstanceAcknowledgement = false
        _ = try await service().sync(expectedRevision: renewed.revision)
        let beforeNative = try await imports.seriesTextExports(viewingAs: account, lease: lease)
        precondition(beforeNative.first?.exceptions.isEmpty == true && fixture.childWrites == 1)
        fixture.allowInstanceAcknowledgement = true
        let resumed = service()
        let confirmed = try await resumed.sync(expectedRevision: renewed.revision)
        let remaining = try resumed.unconfirmedImports(viewingAs: account)
        let saved = try await imports.seriesTextExports(viewingAs: account, lease: lease)
        precondition(confirmed && remaining.isEmpty && fixture.confirmedInstance != nil && fixture.childWrites == 1)
        precondition(saved.first?.exceptions.first?.identity.nominalSlot == edit.nominalSlot &&
                     saved.first?.exceptions.first?.etag == observation.etag)
        let acknowledged = try await imports.reconcileManagedSeries(scan, viewingAs: account, limit: 2, allowInstanceTransfers: true)
        precondition(acknowledged.count == 1 && acknowledged[0].instanceWork == nil && !acknowledged[0].recordedIssue)
        let previous = fixture.confirmedInstance!
        fixture.instanceEdit = .init(series: series, occurrenceID: edit.occurrenceID, nominalSlot: edit.nominalSlot,
            knownEventID: Fixture.child, revision: 3, generation: 1, baseline: previous,
            desired: .init(title: "Second local title", notes: previous.notes, eventStartMs: previous.eventStartMs,
                           eventEndMs: previous.eventEndMs, allDay: false, zoneID: "UTC"))
        fixture.googleChildTitle = "Another title from Google"
        let writable = try await connection.connectFromUserAction(expectedRevision: renewed.revision, consent: .writeOwnedEvents) { _, _ in access }
        let reviewed = try await resumed.sync(expectedRevision: writable.revision)
        let conflicts = try await imports.seriesTextExports(viewingAs: account, lease: lease)
        precondition(reviewed && conflicts.isEmpty && fixture.childWrites == 1 && fixture.instanceEdit != nil)
    }

    private static func instanceWrite(_ fixture: Fixture, account: Service.Account, lease: Service.Lease,
                                      access: RemiloIOSGoogleCalendarAccess, readOnly: RemiloIOSGoogleCalendarAccess,
                                      now: @escaping @Sendable () -> Date) async throws {
        let writer = Service.Writer(http: .init(send: { request, _, _ in try await fixture.send(request) }), now: now)
        fixture.resolveChild = true
        func resolve() async throws -> Service.Writer.InstanceObservation {
            try await writer.resolveInstance(access: access, lease: lease, masterID: Fixture.master,
                                             masterETag: Fixture.updatedETag, nominalSlot: "2027-03-15T10:00")
        }
        do {
            _ = try await resolve()
            preconditionFailure("An occurrence from a different series cannot be captured")
        } catch RemiloIOSGoogleCalendarEvent.Reason.invalidInstance {}
        fixture.childMaster = Fixture.master
        let observed = try await resolve()
        precondition(observed.identity.eventID == Fixture.child && observed.originalStart == "2027-03-15T10:00:00Z")
        let later = Service.Writer.Event.Schedule(eventStartMs: observed.fields.schedule.eventStartMs + 3_600_000,
            eventEndMs: observed.fields.schedule.eventEndMs + 3_600_000, allDay: false, zoneId: "UTC", recurrence: nil)
        let patch = try Service.Writer.Patch(instance: UUID(), account: account,
            local: .init(occurrenceID: "occurrence", revision: 2, generation: 1), observed: observed, lease: lease,
            desired: .init(title: "Edited occurrence", notes: observed.fields.notes, schedule: later))
        fixture.wrongChildSlot = true
        let wrongSlot = try await writer.patch(patch, access: access, phase: .notSent) { _ in
            preconditionFailure("The original slot has changed")
        }
        guard case .staleRemote = wrongSlot else { preconditionFailure("Expected stale child identity") }
        fixture.wrongChildSlot = false
        fixture.staleChildMaster = true
        let wrongMasterVersion = try await writer.patch(patch, access: access, phase: .notSent) { _ in
            preconditionFailure("The parent changed after capture")
        }
        guard case .staleRemote = wrongMasterVersion else { preconditionFailure("Expected stale master") }
        fixture.staleChildMaster = false
        fixture.staleChildVersion = true
        let wrongChildVersion = try await writer.patch(patch, access: access, phase: .notSent) { _ in
            preconditionFailure("The child changed after capture")
        }
        guard case .staleRemote = wrongChildVersion else { preconditionFailure("Expected stale child version") }
        fixture.staleChildVersion = false
        let unconfirmed = try await writer.patch(patch, access: access, phase: .notSent) { _ in .granted }
        guard case .unconfirmed = unconfirmed else { preconditionFailure("Expected a lost response") }
        fixture.revealChildWrite = true
        let confirmed = try await writer.patch(patch, access: readOnly, phase: .sent) { _ in
            preconditionFailure("An uncertain PATCH can only be read back")
        }
        guard case .confirmed(let remote) = confirmed else { preconditionFailure("Expected a matching child readback") }
        precondition(remote.id == Fixture.child && remote.strongETag == #""child-v2""# && fixture.childWrites == 1 && fixture.writes == 1)
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
        var resolveChild = false
        var wrongChildSlot = false
        var staleChildMaster = false
        var staleChildVersion = false
        var revealChildWrite = false
        var instanceEdit: IOSCalendarSeriesInstanceEdit?
        var confirmedInstance: IOSCalendarSeriesInstanceEdit.Fields?
        var allowInstanceAcknowledgement = false
        var seriesHeld = false
        var googleChildNotes: String?
        var googleChildTitle: String?
        var localSeries: IOSCalendarSeriesTextSnapshot?
        var resumeTitle: String?
        var resumeETag: String?
        private(set) var childWrites = 0
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
            let master: [String: Any] = ["id": Self.master, "etag": resumeETag ?? (writes == 0 ? #""series-v1""# : (staleChildMaster ? #""series-v3""# : Self.updatedETag)),
                "summary": resumeTitle ?? (writes == 0 || editsSchedule ? "Original title" : "Remilo edit"), "description": "Original notes",
                "start": start, "end": end, "recurrence": [moved ? updatedRule : "RRULE:FREQ=DAILY;COUNT=1"]]
            let childETag = googleChildTitle != nil ? #""child-v3""# : (staleChildVersion || revealChildWrite ? #""child-v2""# : #""child-v1""#)
            var child: [String: Any] = ["id": Self.child, "etag": childETag,
                "recurringEventId": childMaster,
                "originalStartTime": wrongChildSlot ? ["dateTime": "2027-03-16T10:00:00Z", "timeZone": "UTC"] : start,
                "summary": googleChildTitle ?? (revealChildWrite ? "Edited occurrence" : "Moved"),
                "start": ["dateTime": revealChildWrite ? "2027-03-15T15:00:00Z" : "2027-03-15T14:00:00Z", "timeZone": "UTC"],
                "end": ["dateTime": revealChildWrite ? "2027-03-15T15:30:00Z" : "2027-03-15T14:30:00Z", "timeZone": "UTC"]]
            child["description"] = googleChildNotes
            if request.httpMethod == "PATCH" {
                if url.lastPathComponent == Self.child {
                    precondition(childWrites == 0 && request.value(forHTTPHeaderField: "If-Match") == #""child-v1""#)
                    if instanceEdit != nil {
                        let stored = try String(contentsOf: directory.appendingPathComponent("series-text-writes.json"), encoding: .utf8)
                        precondition(stored.contains(Self.child))
                    }
                    let payload = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
                    precondition(Set(payload.keys) == ["summary", "start", "end"] &&
                                 payload["summary"] as? String == "Edited occurrence" &&
                                 (payload["start"] as? [String: String])?["dateTime"] == "2027-03-15T15:00:00Z" &&
                                 (payload["end"] as? [String: String])?["dateTime"] == "2027-03-15T15:30:00Z")
                    childWrites += 1
                    return try body([:], status: 503)
                }
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
            if url.lastPathComponent == "calendarList" { return try body(["items": [calendar]]) }
            if url.lastPathComponent == "instances" {
                if resolveChild {
                    let original = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "originalStart" }?.value
                    precondition(original == "2027-03-15T10:00:00Z")
                    return try body(["items": [child]])
                }
                if reveal { revealedAuditCount += 1 }
                return try body(["items": [["id": "original-instance", "recurringEventId": Self.master,
                    "originalStartTime": start, "start": start, "end": end]]])
            }
            if url.lastPathComponent == "events" {
                let changed = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains { $0.name == "syncToken" } == true
                return try body(["items": changed ? [] : [master], "nextSyncToken": "checkpoint"])
            }
            if url.lastPathComponent == Self.child {
                if childWrites > 0 && !revealChildWrite { return try body([:], status: 503) }
                return try body(child)
            }
            precondition(url.lastPathComponent == Self.master)
            if writes > 0 && !reveal { return try body([:], status: 503) }
            return try body(master)
        }
    }
}
