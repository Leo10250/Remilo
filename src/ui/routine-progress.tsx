import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTranslation } from '../localization/react';
import { routineProgressModel } from '../domain/routine-focus';
import { Copy } from './components';
import { useFontScaleOverride, useTheme } from './theme';

/** Two clipped half-arcs keep the native ring exact without images or another renderer. */
export function RoutineProgressRing({ done, total }: { done: number; total: number }) {
  const colors = useTheme(), progress = routineProgressModel(done, total);
  const size = 24, half = size / 2, stroke = 2.5;
  const circle = { width: size, height: size, borderRadius: half, borderWidth: stroke };
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={{ ...circle, borderColor: colors.border }} />
    {progress.ratio > 0 && <View style={{ position: 'absolute', left: half, top: 0, width: half, height: size, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: -half, width: size, height: size, transform: [{ rotate: `${Math.min(progress.ratio * 2, 1) * 180}deg` }] }}>
        <View style={{ width: half, height: size, overflow: 'hidden' }}><View style={{ ...circle, borderColor: colors.accent }} /></View>
      </View>
    </View>}
    {progress.ratio > 0.5 && <View style={{ position: 'absolute', left: 0, top: 0, width: half, height: size, overflow: 'hidden' }}>
      <View style={{ width: size, height: size, transform: [{ rotate: `${(progress.ratio - 0.5) * 360}deg` }] }}>
        <View style={{ position: 'absolute', left: half, width: half, height: size, overflow: 'hidden' }}><View style={{ ...circle, marginLeft: -half, borderColor: colors.accent }} /></View>
      </View>
    </View>}
  </View>;
}

function ProgressTrack({ done, total, thickness, compact }: { done: number; total: number; thickness: number; compact?: boolean }) {
  const colors = useTheme(), progress = routineProgressModel(done, total);
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 2, height: thickness, width: compact ? 48 : undefined, flexShrink: 0 }}>
    {progress.segments ? progress.segments.map((filled, index) => <View key={index} style={{ flex: 1, height: thickness, borderRadius: thickness / 2, backgroundColor: filled ? colors.accent : colors.soft }} />) :
      <View style={{ flex: 1, height: thickness, borderRadius: thickness / 2, overflow: 'hidden', backgroundColor: colors.soft }}>
        <View style={{ height: thickness, width: `${progress.ratio * 100}%`, borderRadius: thickness / 2, backgroundColor: colors.accent }} />
      </View>}
  </View>;
}

/** Native exercise counts, shared by dated Focus and Agenda; never a completion control. */
export function RoutineProgress({ done, total, compact = false, state, accessible = true, layout = 'stacked' }: {
  done: number; total: number; compact?: boolean; state?: string; accessible?: boolean; layout?: 'stacked' | 'inline';
}) {
  const t = useTranslation(), progress = routineProgressModel(done, total), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions(), [width, setWidth] = useState(Infinity);
  if (!progress.total) return null;
  const label = t('routine_progress', { done: progress.done, total: progress.total });
  const thickness = compact ? 4 : 6;
  const inline = layout === 'inline' && fontScale * scale <= 1.2 && width >= Math.max(160, 56 + label.length * 6.8) * fontScale * scale;
  return <View accessible={accessible} accessibilityRole={accessible ? 'progressbar' : undefined}
    accessibilityLabel={accessible ? [label, state].filter(Boolean).join('. ') : undefined}
    accessibilityValue={accessible ? { min: 0, max: progress.total, now: progress.done, text: label } : undefined}
    onLayout={layout === 'inline' ? event => { const next = event.nativeEvent.layout.width; setWidth(previous => Math.abs(previous - next) < 1 ? previous : next); } : undefined}
    style={{ gap: layout === 'inline' ? 8 : compact ? 4 : 8, flexDirection: inline ? 'row' : 'column', alignItems: inline ? 'center' : 'stretch' }}>
    {inline && <ProgressTrack done={progress.done} total={progress.total} thickness={thickness} compact />}
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4, flexShrink: 1 }}>
      <Copy size={compact ? 14 : 16} muted={compact}>{label}</Copy>{state && <Copy muted size={compact ? 14 : 16}>{state}</Copy>}
    </View>
    {!inline && <ProgressTrack done={progress.done} total={progress.total} thickness={thickness} />}
  </View>;
}
