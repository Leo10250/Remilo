import Foundation

/// The local import baseline identifies unsent work. Once a PATCH can leave
/// the device, keep its exact request until read-back or a definitive result.
@MainActor
final class RemiloIOSGoogleCalendarSeriesTextWriter {
    typealias Runtime = RemiloIOSGoogleCalendarRuntime
    typealias Import = Runtime.Import
    typealias Journal = Runtime.ImportJournal
    typealias Failure = Runtime.Failure
    typealias Writer = RemiloIOSGoogleCalendarWriteTransport
    typealias Lease = RemiloIOSGoogleCalendarManualLink.ManagedLease
    typealias Account = Import.Account

    private struct Send: Codable, Equatable, Sendable {
        let id: UUID
        let importID: UUID
        let account: Account
        let lease: Lease
        let baselineETag: String
        let source: Import.Source
        let local: IOSCalendarSeriesTextSnapshot

        func patch() throws -> Writer.Patch {
            try .init(seriesText: id, account: account, snapshot: local, source: source, lease: lease)
        }
    }

    private struct State: Codable {
        var version = 1
        var sent: [UUID: Send] = [:]
    }

    private let directory: URL
    private let connection: Runtime.Connection
    private let imports: Journal
    private let local: Runtime.SeriesTextAuthority
    private let canRead: @MainActor @Sendable () -> Bool
    private let activeLease: @MainActor @Sendable (Account) throws -> Lease?
    private var running = false
    private var readbackCursor: String?

    init(directory: URL, connection: Runtime.Connection, imports: Journal, local: Runtime.SeriesTextAuthority,
         canRead: @escaping @MainActor @Sendable () -> Bool,
         activeLease: @escaping @MainActor @Sendable (Account) throws -> Lease?) {
        self.directory = directory
        self.connection = connection
        self.imports = imports
        self.local = local
        self.canRead = canRead
        self.activeLease = activeLease
    }

    func unconfirmedImports(viewingAs account: Account) throws -> Set<UUID> {
        Set(try savedSends(viewingAs: account).map(\.importID))
    }

    func sync(expectedRevision: Int) async throws -> Bool {
        guard canRead(), !running else { return false }
        running = true
        defer { running = false }
        let account = try connection.savedAccount(expectedRevision: expectedRevision)
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var changed = false
        let pending = try savedSends(viewingAs: account)
        let start = readbackCursor.flatMap { cursor in pending.firstIndex { $0.importID.uuidString > cursor } } ?? 0
        for offset in 0..<min(pending.count, 4) {
            guard canRead(), budget.hasTimeRemaining else { break }
            let work = pending[(start + offset) % pending.count]
            readbackCursor = work.importID.uuidString
            do {
                let settled = try await advance(work, viewer: account, phase: .sent, budget: budget)
                changed = changed || settled
            } catch Failure.budget { return changed }
            catch is Failure { continue }
        }
        guard canRead(), budget.hasTimeRemaining, let lease = try activeLease(account),
              (try? connection.requireManualLinkWrite(account: account)) != nil else { return changed }
        let reserved = try read().sent
        var attempted = 0
        for binding in try await imports.seriesTextExports(viewingAs: account, lease: lease) {
            guard attempted < 4, canRead(), budget.hasTimeRemaining, try activeLease(account) == lease else { break }
            let receipt = binding.receipt
            guard reserved[receipt.operationID] == nil, let family = receipt.local?.id,
                  let snapshot = try local.read(family), binding.baseline.differs(from: snapshot) else { continue }
            attempted += 1
            let review: Import.Review
            do {
                review = try await connection.prepareImport(expectedRevision: expectedRevision, calendarID: lease.calendarID,
                    eventID: receipt.source.eventID, recurringChoices: .init(mode: .none), managedLease: lease, budget: budget,
                    canRead: { [self] in canRead() && (try? activeLease(account)) == lease })
            } catch let failure as Import.Event.Reason {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: failure.rawValue)
                changed = true
                continue
            } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: failure.rawValue)
                changed = true
                continue
            }
            guard try activeLease(account) == lease else { break }
            guard try binding.accepts(local: snapshot, review: review) else {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: nil, reason: Import.Failure.staleRemote.rawValue)
                changed = true
                continue
            }
            if snapshot.title == review.source.fields.title && snapshot.notes == review.source.fields.notes {
                try await imports.finishSeriesTextExport(receipt.operationID, lease: lease, expectedBaseline: binding.baseline.etag,
                                                         confirmed: try .init(review.source), reason: nil)
                changed = true
                continue
            }
            let work = Send(id: UUID(), importID: receipt.operationID, account: account, lease: lease,
                            baselineETag: binding.baseline.etag, source: review.source, local: snapshot)
            let settled = try await advance(work, viewer: account, phase: .notSent, budget: budget)
            changed = changed || settled
        }
        return changed
    }

    private func advance(_ work: Send, viewer: Account, phase: Writer.Phase,
                         budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> Bool {
        let patch = try work.patch()
        let outcome = try await connection.withPublicationAccess(
            captured: work.account, expectedRevision: viewer.connectionRevision, canRead: canRead
        ) { [self] writer, access in
            try await writer.patch(patch, access: access, phase: phase, budget: budget) { _ in
                try await local.permit(work.local) { [self] in
                    guard canRead(), try activeLease(work.account) == work.lease else { return .denied(.staleConnection) }
                    try connection.requireManualLinkWrite(account: work.account)
                    return try beginSend(work)
                } ?? .denied(.staleConnection)
            }
        }
        let next: Journal.SeriesTextBaseline?
        let reason: String?
        switch outcome {
        case .confirmed(let event):
            guard let etag = event.strongETag else { return false }
            let fields = Import.Event.Fields(title: work.local.title, notes: work.local.notes, schedule: work.source.fields.schedule)
            next = try .init(etag: etag, fields: fields)
            reason = nil
        case .staleRemote:
            next = nil
            reason = Import.Failure.staleRemote.rawValue
        case .remoteRemoved:
            next = nil
            reason = "REMOTE_REMOVED"
        case .rejected(let failure):
            next = nil
            reason = failure.rawValue
        case .unconfirmed, .notSent, .remoteUnavailable:
            return false
        }
        if work.account.accountGeneration == viewer.accountGeneration, try activeLease(viewer) == work.lease {
            try await imports.finishSeriesTextExport(work.importID, lease: work.lease, expectedBaseline: work.baselineETag,
                                                     confirmed: next, reason: reason)
        }
        var state = try read()
        if state.sent[work.importID] == work {
            state.sent.removeValue(forKey: work.importID)
            try write(state)
        }
        return true
    }

    private func beginSend(_ work: Send) throws -> Writer.Permission {
        var state = try read()
        if let saved = state.sent[work.importID] { return saved == work ? .alreadySent : .denied(.retry) }
        state.sent[work.importID] = work
        try write(state)
        return .granted
    }

    private var file: URL { directory.appendingPathComponent("series-text-writes.json") }

    private func savedSends(viewingAs account: Account) throws -> [Send] {
        try read().sent.values.filter { $0.account.subject == account.subject && $0.account.clientID == account.clientID }
            .sorted { $0.importID.uuidString < $1.importID.uuidString }
    }

    private func read() throws -> State {
        do {
            let state = try JSONDecoder().decode(State.self, from: Data(contentsOf: file))
            guard state.version == 1 else { throw RemiloIOSGoogleCalendarStore.Failure.unsupportedSchema }
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
}
