import { View } from 'react-native';
import type { CalendarLinkedOperation } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarOperationRetryable } from '../domain/calendar-link';
import { ActionFeedback, Button, ConnectedGroup, Copy, Status } from './components';
import { useCalendarAction, useCalendarAuthorization } from './calendar-sync';

export function CalendarOperationStatus({ operation }: { operation: CalendarLinkedOperation }) {
  const action = useCalendarAction(), auth = useCalendarAuthorization();
  const busy = action.busy || auth.waiting;
  const retry = async () => {
    if (busy) return;
    if (operation.state === 'NeedsAccess') await auth.start(operation.operationId);
    else await action.run({ kind: 'RetryCalendarOperation', operationId: operation.operationId });
  };
  return <ConnectedGroup><View key="status" style={{ padding: 16, gap: 12 }}>
    {!!operation.title && !operation.readOnly && <Copy heading>{operation.title}</Copy>}
    <Status tone={operation.state === 'Confirmed' ? 'success' : ['NeedsAccess', 'Failed'].includes(operation.state) ? 'danger' : ['Unconfirmed', 'Conflict', 'Blocked'].includes(operation.state) ? 'warning' : 'muted'} label={operation.state === 'Confirmed' ? 'Changes confirmed' : operation.state === 'Unconfirmed' ? 'Google update not confirmed' : operation.state === 'NeedsAccess' ? 'Google access needed' : operation.localApplied ? 'Reminder saved' : 'Calendar update waiting'} />
    <Copy muted>{operation.calendarName || 'Original Calendar destination'}</Copy>
    {operation.localApplied && !operation.readOnly && ['Blocked', 'Pending'].includes(operation.localStatus) && <Copy muted size={14}>At last save: {operation.localStatus === 'Blocked' ? 'alert blocked' : 'scheduling pending'}. Open the reminder for current readiness.</Copy>}
    <Copy muted size={14}>{operation.state === 'Unconfirmed' ? 'The update may already be in Google. Check its result before sending another.' : operation.state === 'Conflict' ? 'Both copies changed. Review the values to keep.' : operation.state === 'NeedsAccess' ? 'Reconnect the original Google account to continue this update.' : operation.state === 'Confirmed' ? 'The reviewed changes are confirmed.' : 'Your saved update will continue when its requirements are met.'}</Copy>
    {calendarOperationRetryable(operation) && <Button label={action.unknown ? 'Retry same request' : operation.recoveryMode === 'ConfirmOutcome' ? 'Check update result' : operation.state === 'NeedsAccess' ? 'Reconnect Google' : 'Try update again'} variant="secondary" disabled={busy} onPress={() => void retry()} />}
    {busy && <ActionFeedback loading message="Checking the saved update…" />}
    {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
    {!!action.error && <ActionFeedback message={action.error} tone="warning" />}
  </View></ConnectedGroup>;
}
