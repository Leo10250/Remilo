import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export function Copy({ children, muted = false, size = 16 }: PropsWithChildren<{ muted?: boolean; size?: number }>) {
  const colors = useTheme();
  return <Text style={{ color: muted ? colors.muted : colors.ink, fontSize: size, lineHeight: size * 1.5 }}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" style={{ color: useTheme().ink, fontSize: 22, fontWeight: '600' }}>{children}</Text>;
}
export function Button({ label, onPress, disabled = false, variant = 'primary' }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger';
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: variant === 'primary' ? colors.accent : colors.soft,
      opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={{ color: variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : colors.ink,
      fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}
export function Card({ children }: PropsWithChildren) {
  return <View style={[styles.card, { backgroundColor: useTheme().surface }]}>{children}</View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useTheme();
  return <View style={{ gap: 8 }}><Copy muted>{label}</Copy><TextInput accessibilityLabel={label}
    placeholderTextColor={colors.muted} {...props} style={[styles.input, { color: colors.ink,
      backgroundColor: colors.surface, borderColor: colors.border, minHeight: props.multiline ? 110 : 54 }, props.style]} /></View>;
}
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const colors = useTheme();
  return <View style={styles.row}><View style={{ flex: 1 }}><Copy>{label}</Copy></View>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
  </View>;
}
export function DateField({ label, value, onChange, timeOnly = false, dateOnly = false }: {
  label: string; value: number; onChange: (value: number) => void; timeOnly?: boolean; dateOnly?: boolean;
}) {
  const pick = (mode: 'date' | 'time') => {
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({ value: new Date(value), mode, onChange: (event, selected) => {
      if (event.type !== 'set' || !selected) return;
      const next = new Date(value);
      if (mode === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(next.getTime());
    } });
  };
  return <View style={{ gap: 8 }}><Copy muted>{label}</Copy>
    <Copy>{timeOnly ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : dateOnly ? new Date(value).toLocaleDateString() : formatTime(value)}</Copy>
    <View style={styles.row}>{!timeOnly && <View style={{ flex: 1 }}><Button label="Change date" variant="secondary" onPress={() => pick('date')} /></View>}
      {!dateOnly && <View style={{ flex: 1 }}><Button label="Change time" variant="secondary" onPress={() => pick('time')} /></View>}
    </View>
  </View>;
}
export function Page({ title, subtitle, children, back = true }: PropsWithChildren<{ title: string; subtitle?: string; back?: boolean }>) {
  const colors = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      {back && <Button label="Back" variant="secondary" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />}
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 32, fontWeight: '700' }}>{title}</Text>
      {subtitle && <Copy muted>{subtitle}</Copy>}{children}
    </ScrollView>
  </SafeAreaView>;
}
export function formatTime(value: number | null | undefined) {
  return value == null ? 'No alert scheduled' : new Date(value).toLocaleString([], {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
export const styles = StyleSheet.create({
  page: { padding: 22, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  card: { padding: 20, borderRadius: 20, gap: 14 },
  button: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, minHeight: 50, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 17, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
