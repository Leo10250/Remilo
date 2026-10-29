import test from 'node:test';
import assert from 'node:assert/strict';
import { composeReportMarker, parseComposeClasspathReport, verifyComposeClasspath, runComposeAlignedRelease } from '../lib/compose-classpath.mjs';

// Shape emitted from Gradle ResolutionResult, including selected Android variants.
const row = (family, name, version) => ({ group: 'androidx.compose.' + family, name, version });
const components = () => [row('material3', 'material3', '1.5.0-alpha17'), row('material3', 'material3-android', '1.5.0-alpha17'), row('ui', 'ui', '1.11.0-beta02'), row('ui', 'ui-android', '1.11.0-beta02'), row('foundation', 'foundation-android', '1.11.0-beta02'), row('runtime', 'runtime-android', '1.11.0-beta02')];
function report(native = components(), runtime = components()) {
  return { schemaVersion: 1, nativeCompile: { project: ':remilo-alarm', configuration: 'releaseCompileClasspath', components: native }, appRuntime: { project: ':app', configuration: 'releaseRuntimeClasspath', components: runtime } };
}
const output = value => 'Gradle configuration output\n' + composeReportMarker + JSON.stringify(value) + '\nBUILD SUCCESSFUL\n';
test('parses the actual report envelope and accepts equal selected Compose coordinates', () => {
  const parsed = parseComposeClasspathReport(output(report()).replaceAll('\n', '\r\n'));
  assert.equal(parsed.nativeCompile.get('androidx.compose.material3:material3-android'), '1.5.0-alpha17');
  assert.deepEqual(verifyComposeClasspath(output(report())), { nativeCompileComponents: 6, appRuntimeComponents: 6 });
});
test('rejects the observed old native Material3 ABI against the SDK57 app graph before assembly', async () => {
  const native = components().map(item => item.group.endsWith('.material3') ? { ...item, version: '1.3.2' } : item);
  let assemblies = 0;
  await assert.rejects(runComposeAlignedRelease({ report: async () => output(report(native)), assemble: async () => { assemblies++; } }), error => error.code === 'COMPOSE_CLASSPATH_MISMATCH' && /material3-android: native compile 1.3.2; app runtime 1.5.0-alpha17/.test(error.message));
  assert.equal(assemblies, 0);
});
test('checks Android variants even if their facade versions agree, plus UI/foundation/runtime drift', () => {
  for (const index of [1, 3, 4, 5]) {
    const runtime = components().map((item, position) => position === index ? { ...item, version: '9.0.0' } : item);
    assert.throws(() => verifyComposeClasspath(output(report(components(), runtime))), { code: 'COMPOSE_CLASSPATH_MISMATCH' });
  }
});
test('rejects a native compile component absent from the packaged app without requiring identical unrelated runtime extras', () => {
  assert.throws(() => verifyComposeClasspath(output(report(components(), components().filter(item => item.name !== 'ui-android')))), error => error.code === 'COMPOSE_CLASSPATH_MISMATCH' && /ui-android:.*runtime missing/.test(error.message));
  const runtime = [...components(), row('ui', 'ui-tooling-preview-android', '1.11.0-beta02')];
  assert.deepEqual(verifyComposeClasspath(output(report(components(), runtime))), { nativeCompileComponents: 6, appRuntimeComponents: 7 });
});
test('fails closed on absent, duplicated, oversized, malformed or wrongly scoped reports', () => {
  const valid = report();
  for (const value of ['', 'BUILD SUCCESSFUL', composeReportMarker + '{', output(valid) + output(valid), composeReportMarker + ' '.repeat(262145), output({ ...valid, schemaVersion: 2 }), output({ ...valid, nativeCompile: { ...valid.nativeCompile, configuration: 'debugCompileClasspath' } }), output({ ...valid, appRuntime: { ...valid.appRuntime, project: ':different-app' } }), output(report([], [])), output(report(components().filter(item => !item.group.endsWith('.runtime'))))]) {
    assert.throws(() => verifyComposeClasspath(value), { code: 'COMPOSE_REPORT_INVALID' });
  }
});
test('rejects duplicate/unsafe component coordinates and bounds component counts', () => {
  for (const native of [[...components(), components()[0]], [...components(), row('ui', 'unsafe\nmodule', '1.0.0')], [...components(), row('unknown', 'ui', '1.0.0')], [...components(), row('ui', 'new-ui', 'private\npayload')], Array.from({ length: 257 }, (_, index) => row('ui', 'ui-' + index, '1.0.0'))]) {
    assert.throws(() => verifyComposeClasspath(output(report(native))), { code: 'COMPOSE_REPORT_INVALID' });
  }
});
test('runs assembly only after a fresh valid resolved report and propagates report/assembly failures', async () => {
  const calls = [];
  const alignment = await runComposeAlignedRelease({ report: async () => { calls.push('report'); return output(report()); }, assemble: async () => { calls.push('assemble'); } });
  assert.deepEqual(calls, ['report', 'assemble']); assert.equal(alignment.nativeCompileComponents, 6);
  let assemblies = 0;
  await assert.rejects(runComposeAlignedRelease({ report: async () => { throw new Error('resolution failed'); }, assemble: async () => { assemblies++; } }), /resolution failed/);
  await assert.rejects(runComposeAlignedRelease({ report: async () => 'stale missing report', assemble: async () => { assemblies++; } }), { code: 'COMPOSE_REPORT_INVALID' });
  assert.equal(assemblies, 0);
  await assert.rejects(runComposeAlignedRelease({ report: async () => output(report()), assemble: async () => { throw new Error('assembly failed'); } }), /assembly failed/);
});
