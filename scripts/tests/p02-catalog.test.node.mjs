import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validateCatalog, colorRoles, composeRoles } from '../lib/p02-catalog.mjs';
const root = resolve(import.meta.dirname,'../..');
const load = path => readFile(resolve(root,path));
const hash = b => createHash('sha256').update(b).digest('hex');
const catalog = JSON.parse(await load('docs/design/p02/catalog.json'));
test('P02 rejects incomplete, duplicate, malformed and invalid placement inputs', () => {
  validateCatalog(catalog);
  const malformed = [c=>c.palettes.push(c.palettes[0]),c=>delete c.palettes[1].colors.light.focus,
    c=>c.palettes[1].colors.dark.ink='red',c=>c.palettes[1].scenes.light.browsing.anchor=[2,0],
    c=>c.palettes[1].scenes.light.assetId='absent',c=>delete c.composeMapping.surfaceContainer,
    c=>c.stage='catalog',c=>c.assets[0].source.width=0];
  for (const mutate of malformed) { const c=structuredClone(catalog); mutate(c); assert.throws(()=>validateCatalog(c)); }
});
test('P02 exports bind input, exact TS/Kotlin roles and identical image bytes', async () => {
  const manifest=JSON.parse(await load('docs/design/p02/export-manifest.json'));
  assert.equal(manifest.source.sha256,hash(await load(manifest.source.path)));
  for (const output of manifest.outputs) assert.equal(hash(await load(output.path)),output.sha256,`Stale output ${output.path}`);
  const kotlin=(await load('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/foundation/FoundationCatalog.generated.kt')).toString();
  assert.ok(kotlin.includes(`const val revision = "${catalog.revision}"`));
  for (const p of catalog.palettes) for (const b of ['light','dark']) for (const role of colorRoles)
    assert.ok(kotlin.includes(`"${role}" to 0xFF${p.colors[b][role].slice(1)}L`));
  for (const role of composeRoles) assert.ok(kotlin.includes(`"${role}" to "${catalog.composeMapping[role]}"`));
  for (const asset of manifest.assets) {
    assert.deepEqual(await load(asset.rn),await load(asset.native));
    assert.equal(asset.sha256,hash(await load(asset.rn))); assert.ok(asset.width<=1440 && asset.width*asset.height<=2000000 && asset.bytes<=2097152);
  }
  assert.ok(manifest.assets.reduce((sum,a)=>sum+a.bytes,0)<=25165824);
});
test('P02 source acceptance binds selected originals and preserves submitted records', async () => {
  const acceptance=JSON.parse(await load('docs/design/p02/artwork-r1-acceptance.json'));
  assert.deepEqual(acceptance.acceptedCandidates.map(c=>c.id),['SK1','RO1']);
  for (const source of acceptance.acceptedCandidates) assert.equal(hash(await load(source.path)),source.sha256);
  const submitted=JSON.parse(await load(acceptance.submittedManifest));
  assert.equal(submitted.ownerAccepted,false); assert.equal(acceptance.artworkAccepted,true);
  assert.equal(submitted.bundleSha256,acceptance.submittedBundleSha256);
});
