import Foundation

enum RemiloIOSProjection {
    static let epoch: ClosedRange<Int64> = 0...253_402_300_799_999

    static func draft(
        _ input: IOSInput, id: String, previous: IOSReminder?, state: IOSDatabase, now: Int64
    ) throws -> IOSReminder {
        let title = try input.text("title", fallback: previous?.title ?? "", maximum: 200)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { throw input.invalid("title") }
        let notes = try input.text("notes", fallback: previous?.notes ?? "", maximum: 10_000)
        let mode = try input.choice("mode", fallback: previous?.mode ?? "Alarm", from: ["Alarm", "Notification", "None"])
        let zoneID = try input.text("zoneId", fallback: previous?.zoneID ?? TimeZone.current.identifier, maximum: 100)
        guard let zone = TimeZone(identifier: zoneID) else { throw input.invalid("zoneId") }
        let allDay = try input.flag("allDay", fallback: previous?.allDay ?? false)
        let dueLinked = try input.flag("dueLinked", fallback: previous?.dueLinked ?? true)
        let alarmLinked = try input.flag("alarmLinked", fallback: previous?.alarmLinked ?? true)
        let sound = try input.choice("sound", fallback: previous?.sound ?? state.settings.alertSound, from: ["remilo", "system"])
        let explicitAlarm = try input.values["alarmAtMs"].map { _ in try input.integer("alarmAtMs", range: epoch) }
        let rawStart = try input.integer("eventStartMs", fallback: previous?.eventStartMs ?? explicitAlarm ?? now + 600_000, range: epoch)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let day = calendar.startOfDay(for: iosDate(rawStart))
        let start = allDay ? iosMillis(day) : rawStart
        let shift = start - (previous?.eventStartMs ?? start)
        let end: Int64
        if allDay {
            guard let nextDay = calendar.date(byAdding: .day, value: 1, to: day) else { throw input.invalid("eventEndMs") }
            end = iosMillis(nextDay)
        } else {
            end = try input.integer("eventEndMs", fallback: (previous?.eventEndMs ?? start + 1_800_000) + shift, range: epoch)
        }
        guard end > start, epoch.contains(start), epoch.contains(end) else { throw input.invalid("eventEndMs") }
        let defaultDue = allDay && dueLinked ? end : (previous.map { $0.dueAtMs + (dueLinked ? shift : 0) } ?? start)
        let due = try input.integer("dueAtMs", fallback: defaultDue, range: epoch)
        let alarm: Int64
        if let explicitAlarm {
            alarm = explicitAlarm
        } else if allDay && alarmLinked {
            var previousCalendar = calendar
            previousCalendar.timeZone = previous.flatMap { TimeZone(identifier: $0.zoneID) } ?? zone
            let clock = previous.flatMap { old in
                old.allDay && old.alarmLinked ? previousCalendar.dateComponents([.hour, .minute], from: iosDate(old.alarmAtMs)) : nil
            }
            guard let time = calendar.date(
                bySettingHour: clock?.hour ?? 9, minute: clock?.minute ?? 0, second: 0, of: day
            ) else { throw input.invalid("alarmAtMs") }
            alarm = iosMillis(time)
        } else {
            alarm = previous.map { $0.alarmAtMs + (alarmLinked ? due - $0.dueAtMs : 0) } ?? due
        }
        guard epoch.contains(alarm) else { throw input.invalid("alarmAtMs") }

        var listID = previous?.listID
        if let value = input.values["listId"] {
            if value is NSNull {
                listID = nil
            } else {
                guard let id = value as? String, state.lists[id] != nil else { throw input.invalid("listId") }
                listID = id
            }
        }

        var record = previous ?? IOSReminder(
            id: id, title: title, notes: notes, listID: listID, eventStartMs: start,
            eventEndMs: end, dueAtMs: due, alarmAtMs: alarm, zoneID: zoneID,
            mode: mode, allDay: allDay, dueLinked: dueLinked, alarmLinked: alarmLinked
        )
        record.title = title
        record.notes = notes
        record.listID = listID
        record.eventStartMs = start
        record.eventEndMs = end
        record.dueAtMs = due
        record.alarmAtMs = alarm
        record.zoneID = zoneID
        record.mode = mode
        record.allDay = allDay
        record.dueLinked = dueLinked
        record.alarmLinked = alarmLinked
        record.sound = sound
        return record
    }

