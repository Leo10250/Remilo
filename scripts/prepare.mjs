import { join } from 'node:path';
import { localEvidence } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { checkSigning } from './lib/android-tools.mjs';
import { verifyShared, buildRelease } from './lib/build.mjs';
import { writeJson } from './lib/files.mjs';

await cli(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help') return console.log('node scripts/prepare.mjs verify|release [--abi arm64-v8a|x86_64] [--json]');
  const flags = options(args, ['abi']); allowedOptions(flags, ['abi', 'json', 'help']);
  if (flags.help) return console.log(`npm run ${mode === 'release' ? 'release:prepare' : 'verify:all'} -- [--abi arm64-v8a|x86_64] [--json]\nShared checks + native checks + assembly. Release requires existing signing. Does not install/publish or mark physical checks passed.`);
  if (!['verify', 'release'].includes(mode)) throw new Error('Expected verify or release.');
  if (mode === 'release') checkSigning();
  const checks = await verifyShared({ json: flags.json });
  const build = await buildRelease({ abi: flags.abi, verify: true, requireSigning: mode === 'release', json: flags.json });
  checks.push({ command: 'Android unit tests, module/app lint, release assembly', result: 'passed', completedAt: build.builtAt });
  const summary = { schemaVersion: 2, ok: true, preparedAt: new Date().toISOString(), build, checks,
    physicalObservations: 'pending', ownerChecklist: 'docs/device-acceptance.md', installed: false, published: false };
  writeJson(join(localEvidence, `${mode}-summary.json`), summary);
  if (flags.json) console.log(JSON.stringify(summary));
  else console.log(`Host verification passed. Signed=${summary.build.apk.metadata.signed}. Physical acceptance remains pending.\nSummary: ${join(localEvidence, `${mode}-summary.json`)}\nOwner checklist: docs/device-acceptance.md`);
});
