import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { RepeatFamily } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { AtmosphericHeader, Copy, Icon, Page, QueryState, shortDateTime } from '../../ui/components';
import { engine, nativeAvailable } from '../../ui/native';
import { repeatLabel } from '../../ui/recurrence';
import { useFontScaleOverride, useTheme } from '../../ui/theme';
import { typography } from '../../ui/tokens';
import { RootMore, RootNavigation, RootNotice, useDestinationNavigation } from '../../ui/navigation';
import { originParams } from '../../domain/navigation';
import { useRootState } from '../../ui/root-state';

export default function Repeats() {
  const colors = useTheme(), scale = useFontScaleOverride();
  const [state, setState] = useRootState<RepeatFamily['state']>('repeats:state', 'Active');
  useDestinationNavigation({ kind: 'repeats' });
  const query = useQuery({ queryKey: ['repeat-families'], queryFn: () => engine().queryRepeatFamilies(), enabled: nativeAvailable });
  const items = query.data?.filter((family) => family.state === state) ?? [];
  return <Page title="Repeats" back={false} scrollKey="repeats" scrollReady={!query.isLoading}
    header={<AtmosphericHeader title="Repeats" back={false} actions={<RootMore origin={{ kind: 'repeats' }} />} />}
    footer={<><RootNotice /><RootNavigation destination="repeats" /></>}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['Active', 'Paused', 'Ended'] as const).map((value) => <Pressable key={value} accessibilityRole="tab"
        aria-selected={state === value} accessibilityState={{ selected: state === value }} onPress={() => setState(value)}
        style={({ pressed }) => ({ flexGrow: 1, minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 24,
          backgroundColor: state === value ? colors.accent : colors.soft, opacity: pressed ? 0.75 : 1 })}>
        <Text style={{ color: state === value ? colors.accentInk : colors.ink, fontSize: typography.supporting * scale, lineHeight: typography.supporting * scale * 1.4, fontWeight: state === value ? '600' : '400' }}>{value}</Text>
      </Pressable>)}
    </View>
    <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!items.length}
      emptyMessage={!nativeAvailable ? 'Use the Android app to manage repeats.' : `No ${state.toLowerCase()} repeats.`} onRetry={() => void query.refetch()} />
    {!!items.length && <View style={{ gap: 12 }}>{items.map((family) => {
      const next = family.upcoming[0], series = family.current;
      const nextLabel = next ? (state === 'Paused' ? 'Planned ' : 'Next ') + shortDateTime(next.eventStartMs, series.rule.zoneId ?? undefined) : state === 'Ended' ? 'No ordinary future dates' : '';
      return <Pressable key={family.seriesId} accessibilityRole="button" accessibilityLabel={[series.template.title, repeatLabel(series.rule), nextLabel, `${family.unfinishedCount} unfinished occurrences`].filter(Boolean).join('. ')}
        onPress={() => router.push({ pathname: '/series/[id]', params: { id: series.id, seriesId: family.seriesId, ...originParams({ kind: 'repeats' }) } })}
        style={({ pressed }) => ({ minHeight: 72, padding: 16, borderRadius: 16, backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="repeat" /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontSize: typography.body * scale, lineHeight: typography.body * scale * 1.4, fontWeight: '600' }}>{series.template.title}</Text>
          <Copy muted size={typography.supporting}>{repeatLabel(series.rule)}</Copy>
          {!!nextLabel && <Copy muted size={typography.supporting}>{nextLabel}</Copy>}
          {family.unfinishedCount > 0 && <Copy muted size={typography.supporting}>{family.unfinishedCount} unfinished</Copy>}
        </View><Icon name="chevron_right" />
      </Pressable>;
    })}</View>}
    {state !== 'Active' && <Copy muted size={14}>{state === 'Paused' ? 'Planned dates have no ordinary alerts while this repeat is paused.' : 'This repeat has no ordinary future dates.'} Unfinished occurrences and independently scheduled exceptions remain actionable in Agenda.</Copy>}
  </Page>;
}
