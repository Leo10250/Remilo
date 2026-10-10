import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '../..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

function metroResolver(preview) {
  const fallback = (context, name, platform) => context.resolveRequest(context, name, platform);
  const module = { exports: { resolver: { resolveRequest: fallback } } };
  runInNewContext(read('metro.config.js'), {
    __dirname: root, module, process: { env: preview == null ? {} : { REMILO_UI_PREVIEW: preview } },
    require: (name) => {
      if (name === 'node:path') return path;
      if (name === 'expo/metro-config') return { getDefaultConfig: () => ({ resolver: { resolveRequest: fallback } }) };
      throw new Error('Unexpected Metro configuration dependency: ' + name);
    },
  }, { filename: 'metro.config.js' });
  return module.exports.resolver.resolveRequest;
}

const context = { resolveRequest: (_context, name, platform) => ({ type: 'normal', filePath: platform + ':' + name }) };
const names = ['../../modules/remilo-alarm/src/RemiloAlarmModule', '../ui/theme', '../ui/presentation-preview', 'expo-file-system', 'expo-sharing'];
for (const preview of [undefined, '0', 'true', '']) {
  test(`preview environment ${String(preview)} preserves normal web and native resolution`, () => {
    const resolve = metroResolver(preview);
    for (const platform of ['web', 'android', 'ios']) for (const name of names) {
      assert.deepEqual(resolve(context, name, platform), { type: 'normal', filePath: platform + ':' + name });
    }
  });
}
test('only the explicit preview web bundle substitutes the fixture bridge, leaving native and other modules normal', () => {
  const resolve = metroResolver('1');
  assert.deepEqual({ ...resolve(context, names[0], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/preview-engine.ts') });
  assert.deepEqual({ ...resolve(context, names[2], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/presentation-preview.tsx') });
  assert.deepEqual({ ...resolve(context, names[3], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/preview-files.ts') });
  assert.deepEqual({ ...resolve(context, names[4], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/preview-sharing.ts') });
  for (const platform of ['android', 'ios']) for (const name of names) {
    assert.deepEqual(resolve(context, name, platform), { type: 'normal', filePath: platform + ':' + name });
  }
  assert.deepEqual(resolve(context, names[1], 'web'), { type: 'normal', filePath: 'web:' + names[1] });
});

function compile(file, dependencies = {}, globals = {}) {
    const module = { exports: {} };
    const result = ts.transpileModule(read(file), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    }, fileName: file });
    runInNewContext(result.outputText, {
      ...globals, module, exports: module.exports, require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), 'Unexpected presentation dependency: ' + name);
        return dependencies[name];
      },
    }, { filename: file });
    return module.exports;
}
function loadPresentation() {
  const generated = compile('src/ui/atmosphere.generated.ts');
  const colors = compile('src/ui/colors.ts', { './atmosphere.generated': generated });
  const appearance = compile('src/domain/appearance.ts');
  const tokens = compile('src/ui/tokens.ts', { './atmosphere.generated': generated });
  const environment = { system: 'light', setting: 'system', atmosphere: 'sky' };
  const contexts = [];
  const theme = compile('src/ui/theme.tsx', {
    react: {
      createContext: (value) => { const context = { value, Provider: Symbol('Provider') }; contexts.push(context); return context; },
      useContext: (context) => context.value,
      useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
      useRef: (value) => ({ current: value }),
      useMemo: (compute) => compute(),
      useEffect: () => {}, // Host fixture does not run foreground timers/native observation.
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { useColorScheme: () => environment.system, AppState: { currentState: 'active' } },
    '../../modules/remilo-alarm/src/RemiloAlarmModule': {},
    './native': { useSettings: () => ({ data: environment.setting == null ? undefined : { theme: environment.setting, atmosphere: environment.atmosphere } }) },
    './colors': colors,
    '../domain/appearance': appearance,
    './tokens': tokens,
    './atmosphere.generated': generated,
  });
  return { theme, colors, appearance, environment, contexts };
}

function loadPreview(search) {
  return compile('verification/ui/preview-engine.ts', {
    '../../src/domain/time': compile('src/domain/time.ts'),
    '../../src/domain/repeat': compile('src/domain/repeat.ts'),
  }, { URLSearchParams, ...(search == null ? {} : { window: { location: { search } } }) }).default;
}

test('fixture scene/brightness controls recognize all eight pairs and ignore unknown or missing values', async () => {
  for (const scene of ['sunrise', 'sky', 'evening', 'night']) for (const brightness of ['light', 'dark']) {
    const settings = await loadPreview(`?reviewScene=${scene}&reviewBrightness=${brightness}`).getSettings();
    assert.equal(settings.atmosphere, scene); assert.equal(settings.theme, brightness);
  }
  for (const search of [undefined, '?reviewScene=retired-palette&reviewBrightness=invalid']) {
    const settings = await loadPreview(search).getSettings();
    assert.equal(settings.atmosphere, 'automatic'); assert.equal(settings.theme, 'light');
  }
  const settings = await loadPreview('?reviewScene=automatic&reviewBrightness=system').getSettings();
  assert.equal(settings.atmosphere, 'automatic'); assert.equal(settings.theme, 'system');
});

test('review fixtures cover empty/single lists and unavailable/blocked permission queries', async () => {
  assert.equal((await loadPreview('?reviewLists=empty').queryLists()).length, 0);
  assert.equal((await loadPreview('?reviewLists=single').queryLists()).length, 1);
  await assert.rejects(loadPreview('?reviewPermissions=error').getCapabilities(), /could not be checked/);
  const blocked = await loadPreview('?reviewPermissions=blocked').getCapabilities();
  assert.equal(blocked.exactAlarms, false); assert.equal(blocked.notifications, false);
});

test('test lost-reply fixture retries the identified reminder without creating a duplicate', async () => {
  const engine = loadPreview('?reviewLostReply=1');
  await assert.rejects(engine.scheduleTestAlarm('tile-review-test'), /reply lost/);
  const confirmed = await engine.scheduleTestAlarm('tile-review-test');
  const repeated = await engine.scheduleTestAlarm('tile-review-test');
  assert.ok(confirmed.occurrence); assert.equal(repeated.occurrence.id, confirmed.occurrence.id);
});

test('export review stays in memory and retries a synthetic share failure', async () => {
  const { Directory, File, Paths } = compile('verification/ui/preview-files.ts');
  const file = new File(new Directory(Paths.cache, 'exports'), 'fixture.json');
  file.create(); file.write('synthetic backup');
  assert.match(file.uri, /^memory:\/\//); assert.equal(await file.text(), 'synthetic backup');
  await assert.rejects(File.pickFileAsync(), /requires the Android app/);
  const sharing = compile('verification/ui/preview-sharing.ts', {}, { URLSearchParams, window: { location: { search: '?reviewShare=failed-once' } } });
  assert.equal(await sharing.isAvailableAsync(), true);
  await assert.rejects(sharing.shareAsync(file.uri), /unavailable/);
  await sharing.shareAsync(file.uri);
});

test('long-text fixture supplies bounded English/Chinese content consistently across list membership and repeats', async () => {
  const engine = loadPreview('?reviewText=long'), lists = await engine.queryLists();
  assert.ok(lists.every((list) => list.name.includes('家庭') && list.name.length <= 60));
  const item = await engine.getOccurrence('review');
  assert.match(item.title, /Check every detail/); assert.match(item.title, /检查全部细节/); assert.ok(item.title.length <= 200);
  assert.match(item.notes, /original Event, Due and Next alert/); assert.match(item.notes, /光标/); assert.ok(item.notes.length < 4000);
  assert.equal(item.listName, lists.find((list) => list.id === item.listId).name);
  const repeat = await engine.getSeries('daily');
  assert.match(repeat.template.title, /检查全部细节/); assert.match(repeat.template.notes, /光标/);
  assert.ok(!(await loadPreview('?reviewText=unknown').getOccurrence('review')).title.includes('检查全部细节'));
});

test('lost-reply fixture commits once and acknowledges the same receipt on retries', async () => {
  const engine = loadPreview('?reviewLostReply=1'), command = { kind: 'Create', title: 'Lost reply review', operationId: 'same-save', eventStartMs: Date.now() + 600_000 };
  await assert.rejects(engine.applyCommand(command), /reply was lost/);
  const after = await engine.queryReminders({ view: 'agenda', search: command.title }, null);
  assert.equal(after.total, 1);
  const retry = await engine.applyCommand(command), again = await engine.applyCommand(command);
  assert.equal(retry.occurrence.id, after.items[0].id); assert.equal(again.occurrence.revision, retry.occurrence.revision);
  assert.equal((await engine.queryReminders({ view: 'agenda', search: command.title }, null)).total, 1);
  assert.equal((await engine.applyCommand({ ...command, title: '', operationId: 'invalid-save' })).status, 'Rejected');
  const ordinary = loadPreview('?reviewLostReply=true');
  assert.equal((await ordinary.applyCommand(command)).status, 'Scheduled');
});

test('presentation stress scale is isolated, SSR-safe and retained through fixture navigation', () => {
  const ordinary = compile('src/ui/presentation-preview.tsx', { 'react/jsx-runtime': { Fragment: 'fragment', jsx: (type, props) => ({ type, props }) } }).default;
  const ordinaryTree = ordinary({ children: 'ordinary' });
  assert.equal(ordinaryTree.type, 'fragment'); assert.equal(ordinaryTree.props.children, 'ordinary');
  const colors = { fixture: true }, provider = Symbol('presentation');
  for (const search of [undefined, '?reviewScale=2', '?reviewScale=3']) {
    let initialized = false, retained;
    const window = { location: { search } };
    const preview = compile('verification/ui/presentation-preview.tsx', {
      react: { useState: (initialize) => { if (!initialized) { initialized = true; retained = initialize(); } return [retained, () => {}]; } },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
      '../../src/ui/theme': { useTheme: () => colors, PresentationProvider: provider },
    }, { URLSearchParams, ...(search == null ? {} : { window }) }).default;
    const rendered = preview({ children: 'fixture' });
    assert.equal(rendered.type, provider); assert.equal(rendered.props.colors, colors);
    assert.equal(rendered.props.fontScale, search === '?reviewScale=2' ? 2 : undefined);
    window.location.search = '';
    assert.equal(preview({ children: 'next page' }).props.fontScale, rendered.props.fontScale);
  }
});

test('ordinary atmosphere and brightness settings resolve independently with safe fallbacks', () => {
  const { theme, colors, appearance, environment } = loadPresentation();
  for (const [setting, system, expected] of [
    ['light', 'dark', 'light'], ['dark', 'light', 'dark'], ['system', 'dark', 'dark'],
    ['system', 'light', 'light'], ['system', null, 'light'], [undefined, 'dark', 'dark'],
  ]) {
    Object.assign(environment, { setting, system });
    const provider = theme.ThemeProvider({ children: 'content' });
    assert.equal(provider.props.value.brightness, expected);
    const expectedScene = setting == null ? appearance.resolveAtmosphere(undefined, new Date()) : 'sky';
    assert.equal(provider.props.value.scene, expectedScene);
    assert.deepEqual(provider.props.children.props.children.props.foundation.colors, colors.atmosphereColors(expectedScene, expected));
  }
  for (const atmosphere of ['sunrise', 'sky', 'evening', 'night']) {
    Object.assign(environment, { setting: 'dark', system: 'light', atmosphere });
    const provider = theme.ThemeProvider({ children: 'content' });
    assert.equal(provider.props.value.scene, atmosphere);
    assert.equal(provider.props.value.brightness, 'dark');
    assert.deepEqual(provider.props.children.props.children.props.foundation.colors, colors.atmosphereColors(atmosphere, 'dark'));
  }
  assert.equal(theme.useFontScaleOverride(), 1);
  assert.equal(theme.useReducedMotionOverride(), undefined);
  assert.equal(theme.useFoundationStyle(), null);
  assert.equal(theme.usePresentationState(), 'default');
});

test('optional presentation inherits scale and motion and preserves an explicit false motion override', () => {
  const { theme, colors, contexts } = loadPresentation();
  contexts.find((context) => context.value === 1).value = 1.5;
  contexts.find((context) => context.value === undefined).value = true;
  const inherited = theme.PresentationProvider({ colors: colors.palettes.dark, children: 'content' });
  assert.equal(inherited.props.value, colors.palettes.dark);
  assert.equal(inherited.props.children.props.value, 1.5);
  assert.equal(inherited.props.children.props.children.props.value, true);
  const explicit = theme.PresentationProvider({ colors: colors.palettes.light, fontScale: 2, reducedMotion: false, children: 'content' });
  assert.equal(explicit.props.children.props.value, 2);
  assert.equal(explicit.props.children.props.children.props.value, false);
});

test('sheets restore surface foregrounds and controls when opened inside scenic headers in all eight themes', () => {
  for (const scene of ['sunrise', 'sky', 'evening', 'night']) for (const brightness of ['light', 'dark']) {
    const { theme, colors, contexts } = loadPresentation();
    const palette = colors.atmosphereColors(scene, brightness);
    const generated = compile('src/ui/atmosphere.generated.ts');
    const tokens = compile('src/ui/tokens.ts', { './atmosphere.generated': generated });
    const jsx = (type, props, key) => ({ type, props, key });
    const components = compile('src/ui/components.tsx', {
      ...Object.fromEntries([...read('src/ui/components.tsx').matchAll(/require\('([^']+\.webp)'\)/g)].map((match) => [match[1], 'fixture-artwork'])),
      react: {
        createContext: (value) => { const context = { value, Provider: Symbol('Provider') }; contexts.push(context); return context; },
        useContext: (context) => context.value, useState: (value) => [value, () => {}],
        useRef: (value) => ({ current: value }), useCallback: (callback) => callback, useEffect: () => {},
        Children: { toArray: (children) => [children].flat(Infinity).filter((child) => child != null && typeof child !== 'boolean') },
        isValidElement: (child) => child?.type != null,
      },
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': {
        View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal',
        Platform: { OS: 'web' }, StyleSheet: { create: (styles) => styles, absoluteFill: { position: 'absolute' } },
        useWindowDimensions: () => ({ width: 412, height: 915, fontScale: 1 }),
      },
      '@react-native-community/datetimepicker': {}, 'expo-symbols': { SymbolView: 'Glyph' }, 'expo-router': {},
      'react-native-safe-area-context': {}, './theme': theme, './tokens': tokens,
      '../domain/time': {}, './native': {}, './motion': { useReducedMotion: () => theme.useReducedMotionOverride() },
      './form-viewport': { FormViewport: (props) => jsx('Viewport', { children: [props.children, props.footer] }) }, './atmosphere.generated': generated,
      './scroll-chrome': { ScrollChromeProvider: 'ScrollChrome' }, './snackbar-timeout': {},
    });
    // Model the header's foreground and scenic-control context; a Modal retains both.
    contexts.find((context) => context.value === false).value = true;
    contexts.find((context) => context.value === 'default').value = 'focused';
    const render = (node) => {
      if (Array.isArray(node)) return node.map(render);
      if (node == null || typeof node !== 'object') return node;
      const context = contexts.find((candidate) => candidate.Provider === node.type);
      if (context) {
        const previous = context.value; context.value = node.props.value;
        const rendered = render(node.props.children); context.value = previous; return rendered;
      }
      if (typeof node.type === 'function') return render(node.type(node.props));
      return { ...node, props: { ...node.props, children: render(node.props.children) } };
    };
    const collect = (node) => Array.isArray(node) ? node.flatMap(collect) : node && typeof node === 'object' ? [node, ...collect(node.props.children)] : [];
    const content = jsx(components.Sheet, { title: 'More', visible: true, onClose: () => {},
      children: jsx(components.SettingRow, { label: 'Settings', icon: 'settings', description: 'App preferences', onPress: () => {} }),
      footer: jsx(components.Copy, { children: 'Footer' }),
    });
    const header = jsx(theme.PresentationProvider, { colors: { ...palette, ink: '#FFFFFF', muted: '#FFFFFF' }, fontScale: 2, reducedMotion: true, children: content });
    const nodes = collect(render(jsx(theme.FoundationStyleProvider, { foundation: { colors: palette }, children: header })));
    const text = (label) => nodes.find((node) => node.type === 'Text' && node.props.children === label);
    assert.equal(text('More').props.style.color, palette.ink, scene + '/' + brightness);
    assert.equal(text('Settings').props.style.color, palette.ink);
    assert.equal(text('App preferences').props.style.color, palette.muted);
    assert.equal(text('Footer').props.style.color, palette.ink);
    assert.equal(text('More').props.style.fontSize, tokens.typography.appBar * 2, 'Large-text context survives the boundary.');
    assert.equal(nodes.find((node) => node.type === 'Modal').props.animationType, 'none', 'Reduced-motion context survives the boundary.');
    const close = nodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Close More');
    assert.equal(close.props.style({ pressed: false }).borderColor, palette.focus, 'Close uses surface focus treatment rather than scenic white.');
    assert.ok(nodes.some((node) => node.type === 'Glyph' && node.props.name.web === 'settings' && node.props.tintColor === palette.muted));
  }
});

test('ordinary reminder rows expose leading completion independently from opening and use a neutral glyph', () => {
  const rowSource = ts.createSourceFile('row.tsx', read('src/ui/reminder-row.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = rowSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'ReminderRow');
  assert.ok(component && ts.isFunctionDeclaration(component));
  const binding = component.parameters[0].name;
  const glyph = binding.elements.find((element) => element.name.getText(rowSource) === 'glyph');
  assert.equal(glyph?.initializer?.text, 'event');
  const body = component.getText(rowSource), completionPosition = body.indexOf('{doneControl}'), openingPosition = body.indexOf("accessibilityLabel={'Open ' + summary}");
  assert.ok(completionPosition >= 0 && openingPosition > completionPosition, 'The independent completion control precedes opening the reminder.');
  assert.match(body, /accessibilityRole="checkbox" aria-checked=\{item.completed\} accessibilityLabel=\{actionLabel \+ ': ' \+ summary\}/);
  assert.match(body, /accessibilityState=\{\{ checked: item.completed, disabled: busy \}\} disabled=\{busy\} onPress=\{act\}/);
  for (const file of ['src/app/index.tsx', 'src/app/records.tsx', 'src/app/series/[id].tsx']) {
    const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const attributes = [];
    const walk = (node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'ReminderRow') {
        attributes.push(...node.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => attribute.name.getText(source)));
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
    assert.ok(!attributes.includes('category'), file);
    assert.ok(!attributes.includes('categoryIcon'), file);
  }
});

test('native atmosphere rendering leaves observation, guarded actions and confirmed dismissal in the activity', () => {
  const activity = read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt');
  const controls = read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt');
  assert.match(activity, /AtmosphereTokens\.colors\(current\?\.atmosphere/);
  assert.match(activity, /SessionRefreshGuard\.mayDismiss\(current\.state, pendingCommand != null, busy\.value, unconfirmed\.value\)\) finish\(\)/);
  assert.match(activity, /if \(!guard\.select\(id, pendingCommand != null, busy\.value, unconfirmed\.value\)\)/);
  assert.match(activity, /deferredIntent = Intent\(intent\)/, 'Later alarm intents are retained while the current action is unresolved.');
  assert.match(activity, /pendingCommand\?\.get\("operationId"\) == command\["operationId"\]/, 'Action responses acknowledge the frozen operation rather than a mutable snapshot.');
  assert.match(activity, /if \(definitive && deferredIntent != null\)/, 'Only a definitive action response selects the queued session.');
  assert.match(activity, /outState\.putParcelable\("deferredIntent", it\)/, 'The queued intent survives activity recreation.');
  const restorePosition = activity.indexOf('savedInstanceState?.getBundle("pendingAction")');
  const initialRefreshPosition = activity.indexOf('select(initialIntent)');
  assert.ok(restorePosition >= 0 && initialRefreshPosition > restorePosition, 'Restore the frozen action before selecting or refreshing its session.');
  assert.match(activity, /"expectedGeneration" to record\?\.generation/);
  assert.match(activity, /AlarmControlsScreen\(/);
  assert.ok(!controls.includes('engine.apply'), 'Rendering delegates mutations to the native activity.');
  assert.ok(!controls.includes('finish()'), 'Rendering does not infer a session has ended.');
  assert.ok(!read('modules/remilo-alarm/android/src/main/AndroidManifest.xml').includes('AlarmDesignReviewActivity'));
});
