import { chineseTextMetrics } from '../ui/tokens';
import { errorText, currentLanguage } from '../localization';
import { useLocalizedState, useLocale, useTranslation } from '../localization/react';

import { canCreateFromEmptyAgenda } from '../domain/empty-agenda';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, LayoutAnimation, Pressable, SectionList, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ListRecord, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, editDestination, reopenCompleted } from '../domain/actions';
import { groupTitle } from '../domain/presentation';
import { canPostponeReminder } from '../domain/postpone';
import { parsePostponeRequest, type PostponeRequest } from '../domain/postpone-request';
import { PostponeHost, usePostponeController } from '../ui/postpone-host';
import { ActionFeedback, AtmosphericHeader, Button, Copy, Icon, IconButton, QueryState, SectionHeader, SettingRow, Sheet, Snackbar, Status } from '../ui/components';
import { browseFilterChips, browseReminderFilter, commitBrowseFilters, removeBrowseFilter, resetBrowseFilters, type BrowseFilterField, type BrowseFilters } from '../domain/browse-filters';
import { BrowseFilterButton, BrowseFilterChips, BrowseFilterSheet } from '../ui/browse-filters';
import { dismissNotice, useNotice } from '../ui/feedback';
import { useReducedMotion } from '../ui/motion';
import { engine, nativeAvailable, useCapabilities } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useAppearanceHold, useFontScaleOverride, useTheme } from '../ui/theme';
import { creationOrigin, listOriginParams, originParams, readRootSnapshot, retainedOriginParams, rootKey, secondaryOriginRoute, writeRootSnapshot, type DestinationOrigin, type OriginParams } from '../domain/navigation';
import { activateNotice, CommandRecovery, ListNameSheet, notifyTrash, RootMore, RootNavigation, useCapturedCommand, useDestinationNavigation } from '../ui/navigation';
import { useRootState } from '../ui/root-state';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { RoutineActions, type RoutineActionTarget } from '../ui/routine-actions';
import { CreationMenu } from '../ui/creation-menu';
import { TrashConfirmation } from '../ui/trash-confirmation';
import { WindowGeometryRegion } from '../ui/form-viewport';
import { calendarCancellation, calendarRowNotice } from '../domain/calendar-presentation';
import { CalendarAttentionCard } from '../ui/calendar-sync';
import { ScrollChromeProvider, ScrollReadingPlane, useChromeScroll, usePageChrome } from '../ui/scroll-chrome';

type Toast = { message: string; persistent?: boolean; undo?: { id: string; revision: number; operationId: string } };
type AgendaSection = { key: string; title: string; count: number };
export default function HomeScreen() {
  'use no memo';
  useLocale(); return <AgendaScreen destination={{ kind: 'agenda' }} />; }
