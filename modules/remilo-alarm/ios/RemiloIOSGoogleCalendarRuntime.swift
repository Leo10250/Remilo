import CryptoKit
import Foundation
#if os(iOS)
import UIKit
#endif

/// The native foreground entry for Calendar. Connection owns credential and
/// revision serialization. The runtime owns the app's single live composition
/// and never exposes a credential, raw response, or Google page token.
@MainActor
final class RemiloIOSGoogleCalendarRuntime {
    typealias Connection = RemiloIOSGoogleCalendarConnection
    typealias Failure = RemiloIOSGoogleCalendarFailure
    typealias Import = RemiloIOSGoogleCalendarImport
    typealias ImportJournal = RemiloIOSGoogleCalendarImportJournal
    typealias Inbox = RemiloIOSGoogleCalendarManagedInbox
    nonisolated static let automaticStatusChangeKey = "calendarStatusOnly"

    enum Authorization: Equatable { case connectOrChangeAccount, reauthorizeCurrentAccount, writeOwnedEvents }

    struct SeriesTextAuthority: Sendable {
        typealias SendCheckpoint = @MainActor @Sendable () throws -> RemiloIOSGoogleCalendarWriteTransport.Permission
        typealias ResumeCheckpoint = @MainActor @Sendable () async throws -> Bool
        struct InstanceExport: Sendable {
            let read: @MainActor @Sendable (String, Int) throws -> [IOSCalendarSeriesInstanceEdit]
            let permit: @MainActor @Sendable (IOSCalendarSeriesInstanceEdit, @escaping SendCheckpoint) async throws
                -> RemiloIOSGoogleCalendarWriteTransport.Permission?
            let acknowledge: @MainActor @Sendable (
                IOSCalendarSeriesInstanceConfirmation, @escaping ImportJournal.Scheduler.Permit
            ) async throws -> IOSCalendarSeriesInstanceResult
        }
        let read: @MainActor @Sendable (String) throws -> IOSCalendarSeriesTextSnapshot?
        let apply: @MainActor @Sendable (
            String, IOSCalendarSeriesTextSnapshot, String, String, @escaping ImportJournal.Scheduler.Permit
        ) async throws -> Bool
        let permit: @MainActor @Sendable (IOSCalendarSeriesTextSnapshot, @escaping SendCheckpoint) async throws
            -> RemiloIOSGoogleCalendarWriteTransport.Permission?
        var applySchedule: (@MainActor @Sendable (
            String, IOSCalendarSeriesTextSnapshot, IOSCalendarSeriesScheduleChange, @escaping ImportJournal.Scheduler.Permit
        ) async throws -> IOSCalendarSeriesScheduleResult)? = nil
        var readForExport: (@MainActor @Sendable (String) throws -> IOSCalendarSeriesTextSnapshot?)? = nil
        var acknowledgeSchedule: (@MainActor @Sendable (
            IOSCalendarSeriesTextSnapshot, @escaping ImportJournal.Scheduler.Permit
        ) async throws -> Bool)? = nil
        var applyInstance: (@MainActor @Sendable (
            String, IOSCalendarSeriesTextSnapshot, IOSCalendarSeriesInstanceChange, @escaping ImportJournal.Scheduler.Permit
        ) async throws -> IOSCalendarSeriesInstanceResult)? = nil
        var instanceExport: InstanceExport? = nil
        var resumePermit: (@MainActor @Sendable (IOSCalendarSeriesTextSnapshot, @escaping ResumeCheckpoint) async throws -> Bool?)? = nil
    }

    private let connection: Connection
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let authorize: Connection.Authorize
    private let importJournal: ImportJournal
    private let scheduler: ImportJournal.Scheduler
    let publication: RemiloIOSGoogleCalendarPublicationRuntime?
    let manualLink: RemiloIOSGoogleCalendarManualLinkRuntime?
    let managedSetup: RemiloIOSGoogleCalendarManagedSetup?
    private let managedImportSound: @MainActor () throws -> Import.Sound
    private let seriesText: SeriesTextAuthority?
    private var seriesTextWriter: RemiloIOSGoogleCalendarSeriesTextWriter?
    private var reviews: [Import.Review] = []
    private var importingManaged = false
    private var advancingManagedSetups: Set<UUID> = []

    struct ManagedImportPass: Sendable {
        var pages = 0
        var imported = 0
        var needsReview = 0
        var linked = 0
        var updatedSeries = 0
        var resumedSeries = 0
        var continuation = false
    }

    struct SyncSummary: Sendable {
        var connected = false
        var automatic = 0
        var pending = 0
        var reminderReview = 0
        var candidateReview = 0
        var setupReview = 0
        var blocking = 0

        var review: Int { reminderReview + candidateReview + setupReview }
    }

    init(connection: Connection, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         importJournal: ImportJournal, scheduler: ImportJournal.Scheduler,
         publication: RemiloIOSGoogleCalendarPublicationRuntime? = nil,
         manualLink: RemiloIOSGoogleCalendarManualLinkRuntime? = nil,
         managedSetupJournal: RemiloIOSGoogleCalendarManagedSetupJournal? = nil,
         managedSetupFreshInstallation: @escaping @MainActor () throws -> Bool = { false },
         managedImportSound: @escaping @MainActor () throws -> Import.Sound = { .remilo },
         seriesText: SeriesTextAuthority? = nil,
         authorize: @escaping Connection.Authorize) {
        self.connection = connection
        self.canUseForeground = canUseForeground
        self.importJournal = importJournal
        self.scheduler = scheduler
        self.publication = publication
        self.manualLink = manualLink
        self.managedImportSound = managedImportSound
        self.seriesText = seriesText
        self.managedSetup = managedSetupJournal.map {
            RemiloIOSGoogleCalendarManagedSetup(connection: connection, journal: $0, canUseForeground: canUseForeground,
                                               freshInstallation: managedSetupFreshInstallation, authorize: authorize)
        }
        self.authorize = authorize
    }

    func view() async throws -> Connection.View {
        try requireForeground()
        return try connection.view()
    }

    /// A saved-status projection. No provider check, permission prompt, or
    /// sync request is performed while opening Settings or refreshing status.
    func savedSyncSummary() async throws -> SyncSummary {
        let view = try await self.view()
        guard view.connected else { return .init() }
        let account = try connection.savedAccount(expectedRevision: view.revision)
        let binding = try managedSetup?.view(expectedRevision: view.revision)
        let progress = try managedSetup?.savedIncomingProgress(expectedRevision: view.revision)
        let links = try manualLink?.savedSyncStatuses(view) ?? [:]
        var automatic = Set(links.compactMap { $0.value.automatic ? $0.key : nil })
        var pending = Set(links.compactMap { [.pending, .deferred].contains($0.value.state) ? $0.key : nil })
        var review = Set(links.compactMap { $0.value.needsReview ? $0.key : nil })
        var blocking = Set(links.compactMap { ["UnconfirmedWrite", "AccessRequired"].contains($0.value.reason) ? $0.key : nil })

        var summary = SyncSummary(connected: true)
        if let setup = managedSetup, let binding,
           let id = binding.pendingOperationID ?? binding.retiredCreationOperationID,
           let operation = try setup.operation(id, expectedRevision: view.revision) {
            let status = try setup.status(operation, connection: view, advancing: isAdvancingManagedSetup(id))
            if ["NeedsReview", "Unconfirmed", "NeedsAccess"].contains(status.stage) { summary.setupReview = 1 }
            if ["Unconfirmed", "NeedsAccess"].contains(status.stage) { summary.blocking += 1 }
        }
        let observations = progress?.pending ?? []
        summary.candidateReview = observations.filter { if case .needsReview = $0.kind { return true }; return false }.count
        if binding?.mode == .enabled { summary.pending = observations.count - summary.candidateReview }

        let outgoingLease = binding?.mode == .enabled && binding?.pendingOperationID == nil ? binding?.binding?.exportLease : nil
        var seenPublications = Set<String>()
        let publications = try publication?.operations(expectedConnectionRevision: view.revision) ?? []
        for status in publications where !status.readOnly {
            let entry = status.entry
            let id = entry.identity.local.occurrenceID
            guard entry.identity.account.accountGeneration == view.accountGeneration else { continue }
            let latest = seenPublications.insert(id).inserted
            if entry.phase == .sent {
                review.insert(id)
                blocking.insert(id)
            } else if !latest {
                continue
            } else if entry.phase == .waiting, entry.managedLease == nil || entry.managedLease == outgoingLease {
                pending.insert(id)
            } else if entry.phase == .conflict || entry.phase == .failed {
                review.insert(id)
            } else if case .needsReview? = entry.managedLink {
                review.insert(id)
            }
        }
        #if os(iOS)
        if publication != nil {
            let captured = Set(publications.map { $0.entry.identity.operationID })
            for candidate in try managedOutgoingCandidates(expectedRevision: view.revision) where !captured.contains(candidate.operationID) {
                pending.insert(candidate.occurrenceID)
            }
        }
        #endif

        if let saved = binding?.binding, let seriesText {
            let lease = try managedSetup?.activeSeriesLease(account)
            let unconfirmed = try seriesTextWriter?.unconfirmedImports(viewingAs: account) ?? []
            for item in try await importJournal.heldSeries(viewingAs: account, binding: saved) {
                let series = item.series
                guard let id = series.receipt.local?.id, let local = try (seriesText.readForExport ?? seriesText.read)(id) else { continue }
                if unconfirmed.contains(series.receipt.operationID) {
                    review.insert(id)
                    blocking.insert(id)
                } else if item.issue != nil {
                    review.insert(id)
                } else if item.priorLease == lease, view.canWriteOwnedEvents {
                    automatic.insert(id)
                    if try series.baseline.differs(from: local) || local.scheduleEdit != nil ||
                        seriesText.instanceExport?.read(id, 1).isEmpty == false { pending.insert(id) }
                }
            }
        }
        guard try connection.view().revision == view.revision, try managedSetup?.view(expectedRevision: view.revision) == binding else {
            throw Failure.staleConnection
        }
        summary.automatic = automatic.count
        summary.pending += pending.count
        summary.reminderReview = review.count
        summary.blocking += blocking.count
        return summary
    }

