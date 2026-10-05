import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root, checked, localNode } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
await cli(async () => {
  const flags = options(process.argv.slice(2)); allowedOptions(flags, ['help']);
  if (flags.help) return console.log('npm run test:tooling\nControlled script fixtures; never installs or contacts a device.');
  await checked(localNode(), ['--test', ...readdirSync(join(root, 'scripts/tests')).filter((p) => p.endsWith('.test.node.mjs')).map((p) => join(root, 'scripts/tests', p))], { stream: true, timeout: 300_000 });
});
