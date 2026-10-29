import { join, resolve } from 'node:path';
import { localEvidence } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { checkSigning } from './lib/android-tools.mjs';
import { verifyShared, buildRelease } from './lib/build.mjs';
import { writeJson } from './lib/files.mjs';

export async function prepareWorkflow(mode, flags, { signing = checkSigning, shared = verifyShared,
  assemble = buildRelease, now = () => new Date().toISOString() } = {}) {
  if (!['verify', 'release'].includes(mode)) throw new Error('Expected verify or release.');
  if (mode === 'release') signing();
  const checks = [...await shared({ json: flags.json })];
  const build = await assemble({ abi: flags.abi, verify: true, requireSigning: mode === 'release', json: flags.json });
  checks.push({ command: 'Android unit tests, module/app lint, release assembly', result: 'passed', completedAt: build.builtAt });
  return { schemaVersion: 3, ok: true, preparedAt: now(), build, checks, installed: false, published: false };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await cli(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help') return console.log('node scripts/prepare.mjs verify|release [--abi arm64-v8a|x86_64] [--json]');
  const flags = options(args, ['abi']); allowedOptions(flags, ['abi', 'json', 'help']);
  if (flags.help) return console.log(`npm run ${mode === 'release' ? 'release:prepare' : 'verify:all'} -- [--abi arm64-v8a|x86_64] [--json]\nShared checks + native checks + assembly. Release requires existing signing. Does not install/publish or mark physical checks passed.`);
  const summary = await prepareWorkflow(mode, flags);
  writeJson(join(localEvidence, `${mode}-summary.json`), summary);
  if (flags.json) console.log(JSON.stringify(summary));
  else console.log(`Host verification passed. Signed=${summary.build.apk.metadata.signed}.\nSummary: ${join(localEvidence, `${mode}-summary.json`)}`);
});
