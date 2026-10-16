export type SoundPreviewSnapshot = { requestId: string; sound: 'remilo' | 'system'; state: 'Starting' | 'Playing' | 'Ended' | 'Interrupted' | 'Failed'; actualSound?: 'remilo' | 'system'; reason?: string };
export type LanguagePreference = 'system' | 'en' | 'zh-Hans';
export type SupportedLanguage = 'en' | 'zh-Hans';
export type TimeDisplayPreferences = { uses24HourClock: boolean; localeTag: string; languagePreference?: LanguagePreference; resolvedLanguage?: SupportedLanguage };
export type RemiloAlarmModuleEvents = { onChange: (params: Record<string, never>) => void; onSoundPreviewState: (snapshot: SoundPreviewSnapshot) => void;
  onTimeDisplayPreferencesChanged: (preferences: TimeDisplayPreferences) => void };
export type ListRecord = { id: string; name: string; revision: number; overdueCount: number };
export type SessionActionMember = { occurrenceId: string; expectedGeneration: number };
export type SessionActions = { sessionId: string; members: SessionActionMember[]; snoozeMinutes: number };
export type Capabilities = {
  exactAlarms: boolean; notifications: boolean; channelEnabled: boolean;
  fullScreen: boolean; unlocked: boolean; observedAtMs: number; activeSessionId: string; notificationChannelEnabled: boolean;
  activeSessionActions: SessionActions | null;
  routineChannelEnabled?: boolean; routineChannelQuiet?: boolean;
};
export type ReminderDraft = {
  title: string; alarmAtMs?: number; eventStartMs?: number; eventEndMs?: number; dueAtMs?: number;
  notes?: string; listName?: string; listId?: string | null; mode?: 'Alarm' | 'Notification' | 'None';
  allDay?: boolean; zoneId?: string; dueLinked?: boolean; alarmLinked?: boolean;
  sound?: 'remilo' | 'system'; vibration?: boolean;
};
export type HistoryEntry = { kind: string; atMs: number; targetMs: number | null; groups?: string[] };
export type ResolvedReminderDraft = Omit<Required<ReminderDraft>, 'listId'> & Pick<ReminderDraft, 'listId'>;
export type Occurrence = ResolvedReminderDraft & {
  kind?: 'RoutineFamily';
  routineFamily?: RoutinePlan & { recordedDays: number; trashedAtMs: number };
  id: string; completed: boolean; deleted: boolean; revision: number; nextAlertMs: number | null;
  generation: number; deliveryState: string; overdue: boolean; history?: HistoryEntry[];
  segmentId: string | null; nominalSlot: string | null; exception: boolean; skipped: boolean;
  seriesId?: string | null;
  seriesState: string | null; repeatSummary: string | null; agendaGroup: string;
  repeatRule?: RecurrenceDraft | null;
  alertAdjustment?: 'Snoozed' | 'Postponed' | null;
  collectionAtMs?: number;
  /** Native browsing anchor; independent of delivery confirmation and audibility. */
  agendaAtMs: number;
  /** Authored completion boundary; Snooze/Postpone never move it. */
  overdueAtMs: number | null;
  routine?: RoutineProgress | null;
  /** Current globally mirrored native duration, including before first unlock. */
  quickSnoozeMinutes: number;
};
export type ReminderFilter = { view: 'agenda' | 'overdue' | 'completed' | 'today' | 'upcoming' | 'attention' | 'all' | 'history' | 'deleted'; search?: string; listId?: string | null; listName?: string; deliveryIssuesOnly?: boolean; overdueOnly?: boolean; segmentId?: string; seriesId?: string; includeSkipped?: boolean };
export type RoutineTrashRow = Occurrence & { kind: 'RoutineFamily'; routineFamily: RoutinePlan & { recordedDays: number; trashedAtMs: number } };
export type ReminderPage = { items: (Occurrence | RoutineTrashRow)[]; nextCursor: string | null; total: number; groups: Record<string, number>; completedCount: number };
/** Creation consent; Calendar policy is operational state and never part of portable reminder content. */
export type CalendarCreationDisposition = 'Default' | 'Managed' | 'LocalOnly';
export type CreateCommand = ReminderDraft & { kind: 'Create'; operationId: string; alarmAtMs?: number; calendarDisposition?: CalendarCreationDisposition };
export type DeliveryCommand = {
  kind: 'Stop' | 'CompleteDelivery' | 'Snooze' | 'Postpone'; operationId: string; occurrenceId: string; expectedGeneration: number; alarmAtMs?: number;
  expectedSnoozeMinutes?: number;
};
export type SessionCommand = { operationId: string; expectedSessionId: string; members: SessionActionMember[] } &
  ({ kind: 'DoneAll' } | { kind: 'SnoozeAll'; snoozeMinutes: number });
