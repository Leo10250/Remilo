export type RemiloAlarmModuleEvents = { onChange: (params: Record<string, never>) => void };
export type Capabilities = {
  exactAlarms: boolean; notifications: boolean; channelEnabled: boolean;
  fullScreen: boolean; unlocked: boolean; observedAtMs: number; activeSessionId: string; notificationChannelEnabled: boolean;
};
export type ReminderDraft = {
  title: string; alarmAtMs?: number; eventStartMs?: number; eventEndMs?: number; dueAtMs?: number;
  notes?: string; listName?: string; mode?: 'Alarm' | 'Notification' | 'None';
  allDay?: boolean; zoneId?: string; dueLinked?: boolean; alarmLinked?: boolean;
  sound?: 'remilo' | 'system'; vibration?: boolean;
};
export type HistoryEntry = { kind: string; atMs: number; targetMs: number | null };
export type Occurrence = Required<ReminderDraft> & {
  id: string; completed: boolean; deleted: boolean; revision: number; nextAlertMs: number | null;
  generation: number; deliveryState: string; overdue: boolean; history?: HistoryEntry[];
  segmentId: string | null; nominalSlot: string | null; exception: boolean; skipped: boolean;
  seriesState: string | null; repeatSummary: string | null; agendaGroup: string;
  alertAdjustment?: 'Snoozed' | 'Postponed' | null;
};
export type ReminderFilter = { view: 'agenda' | 'overdue' | 'completed' | 'today' | 'upcoming' | 'attention' | 'all' | 'history' | 'deleted'; search?: string; listName?: string; segmentId?: string; includeSkipped?: boolean };
export type ReminderPage = { items: Occurrence[]; nextCursor: string | null; total: number; groups: Record<string, number>; completedCount: number };
export type CreateCommand = ReminderDraft & { kind: 'Create'; operationId: string; alarmAtMs?: number };
export type DeliveryCommand = {
  kind: 'Stop' | 'Snooze' | 'Postpone'; operationId: string; occurrenceId: string; expectedGeneration: number; alarmAtMs?: number;
};
export type ContentCommand = Partial<ReminderDraft> & {
  kind: 'Edit' | 'Done' | 'Reopen' | 'Delete' | 'UndoDelete' | 'Skip'; operationId: string; occurrenceId: string; expectedRevision: number;
};
export type AppSettings = {
  revision: number; snoozeMinutes: number; tomorrowMorning: number; tomorrowAfternoon: number;
  tomorrowEvening: number; sound: 'remilo' | 'system'; vibration: boolean; theme: 'system' | 'light' | 'dark';
};
export type RecurrenceDraft = {
  frequency: 'daily' | 'weekly' | 'monthlyDay' | 'monthlyOrdinal' | 'lastWeekday' | 'yearly';
  interval: number; weekdays?: number[]; day?: number; ordinal?: number; weekday?: number; month?: number;
  count?: number; until?: string; zoneMode: 'floating' | 'pinned';
};
export type Series = {
  id: string; seriesId: string; revision: number; state: 'Active' | 'Paused' | 'Archived'; exhausted: boolean;
  template: Required<ReminderDraft>; rule: RecurrenceDraft & { anchor: string; zoneId: string | null; endExclusive: string | null };
  registered: number; pending: number; upcoming: { nominalSlot: string; eventStartMs: number; alarmAtMs: number }[];
};
export type SeriesCommand =
  (ReminderDraft & { kind: 'CreateSeries'; recurrence: RecurrenceDraft; operationId: string }) |
  (ReminderDraft & { kind: 'EditSeries' | 'EditFollowing'; recurrence: RecurrenceDraft; operationId: string; segmentId: string; expectedRevision: number; nominalSlot?: string }) |
  { kind: 'PauseSeries' | 'ResumeSeries'; operationId: string; segmentId: string; expectedRevision: number };
export type Command = CreateCommand | DeliveryCommand | ContentCommand | SeriesCommand |
  (Partial<AppSettings> & { kind: 'Settings'; operationId: string; expectedRevision: number }) |
  { kind: 'StopAll'; operationId: string; expectedSessionId: string };
export type CommandResult = {
  status: 'Scheduled' | 'Blocked' | 'Pending' | 'Applied' | 'Rejected';
  occurrence?: Occurrence; segmentId?: string; generation?: number; errorCode?: string;
  errorField?: string; errorMessage?: string; count?: number; added?: number; preserved?: number; blocked?: number; retry?: boolean;
};
export type SchedulePreview = { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number; warnings: string[];
  upcoming: { nominalSlot: string; eventStartMs: number; dueAtMs: number; alarmAtMs: number; adjusted: boolean; zoneId: string }[] };
export type ImportPreview = { count: number; items: { id: string; title: string; conflict: boolean; futureAlert: boolean }[] };
