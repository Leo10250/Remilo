import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url), ts = require('typescript');
const root = resolve(import.meta.dirname, '../..');
function compile(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!(name in dependencies)) throw new Error('Unexpected chrome dependency: ' + name);
    return dependencies[name];
  } }, { filename: file });
  return module.exports;
}

function loadChrome({ initial = 112, height = 800, scale = 1, platform = 'android' } = {}) {
  const evaluate = value => typeof value === 'number' ? value : value.read();
  class Value {
    constructor(value) { this.value = value; }
    read() { return this.value; }
    setValue(value) { this.value = value; }
    interpolate({ inputRange: [start, end], outputRange: [low, high] }) {
      assert.ok(end > start, 'No zero-width native interpolation');
      return { read: () => low + (high - low) * Math.max(0, Math.min(1, (this.value - start) / (end - start))) };
    }
  }
  const binary = operation => (a, b) => ({ read: () => operation(evaluate(a), evaluate(b)) });
  const stateWrites = [];
  let eventOptions;
  const chrome = compile('src/ui/scroll-chrome.tsx', {
    react: { createContext: () => ({}), useContext: () => null, useMemo: fn => fn(), useCallback: fn => fn,
      useState: value => [typeof value === 'function' ? value() : value, next => stateWrites.push(next)] },
    'react/jsx-runtime': {},
    'react-native': { Animated: { Value, add: binary((a,b) => a+b), subtract: binary((a,b) => a-b), multiply: binary((a,b) => a*b),
      event: (mapping, options) => { eventOptions = options; return event => { mapping[0].nativeEvent.contentOffset.y.setValue(event.nativeEvent.contentOffset.y); options.listener(event); }; } },
      Platform: { OS: platform }, useWindowDimensions: () => ({ height, fontScale: scale }) },
    '../domain/navigation': { readRootSnapshot: () => initial }, './theme': { useFontScaleOverride: () => 1 },
    './atmosphere.generated': { presentation: { geometry: { toolbar: 56, home: 200 } } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    './header-transition': compile('src/ui/header-transition.ts'),
  });
  return { chrome, evaluate, stateWrites, eventOptions: () => eventOptions };
}

test('native chrome restores its intermediate opacity and scrolls through the boundary without React state writes', () => {
  const fixture = loadChrome(), state = fixture.chrome.usePageChrome('agenda');
  assert.ok(Math.abs(fixture.evaluate(state.surfaceOpacity) - 0.83) < 1e-12);
  const events = [], onScroll = fixture.chrome.useChromeScroll(state, event => events.push(event));
  assert.equal(fixture.eventOptions().useNativeDriver, true);
  for (const [y, expectedOpacity] of [[120, 0.892421875], [144, 1], [145, 1], [112, 0.83], [80, 0.66], [0, 0.66]]) {
    const event = { nativeEvent: { contentOffset: { y } } };
    onScroll(event);
    assert.equal(state.value.read(), y);
    assert.equal(events.at(-1), event);
    assert.ok(Math.abs(fixture.evaluate(state.surfaceOpacity) - expectedOpacity) < 1e-12);
  }
  assert.deepEqual(fixture.stateWrites, []);
  state.restoreOffset(112);
  assert.ok(Math.abs(fixture.evaluate(state.surfaceOpacity) - 0.83) < 1e-12);
  state.restoreOffset(300);
  assert.equal(fixture.evaluate(state.surfaceOpacity), 1);
});

test('compact height and large text remain opaque, and web preview retains its own driver', () => {
  for (const options of [{ height: 400 }, { scale: 2 }]) {
    const fixture = loadChrome(options), state = fixture.chrome.usePageChrome('settings');
    assert.equal(state.decoration, 0);
    assert.equal(state.surfaceOpacity, 1);
  }
  const fixture = loadChrome({ platform: 'web' }), state = fixture.chrome.usePageChrome('agenda');
  fixture.chrome.useChromeScroll(state, () => {});
  assert.equal(fixture.eventOptions().useNativeDriver, false);
});