export type ContentCommand = Partial<ReminderDraft> & {
  kind: 'Edit' | 'Done' | 'Reopen' | 'Delete' | 'UndoDelete' | 'Skip' | 'Purge'; operationId: string; occurrenceId: string; expectedRevision: number;
};
export type AtmosphereSelection = 'automatic' | 'sunrise' | 'sky' | 'evening' | 'night';
export type AppSettings = {
  revision: number; snoozeMinutes: number; tomorrowMorning: number; tomorrowAfternoon: number;
  tomorrowEvening: number; sound: 'remilo' | 'system'; vibration: boolean; theme: 'system' | 'light' | 'dark'; atmosphere: AtmosphereSelection; language: LanguagePreference;
};
export type RecurrenceDraft = {
  frequency: 'daily' | 'weekly' | 'monthlyDay' | 'monthlyOrdinal' | 'lastWeekday' | 'yearly';
  interval: number; weekdays?: number[]; day?: number; ordinal?: number; weekday?: number; month?: number;
  count?: number; until?: string; zoneMode: 'floating' | 'pinned';
};
export type Series = {
  id: string; seriesId: string; revision: number; state: 'Active' | 'Paused' | 'Archived'; exhausted: boolean;
  template: ResolvedReminderDraft; rule: RecurrenceDraft & { anchor: string; zoneId: string | null; endExclusive: string | null };
  registered: number; pending: number; upcoming: { nominalSlot: string; eventStartMs: number; alarmAtMs: number }[];
};
export type RepeatFamily = {
  seriesId: string; current: Series; state: 'Active' | 'Paused' | 'Ended'; unfinishedCount: number;
  upcoming: { segmentId: string; nominalSlot: string; eventStartMs: number; alarmAtMs: number; zoneId?: string;
    mode?: 'Alarm' | 'Notification' | 'None'; state?: 'Active' | 'Paused' }[];
};
export type TimeZoneOption = { id: string; label: string; region: string; offsetSeconds: number };
export type TimeConversionInput = { zoneId: string; instantMs: number; local?: never } | { zoneId: string; local: string; instantMs?: never };
export type TimeConversion = {
  zoneId: string; instantMs: number; local: string; offsetSeconds: number; adjustment: 'none' | 'gapForward' | 'earlierFold';
};
export type SeriesCommand =
  (ReminderDraft & { kind: 'CreateSeries'; recurrence: RecurrenceDraft; operationId: string; calendarDisposition?: CalendarCreationDisposition }) |
  (ReminderDraft & { kind: 'EditSeries' | 'EditFollowing'; recurrence: RecurrenceDraft; operationId: string; segmentId: string; expectedRevision: number; nominalSlot?: string }) |
  { kind: 'PauseSeries' | 'ResumeSeries'; operationId: string; segmentId: string; expectedRevision: number };
export type ListCommand = { kind: 'CreateList'; name: string; operationId: string } |
  { kind: 'RenameList'; listId: string; name: string; expectedRevision: number; operationId: string } |
  { kind: 'RemoveList'; listId: string; expectedRevision: number; operationId: string };
export type RoutineExercise = { id: string; name: string; target: string; notes: string; illustration?: string; customImageId?: string };
export type ExercisePhoto = { id: string; uri: string; width: number; height: number; lease?: string };
export type RoutineDay = { type: 'Rest' | 'Exercises'; exercises: RoutineExercise[] };
export type RoutineDraft = { title: string; minutes: number; mode: 'Alarm' | 'Notification' | 'None'; listId: string | null; days: RoutineDay[];
  notes?: string; sound?: 'remilo' | 'system'; vibration?: boolean };
export type RoutinePlan = RoutineDraft & { notes: string; sound: 'remilo' | 'system'; vibration: boolean;
  id: string; revision: number; state: 'Active' | 'Paused' | 'Trashed'; startsOn: string; effectiveDate: string };
