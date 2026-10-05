/** Synthetic visual-review data. This module can never replace the Android engine. */
import type { AppSettings, Command, Occurrence, ReminderDraft, ReminderFilter, RecurrenceDraft, Series } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
let settings: AppSettings = { revision: 1, snoozeMinutes: 10, tomorrowMorning: 600, tomorrowAfternoon: 840,
  tomorrowEvening: 1020, sound: 'remilo', vibration: true, theme: 'light' };
const today = new Date(); today.setHours(9, 0, 0, 0);
const make = (id: string, title: string, offset: number, changes: Partial<Occurrence> = {}): Occurrence => {
  const event = today.getTime() + offset;
  return { id, title, eventStartMs: event, eventEndMs: event + 1800000, dueAtMs: event, alarmAtMs: event, nextAlertMs: event,
    mode: 'Alarm', completed: false, deleted: false, skipped: false, revision: 1, generation: 1, deliveryState: 'Scheduled',
    notes: '', listName: '', allDay: false, zoneId: 'America/Los_Angeles', dueLinked: true, alarmLinked: true, sound: 'remilo', vibration: true,
    segmentId: null, nominalSlot: null, exception: false, seriesState: null, repeatSummary: null, overdue: false, agendaGroup: '',
    history: [{ kind: 'Create', atMs: today.getTime() - 86400000, targetMs: event }], ...changes };
};
const items = [
  make('parcel', 'Pick up the parcel', -86400000, { overdue: true, deliveryState: 'Stopped', listName: 'Personal' }),
  make('dentist', 'Book the dentist', -2 * 86400000, { overdue: true, nextAlertMs: today.getTime() + 86400000 }),
  make('review', 'Review the proposal', 5 * 3600000, { listName: 'Work' }),
  make('walk', 'Evening walk', 9 * 3600000, { segmentId: 'daily', repeatSummary: 'Daily', seriesState: 'Active' }),
  make('groceries', 'Groceries for the weekend', 86400000 + 3 * 3600000),
  make('long', 'Prepare the complete presentation and supporting notes for the upcoming project review', 2 * 86400000, { listName: 'Work' }),
  make('done', 'Pay the electricity bill', -86400000, { completed: true, deliveryState: 'Done' }),
  make('skip', 'A skipped daily walk', -86400000, { skipped: true, deliveryState: 'Skipped' }),
  make('trash', 'An old reminder', -86400000, { deleted: true, deliveryState: 'Deleted' }),
  make('paused', 'Stretch and take a break', 86400000, { segmentId: 'paused-series', seriesState: 'Paused', deliveryState: 'Paused', repeatSummary: 'Daily' }),
];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());
const dateGroup = (item: Occurrence) => item.completed || item.skipped ? 'completed' : item.overdue ? 'overdue' :
  new Date(item.eventStartMs).toLocaleDateString('en-CA');
const seriesFor = (id: string): Series => ({ id, seriesId: id, revision: 1, state: id === 'paused-series' ? 'Paused' : 'Active', exhausted: false,
  template: items.find((item) => item.segmentId === id)!, rule: { frequency: 'daily', interval: 1, zoneMode: 'floating',
    anchor: new Date(today).toISOString().slice(0, 19), zoneId: null, endExclusive: null }, registered: 2, pending: 0,
  upcoming: [1, 2, 3].map((n) => ({ nominalSlot: String(n), eventStartMs: today.getTime() + n * 86400000, alarmAtMs: today.getTime() + n * 86400000 })) });
const preview = {
  createOperationId: () => 'preview-' + Math.random(),
  addListener: (_: string, fn: () => void) => { listeners.add(fn); return { remove: () => { listeners.delete(fn); } }; },
  getSettings: async () => ({ ...settings }),
  getCapabilities: async () => ({ exactAlarms: true, notifications: true, channelEnabled: true, notificationChannelEnabled: true,
    fullScreen: true, unlocked: true, observedAtMs: Date.now(), activeSessionId: '' }),
  queryReminders: async (filter: ReminderFilter, cursor: string | null) => {
    const rows = items.filter((item) => (filter.view === 'deleted' ? item.deleted : !item.deleted && (filter.view === 'completed'
      ? item.completed || filter.includeSkipped && item.skipped : !item.completed && !item.skipped)) && (filter.view !== 'overdue' || item.overdue) &&
      (!filter.search || (item.title + item.notes).toLowerCase().includes(filter.search.toLowerCase())) && (!filter.listName || filter.listName === item.listName) &&
      (!filter.segmentId || filter.segmentId === item.segmentId)).map((item) => ({ ...item, agendaGroup: dateGroup(item) }));
    rows.sort((a, b) => Number(!a.overdue) - Number(!b.overdue) || a.eventStartMs - b.eventStartMs);
    const groups: Record<string, number> = {}; rows.forEach((row) => { groups[row.agendaGroup] = (groups[row.agendaGroup] ?? 0) + 1; });
    const offset = Number(cursor ?? 0);
    return { items: rows.slice(offset, offset + 50), total: rows.length, nextCursor: null, groups, completedCount: 1 };
  },
  getOccurrence: async (id: string) => items.find((item) => item.id === id) ?? null,
  getLists: async () => ['Personal', 'Work'],
  querySeries: async () => [seriesFor('daily'), seriesFor('paused-series')],
  getSeries: async (id: string) => seriesFor(id),
  getSeriesDraft: async (id: string) => ({ template: seriesFor(id).template, remainingCount: null }),
  previewSchedule: async (draft: ReminderDraft & { recurrence?: RecurrenceDraft }) => ({ eventStartMs: draft.eventStartMs!,
    eventEndMs: draft.eventEndMs!, dueAtMs: draft.dueAtMs!, alarmAtMs: draft.alarmAtMs!, warnings: [], upcoming: draft.recurrence ? [0, 1, 2].map((n) => ({
      nominalSlot: String(n), eventStartMs: draft.eventStartMs! + n * 86400000, dueAtMs: draft.dueAtMs! + n * 86400000,
      alarmAtMs: draft.alarmAtMs! + n * 86400000, adjusted: false, zoneId: 'America/Los_Angeles' })) : [] }),
  applyCommand: async (command: Command) => {
    if (command.kind === 'Settings') settings = { ...settings, ...command, revision: settings.revision + 1 };
    if ('occurrenceId' in command) {
      const item = items.find((item) => item.id === command.occurrenceId);
      if (item) { if (command.kind === 'Done') item.completed = true; if (command.kind === 'Reopen') item.completed = false;
        if (command.kind === 'UndoDelete') item.deleted = false; if (command.kind === 'Delete') item.deleted = true; item.revision++; }
    }
    changed(); return { status: 'Applied' };
  },
  reconcile: async () => {}, openSettings: async () => {}, scheduleTestAlarm: async () => ({ status: 'Scheduled' }),
  previewSound: async () => ({ status: 'Applied' }), getDiagnostics: async () => ({ states: { Scheduled: 5, Stopped: 1 }, pendingOperations: 0 }),
};
export default preview;