    func isAdvancingManagedSetup(_ operation: UUID) -> Bool {
        advancingManagedSetups.contains(operation)
    }

    func requestManagedSetupAdvance(_ operation: UUID, expectedRevision: Int, inspectRetired: Bool = false) throws {
        try requireForeground()
        guard let managedSetup else { throw Failure.invalidConfiguration }
        guard let entry = try managedSetup.operation(operation, expectedRevision: expectedRevision) else { throw Failure.notFound }
        if entry.retired {
            guard inspectRetired, entry.phase == .sent, entry.returnedCalendarID == nil else { return }
        } else {
            guard entry.phase == .captured || entry.phase == .sent else { return }
            guard try managedSetup.view(expectedRevision: expectedRevision).pendingOperationID == operation,
                  entry.account.connectionRevision == expectedRevision else { throw Failure.staleConnection }
        }
        guard advancingManagedSetups.insert(operation).inserted else { return }
        Task { @MainActor [weak self] in
            guard let self else { return }
            defer {
                advancingManagedSetups.remove(operation)
                #if os(iOS)
                NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
                #endif
            }
            if entry.retired {
                try? await managedSetup.recoverRetiredCreation(operation, expectedRevision: expectedRevision)
                return
            }
            let progress = try? await managedSetup.advance(operation, expectedRevision: expectedRevision)
            #if os(iOS)
            if case .finished(let saved)? = progress, saved.phase == .confirmed, Self.live === self {
                requestAutomaticPass(.foreground)
            }
            #else
            _ = progress
            #endif
        }
    }

    func authorizeFromUserAction(expectedRevision: Int, intent: Authorization) async throws -> Connection.View {
        try requireForeground()
        #if os(iOS)
        let previousAccountGeneration = try connection.view().accountGeneration
        #endif
        let consent: Connection.Consent
        switch intent {
        case .connectOrChangeAccount: consent = .connectOrChangeAccount
        case .reauthorizeCurrentAccount: consent = .reauthorizeCurrentAccount
        case .writeOwnedEvents: consent = .writeOwnedEvents
        }
        let view = try await connection.connectFromUserAction(
            expectedRevision: expectedRevision, consent: consent, canCommit: canUseForeground
        ) {
            [authorize, canUseForeground] subject, purpose in
            guard await canUseForeground() else { throw Failure.needsAccess }
            let access = try await authorize(subject, purpose)
            guard await canUseForeground() else { throw Failure.needsAccess }
            return access
        }
        try requireForeground()
        reviews.removeAll()
        #if os(iOS)
        if Self.live === self, view.canWriteOwnedEvents, view.accountGeneration == previousAccountGeneration {
            requestAutomaticPass(.foreground)
        }
        #endif
        return view
    }

    func disconnectFromUserAction(operationID: String, expectedRevision: Int) async throws -> Connection.DisconnectResult {
        try requireForeground()
        let disconnected = try await connection.disconnect(operationID: operationID, expectedRevision: expectedRevision)
        reviews.removeAll { $0.account.connectionRevision <= expectedRevision }
        return disconnected
    }

    func ownedCalendars(expectedRevision: Int, cursor: Connection.Cursor? = nil) async throws -> Connection.OwnedPage {
        try requireForeground()
        let page = try await connection.ownedCalendars(expectedRevision: expectedRevision, nextCursor: cursor)
        try requireForeground()
        return page
    }

    /// `until` is the exclusive civil date used by the shared Calendar DTO.
    func browseEvents(expectedRevision: Int, calendarID: String, from: String, until: String,
                      cursor: Connection.EventCursor? = nil, zone: TimeZone = .current) async throws -> Connection.EventPage {
        try requireForeground()
        let page = try await connection.browseEvents(expectedRevision: expectedRevision, calendarID: calendarID,
                                                     from: from, until: until, nextCursor: cursor, zone: zone, canRead: canUseForeground)
        try requireForeground()
        let account = try connection.account(expectedRevision: page.connectionRevision)
        let reserved = try await reservedEvents(account, calendarID: calendarID)
        try requireCurrentAccount(account)
        let rows = page.items.filter { !reserved.contains($0.eventId) }
        return Connection.EventPage(items: rows, nextCursor: page.nextCursor, connectionRevision: page.connectionRevision,
                                    calendarName: page.calendarName)
    }

    func prepareImport(expectedRevision: Int, calendarID: String, eventID: String, choices: Import.Choices) async throws -> Import.Review {
        try requireForeground()
        let review = try await connection.prepareImport(expectedRevision: expectedRevision, calendarID: calendarID,
                                                       eventID: eventID, recurringChoices: choices, canRead: canUseForeground)
        try requireForeground()
        let source = review.source.key
        let reserved = try await reservedEvents(review.account, calendarID: source.calendarID)
        try requireCurrentAccount(review.account)
        guard !reserved.contains(source.eventID) else { throw Import.Failure.alreadyImported }
        reviews.removeAll { $0.source.key == review.source.key || !$0.valid(at: review.checkedAtMs) }
        if reviews.count == 8 { reviews.removeFirst() }
        reviews.append(review)
        return review
    }

    func confirmImport(operationID: UUID, reviewID: UUID, expectedRevision: Int,
                       choices: Import.Choices) async throws -> ImportJournal.Receipt {
        try requireForeground()
        let account = try connection.account(expectedRevision: expectedRevision)
        guard let review = reviews.first(where: { $0.id == reviewID }), review.account == account else {
            throw Import.Failure.stalePreview
        }
        guard !choices.automaticSync, !choices.disableGoogleReminders else { throw Import.Failure.invalidInput }
        if try outboundAndLinkedEvents(account, calendarID: review.source.key.calendarID).contains(review.source.key.eventID) {
            throw Import.Failure.alreadyImported
        }
        let saved = try await importJournal.capture(operationID: operationID, review: review, choices: choices)
        if let saved {
            try requireCurrentAccount(account)
            return saved
        }
        return try await runImport(operationID, viewingAs: account)
    }

    func recoverImport(operationID: UUID, expectedRevision: Int) async throws -> ImportJournal.Receipt {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        guard let original = try await importJournal.account(for: operationID),
              original.subject == viewer.subject, original.clientID == viewer.clientID else { throw Import.Failure.notFound }
        try requireCurrentAccount(viewer)
        return try await runImport(operationID, viewingAs: viewer)
    }

    func savedImportOperation(_ id: UUID, expectedRevision: Int) async throws -> ImportJournal.SavedOperation? {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        let result = try await importJournal.savedOperation(id, viewingAs: viewer)
        try requireCurrentAccount(viewer)
        return result
    }

    func savedImportOperations(expectedRevision: Int) async throws -> [ImportJournal.SavedOperation] {
        try requireForeground()
        let viewer = try connection.account(expectedRevision: expectedRevision)
        let result = try await importJournal.savedOperations(viewingAs: viewer)
        try requireCurrentAccount(viewer)
        return result
    }

