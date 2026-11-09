import Foundation

/// Remilo v9 portable content. Archive I/O and durable publication use separate
/// boundaries so validation cannot accidentally activate a partially read backup.
enum RemiloIOSPortableContent {
    struct Image: Sendable {
        let id: String
        let width: Int
        let height: Int
        let bytes: Int

        var wire: [String: Any] {
            ["id": id, "mime": "image/webp", "width": width, "height": height, "bytes": bytes]
        }
    }

    struct Bundle {
        var reminders: [String: IOSReminder] = [:]
        var lists: [String: IOSList] = [:]
        var series: [String: IOSSeriesSegment] = [:]
        var exclusions: [String: IOSPortableExclusion] = [:]
        var routines: [String: IOSRoutinePlan] = [:]
        var routineSessions: [String: IOSRoutineSession] = [:]
        var purgedRoutines: Set<String> = []
    }

    struct ImportPlan {
        let additions: Bundle
        let added: Int
        let preserved: Int
    }

    static let clockRange: ClosedRange<Int64> = 0...8_640_000_000_000_000
    private static let offsetRange: ClosedRange<Int64> = -31_622_400_000...31_622_400_000

    static func decode(_ metadata: Data, availableImageIDs: Set<String> = []) throws -> Bundle {
        guard metadata.count <= 10_000_000,
              let root = try JSONSerialization.jsonObject(with: metadata) as? [String: Any],
              root["format"] as? String == "Remilo",
              try IOSInput(values: root).integer("version", range: 9...9) == 9 else {
            throw IOSInputFailure("UNSUPPORTED")
        }
        try allow(root, keys: [
            "format", "version", "exportedAtMs", "lists", "series", "reminders", "history",
            "purgedOccurrences", "routines", "routineVersions", "routineSessions", "images", "purgedRoutines"
        ])
        _ = try IOSInput(values: root).integer("exportedAtMs", range: clockRange)
        let imageIDs = try verifiedImageIDs(root)
        guard imageIDs == availableImageIDs else { throw IOSInputFailure("INVALID_INPUT", field: "images") }

        var bundle = Bundle()
        var names = Set<String>()
        for values in try objects(root, key: "lists") {
            try allow(values, keys: ["id", "name", "createdAtMs"])
            let input = IOSInput(values: values)
            let id = try nonblank(input, "id")
            let name = try nonblank(input, "name", maximum: 60)
            guard bundle.lists[id] == nil, names.insert(name).inserted else { throw input.invalid("lists") }
            bundle.lists[id] = IOSList(id: id, name: name, createdAtMs: try input.integer("createdAtMs", range: clockRange))
        }
        for values in try objects(root, key: "series", optional: true) {
            try allow(values, keys: ["id", "seriesId", "state", "template", "rule", "createdAtMs"])
            let input = IOSInput(values: values)
            let id = try nonblank(input, "id")
            let familyID = try nonblank(input, "seriesId")
            guard bundle.series[id] == nil, let fields = values["template"] as? [String: Any],
                  let rawRule = values["rule"] as? [String: Any] else { throw input.invalid("series") }
            let template = try reminder(fields, lists: bundle.lists, template: true)
            let rule = try decodeRule(rawRule)
            guard template.segmentID == nil, rule.allDay == template.allDay else { throw input.invalid("template") }
            bundle.series[id] = IOSSeriesSegment(
                id: id, familyID: familyID, template: template, rule: rule,
                createdAtMs: try input.integer("createdAtMs", range: clockRange),
                state: try input.choice("state", fallback: "", from: ["Active", "Paused", "Archived"])
            )
        }
        let families = Set(bundle.series.values.map(\.familyID))
        for values in try objects(root, key: "reminders") {
            let record = try reminder(values, lists: bundle.lists, template: false)
            guard bundle.reminders[record.id] == nil else { throw IOSInputFailure("INVALID_INPUT", field: "reminders") }
            if let segmentID = record.segmentID, let nominal = record.nominalSlot {
                try checkRecurringID(record.id, segmentID, nominal, in: bundle.series)
            } else if record.segmentID != nil || record.nominalSlot != nil || families.contains(record.id) {
                throw IOSInputFailure("INVALID_INPUT", field: "reminders")
            }
            bundle.reminders[record.id] = record
        }
        for values in try objects(root, key: "purgedOccurrences") {
            try allow(values, keys: ["id", "segmentId", "nominalSlot"])
            let input = IOSInput(values: values)
            let id = try nonblank(input, "id")
            let segmentID = try nonblank(input, "segmentId")
            let nominal = try nonblank(input, "nominalSlot", maximum: 100)
            guard bundle.reminders[id] == nil, bundle.exclusions[id] == nil else { throw input.invalid("purgedOccurrences") }
            try checkRecurringID(id, segmentID, nominal, in: bundle.series)
            bundle.exclusions[id] = IOSPortableExclusion(segmentID: segmentID, nominalSlot: nominal)
        }
        var historyIDs = Set<String>()
        for values in try objects(root, key: "history", maximum: 100_000, optional: true) {
            try allow(values, keys: ["id", "reminderId", "kind", "atMs", "targetMs"])
            let input = IOSInput(values: values)
            let id = try nonblank(input, "id")
            let reminderID = try nonblank(input, "reminderId")
            guard historyIDs.insert(id).inserted, bundle.reminders[reminderID] != nil else {
                throw input.invalid("history")
            }
            let history = IOSHistory(
                kind: try nonblank(input, "kind", maximum: 50),
                atMs: try input.integer("atMs", range: clockRange),
                targetMs: try optionalInteger(input, "targetMs", range: clockRange),
                portableID: id
            )
            bundle.reminders[reminderID]?.history.append(history)
        }
        try decodeRoutines(root, availableImageIDs: imageIDs, in: &bundle)
        return bundle
    }

