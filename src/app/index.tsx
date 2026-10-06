import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, LayoutAnimation, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, editDestination, reopenCompleted } from '../domain/actions';
import { canAdjustAlert, groupTitle } from '../domain/presentation';
import { ActionFeedback, AppBar, Button, Choice, Copy, Icon, IconButton, QueryState, SectionHeader, SettingRow, Sheet, Snackbar, Status, Toggle } from '../ui/components';
import { dismissNotice, useNotice } from '../ui/feedback';
import { useReducedMotion } from '../ui/motion';
import { engine, nativeAvailable, useCapabilities, useCommand } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useTheme } from '../ui/theme';
import { listOriginParams, readRootSnapshot, rootKey, writeRootSnapshot, type RootDestination } from '../domain/navigation';
import { activateNotice, notifyTrash, switchRoot, useBrowseNavigation } from '../ui/navigation';
import { useRootState } from '../ui/root-state';

type Toast = { message: string; persistent?: boolean; undo?: { id: string; revision: number; operationId: string } };
type AgendaSection = { key: string; title: string; count: number };
export default function HomeScreen() {
  return <AgendaScreen destination={{ kind: 'agenda' }} />;
}
export function AgendaScreen({ destination }: { destination: RootDestination }) {
  const key = rootKey(destination), scoped = destination.kind === 'list';
  const colors = useTheme(), client = useQueryClient(), command = useCommand(), capabilities = useCapabilities();
  const notice = useNotice(), reducedMotion = useReducedMotion();
  const [searching, setSearching] = useRootState(key + ':searching', false), [search, setSearch] = useRootState(key + ':search', '');
  const [listFilter, setListId] = useRootState<string | null | undefined>(key + ':list', undefined);
  const listId = destination.kind === 'list' ? destination.listId : listFilter;
  const [overdue, setOverdue] = useRootState(key + ':overdue', false), [issues, setIssues] = useRootState(key + ':issues', false);
  const [filterOpen, setFilterOpen] = useState(false), [collapsed, setCollapsed] = useRootState<string[]>(key + ':collapsed', []);
  const [selected, setSelected] = useState<Occurrence | null>(null), [toast, setToast] = useState<Toast | null>(null);
  const [toastHeight, setToastHeight] = useState(0);
  const savedScroll = readRootSnapshot(key + ':scroll', 0);
  const list = useRef<SectionList<Occurrence, AgendaSection>>(null), scrollY = useRef(savedScroll), priorScroll = useRef(savedScroll), restoreScroll = useRef(true);
  const insets = useSafeAreaInsets();
  const animate = useCallback(() => { if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); }, [reducedMotion]);
  const closeSearch = useCallback(() => { animate(); Keyboard.dismiss(); restoreScroll.current = true; setSearching(false); setSearch(''); }, [animate, setSearching, setSearch]);
  const navigation = useBrowseNavigation(destination, useCallback(() => { if (searching) { closeSearch(); return true; } return false; }, [searching, closeSearch]));
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const listName = listId === null ? 'No list' : lists.data?.find((item) => item.id === listId)?.name ?? '';
  const missingList = scoped && listId !== null && !!lists.data && !lists.data.some((item) => item.id === listId);
  const title = scoped ? listId === null ? 'No list' : listName || (missingList ? 'List removed' : 'List') : 'Agenda';
  const filter = { view: overdue ? 'overdue' as const : 'agenda' as const, search, ...(listId !== undefined ? { listId } : {}), deliveryIssuesOnly: issues };
  const reminders = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = reminders.data?.pages.flatMap((page) => page.items) ?? [];
  useEffect(() => {
    if (searching || !restoreScroll.current || !reminders.data) return;
    const frame = requestAnimationFrame(() => { list.current?.getScrollResponder()?.scrollTo({ y: priorScroll.current, animated: false }); restoreScroll.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [searching, reminders.data]);
  const groups = new Map<string, Occurrence[]>();
  items.forEach((item) => groups.set(item.agendaGroup, [...(groups.get(item.agendaGroup) ?? []), item]));
  const totals = reminders.data?.pages[0];
  const sections = [...groups].map(([key, data]) => ({ key, title: groupTitle(key), count: totals?.groups[key] ?? data.length,
    data: collapsed.includes(key) ? [] : data }));
  const open = (item: Occurrence) => router.push({ pathname: '/reminder/[id]', params: { id: item.id } });
  const complete = async (item: Occurrence) => {
    if (notice) dismissNotice(notice.id);
    setToast(null); animate();
    try {
      const result = await command.mutateAsync({ kind: 'Done', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() });
      setToast({ message: 'Reminder completed', undo: { id: item.id, revision: result.occurrence?.revision ?? item.revision + 1, operationId: engine().createOperationId() } });
    } catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not complete reminder', persistent: true }); }
  };
  const undo = async (captured: NonNullable<Toast['undo']>) => {
    try {
      const item = await engine().getOccurrence(captured.id);
      const reversal = reopenCompleted(item, captured.revision, captured.operationId);
      if (!reversal) { setToast({ message: item && !item.completed ? 'Reminder is already open' : 'Reminder changed; this completion can no longer be undone', persistent: !!item?.completed }); return; }
      animate(); const result = await command.mutateAsync(reversal); const feedback = commandFeedback(result, 'Reminder reopened');
      setToast({ message: feedback.message, persistent: feedback.tone !== 'success' });
    } catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not undo. Try again.', undo: captured, persistent: true }); }
  };
  const deleteItem = (item: Occurrence) => {
    if (notice) dismissNotice(notice.id); setToast(null); void command.mutateAsync({ kind: 'Delete', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() })
      .then((result) => notifyTrash(item, result)).catch((error: Error) => setToast({ message: error.message, persistent: true }));
  };
  const trash = (item: Occurrence) => {
    if (item.completed || item.skipped) { deleteItem(item); return; }
    Alert.alert(item.segmentId ? 'Move this occurrence to Trash?' : 'Move reminder to Trash?', 'This cancels its alert. You can restore it from Trash.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Move to Trash', style: 'destructive', onPress: () => deleteItem(item) },
    ]);
  };
  const caps = capabilities.data;
  const warning = caps ? !caps.exactAlarms ? 'On-time alarms need permission' : !caps.notifications ? 'Notifications are blocked'
    : !caps.channelEnabled ? 'Alarm notifications are blocked' : !caps.fullScreen ? 'Lock-screen alarms are limited' : '' : '';
  const activeToast = toast ?? (notice ? { message: notice.message, persistent: notice.persistent } : null);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <AppBar title={title} back={false} leading={navigation.leading} actions={<>
      <IconButton icon="search" label={searching ? 'Exit search' : 'Search reminders'} onPress={() => { if (searching) closeSearch(); else { priorScroll.current = scrollY.current; animate(); setSearching(true); } }} />
      <IconButton icon="filter_list" label="Filter reminders" onPress={() => setFilterOpen(true)} />
    </>} />
    {searching && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: colors.surface }}>
      <IconButton icon="arrow_back" label="Exit search" onPress={closeSearch} />
      <TextInput autoFocus accessibilityLabel="Search reminders and notes" value={search} onChangeText={setSearch} placeholder="Search reminders"
        placeholderTextColor={colors.muted} style={{ flex: 1, minHeight: 48, padding: 8, color: colors.ink, fontSize: 16 }} />
      {!!search && <IconButton icon="close" label="Clear query" onPress={() => setSearch('')} />}
    </View>}
    {((!scoped && listId !== undefined) || overdue || issues) && <Pressable accessibilityRole="button" accessibilityLabel="Clear filters" onPress={() => { setListId(undefined); setOverdue(false); setIssues(false); }}
      style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
      <Text style={{ color: colors.accent, flex: 1, fontSize: 14 }}>{[!scoped ? listName : '', overdue ? 'Overdue only' : '', issues ? 'Alert problems only' : ''].filter(Boolean).join(' · ')}</Text><Icon name="close" size={18} />
    </Pressable>}
    {missingList && <View style={{ padding: 16, gap: 8 }}><Copy>This list was removed. Its reminders are in No list.</Copy><Button label="Open No list" onPress={() => switchRoot({ kind: 'list', listId: null })} /></View>}
    {!!warning && <Pressable accessibilityRole="button" accessibilityLabel={warning + '. Open Settings'} onPress={() => router.push('/settings')}
      style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 48 }}><Status label={warning} tone={!caps?.exactAlarms || !caps?.notifications || !caps?.channelEnabled ? 'danger' : 'warning'} /></Pressable>}
    {!!caps?.activeSessionId && <View style={{ marginHorizontal: 16, marginBottom: 8 }}><Button label="Stop all ringing alarms" variant="secondary" disabled={command.isPending}
      onPress={() => { if (notice) dismissNotice(notice.id); setToast(null); void command.mutateAsync({ kind: 'StopAll', expectedSessionId: caps.activeSessionId, operationId: engine().createOperationId() })
        .then(() => setToast({ message: 'Ringing stopped' })).catch((error: Error) => setToast({ message: error.message, persistent: true })); }} /></View>}
    {!!reminders.error && !!items.length && <QueryState loading={false} error={reminders.error} onRetry={() => void reminders.refetch()} />}
    <SectionList<Occurrence, AgendaSection> ref={list} sections={sections} keyExtractor={(item) => item.id} stickySectionHeadersEnabled contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={scoped && !missingList ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginBottom: 8 }}>
        <Button label="Completed in this list" variant="secondary" onPress={() => router.push({ pathname: '/records', params: { view: 'completed', ...listOriginParams(destination.kind === 'list' ? destination.listId : null) } })} />
        <Button label="Trash in this list" variant="secondary" onPress={() => router.push({ pathname: '/records', params: { view: 'deleted', ...listOriginParams(destination.kind === 'list' ? destination.listId : null) } })} />
      </View> : null}
      onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; if (!searching && !restoreScroll.current) writeRootSnapshot(key + ':scroll', scrollY.current); }} scrollEventThrottle={32}
      refreshing={reminders.isRefetching} onRefresh={() => { void engine().reconcile().then(() => client.invalidateQueries()).catch((error: Error) => setToast({ message: error.message, persistent: true })); }}
      onEndReached={() => { if (reminders.hasNextPage && !reminders.isFetchingNextPage) void reminders.fetchNextPage(); }}
      renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} expanded={!collapsed.includes(section.key)} overdue={section.key === 'overdue'}
        onPress={() => { animate(); setCollapsed((current) => current.includes(section.key) ? current.filter((key) => key !== section.key) : [...current, section.key]); }} />}
      renderItem={({ item }) => <ReminderRow item={item} onOpen={() => open(item)} onDone={() => void complete(item)} onMore={() => setSelected(item)} busy={command.isPending} />}
      ListEmptyComponent={<View style={{ padding: 16, gap: 8 }}><QueryState loading={reminders.isLoading && nativeAvailable} error={reminders.error} empty
        emptyMessage={!nativeAvailable ? 'Use the Android app to manage reminders.' : search || overdue || issues || (!scoped && listId !== undefined) ? 'No reminders match.' : 'No reminders yet'} onRetry={() => void reminders.refetch()} />
        {nativeAvailable && !reminders.isLoading && !reminders.error && !search && !overdue && !issues && !missingList && <Copy muted size={14}>Tap + to add a reminder.</Copy>}</View>}
      ListFooterComponent={reminders.isFetchingNextPage ? <ActionFeedback loading message="Loading more…" /> : null} />
    <Pressable accessibilityRole="button" accessibilityLabel="Add reminder" disabled={!nativeAvailable || missingList} onPress={() => router.push(destination.kind === 'list' ? { pathname: '/edit', params: listOriginParams(destination.listId) } : '/edit')}
      style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: insets.bottom + 16 + (activeToast ? toastHeight : 0), width: 56, height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, elevation: 3, opacity: pressed ? 0.8 : 1 })}><Icon name="add" color={colors.accentInk} size={28} /></Pressable>
    {activeToast && <View onLayout={(event) => setToastHeight(event.nativeEvent.layout.height)}><Snackbar message={activeToast.message} persistent={activeToast.persistent}
      action={toast?.undo ? 'Undo' : !toast ? notice?.action?.label : undefined}
      onAction={() => { if (toast?.undo) void undo(toast.undo); else if (notice?.action) void activateNotice(notice).finally(() => { void client.invalidateQueries(); }); }} onClose={() => { if (toast) setToast(null); else if (notice) dismissNotice(notice.id); }} /></View>}
    <Sheet title="Filter reminders" visible={filterOpen} onClose={() => setFilterOpen(false)}>
      <QueryState loading={lists.isLoading && nativeAvailable} error={lists.error} onRetry={() => void lists.refetch()} />
      {!scoped && <><Choice label="All lists" selected={listId === undefined} onPress={() => setListId(undefined)} />
        <Choice label="No list" selected={listId === null} onPress={() => setListId(null)} />
        {lists.data?.map((item) => <Choice key={item.id} label={item.name} selected={listId === item.id} onPress={() => setListId(item.id)} />)}</>}
      <Toggle label="Overdue only" value={overdue} onChange={setOverdue} /><Toggle label="Alert problems only" value={issues} onChange={setIssues} />
      <Copy muted size={14}>Alert problems include missed, timed out, interrupted, blocked and failed alerts.</Copy><Button label="Show reminders" onPress={() => setFilterOpen(false)} />
    </Sheet>
    {navigation.overlay}
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="View reminder" icon="info" onPress={() => { if (selected) open(selected); setSelected(null); }} />
      <SettingRow label="Done" icon="check" onPress={() => { if (selected) void complete(selected); setSelected(null); }} disabled={command.isPending} />
      <SettingRow label="Edit reminder" icon="edit" onPress={() => { if (selected) router.push(editDestination(selected)); setSelected(null); }} />
      {!!selected && canAdjustAlert(selected) && <SettingRow label="Postpone" icon="snooze" onPress={() => { if (selected) router.push({ pathname: '/reminder/[id]', params: { id: selected.id, action: 'postpone' } }); setSelected(null); }} />}
      <SettingRow label="Move to Trash" icon="delete" onPress={() => { if (selected) trash(selected); setSelected(null); }} disabled={command.isPending} />
    </Sheet>
  </SafeAreaView>;
}
