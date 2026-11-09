import CryptoKit
import Foundation

enum RemiloIOSSeries {
    typealias Rule = RemiloIOSRecurrence.Rule
    typealias Slot = RemiloIOSRecurrence.Slot

    static func rule(for record: IOSReminder, spec: [String: Any],
                     calendarBounds: (anchor: String, endExclusive: String?)? = nil) throws -> Rule {
        let input = IOSInput(values: spec)
        guard let zone = TimeZone(identifier: record.zoneID) else { throw input.invalid("zoneId") }
        let anchor = calendarBounds?.anchor ?? civil(record.eventStartMs, zone: zone)
        let mode = try input.choice("zoneMode", fallback: "floating", from: ["floating", "pinned"])
        guard calendarBounds == nil || mode == "pinned" else { throw input.invalid("zoneMode") }
        var weekdays: [Int]?
        if let raw = spec["weekdays"] {
            guard let values = raw as? [Any], values.count <= 7 else { throw input.invalid("weekdays") }
            weekdays = try values.map { value in
                Int(try IOSInput(values: ["weekdays": value]).integer("weekdays", range: 1...7))
            }
        }
        func optionalInteger(_ field: String, _ range: ClosedRange<Int64>) throws -> Int? {
            guard spec[field] != nil && !(spec[field] is NSNull) else { return nil }
            return Int(try input.integer(field, range: range))
        }
        let until = spec["until"] == nil || spec["until"] is NSNull
            ? nil : try input.text("until", maximum: 10)
        let endOffset = record.allDay ? 86_400_000 : record.eventEndMs - record.eventStartMs
        let dueOffset = record.allDay && record.dueLinked ? 86_400_000 : civilOffset(record.dueAtMs, from: record.eventStartMs, zone: zone)
        let alarmOffset: Int64
        if let calendarBounds {
            alarmOffset = try RemiloIOSRecurrence.civilOffset(record.alarmAtMs, fromNominal: calendarBounds.anchor, zone: zone)
        } else {
            alarmOffset = civilOffset(record.alarmAtMs, from: record.eventStartMs, zone: zone)
        }
        return try Rule(
            anchor: anchor, frequency: input.text("frequency", maximum: 32),
            interval: Int(input.integer("interval", fallback: 1, range: 1...999)),
            weekdays: weekdays, day: optionalInteger("day", 1...31),
            ordinal: Int(input.integer("ordinal", fallback: 1, range: -1...5)),
            weekday: optionalInteger("weekday", 1...7), month: optionalInteger("month", 1...12),
            count: optionalInteger("count", 1...100_000), until: until,
            zoneID: mode == "pinned" ? zone.identifier : nil,
            endExclusive: calendarBounds?.endExclusive,
            allDay: record.allDay, endOffsetMs: endOffset, dueOffsetMs: dueOffset, alarmOffsetMs: alarmOffset
        )
    }

    static func ruleProjection(_ rule: Rule, includeAnchor: Bool) -> [String: Any] {
        var result: [String: Any] = [
            "frequency": rule.frequency, "interval": rule.interval, "weekdays": rule.weekdays,
            "day": rule.day, "ordinal": rule.ordinal, "weekday": rule.weekday, "month": rule.month,
            "zoneMode": rule.zoneID == nil ? "floating" : "pinned",
        ]
        if let count = rule.count { result["count"] = count }
        if let until = rule.until { result["until"] = until }
        if includeAnchor {
            result["anchor"] = rule.anchor
            result["zoneId"] = iosBridgeValue(rule.zoneID)
            result["endExclusive"] = iosBridgeValue(rule.endExclusive)
        }
        return result
    }

    static func view(_ segment: IOSSeriesSegment, in state: IOSDatabase, now: Int64) throws -> [String: Any] {
        let slots = try eligibleFuture(segment, in: state, now: now, limit: 3, includePaused: true)
        let records = state.reminders.values.filter {
            $0.segmentID == segment.id && $0.independent != true && $0.active && ($0.nextAlertMs ?? 0) > now
        }
        return [
            "id": segment.id, "seriesId": segment.familyID, "revision": segment.revision, "state": segment.state,
            "exhausted": slots.isEmpty, "template": RemiloIOSProjection.draftFields(segment.template, state: state),
            "rule": ruleProjection(segment.rule, includeAnchor: true),
            "registered": records.filter { $0.deliveryState == "Scheduled" }.count,
            "pending": records.filter { ["Pending", "Blocked"].contains($0.deliveryState) }.count,
            "upcoming": slots.map { slotProjection($0) },
        ]
    }

