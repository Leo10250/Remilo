import Foundation

extension RemiloIOSEngine {
    func querySeries() throws -> [[String: Any]] {
        let state = try read()
        let now = iosMillis(Date())
        return try state.series.values.filter { $0.state != "Archived" }
            .sorted { ($0.createdAtMs, $0.id) < ($1.createdAtMs, $1.id) }
            .map { try RemiloIOSSeries.view($0, in: state, now: now) }
    }

    func queryRepeatFamilies() throws -> [[String: Any]] {
        try RemiloIOSSeries.families(read(), now: iosMillis(Date()))
    }

    func getSeries(_ id: String) throws -> [String: Any]? {
        let state = try read()
        guard let segment = state.series[id] else { return nil }
        return try RemiloIOSSeries.view(segment, in: state, now: iosMillis(Date()))
    }

    func getSeriesDraft(_ id: String, nominal: String) throws -> [String: Any] {
        let state = try read()
        guard let segment = state.series[id] else { throw IOSInputFailure("NOT_FOUND") }
        guard let index = try RemiloIOSRecurrence.index(nominal, in: segment.rule) else {
            throw IOSInputFailure("INVALID_INPUT", field: "nominalSlot")
        }
        let slot = try RemiloIOSRecurrence.resolve(segment.rule, nominal: nominal, deviceZone: .current, index: index)
        let occurrence = RemiloIOSSeries.makeOccurrence(segment, slot: slot)
        return ["template": RemiloIOSProjection.draftFields(occurrence, state: state),
                "remainingCount": iosBridgeValue(segment.rule.count.map { $0 - index + 1 })]
    }

    func mutateSeries(_ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64,
                      calendarBounds: (anchor: String, endExclusive: String?)? = nil) throws -> IOSSeriesSegment {
        let old: IOSSeriesSegment?
        if kind == "CreateSeries" {
            old = nil
        } else {
            let id = try input.text("segmentId", maximum: 200)
            guard let segment = state.series[id] else { throw IOSInputFailure("NOT_FOUND") }
            let expected = try input.integer("expectedRevision", range: 0...Int64.max)
            guard segment.state != "Archived", segment.revision == expected else { throw IOSInputFailure("STALE_REVISION") }
            old = segment
        }

        if let old, kind == "PauseSeries" || kind == "ResumeSeries" {
            let nextState = kind == "PauseSeries" ? "Paused" : "Active"
            for (id, var segment) in state.series where segment.familyID == old.familyID && segment.state != "Archived" {
                if segment.state == nextState { continue }
                segment.state = nextState
                segment.revision += 1
                state.series[id] = segment
                if nextState == "Paused" { fenceSeries(id, from: nil, paused: true, state: &state, now: now) }
            }
            return state.series[old.id] ?? old
        }

        guard let spec = input.values["recurrence"] as? [String: Any] else { throw input.invalid("recurrence") }
        if input.values["calendarDisposition"] as? String == "Managed" {
            throw IOSInputFailure("UNSUPPORTED", field: "calendarDisposition")
        }
        var previous = old?.template
        var splitAt: String?
        if let old, kind == "EditFollowing" {
            let nominal = try input.text("nominalSlot", maximum: 24)
            guard let index = try RemiloIOSRecurrence.index(nominal, in: old.rule) else { throw input.invalid("nominalSlot") }
            let slot = try RemiloIOSRecurrence.resolve(old.rule, nominal: nominal, deviceZone: .current, index: index)
            splitAt = slot.nominalSlot
            previous = RemiloIOSSeries.makeOccurrence(old, slot: slot)
        }

        let id = UUID().uuidString.lowercased()
        var template = try RemiloIOSProjection.draft(input, id: id, previous: previous, state: state, now: now)
        template.id = id
        template.segmentID = nil
        template.nominalSlot = nil
        let rule = try RemiloIOSSeries.rule(for: template, spec: spec, calendarBounds: calendarBounds)
        if calendarBounds == nil,
           try RemiloIOSRecurrence.future(rule, afterMs: now, deviceZone: .current, mode: template.mode, limit: 1).isEmpty {
            throw input.invalid("recurrence")
        }
        if let old {
            for (segmentID, var segment) in state.series where segment.familyID == old.familyID && segment.state != "Archived" {
                if let splitAt {
                    if segmentID == old.id {
                        segment.rule.endExclusive = splitAt
                    } else if segment.rule.anchor >= splitAt {
                        segment.state = "Archived"
                    } else {
                        continue
                    }
                } else {
                    segment.state = "Archived"
                }
                segment.revision += 1
                state.series[segmentID] = segment
                fenceSeries(segmentID, from: segmentID == old.id ? splitAt : nil, paused: false, state: &state, now: now)
            }
        }
        let segment = IOSSeriesSegment(
            id: id, familyID: old?.familyID ?? id, template: template, rule: rule,
            createdAtMs: now, state: old?.state ?? "Active"
        )
        state.series[id] = segment
        if calendarBounds != nil {
            let hasOverride = try installCalendarExceptions(input, segment: segment, state: &state, now: now)
            if !hasOverride, try RemiloIOSSeries.eligibleFuture(segment, in: state, now: now, limit: 1).isEmpty {
                throw input.invalid("recurrence")
            }
        }
        return segment
    }

