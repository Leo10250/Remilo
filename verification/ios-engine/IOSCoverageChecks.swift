@main
enum IOSCoverageChecks {
    private typealias Candidate = RemiloIOSCoverage.Candidate

    static func main() {
        let candidates = [
            candidate("elapsed", at: 1),
            candidate("distant", at: 100_000_000),
            candidate("series-a-2", at: 130, source: "a"),
            candidate("series-a-1", at: 120, source: "a"),
            candidate("series-b-1", at: 150, source: "b"),
            candidate("one-time", at: 200),
            candidate("alerting", at: 90, retain: true),
        ]
        assert(RemiloIOSCoverage.admitted(candidates, limit: 4, now: 100) == [
            "alerting", "one-time", "series-a-1", "series-b-1",
        ])
        assert(RemiloIOSCoverage.admitted(candidates, limit: 5, now: 100) == [
            "alerting", "one-time", "series-a-1", "series-b-1", "series-a-2",
        ])
        assert(RemiloIOSCoverage.admitted(candidates, limit: 0, now: 100) == ["alerting"])
        let retainedSource = [
            candidate("a-1", at: 110, source: "a", retain: true),
            candidate("a-2", at: 120, source: "a"),
            candidate("b-1", at: 130, source: "b"),
        ]
        assert(RemiloIOSCoverage.admitted(retainedSource, limit: 2, now: 100) == ["a-1", "b-1"])
        let sameTime = [candidate("b", at: 110), candidate("a", at: 110)]
        assert(RemiloIOSCoverage.admitted(sameTime, limit: 1, now: 100) == ["a"])
        print("iOS registration budget checks passed")
    }

    private static func candidate(
        _ id: String, at targetMs: Int64, source: String? = nil, retain: Bool = false
    ) -> Candidate {
        Candidate(occurrenceID: id, targetMs: targetMs, rollingSourceID: source, retain: retain)
    }
}
