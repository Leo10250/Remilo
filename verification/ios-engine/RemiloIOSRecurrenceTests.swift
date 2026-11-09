import Foundation

@main
struct RemiloIOSRecurrenceTests {
    private typealias Policy = RemiloIOSRecurrence
    private typealias Rule = Policy.Rule

    private struct Fixture: Decodable {
        let name: String
        let anchor: String
        let frequency: String
        let interval: Int?
        let weekdays: [Int]?
        let day: Int?
        let ordinal: Int?
        let weekday: Int?
        let month: Int?
        let count: Int?
        let zone: String
        let after: String
        let expected: [String]
    }

    private struct Failure: Error, CustomStringConvertible {
        let description: String
        init(_ description: String) { self.description = description }
    }

    private static let utc = TimeZone(secondsFromGMT: 0)!
    private static let pacific = TimeZone(identifier: "America/Los_Angeles")!
    private static let dayMs: Int64 = 86_400_000

    static func main() throws {
        try sharedCalendarFixtures()
        try countAndFollowingBoundaries()
        try travelAndIndependentOffsets()
        try noAlertUsesEventStart()
        try impossibleRulesTerminate()
        try rejectsInvalidCivilInputAndDecodedRules()
        print("iOS recurrence tests passed")
    }

    private static func sharedCalendarFixtures() throws {
        let path = CommandLine.arguments.dropFirst().first ?? "verification/fixtures/recurrence.json"
        let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: URL(fileURLWithPath: path)))
        for fixture in fixtures {
            let rule = try Rule(
                anchor: fixture.anchor, frequency: fixture.frequency, interval: fixture.interval ?? 1,
                weekdays: fixture.weekdays, day: fixture.day, ordinal: fixture.ordinal ?? 1,
                weekday: fixture.weekday, month: fixture.month, count: fixture.count
            )
            guard let zone = TimeZone(identifier: fixture.zone) else { throw Failure(fixture.name) }
            let actual = try Policy.future(rule, afterMs: instantMs(fixture.after), deviceZone: zone, limit: fixture.expected.count)
            try check(actual.map(\.alarmAtMs) == fixture.expected.map(instantMs), fixture.name)
        }
    }

    private static func countAndFollowingBoundaries() throws {
        let rule = try Rule(anchor: "2027-01-31T09:00", frequency: "monthlyDay", count: 3)
        let range = try Policy.slots(rule, from: "2027-02-01T00:00", through: "2027-07-01T00:00", deviceZone: utc)
        try check(range.map(\.nominalSlot) == ["2027-03-31T09:00", "2027-05-31T09:00"], "COUNT skips invalid days")
        try check(range.map(\.index) == [2, 3], "range keeps the original finite indexes")
        try check(Policy.index("2027-05-31T09:00:00", in: rule) == 3, "seconds syntax refers to the same original slot")
        try check(Policy.index("2027-03-31T09:01", in: rule) == nil, "a different clock time is not an original slot")
        try check(Policy.index("2027-07-31T09:00", in: rule) == nil, "a slot after COUNT is exhausted is not a member")

        var split = rule
        split.endExclusive = "2027-05-31T09:00"
        try check(Policy.index("2027-05-31T09:00", in: split) == nil, "following boundary excludes the selected slot")
        try check(Policy.future(split, afterMs: 0, deviceZone: utc, limit: 5).count == 2, "preceding slots survive the split")

        let inclusive = try Rule(anchor: "2027-01-01T09:00", frequency: "daily", until: "2027-01-02")
        try check(Policy.future(inclusive, afterMs: 0, deviceZone: utc, limit: 3).count == 2, "until is inclusive")

        let everyOtherDay = try Rule(anchor: "2020-01-01T09:00", frequency: "daily", interval: 2)
        let after = try instantMs("2027-01-01T00:00:00Z")
        let first = try Policy.future(everyOtherDay, afterMs: after, deviceZone: utc, limit: 1)
        try check(first.first?.nominalSlot == "2027-01-02T09:00", "seeking preserves the original interval alignment")
        try check(Policy.index("2027-01-02T09:00", in: everyOtherDay) == 1_280, "unbounded series membership uses the original index")
    }

    private static func travelAndIndependentOffsets() throws {
        let eastern = TimeZone(identifier: "America/New_York")!
        let floating = try Rule(anchor: "2027-01-01T09:00:08.075", frequency: "daily")
        let west = try Policy.resolve(floating, nominal: floating.anchor, deviceZone: pacific)
        let east = try Policy.resolve(floating, nominal: floating.anchor, deviceZone: eastern)
        try check(west.nominalSlot == east.nominalSlot && east.nominalSlot == floating.anchor, "travel preserves identity and milliseconds")
        try check(west.alarmAtMs - east.alarmAtMs == 3 * 3_600_000, "floating travel changes instant")
        try check(east.alarmAtMs % 1_000 == 75, "fractional seconds resolve exactly")

        let pinned = try Rule(anchor: "2027-01-01T09:00", frequency: "daily", zoneID: pacific.identifier)
        let pinnedSlot = try Policy.resolve(pinned, nominal: pinned.anchor, deviceZone: eastern)
        try check(pinnedSlot.zoneID == pacific.identifier, "pinned zone survives travel")

        let offsets = try Rule(anchor: "2027-03-14T01:30", frequency: "daily", dueOffsetMs: 2 * 3_600_000)
        let spring = try Policy.resolve(offsets, nominal: offsets.anchor, deviceZone: pacific)
        try check(spring.dueAtMs == instantMs("2027-03-14T10:30:00Z"), "civil due offset is independent of the elapsed gap")
        let gap = try Policy.resolve(offsets, nominal: "2027-03-14T02:30", deviceZone: pacific)
        try check(gap.adjusted && gap.eventEndMs - gap.eventStartMs == 1_800_000, "gap shifts clock but duration is elapsed")

        let allDay = try Rule(anchor: "2027-03-14T00:00", frequency: "daily", allDay: true, dueOffsetMs: dayMs)
        let day = try Policy.resolve(allDay, nominal: allDay.anchor, deviceZone: pacific)
        try check(day.dueAtMs == day.eventEndMs && day.eventEndMs - day.eventStartMs == 23 * 3_600_000,
                  "all-day due is the next local midnight even on a 23-hour day")
    }

    private static func noAlertUsesEventStart() throws {
        let after = try instantMs("2027-01-01T10:00:00Z")
        for offset in [-2 * dayMs, 2 * dayMs] {
            let rule = try Rule(anchor: "2027-01-01T09:00", frequency: "daily", count: 3, alarmOffsetMs: offset)
            let slots = try Policy.future(rule, afterMs: after, deviceZone: utc, mode: "None", limit: 3)
            try check(slots.map(\.nominalSlot) == ["2027-01-02T09:00", "2027-01-03T09:00"], "no-alert orders by event start")
            try check(slots.map(\.index) == [2, 3], "no-alert still consumes original COUNT")
            try check(slots.allSatisfy { $0.alarmAtMs - $0.eventStartMs == offset }, "authored alert survives no-alert mode")
            let notification = try Policy.future(rule, afterMs: after, deviceZone: utc, mode: "Notification", limit: 3)
            try check(notification == Policy.future(rule, afterMs: after, deviceZone: utc, limit: 3), "notification uses alert time")
        }
    }

    private static func impossibleRulesTerminate() throws {
        let leap = try Rule(anchor: "2027-01-01T09:00", frequency: "yearly", interval: 4, day: 29, month: 2)
        let monthly = try Rule(anchor: "2027-02-01T09:00", frequency: "monthlyDay", interval: 12, day: 31)
        try check(Policy.future(leap, afterMs: 0, deviceZone: utc, limit: 1).isEmpty, "impossible leap interval terminates")
        try check(Policy.future(monthly, afterMs: 0, deviceZone: utc, limit: 1).isEmpty, "impossible monthly interval terminates")
    }

    private static func rejectsInvalidCivilInputAndDecodedRules() throws {
        for invalidAnchor in ["2027-02-29T09:00", "2027-04-01T24:00", "2027-01-01T09:00:00.123\n"] {
            do {
                _ = try Rule(anchor: invalidAnchor, frequency: "daily")
                throw Failure("accepted invalid anchor \(invalidAnchor)")
            } catch let error as Policy.InvalidRule {
                try check(error.field == "anchor", "invalid anchor reports its field")
            }
        }
        let valid = try Rule(anchor: "2027-01-01T09:00", frequency: "daily")
        let encoded = try JSONEncoder().encode(valid)
        guard var data = try JSONSerialization.jsonObject(with: encoded) as? [String: Any] else {
            throw Failure("expected serialized rule object")
        }
        data["interval"] = 0
        let broken = try JSONDecoder().decode(Rule.self, from: JSONSerialization.data(withJSONObject: data))
        do {
            _ = try Policy.future(broken, afterMs: 0, deviceZone: utc, limit: 1)
            throw Failure("accepted invalid stored interval")
        } catch let error as Policy.InvalidRule {
            try check(error.field == "interval", "invalid stored interval reports its field")
        }
    }

    private static func instantMs(_ value: String) throws -> Int64 {
        guard let date = ISO8601DateFormatter().date(from: value) else { throw Failure("invalid fixture instant \(value)") }
        return Int64((date.timeIntervalSince1970 * 1_000).rounded())
    }

    private static func check(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw Failure(message) }
    }
}
