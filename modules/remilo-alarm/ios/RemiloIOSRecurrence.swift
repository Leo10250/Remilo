import Foundation

/// Civil recurrence policy. UTC dates are used only as a coordinate system for nominal slots.
enum RemiloIOSRecurrence {
    static let maximumOffsetMs: Int64 = 366 * dayMs
    struct InvalidRule: Error, Equatable { let field: String }

    struct Rule: Codable, Equatable {
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
        let zoneID: String?
        var endExclusive: String?
        let allDay: Bool
        let endOffsetMs: Int64
        let dueOffsetMs: Int64
        let alarmOffsetMs: Int64

        init(
            anchor: String, frequency: String, interval: Int = 1, weekdays: [Int]? = nil,
            day: Int? = nil, ordinal: Int = 1, weekday: Int? = nil, month: Int? = nil,
            count: Int? = nil, until: String? = nil, zoneID: String? = nil,
            endExclusive: String? = nil, allDay: Bool = false, endOffsetMs: Int64 = 1_800_000,
            dueOffsetMs: Int64 = 0, alarmOffsetMs: Int64 = 0
        ) throws {
            let anchorDate = try RemiloIOSRecurrence.parse(anchor, field: "anchor")
            let anchorWeekday = RemiloIOSRecurrence.isoWeekday(anchorDate)
            let calendar = RemiloIOSRecurrence.utcCalendar
            self.anchor = RemiloIOSRecurrence.nominalString(anchorDate)
            self.frequency = frequency
            self.interval = interval
            self.weekdays = weekdays ?? [anchorWeekday]
            self.day = day ?? calendar.component(.day, from: anchorDate)
            self.ordinal = ordinal
            self.weekday = weekday ?? anchorWeekday
            self.month = month ?? calendar.component(.month, from: anchorDate)
            self.count = count
            self.until = until
            self.zoneID = zoneID
            self.endExclusive = try endExclusive.map {
                RemiloIOSRecurrence.nominalString(try RemiloIOSRecurrence.parse($0, field: "endExclusive"))
            }
            self.allDay = allDay
            self.endOffsetMs = endOffsetMs
            self.dueOffsetMs = dueOffsetMs
            self.alarmOffsetMs = alarmOffsetMs
            _ = try Prepared(self)
        }

        /// Calendar shares authored event timing. Due and alarm offsets belong to Remilo.
        func hasSameEventSchedule(as other: Rule) -> Bool {
            guard anchor == other.anchor, frequency == other.frequency, interval == other.interval,
                  count == other.count, until == other.until, zoneID == other.zoneID, endExclusive == other.endExclusive,
                  allDay == other.allDay, endOffsetMs == other.endOffsetMs else { return false }
            switch Frequency(rawValue: frequency) {
            case .daily: return true
            case .weekly: return Set(weekdays) == Set(other.weekdays)
            case .monthlyDay: return day == other.day
            case .monthlyOrdinal: return ordinal == other.ordinal && weekday == other.weekday
            case .lastWeekday: return weekday == other.weekday
            case .yearly: return month == other.month && day == other.day
            case nil: return false
            }
        }
    }

    struct Slot: Equatable {
        let nominalSlot: String
        let index: Int
        let eventStartMs: Int64
        let eventEndMs: Int64
        let dueAtMs: Int64
        let alarmAtMs: Int64
        let zoneID: String
        let adjusted: Bool
    }

    static func canonicalNominal(_ value: String) throws -> String {
        nominalString(try parse(value, field: "nominalSlot"))
    }

    static func civilOffset(_ targetMs: Int64, fromNominal anchor: String, zone: TimeZone) throws -> Int64 {
        let nominal = try parse(anchor, field: "anchor")
        return milliseconds(localCoordinate(instant(targetMs), in: zone)) - milliseconds(nominal)
    }

