import Foundation

@MainActor
final class RemiloIOSGoogleCalendarBridge {
    typealias Runtime = RemiloIOSGoogleCalendarRuntime
    typealias Connection = Runtime.Connection
    typealias Import = Runtime.Import
    typealias Operation = Runtime.ImportJournal.SavedOperation
    typealias Failure = Runtime.Failure
    typealias PublicationRuntime = RemiloIOSGoogleCalendarPublicationRuntime
    typealias LinkRuntime = RemiloIOSGoogleCalendarManualLinkRuntime
    typealias Link = LinkRuntime.Link
    typealias LinkStore = LinkRuntime.Store

    private enum PageCursor {
        case calendars(Connection.Cursor)
        case events(Connection.EventCursor)
    }

    private struct Cursor {
        let id: UUID
        let revision: Int
        let value: PageCursor
    }

    private struct PreviewChoices {
        let id: UUID
        let revision: Int
        let expiresAtMs: Int64
        let choices: Import.Choices
    }

    static let shared = RemiloIOSGoogleCalendarBridge()
    static var available: Bool { RemiloIOSGoogleCalendarConfiguration() != nil }
    private var cursors: [Cursor] = []
    private var previews: [PreviewChoices] = []

    func connection() async throws -> [String: Any] {
        guard let runtime = try Runtime.configuredForegroundRuntime() else { return Self.connection(nil) }
        return Self.connection(try await runtime.view())
    }

    func authorize(expectedRevision: Double?, intent: String) async throws -> [String: Any] {
        let authorization: Runtime.Authorization
        switch intent {
        case "connectOrChangeAccount": authorization = .connectOrChangeAccount
        case "reauthorizeCurrentAccount": authorization = .reauthorizeCurrentAccount
        case "authorizeOwnedCalendarWrites": authorization = .writeOwnedEvents
        default: throw Failure.invalidInput
        }
        let revision = try Self.revision(expectedRevision)
        let view = try await runtime().authorizeFromUserAction(expectedRevision: revision, intent: authorization)
        discard(before: view.revision)
        NotificationCenter.default.post(name: .remiloIOSChange, object: nil)
        return Self.connection(view)
    }

    func ownedCalendars(cursor: String?, expectedRevision: Double?) async throws -> [String: Any] {
        let revision = try Self.revision(expectedRevision)
        let next: Connection.Cursor?
        switch try pageCursor(cursor, revision: revision) {
        case .calendars(let value): next = value
        case nil: next = nil
        default: throw Failure.staleCursor
        }
        let page = try await runtime().ownedCalendars(expectedRevision: revision, cursor: next)
        return ["items": page.items.map { ["id": $0.id, "name": $0.name, "zoneId": $0.zoneId] },
                "nextCursor": iosBridgeValue(page.nextCursor.map { remember(.calendars($0), revision: revision) }),
                "connectionRevision": page.connectionRevision]
    }

    func events(_ query: [String: Any]) async throws -> [String: Any] {
        let input = IOSInput(values: query)
        let revision = try Self.revision(input)
        let next: Connection.EventCursor?
        switch try pageCursor(Self.optionalText(input, "cursor", maximum: 36), revision: revision) {
        case .events(let value): next = value
        case nil: next = nil
        default: throw Failure.staleCursor
        }
        let page = try await runtime().browseEvents(
            expectedRevision: revision, calendarID: input.text("calendarId", maximum: 4_096),
            from: input.text("from", maximum: 10), until: input.text("until", maximum: 10), cursor: next
        )
        return ["items": page.items.map(Self.event),
                "nextCursor": iosBridgeValue(page.nextCursor.map { remember(.events($0), revision: revision) }),
                "connectionRevision": page.connectionRevision, "calendarName": Self.providerLabel(page.calendarName)]
    }

