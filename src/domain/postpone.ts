import type { AppSettings, Occurrence, PostponeTimeInput, TimeConversion } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt } from './time';
import { canAdjustAlert } from './presentation';

export const postponeChoices = ['15', '30', '60', '1440', 'tomorrow-0', 'tomorrow-1', 'tomorrow-2', 'custom'] as const;
export type PostponeChoice = typeof postponeChoices[number];
export type PostponeCapture = {
  occurrenceId: string; expectedGeneration: number; title: string; referenceAtMs: number; zoneId: string;
  tomorrowMinutes: readonly [number, number, number];
};
/** Routine alerts retain their dedicated Start/Snooze/Dismiss flow. */
export function canPostponeReminder(item: Pick<Occurrence, 'completed' | 'deleted' | 'skipped' | 'mode' | 'deliveryState' | 'routine' | 'kind'> | null | undefined) {
  return !!item && !item.routine && item.kind !== 'RoutineFamily' && canAdjustAlert(item);
}
export function capturePostpone(item: Pick<Occurrence, 'id' | 'generation' | 'title'>,
  settings: Pick<AppSettings, 'tomorrowMorning' | 'tomorrowAfternoon' | 'tomorrowEvening'> | undefined,
  referenceAtMs: number, zoneId: string): PostponeCapture {
  return { occurrenceId: item.id, expectedGeneration: item.generation, title: item.title, referenceAtMs, zoneId,
    tomorrowMinutes: [settings?.tomorrowMorning ?? 600, settings?.tomorrowAfternoon ?? 840, settings?.tomorrowEvening ?? 1020] };
}
export function postponeCaptureMatches(capture: PostponeCapture, item: Pick<Occurrence, 'id' | 'generation'> | null | undefined) {
  return item?.id === capture.occurrenceId && item.generation === capture.expectedGeneration;
}
export function postponeTimeInput(choice: Exclude<PostponeChoice, 'custom'>, capture: PostponeCapture, referenceAtMs: number): PostponeTimeInput {
  return choice.startsWith('tomorrow-')
    ? { kind: 'Tomorrow', referenceAtMs, zoneId: capture.zoneId, minutesOfDay: capture.tomorrowMinutes[Number(choice.at(-1))] }
    : { kind: 'Relative', referenceAtMs, zoneId: capture.zoneId, minutes: Number(choice) as 15 | 30 | 60 | 1440 };
}
export type PostponeDraftState = {
  choice: PostponeChoice; target: TimeConversion | null; targets: Partial<Record<PostponeChoice, TimeConversion>>;
  resolving: boolean; customOpen: boolean; customDraft: TimeConversion | null; customInstantMs: number | null; error: unknown | null;
};
export const emptyPostponeDraft: PostponeDraftState = { choice: '15', target: null, targets: {}, resolving: false, customOpen: false, customDraft: null, customInstantMs: null, error: null };
type Resolve = (input: PostponeTimeInput) => Promise<TimeConversion>;

