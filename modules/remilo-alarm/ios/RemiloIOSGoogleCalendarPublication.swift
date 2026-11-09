import CryptoKit
import Foundation

enum RemiloIOSGoogleCalendarPublication {
    typealias Event = RemiloIOSGoogleCalendarEvent
    typealias Failure = RemiloIOSGoogleCalendarFailure

    struct Account: Codable, Equatable, Sendable {
        let subject: String
        let clientID: String
        let connectionRevision: Int
        let accountGeneration: Int

        func matches(_ access: RemiloIOSGoogleCalendarAccess) -> Bool {
            access.clientID == clientID && access.account.subject == subject
        }
    }

    struct Local: Codable, Equatable, Sendable {
        let occurrenceID: String
        let revision: Int
        let generation: Int
    }

    enum Source: Equatable { case localOneOff, routine, recurring, imported, terminal }

    struct Request: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Account
        let local: Local
        let calendarID: String
        let eventID: String
        let fields: Event.Fields

        init(operationID: UUID, account: Account, local: Local, calendarID: String,
             reviewed fields: Event.Fields, source: Source) throws {
            guard source == .localOneOff, account.connectionRevision > 0, account.accountGeneration > 0,
                  local.revision > 0, local.generation >= 0,
                  Self.validID(account.subject, maximum: 255), Self.validID(account.clientID, maximum: 255),
                  Self.validID(local.occurrenceID, maximum: 200), Self.validID(calendarID, maximum: 4096),
                  !fields.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  fields.title.utf16.count <= 200, fields.notes.utf16.count <= 10_000 else { throw Failure.invalidInput }
            _ = try Bounds(fields.schedule)
            self.operationID = operationID
            self.account = account
            self.local = local
            self.calendarID = calendarID
            self.eventID = Self.stableID(subject: account.subject, calendarID: calendarID, occurrenceID: local.occurrenceID)
            self.fields = fields
        }

        /// Re-validate decoded captures before network use. The engine still
        /// owns the final durable authorization/checkpoint transaction.
        func validated() throws -> Request {
            let checked = try Request(operationID: operationID, account: account, local: local, calendarID: calendarID,
                                      reviewed: fields, source: .localOneOff)
            guard checked == self else { throw Failure.invalidInput }
            return checked
        }

