import { presentation } from './atmosphere.generated';
import type { Atmosphere, Brightness } from '../domain/appearance';
export type Colors = {
  dark: boolean; background: string; surface: string; ink: string; muted: string;
  accent: string; accentInk: string; soft: string; border: string;
  danger: string; dangerInk: string; dangerPressed: string; warning: string; success: string;
};
export function atmosphereColors(scene: Atmosphere, brightness: Brightness) {
  const pair = presentation.pairs[`${scene}-${brightness}`], semantic = presentation.semantic[brightness];
  const roles = { ...pair, ...semantic };
  const alias = presentation.roleAliases;
  return {
    dark: brightness === 'dark', background: pair.canvas, surface: pair.surface, ink: pair.onSurface,
    muted: pair.onSurfaceVariant, accent: pair.primary, accentInk: pair.onPrimary, soft: pair.container,
    border: pair.outline, danger: semantic.error, warning: semantic.warning, success: semantic.success,
    outline: pair.outline, focus: roles[alias.focus], primaryPressed: roles[alias.primaryPressed], onPrimaryPressed: roles[alias.onPrimaryPressed],
    secondaryPressed: roles[alias.secondaryPressed], onSecondaryPressed: roles[alias.onSecondaryPressed],
    disabledSurface: semantic.disabledSurface, disabledInk: semantic.disabledInk,
    selectedSurface: roles[alias.selectedSurface], selectedInk: roles[alias.selectedInk],
    inverseSurface: semantic.inverseSurface, inverseInk: semantic.inverseInk, inverseAction: semantic.inverseAction,
    dangerSurface: roles[alias.dangerSurface], dangerInk: roles[alias.dangerInk], dangerPressed: roles[alias.dangerPressed],
  };
}
export const palettes = { light: atmosphereColors('sky', 'light'), dark: atmosphereColors('sky', 'dark') };
