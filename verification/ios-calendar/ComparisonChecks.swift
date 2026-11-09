import Foundation

enum ComparisonChecks {
    typealias Comparison = RemiloIOSGoogleCalendarComparison
    typealias Event = RemiloIOSGoogleCalendarEvent

    static func run() {
        let base = fields()
        let baseline = Comparison.Baseline(title: base.title, notes: base.notes, schedule: base.schedule)
        let unchanged = Comparison.compare(local: base, remote: base, baseline: baseline)
        precondition(unchanged.inbound.isEmpty && unchanged.outbound.isEmpty && unchanged.conflicts.isEmpty)
        precondition(Comparison.compare(local: fields(title: "Local"), remote: base, baseline: baseline).outbound == [.title])
        precondition(Comparison.compare(local: base, remote: fields(start: 2_000), baseline: baseline).inbound == [.schedule])
        let shared = fields(title: "Shared")
        let sameChange = Comparison.compare(local: shared, remote: shared, baseline: baseline)
        precondition(sameChange.inbound.isEmpty && sameChange.outbound.isEmpty && sameChange.conflicts.isEmpty)
        precondition(Comparison.compare(local: fields(title: "Local"), remote: fields(title: "Google"), baseline: baseline).conflicts == [.title])

        let local = fields(title: "Local")
        let remote = fields(title: "Google", notes: "", start: 2_000)
        let merged = Comparison.compare(local: local, remote: fields(notes: "", start: 2_000), baseline: baseline)
        precondition(merged.outbound == [.title] && merged.inbound == [.notes, .schedule])
        precondition(merged.desired == fields(title: "Local", notes: "", start: 2_000))
        precondition(Comparison.compare(local: local, remote: remote, baseline: nil).conflicts == [.title, .notes, .schedule])
        let partial = Comparison.Baseline(title: base.title, notes: nil, schedule: base.schedule)
        let partialResult = Comparison.compare(local: local, remote: remote, baseline: partial)
        precondition(partialResult.conflicts == [.title, .notes] && partialResult.inbound == [.schedule])

        precondition(Comparison.resolve(local: local, remote: remote, choices: [.title: .remilo]) == nil)
        let resolution = Comparison.resolve(
            local: local, remote: remote, choices: [.title: .remilo, .notes: .google, .schedule: .google]
        )!
        precondition(resolution.desired == merged.desired)
        precondition(resolution.inbound == [.notes, .schedule] && resolution.outbound == [.title])
        let observedLocal = fields(title: "Local", notes: "", start: 2_000)
        let observedRemote = fields(title: "Local", notes: "Edited during review", start: 2_000)
        let advanced = Comparison.confirmedBaseline(
            previous: baseline, intended: resolution.desired, observedLocal: observedLocal,
            observedRemote: observedRemote, groups: [.title, .notes, .schedule]
        )
        precondition(advanced.title == "Local" && advanced.notes == "Notes" && advanced.schedule == resolution.desired.schedule)
        let acknowledgement = Comparison.confirmedBaseline(
            previous: nil, intended: resolution.desired, observedLocal: observedLocal,
            observedRemote: observedRemote, groups: [.title]
        )
        precondition(acknowledgement.title == "Local" && acknowledgement.notes == nil && acknowledgement.schedule == nil)
    }

    private static func fields(title: String = "Title", notes: String = "Notes", start: Int64 = 1_000) -> Event.Fields {
        Event.Fields(title: title, notes: notes, schedule: Event.Schedule(
            eventStartMs: start, eventEndMs: start + 1_000, allDay: false, zoneId: "UTC", recurrence: nil
        ))
    }
}
