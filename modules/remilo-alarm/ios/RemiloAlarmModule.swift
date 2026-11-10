import ExpoModulesCore
import Foundation

extension Notification.Name {
  static let remiloIOSChange = Notification.Name("remilo.ios.change")
}

public final class RemiloAlarmModule: Module {
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("RemiloAlarm")
    Events("onChange", "onTimeDisplayPreferencesChanged", "onDeliveryRequested", "onSoundPreviewState")

    OnCreate {
      let center = NotificationCenter.default
      observers = [
        center.addObserver(forName: .remiloIOSChange, object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onChange")
          self?.publishTimePreferences()
        },
        center.addObserver(forName: .remiloIOSDeliveryRequested, object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onDeliveryRequested")
        },
        center.addObserver(forName: .remiloIOSSoundPreviewChanged, object: nil, queue: .main) { [weak self] event in
          if let snapshot = event.object as? [String: Any] { self?.sendEvent("onSoundPreviewState", snapshot) }
        },
        center.addObserver(forName: NSLocale.currentLocaleDidChangeNotification, object: nil, queue: .main) {
          [weak self] _ in self?.publishTimePreferences()
        }
      ]
    }
    OnDestroy {
      observers.forEach { NotificationCenter.default.removeObserver($0) }
      observers.removeAll()
    }

