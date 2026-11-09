import AppIntents

/// WidgetKit runs LiveActivityIntent in the containing app process.
struct RemiloWidgetDoneIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "widget.done"
    static var supportedModes: IntentModes { .background }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresLocalDeviceAuthentication }
    static var isDiscoverable: Bool { false }

    @Parameter(title: "Occurrence ID") var occurrenceID: String
    @Parameter(title: "Date") var date: String
    @Parameter(title: "Session revision") var revision: Int
    @Parameter(title: "Step ID") var stepID: String

    init() {}

    init(_ action: RemiloWidgetDoneAction) {
        occurrenceID = action.occurrenceID
        date = action.date
        revision = action.revision
        stepID = action.stepID
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        #if !REMILO_WIDGET_EXTENSION
        if let action = RemiloWidgetDoneAction(occurrenceID: occurrenceID, date: date, revision: revision, stepID: stepID),
           RemiloWidgetSnapshotFile.isAvailable {
            // A stale snapshot is refreshed even when the command is rejected. An uncertain
            // write can be tapped again with the same identity while that snapshot is visible.
            _ = try? await RemiloIOSEngine.shared.apply(action.command)
            RemiloIOSWidgetPublisher.shared.publishCurrent()
        }
        #endif
        return .result()
    }
}
