export type SoundPreviewSnapshot = { requestId: string; sound: 'remilo' | 'system'; state: 'Starting' | 'Playing' | 'Ended' | 'Interrupted' | 'Failed'; actualSound?: 'remilo' | 'system'; reason?: string };
export type RemiloAlarmModuleEvents = { onChange: (params: Record<string, never>) => void; onSoundPreviewState: (snapshot: SoundPreviewSnapshot) => void };
export type ListRecord = { id: string; name: string; revision: number; overdueCount: number };
export type SessionActionMember = { occurrenceId: string; expectedGeneration: number };
export type SessionActions = { sessionId: string; members: SessionActionMember[]; snoozeMinutes: number };
export type Capabilities = {
  exactAlarms: boolean; notifications: boolean; channelEnabled: boolean;
  fullScreen: boolean; unlocked: boolean; observedAtMs: number; activeSessionId: string; notificationChannelEnabled: boolean;
  activeSessionActions: SessionActions | null;
};
export type ReminderDraft = {
  title: string; alarmAtMs?: number; eventStartMs?: number; eventEndMs?: number; dueAtMs?: number;
  notes?: string; listName?: string; listId?: string | null; mode?: 'Alarm' | 'Notification' | 'None';
  allDay?: boolean; zoneId?: string; dueLinked?: boolean; alarmLinked?: boolean;
  sound?: 'remilo' | 'system'; vibration?: boolean;
};
export type HistoryEntry = { kind: string; atMs: number; targetMs: number | null };
export type ResolvedReminderDraft = Omit<Required<ReminderDraft>, 'listId'> & Pick<ReminderDraft, 'listId'>;
export type Occurrence = ResolvedReminderDraft & {
  id: string; completed: boolean; deleted: boolean; revision: number; nextAlertMs: number | null;
  generation: number; deliveryState: string; overdue: boolean; history?: HistoryEntry[];
  segmentId: string | null; nominalSlot: string | null; exception: boolean; skipped: boolean;
  seriesState: string | null; repeatSummary: string | null; agendaGroup: string;
  repeatRule?: RecurrenceDraft | null;
  alertAdjustment?: 'Snoozed' | 'Postponed' | null;
  collectionAtMs?: number;
  /** Native browsing anchor; independent of delivery confirmation and audibility. */
  agendaAtMs: number;
  /** Authored completion boundary; Snooze/Postpone never move it. */
  overdueAtMs: number;
  /** Current globally mirrored native duration, including before first unlock. */
  quickSnoozeMinutes: number;
};
export type ReminderFilter = { view: 'agenda' | 'overdue' | 'completed' | 'today' | 'upcoming' | 'attention' | 'all' | 'history' | 'deleted'; search?: string; listId?: string | null; listName?: string; deliveryIssuesOnly?: boolean; overdueOnly?: boolean; segmentId?: string; seriesId?: string; includeSkipped?: boolean };
export type ReminderPage = { items: Occurrence[]; nextCursor: string | null; total: number; groups: Record<string, number>; completedCount: number };
export type CreateCommand = ReminderDraft & { kind: 'Create'; operationId: string; alarmAtMs?: number };
export type DeliveryCommand = {
  kind: 'Stop' | 'CompleteDelivery' | 'Snooze' | 'Postpone'; operationId: string; occurrenceId: string; expectedGeneration: number; alarmAtMs?: number;
  expectedSnoozeMinutes?: number;
};
export type SessionCommand = { operationId: string; expectedSessionId: string; members: SessionActionMember[] } &
  ({ kind: 'DoneAll' } | { kind: 'SnoozeAll'; snoozeMinutes: number });
export type ContentCommand = Partial<ReminderDraft> & {
  kind: 'Edit' | 'Done' | 'Reopen' | 'Delete' | 'UndoDelete' | 'Skip'; operationId: string; occurrenceId: string; expectedRevision: number;
};
export type AtmosphereSelection = 'automatic' | 'sunrise' | 'sky' | 'evening' | 'night';
export type AppSettings = {
  revision: number; snoozeMinutes: number; tomorrowMorning: number; tomorrowAfternoon: number;
  tomorrowEvening: number; sound: 'remilo' | 'system'; vibration: boolean; theme: 'system' | 'light' | 'dark'; atmosphere: AtmosphereSelection;
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
  (ReminderDraft & { kind: 'CreateSeries'; recurrence: RecurrenceDraft; operationId: string }) |
  (ReminderDraft & { kind: 'EditSeries' | 'EditFollowing'; recurrence: RecurrenceDraft; operationId: string; segmentId: string; expectedRevision: number; nominalSlot?: string }) |
  { kind: 'PauseSeries' | 'ResumeSeries'; operationId: string; segmentId: string; expectedRevision: number };
export type ListCommand = { kind: 'CreateList'; name: string; operationId: string } |
  { kind: 'RenameList'; listId: string; name: string; expectedRevision: number; operationId: string } |
  { kind: 'RemoveList'; listId: string; expectedRevision: number; operationId: string };
export type Command = CreateCommand | DeliveryCommand | ContentCommand | SeriesCommand | ListCommand | SessionCommand |
  (Partial<AppSettings> & { kind: 'Settings'; operationId: string; expectedRevision: number }) |
  { kind: 'StopAll'; operationId: string; expectedSessionId: string };
export type CommandResult = {
  status: 'Scheduled' | 'Blocked' | 'Pending' | 'Partial' | 'Applied' | 'Rejected';
  occurrence?: Occurrence; segmentId?: string; generation?: number; errorCode?: string;
  errorField?: string; errorMessage?: string; count?: number; added?: number; preserved?: number; blocked?: number; retry?: boolean; list?: ListRecord | null;
  memberResults?: { occurrenceId: string; generation: number; status: 'Scheduled' | 'Blocked' | 'Pending' | 'Superseded' | 'Missed'; targetMs?: number }[];
};
export type SchedulePreview = { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number; warnings: string[];
  upcoming: { nominalSlot: string; eventStartMs: number; dueAtMs: number; alarmAtMs: number; adjusted: boolean; zoneId: string }[] };
export type ImportPreview = { count: number; items: { id: string; title: string; conflict: boolean; futureAlert: boolean }[];
  lists?: { id: string; name: string; restoredName: string; conflict: boolean }[] };
