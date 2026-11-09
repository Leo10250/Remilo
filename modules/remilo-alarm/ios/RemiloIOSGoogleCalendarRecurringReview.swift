import Foundation

/// Explicit read-only review. The scheduler may use this evidence only after
/// comparing a fresh inspection with the captured master and exceptions.
enum RemiloIOSGoogleCalendarRecurringReview {
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Recurrence = RemiloIOSRecurrence
    typealias Import = RemiloIOSGoogleCalendarImport

    enum Failure: String, Error {
        case reviewLimit = "RECURRENCE_REVIEW_LIMIT"
        case mismatch = "RECURRENCE_MISMATCH"
    }

    struct Exception: Codable, Equatable, Sendable {
        let identity: Event.InstanceIdentity
        let etag: String?
        let fields: Event.Fields?
    }

    struct Inspection: Codable, Equatable, Sendable {
        let referenceMs: Int64
        let alertPolicy: AlertPolicy
        let masterETag: String
        let exceptions: [Exception]
        let ordinarySlots: [Import.AuditedSlot]
    }

    struct AlertPolicy: Codable, Equatable, Sendable {
        let enabled: Bool
        let offsetMs: Int64?

        static let eventsOnly = AlertPolicy(enabled: false, offsetMs: nil)

        func applying(to rule: Recurrence.Rule) throws -> Recurrence.Rule {
            guard let offsetMs, offsetMs != rule.alarmOffsetMs else { return rule }
            return try Recurrence.Rule(
                anchor: rule.anchor, frequency: rule.frequency, interval: rule.interval, weekdays: rule.weekdays,
                day: rule.day, ordinal: rule.ordinal, weekday: rule.weekday, month: rule.month,
                count: rule.count, until: rule.until, zoneID: rule.zoneID, endExclusive: rule.endExclusive,
                allDay: rule.allDay, endOffsetMs: rule.endOffsetMs, dueOffsetMs: rule.dueOffsetMs, alarmOffsetMs: offsetMs
            )
        }

        func ordinarySlotsToAudit(_ rule: Recurrence.Rule, after now: Int64, in zone: TimeZone,
                                  excluding: Set<String>) throws -> [Recurrence.Slot] {
            let effective = try applying(to: rule)
            // Include events that have already started when their reviewed alert is still due.
            // A negative alert offset must not hide upcoming event dates from the audit.
            let mode = enabled && effective.alarmOffsetMs > 0 ? "Alarm" : "None"
            return try Recurrence.future(effective, afterMs: now, deviceZone: zone, mode: mode, limit: 3) {
                !excluding.contains($0.nominalSlot)
            }
        }

        func target(startMs: Int64, allDay: Bool, in zone: TimeZone) throws -> Int64 {
            if offsetMs == nil, !allDay { return startMs }
            let civil = Event.nominal(startMs, zone: zone)
            let day = String(civil.prefix(10))
            if let offsetMs {
                return try Recurrence.resolveOffset(allDay ? day + "T00:00" : civil, by: offsetMs, in: zone)
            }
            return try Event.resolveNominal(day + "T09:00", zone: zone)
        }

        func includes(startMs: Int64, allDay: Bool, zone: TimeZone, after now: Int64) throws -> Bool {
            if startMs > now { return true }
            guard enabled else { return false }
            return try target(startMs: startMs, allDay: allDay, in: zone) > now
        }
    }

