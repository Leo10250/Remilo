import Foundation

@MainActor
enum ManualLinkStoreChecks {
    private typealias Store = RemiloIOSGoogleCalendarManualLinkStore
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias Rejection = Store.Rejection

    static func run() throws {
        let path = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-manual-links-\(UUID())")
        defer { try? FileManager.default.removeItem(at: path) }
        let first = Store(directory: path)
        let owner = account("owner")
        let remote = source(owner, event: "event")
        let localID = "local-reminder"
        let linkID = UUID()
        let linkFingerprint = Data(repeating: 12, count: 32)
        let detachFingerprint = Data(repeating: 13, count: 32)
        let firstObserved: Int64 = 1_800_000_000_000
        let privateTitle = "reviewed private title"
        let privateNotes = "  private notes\n"
        let baseline = Store.Baseline(title: privateTitle, notes: privateNotes, schedule: nil)

        let empty = try first.link(localID)
        precondition(empty == nil)
        let linked = try first.attach(operationID: linkID, fingerprint: linkFingerprint, viewingAs: owner, occurrenceID: localID,
                                      source: remote, origin: .published, expectedRevision: 0, calendarName: "Owned",
                                      baseline: baseline, observedAtMs: firstObserved)
        precondition(linked.occurrenceID == localID && linked.revision == 1 && linked.state == .linked)
        let reopened = Store(directory: path)
        let latest = try reopened.link(localID)
        precondition(latest?.baseline == baseline && latest?.source == remote && latest?.observedAtMs == firstObserved)
        let refreshed = account("owner", revision: 9, generation: 2)
        let replay = try reopened.receipt(operationID: linkID, fingerprint: linkFingerprint, viewingAs: refreshed)
        precondition(replay == linked)
        let observedAgain = try reopened.attach(
            operationID: linkID, fingerprint: linkFingerprint, viewingAs: refreshed, occurrenceID: localID,
            source: remote, origin: .published, expectedRevision: 0, calendarName: "Renamed",
            baseline: baseline, observedAtMs: firstObserved + 100
        )
        precondition(observedAgain == linked)
        let unchanged = try reopened.link(localID)
        precondition(unchanged?.calendarName == "Owned")
        try rejects(Failure.operationReused) {
            _ = try reopened.receipt(operationID: linkID, fingerprint: detachFingerprint, viewingAs: refreshed)
        }
        try rejects(Failure.operationReused) {
            _ = try reopened.attach(operationID: linkID, fingerprint: linkFingerprint, viewingAs: refreshed, occurrenceID: localID,
                                    source: remote, origin: .published, expectedRevision: 0, calendarName: "Owned",
                                    baseline: nil, observedAtMs: firstObserved)
        }
        try rejects(Failure.operationReused) {
            _ = try reopened.detach(operationID: linkID, fingerprint: linkFingerprint, viewingAs: refreshed,
                                    occurrenceID: localID, expectedRevision: 1)
        }
        try rejects(Rejection.stalePreview) {
            _ = try reopened.attach(operationID: UUID(), fingerprint: linkFingerprint, viewingAs: owner, occurrenceID: localID,
                                    source: remote, origin: .published, expectedRevision: 0, calendarName: "Owned",
                                    baseline: nil, observedAtMs: firstObserved)
        }

        let other = account("other")
        let unseen = try reopened.receipt(operationID: linkID, fingerprint: linkFingerprint, viewingAs: other)
        let otherLinks = try reopened.links(viewingAs: other)
        let ownerLinks = try reopened.links(viewingAs: refreshed)
        precondition(unseen == nil && otherLinks.isEmpty && ownerLinks.map(\.occurrenceID) == [localID])
        try rejects(Failure.notFound) {
            _ = try reopened.detach(operationID: UUID(), fingerprint: detachFingerprint, viewingAs: other,
                                    occurrenceID: localID, expectedRevision: 1)
        }
        try rejects(Failure.accountChanged) {
            _ = try reopened.attach(operationID: UUID(), fingerprint: linkFingerprint, viewingAs: other, occurrenceID: "other-reminder",
                                    source: remote, origin: .imported, expectedRevision: 0, calendarName: "Owned",
                                    baseline: nil, observedAtMs: firstObserved)
        }

        let detachID = UUID()
        let detached = try reopened.detach(operationID: detachID, fingerprint: detachFingerprint, viewingAs: refreshed,
                                           occurrenceID: localID, expectedRevision: 1)
        let detachedRecord = try reopened.link(localID)
        let file = path.appendingPathComponent("manual-links.json")
        let bytes = try String(contentsOf: file, encoding: .utf8)
        precondition(detached.state == .detached && detached.revision == 2)
        precondition(detachedRecord?.source == remote && detachedRecord?.baseline == nil && detachedRecord?.observedAtMs == nil)
        precondition(!bytes.contains(privateTitle) && !bytes.contains("private notes") && !bytes.contains("\"baseline\""))

        let differentClient = account("owner", client: "new-client")
        let hiddenFromNewClient = try reopened.links(viewingAs: differentClient)
        let reserved = try reopened.reservedEvents(viewingAs: differentClient, calendarID: remote.calendarID)
        precondition(hiddenFromNewClient.isEmpty && reserved == [remote.eventID])
        try rejects(Rejection.sourceReserved) {
            _ = try reopened.attach(operationID: UUID(), fingerprint: linkFingerprint, viewingAs: differentClient, occurrenceID: "another-reminder",
                                    source: source(differentClient, event: remote.eventID), origin: .imported, expectedRevision: 0,
                                    calendarName: "Owned", baseline: nil, observedAtMs: firstObserved)
        }
        try rejects(Rejection.sourceReserved) {
            _ = try reopened.attach(operationID: UUID(), fingerprint: linkFingerprint, viewingAs: owner, occurrenceID: localID,
                                    source: source(owner, event: "different-event"), origin: .published, expectedRevision: 2,
                                    calendarName: "Owned", baseline: nil, observedAtMs: firstObserved)
        }

        let relinkID = UUID()
        let relinked = try reopened.attach(operationID: relinkID, fingerprint: linkFingerprint, viewingAs: refreshed, occurrenceID: localID,
                                          source: remote, origin: .published, expectedRevision: 2, calendarName: "Owned",
                                          baseline: baseline, observedAtMs: firstObserved + 200)
        let oldDetach = try first.detach(operationID: detachID, fingerprint: detachFingerprint, viewingAs: refreshed,
                                        occurrenceID: localID, expectedRevision: 1)
        let current = try first.link(localID)
        precondition(relinked.revision == 3 && current?.revision == 3 && current?.state == .linked && oldDetach == detached)

        try reopened.redactPurged([localID, "unrelated-reminder"])
        let purged = try first.link(localID)
        let historical = try first.receipt(operationID: relinkID, fingerprint: linkFingerprint, viewingAs: refreshed)
        let purgedReservation = try first.reservedEvents(viewingAs: refreshed, calendarID: remote.calendarID)
        let redacted = try Data(contentsOf: file)
        precondition(purged?.revision == 4 && purged?.state == .detached && purged?.source == remote)
        precondition(purged?.baseline == nil && purged?.observedAtMs == nil && purged?.calendarName == "")
        precondition(historical == relinked && purgedReservation == [remote.eventID])
        let redactedText = String(decoding: redacted, as: UTF8.self)
        precondition(!redactedText.contains(privateTitle) && !redactedText.contains("private notes") && !redactedText.contains("\"Owned\""))
        try first.redactPurged([localID])
        let repeatedRedaction = try Data(contentsOf: file)
        precondition(repeatedRedaction == redacted)
        try rejects(Rejection.stalePreview) {
            _ = try first.attach(operationID: UUID(), fingerprint: linkFingerprint, viewingAs: refreshed, occurrenceID: localID,
                                  source: remote, origin: .published, expectedRevision: 3, calendarName: "Owned",
                                  baseline: baseline, observedAtMs: firstObserved)
        }

        var invalid = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
        var links = invalid["links"] as! [String: [String: Any]]
        var duplicate = links[localID]!
        duplicate["occurrenceID"] = "duplicate"
        links["duplicate"] = duplicate
        invalid["links"] = links
        try JSONSerialization.data(withJSONObject: invalid).write(to: file, options: .atomic)
        try rejects(RemiloIOSGoogleCalendarStore.Failure.invalidState) { _ = try first.links(viewingAs: owner) }
        let future = Data(#"{"schemaVersion":2}"#.utf8)
        try future.write(to: file, options: .atomic)
        try rejects(RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema) { _ = try first.link(localID) }
        let preserved = try Data(contentsOf: file)
        precondition(preserved == future)
        try transferChecks(in: path.appendingPathComponent("transfer", isDirectory: true), time: firstObserved)
    }

    private static func transferChecks(in path: URL, time: Int64) throws {
        let store = Store(directory: path)
        let owner = account("owner")
        let source = source(owner, event: "transfer-event")
        let evidence = Store.Link.Evidence.imported(source)
        let remote = try observation(evidence, title: "Google title", notes: "Google notes")
        let localFields = Store.Link.Event.Fields(title: "Remilo title", notes: "Remilo notes", schedule: remote.fields.schedule)
        let desired = Store.Link.Event.Fields(title: localFields.title, notes: remote.fields.notes, schedule: remote.fields.schedule)
        let localID = "transfer-reminder"
        let before = Store.LocalSnapshot(version: .init(occurrenceID: localID, revision: 1, generation: 7), fields: localFields)
        let after = Store.LocalSnapshot(version: .init(occurrenceID: localID, revision: 2, generation: 7), fields: desired)
        let fingerprint = Data(repeating: 81, count: 32)
        let transfer = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: before,
                                      remote: remote, desired: desired, linkRevision: 0, checkedAtMs: time)
        let captured = try store.captureTransfer(transfer, fingerprint: fingerprint)
        let replay = try store.captureTransfer(transfer, fingerprint: fingerprint)
        precondition(captured == replay && captured.kind == "EnableCalendarLink" && captured.phase == .waiting)
        let hidden = try store.transferOperation(transfer.operationID, viewingAs: account("different-owner"))
        let reserved = try store.reservedEvents(viewingAs: owner, calendarID: source.calendarID)
        precondition(hidden == nil && reserved == [source.eventID])
        try rejects(Rejection.operationPending) {
            _ = try store.captureTransfer(
                .init(operationID: UUID(), account: owner, evidence: evidence, local: before,
                      remote: remote, desired: desired, linkRevision: 0, checkedAtMs: time),
                fingerprint: fingerprint
            )
        }
        try rejects(Rejection.operationPending) {
            _ = try store.attach(operationID: UUID(), fingerprint: fingerprint, viewingAs: owner, occurrenceID: "another-reminder",
                                 source: source, origin: .imported, expectedRevision: 0, calendarName: "Owned",
                                 baseline: nil, observedAtMs: time)
        }
        try rejects(Failure.operationReused) {
            _ = try store.transferOperation(transfer.operationID, viewingAs: owner, fingerprint: Data(repeating: 82, count: 32))
        }
        try store.requireTransferAuthority(transfer)
        guard case .denied(.cancelled) = try store.beginSend(transfer, after: after) else {
            preconditionFailure("A pending local commit cannot dispatch a remote write")
        }
        let recorded = try store.recordLocal(transfer, after: after, status: "Scheduled")
        precondition(recorded.localAfter == after && recorded.localApplied && recorded.phase == .localApplied)
        try store.requireTransferAuthority(transfer, phase: .localApplied)
        guard case .granted = try store.beginSend(transfer, after: after) else { preconditionFailure("First send checkpoint") }
        let reopened = Store(directory: path)
        guard case .alreadySent = try reopened.beginSend(transfer, after: after) else { preconditionFailure("Exact send replay") }
        let sent = try reopened.transferOperation(transfer.operationID, viewingAs: owner)
        precondition(sent?.phase == .sent && sent?.remoteAttempted == true && sent?.readback != nil)
        try rejects(Store.Link.Failure.staleRemote) {
            _ = try reopened.confirmTransfer(transfer, observedLocal: after, observedRemote: remote, observedAtMs: time, advanceLink: true)
        }
        let agreed = try observation(evidence, title: desired.title, notes: desired.notes)
        let settled = try reopened.confirmTransfer(transfer, observedLocal: after, observedRemote: agreed, observedAtMs: time, advanceLink: true)
        let linked = try reopened.link(localID)
        let lateFailure = try reopened.failTransfer(transfer, reason: "STALE_REMOTE")
        precondition(settled.phase == .confirmed && settled.resultLinkRevision == 1 && settled.localStatus == "Scheduled")
        precondition(settled.transfer == nil && settled.localAfter == nil && settled.readback == nil && lateFailure == settled)
        precondition(linked?.revision == 1 && linked?.baseline?.title == desired.title && linked?.baseline?.notes == desired.notes)

        let revisedRemote = try observation(evidence, title: "Another remote title", notes: "Another remote note")
        let nextDesired = Store.Link.Event.Fields(title: desired.title, notes: revisedRemote.fields.notes, schedule: desired.schedule)
        let nextAfter = Store.LocalSnapshot(version: .init(occurrenceID: localID, revision: 3, generation: 7), fields: nextDesired)
        let next = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: after,
                                  remote: revisedRemote, desired: nextDesired, linkRevision: 1, checkedAtMs: time)
        let update = try reopened.captureTransfer(next, fingerprint: fingerprint)
        precondition(update.kind == "ApplyCalendarResolution")
        try reopened.requireTransferAuthority(next)
        let detached = try reopened.detach(operationID: UUID(), fingerprint: fingerprint, viewingAs: owner,
                                           occurrenceID: localID, expectedRevision: 1)
        let recovered = try reopened.recordLocal(next, after: nextAfter, status: "Applied")
        precondition(detached.revision == 2 && recovered.localApplied && !recovered.remoteAttempted)
        try rejects(Rejection.stalePreview) { _ = try reopened.beginSend(next, after: nextAfter) }
        let fenced = try reopened.failTransfer(next, reason: "STALE_PREVIEW")
        precondition(fenced.phase == .failed && fenced.localStatus == "Applied" && fenced.transfer == nil)

