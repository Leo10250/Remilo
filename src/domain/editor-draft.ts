import type { RecurrenceDraft, ReminderDraft, TimeConversion, TimeConversionInput } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt, deviceZone } from './time';

export type EditorDraft = ReminderDraft & { eventStartMs: number; eventEndMs: number; dueAtMs: number; alarmAtMs: number };
export type EditorState = { draft: EditorDraft; recurrence?: RecurrenceDraft };
export const contentFields = ['title', 'notes', 'listName', 'sound', 'vibration'] as const;
const timingFields = ['eventStartMs', 'eventEndMs', 'dueAtMs', 'alarmAtMs', 'mode', 'allDay', 'zoneId', 'dueLinked', 'alarmLinked'] as const;
export type DraftConflict = { key: typeof contentFields[number] | 'schedule'; label: string; yours: unknown; latest: unknown };
export function reviewChoicesComplete(conflicts: DraftConflict[], choices: Partial<Record<DraftConflict['key'], 'yours' | 'latest'>>) {
  return conflicts.every((conflict) => choices[conflict.key] === 'yours' || choices[conflict.key] === 'latest');
}
const labels: Record<DraftConflict['key'], string> = { title: 'Title', notes: 'Notes', listName: 'List', sound: 'Sound', vibration: 'Vibration', schedule: 'Timing and repeat' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only editable content enters a draft; operational occurrence fields stay native. */
export function editorDraft(record?: ReminderDraft, now = Date.now()): EditorDraft {
  const start = record?.eventStartMs ?? now + 600_000;
  return { title: record?.title ?? '', notes: record?.notes ?? '', listName: record?.listName ?? '',
    eventStartMs: start, eventEndMs: record?.eventEndMs ?? start + 1_800_000, dueAtMs: record?.dueAtMs ?? start,
    alarmAtMs: record?.alarmAtMs ?? start, mode: record?.mode ?? 'Alarm', allDay: record?.allDay ?? false,
    zoneId: record?.zoneId ?? deviceZone(), dueLinked: record?.dueLinked ?? true, alarmLinked: record?.alarmLinked ?? true,
    ...(record?.sound ? { sound: record.sound } : {}), ...(record?.vibration != null ? { vibration: record.vibration } : {}) };
}
export function schedulePart(state: EditorState) {
  return { ...Object.fromEntries(timingFields.map((field) => [field, state.draft[field]])), recurrence: state.recurrence };
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
function shiftedCivil(base: string, from: string, to: string) {
  return new Date(Date.parse(base + 'Z') + Date.parse(to + 'Z') - Date.parse(from + 'Z')).toISOString().slice(0, 19);
}
function adjustmentWarnings(values: TimeConversion[]) {
  const warnings = values.some((value) => value.adjustment === 'gapForward') ? ['A clock change moves a selected time forward. Check the resolved timing below.'] : [];
  if (values.some((value) => value.adjustment === 'earlierFold')) warnings.push('A repeated clock time uses its earlier offset.');
  return warnings;
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
