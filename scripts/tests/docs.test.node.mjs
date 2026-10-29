import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { markdownAnchors, markdownLinks, verifyDocs } from '../verify-docs.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'remilo-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, text) => { mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), text); };
  return { root, write };
}
test('relative/encoded paths, images, reference links and Unicode duplicate anchors resolve without mutation', t => {
  const { root, write } = fixture(t);
  const source = '[guide](<folder with spaces/guide.md#中文-heading>)\n![image](image%20one.png)\n[again][g]\n[g]: folder%20with%20spaces/guide.md#中文-heading-1\n[external](https://example.invalid/missing)\n[inline](folder%20with%20spaces/guide.md#inline-code)';
  write('README.md', source); write('image one.png', 'image');
  write('folder with spaces/guide.md', '# 中文 heading\n# 中文 heading\n## Inline `code`');
  assert.deepEqual(verifyDocs(root, { entries: ['README.md'] }), { checks: { markdownFiles: 1, localLinks: 4 }, findings: [] });
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), source);
});
test('missing files, missing fragments and undefined references are actionable', t => {
  const { root, write } = fixture(t);
  write('README.md', '[file](missing.md)\n[anchor](#absent)\n[ref][undefined]');
  const result = verifyDocs(root, { entries: ['README.md'] });
  assert.equal(result.findings.length, 3);
  assert.deepEqual(result.findings.map(item => item.line), [1, 2, 3]);
});
test('fenced and inline examples are ignored, while a later real link is checked', () => {
  const source = '```md\n[example](missing.md)\n# Fake\n```\n`[inline](missing.md)`\n~~~\n[example](missing.md)\n~~~\n[real](README.md)';
  assert.deepEqual(markdownLinks(source), [{ target: 'README.md', line: 9 }]);
  assert.equal(markdownAnchors(source).has('fake'), false);
});
test('headings, explicit anchors and parenthesized filenames are supported', t => {
  const { root, write } = fixture(t);
  write('README.md', '[a](guide(one).md#named)\n[b](guide(one).md#setext)');
  write('guide(one).md', '<a id="named"></a>\nSetext\n======');
  assert.equal(verifyDocs(root, { entries: ['README.md'] }).findings.length, 0);
});
test('repository escapes and malformed URL encoding are rejected locally', t => {
  const { root, write } = fixture(t);
  write('README.md', '[escape](../outside.md)\n[bad](%ZZ.md)');
  const result = verifyDocs(root, { entries: ['README.md'] });
  assert.equal(result.findings.length, 2); assert.match(result.findings[0].message, /escapes/);
});
