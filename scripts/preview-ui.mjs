import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { root, checked, localNode, toolEnvironment, WorkflowError } from './tools.mjs';
import { cli, options, allowedOptions } from './lib/cli.mjs';

export function previewEnvironment(base) { return { ...base, REMILO_UI_PREVIEW: '1', EXPO_NO_WEB_SETUP: '1' }; }
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await cli(async () => {
  const flags = options(process.argv.slice(2), ['port']); allowedOptions(flags, ['port', 'help']);
  if (flags.help) return console.log('npm run preview:ui -- [--port 8092]\nFixture-only web review; does not touch phone data or persist preview variables. Ctrl+C stops it.');
  const port = Number(flags.port ?? 8092);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new WorkflowError('PORT', 'Use a port from 1024 through 65535.');
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new WorkflowError('PORT_BUSY', `Port ${port} is unavailable. Use --port with another value; no process was stopped.`)));
    server.listen(port, () => server.close(resolve));
  });
  await checked(localNode(), [join(root, 'node_modules/expo/bin/cli'), 'start', '--web', '--offline', '--port', String(port)],
    { env: previewEnvironment(toolEnvironment()), stream: true, timeout: 0, cancelIsSuccess: true });
});