    func previewImport(_ event: [String: Any], choices: [String: Any]) async throws -> [String: Any] {
        let input = IOSInput(values: event)
        let revision = try Self.revision(input)
        let runtime = try runtime()
        let reviewedChoices = try Self.choices(IOSInput(values: choices))
        let review = try await runtime.prepareImport(expectedRevision: revision, calendarID: input.text("calendarId", maximum: 4_096),
                                                     eventID: input.text("eventId", maximum: 4_096), choices: reviewedChoices)
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.access == .ownedCalendars || view.access == .managedCreation else { throw Failure.needsAccess }
        let timing = try review.timing(reviewedChoices)
        let now = iosMillis(Date())
        let recurrence = try review.recurrenceSpec()
        let upcoming = try recurrence.map { _ in try review.upcoming(reviewedChoices, after: now) }
        let nextAlert: Int64?
        if reviewedChoices.mode == .none { nextAlert = nil }
        else if let upcoming { nextAlert = upcoming.map(\.alarmAtMs).min() }
        else { nextAlert = timing.alert > now ? timing.alert : nil }
        previews.removeAll { $0.revision != revision || $0.expiresAtMs < now }
        if previews.count == 8 { previews.removeFirst() }
        previews.append(PreviewChoices(id: review.id, revision: revision, expiresAtMs: review.checkedAtMs + 600_000, choices: reviewedChoices))
        let fields = review.source.fields
        let title = (reviewedChoices.title ?? fields.title).trimmingCharacters(in: .whitespacesAndNewlines)
        let reminders: Bool? = review.googleReminders == .unknown ? nil : review.googleReminders == .enabled
        return [
            "previewId": review.id.uuidString, "occurrenceId": "", "connectionRevision": revision,
            "calendarName": review.calendarName ?? "", "email": view.email, "remote": Self.fields(fields),
            "local": NSNull(), "baseline": NSNull(), "selections": NSNull(), "timings": NSNull(),
            "choices": ["mode": reviewedChoices.mode.rawValue, "title": title, "dueAtMs": timing.due, "alarmAtMs": timing.alert,
                        "listId": iosBridgeValue(reviewedChoices.listID), "automaticSync": false, "disableReminders": false] as [String: Any],
            "googleReminders": iosBridgeValue(reminders), "checkedAtMs": review.checkedAtMs,
            "nextAlertMs": iosBridgeValue(nextAlert), "recurrence": iosBridgeValue(recurrence?.payload),
            "upcoming": iosBridgeValue(upcoming?.map { slot -> [String: Any] in
                ["nominalSlot": slot.nominalSlot, "eventStartMs": slot.eventStartMs, "alarmAtMs": slot.alarmAtMs]
            }),
        ]
    }

    func publications(expectedRevision: Double?) async throws -> [[String: Any]] {
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.connected else { return [] }
        return try Self.publicationRuntime(runtime).operations(expectedConnectionRevision: revision).map {
            Self.publication($0, connection: view)
        }
    }

    func previewPublication(_ id: String, expectedRevision: Double?) throws -> [String: Any] {
        guard !id.isEmpty, id.utf16.count <= 200 else { throw Failure.invalidInput }
        let revision = try Self.revision(expectedRevision)
        let preview = try Self.publicationRuntime(runtime()).preview(occurrenceID: id, expectedConnectionRevision: revision)
        let fields = preview.local.fields
        let schedule = fields.schedule
        return [
            "occurrenceId": preview.local.version.occurrenceID, "reminderRevision": preview.local.version.revision,
            "connectionRevision": preview.account.connectionRevision, "fingerprint": preview.fingerprint,
            "title": fields.title, "notes": fields.notes, "eventStartMs": schedule.eventStartMs,
            "eventEndMs": schedule.eventEndMs, "allDay": schedule.allDay, "zoneId": schedule.zoneId,
            "pinsZone": false, "email": preview.email, "calendarName": preview.calendar.name,
        ]
    }

    func linkCandidate(_ id: String, expectedRevision: Double?) async throws -> Bool {
        try Self.validateOccurrenceID(id)
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.connected else { return false }
        return try await Self.linkRuntime(runtime).canLink(id, expectedConnectionRevision: revision)
    }

    func links(expectedRevision: Double?) async throws -> [[String: Any]] {
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.connected else { return [] }
        return try Self.linkRuntime(runtime).links(expectedConnectionRevision: revision).map { try Self.link($0, connection: view) }
    }

