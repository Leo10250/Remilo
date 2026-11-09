import CryptoKit
import Foundation

/// A widget tap binds the displayed step to an exact dated session revision.
struct RemiloWidgetDoneAction {
    let occurrenceID: String
    let date: String
    let revision: Int
    let stepID: String

    init?(occurrenceID: String, date: String, revision: Int, stepID: String) {
        guard UUID(uuidString: occurrenceID) != nil,
              date.utf8.count == 10,
              (0...9_007_199_254_740_991).contains(revision),
              stepID.utf16.count <= 200, !stepID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard let instant = formatter.date(from: date), formatter.string(from: instant) == date else { return nil }
        self.occurrenceID = occurrenceID
        self.date = date
        self.revision = revision
        self.stepID = stepID
    }

    var operationID: String {
        let fields = [occurrenceID, date, String(revision), stepID]
        let input = fields.map { "\($0.utf8.count):\($0)" }.joined()
        let digest = SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
        return "ios-widget:done:" + digest
    }

    var command: [String: Any] {
        [
            "kind": "SetRoutineExercise", "operationId": operationID, "occurrenceId": occurrenceID,
            "date": date, "stepId": stepID, "expectedRevision": revision, "completed": true,
        ]
    }
}
