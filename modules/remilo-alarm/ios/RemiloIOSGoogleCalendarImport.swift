import Foundation

enum RemiloIOSGoogleCalendarImport {
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Account = RemiloIOSGoogleCalendarPublication.Account
    typealias Transport = RemiloIOSGoogleCalendarTransport

    enum Failure: String, Error, Codable, Sendable {
        case stalePreview = "STALE_PREVIEW"
        case staleConnection = "STALE_CONNECTION"
        case staleRemote = "STALE_REMOTE"
        case operationReused = "OPERATION_REUSED"
        case operationPending = "OPERATION_PENDING"
        case alreadyImported = "ALREADY_IMPORTED"
        case notFound = "NOT_FOUND"
        case invalidInput = "INVALID_INPUT"
        case titleRequired = "TITLE_REQUIRED"
        case alertExpired = "ALERT_EXPIRED"
        case recurrenceReviewRequired = "RECURRENCE_REVIEW_REQUIRED"
    }

    enum Mode: String, Codable, Sendable { case alarm = "Alarm", notification = "Notification", none = "None" }
    enum Sound: String, Codable, Sendable { case remilo, system }
    enum Relationship: String, Codable, Sendable { case manual, automaticRequested, suspended }
    enum GoogleReminders: String, Codable, Sendable { case enabled, disabled, unknown }

    struct Choices: Codable, Equatable, Sendable {
        var mode: Mode = .alarm
        var title: String?
        var alarmAtMs: Int64?
        var listID: String?
        var sound: Sound = .remilo
        var automaticSync = true
        var disableGoogleReminders = false
    }

    struct SourceKey: Codable, Equatable, Sendable {
        let subject: String
        let calendarID: String
        let eventID: String
    }

    struct Source: Codable, Equatable, Sendable {
        let key: SourceKey
        let calendarZone: String
        let etag: String
        let fields: Event.Fields

