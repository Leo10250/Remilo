import { useTranslation } from '../../localization/react';
import { ownedMessage } from '../../localization';

import { RootNotice, CommandRecovery, useCapturedCommand, useDestinationNavigation } from '../../ui/navigation';
import { useTimeFormatting } from '../../ui/time-display';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { modeLabel } from '../../domain/presentation';
import { creationOrigin, familyBackRoute, familyOriginParams, type OriginParams } from '../../domain/navigation';
import { ActionFeedback, AtmosphericHeader, Button, Copy, Disclosure, Group, Page, QueryState, SettingRow, Status } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';

import { repeatLabel } from '../../ui/recurrence';
import { ReminderRow } from '../../ui/reminder-row';
import { typography } from '../../ui/tokens';
import { ZoneSummary } from '../../ui/schedule';
import { deviceZone } from '../../domain/time';

export default function SeriesDetails() {
  'use no memo';
  const t = useTranslation();
  const { eventRange, shortDateTime } = useTimeFormatting();
  const params = useLocalSearchParams<OriginParams & { id: string; seriesId?: string }>();
  const { id, seriesId: requestedFamily } = params, origin = creationOrigin(params);
  const query = useQuery({ queryKey: ['series', id], queryFn: () => engine().getSeries(id), enabled: nativeAvailable });
  const families = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable });
  const links = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const publications = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(), enabled: nativeAvailable });
  const familyId = requestedFamily ?? query.data?.seriesId;
  const family = families.data?.find((item) => item.seriesId === familyId || item.current.id === id);
  const series = family?.current ?? query.data;
  const routineId = (series?.template as { routineId?: string } | undefined)?.routineId;
  useEffect(() => { if (routineId) router.replace({ pathname: '/edit', params: { routineId } }); }, [routineId]);
  const seriesId = family?.seriesId ?? series?.seriesId;
  const calendarLink = links.data?.find(item => item.seriesId === seriesId || item.occurrenceId === seriesId);
  const publication = publications.data?.find(item => item.occurrenceId === seriesId);
  const occurrences = useInfiniteQuery({ queryKey: ['series-occurrences', seriesId], enabled: nativeAvailable && !!seriesId,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders({ view: 'all', seriesId }, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const action = useCapturedCommand(), back = useDestinationNavigation(origin, undefined, action.guarded, origin, familyBackRoute(params));
  const state = family?.state ?? (series?.exhausted || series?.state === 'Archived' ? 'Ended' : series?.state);
  const items = occurrences.data?.pages.flatMap((page) => page.items) ?? [];
  // Only the family projection excludes completed, skipped and exceptional slots.
  const upcoming = family?.upcoming ?? [];
  const changeState = async () => {
    if (!series || action.guarded) return;
    await action.execute({ command: { kind: state === 'Paused' ? 'ResumeSeries' : 'PauseSeries', segmentId: series.id,
      expectedRevision: series.revision, operationId: engine().createOperationId() }, success: state === 'Paused' ? t('m_56a8e21ebc59') : t('m_aa3a336db555') });
  };
  return <Page title={t('m_9fcf6f51ee18')} onBack={back} scrollKey={'family:' + (seriesId ?? id)} scrollReady={!query.isLoading && !families.isLoading}
    header={<AtmosphericHeader title={t('m_9fcf6f51ee18')} onBack={back} />} footer={<><RootNotice disabled={action.guarded} /><CommandRecovery action={action} /></>}>
    <QueryState loading={!series && (query.isLoading || families.isLoading)} error={!series ? query.error ?? families.error : undefined}
      empty={!series} emptyMessage={!nativeAvailable ? t('m_f53ace288490') : t('m_7da0e3e6ac3c')}
      onRetry={() => { void query.refetch(); void families.refetch(); }} />
    {series && <>
      <Copy heading size={typography.title}>{series.template.title}</Copy>
      <Status label={state === 'Ended' ? t('m_b98441d07f19') : state ? ownedMessage(state) : t('m_92340695899b')} tone={state === 'Active' ? 'success' : 'muted'} />
      <Copy muted size={typography.supporting}>{repeatLabel(series.rule)}</Copy>
      {state !== 'Active' && <Copy muted size={typography.supporting}>{state === 'Paused' ? t('m_6a458b78ef8b') : t('m_16ec9a74e6b4')} {t('m_521080947082')}</Copy>}
      <QueryState loading={families.isLoading} error={families.error} onRetry={() => void families.refetch()} />
      <Group title={t('m_f4830a1dae29')}>
        <SettingRow intent="action" icon="event" label={t('m_4e1f49a9c8ae')} description={eventRange(series.template)} />
        {(series.template.dueLinked === false || series.template.dueAtMs !== series.template.eventStartMs) && <SettingRow intent="action" icon="schedule" label={t('m_9071738f1459')} description={series.template.allDay && series.template.dueLinked ? t('m_6a189ba7d0ac') : shortDateTime(series.template.dueAtMs, series.rule.zoneId ?? undefined) + (series.template.dueLinked === false ? t('m_cc458db246e8') : t('m_6b6f701f5cec'))} />}
        <SettingRow intent="action" icon={series.template.mode === 'Alarm' ? 'alarm' : series.template.mode === 'Notification' ? 'notifications' : 'alarm_off'} label={modeLabel(series.template.mode)} description={series.template.mode === 'None' ? t('m_d1af410eb4d0') : shortDateTime(series.template.alarmAtMs, series.rule.zoneId ?? undefined) + (series.template.alarmLinked === false ? t('m_f443449e9958') : t('m_1d9f1a6a9399'))} />
        {series.rule.zoneId ? <ZoneSummary zoneId={series.rule.zoneId} atMs={series.template.eventStartMs} prefix={t('m_93cc39bcfd10')} /> : <SettingRow intent="action" label={t('m_b9fe1464783e')} value={t('m_394d31d5bfb3')} />}
        <SettingRow intent="action" icon="repeat" label={t('m_e98982c9f2ba')} value={series.rule.count ? t('m_76348b77ee9b', { arg0: String(series.rule.count) }) : series.rule.until ?? t('m_64d389ab5222')} />
        {!!series.template.listName && <SettingRow intent="action" icon="checklist" label={t('m_6f202f54a7b2')} value={series.template.listName} />}
      </Group>
      {series.state !== 'Archived' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {state !== 'Ended' && <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon={state === 'Paused' ? 'play_arrow' : 'pause'} label={state === 'Paused' ? t('m_89b7b9146715') : t('m_7c5238809996')}
          disabled={action.guarded} onPress={() => void changeState()} /></View>}
        <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="edit" label={t('m_9916d68ae209')} variant="secondary" disabled={action.guarded}
          onPress={() => router.push({ pathname: '/edit', params: { segmentId: series.id, ...familyOriginParams(params, seriesId ?? series.seriesId, series.id) } })} /></View>
      </View>}
      <Group title={state === 'Paused' ? t('m_9b4aef8693f9') : t('m_2cc2a7090f66')}>{upcoming.slice(0, 3).map((slot) => {
        const paused = (slot.state ?? state) === 'Paused', mode = slot.mode ?? series.template.mode;
        return <SettingRow intent="action" key={slot.segmentId + ':' + slot.nominalSlot} icon="event"
        label={shortDateTime(slot.eventStartMs, slot.zoneId ?? series.rule.zoneId ?? undefined)}
        description={mode === 'None' ? t('m_d1af410eb4d0') : (paused ? t('m_f04891cf0248') : '') + modeLabel(mode) + ' · ' +
          shortDateTime(slot.alarmAtMs, slot.zoneId ?? series.rule.zoneId ?? undefined) + (paused ? ' · ' + t('m_e159b06187d3') : '')}>
          {(slot.zoneId ?? series.rule.zoneId) && (slot.zoneId ?? series.rule.zoneId) !== deviceZone() && <ZoneSummary zoneId={(slot.zoneId ?? series.rule.zoneId)!} atMs={slot.eventStartMs} />}
        </SettingRow>;
      })}
        {!upcoming.length && !families.isLoading && !families.error && <SettingRow intent="action" label={t('m_c4aba4adaad7')} />}</Group>
      <Group><SettingRow intent="navigation" icon="event" label={t('m_b074310e911f')} description={calendarLink ? t('m_464c52392b11') : publication ? t('m_f24802b28eb5') : t('m_645b7e55ef96')} disabled={action.guarded}
        onPress={() => router.push({ pathname: calendarLink || publication ? '/calendar-manage' : '/calendar-publish', params: { id: calendarLink?.occurrenceId ?? seriesId ?? series.id, ...familyOriginParams(params, seriesId ?? series.seriesId, series.id) } })} /></Group>
      {!!upcoming.length && upcoming.length < 3 && <Copy muted size={14}>{t('m_de7aab2159df')}</Copy>}
      <Disclosure title={t('m_8be36e9d25fb')} initial>
        <QueryState loading={occurrences.isLoading} error={occurrences.error} empty={!items.length}
          emptyMessage={t('m_01f414f4301a')} onRetry={() => void occurrences.refetch()} />
        {items.map((item) => <ReminderRow key={item.id} item={item}
          onOpen={() => { if (!action.guarded) router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...familyOriginParams(params, seriesId ?? series.seriesId, series.id) } }); }} busy={action.guarded} />)}
        {occurrences.isFetchNextPageError && <ActionFeedback message={t('m_7e0b4261ae6e')} tone="danger" />}
        {occurrences.hasNextPage && <Button label={occurrences.isFetchingNextPage ? t('m_964e5f88d036') : occurrences.isFetchNextPageError ? t('m_6c13d1198cd5') : t('m_ac8991ef0101')}
          disabled={occurrences.isFetchingNextPage} variant="secondary" onPress={() => void occurrences.fetchNextPage()} />}
      </Disclosure>
      <Copy muted size={14}>{t('m_81478064522f')}</Copy>
    </>}
  </Page>;
}
