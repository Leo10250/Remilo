import { WorkflowError } from '../tools.mjs';
import { deviceAbi } from './devices.mjs';
import { validateApk, validateUpdate } from './android-tools.mjs';

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
  if (output.status !== 0 || /^(?:Error|Exception|SecurityException):/m.test(output.stdout + output.stderr)) throw new WorkflowError('LAUNCH_FAILED', `Installation is verified, but Android could not open Remilo: ${(output.stderr + output.stdout).trim().slice(-3000)}`);
}

// Dependencies are explicit so failure cases can be exercised without contacting a phone.
export async function deployWorkflow(flags, deps) {
  const result = { ok: false, phase: 'preflight', installation: 'not_attempted', verification: 'not_attempted', launched: false, physicalObservations: 'pending' };
  try {
    await deps.preflight();
    result.device = await deps.target(flags.device);
    const abi = deviceAbi(result.device);
    const workspace = await deps.snapshot();
    result.workspace = workspace;
    if (flags['dry-run'] && !flags['install-only']) {
      return { ...result, ok: true, phase: 'dry_run', abi, planned: ['build signed release', 'inspect APK and installed signer/version', 'install -r --user 0', 'verify installed APK hash', ...(flags.launch ? ['open launcher activity'] : [])] };
    }
    const receipt = flags['install-only'] ? await deps.existing() : await deps.build(abi);
    result.build = receipt;
    result.currentInputsDiffer = workspace.inputSha256 !== receipt.source.inputSha256;
    validateApk(receipt.apk.metadata, abi, null);
    const installed = await deps.installed(result.device.serial);
    validateUpdate(receipt.apk.metadata, installed);
    if (flags['dry-run']) return { ...result, ok: true, phase: 'dry_run', abi, planned: ['install recorded APK -r --user 0', 'verify installed APK hash', ...(flags.launch ? ['open launcher activity'] : [])] };
    result.phase = 'installing'; result.installation = 'uncertain';
    await deps.install(result.device.serial, receipt.apk.path);
    result.installation = 'completed'; result.phase = 'installed_unverified';
    result.verification = 'pending';
    const hash = await deps.hash(result.device.serial);
    result.installedApkSha256 = hash;
    if (hash !== receipt.apk.sha256) throw new WorkflowError('INSTALLED_HASH', 'Install completed, but installed APK does not match the built artifact. Inspect with npm run verify:device; no retry or rollback was attempted.');
    result.verification = 'passed'; result.phase = 'installed_verified';
    if (flags.launch) { await deps.launch(result.device.serial, receipt.apk.metadata.launcher); result.launched = true; }
    result.ok = true;
  } catch (error) {
    if (result.installation === 'completed' && result.verification !== 'passed') result.verification = 'failed';
    if (result.verification === 'passed') result.phase = 'installed_verified_launch_failed';
    else if (result.installation === 'uncertain') result.phase = 'installation_failed_or_uncertain';
    else if (result.installation !== 'completed') result.phase = 'failed';
    result.error = { code: error.code ?? 'ERROR', message: error.message };
    if (error.details?.retainReleaseLock) result.retainReleaseLock = true;
  }
  return result;
}