    static func resolveOffset(_ anchor: String, by offset: Int64, in zone: TimeZone) throws -> Int64 {
        let nominal = try parse(anchor, field: "nominalSlot")
        return milliseconds(try RemiloIOSTime.resolveNominal(instant(milliseconds(nominal) + offset), in: zone).instant)
    }

    static func resolve(_ rule: Rule, nominal: String, deviceZone: TimeZone, index: Int = 0) throws -> Slot {
        let prepared = try Prepared(rule)
        return try resolved(rule, try parse(nominal, field: "nominalSlot"), index, prepared.zone ?? deviceZone)
    }

    static func future(
        _ rule: Rule, afterMs: Int64, deviceZone: TimeZone, mode: String = "Alarm", limit: Int,
        including: (Slot) -> Bool = { _ in true }
    ) throws -> [Slot] {
        let prepared = try Prepared(rule)
        guard (0...100_000).contains(limit) else { throw InvalidRule(field: "limit") }
        guard (-8_640_000_000_000_000...8_640_000_000_000_000).contains(afterMs) else {
            throw InvalidRule(field: "afterMs")
        }
        guard limit > 0 else { return [] }

        // With no alert, the authored alert time remains in the result but never drives the seek.
        let noAlert = mode == "None"
        let offset = noAlert ? 0 : rule.alarmOffsetMs
        let bound = instant(afterMs - offset - 18 * 3_600_000)
        let zone = prepared.zone ?? deviceZone
        var slots: [Slot] = []
        var inspected = 0
        try visitNominals(rule, prepared, seekFrom: bound) { nominal, index in
            // Count valid past slots without resolving zones for ones that cannot qualify.
            guard nominal > bound else { return true }
            let slot = try resolved(rule, nominal, index, zone)
            guard (noAlert ? slot.eventStartMs : slot.alarmAtMs) > afterMs else { return true }
            inspected += 1
            if including(slot) { slots.append(slot) }
            return slots.count < limit && inspected < 100_000
        }
        return slots
    }

    /// The range is inclusive and compares original local slots, independently of postponement and travel.
    static func slots(
        _ rule: Rule, from: String, through: String, deviceZone: TimeZone, limit: Int = 100_000
    ) throws -> [Slot] {
        let prepared = try Prepared(rule)
        let first = try parse(from, field: "from")
        let last = try parse(through, field: "through")
        guard first <= last else { throw InvalidRule(field: "through") }
        guard (0...100_000).contains(limit) else { throw InvalidRule(field: "limit") }
        guard limit > 0 else { return [] }
        let zone = prepared.zone ?? deviceZone
        var slots: [Slot] = []
        try visitNominals(rule, prepared, seekFrom: first) { nominal, index in
            guard nominal <= last else { return false }
            if nominal >= first { slots.append(try resolved(rule, nominal, index, zone)) }
            return slots.count < limit
        }
        return slots
    }

    /// Returns a one-based ordinal for an original slot, including slots whose instances were skipped.
    static func index(_ nominal: String, in rule: Rule) throws -> Int? {
        let prepared = try Prepared(rule)
        let target = try parse(nominal, field: "nominalSlot")
        guard target >= prepared.anchor else { return nil }
        var index: Int?
        visitNominals(rule, prepared, seekFrom: nil) { candidate, consumed in
            if candidate == target { index = consumed }
            return candidate < target
        }
        return index
    }

