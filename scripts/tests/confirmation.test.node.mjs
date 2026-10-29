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
  const language = localization();
  const module = { exports: {} };
  const result = ts.transpileModule(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/confirmation-state.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(result.outputText, { module, exports: module.exports, require: (name) => {
    if (name === '../localization') return language;
    throw new Error('Unexpected confirmation dependency: ' + name);
  } });
  const state = new module.exports.ConfirmationState(), owner = Symbol('screen');
  return { state, owner, language, confirm: (...args) => state.present(owner, ...args), entry: () => state.getSnapshot(), content: () => state.content(state.getSnapshot()) };
}

test('themed confirmations execute only the chosen captured callback, exactly once', () => {
  const view = fixture(), { state } = view;
  let cancelled = 0, accepted = 0;
  const choices = [{ text: 'Cancel', style: 'cancel', onPress: () => cancelled++ }, { text: 'Remove', style: 'destructive', onPress: () => accepted++ }];
  view.confirm('Remove list?', 'Reminders move to No list.', choices);
  const first = view.entry();
  assert.equal(view.content().buttons[0].style, 'cancel'); assert.equal(view.content().buttons[1].style, 'destructive');
  state.choose(first.id, 0); state.choose(first.id, 1); state.dismiss(first.id);
  assert.equal(view.entry(), null); assert.equal(cancelled, 1); assert.equal(accepted, 0);
  view.confirm('Remove?', undefined, choices);
  const second = view.entry(); state.choose(first.id, 1); assert.equal(view.entry(), second);
  state.choose(second.id, 1); state.choose(second.id, 1);
  assert.equal(accepted, 1); assert.equal(cancelled, 1); assert.equal(view.entry(), null);
});

test('Back and backdrop cancellation preserve the draft and notify dismissal once', () => {
  const view = fixture(); let cancelled = 0, accepted = 0, dismissed = 0;
  view.confirm('Discard?', undefined, [{ text: 'Keep editing', style: 'cancel', onPress: () => cancelled++ },
    { text: 'Discard', style: 'destructive', onPress: () => accepted++ }], { onDismiss: () => dismissed++ });
  const id = view.entry().id; view.state.dismiss(id); view.state.dismiss(id);
  assert.equal(cancelled, 1); assert.equal(dismissed, 1); assert.equal(accepted, 0); assert.equal(view.entry(), null);
});

test('an explicitly noncancelable guard still allows its acknowledgement', () => {
  const view = fixture(); let dismissed = 0;
  view.confirm('Save not confirmed', 'Retry this same Save.', undefined, { cancelable: false, onDismiss: () => dismissed++ });
  const entry = view.entry(); view.state.dismiss(entry.id); assert.equal(view.entry(), entry); assert.equal(dismissed, 0);
  assert.equal(view.content().buttons[0].text, 'OK'); view.state.choose(entry.id, 0); assert.equal(view.entry(), null);
});

test('locale changes translate open copy without replacing identity, callbacks or authored names', () => {
  const view = fixture(); let accepted = 0, dismissed = 0;
  view.confirm(view.language.t('m_0c08198f562b'), view.language.t('remove_list_confirmation', { name: 'Personal 私人' }),
    [{ text: view.language.t('m_669f24b0f91d'), style: 'destructive', onPress: () => accepted++ }], { cancelable: true, onDismiss: () => dismissed++ });
  const entry = view.entry(), former = view.content(); view.language.confirmLanguage('zh-Hans');
  const current = view.content();
  assert.equal(view.entry(), entry); assert.match(current.title, /[\u4e00-\u9fff]/); assert.ok(current.message.includes('Personal 私人'));
  assert.notEqual(current.message, former.message); assert.equal(current.buttons[0].style, 'destructive');
  view.state.choose(entry.id, 0); view.state.choose(entry.id, 0);
  assert.equal(accepted, 1); assert.equal(dismissed, 0); assert.equal(view.entry(), null);
});

test('repeated Back requests cannot replace the original captured navigation action', () => {
  const view = fixture(); let first = 0, second = 0;
  view.confirm('Discard?', undefined, [{ text: 'Discard', onPress: () => first++ }]); const entry = view.entry();
  view.confirm('Different route', undefined, [{ text: 'Leave', onPress: () => second++ }]);
  view.state.present(Symbol('another screen'), 'Another request');
  assert.equal(view.entry(), entry); view.state.choose(entry.id, 0); assert.equal(first, 1); assert.equal(second, 0);
});

