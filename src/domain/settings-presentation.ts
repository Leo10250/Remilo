import type { Capabilities } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import type { PreferencePatch } from './preferences';
import type { AtmosphereSelection } from './appearance';

export const atmosphereNames: Record<AtmosphereSelection, string> = {
  automatic: 'By time of day', sunrise: 'Sunrise', sky: 'Sky', evening: 'Evening', night: 'Night',
};
export const preferenceGroups = [
  ['defaults', ['sound', 'vibration']],
  ['postponement', ['snoozeMinutes', 'tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening']],
  ['appearance', ['theme', 'atmosphere']],
] as const;
export function preferenceRecoveryOwner(fields: (keyof PreferencePatch)[]) {
  return preferenceGroups.find(([, group]) => group.some(field => fields.includes(field)));
}
type PermissionAccess = Pick<Capabilities, 'exactAlarms' | 'notifications' | 'channelEnabled' | 'notificationChannelEnabled' | 'fullScreen'>;
export type PermissionSummary = { message: string; tone: Tone; needsAttention: boolean; stale: boolean };

/** Summarizes observed access, never alarm audibility or device reliability. */
export function permissionSummary(access?: PermissionAccess, failed = false): PermissionSummary {
  if (!access) return { message: failed ? 'Could not check permissions' : 'Checking permissions…',
    tone: failed ? 'warning' : 'muted', needsAttention: failed, stale: false };
  const issues: string[] = [];
  if (!access.exactAlarms) issues.push('On-time alarms need access');
  if (!access.notifications) issues.push('Notifications are turned off');
  else {
    if (!access.channelEnabled) issues.push('Alarm notifications are off');
    if (!access.notificationChannelEnabled) issues.push('Reminder notifications are off');
  }
  const message = issues.length > 1 ? `${issues.length} alert settings need attention` : issues[0] ??
    (!access.fullScreen ? 'Lock-screen display limited' : 'Permissions allowed');
  return { message: failed ? `Previously: ${message[0].toLowerCase() + message.slice(1)}` : message,
    tone: issues.length ? 'danger' : !access.fullScreen || failed ? 'warning' : 'muted',
    needsAttention: !!issues.length || !access.fullScreen || failed, stale: failed };
}
