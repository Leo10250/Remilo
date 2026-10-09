import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import { repeatLabel } from './repeat';
import { civilAt, deviceZone } from './time';
export function repeatSummary(item: Pick<Occurrence, 'repeatRule' | 'repeatSummary'>) {
  return item.repeatRule ? repeatLabel(item.repeatRule) : item.repeatSummary;
}
export function stateTone(item: Pick<Occurrence, 'deliveryState' | 'completed' | 'skipped'> & { mode?: Occurrence['mode'] }): Tone {
  if (item.completed) return 'success';
  if (item.skipped || item.mode === 'None') return 'muted';
  if (['Blocked', 'Failed'].includes(item.deliveryState)) return 'danger';
  if (['Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)) return 'warning';
  return item.deliveryState === 'Alerting' ? 'accent' : 'muted';
}
export function nextAlertTime(item: Occurrence) {
  return !item.completed && !item.deleted && !item.skipped && item.mode !== 'None' && item.deliveryState === 'Scheduled'
    ? item.nextAlertMs : null;
}
export function stateLabel(item: Pick<Occurrence, 'deliveryState' | 'nextAlertMs' | 'alarmAtMs' | 'completed' | 'skipped' | 'alertAdjustment'> & { mode?: Occurrence['mode'] }) {
  if (item.completed) return 'Completed';
  if (item.skipped) return 'Skipped';
  if (item.mode === 'None') return 'No alert';
  if (item.deliveryState === 'Scheduled') return item.alertAdjustment ?? (item.nextAlertMs != null && item.nextAlertMs !== item.alarmAtMs ? 'Alert changed' : '');
  if (item.mode === 'Notification' && item.deliveryState === 'Missed') return 'Notification missed';
  return ({ Alerting: 'Ringing', Stopped: 'Alarm stopped', Missed: 'Alarm missed', TimedOut: 'Alarm timed out',
    Interrupted: 'Alarm interrupted', Blocked: 'Alert blocked', Failed: item.mode === 'Notification' ? 'Notification could not be sent' : 'Alarm could not play', Paused: 'Paused',
    Changing: 'Updating alert', SeriesChanging: 'Updating repeat', Pending: 'Scheduling', Notified: 'Notification sent', NoAlert: 'No alert' } as Record<string, string>)[item.deliveryState] ?? '';
}

export type ScheduleItem = Pick<Occurrence, 'eventStartMs' | 'eventEndMs' | 'dueAtMs' | 'alarmAtMs'> &
  Partial<Pick<Occurrence, 'allDay' | 'dueLinked' | 'alarmLinked' | 'mode' | 'zoneId' | 'nextAlertMs' | 'deliveryState' |
  'alertAdjustment' | 'completed' | 'deleted' | 'skipped' | 'repeatRule' | 'exception' | 'overdue'>>;
export function modeLabel(mode: ScheduleItem['mode']) { return mode === 'Notification' ? 'Notification' : mode === 'None' ? 'No alert' : 'Alarm'; }
export function ordinaryDue(item: ScheduleItem) {
  return item.dueLinked !== false && item.dueAtMs === (item.allDay ? item.eventEndMs : item.eventStartMs);
}
export function scheduleNeedsDetails(item: ScheduleItem, displayZone = deviceZone()) {
  return !ordinaryDue(item) || item.mode !== 'None' && item.alarmLinked === false ||
    item.mode !== 'None' && item.nextAlertMs != null && item.nextAlertMs !== item.alarmAtMs ||
    item.exception === true || item.repeatRule?.zoneMode === 'pinned' || !!item.zoneId && item.zoneId !== displayZone;
}
export function stateIcon(item: Pick<Occurrence, 'deliveryState' | 'completed' | 'deleted' | 'skipped'>) {
  if (item.deleted) return 'delete' as const;
  if (item.completed) return 'check_circle' as const;
  if (item.skipped) return 'cancel' as const;
  if (item.deliveryState === 'NoAlert') return 'alarm_off' as const;
  if (['Blocked', 'Failed'].includes(item.deliveryState)) return 'error' as const;
  if (['Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)) return 'warning' as const;
  const icons = { Alerting: 'alarm', Stopped: 'stop', Notified: 'notifications', Paused: 'pause',
    Scheduled: 'schedule', Pending: 'schedule', Changing: 'schedule', SeriesChanging: 'repeat' } as const;
  return icons[item.deliveryState as keyof typeof icons] ?? 'info';
}

/** Intended targets are distinct from confirmed upcoming delivery. Terminal states have no future promise. */
export function alertPresentation(item: ScheduleItem, draft = false, now = Date.now()) {
  const zone = item.zoneId || deviceZone(), mode = modeLabel(item.mode);
  const inactive = item.completed || item.deleted || item.skipped;
  const eligible = ['Scheduled', 'Pending', 'Changing', 'SeriesChanging', 'Blocked'].includes(item.deliveryState ?? 'Scheduled');
  const target = item.mode === 'None' ? null : draft || !item.deliveryState ? item.alarmAtMs : !inactive && eligible ? item.nextAlertMs ?? item.alarmAtMs : null;
  const changed = target != null && target !== item.alarmAtMs;
  const targetZone = changed && !draft ? deviceZone() : zone;
  const time = target == null ? '' : scheduleDateTime(target, targetZone, now);
  const state = item.deliveryState;
  const label = item.mode === 'None' ? 'No alert' : inactive ? `${mode} was set for ${scheduleDateTime(item.alarmAtMs, zone, now)}` :
    state === 'Blocked' ? `Alert blocked · intended for ${time}` : state === 'Pending' ? `Scheduling… · intended for ${time}` :
    state === 'Changing' || state === 'SeriesChanging' ? `Updating alert… · intended for ${time}` :
    state === 'Alerting' ? 'Alarm ringing' : target != null ? changed ?
      item.alertAdjustment === 'Snoozed' ? `${mode} snoozed to ${time}` : item.alertAdjustment === 'Postponed' ? `${mode} postponed to ${time}` : `Alert changed to ${time}` :
      `${mode} at ${time}` : 'No next alert scheduled';
  return { label, target, targetZone, changed, confirmed: !inactive && state === 'Scheduled' && item.mode !== 'None' };
}
/** Active browsing uses the phone zone so the time agrees with native date groups. */
export function agendaAlertPresentation(item: ScheduleItem & { agendaAtMs?: number }, now = Date.now()) {
  const zone = deviceZone(), mode = modeLabel(item.mode);
  if (item.mode === 'None') return 'No alert';
  if (item.deliveryState === 'Alerting') return 'Alarm ringing';
  const instant = item.agendaAtMs ?? item.nextAlertMs ?? item.alarmAtMs;
  const time = scheduleDateTime(instant, zone, now);
  if (item.deliveryState === 'Blocked') return `Alert blocked · intended for ${time}`;
  if (item.deliveryState === 'Pending') return `Scheduling… · intended for ${time}`;
  if (['Changing', 'SeriesChanging'].includes(item.deliveryState ?? '')) return `Updating alert… · intended for ${time}`;
  if (item.deliveryState !== 'Scheduled' || item.completed || item.deleted || item.skipped)
    return `${mode} was set for ${time}`;
  return item.alertAdjustment === 'Snoozed' ? `${mode} snoozed to ${time}` :
    item.alertAdjustment === 'Postponed' ? `${mode} postponed to ${time}` : `${mode} at ${time}`;
}
export function canAdjustAlert(item: Pick<Occurrence, 'completed' | 'deleted' | 'skipped' | 'mode' | 'deliveryState'>) {
  return !item.completed && !item.deleted && !item.skipped && item.mode !== 'None' &&
    !['Completed', 'Deleted', 'Skipped', 'Replaced', 'Paused', 'Changing', 'SeriesChanging'].includes(item.deliveryState);
}
export function recordedCompletionTime(history: Occurrence['history']) {
  const completed = history?.filter((entry) => entry.kind === 'Done');
  return completed?.length ? Math.max(...completed.map((entry) => entry.atMs)) : null;
}
export function deliveryExplanation(item: Pick<Occurrence, 'completed' | 'deleted' | 'skipped' | 'deliveryState' | 'mode'>) {
  if (item.deleted) return 'In Trash. Restore keeps its previous completion state.';
  if (item.completed || item.skipped || item.mode === 'None') return null;
  return ({ Stopped: 'Alarm stopped. Still unfinished.',
    TimedOut: 'Alarm timed out. Still unfinished.',
    Interrupted: 'Alarm interrupted. Still unfinished.',
    Missed: item.mode === 'Notification' ? 'Notification missed. Still unfinished.' : 'Alarm missed. Still unfinished.',
    Failed: item.mode === 'Notification' ? 'Notification could not be sent. Still unfinished.' : 'Alarm could not play. Still unfinished.',
    Blocked: 'The alert is blocked. Check permissions in Settings.',
    Pending: 'Scheduling is not yet confirmed.', Changing: 'The alert is being updated.', SeriesChanging: 'The repeat is being updated.' } as Record<string, string>)[item.deliveryState] ?? null;
}
export function calendarDate(value: number, zoneId = deviceZone(), now = Date.now()) {
  const date = civilAt(value, zoneId).slice(0, 10), today = civilAt(now, zoneId).slice(0, 10);
  if (date === today) return 'Today';
  const tomorrow = new Date(today + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: zoneId,
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}
export function scheduleDateTime(value: number, zoneId = deviceZone(), now = Date.now()) {
  return calendarDate(value, zoneId, now) + ' · ' + new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: zoneId });
}
export function eventRange(item: ScheduleItem, now = Date.now(), omitDate = false) {
  const zone = item.zoneId || deviceZone();
  if (item.allDay) return (omitDate ? '' : calendarDate(item.eventStartMs, zone, now) + ' · ') + 'All day';
  const time = (value: number) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: zone });
  return civilAt(item.eventStartMs, zone).slice(0, 10) === civilAt(item.eventEndMs, zone).slice(0, 10)
    ? (omitDate ? '' : calendarDate(item.eventStartMs, zone, now) + ' · ') + time(item.eventStartMs) + '–' + time(item.eventEndMs)
    : scheduleDateTime(item.eventStartMs, zone, now) + ' – ' + scheduleDateTime(item.eventEndMs, zone, now);
}
export function groupTitle(group: string, now = new Date()) {
  if (group === 'overdue') return 'Overdue';
  if (group === 'earlier') return 'Earlier';
  if (group === 'completed') return 'Completed';
  const date = new Date(group + 'T12:00:00');
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
