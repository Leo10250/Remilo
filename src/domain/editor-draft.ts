import type { RecurrenceDraft, ReminderDraft, TimeConversion, TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { cleanRepeat } from './repeat';
import { civilAt, deviceZone } from './time';

export type EditorDraft = ReminderDraft & { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number };
export type EditorState = { draft: EditorDraft; recurrence?: RecurrenceDraft };
/** Only the mounted editor remembers a timed shape; this never enters a command or backup. */
export type TimedDraftSnapshot = { clock: string; durationMs: number; dueOffsetMs: number; alarmOffsetMs: number };
export const contentFields = ['title', 'notes', 'listId', 'sound', 'vibration'] as const;
const timingFields = ['eventStartMs', 'eventEndMs', 'dueAtMs', 'alarmAtMs', 'mode', 'allDay', 'zoneId', 'dueLinked', 'alarmLinked'] as const;
export type DraftConflict = { key: typeof contentFields[number] | 'schedule'; label: string; yours: unknown; latest: unknown };
export function reviewChoicesComplete(conflicts: DraftConflict[], choices: Partial<Record<DraftConflict['key'], 'yours' | 'latest'>>) {
  return conflicts.every((conflict) => choices[conflict.key] === 'yours' || choices[conflict.key] === 'latest');
}
const labels: Record<DraftConflict['key'], string> = { title: 'Title', notes: 'Notes', listId: 'List', sound: 'Sound', vibration: 'Vibration', schedule: 'Schedule and repeat' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only editable content enters a draft; operational occurrence fields stay native. */
export function editorDraft(record?: ReminderDraft, now = Date.now()): EditorDraft {
  const start = record?.eventStartMs ?? now + 600_000;
  return { title: record?.title ?? '', notes: record?.notes ?? '', listId: record?.listId ?? null, listName: record?.listName ?? '',
    eventStartMs: start, eventEndMs: record?.eventEndMs ?? start + 1_800_000, dueAtMs: record?.dueAtMs ?? start,
    alarmAtMs: record?.alarmAtMs ?? start, mode: record?.mode ?? 'Alarm', allDay: record?.allDay ?? false,
    zoneId: record?.zoneId ?? deviceZone(), dueLinked: record?.dueLinked ?? true, alarmLinked: record?.alarmLinked ?? true,
    ...(record?.sound ? { sound: record.sound } : {}), ...(record?.vibration != null ? { vibration: record.vibration } : {}) };
}
export function schedulePart(state: EditorState) {
  return { ...Object.fromEntries(timingFields.map((field) => [field, state.draft[field]])), recurrence: state.recurrence };
}
/** Preview reads schedule inputs only, without waiting for or validating private draft content. */
export function editorPreviewPayload({ draft, recurrence }: EditorState): ReminderDraft & { recurrence?: RecurrenceDraft } {
  const payload = { title: 'Preview', eventStartMs: draft.eventStartMs, eventEndMs: draft.eventEndMs,
    dueAtMs: draft.allDay && draft.dueLinked ? undefined : draft.dueAtMs,
    alarmAtMs: draft.allDay && draft.alarmLinked ? undefined : draft.alarmAtMs,
    mode: draft.mode, allDay: draft.allDay, zoneId: draft.zoneId, dueLinked: draft.dueLinked, alarmLinked: draft.alarmLinked,
    ...(recurrence ? { recurrence: cleanRepeat(recurrence) } : {}) };
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as ReminderDraft & { recurrence?: RecurrenceDraft };
}
export function reviewedTimedSnapshot(snapshot: TimedDraftSnapshot | null, previous: EditorState, next: EditorState, reload = false) {
  return reload || !same(schedulePart(previous), schedulePart(next)) ? null : snapshot;
}
/** Deliberately restoring a link resets its old offset rather than reviving a hidden schedule. */
export function relinkTimedSnapshot(snapshot: TimedDraftSnapshot | null, link: 'due' | 'alarm') {
  return snapshot ? { ...snapshot, [link === 'due' ? 'dueOffsetMs' : 'alarmOffsetMs']: 0 } : null;
}
export function chooseConflict(state: EditorState, conflict: DraftConflict, choice: 'yours' | 'latest'): EditorState {
  const selected = conflict[choice];
  if (conflict.key === 'schedule') {
    const { recurrence, ...timing } = selected as ReturnType<typeof schedulePart>;
    return { draft: { ...state.draft, ...timing }, recurrence };
  }
  return { ...state, draft: { ...state.draft, [conflict.key]: selected } };
}
/** Three-way review: accept remote-only changes, retain local-only changes, ask on collisions. */
export function reviewEditorDraft(base: EditorState, yours: EditorState, latest: EditorState) {
  let merged: EditorState = { draft: { ...latest.draft }, recurrence: latest.recurrence };
  const conflicts: DraftConflict[] = [];
  for (const key of [...contentFields, 'schedule'] as const) {
    const original = key === 'schedule' ? schedulePart(base) : base.draft[key];
    const mine = key === 'schedule' ? schedulePart(yours) : yours.draft[key];
    const theirs = key === 'schedule' ? schedulePart(latest) : latest.draft[key];
    if (same(mine, original)) continue;
    const conflict = { key, label: labels[key], yours: mine, latest: theirs };
    merged = chooseConflict(merged, conflict, 'yours');
    if (!same(theirs, original) && !same(mine, theirs)) conflicts.push(conflict);
  }
  return { merged, conflicts };
}

function followingDay(local: string) {
  const date = new Date(local.slice(0, 10) + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
type ConvertTime = (input: TimeConversionInput) => Promise<TimeConversion>;
/** Non-default or deliberately independent schedules must survive primary alert edits. */
export function hasSeparateEvent(draft: EditorDraft) {
  return !!draft.allDay || draft.dueLinked === false || draft.alarmLinked === false ||
    draft.dueAtMs !== draft.eventStartMs || draft.alarmAtMs !== draft.eventStartMs ||
    draft.eventEndMs - draft.eventStartMs !== 1_800_000;
}
/** The picker supplies a native-resolved instant. Ordinary schedules follow it. */
export async function moveDraftAlert(draft: EditorDraft, alarmAtMs: number, convert: ConvertTime, preserveEvent = false) {
  if (alarmAtMs === draft.alarmAtMs) return { draft, warnings: [] as string[] };
  if (preserveEvent || hasSeparateEvent(draft))
    return { draft: { ...draft, alarmAtMs, alarmLinked: false }, warnings: [] as string[] };
  return moveDraftEvent(draft, alarmAtMs, convert);
}
/** Calendar edits preserve the selected alert, including coincident and all-day times. */
function independentCalendarDraft(draft: EditorDraft) {
  return draft.mode === 'None' ? draft : { ...draft, alarmLinked: false };
}
export async function moveDraftCalendarEvent(draft: EditorDraft, eventStartMs: number, convert: ConvertTime) {
  if (eventStartMs === draft.eventStartMs) return { draft, warnings: [] as string[] };
  return moveDraftEvent(independentCalendarDraft(draft), eventStartMs, convert);
}
export async function changeCalendarAllDay(draft: EditorDraft, allDay: boolean, snapshot: TimedDraftSnapshot | null, convert: ConvertTime) {
  if (allDay === !!draft.allDay) return { draft, snapshot, warnings: [] as string[] };
  return changeDraftAllDay(independentCalendarDraft(draft), allDay, snapshot, convert);
}
function shiftedCivil(base: string, from: string, to: string) {
  return new Date(Date.parse(base + 'Z') + Date.parse(to + 'Z') - Date.parse(from + 'Z')).toISOString().slice(0, 19);
}
function adjustmentWarnings(values: TimeConversion[]) {
  const warnings = values.some((value) => value.adjustment === 'gapForward') ? ['A clock change moves a selected time forward. Check the resolved timing below.'] : [];
  if (values.some((value) => value.adjustment === 'earlierFold')) warnings.push('A repeated clock time uses its earlier offset.');
  return warnings;
}
function civilDifference(from: string, to: string) { return Date.parse(to + 'Z') - Date.parse(from + 'Z'); }
function offsetCivil(local: string, offset: number) { return new Date(Date.parse(local + 'Z') + offset).toISOString().slice(0, 19); }
/** All-day conversion preserves independent instants and restores the timed shape on the selected date. */
export async function changeDraftAllDay(draft: EditorDraft, allDay: boolean, snapshot: TimedDraftSnapshot | null, convert: ConvertTime) {
  if (allDay === !!draft.allDay) return { draft, snapshot, warnings: [] as string[] };
  const zoneId = draft.zoneId ?? deviceZone(), resolved: TimeConversion[] = [];
  const resolve = async (local: string) => { const time = await convert({ zoneId, local }); resolved.push(time); return time; };
  const eventLocal = civilAt(draft.eventStartMs, zoneId), date = eventLocal.slice(0, 10);
  let start: TimeConversion, end: number, due = draft.dueAtMs, alarm = draft.alarmAtMs;
  let nextSnapshot: TimedDraftSnapshot | null = null;
  if (allDay) {
    nextSnapshot = { clock: eventLocal.slice(11), durationMs: draft.eventEndMs - draft.eventStartMs,
      dueOffsetMs: draft.dueLinked ? civilDifference(eventLocal, civilAt(due, zoneId)) : 0,
      alarmOffsetMs: draft.alarmLinked ? civilDifference(civilAt(due, zoneId), civilAt(alarm, zoneId)) : 0 };
    start = await resolve(date + 'T00:00:00');
    end = (await resolve(followingDay(start.local) + 'T00:00:00')).instantMs;
    if (draft.dueLinked) due = end;
    if (draft.alarmLinked) alarm = (await resolve(start.local.slice(0, 10) + 'T09:00:00')).instantMs;
  } else {
    const timed = snapshot ?? { clock: '09:00:00', durationMs: 1_800_000, dueOffsetMs: 0, alarmOffsetMs: 0 };
    start = await resolve(date + 'T' + timed.clock);
    end = start.instantMs + timed.durationMs;
    if (draft.dueLinked) due = (await resolve(offsetCivil(start.local, timed.dueOffsetMs))).instantMs;
    if (draft.alarmLinked) alarm = (await resolve(offsetCivil(civilAt(due, zoneId), timed.alarmOffsetMs))).instantMs;
  }
  return { draft: { ...draft, allDay, eventStartMs: start.instantMs, eventEndMs: end, dueAtMs: due, alarmAtMs: alarm },
    snapshot: nextSnapshot, warnings: adjustmentWarnings(resolved) };
}
/** Linked due/alarm offsets are civil; a timed event's duration remains elapsed. */
export async function moveDraftEvent(draft: EditorDraft, eventStartMs: number, convert: ConvertTime) {
  if (eventStartMs === draft.eventStartMs) return { draft, warnings: [] as string[] };
  const zoneId = draft.zoneId ?? deviceZone(), resolved: TimeConversion[] = [];
  const resolve = async (local: string) => { const time = await convert({ zoneId, local }); resolved.push(time); return time; };
  const priorStart = civilAt(draft.eventStartMs, zoneId), nextStart = civilAt(eventStartMs, zoneId);
  let start = eventStartMs, end = eventStartMs + draft.eventEndMs - draft.eventStartMs;
  let due = draft.dueAtMs, alarm = draft.alarmAtMs;
  if (draft.allDay) {
    const day = await resolve(nextStart.slice(0, 10) + 'T00:00:00'); start = day.instantMs;
    end = (await resolve(followingDay(day.local) + 'T00:00:00')).instantMs;
    if (draft.dueLinked) due = end;
    if (draft.alarmLinked) alarm = (await resolve(day.local.slice(0, 10) + 'T09:00:00')).instantMs;
  } else if (draft.dueLinked) {
    const dueCivil = shiftedCivil(civilAt(draft.dueAtMs, zoneId), priorStart, nextStart);
    const movedDue = await resolve(dueCivil); due = movedDue.instantMs;
    if (draft.alarmLinked) alarm = (await resolve(shiftedCivil(civilAt(draft.alarmAtMs, zoneId), civilAt(draft.dueAtMs, zoneId), dueCivil))).instantMs;
  }
  return { draft: { ...draft, eventStartMs: start, eventEndMs: end, dueAtMs: due, alarmAtMs: alarm }, warnings: adjustmentWarnings(resolved) };
}
/** Editing an independent due time preserves a linked alarm's civil offset. */
export async function moveDraftDue(draft: EditorDraft, dueAtMs: number, convert: ConvertTime) {
  if (dueAtMs === draft.dueAtMs || !draft.alarmLinked || draft.allDay) return { draft: { ...draft, dueAtMs }, warnings: [] as string[] };
  const zoneId = draft.zoneId ?? deviceZone();
  const alarm = await convert({ zoneId, local: shiftedCivil(civilAt(draft.alarmAtMs, zoneId), civilAt(draft.dueAtMs, zoneId), civilAt(dueAtMs, zoneId)) });
  return { draft: { ...draft, dueAtMs, alarmAtMs: alarm.instantMs }, warnings: adjustmentWarnings([alarm]) };
}
/** Zone selection is an explicit clock-preserving edit; ordinary rendering never re-resolves an instant. */
export async function changeDraftZone(draft: EditorDraft, zoneId: string,
  convert: ConvertTime) {
  const previous = draft.zoneId ?? deviceZone();
  if (previous === zoneId) return { draft: { ...draft, zoneId }, warnings: [] as string[] };
  const startLocal = civilAt(draft.eventStartMs, previous);
  const start = await convert({ zoneId, local: draft.allDay ? startLocal.slice(0, 10) + 'T00:00:00' : startLocal });
  const end = draft.allDay ? await convert({ zoneId, local: followingDay(start.local) + 'T00:00:00' }) : null;
  const due = draft.allDay && draft.dueLinked ? end! : await convert({ zoneId, local: civilAt(draft.dueAtMs, previous) });
  const alarm = await convert({ zoneId, local: draft.allDay && draft.alarmLinked ? start.local.slice(0, 10) + 'T09:00:00' : civilAt(draft.alarmAtMs, previous) });
  return { draft: { ...draft, zoneId, eventStartMs: start.instantMs,
    eventEndMs: end?.instantMs ?? start.instantMs + draft.eventEndMs - draft.eventStartMs,
    dueAtMs: due.instantMs, alarmAtMs: alarm.instantMs }, warnings: adjustmentWarnings([start, due, alarm]) };
}
