import Foundation

/// Only the groups shared with Google participate. Callers supply fresh native
/// snapshots and an observed common baseline after checking link authority.
enum RemiloIOSGoogleCalendarComparison {
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Fields = Event.Fields

    enum Group: String, Hashable, Codable, Sendable {
        case title, notes, schedule
    }

    enum Side: String, Equatable, Codable, Sendable {
        case remilo, google
    }

    struct Baseline: Codable, Equatable, Sendable {
        var title: String?
        var notes: String?
        var schedule: Event.Schedule?
    }

    struct Result: Equatable, Sendable {
        let desired: Fields
        let inbound: Set<Group>
        let outbound: Set<Group>
        let conflicts: Set<Group>
    }

    static func compare(local: Fields, remote: Fields, baseline: Baseline?) -> Result {
        var inbound = Set<Group>()
        var outbound = Set<Group>()
        var conflicts = Set<Group>()

        func choose<Value: Equatable>(_ group: Group, local: Value, remote: Value, common: Value?) -> Value {
            if local == remote { return local }
            if let common {
                if local == common {
                    inbound.insert(group)
                    return remote
                }
                if remote == common {
                    outbound.insert(group)
                    return local
                }
            }
            conflicts.insert(group)
            return local
        }

        let title = choose(.title, local: local.title, remote: remote.title, common: baseline?.title)
        let notes = choose(.notes, local: local.notes, remote: remote.notes, common: baseline?.notes)
        let schedule = choose(.schedule, local: local.schedule, remote: remote.schedule, common: baseline?.schedule)
        return Result(desired: Fields(title: title, notes: notes, schedule: schedule),
                      inbound: inbound, outbound: outbound, conflicts: conflicts)
    }

    /// Recalculate the exact sides that need writes after every differing
    /// group has an explicit reviewed selection.
    static func resolve(local: Fields, remote: Fields, choices: [Group: Side]) -> Result? {
        let differing = differences(local, remote)
        guard differing.isSubset(of: Set(choices.keys)) else { return nil }
        let desired = Fields(
            title: choices[.title] == .google ? remote.title : local.title,
            notes: choices[.notes] == .google ? remote.notes : local.notes,
            schedule: choices[.schedule] == .google ? remote.schedule : local.schedule
        )
        return Result(desired: desired, inbound: differences(local, desired),
                      outbound: differences(remote, desired), conflicts: [])
    }

    /// An acknowledgement cannot advance an unrelated or still-divergent
    /// group. Preserve previously confirmed values for those groups.
    static func confirmedBaseline(
        previous: Baseline?, intended: Fields, observedLocal: Fields, observedRemote: Fields, groups: Set<Group>
    ) -> Baseline {
        let confirmed = groups.subtracting(differences(observedLocal, intended))
            .subtracting(differences(observedRemote, intended))
        return Baseline(
            title: confirmed.contains(.title) ? intended.title : previous?.title,
            notes: confirmed.contains(.notes) ? intended.notes : previous?.notes,
            schedule: confirmed.contains(.schedule) ? intended.schedule : previous?.schedule
        )
    }

    private static func differences(_ lhs: Fields, _ rhs: Fields) -> Set<Group> {
        var result = Set<Group>()
        if lhs.title != rhs.title { result.insert(.title) }
        if lhs.notes != rhs.notes { result.insert(.notes) }
        if lhs.schedule != rhs.schedule { result.insert(.schedule) }
        return result
    }
}
