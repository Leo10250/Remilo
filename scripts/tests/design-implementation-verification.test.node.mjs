import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { Buffer } from 'node:buffer';
import { imageMetadata, vectorMetadata, implementationFindings, implementationResourceFindings, verifyPresentation, verifyProductionAssets } from '../verify-design.mjs';

const repository = path.resolve(import.meta.dirname, '../..');
const temporaryParent = path.join(repository, 'verification/local');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (root, file, value) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value); };
const ids = ['sunrise', 'sky', 'evening', 'night'].flatMap((scene) => ['light', 'dark'].map((brightness) => `${scene}-${brightness}`));
const roles = Object.fromEntries(['canvas', 'surface', 'onSurface', 'onSurfaceVariant', 'primary', 'onPrimary', 'container', 'outline', 'error', 'onError', 'errorPressed', 'warning', 'success', 'disabledSurface', 'disabledInk', 'inverseSurface', 'inverseInk', 'inverseAction'].map((role) => [role, '#123456']));

function png(width, height) {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8); bytes.write('IHDR', 12); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); bytes[24] = 8; bytes[25] = 2;
  return bytes;
}
function webp(width, height) {
  const bytes = Buffer.alloc(26);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(18, 4); bytes.write('WEBPVP8L', 8); bytes.writeUInt32LE(5, 16); bytes[20] = 0x2f;
  bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return bytes;
}
function fixture(t) {
  fs.mkdirSync(temporaryParent, { recursive: true });
  const root = fs.mkdtempSync(path.join(temporaryParent, 'design-verifier-'));
  t.after(() => {
    const relative = path.relative(fs.realpathSync(temporaryParent), fs.realpathSync(root));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Fixture cleanup stays inside the private evidence directory.');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const scenes = ids.map((id) => {
    const masterBytes = png(1672, 941), runtimeBytes = webp(1440, 810);
    const approvedMaster = { path: `assets/atmospheres/masters/${id}-v1.png`, sha256: sha(masterBytes), width: 1672, height: 941, format: 'PNG', opaque: true, masterResolutionRequirementMet: false };
    const runtimeExport = { path: `assets/atmospheres/${id}-v1.webp`, sha256: sha(runtimeBytes), width: 1440, height: 810, format: 'WebP', opaque: true, lossless: true,
      cropProfiles: { 'hero-360': { focalNormalized: [0.5, 0.5] }, 'compact-360': { focalNormalized: [0.5, 0.46] } } };
    const nativeExport = { path: `modules/remilo-alarm/android/src/main/res/drawable-nodpi/${id}-v1.webp`, sha256: sha(runtimeBytes), width: 1440, height: 810, identicalToRuntime: true };
    const approval = { path: `docs/design/production-assets/approvals/${id}-v1.json`, ownerStatement: 'Approved.', candidate: 1, recordedAtUtc: '2026-10-09T00:00:00Z' };
    for (const [record, bytes] of [[approvedMaster, masterBytes], [runtimeExport, runtimeBytes], [nativeExport, runtimeBytes]]) write(root, record.path, bytes);
    write(root, approval.path, { assetId: id, version: 1, ...approval, approvedCandidateSha256: approvedMaster.sha256, masterResolutionRequirementMet: false, files: { source: approvedMaster, runtime: runtimeExport, native: nativeExport } });
    return { id, reference: approvedMaster, approval, approvedMaster, runtimeExport, nativeExport };
  });
  write(root, 'docs/design/production-assets/manifest.json', { schemaVersion: 1, masterContract: { width: 2048, height: 1152 }, runtimeContract: { width: 1440, height: 810, nativeCopyIdentical: true }, scenes });
  const source = { path: 'assets/brand/reference/classic.png', sha256: sha(png(467, 467)), width: 467, height: 467 };
  const sourceBoard = { path: 'assets/brand/reference/board.png', sha256: source.sha256 };
  write(root, source.path, png(467, 467)); write(root, sourceBoard.path, png(467, 467));
  write(root, 'docs/design/production-assets/brand-manifest.json', { schemaVersion: 1, source, sourceBoard, noGenerativeRedraw: true, exports: [] });
  const canonical = read(repository, 'assets/atmospheres/presentation.json');
  write(root, 'assets/atmospheres/presentation.json', { ...canonical, pairs: Object.fromEntries(scenes.map((scene) => [scene.id, { ...roles, asset: path.basename(scene.runtimeExport.path), native: path.basename(scene.nativeExport.path, '.webp'), heroFocal: [0.5, 0.5], compactFocal: [0.5, 0.46] }])), semantic: { light: roles, dark: roles } });
  return { root, scenes, source, sourceBoard };
}

