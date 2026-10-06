import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { reviewPaletteCatalog } from '../src/ui/review-appearance.ts';

if (process.argv.includes('--help')) {
  console.log('node --experimental-strip-types scripts/design-review-assets.mjs [sharp-package-path]\nExports fixture-only artwork, exact Classic crop, color variants and synthetic adaptive masks. Does not replace production icons.');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = resolve(import.meta.dirname, '..');
const assets = join(root, 'assets/design-review');
const debug = join(root, 'modules/remilo-alarm/android/src/debug/res');
const save = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };
const source = await readFile(join(assets, 'source-icon-board.png'));
const crop = { left: 491, top: 68, width: 467, height: 467 };
const classic = await sharp(source).extract(crop).png().toBuffer();
const variants = {
  classic: { ring: [200, 280], sun: 35 }, sunrise: { ring: [345, 40], sun: 35 }, sky: { ring: [195, 225], sun: 200 },
  meadow: { ring: [160, 100], sun: 90 }, peach: { ring: [5, 30], sun: 30 }, rose: { ring: [330, 355], sun: 20 },
  lavender: { ring: [235, 280], sun: 265 }, mist: { ring: [0, 0], sun: 0 },
};
const { data: pixels, info } = await sharp(classic).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function recolor({ ring, sun }, grayscale) {
  const data = Buffer.from(pixels);
  for (let i = 0; i < data.length; i += 4) {
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]].map((value) => value / 255);
    if (grayscale) {
      const gray = Math.round((rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) * 255);
      data[i] = data[i + 1] = data[i + 2] = gray;
      continue;
    }
    const max = Math.max(...rgb), min = Math.min(...rgb), delta = max - min;
    if (!delta) continue;
    const saturation = delta / max;
    const hue = ((max === rgb[0] ? (rgb[1] - rgb[2]) / delta : max === rgb[1] ? 2 + (rgb[2] - rgb[0]) / delta : 4 + (rgb[0] - rgb[1]) / delta) * 60 + 360) % 360;
    const warm = hue < 75 || hue > 355;
    const fraction = Math.max(0, Math.min(1, (hue - 195) / 85));
    let span = ring[1] - ring[0];
    if (span < -180) span += 360;
    const target = (warm ? sun + (hue - 35) * 0.4 : ring[0] + span * fraction + 360) % 360;
    const c = max * saturation, x = c * (1 - Math.abs(target / 60 % 2 - 1)), m = max - c;
    const rotated = target < 60 ? [c, x, 0] : target < 120 ? [x, c, 0] : target < 180 ? [0, c, x] : target < 240 ? [0, x, c] : target < 300 ? [x, 0, c] : [c, 0, x];
    const weight = Math.max(0, Math.min(1, (saturation - 0.025) / 0.1));
    for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round((rgb[channel] * (1 - weight) + (rotated[channel] + m) * weight) * 255);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
const outputs = {};
for (const [id, transformation] of Object.entries(variants)) {
  outputs[id] = id === 'classic' ? classic : await recolor(transformation, id === 'mist');
  await save(join(assets, `icon-${id}.png`), outputs[id]);
}

// The review foreground preserves source pixels inside a coarse isolation mask.
// This is a mask-fitting candidate, not a claimed production layer separation.
const foregroundMask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="467" height="467"><circle cx="236" cy="244" r="176" fill="white"/><rect x="282" y="39" width="140" height="143" rx="18" fill="white"/></svg>');
const foreground = await sharp(classic).ensureAlpha().composite([{ input: foregroundMask, blend: 'dest-in' }]).png().toBuffer();
const adaptiveForeground = await sharp({ create: { width: 432, height: 432, channels: 4, background: '#00000000' } })
  .composite([{ input: await sharp(foreground).resize(252, 252).png().toBuffer(), left: 90, top: 90 }]).png().toBuffer();
