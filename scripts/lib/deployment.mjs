import { WorkflowError } from '../tools.mjs';
import { deviceAbi } from './devices.mjs';

export const installArguments = (serial, path) => ['-s', serial, 'install', '-r', '--user', '0', path];
export const launchArguments = (serial, launcher) => ['-s', serial, 'shell', 'am', 'start', '--user', '0', '-n', `com.remilo.app/${launcher}`];
export const logArguments = (serial, follow = false) => ['-s', serial, 'logcat', '-v', 'threadtime', ...(follow ? [] : ['-d', '-t', '2000']), 'Remilo:I', '*:S'];

export function confirmInstallation(output) {
  const message = (output.stderr + output.stdout).trim();
  const remedies = [
    ['INSTALL_FAILED_INSUFFICIENT_STORAGE', 'Free storage on the selected device, then retry.'],
    ['INSTALL_FAILED_USER_RESTRICTED', 'Unlock the device and review its installation prompt or administrator restriction.'],
    ['INSTALL_FAILED_UPDATE_INCOMPATIBLE', 'Restore the installed app’s signing key. Do not uninstall or clear its data.'],
    ['INSTALL_FAILED_VERSION_DOWNGRADE', 'Build with a higher versionCode; downgrade flags are intentionally disabled.'],
    ['INSTALL_FAILED_NO_MATCHING_ABIS', 'Run npm run devices and rebuild for the selected device’s supported ABI.'],
  ];
  if (output.status !== 0 || !/^Success\s*$/m.test(output.stdout)) {
    const remedy = remedies.find(([code]) => message.includes(code));
    throw new WorkflowError(remedy?.[0] ?? 'INSTALL_FAILED', `${message.slice(-3000) || 'Android did not confirm installation.'}${remedy ? `\n${remedy[1]}` : '\nReview the device connection and installation prompt; no retry was attempted.'}`);
  }
}
export function confirmLaunch(output) {
  if (output.status !== 0 || /^(?:Error|Exception|SecurityException):/m.test(output.stdout + output.stderr)) throw new WorkflowError('LAUNCH_FAILED', `Installation succeeded, but Android could not open Remilo: ${(output.stderr + output.stdout).trim().slice(-3000)}`);
}

// Dependencies are explicit so failure cases can be exercised without contacting a phone.
export async function deployWorkflow(flags, deps) {
  const result = { ok: false, installed: false, launched: false };
  const message = deps.message ?? (() => {});
  try {
    await deps.preflight();
    result.device = await deps.target(flags.device);
    const abi = deviceAbi(result.device);
    message(`Device: ${result.device.model} (${result.device.serial}), Android ${result.device.android}. Building ${abi} release…`);
    // The shared build helper inspects and validates the APK before returning it.
    result.build = await deps.build(abi);
    message('Installing without clearing app data…');
    result.installationAttempted = true;
    await deps.install(result.device.serial, result.build.apk.path);
    result.installed = true;
    if (flags.launch) {
      message('Opening Remilo…');
      await deps.launch(result.device.serial, result.build.apk.metadata.launcher);
      result.launched = true;
    }
    result.ok = true;
  } catch (error) {
    result.error = { code: error.code ?? 'ERROR', message: error.message };
  }
  return result;
}