    func previewLink(_ id: String, expectedRevision: Double?) async throws -> [String: Any] {
        try Self.validateOccurrenceID(id)
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let review = try await Self.linkRuntime(runtime).preview(id, expectedConnectionRevision: revision)
        let view = try await runtime.view()
        guard view.revision == revision, review.account.connectionRevision == revision else { throw Failure.staleConnection }
        let selections = review.suggestedSelections
        guard let timing = review.remiloTiming else { throw Failure.invalidResponse }
        let local = review.local.fields
        let choices: [String: Any] = [
            "mode": timing.mode, "title": local.title, "dueAtMs": timing.dueAtMs, "alarmAtMs": timing.alarmAtMs,
            "automaticSync": false, "disableReminders": false,
        ]
        let timings: [String: Any] = [
            "remilo": Self.timing(timing),
            "google": iosBridgeValue(review.googleTiming.map(Self.timing)),
        ]
        return [
            "previewId": review.id.uuidString, "occurrenceId": review.local.version.occurrenceID, "connectionRevision": revision,
            "calendarName": review.remote.calendarName, "email": view.email, "remote": Self.fields(review.remote.fields),
            "local": Self.fields(local), "baseline": iosBridgeValue(review.baseline.map(Self.baseline)),
            "selections": ["title": iosBridgeValue(selections[.title]?.rawValue), "notes": iosBridgeValue(selections[.notes]?.rawValue),
                           "schedule": iosBridgeValue(selections[.schedule]?.rawValue)],
            "choices": choices, "timings": timings, "checkedAtMs": review.checkedAtMs, "googleReminders": NSNull(),
            "manualScheduleBlocked": iosBridgeValue(review.manualScheduleBlocked.map(Self.bridgeErrorCode)),
            "nextAlertMs": iosBridgeValue(review.googleTiming?.retainedAlertMs ?? timing.retainedAlertMs),
        ]
    }

    func apply(_ command: [String: Any]) async throws -> [String: Any] {
        let input = IOSInput(values: command)
        let kind = try input.text("kind", maximum: 60)
        let revision = try Self.revision(input)
        let operation = try Self.uuid(input, "operationId")
        let runtime = try runtime()
        defer { NotificationCenter.default.post(name: .remiloIOSChange, object: nil) }
        switch kind {
        case "DisconnectCalendar":
            let result = try await runtime.disconnectFromUserAction(operationID: operation.uuidString, expectedRevision: revision)
            discard(before: result.revision)
            return ["revision": result.revision, "available": true, "connected": false, "email": "", "calendarId": "",
                    "calendarName": "", "message": "", "access": "disconnected", "canWriteOwnedEvents": false,
                    "revocation": result.revocation.rawValue]
        case "SelectCalendar":
            let selected = try await Self.publicationRuntime(runtime).selectDestination(
                input.text("calendarId", maximum: 4_096), operationID: operation, expectedConnectionRevision: revision
            )
            let view = try await runtime.view()
            guard view.revision == selected else { throw Failure.staleConnection }
            discard(before: selected)
            return Self.connection(view)
        case "PublishOneOff":
            let entry = try await Self.publicationRuntime(runtime).confirm(
                operationID: operation, occurrenceID: input.text("occurrenceId", maximum: 200),
                expectedLocalRevision: Int(input.integer("expectedRevision", range: 0...9_007_199_254_740_991)),
                expectedConnectionRevision: revision, fingerprint: input.text("fingerprint", maximum: 44)
            )
            return try await publicationResult(entry, runtime: runtime, revision: revision)
        case "RetryPublication":
            let entry = try await Self.publicationRuntime(runtime).retry(operation, expectedConnectionRevision: revision)
            return try await publicationResult(entry, runtime: runtime, revision: revision)
        case "CancelPublication":
            let publication = try Self.publicationRuntime(runtime)
            let entries = try publication.operations(expectedConnectionRevision: revision)
            guard let status = entries.first(where: { $0.entry.identity.operationID == operation }) else { throw Failure.notFound }
            guard status.entry.phase == .waiting || status.entry.phase == .cancelled else { throw Failure.invalidInput }
            let entry = try publication.retire(operation, expectedConnectionRevision: revision)
            return try await publicationResult(entry, runtime: runtime, revision: revision)
        case "ImportCalendarEvent":
            guard try !input.flag("automaticSync", fallback: false), command["selections"] == nil else { throw Failure.invalidInput }
            let id = try Self.uuid(input, "previewId")
            guard let capture = previews.first(where: { $0.id == id && $0.revision == revision }) else { throw Import.Failure.stalePreview }
            let receipt = try await runtime.confirmImport(operationID: operation, reviewID: id, expectedRevision: revision, choices: capture.choices)
            return Self.linked(Operation(receipt: receipt))
        case "EnableCalendarLink", "ApplyCalendarResolution":
            guard try !input.flag("automaticSync", fallback: false) else { throw Failure.invalidInput }
            let result = try await Self.linkRuntime(runtime).resolve(
                operationID: operation, reviewID: Self.uuid(input, "previewId"), expectedConnectionRevision: revision,
                choices: Self.selections(input), updating: kind == "ApplyCalendarResolution"
            )
            return try await transferResult(result, runtime: runtime, revision: revision)
        case "UnlinkCalendar":
            let id = try input.text("occurrenceId", maximum: 200)
            try Self.validateOccurrenceID(id)
            let linkRevision = try Int(input.integer("expectedLinkRevision", range: 1...9_007_199_254_740_991))
            _ = try Self.linkRuntime(runtime).unlink(operationID: operation, occurrenceID: id, expectedConnectionRevision: revision,
                                                     expectedLinkRevision: linkRevision)
            return ["unlinked": true]
        case "RetryCalendarOperation":
            if let manual = runtime.manualLink, try manual.transferOperation(operation, expectedConnectionRevision: revision) != nil {
                let result = try await manual.retry(operation, expectedConnectionRevision: revision)
                return try await transferResult(result, runtime: runtime, revision: revision)
            }
            let receipt = try await runtime.recoverImport(operationID: operation, expectedRevision: revision)
            return Self.linked(Operation(receipt: receipt))
        default: throw Failure.invalidInput
        }
    }

