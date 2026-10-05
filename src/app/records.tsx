import { useInfiniteQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Copy, Page, Toggle } from '../ui/components';
import { engine, nativeAvailable, useCommand } from '../ui/native';
import { ReminderRow } from '../ui/reminder-row';
export default function Records() {
  const params = useLocalSearchParams<{ view: string }>(), view = params.view === 'deleted' ? 'deleted' : 'completed';
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const command = useCommand();
  const query = useInfiniteQuery({ queryKey: ['reminders', view, includeSkipped], enabled: nativeAvailable, initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => engine().queryReminders({ view, includeSkipped }, pageParam), getNextPageParam: (page) => page.nextCursor });
  return <Page title={view === 'deleted' ? 'Trash' : 'Completed'}>
    {view === 'completed' && <Toggle label="Include skipped occurrences" value={includeSkipped} onChange={setIncludeSkipped} />}
    {query.isLoading && <Copy>Loading…</Copy>}{query.error && <Button label="Retry" onPress={() => void query.refetch()} />}
    {query.data?.pages.flatMap((page) => page.items).map((item) => <ReminderRow key={item.id} item={item}
      onOpen={() => router.push({ pathname: '/reminder/[id]', params: { id: item.id } })}
      onDone={item.skipped && view !== 'deleted' ? undefined : () => command.mutate({ kind: view === 'deleted' ? 'UndoDelete' : 'Reopen', occurrenceId: item.id,
        expectedRevision: item.revision, operationId: engine().createOperationId() })} restore={view === 'deleted'} busy={command.isPending} />)}
    {query.data?.pages[0]?.total === 0 && <Copy muted>{view === 'deleted' ? 'Trash is empty.' : 'No completed reminders.'}</Copy>}
    {query.hasNextPage && <Button label="Load more" variant="secondary" onPress={() => void query.fetchNextPage()} />}
    {command.error && <Copy>{command.error.message}</Copy>}
  </Page>;
}
