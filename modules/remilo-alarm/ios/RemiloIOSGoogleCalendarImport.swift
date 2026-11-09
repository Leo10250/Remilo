import Foundation

enum RemiloIOSGoogleCalendarImport {
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Account = RemiloIOSGoogleCalendarPublication.Account
    typealias Transport = RemiloIOSGoogleCalendarTransport
    typealias RecurrenceEvidence = RemiloIOSGoogleCalendarRecurringReview.Inspection
    typealias RecurringAlertPolicy = RemiloIOSGoogleCalendarRecurringReview.AlertPolicy

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
        var allDayAlarmMinutes: Int?
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
            guard let etag = event.strongETag, !event.cancelled,
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

    struct Observation: Sendable {
        let source: Source
        let recurrenceEvidence: RecurrenceEvidence?
    }

    struct Upcoming: Equatable {
        let nominalSlot: String
        let eventStartMs: Int64
        let alarmAtMs: Int64
    }

    struct Review: Codable, Equatable, Sendable {
        let id: UUID
        let account: Account
        let source: Source
        let calendarName: String?
        let checkedAtMs: Int64
        let googleReminders: GoogleReminders
        let recurrenceEvidence: RecurrenceEvidence?

        init(account: Account, calendar: Transport.OwnedCalendar, event: Transport.Event, now: Int64,
             calendarDefaultReminders: Bool? = nil, recurrenceEvidence: RecurrenceEvidence? = nil) throws {
            guard account.connectionRevision > 0, account.accountGeneration > 0, RemiloIOSGoogleCalendarImport.epoch.contains(now),
                  let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any] else {
                throw Failure.invalidInput
            }
            let source = try Source(account: account, calendar: calendar, event: event)
            if let rule = try RemiloIOSGoogleCalendarImport.recurrence(source) {
                guard let proof = recurrenceEvidence else { throw Failure.recurrenceReviewRequired }
                try Self.validate(proof, source: source, rule: rule, now: now)
            } else if recurrenceEvidence != nil { throw Failure.invalidInput }
            id = UUID()
            self.account = account
            self.source = source
            self.recurrenceEvidence = recurrenceEvidence
            calendarName = calendar.displayName.flatMap { $0.utf8.count <= 4_096 ? $0 : nil }
            checkedAtMs = now
            googleReminders = RemiloIOSGoogleCalendarImport.reminders(object, defaults: calendarDefaultReminders)
        }

        func valid(at now: Int64) -> Bool { now >= checkedAtMs && now - checkedAtMs <= 600_000 }

        func timing(_ choices: Choices) throws -> (due: Int64, alert: Int64) {
            let schedule = source.fields.schedule
            let due = schedule.allDay ? schedule.eventEndMs : schedule.eventStartMs
            let alert: Int64
            let clock = try RemiloIOSGoogleCalendarImport.allDayClockOffset(schedule, choices: choices)
            if let explicit = choices.alarmAtMs { alert = explicit }
            else if schedule.allDay {
                let zone = try Event.namedZone(schedule.zoneId)
                let day = String(Event.nominal(schedule.eventStartMs, zone: zone).prefix(10))
                alert = try RemiloIOSRecurrence.resolveOffset(day + "T00:00", by: clock ?? 32_400_000, in: zone)
            } else { alert = schedule.eventStartMs }
            guard RemiloIOSGoogleCalendarImport.epoch.contains(alert) else { throw Failure.invalidInput }
            return (due, alert)
        }

        func matches(_ observation: Observation) -> Bool {
            observation.source == source && observation.recurrenceEvidence == recurrenceEvidence
        }

        func recurrenceSpec() throws -> RuleSpec? {
            try RemiloIOSGoogleCalendarImport.recurrence(source).map(RuleSpec.init)
        }

        func upcoming(_ choices: Choices, after now: Int64) throws -> [Upcoming] {
            guard let rule = try RemiloIOSGoogleCalendarImport.recurrence(source) else { return [] }
            guard valid(at: now) else { throw Failure.stalePreview }
            let title = (choices.title ?? source.fields.title).trimmingCharacters(in: .whitespacesAndNewlines)
            return try recurringPlan(rule, choices: choices, title: title, after: now, limit: 3).upcoming
        }

