import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { root, execute, WorkflowError } from '../tools.mjs';
import { selectDevice, parseDevices, deviceAbi } from '../lib/devices.mjs';
import { parseBadging, validateApk, validateUpdate, checkSigning } from '../lib/android-tools.mjs';
import { deployWorkflow, installArguments, launchArguments, logArguments, confirmInstallation, confirmLaunch } from '../lib/deployment.mjs';
import { assertStable, validateReceipt, buildEnvironment, sourceSnapshot } from '../lib/build.mjs';
import { withReleaseLock, fileHash, writeJson, readJson } from '../lib/files.mjs';
import { previewEnvironment } from '../preview-ui.mjs';

const source = { commit: 'abc', dirty: false, inputSha256: 'inputs' };
const metadata = { package: 'com.remilo.app', versionCode: 4, versionName: '0.4.0', minSdk: 34, targetSdk: 36, abis: ['arm64-v8a'], debuggable: false, bundledJs: true, launcher: 'com.remilo.app.MainActivity', signed: true, signers: ['certificate'] };
const receipt = { schemaVersion: 1, source, apk: { path: 'folder with spaces/app.apk', sha256: 'hash', metadata } };
const device = { serial: 'pixel', state: 'device', api: 37, abis: ['arm64-v8a'] };
function setup(overrides = {}) {
  const calls = [];
  const deps = { preflight: async () => {}, target: async () => device, snapshot: async () => source,
    existing: async () => receipt, build: async (abi) => { calls.push(['build', abi]); return receipt; },
    installed: async () => metadata, install: async (...args) => { calls.push(['install', ...args]); },
    hash: async () => 'hash', launch: async (...args) => { calls.push(['launch', ...args]); }, ...overrides };
  return { calls, deps };
}
const temporary = (work) => {
  const base = join(root, '.tooling/test-fixtures'); mkdirSync(base, { recursive: true });
  const path = mkdtempSync(join(base, 'remilo-tooling-'));
  return Promise.resolve().then(() => work(path)).finally(() => {
    assert.ok(resolve(path).startsWith(resolve(base) + sep)); rmSync(path, { recursive: true, force: true });
  });
};
test('discovery keeps unauthorized/offline transports and ignores ADB headings', () => {
  assert.deepEqual(parseDevices('List of devices attached\nphone\tunauthorized usb:1\nemulator-5554 device model:test\nremote:5555 offline\n'), [
    { serial: 'phone', state: 'unauthorized', description: 'usb:1' }, { serial: 'emulator-5554', state: 'device', description: 'model:test' }, { serial: 'remote:5555', state: 'offline', description: '' }]);
});
test('selection rejects no target and ambiguous targets, including unauthorized companions', () => {
  assert.throws(() => selectDevice([]), { code: 'NO_DEVICE' });
  assert.throws(() => selectDevice([device, { serial: 'other', state: 'unauthorized' }]), { code: 'MULTIPLE_DEVICES' });
});
test('explicit serial takes precedence over environment; state failures are actionable', () => {
  const devices = [device, { serial: 'emulator', state: 'device' }];
  assert.equal(selectDevice(devices, 'pixel', 'emulator').serial, 'pixel');
  assert.equal(selectDevice(devices, undefined, 'emulator').serial, 'emulator');
  for (const state of ['unauthorized', 'offline']) assert.throws(() => selectDevice([{ serial: 'p', state }]), { code: 'DEVICE_NOT_READY' });
  assert.throws(() => selectDevice(devices, 'missing'), { code: 'DEVICE_NOT_FOUND' });
});
test('device API/ABI selection supports phones and x86-64 emulators', () => {
  assert.equal(deviceAbi(device), 'arm64-v8a');
  assert.equal(deviceAbi({ api: 34, abis: ['x86_64', 'x86'] }), 'x86_64');
  assert.throws(() => deviceAbi({ api: 33, abis: ['arm64-v8a'] }), { code: 'DEVICE_API' });
  assert.throws(() => deviceAbi({ api: 35, abis: ['armeabi-v7a'] }), { code: 'DEVICE_ABI' });
});
test('actual APK metadata is parsed including debug flags and native ABI', () => {
  const actual = parseBadging("package: name='com.remilo.app' versionCode='4' versionName='0.4.0'\nsdkVersion:'34'\ntargetSdkVersion:'36'\nnative-code: 'x86_64'\nlaunchable-activity: name='com.remilo.app.MainActivity'\napplication-debuggable\n");
  assert.equal(actual.versionCode, 4); assert.deepEqual(actual.abis, ['x86_64']); assert.equal(actual.debuggable, true);
  assert.throws(() => validateApk(actual, 'x86_64'), { code: 'APK_UNSIGNED' });
});
for (const [name, change, code] of [
  ['unsigned', { signed: false }, 'APK_UNSIGNED'], ['wrong package', { package: 'other.app' }, 'APK_PACKAGE'],
  ['debuggable', { debuggable: true }, 'APK_CONFIGURATION'], ['incompatible ABI', { abis: ['x86_64'] }, 'APK_ABI'],
  ['missing bundle', { bundledJs: false }, 'APK_CONFIGURATION'],
]) test(`deployment rejects ${name} without installing`, async () => {
  const { deps, calls } = setup({ build: async () => ({ ...receipt, apk: { ...receipt.apk, metadata: { ...metadata, ...change } } }) });
  const result = await deployWorkflow({}, deps);
  assert.equal(result.error.code, code); assert.equal(result.installation, 'not_attempted'); assert.equal(calls.length, 0);
});
test('update refuses signer mismatch and downgrade; never clears data', () => {
  assert.throws(() => validateUpdate(metadata, { ...metadata, signers: ['different'] }), { code: 'SIGNATURE_CONFLICT' });
  assert.throws(() => validateUpdate(metadata, { ...metadata, versionCode: 5 }), { code: 'DOWNGRADE' });
  validateUpdate(metadata, null); validateUpdate(metadata, metadata);
  assert.deepEqual(installArguments('p', 'a path/app.apk'), ['-s', 'p', 'install', '-r', '--user', '0', 'a path/app.apk']);
});
test('default deploy builds, updates and verifies without opening the app', async () => {
  const { deps, calls } = setup(); const result = await deployWorkflow({}, deps);
  assert.equal(result.ok, true); assert.equal(result.phase, 'installed_verified'); assert.equal(result.launched, false);
  assert.deepEqual(calls, [['build', 'arm64-v8a'], ['install', 'pixel', receipt.apk.path]]);
});
test('an x86-64 target selects an x86-64 build and keeps the selected serial', async () => {
  const { deps, calls } = setup({ target: async () => ({ ...device, serial: 'emulator', abis: ['x86_64'] }),
    build: async (abi) => { calls.push(['build', abi]); return { ...receipt, apk: { ...receipt.apk, metadata: { ...metadata, abis: ['x86_64'] } } }; } });
  assert.equal((await deployWorkflow({}, deps)).ok, true);
  assert.deepEqual(calls, [['build', 'x86_64'], ['install', 'emulator', receipt.apk.path]]);
});
test('optional launch happens after verified installation without force-stop', async () => {
  const { deps, calls } = setup(); const result = await deployWorkflow({ launch: true }, deps);
  assert.equal(result.launched, true); assert.equal(calls.at(-1)[0], 'launch');
  assert.deepEqual(launchArguments('p', metadata.launcher), ['-s', 'p', 'shell', 'am', 'start', '--user', '0', '-n', 'com.remilo.app/com.remilo.app.MainActivity']);
});
test('build failure and missing signing stop before installation', async () => {
  for (const stage of ['preflight', 'build']) {
    const { deps, calls } = setup({ [stage]: async () => { throw new WorkflowError(stage === 'preflight' ? 'SIGNING_MISSING' : 'PROCESS_FAILED', 'failed'); } });
    const result = await deployWorkflow({}, deps);
    assert.equal(result.ok, false); assert.equal(result.installation, 'not_attempted'); assert.equal(calls.length, 0);
  }
});
test('successful install with failed post-check remains installed but unverified', async () => {
  const { deps } = setup({ hash: async () => 'wrong-hash' }); const result = await deployWorkflow({}, deps);
  assert.equal(result.ok, false); assert.equal(result.phase, 'installed_unverified'); assert.equal(result.installation, 'completed'); assert.equal(result.verification, 'failed');
});
test('cancelled installation is uncertain and is never automatically retried', async () => {
  let attempts = 0;
  const { deps } = setup({ install: async () => { attempts++; throw new WorkflowError('CANCELLED', 'interrupted'); } });
  const result = await deployWorkflow({}, deps);
  assert.equal(result.phase, 'installation_failed_or_uncertain'); assert.equal(attempts, 1);
});
test('launch failure preserves the successfully verified installation', async () => {
  const { deps } = setup({ launch: async () => { throw new Error('locked'); } });
  const result = await deployWorkflow({ launch: true }, deps);
  assert.equal(result.phase, 'installed_verified_launch_failed'); assert.equal(result.verification, 'passed');
});
test('dry-run performs no build, install, launch or installed APK pull', async () => {
  const { deps, calls } = setup({ installed: async () => { throw new Error('must not pull'); } });
  const result = await deployWorkflow({ 'dry-run': true, launch: true }, deps);
  assert.equal(result.ok, true); assert.equal(result.phase, 'dry_run'); assert.deepEqual(calls, []);
});
test('install-only skips building and reports differing current inputs', async () => {
  const { deps, calls } = setup({ snapshot: async () => ({ ...source, inputSha256: 'new' }) });
  const result = await deployWorkflow({ 'install-only': true }, deps);
  assert.equal(result.currentInputsDiffer, true); assert.deepEqual(calls, [['install', 'pixel', receipt.apk.path]]);
});
test('missing/stale receipts and source races cannot establish provenance', () => {
  assert.throws(() => validateReceipt(null, 'hash'), { code: 'RECEIPT_MISSING' });
  assert.throws(() => validateReceipt(receipt, 'different'), { code: 'RECEIPT_STALE' });
  assertStable(source, source);
  assert.throws(() => assertStable(source, { ...source, inputSha256: 'different' }), { code: 'SOURCE_CHANGED' });
  assert.throws(() => assertStable(source, { ...source, commit: 'different' }), { code: 'SOURCE_CHANGED' });
});
test('install-only rejects a missing receipt before contacting the installed package', async () => {
  const { deps, calls } = setup({ existing: async () => { throw new WorkflowError('RECEIPT_MISSING', 'missing'); },
    installed: async () => { throw new Error('must not inspect'); } });
  assert.equal((await deployWorkflow({ 'install-only': true }, deps)).error.code, 'RECEIPT_MISSING');
  assert.deepEqual(calls, []);
});
test('ADB failures include storage remedies and launch errors with exit zero are failures', () => {
  assert.throws(() => confirmInstallation({ status: 1, stdout: '', stderr: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]' }), { code: 'INSTALL_FAILED_INSUFFICIENT_STORAGE' });
  assert.throws(() => confirmInstallation({ status: 0, stdout: 'streaming', stderr: '' }), { code: 'INSTALL_FAILED' });
  confirmInstallation({ status: 0, stdout: 'Success\n', stderr: '' });
  assert.throws(() => confirmLaunch({ status: 0, stdout: 'Error: Activity class does not exist.', stderr: '' }), { code: 'LAUNCH_FAILED' });
});
test('signing preflight never replaces missing keys', () => temporary((directory) => {
  assert.throws(() => checkSigning(directory), { code: 'SIGNING_MISSING' }); assert.equal(existsSync(join(directory, 'android/signing.properties')), false);
}));
test('release lock excludes concurrent writers and recovers after a handled failure', () => temporary(async (directory) => {
  await assert.rejects(withReleaseLock(async () => {
    await assert.rejects(withReleaseLock(async () => {}, directory), { code: 'BUILD_BUSY' }); throw new Error('failure');
  }, directory), /failure/);
  await withReleaseLock(async () => {}, directory); assert.equal(existsSync(join(directory, 'release.lock')), false);
}));
test('unconfirmed build-tree termination retains the release lock', () => temporary(async (directory) => {
  await assert.rejects(withReleaseLock(async () => { throw new WorkflowError('CANCELLED', 'uncertain', { retainReleaseLock: true }); }, directory), { code: 'CANCELLED' });
  assert.equal(existsSync(join(directory, 'release.lock')), true);
  await assert.rejects(withReleaseLock(async () => {}, directory), { code: 'BUILD_BUSY' });
}));
test('atomic receipts retain hashes and paths containing spaces', () => temporary((directory) => {
  const path = join(directory, 'receipt with spaces.json'); writeJson(path, receipt);
  assert.deepEqual(readJson(path), receipt); assert.equal(fileHash(path).length, 64);
}));
test('argument passing preserves spaces and shell metacharacters as data', async () => {
  const value = 'folder with spaces & $thing/app.apk';
  const result = await execute(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value]);
  assert.equal(result.status, 0); assert.equal(result.stdout, value);
});
test('process timeout terminates its own child and returns a timeout error', async () => {
  await assert.rejects(execute(process.execPath, ['-e', 'setTimeout(()=>{},1500)'], { timeout: 200 }), { code: 'TIMEOUT' });
});
test('process cancellation is handled without claiming successful execution', async () => {
  const url = pathToFileURL(join(root, 'scripts/tools.mjs')).href;
  const program = `import {execute} from ${JSON.stringify(url)}; setTimeout(()=>process.emit('SIGINT'),250); try { await execute(process.execPath,['-e','setTimeout(()=>{},1500)'],{timeout:5000}); } catch(e) { process.stdout.write(e.code); }`;
  const result = await execute(process.execPath, ['--input-type=module', '-e', program]); assert.equal(result.stdout, 'CANCELLED');
});
test('logs span process restarts through Remilo tag filtering and never clear buffers', () => {
  assert.deepEqual(logArguments('p'), ['-s', 'p', 'logcat', '-v', 'threadtime', '-d', '-t', '2000', 'Remilo:I', '*:S']);
  assert.deepEqual(logArguments('p', true), ['-s', 'p', 'logcat', '-v', 'threadtime', 'Remilo:I', '*:S']);
});
test('preview variables are child-only and stripped from release environments', () => {
  const base = { PATH: 'test', REMILO_UI_PREVIEW: 'unexpected', EXPO_NO_WEB_SETUP: '1' };
  assert.equal(previewEnvironment(base).REMILO_UI_PREVIEW, '1'); assert.equal(base.REMILO_UI_PREVIEW, 'unexpected');
  assert.equal(previewEnvironment(base).CI, undefined);
  assert.equal(buildEnvironment(base).REMILO_UI_PREVIEW, undefined); assert.equal(buildEnvironment(base).EXPO_NO_WEB_SETUP, undefined);
});
test('build fingerprint notices uncommitted source but excludes documentation changes', () => temporary(async (directory) => {
  const git = (...args) => { const r = spawnSync('git', args, { cwd: directory, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init'); writeFileSync(join(directory, 'app.json'), '{}'); git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
  const initial = await sourceSnapshot(directory); writeFileSync(join(directory, 'README.md'), 'doc');
  assert.equal((await sourceSnapshot(directory)).inputSha256, initial.inputSha256);
  writeFileSync(join(directory, 'app.json'), '{"changed":true}');
  const updated = await sourceSnapshot(directory); assert.equal(updated.dirty, true); assert.notEqual(updated.inputSha256, initial.inputSha256);
}));
