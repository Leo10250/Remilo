import { palettes, type Colors } from '../colors';
import { foundationCatalog } from './catalog.generated';

export type PaletteId = typeof foundationCatalog.paletteIds[number];
export type Brightness = 'light' | 'dark';
export type FoundationColors = Colors & Record<keyof typeof foundationCatalog.palettes[0]['colors']['light'], string>;
export type FoundationTokens = typeof foundationCatalog.tokens;
export interface ScenePlacement {
  readonly edge: 'top' | 'bottom'; readonly anchor: readonly number[]; readonly quietRegion: readonly number[];
  readonly heightFraction: number; readonly maxColumnDp: number; readonly layout: 'content-first';
}
export interface FoundationScene {
  readonly assetId: string; readonly browsing: ScenePlacement; readonly individual: ScenePlacement;
}
export interface Foundation {
  readonly id: PaletteId; readonly brightness: Brightness; readonly revision: string;
  readonly colors: FoundationColors; readonly tokens: FoundationTokens; readonly scene: FoundationScene | null;
  readonly fallback: 'none' | 'unknown-id' | 'invalid-tokens' | 'missing-art' | 'emergency';
}
const roles = Object.keys(foundationCatalog.palettes[0].colors.light);
function validColors(value: unknown): value is FoundationColors {
  return !!value && typeof value === 'object' && roles.every(role => /^#[0-9A-F]{6}$/.test((value as Record<string, string>)[role] ?? ''));
}
// Independent final baseline; no resolution attempt can mutate a requested choice.
function emergency(brightness: Brightness): Foundation {
  const c = palettes[brightness];
  return { id: 'classic', brightness, revision: 'P02-emergency-v1', tokens: foundationCatalog.tokens, scene: null, fallback: 'emergency',
    colors: { ...c, outline:c.muted,focus:c.accent,primaryPressed:c.accent,onPrimaryPressed:c.accentInk,
      secondaryPressed:c.soft,onSecondaryPressed:c.ink,disabledSurface:c.soft,disabledInk:c.muted,
      selectedSurface:c.soft,selectedInk:c.accent,inverseSurface:c.ink,inverseInk:c.surface,inverseAction:c.surface,
      dangerSurface:c.soft,dangerInk:c.danger } };
}
/** Already-resolved brightness only. No settings, storage, time or action dependencies. */
export function lookupFoundation(id: string | null | undefined, brightness: Brightness, source: unknown = foundationCatalog): Foundation {
  const catalog = source as typeof foundationCatalog | null;
  if (!catalog || !Array.isArray(catalog.palettes) || catalog.schemaVersion !== 1) return emergency(brightness);
  const requested = catalog.palettes.find(p => p.id === id);
  const classic = catalog.palettes.find(p => p.id === 'classic');
  const selected = requested && validColors(requested.colors?.[brightness]) ? requested : classic;
  if (!selected || !validColors(selected.colors?.[brightness])) return emergency(brightness);
  return { id:selected.id,brightness,revision:catalog.revision,tokens:foundationCatalog.tokens,
    colors:{...selected.colors[brightness],dark:brightness === 'dark'},scene:selected.scenes[brightness],
    fallback: requested ? selected === requested ? 'none' : 'invalid-tokens' : 'unknown-id' };
}
/** Call only after a requested decorative asset fails. An undecorated surface is normal. */
export function sceneryFallback(foundation: Foundation): Foundation {
  return {...lookupFoundation('classic',foundation.brightness),fallback:'missing-art'};
}
