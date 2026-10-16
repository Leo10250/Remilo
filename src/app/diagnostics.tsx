import { useLocalizedState, useTranslation } from '../localization/react';
import { t, live } from '../localization';
import { useTimeFormatting } from '../ui/time-display';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Share } from 'react-native';
import { retainedOriginParams, type OriginParams } from '../domain/navigation';
import { ActionFeedback, Button, Copy, Group, IconButton, Page, QueryState, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { usePageHandoff } from '../ui/handoff';

const stateNames: Record<string, string> = live(() => ({
  Alerting: t('m_426a858eacbb'), Stopped: t('m_f36a51f323bf'), TimedOut: t('m_ba0c9f7afee3'), Interrupted: t('m_a48a8f6a3fa3'), Missed: t('m_14d64a9f7100'),
  Blocked: t('m_4bf68dddf882'), Failed: t('m_b486522010d5'), Changing: t('m_379738c9c123'), SeriesChanging: t('m_176ac00b6f0e'), Pending: t('m_ed5c58303a98'),
  Scheduled: t('m_4724f344c1c0'), Notified: t('m_02e87bf90c4c'), NoAlert: t('m_d1af410eb4d0'), Completed: t('m_22a970d2e5b1'), Deleted: t('m_5693d1b43930'), Skipped: t('m_12698ce1ea5c'), Paused: t('m_e159b06187d3'), Replaced: t('m_27386b1c065f'),
}));
type Feedback = { message: string; tone: 'success' | 'danger' | 'muted' };
export default function Diagnostics() {
  'use no memo';
  const t = useTranslation();
  const { shortDateTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams>();
  const report = useQuery({ queryKey: ['diagnostics'], queryFn: () => engine().getDiagnostics(), enabled: nativeAvailable });
  const [sharing, setSharing] = useState(false), [shareFeedback, setShareFeedback] = useLocalizedState<Feedback>(), [refreshFeedback, setRefreshFeedback] = useLocalizedState<Feedback>();
  const shareRunning = useRef(false), mounted = useRef(true), refreshTicket = useRef(0), shareTicket = useRef(0);
  const handoff = usePageHandoff(() => setSharing(shareRunning.current));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const counts = report.data?.states as Record<string, number> | undefined, caps = report.data?.capabilities as Record<string, unknown> | undefined;
  const observed = typeof report.data?.observedAtMs === 'number' ? report.data.observedAtMs : undefined;
  const refresh = async () => {
    const ticket = ++refreshTicket.current, page = handoff.scope.capture(); setRefreshFeedback(undefined);
    const result = await report.refetch();
    if (mounted.current && ticket === refreshTicket.current && !result.error) handoff.commit(page, () => setRefreshFeedback({ message: t('m_4bfb4ce311cd'), tone: 'success' }));
  };
  const share = async () => {
    if (!report.data || shareRunning.current) return;
    const snapshot = JSON.stringify(report.data, null, 2), sharedAt = observed, ticket = ++shareTicket.current, page = handoff.scope.capture();
    if (!handoff.scope.markOpened(page)) return;
    shareRunning.current = true; setSharing(true); setShareFeedback(undefined);
    try {
      await Share.share({ message: snapshot, title: t('m_ed806c69f3c3') });
      if (mounted.current && ticket === shareTicket.current) handoff.commit(page, () => setShareFeedback({ message: t('m_76ea31a09077') + (sharedAt != null ? t('m_5c8658f6dc34', { arg0: String(shortDateTime(sharedAt)) }) : '.'), tone: 'muted' }));
    } catch { if (mounted.current && ticket === shareTicket.current) handoff.commit(page, () => setShareFeedback({ message: t('m_6346e7f237c5'), tone: 'danger' })); }
    finally { shareRunning.current = false; if (mounted.current && ticket === shareTicket.current && handoff.scope.active()) setSharing(false); }
  };
  const stateOrder = counts ? [...Object.keys(stateNames).filter((state) => state in counts), ...Object.keys(counts).filter((state) => !(state in stateNames)).sort()] : [];
  const capability = (key: string, limited = false) => typeof caps?.[key] !== 'boolean' ? t('m_ca1844969742') : caps[key] ? t('m_1bb201d18835') : limited ? t('m_e5125d9f63d2') : t('m_18f2a0947f9d');
  return <Page compact title={t('m_268f14bbfe11')} onBack={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/settings', params: retainedOriginParams(params) })}
    actions={<IconButton icon="refresh" label={t('m_e8d59845a10d')} disabled={!nativeAvailable || report.isFetching} onPress={() => void refresh()} />}>
    <Copy muted>{t('m_adaf7b842e82')}</Copy>
    {observed != null && <Copy muted size={14}>{t('m_64fa8a14a90f')}{shortDateTime(observed)}</Copy>}
    <ActionFeedback message={report.isFetching && report.data ? t('m_84d68f15bfc0') : report.error && report.data ? t('m_0fb119b19650') : refreshFeedback?.message}
      tone={report.error ? 'danger' : refreshFeedback?.tone} loading={report.isFetching && !!report.data} />
    {report.error && report.data && <Button label={t('m_942087cc2d41')} variant="secondary" disabled={report.isFetching} onPress={() => void refresh()} />}
    <QueryState loading={nativeAvailable && report.isLoading && !report.data} error={!report.data ? report.error : undefined} empty={!report.data && !report.isLoading || !nativeAvailable}
      emptyMessage={!nativeAvailable ? t('m_66a36ca67b95') : t('m_d6ef34ee8c3e')} onRetry={nativeAvailable ? () => void refresh() : undefined} />
    {!!report.data && <>
      <Group title={t('m_1adbb2ee4d86')}>
        <Copy muted size={14}>{t('m_62c5c0e4db3f')}</Copy>
        {!stateOrder.length && <Copy muted>{t('m_fedeca67dfed')}</Copy>}
        {stateOrder.map((state) => <SettingRow intent="action" key={state} label={stateNames[state] ?? state} value={String(counts![state])} />)}
        <SettingRow intent="action" label={t('m_99d490c3f215')} value={String(report.data.pendingOperations ?? '—')} />
        <Copy muted size={14}>{t('m_573a58a1e38d')}</Copy>
      </Group>
      {caps && <Group title={t('m_9794e36a7e73')}>
        {typeof caps.observedAtMs === 'number' && <Copy muted size={14}>{t('m_fa28a8a6b6bf')}{shortDateTime(caps.observedAtMs)}</Copy>}
        <SettingRow intent="action" label={t('m_142c2ae8d0bb')} value={capability('exactAlarms')} />
        <SettingRow intent="action" label={t('m_31d7ae351725')} value={capability('notifications')} />
        <SettingRow intent="action" label={t('m_aa3c57bf2387')} value={capability('channelEnabled')} />
        <SettingRow intent="action" label={t('m_c2728d07deea')} value={capability('notificationChannelEnabled')} />
        <SettingRow intent="action" label={t('m_66b41af0ba4b')} value={capability('fullScreen', true)} />
        <SettingRow intent="action" label={t('m_de5a4fcc9fd1')} value={caps.unlocked === true ? t('m_531c7b28abf2') : caps.unlocked === false ? t('m_a424e33d9093') : t('m_ca1844969742')} />
      </Group>}
      <Group title={t('m_fc7383580184')}><SettingRow intent="action" label={t('m_e3ba2b050694')} value={String(report.data.contentSchema ?? '—')} />
        <SettingRow intent="action" label={t('m_1fb397289be3')} value={String(report.data.operationalSchema ?? '—')} /></Group>
    </>}
    <Group><SettingRow intent="action" label={t('m_a209f4b78d70')} icon="upload"
      description={t('m_c593c4c6d04c')} disabled={!report.data || sharing}
      onPress={() => void share()} /><ActionFeedback message={sharing ? t('m_7f84c3c63516') : shareFeedback?.message} loading={sharing} tone={shareFeedback?.tone} /></Group>
  </Page>;
}
