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
const names = ['../../modules/remilo-alarm/src/RemiloAlarmModule', '../ui/design-review-entry'];
for (const preview of [undefined, '0', 'true', '']) {
  test(`review environment ${String(preview)} preserves normal web and Android resolution`, () => {
    const resolve = metroResolver(preview);
    for (const platform of ['web', 'android']) for (const name of names) {
      assert.deepEqual(resolve(context, name, platform), { type: 'normal', filePath: platform + ':' + name });
    }
  });
}
test('only the explicit preview web bundle substitutes fixtures, leaving Android and other modules normal', () => {
  const resolve = metroResolver('1');
  assert.deepEqual({ ...resolve(context, names[0], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/preview-engine.ts') });
  assert.deepEqual({ ...resolve(context, names[1], 'web') }, { type: 'sourceFile', filePath: path.join(root, 'verification/ui/design-review-entry.tsx') });
  for (const name of names) assert.deepEqual(resolve(context, name, 'android'), { type: 'normal', filePath: 'android:' + name });
  assert.deepEqual(resolve(context, '../ui/theme', 'web'), { type: 'normal', filePath: 'web:../ui/theme' });
});
test('the normally resolved review entry redirects to Agenda without loading fixture modules', () => {
  const source = ts.createSourceFile('entry.tsx', read('src/ui/design-review-entry.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = source.statements.filter(ts.isImportDeclaration);
  assert.deepEqual(imports.map((statement) => statement.moduleSpecifier.text), ['expo-router']);
  const elements = [];
  const walk = (node) => { if (ts.isJsxSelfClosingElement(node)) elements.push(node); ts.forEachChild(node, walk); };
  walk(source);
  assert.equal(elements.length, 1);
  assert.equal(elements[0].tagName.getText(source), 'Redirect');
  const href = elements[0].attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'href');
  assert.equal(href && ts.isJsxAttribute(href) && href.initializer && ts.isStringLiteral(href.initializer) ? href.initializer.text : null, '/');
});
test('compact row styling remains an explicit review opt-in in existing production destinations', () => {
  const rowSource = ts.createSourceFile('row.tsx', read('src/ui/reminder-row.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = rowSource.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'ReminderRow');
  assert.ok(component && ts.isFunctionDeclaration(component));
  const binding = component.parameters[0].name;
  const compact = binding.elements.find((element) => element.name.getText(rowSource) === 'reviewCompact');
  assert.equal(compact?.initializer?.kind, ts.SyntaxKind.FalseKeyword);
  const editorial = binding.elements.find((element) => element.name.getText(rowSource) === 'reviewEditorial');
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
    assert.ok(!attributes.includes('reviewCompact'), file);
    assert.ok(!attributes.includes('reviewNow'), file);
    assert.ok(!attributes.includes('reviewEditorial'), file);
  }
});

test('P01 native presentation is optional and all review assets remain debug-only', () => {
  assert.match(read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmControlsScreen.kt'), /singlePresentation:[\s\S]*?= null/);
  assert.ok(!read('modules/remilo-alarm/android/src/main/java/com/remilo/alarm/system/AlarmActivity.kt').includes('singlePresentation'));
  const review = read('modules/remilo-alarm/android/src/debug/java/com/remilo/alarm/review/P01AlarmReview.kt');
  assert.ok(!/AlarmEngine\.get|\.database|startService|RingingService/.test(review));
  assert.match(read('modules/remilo-alarm/android/src/debug/AndroidManifest.xml'), /android:exported="false"/);
  assert.ok(!read('modules/remilo-alarm/android/src/main/AndroidManifest.xml').includes('AlarmDesignReviewActivity'));
});
