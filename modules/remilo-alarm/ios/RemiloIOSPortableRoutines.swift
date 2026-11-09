import Foundation

extension RemiloIOSPortableContent {
    struct RoutineWire {
        var records: [IOSReminder] = []
        var series: [IOSSeriesSegment] = []
        var exclusions: [String: IOSPortableExclusion] = [:]
        var plans: [[String: Any]] = []
        var versions: [[String: Any]] = []
        var sessions: [[String: Any]] = []
    }

    static func encodeRoutines(_ state: IOSDatabase) throws -> RoutineWire {
        var wire = RoutineWire()
        let sessions = Dictionary(grouping: state.routineSessions.values, by: \.routineID)
        let routineRecords = state.reminders.values.filter { !$0.isTest && $0.routineID != nil }
        guard routineRecords.count == state.routineSessions.count,
              routineRecords.allSatisfy({ state.routineSessions[$0.id]?.routineID == $0.routineID }),
              sessions.keys.allSatisfy({ state.routines[$0] != nil }) else {
            throw IOSInputFailure("INVALID_INPUT", field: "routineSessions")
        }
        for plan in state.routines.values.sorted(by: { $0.id < $1.id }) {
            wire.plans.append(planFields(plan))
            var versionByRevision: [Int: IOSRoutineVersion] = [:]
            for version in plan.versions.sorted(by: { $0.revision < $1.revision }) {
                guard versionByRevision.updateValue(version, forKey: version.revision) == nil else {
                    throw IOSInputFailure("INVALID_INPUT", field: "routineVersions")
                }
                var fields = version.bridge
                fields["routineId"] = plan.id
                fields["revision"] = version.revision
                wire.versions.append(fields)
            }
            let regular = try segments(for: plan)
            var segmentsByID: [String: IOSSeriesSegment] = [:]
            for segment in regular {
                guard segmentsByID.updateValue(segment, forKey: segment.id) == nil else {
                    throw IOSInputFailure("INVALID_INPUT", field: "series")
                }
            }
            let unbound = plan.portableUnboundReminders ?? []
            let unboundIDs = Set(unbound.map(\.id))
            wire.records.append(contentsOf: unbound)
            for (id, value) in plan.portableExclusions ?? [:] {
                guard wire.exclusions.updateValue(value, forKey: id) == nil else {
                    throw IOSInputFailure("INVALID_INPUT", field: "purgedOccurrences")
                }
            }
            for session in (sessions[plan.id] ?? []).sorted(by: { $0.date < $1.date }) {
                guard var record = state.reminders[session.occurrenceID], let version = versionByRevision[session.versionRevision] else {
                    throw IOSInputFailure("INVALID_INPUT", field: "routineSessions")
                }
                let slot = try routineSlot(session.date, version: version, plan: plan, unboundIDs: unboundIDs, segments: &segmentsByID)
                record.id = RemiloIOSSeries.occurrenceID(slot.segmentID, slot.nominalSlot)
                record.segmentID = slot.segmentID
                record.nominalSlot = slot.nominalSlot
                record.vibration = version.vibration
                wire.records.append(record)
                wire.sessions.append([
                    "occurrenceId": record.id, "routineId": plan.id, "date": session.date,
                    "versionDate": version.effectiveDate, "versionRevision": session.versionRevision,
                    "steps": session.steps.map(\.bridge), "done": session.done.sorted(),
                    "ended": session.ended, "changes": session.changes.map(\.bridge),
                ])
            }
            wire.series.append(contentsOf: segmentsByID.values)
        }
        return wire
    }

