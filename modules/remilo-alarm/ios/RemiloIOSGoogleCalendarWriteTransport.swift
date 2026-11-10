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

    struct ManagedCreation: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Publication.Account
        let zoneID: String
    }

    enum ManagedCreationOutcome: Sendable {
        case returnedID(String)
        case notSent(Failure)
        case rejected(Failure)
        case unconfirmed(Failure?)
    }

    /// Captured from Google's instance lookup. The slot is the original
    /// start in the master, even when the child's actual start has moved.
    struct InstanceObservation: Codable, Equatable, Sendable {
        let subject: String
        let clientID: String
        let lease: RemiloIOSGoogleCalendarManualLink.ManagedLease
        let identity: Event.InstanceIdentity
        let originalStart: String
        let masterETag: String
        let masterZone: String
        let etag: String
        let fields: Event.Fields

        fileprivate func identifies(_ event: Transport.Event) -> Bool {
            Self.identifies(event, identity: identity, originalStart: originalStart, masterZone: masterZone)
        }

        fileprivate static func identifies(_ event: Transport.Event, identity: Event.InstanceIdentity,
                                           originalStart: String, masterZone: String) -> Bool {
            guard let observed = try? Event.originalInstance(event, masterZoneID: masterZone),
                  observed.eventID == identity.eventID, observed.masterID == identity.masterID,
                  observed.nominalSlot == identity.nominalSlot,
                  let raw = RemiloIOSGoogleCalendarWriteTransport.object(event.json)?["originalStartTime"] as? [String: Any] else { return false }
            if originalStart.hasSuffix("Z") {
                guard let original = raw["dateTime"] as? String, let actual = try? Event.timestamp(original) else { return false }
                return actual == (try? Event.timestamp(originalStart))
            }
            return raw["date"] as? String == originalStart
        }
    }

    struct Patch: Sendable {
        let operationID: UUID
        let account: Publication.Account
        let local: Publication.Local
        let calendarID: String
        let eventID: String
        let etag: String
        fileprivate let payload: PatchPayload
        private let evidence: RemiloIOSGoogleCalendarManualLink.Evidence?
        private let schedule: Event.Schedule?
        private let seriesFields: Event.Fields?
        private let seriesBeforeSchedule: Event.Schedule?
        fileprivate let instance: InstanceObservation?
        private let instanceDesired: Event.Fields?
        fileprivate let calendarZone: String
        fileprivate let managedLease: RemiloIOSGoogleCalendarManualLink.ManagedLease?

        init(operationID: UUID, account: Publication.Account, local: Publication.Local, calendarID: String,
             reviewedRemote: Transport.Event, calendarZone: String, desired: Event.Fields,
             suppressGoogleReminders: Bool = false, evidence: RemiloIOSGoogleCalendarManualLink.Evidence? = nil) throws {
            guard let etag = reviewedRemote.strongETag, !reviewedRemote.cancelled,
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(reviewedRemote.json) else { throw Failure.invalidInput }
            if let evidence, !evidence.identifies(reviewedRemote) { throw Failure.invalidInput }
            let before = try Event.fields(object, calendarZone: calendarZone).fields
            try self.init(operationID: operationID, account: account, local: local, calendarID: calendarID,
                          eventID: reviewedRemote.id, etag: etag, before: before, calendarZone: calendarZone,
                          desired: desired, suppressGoogleReminders: suppressGoogleReminders, evidence: evidence)
        }

        init(_ transfer: RemiloIOSGoogleCalendarManualLink.Transfer) throws {
            let before = transfer.remote.fields
            let desired = transfer.desired
            if before.schedule != desired.schedule, desired.schedule.allDay {
                let zone = before.schedule.allDay ? before.schedule.zoneId : transfer.remote.calendarZone
                guard zone == desired.schedule.zoneId else { throw RemiloIOSGoogleCalendarManualLink.Failure.unsupported }
            }
            try self.init(operationID: transfer.operationID, account: transfer.account, local: transfer.local.version,
                          calendarID: transfer.remote.source.calendarID, eventID: transfer.remote.source.eventID,
                          etag: transfer.remote.etag, before: before, calendarZone: transfer.remote.calendarZone,
                          desired: desired, suppressGoogleReminders: false, evidence: transfer.evidence,
                          managedLease: transfer.automatic?.managedLease)
        }

        init(series operationID: UUID, account: Publication.Account, snapshot: IOSCalendarSeriesTextSnapshot,
             source: RemiloIOSGoogleCalendarImport.Source, lease: RemiloIOSGoogleCalendarManualLink.ManagedLease,
             desiredSchedule: Event.Schedule? = nil) throws {
            guard source.key.subject == account.subject, source.key.calendarID == lease.calendarID,
                  source.calendarZone == lease.zoneID else { throw Failure.invalidInput }
            let local = Publication.Local(occurrenceID: snapshot.segmentID, revision: snapshot.revision, generation: 0)
            let desired = Event.Fields(title: snapshot.title, notes: snapshot.notes, schedule: desiredSchedule ?? source.fields.schedule)
            try self.init(operationID: operationID, account: account, local: local, calendarID: source.key.calendarID,
                          eventID: source.key.eventID, etag: source.etag, before: source.fields, calendarZone: source.calendarZone,
                          desired: desired, suppressGoogleReminders: false, evidence: nil, managedLease: lease, recurringMaster: true)
        }

        init(instance operationID: UUID, account: Publication.Account, local: Publication.Local,
             observed: InstanceObservation, lease: RemiloIOSGoogleCalendarManualLink.ManagedLease,
             desired: Event.Fields) throws {
            guard observed.subject == account.subject, observed.clientID == account.clientID, observed.lease == lease,
                  !observed.identity.cancelled, Transport.Event.validatedStrongETag(observed.masterETag) != nil,
                  observed.fields.schedule == desired.schedule || !desired.schedule.allDay ||
                    (desired.schedule.zoneId == lease.zoneID && observed.masterZone == lease.zoneID) else {
                throw Failure.invalidInput
            }
            try self.init(operationID: operationID, account: account, local: local, calendarID: lease.calendarID,
                          eventID: observed.identity.eventID, etag: observed.etag, before: observed.fields,
                          calendarZone: lease.zoneID, desired: desired, suppressGoogleReminders: false,
                          evidence: nil, managedLease: lease, instance: observed)
        }

        private init(operationID: UUID, account: Publication.Account, local: Publication.Local, calendarID: String,
                     eventID: String, etag: String, before: Event.Fields, calendarZone: String, desired: Event.Fields,
                     suppressGoogleReminders: Bool, evidence: RemiloIOSGoogleCalendarManualLink.Evidence?,
                     managedLease: RemiloIOSGoogleCalendarManualLink.ManagedLease? = nil, recurringMaster: Bool = false,
                     instance: InstanceObservation? = nil) throws {
            guard Transport.Event.validatedStrongETag(etag) != nil,
                  account.connectionRevision > 0, account.accountGeneration > 0, local.revision > 0, local.generation >= 0,
                  !local.occurrenceID.isEmpty, !calendarID.isEmpty, !eventID.isEmpty,
                  !desired.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  desired.title.utf16.count <= 200, desired.notes.utf16.count <= 10_000 else { throw Failure.invalidInput }
            if let evidence {
                guard evidence.source.belongs(to: account), evidence.source.calendarID == calendarID,
                      evidence.source.eventID == eventID else { throw Failure.invalidInput }
            }
            if recurringMaster {
                guard before.schedule.recurrence != nil, desired.schedule.recurrence != nil, !suppressGoogleReminders,
                      before.schedule == desired.schedule || !desired.schedule.allDay || desired.schedule.zoneId == calendarZone else {
                    throw Failure.invalidInput
                }
            } else {
                guard before.schedule.recurrence == nil, desired.schedule.recurrence == nil else { throw Failure.invalidInput }
            }
            let title = before.title == desired.title ? nil : desired.title
            let notes = before.notes == desired.notes ? nil : desired.notes
            let schedule = before.schedule == desired.schedule ? nil : desired.schedule
            guard title != nil || notes != nil || schedule != nil || suppressGoogleReminders else { throw Failure.invalidInput }
            let bounds = try schedule.map { schedule in
                try Publication.Bounds(.init(eventStartMs: schedule.eventStartMs, eventEndMs: schedule.eventEndMs,
                                             allDay: schedule.allDay, zoneId: schedule.zoneId, recurrence: nil))
            }
            self.operationID = operationID
            self.account = account
            self.local = local
            self.calendarID = calendarID
            self.eventID = eventID
            self.etag = etag
            self.evidence = evidence
            self.schedule = schedule
            self.seriesFields = recurringMaster ? desired : nil
            self.seriesBeforeSchedule = recurringMaster ? before.schedule : nil
            self.instance = instance
            self.instanceDesired = instance == nil ? nil : desired
            self.calendarZone = calendarZone
            self.managedLease = managedLease
            let switchesRepresentation = before.schedule.allDay != desired.schedule.allDay
            payload = PatchPayload(summary: title, description: notes,
                                   start: bounds.map { PatchBound(value: $0.start, switchesRepresentation: switchesRepresentation) },
                                   end: bounds.map { PatchBound(value: $0.end, switchesRepresentation: switchesRepresentation) },
                                   reminders: suppressGoogleReminders ? NoReminders() : nil,
                                   recurrence: recurringMaster ? schedule?.recurrence : nil)
        }

        func matches(_ observed: Transport.Event) -> Bool {
            guard identifies(observed),
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(observed.json),
                  let fields = self.fields(of: observed, object: object) else { return false }
            if let seriesFields { return fields == seriesFields }
            if let instanceDesired { return observed.strongETag != nil && fields == instanceDesired }
            guard fields.schedule.recurrence == nil else { return false }
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
            guard identifies(observed), observed.strongETag == etag,
                  let object = RemiloIOSGoogleCalendarWriteTransport.object(observed.json),
                  let fields = self.fields(of: observed, object: object) else { return false }
            if let seriesBeforeSchedule { return fields.schedule == seriesBeforeSchedule }
            if let instance { return fields == instance.fields }
            return fields.schedule.recurrence == nil
        }

        private func fields(of observed: Transport.Event, object: [String: Any]) -> Event.Fields? {
            if let instance {
                return try? RemiloIOSGoogleCalendarRecurringReview.instanceFields(observed, zoneID: instance.masterZone)
            }
            return try? Event.fields(object, calendarZone: calendarZone).fields
        }

        fileprivate func identifies(_ observed: Transport.Event) -> Bool {
            observed.id == eventID && !observed.cancelled && (evidence?.identifies(observed) ?? true) &&
                (instance?.identifies(observed) ?? true)
        }
    }

    enum PatchOutcome: Sendable {
        case confirmed(Transport.Event)
        case staleRemote
        case remoteUnavailable
        case remoteRemoved
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
        let start: PatchBound?
        let end: PatchBound?
        let reminders: NoReminders?
        let recurrence: [String]?
    }

    fileprivate struct PatchBound: Encodable, Sendable {
        let value: Publication.Bound
        let switchesRepresentation: Bool

        private enum CodingKeys: String, CodingKey { case date, dateTime, timeZone }

        func encode(to encoder: Encoder) throws {
            var fields = encoder.container(keyedBy: CodingKeys.self)
            try fields.encodeIfPresent(value.date, forKey: .date)
            try fields.encodeIfPresent(value.dateTime, forKey: .dateTime)
            try fields.encodeIfPresent(value.timeZone, forKey: .timeZone)
            // A PATCH leaves omitted nested fields in place.
            if switchesRepresentation {
                if value.date == nil {
                    try fields.encodeNil(forKey: .date)
                } else {
                    try fields.encodeNil(forKey: .dateTime)
                    try fields.encodeNil(forKey: .timeZone)
                }
            }
        }
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

    private struct ManagedCalendarPayload: Encodable {
        let summary = "Remilo"
        let description: String
        let timeZone: String
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

    /// Google assigns the ID. After the sent checkpoint, only the caller's
    /// read-only recovery may run. The caller saves a returned ID before validation.
    func createManagedCalendar(_ captured: ManagedCreation, access: RemiloIOSGoogleCalendarAccess, phase: Phase,
                               budget: HTTP.Budget = .init(),
                               permitSend: @Sendable (ManagedCreation) async throws -> Permission) async throws -> ManagedCreationOutcome {
        guard captured.account.matches(access) else { throw Failure.accountChanged }
        guard captured.account.connectionRevision > 0, captured.account.accountGeneration > 0 else { throw Failure.invalidInput }
        guard phase == .notSent else { return .unconfirmed(nil) }
        guard (try? Event.namedZone(captured.zoneID)) != nil else { throw Failure.invalidZone }
        let url = try HTTP.url(host: "www.googleapis.com", path: ["calendar", "v3", "calendars"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json; charset=UTF-8", forHTTPHeaderField: "Content-Type")
        try access.authorize(&request, for: .createManagedCalendar, now: now())
        request.httpBody = try JSONEncoder().encode(ManagedCalendarPayload(
            description: RemiloIOSGoogleCalendarManagedDiscovery.marker(captured.operationID), timeZone: captured.zoneID
        ))
        guard !Task.isCancelled else { return .notSent(.cancelled) }
        guard budget.hasTimeRemaining else { return .notSent(.budget) }
        switch try await permitSend(captured) {
        case .granted: break
        case .alreadySent: return .unconfirmed(nil)
        case .denied(let failure): return .notSent(failure)
        }
        let response: HTTP.Response
        do {
            // The checkpoint has been recorded. Finish bounded I/O even if the
            // foreground caller goes away so a returned ID can still be saved.
            let wire = request
            response = try await Task { try await http.request(wire, budget: budget) }.value
        }
        catch let failure as Failure { return .unconfirmed(failure) }
        catch { return .unconfirmed(.network) }
        switch response.status {
        case 200, 201:
            guard let id = Self.object(response.body)?["id"] as? String, Transport.validIdentity(id) else {
                return .unconfirmed(.invalidResponse)
            }
            return .returnedID(id)
        case 400: return .rejected(.badRequest)
        case 401: return .rejected(.auth)
        case 403:
            switch Transport.reason(response.body) {
            case "rateLimitExceeded", "userRateLimitExceeded": return .unconfirmed(.retry)
            case "insufficientPermissions": return .rejected(.auth)
            default: return .rejected(.forbidden)
            }
        case 429, 500...599: return .unconfirmed(.retry)
        default: return .unconfirmed(.apiError)
        }
    }

    func publish(_ request: Publication.Request, access: RemiloIOSGoogleCalendarAccess, phase: Phase,
                 budget: HTTP.Budget = .init(),
                 managedLease: RemiloIOSGoogleCalendarManualLink.ManagedLease? = nil,
                 permitSend: @Sendable (Publication.Request) async throws -> Permission) async throws -> Publication.Outcome {
        let request = try request.validated()
        guard request.account.matches(access) else { throw Failure.accountChanged }
        let identity = try request.readbackIdentity()
        let calendar = try await transport.ownedCalendar(access, id: request.calendarID, budget: budget)
        if phase == .notSent, let managedLease {
            try managedLease.verify(calendar, email: access.account.email)
            if request.fields.schedule.allDay, request.fields.schedule.zoneId != managedLease.zoneID {
                return .notSent(.invalidZone)
            }
        }
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

    func resolveInstance(access: RemiloIOSGoogleCalendarAccess, lease: RemiloIOSGoogleCalendarManualLink.ManagedLease,
                         masterID: String, masterETag: String, nominalSlot: String,
                         budget: HTTP.Budget = .init()) async throws -> InstanceObservation {
        let calendar = try await transport.ownedCalendar(access, id: lease.calendarID, budget: budget)
        try lease.verify(calendar, email: access.account.email)
        let lookup = try await transport.lookup(access, calendarID: calendar.id, eventID: masterID, budget: budget)
        guard case .found(let master) = lookup, !master.cancelled, master.strongETag == masterETag,
              let raw = Self.object(master.json) else { throw RemiloIOSGoogleCalendarImport.Failure.staleRemote }
        let parsed = try Event.fields(raw, calendarZone: lease.zoneID)
        guard let rule = parsed.rule, let index = try RemiloIOSRecurrence.index(nominalSlot, in: rule) else {
            throw Event.Reason.invalidInstance
        }
        let zone = try Event.namedZone(parsed.fields.schedule.zoneId)
        let slot = try RemiloIOSRecurrence.resolve(rule, nominal: nominalSlot, deviceZone: zone, index: index)
        let original = rule.allDay ? String(slot.nominalSlot.prefix(10)) : Event.nominal(slot.eventStartMs, zone: Event.utc) + "Z"
        guard let child = try await transport.instance(access, calendarID: calendar.id, masterID: masterID,
                                                       originalStart: original, budget: budget) else { throw Failure.remoteUnavailable }
        let identity = try Event.originalInstance(child, masterZoneID: parsed.fields.schedule.zoneId)
        guard identity.masterID == masterID, identity.nominalSlot == slot.nominalSlot,
              InstanceObservation.identifies(child, identity: identity, originalStart: original,
                                             masterZone: parsed.fields.schedule.zoneId) else { throw Event.Reason.invalidInstance }
        guard !child.cancelled else { throw Event.Reason.removed }
        guard let etag = child.strongETag else { throw Event.Reason.invalidInstance }
        let fields = try RemiloIOSGoogleCalendarRecurringReview.instanceFields(child, zoneID: parsed.fields.schedule.zoneId)
        guard fields.schedule.recurrence == nil else { throw Event.Reason.invalidInstance }
        let latest = try await transport.lookup(access, calendarID: calendar.id, eventID: masterID, budget: budget)
        guard case .found(let current) = latest, !current.cancelled, current.strongETag == masterETag else {
            throw RemiloIOSGoogleCalendarImport.Failure.staleRemote
        }
        return .init(subject: access.account.subject, clientID: access.clientID, lease: lease, identity: identity,
                     originalStart: original, masterETag: masterETag, masterZone: parsed.fields.schedule.zoneId, etag: etag, fields: fields)
    }

    func patch(_ patch: Patch, access: RemiloIOSGoogleCalendarAccess, phase: Phase,
               budget: HTTP.Budget = .init(),
               permitSend: @Sendable (Patch) async throws -> Permission) async throws -> PatchOutcome {
        guard patch.account.matches(access) else { throw Failure.accountChanged }
        let calendar = try await transport.ownedCalendar(access, id: patch.calendarID, budget: budget)
        if phase == .notSent { try patch.managedLease?.verify(calendar, email: access.account.email) }
        if phase == .notSent, (calendar.timeZone ?? "") != patch.calendarZone { return .staleRemote }
        let lookup = try await transport.lookup(access, calendarID: patch.calendarID, eventID: patch.eventID, budget: budget)
        guard case .found(let observed) = lookup else {
            if case .deleted = lookup { return .remoteRemoved }
            return phase == .sent ? .unconfirmed(nil) : .remoteUnavailable
        }
        guard patch.instance?.identifies(observed) ?? true else { return .staleRemote }
        guard !observed.cancelled else { return .remoteRemoved }
        guard patch.identifies(observed) else { return .staleRemote }
        if phase == .notSent, let instance = patch.instance {
            let master = try await transport.lookup(access, calendarID: patch.calendarID,
                                                    eventID: instance.identity.masterID, budget: budget)
            guard case .found(let current) = master, !current.cancelled,
                  current.strongETag == instance.masterETag else { return .staleRemote }
        }
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
            switch Transport.reason(response.body) {
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
            if case .deleted = lookup { return .remoteRemoved }
            if case .found(let event) = lookup {
                guard patch.instance?.identifies(event) ?? true else { return .staleRemote }
                guard patch.identifies(event) else { return event.cancelled ? .remoteRemoved : .staleRemote }
                if patch.matches(event) { return .confirmed(event) }
            }
            return .unconfirmed(failure)
        } catch { return .unconfirmed(error as? Failure ?? failure ?? .network) }
    }

    private static func object(_ data: Data) -> [String: Any]? {
        (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
}
