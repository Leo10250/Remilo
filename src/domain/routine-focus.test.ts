import { describe, expect, it } from 'vitest';
import type { RoutineExercise } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { nextRoutineFocus, routineDayEnded, routineFocusStep, routineProgressModel } from './routine-focus';

const step = (id: string, completed = false): RoutineExercise & { completed: boolean } => ({ id, name: id, target: '', notes: '', completed });

describe('dated routine Focus navigation', () => {
  it('uses the confirmed next unfinished exercise and permits inspection without changing checks', () => {
    const session = { steps: [step('bird', true), step('plank'), step('side')] };
    expect(routineFocusStep(session)?.id).toBe('plank');
    expect(routineFocusStep(session, 'bird')?.completed).toBe(true);
    expect(session.steps[0].completed).toBe(true);
    expect(nextRoutineFocus({ steps: [step('bird', true), step('plank', true), step('side')] }, 'plank')).toBe('side');
  });
  it('returns to an earlier unfinished exercise and gives final completion a summary', () => {
    expect(nextRoutineFocus({ steps: [step('bird'), step('plank', true), step('side', true)] }, 'side')).toBe('bird');
    const finished = { steps: [step('bird', true), step('plank', true)] };
    expect(nextRoutineFocus(finished, 'plank')).toBeUndefined();
    expect(routineFocusStep(finished)).toBeUndefined();
    expect(routineFocusStep(finished, 'bird')?.id).toBe('bird');
  });
  it('keeps native closure irreversible and closes the active view at its boundary', () => {
    expect(routineDayEnded({ ended: false, endsAtMs: 1000 }, 999)).toBe(false);
    expect(routineDayEnded({ ended: false, endsAtMs: 1000 }, 1000)).toBe(true);
    expect(routineDayEnded({ ended: true, endsAtMs: 1000 }, 1)).toBe(true);
  });
});

describe('exercise-count progress', () => {
  it('shows one segment per exercise through twelve, then an accurate continuous ratio', () => {
    expect(routineProgressModel(1, 4).segments).toEqual([true, false, false, false]);
    expect(routineProgressModel(12, 12).segments).toHaveLength(12);
    expect(routineProgressModel(4, 13)).toEqual({ done: 4, total: 13, ratio: 4 / 13, segments: null });
  });
  it('does not invent completion for rest or unavailable content', () => {
    expect(routineProgressModel(0, 0)).toEqual({ done: 0, total: 0, ratio: 0, segments: null });
    expect(routineProgressModel(5, 4).done).toBe(4);
    expect(routineProgressModel(-1, 4).done).toBe(0);
    expect(routineProgressModel(Number.NaN, Number.NaN).total).toBe(0);
  });
});
