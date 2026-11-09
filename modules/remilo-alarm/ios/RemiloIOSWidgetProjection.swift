import Foundation

enum RemiloIOSWidgetProjection {
    static func snapshot(
        _ state: IOSDatabase, at now: Int64, in zone: TimeZone, language: String, profiles: [IOSWidgetProfile] = []
    ) -> RemiloWidgetSnapshot {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let instant = iosDate(now)
        let start = calendar.startOfDay(for: instant)
        let end = calendar.date(byAdding: .day, value: 1, to: start) ?? instant
        let date = RemiloIOSRoutineAuthoring.localDate(instant, in: zone)
        let dayRange = iosMillis(start)..<iosMillis(end)

        let today = state.reminders.values.filter {
            !$0.isTest && $0.routineID == nil && $0.active && ($0.overdue(at: now) || dayRange.contains($0.agendaAtMs))
        }.sorted { a, b in
            let aOverdue = a.overdue(at: now)
            let bOverdue = b.overdue(at: now)
            if aOverdue != bOverdue { return aOverdue }
            return (aOverdue ? a.overdueAtMs : a.agendaAtMs, a.id) < (bOverdue ? b.overdueAtMs : b.agendaAtMs, b.id)
        }
        let reminders = today.prefix(20).map {
            RemiloWidgetSnapshot.Reminder(
                id: $0.id, title: $0.title, agendaAtMs: $0.agendaAtMs, overdueAtMs: $0.overdueAtMs, allDay: $0.allDay
            )
        }
        let routines = state.routines.values.filter { $0.state != "Trashed" }.compactMap {
            routine($0, date: date, now: now, in: zone, state: state, language: language)
        }.sorted { ($0.title, $0.id) < ($1.title, $1.id) }
        return RemiloWidgetSnapshot(
            schemaVersion: RemiloWidgetSnapshot.currentVersion, date: date,
            dayStartsAtMs: dayRange.lowerBound, dayEndsAtMs: dayRange.upperBound, zoneID: zone.identifier,
            language: language, reminders: reminders, reminderCount: today.count, routines: routines,
            profiles: profiles.isEmpty ? nil : profiles.map { profile($0, date: date, state: state) }
        )
    }

    private static func profile(_ profile: IOSWidgetProfile, date: String, state: IOSDatabase) -> RemiloWidgetSnapshot.Profile {
        var done: RemiloWidgetProfileAction?
        var undo: RemiloWidgetProfileAction?
        var undoName: String?
        var retry: RemiloWidgetProfileAction?
        if let pending = profile.pending {
            if pending.date == date && pending.isValid && pending.profileRevision == profile.revision {
                retry = pending
            }
        } else if let session = IOSWidgetProfilePolicy.session(profile, date: date, state: state) {
            if let step = session.steps.first(where: { !session.done.contains($0.id) }) {
                done = IOSWidgetProfilePolicy.action(profile, session: session, stepID: step.id)
            }
            if let completion = IOSWidgetProfilePolicy.latestCompletion(profile, session: session) {
                undo = IOSWidgetProfilePolicy.action(
                    profile, session: session, stepID: completion.stepID, undoOperationID: completion.operationID
                )
                undoName = session.steps.first(where: { $0.id == completion.stepID })?.name
            }
        }
        return RemiloWidgetSnapshot.Profile(
            id: profile.id, title: profile.title, routineID: profile.routineID,
            done: done, undo: undo, undoName: undoName, retry: retry
        )
    }

    private static func routine(
        _ plan: IOSRoutinePlan, date: String, now: Int64, in zone: TimeZone, state: IOSDatabase, language: String
    ) -> RemiloWidgetSnapshot.Routine? {
        guard let latest = plan.latest else { return nil }
        let id = RemiloIOSSeries.occurrenceID(plan.id, date)
        let session = state.routineSessions[id]
        let record = state.reminders[id]
        let version = session.flatMap { session in plan.versions.first { $0.revision == session.versionRevision } }
            ?? plan.version(on: date)
        let steps = session?.steps ?? version.flatMap { try? RemiloIOSRoutineAuthoring.day(date, in: $0).exercises } ?? []
        let completed = session?.done ?? []
        let pending = steps.filter { !completed.contains($0.id) }
        let status: RemiloWidgetSnapshot.Routine.State
        if date < plan.startsOn || version == nil || record?.deleted == true { status = .unavailable }
        else if steps.isEmpty { status = .rest }
        else if record?.skipped == true { status = .skipped }
        else if record?.completed == true { status = .complete }
        else if plan.state == "Paused" { status = .paused }
        else if session?.ended == true || (try? RemiloIOSRoutineAuthoring.closeAt(date, in: zone)).map({ now >= $0 }) == true {
            status = .unavailable
        } else { status = completed.isEmpty ? .ready : .inProgress }

        let showsStep = status == .ready || status == .inProgress
        let actionAvailable = showsStep && record?.active == true
        let current = showsStep ? pending.first.map {
            RemiloWidgetSnapshot.Routine.Step(id: $0.id, name: $0.name, target: target($0, language: language))
        } : nil
        return RemiloWidgetSnapshot.Routine(
            id: plan.id, title: record?.title ?? version?.title ?? latest.title, state: status,
            occurrenceID: actionAvailable ? session?.occurrenceID : nil, revision: actionAvailable ? session?.revision : nil,
            done: steps.filter { completed.contains($0.id) }.count, total: steps.count,
            current: current, nextName: showsStep ? pending.dropFirst().first?.name : nil
        )
    }

    static func target(_ step: IOSRoutineStep, language: String) -> String {
        guard let value = step.exerciseTarget else { return step.target }
        let reps = value.reps.map { reps in
            if let maximum = value.repsMax {
                return RemiloWidgetCopy.repsRange(language, min: String(reps), max: String(maximum))
            }
            return RemiloWidgetCopy.reps(language, count: String(reps))
        }
        let time = value.duration.map { duration in
            let count = targetNumber(duration.value)
            switch duration.unit {
            case "hr": return RemiloWidgetCopy.hours(language, count: count)
            case "min": return RemiloWidgetCopy.minutes(language, count: count)
            default: return RemiloWidgetCopy.seconds(language, count: count)
            }
        }
        let sets = value.sets.map { RemiloWidgetCopy.sets(language, count: String($0)) }
        var amount: String
        if let reps, let time {
            amount = [sets, RemiloWidgetCopy.perSet(language, value: reps), RemiloWidgetCopy.perSet(language, value: time)]
                .compactMap { $0 }.joined(separator: " · ")
        } else {
            amount = [sets, reps ?? time].compactMap { $0 }.joined(separator: " × ")
        }
        if value.eachSide == true { amount = RemiloWidgetCopy.eachSide(language, value: amount) }
        let weight = value.weight.map { "\(targetNumber($0.value)) \($0.unit)" }
        return [amount, weight, value.additionalText].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private static func targetNumber(_ value: Double) -> String {
        let parts = String(value).split(separator: "e")
        let coefficient = String(parts[0])
        guard parts.count == 2, let exponent = Int(parts[1]) else {
            return coefficient.hasSuffix(".0") ? String(coefficient.dropLast(2)) : coefficient
        }
        let mantissa = coefficient.split(separator: ".")
        let digits = mantissa.joined()
        let point = mantissa[0].count + exponent
        if point <= 0 { return "0." + String(repeating: "0", count: -point) + digits }
        if point >= digits.count { return digits + String(repeating: "0", count: point - digits.count) }
        return String(digits.prefix(point)) + "." + String(digits.dropFirst(point))
    }
}
