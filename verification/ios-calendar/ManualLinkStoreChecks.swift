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
        try supersedingChecks(in: path.appendingPathComponent("superseding", isDirectory: true), time: firstObserved)
        try checkChecks(in: path.appendingPathComponent("check", isDirectory: true), time: firstObserved)
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
        let afterPurge = try observation(evidence, title: "Fresh title", notes: "", etag: #""after-purge""#)
        try rejects(Rejection.stalePreview) {
            _ = try reopened.captureTransfer(
                .init(operationID: UUID(), account: refreshed, evidence: evidence, local: nextAfter,
                      remote: afterPurge, desired: nextDesired, linkRevision: 3, checkedAtMs: time + 1),
                fingerprint: fingerprint, superseding: outbound.operationID
            )
        }
        let matching = try observation(evidence, title: nextDesired.title, notes: nextDesired.notes)
        let readBack = try reopened.confirmReadback(outbound.operationID, viewingAs: refreshed, observedRemote: matching)
        let purgedLink = try reopened.link(localID)
        precondition(readBack.phase == .confirmed && readBack.resultLinkRevision == nil && readBack.remoteAttempted)
        precondition(purgedLink?.state == .detached && purgedLink?.baseline == nil)
    }

    private static func supersedingChecks(in path: URL, time: Int64) throws {
        let store = Store(directory: path)
        let owner = account("owner")
        let refreshed = account("owner", revision: 2)
        let foreign = account("owner", client: "other-client")
        let source = source(owner, event: "sent-event")
        let foreignSource = Store.Source(subject: foreign.subject, clientID: foreign.clientID, calendarID: source.calendarID,
                                         eventID: source.eventID)
        let evidence = Store.Link.Evidence.imported(source)
        let remote = try observation(evidence, title: "Original remote title", notes: "Original remote notes")
        let beforeFields = Store.Link.Event.Fields(title: "Local title", notes: "Discarded prior notes", schedule: remote.fields.schedule)
        let chosen = Store.Link.Event.Fields(title: beforeFields.title, notes: remote.fields.notes, schedule: remote.fields.schedule)
        let before = Store.LocalSnapshot(version: .init(occurrenceID: "sent-reminder", revision: 1, generation: 7), fields: beforeFields)
        let after = Store.LocalSnapshot(version: .init(occurrenceID: before.version.occurrenceID, revision: 2, generation: 7), fields: chosen)
        let old = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: before,
                                 remote: remote, desired: chosen, linkRevision: 0, checkedAtMs: time)
        let oldFingerprint = Data(repeating: 91, count: 32)
        let fingerprint = Data(repeating: 92, count: 32)
        let waiting = try store.captureTransfer(old, fingerprint: oldFingerprint)
        let pending = try store.pendingTransfer(occurrenceID: old.occurrenceID, source: source, viewingAs: refreshed)
        let hidden = try store.pendingTransfer(occurrenceID: old.occurrenceID, source: foreignSource, viewingAs: foreign)
        precondition(pending == waiting && hidden == nil)

        let fresh = try observation(evidence, title: "Fresh remote title", notes: "Fresh remote notes", etag: #""fresh""#)
        let replacement = Store.Transfer(operationID: UUID(), account: refreshed, evidence: evidence, local: after,
                                         remote: fresh, desired: fresh.fields, linkRevision: 0, checkedAtMs: time + 1)
        try rejects(Rejection.stalePreview) {
            _ = try store.captureTransfer(replacement, fingerprint: fingerprint, superseding: old.operationID)
        }
        _ = try store.recordLocal(old, after: after, status: "Scheduled")
        try rejects(Rejection.stalePreview) {
            _ = try store.captureTransfer(replacement, fingerprint: fingerprint, superseding: old.operationID)
        }
        guard case .granted = try store.beginSend(old, after: after) else { preconditionFailure("Original send checkpoint") }
        let sent = try store.pendingTransfer(occurrenceID: old.occurrenceID, source: source, viewingAs: refreshed)
        precondition(sent?.phase == .sent)

        try rejects(Failure.notFound) {
            _ = try store.captureTransfer(replacement, fingerprint: fingerprint, superseding: UUID())
        }
        try rejects(Store.Link.Failure.staleRemote) {
            _ = try store.captureTransfer(
                .init(operationID: UUID(), account: refreshed, evidence: evidence, local: after,
                      remote: remote, desired: chosen, linkRevision: 0, checkedAtMs: time + 1),
                fingerprint: fingerprint, superseding: old.operationID
            )
        }
        let unrelated = Store.LocalSnapshot(version: .init(occurrenceID: "other-reminder", revision: 1, generation: 7), fields: chosen)
        try rejects(Rejection.stalePreview) {
            _ = try store.captureTransfer(
                .init(operationID: UUID(), account: refreshed, evidence: evidence, local: unrelated,
                      remote: fresh, desired: fresh.fields, linkRevision: 0, checkedAtMs: time + 1),
                fingerprint: fingerprint, superseding: old.operationID
            )
        }
        let foreignEvidence = Store.Link.Evidence.imported(foreignSource)
        let foreignObservation = try observation(foreignEvidence, title: "Fresh remote title", notes: "", etag: #""fresh""#)
        try rejects(Failure.notFound) {
            _ = try store.captureTransfer(
                .init(operationID: UUID(), account: foreign, evidence: foreignEvidence, local: after,
                      remote: foreignObservation, desired: foreignObservation.fields, linkRevision: 0, checkedAtMs: time + 1),
                fingerprint: fingerprint, superseding: old.operationID
            )
        }
        let stillSent = try store.pendingTransfer(occurrenceID: old.occurrenceID, source: source, viewingAs: refreshed)
        let absentReplacement = try store.transferOperation(replacement.operationID, viewingAs: refreshed)
        precondition(stillSent == sent && absentReplacement == nil)

        let captured = try store.captureTransfer(replacement, fingerprint: fingerprint, superseding: old.operationID)
        let reopened = Store(directory: path)
        let cancelled = try reopened.transferOperation(old.operationID, viewingAs: refreshed)
        let exact = try reopened.captureTransfer(replacement, fingerprint: fingerprint, superseding: old.operationID)
        let current = try reopened.pendingTransfer(occurrenceID: old.occurrenceID, source: source, viewingAs: refreshed)
        precondition(exact == captured && current == captured && captured.phase == .waiting)
        precondition(cancelled?.phase == .cancelled && cancelled?.reason == "SUPERSEDED")
        precondition(cancelled?.localApplied == true && cancelled?.localStatus == "Scheduled" && cancelled?.remoteAttempted == true)
        precondition(cancelled?.source == source && cancelled?.transfer == nil && cancelled?.localAfter == nil && cancelled?.readback == nil)
        let bytes = try String(contentsOf: path.appendingPathComponent("manual-links.json"), encoding: .utf8)
        precondition(!bytes.contains("Discarded prior notes") && !bytes.contains("Original remote title"))
        try rejects(Failure.operationReused) {
            _ = try reopened.captureTransfer(replacement, fingerprint: fingerprint)
        }
        let priorReplay = try reopened.captureTransfer(old, fingerprint: oldFingerprint)
        precondition(priorReplay == cancelled)
        try rejects(Rejection.stalePreview) { try reopened.requireTransferAuthority(old) }
        guard case .denied(.cancelled) = try reopened.beginSend(old, after: after) else {
            preconditionFailure("A superseded operation must not dispatch again")
        }
        let late = try observation(evidence, title: chosen.title, notes: chosen.notes, etag: #""late""#)
        let lateConfirmation = try reopened.confirmTransfer(old, observedLocal: after, observedRemote: late,
                                                           observedAtMs: time + 2, advanceLink: true)
        let lateReadback = try reopened.confirmReadback(old.operationID, viewingAs: refreshed, observedRemote: late)
        let link = try reopened.link(old.occurrenceID)
        precondition(lateConfirmation == cancelled && lateReadback == cancelled && link == nil)

        let updated = Store.LocalSnapshot(version: .init(occurrenceID: old.occurrenceID, revision: 3, generation: 7), fields: fresh.fields)
        _ = try reopened.recordLocal(replacement, after: updated, status: "Applied")
        let settled = try reopened.confirmTransfer(replacement, observedLocal: updated, observedRemote: fresh,
                                                   observedAtMs: time + 3, advanceLink: true)
        let attached = try reopened.link(old.occurrenceID)
        precondition(settled.phase == .confirmed && attached?.baseline?.title == fresh.fields.title)
    }

    private static func checkChecks(in path: URL, time: Int64) throws {
        let store = Store(directory: path)
        let owner = account("owner")
        let other = account("other")
        let source = source(owner, event: "checked-event")
        let evidence = Store.Link.Evidence.imported(source)
        let agreed = try observation(evidence, title: "Attached title", notes: "Attached notes")
        let foreign = try observation(.imported(Self.source(other, event: source.eventID)), title: agreed.fields.title, notes: "")
        let differing = try observation(evidence, title: "Private observed title", notes: "Private observed notes")
        let baseline = Store.Baseline(title: agreed.fields.title, notes: agreed.fields.notes, schedule: agreed.fields.schedule)
        let localID = "checked-reminder"
        let fingerprint = Data(repeating: 66, count: 32)
        _ = try store.attach(operationID: UUID(), fingerprint: fingerprint, viewingAs: owner, occurrenceID: localID,
                             source: source, origin: .imported, expectedRevision: 0, calendarName: "Owned",
                             baseline: baseline, observedAtMs: time)
        let original = try store.link(localID)!
        precondition(original.check == nil)
        try rejects(Failure.accountChanged) {
            _ = try store.observe(original, viewingAs: other, result: .available(agreed), at: time + 1)
        }
        try rejects(Store.Link.Failure.staleRemote) {
            _ = try store.observe(original, viewingAs: owner, result: .available(foreign), at: time + 1)
        }
        let checked = try store.observe(original, viewingAs: owner, result: .available(differing), at: time + 2)
        precondition(checked.revision == 1 && checked.baseline == baseline && checked.check?.remoteDiffers == true)
        precondition(checked.check?.availability == .available && checked.check?.observedAtMs == time + 2)
        let sameTime = try store.observe(checked, viewingAs: owner, result: .failed("RETRY"), at: time + 2)
        precondition(sameTime.check?.attemptedAtMs == time + 2 && sameTime.check?.errorCode == "RETRY")
        try rejects(Rejection.stalePreview) {
            _ = try store.observe(checked, viewingAs: owner, result: .available(agreed), at: time + 2)
        }
        let failed = try Store(directory: path).observe(sameTime, viewingAs: owner, result: .failed("NETWORK"), at: time + 3)
        precondition(failed.check?.attemptedAtMs == time + 3 && failed.check?.errorCode == "NETWORK")
        precondition(failed.check?.observedAtMs == time + 2 && failed.check?.remoteDiffers == true && failed.check?.availability == .available)
        let text = try String(contentsOf: path.appendingPathComponent("manual-links.json"), encoding: .utf8)
        precondition(!text.contains("Private observed"))
        try rejects(Rejection.stalePreview) {
            _ = try store.observe(original, viewingAs: owner, result: .available(agreed), at: time + 50)
        }
        let clockCorrected = try store.observe(failed, viewingAs: owner, result: .failed("NETWORK"), at: time - 1)
        precondition(clockCorrected.check?.attemptedAtMs == time - 1 && clockCorrected.check?.observedAtMs == time + 2)
        let persistedCorrection = try Store(directory: path).link(localID)
        precondition(persistedCorrection == clockCorrected)

        let snapshot = Store.LocalSnapshot(version: .init(occurrenceID: localID, revision: 1, generation: 0), fields: agreed.fields)
        let sent = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: snapshot, remote: differing,
                                  desired: agreed.fields, linkRevision: 1, checkedAtMs: time + 3)
        _ = try store.captureTransfer(sent, fingerprint: fingerprint)
        _ = try store.recordLocal(sent, after: snapshot, status: nil)
        guard case .granted = try store.beginSend(sent, after: snapshot) else { preconditionFailure("Original send") }

        let unavailable = try store.observe(clockCorrected, viewingAs: owner, result: .unavailable("NOT_FOUND"), at: time + 4)
        precondition(unavailable.revision == 2 && unavailable.check?.availability == .unavailable)
        precondition(unavailable.check?.availabilityReason == "NOT_FOUND" && unavailable.check?.requiresReview == true)
        let deleted = try store.observe(unavailable, viewingAs: owner, result: .deleted("untrusted provider detail"), at: time + 5)
        precondition(deleted.revision == 2 && deleted.check?.availability == .deleted && deleted.check?.errorCode == "")
        precondition(deleted.check?.availabilityReason == "REMOTE_DELETED")
        let restored = try store.observe(deleted, viewingAs: owner, result: .available(agreed), at: time + 6)
        precondition(restored.revision == 2 && restored.check?.availability == .available && restored.check?.remoteDiffers == false)
        precondition(restored.check?.requiresReview == true && restored.baseline == baseline)
        try rejects(Rejection.stalePreview) {
            _ = try store.confirmTransfer(sent, observedLocal: snapshot, observedRemote: agreed, observedAtMs: time + 6, advanceLink: true)
        }
        let readBack = try store.confirmReadback(sent.operationID, viewingAs: owner, observedRemote: agreed)
        let afterReadback = try store.link(localID)
        precondition(readBack.phase == .confirmed && readBack.resultLinkRevision == nil && afterReadback == restored)

        let reviewed = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: snapshot, remote: agreed,
                                      desired: agreed.fields, linkRevision: 2, checkedAtMs: time + 7)
        _ = try store.captureTransfer(reviewed, fingerprint: fingerprint)
        _ = try store.recordLocal(reviewed, after: snapshot, status: nil)
        _ = try store.confirmTransfer(reviewed, observedLocal: snapshot, observedRemote: agreed, observedAtMs: time + 7, advanceLink: true)
        let linkedAgain = try store.link(localID)!
        precondition(linkedAgain.revision == 3 && linkedAgain.check == nil)
        let beforeUnlink = try store.observe(linkedAgain, viewingAs: owner, result: .available(agreed), at: time + 8)
        _ = try store.detach(operationID: UUID(), fingerprint: fingerprint, viewingAs: owner, occurrenceID: localID, expectedRevision: 3)
        let detached = try store.link(localID)!
        precondition(detached.state == .detached && detached.check == nil)
        try rejects(Rejection.stalePreview) {
            _ = try store.observe(beforeUnlink, viewingAs: owner, result: .available(differing), at: time + 9)
        }

        _ = try store.attach(operationID: UUID(), fingerprint: fingerprint, viewingAs: owner, occurrenceID: localID,
                             source: source, origin: .imported, expectedRevision: 4, calendarName: "Owned",
                             baseline: baseline, observedAtMs: time + 10)
        let beforeLoss = try store.link(localID)!
        let unsent = Store.Transfer(operationID: UUID(), account: owner, evidence: evidence, local: snapshot, remote: differing,
                                    desired: agreed.fields, linkRevision: beforeLoss.revision, checkedAtMs: time + 10)
        _ = try store.captureTransfer(unsent, fingerprint: fingerprint)
        let lost = try store.observe(beforeLoss, viewingAs: owner, result: .unavailable("NOT_OWNER"), at: time + 11)
        precondition(lost.revision == beforeLoss.revision + 1)
        try rejects(Rejection.stalePreview) { try store.requireTransferAuthority(unsent) }
        try store.redactPurged([localID])
        let purged = try store.link(localID)!
        precondition(purged.state == .detached && purged.check == nil && purged.baseline == nil)
    }

    private static func observation(_ evidence: Store.Link.Evidence, title: String, notes: String, etag: String = #""reviewed""#)
        throws -> Store.Link.Observation {
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
            lookup: .found(.init(id: source.eventID, etag: etag, cancelled: false, json: event))
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