    static func encode(_ state: IOSDatabase, now: Int64, images: [Image] = []) throws -> Data {
        let imageIDs = Set(images.map(\.id))
        guard images.count == imageIDs.count, imageIDs == state.referencedImages else {
            throw IOSInputFailure("INVALID_INPUT", field: "images")
        }
        let ordinaryExclusions = state.portableExclusions ?? [:]
        guard Set(ordinaryExclusions.keys) == state.excludedOccurrences else {
            throw IOSInputFailure("UNSUPPORTED", field: "purgedOccurrences")
        }
        let routine = try encodeRoutines(state)
        let exclusions = ordinaryExclusions.merging(routine.exclusions) { original, _ in original }
        guard exclusions.count == ordinaryExclusions.count + routine.exclusions.count else {
            throw IOSInputFailure("INVALID_INPUT", field: "purgedOccurrences")
        }
        let ordinary = state.reminders.values.filter {
            !$0.isTest && $0.routineID == nil && (!$0.deleted || $0.segmentID != nil)
        }
        let records = (ordinary + routine.records).sorted { $0.id < $1.id }
        let series = (Array(state.series.values) + routine.series).sorted { ($0.createdAtMs, $0.id) < ($1.createdAtMs, $1.id) }
        let lists = state.lists.values.sorted { $0.id < $1.id }
        let history = records.flatMap { record in
            record.history.enumerated().map { index, item -> [String: Any] in
                [
                    "id": item.portableID ?? RemiloIOSSeries.namedUUID("remilo:history:\(record.id):\(index)"),
                    "reminderId": record.id, "kind": item.kind, "atMs": item.atMs,
                    "targetMs": iosBridgeValue(item.targetMs),
                ]
            }
        }
        let payload: [String: Any] = [
            "format": "Remilo", "version": 9, "exportedAtMs": now,
            "reminders": records.map { value in
                recordFields(value, lists: state.lists).merging(
                    ["nextAlertMs": iosBridgeValue(value.active ? value.nextAlertMs : nil)]
                ) { _, replacement in replacement }
            },
            "lists": lists.map { ["id": $0.id, "name": $0.name, "createdAtMs": $0.createdAtMs ?? 0] as [String: Any] },
            "series": series.map { segment in
                [
                    "id": segment.id, "seriesId": segment.familyID, "state": segment.state,
                    "createdAtMs": segment.createdAtMs, "template": recordFields(segment.template, lists: state.lists),
                    "rule": ruleFields(segment.rule),
                ] as [String: Any]
            },
            "purgedOccurrences": exclusions.keys.sorted().compactMap { id in
                exclusions[id].map { ["id": id, "segmentId": $0.segmentID, "nominalSlot": $0.nominalSlot] }
            },
            "history": history, "images": images.sorted { $0.id < $1.id }.map(\.wire),
            "routines": routine.plans, "routineVersions": routine.versions,
            "routineSessions": routine.sessions, "purgedRoutines": (state.purgedRoutines ?? []).sorted(),
        ]
        let metadata = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys, .withoutEscapingSlashes])
        _ = try decode(metadata, availableImageIDs: imageIDs)
        return metadata
    }

    private static func verifiedImageIDs(_ root: [String: Any]) throws -> Set<String> {
        var ids = Set<String>()
        var total = 0
        for raw in try objects(root, key: "images") {
            try allow(raw, keys: ["id", "mime", "width", "height", "bytes"])
            let input = IOSInput(values: raw)
            let id = try nonblank(input, "id", maximum: 64)
            guard id.utf8.count == 64, id.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }),
                  ids.insert(id).inserted, raw["mime"] as? String == "image/webp" else { throw input.invalid("images") }
            _ = try input.integer("width", range: 1...2048)
            _ = try input.integer("height", range: 1...2048)
            total += Int(try input.integer("bytes", range: 1...(4 * 1024 * 1024)))
            guard total <= 200 * 1024 * 1024 else { throw input.invalid("images") }
        }
        return ids
    }

    static func preview(_ bundle: Bundle, against state: IOSDatabase, now: Int64) throws -> [String: Any] {
        let conflicts = conflicts(bundle, against: state)
        let families = Dictionary(grouping: bundle.series.values, by: \.familyID)
        var rows = bundle.reminders.values.filter { $0.segmentID == nil && $0.routineID == nil }.sorted { $0.id < $1.id }.map {
            [
                "id": $0.id, "title": $0.title, "conflict": conflicts.contains($0.id),
                "futureAlert": $0.active && $0.mode != "None" && ($0.nextAlertMs ?? 0) > now,
            ] as [String: Any]
        }
        for id in families.keys.sorted() {
            guard let family = families[id] else { continue }
            let segments = family.sorted { ($0.createdAtMs, $0.id) < ($1.createdAtMs, $1.id) }
            guard let latest = segments.last(where: { $0.state != "Archived" }) ?? segments.last else { continue }
            let future = try segments.contains { segment in
                guard segment.state == "Active", segment.template.mode != "None" else { return false }
                return !(try RemiloIOSRecurrence.future(segment.rule, afterMs: now, deviceZone: .current, limit: 1)).isEmpty
            }
            rows.append(["id": id, "title": latest.template.title, "conflict": conflicts.contains(id), "futureAlert": future])
        }
        for plan in bundle.routines.values.sorted(by: { $0.id < $1.id }) {
            guard let version = plan.latest else { continue }
            let future = plan.state == "Active"
                ? try RemiloIOSRoutineAuthoring.nextPrompt(version, after: iosDate(now), in: .current) : nil
            rows.append(["id": plan.id, "title": version.title, "conflict": conflicts.contains(plan.id), "futureAlert": future != nil])
        }
        let lists = restoredLists(bundle.lists, alongside: state.lists)
        let listRows = bundle.lists.values.sorted { $0.id < $1.id }.compactMap { source -> [String: Any]? in
            guard let target = lists[source.id] else { return nil }
            return [
                "id": source.id, "name": source.name, "restoredName": target.name,
                "conflict": state.lists[source.id] != nil || source.name != target.name,
            ]
        }
        return ["count": rows.count, "items": rows, "lists": listRows]
    }

    static func planImport(
        _ bundle: Bundle, against state: IOSDatabase, copyIDs: Set<String>, operationID: String
    ) throws -> ImportPlan {
        let conflicts = conflicts(bundle, against: state)
        let candidates = Set(bundle.reminders.values.filter { $0.segmentID == nil && $0.routineID == nil }.map(\.id))
            .union(bundle.series.values.map(\.familyID))
            .union(bundle.routines.keys)
        guard copyIDs.isSubset(of: candidates) else { throw IOSInputFailure("INVALID_INPUT", field: "copyIds") }
        let preserved = conflicts.subtracting(copyIDs)
        let lists = restoredLists(bundle.lists, alongside: state.lists)
        var additions = Bundle()
        additions.lists = lists.filter { state.lists[$0.key] == nil }
        try addRoutines(bundle, preserving: preserved, conflicts: conflicts, operationID: operationID,
                        against: state, to: &additions)
        var segmentIDs: [String: String] = [:]
        for segment in bundle.series.values where !preserved.contains(segment.familyID) {
            let copy = conflicts.contains(segment.familyID)
            let id = copy ? RemiloIOSSeries.namedUUID("\(operationID):segment:\(segment.id)") : segment.id
            let family = copy ? RemiloIOSSeries.namedUUID("\(operationID):family:\(segment.familyID)") : segment.familyID
            guard state.series[id] == nil, additions.series[id] == nil,
                  !copy || !state.series.values.contains(where: { $0.familyID == family }) else {
                throw IOSInputFailure("INVALID_INPUT", field: "series")
            }
            segmentIDs[segment.id] = id
            additions.series[id] = IOSSeriesSegment(
                id: id, familyID: family, template: segment.template, rule: segment.rule,
                createdAtMs: segment.createdAtMs, state: segment.state
            )
        }
        for source in bundle.exclusions.values {
            guard let segment = segmentIDs[source.segmentID] else { continue }
            let id = RemiloIOSSeries.occurrenceID(segment, source.nominalSlot)
            guard state.reminders[id] == nil, !state.excludedOccurrences.contains(id),
                  additions.exclusions[id] == nil else { throw IOSInputFailure("INVALID_INPUT", field: "purgedOccurrences") }
            additions.exclusions[id] = IOSPortableExclusion(segmentID: segment, nominalSlot: source.nominalSlot)
        }
        for source in bundle.reminders.values where source.routineID == nil {
            var record = source
            if let segment = source.segmentID, let nominal = source.nominalSlot {
                guard let id = segmentIDs[segment] else { continue }
                record.segmentID = id
                record.id = RemiloIOSSeries.occurrenceID(id, nominal)
            } else {
                if preserved.contains(source.id) { continue }
                if conflicts.contains(source.id) { record.id = RemiloIOSSeries.namedUUID("\(operationID):\(source.id)") }
            }
            guard state.reminders[record.id] == nil, !state.excludedOccurrences.contains(record.id),
                  additions.reminders[record.id] == nil, additions.exclusions[record.id] == nil else {
                throw IOSInputFailure("INVALID_INPUT", field: "reminders")
            }
            if record.id != source.id { remapHistory(&record, operationID: operationID) }
            additions.reminders[record.id] = record
        }
        return ImportPlan(additions: additions, added: candidates.count - preserved.count, preserved: preserved.count)
    }

    private static func conflicts(_ bundle: Bundle, against state: IOSDatabase) -> Set<String> {
        let localFamilies = Set(state.series.values.map(\.familyID)).union(state.routines.keys)
        var result = Set(bundle.reminders.values.lazy.filter {
            $0.segmentID == nil && $0.routineID == nil &&
            (state.reminders[$0.id] != nil || state.excludedOccurrences.contains($0.id))
        }.map(\.id))
        for segment in bundle.series.values {
            if localFamilies.contains(segment.familyID) || state.series[segment.id] != nil {
                result.insert(segment.familyID)
            }
        }
        for record in bundle.reminders.values {
            if let segment = record.segmentID.flatMap({ bundle.series[$0] }),
               state.reminders[record.id] != nil || state.excludedOccurrences.contains(record.id) {
                result.insert(segment.familyID)
            }
        }
        for (id, exclusion) in bundle.exclusions {
            if let segment = bundle.series[exclusion.segmentID],
               state.reminders[id] != nil || state.excludedOccurrences.contains(id) {
                result.insert(segment.familyID)
            }
        }
        for id in bundle.routines.keys where localFamilies.contains(id) || state.purgedRoutines?.contains(id) == true {
            result.insert(id)
        }
        for session in bundle.routineSessions.values where state.reminders[session.occurrenceID] != nil ||
            state.excludedOccurrences.contains(session.occurrenceID) {
            result.insert(session.routineID)
        }
        return result
    }

    static func remapHistory(_ record: inout IOSReminder, operationID: String) {
        record.history = record.history.map { event in
            var copied = event
            copied.portableID = event.portableID.map { RemiloIOSSeries.namedUUID("\(operationID):history:\($0)") }
            return copied
        }
    }

    private static func restoredLists(_ imported: [String: IOSList], alongside local: [String: IOSList]) -> [String: IOSList] {
        func key(_ name: String) -> String {
            name.trimmingCharacters(in: .whitespacesAndNewlines).precomposedStringWithCanonicalMapping.lowercased()
        }
        var reserved = Set(local.values.map { key($0.name) })
        var result: [String: IOSList] = [:]
        for source in imported.values.sorted(by: { $0.id < $1.id }) {
            if let existing = local[source.id] {
                result[source.id] = existing
                continue
            }
            var target = source
            var suffixIndex = 1
            while !reserved.insert(key(target.name)).inserted {
                let suffix = suffixIndex == 1 ? " (restored)" : " (restored \(suffixIndex))"
                let prefix = String(decoding: source.name.utf16.prefix(60 - suffix.utf16.count), as: UTF16.self)
                target.name = prefix.trimmingCharacters(in: .whitespacesAndNewlines) + suffix
                suffixIndex += 1
            }
            result[source.id] = target
        }
        return result
    }

    private static func reminder(_ values: [String: Any], lists: [String: IOSList], template: Bool) throws -> IOSReminder {
        try allow(values, keys: [
            "id", "title", "notes", "listId", "listName", "eventStartMs", "eventEndMs", "dueAtMs", "alarmAtMs",
            "createdAtMs", "completed", "mode", "allDay", "zoneId", "dueLinked", "alarmLinked", "sound", "vibration",
            "segmentId", "nominalSlot", "exception", "skipped", "deleted", "routineId", "nextAlertMs",
        ])
        let input = IOSInput(values: values)
        let listID = try optionalText(input, "listId")
        let start = try input.integer("eventStartMs", range: clockRange)
        let end = try input.integer("eventEndMs", range: clockRange)
        let zone = try nonblank(input, "zoneId", maximum: 100)
        let routineID = try optionalText(input, "routineId")
        guard end > start, TimeZone(identifier: zone) != nil,
              listID.map({ lists[$0] != nil }) ?? true else { throw input.invalid("reminders") }
        _ = try input.text("listName", maximum: 60)
        let segmentID = try optionalText(input, "segmentId")
        let nominalSlot = try optionalText(input, "nominalSlot", maximum: 100)
        let next = try optionalInteger(input, "nextAlertMs", range: clockRange)
        guard !template || (segmentID == nil && nominalSlot == nil && next == nil) else { throw input.invalid("template") }
        return IOSReminder(
            id: try nonblank(input, "id"), title: try nonblank(input, "title"),
            notes: try input.text("notes", maximum: 10_000), listID: listID, eventStartMs: start, eventEndMs: end,
            dueAtMs: try input.integer("dueAtMs", range: clockRange), alarmAtMs: try input.integer("alarmAtMs", range: clockRange),
            zoneID: zone, mode: try input.choice("mode", fallback: "", from: ["Alarm", "Notification", "None"]),
            allDay: try requiredFlag(input, "allDay"), dueLinked: try requiredFlag(input, "dueLinked"),
            alarmLinked: try requiredFlag(input, "alarmLinked"),
            sound: try input.choice("sound", fallback: "", from: ["remilo", "system"]),
            segmentID: segmentID, routineID: routineID, nominalSlot: nominalSlot,
            independent: try input.flag("exception", fallback: false), skipped: try input.flag("skipped", fallback: false),
            completed: try requiredFlag(input, "completed"), deleted: try input.flag("deleted", fallback: false),
            nextAlertMs: next, createdAtMs: try input.integer("createdAtMs", range: clockRange),
            vibration: try requiredFlag(input, "vibration")
        )
    }

    private static func recordFields(_ value: IOSReminder, lists: [String: IOSList]) -> [String: Any] {
        [
            "id": value.id, "title": value.title, "notes": value.notes, "listId": iosBridgeValue(value.listID),
            "listName": value.listID.flatMap { lists[$0]?.name } ?? "",
            "eventStartMs": value.eventStartMs, "eventEndMs": value.eventEndMs, "dueAtMs": value.dueAtMs,
            "alarmAtMs": value.alarmAtMs, "createdAtMs": value.createdAtMs ?? value.eventStartMs,
            "completed": value.completed, "mode": value.mode, "allDay": value.allDay, "zoneId": value.zoneID,
            "dueLinked": value.dueLinked, "alarmLinked": value.alarmLinked, "sound": value.sound ?? "remilo",
            "vibration": value.vibration ?? false, "segmentId": iosBridgeValue(value.segmentID),
            "nominalSlot": iosBridgeValue(value.nominalSlot), "exception": value.independent ?? false,
            "skipped": value.skipped ?? false, "deleted": value.deleted, "routineId": iosBridgeValue(value.routineID),
        ]
    }

    private static func decodeRule(_ values: [String: Any]) throws -> RemiloIOSRecurrence.Rule {
        try allow(values, keys: [
            "version", "anchor", "frequency", "interval", "weekdays", "day", "ordinal", "weekday", "month",
            "count", "until", "zoneId", "endExclusive", "allDay", "endOffsetMs", "dueOffsetMs", "alarmOffsetMs",
        ])
        let input = IOSInput(values: values)
        _ = try input.integer("version", range: 1...1)
        guard let days = values["weekdays"] as? [Any], days.count <= 7 else { throw input.invalid("weekdays") }
        let weekdays = try days.map { Int(try IOSInput(values: ["day": $0]).integer("day", range: 1...7)) }
        return try RemiloIOSRecurrence.Rule(
            anchor: nonblank(input, "anchor", maximum: 100), frequency: nonblank(input, "frequency", maximum: 32),
            interval: Int(input.integer("interval", range: 1...999)), weekdays: weekdays,
            day: Int(input.integer("day", range: 1...31)), ordinal: Int(input.integer("ordinal", range: -1...5)),
            weekday: Int(input.integer("weekday", range: 1...7)), month: Int(input.integer("month", range: 1...12)),
            count: optionalInteger(input, "count", range: 1...100_000).map(Int.init),
            until: optionalText(input, "until", maximum: 10), zoneID: optionalText(input, "zoneId", maximum: 100),
            endExclusive: optionalText(input, "endExclusive", maximum: 100), allDay: requiredFlag(input, "allDay"),
            endOffsetMs: input.integer("endOffsetMs", range: offsetRange), dueOffsetMs: input.integer("dueOffsetMs", range: offsetRange),
            alarmOffsetMs: input.integer("alarmOffsetMs", range: offsetRange)
        )
    }

    private static func ruleFields(_ rule: RemiloIOSRecurrence.Rule) -> [String: Any] {
        [
            "version": 1, "anchor": rule.anchor, "frequency": rule.frequency, "interval": rule.interval,
            "weekdays": rule.weekdays, "day": rule.day, "ordinal": rule.ordinal, "weekday": rule.weekday,
            "month": rule.month, "count": iosBridgeValue(rule.count), "until": iosBridgeValue(rule.until),
            "zoneId": iosBridgeValue(rule.zoneID), "endExclusive": iosBridgeValue(rule.endExclusive),
            "allDay": rule.allDay, "endOffsetMs": rule.endOffsetMs, "dueOffsetMs": rule.dueOffsetMs, "alarmOffsetMs": rule.alarmOffsetMs,
        ]
    }

    private static func checkRecurringID(
        _ id: String, _ segmentID: String, _ nominal: String, in segments: [String: IOSSeriesSegment]
    ) throws {
        guard let segment = segments[segmentID], try RemiloIOSRecurrence.canonicalNominal(nominal) == nominal,
              nominal >= segment.rule.anchor, id == RemiloIOSSeries.occurrenceID(segmentID, nominal) else {
            throw IOSInputFailure("INVALID_INPUT", field: "nominalSlot")
        }
    }

    static func allow(_ values: [String: Any], keys: Set<String>) throws {
        guard Set(values.keys).isSubset(of: keys) else { throw IOSInputFailure("UNSUPPORTED") }
    }

    static func objects(
        _ values: [String: Any], key: String, maximum: Int = 10_000, optional: Bool = false
    ) throws -> [[String: Any]] {
        if optional && values[key] == nil { return [] }
        guard let objects = values[key] as? [[String: Any]], objects.count <= maximum else {
            throw IOSInputFailure("INVALID_INPUT", field: key)
        }
        return objects
    }

    static func nonblank(_ input: IOSInput, _ key: String, maximum: Int = 200) throws -> String {
        let value = try input.text(key, maximum: maximum)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw input.invalid(key) }
        return value
    }

    static func optionalText(_ input: IOSInput, _ key: String, maximum: Int = 200) throws -> String? {
        if input.values[key] == nil || input.values[key] is NSNull { return nil }
        return try nonblank(input, key, maximum: maximum)
    }

    static func optionalInteger(
        _ input: IOSInput, _ key: String, range: ClosedRange<Int64>
    ) throws -> Int64? {
        if input.values[key] == nil || input.values[key] is NSNull { return nil }
        return try input.integer(key, range: range)
    }

    static func requiredFlag(_ input: IOSInput, _ key: String) throws -> Bool {
        guard input.values[key] != nil else { throw input.invalid(key) }
        return try input.flag(key, fallback: false)
    }
}
