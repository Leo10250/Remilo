/** Synthetic, memory-only visual-review adapter. Never a scheduler or Android verification. */
import type { AppSettings, Command, CommandResult, ImportPreview, Occurrence, ReminderDraft, ReminderFilter, ReminderPage,
  ListRecord, RecurrenceDraft, RepeatFamily, ResolvedReminderDraft, SchedulePreview, Series, SoundPreviewSnapshot, TimeConversion, TimeConversionInput, TimeZoneOption } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt, deviceZone } from '../../src/domain/time';
import { repeatLabel } from '../../src/domain/repeat';
import { previewCalendar } from './preview-calendar';

const review = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
let settings: AppSettings = { revision: 1, snoozeMinutes: 10, tomorrowMorning: 600, tomorrowAfternoon: 840,
  tomorrowEvening: 1020, sound: 'remilo', vibration: true, theme: 'light', atmosphere: 'automatic' };
const reviewScene = review.get('reviewScene'), reviewBrightness = review.get('reviewBrightness');
if (reviewScene === 'automatic' || reviewScene === 'sunrise' || reviewScene === 'sky' || reviewScene === 'evening' || reviewScene === 'night') settings.atmosphere = reviewScene;
if (reviewBrightness === 'system' || reviewBrightness === 'light' || reviewBrightness === 'dark') settings.theme = reviewBrightness;
const today = new Date(); today.setHours(9, 0, 0, 0);
const dayMs = 86_400_000, clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const civilMs = (local: string) => Date.parse(local + 'Z');
const localAfterDays = (local: string, days: number) => new Date(civilMs(local) + days * dayMs).toISOString().slice(0, 19);
let identity = 0;
const nextId = () => 'fixture-' + ++identity;
const lists = new Map<string, ListRecord>([
  ['personal', { id: 'personal', name: 'Personal', revision: 1, overdueCount: 0 }],
  ['work', { id: 'work', name: 'Work', revision: 1, overdueCount: 0 }],
  ['health', { id: 'health', name: 'Health', revision: 1, overdueCount: 0 }],
]);
if (review.get('reviewLists') === 'empty') lists.clear();
if (review.get('reviewLists') === 'single') {
  for (const id of lists.keys()) if (id !== 'personal') lists.delete(id);
}
const make = (id: string, title: string, offset: number, changes: Partial<Occurrence> = {}): Occurrence => {
  const event = today.getTime() + offset;
  return { id, title, eventStartMs: event, eventEndMs: event + 1_800_000, dueAtMs: event, alarmAtMs: event, nextAlertMs: event,
    mode: 'Alarm', completed: false, deleted: false, skipped: false, revision: 1, generation: 1, deliveryState: 'Scheduled',
    notes: '', listName: '', listId: null, allDay: false, zoneId: 'America/Los_Angeles', dueLinked: true, alarmLinked: true, sound: 'remilo', vibration: true,
    segmentId: null, nominalSlot: null, exception: false, seriesState: null, repeatSummary: null, overdue: false, overdueAtMs: event,
    quickSnoozeMinutes: settings.snoozeMinutes, agendaGroup: '', agendaAtMs:event,
    history: [{ kind: 'Create', atMs: event - dayMs, targetMs: event }], ...changes };
};
const items: Occurrence[] = [
  make('parcel', 'Pick up the parcel', -dayMs, { deliveryState: 'Stopped', nextAlertMs: null, listName: 'Personal', listId: 'personal' }),
  make('dentist', 'Book the dentist', -2 * dayMs, { nextAlertMs: today.getTime() + dayMs, alertAdjustment: 'Postponed' }),
  make('review', 'Review the proposal', 5 * 3_600_000, { listName: 'Work', listId: 'work', notes: 'Review the summary and send your comments.' }),
  make('walk', 'Evening walk', 9 * 3_600_000, { segmentId: 'daily', repeatSummary: 'Every day', seriesState: 'Active' }),
  make('groceries', 'Groceries for the weekend', dayMs + 3 * 3_600_000),
  make('long', 'Prepare the complete presentation and supporting notes for the upcoming project review', 2 * dayMs, { listName: 'Work', listId: 'work' }),
  make('done', 'Pay the electricity bill', -dayMs, { completed: true, deliveryState: 'Completed', nextAlertMs: null,
    history: [{ kind: 'Done', atMs: today.getTime() - 3_600_000, targetMs: null }] }),
  make('skip', 'A skipped daily walk', -dayMs, { skipped: true, deliveryState: 'Skipped', nextAlertMs: null,
    segmentId: 'daily', nominalSlot: civilAt(today.getTime() - dayMs, 'America/Los_Angeles'),
    history: [{ kind: 'Skip', atMs: today.getTime() - 7_200_000, targetMs: null }] }),
  make('trash', 'An old reminder', -dayMs, { deleted: true, deliveryState: 'Deleted', nextAlertMs: null,
    history: [{ kind: 'Delete', atMs: today.getTime() - 1_800_000, targetMs: null }] }),
  make('paused', 'Stretch and take a break', dayMs, { segmentId: 'paused-series', seriesState: 'Paused', deliveryState: 'Paused', nextAlertMs: null, repeatSummary: 'Every day' }),
];
if (review.get('reviewCards') === 'states') {
  const now = Date.now(), zone = 'America/Los_Angeles', localStart = civilAt(now, zone).slice(0, 10) + 'T00:00:00';
  const allDayStart = convert({ zoneId: zone, local: localStart }).instantMs;
  const allDayEnd = convert({ zoneId: zone, local: localAfterDays(localStart, 1) }).instantMs;
  items.push(
    make('timed-out', 'An unanswered alarm', 0, { alarmAtMs: now - 180_000, nextAlertMs: null, deliveryState: 'TimedOut' }),
    make('notified', 'A delivered notification', 0, { mode: 'Notification', alarmAtMs: now - 3_600_000, nextAlertMs: null, deliveryState: 'Notified' }),
    make('no-alert-past', 'A saved reminder without an alert', 0, { mode: 'None', eventStartMs: now - 600_000, eventEndMs: now + 1_800_000,
      dueAtMs: now + dayMs, nextAlertMs: null, deliveryState: 'NoAlert', dueLinked: false }),
    make('no-alert-future', 'Future work with an earlier independent Due', 0, { mode: 'None', eventStartMs: now + dayMs, eventEndMs: now + dayMs + 1_800_000,
      dueAtMs: now - 600_000, nextAlertMs: null, deliveryState: 'NoAlert', dueLinked: false }),
    make('no-alert-all-day', 'An all-day reminder without an alert', 0, { mode: 'None', allDay: true, zoneId: zone,
      eventStartMs: allDayStart, eventEndMs: allDayEnd, dueAtMs: allDayEnd, nextAlertMs: null, deliveryState: 'NoAlert' }),
    make('blocked-alert', 'An alert blocked by permissions', 0, { alarmAtMs: now + 600_000, nextAlertMs: now + 600_000, deliveryState: 'Blocked' }),
    make('failed-alert', 'A notification delivery problem', 0, { mode: 'Notification', alarmAtMs: now - 180_000, nextAlertMs: null, deliveryState: 'Failed' }),
    make('done-repeat', 'A completed repeating reminder', -dayMs, { completed: true, deliveryState: 'Completed', nextAlertMs: null,
      listId: 'work', segmentId: 'daily', repeatSummary: 'Every day', exception: true, dueLinked: false, dueAtMs: now - 3_600_000 }),
    make('trash-completed', 'Completed work kept in Trash', -dayMs, { deleted: true, completed: true, deliveryState: 'Deleted', nextAlertMs: null }),
    make('trash-skipped', 'A skipped occurrence kept in Trash', -dayMs, { deleted: true, skipped: true, deliveryState: 'Deleted', nextAlertMs: null }),
  );
}
if (review.get('reviewSession') === 'ringing') {
  const now = Date.now();
  items.push(make('ring-one', 'First ringing reminder', 0, { alarmAtMs: now - 180_000, nextAlertMs: now - 180_000, deliveryState: 'Alerting' }),
    make('ring-two', 'Second ringing reminder', 0, { alarmAtMs: now - 180_000, nextAlertMs: now - 180_000, deliveryState: 'Alerting' }));
}
if (review.get('reviewText') === 'long') {
  lists.forEach((list) => { list.name += ' · Shared household and work review / 家庭与工作共同安排'; });
  items.forEach((item) => {
    item.title += ' · Check every detail and coordinate the next steps / 检查全部细节并确认下一步安排';
    item.notes = ('Review the complete proposal, confirm the arrangements with everyone involved, and keep the original Event, Due and Next alert separately visible.\n请仔细阅读完整说明，确认参与者的安排，并保留原始事件、截止时间和下一次提醒。长文本应自然换行，编辑时光标与操作按钮都必须保持可见。\n\n').repeat(4);
    item.listName = item.listId ? lists.get(item.listId)?.name ?? '' : '';
  });
}
const listeners = new Set<() => void>(), receipts = new Map<string, CommandResult>();
const lostReplies = new Set<string>();
const soundListeners = new Set<(snapshot: SoundPreviewSnapshot) => void>();
let soundPreview: SoundPreviewSnapshot | null = null;
const soundChanged = () => { if (soundPreview) soundListeners.forEach((fn) => fn(clone(soundPreview!))); };
function overdueReference(item: Occurrence) {
  if (item.mode !== 'None') return item.alarmAtMs;
  if (!item.allDay) return item.eventStartMs;
  const zone = item.zoneId || deviceZone(), localStart = civilAt(item.eventStartMs, zone).slice(0, 10) + 'T00:00:00';
  return convert({ zoneId: zone, local: localAfterDays(localStart, 1) }).instantMs;
}
const queryLists = () => {
  const now = Date.now();
  return [...lists.values()].map((list) => ({ ...list,
    overdueCount: items.filter((item) => item.listId === list.id && !item.completed && !item.deleted && !item.skipped && overdueReference(item) < now).length,
  })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
};
const changed = () => listeners.forEach((fn) => fn());

/** Intl approximates native civil conversion solely to make the web form interactive. */
function convert(input: TimeConversionInput): TimeConversion {
  const { zoneId } = input;
  const offsetAt = (instant: number) => (civilMs(civilAt(instant, zoneId)) - Math.floor(instant / 1_000) * 1_000) / 1_000;
  if (input.instantMs != null) return { zoneId, instantMs: input.instantMs, local: civilAt(input.instantMs, zoneId),
    offsetSeconds: offsetAt(input.instantMs), adjustment: 'none' };
  const nominal = civilMs(input.local);
  if (!Number.isFinite(nominal) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(input.local)) throw new Error('Choose a valid local time.');
  const offsets = [...new Set([-2, -1, 0, 1, 2].map((days) => offsetAt(nominal + days * dayMs)))];
  const candidates = offsets.map((offset) => nominal - offset * 1_000).sort((a, b) => a - b);
  const matching = candidates.filter((instant) => civilMs(civilAt(instant, zoneId)) === nominal);
  const instantMs = matching[0] ?? candidates.filter((instant) => civilMs(civilAt(instant, zoneId)) > nominal)
    .sort((a, b) => civilMs(civilAt(a, zoneId)) - civilMs(civilAt(b, zoneId)))[0];
  if (instantMs == null) throw new Error('This preview could not resolve the local time.');
  return { zoneId, instantMs, local: civilAt(instantMs, zoneId), offsetSeconds: offsetAt(instantMs),
    adjustment: matching.length > 1 ? 'earlierFold' : matching.length ? 'none' : 'gapForward' };
}
const zoneSeeds = [
  ['America/Los_Angeles', 'Los Angeles', 'United States'], ['US/Pacific', 'Los Angeles', 'United States'],
  ['America/New_York', 'New York', 'United States'], ['America/Chicago', 'Chicago', 'United States'],
  ['America/Denver', 'Denver', 'United States'], ['America/Toronto', 'Toronto', 'Canada'],
  ['America/Mexico_City', 'Mexico City', 'Mexico'], ['America/Sao_Paulo', 'São Paulo', 'Brazil'],
  ['Europe/London', 'London', 'United Kingdom'], ['Europe/Paris', 'Paris', 'France'],
  ['Europe/Berlin', 'Berlin', 'Germany'], ['Europe/Rome', 'Rome', 'Italy'], ['Europe/Helsinki', 'Helsinki', 'Finland'],
  ['Asia/Tokyo', 'Tokyo', 'Japan'], ['Asia/Seoul', 'Seoul', 'South Korea'], ['Asia/Shanghai', 'Shanghai', 'China'],
  ['Asia/Kolkata', 'Kolkata', 'India'], ['Asia/Dubai', 'Dubai', 'United Arab Emirates'], ['Asia/Singapore', 'Singapore', 'Singapore'],
  ['Australia/Sydney', 'Sydney', 'Australia'], ['Pacific/Auckland', 'Auckland', 'New Zealand'],
  ['Africa/Johannesburg', 'Johannesburg', 'South Africa'], ['UTC', 'UTC', 'Worldwide'], ['Etc/UTC', 'UTC', 'Worldwide'],
];
function zones(atMs: number): TimeZoneOption[] {
  const seeds = zoneSeeds.some(([id]) => id === deviceZone()) ? zoneSeeds : [...zoneSeeds, [deviceZone(), deviceZone().split('/').at(-1)!.replaceAll('_', ' '), 'Device time zone']];
  return seeds.map(([id, label, region]) => ({ id, label, region, offsetSeconds: convert({ zoneId: id, instantMs: atMs }).offsetSeconds }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}
function draft(input: Partial<ReminderDraft>, old?: Occurrence): Required<ReminderDraft> {
  const event = input.eventStartMs ?? input.alarmAtMs ?? old?.eventStartMs ?? Date.now() + 600_000;
  const value: Required<ReminderDraft> = { title: input.title ?? old?.title ?? '', eventStartMs: event,
    eventEndMs: input.eventEndMs ?? old?.eventEndMs ?? event + 1_800_000, dueAtMs: input.dueAtMs ?? old?.dueAtMs ?? event,
    alarmAtMs: input.alarmAtMs ?? old?.alarmAtMs ?? event, notes: input.notes ?? old?.notes ?? '', listName: '',
    listId: input.listId !== undefined ? input.listId : old?.listId ?? null,
    mode: input.mode ?? old?.mode ?? 'Alarm', allDay: input.allDay ?? old?.allDay ?? false, zoneId: input.zoneId ?? old?.zoneId ?? deviceZone(),
    dueLinked: input.dueLinked ?? old?.dueLinked ?? true, alarmLinked: input.alarmLinked ?? old?.alarmLinked ?? true,
    sound: input.sound ?? old?.sound ?? settings.sound, vibration: input.vibration ?? old?.vibration ?? settings.vibration };
  value.listName = value.listId ? lists.get(value.listId)?.name ?? '' : '';
  if (value.allDay) {
    const local = civilAt(event, value.zoneId).slice(0, 10) + 'T00:00:00';
    value.eventStartMs = convert({ zoneId: value.zoneId, local }).instantMs;
    value.eventEndMs = convert({ zoneId: value.zoneId, local: localAfterDays(local, 1) }).instantMs;
    if (value.dueLinked) value.dueAtMs = value.eventEndMs;
    if (value.alarmLinked) value.alarmAtMs = convert({ zoneId: value.zoneId, local: local.slice(0, 10) + 'T09:00:00' }).instantMs;
  }
  return value;
}
type StoredSeries = Series & { createdAtMs: number };
const series = new Map<string, StoredSeries>();
function createSeries(id: string, template: ResolvedReminderDraft, recurrence: RecurrenceDraft, family = id): StoredSeries {
  const value: StoredSeries = { id, seriesId: family, revision: 1, state: 'Active', exhausted: false, template: clone(template),
    rule: { ...clone(recurrence), anchor: civilAt(template.eventStartMs, template.zoneId),
      zoneId: recurrence.zoneMode === 'pinned' ? template.zoneId : null, endExclusive: null }, registered: 2, pending: 0, upcoming: [], createdAtMs: Date.now() };
  series.set(id, value); return value;
}
createSeries('daily', draft(items.find((item) => item.id === 'walk')!), { frequency: 'daily', interval: 1, zoneMode: 'floating' });
createSeries('paused-series', draft(items.find((item) => item.id === 'paused')!), { frequency: 'daily', interval: 1, zoneMode: 'floating' }).state = 'Paused';
items.filter((item) => item.segmentId && !item.nominalSlot).forEach((item) => { item.nominalSlot = civilAt(item.eventStartMs, item.zoneId); });

/** Small civil recurrence fixture for visual previews; native tests remain authoritative. */
function slots(template: ResolvedReminderDraft, spec: Series['rule'], limit = 3, after = Date.now()): SchedulePreview['upcoming'] {
  const zoneId = spec.zoneId ?? deviceZone(), anchor = new Date(civilMs(spec.anchor)), result: SchedulePreview['upcoming'] = [];
  const dueOffset = civilMs(civilAt(template.dueAtMs, template.zoneId)) - civilMs(spec.anchor);
  const alarmOffset = civilMs(civilAt(template.alarmAtMs, template.zoneId)) - civilMs(spec.anchor);
  let consumed = 0;
  for (let cycle = 0; cycle < 10_000 && result.length < limit; cycle++) {
    const base = new Date(anchor), candidates: Date[] = [];
    if (spec.frequency === 'daily') { base.setUTCDate(base.getUTCDate() + cycle * spec.interval); candidates.push(base); }
    else if (spec.frequency === 'weekly') {
      base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7) + cycle * spec.interval * 7);
      (spec.weekdays ?? [((anchor.getUTCDay() + 6) % 7) + 1]).forEach((weekday) => { const date = new Date(base); date.setUTCDate(date.getUTCDate() + weekday - 1); candidates.push(date); });
    } else {
      base.setUTCDate(1);
      if (spec.frequency === 'yearly') { base.setUTCFullYear(anchor.getUTCFullYear() + cycle * spec.interval); base.setUTCMonth((spec.month ?? anchor.getUTCMonth() + 1) - 1); }
      else base.setUTCMonth(anchor.getUTCMonth() + cycle * spec.interval);
      const month = base.getUTCMonth();
      if (spec.frequency === 'monthlyOrdinal') {
        const weekday = (spec.weekday ?? 1) % 7;
        if (spec.ordinal === -1) { base.setUTCMonth(month + 1, 0); base.setUTCDate(base.getUTCDate() - (base.getUTCDay() - weekday + 7) % 7); }
        else base.setUTCDate(1 + (weekday - base.getUTCDay() + 7) % 7 + ((spec.ordinal ?? 1) - 1) * 7);
      } else if (spec.frequency === 'lastWeekday') {
        base.setUTCMonth(month + 1, 0); while ([0, 6].includes(base.getUTCDay())) base.setUTCDate(base.getUTCDate() - 1);
      } else base.setUTCDate(spec.day ?? anchor.getUTCDate());
      if (base.getUTCMonth() === month) candidates.push(base);
    }
    for (const candidate of candidates.sort((a, b) => a.getTime() - b.getTime())) {
      if (candidate < anchor) continue;
      if (candidate.getUTCFullYear() > 9999) return result;
      const nominal = candidate.toISOString().slice(0, 19);
      if ((spec.endExclusive && nominal >= spec.endExclusive) || (spec.until && nominal.slice(0, 10) > spec.until) || (spec.count != null && ++consumed > spec.count)) return result;
      const event = convert({ zoneId, local: nominal });
      const alarm = convert({ zoneId, local: new Date(candidate.getTime() + alarmOffset).toISOString().slice(0, 19) });
      if (alarm.instantMs <= after) continue;
      result.push({ nominalSlot: nominal, eventStartMs: event.instantMs,
        dueAtMs: convert({ zoneId, local: new Date(candidate.getTime() + dueOffset).toISOString().slice(0, 19) }).instantMs,
        alarmAtMs: alarm.instantMs, adjusted: event.adjustment === 'gapForward' || alarm.adjustment === 'gapForward', zoneId });
      if (result.length >= limit) break;
    }
  }
  return result;
}
function seriesView(value: StoredSeries): Series {
  const upcoming = value.state === 'Archived' ? [] : slots(value.template, value.rule, 10).filter((slot) => !items.some((item) => item.segmentId === value.id && item.nominalSlot === slot.nominalSlot && (item.completed || item.deleted || item.skipped || item.exception))).slice(0, 3);
  return clone({ ...value, template: { ...value.template, listName: value.template.listId ? lists.get(value.template.listId)?.name ?? '' : '' }, exhausted: !upcoming.length, upcoming, registered: value.state === 'Active' ? upcoming.length : 0 });
}
function familyViews(): RepeatFamily[] {
  const grouped = new Map<string, StoredSeries[]>();
  series.forEach((value) => grouped.set(value.seriesId, [...(grouped.get(value.seriesId) ?? []), value]));
  return [...grouped].map(([seriesId, members]) => {
    const current = [...members].filter((member) => member.state !== 'Archived').sort((a, b) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id))[0] ?? members[0];
    const active = members.filter((member) => member.state !== 'Archived').map(seriesView);
    const upcoming = active.flatMap((member) => member.upcoming.map((slot) => ({ ...slot, segmentId: member.id })))
      .sort((a, b) => a.eventStartMs - b.eventStartMs || a.segmentId.localeCompare(b.segmentId)).slice(0, 3);
    return { seriesId, current: seriesView(current), state: !upcoming.length ? 'Ended' : active.filter((member) => member.upcoming.length).every((member) => member.state === 'Paused') ? 'Paused' : 'Active', upcoming,
      unfinishedCount: items.filter((item) => members.some((member) => member.id === item.segmentId) && !item.completed && !item.deleted && !item.skipped).length };
  });
}
function view(item: Occurrence, now=Date.now()): Occurrence {
  const value = clone(item);
  value.listName = value.listId ? lists.get(value.listId)?.name ?? '' : '';
  value.overdueAtMs = overdueReference(value);
  value.quickSnoozeMinutes = settings.snoozeMinutes;
  value.overdue = !value.completed && !value.deleted && !value.skipped && value.overdueAtMs < now;
  value.agendaAtMs = value.mode === 'None' ? value.eventStartMs : value.nextAlertMs ?? value.alarmAtMs;
  const eventDay = civilAt(value.agendaAtMs,deviceZone()).slice(0,10), currentDay=civilAt(now,deviceZone()).slice(0,10);
  value.agendaGroup = value.completed || value.skipped ? 'completed' : value.overdue ? 'overdue' : eventDay < currentDay ? 'earlier' : eventDay;
  const kind = value.deleted ? 'Delete' : value.completed ? 'Done' : value.skipped ? 'Skip' : null;
  if (kind) { const times = value.history?.filter((entry) => entry.kind === kind).map((entry) => entry.atMs) ?? [];
    value.collectionAtMs = times.length ? Math.max(...times) : value.eventStartMs; }
  return value;
}
function sessionActions() {
  const members = items.filter((item) => item.deliveryState === 'Alerting' && !item.completed && !item.deleted && !item.skipped)
    .map((item) => ({ occurrenceId: item.id, expectedGeneration: item.generation }));
  return members.length ? { sessionId: 'fixture-ringing-session', members, snoozeMinutes: settings.snoozeMinutes } : null;
}
function query(filter: ReminderFilter, cursor: string | null): ReminderPage {
  const now=Date.now(), start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
  const matches = (item: Occurrence) => (!filter.search || (item.title + ' ' + item.notes).toLowerCase().includes(filter.search.trim().toLowerCase())) &&
    (filter.listId === undefined || filter.listId === (item.listId ?? null)) && (!filter.listName || filter.listName === item.listName) &&
    (!filter.deliveryIssuesOnly || item.mode !== 'None' && ['Missed', 'TimedOut', 'Interrupted', 'Blocked', 'Failed'].includes(item.deliveryState)) && (!filter.segmentId || filter.segmentId === item.segmentId) &&
    (!filter.seriesId || series.get(item.segmentId ?? '')?.seriesId === filter.seriesId);
  const rows = items.map(item=>view(item,now)).filter((item) => matches(item) && (filter.view === 'deleted' ? item.deleted : !item.deleted &&
    (filter.view === 'completed' ? item.completed || !!filter.includeSkipped && item.skipped : filter.view === 'history' ? item.completed || item.skipped : !item.completed && !item.skipped)) &&
    (filter.view !== 'overdue' || item.overdue) && (!filter.overdueOnly || item.overdue) &&
    (filter.view !== 'today' || item.agendaAtMs >= start.getTime() && item.agendaAtMs < end.getTime()) &&
    (filter.view !== 'upcoming' || item.agendaAtMs >= end.getTime()));
  const rank = (item: Occurrence) => item.agendaGroup === 'overdue' ? 0 : item.agendaGroup === 'earlier' ? 1 : 2;
  const activeAnchor = (item: Occurrence) => item.agendaGroup === 'overdue' ? item.overdueAtMs : item.agendaAtMs;
  rows.sort((a, b) => ['completed', 'history', 'deleted'].includes(filter.view) ? (b.collectionAtMs ?? b.eventStartMs) - (a.collectionAtMs ?? a.eventStartMs) || b.eventStartMs - a.eventStartMs || a.id.localeCompare(b.id) :
    (['agenda','overdue','today','upcoming','attention'].includes(filter.view) ? rank(a)-rank(b) || activeAnchor(a)-activeAnchor(b) : a.eventStartMs-b.eventStartMs) || a.id.localeCompare(b.id));
  const groups: Record<string, number> = {}; rows.forEach((row) => { groups[row.agendaGroup] = (groups[row.agendaGroup] ?? 0) + 1; });
  const offset = Number(cursor ?? 0);
  return { items: rows.slice(offset, offset + 50), total: rows.length, nextCursor: offset + 50 < rows.length ? String(offset + 50) : null, groups,
    completedCount: items.filter((item) => !item.deleted && item.completed && matches(item)).length };
}
function addOccurrence(value: ResolvedReminderDraft, segment?: StoredSeries): Occurrence {
  const item = make(nextId(), value.title, 0, { ...value, listId: value.listId ?? null, history: [{ kind: 'Create', atMs: Date.now(), targetMs: value.alarmAtMs }],
    deliveryState: value.mode === 'None' ? 'NoAlert' : 'Scheduled', nextAlertMs: value.mode === 'None' ? null : value.alarmAtMs,
    ...(segment ? { segmentId: segment.id, nominalSlot: civilAt(value.eventStartMs, value.zoneId), seriesState: segment.state, repeatSummary: repeatLabel(segment.rule) } : {}) });
  items.push(item); return item;
}
function apply(command: Command): CommandResult {
  const receipt = receipts.get(command.operationId); if (receipt) return clone(receipt);
  let result: CommandResult = { status: 'Applied' };
  if (command.kind === 'Settings') {
    if (command.expectedRevision !== settings.revision) return { status: 'Rejected', errorCode: 'STALE_REVISION' };
    const { kind: _kind, operationId: _operation, expectedRevision: _revision, ...patch } = command;
    settings = { ...settings, ...patch, revision: settings.revision + 1 };
  } else if (command.kind === 'DoneAll' || command.kind === 'SnoozeAll') {
    const session = sessionActions();
    if (!session || command.expectedSessionId !== session.sessionId) return { status: 'Rejected', errorCode: 'STALE_SESSION' };
    if (command.kind === 'SnoozeAll' && command.snoozeMinutes !== settings.snoozeMinutes) return { status: 'Rejected', errorCode: 'STALE_SNOOZE_DURATION' };
    const captured = [...new Map(command.members.map((member) => [member.occurrenceId, member])).values()];
    if (!captured.length || captured.length !== command.members.length) return { status: 'Rejected', errorCode: 'INVALID_SESSION_MEMBERS' };
    const now = Date.now(), target = now + settings.snoozeMinutes * 60_000;
    let count = 0;
    const memberResults: NonNullable<CommandResult['memberResults']> = [];
    for (const member of captured) {
      const item = items.find((row) => row.id === member.occurrenceId);
      if (!item || item.generation !== member.expectedGeneration || item.deliveryState !== 'Alerting' || item.completed || item.deleted || item.skipped) {
        if (command.kind === 'SnoozeAll') memberResults.push({ occurrenceId: member.occurrenceId, generation: item?.generation ?? member.expectedGeneration, status: 'Superseded' });
        continue;
      }
      item.generation++; count++;
      if (command.kind === 'DoneAll') { item.completed = true; item.revision++; item.deliveryState = 'Completed'; item.nextAlertMs = null; }
      else { item.deliveryState = 'Scheduled'; item.nextAlertMs = target; item.alertAdjustment = 'Snoozed'; item.exception = !!item.segmentId;
        memberResults.push({ occurrenceId: item.id, generation: item.generation, status: 'Scheduled', targetMs: target }); }
      item.history ??= []; item.history.push({ kind: command.kind === 'DoneAll' ? 'Done' : 'Snooze', atMs: now, targetMs: command.kind === 'SnoozeAll' ? target : null });
    }
    result = { status: count === captured.length ? command.kind === 'SnoozeAll' ? 'Scheduled' : 'Applied' : count ? 'Partial' : 'Rejected',
      count, ...(command.kind === 'SnoozeAll' ? { memberResults } : {}), ...(count ? {} : { errorCode: 'STALE_GENERATION' }) };
  } else if (command.kind === 'CreateList' || command.kind === 'RenameList' || command.kind === 'RemoveList') {
    const old = command.kind === 'CreateList' ? null : lists.get(command.listId);
    if (command.kind !== 'CreateList' && !old) return { status: 'Rejected', errorCode: 'NOT_FOUND', errorMessage: 'This list was removed.' };
    if (command.kind !== 'CreateList' && old!.revision !== command.expectedRevision) return { status: 'Rejected', errorCode: 'STALE_REVISION' };
    if (command.kind === 'RemoveList') {
      lists.delete(command.listId);
      items.filter((item) => item.listId === command.listId).forEach((item) => { item.listId = null; item.listName = ''; item.revision++; });
      series.forEach((member) => { if (member.template.listId === command.listId) { member.template.listId = null; member.template.listName = ''; member.revision++; } });
    } else {
      const name = command.name.trim();
      if (!name || name.length > 60) return { status: 'Rejected', errorField: 'name', errorMessage: 'Enter a list name of up to 60 characters.' };
      if ([...lists.values()].some((list) => list.id !== old?.id && list.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return { status: 'Rejected', errorField: 'name', errorMessage: 'A list with this name already exists.' };
      const list: ListRecord = { id: old?.id ?? nextId(), name, revision: (old?.revision ?? 0) + 1, overdueCount: 0 };
      lists.set(list.id, list); result.list = clone(list);
    }
  } else if (command.kind === 'Create' || command.kind === 'CreateSeries') {
    if (!command.title.trim()) return { status: 'Rejected', errorField: 'title', errorMessage: 'Enter a title.' };
    if (command.listId && !lists.has(command.listId)) return { status: 'Rejected', errorField: 'listId', errorMessage: 'This list was removed. Choose an existing list or No list.' };
    const value = draft(command), segment = command.kind === 'CreateSeries' ? createSeries(nextId(), value, command.recurrence) : undefined;
    const item = addOccurrence(value, segment);
    result = { status: value.mode === 'None' ? 'Applied' : 'Scheduled', occurrence: view(item), ...(segment ? { segmentId: segment.id } : {}) };
  } else if ('occurrenceId' in command) {
    const item = items.find((row) => row.id === command.occurrenceId);
    if (!item) return { status: 'Rejected', errorCode: 'NOT_FOUND' };
    if ('expectedRevision' in command && item.revision !== command.expectedRevision) return { status: 'Rejected', errorCode: 'STALE_REVISION' };
    if ('expectedGeneration' in command && item.generation !== command.expectedGeneration) return { status: 'Rejected', errorCode: 'STALE_GENERATION' };
    if (command.kind === 'Purge') {
      if (!item.deleted) return { status: 'Rejected', errorCode: 'INVALID_INPUT', errorMessage: 'Only reminders in Trash can be deleted permanently.' };
      items.splice(items.indexOf(item), 1);
      receipts.set(command.operationId, result); changed(); return clone(result);
    }
    if (command.kind === 'Snooze' && command.expectedSnoozeMinutes != null && command.expectedSnoozeMinutes !== settings.snoozeMinutes)
      return { status: 'Rejected', errorCode: 'STALE_SNOOZE_DURATION' };
    if ((command.kind === 'Snooze' || command.kind === 'Postpone' || command.kind === 'CompleteDelivery') &&
        (item.completed || item.deleted || item.skipped || item.mode === 'None')) return { status: 'Rejected', errorCode: 'INACTIVE_OCCURRENCE' };
    if (command.kind === 'Edit') {
      if (command.listId && !lists.has(command.listId)) return { status: 'Rejected', errorField: 'listId', errorMessage: 'This list was removed. Choose an existing list or No list.' };
      Object.assign(item, draft(command, item)); item.revision++;
    }
    if (['Done', 'Reopen', 'Delete', 'UndoDelete', 'Skip'].includes(command.kind)) {
      if (command.kind === 'Done') item.completed = true;
      if (command.kind === 'Reopen') { item.completed = false; item.skipped = false; }
      if (command.kind === 'Delete') item.deleted = true;
      if (command.kind === 'UndoDelete') item.deleted = false;
      if (command.kind === 'Skip') item.skipped = true;
      item.revision++; item.generation++;
      item.deliveryState = item.deleted ? 'Deleted' : item.completed ? 'Completed' : item.skipped ? 'Skipped' : item.mode === 'None' ? 'NoAlert' : item.alarmAtMs > Date.now() ? 'Scheduled' : 'Missed';
      item.nextAlertMs = item.deliveryState === 'Scheduled' ? item.alarmAtMs : null;
    }
    if (command.kind === 'Stop' || command.kind === 'CompleteDelivery') { item.completed=true; item.revision++; item.deliveryState='Completed'; item.nextAlertMs=null; item.generation++; }
    if (command.kind === 'Postpone' || command.kind === 'Snooze') {
      item.nextAlertMs = command.kind === 'Postpone' ? command.alarmAtMs! : Date.now() + settings.snoozeMinutes * 60_000;
      item.deliveryState = 'Scheduled'; item.generation++; item.alertAdjustment = command.kind === 'Postpone' ? 'Postponed' : 'Snoozed'; item.exception = !!item.segmentId;
    }
    item.history ??= []; item.history.push({ kind: command.kind === 'Stop' || command.kind === 'CompleteDelivery' ? 'Done' : command.kind, atMs: Date.now(), targetMs: ['Postpone', 'Snooze'].includes(command.kind) ? item.nextAlertMs : null });
    result = { status: ['Edit', 'Postpone', 'Snooze'].includes(command.kind) && item.nextAlertMs ? 'Scheduled' : 'Applied', occurrence: view(item) };
  } else if ('segmentId' in command) {
    const old = series.get(command.segmentId);
    if (!old) return { status: 'Rejected', errorCode: 'NOT_FOUND' };
    if (old.revision !== command.expectedRevision) return { status: 'Rejected', errorCode: 'STALE_REVISION' };
    const family = [...series.values()].filter((member) => member.seriesId === old.seriesId && member.state !== 'Archived');
    if (command.kind === 'PauseSeries' || command.kind === 'ResumeSeries') {
      const state = command.kind === 'PauseSeries' ? 'Paused' : 'Active';
      family.forEach((member) => { member.state = state; member.revision++; });
      items.filter((item) => family.some((member) => member.id === item.segmentId) && !item.completed && !item.deleted && !item.skipped && !item.exception).forEach((item) => {
        item.seriesState = state; item.deliveryState = state === 'Paused' ? 'Paused' : item.mode === 'None' ? 'NoAlert' : item.alarmAtMs > Date.now() ? 'Scheduled' : 'Missed'; item.nextAlertMs = item.deliveryState === 'Scheduled' ? item.alarmAtMs : null;
      }); result.segmentId = old.id;
    } else if ('recurrence' in command) {
      if (command.listId && !lists.has(command.listId)) return { status: 'Rejected', errorField: 'listId', errorMessage: 'This list was removed. Choose an existing list or No list.' };
      const paused = old.state === 'Paused';
      if (command.kind === 'EditFollowing') { old.rule.endExclusive = command.nominalSlot ?? null; old.revision++; }
      else family.forEach((member) => { member.state = 'Archived'; member.revision++; });
      const next = createSeries(nextId(), draft(command), command.recurrence, old.seriesId); next.state = paused ? 'Paused' : 'Active';
      items.filter((item) => family.some((member) => member.id === item.segmentId) && !item.exception && !item.completed && !item.deleted && !item.skipped && (command.kind !== 'EditFollowing' || (item.nominalSlot ?? '') >= (command.nominalSlot ?? ''))).forEach((item) => { item.skipped = true; item.deliveryState = 'Skipped'; item.nextAlertMs = null; });
      const item = addOccurrence(next.template, next); if (next.state === 'Paused') { item.deliveryState = 'Paused'; item.nextAlertMs = null; }
      result = { status: next.state === 'Paused' ? 'Applied' : 'Scheduled', segmentId: next.id, occurrence: view(item) };
    }
  }
  receipts.set(command.operationId, clone(result)); changed(); return clone(result);
}
const preview = {
  ...previewCalendar(review, (id) => items.find((item) => item.id === id), changed),
  createOperationId: () => 'preview-operation-' + nextId(),
  addListener: (event: string, fn: (() => void) | ((snapshot: SoundPreviewSnapshot) => void)) => {
    if (event === 'onSoundPreviewState') { const callback = fn as (snapshot: SoundPreviewSnapshot) => void; soundListeners.add(callback); return { remove: () => { soundListeners.delete(callback); } }; }
    const callback = fn as () => void; listeners.add(callback); return { remove: () => { listeners.delete(callback); } };
  },
  getSettings: async () => clone(settings),
  getCapabilities: async () => {
    if (review.get('reviewPermissions') === 'error') throw new Error('Synthetic preview: permissions could not be checked.');
    const activeSessionActions = sessionActions();
    const allowed = review.get('reviewPermissions') !== 'blocked';
    return { exactAlarms: allowed, notifications: allowed, channelEnabled: allowed, notificationChannelEnabled: allowed,
      fullScreen: allowed, unlocked: true, observedAtMs: Date.now(), activeSessionId: activeSessionActions?.sessionId ?? '', activeSessionActions };
  },
  getTimeZones: async (atMs: number) => zones(atMs), convertTime: async (input: TimeConversionInput) => convert(input),
  queryReminders: async (filter: ReminderFilter, cursor: string | null) => query(filter, cursor),
  getOccurrence: async (id: string) => { const item = items.find((row) => row.id === id); return item ? view(item) : null; },
  getLists: async () => clone(queryLists()), queryLists: async () => clone(queryLists()),
  querySeries: async () => [...series.values()].filter((value) => value.state !== 'Archived').map(seriesView),
  queryRepeatFamilies: async () => clone(familyViews()),
  getSeries: async (id: string) => { const value = series.get(id); return value ? seriesView(value) : null; },
  getSeriesDraft: async (id: string, nominal: string) => { const value = series.get(id); if (!value) throw new Error('Repeat unavailable.');
    const eventStartMs = convert({ zoneId: value.rule.zoneId ?? deviceZone(), local: nominal }).instantMs, delta = eventStartMs - value.template.eventStartMs;
    return { template: draft({ ...value.template, eventStartMs, eventEndMs: value.template.eventEndMs + delta,
      dueAtMs: value.template.dueAtMs + delta, alarmAtMs: value.template.alarmAtMs + delta }), remainingCount: value.rule.count ?? null }; },
  previewSchedule: async (input: ReminderDraft & { recurrence?: RecurrenceDraft }): Promise<SchedulePreview> => {
    const value = draft(input), upcoming = input.recurrence ? slots(value, { ...input.recurrence,
      anchor: civilAt(value.eventStartMs, value.zoneId), zoneId: input.recurrence.zoneMode === 'pinned' ? value.zoneId : null, endExclusive: null }) : [];
    return { eventStartMs: value.eventStartMs, eventEndMs: value.eventEndMs, dueAtMs: value.dueAtMs, alarmAtMs: value.alarmAtMs,
      warnings: upcoming.some((slot) => slot.adjusted) ? ['A clock change adjusts a preview time.'] : [], upcoming };
  },
  applyCommand: async (command: Command) => {
    const result = apply(command);
    if (review.get('reviewLostReply') === '1' && result.status !== 'Rejected' && !lostReplies.has(command.operationId)) {
      lostReplies.add(command.operationId);
      throw new Error('Synthetic preview: the change was applied but its reply was lost. Retry the same change.');
    }
    return result;
  }, reconcile: async () => {}, openSettings: async () => {},
  scheduleTestAlarm: async (operationId: string): Promise<CommandResult> => {
    const result = apply({ kind: 'Create', operationId, title: 'Test alarm', eventStartMs: Date.now() + 15_000 });
    if (review.get('reviewLostReply') === '1' && !lostReplies.has(operationId)) {
      lostReplies.add(operationId); throw new Error('Synthetic preview: test reply lost.');
    }
    return result;
  },
  previewSound: async (sound: 'remilo' | 'system', requestId: string): Promise<SoundPreviewSnapshot> => {
    soundPreview = { sound, requestId, state: 'Failed', reason: 'SyntheticPreview' }; soundChanged(); return clone(soundPreview);
  },
  stopSoundPreview: async (requestId: string): Promise<SoundPreviewSnapshot | null> => {
    if (soundPreview?.requestId === requestId) { soundPreview = { ...soundPreview, state: 'Ended', reason: 'Stopped' }; soundChanged(); }
    return clone(soundPreview);
  },
  getSoundPreview: async (): Promise<SoundPreviewSnapshot | null> => clone(soundPreview),
  getDiagnostics: async () => ({ states: items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.deliveryState]: (counts[item.deliveryState] ?? 0) + 1 }), {}), pendingOperations: 0 }),
  exportBackup: async () => JSON.stringify({ format: 'Remilo synthetic preview', reminders: items.map(item=>view(item)) }),
  previewImport: async (_json: string): Promise<ImportPreview> => { throw new Error('File restoration requires the Android app.'); },
  importBackup: async (): Promise<CommandResult> => ({ status: 'Rejected', errorMessage: 'File restoration requires the Android app.' }),
};
export default preview;
