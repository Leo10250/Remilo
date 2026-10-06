import { describe, expect, it } from 'vitest';
import { reviewCollectionItems, reviewItems, reviewNowMs } from './design-review-fixtures';
import { reviewAlertLink, reviewContentAction, reviewDueLink, reviewDuplicate } from './review-actions';
import type { SchedulePreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

describe('memory-only design review transitions', () => {
  it('completes and reopens a future target without losing its alert instant', () => {
    const original = reviewItems('populated').find((item) => item.id === 'read')!;
    const done = reviewContentAction(original, 'done', reviewNowMs);
    expect(done.item).toMatchObject({ completed: true, deliveryState: 'Completed', nextAlertMs: null, overdue: false });
    const reopened = reviewContentAction(done.item, 'reopen', reviewNowMs, done.retainedTarget);
    expect(reopened.item).toMatchObject({ completed: false, deliveryState: 'Scheduled', nextAlertMs: original.nextAlertMs,
      generation: original.generation + 2, revision: original.revision + 2 });
    expect(original.completed).toBe(false);
  });

  it('reopens an elapsed completed item as missed and overdue without replaying it', () => {
    const old = reviewCollectionItems('completed').find((item) => item.completed)!;
    const result = reviewContentAction(old, 'reopen', reviewNowMs);
    expect(result.item).toMatchObject({ completed: false, deliveryState: 'Missed', nextAlertMs: null, overdue: true });
  });

  it('preserves skipped state under the current native Reopen contract', () => {
    const old = reviewCollectionItems('completed').find((item) => item.skipped)!;
    expect(reviewContentAction(old, 'reopen', reviewNowMs).item).toMatchObject({ skipped: true, deliveryState: 'Skipped', nextAlertMs: null });
  });

  it('restores completed Trash without inventing a stopped or upcoming delivery', () => {
    const completed = reviewCollectionItems('completed').find((item) => item.completed)!;
    const removed = reviewContentAction(completed, 'trash', reviewNowMs);
    const restored = reviewContentAction(removed.item, 'restore', reviewNowMs, removed.retainedTarget);
    expect(restored.item).toMatchObject({ deleted: false, completed: true, deliveryState: 'Completed', nextAlertMs: null });
    expect(restored.item.history?.at(-1)?.kind).toBe('UndoDelete');
  });

  it('restores an elapsed unfinished Trash as missed and keeps No alert silent', () => {
    const old = reviewCollectionItems('trash')[0];
    expect(reviewContentAction(old, 'restore', reviewNowMs).item).toMatchObject({ deleted: false, deliveryState: 'Missed', nextAlertMs: null, overdue: true });
    expect(reviewContentAction({ ...old, mode: 'None' }, 'restore', reviewNowMs).item).toMatchObject({ deliveryState: 'NoAlert', nextAlertMs: null });
  });

  it('preserves a changed future target through completion and reopen', () => {
    const old = reviewItems('overdue').find((item) => item.id === 'postponed')!;
    const done = reviewContentAction(old, 'done', reviewNowMs);
    expect(reviewContentAction(done.item, 'reopen', reviewNowMs, done.retainedTarget).item).toMatchObject({ nextAlertMs: old.nextAlertMs,
      alarmAtMs: old.alarmAtMs, eventStartMs: old.eventStartMs, dueAtMs: old.dueAtMs, alertAdjustment: 'Postponed', overdue: true });
  });

  it('duplicates editable content while clearing all terminal and recurrence identity', () => {
    const old = { ...reviewCollectionItems('completed').find((item) => item.skipped)!, deleted: true, completed: true,
      alertAdjustment: 'Snoozed' as const, nextAlertMs: reviewNowMs + 600_000, exception: true };
    const copy = reviewDuplicate(old);
    expect(copy).toMatchObject({ id: 'new-review-item', completed: false, deleted: false, skipped: false, revision: 0,
      generation: 0, segmentId: null, nominalSlot: null, exception: false, seriesState: null, repeatRule: null,
      repeatSummary: null, deliveryState: 'Scheduled', nextAlertMs: old.alarmAtMs, alertAdjustment: null, history: [] });
    expect(copy.title).toBe(old.title + ' (copy)');
    expect(copy.eventStartMs).toBe(old.eventStartMs);
    expect(copy.dueAtMs).toBe(old.dueAtMs);
    expect(copy.collectionAtMs).toBeUndefined();
  });
});

describe('all-day link normalization', () => {
  const original = reviewItems('all-day').find((item) => item.id === 'all-day')!;
  const stale = { ...original, dueAtMs: reviewNowMs, alarmAtMs: reviewNowMs + 1_800_000 };
  const preview: SchedulePreview = { eventStartMs: original.eventStartMs, eventEndMs: original.eventEndMs,
    dueAtMs: original.dueAtMs, alarmAtMs: original.alarmAtMs, warnings: [], upcoming: [] };

  it('unlinks Due from the normalized end-of-day instant', () => {
    expect(reviewDueLink(stale, preview, false)).toEqual({ dueLinked: false, dueAtMs: original.eventEndMs });
  });

  it('unlinks Alert from the normalized 9 AM instant', () => {
    expect(reviewAlertLink(stale, preview, false)).toEqual({ alarmLinked: false, alarmAtMs: original.alarmAtMs });
  });

  it('relinking all-day Due does not replace the automatic 9 AM alert', () => {
    expect(reviewDueLink(stale, preview, true)).toEqual({ dueLinked: true, dueAtMs: original.eventEndMs });
    expect(reviewAlertLink(stale, preview, true)).toEqual({ alarmLinked: true, alarmAtMs: original.alarmAtMs });
  });
});
