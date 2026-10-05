import { describe, expect, it } from 'vitest';
import { commandFeedback, quickReminder } from './quick-reminder';

describe('quick reminder input', () => {
  it('uses one stable operation identity and a resolved concrete time', () => {
    const draft = quickReminder('  Pick up parcel  ', '10', 1_000_000, 'retry-id');
    expect(draft).toEqual({ kind: 'Create', operationId: 'retry-id', title: 'Pick up parcel', alarmAtMs: 1_600_000 });
  });
  it.each(['', 'NaN', '-1', '0', 'Infinity', '1e100'])('rejects unsafe delay %s', (delay) => {
    expect(() => quickReminder('Reminder', delay, 1_000_000, 'id')).toThrow();
  });
  it('does not silently accept empty or excessive titles', () => {
    expect(() => quickReminder(' ', '1', 100, 'id')).toThrow();
    expect(() => quickReminder('x'.repeat(201), '1', 100, 'id')).toThrow();
  });
});
describe('honest command feedback', () => {
  it('distinguishes OS registration from blocked and pending persistence', () => {
    expect(commandFeedback({ status: 'Scheduled' })).toContain('registered with Android');
    expect(commandFeedback({ status: 'Blocked' })).toContain('delivery is blocked');
    expect(commandFeedback({ status: 'Pending' })).toContain('still pending');
  });
  it('requests refresh for a stale action and preserves Stop versus Done', () => {
    expect(commandFeedback({ status: 'Rejected', errorCode: 'STALE_GENERATION' })).toContain('Refresh');
    expect(commandFeedback({ status: 'Applied' }, 'Stop')).toContain('unfinished');
    expect(commandFeedback({ status: 'Applied' }, 'Done')).toContain('completed');
    expect(commandFeedback({ status: 'Applied' }, 'Done')).not.toContain('unfinished');
  });
});