    /// Preserve the same wire identity an export would have used for this day.
    static func excludeRoutineSession(_ session: IOSRoutineSession, from plan: inout IOSRoutinePlan) throws {
        guard let version = plan.versions.first(where: { $0.revision == session.versionRevision }) else {
            throw IOSInputFailure("INVALID_INPUT", field: "routineSessions")
        }
        var indexed: [String: IOSSeriesSegment] = [:]
        for segment in try segments(for: plan) {
            guard indexed.updateValue(segment, forKey: segment.id) == nil else {
                throw IOSInputFailure("INVALID_INPUT", field: "series")
            }
        }
        let knownIDs = Set(indexed.keys)
        let unboundIDs = Set((plan.portableUnboundReminders ?? []).map(\.id))
        let slot = try routineSlot(session.date, version: version, plan: plan, unboundIDs: unboundIDs, segments: &indexed)
        if !knownIDs.contains(slot.segmentID), let fallback = indexed[slot.segmentID] {
            plan.portableSegments = (plan.portableSegments ?? []) + [fallback]
        }
        let id = RemiloIOSSeries.occurrenceID(slot.segmentID, slot.nominalSlot)
        var exclusions = plan.portableExclusions ?? [:]
        exclusions[id] = slot
        plan.portableExclusions = exclusions
        plan.portableSlots?.removeValue(forKey: session.date)
    }

    private static func routineSlot(_ date: String, version: IOSRoutineVersion, plan: IOSRoutinePlan,
                                    unboundIDs: Set<String>, segments: inout [String: IOSSeriesSegment]) throws -> IOSPortableExclusion {
        if let original = plan.portableSlots?[date] {
            guard segments[original.segmentID] != nil else { throw IOSInputFailure("INVALID_INPUT", field: "routineSessions") }
            return original
        }
        let nominal = nominalForRoutine(date, minutes: version.minutes)
        let preferredID = segmentID(plan.id, version.revision)
        if segments[preferredID] != nil, !unboundIDs.contains(RemiloIOSSeries.occurrenceID(preferredID, nominal)) {
            return IOSPortableExclusion(segmentID: preferredID, nominalSlot: nominal)
        }
        let fallbackID = RemiloIOSSeries.namedUUID("remilo:routine-history:\(preferredID)")
        if segments[fallbackID] == nil {
            let fallback = try routineSegment(plan: plan, version: version, state: "Archived", end: nil)
            segments[fallbackID] = IOSSeriesSegment(id: fallbackID, familyID: plan.id, template: fallback.template,
                                                   rule: fallback.rule, createdAtMs: fallback.createdAtMs, state: "Archived")
        }
        return IOSPortableExclusion(segmentID: fallbackID, nominalSlot: nominal)
    }

    private static func planFields(_ plan: IOSRoutinePlan) -> [String: Any] {
        func intervals(_ values: [IOSRoutinePause]) -> [[String: Any]] {
            values.map { ["from": $0.fromMs, "until": iosBridgeValue($0.untilMs)] }
        }
        return [
            "id": plan.id, "revision": plan.revision, "startsOn": plan.startsOn, "state": plan.state,
            "pauses": intervals(plan.pauses), "priorState": plan.preTrashState ?? (plan.state == "Paused" ? "Paused" : "Active"),
            "trashedAtMs": plan.trashedAtMs ?? 0, "trashIntervals": intervals(plan.trashIntervals),
        ]
    }

    private static func segments(for plan: IOSRoutinePlan) throws -> [IOSSeriesSegment] {
        let local = plan.versions.filter { $0.revision > (plan.portableVersionRevision ?? 0) }
        let ordered = local.sorted { ($0.effectiveDate, $0.revision) < ($1.effectiveDate, $1.revision) }
        let boundary = ordered.first.map { $0.effectiveDate + "T00:00" }
        let activeState = plan.state == "Active" ? "Active" : "Paused"
        var segments = (plan.portableSegments ?? []).map { segment -> IOSSeriesSegment in
            var retained = segment
            if retained.state != "Archived" {
                retained.state = activeState
                if let boundary {
                    if retained.rule.anchor >= boundary { retained.state = "Archived" }
                    else if retained.rule.endExclusive.map({ $0 > boundary }) ?? true { retained.rule.endExclusive = boundary }
                }
            }
            return retained
        }
        for (index, version) in ordered.enumerated() {
            let next = index + 1 < ordered.count ? ordered[index + 1].effectiveDate : nil
            let superseded = next == version.effectiveDate
            let segment = try routineSegment(
                plan: plan, version: version, state: superseded ? "Archived" : activeState,
                end: superseded ? nil : next.map { $0 + "T00:00" }
            )
            segments.append(segment)
        }
        guard !segments.isEmpty else { throw IOSInputFailure("INVALID_INPUT", field: "series") }
        return segments
    }

