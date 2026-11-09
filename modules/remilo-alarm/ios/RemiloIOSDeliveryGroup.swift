import CryptoKit
import Foundation

enum RemiloIOSDeliveryGroup {
    struct Member: Hashable {
        let occurrenceID: String
        let generation: Int

        var bridge: [String: Any] { ["occurrenceId": occurrenceID, "expectedGeneration": generation] }
    }

    static func active(_ state: IOSDatabase, observed: [UUID: String]) -> [Member] {
        state.reminders.values
            .filter { record in
                guard record.active, !record.isTest, record.routineID == nil, let delivery = record.registration else {
                    return false
                }
                return observed[delivery.systemID] == "Alerting"
            }
            .sorted { ($0.agendaAtMs, $0.id) < ($1.agendaAtMs, $1.id) }
            .prefix(64)
            .map { Member(occurrenceID: $0.id, generation: $0.generation) }
    }

    static func captureID(_ members: [Member]) -> String {
        let capture = members.sorted { $0.occurrenceID < $1.occurrenceID }.map {
            "\($0.occurrenceID.utf8.count):\($0.occurrenceID):\($0.generation)"
        }.joined(separator: "|")
        return "ios-alarm-" + SHA256.hash(data: Data(capture.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func capture(
        _ input: IOSInput, kind: String, state: IOSDatabase, observed: [UUID: String]
    ) throws -> [Member] {
        let live = active(state, observed: observed)
        let requested = try input.text("expectedSessionId", maximum: 200)
        if kind == "StopAll" {
            guard !live.isEmpty, requested == captureID(live) else { throw IOSInputFailure("STALE_SESSION") }
            return live
        }
        guard let supplied = input.values["members"] as? [[String: Any]], (1...64).contains(supplied.count) else {
            throw input.invalid("members")
        }
        var ids = Set<String>()
        let members = try supplied.map { fields -> Member in
            let input = IOSInput(values: fields)
            let id = try input.text("occurrenceId", maximum: 200)
            let generation = Int(try input.integer("expectedGeneration", range: 1...Int64.max))
            guard !id.isEmpty, ids.insert(id).inserted else { throw input.invalid("members") }
            return Member(occurrenceID: id, generation: generation)
        }
        guard requested == captureID(members) else { throw IOSInputFailure("STALE_SESSION") }
        guard Set(members).isSubset(of: Set(live)) else { throw IOSInputFailure("STALE_MEMBERS") }
        return members
    }
}

extension RemiloIOSEngine {
    func finalizeDeliveryGroup(
        _ result: [String: Any], registrations: [String: UUID], state: IOSDatabase
    ) -> [String: Any] {
        guard let members = result["memberResults"] as? [[String: Any]] else { return result }
        var output = result
        let finalized = members.map { member -> [String: Any] in
            guard let id = member["occurrenceId"] as? String, let registration = registrations[id] else { return member }
            var row = member
            if let record = state.reminders[id], record.registration?.systemID == registration {
                switch record.deliveryState {
                case "Scheduled", "Alerting", "Notified": row["status"] = "Scheduled"
                case "Missed", "DeliveryUnconfirmed": row["status"] = "Missed"
                case "Blocked": row["status"] = "Blocked"
                default: row["status"] = "Pending"
                }
            } else {
                row["status"] = "Superseded"
            }
            return row
        }
        let statuses = Set(finalized.compactMap { $0["status"] as? String })
        if statuses == ["Scheduled"] { output["status"] = "Scheduled" }
        else if statuses == ["Blocked"] { output["status"] = "Blocked" }
        else if statuses == ["Pending"] { output["status"] = "Pending" }
        else { output["status"] = "Partial" }
        output["memberResults"] = finalized
        return output
    }

    func activeDeliveryGroup() async throws -> [String: Any]? {
        let observed = try await RemiloIOSDelivery.observedStates()
        let state = try read()
        let members = RemiloIOSDeliveryGroup.active(state, observed: observed)
        guard !members.isEmpty else { return nil }
        return ["sessionId": RemiloIOSDeliveryGroup.captureID(members),
                "members": members.map(\.bridge), "snoozeMinutes": state.settings.snoozeMinutes]
    }

    func mutateDeliveryGroup(
        _ kind: String, input: IOSInput, state: inout IOSDatabase, now: Int64, observed: [UUID: String]
    ) throws -> (result: [String: Any], registrations: [String: UUID]?) {
        let capture = try RemiloIOSDeliveryGroup.capture(input, kind: kind, state: state, observed: observed)
        let action: String
        var fields: [String: Any] = [:]
        switch kind {
        case "SnoozeAll":
            action = "Snooze"
            let minutes = try input.integer("snoozeMinutes", range: 1...1_440)
            guard state.settings.snoozeMinutes == minutes else { throw IOSInputFailure("STALE_SNOOZE") }
            fields["expectedSnoozeMinutes"] = minutes
        case "PostponeAll":
            action = "Postpone"
            fields["alarmAtMs"] = try input.integer("alarmAtMs", range: RemiloIOSProjection.epoch)
        default:
            action = "CompleteDelivery"
        }
        var registrations: [String: UUID] = [:]
        var results: [[String: Any]] = []
        var count = 0
        for member in capture {
            let id = member.occurrenceID
            guard var record = state.reminders[id] else { throw IOSInputFailure("STALE_MEMBERS") }
            fields["expectedGeneration"] = member.generation
            let scheduled = try mutate(&record, kind: action, input: IOSInput(values: fields), state: &state, now: now)
            state.reminders[id] = record
            if scheduled, let registration = record.registration {
                registrations[id] = registration.systemID
                results.append(["occurrenceId": id, "generation": record.generation,
                                "targetMs": registration.targetMs, "status": "Pending"])
            }
            count += 1
        }
        if action == "CompleteDelivery" {
            return (["status": "Applied", "count": count], nil)
        }
        return (["status": "Pending", "count": count, "memberResults": results], registrations)
    }
}
