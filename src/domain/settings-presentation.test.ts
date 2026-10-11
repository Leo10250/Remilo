import { describe, expect, it } from 'vitest';
import { permissionSummary, preferenceRecoveryOwner } from './settings-presentation';

const allowed = { exactAlarms: true, notifications: true, channelEnabled: true, notificationChannelEnabled: true, fullScreen: true };
describe('observed permission summaries', () => {
  it('does not claim working alarms from allowed permissions', () => {
    expect(permissionSummary(allowed)).toEqual({ message: 'Permissions allowed', tone: 'muted', needsAttention: false, stale: false });
  });
  it('separates reminder-channel blocking from alarms and full-screen presentation', () => {
    expect(permissionSummary({ ...allowed, notificationChannelEnabled: false }).message).toBe('Reminder notifications are off');
    expect(permissionSummary({ ...allowed, fullScreen: false })).toMatchObject({ message: 'Lock-screen display limited', tone: 'warning' });
    expect(permissionSummary({ ...allowed, channelEnabled: false, fullScreen: false })).toMatchObject({ message: 'Alarm notifications are off', tone: 'danger' });
  });
  it('does not count channel failures twice when app notifications are off', () => {
    expect(permissionSummary({ ...allowed, notifications: false, channelEnabled: false, notificationChannelEnabled: false }).message).toBe('Notifications are turned off');
    expect(permissionSummary({ ...allowed, notifications: false, exactAlarms: false }).message).toBe('2 alert settings need attention');
  });
  it('never makes a failed or missing observation look current and allowed', () => {
    expect(permissionSummary(undefined)).toMatchObject({ message: 'Checking permissions…', tone: 'muted' });
    expect(permissionSummary(undefined, true)).toMatchObject({ message: 'Could not check permissions', tone: 'warning', needsAttention: true });
    expect(permissionSummary(allowed, true)).toMatchObject({ message: 'Previously: permissions allowed', stale: true, needsAttention: true });
    expect(permissionSummary({ ...allowed, exactAlarms: false }, true)).toMatchObject({ message: 'Previously: on-time alarms need access', tone: 'danger', stale: true });
  });
  it('keeps recovery attached to one overview group for jobs spanning child surfaces', () => {
    expect(preferenceRecoveryOwner(['atmosphere', 'snoozeMinutes'])?.[0]).toBe('postponement');
    expect(preferenceRecoveryOwner(['theme', 'sound'])?.[0]).toBe('defaults');
    expect(preferenceRecoveryOwner(['tomorrowEvening'])?.[0]).toBe('postponement');
    expect(preferenceRecoveryOwner([])).toBeUndefined();
  });
});