    private static func segmentID(_ routineID: String, _ revision: Int) -> String {
        RemiloIOSSeries.namedUUID("remilo:routine-segment:\(routineID):\(revision)")
    }

    private static func nominalForRoutine(_ date: String, minutes: Int) -> String {
        date + String(format: "T%02d:%02d", locale: Locale(identifier: "en_US_POSIX"), minutes / 60, minutes % 60)
    }

    private static func routineSegment(
        plan: IOSRoutinePlan, version: IOSRoutineVersion, state: String, end: String?
    ) throws -> IOSSeriesSegment {
        let id = segmentID(plan.id, version.revision)
        let zone = TimeZone.current
        let start = try RemiloIOSRoutineAuthoring.time(version.effectiveDate, minutes: version.minutes, in: zone)
        let template = IOSReminder(
            id: "template", title: version.title, notes: version.notes, listID: version.listID,
            eventStartMs: start, eventEndMs: start + 1_800_000, dueAtMs: start, alarmAtMs: start,
            zoneID: zone.identifier, mode: version.mode, allDay: false, dueLinked: true, alarmLinked: true,
            sound: version.sound, routineID: plan.id, createdAtMs: start, vibration: version.vibration
        )
        let rule = try RemiloIOSRecurrence.Rule(
            anchor: nominalForRoutine(version.effectiveDate, minutes: version.minutes), frequency: "weekly",
            weekdays: version.days.enumerated().compactMap { $0.element.exercises.isEmpty ? nil : $0.offset + 1 },
            endExclusive: end
        )
        return IOSSeriesSegment(id: id, familyID: plan.id, template: template, rule: rule, createdAtMs: start, state: state)
    }

