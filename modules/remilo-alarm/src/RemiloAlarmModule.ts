import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { AppSettings, Capabilities, Command, CommandResult, ImportPreview, Occurrence, ReminderDraft, ReminderFilter, ReminderPage, RemiloAlarmModuleEvents, SchedulePreview, RecurrenceDraft, Series } from './RemiloAlarm.types';

declare class RemiloAlarmModule extends NativeModule<RemiloAlarmModuleEvents> {
  createOperationId(): string;
  getCapabilities(): Promise<Capabilities>;
  queryReminders(filter: ReminderFilter, cursor: string | null): Promise<ReminderPage>;
  getOccurrence(id: string): Promise<Occurrence | null>;
  previewSchedule(draft: ReminderDraft & { recurrence?: RecurrenceDraft }): Promise<SchedulePreview>;
  querySeries(): Promise<Series[]>;
  getSeries(id: string): Promise<Series | null>;
  getSeriesDraft(id: string, nominal: string): Promise<{ template: Required<ReminderDraft>; remainingCount: number | null }>;
  applyCommand(command: Command): Promise<CommandResult>;
  scheduleTestAlarm(): Promise<CommandResult>;
  getSettings(): Promise<AppSettings>;
  getLists(): Promise<string[]>;
  getDiagnostics(): Promise<Record<string, unknown>>;
  previewSound(sound: string): Promise<CommandResult>;
  exportBackup(): Promise<string>;
  previewImport(json: string): Promise<ImportPreview>;
  importBackup(json: string, copyIds: string[], operationId: string): Promise<CommandResult>;
  reconcile(): Promise<void>;
  openSettings(kind: 'exact' | 'notifications' | 'fullScreen'): Promise<void>;
}

export default requireOptionalNativeModule<RemiloAlarmModule>('RemiloAlarm');
