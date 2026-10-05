import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools } from './lib/android-tools.mjs';
import { listDevices, describeDevice } from './lib/devices.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2)); allowedOptions(flags, ['json', 'help']);
  if (flags.help) return console.log('npm run devices -- [--json]\nList authorized, unauthorized and offline Android targets. Does not pair or change devices.');
  const tools = androidTools(), devices = [];
  for (const device of await listDevices(tools)) {
    if (device.state !== 'device') devices.push(device);
    else {
      try { devices.push(await describeDevice(tools, device)); }
      catch (error) { devices.push({ ...device, inspectionError: error.message }); }
    }
  }
  if (flags.json) console.log(JSON.stringify({ ok: true, devices }));
  else if (!devices.length) console.log('No connected Android targets. Enable and approve USB debugging, or start an Android 14+ emulator.');
  else for (const device of devices) console.log(`${device.serial}  ${device.state}  ${device.model ?? ''}  API ${device.api ?? '?'}  ${(device.abis ?? []).join(',')}${device.inspectionError ? ` — ${device.inspectionError}` : ''}`);
});
