import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { localEvidence, execute } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools, checkSigning, configuredVersions, requireFiles, toolVersions } from './lib/android-tools.mjs';
import { targetDevice, inspectInstalled, installedHash } from './lib/devices.mjs';
import { buildRelease, existingBuild, sourceSnapshot } from './lib/build.mjs';
import { writeJson, withReleaseLock } from './lib/files.mjs';
import { deployWorkflow, installArguments, launchArguments, confirmInstallation, confirmLaunch } from './lib/deployment.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2), ['device']);
  allowedOptions(flags, ['device', 'install-only', 'launch', 'dry-run', 'json', 'help']);
  if (flags.help) return console.log('npm run deploy -- [--device SERIAL] [--install-only] [--launch] [--dry-run] [--json]\nDefault: build current source, update user 0 without clearing data, verify installed hash, leave UI closed.\n--install-only requires a matching signed build receipt. --dry-run never builds or installs.');
  const tools = androidTools();
  const work = () => deployWorkflow(flags, {
    preflight: async () => { requireFiles(tools, ['adb', 'aapt', 'signer', 'java']); await toolVersions(tools); if (!flags['install-only']) { checkSigning(); configuredVersions(); } },
    target: (device) => targetDevice(tools, device), snapshot: sourceSnapshot,
    existing: () => existingBuild(tools), build: (abi) => buildRelease({ abi, json: flags.json, locked: true }),
    installed: (serial) => inspectInstalled(tools, serial), hash: (serial) => installedHash(tools, serial),
    install: async (serial, path) => {
      confirmInstallation(await execute(tools.adb, installArguments(serial, path), { env: tools.env, timeout: 180_000 }));
    },
    launch: async (serial, launcher) => confirmLaunch(await execute(tools.adb, launchArguments(serial, launcher), { env: tools.env })),
  });
  const result = flags['dry-run'] ? await work() : await withReleaseLock(work);
  let reportPath = null;
  if (!flags['dry-run']) {
    reportPath = join(localEvidence, 'deployments', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`);
    writeJson(reportPath, { schemaVersion: 1, capturedAt: new Date().toISOString(), ...result });
  }
  if (flags.json) console.log(JSON.stringify({ ...result, reportPath }));
  else {
    if (result.device) console.log(`Device: ${result.device.model} (${result.device.serial}), Android ${result.device.android}`);
    if (result.build) console.log(`Source: ${result.build.source.commit}${result.build.source.dirty ? ' + local edits' : ''}; current inputs differ=${result.currentInputsDiffer}\nAPK: ${result.build.apk.path}`);
    console.log(`Result: ${result.phase}. Installation=${result.installation}; verification=${result.verification}; launched=${result.launched}.`);
    if (result.planned) console.log(`Planned: ${result.planned.join(' → ')}`);
    if (result.error) console.error(`${result.error.code}: ${result.error.message}`);
    if (reportPath) console.log(`Private receipt: ${reportPath}`);
  }
  if (!result.ok) process.exitCode = result.error?.code === 'CANCELLED' ? 130 : 1;
});
