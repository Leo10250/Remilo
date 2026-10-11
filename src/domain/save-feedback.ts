import type { Capabilities, Command, CommandResult, ReminderDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback } from './actions';
import { modeLabel, scheduleDateTime } from './presentation';
import type { TimeDisplayOptions } from './time-display';

export type SaveContext = { kind: Command['kind']; mode?: ReminderDraft['mode'] };
export function saveFeedback(operation: SaveContext, result: CommandResult, observation: {
  access?: Capabilities; failed?: boolean; checking?: boolean;
} = {}, now = Date.now(), options: TimeDisplayOptions = {}) {
  const creation = operation.kind === 'Create' || operation.kind === 'CreateSeries';
  const repeat = operation.kind === 'CreateSeries' || operation.kind === 'EditSeries' || operation.kind === 'EditFollowing';
  const item = result.occurrence, mode = item?.mode ?? operation.mode ?? 'Alarm';
  let success = creation ? 'Reminder created' : 'Reminder updated';
  if (repeat) success = creation ? 'Repeating reminder created' : 'Repeat schedule updated';
  if (mode !== 'None' && result.status === 'Scheduled' && item && !item.completed && !item.deleted && !item.skipped &&
      item.deliveryState === 'Scheduled' && item.nextAlertMs != null && item.nextAlertMs > now)
    success = `${modeLabel(mode)} ${creation ? 'set' : 'updated'} · ${scheduleDateTime(item.nextAlertMs, item.nextAlertMs !== item.alarmAtMs ? undefined : item.zoneId, now, options)}`;
  else if (!repeat && mode === 'None') success += ' · No alert';
  const mixed = !!result.memberResults && result.status !== 'Applied' && result.status !== 'Scheduled';
  const feedback = commandFeedback(result, success);
  if (!mixed && result.status === 'Blocked') feedback.message = 'Reminder saved · Alert needs attention';
  if (!mixed && result.status === 'Pending') feedback.message = 'Reminder saved · Scheduling pending';
  const access = observation.access;
  const fresh = !!access && !observation.failed && !observation.checking && Math.abs(now - access.observedAtMs) <= 60_000;
  const blocker = fresh && mode !== 'None' && (!access.notifications || (mode === 'Alarm' ? !access.exactAlarms || !access.channelEnabled : !access.notificationChannelEnabled));
  const problem = ['Blocked', 'Pending', 'Partial'].includes(result.status) || mixed;
  return { ...feedback, persistent: problem, review: result.status === 'Blocked' && !mixed && blocker ? 'access' as const :
    problem ? repeat ? 'schedule' as const : 'reminder' as const : 'view' as const };
}