    private func installCalendarExceptions(
        _ input: IOSInput, segment: IOSSeriesSegment, state: inout IOSDatabase, now: Int64
    ) throws -> Bool {
        guard let raw = input.values["nativeCalendarExceptions"] else { return false }
        guard let rows = raw as? [[String: Any]], rows.count <= 500 else { throw input.invalid("nativeCalendarExceptions") }
        let identityFields: Set<String> = ["kind", "nominalSlot"]
        let overrideFields = identityFields.union([
            "title", "notes", "eventStartMs", "eventEndMs", "allDay", "zoneId", "dueAtMs", "alarmAtMs", "alarmLinked", "alertEligible",
        ])
        var hasUpcomingOverride = false
        for values in rows {
            let entry = IOSInput(values: values)
            let kind = try entry.choice("kind", fallback: "", from: ["Skip", "Override"])
            let nominal = try entry.text("nominalSlot", maximum: 24)
            let expectedFields = kind == "Skip" ? identityFields : overrideFields
            guard Set(values.keys) == expectedFields, try RemiloIOSRecurrence.canonicalNominal(nominal) == nominal,
                  let index = try RemiloIOSRecurrence.index(nominal, in: segment.rule) else {
                throw input.invalid("nativeCalendarExceptions")
            }
            let slot = try RemiloIOSRecurrence.resolve(segment.rule, nominal: nominal, deviceZone: .current, index: index)
            var record = RemiloIOSSeries.makeOccurrence(segment, slot: slot)
            guard state.reminders[record.id] == nil, !state.isPurgedOccurrence(record.id) else {
                throw input.invalid("nativeCalendarExceptions")
            }
            record.independent = true
            record.createdAtMs = now
            if kind == "Skip" {
                record.skipped = true
                record.deliveryState = "Skipped"
                record.history.append(IOSHistory(kind: "Skip", atMs: now, targetMs: nil))
            } else {
                let alertEligible = try entry.flag("alertEligible", fallback: false)
                record = try RemiloIOSProjection.draft(entry, id: record.id, previous: record, state: state, now: now)
                let epoch = RemiloIOSProjection.epoch
                guard try record.eventStartMs == entry.integer("eventStartMs", range: epoch),
                      try record.eventEndMs == entry.integer("eventEndMs", range: epoch),
                      record.dueAtMs == (record.allDay ? record.eventEndMs : record.eventStartMs) else {
                    throw input.invalid("nativeCalendarExceptions")
                }
                record.dueLinked = true
                if record.mode == "None" {
                    hasUpcomingOverride = hasUpcomingOverride || record.eventEndMs > now
                } else if alertEligible {
                    guard record.alarmAtMs > now else { throw IOSInputFailure("ALERT_EXPIRED") }
                    record.deferSeriesOverride(target: record.alarmAtMs)
                    hasUpcomingOverride = true
                } else {
                    guard record.alarmAtMs <= now else { throw entry.invalid("alertEligible") }
                    record.deliveryState = "Missed"
                }
                record.history.append(IOSHistory(kind: "Create", atMs: now, targetMs: nil))
            }
            state.reminders[record.id] = record
        }
        return hasUpcomingOverride
    }

