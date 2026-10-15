import { chineseTextMetrics, lineHeightFor, fontWeightFor, typography, space, shape } from './tokens';
import { useLocalizedState, useLocale, useTranslation } from '../localization/react';
import { t, ownedMessage, currentLanguage, type LocalizedMessage } from '../localization';
import { useTimeFormatting, useTimeDisplay } from './time-display';

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView, unstable_getMaterialSymbolSourceAsync } from 'expo-symbols';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Children, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren, type ReactNode, type Ref, type RefObject } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PresentationProvider, useAppearanceHold, useAtmosphere, useFoundationStyle, usePresentationState, useFontScaleOverride, useTheme } from './theme';
import { civilAt, deviceZone, mergeCivil, pickerCivil } from '../domain/time';
import { engine } from './native';
import type { Tone } from '../domain/actions';
import { useReducedMotion } from './motion';
import { FormViewport, useRevealInput } from './form-viewport';
import { presentation } from './atmosphere.generated';
import { ScrollChromeProvider, usePageChrome, useScrollChrome } from './scroll-chrome';
import { headerScrimGeometry, headerTransition } from './header-transition';
import { scheduleSnackbarDismiss } from './snackbar-timeout';

type ConnectedCorners = Pick<ViewStyle, 'borderTopLeftRadius' | 'borderTopRightRadius' | 'borderBottomLeftRadius' | 'borderBottomRightRadius'>;
const ConnectedRowContext = createContext<ConnectedCorners | null>(null);

function RowFocus({ corners }: { corners: ConnectedCorners }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  return <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, corners, { borderWidth: 2, borderColor: colors.accent }]} />;
}

export type IconName = 'arrow_back' | 'settings' | 'search' | 'filter_list' | 'add' | 'repeat' | 'more_vert' | 'close' |
  'check' | 'check_circle' | 'radio_button_unchecked' | 'remove_circle_outline' | 'expand_more' | 'expand_less' | 'chevron_right' |
  'alarm' | 'notifications' | 'lock' | 'volume_up' | 'vibration' | 'snooze' | 'schedule' | 'palette' |
  'download' | 'upload' | 'delete' | 'info' | 'warning' | 'error' | 'edit' | 'content_copy' | 'pause' | 'play_arrow' | 'event' | 'folder' | 'notes' | 'undo' | 'refresh' | 'history' | 'stop' |
  'menu' | 'language' | 'checklist' | 'restore' | 'delete_forever' | 'task_alt' | 'cancel' | 'alarm_off' | 'hourglass_empty' | 'block' | 'notification_important' |
  'medication' | 'eco' | 'fitness_center' | 'restaurant' | 'celebration' | 'book' | 'bedtime' | 'home' | 'link_off' | 'open_in_new';
