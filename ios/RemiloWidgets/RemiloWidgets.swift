import AppIntents
import SwiftUI
import WidgetKit

@main
struct RemiloWidgets: WidgetBundle {
    var body: some Widget {
        RemiloTodayWidget()
        RemiloRoutineFocusWidget()
    }
}

private struct RoutineChoice: AppEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "widget.chooseRoutine")
    static let defaultQuery = RoutineChoiceQuery()

    let id: String
    let title: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)")
    }
}

private struct RoutineChoiceQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [RoutineChoice] {
        let snapshot = try? RemiloWidgetSnapshotFile.read()
        let language = snapshot?.language ?? widgetSystemLanguage()
        return identifiers.map { id in
            let title = snapshot?.routines.first(where: { $0.id == id })?.title
            return RoutineChoice(id: id, title: title ?? RemiloWidgetCopy.unavailable(language))
        }
    }

    func suggestedEntities() async throws -> [RoutineChoice] {
        (try? RemiloWidgetSnapshotFile.read())?.routines.map { RoutineChoice(id: $0.id, title: $0.title) } ?? []
    }
}

private protocol RemiloWidgetConfiguration: WidgetConfigurationIntent {
    var routine: RoutineChoice? { get }
}

private struct TodayConfiguration: RemiloWidgetConfiguration {
    static let title: LocalizedStringResource = "widget.today"
    static let description = IntentDescription("widget.todayHint")

    @Parameter(title: "widget.chooseRoutine") var routine: RoutineChoice?
}

private struct RoutineFocusConfiguration: RemiloWidgetConfiguration {
    static let title: LocalizedStringResource = "widget.focus"
    static let description = IntentDescription("widget.focusHint")

    @Parameter(title: "widget.chooseRoutine") var routine: RoutineChoice?
}

private struct RemiloWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: RemiloWidgetSnapshot?
    let routineID: String?
    let example: Bool
}

private struct RemiloWidgetTimeline<Configuration: RemiloWidgetConfiguration>: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> RemiloWidgetEntry {
        RemiloWidgetEntry(date: Date(), snapshot: nil, routineID: nil, example: true)
    }

    func snapshot(for configuration: Configuration, in context: Context) async -> RemiloWidgetEntry {
        if context.isPreview { return placeholder(in: context) }
        let now = Date()
        return RemiloWidgetEntry(date: now, snapshot: currentSnapshot(at: now), routineID: configuration.routine?.id, example: false)
    }

    func timeline(for configuration: Configuration, in context: Context) async -> Timeline<RemiloWidgetEntry> {
        let now = Date()
        let snapshot = currentSnapshot(at: now)
        let selected = configuration.routine?.id
        let current = RemiloWidgetEntry(date: now, snapshot: snapshot, routineID: selected, example: false)
        guard let snapshot else { return Timeline(entries: [current], policy: .after(now.addingTimeInterval(60 * 60))) }
        let midnight = Date(timeIntervalSince1970: Double(snapshot.dayEndsAtMs) / 1_000)
        let expired = RemiloWidgetEntry(date: midnight, snapshot: nil, routineID: selected, example: false)
        return Timeline(entries: [current, expired], policy: .after(midnight))
    }

    private func currentSnapshot(at now: Date) -> RemiloWidgetSnapshot? {
        guard let snapshot = try? RemiloWidgetSnapshotFile.read(), snapshot.isCurrent(at: now, in: .current) else { return nil }
        return snapshot
    }
}

private struct RemiloTodayWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "RemiloToday", intent: TodayConfiguration.self, provider: RemiloWidgetTimeline<TodayConfiguration>()) {
            RemiloWidgetContent(entry: $0, focusOnly: false)
        }
        .configurationDisplayName("widget.today")
        .description("widget.todayHint")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

private struct RemiloRoutineFocusWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "RemiloRoutineFocus", intent: RoutineFocusConfiguration.self, provider: RemiloWidgetTimeline<RoutineFocusConfiguration>()) {
            RemiloWidgetContent(entry: $0, focusOnly: true)
        }
        .configurationDisplayName("widget.focus")
        .description("widget.focusHint")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

