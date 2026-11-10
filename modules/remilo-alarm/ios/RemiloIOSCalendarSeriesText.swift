struct IOSCalendarSeriesTextSnapshot: Codable, Equatable, Sendable {
    let familyID: String
    let segmentID: String
    let revision: Int
    let title: String
    let notes: String
}