    private func fenceSeries(_ segmentID: String, from boundary: String?, paused: Bool, state: inout IOSDatabase, now: Int64) {
        for (id, var record) in state.reminders where record.segmentID == segmentID && record.active
            && record.independent != true && record.agendaAtMs > now {
            if let boundary, let nominal = record.nominalSlot, nominal < boundary { continue }
            if !paused {
                record.skipped = true
                record.revision += 1
            }
            replaceRegistration(&record, target: nil, state: &state, now: now)
            record.deliveryState = paused ? "Paused" : "Replaced"
            if paused, record.mode != "None" { record.nextAlertMs = record.alarmAtMs }
            state.reminders[id] = record
        }
    }

    func reconcileCalendarSeriesSchedule(_ snapshot: IOSCalendarSeriesTextSnapshot, change: IOSCalendarSeriesScheduleChange,
                                         state: inout IOSDatabase, now: Int64) throws -> IOSCalendarSeriesScheduleResult {
        typealias Recurrence = RemiloIOSRecurrence
        guard var segment = state.series[snapshot.segmentID], segment.familyID == snapshot.familyID,
              let zoneID = change.rule.zoneID, let zone = TimeZone(identifier: zoneID),
              (1...200).contains(change.title.utf16.count), change.notes.utf16.count <= 10_000 else { return .needsReview }
        let old = segment.rule
        let new = change.rule
        let dueOffset = segment.template.dueLinked && old.allDay != new.allDay
            ? (new.allDay ? Int64(86_400_000) : 0) : old.dueOffsetMs
        var alarmOffset = old.alarmOffsetMs
        if segment.template.alarmLinked, old.allDay != new.allDay {
            alarmOffset = 0
            if new.allDay, let oldZone = TimeZone(identifier: segment.template.zoneID) {
                let previous = segment.template.alarmAtMs
                let day = String(RemiloIOSSeries.civil(previous, zone: oldZone).prefix(10))
                alarmOffset = try Recurrence.civilOffset(previous, fromNominal: day + "T00:00", zone: oldZone)
            }
        }
        let rule = try new.replacingDeliveryOffsets(due: dueOffset, alarm: alarmOffset)
        let anchor = try Recurrence.resolve(rule, nominal: rule.anchor, deviceZone: zone)
        guard anchor.eventStartMs == change.eventStartMs, anchor.eventEndMs == change.eventEndMs else {
            return .needsReview
        }

        func replacementIsFuture(_ nominal: String) throws -> Bool {
            let shifted = String(nominal.prefix(10)) + String(rule.anchor.dropFirst(10))
            guard let index = try Recurrence.index(shifted, in: rule) else { return false }
            let slot = try Recurrence.resolve(rule, nominal: shifted, deviceZone: zone, index: index)
            return slot.eventEndMs > now || RemiloIOSSeries.deliveryTime(slot, mode: segment.template.mode) > now
        }
        if segment.template.mode != "None",
           let first = try Recurrence.future(rule, afterMs: now, deviceZone: zone, mode: "None", limit: 1).first,
           first.alarmAtMs <= now {
            let id = RemiloIOSSeries.occurrenceID(segment.id, first.nominalSlot)
            let saved = state.reminders[id]
            let existingTarget = try Recurrence.index(first.nominalSlot, in: old).map { index in
                try Recurrence.resolve(old, nominal: first.nominalSlot, deviceZone: zone, index: index).alarmAtMs
            }
            let preserved = state.isPurgedOccurrence(id) || saved.map {
                (!$0.active && $0.deliveryState != "Replaced") || ($0.adjustment != nil && ($0.nextAlertMs ?? 0) > now)
            } == true
            guard preserved || existingTarget == first.alarmAtMs else { return .elapsedAlert }
        }
        guard try !Recurrence.future(rule, afterMs: now, deviceZone: zone, mode: segment.template.mode, limit: 1).isEmpty else {
            return .needsReview
        }
        for exclusion in (state.portableExclusions ?? [:]).values {
            guard state.series[exclusion.segmentID]?.familyID == snapshot.familyID,
                  try replacementIsFuture(exclusion.nominalSlot) else { continue }
            guard exclusion.segmentID == segment.id, try Recurrence.index(exclusion.nominalSlot, in: rule) != nil else {
                return .needsReview
            }
        }
        for (id, var record) in state.reminders {
            guard let recordSegment = record.segmentID, state.series[recordSegment]?.familyID == snapshot.familyID,
                  let nominal = record.nominalSlot else { continue }
            let retired = record.deliveryState == "Replaced" && record.skipped == true
            let held = record.active && record.adjustment != nil && (record.nextAlertMs ?? 0) > now
            let authored = record.independent == true && (record.calendarInstanceID != nil ||
                record.history.contains { $0.kind == "Edit" || $0.kind == "Create" })
            let terminal = !record.active && !retired
            if record.eventEndMs <= now && record.agendaAtMs <= now {
                if let registration = record.registration, registration.mode == "Alarm",
                   try replacementIsFuture(nominal), try RemiloIOSDelivery.isAlarmAlerting(registration.systemID) { return .deferred }
                guard terminal, try replacementIsFuture(nominal) else { continue }
            }
            if recordSegment != segment.id {
                if terminal || held || authored { return .needsReview }
                continue
            }
            let index = try Recurrence.index(nominal, in: rule)
            if terminal || authored {
                // The original nominal slot is the only safe identity for
                // authored exceptions and local completion/Skip decisions.
                guard index != nil else { return .needsReview }
                continue
            }
            if let registration = record.registration, registration.mode == "Alarm",
               try RemiloIOSDelivery.isAlarmAlerting(registration.systemID) { return .deferred }
            guard let index else {
                if held { return .needsReview }
                if !retired {
                    record.skipped = true
                    record.revision += 1
                    replaceRegistration(&record, target: nil, state: &state, now: now)
                    record.deliveryState = "Replaced"
                    state.reminders[id] = record
                }
                continue
            }
            let slot = try Recurrence.resolve(rule, nominal: nominal, deviceZone: zone, index: index)
            let priorAlarm = record.alarmAtMs
            record.eventStartMs = slot.eventStartMs
            record.eventEndMs = slot.eventEndMs
            record.allDay = rule.allDay
            record.zoneID = slot.zoneID
            if record.dueLinked { record.dueAtMs = slot.dueAtMs }
            if record.alarmLinked { record.alarmAtMs = slot.alarmAtMs }
            if !held, record.mode != "None", priorAlarm > now, record.alarmAtMs <= now { return .elapsedAlert }
            if record.title == snapshot.title { record.title = change.title }
            if record.notes == snapshot.notes { record.notes = change.notes }
            record.revision += 1
            if retired {
                record.skipped = false
                record.deliveryState = record.mode == "None" ? "NoAlert" : "Pending"
            }
            if !held, record.mode != "None", record.alarmAtMs != priorAlarm {
                record.adjustment = nil
                replaceRegistration(&record, target: record.alarmAtMs, state: &state, now: now)
            }
            state.reminders[id] = record
        }
        segment.rule = rule
        segment.template = RemiloIOSSeries.applying(anchor, to: segment.template)
        segment.template.allDay = rule.allDay
        segment.template.title = change.title
        segment.template.notes = change.notes
        segment.materializedThrough = nil
        segment.revision += 1
        state.series[segment.id] = segment
        state.series[snapshot.familyID]?.calendarBaselineRule = new
        _ = try replenishSeries(state: &state, now: now)
        return .applied
    }

