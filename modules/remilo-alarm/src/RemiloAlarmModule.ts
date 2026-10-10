import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { CalendarConnection, CalendarPublication, CalendarPublicationPreview, CalendarPage, CalendarCommand, AppSettings, Capabilities, Command, CommandResult, ImportPreview, Occurrence, ReminderDraft, ReminderFilter, ReminderPage, RemiloAlarmModuleEvents, SchedulePreview, RecurrenceDraft, Series, RepeatFamily, TimeZoneOption, TimeConversion, TimeConversionInput, ListRecord, SoundPreviewSnapshot, ResolvedReminderDraft } from './RemiloAlarm.types';

declare class RemiloAlarmModule extends NativeModule<RemiloAlarmModuleEvents> {
  createOperationId(): string;
  getCapabilities(): Promise<Capabilities>;
  queryReminders(filter: ReminderFilter, cursor: string | null): Promise<ReminderPage>;
  getOccurrence(id: string): Promise<Occurrence | null>;
  previewSchedule(draft: ReminderDraft & { recurrence?: RecurrenceDraft }): Promise<SchedulePreview>;
  querySeries(): Promise<Series[]>;
  queryRepeatFamilies(): Promise<RepeatFamily[]>;
  getTimeZones(atMs: number): Promise<TimeZoneOption[]>;
  convertTime(input: TimeConversionInput): Promise<TimeConversion>;
  getSeries(id: string): Promise<Series | null>;
  getSeriesDraft(id: string, nominal: string): Promise<{ template: ResolvedReminderDraft; remainingCount: number | null }>;
  applyCommand(command: Command): Promise<CommandResult>;
  scheduleTestAlarm(operationId: string): Promise<CommandResult>;
  getSettings(): Promise<AppSettings>;
  getCalendarConnection(): Promise<CalendarConnection>;
  getCalendarPublications(): Promise<CalendarPublication[]>;
  previewCalendarPublication(id: string): Promise<CalendarPublicationPreview>;
  authorizeCalendar(publicationId: string | null): Promise<void>;
  listOwnedCalendars(cursor: string | null): Promise<CalendarPage>;
  applyCalendarCommand(command: CalendarCommand): Promise<CalendarConnection | CalendarPublication | { disconnected: boolean }>;
  getLists(): Promise<ListRecord[]>;
  queryLists(): Promise<ListRecord[]>;
  getDiagnostics(): Promise<Record<string, unknown>>;
  previewSound(sound: string, requestId: string): Promise<SoundPreviewSnapshot>;
  stopSoundPreview(requestId: string): Promise<SoundPreviewSnapshot | null>;
  getSoundPreview(): Promise<SoundPreviewSnapshot | null>;
  exportBackup(): Promise<string>;
  previewImport(json: string): Promise<ImportPreview>;
  importBackup(json: string, copyIds: string[], operationId: string): Promise<CommandResult>;
  reconcile(): Promise<void>;
  openSettings(kind: 'exact' | 'notifications' | 'fullScreen'): Promise<void>;
}

export default requireOptionalNativeModule<RemiloAlarmModule>('RemiloAlarm');