    static func decodeRoutines(_ root: [String: Any], availableImageIDs: Set<String>, in bundle: inout Bundle) throws {
        let plans = try objects(root, key: "routines")
        let versions = try objects(root, key: "routineVersions")
        let sessions = try objects(root, key: "routineSessions")
        let erased = try purgedIDs(root)
        let families = Dictionary(grouping: bundle.series.values, by: \.familyID)
        var decoded: [String: IOSRoutinePlan] = [:]
        for fields in plans {
            try allow(fields, keys: ["id", "revision", "startsOn", "state", "pauses", "priorState", "trashedAtMs", "trashIntervals"])
            let input = IOSInput(values: fields)
            let id = try nonblank(input, "id")
            guard decoded[id] == nil, !erased.contains(id), let segments = families[id],
                  segments.allSatisfy({ $0.template.routineID == id }) else { throw input.invalid("routines") }
            let state = try input.choice("state", fallback: "", from: ["Active", "Paused", "Trashed"])
            let prior = try input.choice("priorState", fallback: "", from: ["Active", "Paused"])
            let trashed = try input.integer("trashedAtMs", range: clockRange)
            decoded[id] = IOSRoutinePlan(
                id: id, startsOn: try portableDate(input, "startsOn"), versions: [], state: state,
                revision: try portableRevision(input, "revision"),
                pauses: try intervals(fields, "pauses"), trashIntervals: try intervals(fields, "trashIntervals"),
                trashedAtMs: state == "Trashed" || trashed != 0 ? trashed : nil,
                preTrashState: prior, portableSegments: segments.sorted { $0.id < $1.id }
            )
        }
        var versionIndices: [String: [Int: IOSRoutineVersion]] = [:]
        for fields in versions {
            try allow(fields, keys: [
                "routineId", "revision", "effectiveDate", "title", "minutes", "mode", "notes", "sound",
                "vibration", "listId", "days", "authoringMode", "presentationPreset"
            ])
            let input = IOSInput(values: fields)
            let id = try nonblank(input, "routineId")
            let revision = try portableRevision(input, "revision")
            let effectiveDate = try portableDate(input, "effectiveDate")
            guard var plan = decoded[id], effectiveDate >= plan.startsOn, revision <= plan.revision,
                  versionIndices[id]?[revision] == nil else { throw input.invalid("routineVersions") }
            _ = try nonblank(input, "title")
            _ = try input.choice("mode", fallback: "", from: ["Alarm", "Notification", "None"])
            _ = try input.choice("sound", fallback: "", from: ["remilo", "system"])
            _ = try input.choice("authoringMode", fallback: "", from: ["Shared", "ByWeekday"])
            _ = try input.choice("presentationPreset", fallback: "", from: ["General", "Exercise"])
            _ = try requiredFlag(input, "vibration")
            guard fields["notes"] is String, let days = fields["days"] as? [[String: Any]], days.count == 7 else {
                throw input.invalid("routineVersions")
            }
            for day in days {
                try allow(day, keys: ["type", "exercises"])
                guard let steps = day["exercises"] as? [[String: Any]],
                      (day["type"] as? String == "Rest" && steps.isEmpty) ||
                      (day["type"] as? String == "Exercises" && !steps.isEmpty) else {
                    throw input.invalid("days")
                }
                for step in steps { _ = try portableStep(step, images: availableImageIDs) }
            }
            let version = try RemiloIOSRoutineAuthoring.version(
                fields, effectiveDate: effectiveDate, revision: revision,
                listExists: { bundle.lists[$0] != nil }, imageExists: availableImageIDs.contains
            )
            guard version.title == fields["title"] as? String else { throw input.invalid("title") }
            versionIndices[id, default: [:]][revision] = version
            plan.versions.append(version)
            decoded[id] = plan
        }
        for (id, var plan) in decoded {
            guard plan.versions.contains(where: { $0.effectiveDate == plan.startsOn }) else {
                throw IOSInputFailure("INVALID_INPUT", field: "routineVersions")
            }
            plan.portableVersionRevision = plan.latest?.revision
            decoded[id] = plan
        }
        for segment in bundle.series.values {
            guard !erased.contains(segment.familyID),
                  segment.template.routineID == decoded[segment.familyID]?.id else {
                throw IOSInputFailure("INVALID_INPUT", field: "series")
            }
        }
        for record in bundle.reminders.values {
            let routineID = record.segmentID.flatMap { bundle.series[$0]?.template.routineID }
            guard record.routineID == routineID else { throw IOSInputFailure("INVALID_INPUT", field: "routineId") }
        }

        var bound = Set<String>()
        var stagedSessions: [String: IOSRoutineSession] = [:]
        var stagedRecords: [String: IOSReminder] = [:]
        for fields in sessions {
            try allow(fields, keys: [
                "occurrenceId", "routineId", "date", "versionDate", "versionRevision", "steps", "done", "ended", "changes"
            ])
            let input = IOSInput(values: fields)
            let oldID = try nonblank(input, "occurrenceId")
            let id = try nonblank(input, "routineId")
            let date = try portableDate(input, "date")
            let revision = try portableRevision(input, "versionRevision")
            let versionDate = try portableDate(input, "versionDate")
            guard bound.insert(oldID).inserted, var record = bundle.reminders[oldID], record.routineID == id,
                  var plan = decoded[id], let version = versionIndices[id]?[revision], version.effectiveDate == versionDate,
                  versionDate <= date, let nominal = record.nominalSlot, let segment = record.segmentID,
                  nominal.prefix(10) == date, record.title == version.title, record.mode == version.mode,
                  record.notes == version.notes, record.sound == version.sound, record.vibration == version.vibration,
                  let zone = TimeZone(identifier: record.zoneID) else {
                throw input.invalid("routineSessions")
            }
            let clock = String(nominal.dropFirst(11).prefix(5))
            let minutes = clock.split(separator: ":").compactMap { Int($0) }
            guard minutes.count == 2 else { throw input.invalid("routineSessions") }
            let editedTarget = try RemiloIOSRoutineAuthoring.time(date, minutes: version.minutes, in: zone)
            guard minutes[0] * 60 + minutes[1] == version.minutes || record.alarmAtMs == editedTarget else {
                throw input.invalid("routineSessions")
            }
            let snapshot = try objects(fields, key: "steps", maximum: 100).map {
                try portableStep($0, images: availableImageIDs)
            }
            let expected = try RemiloIOSRoutineAuthoring.day(date, in: version).exercises
            let ids = Set(snapshot.map(\.id))
            guard snapshot == expected, let checks = fields["done"] as? [String] else {
                throw input.invalid("routineSessions")
            }
            let done = Set(checks)
            guard done.count == checks.count, done.isSubset(of: ids),
                  record.completed == (!ids.isEmpty && done.count == ids.count && record.skipped != true),
                  plan.portableSlots?[date] == nil else { throw input.invalid("routineSessions") }
            let historical = Set(plan.versions.lazy.filter { $0.revision <= revision }
                .flatMap { $0.days.flatMap { $0.exercises.map(\.id) } })
            let changes = try routineChanges(fields, historical: historical)
            let localID = RemiloIOSSeries.occurrenceID(id, date)
            guard stagedRecords[localID] == nil,
                  bundle.reminders[localID].map({ $0.routineID != nil && $0.id == oldID }) ?? true else {
                throw input.invalid("routineSessions")
            }
            plan.portableSlots = (plan.portableSlots ?? [:]).merging([
                date: IOSPortableExclusion(segmentID: segment, nominalSlot: nominal)
            ]) { _, added in added }
            record.id = localID
            record.nominalSlot = date
            record.segmentID = nil
            stagedRecords[localID] = record
            stagedSessions[localID] = IOSRoutineSession(
                routineID: id, occurrenceID: localID, date: date, versionRevision: revision, steps: snapshot,
                ended: try requiredFlag(input, "ended"), done: done, changes: changes
            )
            decoded[id] = plan
        }
        for record in bundle.reminders.values where record.routineID != nil {
            guard let id = record.routineID else { continue }
            if !bound.contains(record.id) {
                var snapshots = decoded[id]?.portableUnboundReminders ?? []
                snapshots.append(record)
                decoded[id]?.portableUnboundReminders = snapshots
            }
        }
        let detachedExclusions = bundle.exclusions.filter { bundle.series[$0.value.segmentID]?.template.routineID != nil }
        for (id, exclusion) in detachedExclusions {
            guard let routineID = bundle.series[exclusion.segmentID]?.template.routineID else { continue }
            var captured = decoded[routineID]?.portableExclusions ?? [:]
            captured[id] = exclusion
            decoded[routineID]?.portableExclusions = captured
        }
        bundle.reminders = bundle.reminders.filter { $0.value.routineID == nil }.merging(stagedRecords) { _, restored in restored }
        bundle.series = bundle.series.filter { $0.value.template.routineID == nil }
        bundle.exclusions = bundle.exclusions.filter { detachedExclusions[$0.key] == nil }
        bundle.routines = decoded
        bundle.routineSessions = stagedSessions
        bundle.purgedRoutines = erased
        let versionSteps = decoded.values.lazy.flatMap(\.versions).flatMap(\.days).flatMap(\.exercises)
        let snapshotSteps = stagedSessions.values.lazy.flatMap(\.steps)
        let references = Set(versionSteps.compactMap(\.customImageId)).union(snapshotSteps.compactMap(\.customImageId))
        guard references == availableImageIDs else { throw IOSInputFailure("INVALID_INPUT", field: "images") }
    }

