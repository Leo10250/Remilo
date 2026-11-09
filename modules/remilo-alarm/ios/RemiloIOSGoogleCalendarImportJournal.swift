import CryptoKit
import Foundation

actor RemiloIOSGoogleCalendarImportJournal {
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias Failure = Import.Failure

    struct LocalReceipt: Codable, Equatable, Sendable {
        enum Kind: String, Codable, Sendable { case reminder, series }
        enum Status: String, Codable, Sendable {
            case applied = "Applied", scheduled = "Scheduled", blocked = "Blocked", pending = "Pending", partial = "Partial"
        }

        let id: String
        let kind: Kind
        let status: Status
        let eligibleForLink: Bool
    }

    enum LocalResult: Sendable { case acknowledged(LocalReceipt), rejected(String) }

    struct Scheduler: Sendable {
        typealias Permit = @Sendable () async throws -> Bool
        let receipt: @Sendable (Import.Command) async throws -> LocalReceipt?
        let create: @Sendable (Import.Command, Permit) async throws -> LocalResult
    }

    struct Authority: Sendable {
        let current: @Sendable (Import.Account) async throws -> Bool
        let observe: @Sendable (Import.Account, Import.SourceKey) async throws -> Import.Observation
    }

    struct Receipt: Codable, Equatable, Sendable {
        enum Suppression: String, Codable, Sendable { case none, deferredUntilLocalDelivery, requiresRemoteCheck, suspended }

        let operationID: UUID
        let source: Import.SourceKey
        let reviewedETag: String
        let account: Import.Account
        let local: LocalReceipt?
        let relationship: Import.Relationship?
        let suppression: Suppression
        let errorCode: String?
    }

    private struct Request: Encodable {
        let operationID: UUID
        let review: Import.Review
        let choices: Import.Choices

        func fingerprint() throws -> Data {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .sortedKeys
            return Data(SHA256.hash(data: try encoder.encode(self)))
        }
    }

    private struct Entry: Codable {
        let fingerprint: Data
        let source: Import.SourceKey
        var capture: Import.Capture?
        var submitted = false
        var receipt: Receipt?
    }

    private struct State: Codable {
        let schemaVersion: Int
        var entries: [UUID: Entry]

        init() {
            schemaVersion = 1
            entries = [:]
        }
    }

    private struct Header: Decodable { let schemaVersion: Int }
    private let directory: URL
    private let now: @Sendable () -> Int64
    private var running = Set<UUID>()
    private var file: URL { directory.appendingPathComponent("import-journal.json", isDirectory: false) }

    init(directory: URL, now: @escaping @Sendable () -> Int64 = { Int64((Date().timeIntervalSince1970 * 1_000).rounded()) }) {
        self.directory = directory
        self.now = now
    }

    static func local() throws -> RemiloIOSGoogleCalendarImportJournal {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
        return RemiloIOSGoogleCalendarImportJournal(directory: support.appendingPathComponent("google-calendar", isDirectory: true))
    }

    /// This capture is a consequence of confirmation, not of opening a preview.
    /// The current connection is revalidated before any new local create.
    func capture(operationID: UUID, review: Import.Review, choices: Import.Choices) throws -> Receipt? {
        let fingerprint = try Request(operationID: operationID, review: review, choices: choices).fingerprint()
        var state = try read()
        if let existing = state.entries[operationID] {
            guard existing.fingerprint == fingerprint else { throw Failure.operationReused }
            return existing.receipt
        }
        for existing in state.entries.values where existing.source == review.source.key {
            if existing.receipt?.local != nil { throw Failure.alreadyImported }
            if existing.receipt == nil { throw Failure.operationPending }
        }
        let capture = try Import.Capture(operationID: operationID, review: review, choices: choices, now: now())
        state.entries[operationID] = Entry(fingerprint: fingerprint, source: review.source.key, capture: capture)
        try write(state)
        return nil
    }

    func run(_ operationID: UUID, authority: Authority, scheduler: Scheduler) async throws -> Receipt {
        let state = try read()
        guard let entry = state.entries[operationID] else { throw Failure.notFound }
        if let receipt = entry.receipt { return receipt }
        guard let capture = entry.capture else { throw Failure.notFound }
        let fingerprint = try Request(operationID: operationID, review: capture.review, choices: capture.choices).fingerprint()
        guard fingerprint == entry.fingerprint, capture.operationID == operationID else { throw Failure.operationReused }
        guard running.insert(operationID).inserted else { throw Failure.operationPending }
        defer { running.remove(operationID) }

        // A committed scheduler receipt is authoritative even when the preview,
        // alarm time, source or connection became stale after the local commit.
        if entry.submitted, let recovered = try await scheduler.receipt(capture.command) {
            return try await acknowledge(capture, local: recovered, authority: authority, scheduler: scheduler)
        }
        do {
            guard capture.review.valid(at: now()) else { throw Failure.stalePreview }
            guard try await authority.current(capture.review.account) else { throw Failure.staleConnection }
            let observed = try await authority.observe(capture.review.account, capture.review.source.key)
            guard capture.review.matches(observed) else { throw Failure.staleRemote }
            guard try await authority.current(capture.review.account) else { throw Failure.staleConnection }
            let revalidated = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: now())
            guard revalidated.command == capture.command else { throw Failure.operationReused }
        } catch let failure as Failure {
            return try reject(capture, code: failure.rawValue)
        } catch is Import.Event.Reason {
            return try reject(capture, code: Failure.staleRemote.rawValue)
        } catch let failure as RemiloIOSGoogleCalendarFailure {
            switch failure {
            case .notFound, .notOwner: return try reject(capture, code: Failure.staleRemote.rawValue)
            case .staleConnection, .accountChanged: return try reject(capture, code: Failure.staleConnection.rawValue)
            default: throw failure
            }
        }
        try Task.checkCancellation()
        var current = try read()
        current.entries[operationID]?.submitted = true
        try write(current)
        let clock = now
        let result: LocalResult
        do {
            result = try await scheduler.create(capture.command) {
                guard try await authority.current(capture.review.account) else { return false }
                _ = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: clock())
                return true
            }
        } catch let failure as Failure {
            result = .rejected(failure.rawValue)
        }
        switch result {
        case .acknowledged(let local): return try await acknowledge(capture, local: local, authority: authority, scheduler: scheduler)
        case .rejected(let code):
            if let recovered = try await scheduler.receipt(capture.command) {
                return try await acknowledge(capture, local: recovered, authority: authority, scheduler: scheduler)
            }
            return try reject(capture, code: code)
        }
    }

    private func acknowledge(_ capture: Import.Capture, local: LocalReceipt, authority: Authority, scheduler: Scheduler) async throws -> Receipt {
        let latest = try? await scheduler.receipt(capture.command)
        let current = (try? await authority.current(capture.review.account)) == true
        let authorized = current && latest?.id == local.id && latest?.eligibleForLink == true
        let observedLocal = latest?.id == local.id ? latest ?? local : local
        let relationship: Import.Relationship = authorized ? (capture.choices.automaticSync ? .automaticRequested : .manual) : .suspended
        let suppression: Receipt.Suppression
        if !capture.choices.disableGoogleReminders { suppression = .none }
        else if !authorized { suppression = .suspended }
        else if [.blocked, .pending, .partial].contains(observedLocal.status) { suppression = .deferredUntilLocalDelivery }
        else { suppression = .requiresRemoteCheck }
        let receipt = Receipt(operationID: capture.operationID, source: capture.review.source.key,
                              reviewedETag: capture.review.source.etag, account: capture.review.account, local: observedLocal,
                              relationship: relationship, suppression: suppression, errorCode: nil)
        return try finalize(receipt)
    }

    private func reject(_ capture: Import.Capture, code: String) throws -> Receipt {
        try finalize(Receipt(operationID: capture.operationID, source: capture.review.source.key,
                             reviewedETag: capture.review.source.etag, account: capture.review.account, local: nil,
                             relationship: nil, suppression: .none, errorCode: code))
    }

    private func finalize(_ receipt: Receipt) throws -> Receipt {
        var state = try read()
        guard var entry = state.entries[receipt.operationID] else { throw Failure.notFound }
        if let confirmed = entry.receipt { return confirmed }
        entry.capture = nil // no completed preview content in the recovery journal
        entry.receipt = receipt
        state.entries[receipt.operationID] = entry
        try write(state)
        return receipt
    }

    private func read() throws -> State {
        do {
            let data = try Data(contentsOf: file)
            let decoder = JSONDecoder()
            guard try decoder.decode(Header.self, from: data).schemaVersion == 1 else {
                throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema
            }
            return try decoder.decode(State.self, from: data)
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
}
