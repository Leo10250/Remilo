import { View } from 'react-native';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarOperationRetryable } from '../domain/calendar-link';
import { calendarError } from '../domain/calendar';
import { engine } from './native';
import { ActionFeedback, Button, ConnectedGroup, Copy } from './components';

export function CalendarOperationStatus({ operation }: { operation: CalendarLinkedOperation }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const client = useQueryClient();
  const retry = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      if (operation.state === 'NeedsAccess') await engine().authorizeCalendar(operation.operationId);
      else await engine().applyCalendarCommand({ kind: 'RetryCalendarOperation', operationId: operation.operationId });
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { setError(calendarError(e)); } finally { setBusy(false); }
  };
  return <ConnectedGroup title="Calendar operation"><View key="status" style={{ padding: 16, gap: 12 }}>
    {!!operation.title && !operation.readOnly && <Copy heading>{operation.title}</Copy>}
    <Copy heading>{operation.state === 'Confirmed' ? 'Confirmed' : operation.localApplied ? 'Local change saved' : 'Calendar request saved'}</Copy>
    <Copy muted>{operation.calendarName || 'Original Calendar destination'}</Copy>
    {operation.localApplied && !operation.readOnly && <Copy>Local save result: {operation.localStatus === 'Scheduled' ? 'Alert was scheduled' : operation.localStatus === 'Blocked' ? 'Alert was blocked' : operation.localStatus === 'Pending' ? 'Scheduling was pending' : 'Saved'}</Copy>}
    <Copy>{operation.message}</Copy>
    {calendarOperationRetryable(operation) && <Button label={operation.recoveryMode === 'ConfirmOutcome' ? 'Confirm sent outcome' : operation.state === 'NeedsAccess' ? 'Authorize and retry' : 'Retry same operation'} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {busy && <ActionFeedback loading message="Continuing saved operation…" />}
    {!!error && <ActionFeedback message={error} tone="warning" />}
  </View></ConnectedGroup>;
}
