import CoreFoundation
import Foundation

struct IOSRoutineVersion: Codable {
    let effectiveDate: String
    let revision: Int
    let title: String
    let minutes: Int
    let mode: String
    let notes: String
    let sound: String
    let vibration: Bool
    var listID: String?
    let authoringMode: String
    let presentationPreset: String
    let days: [IOSRoutineDay]

    var bridge: [String: Any] {
        [
            "effectiveDate": effectiveDate, "title": title, "minutes": minutes, "mode": mode,
            "notes": notes, "sound": sound, "vibration": vibration, "listId": iosBridgeValue(listID),
            "authoringMode": authoringMode, "presentationPreset": presentationPreset,
            "days": days.map(\.bridge),
        ]
    }
}

struct IOSRoutineDay: Codable {
    let exercises: [IOSRoutineStep]

    var bridge: [String: Any] {
        ["type": exercises.isEmpty ? "Rest" : "Exercises", "exercises": exercises.map(\.bridge)]
    }
}

struct IOSRoutineStep: Codable {
    let id: String
    let name: String
    let target: String
    let notes: String
    let illustration: String?
    let customImageId: String?
    let sharedStepId: String?
    let exerciseTarget: IOSExerciseTarget?

    var bridge: [String: Any] {
        var output: [String: Any] = ["id": id, "name": name, "target": target, "notes": notes]
        output["illustration"] = illustration
        output["customImageId"] = customImageId
        output["sharedStepId"] = sharedStepId
        output["exerciseTarget"] = exerciseTarget?.bridge
        return output
    }

    var sharedContent: IOSRoutineStep {
        IOSRoutineStep(
            id: "", name: name, target: target, notes: notes, illustration: illustration,
            customImageId: customImageId, sharedStepId: sharedStepId, exerciseTarget: exerciseTarget
        )
    }
}

extension IOSRoutineStep: Equatable {}

struct IOSExerciseTarget: Codable, Equatable {
    struct Measurement: Codable, Equatable {
        let value: Double
        let unit: String

        var bridge: [String: Any] { ["value": value, "unit": unit] }
    }

    var sets: Int?
    var reps: Int?
    var repsMax: Int?
    var duration: Measurement?
    var eachSide: Bool?
    var weight: Measurement?
    var additionalText: String?

    var bridge: [String: Any] {
        var output: [String: Any] = [:]
        output["sets"] = sets
        output["reps"] = reps
        output["repsMax"] = repsMax
        output["duration"] = duration?.bridge
        output["eachSide"] = eachSide
        output["weight"] = weight?.bridge
        output["additionalText"] = additionalText
        return output
    }
}

enum RemiloIOSRoutineAuthoring {
    private static let utc = TimeZone(secondsFromGMT: 0)!
    private static let numberLimit = 9_007_199_254_740_991.0

    static func version(
        _ fields: [String: Any],
        effectiveDate: String,
        revision: Int,
        previous: IOSRoutineVersion? = nil,
        listExists: (String) -> Bool,
        imageExists: (String) -> Bool
    ) throws -> IOSRoutineVersion {
        _ = try nominalDate(effectiveDate)
        let input = IOSInput(values: fields)
        let title = try text(fields["title"], maximum: 200, field: "title", required: true)
        let minutes = Int(try input.integer("minutes", range: 0...1_439))
        let mode = try input.choice("mode", fallback: "Notification", from: ["Alarm", "Notification", "None"])
        let notes = try text(fields["notes"], maximum: 10_000, field: "notes")
        let sound = try input.choice("sound", fallback: "remilo", from: ["remilo", "system"])
        let vibration = try input.flag("vibration", fallback: false)
        let authoringMode = try input.choice(
            "authoringMode", fallback: previous?.authoringMode ?? "ByWeekday", from: ["Shared", "ByWeekday"]
        )
        let preset = try input.choice(
            "presentationPreset", fallback: previous?.presentationPreset ?? "Exercise", from: ["General", "Exercise"]
        )
        let listID = try optionalText(fields["listId"], maximum: 200, field: "listId")
        if let listID, !listExists(listID) { throw input.invalid("listId") }
        let days = try validateDays(fields["days"], authoringMode: authoringMode, imageExists: imageExists)
        return IOSRoutineVersion(
            effectiveDate: effectiveDate, revision: revision, title: title, minutes: minutes, mode: mode,
            notes: notes, sound: sound, vibration: vibration, listID: listID, authoringMode: authoringMode,
            presentationPreset: preset, days: days
        )
    }

