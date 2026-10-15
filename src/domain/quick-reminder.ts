import { t } from '../localization';
import type { Command, CommandResult, CreateCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback as actionFeedback } from './actions';

export function quickReminder(title: string, minutes: string, now: number, operationId: string): CreateCommand {
  const delay = Number(minutes);
  if (!title.trim() || title.trim().length > 200) throw new Error(t('m_a28c03f64572'));
  if (!minutes.trim() || !Number.isFinite(delay) || delay < 1) throw new Error(t('m_d9471cc007ff'));
  const alarmAtMs = now + Math.round(delay * 60_000);
  if (!Number.isSafeInteger(alarmAtMs) || alarmAtMs > 8_640_000_000_000_000) throw new Error(t('m_9893f83cba30'));
  return { kind: 'Create', operationId, title: title.trim(), alarmAtMs };
}

export function commandFeedback(result: CommandResult, kind?: Command['kind']): string {
  switch (result.status) {
    case 'Scheduled': return t('m_897135b5f991');
    case 'Blocked': return t('m_3d4b2f828981');
    case 'Pending': return t('m_9bbdb5a75cf8');
    case 'Partial': return actionFeedback(result, '').message;
    case 'Applied': return kind === 'Done' || kind === 'CompleteDelivery' || kind === 'DoneAll' || result.occurrence?.completed ? t('m_7b359664f423')
      : kind === 'Stop' || kind === 'StopAll' ? t('m_87d39ab68d95')
      : kind === 'Snooze' || kind === 'SnoozeAll' || kind === 'Postpone' ? t('m_ee0e3ba1f353') : t('m_fca046ccd586');
    case 'Rejected': return result.errorCode === 'STALE_GENERATION'
      ? t('m_6e90807654c2')
      : result.errorMessage ?? t('m_c50c5580c7bb', { arg0: String(result.errorCode ?? 'unknown') });
  }
}
