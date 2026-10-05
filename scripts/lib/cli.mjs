import { ensureNode, WorkflowError } from '../tools.mjs';

export function options(args, valueFlags = []) {
  const parsed = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!flag.startsWith('--')) throw new WorkflowError('ARGUMENT', `Unexpected argument ${flag}. Use --help.`);
    const key = flag.slice(2);
    if (key in parsed) throw new WorkflowError('ARGUMENT', `Duplicate option ${flag}.`);
    if (valueFlags.includes(key)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new WorkflowError('ARGUMENT', `${flag} needs a value.`);
      parsed[key] = value;
    } else parsed[key] = true;
  }
  return parsed;
}
export function allowedOptions(parsed, allowed) {
  for (const key of Object.keys(parsed)) if (!allowed.includes(key)) throw new WorkflowError('ARGUMENT', `Unknown option --${key}. Use --help.`);
}
export async function cli(main) {
  try { ensureNode(); await main(); }
  catch (error) {
    if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, error: { code: error.code ?? 'ERROR', message: error.message, details: error.details ?? {} } }));
    else console.error(`${error.code ?? 'ERROR'}: ${error.message}`);
    process.exitCode = error.code === 'CANCELLED' ? 130 : 1;
  }
}
