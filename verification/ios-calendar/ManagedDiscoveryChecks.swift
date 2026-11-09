import Foundation

enum ManagedDiscoveryChecks {
    private typealias Discovery = RemiloIOSGoogleCalendarManagedDiscovery
    private typealias Failure = RemiloIOSGoogleCalendarFailure
    private typealias HTTP = RemiloIOSGoogleCalendarHTTP
    private typealias Connection = RemiloIOSGoogleCalendarConnection

    private static let email = "owner@example.test"
    private static let reference = "00112233-4455-6677-8899-aabbccddeeff"
    private static let marker = "Remilo managed calendar v1\nSetup reference: " + reference

    static func run(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                    now: @escaping @Sendable () -> Date) async throws {
        try selectionChecks()
        try await resolverChecks(configuration: configuration, access: access, now: now)
    }

    private static func selectionChecks() throws {
        let operationID = UUID(uuidString: reference)!
        check(Discovery.setupReference(marker) == operationID && Discovery.marker(operationID) == marker,
              "read and write the same exact setup marker as Android")
        let malformed = [
            marker + "\nExtra text",
            " " + marker,
            marker.replacingOccurrences(of: "v1", with: "v2"),
            marker.replacingOccurrences(of: reference, with: reference.uppercased()),
        ]
        check(malformed.allSatisfy { Discovery.setupReference($0) == nil }, "reject lookalike setup markers")

        let renamed = try record(id: "marked", summary: "Renamed", description: marker)
        let canonical = try record(id: "canonical", summary: " reMILO ", displayName: "Personal display name")
        let alias = try record(id: "alias", summary: "Unrelated", displayName: "Remilo")
        let foreign = try record(id: "foreign", summary: "Remilo", owner: "owner+alias@example.test", description: marker)
        let primary = try record(id: "primary", summary: "Remilo", primary: true, description: marker)
        let unknown = try record(id: "unknown", summary: "Remilo", owner: nil)
        let invalidZone = try record(id: "invalid-zone", summary: "Remilo", zone: "Not/AZone")
        check(Discovery.eligibility(renamed, verifiedEmail: email.uppercased()) == nil, "compare verified ownership case-insensitively")
        check(Discovery.eligibility(foreign, verifiedEmail: email) == .notOwner, "reject a distinct address alias")
        check(Discovery.eligibility(primary, verifiedEmail: email) == .notOwner, "exclude the primary calendar")
        check(Discovery.eligibility(unknown, verifiedEmail: email) == .ownershipUnknown, "surface missing ownership evidence")
        check(Discovery.eligibility(invalidZone, verifiedEmail: email) == .invalidZone, "require an IANA time zone")
        check(Discovery.recoveredID([canonical, renamed], complete: true, operationID: operationID, verifiedEmail: email) == renamed.id,
              "recover only the exact creation marker, even after a rename")
        check(Discovery.recoveredID([renamed], complete: false, operationID: operationID, verifiedEmail: email) == nil &&
              Discovery.recoveredID([renamed, foreign], complete: true, operationID: operationID, verifiedEmail: email) == nil &&
              Discovery.recoveredID([canonical], complete: true, operationID: operationID, verifiedEmail: email) == nil,
              "partial, ambiguous, and zero exact matches cannot recover creation")

        let none = try Discovery.select([alias, foreign, primary], complete: true, verifiedEmail: email)
        check(none.outcome == .create && none.candidates.isEmpty, "display aliases and ineligible rows cannot become candidates")
        let one = try Discovery.select([canonical], complete: true, verifiedEmail: email)
        check(one.outcome == .candidate && one.selected?.recognition == .nameOnly, "review a canonical name-only match")
        let choices = try Discovery.select([renamed, canonical, unknown, invalidZone], complete: true, verifiedEmail: email)
        check(choices.outcome == .choose && choices.selected == nil && choices.candidates.count == 4,
              "multiple matches require a choice")
        let byID = Dictionary(uniqueKeysWithValues: choices.candidates.map { ($0.record.id, $0) })
        check(byID["marked"]?.recognition == .recognized, "find a renamed calendar through its marker")
        check(byID["unknown"]?.failure == .ownershipUnknown && byID["invalid-zone"]?.failure == .invalidZone,
              "recognition alone does not make a calendar eligible")
        let blocked = try Discovery.select([unknown], complete: true, verifiedEmail: email)
        check(blocked.outcome == .choose && blocked.selected == nil, "do not implicitly choose a blocked sole match")
        try expectFailure(Failure.ownershipUnknown) {
            _ = try Discovery.select([unknown], complete: true, verifiedEmail: email, selectedID: unknown.id)
        }
        try expectFailure(Failure.notFound) {
            _ = try Discovery.select([canonical], complete: true, verifiedEmail: email, selectedID: alias.id)
        }
        try expectFailure(Failure.invalidInput) {
            _ = try Discovery.select([canonical], complete: true, verifiedEmail: email,
                                     savedID: canonical.id, savedLookup: .found(renamed))
        }
        try expectFailure(Failure.invalidInput) {
            _ = try Discovery.select([canonical], complete: true, verifiedEmail: email, savedID: canonical.id)
        }
        let invalidSaved = try Discovery.select([canonical], complete: true, verifiedEmail: email,
                                                savedID: invalidZone.id, savedLookup: .found(invalidZone))
        check(invalidSaved.outcome == .savedUnavailable && invalidSaved.savedFailure == .invalidZone,
              "a failed exact lookup cannot fall back to another candidate")
    }

