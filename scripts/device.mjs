import { join } from 'node:path';
import { localEvidence } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools } from './lib/android-tools.mjs';
import { targetDevice, installedHash, compareApkHashes } from './lib/devices.mjs';
import { releaseApkPath } from './lib/build.mjs';
import { fileHash, writeJson } from './lib/files.mjs';

await cli(async () => {
  const flags = options(process.argv.slice(2), ['device']); allowedOptions(flags, ['device', 'json', 'help']);
  if (flags.help) return console.log('npm run verify:device -- [--device SERIAL] [--json]\nOptional read-only comparison of local and installed APK hashes. No receipts or Git attribution. Missing/different APKs are diagnostic; inspection errors fail. Never installs or declares alarm tests passed.');
  const report = { schemaVersion: 2, capturedAt: new Date().toISOString(), ok: false, physicalObservations: 'pending' };
  try {
    const tools = androidTools();
    report.device = await targetDevice(tools, flags.device);
    report.localApk = null;
    try {
      const path = releaseApkPath();
      report.localApk = { path, sha256: fileHash(path) };
    } catch (error) { if (error.code !== 'APK_MISSING') throw error; }
    report.installedApk = { sha256: await installedHash(tools, report.device.serial) };
    report.comparison = compareApkHashes(report.localApk?.sha256, report.installedApk.sha256);
    report.ok = true;
  } catch (error) { report.error = { code: error.code ?? 'ERROR', message: error.message }; }
  writeJson(join(localEvidence, 'device-preflight.json'), report);
  if (flags.json) console.log(JSON.stringify(report));
  else console.log(`APK comparison: ${report.ok ? report.comparison : report.error.message}. Physical observations: pending.\nPrivate report: ${join(localEvidence, 'device-preflight.json')}`);
  if (!report.ok) process.exitCode = 1;
});
