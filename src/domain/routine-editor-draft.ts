import type { RoutineDay, RoutineDraft, RoutinePlan, TimeConversion, TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { moveDraftEvent, type EditorDraft } from './editor-draft';
import { civilAt } from './time';
import { validExercise } from './exercise-target';

export type ReminderType = 'Reminder' | 'Routine';
export type WeeklyEditorDraft = { startsOn: string; days: RoutineDay[] };
export const MAX_ROUTINE_EXERCISES_PER_DAY = 100;
/** Keep the most recent removal reversible even while other edits are pending. */
export const canAddRoutineExercise = (count: number, hasPendingRemoval = false) => count + (hasPendingRemoval ? 1 : 0) < MAX_ROUTINE_EXERCISES_PER_DAY;
export const emptyRoutineDays = (): RoutineDay[] => Array.from({ length: 7 }, () => ({ type: 'Rest', exercises: [] }));
export const validRoutineDays = (days: RoutineDay[]) => days.length === 7 && days.some(day => day.type === 'Exercises') &&
  days.every(day => day.type === 'Rest' ? day.exercises.length === 0 : day.exercises.length > 0 && day.exercises.length <= MAX_ROUTINE_EXERCISES_PER_DAY && day.exercises.every(validExercise));

/** Common content stays in the parent editor; only weekly definitions live here. */
export function weeklyEditorDraft(draft: EditorDraft, plan?: RoutinePlan, duplicate = false, now = Date.now()): WeeklyEditorDraft {
  return { startsOn: plan && !duplicate ? plan.startsOn : civilAt(plan ? now : draft.alarmAtMs).slice(0, 10), days: plan?.days ?? emptyRoutineDays() };
}

export function routinePayload(draft: EditorDraft, weekly: WeeklyEditorDraft): RoutineDraft {
  const local = civilAt(draft.alarmAtMs, draft.zoneId);
  return { title: draft.title, notes: draft.notes ?? '', mode: draft.mode ?? 'Alarm', listId: draft.listId ?? null,
    minutes: Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)), sound: draft.sound ?? 'remilo', vibration: draft.vibration ?? false,
    // Rest toggles retain unsaved exercise drafts; only the native payload omits them.
    days: weekly.days.map(day => day.type === 'Rest' ? { type: 'Rest', exercises: [] } : day) };
}

/** A routine clock is shared when changing type; ordinary end/due/repeat settings are retained. */
export function changeRoutineClock(draft: EditorDraft, value: number): EditorDraft {
  return { ...draft, alarmAtMs: value };
}

export function changedRoutineDays(before: RoutineDay[], after: RoutineDay[]): number[] {
  return after.flatMap((day, index) => JSON.stringify(day) === JSON.stringify(before[index]) ? [] : [index]);
}

/** Saved owners and independent duplicates keep their type; this is not conversion. */
export function canChangeReminderType(creation: boolean, duplicate: boolean, hasPlan: boolean, hasSeries: boolean): boolean {
  return creation && !duplicate && !hasPlan && !hasSeries;
}

/** Switches presentation, preserving cached weekly/repeat values and common authored content. */
export async function switchReminderDraftType(draft: EditorDraft, type: ReminderType, convert: (input: TimeConversionInput) => Promise<TimeConversion>) {
  if (draft.mode !== 'None') return { draft, warnings: [] as string[] };
  if (type === 'Routine') return { draft: { ...draft, alarmAtMs: draft.eventStartMs }, warnings: [] as string[] };
  const moved = await moveDraftEvent(draft, draft.alarmAtMs, convert);
  return { ...moved, draft: { ...moved.draft, alarmAtMs: draft.alarmAtMs } };
}
