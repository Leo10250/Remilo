import Foundation

/// The durable Calendar worker supplies the final permission check and records
/// that an exact captured request may have been sent. This layer owns no local mutation.
struct RemiloIOSGoogleCalendarWriteTransport: Sendable {
    typealias HTTP = RemiloIOSGoogleCalendarHTTP
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias Publication = RemiloIOSGoogleCalendarPublication
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Failure = RemiloIOSGoogleCalendarFailure

    enum Phase: Equatable, Sendable { case notSent, sent }
    enum Permission: Sendable { case granted, alreadySent, denied(Failure) }

    struct Patch: Sendable {
        let operationID: UUID
        let account: Publication.Account
        let local: Publication.Local
        let calendarID: String
        let eventID: String
        let etag: String
        fileprivate let payload: PatchPayload
        private let schedule: Event.Schedule?
        private let calendarZone: String

        init(operationID: UUID, account: Publication.Account, local: Publication.Local, calendarID: String,
             reviewedRemote: Transport.Event, calendarZone: String, desired: Event.Fields,
             suppressGoogleReminders: Bool = false) throws {
            guard let etag = reviewedRemote.etag, Self.validETag(etag), !reviewedRemote.cancelled,
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(reviewedRemote.json),
                  account.connectionRevision > 0, account.accountGeneration > 0, local.revision > 0, local.generation >= 0,
                  !local.occurrenceID.isEmpty, !calendarID.isEmpty, !reviewedRemote.id.isEmpty,
                  !desired.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  desired.title.utf16.count <= 200, desired.notes.utf16.count <= 10_000 else { throw Failure.invalidInput }
            let before = try Event.fields(object, calendarZone: calendarZone).fields
            guard before.schedule.recurrence == nil, desired.schedule.recurrence == nil,
                  before.schedule.allDay == desired.schedule.allDay else { throw Failure.invalidInput }
            let title = before.title == desired.title ? nil : desired.title
            let notes = before.notes == desired.notes ? nil : desired.notes
            let schedule = before.schedule == desired.schedule ? nil : desired.schedule
            guard title != nil || notes != nil || schedule != nil || suppressGoogleReminders else { throw Failure.invalidInput }
            let bounds = try schedule.map(Publication.Bounds.init)
            self.operationID = operationID
            self.account = account
            self.local = local
            self.calendarID = calendarID
            eventID = reviewedRemote.id
            self.etag = etag
            self.schedule = schedule
            self.calendarZone = calendarZone
            payload = PatchPayload(summary: title, description: notes, start: bounds?.start, end: bounds?.end,
                                   reminders: suppressGoogleReminders ? NoReminders() : nil)
        }

        func matches(_ observed: Transport.Event) -> Bool {
            guard observed.id == eventID, !observed.cancelled,
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(observed.json),
                  let fields = try? Event.fields(object, calendarZone: calendarZone).fields else { return false }
            if let summary = payload.summary, object["summary"] as? String != summary { return false }
            if let description = payload.description, fields.notes != description { return false }
            if let schedule, fields.schedule != schedule { return false }
            if payload.reminders != nil {
                guard let reminders = object["reminders"] as? [String: Any], reminders["useDefault"] as? Bool == false,
                      reminders["overrides"] == nil || (reminders["overrides"] as? [Any])?.isEmpty == true else { return false }
            }
            return true
        }

        fileprivate func mayWrite(_ observed: Transport.Event) -> Bool {
            guard observed.id == eventID, !observed.cancelled, observed.etag == etag,
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(observed.json),
                  let fields = try? Event.fields(object, calendarZone: calendarZone).fields else { return false }
            return fields.schedule.recurrence == nil
        }

        private static func validETag(_ value: String) -> Bool {
            guard (2...512).contains(value.utf8.count), value.first == "\"", value.last == "\"" else { return false }
            return value.utf8.dropFirst().dropLast().allSatisfy { $0 == 33 || (35...126).contains($0) }
        }
    }

    enum PatchOutcome: Sendable {
        case confirmed(Transport.Event)
        case staleRemote
        case remoteUnavailable
        case notSent(Failure)
        case rejected(Failure)
        case unconfirmed(Failure?)
    }

