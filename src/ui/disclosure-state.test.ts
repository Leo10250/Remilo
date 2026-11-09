import { expect, it } from 'vitest';
import { disclosureAutoOpen } from './disclosure-state';

it('opens on new blocking and preserves a manual collapse across refreshes', () => {
  const allowed = { autoOpen: false, open: false };
  const blocked = disclosureAutoOpen(allowed, true);
  expect(blocked.open).toBe(true);
  const collapsed = { ...blocked, open: false };
  expect(disclosureAutoOpen(collapsed, true)).toBe(collapsed);
  const restored = disclosureAutoOpen(collapsed, false);
  expect(restored.open).toBe(false);
  expect(disclosureAutoOpen(restored, true).open).toBe(true);
});
