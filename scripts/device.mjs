import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, toolEnvironment } from './tools.mjs';

const env = toolEnvironment();
const adb = env.ANDROID_HOME
  ? join(env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb';
const devices = spawnSync(adb, ['devices'], { encoding: 'utf8', env });
const connected = (devices.stdout ?? '').split('\n').filter((line) => /\tdevice\s*$/.test(line));
const apk = join(root, 'android/app/build/outputs/apk/release/app-release.apk');
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
const changes = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
const serial = connected.length === 1 ? connected[0].split('\t')[0].trim() : null;
const property = (name) => serial ? spawnSync(adb, ['-s', serial, 'shell', 'getprop', name],
  { encoding: 'utf8', env }).stdout?.trim() ?? null : null;
const installedPaths = serial ? spawnSync(adb,
  ['-s', serial, 'shell', 'pm', 'path', '--user', '0', 'com.remilo.app'],
  { encoding: 'utf8', env }) : null;
const installedBase = installedPaths?.status === 0 ? installedPaths.stdout.split('\n')
  .map((line) => line.trim()).find((line) => /^package:\/.*\/base\.apk$/.test(line))
  ?.slice('package:'.length) : null;
const installedHash = installedBase ? spawnSync(adb,
  ['-s', serial, 'shell', 'sha256sum', installedBase], { encoding: 'utf8', env }) : null;
const installedApkSha256 = installedHash?.status === 0
  ? installedHash.stdout.match(/^[a-f0-9]{64}(?=\s)/)?.[0] ?? null : null;
const localApkSha256 = existsSync(apk) ? createHash('sha256').update(readFileSync(apk)).digest('hex') : null;
const installedMatchesLocalApk = installedApkSha256 && localApkSha256
  ? installedApkSha256 === localApkSha256 : null;
const report = {
  capturedAt: new Date().toISOString(),
  workspace: { commit: commit.status === 0 ? commit.stdout.trim() : null,
    dirty: changes.status === 0 ? changes.stdout.trim().length > 0 : null },
  localBuild: { buildVariant: 'release', apkSha256: localApkSha256,
    sourceCommit: null }, // Associate the build with its recorded source; HEAD alone is not proof.
  installedBuild: { apkSha256: installedApkSha256, matchesLocalApk: installedMatchesLocalApk },
  connectedCount: connected.length, physicalObservations: 'pending',
  device: serial ? { model: property('ro.product.model'), android: property('ro.build.version.release'),
    api: property('ro.build.version.sdk'), securityPatch: property('ro.build.version.security_patch') } : null,
  scenarios: ['offline-cold-process', 'locked', 'direct-boot', 'stop', 'snooze', 'five-minute-cutoff', 'recovery']
    .map((id) => ({ id, result: 'pending', measuredDurationMs: null, observer: null })),
};
mkdirSync(join(root, 'verification/local'), { recursive: true });
writeFileSync(join(root, 'verification/local/device-preflight.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Connected authorized devices: ${connected.length}. Physical observations: pending.`);
if (devices.error) console.error('adb unavailable:', devices.error.message);
if (installedMatchesLocalApk === false) {
  console.error('The installed app differs from the local APK. Record the tested build before continuing.');
} else if (installedMatchesLocalApk === null) {
  console.error('Could not verify the installed APK against the local build.');
}
if (connected.length !== 1 || installedMatchesLocalApk !== true) process.exitCode = 1;