export type RoutineProgress = { routineId: string; date: string; revision: number; ended: boolean; endsAtMs?: number; completedCount: number; totalCount: number;
  changes?: { id: string; kind: string; stepId: string | null; completed: boolean | null; atMs: number }[];
  skipped: boolean; completed: boolean; state: 'Rest' | 'Paused' | 'Upcoming' | 'Ready' | 'InProgress' | 'Completed' | 'Skipped' | 'NotCompleted' | 'PartiallyCompleted';
  steps: (RoutineExercise & { completed: boolean })[] };
export type RoutineSession = RoutineProgress & { occurrenceId?: string; title: string; deleted?: boolean; notes: string;
  mode: 'Alarm' | 'Notification' | 'None'; minutes: number; sound: 'remilo' | 'system'; vibration: boolean };
export type RoutineCommand =
  (RoutineDraft & { kind: 'CreateRoutine'; startsOn: string; operationId: string }) |
  (RoutineDraft & { kind: 'EditRoutine'; routineId: string; expectedRevision: number; operationId: string }) |
  { kind: 'PauseRoutine' | 'ResumeRoutine' | 'TrashRoutine' | 'RestoreRoutine' | 'PurgeRoutine'; routineId: string; expectedRevision: number; operationId: string } |
  { kind: 'SetRoutineExercise' | 'CorrectRoutineExercise' | 'SkipRoutineDay' | 'UndoSkipRoutineDay'; occurrenceId: string; date: string;
    expectedRevision: number; operationId: string; stepId?: string; completed?: boolean };
export type RoutineAlarmCommand = { occurrenceId: string; date: string; expectedGeneration: number; expectedSessionId: string; operationId: string } &
  ({ kind: 'DismissRoutineAlarm'; expectedSnoozeMinutes?: never } | { kind: 'SnoozeRoutineAlarm'; expectedSnoozeMinutes: number });
export type Command = CreateCommand | DeliveryCommand | ContentCommand | SeriesCommand | ListCommand | SessionCommand | RoutineCommand | RoutineAlarmCommand |
  (Partial<AppSettings> & { kind: 'Settings'; operationId: string; expectedRevision: number }) |
  { kind: 'StopAll'; operationId: string; expectedSessionId: string };
export type CommandResult = {
  status: 'Scheduled' | 'Blocked' | 'Pending' | 'Partial' | 'Applied' | 'Rejected';
  occurrence?: Occurrence; segmentId?: string; generation?: number; errorCode?: string;
  occurrenceId?: string; date?: string;
  routine?: RoutinePlan; routineSession?: RoutineSession;
  errorField?: string; errorMessage?: string; errorMessageKey?: string; errorMessageArgs?: Record<string, string | number>; count?: number; added?: number; preserved?: number; blocked?: number; retry?: boolean; list?: ListRecord | null;
  memberResults?: { occurrenceId: string; generation: number; status: 'Scheduled' | 'Blocked' | 'Pending' | 'Superseded' | 'Missed'; targetMs?: number }[];
};
export type SchedulePreview = { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number; warnings: string[];
  upcoming: { nominalSlot: string; eventStartMs: number; dueAtMs: number; alarmAtMs: number; adjusted: boolean; zoneId: string }[] };
export type ImportPreview = { count: number; items: { id: string; title: string; conflict: boolean; futureAlert: boolean; calendarCollision?: boolean; currentOccurrenceIds?: string[] }[];
  lists?: { id: string; name: string; restoredName: string; conflict: boolean }[] };

export type CalendarConnection = { revision: number; connected: boolean; available: boolean; email: string; calendarId: string; calendarName: string; message: string };
export type OwnedCalendar = { id: string; name: string; zoneId: string };
export type CalendarPage = { items: OwnedCalendar[]; nextCursor: string | null; connectionRevision: number };
export type CalendarPublicationPreview = { occurrenceId: string; reminderRevision: number; connectionRevision: number; fingerprint: string; recurrence?: string[];
  title: string; notes: string; eventStartMs: number; eventEndMs: number; allDay: boolean; zoneId: string; pinsZone: boolean; email: string; calendarName: string };
export type CalendarPublication = { operationId: string; occurrenceId: string; calendarName: string; email: string;
  state: 'Waiting' | 'Publishing' | 'Unconfirmed' | 'NeedsAccess' | 'Failed' | 'Conflict' | 'Cancelled' | 'Published';
  message: string; htmlLink: string; publishedAtMs: number | null; differs: boolean; readOnly: boolean };
