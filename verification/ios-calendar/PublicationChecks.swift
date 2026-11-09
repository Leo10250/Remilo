import Foundation

enum PublicationChecks {
    private typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    private typealias Publication = RemiloIOSGoogleCalendarPublication
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private static let calendar = "owned/id@example.test"
    private static let zone = "America/Los_Angeles"

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration,
                    access: RemiloIOSGoogleCalendarAccess, readOnly: RemiloIOSGoogleCalendarAccess,
                    now: @escaping @Sendable () -> Date) async throws {
        let request = try makeRequest(access)
        precondition(request.eventID == "93ef9c833ce630dbb744728da6abc718")
        let replay = try JSONDecoder().decode(Publication.Request.self, from: JSONEncoder().encode(request))
        let firstFingerprint = try request.fingerprint()
        let replayFingerprint = try replay.fingerprint()
        precondition(replay == request && replayFingerprint == firstFingerprint)
        let anotherOperation = try makeRequest(access)
        precondition(anotherOperation.operationID != request.operationID && anotherOperation.eventID == request.eventID)

        let noPermit = Fixture(.missing, request: request)
        do {
            _ = try await writer(noPermit, now).publish(request, access: readOnly, phase: .notSent) { _ in
                preconditionFailure("Read-only access must not reach the send checkpoint")
            }
            preconditionFailure("Read-only access must not authorize a POST")
        } catch RemiloIOSGoogleCalendarFailure.needsAccess {}
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

        try await patchChecks(request: request, access: access, readOnly: readOnly, now: now)
        try await journalChecks(request: request, readOnly: readOnly, now: now)
        try await runtimeChecks(configuration: configuration, request: request, access: access, readOnly: readOnly, now: now)
        try await manualTransferChecks(configuration: configuration, request: request, access: access, readOnly: readOnly, now: now)
        try await manualTransferChecks(configuration: configuration, request: request, access: access, readOnly: readOnly,
                                       now: now, superseding: true)
        let allDay = try Event.fields(["start": ["date": "2027-03-14"], "end": ["date": "2027-03-15"]], calendarZone: zone)
        let bounds = try Publication.Bounds(allDay.fields.schedule)
        precondition(bounds.start.date == "2027-03-14" && bounds.end.date == "2027-03-15" && bounds.end.dateTime == nil)
    }

    @MainActor
    private static func manualTransferChecks(
        configuration: RemiloIOSGoogleCalendarConfiguration, request: Publication.Request,
        access: RemiloIOSGoogleCalendarAccess, readOnly: RemiloIOSGoogleCalendarAccess, now: @escaping @Sendable () -> Date,
        superseding: Bool = false
    ) async throws {
        typealias Manual = RemiloIOSGoogleCalendarManualLinkRuntime
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-manual-transfer-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let fixture = Fixture(.manualTransfer, request: request)
        try await fixture.seedManualTransfer()
        let http = HTTP(send: { wire, _, _ in try await fixture.send(wire) })
        let connection = Manual.Connection(configuration: configuration, store: .init(directory: path), http: http, now: now)
        let clock: @Sendable () -> Int64 = { Int64(now().timeIntervalSince1970 * 1_000) }
        let journal = RemiloIOSGoogleCalendarPublicationJournal(directory: path, now: clock)
        let published = try journal.capture(request, reviewFingerprint: request.fingerprint().base64EncodedString(), calendarName: "Owned")
        _ = try journal.record(published.identity, outcome: .confirmed(.init(eventID: request.eventID, etag: nil, htmlLink: nil, remoteDiffers: false)))
        let publication = Manual.Publication(connection: connection, journal: journal,
                                              local: .init(read: { _ in nil }, permit: { _, _ in .denied(.invalidInput) }),
                                              canUseForeground: { true })
        let localFields = Event.Fields(title: "Local title", notes: request.fields.notes, schedule: request.fields.schedule)
        let source = Manual.Publication.LocalSnapshot(version: request.local, fields: localFields)
        let local = RuntimeLocal(source)
        let authority = Manual.LocalAuthority(read: { _ in local.snapshot }, permit: { snapshot, commit in
            guard local.snapshot == snapshot else { throw Manual.Link.Failure.stalePreview }
            let result = try commit()
            if case .send(.granted) = result { _ = await fixture.permit() }
            return result
        }, receipt: { transfer in local.manualReceipts[transfer.operationID] }, apply: { transfer, authorize in
            guard try authorize(), local.snapshot == transfer.local else { throw Manual.Link.Failure.stalePreview }
            precondition(local.manualReceipts.isEmpty && transfer.needsLocal && transfer.needsRemote)
            let version = Publication.Local(occurrenceID: transfer.occurrenceID, revision: transfer.local.version.revision + 1,
                                            generation: transfer.local.version.generation)
            let snapshot = Manual.Publication.LocalSnapshot(version: version, fields: transfer.desired)
            local.snapshot = snapshot
            local.manualReceipts[transfer.operationID] = .init(snapshot: snapshot, status: "Scheduled")
            throw RemiloIOSGoogleCalendarFailure.network // Engine commit survived the interrupted response.
        })
        func newRuntime() -> Manual {
            Manual(connection: connection, publication: publication, imports: .init(directory: path),
                   store: .init(directory: path), local: authority, canUseForeground: { true }, now: clock)
        }
        let runtime = newRuntime()
        let read = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in readOnly }
        let readPreview = try await runtime.preview(source.version.occurrenceID, expectedConnectionRevision: read.revision)
        let choices: [Manual.Link.Comparison.Group: Manual.Link.Comparison.Side] = [.title: .remilo, .notes: .google]
        do {
            _ = try await runtime.resolve(operationID: UUID(), reviewID: readPreview.id, expectedConnectionRevision: read.revision,
                                          choices: choices, updating: false)
            preconditionFailure("Read-only consent cannot start a two-sided transfer")
        } catch Manual.Failure.needsAccess {}
        let write = try await connection.connectFromUserAction(expectedRevision: read.revision, consent: .writeOwnedEvents) { _, _ in access }
        let review = try await runtime.preview(source.version.occurrenceID, expectedConnectionRevision: write.revision)
        let operation = UUID()
        do {
            _ = try await runtime.resolve(operationID: operation, reviewID: review.id, expectedConnectionRevision: write.revision,
                                          choices: choices, updating: false)
            preconditionFailure("The first local response is lost")
        } catch Manual.Failure.network {}
        let waiting = try runtime.transferOperation(operation, expectedConnectionRevision: write.revision)
        let unsentWrites = await fixture.writes
        precondition(waiting?.phase == .waiting && unsentWrites == 0 && local.manualReceipts.count == 1)
        let sent = try await newRuntime().retry(operation, expectedConnectionRevision: write.revision)
        precondition(sent.phase == .sent && sent.localApplied && sent.remoteAttempted && sent.localStatus == "Scheduled")
        precondition(local.snapshot?.fields.notes == "Google note")
        let stillUnknown = try await newRuntime().retry(operation, expectedConnectionRevision: write.revision)
        precondition(stillUnknown.phase == .sent)
        if superseding {
            do {
                _ = try await runtime.preview(source.version.occurrenceID, expectedConnectionRevision: write.revision, superseding: operation)
                preconditionFailure("An unchanged ETag must keep the original request reserved")
            } catch Manual.Store.Rejection.operationPending {}
            try await fixture.changeRemoteTag()
            let previous = local.snapshot!.version
            local.snapshot = .init(version: .init(occurrenceID: previous.occurrenceID, revision: previous.revision + 1,
                                                  generation: previous.generation),
                                   fields: .init(title: request.fields.title, notes: "Google note", schedule: request.fields.schedule))
            let fresh = try await runtime.preview(source.version.occurrenceID, expectedConnectionRevision: write.revision, superseding: operation)
            precondition(fresh.supersedingOperationID == operation)
            try await fixture.changeRemoteTag(#""newer""#)
            do {
                _ = try await runtime.resolve(operationID: UUID(), reviewID: fresh.id, expectedConnectionRevision: write.revision,
                                              choices: [:], updating: false)
                preconditionFailure("Stale confirmation must leave the original operation reserved")
            } catch Manual.Link.Failure.staleRemote {}
            let reserved = try runtime.transferOperation(operation, expectedConnectionRevision: write.revision)
            precondition(reserved?.phase == .sent)
            let current = try await runtime.preview(source.version.occurrenceID, expectedConnectionRevision: write.revision, superseding: operation)
            let confirmed = try await runtime.resolve(operationID: UUID(), reviewID: current.id,
                                                      expectedConnectionRevision: write.revision, choices: [:], updating: false)
            let retired = try await newRuntime().retry(operation, expectedConnectionRevision: write.revision)
            let writes = await fixture.writes
            precondition(confirmed.phase == .confirmed && confirmed.resultLinkRevision == 1)
            precondition(retired.phase == .cancelled && retired.reason == "SUPERSEDED" && retired.remoteAttempted && writes == 1)
            return
        }
        try await fixture.completeManualTransfer()
        let refreshed = try await connection.connectFromUserAction(expectedRevision: write.revision, consent: .reauthorizeCurrentAccount) { _, _ in readOnly }
        let verified = try await newRuntime().retry(operation, expectedConnectionRevision: refreshed.revision)
        let savedLinks = try runtime.links(expectedConnectionRevision: refreshed.revision)
        let writes = await fixture.writes
        precondition(verified.phase == .confirmed && verified.resultLinkRevision == nil && savedLinks.isEmpty && writes == 1)
        precondition(verified.transfer == nil && local.manualReceipts.count == 1)
    }

    @MainActor
    private static func runtimeChecks(configuration: RemiloIOSGoogleCalendarConfiguration, request: Publication.Request,
                                      access: RemiloIOSGoogleCalendarAccess, readOnly: RemiloIOSGoogleCalendarAccess,
                                      now: @escaping @Sendable () -> Date) async throws {
        typealias Runtime = RemiloIOSGoogleCalendarPublicationRuntime
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-publication-runtime-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let fixture = Fixture(.missing, request: request)
        let http = HTTP(send: { wire, _, _ in try await fixture.send(wire) })
        let connection = Runtime.Connection(configuration: configuration, store: .init(directory: path), http: http, now: now)
        let clock: @Sendable () -> Int64 = { Int64(now().timeIntervalSince1970 * 1_000) }
        let snapshot = Runtime.LocalSnapshot(version: request.local, fields: request.fields)
        let local = RuntimeLocal(snapshot)
        let authority = Runtime.LocalAuthority(read: { _ in local.snapshot }, permit: { expected, checkpoint in
            if local.invalidateAtPermit {
                local.snapshot = nil
                local.invalidateAtPermit = false
            }
            guard local.snapshot == expected else { throw Runtime.Rejection.stalePreview }
            let result = try checkpoint()
            if case .granted = result { _ = await fixture.permit() }
            return result
        })
        func newRuntime() -> Runtime {
            Runtime(connection: connection, journal: .init(directory: path, now: clock), local: authority,
                    canUseForeground: { true }, now: clock)
        }
        let runtime = newRuntime()
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in readOnly }
        let selected = try await runtime.selectDestination(calendar, operationID: UUID(), expectedConnectionRevision: connected.revision)
        let preview = try runtime.preview(occurrenceID: request.local.occurrenceID, expectedConnectionRevision: selected)
        func confirm(_ preview: Runtime.Preview, id: UUID = UUID()) async throws -> Runtime.Journal.Entry {
            try await runtime.confirm(operationID: id, occurrenceID: request.local.occurrenceID,
                                      expectedLocalRevision: request.local.revision, expectedConnectionRevision: preview.account.connectionRevision,
                                      fingerprint: preview.fingerprint)
        }
        do {
            _ = try await confirm(preview)
            preconditionFailure("A review with read access cannot authorize a write")
        } catch Runtime.Failure.needsAccess {}
        let granted = try await connection.connectFromUserAction(expectedRevision: selected, consent: .writeOwnedEvents) { _, _ in access }
        let reviewed = try runtime.preview(occurrenceID: request.local.occurrenceID, expectedConnectionRevision: granted.revision)
        local.invalidateAtPermit = true
        let cancelled = try await confirm(reviewed)
        let noWrites = await fixture.writes
        precondition(cancelled.phase == .cancelled && noWrites == 0)
        local.snapshot = snapshot
        let fresh = try runtime.preview(occurrenceID: request.local.occurrenceID, expectedConnectionRevision: granted.revision)
        let sent = try await confirm(fresh)
        precondition(sent.phase == .sent && sent.confirmation == nil)
        let replay = try await newRuntime().confirm(operationID: sent.identity.operationID, occurrenceID: request.local.occurrenceID,
                                                     expectedLocalRevision: request.local.revision, expectedConnectionRevision: granted.revision,
                                                     fingerprint: fresh.fingerprint)
        precondition(replay.identity == sent.identity && replay.phase == .sent)
        do {
            _ = try await newRuntime().confirm(operationID: sent.identity.operationID, occurrenceID: request.local.occurrenceID,
                                               expectedLocalRevision: request.local.revision, expectedConnectionRevision: granted.revision,
                                               fingerprint: reviewed.fingerprint)
            preconditionFailure("A restart cannot change the original review token")
        } catch Runtime.Failure.operationReused {}
        local.snapshot = nil
        try await fixture.completeRemotePublication()
        let renewed = try await connection.connectFromUserAction(expectedRevision: granted.revision, consent: .reauthorizeCurrentAccount) { _, _ in readOnly }
        let recovered = try await newRuntime().retry(sent.identity.operationID, expectedConnectionRevision: renewed.revision)
        let writes = await fixture.writes
        precondition(recovered.phase == .published && recovered.identity == sent.identity && writes == 1)
        let coldConnection = Runtime.Connection(configuration: configuration, store: .init(directory: path), http: http, now: now)
        let coldRuntime = Runtime(connection: coldConnection, journal: .init(directory: path, now: clock),
                                  local: authority, canUseForeground: { true }, now: clock)
        let offline = try coldRuntime.operations(expectedConnectionRevision: renewed.revision)
        let result = offline.first(where: { $0.entry.identity.operationID == sent.identity.operationID })
        precondition(result?.readOnly == true && result?.entry.phase == .published)
        try await manualLinkChecks(connection: connection, publication: newRuntime(), local: local, snapshot: snapshot,
                                   fixture: fixture, directory: path, revision: renewed.revision, clock: clock)
        let changedFields = Event.Fields(title: "Local edit", notes: snapshot.fields.notes, schedule: snapshot.fields.schedule)
        local.snapshot = .init(version: snapshot.version, fields: changedFields)
        let edited = try coldRuntime.status(recovered)
        precondition(edited.differs && !edited.readOnly && !edited.canRetry)
        let viewer = try coldConnection.savedAccount(expectedRevision: renewed.revision)
        let reserved = try coldRuntime.reservedEvents(viewingAs: viewer, calendarID: calendar)
        precondition(reserved == Set([request.eventID]))
    }

    @MainActor
    private static func manualLinkChecks(
        connection: RemiloIOSGoogleCalendarConnection, publication: RemiloIOSGoogleCalendarPublicationRuntime,
        local: RuntimeLocal, snapshot: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot,
        fixture: Fixture, directory: URL, revision: Int, clock: @escaping @Sendable () -> Int64
    ) async throws {
        typealias Runtime = RemiloIOSGoogleCalendarManualLinkRuntime
        let store = Runtime.Store(directory: directory)
        let runtime = Runtime(connection: connection, publication: publication, imports: .init(directory: directory),
                              store: store, local: .init(read: { _ in local.snapshot }, permit: { expected, commit in
            guard local.snapshot == expected else { throw Runtime.Link.Failure.stalePreview }
            return try commit()
        }), canUseForeground: { true }, now: clock)
        local.snapshot = snapshot
        let occurrenceID = snapshot.version.occurrenceID
        let stale = try await runtime.preview(occurrenceID, expectedConnectionRevision: revision)
        precondition(stale.evidence.origin == .published && stale.baseline == nil && stale.local.fields == stale.remote.fields)
        try await fixture.changeRemoteTag()
        let rejected = try await runtime.resolve(operationID: UUID(), reviewID: stale.id, expectedConnectionRevision: revision,
                                                 choices: [:], updating: false)
        precondition(rejected.phase == .failed && rejected.reason == Runtime.Link.Failure.staleRemote.rawValue)
        let review = try await runtime.preview(occurrenceID, expectedConnectionRevision: revision)
        let operation = UUID()
        let linked = try await runtime.resolve(operationID: operation, reviewID: review.id,
                                               expectedConnectionRevision: revision, choices: [:], updating: false)
        let saved = try store.link(occurrenceID)
        precondition(linked.phase == .confirmed && !linked.localApplied && !linked.remoteAttempted
                     && saved?.baseline?.title == snapshot.fields.title)
        let verified = try await manualStatusChecks(runtime, fixture: fixture, record: saved!, connectionRevision: revision)
        precondition(local.snapshot == snapshot)
        let detached = try runtime.unlink(operationID: UUID(), occurrenceID: occurrenceID, expectedConnectionRevision: revision,
                                          expectedLinkRevision: verified.revision)
        do {
            _ = try await runtime.check(occurrenceID, expectedConnectionRevision: revision, expectedLinkRevision: detached.revision)
            preconditionFailure("A detached link cannot be checked as an active relationship")
        } catch Runtime.Link.Failure.ineligible {}
        let replay = try await runtime.resolve(operationID: operation, reviewID: review.id,
                                               expectedConnectionRevision: revision, choices: [:], updating: false)
        let afterReplay = try store.link(occurrenceID)
        let writes = await fixture.writes
        precondition(replay == linked && afterReplay?.revision == detached.revision && afterReplay?.state == .detached && writes == 1)

        let edited = Event.Fields(title: "Edited locally", notes: snapshot.fields.notes, schedule: snapshot.fields.schedule)
        local.snapshot = .init(version: snapshot.version, fields: edited)
        let differing = try await runtime.preview(occurrenceID, expectedConnectionRevision: revision)
        let result = try differing.resolve([.title: .remilo])
        precondition(differing.baseline == nil && result.outbound == [.title] && result.inbound.isEmpty)
        precondition(differing.suggestedSelections == [.notes: .remilo, .schedule: .remilo])
        do {
            _ = try await runtime.confirmAgreement(operationID: UUID(), reviewID: differing.id,
                                                  expectedConnectionRevision: revision, choices: [.title: .remilo])
            preconditionFailure("A divergent review cannot be attached as an agreement")
        } catch Runtime.Link.Failure.resolutionRequired {}
    }

    @MainActor
    private static func manualStatusChecks(
        _ runtime: RemiloIOSGoogleCalendarManualLinkRuntime, fixture: Fixture,
        record: RemiloIOSGoogleCalendarManualLinkStore.Record, connectionRevision: Int
    ) async throws -> RemiloIOSGoogleCalendarManualLinkStore.Record {
        typealias Runtime = RemiloIOSGoogleCalendarManualLinkRuntime
        let id = record.occurrenceID
        let first = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: record.revision)
        precondition(first.revision == record.revision && first.check?.availability == .available && first.check?.remoteDiffers == false)

        try await fixture.respondToManualRead(.edited)
        let edited = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: first.revision)
        precondition(edited.baseline == record.baseline && edited.check?.remoteDiffers == true)
        try await fixture.respondToManualRead(.failed)
        let failed = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: edited.revision)
        precondition(failed.check?.errorCode == "RETRY" && failed.check?.observedAtMs == edited.check?.observedAtMs)
        precondition(failed.check?.availability == .available && failed.check?.remoteDiffers == true)

        try await fixture.respondToManualRead(.missing)
        let missing = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: failed.revision)
        precondition(missing.revision == record.revision + 1 && missing.check?.availability == .unavailable)
        precondition(missing.check?.availabilityReason == "REMOTE_UNAVAILABLE" && missing.check?.requiresReview == true)
        do {
            _ = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: record.revision)
            preconditionFailure("The suspended link requires the new link revision")
        } catch Runtime.Link.Failure.stalePreview {}

        try await fixture.respondToManualRead(.deleted)
        let deleted = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: missing.revision)
        precondition(deleted.revision == missing.revision && deleted.check?.availability == .deleted)
        precondition(deleted.check?.availabilityReason == "REMOTE_DELETED" && deleted.check?.requiresReview == true)
        try await fixture.respondToManualRead(nil)
        let restored = try await runtime.check(id, expectedConnectionRevision: connectionRevision, expectedLinkRevision: deleted.revision)
        precondition(restored.check?.availability == .available && restored.check?.requiresReview == true)
        let review = try await runtime.preview(id, expectedConnectionRevision: connectionRevision)
        let confirmed = try await runtime.resolve(operationID: UUID(), reviewID: review.id,
                                                   expectedConnectionRevision: connectionRevision, choices: [:], updating: true)
        let linked = try runtime.links(expectedConnectionRevision: connectionRevision).first(where: { $0.occurrenceID == id })!
        precondition(confirmed.phase == .confirmed && linked.revision == restored.revision + 1 && linked.check == nil)
        return linked
    }

    @MainActor
    private final class RuntimeLocal {
        var snapshot: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot?
        var invalidateAtPermit = false
        var manualReceipts: [UUID: RemiloIOSGoogleCalendarManualLinkRuntime.LocalResult] = [:]

        init(_ snapshot: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot) { self.snapshot = snapshot }
    }

    @MainActor
    private static func journalChecks(request: Publication.Request, readOnly: RemiloIOSGoogleCalendarAccess,
                                      now: @escaping @Sendable () -> Date) async throws {
        typealias Journal = RemiloIOSGoogleCalendarPublicationJournal
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-publication-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let journal = Journal(directory: path, now: { Int64(now().timeIntervalSince1970 * 1_000) })
        let reviewFingerprint = try request.fingerprint().base64EncodedString()
        let entry = try journal.capture(request, reviewFingerprint: reviewFingerprint, calendarName: "Personal")
        let replay = try journal.capture(request, reviewFingerprint: reviewFingerprint, calendarName: "Renamed")
        precondition(entry.phase == .waiting && replay == entry)
        let edited = Event.Fields(title: "Different title", notes: request.fields.notes, schedule: request.fields.schedule)
        let changed = try Publication.Request(operationID: request.operationID, account: request.account,
                                              local: request.local, calendarID: request.calendarID,
                                              reviewed: edited, source: .localOneOff)
        do {
            _ = try journal.capture(changed, reviewFingerprint: reviewFingerprint, calendarName: "Personal")
            preconditionFailure("An operation ID must retain its reviewed content digest")
        } catch RemiloIOSGoogleCalendarFailure.operationReused {}
        let replacement = try Publication.Request(operationID: UUID(), account: request.account,
                                                  local: request.local, calendarID: "other-owned",
                                                  reviewed: request.fields, source: .localOneOff)
        do {
            _ = try journal.capture(replacement, reviewFingerprint: reviewFingerprint, calendarName: "Other")
            preconditionFailure("A second destination cannot replace a pending operation")
        } catch Journal.Rejection.operationPending {}
        let text = try String(contentsOf: path.appendingPathComponent("publication-journal.json"), encoding: .utf8)
        precondition(!text.contains("\"title\"") && !text.contains("\"notes\"") && !text.contains(request.fields.title))

        guard case .granted = try journal.beginSend(request) else { preconditionFailure("The first exact send is allowed") }
        let reopened = Journal(directory: path)
        guard case .alreadySent = try reopened.beginSend(request) else {
            preconditionFailure("The send checkpoint survives relaunch")
        }
        let other = Publication.Account(subject: "other", clientID: request.account.clientID,
                                        connectionRevision: 2, accountGeneration: 2)
        let hidden = try reopened.operation(request.operationID, viewingAs: other)
        precondition(hidden == nil)
        let foreignReplacement = try Publication.Request(operationID: UUID(), account: other, local: request.local,
                                                         calendarID: request.calendarID, reviewed: request.fields, source: .localOneOff)
        do {
            _ = try reopened.capture(foreignReplacement, reviewFingerprint: reviewFingerprint, calendarName: "Other account")
            preconditionFailure("The pending remote identity stays reserved after an account change")
        } catch Journal.Rejection.operationPending {}
        let refreshed = Publication.Account(subject: request.account.subject, clientID: request.account.clientID,
                                            connectionRevision: 2, accountGeneration: 1)
        let retired = try reopened.retire(request.operationID, viewingAs: refreshed)
        precondition(retired.retired && retired.phase == .sent)
        let fixture = Fixture(.existingEdited, request: request)
        let checked = try await writer(fixture, now).checkPublication(retired.identity, access: readOnly)
        let confirmed = try reopened.record(retired.identity, outcome: checked)
        let writes = await fixture.writes
        precondition(confirmed.phase == .published && confirmed.retired && confirmed.confirmation?.remoteDiffers == true && writes == 0)
        let lateFailure = try reopened.record(retired.identity, outcome: .unconfirmed(.network))
        precondition(lateFailure == confirmed)

        let otherLocal = Publication.Local(occurrenceID: "another-local", revision: 1, generation: 0)
        let unsent = try Publication.Request(operationID: UUID(), account: request.account, local: otherLocal,
                                             calendarID: request.calendarID, reviewed: request.fields, source: .localOneOff)
        _ = try reopened.capture(unsent, reviewFingerprint: reviewFingerprint, calendarName: "Personal")
        let cancelled = try reopened.retire(unsent.operationID, viewingAs: refreshed)
        precondition(cancelled.retired && cancelled.phase == .cancelled)
        guard case .denied(.cancelled) = try reopened.beginSend(unsent) else {
            preconditionFailure("A retired unsent operation cannot authorize a POST")
        }
    }

    private static func patchChecks(request: Publication.Request, access: RemiloIOSGoogleCalendarAccess,
                                    readOnly: RemiloIOSGoogleCalendarAccess,
                                    now: @escaping @Sendable () -> Date) async throws {
        let original = try Fixture.remote(request: request, edited: false)
        let desired = Event.Fields(title: request.fields.title, notes: "只改备注", schedule: request.fields.schedule)
        let identity = try request.readbackIdentity()
        let patch = try Writer.Patch(operationID: UUID(), account: request.account, local: request.local, calendarID: calendar,
                                     reviewedRemote: original, calendarZone: zone, desired: desired, evidence: .published(identity))
        let foreign = Fixture(.foreign, request: request)
        let foreignResult = try await writer(foreign, now).patch(patch, access: access, phase: .notSent) { _ in
            preconditionFailure("A replaced publication marker cannot reach the send checkpoint")
        }
        guard case .staleRemote = foreignResult else { preconditionFailure("A changed source identity requires a fresh review") }
        let removed = try await writer(Fixture(.removed, request: request), now).patch(patch, access: readOnly, phase: .sent) { _ in
            preconditionFailure("A cancelled resource cannot be patched during recovery")
        }
        guard case .remoteRemoved = removed else { preconditionFailure("An explicit cancellation must stay distinct from a missing read") }
        let missing = try await writer(Fixture(.missing, request: request), now).patch(patch, access: readOnly, phase: .sent) { _ in
            preconditionFailure("A sent retry cannot request another PATCH")
        }
        guard case .unconfirmed = missing else { preconditionFailure("A missing response cannot prove remote deletion") }
        let stale = Fixture(.stalePatch, request: request)
        do {
            _ = try await writer(stale, now).patch(patch, access: readOnly, phase: .notSent) { _ in
                preconditionFailure("Read-only access must not reach the send checkpoint")
            }
            preconditionFailure("Read-only access must not authorize a PATCH")
        } catch RemiloIOSGoogleCalendarFailure.needsAccess {}
        let staleResult = try await writer(stale, now).patch(patch, access: access, phase: .notSent) { _ in await stale.permit() }
        guard case .staleRemote = staleResult else { preconditionFailure("HTTP 412 must require fresh comparison") }
        let staleWrites = await stale.writes
        precondition(staleWrites == 1)
        let delayed = Fixture(.uncertainPatch, request: request)
        let delayedWriter = writer(delayed, now)
        let patched = try await delayedWriter.patch(patch, access: access, phase: .notSent) { _ in await delayed.permit() }
        guard case .confirmed = patched else { preconditionFailure("A matching sparse patch must reconcile read-only") }
        let patchedRetry = try await delayedWriter.patch(patch, access: readOnly, phase: .sent) { _ in
            preconditionFailure("A sent patch retry cannot request a second PATCH")
        }
        guard case .confirmed = patchedRetry else { preconditionFailure("Retain the matching readback") }
        let delayedWrites = await delayed.writes
        precondition(delayedWrites == 1)

        let allDay = try Event.fields(["start": ["date": "2027-03-16"], "end": ["date": "2027-03-17"]], calendarZone: zone).fields.schedule
        let moved = Event.Fields(title: request.fields.title, notes: request.fields.notes, schedule: allDay)
        let schedulePatch = try Writer.Patch(operationID: UUID(), account: request.account, local: request.local, calendarID: calendar,
                                             reviewedRemote: original, calendarZone: zone, desired: moved, evidence: .published(identity))
        let changedZone = Fixture(.changedCalendarZone, request: request)
        let staleZone = try await writer(changedZone, now).patch(schedulePatch, access: access, phase: .notSent) { _ in
            preconditionFailure("A changed destination zone cannot send an all-day update")
        }
        guard case .staleRemote = staleZone else { preconditionFailure("A calendar zone change requires a fresh comparison") }
        let scheduleFixture = Fixture(.schedulePatch, request: request)
        let scheduleResult = try await writer(scheduleFixture, now).patch(schedulePatch, access: access, phase: .notSent) { _ in
            await scheduleFixture.permit()
        }
        guard case .confirmed = scheduleResult else { preconditionFailure("A one-time schedule can change to an all-day event") }
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
        enum Scenario: Equatable {
            case duplicate, uncertainButCreated, missing, existingEdited, foreign, removed, stalePatch, uncertainPatch
            case schedulePatch, changedCalendarZone, manualTransfer
        }
        enum ManualRead {
            case edited, failed, missing, deleted
        }
        private let scenario: Scenario
        private let request: Publication.Request
        private var sent = false
        private var result: Data?
        private var pendingManualResult: Data?
        private var manualRead: HTTP.Response?
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

        func completeRemotePublication() throws {
            precondition(writes == 1)
            result = try Self.remote(request: request, edited: false).json
        }

        func changeRemoteTag(_ tag: String = #""after""#) throws {
            var event = try JSONSerialization.jsonObject(with: result!) as! [String: Any]
            event["etag"] = tag
            result = try JSONSerialization.data(withJSONObject: event)
        }

        func seedManualTransfer() throws {
            let event = try Self.remote(request: request, edited: false)
            var fields = try JSONSerialization.jsonObject(with: event.json) as! [String: Any]
            fields["description"] = "Google note"
            result = try JSONSerialization.data(withJSONObject: fields)
        }

        func completeManualTransfer() throws {
            guard let pendingManualResult else { preconditionFailure("Manual write has not been attempted") }
            result = pendingManualResult
        }

        func respondToManualRead(_ mode: ManualRead?) throws {
            switch mode {
            case nil:
                manualRead = nil
            case .edited:
                let event = try Self.remote(request: request, edited: true)
                manualRead = .init(status: 200, body: event.json)
            case .failed:
                manualRead = .init(status: 503, body: Data())
            case .missing:
                manualRead = .init(status: 404, body: Data())
            case .deleted:
                let cancelled = ["id": request.eventID, "status": "cancelled"]
                manualRead = .init(status: 200, body: try JSONSerialization.data(withJSONObject: cancelled))
            }
        }

        func send(_ wire: URLRequest) throws -> HTTP.Response {
            let url = wire.url!
            precondition(url.absoluteString.contains("owned%2Fid%40example.test"))
            if url.path.contains("/calendarList/") {
                let zone = scenario == .changedCalendarZone ? "America/New_York" : PublicationChecks.zone
                let calendar = ["id": PublicationChecks.calendar, "accessRole": "owner", "timeZone": zone]
                return HTTP.Response(status: 200, body: try JSONSerialization.data(withJSONObject: calendar))
            }
            if wire.httpMethod == nil || wire.httpMethod == "GET" {
                precondition(url.path.hasSuffix(request.eventID))
                if let manualRead { return manualRead }
                if let result { return HTTP.Response(status: 200, body: result) }
                switch scenario {
                case .existingEdited, .foreign, .stalePatch, .uncertainPatch, .schedulePatch:
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
                if scenario == .manualTransfer {
                    precondition(Set(body.keys) == ["summary"] && body["summary"] as? String == "Local title")
                    var pending = try JSONSerialization.jsonObject(with: result!) as! [String: Any]
                    pending["summary"] = "Local title"
                    pending["etag"] = #""after""#
                    pendingManualResult = try JSONSerialization.data(withJSONObject: pending)
                    return HTTP.Response(status: 503, body: Data())
                }
                if scenario == .schedulePatch {
                    precondition(Set(body.keys) == Set(["start", "end"]))
                    for (key, date) in [("start", "2027-03-16"), ("end", "2027-03-17")] {
                        let bound = body[key] as! [String: Any]
                        precondition(Set(bound.keys) == ["date", "dateTime", "timeZone"])
                        precondition(bound["date"] as? String == date && bound["dateTime"] is NSNull && bound["timeZone"] is NSNull)
                    }
                } else {
                    precondition(Set(body.keys) == Set(["description"]) && body["description"] as? String == "只改备注")
                }
                if scenario == .stalePatch { return HTTP.Response(status: 412, body: Data()) }
                let previous = try Self.remote(request: request, edited: false)
                var updated = try JSONSerialization.jsonObject(with: previous.json) as! [String: Any]
                for (key, value) in body {
                    if let changes = value as? [String: Any], var old = updated[key] as? [String: Any] {
                        for (field, change) in changes { old[field] = change is NSNull ? nil : change }
                        updated[key] = old
                    } else {
                        updated[key] = value
                    }
                }
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
