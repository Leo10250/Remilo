/** Review-only values. This module is never imported by a normal application entry. */
import contract from '../../assets/design-review/p01/composition.json';
import type { Colors } from './colors';
import { reviewPalette } from './review-appearance';

export function p01Colors(dark: boolean, invalid = false): Colors {
  const values = contract.colors.sunrise[dark ? 'dark' : 'light'];
  if (invalid || Object.values(values).some((color) => !/^#[\da-f]{6}$/i.test(color))) return reviewPalette('classic', dark ? 'dark' : 'light');
  return { ...values, dark };
}

export function p01LandscapeBounds(width: number, height: number, scale: number) {
  const regionHeight = Math.min(height * (scale >= 1.5 ? 0.32 : 0.5), width * 1.2);
  const imageHeight = width / 1.5;
  // Keep S1's sun above navigation in the existing action clearance. Width-fit
  // preserves its proportions; clipping the lower foreground adds no list band.
  const bottom = 34 - imageHeight * (1 - 0.64);
  return { width, height: regionHeight, imageHeight, left: 0, bottom };
}
