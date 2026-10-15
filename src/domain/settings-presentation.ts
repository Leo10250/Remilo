import { t, live } from '../localization';
import type { Capabilities } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import type { PreferencePatch } from './preferences';
import type { AtmosphereSelection } from './appearance';

export const atmosphereNames: Record<AtmosphereSelection, string> = live(() => ({
  automatic: t('m_538108742b50'), sunrise: t('m_9c7c53e80a4e'), sky: t('m_b72804afefc3'), evening: t('m_458c1fed5743'), night: t('m_4e9f8db8242b'),
}));
export const preferenceGroups = [
  ['defaults', ['sound', 'vibration']],
  ['postponement', ['snoozeMinutes', 'tomorrowMorning', 'tomorrowAfternoon', 'tomorrowEvening']],
  ['appearance', ['theme', 'atmosphere']],
  ['language', ['language']],
] as const;
export function preferenceRecoveryOwner(fields: (keyof PreferencePatch)[]) {
  return preferenceGroups.find(([, group]) => group.some(field => fields.includes(field)));
}
type PermissionAccess = Pick<Capabilities, 'exactAlarms' | 'notifications' | 'channelEnabled' | 'notificationChannelEnabled' | 'fullScreen'>;
export type PermissionSummary = { message: string; tone: Tone; needsAttention: boolean; stale: boolean };

/** Summarizes observed access, never alarm audibility or device reliability. */
export function permissionSummary(access?: PermissionAccess, failed = false): PermissionSummary {
  if (!access) return { message: failed ? t('m_284323d925fe') : t('m_9c3f5ca13afe'),
    tone: failed ? 'warning' : 'muted', needsAttention: failed, stale: false };
  const issues: string[] = [];
  if (!access.exactAlarms) issues.push(t('m_f7c1307035cf'));
  if (!access.notifications) issues.push(t('m_9b91d39d87a6'));
  else {
    if (!access.channelEnabled) issues.push(t('m_1f9695c484ed'));
    if (!access.notificationChannelEnabled) issues.push(t('m_ed79c85d64e5'));
  }
  const message = issues.length > 1 ? t('m_a363480cd2c7', { arg0: String(issues.length) }) : issues[0] ??
    (!access.fullScreen ? t('m_2c9a231165b5') : t('m_cf0a4ebe2cad'));
  return { message: failed ? t('m_69094fed8df9', { arg0: String(message[0].toLowerCase() + message.slice(1)) }) : message,
    tone: issues.length ? 'danger' : !access.fullScreen || failed ? 'warning' : 'muted',
    needsAttention: !!issues.length || !access.fullScreen || failed, stale: failed };
}