export type CalendarFields = { title: string; notes: string; schedule: { eventStartMs: number; eventEndMs: number; allDay: boolean; zoneId: string; recurrence?: string[]; exceptions?: { nominalSlot: string; fields: CalendarFields }[]; segments?: CalendarFields[] } };
export type CalendarSelections = Record<'title' | 'notes' | 'schedule', 'remilo' | 'google' | null>;
export type CalendarImportChoices = { mode?: 'Alarm' | 'Notification' | 'None'; title?: string; alarmAtMs?: number; listId?: string | null; disableReminders?: boolean; automaticSync?: boolean };
export type CalendarEventRef = { calendarId: string; eventId: string };
export type CalendarEventQuery = { calendarId: string; from: string; until: string; cursor: string | null };
export type CalendarEventPage = { items: { eventId: string; title: string; fields: CalendarFields | null; unsupportedReason: string | null; occurrenceId: string | null; erased: boolean }[]; nextCursor: string | null; connectionRevision: number; calendarName: string };
export type CalendarLinkPreview = { previewId: string; occurrenceId: string; calendarName: string; email: string; remote: CalendarFields; local: CalendarFields | null;
  baseline: Partial<CalendarFields> | null; selections: CalendarSelections | null; choices: CalendarImportChoices & { dueAtMs: number; alarmAtMs: number }; googleReminders: boolean; checkedAtMs: number; nextAlertMs: number | null;
  recurrence?: RecurrenceDraft | null; upcoming?: { eventStartMs: number; alarmAtMs: number }[] | null;
  timings: Record<'remilo' | 'google', { mode: string; dueAtMs: number; alarmAtMs: number }> | null };
export type CalendarLink = { occurrenceId: string; revision: number; calendarName: string; state: string; checkedAtMs: number | null; message: string; htmlLink: string; readOnly: boolean; differs: boolean; source?: CalendarEventRef | null; seriesId?: string | null;
  accountEmail: string; availability: 'Unknown' | 'Available' | 'Deleted' | 'Unavailable' | 'Unsupported'; availabilityReason: string;
  observedAtMs: number | null; lastCheckAttemptAtMs: number | null; lastCheckErrorCode: string; remoteDiffers: boolean | null; requiresReview: boolean;
  cancelledInstances?: { segmentId: string; nominalSlot: string }[]; syncMode?: CalendarSyncMode; syncStatus?: CalendarSyncStatus; activationRevision?: number; baselineVersion?: number; authoredAtMs?: number | null;
  successfulAtMs?: number | null; attemptedAtMs?: number | null; googleUpdated?: string; pauseReason?: CalendarPauseReason; syncRequestId?: string | null };
export type CalendarSyncMode = 'Manual' | 'Pending' | 'Automatic';
export type CalendarSyncStatus = 'Confirmed' | 'UpdatePending' | 'Review' | 'Paused' | 'Unconfirmed' | 'Deferred';
export type CalendarPauseReason = '' | 'Ringing' | 'ChangesNeedReview' | 'UnconfirmedWrite' | 'ElapsedAlert' | 'AccessRequired' | 'AccountChanged' | 'NotOwner' | 'RemoteDeleted' | 'RemoteUnavailable' | 'Unsupported' | 'LocalTerminal' | 'LocalRemoved' | 'Unlinked' | 'StaleAuthorization' | 'InvalidTiming' | 'ContentRequired' | 'ReviewRequired';
export type CalendarReviewCounts = { reminders: number; candidates: number; setup: number; total: number };
export type CalendarSyncSummary = { connected: boolean; automaticCount: number; pendingCount: number; reviewCount: number; reviewCounts?: CalendarReviewCounts; attention?: { blocking: number; tone: 'warning' | 'danger' }; syncRequestId?: string | null; notifications: { enabled: boolean; revision: number }; lastRun?: CalendarRunSummary & { atMs: number } | null };
export type CalendarSyncScope = { kind: 'AllAuthorized' } | { kind: 'Association'; occurrenceId: string };
export type CalendarSyncResult = { scope: CalendarSyncScope | null; outcome: 'Checking' | 'NoChanges' | 'Synced' | 'Pending' | 'NeedsReview' | 'AccessRequired' | 'Unconfirmed' | 'Paused' | 'Failed' | 'ScopeChanged' | 'NotChecked'; checked: number; changed: number; imported: number; published: number; startedAtMs: number | null; finishedAtMs: number | null };
export type CalendarReviewIssue =
  { kind: 'Association'; issueId: string; occurrenceId: string; seriesId: string | null; revision?: number; fingerprint?: string; title: string; reason: CalendarPauseReason; discoveredAtMs: number; affectedScopes?: string[] } |
  { kind: 'Candidate'; issueId: string; candidateId: string; revision: number; fingerprint?: string; title: string; reason: string; discoveredAtMs: number; calendarName: string; affectedScopes?: string[] } |
  { kind: 'Setup'; issueId: string; revision?: number; fingerprint?: string; operationId?: string; title: string; reason: string; discoveredAtMs: number; affectedScopes?: string[] };
