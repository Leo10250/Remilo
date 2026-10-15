import type { CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from './calendar';
import { calendarCaptureRejected } from './calendar-link';

export type CalendarActionState = { busy: boolean; unknown: boolean; operationId: string | null; error: string; feedback: string };
/** Retains the same command until native acknowledgement is known. */
export class CalendarAction {
  private pending: CalendarCommand | null = null;
  private state: CalendarActionState = { busy: false, unknown: false, operationId: null, error: '', feedback: '' };
  private listeners = new Set<() => void>();
  constructor(private apply: (command: CalendarCommand) => Promise<unknown>, private inspect: (id: string) => Promise<unknown>) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<CalendarActionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  async submit(command: CalendarCommand, feedback = ''): Promise<unknown> {
    if (this.state.busy) throw Object.assign(new Error('Calendar request already running'), { code: 'OPERATION_PENDING' });
    this.pending ??= command;
    const captured = this.pending;
    this.update({ busy: true, error: '', feedback: '' });
    try {
      let result: unknown;
      try { result = await this.apply(captured); }
      catch (error) {
        if (captured.kind !== 'RequestCalendarSync' || calendarCaptureRejected(error) || !await this.inspect(captured.operationId)) throw error;
      }
      this.pending = null; this.update({ unknown: false, operationId: captured.operationId, feedback }); return result ?? { operationId: captured.operationId };
    } catch (error) {
      const rejected = calendarCaptureRejected(error);
      if (rejected) this.pending = null;
      this.update({ unknown: !rejected, error: calendarError(error) }); throw error;
    } finally { this.update({ busy: false }); }
  }
  async run(command: CalendarCommand, feedback = ''): Promise<boolean> { try { await this.submit(command, feedback); return true; } catch { return false; } }
  async retry(): Promise<boolean> { return this.pending ? this.run(this.pending) : false; }
}
