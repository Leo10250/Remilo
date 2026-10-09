import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
function fixture() {
  let active = false, held = false, displayed, error;
  const module = { exports: {} };
  const result = ts.transpileModule(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/confirmation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(result.outputText, { module, exports: module.exports, require: (name) => {
    if (name === 'react') return { useCallback: (callback) => callback, useState: () => [active, (value) => { active = value; }] };
    if (name === './theme') return { useAppearanceHold: (value) => { held = value; } };
    if (name === 'react-native') return { Alert: { alert: (...args) => { if (error) throw error; displayed = args; } } };
    throw new Error('Unexpected confirmation dependency: ' + name);
  } });
  return { render: () => module.exports.useAppearanceConfirmation(), isHeld: () => held, displayed: () => displayed, fail: (value) => { error = value; } };
}

test('native confirmations retain appearance and release it on every labeled choice', () => {
  const view = fixture();
  let cancelled = 0, accepted = 0;
  const confirm = view.render();
  confirm('Remove list?', 'Reminders move to No list.', [{ text: 'Cancel', style: 'cancel', onPress: () => cancelled++ }, { text: 'Remove', style: 'destructive', onPress: () => accepted++ }]);
  view.render(); assert.equal(view.isHeld(), true);
  const [, , buttons] = view.displayed();
  assert.equal(buttons[0].style, 'cancel'); assert.equal(buttons[1].style, 'destructive');
  buttons[0].onPress(); view.render(); assert.equal(view.isHeld(), false); assert.equal(cancelled, 1); assert.equal(accepted, 0);
  confirm('Remove?', undefined, [{ text: 'Remove', onPress: () => accepted++ }]); view.render(); assert.equal(view.isHeld(), true);
  view.displayed()[2][0].onPress(); view.render(); assert.equal(view.isHeld(), false); assert.equal(accepted, 1);
});

test('native dismissal retains caller options and releases the appearance hold', () => {
  const view = fixture(); let dismissed = 0;
  view.render()('Confirm', undefined, undefined, { cancelable: true, onDismiss: () => dismissed++ });
  view.render(); assert.equal(view.isHeld(), true);
  const options = view.displayed()[3]; assert.equal(options.cancelable, true);
  options.onDismiss(); view.render(); assert.equal(view.isHeld(), false); assert.equal(dismissed, 1);
});

test('default acknowledgement and presenter errors cannot leave appearance held', () => {
  const view = fixture(), confirm = view.render();
  confirm('Change not confirmed'); view.render(); assert.equal(view.isHeld(), true);
  assert.equal(view.displayed()[2][0].text, 'OK'); view.displayed()[2][0].onPress(); view.render(); assert.equal(view.isHeld(), false);
  const error = new Error('Native presenter unavailable'); view.fail(error);
  assert.throws(() => confirm('Confirm'), (received) => received === error); view.render(); assert.equal(view.isHeld(), false);
});
