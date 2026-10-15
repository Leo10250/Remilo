import { t, describeMessage, renderMessage, subscribeLanguage, errorText, type LocalizedMessage } from '../localization';
import type { AppSettings } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
export type PreferencePatch = Partial<Omit<AppSettings, 'revision'>>;
type Job = { patch: PreferencePatch; operationId: string; revision: number };
type Adapter = { read: () => Promise<AppSettings>; write: (job: Job) => Promise<void>; id: () => string };
export type PreferenceState = { data?: AppSettings; saving: boolean; error?: string; fields?: (keyof PreferencePatch)[] };

/** One lifetime for settings writes, including acknowledgement-uncertain retries. */
export class Preferences {
  private confirmed?: AppSettings;
  private queued: PreferencePatch = {};
  private job?: Job;
  private running = false;
  private errorFields: (keyof PreferencePatch)[] = [];
  private failure?: string | LocalizedMessage;
  private state: PreferenceState = { saving: false };
  private listeners = new Set<() => void>();
  constructor(private adapter: Adapter) { subscribeLanguage(() => { if (this.failure) this.publish(); }); }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  prime(data: AppSettings) {
    if (!this.job && (!this.confirmed || data.revision > this.confirmed.revision)) { this.confirmed = data; this.publish(); }
  }
  change(patch: PreferencePatch) {
    if (!this.job && patch.language) { this.state = { ...this.state, error: undefined }; this.failure = undefined; this.errorFields = []; }
    this.queued = { ...this.queued, ...patch };
    this.publish();
    if (!this.state.error) queueMicrotask(() => { void this.drain(); });
  }
  retry = () => { this.state = { ...this.state, error: undefined }; this.failure = undefined; this.publish(); void this.drain(); };
  private publish(error: string | LocalizedMessage | undefined = this.failure) {
    this.failure = typeof error === 'string' ? describeMessage(error) ?? error : error;
    this.state = { data: this.confirmed ? error ? this.confirmed : { ...this.confirmed, ...this.job?.patch, ...this.queued } : undefined,
      saving: this.running || (!error && (!!this.job || Object.keys(this.queued).length > 0)), error: typeof this.failure === 'object' ? renderMessage(this.failure) : this.failure,
      fields: [...new Set([...Object.keys(this.job?.patch ?? {}), ...Object.keys(this.queued), ...(error ? this.errorFields : [])])] as (keyof PreferencePatch)[] };
    this.listeners.forEach((listener) => listener());
  }
  private async drain() {
    if (this.running || this.state.error || !this.confirmed) return;
    this.running = true; this.publish();
    try {
      while (this.job || Object.keys(this.queued).length) {
        if (!this.job) { this.job = { patch: this.queued, revision: this.confirmed.revision, operationId: this.adapter.id() }; this.queued = {}; }
        try { await this.adapter.write(this.job); }
        catch (error) {
          if ((error as { code?: string }).code === 'STALE_REVISION') {
            const patch = { ...this.job.patch };
            this.confirmed = await this.adapter.read();
            // An external language choice invalidates the captured selection.
            if (patch.language) { delete patch.language; delete this.queued.language; this.errorFields = ['language']; }
            this.queued = { ...patch, ...this.queued }; this.job = undefined;
            throw new Error(t('m_b0a7d88e9aac'));
          }
          throw error;
        }
        // Keep the job until both acknowledgement and refreshed revision are known.
        this.confirmed = await this.adapter.read();
        this.job = undefined; this.publish();
      }
      this.running = false; this.publish(undefined);
    } catch (error) {
      this.running = false;
      const message = errorText(error, t('m_6f4e0ce4bfb0'));
      this.publish(describeMessage(message) ?? message);
    }
  }
}