    static func localDate(_ date: Date, in zone: TimeZone) -> String {
        let fields = calendar(in: zone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", fields.year ?? 0, fields.month ?? 0, fields.day ?? 0)
    }

    static func day(_ date: String, in version: IOSRoutineVersion) throws -> IOSRoutineDay {
        let weekday = calendar(in: utc).component(.weekday, from: try nominalDate(date))
        return version.days[(weekday + 5) % 7]
    }

    static func date(_ value: String, plusDays days: Int) throws -> String {
        localDate(try nominalDate(value).addingTimeInterval(Double(days) * 86_400), in: utc)
    }

    static func time(_ date: String, minutes: Int, in zone: TimeZone) throws -> Int64 {
        let nominal = try nominalDate(date).addingTimeInterval(Double(minutes) * 60)
        return iosMillis(try RemiloIOSTime.resolveNominal(nominal, in: zone).instant)
    }

    static func closeAt(_ date: String, in zone: TimeZone) throws -> Int64 {
        try time(self.date(date, plusDays: 1), minutes: 0, in: zone)
    }

    static func nextPrompt(_ version: IOSRoutineVersion, after now: Date, in zone: TimeZone) throws -> Int64? {
        guard version.mode != "None" else { return nil }
        let start = try nominalDate(max(localDate(now, in: zone), version.effectiveDate))
        for offset in 0...7 {
            let date = start.addingTimeInterval(Double(offset) * 86_400)
            let weekday = calendar(in: utc).component(.weekday, from: date)
            guard !version.days[(weekday + 5) % 7].exercises.isEmpty else { continue }
            let nominal = date.addingTimeInterval(Double(version.minutes) * 60)
            let target = try RemiloIOSTime.resolveNominal(nominal, in: zone).instant
            if target > now { return iosMillis(target) }
        }
        return nil
    }

    private static func validateDays(
        _ raw: Any?, authoringMode: String, imageExists: (String) -> Bool
    ) throws -> [IOSRoutineDay] {
        guard let days = raw as? [[String: Any]], days.count == 7 else { throw invalid("days") }
        var ids = Set<String>()
        var shared: [IOSRoutineStep]?
        let validated = try days.map { day in
            let steps = day["exercises"] as? [[String: Any]] ?? []
            guard steps.count <= 100 else { throw invalid("days") }
            switch day["type"] as? String {
            case "Rest": return IOSRoutineDay(exercises: [])
            case "Exercises":
                guard !steps.isEmpty else { throw invalid("days") }
            default: throw invalid("days")
            }
            var sharedIDs = Set<String>()
            let parsed = try steps.map { item in
                let step = try validateStep(item, imageExists: imageExists)
                guard ids.insert(step.id).inserted else { throw invalid("days") }
                if authoringMode == "Shared" {
                    guard let key = step.sharedStepId, !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                          sharedIDs.insert(key).inserted else { throw invalid("authoringMode") }
                } else if step.sharedStepId != nil {
                    throw invalid("authoringMode")
                }
                return step
            }
            if authoringMode == "Shared" {
                let content = parsed.map(\.sharedContent)
                if let shared, shared != content { throw invalid("authoringMode") }
                shared = content
            }
            return IOSRoutineDay(exercises: parsed)
        }
        guard validated.contains(where: { !$0.exercises.isEmpty }) else { throw invalid("days") }
        return validated
    }

    static func validateStep(
        _ fields: [String: Any], imageExists: (String) -> Bool
    ) throws -> IOSRoutineStep {
        let id = try text(fields["id"], maximum: 200, field: "days", required: true)
        let name = try text(fields["name"], maximum: 200, field: "days", required: true)
        let target = try text(fields["target"], maximum: 1_000, field: "days")
        let notes = try text(fields["notes"], maximum: 10_000, field: "days")
        let illustration = try optionalText(fields["illustration"], maximum: 80, field: "days")
        let image = try optionalText(fields["customImageId"], maximum: 64, field: "days")
        if let image {
            guard illustration == nil,
                  image.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
                  imageExists(image) else { throw invalid("days") }
        }
        if let illustration, illustration.range(of: "^[a-z0-9-]+$", options: .regularExpression) == nil {
            throw invalid("days")
        }
        return IOSRoutineStep(
            id: id, name: name, target: target, notes: notes, illustration: illustration, customImageId: image,
            sharedStepId: try optionalText(fields["sharedStepId"], maximum: 200, field: "days"),
            exerciseTarget: try exerciseTarget(fields["exerciseTarget"], custom: target)
        )
    }

    private static func exerciseTarget(_ raw: Any?, custom: String) throws -> IOSExerciseTarget? {
        if raw == nil || raw is NSNull { return nil }
        let known = Set(["sets", "reps", "repsMax", "duration", "eachSide", "weight", "additionalText"])
        guard custom.isEmpty, let value = raw as? [String: Any], !value.isEmpty,
              Set(value.keys).isSubset(of: known) else { throw invalid("days") }
        var result = IOSExerciseTarget()
        if let raw = value["sets"] { result.sets = Int(try positive(raw, whole: true)) }
        if let raw = value["reps"] { result.reps = Int(try positive(raw, whole: true)) }
        if let raw = value["repsMax"] {
            let maximum = Int(try positive(raw, whole: true))
            guard let reps = result.reps, maximum >= reps else { throw invalid("days") }
            result.repsMax = maximum
        }
        if let raw = value["duration"] { result.duration = try measurement(raw, units: ["sec", "min", "hr"]) }
        if let raw = value["weight"] { result.weight = try measurement(raw, units: ["kg", "lb"]) }
        if let raw = value["eachSide"] {
            guard let boxed = raw as? NSNumber, CFGetTypeID(boxed) == CFBooleanGetTypeID(), boxed.boolValue,
                  result.reps != nil || result.duration != nil else { throw invalid("days") }
            result.eachSide = true
        }
        if let raw = value["additionalText"] {
            let value = try text(raw, maximum: 1_000, field: "days")
            guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw invalid("days") }
            result.additionalText = value
        }
        return result
    }