    func reconcileCalendarSeriesInstance(_ snapshot: IOSCalendarSeriesTextSnapshot, change: IOSCalendarSeriesInstanceChange,
                                         state: inout IOSDatabase, now: Int64) throws -> IOSCalendarSeriesInstanceResult {
        typealias Recurrence = RemiloIOSRecurrence
        guard let segment = state.series[snapshot.segmentID], segment.familyID == snapshot.familyID,
              let index = try Recurrence.index(change.nominalSlot, in: segment.rule),
              let zone = TimeZone(identifier: change.zoneID) else { return .needsReview }
        let familySegments = Set(state.series.values.filter { $0.familyID == snapshot.familyID }.map(\.id))
        if (state.portableExclusions ?? [:]).values.contains(where: {
            $0.nominalSlot == change.nominalSlot && familySegments.contains($0.segmentID)
        }) { return .ignored }
        let id = RemiloIOSSeries.occurrenceID(segment.id, change.nominalSlot)
        if state.isPurgedOccurrence(id) { return .ignored }
        for peer in state.reminders.values where peer.id != id && peer.nominalSlot == change.nominalSlot {
            guard let segmentID = peer.segmentID, familySegments.contains(segmentID) else { continue }
            if !peer.active && peer.deliveryState != "Replaced" { return .ignored }
            if peer.active && peer.independent == true { return .needsReview }
        }
        let existing = state.reminders[id]
        if existing?.active == false { return .ignored }
        if existing == nil && change.eventEndMs <= now { return .ignored }
        let slot = try Recurrence.resolve(segment.rule, nominal: change.nominalSlot, deviceZone: zone, index: index)
        let old = existing ?? RemiloIOSSeries.makeOccurrence(segment, slot: slot)
        let acknowledgedEdit = old.calendarInstanceID == change.eventID &&
            old.calendarInstanceEditBaseline == Self.calendarInstanceFields(old)
        guard old.calendarInstanceID.map({ $0 == change.eventID }) ?? true,
              acknowledgedEdit || !old.history.contains(where: { $0.kind == "Edit" }),
              !old.history.contains(where: { $0.kind == "Reopen" || $0.kind == "UndoDelete" }),
              change.previouslyImported || !old.history.contains(where: { $0.kind == "Create" }) else { return .needsReview }
        let result = try saveCalendarInstance(change, old: old, isNew: existing == nil, state: &state, now: now)
        if result == .applied, acknowledgedEdit, let saved = state.reminders[id] {
            state.reminders[id]?.calendarInstanceEditBaseline = Self.calendarInstanceFields(saved)
        }
        return result
    }

