import { Pressable, Text, View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { nextAlertTime, stateLabel } from '../domain/presentation';
import { Icon, IconButton, shortDateTime, shortTime, Status } from './components';
import { useTheme } from './theme';
export function ReminderRow({ item, onOpen, onDone, onMore, busy = false, restore = false }: {
  item: Occurrence; onOpen: () => void; onDone?: () => void; onMore?: () => void; busy?: boolean; restore?: boolean;
}) {
  const colors = useTheme();
  const status = stateLabel(item);
  const next = nextAlertTime(item);
  const changedAlarm = next != null && (next !== item.eventStartMs || next !== item.alarmAtMs);
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, minHeight: 72,
    paddingVertical: 6, paddingLeft: 4, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
    {onDone ? <Pressable accessibilityRole={restore ? 'button' : 'checkbox'} accessibilityState={{ ...(restore ? {} : { checked: item.completed }), disabled: busy }}
      accessibilityLabel={(restore ? 'Restore ' : item.completed ? 'Reopen ' : 'Complete ') + item.title} disabled={busy} onPress={onDone}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={restore ? 'undo' : item.completed ? 'check_circle' : 'radio_button_unchecked'} color={item.completed || restore ? colors.accent : colors.muted} />
    </Pressable> : <View style={{ width: 12 }} />}
    <Pressable accessibilityRole="button" accessibilityLabel={'Open ' + item.title} onPress={onOpen}
      style={{ flex: 1, paddingVertical: 4, gap: 3, minHeight: 48, justifyContent: 'center' }}>
      <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 16, fontWeight: '500', textDecorationLine: item.completed ? 'line-through' : 'none' }}>{item.title}</Text>
      <Text style={{ color: item.overdue ? colors.danger : colors.muted, fontSize: 13 }}>
        {item.allDay ? new Date(item.eventStartMs).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · All day' :
          item.completed || item.deleted || ['overdue', 'earlier', 'completed'].includes(item.agendaGroup) ? shortDateTime(item.eventStartMs) : shortTime(item.eventStartMs)}
        {item.listName ? ' · ' + item.listName : ''}{item.overdue ? ' · Overdue' : ''}
      </Text>
      {changedAlarm && <Text style={{ color: colors.accent, fontSize: 13 }}>Alarm {shortDateTime(next!)}</Text>}
      {!!item.repeatSummary && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="repeat" size={14} /><Text style={{ color: colors.muted, fontSize: 12, flexShrink: 1 }}>{item.repeatSummary}{item.exception ? ' · changed occurrence' : ''}</Text>
      </View>}
      {!!status && status !== 'No alert' && !item.completed && <Status label={status}
        tone={['Blocked', 'Failed'].includes(item.deliveryState) ? 'danger' : item.deliveryState === 'Paused' ? 'muted' : 'warning'} />}
    </Pressable>
    {onMore && <IconButton icon="more_vert" label={'More actions for ' + item.title} onPress={onMore} disabled={busy} />}
  </View>;
}