        func fingerprint() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }

        func readbackIdentity() throws -> ReadbackIdentity {
            ReadbackIdentity(operationID: operationID, account: account, local: local, calendarID: calendarID,
                             eventID: eventID, zoneID: fields.schedule.zoneId,
                             fieldsDigest: try RemiloIOSGoogleCalendarPublication.digest(fields))
        }

        /// Android's UUID.nameUUIDFromBytes over its JSONStringer output. MD5
        /// is used only for this existing opaque identifier, never for trust.
        fileprivate static func stableID(subject: String, calendarID: String, occurrenceID: String) -> String {
            let parts = ["remilo-calendar-v1", subject, calendarID, occurrenceID].map { value in
                var encoded = "\""
                for scalar in value.unicodeScalars {
                    if [34, 47, 92].contains(scalar.value) { encoded.append("\\") }
                    encoded.unicodeScalars.append(scalar)
                }
                return encoded + "\""
            }
            let source = Data(("[" + parts.joined(separator: ",") + "]").utf8)
            var digest = Array(Insecure.MD5.hash(data: source))
            digest[6] = (digest[6] & 0x0f) | 0x30
            digest[8] = (digest[8] & 0x3f) | 0x80
            return digest.map { String(format: "%02x", $0) }.joined()
        }

        fileprivate static func validID(_ value: String, maximum: Int) -> Bool {
            (1...maximum).contains(value.utf8.count) && value != "." && value != ".."
                && value == value.trimmingCharacters(in: .whitespacesAndNewlines)
                && !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
        }
    }

    /// Retain the exact Google identity and reviewed digest without copying
    /// authored titles and notes into the operation journal.
    struct ReadbackIdentity: Codable, Equatable, Sendable {
        let operationID: UUID
        let account: Account
        let local: Local
        let calendarID: String
        let eventID: String
        let zoneID: String
        let fieldsDigest: Data

        func validate() throws {
            guard account.connectionRevision > 0, account.accountGeneration > 0, local.revision > 0, local.generation >= 0,
                  Request.validID(account.subject, maximum: 255), Request.validID(account.clientID, maximum: 255),
                  Request.validID(local.occurrenceID, maximum: 200), Request.validID(calendarID, maximum: 4096),
                  eventID == Request.stableID(subject: account.subject, calendarID: calendarID, occurrenceID: local.occurrenceID),
                  fieldsDigest.count == 32 else { throw Failure.invalidInput }
            _ = try Event.namedZone(zoneID)
        }

        func matches(_ fields: Event.Fields) throws -> Bool {
            try RemiloIOSGoogleCalendarPublication.digest(fields) == fieldsDigest
        }
    }

    private static func digest(_ fields: Event.Fields) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return Data(SHA256.hash(data: try encoder.encode(fields)))
    }

    struct Bound: Encodable, Sendable {
        let date: String?
        let dateTime: String?
        let timeZone: String?
    }

    struct Bounds: Sendable {
        let start: Bound
        let end: Bound

        init(_ schedule: Event.Schedule) throws {
            guard schedule.recurrence == nil, schedule.eventStartMs >= 0,
                  schedule.eventEndMs > schedule.eventStartMs, schedule.eventEndMs <= 253_402_300_799_999 else {
                throw Failure.invalidInput
            }
            let zone = try Event.namedZone(schedule.zoneId)
            if schedule.allDay {
                let first = String(Event.nominal(schedule.eventStartMs, zone: zone).prefix(10))
                let last = String(Event.nominal(schedule.eventEndMs, zone: zone).prefix(10))
                guard try Event.wallDay(last).timeIntervalSince(Event.wallDay(first)) == 86_400,
                      try Event.resolveNominal(first + "T00:00", zone: zone) == schedule.eventStartMs,
                      try Event.resolveNominal(last + "T00:00", zone: zone) == schedule.eventEndMs else {
                    throw Failure.invalidInput
                }
                start = Bound(date: first, dateTime: nil, timeZone: nil)
                end = Bound(date: last, dateTime: nil, timeZone: nil)
            } else {
                start = Bound(date: nil, dateTime: Event.nominal(schedule.eventStartMs, zone: Event.utc) + "Z", timeZone: schedule.zoneId)
                end = Bound(date: nil, dateTime: Event.nominal(schedule.eventEndMs, zone: Event.utc) + "Z", timeZone: schedule.zoneId)
            }
        }
    }

    struct Confirmation: Codable, Equatable, Sendable {
        let eventID: String
        let etag: String?
        let htmlLink: String?
        let remoteDiffers: Bool
    }

    enum Conflict: String, Codable, Sendable { case foreignIdentity, removed }
    enum Outcome: Sendable {
        case confirmed(Confirmation)
        case conflict(Conflict)
        case notSent(Failure)
        case rejected(Failure)
        case unconfirmed(Failure?)
    }

    static func inspect(_ lookup: RemiloIOSGoogleCalendarTransport.EventLookup, for identity: ReadbackIdentity) -> Outcome? {
        switch lookup {
        case .missing: return nil
        case .deleted: return .conflict(.removed)
        case .found(let event):
            if event.cancelled { return .conflict(.removed) }
            guard event.id == identity.eventID, let object = (try? JSONSerialization.jsonObject(with: event.json)) as? [String: Any],
                  let extended = object["extendedProperties"] as? [String: Any],
                  let properties = extended["private"] as? [String: Any],
                  properties["remiloPublication"] as? String == identity.eventID else { return .conflict(.foreignIdentity) }
            let unchanged: Bool
            if let title = object["summary"] as? String, let fields = try? Event.fields(object, calendarZone: identity.zoneID).fields {
                unchanged = (try? identity.matches(.init(title: title, notes: fields.notes, schedule: fields.schedule))) == true
            } else {
                unchanged = false
            }
            return .confirmed(Confirmation(eventID: event.id, etag: event.etag,
                                           htmlLink: calendarLink(object["htmlLink"] as? String), remoteDiffers: !unchanged))
        }
    }

    private static func calendarLink(_ value: String?) -> String? {
        guard let value, value.utf8.count <= 4096, let url = URL(string: value), url.scheme == "https",
              url.user == nil, url.password == nil, url.port == nil,
              url.host == "calendar.google.com" || (url.host == "www.google.com" && url.path.hasPrefix("/calendar/")) else { return nil }
        return value
    }
}
