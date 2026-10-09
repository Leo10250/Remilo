// The cleanup record remains frozen evidence. This entry point retains its
// reference/removal/link checks while allowing the approved implementation work.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { verifyDesign as verifyCleanup } from '../docs/evidence/time-of-day-realignment/verify.mjs';

const repository = path.resolve(import.meta.dirname, '..');
const evidence = 'docs/evidence/time-of-day-realignment';
const scenesPath = 'docs/design/production-assets/manifest.json';
const brandPath = 'docs/design/production-assets/brand-manifest.json';
const presentationPath = 'assets/atmospheres/presentation.json';
const sceneIds = ['sunrise', 'sky', 'evening', 'night'].flatMap((scene) => ['light', 'dark'].map((brightness) => `${scene}-${brightness}`));
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function localPath(root, file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file) || file.includes('\\') || file.split('/').includes('..')) throw new Error('Expected a portable repository-relative asset path.');
  const destination = path.resolve(root, file);
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(destination));
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset resolves outside the repository.');
  return destination;
}

// Header checks establish container, dimensions and lossless encoding. The
// approval hash protects the inspected pixels; this does not claim runtime QA.
export function imageMetadata(bytes) {
  if (bytes.length >= 26 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'PNG', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), hasAlpha: [4, 6].includes(bytes[25]), lossless: true };
  }
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Expected PNG or complete WebP image.');
  let width, height, hasAlpha = false, lossless = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), data = offset + 8;
    if (data + size > bytes.length) throw new Error('Truncated WebP chunk.');
    if (type === 'VP8X' && size >= 10) {
      hasAlpha ||= Boolean(bytes[data] & 0x10);
      width = bytes.readUIntLE(data + 4, 3) + 1;
      height = bytes.readUIntLE(data + 7, 3) + 1;
    } else if (type === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const bits = bytes.readUInt32LE(data + 1);
      width ??= (bits & 0x3fff) + 1;
      height ??= ((bits >>> 14) & 0x3fff) + 1;
      hasAlpha ||= Boolean(bits & 0x10000000);
      lossless = true;
    } else if (type === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      width ??= bytes.readUInt16LE(data + 6) & 0x3fff;
      height ??= bytes.readUInt16LE(data + 8) & 0x3fff;
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height) throw new Error('WebP image dimensions are missing.');
  return { format: 'WebP', width, height, hasAlpha, lossless };
}