export function Icon({ name, color, size = 24 }: { name: IconName; color?: string; size?: number }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexShrink: 0 }}>
    {Platform.OS === 'android' ? <AndroidSymbol name={name} color={color ?? colors.muted} size={size} /> :
      <SymbolView name={{ android: name, web: name }} size={size} tintColor={color ?? colors.muted}
        style={{ width: size, height: size }} accessible={false} />}</View>;
}
const symbolImages = new Map<string, Promise<ImageSourcePropType | null>>();
const ScenicChrome = createContext(false);
function AndroidSymbol({ name, color, size }: { name: IconName; color: string; size: number }) {
  'use no memo';
  useLocale();
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
export function IconButton({ icon, label, onPress, disabled = false, variant = 'standard', expanded, buttonRef }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; variant?: 'standard' | 'outlined'; expanded?: boolean; buttonRef?: Ref<View> }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  const foundation = useFoundationStyle(), state = usePresentationState(), scenic = useContext(ScenicChrome), [focused, setFocused] = useState(false);
  const c = foundation?.colors;
  return <Pressable ref={buttonRef} accessibilityRole="button" accessibilityLabel={label} aria-expanded={expanded} disabled={disabled} accessibilityState={{ disabled, ...(expanded !== undefined ? { expanded } : {}) }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center',
      borderRadius: 24, backgroundColor: scenic ? pressed ? colors.ink + '20' : 'transparent' : c ? disabled ? c.disabledSurface : pressed || state === 'pressed' ? c.secondaryPressed : 'transparent' : pressed ? colors.soft : 'transparent',
      borderWidth: c ? 2 : variant === 'outlined' ? 1 : 0, borderColor: c && (focused || state === 'focused') ? scenic ? colors.ink : c.focus : variant === 'outlined' && !scenic ? disabled ? c?.disabledInk ?? colors.muted : c?.outline ?? colors.border : 'transparent', opacity: scenic ? disabled ? 0.4 : 1 : c ? 1 : disabled ? 0.4 : 1 })}>
    <Icon name={icon} color={!scenic && c && disabled ? c.disabledInk : colors.ink} />
  </Pressable>;
}
export function Copy({ children, muted = false, size = typography.body, heading = false }: PropsWithChildren<{ muted?: boolean; size?: number; heading?: boolean }>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  return <Text accessibilityRole={heading ? 'header' : undefined} style={{ color: muted ? colors.muted : colors.ink, fontSize: size * scale, lineHeight: lineHeightFor(size, 1.4) * scale, fontWeight: heading ? fontWeightFor(size, '600') : undefined, ...chineseTextMetrics(size, scale, heading ? fontWeightFor(size, '600') : undefined) }}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  'use no memo';
  useLocale();
  const scale = useFontScaleOverride();
  const foundation = useFoundationStyle();
  return <Text accessibilityRole="header" style={{ color: useTheme().ink, fontSize: typography.heading * scale, lineHeight: foundation ? lineHeightFor(typography.heading, 1.4) * scale : undefined, fontWeight: '600', ...chineseTextMetrics(typography.heading, scale, '600') }}>{children}</Text>;
}
export function Button({ label, onPress, disabled = false, variant = 'primary', icon, busy = false, accessibilityLabel, accessibilityHint }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'neutral' | 'danger' | 'outlined'; icon?: IconName; busy?: boolean; accessibilityLabel?: string; accessibilityHint?: string;
}) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  const foundation = useFoundationStyle(), state = usePresentationState(), [focused, setFocused] = useState(false);
  const c = foundation?.colors, blocked = disabled || busy;
  const foreground = c ? blocked ? c.disabledInk : variant === 'primary' ? state === 'pressed' ? c.onPrimaryPressed : c.accentInk : variant === 'danger' ? c.dangerInk : variant === 'secondary' ? c.accent : c.ink : variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.dangerInk : variant === 'secondary' ? colors.accent : colors.ink;
  const button = <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: blocked, busy }} disabled={blocked} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => {
      const active = !blocked && (pressed || state === 'pressed');
      const round = variant === 'danger' || variant === 'outlined';
      const backgroundColor = c && blocked ? c.disabledSurface
        : variant === 'danger' ? active ? colors.dangerPressed : c?.dangerSurface ?? colors.danger
        : variant === 'outlined' ? active ? c?.secondaryPressed ?? colors.soft : 'transparent'
        : c ? variant === 'primary' ? active ? c.primaryPressed : c.accent : active ? c.secondaryPressed : c.soft
        : variant === 'primary' ? colors.accent : colors.soft;
      const borderColor = !blocked && (focused || state === 'focused') ? variant === 'danger' ? foreground : c?.focus ?? colors.accent
        : variant === 'outlined' ? blocked ? c?.disabledInk ?? colors.muted : c?.outline ?? colors.border
        : c && variant === 'secondary' ? blocked ? c.disabledInk : c.accent : 'transparent';
      return [styles.button, { backgroundColor, borderColor,
        borderRadius: round && !active ? shape.roundAction : foundation?.tokens.shape.action ?? shape.action,
        borderWidth: c || round ? 2 : 0,
        flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: c ? 1 : blocked ? 0.45 : pressed && !round ? 0.7 : 1 }];
    }}>
    {(icon || busy) && <View style={{ width: 20, height: 20, flexShrink: 0 }}>{busy ? <ActivityIndicator color={foreground} size={20} /> : icon && <Icon name={icon} color={foreground} size={20} />}</View>}
    <Text style={{ color: foreground, lineHeight: c ? lineHeightFor(typography.body, 1.4) * scale : undefined,
      minWidth: 0, flexShrink: 1, fontSize: typography.body * scale, fontWeight: fontWeightFor(typography.body, '600'), textAlign: 'center', ...chineseTextMetrics(typography.body, scale, fontWeightFor(typography.body, '600')) }}>{label}</Text>
  </Pressable>;
  return button;
}
export function Card({ children }: PropsWithChildren) {
  'use no memo';
  useLocale();
  return <View style={[styles.card, { backgroundColor: useTheme().surface }]}>{children}</View>;
}
export function Field({ label, error, inputRef, compactMultiline = false, required = false, ...props }: TextInputProps & { label: string; error?: string | LocalizedMessage; inputRef?: Ref<TextInput>; compactMultiline?: boolean; required?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions();
  const foundation = useFoundationStyle(), [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const wrapper = useRef<View>(null), reveal = useRevealInput();
  const show = useCallback((entire = false) => wrapper.current?.measureInWindow((_x,top,_width,height) => reveal(top, entire ? top+height : top+Math.min(height,96))),[reveal]);
  useEffect(() => { if (error) { const frame=requestAnimationFrame(()=>show(true)); return () => cancelAnimationFrame(frame); } },[error,show]);
  const onContentSizeChange = props.onContentSizeChange;
  const resize = useCallback<NonNullable<TextInputProps['onContentSizeChange']>>(event => {
    setContentHeight(Math.ceil(event.nativeEvent.contentSize.height) + 2);
    onContentSizeChange?.(event);
  }, [onContentSizeChange]);
  const titleHeight = Math.max(48, Math.min(contentHeight || 48, typography.body * scale * fontScale * 1.4 * 3 + 22));
  return <View ref={wrapper} style={{ gap: space.xs }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
    <Copy muted size={typography.supporting}>{label}</Copy>{required && <Text aria-hidden accessibilityElementsHidden importantForAccessibility="no" style={{ color: colors.muted, fontSize: typography.supporting * scale, ...chineseTextMetrics(typography.supporting, scale) }}>{t('m_4850b174b713')}</Text>}
    </View><TextInput ref={inputRef} accessibilityLabel={required ? label + t('m_815117e98a1c') : label}
    placeholderTextColor={colors.muted} selectionColor={colors.accent} cursorColor={colors.accent} {...props}
    onContentSizeChange={props.multiline && (foundation || compactMultiline) ? resize : props.onContentSizeChange}
    onFocus={event => { setFocused(true); requestAnimationFrame(()=>show()); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, { color: colors.ink,
      borderRadius: foundation?.tokens.shape.field ?? shape.field,
      backgroundColor: colors.surface, borderColor: error ? colors.danger : focused && foundation ? foundation.colors.focus : foundation?.colors.outline ?? colors.muted, minHeight: compactMultiline ? 48 : props.multiline ? Math.max(80, foundation ? contentHeight : 80) : 48,
      ...(compactMultiline ? { height: titleHeight, lineHeight: lineHeightFor(typography.body, 1.4) * scale } : {}),
      fontSize: typography.body * scale, ...chineseTextMetrics(typography.body, scale) }, props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: foundation ? typography.supporting * scale : undefined, lineHeight: foundation ? lineHeightFor(typography.supporting, 1.4) * scale : undefined }}>{ownedMessage(error)}</Text>}</View>;
}
export function SettingRow({ label, value, icon, onPress, children, description, supporting, minHeight = 56, disabled = false, statusLabel, compact = false, prominent = false, accessibilityLabel }: PropsWithChildren<{
  label: string; value?: string; icon?: IconName; description?: string; supporting?: ReactNode; minHeight?: number; onPress?: () => void; disabled?: boolean; statusLabel?: string; compact?: boolean; prominent?: boolean; accessibilityLabel?: string;
}>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  const foundation = useFoundationStyle();
  const corners = useContext(ConnectedRowContext), [focused, setFocused] = useState(false);
  const { fontScale } = useWindowDimensions();
  const stackedStatus = corners !== null && Math.max(scale, fontScale) >= 1.6;
  const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? space.sm : space.md, minHeight,
    paddingVertical: compact ? space.sm : space.md, paddingHorizontal: compact ? space.md : space.gutter }}>
    {icon && <View style={{width:compact?32:40,height:compact?32:40,borderRadius:compact?12:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}><Icon name={icon} size={compact?20:24} /></View>}
    <View style={{ flex: 1, gap: space.xs }}><Copy heading={prominent} size={prominent ? typography.heading : typography.body}>{label}</Copy>{value && <Text style={{color:colors.muted,fontSize:typography.supporting*scale,lineHeight:lineHeightFor(typography.supporting, 1.4) * scale, ...chineseTextMetrics(typography.supporting, scale) }}>{value}</Text>}{!!description && <Copy muted size={typography.supporting}>{description}</Copy>}{supporting}{stackedStatus && children}</View>
    {!stackedStatus && children}{onPress && <Icon name="chevron_right" size={20} />}
  </View>;
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    accessibilityLabel={accessibilityLabel ?? [label, value, statusLabel, description].filter(Boolean).join(', ')} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ ...corners, backgroundColor: foundation && disabled ? foundation.colors.disabledSurface : pressed ? colors.soft : 'transparent', opacity: foundation ? 1 : disabled ? 0.5 : 1 })}>
      {body}{corners && focused && <RowFocus corners={corners} />}
    </Pressable> : body;
}
export function Group({ title, children }: PropsWithChildren<{ title?: string }>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  return <View style={{ gap: space.sm }}>{title && <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.heading * scale, lineHeight:lineHeightFor(typography.heading, 1.4) * scale, fontWeight: fontWeightFor(typography.heading, '600'), ...chineseTextMetrics(typography.heading, scale, fontWeightFor(typography.heading, '600')) }}>{title}</Text>}
    <View style={{ backgroundColor: colors.surface, borderRadius: shape.group, overflow: 'hidden' }}>{children}</View></View>;
}

