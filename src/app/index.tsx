import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { Button, Card, Copy, Field, formatTime, Heading, styles } from '../ui/components';
import { engine, nativeAvailable, useCapabilities, useCommand } from '../ui/native';
import { useTheme } from '../ui/theme';

const views: { id: ReminderFilter['view']; title: string }[] = [
  { id: 'today', title: 'Today' }, { id: 'upcoming', title: 'Upcoming' }, { id: 'attention', title: 'Attention' },
  { id: 'all', title: 'All' }, { id: 'history', title: 'Completed' }, { id: 'deleted', title: 'Deleted' },
];
export default function HomeScreen() {
  const colors = useTheme();
  const client = useQueryClient();
  const [view, setView] = useState<ReminderFilter['view']>('today');
  const [search, setSearch] = useState('');
  const [listName, setListName] = useState('');
  const capabilities = useCapabilities();
  const command = useCommand();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const filter = { view, search, listName };
  const reminders = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const items = reminders.data?.pages.flatMap((page) => page.items) ?? [];
  const ready = capabilities.data?.exactAlarms && capabilities.data.notifications && capabilities.data.channelEnabled;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled" refreshing={reminders.isRefetching}
      onRefresh={() => { void engine().reconcile(); void client.invalidateQueries(); }}
      onEndReached={() => { if (reminders.hasNextPage && !reminders.isFetchingNextPage) void reminders.fetchNextPage(); }}
      ListHeaderComponent={<View style={{ gap: 18, marginBottom: 18 }}>
        <View style={styles.row}><View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 34, fontWeight: '700' }}>Remilo</Text>
          <Copy muted>A little space for what matters.</Copy>
        </View><Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} /></View>
        {!nativeAvailable && <Card><Copy>Open the Android build to save reminders on this device.</Copy></Card>}
        {nativeAvailable && !ready && <Card><Heading>Check alarm readiness</Heading>
          <Copy muted>Saved reminders may need permission before they can ring.</Copy>
          <Button label="Review permissions" variant="secondary" onPress={() => router.push('/readiness')} /></Card>}
        {!!capabilities.data?.activeSessionId && <Button label="Stop all ringing alarms" variant="danger"
          disabled={command.isPending} onPress={() => command.mutate({ kind: 'StopAll',
            expectedSessionId: capabilities.data!.activeSessionId, operationId: engine().createOperationId() })} />}
        <Button label="New reminder" disabled={!nativeAvailable} onPress={() => router.push('/edit')} />
        <Field label="Search reminders and notes" value={search} onChangeText={setSearch} placeholder="Find a reminder" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{views.map((tab) =>
          <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: view === tab.id }}
            onPress={() => setView(tab.id)} style={{ padding: 12, borderRadius: 14,
              backgroundColor: view === tab.id ? colors.accent : colors.soft }}>
            <Text style={{ color: view === tab.id ? colors.accentInk : colors.ink, fontSize: 15 }}>{tab.title}</Text>
          </Pressable>)}</View>
        {!!lists.data?.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['', ...lists.data].map((name) => <Pressable key={name} accessibilityRole="button"
            accessibilityState={{ selected: listName === name }} onPress={() => setListName(name)}
            style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
              backgroundColor: listName === name ? colors.soft : colors.surface }}>
            <Copy size={14}>{name || 'Every list'}</Copy>
          </Pressable>)}
        </View>}
        {command.error && <Copy>{command.error.message}</Copy>}
        {reminders.error && <Copy>Could not load reminders. Pull down to retry.</Copy>}
      </View>}
      ListEmptyComponent={<Card><Heading>{reminders.isLoading ? 'Loading reminders…' : 'Room to breathe'}</Heading>
        <Copy muted>{search ? 'No reminders match your search.' : view === 'attention'
          ? 'Nothing needs your attention here.' : 'Reminders for this view will appear here.'}</Copy></Card>}
      renderItem={({ item }) => <View style={{ marginBottom: 14 }}><Card>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}
          onPress={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })}>
          <Heading>{item.title}</Heading>
          <Copy muted>{item.listName || 'Reminders'} · {item.completed ? 'Done' : item.deliveryState}</Copy>
          <Copy>{item.mode === 'None' ? `Due ${formatTime(item.dueAtMs)}` : `Alert ${formatTime(item.nextAlertMs)}`}</Copy>
          {item.overdue && <Text style={{ color: colors.warning, fontSize: 15 }}>Overdue · unfinished</Text>}
        </Pressable>
        {!item.completed && !item.deleted && <Button label="Mark Done" variant="secondary" disabled={command.isPending}
          onPress={() => command.mutate({ kind: 'Done', occurrenceId: item.id, expectedRevision: item.revision,
            operationId: engine().createOperationId() })} />}
      </Card></View>}
      ListFooterComponent={reminders.isFetchingNextPage ? <Copy muted>Loading more…</Copy> : null}
    />
  </SafeAreaView>;
}
