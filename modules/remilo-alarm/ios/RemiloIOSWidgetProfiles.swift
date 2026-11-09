import Foundation

enum IOSWidgetProfilePolicy {
    static func session(_ profile: IOSWidgetProfile, date: String, state: IOSDatabase) -> IOSRoutineSession? {
        let id = RemiloIOSSeries.occurrenceID(profile.routineID, date)
        guard state.routines[profile.routineID]?.state == "Active",
              let session = state.routineSessions[id], session.routineID == profile.routineID,
              session.date == date, !session.ended, !session.steps.isEmpty,
              let record = state.reminders[id], !record.deleted, record.skipped != true else { return nil }
        return session
    }

    static func latestCompletion(
        _ profile: IOSWidgetProfile, session: IOSRoutineSession
    ) -> IOSWidgetProfile.Completion? {
        profile.completions.last { completion in
            guard completion.occurrenceID == session.occurrenceID, completion.date == session.date,
                  session.done.contains(completion.stepID),
                  let latest = session.changes.last(where: { $0.stepID == completion.stepID }) else { return false }
            return latest.id == completion.operationID && latest.completed == true
        }
    }

    static func action(
        _ profile: IOSWidgetProfile, session: IOSRoutineSession, stepID: String, undoOperationID: String? = nil
    ) -> RemiloWidgetProfileAction {
        RemiloWidgetProfileAction(
            profileID: profile.id, profileRevision: profile.revision, occurrenceID: session.occurrenceID,
            date: session.date, sessionRevision: session.revision, stepID: stepID, undoOperationID: undoOperationID
        )
    }

    static func matches(
        _ action: RemiloWidgetProfileAction, profile: IOSWidgetProfile, today: String, state: IOSDatabase
    ) -> Bool {
        guard action.isValid, profile.revision == action.profileRevision, action.date == today,
              let session = session(profile, date: today, state: state),
              session.occurrenceID == action.occurrenceID, session.revision == action.sessionRevision else { return false }
        if let undoID = action.undoOperationID {
            let prior = latestCompletion(profile, session: session)
            return prior?.operationID == undoID && prior?.stepID == action.stepID
        }
        return session.steps.first(where: { !session.done.contains($0.id) })?.id == action.stepID
    }
}

/// The App Group never owns progress or profile writes. This app-process queue
/// serializes profile commands while the engine owns the actual routine mutation.
@MainActor
final class RemiloIOSWidgetProfiles {
    static let shared = RemiloIOSWidgetProfiles(engine: .shared)

    private let engine: RemiloIOSEngine
    private let loadDatabase: () throws -> IOSWidgetProfileDatabase
    private let saveDatabase: (IOSWidgetProfileDatabase) throws -> Void
    private var cached: IOSWidgetProfileDatabase?
    private var busy = false
    private var waiting: [CheckedContinuation<Void, Never>] = []

    init(
        engine: RemiloIOSEngine,
        load: @escaping () throws -> IOSWidgetProfileDatabase = IOSWidgetProfileStore.read,
        save: @escaping (IOSWidgetProfileDatabase) throws -> Void = IOSWidgetProfileStore.write
    ) {
        self.engine = engine
        self.loadDatabase = load
        self.saveDatabase = save
    }

    func list() throws -> [[String: Any]] {
        try profiles().map(\.bridge)
    }

    func profiles() throws -> [IOSWidgetProfile] {
        try read().profiles.values.sorted { ($0.title, $0.id) < ($1.title, $1.id) }
    }