export type CalendarReviewPage = { items: CalendarReviewIssue[]; count: number; counts?: CalendarReviewCounts; nextCursor: string | null };
export type CalendarActivationPreview = CalendarLinkPreview & { automaticSync: boolean; activation: boolean; equal: boolean; transfers: { inbound: string[]; outbound: string[] } };
export type CalendarActivationReview = { items: { occurrenceId: string; title?: string | null; calendarName?: string | null; email?: string | null; preview: CalendarActivationPreview | null; excludedReason: string | null }[] };
export type CalendarRunSummary = { pages: number; attempted: number; confirmed: number; continuation: boolean; checked?: number; changed?: number; imported?: number; published?: number; adopted?: number; deferred?: number; excluded?: number; review?: number };
export type CalendarLinkedOperation = { operationId: string; occurrenceId: string; kind: string; calendarName: string; title?: string;
  state: 'Waiting' | 'Sending' | 'Unconfirmed' | 'NeedsAccess' | 'Blocked' | 'Conflict' | 'Failed' | 'Cancelled' | 'Confirmed';
  recoveryMode: 'Retry' | 'ConfirmOutcome' | 'ReviewAgain' | 'None';
  message: string; localApplied: boolean; localStatus: string; remoteAttempted: boolean; readOnly: boolean; localResult?: Pick<CommandResult, 'status'> | null; source?: CalendarEventRef | null };
export type CalendarImportBatchResult = { operationId: string; operations: CalendarLinkedOperation[] };
export type ManagedCalendarPolicy = { revision: number; automaticImport: boolean; exportNewReminders: boolean; importMode: 'Alarm' | 'Notification' | 'None'; allDayAlarmMinutes: number; disableGoogleReminders: boolean };
export type ManagedCalendarMode = 'Enabled' | 'Paused' | 'Disabled';
export type CalendarRecoveryAction = 'None' | 'Connect' | 'Authorize' | 'ReviewSetup' | 'InspectCreation' | 'ReviewItems' | 'Resume' | 'Retry';
export type CalendarSavedProgress = { scanComplete: boolean; imported: number; pending: number; held: number; review: number; localBlocked: number; localPending: number };
export type CalendarOperationStatus = { operationId: string; kind: string; stage: 'Waiting' | 'PreparingCalendar' | 'CreatingCalendar' | 'CheckingCalendar' | 'CheckingEvents' | 'AddingReminders' | 'Confirmed' | 'NeedsReview' | 'NeedsAccess' | 'Unconfirmed' | 'Paused' | 'Cancelled' | 'AwaitingAuthorization' | 'Authorized' | 'Failed';
  reason: string; action: CalendarRecoveryAction; confirmed: number; pending: number; review: number; held: number; children: string[]; progress?: CalendarSavedProgress; currentScope: boolean; correlationComplete?: boolean; syncResult?: CalendarSyncResult };
export type ManagedCalendarPhase = 'NotConfigured' | 'Reviewing' | 'PreparingCalendar' | 'InitialImport' | 'Ready' | 'AccessRequired' | 'CalendarUnavailable' | 'OwnershipUnknown' | 'CreationUnconfirmed';
export type ManagedCalendarState = { revision: number; authEpoch: number; mode: ManagedCalendarMode; phase: ManagedCalendarPhase;
  subject: string; calendarId: string; calendarName: string; calendarZone: string; policy: ManagedCalendarPolicy; initialMode: 'Alarm' | 'Notification' | 'None';
  bootstrapGeneration: number; initialRecoveryComplete: boolean; candidateCount: number; pendingExportCount: number; heldExportCount: number;
  reviewCount: number; pendingChangeCount?: number; recoveryCount?: number; lastObservedAtMs: number | null; successfulAtMs?: number | null; attemptedAtMs?: number | null; failedAtMs?: number | null; message: string; operationId?: string | null;
  progress?: CalendarSavedProgress; problem?: { reason: string; action: CalendarRecoveryAction } | null };
