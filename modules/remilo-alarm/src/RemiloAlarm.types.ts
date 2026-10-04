export type RemiloAlarmModuleEvents = { onChange: (params: Record<string, never>) => void };
export type Capabilities = {
  exactAlarms: boolean; notifications: boolean; channelEnabled: boolean;
  fullScreen: boolean; unlocked: boolean; observedAtMs: number;
};
export type Occurrence = {
  id: string; title: string; eventStartMs: number; eventEndMs: number; dueAtMs: number;
  completed: boolean; revision: number; nextAlertMs: number | null;
  generation: number; deliveryState: string;
};
export type CreateCommand = {
  kind: 'Create'; operationId: string; title: string; alarmAtMs: number;
  eventStartMs?: number; eventEndMs?: number; dueAtMs?: number;
};
export type DeliveryCommand = {
  kind: 'Stop' | 'Snooze'; operationId: string; occurrenceId: string; expectedGeneration: number;
};
export type CommandResult = {
  status: 'Scheduled' | 'Blocked' | 'Pending' | 'Applied' | 'Rejected';
  occurrence?: Occurrence; generation?: number; errorCode?: string;
};
