import Foundation

enum EventChecks {
    private typealias Event = RemiloIOSGoogleCalendarEvent
    private typealias Transport = RemiloIOSGoogleCalendarTransport
    private static let losAngeles = "America/Los_Angeles"

    static func run() throws {
        try civilTimeAndAuthorship()
        try recurrenceMatchesAndroidExamples()
        try unsupportedRowsAndInstancesRemainVisible()
    }

    private static func civilTimeAndAuthorship() throws {
        let title = "  读书 📝  "
        let notes = "  第一行\n第二行 <em>保持原文</em>  "
        let source = timed("2027-03-15T09:00:00.123456789-07:00", "2027-03-15T10:00:00.456-07:00")
            .merging(["summary": title, "description": notes]) { _, new in new }
        let row = Event.row(try remote(source), calendarZone: losAngeles)!
        let expected = try Event.timestamp("2027-03-15T16:00:00.123Z")
        precondition(row.title == title && row.fields?.title == "读书 📝" && row.fields?.notes == notes)
        precondition(row.fields?.schedule.eventStartMs == expected && row.fields?.schedule.zoneId == losAngeles)
        let allDay: [String: Any] = ["start": ["date": "2027-03-14"], "end": ["date": "2027-03-15"]]
        let schedule = try Event.fields(allDay, calendarZone: losAngeles).fields.schedule
        precondition(schedule.allDay && schedule.eventEndMs - schedule.eventStartMs == 23 * 3_600_000)
        let range = try Event.Range(from: "2027-03-14", until: "2027-03-15", zone: TimeZone(identifier: losAngeles)!)
        precondition(range.until.timeIntervalSince(range.from) == 23 * 3600)
        do {
            _ = try Event.Range(from: "2027-01-01", until: "2028-01-03", zone: TimeZone(identifier: losAngeles)!)
            preconditionFailure("An oversized range must fail")
        } catch RemiloIOSGoogleCalendarFailure.invalidRange {}
    }

    private static func recurrenceMatchesAndroidExamples() throws {
        let cases: [(String, String, [String])] = [
            ("2027-01-31", "FREQ=MONTHLY;BYMONTHDAY=31;COUNT=4", ["2027-01-31", "2027-03-31", "2027-05-31", "2027-07-31"]),
            ("2028-02-29", "FREQ=YEARLY;COUNT=3", ["2028-02-29", "2032-02-29", "2036-02-29"]),
            ("2027-01-29", "FREQ=MONTHLY;BYDAY=5FR;COUNT=3", ["2027-01-29", "2027-04-30", "2027-07-30"]),
            ("2027-01-29", "FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=3", ["2027-01-29", "2027-02-26", "2027-03-31"]),
            ("2027-01-04", "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR,MO;COUNT=4", ["2027-01-04", "2027-01-08", "2027-01-18", "2027-01-22"]),
            ("2027-01-04", "FREQ=DAILY;UNTIL=20270105T160000Z", ["2027-01-04"]),
        ]
        let zone = TimeZone(identifier: losAngeles)!
        for (start, line, expected) in cases {
            var source = timed(start + "T09:00:00-08:00", start + "T10:00:00-08:00")
            source["recurrence"] = ["RRULE:" + line]
            let mapped = try Event.fields(source, calendarZone: losAngeles)
            let rule = mapped.rule!
            let slots = try RemiloIOSRecurrence.future(rule, afterMs: -1, deviceZone: zone, mode: "None", limit: 6)
            precondition(slots.map { String($0.nominalSlot.prefix(10)) } == expected)
            let canonical = mapped.fields.schedule.recurrence!.first!
            precondition(canonical.contains("WKST=MO"))
            if rule.frequency == "weekly" { precondition(canonical.contains("BYDAY=MO,FR")) }
        }
        var spring = timed("2027-03-13T02:30:00-08:00", "2027-03-13T03:30:00-08:00")
        spring["recurrence"] = ["RRULE:FREQ=DAILY;COUNT=3"]
        let rule = try Event.fields(spring, calendarZone: losAngeles).rule!
        let slots = try RemiloIOSRecurrence.future(rule, afterMs: -1, deviceZone: zone, mode: "None", limit: 3)
        precondition(Event.nominal(slots[1].eventStartMs, zone: zone) == "2027-03-14T03:30:00")
        var fractional = timed("2027-01-04T09:00:00.123-08:00", "2027-01-04T10:00:00.123-08:00")
        fractional["recurrence"] = ["RRULE:FREQ=DAILY;UNTIL=20270105T170000Z"]
        let exact = try Event.fields(fractional, calendarZone: losAngeles).rule!
        let exactSlots = try RemiloIOSRecurrence.future(exact, afterMs: -1, deviceZone: zone, mode: "None", limit: 3)
        precondition(exactSlots.count == 1)
    }

