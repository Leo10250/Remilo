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
        guard try !RemiloIOSRecurrence.future(rule, afterMs: now, deviceZone: .current, mode: template.mode, limit: 1).isEmpty else {
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
        return segment
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
