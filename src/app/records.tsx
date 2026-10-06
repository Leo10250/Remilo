import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Occurrence, ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, type Tone } from '../domain/actions';
import { ActionFeedback, Button, Choice, Copy, Field, IconButton, Page, QueryState, SettingRow, Sheet, Toggle } from '../ui/components';
import { notifyTrash, RootNotice, switchRoot, useBrowseNavigation } from '../ui/navigation';
import { engine, nativeAvailable, useCommand } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
import { useRootState } from '../ui/root-state';
import { creationOrigin, rootKey } from '../domain/navigation';

export default function Records() {
  const params = useLocalSearchParams<{ view: string; originListId?: string; originNoList?: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed';
  const origin = creationOrigin(params), listId = origin.kind === 'list' ? origin.listId : undefined;
  return <RecordsContent key={view + ':' + rootKey(origin)} view={view} originListId={listId} />;
}
function RecordsContent({ view, originListId }: { view: 'deleted' | 'completed'; originListId?: string | null }) {
  const title = view === 'deleted' ? 'Trash' : 'Completed', root = view === 'deleted' ? 'trash' : 'completed', scoped = originListId !== undefined;
  const key = root + (scoped ? ':list:' + JSON.stringify(originListId) : '');
  const navigation = useBrowseNavigation({ kind: root });
  const [includeSkipped, setIncludeSkipped] = useRootState(key + ':skipped', false), [search, setSearch] = useRootState(key + ':search', '');
  const [membership, setListId] = useRootState<string | null | undefined>(key + ':list', undefined);
  const listId = scoped ? originListId : membership;
  const [filterOpen, setFilterOpen] = useState(false), [selected, setSelected] = useState<Occurrence | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone }>();
  const command = useCommand();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const scopeName = listId === null ? 'No list' : lists.data?.find((list) => list.id === listId)?.name ?? 'List unavailable';
  const backToList = useCallback(() => {
    if (!scoped) return;
    if (router.canGoBack()) router.back(); else switchRoot({ kind: 'list', listId: originListId! });
  }, [scoped, originListId]);
  useFocusEffect(useCallback(() => {
    if (!scoped) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { backToList(); return true; });
    return () => subscription.remove();
  }, [scoped, backToList]));
  const filter = { view, includeSkipped, search, ...(listId !== undefined ? { listId } : {}) } satisfies ReminderFilter;
  const query = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const update = async (item: Occurrence, kind: 'UndoDelete' | 'Reopen' | 'Delete') => {
    if (command.isPending) return;
    setSelected(null); setFeedback(undefined);
    try {
      const result = await command.mutateAsync({ kind, occurrenceId: item.id, expectedRevision: item.revision, operationId: engine().createOperationId() });
      if (kind === 'Delete') notifyTrash(item, result);
      else setFeedback(commandFeedback(result, kind === 'UndoDelete' ? item.completed ? 'Restored to Completed.' : item.skipped ? 'Skipped occurrence restored.' : 'Reminder restored.' : 'Reminder reopened.'));
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Could not update this reminder. Try again.', tone: 'danger' }); }
  };
  return <Page title={title} subtitle={scoped ? scopeName : undefined} back={scoped} onBack={backToList} leading={scoped ? undefined : navigation.leading} scrollKey={key} scrollReady={!query.isLoading}
    footer={<>{!scoped && navigation.overlay}<RootNotice /></>} actions={scoped ? undefined : <IconButton icon="filter_list" label={`Filter ${title.toLowerCase()}`} onPress={() => setFilterOpen(true)} />}>
    <Field label={`Search ${title.toLowerCase()}`} placeholder="Title or notes" value={search} onChangeText={setSearch} />
    {!scoped && listId !== undefined && <SettingRow label={'List: ' + scopeName} value="Clear" icon="close" onPress={() => setListId(undefined)} />}
    <Copy muted size={14}>{view === 'deleted' ? 'Most recently deleted first. Restore preserves completion and never replays past alerts.' : includeSkipped ? 'Most recent completions and skips first.' : 'Most recently completed first.'}</Copy>
    {view === 'deleted' && <Copy muted size={14}>Reminders stay here in this local installation until restored. Remilo does not automatically empty Trash. Backups exclude one-off reminders in Trash.</Copy>}
    {view === 'completed' && <Toggle label="Include skipped occurrences" value={includeSkipped} onChange={setIncludeSkipped} />}
    <ActionFeedback message={command.isPending ? 'Updating reminder…' : feedback?.message} tone={feedback?.tone} loading={command.isPending} />
    <QueryState loading={query.isLoading} error={query.error} empty={!items.length}
      emptyMessage={!nativeAvailable ? 'Use the Android app to manage reminders.' : search || listId !== undefined ? 'No reminders match these filters.' : view === 'deleted' ? 'Trash is empty.' : 'No completed reminders.'} onRetry={() => void query.refetch()} />
    {items.map((item) => <ReminderRow key={item.id} item={item} onOpen={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })}
      onDone={() => void update(item, view === 'deleted' ? 'UndoDelete' : 'Reopen')}
      onMore={() => setSelected(item)} onTrash={view === 'completed' ? () => void update(item, 'Delete') : undefined} restore={view === 'deleted'} busy={command.isPending} />)}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading more…' : 'Load more'} disabled={query.isFetchingNextPage} variant="secondary" onPress={() => void query.fetchNextPage()} />}
    <Sheet title={`Filter ${title.toLowerCase()}`} visible={filterOpen} onClose={() => setFilterOpen(false)}>
      <Choice label="All lists" selected={listId === undefined} onPress={() => { setListId(undefined); setFilterOpen(false); }} />
      <Choice label="No list" selected={listId === null} onPress={() => { setListId(null); setFilterOpen(false); }} />
      <QueryState loading={lists.isLoading} error={lists.error} onRetry={() => void lists.refetch()} />
      {lists.data?.map((list) => <Choice key={list.id} label={list.name} selected={listId === list.id} onPress={() => { setListId(list.id); setFilterOpen(false); }} />)}
    </Sheet>
    <Sheet title={selected?.title ?? 'Reminder actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="View reminder" icon="info" onPress={() => { if (selected) router.push({ pathname: '/reminder/[id]', params: { id: selected.id } }); setSelected(null); }} />
      {view === 'completed' && !!selected && <SettingRow label="Reopen" icon="undo" onPress={() => { if (selected) void update(selected, 'Reopen'); }} disabled={command.isPending} />}
      <SettingRow label={view === 'completed' ? 'Move to Trash' : 'Restore'} icon={view === 'completed' ? 'delete' : 'restore'} onPress={() => { if (selected) void update(selected, view === 'completed' ? 'Delete' : 'UndoDelete'); }} disabled={command.isPending} />
    </Sheet>
  </Page>;
}
