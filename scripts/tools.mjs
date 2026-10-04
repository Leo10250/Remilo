import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const root = resolve(import.meta.dirname, '..');
export function toolEnvironment() {
  const localNode = join(root, '.tooling', 'node-v22.23.3-win-x64');
  const localJava = join(root, '.tooling', 'jdk-17.0.20.1+1');
  const localSdk = join(root, '.tooling', 'android-sdk');
  const env = { ...process.env };
  if (existsSync(join(localNode, 'node.exe'))) env.Path = `${localNode};${env.Path ?? ''}`;
  if (existsSync(localJava)) env.JAVA_HOME = localJava;
  if (existsSync(localSdk)) env.ANDROID_HOME = localSdk;
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
  return env;
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root, env: toolEnvironment(), stdio: 'inherit',
    shell: process.platform === 'win32' && /\.(bat|cmd)$/i.test(command), ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result;
}
export function localNode() {
  const candidate = join(root, '.tooling', 'node-v22.23.3-win-x64', 'node.exe');
  return existsSync(candidate) ? candidate : process.execPath;
}