    func reconcileCalendarInstanceConfirmation(_ confirmation: IOSCalendarSeriesInstanceConfirmation, record: IOSReminder,
                                               state: inout IOSDatabase, now: Int64) throws -> IOSCalendarSeriesInstanceResult {
        let desired = confirmation.edit.desired
        let verified = confirmation.fields
        let current = IOSCalendarInboundChange.Schedule(record)
        let authoredSchedule = IOSCalendarInboundChange.Schedule(desired)
        let verifiedSchedule = IOSCalendarInboundChange.Schedule(verified)
        // An incoming change may conflict with an edit made while the write
        // was in flight. Do not treat that remote value as a common baseline.
        func conflicts<T: Equatable>(_ local: T, _ authored: T, _ remote: T) -> Bool {
            local != authored && remote != authored && local != remote
        }
        guard !conflicts(record.title, desired.title, verified.title),
              !conflicts(record.notes, desired.notes, verified.notes),
              !conflicts(current, authoredSchedule, verifiedSchedule) else { return .needsReview }
        let schedule = current == authoredSchedule ? verifiedSchedule : current
        let title = record.title == desired.title ? verified.title : record.title
        let notes = record.notes == desired.notes ? verified.notes : record.notes
        if title != record.title || notes != record.notes || schedule != current {
            let change = IOSCalendarSeriesInstanceChange(eventID: confirmation.eventID, nominalSlot: confirmation.edit.nominalSlot,
                previouslyImported: true, title: title, notes: notes, eventStartMs: schedule.eventStartMs,
                eventEndMs: schedule.eventEndMs, allDay: schedule.allDay, zoneID: schedule.zoneID)
            let result = try saveCalendarInstance(change, old: record, isNew: false, state: &state, now: now)
            guard result == .applied else { return result }
        } else {
            state.reminders[record.id]?.calendarInstanceID = confirmation.eventID
        }
        state.reminders[record.id]?.calendarInstanceEditBaseline = verified
        return .applied
    }

