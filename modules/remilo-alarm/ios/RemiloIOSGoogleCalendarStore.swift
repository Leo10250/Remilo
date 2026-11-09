import Foundation

enum RemiloIOSCalendarRevocation: String, Codable, Sendable {
    case notRequested, pending, revoked, unconfirmed
}

struct RemiloIOSCalendarConnectionState: Codable, Sendable {
    struct Account: Codable, Equatable, Sendable {
        let subject: String
        let email: String
        let clientID: String
    }

    struct DisconnectReceipt: Codable, Sendable {
        let expectedRevision: Int
        let revision: Int
        var revocation: RemiloIOSCalendarRevocation
    }

    struct PublicationDestination: Codable, Sendable {
        let subject: String
        let clientID: String
        let calendar: RemiloIOSCalendarOwnedRecord

        func matches(_ account: Account?) -> Bool {
            account?.subject == subject && account?.clientID == clientID
        }
    }

    struct DestinationReceipt: Codable, Sendable {
        let calendarID: String
        let expectedRevision: Int
        let revision: Int
    }

    struct Discovery: Codable, Sendable {
        enum Purpose: Codable, Equatable, Sendable { case setup, prepareCreation(UUID), recoverCreation(UUID) }

        static let currentCaptureVersion = 1
        let id: UUID
        var captureVersion: Int? = nil
        var purpose: Purpose? = nil
        var candidates: [String: RemiloIOSCalendarOwnedRecord] = [:]
        var next: RemiloIOSGoogleCalendarTransport.PageCursor?
        var complete = false
    }

    var schemaVersion = 1
    var revision = 0
    var accountGeneration = 0
    var connected = false
    var account: Account?
    var revocation: RemiloIOSCalendarRevocation = .notRequested
    var discovery: Discovery?
    var disconnectReceipts: [String: DisconnectReceipt] = [:]
    var publicationDestination: PublicationDestination?
    var destinationReceipts: [String: DestinationReceipt]?
}

/// Kept outside the alarm store, OS delivery and portable archive. Credentials
/// are represented only by the process's non-Codable access grant.
struct RemiloIOSGoogleCalendarStore: Sendable {
    enum Failure: Error { case unsupportedSchema, invalidState }

    private let directory: URL
    private var file: URL { directory.appendingPathComponent("connection.json", isDirectory: false) }

    init(directory: URL) { self.directory = directory }

    static func local() throws -> Self {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return Self(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    func read() throws -> RemiloIOSCalendarConnectionState {
        do {
            let data = try Data(contentsOf: file)
            let header = try JSONDecoder().decode(Header.self, from: data)
            guard header.schemaVersion == 1 else { throw Failure.unsupportedSchema }
            let state = try JSONDecoder().decode(RemiloIOSCalendarConnectionState.self, from: data)
            guard state.revision >= 0, state.accountGeneration >= 0, !state.connected || state.account != nil else {
                throw Failure.invalidState
            }
            if let destination = state.publicationDestination,
               !state.connected || !destination.matches(state.account) || destination.calendar.id.isEmpty {
                throw Failure.invalidState
            }
            if let discovery = state.discovery {
                guard discovery.captureVersion == nil || discovery.captureVersion == RemiloIOSCalendarConnectionState.Discovery.currentCaptureVersion,
                      (discovery.captureVersion == nil) == (discovery.purpose == nil),
                      discovery.candidates.count <= 10_000, !discovery.complete || discovery.next == nil,
                      discovery.candidates.allSatisfy({ $0.key == $0.value.id }) else { throw Failure.invalidState }
            }
            return state
        } catch CocoaError.fileReadNoSuchFile {
            return RemiloIOSCalendarConnectionState()
        }
    }

    func write(_ state: RemiloIOSCalendarConnectionState) throws {
        #if os(iOS)
        let attributes: [FileAttributeKey: Any] = [.protectionKey: FileProtectionType.complete]
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: attributes)
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