    static func families(_ state: IOSDatabase, now: Int64) throws -> [[String: Any]] {
        let families = Dictionary(grouping: state.series.values, by: \.familyID)
        return try families.keys.sorted().compactMap { familyID in
            guard let members = families[familyID] else { return nil }
            let ordinary = members.filter { $0.state != "Archived" }
            let current = (ordinary.isEmpty ? members : ordinary).sorted {
                if $0.createdAtMs == $1.createdAtMs { return $0.id < $1.id }
                return $0.createdAtMs > $1.createdAtMs
            }.first
            guard let current else { return nil }
            var slots: [(IOSSeriesSegment, Slot)] = []
            for segment in ordinary {
                slots += try eligibleFuture(segment, in: state, now: now, limit: 3, includePaused: true).map { (segment, $0) }
            }
            slots.sort { ($0.1.eventStartMs, $0.0.id, $0.1.nominalSlot) < ($1.1.eventStartMs, $1.0.id, $1.1.nominalSlot) }
            let memberIDs = Set(members.map(\.id))
            let unfinished = state.reminders.values.filter {
                $0.active && $0.segmentID.map { memberIDs.contains($0) } == true
            }.count
            let upcoming = slots.prefix(3).map { segment, slot in
                slotProjection(slot).merging(["segmentId": segment.id, "mode": segment.template.mode, "state": segment.state]) { _, value in value }
            }
            return [
                "seriesId": familyID, "current": try view(current, in: state, now: now),
                "state": slots.isEmpty ? "Ended" : (slots.allSatisfy { $0.0.state == "Paused" } ? "Paused" : "Active"),
                "unfinishedCount": unfinished, "upcoming": upcoming,
            ]
        }
    }

    static func slotProjection(_ slot: Slot) -> [String: Any] {
        ["nominalSlot": slot.nominalSlot, "eventStartMs": slot.eventStartMs, "dueAtMs": slot.dueAtMs,
         "alarmAtMs": slot.alarmAtMs, "adjusted": slot.adjusted, "zoneId": slot.zoneID]
    }

    static func makeOccurrence(_ segment: IOSSeriesSegment, slot: Slot) -> IOSReminder {
        var record = segment.template
        record.id = occurrenceID(segment.id, slot.nominalSlot)
        record.segmentID = segment.id
        record.nominalSlot = slot.nominalSlot
        return applying(slot, to: record)
    }

    static func applying(_ slot: Slot, to source: IOSReminder) -> IOSReminder {
        var record = source
        record.eventStartMs = slot.eventStartMs
        record.eventEndMs = slot.eventEndMs
        record.dueAtMs = slot.dueAtMs
        record.alarmAtMs = slot.alarmAtMs
        record.zoneID = slot.zoneID
        return record
    }

    static func occurrenceID(_ segmentID: String, _ nominal: String) -> String {
        // The portable identity uses the same name-based UUID as Android.
        namedUUID("remilo:\(segmentID):\(nominal)")
    }

    static func namedUUID(_ seed: String) -> String {
        var bytes = Array(Insecure.MD5.hash(data: Data(seed.utf8)))
        bytes[6] = (bytes[6] & 0x0f) | 0x30
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
            .uuidString.lowercased()
    }

    static func eligibleFuture(
        _ segment: IOSSeriesSegment, in state: IOSDatabase, now: Int64, limit: Int, includePaused: Bool = false
    ) throws -> [Slot] {
        guard segment.state == "Active" || (includePaused && segment.state == "Paused") else { return [] }
        let blocked = state.reminders.values.filter {
            $0.segmentID == segment.id && (!$0.active || $0.independent == true || $0.agendaAtMs <= now)
        }.count
        let candidates = try RemiloIOSRecurrence.future(
            segment.rule, afterMs: now, deviceZone: .current, mode: segment.template.mode,
            limit: min(100_000, limit + blocked + state.excludedOccurrences.count)
        )
        return Array(candidates.lazy.filter { slot in
            let id = occurrenceID(segment.id, slot.nominalSlot)
            if state.excludedOccurrences.contains(id) { return false }
            return state.reminders[id].map { $0.active && $0.independent != true && $0.agendaAtMs > now } ?? true
        }.prefix(limit))
    }

    static func deliveryTime(_ slot: Slot, mode: String) -> Int64 {
        mode == "None" ? slot.eventStartMs : slot.alarmAtMs
    }

    static func civil(_ millis: Int64, zone: TimeZone) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let fraction = Int((millis % 1_000 + 1_000) % 1_000)
        let value = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: iosDate(millis - Int64(fraction)))
        let posix = Locale(identifier: "en_US_POSIX")
        let seconds = String(format: "%04d-%02d-%02dT%02d:%02d:%02d", locale: posix,
                             value.year ?? 1970, value.month ?? 1, value.day ?? 1,
                             value.hour ?? 0, value.minute ?? 0, value.second ?? 0)
        return fraction == 0 ? seconds : seconds + String(format: ".%03d", locale: posix, fraction)
    }

    private static func civilOffset(_ millis: Int64, from anchor: Int64, zone: TimeZone) -> Int64 {
        let value = iosDate(millis)
        let initial = iosDate(anchor)
        return millis - anchor + Int64(zone.secondsFromGMT(for: value) - zone.secondsFromGMT(for: initial)) * 1_000
    }
}
