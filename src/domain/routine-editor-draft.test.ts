import { describe, expect, it } from 'vitest';
import type { RoutineDay, RoutinePlan, TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { editorDraft } from './editor-draft';
import { canAddRoutineExercise, canChangeReminderType, changedRoutineDays, changeRoutineClock, emptyRoutineDays, routinePayload, switchReminderDraftType, validRoutineDays, weeklyEditorDraft } from './routine-editor-draft';
import { civilAt } from './time';

const days = (): RoutineDay[] => {
  const result = emptyRoutineDays();
  result[0] = { type: 'Exercises', exercises: [{ id: 'bird', name: 'Bird-dog', target: '3 × 10', notes: 'Keep hips level', illustration: 'approved-bird' },
    { id: 'plank', name: 'Front plank', target: '3 × 40 sec', notes: '', illustration: 'unknown-imported-id' }] };
  return result;
};
const plan = (): RoutinePlan => ({ id: 'plan', revision: 9, state: 'Active', startsOn: '2026-10-01', effectiveDate: '2026-10-01', title: 'Weekly workouts',
  notes: 'Bring a towel', minutes: 480, mode: 'Notification', sound: 'system', vibration: false, listId: 'personal', days: days() });

describe('shared routine editor draft', () => {
  it('preserves all three alert modes, shared content and unknown illustration identities without exporting ordinary lifecycle settings', () => {
    for (const mode of ['Alarm', 'Notification', 'None'] as const) {
      const draft = editorDraft({ title: 'My workout', notes: 'My overall notes', listId: 'personal', mode, sound: 'system', vibration: true,
        eventStartMs: new Date(2026, 9, 19, 9, 15).getTime(), alarmAtMs: new Date(2026, 9, 19, 9, 15).getTime(), dueLinked: false });
      const payload = routinePayload(draft, { startsOn: '2026-10-19', days: days() });
      expect(payload).toMatchObject({ title: draft.title, notes: draft.notes, mode, sound: 'system', vibration: true, minutes: 555, listId: 'personal' });
      expect(payload.days[0].exercises[1].illustration).toBe('unknown-imported-id');
      expect(payload).not.toHaveProperty('dueAtMs');
      expect(payload).not.toHaveProperty('eventEndMs');
      expect(payload).not.toHaveProperty('recurrence');
      expect(payload.days[0].exercises[0].notes).toBe('Keep hips level');
    }
  });
  it('changes the shared alert clock without discarding inactive reminder timing or common content', () => {
    const original = editorDraft({ title: 'Workout', notes: 'Retain', mode: 'Alarm', dueLinked: false, sound: 'system', vibration: true });
    const changed = changeRoutineClock(original, original.alarmAtMs + 3_600_000);
    expect(changed.alarmAtMs).toBe(original.alarmAtMs + 3_600_000);
    expect(changed).toMatchObject({ notes: 'Retain', title: 'Workout', eventEndMs: original.eventEndMs, dueAtMs: original.dueAtMs, dueLinked: false, sound: 'system', vibration: true });
    expect(original.alarmAtMs).not.toBe(changed.alarmAtMs);
  });
  it('preserves the visible clock from a pinned reminder while producing a floating weekly prompt', async () => {
    const draft = editorDraft({ title: 'Morning workout', zoneId: 'America/New_York', mode: 'Alarm', alarmAtMs: Date.UTC(2026, 9, 19, 13), eventStartMs: Date.UTC(2026, 9, 19, 13) });
    const convert = async (input: TimeConversionInput) => ({ zoneId: input.zoneId, instantMs: input.instantMs ?? Date.parse(input.local + 'Z'),
      local: input.local ?? new Date(input.instantMs!).toISOString().slice(0, 19), offsetSeconds: 0, adjustment: 'none' as const });
    const entered = await switchReminderDraftType(draft, 'Routine', convert);
    expect(routinePayload(entered.draft, { startsOn: '2026-10-19', days: days() }).minutes).toBe(540);
    expect(routinePayload(entered.draft, { startsOn: '2026-10-19', days: days() })).not.toHaveProperty('zoneId');
    const returned = await switchReminderDraftType(entered.draft, 'Reminder', convert);
    expect(returned.draft.zoneId).toBe('America/New_York');
    expect(civilAt(returned.draft.alarmAtMs, returned.draft.zoneId).slice(11, 16)).toBe('09:00');
  });
  it('validates seven explicit days, requires a named active exercise, and treats Sunday rest as an intentional plan value', () => {
    expect(validRoutineDays(days())).toBe(true);
    expect(days()[6]).toEqual({ type: 'Rest', exercises: [] });
    expect(validRoutineDays(emptyRoutineDays())).toBe(false);
    const blank = days(); blank[1] = { type: 'Exercises', exercises: [{ id: 'bad', name: ' ', target: '', notes: '' }] };
    expect(validRoutineDays(blank)).toBe(false);
    expect(validRoutineDays(days().slice(0, 6))).toBe(false);
    blank[1] = { type: 'Rest', exercises: [] };
    expect(validRoutineDays(blank)).toBe(true);
  });
  it('reserves room for removal Undo without allowing a day to exceed native capacity', () => {
    expect(canAddRoutineExercise(100)).toBe(false);
    expect(canAddRoutineExercise(99, true)).toBe(false);
    expect(canAddRoutineExercise(98, true)).toBe(true);
    // Finish the scoped day edit to accept its removal, then reopen with capacity for a replacement.
    expect(canAddRoutineExercise(99)).toBe(true);
    const full = days();
    full[0].exercises = Array.from({ length: 100 }, (_, index) => ({ id: `exercise-${index}`, name: `Exercise ${index}`, target: '', notes: '' }));
    expect(validRoutineDays(full)).toBe(true);
    full[0].exercises.push({ id: 'overflow', name: 'Extra exercise', target: '', notes: '' });
    expect(validRoutineDays(full)).toBe(false);
  });
  it('starts an independent copy today without altering the source plan or exercise identities', () => {
    const source = plan(), draft = editorDraft({ title: source.title });
    const now = new Date(2026, 9, 19, 12).getTime();
    expect(weeklyEditorDraft(draft, source).startsOn).toBe('2026-10-01');
    const copy = weeklyEditorDraft(draft, source, true, now);
    expect(copy.startsOn).toBe(civilAt(now).slice(0, 10));
    expect(copy.days[0].exercises.map(step => step.id)).toEqual(['bird', 'plank']);
    expect(source.startsOn).toBe('2026-10-01');
  });
  it('keeps exercises available across unsaved rest-day toggles while sending only an empty rest definition to native', () => {
    const draft = editorDraft({ title: 'Weekly workouts' }), original = days();
    const weekly = { startsOn: '2026-10-19', days: original.map((day, index): RoutineDay => index === 0 ? { ...day, type: 'Rest' } : day) };
    const before = JSON.stringify(weekly), payload = routinePayload(draft, weekly);
    expect(payload.days[0]).toEqual({ type: 'Rest', exercises: [] });
    expect(JSON.stringify(weekly)).toBe(before);
    expect(weekly.days[0].exercises.map(step => step.id)).toEqual(['bird', 'plank']);
    expect(validRoutineDays(weekly.days)).toBe(false); // Cached steps do not make a rest day active.
    const reopened = { ...weekly, days: weekly.days.map((day, index): RoutineDay => index === 0 ? { ...day, type: 'Exercises' } : day) };
    expect(validRoutineDays(reopened.days)).toBe(true);
    expect(routinePayload(draft, reopened).days[0].exercises).toEqual(original[0].exercises);
    expect(payload.days[0].exercises).toEqual([]);
    expect(JSON.stringify(weekly)).toBe(before);
  });
  it('reviews only changed days while preserving step IDs through rename and reorder', () => {
    const before = days(), after = days();
    after[0] = { type: 'Exercises', exercises: [{ ...after[0].exercises[1], name: 'Forearm plank' }, after[0].exercises[0]] };
    expect(changedRoutineDays(before, after)).toEqual([0]);
    expect(after[0].exercises.map(step => step.id)).toEqual(['plank', 'bird']);
    expect(before[0].exercises[1].name).toBe('Front plank');
  });
  it('allows choosing a type only for a fresh unsaved draft, keeping saved and duplicate types immutable', () => {
    expect(canChangeReminderType(true, false, false, false)).toBe(true);
    expect(canChangeReminderType(false, false, false, false)).toBe(false);
    expect(canChangeReminderType(true, true, false, false)).toBe(false);
    expect(canChangeReminderType(true, false, true, false)).toBe(false);
    expect(canChangeReminderType(true, false, false, true)).toBe(false);
  });
  it('retains shared edits and inactive recurrence/day definitions through both type switches', async () => {
    const convert = async (input: TimeConversionInput) => ({ zoneId: input.zoneId, instantMs: input.instantMs ?? Date.parse(input.local + 'Z'),
      local: input.local ?? new Date(input.instantMs!).toISOString().slice(0, 19), offsetSeconds: 0, adjustment: 'none' as const });
    for (const mode of ['Alarm', 'Notification', 'None'] as const) {
      const ordinary = { draft: editorDraft({ title: 'Original', notes: 'Original notes', mode, listId: 'old', zoneId: 'UTC', eventStartMs: Date.UTC(2026, 9, 19, 8), alarmAtMs: Date.UTC(2026, 9, 19, 8) }),
        recurrence: { frequency: 'monthlyDay' as const, interval: 2, zoneMode: 'pinned' as const, day: 19 } };
      const weekly = { startsOn: '2026-10-19', days: days() };
      const entered = await switchReminderDraftType(ordinary.draft, 'Routine', convert);
      const edited = changeRoutineClock({ ...entered.draft, title: 'My updated title', notes: 'My updated notes', listId: 'new' }, Date.UTC(2026, 9, 19, 9));
      const returned = await switchReminderDraftType(edited, 'Reminder', convert);
      expect(returned.draft).toMatchObject({ title: 'My updated title', notes: 'My updated notes', listId: 'new', mode, alarmAtMs: Date.UTC(2026, 9, 19, 9) });
      if (mode === 'None') expect(returned.draft.eventStartMs).toBe(Date.UTC(2026, 9, 19, 9));
      const reentered = await switchReminderDraftType(returned.draft, 'Routine', convert);
      expect(reentered.draft).toMatchObject({ title: 'My updated title', notes: 'My updated notes', mode, alarmAtMs: Date.UTC(2026, 9, 19, 9) });
      expect(ordinary.recurrence).toEqual({ frequency: 'monthlyDay', interval: 2, zoneMode: 'pinned', day: 19 });
      expect(weekly.days[0].exercises.map(step => step.id)).toEqual(['bird', 'plank']);
      expect(ordinary.draft.title).toBe('Original');
    }
  });
});
