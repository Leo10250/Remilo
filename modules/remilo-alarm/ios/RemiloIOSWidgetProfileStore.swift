import Foundation

struct IOSWidgetProfile: Codable {
    struct Completion: Codable {
        let operationID: String
        let occurrenceID: String
        let date: String
        let stepID: String
    }

    let id: String
    var title: String
    var routineID: String
    var revision = 1
    var pending: RemiloWidgetProfileAction?
    var completions: [Completion] = []

    var bridge: [String: Any] {
        ["id": id, "title": title, "routineId": routineID, "revision": revision, "hasPending": pending != nil]
    }
}

struct IOSWidgetProfileDatabase: Codable {
    var schemaVersion = 1
    var profiles: [String: IOSWidgetProfile] = [:]
    var retired: Set<String> = []
}

enum IOSWidgetProfileStore {
    private enum Failure: Error { case unsupportedSchema }

    static func read() throws -> IOSWidgetProfileDatabase {
        do {
            let bytes = try Data(contentsOf: url())
            let database = try JSONDecoder().decode(IOSWidgetProfileDatabase.self, from: bytes)
            guard database.schemaVersion == 1 else { throw Failure.unsupportedSchema }
            return database
        } catch CocoaError.fileReadNoSuchFile {
            return IOSWidgetProfileDatabase()
        }
    }

    static func write(_ database: IOSWidgetProfileDatabase) throws {
        let file = try url()
        var directory = file.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        let bytes = try JSONEncoder().encode(database)
        #if os(iOS)
        try bytes.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try bytes.write(to: file, options: .atomic)
        #endif
    }

    private static func url() throws -> URL {
        try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        .appendingPathComponent("RemiloWidgetProfiles", isDirectory: true)
        .appendingPathComponent("profiles-v1.json")
    }
}