    static func occurrence(
        _ record: IOSReminder, state: IOSDatabase, now: Int64, calendar: Calendar, includeHistory: Bool = false
    ) -> [String: Any] {
        let segment = record.segmentID.flatMap { state.series[$0] }
        let session = state.routineSessions[record.id]
        let plan = session.flatMap { state.routines[$0.routineID] }
        var result = draftFields(record, state: state)
        result.merge([
            "id": record.id, "completed": record.completed, "deleted": record.deleted,
            "revision": record.revision, "generation": record.generation, "nextAlertMs": iosBridgeValue(record.nextAlertMs),
            "deliveryState": record.deliveryState, "overdue": record.overdue(at: now), "overdueAtMs": record.overdueAtMs,
            "agendaAtMs": record.agendaAtMs, "agendaGroup": group(record, now: now, calendar: calendar),
            "segmentId": iosBridgeValue(record.segmentID), "nominalSlot": iosBridgeValue(record.nominalSlot),
            "seriesId": iosBridgeValue(segment?.familyID), "seriesState": iosBridgeValue(segment?.state),
            "repeatSummary": NSNull(), "repeatRule": iosBridgeValue(segment.map { RemiloIOSSeries.ruleProjection($0.rule, includeAnchor: false) }),
            "routine": iosBridgeValue(plan.flatMap { session?.bridge(record: record, plan: $0, now: now, zone: calendar.timeZone) }),
            "exception": record.independent == true, "skipped": record.skipped == true,
            "alertAdjustment": iosBridgeValue(record.adjustment), "quickSnoozeMinutes": state.settings.snoozeMinutes,
        ]) { _, latest in latest }
        if !record.active { result["collectionAtMs"] = record.collectionAtMs }
        if includeHistory {
            result["history"] = record.history.map {
                ["kind": $0.kind, "atMs": $0.atMs, "targetMs": iosBridgeValue($0.targetMs)] as [String: Any]
            }
        }
        return result
    }

    static func draftFields(_ record: IOSReminder, state: IOSDatabase) -> [String: Any] {
        [
            "title": record.title, "notes": record.notes, "listId": iosBridgeValue(record.listID),
            "listName": record.listID.flatMap { state.lists[$0]?.name } ?? "",
            "eventStartMs": record.eventStartMs, "eventEndMs": record.eventEndMs,
            "dueAtMs": record.dueAtMs, "alarmAtMs": record.alarmAtMs,
            "mode": record.mode, "allDay": record.allDay, "zoneId": record.zoneID,
            "dueLinked": record.dueLinked, "alarmLinked": record.alarmLinked,
            "sound": record.sound ?? "remilo", "vibration": false,
        ]
    }

    static func list(_ list: IOSList, state: IOSDatabase, now: Int64) -> [String: Any] {
        [
            "id": list.id, "name": list.name, "revision": list.revision,
            "overdueCount": state.reminders.values.filter { !$0.isTest && $0.listID == list.id && $0.overdue(at: now) }.count,
        ]
    }

