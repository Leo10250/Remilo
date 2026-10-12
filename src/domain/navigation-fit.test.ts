import { describe, expect, it } from 'vitest';
import { rootLabelsFit } from './navigation-fit';
describe('root label fit', () => {
  it('keeps all destinations visible only with readable clearance', () => {
    expect(rootLabelsFit(360, [45, 30, 60, 35])).toBe(true);
    expect(rootLabelsFit(360, [90, 60, 130, 70])).toBe(false);
    expect(rootLabelsFit(720, [90, 60, 130, 70])).toBe(true);
    expect(rootLabelsFit(360, [66, 66, 66, 66])).toBe(true);
    expect(rootLabelsFit(360, [66.1, 66, 66, 66])).toBe(false);
  });
  it('does not resolve from incomplete or unusable measurements', () => {
    expect(rootLabelsFit(360, [30, 40, 50])).toBe(false);
    expect(rootLabelsFit(360, [30, 40, NaN, 50])).toBe(false);
    expect(rootLabelsFit(100, [45, 30, 60, 35])).toBe(false);
  });
});
