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