    Function("createOperationId") { UUID().uuidString }
    AsyncFunction("getTimeDisplayPreferences") { (promise: Promise) in
      resolve(promise) { try Self.timePreferences() }
    }
    AsyncFunction("getSettings") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.settings() }
    }
    AsyncFunction("getWidgetSupport") { (promise: Promise) in
      resolve(promise) {
        ["pinSupported": false, "instanceCount": 0, "profilesAvailable": Self.widgetProfilesAvailable] as [String: Any]
      }
    }
    AsyncFunction("getWidgetProfiles") { (promise: Promise) in
      resolve(promise) {
        guard Self.widgetProfilesAvailable else { throw IOSInputFailure("UNSUPPORTED") }
        return try RemiloIOSWidgetProfiles.shared.list()
      }
    }
    AsyncFunction("saveWidgetProfile") { (id: String, title: String, routineID: String, revision: Int, promise: Promise) in
      resolve(promise) {
        guard Self.widgetProfilesAvailable else { throw IOSInputFailure("UNSUPPORTED") }
        return try await RemiloIOSWidgetProfiles.shared.save(
          id: id, title: title, routineID: routineID, expectedRevision: revision
        )
      }
    }
    AsyncFunction("removeWidgetProfile") { (id: String, revision: Int, promise: Promise) in
      resolve(promise) {
        guard Self.widgetProfilesAvailable else { throw IOSInputFailure("UNSUPPORTED") }
        try await RemiloIOSWidgetProfiles.shared.remove(id: id, expectedRevision: revision)
        return nil
      }
    }
    AsyncFunction("getCapabilities") { (promise: Promise) in
      resolve(promise) {
        var capabilities = await RemiloIOSDelivery.capabilities()
        capabilities["calendarOneOffImport"] = RemiloIOSGoogleCalendarBridge.available
        capabilities["calendarOneOffPublish"] = RemiloIOSGoogleCalendarBridge.available
        capabilities["calendarManualLink"] = RemiloIOSGoogleCalendarBridge.available
        capabilities["calendarAutomaticLink"] = RemiloIOSGoogleCalendarBridge.available
        if capabilities["unlocked"] as? Bool == true, capabilities["exactAlarms"] as? Bool == true,
           let group = try? await RemiloIOSEngine.shared.activeDeliveryGroup() {
          capabilities["activeSessionId"] = group["sessionId"]
          capabilities["activeSessionActions"] = group
        }
        return capabilities
      }
    }
    AsyncFunction("getDiagnostics") { (promise: Promise) in
      resolve(promise) {
        let state = try RemiloIOSEngine.shared.read()
        var report = RemiloIOSProjection.diagnostics(state, now: iosMillis(Date()))
        report["capabilities"] = await RemiloIOSDelivery.capabilities()
        return report
      }
    }
    AsyncFunction("queryReminders") { (filter: [String: Any], cursor: String?, promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.query(filter, cursor: cursor) }
    }
    AsyncFunction("getOccurrence") { (id: String, promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.occurrence(id) }
    }
    AsyncFunction("querySeries") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.querySeries() }
    }
    AsyncFunction("queryRepeatFamilies") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.queryRepeatFamilies() }
    }
    AsyncFunction("getSeries") { (id: String, promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.getSeries(id) }
    }
    AsyncFunction("getSeriesDraft") { (id: String, nominal: String, promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.getSeriesDraft(id, nominal: nominal) }
    }
    AsyncFunction("queryRoutines") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.queryRoutines() }
    }
    AsyncFunction("previewRoutine") { (draft: [String: Any], promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.previewRoutine(draft) }
    }
    AsyncFunction("getRoutineSession") { (id: String, date: String?, promise: Promise) in
      resolve(promise) { try await RemiloIOSEngine.shared.getRoutineSession(id, date: date) }
    }
    AsyncFunction("queryRoutineHistory") { (id: String, cursor: String?, promise: Promise) in
      resolve(promise) { try await RemiloIOSEngine.shared.queryRoutineHistory(id, cursor: cursor) }
    }
    AsyncFunction("chooseExercisePhoto") { (request: String, promise: Promise) in
      resolve(promise) { try await RemiloIOSExerciseMedia.shared.choose(request) }
    }
    AsyncFunction("getExerciseImage") { (id: String, lease: String?, promise: Promise) in
      resolve(promise) { try RemiloIOSExerciseMedia.shared.get(id, lease: lease) }
    }
    AsyncFunction("releaseExerciseImage") { (lease: String, promise: Promise) in
      resolve(promise) { try RemiloIOSExerciseMedia.shared.release(lease) }
    }
    AsyncFunction("getLists") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.lists() }
    }
    AsyncFunction("queryLists") { (promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.lists() }
    }
    AsyncFunction("prepareBackupImport") { (uri: String, promise: Promise) in
      resolve(promise) {
        guard let url = URL(string: uri), url.isFileURL else { throw IOSInputFailure("INVALID_INPUT") }
        let (archive, staged, bundle) = try await Task.detached(priority: .userInitiated) {
          let archive = try RemiloIOSPortableArchive.live()
          let staged = try archive.stage(from: url)
          do {
            let images = Set(staged.images.map(\.id))
            return (archive, staged, try RemiloIOSPortableContent.decode(staged.metadata, availableImageIDs: images))
          } catch {
            _ = try? archive.release(staged.handle)
            throw error
          }
        }.value
        do {
          let state = try RemiloIOSEngine.shared.read()
          var preview = try RemiloIOSPortableContent.preview(bundle, against: state, now: iosMillis(Date()))
          preview["handle"] = staged.handle
          preview["imageCount"] = staged.images.count
          return preview
        } catch {
          _ = await Task.detached { try? archive.release(staged.handle) }.value
          throw error
        }
      }
    }
    AsyncFunction("prepareBackupExport") { (promise: Promise) in
      resolve(promise) {
        let state = try RemiloIOSEngine.shared.read()
        let now = iosMillis(Date())
        let ids = state.referencedImages
        let lease = UUID().uuidString
        defer { _ = try? RemiloIOSExerciseMedia.shared.release(lease) }
        for id in ids { try RemiloIOSExerciseMedia.shared.lease(id, lease: "\(lease):\(id)") }
        let file = try await Task.detached(priority: .userInitiated) {
          let archive = try RemiloIOSPortableArchive.live()
          var urls: [String: URL] = [:]
          var images: [RemiloIOSPortableContent.Image] = []
          for id in ids.sorted() {
            let image = try RemiloIOSExerciseImages.metadata(id)
            urls[id] = try RemiloIOSExerciseImages.fileURL(id)
            images.append(.init(id: id, width: image.width, height: image.height, bytes: image.bytes))
          }
          let metadata = try RemiloIOSPortableContent.encode(state, now: now, images: images)
          return try archive.export(metadata: metadata, imageURLs: urls)
        }.value
        return ["uri": file.url.absoluteString, "imageCount": file.imageCount, "bytes": file.bytes] as [String: Any]
      }
    }
    AsyncFunction("releasePreparedImport") { (handle: String, promise: Promise) in
      resolve(promise) {
        try await Task.detached { try RemiloIOSPortableArchive.live().release(handle) }.value
      }
    }
    AsyncFunction("applyPreparedImport") { (handle: String, copies: [String], operationID: String, promise: Promise) in
      resolve(promise) {
        try await RemiloIOSEngine.shared.applyImport(handle: handle, copies: copies, operationID: operationID) {
          let (staged, content) = try await Task.detached(priority: .userInitiated) {
            let staged = try RemiloIOSPortableArchive.live().validate(handle)
            let images = Set(staged.images.map(\.id))
            return (staged, try RemiloIOSPortableContent.decode(staged.metadata, availableImageIDs: images))
          }.value
          return IOSPreparedImport(content: content, installImages: { ids in
            try await Task.detached(priority: .userInitiated) {
              for image in staged.images where ids.contains(image.id) {
                let data = try Data(contentsOf: staged.imageURL(image))
                try RemiloIOSExerciseImages.install(data, expectedID: image.id)
              }
            }.value
          })
        }
      }
    }
    AsyncFunction("previewSchedule") { (draft: [String: Any], promise: Promise) in
      resolve(promise) { try RemiloIOSEngine.shared.preview(draft) }
    }
    AsyncFunction("applyCommand") { (command: [String: Any], promise: Promise) in
      resolve(promise) {
        defer {
          if command["kind"] as? String == "Purge" {
            try? RemiloIOSGoogleCalendarRuntime.reconcileManualLinkPurges()
          }
        }
        return try await RemiloIOSEngine.shared.apply(command, managedExportScope: RemiloIOSGoogleCalendarRuntime.captureManagedExport)
      }
    }
    AsyncFunction("scheduleTestAlarm") { (operationId: String, promise: Promise) in
      resolve(promise) { try await RemiloIOSEngine.shared.scheduleTestAlarm(operationId: operationId) }
    }
    AsyncFunction("reconcile") { (promise: Promise) in
      resolve(promise) {
        try await RemiloIOSEngine.shared.reconcile()
        try? RemiloIOSGoogleCalendarRuntime.reconcileManualLinkPurges()
        return nil
      }
    }
    AsyncFunction("openSettings") { (kind: String, promise: Promise) in
      resolve(promise) {
        try await RemiloIOSDelivery.openSettings(kind)
        return nil
      }
    }
    AsyncFunction("getTimeZones") { (instantMs: Double) in
      try RemiloIOSTime.timeZones(at: instantMs)
    }
    AsyncFunction("convertTime") { (input: [String: Any]) in
      try RemiloIOSTime.convert(input)
    }
    AsyncFunction("resolvePostponeTime") { (input: [String: Any]) in
      try RemiloIOSTime.postpone(input)
    }
    AsyncFunction("takePendingDeliveryRequests") { (promise: Promise) in
      resolve(promise) { RemiloIOSDeliveryRequests.takeAll() }
    }
    AsyncFunction("previewSound") { (sound: String, requestID: String, promise: Promise) in
      resolve(promise) { RemiloIOSSoundPreview.shared.start(sound, requestID: requestID) }
    }
    AsyncFunction("stopSoundPreview") { (requestID: String, promise: Promise) in
      resolve(promise) { RemiloIOSSoundPreview.shared.stop(requestID: requestID) }
    }
    AsyncFunction("getSoundPreview") { (promise: Promise) in
      resolve(promise) { RemiloIOSSoundPreview.shared.snapshot }
    }
    AsyncFunction("getCalendarConnection") { (promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.connection() }
    }
    AsyncFunction("getManagedCalendarState") { (promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.managedState() }
    }
    AsyncFunction("previewManagedCalendarSetup") { (choices: [String: Any], promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.previewManagedSetup(choices) }
    }
    AsyncFunction("authorizeManagedCalendarFromUserAction") { (id: String, expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) {
        try await RemiloIOSGoogleCalendarBridge.shared.authorizeManagedSetup(id, expectedRevision: expectedRevision)
      }
    }
    AsyncFunction("authorizeCalendarFromUserAction") { (expectedRevision: Double?, intent: String, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.authorize(expectedRevision: expectedRevision, intent: intent) }
    }
    AsyncFunction("listOwnedCalendars") { (cursor: String?, expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.ownedCalendars(cursor: cursor, expectedRevision: expectedRevision) }
    }
    AsyncFunction("listCalendarEvents") { (query: [String: Any], promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.events(query) }
    }
    AsyncFunction("previewCalendarImport") { (event: [String: Any], choices: [String: Any], promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.previewImport(event, choices: choices) }
    }
    AsyncFunction("getCalendarPublications") { (expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.publications(expectedRevision: expectedRevision) }
    }
    AsyncFunction("previewCalendarPublication") { (id: String, expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try RemiloIOSGoogleCalendarBridge.shared.previewPublication(id, expectedRevision: expectedRevision) }
    }
    AsyncFunction("getCalendarLinkCandidate") { (id: String, expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.linkCandidate(id, expectedRevision: expectedRevision) }
    }
    AsyncFunction("getCalendarLinks") { (expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.links(expectedRevision: expectedRevision) }
    }
    AsyncFunction("checkCalendarLink") { (id: String, expectedConnectionRevision: Double?, expectedLinkRevision: Double?, promise: Promise) in
      resolveCalendar(promise) {
        try await RemiloIOSGoogleCalendarBridge.shared.checkLink(
          id, expectedConnectionRevision: expectedConnectionRevision, expectedLinkRevision: expectedLinkRevision
        )
      }
    }
    AsyncFunction("previewCalendarLink") { (id: String, expectedRevision: Double?, superseding: String?, promise: Promise) in
      resolveCalendar(promise) {
        try await RemiloIOSGoogleCalendarBridge.shared.previewLink(id, expectedRevision: expectedRevision, superseding: superseding)
      }
    }
    AsyncFunction("previewCalendarUpdate") { (id: String, expectedRevision: Double?, superseding: String?, promise: Promise) in
      resolveCalendar(promise) {
        try await RemiloIOSGoogleCalendarBridge.shared.previewLink(id, expectedRevision: expectedRevision, superseding: superseding)
      }
    }
    AsyncFunction("previewCalendarActivation") { (ids: [String], expectedConnectionRevision: Double?, expectedLinkRevision: Double?, promise: Promise) in
      resolveCalendar(promise) {
        try await RemiloIOSGoogleCalendarBridge.shared.previewActivation(
          ids, expectedConnectionRevision: expectedConnectionRevision, expectedLinkRevision: expectedLinkRevision
        )
      }
    }
    AsyncFunction("applyCalendarCommand") { (command: [String: Any], promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.apply(command) }
    }
    AsyncFunction("getCalendarOperationStatus") { (id: String, expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.operation(id, expectedRevision: expectedRevision) }
    }
    AsyncFunction("getCalendarOperations") { (expectedRevision: Double?, promise: Promise) in
      resolveCalendar(promise) { try await RemiloIOSGoogleCalendarBridge.shared.operations(expectedRevision: expectedRevision) }
    }
  }

  private static var widgetProfilesAvailable: Bool {
    guard let extensions = Bundle.main.builtInPlugInsURL else { return false }
    let widget = extensions.appendingPathComponent("RemiloWidgets.appex", isDirectory: true)
    return FileManager.default.fileExists(atPath: widget.path) && RemiloWidgetSnapshotFile.isAvailable
  }

  private func resolve(_ promise: Promise, _ action: @MainActor @escaping () async throws -> Any?) {
    Task { @MainActor in
      do { promise.resolve(try await action()) }
      catch let failure as IOSInputFailure { promise.reject(failure.code, failure.code) }
      catch { promise.reject(error) }
    }
  }

  private func resolveCalendar(_ promise: Promise, _ action: @MainActor @escaping () async throws -> Any?) {
    Task { @MainActor in
      do { promise.resolve(try await action()) }
      catch {
        let code = RemiloIOSGoogleCalendarBridge.errorCode(error)
        promise.reject(code, code)
      }
    }
  }

  private func publishTimePreferences() {
    Task { @MainActor [weak self] in
      if let preferences = try? Self.timePreferences() {
        self?.sendEvent("onTimeDisplayPreferencesChanged", preferences)
      }
    }
  }

  @MainActor
  private static func timePreferences() throws -> [String: Any] {
    let preference = try RemiloIOSEngine.shared.settings()["language"] as? String ?? "system"
    let language = RemiloIOSLanguage.resolve(preference)
    let hourCycle = Locale.autoupdatingCurrent.hourCycle
    return [
      "uses24HourClock": hourCycle == .zeroToTwentyThree || hourCycle == .oneToTwentyFour,
      "localeTag": language,
      "languagePreference": preference,
      "resolvedLanguage": language
    ]
  }
}

enum RemiloIOSLanguage {
  static func resolve(_ preference: String) -> String {
    if preference == "en" || preference == "zh-Hans" { return preference }
    for identifier in Locale.preferredLanguages {
      let parts = identifier.replacingOccurrences(of: "_", with: "-").lowercased().split(separator: "-")
      if parts.first == "en" { return "en" }
      guard parts.first == "zh", !parts.contains("hant") else { continue }
      if parts.contains("hans") || parts.contains("cn") || parts.contains("sg") || parts.count == 1 {
        return "zh-Hans"
      }
    }
    return "en"
  }
}
