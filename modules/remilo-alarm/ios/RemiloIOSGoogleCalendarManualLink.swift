import Foundation

enum RemiloIOSGoogleCalendarManualLink {
    typealias Publication = RemiloIOSGoogleCalendarPublication
    typealias Comparison = RemiloIOSGoogleCalendarComparison
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Transport = RemiloIOSGoogleCalendarTransport

    enum Origin: String, Codable, Sendable { case published, imported }

    enum Failure: String, Error {
        case stalePreview = "STALE_PREVIEW"
        case staleRemote = "STALE_REMOTE"
        case ineligible = "INELIGIBLE"
        case remoteRemoved = "REMOTE_REMOVED"
        case unsupported = "UNSUPPORTED_CALENDAR_CHANGE"
        case resolutionRequired = "RESOLUTION_REQUIRED"
    }

    struct Source: Codable, Equatable, Hashable, Sendable {
        let subject: String
        let clientID: String
        let calendarID: String
        let eventID: String

        func belongs(to account: Publication.Account) -> Bool {
            subject == account.subject && clientID == account.clientID
        }
    }

    enum Evidence: Equatable, Sendable {
        case published(Publication.ReadbackIdentity)
        case imported(Source)

        var source: Source {
            switch self {
            case .published(let identity):
                return Source(subject: identity.account.subject, clientID: identity.account.clientID,
                              calendarID: identity.calendarID, eventID: identity.eventID)
            case .imported(let source): return source
            }
        }

        var origin: Origin {
            switch self {
            case .published: return .published
            case .imported: return .imported
            }
        }

        func identifies(_ event: Transport.Event) -> Bool {
            guard event.id == source.eventID, !event.cancelled else { return false }
            if case .published(let identity) = self {
                if case .confirmed = Publication.inspect(.found(event), for: identity) { return true }
                return false
            }
            return true
        }
    }

    struct Observation: Equatable, Sendable {
        let source: Source
        let etag: String
        let calendarName: String
        let fields: Event.Fields

        init(evidence: Evidence, calendar: Transport.OwnedCalendar, lookup: Transport.EventLookup) throws {
            let source = evidence.source
            guard calendar.id == source.calendarID, calendar.isOwned else { throw RemiloIOSGoogleCalendarFailure.notOwner }
            guard case .found(let event) = lookup else {
                if case .deleted = lookup { throw Failure.remoteRemoved }
                throw RemiloIOSGoogleCalendarFailure.remoteUnavailable
            }
            guard !event.cancelled else { throw Failure.remoteRemoved }
            guard evidence.identifies(event), let etag = event.strongETag else { throw Failure.staleRemote }
            guard let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any] else {
                throw RemiloIOSGoogleCalendarFailure.invalidResponse
            }
            let fields = try Event.fields(object, calendarZone: calendar.timeZone ?? "").fields
            guard fields.schedule.recurrence == nil else { throw Failure.unsupported }
            self.source = source
            self.etag = etag
            self.calendarName = try RemiloIOSCalendarOwnedRecord(calendar).name
            self.fields = fields
        }
    }

    struct Review: Equatable, Sendable {
        let id: UUID
        let account: Publication.Account
        let evidence: Evidence
        let local: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot
        let remote: Observation
        let linkRevision: Int?
        let baseline: Comparison.Baseline?
        let checkedAtMs: Int64

        func valid(at time: Int64) -> Bool {
            time >= checkedAtMs && time - checkedAtMs <= 600_000
        }

        var suggestedSelections: [Comparison.Group: Comparison.Side] {
            let comparison = Comparison.compare(local: local.fields, remote: remote.fields, baseline: baseline)
            let groups: [Comparison.Group] = [.title, .notes, .schedule]
            return Dictionary(uniqueKeysWithValues: groups.compactMap { group in
                guard !comparison.conflicts.contains(group) else { return nil }
                return (group, comparison.inbound.contains(group) ? .google : .remilo)
            })
        }

        func resolve(_ choices: [Comparison.Group: Comparison.Side]) throws -> Comparison.Result {
            guard let resolution = Comparison.resolve(local: local.fields, remote: remote.fields, choices: choices) else {
                throw Failure.resolutionRequired
            }
            return resolution
        }

        /// A no-transfer confirmation can establish a common baseline only for
        /// the exact fields observed equal in both copies.
        func commonBaseline(after observation: Observation) throws -> Comparison.Baseline {
            guard observation.source == remote.source, observation.etag == remote.etag, observation.fields == remote.fields else {
                throw Failure.staleRemote
            }
            guard local.fields == observation.fields else { throw Failure.resolutionRequired }
            return Comparison.confirmedBaseline(previous: baseline, intended: local.fields, observedLocal: local.fields,
                                                observedRemote: observation.fields, groups: [.title, .notes, .schedule])
        }
    }
}