test('implementation permits runtime/status changes while retaining frozen evidence and backlog IDs', () => {
  const baseline = { files: [{ path: 'src/app/index.tsx', kind: 'implemented-baseline' }, { path: 'docs/design/accepted.png', kind: 'accepted-reference' }], retainedBacklogRows: ['| UX-01 | old detail | pending |'] };
  const findings = [{ check: 'immutable-changed', path: 'src/app/index.tsx' }, { check: 'immutable-index-changed', path: 'src/app/index.tsx' }, { check: 'unapproved-deletion', path: 'src/app/index.tsx' }, { check: 'retained-backlog-row' }, { check: 'immutable-changed', path: 'docs/design/accepted.png' }, { check: 'obsolete-file-remains', path: 'old/demo.ts' }, { check: 'markdown-link', path: 'docs/product.md' }];
  assert.deepEqual(implementationFindings({ findings }, baseline, '| UX-01 | current detail | implemented/unverified |'), findings.slice(4));
  assert.ok(implementationFindings({ findings: [] }, baseline, '| UX-02 | new | pending |').some((finding) => finding.check === 'retained-backlog-item' && finding.id === 'UX-01'));
});

test('approved scene hashes and copies pass with the preserved master-resolution limitation', (t) => {
  const { root } = fixture(t), result = verifyProductionAssets(root);
  assert.deepEqual(result.findings, []);
  assert.equal(result.checks.approvedScenes, 8); assert.equal(result.checks.identicalSceneCopies, 8);
  assert.equal(result.limitations.length, 8);
  assert.deepEqual(imageMetadata(webp(1440, 810)), { format: 'WebP', width: 1440, height: 810, hasAlpha: false, lossless: true });
  assert.throws(() => imageMetadata(Buffer.from('not an image')), /Expected PNG/);
});

test('active production JSON resolves owned Android resources from the repo while preserving real missing-path errors', (t) => {
  const { root } = fixture(t), target = 'android/app/src/main/res/mipmap-mdpi/ic_launcher.webp';
  const finding = { check: 'json-resource', path: 'docs/design/production-assets/brand-manifest.json', target,
    resolvedCandidates: ['docs/design/production-assets/' + target] };
  write(root, target, webp(48, 48));
  assert.deepEqual(implementationResourceFindings([finding], root), { findings: [], resolved: 1 });
  const missing = { ...finding, target: 'android/app/src/main/res/mipmap-mdpi/missing.webp' };
  write(root, 'docs/design/production-assets/' + missing.target, webp(48, 48));
  const unrelated = { ...finding, path: 'docs/design/accepted-reference.json' }, traversal = { ...finding, target: 'android/app/src/main/res/../outside.webp' }, wrongCheck = { ...finding, check: 'approval-file-binding' };
  const result = implementationResourceFindings([missing, unrelated, traversal, wrongCheck], root);
  assert.equal(result.resolved, 0);
  assert.equal(result.findings.length, 4);
  assert.deepEqual(result.findings[0].resolvedCandidates, [...missing.resolvedCandidates, missing.target]);
  assert.deepEqual(result.findings.slice(1), [unrelated, traversal, wrongCheck]);
});

test('altering a native copy fails its approval hash and RN/native equality', (t) => {
  const { root, scenes } = fixture(t), selected = scenes[0];
  write(root, selected.nativeExport.path, webp(1439, 810));
  const result = verifyProductionAssets(root);
  assert.ok(result.findings.some((finding) => finding.check === 'scene-native' && /SHA-256/.test(finding.message)));
  assert.ok(result.findings.some((finding) => finding.check === 'scene-copy-equality'));
});

