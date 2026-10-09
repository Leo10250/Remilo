import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { readGitChanges } from '../../docs/evidence/time-of-day-realignment/verify.mjs';

test('cleanup deletion audit includes committed, staged, unstaged and untracked paths from its recorded baseline', () => {
  const repository = path.resolve(import.meta.dirname, '../..');
  const fixtureParent = path.join(repository, 'verification/local');
  fs.mkdirSync(fixtureParent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(fixtureParent, 'cleanup-git-test-'));
  const git = (...args) => cp.execFileSync('git', args, { cwd: fixture, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git('init', '--initial-branch=cleanup-test');
    git('config', 'user.name', 'Cleanup verification');
    git('config', 'user.email', 'cleanup-test@example.invalid');
    for (const name of ['committed removal.md', 'staged removal.md', 'unstaged removal.md', 'retained.md']) fs.writeFileSync(path.join(fixture, name), name);
    git('add', '.');
    git('commit', '-m', 'Fixture baseline');
    const baseline = git('rev-parse', 'HEAD');
    fs.unlinkSync(path.join(fixture, 'committed removal.md'));
    git('add', '-u');
    git('commit', '-m', 'Committed cleanup');
    fs.unlinkSync(path.join(fixture, 'staged removal.md'));
    git('add', '-u');
    fs.unlinkSync(path.join(fixture, 'unstaged removal.md'));
    fs.writeFileSync(path.join(fixture, 'new record.md'), 'new record');
    const changes = readGitChanges(fixture, baseline);
    assert.deepEqual(changes.tracked, [
      { status: 'D', path: 'committed removal.md' },
      { status: 'D', path: 'staged removal.md' },
      { status: 'D', path: 'unstaged removal.md' },
    ]);
    assert.deepEqual(changes.untracked, ['new record.md']);
  } finally {
    const actual = fs.realpathSync(fixture);
    const allowed = fs.realpathSync(fixtureParent) + path.sep;
    assert.ok(actual.startsWith(allowed) && path.basename(actual).startsWith('cleanup-git-test-'));
    fs.rmSync(actual, { recursive: true, force: true });
  }
});
