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

struct IOSCalendarSeriesInstanceChange: Codable, Equatable, Sendable {
    let eventID: String
    let nominalSlot: String
    let previouslyImported: Bool
    let title: String
    let notes: String
    let eventStartMs: Int64
    let eventEndMs: Int64
    let allDay: Bool
    let zoneID: String
}

enum IOSCalendarSeriesInstanceResult: String, Codable, Equatable, Sendable {
    case applied, ignored, deferred, needsReview, elapsedAlert
}
