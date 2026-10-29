import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from '../localization/react';
import { useState } from 'react';
import { RoutineActions } from '../ui/routine-actions';
import { View } from 'react-native';
import { Button, ConnectedGroup, Copy, IconButton, Page, QueryState, RowSupport, SettingRow } from '../ui/components';
import { engine, nativeAvailable } from '../ui/native';
import { RootNotice } from '../ui/navigation';
import { routineDayKeys } from '../ui/routine-editor';

export default function Routines() {
  const t = useTranslation();
  const [menu, setMenu] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable });
  return <Page title={t('routine_library')} footer={<RootNotice />}>
    <Copy muted>{t('routine_library_hint')}</Copy>
    <Button label={t('routine_new')} icon="add" disabled={!nativeAvailable} onPress={() => router.push('/routine-edit')} />
    <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length} emptyMessage={t('routine_empty')} onRetry={() => void query.refetch()} />
    <ConnectedGroup>{query.data?.map(plan => <View key={plan.id}><View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><SettingRow intent="navigation" label={plan.title} icon="checklist" value={plan.state === 'Paused' ? t('routine_paused') : undefined}
      description={t('routine_repeat', { days: plan.days.map((day, i) => day.type === 'Exercises' ? t(routineDayKeys[i]) : null).filter(Boolean).join(' · ') })}
      onPress={() => router.push({ pathname: '/routine-edit', params: { routineId: plan.id } })} /></View><IconButton icon="more_vert" label={t('routine_more')} onPress={() => setMenu(plan.id)} /></View>
      <RowSupport><Button label={t('routine_open_today')} variant="neutral" onPress={() => router.push({ pathname: '/routine-session', params: { id: plan.id } })} /></RowSupport></View>)}</ConnectedGroup>
    <RoutineActions target={menu ? { id: menu } : null} onClose={() => setMenu(null)} />
  </Page>;
}
