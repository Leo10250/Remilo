export function canCreateFromEmptyAgenda(state: {
  native: boolean; scoped: boolean; view: string; searching: boolean; optionalFilters: number;
  items: number; total?: number; success: boolean; fetching: boolean; error: boolean; placeholder: boolean;
}) {
  return state.native && !state.scoped && state.view === 'agenda' && !state.searching && state.optionalFilters === 0 &&
    state.success && !state.fetching && !state.error && !state.placeholder && state.items === 0 && state.total === 0;
}
