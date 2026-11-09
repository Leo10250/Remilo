import Foundation

enum RemiloIOSGoogleCalendarEvent {
    enum Reason: String, Error, Sendable {
        case removed = "REMOTE_REMOVED"
        case instanceRequiresMaster = "INSTANCE_REQUIRES_MASTER"
        case meeting = "MEETING_EVENT"
        case locked = "LOCKED_EVENT"
        case special = "SPECIAL_EVENT"
        case unspecifiedEnd = "UNSPECIFIED_END"
        case contentLimit = "CONTENT_LIMIT"
        case invalidEvent = "INVALID_EVENT"
        case invalidZone = "INVALID_ZONE"
        case incompatibleZones = "INCOMPATIBLE_ZONES"
        case multiDay = "MULTI_DAY_EVENT"
        case unsupportedRecurrence = "UNSUPPORTED_RECURRENCE"
        case invalidInstance = "INVALID_INSTANCE"
    }

    struct Fields: Codable, Equatable, Sendable {
        let title: String
        let notes: String
        let schedule: Schedule
    }

    struct Schedule: Codable, Equatable, Sendable {
        let eventStartMs: Int64
        let eventEndMs: Int64
        let allDay: Bool
        let zoneId: String
        let recurrence: [String]?
    }

    struct Row: Sendable {
        let eventId: String
        let title: String
        let fields: Fields?
        let unsupportedReason: Reason?
        let occurrenceId: String?
        let erased: Bool
    }

    struct SourceKey: Hashable, Sendable {
        let subject: String
        let calendarID: String
        let eventID: String
    }

    enum SourceDisposition: Sendable {
        case unassociated
        case associated(occurrenceID: String)
        case erased
        case hidden
    }

    struct InstanceIdentity: Equatable, Sendable {
        let eventID: String
        let masterID: String
        let nominalSlot: String
        let cancelled: Bool
    }

    static func row(_ event: RemiloIOSGoogleCalendarTransport.Event, calendarZone: String,
                    disposition: SourceDisposition = .unassociated) -> Row? {
        let occurrenceID: String?
        let erased: Bool
        switch disposition {
        case .hidden: return nil
        case .associated(let id):
            occurrenceID = id
            erased = false
        case .erased:
            occurrenceID = nil
            erased = true
        case .unassociated:
            occurrenceID = nil
            erased = false
        }
        let source = try? object(event.json)
        let title = source?["summary"] as? String ?? ""
        let result = Result { () -> Fields in
            guard let source else { throw Reason.invalidEvent }
            return try fields(source, calendarZone: calendarZone).fields
        }
        switch result {
        case .success(let fields):
            return Row(eventId: event.id, title: title, fields: fields, unsupportedReason: nil,
                       occurrenceId: occurrenceID, erased: erased)
        case .failure(let error):
            return Row(eventId: event.id, title: title, fields: nil, unsupportedReason: error as? Reason ?? .invalidEvent,
                       occurrenceId: occurrenceID, erased: erased)
        }
    }