await save(join(assets, 'icon-adaptive-foreground.png'), adaptiveForeground);
const masks = {
  circle: '<circle cx="216" cy="216" r="144"/>',
  squircle: '<path d="M216 72 C330 72 360 102 360 216 C360 330 330 360 216 360 C102 360 72 330 72 216 C72 102 102 72 216 72 Z"/>',
  rounded: '<rect x="72" y="72" width="288" height="288" rx="64"/>',
};
const maskOutputs = {};
for (const [id, geometry] of Object.entries(masks)) {
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432"><g fill="white">${geometry}</g></svg>`);
  const masked = await sharp({ create: { width: 432, height: 432, channels: 4, background: '#FAF9FD' } })
    .composite([{ input: adaptiveForeground }, { input: mask, blend: 'dest-in' }]).png().toBuffer();
  maskOutputs[id] = await sharp(masked).extract({ left: 72, top: 72, width: 288, height: 288 }).png().toBuffer();
  await save(join(assets, `icon-mask-${id}.png`), maskOutputs[id]);
}
const monochrome = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 108 108"><rect width="108" height="108" rx="26" fill="#E8E1F5"/><path d="M63 29 A29 29 0 1 0 80 47" fill="none" stroke="#403950" stroke-width="9" stroke-linecap="round"/><path d="M40 54 L49 63 L65 44" fill="none" stroke="#403950" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="79" cy="30" r="7" fill="#403950"/><path d="M83 14 L86 8 M92 24 L99 20" stroke="#403950" stroke-width="4" stroke-linecap="round"/></svg>');
const monoOutput = await sharp(monochrome).png().toBuffer();
await save(join(assets, 'icon-monochrome.png'), monoOutput);

const labels = Object.keys(variants).map((id) => id[0].toUpperCase() + id.slice(1));
const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="940"><rect width="100%" height="100%" fill="#F7F8FC"/><text x="30" y="38" font-family="Arial" font-size="24" fill="#14203A">Remilo · supplied Classic identity</text><text x="30" y="63" font-family="Arial" font-size="14" fill="#4D5870">Original pixels; color-only variants. Adaptive isolation and monochrome are review candidates.</text>${labels.map((label, i) => `<text x="${i % 4 * 300 + 50}" y="${Math.floor(i / 4) * 300 + 314}" font-family="Arial" font-size="18" fill="#14203A">${label}</text>`).join('')}<text x="30" y="704" font-family="Arial" font-size="18" fill="#14203A">Adaptive masks and actual 48 px exports</text>${['Circle', 'Squircle', 'Rounded', 'System monochrome'].map((label, i) => `<text x="${i * 300 + 40}" y="902" font-family="Arial" font-size="15" fill="#4D5870">${label}</text>`).join('')}</svg>`);
const layers = [];
for (const [index, id] of Object.keys(variants).entries()) {
  layers.push({ input: await sharp(outputs[id]).resize(216, 216).png().toBuffer(), left: index % 4 * 300 + 40, top: Math.floor(index / 4) * 300 + 86 });
}
for (const [index, input] of [...Object.values(maskOutputs), monoOutput].entries()) {
  layers.push({ input: await sharp(input).resize(132, 132).png().toBuffer(), left: index * 300 + 40, top: 735 });
  layers.push({ input: await sharp(input).resize(48, 48).png().toBuffer(), left: index * 300 + 202, top: 782 });
}
await save(join(assets, 'icon-review.png'), await sharp(board).composite(layers).png().toBuffer());

for (const name of ['landscape', 'botanical']) {
  const input = await readFile(join(assets, `${name}.png`));
  const stats = await sharp(input).ensureAlpha().stats();
  if (stats.channels[3].min !== 0 || stats.channels[3].max === 0) throw new Error(`${name} must have usable alpha transparency.`);
  await save(join(debug, `drawable-nodpi/review_${name}.png`), await sharp(input).resize({ width: name === 'landscape' ? 1080 : 480, withoutEnlargement: true }).png().toBuffer());
}
await save(join(debug, 'raw/review_palette_tokens.json'), JSON.stringify(reviewPaletteCatalog, null, 2) + '\n');
await save(join(assets, 'manifest.json'), JSON.stringify({
  sourceSha256: createHash('sha256').update(source).digest('hex'), crop, variants,
  sharpVersion: sharp.versions.sharp, productionIconsReplaced: false,
  adaptive: 'Source-pixel isolation candidate centered inside the safe-area review; not launcher acceptance.',
  generatedArtwork: { tool: 'image_gen', prompts: 'README.md' },
}, null, 2) + '\n');
console.log('Exported isolated design-review assets and debug native resources; production icons unchanged.');