        let outbound = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: nextAfter,
                                      remote: revisedRemote, desired: nextDesired, linkRevision: 2, checkedAtMs: time)
        let pending = try reopened.captureTransfer(outbound, fingerprint: fingerprint)
        let withoutLocalWrite = try reopened.recordLocal(outbound, after: nextAfter, status: nil)
        precondition(pending.kind == "EnableCalendarLink" && !withoutLocalWrite.localApplied && withoutLocalWrite.localStatus == nil)
        guard case .granted = try reopened.beginSend(outbound, after: nextAfter) else { preconditionFailure("Relink send checkpoint") }
        try reopened.redactPurged([localID])
        let refreshed = account("owner", revision: 8, generation: 2)
        let scrubbed = try reopened.transferOperation(outbound.operationID, viewingAs: refreshed)
        precondition(scrubbed?.phase == .sent && scrubbed?.erased == true && scrubbed?.readback != nil)
        precondition(scrubbed?.transfer == nil && scrubbed?.localAfter == nil && scrubbed?.calendarName == "")
        let text = try String(contentsOf: path.appendingPathComponent("manual-links.json"), encoding: .utf8)
        precondition(!text.contains("Remilo title") && !text.contains("Another remote note"))
        let matching = try observation(evidence, title: nextDesired.title, notes: nextDesired.notes)
        let readBack = try reopened.confirmReadback(outbound.operationID, viewingAs: refreshed, observedRemote: matching)
        let purgedLink = try reopened.link(localID)
        precondition(readBack.phase == .confirmed && readBack.resultLinkRevision == nil && readBack.remoteAttempted)
        precondition(purgedLink?.state == .detached && purgedLink?.baseline == nil)
    }

    private static func observation(_ evidence: Store.Link.Evidence, title: String, notes: String) throws -> Store.Link.Observation {
        let source = evidence.source
        let calendar = try JSONSerialization.data(withJSONObject: [
            "id": source.calendarID, "summary": "Owned", "accessRole": "owner", "timeZone": "UTC",
        ])
        let event = try JSONSerialization.data(withJSONObject: [
            "id": source.eventID, "summary": title, "description": notes,
            "start": ["date": "2027-03-15"], "end": ["date": "2027-03-16"],
        ])
        return try Store.Link.Observation(
            evidence: evidence, calendar: JSONDecoder().decode(Store.Link.Transport.OwnedCalendar.self, from: calendar),
            lookup: .found(.init(id: source.eventID, etag: #""reviewed""#, cancelled: false, json: event))
        )
    }

    private static func account(_ subject: String, client: String = "client", revision: Int = 1, generation: Int = 1) -> Store.Account {
        Store.Account(subject: subject, clientID: client, connectionRevision: revision, accountGeneration: generation)
    }

    private static func source(_ account: Store.Account, event: String) -> Store.Source {
        Store.Source(subject: account.subject, clientID: account.clientID, calendarID: "owned/calendar@example.test", eventID: event)
    }

    private static func rejects<E: Error & Equatable>(_ expected: E, _ action: () throws -> Void) throws {
        do {
            try action()
            preconditionFailure("Expected \(expected)")
        } catch let failure as E { precondition(failure == expected) }
    }
}