test('rewriting a production hash cannot substitute unapproved artwork', (t) => {
  const { root } = fixture(t), file = 'docs/design/production-assets/manifest.json', registry = read(root, file);
  const selected = registry.scenes[0], replacement = webp(1440, 809);
  write(root, selected.runtimeExport.path, replacement); selected.runtimeExport.sha256 = sha(replacement); selected.runtimeExport.height = 809;
  write(root, file, registry);
  const result = verifyProductionAssets(root);
  assert.ok(result.findings.some((finding) => finding.check === 'approval-file-binding'));
  assert.ok(result.findings.some((finding) => finding.check === 'scene-runtime-contract'));
});

test('active production assets require approval identity and owner records', (t) => {
  const { root, scenes } = fixture(t), record = read(root, scenes[0].approval.path);
  record.assetId = 'different-scene'; record.ownerStatement = '';
  write(root, scenes[0].approval.path, record);
  assert.ok(verifyProductionAssets(root).findings.some((finding) => finding.check === 'asset-approval'));
});

test('Classic candidates cannot enter production without their individual file approvals', (t) => {
  const { root, source, sourceBoard } = fixture(t), registryPath = 'docs/design/production-assets/brand-manifest.json', registry = read(root, registryPath);
  const output = { path: 'assets/brand/classic/export.png', sha256: sha(png(48, 48)), width: 48, height: 48, format: 'PNG', opaque: true, lossless: true };
  write(root, output.path, png(48, 48));
  registry.exports.push({ id: 'classic-test', approval: null, productionFiles: [output] }); write(root, registryPath, registry);
  assert.ok(verifyProductionAssets(root).findings.some((finding) => finding.check === 'asset-approval'));
  const approval = { path: 'docs/design/production-assets/approvals/classic-test-v1.json', ownerStatement: 'Approved.', candidate: 1, recordedAtUtc: '2026-10-09T00:00:00Z' };
  registry.exports[0].approval = approval; registry.nativeCopies = [{ source: output.path, path: 'android/app/src/main/res/drawable/icon.png', sha256: output.sha256 }];
  write(root, registry.nativeCopies[0].path, png(48, 48));
  write(root, approval.path, { ...approval, assetId: 'classic-test', version: 1, sources: [source, sourceBoard], files: [output] }); write(root, registryPath, registry);
  const result = verifyProductionAssets(root);
  assert.deepEqual(result.findings, []); assert.equal(result.checks.approvedBrandExports, 1); assert.equal(result.checks.identicalBrandCopies, 1);
});

test('Classic layer masters remain bound to their individual approval and source bytes', (t) => {
  const { root, source, sourceBoard } = fixture(t), registryPath = 'docs/design/production-assets/brand-manifest.json', registry = read(root, registryPath);
  const record = (file, width) => ({ path: file, sha256: sha(png(width, width)), width, height: width, format: 'PNG', lossless: true });
  const approvedSource = record('assets/brand/classic/masters/adaptive-v1.png', 467), layer = record('assets/brand/classic/masters/foreground-v1.png', 467), output = record('assets/brand/classic/adaptive/foreground.png', 108);
  for (const file of [approvedSource, layer, output]) write(root, file.path, png(file.width, file.height));
  const approval = { path: 'docs/design/production-assets/approvals/classic-adaptive-v1.json', ownerStatement: 'Approved.', candidate: 1, recordedAtUtc: '2026-10-09T00:00:00Z' };
  registry.exports.push({ id: 'classic-adaptive', approval, approvedSource, approvedSources: [layer], productionFiles: [output] });
  write(root, approval.path, { ...approval, assetId: 'classic-adaptive', version: 1, sources: [source, sourceBoard], files: [approvedSource, layer, output] }); write(root, registryPath, registry);
  const result = verifyProductionAssets(root);
  assert.deepEqual(result.findings, []); assert.equal(result.checks.approvedBrandSourceFiles, 2);
  const replacement = png(466, 466); write(root, layer.path, replacement);
  assert.ok(verifyProductionAssets(root).findings.some((finding) => finding.check === 'brand-approved-source' && /SHA-256/.test(finding.message)));
  layer.sha256 = sha(replacement); layer.width = layer.height = 466; write(root, registryPath, registry);
  assert.ok(verifyProductionAssets(root).findings.some((finding) => finding.check === 'approval-file-binding' && finding.path === layer.path));
});

