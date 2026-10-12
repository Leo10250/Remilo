import { expect, it } from 'vitest';
import { headerBlendBounds, headerScrimGeometry, headerSurfaceOpacity } from '../ui/header-transition';

it('begins only in the final decorative span and reaches an opaque pinned toolbar', () => {
  expect(headerBlendBounds(144)).toEqual({ start: 80, end: 144 });
  for (const y of [-48, 0, 79, 80]) expect(headerSurfaceOpacity(y, 144)).toBe(0.66);
  expect(headerSurfaceOpacity(112, 144)).toBeCloseTo(0.83);
  for (const y of [144, 145, 1000]) expect(headerSurfaceOpacity(y, 144)).toBe(1);
});

it('remains continuous at both blend boundaries', () => {
  for (const edge of [80, 144]) {
    expect(Math.abs(headerSurfaceOpacity(edge + 0.01, 144) - headerSurfaceOpacity(edge - 0.01, 144))).toBeLessThan(0.00001);
  }
});

it('has bounded monotone opacity with exactly reversible intermediate states', () => {
  const offsets = Array.from({ length: 201 }, (_, i) => i);
  const forward = offsets.map(y => headerSurfaceOpacity(y, 144));
  const reverse = offsets.toReversed().map(y => headerSurfaceOpacity(y, 144)).toReversed();
  expect(reverse).toEqual(forward);
  for (let i = 1; i < forward.length; i++) {
    expect(forward[i]).toBeGreaterThanOrEqual(forward[i - 1]);
    expect(forward[i]).toBeLessThanOrEqual(1);
  }
});

it('uses all available decoration when it is shorter than the nominal blend', () => {
  expect(headerBlendBounds(40)).toEqual({ start: 0, end: 40 });
  expect(headerSurfaceOpacity(0, 40)).toBe(0.66);
  expect(headerSurfaceOpacity(20, 40)).toBeCloseTo(0.83);
  expect(headerSurfaceOpacity(40, 40)).toBe(1);
});

it('keeps compact chrome opaque even at a restored or overscrolled position', () => {
  expect(headerBlendBounds(0)).toBeNull();
  for (const y of [-50, 0, 112, 300]) expect(headerSurfaceOpacity(y, 0)).toBe(1);
});

it('protects measured title/action and wrapped subtitle bounds before feathering', () => {
  expect(headerScrimGeometry(200, 56, 0)).toEqual({ height: 96, plateauEnd: 56 / 96 });
  expect(headerScrimGeometry(200, 56, 64)).toEqual({ height: 160, plateauEnd: 120 / 160 });
  expect(headerScrimGeometry(200, 56, null)).toEqual({ height: 200, plateauEnd: 1 });
  expect(headerScrimGeometry(200, 104, 80)).toEqual({ height: 200, plateauEnd: 184 / 200 });
});