    func operation(_ id: String, expectedRevision: Double?) async throws -> [String: Any]? {
        guard let id = UUID(uuidString: id) else { throw Failure.invalidInput }
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.connected else { return nil }
        if let transfer = try runtime.manualLink?.transferOperation(id, expectedConnectionRevision: revision) {
            let local = try Self.localLinkSnapshot(transfer.occurrenceID)
            let presentation = Self.transferPresentation(transfer, local: local, connection: view)
            return [
                "operationId": transfer.operationID.uuidString, "kind": transfer.kind, "stage": presentation.stage,
                "reason": transfer.reason.map(Self.bridgeErrorCode) ?? "", "action": presentation.action,
                "confirmed": transfer.phase == .confirmed ? 1 : 0, "pending": transfer.phase.pending ? 1 : 0,
                "review": presentation.recovery == "ReviewAgain" ? 1 : 0, "held": 0, "children": [String](),
                "currentScope": presentation.currentScope,
            ]
        }
        guard Self.hasReadAccess(view) else { return nil }
        do { return try await runtime.savedImportOperation(id, expectedRevision: revision).map { Self.status($0, revision: revision) } }
        catch Failure.needsAccess { return nil }
    }

    func operations(expectedRevision: Double?) async throws -> [[String: Any]] {
        let revision = try Self.revision(expectedRevision)
        let runtime = try runtime()
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        guard view.connected else { return [] }
        var imports: [[String: Any]] = []
        if Self.hasReadAccess(view) {
            do { imports = try await runtime.savedImportOperations(expectedRevision: revision).map(Self.linked) }
            catch Failure.needsAccess {}
        }
        let current = try await runtime.view()
        guard current.revision == revision else { throw Failure.staleConnection }
        let transfers = try runtime.manualLink?.transferOperations(expectedConnectionRevision: revision) ?? []
        return imports + (try transfers.map { try Self.transfer($0, connection: current) })
    }

    private func runtime() throws -> Runtime {
        guard let runtime = try Runtime.configuredForegroundRuntime() else { throw Failure.invalidConfiguration }
        return runtime
    }

    private static func publicationRuntime(_ runtime: Runtime) throws -> PublicationRuntime {
        guard let publication = runtime.publication else { throw Failure.invalidConfiguration }
        return publication
    }

    private static func linkRuntime(_ runtime: Runtime) throws -> LinkRuntime {
        guard let manual = runtime.manualLink else { throw Failure.invalidConfiguration }
        return manual
    }

