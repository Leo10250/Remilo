import type { RoutineCommand, RoutineExercise, RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type RoutineExerciseEditContext = { routineId: string; date: string; stepId: string; weekday: number };
/** Plans use Monday first. Resolve the authored civil date, not UTC or completed count. */
export function routineExerciseEditContext(routineId: string, date: string, stepId: string): RoutineExerciseEditContext {
  const civil = new Date(date + 'T12:00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(civil.getTime())) throw new Error('Invalid routine date');
  return { routineId, date, stepId, weekday: (civil.getDay() + 6) % 7 };
}
export function editableRoutineExercise(plan: RoutinePlan, context: RoutineExerciseEditContext): RoutineExercise | undefined {
  if (plan.id !== context.routineId || plan.state === 'Trashed') return;
  return plan.days[context.weekday]?.exercises.find(exercise => exercise.id === context.stepId);
}
/** Deliberately excludes progress and operational fields; the native edit reconciles current checks. */
export function routineExerciseEditCommand(plan: RoutinePlan, context: RoutineExerciseEditContext, value: RoutineExercise, operationId: string): Extract<RoutineCommand, { kind: 'EditRoutine' }> {
  const saved = editableRoutineExercise(plan, context);
  if (!saved || value.id !== context.stepId || value.sharedStepId !== saved.sharedStepId) throw new Error('Step unavailable');
  return { kind: 'EditRoutine', operationId, routineId: plan.id, expectedRevision: plan.revision,
    title: plan.title, minutes: plan.minutes, mode: plan.mode, listId: plan.listId, notes: plan.notes, sound: plan.sound, vibration: plan.vibration,
    authoringMode: plan.authoringMode, presentationPreset: plan.presentationPreset,
    days: plan.days.map((day, index) => ({ type: day.type, exercises: day.exercises.map(exercise => {
      const shared = plan.authoringMode === 'Shared' && !!value.sharedStepId && exercise.sharedStepId === value.sharedStepId;
      return shared || index === context.weekday && exercise.id === context.stepId ? { ...value, id: exercise.id, sharedStepId: exercise.sharedStepId } : { ...exercise };
    }) })) };
}
