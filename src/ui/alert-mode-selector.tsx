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
  const stacked = Math.max(scale, fontScale) >= 1.6 || width < 360;
  const [focused, setFocused] = useState<AlertMode | null>(null);
  const disabledInk = foundation?.colors.disabledInk ?? colors.muted;
  return <View style={{ padding: space.gutter, gap: space.sm }}>
    <Copy muted size={typography.supporting}>Alert</Copy>
    <View accessibilityRole="radiogroup" accessibilityLabel="Alert" style={{ flexDirection: stacked ? 'column' : 'row',
      borderRadius: shape.field, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      {choices.map((choice, index) => {
        const selected = choice.value === value, ink = disabled ? disabledInk : selected ? colors.accent : colors.muted;
        const radio = <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ink, alignItems: 'center', justifyContent: 'center' }}>
          {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ink }} />}
        </View>;
        return <Fragment key={choice.value}><Pressable accessibilityRole="radio" accessibilityLabel={choice.label}
          accessibilityHint={choice.description} aria-checked={selected} accessibilityState={{ checked: selected, disabled }}
          disabled={disabled} onPress={() => onChange(choice.value)} onFocus={() => setFocused(choice.value)} onBlur={() => setFocused(null)}
          style={({ pressed }) => ({ flex: stacked ? undefined : 1, minHeight: stacked ? 56 : 80,
            paddingVertical: space.md, paddingHorizontal: stacked ? space.md : space.xs, gap: space.sm,
            flexDirection: stacked ? 'row' : 'column', alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: focused === choice.value || selected ? colors.accent : 'transparent',
            backgroundColor: disabled ? foundation?.colors.disabledSurface ?? colors.soft : pressed || selected ? colors.soft : colors.surface })}>
          {stacked ? <Icon name={choice.icon} size={24} color={ink} /> : <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}><Icon name={choice.icon} size={20} color={ink} />{radio}</View>}
          <Text style={{ flex: stacked ? 1 : undefined, flexShrink: 1, color: disabled ? disabledInk : colors.ink,
            fontSize: (stacked ? typography.body : typography.supporting) * scale,
            lineHeight: (stacked ? typography.body : typography.supporting) * scale * 1.4,
            fontWeight: selected ? '600' : '400', textAlign: stacked ? 'auto' : 'center' }}>{choice.label}</Text>
          {stacked && radio}
        </Pressable>{index < choices.length - 1 && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={{ width: stacked ? undefined : 1, height: stacked ? 1 : undefined, backgroundColor: colors.border }} />}</Fragment>;
      })}
    </View>
    <Copy muted size={typography.supporting}>{choices.find((choice) => choice.value === value)?.description}</Copy>
  </View>;
}
