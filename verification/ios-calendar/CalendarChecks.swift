import CryptoKit
import Foundation

@main
enum CalendarChecks {
    typealias HTTP = RemiloIOSGoogleCalendarHTTP
    typealias Purpose = RemiloIOSGoogleCalendarPurpose
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Configuration = RemiloIOSGoogleCalendarConfiguration

    private struct CheckFailure: Error { let message: String }

    static func main() async throws {
        let configuration = try configurationChecks()
        let fixture = Fixture()
        let http = HTTP(send: { request, _, _ in try await fixture.send(request) })
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let now: @Sendable () -> Date = { date }
        let auth = RemiloIOSGoogleCalendarAuthorization(http: http, now: now)
        let transport = RemiloIOSGoogleCalendarTransport(http: http, now: now)
        let budget = HTTP.Budget()
        let grant = try await authorize(configuration, http: http, fixture: fixture, budget: budget, now: now)

        let access = try await auth.verify(grant, configuration: configuration, expectedSubject: "subject-A", budget: budget)
        try check(access.account.subject == "subject-A" && access.account.email == "owner@example.test", "bind verified subject")
        try await reject(.accountChanged) {
            _ = try await auth.verify(grant, configuration: configuration, expectedSubject: "different-subject", budget: budget)
        }
        let beforeScopes = await fixture.requests.count
        try await reject(.needsAccess) {
            _ = try await auth.verify(grant, configuration: configuration, expectedSubject: "subject-A",
                                      purpose: .createManagedCalendar, budget: budget)
        }
        try await reject(.needsAccess) {
            let expired = try RemiloIOSGoogleCalendarGrant(token: "fixture-expired", scopes: Purpose.ownedCalendars.required,
                                                          expiresAt: date)
            _ = try await auth.verify(expired, configuration: configuration, expectedSubject: "subject-A", budget: budget)
        }
        let afterScopes = await fixture.requests.count
        try check(beforeScopes == afterScopes, "partial scopes and expired access never send a request")

        let discovery = try await transport.ownedCalendars(access, budget: budget)
        try check(discovery.items.map(\.displayName) == ["Renamed"], "discovery excludes shared/deleted entries")
        let discoveryNext = try await transport.ownedCalendars(access, next: discovery.next, budget: budget)
        try check(discoveryNext.items.isEmpty && discoveryNext.next == nil, "continue an owned calendar page")
        let discoveryRequest = try required(await fixture.requests.last, "capture discovery request")
        try check(discoveryRequest.url?.absoluteString.contains("pageToken=next%2B%2F%3D") == true,
                  "escape opaque page tokens without converting plus to space")

        let calendar = "owned/id@example.test"
        let full = try await transport.events(access, calendarID: calendar, listing: .incremental(since: nil), budget: budget)
        try check(full.items.map(\.id) == ["cancelled-event"] && full.items[0].cancelled, "retain deletion observations")
        try check(full.next != nil && full.checkpoint == nil, "only terminal pages can advance a sync token")
        let beforeStale = await fixture.requests.count
        try await reject(.invalidInput) {
            _ = try await transport.events(access, calendarID: "another", listing: .incremental(since: nil),
                                           next: full.next, budget: budget)
        }
        try await reject(.invalidInput) {
            _ = try await transport.events(access, calendarID: calendar, listing: .incremental(since: nil),
                                           next: discovery.next, budget: budget)
        }
        let afterStale = await fixture.requests.count
        try check(beforeStale == afterStale, "cursor mismatch fences I/O")
        let final = try await transport.events(access, calendarID: calendar, listing: .incremental(since: nil),
                                              next: full.next, budget: budget)
        let checkpoint = try required(final.checkpoint, "terminal checkpoint")
        try await reject(.syncTokenExpired) {
            _ = try await transport.events(access, calendarID: calendar, listing: .incremental(since: checkpoint), budget: budget)
        }
        let sync = try required(await fixture.requests.last?.url, "capture incremental request")
        try check(sync.absoluteString.contains("/owned%2Fid%40example.test/") &&
                  sync.absoluteString.contains("syncToken=checkpoint%2B%3D"), "bind and escape incremental identity")
        try check(!sync.absoluteString.contains("timeMin") && !sync.absoluteString.contains("orderBy") &&
                  sync.absoluteString.contains("showDeleted=true"), "incremental excludes incompatible filters")

        let event = try await transport.lookup(access, calendarID: calendar, eventID: "gone", budget: budget)
        guard case .deleted = event else { throw CheckFailure(message: "distinguish known deletion") }
        try await reject(.remoteUnavailable) {
            _ = try await transport.lookup(access, calendarID: calendar, eventID: "inaccessible", budget: budget)
        }
        try await reject(.budget) {
            _ = try await transport.ownedCalendars(access, budget: HTTP.Budget(duration: .seconds(-1)))
        }
        try await reject(.invalidInput) {
            _ = try await http.request(URLRequest(url: URL(string: "https://calendar.example.test/")!), budget: budget)
        }
        try await ConnectionChecks.run(configuration: configuration, access: access, now: now)
        try await ManagedDiscoveryChecks.run(configuration: configuration, access: access, now: now)
        try await RuntimeChecks.run(configuration: configuration, access: access, now: date)
        try EventChecks.run()
        try await RecurringReviewChecks.run(configuration: configuration, access: access, now: now)
        let writeGrant = try RemiloIOSGoogleCalendarGrant(token: "fixture-bearer", scopes: Purpose.writeOwnedEvents.required,
                                                          expiresAt: date.addingTimeInterval(3_600))
        let writeAccess = try await auth.verify(writeGrant, configuration: configuration, expectedSubject: "subject-A",
                                                purpose: .writeOwnedEvents)
        try check(!access.supports(.writeOwnedEvents, now: date) && writeAccess.supports(.ownedCalendars, now: date),
                  "write grants can read and browse grants cannot write")
        try await PublicationChecks.run(configuration: configuration, access: writeAccess, readOnly: access, now: now)
        try await SeriesTextWriterChecks.run(configuration: configuration, access: writeAccess, readOnly: access, now: now)
        try await SeriesTextWriterChecks.run(configuration: configuration, access: writeAccess, readOnly: access, now: now,
                                             editsSchedule: true)
        try await SeriesTextWriterChecks.run(configuration: configuration, access: writeAccess, readOnly: access, now: now,
                                             editsInstance: true)
        try await SeriesTextWriterChecks.run(configuration: configuration, access: writeAccess, readOnly: access, now: now,
                                             resumes: true)
        let creationGrant = try RemiloIOSGoogleCalendarGrant(token: "fixture-bearer", scopes: Purpose.createManagedCalendar.required,
                                                             expiresAt: date.addingTimeInterval(3_600))
        let creationAccess = try await auth.verify(creationGrant, configuration: configuration, expectedSubject: "subject-A",
                                                   purpose: .createManagedCalendar)
        try await ManagedCreationChecks.run(access: creationAccess, writeOnly: writeAccess, now: now)
        try await ManagedSetupChecks.run(configuration: configuration, readOnly: access, creation: creationAccess, now: now)
        ComparisonChecks.run()
        try await ManualLinkStoreChecks.run()
        try await ImportChecks.run()
        print("Swift Google Calendar checks passed")
    }

