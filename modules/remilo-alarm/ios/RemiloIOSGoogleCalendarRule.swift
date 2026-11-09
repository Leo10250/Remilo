import Foundation

enum RemiloIOSGoogleCalendarRule {
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private static let days = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
    private static let keys: Set<String> = ["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "BYSETPOS", "WKST", "COUNT", "UNTIL"]

    static func decode(_ lines: [String], anchor: String, startMs: Int64, zoneID: String, zone: TimeZone,
                       allDay: Bool, duration: Int64) throws -> (rule: RemiloIOSRecurrence.Rule, canonical: String) {
        let failure = Event.Reason.unsupportedRecurrence
        guard lines.count == 1, let line = lines.first, line.hasPrefix("RRULE:"), line.utf8.count <= 4_000 else { throw failure }
        var fields: [String: String] = [:]
        for token in line.dropFirst(6).split(separator: ";", omittingEmptySubsequences: false) {
            let pair = token.split(separator: "=", omittingEmptySubsequences: false)
            guard pair.count == 2, !pair[1].isEmpty, keys.contains(String(pair[0])), fields[String(pair[0])] == nil else { throw failure }
            fields[String(pair[0])] = String(pair[1])
        }
        guard let rawFrequency = fields["FREQ"], fields["WKST"] == nil || fields["WKST"] == "MO",
              fields["COUNT"] == nil || fields["UNTIL"] == nil else { throw failure }

        func number(_ key: String) throws -> Int? {
            guard let text = fields[key] else { return nil }
            guard let result = Int(text) else { throw failure }
            return result
        }
        let frequency: String
        let allowed: Set<String>
        var weekdays: [Int]?
        var weekday: Int?
        var ordinal = 1
        switch rawFrequency {
        case "DAILY":
            frequency = "daily"
            allowed = []
        case "WEEKLY":
            frequency = "weekly"
            allowed = ["BYDAY"]
            weekdays = try fields["BYDAY"].map { value in
                try value.split(separator: ",", omittingEmptySubsequences: false).map {
                    guard let index = days.firstIndex(of: String($0)) else { throw failure }
                    return index + 1
                }
            }
        case "MONTHLY":
            switch fields["BYDAY"] {
            case "MO,TU,WE,TH,FR" where fields["BYSETPOS"] == "-1":
                frequency = "lastWeekday"
                allowed = ["BYDAY", "BYSETPOS"]
            case .some(let byday):
                let raw = String(byday.dropLast(2))
                guard ["-1", "1", "2", "3", "4", "5"].contains(raw), let value = Int(raw),
                      let index = days.firstIndex(of: String(byday.suffix(2))) else { throw failure }
                frequency = "monthlyOrdinal"
                allowed = ["BYDAY"]
                ordinal = value
                weekday = index + 1
            case nil:
                frequency = "monthlyDay"
                allowed = ["BYMONTHDAY"]
            }
        case "YEARLY":
            frequency = "yearly"
            allowed = ["BYMONTH", "BYMONTHDAY"]
        default: throw failure
        }
        guard fields.keys.filter({ $0.hasPrefix("BY") }).allSatisfy(allowed.contains) else { throw failure }

        do {
            let (until, exclusive) = try ending(fields["UNTIL"], allDay: allDay, zone: zone)
            let rule = try RemiloIOSRecurrence.Rule(
                anchor: anchor, frequency: frequency, interval: number("INTERVAL") ?? 1,
                weekdays: weekdays, day: number("BYMONTHDAY"), ordinal: ordinal, weekday: weekday,
                month: number("BYMONTH"), count: number("COUNT"), until: until, zoneID: zoneID,
                endExclusive: exclusive, allDay: allDay, endOffsetMs: duration,
                dueOffsetMs: allDay ? 86_400_000 : 0, alarmOffsetMs: allDay ? 9 * 3_600_000 : 0
            )
            guard let first = try RemiloIOSRecurrence.future(rule, afterMs: -1, deviceZone: zone, mode: "None", limit: 1).first,
                  first.nominalSlot == rule.anchor, first.eventStartMs == startMs else { throw failure }

            var wire = ["FREQ=\(rawFrequency)", "INTERVAL=\(rule.interval)"]
            switch frequency {
            case "weekly": wire.append("BYDAY=" + rule.weekdays.sorted().map { days[$0 - 1] }.joined(separator: ","))
            case "monthlyDay": wire.append("BYMONTHDAY=\(rule.day)")
            case "monthlyOrdinal": wire.append("BYDAY=\(rule.ordinal)\(days[rule.weekday - 1])")
            case "lastWeekday": wire += ["BYDAY=MO,TU,WE,TH,FR", "BYSETPOS=-1"]
            case "yearly": wire += ["BYMONTH=\(rule.month)", "BYMONTHDAY=\(rule.day)"]
            default: break
            }
            wire.append("WKST=MO")
            if let until = fields["UNTIL"] { wire.append("UNTIL=\(until)") }
            else if let count = rule.count { wire.append("COUNT=\(count)") }
            return (rule, "RRULE:" + wire.joined(separator: ";"))
        } catch { throw failure }
    }

    private static func ending(_ value: String?, allDay: Bool, zone: TimeZone) throws -> (String?, String?) {
        guard let value else { return (nil, nil) }
        let expected = allDay ? #"\A[0-9]{8}\z"# : #"\A[0-9]{8}T[0-9]{6}Z\z"#
        guard value.range(of: expected, options: .regularExpression) != nil else { throw Event.Reason.unsupportedRecurrence }
        let date = [value.prefix(4), value.dropFirst(4).prefix(2), value.dropFirst(6).prefix(2)].joined(separator: "-")
        if allDay {
            _ = try Event.wallDay(date)
            return (date, nil)
        }
        let clock = value.dropFirst(9)
        let extended = "\(date)T\(clock.prefix(2)):\(clock.dropFirst(2).prefix(2)):\(clock.dropFirst(4))"
        let instant = try Event.timestamp(extended)
        let exclusive = Event.nominal(instant + 1, zone: zone)
        // A UTC ending on the later side of a fold cannot be represented by this civil boundary.
        guard try Event.resolveNominal(exclusive, zone: zone) == instant + 1 else { throw Event.Reason.unsupportedRecurrence }
        return (String(Event.nominal(instant, zone: zone).prefix(10)), exclusive)
    }
}
