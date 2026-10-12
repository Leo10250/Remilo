import { root } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { ensureDesignBaseline } from './lib/design-history.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2)); allowedOptions(flags, ['help']);
  if (flags.help) return console.log('node scripts/fetch-design-baseline.mjs\nFetch the recorded design-audit commit if it is absent; never changes the checkout.');
  const result = ensureDesignBaseline(root, { fetchMissing: true });
  console.log(`Design audit baseline ${result.revision}: ${result.fetched ? 'fetched' : 'already available'}.`);
});