    fileprivate struct NoReminders: Encodable, Sendable {
        let useDefault = false
        let overrides: [String] = []
    }

    fileprivate struct PatchPayload: Encodable, Sendable {
        let summary: String?
        let description: String?
        let start: Publication.Bound?
        let end: Publication.Bound?
        let reminders: NoReminders?
    }

    private struct InsertPayload: Encodable {
        let id: String
        let summary: String
        let description: String
        let start: Publication.Bound
        let end: Publication.Bound
        let extendedProperties: [String: [String: String]]
        let visibility = "private"
        let transparency = "opaque"
        let reminders = NoReminders()
    }

    private enum Response {
        case accepted(Transport.Event)
        case duplicate
        case staleRemote
        case rejected(Failure)
        case uncertain(Failure)
    }

    private let http: HTTP
    private let transport: Transport
    private let now: @Sendable () -> Date

    init(http: HTTP = .init(), now: @escaping @Sendable () -> Date = { Date() }) {
        self.http = http
        self.transport = Transport(http: http, now: now)
        self.now = now
    }

    func publish(_ request: Publication.Request, access: RemiloIOSGoogleCalendarAccess, phase: Phase,
                 budget: HTTP.Budget = .init(),
                 permitSend: @Sendable (Publication.Request) async throws -> Permission) async throws -> Publication.Outcome {
        let request = try request.validated()
        guard request.account.matches(access) else { throw Failure.accountChanged }
        let identity = try request.readbackIdentity()
        _ = try await transport.ownedCalendar(access, id: request.calendarID, budget: budget)
        let existing = try await transport.lookup(access, calendarID: request.calendarID, eventID: request.eventID, budget: budget)
        if let known = Publication.inspect(existing, for: identity) { return known }
        guard phase == .notSent else { return .unconfirmed(nil) }
        let bounds = try Publication.Bounds(request.fields.schedule)
        let payload = InsertPayload(id: request.eventID, summary: request.fields.title, description: request.fields.notes,
                                    start: bounds.start, end: bounds.end,
                                    extendedProperties: ["private": ["remiloPublication": request.eventID]])
        let wire = try makeRequest(access, calendarID: request.calendarID, eventID: nil, method: "POST", payload: payload)
        guard !Task.isCancelled else { return .notSent(.cancelled) }
        switch try await permitSend(request) {
        case .granted: break
        case .alreadySent: return await readBackPublication(identity, access: access, budget: budget, failure: nil)
        case .denied(let reason): return .notSent(reason)
        }
        switch await send(wire, expectedID: request.eventID, budget: budget) {
        case .accepted(let event):
            return Publication.inspect(.found(event), for: identity) ?? .unconfirmed(.invalidResponse)
        case .duplicate:
            return await readBackPublication(identity, access: access, budget: budget, failure: nil)
        case .uncertain(let failure):
            return await readBackPublication(identity, access: access, budget: budget, failure: failure)
        case .staleRemote:
            return .rejected(.apiError)
        case .rejected(let failure):
            return .rejected(failure)
        }
    }

    func checkPublication(_ identity: Publication.ReadbackIdentity, access: RemiloIOSGoogleCalendarAccess,
                          budget: HTTP.Budget = .init()) async throws -> Publication.Outcome {
        try identity.validate()
        guard identity.account.matches(access) else { throw Failure.accountChanged }
        _ = try await transport.ownedCalendar(access, id: identity.calendarID, budget: budget)
        let lookup = try await transport.lookup(access, calendarID: identity.calendarID, eventID: identity.eventID, budget: budget)
        return Publication.inspect(lookup, for: identity) ?? .unconfirmed(nil)
    }

