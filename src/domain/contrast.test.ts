import { expect, it } from 'vitest';
import { palettes } from '../ui/colors';
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
it.each(['light', 'dark'] as const)('%s body, supporting, status and action text meet 4.5:1', (mode) => {
  const palette = palettes[mode];
  for (const background of ['background', 'surface', 'soft'] as const) {
    for (const text of ['ink', 'muted', 'accent', 'danger', 'warning', 'success'] as const) {
      expect(contrast(palette[text], palette[background]), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast(palette.accentInk, palette.accent)).toBeGreaterThanOrEqual(4.5);
});