    static func inspect(
        access: RemiloIOSGoogleCalendarAccess, calendar: Transport.OwnedCalendar, master: Transport.Event,
        now: Int64, alertPolicy: AlertPolicy = .eventsOnly, transport: Transport,
        budget: RemiloIOSGoogleCalendarHTTP.Budget = .init(),
        beforeRead: @Sendable () async throws -> Void
    ) async throws -> Inspection {
        guard calendar.isOwned else { throw Transport.Failure.notOwner }
        guard !master.cancelled, let etag = master.strongETag else { throw Import.Failure.staleRemote }
        let calendarZone = calendar.timeZone ?? ""
        let masterFields = try Event.fields(object(master), calendarZone: calendarZone)
        guard let rule = masterFields.rule else { throw Failure.mismatch }
        let zone = try Event.namedZone(masterFields.fields.schedule.zoneId)
        let scan = try await exceptionScan(access: access, calendar: calendar, master: master,
                                           rule: rule, zone: zone, now: now, alertPolicy: alertPolicy, transport: transport,
                                           budget: budget, beforeRead: beforeRead)
        let upcoming = try alertPolicy.ordinarySlotsToAudit(rule, after: now, in: zone, excluding: Set(scan.exceptions.keys))
        var identities = scan.childIDs
        var ordinary: [Import.AuditedSlot] = []
        for slot in upcoming {
            let originalStart = rule.allDay ? String(slot.nominalSlot.prefix(10))
                : Event.nominal(slot.eventStartMs, zone: Event.utc) + "Z"
            try await beforeRead()
            guard let event = try await transport.instance(access, calendarID: calendar.id, masterID: master.id,
                                                           originalStart: originalStart, budget: budget), !event.cancelled else {
                throw Failure.mismatch
            }
            let identity = try Event.originalInstance(event, masterZoneID: zone.identifier)
            let fields = try instanceFields(event, zoneID: zone.identifier)
            guard identity.masterID == master.id, identity.nominalSlot == slot.nominalSlot,
                  identities.insert(identity.eventID).inserted, fields.schedule.recurrence == nil,
                  try Event.namedZone(fields.schedule.zoneId) == zone, fields.schedule.allDay == rule.allDay,
                  fields.schedule.eventStartMs == slot.eventStartMs, fields.schedule.eventEndMs == slot.eventEndMs else {
                throw Failure.mismatch
            }
            ordinary.append(Import.AuditedSlot(identity: identity, startMs: slot.eventStartMs, endMs: slot.eventEndMs))
        }

        try await beforeRead()
        let currentCalendar = try await transport.ownedCalendar(access, id: calendar.id, budget: budget)
        guard currentCalendar.timeZone == calendar.timeZone else { throw Import.Failure.staleRemote }
        try await beforeRead()
        let current = try await transport.lookup(access, calendarID: calendar.id, eventID: master.id, budget: budget)
        guard case .found(let currentMaster) = current, !currentMaster.cancelled, currentMaster.strongETag == etag else {
            throw Import.Failure.staleRemote
        }
        try await requireUnchanged(access: access, calendarID: calendar.id, masterID: master.id, childIDs: identities,
                                   checkpoint: scan.checkpoint, transport: transport, budget: budget, beforeRead: beforeRead)
        let exceptions = scan.exceptions.values.sorted { $0.identity.nominalSlot < $1.identity.nominalSlot }
        return Inspection(referenceMs: now, alertPolicy: alertPolicy, masterETag: etag, exceptions: exceptions, ordinarySlots: ordinary)
    }