    private static func visitNominals(
        _ rule: Rule, _ prepared: Prepared, seekFrom: Date?, _ visit: (Date, Int) throws -> Bool
    ) rethrows {
        let distance = seekFrom.map { prepared.frequency.distance(from: prepared.base, to: utcCalendar.startOfDay(for: $0)) } ?? 0
        var cycle = rule.count == nil ? max(0, distance / rule.interval - 1) : 0
        var emptyCycles = 0
        var consumed = 0
        let cycleLength = prepared.frequency.cycleLength(interval: rule.interval)

        while let start = prepared.frequency.start(base: prepared.base, step: cycle * rule.interval),
              utcCalendar.component(.year, from: start) <= 9999,
              prepared.untilDay.map({ start <= $0 }) ?? true,
              prepared.endExclusive.map({ start <= $0 }) ?? true {
            let candidates = candidateDates(rule, prepared.frequency, start).map {
                instant(milliseconds($0.addingTimeInterval(prepared.timeOfDay)))
            }.filter { $0 >= prepared.anchor }
            cycle += 1
            emptyCycles = candidates.isEmpty ? emptyCycles + 1 : 0
            if emptyCycles > cycleLength { break }

            for nominal in candidates {
                if utcCalendar.component(.year, from: nominal) > 9999 { return }
                if let untilDay = prepared.untilDay, utcCalendar.startOfDay(for: nominal) > untilDay { return }
                if let end = prepared.endExclusive, nominal >= end { return }
                consumed += 1
                if let count = rule.count, consumed > count { return }
                if try !visit(nominal, consumed) { return }
            }
        }
    }

    private enum Frequency: String {
        case daily, weekly, monthlyDay, monthlyOrdinal, lastWeekday, yearly

        func base(for day: Date) -> Date? {
            switch self {
            case .daily: return day
            case .weekly:
                return RemiloIOSRecurrence.adding(.day, 1 - RemiloIOSRecurrence.isoWeekday(day), to: day)
            case .yearly:
                return RemiloIOSRecurrence.utcCalendar.date(from: RemiloIOSRecurrence.utcCalendar.dateComponents([.year], from: day))
            default:
                return RemiloIOSRecurrence.utcCalendar.date(from: RemiloIOSRecurrence.utcCalendar.dateComponents([.year, .month], from: day))
            }
        }

        func start(base: Date, step: Int) -> Date? {
            switch self {
            case .daily: return RemiloIOSRecurrence.adding(.day, step, to: base)
            case .weekly: return RemiloIOSRecurrence.adding(.day, step * 7, to: base)
            case .yearly: return RemiloIOSRecurrence.adding(.year, step, to: base)
            default: return RemiloIOSRecurrence.adding(.month, step, to: base)
            }
        }

        func distance(from base: Date, to bound: Date) -> Int {
            let calendar = RemiloIOSRecurrence.utcCalendar
            switch self {
            case .daily, .weekly:
                let days = calendar.dateComponents([.day], from: base, to: bound).day ?? 0
                return self == .weekly ? days / 7 : days
            case .yearly:
                return calendar.component(.year, from: bound) - calendar.component(.year, from: base)
            default:
                let years = calendar.component(.year, from: bound) - calendar.component(.year, from: base)
                return years * 12 + calendar.component(.month, from: bound) - calendar.component(.month, from: base)
            }
        }

        func cycleLength(interval: Int) -> Int {
            switch self {
            case .yearly: return 400 / RemiloIOSRecurrence.gcd(400, interval)
            case .monthlyDay, .monthlyOrdinal: return 4_800 / RemiloIOSRecurrence.gcd(4_800, interval)
            default: return 1
            }
        }
    }

    private struct Prepared {
        let anchor: Date
        let frequency: Frequency
        let base: Date
        let timeOfDay: TimeInterval
        let untilDay: Date?
        let endExclusive: Date?
        let zone: TimeZone?

