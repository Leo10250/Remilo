import { useLocalizedState, useTranslation } from '../localization/react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import { View } from 'react-native';
import type { CalendarOperationStatus, ManagedCalendarCommand, ManagedCalendarPolicy, ManagedCalendarPreview, ManagedCalendarSetupChoices } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected } from '../domain/calendar-link';
import { managedCalendarCapture } from '../domain/calendar-managed';
import { deviceZone } from '../domain/time';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Disclosure, Page, RowSupport, SettingRow, Sheet, Toggle } from '../ui/components';
import { CalendarOperationProgress, CalendarReviewItems, CalendarStatusCard, useCalendarAuthorization, useCalendarAction } from '../ui/calendar-sync';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { useAppearanceHold } from '../ui/theme';
import { engine, nativeAvailable } from '../ui/native';
import { TimeZoneField } from '../ui/time-zone';
import { RootNotice } from '../ui/navigation';

export default function ManagedCalendar() {
  'use no memo';
  const t = useTranslation();
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams & { mode?: string; adoptOccurrenceId?: string; replacement?: string; operationId?: string }>();
  const mode = params.mode || 'setup', origin = retainedOriginParams(params), client = useQueryClient(), confirm = useAppearanceConfirmation();
  const saved = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable });
  const connection = useQuery({ queryKey: ['calendar', 'connection'], queryFn: () => engine().getCalendarConnection(), enabled: nativeAvailable });
  const [preview, setPreview] = useState<ManagedCalendarPreview | null>(null), [draft, setDraft] = useState<ManagedCalendarSetupChoices>({});
  const [selected, setSelected] = useState<string[]>([]), [checking, setChecking] = useState(false), [capturing, setCapturing] = useState(false);
  const [unknown, setUnknown] = useState(false), [resultId, setResultId] = useState<string | null>(null), [error, setError] = useLocalizedState(''), [reason, setReason] = useLocalizedState(''), [refresh, setRefresh] = useState(0);
  const [sheet, setSheet] = useState<'calendar' | 'alerts' | 'google' | null>(null);
  const [zoneAtMs] = useState(Date.now);
  const pending = useRef<ManagedCalendarCommand | null>(null), initialized = useRef(false), ticket = useRef(0), busy = useRef(false), focused = useRef(false);
  const pendingSetup = saved.data && (['PreparingCalendar', 'InitialImport', 'CreationUnconfirmed'].includes(saved.data.phase) || saved.data.phase === 'AccessRequired' && saved.data.problem?.action === 'Authorize');
  const operationId = resultId || params.operationId || (mode === 'progress' || mode === 'setup' && pendingSetup && params.replacement !== 'true' && !params.adoptOccurrenceId ? saved.data?.operationId : null);
  const back = () => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin));
  const auth = useCalendarAuthorization(() => { setRefresh(value => value + 1); });
  useAppearanceHold(capturing || unknown || !!sheet);
  usePreventRemove(capturing || unknown, () => confirm(t('m_fb77f71f37c4'), t('m_af68edd919f9')));
  useFocusEffect(useCallback(() => { if (focused.current) setRefresh(value => value + 1); focused.current = true; }, []));
  useEffect(() => {
    if (!nativeAvailable || !connection.data?.connected || operationId || mode === 'progress' || pending.current) return;
    const tickets = ticket, current = ++tickets.current;
    setChecking(true); setError(''); setReason('');
    const timer = setTimeout(() => {
      void (async () => {
        const state = await engine().getManagedCalendarState();
        const choices: ManagedCalendarSetupChoices = { ...draft, replacement: params.replacement === 'true', ...(params.adoptOccurrenceId ? { adoptOccurrenceIds: [params.adoptOccurrenceId] } : {}) };
        const next = mode === 'resume' ? await engine().previewManagedCalendarResume() : mode === 'recovered' ? await engine().previewManagedCalendarRecoveredAlerts([]) :
          mode === 'policy' ? await engine().previewManagedCalendarPolicyChange({ ...(draft.policy || state.policy), expectedRevision: state.policy.revision }) : await engine().previewManagedCalendarSetup(choices);
        if (current !== ticket.current) return;
        setPreview(next);
        const first = !initialized.current; initialized.current = true;
        setSelected(old => next.items.filter(item => item.ready && (!first ? old.includes(item.itemId) : mode !== 'setup' || !['Adopt', 'Publish'].includes(item.kind) || item.occurrenceId === params.adoptOccurrenceId)).map(item => item.itemId));
      })().catch(e => { if (current === ticket.current) { setError(calendarError(e)); setReason(e && typeof e === 'object' && 'code' in e ? String(e.code) : ''); } }).finally(() => { if (current === ticket.current) setChecking(false); });
    }, 250);
    return () => { clearTimeout(timer); tickets.current++; };
  }, [draft, mode, connection.data?.connected, connection.data?.revision, refresh, params.adoptOccurrenceId, params.replacement, operationId, setError, setReason]);
  const policy = { ...(preview?.policy || saved.data?.policy), ...draft.policy } as ManagedCalendarPolicy;
  const updatePolicy = (patch: Partial<ManagedCalendarPolicy>) => setDraft(old => ({ ...old, policy: { ...(preview?.policy || saved.data?.policy), ...old.policy, ...patch } }));
  const apply = async () => {
    if (!preview || busy.current || checking || !preview.complete || !unknown && Date.now() >= preview.expiresAtMs) { setError(t('m_9357bdd53345')); setRefresh(v => v + 1); return; }
    pending.current ??= managedCalendarCapture(preview, engine().createOperationId(), selected);
    const command = pending.current; busy.current = true; setCapturing(true); setError('');
    try { await calendarAction.submit(command); pending.current = null; setUnknown(false); setResultId(command.operationId); await client.invalidateQueries({ queryKey: ['calendar'] }); }
    catch (e) { if (calendarCaptureRejected(e)) { pending.current = null; setUnknown(false); setRefresh(v => v + 1); } else setUnknown(true); setError(calendarError(e)); }
    finally { busy.current = false; setCapturing(false); }
  };
  const recover = async (status: CalendarOperationStatus) => {
    if (status.action === 'Connect' || status.action === 'Authorize') { await auth.start(status.action === 'Authorize' ? status.operationId : null); return; }
    if (status.action === 'ReviewItems') { router.push({ pathname: '/calendar-reviews', params: origin }); return; }
    if (status.action === 'InspectCreation') {
      if (busy.current) return; busy.current = true; setCapturing(true);
      try { await calendarAction.submit({ kind: 'RetryManagedCalendarOperation', operationId: status.operationId }); await client.invalidateQueries({ queryKey: ['calendar'] }); }
      catch (e) { setError(calendarError(e)); } finally { busy.current = false; setCapturing(false); }
      return;
    }
    router.replace({ pathname: '/calendar', params: origin });
  };
  const title = operationId || mode === 'progress' ? t('m_f2cef547cca3') : mode === 'resume' ? t('m_5e506c8d2951') : mode === 'policy' ? t('m_e506da94ceb4') : mode === 'recovered' ? t('m_111b11a90779') : t('m_79d5acd6c240');
  const action = mode === 'resume' ? t('m_8c64c5f3e836') : mode === 'policy' ? t('m_089e57e38f93') : mode === 'recovered' ? t('m_d65bb73f593c', { arg0: String(selected.length) }) : preview?.createCalendar ? t('m_6bbfee7bfcdf') : t('m_e62e9fadeb09');
  const locked = capturing || unknown || auth.waiting;
  const allDayTime = new Date(zoneAtMs); allDayTime.setHours(Math.floor((policy.allDayAlarmMinutes ?? 540) / 60), (policy.allDayAlarmMinutes ?? 540) % 60, 0, 0);
  const source = preview?.calendarCandidates.find(value => value.id === (draft.selectedCalendarId || preview.selectedCalendarId));
  const zone = preview?.createCalendar ? draft.calendarZone || preview.calendarZone || deviceZone() : source?.zoneId || saved.data?.calendarZone || deviceZone();
  const zoneLabel = zone.split('/').pop()?.replaceAll('_', ' ') || zone;
  return <Page compact title={title} onBack={back} footer={<><RootNotice />{!operationId && preview && mode !== 'progress' ? <BottomActionBar><Button label={unknown ? t('m_16003a1a9190') : checking ? t('m_c8ee7ecafaed') : action}
    busy={capturing} disabled={auth.waiting || checking || !unknown && (!preview.complete || !!error || mode === 'recovered' && !selected.length)} onPress={() => void apply()} /></BottomActionBar> : null}</>}>
    {!nativeAvailable && <Copy>{t('m_329ba71a3adb')}</Copy>}
    {operationId ? <><CalendarOperationProgress operationId={operationId} onAction={status => void recover(status)} />
      {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
      {!!error && <ActionFeedback message={error} tone="warning" />}
      <Button label={t('m_db7318c55879')} variant="secondary" disabled={capturing || unknown} onPress={() => router.replace({ pathname: '/calendar', params: origin })} />
    </> : <>
      <Copy muted>{mode === 'resume' ? t('m_b3654a56ff8e') : mode === 'recovered' ? t('m_46c4b1c0a26e') : mode === 'policy' ? t('m_0e641191fb8f') : t('m_173329670273')}</Copy>
      {mode === 'setup' && <ConnectedGroup title={t('m_4daf4f599e5c')}>
        <SettingRow intent="action" icon="event" label={t('m_7da2bcb6bb6b')} value={connection.data?.connected ? connection.data.email : t('m_0303e1824670')} description={connection.data?.connected ? undefined : t('m_e3b0eada86d6')} />
        <SettingRow intent="picker" icon="event" label={t('m_d1f78591d052')} value={source?.name || (preview?.createCalendar ? t('m_23c9159672e0') : saved.data?.calendarName || (connection.data?.connected ? checking ? t('m_453d0743c738') : t('m_c45aab93dad2') : t('m_88cd4e78a673')))}
          description={preview?.createCalendar ? t('m_f8b9614ab2a4') : source ? t('m_869ef35dc892') : preview?.calendarCandidates.length ? t('m_180f8f916659') : t('m_08fcf92a3a86')}
          disabled={locked || !preview?.calendarCandidates.length} onPress={preview?.calendarCandidates.length ? () => setSheet('calendar') : undefined} />
        {preview?.createCalendar && <TimeZoneField value={zone} atMs={zoneAtMs} disabled={locked} onChange={calendarZone => setDraft(old => ({ ...old, calendarZone }))} />}
      </ConnectedGroup>}
      {!connection.data?.connected && nativeAvailable && <CalendarStatusCard title={t('m_c04f9d6a937e')} description={t('m_afc14f4556c4')} label={t('m_2035e3f9baed')} busy={auth.waiting} action={() => void auth.start()} />}
      {!!auth.message && <ActionFeedback message={auth.message} tone={auth.tone} loading={auth.waiting} />}
      {!!error && <CalendarStatusCard title={t('m_39d845bcc1d7')} description={error} warning label={['NEEDS_ACCESS', 'AUTH', 'ACCOUNT_MISMATCH'].includes(reason) ? t('m_b724411569e0') : t('m_b6d6badae487')} busy={auth.waiting || checking}
        action={() => ['NEEDS_ACCESS', 'AUTH', 'ACCOUNT_MISMATCH'].includes(reason) ? void auth.start(saved.data?.problem?.action === 'Authorize' ? saved.data.operationId || null : null) : setRefresh(v => v + 1)} />}
      {checking && <ActionFeedback loading message={t('m_c8ee7ecafaed')} />}
      {preview && <>
        {params.replacement === 'true' && <ActionFeedback tone="warning" message={t('m_8f6d58101a14')} />}
        {mode === 'setup' && policy.automaticImport && preview.initialMode === 'None' && <CalendarStatusCard title={t('m_3fc2499adb77')} description={t('m_93653909d982')} />}
        {(mode === 'setup' || mode === 'policy') && <>
          <ConnectedGroup title={t('m_9843997116c5')} footer={<Copy muted size={14}>{t('m_ca0cf58f35be')}</Copy>}>
            <View><Toggle label={t('m_4dd42f73fe9a')} value={policy.automaticImport} disabled={locked} onChange={automaticImport => updatePolicy({ automaticImport })} />
              <RowSupport><Copy muted size={14}>{t('m_d2437c145abd')}</Copy></RowSupport></View>
            <View><Toggle label={t('m_2cf933c6fed9')} value={policy.exportNewReminders} disabled={locked} onChange={exportNewReminders => updatePolicy({ exportNewReminders })} />
              <RowSupport><Copy muted size={14}>{t('m_338b804f1e94')}</Copy></RowSupport></View>
          </ConnectedGroup>
          {policy.automaticImport && <ConnectedGroup title={t('m_9727cce5dbc9')} footer={<Copy muted size={14}>{t('m_b3ccc50b119d')}</Copy>}>
            <SettingRow intent="picker" icon="alarm" label={t('m_ab30d609b7e2')} value={policy.importMode === 'None' ? t('m_d1af410eb4d0') : policy.importMode} disabled={locked} onPress={() => setSheet('alerts')} />
            {policy.importMode !== 'None' && <View><DateField label={t('m_54eb2244b919')} timeOnly value={allDayTime.getTime()} disabled={locked} onError={setError}
              onChange={value => { const date = new Date(value); updatePolicy({ allDayAlarmMinutes: date.getHours() * 60 + date.getMinutes() }); }} />
              <RowSupport><Copy muted size={14}>{zoneLabel} {t('m_b76eb494eaa2')}</Copy></RowSupport></View>}
          </ConnectedGroup>}
          <ConnectedGroup><SettingRow intent="picker" icon="notifications" label={t('m_2d7a7719bc44')} value={policy.disableGoogleReminders ? t('m_372ce595191c') : t('m_2856380acc3a')}
            description={policy.disableGoogleReminders ? t('m_a57bf69e8e1b') : t('m_0e928a7cd037')} disabled={locked} onPress={() => setSheet('google')} /></ConnectedGroup>
          <ConnectedGroup><Disclosure title={t('m_4a2622a4fb47')} summary={t('m_aff37c4e6bf2')} icon="info">
            <Copy muted size={14}>{t('m_f4f325445050')}</Copy>
            <Copy muted size={14}>{t('m_9ae6d0712049')}</Copy>
            <Copy muted size={14}>{t('m_792c239fef79')}</Copy>
          </Disclosure></ConnectedGroup>
        </>}
        {preview.warnings.map((warning, index) => <ActionFeedback key={index} message={warning} tone="warning" />)}
        {preview.sample && <ConnectedGroup><Disclosure title={t('m_00be07b6af5f')} summary={t('m_edb8aa2ad379')} icon="event">
          <Copy muted size={14}>{preview.sample.inspectedCount} {t('m_2f864cdf5f58')}{preview.sample.complete ? '' : t('m_ac95e19bb3d7')}{t('m_1dcbdf25a32f')}</Copy>
          {preview.sample.items.map((item, index) => <View key={index} style={{ gap: 4 }}><Copy>{item.title}</Copy><Copy muted size={14}>{item.description}</Copy></View>)}
          {!preview.sample.items.length && <Copy muted size={14}>{t('m_4229b0412297')}</Copy>}
        </Disclosure></ConnectedGroup>}
        {!preview.complete && <ActionFeedback message={t('m_605389b55e6d')} tone="warning" />}
        <CalendarReviewItems items={preview.items} selected={selected} disabled={locked || checking} onToggle={id => setSelected(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id])}
          onReview={item => router.push(item.candidateId ? { pathname: '/calendar-review', params: { candidateId: item.candidateId, ...origin } } : { pathname: '/calendar-manage', params: { id: item.occurrenceId!, ...origin } })} />
        {mode === 'resume' && <Copy muted size={14}>{t('m_e495356194d3')}</Copy>}
      </>}
    </>}
    <Sheet visible={sheet === 'calendar'} title={t('m_52b3ea7b7158')} onClose={() => setSheet(null)}>
      <Copy muted>{t('m_383e35928dfb')}</Copy>
      <ConnectedGroup>{preview?.calendarCandidates.map(candidate => <Choice key={candidate.id} label={candidate.name} description={candidate.zoneId + (candidate.recognition === 'NameOnly' ? t('m_3bc2cb91a7dc') : '')}
        selected={candidate.id === (draft.selectedCalendarId || preview.selectedCalendarId)} onPress={() => { setDraft(old => ({ ...old, selectedCalendarId: candidate.id })); setSheet(null); }} />)}</ConnectedGroup>
    </Sheet>
    <Sheet visible={sheet === 'alerts'} title={t('m_3c4de8d775a1')} onClose={() => setSheet(null)}><ConnectedGroup>
      {(['Alarm', 'Notification', 'None'] as const).map(importMode => <Choice key={importMode} label={importMode === 'None' ? t('m_d1af410eb4d0') : importMode} selected={policy.importMode === importMode} onPress={() => { updatePolicy({ importMode }); setSheet(null); }} />)}
    </ConnectedGroup><Copy muted>{t('m_9f932430c760')}</Copy></Sheet>
    <Sheet visible={sheet === 'google'} title={t('m_2d7a7719bc44')} onClose={() => setSheet(null)}><ConnectedGroup>
      <Choice label={t('m_2856380acc3a')} description={t('m_0e928a7cd037')} selected={!policy.disableGoogleReminders} onPress={() => { updatePolicy({ disableGoogleReminders: false }); setSheet(null); }} />
      <Choice label={t('m_372ce595191c')} description={t('m_91a8d427878c')} selected={policy.disableGoogleReminders} onPress={() => { updatePolicy({ disableGoogleReminders: true }); setSheet(null); }} />
    </ConnectedGroup></Sheet>
  </Page>;
}
