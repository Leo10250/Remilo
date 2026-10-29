import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareWorkflow } from '../prepare.mjs';
import { inspectDevice } from '../device.mjs';

const build = { builtAt: '2026-10-29T00:00:00Z', apk: { path: 'fixture.apk', metadata: { signed: true } } };
const checks = [{ command: 'fixture', result: 'passed', completedAt: build.builtAt }];
test('release preparation checks signing, verifies and assembles without installing or inventing observations', async () => {
  const calls = [];
  const summary = await prepareWorkflow('release', { abi: 'x86_64', json: true }, {
    signing: () => calls.push('signing'), shared: async flags => { calls.push(['shared', flags]); return checks; },
    assemble: async flags => { calls.push(['assemble', flags]); return build; }, now: () => 'captured',
  });
  assert.deepEqual(calls, ['signing', ['shared', { json: true }], ['assemble', { abi: 'x86_64', verify: true, requireSigning: true, json: true }]]);
  assert.deepEqual(summary, { schemaVersion: 3, ok: true, preparedAt: 'captured', build,
    checks: [...checks, { command: 'Android unit tests, module/app lint, release assembly', result: 'passed', completedAt: build.builtAt }], installed: false, published: false });
  assert.equal(checks.length, 1);
});
test('missing signing stops preparation before checks or assembly', async () => {
  await assert.rejects(prepareWorkflow('release', {}, {
    signing: () => { throw new Error('missing key'); }, shared: () => assert.fail('checks must not run'), assemble: () => assert.fail('build must not run'),
  }), /missing key/);
});
test('ordinary combined verification does not demand signing and failed checks prevent assembly', async () => {
  await assert.rejects(prepareWorkflow('verify', {}, {
    signing: () => assert.fail('no signing precondition'), shared: async () => { throw new Error('check failed'); }, assemble: () => assert.fail('build must not run'),
  }), /check failed/);
  await assert.rejects(prepareWorkflow('unsupported', {}), /Expected verify or release/);
});

function deviceDependencies(overrides = {}) {
  return { tools: () => 'tools', target: async (tools, serial) => { assert.equal(tools, 'tools'); assert.equal(serial, 'chosen'); return { serial }; },
    localRelease: () => 'local.apk', hash: path => { assert.equal(path, 'local.apk'); return 'same'; },
    installed: async (tools, serial) => { assert.equal(tools, 'tools'); assert.equal(serial, 'chosen'); return 'same'; },
    now: () => 'captured', ...overrides };
}
test('APK comparison reports matching bytes and no unrelated acceptance state', async () => {
  assert.deepEqual(await inspectDevice({ device: 'chosen' }, deviceDependencies()), {
    schemaVersion: 3, capturedAt: 'captured', ok: true, device: { serial: 'chosen' }, localApk: { path: 'local.apk', sha256: 'same' },
    installedApk: { sha256: 'same' }, comparison: 'match',
  });
});
test('missing/different APKs remain successful diagnostics', async () => {
  const missing = await inspectDevice({ device: 'chosen' }, deviceDependencies({ localRelease: () => { throw Object.assign(new Error('absent'), { code: 'APK_MISSING' }); } }));
  assert.equal(missing.ok, true); assert.equal(missing.localApk, null); assert.equal(missing.comparison, 'local_missing');
  const different = await inspectDevice({ device: 'chosen' }, deviceDependencies({ installed: async () => 'different' }));
  assert.equal(different.ok, true); assert.equal(different.comparison, 'different');
});
test('inspection errors remain failures rather than successful diagnostics', async () => {
  const failed = await inspectDevice({ device: 'chosen' }, deviceDependencies({ installed: async () => { throw Object.assign(new Error('inspection failed'), { code: 'ADB' }); } }));
  assert.equal(failed.ok, false); assert.deepEqual(failed.error, { code: 'ADB', message: 'inspection failed' });
  const malformed = await inspectDevice({ device: 'chosen' }, deviceDependencies({ localRelease: () => { throw Object.assign(new Error('ambiguous APK'), { code: 'BUILD_ARTIFACT' }); } }));
  assert.equal(malformed.ok, false); assert.equal(malformed.error.code, 'BUILD_ARTIFACT');
});