    private static func exceptionScan(
        access: RemiloIOSGoogleCalendarAccess, calendar: Transport.OwnedCalendar, master: Transport.Event,
        rule: Recurrence.Rule, zone: TimeZone, now: Int64, alertPolicy: AlertPolicy,
        transport: Transport, budget: RemiloIOSGoogleCalendarHTTP.Budget,
        beforeRead: @Sendable () async throws -> Void
    ) async throws -> (exceptions: [String: Exception], childIDs: Set<String>, checkpoint: Transport.SyncCheckpoint) {
        var cursor: Transport.PageCursor?
        var exceptions: [String: Exception] = [:]
        var eventIDs = Set<String>()
        for _ in 0..<100 {
            try await beforeRead()
            let page = try await transport.events(access, calendarID: calendar.id, listing: .incremental(since: nil),
                                                  next: cursor, budget: budget)
            for event in page.items {
                if event.id == master.id, event.cancelled || event.strongETag != master.strongETag {
                    throw Import.Failure.staleRemote
                }
                let raw = try object(event)
                guard raw["recurringEventId"] as? String == master.id else { continue }
                guard eventIDs.insert(event.id).inserted else { throw Event.Reason.invalidInstance }
                let identity = try Event.originalInstance(event, masterZoneID: zone.identifier)
                guard let index = try Recurrence.index(identity.nominalSlot, in: rule) else { throw Failure.mismatch }
                let original = try Recurrence.resolve(rule, nominal: identity.nominalSlot, deviceZone: zone, index: index)
                if try !alertPolicy.includes(startMs: original.eventStartMs, allDay: rule.allDay, zone: zone, after: now) {
                    if event.cancelled { continue }
                    let actual = try exceptionStart(raw, zone: zone)
                    if try !alertPolicy.includes(startMs: actual.startMs, allDay: actual.allDay, zone: actual.zone, after: now) { continue }
                }
                let fields = event.cancelled ? nil : try instanceFields(event, zoneID: zone.identifier)
                guard fields?.schedule.recurrence == nil, event.cancelled || event.strongETag != nil,
                      exceptions[identity.nominalSlot] == nil else {
                    throw Event.Reason.invalidInstance
                }
                guard exceptions.count < 500 else { throw Failure.reviewLimit }
                exceptions[identity.nominalSlot] = Exception(identity: identity, etag: event.strongETag, fields: fields)
            }
            guard let next = page.next else {
                guard let checkpoint = page.checkpoint else { throw Transport.Failure.invalidResponse }
                return (exceptions, eventIDs, checkpoint)
            }
            cursor = next
        }
        throw Failure.reviewLimit
    }

    /// Master reads alone do not fence changes to exceptions. Use the terminal
    /// token from the unexpanded scan with the same filters and authority.
    private static func requireUnchanged(
        access: RemiloIOSGoogleCalendarAccess, calendarID: String, masterID: String, childIDs: Set<String>,
        checkpoint: Transport.SyncCheckpoint, transport: Transport, budget: RemiloIOSGoogleCalendarHTTP.Budget,
        beforeRead: @Sendable () async throws -> Void
    ) async throws {
        var cursor: Transport.PageCursor?
        for _ in 0..<10 {
            try await beforeRead()
            let page: Transport.Page<Transport.Event>
            do {
                page = try await transport.events(access, calendarID: calendarID, listing: .incremental(since: checkpoint),
                                                  next: cursor, budget: budget)
            } catch Transport.Failure.syncTokenExpired {
                throw Import.Failure.staleRemote
            }
            for event in page.items {
                if event.id == masterID || childIDs.contains(event.id) { throw Import.Failure.staleRemote }
                if try object(event)["recurringEventId"] as? String == masterID { throw Import.Failure.staleRemote }
            }
            guard let next = page.next else { return }
            cursor = next
        }
        throw Failure.reviewLimit
    }

    private static func object(_ event: Transport.Event) throws -> [String: Any] {
        guard let raw = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any] else {
            throw Event.Reason.invalidEvent
        }
        return raw
    }

    private static func instanceFields(_ event: Transport.Event, zoneID: String) throws -> Event.Fields {
        var raw = try object(event)
        raw.removeValue(forKey: "recurringEventId")
        return try Event.fields(raw, calendarZone: zoneID).fields
    }

    private static func exceptionStart(_ event: [String: Any], zone: TimeZone) throws -> (startMs: Int64, allDay: Bool, zone: TimeZone) {
        guard let start = event["start"] as? [String: Any] else { throw Event.Reason.invalidEvent }
        let eventZone = try (start["timeZone"] as? String).map(Event.namedZone) ?? zone
        if let timed = start["dateTime"] as? String { return (try Event.timestamp(timed), false, eventZone) }
        guard let day = start["date"] as? String else { throw Event.Reason.invalidEvent }
        _ = try Event.wallDay(day)
        return (try Event.resolveNominal(day + "T00:00", zone: eventZone), true, eventZone)
    }
}
