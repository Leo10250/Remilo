import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { RepeatFamily } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Copy, Group, Page, QueryState, SettingRow, shortDateTime } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
import { repeatLabel } from '../../ui/recurrence';
import { useTheme } from '../../ui/theme';
import { typography } from '../../ui/tokens';
import { RootNotice, useBrowseNavigation } from '../../ui/navigation';
import { useRootState } from '../../ui/root-state';

export default function Repeats() {
  const colors = useTheme();
  const [state, setState] = useRootState<RepeatFamily['state']>('repeats:state', 'Active');
  const navigation = useBrowseNavigation({ kind: 'repeats' });
  const query = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable });
  const items = query.data?.filter((family) => family.state === state) ?? [];
  return <Page title="Repeats" back={false} leading={navigation.leading} scrollKey="repeats" scrollReady={!query.isLoading} footer={<>{navigation.overlay}<RootNotice /></>}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['Active', 'Paused', 'Ended'] as const).map((value) => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: state === value }} onPress={() => setState(value)}
        style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24,
          backgroundColor: state === value ? colors.accent : colors.surface, opacity: pressed ? 0.75 : 1 })}>
        <Text style={{ color: state === value ? colors.accentInk : colors.ink, fontSize: typography.supporting, fontWeight: '600' }}>{value}</Text>
      </Pressable>)}
    </View>
    <QueryState loading={query.isLoading} error={query.error} empty={!items.length}
      emptyMessage={!nativeAvailable ? 'Use the Android app to manage repeats.' : `No ${state.toLowerCase()} repeats.`} onRetry={() => void query.refetch()} />
    {!!items.length && <Group>{items.map((family) => {
      const next = family.upcoming[0], series = family.current;
      return <SettingRow key={family.seriesId} label={series.template.title} icon="repeat"
        description={[repeatLabel(series.rule), next ? (state === 'Paused' ? 'Planned ' : 'Next ') + shortDateTime(next.eventStartMs, series.rule.zoneId ?? undefined)
          : state === 'Ended' ? 'No future dates' : '', family.unfinishedCount ? `${family.unfinishedCount} unfinished` : ''].filter(Boolean).join(' · ')}
        onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id, seriesId: family.seriesId } })} />;
    })}</Group>}
    {state !== 'Active' && <Copy muted size={14}>{state === 'Paused' ? 'Planned dates have no ordinary alerts while this repeat is paused.' : 'This repeat has no ordinary future dates.'} Unfinished occurrences and independently scheduled exceptions remain actionable in Agenda.</Copy>}
  </Page>;
}
