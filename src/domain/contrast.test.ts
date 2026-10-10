import { expect, it } from 'vitest';
import { atmosphereColors } from '../ui/colors';
import { presentation } from '../ui/atmosphere.generated';
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
it.each(['sunrise', 'sky', 'evening', 'night'] as const)('%s body, supporting, status and actions meet 4.5:1 in both brightness modes', (scene) => {
 for (const mode of ['light','dark'] as const) {
  const palette = atmosphereColors(scene,mode);
  for (const background of ['background', 'surface', 'soft'] as const) {
    for (const text of ['ink', 'muted', 'accent', 'danger', 'warning', 'success'] as const) {
      expect(contrast(palette[text], palette[background]), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contrast(palette.accentInk, palette.accent)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.dangerInk, palette.dangerSurface), 'destructive button label/icon').toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.dangerInk, palette.dangerPressed), 'pressed destructive button label/icon').toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.disabledInk,palette.disabledSurface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.inverseInk,palette.inverseSurface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.inverseAction,palette.inverseSurface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(palette.outline,palette.surface)).toBeGreaterThanOrEqual(3);
 }
});
it('transparent header scrims retain 4.5:1 text over the full RGB range', () => {
  for (const [pair, header] of Object.entries(presentation.header)) {
    const scrim = header.scrim.slice(1).match(/../g)!.map(part => parseInt(part,16));
    // With white scrim and dark ink the darkest possible pixel is the limiting
    // case; with black scrim and white ink the lightest pixel is limiting.
    // Intermediate RGB channels lie between these monotone luminance bounds.
    for (const endpoint of [0,255]) {
      const blended='#'+scrim.map(channel=>Math.round(channel*header.scrimAlpha+endpoint*(1-header.scrimAlpha)).toString(16).padStart(2,'0')).join('');
      expect(contrast(header.ink,blended),pair+' header on '+endpoint).toBeGreaterThanOrEqual(4.5);
    }
  }
});
