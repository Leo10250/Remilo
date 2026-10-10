import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SymbolView, unstable_getMaterialSymbolSourceAsync } from 'expo-symbols';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PresentationProvider, useAppearanceHold, useAtmosphere, useFoundationStyle, usePresentationState, useFontScaleOverride, useTheme } from './theme';
import { typography, space, shape } from './tokens';
import { civilAt, deviceZone, mergeCivil, pickerCivil } from '../domain/time';
import { engine } from './native';
import type { Tone } from '../domain/actions';
import { useReducedMotion } from './motion';
import { FormViewport, useRevealInput } from './form-viewport';
import { presentation } from './atmosphere.generated';
import { ScrollChromeProvider, usePageChrome, useScrollChrome } from './scroll-chrome';
import { scheduleSnackbarDismiss } from './snackbar-timeout';

export type IconName = 'arrow_back' | 'settings' | 'search' | 'filter_list' | 'add' | 'repeat' | 'more_vert' | 'close' |
  'check' | 'check_circle' | 'radio_button_unchecked' | 'remove_circle_outline' | 'expand_more' | 'expand_less' | 'chevron_right' |
  'alarm' | 'notifications' | 'lock' | 'volume_up' | 'vibration' | 'snooze' | 'schedule' | 'palette' |
  'download' | 'upload' | 'delete' | 'info' | 'warning' | 'error' | 'edit' | 'content_copy' | 'pause' | 'play_arrow' | 'event' | 'folder' | 'notes' | 'undo' | 'refresh' | 'history' | 'stop' |
  'menu' | 'checklist' | 'restore' | 'delete_forever' | 'task_alt' | 'cancel' | 'alarm_off' | 'hourglass_empty' | 'block' | 'notification_important' |
  'medication' | 'eco' | 'fitness_center' | 'restaurant' | 'celebration' | 'book' | 'bedtime' | 'home';
