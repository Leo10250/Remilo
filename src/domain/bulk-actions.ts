import { t, ownedMessage } from '../localization';
import type { CommandResult, ContentCommand, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type BulkKind = 'Reopen' | 'Delete' | 'UndoDelete' | 'Purge';
export type BulkEntry = Readonly<{ id: string; title: string; revision: number; operationId: string }>;
export type BulkJob = Readonly<{ id: string; kind: BulkKind; entries: readonly BulkEntry[] }>;
export type BulkOutcome = Readonly<{ entry: BulkEntry; result: CommandResult }>;
export type BulkProgress = { total: number; confirmed: number; rejected: number; pending: number; deliveryProblems: number };

/** Capture only this collection's eligible, loaded occurrences before any mutation. */
export function captureBulk(kind: BulkKind, items: readonly Occurrence[], id: () => string): BulkJob {
  const unique = [...new Map(items.map(item => [item.id, item])).values()];
  if (!unique.length) throw new Error(t('m_26893cdf630d'));
  if (unique.some(item => kind === 'UndoDelete' || kind === 'Purge' ? !item.deleted : item.deleted || !item.completed && !item.skipped))
    throw new Error(t('m_1babc510c7d1'));
  const identifiers = new Set<string>();
  const nextId = () => {
    const value = id();
    if (!value.trim() || value.length > 200 || identifiers.has(value)) throw new Error(t('m_41dc300e7f45'));
    identifiers.add(value); return value;
  };
  const jobId = nextId();
  return Object.freeze({ id: jobId, kind, entries: Object.freeze(unique.map(item => Object.freeze({
    id: item.id, title: item.title, revision: item.revision, operationId: nextId(),
  }))) });
}

/** Each child keeps its own native receipt; a batch does not promise atomicity. */
export class BulkOperation {
  private current?: BulkJob;
  private acknowledged: BulkOutcome[] = [];
  private flight?: Promise<void>;
  constructor(private perform: (command: ContentCommand) => Promise<CommandResult>, private changed: () => void = () => {}) {}
  get job() { return this.current; }
  get outcomes(): readonly BulkOutcome[] { return this.acknowledged.slice(); }
  get progress(): BulkProgress {
    const confirmed = this.acknowledged.filter(outcome => outcome.result.status !== 'Rejected');
    return { total: this.current?.entries.length ?? 0, confirmed: confirmed.length,
      rejected: this.acknowledged.length - confirmed.length,
      pending: (this.current?.entries.length ?? 0) - this.acknowledged.length,
      deliveryProblems: confirmed.filter(outcome => ['Blocked', 'Pending'].includes(outcome.result.status)).length };
  }
  get pending() { return this.progress.pending > 0; }
  clear() { if (!this.pending && !this.flight) { this.current = undefined; this.acknowledged = []; this.changed(); } }
  run(job: BulkJob) {
    if (this.flight) return this.flight;
    if (!this.pending) { this.current = job; this.acknowledged = []; }
    this.flight = this.drain().finally(() => { this.flight = undefined; });
    return this.flight;
  }
  private async drain() {
    const job = this.current!;
    for (let index = this.acknowledged.length; index < job.entries.length; index++) {
      const entry = job.entries[index];
      const result = await this.perform({ kind: job.kind, occurrenceId: entry.id, expectedRevision: entry.revision, operationId: entry.operationId });
      // Promise rejection pauses at this exact child. Only a native Rejected
      // receipt definitively rules out mutation; acknowledged prefixes stay put.
      this.acknowledged.push(Object.freeze({ entry, result }));
      this.changed();
    }
  }
}

export function bulkSummary(job: BulkJob, progress: BulkProgress) {
  const verb = job.kind === 'Purge' ? t('m_5ff691eab766') : job.kind === 'Delete' ? t('m_0513da39748f') : job.kind === 'UndoDelete' ? 'restored' : 'reopened';
  let message = t('m_273aa84c5997', { arg0: String(progress.pending ? t('m_7ac31405dcef') : ''), arg1: String(progress.confirmed), arg2: String(progress.total), arg3: String(ownedMessage(verb)) });
  if (progress.rejected) message += t('m_e1537036b472', { arg0: String(progress.rejected) });
  if (progress.pending) message += t('m_edc575259835', { arg0: String(progress.pending) });
  if (progress.deliveryProblems) message += t('m_32cacee293c2', { arg0: String(progress.deliveryProblems) });
  return message;
}