/** Presentation draft only. Every accepted value comes from the native civil-time policy. */
export class PostponeDraft {
  private state: PostponeDraftState = { ...emptyPostponeDraft, targets: {} };
  private listeners = new Set<() => void>();
  private ticket = 0;
  private lifecycle = 0;
  private previewTicket = 0;
  private closed = false;
  private frozen = false;
  constructor(readonly capture: PostponeCapture, private resolve: Resolve) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<PostponeDraftState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  setFrozen(value: boolean) {
    if (value && !this.frozen) { ++this.ticket; ++this.previewTicket; this.update({ resolving: false }); }
    this.frozen = value;
  }
  async initialize() {
    this.closed = false;
    const lifecycle = ++this.lifecycle;
    const ticket = ++this.ticket;
    this.update({ resolving: true });
    const choices = postponeChoices.filter((choice): choice is Exclude<PostponeChoice, 'custom'> => choice !== 'custom');
    const results = await Promise.allSettled(choices.map(choice => Promise.resolve().then(() => this.resolve(postponeTimeInput(choice, this.capture, this.capture.referenceAtMs)))));
    if (this.closed || this.frozen || lifecycle !== this.lifecycle) return;
    const targets: PostponeDraftState['targets'] = {};
    results.forEach((result, index) => { if (result.status === 'fulfilled') targets[choices[index]] = result.value; });
    this.update({ targets: { ...targets, ...this.state.targets }, ...(ticket === this.ticket ? {
      target: targets['15'] ?? null, resolving: false, error: targets['15'] ? null : results.find(result => result.status === 'rejected') } : {}) });
  }
  async refreshPreviews(referenceAtMs: number) {
    if (this.closed || this.frozen || this.state.resolving) return;
    const ticket = ++this.previewTicket, lifecycle = this.lifecycle;
    const choices = postponeChoices.filter((choice): choice is Exclude<PostponeChoice, 'custom'> => choice !== 'custom' && choice !== this.state.choice);
    const results = await Promise.allSettled(choices.map(choice => Promise.resolve().then(() => this.resolve(postponeTimeInput(choice, this.capture, referenceAtMs)))));
    if (this.closed || this.frozen || lifecycle !== this.lifecycle || ticket !== this.previewTicket) return;
    const targets = { ...this.state.targets };
    results.forEach((result, index) => { if (result.status === 'fulfilled' && choices[index] !== this.state.choice) targets[choices[index]] = result.value; });
    this.update({ targets });
  }
  async select(choice: Exclude<PostponeChoice, 'custom'>, referenceAtMs: number) {
    if (this.closed || this.frozen) return;
    const ticket = ++this.ticket;
    this.update({ resolving: true, error: null });
    try {
      const target = await this.resolve(postponeTimeInput(choice, this.capture, referenceAtMs));
      if (this.closed || this.frozen || ticket !== this.ticket) return;
      this.update({ choice, target, targets: { ...this.state.targets, [choice]: target }, resolving: false, error: null });
    } catch (error) { if (!this.closed && ticket === this.ticket) this.update({ resolving: false, error }); }
  }
  async openCustom(now: number) {
    if (this.closed || this.frozen || this.state.resolving) return;
    const ticket = ++this.ticket;
    this.update({ customOpen: true, customDraft: null, customInstantMs: null, resolving: true, error: null });
    try {
      const customDraft = this.state.target && this.state.target.instantMs > now ? this.state.target
        : await this.resolve({ kind: 'Relative', referenceAtMs: now, zoneId: this.capture.zoneId, minutes: 15 });
      if (this.closed || this.frozen || ticket !== this.ticket) return;
      this.update({ customDraft, customInstantMs: customDraft.instantMs, resolving: false, error: null });
    } catch (error) { if (!this.closed && ticket === this.ticket) this.update({ resolving: false, error }); }
  }
  async editCustom(instantMs: number, referenceAtMs: number) {
    if (this.closed || this.frozen || !this.state.customOpen) return;
    const ticket = ++this.ticket;
    this.update({ resolving: true, customInstantMs: instantMs, error: null });
    try {
      const customDraft = await this.resolve({ kind: 'Custom', referenceAtMs, zoneId: this.capture.zoneId, local: civilAt(instantMs, this.capture.zoneId) });
      if (this.closed || this.frozen || ticket !== this.ticket) return;
      this.update({ customDraft, resolving: false, error: null });
    } catch (error) { if (!this.closed && ticket === this.ticket) this.update({ resolving: false, error }); }
  }
  async useCustom(now: number) {
    if (this.closed || this.frozen || this.state.resolving || this.state.error || !this.state.customDraft || this.state.customDraft.instantMs !== this.state.customInstantMs || this.state.customDraft.instantMs <= now) return false;
    const ticket = ++this.ticket;
    this.update({ resolving: true, error: null });
    try {
      const target = await this.resolve({ kind: 'Custom', referenceAtMs: now, zoneId: this.capture.zoneId, local: this.state.customDraft!.local });
      if (this.closed || this.frozen || ticket !== this.ticket) return false;
      this.update({ choice: 'custom', target, targets: { ...this.state.targets, custom: target }, customOpen: false, customDraft: null, customInstantMs: null, resolving: false, error: null });
      return true;
    } catch (error) { if (!this.closed && ticket === this.ticket) this.update({ resolving: false, error }); return false; }
  }
  backToChoices() {
    if (this.closed || this.frozen) return;
    ++this.ticket;
    this.update({ customOpen: false, customDraft: null, customInstantMs: null, resolving: false, error: null });
  }
  close() { this.closed = true; ++this.ticket; ++this.lifecycle; ++this.previewTicket; }
}
