import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from './actions';
import { repeatLabel } from './repeat';
export function repeatSummary(item: Pick<Occurrence, 'repeatRule' | 'repeatSummary'>) {
  return item.repeatRule ? repeatLabel(item.repeatRule) : item.repeatSummary;
}
export function stateTone(item: Pick<Occurrence, 'deliveryState' | 'completed' | 'skipped'>): Tone {
  if (item.completed) return 'success';
  if (['Blocked', 'Failed'].includes(item.deliveryState)) return 'danger';
  if (['Missed', 'TimedOut', 'Interrupted'].includes(item.deliveryState)) return 'warning';
  return item.deliveryState === 'Alerting' ? 'accent' : 'muted';
}
export function nextAlertTime(item: Occurrence) {
  return !item.completed && !item.deleted && !item.skipped && ['Scheduled', 'Pending', 'Changing', 'Blocked'].includes(item.deliveryState)
    ? item.nextAlertMs : null;
}
export function stateLabel(item: Pick<Occurrence, 'deliveryState' | 'nextAlertMs' | 'alarmAtMs' | 'completed' | 'skipped' | 'alertAdjustment'>) {
  if (item.completed) return 'Completed';
  if (item.skipped) return 'Skipped';
  if (item.deliveryState === 'Scheduled') return item.alertAdjustment ?? (item.nextAlertMs !== item.alarmAtMs ? 'Alarm changed' : '');
  return ({ Alerting: 'Ringing', Stopped: 'Alarm stopped', Missed: 'Alarm missed', TimedOut: 'Alarm timed out',
    Interrupted: 'Alarm interrupted', Blocked: 'Permission needed', Failed: 'Alarm could not play', Paused: 'Paused',
    Changing: 'Updating alarm', Pending: 'Scheduling', Notified: 'Notification sent', NoAlert: 'No alert' } as Record<string, string>)[item.deliveryState] ?? '';
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
