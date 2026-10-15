import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, parseCatalog } from '../localization.mjs';

const valid = () => ({ messages: { sample: { en: 'Reminder {name}', 'zh-Hans': '提醒{name}', args: { name: 'string | number' } } } });
test('catalog parsing rejects duplicate keys before JSON can silently overwrite them', () => {
  assert.throws(() => parseCatalog('{"messages":{"sample":{},"sample":{}}}'), /Duplicate catalog property/);
  assert.throws(() => parseCatalog('{"messages":{"sample":{"en":"A","en":"B"}}}'), /Duplicate catalog property/);
});
test('localization generation escapes Android copy and preserves placeholders', () => {
  const input = valid(); input.messages.sample.en = "Reminder's <{name}> & \"notes\"";
  const outputs = generate(input);
  const resource = outputs.get('modules/remilo-alarm/android/src/main/res/values/localization.xml');
  assert.match(resource, /Reminder\\'s &lt;%1\$s&gt; &amp; \\"notes\\"/);
  assert.deepEqual([...outputs], [...generate(input)]);
});
test('translation validation rejects absent translations and mismatched arguments', () => {
  const absent = valid(); delete absent.messages.sample['zh-Hans'];
  assert.throws(() => generate(absent), /Missing translation/);
  const mismatched = valid(); mismatched.messages.sample['zh-Hans'] = '提醒{other}';
  assert.throws(() => generate(mismatched), /Placeholder mismatch/);
});
test('English plurals require one/other, Chinese needs other', () => {
  const catalog = { messages: { minutes: { en: { one: '{count} minute', other: '{count} minutes' }, 'zh-Hans': { other: '{count} 分钟' }, args: { count: 'number' } } } };
  const resources = [...generate(catalog).values()].join('\n');
  assert.match(resources, /<plurals name="l10n_minutes">/);
  delete catalog.messages.minutes.en.one;
  assert.throws(() => generate(catalog), /Missing translation/);
});