    private func publicationResult(_ entry: PublicationRuntime.Journal.Entry, runtime: Runtime,
                                   revision: Int) async throws -> [String: Any] {
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        return Self.publication(try Self.publicationRuntime(runtime).status(entry), connection: view)
    }

    private func transferResult(_ operation: LinkStore.Operation, runtime: Runtime,
                                revision: Int) async throws -> [String: Any] {
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        return try Self.transfer(operation, connection: view)
    }

    private func discard(before revision: Int) {
        cursors.removeAll { $0.revision < revision }
        previews.removeAll { $0.revision < revision }
    }

    private func pageCursor(_ value: String?, revision: Int) throws -> PageCursor? {
        guard let value else { return nil }
        guard let id = UUID(uuidString: value), let cursor = cursors.first(where: { $0.id == id && $0.revision == revision }) else {
            throw Failure.staleCursor
        }
        return cursor.value
    }

    private func remember(_ value: PageCursor, revision: Int) -> String {
        let id = UUID()
        cursors.removeAll { $0.revision < revision }
        if cursors.count == 48 { cursors.removeFirst() }
        cursors.append(Cursor(id: id, revision: revision, value: value))
        return id.uuidString
    }

    private static func choices(_ input: IOSInput) throws -> Import.Choices {
        guard try !input.flag("automaticSync", fallback: false), try !input.flag("disableReminders", fallback: false),
              let mode = try Import.Mode(rawValue: input.text("mode", fallback: "Alarm", maximum: 32)) else { throw Failure.invalidInput }
        let alert: Int64? = try input.values["alarmAtMs"].flatMap { value in
            guard !(value is NSNull) else { return nil }
            return try input.integer("alarmAtMs", range: RemiloIOSProjection.epoch)
        }
        let listID = try optionalText(input, "listId", maximum: 200)
        let sound = try RemiloIOSEngine.shared.read().settings.alertSound
        return try Import.Choices(mode: mode, title: optionalText(input, "title", maximum: 200), alarmAtMs: alert,
                                  listID: listID, sound: Import.Sound(rawValue: sound) ?? .remilo, automaticSync: false)
    }

    private static func selections(_ input: IOSInput) throws -> [Link.Comparison.Group: Link.Comparison.Side] {
        guard let selections = input.values["selections"] as? [String: Any], selections.count <= 3 else {
            throw Failure.invalidInput
        }
        var result: [Link.Comparison.Group: Link.Comparison.Side] = [:]
        for (key, value) in selections {
            guard let group = Link.Comparison.Group(rawValue: key) else { throw Failure.invalidInput }
            if value is NSNull { continue }
            guard let name = value as? String, let side = Link.Comparison.Side(rawValue: name) else { throw Failure.invalidInput }
            result[group] = side
        }
        return result
    }

    private static func validateOccurrenceID(_ id: String) throws {
        guard !id.isEmpty, id.utf16.count <= 200 else { throw Failure.invalidInput }
    }

    private static func optionalText(_ input: IOSInput, _ key: String, maximum: Int) throws -> String? {
        guard let value = input.values[key], !(value is NSNull) else { return nil }
        return try input.text(key, maximum: maximum)
    }

    private static func revision(_ value: Double?) throws -> Int {
        guard let value, let revision = Int(exactly: value), (0...9_007_199_254_740_991).contains(revision) else { throw Failure.invalidInput }
        return revision
    }

    private static func revision(_ input: IOSInput) throws -> Int {
        try Int(input.integer("expectedConnectionRevision", range: 0...9_007_199_254_740_991))
    }

    private static func uuid(_ input: IOSInput, _ key: String) throws -> UUID {
        guard let id = try UUID(uuidString: input.text(key, maximum: 36)) else { throw Failure.invalidInput }
        return id
    }

    private static func connection(_ view: Connection.View?) -> [String: Any] {
        ["revision": view?.revision ?? 0, "available": view?.available ?? false, "connected": view?.connected ?? false,
         "email": view?.connected == true ? view?.email ?? "" : "", "calendarId": view?.publicationDestination?.id ?? "",
         "calendarName": view?.publicationDestination?.name ?? "", "message": "",
         "canWriteOwnedEvents": view?.canWriteOwnedEvents ?? false,
         "access": view?.access.rawValue ?? "unavailable", "revocation": view?.revocation.rawValue ?? "notRequested"]
    }

