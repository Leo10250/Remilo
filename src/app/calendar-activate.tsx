import { useLocalizedState, useTranslation } from '../localization/react';

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
import { CalendarOperationProgress, CalendarReviewTiming, useCalendarAction } from '../ui/calendar-sync';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useAppearanceHold } from '../ui/theme';
import { engine, nativeAvailable } from '../ui/native';

export default function CalendarActivation() {
  'use no memo';
  const t = useTranslation();
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams & { operationId?: string }>(), origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const [review, setReview] = useState<CalendarActivationReview | null>(null), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useLocalizedState('');
  const [unknown, setUnknown] = useState(false), [resultId, setResultId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const captured = useRef<CalendarCommand | null>(null), running = useRef(false), initialized = useRef(false), ticket = useRef(0);
  const operationId = resultId || params.operationId;
  useAppearanceHold(busy || unknown);
  usePreventRemove(capturing || unknown, () => confirm(t('m_fb77f71f37c4'), t('m_af68edd919f9')));
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
  }, [operationId, setError]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const apply = async () => {
    if (running.current || !review) return;
    captured.current ??= { kind: 'ActivateCalendarLinks', operationId: engine().createOperationId(), previewIds: review.items.filter(item => selected.includes(item.occurrenceId) && item.preview && !item.excludedReason).map(item => item.preview!.previewId) };
    const command = captured.current; running.current = true; setBusy(true); setCapturing(true); setError('');
    try {
      await calendarAction.submit(command); setResultId(command.operationId); router.setParams({ operationId: command.operationId }); captured.current = null; setUnknown(false);
      await client.invalidateQueries({ queryKey: ['calendar'] });
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUnknown(false); } else setUnknown(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); setCapturing(false); }
  };
  const ready = review?.items.filter(item => item.preview && !item.excludedReason) || [], attention = review?.items.filter(item => !item.preview || item.excludedReason) || [];
  return <Page compact title={t('m_41103efd431d')} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin))}
    footer={!operationId && !!ready.length ? <BottomActionBar><Button label={unknown ? t('m_16003a1a9190') : t('m_f3a7e7a28691', { arg0: String(selected.length), arg1: String(selected.length === 1 ? t('m_9ce7011ab48f') : t('m_a53ebed84cc8')) })} busy={busy} disabled={!unknown && (!selected.length || !!error)} onPress={() => void apply()} /></BottomActionBar> : undefined}>
    {operationId ? <><CalendarOperationProgress operationId={operationId} onAction={() => router.push({ pathname: '/calendar-reviews', params: origin })} />
      <Button label={t('m_db7318c55879')} variant="secondary" onPress={() => router.replace({ pathname: '/calendar', params: origin })} /></> : <>
      <Copy muted>{t('m_dc7c5a03424f')}</Copy>
      {!!error && <ActionFeedback message={error} tone="warning" />}
      {busy && <ActionFeedback loading message={capturing ? t('m_b9425bf65303') : t('m_627a29d1ff3c')} />}
      {!!error && !unknown && <Button label={t('m_594bff388101')} variant="secondary" disabled={busy} onPress={() => void load()} />}
      {!!ready.length && <Copy heading>{t('m_8ceca6d37b3b')}{ready.length}</Copy>}
      {ready.map(item => <ConnectedGroup key={item.occurrenceId}><View>
        <CheckRow label={item.preview!.local?.title || item.title || t('m_10208d7687ad')} description={[item.preview!.calendarName, item.preview!.email].filter(Boolean).join(' · ')}
          selected={selected.includes(item.occurrenceId)} disabled={busy || unknown} onPress={() => setSelected(old => old.includes(item.occurrenceId) ? old.filter(id => id !== item.occurrenceId) : [...old, item.occurrenceId])} />
        <RowSupport><CalendarReviewTiming id={item.occurrenceId} /><Copy muted size={14}>{calendarTransferText(item.preview!.transfers.inbound, item.preview!.transfers.outbound, item.preview!.equal)}</Copy></RowSupport>
      </View></ConnectedGroup>)}
      {!!attention.length && <Copy heading>{t('m_33071713d5e1')}{attention.length}</Copy>}
      {attention.map(item => <ConnectedGroup key={item.occurrenceId}><View>
        <SettingRow intent="action" prominent label={item.preview?.local?.title || item.title || t('m_10208d7687ad')} description={[item.calendarName, item.email].filter(Boolean).join(' · ')} />
        <RowSupport><CalendarReviewTiming id={item.occurrenceId} /><Copy muted size={14}>{item.excludedReason || t('m_497da54032fc')}</Copy>
          <Button label={t('m_6a47708f4e14')} variant="secondary" disabled={busy || unknown} onPress={() => router.push({ pathname: '/calendar-manage', params: { id: item.occurrenceId, ...origin } })} /></RowSupport>
      </View></ConnectedGroup>)}
      {review && !review.items.length && <Copy>{t('m_f77790b654f9')}</Copy>}
      {!!review?.items.length && <Copy muted size={14}>{t('m_1eeb770e9fd9')}</Copy>}
    </>}
  </Page>;
}
