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
const serial = connected.length === 1 ? connected[0].split('\t')[0].trim() : null;
const property = (name) => serial ? spawnSync(adb, ['-s', serial, 'shell', 'getprop', name],
  { encoding: 'utf8', env }).stdout?.trim() ?? null : null;
const report = {
  capturedAt: new Date().toISOString(), commit: commit.status === 0 ? commit.stdout.trim() : 'uncommitted',
  buildVariant: 'release', apkSha256: existsSync(apk) ? createHash('sha256').update(readFileSync(apk)).digest('hex') : null,
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
if (connected.length !== 1 || !report.apkSha256) process.exitCode = 1;
