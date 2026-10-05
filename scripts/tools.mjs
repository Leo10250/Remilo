import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, delimiter, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';

export const root = resolve(import.meta.dirname, '..');
export const localEvidence = join(root, 'verification/local');
export class WorkflowError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.details = details; }
}
export function findExecutable(name, env = process.env) {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path');
  const names = process.platform === 'win32' && !name.endsWith('.exe') ? [`${name}.exe`, name] : [name];
  for (const directory of (env[pathKey] ?? '').split(delimiter)) {
    if (!directory) continue;
    for (const candidate of names) if (existsSync(join(directory, candidate))) return join(directory, candidate);
  }
  return null;
}
export function toolEnvironment(base = process.env) {
  const env = { ...base };
  const version = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
  const localNodeDir = join(root, '.tooling', `node-v${version}-win-${process.arch}`);
  const localJava = join(root, '.tooling', 'jdk-17.0.20.1+1');
  const localSdk = join(root, '.tooling', 'android-sdk');
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  if (existsSync(join(localNodeDir, 'node.exe'))) env[pathKey] = `${localNodeDir}${delimiter}${env[pathKey] ?? ''}`;
  if (existsSync(join(localJava, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))) env.JAVA_HOME = localJava;
  if (!env.JAVA_HOME) {
    const java = findExecutable('java', env);
    if (java) env.JAVA_HOME = dirname(dirname(java));
  }
  if (existsSync(join(localSdk, 'platform-tools'))) env.ANDROID_HOME = localSdk;
  env.ANDROID_HOME ??= env.ANDROID_SDK_ROOT;
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
  return env;
}
export function localNode() { return findExecutable('node', toolEnvironment()) ?? process.execPath; }
export function ensureNode() {
  const selected = localNode();
  if (resolve(selected).toLowerCase() === resolve(process.execPath).toLowerCase()) return;
  const env = toolEnvironment();
  env.REMILO_ORIGINAL_NODE ??= process.execPath;
  for (const key of ['JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT']) env[`REMILO_ORIGINAL_${key}`] ??= process.env[key] ?? '';
  const result = spawnSync(selected, process.argv.slice(1), { env, stdio: 'inherit' });
  if (result.error) throw new WorkflowError('NODE_UNAVAILABLE', 'Selected Node could not start. Run npm run doctor.');
  process.exit(result.status ?? 1);
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env: toolEnvironment(), stdio: 'inherit', ...options });
  if (result.error) throw new WorkflowError('PROCESS_START', `${basename(command)} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new WorkflowError('PROCESS_FAILED', `${basename(command)} failed (${result.status ?? result.signal}).`);
  return result;
}
// No shell expansion: APK paths, device serials and process arguments are separate values.
export function execute(command, args, { env = toolEnvironment(), cwd = root, stream = false,
  stderrStream = false, timeout = 30_000, binary = false, outputFile = null, cancelIsSuccess = false, protectRelease = false } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { env, cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [], stderr = []; let bytes = 0, cancelled = false, timedOut = false, treeUncertain = false;
    const terminate = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        const killed = spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        if (killed.status !== 0) { treeUncertain = true; child.kill('SIGTERM'); }
      }
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already exited. */ } }
    };
    const cancel = () => { cancelled = true; terminate(); };
    const timer = timeout > 0 ? setTimeout(() => { timedOut = true; terminate(); }, timeout) : null;
    process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
    const cleanup = () => { if (timer) clearTimeout(timer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); };
    child.stdout.on('data', (chunk) => {
      if (outputFile) outputFile.write(chunk);
      else if (stream) (stderrStream ? process.stderr : process.stdout).write(chunk);
      bytes += chunk.length;
      if (bytes <= 16 * 1024 * 1024 && !outputFile) stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => { if (stream) process.stderr.write(chunk); if (stderr.length < 1000) stderr.push(chunk); });
    child.once('error', (error) => { cleanup(); reject(new WorkflowError('PROCESS_START', `${basename(command)} could not start: ${error.message}`)); });
    child.once('close', (status, signal) => {
      cleanup();
      const details = protectRelease && treeUncertain ? { retainReleaseLock: true } : {};
      const lockMessage = details.retainReleaseLock ? ' Release lock retained because child-tree termination could not be confirmed. Confirm the build processes ended before removing verification/local/release.lock.' : '';
      if (cancelled && !cancelIsSuccess) return reject(new WorkflowError('CANCELLED', `Command cancelled; an interrupted install may need inspection with npm run verify:device.${lockMessage}`, details));
      if (timedOut) return reject(new WorkflowError('TIMEOUT', `${basename(command)} timed out. No automatic retry was attempted.${lockMessage}`, details));
      if (!stream && !outputFile && bytes > 16 * 1024 * 1024) return reject(new WorkflowError('OUTPUT_LIMIT', 'Command output exceeded 16 MB; no truncated artifact was accepted.'));
      resolveResult({ status: cancelled && cancelIsSuccess ? 0 : status, signal,
        stdout: binary ? Buffer.concat(stdout) : Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
  });
}
export async function checked(command, args, options) {
  const result = await execute(command, args, options);
  if (result.status !== 0) throw new WorkflowError('PROCESS_FAILED', `${basename(command)} failed (${result.status}): ${(result.stderr || result.stdout).toString().trim().slice(-3000)}`);
  return result;
}