    private func saveCalendarInstance(_ change: IOSCalendarSeriesInstanceChange, old: IOSReminder, isNew: Bool,
                                      state: inout IOSDatabase, now: Int64) throws -> IOSCalendarSeriesInstanceResult {
        typealias Recurrence = RemiloIOSRecurrence
        guard let zone = TimeZone(identifier: change.zoneID) else { return .needsReview }
        let schedule = IOSCalendarInboundChange.Schedule(eventStartMs: change.eventStartMs, eventEndMs: change.eventEndMs,
                                                          allDay: change.allDay, zoneID: change.zoneID)
        if schedule != .init(old), let registration = old.registration, registration.mode == "Alarm",
           try RemiloIOSDelivery.isAlarmAlerting(registration.systemID) { return .deferred }
        let linkedAlarm: Int64?
        if old.alarmLinked, schedule != .init(old), let oldZone = TimeZone(identifier: old.zoneID) {
            let offset: Int64
            if old.allDay == change.allDay {
                offset = try Recurrence.civilOffset(old.alarmAtMs, fromNominal: RemiloIOSSeries.civil(old.eventStartMs, zone: oldZone), zone: oldZone)
            } else if change.allDay {
                let day = String(RemiloIOSSeries.civil(old.alarmAtMs, zone: oldZone).prefix(10))
                offset = try Recurrence.civilOffset(old.alarmAtMs, fromNominal: day + "T00:00", zone: oldZone)
            } else { offset = 0 }
            let linked = try Recurrence.resolveOffset(RemiloIOSSeries.civil(change.eventStartMs, zone: zone), by: offset, in: zone)
            guard RemiloIOSProjection.epoch.contains(linked) else { return .needsReview }
            linkedAlarm = linked
        } else { linkedAlarm = nil }
        let held = old.adjustment != nil ? old.nextAlertMs : nil
        let inbound = IOSCalendarInboundChange(title: change.title, notes: change.notes, schedule: schedule)
        let projected: IOSCalendarInboundProjection
        do {
            projected = try IOSCalendarInboundProjection(inbound, from: old, state: state, now: now,
                                                         linkedAlarmOverride: linkedAlarm, retainedOverride: held)
        } catch let failure as IOSInputFailure {
            return failure.code == "ELAPSED_ALERT" ? .elapsedAlert : .needsReview
        }
        if isNew, old.mode != "None", projected.record.alarmAtMs <= now { return .elapsedAlert }
        var record = projected.record
        record.independent = true
        record.calendarInstanceID = change.eventID
        if isNew { record.createdAtMs = now }
        else { record.revision += 1 }
        if projected.replacesRegistration {
            record.adjustment = nil
            replaceRegistration(&record, target: nil, state: &state, now: now)
            record.deferSeriesOverride(target: record.alarmAtMs)
        } else if record.mode != "None", projected.retainedAlertMs == nil, record.alarmAtMs > now {
            if record.registration == nil { record.deferSeriesOverride(target: record.alarmAtMs) }
            else { record.deferredSeriesOverride = true }
        }
        state.reminders[record.id] = record
        _ = try replenishSeries(state: &state, now: now)
        return .applied
    }

    func replenishSeries(state: inout IOSDatabase, now: Int64) throws -> Bool {
        var changed = false
        let segments = state.series.values.filter { $0.state == "Active" }.sorted { $0.id < $1.id }
        for var segment in segments {
            let zone = segment.rule.zoneID.flatMap(TimeZone.init(identifier:)) ?? .current
            let normalRows = state.reminders.values.filter { $0.segmentID == segment.id && $0.active && $0.independent != true }
            for var record in normalRows where record.deliveryState == "Paused" && record.agendaAtMs <= now {
                record.nextAlertMs = nil
                record.deliveryState = record.mode == "None" ? "NoAlert" : "Missed"
                state.reminders[record.id] = record
                changed = true
            }
            for var record in normalRows where record.agendaAtMs > now && record.zoneID != zone.identifier {
                guard let nominal = record.nominalSlot else { continue }
                let slot = try RemiloIOSRecurrence.resolve(segment.rule, nominal: nominal, deviceZone: .current)
                record = RemiloIOSSeries.applying(slot, to: record)
                // Fence the old zone now. The future window below decides whether to register the moved slot.
                replaceRegistration(&record, target: nil, state: &state, now: now)
                if record.mode != "None", record.alarmAtMs > now {
                    record.deliveryState = "Pending"
                    record.nextAlertMs = record.alarmAtMs
                }
                state.reminders[record.id] = record
                changed = true
            }
            let (latestElapsed, hasMoreElapsed) = try recoverElapsed(segment, zone: zone, state: &state, now: now)
            if latestElapsed != segment.materializedThrough {
                segment.materializedThrough = latestElapsed
                changed = true
            }

            let next = try RemiloIOSSeries.eligibleFuture(segment, in: state, now: now, limit: 2)
            let wanted = Set(next.map { RemiloIOSSeries.occurrenceID(segment.id, $0.nominalSlot) })
            for (id, var record) in state.reminders where record.segmentID == segment.id && record.active
                && record.independent != true && record.registration != nil && record.agendaAtMs > now && !wanted.contains(id) {
                replaceRegistration(&record, target: nil, state: &state, now: now)
                record.deliveryState = "Pending"
                record.nextAlertMs = record.alarmAtMs
                state.reminders[id] = record
                changed = true
            }
            for slot in next {
                let id = RemiloIOSSeries.occurrenceID(segment.id, slot.nominalSlot)
                let previous = state.reminders[id]
                var record = previous ?? RemiloIOSSeries.makeOccurrence(segment, slot: slot)
                if previous == nil || (record.mode != "None" && record.registration == nil) || record.deliveryState == "Paused" {
                    replaceRegistration(&record, target: slot.alarmAtMs, state: &state, now: now)
                    state.reminders[id] = record
                    changed = true
                }
                if !hasMoreElapsed, segment.materializedThrough.map({ $0 < slot.nominalSlot }) ?? true {
                    segment.materializedThrough = slot.nominalSlot
                    changed = true
                }
            }
            state.series[segment.id] = segment
        }
        let changedOverrides = replenishSeriesOverrides(state: &state, now: now)
        return changed || changedOverrides
    }

