import { useCallback, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { nextAlertTime, repeatSummary, stateLabel, stateTone } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Icon, shortDate, shortDateTime, shortTime, Status } from './components';
import { useReducedMotion } from './motion';
import { useTheme } from './theme';
import { typography } from './tokens';

export function ReminderRow({ item, onOpen, onDone, onMore, busy = false, restore = false }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; busy?: boolean; restore?: boolean;
}) {
  const colors = useTheme(), reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [shift] = useState(() => new Animated.Value(0));
  const current = useRef(0), origin = useRef(0), eligible = useRef(false), width = useRef(0);
  const direction = I18nManager.isRTL ? 1 : -1;
  const setShift = useCallback((value: number) => { current.current = value; shift.setValue(value); }, [shift]);
  const settle = useCallback((open: boolean) => {
    const value = open ? 88 * direction : 0;
    current.current = value; setRevealed(open);
    if (reducedMotion) shift.setValue(value); else Animated.timing(shift, { toValue: value, duration: 160, useNativeDriver: true }).start();
  }, [direction, reducedMotion, shift]);
  const canSwipe = !!onDone && !busy && !restore && !item.completed && !item.deleted && !item.skipped;
  const begin = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { origin.current = current.current; eligible.current = I18nManager.isRTL ? event.x < width.current - 24 : event.x > 24; }, []);
  const update = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { if (eligible.current) setShift(direction * Math.min(88, Math.max(0, direction * (origin.current + event.translationX)))); }, [direction, setShift]);
  const end = useCallback(() => { if (eligible.current) settle(direction * current.current > 44); }, [direction, settle]);
  const finalize = useCallback((_event: unknown, success: boolean) => { if (!success) settle(revealed); }, [revealed, settle]);
  const pan = Gesture.Pan().enabled(canSwipe).runOnJS(true).activeOffsetX([-12, 12]).failOffsetY([-8, 8])
    // Gesture builder setters only register these callbacks; refs are read later by input events.
    // eslint-disable-next-line react-hooks/refs
    .onBegin(begin).onUpdate(update).onEnd(end).onFinalize(finalize);
  const zone = item.zoneId || deviceZone();
  const status = stateLabel(item), next = nextAlertTime(item), repeat = repeatSummary(item);
  const differentDue = !item.dueLinked || item.dueAtMs !== item.eventStartMs && !item.allDay;
  const event = item.allDay ? shortDate(item.eventStartMs, zone) + ' · All day' : item.completed || item.deleted || ['overdue', 'earlier'].includes(item.agendaGroup)
    ? shortDateTime(item.eventStartMs, zone) : shortTime(item.eventStartMs, zone);
  const nextZone = next === item.alarmAtMs ? zone : deviceZone();
  const changedAlert = next != null && (next !== item.eventStartMs || next !== item.alarmAtMs);
  const consequence = differentDue ? 'Due ' + shortDateTime(item.dueAtMs, zone) + (item.overdue ? ' · Overdue' : '') : item.overdue ? 'Overdue' : '';
  const summary = [item.title, event, item.listName, consequence, repeat, item.exception ? 'Changed occurrence' : '', status,
    changedAlert ? 'Next alert ' + shortDateTime(next!, nextZone) : ''].filter(Boolean).join('. ');
  const actionLabel = restore ? 'Restore' : item.completed ? 'Reopen' : 'Done';
  const act = () => { settle(false); onDone?.(); };
  return <View style={{ backgroundColor: colors.accent, overflow: 'hidden' }}>
    {canSwipe && <Pressable aria-hidden={!revealed} accessibilityRole="button" accessibilityLabel={'Done: ' + summary} accessible={revealed} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'yes' : 'no-hide-descendants'} disabled={busy || !revealed} onPress={act}
      style={{ position: 'absolute', [I18nManager.isRTL ? 'left' : 'right']: 0, top: 0, bottom: 0, width: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name="check" color={colors.accentInk} /><Text style={{ color: colors.accentInk, fontSize: typography.supporting }}>Done</Text>
    </Pressable>}
    <GestureDetector gesture={pan}><Animated.View onLayout={(event) => { width.current = event.nativeEvent.layout.width; }} style={{ transform: [{ translateX: shift }], flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      minHeight: 80, paddingVertical: 8, paddingHorizontal: 16, gap: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + summary} accessibilityHint={onMore ? 'Long press for reminder actions' : undefined}
        accessibilityActions={[...(onMore ? [{ name: 'longpress', label: 'Reminder actions' }] : []), ...(onDone ? [{ name: 'complete', label: actionLabel }] : [])]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'complete' && !busy) act(); else if (event.nativeEvent.actionName === 'longpress') onMore?.(); }}
        onPress={() => { if (revealed) settle(false); else onOpen(); }} onLongPress={busy ? undefined : onMore}
        style={{ flex: 1, gap: 4, minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: colors.ink, fontSize: typography.body, fontWeight: '500', textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: typography.supporting }}>{event}{item.listName ? ' · ' + item.listName : ''}</Text>
        {!!consequence && <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontSize: typography.supporting }}>{consequence}</Text>}
        {changedAlert && <Text style={{ color: colors.accent, fontSize: typography.supporting }}>Next alert {shortDateTime(next!, nextZone)}</Text>}
        {!!repeat && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="repeat" size={14} />
          <Text style={{ color: colors.muted, fontSize: typography.label, flexShrink: 1 }}>{repeat}{item.exception ? ' · changed occurrence' : ''}</Text></View>}
        {item.collectionAtMs != null && <Text style={{ color: colors.muted, fontSize: typography.label }}>{item.deleted ? 'Moved to Trash' : item.skipped ? 'Skipped' : 'Completed'} {shortDateTime(item.collectionAtMs)}</Text>}
        {!!status && status !== 'No alert' && !item.completed && <Status label={status} tone={stateTone(item)} />}
      </Pressable>
      {onDone && <Pressable accessibilityRole="button" accessibilityLabel={actionLabel + ': ' + summary} accessibilityState={{ disabled: busy }} disabled={busy} onPress={act}
        style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
        <Icon name={restore || item.completed ? 'undo' : 'check'} color={colors.accent} />
      </Pressable>}
    </Animated.View></GestureDetector>
  </View>;
}
