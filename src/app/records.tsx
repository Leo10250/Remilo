import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import type { Occurrence, ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { collectionKey, creationOrigin, originParams, type DestinationOrigin, type OriginParams } from '../domain/navigation';
import { alertPresentation } from '../domain/presentation';
import { BulkRecovery, useBulkActions } from '../ui/bulk-actions';
import { ActionFeedback, AtmosphericHeader, Button, Choice, Copy, Field, IconButton, Page, QueryState, SettingRow, Sheet, Toggle } from '../ui/components';
import { CommandRecovery, notifyTrash, RootNotice, useCapturedCommand, useDestinationNavigation } from '../ui/navigation';
import { engine, nativeAvailable } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useRootState } from '../ui/root-state';
import { useAppearanceHold } from '../ui/theme';

export default function Records() {
  const params = useLocalSearchParams<OriginParams & { view?: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed', origin = creationOrigin(params);
  return <RecordsContent key={collectionKey(view, origin.kind === 'list' ? origin.listId : undefined)} view={view} origin={origin} />;
}
function RecordsContent({ view, origin }: { view: 'deleted' | 'completed'; origin: DestinationOrigin }) {
  const title = view === 'deleted' ? 'Trash' : 'Completed', scoped = origin.kind === 'list', fixedListId = scoped ? origin.listId : undefined;
  const key = collectionKey(view, fixedListId);
  const [includeSkipped, setIncludeSkipped] = useRootState(key + ':skipped', false), [search, setSearch] = useRootState(key + ':search', ''), [searching, setSearching] = useRootState(key + ':searching', false);
  const [membership, setListId] = useRootState<string | null | undefined>(key + ':list', undefined);
  const [selecting, setSelecting] = useRootState(key + ':selecting', false), [selectionIds, setSelectionIds] = useRootState<string[]>(key + ':selection', []);
  const listId = scoped ? fixedListId : membership;
  const [filterOpen, setFilterOpen] = useState(false), [menuOpen, setMenuOpen] = useState(false), [selected, setSelected] = useState<Occurrence | null>(null);
  const singleRunning = useRef(false), completedBulk = useRef<string | null>(null);
  const action = useCapturedCommand((job, result) => {
    if (job.command.kind === 'Delete' && job.item) notifyTrash(job.item, result);
    const restored = result.occurrence;
    if (job.command.kind === 'UndoDelete' && restored && !restored.completed && !restored.skipped && restored.mode !== 'None' &&
      alertPresentation(restored).target === null && restored.deliveryState !== 'Alerting')
      return 'Reminder restored. No next alert scheduled.';
  });
  const bulk = useBulkActions(), guarded = action.guarded || bulk.guarded;
  const isGuarded = () => singleRunning.current || action.guarded || bulk.isGuarded();
  useAppearanceHold(searching || guarded);
  const exitSelection = () => {
    if (isGuarded()) return;
    setSelecting(false); setSelectionIds([]); setMenuOpen(false); bulk.clear();
  };
  const back = useDestinationNavigation(origin, () => {
    if (isGuarded()) return true;
    if (filterOpen) { setFilterOpen(false); return true; }
    if (selected) { setSelected(null); return true; }
    if (menuOpen) { setMenuOpen(false); return true; }
    if (selecting) { exitSelection(); return true; }
    if (searching) { Keyboard.dismiss(); setSearching(false); return true; }
    return false;
  }, guarded, origin);
  const guardedBack = () => isGuarded() || back();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const scopeName = listId === null ? 'No list' : lists.data?.find((list) => list.id === listId)?.name ?? 'List unavailable';
  const filter = { view, includeSkipped, search, ...(listId !== undefined ? { listId } : {}) } satisfies ReminderFilter;
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
  const update = (item: Occurrence, kind: 'UndoDelete' | 'Reopen' | 'Delete') => {
    if (isGuarded()) return;
    const operationId = engine().createOperationId();
    singleRunning.current = true;
    setSelected(null);
    void action.execute({ command: { kind, occurrenceId: item.id, expectedRevision: item.revision, operationId }, item,
      success: kind === 'UndoDelete' ? item.completed ? 'Restored to Completed.' : item.skipped ? 'Skipped occurrence restored.' : 'Reminder restored.'
        : kind === 'Delete' ? 'Moved to Trash' : 'Reminder reopened.' }).finally(() => { singleRunning.current = false; });
  };
  const open = (item: Occurrence) => { if (!isGuarded()) { Keyboard.dismiss(); router.push({ pathname: '/reminder/[id]', params: { id: item.id, ...originParams(origin), originCollection: view } }); } };
  const clearEditableFilters = () => { if (!scoped && !selecting && !isGuarded()) setListId(undefined); };
  const startSelection = () => {
    if (isGuarded() || !items.length) return;
    Keyboard.dismiss(); setSearching(false); setFilterOpen(false); setSelected(null); setMenuOpen(false); setSelectionIds([]); setSelecting(true); bulk.clear();
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
  const emptyMessage = !nativeAvailable ? 'Use the Android app to manage reminders.' : search || !scoped && listId !== undefined ? 'No matches.' : view === 'deleted' ? 'Trash is empty.' : includeSkipped ? 'No completed or skipped occurrences.' : 'No completed reminders.';
  return <Page title={title} onBack={guardedBack} scrollKey={key} scrollReady={!query.isLoading}
    header={<AtmosphericHeader title={selecting ? selectionIds.length + ' selected' : title} subtitle={selecting ? title + (scoped ? ' · ' + scopeName : '') : scoped ? scopeName : undefined} onBack={guardedBack} actions={<>
      {!selecting && <IconButton icon="search" label={searching ? 'Exit search' : 'Search ' + title.toLowerCase()} disabled={guarded} onPress={() => { if (isGuarded()) return; Keyboard.dismiss(); setSearching(!searching); }} />}
      {!scoped && !selecting && <IconButton icon="filter_list" label={'Filter ' + title.toLowerCase()} disabled={guarded} onPress={() => { if (isGuarded()) return; Keyboard.dismiss(); setFilterOpen(true); }} />}
      <IconButton icon="more_vert" label={selecting ? 'Selection actions' : title + ' actions'} disabled={guarded} onPress={() => { if (isGuarded()) return; Keyboard.dismiss(); setMenuOpen(true); }} />
    </>} />}
    footer={<><CommandRecovery action={action} />
      {selecting && <View style={{ padding: 16, gap: 8 }}>
        <Copy muted size={14}>{guarded && bulk.job ? 'Captured batch: ' + bulk.job.entries.length + (bulk.job.entries.length === 1 ? ' reminder.' : ' reminders.') : selectionIds.length + ' selected of ' + items.length + ' loaded ' + loadedLabel + '.'}</Copy>
        {bulk.guarded && !bulk.busy && <Button label="Retry same batch" onPress={bulk.retry} />}
        {!!selectionIds.length && !bulk.guarded && <>
          <Button label={view === 'deleted' ? 'Restore' : 'Reopen'} accessibilityLabel={view === 'deleted' ? 'Restore selected' : 'Reopen selected'} variant="secondary" disabled={guarded || !selectedItems.length} onPress={() => runBulk(view === 'deleted' ? 'UndoDelete' : 'Reopen')} />
          {view === 'completed' && <Button label="Move to Trash" accessibilityLabel="Move selected to Trash" variant="secondary" disabled={guarded || !selectedItems.length} onPress={() => runBulk('Delete')} />}
        </>}
      </View>}
      <RootNotice disabled={guarded} /></>}>
    {searching && <View style={{ gap: 8 }}><Field autoFocus label={'Search ' + title.toLowerCase()} placeholder="Title or notes" value={search} onChangeText={(value) => { if (!isGuarded() && !selecting) setSearch(value); }} editable={!guarded && !selecting} />
      {!!search && <Button label="Clear search" variant="secondary" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selecting) setSearch(''); }} />}</View>}
    {!!search && !searching && <SettingRow label={'Search: ' + search} value="Clear search" disabled={guarded || selecting} onPress={() => { if (!isGuarded() && !selecting) setSearch(''); }} />}
    {listId !== undefined && <SettingRow label={'List: ' + scopeName} value={scoped ? 'Fixed list' : 'Clear filter'} disabled={guarded || selecting} onPress={scoped ? undefined : clearEditableFilters} />}
    {view === 'completed' && <Toggle label="Include skipped occurrences" value={includeSkipped} disabled={guarded || selecting} onChange={(value) => { if (!isGuarded() && !selecting) setIncludeSkipped(value); }} />}
    {selecting && <Copy muted size={14}>Select reminders using their checkboxes. Select all loaded includes only reminders currently loaded; loading more does not select them.</Copy>}
    <Copy muted size={14}>{view === 'deleted' ? 'Most recently deleted first. Restore keeps completed or skipped state and never replays past alerts.' : 'Most recently completed or skipped first.'}</Copy>
    {view === 'deleted' && <Copy muted size={14}>Items stay here until restored. Backups exclude one-off reminders in Trash; repeating deletion exclusions are retained.</Copy>}
    {selecting && <BulkRecovery action={bulk} />}
    {!!query.error && !!items.length ? <View style={{ gap: 8 }}><ActionFeedback message="Could not refresh. Showing previously loaded information." tone="danger" /><Button label="Retry" variant="secondary" disabled={guarded} onPress={() => { if (!isGuarded()) void query.refetch(); }} /></View> :
      <QueryState loading={query.isLoading && nativeAvailable} error={query.error} empty={!items.length} emptyMessage={emptyMessage} onRetry={() => { if (!isGuarded()) void query.refetch(); }} />}
    {!items.length && (search || !scoped && listId !== undefined) && <Button label={search ? 'Clear search' : 'Clear filters'} variant="secondary" disabled={guarded || selecting} onPress={search ? () => { if (!isGuarded() && !selecting) setSearch(''); } : clearEditableFilters} />}
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
    </Sheet>
    <Sheet title={'Filter ' + title.toLowerCase()} visible={filterOpen} onClose={() => { if (!isGuarded()) setFilterOpen(false); }}>
      <Choice label="All lists" selected={listId === undefined} disabled={guarded || selecting} onPress={() => { if (isGuarded() || selecting) return; setListId(undefined); setFilterOpen(false); }} />
      <Choice label="No list" selected={listId === null} disabled={guarded || selecting} onPress={() => { if (isGuarded() || selecting) return; setListId(null); setFilterOpen(false); }} />
      <QueryState loading={lists.isLoading && nativeAvailable} error={lists.error} onRetry={() => void lists.refetch()} />
      {lists.data?.map((list) => <Choice key={list.id} label={list.name} selected={listId === list.id} disabled={guarded || selecting} onPress={() => { if (isGuarded() || selecting) return; setListId(list.id); setFilterOpen(false); }} />)}
    </Sheet>
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => { if (!isGuarded()) setSelected(null); }}>
      <SettingRow label="View reminder" icon="info" disabled={guarded} onPress={() => { if (isGuarded()) return; if (selected) open(selected); setSelected(null); }} />
      {view === 'completed' && <SettingRow label="Reopen" icon="undo" disabled={guarded} onPress={() => { if (selected) update(selected, 'Reopen'); }} />}
      <SettingRow label={view === 'completed' ? 'Move to Trash' : 'Restore'} icon={view === 'completed' ? 'delete' : 'restore'} disabled={guarded} onPress={() => { if (selected) update(selected, view === 'completed' ? 'Delete' : 'UndoDelete'); }} />
    </Sheet>
  </Page>;
}
