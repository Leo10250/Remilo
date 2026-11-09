import Foundation

extension RemiloIOSEngine {
    func queryRoutines() throws -> [[String: Any]] {
        try read().routines.values.filter { $0.state != "Trashed" }
            .sorted { ($0.latest?.title ?? "", $0.id) < ($1.latest?.title ?? "", $1.id) }
            .map(\.bridge)
    }

    func previewRoutine(_ draft: [String: Any]) throws -> [String: Any] {
        let state = try read()
        let zone = TimeZone.current
        let now = Date()
        let today = RemiloIOSRoutineAuthoring.localDate(now, in: zone)
        let owner = (draft["routineId"] as? String).flatMap { state.routines[$0] }
        let date = owner.map { max(today, $0.startsOn) } ?? (draft["startsOn"] as? String ?? today)
        var fields = draft
        if (fields["title"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            fields["title"] = "Remilo"
        }
        let version = try routineVersion(fields, date: date, revision: 0, previous: owner?.latest, state: state)
        return ["nextAlertMs": iosBridgeValue(try RemiloIOSRoutineAuthoring.nextPrompt(version, after: now, in: zone)),
                "today": today, "effectiveDate": date]
    }

    func getRoutineSession(_ id: String, date: String?) async throws -> [String: Any]? {
        try await reconcile()
        let state = try read()
        guard let plan = state.routines[id], plan.state != "Trashed" else { return nil }
        let zone = TimeZone.current
        let now = iosMillis(Date())
        let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone)
        let day = date ?? today
        _ = try RemiloIOSRoutineAuthoring.date(day, plusDays: 0)
        let occurrenceID = RemiloIOSSeries.occurrenceID(id, day)
        if let session = state.routineSessions[occurrenceID], let record = state.reminders[occurrenceID],
           session.routineID == id, session.date == day, record.routineID == id {
            return session.bridge(record: record, plan: plan, now: now, zone: zone)
        }
        guard canMaterializeRoutineDate(day, id: occurrenceID, plan: plan, state: state),
              let version = plan.version(on: day) else { return nil }
        return try IOSRoutineSession.upcoming(plan: plan, version: version, date: day, zone: zone, today: today)
    }

    func queryRoutineHistory(_ id: String, cursor: String?) async throws -> [String: Any] {
        try await reconcile()
        let state = try read()
        let now = iosMillis(Date())
        var items: [[String: Any]] = []
        if let plan = state.routines[id], plan.state != "Trashed" {
            items = state.routineSessions.values.filter { $0.routineID == id }.sorted { $0.date > $1.date }.compactMap { session in
                guard let record = state.reminders[session.occurrenceID], !record.deleted,
                      session.ended || record.completed || record.skipped == true else { return nil }
                return session.bridge(record: record, plan: plan, now: now, zone: .current)
            }
        }
        let offset = min(items.count, max(0, cursor.flatMap(Int.init) ?? 0))
        let end = min(items.count, offset + 50)
        return ["items": Array(items[offset..<end]), "total": items.count,
                "nextCursor": iosBridgeValue(end < items.count ? String(end) : nil)]
    }

