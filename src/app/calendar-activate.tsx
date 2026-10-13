import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import type { CalendarActivationReview, CalendarCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { calendarReviewReason } from '../domain/calendar-presentation';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Page } from '../ui/components';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useAppearanceHold } from '../ui/theme';
import { engine, nativeAvailable } from '../ui/native';

export default function CalendarActivation() {
  const params = useLocalSearchParams<OriginParams>(), origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const [review, setReview] = useState<CalendarActivationReview | null>(null), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false), [children, setChildren] = useState<string[]>([]);
  const captured = useRef<CalendarCommand | null>(null), live = useRef(true), running = useRef(false);
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  useAppearanceHold(busy || unknown);
  usePreventRemove(busy || unknown, () => confirm('Activation not confirmed', 'Wait or retry the same captured activation before leaving.'));
  const load = async () => {
    if (running.current || captured.current) return;
    running.current = true; setBusy(true); setError('');
    try {
      const links = await engine().getCalendarLinks(), candidates = links.filter(link => link.syncMode !== 'Automatic' && link.state !== 'Detached');
      const next = candidates.length ? await engine().previewCalendarActivation(candidates.map(link => link.occurrenceId)) : { items: [] };
      if (live.current) { setReview(next); setSelected(next.items.filter(item => item.preview && !item.excludedReason).map(item => item.occurrenceId)); }
    } catch (e) { if (live.current) setError(calendarError(e)); }
    finally { running.current = false; if (live.current) setBusy(false); }
  };
  useEffect(() => { live.current = true; void Promise.resolve().then(load); return () => { live.current = false; }; }, []);
  const apply = async () => {
    if (running.current || !review) return;
    captured.current ??= { kind: 'ActivateCalendarLinks', operationId: engine().createOperationId(), previewIds: review.items.filter(item => selected.includes(item.occurrenceId) && item.preview && !item.excludedReason).map(item => item.preview!.previewId) };
    running.current = true; setBusy(true); setError('');
    try {
      const result = await engine().applyCalendarCommand(captured.current);
      if ('operations' in result) setChildren(result.operations.map(job => job.operationId));
      captured.current = null; setUnknown(false); await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnknown(false); } else setUnknown(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); }
  };
  return <Page compact title="Enable automatic sync" onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}
    footer={review && !children.length ? <BottomActionBar><Button label={unknown ? 'Retry same activation' : 'Enable for selected links (' + selected.length + ')'} disabled={busy || !unknown && !selected.length} onPress={() => void apply()} /></BottomActionBar> : undefined}>
    <Copy>Confirmation applies the reviewed ordinary transfers and enables automatic Title, Notes and Schedule updates for ready links. Conflicts, unsafe timing and unconfirmed writes need individual review. Local alerts and actions remain independent.</Copy>
    {!!error && <ActionFeedback message={error} tone="warning" />}{busy && <ActionFeedback loading message="Checking native activation previews…" />}
    {!children.length && <Button label="Refresh review" variant="secondary" disabled={busy || unknown} onPress={() => void load()} />}
    {review?.items.map(item => <ConnectedGroup key={item.occurrenceId}><Choice label={item.preview?.local?.title ?? item.title ?? 'Linked reminder'}
      description={item.preview ? item.preview.calendarName + ' · ' + item.preview.email : [item.calendarName, item.email].filter(Boolean).join(' · ') || 'Original Calendar source'} selected={selected.includes(item.occurrenceId)} disabled={busy || unknown || !!item.excludedReason || !!children.length}
      onPress={() => setSelected(old => old.includes(item.occurrenceId) ? old.filter(id => id !== item.occurrenceId) : [...old, item.occurrenceId])} />
      {item.excludedReason ? <><Copy muted>{calendarReviewReason(item.excludedReason)}</Copy><Button label="Review this link" variant="secondary" disabled={busy || unknown}
        onPress={() => router.push({ pathname: '/calendar-manage', params: { id: item.occurrenceId, ...origin } })} /></> : <Copy muted>{item.preview?.equal ? 'Both copies agree. No content transfer needed.' : 'To Remilo: ' + (item.preview?.transfers.inbound.join(', ') || 'None') + ' · To Google: ' + (item.preview?.transfers.outbound.join(', ') || 'None')}</Copy>}
    </ConnectedGroup>)}
    {review && !review.items.length && <Copy>No manual links need activation.</Copy>}
    {operations.data?.filter(job => children.includes(job.operationId)).map(job => <CalendarOperationStatus key={job.operationId} operation={job} />)}
  </Page>;
}