    @MainActor
    private static func resolverChecks(configuration: RemiloIOSGoogleCalendarConfiguration, access: RemiloIOSGoogleCalendarAccess,
                                       now: @escaping @Sendable () -> Date) async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("remilo-managed-discovery-\(UUID())")
        defer { try? FileManager.default.removeItem(at: directory) }
        let fixture = Fixture(owner: email, marker: marker)
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let store = RemiloIOSGoogleCalendarStore(directory: directory)
        let connection = Connection(configuration: configuration, store: store, http: http, now: now)
        let connected = try await connection.connectFromUserAction(expectedRevision: 0, consent: .connectOrChangeAccount) { _, _ in access }
        let revision = connected.revision

        let first = try await connection.discoverManagedCalendars(expectedRevision: revision, savedID: "saved", canRead: { true })
        check(first.selection.outcome == .incomplete && first.selection.candidates.isEmpty && first.selection.selected == nil,
              "a partial scan cannot choose, create, or bind")
        let firstPages = await fixture.pages
        let firstLookups = await fixture.lookups
        check(firstPages == Array(0..<10) && firstLookups.isEmpty, "yield at the page budget before checking a saved ID")

        let unavailable = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID,
                                                                        savedID: "saved", canRead: { true })
        check(unavailable.scanID == first.scanID && unavailable.connectionRevision == revision,
              "resume the same scan and connection")
        check(unavailable.selection.outcome == .savedUnavailable && unavailable.selection.selected == nil &&
              unavailable.selection.savedFailure == .notOwner,
              "an owner page cannot override the exact lookup reporting writer access")
        let completePages = await fixture.pages
        let unavailableLookups = await fixture.lookups
        check(completePages == Array(0..<12) && unavailableLookups == ["saved"], "finish paging and read the exact saved calendar")

        let replacement = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID,
                                                                        savedID: "saved", selectedID: "replacement",
                                                                        replacingUnavailable: true, canRead: { true })
        check(replacement.selection.outcome == .candidate && replacement.selection.selected?.record.id == "replacement" &&
              replacement.selection.candidates.map(\.record.id) == ["replacement"],
              "replacement excludes the unavailable saved ID, writers, and deleted calendars")

        await fixture.restoreOwnership()
        let restored = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID,
                                                                     savedID: "saved", canRead: { true })
        check(restored.selection.outcome == .candidate && restored.selection.selected?.recognition == .bound &&
              restored.selection.selected?.record.name == "Current provider name",
              "prefer the exact live saved record even when it has neither the name nor the setup marker")
        let finalPages = await fixture.pages
        let finalLookups = await fixture.lookups
        check(finalPages == completePages && finalLookups == ["saved", "saved", "replacement", "saved"],
              "reuse a complete scan but read exact saved and selected candidate records")
        let noLongerNeedsReplacement = try await connection.discoverManagedCalendars(
            expectedRevision: revision, resume: first.scanID, savedID: "saved", selectedID: "replacement",
            replacingUnavailable: true, canRead: { true }
        )
        check(noLongerNeedsReplacement.selection.selected?.recognition == .bound,
              "a replacement draft cannot bypass the now-eligible saved binding")

        await fixture.setSavedStatus(404)
        let missing = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID,
                                                                     savedID: "saved", canRead: { true })
        check(missing.selection.outcome == .savedUnavailable && missing.selection.savedFailure == .remoteUnavailable,
              "an exact missing response permits a separately reviewed replacement")
        await fixture.setSavedStatus(403)
        do {
            _ = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID, savedID: "saved",
                                                              selectedID: "replacement", replacingUnavailable: true, canRead: { true })
            preconditionFailure("Unverified access must not permit a replacement")
        } catch Failure.forbidden {}
        let deniedLookups = await fixture.lookups
        check(deniedLookups.suffix(2) == ["saved", "saved"], "forbidden saved access blocks a replacement lookup")

        await fixture.setSavedStatus(404)
        await fixture.revokeReplacementOwnership()
        do {
            _ = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID, savedID: "saved",
                                                              selectedID: "replacement", replacingUnavailable: true, canRead: { true })
            preconditionFailure("A page observation cannot prove current ownership of a replacement")
        } catch Failure.notOwner {}
        let changedRoleLookups = await fixture.lookups
        check(changedRoleLookups.suffix(2) == ["saved", "replacement"], "check current ownership of a selected replacement")

        var legacyState = try store.read()
        legacyState.discovery = .init(id: first.scanID, complete: true)
        try store.write(legacyState)
        let refreshed = try await connection.discoverManagedCalendars(expectedRevision: revision, resume: first.scanID, canRead: { true })
        let refreshedPages = await fixture.pages
        check(refreshed.scanID != first.scanID && refreshed.selection.outcome == .incomplete &&
              Array(refreshedPages.suffix(10)) == Array(0..<10), "restart an older capture that predates setup marker evidence")

        let captured = RemiloIOSGoogleCalendarWriteTransport.ManagedCreation(
            operationID: UUID(uuidString: reference)!, account: try connection.account(expectedRevision: revision), zoneID: "UTC"
        )
        do {
            _ = try await connection.checkManagedCreation(captured, expectedRevision: revision, returnedID: nil, resume: refreshed.scanID, canRead: { true })
            preconditionFailure("A setup discovery cursor cannot be reused for creation recovery")
        } catch Failure.staleCursor {}
        await fixture.setSavedStatus(200)
        await fixture.markSavedCalendar()
        let known = try await connection.checkManagedCreation(captured, expectedRevision: revision, returnedID: "saved", canRead: { true })
        guard case .verified(let record) = known, record.id == "saved" else { preconditionFailure("Verify the returned ID in CalendarList") }
        check(await fixture.pages == refreshedPages, "checking a returned ID does not search for a substitute")
        let partial = try await connection.checkManagedCreation(captured, expectedRevision: revision, returnedID: nil, canRead: { true })
        guard case .incomplete(let resume?) = partial else { preconditionFailure("Wait until all marker discovery pages are inspected") }
        let recovered = try await connection.checkManagedCreation(captured, expectedRevision: revision, returnedID: nil, resume: resume, canRead: { true })
        guard case .verified(let recoveredRecord) = recovered, recoveredRecord.id == "saved" else {
            preconditionFailure("A unique exact marker still requires a live CalendarList check")
        }
    }

    private static func record(id: String, summary: String, displayName: String? = nil, owner: String? = email,
                               zone: String = "UTC", primary: Bool = false, description: String? = nil) throws -> Discovery.Record {
        var json: [String: Any] = ["id": id, "summary": summary, "accessRole": "owner", "timeZone": zone, "primary": primary]
        json["summaryOverride"] = displayName
        json["dataOwner"] = owner
        json["description"] = description
        let data = try JSONSerialization.data(withJSONObject: json)
        return try Discovery.Record(JSONDecoder().decode(RemiloIOSGoogleCalendarTransport.OwnedCalendar.self, from: data))
    }

    private static func check(_ condition: Bool, _ message: String) {
        precondition(condition, message)
    }

    private static func expectFailure<Failure: Error & Equatable>(_ expected: Failure, _ perform: () throws -> Void) throws {
        do {
            try perform()
            preconditionFailure("Expected \(expected)")
        } catch let failure as Failure {
            precondition(failure == expected, "Expected \(expected), got \(failure)")
        }
    }

    private actor Fixture {
        private let owner: String
        private let marker: String
        private var savedRole = "writer"
        private var savedStatus = 200
        private var replacementRole = "owner"
        private var savedHasMarker = false
        private(set) var pages: [Int] = []
        private(set) var lookups: [String] = []

        init(owner: String, marker: String) {
            self.owner = owner
            self.marker = marker
        }

        func restoreOwnership() { savedRole = "owner" }
        func setSavedStatus(_ status: Int) { savedStatus = status }
        func revokeReplacementOwnership() { replacementRole = "writer" }
        func markSavedCalendar() { savedHasMarker = true }

        func send(_ request: URLRequest) throws -> HTTP.Response {
            guard let url = request.url else { throw Failure.invalidInput }
            precondition(request.httpMethod == "GET", "managed discovery must only read")
            let path = "/calendar/v3/users/me/calendarList"
            if url.path == path + "/saved" {
                lookups.append(url.lastPathComponent)
                if savedStatus != 200 { return .init(status: savedStatus, body: Data("{}".utf8)) }
                return try response(calendar("saved", summary: "Current provider name", role: savedRole,
                                             description: savedHasMarker ? marker : nil))
            }
            if url.path == path + "/replacement" {
                lookups.append(url.lastPathComponent)
                return try response(calendar("replacement", summary: "Remilo", role: replacementRole))
            }
            precondition(url.path == path, "unexpected discovery request")
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            precondition(query.contains(.init(name: "minAccessRole", value: "owner")))
            let page = query.first { $0.name == "pageToken" }?.value.flatMap(Int.init) ?? 0
            pages.append(page)
            var items: [[String: Any]] = []
            if page == 0 { items.append(calendar("saved", summary: "Remilo", description: marker)) }
            if page == 11 {
                items.append(calendar("replacement", summary: "Remilo"))
                items.append(calendar("shared", summary: "Remilo", role: "writer"))
                var deleted = calendar("deleted", summary: "Remilo")
                deleted["deleted"] = true
                items.append(deleted)
            }
            var payload: [String: Any] = ["items": items]
            if page < 11 { payload["nextPageToken"] = String(page + 1) }
            return try response(payload)
        }

        private func calendar(_ id: String, summary: String, role: String = "owner", description: String? = nil) -> [String: Any] {
            var fields: [String: Any] = ["id": id, "summary": summary, "accessRole": role, "timeZone": "UTC", "dataOwner": owner]
            fields["description"] = description
            return fields
        }

        private func response(_ payload: [String: Any]) throws -> HTTP.Response {
            HTTP.Response(status: 200, body: try JSONSerialization.data(withJSONObject: payload))
        }
    }
}
