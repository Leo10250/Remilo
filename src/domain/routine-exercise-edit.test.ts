import { describe, expect, it } from 'vitest';
import type { RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { editableRoutineExercise, routineExerciseEditCommand, routineExerciseEditContext } from './routine-exercise-edit';

const plan: RoutinePlan = { id: 'week', revision: 8, state: 'Paused', title: 'Workouts', minutes: 550, mode: 'Alarm', listId: 'list',
  notes: 'Overall notes', sound: 'system', vibration: false, startsOn: '2026-10-01', effectiveDate: '2026-10-17',
  days: Array.from({ length: 7 }, (_, day) => ({ type: 'Exercises', exercises: [
    { id: `first-${day}`, name: 'Same name', target: '3 × 10', notes: 'Setup', customImageId: 'photo-old' },
    { id: `second-${day}`, name: 'Same name', target: '3 × 10', notes: '', illustration: 'front-plank-v1' },
  ] })) };
describe('direct exercise edit', () => {
  it('resolves authored civil weekdays Monday first, including Sunday', () => {
    expect(routineExerciseEditContext('week', '2026-10-12', 'a').weekday).toBe(0);
    expect(routineExerciseEditContext('week', '2026-10-17', 'a').weekday).toBe(5);
    expect(routineExerciseEditContext('week', '2026-10-18', 'a').weekday).toBe(6);
  });
  it('patches exactly the captured ID/day and preserves unrelated fields, images and order', () => {
    const context = routineExerciseEditContext('week', '2026-10-17', 'second-5');
    const exercise = editableRoutineExercise(plan, context)!;
    const command = routineExerciseEditCommand(plan, context, { ...exercise, name: 'Changed', illustration: '', customImageId: 'photo-new' }, 'save-1');
    expect(command).toMatchObject({ routineId: 'week', expectedRevision: 8, operationId: 'save-1', title: plan.title, mode: 'Alarm', sound: 'system', vibration: false, notes: plan.notes, listId: 'list' });
    expect(command.days[5].exercises.map(value => value.id)).toEqual(['first-5', 'second-5']);
    expect(command.days[5].exercises[0]).toEqual(plan.days[5].exercises[0]);
    expect(command.days[5].exercises[1]).toMatchObject({ id: 'second-5', name: 'Changed', customImageId: 'photo-new' });
    for (const day of [0, 1, 2, 3, 4, 6]) expect(command.days[day]).toEqual(plan.days[day]);
    expect(plan.days[5].exercises[1].name).toBe('Same name');
    expect(command).not.toHaveProperty('state'); expect(command).not.toHaveProperty('completed');
    expect(command).not.toHaveProperty('startsOn');
  });
  it('does not substitute an equal name, another weekday, or a trashed family', () => {
    const target = routineExerciseEditContext('week', '2026-10-17', 'first-0');
    expect(editableRoutineExercise(plan, target)).toBeUndefined();
    expect(() => routineExerciseEditCommand(plan, target, plan.days[0].exercises[0], 'stale')).toThrow();
    const current = routineExerciseEditContext('week', '2026-10-17', 'first-5');
    expect(editableRoutineExercise({ ...plan, state: 'Trashed' }, current)).toBeUndefined();
    expect(editableRoutineExercise({ ...plan, id: 'other' }, current)).toBeUndefined();
    expect(() => routineExerciseEditCommand(plan, current, plan.days[5].exercises[1], 'wrong')).toThrow();
  });
});
