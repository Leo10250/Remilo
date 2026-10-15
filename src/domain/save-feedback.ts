import { t } from '../localization';
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
  let success = creation ? t('m_0800b08d18a1') : t('m_87124f754c23');
  if (repeat) success = creation ? t('m_9a767486505e') : t('m_b615bef8dcb2');
  if (mode !== 'None' && result.status === 'Scheduled' && item && !item.completed && !item.deleted && !item.skipped &&
      item.deliveryState === 'Scheduled' && item.nextAlertMs != null && item.nextAlertMs > now)
    success = t(creation ? 'save_alert_created' : 'save_alert_updated', { mode: modeLabel(mode), time: scheduleDateTime(item.nextAlertMs, item.nextAlertMs !== item.alarmAtMs ? undefined : item.zoneId, now, options) });
  else if (!repeat && mode === 'None') success += t('m_686c6d1c1456');
  const mixed = !!result.memberResults && result.status !== 'Applied' && result.status !== 'Scheduled';
  const feedback = commandFeedback(result, success);
  if (!mixed && result.status === 'Blocked') feedback.message = t('m_3e527a715fb1');
  if (!mixed && result.status === 'Pending') feedback.message = t('m_ac9a7eebef00');
  const access = observation.access;
  const fresh = !!access && !observation.failed && !observation.checking && Math.abs(now - access.observedAtMs) <= 60_000;
  const blocker = fresh && mode !== 'None' && (!access.notifications || (mode === 'Alarm' ? !access.exactAlarms || !access.channelEnabled : !access.notificationChannelEnabled));
  const problem = ['Blocked', 'Pending', 'Partial'].includes(result.status) || mixed;
  return { ...feedback, persistent: problem, review: result.status === 'Blocked' && !mixed && blocker ? 'access' as const :
    problem ? repeat ? 'schedule' as const : 'reminder' as const : 'view' as const };
}
