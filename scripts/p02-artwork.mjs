/** Read-only validation of the P02 standalone source-artwork submission. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';

if (process.argv.includes('--help')) {
  console.log('node scripts/p02-artwork.mjs --check [sharp-package-path]\nRead-only P02 artwork source/hash/alpha/provenance validation. No exports, integration, icons or owner approval.');
  process.exit(0);
}
assert.equal(process.argv[2], '--check', 'Choose --check or --help.');
assert.ok(process.argv.length <= 4, 'Unexpected arguments.');
const root = resolve(import.meta.dirname, '..');
const sharp = createRequire(import.meta.url)(process.argv[3] || 'sharp');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const load = async path => {
  const absolute = resolve(root, path);
  assert.ok(absolute.startsWith(root + sep), 'Manifest paths must stay inside the repository.');
  return readFile(absolute);
};
const manifest = JSON.parse(await load('docs/design/p02/artwork-r1/manifest.json'));
const { bundleSha256, ...bundle } = manifest;
assert.equal(bundleSha256, hash(JSON.stringify(bundle)), 'Submitted bundle digest');
assert.equal(manifest.artifactId, 'P02-artwork-r1');
assert.deepEqual(manifest.integration, { rn: false, compose: false, production: false });
assert.deepEqual(manifest.candidates.map(c => c.id), ['SK1', 'SK2', 'RO1', 'RO2']);
const check = async record => assert.equal(hash(await load(record.path)), record.sha256, record.path);
await check(manifest.authorization);
await check(manifest.generationRequests);
await check(manifest.reviewBoard);
for (const preview of manifest.previews) await check(preview);
const requests = JSON.parse(await load(manifest.generationRequests.path));
assert.equal(requests.toolMode, 'built-in');
for (const candidate of manifest.candidates) {
  await check(candidate.source); await check(candidate.prompt); await check(candidate.placementGuide);
  for (const reference of candidate.references) await check(reference);
  const request = requests.requests.find(c => c.id === candidate.id);
  assert.ok(request); assert.equal(request.request.transparent_background, true);
  assert.equal(hash(request.request.prompt), candidate.exactToolPromptSha256);
  assert.equal((await load(candidate.prompt.path)).toString(), request.request.prompt + '\n');
  assert.equal(candidate.generatedOriginal.sha256, candidate.source.sha256);
  const bytes = await load(candidate.source.path);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.hasAlpha, true);
  assert.equal(metadata.width, candidate.width); assert.equal(metadata.height, candidate.height);
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0, visible = 0;
  for (let i = 3; i < data.length; i += 4) { transparent += data[i] === 0; visible += data[i] > 0; }
  assert.ok(transparent > 0 && visible > 0, candidate.id + ': real transparent/visible source pixels');
  assert.equal(transparent / (candidate.width * candidate.height), candidate.alpha.transparentFraction);
}
console.log(JSON.stringify({ result: 'passed', mode: 'read-only', sources: manifest.candidates.length,
  bundleSha256, artworkOwnerAccepted: manifest.ownerAccepted, actualUiAccessibilityEstablished: false,
  productionIntegration: false, sharpVersion: sharp.versions.sharp }, null, 2));
