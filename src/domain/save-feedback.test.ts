import { describe, expect, it } from 'vitest';
import type { Capabilities, CommandResult, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { saveFeedback } from './save-feedback';
const now = Date.parse('2026-10-10T12:00:00Z');
const item = { mode: 'Alarm', deliveryState: 'Scheduled', alarmAtMs: now + 60_000, nextAlertMs: now + 60_000, zoneId: 'UTC' } as Occurrence;
const access: Capabilities = { exactAlarms: true, notifications: true, channelEnabled: true, notificationChannelEnabled: true, fullScreen: true, unlocked: true, observedAtMs: now, activeSessionId: '', activeSessionActions: null };
describe('captured save outcomes', () => {
  it('distinguishes captured creation and edit while retaining actual confirmed timing', () => {
    const result: CommandResult = { status: 'Scheduled', occurrence: item };
    expect(saveFeedback({ kind: 'Create', mode: 'Alarm' }, result, {}, now).message).toContain('Alarm set');
    expect(saveFeedback({ kind: 'Edit', mode: 'Alarm' }, result, {}, now).message).toContain('Alarm updated');
    expect(saveFeedback({ kind: 'Edit', mode: 'None' }, result, {}, now).message).toContain('Alarm updated');
    expect(saveFeedback({ kind: 'EditSeries' }, { status: 'Scheduled', segmentId: 'series' }, {}, now).message).toBe('Repeat schedule updated');
  });
  it.each(['Missed', 'Blocked', 'Pending', 'Changing', 'Notified'])('does not promise a set alarm from a populated %s target', deliveryState => {
    expect(saveFeedback({ kind: 'Create' }, { status: 'Scheduled', occurrence: { ...item, deliveryState } }, {}, now).message).toBe('Reminder created');
  });
  it('does not promise a future alarm for terminal or elapsed saved targets', () => {
    for (const patch of [{ completed: true }, { deleted: true }, { skipped: true }, { nextAlertMs: now - 1 }])
      expect(saveFeedback({ kind: 'Edit' }, { status: 'Scheduled', occurrence: { ...item, ...patch } }, {}, now).message).toBe('Reminder updated');
  });
  it('routes only fresh mode-specific access failures to alarm check', () => {
    const blocked: CommandResult = { status: 'Blocked' };
    expect(saveFeedback({ kind: 'Edit', mode: 'Alarm' }, blocked, { access: { ...access, exactAlarms: false } }, now).review).toBe('access');
    expect(saveFeedback({ kind: 'Edit', mode: 'Notification' }, blocked, { access: { ...access, exactAlarms: false } }, now).review).toBe('reminder');
    expect(saveFeedback({ kind: 'Edit', mode: 'Notification' }, blocked, { access: { ...access, notificationChannelEnabled: false } }, now).review).toBe('access');
    for (const observation of [{ access: { ...access, fullScreen: false } }, { access: { ...access, exactAlarms: false }, failed: true }, { access: { ...access, exactAlarms: false }, checking: true }, { access: { ...access, exactAlarms: false, observedAtMs: now - 60_001 } }, {}])
      expect(saveFeedback({ kind: 'Edit', mode: 'Alarm' }, blocked, observation, now).review).toBe('reminder');
  });
  it('retains mixed results and uses persistent review without a blanket success', () => {
    const result: CommandResult = { status: 'Partial', memberResults: [{ occurrenceId: 'a', generation: 1, status: 'Scheduled' }, { occurrenceId: 'b', generation: 1, status: 'Pending' }] };
    const feedback = saveFeedback({ kind: 'EditSeries' }, result, { access }, now);
    expect(feedback.message).toContain('1 of 2'); expect(feedback.persistent).toBe(true); expect(feedback.review).toBe('schedule');
    expect(saveFeedback({ kind: 'Edit', mode: 'None' }, { status: 'Applied' }, {}, now).message).toBe('Reminder updated · No alert');
  });
});