/** Structural checks for Android's white 24 dp notification alpha silhouette. */
export function vectorMetadata(bytes) {
  const source = bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/^\s*<\?xml\s+[^?]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (/<!|<\?|&/.test(source)) throw new Error('Notification vector cannot contain declarations, entities or processing instructions.');
  const stack = [], tags = [...source.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)>/g)];
  let offset = 0, root, paths = 0;
  const white = (color) => /^#(?:FFFFFF|FFFFFFFF)$/i.test(color ?? '');
  for (const match of tags) {
    if (source.slice(offset, match.index).trim()) throw new Error('Unexpected notification vector content.');
    offset = match.index + match[0].length;
    const [, closing, name, rest] = match;
    if (!['vector', 'group', 'path'].includes(name)) throw new Error('Unsupported notification vector element: ' + name);
    if (closing) {
      if (rest.trim() || stack.pop() !== name) throw new Error('Unbalanced notification vector XML.');
      continue;
    }
    const selfClosing = /\/\s*$/.test(rest), raw = rest.replace(/\/\s*$/, ''), attributes = {};
    let cursor = 0;
    for (const item of raw.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (raw.slice(cursor, item.index).trim() || Object.hasOwn(attributes, item[1])) throw new Error('Malformed or duplicate notification vector attribute.');
      attributes[item[1]] = item[2] ?? item[3]; cursor = item.index + item[0].length;
    }
    if (raw.slice(cursor).trim()) throw new Error('Malformed notification vector attribute.');
    if (!root) {
      if (name !== 'vector') throw new Error('Expected Android vector root.');
      root = attributes;
    } else if (!stack.length || name === 'vector') throw new Error('Expected one notification vector root.');
    if (name === 'path') {
      if (!(white(attributes['android:fillColor']) || white(attributes['android:strokeColor'])) ||
        Object.entries(attributes).some(([key, value]) => ['android:fillColor', 'android:strokeColor'].includes(key) && !white(value))) throw new Error('Notification paths must use white alpha fill/stroke only.');
      if (!/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/.test(attributes['android:pathData'] ?? '')) throw new Error('Notification path geometry is missing or invalid.');
      for (const key of ['android:fillAlpha', 'android:strokeAlpha']) if (attributes[key] != null && (!Number.isFinite(Number(attributes[key])) || Number(attributes[key]) < 0 || Number(attributes[key]) > 1)) throw new Error('Notification path alpha must be between zero and one.');
      paths++;
    }
    if (!selfClosing) stack.push(name);
  }
  if (source.slice(offset).trim() || stack.length || !root || !paths) throw new Error('Incomplete notification vector XML.');
  if (root['xmlns:android'] !== 'http://schemas.android.com/apk/res/android' || root['android:width'] !== '24dp' || root['android:height'] !== '24dp' || Number(root['android:viewportWidth']) !== 24 || Number(root['android:viewportHeight']) !== 24) throw new Error('Notification vector must use 24 dp dimensions and a 24 × 24 viewport.');
  if (root['android:tint'] != null && !white(root['android:tint'])) throw new Error('Notification vector tint must be white.');
  return { format: 'AndroidVector', width: 24, height: 24, hasAlpha: true, whiteSilhouette: true, paths };
}

