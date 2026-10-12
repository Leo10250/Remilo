import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { ensureDesignBaseline } from '../lib/design-history.mjs';
import { verifyDesign } from '../verify-design.mjs';
import { readGitChanges } from '../../docs/evidence/time-of-day-realignment/verify.mjs';

function fixture(t) {
  const parent = path.resolve(import.meta.dirname, '../../verification/local');
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, 'design-history-'));
  t.after(() => {
    const relative = path.relative(fs.realpathSync(parent), fs.realpathSync(directory));
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const git = (root, ...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  const source = path.join(directory, 'source'), checkout = path.join(directory, 'checkout');
  fs.mkdirSync(source);
  git(source, 'init', '--initial-branch=old-design');
  git(source, 'config', 'user.name', 'Design history fixture');
  git(source, 'config', 'user.email', 'design-history@example.invalid');
  fs.writeFileSync(path.join(source, 'removed.md'), 'Recorded design baseline.\n');
  git(source, 'add', '.'); git(source, 'commit', '-m', 'Recorded baseline');
  const revision = git(source, 'rev-parse', 'HEAD');
  git(source, 'checkout', '--orphan', 'current');
  git(source, 'rm', '--cached', 'removed.md');
  fs.unlinkSync(path.join(source, 'removed.md'));
  const evidence = path.join(source, 'docs/evidence/time-of-day-realignment');
  fs.mkdirSync(evidence, { recursive: true });
  for (const file of ['immutable-baseline.json', 'cleanup-manifest.json']) {
    fs.writeFileSync(path.join(evidence, file), JSON.stringify({ baselineRevision: revision }));
  }
  fs.writeFileSync(path.join(source, 'current.md'), 'Current implementation.\n');
  git(source, 'add', '.'); git(source, 'commit', '-m', 'Squashed implementation');
  git(source, 'branch', '-D', 'old-design');
  // A fresh full-depth clone has all advertised history, but no deleted branch.
  git(directory, 'clone', '--no-local', source, checkout);
  assert.throws(() => git(checkout, 'cat-file', '-e', `${revision}^{commit}`));
  return { directory, checkout, revision, git };
}

test('CI explicitly fetches the unreachable recorded commit without changing checkout or deletion coverage', (t) => {
  const { checkout, revision, git } = fixture(t);
  const head = git(checkout, 'rev-parse', 'HEAD'), status = git(checkout, 'status', '--porcelain');
  assert.throws(() => ensureDesignBaseline(checkout), /Design audit baseline .* is missing.*git fetch --no-tags origin/);
  assert.deepEqual(ensureDesignBaseline(checkout, { fetchMissing: true }), { revision, fetched: true });
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);
  assert.equal(git(checkout, 'status', '--porcelain'), status);
  assert.equal(git(checkout, 'show', `${revision}:removed.md`), 'Recorded design baseline.');
  assert.ok(readGitChanges(checkout, revision).tracked.some((entry) => entry.status === 'D' && entry.path === 'removed.md'));
  git(checkout, 'remote', 'remove', 'origin');
  assert.deepEqual(ensureDesignBaseline(checkout, { fetchMissing: true }), { revision, fetched: false });
});

test('ordinary design verification reports missing history before any historical path read and never fetches', (t) => {
  const { checkout, revision, git } = fixture(t);
  assert.throws(() => verifyDesign(checkout), /Design audit baseline .* is missing from this checkout/);
  assert.throws(() => git(checkout, 'cat-file', '-e', `${revision}^{commit}`));
  assert.equal(git(checkout, 'status', '--porcelain'), '');
});

test('a failed baseline fetch fails closed without substituting current content or rewriting evidence', (t) => {
  const { directory, checkout, revision, git } = fixture(t);
  const evidence = path.join(checkout, 'docs/evidence/time-of-day-realignment/immutable-baseline.json');
  const before = fs.readFileSync(evidence), head = git(checkout, 'rev-parse', 'HEAD');
  git(checkout, 'remote', 'set-url', 'origin', path.join(directory, 'missing-origin'));
  assert.throws(() => ensureDesignBaseline(checkout, { fetchMissing: true }), /git fetch/);
  assert.throws(() => git(checkout, 'cat-file', '-e', `${revision}^{commit}`));
  assert.deepEqual(fs.readFileSync(evidence), before);
  assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);
  assert.equal(git(checkout, 'status', '--porcelain'), '');
});

test('mismatched or invalid baseline identities are rejected before fetching', (t) => {
  const { checkout, revision, git } = fixture(t);
  const manifest = path.join(checkout, 'docs/evidence/time-of-day-realignment/cleanup-manifest.json');
  git(checkout, 'remote', 'remove', 'origin');
  for (const baselineRevision of ['0'.repeat(40), 'HEAD', revision.slice(0, 7)]) {
    fs.writeFileSync(manifest, JSON.stringify({ baselineRevision }));
    assert.throws(() => ensureDesignBaseline(checkout, { fetchMissing: true }), /same full commit SHA/);
  }
});
