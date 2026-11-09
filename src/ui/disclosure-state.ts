export function disclosureAutoOpen(state: { autoOpen: boolean; open: boolean }, autoOpen: boolean) {
  if (state.autoOpen === autoOpen) return state;
  return { autoOpen, open: autoOpen || state.open };
}