export type ManagedCalendarReviewItem = { itemId: string; kind: 'Import' | 'Publish' | 'Transfer' | 'RecoveredAlert' | 'Adopt'; title: string;
  occurrenceId?: string; candidateId?: string; calendarName?: string; ready: boolean; reason?: string; alertMode?: 'Alarm' | 'Notification' | 'None'; alertAtMs?: number;
  localStatus?: string; inbound?: string[]; outbound?: string[]; scope?: string };
export type ManagedCalendarPreview = { previewId: string; kind: 'Setup' | 'Policy' | 'Resume' | 'RecoveredAlerts'; expectedRevision: number; expectedConnectionRevision: number;
  sample?: { inspectedCount: number; complete: boolean; items: { title: string; description: string }[] } | null;
  expiresAtMs: number; policy: ManagedCalendarPolicy; initialMode: 'Alarm' | 'Notification' | 'None'; calendarCandidates: (OwnedCalendar & { recognition?: 'Bound' | 'Recognized' | 'NameOnly' })[];
  selectedCalendarId: string; calendarZone?: string; createCalendar: boolean; items: ManagedCalendarReviewItem[]; warnings: string[]; complete: boolean };
export type ManagedCalendarSetupChoices = { selectedCalendarId?: string; calendarZone?: string; policy?: Partial<Omit<ManagedCalendarPolicy, 'revision'>>; adoptOccurrenceIds?: string[]; replacement?: boolean };
export type ManagedCalendarPolicyChoices = Partial<Omit<ManagedCalendarPolicy, 'revision'>> & { expectedRevision: number };
export type ManagedCalendarCandidatePreview = CalendarLinkPreview & { candidateId: string; candidateRevision: number };
export type CalendarReminderDisposition = { occurrenceId: string; seriesId?: string | null; revision: number; disposition: CalendarCreationDisposition;
  state: 'LocalOnly' | 'WaitingToPublish' | 'Held' | 'Publishing' | 'Linked' | 'Ineligible' | 'Unconfigured'; calendarName: string; message: string };
export type ManagedCalendarCommand =
  { kind: 'ConfirmManagedCalendarSetup' | 'ApplyManagedCalendarPolicy' | 'ResumeManagedCalendar' | 'EnableRecoveredCalendarAlerts'; operationId: string; previewId: string; selectedItemIds: string[]; selectedCalendarId?: string } |
  { kind: 'PauseManagedCalendar' | 'DisableManagedCalendar'; operationId: string; expectedRevision: number } |
  { kind: 'SetCalendarReminderDisposition'; operationId: string; occurrenceId: string; expectedRevision: number; disposition: 'Managed' | 'LocalOnly' } |
  { kind: 'ImportManagedCalendarCandidate'; operationId: string; previewId: string; automaticSync: true; selections?: CalendarSelections } |
  { kind: 'IgnoreManagedCalendarCandidate'; operationId: string; candidateId: string; expectedRevision: number } |
  { kind: 'RetryManagedCalendarOperation'; operationId: string };
export type CalendarLegacyCommand = { kind: 'PublishOneOff'; operationId: string; occurrenceId: string; expectedRevision: number;
  expectedConnectionRevision: number; fingerprint: string } |
  { kind: 'SelectCalendar'; operationId: string; calendarId: string; expectedConnectionRevision: number } |
  { kind: 'DisconnectCalendar'; operationId: string; expectedConnectionRevision: number } |
  { kind: 'RetryPublication'; operationId: string } |
  { kind: 'ImportCalendarEvent' | 'EnableCalendarLink' | 'ApplyCalendarResolution' | 'EnableAutomaticCalendarSync'; operationId: string; previewId: string; selections?: CalendarSelections; automaticSync?: boolean } |
  { kind: 'ActivateCalendarLinks'; operationId: string; previewIds: string[] } |
  { kind: 'SetCalendarReviewNotifications'; operationId: string; expectedRevision: number; enabled: boolean } |
  { kind: 'ImportCalendarEvents'; operationId: string; items: { previewId: string; choices: CalendarImportChoices }[] } |
  { kind: 'UnlinkCalendar'; operationId: string; occurrenceId: string; expectedLinkRevision: number } |
  { kind: 'RetryCalendarOperation'; operationId: string };
export type CalendarCommand = CalendarLegacyCommand | ManagedCalendarCommand | { kind: 'RequestCalendarSync'; operationId: string; scope: CalendarSyncScope };
