import type { AppSettings, CommandResult, DeliveryCommand, Occurrence, SessionCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { canPostponeReminder, capturePostpone, type PostponeCapture } from './postpone';
import { copyPostponeRequest, postponeRequestIdentity, type PostponeRequest } from './postpone-request';

export type PostponeOperation = DeliveryCommand | Extract<SessionCommand, { kind: 'PostponeAll' }>;
export type PostponeRead = { items: (Occurrence | null)[]; settings: AppSettings; sessionId?: string };
type Dependencies = { read: (request: PostponeRequest) => Promise<PostponeRead>; send: (command: PostponeOperation) => Promise<CommandResult>; id: () => string; now: () => number; zone: () => string };
export type PostponeControllerState = {
  destination: 'home' | 'details'; invalidRequest: boolean; request: PostponeRequest | null; capture: PostponeCapture | null; loading: boolean; submitting: boolean;
  uncertain: boolean; acknowledged: boolean; eligible: boolean; queued: boolean;
  result: CommandResult | null; targetMs: number | null; error: unknown; failure: 'load' | 'stale' | 'submit' | null;
};
const empty: PostponeControllerState = { destination: 'home', invalidRequest: false, request: null, capture: null, loading: false, submitting: false, uncertain: false, acknowledged: false, eligible: false, queued: false, result: null, targetMs: null, error: null, failure: null };
export function requestStillEligible(request: PostponeRequest, read: Pick<PostponeRead, 'items' | 'sessionId'>) {
  const members = request.kind === 'Single' ? [{ occurrenceId: request.occurrenceId, expectedGeneration: request.expectedGeneration }] : request.members;
  return (request.kind === 'Single' || request.expectedSessionId === read.sessionId) && members.every(member => {
    const item = read.items.find(item => item?.id === member.occurrenceId);
    return canPostponeReminder(item) && item?.generation === member.expectedGeneration;
  });
}
export function postponeHostPresentation(destination: 'home' | 'details', host: 'home' | 'details', focused: boolean, guarded: boolean) {
  return { visible: focused && (destination === host || guarded), navigateHome: focused && host === 'details' && destination === 'home' && !guarded };
}
/** One captured presentation/action owner. A transport failure retains the exact operation. */
export class PostponeController {
  private state: PostponeControllerState = { ...empty };
  private listeners = new Set<() => void>();
  private waiting: { request: PostponeRequest; destination: 'home' | 'details' }[] = [];
  private operation: PostponeOperation | null = null;
  private ticket = 0;
  constructor(private dependencies: Dependencies) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<PostponeControllerState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  isGuarded = () => this.state.submitting || this.state.uncertain || !!this.operation;
  invalidRequest() { this.update({ invalidRequest: true }); }
  open(request: PostponeRequest, destination: 'home' | 'details' = 'home') {
    const copied = copyPostponeRequest(request);
    if (this.state.request) {
      if (postponeRequestIdentity(copied) !== postponeRequestIdentity(this.state.request)) {
        if (!this.waiting.some(waiting => postponeRequestIdentity(waiting.request) === postponeRequestIdentity(copied))) this.waiting.push({ request: copied, destination });
        this.update({ queued: true, ...(destination === 'home' ? { destination } : {}) });
      } else if (destination === 'home') this.update({ destination });
      return;
    }
    this.update({ ...empty, request: copied, destination, queued: this.waiting.length > 0 });
    void this.load();
  }
  async load() {
    const request = this.state.request;
    if (!request || this.state.submitting || this.state.uncertain || this.operation) return;
    const ticket = ++this.ticket;
    this.update({ loading: true, failure: null, error: null });
    try {
      const read = await this.dependencies.read(request);
      if (ticket !== this.ticket) return;
      const referenceAtMs = this.dependencies.now(), zoneId = this.dependencies.zone();
      const eligible = requestStillEligible(request, read);
      const capture: PostponeCapture = request.kind === 'Single'
        ? capturePostpone({ id: request.occurrenceId, generation: request.expectedGeneration, title: read.items.find(item => item?.id === request.occurrenceId)?.title ?? '' }, read.settings, referenceAtMs, zoneId)
        : { kind: 'Group', expectedSessionId: request.expectedSessionId, members: request.members.map(member => ({ ...member })), referenceAtMs, zoneId,
          tomorrowMinutes: [read.settings.tomorrowMorning, read.settings.tomorrowAfternoon, read.settings.tomorrowEvening] };
      this.update({ capture, eligible, loading: false, failure: eligible ? null : 'stale' });
    } catch (error) { if (ticket === this.ticket) this.update({ loading: false, failure: 'load', error }); }
  }
  async refresh() {
    const request = this.state.request, ticket = this.ticket;
    if (!request || !this.state.capture || this.isGuarded() || this.state.acknowledged) return;
    try {
      const read = await this.dependencies.read(request);
      if (ticket !== this.ticket || this.isGuarded() || this.state.acknowledged) return;
      const eligible = requestStillEligible(request, read);
      this.update({ eligible, ...(eligible ? {} : { failure: 'stale' as const }) });
    } catch { /* Failed refresh never substitutes new identities or settings into a draft. */ }
  }
  select() { if (!this.isGuarded() && !this.state.acknowledged && this.state.eligible) this.update({ failure: null, error: null, result: null }); }
  submit(targetMs: number) {
    const request = this.state.request;
    if (!request || !this.state.capture || !this.state.eligible || this.isGuarded() || this.state.acknowledged || !Number.isSafeInteger(targetMs) || targetMs <= this.dependencies.now()) return;
    this.operation = request.kind === 'Single'
      ? { kind: 'Postpone', operationId: this.dependencies.id(), occurrenceId: request.occurrenceId, expectedGeneration: request.expectedGeneration, alarmAtMs: targetMs }
      : { kind: 'PostponeAll', operationId: this.dependencies.id(), expectedSessionId: request.expectedSessionId, members: request.members.map(member => ({ ...member })), alarmAtMs: targetMs };
    this.update({ targetMs });
    void this.run();
  }
  retry() { if (this.state.uncertain && !this.state.submitting && this.operation) void this.run(); }
  private async run() {
    const operation = this.operation;
    if (!operation || this.state.submitting) return;
    this.update({ submitting: true, failure: null, error: null });
    try {
      const result = await this.dependencies.send(operation);
      this.operation = null;
      if (result.status === 'Rejected') {
        this.update({ submitting: false, uncertain: false, eligible: false, result, failure: 'submit' });
        void this.refresh();
      } else this.update({ submitting: false, uncertain: false, acknowledged: true, result });
    } catch (error) { this.update({ submitting: false, uncertain: true, failure: 'submit', error }); }
  }
  close() {
    if (this.state.submitting || this.state.uncertain || this.operation) return false;
    ++this.ticket;
    const waiting = this.waiting.shift();
    this.update({ ...empty });
    if (waiting) this.open(waiting.request, waiting.destination);
    return true;
  }
}
