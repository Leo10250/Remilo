import { useLocalizedState, useTranslation } from '../localization/react';

import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type {
  CalendarConnection,
  CalendarLinkedOperation,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { iosManualCalendarError } from '../domain/calendar';
import {
  calendarOperationRetryable,
  iosManualLinkRecovery,
  isManualCalendarOperation,
} from '../domain/calendar-link';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';
import {
  calendarAuthorizationError,
  calendarReadAccess,
  rememberCalendarConnection,
} from './calendar-local-import';
import { engine } from './native';

export function isUnconfirmedManualCalendarSend(operation: CalendarLinkedOperation) {
  return (
    isManualCalendarOperation(operation) &&
    operation.state === 'Unconfirmed' &&
    operation.recoveryMode === 'ConfirmOutcome' &&
    operation.remoteAttempted &&
    !operation.readOnly
  );
}

export function CalendarOperationStatus({
  operation,
  iosConnection,
  onReviewAgain,
}: {
  operation: CalendarLinkedOperation;
  iosConnection?: CalendarConnection;
  onReviewAgain?: () => void;
}) {
  'use no memo';
  const t = useTranslation();
  const action = useCalendarAction(),
    auth = useCalendarAuthorization();
  const client = useQueryClient();
  const running = useRef(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useLocalizedState('');
  const recovery = iosConnection
    ? iosManualLinkRecovery(operation, calendarReadAccess(iosConnection))
    : null;
  const retryable = iosConnection ? recovery !== null : calendarOperationRetryable(operation);
  const busy = localBusy || action.busy || auth.waiting;
  const retryIOS = async () => {
    if (!iosConnection || !recovery || running.current) return;
    running.current = true;
    setLocalBusy(true);
    setError('');
    try {
      let revision = iosConnection.revision;
      if (recovery === 'reauthorizeCheck') {
        const next = await engine().authorizeCalendarFromUserAction!(
          revision,
          'reauthorizeCurrentAccount',
        );
        await rememberCalendarConnection(client, next);
        revision = next.revision;
      }
      await engine().applyCalendarCommand({
        kind: 'RetryCalendarOperation',
        operationId: operation.operationId,
        expectedConnectionRevision: revision,
      });
    } catch (e) {
      setError(
        recovery === 'reauthorizeCheck' ? calendarAuthorizationError(e) : iosManualCalendarError(e),
      );
    } finally {
      await client.invalidateQueries();
      running.current = false;
      setLocalBusy(false);
    }
  };
  const retry = async () => {
    if (busy) return;
    if (iosConnection) return retryIOS();
    if (operation.state === 'NeedsAccess') await auth.start(operation.operationId);
    else await action.run({ kind: 'RetryCalendarOperation', operationId: operation.operationId });
  };
  const manualDetail = !iosConnection
    ? null
    : recovery === 'reauthorizeCheck'
      ? 'ios_calendar_manual_reconnect_check'
      : operation.state === 'Conflict' || operation.state === 'Failed'
        ? operation.localApplied
          ? 'calendar_failed_local_saved'
          : 'calendar_failed_local_unapplied'
        : operation.state === 'Waiting'
          ? recovery === 'check'
            ? 'ios_calendar_manual_waiting_check'
            : 'ios_calendar_manual_waiting'
          : null;
  return (
    <ConnectedGroup>
      <View key="status" style={{ padding: 16, gap: 12 }}>
        {!!operation.title && !operation.readOnly && <Copy heading>{operation.title}</Copy>}
        <Status
          tone={
            operation.state === 'Confirmed'
              ? 'success'
              : ['NeedsAccess', 'Failed'].includes(operation.state)
                ? 'danger'
                : ['Unconfirmed', 'Conflict', 'Blocked'].includes(operation.state)
                  ? 'warning'
                  : 'muted'
          }
          label={
            operation.state === 'Confirmed'
              ? t('m_b91efd0e05bc')
              : operation.state === 'Unconfirmed'
                ? t('m_151dc5ed7d18')
                : operation.state === 'NeedsAccess'
                  ? t('m_2bac957cacfe')
                  : operation.localApplied
                    ? t('m_2f149e066aaa')
                    : t('m_4ea875df7cbc')
          }
        />
        <Copy muted>{operation.calendarName || t('m_42dc73b15d7e')}</Copy>
        {operation.localApplied &&
          !operation.readOnly &&
          ['Blocked', 'Pending'].includes(operation.localStatus) && (
            <Copy muted size={14}>
              {t('m_7beace9022e7')}
              {operation.localStatus === 'Blocked' ? t('m_9b71e79182a6') : t('m_9b69a5f441b4')}
              {t('m_b7ee2c99f338')}
            </Copy>
          )}
        <Copy muted size={14}>
          {manualDetail
            ? t(manualDetail)
            : operation.state === 'Unconfirmed'
              ? t('m_a971d34d12a7')
              : operation.state === 'Conflict'
                ? t('m_1608b18fcf6e')
                : operation.state === 'NeedsAccess'
                  ? t('m_547f8dce9dff')
                  : operation.state === 'Confirmed'
                    ? t('m_9268d2f929fe')
                    : t('m_bb3718caff3c')}
        </Copy>
        {retryable && (
          <Button
            label={
              action.unknown
                ? t('m_16003a1a9190')
                : recovery === 'reauthorizeCheck'
                  ? t('m_b724411569e0')
                  : recovery === 'check' || operation.recoveryMode === 'ConfirmOutcome'
                    ? t('m_b4227f3ca91f')
                    : operation.state === 'NeedsAccess'
                      ? t('m_b724411569e0')
                      : t('m_7f1bab881534')
            }
            variant="secondary"
            disabled={busy}
            onPress={() => void retry()}
          />
        )}
        {iosConnection &&
          onReviewAgain &&
          (operation.recoveryMode === 'ReviewAgain' ||
            isUnconfirmedManualCalendarSend(operation)) && (
            <Button
              label={t('m_d4ea61c79c9b')}
              variant="secondary"
              disabled={busy}
              onPress={onReviewAgain}
            />
          )}
        {busy && <ActionFeedback loading message={t('m_8edf41c03d72')} />}
        {!!auth.message && (
          <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />
        )}
        {!!(error || action.error) && (
          <ActionFeedback message={error || action.error} tone="warning" />
        )}
      </View>
    </ConnectedGroup>
  );
}
