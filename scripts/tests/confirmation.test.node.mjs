import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
function localization() {
  const compile = (file, dependencies = {}) => {
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(path.resolve(import.meta.dirname, '../..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, { module, exports: module.exports, require: name => { assert.ok(name in dependencies); return dependencies[name]; } });
    return module.exports;
  };
  return compile('src/localization/index.ts', { './catalog.generated': compile('src/localization/catalog.generated.ts') });
}
function fixture() {
  let active = false, held = false, displayed, error;
  let cursor = 0, subscribed = false;
  const refs = [], language = localization();
  const module = { exports: {} };
  const result = ts.transpileModule(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/confirmation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(result.outputText, { module, exports: module.exports, require: (name) => {
    if (name === '../localization') return language;
    if (name === 'react') return { useCallback: (callback) => callback, useState: () => [active, (value) => { active = value; }], useRef: value => refs[cursor++] ??= { current: value }, useEffect: effect => { if (!subscribed) { subscribed = true; effect(); } } };
    if (name === './theme') return { useAppearanceHold: (value) => { held = value; } };
    if (name === 'react-native') return { Alert: { alert: (...args) => { if (error) throw error; displayed = args; } } };
    throw new Error('Unexpected confirmation dependency: ' + name);
  } });
  return { render: () => { cursor = 0; return module.exports.useAppearanceConfirmation(); }, language, isHeld: () => held, displayed: () => displayed, fail: (value) => { error = value; } };
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

test('language replacement preserves captured native choices and ignores the prior fragment dismissal', () => {
  const view = fixture(), confirm = view.render(); let accepted = 0, dismissed = 0;
  confirm(view.language.t('m_0c08198f562b'), view.language.t('remove_list_confirmation', { name: 'Personal 私人' }),
    [{ text: view.language.t('m_669f24b0f91d'), style: 'destructive', onPress: () => accepted++ }], { cancelable: true, onDismiss: () => dismissed++ });
  const former = view.displayed(); view.language.confirmLanguage('zh-Hans');
  const current = view.displayed();
  assert.match(current[0], /[\u4e00-\u9fff]/); assert.ok(current[1].includes('Personal 私人'));
  assert.notEqual(current[1], former[1]); assert.equal(current[2][0].style, 'destructive');
  former[3].onDismiss(); view.render(); assert.equal(view.isHeld(), true); assert.equal(dismissed, 0);
  current[2][0].onPress(); former[2][0].onPress(); view.render();
  assert.equal(accepted, 1); assert.equal(view.isHeld(), false);
});
