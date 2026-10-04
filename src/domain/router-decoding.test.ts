/// <reference types="node" />
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// Exercise the actual Router dependency after the decode-uri-component override.
const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryString = routerRequire('query-string') as { parse: (input: string) => Record<string, unknown> };

describe('Router decoding compatibility', () => {
  it('retains ordinary Unicode and repeated query parameters', () => {
    expect(queryString.parse('title=Caf%C3%A9&tag=home&tag=work')).toMatchObject({
      title: 'Café', tag: ['home', 'work'],
    });
  });
  it('handles a long malformed percent sequence without recursive decoding', () => {
    const decoded = queryString.parse(`title=${'%C0'.repeat(10_000)}`);
    expect(typeof decoded.title).toBe('string');
    expect((decoded.title as string).length).toBeGreaterThan(0);
  });
});
