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
        typealias Permit = @MainActor @Sendable () throws -> Bool
        let receipt: @Sendable (Import.Command) async throws -> LocalReceipt?
        let create: @Sendable (Import.Command, @escaping Permit) async throws -> LocalResult
    }

    struct Authority: Sendable {
        let current: @MainActor @Sendable (Import.Account) throws -> Bool
        let observe: @Sendable (Import.Review) async throws -> Import.Observation
        var managedCurrent: (@MainActor @Sendable (RemiloIOSGoogleCalendarManagedInbox.Permit, Import.Account) throws -> Bool)? = nil

        func scoped(to permit: RemiloIOSGoogleCalendarManagedInbox.Permit?) -> Self {
            guard let permit else { return self }
            return Self(current: { [current, managedCurrent] account in
                guard try current(account) else { return false }
                return try managedCurrent?(permit, account) ?? false
            }, observe: observe)
        }
    }

    struct ManagedWork: Sendable {
        let id: UUID
        let permit: RemiloIOSGoogleCalendarManagedInbox.Permit
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

    struct SavedOperation: Sendable {
        enum Phase: Equatable, Sendable { case waiting, checking, creating, submitted, settled }

        let operationID: UUID
        let account: Import.Account
        let source: Import.SourceKey
        let phase: Phase
        let calendarName: String?
        let title: String?
        let receipt: Receipt?

        init(receipt: Receipt) {
            self.init(operationID: receipt.operationID, account: receipt.account, source: receipt.source,
                      phase: .settled, calendarName: nil, title: nil, receipt: receipt)
        }

        fileprivate init(operationID: UUID, account: Import.Account, source: Import.SourceKey, phase: Phase,
                         calendarName: String?, title: String?, receipt: Receipt?) {
            self.operationID = operationID
            self.account = account
            self.source = source
            self.phase = phase
            self.calendarName = calendarName
            self.title = title
            self.receipt = receipt
        }
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
        var createdAtMs: Int64?
        var capture: Import.Capture?
        var submitted = false
        var receipt: Receipt?
        var managed: RemiloIOSGoogleCalendarManagedInbox.Permit?
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
        try capture(operationID: operationID, review: review, choices: choices, managed: nil)
    }

    func captureManaged(_ permit: RemiloIOSGoogleCalendarManagedInbox.Permit, review: Import.Review,
                        choices: Import.Choices) throws -> UUID {
        guard permit.source == review.source.key, permit.observation.etag == review.source.etag,
              permit.scope.binding.belongs(to: review.account), permit.scope.binding.account.accountGeneration == review.account.accountGeneration,
              choices.mode == permit.observation.importMode, choices.allDayAlarmMinutes == permit.scope.policy.allDayAlarmMinutes,
              choices.title == nil, choices.alarmAtMs == nil, choices.listID == nil,
              choices.automaticSync, !choices.disableGoogleReminders else {
            throw Failure.staleRemote
        }
        if let existing = try read().entries.first(where: {
            $0.value.managed == permit && $0.value.receipt?.errorCode != Failure.staleConnection.rawValue
        }) { return existing.key }
        let id = UUID()
        _ = try capture(operationID: id, review: review, choices: choices, managed: permit)
        return id
    }

    func pendingManaged(viewingAs account: Import.Account) throws -> [ManagedWork] {
        try read().entries.sorted {
            ($0.value.createdAtMs ?? 0, $0.key.uuidString) < ($1.value.createdAtMs ?? 0, $1.key.uuidString)
        }.compactMap { id, entry in
            guard entry.receipt == nil, let permit = entry.managed, permit.scope.binding.belongs(to: account) else { return nil }
            return ManagedWork(id: id, permit: permit)
        }
    }

    func managedPermit(_ id: UUID, viewingAs account: Import.Account) throws -> RemiloIOSGoogleCalendarManagedInbox.Permit? {
        guard let permit = try read().entries[id]?.managed, permit.scope.binding.belongs(to: account) else { return nil }
        return permit
    }

    private func capture(operationID: UUID, review: Import.Review, choices: Import.Choices,
                         managed: RemiloIOSGoogleCalendarManagedInbox.Permit?) throws -> Receipt? {
        let fingerprint = try Request(operationID: operationID, review: review, choices: choices).fingerprint()
        var state = try read()
        if let existing = state.entries[operationID] {
            guard existing.fingerprint == fingerprint, existing.managed == managed else { throw Failure.operationReused }
            return existing.receipt
        }
        for existing in state.entries.values where existing.source == review.source.key {
            if existing.receipt?.local != nil { throw Failure.alreadyImported }
            if existing.receipt == nil { throw Failure.operationPending }
        }
        let capturedAt = now()
        let capture = try Import.Capture(operationID: operationID, review: review, choices: choices, now: capturedAt)
        state.entries[operationID] = Entry(fingerprint: fingerprint, source: review.source.key, createdAtMs: capturedAt,
                                          capture: capture, managed: managed)
        try write(state)
        return nil
    }

    func account(for operationID: UUID) throws -> Import.Account? {
        let entry = try read().entries[operationID]
        return entry?.receipt?.account ?? entry?.capture?.review.account
    }

    func savedOperation(_ operationID: UUID, viewingAs viewer: Import.Account) throws -> SavedOperation? {
        guard let entry = try read().entries[operationID] else { return nil }
        return savedOperation(operationID, entry: entry, viewingAs: viewer)
    }

    func savedOperations(viewingAs viewer: Import.Account) throws -> [SavedOperation] {
        let entries = try read().entries
        let visible = entries.compactMap { operationID, entry -> (SavedOperation, Int64)? in
            guard let operation = savedOperation(operationID, entry: entry, viewingAs: viewer) else { return nil }
            return (operation, entry.createdAtMs ?? entry.capture?.review.checkedAtMs ?? 0)
        }
        return visible.sorted { lhs, rhs in
            if (lhs.0.receipt == nil) != (rhs.0.receipt == nil) { return lhs.0.receipt == nil }
            if lhs.1 != rhs.1 { return lhs.1 > rhs.1 }
            return lhs.0.operationID.uuidString < rhs.0.operationID.uuidString
        }.prefix(64).map { $0.0 }
    }

    private func savedOperation(_ operationID: UUID, entry: Entry, viewingAs viewer: Import.Account) -> SavedOperation? {
        guard let owner = entry.receipt?.account ?? entry.capture?.review.account,
              owner.subject == viewer.subject, owner.clientID == viewer.clientID else { return nil }
        if let receipt = entry.receipt { return SavedOperation(receipt: receipt) }
        guard let capture = entry.capture else { return nil }
        let phase: SavedOperation.Phase
        if running.contains(operationID) { phase = entry.submitted ? .creating : .checking }
        else { phase = entry.submitted ? .submitted : .waiting }
        return SavedOperation(operationID: operationID, account: owner, source: entry.source, phase: phase,
                              calendarName: capture.review.calendarName, title: capture.command.title, receipt: nil)
    }

    func reservedEvents(subject: String, calendarID: String) throws -> Set<String> {
        Set(try read().entries.values.compactMap { entry in
            guard entry.source.subject == subject, entry.source.calendarID == calendarID,
                  entry.receipt == nil || entry.receipt?.local != nil else { return nil }
            return entry.source.eventID
        })
    }

    func importedSource(_ occurrenceID: String, viewingAs account: Import.Account) throws -> Import.SourceKey? {
        let matches = try read().entries.values.compactMap { entry -> Import.SourceKey? in
            guard let receipt = entry.receipt, receipt.account.subject == account.subject, receipt.account.clientID == account.clientID,
                  receipt.local?.kind == .reminder, receipt.local?.id == occurrenceID else { return nil }
            return receipt.source
        }
        guard matches.count <= 1 else { throw Failure.invalidInput }
        return matches.first
    }

    func run(_ operationID: UUID, authority: Authority, scheduler: Scheduler) async throws -> Receipt {
        let state = try read()
        guard let entry = state.entries[operationID] else { throw Failure.notFound }
        let authority = authority.scoped(to: entry.managed)
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
            let observed = try await authority.observe(capture.review)
            guard capture.review.matches(observed) else { throw Failure.staleRemote }
            guard try await authority.current(capture.review.account) else { throw Failure.staleConnection }
            let revalidated = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: now())
            guard revalidated.command == capture.command else { throw Failure.operationReused }
        } catch let failure as Failure {
            return try reject(capture, code: failure.rawValue)
        } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
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
                _ = try Import.Capture(operationID: operationID, review: capture.review, choices: capture.choices, now: clock())
                return try authority.current(capture.review.account)
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
