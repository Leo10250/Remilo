import { expect, it } from 'vitest';
import { AppearanceTransitions, nextAppearanceBoundary, normalizeAtmosphere, resolveAtmosphere } from './appearance';
import parity from '../../verification/fixtures/appearance-boundaries.json';
it.each(parity.cases)('$label resolves $expected', ({ instant, zone, selection, expected }) => {
  // Reproduce the fixture's device-local wall time without depending on the test host's zone.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(instant));
  const value = (kind: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === kind)?.value);
  expect(resolveAtmosphere(selection, new Date(2000, 0, 2, value('hour'), value('minute'), value('second')))).toBe(expected);
});
it('preserves manual scenes and resolves unknown values safely',()=>{
  expect(resolveAtmosphere('sky',new Date(2026,9,9,23))).toBe('sky');
  expect(normalizeAtmosphere('retired')).toBe('automatic');
  expect(resolveAtmosphere(undefined,new Date(2026,9,9,7))).toBe('sunrise');
});
it('coalesces nested workflow holds and explicit changes without resetting state',()=>{
  const state=new AppearanceTransitions('sunrise'), first=state.hold(), second=state.hold();
  expect(state.update('sky')).toBe('sunrise'); expect(state.update('evening')).toBe('sunrise');
  expect(state.release(first)).toBe('sunrise'); expect(state.release(second)).toBe('evening');
  const third=state.hold(); expect(state.update('night',true)).toBe('night'); state.release(third);
});
it('plans only the next local boundary, including midnight crossing',()=>{
  expect(nextAppearanceBoundary(new Date(2026,9,9,9,59,59))).toBe(1000);
  expect(nextAppearanceBoundary(new Date(2026,9,9,10))).toBe(7*3600000);
  expect(nextAppearanceBoundary(new Date(2026,9,9,23))).toBe(7*3600000);
});
