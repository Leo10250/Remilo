import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export type RestoreJob = { json: string; copies: string[]; operationId: string };
type Adapter = { id: () => string; restore: (job: RestoreJob) => Promise<CommandResult> };

/** Keep the exact request until native acknowledges it, including a lost reply. */
export class RestoreOperation {
  private job?: RestoreJob;
  private inFlight?: Promise<CommandResult>;
  constructor(private adapter: Adapter) {}
  get pending() { return !!this.job; }
  run(json: string, copies: string[]) {
    if (this.inFlight) return this.inFlight;
    this.job ??= { json, copies: [...copies], operationId: this.adapter.id() };
    const job = this.job;
    this.inFlight = this.adapter.restore({ ...job, copies: [...job.copies] }).then((result) => {
      if (result.status === 'Rejected') {
        this.job = undefined;
        throw new Error(result.errorMessage ?? 'This backup could not be restored. Review the preview and try again.');
      }
      this.job = undefined;
      return result;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
}
