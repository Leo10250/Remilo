/// Selects which desired occurrences get OS registrations when a delivery mode is at capacity.
enum RemiloIOSCoverage {
    struct Candidate {
        let occurrenceID: String
        let targetMs: Int64
        let rollingSourceID: String?
        let retain: Bool
    }

    static func admitted(_ candidates: [Candidate], limit: Int, now: Int64) -> Set<String> {
        let eligible = candidates.filter { $0.retain || $0.targetMs > now }.sorted {
            ($0.targetMs, $0.occurrenceID) < ($1.targetMs, $1.occurrenceID)
        }
        let retained = eligible.filter(\.retain)
        var selected = Set(retained.map(\.occurrenceID))
        var representedSources = Set(retained.compactMap(\.rollingSourceID))
        let urgentThrough = now + 86_400_000

        for candidate in eligible where candidate.rollingSourceID == nil && candidate.targetMs <= urgentThrough {
            guard selected.count < limit else { return selected }
            selected.insert(candidate.occurrenceID)
        }
        for candidate in eligible {
            guard selected.count < limit else { return selected }
            if let sourceID = candidate.rollingSourceID, representedSources.insert(sourceID).inserted {
                selected.insert(candidate.occurrenceID)
            }
        }
        for candidate in eligible {
            guard selected.count < limit else { break }
            selected.insert(candidate.occurrenceID)
        }
        return selected
    }
}
