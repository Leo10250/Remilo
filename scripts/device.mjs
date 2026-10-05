import { join } from 'node:path';
import { localEvidence } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools } from './lib/android-tools.mjs';
import { targetDevice, installedHash } from './lib/devices.mjs';
import { existingBuild, sourceSnapshot } from './lib/build.mjs';
import { writeJson, withReleaseLock } from './lib/files.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2), ['device']); allowedOptions(flags, ['device', 'json', 'help']);
  if (flags.help) return console.log('npm run verify:device -- [--device SERIAL] [--json]\nRead-only preflight: compare installed APK to a recorded local build. Never installs or declares alarm tests passed.');
  const report = { schemaVersion: 1, capturedAt: new Date().toISOString(), ok: false, physicalObservations: 'pending',
    scenarios: ['offline-cold-process', 'locked', 'direct-boot', 'stop', 'snooze', 'five-minute-cutoff', 'recovery']
      .map((id) => ({ id, result: 'pending', measuredDurationMs: null, observer: null })) };
  await withReleaseLock(async () => {
    try {
      const tools = androidTools();
      report.workspace = await sourceSnapshot();
      report.device = await targetDevice(tools, flags.device);
      report.localBuild = await existingBuild(tools);
      const hash = await installedHash(tools, report.device.serial);
      report.installedBuild = { apkSha256: hash, matchesLocalApk: hash === report.localBuild.apk.sha256,
        source: hash === report.localBuild.apk.sha256 ? report.localBuild.source : null };
      report.ok = report.installedBuild.matchesLocalApk;
      if (!report.ok) report.error = { code: 'INSTALLED_MISMATCH', message: 'Installed Remilo does not match the recorded local APK. Deploy the intended build or record the separately tested build.' };
    } catch (error) { report.error = { code: error.code ?? 'ERROR', message: error.message }; }
    writeJson(join(localEvidence, 'device-preflight.json'), report);
  });
  if (flags.json) console.log(JSON.stringify(report));
  else console.log(`Preflight: ${report.ok ? 'matched installed APK' : report.error?.message}. Physical observations: pending.\nPrivate report: ${join(localEvidence, 'device-preflight.json')}`);
  if (!report.ok) process.exitCode = 1;
});