    private static func publication(_ status: PublicationRuntime.Status, connection view: Connection.View) -> [String: Any] {
        let entry = status.entry
        let currentWriteScope = entry.identity.account.connectionRevision == view.revision
            && entry.identity.calendarID == view.publicationDestination?.id
        let presentation: (state: String, retryMode: String)
        switch entry.phase {
        case .waiting:
            let retry = status.canRetry && currentWriteScope
            presentation = (retry && !view.canWriteOwnedEvents ? "NeedsAccess" : "Waiting", retry ? "send" : "none")
        case .sent:
            presentation = (view.access == .needsAccess ? "NeedsAccess" : "Unconfirmed", "check")
        case .published: presentation = ("Published", "none")
        case .conflict: presentation = ("Conflict", "none")
        case .failed: presentation = ("Failed", "none")
        case .cancelled: presentation = ("Cancelled", "none")
        }
        return [
            "operationId": entry.identity.operationID.uuidString, "occurrenceId": entry.identity.local.occurrenceID,
            "calendarName": entry.calendarName, "email": view.email, "state": presentation.state,
            "message": "", "htmlLink": entry.confirmation?.htmlLink ?? "",
            "publishedAtMs": iosBridgeValue(entry.confirmedAtMs), "differs": status.differs, "readOnly": status.readOnly,
            "retryMode": presentation.retryMode, "canReviewAgain": status.canReviewAgain, "canCancel": entry.phase == .waiting,
        ]
    }

    private static func event(_ value: Connection.Event.Row) -> [String: Any] {
        ["eventId": value.eventId, "title": providerLabel(value.title), "fields": iosBridgeValue(value.fields.map(fields)),
         "unsupportedReason": iosBridgeValue(value.unsupportedReason?.rawValue), "occurrenceId": iosBridgeValue(value.occurrenceId),
         "erased": value.erased]
    }

    private static func providerLabel(_ value: String) -> String { value.utf8.count <= 4_096 ? value : "" }

    private static func fields(_ value: Connection.Event.Fields) -> [String: Any] {
        ["title": value.title, "notes": value.notes, "schedule": schedule(value.schedule)]
    }

    private static func schedule(_ schedule: Connection.Event.Schedule) -> [String: Any] {
        var bounds: [String: Any] = ["eventStartMs": schedule.eventStartMs, "eventEndMs": schedule.eventEndMs,
                                     "allDay": schedule.allDay, "zoneId": schedule.zoneId]
        if let recurrence = schedule.recurrence { bounds["recurrence"] = recurrence }
        return bounds
    }

    private static func baseline(_ value: Link.Comparison.Baseline) -> [String: Any] {
        var result: [String: Any] = [:]
        if let title = value.title { result["title"] = title }
        if let notes = value.notes { result["notes"] = notes }
        if let bounds = value.schedule { result["schedule"] = schedule(bounds) }
        return result
    }

    private static func timing(_ value: Link.Timing) -> [String: Any] {
        ["mode": value.mode, "dueAtMs": value.dueAtMs, "alarmAtMs": value.alarmAtMs,
         "retainedAlertMs": iosBridgeValue(value.retainedAlertMs)]
    }

    private static func link(_ record: LinkStore.Record, connection view: Connection.View) throws -> [String: Any] {
        let local = try localLinkSnapshot(record.occurrenceID)?.fields
        let differs = local.map { current in
            record.baseline?.title.map { $0 != current.title } == true ||
                record.baseline?.notes.map { $0 != current.notes } == true ||
                record.baseline?.schedule.map { $0 != current.schedule } == true
        } ?? false
        let detached = record.state == .detached
        return [
            "occurrenceId": record.occurrenceID, "revision": record.revision, "calendarName": record.calendarName,
            "state": detached ? "Detached" : (hasReadAccess(view) ? "Linked" : "NeedsAccess"), "syncMode": "Manual",
            "syncStatus": "Confirmed", "accountEmail": view.email, "checkedAtMs": iosBridgeValue(record.observedAtMs),
            "message": "", "htmlLink": "", "availability": detached ? "Unknown" : "Available", "availabilityReason": "",
            "readOnly": local == nil, "differs": differs, "observedAtMs": iosBridgeValue(record.observedAtMs),
            "lastCheckAttemptAtMs": NSNull(), "lastCheckErrorCode": "", "remoteDiffers": NSNull(), "requiresReview": false,
            "source": ["calendarId": record.source.calendarID, "eventId": record.source.eventID, "expectedConnectionRevision": view.revision],
        ]
    }

