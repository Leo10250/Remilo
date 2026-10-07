import { useCallback, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { alertPresentation, calendarDate, eventRange, ordinaryDue, recordedCompletionTime, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Icon, IconButton, Status, type IconName } from './components';
import { useReducedMotion } from './motion';
import { useReviewFontScale, useTheme } from './theme';
import { typography } from './tokens';

export function ReminderRow({ item, onOpen, onDone, onMore, onTrash, busy = false, restore = false, reviewCompact = false, reviewEditorial = false, reviewGlyph = 'event', reviewNow }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; onTrash?: () => void; busy?: boolean; restore?: boolean;
  reviewCompact?: boolean; reviewEditorial?: boolean; reviewGlyph?: IconName; reviewNow?: number;
}) {
  const colors = useTheme(), scale = useReviewFontScale(), reducedMotion = useReducedMotion();
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
  const swipeTrash = !!onTrash && (item.completed || item.skipped);
  const canSwipe = !busy && !restore && !item.deleted && (swipeTrash || !!onDone && !item.completed && !item.skipped);
  const begin = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { origin.current = current.current; eligible.current = I18nManager.isRTL ? event.x < width.current - 24 : event.x > 24; }, []);
  const update = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => { if (eligible.current) setShift(direction * Math.min(88, Math.max(0, direction * (origin.current + event.translationX)))); }, [direction, setShift]);
  const end = useCallback(() => { if (eligible.current) settle(direction * current.current > 44); }, [direction, settle]);
  const finalize = useCallback((_event: unknown, success: boolean) => { if (!success) settle(revealed); }, [revealed, settle]);
  const pan = Gesture.Pan().enabled(canSwipe).runOnJS(true).activeOffsetX([-12, 12]).failOffsetY([-8, 8])
    // Gesture builder setters only register these callbacks; refs are read later by input events.
    // eslint-disable-next-line react-hooks/refs
    .onBegin(begin).onUpdate(update).onEnd(end).onFinalize(finalize);
  const zone = item.zoneId || deviceZone();
  const status = stateLabel(item), delivery = alertPresentation(item, false, reviewNow), repeat = repeatSummary(item);
  const event = eventRange(item, reviewNow);
  const compactEvent = eventRange(item, reviewNow, ['Today', 'Tomorrow'].includes(calendarDate(item.eventStartMs, zone, reviewNow)));
  const consequence = item.overdue ? 'Overdue — still unfinished' : !ordinaryDue(item) && item.dueAtMs !== item.eventStartMs ? 'Due ' + scheduleDateTime(item.dueAtMs, zone, reviewNow) : '';
  const routineDelivery = item.deliveryState === 'Scheduled' && !delivery.changed && item.alarmAtMs === item.eventStartMs;
  const compactDelivery = routineDelivery ? item.mode === 'Notification' ? 'Notification' : item.mode === 'None' ? 'No alert' : 'Alarm' : delivery.label;
  const recordedAt = item.deleted ? item.history?.filter((entry) => entry.kind === 'Delete').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) :
    item.skipped ? item.history?.filter((entry) => entry.kind === 'Skip').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) : recordedCompletionTime(item.history);
  const summary = [item.title, event, item.listName, consequence, repeat, item.exception ? 'Changed occurrence' : '', status,
    delivery.label].filter(Boolean).join('. ');
  const actionLabel = restore ? 'Restore' : item.completed || item.skipped ? 'Reopen' : 'Done';
  const act = () => { settle(false); onDone?.(); };
  const swipeAct = () => { settle(false); if (swipeTrash) onTrash?.(); else onDone?.(); };
  const doneControl = onDone && <Pressable accessibilityRole="button" accessibilityLabel={actionLabel + ': ' + summary} accessibilityState={{ disabled: busy }} disabled={busy} onPress={act}
    style={{ minWidth: 48, ...(reviewCompact ? { width: 48 } : {}), minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
    <Icon name={restore || item.completed || item.skipped ? 'undo' : reviewCompact ? 'radio_button_unchecked' : 'check'} color={colors.accent} />
    {(restore || item.completed || item.skipped) && <Text style={{ color: colors.accent, fontSize: typography.label * scale }}>{actionLabel}</Text>}
  </Pressable>;
  return <View style={{ backgroundColor: swipeTrash ? colors.danger : colors.accent, overflow: 'hidden', borderRadius: reviewEditorial ? 16 : reviewCompact ? 8 : 0 }}>
    {canSwipe && <Pressable aria-hidden={!revealed} accessibilityRole="button" accessibilityLabel={(swipeTrash ? 'Move to Trash: ' : 'Done: ') + summary} accessible={revealed} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'yes' : 'no-hide-descendants'} disabled={busy || !revealed} onPress={swipeAct}
      style={{ position: 'absolute', [I18nManager.isRTL ? 'left' : 'right']: 0, top: 0, bottom: 0, width: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name={swipeTrash ? 'delete' : 'check'} color={colors.accentInk} /><Text style={{ color: colors.accentInk, fontSize: typography.supporting * scale }}>{swipeTrash ? 'Trash' : 'Done'}</Text>
    </Pressable>}
    <GestureDetector gesture={pan}><Animated.View onLayout={(event) => { width.current = event.nativeEvent.layout.width; }} style={{ transform: [{ translateX: shift }], flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      minHeight: reviewCompact ? 72 : 80, paddingVertical: 8, paddingHorizontal: reviewCompact ? 4 : 16, gap: reviewCompact ? 4 : 8, borderBottomWidth: reviewCompact ? 0 : 0.5, borderBottomColor: colors.border }}>
      {reviewCompact && doneControl}
      <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + summary} accessibilityHint={onMore ? 'Long press for reminder actions' : undefined}
        accessibilityActions={[...(onMore ? [{ name: 'longpress', label: 'Reminder actions' }] : []), ...(onDone ? [{ name: 'complete', label: actionLabel }] : [])]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'complete' && !busy) act(); else if (event.nativeEvent.actionName === 'longpress') onMore?.(); }}
        onPress={() => { if (revealed) settle(false); else onOpen(); }} onLongPress={busy ? undefined : onMore}
        style={{ flex: 1, gap: 4, minHeight: 48, justifyContent: 'center' }}>
        {reviewCompact ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <Icon name={reviewGlyph} size={18} color={colors.accent} />
          <Text style={{ color: colors.ink, fontSize: typography.body * scale, lineHeight: reviewEditorial ? typography.body * scale * 1.4 : undefined, fontWeight: '500', flexShrink: 1 }}>{item.title}</Text>
        </View> : <Text style={{ color: colors.ink, fontSize: typography.body * scale, fontWeight: '500' }}>{item.title}</Text>}
        {reviewCompact ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
          <Icon name={item.mode === 'None' ? 'alarm_off' : item.mode === 'Notification' ? 'notifications' : 'alarm'} color={colors.muted} size={16} />
          <Text style={{ color: colors.muted, fontSize: typography.supporting * scale, flexShrink: 1 }}>{compactEvent}</Text>
        </View> : <Text style={{ color: colors.muted, fontSize: typography.supporting * scale }}>{event}{item.listName ? ' · ' + item.listName : ''}</Text>}
        {!!consequence && <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontSize: typography.supporting * scale }}>{consequence}</Text>}
        {(!reviewCompact || !routineDelivery || item.mode === 'None') && <Text style={{ color: delivery.changed ? colors.accent : colors.muted, fontSize: typography.supporting * scale }}>{reviewCompact ? compactDelivery : delivery.label}</Text>}
        {!!repeat && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="repeat" size={14} />
          <Text style={{ color: colors.muted, fontSize: typography.label * scale, flexShrink: 1 }}>{repeat}{item.exception ? ' · changed occurrence' : ''}</Text></View>}
        {(item.completed || item.skipped || item.deleted) && <Text style={{ color: colors.muted, fontSize: typography.label * scale }}>{item.deleted ? 'Moved to Trash' : item.skipped ? 'Skipped' : 'Completed'}{recordedAt != null ? ' ' + scheduleDateTime(recordedAt, zone, reviewNow) : ''}</Text>}
        {!!status && status !== 'No alert' && !item.completed && !item.deleted && <Status label={status} tone={stateTone(item)} icon={stateIcon(item)} />}
      </Pressable>
      {!reviewCompact && doneControl}
      {onMore && <IconButton icon="more_vert" label={'More actions for ' + item.title} onPress={onMore} disabled={busy} />}
    </Animated.View></GestureDetector>
  </View>;
}
