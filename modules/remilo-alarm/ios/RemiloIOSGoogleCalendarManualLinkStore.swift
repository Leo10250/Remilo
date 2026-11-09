import CryptoKit
import Foundation

/// Manual relationships live beside the other protected Calendar state.
/// Mutations are synchronous so the engine can fence its local snapshot at commit.
@MainActor
final class RemiloIOSGoogleCalendarManualLinkStore {
    typealias Source = RemiloIOSGoogleCalendarManualLink.Source
    typealias Origin = RemiloIOSGoogleCalendarManualLink.Origin
    typealias Account = RemiloIOSGoogleCalendarPublication.Account
    typealias Baseline = RemiloIOSGoogleCalendarComparison.Baseline
    typealias Failure = RemiloIOSGoogleCalendarFailure

    enum Rejection: String, Error {
        case stalePreview = "STALE_PREVIEW"
        case sourceReserved = "ALREADY_IMPORTED"
        case ineligible = "INELIGIBLE"
    }

    enum LinkState: String, Codable, Equatable, Sendable { case linked, detached }

    struct Record: Codable, Equatable, Sendable {
        let occurrenceID: String
        let source: Source
        let origin: Origin
        let revision: Int
        let state: LinkState
        let baseline: Baseline?
        let calendarName: String
        let observedAtMs: Int64?
    }

    struct Receipt: Codable, Equatable, Sendable {
        let occurrenceID: String
        let revision: Int
        let state: LinkState
    }

    private struct Reservation: Hashable {
        let subject: String
        let calendarID: String
        let eventID: String

        init(_ source: Source) {
            subject = source.subject
            calendarID = source.calendarID
            eventID = source.eventID
        }
    }

    private struct StoredReceipt: Codable {
        let subject: String
        let clientID: String
        let fingerprint: Data
        let requestDigest: Data
        let result: Receipt

        func belongs(to account: Account) -> Bool {
            account.subject == subject && account.clientID == clientID
        }
    }

    private struct State: Codable {
        var schemaVersion = 1
        var links: [String: Record] = [:]
        var receipts: [UUID: StoredReceipt] = [:]
    }

    private struct Request: Encodable {
        let state: LinkState
        let occurrenceID: String
        let expectedRevision: Int
        let source: Source?
        let origin: Origin?
        let baseline: Baseline?

