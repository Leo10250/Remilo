/** Memory-only review outcomes, matching native projection without issuing a command. */
import type { Occurrence, SchedulePreview } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type ReviewContentAction = 'done' | 'reopen' | 'trash' | 'restore';

export function reviewContentAction(selected: Occurrence, action: ReviewContentAction, nowMs: number, retainedTarget?: number) {
  const target = selected.nextAlertMs ?? retainedTarget ?? selected.alarmAtMs;
  const changed = { ...selected, revision: selected.revision + 1, generation: selected.generation + 1,
    completed: action === 'done' ? true : action === 'reopen' ? false : selected.completed,
    deleted: action === 'trash' ? true : action === 'restore' ? false : selected.deleted,
    exception: selected.exception || (action === 'reopen' || action === 'restore') && !!selected.segmentId,
    history: [...(selected.history ?? []), { kind: { done: 'Done', reopen: 'Reopen', trash: 'Delete', restore: 'UndoDelete' }[action], atMs: nowMs, targetMs: selected.alarmAtMs }],
  };
  const state = changed.completed ? 'Completed' : changed.deleted ? 'Deleted' : changed.skipped ? 'Skipped' : changed.mode === 'None' ? 'NoAlert'
    : changed.seriesState === 'Paused' && !changed.exception && target > nowMs ? 'Paused' : target <= nowMs ? 'Missed' : 'Scheduled';
  const item: Occurrence = { ...changed, deliveryState: state, nextAlertMs: state === 'Scheduled' ? target : null,
    overdue: !changed.completed && !changed.skipped && !changed.deleted && changed.dueAtMs < nowMs,
    ...(action === 'done' || action === 'trash' ? { collectionAtMs: nowMs } : {}),
  };
  return { item, retainedTarget: target };
}

export function reviewDuplicate(item: Occurrence): Occurrence {
  return { ...item, id: 'new-review-item', title: item.title.slice(0, 193) + ' (copy)', revision: 0, generation: 0,
    completed: false, deleted: false, skipped: false, overdue: false, history: [],
    segmentId: null, nominalSlot: null, exception: false, seriesState: null, repeatRule: null, repeatSummary: null,
    nextAlertMs: item.mode === 'None' ? null : item.alarmAtMs, deliveryState: item.mode === 'None' ? 'NoAlert' : 'Scheduled',
    alertAdjustment: null, collectionAtMs: undefined };
}

export function reviewDueLink(draft: Occurrence, preview: SchedulePreview | undefined, dueLinked: boolean): Partial<Occurrence> {
  const dueAtMs = dueLinked ? draft.allDay ? preview?.eventEndMs ?? draft.eventEndMs : draft.eventStartMs : preview?.dueAtMs ?? draft.dueAtMs;
  return { dueLinked, dueAtMs, ...(dueLinked && draft.alarmLinked && !draft.allDay ? { alarmAtMs: dueAtMs } : {}) };
}

export function reviewAlertLink(draft: Occurrence, preview: SchedulePreview | undefined, alarmLinked: boolean): Partial<Occurrence> {
  return { alarmLinked, alarmAtMs: alarmLinked && !draft.allDay ? preview?.dueAtMs ?? draft.dueAtMs : preview?.alarmAtMs ?? draft.alarmAtMs };
}