export function verifyProductionAssets(root = repository) {
  const findings = [], limitations = [], checks = { approvedScenes: 0, sceneFiles: 0, identicalSceneCopies: 0, approvedBrandExports: 0, approvedBrandSourceFiles: 0, brandFiles: 0, identicalBrandCopies: 0 };
  const add = (check, details) => findings.push({ check, ...details });
  function read(file, check) {
    try { return JSON.parse(fs.readFileSync(localPath(root, file), 'utf8')); }
    catch (error) { add(check, { path: file, message: error.message }); return null; }
  }
  function file(record, check, { image = true } = {}) {
    if (!record || typeof record.path !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256 ?? '')) { add(check, { path: record?.path, message: 'A path and SHA-256 approval hash are required.' }); return null; }
    try {
      const bytes = fs.readFileSync(localPath(root, record.path));
      if (sha256(bytes) !== record.sha256) add(check, { path: record.path, message: 'File differs from its approved SHA-256.' });
      if (image) {
        const actual = record.path.endsWith('.xml') ? vectorMetadata(bytes) : imageMetadata(bytes);
        for (const field of ['width', 'height', 'format']) if (record[field] != null && actual[field] !== record[field]) add(check, { path: record.path, message: `${field} differs from the export record.` });
        if (record.lossless === true && !actual.lossless) add(check, { path: record.path, message: 'Export does not use a lossless PNG/WebP container.' });
        if (record.opaque === true && actual.hasAlpha) add(check, { path: record.path, message: 'An opaque export unexpectedly contains alpha.' });
      }
      return bytes;
    } catch (error) { add(check, { path: record.path, message: error.message }); return null; }
  }
  function approval(asset, expectedId) {
    if (!asset.approval) { add('asset-approval', { path: expectedId, message: 'Active production artwork needs an individual approval record.' }); return null; }
    const record = read(asset.approval.path, 'asset-approval');
    if (!record) return null;
    if (record.assetId !== expectedId || !Number.isInteger(record.version) || record.version < 1 || record.candidate !== asset.approval.candidate || !record.ownerStatement?.trim() || record.ownerStatement !== asset.approval.ownerStatement || record.recordedAtUtc !== asset.approval.recordedAtUtc) add('asset-approval', { path: asset.approval.path, message: 'Approval identity, candidate, owner statement or recording date differs from the registry.' });
    return record;
  }
  function matches(record, approved, approvalPath) {
    if (!record || !approved || record.path !== approved.path || record.sha256 !== approved.sha256) { add('approval-file-binding', { path: record?.path, approval: approvalPath, message: 'Production file is not bound to this individual approval.' }); return; }
    for (const field of ['width', 'height', 'format', 'lossless', 'opaque']) if (approved[field] != null && record[field] != null && record[field] !== approved[field]) add('approval-file-binding', { path: record.path, approval: approvalPath, message: `${field} differs from the individual approval.` });
    for (const field of ['sourceRectPx', 'cropProfiles']) if (approved[field] != null && JSON.stringify(record[field]) !== JSON.stringify(approved[field])) add('approval-file-binding', { path: record.path, approval: approvalPath, message: `${field} differs from the individual approval.` });
  }
  const registry = read(scenesPath, 'scene-registry');
  if (registry) {
    if (registry.schemaVersion !== 1 || !Array.isArray(registry.scenes) || registry.scenes.length !== sceneIds.length || new Set(registry.scenes.map((scene) => scene.id)).size !== sceneIds.length || registry.scenes.some((scene) => !sceneIds.includes(scene.id))) add('scene-registry', { path: scenesPath, message: 'Expected the eight active atmosphere/brightness pairs.' });
    for (const scene of registry.scenes ?? []) {
      const record = approval(scene, scene.id);
      const master = scene.approvedMaster, runtime = scene.runtimeExport, native = scene.nativeExport;
      if (record) {
        checks.approvedScenes++;
        matches(master, record.files?.source, scene.approval.path);
        matches(runtime, record.files?.runtime, scene.approval.path);
        matches(native, record.files?.native, scene.approval.path);
        if (record.approvedCandidateSha256 !== master?.sha256 || !master?.path?.endsWith(`/${scene.id}-v${record.version}.png`)) add('approval-master-binding', { path: master?.path, approval: scene.approval.path });
      }
      file(scene.reference, 'scene-reference');
      file(master, 'scene-master'); checks.sceneFiles++;
      const runtimeBytes = file(runtime, 'scene-runtime'); checks.sceneFiles++;
      const nativeBytes = file(native, 'scene-native'); checks.sceneFiles++;
      if (runtime?.width !== registry.runtimeContract?.width || runtime?.height !== registry.runtimeContract?.height || runtime?.format !== 'WebP' || runtime?.lossless !== true || runtime?.opaque !== true || native?.identicalToRuntime !== true) add('scene-runtime-contract', { path: runtime?.path, message: 'Active runtime export must be opaque lossless 1440 × 810 WebP with an identical native copy.' });
      if (registry.runtimeContract?.width !== 1440 || registry.runtimeContract?.height !== 810 || registry.runtimeContract?.nativeCopyIdentical !== true) add('scene-runtime-contract', { path: scenesPath, message: 'Runtime contract differs from the current approved format.' });
      if (runtimeBytes && nativeBytes) {
        if (!runtimeBytes.equals(nativeBytes)) add('scene-copy-equality', { path: native.path, source: runtime.path });
        else checks.identicalSceneCopies++;
      }
      if (master && (master.width !== registry.masterContract?.width || master.height !== registry.masterContract?.height)) {
        if (master.masterResolutionRequirementMet !== false || record?.masterResolutionRequirementMet !== false) add('scene-master-resolution', { path: master.path, message: 'The preserved source dimension gap must remain explicitly recorded.' });
        limitations.push({ check: 'preserved-master-resolution', path: master.path, actual: [master.width, master.height], required: [registry.masterContract?.width, registry.masterContract?.height], message: 'Original approved pixels are preserved; the requested master resolution remains unmet.' });
      }
    }
  }
  const brand = read(brandPath, 'brand-registry');
  if (brand) {
    if (brand.schemaVersion !== 1 || brand.noGenerativeRedraw !== true || !Array.isArray(brand.exports)) add('brand-registry', { path: brandPath, message: 'Expected the faithful static Classic export registry.' });
    file(brand.source, 'brand-source');
    file(brand.sourceBoard, 'brand-source');
    for (const entry of brand.exports ?? []) {
      if (!entry.approval && !(entry.productionFiles?.length)) continue; // Pending candidates never become production approval.
      const record = approval(entry, entry.id);
      if (record) {
        checks.approvedBrandExports++;
        if (!(entry.productionFiles?.length)) add('brand-approved-files', { path: entry.approval.path, message: 'An approved export must identify its production files.' });
        for (const source of [brand.source, brand.sourceBoard]) matches(source, record.sources?.find((item) => item.path === source?.path), entry.approval.path);
      }
      for (const source of [entry.approvedSource, ...(entry.approvedSources ?? [])].filter(Boolean)) {
        if (record) matches(source, record.files?.find((item) => item.path === source.path), entry.approval.path);
        file(source, 'brand-approved-source'); checks.approvedBrandSourceFiles++;
      }
      for (const output of entry.productionFiles ?? []) {
        if (record) matches(output, record.files?.find((item) => item.path === output.path), entry.approval.path);
        file(output, 'brand-export'); checks.brandFiles++;
      }
    }
    const approved = new Map((brand.exports ?? []).filter((entry) => entry.approval).flatMap((entry) => entry.productionFiles ?? []).map((entry) => [entry.path, entry]));
    for (const copy of brand.nativeCopies ?? []) {
      const source = approved.get(copy.source);
      if (!source || source.sha256 !== copy.sha256) { add('brand-copy-approval', { path: copy.path, source: copy.source }); continue; }
      const original = file(source, 'brand-copy-source', { image: false }), native = file(copy, 'brand-native-copy', { image: false });
      if (original && native) {
        if (!original.equals(native)) add('brand-copy-equality', { path: copy.path, source: copy.source });
        else checks.identicalBrandCopies++;
      }
    }
  }
  return { checks, findings, limitations };
}

