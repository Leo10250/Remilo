import { View } from 'react-native';
import { useTranslation } from '../localization/react';
import { routineProgressModel } from '../domain/routine-focus';
import { Copy } from './components';
import { useTheme } from './theme';

/** Native exercise counts, shared by dated Focus and Agenda; never a completion control. */
export function RoutineProgress({ done, total, compact = false, state, accessible = true }: {
  done: number; total: number; compact?: boolean; state?: string; accessible?: boolean;
}) {
  const t = useTranslation(), colors = useTheme(), progress = routineProgressModel(done, total);
  if (!progress.total) return null;
  const label = t('routine_progress', { done: progress.done, total: progress.total });
  const thickness = compact ? 4 : 6;
  return <View accessible={accessible} accessibilityRole={accessible ? 'progressbar' : undefined}
    accessibilityLabel={accessible ? [label, state].filter(Boolean).join('. ') : undefined}
    accessibilityValue={accessible ? { min: 0, max: progress.total, now: progress.done, text: label } : undefined}
    style={{ gap: compact ? 4 : 8 }}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
      <Copy size={compact ? 14 : 16} muted={compact}>{label}</Copy>{state && <Copy muted size={compact ? 14 : 16}>{state}</Copy>}
    </View>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 2, height: thickness }}>
      {progress.segments ? progress.segments.map((filled, index) => <View key={index} style={{ flex: 1, height: thickness, borderRadius: thickness / 2, backgroundColor: filled ? colors.accent : colors.soft }} />) :
        <View style={{ flex: 1, height: thickness, borderRadius: thickness / 2, overflow: 'hidden', backgroundColor: colors.soft }}>
          <View style={{ height: thickness, width: `${progress.ratio * 100}%`, borderRadius: thickness / 2, backgroundColor: colors.accent }} />
        </View>}
    </View>
  </View>;
}
