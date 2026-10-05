export type RemiloAlarmModuleEvents = { onChange: (params: Record<string, never>) => void };
export type Capabilities = {
  exactAlarms: boolean; notifications: boolean; channelEnabled: boolean;
  fullScreen: boolean; unlocked: boolean; observedAtMs: number; activeSessionId: string;
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
};
export type ReminderFilter = { view: 'today' | 'upcoming' | 'attention' | 'all' | 'history' | 'deleted'; search?: string; listName?: string };
export type CreateCommand = ReminderDraft & { kind: 'Create'; operationId: string; alarmAtMs?: number };
export type DeliveryCommand = {
  kind: 'Stop' | 'Snooze' | 'Postpone'; operationId: string; occurrenceId: string; expectedGeneration: number; alarmAtMs?: number;
};
export type ContentCommand = Partial<ReminderDraft> & {
  kind: 'Edit' | 'Done' | 'Reopen' | 'Delete' | 'UndoDelete'; operationId: string; occurrenceId: string; expectedRevision: number;
};
export type AppSettings = {
  revision: number; snoozeMinutes: number; tomorrowMorning: number; tomorrowAfternoon: number;
  tomorrowEvening: number; sound: 'remilo' | 'system'; vibration: boolean; theme: 'system' | 'light' | 'dark';
};
export type Command = CreateCommand | DeliveryCommand | ContentCommand |
  (Partial<AppSettings> & { kind: 'Settings'; operationId: string; expectedRevision: number }) |
  { kind: 'StopAll'; operationId: string; expectedSessionId: string };
export type CommandResult = {
  status: 'Scheduled' | 'Blocked' | 'Pending' | 'Applied' | 'Rejected';
  occurrence?: Occurrence; generation?: number; errorCode?: string;
  errorField?: string; errorMessage?: string; count?: number; added?: number; preserved?: number; blocked?: number; retry?: boolean;
};
export type SchedulePreview = { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number; warnings: string[] };
export type ImportPreview = { count: number; items: { id: string; title: string; conflict: boolean; futureAlert: boolean }[] };