        fileprivate func recurringPlan(_ rule: RemiloIOSRecurrence.Rule, choices: Choices, title: String, after now: Int64, limit: Int)
            throws -> (upcoming: [Upcoming], exceptions: [LocalException]) {
            let policy = try RemiloIOSGoogleCalendarImport.alertPolicy(for: source, choices: choices)
            guard let evidence = recurrenceEvidence, evidence.alertPolicy == policy else { throw Failure.recurrenceReviewRequired }
            let effective = try policy.applying(to: rule)
            let zone = try Event.namedZone(source.fields.schedule.zoneId)
            let excluded = Set(evidence.exceptions.map(\.identity.nominalSlot))
            let exceptions = try evidence.exceptions.map {
                try Self.localException($0, title: title, policy: policy, alarmLinked: choices.alarmAtMs == nil,
                                        referenceMs: evidence.referenceMs, now: now)
            }
            let ordinary = try RemiloIOSRecurrence.future(effective, afterMs: now, deviceZone: zone,
                                                         mode: choices.mode.rawValue, limit: limit) {
                !excluded.contains($0.nominalSlot)
            }
            let moved = exceptions.compactMap { exception -> Upcoming? in
                guard case .override(let nominal, let fields, _, let target, _, let eligible) = exception else { return nil }
                let start = fields.schedule.eventStartMs
                guard policy.enabled ? eligible && target > now : start > now else { return nil }
                return Upcoming(nominalSlot: nominal, eventStartMs: start, alarmAtMs: target)
            }
            let candidates = ordinary.map {
                Upcoming(nominalSlot: $0.nominalSlot, eventStartMs: $0.eventStartMs, alarmAtMs: $0.alarmAtMs)
            } + moved
            let sorted = candidates.sorted { lhs, rhs in
                let left = policy.enabled ? lhs.alarmAtMs : lhs.eventStartMs
                let right = policy.enabled ? rhs.alarmAtMs : rhs.eventStartMs
                return left == right ? lhs.nominalSlot < rhs.nominalSlot : left < right
            }
            return (Array(sorted.prefix(limit)), exceptions)
        }

        private static func localException(_ exception: RemiloIOSGoogleCalendarRecurringReview.Exception, title: String,
                                           policy: RecurringAlertPolicy, alarmLinked: Bool, referenceMs: Int64, now: Int64) throws -> LocalException {
            let nominal = exception.identity.nominalSlot
            if exception.identity.cancelled { return .skip(nominalSlot: nominal) }
            guard let authored = exception.fields else { throw Failure.recurrenceReviewRequired }
            let schedule = authored.schedule
            let zone = try Event.namedZone(schedule.zoneId)
            let due = schedule.allDay ? schedule.eventEndMs : schedule.eventStartMs
            let alert = try policy.target(startMs: schedule.eventStartMs, allDay: schedule.allDay, in: zone)
            guard RemiloIOSGoogleCalendarImport.epoch.contains(alert) else { throw Failure.invalidInput }
            let eligible = policy.enabled && alert > referenceMs
            if policy.enabled, (eligible ? alert <= now : schedule.eventStartMs > referenceMs) { throw Failure.alertExpired }
            let fields = Event.Fields(title: authored.title.isEmpty ? title : authored.title, notes: authored.notes, schedule: schedule)
            return .override(nominalSlot: nominal, fields: fields, dueAtMs: due, alarmAtMs: alert,
                             alarmLinked: alarmLinked, alertEligible: eligible)
        }

