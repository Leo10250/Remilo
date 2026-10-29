import { WorkflowError } from '../tools.mjs';

export function crashLogArguments(serial) {
  return ['-s', serial, 'logcat', '-b', 'crash', '-v', 'threadtime', '-d', '-t', '2000', 'AndroidRuntime:E', '*:S'];
}
export function validateEvidenceLogOptions(flags) {
  if (flags.crashes && flags.follow) throw new WorkflowError('ARGUMENT', '--crashes is a bounded snapshot and cannot be combined with --follow.');
}

/** Classify complete PID-scoped AndroidRuntime blocks in memory before any persistence. */
export function extractRemiloCrashes(source) {
  const blocks = [], active = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+(\d+)\s+\d+\s+[EF]\s+AndroidRuntime\s*:\s?(.*)$/.exec(line);
    if (!match) continue;
    const [, pid, message] = match;
    let block = active.get(pid);
    if (!block || /^FATAL EXCEPTION:/.test(message) || /^Process:/.test(message) && block.processSeen) {
      block = { lines: [], accepted: false, processSeen: false }; blocks.push(block); active.set(pid, block);
    }
    block.lines.push(line);
    if (/^Process:/.test(message)) {
      block.processSeen = true;
      const process = /^Process: com\.remilo\.app, PID: (\d+)\s*$/.exec(message);
      block.accepted = process?.[1] === pid;
    }
  }
  const accepted = blocks.filter(block => block.accepted);
  return { blocks: accepted.length, text: accepted.map(block => block.lines.join('\n')).join('\n\n') + (accepted.length ? '\n' : '') };
}

/** Never propagate raw stdout/stderr through a workflow failure or output sink. */
export async function collectRemiloCrashes(serial, { run, persist }) {
  let result;
  try { result = await run(crashLogArguments(serial)); }
  catch { throw new WorkflowError('CRASH_LOG_FAILED', 'Could not read the bounded Android crash buffer. No raw crash output was saved. Normal Remilo-tagged logs remain available.'); }
  if (result.status !== 0) throw new WorkflowError('CRASH_LOG_FAILED', 'Android did not provide the bounded crash buffer. No raw crash output was saved. Normal Remilo-tagged logs remain available.');
  const filtered = extractRemiloCrashes(result.stdout);
  await persist(filtered.text);
  return { blocks: filtered.blocks };
}