    private static func hasReadAccess(_ view: Connection.View) -> Bool {
        view.access == .ownedCalendars || view.access == .managedCreation
    }

    private static func localLinkSnapshot(_ id: String) throws -> PublicationRuntime.LocalSnapshot? {
        do { return try RemiloIOSEngine.shared.calendarOneTimeSnapshot(id, for: .manualLink).calendarSnapshot }
        catch is IOSCalendarOneTimeSnapshot.Failure { return nil }
    }

    private static func transfer(_ operation: LinkStore.Operation, connection view: Connection.View) throws -> [String: Any] {
        let local = try localLinkSnapshot(operation.occurrenceID)
        let presentation = transferPresentation(operation, local: local, connection: view)
        let source = operation.erased ? nil : [
            "calendarId": operation.source.calendarID, "eventId": operation.source.eventID,
        ]
        let readOnly = !operation.phase.pending &&
            (operation.erased || local == nil || (operation.phase == .confirmed && operation.resultLinkRevision == nil))
        return [
            "operationId": operation.operationID.uuidString, "occurrenceId": operation.occurrenceID,
            "kind": operation.kind, "calendarName": operation.calendarName, "title": operation.erased ? "" : local?.fields.title ?? "",
            "state": presentation.state, "recoveryMode": presentation.recovery,
            "message": "", "reason": operation.reason.map(bridgeErrorCode) ?? "",
            "localApplied": operation.localApplied, "localStatus": operation.localStatus ?? "",
            "remoteAttempted": operation.remoteAttempted, "readOnly": readOnly,
            "localResult": iosBridgeValue(operation.localStatus.map { ["status": $0] }),
            "source": iosBridgeValue(source),
        ]
    }

    private static func transferPresentation(
        _ operation: LinkStore.Operation, local: PublicationRuntime.LocalSnapshot?, connection view: Connection.View
    ) -> (stage: String, state: String, recovery: String, action: String, currentScope: Bool) {
        let current = operation.account.connectionRevision == view.revision && operation.account.accountGeneration == view.accountGeneration
        let canReview = !operation.erased && local != nil
        switch operation.phase {
        case .waiting, .localApplied:
            let expected = operation.localAfter ?? operation.transfer?.local
            // The engine may already have committed a local change whose
            // receipt has yet to reach the transfer journal.
            let mayRecoverLocal = operation.phase == .waiting && operation.transfer?.needsLocal == true
            let mayResume = current && canReview && (local == expected || mayRecoverLocal)
            let recovery = mayResume ? "Retry" : "ConfirmOutcome"
            if current && (!hasReadAccess(view) || (mayResume && operation.transfer?.needsRemote == true && !view.canWriteOwnedEvents)) {
                return ("NeedsAccess", "NeedsAccess", recovery, "Authorize", current)
            }
            return ("Waiting", "Waiting", recovery, "Retry", current)
        case .sent:
            if !hasReadAccess(view) { return ("NeedsAccess", "NeedsAccess", "ConfirmOutcome", "Authorize", current) }
            return ("Unconfirmed", "Unconfirmed", "ConfirmOutcome", "Retry", current)
        case .confirmed:
            return ("Confirmed", "Confirmed", "None", "None", current)
        case .failed:
            if canReview { return ("NeedsReview", "Conflict", "ReviewAgain", "ReviewItems", current) }
            return ("Failed", "Failed", "None", "None", current)
        case .cancelled:
            return ("Cancelled", "Cancelled", canReview ? "ReviewAgain" : "None", canReview ? "ReviewItems" : "None", current)
        }
    }