    static func addRoutines(
        _ bundle: Bundle, preserving preserved: Set<String>, conflicts: Set<String>, operationID: String,
        against state: IOSDatabase, to additions: inout Bundle
    ) throws {
        let sessions = Dictionary(grouping: bundle.routineSessions.values, by: \.routineID)
        let localFamilies = Set(state.series.values.map(\.familyID)).union(state.routines.keys)
        additions.purgedRoutines = bundle.purgedRoutines.subtracting(localFamilies)
        for original in bundle.routines.values where !preserved.contains(original.id) {
            let copy = conflicts.contains(original.id)
            let id = copy ? RemiloIOSSeries.namedUUID("\(operationID):family:\(original.id)") : original.id
            guard !localFamilies.contains(id), additions.routines[id] == nil,
                  !additions.purgedRoutines.contains(id), state.purgedRoutines?.contains(id) != true else {
                throw IOSInputFailure("INVALID_INPUT", field: "routines")
            }
            let sourceSegments = original.portableSegments ?? []
            let segmentIDs = Dictionary(uniqueKeysWithValues: sourceSegments.map {
                ($0.id, copy ? RemiloIOSSeries.namedUUID("\(operationID):segment:\($0.id)") : $0.id)
            })
            func remapSlot(_ slot: IOSPortableExclusion) throws -> IOSPortableExclusion {
                guard let segmentID = segmentIDs[slot.segmentID] else {
                    throw IOSInputFailure("INVALID_INPUT", field: "routines")
                }
                return IOSPortableExclusion(segmentID: segmentID, nominalSlot: slot.nominalSlot)
            }
            let segments = try sourceSegments.map { source -> IOSSeriesSegment in
                guard let segmentID = segmentIDs[source.id] else { throw IOSInputFailure("INVALID_INPUT", field: "series") }
                var template = source.template
                template.routineID = id
                return IOSSeriesSegment(id: segmentID, familyID: id, template: template, rule: source.rule,
                                        createdAtMs: source.createdAtMs, state: source.state)
            }
            let slots = try (original.portableSlots ?? [:]).mapValues(remapSlot)
            let unbound = try (original.portableUnboundReminders ?? []).map { source -> IOSReminder in
                guard let segment = source.segmentID, let nominal = source.nominalSlot else {
                    throw IOSInputFailure("INVALID_INPUT", field: "routines")
                }
                let slot = try remapSlot(IOSPortableExclusion(segmentID: segment, nominalSlot: nominal))
                var snapshot = source
                snapshot.id = RemiloIOSSeries.occurrenceID(slot.segmentID, slot.nominalSlot)
                snapshot.routineID = id
                snapshot.segmentID = slot.segmentID
                if snapshot.id != source.id { remapHistory(&snapshot, operationID: operationID) }
                return snapshot
            }
            var exclusions: [String: IOSPortableExclusion] = [:]
            for source in (original.portableExclusions ?? [:]).values {
                let slot = try remapSlot(source)
                exclusions[RemiloIOSSeries.occurrenceID(slot.segmentID, slot.nominalSlot)] = slot
            }
            let plan = IOSRoutinePlan(
                id: id, startsOn: original.startsOn, versions: original.versions, state: original.state,
                revision: original.revision, pauses: original.pauses, trashIntervals: original.trashIntervals,
                trashedAtMs: original.trashedAtMs, preTrashState: original.preTrashState, portableSegments: segments,
                portableVersionRevision: original.portableVersionRevision, portableSlots: slots,
                portableUnboundReminders: unbound, portableExclusions: exclusions
            )
            additions.routines[id] = plan
            for session in sessions[original.id] ?? [] {
                let occurrenceID = RemiloIOSSeries.occurrenceID(id, session.date)
                guard var record = bundle.reminders[session.occurrenceID], state.reminders[occurrenceID] == nil,
                      !state.isPurgedOccurrence(occurrenceID), additions.reminders[occurrenceID] == nil else {
                    throw IOSInputFailure("INVALID_INPUT", field: "routineSessions")
                }
                record.id = occurrenceID
                record.routineID = id
                if record.id != session.occurrenceID { remapHistory(&record, operationID: operationID) }
                additions.reminders[occurrenceID] = record
                additions.routineSessions[occurrenceID] = IOSRoutineSession(
                    routineID: id, occurrenceID: occurrenceID, date: session.date, versionRevision: session.versionRevision,
                    steps: session.steps, ended: session.ended, done: session.done, changes: session.changes
                )
            }
        }
    }

