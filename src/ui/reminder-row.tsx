import { chineseTextMetrics, lineHeightFor, shape, space, typography } from './tokens';
import { useLocale, useTranslation } from '../localization/react';

import { useTimeFormatting } from './time-display';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { ordinaryDue, recordedCompletionTime, repeatSummary, spokenDateTime, type CardContext } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Icon, IconButton, type IconName } from './components';
import { useReducedMotion } from './motion';
import { useFoundationStyle, useFontScaleOverride, useTheme } from './theme';
import { RoutineProgress } from './routine-progress';

function MetadataLine({ label, icon, iconSize = 16, color }: { label: string; icon?: IconName; iconSize?: number; color?: string }) {
  'use no memo';
  useLocale();
  const colors = useTheme(), scale = useFontScaleOverride(), { fontScale } = useWindowDimensions();
  const lineHeight = lineHeightFor(typography.supporting, 1.4) * scale;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
    <View style={{ width: 20, height: lineHeight * fontScale, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon && <Icon name={icon} size={iconSize} color={color ?? colors.muted} />}
    </View>
    <Text style={{ flex: 1, color: color ?? colors.muted, fontSize: typography.supporting * scale, lineHeight, ...chineseTextMetrics(typography.supporting, scale) }}>{label}</Text>
  </View>;
}

export function ReminderRow({ item, onOpen, onDone: suppliedOnDone, onMore, onTrash, busy = false, restore = false, compact = false, glyph = 'event', nowMs, presentation = 'row', showActionDate = false, selection, context, calendarNotice }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; onTrash?: () => void; busy?: boolean; restore?: boolean;
  compact?: boolean; editorial?: boolean; glyph?: IconName; nowMs?: number;
  presentation?: 'row' | 'tile';
  showActionDate?: boolean;
  context?: CardContext;
  calendarNotice?: string;
  selection?: { selected: boolean; onToggle: () => void };
}) {
  'use no memo';
  const t = useTranslation();
  const onDone = item.routine && !restore ? undefined : suppliedOnDone;
  const { alertPresentation, reminderBrowsingPresentation, scheduleDateTime } = useTimeFormatting();
  const colors = useTheme(), scale = useFontScaleOverride(), reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const foundation = useFoundationStyle();
  const [revealed, setRevealed] = useState(false);
  const [actionFocused, setActionFocused] = useState(false);
  const [shift] = useState(() => new Animated.Value(0));
  const current = useRef(0), origin = useRef(0), eligible = useRef(false), width = useRef(0);
  const direction = I18nManager.isRTL ? 1 : -1;
  const setShift = useCallback((value: number) => { current.current = value; shift.setValue(value); }, [shift]);
  const settle = useCallback((open: boolean) => {
    const value = open ? 88 * direction : 0;
    current.current = value; setRevealed(open);
    if (reducedMotion) shift.setValue(value); else Animated.timing(shift, { toValue: value, duration: 160, useNativeDriver: true }).start();
  }, [direction, reducedMotion, shift]);
  const selecting = !!selection;
  useEffect(() => { if (selecting && current.current !== 0) settle(false); }, [selecting, settle]);
  const swipeTrash = !!onTrash && (item.completed || item.skipped);
  const canSwipe = !selection && !busy && !restore && !item.deleted && (swipeTrash || !item.routine && !!onDone && !item.completed && !item.skipped);
  const begin = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { origin.current = current.current; eligible.current = I18nManager.isRTL ? event.x < width.current - 24 : event.x > 24; }, []);
  const update = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { if (eligible.current) setShift(direction * Math.min(88, Math.max(0, direction * (origin.current + event.translationX)))); }, [direction, setShift]);
  const end = useCallback(() => { if (eligible.current) settle(direction * current.current > 44); }, [direction, settle]);
  const finalize = useCallback((_event: unknown, success: boolean) => { if (!success) settle(revealed); }, [revealed, settle]);
  const pan = Gesture.Pan().enabled(canSwipe).runOnJS(true).activeOffsetX([-12, 12]).failOffsetY([-8, 8])
    // Gesture builder setters only register these callbacks; refs are read later by input events.
    // eslint-disable-next-line react-hooks/refs
    .onBegin(begin).onUpdate(update).onEnd(end).onFinalize(finalize);
  const zone = item.zoneId || deviceZone();
  const delivery = alertPresentation(item, false, nowMs), repeat = repeatSummary(item) || (item.segmentId ? t('m_c794c2de4bf4') : '');
  const active = !item.completed && !item.skipped && !item.deleted;
  const browsing = reminderBrowsingPresentation(item, nowMs, context);
  const consequence = !ordinaryDue(item) ? t('m_2d52d03bbb9a') + scheduleDateTime(item.dueAtMs, zone, nowMs) : '';
  const recordedAt = item.deleted ? item.history?.filter((entry) => entry.kind === 'Delete').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) :
    item.skipped ? item.history?.filter((entry) => entry.kind === 'Skip').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) : recordedCompletionTime(item.history);
  const terminalState = (browsing.status?.label ?? '') + (showActionDate && !active && recordedAt != null ? ' ' + scheduleDateTime(recordedAt, zone, nowMs) : '');
  const summary = [item.title, browsing.spokenLabel, showActionDate && !active && recordedAt != null ? browsing.status?.label + ' ' + spokenDateTime(recordedAt, zone) : '',
    item.listName, item.routine ? t('routine_progress', { done: item.routine.completedCount, total: item.routine.totalCount }) : '', !ordinaryDue(item) ? t('m_2d52d03bbb9a') + spokenDateTime(item.dueAtMs, zone) : '', repeat, item.exception ? t('m_57a9b5958b87') : '', calendarNotice].filter(Boolean).join('. ');
  const actionLabel = restore ? t('m_a76e13b98392') : item.completed || item.skipped ? t('m_a886d1dc4f12') : t('m_62aa4b87cc52');
  const act = () => { settle(false); onDone?.(); };
  const swipeAct = () => { settle(false); if (swipeTrash) onTrash?.(); else onDone?.(); };
  const terminal = item.completed || item.skipped || item.deleted;
  const titleLineHeight = lineHeightFor(typography.body, 1.4) * scale;
  const renderedLineHeight = titleLineHeight * fontScale;
  // The first title line shares the 48dp control's optical center. Metadata can
  // grow below it without moving the completion control or More down the card.
  const hasControls = !!(selection || onMore || onDone && !restore && !terminal);
  const titleInset = hasControls ? Math.max(0, (48 - renderedLineHeight) / 2) : 0;
  const controlInset = hasControls ? Math.max(0, (renderedLineHeight - 48) / 2) : 0;
  const selectionControl = selection &&
    <Pressable accessibilityRole="checkbox" aria-checked={selection.selected}
      accessibilityLabel={(selection.selected ? t('m_14c62fd74148') : t('m_1f7133c21072')) + summary}
      accessibilityHint={selection.selected ? t('m_9870b96cf2fd') : t('m_f8d3c252fc67')}
      accessibilityState={{ checked: selection.selected, disabled: busy }} disabled={busy} onPress={selection.onToggle}
      onFocus={() => setActionFocused(true)} onBlur={() => setActionFocused(false)}
      style={({ pressed }) => ({ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
        borderWidth: 2, borderColor: actionFocused ? colors.accent : 'transparent',
        backgroundColor: busy ? foundation?.colors.disabledSurface : pressed ? colors.soft : 'transparent' })}>
      <View style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 2,
        borderColor: busy ? foundation?.colors.disabledInk ?? colors.muted : selection.selected ? colors.accent : colors.muted,
        backgroundColor: selection.selected ? busy ? foundation?.colors.disabledInk ?? colors.muted : colors.accent : 'transparent',
        alignItems: 'center', justifyContent: 'center' }}>
        {selection.selected && <Icon name="check" size={18} color={busy ? foundation?.colors.disabledSurface ?? colors.surface : colors.accentInk} />}
      </View>
    </Pressable>;
  const doneControl = !selection && onDone && !restore && !terminal &&
    <Pressable accessibilityRole="checkbox" aria-checked={item.completed} accessibilityLabel={actionLabel + ': ' + summary}
      accessibilityHint={item.completed ? t('m_fbd97c6162cb') : t('m_0ba387204e8c')}
      accessibilityState={{ checked: item.completed, disabled: busy }} disabled={busy} onPress={act}
      onFocus={() => setActionFocused(true)} onBlur={() => setActionFocused(false)}
      style={({ pressed }) => ({ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24,
        borderWidth: 2, borderColor: actionFocused ? colors.accent : 'transparent',
        backgroundColor: busy ? foundation?.colors.disabledSurface : pressed ? colors.soft : 'transparent' })}>
      {item.completed ? <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: busy ? foundation?.colors.disabledInk ?? colors.muted : colors.accent,
        alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={18} color={busy ? foundation?.colors.disabledSurface ?? colors.surface : colors.accentInk} /></View> :
        <Icon name="radio_button_unchecked" color={busy ? foundation?.colors.disabledInk ?? colors.muted : colors.accent} />}
    </Pressable>;
  const title = <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
    <View style={{ width: 20, height: renderedLineHeight, justifyContent: 'center', flexShrink: 0 }}><Icon name={compact ? glyph : 'event'} size={20} color={colors.muted} /></View>
    <Text style={{ color: colors.ink, fontSize: typography.body * scale, lineHeight: titleLineHeight, fontWeight: '500', flexShrink: 1, ...chineseTextMetrics(typography.body, scale, '500') }}>{item.title}</Text>
  </View>;
  return <View style={{ backgroundColor: colors.surface, overflow: 'hidden', borderRadius: shape.field, marginBottom: presentation === 'tile' || !compact ? space.md : 0 }}>
    {canSwipe && <Animated.View style={{position:'absolute',[I18nManager.isRTL?'left':'right']:0,top:0,bottom:0,width:88,opacity:shift.interpolate({inputRange:[-88,-1,0,1,88],outputRange:[1,1,0,1,1],extrapolate:'clamp'})}}><Pressable aria-hidden={!revealed} accessibilityRole="button" accessibilityLabel={(swipeTrash ? t('m_3b2991f0b418') : t('m_192553fb51fb')) + summary} accessible={revealed} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'yes' : 'no-hide-descendants'} disabled={busy || !revealed} onPress={swipeAct}
      style={{ flex:1,backgroundColor:swipeTrash ? colors.danger : colors.accent,minHeight:48,alignItems:'center',justifyContent:'center',gap:4 }}>
      <Icon name={swipeTrash ? 'delete' : 'check'} color={colors.accentInk} /><Text style={{ alignSelf: 'stretch', paddingHorizontal: 4, textAlign: 'center', color: colors.accentInk, fontSize: typography.supporting * scale, ...chineseTextMetrics(typography.supporting, scale) }}>{swipeTrash ? t('m_c560122ac470') : t('m_62aa4b87cc52')}</Text>
    </Pressable></Animated.View>}
    <GestureDetector gesture={pan}><Animated.View onLayout={(event) => { width.current = event.nativeEvent.layout.width; }} style={{ transform: [{ translateX: shift }], flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface,
      minHeight: compact ? 72 : 80, paddingVertical: space.md, paddingHorizontal: compact ? space.xs : space.md, gap: compact ? space.xs : space.sm }}>
      {selectionControl && <View style={{ marginTop: controlInset }}>{selectionControl}</View>}
      {doneControl && <View style={{ marginTop: controlInset }}>{doneControl}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel={t('m_3b4c6a754231') + summary} accessibilityHint={!selection && onMore ? t('m_6183768276ae') : undefined}
        disabled={busy} accessibilityState={{ disabled: busy }}
        accessibilityActions={selection ? [] : [...(onMore ? [{ name: 'longpress', label: t('m_3ddd2c824c07') }] : []), ...(onDone ? [{ name: restore ? 'restore' : terminal ? 'reopen' : 'complete', label: actionLabel }] : [])]}
        onAccessibilityAction={(event) => { if (selection || busy) return; if (['complete', 'reopen', 'restore'].includes(event.nativeEvent.actionName)) act(); else if (event.nativeEvent.actionName === 'longpress') onMore?.(); }}
        onPress={() => { if (revealed) settle(false); else onOpen(); }} onLongPress={busy || selection ? undefined : onMore}
        style={{ flex: 1, gap: space.xs, minHeight: 48, justifyContent: 'flex-start', paddingTop: titleInset }}>
        {title}
        {browsing.status?.label === 'Ringing' && <MetadataLine icon="alarm" label={t('m_426a858eacbb')} color={colors.accent} />}
        <MetadataLine label={browsing.timing + (item.listName ? ' · ' + item.listName : '')}
          icon={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'}
          color={active && delivery.changed ? colors.accent : colors.muted} />
        {!!calendarNotice && <MetadataLine icon="warning" label={calendarNotice} />}
        {!!item.routine && <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ paddingLeft: 26 }}>
          <RoutineProgress compact accessible={false} done={item.routine.completedCount} total={item.routine.totalCount} />
        </View>}
        {!item.routine && !!consequence && <MetadataLine icon="schedule" label={consequence} />}
        {!!repeat && <MetadataLine icon="repeat" iconSize={14} label={repeat + (item.exception ? t('m_93ae4c694ec5') : '')} />}
        {(!item.routine || terminal) && !!browsing.status && browsing.status.label !== 'Ringing' && <MetadataLine icon={active ? browsing.status.icon : undefined}
          label={active ? browsing.status.label : terminalState} color={colors[browsing.status.tone]} />}
        {!item.routine && !!browsing.warning && <MetadataLine icon="error" label={browsing.warning} color={colors.danger} />}
      </Pressable>
      {!selection && onMore && <View style={{ marginTop: controlInset, width: 48, flexShrink: 0 }}><IconButton icon="more_vert" label={t('m_05d82d5eb6ee') + item.title} onPress={onMore} disabled={busy} variant="standard" /></View>}
    </Animated.View></GestureDetector>
  </View>;
}
