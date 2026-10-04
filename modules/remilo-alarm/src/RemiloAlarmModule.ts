import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { Capabilities, CommandResult, CreateCommand, DeliveryCommand, Occurrence, RemiloAlarmModuleEvents } from './RemiloAlarm.types';

declare class RemiloAlarmModule extends NativeModule<RemiloAlarmModuleEvents> {
  createOperationId(): string;
  getCapabilities(): Promise<Capabilities>;
  queryReminders(filter: string, cursor: string | null): Promise<{ items: Occurrence[]; nextCursor: string | null }>;
  getOccurrence(id: string): Promise<Occurrence | null>;
  previewSchedule(draft: { alarmAtMs: number; eventStartMs?: number; dueAtMs?: number }): Promise<Record<string, unknown>>;
  applyCommand(command: CreateCommand | DeliveryCommand): Promise<CommandResult>;
  scheduleTestAlarm(): Promise<CommandResult>;
  reconcile(): Promise<void>;
  openSettings(kind: 'exact' | 'notifications' | 'fullScreen'): Promise<void>;
}

export default requireOptionalNativeModule<RemiloAlarmModule>('RemiloAlarm');
