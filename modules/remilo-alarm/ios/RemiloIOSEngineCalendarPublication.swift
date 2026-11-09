import Foundation

/// The authored event fields and local version considered by a Calendar review.
struct IOSCalendarOneTimeSnapshot: Equatable, Sendable {
    enum Purpose: Equatable, Sendable { case publication, manualLink }

    enum Failure: String, Error {
        case notFound = "NOT_FOUND"
        case ineligible = "INELIGIBLE"
        case alreadyImported = "ALREADY_IMPORTED"
        case invalidZone = "INVALID_ZONE"
        case stalePreview = "STALE_PREVIEW"
    }

    let occurrenceID: String
    let revision: Int
    let generation: Int
    let title: String
    let notes: String
    let eventStartMs: Int64
    let eventEndMs: Int64
    let allDay: Bool
    let zoneID: String
}

extension RemiloIOSEngine {
    func calendarPublicationSnapshot(_ occurrenceID: String) throws -> IOSCalendarOneTimeSnapshot {
        try calendarOneTimeSnapshot(occurrenceID, for: .publication)
    }

    func calendarOneTimeSnapshot(_ occurrenceID: String, for purpose: IOSCalendarOneTimeSnapshot.Purpose) throws -> IOSCalendarOneTimeSnapshot {
        let state = try read()
        typealias Failure = IOSCalendarOneTimeSnapshot.Failure
        guard let record = state.reminders[occurrenceID] else { throw Failure.notFound }
        guard record.id == occurrenceID, record.revision > 0, record.generation >= 0,
              record.active, !record.isTest, record.segmentID == nil, record.routineID == nil else {
            throw Failure.ineligible
        }
        // The engine receipt is already durable when the Calendar journal still awaits acknowledgement.
        if purpose == .publication, state.receipts.contains(where: { operationID, receipt in
            receipt.occurrenceID == occurrenceID && operationID.hasPrefix(Self.calendarCreatePrefix)
        }) { throw Failure.alreadyImported }
        let zoneID = record.zoneID
        guard (zoneID.contains("/") || zoneID == "UTC" || zoneID == "GMT"
                || TimeZone.knownTimeZoneIdentifiers.contains(zoneID)), TimeZone(identifier: zoneID) != nil else {
            throw Failure.invalidZone
        }
        return IOSCalendarOneTimeSnapshot(occurrenceID: record.id, revision: record.revision,
            generation: record.generation, title: record.title, notes: record.notes,
            eventStartMs: record.eventStartMs, eventEndMs: record.eventEndMs, allDay: record.allDay, zoneID: zoneID)
    }
}

#if os(iOS)
extension IOSCalendarOneTimeSnapshot {
    init(calendar snapshot: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot) {
        let version = snapshot.version
        let fields = snapshot.fields
        self.init(occurrenceID: version.occurrenceID, revision: version.revision, generation: version.generation,
                  title: fields.title, notes: fields.notes, eventStartMs: fields.schedule.eventStartMs,
                  eventEndMs: fields.schedule.eventEndMs, allDay: fields.schedule.allDay, zoneID: fields.schedule.zoneId)
    }

    var calendarSnapshot: RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot {
        typealias Publication = RemiloIOSGoogleCalendarPublication
        let version = Publication.Local(occurrenceID: occurrenceID, revision: revision, generation: generation)
        let schedule = Publication.Event.Schedule(eventStartMs: eventStartMs, eventEndMs: eventEndMs,
                                                  allDay: allDay, zoneId: zoneID, recurrence: nil)
        return .init(version: version, fields: .init(title: title, notes: notes, schedule: schedule))
    }
}

extension RemiloIOSGoogleCalendarPublicationRuntime.LocalAuthority {
    @MainActor
    static func localEngine(_ engine: RemiloIOSEngine) -> Self {
        Self(read: { id in
            do { return try engine.calendarPublicationSnapshot(id).calendarSnapshot }
            catch is IOSCalendarOneTimeSnapshot.Failure { return nil }
        }, permit: { snapshot, checkpoint in
            let source = IOSCalendarOneTimeSnapshot(calendar: snapshot)
            do { return try await engine.withCalendarPublicationPermit(for: source, commit: checkpoint) }
            catch IOSCalendarOneTimeSnapshot.Failure.stalePreview {
                throw RemiloIOSGoogleCalendarPublicationRuntime.Rejection.stalePreview
            }
        })
    }
}

extension RemiloIOSGoogleCalendarManualLinkRuntime.LocalAuthority {
    @MainActor
    static func localEngine(_ engine: RemiloIOSEngine) -> Self {
        Self(read: { id in
            do { return try engine.calendarOneTimeSnapshot(id, for: .manualLink).calendarSnapshot }
            catch is IOSCalendarOneTimeSnapshot.Failure { return nil }
        }, permit: { snapshot, commit in
            do {
                return try await engine.withCalendarOneTimePermit(for: .init(calendar: snapshot), purpose: .manualLink, commit: commit)
            } catch IOSCalendarOneTimeSnapshot.Failure.stalePreview {
                throw RemiloIOSGoogleCalendarManualLink.Failure.stalePreview
            }
        })
    }
}
#endif
