import { cli, options, allowedOptions } from './lib/cli.mjs';
import { buildRelease } from './lib/build.mjs';

await cli(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help') return console.log('node scripts/android.mjs verify|beta [--abi arm64-v8a|x86_64] [--json]\nverify: native tests, lint, assembly; beta: required signed assembly. Both record build provenance.');
  const flags = options(args, ['abi']); allowedOptions(flags, ['abi', 'json', 'help']);
  if (flags.help) return console.log('npm run verify:android|build:beta -- [--abi arm64-v8a|x86_64] [--json]');
  if (!['verify', 'beta'].includes(mode)) throw new Error('Expected verify or beta. Use --help.');
  const receipt = await buildRelease({ abi: flags.abi, verify: mode === 'verify', requireSigning: mode === 'beta', json: flags.json });
  if (flags.json) console.log(JSON.stringify({ ok: true, build: receipt }));
});
