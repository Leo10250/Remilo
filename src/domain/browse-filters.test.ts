import { describe, expect, it } from 'vitest';
import { browseFilterChips, browseReminderFilter, commitBrowseFilters, removeBrowseFilter, resetBrowseFilters } from './browse-filters';

describe('contextual browse filters', () => {
  it('keeps a draft separate until one complete commit, and cancellation retains the original query', () => {
    const applied = resetBrowseFilters('agenda');
    const draft = { ...applied, listId: 'work', overdueOnly: true, deliveryIssuesOnly: true };
    expect(browseReminderFilter('agenda', applied, { view: 'today', search: 'bill' })).toEqual({ view: 'today', search: 'bill', overdueOnly: false, deliveryIssuesOnly: false });
    const committed = commitBrowseFilters('agenda', applied, draft)!;
    expect(browseReminderFilter('agenda', committed, { view: 'today', search: 'bill' })).toEqual({ view: 'today', search: 'bill', listId: 'work', overdueOnly: true, deliveryIssuesOnly: true });
    expect(applied).toEqual(resetBrowseFilters('agenda'));
    expect(commitBrowseFilters('agenda', applied, applied)).toBe(applied);
  });
  it('rejects filter edits during selection and pending or uncertain operations', () => {
    const applied = { ...resetBrowseFilters('completed'), includeSkipped: true };
    const draft = resetBrowseFilters('completed');
    for (const guard of [{ selecting: true }, { guarded: true }, { selecting: true, guarded: true }])
      expect(commitBrowseFilters('completed', applied, draft, guard)).toBeNull();
    expect(applied.includeSkipped).toBe(true);
  });
  it('distinguishes all lists, No list and a named list whose ID is none', () => {
    const context = { view: 'deleted' as const, search: '' };
    const all = resetBrowseFilters('deleted');
    expect(browseReminderFilter('deleted', all, context)).not.toHaveProperty('listId');
    expect(browseReminderFilter('deleted', { ...all, listId: null }, context).listId).toBeNull();
    expect(browseReminderFilter('deleted', { ...all, listId: 'none' }, context).listId).toBe('none');
  });
  it('never broadens fixed membership through drafts, chip removal or full reset', () => {
    for (const fixedListId of ['work', null]) {
      const applied = { ...resetBrowseFilters('completed', fixedListId), includeSkipped: true };
      const committed = commitBrowseFilters('completed', applied, removeBrowseFilter(applied, 'listId'), { fixedListId })!;
      expect(committed.listId).toBe(fixedListId);
      expect(browseFilterChips('completed', committed, [], fixedListId)).toEqual([{ field: 'includeSkipped', label: 'Skipped included' }]);
      const reset = resetBrowseFilters('completed', fixedListId);
      expect(browseReminderFilter('completed', reset, { view: 'completed', search: 'bill', fixedListId })).toEqual({ view: 'completed', search: 'bill', listId: fixedListId, includeSkipped: false });
    }
  });
  it('removes one chip without changing other filters; full reset includes skipped but preserves query context', () => {
    const applied = { ...resetBrowseFilters('completed'), listId: null, includeSkipped: true };
    expect(removeBrowseFilter(applied, 'listId')).toEqual({ ...applied, listId: undefined });
    expect(removeBrowseFilter(applied, 'includeSkipped')).toEqual({ ...applied, includeSkipped: false });
    expect(browseFilterChips('completed', applied)).toHaveLength(2);
    expect(browseReminderFilter('completed', resetBrowseFilters('completed'), { view: 'completed', search: 'bill' })).toEqual({ view: 'completed', search: 'bill', includeSkipped: false });
  });
  it('omits irrelevant filter fields without changing the native query meaning', () => {
    const mixed = { listId: 'work', overdueOnly: true, deliveryIssuesOnly: true, includeSkipped: true };
    expect(browseReminderFilter('deleted', mixed, { view: 'deleted', search: '' })).toEqual({ view: 'deleted', search: '', listId: 'work' });
    expect(browseFilterChips('agenda', mixed, [{ id: 'work', name: 'Work', revision: 1, overdueCount: 0 }])).toEqual([
      { field: 'listId', label: 'List: Work' }, { field: 'overdueOnly', label: 'Overdue' }, { field: 'deliveryIssuesOnly', label: 'Alert problems' },
    ]);
  });
});
