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
const names = ['../../modules/remilo-alarm/src/RemiloAlarmModule', '../ui/theme'];
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
  for (const platform of ['android', 'ios']) for (const name of names) {
    assert.deepEqual(resolve(context, name, platform), { type: 'normal', filePath: platform + ':' + name });
  }
  assert.deepEqual(resolve(context, names[1], 'web'), { type: 'normal', filePath: 'web:' + names[1] });
});

function loadPresentation() {
  const compile = (file, dependencies = {}) => {
    const module = { exports: {} };
    const result = ts.transpileModule(read(file), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    }, fileName: file });
    runInNewContext(result.outputText, {
      module, exports: module.exports, require: (name) => {
        assert.ok(Object.hasOwn(dependencies, name), 'Unexpected presentation dependency: ' + name);
        return dependencies[name];
      },
    }, { filename: file });
    return module.exports;
  };
  const colors = compile('src/ui/colors.ts');
  const environment = { system: 'light', setting: 'system' };
  const contexts = [];
  const theme = compile('src/ui/theme.tsx', {
    react: {
      createContext: (value) => { const context = { value, Provider: Symbol('Provider') }; contexts.push(context); return context; },
      useContext: (context) => context.value,
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { useColorScheme: () => environment.system },
    './native': { useSettings: () => ({ data: environment.setting == null ? undefined : { theme: environment.setting } }) },
    './colors': colors,
  });
  return { theme, colors, environment, contexts };
}

test('ordinary theme follows brightness settings and preserves its system and missing-setting fallbacks', () => {
  const { theme, colors, environment } = loadPresentation();
  for (const [setting, system, expected] of [
    ['light', 'dark', 'light'], ['dark', 'light', 'dark'], ['system', 'dark', 'dark'],
    ['system', 'light', 'light'], ['system', null, 'light'], [undefined, 'dark', 'dark'],
  ]) {
    Object.assign(environment, { setting, system });
    assert.equal(theme.ThemeProvider({ children: 'content' }).props.value, colors.palettes[expected]);
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

test('compact row styling remains an explicit opt-in in existing production destinations', () => {
  const rowSource = ts.createSourceFile('row.tsx', read('src/ui/reminder-row.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = rowSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'ReminderRow');
  assert.ok(component && ts.isFunctionDeclaration(component));
  const binding = component.parameters[0].name;
  const compact = binding.elements.find((element) => element.name.getText(rowSource) === 'compact');
  assert.equal(compact?.initializer?.kind, ts.SyntaxKind.FalseKeyword);
  const editorial = binding.elements.find((element) => element.name.getText(rowSource) === 'editorial');
  assert.equal(editorial?.initializer?.kind, ts.SyntaxKind.FalseKeyword);
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
    assert.ok(!attributes.includes('compact'), file);
    assert.ok(!attributes.includes('nowMs'), file);
    assert.ok(!attributes.includes('editorial'), file);
  }
});

test('native presentation remains optional and the ordinary activity owns alarm controls', () => {
  assert.match(read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt'), /singlePresentation:[\s\S]*?= null/);
  assert.ok(!read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt').includes('singlePresentation'));
  assert.match(read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt'), /AlarmControlsScreen\(/);
  assert.ok(!read('modules/remilo-alarm/android/src/main/AndroidManifest.xml').includes('AlarmDesignReviewActivity'));
});
