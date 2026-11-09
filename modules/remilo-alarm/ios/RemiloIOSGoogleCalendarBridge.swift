import Foundation

@MainActor
final class RemiloIOSGoogleCalendarBridge {
    typealias Runtime = RemiloIOSGoogleCalendarRuntime
    typealias Connection = Runtime.Connection
    typealias Import = Runtime.Import
    typealias Operation = Runtime.ImportJournal.SavedOperation
    typealias Failure = Runtime.Failure
    typealias PublicationRuntime = RemiloIOSGoogleCalendarPublicationRuntime

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
        case "RetryCalendarOperation":
            let receipt = try await runtime.recoverImport(operationID: operation, expectedRevision: revision)
            return Self.linked(Operation(receipt: receipt))
        default: throw Failure.invalidInput
        }
    }

    func operation(_ id: String, expectedRevision: Double?) async throws -> [String: Any]? {
        guard let id = UUID(uuidString: id) else { throw Failure.invalidInput }
        let revision = try Self.revision(expectedRevision)
        return try await runtime().savedImportOperation(id, expectedRevision: revision).map { Self.status($0, revision: revision) }
    }

    func operations(expectedRevision: Double?) async throws -> [[String: Any]] {
        let revision = try Self.revision(expectedRevision)
        return try await runtime().savedImportOperations(expectedRevision: revision).map(Self.linked)
    }

    private func runtime() throws -> Runtime {
        guard let runtime = try Runtime.configuredForegroundRuntime() else { throw Failure.invalidConfiguration }
        return runtime
    }

    private static func publicationRuntime(_ runtime: Runtime) throws -> PublicationRuntime {
        guard let publication = runtime.publication else { throw Failure.invalidConfiguration }
        return publication
    }

    private func publicationResult(_ entry: PublicationRuntime.Journal.Entry, runtime: Runtime,
                                   revision: Int) async throws -> [String: Any] {
        let view = try await runtime.view()
        guard view.revision == revision else { throw Failure.staleConnection }
        return Self.publication(try Self.publicationRuntime(runtime).status(entry), connection: view)
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
        let schedule = value.schedule
        var bounds: [String: Any] = ["eventStartMs": schedule.eventStartMs, "eventEndMs": schedule.eventEndMs,
                                     "allDay": schedule.allDay, "zoneId": schedule.zoneId]
        if let recurrence = schedule.recurrence { bounds["recurrence"] = recurrence }
        return ["title": value.title, "notes": value.notes, "schedule": bounds]
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
        case let failure as IOSCalendarPublicationSnapshot.Failure: return failure.rawValue
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
