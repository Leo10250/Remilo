// Read-only pixel checks for the isolated design-review exports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { reviewPaletteCatalog } from '../src/ui/review-appearance.ts';

if (process.argv.includes('--help')) {
  console.log('node --experimental-strip-types scripts/verify-design-review-assets.mjs [sharp-package-path]\nRead-only source/crop pixel, alpha, dimensions and shared-token checks. No phone, build, export or production icon changes.');
  process.exit(0);
}
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = resolve(import.meta.dirname, '..');
const assets = join(root, 'assets/design-review');
const load = (name) => readFile(join(assets, name));
const pixels = async (input) => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const source = await load('source-icon-board.png');
const manifest = JSON.parse(await load('manifest.json'));
const sourceHash = createHash('sha256').update(source).digest('hex');
assert.equal(sourceHash, 'b7d19ae659fc43b747f468fbef91f674f19b235b739b8cf87ed83aefdb2fb849', 'The supplied icon source must remain intact.');
assert.equal(manifest.sourceSha256, sourceHash, 'Manifest source attribution must match the actual source bytes.');
assert.deepEqual(manifest.crop, { left: 491, top: 68, width: 467, height: 467 }, 'Classic uses the approved source crop.');
assert.equal(manifest.productionIconsReplaced, false, 'These exports are isolated review candidates.');
const original = await pixels(await sharp(source).extract(manifest.crop).png().toBuffer());
const classic = await pixels(await load('icon-classic.png'));
assert.equal(classic.info.width, original.info.width);
assert.equal(classic.info.height, original.info.height);
assert.deepEqual(classic.data, original.data, 'The Classic candidate must preserve every source crop pixel.');

for (const id of Object.keys(reviewPaletteCatalog)) {
  const candidate = await pixels(await load(`icon-${id}.png`));
  assert.equal(candidate.info.width, 467, `${id} icon width`);
  assert.equal(candidate.info.height, 467, `${id} icon height`);
  assert.ok(candidate.data.some((value) => value !== 0), `${id} icon must not be blank`);
}

for (const name of ['landscape', 'botanical']) {
  const input = await load(`${name}.png`);
  const metadata = await sharp(input).metadata();
  assert.equal(metadata.hasAlpha, true, `${name} must preserve transparency`);
  const { data, info } = await pixels(input);
  let clear = 0, visible = 0;
  const colors = new Set();
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) clear++;
    if (data[index + 3] > 127) { visible++; colors.add((data[index] << 16) | (data[index + 1] << 8) | data[index + 2]); }
  }
  const count = info.width * info.height;
  assert.ok(clear > count * .01, `${name} must have usable transparent space`);
  assert.ok(visible > count * .01, `${name} must have visible artwork`);
  assert.ok(colors.size > 50, `${name} must contain artwork rather than a flat fill`);
  const expectedNative = await pixels(await sharp(input).resize({ width: name === 'landscape' ? 1080 : 480, withoutEnlargement: true }).png().toBuffer());
  const actualNative = await pixels(await readFile(join(root, `modules/remilo-alarm/android/src/debug/res/drawable-nodpi/review_${name}.png`)));
  assert.equal(actualNative.info.width, expectedNative.info.width, `${name} native width`);
  assert.equal(actualNative.info.height, expectedNative.info.height, `${name} native height`);
  assert.deepEqual(actualNative.data, expectedNative.data, `${name} native artwork must match the review source export`);
}
const tokens = JSON.parse(await readFile(join(root, 'modules/remilo-alarm/android/src/debug/res/raw/review_palette_tokens.json')));
assert.deepEqual(tokens, reviewPaletteCatalog, 'Native review tokens must equal the React Native catalog.');
console.log('Design-review assets passed: original Classic pixels, eight icon dimensions, nonblank transparent scenes, native artwork parity and shared palette tokens.');