export function InformationRow({ label, value, supporting, icon, onPress, prominent = false }: { label: string; value: string; supporting?: string; icon: IconName; onPress?: () => void; prominent?: boolean }) {
  'use no memo';
  useLocale();
  const colors = useTheme(), corners = useContext(ConnectedRowContext), [focused, setFocused] = useState(false);
  const body = <View style={{ padding: 16, minHeight: 64, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <View style={{ width: 24, paddingTop: 2 }}><Icon name={icon} /></View>
    <View style={{ flex: 1, gap: 4 }}><Copy muted size={14}>{label}</Copy><Copy size={prominent ? typography.title : typography.body}>{value}</Copy>{supporting && <Copy muted size={14}>{supporting}</Copy>}</View>
    {onPress && <Icon name="chevron_right" size={20} />}
  </View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={[label, value, supporting].filter(Boolean).join(', ')} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ ...corners, backgroundColor: pressed ? colors.soft : undefined })}>
    {body}{corners && focused && <RowFocus corners={corners} />}
  </Pressable> : body;
}

/** Direct, stable-keyed children are units; fragments remain one composite unit. */
export function ConnectedGroup({ title, children, footer }: PropsWithChildren<{ title?: string; footer?: ReactNode }>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  const items = Children.toArray(children);
  return <View style={{ gap: space.sm }}>
    {title && <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.heading * scale, lineHeight: lineHeightFor(typography.heading, 1.4) * scale, fontWeight: '600', ...chineseTextMetrics(typography.heading, scale, '600') }}>{title}</Text>}
    <View style={{ gap: space.connected }}>
      {items.map((item, index) => {
        const corners: ConnectedCorners = {
          borderTopLeftRadius: index === 0 ? shape.group : shape.connectedInner,
          borderTopRightRadius: index === 0 ? shape.group : shape.connectedInner,
          borderBottomLeftRadius: index === items.length - 1 ? shape.group : shape.connectedInner,
          borderBottomRightRadius: index === items.length - 1 ? shape.group : shape.connectedInner,
        };
        return <ConnectedRowContext.Provider key={isValidElement(item) ? item.key : index} value={corners}>
          <View style={{ ...corners, backgroundColor: colors.surface, overflow: 'hidden' }}>{item}</View>
        </ConnectedRowContext.Provider>;
      })}
    </View>
    {footer && <View style={{ paddingHorizontal: space.gutter, gap: space.sm }}>{footer}</View>}
  </View>;
}