    private static func configurationChecks() throws -> Configuration {
        let client = "123-fixture.apps.googleusercontent.com"
        let scheme = "com.googleusercontent.apps.123-fixture"
        let bundle = "com.remilo.app.fixture"
        try check(Configuration(clientID: client, registeredBundleID: bundle, bundleID: "com.remilo.app",
                                urlSchemes: [scheme]) == nil, "reject mismatched signed bundle identity")
        try check(Configuration(clientID: client, registeredBundleID: bundle, bundleID: bundle,
                                urlSchemes: ["remilo"]) == nil, "require exact reversed-client scheme")
        return try required(Configuration(clientID: client, registeredBundleID: bundle, bundleID: bundle,
                                          urlSchemes: [scheme]), "valid fixture configuration")
    }

    private static func authorize(_ configuration: Configuration, http: HTTP, fixture: Fixture, budget: HTTP.Budget,
                                  now: @Sendable () -> Date) async throws -> RemiloIOSGoogleCalendarGrant {
        let attempt = RemiloIOSGoogleCalendarOAuth(configuration: configuration, purpose: .ownedCalendars)
        let browser = try attempt.browserURL()
        let fields = values(URLComponents(url: browser, resolvingAgainstBaseURL: false)?.queryItems)
        let state = try required(fields["state"], "include state")
        let redirect = try required(fields["redirect_uri"], "include redirect")
        try check(state.count == 43 && fields["access_type"] == "online" && fields["code_challenge_method"] == "S256",
                  "require an ephemeral S256 code grant")
        let scopes = Set((fields["scope"] ?? "").split(separator: " ").map(String.init))
        try check(scopes.contains("https://www.googleapis.com/auth/calendar.events.owned.readonly") &&
                  !scopes.contains("https://www.googleapis.com/auth/calendar.events.owned"), "browse consent only requests read access")
        let malformed = URL(string: redirect + "?state=wrong&code=fixture")!
        let repeated = URL(string: redirect + "?state=\(state)&code=fixture&code=other")!
        let denied = URL(string: redirect + "?state=\(state)&error=access_denied")!
        try await reject(.auth) { _ = try await attempt.exchange(callback: malformed, http: http, budget: budget, now: now) }
        try await reject(.auth) { _ = try await attempt.exchange(callback: repeated, http: http, budget: budget, now: now) }
        try await reject(.cancelled) { _ = try await attempt.exchange(callback: denied, http: http, budget: budget, now: now) }
        let beforeExchange = await fixture.requests.count
        try check(beforeExchange == 0, "invalid callbacks never reach the token endpoint")
        let callback = URL(string: redirect + "?state=\(state)&code=fixture%2B%2F%3D")!
        let grant = try await attempt.exchange(callback: callback, http: http, budget: budget, now: now)
        let request = try required(await fixture.requests.last, "capture token request")
        let form = request.httpBody.flatMap { String(data: $0, encoding: .utf8) }
        var parts = URLComponents()
        parts.percentEncodedQuery = form
        let token = values(parts.queryItems)
        let verifier = try required(token["code_verifier"], "send PKCE verifier")
        let digest = Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        try check(fields["code_challenge"] == digest && token["code"] == "fixture+/=" && token["client_secret"] == nil,
                  "exchange exactly the verified authorization code without a secret")
        try check(!String(reflecting: grant).contains("fixture-bearer"), "redact access grants in debug formatting")
        return grant
    }

