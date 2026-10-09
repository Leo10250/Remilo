import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, LayoutAnimation, Pressable, SectionList, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListRecord, Occurrence, ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, editDestination, reopenCompleted } from '../domain/actions';
import { canAdjustAlert, groupTitle } from '../domain/presentation';
import { ActionFeedback, AtmosphericHeader, Button, Choice, Copy, Icon, IconButton, QueryState, SectionHeader, SettingRow, Sheet, Snackbar, Status, Toggle } from '../ui/components';
import { dismissNotice, useNotice } from '../ui/feedback';
import { useReducedMotion } from '../ui/motion';
import { engine, nativeAvailable, useCapabilities } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useAppearanceHold, useFontScaleOverride, useTheme } from '../ui/theme';
import { creationOrigin, listOriginParams, originParams, readRootSnapshot, retainedOriginParams, rootKey, secondaryOriginRoute, writeRootSnapshot, type DestinationOrigin, type OriginParams } from '../domain/navigation';
import { activateNotice, CommandRecovery, ListNameSheet, notifyTrash, RootMore, RootNavigation, useCapturedCommand, useDestinationNavigation } from '../ui/navigation';
import { useRootState } from '../ui/root-state';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { WindowGeometryRegion } from '../ui/form-viewport';
import { ScrollChromeProvider, ScrollReadingPlane, useChromeScroll, usePageChrome } from '../ui/scroll-chrome';

