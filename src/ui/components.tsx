import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView, unstable_getMaterialSymbolSourceAsync } from 'expo-symbols';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFoundationStyle, usePresentationState, useReviewFontScale, useTheme } from './theme';
import { typography, space, shape } from './tokens';
import { civilAt, deviceZone, mergeCivil, pickerCivil } from '../domain/time';
import { engine } from './native';
import type { Tone } from '../domain/actions';
import { useReducedMotion } from './motion';
import { readRootSnapshot, writeRootSnapshot } from '../domain/navigation';

export type IconName = 'arrow_back' | 'settings' | 'search' | 'filter_list' | 'add' | 'repeat' | 'more_vert' | 'close' |
  'check' | 'check_circle' | 'radio_button_unchecked' | 'expand_more' | 'expand_less' | 'chevron_right' |
  'alarm' | 'notifications' | 'lock' | 'volume_up' | 'vibration' | 'snooze' | 'schedule' | 'palette' |
  'download' | 'upload' | 'delete' | 'info' | 'warning' | 'error' | 'edit' | 'content_copy' | 'pause' | 'play_arrow' | 'event' | 'folder' | 'notes' | 'undo' | 'refresh' | 'history' | 'stop' |
  'menu' | 'checklist' | 'restore' | 'delete_forever' | 'task_alt' | 'cancel' | 'alarm_off' | 'hourglass_empty' | 'block' | 'notification_important' |
  'medication' | 'eco' | 'fitness_center' | 'restaurant' | 'celebration' | 'book' | 'bedtime' | 'home';
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
  const foundation = useFoundationStyle(), state = usePresentationState(), [focused, setFocused] = useState(false);
  const c = foundation?.colors;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center',
      borderRadius: 24, backgroundColor: c ? disabled ? c.disabledSurface : pressed || state === 'pressed' ? c.secondaryPressed : 'transparent' : pressed ? colors.soft : 'transparent',
      borderWidth: c ? 2 : 0, borderColor: c && (focused || state === 'focused') ? c.focus : 'transparent', opacity: c ? 1 : disabled ? 0.4 : 1 })}>
    <Icon name={icon} color={c && disabled ? c.disabledInk : colors.ink} />
  </Pressable>;
}
export function Copy({ children, muted = false, size = typography.body, heading = false }: PropsWithChildren<{ muted?: boolean; size?: number; heading?: boolean }>) {
  const colors = useTheme(), scale = useReviewFontScale();
  return <Text accessibilityRole={heading ? 'header' : undefined} style={{ color: muted ? colors.muted : colors.ink, fontSize: size * scale, lineHeight: size * scale * 1.4, fontWeight: heading ? '600' : undefined }}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  const scale = useReviewFontScale();
  const foundation = useFoundationStyle();
  return <Text accessibilityRole="header" style={{ color: useTheme().ink, fontSize: typography.heading * scale, lineHeight: foundation ? typography.heading * scale * 1.4 : undefined, fontWeight: '600' }}>{children}</Text>;
}
export function Button({ label, onPress, disabled = false, variant = 'primary', icon, busy = false }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger'; icon?: IconName; busy?: boolean;
}) {
  const colors = useTheme(), scale = useReviewFontScale();
  const foundation = useFoundationStyle(), state = usePresentationState(), [focused, setFocused] = useState(false);
  const c = foundation?.colors, blocked = disabled || busy;
  const foreground = c ? blocked ? c.disabledInk : variant === 'primary' ? state === 'pressed' ? c.onPrimaryPressed : c.accentInk : variant === 'danger' ? c.dangerInk : c.ink : variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : colors.ink;
  const button = <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [styles.button, { backgroundColor: c ? blocked ? c.disabledSurface : variant === 'primary' ? pressed || state === 'pressed' ? c.primaryPressed : c.accent : variant === 'danger' ? c.dangerSurface : pressed || state === 'pressed' ? c.secondaryPressed : c.soft : variant === 'primary' ? colors.accent : colors.soft,
      borderRadius: foundation?.tokens.shape.action ?? shape.action,
      borderWidth: c ? 2 : 0, borderColor: c && variant === 'secondary' ? c.outline : 'transparent',
      flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: c ? 1 : blocked ? 0.45 : pressed ? 0.7 : 1 }]}>
    {(c || icon || busy) && <View style={{ width: 20, height: 20 }}>{busy ? <ActivityIndicator color={foreground} size={20} /> : icon && <Icon name={icon} color={foreground} size={20} />}</View>}
    <Text style={{ color: foreground, lineHeight: c ? typography.supporting * scale * 1.4 : undefined,
      flexShrink: 1, fontSize: typography.supporting * scale, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
  return c ? <View style={{padding:4,borderWidth:2,borderColor:focused || state === 'focused' ? c.focus : 'transparent',borderRadius:18}}>{button}</View> : button;
}
export function Card({ children }: PropsWithChildren) {
  return <View style={[styles.card, { backgroundColor: useTheme().surface }]}>{children}</View>;
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = useTheme(), scale = useReviewFontScale();
  const foundation = useFoundationStyle(), [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const onContentSizeChange = props.onContentSizeChange;
  const resize = useCallback<NonNullable<TextInputProps['onContentSizeChange']>>(event => {
    setContentHeight(Math.ceil(event.nativeEvent.contentSize.height) + 2);
    onContentSizeChange?.(event);
  }, [onContentSizeChange]);
  return <View style={{ gap: space.xs }}><Copy muted size={typography.supporting}>{label}</Copy><TextInput accessibilityLabel={label}
    placeholderTextColor={colors.muted} {...props}
    onContentSizeChange={foundation && props.multiline ? resize : props.onContentSizeChange}
    onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, { color: colors.ink,
      borderRadius: foundation?.tokens.shape.field ?? shape.field,
      backgroundColor: colors.surface, borderColor: error ? colors.danger : focused && foundation ? foundation.colors.focus : foundation?.colors.outline ?? colors.muted, minHeight: props.multiline ? Math.max(80, foundation ? contentHeight : 80) : 48,
      fontSize: typography.body * scale }, props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: foundation ? typography.supporting * scale : undefined, lineHeight: foundation ? typography.supporting * scale * 1.4 : undefined }}>{error}</Text>}</View>;
}
export function SettingRow({ label, value, icon, onPress, children, description, disabled = false, statusLabel }: PropsWithChildren<{
  label: string; value?: string; icon?: IconName; description?: string; onPress?: () => void; disabled?: boolean; statusLabel?: string;
}>) {
  const colors = useTheme(), scale = useReviewFontScale();
  const foundation = useFoundationStyle();
  const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.md, paddingHorizontal: space.gutter }}>
    {icon && <Icon name={icon} />}
    <View style={{ flex: 1, gap: space.xs }}><Copy>{label}</Copy>{!!description && <Copy muted size={typography.supporting}>{description}</Copy>}</View>
    {value && <Text style={{ color: colors.muted, fontSize: typography.supporting * scale, maxWidth: '48%', flexShrink: 1, textAlign: 'right' }}>{value}</Text>}
    {children}{onPress && <Icon name="chevron_right" size={20} />}
  </View>;
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    accessibilityLabel={[label, value, statusLabel, description].filter(Boolean).join(', ')} onPress={onPress}
    style={({ pressed }) => ({ backgroundColor: foundation && disabled ? foundation.colors.disabledSurface : pressed ? colors.soft : 'transparent', opacity: foundation ? 1 : disabled ? 0.5 : 1 })}>{body}</Pressable> : body;
}
export function Group({ title, children }: PropsWithChildren<{ title?: string }>) {
  const colors = useTheme(), scale = useReviewFontScale();
  const foundation = useFoundationStyle();
  return <View style={{ gap: space.sm, backgroundColor: foundation ? colors.surface : undefined, borderRadius: foundation ? shape.group : undefined, paddingTop: foundation && title ? space.sm : undefined }}>{title && <Text accessibilityRole="header" style={{ color: colors.muted, fontSize: (foundation ? typography.supporting : typography.label) * scale, fontWeight: '600', marginLeft: space.gutter }}>{title}</Text>}
    <View style={{ backgroundColor: colors.surface, borderRadius: shape.group, overflow: 'hidden' }}>{children}</View></View>;
}
export function SectionHeader({ title, count, expanded, onPress, overdue = false }: {
  title: string; count: number; expanded: boolean; onPress: () => void; overdue?: boolean;
}) {
  const colors = useTheme(), scale = useReviewFontScale();
  return <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + count}
    accessibilityState={{ expanded }} onPress={onPress} style={{ paddingHorizontal: 16, minHeight: 48, paddingVertical: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background }}>
    <Text accessibilityRole="header" style={{ color: overdue ? colors.danger : colors.ink, fontSize: 14 * scale, fontWeight: '600', flex: 1 }}>{title}</Text>
    <Text style={{ color: colors.muted, fontSize: typography.supporting * scale }}>{count}</Text><Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
  </Pressable>;
}
export function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName }) {
  const colors = useTheme();
  const foundation = useFoundationStyle();
  if (foundation) return <SettingRow label={label} icon={icon}><Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{checked:value}}
    onPress={() => onChange(!value)} style={{minWidth:56,minHeight:48,alignItems:'center',justifyContent:'center'}}>
    <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Switch accessible={false} value={value}
      thumbColor={value ? colors.accentInk : colors.muted} trackColor={{true:colors.accent,false:colors.border}} /></View>
  </Pressable></SettingRow>;
  return <SettingRow label={label} icon={icon}><Switch accessibilityLabel={label} value={value} onValueChange={onChange}
    hitSlop={10} thumbColor={value ? colors.accentInk : colors.muted} trackColor={{ true: colors.accent, false: colors.border }} /></SettingRow>;
}
export function DateField({ label, value, onChange, timeOnly = false, dateOnly = false, zoneId = deviceZone(), onError, disabled = false }: {
  label: string; value: number; onChange: (value: number) => void; timeOnly?: boolean; dateOnly?: boolean;
  zoneId?: string; onError?: (message: string) => void; disabled?: boolean;
}) {
  const [message, setMessage] = useState('');
  const live = useRef(true), ticket = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const pick = () => {
    if (Platform.OS !== 'android' || disabled) return;
    const current = ++ticket.current;
    setMessage('');
    const fail = () => { if (live.current && current === ticket.current) { const text = 'Could not choose this time. Try again.'; setMessage(text); onError?.(text); } };
    const open = (mode: 'date' | 'time', instant: number, local: string) => {
      DateTimePickerAndroid.open({ value: new Date(instant), timeZoneName: zoneId, mode,
        onError: fail, onValueChange: (event) => {
          void (async () => {
            const selected = pickerCivil(event.nativeEvent.timestamp, event.nativeEvent.utcOffset);
            const resolved = await engine().convertTime({ zoneId, local: mergeCivil(local, selected, mode) });
            if (!live.current || current !== ticket.current) return;
            if (mode === 'date' && !dateOnly) open('time', resolved.instantMs, resolved.local);
            else { onChange(resolved.instantMs); if (resolved.adjustment !== 'none') setMessage(resolved.adjustment === 'gapForward' ? 'Adjusted forward for the clock change.' : 'Uses the earlier time during the clock change.'); }
          })().catch(fail);
        } });
    };
    try { open(timeOnly ? 'time' : 'date', value, civilAt(value, zoneId)); } catch { fail(); }
  };
  return <><SettingRow icon={timeOnly ? 'schedule' : 'event'} label={label} disabled={disabled}
    value={timeOnly ? shortTime(value, zoneId) : dateOnly ? shortDate(value, zoneId) : shortDateTime(value, zoneId)} onPress={pick} />
    {!!message && <ActionFeedback message={message} tone="muted" />}</>;
}
export function AppBar({ title, back = true, onBack, actions, leading }: { title: string; back?: boolean; onBack?: () => void; actions?: ReactNode; leading?: ReactNode }) {
  const colors = useTheme(), scale = useReviewFontScale();
  return <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: back ? 4 : 16,
    backgroundColor: colors.background }}>
    {leading ?? (back && <IconButton icon="arrow_back" label="Back" onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} />)}
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.appBar * scale, fontWeight: '600', flex: 1 }}>{title}</Text>
    {actions}
  </View>;
}
export function Page({ title, subtitle, children, back = true, actions, onBack, footer, leading, scrollKey, scrollReady = true }: PropsWithChildren<{
  title: string; subtitle?: string; back?: boolean; actions?: ReactNode; onBack?: () => void; footer?: ReactNode; leading?: ReactNode; scrollKey?: string; scrollReady?: boolean;
}>) {
  const colors = useTheme();
  const scroll = useRef<ScrollView>(null), restored = useRef(false);
  const contentHeight = useRef(0), viewportHeight = useRef(0);
  const restore = () => {
    if (!scrollKey || !scrollReady || restored.current || !contentHeight.current || !viewportHeight.current) return;
    const saved = readRootSnapshot(scrollKey + ':scroll', 0), available = Math.max(0, contentHeight.current - viewportHeight.current);
    restored.current = true; scroll.current?.scrollTo({ y: Math.min(saved, available), animated: false });
  };
  useEffect(() => {
    if (!scrollKey || !scrollReady || restored.current) return;
    const frame = requestAnimationFrame(() => {
      if (!contentHeight.current || !viewportHeight.current) return;
      const available = Math.max(0, contentHeight.current - viewportHeight.current);
      restored.current = true; scroll.current?.scrollTo({ y: Math.min(readRootSnapshot(scrollKey + ':scroll', 0), available), animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollKey, scrollReady]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <AppBar title={title} back={back} actions={actions} onBack={onBack} leading={leading} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}
        onLayout={(event) => { viewportHeight.current = event.nativeEvent.layout.height; restore(); }}
        onContentSizeChange={(_, height) => { if (scrollReady) { contentHeight.current = height; restore(); } }}
        onScroll={scrollKey ? (event) => { if (restored.current && scrollReady) writeRootSnapshot(scrollKey + ':scroll', event.nativeEvent.contentOffset.y); } : undefined} scrollEventThrottle={32}>
        <View key={scrollReady ? 'ready' : 'loading'} style={{ gap: space.gutter }} onLayout={(event) => {
          if (scrollReady) { contentHeight.current = event.nativeEvent.layout.height + space.gutter + space.xl; restore(); }
        }}>{subtitle && <Copy muted size={14}>{subtitle}</Copy>}{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>{footer}
  </SafeAreaView>;
}
export function Sheet({ title, visible, onClose, onBack, children }: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void; onBack?: () => void }>) {
  const colors = useTheme(), scale = useReviewFontScale();
  const reduced = useReducedMotion(), heading = useRef<Text>(null);
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onBack ?? onClose}
    onShow={() => { if (Platform.OS === 'android' && heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); }}>
    <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: '#00000066' }} />
      </Pressable>
      <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4 }}>
          <Text ref={heading} accessible accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: typography.appBar * scale, fontWeight: '600' }}>{title}</Text>
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
  const colors = useTheme();
  const [selected, setOpen] = useState(initial);
  const open = selected || forceOpen;
  return <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
    style={{ minHeight: 48, flexDirection: 'row', paddingHorizontal: space.xs, alignItems: 'center', gap: space.sm }}>
    <View style={{ flex: 1 }}><Copy>{title}</Copy></View><Icon name={open ? 'expand_less' : 'expand_more'} />
  </Pressable>{open && <View style={{ paddingHorizontal: space.xs, paddingBottom: space.md, gap: space.sm }}>{children}</View>}</View>;
}
export function Status({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const colors = useTheme(), scale = useReviewFontScale();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
    <Icon name={icon ?? (tone === 'success' ? 'check_circle' : tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : 'info')} color={colors[tone]} size={16} />
    <Text style={{ color: colors[tone], fontSize: typography.supporting * scale, flexShrink: 1 }}>{label}</Text>
  </View>;
}
export function Snackbar({ message, action, onAction, onClose, persistent = false }: { message: string; action?: string; onAction?: () => void; onClose: () => void; persistent?: boolean }) {
  const colors = useTheme(), scale = useReviewFontScale();
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (persistent || interacting) return;
    let timer: ReturnType<typeof setTimeout> | undefined, live = true;
    void (async () => {
      const reader = await AccessibilityInfo.isScreenReaderEnabled();
      if (reader || !live) return;
      const duration = Platform.OS === 'android' ? await AccessibilityInfo.getRecommendedTimeoutMillis(action ? 10_000 : 5_000) : action ? 10_000 : 5_000;
      if (live) timer = setTimeout(() => close.current(), duration);
    })().catch(() => {});
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [message, action, persistent, interacting]);
  return <View accessibilityLiveRegion="polite" onTouchStart={() => setInteracting(true)} onTouchEnd={() => setInteracting(false)}
    style={{ margin: 12, paddingLeft: 14, borderRadius: 12, backgroundColor: colors.ink,
    flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={{ color: colors.surface, flex: 1, fontSize: typography.supporting * scale, paddingVertical: space.md }}>{message}</Text>
    {action && <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center' }}>
      <Text style={{ color: colors.surface, fontWeight: '700' }}>{action}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onClose} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" color={colors.surface} size={20} /></Pressable>
  </View>;
}
export function ActionFeedback({ message, tone = 'muted', loading = false }: { message?: string; tone?: Tone; loading?: boolean }) {
  const colors = useTheme();
  if (!message && !loading) return null;
  return <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' }}>
    {loading && <ActivityIndicator color={colors.accent} />}{message && <View style={{ flex: 1 }}><Status label={message} tone={tone} /></View>}
  </View>;
}
export function QueryState({ loading, error, empty = false, emptyMessage = 'Nothing here yet.', onRetry }: {
  loading: boolean; error?: unknown; empty?: boolean; emptyMessage?: string; onRetry?: () => void;
}) {
  if (loading) return <ActionFeedback loading message="Loading…" />;
  if (error) return <View style={{ gap: 8 }}><ActionFeedback tone="danger" message="Could not load this view." />
    {onRetry && <Button label="Retry" variant="secondary" onPress={onRetry} />}</View>;
  return empty ? <View style={{ padding: 16 }}><Copy muted>{emptyMessage}</Copy></View> : null;
}
export function BottomActionBar({ children }: PropsWithChildren) {
  const colors = useTheme();
  return <View style={{ paddingHorizontal: space.gutter, paddingVertical: space.sm, gap: space.sm,
    flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface }}>{children}</View>;
}
export function shortTime(value: number, zoneId?: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: zoneId }); }
export function shortDate(value: number, zoneId?: string) { return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: zoneId }); }
export function shortDateTime(value: number, zoneId?: string) { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zoneId }); }
export function formatTime(value: number | null | undefined, zoneId?: string) {
  return value == null ? 'No alarm scheduled' : new Date(value).toLocaleString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zoneId });
}
export const styles = StyleSheet.create({
  page: { padding: space.gutter, gap: space.gutter, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl },
  card: { padding: space.gutter, borderRadius: shape.group, gap: space.sm },
  button: { paddingHorizontal: space.gutter, paddingVertical: space.md, borderRadius: shape.action, minHeight: 48, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: shape.field, paddingHorizontal: space.md, paddingVertical: 10, fontSize: typography.body, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
