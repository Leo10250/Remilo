import Foundation
import ZIPFoundation

struct IOSReminderRegistration: Codable {}

@main
struct ArchiveChecks {
    // Java ZipOutputStream, including the data descriptors used by Android.
    // The manifest contains a sentinel routine to check raw transport preservation.
    static let androidArchive = """
    UEsDBBQACAgIAMWOaF0AAAAAAAAAAAAAAAAMAAAAY29udGVudC5qc29uVVDLbsMgEPyXPVM1GBc/bv2AqlIq9VL1wJq1jRQbC3DSKPK/dxO7TcseYIZlZpYLtD4MJkENexrcwYOAI4Xo/Ah1JYC+Jh8S2ef0EqGWRZVnercuAW4wHTH9cQFnWUEpvSsa0iViySX1E+aWWo0yN5kuS9Vqq1qJLRVWZxWanHirENEYiQrZe3ADsdJN+fFEODF3cjb1UGcCenJdz1mVADynq7Uql08B0xw6sns/JzfeAjEX7miLNwWKFI5kH7Y7WO597+vQ/x+/UfxDri6vTTOHQGPzY3RwMW1Hlne//vydo2XVFfbc5cP5CpZvUEsHCDOncBftAAAAdQEAAFBLAwQUAAgICADFjmhdAAAAAAAAAAAAAAAASwAAAG1lZGlhLzMzNjA3Y2U2OGJiOGI4YjE2NWI0ZGVmNmIxNGEyNjg4M2Y2ZDNmMWJmZTdkNjI5YmE0ZTYyOTliYmJhYTFiM2Iud2VicAvydHOTY2BgCHd1CggLsPARBLL1GRsYGNgDVlwqW/K/seNFPQMDAFBLBwiqnInbJwAAACYAAABQSwECFAAUAAgICADFjmhdM6dwF+0AAAB1AQAADAAAAAAAAAAAAAAAAAAAAAAAY29udGVudC5qc29uUEsBAhQAFAAICAgAxY5oXaqcidsnAAAAJgAAAEsAAAAAAAAAAAAAAAAAJwEAAG1lZGlhLzMzNjA3Y2U2OGJiOGI4YjE2NWI0ZGVmNmIxNGEyNjg4M2Y2ZDNmMWJmZTdkNjI5YmE0ZTYyOTliYmJhYTFiM2Iud2VicFBLBQYAAAAAAgACALMAAADHAQAAAAA=
    """

    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        let staging = root.appendingPathComponent("staging")
        let files = RemiloIOSPortableArchive(stagingRoot: staging, exportRoot: root.appendingPathComponent("exports"))

        let input = root.appendingPathComponent("android.remilo")
        let fixture = Data(base64Encoded: androidArchive)!
        try fixture.write(to: input)
        let prepared = try files.stage(from: input)
        precondition(prepared.version == 9 && prepared.images.count == 1)
        precondition(String(decoding: prepared.metadata, as: UTF8.self).contains("preserved-routine"))
        let image = prepared.images[0]
        let imageURL = prepared.imageURL(image)
        let originalImage = try Data(contentsOf: imageURL)
        let saved = try files.export(metadata: prepared.metadata, imageURLs: [image.id: imageURL])
        let roundTrip = try files.stage(from: saved.url)
        let restoredImage = try Data(contentsOf: roundTrip.imageURL(roundTrip.images[0]))
        precondition(saved.imageCount == 1 && roundTrip.metadata == prepared.metadata && restoredImage == originalImage)
        let released = try files.release(roundTrip.handle)
        precondition(released)

        var modifiedImage = originalImage
        modifiedImage[0] ^= 1
        try modifiedImage.write(to: imageURL)
        try expectFailure { _ = try files.validate(prepared.handle) }
        _ = try files.release(prepared.handle)

        let plain = root.appendingPathComponent("legacy.json")
        try Data(#"{"format":"Remilo","version":1,"reminders":[]}"#.utf8).write(to: plain)
        let legacy = try files.stage(from: plain)
        precondition(legacy.version == 1 && legacy.images.isEmpty)
        _ = try files.release(legacy.handle)
        try prepared.metadata.write(to: plain)
        try expectFailure { _ = try files.stage(from: plain) }

        var mismatchedHeader = fixture
        mismatchedHeader[30] = 0x2e
        try mismatchedHeader.write(to: input)
        try expectFailure { _ = try files.stage(from: input) }

        let wrongPath = root.appendingPathComponent("traversal.remilo")
        try makeArchive(at: wrongPath, path: "../content.json", data: prepared.metadata)
        try expectFailure { _ = try files.stage(from: wrongPath) }

        let tooLarge = root.appendingPathComponent("oversized.remilo")
        try makeArchive(at: tooLarge, path: "content.json", data: Data(repeating: 0x20, count: 10_000_001))
        try expectFailure { _ = try files.stage(from: tooLarge) }

        let leftovers = try fm.contentsOfDirectory(atPath: staging.path)
        precondition(leftovers.isEmpty)
        try verifyV9Content()
        try verifyRoutineV9(image: image)
        try verifyLegacy()
        print("iOS portable archive checks passed")
    }

