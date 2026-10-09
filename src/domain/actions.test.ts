import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, editDestination, reopenCompleted, restoreDeleted } from './actions';
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
  it('undoes only the captured deletion, without converting completed or skipped content to open', () => {
    expect(restoreDeleted({ ...done, deleted: true }, 4, 'undo-delete')).toEqual({ kind: 'UndoDelete', occurrenceId: 'a', expectedRevision: 4, operationId: 'undo-delete' });
    expect(restoreDeleted({ ...done, deleted: true, skipped: true }, 4, 'undo-delete')?.kind).toBe('UndoDelete');
    expect(restoreDeleted({ ...done, deleted: true, revision: 5 }, 4, 'undo-delete')).toBeNull();
    expect(restoreDeleted(done, 4, 'undo-delete')).toBeNull();
  });
  it('does not describe blocked, pending or rejected actions as scheduled', () => {
    expect(commandFeedback({ status: 'Scheduled' }, 'Scheduled').message).toBe('Scheduled');
    expect(commandFeedback({ status: 'Blocked' }, 'Scheduled').tone).toBe('danger');
    expect(commandFeedback({ status: 'Pending' }, 'Scheduled').tone).toBe('warning');
    expect(commandFeedback({ status: 'Rejected' }, 'Scheduled').tone).toBe('danger');
  });
  it('reports each bulk scheduling outcome without claiming whole-group success', () => {
    const feedback = commandFeedback({ status: 'Partial', memberResults: [
      { occurrenceId: 'a', generation: 3, status: 'Scheduled' },
      { occurrenceId: 'b', generation: 3, status: 'Blocked' },
      { occurrenceId: 'c', generation: 5, status: 'Superseded' },
      { occurrenceId: 'd', generation: 3, status: 'Missed' },
    ] }, 'All snoozed');
    expect(feedback.tone).toBe('warning');
    expect(feedback.message).toContain('1 of 4 alerts scheduled');
    expect(feedback.message).toContain('1 blocked');
    expect(feedback.message).toContain('1 changed since this action');
    expect(feedback.message).toContain('1 elapsed without replay');
    expect(feedback.message).toContain('remain unfinished');
    expect(feedback.message).not.toContain('All snoozed');
    expect(commandFeedback({ status: 'Partial' }, 'All snoozed').tone).toBe('warning');
  });
});
