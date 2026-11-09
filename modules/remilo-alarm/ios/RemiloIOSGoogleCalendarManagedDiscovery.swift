import Foundation

/// Names and setup references identify candidates for review. Adoption requires
/// a separate live ownership check and confirmation.
enum RemiloIOSGoogleCalendarManagedDiscovery {
    typealias Record = RemiloIOSCalendarOwnedRecord
    typealias Failure = RemiloIOSGoogleCalendarFailure

    enum SavedLookup: Equatable, Sendable {
        case found(Record)
        case unavailable
        case notOwner
    }

    enum Recognition: String, Sendable {
        case bound = "Bound"
        case recognized = "Recognized"
        case nameOnly = "NameOnly"
    }

    struct Candidate: Equatable, Sendable {
        let record: Record
        let recognition: Recognition
        let failure: Failure?
    }

    struct Selection: Equatable, Sendable {
        enum Outcome: Equatable, Sendable { case incomplete, savedUnavailable, create, choose, candidate }

        let outcome: Outcome
        var candidates: [Candidate] = []
        var selected: Candidate? = nil
        var savedFailure: Failure? = nil
    }

    private static let markerHeader = "Remilo managed calendar v1\nSetup reference: "

    static func marker(_ operationID: UUID) -> String {
        markerHeader + operationID.uuidString.lowercased()
    }

    static func setupReference(_ description: String?) -> UUID? {
        guard let description, description.hasPrefix(markerHeader) else { return nil }
        let reference = String(description.dropFirst(markerHeader.count))
        guard reference.utf8.count == 36, let id = UUID(uuidString: reference),
              id.uuidString.lowercased() == reference else { return nil }
        return id
    }

    /// A lost creation response can be recovered only after seeing every page.
    /// Check uniqueness before eligibility so a copied marker cannot choose a winner.
    static func recoveredID(_ records: [Record], complete: Bool, operationID: UUID, verifiedEmail: String) -> String? {
        guard complete else { return nil }
        let matches = records.filter { $0.setupReference == operationID }
        guard matches.count == 1, let match = matches.first, eligibility(match, verifiedEmail: verifiedEmail) == nil else { return nil }
        return match.id
    }

    static func eligibility(_ record: Record, verifiedEmail: String) -> Failure? {
        guard !record.primary, !blank(record.id) else { return .notOwner }
        guard let owner = record.dataOwner, !blank(owner), !blank(verifiedEmail) else { return .ownershipUnknown }
        guard owner.compare(verifiedEmail, options: .caseInsensitive, locale: Locale(identifier: "en_US_POSIX")) == .orderedSame else {
            return .notOwner
        }
        return (try? RemiloIOSGoogleCalendarEvent.namedZone(record.zoneId)) == nil ? .invalidZone : nil
    }

    /// savedLookup is only supplied by an exact live CalendarList lookup of savedID.
    /// A page result cannot stand in for that lookup, even if it has the saved ID.
    static func select(_ records: [Record], complete: Bool, verifiedEmail: String, savedID: String? = nil,
                       savedLookup: SavedLookup? = nil, selectedID: String? = nil,
                       replacingUnavailable: Bool = false) throws -> Selection {
        guard complete else { return Selection(outcome: .incomplete) }
        guard !blank(verifiedEmail) else { throw Failure.ownershipUnknown }
        guard (savedID == nil) == (savedLookup == nil) else { throw Failure.invalidInput }

        var bound: Candidate?
        var savedFailure: Failure?
        switch savedLookup {
        case .found(let verifiedSaved):
            guard verifiedSaved.id == savedID else { throw Failure.invalidInput }
            savedFailure = eligibility(verifiedSaved, verifiedEmail: verifiedEmail)
            if savedFailure == nil { bound = Candidate(record: verifiedSaved, recognition: .bound, failure: nil) }
        case .unavailable: savedFailure = .remoteUnavailable
        case .notOwner: savedFailure = .notOwner
        case nil: break
        }
        if savedID != nil, bound == nil, !replacingUnavailable {
            return Selection(outcome: .savedUnavailable, savedFailure: savedFailure)
        }
        if replacingUnavailable, let bound {
            // A previously unavailable binding can become eligible again while a
            // replacement review is open. Re-present it instead of silently replacing it.
            return Selection(outcome: .candidate, candidates: [bound], selected: bound)
        }

        var candidates: [Candidate] = []
        if let bound { candidates.append(bound) }
        var seen = Set<String>()
        if let savedID { seen.insert(savedID) }
        for record in records.sorted(by: { ($0.name, $0.id) < ($1.name, $1.id) }) {
            let named = record.underlyingName?.trimmingCharacters(in: .whitespacesAndNewlines)
                .precomposedStringWithCanonicalMapping.lowercased() == "remilo"
            guard record.setupReference != nil || named else { continue }
            let failure = eligibility(record, verifiedEmail: verifiedEmail)
            guard failure != .notOwner, seen.insert(record.id).inserted else { continue }
            candidates.append(Candidate(record: record, recognition: record.setupReference == nil ? .nameOnly : .recognized,
                                        failure: failure))
        }

        if let selectedID {
            guard let selected = candidates.first(where: { $0.record.id == selectedID }) else { throw Failure.notFound }
            if let failure = selected.failure { throw failure }
            return Selection(outcome: .candidate, candidates: candidates, selected: selected, savedFailure: savedFailure)
        }
        if let selected = bound ?? (candidates.count == 1 && candidates[0].failure == nil ? candidates[0] : nil) {
            return Selection(outcome: .candidate, candidates: candidates, selected: selected, savedFailure: savedFailure)
        }
        return Selection(outcome: candidates.isEmpty ? .create : .choose, candidates: candidates, savedFailure: savedFailure)
    }

    private static func blank(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