type Toast = { message: string; persistent?: boolean; undo?: { id: string; revision: number; operationId: string } };
type AgendaSection = { key: string; title: string; count: number };
export default function HomeScreen() { return <AgendaScreen destination={{ kind: 'agenda' }} />; }
export function AgendaScreen({ destination }: { destination: DestinationOrigin }) {
  const params = useLocalSearchParams<OriginParams>(), origin = destination.kind === 'list' && !params.originRoot && !params.originListId && !params.originNoList ? { kind: 'lists' as const } : creationOrigin(params);
  const key = rootKey(destination), scoped = destination.kind === 'list';
  const colors = useTheme(), scale = useFontScaleOverride(), client = useQueryClient(), capabilities = useCapabilities();
  const confirm = useAppearanceConfirmation();
  const notice = useNotice(), reducedMotion = useReducedMotion();
  const [searching, setSearching] = useRootState(key + ':searching', false), [search, setSearch] = useRootState(key + ':search', '');
  const chrome = usePageChrome(key,searching);
  const restoreChrome = chrome.restoreOffset;
  const [listHeight,setListHeight] = useState(0);
  const [view, setView] = useRootState<'agenda' | 'today' | 'upcoming'>(key + ':view', 'agenda');
  const [listFilter, setListId] = useRootState<string | null | undefined>(key + ':list', undefined);
  const listId = destination.kind === 'list' ? destination.listId : listFilter;
  const [overdue, setOverdue] = useRootState(key + ':overdue', false), [issues, setIssues] = useRootState(key + ':issues', false);
  const [filterOpen, setFilterOpen] = useState(false), [collapsed, setCollapsed] = useRootState<string[]>(key + ':collapsed', []);
  const [selected, setSelected] = useState<Occurrence | null>(null), [toast, setToast] = useState<Toast | null>(null);
  const [editingList, setEditingList] = useState<ListRecord | null>(null), [listGuarded, setListGuarded] = useState(false), [initialNow] = useState(Date.now);
  const [savedScroll] = useState(()=>readRootSnapshot(key + ':scroll', 0));
  const [contentOffset] = useState(()=>({x:0,y:savedScroll}));
  const active = useRef(false);
  const list = useRef<SectionList<Occurrence, AgendaSection>>(null), scrollY = useRef(savedScroll), priorScroll = useRef(savedScroll), restoreScroll = useRef(true);
  useFocusEffect(useCallback(()=>{
    active.current=true;
    if (!searching) { priorScroll.current=readRootSnapshot(key+':scroll',0); restoreScroll.current=true; restoreChrome(priorScroll.current); }
    return ()=>{active.current=false;};
  },[key,searching,restoreChrome]));
  const animate = useCallback(() => { if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); }, [reducedMotion]);
  const action = useCapturedCommand((job, result) => {
    if (job.command.kind === 'Delete' && job.item) notifyTrash(job.item, result);
    else if (job.command.kind === 'Done') {
      const done = result.occurrence, feedback = commandFeedback(result, job.success);
      setToast({ message: feedback.message, persistent: feedback.tone !== 'success', ...(done?.completed ? { undo: { id: done.id, revision: done.revision, operationId: engine().createOperationId() } } : {}) });
    } else {
      const feedback = commandFeedback(result, job.success);
      setToast({ message: feedback.message, persistent: feedback.tone !== 'success' });
    }
  });
  const guarded = action.guarded || listGuarded;
  useAppearanceHold(searching || guarded);
  const closeSearch = useCallback(() => { animate(); Keyboard.dismiss(); restoreScroll.current = true; setSearching(false); }, [animate, setSearching]);
  const beforeBack = useCallback(() => {
    if (filterOpen) { setFilterOpen(false); return true; }
    if (selected) { setSelected(null); return true; }
    if (editingList) { setEditingList(null); return true; }
    if (searching) { closeSearch(); return true; }
    return false;
  }, [filterOpen, selected, editingList, searching, closeSearch, setFilterOpen, setSelected, setEditingList]);
  const back = useDestinationNavigation(destination, beforeBack, guarded, scoped ? origin : undefined,
    scoped ? secondaryOriginRoute({ ...originParams(origin), ...retainedOriginParams(params) }) : undefined);
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const currentList = lists.data?.find((item) => item.id === listId);
  const listName = listId === null ? 'No list' : currentList?.name ?? '';
  const missingList = scoped && listId !== null && !!lists.data && !currentList;
  const title = scoped ? listId === null ? 'No list' : listName || (missingList ? 'List removed' : 'List') : 'Remilo';
  const filter = { view, search, ...(listId !== undefined ? { listId } : {}), deliveryIssuesOnly: issues, overdueOnly: overdue } satisfies ReminderFilter;
  const reminders = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = reminders.data?.pages.flatMap((page) => page.items) ?? [];
  useEffect(() => {
    if (searching || !restoreScroll.current || !reminders.data) return;
    const frame = requestAnimationFrame(() => { restoreChrome(priorScroll.current); list.current?.getScrollResponder()?.scrollTo({ y: priorScroll.current, animated: false }); restoreScroll.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [searching, reminders.data, restoreChrome]);
  const groups = new Map<string, Occurrence[]>();
  items.forEach((item) => groups.set(item.agendaGroup, [...(groups.get(item.agendaGroup) ?? []), item]));
  const totals = reminders.data?.pages[0];
  const sections = [...groups].map(([group, data]) => ({ key: group, title: groupTitle(group), count: totals?.groups[group] ?? data.length, data: collapsed.includes(group) ? [] : data }));
  const open = (item: Occurrence) => { Keyboard.dismiss(); router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...originParams(destination) } }); };
  const complete = (item: Occurrence) => {
    if (guarded) return;
    if (notice) dismissNotice(notice.id); setToast(null); animate();
    void action.execute({ command: { kind: 'Done', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() }, item, success: 'Reminder completed' });
  };
  const undo = async (captured: NonNullable<Toast['undo']>) => {
    if (guarded) return;
    try {
      const item = await engine().getOccurrence(captured.id), reversal = reopenCompleted(item, captured.revision, captured.operationId);
      if (!reversal) { setToast({ message: item && !item.completed ? 'Reminder is already open' : 'Reminder changed; this completion can no longer be undone', persistent: !!item?.completed }); return; }
      setToast(null); animate(); await action.execute({ command: reversal, success: 'Reminder reopened' });
    } catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not undo. Try again.', undo: captured, persistent: true }); }
  };
  const deleteItem = (item: Occurrence) => {
    if (guarded) return;
    if (notice) dismissNotice(notice.id); setToast(null);
    void action.execute({ command: { kind: 'Delete', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() }, item, success: 'Moved to Trash' });
  };
  const trash = (item: Occurrence) => {
    if (item.completed || item.skipped) { deleteItem(item); return; }
    confirm(item.segmentId ? 'Move this occurrence to Trash?' : 'Move reminder to Trash?', 'Its alert will be cancelled. You can restore it from Trash.', [
      { text: 'Keep reminder', style: 'cancel' }, { text: 'Move to Trash', style: 'destructive', onPress: () => deleteItem(item) }]);
  };
  const removeList = () => {
    if (!currentList || guarded) return;
    confirm('Remove list?', 'Reminders in “' + currentList.name + '” move to No list. Their schedules and completion stay the same.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Remove list', style: 'destructive', onPress: () => void action.execute({ command: { kind: 'RemoveList', listId: currentList.id, expectedRevision: currentList.revision, operationId: engine().createOperationId() }, success: 'List removed. Reminders moved to No list.' }) }]);
  };
  const clearFilters = () => { if (!scoped) setListId(undefined); setOverdue(false); setIssues(false); };
  const caps = capabilities.data, warning = caps ? !caps.exactAlarms ? 'On-time alarms need permission' : !caps.notifications ? 'Notifications are blocked'
    : !caps.channelEnabled ? 'Alarm notifications are blocked' : !caps.fullScreen ? 'Lock-screen alarms are limited' : '' : '';
  const activeToast = toast ?? (notice ? { message: notice.message, persistent: notice.persistent } : null);
  const constrained = searching || filterOpen || guarded;
  const rememberScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => { scrollY.current=event.nativeEvent.contentOffset.y; if(active.current && !searching && !restoreScroll.current)writeRootSnapshot(key+':scroll',scrollY.current); },[key,searching]);
  const onScroll=useChromeScroll(chrome,rememberScroll);
  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:colors.background}}><ScrollChromeProvider value={chrome}><View style={{flex:1}}>
    <View pointerEvents="box-none" style={{position:'absolute',top:0,left:0,right:0,height:chrome.opening}}>
    <AtmosphericHeader title={title} home={!scoped && !constrained} subtitle={!scoped && !constrained ? new Date(caps?.observedAtMs ?? initialNow).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : undefined} back={scoped} onBack={back} actions={<>
      <IconButton icon="search" label={searching ? 'Exit search' : 'Search reminders'} disabled={guarded} onPress={() => { if (searching) closeSearch(); else { priorScroll.current = scrollY.current; animate(); setSearching(true); } }} />
      <RootMore origin={destination} disabled={guarded} listActions={scoped && currentList ? { rename: () => setEditingList(currentList), remove: removeList } : undefined} />
    </>} />
    </View>
    <View pointerEvents="box-none" style={{flex:1,paddingTop:chrome.toolbar}}><WindowGeometryRegion>
    <View style={{ flex: 1, overflow:'hidden' }}>
      <ScrollReadingPlane />
      <Animated.SectionList<Occurrence, AgendaSection> ref={list} sections={sections} keyExtractor={(item) => item.id} stickySectionHeadersEnabled contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 88, minHeight:listHeight+chrome.decoration }} keyboardShouldPersistTaps="handled"
        contentOffset={contentOffset} onScroll={onScroll} scrollEventThrottle={16} onLayout={event=>setListHeight(event.nativeEvent.layout.height)}
        ListHeaderComponent={<><View style={{height:chrome.decoration}} />    {searching && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.surface }}>
      <IconButton icon="arrow_back" label="Exit search" onPress={closeSearch} />
      <TextInput autoFocus accessibilityLabel="Search reminders and notes" value={search} onChangeText={setSearch} placeholder="Search reminders" editable={!guarded}
        placeholderTextColor={colors.muted} style={{ flex: 1, minHeight: 48, padding: 8, color: colors.ink, fontSize: 16 * scale }} />
      {!!search && <IconButton icon="close" label="Clear query" disabled={guarded} onPress={() => setSearch('')} />}
    </View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
      {([{ value: 'agenda', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }] as const).map((tab) =>
        <Pressable key={tab.value} accessibilityRole="tab" aria-selected={view === tab.value} accessibilityState={{ selected: view === tab.value, disabled: guarded }} disabled={guarded} onPress={() => setView(tab.value)}
          style={{ flexGrow: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: view === tab.value ? colors.accent : colors.soft }}>
          <Text style={{ color: view === tab.value ? colors.accentInk : colors.ink, fontSize: 14 * scale, lineHeight: 14 * scale * 1.4, fontWeight: view === tab.value ? '600' : '400' }}>{tab.label}</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Filter reminders" accessibilityState={{ disabled: guarded }} disabled={guarded}
        onPress={() => { Keyboard.dismiss(); setFilterOpen(true); }} style={{ flexGrow: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.soft }}>
        <Icon name="filter_list" size={18} /><Text style={{ color: colors.ink, fontSize: 14 * scale, lineHeight: 14 * scale * 1.4 }}>Filters</Text></Pressable>
    </View>
    {((!scoped && listId !== undefined) || overdue || issues) && <SettingRow label={[!scoped ? listName : '', overdue ? 'Overdue only' : '', issues ? 'Alert problems only' : ''].filter(Boolean).join(' · ')}
      value="Clear filters" icon="close" disabled={guarded} onPress={clearFilters} />}
    {!!search && !searching && <SettingRow label={'Search: ' + search} value="Clear search" disabled={guarded} onPress={() => setSearch('')} />}
    {missingList && <View style={{ padding: 16, gap: 8 }}><Copy>This list was removed. Its reminders are in No list.</Copy><Button label="Open No list" disabled={guarded}
      onPress={() => router.replace({ pathname: '/lists/[id]', params: { id: 'none', noList: 'true', ...originParams(origin), ...retainedOriginParams(params) } })} /></View>}
    {!!warning && <Pressable accessibilityRole="button" accessibilityLabel={warning + '. Open Settings'} disabled={guarded}
      onPress={() => router.push({ pathname: '/settings', params: originParams(destination) })} style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 48 }}>
      <Status label={warning} tone={!caps?.exactAlarms || !caps?.notifications || !caps?.channelEnabled ? 'danger' : 'warning'} /></Pressable>}
    {!!caps?.activeSessionActions?.members.length && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="check" label={'Done all (' + caps.activeSessionActions.members.length + ')'} disabled={guarded}
        onPress={() => { const captured = caps.activeSessionActions!; void action.execute({ command: {
          kind: 'DoneAll', expectedSessionId: captured.sessionId, members: captured.members.map((member) => ({ ...member })), operationId: engine().createOperationId(),
        }, success: captured.members.length + ' ringing reminders completed.' }); }} /></View>
      <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="snooze" label={'Snooze all · ' + caps.activeSessionActions.snoozeMinutes + ' min'} variant="secondary" disabled={guarded}
        onPress={() => { const captured = caps.activeSessionActions!; void action.execute({ command: {
          kind: 'SnoozeAll', expectedSessionId: captured.sessionId, members: captured.members.map((member) => ({ ...member })),
          snoozeMinutes: captured.snoozeMinutes, operationId: engine().createOperationId(),
        }, success: captured.members.length + ' reminders snoozed. Still unfinished.' }); }} /></View>
    </View>}
    {!!reminders.error && !!items.length && <View><ActionFeedback message="Could not refresh. Showing previously loaded information." tone="danger" /><Button label="Retry" variant="secondary" onPress={() => void reminders.refetch()} /></View>}
