import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, editDestination, reopenCompleted } from './actions';
describe('contextual actions', () => {
  const done = { id: 'a', completed: true, deleted: false, skipped: false, revision: 4 } as Occurrence;
  it('undo reverses only the captured completion, never toggles or reverses a later action', () => {
    expect(reopenCompleted(done, 4, 'undo')).toMatchObject({ kind: 'Reopen', expectedRevision: 4 });
    expect(reopenCompleted({ ...done, completed: false }, 4, 'undo')).toBeNull();
    expect(reopenCompleted({ ...done, revision: 6 }, 4, 'undo')).toBeNull();
    expect(reopenCompleted({ ...done, deleted: true }, 4, 'undo')).toBeNull();
  });
  it('routes a one-off straight to editing and a repeat to scope selection', () => {
    expect(editDestination({ id: 'a', segmentId: null }).pathname).toBe('/edit');
    expect(editDestination({ id: 'a', segmentId: 's' }).params).toEqual({ id: 'a', action: 'edit' });
  });
  it('does not describe blocked, pending or rejected actions as scheduled', () => {
    expect(commandFeedback({ status: 'Scheduled' }, 'Scheduled').message).toBe('Scheduled');
    expect(commandFeedback({ status: 'Blocked' }, 'Scheduled').tone).toBe('danger');
    expect(commandFeedback({ status: 'Pending' }, 'Scheduled').tone).toBe('warning');
    expect(commandFeedback({ status: 'Rejected' }, 'Scheduled').tone).toBe('danger');
  });
});
