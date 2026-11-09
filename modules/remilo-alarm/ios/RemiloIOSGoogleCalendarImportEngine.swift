import Foundation

extension RemiloIOSGoogleCalendarImportJournal.Scheduler {
    /// This adapter is native-only. The journal retains the exact command and the
    /// ordinary scheduler receipt remains the durable local authority.
    @MainActor
    static func localEngine(_ engine: RemiloIOSEngine) -> Self {
        Self(receipt: { command in
            try await Self.lookup(engine, command: command)
        }, create: { command, permit in
            try await Self.apply(engine, command: command, permit: permit)
        })
    }

    @MainActor
    private static func lookup(_ engine: RemiloIOSEngine, command: RemiloIOSGoogleCalendarImport.Command) throws
        -> RemiloIOSGoogleCalendarImportJournal.LocalReceipt? {
        guard let output = try engine.calendarCreateReceipt(command.payload) else { return nil }
        return try receipt(output)
    }

    @MainActor
    private static func apply(_ engine: RemiloIOSEngine, command: RemiloIOSGoogleCalendarImport.Command, permit: @escaping Permit)
        async throws -> RemiloIOSGoogleCalendarImportJournal.LocalResult {
        let output = try await engine.applyCalendarCreate(command.payload, authorize: permit)
        if output["status"] as? String == "Rejected" {
            return .rejected(output["errorCode"] as? String ?? "INVALID_INPUT")
        }
        return .acknowledged(try receipt(output))
    }

    private static func receipt(_ value: [String: Any]) throws -> RemiloIOSGoogleCalendarImportJournal.LocalReceipt {
        typealias Receipt = RemiloIOSGoogleCalendarImportJournal.LocalReceipt
        guard let id = value["localId"] as? String, !id.isEmpty,
              let rawKind = value["localKind"] as? String, let kind = Receipt.Kind(rawValue: rawKind),
              let rawStatus = value["status"] as? String, let status = Receipt.Status(rawValue: rawStatus),
              let eligible = value["eligibleForLink"] as? Bool else { throw IOSInputFailure("INVALID_RESPONSE") }
        return Receipt(id: id, kind: kind, status: status, eligibleForLink: eligible)
    }
}