</>}
        refreshing={reminders.isRefetching} onRefresh={() => { void engine().reconcile().then(() => client.invalidateQueries()).catch((error: Error) => setToast({ message: error.message, persistent: true })); }}
        onEndReached={() => { if (reminders.hasNextPage && !reminders.isFetchingNextPage && !reminders.isFetchNextPageError) void reminders.fetchNextPage(); }}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} expanded={!collapsed.includes(section.key)} overdue={section.key === 'overdue'}
          onPress={() => { animate(); setCollapsed((current) => current.includes(section.key) ? current.filter((group) => group !== section.key) : [...current, section.key]); }} />}
        renderItem={({ item }) => <ReminderRow item={item} nowMs={caps?.observedAtMs} onOpen={() => { if (!guarded) open(item); }} onDone={() => complete(item)} onMore={() => { if (!guarded) setSelected(item); }} busy={guarded} />}
        ListEmptyComponent={<View style={{ padding: 16, gap: 8 }}><QueryState loading={reminders.isLoading && nativeAvailable} error={reminders.error} empty
          emptyMessage={!nativeAvailable ? 'Use the Android app to manage reminders.' : search || overdue || issues || view !== 'agenda' || (!scoped && listId !== undefined) ? 'No reminders match.' : scoped ? 'No reminders in this list yet.' : 'No reminders yet.'} onRetry={() => void reminders.refetch()} />
          {nativeAvailable && !reminders.isLoading && !reminders.error && !search && !overdue && !issues && view === 'agenda' && !missingList && <Copy muted size={14}>Use + to add a reminder.</Copy>}
          {(search || overdue || issues || (!scoped && listId !== undefined)) && <Button label={search ? 'Clear search' : 'Clear filters'} variant="secondary" onPress={search ? () => setSearch('') : clearFilters} />}</View>}
        ListFooterComponent={reminders.isFetchingNextPage ? <ActionFeedback loading message="Loading more…" /> : reminders.isFetchNextPageError ? <Button label="Retry loading more" variant="secondary" onPress={() => void reminders.fetchNextPage()} /> : null} />
      <Pressable accessibilityRole="button" accessibilityLabel="Add reminder" accessibilityState={{ disabled: !nativeAvailable || missingList || guarded }} disabled={!nativeAvailable || missingList || guarded}
        onPress={() => { Keyboard.dismiss(); router.push(destination.kind === 'list' ? { pathname: '/edit', params: listOriginParams(destination.listId) } : '/edit'); }}
        style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, elevation: 3, opacity: pressed ? 0.8 : 1 })}>
        <Icon name="add" color={colors.accentInk} size={28} /></Pressable>
    </View>
    {(action.guarded || action.feedback?.tone === 'danger') && <CommandRecovery action={action} />}
    {activeToast && !action.guarded && <Snackbar message={activeToast.message} persistent={activeToast.persistent} action={toast?.undo ? 'Undo' : !toast ? notice?.action?.label : undefined}
      onAction={() => { if (toast?.undo) void undo(toast.undo); else if (notice?.action) void activateNotice(notice).finally(() => { void client.invalidateQueries(); }); }}
      onClose={() => { if (toast) setToast(null); else if (notice) dismissNotice(notice.id); }} />}
    {!scoped && <RootNavigation destination="agenda" disabled={guarded} />}
    <Sheet title="Filter reminders" visible={filterOpen} onClose={() => setFilterOpen(false)} footer={<View style={{ padding: 16 }}><Button label="Show reminders" onPress={() => setFilterOpen(false)} /></View>}>
      <QueryState loading={lists.isLoading && nativeAvailable} error={lists.error} onRetry={() => void lists.refetch()} />
      {!scoped && <><Choice label="All lists" selected={listId === undefined} onPress={() => setListId(undefined)} /><Choice label="No list" selected={listId === null} onPress={() => setListId(null)} />
        {lists.data?.map((item) => <Choice key={item.id} label={item.name} selected={listId === item.id} onPress={() => setListId(item.id)} />)}</>}
      <Toggle label="Overdue only" value={overdue} onChange={setOverdue} /><Toggle label="Alert problems only" value={issues} onChange={setIssues} />
      <Copy muted size={14}>Alert problems include missed, timed out, interrupted, blocked and failed alerts.</Copy>
    </Sheet>
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="View reminder" icon="info" onPress={() => { if (selected) open(selected); setSelected(null); }} />
      <SettingRow label="Done" icon="check" onPress={() => { if (selected) complete(selected); setSelected(null); }} disabled={guarded} />
      <SettingRow label="Edit reminder" icon="edit" onPress={() => { if (selected) router.push({ ...editDestination(selected), params: { ...editDestination(selected).params, ...originParams(destination) } }); setSelected(null); }} disabled={guarded} />
      {!!selected && canAdjustAlert(selected) && <SettingRow label="Postpone" icon="snooze" onPress={() => { if (selected) router.push({ pathname: '/reminder/[id]', params: { id: selected.id, action: 'postpone', ...originParams(destination) } }); setSelected(null); }} disabled={guarded} />}
      <SettingRow label="Move to Trash" icon="delete" onPress={() => { if (selected) trash(selected); setSelected(null); }} disabled={guarded} />
    </Sheet>
    {editingList && <ListNameSheet key={editingList.id} visible list={editingList} onGuardChange={setListGuarded} onClose={() => setEditingList(null)}
      onSaved={() => { setEditingList(null); setToast({ message: 'List renamed.' }); }} />}
  </WindowGeometryRegion></View></View></ScrollChromeProvider></SafeAreaView>;
}