    /// Read a bounded collection pass, then give exact staged versions to the
    /// same native journal and scheduler used for explicit import.
    func syncManagedIncoming(expectedRevision: Int) async throws -> ManagedImportPass {
        try requireForeground()
        guard let managedSetup else { throw Failure.invalidConfiguration }
        guard !importingManaged, seriesTextWriter?.isRunning != true else { throw Import.Failure.operationPending }
        importingManaged = true
        defer { importingManaged = false }
        let account = try connection.account(expectedRevision: expectedRevision)
        guard let incomingLease = try managedSetup.activeSeriesLease(account) else { throw Failure.staleConnection }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var result = ManagedImportPass()
        var attempted = 0
        do {
            try await attachPendingManagedLinks(account: account, budget: budget, result: &result)
            for pending in try await importJournal.pendingManaged(viewingAs: account)
                where pending.permit.scope.binding.linkLease == incomingLease {
                guard attempted < 10, budget.hasTimeRemaining else {
                    result.continuation = true
                    return result
                }
                attempted += 1
                let receipt = try await runImport(pending.id, viewingAs: account, budget: budget)
                try finishManagedImport(receipt, permit: pending.permit, account: account, result: &result)
            }
            let scan = try await managedSetup.scanIncoming(expectedRevision: expectedRevision, budget: budget)
            result.pages = scan.pages
            guard !scan.continuation && scan.initialComplete else {
                result.continuation = true
                return result
            }
            try await syncResumedSeries(scope: scan.scope, account: account, setup: managedSetup, budget: budget, result: &result)
            let waitingExports = try seriesTextWriter?.unconfirmedImports(viewingAs: account) ?? []
            let recurring = try await importJournal.reconcileManagedSeries(scan, viewingAs: account, limit: 10 - attempted,
                                                                            allowTextTransfers: seriesText != nil,
                                                                            allowInstanceTransfers: seriesText?.applyInstance != nil,
                                                                            waitingExports: waitingExports)
            try requireCurrentAccount(account)
            for match in recurring {
                let permit = RemiloIOSGoogleCalendarManagedInbox.Permit(scope: scan.scope, observation: match.observation)
                let disposition: SeriesTextDisposition?
                if let work = match.textWork, let seriesText {
                    disposition = try await applyManagedSeriesText(work, authority: seriesText, setup: managedSetup,
                                                                    account: account, budget: budget)
                } else if let work = match.instanceWork, let seriesText {
                    disposition = try await applyManagedSeriesInstance(work, authority: seriesText, setup: managedSetup,
                                                                        account: account, budget: budget)
                } else {
                    disposition = nil
                }
                if let disposition {
                    switch disposition {
                    case .updated: result.updatedSeries += 1
                    case .review: result.needsReview += 1
                    case .deferred:
                        result.continuation = true
                        continue
                    case .unchanged: break
                    }
                }
                try managedSetup.finishIncoming(permit, account: account, reviewReason: nil)
                if match.recordedIssue { result.needsReview += 1 }
            }
            attempted += recurring.count
            if attempted == 10 { result.continuation = true }
            let reconciled = Set(recurring.map(\.observation.eventID))
            let reserved = try await reservedEvents(account, calendarID: scan.scope.binding.record.id)
            for approved in try managedSetup.resumedImports(account) {
                guard attempted < 10, budget.hasTimeRemaining else {
                    result.continuation = true
                    return result
                }
                attempted += 1
                try await runResumedImport(approved, scan: scan, account: account, reserved: reserved,
                                           setup: managedSetup, budget: budget, result: &result)
            }
            for observation in scan.pending where !reconciled.contains(observation.eventID) && !reserved.contains(observation.eventID)
                && scan.scope.resumedEventIDs?.contains(observation.eventID) != true {
                guard [.oneTime, .recurringMaster].contains(observation.kind) else { continue }
                guard attempted < 10, budget.hasTimeRemaining else {
                    result.continuation = true
                    return result
                }
                attempted += 1
                let permit = RemiloIOSGoogleCalendarManagedInbox.Permit(scope: scan.scope, observation: observation)
                if observation.etag == nil {
                    try managedSetup.finishIncoming(permit, account: account, reviewReason: Import.Failure.staleRemote.rawValue)
                    result.needsReview += 1
                    continue
                }
                do {
                    let canRead: @MainActor @Sendable () -> Bool = {
                        (try? managedSetup.permitsIncoming(permit, account: account)) == true
                    }
                    guard canRead() else { throw Failure.staleConnection }
                    let choices = Import.Choices(mode: observation.importMode, sound: try managedImportSound(),
                                                 allDayAlarmMinutes: scan.scope.policy.allDayAlarmMinutes)
                    let review = try await connection.prepareImport(expectedRevision: expectedRevision, calendarID: permit.source.calendarID,
                        eventID: permit.source.eventID, recurringChoices: choices, managed: permit, budget: budget, canRead: canRead)
                    guard canRead() else { throw Failure.staleConnection }
                    guard review.source.fields.schedule.recurrence != nil ||
                            review.source.fields.schedule.eventEndMs > review.checkedAtMs else {
                        try managedSetup.finishIncoming(permit, account: account, reviewReason: nil)
                        continue
                    }
                    guard try !outboundAndLinkedEvents(account, calendarID: permit.source.calendarID).contains(permit.source.eventID) else { continue }
                    let operation = try await importJournal.captureManaged(permit, review: review, choices: choices)
                    let receipt = try await runImport(operation, viewingAs: account, budget: budget)
                    try finishManagedImport(receipt, permit: permit, account: account, result: &result)
                } catch Import.Failure.alreadyImported { continue }
                catch Import.Failure.operationPending { result.continuation = true }
                catch let failure as Import.Failure {
                    try managedSetup.finishIncoming(permit, account: account, reviewReason: failure.rawValue)
                    result.needsReview += 1
                } catch let failure as Import.Event.Reason {
                    try managedSetup.finishIncoming(permit, account: account, reviewReason: failure.rawValue)
                    result.needsReview += 1
                } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
                    try managedSetup.finishIncoming(permit, account: account, reviewReason: failure.rawValue)
                    result.needsReview += 1
                }
            }
            try await attachPendingManagedLinks(account: account, budget: budget, result: &result)
        } catch Failure.budget { result.continuation = true }
        return result
    }

    private func runResumedImport(_ approved: RemiloIOSGoogleCalendarManagedSetupJournal.ResumeImport,
                                  scan: RemiloIOSGoogleCalendarManagedInbox.Progress, account: Import.Account, reserved: Set<String>,
                                  setup: RemiloIOSGoogleCalendarManagedSetup, budget: RemiloIOSGoogleCalendarHTTP.Budget,
                                  result: inout ManagedImportPass) async throws {
        let eventID = approved.observation.eventID
        if try reserved.contains(eventID) || outboundAndLinkedEvents(account, calendarID: scan.scope.binding.record.id).contains(eventID) {
            if let observed = scan.pending.first(where: { $0.eventID == eventID }) {
                try setup.finishIncoming(.init(scope: scan.scope, observation: observed), account: account, reviewReason: nil)
            }
            try setup.finishResumedImport(approved, scope: scan.scope, account: account)
            return
        }
        guard let permit = try setup.reviewedImportPermit(approved, scope: scan.scope, account: account) else {
            result.needsReview += 1
            try setup.finishResumedImport(approved, scope: scan.scope, account: account)
            return
        }
        guard approved.review.account == account else {
            try setup.finishIncoming(permit, account: account, reviewReason: Import.Failure.staleConnection.rawValue)
            try setup.finishResumedImport(approved, scope: scan.scope, account: account)
            result.needsReview += 1
            return
        }
        do {
            let id = try await importJournal.captureManaged(permit, review: approved.review, choices: approved.choices)
            let receipt = try await runImport(id, viewingAs: account, budget: budget)
            try finishManagedImport(receipt, permit: permit, account: account, result: &result)
            if receipt.errorCode == Import.Failure.staleConnection.rawValue { return }
        } catch Import.Failure.operationPending {
            result.continuation = true
            return
        } catch Import.Failure.alreadyImported {
            try setup.finishIncoming(permit, account: account, reviewReason: nil)
        } catch let failure as Import.Failure {
            try setup.finishIncoming(permit, account: account, reviewReason: failure.rawValue)
            result.needsReview += 1
        }
        try setup.finishResumedImport(approved, scope: scan.scope, account: account)
    }

    func reviewHeldIncoming(_ observations: [RemiloIOSGoogleCalendarManagedInbox.Observation],
                            scope: RemiloIOSGoogleCalendarManagedInbox.Scope, account: Import.Account) async throws
        -> [RemiloIOSGoogleCalendarManagedSetup.ResumeImportRow] {
        typealias Row = RemiloIOSGoogleCalendarManagedSetup.ResumeImportRow
        guard let managedSetup else { throw Failure.invalidConfiguration }
        let candidates = observations.filter {
            switch $0.kind {
            case .oneTime, .recurringMaster, .needsReview: return true
            case .removed, .changedInstance: return false
            }
        }
        guard candidates.count <= 500 else { throw Failure.discoveryLimit }
        let reserved = try await reservedEvents(account, calendarID: scope.binding.record.id)
        let sound = try managedImportSound()
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        let canRead: @MainActor @Sendable () -> Bool = {
            (try? managedSetup.permitsResumeRead(scope, account: account)) == true
        }
        var rows: [Row] = []
        for candidate in candidates {
            guard canRead() else { throw Failure.staleConnection }
            let itemID = "candidate:" + candidate.eventID
            if reserved.contains(candidate.eventID) {
                rows.append(.init(itemID: itemID, title: "", importMode: candidate.importMode,
                                  alertAtMs: nil, approval: nil, reason: "OperationPending"))
                continue
            }
            let choices = Import.Choices(mode: candidate.importMode, sound: sound, allDayAlarmMinutes: scope.policy.allDayAlarmMinutes)
            var title = ""
            do {
                let review = try await connection.prepareImport(expectedRevision: account.connectionRevision,
                    calendarID: scope.binding.record.id, eventID: candidate.eventID, recurringChoices: choices,
                    managedLease: scope.binding.linkLease, budget: budget, canRead: canRead)
                title = review.source.fields.title
                let recurring = review.source.fields.schedule.recurrence != nil
                guard recurring || review.source.fields.schedule.eventEndMs > review.checkedAtMs else { throw Import.Failure.alertExpired }
                let preflight = try Import.Capture(operationID: UUID(), review: review, choices: choices, now: review.checkedAtMs)
                let observation = RemiloIOSGoogleCalendarManagedInbox.Observation(eventID: candidate.eventID, etag: review.source.etag,
                    kind: recurring ? .recurringMaster : .oneTime, importMode: candidate.importMode, initialRecovery: candidate.initialRecovery)
                rows.append(.init(itemID: itemID, title: title, importMode: candidate.importMode,
                    alertAtMs: recurring || choices.mode == .none ? nil : preflight.command.alarmAtMs,
                    approval: .init(observation: observation, review: review, choices: choices), reason: nil))
            } catch let failure as Import.Failure {
                rows.append(.init(itemID: itemID, title: title, importMode: candidate.importMode, alertAtMs: nil,
                                  approval: nil, reason: failure == .alertExpired ? "ElapsedAlert" : "ReviewRequired"))
            } catch is Import.Event.Reason {
                rows.append(.init(itemID: itemID, title: title, importMode: candidate.importMode,
                                  alertAtMs: nil, approval: nil, reason: "Unsupported"))
            } catch is RemiloIOSGoogleCalendarRecurringReview.Failure {
                rows.append(.init(itemID: itemID, title: title, importMode: candidate.importMode,
                                  alertAtMs: nil, approval: nil, reason: "Unsupported"))
            }
        }
        return rows
    }

    private struct SeriesResumeSnapshot: Encodable, Sendable {
        let saved: ImportJournal.SeriesTextExport
        let local: IOSCalendarSeriesTextSnapshot
        let instanceEdits: [IOSCalendarSeriesInstanceEdit]
        let remote: Import.Source
        let exceptions: [RemiloIOSGoogleCalendarRecurringReview.Exception]
    }

    func reviewHeldSeries(_ scope: Inbox.Scope, account: Import.Account) async throws -> [RemiloIOSGoogleCalendarManagedSetup.ResumeSeriesRow] {
        guard let managedSetup, let authority = seriesText, authority.resumePermit != nil else { return [] }
        let candidates = try await importJournal.heldSeries(viewingAs: account, binding: scope.binding)
        guard candidates.count <= 500 else { throw Failure.discoveryLimit }
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        let canRead: @MainActor @Sendable () -> Bool = {
            (try? managedSetup.permitsResumeRead(scope, account: account)) == true
        }
        var rows: [RemiloIOSGoogleCalendarManagedSetup.ResumeSeriesRow] = []
        for candidate in candidates {
            guard let id = candidate.series.receipt.local?.id,
                  let local = try (authority.readForExport ?? authority.read)(id) else { continue }
            do {
                let (approval, snapshot, fields) = try await inspectHeldSeries(candidate, scope: scope, account: account,
                    authority: authority, budget: budget, canRead: canRead)
                let inbound = fields.filter { !$0.outbound }.map(\.name)
                var outbound = fields.filter(\.outbound).map(\.name)
                if !snapshot.instanceEdits.isEmpty, !outbound.contains("schedule") { outbound.append("schedule") }
                rows.append(.init(familyID: id, title: local.title, approval: approval, reason: nil, inbound: inbound, outbound: outbound))
            } catch {
                guard let reason = Self.seriesResumeReason(error) else { throw error }
                rows.append(.init(familyID: id, title: local.title, approval: nil, reason: reason))
            }
        }
        return rows
    }

    func validateHeldSeries(_ approval: Inbox.Journal.ResumeSeries, scope: Inbox.Scope, account: Import.Account,
                            budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws {
        guard let managedSetup, let authority = seriesText else { throw Failure.invalidConfiguration }
        let candidate = try await importJournal.seriesForResume(approval, account: account)
        let (current, _, _) = try await inspectHeldSeries(candidate, scope: scope, account: account, authority: authority,
            budget: budget, canRead: { (try? managedSetup.permitsResumeRead(scope, account: account)) == true })
        guard current == approval else { throw Import.Failure.stalePreview }
    }

    private func inspectHeldSeries(_ candidate: ImportJournal.SeriesResumeCandidate, scope: Inbox.Scope, account: Import.Account,
                                   authority: SeriesTextAuthority, budget: RemiloIOSGoogleCalendarHTTP.Budget,
                                   canRead: @escaping @MainActor @Sendable () -> Bool) async throws
        -> (Inbox.Journal.ResumeSeries, SeriesResumeSnapshot, [(name: String, outbound: Bool)]) {
        let saved = candidate.series
        let receipt = saved.receipt
        if candidate.issue != nil { throw Import.Failure.recurrenceReviewRequired }
        let read = authority.readForExport ?? authority.read
        guard canRead(), let id = receipt.local?.id, let local = try read(id) else { throw Import.Failure.stalePreview }
        try requireSettledSeries(receipt.operationID, account: account)
        let edits = try authority.instanceExport?.read(id, 501) ?? []
        guard edits.count <= 500 else { throw Failure.discoveryLimit }
        let review = try await connection.prepareImport(expectedRevision: account.connectionRevision, calendarID: receipt.source.calendarID,
            eventID: receipt.source.eventID, recurringChoices: .init(mode: .none),
            managedLease: scope.binding.linkLease, budget: budget, canRead: canRead)
        try requireSettledSeries(receipt.operationID, account: account)
        guard canRead(), try read(id) == local, try (authority.instanceExport?.read(id, 501) ?? []) == edits,
              review.source.key == receipt.source, let recurrence = review.recurrenceEvidence else { throw Import.Failure.stalePreview }
        let remote = review.source
        let observation = Inbox.Observation(eventID: receipt.source.eventID, etag: remote.etag, kind: .recurringMaster,
                                            importMode: .none, initialRecovery: false)
        let inbound = ImportJournal.SeriesTextWork(receipt: receipt, permit: .init(scope: scope, observation: observation),
                                                  baseline: saved.baseline, exceptions: saved.exceptions)
        let schedule = try local.scheduleEdit.map { try RemiloIOSGoogleCalendarRule.schedule($0.current) }
        let exportScheduleAllowed = schedule == nil || (authority.acknowledgeSchedule != nil &&
            schedule.map { !$0.allDay || $0.zoneId == scope.binding.record.zoneId } == true)
        let send = try (saved.baseline.differs(from: local) || schedule != nil) && exportScheduleAllowed &&
            saved.accepts(local: local, review: review, desiredSchedule: schedule)
        let receivesSchedule = try saved.baseline.scheduleDiffers(from: remote)
        let receive = try schedule == nil && inbound.accepts(local: local, review: review,
            allowSchedule: authority.applySchedule != nil && edits.isEmpty)
        guard send || receive else { throw Import.Failure.recurrenceReviewRequired }
        var fields: [(name: String, outbound: Bool)] = []
        if local.title != remote.fields.title { fields.append(("title", send)) }
        if local.notes != remote.fields.notes { fields.append(("notes", send)) }
        if send ? schedule.map({ $0 != remote.fields.schedule }) == true : receivesSchedule {
            fields.append(("schedule", send))
        }
        let snapshot = SeriesResumeSnapshot(saved: saved, local: local, instanceEdits: edits, remote: remote, exceptions: recurrence.exceptions)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let digest = Data(SHA256.hash(data: try encoder.encode(snapshot)))
        return (.init(importID: receipt.operationID, familyID: id, source: receipt.source, priorLease: candidate.priorLease,
                      observation: observation, digest: digest), snapshot, fields)
    }

    private func syncResumedSeries(scope: Inbox.Scope, account: Import.Account, setup: RemiloIOSGoogleCalendarManagedSetup,
                                   budget: RemiloIOSGoogleCalendarHTTP.Budget, result: inout ManagedImportPass) async throws {
        guard let authority = seriesText, let permit = authority.resumePermit else { return }
        let lease = scope.binding.linkLease
        for approval in try setup.resumedSeries(account) {
            let current: ImportJournal.Scheduler.Permit = { try setup.permitsResumedSeries(approval, lease: lease, account: account) }
            guard try current() else { throw Failure.staleConnection }
            guard budget.hasTimeRemaining else { throw Failure.budget }
            if try await importJournal.didResumeSeries(approval, lease: lease) {
                try setup.finishResumedSeries(approval, lease: lease, account: account)
                continue
            }
            try connection.requireManualLinkWrite(account: account)
            do {
                let candidate = try await importJournal.seriesForResume(approval, account: account)
                let (checked, snapshot, _) = try await inspectHeldSeries(candidate, scope: scope, account: account, authority: authority,
                    budget: budget, canRead: { (try? current()) == true })
                guard checked == approval else { throw Import.Failure.stalePreview }
                let resumed = try await permit(snapshot.local) { [self] in
                    guard try (authority.instanceExport?.read(approval.familyID, 501) ?? []) == snapshot.instanceEdits else {
                        throw Import.Failure.stalePreview
                    }
                    try requireSettledSeries(approval.importID, account: account)
                    try connection.requireManualLinkWrite(account: account)
                    return try await importJournal.resumeSeries(candidate, proof: approval, lease: lease, authorize: current)
                }
                guard resumed == true else { throw Import.Failure.stalePreview }
                result.resumedSeries += 1
            } catch {
                guard try current(), Self.seriesResumeReason(error) != nil else { throw error }
                result.needsReview += 1
            }
            try setup.finishResumedSeries(approval, lease: lease, account: account)
        }
    }

    private func requireSettledSeries(_ id: UUID, account: Import.Account) throws {
        if try seriesTextWriter?.unconfirmedImports(viewingAs: account).contains(id) == true { throw Import.Failure.operationPending }
    }

    private static func seriesResumeReason(_ error: Error) -> String? {
        if let failure = error as? Import.Failure { return failure.rawValue }
        if let failure = error as? Import.Event.Reason { return failure.rawValue }
        if let failure = error as? RemiloIOSGoogleCalendarRecurringReview.Failure { return failure.rawValue }
        if let failure = error as? Failure, [.notOwner, .notFound, .remoteUnavailable, .forbidden].contains(failure) { return failure.rawValue }
        return nil
    }

    private enum SeriesTextDisposition { case updated, unchanged, review, deferred }

    private func applyManagedSeriesInstance(_ work: ImportJournal.SeriesInstanceWork, authority: SeriesTextAuthority,
                                            setup: RemiloIOSGoogleCalendarManagedSetup, account: Import.Account,
                                            budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> SeriesTextDisposition {
        let current: ImportJournal.Scheduler.Permit = { [canUseForeground] in
            guard canUseForeground() else { return false }
            return try setup.permitsIncomingInstance(work.permit, account: account)
        }
        guard let apply = authority.applyInstance, try current(), try await importJournal.permitsSeriesInstance(work) else {
            return .deferred
        }
        let observation: (identity: Import.Event.InstanceIdentity, fields: Import.Event.Fields, masterTitle: String)
        do {
            observation = try await connection.observeManagedInstance(work, account: account, budget: budget,
                                                                       canRead: { (try? current()) == true })
        } catch let failure as Import.Failure {
            guard try current() else { return .deferred }
            try await importJournal.finishSeriesInstance(work, confirmed: nil, reason: failure.rawValue)
            return .review
        } catch let failure as Import.Event.Reason {
            guard try current() else { return .deferred }
            try await importJournal.finishSeriesInstance(work, confirmed: nil, reason: failure.rawValue)
            return .review
        }
        guard try current(), try await importJournal.permitsSeriesInstance(work) else { return .deferred }
        guard let familyID = work.receipt.local?.id, let snapshot = try authority.read(familyID) else {
            try await importJournal.finishSeriesInstance(work, confirmed: nil, reason: Import.Failure.staleRemote.rawValue)
            return .review
        }
        let fields = observation.fields
        let schedule = fields.schedule
        let change = IOSCalendarSeriesInstanceChange(eventID: observation.identity.eventID, nominalSlot: observation.identity.nominalSlot,
            previouslyImported: work.known.contains { $0.identity == observation.identity },
            title: fields.title.isEmpty ? observation.masterTitle : fields.title, notes: fields.notes,
            eventStartMs: schedule.eventStartMs, eventEndMs: schedule.eventEndMs, allDay: schedule.allDay, zoneID: schedule.zoneId)
        let result = try await apply(work.operationKey, snapshot, change, current)
        guard try current() else { return .deferred }
        switch result {
        case .deferred: return .deferred
        case .applied, .ignored:
            try await importJournal.finishSeriesInstance(work, confirmed: observation.identity, reason: nil)
            return result == .applied ? .updated : .unchanged
        case .needsReview, .elapsedAlert:
            let reason = result == .elapsedAlert ? Import.Failure.alertExpired.rawValue : Import.Failure.staleRemote.rawValue
            try await importJournal.finishSeriesInstance(work, confirmed: nil, reason: reason)
            return .review
        }
    }

    private func applyManagedSeriesText(_ work: ImportJournal.SeriesTextWork, authority: SeriesTextAuthority,
                                        setup: RemiloIOSGoogleCalendarManagedSetup, account: Import.Account,
                                        budget: RemiloIOSGoogleCalendarHTTP.Budget) async throws -> SeriesTextDisposition {
        let permit = work.permit
        let current: ImportJournal.Scheduler.Permit = { [canUseForeground] in
            guard canUseForeground() else { return false }
            return try setup.permitsIncoming(permit, account: account)
        }
        guard try current() else { return .deferred }
        let review: Import.Review
        do {
            review = try await connection.prepareImport(expectedRevision: account.connectionRevision, calendarID: permit.source.calendarID,
                eventID: permit.source.eventID, recurringChoices: .init(mode: .none), managed: permit, budget: budget,
                canRead: { (try? current()) == true })
            let observation = try await connection.observeImport(review, managed: permit, budget: budget,
                                                                  canRead: { (try? current()) == true })
            guard review.matches(observation) else { throw Import.Failure.staleRemote }
        } catch let failure as Import.Failure {
            guard try current() else { return .deferred }
            try await importJournal.finishSeriesText(work, confirmed: nil, reason: failure.rawValue)
            return .review
        } catch let failure as RemiloIOSGoogleCalendarRecurringReview.Failure {
            guard try current() else { return .deferred }
            try await importJournal.finishSeriesText(work, confirmed: nil, reason: failure.rawValue)
            return .review
        } catch let failure as Import.Event.Reason {
            guard try current() else { return .deferred }
            try await importJournal.finishSeriesText(work, confirmed: nil, reason: failure.rawValue)
            return .review
        }
        guard try current() else { return .deferred }
        guard let segmentID = work.receipt.local?.id, let local = try authority.read(segmentID),
              try work.accepts(local: local, review: review, allowSchedule: authority.applySchedule != nil) else {
            try await importJournal.finishSeriesText(work, confirmed: nil, reason: Import.Failure.staleRemote.rawValue)
            return .review
        }
        let fields = review.source.fields
        if let change = try work.scheduleChange(for: review), let apply = authority.applySchedule {
            let outcome = try await apply(work.operationKey, local, change, current)
            switch outcome {
            case .deferred: return .deferred
            case .needsReview, .elapsedAlert:
                guard try current() else { return .deferred }
                let reason = outcome == .elapsedAlert ? Import.Failure.alertExpired.rawValue : Import.Failure.staleRemote.rawValue
                try await importJournal.finishSeriesText(work, confirmed: nil, reason: reason)
                return .review
            case .applied:
                guard try current() else { return .deferred }
                try await importJournal.finishSeriesText(work, confirmed: review, reason: nil)
                return .updated
            }
        }
        let changed = local.title != fields.title || local.notes != fields.notes
        guard try await authority.apply(work.operationKey, local, fields.title, fields.notes, current), try current() else {
            return .deferred
        }
        try await importJournal.finishSeriesText(work, confirmed: review, reason: nil)
        return changed ? .updated : .unchanged
    }

    private func attachPendingManagedLinks(account: Import.Account, budget: RemiloIOSGoogleCalendarHTTP.Budget,
                                           result: inout ManagedImportPass) async throws {
        guard let manualLink else { return }
        let work = try await importJournal.pendingManagedLinks(viewingAs: account)
        for item in work.prefix(10) {
            try requireCurrentAccount(account)
            guard budget.hasTimeRemaining else { throw Failure.budget }
            guard try managedSetup?.activeSeriesLease(account) == item.permit.scope.binding.linkLease else { continue }
            let reason: String?
            do {
                try await manualLink.attachManagedImport(item, expectedConnectionRevision: account.connectionRevision, budget: budget)
                result.linked += 1
                reason = nil
            } catch let error as ManualLinkFailure {
                reason = error.rawValue
            } catch let error as RemiloIOSGoogleCalendarManualLinkStore.Rejection {
                reason = error.rawValue
            } catch let error as Failure where [.notOwner, .ownershipUnknown, .notFound, .remoteUnavailable, .invalidZone].contains(error) {
                reason = error.rawValue
            }
            try requireCurrentAccount(account)
            if reason != nil, try managedSetup?.heldBinding(account)?.linkLease == item.permit.scope.binding.linkLease { continue }
            try await importJournal.finishManagedLink(item, reason: reason)
            if reason != nil { result.needsReview += 1 }
        }
        if work.count > 10 { result.continuation = true }
    }

    private typealias ManualLinkFailure = RemiloIOSGoogleCalendarManualLink.Failure

    private func finishManagedImport(_ receipt: ImportJournal.Receipt, permit: RemiloIOSGoogleCalendarManagedInbox.Permit,
                                     account: Import.Account, result: inout ManagedImportPass) throws {
        if receipt.local != nil { result.imported += 1 }
        if receipt.errorCode == Import.Failure.staleConnection.rawValue {
            result.continuation = true
            return
        }
        if receipt.errorCode != nil { result.needsReview += 1 }
        try managedSetup?.finishIncoming(permit, account: account, reviewReason: receipt.errorCode)
    }

    private func runImport(_ operationID: UUID, viewingAs viewer: Import.Account,
                           budget: RemiloIOSGoogleCalendarHTTP.Budget = .init()) async throws -> ImportJournal.Receipt {
        let permit = try await importJournal.managedPermit(operationID, viewingAs: viewer)
        let managedCurrent: @MainActor @Sendable (RemiloIOSGoogleCalendarManagedInbox.Permit, Import.Account) throws -> Bool = {
            [managedSetup] permit, account in
            try managedSetup?.permitsIncoming(permit, account: account) ?? false
        }
        let authority = ImportJournal.Authority(current: { [connection, canUseForeground] captured in
            guard canUseForeground() else { return false }
            return try connection.isCurrentAccount(captured)
        }, observe: { [connection, canUseForeground] review in
            try await connection.observeImport(review, managed: permit, budget: budget, canRead: {
                guard canUseForeground() else { return false }
                if let permit { return (try? managedCurrent(permit, review.account)) == true }
                return true
            })
        }, managedCurrent: managedCurrent, managedHeld: { [managedSetup] permit, account in
            try managedSetup?.heldBinding(account)?.linkLease == permit.scope.binding.linkLease
        })
        let receipt = try await importJournal.run(operationID, authority: authority, scheduler: scheduler)
        try requireCurrentAccount(viewer)
        return receipt
    }

    private func requireCurrentAccount(_ account: Import.Account) throws {
        try requireForeground()
        guard try connection.isCurrentAccount(account) else { throw Failure.staleConnection }
    }

    private func reservedEvents(_ account: Import.Account, calendarID: String) async throws -> Set<String> {
        let imported = try await importJournal.reservedEvents(subject: account.subject, calendarID: calendarID)
        return try imported.union(outboundAndLinkedEvents(account, calendarID: calendarID))
    }

    private func outboundAndLinkedEvents(_ account: Import.Account, calendarID: String) throws -> Set<String> {
        let outgoing = try publication?.reservedEvents(viewingAs: account, calendarID: calendarID) ?? []
        let linked = try manualLink?.reservedEvents(viewingAs: account, calendarID: calendarID) ?? []
        return outgoing.union(linked)
    }

    private func requireForeground() throws {
        guard canUseForeground() else { throw Failure.needsAccess }
    }

    #if os(iOS)
    private typealias Manual = RemiloIOSGoogleCalendarManualLinkRuntime

    private enum AutomaticOpportunity: Equatable { case foreground, localChange }

    private struct AutomaticLocalVersion {
        let activationRevision: Int
        let localRevision: Int
        let generation: Int
        let deliveryState: String

        init(activationRevision: Int, local: IOSReminder) {
            self.activationRevision = activationRevision
            localRevision = local.revision
            generation = local.generation
            deliveryState = local.deliveryState
        }

        func covers(_ consent: Manual.Store.AutomaticConsent, local: IOSReminder) -> Bool {
            guard activationRevision == consent.activationRevision, localRevision == local.revision else { return false }
            return consent.issue != .ringing || (generation == local.generation && deliveryState == local.deliveryState)
        }
    }

    private static var live: RemiloIOSGoogleCalendarRuntime?
    private static var automaticObservers: [NSObjectProtocol] = []
    private static let automaticBudget = 4
    private var automaticWork: Task<Void, Never>?
    private var requestedAutomaticPass: AutomaticOpportunity?
    private var automaticAccountGeneration: Int?
    private var automaticCursor: String?
    private var automaticLocalVersions: [String: AutomaticLocalVersion] = [:]

    /// Observe application opportunities independently of the Calendar screen and delivery worker.
    static func installAutomaticForegroundCoordinator() {
        guard automaticObservers.isEmpty, RemiloIOSGoogleCalendarConfiguration() != nil else { return }
        let center = NotificationCenter.default
        for name in [UIApplication.didBecomeActiveNotification, UIScene.didActivateNotification,
                     UIApplication.protectedDataDidBecomeAvailableNotification] {
            automaticObservers.append(center.addObserver(forName: name, object: nil, queue: nil) { _ in
                Task { @MainActor in
                    guard Self.isAutomaticForeground, let runtime = try? Self.configuredForegroundRuntime() else { return }
                    runtime.requestAutomaticPass(.foreground)
                }
            })
        }
        for name in [UIApplication.willResignActiveNotification, UIScene.willDeactivateNotification,
                     UIApplication.protectedDataWillBecomeUnavailableNotification] {
            automaticObservers.append(center.addObserver(forName: name, object: nil, queue: .main) { _ in
                MainActor.assumeIsolated {
                    Self.live?.requestedAutomaticPass = nil
                    Self.live?.automaticWork?.cancel()
                }
            })
        }
        automaticObservers.append(center.addObserver(forName: .remiloIOSChange, object: nil, queue: nil) { notification in
            guard notification.userInfo?[Self.automaticStatusChangeKey] as? Bool != true else { return }
            Task { @MainActor in Self.live?.requestAutomaticPass(.localChange) }
        })
    }

    private static var isAutomaticForeground: Bool {
        UIApplication.shared.applicationState == .active && foregroundWindow() != nil
    }

    private func requestAutomaticPass(_ opportunity: AutomaticOpportunity) {
        guard Self.isAutomaticForeground else { return }
        if requestedAutomaticPass != .foreground { requestedAutomaticPass = opportunity }
        guard automaticWork == nil else { return }
        automaticWork = Task { [weak self] in
            guard let self else { return }
            await drainAutomaticPasses()
        }
    }

    private func drainAutomaticPasses() async {
        defer {
            automaticWork = nil
            if let queued = requestedAutomaticPass { requestAutomaticPass(queued) }
        }
        while !Task.isCancelled, Self.isAutomaticForeground, requestedAutomaticPass != nil {
            // An activation and its protected-data notification can describe the same transition.
            try? await Task.sleep(for: .milliseconds(150))
            guard !Task.isCancelled, Self.isAutomaticForeground, let opportunity = requestedAutomaticPass else { return }
            requestedAutomaticPass = nil
            await runAutomaticPass(opportunity)
        }
    }

    private func runAutomaticPass(_ opportunity: AutomaticOpportunity) async {
        guard let view = try? connection.view(), view.connected else { return }
        try? await syncManagedOutgoing(expectedRevision: view.revision)
        if !importingManaged, (try? await seriesTextWriter?.sync(expectedRevision: view.revision)) == true {
            NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
        }
        // Resolve outbound identities first so a just-published event is
        // reserved before the incoming scan can discover it.
        if opportunity == .foreground, Self.isAutomaticForeground,
           (try? managedSetup?.hasActiveIncomingBinding(expectedRevision: view.revision)) == true,
           let result = try? await syncManagedIncoming(expectedRevision: view.revision),
           result.imported > 0 || result.linked > 0 || result.updatedSeries > 0 || result.needsReview > 0 || result.resumedSeries > 0 {
            NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
            if result.resumedSeries > 0 { requestAutomaticPass(.localChange) }
        }
        guard let manualLink, view.canWriteOwnedEvents else { return }
        let inspectUnchanged = opportunity == .foreground
        if inspectUnchanged {
            if (try? await managedSetup?.syncResumedLinks(manualLink, expectedRevision: view.revision)) == true {
                NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
            }
            try? manualLink.resumeAssociationRequests(expectedConnectionRevision: view.revision, limit: 2)
        }
        guard let candidates = try? manualLink.automaticCandidates(expectedConnectionRevision: view.revision,
                                                                    inspectUnchanged: inspectUnchanged),
              let local = try? RemiloIOSEngine.shared.read() else { return }
        if automaticAccountGeneration != view.accountGeneration {
            automaticAccountGeneration = view.accountGeneration
            automaticCursor = nil
            automaticLocalVersions.removeAll()
        }
        automaticLocalVersions = automaticLocalVersions.filter { local.reminders[$0.key]?.active == true }
        var eligible: [Manual.Store.Record] = []
        for record in candidates {
            let id = record.occurrenceID
            guard let consent = record.automatic, let reminder = local.reminders[id] else { continue }
            if inspectUnchanged || automaticLocalVersions[id]?.covers(consent, local: reminder) != true {
                eligible.append(record)
            }
            // An inbound write must not make a dirty candidate beyond the batch look newly edited.
            automaticLocalVersions[id] = AutomaticLocalVersion(activationRevision: consent.activationRevision, local: reminder)
        }
        guard !eligible.isEmpty else { return }
        let start = automaticCursor.flatMap { cursor in eligible.firstIndex { $0.occurrenceID > cursor } } ?? 0
        let batch = (0..<min(eligible.count, Self.automaticBudget)).map { eligible[(start + $0) % eligible.count] }
        let ids = Set(batch.map(\.occurrenceID))
        guard let before = try? automaticOperations(manualLink, ids: ids, revision: view.revision) else { return }

        for record in batch {
            guard !Task.isCancelled, Self.isAutomaticForeground,
                  let current = try? connection.view(), current.revision == view.revision, current.canWriteOwnedEvents else { break }
            let id = record.occurrenceID
            guard let consent = record.automatic,
                  let reminder = try? RemiloIOSEngine.shared.read().reminders[id], reminder.active else { continue }
            automaticCursor = id
            automaticLocalVersions[id] = AutomaticLocalVersion(activationRevision: consent.activationRevision, local: reminder)
            _ = try? await manualLink.syncAutomatic(id, expectedConnectionRevision: view.revision,
                                                    expectedLinkRevision: record.revision,
                                                    expectedActivationRevision: consent.activationRevision,
                                                    inspectUnchanged: inspectUnchanged)
        }

        guard Self.isAutomaticForeground,
              let after = try? automaticOperations(manualLink, ids: ids, revision: view.revision),
              let links = try? manualLink.links(expectedConnectionRevision: view.revision).filter({ ids.contains($0.occurrenceID) }) else { return }
        for operation in after where operation.localApplied {
            // The engine also emits a change for an inbound edit. Remember that exact revision
            // while its operation is pending so it cannot turn into a new local opportunity.
            let id = operation.occurrenceID
            guard let authority = operation.transfer?.automatic, let applied = operation.localAfter,
                  let reminder = try? RemiloIOSEngine.shared.read().reminders[id],
                  reminder.revision == applied.version.revision else { continue }
            automaticLocalVersions[id] = AutomaticLocalVersion(activationRevision: authority.activationRevision, local: reminder)
        }
        if before != after || batch.sorted(by: { $0.occurrenceID < $1.occurrenceID }) != links {
            NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
        }
    }

    private func automaticOperations(_ manualLink: Manual, ids: Set<String>, revision: Int) throws -> [Manual.Store.Operation] {
        try manualLink.transferOperations(expectedConnectionRevision: revision).filter {
            $0.kind == "AutomaticCalendarTransfer" && ids.contains($0.occurrenceID)
        }
    }

    static func reconcileManualLinkPurges() throws {
        guard foregroundWindow() != nil else { return }
        let purged = try RemiloIOSEngine.shared.read().purgedLocalOccurrences ?? []
        guard !purged.isEmpty else { return }
        try RemiloIOSGoogleCalendarManualLinkStore.local().redactPurged(purged)
    }

    /// This synchronous callback captures a saved binding; it does not need a
    /// token and cannot make a network request from the local engine.
    static func captureManagedExport(explicit: Bool) -> IOSCalendarExportIntent.Scope? {
        let runtime = live ?? (try? configuredForegroundRuntime())
        guard let binding = try? runtime?.managedSetup?.captureOutgoingBinding(explicit: explicit) else { return nil }
        return exportScope(binding)
    }

    private static func exportScope(_ binding: RemiloIOSGoogleCalendarManagedSetupJournal.Binding) -> IOSCalendarExportIntent.Scope {
        exportScope(binding.exportLease, accountGeneration: binding.account.accountGeneration)
    }

    private static func exportScope(_ lease: RemiloIOSGoogleCalendarManualLink.ManagedLease,
                                    accountGeneration: Int) -> IOSCalendarExportIntent.Scope {
        .init(setupID: lease.setupID, bindingRevision: lease.bindingRevision, authEpoch: lease.authEpoch,
              accountGeneration: accountGeneration)
    }

    private static func heldExport(_ record: IOSReminder, binding: RemiloIOSGoogleCalendarManagedSetupJournal.Binding)
        -> RemiloIOSGoogleCalendarPublicationRuntime.ManagedCandidate? {
        guard record.active, record.isCalendarOneTime, let intent = record.calendarExportIntent else { return nil }
        let scope = intent.scope
        guard scope.setupID == binding.operationID, scope.bindingRevision <= binding.revision,
              scope.authEpoch <= binding.authEpoch, scope.accountGeneration == binding.account.accountGeneration else { return nil }
        let original = RemiloIOSGoogleCalendarManualLink.ManagedLease(setupID: scope.setupID, bindingRevision: scope.bindingRevision,
            authEpoch: scope.authEpoch, calendarID: binding.record.id, zoneID: binding.record.zoneId, publication: true)
        return .init(occurrenceID: record.id, operationID: intent.operationID, lease: original, calendarName: binding.record.name)
    }

    func previewManagedResume(expectedRevision: Int) async throws
        -> (review: RemiloIOSGoogleCalendarManagedSetupJournal.ResumeReview, rows: [RemiloIOSGoogleCalendarPublicationRuntime.ResumeRow],
            imports: [RemiloIOSGoogleCalendarManagedSetup.ResumeImportRow], links: [RemiloIOSGoogleCalendarManualLinkRuntime.ResumeRow],
            series: [RemiloIOSGoogleCalendarManagedSetup.ResumeSeriesRow]) {
        guard let managedSetup, let publication else { throw Failure.invalidConfiguration }
        return try await managedSetup.previewResume(expectedRevision: expectedRevision, incoming: reviewHeldIncoming,
                                                    manual: manualLink, series: reviewHeldSeries) { binding, account in
            let candidates = try RemiloIOSEngine.shared.read().reminders.values.compactMap { Self.heldExport($0, binding: binding) }
            guard candidates.count <= 500 else { throw Failure.discoveryLimit }
            return try publication.reviewHeldExports(candidates, viewingAs: account).sorted { $0.itemID < $1.itemID }
        }
    }

    func confirmManagedResume(_ operationID: UUID, reviewID: UUID, selectedItemIDs: [String], expectedRevision: Int) async throws
        -> RemiloIOSGoogleCalendarManagedSetupJournal.ModeReceipt {
        guard let managedSetup, let publication else { throw Failure.invalidConfiguration }
        let receipt = try await managedSetup.confirmResume(operationID, reviewID: reviewID, selectedItemIDs: selectedItemIDs,
                                                          expectedRevision: expectedRevision, manual: manualLink,
                                                          validateSeries: validateHeldSeries) { exports, binding, account in
            let records = try RemiloIOSEngine.shared.read().reminders
            for export in exports {
                guard let record = records[export.local.occurrenceID], let candidate = Self.heldExport(record, binding: binding),
                      candidate.operationID == export.operationID, candidate.lease == export.originLease else {
                    throw RemiloIOSGoogleCalendarManagedSetupJournal.Rejection.stalePreview
                }
            }
            try publication.validateHeldExports(exports, viewingAs: account)
        }
        requestAutomaticPass(.foreground)
        return receipt
    }

    private func managedOutgoingCandidates(expectedRevision: Int) throws -> [RemiloIOSGoogleCalendarPublicationRuntime.ManagedCandidate] {
        var candidates: [RemiloIOSGoogleCalendarPublicationRuntime.ManagedCandidate] = []
        if let binding = try? managedSetup?.outgoingBinding(explicit: true) {
            let scope = Self.exportScope(binding)
            let account = try connection.savedAccount(expectedRevision: expectedRevision)
            let resumed = try managedSetup?.resumedExports(account) ?? []
            let approved = Dictionary(uniqueKeysWithValues: resumed.map { ($0.operationID, $0) })
            for reminder in try RemiloIOSEngine.shared.read().reminders.values where reminder.active {
                guard let intent = reminder.calendarExportIntent else { continue }
                let previous = approved[intent.operationID]
                let wasReviewed = previous?.local.occurrenceID == reminder.id &&
                    previous.map { Self.exportScope($0.originLease, accountGeneration: account.accountGeneration) } == intent.scope
                guard intent.scope == scope || wasReviewed else { continue }
                candidates.append(.init(occurrenceID: reminder.id, operationID: intent.operationID,
                                        lease: binding.exportLease, calendarName: binding.record.name,
                                        replacingLease: wasReviewed ? previous?.waitingLease : nil))
            }
        }
        return candidates
    }

    private func syncManagedOutgoing(expectedRevision: Int) async throws {
        guard let publication else { return }
        let candidates = try managedOutgoingCandidates(expectedRevision: expectedRevision)
        let changed = try await publication.syncManaged(candidates, expectedConnectionRevision: expectedRevision)
        let linked = try await attachManagedPublications(publication, expectedRevision: expectedRevision)
        if !changed.isEmpty || linked {
            NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
        }
    }

    private func attachManagedPublications(_ publication: RemiloIOSGoogleCalendarPublicationRuntime,
                                           expectedRevision: Int) async throws -> Bool {
        guard let manualLink else { return false }
        let account = try connection.savedAccount(expectedRevision: expectedRevision)
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var settled = false
        for entry in try publication.pendingManagedLinks(expectedConnectionRevision: expectedRevision).prefix(4) {
            guard !Task.isCancelled, budget.hasTimeRemaining else { break }
            if let lease = entry.managedLease, try managedSetup?.holdsExport(lease, account: account) == true { continue }
            let reason: String?
            if try publication.permitsManagedLink(entry, viewingAs: account) {
                do {
                    try await manualLink.attachManagedPublication(entry, expectedConnectionRevision: expectedRevision, budget: budget)
                    reason = nil
                } catch ManualLinkFailure.stalePreview { continue }
                catch let failure as ManualLinkFailure { reason = failure.rawValue }
                catch let failure as RemiloIOSGoogleCalendarManualLinkStore.Rejection { reason = failure.rawValue }
                catch let failure as Failure where [.notOwner, .ownershipUnknown, .notFound, .remoteUnavailable, .invalidZone].contains(failure) {
                    reason = failure.rawValue
                } catch is Failure { continue }
            } else {
                reason = entry.confirmation?.remoteDiffers == true ? ManualLinkFailure.staleRemote.rawValue : ManualLinkFailure.stalePreview.rawValue
            }
            guard try connection.savedAccount(expectedRevision: expectedRevision) == account else { break }
            try publication.finishManagedLink(entry, reason: reason)
            settled = true
        }
        return settled
    }

    /// Missing or mismatched signed-bundle configuration keeps the runtime
    /// unavailable without opening protected storage.
    static func configuredForegroundRuntime() throws -> RemiloIOSGoogleCalendarRuntime? {
        guard let configuration = RemiloIOSGoogleCalendarConfiguration() else { return nil }
        guard foregroundWindow() != nil else { throw Failure.needsAccess }
        try reconcileManualLinkPurges()
        if let live { return live }
        let connection = try Connection(configuration: configuration, store: .local())
        let presenter = RemiloIOSGoogleCalendarWebAuthorization()
        let canUseForeground: @MainActor @Sendable () -> Bool = { Self.foregroundWindow() != nil }
        let imports = try ImportJournal.local()
        let managed = try RemiloIOSGoogleCalendarManagedSetupJournal.local()
        var publicationAuthority = RemiloIOSGoogleCalendarPublicationRuntime.LocalAuthority.localEngine(.shared)
        publicationAuthority.holdsManagedExport = { lease, account in try managed.holdsExport(lease, account: account) }
        publicationAuthority.permitsManagedExport = { id, operationID, lease, account in
            guard let reminder = try RemiloIOSEngine.shared.read().reminders[id], reminder.active,
                  let intent = reminder.calendarExportIntent, intent.operationID == operationID else { return false }
            do {
                guard let binding = try managed.outgoingBinding(account, explicit: true), binding.exportLease == lease else { return false }
                if Self.exportScope(binding) == intent.scope { return true }
                return try managed.resumedExports(account).contains {
                    $0.operationID == operationID && $0.local.occurrenceID == id &&
                        Self.exportScope($0.originLease, accountGeneration: account.accountGeneration) == intent.scope
                }
            } catch Failure.staleConnection { return false }
        }
        let publication = try RemiloIOSGoogleCalendarPublicationRuntime(
            connection: connection, journal: .local(), local: publicationAuthority, canUseForeground: canUseForeground
        )
        let manualLink = try RemiloIOSGoogleCalendarManualLinkRuntime(
            connection: connection, publication: publication, imports: imports, store: .local(),
            local: .localEngine(.shared), canUseForeground: canUseForeground,
            allowsManagedLease: { lease, account in try managed.permitsLink(lease, account: account) },
            notifyStatusChange: {
                NotificationCenter.default.post(name: .remiloIOSChange, object: nil, userInfo: [Self.automaticStatusChangeKey: true])
            }
        )
        let seriesAuthority = SeriesTextAuthority(read: { try RemiloIOSEngine.shared.calendarSeriesTextSnapshot($0) },
            apply: { operation, snapshot, title, notes, permit in
                try await RemiloIOSEngine.shared.applyCalendarSeriesText(operationKey: operation, snapshot: snapshot,
                                                                       title: title, notes: notes, authorize: permit)
            }, permit: { snapshot, checkpoint in
                try await RemiloIOSEngine.shared.withCalendarSeriesTextPermit(for: snapshot, commit: checkpoint)
            }, applySchedule: { operation, snapshot, change, permit in
                do {
                    return try await RemiloIOSEngine.shared.applyCalendarSeriesSchedule(operationKey: operation, snapshot: snapshot,
                                                                                       change: change, authorize: permit)
                } catch is RemiloIOSRecurrence.InvalidRule { return .needsReview }
            }, readForExport: { try RemiloIOSEngine.shared.calendarSeriesExportSnapshot($0) },
            acknowledgeSchedule: { snapshot, permit in
                try await RemiloIOSEngine.shared.acknowledgeCalendarSeriesExport(snapshot, authorize: permit)
            }, applyInstance: { operation, snapshot, change, permit in
                do {
                    return try await RemiloIOSEngine.shared.applyCalendarSeriesInstance(operationKey: operation, snapshot: snapshot,
                                                                                       change: change, authorize: permit)
                } catch is RemiloIOSRecurrence.InvalidRule { return .needsReview }
            }, instanceExport: .init(read: { try RemiloIOSEngine.shared.calendarSeriesInstanceEdits($0, limit: $1) },
                permit: { edit, checkpoint in
                    try await RemiloIOSEngine.shared.withCalendarSeriesInstancePermit(for: edit, commit: checkpoint)
                }, acknowledge: { confirmation, permit in
                    do {
                        return try await RemiloIOSEngine.shared.acknowledgeCalendarSeriesInstance(confirmation, authorize: permit)
                    } catch is RemiloIOSRecurrence.InvalidRule { return .needsReview }
                }), resumePermit: { snapshot, checkpoint in
                    try await RemiloIOSEngine.shared.withCalendarSeriesTextPermit(for: snapshot, commit: checkpoint)
                })
        let runtime = RemiloIOSGoogleCalendarRuntime(
            connection: connection, canUseForeground: canUseForeground,
            importJournal: imports, scheduler: .localEngine(.shared), publication: publication, manualLink: manualLink,
            managedSetupJournal: managed,
            managedSetupFreshInstallation: { try RemiloIOSEngine.shared.read().isFreshCalendarInstallation },
            managedImportSound: { try RemiloIOSEngine.shared.read().settings.alertSound == "system" ? .system : .remilo },
            seriesText: seriesAuthority
        ) {
            subject, purpose in
            try await Self.authorize(presenter: presenter, subject: subject, purpose: purpose)
        }
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                   appropriateFor: nil, create: true)
        runtime.seriesTextWriter = RemiloIOSGoogleCalendarSeriesTextWriter(
            directory: support.appendingPathComponent("google-calendar", isDirectory: true),
            connection: connection, imports: imports, local: seriesAuthority, canRead: canUseForeground,
            activeLease: { [setup = runtime.managedSetup] in try setup?.activeSeriesLease($0) },
            heldLease: { [setup = runtime.managedSetup] in try setup?.heldBinding($0)?.linkLease }
        )
        live = runtime
        return runtime
    }

    private static func authorize(presenter: RemiloIOSGoogleCalendarWebAuthorization, subject: String?,
                                  purpose: RemiloIOSGoogleCalendarPurpose) async throws -> RemiloIOSGoogleCalendarAccess {
        guard let window = foregroundWindow() else { throw Failure.needsAccess }
        return try await presenter.authorizeFromUserAction(presentingWindow: window, purpose: purpose, expectedSubject: subject)
    }

    private static func foregroundWindow() -> UIWindow? {
        guard UIApplication.shared.isProtectedDataAvailable else { return nil }
        return UIApplication.shared.connectedScenes.lazy.compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }.compactMap(\.keyWindow).first
    }
    #endif
}
