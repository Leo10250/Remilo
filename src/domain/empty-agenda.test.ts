import { describe, expect, it } from 'vitest';
import { canCreateFromEmptyAgenda } from './empty-agenda';
const empty = { native: true, scoped: false, view: 'agenda', searching: false, optionalFilters: 0, items: 0, total: 0, success: true, fetching: false, error: false, placeholder: false };
describe('genuine empty Agenda creation', () => {
  it('offers creation only for a successful unconstrained native result', () => {
    expect(canCreateFromEmptyAgenda(empty)).toBe(true);
    for (const patch of [{ native: false }, { scoped: true }, { view: 'today' }, { view: 'upcoming' }, { searching: true }, { optionalFilters: 1 },
      { items: 1 }, { total: 1 }, { total: undefined }, { success: false }, { fetching: true }, { error: true }, { placeholder: true }])
      expect(canCreateFromEmptyAgenda({ ...empty, ...patch })).toBe(false);
  });
  it('does not mistake collapsed or partially loaded content for an empty dataset', () => {
    expect(canCreateFromEmptyAgenda({ ...empty, total: 50 })).toBe(false);
    expect(canCreateFromEmptyAgenda({ ...empty, items: 3, total: 50 })).toBe(false);
  });
});