    private static func portableDate(_ input: IOSInput, _ key: String) throws -> String {
        let date = try nonblank(input, key, maximum: 10)
        guard date.count == 10, try RemiloIOSRecurrence.canonicalNominal(date + "T00:00") == date + "T00:00" else {
            throw input.invalid(key)
        }
        return date
    }

    private static func portableRevision(_ input: IOSInput, _ key: String) throws -> Int {
        Int(try input.integer(key, range: 1...clockRange.upperBound))
    }

    private static func purgedIDs(_ root: [String: Any]) throws -> Set<String> {
        guard let values = root["purgedRoutines"] as? [String], values.count <= 10_000 else {
            throw IOSInputFailure("INVALID_INPUT", field: "purgedRoutines")
        }
        var found = Set<String>()
        for value in values {
            let input = IOSInput(values: ["id": value])
            guard found.insert(try nonblank(input, "id")).inserted else { throw input.invalid("purgedRoutines") }
        }
        return found
    }

    private static func intervals(_ fields: [String: Any], _ key: String) throws -> [IOSRoutinePause] {
        try objects(fields, key: key).map { interval in
            try allow(interval, keys: ["from", "until"])
            let input = IOSInput(values: interval)
            return IOSRoutinePause(
                fromMs: try input.integer("from", range: clockRange),
                untilMs: try optionalInteger(input, "until", range: clockRange)
            )
        }
    }

