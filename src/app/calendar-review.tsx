import { useLocalizedState, useTranslation } from '../localization/react';
import { t as currentText } from '../localization';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { CalendarCommand, CalendarFields, CalendarImportChoices, CalendarLinkPreview, CalendarSelections } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { calendarError } from '../domain/calendar';
import { calendarCaptureRejected, resolvedCalendarFields } from '../domain/calendar-link';
import { retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, Field, Page, RowSupport, SelectRow, SettingRow, Toggle } from '../ui/components';
import { useCalendarAction } from '../ui/calendar-sync';
import { CalendarOperationStatus } from '../ui/calendar-linked';
import { calendarImportIndependence } from '../domain/calendar-presentation';
import { modeLabel } from '../domain/presentation';
import { DateTimeFields } from '../ui/date-time-fields';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';
import { useAppearanceHold } from '../ui/theme';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { notify } from '../ui/feedback';

export default function CalendarReview() {
  'use no memo';
  const t = useTranslation();
  const calendarAction = useCalendarAction();
  const params = useLocalSearchParams<OriginParams & { id?: string; calendarId?: string; eventId?: string; automatic?: string; candidateId?: string; candidateRevision?: string; managedHistory?: string }>(), origin = retainedOriginParams(params);
  const imported = !params.id, client = useQueryClient(), confirm = useAppearanceConfirmation();
  const { scheduleDateTime, formatDate } = useTimeFormatting();
  const [preview, setPreview] = useState<CalendarLinkPreview | null>(null), [choices, setChoices] = useState<CalendarImportChoices>(params.managedHistory === 'true' ? { mode: 'None' } : {});
  const adopting = imported && !!params.candidateId && !!preview?.local;
  const [selections, setSelections] = useState<CalendarSelections>({ title: null, notes: null, schedule: null });
  const [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useLocalizedState('');
  const [capturing, setCapturing] = useState(false), [candidateRevision, setCandidateRevision] = useState<number | null>(() => params.candidateRevision ? Number(params.candidateRevision) : null);
  const [sourceUnavailable, setSourceUnavailable] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [ignored, setIgnored] = useState(false);
  const captured = useRef<CalendarCommand | null>(null), running = useRef(false), live = useRef(true);
  const [now, setNow] = useState(Date.now);
  const readTicket = useRef(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const operations = useQuery({ queryKey: ['calendar', 'operations'], queryFn: () => engine().getCalendarOperations(), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable && imported });
  const link = links.data?.find(item => item.occurrenceId === params.id), job = operations.data?.find(item => item.operationId === operationId);
  const enable = !link || link.state === 'Detached';
  const activating = params.automatic === 'true';
  useAppearanceHold(busy || uncertain);
  usePreventRemove(capturing || uncertain, () => confirm(t('m_12dd26f54ada'), t('m_b6cae41bec3a')));
  const load = useCallback(async () => {
    if (running.current || captured.current) return; running.current = true; setBusy(true); setError('');
    const ticket = ++readTicket.current;
    try {
      const activation = activating ? await engine().previewCalendarActivation([params.id!]) : null;
      const next = activation ? activation.items[0]?.preview : params.candidateId ? await engine().previewManagedCalendarCandidate(params.candidateId, choices) : imported ? await engine().previewCalendarImport({ calendarId: params.calendarId!, eventId: params.eventId! }, choices) :
        enable ? await engine().previewCalendarLink(params.id!) : await engine().previewCalendarUpdate(params.id!);
      if (!next) throw new Error(activation?.items[0]?.excludedReason || currentText('m_2f283f72b9c9'));
      if (!live.current || ticket !== readTicket.current) return;
      setPreview(next); setSelections(next.selections || { title: null, notes: null, schedule: null }); setDirty(false);
      if ('candidateRevision' in next && typeof next.candidateRevision === 'number') setCandidateRevision(next.candidateRevision);
    } catch (e) { if (live.current) { setError(calendarError(e)); setSourceUnavailable(!!e && typeof e === 'object' && 'code' in e && ['NOT_FOUND', 'ALREADY_IMPORTED'].some(code => String(e.code).includes(code))); } }
    finally { running.current = false; if (live.current) setBusy(false); }
  }, [choices, imported, enable, activating, params.calendarId, params.eventId, params.id, params.candidateId, setError]);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    const tickets = readTicket;
    live.current = true;
    void Promise.resolve().then(() => { if (live.current) return loadRef.current(); });
    return () => { live.current = false; tickets.current++; };
  }, [params.id, params.eventId, params.calendarId, params.candidateId]);
  const change = (next: CalendarImportChoices) => { if (busy || captured.current || operationId) return; setChoices(old => ({ ...old, ...next })); setDirty(true); };
  const apply = async () => {
    if (running.current || !preview && !captured.current) return;
    if (dirty && !captured.current) { await load(); return; }
    captured.current ??= params.candidateId ? { kind: 'ImportManagedCalendarCandidate', operationId: engine().createOperationId(), previewId: preview!.previewId, automaticSync: true,
      ...(adopting ? { selections: { ...selections } } : {}) } :
      { kind: imported ? 'ImportCalendarEvent' : activating ? 'EnableAutomaticCalendarSync' : enable ? 'EnableCalendarLink' : 'ApplyCalendarResolution',
        operationId: engine().createOperationId(), previewId: preview!.previewId, automaticSync: choices.automaticSync ?? preview!.choices.automaticSync ?? (imported || enable || activating), ...(imported ? {} : { selections: { ...selections } }) };
    running.current = true; setBusy(true); setCapturing(true); setError('');
    try {
      const ignoring = captured.current.kind === 'IgnoreManagedCalendarCandidate';
      const result = await calendarAction.submit(captured.current);
      if ('operationId' in result && typeof result.operationId === 'string') setOperationId(result.operationId);
      if (ignoring) { notify({ message: t('m_f7ea0cace525') }); setIgnored(true); }
      captured.current = null; setUncertain(false); await client.invalidateQueries();
    } catch (e) { if (calendarCaptureRejected(e)) { captured.current = null; setUncertain(false); } else setUncertain(true); setError(calendarError(e)); }
    finally { running.current = false; setBusy(false); setCapturing(false); }
  };
  const ignore = () => {
    if (!params.candidateId || candidateRevision === null || running.current || captured.current) return;
    confirm(t('m_d1cf051bb145'), t('m_610f37ddbd88'), [{ text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_fce77c34d3fe'), onPress: () => {
      captured.current = { kind: 'IgnoreManagedCalendarCandidate', operationId: engine().createOperationId(), candidateId: params.candidateId!, expectedRevision: candidateRevision };
      void apply();
    } }]);
  };
  const mode = choices.mode || preview?.choices.mode || 'Alarm';
  const alarm = choices.alarmAtMs ?? preview?.choices.alarmAtMs;
  const title = choices.title ?? preview?.choices.title ?? preview?.remote.title ?? '';
  const resolved = preview?.local ? resolvedCalendarFields(preview.local, preview.remote, selections) : null;
  const timing = selections.schedule ? preview?.timings?.[selections.schedule] : null;
  const elapsedChange = !preview?.recurrence && !!timing && timing.mode !== 'None' && timing.alarmAtMs <= now && timing.alarmAtMs !== preview?.timings?.remilo.alarmAtMs;
  const fieldText = (field: keyof CalendarFields, fields: Partial<CalendarFields>) => {
    if (fields[field] === undefined) return t('m_31893018064e');
    if (field !== 'schedule') return fields[field] || (field === 'notes' ? t('m_efe1cde67784') : t('m_4850b174b713'));
    const schedule = fields.schedule!;
    return (schedule.allDay ? formatDate(schedule.eventStartMs, schedule.zoneId) + t('m_b3d544d5d55c') :
      scheduleDateTime(schedule.eventStartMs, schedule.zoneId) + ' – ' + scheduleDateTime(schedule.eventEndMs, schedule.zoneId)) + ' · ' + schedule.zoneId +
      (schedule.recurrence ? t('m_9e79a8b1aee5') : '');
  };
  const recurring = !!preview?.recurrence;
  const invalid = imported && !adopting ? !title.trim() || (recurring ? !preview?.upcoming?.length : mode !== 'None' && (!alarm || alarm <= now)) : !resolved || elapsedChange;
  const back = useCallback(() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(origin)), [origin]);
  useEffect(() => { if (ignored && !busy && !uncertain) back(); }, [ignored, busy, uncertain, back]);
  return <Page compact title={adopting ? t('m_a30fc352c641') : imported ? t('m_585d4bab7d3a') : activating ? t('m_020858872d16') : enable ? t('m_45f738fd2ff1') : t('m_9e636d2d17ec')} onBack={back}
    footer={!operationId && preview ? <BottomActionBar>
      <Button label={uncertain ? t('m_16003a1a9190') : dirty ? t('m_ceda88a9a0fd') : imported && !adopting ? t('m_91178678e720') : activating ? t('m_e62e9fadeb09') : t('m_71e50031d9c2')}
        disabled={busy || !uncertain && !dirty && invalid} onPress={() => void apply()} />
      <Button label={t('m_19766ed6ccb2')} variant="secondary" disabled={busy || uncertain} onPress={back} />
    </BottomActionBar> : undefined}>
    <Copy muted>{adopting ? t('m_62b005b2d47b') : imported ? t('m_b0fb1f750602') : t('m_c672ed8175e2')}</Copy>
    {imported && !adopting && <Copy muted>{calendarImportIndependence}</Copy>}
    {params.candidateId && !adopting && <Copy heading>{t('m_b89457145742')}</Copy>}
    {!!error && <ActionFeedback message={error} tone="warning" />}
    {busy && <ActionFeedback loading message={capturing ? t('m_57571c98a715') : t('m_9673886fee4f')} />}
    {!preview && !busy && !sourceUnavailable && <Button label={t('m_ba805b089799')} variant="secondary" disabled={!nativeAvailable} onPress={() => void load()} />}
    {sourceUnavailable && <Button label={t('m_80c4a2d9d196')} variant="secondary" onPress={() => router.replace({ pathname: '/calendar-reviews', params: origin })} />}
    {!preview && uncertain && <Button label={t('m_16003a1a9190')} disabled={busy} onPress={() => void apply()} />}
    {params.candidateId && candidateRevision !== null && !operationId && !sourceUnavailable && <Button label={t('m_b839153e19bb')} variant="secondary" disabled={busy || uncertain} onPress={ignore} />}
    {preview && !operationId && <>
      <ConnectedGroup title={t('m_0e570ca6fabe')}><View key="source" style={{ padding: 16, gap: 12 }}><Copy>{preview.calendarName} · {preview.email}</Copy>
        <Copy muted>{t('m_0efd92a33590')}{scheduleDateTime(preview.checkedAtMs)}.</Copy></View></ConnectedGroup>
      <ConnectedGroup title={t('m_b97900d1be7c')}><View key="sync">
        {activating || params.candidateId ? <SettingRow intent="action" icon="event" label={t('m_41a8bf8da139')} description={t('m_bf02ddb833cf')} /> :
          <Toggle label={t('m_23a71272299e')} value={choices.automaticSync ?? preview.choices.automaticSync ?? (imported || enable)} disabled={busy || uncertain}
            onChange={value => { setChoices(old => ({ ...old, automaticSync: value })); if (imported) setDirty(true); }} />}
        <RowSupport><Copy muted size={14}>{t('m_1e631f4fb0c8')}</Copy></RowSupport>
      </View></ConnectedGroup>
      {imported && !adopting ? <>
        <ConnectedGroup title={t('m_f74c0be05e82')}><View key="event" style={{ padding: 16, gap: 12 }}>
          <Copy heading>{preview.remote.title || t('m_a79be2403a6c')}</Copy><Copy>{preview.remote.notes || t('m_efe1cde67784')}</Copy>
          <Copy>{fieldText('schedule', preview.remote)}</Copy></View></ConnectedGroup>
        <Field label={t('m_7e8cd2056da7')} required multiline compactMultiline value={title} editable={!busy && !uncertain} maxLength={200} onChangeText={value => change({ title: value })} />
        <ConnectedGroup title={t('m_34ddba84ee3c')}><View key="mode" style={{ padding: 16 }}>
          {(['Alarm', 'Notification', 'None'] as const).map(value => <Choice key={value} label={modeLabel(value)} selected={mode === value}
            disabled={busy || uncertain} onPress={() => change({ mode: value })} />)}
        </View>
        {mode !== 'None' && alarm !== undefined && !recurring && <DateTimeFields key="time" value={alarm} zoneId={preview.remote.schedule.zoneId} allDay={false}
          disabled={busy || uncertain} onError={setError} onChange={value => change({ alarmAtMs: value })} labelPrefix={t('m_33cc28980e08')} />}
        </ConnectedGroup>
        {recurring && <View key="repeat" style={{ padding: 16, gap: 8 }}><Copy heading>{t('m_235d9592dab2')}</Copy>
          {preview.upcoming?.map(slot => <Copy key={slot.eventStartMs}>{scheduleDateTime(mode === 'None' ? slot.eventStartMs : slot.alarmAtMs, preview.remote.schedule.zoneId)}</Copy>)}
          <Copy muted>{t('m_9b75e12ec2d4')}</Copy></View>}
        {!recurring && mode !== 'None' && alarm !== undefined && alarm <= now && <ActionFeedback tone="warning" message={t('m_eb809c6cb1c2')} />}
        {choices.alarmAtMs !== undefined && <Button label={t('m_32bf22f0aec3')} variant="secondary" disabled={busy || uncertain} onPress={() => change({ alarmAtMs: undefined })} />}
        {!busy && !uncertain && <SelectRow label={t('m_6f202f54a7b2')} value={choices.listId || ''} choices={[{ value: '', label: t('m_eacd31d849f9') }, ...(lists.data || []).map(row => ({ value: row.id, label: row.name }))]}
          onChange={value => change({ listId: value || null })} />}
        <ConnectedGroup title={t('m_381bba430663')}><Toggle key="suppress" label={t('m_99ee4355f56a')} value={choices.disableReminders || false}
          disabled={busy || uncertain} onChange={value => change({ disableReminders: value })} /></ConnectedGroup>
        <Copy muted>{preview.googleReminders ? mode === 'None' ? t('m_1cfe6b952cb6') : t('m_08c3cea793a9') : t('m_f798f7a243db')}</Copy>
        <Copy muted>{t('m_e65ddfec7900')}</Copy>
        {dirty && <ActionFeedback message={t('m_eba734df0aa9')} tone="warning" />}
      </> : preview.local && <>
        {(['title', 'notes', 'schedule'] as const).map(field => <ConnectedGroup key={field} title={field === 'title' ? t('m_7e8cd2056da7') : field === 'notes' ? t('m_8a7525b1492f') : t('m_f4830a1dae29')}>
          <View key="choices" style={{ padding: 16, gap: 8 }}>
            {preview.baseline && <Copy muted>{t('m_90550f10b09d')}{fieldText(field, preview.baseline)}</Copy>}
            <Choice label={t('m_ab4821c44cdf')} description={fieldText(field, preview.local!)} selected={selections[field] === 'remilo'} disabled={busy || uncertain} onPress={() => setSelections(old => ({ ...old, [field]: 'remilo' }))} />
            <Choice label={t('m_c017c30b1471')} description={fieldText(field, preview.remote)} selected={selections[field] === 'google'} disabled={busy || uncertain} onPress={() => setSelections(old => ({ ...old, [field]: 'google' }))} />
            {!selections[field] && <Copy muted>{t('m_52f9493747f8')}</Copy>}
          </View></ConnectedGroup>)}
        {resolved && <ConnectedGroup title={t('m_3b8981de73a5')}><View key="resolution" style={{ padding: 16, gap: 12 }}>
          <Copy heading>{resolved.title}</Copy><Copy>{resolved.notes || t('m_efe1cde67784')}</Copy><Copy>{fieldText('schedule', resolved)}</Copy>
          {timing && <><Copy>{t('m_df5b477708b5')}{scheduleDateTime(timing.dueAtMs, resolved.schedule.zoneId)}</Copy>
            <Copy>{timing.mode === 'None' ? t('m_d1af410eb4d0') : timing.mode + ': ' + scheduleDateTime(timing.alarmAtMs, resolved.schedule.zoneId)}</Copy></>}
        </View></ConnectedGroup>}
        <Copy muted>{t('m_32af1909c259')}</Copy>
        {elapsedChange && <ActionFeedback tone="warning" message={t('m_8d7bb691765b')} />}
        {preview.nextAlertMs !== null && <Copy>{t('m_4c0b9ea1de89')}{scheduleDateTime(preview.nextAlertMs)}.</Copy>}
        <Copy muted>{t('m_b2ab1c6e45a0')}</Copy>
      </>}
      {!busy && !uncertain && <Button label={t('m_962d33506a8f')} variant="secondary" onPress={() => void load()} />}
    </>}
    {job && <><CalendarOperationStatus operation={job} />
      {job.localApplied && <Button label={t('m_40ed00ddaacf')} variant="secondary" onPress={() => router.push({ pathname: '/reminder/[id]', params: { id: job.occurrenceId, ...origin } })} />}
      {['Conflict', 'Failed'].includes(job.state) && <Button label={t('m_d4ea61c79c9b')} variant="secondary" onPress={() => {
        if (job.localApplied) router.replace({ pathname: '/calendar-review', params: { id: job.occurrenceId, ...origin } } as Href);
        else { setOperationId(null); setPreview(null); void load(); }
      }} />}
    </>}
    {operationId && !job && <ActionFeedback loading message={t('m_83743f87492a')} />}
  </Page>;
}
