import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

if (process.argv.includes('--help')) {
  console.log('node scripts/p01-review-assets.mjs --export|--check [sharp-package-path]\nOnly the accepted S1/M1 bounded PNGs and review composition contract. No icon/catalog export.');
  process.exit(0);
}
assert.ok(['--export', '--check'].includes(process.argv[2]), 'Choose --export or --check.');
const sharp = createRequire(import.meta.url)(process.argv[3] || 'sharp');
const root = resolve(import.meta.dirname, '..');
const acceptance = JSON.parse(await readFile(join(root, 'docs/design/p01-artwork-r1-acceptance.json')));
assert.equal(acceptance.artworkAccepted, true);
const outputs = [];
const save = async (path, data) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); };
for (const candidate of acceptance.acceptedCandidates) {
  const source = await readFile(join(root, candidate.path));
  assert.equal(createHash('sha256').update(source).digest('hex'), candidate.sha256, candidate.id);
  const id = candidate.id === 'S1' ? 'sunrise-s1' : 'meadow-m1';
  const exported = await sharp(source).resize({ width: 1440, withoutEnlargement: true }).png().toBuffer();
  for (const path of [`assets/design-review/p01/${id}.png`, `modules/remilo-alarm/android/src/debug/res/drawable-nodpi/p01_${id.replaceAll('-', '_')}.png`]) {
    if (process.argv[2] === '--export') await save(join(root, path), exported);
    assert.deepEqual(await readFile(join(root, path)), exported, path);
    outputs.push({ path, sha256: createHash('sha256').update(exported).digest('hex') });
  }
}
const tokens = await readFile(join(root, 'assets/design-review/p01/composition.json'));
const nativeTokens = join(root, 'modules/remilo-alarm/android/src/debug/res/raw/p01_composition.json');
if (process.argv[2] === '--export') await save(nativeTokens, tokens);
assert.deepEqual(await readFile(nativeTokens), tokens, 'RN/Compose contract byte parity');
console.log(JSON.stringify({ result: 'passed', mode: process.argv[2], outputs }, null, 2));