test('unmount invalidates retained actions without executing cancellation or mutation', () => {
  const view = fixture(); let actions = 0;
  view.confirm('Discard?', undefined, [{ text: 'Discard', onPress: () => actions++ }], { onDismiss: () => actions++ });
  const entry = view.entry(); view.state.release(Symbol('other')); assert.equal(view.entry(), entry);
  view.state.release(view.owner); view.state.choose(entry.id, 0); view.state.dismiss(entry.id);
  assert.equal(view.entry(), null); assert.equal(actions, 0); assert.equal(view.state.restoreTarget(), null);
});

test('callback errors and reentrant confirmations cannot replay or discard a newer decision', () => {
  const view = fixture(), error = new Error('action failed');
  view.confirm('Confirm', undefined, [{ text: 'Confirm', onPress: () => { throw error; } }]); const first = view.entry();
  assert.throws(() => view.state.choose(first.id, 0), received => received === error); assert.equal(view.entry(), null);
  view.confirm('First', undefined, [{ text: 'Next', onPress: () => view.confirm('Second') }]);
  const second = view.entry(); view.state.choose(second.id, 0); assert.equal(view.content().title, 'Second');
  view.state.dismiss(second.id); assert.equal(view.content().title, 'Second');
});

test('only safe cancellation restores the captured connected control; newer requests fence old frames', () => {
  const view = fixture(), initial = { focus() {}, isConnected: true }, inside = { focus() {} };
  view.state.rememberFocus(initial); view.confirm('Discard?', undefined, [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive' }]);
  const first = view.entry(); view.state.rememberFocus(inside); view.state.choose(first.id, 0);
  assert.equal(view.state.restoreTarget().target, initial); assert.equal(view.state.canRestore(first.id), true);
  view.confirm('Second'); assert.equal(view.state.canRestore(first.id), false); view.state.choose(view.entry().id, 0);
  assert.equal(view.state.canRestore(first.id), false);
  assert.equal(view.state.restoreTarget().target, initial);
  view.confirm('Discard?', undefined, [{ text: 'Discard', style: 'destructive' }]); view.state.choose(view.entry().id, 0);
  assert.equal(view.state.restoreTarget(), null);
});

test('invalid indices and mutated caller arrays cannot change the captured decision', () => {
  const view = fixture(); let accepted = 0;
  const buttons = [{ text: 'Discard', style: 'destructive', onPress: () => accepted++ }];
  view.confirm('Discard?', undefined, buttons); const entry = view.entry(); buttons[0].text = 'Unexpected'; buttons.length = 0;
  view.state.choose(entry.id, 2); assert.equal(view.entry(), entry); assert.equal(view.content().buttons[0].text, 'Discard');
  view.state.choose(entry.id, 0); assert.equal(accepted, 1);
});

test('subscribers receive stable active snapshots and release notifications', () => {
  const view = fixture(); let changes = 0;
  const unsubscribe = view.state.subscribe(() => changes++);
  view.confirm('Review'); const entry = view.entry(); assert.equal(view.entry(), entry); assert.equal(changes, 1);
  view.state.release(view.owner); assert.equal(changes, 2); unsubscribe(); view.confirm('Next'); assert.equal(changes, 2);
});

test('the screen hook invalidates choices on blur and ignores late requests until refocused', () => {
  const view = fixture(), module = { exports: {} }; let focus, keyboardDismissals = 0;
  const code = ts.transpileModule(readFileSync(path.resolve(import.meta.dirname, '../../src/ui/confirmation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === 'react') return { useCallback: callback => callback, useRef: value => ({ current: value }) };
    if (name === 'expo-router') return { useFocusEffect: callback => { focus = callback; } };
    if (name === 'react-native') return { Keyboard: { dismiss: () => keyboardDismissals++ } };
    if (name === './confirmation-state') return { confirmations: view.state };
    throw new Error('Unexpected hook dependency: ' + name);
  } });
  const confirm = module.exports.useAppearanceConfirmation(); let accepted = 0;
  confirm('Before focus'); assert.equal(view.entry(), null);
  const blur = focus(); confirm('First', undefined, [{ text: 'Confirm', onPress: () => accepted++ }]); const first = view.entry();
  confirm('Repeated Back'); assert.equal(keyboardDismissals, 1); assert.equal(view.entry(), first);
  blur(); confirm('Late request'); view.state.choose(first.id, 0); assert.equal(view.entry(), null); assert.equal(accepted, 0);
  focus(); confirm('Refocused'); assert.equal(view.content().title, 'Refocused'); assert.equal(keyboardDismissals, 2);
});