    private static func linked(_ operation: Operation) -> [String: Any] {
        let result = presentation(operation)
        let local = operation.receipt?.local
        var resultFields: [String: Any] = [
            "operationId": operation.operationID.uuidString, "occurrenceId": local?.kind == .reminder ? (local?.id ?? "") : "",
            "kind": "ImportCalendarEvent",
            "calendarName": operation.calendarName ?? "", "title": operation.title ?? "", "state": result.state,
            "recoveryMode": result.recovery, "message": "", "reason": operation.receipt?.errorCode.map(bridgeErrorCode) ?? "",
            "localApplied": local != nil,
            "localStatus": local?.status.rawValue ?? "", "remoteAttempted": false, "readOnly": result.recovery == "None",
            "localResult": iosBridgeValue(local.map { ["status": $0.status.rawValue] }),
            "source": ["calendarId": operation.source.calendarID, "eventId": operation.source.eventID],
        ]
        if let local, local.kind == .series { resultFields["segmentId"] = local.id }
        return resultFields
    }

    private static func status(_ operation: Operation, revision: Int) -> [String: Any] {
        let result = presentation(operation)
        return ["operationId": operation.operationID.uuidString, "kind": "ImportCalendarEvent", "stage": result.stage,
                "reason": operation.receipt?.errorCode.map(bridgeErrorCode) ?? "", "action": result.action,
                "confirmed": operation.receipt?.local == nil ? 0 : 1, "pending": operation.receipt == nil ? 1 : 0,
                "review": result.stage == "NeedsReview" ? 1 : 0, "held": 0, "children": [String](),
                "currentScope": operation.account.connectionRevision == revision]
    }

    private static func presentation(_ operation: Operation) -> (stage: String, state: String, recovery: String, action: String) {
        switch operation.phase {
        case .waiting: return ("Waiting", "Waiting", "Retry", "Retry")
        case .checking: return ("CheckingEvents", "Waiting", "None", "None")
        case .creating: return ("AddingReminders", "Waiting", "None", "None")
        case .submitted: return ("Unconfirmed", "Unconfirmed", "Retry", "Retry")
        case .settled:
            if operation.receipt?.local != nil { return ("Confirmed", "Confirmed", "None", "None") }
            switch operation.receipt?.errorCode {
            case "STALE_CONNECTION", "STALE_REMOTE", "STALE_PREVIEW", "ALERT_EXPIRED", "TITLE_REQUIRED",
                 "RECURRENCE_MISMATCH", "RECURRENCE_REVIEW_LIMIT":
                return ("NeedsReview", "Conflict", "ReviewAgain", "ReviewItems")
            default: return ("Failed", "Failed", "None", "None")
            }
        }
    }

    nonisolated static func errorCode(_ error: Error) -> String {
        switch error {
        case let failure as Failure: return failure.rawValue
        case let failure as PublicationRuntime.Rejection: return failure.rawValue
        case let failure as PublicationRuntime.Journal.Rejection: return failure.rawValue
        case let failure as IOSCalendarOneTimeSnapshot.Failure: return failure.rawValue
        case let failure as Link.Failure: return bridgeErrorCode(failure.rawValue)
        case let failure as Link.LocalFailure: return bridgeErrorCode(failure.code)
        case let failure as LinkStore.Rejection: return bridgeErrorCode(failure.rawValue)
        case let failure as Import.Failure: return bridgeErrorCode(failure.rawValue)
        case let failure as RemiloIOSGoogleCalendarRecurringReview.Failure: return bridgeErrorCode(failure.rawValue)
        case let failure as Connection.Event.Reason: return bridgeErrorCode(failure.rawValue)
        case let failure as IOSInputFailure: return failure.code
        case is CancellationError: return "CANCELLED"
        case CocoaError.fileReadNoPermission: return "NEEDS_ACCESS"
        default: return "CALENDAR_UNAVAILABLE"
        }
    }

    private nonisolated static func bridgeErrorCode(_ code: String) -> String {
        switch code {
        case "ALERT_EXPIRED": "ELAPSED_ALERT"
        case "RECURRENCE_REVIEW_REQUIRED", "RECURRENCE_MISMATCH", "RECURRENCE_REVIEW_LIMIT", "INVALID_INSTANCE":
            "UNSUPPORTED_RECURRENCE"
        default: code
        }
    }
}
