import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { agendaAlertPresentation, alertPresentation, calendarDate, eventRange, ordinaryDue, recordedCompletionTime, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Icon, IconButton, Status, type IconName } from './components';
import { useReducedMotion } from './motion';
import { useFoundationStyle, useFontScaleOverride, useTheme } from './theme';
import { typography } from './tokens';

export function ReminderRow({ item, onOpen, onDone, onMore, onTrash, busy = false, restore = false, compact = false, glyph = 'event', nowMs, presentation = 'row', showActionDate = false, selection }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; onTrash?: () => void; busy?: boolean; restore?: boolean;
  compact?: boolean; editorial?: boolean; glyph?: IconName; nowMs?: number;
  presentation?: 'row' | 'tile';
  showActionDate?: boolean;
  selection?: { selected: boolean; onToggle: () => void };
}) {
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
  const canSwipe = !selection && !busy && !restore && !item.deleted && (swipeTrash || !!onDone && !item.completed && !item.skipped);
  const begin = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { origin.current = current.current; eligible.current = I18nManager.isRTL ? event.x < width.current - 24 : event.x > 24; }, []);
  const update = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { if (eligible.current) setShift(direction * Math.min(88, Math.max(0, direction * (origin.current + event.translationX)))); }, [direction, setShift]);
  const end = useCallback(() => { if (eligible.current) settle(direction * current.current > 44); }, [direction, settle]);
  const finalize = useCallback((_event: unknown, success: boolean) => { if (!success) settle(revealed); }, [revealed, settle]);
  const pan = Gesture.Pan().enabled(canSwipe).runOnJS(true).activeOffsetX([-12, 12]).failOffsetY([-8, 8])
    // Gesture builder setters only register these callbacks; refs are read later by input events.
    // eslint-disable-next-line react-hooks/refs
    .onBegin(begin).onUpdate(update).onEnd(end).onFinalize(finalize);
  const zone = item.zoneId || deviceZone();
  const status = item.deleted ? 'In Trash. Previously ' + (item.completed ? 'completed' : item.skipped ? 'skipped' : 'unfinished') : stateLabel(item), delivery = alertPresentation(item, false, nowMs), repeat = repeatSummary(item) || (item.segmentId ? 'Repeating reminder' : '');
  const active = !item.completed && !item.skipped && !item.deleted;
  const browsingTime = agendaAlertPresentation(item, nowMs);
  const event = eventRange(item, nowMs);
  const compactEvent = eventRange(item, nowMs, ['Today', 'Tomorrow'].includes(calendarDate(item.eventStartMs, zone, nowMs)));
  const consequence = item.overdue ? 'Overdue — still unfinished' : !ordinaryDue(item) && item.dueAtMs !== item.eventStartMs ? 'Due ' + scheduleDateTime(item.dueAtMs, zone, nowMs) : '';
  const routineDelivery = item.deliveryState === 'Scheduled' && !delivery.changed && item.alarmAtMs === item.eventStartMs;
  const compactDelivery = routineDelivery ? item.mode === 'Notification' ? 'Notification' : item.mode === 'None' ? 'No alert' : 'Alarm' : delivery.label;
  const recordedAt = item.deleted ? item.history?.filter((entry) => entry.kind === 'Delete').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) :
    item.skipped ? item.history?.filter((entry) => entry.kind === 'Skip').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) : recordedCompletionTime(item.history);
  const summary = [item.title, active ? browsingTime : event, item.listName, consequence, repeat, item.exception ? 'Changed occurrence' : '', status,
    !active ? delivery.label : ''].filter(Boolean).join('. ');
  const actionLabel = restore ? 'Restore' : item.completed || item.skipped ? 'Reopen' : 'Done';
  const act = () => { settle(false); onDone?.(); };
  const swipeAct = () => { settle(false); if (swipeTrash) onTrash?.(); else onDone?.(); };
  const terminal = item.completed || item.skipped || item.deleted;
  const titleLineHeight = typography.body * scale * 1.4;
  const renderedLineHeight = titleLineHeight * fontScale;
  // The first title line shares the 48dp control's optical center. Metadata can
  // grow below it without moving the completion control or More down the card.
  const titleInset = terminal || selection ? Math.max(0, (48 - renderedLineHeight) / 2) : 0;
  const controlInset = terminal || selection ? Math.max(0, (renderedLineHeight - 48) / 2) : 0;
  const selectionControl = selection &&
    <Pressable accessibilityRole="checkbox" aria-checked={selection.selected}
      accessibilityLabel={(selection.selected ? 'Deselect ' : 'Select ') + summary}
      accessibilityHint={selection.selected ? 'Remove this reminder from the bulk selection.' : 'Add this reminder to the bulk selection.'}
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
      accessibilityHint={item.completed ? 'Mark unfinished. Past alerts will not be replayed.' : 'Mark completed.'}
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
    <Text style={{ color: colors.ink, fontSize: typography.body * scale, lineHeight: titleLineHeight, fontWeight: '500', flexShrink: 1 }}>{item.title}</Text>
  </View>;
  return <View style={{ backgroundColor: colors.surface, overflow: 'hidden', borderRadius: 16, marginBottom: presentation === 'tile' || !compact ? 12 : 0 }}>
    {canSwipe && <Animated.View style={{position:'absolute',[I18nManager.isRTL?'left':'right']:0,top:0,bottom:0,width:88,opacity:shift.interpolate({inputRange:[-88,-1,0,1,88],outputRange:[1,1,0,1,1],extrapolate:'clamp'})}}><Pressable aria-hidden={!revealed} accessibilityRole="button" accessibilityLabel={(swipeTrash ? 'Move to Trash: ' : 'Done: ') + summary} accessible={revealed} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'yes' : 'no-hide-descendants'} disabled={busy || !revealed} onPress={swipeAct}
      style={{ flex:1,backgroundColor:swipeTrash ? colors.danger : colors.accent,minHeight:48,alignItems:'center',justifyContent:'center',gap:4 }}>
      <Icon name={swipeTrash ? 'delete' : 'check'} color={colors.accentInk} /><Text style={{ color: colors.accentInk, fontSize: typography.supporting * scale }}>{swipeTrash ? 'Trash' : 'Done'}</Text>
    </Pressable></Animated.View>}
    <GestureDetector gesture={pan}><Animated.View onLayout={(event) => { width.current = event.nativeEvent.layout.width; }} style={{ transform: [{ translateX: shift }], flexDirection: 'row', alignItems: terminal ? 'flex-start' : 'center', backgroundColor: colors.surface,
      minHeight: compact ? 72 : 80, paddingVertical: 12, paddingHorizontal: compact ? 4 : 12, gap: compact ? 4 : 8 }}>
      {selectionControl && <View style={{ marginTop: controlInset }}>{selectionControl}</View>}
      {doneControl && <View style={{ marginTop: controlInset }}>{doneControl}</View>}
      <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + summary} accessibilityHint={!selection && onMore ? 'Long press for reminder actions' : undefined}
        disabled={busy} accessibilityState={{ disabled: busy }}
        accessibilityActions={selection ? [] : [...(onMore ? [{ name: 'longpress', label: 'Reminder actions' }] : []), ...(onDone ? [{ name: restore ? 'restore' : terminal ? 'reopen' : 'complete', label: actionLabel }] : [])]}
        onAccessibilityAction={(event) => { if (selection || busy) return; if (['complete', 'reopen', 'restore'].includes(event.nativeEvent.actionName)) act(); else if (event.nativeEvent.actionName === 'longpress') onMore?.(); }}
        onPress={() => { if (revealed) settle(false); else onOpen(); }} onLongPress={busy || selection ? undefined : onMore}
        style={{ flex: 1, gap: 4, minHeight: 48, justifyContent: terminal ? 'flex-start' : 'center', paddingTop: titleInset }}>
        {title}
        {active ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
          <Icon name={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} color={colors.muted} size={16} />
          <Text style={{ color: delivery.changed ? colors.accent : colors.muted, fontSize: typography.supporting * scale, flexShrink: 1 }}>{browsingTime}{item.listName ? ' · ' + item.listName : ''}</Text>
        </View> : compact ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
          <Icon name={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} color={colors.muted} size={16} />
          <Text style={{ color: colors.muted, fontSize: typography.supporting * scale, flexShrink: 1 }}>{compactEvent}</Text>
        </View> : <Text style={{ color: colors.muted, fontSize: typography.supporting * scale }}>{event}{item.listName ? ' · ' + item.listName : ''}</Text>}
        {!!consequence && <Text style={{ color: item.overdue ? colors.warning : colors.muted, fontSize: typography.supporting * scale }}>{consequence}</Text>}
        {!active && (!compact || !routineDelivery || item.mode === 'None') && <Text style={{ color: delivery.changed ? colors.accent : colors.muted, fontSize: typography.supporting * scale }}>{compact ? compactDelivery : delivery.label}</Text>}
        {!!repeat && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="repeat" size={14} />
          <Text style={{ color: colors.muted, fontSize: typography.label * scale, flexShrink: 1 }}>{repeat}{item.exception ? ' · changed occurrence' : ''}</Text></View>}
        {(item.completed || item.skipped || item.deleted) && <Text style={{ color: item.completed && !item.deleted ? colors.success : colors.muted, fontSize: typography.label * scale }}>{item.deleted ? 'In Trash · Previously ' + (item.completed ? 'completed' : item.skipped ? 'skipped' : 'unfinished') : item.skipped ? 'Skipped' : 'Completed'}{showActionDate && recordedAt != null ? ' ' + scheduleDateTime(recordedAt, zone, nowMs) : ''}</Text>}
        {!!status && status !== 'No alert' && !item.completed && !item.skipped && !item.deleted && <Status label={status} tone={stateTone(item)} icon={stateIcon(item)} />}
      </Pressable>
      {!selection && onMore && <View style={{ marginTop: controlInset }}><IconButton icon="more_vert" label={'More actions for ' + item.title} onPress={onMore} disabled={busy} variant={terminal ? 'outlined' : 'standard'} /></View>}
    </Animated.View></GestureDetector>
  </View>;
}
