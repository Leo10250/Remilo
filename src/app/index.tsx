import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { groupTitle } from '../domain/presentation';
import { AppBar, Button, Choice, Copy, Icon, IconButton, SectionHeader, SettingRow, Sheet, Snackbar, Status, Toggle } from '../ui/components';
import { engine, nativeAvailable, useCapabilities, useCommand } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useTheme } from '../ui/theme';

export default function HomeScreen() {
  const colors = useTheme(), client = useQueryClient(), command = useCommand(), capabilities = useCapabilities();
  const [searching, setSearching] = useState(false), [search, setSearch] = useState(''), [listName, setListName] = useState('');
  const [overdue, setOverdue] = useState(false), [filterOpen, setFilterOpen] = useState(false), [menu, setMenu] = useState(false);
  const [completed, setCompleted] = useState(false), [collapsed, setCollapsed] = useState<string[]>([]);
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [toast, setToast] = useState<{ message: string; undoId?: string } | null>(null);
  const [toastHeight, setToastHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const filter = { view: overdue ? 'overdue' as const : 'agenda' as const, search, listName };
  const reminders = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const finished = useInfiniteQuery({ queryKey: ['reminders', 'completed', search, listName], enabled: nativeAvailable && completed,
    initialPageParam: null as string | null, queryFn: ({ pageParam }) => engine().queryReminders({ view: 'completed', search, listName }, pageParam),
    getNextPageParam: (page) => page.nextCursor });
  const items = reminders.data?.pages.flatMap((page) => page.items) ?? [];
  const groups = new Map<string, Occurrence[]>();
  items.forEach((item) => groups.set(item.agendaGroup, [...(groups.get(item.agendaGroup) ?? []), item]));
  const totals = reminders.data?.pages[0];
  const sections = [...groups].map(([key, data]) => ({ key, title: groupTitle(key), count: totals?.groups[key] ?? data.length,
    data: collapsed.includes(key) ? [] : data }));
  const open = (item: Occurrence) => router.push({ pathname: '/reminder/[id]', params: { id: item.id } });
  const complete = async (item: Occurrence) => {
    try { await command.mutateAsync({ kind: item.completed ? 'Reopen' : 'Done', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() });
      setToast({ message: item.completed ? 'Reminder reopened' : 'Reminder completed', undoId: item.completed ? undefined : item.id });
    } catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not update reminder' }); }
  };
  const undo = async (id: string) => { const item = await engine().getOccurrence(id); if (item) await complete(item); };
  const caps = capabilities.data;
  const warning = caps ? !caps.exactAlarms ? 'On-time alarms need permission' : !caps.notifications ? 'Notifications are blocked'
    : !caps.channelEnabled ? 'Alarm notifications are blocked' : !caps.fullScreen ? 'Lock-screen alarms are limited' : '' : '';
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <AppBar title="Remilo" back={false} actions={<>
      <IconButton icon="search" label="Search reminders" onPress={() => { setSearching(!searching); setSearch(''); }} />
      <IconButton icon="filter_list" label="Filter reminders" onPress={() => setFilterOpen(true)} />
      <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      <IconButton icon="more_vert" label="More destinations" onPress={() => setMenu(true)} />
    </>} />
    {searching && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: colors.surface }}>
      <View style={{ paddingLeft: 12 }}><Icon name="search" /></View><TextInput autoFocus accessibilityLabel="Search reminders and notes"
        value={search} onChangeText={setSearch} placeholder="Search reminders" placeholderTextColor={colors.muted}
        style={{ flex: 1, minHeight: 48, padding: 10, color: colors.ink, fontSize: 16 }} />
      <IconButton icon="close" label="Close search" onPress={() => { setSearching(false); setSearch(''); }} />
    </View>}
    {(!!listName || overdue) && <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" onPress={() => { setListName(''); setOverdue(false); }}
      style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
      <Text style={{ color: colors.accent, flex: 1 }}>{[listName, overdue ? 'Overdue only' : ''].filter(Boolean).join(' · ')}</Text><Icon name="close" size={18} />
    </Pressable>}
    {!!warning && <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 48 }}>
      <Status label={warning} tone={!caps?.exactAlarms || !caps?.notifications || !caps?.channelEnabled ? 'danger' : 'warning'} />
    </Pressable>}
    {!!caps?.activeSessionId && <View style={{ marginHorizontal: 16, marginBottom: 8 }}><Button label="Stop all ringing alarms" variant="danger"
      disabled={command.isPending} onPress={() => command.mutate({ kind: 'StopAll', expectedSessionId: caps.activeSessionId, operationId: engine().createOperationId() })} /></View>}
    <SectionList sections={sections} keyExtractor={(item) => item.id} stickySectionHeadersEnabled
      contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled"
      refreshing={reminders.isRefetching} onRefresh={() => { void engine().reconcile(); void client.invalidateQueries(); }}
      onEndReached={() => { if (reminders.hasNextPage && !reminders.isFetchingNextPage) void reminders.fetchNextPage(); }}
      renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} expanded={!collapsed.includes(section.key)} overdue={section.key === 'overdue'}
        onPress={() => setCollapsed((current) => current.includes(section.key) ? current.filter((key) => key !== section.key) : [...current, section.key])}
        />}
      renderItem={({ item }) => <ReminderRow item={item} onOpen={() => open(item)} onDone={() => void complete(item)} onMore={() => setSelected(item)} busy={command.isPending} />}
      ListEmptyComponent={<View style={{ padding: 24, gap: 8 }}><Copy>{!nativeAvailable ? 'Use the Android app to manage reminders.' : reminders.isLoading ? 'Loading reminders…' : reminders.error ? 'Could not load reminders. Pull down to retry.' : search || overdue || listName ? 'No reminders match.' : 'No reminders yet'}</Copy>
        {!search && !overdue && !listName && <Copy muted size={14}>Tap + to add your first reminder.</Copy>}</View>}
      ListFooterComponent={<View>
        {reminders.isFetchingNextPage && <View style={{ padding: 16 }}><Copy muted>Loading more…</Copy></View>}
        <SectionHeader title="Completed" count={totals?.completedCount ?? 0} expanded={completed} onPress={() => setCompleted(!completed)} />
        {completed && <>{finished.isLoading && <Copy muted>Loading completed reminders…</Copy>}
          {finished.error && <Button label="Retry completed reminders" variant="secondary" onPress={() => void finished.refetch()} />}
          {finished.data?.pages.flatMap((page) => page.items).map((item) => <ReminderRow key={item.id} item={item} onOpen={() => open(item)} onDone={() => void complete(item)} />)}
          {finished.hasNextPage && <Button label="More completed reminders" variant="secondary" onPress={() => void finished.fetchNextPage()} />}
          <SettingRow label="View completed and skipped" onPress={() => router.push({ pathname: '/records', params: { view: 'completed' } })} />
        </>}
        {command.error && <View style={{ padding: 16 }}><Status label={command.error.message} tone="danger" /></View>}
      </View>}
    />
    <Pressable accessibilityRole="button" accessibilityLabel="Add reminder" disabled={!nativeAvailable} onPress={() => router.push('/edit')}
      style={({ pressed }) => ({ position: 'absolute', right: 20, bottom: insets.bottom + 16 + (toast ? toastHeight : 0), width: 56, height: 56, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, elevation: 3, opacity: pressed ? 0.8 : 1 })}>
      <Icon name="add" color={colors.accentInk} size={28} />
    </Pressable>
    {toast && <View onLayout={(event) => setToastHeight(event.nativeEvent.layout.height)}><Snackbar message={toast.message} action={toast.undoId ? 'Undo' : undefined}
      onAction={() => { if (toast.undoId) void undo(toast.undoId); setToast(null); }} onClose={() => setToast(null)} /></View>}
    <Sheet title="Filter reminders" visible={filterOpen} onClose={() => setFilterOpen(false)}>
      <Choice label="All lists" selected={!listName} onPress={() => setListName('')} />
      {lists.data?.map((name) => <Choice key={name} label={name} selected={listName === name} onPress={() => setListName(name)} />)}
      <Toggle label="Overdue only" value={overdue} onChange={setOverdue} /><Button label="Show reminders" onPress={() => setFilterOpen(false)} />
    </Sheet>
    <Sheet title="More" visible={menu} onClose={() => setMenu(false)}>
      <SettingRow label="Completed reminders" icon="check_circle" onPress={() => { setMenu(false); router.push({ pathname: '/records', params: { view: 'completed' } }); }} />
      <SettingRow label="Paused repeats" icon="pause" onPress={() => { setMenu(false); router.push('/series'); }} />
      <SettingRow label="Trash" icon="delete" onPress={() => { setMenu(false); router.push({ pathname: '/records', params: { view: 'deleted' } }); }} />
    </Sheet>
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="View reminder" icon="info" onPress={() => { if (selected) open(selected); setSelected(null); }} />
      <SettingRow label="Edit reminder" icon="edit" onPress={() => { if (selected) router.push({ pathname: '/reminder/[id]', params: { id: selected.id, action: 'edit' } }); setSelected(null); }} />
      {selected?.mode !== 'None' && selected?.deliveryState !== 'Paused' && <SettingRow label="Postpone alarm" icon="snooze" onPress={() => { if (selected) router.push({ pathname: '/reminder/[id]', params: { id: selected.id, action: 'postpone' } }); setSelected(null); }} />}
    </Sheet>
  </SafeAreaView>;
}
