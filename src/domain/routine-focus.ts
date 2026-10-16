import type { RoutineSession } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

/** Selecting another exercise is navigation only; completed items stay inspectable. */
export function routineFocusStep(session: Pick<RoutineSession, 'steps'>, selected?: string) {
  return session.steps.find(step => step.id === selected) ?? session.steps.find(step => !step.completed);
}

/** Advance only from the native confirmed result, including an earlier unfinished item. */
export function nextRoutineFocus(session: Pick<RoutineSession, 'steps'>, completedId: string) {
  const index = session.steps.findIndex(step => step.id === completedId);
  return session.steps.slice(index + 1).find(step => !step.completed)?.id ?? session.steps.find(step => !step.completed)?.id;
}

export function routineDayEnded(session: Pick<RoutineSession, 'ended' | 'endsAtMs'>, nowMs: number) {
  return session.ended || session.endsAtMs != null && session.endsAtMs <= nowMs;
}

export function routineProgressModel(completed: number, total: number) {
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const done = Number.isFinite(completed) ? Math.min(count, Math.max(0, Math.floor(completed))) : 0;
  return { total: count, done, ratio: count ? done / count : 0,
    segments: count > 0 && count <= 12 ? Array.from({ length: count }, (_, index) => index < done) : null };
}