export function verifyPresentation(root = repository, { generated = true } = {}) {
  const findings = [], checks = { presentationPairs: 0, approvedCropBindings: 0, generatedPresentationFiles: 0 };
  const add = (check, details) => findings.push({ check, ...details });
  try {
    const source = readJson(root, presentationPath), registry = readJson(root, scenesPath);
    if (source.schemaVersion !== 1 || Object.keys(source.pairs ?? {}).length !== sceneIds.length || sceneIds.some((id) => !source.pairs?.[id])) add('presentation-pairs', { path: presentationPath, message: 'Expected all eight atmosphere/brightness pairs.' });
    for (const [id, pair] of Object.entries(source.pairs ?? {})) {
      checks.presentationPairs++;
      const scene = registry.scenes?.find((entry) => entry.id === id);
      if (!scene || pair.asset !== path.posix.basename(scene.runtimeExport?.path ?? '') || pair.native !== path.posix.basename(scene.nativeExport?.path ?? '', '.webp')) add('presentation-asset-binding', { path: presentationPath, pair: id, message: 'RN/native presentation must select the active approved derivatives.' });
      for (const [role, profile] of [['heroFocal', 'hero-360'], ['compactFocal', 'compact-360']]) {
        const expected = scene?.runtimeExport?.cropProfiles?.[profile]?.focalNormalized;
        if (!Array.isArray(pair[role]) || pair[role].length !== 2 || !expected || pair[role].some((value, index) => !Number.isFinite(value) || value < 0 || value > 1 || Math.abs(value - expected[index]) > 0.000001)) add('presentation-crop-binding', { path: presentationPath, pair: id, role, message: 'Presentation crop differs from the approved derivative crop.' });
        else checks.approvedCropBindings++;
      }
      const roles = { ...pair, ...source.semantic?.[id.endsWith('-dark') ? 'dark' : 'light'] };
      for (const name of ['canvas', 'surface', 'onSurface', 'onSurfaceVariant', 'primary', 'onPrimary', 'container', 'outline', 'error', 'warning', 'success', 'disabledSurface', 'disabledInk', 'inverseSurface', 'inverseInk', 'inverseAction']) if (!/^#[0-9a-f]{6}$/i.test(roles[name] ?? '')) add('presentation-role', { path: presentationPath, pair: id, role: name });
    }
    if (generated) {
      try {
        cp.execFileSync(process.execPath, [path.join(root, 'scripts/presentation.mjs'), '--check'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
        checks.generatedPresentationFiles = 2;
      } catch (error) { add('presentation-generated', { path: presentationPath, message: String(error.stderr || error.message).trim() }); }
    }
  } catch (error) { add('presentation-input', { path: presentationPath, message: error.message }); }
  return { checks, findings };
}

// Status, descriptions and evidence links are maintained in the live backlog;
// preservation means its established item IDs remain, not frozen old statuses.
export function implementationFindings(result, baseline, backlog) {
  const runtime = new Set(baseline.files.filter((entry) => entry.kind === 'implemented-baseline').map((entry) => entry.path));
  const findings = result.findings.filter((finding) => {
    if (finding.check === 'retained-backlog-row') return false;
    return !(['immutable-changed', 'immutable-index-changed', 'immutable-missing', 'unapproved-deletion'].includes(finding.check) && runtime.has(finding.path));
  });
  const ids = new Set([...backlog.matchAll(/^\|\s*([^|]+?)\s*\|/gm)].map((match) => match[1].trim()));
  for (const row of baseline.retainedBacklogRows) {
    const id = row.match(/^\|\s*([^|]+?)\s*\|/)?.[1].trim();
    if (!id || !ids.has(id)) findings.push({ check: 'retained-backlog-item', id, message: 'An established backlog item is missing.' });
  }
  return findings;
}

/** Current owned Android resources are repository-relative; frozen evidence keeps its old resolver. */
export function implementationResourceFindings(findings, root = repository) {
  let resolved = 0;
  const retained = findings.flatMap((finding) => {
    if (finding.check !== 'json-resource' || !finding.path?.startsWith('docs/design/production-assets/') ||
      !/^android\/app\/src\/main\/res\/[a-z0-9_-]+\/[a-z0-9_]+\.(?:png|webp|jpe?g|svg|gif|xml)$/.test(finding.target ?? '')) return [finding];
    try {
      if (fs.statSync(localPath(root, finding.target)).isFile()) { resolved++; return []; }
    } catch { /* Missing or escaping resources remain unresolved. */ }
    return [{ ...finding, resolvedCandidates: [...new Set([...(finding.resolvedCandidates ?? []), finding.target])] }];
  });
  return { findings: retained, resolved };
}

export function verifyDesign(root = repository) {
  const cleanup = verifyCleanup(root), baseline = readJson(root, `${evidence}/immutable-baseline.json`);
  const assets = verifyProductionAssets(root), presentation = verifyPresentation(root);
  const checks = { ...cleanup.checks, ...assets.checks, ...presentation.checks };
  checks.protectedReferenceAndDecisionFiles = baseline.files.filter((entry) => entry.kind !== 'implemented-baseline').length;
  checks.editableRuntimeBaselineFiles = checks.implementedBaselineFiles;
  const resources = implementationResourceFindings(implementationFindings(cleanup, baseline, fs.readFileSync(path.join(root, 'docs/backlog.md'), 'utf8')), root);
  checks.implementationRootResources = resources.resolved;
  delete checks.immutableFiles; delete checks.protectedIndexBlobs; delete checks.implementedBaselineFiles; delete checks.allowedRefactors;
  return { ...cleanup, verification: 'active implementation and preserved design evidence', checks,
    findings: [...resources.findings, ...assets.findings, ...presentation.findings],
    limitations: assets.limitations,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyDesign();
    console.log(JSON.stringify(result, null, 2));
    if (result.findings.length) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ findings: [{ check: 'verifier-input', message: error.message }] }, null, 2));
    process.exitCode = 1;
  }
}
