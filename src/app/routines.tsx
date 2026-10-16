import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from '../localization/react';
import { View } from 'react-native';
import { Button, ConnectedGroup, Copy, Page, QueryState, RowSupport, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { RootNotice } from '../ui/navigation';
import { routineDayKeys } from '../ui/routine-editor';

export default function Routines() {
  const t = useTranslation();
  const query = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable });
  return <Page title={t('routine_library')} footer={<RootNotice />}>
    <Copy muted>{t('routine_library_hint')}</Copy>
    <Button label={t('routine_new')} icon="add" disabled={!nativeAvailable} onPress={() => router.push({ pathname: '/edit', params: { routine: '1' } })} />
    <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length} emptyMessage={t('routine_empty')} onRetry={() => void query.refetch()} />
    <ConnectedGroup>{query.data?.map(plan => <View key={plan.id}><SettingRow label={plan.title} icon="fitness_center" value={plan.state === 'Paused' ? t('routine_paused') : undefined}
      description={t('routine_repeat', { days: plan.days.map((day, i) => day.type === 'Exercises' ? t(routineDayKeys[i]) : null).filter(Boolean).join(' · ') })}
      onPress={() => router.push({ pathname: '/edit', params: { routineId: plan.id } })} />
      <RowSupport><Button label={t('routine_open_today')} variant="neutral" onPress={() => router.push({ pathname: '/routine-session', params: { id: plan.id } })} /></RowSupport></View>)}</ConnectedGroup>
  </Page>;
}
