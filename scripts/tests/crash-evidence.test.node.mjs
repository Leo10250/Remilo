import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRemiloCrashes, crashLogArguments, extractRemiloCrashes, validateEvidenceLogOptions } from '../lib/crash-evidence.mjs';

const line = (pid, message, tag = 'AndroidRuntime') => `10-29 10:20:30.456  ${pid}  ${pid} E ${tag}: ${message}`;
const crash = (pid, name, detail) => [line(pid, 'FATAL EXCEPTION: main'), line(pid, `Process: ${name}, PID: ${pid}`), line(pid, detail)];
test('crash snapshot uses only bounded crash-buffer AndroidRuntime records and never clears or follows', () => {
  assert.deepEqual(crashLogArguments('phone'), ['-s', 'phone', 'logcat', '-b', 'crash', '-v', 'threadtime', '-d', '-t', '2000', 'AndroidRuntime:E', '*:S']);
  assert.throws(() => validateEvidenceLogOptions({ crashes: true, follow: true }), { code: 'ARGUMENT' });
  validateEvidenceLogOptions({ crashes: true }); validateEvidenceLogOptions({ follow: true });
});
test('extracts exact-package PID blocks across process restarts while excluding interleaved other apps', () => {
  const first = crash('123', 'com.remilo.app', 'java.lang.IllegalStateException: remilo failure');
  const other = crash('456', 'com.other.app', 'other private payload');
  const second = crash('789', 'com.remilo.app', 'Caused by: second remilo failure');
  const raw = [first[0], other[0], first[1], other[1], first[2], other[2], ...second].join('\r\n');
  const result = extractRemiloCrashes(raw);
  assert.equal(result.blocks, 2); assert.equal(result.text, first.join('\n') + '\n\n' + second.join('\n') + '\n');
  assert.doesNotMatch(result.text, /com.other|other private/);
});
test('excludes prefix/suffix/subprocess package matches, missing identity and mismatched process PID', () => {
  for (const name of ['com.remilo.app.other', 'com.remilo.application', 'xcom.remilo.app', 'com.remilo.app:worker']) {
    assert.deepEqual(extractRemiloCrashes(crash('1', name, 'private').join('\n')), { blocks: 0, text: '' });
  }
  assert.equal(extractRemiloCrashes([line('1', 'FATAL EXCEPTION: main'), line('1', 'unclassified payload')].join('\n')).text, '');
  assert.equal(extractRemiloCrashes([line('1', 'Process: com.remilo.app, PID: 2'), line('1', 'mismatched payload')].join('\n')).text, '');
});
test('handles a clipped matching header and PID reuse without carrying other-app records', () => {
  const raw = [line('1', 'Process: com.remilo.app, PID: 1'), line('1', 'remilo detail'), ...crash('1', 'com.other.app', 'other detail'), line('2', 'Process: com.remilo.app, PID: 2'), line('2', 'noise', 'OtherTag')].join('\n');
  const result = extractRemiloCrashes(raw);
  assert.equal(result.blocks, 2); assert.match(result.text, /remilo detail/); assert.doesNotMatch(result.text, /com.other|other detail|OtherTag|noise/);
});
test('persists only classified app output and reports empty snapshots truthfully', async () => {
  const persisted = [], calls = [];
  const result = await collectRemiloCrashes('phone', { run: async args => { calls.push(args); return { status: 0, stdout: [...crash('1', 'com.other.app', 'private'), ...crash('2', 'com.remilo.app', 'app failure')].join('\n'), stderr: 'private stderr' }; }, persist: text => persisted.push(text) });
  assert.equal(result.blocks, 1); assert.deepEqual(calls, [crashLogArguments('phone')]); assert.match(persisted[0], /app failure/); assert.doesNotMatch(persisted[0], /private|com.other/);
  assert.deepEqual(await collectRemiloCrashes('phone', { run: async () => ({ status: 0, stdout: 'unclassified', stderr: '' }), persist: text => persisted.push(text) }), { blocks: 0 });
  assert.equal(persisted[1], '');
});
test('unsupported or failed reads never persist or echo any raw buffer/exception contents', async () => {
  for (const run of [async () => ({ status: 1, stdout: 'other private stdout', stderr: 'other private stderr' }), async () => { throw new Error('private raw exception'); }]) {
    let writes = 0;
    await assert.rejects(collectRemiloCrashes('phone', { run, persist: () => { writes++; } }), error => error.code === 'CRASH_LOG_FAILED' && !/private|stdout|stderr/.test(error.message));
    assert.equal(writes, 0);
  }
});

test('CLI rejects crash follow/capture combinations before contacting tools and documents the opt-in', async () => {
  const { execute, root } = await import('../tools.mjs');
  const { join } = await import('node:path');
  const script = join(root, 'scripts/device-evidence.mjs');
  for (const args of [['logs', '--follow', '--crashes'], ['capture', '--crashes']]) {
    const result = await execute(process.execPath, [script, ...args]);
    assert.equal(result.status, 1); assert.match(result.stderr, /ARGUMENT:/);
    assert.doesNotMatch(result.stdout + result.stderr, /SDK_MISSING|NO_DEVICE|MULTIPLE_DEVICES|DEVICE_NOT_FOUND|adb failed/);
  }
  const help = await execute(process.execPath, [script, 'logs', '--help']);
  assert.equal(help.status, 0); assert.match(help.stdout, /--crashes/); assert.match(help.stdout, /exact com\.remilo\.app/);
});