        init(_ rule: Rule) throws {
            let anchor = try RemiloIOSRecurrence.parse(rule.anchor, field: "anchor")
            let anchorDay = RemiloIOSRecurrence.utcCalendar.startOfDay(for: anchor)
            guard let frequency = Frequency(rawValue: rule.frequency), let base = frequency.base(for: anchorDay) else {
                throw InvalidRule(field: "frequency")
            }
            guard (1...999).contains(rule.interval) else { throw InvalidRule(field: "interval") }
            guard !rule.weekdays.isEmpty, rule.weekdays.allSatisfy({ (1...7).contains($0) }),
                  Set(rule.weekdays).count == rule.weekdays.count else { throw InvalidRule(field: "weekdays") }
            guard (1...31).contains(rule.day) else { throw InvalidRule(field: "day") }
            guard (1...5).contains(rule.ordinal) || rule.ordinal == -1 else { throw InvalidRule(field: "ordinal") }
            guard (1...7).contains(rule.weekday) else { throw InvalidRule(field: "weekday") }
            guard (1...12).contains(rule.month) else { throw InvalidRule(field: "month") }
            if let count = rule.count, !(1...100_000).contains(count) { throw InvalidRule(field: "count") }
            let offsetLimit = RemiloIOSRecurrence.maximumOffsetMs
            guard (1...offsetLimit).contains(rule.endOffsetMs) else { throw InvalidRule(field: "endOffsetMs") }
            guard (-offsetLimit...offsetLimit).contains(rule.dueOffsetMs) else { throw InvalidRule(field: "dueOffsetMs") }
            guard (-offsetLimit...offsetLimit).contains(rule.alarmOffsetMs) else { throw InvalidRule(field: "alarmOffsetMs") }
            let untilDay = try rule.until.map { date in
                guard date.count == 10 else { throw InvalidRule(field: "until") }
                let untilDay = try RemiloIOSRecurrence.parse(date + "T00:00", field: "until")
                guard untilDay >= anchorDay else { throw InvalidRule(field: "until") }
                return untilDay
            }
            let zone = try rule.zoneID.map { id in
                guard let zone = TimeZone(identifier: id) else { throw InvalidRule(field: "zoneId") }
                return zone
            }
            self.anchor = anchor
            self.frequency = frequency
            self.base = base
            self.timeOfDay = anchor.timeIntervalSince(anchorDay)
            self.untilDay = untilDay
            self.endExclusive = try rule.endExclusive.map { try RemiloIOSRecurrence.parse($0, field: "endExclusive") }
            self.zone = zone
        }
    }

    private static func candidateDates(_ rule: Rule, _ frequency: Frequency, _ start: Date) -> [Date] {
        switch frequency {
        case .daily: return [start]
        case .weekly: return rule.weekdays.sorted().compactMap { adding(.day, $0 - 1, to: start) }
        case .yearly:
            guard let monthStart = adding(.month, rule.month - 1, to: start) else { return [] }
            return monthDay(rule.day, from: monthStart).map { [$0] } ?? []
        case .monthlyDay: return monthDay(rule.day, from: start).map { [$0] } ?? []
        case .monthlyOrdinal:
            if rule.ordinal == -1 {
                guard let last = lastDay(from: start) else { return [] }
                let back = (isoWeekday(last) - rule.weekday + 7) % 7
                return adding(.day, -back, to: last).map { [$0] } ?? []
            }
            let forward = (rule.weekday - isoWeekday(start) + 7) % 7
            return monthDay(1 + forward + (rule.ordinal - 1) * 7, from: start).map { [$0] } ?? []
        case .lastWeekday:
            guard let last = lastDay(from: start) else { return [] }
            let back = max(0, isoWeekday(last) - 5)
            return adding(.day, -back, to: last).map { [$0] } ?? []
        }
    }

    private static func resolved(_ rule: Rule, _ nominal: Date, _ index: Int, _ zone: TimeZone) throws -> Slot {
        let event = try RemiloIOSTime.resolveNominal(nominal, in: zone)
        let endMs: Int64
        if rule.allDay {
            let localEvent = localCoordinate(event.instant, in: zone)
            let tomorrow = utcCalendar.startOfDay(for: localEvent).addingTimeInterval(86_400)
            endMs = milliseconds(try RemiloIOSTime.resolveNominal(tomorrow, in: zone).instant)
        } else {
            endMs = milliseconds(event.instant) + rule.endOffsetMs
        }
        let dueNominal = instant(milliseconds(nominal) + rule.dueOffsetMs)
        let due: Date
        if rule.allDay && rule.dueOffsetMs == dayMs {
            due = instant(endMs)
        } else {
            due = try RemiloIOSTime.resolveNominal(dueNominal, in: zone).instant
        }
        let alarm = try RemiloIOSTime.resolveNominal(instant(milliseconds(nominal) + rule.alarmOffsetMs), in: zone)
        return Slot(
            nominalSlot: nominalString(nominal), index: index, eventStartMs: milliseconds(event.instant),
            eventEndMs: endMs, dueAtMs: milliseconds(due), alarmAtMs: milliseconds(alarm.instant),
            zoneID: rule.zoneID ?? zone.identifier,
            adjusted: event.adjustment == "gapForward" || alarm.adjustment == "gapForward" ||
                milliseconds(localCoordinate(due, in: zone)) != milliseconds(dueNominal)
        )
    }