test('notification vectors are checked structurally as white 24 dp alpha artwork', (t) => {
  const vector = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M8,12 L11,15 L16,8 Z" /></vector>';
  assert.deepEqual(vectorMetadata(Buffer.from(vector)), { format: 'AndroidVector', width: 24, height: 24, hasAlpha: true, whiteSilhouette: true, paths: 1 });
  assert.throws(() => vectorMetadata(Buffer.from(vector.replace('24dp', '48dp'))), /24 dp/);
  assert.throws(() => vectorMetadata(Buffer.from(vector.replace('#FFFFFFFF', '#245CD6'))), /white alpha/);
  assert.throws(() => vectorMetadata(Buffer.from(vector.replace('</vector>', '</group>'))), /Unbalanced/);
  assert.throws(() => vectorMetadata(Buffer.from('<!DOCTYPE vector []>' + vector)), /declarations/);
  const { root, source, sourceBoard } = fixture(t), registryPath = 'docs/design/production-assets/brand-manifest.json', registry = read(root, registryPath);
  const output = { path: 'assets/brand/classic/notification/notification.xml', sha256: sha(Buffer.from(vector)), width: 24, height: 24, format: 'AndroidVector', opaque: false };
  const approval = { path: 'docs/design/production-assets/approvals/classic-notification-v1.json', ownerStatement: 'Approved.', candidate: 1, recordedAtUtc: '2026-10-09T00:00:00Z' };
  write(root, output.path, vector); write(root, approval.path, { ...approval, assetId: 'classic-notification', version: 1, sources: [source, sourceBoard], files: [output] });
  registry.exports.push({ id: 'classic-notification', approval, productionFiles: [output] }); write(root, registryPath, registry);
  assert.deepEqual(verifyProductionAssets(root).findings, []);
});

test('presentation selects approved active derivatives and recorded crop anchors', (t) => {
  const { root } = fixture(t), file = 'assets/atmospheres/presentation.json';
  assert.deepEqual(verifyPresentation(root, { generated: false }).findings, []);
  const source = read(root, file); source.pairs['night-dark'].asset = 'night-dark-v0.webp'; source.pairs['night-dark'].compactFocal = [0.5, 0.7]; write(root, file, source);
  const findings = verifyPresentation(root, { generated: false }).findings;
  assert.ok(findings.some((finding) => finding.check === 'presentation-asset-binding'));
  assert.ok(findings.some((finding) => finding.check === 'presentation-crop-binding'));
});

test('editing registry and presentation crops together cannot override approved anchors', (t) => {
  const { root } = fixture(t), registryPath = 'docs/design/production-assets/manifest.json', presentationPath = 'assets/atmospheres/presentation.json';
  const registry = read(root, registryPath), presentation = read(root, presentationPath);
  registry.scenes[0].runtimeExport.cropProfiles['compact-360'].focalNormalized = [0.5, 0.7];
  presentation.pairs[registry.scenes[0].id].compactFocal = [0.5, 0.7];
  write(root, registryPath, registry); write(root, presentationPath, presentation);
  assert.deepEqual(verifyPresentation(root, { generated: false }).findings, []);
  assert.ok(verifyProductionAssets(root).findings.some((finding) => finding.check === 'approval-file-binding' && /cropProfiles/.test(finding.message)));
});

test('generated RN/native constants must match the canonical presentation source', (t) => {
  const { root } = fixture(t);
  write(root, 'scripts/presentation.mjs', fs.readFileSync(path.join(repository, 'scripts/presentation.mjs')));
  cp.execFileSync(process.execPath, [path.join(root, 'scripts/presentation.mjs')], { cwd: root, stdio: 'pipe' });
  assert.deepEqual(verifyPresentation(root).findings, []);
  fs.appendFileSync(path.join(root, 'modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/AtmosphereTokens.kt'), '\n// accidental native drift\n');
  assert.ok(verifyPresentation(root).findings.some((finding) => finding.check === 'presentation-generated'));
});