        init(account: Account, calendar: Transport.OwnedCalendar, event: Transport.Event) throws {
            guard let etag = event.etag, RemiloIOSGoogleCalendarImport.validETag(etag), !event.cancelled,
                  let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any] else {
                throw Failure.staleRemote
            }
            key = SourceKey(subject: account.subject, calendarID: calendar.id, eventID: event.id)
            calendarZone = calendar.timeZone ?? ""
            self.etag = etag
            fields = try Event.fields(object, calendarZone: calendarZone).fields
        }
    }

    struct AuditedSlot: Codable, Equatable, Sendable {
        let eventID: String
        let masterID: String
        let nominalSlot: String
        let cancelled: Bool
        let startMs: Int64
        let endMs: Int64

        init(identity: Event.InstanceIdentity, startMs: Int64, endMs: Int64) {
            eventID = identity.eventID
            masterID = identity.masterID
            nominalSlot = identity.nominalSlot
            cancelled = identity.cancelled
            self.startMs = startMs
            self.endMs = endMs
        }
    }

    /// Only the bounded native instances inspection can certify its exception scan.
    struct RecurrenceEvidence: Sendable {
        let etag: String
        let inspectedExceptions: Bool
        let ordinarySlots: [AuditedSlot]
    }

    struct Observation: Sendable {
        let source: Source
        let recurrenceEvidence: RecurrenceEvidence?
    }

    struct Review: Codable, Equatable, Sendable {
        let id: UUID
        let account: Account
        let source: Source
        let checkedAtMs: Int64
        let googleReminders: GoogleReminders
        let auditedSlots: [AuditedSlot]?

        init(account: Account, calendar: Transport.OwnedCalendar, event: Transport.Event, now: Int64,
             calendarDefaultReminders: Bool? = nil, recurrenceEvidence: RecurrenceEvidence? = nil) throws {
            guard account.connectionRevision > 0, account.accountGeneration > 0, RemiloIOSGoogleCalendarImport.epoch.contains(now),
                  let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any] else {
                throw Failure.invalidInput
            }
            let source = try Source(account: account, calendar: calendar, event: event)
            if let rule = try RemiloIOSGoogleCalendarImport.recurrence(source) {
                guard let proof = recurrenceEvidence, proof.etag == source.etag, proof.inspectedExceptions,
                      let zone = TimeZone(identifier: source.fields.schedule.zoneId) else { throw Failure.recurrenceReviewRequired }
                let slots = try RemiloIOSRecurrence.future(rule, afterMs: now, deviceZone: zone, mode: "None", limit: 3)
                guard !slots.isEmpty, proof.ordinarySlots.count == slots.count,
                      Set(proof.ordinarySlots.map(\.eventID)).count == slots.count else { throw Failure.recurrenceReviewRequired }
                for (expected, observed) in zip(slots, proof.ordinarySlots) {
                    guard observed.masterID == source.key.eventID, !observed.cancelled,
                          observed.nominalSlot == expected.nominalSlot,
                          observed.startMs == expected.eventStartMs, observed.endMs == expected.eventEndMs else {
                        throw Failure.recurrenceReviewRequired
                    }
                }
                auditedSlots = proof.ordinarySlots
            } else { auditedSlots = nil }
            id = UUID()
            self.account = account
            self.source = source
            checkedAtMs = now
            googleReminders = RemiloIOSGoogleCalendarImport.reminders(object, defaults: calendarDefaultReminders)
        }

        func valid(at now: Int64) -> Bool { now >= checkedAtMs && now - checkedAtMs <= 600_000 }

        func matches(_ observation: Observation) -> Bool {
            guard observation.source == source else { return false }
            if let auditedSlots {
                guard let proof = observation.recurrenceEvidence, proof.etag == source.etag, proof.inspectedExceptions,
                      proof.ordinarySlots == auditedSlots else { return false }
            }
            return true
        }
    }

    struct Command: Codable, Equatable, Sendable {
        let id: String
        let title: String
        let notes: String
        let mode: Mode
        let sound: Sound
        let listID: String?
        let schedule: Event.Schedule
        let dueAtMs: Int64
        let alarmAtMs: Int64
        let alarmLinked: Bool
        let rule: RuleSpec?

        static let privatePrefix = "ios-calendar-import:"

        var payload: [String: Any] {
            var result: [String: Any] = [
                "kind": rule == nil ? "Create" : "CreateSeries", "operationId": id, "title": title, "notes": notes,
                "eventStartMs": schedule.eventStartMs, "eventEndMs": schedule.eventEndMs, "allDay": schedule.allDay,
                "zoneId": schedule.zoneId, "dueAtMs": dueAtMs, "alarmAtMs": alarmAtMs, "dueLinked": true,
                "alarmLinked": alarmLinked, "mode": mode.rawValue, "sound": sound.rawValue, "listId": listID as Any? ?? NSNull(),
            ]
            if let rule {
                result["recurrence"] = rule.payload
                // Included in the ordinary scheduler receipt fingerprint. The public
                // command entry rejects this operation namespace and cannot use it.
                result["nativeCalendarAnchor"] = rule.anchor
                result["nativeCalendarEndExclusive"] = rule.endExclusive as Any? ?? NSNull()
            }
            return result
        }
    }

    struct RuleSpec: Codable, Equatable, Sendable {
        let anchor: String
        let frequency: String
        let interval: Int
        let weekdays: [Int]
        let day: Int
        let ordinal: Int
        let weekday: Int
        let month: Int
        let count: Int?
        let until: String?
        let endExclusive: String?

        init(_ rule: RemiloIOSRecurrence.Rule) {
            anchor = rule.anchor
            frequency = rule.frequency
            interval = rule.interval
            weekdays = rule.weekdays
            day = rule.day
            ordinal = rule.ordinal
            weekday = rule.weekday
            month = rule.month
            count = rule.count
            until = rule.until
            endExclusive = rule.endExclusive
        }

        var payload: [String: Any] {
            var result: [String: Any] = ["frequency": frequency, "interval": interval, "weekdays": weekdays, "day": day,
                                         "ordinal": ordinal, "weekday": weekday, "month": month, "zoneMode": "pinned"]
            if let count { result["count"] = count }
            if let until { result["until"] = until }
            return result
        }
    }

    struct Capture: Codable, Equatable, Sendable {
        let operationID: UUID
        let review: Review
        let choices: Choices
        let command: Command

        init(operationID: UUID, review: Review, choices: Choices, now: Int64) throws {
            guard review.valid(at: now) else { throw Failure.stalePreview }
            let fields = review.source.fields
            let title = (choices.title ?? fields.title).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty else { throw Failure.titleRequired }
            guard title.utf16.count <= 200, (choices.listID?.utf8.count ?? 0) <= 200,
                  choices.listID?.isEmpty != true else { throw Failure.invalidInput }
            let schedule = fields.schedule
            let zone = try Event.namedZone(schedule.zoneId)
            let due = schedule.allDay ? schedule.eventEndMs : schedule.eventStartMs
            let alert: Int64
            if let explicit = choices.alarmAtMs { alert = explicit }
            else if schedule.allDay {
                let day = String(Event.nominal(schedule.eventStartMs, zone: zone).prefix(10))
                alert = try Event.resolveNominal(day + "T09:00", zone: zone)
            } else { alert = schedule.eventStartMs }
            guard RemiloIOSGoogleCalendarImport.epoch.contains(alert) else { throw Failure.invalidInput }
            let rule = try RemiloIOSGoogleCalendarImport.recurrence(review.source)
            if let rule {
                let offset = try RemiloIOSRecurrence.civilOffset(alert, fromNominal: rule.anchor, zone: zone)
                let effective = try RemiloIOSRecurrence.Rule(
                    anchor: rule.anchor, frequency: rule.frequency, interval: rule.interval, weekdays: rule.weekdays,
                    day: rule.day, ordinal: rule.ordinal, weekday: rule.weekday, month: rule.month,
                    count: rule.count, until: rule.until, zoneID: rule.zoneID, endExclusive: rule.endExclusive,
                    allDay: rule.allDay, endOffsetMs: rule.endOffsetMs, dueOffsetMs: rule.dueOffsetMs, alarmOffsetMs: offset
                )
                let available = try RemiloIOSRecurrence.future(effective, afterMs: now, deviceZone: zone,
                                                              mode: choices.mode.rawValue, limit: 1)
                guard !available.isEmpty else { throw Failure.alertExpired }
            } else if choices.mode != .none && alert <= now { throw Failure.alertExpired }
            self.operationID = operationID
            self.review = review
            self.choices = choices
            command = Command(id: Command.privatePrefix + operationID.uuidString.lowercased(), title: title, notes: fields.notes,
                              mode: choices.mode, sound: choices.sound, listID: choices.listID, schedule: schedule,
                              dueAtMs: due, alarmAtMs: alert, alarmLinked: choices.alarmAtMs == nil, rule: rule.map(RuleSpec.init))
        }

    }

    static func observe(_ key: SourceKey, account: Account, access: RemiloIOSGoogleCalendarAccess,
                        transport: Transport, budget: RemiloIOSGoogleCalendarHTTP.Budget = .init(),
                        audit: (@Sendable (Transport.OwnedCalendar, Transport.Event) async throws -> RecurrenceEvidence)? = nil)
        async throws -> Observation {
        guard account.matches(access), key.subject == account.subject else { throw Failure.staleConnection }
        let calendar = try await transport.ownedCalendar(access, id: key.calendarID, budget: budget)
        let result = try await transport.lookup(access, calendarID: key.calendarID, eventID: key.eventID, budget: budget)
        guard case .found(let event) = result, !event.cancelled else { throw Failure.staleRemote }
        let source = try Source(account: account, calendar: calendar, event: event)
        let proof: RecurrenceEvidence?
        if source.fields.schedule.recurrence != nil, let audit { proof = try await audit(calendar, event) }
        else { proof = nil }
        return Observation(source: source, recurrenceEvidence: proof)
    }

    private static let epoch: ClosedRange<Int64> = 0...253_402_300_799_999

    private static func validETag(_ value: String) -> Bool {
        guard (2...512).contains(value.utf8.count), value.first == "\"", value.last == "\"" else { return false }
        return value.utf8.dropFirst().dropLast().allSatisfy { $0 == 33 || (35...126).contains($0) }
    }

    private static func recurrence(_ source: Source) throws -> RemiloIOSRecurrence.Rule? {
        let schedule = source.fields.schedule
        guard let lines = schedule.recurrence else { return nil }
        let zone = try Event.namedZone(schedule.zoneId)
        let civil = Event.nominal(schedule.eventStartMs, zone: zone)
        let anchor = schedule.allDay ? String(civil.prefix(10)) + "T00:00" : civil
        return try RemiloIOSGoogleCalendarRule.decode(lines, anchor: anchor, startMs: schedule.eventStartMs,
                                                     zoneID: schedule.zoneId, zone: zone, allDay: schedule.allDay,
                                                     duration: schedule.allDay ? 86_400_000 : schedule.eventEndMs - schedule.eventStartMs).rule
    }

    private static func reminders(_ object: [String: Any], defaults: Bool?) -> GoogleReminders {
        if let reminders = object["reminders"] as? [String: Any], reminders["useDefault"] as? Bool == false {
            if reminders["overrides"] == nil { return .disabled }
            guard let overrides = reminders["overrides"] as? [Any] else { return .unknown }
            return overrides.isEmpty ? .disabled : .enabled
        }
        return defaults.map { $0 ? .enabled : .disabled } ?? .unknown
    }
}
