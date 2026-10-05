import { execute } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools, checkSigning, requireFiles } from './lib/android-tools.mjs';
import { targetDevice } from './lib/devices.mjs';
import { buildRelease } from './lib/build.mjs';
import { deployWorkflow, installArguments, launchArguments, confirmInstallation, confirmLaunch } from './lib/deployment.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2), ['device']);
  allowedOptions(flags, ['device', 'launch', 'help']);
  if (flags.help) return console.log('npm run deploy -- [--device SERIAL] [--launch]\nBuild a signed bundled beta and install it without clearing data. Leave Remilo closed unless --launch is supplied.\nConnect and authorize a device first. Multiple devices require --device or ANDROID_SERIAL.');
  const tools = androidTools();
  const result = await deployWorkflow(flags, {
    preflight: async () => { requireFiles(tools, ['adb', 'aapt', 'signer', 'java']); checkSigning(); },
    target: (device) => targetDevice(tools, device), build: (abi) => buildRelease({ abi }),
    message: (message) => console.log(message),
    install: async (serial, path) => confirmInstallation(await execute(tools.adb, installArguments(serial, path), { env: tools.env, timeout: 180_000 })),
    launch: async (serial, launcher) => confirmLaunch(await execute(tools.adb, launchArguments(serial, launcher), { env: tools.env })),
  });
  if (result.installed) {
    const apk = result.build.apk;
    const launchStatus = flags.launch ? (result.launched ? 'Remilo opened.' : 'Opening Remilo was not confirmed.') : 'Remilo was not opened by this command.';
    console.log(`Installed ${apk.metadata.package} ${apk.metadata.versionName} (${apk.metadata.versionCode}) on ${result.device.model}.\nAPK: ${apk.path}\n${launchStatus}`);
  }
  if (result.error) {
    console.error(`${result.error.code}: ${result.error.message}`);
    if (result.installationAttempted && !result.installed) console.error('Installation was not confirmed; no retry was attempted.');
    process.exitCode = result.error.code === 'CANCELLED' ? 130 : 1;
  }
});
