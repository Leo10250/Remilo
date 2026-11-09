import Foundation

struct IOSCalendarInboundChange: Equatable, Sendable {
    struct Schedule: Equatable, Sendable {
        let eventStartMs: Int64
        let eventEndMs: Int64
        let allDay: Bool
        let zoneID: String

        var fields: [String: Any] {
            ["eventStartMs": eventStartMs, "eventEndMs": eventEndMs, "allDay": allDay, "zoneId": zoneID]
        }
    }

    let title: String
    let notes: String
    let schedule: Schedule

    func input(operationID: UUID, snapshot: IOSCalendarOneTimeSnapshot) -> IOSInput {
        var desired = schedule.fields
        desired["title"] = title
        desired["notes"] = notes
        return IOSInput(values: [
            "kind": "ApplyCalendarInbound", "operationId": RemiloIOSEngine.calendarInboundPrefix + operationID.uuidString.lowercased(),
            "occurrenceId": snapshot.occurrenceID, "expectedRevision": snapshot.revision, "expectedGeneration": snapshot.generation,
            "reviewed": ["title": snapshot.title, "notes": snapshot.notes, "eventStartMs": snapshot.eventStartMs,
                         "eventEndMs": snapshot.eventEndMs, "allDay": snapshot.allDay, "zoneId": snapshot.zoneID],
            "desired": desired,
        ])
    }
}

extension IOSCalendarInboundChange.Schedule {
    init(_ record: IOSReminder) {
        self.init(eventStartMs: record.eventStartMs, eventEndMs: record.eventEndMs, allDay: record.allDay, zoneID: record.zoneID)
    }
}

struct IOSCalendarInboundTiming: Equatable, Sendable {
    let mode: String
    let dueAtMs: Int64
    let alarmAtMs: Int64
    let retainedAlertMs: Int64?
}

struct IOSCalendarInboundProjection {
    let record: IOSReminder
    let changed: Bool
    let replacesRegistration: Bool
    let retainedAlertMs: Int64?

    var timing: IOSCalendarInboundTiming {
        IOSCalendarInboundTiming(mode: record.mode, dueAtMs: record.dueAtMs, alarmAtMs: record.alarmAtMs,
                                 retainedAlertMs: retainedAlertMs)
    }

    init(_ change: IOSCalendarInboundChange, from old: IOSReminder, state: IOSDatabase, now: Int64) throws {
        let title = change.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { throw IOSInputFailure("TITLE_REQUIRED", field: "title") }
        guard title.utf16.count <= 200, change.notes.utf16.count <= 10_000 else { throw IOSInputFailure("CONTENT_LIMIT") }
        let schedule = change.schedule
        let scheduleChanged = schedule != .init(old)
        changed = scheduleChanged || title != old.title || change.notes != old.notes
        var updated = old
        updated.title = title
        updated.notes = change.notes
        if scheduleChanged {
            guard let zone = TimeZone(identifier: schedule.zoneID),
                  schedule.zoneID.contains("/") || schedule.zoneID == "UTC" || schedule.zoneID == "GMT"
                    || TimeZone.knownTimeZoneIdentifiers.contains(schedule.zoneID) else {
                throw IOSInputFailure("INVALID_ZONE", field: "zoneId")
            }
            let draft = try RemiloIOSProjection.draft(IOSInput(values: schedule.fields), id: old.id,
                                                      previous: old, state: state, now: now)
            guard draft.eventStartMs == schedule.eventStartMs, draft.eventEndMs == schedule.eventEndMs else {
                throw IOSInputFailure("INVALID_INPUT", field: "eventEndMs")
            }
            updated.eventStartMs = draft.eventStartMs
            updated.eventEndMs = draft.eventEndMs
            updated.allDay = draft.allDay
            updated.zoneID = draft.zoneID
            updated.dueAtMs = draft.dueAtMs
            updated.alarmAtMs = draft.allDay && old.alarmLinked
                ? try Self.allDayAlert(from: old, on: draft.eventStartMs, zone: zone) : draft.alarmAtMs
        }
        if let target = old.registration?.targetMs, old.mode != "None", old.nextAlertMs == target, target > now,
           old.adjustment == "Snoozed" || old.adjustment == "Postponed" || target != old.alarmAtMs {
            retainedAlertMs = target
        } else { retainedAlertMs = nil }
        replacesRegistration = scheduleChanged && old.mode != "None" && updated.alarmAtMs != old.alarmAtMs && retainedAlertMs == nil
        guard !replacesRegistration || updated.alarmAtMs > now else { throw IOSInputFailure("ELAPSED_ALERT", field: "alarmAtMs") }
        record = updated
    }

    private static func allDayAlert(from old: IOSReminder, on startMs: Int64, zone: TimeZone) throws -> Int64 {
        guard let oldZone = TimeZone(identifier: old.zoneID) else { throw IOSInputFailure("INVALID_ZONE", field: "zoneId") }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = oldZone
        let clock = calendar.dateComponents([.hour, .minute, .second], from: iosDate(old.alarmAtMs))
        calendar.timeZone = zone
        let day = calendar.dateComponents([.year, .month, .day], from: iosDate(startMs))
        guard let year = day.year, let month = day.month, let date = day.day,
              let hour = clock.hour, let minute = clock.minute, let second = clock.second else {
            throw IOSInputFailure("INVALID_INPUT", field: "alarmAtMs")
        }
        let midnight = String(format: "%04d-%02d-%02dT00:00", year, month, date)
        let offset = Int64(hour * 3_600 + minute * 60 + second) * 1_000 + old.alarmAtMs % 1_000
        let alert = try RemiloIOSRecurrence.resolveOffset(midnight, by: offset, in: zone)
        guard RemiloIOSProjection.epoch.contains(alert) else { throw IOSInputFailure("INVALID_INPUT", field: "alarmAtMs") }
        return alert
    }
}

extension RemiloIOSEngine {
    func previewCalendarInbound(for snapshot: IOSCalendarOneTimeSnapshot, change: IOSCalendarInboundChange) throws -> IOSCalendarInboundTiming {
        try calendarInboundProjection(for: snapshot, change: change, state: read(), now: iosMillis(Date())).timing
    }

    func calendarInboundProjection(for snapshot: IOSCalendarOneTimeSnapshot, change: IOSCalendarInboundChange,
                                   state: IOSDatabase, now: Int64) throws -> IOSCalendarInboundProjection {
        let current: IOSCalendarOneTimeSnapshot
        do { current = try calendarOneTimeSnapshot(snapshot.occurrenceID, for: .manualLink) }
        catch is IOSCalendarOneTimeSnapshot.Failure { throw IOSInputFailure("STALE_PREVIEW") }
        guard current == snapshot, let record = state.reminders[snapshot.occurrenceID] else { throw IOSInputFailure("STALE_PREVIEW") }
        if change.schedule != .init(record), let registration = record.registration, registration.mode == "Alarm",
           try RemiloIOSDelivery.isAlarmAlerting(registration.systemID) {
            throw IOSInputFailure("RINGING_DEFERRED")
        }
        return try IOSCalendarInboundProjection(change, from: record, state: state, now: now)
    }
}
