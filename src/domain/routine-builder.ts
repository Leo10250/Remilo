import type { RoutineDay, RoutineExercise, RoutinePlan, RoutineAuthoringMode, RoutinePreset } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { emptyRoutineDays } from './routine-editor-draft';

export type RoutineBuilder = { days: RoutineDay[]; sharedSteps: RoutineExercise[]; authoringMode: RoutineAuthoringMode; presentationPreset: RoutinePreset };
type Allocate = () => string;
const independent = ({ sharedStepId: _link, ...step }: RoutineExercise): RoutineExercise => step;

/** A source must be schedulable before conversion can preserve authored content. */
export function canChangeRoutineArrangement(draft: RoutineBuilder): boolean {
  const active = draft.days.filter(day => day.type === 'Exercises');
  return draft.authoringMode === 'Shared' ? !draft.sharedSteps.length || !!active.length
    : active.some(day => day.exercises.length) || !draft.days.some(day => day.exercises.length);
}

export function routineBuilder(plan?: RoutinePlan, allocate?: Allocate): RoutineBuilder {
  const links = new Map<string, string>();
  const days = (plan?.days ?? emptyRoutineDays()).map(day => ({ ...day, exercises: day.exercises.map(step => ({ ...step,
    ...(allocate ? { id: allocate(), ...(step.sharedStepId ? { sharedStepId: links.get(step.sharedStepId) ?? links.set(step.sharedStepId, allocate()).get(step.sharedStepId) } : {}) } : {}),
  })) }));
  const authoringMode = plan?.authoringMode ?? (plan ? 'ByWeekday' : 'Shared');
  return { days, authoringMode, presentationPreset: plan?.presentationPreset ?? (plan ? 'Exercise' : 'General'),
    sharedSteps: authoringMode === 'Shared' ? (days.find(day => day.type === 'Exercises')?.exercises ?? []).map(step => ({ ...step, id: step.sharedStepId! })) : [] };
}

/** Reconcile by explicit shared identity; names and positions are never identities. */
export function replaceSharedSteps(draft: RoutineBuilder, steps: RoutineExercise[], allocate: Allocate): RoutineBuilder {
  const sharedSteps = steps.map(step => ({ ...step, sharedStepId: step.id }));
  return { ...draft, sharedSteps, days: draft.days.map(day => day.type === 'Rest' && !day.exercises.length ? day : ({ ...day, exercises: sharedSteps.map(step => ({ ...step,
    id: day.exercises.find(existing => existing.sharedStepId === step.sharedStepId)?.id ?? allocate(),
  })) })) };
}

export function selectRoutineDays(draft: RoutineBuilder, selected: number[], allocate: Allocate): RoutineBuilder {
  const next = { ...draft, days: draft.days.map((day, index) => ({ ...day, type: selected.includes(index) ? 'Exercises' as const : 'Rest' as const })) };
  return next.authoringMode === 'Shared' ? replaceSharedSteps(next, next.sharedSteps, allocate) : next;
}

export function separateRoutineDays(draft: RoutineBuilder): RoutineBuilder {
  return { ...draft, authoringMode: 'ByWeekday', days: draft.days.map(day => ({ ...day, exercises: day.exercises.map(independent) })) };
}

export function shareRoutineStepsFrom(draft: RoutineBuilder, source: number | null, allocate: Allocate): RoutineBuilder {
  const steps = source === null ? [] : draft.days[source].exercises;
  const sharedSteps = steps.map(step => ({ ...step, id: allocate(), sharedStepId: undefined }));
  const base = { ...draft, authoringMode: 'Shared' as const, days: draft.days.map((day, index) => ({ ...day, exercises: index === source
    ? steps.map((step, i) => ({ ...step, sharedStepId: sharedSteps[i].id })) : [] })) };
  return replaceSharedSteps(base, sharedSteps, allocate);
}

export function copyRoutineDay(draft: RoutineBuilder, source: number, target: number, allocate: Allocate): RoutineBuilder {
  return { ...draft, days: draft.days.map((day, index) => index === target ? { ...day,
    exercises: draft.days[source].exercises.map(step => ({ ...independent(step), id: allocate() })) } : day) };
}

export function routineBuilderPayload(draft: RoutineBuilder) {
  return { authoringMode: draft.authoringMode, presentationPreset: draft.presentationPreset,
    days: draft.days.map(day => day.type === 'Rest' ? { type: 'Rest' as const, exercises: [] } : day) };
}
