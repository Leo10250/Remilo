import { Fragment, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { ReminderDraft } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Copy, Icon, type IconName } from './components';
import { useFontScaleOverride, useFoundationStyle, useTheme } from './theme';
import { shape, space, typography } from './tokens';

type AlertMode = NonNullable<ReminderDraft['mode']>;
const choices: { value: AlertMode; label: string; icon: IconName; description: string }[] = [
  { value: 'Alarm', label: 'Alarm', icon: 'alarm', description: 'Rings with sound.' },
  { value: 'Notification', label: 'Notification', icon: 'notifications', description: 'Shows an Android notification.' },
  { value: 'None', label: 'No alert', icon: 'alarm_off', description: 'Saves the reminder without sound or a notification.' },
];

/** All three modes stay visible; choosing one changes only the guarded editor draft. */
export function AlertModeSelector({ value, onChange, disabled = false }: {
  value: AlertMode; onChange: (value: AlertMode) => void; disabled?: boolean;
}) {
  const colors = useTheme(), foundation = useFoundationStyle(), scale = useFontScaleOverride();
  const { fontScale, width } = useWindowDimensions();
  const [groupWidth, setGroupWidth] = useState<number | null>(null);
  // Reserve room for a label beside its icon and checked indicator, without shrinking text.
  const stacked = Math.max(scale, fontScale) >= 1.6 ||
    (groupWidth ?? width - space.gutter * 4) < choices.length * 180 * Math.max(scale, fontScale);
  const [focused, setFocused] = useState<AlertMode | null>(null);
  const disabledInk = foundation?.colors.disabledInk ?? colors.muted;
  return <View style={{ padding: space.gutter, gap: space.sm }}>
    <Copy muted size={typography.supporting}>Alert</Copy>
    <View accessibilityRole="radiogroup" accessibilityLabel="Alert" onLayout={(event) => setGroupWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: stacked ? 'column' : 'row',
      borderRadius: shape.field, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      {choices.map((choice, index) => {
        const selected = choice.value === value, ink = disabled ? disabledInk : selected ? colors.accent : colors.muted;
        const edgeRadius = shape.field - 1;
        const corners = {
          borderTopLeftRadius: index === 0 ? edgeRadius : 0,
          borderTopRightRadius: (stacked ? index === 0 : index === choices.length - 1) ? edgeRadius : 0,
          borderBottomLeftRadius: (stacked ? index === choices.length - 1 : index === 0) ? edgeRadius : 0,
          borderBottomRightRadius: index === choices.length - 1 ? edgeRadius : 0,
        };
        const radio = <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ink, alignItems: 'center', justifyContent: 'center' }}>
          {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ink }} />}
        </View>;
        return <Fragment key={choice.value}><Pressable accessibilityRole="radio" accessibilityLabel={choice.label}
          accessibilityHint={choice.description} aria-checked={selected} accessibilityState={{ checked: selected, disabled }}
          disabled={disabled} onPress={() => onChange(choice.value)} onFocus={() => setFocused(choice.value)} onBlur={() => setFocused(null)}
          style={({ pressed }) => ({ flex: stacked ? undefined : 1, minHeight: 56,
            paddingVertical: space.md, paddingHorizontal: space.md, gap: space.sm,
            flexDirection: 'row', alignItems: 'center', ...corners,
            borderWidth: 2, borderColor: focused === choice.value || selected ? colors.accent : 'transparent',
            backgroundColor: disabled ? foundation?.colors.disabledSurface ?? colors.soft : pressed || selected ? colors.soft : colors.surface })}>
          <Icon name={choice.icon} size={24} color={ink} />
          <Text style={{ flex: 1, flexShrink: 1, color: disabled ? disabledInk : colors.ink,
            fontSize: typography.body * scale, lineHeight: typography.body * scale * 1.4,
            fontWeight: selected ? '600' : '400' }}>{choice.label}</Text>
          {radio}
        </Pressable>{index < choices.length - 1 && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: stacked ? undefined : 1, height: stacked ? 1 : undefined, backgroundColor: colors.border }} />}</Fragment>;
      })}
    </View>
    <Copy muted size={typography.supporting}>{choices.find((choice) => choice.value === value)?.description}</Copy>
  </View>;
}