export function AgendaScreen({ destination }: { destination: DestinationOrigin }) {
  'use no memo';
  const t = useTranslation();
  const params = useLocalSearchParams<OriginParams & { postponeRequest?: string | string[]; postponeRequestKey?: string | string[] }>(), origin = destination.kind === 'list' && !params.originRoot && !params.originListId && !params.originNoList ? { kind: 'lists' as const } : creationOrigin(params);
  const key = rootKey(destination), scoped = destination.kind === 'list';
  const colors = useTheme(), scale = useFontScaleOverride(), client = useQueryClient(), capabilities = useCapabilities();
  const confirm = useAppearanceConfirmation();
  const notice = useNotice(), reducedMotion = useReducedMotion();
  const [searching, setSearching] = useRootState(key + ':searching', false), [search, setSearch] = useRootState(key + ':search', '');
  const chrome = usePageChrome(key,searching);
  const restoreChrome = chrome.restoreOffset;
  const [listHeight,setListHeight] = useState(0);
  const [view, setView] = useRootState<'agenda' | 'today' | 'upcoming'>(key + ':view', 'agenda');
  const fixedListId = destination.kind === 'list' ? destination.listId : undefined;
  const [appliedFilters, setAppliedFilters] = useRootState(key + ':filters', resetBrowseFilters('agenda', fixedListId));
  const listId = scoped ? fixedListId : appliedFilters.listId;
  const [filterDraft, setFilterDraft] = useState<BrowseFilters | null>(null), [collapsed, setCollapsed] = useRootState<string[]>(key + ':collapsed', []);
  const filterOpen = filterDraft !== null;
  const searchInput = useRef<TextInput>(null), searchFocusRequested = useRef(false);
  const [selected, setSelected] = useState<Occurrence | null>(null), [toast, setToast] = useLocalizedState<Toast | null>(null);
  const [routineMenu, setRoutineMenu] = useState<RoutineActionTarget | null>(null);
  const [refreshing, setRefreshing] = useState(false), refreshRunning = useRef(false);
  const [trashItem, setTrashItem] = useState<Occurrence | null>(null);
  const [editingList, setEditingList] = useState<ListRecord | null>(null), [listGuarded, setListGuarded] = useState(false), [initialNow] = useState(Date.now);
  const [savedScroll] = useState(()=>readRootSnapshot(key + ':scroll', 0));
  const [contentOffset] = useState(()=>({x:0,y:savedScroll}));
  const active = useRef(false);
  const list = useRef<SectionList<Occurrence, AgendaSection>>(null), scrollY = useRef(savedScroll), priorScroll = useRef(savedScroll), restoreScroll = useRef(true);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; searchFocusRequested.current = false; searchInput.current?.blur(); };
  }, []));
  useFocusEffect(useCallback(()=>{
    if (!searching) { priorScroll.current=readRootSnapshot(key+':scroll',0); restoreScroll.current=true; restoreChrome(priorScroll.current); }
  },[key,searching,restoreChrome]));
  const animate = useCallback(() => { if (!reducedMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); }, [reducedMotion]);
  const action = useCapturedCommand((job, result) => {
    if (job.command.kind === 'Delete' && job.item) { notifyTrash(job.item, result); return false; }
    else if (job.command.kind === 'Done') {
      const done = result.occurrence, feedback = commandFeedback(result, job.success);
      setToast({ message: feedback.message, persistent: feedback.tone !== 'success', ...(done?.completed ? { undo: { id: done.id, revision: done.revision, operationId: engine().createOperationId() } } : {}) });
    } else {
      const feedback = commandFeedback(result, job.success);
      setToast({ message: feedback.message, persistent: feedback.tone !== 'success' });
    }
  });
  const postpone = usePostponeController(), postponeFocus = useRef<View>(null), moreButtons = useRef(new Map<string, View>());
  const handledPostponeLink = useRef<string | null>(null);
  const guarded = action.guarded || listGuarded || postpone.guarded;
  const isGuarded = () => action.isGuarded() || listGuarded || postpone.controller.isGuarded();
  const refreshAgenda = async () => {
    if (refreshRunning.current || isGuarded() || !nativeAvailable) return;
    refreshRunning.current = true; setRefreshing(true);
    try { await engine().reconcile(); await client.invalidateQueries(); }
    catch (error) { setToast({ message: errorText(error, t('m_1573dcd227e5')), persistent: true }); }
    finally { refreshRunning.current = false; setRefreshing(false); }
  };
  useAppearanceHold(searching || guarded);
  useEffect(() => {
    if (!searching || !searchFocusRequested.current || guarded) return;
    const frame = requestAnimationFrame(() => { if (active.current) searchInput.current?.focus(); searchFocusRequested.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [searching, guarded]);
  const closeSearch = useCallback(() => { animate(); searchFocusRequested.current = false; searchInput.current?.blur(); Keyboard.dismiss(); restoreScroll.current = true; setSearching(false); }, [animate, setSearching]);
  const beforeBack = useCallback(() => {
    if (trashItem) { setTrashItem(null); return true; }
    if (filterOpen) { setFilterDraft(null); return true; }
    if (selected) { setSelected(null); return true; }
    if (editingList) { setEditingList(null); return true; }
    if (searching) { closeSearch(); return true; }
    return false;
  }, [trashItem, filterOpen, selected, editingList, searching, closeSearch, setTrashItem, setFilterDraft, setSelected, setEditingList]);
  const back = useDestinationNavigation(destination, beforeBack, guarded, scoped ? origin : undefined,
    scoped ? secondaryOriginRoute({ ...originParams(origin), ...retainedOriginParams(params) }) : undefined);
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const calendarLinks = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(), enabled: nativeAvailable });
  const calendarSummary = useQuery({ queryKey: ['calendar', 'sync-summary'], queryFn: () => engine().getCalendarSyncSummary(), enabled: nativeAvailable });
  const calendarByReminder = new Map(calendarLinks.data?.map(link => [link.occurrenceId, link]));
  const calendarFor = (item: Occurrence) => calendarByReminder.get(item.id) ?? calendarLinks.data?.find(link => !!item.seriesId && link.seriesId === item.seriesId);
  const currentList = lists.data?.find((item) => item.id === listId);
  const listName = listId === null ? t('m_eacd31d849f9') : currentList?.name ?? '';
  const missingList = scoped && listId !== null && !!lists.data && !currentList;
  const title = scoped ? listId === null ? t('m_eacd31d849f9') : listName || (missingList ? t('m_99d8ddda9f1d') : t('m_6f202f54a7b2')) : 'Remilo';
  const chips = browseFilterChips('agenda', appliedFilters, lists.data, fixedListId);
  const filter = browseReminderFilter('agenda', appliedFilters, { view, search, fixedListId });
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
  const emptyCreate = canCreateFromEmptyAgenda({ native: nativeAvailable, scoped, view, searching: searching || !!search,
    optionalFilters: chips.length, items: items.length, total: totals?.total, success: reminders.isSuccess,
    fetching: reminders.isFetching, error: !!reminders.error, placeholder: reminders.isPlaceholderData });
  const [creationMenu, setCreationMenu] = useState(false), creationTrigger = useRef<View>(null);
  const create = () => { if (!isGuarded() && nativeAvailable && !missingList) { Keyboard.dismiss(); setCreationMenu(true); } };
  const sections = [...groups].map(([group, data]) => ({ key: group, title: groupTitle(group, new Date(capabilities.data?.observedAtMs ?? initialNow)), count: totals?.groups[group] ?? data.length, data: collapsed.includes(group) ? [] : data }));
  const open = (item: Occurrence) => { Keyboard.dismiss(); if (item.routine) router.push({ pathname: '/routine-session', params: { id: item.routine.routineId, date: item.routine.date } }); else router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...originParams(destination) } }); };
  const complete = (item: Occurrence) => {
    if (isGuarded()) return;
    if (notice) dismissNotice(notice.id); setToast(null); animate();
    void action.execute({ command: { kind: 'Done', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() }, item, success: t('m_1ecfa283c074') });
  };
  const undo = async (captured: NonNullable<Toast['undo']>) => {
    if (isGuarded()) return;
    try {
      const item = await engine().getOccurrence(captured.id), reversal = reopenCompleted(item, captured.revision, captured.operationId);
      if (!reversal) { setToast({ message: item && !item.completed ? t('m_d0a143683c18') : t('m_6d3dc336368d'), persistent: !!item?.completed }); return; }
      setToast(null); animate(); await action.execute({ command: reversal, success: t('m_3202cb804f79') });
    } catch (error) { setToast({ message: errorText(error, t('m_1573dcd227e5')), undo: captured, persistent: true }); }
  };
  const deleteItem = (item: Occurrence) => {
    if (isGuarded()) return;
    if (notice) dismissNotice(notice.id); setToast(null);
    void action.execute({ command: { kind: 'Delete', occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() }, item, success: t('m_2d65f262cc64') });
  };
  const trash = (item: Occurrence) => {
    if (isGuarded()) return;
    if (item.completed || item.skipped) { deleteItem(item); return; }
    setTrashItem({ ...item });
  };
  const removeList = () => {
    if (!currentList || isGuarded()) return;
    confirm(t('m_0c08198f562b'), t('remove_list_confirmation', { name: currentList.name }), [
      { text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_669f24b0f91d'), style: 'destructive', onPress: () => void action.execute({ command: { kind: 'RemoveList', listId: currentList.id, expectedRevision: currentList.revision, operationId: engine().createOperationId() }, success: t('m_3e8157774f26') }) }]);
  };
  const commitFilters = (draft: BrowseFilters) => {
    const next = commitBrowseFilters('agenda', appliedFilters, draft, { fixedListId, guarded: isGuarded() });
    if (!next) return false;
    if (next !== appliedFilters) {
      const offset = Math.min(Math.max(0, searching ? priorScroll.current : scrollY.current), chrome.decoration);
      priorScroll.current = offset; scrollY.current = offset; restoreScroll.current = true;
      writeRootSnapshot(key + ':scroll', offset); restoreChrome(offset);
      list.current?.getScrollResponder()?.scrollTo({ y: offset, animated: false });
      setAppliedFilters(next);
    }
    return true;
  };
  const removeFilter = (field: BrowseFilterField) => commitFilters(removeBrowseFilter(appliedFilters, field));
  const resetFilters = () => commitFilters(resetBrowseFilters('agenda', fixedListId));
  const openFilters = () => { if (isGuarded()) return; searchFocusRequested.current = false; searchInput.current?.blur(); Keyboard.dismiss(); setFilterDraft({ ...appliedFilters }); };
  const caps = capabilities.data, warning = caps ? !caps.exactAlarms ? t('m_7289470d5860') : !caps.notifications ? t('m_8276fc8f3d9a')
    : !caps.channelEnabled ? t('m_35a1741a1501') : !caps.fullScreen ? t('m_aaeb8e7dbd8f') : '' : '';
  const focused = useIsFocused();
  useEffect(() => {
    if (scoped || !focused || params.postponeRequest === undefined) return;
    const token = JSON.stringify([params.postponeRequestKey, params.postponeRequest]);
    if (handledPostponeLink.current === token) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || handledPostponeLink.current === token) return;
      handledPostponeLink.current = token;
      const parsed = parsePostponeRequest(params.postponeRequest);
      if (parsed.kind === 'valid') {
        Keyboard.dismiss(); setSelected(null); setFilterDraft(null); setCreationMenu(false); setToast(null);
        postpone.controller.open(parsed.request);
      } else if (parsed.kind === 'invalid') setToast({ message: t('postpone_invalid_request'), persistent: true });
      // Consuming the presentation params prevents a render/focus refresh from reopening a closed draft.
      router.setParams({ postponeRequest: undefined, postponeRequestKey: undefined });
    });
    return () => { active = false; };
  }, [scoped, focused, params.postponeRequest, params.postponeRequestKey, postpone.controller, setToast, t]);
  const openPostpone = (request: PostponeRequest) => {
    if (isGuarded()) return;
    Keyboard.dismiss(); setSelected(null); setToast(null);
    if (scoped) router.navigate({ pathname: '/', params: { postponeRequest: JSON.stringify(request), postponeRequestKey: engine().createOperationId() } });
    else postpone.controller.open(request);
  };
  const activeToast = !focused ? null : toast ?? (notice ? { message: notice.message, persistent: notice.persistent } : null);
  const constrained = searching || filterOpen || guarded;
  const rememberScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => { scrollY.current=event.nativeEvent.contentOffset.y; if(active.current && !searching && !restoreScroll.current)writeRootSnapshot(key+':scroll',scrollY.current); },[key,searching]);
  const onScroll=useChromeScroll(chrome,rememberScroll);
  return <SafeAreaView edges={['top','left','right']} style={{flex:1,backgroundColor:colors.background}}><ScrollChromeProvider value={chrome}><View style={{flex:1}}>
    <View pointerEvents="box-none" style={{position:'absolute',top:0,left:0,right:0,height:chrome.opening}}>
    <AtmosphericHeader title={title} home={!scoped && !constrained} subtitle={!scoped && !constrained ? new Date(caps?.observedAtMs ?? initialNow).toLocaleDateString(currentLanguage(), { weekday: 'long', month: 'long', day: 'numeric' }) : undefined} back={scoped} onBack={back} actions={<>
      <IconButton icon="search" label={searching ? t('m_1655ed829a84') : t('m_be16218d3058')} disabled={guarded} onPress={() => { if (isGuarded()) return; if (searching) closeSearch(); else { priorScroll.current = scrollY.current; searchFocusRequested.current = true; animate(); setSearching(true); } }} />
      <RootMore origin={destination} disabled={guarded} listActions={scoped && currentList ? { rename: () => setEditingList(currentList), remove: removeList } : undefined} />
    </>} />
    </View>
    <View pointerEvents="box-none" style={{flex:1,paddingTop:chrome.toolbar}}><WindowGeometryRegion>
    <View style={{ flex: 1, overflow:'hidden' }}>
      <ScrollReadingPlane />
      <Animated.SectionList<Occurrence, AgendaSection> ref={list} sections={sections} keyExtractor={(item) => item.id} stickySectionHeadersEnabled contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 88, minHeight:listHeight+chrome.decoration }} keyboardShouldPersistTaps="handled"
        contentOffset={contentOffset} onScroll={onScroll} scrollEventThrottle={16} onLayout={event=>setListHeight(event.nativeEvent.layout.height)}
        ListHeaderComponent={<><View style={{height:chrome.decoration}} />    {searching && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.surface }}>
      <IconButton icon="arrow_back" label={t('m_1655ed829a84')} onPress={closeSearch} />
      <TextInput ref={searchInput} accessibilityLabel={t('m_608e5f5e0f40')} value={search} onChangeText={(value) => { if (!isGuarded()) setSearch(value); }} placeholder={t('m_be16218d3058')} editable={!guarded}
        placeholderTextColor={colors.muted} style={{ flex: 1, minHeight: 48, padding: 8, color: colors.ink, fontSize: 16 * scale, ...chineseTextMetrics(16, scale) }} />
      {!!search && <IconButton icon="close" label={t('m_48a1982ccf79')} disabled={guarded} onPress={() => { if (!isGuarded()) setSearch(''); }} />}
    </View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
      <View accessibilityRole="tablist" style={{ flexGrow: 1, flexBasis: 190, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {([{ value: 'agenda', label: t('m_a52ace420f21') }, { value: 'today', label: t('m_2b065c7c9ce4') }, { value: 'upcoming', label: t('m_5f1a2542e4e4') }] as const).map((tab) =>
        <Pressable key={tab.value} accessibilityRole="tab" aria-selected={view === tab.value} accessibilityState={{ selected: view === tab.value, disabled: guarded }} disabled={guarded} onPress={() => { if (!isGuarded()) setView(tab.value); }}
          style={{ flexGrow: 1, minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: view === tab.value ? colors.accent : colors.soft }}>
          <Text style={{ color: view === tab.value ? colors.accentInk : colors.ink, fontSize: 14 * scale, lineHeight: 14 * scale * 1.4, fontWeight: view === tab.value ? '600' : '400', ...chineseTextMetrics(14, scale, view === tab.value ? '600' : '400') }}>{tab.label}</Text></Pressable>)}</View>
      <BrowseFilterButton count={chips.length} disabled={guarded} expanded={filterOpen} onPress={openFilters} />
    </View>
    {!!chips.length && <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><BrowseFilterChips chips={chips} disabled={guarded} onRemove={removeFilter} onReset={resetFilters} /></View>}
    {!!search && !searching && <SettingRow intent="action" label={t('m_3363e5f143b7') + search} value={t('m_3b7ea51793e9')} disabled={guarded} onPress={() => { if (!isGuarded()) setSearch(''); }} />}
    {missingList && <View style={{ padding: 16, gap: 8 }}><Copy>{t('m_1e930ff715ad')}</Copy><Button label={t('m_8055353d4b41')} disabled={guarded}
      onPress={() => router.replace({ pathname: '/lists/[id]', params: { id: 'none', noList: 'true', ...originParams(origin), ...retainedOriginParams(params) } })} /></View>}
    {!!warning && <Pressable accessibilityRole="button" accessibilityLabel={warning + t('m_cd7dac8a7f6b')} disabled={guarded}
      onPress={() => router.push({ pathname: '/settings', params: originParams(destination) })} style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 48 }}>
      <Status label={warning} tone={!caps?.exactAlarms || !caps?.notifications || !caps?.channelEnabled ? 'danger' : 'warning'} /></Pressable>}
    {!scoped && !!calendarSummary.data?.reviewCount && <View style={{ marginBottom: 12 }}><CalendarAttentionCard count={calendarSummary.data.reviewCount} tone={calendarSummary.data.attention?.tone} disabled={guarded}
      onPress={() => router.push({ pathname: '/calendar-reviews', params: originParams(destination) })} /></View>}
    {!!caps?.activeSessionActions?.members.length && <View style={{ marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="check" label={t('mark_all_done_count', { count: caps.activeSessionActions.members.length })} disabled={guarded}
        onPress={() => { const captured = caps.activeSessionActions!; void action.execute({ command: {
          kind: 'DoneAll', expectedSessionId: captured.sessionId, members: captured.members.map((member) => ({ ...member })), operationId: engine().createOperationId(),
        }, success: captured.members.length + t('m_a6167e44d2cf') }); }} /></View>
      <View style={{ flexGrow: 1, flexBasis: 160 }}><Button icon="schedule" label={t('postpone_all_action', { count: caps.activeSessionActions.members.length })} variant="secondary" disabled={guarded} buttonRef={postponeFocus}
        onPress={() => { const captured = caps.activeSessionActions!; openPostpone({ kind: 'Group', expectedSessionId: captured.sessionId,
          members: captured.members.map(member => ({ ...member })) }); }} /></View>
    </View>}
    {!!reminders.error && !!items.length && <View><ActionFeedback message={t('m_3d982a3fc277')} tone="danger" /><Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void reminders.refetch()} /></View>}
</>}
        refreshing={refreshing} onRefresh={() => void refreshAgenda()}
        onEndReached={() => { if (reminders.hasNextPage && !reminders.isFetchingNextPage && !reminders.isFetchNextPageError) void reminders.fetchNextPage(); }}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} count={section.count} expanded={!collapsed.includes(section.key)} overdue={section.key === 'overdue'}
          onPress={() => { animate(); setCollapsed((current) => current.includes(section.key) ? current.filter((group) => group !== section.key) : [...current, section.key]); }} />}
        renderItem={({ item, section }) => <ReminderRow item={item} calendarNotice={calendarCancellation(item, calendarFor(item))?.row || calendarRowNotice(calendarFor(item)) || undefined} context={{ groupKey: section.key }} nowMs={caps?.observedAtMs} onOpen={() => { if (!isGuarded()) open(item); }} onDone={item.routine ? undefined : () => complete(item)} moreButtonRef={node => { if (node) moreButtons.current.set(item.id, node); else moreButtons.current.delete(item.id); }} onMore={() => { if (!isGuarded()) { postponeFocus.current = moreButtons.current.get(item.id) ?? null; if (item.routine) setRoutineMenu({ id: item.routine.routineId, date: item.routine.date }); else setSelected(item); } }} busy={guarded} />}
        ListEmptyComponent={<View style={{ padding: 16, gap: 8 }}><QueryState loading={reminders.isLoading && nativeAvailable} error={reminders.error} empty
          emptyMessage={!nativeAvailable ? t('m_2ff2d9a672c5') : search || chips.length ? t('m_75bf15d2c28d') : view === 'today' ? t('m_fc926e22caaa') : view === 'upcoming' ? t('m_e22b01420e5f') : scoped ? t('m_284f8a392982') : t('m_057d33f49512')} onRetry={() => void reminders.refetch()} />
          {emptyCreate && <Button label={t('create_title')} buttonRef={creationTrigger} disabled={guarded} onPress={create} />}
          {!!search && <Button label={t('m_3b7ea51793e9')} variant="secondary" disabled={guarded} onPress={() => { if (!isGuarded()) setSearch(''); }} />}
          {!!chips.length && <Button label={t('m_10afa98480f2')} variant="secondary" disabled={guarded} onPress={resetFilters} />}</View>}
        ListFooterComponent={reminders.isFetchingNextPage ? <ActionFeedback loading message={t('m_964e5f88d036')} /> : reminders.isFetchNextPageError ? <Button label={t('m_6c13d1198cd5')} variant="secondary" onPress={() => void reminders.fetchNextPage()} /> : null} />
      {!emptyCreate && <Pressable accessibilityRole="button" accessibilityLabel={t('create_title')} accessibilityState={{ disabled: !nativeAvailable || missingList || guarded }} disabled={!nativeAvailable || missingList || guarded}
        ref={creationTrigger} onPress={create}
        style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, elevation: 3, opacity: pressed ? 0.8 : 1 })}>
        <Icon name="add" color={colors.accentInk} size={28} /></Pressable>}
    </View>
    {(action.guarded || action.feedback?.tone === 'danger') && <CommandRecovery action={action} />}
    {activeToast && !action.guarded && <Snackbar key={toast ? 'local' : notice?.id} message={activeToast.message} persistent={activeToast.persistent} action={toast?.undo ? t('m_a8283ade3185') : !toast ? notice?.action?.label : undefined}
      onAction={() => { if (toast?.undo) void undo(toast.undo); else if (notice?.action) void activateNotice(notice).finally(() => { void client.invalidateQueries(); }); }}
      onClose={() => { if (toast) setToast(null); else if (notice) dismissNotice(notice.id); }} />}
    <CreationMenu visible={creationMenu} onClose={() => setCreationMenu(false)} trigger={creationTrigger} params={destination.kind === 'list' ? listOriginParams(destination.listId) : undefined} />
    {!scoped && <RootNavigation destination="agenda" disabled={guarded} isGuarded={isGuarded} />}
    <BrowseFilterSheet title={t('m_76d11d556a30')} kind="agenda" draft={filterDraft} disabled={guarded} lists={lists.data ?? []} listsLoading={lists.isLoading && nativeAvailable}
      listsError={lists.error} onRetryLists={() => void lists.refetch()} fixedListId={fixedListId} fixedListName={listName}
      onDraftChange={next => { if (!isGuarded()) setFilterDraft(next); }} onCancel={() => setFilterDraft(null)}
      onApply={() => { if (filterDraft && commitFilters(filterDraft)) setFilterDraft(null); }} />
    <Sheet title={selected?.title ?? t('m_3ddd2c824c07')} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow intent="action" label={t('m_1f1353b055df')} icon="edit" onPress={() => { if (isGuarded()) return; if (selected) router.push({ ...editDestination(selected), params: { ...editDestination(selected).params, ...originParams(destination) } }); setSelected(null); }} disabled={guarded} />
      {!!selected && canPostponeReminder(selected) && <SettingRow intent="action" label={t('postpone_action')} icon="schedule" onPress={() => { if (selected) openPostpone({ kind: 'Single', occurrenceId: selected.id, expectedGeneration: selected.generation }); }} disabled={guarded} />}
      <SettingRow intent="action" label={t('m_62aa4b87cc52')} icon="check" onPress={() => { if (selected) complete(selected); setSelected(null); }} disabled={guarded} />
      <SettingRow intent="action" label={t('m_9adcdf33dce1')} icon="delete" onPress={() => { if (selected) trash(selected); setSelected(null); }} disabled={guarded} />
    </Sheet>
    {!scoped && <PostponeHost action={postpone} returnFocusRef={postponeFocus} />}
    <RoutineActions target={routineMenu} onClose={() => setRoutineMenu(null)} />
    <TrashConfirmation item={trashItem} onCancel={() => setTrashItem(null)} onConfirm={() => {
      if (!trashItem || guarded) return;
      const captured = trashItem; setTrashItem(null); deleteItem(captured);
    }} />
    {editingList && <ListNameSheet key={editingList.id} visible list={editingList} onGuardChange={setListGuarded} onClose={() => setEditingList(null)}
      onSaved={() => { setEditingList(null); setToast({ message: t('m_94586ca1f8c1') }); }} />}
  </WindowGeometryRegion></View></View></ScrollChromeProvider></SafeAreaView>;
}