    func save(id: String, title: String, routineID: String, expectedRevision: Int) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard UUID(uuidString: id) != nil, (0..<9_007_199_254_740_991).contains(expectedRevision) else {
            throw IOSInputFailure("INVALID_INPUT")
        }
        guard !name.isEmpty, name.utf16.count <= 120 else { throw IOSInputFailure("INVALID_INPUT", field: "title") }
        var database = try read()
        let previous = database.profiles[id]
        if let previous, previous.revision == expectedRevision + 1, previous.title == name, previous.routineID == routineID {
            return previous.bridge
        }
        guard !database.retired.contains(id), (previous?.revision ?? 0) == expectedRevision else {
            throw IOSInputFailure("STALE_REVISION")
        }
        guard previous?.pending == nil else { throw IOSInputFailure("WIDGET_ACTION_PENDING") }
        guard let routine = try engine.read().routines[routineID], routine.state != "Trashed" else {
            throw IOSInputFailure("NOT_FOUND", field: "routineId")
        }
        guard previous != nil || database.profiles.count < 64 else { throw IOSInputFailure("NOT_ELIGIBLE") }
        guard !database.profiles.values.contains(where: { $0.id != id && $0.title.caseInsensitiveCompare(name) == .orderedSame }) else {
            throw IOSInputFailure("INVALID_INPUT", field: "title")
        }
        let completions = previous?.routineID == routineID ? previous?.completions ?? [] : []
        let profile = IOSWidgetProfile(
            id: id, title: name, routineID: routineID, revision: expectedRevision + 1, completions: completions
        )
        database.profiles[id] = profile
        try commit(database)
        return profile.bridge
    }

    func remove(id: String, expectedRevision: Int) async throws {
        await acquire()
        defer { release() }
        var database = try read()
        if database.retired.contains(id) { return }
        guard let profile = database.profiles[id], profile.revision == expectedRevision else {
            throw IOSInputFailure("STALE_REVISION")
        }
        database.profiles.removeValue(forKey: id)
        database.retired.insert(id)
        try commit(database)
    }

    func perform(_ action: RemiloWidgetProfileAction, now: Date = Date(), zone: TimeZone = .current) async throws -> [String: Any] {
        await acquire()
        defer { release() }
        guard action.isValid else { return IOSInputFailure("INVALID_INPUT").bridge }
        var database = try read()
        let state = try engine.read()
        if state.receipts[action.operationID] != nil {
            let result = try await engine.apply(action.command)
            try finish(action, result: result, database: &database)
            return result
        }
        guard var profile = database.profiles[action.profileID], profile.pending == nil || profile.pending == action else {
            return IOSInputFailure("STALE_WIDGET").bridge
        }
        let today = RemiloIOSRoutineAuthoring.localDate(now, in: zone)
        guard IOSWidgetProfilePolicy.matches(action, profile: profile, today: today, state: state) else {
            try finish(action, result: ["status": "Rejected"], database: &database)
            return IOSInputFailure("STALE_WIDGET").bridge
        }
        if profile.pending == nil {
            profile.pending = action
            database.profiles[profile.id] = profile
            try commit(database)
        }
        let result = try await engine.apply(action.command)
        try finish(action, result: result, database: &database)
        return result
    }

    /// A native receipt can resolve an interrupted acknowledgement without
    /// running a pending command that did not reach the engine.
    func reconcile(now: Date = Date(), zone: TimeZone = .current) async throws {
        await acquire()
        defer { release() }
        var database = try read()
        let today = RemiloIOSRoutineAuthoring.localDate(now, in: zone)
        let pending = database.profiles.values.compactMap(\.pending)
        for action in pending {
            guard let profile = database.profiles[action.profileID] else { continue }
            let state = try engine.read()
            if action.isValid, state.receipts[action.operationID] != nil {
                let result = try await engine.apply(action.command)
                try finish(action, result: result, database: &database)
            } else if !IOSWidgetProfilePolicy.matches(action, profile: profile, today: today, state: state) {
                try finish(action, result: ["status": "Rejected"], database: &database)
            }
        }
    }

    private func finish(_ action: RemiloWidgetProfileAction, result: [String: Any], database: inout IOSWidgetProfileDatabase) throws {
        guard var profile = database.profiles[action.profileID], profile.pending == action,
              let status = result["status"] as? String, ["Applied", "Rejected"].contains(status) else { return }
        if status == "Applied" {
            if let undoID = action.undoOperationID {
                profile.completions.removeAll { $0.operationID == undoID }
            } else {
                profile.completions.removeAll { $0.date != action.date || $0.operationID == action.operationID }
                profile.completions.append(IOSWidgetProfile.Completion(
                    operationID: action.operationID, occurrenceID: action.occurrenceID, date: action.date, stepID: action.stepID
                ))
                profile.completions = Array(profile.completions.suffix(100))
            }
        }
        profile.pending = nil
        database.profiles[profile.id] = profile
        try commit(database)
    }

    private func read() throws -> IOSWidgetProfileDatabase {
        if let cached { return cached }
        let database = try loadDatabase()
        cached = database
        return database
    }

    private func commit(_ database: IOSWidgetProfileDatabase) throws {
        try saveDatabase(database)
        cached = database
        NotificationCenter.default.post(name: .remiloIOSChange, object: nil)
    }

    private func acquire() async {
        if !busy {
            busy = true
            return
        }
        await withCheckedContinuation { waiting.append($0) }
    }

    private func release() {
        if waiting.isEmpty { busy = false }
        else { waiting.removeFirst().resume() }
    }
}
