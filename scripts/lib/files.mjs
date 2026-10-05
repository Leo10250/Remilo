import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const fileHash = (path) => sha256(readFileSync(path));
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n'); renameSync(temp, path);
}
export function readJson(path) { return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; }