    static func query(_ filter: [String: Any], cursor: String?, state: IOSDatabase, now: Int64) -> [String: Any] {
        let calendar = localCalendar
        let today = calendar.startOfDay(for: iosDate(now))
        let start = iosMillis(today)
        let end = iosMillis(calendar.date(byAdding: .day, value: 1, to: today) ?? today)
        let search = (filter["search"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let view = filter["view"] as? String ?? "agenda"
        let issues: Set<String> = ["Missed", "TimedOut", "Interrupted", "Blocked", "Failed", "DeliveryUnconfirmed"]
        let trash = view == "deleted" ? state.routines.values.compactMap { trashedRoutine($0, now: now, zone: calendar.timeZone) } : []
        let matching = (Array(state.reminders.values) + trash).filter { record in
            guard !record.isTest else { return false }
            if let session = state.routineSessions[record.id] {
                guard let plan = state.routines[session.routineID], plan.state != "Trashed" else { return false }
                if record.active {
                    guard plan.state == "Active", !session.steps.isEmpty, !session.ended,
                          session.date >= RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: calendar.timeZone) else { return false }
                }
            }
            if let segmentID = filter["segmentId"] as? String, !segmentID.isEmpty, record.segmentID != segmentID { return false }
            if let familyID = filter["seriesId"] as? String, !familyID.isEmpty,
               record.segmentID.flatMap({ state.series[$0]?.familyID }) != familyID { return false }
            if !search.isEmpty && !record.title.localizedCaseInsensitiveContains(search)
                && !record.notes.localizedCaseInsensitiveContains(search) { return false }
            if let list = filter["listId"] {
                if list is NSNull {
                    if record.listID != nil { return false }
                } else if record.listID != list as? String { return false }
            } else if let name = filter["listName"] as? String, !name.isEmpty,
                      record.listID.flatMap({ state.lists[$0]?.name }) != name { return false }
            if filter["deliveryIssuesOnly"] as? Bool == true && !issues.contains(record.deliveryState) { return false }
            if filter["overdueOnly"] as? Bool == true && !record.overdue(at: now) { return false }
            return true
        }
        let selected = matching.filter { record in
            switch view {
            case "deleted": record.deleted
            case "completed": !record.deleted && (record.completed || (filter["includeSkipped"] as? Bool == true && record.skipped == true))
            case "history": !record.deleted && (record.completed || record.skipped == true)
            case "overdue": record.overdue(at: now)
            case "today": record.active && record.agendaAtMs >= start && record.agendaAtMs < end
            case "upcoming": record.active && record.agendaAtMs >= end
            case "attention": record.active && (record.overdue(at: now) || issues.contains(record.deliveryState))
            default: record.active
            }
        }
        let ordered = selected.sorted { a, b in
            if ["deleted", "completed", "history"].contains(view) {
                if a.collectionAtMs != b.collectionAtMs { return a.collectionAtMs > b.collectionAtMs }
                if a.eventStartMs != b.eventStartMs { return a.eventStartMs > b.eventStartMs }
                return a.id < b.id
            }
            if view == "all" { return (a.eventStartMs, a.id) < (b.eventStartMs, b.id) }
            let aOverdue = a.overdue(at: now)
            let bOverdue = b.overdue(at: now)
            if aOverdue != bOverdue { return aOverdue }
            let aTime = aOverdue ? a.overdueAtMs : a.agendaAtMs
            let bTime = bOverdue ? b.overdueAtMs : b.agendaAtMs
            return (aTime, a.id) < (bTime, b.id)
        }
        let offset = min(ordered.count, max(0, cursor.flatMap(Int.init) ?? 0))
        let endOffset = min(ordered.count, offset + 50)
        let groups = Dictionary(grouping: ordered) { group($0, now: now, calendar: calendar) }.mapValues(\.count)
        return [
            "items": ordered[offset..<endOffset].map { record in
                var item = occurrence(record, state: state, now: now, calendar: calendar)
                if let plan = state.routines[record.id], let trashedAtMs = plan.trashedAtMs {
                    let recordedDays = state.routineSessions.values.filter { $0.routineID == plan.id && ($0.ended || $0.date <= RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: calendar.timeZone)) }.count
                    item["routineFamily"] = plan.bridge.merging(["trashedAtMs": trashedAtMs, "recordedDays": recordedDays]) { _, next in next }
                }
                return item
            },
            "nextCursor": iosBridgeValue(endOffset < ordered.count ? String(endOffset) : nil),
            "total": ordered.count, "groups": groups,
            "completedCount": matching.filter { !$0.deleted && $0.completed }.count,
        ]
    }

    private static func trashedRoutine(_ plan: IOSRoutinePlan, now: Int64, zone: TimeZone) -> IOSReminder? {
        guard plan.state == "Trashed", let version = plan.latest, let at = plan.trashedAtMs else { return nil }
        let start = (try? RemiloIOSRoutineAuthoring.time(version.effectiveDate, minutes: version.minutes, in: zone)) ?? now
        return IOSReminder(
            id: plan.id, title: version.title, notes: version.notes, listID: version.listID, eventStartMs: start,
            eventEndMs: start + 60_000, dueAtMs: start, alarmAtMs: start, zoneID: zone.identifier, mode: version.mode,
            allDay: false, dueLinked: true, alarmLinked: true, sound: version.sound, deleted: true,
            revision: plan.revision, deliveryState: "Deleted", history: [IOSHistory(kind: "Delete", atMs: at, targetMs: nil)]
        )
    }

    static var localCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar
    }

    private static func group(_ record: IOSReminder, now: Int64, calendar: Calendar) -> String {
        if record.completed || record.skipped == true { return "completed" }
        if record.overdue(at: now) { return "overdue" }
        let date = iosDate(record.agendaAtMs)
        if date < calendar.startOfDay(for: iosDate(now)) { return "earlier" }
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
    }
}