    private static func measurement(_ raw: Any, units: Set<String>) throws -> IOSExerciseTarget.Measurement {
        guard let value = raw as? [String: Any], Set(value.keys) == ["value", "unit"],
              let unit = value["unit"] as? String, units.contains(unit),
              let amount = value["value"] else { throw invalid("days") }
        return IOSExerciseTarget.Measurement(value: try positive(amount), unit: unit)
    }

    private static func positive(_ raw: Any, whole: Bool = false) throws -> Double {
        guard let boxed = raw as? NSNumber, CFGetTypeID(boxed) != CFBooleanGetTypeID() else { throw invalid("days") }
        let value = boxed.doubleValue
        guard value > 0, value <= numberLimit, !whole || value.rounded(.towardZero) == value else { throw invalid("days") }
        return value
    }

    private static func text(_ raw: Any?, maximum: Int, field: String, required: Bool = false) throws -> String {
        let value: String
        if raw == nil || raw is NSNull { value = "" }
        else if let raw = raw as? String { value = raw }
        else { throw invalid(field) }
        guard value.utf16.count <= maximum else { throw invalid(field) }
        if !required { return value }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw invalid(field) }
        return trimmed
    }

    private static func optionalText(_ raw: Any?, maximum: Int, field: String) throws -> String? {
        let value = try text(raw, maximum: maximum, field: field)
        return value.isEmpty ? nil : value
    }

    private static func nominalDate(_ value: String) throws -> Date {
        guard value.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil else {
            throw invalid("date")
        }
        let fields = value.split(separator: "-").compactMap { Int($0) }
        guard fields.count == 3, (1970...9999).contains(fields[0]),
              let date = calendar(in: utc).date(from: DateComponents(year: fields[0], month: fields[1], day: fields[2])),
              localDate(date, in: utc) == value else { throw invalid("date") }
        return date
    }

    private static func calendar(in zone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }

    private static func invalid(_ field: String) -> IOSInputFailure { IOSInputFailure("INVALID_INPUT", field: field) }
}
