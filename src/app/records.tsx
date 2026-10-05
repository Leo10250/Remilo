import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { Occurrence, ReminderFilter } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, type Tone } from '../domain/actions';
import { ActionFeedback, Button, Choice, Copy, Field, IconButton, Page, QueryState, SettingRow, Sheet, Toggle } from '../ui/components';
import { engine, nativeAvailable, useCommand } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';

export default function Records() {
  const params = useLocalSearchParams<{ view: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed';
  const title = view === 'deleted' ? 'Trash' : 'Completed';
  const [includeSkipped, setIncludeSkipped] = useState(false), [search, setSearch] = useState(''), [listName, setListName] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone }>();
  const command = useCommand();
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const filter = { view, includeSkipped, search, listName } satisfies ReminderFilter;
  const query = useInfiniteQuery({ queryKey: ['reminders', filter], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders(filter, pageParam), getNextPageParam: (page) => page.nextCursor });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const restore = async (item: Occurrence) => {
    if (command.isPending) return;
    setFeedback(undefined);
    try {
      const result = await command.mutateAsync({ kind: view === 'deleted' ? 'UndoDelete' : 'Reopen', occurrenceId: item.id,
        expectedRevision: item.revision, operationId: engine().createOperationId() });
      setFeedback(commandFeedback(result, view === 'deleted' ? 'Reminder restored.' : 'Reminder reopened.'));
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Could not update this reminder. Try again.', tone: 'danger' }); }
  };
  return <Page title={title} actions={<IconButton icon="filter_list" label={`Filter ${title.toLowerCase()}`} onPress={() => setFilterOpen(true)} />}>
    <Field label={`Search ${title.toLowerCase()}`} placeholder="Title or notes" value={search} onChangeText={setSearch} />
    {!!listName && <SettingRow label={`List: ${listName}`} value="Clear" icon="close" onPress={() => setListName('')} />}
    <Copy muted size={14}>{view === 'deleted' ? 'Most recently deleted first. Restore recovers a reminder without replaying past alerts.' : includeSkipped ? 'Most recent completions and skips first.' : 'Most recently completed first.'}</Copy>
    {view === 'completed' && <Toggle label="Include skipped occurrences" value={includeSkipped} onChange={setIncludeSkipped} />}
    <ActionFeedback message={command.isPending ? 'Updating reminder…' : feedback?.message} tone={feedback?.tone} loading={command.isPending} />
    <QueryState loading={query.isLoading} error={query.error} empty={!items.length}
      emptyMessage={!nativeAvailable ? 'Use the Android app to manage reminders.' : search || listName ? 'No reminders match these filters.' : view === 'deleted' ? 'Trash is empty.' : 'No completed reminders.'}
      onRetry={() => void query.refetch()} />
    {items.map((item) => <ReminderRow key={item.id} item={item}
      onOpen={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })}
      onDone={item.skipped && view !== 'deleted' ? undefined : () => void restore(item)} restore={view === 'deleted'} busy={command.isPending} />)}
    {query.hasNextPage && <Button label={query.isFetchingNextPage ? 'Loading more…' : 'Load more'} disabled={query.isFetchingNextPage}
      variant="secondary" onPress={() => void query.fetchNextPage()} />}
    <Sheet title={`Filter ${title.toLowerCase()}`} visible={filterOpen} onClose={() => setFilterOpen(false)}>
      <Choice label="All lists" selected={!listName} onPress={() => { setListName(''); setFilterOpen(false); }} />
      <QueryState loading={lists.isLoading} error={lists.error} onRetry={() => void lists.refetch()} />
      {lists.data?.map((name) => <Choice key={name} label={name} selected={listName === name} onPress={() => { setListName(name); setFilterOpen(false); }} />)}
    </Sheet>
  </Page>;
}