        private static func validate(_ proof: RecurrenceEvidence, source: Source, rule: RemiloIOSRecurrence.Rule,
                                     now: Int64) throws {
            guard proof.referenceMs == now, proof.masterETag == source.etag, proof.exceptions.count <= 500,
                  let zone = TimeZone(identifier: source.fields.schedule.zoneId) else { throw Failure.recurrenceReviewRequired }
            var eventIDs = Set<String>()
            let nominals = proof.exceptions.map(\.identity.nominalSlot)
            let excluded = Set(nominals)
            guard nominals == excluded.sorted() else { throw Failure.recurrenceReviewRequired }
            for exception in proof.exceptions {
                let identity = exception.identity
                guard identity.masterID == source.key.eventID, !identity.eventID.isEmpty,
                      eventIDs.insert(identity.eventID).inserted, identity.cancelled == (exception.fields == nil),
                      exception.fields?.schedule.recurrence == nil, identity.cancelled || exception.etag != nil,
                      try RemiloIOSRecurrence.canonicalNominal(identity.nominalSlot) == identity.nominalSlot,
                      try RemiloIOSRecurrence.index(identity.nominalSlot, in: rule) != nil else {
                    throw Failure.recurrenceReviewRequired
                }
            }
            let slots = try proof.alertPolicy.ordinarySlotsToAudit(rule, after: now, in: zone, excluding: excluded)
            guard proof.ordinarySlots.count == slots.count else { throw Failure.recurrenceReviewRequired }
            for (expected, observed) in zip(slots, proof.ordinarySlots) {
                guard observed.masterID == source.key.eventID, !observed.cancelled, !observed.eventID.isEmpty,
                      eventIDs.insert(observed.eventID).inserted, observed.nominalSlot == expected.nominalSlot,
                      observed.startMs == expected.eventStartMs, observed.endMs == expected.eventEndMs else {
                    throw Failure.recurrenceReviewRequired
                }
            }
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
        let exceptions: [LocalException]?

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
                if let exceptions { result["nativeCalendarExceptions"] = exceptions.map(\.payload) }
            }
            return result
        }
    }

    enum LocalException: Codable, Equatable, Sendable {
        case skip(nominalSlot: String)
        case override(nominalSlot: String, fields: Event.Fields, dueAtMs: Int64, alarmAtMs: Int64, alarmLinked: Bool, alertEligible: Bool)

        var payload: [String: Any] {
            switch self {
            case .skip(let nominal): return ["nominalSlot": nominal, "kind": "Skip"]
            case .override(let nominal, let fields, let due, let alert, let linked, let eligible):
                let schedule = fields.schedule
                return ["nominalSlot": nominal, "kind": "Override", "title": fields.title, "notes": fields.notes,
                        "eventStartMs": schedule.eventStartMs, "eventEndMs": schedule.eventEndMs, "allDay": schedule.allDay,
                        "zoneId": schedule.zoneId, "dueAtMs": due, "alarmAtMs": alert, "alarmLinked": linked, "alertEligible": eligible]
            }
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
            let (due, alert) = try review.timing(choices)
            let rule = try RemiloIOSGoogleCalendarImport.recurrence(review.source)
            var exceptions: [LocalException] = []
            if let rule {
                let plan = try review.recurringPlan(rule, choices: choices, title: title, after: now, limit: 1)
                guard !plan.upcoming.isEmpty else { throw Failure.alertExpired }
                exceptions = plan.exceptions
            } else if choices.mode != .none && alert <= now { throw Failure.alertExpired }
            self.operationID = operationID
            self.review = review
            self.choices = choices
            command = Command(id: Command.privatePrefix + operationID.uuidString.lowercased(), title: title, notes: fields.notes,
                              mode: choices.mode, sound: choices.sound, listID: choices.listID, schedule: schedule,
                              dueAtMs: due, alarmAtMs: alert, alarmLinked: choices.alarmAtMs == nil, rule: rule.map(RuleSpec.init),
                              exceptions: exceptions.isEmpty ? nil : exceptions)
        }
    }

    static func observe(_ key: SourceKey, account: Account, access: RemiloIOSGoogleCalendarAccess,
                        transport: Transport, budget: RemiloIOSGoogleCalendarHTTP.Budget = .init(),
                        beforeRead: @Sendable () async throws -> Void,
                        verifyCalendar: (@Sendable (Transport.OwnedCalendar) throws -> Void)? = nil,
                        audit: (@Sendable (Transport.OwnedCalendar, Transport.Event) async throws -> RecurrenceEvidence)? = nil)
        async throws -> Observation {
        guard account.matches(access), key.subject == account.subject else { throw Failure.staleConnection }
        try await beforeRead()
        let calendar = try await transport.ownedCalendar(access, id: key.calendarID, budget: budget)
        try verifyCalendar?(calendar)
        try await beforeRead()
        let result = try await transport.lookup(access, calendarID: key.calendarID, eventID: key.eventID, budget: budget)
        guard case .found(let event) = result, !event.cancelled else { throw Failure.staleRemote }
        let source = try Source(account: account, calendar: calendar, event: event)
        let proof: RecurrenceEvidence?
        if source.fields.schedule.recurrence != nil, let audit { proof = try await audit(calendar, event) }
        else { proof = nil }
        return Observation(source: source, recurrenceEvidence: proof)
    }

    private static let epoch: ClosedRange<Int64> = 0...253_402_300_799_999

    static func alertPolicy(for source: Source, choices: Choices) throws -> RecurringAlertPolicy {
        let enabled = choices.mode != .none
        let clock = try allDayClockOffset(source.fields.schedule, choices: choices)
        guard let alert = choices.alarmAtMs else { return RecurringAlertPolicy(enabled: enabled, offsetMs: clock) }
        guard epoch.contains(alert), let rule = try recurrence(source) else { throw Failure.invalidInput }
        let zone = try Event.namedZone(source.fields.schedule.zoneId)
        let offset = try RemiloIOSRecurrence.civilOffset(alert, fromNominal: rule.anchor, zone: zone)
        guard abs(offset) <= RemiloIOSRecurrence.maximumOffsetMs else { throw Failure.invalidInput }
        return RecurringAlertPolicy(enabled: enabled, offsetMs: offset)
    }

    private static func allDayClockOffset(_ schedule: Event.Schedule, choices: Choices) throws -> Int64? {
        guard schedule.allDay, let minutes = choices.allDayAlarmMinutes else { return nil }
        guard choices.alarmAtMs == nil, (0...1439).contains(minutes) else { throw Failure.invalidInput }
        return Int64(minutes) * 60_000
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
