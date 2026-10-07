import assert from 'node:assert/strict';

export const paletteIds = ['classic', 'sunrise', 'sky', 'meadow', 'peach', 'rose', 'lavender', 'mist'];
export const colorRoles = ['background', 'surface', 'ink', 'muted', 'accent', 'accentInk', 'soft', 'border',
  'danger', 'warning', 'success', 'outline', 'focus', 'primaryPressed', 'onPrimaryPressed',
  'secondaryPressed', 'onSecondaryPressed', 'disabledSurface', 'disabledInk', 'selectedSurface',
  'selectedInk', 'inverseSurface', 'inverseInk', 'inverseAction', 'dangerSurface', 'dangerInk'];
export const composeRoles = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'inversePrimary', 'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'background', 'onBackground',
  'surface', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'surfaceTint', 'inverseSurface',
  'inverseOnSurface', 'error', 'onError', 'errorContainer', 'onErrorContainer', 'outline', 'outlineVariant',
  'scrim', 'surfaceBright', 'surfaceDim', 'surfaceContainer', 'surfaceContainerHigh',
  'surfaceContainerHighest', 'surfaceContainerLow', 'surfaceContainerLowest'];
const hex = /^#[0-9A-F]{6}$/;
const digest = /^[0-9a-f]{64}$/;
export function validateCatalog(catalog) {
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(/^P02-(sample|catalog)-r\d+$/.test(catalog.revision));
  assert.ok(['sample', 'catalog'].includes(catalog.stage));
  assert.deepEqual(catalog.paletteIds, paletteIds);
  assert.equal(catalog.authoring.materialColorUtilities, '0.4.0');
  assert.equal(catalog.export.sharpVersion, '0.35.4');
  assert.equal(catalog.tokens.target.minimum, 48);
  assert.equal(catalog.tokens.target.nativeSingle, 64);
  assert.equal(catalog.tokens.shape.tile, 16);
  for (const group of ['type', 'space', 'shape', 'target']) {
    for (const value of Object.values(catalog.tokens[group])) assert.ok(Number.isFinite(value) && value > 0);
  }
  const required = catalog.stage === 'catalog' ? paletteIds : ['classic', 'sunrise', 'sky', 'meadow', 'rose'];
  const ids = catalog.palettes.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate palette ID');
  assert.deepEqual([...ids].sort(), [...required].sort(), 'Stage palette completeness');
  for (const role of composeRoles) assert.ok(colorRoles.includes(catalog.composeMapping[role]) || hex.test(catalog.composeMapping[role]), `Missing Compose role: ${role}`);
  const assets = new Map();
  for (const asset of catalog.assets) {
    assert.ok(!assets.has(asset.id), 'Duplicate asset ID'); assets.set(asset.id, asset);
    assert.ok(/^[a-z0-9_]+$/.test(asset.id));
    assert.ok(digest.test(asset.source.sha256));
    assert.ok(Number.isInteger(asset.source.width) && asset.source.width > 0);
    assert.ok(Number.isInteger(asset.source.height) && asset.source.height > 0);
    assert.ok(['light', 'dark'].includes(asset.brightness));
    assert.ok(asset.treatment.multiplier.length === 3 && asset.treatment.multiplier.every(n => Number.isFinite(n) && n > 0 && n <= 1));
  }
  for (const palette of catalog.palettes) {
    for (const brightness of ['light', 'dark']) {
      assert.deepEqual(Object.keys(palette.colors[brightness]).sort(), [...colorRoles].sort(), `${palette.id}/${brightness} roles`);
      for (const color of Object.values(palette.colors[brightness])) assert.ok(hex.test(color), 'Malformed color');
      const scene = palette.scenes[brightness];
      if (scene === null) { assert.equal(palette.id, 'classic'); continue; }
      assert.ok(assets.has(scene.assetId), 'Absent export input');
      assert.equal(assets.get(scene.assetId).brightness, brightness);
      for (const mode of ['browsing', 'individual']) {
        const placement = scene[mode];
        assert.ok(['top', 'bottom'].includes(placement.edge));
        assert.ok(placement.anchor.length === 2 && placement.anchor.every(n => n >= 0 && n <= 1));
        assert.ok(placement.quietRegion.length === 4 && placement.quietRegion.every(n => n >= 0 && n <= 1));
        assert.ok(placement.quietRegion[0] < placement.quietRegion[2] && placement.quietRegion[1] < placement.quietRegion[3]);
        assert.ok(placement.heightFraction > 0 && placement.heightFraction <= 1);
        assert.ok(placement.maxColumnDp >= 480 && placement.maxColumnDp <= 560);
        assert.equal(placement.layout, 'content-first');
      }
    }
  }
  return catalog;
}