    static func fields(_ event: [String: Any], calendarZone: String) throws -> (fields: Fields, rule: RemiloIOSRecurrence.Rule?) {
        if event["status"] as? String == "cancelled" { throw Reason.removed }
        if event["recurringEventId"] != nil { throw Reason.instanceRequiresMaster }
        if let attendees = event["attendees"], (attendees as? [Any])?.isEmpty != true { throw Reason.meeting }
        if unsafeFlag(event, "attendeesOmitted") { throw Reason.meeting }
        if unsafeFlag(event, "locked") || unsafeFlag(event, "privateCopy") { throw Reason.locked }
        if let type = event["eventType"], (type as? String) != "default" { throw Reason.special }
        if unsafeFlag(event, "endTimeUnspecified") { throw Reason.unspecifiedEnd }
        guard event["summary"] == nil || event["summary"] is String,
              event["description"] == nil || event["description"] is String else { throw Reason.invalidEvent }
        let title = (event["summary"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let notes = event["description"] as? String ?? ""
        guard title.utf16.count <= 200, notes.utf16.count <= 10_000 else { throw Reason.contentLimit }
        guard let start = event["start"] as? [String: Any], let end = event["end"] as? [String: Any] else { throw Reason.invalidEvent }
        let allDay = start["date"] != nil
        guard allDay == (end["date"] != nil), !allDay || (start["dateTime"] == nil && end["dateTime"] == nil) else {
            throw Reason.invalidEvent
        }
        let zoneID = nonempty(start["timeZone"]) ?? calendarZone
        let zone = try namedZone(zoneID)
        guard (nonempty(end["timeZone"]) ?? zoneID) == zoneID else { throw Reason.incompatibleZones }
        let first: Int64
        let last: Int64
        let anchor: String
        if allDay {
            guard let startDate = start["date"] as? String, let endDate = end["date"] as? String else { throw Reason.invalidEvent }
            let wallStart = try wallDay(startDate)
            let wallEnd = try wallDay(endDate)
            guard wallEnd.timeIntervalSince(wallStart) == 86_400 else { throw Reason.multiDay }
            first = try localMidnight(wallStart, zone: zone)
            last = try localMidnight(wallEnd, zone: zone)
            anchor = startDate + "T00:00"
        } else {
            guard let startTime = start["dateTime"] as? String, let endTime = end["dateTime"] as? String else { throw Reason.invalidEvent }
            first = try timestamp(startTime)
            last = try timestamp(endTime)
            anchor = nominal(first, zone: zone)
        }
        guard first >= 0, last > first else { throw Reason.invalidEvent }
        let rule: RemiloIOSRecurrence.Rule?
        let recurrence: [String]?
        if let raw = event["recurrence"] {
            guard let lines = raw as? [String] else { throw Reason.unsupportedRecurrence }
            let decoded = try RemiloIOSGoogleCalendarRule.decode(
                lines, anchor: anchor, startMs: first, zoneID: zoneID, zone: zone,
                allDay: allDay, duration: allDay ? 86_400_000 : last - first
            )
            rule = decoded.rule
            recurrence = [decoded.canonical]
        } else {
            rule = nil
            recurrence = nil
        }
        return (Fields(title: title, notes: notes, schedule: Schedule(eventStartMs: first, eventEndMs: last,
                        allDay: allDay, zoneId: zoneID, recurrence: recurrence)), rule)
    }

    static func originalInstance(_ event: RemiloIOSGoogleCalendarTransport.Event, masterZoneID: String) throws -> InstanceIdentity {
        do {
            let source = try object(event.json)
            let zone = try namedZone(masterZoneID)
            guard let master = nonempty(source["recurringEventId"]), master.utf8.count <= 4096,
                  let original = source["originalStartTime"] as? [String: Any] else { throw Reason.invalidInstance }
            let slot: String
            switch (original["date"], original["dateTime"]) {
            case (let day as String, nil):
                _ = try wallDay(day)
                slot = day + "T00:00"
            case (nil, let time as String):
                slot = try RemiloIOSRecurrence.canonicalNominal(nominal(timestamp(time), zone: zone))
            default: throw Reason.invalidInstance
            }
            return InstanceIdentity(eventID: event.id, masterID: master, nominalSlot: slot, cancelled: event.cancelled)
        } catch { throw Reason.invalidInstance }
    }

    struct Range: Equatable, Sendable {
        let from: Date
        let until: Date
        let zoneID: String

        /// The Android DTO passes an exclusive civil end, derived from the inclusive form date.
        init(from: String, until: String, zone: TimeZone) throws {
            do {
                let first = try RemiloIOSGoogleCalendarEvent.wallDay(from)
                let last = try RemiloIOSGoogleCalendarEvent.wallDay(until)
                let days = Int(last.timeIntervalSince(first) / 86_400)
                guard (1...366).contains(days) else { throw RemiloIOSGoogleCalendarFailure.invalidRange }
                self.from = Date(timeIntervalSince1970: Double(try RemiloIOSGoogleCalendarEvent.localMidnight(first, zone: zone)) / 1_000)
                self.until = Date(timeIntervalSince1970: Double(try RemiloIOSGoogleCalendarEvent.localMidnight(last, zone: zone)) / 1_000)
                guard self.until > self.from else { throw RemiloIOSGoogleCalendarFailure.invalidRange }
                self.zoneID = zone.identifier
            } catch { throw RemiloIOSGoogleCalendarFailure.invalidRange }
        }
    }

    static let utc = TimeZone(secondsFromGMT: 0)!
    private static let namedIdentifiers = Set(TimeZone.knownTimeZoneIdentifiers + ["UTC", "GMT"])
    private static let timestampPattern = try! NSRegularExpression(
        pattern: #"\A([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})\z"#
    )

    static func namedZone(_ id: String) throws -> TimeZone {
        guard (namedIdentifiers.contains(id) || id.contains("/")), let zone = TimeZone(identifier: id) else { throw Reason.invalidZone }
        return zone
    }

    static func wallDay(_ value: String) throws -> Date {
        guard value.utf8.count == 10 else { throw Reason.invalidEvent }
        return try wall(value + "T00:00")
    }

    static func resolveNominal(_ value: String, zone: TimeZone) throws -> Int64 {
        millis(try RemiloIOSTime.resolveNominal(wall(value), in: zone).instant)
    }

    static func timestamp(_ value: String) throws -> Int64 {
        guard value.utf8.count <= 40,
              let match = timestampPattern.firstMatch(in: value, range: NSRange(value.startIndex..<value.endIndex, in: value)),
              let clock = Swift.Range(match.range(at: 1), in: value),
              let zone = Swift.Range(match.range(at: 3), in: value) else { throw Reason.invalidEvent }
        let offset = value[zone]
        let seconds: Int64
        if offset == "Z" { seconds = 0 }
        else {
            guard let hour = Int(offset.dropFirst().prefix(2)), let minute = Int(offset.suffix(2)),
                  hour <= 18, minute < 60, hour < 18 || minute == 0 else { throw Reason.invalidEvent }
            seconds = Int64(hour * 3600 + minute * 60) * (offset.first == "-" ? -1 : 1)
        }
        let whole = millis(try wall(String(value[clock])))
        let fraction = Swift.Range(match.range(at: 2), in: value).map { String(value[$0]) } ?? ""
        guard fraction.isEmpty || value[clock].count == 19 else { throw Reason.invalidEvent }
        let milliseconds = Int64((fraction + "000").prefix(3)) ?? 0
        return whole - seconds * 1_000 + milliseconds
    }

    static func nominal(_ value: Int64, zone: TimeZone) -> String {
        let fraction = (value % 1_000 + 1_000) % 1_000
        let parts = calendar(zone).dateComponents([.year, .month, .day, .hour, .minute, .second],
                                                  from: Date(timeIntervalSince1970: Double(value - fraction) / 1_000))
        let base = String(format: "%04d-%02d-%02dT%02d:%02d:%02d", locale: Locale(identifier: "en_US_POSIX"),
                          parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!, parts.second!)
        return fraction == 0 ? base : base + String(format: ".%03d", Int(fraction))
    }

    private static func wall(_ value: String) throws -> Date {
        guard let canonical = try? RemiloIOSRecurrence.canonicalNominal(value) else { throw Reason.invalidEvent }
        let split = canonical.split(separator: ".", maxSplits: 1)
        let parts = split[0].split(whereSeparator: { "-T:".contains($0) }).compactMap { Int($0) }
        guard (5...6).contains(parts.count), let date = calendar(utc).date(from: DateComponents(
            year: parts[0], month: parts[1], day: parts[2], hour: parts[3], minute: parts[4], second: parts.count == 6 ? parts[5] : 0
        )) else { throw Reason.invalidEvent }
        let fraction = split.count == 2 ? (Int(split[1]) ?? 0) : 0
        return date.addingTimeInterval(Double(fraction) / 1_000)
    }

    private static func calendar(_ zone: TimeZone) -> Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = zone
        return value
    }

    private static func localMidnight(_ day: Date, zone: TimeZone) throws -> Int64 {
        millis(try RemiloIOSTime.resolveNominal(day, in: zone).instant)
    }

    private static func millis(_ date: Date) -> Int64 { Int64((date.timeIntervalSince1970 * 1_000).rounded()) }

    private static func object(_ data: Data) throws -> [String: Any] {
        guard let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { throw Reason.invalidEvent }
        return value
    }

    private static func nonempty(_ value: Any?) -> String? {
        guard let text = value as? String, !text.isEmpty else { return nil }
        return text
    }

    private static func unsafeFlag(_ source: [String: Any], _ key: String) -> Bool {
        guard let value = source[key] else { return false }
        return value as? Bool != false
    }
}
