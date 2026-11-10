struct IOSCalendarSeriesTextSnapshot: Codable, Equatable, Sendable {
    let familyID: String
    let segmentID: String
    let revision: Int
    let title: String
    let notes: String
}

struct IOSCalendarSeriesScheduleChange: Codable, Sendable {
    let rule: RemiloIOSRecurrence.Rule
    let eventStartMs: Int64
    let eventEndMs: Int64
    let title: String
    let notes: String
}

enum IOSCalendarSeriesScheduleResult: Equatable, Sendable {
    case applied, deferred, needsReview, elapsedAlert
}