private struct RemiloWidgetContent: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.dynamicTypeSize) private var typeSize
    let entry: RemiloWidgetEntry
    let focusOnly: Bool

    private var language: String { entry.snapshot?.language ?? widgetSystemLanguage() }
    private var routine: RemiloWidgetSnapshot.Routine? {
        if let id = entry.routineID { return entry.snapshot?.routines.first { $0.id == id } }
        return focusOnly ? entry.snapshot?.routines.first : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: focusOnly ? RemiloWidgetCopy.focus(language) : RemiloWidgetCopy.today(language))
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .accessibilityAddTraits(.isHeader)
            if entry.example {
                preview
            } else if let snapshot = entry.snapshot {
                if focusOnly {
                    if let routine {
                        ViewThatFits(in: .vertical) {
                            routineSection(
                                routine, date: snapshot.date, concise: typeSize.isAccessibilitySize,
                                allowDone: !typeSize.isAccessibilitySize
                            )
                            routineSection(routine, date: snapshot.date, concise: true)
                        }
                    } else {
                        status(entry.routineID == nil ? RemiloWidgetCopy.chooseRoutineHint(language) : RemiloWidgetCopy.unavailable(language))
                    }
                } else {
                    ViewThatFits(in: .vertical) {
                        today(snapshot, concise: typeSize.isAccessibilitySize)
                        today(snapshot, concise: true)
                    }
                }
            } else {
                status(RemiloWidgetCopy.openToRefresh(language))
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { Color.primary.opacity(0.06) }
        .widgetURL(entry.example ? nil : mainDestination)
    }

    private var mainDestination: URL? {
        if focusOnly, let routine, let date = entry.snapshot?.date { return routineURL(routine.id, date: date) }
        return URL(string: focusOnly ? "remilo://routines" : "remilo:///")
    }

    private var preview: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(verbatim: RemiloWidgetCopy.example(language)).font(.caption2).foregroundStyle(.secondary)
            if focusOnly {
                Text(verbatim: RemiloWidgetCopy.exampleRoutine(language)).font(.headline)
                Text(verbatim: RemiloWidgetCopy.exampleStep(language)).font(.subheadline)
                Text(verbatim: RemiloWidgetCopy.exampleTarget(language)).font(.caption).foregroundStyle(.secondary)
            } else {
                Text(verbatim: RemiloWidgetCopy.exampleReminder(language)).font(.headline)
            }
        }
    }

    private func today(_ snapshot: RemiloWidgetSnapshot, concise: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            if let routine {
                routineSection(routine, date: snapshot.date, concise: true, allowDone: !concise)
            } else if entry.routineID != nil {
                status(RemiloWidgetCopy.unavailable(language))
            }
            if snapshot.reminders.isEmpty {
                status(RemiloWidgetCopy.empty(language))
            } else if concise {
                Text(verbatim: RemiloWidgetCopy.reminderCount(language, count: String(snapshot.reminderCount)))
                    .font(.headline)
            } else {
                let limit = family == .systemSmall ? 2 : family == .systemMedium ? 3 : 6
                ForEach(snapshot.reminders.prefix(limit), id: \.id) { reminder in
                    let label = reminderLabel(reminder)
                    if family != .systemSmall, let url = reminderURL(reminder.id) {
                        Link(destination: url) { label }
                    } else {
                        label
                    }
                }
                if snapshot.reminderCount > limit {
                    Text(verbatim: RemiloWidgetCopy.agendaCount(language, count: String(snapshot.reminderCount)))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .privacySensitive()
    }

    private func reminderLabel(_ reminder: RemiloWidgetSnapshot.Reminder) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            if reminder.overdueAtMs < Int64(entry.date.timeIntervalSince1970 * 1_000) {
                Image(systemName: "exclamationmark.circle")
                    .foregroundStyle(.secondary)
                    .accessibilityLabel(Text(verbatim: RemiloWidgetCopy.overdue(language)))
            }
            Text(verbatim: reminder.title).font(.subheadline).lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }

    private func routineSection(
        _ routine: RemiloWidgetSnapshot.Routine, date: String, concise: Bool, allowDone: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            let section = routineLabel(routine, concise: concise)
            if family != .systemSmall, let url = routineURL(routine.id, date: date) {
                Link(destination: url) { section }
            } else {
                section
            }
            if allowDone, family != .systemSmall, let step = routine.current,
               let occurrenceID = routine.occurrenceID, let revision = routine.revision,
               let action = RemiloWidgetDoneAction(occurrenceID: occurrenceID, date: date, revision: revision, stepID: step.id) {
                Button(intent: RemiloWidgetDoneIntent(action)) {
                    Text(verbatim: RemiloWidgetCopy.done(language))
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .accessibilityLabel(Text(verbatim: RemiloWidgetCopy.markDone(language, name: step.name)))
                .privacySensitive()
            }
        }
    }

    private func routineLabel(_ routine: RemiloWidgetSnapshot.Routine, concise: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: routine.title).font(.headline).lineLimit(concise ? 1 : 2)
            if let step = routine.current {
                Text(verbatim: step.name).font(.subheadline).lineLimit(concise ? 1 : 2)
                if !concise, !step.target.isEmpty {
                    Text(verbatim: step.target).font(.caption).lineLimit(2)
                }
            } else {
                status(routineStatus(routine.state))
            }
            if routine.total > 0 {
                let progress = RemiloWidgetCopy.progress(language, done: String(routine.done), total: String(routine.total))
                if !concise {
                    ProgressView(value: Double(routine.done), total: Double(routine.total))
                        .accessibilityHidden(true)
                }
                Text(verbatim: progress).font(.caption).foregroundStyle(.secondary)
            }
            if !concise, let next = routine.nextName {
                Text(verbatim: RemiloWidgetCopy.next(language, name: next)).font(.caption).foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
        .privacySensitive()
    }

    private func status(_ message: String) -> some View {
        Text(verbatim: message).font(.subheadline).foregroundStyle(.secondary)
    }

    private func routineStatus(_ state: RemiloWidgetSnapshot.Routine.State) -> String {
        switch state {
        case .rest: return RemiloWidgetCopy.rest(language)
        case .skipped: return RemiloWidgetCopy.skipped(language)
        case .paused: return RemiloWidgetCopy.paused(language)
        case .complete: return RemiloWidgetCopy.completed(language)
        case .unavailable: return RemiloWidgetCopy.unavailable(language)
        case .ready, .inProgress: return RemiloWidgetCopy.notStarted(language)
        }
    }

    private func routineURL(_ id: String, date: String) -> URL? {
        var route = URLComponents()
        route.scheme = "remilo"
        route.host = "routine-session"
        route.queryItems = [URLQueryItem(name: "id", value: id), URLQueryItem(name: "date", value: date)]
        return route.url
    }

    private func reminderURL(_ id: String) -> URL? {
        let allowed = CharacterSet.urlPathAllowed.subtracting(CharacterSet(charactersIn: "/%?#"))
        guard let segment = id.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        var route = URLComponents()
        route.scheme = "remilo"
        route.host = "reminder"
        route.percentEncodedPath = "/" + segment
        return route.url
    }
}

private func widgetSystemLanguage() -> String {
    Bundle.preferredLocalizations(from: ["en", "zh-Hans"]).first == "zh-Hans" ? "zh-Hans" : "en"
}
