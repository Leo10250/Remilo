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
    nonisolated static let automaticStatusChangeKey = "calendarStatusOnly"

    enum Authorization: Equatable { case connectOrChangeAccount, reauthorizeCurrentAccount, writeOwnedEvents }

    private let connection: Connection
    private let canUseForeground: @MainActor @Sendable () -> Bool
    private let authorize: Connection.Authorize
    private let importJournal: ImportJournal
    private let scheduler: ImportJournal.Scheduler
    let publication: RemiloIOSGoogleCalendarPublicationRuntime?
    let manualLink: RemiloIOSGoogleCalendarManualLinkRuntime?
    let managedSetup: RemiloIOSGoogleCalendarManagedSetup?
    private let managedImportSound: @MainActor () throws -> Import.Sound
    private var reviews: [Import.Review] = []
    private var importingManaged = false

    struct ManagedImportPass: Sendable {
        var pages = 0
        var imported = 0
        var needsReview = 0
        var linked = 0
        var continuation = false
    }

    init(connection: Connection, canUseForeground: @escaping @MainActor @Sendable () -> Bool,
         importJournal: ImportJournal, scheduler: ImportJournal.Scheduler,
         publication: RemiloIOSGoogleCalendarPublicationRuntime? = nil,
         manualLink: RemiloIOSGoogleCalendarManualLinkRuntime? = nil,
         managedSetupJournal: RemiloIOSGoogleCalendarManagedSetupJournal? = nil,
         managedSetupFreshInstallation: @escaping @MainActor () throws -> Bool = { false },
         managedImportSound: @escaping @MainActor () throws -> Import.Sound = { .remilo },
         authorize: @escaping Connection.Authorize) {
        self.connection = connection
        self.canUseForeground = canUseForeground
        self.importJournal = importJournal
        self.scheduler = scheduler
        self.publication = publication
        self.manualLink = manualLink
        self.managedImportSound = managedImportSound
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
        guard !importingManaged else { throw Import.Failure.operationPending }
        importingManaged = true
        defer { importingManaged = false }
        let account = try connection.account(expectedRevision: expectedRevision)
        let budget = RemiloIOSGoogleCalendarHTTP.Budget()
        var result = ManagedImportPass()
        var attempted = 0
        do {
            try await attachPendingManagedLinks(account: account, budget: budget, result: &result)
            for pending in try await importJournal.pendingManaged(viewingAs: account) {
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
            let reserved = try await reservedEvents(account, calendarID: scan.scope.binding.record.id)
            for observation in scan.pending where !reserved.contains(observation.eventID) {
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

    private func attachPendingManagedLinks(account: Import.Account, budget: RemiloIOSGoogleCalendarHTTP.Budget,
                                           result: inout ManagedImportPass) async throws {
        guard let manualLink else { return }
        let work = try await importJournal.pendingManagedLinks(viewingAs: account)
        for item in work.prefix(10) {
            try requireCurrentAccount(account)
            guard budget.hasTimeRemaining else { throw Failure.budget }
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
        }, managedCurrent: managedCurrent)
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
        guard let manualLink, view.canWriteOwnedEvents else { return }
        let inspectUnchanged = opportunity == .foreground
        if inspectUnchanged { try? manualLink.resumeAssociationRequests(expectedConnectionRevision: view.revision, limit: 2) }
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
        guard let binding = try? runtime?.managedSetup?.outgoingBinding(explicit: explicit) else { return nil }
        return exportScope(binding)
    }

    private static func exportScope(_ binding: RemiloIOSGoogleCalendarManagedSetupJournal.Binding) -> IOSCalendarExportIntent.Scope {
        return .init(setupID: binding.operationID, bindingRevision: binding.revision,
                     authEpoch: binding.authEpoch, accountGeneration: binding.account.accountGeneration)
    }

    private func syncManagedOutgoing(expectedRevision: Int) async throws {
        guard let publication else { return }
        var candidates: [RemiloIOSGoogleCalendarPublicationRuntime.ManagedCandidate] = []
        if let binding = try? managedSetup?.outgoingBinding(explicit: true) {
            let scope = Self.exportScope(binding)
            for reminder in try RemiloIOSEngine.shared.read().reminders.values where reminder.active {
                guard let intent = reminder.calendarExportIntent, intent.scope == scope else { continue }
                candidates.append(.init(occurrenceID: reminder.id, operationID: intent.operationID,
                                        lease: binding.exportLease, calendarName: binding.record.name))
            }
        }
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
        publicationAuthority.permitsManagedExport = { id, operationID, lease, account in
            guard let reminder = try RemiloIOSEngine.shared.read().reminders[id], reminder.active,
                  let intent = reminder.calendarExportIntent, intent.operationID == operationID else { return false }
            do {
                guard let binding = try managed.outgoingBinding(account, explicit: true) else { return false }
                return binding.exportLease == lease && Self.exportScope(binding) == intent.scope
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
        let runtime = RemiloIOSGoogleCalendarRuntime(
            connection: connection, canUseForeground: canUseForeground,
            importJournal: imports, scheduler: .localEngine(.shared), publication: publication, manualLink: manualLink,
            managedSetupJournal: managed,
            managedSetupFreshInstallation: { try RemiloIOSEngine.shared.read().isFreshCalendarInstallation },
            managedImportSound: { try RemiloIOSEngine.shared.read().settings.alertSound == "system" ? .system : .remilo }
        ) {
            subject, purpose in
            try await Self.authorize(presenter: presenter, subject: subject, purpose: purpose)
        }
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