    static func verifyV9Content() throws {
        let now: Int64 = 1_794_260_000_000
        let event: Int64 = 1_799_316_000_000
        let ordinary = IOSReminder(
            id: "plain", title: "晨读", notes: "Preserve authored text.", listID: "list", eventStartMs: event,
            eventEndMs: event + 1_800_000, dueAtMs: event, alarmAtMs: event, zoneID: "UTC", mode: "Alarm",
            allDay: false, dueLinked: true, alarmLinked: true, sound: "system", nextAlertMs: event,
            history: [IOSHistory(kind: "Create", atMs: now, targetMs: nil, portableID: "history")],
            createdAtMs: now, vibration: true
        )
        var template = ordinary
        template.id = "template"
        template.nextAlertMs = nil
        template.history = []
        let rule = try RemiloIOSRecurrence.Rule(anchor: "2027-01-07T12:00", frequency: "daily", zoneID: "UTC")
        let segment = IOSSeriesSegment(id: "segment", familyID: "family", template: template, rule: rule, createdAtMs: now)
        let slot = try RemiloIOSRecurrence.resolve(rule, nominal: rule.anchor, deviceZone: .current)
        let repeating = RemiloIOSSeries.makeOccurrence(segment, slot: slot)
        let excludedNominal = "2027-01-08T12:00"
        let exclusionID = RemiloIOSSeries.occurrenceID(segment.id, excludedNominal)
        var omitted = ordinary
        omitted.id = "trashed"
        omitted.deleted = true
        var test = ordinary
        test.id = "test"
        test.isTest = true

        var state = IOSDatabase()
        state.reminders = [ordinary.id: ordinary, repeating.id: repeating, omitted.id: omitted, test.id: test]
        state.series[segment.id] = segment
        state.excludedOccurrences = [exclusionID]
        state.portableExclusions = [exclusionID: IOSPortableExclusion(segmentID: segment.id, nominalSlot: excludedNominal)]
        state.lists["list"] = IOSList(id: "list", name: "Reading", createdAtMs: now)

        let content = try RemiloIOSPortableContent.encode(state, now: now)
        let bundle = try RemiloIOSPortableContent.decode(content)
        precondition(bundle.reminders.count == 2 && bundle.reminders["plain"]?.title == "晨读")
        precondition(bundle.reminders["plain"]?.vibration == true && bundle.reminders["plain"]?.createdAtMs == now)
        precondition(bundle.exclusions[exclusionID]?.nominalSlot == excludedNominal)
        precondition(bundle.reminders["plain"]?.history.first?.portableID == "history")

        var local = IOSDatabase()
        local.reminders["plain"] = ordinary
        local.series[segment.id] = segment
        local.lists["local"] = IOSList(id: "local", name: "reading")
        let preview = try RemiloIOSPortableContent.preview(bundle, against: local, now: now)
        precondition(preview["count"] as? Int == 2)
        let lists = preview["lists"] as? [[String: Any]]
        precondition(lists?.first?["restoredName"] as? String == "Reading (restored)")
        let keeping = try RemiloIOSPortableContent.planImport(bundle, against: local, copyIDs: [], operationID: "import")
        precondition(keeping.preserved == 2 && keeping.additions.reminders.isEmpty)
        let copying = try RemiloIOSPortableContent.planImport(
            bundle, against: local, copyIDs: ["plain", "family"], operationID: "import"
        )
        precondition(copying.added == 2 && copying.preserved == 0 && copying.additions.reminders.count == 2)
        let copiedSegment = copying.additions.series.values.first!
        let copiedRecordID = RemiloIOSSeries.occurrenceID(copiedSegment.id, slot.nominalSlot)
        let copiedExclusionID = RemiloIOSSeries.occurrenceID(copiedSegment.id, excludedNominal)
        precondition(copying.additions.reminders[copiedRecordID]?.segmentID == copiedSegment.id)
        precondition(copying.additions.exclusions[copiedExclusionID]?.segmentID == copiedSegment.id)

        var unsupported = try JSONSerialization.jsonObject(with: content) as! [String: Any]
        unsupported["routines"] = [["id": "routine"]]
        let withRoutine = try JSONSerialization.data(withJSONObject: unsupported)
        try expectFailure { _ = try RemiloIOSPortableContent.decode(withRoutine) }
    }