    private static func values(_ fields: [URLQueryItem]?) -> [String: String] {
        Dictionary(uniqueKeysWithValues: (fields ?? []).compactMap { field in field.value.map { (field.name, $0) } })
    }

    private static func check(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        if !condition() { throw CheckFailure(message: message) }
    }

    private static func required<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else { throw CheckFailure(message: message) }
        return value
    }

    private static func reject(_ expected: Failure, _ block: () async throws -> Void) async throws {
        do { try await block() }
        catch let failure as Failure where failure == expected { return }
        throw CheckFailure(message: "expected \(expected.rawValue)")
    }

    private actor Fixture {
        private(set) var requests: [URLRequest] = []

        func send(_ request: URLRequest) throws -> HTTP.Response {
            requests.append(request)
            let url = try CalendarChecks.required(request.url, "request URL")
            let query = CalendarChecks.values(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
            if url.host == "oauth2.googleapis.com" {
                var scopes = Purpose.ownedCalendars.required
                scopes.remove("email")
                scopes.insert("https://www.googleapis.com/auth/userinfo.email")
                let body: [String: Any] = ["access_token": "fixture-bearer", "token_type": "Bearer", "expires_in": 3600,
                                           "scope": scopes.joined(separator: " "), "refresh_token": "ignored-fixture"]
                return HTTP.Response(status: 200, body: try JSONSerialization.data(withJSONObject: body))
            }
            try CalendarChecks.check(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture-bearer",
                                     "use bearer header exclusively")
            if url.host == "openidconnect.googleapis.com" {
                return Self.reply(200, #"{"sub":"subject-A","email":"owner@example.test","email_verified":true}"#)
            }
            if url.path.hasSuffix("/calendarList") {
                if query["pageToken"] != nil { return Self.reply(200, #"{}"#) }
                return Self.reply(200, #"{"items":[{"id":"owned","summary":"Original","summaryOverride":"Renamed","accessRole":"owner"},{"id":"shared","accessRole":"writer"},{"id":"removed","accessRole":"owner","deleted":true}],"nextPageToken":"next+/="}"#)
            }
            if url.path.hasSuffix("/gone") {
                return Self.reply(410, #"{"error":{"errors":[{"reason":"deleted"}]}}"#)
            }
            if url.path.hasSuffix("/inaccessible") { return Self.reply(410, #"{}"#) }
            if query["syncToken"] != nil { return Self.reply(410, #"{}"#) }
            if query["pageToken"] != nil { return Self.reply(200, #"{"items":[],"nextSyncToken":"checkpoint+="}"#) }
            return Self.reply(200, #"{"items":[{"id":"cancelled-event","status":"cancelled"}],"nextPageToken":"event-next"}"#)
        }

        private static func reply(_ status: Int, _ body: String) -> HTTP.Response {
            HTTP.Response(status: status, body: Data(body.utf8))
        }
    }
}