    private static func unsupportedRowsAndInstancesRemainVisible() throws {
        let source = timed("2027-01-04T09:00:00-08:00", "2027-01-04T10:00:00-08:00")
        let unsupported: [(String, Any, Event.Reason)] = [
            ("attendees", [["email": "guest@example.test"]], .meeting), ("attendeesOmitted", true, .meeting),
            ("locked", true, .locked), ("privateCopy", true, .locked), ("eventType", "birthday", .special),
            ("endTimeUnspecified", true, .unspecifiedEnd), ("status", "cancelled", .removed),
            ("summary", String(repeating: "课", count: 201), .contentLimit),
            ("end", ["dateTime": "2027-02-30T10:00:00-08:00"], .invalidEvent),
            ("end", ["dateTime": "2027-01-04T10:00:00-08:00", "timeZone": "Europe/London"], .incompatibleZones),
            ("recurrence", ["RRULE:FREQ=HOURLY"], .unsupportedRecurrence),
            ("recurrence", ["RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=3"], .unsupportedRecurrence),
            ("recurrence", ["RRULE:FREQ=DAILY;COUNT=3", "EXDATE:20270105T170000Z"], .unsupportedRecurrence),
            ("recurrence", ["RRULE:FREQ=DAILY;COUNT=2;UNTIL=20270106T000000Z"], .unsupportedRecurrence),
        ]
        for (key, value, expected) in unsupported {
            let row = Event.row(try remote(source.merging([key: value]) { _, new in new }), calendarZone: losAngeles)
            precondition(row?.unsupportedReason == expected && row?.fields == nil)
        }
        let multi = try remote(["start": ["date": "2027-01-04"], "end": ["date": "2027-01-06"]])
        precondition(Event.row(multi, calendarZone: losAngeles)?.unsupportedReason == .multiDay)
        let valid = try remote(source)
        precondition(Event.row(valid, calendarZone: "GMT+03:00")?.unsupportedReason == .invalidZone)
        precondition(Event.row(valid, calendarZone: losAngeles, disposition: .hidden) == nil)
        precondition(Event.row(valid, calendarZone: losAngeles, disposition: .erased)?.erased == true)
        var folded = timed("2027-11-06T01:30:00-07:00", "2027-11-06T02:30:00-07:00")
        folded["recurrence"] = ["RRULE:FREQ=DAILY;UNTIL=20271107T093000Z"]
        let foldedRow = Event.row(try remote(folded), calendarZone: losAngeles)
        precondition(foldedRow?.unsupportedReason == .unsupportedRecurrence)
        let moved = try remote([
            "recurringEventId": "master", "originalStartTime": ["dateTime": "2027-03-15T16:00:00Z"],
            "start": ["dateTime": "2027-03-16T16:00:00Z"],
        ], id: "google-instance-id")
        precondition(Event.row(moved, calendarZone: losAngeles)?.unsupportedReason == .instanceRequiresMaster)
        let identity = try Event.originalInstance(moved, masterZoneID: losAngeles)
        precondition(identity.eventID == "google-instance-id" && identity.masterID == "master" && identity.nominalSlot == "2027-03-15T09:00")
    }

    private static func timed(_ start: String, _ end: String) -> [String: Any] {
        ["start": ["dateTime": start], "end": ["dateTime": end]]
    }

    private static func remote(_ event: [String: Any], id: String = "event") throws -> Transport.Event {
        Transport.Event(id: id, etag: nil, cancelled: event["status"] as? String == "cancelled",
                        json: try JSONSerialization.data(withJSONObject: event))
    }
}