export function Icon({ name, color, size = 24 }: { name: IconName; color?: string; size?: number }) {
  const colors = useTheme();
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexShrink: 0 }}>
    {Platform.OS === 'android' ? <AndroidSymbol name={name} color={color ?? colors.muted} size={size} /> :
      <SymbolView name={{ android: name, web: name }} size={size} tintColor={color ?? colors.muted}
        style={{ width: size, height: size }} accessible={false} />}</View>;
}
const symbolImages = new Map<string, Promise<ImageSourcePropType | null>>();
const ScenicChrome = createContext(false);
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
export function IconButton({ icon, label, onPress, disabled = false, variant = 'standard' }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; variant?: 'standard' | 'outlined' }) {
  const colors = useTheme();
  const foundation = useFoundationStyle(), state = usePresentationState(), scenic = useContext(ScenicChrome), [focused, setFocused] = useState(false);
  const c = foundation?.colors;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPress={onPress} style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center',
      borderRadius: 24, backgroundColor: scenic ? pressed ? colors.ink + '20' : 'transparent' : c ? disabled ? c.disabledSurface : pressed || state === 'pressed' ? c.secondaryPressed : 'transparent' : pressed ? colors.soft : 'transparent',
      borderWidth: c ? 2 : variant === 'outlined' ? 1 : 0, borderColor: c && (focused || state === 'focused') ? scenic ? colors.ink : c.focus : variant === 'outlined' && !scenic ? disabled ? c?.disabledInk ?? colors.muted : c?.outline ?? colors.border : 'transparent', opacity: scenic ? disabled ? 0.4 : 1 : c ? 1 : disabled ? 0.4 : 1 })}>
    <Icon name={icon} color={!scenic && c && disabled ? c.disabledInk : colors.ink} />
  </Pressable>;
}
export function Copy({ children, muted = false, size = typography.body, heading = false }: PropsWithChildren<{ muted?: boolean; size?: number; heading?: boolean }>) {
  const colors = useTheme(), scale = useFontScaleOverride();
  return <Text accessibilityRole={heading ? 'header' : undefined} style={{ color: muted ? colors.muted : colors.ink, fontSize: size * scale, lineHeight: size * scale * 1.4, fontWeight: heading ? '600' : undefined }}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  const scale = useFontScaleOverride();
  const foundation = useFoundationStyle();
  return <Text accessibilityRole="header" style={{ color: useTheme().ink, fontSize: typography.heading * scale, lineHeight: foundation ? typography.heading * scale * 1.4 : undefined, fontWeight: '600' }}>{children}</Text>;
}
export function Button({ label, onPress, disabled = false, variant = 'primary', icon, busy = false, accessibilityLabel, accessibilityHint }: {
  label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'neutral' | 'danger' | 'outlined'; icon?: IconName; busy?: boolean; accessibilityLabel?: string; accessibilityHint?: string;
}) {
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
    {(icon || busy) && <View style={{ width: 20, height: 20 }}>{busy ? <ActivityIndicator color={foreground} size={20} /> : icon && <Icon name={icon} color={foreground} size={20} />}</View>}
    <Text style={{ color: foreground, lineHeight: c ? typography.body * scale * 1.4 : undefined,
      flexShrink: 1, fontSize: typography.body * scale, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
  return button;
}
export function Card({ children }: PropsWithChildren) {
  return <View style={[styles.card, { backgroundColor: useTheme().surface }]}>{children}</View>;
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = useTheme(), scale = useFontScaleOverride();
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
  return <View ref={wrapper} style={{ gap: space.xs }}><Copy muted size={typography.supporting}>{label}</Copy><TextInput accessibilityLabel={label}
    placeholderTextColor={colors.muted} selectionColor={colors.accent} cursorColor={colors.accent} {...props}
    onContentSizeChange={foundation && props.multiline ? resize : props.onContentSizeChange}
    onFocus={event => { setFocused(true); requestAnimationFrame(()=>show()); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, { color: colors.ink,
      borderRadius: foundation?.tokens.shape.field ?? shape.field,
      backgroundColor: colors.surface, borderColor: error ? colors.danger : focused && foundation ? foundation.colors.focus : foundation?.colors.outline ?? colors.muted, minHeight: props.multiline ? Math.max(80, foundation ? contentHeight : 80) : 48,
      fontSize: typography.body * scale }, props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: foundation ? typography.supporting * scale : undefined, lineHeight: foundation ? typography.supporting * scale * 1.4 : undefined }}>{error}</Text>}</View>;
}
export function SettingRow({ label, value, icon, onPress, children, description, disabled = false, statusLabel }: PropsWithChildren<{
  label: string; value?: string; icon?: IconName; description?: string; onPress?: () => void; disabled?: boolean; statusLabel?: string;
}>) {
  const colors = useTheme(), scale = useFontScaleOverride();
  const foundation = useFoundationStyle();
  const body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.md, paddingHorizontal: space.gutter }}>
    {icon && <View style={{width:40,height:40,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.soft}}><Icon name={icon} /></View>}
    <View style={{ flex: 1, gap: space.xs }}><Copy>{label}</Copy>{value && <Text style={{color:colors.muted,fontSize:typography.supporting*scale,lineHeight:typography.supporting*scale*1.4}}>{value}</Text>}{!!description && <Copy muted size={typography.supporting}>{description}</Copy>}</View>
    {children}{onPress && <Icon name="chevron_right" size={20} />}
  </View>;
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }}
    accessibilityLabel={[label, value, statusLabel, description].filter(Boolean).join(', ')} onPress={onPress}
    style={({ pressed }) => ({ backgroundColor: foundation && disabled ? foundation.colors.disabledSurface : pressed ? colors.soft : 'transparent', opacity: foundation ? 1 : disabled ? 0.5 : 1 })}>{body}</Pressable> : body;
}
export function Group({ title, children }: PropsWithChildren<{ title?: string }>) {
  const colors = useTheme(), scale = useFontScaleOverride();
  return <View style={{ gap: space.sm }}>{title && <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: typography.heading * scale, lineHeight:typography.heading*scale*1.4, fontWeight: '600' }}>{title}</Text>}
    <View style={{ backgroundColor: colors.surface, borderRadius: shape.group, overflow: 'hidden' }}>{children}</View></View>;
}
export function SectionHeader({ title, count, expanded, onPress, overdue = false }: {
  title: string; count: number; expanded: boolean; onPress: () => void; overdue?: boolean;
}) {
  const colors = useTheme(), scale = useFontScaleOverride();
  return <Pressable accessibilityRole="button" accessibilityLabel={title + ', ' + count}
    accessibilityState={{ expanded }} onPress={onPress} style={{ paddingHorizontal: 16, minHeight: 48, paddingVertical: 8,
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.background }}>
    <Text accessibilityRole="header" style={{ color: overdue ? colors.warning : colors.ink, fontSize: typography.heading * scale, fontWeight: '600', flex: 1 }}>{title}</Text>
    <Text style={{ color: colors.muted, fontSize: typography.supporting * scale }}>{count}</Text><Icon name={expanded ? 'expand_less' : 'expand_more'} size={18} />
  </Pressable>;
}
export function Toggle({ label, value, onChange, icon, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; icon?: IconName; disabled?: boolean }) {
  const colors = useTheme();
  const foundation = useFoundationStyle(), [focused,setFocused]=useState(false);
  const disabledInk=foundation?.colors.disabledInk ?? colors.muted;
  return <Pressable disabled={disabled} accessibilityRole="switch" aria-checked={value} accessibilityLabel={label} accessibilityState={{checked:value,disabled}}
    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onPress={() => onChange(!value)}
    style={({pressed})=>({minHeight:56,paddingVertical:12,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:12,borderRadius:16,
      borderWidth:2,borderColor:focused?colors.accent:'transparent',backgroundColor:pressed?colors.soft:colors.surface})}>
    {icon && <View style={{width:40,height:40,borderRadius:16,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><Icon name={icon}/></View>}
    <View style={{flex:1}}><Copy>{label}</Copy></View>
    <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{width:52,height:32,borderRadius:16,paddingHorizontal:4,alignItems:'center',justifyContent:value?'flex-end':'flex-start',flexDirection:'row',
        backgroundColor:disabled?foundation?.colors.disabledSurface ?? colors.soft:value?colors.accent:colors.soft,borderWidth:value?0:2,borderColor:disabled?disabledInk:colors.border}}>
      <View style={{width:value?24:20,height:value?24:20,borderRadius:12,backgroundColor:disabled?disabledInk:value?colors.accentInk:colors.muted}}/>
    </View>
  </Pressable>;
}
export function DateField({ label, value, onChange, timeOnly = false, dateOnly = false, zoneId = deviceZone(), onError, disabled = false }: {
  label: string; value: number; onChange: (value: number) => void; timeOnly?: boolean; dateOnly?: boolean;
  zoneId?: string; onError?: (message: string) => void; disabled?: boolean;
}) {
  const [message, setMessage] = useState('');
  const [picking, setPicking] = useState(false);
  useAppearanceHold(picking);
  const live = useRef(true), ticket = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const pick = () => {
    if (Platform.OS !== 'android' || disabled) return;
    const current = ++ticket.current;
    setPicking(true);
    setMessage('');
    const fail = () => { if (live.current && current === ticket.current) { setPicking(false); const text = 'Could not choose this time. Try again.'; setMessage(text); onError?.(text); } };
    const open = (mode: 'date' | 'time', instant: number, local: string) => {
      DateTimePickerAndroid.open({ value: new Date(instant), timeZoneName: zoneId, mode,
        onError: fail, onDismiss: () => { if(live.current && current===ticket.current) setPicking(false); }, onValueChange: (event) => {
          void (async () => {
            const selected = pickerCivil(event.nativeEvent.timestamp, event.nativeEvent.utcOffset);
            const resolved = await engine().convertTime({ zoneId, local: mergeCivil(local, selected, mode) });
            if (!live.current || current !== ticket.current) return;
            if (mode === 'date' && !dateOnly) open('time', resolved.instantMs, resolved.local);
            else { setPicking(false); onChange(resolved.instantMs); if (resolved.adjustment !== 'none') setMessage(resolved.adjustment === 'gapForward' ? 'Adjusted forward for the clock change.' : 'Uses the earlier time during the clock change.'); }
          })().catch(fail);
        } });
    };
    try { open(timeOnly ? 'time' : 'date', value, civilAt(value, zoneId)); } catch { fail(); }
  };
  return <><SettingRow icon={timeOnly ? 'schedule' : 'event'} label={label} disabled={disabled}
    value={timeOnly ? shortTime(value, zoneId) : dateOnly ? shortDate(value, zoneId) : shortDateTime(value, zoneId)} onPress={pick} />
    {!!message && <ActionFeedback message={message} tone="muted" />}</>;
}
export function AppBar({ title, back = true, onBack, actions, leading, scenic = false, home = false }: { title: string; back?: boolean; onBack?: () => void; actions?: ReactNode; leading?: ReactNode; scenic?: boolean; home?:boolean }) {
  const colors = useTheme(), scale = useFontScaleOverride();
  const { fontScale } = useWindowDimensions();
  const separateActions = !!actions && Math.max(scale, fontScale) >= 1.6;
  return <View style={{ paddingHorizontal: back ? 4 : 16, backgroundColor: scenic ? 'transparent' : colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
      <View>{leading ?? (back && <IconButton icon="arrow_back" label="Back" onPress={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))} />)}</View>
      <View style={{flex:1}}><Text accessibilityRole="header" style={{ color: colors.ink, fontSize: (home?typography.display:typography.appBar) * scale, lineHeight:(home?typography.display:typography.appBar)*scale*1.3, fontWeight:home?'700':'600',backgroundColor:'transparent' }}>{title}</Text></View>
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
  const colors=useTheme(), {scene,brightness}=useAtmosphere(), {height,fontScale}=useWindowDimensions(), reviewScale=useFontScaleOverride(), [localToolbar,setToolbar]=useState<number>(presentation.geometry.toolbar);
  const chromeState = useScrollChrome(), toolbar = chromeState?.toolbar ?? localToolbar;
  const opening=chromeState?.opening ?? (height<480 || Math.max(fontScale,reviewScale)>=1.6?toolbar:Math.max(presentation.geometry.home,toolbar));
  const decoration=opening-toolbar, decorative=decoration>0, scenic=decorative && !chromeState?.folded, header=presentation.header[`${scene}-${brightness}`];
  const chromeHeight=toolbar+(subtitle?24*reviewScale:0), scrimHeight=Math.min(opening,chromeHeight+40);
  const rgb=header.scrim==='#FFFFFF'?'255,255,255':'0,0,0';
  const gradient=`linear-gradient(180deg, rgba(${rgb},${header.scrimAlpha}) 0%, rgba(${rgb},${header.scrimAlpha}) ${chromeHeight/scrimHeight*100}%, rgba(${rgb},0) 100%)`;
  const scrim:ViewStyle=Platform.OS==='web'?{backgroundImage:gradient} as ViewStyle:{experimental_backgroundImage:gradient};
  const chrome=<ScenicChrome.Provider value={scenic}><View onLayout={event=>{
    const h=event.nativeEvent.layout.height; if(chromeState)chromeState.measureToolbar(h);else setToolbar(h);
  }} style={{minHeight:56,backgroundColor:scenic?'transparent':colors.background}}>
    <AppBar scenic={scenic} home={home} title={title} back={back} actions={actions} leading={leading} onBack={onBack}/>
  </View></ScenicChrome.Provider>;
  return <View pointerEvents="box-none" style={{height:opening,overflow:'hidden'}}>
    {decorative && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{position:'absolute',top:0,left:0,right:0,height:opening}}><SceneArt home /></View>}
    {scenic && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{position:'absolute',top:0,left:0,right:0,height:scrimHeight},scrim]}/>}
    {scenic?<PresentationProvider colors={{...colors,ink:header.ink,muted:header.ink}}>{chrome}</PresentationProvider>:chrome}
    {subtitle && scenic && <View pointerEvents="none" style={{position:'absolute',top:toolbar,left:0,right:0,height:decoration,overflow:'hidden'}}>
      <View style={{marginHorizontal:16,marginBottom:8}}><PresentationProvider colors={{...colors,ink:header.ink,muted:header.ink}}><Copy>{subtitle}</Copy></PresentationProvider></View>
    </View>}
  </View>;
}
export function Page({ title, subtitle, children, back = true, actions, onBack, footer, leading, scrollKey, scrollReady = true, header, compact = false }: PropsWithChildren<{
  title: string; subtitle?: string; back?: boolean; actions?: ReactNode; onBack?: () => void; footer?: ReactNode; leading?: ReactNode; scrollKey?: string; scrollReady?: boolean; header?: ReactNode; compact?: boolean;
}>) {
  const colors = useTheme(), chrome = usePageChrome(scrollKey,compact);
  return <SafeAreaView edges={['top','left','right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollChromeProvider value={chrome}><View style={{flex:1}}>
      <View pointerEvents="box-none" style={{position:'absolute',top:0,left:0,right:0,height:chrome.opening}}>
        {header ?? <AtmosphericHeader title={title} back={back} actions={actions} onBack={onBack} leading={leading} />}
      </View>
      <View pointerEvents="box-none" style={{flex:1,paddingTop:chrome.toolbar}}><FormViewport footer={footer} scrollKey={scrollKey} scrollReady={scrollReady} contentStyle={styles.page}>
        {subtitle && <Copy muted size={14}>{subtitle}</Copy>}{children}
      </FormViewport></View>
    </View></ScrollChromeProvider>
  </SafeAreaView>;
}
export function Sheet({ title, visible, onClose, onBack, children, footer }: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void; onBack?: () => void; footer?: ReactNode }>) {
  const colors = useTheme(), scale = useFontScaleOverride();
  const reduced = useReducedMotion(), heading = useRef<Text>(null);
  useAppearanceHold(visible);
  return <ScrollChromeProvider value={null}><Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onBack ?? onClose}
    onShow={() => { if (Platform.OS === 'android' && heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, backgroundColor: '#00000066' }} />
      </Pressable>
      <View accessibilityViewIsModal style={{ maxHeight: '88%', flexShrink:1, backgroundColor: colors.surface, borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 4 }}>
          <Text ref={heading} accessible accessibilityRole="header" style={{ color: colors.ink, flex: 1, fontSize: typography.appBar * scale, fontWeight: '600' }}>{title}</Text>
          <IconButton icon="close" label={'Close ' + title} onPress={onClose} />
        </View>
        <FormViewport fill={false} footer={footer} contentStyle={{ padding:16,gap:12 }}>{children}</FormViewport>
      </View>
    </View>
  </Modal></ScrollChromeProvider>;
}
export function Choice({ label, description, selected, onPress, disabled = false }: { label: string; description?:string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const colors = useTheme();
  return <Pressable disabled={disabled} accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected, disabled }} onPress={onPress}
    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,paddingVertical:12 }}>
    <View style={{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:selected?colors.accent:colors.muted,alignItems:'center',justifyContent:'center'}} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {selected && <View style={{width:12,height:12,borderRadius:6,backgroundColor:colors.accent}}/>}
    </View>
    <View style={{ flex: 1,gap:4 }}><Copy>{label}</Copy>{description && <Copy muted size={typography.supporting}>{description}</Copy>}</View>
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
export function Disclosure({ title, children, initial = false, forceOpen = false, icon }: PropsWithChildren<{ title: string; initial?: boolean; forceOpen?: boolean; icon?: IconName }>) {
  const colors = useTheme();
  const [selected, setOpen] = useState(initial);
  const open = selected || forceOpen;
  return <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
    style={{ minHeight: 48, flexDirection: 'row', paddingHorizontal: space.xs, alignItems: 'center', gap: space.sm }}>
    {icon && <Icon name={icon}/>}<View style={{ flex: 1 }}><Copy>{title}</Copy></View><Icon name={open ? 'expand_less' : 'expand_more'} />
  </Pressable>{open && <View style={{ paddingHorizontal: space.xs, paddingBottom: space.md, gap: space.sm }}>{children}</View>}</View>;
}
export function Status({ label, tone = 'muted', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const colors = useTheme(), scale = useFontScaleOverride();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
    <Icon name={icon ?? (tone === 'success' ? 'check_circle' : tone === 'danger' ? 'error' : tone === 'warning' ? 'warning' : 'info')} color={colors[tone]} size={16} />
    <Text style={{ color: colors[tone], fontSize: typography.supporting * scale, flexShrink: 1 }}>{label}</Text>
  </View>;
}
export function Snackbar({ message, action, onAction, onClose, persistent = false, actionDisabled = false }: { message: string; action?: string; onAction?: () => void; onClose: () => void; persistent?: boolean; actionDisabled?: boolean }) {
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
    <Text style={{ color: c?.inverseInk ?? colors.surface, flex: 1, fontSize: typography.supporting * scale, paddingVertical: space.md }}>{message}</Text>
    {action && <Pressable accessibilityRole="button" disabled={actionDisabled} accessibilityState={{ disabled: actionDisabled }} onPress={onAction} style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', opacity: actionDisabled ? 0.5 : 1 }}>
      <Text style={{ color: c?.inverseAction ?? colors.surface, fontSize: typography.supporting * scale, fontWeight: '700' }}>{action}</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={onClose} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" color={c?.inverseInk ?? colors.surface} size={20} /></Pressable>
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
  button: { paddingHorizontal: space.gutter, paddingVertical: space.md, borderRadius: shape.action, minHeight: 56, justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: shape.field, paddingHorizontal: space.md, paddingVertical: 10, fontSize: typography.body, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