/** Supporting content inside a unit keeps the same inset as ordinary rows. */
export function RowSupport({ children }: PropsWithChildren) {
  'use no memo';
  useLocale();
  return <View style={{ paddingHorizontal: space.gutter, paddingBottom: space.md, gap: space.sm }}>{children}</View>;
}
export function SectionHeader({ title, count, expanded, onPress, overdue = false }: {
  title: string; count: number; expanded: boolean; onPress: () => void; overdue?: boolean;
}) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  return <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + count}
    accessibilityState={{ expanded }} onPress={onPress} style={{ paddingHorizontal: 16, minHeight: 48, paddingVertical: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background }}>
    <Text accessibilityRole="header" style={{ color: overdue ? colors.warning : colors.ink, fontSize: typography.heading * scale, fontWeight: '600', flex: 1, ...chineseTextMetrics(typography.heading, scale, '600') }}>{title}</Text>
    <Text style={{ color: colors.muted, fontSize: typography.supporting * scale, ...chineseTextMetrics(typography.supporting, scale) }}>{count}</Text><Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
  </Pressable>;
}
export function Toggle({ label, value, onChange, icon, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName; disabled?: boolean }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  const foundation = useFoundationStyle(), [focused,setFocused]=useState(false);
  const corners = useContext(ConnectedRowContext);
  const disabledInk=foundation?.colors.disabledInk ?? colors.muted;
  return <Pressable disabled={disabled} accessibilityRole="switch" aria-checked={value} accessibilityLabel={label} accessibilityState={{checked:value,disabled}}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onPress={() => onChange(!value)}
    style={({pressed})=>({minHeight:56,paddingVertical:space.md,paddingHorizontal:space.gutter,flexDirection:'row',alignItems:'center',gap:space.md,
      ...(corners ?? { borderRadius: shape.field }), borderWidth:corners?0:2,borderColor:focused?colors.accent:'transparent',
      backgroundColor:corners && foundation && disabled?foundation.colors.disabledSurface:pressed?colors.soft:corners?'transparent':colors.surface})}>
    {icon && <View style={{width:40,height:40,borderRadius:16,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><Icon name={icon}/></View>}
    <View style={{flex:1}}><Copy>{label}</Copy></View>
    <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{width:52,height:32,borderRadius:16,paddingHorizontal:4,alignItems:'center',justifyContent:value?'flex-end':'flex-start',flexDirection:'row',
        backgroundColor:disabled?foundation?.colors.disabledSurface ?? colors.soft:value?colors.accent:colors.soft,borderWidth:value?0:2,borderColor:disabled?disabledInk:colors.border}}>
      <View style={{width:value?24:20,height:value?24:20,borderRadius:12,backgroundColor:disabled?disabledInk:value?colors.accentInk:colors.muted}}/>
    </View>
    {corners && focused && <RowFocus corners={corners} />}
  </Pressable>;
}
export function DateField({ label, value, onChange, timeOnly = false, dateOnly = false, zoneId = deviceZone(), onError, disabled = false, compact = false, accessibilityLabel }: {
  label: string; value: number; onChange: (value: number) => void; timeOnly?: boolean; dateOnly?: boolean;
  zoneId?: string; onError?: (message: string) => void; disabled?: boolean; compact?: boolean; accessibilityLabel?: string;
}) {
  'use no memo';
  const t = useTranslation();
  const { shortTime, shortDateTime } = useTimeFormatting();
  const timeDisplay = useTimeDisplay();
  const connected = useContext(ConnectedRowContext) !== null;
  const [message, setMessage] = useLocalizedState('');
  const [picking, setPicking] = useState(false);
  useAppearanceHold(picking);
  const live = useRef(true), ticket = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const pick = () => {
    if (Platform.OS !== 'android' || disabled) return;
    const current = ++ticket.current;
    setPicking(true);
    setMessage('');
    const fail = () => { if (live.current && current === ticket.current) { setPicking(false); const text = t('m_67a437769493'); setMessage(text); onError?.(text); } };
    const open = (mode: 'date' | 'time', instant: number, local: string) => {
      DateTimePickerAndroid.open({ value: new Date(instant), timeZoneName: zoneId, mode,
        ...(timeDisplay.uses24HourClock == null ? {} : { is24Hour: timeDisplay.uses24HourClock }),
        onError: fail, onDismiss: () => { if(live.current && current===ticket.current) setPicking(false); }, onValueChange: (event) => {
          void (async () => {
            const selected = pickerCivil(event.nativeEvent.timestamp, event.nativeEvent.utcOffset);
            const resolved = await engine().convertTime({ zoneId, local: mergeCivil(local, selected, mode) });
            if (!live.current || current !== ticket.current) return;
            if (mode === 'date' && !dateOnly) open('time', resolved.instantMs, resolved.local);
            else { setPicking(false); onChange(resolved.instantMs); if (resolved.adjustment !== 'none') setMessage(resolved.adjustment === 'gapForward' ? t('m_d242331f3d81') : t('m_9365adde07dc')); }
          })().catch(fail);
        } });
    };
    try { open(timeOnly ? 'time' : 'date', value, civilAt(value, zoneId)); } catch { fail(); }
  };
  const formatted = timeOnly ? shortTime(value, zoneId) : dateOnly ? shortDate(value, zoneId) : shortDateTime(value, zoneId);
  return <><SettingRow icon={timeOnly ? 'schedule' : 'event'} label={label} disabled={disabled} compact={compact}
    value={formatted} accessibilityLabel={accessibilityLabel ? accessibilityLabel + ', ' + formatted : undefined} onPress={pick} />
    {!!message && (connected ? <RowSupport><ActionFeedback message={message} tone="muted" /></RowSupport> : <ActionFeedback message={message} tone="muted" />)}</>;
}
export function AppBar({ title, back = true, onBack, actions, leading, scenic = false, home = false }: { title: string; back?: boolean; onBack?: () => void; actions?: ReactNode; leading?: ReactNode; scenic?: boolean; home?:boolean }) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions();
  const separateActions = !!actions && Math.max(scale, fontScale) >= 1.6;
  return <View style={{ paddingHorizontal: back ? 4 : 16, backgroundColor: scenic ? 'transparent' : colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
      <View>{leading ?? (back && <IconButton icon="arrow_back" label={t('m_76900f1bfd16')} onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} />)}</View>
      <View style={{flex:1}}><Text accessibilityRole="header" style={{ color: colors.ink, fontSize: (home?typography.display:typography.appBar) * scale, lineHeight:(home?typography.display:typography.appBar)*scale*1.3, fontWeight:fontWeightFor(home?typography.display:typography.appBar, home?'700':'600'),backgroundColor:'transparent', ...chineseTextMetrics((home?typography.display:typography.appBar), scale, fontWeightFor(home?typography.display:typography.appBar, home?'700':'600')) }}>{title}</Text></View>
      {!separateActions && <View style={{flexDirection:'row'}}>{actions}</View>}
    </View>
    {separateActions && <View style={{ flexDirection: 'row', justifyContent: 'flex-end', minHeight: 48 }}>{actions}</View>}
  </View>;
}
const scenes = {
  'sunrise-light': require('../../assets/atmospheres/sunrise-light-v1.webp'),
  'sunrise-dark': require('../../assets/atmospheres/sunrise-dark-v1.webp'),
  'sky-light': require('../../assets/atmospheres/sky-light-v1.webp'),
  'sky-dark': require('../../assets/atmospheres/sky-dark-v1.webp'),
  'evening-light': require('../../assets/atmospheres/evening-light-v1.webp'),
  'evening-dark': require('../../assets/atmospheres/evening-dark-v1.webp'),
  'night-light': require('../../assets/atmospheres/night-light-v2.webp'),
  'night-dark': require('../../assets/atmospheres/night-dark-v2.webp'),
};
export function SceneArt({ home = false }: { home?: boolean }) {
  'use no memo';
  useLocale();
  const {scene,brightness}=useAtmosphere(), key=`${scene}-${brightness}` as keyof typeof scenes;
  const [bounds,setBounds]=useState({width:0,height:0}), [failed,setFailed]=useState<string>();
  const focal=home?presentation.pairs[key].heroFocal:presentation.pairs[key].compactFocal;
  const ratio=Math.max(bounds.width/1440,bounds.height/810), width=1440*ratio,height=810*ratio;
  const left=-Math.max(0,Math.min(width-bounds.width,width*focal[0]-bounds.width/2));
  const top=-Math.max(0,Math.min(height-bounds.height,height*focal[1]-bounds.height/2));
  return <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{overflow:'hidden'}]}
    onLayout={event=>setBounds(event.nativeEvent.layout)}>
    {!!bounds.width && failed!==key && <Image accessible={false} source={scenes[key]} onError={()=>setFailed(key)} style={{position:'absolute',width,height,left,top}} />}
  </View>;
}
export function AtmosphericHeader({ title, home = false, subtitle, actions, leading, back = true, onBack }: {
  title: string; home?: boolean; subtitle?: string; actions?: ReactNode; leading?: ReactNode; back?: boolean; onBack?: () => void;
}) {
  'use no memo';
  useLocale();
  const colors=useTheme(), {height,width,fontScale}=useWindowDimensions(), reviewScale=useFontScaleOverride(), [localToolbar,setToolbar]=useState<number>(presentation.geometry.toolbar);
  const [subtitleBounds, setSubtitleBounds] = useState<{ label: string; scale: number; fontScale: number; width: number; height: number }>();
  const chromeState = useScrollChrome(), toolbar = chromeState?.toolbar ?? localToolbar;
  const opening=chromeState?.opening ?? (height<480 || Math.max(fontScale,reviewScale)>=1.6?toolbar:Math.max(presentation.geometry.home,toolbar));
  const decoration=opening-toolbar, decorative=decoration>0;
  const subtitleHeight = !subtitle ? 0 : subtitleBounds?.label === subtitle && subtitleBounds.scale === reviewScale && subtitleBounds.fontScale === fontScale && subtitleBounds.width === width ? subtitleBounds.height : null;
  const scrim = headerScrimGeometry(opening, toolbar, subtitleHeight);
  const opacity = chromeState?.surfaceOpacity ?? (decorative ? headerTransition.minimumOpacity : 1);
  const chrome=<ScenicChrome.Provider value={decorative}><View onLayout={event=>{
    const h=event.nativeEvent.layout.height; if(chromeState)chromeState.measureToolbar(h);else setToolbar(h);
  }} style={{minHeight:56,backgroundColor:decorative?'transparent':colors.background}}>
    <AppBar scenic={decorative} home={home} title={title} back={back} actions={actions} leading={leading} onBack={onBack}/>
  </View></ScenicChrome.Provider>;
  return <View pointerEvents="box-none" style={{height:opening,overflow:'hidden'}}>
    {decorative && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:0,left:0,right:0,height:opening}}><SceneArt home /></View>}
    {decorative && <Animated.View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{position:'absolute',top:0,left:0,right:0,height:scrim.height,opacity}}>
      <LinearGradient colors={[colors.background, colors.background, colors.background + '00']} locations={[0, scrim.plateauEnd, 1]}
        start={{x:0,y:0}} end={{x:0,y:1}} style={StyleSheet.absoluteFill} />
    </Animated.View>}
    {chrome}
    {subtitle && decorative && <View pointerEvents="none" style={{position:'absolute',top:toolbar,left:0,right:0,height:decoration,overflow:'hidden'}}>
      <View style={{marginHorizontal:16,paddingBottom:8}} onLayout={event => {
        const measured = event.nativeEvent.layout.height;
        setSubtitleBounds(previous => previous?.label === subtitle && previous.scale === reviewScale && previous.fontScale === fontScale && previous.width === width && Math.abs(previous.height - measured) < 0.5 ? previous : { label: subtitle, scale: reviewScale, fontScale, width, height: measured });
      }}><Copy>{subtitle}</Copy></View>
    </View>}
  </View>;
}
export function Page({ title, subtitle, children, back = true, actions, onBack, footer, leading, scrollKey, scrollReady = true, scrollResetToken, header, compact = false }: PropsWithChildren<{
  title: string; subtitle?: string; back?: boolean; actions?: ReactNode; onBack?: () => void; footer?: ReactNode; leading?: ReactNode; scrollKey?: string; scrollReady?: boolean; scrollResetToken?: number; header?: ReactNode; compact?: boolean;
}>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), chrome = usePageChrome(scrollKey,compact);
  return <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollChromeProvider value={chrome}><View style={{flex:1}}>
      <View pointerEvents="box-none" style={{position:'absolute',top:0,left:0,right:0,height:chrome.opening}}>
        {header ?? <AtmosphericHeader title={title} back={back} actions={actions} onBack={onBack} leading={leading} />}
      </View>
      <View pointerEvents="box-none" style={{flex:1,paddingTop:chrome.toolbar}}><FormViewport footer={footer} scrollKey={scrollKey} scrollReady={scrollReady} scrollResetToken={scrollResetToken} contentStyle={styles.page}>
        {subtitle && <Copy muted size={14}>{subtitle}</Copy>}{children}
      </FormViewport></View>
    </View></ScrollChromeProvider>
  </SafeAreaView>;
}
export function Sheet({ title, visible, onClose, onBack, children, footer, returnFocusRef, returnFocusWhen }: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void; onBack?: () => void; footer?: ReactNode; returnFocusRef?: RefObject<View | null>; returnFocusWhen?: () => boolean }>) {
  'use no memo';
  const t = useTranslation();
  const inheritedColors = useTheme(), foundation = useFoundationStyle(), scale = useFontScaleOverride();
  // Modals retain React context, including scenic header foreground overrides.
  const colors = foundation?.colors ?? inheritedColors;
  const reduced = useReducedMotion(), heading = useRef<Text>(null);
  const wasVisible = useRef(visible);
  const focusGuard = useRef(returnFocusWhen);
  useEffect(() => { focusGuard.current = returnFocusWhen; }, [returnFocusWhen]);
  useEffect(() => {
    const closed = wasVisible.current && !visible; wasVisible.current = visible;
    if (!closed || !returnFocusRef) return;
    const timer = setTimeout(() => {
      const target = returnFocusRef.current;
      if (target && (focusGuard.current?.() ?? true)) { target.focus(); if (Platform.OS === 'android') AccessibilityInfo.sendAccessibilityEvent(target, 'focus'); }
    }, reduced ? 0 : 350);
    return () => clearTimeout(timer);
  }, [visible, returnFocusRef, reduced]);
  useAppearanceHold(visible);
  return <PresentationProvider colors={colors}><ScenicChrome.Provider value={false}><ConnectedRowContext.Provider value={null}><ScrollChromeProvider value={null}><Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onBack ?? onClose}
    onShow={() => { if (Platform.OS === 'android' && heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel={t('m_48845bff334a')} accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: '#00000066' }} />
      </Pressable>
      <View accessibilityViewIsModal style={{ maxHeight: '88%', flexShrink:1, backgroundColor: colors.surface, borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4 }}>
          <Text ref={heading} accessible accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: typography.appBar * scale, fontWeight: '600', ...chineseTextMetrics(typography.appBar, scale, '600') }}>{title}</Text>
          <IconButton icon="close" label={t('m_79c84b48c2f0') + title} onPress={onClose} />
        </View>
        <FormViewport fill={false} footer={footer} contentStyle={{ padding:16,gap:12 }}>{children}</FormViewport>
      </View>
    </View>
  </Modal></ScrollChromeProvider></ConnectedRowContext.Provider></ScenicChrome.Provider></PresentationProvider>;
}
export function Choice({ label, description, selected, onPress, disabled = false, icon }: { label: string; description?:string; selected: boolean; onPress: () => void; disabled?: boolean; icon?: IconName }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  return <Pressable disabled={disabled} accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected, disabled }} onPress={onPress}
    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,paddingVertical:12 }}>
    <View style={{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:selected?colors.accent:colors.muted,alignItems:'center',justifyContent:'center'}} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {selected && <View style={{width:12,height:12,borderRadius:6,backgroundColor:colors.accent}}/>}
    </View>
    {icon && <Icon name={icon} color={colors.muted} />}
    <View style={{ flex: 1,gap:4 }}><Copy>{label}</Copy>{description && <Copy muted size={typography.supporting}>{description}</Copy>}</View>
  </Pressable>;
}
/** Independent selection; radio Choice remains reserved for one-of-many controls. */
export function CheckRow({ label, description, selected, onPress, disabled = false }: { label: string; description?: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  'use no memo';
  useLocale();
  const colors = useTheme(), corners = useContext(ConnectedRowContext), [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="checkbox" aria-checked={selected} accessibilityLabel={[label, description].filter(Boolean).join(', ')}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ ...corners, minHeight: 56, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.soft : 'transparent' })}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 5, borderWidth: 2,
      borderColor: selected ? colors.accent : colors.muted, backgroundColor: selected ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {selected && <Icon name="check" size={18} color={colors.accentInk} />}
    </View>
    <View style={{ flex: 1, gap: 4 }}><Copy heading size={typography.heading}>{label}</Copy>{description && <Copy muted size={14}>{description}</Copy>}</View>
    {corners && focused && <RowFocus corners={corners} />}
  </Pressable>;
}
export function SelectRow<T extends string | number>({ label, value, choices, onChange, icon }: {
  label: string; value: T; choices: { value: T; label: string }[]; onChange: (value: T) => void; icon?: IconName;
}) {
  'use no memo';
  useLocale();
  const [open, setOpen] = useState(false);
  return <><SettingRow label={label} icon={icon} value={choices.find((choice) => choice.value === value)?.label ?? String(value)} onPress={() => setOpen(true)} />
    <Sheet title={label} visible={open} onClose={() => setOpen(false)}>{choices.map((choice) => <Choice key={choice.value}
      label={choice.label} selected={choice.value === value} onPress={() => { onChange(choice.value); setOpen(false); }} />)}</Sheet></>;
}
export function Disclosure({ title, summary, children, initial = false, forceOpen = false, icon }: PropsWithChildren<{ title: string; summary?: string; initial?: boolean; forceOpen?: boolean; icon?: IconName }>) {
  'use no memo';
  useLocale();
  const colors = useTheme(), corners = useContext(ConnectedRowContext);
  const [selected, setOpen] = useState(initial);
  const [focused, setFocused] = useState(false);
  const open = selected || forceOpen;
  const headerCorners = corners && { ...corners, ...(open ? { borderBottomLeftRadius: shape.connectedInner, borderBottomRightRadius: shape.connectedInner } : {}) };
  return <View style={!corners && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Pressable accessibilityRole="button" aria-expanded={open} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => ({ ...headerCorners, minHeight: corners ? 56 : 48, flexDirection: 'row',
      paddingHorizontal: corners ? space.gutter : space.xs, paddingVertical: corners ? space.md : 0,
      alignItems: 'center', gap: corners ? space.md : space.sm, backgroundColor: pressed ? colors.soft : 'transparent' })}>
    {icon && (corners ? <View style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} /></View> : <Icon name={icon} />)}
    <View style={{ flex: 1, minWidth: 0, paddingVertical: !corners && summary ? space.sm : 0, gap: space.xs }}><Copy>{title}</Copy>{summary && (corners || !open) && <Copy muted size={typography.supporting}>{summary}</Copy>}</View><Icon name={open ? 'expand_less' : 'expand_more'} size={corners ? 20 : 24} />
    {headerCorners && focused && <RowFocus corners={headerCorners} />}
  </Pressable>{open && <View style={{ paddingHorizontal: corners ? space.gutter : space.xs, paddingBottom: space.md, gap: space.sm }}>{children}</View>}</View>;
}
export function Status({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
    <Icon name={icon ?? (tone === 'success' ? 'check_circle' : tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : 'info')} color={colors[tone]} size={16} />
    <Text style={{ color: colors[tone], fontSize: typography.supporting * scale, flexShrink: 1, ...chineseTextMetrics(typography.supporting, scale) }}>{label}</Text>
  </View>;
}
export function Snackbar({ message, action, onAction, onClose, persistent = false, actionDisabled = false }: { message: string | LocalizedMessage; action?: string; onAction?: () => void; onClose: () => void; persistent?: boolean; actionDisabled?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const colors = useTheme(), scale = useFontScaleOverride();
  const c = useFoundationStyle()?.colors;
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (persistent || interacting) return;
    return scheduleSnackbarDismiss(() => close.current(), {
      isScreenReaderEnabled: () => AccessibilityInfo.isScreenReaderEnabled(),
      ...(Platform.OS === 'android' ? { getRecommendedTimeoutMillis: (duration: number) => AccessibilityInfo.getRecommendedTimeoutMillis(duration) } : {}),
    }, action ? 10_000 : 5_000);
  }, [message, action, persistent, interacting]);
  return <View accessibilityLiveRegion="polite" onTouchStart={() => setInteracting(true)} onTouchEnd={() => setInteracting(false)} onTouchCancel={() => setInteracting(false)}
    style={{ margin: 12, paddingLeft: 14, borderRadius: 12, backgroundColor: c?.inverseSurface ?? colors.ink,
    flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Text style={{ color: c?.inverseInk ?? colors.surface, flex: 1, fontSize: typography.supporting * scale, paddingVertical: space.md, ...chineseTextMetrics(typography.supporting, scale) }}>{ownedMessage(message)}</Text>
    {action && <Pressable accessibilityRole="button" disabled={actionDisabled} accessibilityState={{ disabled: actionDisabled }} onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', opacity: actionDisabled ? 0.5 : 1 }}>
      <Text style={{ color: c?.inverseAction ?? colors.surface, fontSize: typography.supporting * scale, fontWeight: '700', ...chineseTextMetrics(typography.supporting, scale, '700') }}>{action}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel={t('m_e8722f00fcd5')} onPress={onClose} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" color={c?.inverseInk ?? colors.surface} size={20} /></Pressable>
  </View>;
}
export function ActionFeedback({ message, tone = 'muted', loading = false }: { message?: string | LocalizedMessage; tone?: Tone; loading?: boolean }) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  if (!message && !loading) return null;
  return <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 14, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' }}>
    {loading && <ActivityIndicator color={colors.accent} />}{message && <View style={{ flex: 1 }}><Status label={ownedMessage(message)} tone={tone} /></View>}
  </View>;
}
export function QueryState({ loading, error, empty = false, emptyMessage = t('m_2de5247a982a'), onRetry }: {
  loading: boolean; error?: unknown; empty?: boolean; emptyMessage?: string; onRetry?: () => void;
}) {
  'use no memo';
  const t = useTranslation();
  if (loading) return <ActionFeedback loading message={t('m_ba3bbbe10d8b')} />;
  if (error) return <View style={{ gap: 8 }}><ActionFeedback tone="danger" message={t('m_45e0434567cb')} />
    {onRetry && <Button label={t('m_942087cc2d41')} variant="secondary" onPress={onRetry} />}</View>;
  return empty ? <View style={{ padding: 16 }}><Copy muted>{emptyMessage}</Copy></View> : null;
}
export function BottomActionBar({ children }: PropsWithChildren) {
  'use no memo';
  useLocale();
  const colors = useTheme();
  return <View style={{ paddingHorizontal: space.gutter, paddingVertical: space.sm, gap: space.sm,
    flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface }}>{children}</View>;
}
export function shortTime(value: number, zoneId?: string) { return new Date(value).toLocaleTimeString(currentLanguage(), { hour: 'numeric', minute: '2-digit', timeZone: zoneId }); }
export function shortDate(value: number, zoneId?: string) { return new Date(value).toLocaleDateString(currentLanguage(), { month: 'short', day: 'numeric', timeZone: zoneId }); }
export function shortDateTime(value: number, zoneId?: string) { return new Date(value).toLocaleString(currentLanguage(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zoneId }); }
export function formatTime(value: number | null | undefined, zoneId?: string) {
  return value == null ? t('m_29605b40c59d') : new Date(value).toLocaleString(currentLanguage(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zoneId });
}
export const styles = StyleSheet.create({
  page: { padding: space.gutter, gap: space.gutter, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: space.xl },
  card: { padding: space.gutter, borderRadius: shape.group, gap: space.sm },
  button: { paddingHorizontal: space.gutter, paddingVertical: space.md, borderRadius: shape.action, minHeight: 56, minWidth: 0, maxWidth: '100%', flexShrink: 1, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: shape.field, paddingHorizontal: space.md, paddingVertical: 10, fontSize: typography.body, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