    private static let dayMs: Int64 = 86_400_000
    private static let utcCalendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }()
    private static let posix = Locale(identifier: "en_US_POSIX")

    private static func parse(_ value: String, field: String) throws -> Date {
        guard value.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\.[0-9]{1,3})?)?$"#,
                          options: .regularExpression) == value.startIndex..<value.endIndex else {
            throw InvalidRule(field: field)
        }
        let split = value.split(separator: ".", maxSplits: 1)
        let parts = split[0].split(whereSeparator: { "-T:".contains($0) }).compactMap { Int($0) }
        guard (5...6).contains(parts.count), (1970...9999).contains(parts[0]),
              let whole = utcCalendar.date(from: DateComponents(
                  year: parts[0], month: parts[1], day: parts[2], hour: parts[3], minute: parts[4],
                  second: parts.count == 6 ? parts[5] : 0
              )) else { throw InvalidRule(field: field) }
        let normalized = nominalString(whole, alwaysIncludeSeconds: parts.count == 6)
        guard normalized == String(split[0]) else { throw InvalidRule(field: field) }
        if split.count == 1 { return whole }
        let millis = Int64(String(split[1]) + String(repeating: "0", count: 3 - split[1].count)) ?? 0
        return instant(milliseconds(whole) + millis)
    }

    private static func nominalString(_ date: Date, alwaysIncludeSeconds: Bool = false) -> String {
        let ms = milliseconds(date)
        let fraction = (ms % 1_000 + 1_000) % 1_000
        let parts = utcCalendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: instant(ms - fraction))
        let base = String(format: "%04d-%02d-%02dT%02d:%02d", locale: posix,
                          parts.year!, parts.month!, parts.day!, parts.hour!, parts.minute!)
        guard alwaysIncludeSeconds || parts.second != 0 || fraction != 0 else { return base }
        let seconds = String(format: ":%02d", locale: posix, parts.second!)
        return fraction == 0 ? base + seconds : base + seconds + String(format: ".%03d", locale: posix, Int(fraction))
    }

    private static func monthDay(_ day: Int, from start: Date) -> Date? {
        guard let days = utcCalendar.range(of: .day, in: .month, for: start), days.contains(day) else { return nil }
        return adding(.day, day - 1, to: start)
    }

    private static func lastDay(from start: Date) -> Date? {
        guard let last = utcCalendar.range(of: .day, in: .month, for: start)?.last else { return nil }
        return adding(.day, last - 1, to: start)
    }

    private static func adding(_ component: Calendar.Component, _ value: Int, to date: Date) -> Date? {
        utcCalendar.date(byAdding: component, value: value, to: date)
    }

    private static func isoWeekday(_ date: Date) -> Int { (utcCalendar.component(.weekday, from: date) + 5) % 7 + 1 }
    private static func gcd(_ a: Int, _ b: Int) -> Int { b == 0 ? a : gcd(b, a % b) }
    private static func instant(_ ms: Int64) -> Date { Date(timeIntervalSince1970: Double(ms) / 1_000) }
    private static func milliseconds(_ date: Date) -> Int64 { Int64((date.timeIntervalSince1970 * 1_000).rounded()) }
    private static func localCoordinate(_ date: Date, in zone: TimeZone) -> Date {
        date.addingTimeInterval(Double(zone.secondsFromGMT(for: date)))
    }
}