    func patch(_ patch: Patch, access: RemiloIOSGoogleCalendarAccess, phase: Phase,
               budget: HTTP.Budget = .init(),
               permitSend: @Sendable (Patch) async throws -> Permission) async throws -> PatchOutcome {
        guard patch.account.matches(access) else { throw Failure.accountChanged }
        _ = try await transport.ownedCalendar(access, id: patch.calendarID, budget: budget)
        let lookup = try await transport.lookup(access, calendarID: patch.calendarID, eventID: patch.eventID, budget: budget)
        guard case .found(let observed) = lookup, !observed.cancelled else { return .remoteUnavailable }
        if patch.matches(observed) { return .confirmed(observed) }
        guard phase == .notSent else { return .unconfirmed(nil) }
        guard patch.mayWrite(observed) else { return .staleRemote }
        let wire = try makeRequest(access, calendarID: patch.calendarID, eventID: patch.eventID, method: "PATCH",
                                   payload: patch.payload, etag: patch.etag)
        guard !Task.isCancelled else { return .notSent(.cancelled) }
        switch try await permitSend(patch) {
        case .granted: break
        case .alreadySent: return await readBackPatch(patch, access: access, budget: budget, failure: nil)
        case .denied(let reason): return .notSent(reason)
        }
        switch await send(wire, expectedID: patch.eventID, budget: budget) {
        case .accepted(let event) where patch.matches(event): return .confirmed(event)
        case .staleRemote: return .staleRemote
        case .rejected(let failure): return .rejected(failure)
        case .uncertain(let failure): return await readBackPatch(patch, access: access, budget: budget, failure: failure)
        case .accepted, .duplicate: return await readBackPatch(patch, access: access, budget: budget, failure: .invalidResponse)
        }
    }

    private func makeRequest<T: Encodable>(_ access: RemiloIOSGoogleCalendarAccess, calendarID: String,
                                           eventID: String?, method: String, payload: T, etag: String? = nil) throws -> URLRequest {
        let path = ["calendar", "v3", "calendars", calendarID, "events"] + (eventID.map { [$0] } ?? [])
        let url = try HTTP.url(host: "www.googleapis.com", path: path, query: [.init("sendUpdates", "none")])
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        if let etag { request.setValue(etag, forHTTPHeaderField: "If-Match") }
        try access.authorize(&request, for: .writeOwnedEvents, now: now())
        request.httpBody = try JSONEncoder().encode(payload)
        return request
    }

    private func send(_ request: URLRequest, expectedID: String, budget: HTTP.Budget) async -> Response {
        let response: HTTP.Response
        do { response = try await http.request(request, budget: budget) }
        catch let failure as Failure { return .uncertain(failure) }
        catch { return .uncertain(.network) }
        switch response.status {
        case 200, 201:
            guard let object = Self.object(response.body), object["id"] as? String == expectedID else {
                return .uncertain(.invalidResponse)
            }
            return .accepted(Transport.Event(id: expectedID, etag: object["etag"] as? String,
                                             cancelled: object["status"] as? String == "cancelled", json: response.body))
        case 400: return .rejected(.badRequest)
        case 401: return .rejected(.auth)
        case 403:
            let error = Self.object(response.body)?["error"] as? [String: Any]
            let reason = (error?["errors"] as? [[String: Any]])?.first?["reason"] as? String
            switch reason {
            case "rateLimitExceeded", "userRateLimitExceeded": return .rejected(.retry)
            case "insufficientPermissions": return .rejected(.auth)
            default: return .rejected(.forbidden)
            }
        case 404: return .rejected(.notFound)
        case 409: return .duplicate
        case 412: return .staleRemote
        case 429, 500...599: return .uncertain(.retry)
        default: return .uncertain(.apiError)
        }
    }

    private func readBackPublication(_ identity: Publication.ReadbackIdentity, access: RemiloIOSGoogleCalendarAccess,
                                     budget: HTTP.Budget, failure: Failure?) async -> Publication.Outcome {
        do {
            let lookup = try await transport.lookup(access, calendarID: identity.calendarID, eventID: identity.eventID, budget: budget)
            return Publication.inspect(lookup, for: identity) ?? .unconfirmed(failure)
        } catch { return .unconfirmed(error as? Failure ?? failure ?? .network) }
    }

    private func readBackPatch(_ patch: Patch, access: RemiloIOSGoogleCalendarAccess, budget: HTTP.Budget,
                               failure: Failure?) async -> PatchOutcome {
        do {
            let lookup = try await transport.lookup(access, calendarID: patch.calendarID, eventID: patch.eventID, budget: budget)
            if case .found(let event) = lookup, patch.matches(event) { return .confirmed(event) }
            return .unconfirmed(failure)
        } catch { return .unconfirmed(error as? Failure ?? failure ?? .network) }
    }

    private static func object(_ data: Data) -> [String: Any]? {
        (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
}
