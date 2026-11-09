import Foundation

struct IOSRoutineAlarmCapture: Equatable {
    let occurrenceID: String
    let routineID: String
    let date: String
    let generation: Int
    let registrationID: UUID
    let snoozeMinutes: Int
    let closesAtMs: Int64

    var bridge: [String: Any] {
        [
            "kind": "RoutineAlarmActions", "occurrenceId": occurrenceID, "routineId": routineID,
            "date": date, "expectedGeneration": generation, "expectedSessionId": registrationID.uuidString,
            "expectedSnoozeMinutes": snoozeMinutes, "closesAtMs": closesAtMs,
        ]
    }
}

extension RemiloIOSEngine {
    func captureRoutineAlarm(occurrenceID: String, generation: Int, registrationID: UUID?,
                             now: Int64 = iosMillis(Date()), zone: TimeZone = .current) throws -> IOSRoutineAlarmCapture {
        let (capture, _) = try routineAlarm(
            occurrenceID: occurrenceID, generation: generation, registrationID: registrationID,
            state: read(), now: now, zone: zone
        )
        return capture
    }

    func mutateRoutineAlarm(_ kind: String, input: IOSInput, state: inout IOSDatabase,
                            now: Int64, zone: TimeZone = .current) throws -> IOSReminder {
        let id = try input.text("occurrenceId", maximum: 200)
        let expected = try input.integer("expectedGeneration", range: 1...Int64.max)
        let expectedSession = try input.text("expectedSessionId", maximum: 36)
        guard let registrationID = UUID(uuidString: expectedSession) else { throw input.invalid("expectedSessionId") }
        let (capture, original) = try routineAlarm(
            occurrenceID: id, generation: Int(expected), registrationID: registrationID, state: state, now: now, zone: zone
        )
        guard try input.text("date", maximum: 10) == capture.date else { throw IOSInputFailure("DAY_ENDED") }
        var record = original
        if kind == "SnoozeRoutineAlarm" {
            let minutes = try input.integer("expectedSnoozeMinutes", range: 1...1_440)
            guard minutes == capture.snoozeMinutes else { throw IOSInputFailure("STALE_SNOOZE") }
            let target = now + minutes * 60_000
            guard target < capture.closesAtMs else { throw IOSInputFailure("DAY_ENDED") }
            replaceRegistration(&record, target: target, state: &state, now: now)
            record.adjustment = "Snoozed"
            record.history.append(IOSHistory(kind: "Snooze", atMs: now, targetMs: target))
        } else {
            replaceRegistration(&record, target: nil, state: &state, now: now)
            record.deliveryState = "Stopped"
            record.adjustment = nil
            record.history.append(IOSHistory(kind: "Stop", atMs: now, targetMs: nil))
        }
        state.reminders[id] = record
        return record
    }

    private func routineAlarm(occurrenceID: String, generation: Int, registrationID: UUID?,
                              state: IOSDatabase, now: Int64, zone: TimeZone) throws -> (IOSRoutineAlarmCapture, IOSReminder) {
        guard let record = state.reminders[occurrenceID], let session = state.routineSessions[occurrenceID],
              let plan = state.routines[session.routineID] else { throw IOSInputFailure("NOT_FOUND") }
        guard record.generation == generation, let registration = record.registration,
              registrationID == nil || registration.systemID == registrationID else { throw IOSInputFailure("STALE_GENERATION") }
        let closes = try RemiloIOSRoutineAuthoring.closeAt(session.date, in: zone)
        guard !session.ended, now < closes, session.date == RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone) else {
            throw IOSInputFailure("DAY_ENDED")
        }
        guard record.active, plan.state == "Active", !session.steps.isEmpty, record.mode == "Alarm",
              registration.mode == "Alarm", registration.targetMs <= now, record.zoneID == zone.identifier,
              ["Scheduled", "Alerting", "Pending"].contains(record.deliveryState) else {
            throw IOSInputFailure("NOT_ELIGIBLE")
        }
        let capture = IOSRoutineAlarmCapture(
            occurrenceID: occurrenceID, routineID: session.routineID, date: session.date,
            generation: generation, registrationID: registration.systemID,
            snoozeMinutes: state.settings.snoozeMinutes, closesAtMs: closes
        )
        return (capture, record)
    }
}
