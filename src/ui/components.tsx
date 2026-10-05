import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView, unstable_getMaterialSymbolSourceAsync } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export type IconName = 'arrow_back' | 'settings' | 'search' | 'filter_list' | 'add' | 'repeat' | 'more_vert' | 'close' |
  'check' | 'check_circle' | 'radio_button_unchecked' | 'expand_more' | 'expand_less' | 'chevron_right' |
  'alarm' | 'notifications' | 'lock' | 'volume_up' | 'vibration' | 'snooze' | 'schedule' | 'palette' |
  'download' | 'upload' | 'delete' | 'info' | 'warning' | 'error' | 'edit' | 'content_copy' | 'pause' | 'play_arrow' | 'event' | 'folder' | 'notes' | 'undo';
export function Icon({ name, color, size = 24 }: { name: IconName; color?: string; size?: number }) {
  const colors = useTheme();
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    {Platform.OS === 'android' ? <AndroidSymbol name={name} color={color ?? colors.muted} size={size} /> :
      <SymbolView name={{ android: name, web: name }} size={size} tintColor={color ?? colors.muted}
        style={{ width: size, height: size }} accessible={false} />}</View>;
}
const symbolImages = new Map<string, Promise<ImageSourcePropType | null>>();
function AndroidSymbol({ name, color, size }: { name: IconName; color: string; size: number }) {
  // SDK 57 SymbolView uses a scaling Text inside a fixed frame. Render the same
  // bundled Material glyph as an image so 200% text does not clip navigation icons.
  const key = name + ':' + color + ':' + size;
  const [loaded, setLoaded] = useState<{ key: string; source: ImageSourcePropType | null }>();
  useEffect(() => {
    let live = true;
    let image = symbolImages.get(key);
    if (!image) { image = unstable_getMaterialSymbolSourceAsync(name, size, color); symbolImages.set(key, image); }
    void image.then((source) => { if (live) setLoaded({ key, source }); }).catch(() => {
      symbolImages.delete(key); if (live) setLoaded({ key, source: null });
    });
    return () => { live = false; };
  }, [key, name, color, size]);
  if (loaded?.key !== key) return null;
  return loaded.source ? <Image accessible={false} source={loaded.source} style={{ width: size, height: size }} /> :
    <SymbolView name={{ android: name }} tintColor={color} size={size} style={{ width: size, height: size }} />;
}
export function IconButton({ icon, label, onPress, disabled = false }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }}
    onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center',
      borderRadius: 24, backgroundColor: pressed ? colors.soft : 'transparent', opacity: disabled ? 0.4 : 1 })}>
    <Icon name={icon} color={colors.ink} />
  </Pressable>;
}
export function Copy({ children, muted = false, size = 16 }: PropsWithChildren<{ muted?: boolean; size?: number }>) {
  const colors = useTheme();
  return <Text style={{ color: muted ? colors.muted : colors.ink, fontSize: size, lineHeight: size * 1.4 }}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" style={{ color: useTheme().ink, fontSize: 19, fontWeight: '600' }}>{children}</Text>;
}
export function Button({ label, onPress, disabled = false, variant = 'primary' }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger';
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: variant === 'primary' ? colors.accent : colors.soft,
      opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}>
    <Text style={{ color: variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : colors.ink,
      fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}
export function Card({ children }: PropsWithChildren) {
  return <View style={[styles.card, { backgroundColor: useTheme().surface }]}>{children}</View>;
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = useTheme();
  return <View style={{ gap: 4 }}><Copy muted size={13}>{label}</Copy><TextInput accessibilityLabel={label}
    placeholderTextColor={colors.muted} {...props} style={[styles.input, { color: colors.ink,
      backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.muted, minHeight: props.multiline ? 80 : 48 }, props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text>}</View>;
}
export function SettingRow({ label, value, icon, onPress, children, description, disabled = false, statusLabel }: PropsWithChildren<{
  label: string; value?: string; icon?: IconName; description?: string; onPress?: () => void; disabled?: boolean; statusLabel?: string;
}>) {
  const colors = useTheme();
  const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 }}>
    {icon && <Icon name={icon} />}
    <View style={{ flex: 1, gap: 2 }}><Copy>{label}</Copy>{!!description && <Copy muted size={13}>{description}</Copy>}</View>
    {value && <Text style={{ color: colors.muted, fontSize: 14, maxWidth: '48%', flexShrink: 1, textAlign: 'right' }}>{value}</Text>}
    {children}{onPress && <Icon name="chevron_right" size={20} />}
  </View>;
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    accessibilityLabel={[label, value, statusLabel, description].filter(Boolean).join(', ')} onPress={onPress}
    style={({ pressed }) => ({ backgroundColor: pressed ? colors.soft : 'transparent', opacity: disabled ? 0.5 : 1 })}>{body}</Pressable> : body;
}
export function Group({ title, children }: PropsWithChildren<{ title?: string }>) {
  const colors = useTheme();
  return <View style={{ gap: 6 }}>{title && <Text accessibilityRole="header" style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginLeft: 14 }}>{title}</Text>}
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }}>{children}</View></View>;
}
export function SectionHeader({ title, count, expanded, onPress, overdue = false }: {
  title: string; count: number; expanded: boolean; onPress: () => void; overdue?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + count}
    accessibilityState={{ expanded }} onPress={onPress} style={{ paddingHorizontal: 16, minHeight: 48, paddingVertical: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background }}>
    <Text accessibilityRole="header" style={{ color: overdue ? colors.danger : colors.ink, fontSize: 14, fontWeight: '600', flex: 1 }}>{title}</Text>
    <Text style={{ color: colors.muted, fontSize: 13 }}>{count}</Text><Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
  </Pressable>;
}
export function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName }) {
  const colors = useTheme();
  return <SettingRow label={label} icon={icon}><Switch accessibilityLabel={label} value={value} onValueChange={onChange}
    hitSlop={10} thumbColor={value ? colors.accentInk : colors.muted} trackColor={{ true: colors.accent, false: colors.border }} /></SettingRow>;
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
      if (mode === 'date' && !dateOnly) DateTimePickerAndroid.open({ value: next, mode: 'time', onChange: (e, time) => {
        if (e.type === 'set' && time) { next.setHours(time.getHours(), time.getMinutes(), 0, 0); onChange(next.getTime()); }
      } });
    } });
  };
  return <SettingRow icon={timeOnly ? 'schedule' : 'event'} label={label}
    value={timeOnly ? shortTime(value) : dateOnly ? new Date(value).toLocaleDateString() : shortDateTime(value)}
    onPress={() => pick(timeOnly ? 'time' : 'date')} />;
}
export function AppBar({ title, back = true, onBack, actions }: { title: string; back?: boolean; onBack?: () => void; actions?: ReactNode }) {
  const colors = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: back ? 4 : 16,
    backgroundColor: colors.background }}>
    {back && <IconButton icon="arrow_back" label="Back" onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} />}
    <Text accessibilityRole="header" numberOfLines={2} style={{ color: colors.ink, fontSize: back ? 20 : 24, fontWeight: '600', flex: 1 }}>{title}</Text>
    {actions}
  </View>;
}
export function Page({ title, subtitle, children, back = true, actions, onBack }: PropsWithChildren<{
  title: string; subtitle?: string; back?: boolean; actions?: ReactNode; onBack?: () => void;
}>) {
  const colors = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <AppBar title={title} back={back} actions={actions} onBack={onBack} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        {subtitle && <Copy muted size={14}>{subtitle}</Copy>}{children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Sheet({ title, visible, onClose, children }: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void }>) {
  const colors = useTheme();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: '#00000066' }} />
      </Pressable>
      <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4 }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: 20, fontWeight: '600' }}>{title}</Text>
          <IconButton icon="close" label={'Close ' + title} onPress={onClose} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>{children}</ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }}>
    <Icon name={selected ? 'check_circle' : 'radio_button_unchecked'} color={selected ? colors.accent : colors.muted} />
    <View style={{ flex: 1 }}><Copy>{label}</Copy></View>
  </Pressable>;
}
export function SelectRow<T extends string | number>({ label, value, choices, onChange, icon }: {
  label: string; value: T; choices: { value: T; label: string }[]; onChange: (value: T) => void; icon?: IconName;
}) {
  const [open, setOpen] = useState(false);
  return <><SettingRow label={label} icon={icon} value={choices.find((choice) => choice.value === value)?.label ?? String(value)} onPress={() => setOpen(true)} />
    <Sheet title={label} visible={open} onClose={() => setOpen(false)}>{choices.map((choice) => <Choice key={choice.value}
      label={choice.label} selected={choice.value === value} onPress={() => { onChange(choice.value); setOpen(false); }} />)}</Sheet></>;
}
export function Disclosure({ title, children, initial = false, forceOpen = false }: PropsWithChildren<{ title: string; initial?: boolean; forceOpen?: boolean }>) {
  const [selected, setOpen] = useState(initial);
  const open = selected || forceOpen;
  return <Group><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
    style={{ minHeight: 48, flexDirection: 'row', paddingHorizontal: 14, alignItems: 'center', gap: 8 }}>
    <View style={{ flex: 1 }}><Copy>{title}</Copy></View><Icon name={open ? 'expand_less' : 'expand_more'} />
  </Pressable>{open && <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>{children}</View>}</Group>;
}
export function Status({ label, tone = 'muted' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'muted' }) {
  const colors = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
    <Icon name={tone === 'success' ? 'check_circle' : tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : 'info'} color={colors[tone]} size={16} />
    <Text style={{ color: colors[tone], fontSize: 13, flexShrink: 1 }}>{label}</Text>
  </View>;
}
export function Snackbar({ message, action, onAction, onClose }: { message: string; action?: string; onAction?: () => void; onClose: () => void }) {
  const colors = useTheme();
  return <View accessibilityLiveRegion="polite" style={{ margin: 12, paddingLeft: 14, borderRadius: 12, backgroundColor: colors.ink,
    flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={{ color: colors.surface, flex: 1, paddingVertical: 12 }}>{message}</Text>
    {action && <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}>
      <Text style={{ color: colors.surface, fontWeight: '700' }}>{action}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onClose} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" color={colors.surface} size={20} /></Pressable>
  </View>;
}
export function shortTime(value: number) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function shortDateTime(value: number) { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
export function formatTime(value: number | null | undefined) {
  return value == null ? 'No alarm scheduled' : new Date(value).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  card: { padding: 14, borderRadius: 12, gap: 8 },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