    func mutateRoutinePlan(
        _ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64
    ) throws -> [String: Any] {
        let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: .current)
        if kind == "CreateRoutine" {
            let startsOn = try input.text("startsOn", maximum: 10)
            guard startsOn >= today else { throw input.invalid("startsOn") }
            let version = try routineVersion(input.values, date: startsOn, revision: 1, state: state)
            let id = UUID().uuidString.lowercased()
            let plan = IOSRoutinePlan(id: id, startsOn: startsOn, versions: [version])
            state.routines[id] = plan
            return ["status": "Applied", "routine": plan.bridge]
        }
        let id = try input.text("routineId", maximum: 200)
        guard var plan = state.routines[id] else { throw IOSInputFailure("NOT_FOUND") }
        let expected = try input.integer("expectedRevision", range: 0...Int64.max)
        guard plan.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
        let trashed = plan.state == "Trashed"
        if kind == "PurgeRoutine" || kind == "RestoreRoutine" {
            guard trashed else { throw IOSInputFailure("NOT_ELIGIBLE") }
        } else {
            guard !trashed else { throw IOSInputFailure("IN_TRASH") }
        }
        if kind == "PurgeRoutine" {
            let childIDs = state.routineSessions.values.filter { $0.routineID == id }.map(\.occurrenceID)
            for childID in childIDs {
                if var record = state.reminders.removeValue(forKey: childID) {
                    replaceRegistration(&record, target: nil, state: &state, now: now)
                }
                state.routineSessions.removeValue(forKey: childID)
            }
            state.routines.removeValue(forKey: id)
            var purged = state.purgedRoutines ?? []
            purged.insert(id)
            state.purgedRoutines = purged
            try redactReceipts(for: id, state: &state)
            for childID in childIDs { try redactReceipts(for: childID, state: &state) }
            return ["status": "Applied", "occurrenceId": id]
        }
        plan.revision += 1
        switch kind {
        case "EditRoutine":
            let version = try routineVersion(input.values, date: max(today, plan.startsOn),
                                             revision: plan.revision, previous: plan.latest, state: state)
            plan.versions.append(version)
        case "PauseRoutine":
            if plan.state != "Paused" { plan.pauses.append(IOSRoutinePause(fromMs: now)) }
            plan.state = "Paused"
        case "ResumeRoutine":
            if let last = plan.pauses.indices.last, plan.state == "Paused" { plan.pauses[last].untilMs = now }
            plan.state = "Active"
        case "TrashRoutine":
            plan.preTrashState = plan.state
            plan.state = "Trashed"
            plan.trashedAtMs = now
            plan.trashIntervals.append(IOSRoutinePause(fromMs: now))
        case "RestoreRoutine":
            plan.state = plan.preTrashState ?? "Active"
            plan.trashedAtMs = nil
            if let last = plan.trashIntervals.indices.last { plan.trashIntervals[last].untilMs = now }
        default:
            throw IOSInputFailure("UNSUPPORTED")
        }
        state.routines[id] = plan
        return ["status": "Applied", "routine": plan.bridge]
    }

    func mutateRoutineDay(
        _ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64
    ) throws -> [String: Any] {
        let id = try input.text("occurrenceId", maximum: 200)
        guard var record = state.reminders[id], var session = state.routineSessions[id],
              let plan = state.routines[session.routineID] else { throw IOSInputFailure("NOT_FOUND") }
        guard !record.deleted, plan.state != "Trashed" else { throw IOSInputFailure("IN_TRASH") }
        guard !session.steps.isEmpty else { throw IOSInputFailure("NOT_ELIGIBLE") }
        guard try input.text("date", maximum: 10) == session.date else { throw IOSInputFailure("STALE_DATE") }
        let close = try RemiloIOSRoutineAuthoring.closeAt(session.date, in: .current)
        let ended = session.ended || now >= close
        if kind == "CorrectRoutineExercise" {
            guard ended else { throw IOSInputFailure("DAY_NOT_ENDED") }
        } else {
            let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: .current)
            guard !ended, session.date == today else { throw IOSInputFailure(ended ? "DAY_ENDED" : "NOT_ELIGIBLE") }
            guard plan.state == "Active" else { throw IOSInputFailure("NOT_ELIGIBLE") }
        }
        let expected = try input.integer("expectedRevision", range: 0...Int64.max)
        guard session.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
        let wasComplete = record.completed
        let wasSkipped = record.skipped == true
        var stepID: String?
        var completed: Bool?
        switch kind {
        case "SetRoutineExercise", "CorrectRoutineExercise":
            guard !wasSkipped || ended else { throw IOSInputFailure("NOT_ELIGIBLE") }
            let step = try input.text("stepId", maximum: 200)
            guard session.steps.contains(where: { $0.id == step }) else { throw input.invalid("stepId") }
            guard input.values["completed"] != nil else { throw input.invalid("completed") }
            let done = try input.flag("completed", fallback: false)
            if done { session.done.insert(step) } else { session.done.remove(step) }
            stepID = step
            completed = done
        case "SkipRoutineDay":
            guard !wasComplete else { throw IOSInputFailure("NOT_ELIGIBLE") }
            record.skipped = true
        case "UndoSkipRoutineDay":
            record.skipped = false
        default:
            throw IOSInputFailure("UNSUPPORTED")
        }
        session.revision += 1
        session.ended = ended
        session.changes.append(IOSRoutineChange(
            id: try input.text("operationId", maximum: 200), kind: kind, stepID: stepID, completed: completed, atMs: now
        ))
        record.revision += 1
        record.completed = record.skipped != true && session.done.count == session.steps.count
        record.history.append(IOSHistory(kind: kind, atMs: now, targetMs: nil))
        if !wasComplete && record.completed { record.history.append(IOSHistory(kind: "Done", atMs: now, targetMs: nil)) }
        if !wasSkipped && record.skipped == true { record.history.append(IOSHistory(kind: "Skip", atMs: now, targetMs: nil)) }
        if wasComplete != record.completed || wasSkipped != (record.skipped == true) {
            let target = !ended && record.alarmAtMs > now ? record.alarmAtMs : nil
            replaceRegistration(&record, target: target, state: &state, now: now)
            if ended && record.active { record.deliveryState = "Expired" }
        }
        state.routineSessions[id] = session
        state.reminders[id] = record
        return ["status": "Applied", "routineSession": iosBridgeValue(session.bridge(record: record, plan: plan, now: now, zone: .current))]
    }

    func mutateRoutineDelivery(
        _ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64
    ) throws -> [String: Any] {
        let id = try input.text("occurrenceId", maximum: 200)
        let expected = try input.integer("expectedGeneration", range: 0...Int64.max)
        guard var record = state.reminders[id], let session = state.routineSessions[id],
              let plan = state.routines[session.routineID] else { throw IOSInputFailure("NOT_FOUND") }
        guard record.generation == expected else { throw IOSInputFailure("STALE_GENERATION") }
        let closes = try RemiloIOSRoutineAuthoring.closeAt(session.date, in: .current)
        guard record.active, plan.state == "Active", !session.steps.isEmpty, !session.ended, now < closes,
              (record.nextAlertMs ?? record.alarmAtMs) <= now, record.mode != "None" else {
            throw IOSInputFailure("NOT_ELIGIBLE")
        }
        replaceRegistration(&record, target: nil, state: &state, now: now)
        record.deliveryState = "Stopped"
        record.history.append(IOSHistory(kind: "Stop", atMs: now, targetMs: nil))
        state.reminders[id] = record
        return ["status": "Applied", "routineId": plan.id, "date": session.date]
    }

    private func routineVersion(
        _ fields: [String: Any], date: String, revision: Int, previous: IOSRoutineVersion? = nil, state: IOSDatabase
    ) throws -> IOSRoutineVersion {
        try RemiloIOSRoutineAuthoring.version(
            fields, effectiveDate: date, revision: revision, previous: previous,
            listExists: { state.lists[$0] != nil }, imageExists: imageExists
        )
    }

    func replenishRoutines(state: inout IOSDatabase, now: Int64) throws -> Bool {
        let zone = TimeZone.current
        let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone)
        var changed = false
        var historyBudget = 256
        for var plan in state.routines.values.sorted(by: { $0.id < $1.id }) {
            let existing = state.routineSessions.values.filter { $0.routineID == plan.id }
            var dates = Set(existing.filter { $0.date >= today && !$0.ended }.map(\.date))
            if plan.state == "Active" {
                let from = max(today, plan.startsOn)
                var future = 0
                for offset in 0...14 {
                    let date = try RemiloIOSRoutineAuthoring.date(from, plusDays: offset)
                    guard let version = plan.version(on: date),
                          try !RemiloIOSRoutineAuthoring.day(date, in: version).exercises.isEmpty else { continue }
                    let id = RemiloIOSSeries.occurrenceID(plan.id, date)
                    guard state.routineSessions[id]?.routineID == plan.id
                        || canMaterializeRoutineDate(date, id: id, plan: plan, state: state) else { continue }
                    dates.insert(date)
                    if date > today { future += 1 }
                    if future == 2 { break }
                }
            }
            for var session in existing where !session.ended
                && (session.date < today || (session.started == true && session.date != today)) {
                if session.started == false,
                   let record = state.reminders[session.occurrenceID],
                   try routineWasUnavailable(plan, date: session.date, record: record, zone: zone) {
                    var cancelled = record
                    replaceRegistration(&cancelled, target: nil, state: &state, now: now)
                    state.routineSessions.removeValue(forKey: session.occurrenceID)
                    state.reminders.removeValue(forKey: session.occurrenceID)
                    changed = true
                    continue
                }
                session.ended = true
                session.started = true
                session.revision += 1
                state.routineSessions[session.occurrenceID] = session
                if var record = state.reminders[session.occurrenceID], record.active {
                    replaceRegistration(&record, target: nil, state: &state, now: now)
                    record.deliveryState = "Expired"
                    state.reminders[record.id] = record
                }
                changed = true
            }
            for date in dates.sorted() {
                if try reconcileRoutineDate(date, plan: plan, state: &state, now: now, zone: zone) { changed = true }
            }
            let cursor = plan.historyThrough
            try catchUpRoutineHistory(&plan, before: today, zone: zone, state: &state, budget: &historyBudget)
            if plan.historyThrough != cursor {
                state.routines[plan.id] = plan
                changed = true
            }
        }
        return changed
    }

    private func catchUpRoutineHistory(
        _ plan: inout IOSRoutinePlan, before today: String, zone: TimeZone, state: inout IOSDatabase, budget: inout Int
    ) throws {
        guard plan.startsOn < today else { return }
        var date = try plan.historyThrough.map { try RemiloIOSRoutineAuthoring.date($0, plusDays: 1) } ?? plan.startsOn
        date = max(date, plan.startsOn)
        while date < today && budget > 0 {
            budget -= 1
            plan.historyThrough = date
            let id = RemiloIOSSeries.occurrenceID(plan.id, date)
            if canMaterializeRoutineDate(date, id: id, plan: plan, state: state),
               let version = plan.version(on: date) {
                let steps = try RemiloIOSRoutineAuthoring.day(date, in: version).exercises
                if !steps.isEmpty {
                    var record = try routineReminder(id: id, planID: plan.id, date: date, version: version, zone: zone)
                    if try !routineWasUnavailable(plan, date: date, record: record, zone: zone) {
                        record.deliveryState = version.mode == "None" ? "NoAlert" : "Expired"
                        state.reminders[id] = record
                        state.routineSessions[id] = IOSRoutineSession(
                            routineID: plan.id, occurrenceID: id, date: date, versionRevision: version.revision,
                            steps: steps, ended: true, started: true
                        )
                    }
                }
            }
            date = try RemiloIOSRoutineAuthoring.date(date, plusDays: 1)
        }
    }

    private func routineWasUnavailable(
        _ plan: IOSRoutinePlan, date: String, record: IOSReminder, zone: TimeZone
    ) throws -> Bool {
        if plan.pauses.contains(where: { $0.contains(record.alarmAtMs) }) { return true }
        let start = try RemiloIOSRoutineAuthoring.time(date, minutes: 0, in: zone)
        let end = try RemiloIOSRoutineAuthoring.closeAt(date, in: zone)
        return plan.trashIntervals.contains { interval in
            interval.fromMs <= start && (interval.untilMs.map { $0 >= end } ?? true)
        }
    }

    private func canMaterializeRoutineDate(_ date: String, id: String, plan: IOSRoutinePlan, state: IOSDatabase) -> Bool {
        state.routineSessions[id] == nil && state.reminders[id] == nil && !state.isPurgedOccurrence(id)
            && !plan.excludesDate(date)
    }

    private func routineReminder(
        id: String, planID: String, date: String, version: IOSRoutineVersion, zone: TimeZone
    ) throws -> IOSReminder {
        let start = try RemiloIOSRoutineAuthoring.time(date, minutes: 0, in: zone)
        let close = try RemiloIOSRoutineAuthoring.closeAt(date, in: zone)
        let prompt = try RemiloIOSRoutineAuthoring.time(date, minutes: version.minutes, in: zone)
        return IOSReminder(
            id: id, title: version.title, notes: version.notes, listID: version.listID, eventStartMs: start,
            eventEndMs: close, dueAtMs: prompt, alarmAtMs: prompt, zoneID: zone.identifier, mode: version.mode,
            allDay: true, dueLinked: false, alarmLinked: false, sound: version.sound, routineID: planID, nominalSlot: date,
            vibration: version.vibration
        )
    }

    private func reconcileRoutineDate(
        _ date: String, plan: IOSRoutinePlan, state: inout IOSDatabase, now: Int64, zone: TimeZone
    ) throws -> Bool {
        let id = RemiloIOSSeries.occurrenceID(plan.id, date)
        let existing = state.routineSessions[id]
        let isToday = date == RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: zone)
        guard existing?.ended != true, let version = plan.version(on: date) else { return false }
        let steps = try RemiloIOSRoutineAuthoring.day(date, in: version).exercises
        let suppressed = plan.state != "Active" || steps.isEmpty
        if existing == nil {
            guard !suppressed, canMaterializeRoutineDate(date, id: id, plan: plan, state: state) else { return false }
            var record = try routineReminder(id: id, planID: plan.id, date: date, version: version, zone: zone)
            if record.alarmAtMs > now {
                replaceRegistration(&record, target: record.alarmAtMs, state: &state, now: now)
            }
            state.reminders[id] = record
            state.routineSessions[id] = IOSRoutineSession(
                routineID: plan.id, occurrenceID: id, date: date, versionRevision: version.revision, steps: steps,
                started: isToday
            )
            return true
        }
        guard var session = existing, var record = state.reminders[id], session.routineID == plan.id,
              session.date == date, record.routineID == plan.id else { return false }
        let start = try RemiloIOSRoutineAuthoring.time(date, minutes: 0, in: zone)
        let close = try RemiloIOSRoutineAuthoring.closeAt(date, in: zone)
        let prompt = try RemiloIOSRoutineAuthoring.time(date, minutes: version.minutes, in: zone)
        let edited = version.revision != session.versionRevision
        let moved = record.zoneID != zone.identifier
        let needsRegistration = record.active && record.mode != "None" && record.registration == nil
            && record.deliveryState == "Pending" && (record.nextAlertMs ?? prompt) > now
        let justStarted = isToday && !suppressed && session.started == false
        let shouldPause = suppressed && !record.deleted
        if !edited && !moved && !needsRegistration && !justStarted
            && (shouldPause ? record.deliveryState == "Paused" : record.deliveryState != "Paused") {
            return false
        }
        if justStarted { session.started = true }
        let wasPaused = record.deliveryState == "Paused"
        let oldMode = record.mode
        let oldPrompt = record.alarmAtMs
        let oldSound = record.sound
        let hadLivePrompt = record.registration != nil && (record.nextAlertMs ?? oldPrompt) <= now
        let hadElapsedPrompt = oldMode != "None" && oldPrompt <= now
        let hadProgress = record.completed
        if edited {
            session.versionRevision = version.revision
            session.steps = steps
            session.done.formIntersection(steps.map(\.id))
            session.revision += 1
            record.revision += 1
            record.completed = !steps.isEmpty && record.skipped != true && session.done.count == steps.count
            record.title = version.title
            record.notes = version.notes
            record.listID = version.listID
            record.sound = version.sound
            record.vibration = version.vibration
            record.mode = version.mode
        }
        record.eventStartMs = start
        record.eventEndMs = close
        record.dueAtMs = prompt
        record.alarmAtMs = prompt
        record.zoneID = zone.identifier
        if shouldPause {
            if !wasPaused || record.registration != nil {
                replaceRegistration(&record, target: nil, state: &state, now: now)
                record.deliveryState = "Paused"
            }
        } else if !record.active || record.mode == "None" {
            if record.registration != nil || oldMode != record.mode || hadProgress != record.completed {
                replaceRegistration(&record, target: nil, state: &state, now: now)
            }
        } else if wasPaused || needsRegistration || oldMode != record.mode || oldPrompt != prompt || oldSound != record.sound || moved || hadProgress {
            let desired = needsRegistration && !moved && !edited ? (record.nextAlertMs ?? prompt) : prompt
            let target = (!needsRegistration && hadElapsedPrompt) || hadLivePrompt || desired >= close ? nil : desired
            replaceRegistration(&record, target: target, state: &state, now: now)
        }
        state.reminders[id] = record
        state.routineSessions[id] = session
        return true
    }
}
