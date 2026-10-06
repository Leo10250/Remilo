import { useCallback, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { alertPresentation, eventRange, ordinaryDue, recordedCompletionTime, repeatSummary, scheduleDateTime, stateIcon, stateLabel, stateTone } from '../domain/presentation';
import { deviceZone } from '../domain/time';
import { Icon, IconButton, Status } from './components';
import { useReducedMotion } from './motion';
import { useTheme } from './theme';
import { typography } from './tokens';

export function ReminderRow({ item, onOpen, onDone, onMore, onTrash, busy = false, restore = false }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; onTrash?: () => void; busy?: boolean; restore?: boolean;
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
  const status = stateLabel(item), delivery = alertPresentation(item), repeat = repeatSummary(item);
  const event = eventRange(item);
  const consequence = item.overdue ? 'Overdue — still unfinished' : !ordinaryDue(item) && item.dueAtMs !== item.eventStartMs ? 'Due ' + scheduleDateTime(item.dueAtMs, zone) : '';
  const recordedAt = item.deleted ? item.history?.filter((entry) => entry.kind === 'Delete').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) :
    item.skipped ? item.history?.filter((entry) => entry.kind === 'Skip').reduce<number | null>((latest, entry) => Math.max(latest ?? 0, entry.atMs), null) : recordedCompletionTime(item.history);
  const summary = [item.title, event, item.listName, consequence, repeat, item.exception ? 'Changed occurrence' : '', status,
    delivery.label].filter(Boolean).join('. ');
  const actionLabel = restore ? 'Restore' : item.completed || item.skipped ? 'Reopen' : 'Done';
  const act = () => { settle(false); onDone?.(); };
  const swipeAct = () => { settle(false); if (swipeTrash) onTrash?.(); else onDone?.(); };
  return <View style={{ backgroundColor: swipeTrash ? colors.danger : colors.accent, overflow: 'hidden' }}>
    {canSwipe && <Pressable aria-hidden={!revealed} accessibilityRole="button" accessibilityLabel={(swipeTrash ? 'Move to Trash: ' : 'Done: ') + summary} accessible={revealed} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'yes' : 'no-hide-descendants'} disabled={busy || !revealed} onPress={swipeAct}
      style={{ position: 'absolute', [I18nManager.isRTL ? 'left' : 'right']: 0, top: 0, bottom: 0, width: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Icon name={swipeTrash ? 'delete' : 'check'} color={colors.accentInk} /><Text style={{ color: colors.accentInk, fontSize: typography.supporting }}>{swipeTrash ? 'Trash' : 'Done'}</Text>
    </Pressable>}
    <GestureDetector gesture={pan}><Animated.View onLayout={(event) => { width.current = event.nativeEvent.layout.width; }} style={{ transform: [{ translateX: shift }], flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      minHeight: 80, paddingVertical: 8, paddingHorizontal: 16, gap: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + summary} accessibilityHint={onMore ? 'Long press for reminder actions' : undefined}
        accessibilityActions={[...(onMore ? [{ name: 'longpress', label: 'Reminder actions' }] : []), ...(onDone ? [{ name: 'complete', label: actionLabel }] : [])]}
        onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === 'complete' && !busy) act(); else if (event.nativeEvent.actionName === 'longpress') onMore?.(); }}
        onPress={() => { if (revealed) settle(false); else onOpen(); }} onLongPress={busy ? undefined : onMore}
        style={{ flex: 1, gap: 4, minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: colors.ink, fontSize: typography.body, fontWeight: '500' }}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: typography.supporting }}>{event}{item.listName ? ' · ' + item.listName : ''}</Text>
        {!!consequence && <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontSize: typography.supporting }}>{consequence}</Text>}
        <Text style={{ color: delivery.changed ? colors.accent : colors.muted, fontSize: typography.supporting }}>{delivery.label}</Text>
        {!!repeat && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="repeat" size={14} />
          <Text style={{ color: colors.muted, fontSize: typography.label, flexShrink: 1 }}>{repeat}{item.exception ? ' · changed occurrence' : ''}</Text></View>}
        {(item.completed || item.skipped || item.deleted) && <Text style={{ color: colors.muted, fontSize: typography.label }}>{item.deleted ? 'Moved to Trash' : item.skipped ? 'Skipped' : 'Completed'}{recordedAt != null ? ' ' + scheduleDateTime(recordedAt) : ''}</Text>}
        {!!status && status !== 'No alert' && !item.completed && !item.deleted && <Status label={status} tone={stateTone(item)} icon={stateIcon(item)} />}
      </Pressable>
      {onDone && <Pressable accessibilityRole="button" accessibilityLabel={actionLabel + ': ' + summary} accessibilityState={{ disabled: busy }} disabled={busy} onPress={act}
        style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}>
        <Icon name={restore || item.completed || item.skipped ? 'undo' : 'check'} color={colors.accent} />
        {(restore || item.completed || item.skipped) && <Text style={{ color: colors.accent, fontSize: typography.label }}>{actionLabel}</Text>}
      </Pressable>}
      {onMore && <IconButton icon="more_vert" label={'More actions for ' + item.title} onPress={onMore} disabled={busy} />}
    </Animated.View></GestureDetector>
  </View>;
}
