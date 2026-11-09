import Foundation

struct IOSPreparedImport {
    let content: RemiloIOSPortableContent.Bundle
    var installImages: ((Set<String>) async throws -> Void)? = nil
}

extension RemiloIOSEngine {
    func mergeImport(_ additions: RemiloIOSPortableContent.Bundle, state: inout IOSDatabase, now: Int64) {
        state.lists.merge(additions.lists) { existing, _ in existing }
        state.series.merge(additions.series) { existing, _ in existing }
        let today = RemiloIOSRoutineAuthoring.localDate(iosDate(now), in: .current)
        let importBoundary = try? RemiloIOSRoutineAuthoring.date(today, plusDays: -1)
        for (id, var plan) in additions.routines where state.routines[id] == nil {
            plan.historyThrough = importBoundary
            state.routines[id] = plan
        }
        state.routineSessions.merge(additions.routineSessions) { existing, _ in existing }
        state.purgedRoutines = (state.purgedRoutines ?? []).union(additions.purgedRoutines)
        var exclusions = state.portableExclusions ?? [:]
        exclusions.merge(additions.exclusions) { existing, _ in existing }
        state.portableExclusions = exclusions
        state.excludedOccurrences.formUnion(additions.exclusions.keys)
        for (id, var record) in additions.reminders {
            let target = record.nextAlertMs ?? record.alarmAtMs
            record.nextAlertMs = nil
            if !record.active || record.mode == "None" {
                replaceRegistration(&record, target: nil, state: &state, now: now)
            } else if let routineID = record.routineID, let plan = state.routines[routineID] {
                let ended = state.routineSessions[id]?.ended == true
                record.deliveryState = ended ? "Expired" : plan.state == "Active" && target > now ? "Pending" : "Paused"
                if record.deliveryState == "Pending" { record.nextAlertMs = target }
            } else if record.segmentID == nil || record.independent == true {
                let pending = additions.reminders[id]?.nextAlertMs
                replaceRegistration(&record, target: pending, state: &state, now: now)
                if pending == nil && record.alarmAtMs > now { record.deliveryState = "Stopped" }
            } else if let segmentID = record.segmentID, state.series[segmentID]?.state == "Paused" {
                record.deliveryState = "Paused"
                record.nextAlertMs = target > now ? target : nil
            } else {
                record.deliveryState = target > now ? "Pending" : "Missed"
            }
            state.reminders[id] = record
        }
    }
}