    private func replenishSeriesOverrides(state: inout IOSDatabase, now: Int64) -> Bool {
        // Keep a separate bounded window for authored independent exceptions.
        let limit = 8
        let overrides = state.reminders.values.filter { $0.active && $0.deferredSeriesOverride == true }
        let future = overrides.compactMap { record -> (id: String, target: Int64)? in
            guard let target = record.nextAlertMs, target > now else { return nil }
            return (record.id, target)
        }.sorted { ($0.target, $0.id) < ($1.target, $1.id) }

        // Keep nearly due registrations intact while earlier newly reviewed work
        // can take a place reserved for a more distant exception.
        var wanted = Set(future.filter { item in
            item.target <= now + 60_000 && state.reminders[item.id]?.registration != nil
        }.map { $0.id })
        for item in future where wanted.count < limit {
            wanted.insert(item.id)
        }
        var changed = false
        for var record in overrides {
            guard let target = record.nextAlertMs else { continue }
            if target <= now {
                guard record.registration == nil else { continue }
                record.nextAlertMs = nil
                record.deliveryState = "Missed"
            } else if wanted.contains(record.id) {
                guard record.registration == nil else { continue }
                replaceRegistration(&record, target: target, state: &state, now: now)
            } else {
                guard record.registration != nil else { continue }
                replaceRegistration(&record, target: nil, state: &state, now: now)
                record.deferSeriesOverride(target: target)
            }
            state.reminders[record.id] = record
            changed = true
        }
        return changed
    }

    private func recoverElapsed(
        _ segment: IOSSeriesSegment, zone: TimeZone, state: inout IOSDatabase, now: Int64
    ) throws -> (cursor: String?, hasMore: Bool) {
        guard let cursor = segment.materializedThrough else { return (nil, false) }
        let offset = segment.template.mode == "None" ? 0 : segment.rule.alarmOffsetMs
        let upper = RemiloIOSSeries.civil(now - offset + 86_400_000, zone: zone)
        guard cursor <= upper else { return (cursor, false) }
        let slots = try RemiloIOSRecurrence.slots(segment.rule, from: cursor, through: upper, deviceZone: .current, limit: 258)
        var latest = cursor
        var count = 0
        for slot in slots where slot.nominalSlot > cursor {
            guard RemiloIOSSeries.deliveryTime(slot, mode: segment.template.mode) <= now else { break }
            if count == 256 { return (latest, true) }
            let id = RemiloIOSSeries.occurrenceID(segment.id, slot.nominalSlot)
            if state.reminders[id] == nil && !state.isPurgedOccurrence(id) {
                var record = RemiloIOSSeries.makeOccurrence(segment, slot: slot)
                record.deliveryState = record.mode == "None" ? "NoAlert" : "Missed"
                state.reminders[id] = record
            }
            latest = slot.nominalSlot
            count += 1
        }
        return (latest, false)
    }
}
