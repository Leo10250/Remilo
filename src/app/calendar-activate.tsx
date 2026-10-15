import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import { View } from 'react-native';
import type { CalendarActivationReview, CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { calendarTransferText } from '../domain/calendar-ux';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, CheckRow, ConnectedGroup, Copy, Page, RowSupport, SettingRow } from '../ui/components';
import { CalendarOperationProgress } from '../ui/calendar-sync';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useAppearanceHold } from '../ui/theme';
import { engine, nativeAvailable } from '../ui/native';

export default function CalendarActivation() {
  const params = useLocalSearchParams<OriginParams & { operationId?: string }>(), origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const [review, setReview] = useState<CalendarActivationReview | null>(null), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false), [resultId, setResultId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const captured = useRef<CalendarCommand | null>(null), running = useRef(false), initialized = useRef(false), ticket = useRef(0);
  const operationId = resultId || params.operationId;
  useAppearanceHold(busy || unknown);
  usePreventRemove(capturing || unknown, () => confirm('Request not confirmed', 'Check or retry this same request before leaving.'));
  const load = useCallback(async () => {
    if (!nativeAvailable || running.current || captured.current || operationId) return;
    running.current = true; const current = ++ticket.current; setBusy(true); setError('');
    try {
      const links = await engine().getCalendarLinks(), candidates = links.filter(link => link.syncMode !== 'Automatic' && link.state !== 'Detached');
      const next = candidates.length ? await engine().previewCalendarActivation(candidates.map(link => link.occurrenceId)) : { items: [] };
      if (current !== ticket.current) return;
      const first = !initialized.current; initialized.current = true;
      setReview(next); setSelected(old => next.items.filter(item => item.preview && !item.excludedReason && (first || old.includes(item.occurrenceId))).map(item => item.occurrenceId));
    } catch (e) { if (current === ticket.current) setError(calendarError(e)); }
    finally { running.current = false; if (current === ticket.current) setBusy(false); }
  }, [operationId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const apply = async () => {
    if (running.current || !review) return;
    captured.current ??= { kind: 'ActivateCalendarLinks', operationId: engine().createOperationId(), previewIds: review.items.filter(item => selected.includes(item.occurrenceId) && item.preview && !item.excludedReason).map(item => item.preview!.previewId) };
    const command = captured.current; running.current = true; setBusy(true); setCapturing(true); setError('');
    try {
      await engine().applyCalendarCommand(command); setResultId(command.operationId); router.setParams({ operationId: command.operationId }); captured.current = null; setUnknown(false);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnknown(false); } else setUnknown(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); setCapturing(false); }
  };
  const ready = review?.items.filter(item => item.preview && !item.excludedReason) || [], attention = review?.items.filter(item => !item.preview || item.excludedReason) || [];
  return <Page compact title="Sync linked reminders" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}
    footer={!operationId && !!ready.length ? <BottomActionBar><Button label={unknown ? 'Retry same request' : `Turn on sync for ${selected.length} ${selected.length === 1 ? 'reminder' : 'reminders'}`} busy={busy} disabled={!unknown && (!selected.length || !!error)} onPress={() => void apply()} /></BottomActionBar> : undefined}>
    {operationId ? <><CalendarOperationProgress operationId={operationId} onAction={() => router.push({ pathname: '/calendar-reviews', params: origin })} />
      <Button label="Back to Calendar" variant="secondary" onPress={() => router.replace({ pathname: '/calendar', params: origin })} /></> : <>
      <Copy muted>Choose which linked reminders should stay up to date in both apps.</Copy>
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {busy && <ActionFeedback loading message={capturing ? 'Turning on sync…' : 'Checking linked reminders…'} />}
      {!!error && !unknown && <Button label="Check reminders again" variant="secondary" disabled={busy} onPress={() => void load()} />}
      {!!ready.length && <Copy heading>Ready to turn on · {ready.length}</Copy>}
      {ready.map(item => <ConnectedGroup key={item.occurrenceId}><View>
        <CheckRow label={item.preview!.local?.title || item.title || 'Linked reminder'} description={[item.preview!.calendarName, item.preview!.email].filter(Boolean).join(' · ')}
          selected={selected.includes(item.occurrenceId)} disabled={busy || unknown} onPress={() => setSelected(old => old.includes(item.occurrenceId) ? old.filter(id => id !== item.occurrenceId) : [...old, item.occurrenceId])} />
        <RowSupport><Copy muted size={14}>{calendarTransferText(item.preview!.transfers.inbound, item.preview!.transfers.outbound, item.preview!.equal)}</Copy></RowSupport>
      </View></ConnectedGroup>)}
      {!!attention.length && <Copy heading>Needs review · {attention.length}</Copy>}
      {attention.map(item => <ConnectedGroup key={item.occurrenceId}><View>
        <SettingRow label={item.preview?.local?.title || item.title || 'Linked reminder'} description={[item.calendarName, item.email].filter(Boolean).join(' · ')} />
        <RowSupport><Copy muted size={14}>{item.excludedReason || 'Check both copies before turning on sync.'}</Copy>
          <Button label="Review changes" variant="secondary" disabled={busy || unknown} onPress={() => router.push({ pathname: '/calendar-manage', params: { id: item.occurrenceId, ...origin } })} /></RowSupport>
      </View></ConnectedGroup>)}
      {review && !review.items.length && <Copy>No linked reminders need activation.</Copy>}
      {!!review?.items.length && <Copy muted size={14}>Titles, notes and event times stay in sync. Local alerts and completion stay in Remilo.</Copy>}
    </>}
  </Page>;
}
