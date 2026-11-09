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

    struct Discovery: Codable, Sendable {
        let id: UUID
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
