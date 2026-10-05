import { checked, WorkflowError } from '../tools.mjs';
import { APP_ID, requireFiles } from './android-tools.mjs';

export function parseDevices(output) {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^(\S+)\s+(device|unauthorized|offline|recovery|sideload|bootloader|no permissions)(?:\s|$)(.*)/);
    return match ? [{ serial: match[1], state: match[2], description: match[3].trim() }] : [];
  });
}
export function selectDevice(devices, explicit, environmentSerial) {
  const requested = explicit ?? environmentSerial;
  if (!devices.length) throw new WorkflowError('NO_DEVICE', 'No Android device is connected. Connect USB, enable debugging and approve this computer; or start an Android 14+ emulator.');
  if (!requested && devices.length !== 1) throw new WorkflowError('MULTIPLE_DEVICES', 'More than one device is connected. Run npm run devices, then add --device SERIAL.', { devices });
  const target = requested ? devices.find((d) => d.serial === requested) : devices[0];
  if (!target) throw new WorkflowError('DEVICE_NOT_FOUND', 'Requested serial is not connected. Run npm run devices.');
  if (target.state !== 'device') throw new WorkflowError('DEVICE_NOT_READY', target.state === 'unauthorized'
    ? 'Unlock the selected device and approve its Allow USB debugging prompt, then retry.'
    : `Selected device is ${target.state}. Reconnect or finish booting, then retry.`, { device: target });
  return target;
}
export function deviceAbi(info) {
  if (!Number.isInteger(info.api) || info.api < 34) throw new WorkflowError('DEVICE_API', 'Remilo requires Android 14 / API 34 or newer.');
  const abi = ['arm64-v8a', 'x86_64'].find((value) => info.abis.includes(value));
  if (!abi) throw new WorkflowError('DEVICE_ABI', 'Remilo deployment supports ARM64 and x86-64 devices only.');
  return abi;
}
export async function adb(tools, serial, args, options = {}) {
  requireFiles(tools, ['adb']);
  return checked(tools.adb, serial ? ['-s', serial, ...args] : args, { env: tools.env, ...options });
}
export async function listDevices(tools) { return parseDevices((await adb(tools, null, ['devices', '-l'])).stdout); }
export async function describeDevice(tools, target) {
  const property = async (name) => (await adb(tools, target.serial, ['shell', 'getprop', name])).stdout.trim();
  return { ...target, model: await property('ro.product.model'), android: await property('ro.build.version.release'),
    api: Number(await property('ro.build.version.sdk')), abis: (await property('ro.product.cpu.abilist')).split(',').filter(Boolean),
    securityPatch: await property('ro.build.version.security_patch') };
}
export async function targetDevice(tools, requested) {
  return describeDevice(tools, selectDevice(await listDevices(tools), requested, process.env.ANDROID_SERIAL));
}
export function parseInstalledPath(output) {
  const paths = output.split(/\r?\n/).filter((line) => line.startsWith('package:')).map((line) => line.slice(8));
  if (paths.length !== 1 || !/^\/[A-Za-z0-9/+=_.~-]+\/base\.apk$/.test(paths[0])) throw new WorkflowError('INSTALLED_INSPECTION', 'Expected one readable installed Remilo base APK path for user 0; received a missing or unsupported path.');
  return paths[0];
}
export async function installedPath(tools, serial) {
  const list = (await adb(tools, serial, ['shell', 'pm', 'list', 'packages', '--user', '0', APP_ID])).stdout;
  if (!list.split(/\r?\n/).includes(`package:${APP_ID}`)) return null;
  const output = (await adb(tools, serial, ['shell', 'pm', 'path', '--user', '0', APP_ID])).stdout;
  return parseInstalledPath(output);
}
export async function installedHash(tools, serial) {
  const path = await installedPath(tools, serial);
  if (!path) return null;
  const output = (await adb(tools, serial, ['shell', 'sha256sum', path])).stdout;
  const hash = output.match(/^([a-f0-9]{64})\s/i)?.[1];
  if (!hash) throw new WorkflowError('INSTALLED_INSPECTION', 'Could not read installed APK hash. Unlock the device and retry.');
  return hash.toLowerCase();
}

export function compareApkHashes(local, installed) {
  if (!local && !installed) return 'unavailable';
  if (!local) return 'local_missing';
  if (!installed) return 'not_installed';
  return local === installed ? 'match' : 'different';
}
