import { View } from 'react-native';
import { router } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';
import type {
  CalendarConnection,
  CalendarLinkedOperation,
  OwnedCalendar,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarOperationRetryable } from '../domain/calendar-link';
import type { OriginParams } from '../domain/navigation';
import { t } from '../localization';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Button, Choice, ConnectedGroup, Copy, Status } from './components';

export function calendarReadAccess(connection: CalendarConnection | undefined) {
  return (
    connection?.connected === true &&
    (connection.access === undefined ||
      connection.access === 'ownedCalendars' ||
      connection.access === 'managedCreation')
  );
}

export function calendarAuthorizationError(error: unknown) {
  return calendarErrorHasCode(error, 'CANCELLED') ? t('m_639a34a4219e') : calendarError(error);
}

export function calendarErrorHasCode(error: unknown, ...codes: string[]) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return codes.some((expected) => code.includes(expected));
}

export function calendarConnectionNeedsRefresh(error: unknown) {
  return calendarErrorHasCode(error, 'NEEDS_ACCESS', 'AUTH', 'STALE_CONNECTION', 'ACCOUNT_CHANGED');
}

export async function rememberCalendarConnection(client: QueryClient, next: CalendarConnection) {
  const queryKey = ['calendar', 'connection'];
  await client.cancelQueries({ queryKey });
  client.setQueryData<CalendarConnection>(queryKey, (previous) =>
    previous && previous.revision > next.revision ? previous : next,
  );
}

export function CalendarOwnedChoices({
  items,
  selectedId,
  busy,
  onSelect,
  onMore,
}: {
  items: OwnedCalendar[];
  selectedId?: string;
  busy: boolean;
  onSelect: (calendar: OwnedCalendar) => void;
  onMore?: () => void;
}) {
  const t = useTranslation();
  return (
    <>
      <ConnectedGroup>
        {items.map((calendar) => (
          <Choice
            key={calendar.id}
            label={calendar.name}
            description={calendar.zoneId}
            selected={selectedId === calendar.id}
            disabled={busy}
            onPress={() => onSelect(calendar)}
          />
        ))}
      </ConnectedGroup>
      {onMore && (
        <Button label={t('m_bea5fb6b1e61')} variant="secondary" disabled={busy} onPress={onMore} />
      )}
      {!items.length && !busy && <Copy>{t('m_0e913a16bf22')}</Copy>}
    </>
  );
}

export function LocalCalendarOperation({
  operation,
  busy,
  origin,
  onRetry,
  onReviewAgain,
}: {
  operation: CalendarLinkedOperation;
  busy: boolean;
  origin: OriginParams;
  onRetry?: () => void;
  onReviewAgain?: () => void;
}) {
  const t = useTranslation();
  const blocked = operation.localStatus === 'Blocked' || operation.localStatus === 'Partial';
  const pending = operation.localStatus === 'Pending';
  const waiting = operation.state === 'Waiting' || operation.state === 'Unconfirmed';
  const needsAccess = operation.state === 'NeedsAccess';
  const retryable = calendarOperationRetryable(operation);
  const { segmentId, occurrenceId } = operation;
  const route = segmentId
    ? { pathname: '/series/[id]' as const, params: { ...origin, id: segmentId } }
    : occurrenceId
      ? { pathname: '/reminder/[id]' as const, params: { ...origin, id: occurrenceId } }
      : null;
  return (
    <ConnectedGroup>
      <View style={{ padding: 16, gap: 12 }}>
        {!!operation.title && <Copy heading>{operation.title}</Copy>}
        {operation.localApplied ? (
          <Status
            label={t(blocked ? 'm_3e527a715fb1' : pending ? 'm_ac9a7eebef00' : 'm_2f149e066aaa')}
            tone={blocked || pending ? 'warning' : 'success'}
          />
        ) : (
          <ActionFeedback
            loading={busy || (waiting && !retryable)}
            tone="warning"
            message={
              waiting
                ? t(retryable ? 'ios_calendar_import_unconfirmed' : 'm_83743f87492a')
                : needsAccess
                  ? t('m_326e71c82f32')
                  : calendarError({ code: operation.reason })
            }
          />
        )}
        {operation.localApplied && route && (
          <Button
            label={t(segmentId ? 'm_0f5bb15eea00' : 'm_40ed00ddaacf')}
            variant="secondary"
            disabled={busy}
            onPress={() => router.push(route)}
          />
        )}
        {!operation.localApplied && retryable && onRetry && (
          <Button
            label={t('m_16003a1a9190')}
            variant="secondary"
            disabled={busy}
            onPress={onRetry}
          />
        )}
        {!operation.localApplied && !waiting && !needsAccess && onReviewAgain && (
          <Button
            label={t('m_d4ea61c79c9b')}
            variant="secondary"
            disabled={busy}
            onPress={onReviewAgain}
          />
        )}
      </View>
    </ConnectedGroup>
  );
}
