import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, execute, WorkflowError } from '../tools.mjs';
import { selectDevice, parseDevices, deviceAbi, parseInstalledPath, compareApkHashes } from '../lib/devices.mjs';
import { parseBadging, validateApk, checkSigning } from '../lib/android-tools.mjs';
import { deployWorkflow, installArguments, launchArguments, logArguments, confirmInstallation, confirmLaunch } from '../lib/deployment.mjs';
import { buildEnvironment, releaseApkPath } from '../lib/build.mjs';
import { writeJson } from '../lib/files.mjs';
import { previewEnvironment } from '../preview-ui.mjs';

const metadata = { package: 'com.remilo.app', versionCode: 4, versionName: '0.4.0', minSdk: 34, targetSdk: 36, abis: ['arm64-v8a'], debuggable: false, bundledJs: true, launcher: 'com.remilo.app.MainActivity', signed: true, signers: ['certificate'] };
const build = { builtAt: '2026-10-05T00:00:00.000Z', variant: 'release', abi: 'arm64-v8a', apk: { path: 'folder with spaces/app.apk', metadata } };
const device = { serial: 'pixel', state: 'device', model: 'Pixel', android: '17', api: 37, abis: ['arm64-v8a'] };
function setup(overrides = {}) {
  const calls = [];
  const deps = {
    preflight: async () => {}, target: async () => device,
    build: async (abi) => { calls.push(['build', abi]); return build; },
    install: async (...args) => { calls.push(['install', ...args]); },
    launch: async (...args) => { calls.push(['launch', ...args]); }, ...overrides,
  };
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
test('installed APK inspection accepts Android randomized directories and CRLF output', () => {
  const path = '/data/app/~~fixture_123==/com.remilo.app-fixture-456==/base.apk';
  assert.equal(parseInstalledPath(`package:${path}\r\n`), path);
  assert.equal(parseInstalledPath('package:/data/app/com.remilo.app-123/base.apk\n'), '/data/app/com.remilo.app-123/base.apk');
});
test('installed APK inspection rejects absent, split and unsafe paths', () => {
  for (const output of ['', 'package:/data/app/app/base.apk\npackage:/data/app/app/split.apk\n',
    'package:data/app/app/base.apk\n', 'package:/data/app/app/split.apk\n',
    'package:/data/app/app;echo/base.apk\n', 'package:/data/app/app$(echo)/base.apk\n',
    'package:/data/app/app with spaces/base.apk\n']) {
    assert.throws(() => parseInstalledPath(output), { code: 'INSTALLED_INSPECTION' });
  }
});
test('optional APK comparison needs no receipt and distinguishes unavailable data', () => {
  assert.equal(compareApkHashes(null, null), 'unavailable');
  assert.equal(compareApkHashes(null, 'installed'), 'local_missing');
  assert.equal(compareApkHashes('local', null), 'not_installed');
  assert.equal(compareApkHashes('same', 'same'), 'match');
  assert.equal(compareApkHashes('local', 'installed'), 'different');
});
test('selection rejects no target and ambiguous targets, including unauthorized companions', () => {
  assert.throws(() => selectDevice([]), { code: 'NO_DEVICE' });
  assert.throws(() => selectDevice([device, { serial: 'other', state: 'unauthorized' }]), { code: 'MULTIPLE_DEVICES' });
});
test('explicit serial takes precedence over environment; state failures are actionable', () => {
  const devices = [device, { serial: 'emulator', state: 'device' }];
  assert.equal(selectDevice(devices, 'pixel', 'emulator').serial, 'pixel');
  assert.equal(selectDevice(devices, undefined, 'emulator').serial, 'emulator');
  assert.equal(selectDevice([device]).serial, 'pixel');
  assert.throws(() => selectDevice([{ serial: 'p', state: 'unauthorized' }]), /approve.*USB debugging/);
  assert.throws(() => selectDevice([{ serial: 'p', state: 'offline' }]), /offline.*Reconnect/);
  assert.throws(() => selectDevice(devices, 'missing'), { code: 'DEVICE_NOT_FOUND' });
});
test('device API/ABI selection supports phones and x86-64 emulators', () => {
  assert.equal(deviceAbi(device), 'arm64-v8a');
  assert.equal(deviceAbi({ api: 34, abis: ['x86_64', 'x86'] }), 'x86_64');
  assert.throws(() => deviceAbi({ api: 33, abis: ['arm64-v8a'] }), { code: 'DEVICE_API' });
  assert.throws(() => deviceAbi({ api: 35, abis: ['armeabi-v7a'] }), { code: 'DEVICE_ABI' });
});
test('unsupported API and ABI stop deployment before building', async () => {
  for (const [target, code] of [[{ ...device, api: 33 }, 'DEVICE_API'], [{ ...device, abis: ['x86'] }, 'DEVICE_ABI']]) {
    const { deps, calls } = setup({ target: async () => target });
    const result = await deployWorkflow({}, deps);
    assert.equal(result.error.code, code); assert.equal(result.installed, false); assert.deepEqual(calls, []);
  }
});
test('actual APK metadata is parsed including debug flags and native ABI', () => {
  const actual = parseBadging("package: name='com.remilo.app' versionCode='4' versionName='0.4.0'\nsdkVersion:'34'\ntargetSdkVersion:'36'\nnative-code: 'x86_64'\nlaunchable-activity: name='com.remilo.app.MainActivity'\napplication-debuggable\n");
  assert.equal(actual.versionCode, 4); assert.deepEqual(actual.abis, ['x86_64']); assert.equal(actual.debuggable, true);
  assert.throws(() => validateApk(actual, 'x86_64'), { code: 'APK_UNSIGNED' });
});
for (const [name, change, code] of [
  ['unsigned', { signed: false }, 'APK_UNSIGNED'], ['wrong package', { package: 'other.app' }, 'APK_PACKAGE'],
  ['debuggable', { debuggable: true }, 'APK_CONFIGURATION'], ['incompatible ABI', { abis: ['x86_64'] }, 'APK_ABI'],
  ['missing bundle', { bundledJs: false }, 'APK_CONFIGURATION'], ['wrong version', { versionCode: 3 }, 'APK_VERSION'],
]) test(`shared build artifact validation rejects ${name} before installation`, async () => {
  const { deps, calls } = setup({ build: async (abi) => {
    // This is the shared build boundary: deployment accepts only validated artifacts.
    validateApk({ ...metadata, ...change }, abi, metadata);
    return build;
  } });
  const result = await deployWorkflow({}, deps);
  assert.equal(result.error.code, code); assert.equal(result.installed, false);
  assert.equal(result.installationAttempted, undefined); assert.deepEqual(calls, []);
});
test('default deployment builds and installs without Git, receipts or opening the app', async () => {
  const { deps, calls } = setup();
  // There are deliberately no provenance, receipt, installed-inspection or hash dependencies.
  const result = await deployWorkflow({}, deps);
  assert.equal(result.ok, true); assert.equal(result.installed, true); assert.equal(result.launched, false);
  assert.equal(result.installationAttempted, true);
  assert.deepEqual(calls, [['build', 'arm64-v8a'], ['install', 'pixel', build.apk.path]]);
});
test('x86-64 target selects its build and keeps the selected serial for install and launch', async () => {
  const { deps, calls } = setup({ target: async (requested) => {
    assert.equal(requested, 'emulator'); return { ...device, serial: requested, abis: ['x86_64'] };
  }, build: async (abi) => {
    calls.push(['build', abi]); return { ...build, abi, apk: { ...build.apk, metadata: { ...metadata, abis: ['x86_64'] } } };
  } });
  const result = await deployWorkflow({ device: 'emulator', launch: true }, deps);
  assert.equal(result.ok, true); assert.equal(result.launched, true);
  assert.deepEqual(calls, [['build', 'x86_64'], ['install', 'emulator', build.apk.path], ['launch', 'emulator', metadata.launcher]]);
});
test('installation arguments preserve app data and optional launch never force-stops', () => {
  assert.deepEqual(installArguments('p', 'a path/app.apk'), ['-s', 'p', 'install', '-r', '--user', '0', 'a path/app.apk']);
  assert.deepEqual(launchArguments('p', metadata.launcher), ['-s', 'p', 'shell', 'am', 'start', '--user', '0', '-n', 'com.remilo.app/com.remilo.app.MainActivity']);
});
test('build failure and missing signing stop before installation', async () => {
  for (const stage of ['preflight', 'build']) {
    const { deps, calls } = setup({ [stage]: async () => { throw new WorkflowError(stage === 'preflight' ? 'SIGNING_MISSING' : 'PROCESS_FAILED', 'failed'); } });
    const result = await deployWorkflow({}, deps);
    assert.equal(result.ok, false); assert.equal(result.installed, false);
    assert.equal(result.installationAttempted, undefined); assert.deepEqual(calls, []);
  }
});
test('cancellation at every deployment stage stops later stages and never retries', async () => {
  const stages = ['preflight', 'target', 'build', 'install', 'launch'];
  for (const cancelledStage of stages) {
    const calls = [];
    const deps = Object.fromEntries(stages.map((stage) => [stage, async () => {
      calls.push(stage);
      if (stage === cancelledStage) throw new WorkflowError('CANCELLED', 'interrupted');
      return stage === 'target' ? device : stage === 'build' ? build : undefined;
    }]));
    const result = await deployWorkflow({ launch: true }, deps);
    assert.equal(result.error.code, 'CANCELLED'); assert.equal(result.ok, false);
    assert.equal(result.installed, cancelledStage === 'launch'); assert.equal(result.launched, false);
    assert.equal(Boolean(result.installationAttempted), ['install', 'launch'].includes(cancelledStage));
    assert.deepEqual(calls, stages.slice(0, stages.indexOf(cancelledStage) + 1));
  }
});
test('installer failure is reported once without launching or claiming installation', async () => {
  let attempts = 0;
  const { deps, calls } = setup({ install: async () => {
    attempts++; confirmInstallation({ status: 1, stdout: '', stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]' });
  } });
  const result = await deployWorkflow({ launch: true }, deps);
  assert.equal(result.ok, false); assert.equal(result.installed, false); assert.equal(result.installationAttempted, true);
  assert.equal(result.error.code, 'INSTALL_FAILED_UPDATE_INCOMPATIBLE'); assert.equal(attempts, 1);
  assert.deepEqual(calls, [['build', 'arm64-v8a']]);
});
test('launch failure preserves the successfully completed installation', async () => {
  const { deps } = setup({ launch: async () => { throw new WorkflowError('LAUNCH_FAILED', 'locked'); } });
  const result = await deployWorkflow({ launch: true }, deps);
  assert.equal(result.ok, false); assert.equal(result.installed, true); assert.equal(result.launched, false);
  assert.equal(result.error.code, 'LAUNCH_FAILED');
});
test('ADB installation failures retain useful storage, signer and downgrade remedies', () => {
  for (const [code, remedy] of [
    ['INSTALL_FAILED_INSUFFICIENT_STORAGE', /Free storage/],
    ['INSTALL_FAILED_UPDATE_INCOMPATIBLE', /signing key.*Do not uninstall or clear/],
    ['INSTALL_FAILED_VERSION_DOWNGRADE', /higher versionCode.*downgrade flags/],
  ]) {
    assert.throws(() => confirmInstallation({ status: 1, stdout: '', stderr: `Failure [${code}]` }), (error) => error.code === code && remedy.test(error.message));
  }
  assert.throws(() => confirmInstallation({ status: 0, stdout: 'streaming', stderr: '' }), { code: 'INSTALL_FAILED' });
  confirmInstallation({ status: 0, stdout: 'Success\n', stderr: '' });
  assert.throws(() => confirmLaunch({ status: 0, stdout: 'Error: Activity class does not exist.', stderr: '' }), { code: 'LAUNCH_FAILED' });
});
test('signing preflight never replaces missing keys', () => temporary((directory) => {
  assert.throws(() => checkSigning(directory), { code: 'SIGNING_MISSING' }); assert.equal(existsSync(join(directory, 'android/signing.properties')), false);
}));
test('release output resolves one safe APK in a path with spaces without Git or receipts', () => temporary((directory) => {
  const workspace = join(directory, 'workspace with spaces');
  const outputs = join(workspace, 'android/app/build/outputs/apk/release');
  mkdirSync(outputs, { recursive: true });
  writeJson(join(outputs, 'output-metadata.json'), { elements: [{ outputFile: 'app-release.apk' }] });
  const apk = join(outputs, 'app-release.apk'); writeFileSync(apk, 'fixture');
  assert.equal(existsSync(join(workspace, '.git')), false);
  assert.equal(existsSync(join(workspace, 'verification/local/build-receipt.json')), false);
  assert.equal(releaseApkPath(workspace), apk);
}));
test('missing release metadata and missing APK give build guidance', () => temporary((directory) => {
  assert.throws(() => releaseApkPath(directory), { code: 'APK_MISSING' });
  const outputs = join(directory, 'android/app/build/outputs/apk/release');
  writeJson(join(outputs, 'output-metadata.json'), { elements: [{ outputFile: 'app-release.apk' }] });
  assert.throws(() => releaseApkPath(directory), { code: 'APK_MISSING' });
}));
test('release output rejects ambiguous outputs and unsafe filenames', () => temporary((directory) => {
  const path = join(directory, 'android/app/build/outputs/apk/release/output-metadata.json');
  for (const elements of [[], [{ outputFile: 'a.apk' }, { outputFile: 'b.apk' }], [{ outputFile: '../outside.apk' }],
    [{ outputFile: 'folder/app.apk' }], [{ outputFile: 'app with spaces.apk' }], [{ outputFile: 'app.apk;echo' }]]) {
    writeJson(path, { elements }); assert.throws(() => releaseApkPath(directory), { code: 'BUILD_ARTIFACT' });
  }
}));
test('deploy help does not inspect tools or contact a device', async () => {
  const result = await execute(process.execPath, [join(root, 'scripts/deploy.mjs'), '--help']);
  assert.equal(result.status, 0); assert.match(result.stdout, /--device SERIAL.*--launch/);
  assert.match(result.stdout, /Leave Remilo closed/); assert.doesNotMatch(result.stdout, /Installing|Building|Installed com/);
});
test('removed and unknown deploy flags reject before build or installation', async () => {
  for (const flag of ['--install-only', '--dry-run', '--json', '--unknown']) {
    const result = await execute(process.execPath, [join(root, 'scripts/deploy.mjs'), flag]);
    assert.equal(result.status, 1); assert.match(result.stdout + result.stderr, /ARGUMENT/);
    assert.match(result.stdout + result.stderr, /Unknown option/);
    assert.doesNotMatch(result.stdout + result.stderr, /Installing|Building|Installed com|SDK_MISSING|SIGNING_MISSING|NO_DEVICE/);
  }
});
test('missing and duplicate deploy device arguments reject before tool work', async () => {
  for (const args of [['--device'], ['--device', '--launch'], ['--device', 'pixel', '--device', 'other']]) {
    const result = await execute(process.execPath, [join(root, 'scripts/deploy.mjs'), ...args]);
    assert.equal(result.status, 1); assert.match(result.stderr, /ARGUMENT:/);
    assert.doesNotMatch(result.stdout + result.stderr, /Installing|Building|Installed com|SDK_MISSING|SIGNING_MISSING|NO_DEVICE/);
  }
});
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
