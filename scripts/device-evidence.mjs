import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { finished } from 'node:stream/promises';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { localEvidence, checked, WorkflowError } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';
import { androidTools } from './lib/android-tools.mjs';
import { targetDevice } from './lib/devices.mjs';
import { logArguments } from './lib/deployment.mjs';

await cli(async () => {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help') return console.log('node scripts/device-evidence.mjs logs|capture [--device SERIAL] [--follow (logs only)]');
  const flags = options(args, ['device']); allowedOptions(flags, mode === 'logs' ? ['device', 'follow', 'help'] : ['device', 'help']);
  if (flags.help) return console.log(`npm run device:${mode} -- [--device SERIAL]${mode === 'logs' ? ' [--follow]' : ''}\nPrivate local evidence only. No data clearing, navigation, log clearing or device setting changes.`);
  if (!['logs', 'capture'].includes(mode)) throw new WorkflowError('ARGUMENT', 'Expected logs or capture.');
  const tools = androidTools(), target = await targetDevice(tools, flags.device);
  const directory = join(localEvidence, mode); mkdirSync(directory, { recursive: true });
  const path = join(directory, `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.${mode === 'logs' ? 'log' : 'png'}`);
  if (mode === 'logs') {
    const output = createWriteStream(path); output.on('error', () => {});
    console.log(`Remilo-tagged logs: ${path}${flags.follow ? ' (Ctrl+C to finish)' : ''}`);
    try { await checked(tools.adb, logArguments(target.serial, flags.follow), { env: tools.env, outputFile: output, timeout: flags.follow ? 0 : 30_000, cancelIsSuccess: Boolean(flags.follow) }); }
    finally { output.end(); await finished(output); }
  } else {
    const result = await checked(tools.adb, ['-s', target.serial, 'exec-out', 'screencap', '-p'], { env: tools.env, binary: true });
    if (!result.stdout.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new WorkflowError('SCREENSHOT', 'Device did not return a valid PNG. No stale image was reused.');
    writeFileSync(path, result.stdout); console.log(`Screenshot: ${path}`);
  }
});
