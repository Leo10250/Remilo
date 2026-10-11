import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View, type TextInput } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { collectionKey, creationOrigin, originParams, type DestinationOrigin, type OriginParams } from '../domain/navigation';
import { alertPresentation } from '../domain/presentation';
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
  const params = useLocalSearchParams<OriginParams & { view?: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed', origin = creationOrigin(params);
  return <RecordsContent key={collectionKey(view, origin.kind === 'list' ? origin.listId : undefined)} view={view} origin={origin} />;
}
function RecordsContent({ view, origin }: { view: 'deleted' | 'completed'; origin: DestinationOrigin }) {
  const title = view === 'deleted' ? 'Trash' : 'Completed', scoped = origin.kind === 'list', fixedListId = scoped ? origin.listId : undefined;
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
      return 'Reminder restored. No next alert scheduled.';
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
  const scopeName = listId === null ? 'No list' : lists.data?.find((list) => list.id === listId)?.name ?? 'List unavailable';
  const chips = browseFilterChips(view, appliedFilters, lists.data, fixedListId);
  const filter = browseReminderFilter(view, appliedFilters, { view, search, fixedListId });
  const query = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = useMemo(() => [...new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item])).values()], [query.data]);
  const selectedItems = items.filter((item) => selectionIds.includes(item.id));
  const loadedLabel = items.length === 1 ? 'reminder' : 'reminders';
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
      success: kind === 'UndoDelete' ? item.completed ? 'Restored to Completed.' : item.skipped ? 'Skipped occurrence restored.' : 'Reminder restored.'
        : kind === 'Purge' ? 'Reminder permanently deleted.' : kind === 'Delete' ? 'Moved to Trash' : 'Reminder reopened.' }).finally(() => { singleRunning.current = false; });
  };
  const open = (item: Occurrence) => { if (!isGuarded()) { Keyboard.dismiss(); router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...originParams(destination), originCollection: view } }); } };
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
  const emptyMessage = !nativeAvailable ? 'Use the Android app to manage reminders.' : search || !scoped && listId !== undefined ? 'No reminders match these filters.' : view === 'deleted' ? 'Trash is empty.' : appliedFilters.includeSkipped ? 'No completed or skipped reminders.' : 'No completed reminders.';
  return <Page title={title} back={scoped || selecting} onBack={guardedBack} scrollKey={key} scrollReady={!query.isLoading} scrollResetToken={scrollResetToken}
    header={<AtmosphericHeader back={scoped || selecting} title={selecting ? selectionIds.length + ' selected' : title} subtitle={selecting ? title + (scoped ? ' · ' + scopeName : '') : scoped ? scopeName : undefined} onBack={guardedBack} actions={<>
      {!selecting && <IconButton icon="search" label={searching ? 'Exit search' : 'Search ' + title.toLowerCase()} disabled={guarded} onPress={() => {
        if (isGuarded() || selectingRef.current) return; Keyboard.dismiss(); searchFocusRequested.current = !searching;
        if (searching) searchInput.current?.blur(); setSearching(!searching);
      }} />}
      {(view === 'completed' || !scoped) && !selecting && <BrowseFilterButton count={chips.length} disabled={guarded} expanded={filterOpen} onPress={openFilters} />}
      <IconButton icon="more_vert" label={selecting ? 'Selection actions' : title + ' actions'} disabled={guarded} onPress={() => { if (isGuarded()) return; Keyboard.dismiss(); setMenuOpen(true); }} />
    </>} />}
    footer={<><CommandRecovery action={action} />
      {selecting && <View style={{ padding: 16, gap: 8 }}>
        <Copy muted size={14}>{guarded && bulk.job ? 'Captured batch: ' + bulk.job.entries.length + (bulk.job.entries.length === 1 ? ' reminder.' : ' reminders.') : selectionIds.length + ' selected of ' + items.length + ' loaded ' + loadedLabel + '.'}</Copy>
        {bulk.guarded && !bulk.busy && <Button label="Retry same batch" onPress={bulk.retry} />}
        {!!selectionIds.length && !bulk.guarded && <>
          <Button label={view === 'deleted' ? 'Restore' : 'Reopen'} accessibilityLabel={view === 'deleted' ? 'Restore selected' : 'Reopen selected'} variant="secondary" disabled={guarded || !selectedItems.length} onPress={() => runBulk(view === 'deleted' ? 'UndoDelete' : 'Reopen')} />
          {view === 'completed' && <Button label="Move to Trash" accessibilityLabel="Move selected to Trash" variant="secondary" disabled={guarded || !selectedItems.length} onPress={() => runBulk('Delete')} />}
          {view === 'deleted' && <Button label="Delete permanently" accessibilityLabel="Delete selected permanently" variant="danger" disabled={guarded || !selectedItems.length || selectedItems.length !== selectionIds.length} onPress={() => requestPurge(selectedItems, true)} />}
        </>}
      </View>}
      <RootNotice disabled={guarded} />{!selecting && <RootNavigation destination={scoped ? 'lists' : view === 'deleted' ? 'trash' : 'completed'} atRoot={!scoped} disabled={guarded} />}</>}>
    {searching && <View style={{ gap: 8 }}><Field inputRef={searchInput} label={'Search ' + title.toLowerCase()} placeholder="Title or notes" value={search} onChangeText={(value) => { if (!isGuarded() && !selectingRef.current) setSearch(value); }} editable={!guarded && !selecting} />
      {!!search && <Button label="Clear search" variant="secondary" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}</View>}
    {!!search && !searching && <SettingRow label={'Search: ' + search} value="Clear search" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}
    {scoped && <Copy muted size={14}>{'List: ' + scopeName}</Copy>}
    <BrowseFilterChips chips={chips} disabled={guarded || selecting} onRemove={removeFilter} onReset={resetFilters} />
    {selecting && <Copy muted size={14}>Select reminders using their checkboxes. Select all loaded includes only reminders currently loaded; loading more does not select them.</Copy>}
    {view === 'deleted' && <Copy muted size={14}>Kept until restored or permanently deleted.</Copy>}
    {selecting && <BulkRecovery action={bulk} />}
    {!!query.error && !!items.length ? <View style={{ gap: 8 }}><ActionFeedback message="Could not refresh. Showing previously loaded information." tone="danger" /><Button label="Retry" variant="secondary" disabled={guarded} onPress={() => { if (!isGuarded()) void query.refetch(); }} /></View> :
      <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!items.length} emptyMessage={emptyMessage} onRetry={() => { if (!isGuarded()) void query.refetch(); }} />}
    {!items.length && !!search && <Button label="Clear search" variant="secondary" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selectingRef.current) setSearch(''); }} />}
    {!items.length && !!chips.length && <Button label="Reset filters" variant="secondary" disabled={guarded || selecting} onPress={resetFilters} />}
    {items.map((item) => <ReminderRow key={item.id} item={item} onOpen={() => open(item)}
      onMore={() => { if (!isGuarded()) setSelected(item); }} onTrash={!selecting && view === 'completed' ? () => update(item, 'Delete') : undefined}
      restore={view === 'deleted'} busy={guarded} selection={selecting ? { selected: selectionIds.includes(item.id), onToggle: () => toggleSelection(item.id) } : undefined} />)}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading more…' : query.isFetchNextPageError ? 'Retry loading more' : 'Load more'} disabled={guarded || query.isFetchingNextPage} variant="secondary" onPress={() => { if (!isGuarded()) void query.fetchNextPage(); }} />}
    <Sheet title={selecting ? 'Selection actions' : title + ' actions'} visible={menuOpen} onClose={() => { if (!isGuarded()) setMenuOpen(false); }}>
      {selecting ? <>
        <SettingRow label="Select all loaded" description={'Only the ' + items.length + ' currently loaded ' + loadedLabel + '.'} disabled={guarded || !items.length} onPress={() => { if (isGuarded()) return; setSelectionIds(items.map((item) => item.id)); setMenuOpen(false); bulk.clear(); }} />
        <SettingRow label="Clear selection" disabled={guarded || !selectionIds.length} onPress={() => { if (isGuarded()) return; setSelectionIds([]); setMenuOpen(false); bulk.clear(); }} />
        <SettingRow label="Done selecting" disabled={guarded} onPress={exitSelection} />
      </> : <SettingRow label="Select reminders" icon="checklist" disabled={guarded || !items.length} onPress={startSelection} />}
      {!selecting && view === 'deleted' && <SettingRow label="About Trash" icon="info" disabled={guarded} onPress={() => {
        if (isGuarded()) return; setMenuOpen(false); setTrashHelpOpen(true);
      }} />}
      {!selecting && <SettingRow label="Settings" icon="settings" disabled={guarded} onPress={() => {
        if (isGuarded()) return; setMenuOpen(false); router.push({ pathname: '/settings', params: originParams(destination) });
      }} />}
    </Sheet>
    <BrowseFilterSheet title={'Filter ' + title.toLowerCase()} kind={view} draft={filterDraft} disabled={guarded || selecting} lists={lists.data ?? []}
      listsLoading={lists.isLoading && nativeAvailable} listsError={lists.error} onRetryLists={() => void lists.refetch()} fixedListId={fixedListId} fixedListName={scopeName}
      onDraftChange={next => { if (!isGuarded() && !selectingRef.current) setFilterDraft(next); }} onCancel={() => setFilterDraft(null)}
      onApply={() => { if (filterDraft && commitFilters(filterDraft)) setFilterDraft(null); }} />
    <Sheet title="About Trash" visible={trashHelpOpen} onClose={() => setTrashHelpOpen(false)}>
      <Copy>Deleted reminders stay here until restored or permanently deleted.</Copy>
      <Copy muted size={14}>Restore keeps completed or skipped state. Past alerts are not replayed.</Copy>
      <Copy muted size={14}>One-off reminders in Trash are excluded from backups. Repeating deletion exclusions are retained.</Copy>
    </Sheet>
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => { if (!isGuarded()) setSelected(null); }}>
      {view === 'completed' && <SettingRow label="Reopen" icon="undo" disabled={guarded} onPress={() => { if (selected) update(selected, 'Reopen'); }} />}
      <SettingRow label={view === 'completed' ? 'Move to Trash' : 'Restore'} icon={view === 'completed' ? 'delete' : 'restore'} disabled={guarded} onPress={() => { if (selected) update(selected, view === 'completed' ? 'Delete' : 'UndoDelete'); }} />
      {view === 'deleted' && <SettingRow label="Delete permanently" icon="delete_forever" description="Cannot be undone." disabled={guarded} onPress={() => { if (selected) requestPurge([selected], false); }} />}
    </Sheet>
    <PurgeConfirmation items={purgeItems} onCancel={() => setPurgeItems([])} onConfirm={confirmPurge} />
  </Page>;
}
