import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceDirectory = 'docs/evidence/time-of-day-realignment';
const resourceExtension = /\.(?:png|webp|jpe?g|svg|gif|html|css|js|json|md|woff2?|ttf)(?:[?#].*)?$/i;
const resourceKeys = /^(?:file|selectedFile|image|imagePath|path|matchingR3Reference|thumbnail|src|href|contract|specification|fixtures|gallery|stylesheet|script)$/i;
const bundleForRecord = {
  R3: 'docs/design/remilo-r3-atmospheres', R4: 'docs/design/remilo-r4-details-editor',
  R5: 'docs/design/remilo-r5-sky-evening-details-editor', R6: 'docs/design/remilo-r6-alarm-postpone',
  R7: 'docs/design/remilo-r7-lists-repeats', R8: 'docs/design/remilo-r8-settings-appearance',
  R10: 'docs/design/remilo-r10-data-help',
};
const slash = (value) => value.replaceAll('\\', '/');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const gitBlob = (bytes) => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

// Compare against the approved starting revision, including committed, staged and
// unstaged edits. Approved moves appear as deletions plus verified destinations.
export function readGitChanges(root, revision) {
  const run = (args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const entries = run(['diff', '--no-renames', '--name-status', '-z', revision, '--']).split('\0');
  const tracked = [];
  for (let index = 0; index < entries.length - 1; index += 2) tracked.push({ status: entries[index], path: slash(entries[index + 1]) });
  const untracked = run(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).map(slash);
  return { tracked, untracked };
}

export function verifyDesign(root = repository) {
  const findings = [], checks = {}, provenanceReferences = [], externalProvenance = [];
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const exists = (file) => fs.existsSync(path.join(root, file));
  const add = (check, details) => findings.push({ check, ...details });
  const baseline = JSON.parse(read(`${evidenceDirectory}/immutable-baseline.json`));
  const manifest = JSON.parse(read(`${evidenceDirectory}/cleanup-manifest.json`));
  if (baseline.schemaVersion !== 2 || manifest.schemaVersion !== 1 || baseline.baselineRevision !== manifest.baselineRevision) add('manifest-schema', { message: 'Expected schema-2 baseline and matching schema-1 cleanup manifest.' });
  const immutable = new Map(baseline.files.map((entry) => [entry.path, entry]));
  const frozen = new Set(baseline.files.filter((entry) => ['accepted-reference', 'current-decision-or-fixture'].includes(entry.kind)).map((entry) => entry.path));
  const removals = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const movedFrom = new Set(manifest.moves.map((entry) => entry.from));
  const approvedDeletions = new Set([...removals.keys(), ...movedFrom]);
  const current = new Set(baseline.currentContracts.map((entry) => entry.path));
  const index = new Map(cp.execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map((row) => {
    const [details, file] = row.split('\t');
    return [slash(file), details.split(' ')[1]];
  }));
  if (immutable.size !== 411 || frozen.size !== 245 || current.size !== 11 || removals.size !== 1905 || manifest.moves.length !== 2) add('protected-inventory', { message: 'Inventory counts differ from approved cleanup.' });
  if (manifest.files.length !== removals.size || manifest.summary.files !== removals.size || manifest.summary.bytes !== manifest.files.reduce((total, entry) => total + entry.bytes, 0)) add('removal-inventory', { message: 'Duplicate removal paths or inconsistent totals.' });
  const permittedRefactors = baseline.allowedRefactors ?? [];
  for (const refactor of permittedRefactors) if (refactor.path !== 'src/ui/recurrence.tsx' || refactor.from !== 'useReviewFontScale' || refactor.to !== 'useFontScaleOverride') add('refactor-allowance', { path: refactor.path, message: 'Only the approved recurrence hook rename is permitted.' });
  for (const entry of baseline.files) {
    if (!exists(entry.path)) { add('immutable-missing', { path: entry.path }); continue; }
    if (index.get(entry.path) !== entry.gitBlob) {
      const refactor = permittedRefactors.find((item) => item.path === entry.path);
      let approved = false;
      if (refactor && index.has(entry.path)) {
        const staged = cp.execFileSync('git', ['show', `:${entry.path}`], { cwd: root });
        const restored = Buffer.from(staged.toString('utf8').replaceAll(refactor.to, refactor.from));
        approved = gitBlob(restored) === entry.gitBlob;
      }
      if (!approved) add('immutable-index-changed', { path: entry.path, kind: entry.kind });
    }
    const bytes = fs.readFileSync(path.join(root, entry.path));
    if (sha256(bytes) === entry.sha256 || (entry.gitBlob && gitBlob(bytes) === entry.gitBlob)) continue;
    const refactor = permittedRefactors.find((item) => item.path === entry.path && item.from === 'useReviewFontScale' && item.to === 'useFontScaleOverride');
    if (refactor) {
      const original = cp.execFileSync('git', ['show', `${baseline.baselineRevision}:${entry.path}`], { cwd: root });
      const restored = bytes.toString('utf8').replaceAll(refactor.to, refactor.from).replaceAll('\r\n', '\n');
      if ((sha256(original) === entry.sha256 || gitBlob(original) === entry.gitBlob) && restored === original.toString('utf8').replaceAll('\r\n', '\n')) continue;
    }
    add('immutable-changed', { path: entry.path, kind: entry.kind });
  }
  checks.immutableFiles = baseline.files.length;
  checks.protectedIndexBlobs = baseline.files.length;
  checks.referenceBundleFiles = baseline.files.filter((entry) => entry.kind === 'accepted-reference').length;
  checks.currentDecisionAndFixtureFiles = baseline.files.filter((entry) => entry.kind === 'current-decision-or-fixture').length;
  checks.implementedBaselineFiles = baseline.files.filter((entry) => entry.kind === 'implemented-baseline').length;
  checks.allowedRefactors = permittedRefactors.length;
  for (const file of current) if (!exists(file)) add('current-contract-missing', { path: file });
  checks.currentContracts = current.size;
  for (const [file] of removals) {
    if (immutable.has(file) || current.has(file)) add('protected-removal', { path: file });
    if (exists(file)) add('obsolete-file-remains', { path: file });
  }
  checks.approvedRemovals = removals.size;
  for (const move of manifest.moves) {
    if (exists(move.from)) add('move-source-remains', { path: move.from });
    if (!exists(move.to)) add('move-destination-missing', { path: move.to });
    else if (sha256(fs.readFileSync(path.join(root, move.to))) !== move.sha256) add('move-destination-changed', { path: move.to });
  }
  checks.retainedBrandingMoves = manifest.moves.length;
  const backlog = new Set(read('docs/backlog.md').split(/\r?\n/));
  for (const row of baseline.retainedBacklogRows) if (!backlog.has(row)) add('retained-backlog-row', { row });
  checks.retainedBacklogRows = baseline.retainedBacklogRows.length;

  let trackedFiles = [];
  try {
    const changes = readGitChanges(root, baseline.baselineRevision);
    for (const entry of changes.tracked) if (entry.status === 'D' && !approvedDeletions.has(entry.path)) add('unapproved-deletion', { path: entry.path });
    checks.trackedChangedFiles = changes.tracked.length;
    checks.untrackedFiles = changes.untracked.length;
    const names = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    trackedFiles = [...new Set(names.split('\0').filter((file) => file && exists(file)).map(slash))];
  } catch (error) { add('git-baseline', { message: error.message }); }

  const provenanceSeen = new Set(), externalSeen = new Set();
  function checkReference(source, target, check, { candidates = [], externalAllowed = false } = {}) {
    if (/^(?:https?:|mailto:|data:|codex:|#)/i.test(target) || target.includes('${')) return;
    let value = target.trim().replace(/^<|>$/g, '').replace(/\s+["'][^"']*["']$/, '').split('#')[0].split('?')[0];
    if (!value) return;
    try { value = decodeURIComponent(value); } catch { add(check, { path: source, target, message: 'Invalid URI encoding.' }); return; }
    value = slash(value).replace(/:\d+$/, '');
    const rootPath = slash(path.resolve(root));
    if (/^[A-Za-z]:\//.test(value) || value.startsWith('file:')) {
      value = value.replace(/^file:\/\//, '').replace(/^\/(?=[A-Za-z]:)/, '');
      if (value.toLowerCase().startsWith(`${rootPath.toLowerCase()}/`)) value = value.slice(rootPath.length + 1);
      else if (frozen.has(source) && externalAllowed) {
        const key = `${source}\0${target}`;
        if (!externalSeen.has(key)) { externalSeen.add(key); externalProvenance.push({ path: source, target, kind: 'original-host-source' }); }
        return;
      } else { add(check, { path: source, target, message: 'Non-portable local file reference.' }); return; }
    }
    const logicalBases = [];
    if (frozen.has(source) && /\/submission-(?:specification|fixtures)-/.test(source)) logicalBases.push('docs/design');
    if (frozen.has(source) && source === 'docs/design/remilo-r10-data-help/documentation-revision-evidence.md') logicalBases.push('docs/evidence');
    const bundle = baseline.referenceBundles.find((directory) => source.startsWith(directory));
    if (bundle && check === 'json-resource') {
      const historic = source.match(/^(.*\/history\/r1)\//)?.[1];
      logicalBases.push(historic ?? bundle.replace(/\/$/, ''));
    }
    if (frozen.has(source) && source.endsWith('/generation-provenance.json') && value.startsWith('generated-output/')) {
      const key = `${source}\0${target}`;
      if (!externalSeen.has(key)) { externalSeen.add(key); externalProvenance.push({ path: source, target, kind: 'original-generation-intermediate' }); }
      return;
    }
    if (source.endsWith('/gallery.js') && source.startsWith(bundleForRecord.R10) && /^0[1-8]-(?:sunrise|sky|evening|night)-(?:light|dark)\.png$/.test(value)) logicalBases.push(path.posix.dirname(source) + '/references');
    const possible = [...new Set([
      path.posix.normalize(path.posix.join(path.posix.dirname(source), value)),
      ...(value.startsWith('docs/') || value.startsWith('assets/') || value.startsWith('src/') || value.startsWith('modules/') ? [value] : []),
      ...candidates.map((directory) => path.posix.normalize(path.posix.join(directory, value))),
      ...logicalBases.map((directory) => path.posix.normalize(path.posix.join(directory, value))),
    ])];
    if (possible.some((file) => exists(file))) return;
    const removed = possible.find((file) => approvedDeletions.has(file));
    if (removed && frozen.has(source)) {
      const key = `${source}\0${target}`;
      if (!provenanceSeen.has(key)) {
        provenanceSeen.add(key);
        provenanceReferences.push({ path: source, target, originalPath: removed, originalGitUrl: `https://github.com/Leo10250/Remilo/blob/${baseline.baselineRevision}/${removed.split('/').map(encodeURIComponent).join('/')}`, kind: 'frozen-historical-citation' });
      }
      return;
    }
    add(check, { path: source, target, resolvedCandidates: possible });
  }

  let jsonFiles = 0, markdownLinks = 0, galleryResources = 0, jsonImageEntries = 0;
  for (const file of trackedFiles) {
    if (file.endsWith('.json')) {
      let document;
      try { document = JSON.parse(read(file)); jsonFiles++; } catch (error) { add('json', { path: file, message: error.message }); continue; }
      // These inventories are hash/path ledgers, not live resource catalogs.
      if (file.startsWith(`${evidenceDirectory}/`) || file === 'package-lock.json') continue;
      function visit(value, trail = []) {
        if (Array.isArray(value)) { value.forEach((item, index) => visit(item, [...trail, String(index)])); return; }
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && resourceKeys.test(key) && resourceExtension.test(child) && !child.includes('\n')) {
            const candidates = trail.map((part) => bundleForRecord[part]).filter(Boolean);
            if (file.includes('approved-ui-r10')) candidates.push(bundleForRecord.R10);
            if (file.includes('approved-ui-r5')) candidates.push(bundleForRecord.R5);
            if (file.includes('approved-ui-r6-themed')) candidates.push(`${bundleForRecord.R6}/themed-alarms`);
            if (file.includes('approved-ui-r6-')) candidates.push(bundleForRecord.R6);
            if (file.includes('approved-ui-r7')) candidates.push(bundleForRecord.R7);
            if (file.includes('approved-ui-r8')) candidates.push(bundleForRecord.R8);
            if (/^docs\/design\/r10-/.test(file)) candidates.push(bundleForRecord.R10);
            jsonImageEntries++;
            checkReference(file, child, 'json-resource', { candidates, externalAllowed: true });
          }
          visit(child, [...trail, key]);
        }
      }
      visit(document);
    }
    if (file.endsWith('.md')) {
      const text = read(file).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
      for (const match of text.matchAll(/\]\((<[^>]+>|[^\n)]+)\)/g)) {
        markdownLinks++;
        checkReference(file, match[1], 'markdown-link', { externalAllowed: true });
      }
      for (const match of text.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) {
        markdownLinks++;
        checkReference(file, match[1], 'markdown-link', { externalAllowed: true });
      }
    }
    if (baseline.referenceBundles.some((directory) => file.startsWith(directory)) && /\.(?:html|css|js)$/.test(file)) {
      const text = read(file), references = [];
      if (file.endsWith('.html')) for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) references.push(match[1]);
      for (const match of text.matchAll(/url\(\s*["']?([^\)'"\s]+)["']?\s*\)/g)) references.push(match[1]);
      if (file.endsWith('.js') || file.endsWith('.html')) for (const match of text.matchAll(/["']([^"'\r\n]+\.(?:png|webp|jpe?g|svg|json|css|js))["']/g)) references.push(match[1]);
      for (const target of new Set(references)) {
        galleryResources++;
        checkReference(file, target, 'gallery-resource');
      }
    }
  }
  checks.jsonFilesParsed = jsonFiles;
  checks.localMarkdownReferences = markdownLinks;
  checks.galleryLocalResources = galleryResources;
  checks.jsonResourceEntries = jsonImageEntries;
  checks.referenceBundlesChecked = baseline.referenceBundles.length;
  checks.frozenHistoricalCitations = provenanceReferences.length;
  checks.originalHostSourceCitations = externalProvenance.length;

  let executableDependencies = 0;
  for (const file of trackedFiles.filter((entry) => /\.(?:[cm]?js|tsx?|kt|gradle)$/.test(entry) && /^(?:src\/|scripts\/|verification\/|modules\/|metro\.config\.)/.test(entry))) {
    const text = read(file);
    const specifiers = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\(|\breadFileSync\s*\(|\bimport\s+)["']([^"']+)["']/g)].map((match) => match[1]);
    for (const target of specifiers) {
      executableDependencies++;
      const base = target.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), target)) : target;
      const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'].map((extension) => base + extension)];
      const deleted = candidates.find((entry) => approvedDeletions.has(entry));
      if (deleted) add('deleted-executable-dependency', { path: file, target, originalPath: deleted });
    }
    if (file.endsWith('.kt') && /^\s*import\s+com\.remilo\.alarm\.(?:foundation|review)\./m.test(text)) add('deleted-native-dependency', { path: file });
  }
  checks.executableDependenciesChecked = executableDependencies;
  return { date: manifest.date, baselineRevision: baseline.baselineRevision, checks, findings, provenanceReferences, externalProvenance };
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
