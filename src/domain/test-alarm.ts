import type { CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

/** Preserve the native test identity until its acknowledgement is known. */
export class TestAlarmOperation {
  private operationId?: string;
  private inFlight?: Promise<CommandResult>;
  constructor(private adapter: { id: () => string; schedule: (operationId: string) => Promise<CommandResult> }) {}
  get pending() { return this.operationId !== undefined; }
  run() {
    if (this.inFlight) return this.inFlight;
    this.operationId ??= this.adapter.id();
    this.inFlight = this.adapter.schedule(this.operationId).then((result) => {
      this.operationId = undefined;
      return result;
    }).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }
}
