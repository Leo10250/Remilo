import { join, resolve } from 'node:path';
import { cli } from './lib/cli.mjs';
import { checked, localNode, root, WorkflowError } from './tools.mjs';

const extensions = '{js,cjs,mjs,jsx,ts,tsx,cts,mts}';
const targets = [
  `*.${extensions}`,
  `{src,scripts,modules/remilo-alarm/src,verification/ui}/**/*.${extensions}`,
];

export function prettierArguments(mode) {
  return [join(root, 'node_modules/prettier/bin/prettier.cjs'), mode, ...targets];
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await cli(async () => {
    const [mode, ...extra] = process.argv.slice(2);
    if (!['--check', '--write'].includes(mode) || extra.length) {
      throw new WorkflowError('ARGUMENT', 'Use npm run format or npm run format:check.');
    }
    await checked(localNode(), prettierArguments(mode), { stream: true, timeout: 300_000 });
  });
}
