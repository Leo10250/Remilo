import Foundation

/// The authored event fields and local version considered by a publication review.
struct IOSCalendarPublicationSnapshot: Equatable, Sendable {
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
    func calendarPublicationSnapshot(_ occurrenceID: String) throws -> IOSCalendarPublicationSnapshot {
        let state = try read()
        typealias Failure = IOSCalendarPublicationSnapshot.Failure
        guard let record = state.reminders[occurrenceID] else { throw Failure.notFound }
        guard record.active, !record.isTest, record.segmentID == nil, record.routineID == nil else {
            throw Failure.ineligible
        }
        // The engine receipt is already durable when the Calendar journal still awaits acknowledgement.
        guard !state.receipts.contains(where: { operationID, receipt in
            receipt.occurrenceID == occurrenceID && operationID.hasPrefix(Self.calendarCreatePrefix)
        }) else { throw Failure.alreadyImported }
        let zoneID = record.zoneID
        guard (zoneID.contains("/") || zoneID == "UTC" || zoneID == "GMT"
                || TimeZone.knownTimeZoneIdentifiers.contains(zoneID)), TimeZone(identifier: zoneID) != nil else {
            throw Failure.invalidZone
        }
        return IOSCalendarPublicationSnapshot(occurrenceID: record.id, revision: record.revision,
            generation: record.generation, title: record.title, notes: record.notes,
            eventStartMs: record.eventStartMs, eventEndMs: record.eventEndMs, allDay: record.allDay, zoneID: zoneID)
    }
}

#if os(iOS)
extension RemiloIOSGoogleCalendarPublicationRuntime.LocalAuthority {
    @MainActor
    static func localEngine(_ engine: RemiloIOSEngine) -> Self {
        typealias Publication = RemiloIOSGoogleCalendarPublication
        typealias LocalSnapshot = RemiloIOSGoogleCalendarPublicationRuntime.LocalSnapshot
        return Self(read: { id in
            let snapshot: IOSCalendarPublicationSnapshot
            do { snapshot = try engine.calendarPublicationSnapshot(id) }
            catch is IOSCalendarPublicationSnapshot.Failure { return nil }
            let version = Publication.Local(occurrenceID: snapshot.occurrenceID, revision: snapshot.revision,
                                            generation: snapshot.generation)
            let schedule = Publication.Event.Schedule(eventStartMs: snapshot.eventStartMs, eventEndMs: snapshot.eventEndMs,
                                                      allDay: snapshot.allDay, zoneId: snapshot.zoneID, recurrence: nil)
            return LocalSnapshot(version: version, fields: .init(title: snapshot.title, notes: snapshot.notes, schedule: schedule))
        }, permit: { snapshot, checkpoint in
            let fields = snapshot.fields
            let version = snapshot.version
            let source = IOSCalendarPublicationSnapshot(
                occurrenceID: version.occurrenceID, revision: version.revision, generation: version.generation,
                title: fields.title, notes: fields.notes, eventStartMs: fields.schedule.eventStartMs,
                eventEndMs: fields.schedule.eventEndMs, allDay: fields.schedule.allDay, zoneID: fields.schedule.zoneId
            )
            do { return try await engine.withCalendarPublicationPermit(for: source, commit: checkpoint) }
            catch IOSCalendarPublicationSnapshot.Failure.stalePreview {
                throw RemiloIOSGoogleCalendarPublicationRuntime.Rejection.stalePreview
            }
        })
    }
}
#endif
