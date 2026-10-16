import { useLocale, useTranslation } from '../localization/react';

import { useTimeFormatting } from '../ui/time-display';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View, type TextInput } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { collectionKey, creationOrigin, originParams, type DestinationOrigin, type OriginParams } from '../domain/navigation';
import { BulkRecovery, useBulkActions } from '../ui/bulk-actions';
import { ActionFeedback, AtmosphericHeader, Button, Copy, Field, IconButton, Page, QueryState, SettingRow, Sheet } from '../ui/components';
import { browseFilterChips, browseReminderFilter, commitBrowseFilters, removeBrowseFilter, resetBrowseFilters, type BrowseFilterField, type BrowseFilters } from '../domain/browse-filters';
import { BrowseFilterButton, BrowseFilterChips, BrowseFilterSheet } from '../ui/browse-filters';
import { CommandRecovery, notifyTrash, RootNavigation, RootNotice, useCapturedCommand, useDestinationNavigation } from '../ui/navigation';
import { engine, nativeAvailable } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { PurgeConfirmation } from '../ui/purge-confirmation';
import { useRootState } from '../ui/root-state';
import { useAppearanceHold } from '../ui/theme';

export default function Records() {
  'use no memo';
  useLocale();
  const params = useLocalSearchParams<OriginParams & { view?: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed', origin = creationOrigin(params);
  return <RecordsContent key={collectionKey(view, origin.kind === 'list' ? origin.listId : undefined)} view={view} origin={origin} />;
}
function RecordsContent({ view, origin }: { view: 'deleted' | 'completed'; origin: DestinationOrigin }) {
  'use no memo';
  const t = useTranslation();
  const { alertPresentation } = useTimeFormatting();
  const title = view === 'deleted' ? t('m_c560122ac470') : t('m_22a970d2e5b1'), scoped = origin.kind === 'list', fixedListId = scoped ? origin.listId : undefined;
  const destination: DestinationOrigin = scoped ? origin : { kind: view === 'deleted' ? 'trash' : 'completed' };
  const key = collectionKey(view, fixedListId);
  const [search, setSearch] = useRootState(key + ':search', ''), [searching, setSearching] = useRootState(key + ':searching', false);
  const [appliedFilters, setAppliedFilters] = useRootState(key + ':filters', resetBrowseFilters(view, fixedListId));
  const [selecting, setSelecting] = useRootState(key + ':selecting', false), [selectionIds, setSelectionIds] = useRootState<string[]>(key + ':selection', []);
  const selectingRef = useRef(selecting);
  const listId = scoped ? fixedListId : appliedFilters.listId;
  const [filterDraft, setFilterDraft] = useState<BrowseFilters | null>(null), [menuOpen, setMenuOpen] = useState(false), [selected, setSelected] = useState<Occurrence | null>(null);
  const [scrollResetToken, setScrollResetToken] = useState(0), [trashHelpOpen, setTrashHelpOpen] = useState(false);
  const filterOpen = filterDraft !== null, searchInput = useRef<TextInput>(null), searchFocusRequested = useRef(false);
  const active = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; searchFocusRequested.current = false; searchInput.current?.blur(); };
  }, []));
  const [purgeItems, setPurgeItems] = useState<Occurrence[]>([]), [purgeBulk, setPurgeBulk] = useState(false);
  const singleRunning = useRef(false), completedBulk = useRef<string | null>(null);
  const action = useCapturedCommand((job, result) => {
    if (job.command.kind === 'Delete' && job.item) { notifyTrash(job.item, result); return false; }
    const restored = result.occurrence;
    if (job.command.kind === 'UndoDelete' && restored && !restored.completed && !restored.skipped && restored.mode !== 'None' &&
      alertPresentation(restored).target === null && restored.deliveryState !== 'Alerting')
      return t('m_67e536f2210c');
  });
  const bulk = useBulkActions(), guarded = action.guarded || bulk.guarded;
  const isGuarded = () => singleRunning.current || action.isGuarded() || bulk.isGuarded();
  useAppearanceHold(searching || guarded);
  useEffect(() => {
    if (!searching || !searchFocusRequested.current || guarded || selecting) return;
    const frame = requestAnimationFrame(() => { if (active.current) searchInput.current?.focus(); searchFocusRequested.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [searching, guarded, selecting]);
  const exitSelection = () => {
    if (isGuarded()) return;
    selectingRef.current = false; setSelecting(false); setSelectionIds([]); setMenuOpen(false); bulk.clear();
  };
  const back = useDestinationNavigation(destination, () => {
    if (isGuarded()) return true;
    if (purgeItems.length) { setPurgeItems([]); return true; }
    if (trashHelpOpen) { setTrashHelpOpen(false); return true; }
    if (filterOpen) { setFilterDraft(null); return true; }
    if (selected) { setSelected(null); return true; }
    if (menuOpen) { setMenuOpen(false); return true; }
    if (selecting) { exitSelection(); return true; }
    if (searching) { searchFocusRequested.current = false; searchInput.current?.blur(); Keyboard.dismiss(); setSearching(false); return true; }
    return false;
  }, guarded, scoped ? origin : undefined);
  const guardedBack = () => isGuarded() || back();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const scopeName = listId === null ? t('m_eacd31d849f9') : lists.data?.find((list) => list.id === listId)?.name ?? t('m_e7f6d340d947');
  const chips = browseFilterChips(view, appliedFilters, lists.data, fixedListId);
  const filter = browseReminderFilter(view, appliedFilters, { view, search, fixedListId });
  const query = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = useMemo(() => [...new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()], [query.data]);
  const selectedItems = items.filter((item) => selectionIds.includes(item.id));
  const loadedLabel = items.length === 1 ? t('m_9ce7011ab48f') : t('m_a53ebed84cc8');
  useEffect(() => {
    if (!bulk.job || bulk.busy || bulk.guarded || bulk.progress.pending !== 0 || completedBulk.current === bulk.job.id) return;
    completedBulk.current = bulk.job.id;
    setSelectionIds([]);
  }, [bulk.job, bulk.busy, bulk.guarded, bulk.progress.pending, setSelectionIds]);
  useEffect(() => {
    if (guarded || !query.data || query.isFetching) return;
    const available = new Set(items.map((item) => item.id));
    setSelectionIds((current) => current.every((id) => available.has(id)) ? current : current.filter((id) => available.has(id)));
  }, [guarded, items, query.data, query.isFetching, setSelectionIds]);
  const update = (item: Occurrence, kind: 'UndoDelete' | 'Reopen' | 'Delete' | 'Purge') => {
    if (isGuarded()) return;
    const operationId = engine().createOperationId();
    singleRunning.current = true;
    setSelected(null);
    void action.execute({ command: { kind, occurrenceId: item.id, expectedRevision: item.revision, operationId }, item,
      success: kind === 'UndoDelete' ? item.completed ? t('m_a0cbb012eedf') : item.skipped ? t('m_4dc0768b0761') : t('m_cb9c0f35189c')
        : kind === 'Purge' ? t('m_ddba37fd352b') : kind === 'Delete' ? t('m_2d65f262cc64') : t('m_8b94105daf2b') }).finally(() => { singleRunning.current = false; });
  };
  const open = (item: Occurrence) => { if (!isGuarded()) { Keyboard.dismiss(); if (item.routine && !item.deleted) router.push({ pathname: '/routine-session', params: { id: item.routine.routineId, date: item.routine.date } }); else router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...originParams(destination), originCollection: view } }); } };
  const commitFilters = (draft: BrowseFilters) => {
    const next = commitBrowseFilters(view, appliedFilters, draft, { fixedListId, guarded: isGuarded(), selecting: selectingRef.current });
    if (!next) return false;
    if (next !== appliedFilters) { setAppliedFilters(next); setScrollResetToken(token => token + 1); }
    return true;
  };
  const removeFilter = (field: BrowseFilterField) => commitFilters(removeBrowseFilter(appliedFilters, field));
  const resetFilters = () => commitFilters(resetBrowseFilters(view, fixedListId));
  const openFilters = () => { if (isGuarded() || selectingRef.current) return; searchFocusRequested.current = false; searchInput.current?.blur(); Keyboard.dismiss(); setFilterDraft({ ...appliedFilters }); };
  const startSelection = () => {
    if (isGuarded() || !items.length) return;
    selectingRef.current = true; searchFocusRequested.current = false; searchInput.current?.blur(); Keyboard.dismiss(); setSearching(false); setFilterDraft(null); setSelected(null); setMenuOpen(false); setSelectionIds([]); setSelecting(true); bulk.clear();
  };
  const toggleSelection = (id: string) => {
    if (isGuarded()) return;
    setSelectionIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    bulk.clear();
  };
  const runBulk = (kind: 'Reopen' | 'Delete' | 'UndoDelete') => {
    if (isGuarded() || !selectedItems.length || selectedItems.length !== selectionIds.length) return;
    Keyboard.dismiss(); setMenuOpen(false); void bulk.execute(kind, selectedItems);
  };
  const requestPurge = (captured: Occurrence[], multiple: boolean) => {
    if (isGuarded() || view !== 'deleted' || !captured.length || captured.some(item => !item.deleted)) return;
    Keyboard.dismiss(); setSelected(null); setMenuOpen(false); setPurgeBulk(multiple);
    setPurgeItems(captured.map(item => ({ ...item })));
  };
  const confirmPurge = () => {
    if (isGuarded() || !purgeItems.length) return;
    const captured = purgeItems; setPurgeItems([]);
    if (purgeBulk) bulk.execute('Purge', captured); else update(captured[0], 'Purge');
  };
  const emptyMessage = !nativeAvailable ? t('m_2ff2d9a672c5') : search || !scoped && listId !== undefined ? t('m_75bf15d2c28d') : view === 'deleted' ? t('m_4ff140671613') : appliedFilters.includeSkipped ? t('m_e6d3bf1ca046') : t('m_30a5147eb7de');
  return <Page title={title} back={scoped || selecting} onBack={guardedBack} scrollKey={key} scrollReady={!query.isLoading} scrollResetToken={scrollResetToken}
    header={<AtmosphericHeader back={scoped || selecting} title={selecting ? selectionIds.length + t('m_97a2e8815acd') : title} subtitle={selecting ? title + (scoped ? ' · ' + scopeName : '') : scoped ? scopeName : undefined} onBack={guardedBack} actions={<>
      {!selecting && <IconButton icon="search" label={searching ? t('m_1655ed829a84') : t('m_fc9f7623b53e') + title.toLowerCase()} disabled={guarded} onPress={() => {
        if (isGuarded() || selectingRef.current) return; Keyboard.dismiss(); searchFocusRequested.current = !searching;
        if (searching) searchInput.current?.blur(); setSearching(!searching);
      }} />}
      {(view === 'completed' || !scoped) && !selecting && <BrowseFilterButton presentation="icon" count={chips.length} disabled={guarded} expanded={filterOpen} onPress={openFilters} />}
      <IconButton icon="more_vert" label={selecting ? t('m_b847ffdd0a1b') : title + t('m_04d2a6702176')} disabled={guarded} onPress={() => { if (isGuarded()) return; Keyboard.dismiss(); setMenuOpen(true); }} />
    </>} />}
    footer={<><CommandRecovery action={action} />
      {selecting && <View style={{ padding: 16, gap: 8 }}>
        <Copy muted size={14}>{guarded && bulk.job ? t('m_c8e043d904a9') + bulk.job.entries.length + (bulk.job.entries.length === 1 ? t('m_caddc31b6d05') : t('m_b5765ff6882a')) : selectionIds.length + t('m_df16eabb211c') + items.length + t('m_3cded792a06b') + loadedLabel + '.'}</Copy>
        {bulk.guarded && !bulk.busy && <Button label={t('m_913b0a77f27f')} onPress={bulk.retry} />}
        {!!selectionIds.length && !bulk.guarded && <>
          <Button label={view === 'deleted' ? t('m_a76e13b98392') : t('m_a886d1dc4f12')} accessibilityLabel={view === 'deleted' ? t('m_536d8b1e30eb') : t('m_380e09bc779d')} variant="secondary" disabled={guarded || !selectedItems.length || view !== 'deleted' && selectedItems.some(item => !!item.routine)} onPress={() => runBulk(view === 'deleted' ? 'UndoDelete' : 'Reopen')} />
          {view === 'completed' && <Button label={t('m_9adcdf33dce1')} accessibilityLabel={t('m_570d20ab666c')} variant="secondary" disabled={guarded || !selectedItems.length} onPress={() => runBulk('Delete')} />}
          {view === 'deleted' && <Button label={t('m_280b10c89cc4')} accessibilityLabel={t('m_cee8f4863172')} variant="danger" disabled={guarded || !selectedItems.length || selectedItems.length !== selectionIds.length} onPress={() => requestPurge(selectedItems, true)} />}
        </>}
      </View>}
      <RootNotice disabled={guarded} />{!selecting && <RootNavigation destination={scoped ? 'lists' : view === 'deleted' ? 'trash' : 'completed'} atRoot={!scoped} disabled={guarded} isGuarded={isGuarded} />}</>}>
    {searching && <View style={{ gap: 8 }}><Field inputRef={searchInput} label={t('m_fc9f7623b53e') + title.toLowerCase()} placeholder={t('m_2796b78f7c5e')} value={search} onChangeText={(value) => { if (!isGuarded() && !selectingRef.current) setSearch(value); }} editable={!guarded && !selecting} />
      {!!search && <Button label={t('m_3b7ea51793e9')} variant="secondary" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}</View>}
    {!!search && !searching && <SettingRow label={t('m_3363e5f143b7') + search} value={t('m_3b7ea51793e9')} disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}
    {scoped && <Copy muted size={14}>{t('m_8e644ee1deea') + scopeName}</Copy>}
    <BrowseFilterChips chips={chips} disabled={guarded || selecting} onRemove={removeFilter} onReset={resetFilters} />
    {selecting && <Copy muted size={14}>{t('m_6b16b17cf558')}</Copy>}
    {view === 'deleted' && <Copy muted size={14}>{t('m_8d95dd748021')}</Copy>}
    {selecting && <BulkRecovery action={bulk} />}
    {!!query.error && !!items.length ? <View style={{ gap: 8 }}><ActionFeedback message={t('m_3d982a3fc277')} tone="danger" /><Button label={t('m_942087cc2d41')} variant="secondary" disabled={guarded} onPress={() => { if (!isGuarded()) void query.refetch(); }} /></View> :
      <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!items.length} emptyMessage={emptyMessage} onRetry={() => { if (!isGuarded()) void query.refetch(); }} />}
    {!items.length && !!search && <Button label={t('m_3b7ea51793e9')} variant="secondary" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}
    {!items.length && !!chips.length && <Button label={t('m_10afa98480f2')} variant="secondary" disabled={guarded || selecting} onPress={resetFilters} />}
    {items.map((item) => <ReminderRow key={item.id} item={item} onOpen={() => open(item)}
      onMore={() => { if (!isGuarded()) setSelected(item); }} onTrash={!selecting && view === 'completed' ? () => update(item, 'Delete') : undefined}
      restore={view === 'deleted'} busy={guarded} selection={selecting ? { selected: selectionIds.includes(item.id), onToggle: () => toggleSelection(item.id) } : undefined} />)}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? t('m_964e5f88d036') : query.isFetchNextPageError ? t('m_6c13d1198cd5') : t('m_ac8991ef0101')} disabled={guarded || query.isFetchingNextPage} variant="secondary" onPress={() => { if (!isGuarded()) void query.fetchNextPage(); }} />}
    <Sheet title={selecting ? t('m_b847ffdd0a1b') : title + t('m_04d2a6702176')} visible={menuOpen} onClose={() => { if (!isGuarded()) setMenuOpen(false); }}>
      {selecting ? <>
        <SettingRow label={t('m_b67fb40d381e')} description={t('m_b6fac3049447') + items.length + t('m_0cba3160436e') + loadedLabel + '.'} disabled={guarded || !items.length} onPress={() => { if (isGuarded()) return; setSelectionIds(items.map((item) => item.id)); setMenuOpen(false); bulk.clear(); }} />
        <SettingRow label={t('m_cea4d2e010b8')} disabled={guarded || !selectionIds.length} onPress={() => { if (isGuarded()) return; setSelectionIds([]); setMenuOpen(false); bulk.clear(); }} />
        <SettingRow label={t('m_860e7995708f')} disabled={guarded} onPress={exitSelection} />
      </> : <SettingRow label={t('m_de3ead6ecd09')} icon="checklist" disabled={guarded || !items.length} onPress={startSelection} />}
      {!selecting && view === 'deleted' && <SettingRow label={t('m_7739c768203f')} icon="info" disabled={guarded} onPress={() => {
        if (isGuarded()) return; setMenuOpen(false); setTrashHelpOpen(true);
      }} />}
      {!selecting && <SettingRow label={t('m_74a883a037bc')} icon="settings" disabled={guarded} onPress={() => {
        if (isGuarded()) return; setMenuOpen(false); router.push({ pathname: '/settings', params: originParams(destination) });
      }} />}
    </Sheet>
    <BrowseFilterSheet title={t('m_167cef2f2f60') + title.toLowerCase()} kind={view} draft={filterDraft} disabled={guarded || selecting} lists={lists.data ?? []}
      listsLoading={lists.isLoading && nativeAvailable} listsError={lists.error} onRetryLists={() => void lists.refetch()} fixedListId={fixedListId} fixedListName={scopeName}
      onDraftChange={next => { if (!isGuarded() && !selectingRef.current) setFilterDraft(next); }} onCancel={() => setFilterDraft(null)}
      onApply={() => { if (filterDraft && commitFilters(filterDraft)) setFilterDraft(null); }} />
    <Sheet title={t('m_7739c768203f')} visible={trashHelpOpen} onClose={() => setTrashHelpOpen(false)}>
      <Copy>{t('m_e68ea9b473e4')}</Copy>
      <Copy muted size={14}>{t('m_6b013f84e5e1')}</Copy>
      <Copy muted size={14}>{t('m_6a85a9b0418d')}</Copy>
    </Sheet>
    <Sheet title={selected?.title ?? t('m_3ddd2c824c07')} visible={!!selected} onClose={() => { if (!isGuarded()) setSelected(null); }}>
      {view === 'completed' && <SettingRow label={selected?.routine ? t('routine_title') : t('m_a886d1dc4f12')} icon={selected?.routine ? 'fitness_center' : 'undo'} disabled={guarded} onPress={() => { if (selected?.routine) { const item = selected; setSelected(null); open(item); } else if (selected) update(selected, 'Reopen'); }} />}
      <SettingRow label={view === 'completed' ? t('m_9adcdf33dce1') : t('m_a76e13b98392')} icon={view === 'completed' ? 'delete' : 'restore'} disabled={guarded} onPress={() => { if (selected) update(selected, view === 'completed' ? 'Delete' : 'UndoDelete'); }} />
      {view === 'deleted' && <SettingRow label={t('m_280b10c89cc4')} icon="delete_forever" description={t('m_a3e8748f021d')} disabled={guarded} onPress={() => { if (selected) requestPurge([selected], false); }} />}
    </Sheet>
    <PurgeConfirmation items={purgeItems} onCancel={() => setPurgeItems([])} onConfirm={confirmPurge} />
  </Page>;
}
