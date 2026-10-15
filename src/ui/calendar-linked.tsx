import { useTranslation } from '../localization/react';

import { View } from 'react-native';
import type { CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarOperationRetryable } from '../domain/calendar-link';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';

export function CalendarOperationStatus({ operation }: { operation: CalendarLinkedOperation }) {
  'use no memo';
  const t = useTranslation();
  const action = useCalendarAction(), auth = useCalendarAuthorization();
  const busy = action.busy || auth.waiting;
  const retry = async () => {
    if (busy) return;
    if (operation.state === 'NeedsAccess') await auth.start(operation.operationId);
    else await action.run({ kind: 'RetryCalendarOperation', operationId: operation.operationId });
  };
  return <ConnectedGroup><View key="status" style={{ padding: 16, gap: 12 }}>
    {!!operation.title && !operation.readOnly && <Copy heading>{operation.title}</Copy>}
    <Status tone={operation.state === 'Confirmed' ? 'success' : ['NeedsAccess', 'Failed'].includes(operation.state) ? 'danger' : ['Unconfirmed', 'Conflict', 'Blocked'].includes(operation.state) ? 'warning' : 'muted'} label={operation.state === 'Confirmed' ? t('m_b91efd0e05bc') : operation.state === 'Unconfirmed' ? t('m_151dc5ed7d18') : operation.state === 'NeedsAccess' ? t('m_2bac957cacfe') : operation.localApplied ? t('m_2f149e066aaa') : t('m_4ea875df7cbc')} />
    <Copy muted>{operation.calendarName || t('m_42dc73b15d7e')}</Copy>
    {operation.localApplied && !operation.readOnly && ['Blocked', 'Pending'].includes(operation.localStatus) && <Copy muted size={14}>{t('m_7beace9022e7')}{operation.localStatus === 'Blocked' ? t('m_9b71e79182a6') : t('m_9b69a5f441b4')}{t('m_b7ee2c99f338')}</Copy>}
    <Copy muted size={14}>{operation.state === 'Unconfirmed' ? t('m_a971d34d12a7') : operation.state === 'Conflict' ? t('m_1608b18fcf6e') : operation.state === 'NeedsAccess' ? t('m_547f8dce9dff') : operation.state === 'Confirmed' ? t('m_9268d2f929fe') : t('m_bb3718caff3c')}</Copy>
    {calendarOperationRetryable(operation) && <Button label={action.unknown ? t('m_16003a1a9190') : operation.recoveryMode === 'ConfirmOutcome' ? t('m_b4227f3ca91f') : operation.state === 'NeedsAccess' ? t('m_b724411569e0') : t('m_7f1bab881534')} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {busy && <ActionFeedback loading message={t('m_8edf41c03d72')} />}
    {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
    {!!action.error && <ActionFeedback message={action.error} tone="warning" />}
  </View></ConnectedGroup>;
}
