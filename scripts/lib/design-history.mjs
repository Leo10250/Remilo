import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

// Squash merges and deleted branches can leave the frozen audit baseline outside
// every advertised ref. A full-depth checkout alone does not guarantee this object.
export function ensureDesignBaseline(root, { fetchMissing = false } = {}) {
  const directory = path.join(root, 'docs/evidence/time-of-day-realignment');
  const baseline = JSON.parse(fs.readFileSync(path.join(directory, 'immutable-baseline.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'cleanup-manifest.json'), 'utf8'));
  const revision = baseline.baselineRevision;
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision) || revision !== manifest.baselineRevision) {
    throw new Error('Design audit baseline records must identify the same full commit SHA.');
  }
  const available = () => {
    const result = cp.spawnSync('git', ['cat-file', '-e', `${revision}^{commit}`], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    if (result.error) throw result.error;
    return result.status === 0;
  };
  const missing = () => new Error(`Design audit baseline ${revision} is missing from this checkout. Run: git fetch --no-tags origin ${revision}. Fetching all current branches does not include a deleted branch's history.`);
  if (available()) return { revision, fetched: false };
  if (!fetchMissing) throw missing();
  cp.execFileSync('git', ['fetch', '--no-tags', 'origin', revision], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (!available()) throw missing();
  return { revision, fetched: true };
}
