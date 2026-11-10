struct IOSCalendarSeriesTextSnapshot: Codable, Equatable, Sendable {
    struct ScheduleEdit: Codable, Equatable, Sendable {
        let baseline: RemiloIOSRecurrence.Rule
        let current: RemiloIOSRecurrence.Rule
        let hasFutureExceptions: Bool
    }

    let familyID: String
    let segmentID: String
    let revision: Int
    let title: String
    let notes: String
    var scheduleEdit: ScheduleEdit? = nil
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