        func digest() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }
    }

    private static let maximumRevision = 9_007_199_254_740_991
    private static let epoch: ClosedRange<Int64> = 0...253_402_300_799_999
    private let directory: URL
    private var file: URL { directory.appendingPathComponent("manual-links.json", isDirectory: false) }

    init(directory: URL) { self.directory = directory }

    static func local() throws -> RemiloIOSGoogleCalendarManualLinkStore {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return Self(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    func link(_ occurrenceID: String) throws -> Record? { try read().links[occurrenceID] }

    func links(viewingAs account: Account) throws -> [Record] {
        try read().links.values.filter { Self.belongs($0.source, to: account) }.sorted { $0.occurrenceID < $1.occurrenceID }
    }

    func reservedEvents(viewingAs account: Account, calendarID: String) throws -> Set<String> {
        Set(try read().links.values.compactMap { record in
            let source = record.source
            guard source.subject == account.subject, source.calendarID == calendarID else { return nil }
            return source.eventID
        })
    }

    /// A same-owner retry can recover this exact result before reopening a preview.
    func receipt(operationID: UUID, fingerprint: Data, viewingAs account: Account) throws -> Receipt? {
        guard fingerprint.count == 32 else { throw Failure.invalidInput }
        guard let saved = try read().receipts[operationID], saved.belongs(to: account) else { return nil }
        guard saved.fingerprint == fingerprint else { throw Failure.operationReused }
        return saved.result
    }

    func operation(_ id: UUID, viewingAs account: Account) throws -> Receipt? {
        guard let saved = try read().receipts[id], saved.belongs(to: account) else { return nil }
        return saved.result
    }

    /// Only the runtime's confirmed common groups may be supplied as a baseline.
    func attach(operationID: UUID, fingerprint: Data, viewingAs account: Account, occurrenceID: String,
                source: Source, origin: Origin, expectedRevision: Int, calendarName: String,
                baseline: Baseline?, observedAtMs: Int64) throws -> Receipt {
        guard Self.belongs(source, to: account) else { throw Failure.accountChanged }
        guard Self.valid(source), Self.validID(occurrenceID, maximum: 200), Self.valid(baseline),
              fingerprint.count == 32, (0..<Self.maximumRevision).contains(expectedRevision),
              calendarName.utf8.count <= 4_096, Self.epoch.contains(observedAtMs) else { throw Failure.invalidInput }
        let request = Request(state: .linked, occurrenceID: occurrenceID, expectedRevision: expectedRevision,
                              source: source, origin: origin, baseline: baseline)
        let digest = try request.digest()
        var state = try read()
        if let replay = try replay(operationID, fingerprint: fingerprint, digest: digest, account: account, in: state) { return replay }
        let previous = state.links[occurrenceID]
        guard (previous?.revision ?? 0) == expectedRevision else { throw Rejection.stalePreview }
        if let previous, previous.source != source || previous.origin != origin { throw Rejection.sourceReserved }
        let reservation = Reservation(source)
        guard !state.links.values.contains(where: { $0.occurrenceID != occurrenceID && Reservation($0.source) == reservation }) else {
            throw Rejection.sourceReserved
        }
        let record = Record(occurrenceID: occurrenceID, source: source, origin: origin, revision: expectedRevision + 1,
                            state: .linked, baseline: baseline, calendarName: calendarName, observedAtMs: observedAtMs)
        return try commit(record, operationID: operationID, fingerprint: fingerprint, digest: digest, account: account, state: &state)
    }

    func detach(operationID: UUID, fingerprint: Data, viewingAs account: Account, occurrenceID: String,
                expectedRevision: Int) throws -> Receipt {
        guard Self.validID(occurrenceID, maximum: 200), fingerprint.count == 32,
              (1..<Self.maximumRevision).contains(expectedRevision) else { throw Failure.invalidInput }
        let request = Request(state: .detached, occurrenceID: occurrenceID, expectedRevision: expectedRevision,
                              source: nil, origin: nil, baseline: nil)
        let digest = try request.digest()
        var state = try read()
        if let replay = try replay(operationID, fingerprint: fingerprint, digest: digest, account: account, in: state) { return replay }
        guard let previous = state.links[occurrenceID], Self.belongs(previous.source, to: account) else { throw Failure.notFound }
        guard previous.revision == expectedRevision else { throw Rejection.stalePreview }
        guard previous.state == .linked else { throw Rejection.ineligible }
        let record = Record(occurrenceID: occurrenceID, source: previous.source, origin: previous.origin,
                            revision: previous.revision + 1, state: .detached, baseline: nil,
                            calendarName: previous.calendarName, observedAtMs: nil)
        return try commit(record, operationID: operationID, fingerprint: fingerprint, digest: digest, account: account, state: &state)
    }

    /// The engine supplies durable purge tombstones. Keep the reservation and
    /// exact historical receipts while dropping the saved agreement and label.
    func redactPurged(_ occurrenceIDs: Set<String>) throws {
        guard !occurrenceIDs.isEmpty else { return }
        var state = try read()
        var changed = false
        for id in occurrenceIDs {
            guard let previous = state.links[id], previous.state == .linked || !previous.calendarName.isEmpty else { continue }
            guard previous.revision < Self.maximumRevision else { throw RemiloIOSGoogleCalendarStore.Failure.invalidState }
            state.links[id] = Record(occurrenceID: id, source: previous.source, origin: previous.origin,
                                     revision: previous.revision + 1, state: .detached, baseline: nil,
                                     calendarName: "", observedAtMs: nil)
            changed = true
        }
        if changed { try write(state) }
    }

    private func replay(_ operationID: UUID, fingerprint: Data, digest: Data, account: Account, in state: State) throws -> Receipt? {
        guard let saved = state.receipts[operationID] else { return nil }
        guard saved.belongs(to: account), saved.fingerprint == fingerprint, saved.requestDigest == digest else {
            throw Failure.operationReused
        }
        return saved.result
    }

    private func commit(_ record: Record, operationID: UUID, fingerprint: Data, digest: Data, account: Account,
                        state: inout State) throws -> Receipt {
        let result = Receipt(occurrenceID: record.occurrenceID, revision: record.revision, state: record.state)
        state.links[record.occurrenceID] = record
        state.receipts[operationID] = StoredReceipt(subject: account.subject, clientID: account.clientID,
                                                   fingerprint: fingerprint, requestDigest: digest, result: result)
        try write(state)
        return result
    }

    private static func belongs(_ source: Source, to account: Account) -> Bool {
        source.subject == account.subject && source.clientID == account.clientID
    }

    private static func valid(_ source: Source) -> Bool {
        validID(source.subject, maximum: 255) && validID(source.clientID, maximum: 255)
            && validID(source.calendarID, maximum: 4_096) && validID(source.eventID, maximum: 4_096)
    }

    private static func validID(_ value: String, maximum: Int) -> Bool {
        (1...maximum).contains(value.utf8.count) && value != "." && value != ".."
            && value == value.trimmingCharacters(in: .whitespacesAndNewlines)
            && !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
    }

    private static func valid(_ baseline: Baseline?) -> Bool {
        guard let baseline else { return true }
        if let title = baseline.title,
           title.isEmpty || title.utf16.count > 200 || title != title.trimmingCharacters(in: .whitespacesAndNewlines) { return false }
        if let notes = baseline.notes, notes.utf16.count > 10_000 { return false }
        if let schedule = baseline.schedule, (try? RemiloIOSGoogleCalendarPublication.Bounds(schedule)) == nil { return false }
        return true
    }

    private func read() throws -> State {
        do {
            let bytes = try Data(contentsOf: file)
            let decoder = JSONDecoder()
            guard try decoder.decode(Header.self, from: bytes).schemaVersion == 1 else {
                throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema
            }
            let state = try decoder.decode(State.self, from: bytes)
            var reservations = Set<Reservation>()
            for (id, record) in state.links {
                let observationValid: Bool
                switch record.state {
                case .linked: observationValid = record.observedAtMs.map(Self.epoch.contains) == true
                case .detached: observationValid = record.observedAtMs == nil && record.baseline == nil
                }
                guard id == record.occurrenceID, Self.validID(id, maximum: 200),
                      (1...Self.maximumRevision).contains(record.revision), Self.valid(record.source), Self.valid(record.baseline),
                      record.calendarName.utf8.count <= 4_096, observationValid, reservations.insert(Reservation(record.source)).inserted else {
                    throw RemiloIOSGoogleCalendarStore.Failure.invalidState
                }
            }
            for receipt in state.receipts.values {
                let result = receipt.result
                guard receipt.fingerprint.count == 32, receipt.requestDigest.count == 32,
                      let record = state.links[result.occurrenceID], record.source.subject == receipt.subject,
                      record.source.clientID == receipt.clientID, (1...record.revision).contains(result.revision),
                      result.revision != record.revision || result.state == record.state else {
                    throw RemiloIOSGoogleCalendarStore.Failure.invalidState
                }
            }
            return state
        } catch CocoaError.fileReadNoSuchFile { return State() }
    }

    private func write(_ state: State) throws {
        #if os(iOS)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.complete])
        var protected = directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try protected.setResourceValues(values)
        let options: Data.WritingOptions = [.atomic, .completeFileProtection]
        #else
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let options: Data.WritingOptions = .atomic
        #endif
        try JSONEncoder().encode(state).write(to: file, options: options)
    }

    private struct Header: Decodable { let schemaVersion: Int }
}
