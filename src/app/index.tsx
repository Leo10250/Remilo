import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, PermissionsAndroid, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RemiloAlarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import type { CommandResult, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, quickReminder } from '../domain/quick-reminder';

function Button({ label, action, disabled = false }: { label: string; action: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={action} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export default function HomeScreen() {
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const capabilities = useQuery({ queryKey: ['capabilities'], enabled: !!RemiloAlarm,
    queryFn: () => RemiloAlarm!.getCapabilities() });
  const reminders = useInfiniteQuery({ queryKey: ['reminders'], enabled: !!RemiloAlarm,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => RemiloAlarm!.queryReminders('all', pageParam),
    getNextPageParam: (last) => last.nextCursor });
  const refresh = async () => { await RemiloAlarm?.reconcile(); await client.invalidateQueries(); };
  const run = async (operation: () => Promise<CommandResult>) => {
    if (busy) return;
    setBusy(true);
    try { setFeedback(commandFeedback(await operation())); await client.invalidateQueries(); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'The action failed. Refresh and try again.'); }
    finally { setBusy(false); }
  };
  const delivery = (item: Occurrence, kind: 'Stop' | 'Snooze') => void run(() => RemiloAlarm!.applyCommand({
    kind, occurrenceId: item.id, expectedGeneration: item.generation, operationId: RemiloAlarm!.createOperationId(),
  }));
  const permission = async (kind: 'exact' | 'notifications' | 'fullScreen') => {
    try {
      if (kind === 'notifications') {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) await RemiloAlarm!.openSettings(kind);
      } else await RemiloAlarm!.openSettings(kind);
      await refresh();
    } catch { Alert.alert('Settings unavailable', 'Open Android settings for Remilo to review permissions.'); }
  };
  const caps = capabilities.data;
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>Remilo</Text>
      <Text style={styles.subtitle}>Your reminders, on this device.</Text>
      <Text style={styles.note}>Early alarm test build. Physical delivery and sound verification are pending.</Text>
      {!RemiloAlarm ? <Text style={styles.note}>Install an Android development or release build to use native alarms.</Text> : <>
        <View style={styles.card}>
          <Text style={styles.heading}>Alarm readiness</Text>
          <Text style={styles.body}>Exact alarms: {caps?.exactAlarms ? 'allowed' : 'needs permission'}</Text>
          <Text style={styles.body}>Notifications: {caps?.notifications && caps.channelEnabled ? 'enabled' : 'blocked or unchecked'}</Text>
          <Text style={styles.body}>Lock-screen alarm: {caps?.fullScreen ? 'allowed' : 'not allowed; review presentation settings'}</Text>
          <Text style={styles.note}>Check your alarm volume and sound routing. Registration does not verify audibility.</Text>
          <Button label="Allow exact alarms" action={() => void permission('exact')} />
          <Button label="Allow notifications" action={() => void permission('notifications')} />
          <Button label="Lock-screen permission" action={() => void permission('fullScreen')} />
          <Button label="Test alarm in 15 seconds" disabled={busy} action={() => void run(() => RemiloAlarm!.scheduleTestAlarm())} />
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Create a reminder</Text>
          <TextInput accessibilityLabel="Reminder title" placeholder="What do you want to remember?"
            value={title} onChangeText={setTitle} maxLength={200} style={styles.input} placeholderTextColor="#66746D" />
          <Text style={styles.body}>Alarm in minutes</Text>
          <TextInput accessibilityLabel="Minutes until alarm" value={minutes} onChangeText={setMinutes}
            keyboardType="decimal-pad" style={styles.input} />
          <Button label="Save reminder" disabled={busy} action={() => void run(() =>
            RemiloAlarm!.applyCommand(quickReminder(title, minutes, Date.now(), RemiloAlarm!.createOperationId())))} />
          <Text style={styles.note}>Event and due time default to the alarm time. Stop does not mark it Done.</Text>
        </View>
        {!!feedback && <Text accessibilityLiveRegion="polite" style={styles.note}>{feedback}</Text>}
        <Text style={styles.heading}>Reminders</Text>
        {(reminders.error || capabilities.error) && <Text style={styles.note}>Could not read native state. Refresh to retry.</Text>}
        {reminders.data?.pages.flatMap((page) => page.items).map((item) => <View key={item.id} style={styles.card}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.body}>{item.deliveryState} · unfinished</Text>
          <Text style={styles.body}>{item.nextAlertMs ? new Date(item.nextAlertMs).toLocaleString() : 'Scheduling pending'}</Text>
          {item.deliveryState === 'Alerting' && <Button label="Stop" disabled={busy} action={() => delivery(item, 'Stop')} />}
          <Button label="Snooze 10 minutes" disabled={busy} action={() => delivery(item, 'Snooze')} />
        </View>)}
        {reminders.hasNextPage && <Button label="Show more" action={() => void reminders.fetchNextPage()} />}
        <Button label="Refresh readiness and schedules" action={() => void refresh().catch(() => setFeedback('Refresh failed. Try again.'))} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F0' },
  content: { padding: 24, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 36, fontWeight: '700', color: '#153F32' },
  subtitle: { fontSize: 18, color: '#30483D' },
  card: { borderRadius: 20, padding: 20, backgroundColor: '#FFFFFF', gap: 12 },
  heading: { fontSize: 20, fontWeight: '600', color: '#153F32' },
  body: { fontSize: 16, color: '#30483D' },
  note: { fontSize: 14, color: '#50665A', lineHeight: 21 },
  input: { borderWidth: 1, borderColor: '#BBCABF', borderRadius: 12, padding: 14, fontSize: 16, color: '#153F32' },
  button: { backgroundColor: '#153F32', padding: 14, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
