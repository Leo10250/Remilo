import { describe, expect, it } from 'vitest';
import { routineSessionQueryKey, RoutineSessionViewDates } from './routine-session-view';

describe('mounted routine session dates', () => {
  it('keeps an opened Monday separate from another view opening Tuesday after rollover', () => {
    const monday = new RoutineSessionViewDates(), tuesday = new RoutineSessionViewDates();
    expect(routineSessionQueryKey(monday.request('weekly'), 'monday-view')).not.toEqual(routineSessionQueryKey(tuesday.request('weekly'), 'tuesday-view'));
    expect(monday.resolve(monday.request('weekly'), '2026-10-19')).toBe(true);
    expect(tuesday.resolve(tuesday.request('weekly'), '2026-10-20')).toBe(true);
    expect(monday.request('weekly').date).toBe('2026-10-19');
    expect(tuesday.request('weekly').date).toBe('2026-10-20');
    expect(routineSessionQueryKey(monday.request('weekly'), 'monday-view')).not.toEqual(routineSessionQueryKey(tuesday.request('weekly'), 'tuesday-view'));
    // Both views now use different dated cache keys; an explicit history view deduplicates with its day.
    expect(monday.request('weekly', '2026-10-19').date).toBe(monday.request('weekly').date);
    expect(routineSessionQueryKey(monday.request('weekly'), 'monday-view')).toEqual(routineSessionQueryKey(tuesday.request('weekly', '2026-10-19'), 'history-view'));
    expect(tuesday.request('weekly', '2026-10-19').date).toBe('2026-10-19');
    expect(tuesday.request('weekly').date).toBe('2026-10-20');
  });

  it('resolves today afresh only on request, rejecting old and out-of-order lookups', () => {
    const view = new RoutineSessionViewDates(), stale = view.request('weekly');
    view.openToday('weekly');
    expect(routineSessionQueryKey(stale, 'same-view')).not.toEqual(routineSessionQueryKey(view.request('weekly'), 'same-view'));
    expect(view.request('weekly').date).toBeNull();
    expect(view.resolve(stale, '2026-10-19')).toBe(false);
    const fresh = view.request('weekly');
    expect(view.resolve(fresh, '2026-10-20')).toBe(true);
    expect(view.resolve(fresh, '2026-10-21')).toBe(false);
    expect(view.request('weekly').date).toBe('2026-10-20');
    view.openToday('weekly');
    expect(view.resolve(view.request('weekly'), '2026-10-21')).toBe(true);
    expect(view.request('weekly').date).toBe('2026-10-21');
  });

  it('keeps distinct routines and explicit history dates independent', () => {
    const view = new RoutineSessionViewDates();
    expect(view.resolve(view.request('weekly', '2026-10-18'), '2026-10-18')).toBe(false);
    expect(view.request('weekly').date).toBeNull();
    view.resolve(view.request('weekly'), '2026-10-19');
    expect(view.request('other').date).toBeNull();
    view.resolve(view.request('other'), '2026-10-20');
    view.openToday('other');
    expect(view.request('weekly').date).toBe('2026-10-19');
    expect(view.request('other').date).toBeNull();
  });
});
