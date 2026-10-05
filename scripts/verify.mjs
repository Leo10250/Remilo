import { cli, options, allowedOptions } from './lib/cli.mjs';
import { verifyShared } from './lib/build.mjs';
await cli(async () => {
  const flags = options(process.argv.slice(2)); allowedOptions(flags, ['help', 'json']);
  if (flags.help) return console.log('npm run verify -- [--json]\nTypeScript, ESLint, shared behavior and tooling tests.');
  const checks = await verifyShared({ json: flags.json });
  if (flags.json) console.log(JSON.stringify({ ok: true, checks }));
});
