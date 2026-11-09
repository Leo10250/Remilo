import Foundation

/// Read-only Google I/O. The eventual runner owns the serialized review, cache
/// checkpoint, and permission fences before accepting these observations.
struct RemiloIOSGoogleCalendarTransport: Sendable {
    typealias HTTP = RemiloIOSGoogleCalendarHTTP
    typealias Failure = RemiloIOSGoogleCalendarFailure

    struct OwnedCalendar: Decodable, Sendable {
        let id: String
        let summary: String?
        let summaryOverride: String?
        let timeZone: String?
        let description: String?
        let dataOwner: String?
        let primary: Bool?
        fileprivate let accessRole: String?
        fileprivate let deleted: Bool?

        var isOwned: Bool { accessRole == "owner" && deleted != true }

        var displayName: String? {
            if let summaryOverride, !summaryOverride.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return summaryOverride
            }
            return summary
        }
    }

    struct Event: Sendable {
        let id: String
        let etag: String?
        let cancelled: Bool
        /// Bounded provider data for native inspection, before an allowlisted cache projection.
        let json: Data

        var strongETag: String? { Self.validatedStrongETag(etag) }

        static func validatedStrongETag(_ etag: String?) -> String? {
            guard let etag, (2...512).contains(etag.utf8.count), etag.first == "\"", etag.last == "\"",
                  etag.utf8.dropFirst().dropLast().allSatisfy({ $0 == 33 || (35...126).contains($0) }) else { return nil }
            return etag
        }
    }

    enum EventLookup: Sendable {
        case found(Event)
        case missing
        case deleted
    }

    enum EventListing: Sendable {
        case expanded(from: Date, until: Date)
        case masters(from: Date, until: Date)
        case incremental(since: SyncCheckpoint?)
    }

    struct PageCursor: Codable, Sendable {
        fileprivate let token: String
        fileprivate let request: PageRequest
    }

    struct SyncCheckpoint: Codable, Sendable {
        fileprivate let token: String
        fileprivate let identity: Identity
        fileprivate let calendarID: String
    }

    struct Page<Row: Sendable>: Sendable {
        let items: [Row]
        let next: PageCursor?
        let checkpoint: SyncCheckpoint?
    }

    fileprivate struct Identity: Codable, Equatable, Sendable {
        let clientID: String
        let subject: String

        init(_ access: RemiloIOSGoogleCalendarAccess) {
            clientID = access.clientID
            subject = access.account.subject
        }
    }

    fileprivate struct PageRequest: Codable, Equatable, Sendable {
        let identity: Identity
        let path: [String]
        let parameters: [HTTP.Parameter]
    }

    private let http: HTTP
    private let now: @Sendable () -> Date

    init(http: HTTP = .init(), now: @escaping @Sendable () -> Date = { Date() }) {
        self.http = http
        self.now = now
    }

    func ownedCalendars(_ access: RemiloIOSGoogleCalendarAccess, next: PageCursor? = nil,
                        budget: HTTP.Budget) async throws -> Page<OwnedCalendar> {
        let request = PageRequest(identity: Identity(access), path: ["users", "me", "calendarList"],
                                  parameters: [.init("minAccessRole", "owner"), .init("maxResults", "100"), .init("showHidden", "true")])
        let page = try await fetchPage(access, request, next: next, budget: budget)
        let items = try page.items.map { try calendar($0) }.filter(\.isOwned)
        return Page(items: items, next: page.next, checkpoint: nil)
    }

    func ownedCalendar(_ access: RemiloIOSGoogleCalendarAccess, id: String, budget: HTTP.Budget) async throws -> OwnedCalendar {
        guard Self.validIdentity(id) else { throw Failure.invalidInput }
        let response = try await get(access, path: ["users", "me", "calendarList", id], budget: budget)
        try Self.validate(response)
        let result = try calendar(Self.object(response.body))
        guard result.id == id else { throw Failure.invalidResponse }
        guard result.isOwned else { throw Failure.notOwner }
        return result
    }

    func events(_ access: RemiloIOSGoogleCalendarAccess, calendarID: String, listing: EventListing,
                next: PageCursor? = nil, budget: HTTP.Budget) async throws -> Page<Event> {
        guard Self.validIdentity(calendarID) else { throw Failure.invalidInput }
        let identity = Identity(access)
        let path = ["calendars", calendarID, "events"]
        let parameters: [HTTP.Parameter]
        let incremental: Bool
        switch listing {
        case let .expanded(from, until):
            parameters = try Self.window(from, until, expand: true)
            incremental = false
        case let .masters(from, until):
            parameters = try Self.window(from, until, expand: false)
            incremental = false
        case let .incremental(checkpoint):
            var filters: [HTTP.Parameter] = [.init("maxResults", "100"), .init("singleEvents", "false"), .init("showDeleted", "true")]
            if let checkpoint {
                guard checkpoint.identity == identity, checkpoint.calendarID == calendarID,
                      Self.validIdentity(checkpoint.token) else { throw Failure.invalidInput }
                filters.append(.init("syncToken", checkpoint.token))
            }
            parameters = filters
            incremental = true
        }
        let request = PageRequest(identity: identity, path: path, parameters: parameters)
        let page = try await fetchPage(access, request, next: next, incremental: incremental, budget: budget)
        let items = try page.items.map(Self.event)
        var checkpoint: SyncCheckpoint?
        if incremental {
            if page.next == nil {
                guard let token = page.sync else { throw Failure.invalidResponse }
                checkpoint = SyncCheckpoint(token: token, identity: identity, calendarID: calendarID)
            } else if page.sync != nil {
                throw Failure.invalidResponse
            }
        }
        return Page(items: items, next: page.next, checkpoint: checkpoint)
    }

    func lookup(_ access: RemiloIOSGoogleCalendarAccess, calendarID: String, eventID: String,
                budget: HTTP.Budget) async throws -> EventLookup {
        guard Self.validIdentity(calendarID), Self.validIdentity(eventID) else { throw Failure.invalidInput }
        let response = try await get(access, path: ["calendars", calendarID, "events", eventID], budget: budget)
        if response.status == 404 { return .missing }
        if response.status == 410 {
            if Self.reason(response.body) == "deleted" { return .deleted }
            throw Failure.remoteUnavailable
        }
        try Self.validate(response)
        let event = try Self.event(Self.object(response.body))
        guard event.id == eventID else { throw Failure.invalidResponse }
        return .found(event)
    }

    func instance(_ access: RemiloIOSGoogleCalendarAccess, calendarID: String, masterID: String, originalStart: String,
                  budget: HTTP.Budget) async throws -> Event? {
        guard [calendarID, masterID, originalStart].allSatisfy(Self.validIdentity) else { throw Failure.invalidInput }
        let request = PageRequest(
            identity: Identity(access), path: ["calendars", calendarID, "events", masterID, "instances"],
            parameters: [.init("showDeleted", "true"), .init("maxResults", "100"), .init("originalStart", originalStart)]
        )
        let page = try await fetchPage(access, request, next: nil, budget: budget)
        guard page.next == nil, page.sync == nil, page.items.count <= 1 else { throw Failure.invalidResponse }
        return try page.items.first.map(Self.event)
    }

    private func fetchPage(_ access: RemiloIOSGoogleCalendarAccess, _ request: PageRequest,
                           next: PageCursor?, incremental: Bool = false, budget: HTTP.Budget)
        async throws -> (items: [[String: Any]], next: PageCursor?, sync: String?) {
        var query = request.parameters
        if let next {
            guard next.request == request, Self.validIdentity(next.token) else { throw Failure.invalidInput }
            query.append(.init("pageToken", next.token))
        }
        let response = try await get(access, path: request.path, query: query, budget: budget)
        try Self.validate(response, incremental: incremental)
        let object = try Self.object(response.body)
        let items = object["items"] ?? []
        guard let rows = items as? [[String: Any]], rows.count <= 100 else { throw Failure.invalidResponse }
        let pageToken = try Self.token(object["nextPageToken"])
        if let pageToken, pageToken == next?.token { throw Failure.invalidResponse }
        let cursor = pageToken.map { PageCursor(token: $0, request: request) }
        return (rows, cursor, try Self.token(object["nextSyncToken"]))
    }

    private func get(_ access: RemiloIOSGoogleCalendarAccess, path: [String], query: [HTTP.Parameter] = [],
                     budget: HTTP.Budget) async throws -> HTTP.Response {
        let url = try HTTP.url(host: "www.googleapis.com", path: ["calendar", "v3"] + path, query: query)
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        try access.authorize(&request, now: now())
        return try await http.request(request, budget: budget)
    }

    private func calendar(_ object: [String: Any]) throws -> OwnedCalendar {
        guard let bytes = try? JSONSerialization.data(withJSONObject: object),
              let calendar = try? JSONDecoder().decode(OwnedCalendar.self, from: bytes),
              Self.validIdentity(calendar.id) else { throw Failure.invalidResponse }
        return calendar
    }

    private static func event(_ object: [String: Any]) throws -> Event {
        guard let id = object["id"] as? String, validIdentity(id),
              let bytes = try? JSONSerialization.data(withJSONObject: object) else { throw Failure.invalidResponse }
        return Event(id: id, etag: object["etag"] as? String, cancelled: object["status"] as? String == "cancelled", json: bytes)
    }

    private static func token(_ value: Any?) throws -> String? {
        guard let value else { return nil }
        guard let text = value as? String, validIdentity(text) else { throw Failure.invalidResponse }
        return text
    }

    static func validIdentity(_ value: String) -> Bool {
        (1...4096).contains(value.utf8.count) && value != "." && value != ".."
            && !value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
    }

    private static func window(_ from: Date, _ until: Date, expand: Bool) throws -> [HTTP.Parameter] {
        guard from.timeIntervalSince1970.isFinite, until.timeIntervalSince1970.isFinite, from < until else {
            throw Failure.invalidInput
        }
        let time = ISO8601DateFormatter()
        var parameters: [HTTP.Parameter] = [
            .init("maxResults", "100"), .init("singleEvents", expand ? "true" : "false"), .init("showDeleted", "false"),
            .init("timeMin", time.string(from: from)), .init("timeMax", time.string(from: until)),
        ]
        if expand { parameters += [.init("orderBy", "startTime"), .init("eventTypes", "default")] }
        return parameters
    }

    private static func object(_ data: Data) throws -> [String: Any] {
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw Failure.invalidResponse
        }
        return object
    }

    static func reason(_ data: Data) -> String? {
        let error = (try? object(data))?["error"] as? [String: Any]
        return (error?["errors"] as? [[String: Any]])?.first?["reason"] as? String
    }

    private static func validate(_ response: HTTP.Response, incremental: Bool = false) throws {
        switch response.status {
        case 200: return
        case 400: throw Failure.badRequest
        case 401: throw Failure.auth
        case 403:
            switch reason(response.body) {
            case "rateLimitExceeded", "userRateLimitExceeded": throw Failure.retry
            case "insufficientPermissions": throw Failure.auth
            default: throw Failure.forbidden
            }
        case 404: throw Failure.notFound
        case 410: throw incremental ? Failure.syncTokenExpired : .remoteUnavailable
        case 429, 500...599: throw Failure.retry
        default: throw Failure.apiError
        }
    }
}
