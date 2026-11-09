import CryptoKit
import Foundation

/// Contains opaque widget, routine-session and step identities only.
struct RemiloWidgetProfileAction: Codable, Equatable {
    let profileID: String
    let profileRevision: Int
    let occurrenceID: String
    let date: String
    let sessionRevision: Int
    let stepID: String
    let undoOperationID: String?

    private static let prefix = "ios-widget-profile:"

    var isValid: Bool {
        guard UUID(uuidString: profileID) != nil, (1...9_007_199_254_740_991).contains(profileRevision),
              RemiloWidgetDoneAction(occurrenceID: occurrenceID, date: date, revision: sessionRevision, stepID: stepID) != nil else {
            return false
        }
        guard let undoOperationID else { return true }
        guard undoOperationID.hasPrefix(Self.prefix) else { return false }
        let digest = undoOperationID.dropFirst(Self.prefix.count)
        return digest.utf8.count == 64 && digest.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
    }

    var operationID: String {
        let fields = [profileID, String(profileRevision), occurrenceID, date, String(sessionRevision), stepID, undoOperationID ?? ""]
        let key = fields.map { "\($0.utf8.count):\($0)" }.joined()
        return Self.prefix + SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    var command: [String: Any] {
        [
            "kind": "SetRoutineExercise", "operationId": operationID, "occurrenceId": occurrenceID,
            "date": date, "stepId": stepID, "expectedRevision": sessionRevision, "completed": undoOperationID == nil,
        ]
    }

    var token: String? {
        try? JSONEncoder().encode(self).base64EncodedString()
    }

    static func decode(token: String) -> Self? {
        guard token.utf8.count <= 4_096, let data = Data(base64Encoded: token),
              let action = try? JSONDecoder().decode(Self.self, from: data), action.isValid else { return nil }
        return action
    }
}
