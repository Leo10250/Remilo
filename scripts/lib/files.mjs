import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { localEvidence, WorkflowError } from '../tools.mjs';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const fileHash = (path) => sha256(readFileSync(path));
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n'); renameSync(temp, path);
}
export function readJson(path) { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; }
export async function withReleaseLock(work, directory = localEvidence) {
  mkdirSync(directory, { recursive: true });
  const lock = join(directory, 'release.lock'); let handle;
  try { handle = openSync(lock, 'wx'); writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); }
  catch (error) {
    if (error.code === 'EEXIST') throw new WorkflowError('BUILD_BUSY', `Another release workflow owns ${lock}. If it crashed, confirm its process has ended before manually removing the lock.`);
    throw error;
  }
  let retain = false;
  try { const result = await work(); retain = result?.retainReleaseLock === true; return result; }
  catch (error) { retain = error.details?.retainReleaseLock === true; throw error; }
  finally { closeSync(handle); if (!retain) unlinkSync(lock); }
}
