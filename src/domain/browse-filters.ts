import type { ListRecord, ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type BrowseKind = 'agenda' | 'completed' | 'deleted';
export type BrowseFilters = Readonly<{
  listId: string | null | undefined;
  overdueOnly: boolean;
  deliveryIssuesOnly: boolean;
  includeSkipped: boolean;
}>;
export type BrowseFilterField = keyof BrowseFilters;
export type BrowseFilterChip = { field: BrowseFilterField; label: string };

/** Only applied foreground preferences reach a native query; a sheet draft stays local. */
export function normalizeBrowseFilters(kind: BrowseKind, filters: BrowseFilters, fixedListId?: string | null): BrowseFilters {
  return {
    listId: fixedListId !== undefined ? fixedListId : filters.listId,
    overdueOnly: kind === 'agenda' && filters.overdueOnly,
    deliveryIssuesOnly: kind === 'agenda' && filters.deliveryIssuesOnly,
    includeSkipped: kind === 'completed' && filters.includeSkipped,
  };
}
export function resetBrowseFilters(kind: BrowseKind, fixedListId?: string | null): BrowseFilters {
  return normalizeBrowseFilters(kind, { listId: undefined, overdueOnly: false, deliveryIssuesOnly: false, includeSkipped: false }, fixedListId);
}
export function sameBrowseFilters(left: BrowseFilters, right: BrowseFilters) {
  return left.listId === right.listId && left.overdueOnly === right.overdueOnly &&
    left.deliveryIssuesOnly === right.deliveryIssuesOnly && left.includeSkipped === right.includeSkipped;
}
/** Null rejects an edit while selection or a captured operation owns the displayed dataset. */
export function commitBrowseFilters(kind: BrowseKind, current: BrowseFilters, draft: BrowseFilters,
  options: { fixedListId?: string | null; guarded?: boolean; selecting?: boolean } = {}): BrowseFilters | null {
  if (options.guarded || options.selecting) return null;
  const next = normalizeBrowseFilters(kind, draft, options.fixedListId);
  return sameBrowseFilters(current, next) ? current : next;
}
export function removeBrowseFilter(filters: BrowseFilters, field: BrowseFilterField): BrowseFilters {
  return field === 'listId' ? { ...filters, listId: undefined } : { ...filters, [field]: false };
}
export function browseFilterChips(kind: BrowseKind, filters: BrowseFilters, lists: readonly ListRecord[] = [], fixedListId?: string | null): BrowseFilterChip[] {
  const current = normalizeBrowseFilters(kind, filters, fixedListId), chips: BrowseFilterChip[] = [];
  if (fixedListId === undefined && current.listId !== undefined) chips.push({ field: 'listId', label: current.listId === null ? 'No list' :
    'List: ' + (lists.find(list => list.id === current.listId)?.name ?? 'List unavailable') });
  if (current.overdueOnly) chips.push({ field: 'overdueOnly', label: 'Overdue' });
  if (current.deliveryIssuesOnly) chips.push({ field: 'deliveryIssuesOnly', label: 'Alert problems' });
  if (current.includeSkipped) chips.push({ field: 'includeSkipped', label: 'Skipped included' });
  return chips;
}
export function browseReminderFilter(kind: BrowseKind, filters: BrowseFilters,
  context: { view: ReminderFilter['view']; search: string; fixedListId?: string | null }): ReminderFilter {
  const current = normalizeBrowseFilters(kind, filters, context.fixedListId);
  return {
    view: context.view, search: context.search,
    ...(current.listId !== undefined ? { listId: current.listId } : {}),
    ...(kind === 'agenda' ? { overdueOnly: current.overdueOnly, deliveryIssuesOnly: current.deliveryIssuesOnly } : {}),
    ...(kind === 'completed' ? { includeSkipped: current.includeSkipped } : {}),
  };
}