    private static func portableStep(_ fields: [String: Any], images: Set<String>) throws -> IOSRoutineStep {
        try allow(fields, keys: ["id", "name", "target", "notes", "illustration", "customImageId", "sharedStepId", "exerciseTarget"])
        let step = try RemiloIOSRoutineAuthoring.validateStep(fields, imageExists: images.contains)
        guard step.id == fields["id"] as? String, step.name == fields["name"] as? String,
              fields["target"] is String, fields["notes"] is String else {
            throw IOSInputFailure("INVALID_INPUT", field: "steps")
        }
        return step
    }

    private static func routineChanges(_ fields: [String: Any], historical: Set<String>) throws -> [IOSRoutineChange] {
        var ids = Set<String>()
        return try objects(fields, key: "changes", maximum: 100_000).map { change in
            try allow(change, keys: ["id", "kind", "stepId", "completed", "atMs"])
            let input = IOSInput(values: change)
            let id = try nonblank(input, "id")
            let kind = try input.choice("kind", fallback: "", from: [
                "SetRoutineExercise", "CorrectRoutineExercise", "SkipRoutineDay", "UndoSkipRoutineDay", "EditRoutine",
            ])
            let step = try optionalText(input, "stepId")
            guard ids.insert(id).inserted, step.map(historical.contains) ?? true else { throw input.invalid("changes") }
            let completed = step == nil ? nil : try requiredFlag(input, "completed")
            return IOSRoutineChange(id: id, kind: kind, stepID: step, completed: completed,
                                    atMs: try input.integer("atMs", range: clockRange))
        }
    }
}