    static func verifyRoutineV9(image: RemiloIOSPortableArchive.Media) throws {
        let planID = "exercise-routine"
        let date = "2027-01-07"
        let occurrenceID = RemiloIOSSeries.occurrenceID(planID, date)
        let zone = TimeZone(secondsFromGMT: 0)!
        let due = try RemiloIOSRoutineAuthoring.time(date, minutes: 480, in: zone)
        let step = IOSRoutineStep(
            id: "step", name: "拉伸", target: "", notes: "Keep the authored note.", illustration: nil,
            customImageId: image.id, sharedStepId: nil,
            exerciseTarget: IOSExerciseTarget(sets: 2, duration: .init(value: 30, unit: "sec"))
        )
        let days = (0..<7).map { IOSRoutineDay(exercises: $0 == 3 ? [step] : []) }
        let version = IOSRoutineVersion(
            effectiveDate: date, revision: 1, title: "运动", minutes: 480, mode: "Notification",
            notes: "Routine notes", sound: "system", vibration: true, listID: nil, authoringMode: "ByWeekday",
            presentationPreset: "Exercise", days: days
        )
        var state = IOSDatabase()
        state.routines[planID] = IOSRoutinePlan(id: planID, startsOn: date, versions: [version])
        state.routineSessions[occurrenceID] = IOSRoutineSession(
            routineID: planID, occurrenceID: occurrenceID, date: date, versionRevision: 1, steps: [step],
            ended: true, done: [step.id], changes: [
                IOSRoutineChange(id: "step-check", kind: "SetRoutineExercise", stepID: step.id, completed: true, atMs: due)
            ]
        )
        state.reminders[occurrenceID] = IOSReminder(
            id: occurrenceID, title: version.title, notes: version.notes, listID: nil, eventStartMs: due,
            eventEndMs: due + 1_800_000, dueAtMs: due, alarmAtMs: due, zoneID: "UTC", mode: version.mode,
            allDay: true, dueLinked: false, alarmLinked: false, sound: version.sound, routineID: planID,
            nominalSlot: date, completed: true, vibration: version.vibration
        )
        state.purgedRoutines = ["old-plan"]
        let metadata = RemiloIOSPortableContent.Image(id: image.id, width: image.width, height: image.height, bytes: image.bytes)
        let encoded = try RemiloIOSPortableContent.encode(state, now: due, images: [metadata])
        try expectFailure { _ = try RemiloIOSPortableContent.decode(encoded) }
        let decoded = try RemiloIOSPortableContent.decode(encoded, availableImageIDs: [image.id])
        precondition(decoded.routines[planID]?.versions.first?.days[3].exercises.first == step)
        precondition(decoded.routineSessions[occurrenceID]?.done == [step.id])
        precondition(decoded.routineSessions[occurrenceID]?.ended == true)
        precondition(decoded.purgedRoutines == ["old-plan"])
        let originalSlot = decoded.routines[planID]?.portableSlots?[date]
        precondition(originalSlot?.nominalSlot == "2027-01-07T08:00")

        let imported = try RemiloIOSPortableContent.planImport(
            decoded, against: state, copyIDs: [planID], operationID: "restore-copy"
        )
        let copy = imported.additions.routines.values.first!
        precondition(copy.id != planID && imported.added == 1 && imported.preserved == 0)
        precondition(copy.portableSlots?[date]?.segmentID != originalSlot?.segmentID)
        let localID = RemiloIOSSeries.occurrenceID(copy.id, date)
        precondition(imported.additions.routineSessions[localID]?.done == [step.id])
        precondition(imported.additions.reminders[localID]?.completed == true)
    }

    static func expectFailure(_ work: () throws -> Void) throws {
        do { try work() } catch { return }
        preconditionFailure("Invalid backup accepted")
    }

    static func makeArchive(at url: URL, path: String, data: Data) throws {
        let archive = try Archive(url: url, accessMode: .create)
        try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(data.count), compressionMethod: .deflate) {
            position, size in
            let start = Int(position)
            return data.subdata(in: start..<(start + size))
        }
    }
}
