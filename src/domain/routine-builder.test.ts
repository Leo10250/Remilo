import { describe, expect, it } from 'vitest';
import type { RoutinePlan } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canChangeRoutineArrangement, copyRoutineDay, replaceSharedSteps, routineBuilder, routineBuilderPayload, selectRoutineDays, shareRoutineStepsFrom, separateRoutineDays } from './routine-builder';
import { routineExerciseEditCommand, routineExerciseEditContext } from './routine-exercise-edit';

const allocator = () => { let n = 0; return () => `allocated-${++n}`; };
const step = (id: string) => ({ id, name: 'Same name', target: '10 minutes', notes: 'Authored instructions', customImageId: 'photo' });
const plan = (builder: ReturnType<typeof routineBuilder>): RoutinePlan => ({ ...routineBuilderPayload(builder), id: 'routine', revision: 4, state: 'Active', startsOn: '2026-10-12', effectiveDate: '2026-10-12',
  title: 'Morning', notes: '', sound: 'remilo', vibration: false, minutes: 540, mode: 'None', listId: null });

describe('generic routine builder', () => {
  it('requires selected source days before changing an arrangement with unsaved content', () => {
    const allocate = allocator(), authored = replaceSharedSteps(routineBuilder(), [step('a')], allocate);
    expect(canChangeRoutineArrangement(routineBuilder())).toBe(true);
    expect(canChangeRoutineArrangement(authored)).toBe(false);
    const selected = selectRoutineDays(authored, [0], allocate);
    expect(canChangeRoutineArrangement(selected)).toBe(true);
    const independent = selectRoutineDays(separateRoutineDays(selected), [], allocate);
    expect(canChangeRoutineArrangement(independent)).toBe(false);
    expect(canChangeRoutineArrangement(selectRoutineDays(independent, [0], allocate))).toBe(true);
    expect(independent.days[0].exercises[0].name).toBe('Same name');
  });
  it('starts blank and generic without selecting days or seeding content', () => {
    const draft = routineBuilder();
    expect(draft).toMatchObject({ authoringMode: 'Shared', presentationPreset: 'General', sharedSteps: [] });
    expect(draft.days.every(day => day.type === 'Rest' && !day.exercises.length)).toBe(true);
  });
  it('materializes unique weekday identities and preserves them through content edits and reordering', () => {
    const allocate = allocator();
    let draft = replaceSharedSteps(routineBuilder(), [step('logical-a'), step('logical-b')], allocate);
    draft = selectRoutineDays(draft, [0, 2, 6], allocate);
    const before = draft.days.map(day => day.exercises.map(value => value.id));
    const ids = routineBuilderPayload(draft).days.flatMap(day => day.exercises.map(value => value.id));
    expect(new Set(ids).size).toBe(6);
    draft = replaceSharedSteps(draft, [{ ...draft.sharedSteps[1], target: '20 minutes' }, draft.sharedSteps[0]], allocate);
    for (let d = 0; d < 7; d++) expect(draft.days[d].exercises.map(value => value.id)).toEqual([...before[d]].reverse());
    expect(draft.days[2].exercises[0].target).toBe('20 minutes');
  });
  it('restores unsaved disabled-day identities but exports no dormant steps', () => {
    const allocate = allocator();
    let draft = selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate);
    const id = draft.days[0].exercises[0].id;
    draft = selectRoutineDays(draft, [1], allocate);
    expect(routineBuilderPayload(draft).days[0].exercises).toEqual([]);
    draft = selectRoutineDays(draft, [0, 1], allocate);
    expect(draft.days[0].exercises[0].id).toBe(id);
    const reloaded = selectRoutineDays(routineBuilder(plan(selectRoutineDays(draft, [1], allocate))), [0, 1], allocate);
    expect(reloaded.days[0].exercises[0].id).not.toBe(id);
  });
  it('reloads explicit linkage without inferring shared sequences from matching names', () => {
    const allocate = allocator();
    const shared = selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate);
    expect(routineBuilder(plan(shared)).sharedSteps[0].id).toBe('a');
    const legacy = { ...plan(shared), authoringMode: undefined, presentationPreset: undefined };
    expect(routineBuilder(legacy)).toMatchObject({ authoringMode: 'ByWeekday', presentationPreset: 'Exercise', sharedSteps: [] });
  });
  it('converts to independent weekdays without changing materialized IDs', () => {
    const allocate = allocator(), shared = selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate);
    const weekdays = separateRoutineDays(shared);
    expect(weekdays.days.map(day => day.exercises.map(value => value.id))).toEqual(shared.days.map(day => day.exercises.map(value => value.id)));
    expect(weekdays.days.every(day => day.exercises.every(value => !value.sharedStepId))).toBe(true);
  });
  it('uses an explicit source for conversion back, retaining only source IDs', () => {
    const allocate = allocator(), before = separateRoutineDays(selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate));
    const after = shareRoutineStepsFrom(before, 1, allocate);
    expect(after.days[1].exercises[0].id).toBe(before.days[1].exercises[0].id);
    expect(after.days[0].exercises[0].id).not.toBe(before.days[0].exercises[0].id);
    expect(after.days[0].exercises[0].sharedStepId).toBe(after.days[1].exercises[0].sharedStepId);
  });
  it('copies independent weekday content and immutable photos with new IDs', () => {
    const allocate = allocator(), before = separateRoutineDays(selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate));
    const after = copyRoutineDay(before, 0, 1, allocate);
    expect(after.days[1].exercises[0]).toMatchObject({ name: 'Same name', customImageId: 'photo' });
    expect(after.days[1].exercises[0].id).not.toBe(before.days[0].exercises[0].id);
    expect(after.days[1].exercises[0].sharedStepId).toBeUndefined();
  });
  it('duplicates both identity layers independently while retaining linkage and preset', () => {
    const allocate = allocator(), original = plan(selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a')], allocate), [0, 1], allocate));
    const copy = routineBuilder(original, allocate);
    expect(copy.days[0].exercises[0].id).not.toBe(original.days[0].exercises[0].id);
    expect(copy.sharedSteps[0].id).not.toBe('a');
    expect(copy.days[0].exercises[0].sharedStepId).toBe(copy.days[1].exercises[0].sharedStepId);
    expect(copy.presentationPreset).toBe('General');
  });
  it('edits linked copies by stable identity even with duplicate names and preserves all progress IDs', () => {
    const allocate = allocator(), source = plan(selectRoutineDays(replaceSharedSteps(routineBuilder(), [step('a'), step('b')], allocate), [0, 1], allocate));
    const target = source.days[1].exercises[1], context = routineExerciseEditContext(source.id, '2026-10-13', target.id);
    const command = routineExerciseEditCommand(source, context, { ...target, name: 'Changed' }, 'edit');
    expect(command.days[0].exercises.map(value => value.name)).toEqual(['Same name', 'Changed']);
    expect(command.days[1].exercises.map(value => value.id)).toEqual(source.days[1].exercises.map(value => value.id));
    expect(() => routineExerciseEditCommand(source, context, { ...target, sharedStepId: 'a' }, 'bad')).toThrow();
  });
  it('changing preset retains every authored field and identity', () => {
    const allocate = allocator(), before = replaceSharedSteps(routineBuilder(), [step('a')], allocate);
    const after = { ...before, presentationPreset: 'Exercise' as const };
    expect(after.days).toEqual(before.days); expect(after.sharedSteps).toEqual(before.sharedSteps);
  });
});
