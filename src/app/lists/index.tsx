import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';
import { Alert, BackHandler } from 'react-native';
import type { ListCommand, ListRecord } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { ActionFeedback, Button, Copy, Group, Page, QueryState, SettingRow, Sheet } from '../../ui/components';
import { ListNameForm } from '../../ui/navigation';
import { CommandError, engine, nativeAvailable, useCommand } from '../../ui/native';
export default function Lists() {
  const query = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const [editing, setEditing] = useState<ListRecord | 'create' | null>(null), [selected, setSelected] = useState<ListRecord | null>(null), [message, setMessage] = useState('');
  const [guarded, setGuarded] = useState(false), [removal, setRemoval] = useState<ListCommand | null>(null);
  const command = useCommand();
  usePreventRemove(guarded || !!removal, () => Alert.alert('List update is unconfirmed', 'Retry the update to confirm it before leaving.'));
  const back = useCallback(() => {
    if (guarded || removal) return;
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, [guarded, removal]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (guarded || removal) return true; return false; });
    return () => subscription.remove();
  }, [guarded, removal]));
  const executeRemoval = async (job: ListCommand) => {
    setSelected(null); setRemoval(job);
    try { await command.mutateAsync(job); setRemoval(null); setMessage('List removed. Reminders moved to No list.'); }
    catch (error) { if (error instanceof CommandError) setRemoval(null); setMessage(error instanceof Error ? error.message : 'Removal is unconfirmed. Retry to confirm it before leaving.'); }
  };
  const remove = (list: ListRecord) => Alert.alert('Remove list?', `Reminders in “${list.name}” move to No list. Their schedules and completion stay the same.`, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove list', style: 'destructive', onPress: () => void executeRemoval({ kind: 'RemoveList', listId: list.id, expectedRevision: list.revision, operationId: engine().createOperationId() }) },
  ]);
  return <Page title="Manage lists" onBack={back}>
    <Copy muted>No list is the default. Lists organize reminders without changing their alerts.</Copy>
    <Button label="Create new list" icon="add" onPress={() => setEditing('create')} disabled={command.isPending || !!removal} />
    <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length} emptyMessage="No named lists yet." onRetry={() => void query.refetch()} />
    <Group>{query.data?.map((list) => <SettingRow key={list.id} label={list.name} icon="checklist" disabled={!!removal} onPress={() => setSelected(list)} />)}</Group>
    <ActionFeedback message={command.isPending ? 'Updating lists…' : message} loading={command.isPending} />
    {!!removal && !command.isPending && <><Copy muted size={14}>Removal is unconfirmed. Retry to confirm it before leaving.</Copy><Button label="Retry removal" onPress={() => void executeRemoval(removal)} /></>}
    <Sheet title={selected?.name ?? 'List actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="Rename list" icon="edit" onPress={() => { setEditing(selected); setSelected(null); }} />
      <SettingRow label="Remove list" icon="delete" onPress={() => { if (selected) remove(selected); }} disabled={command.isPending} />
    </Sheet>
    <Sheet title={editing === 'create' ? 'Create list' : 'Rename list'} visible={!!editing} onClose={() => { if (!guarded) setEditing(null); }}>
      {!!editing && <ListNameForm key={editing === 'create' ? 'create' : editing.id} onGuardChange={setGuarded} list={editing === 'create' ? undefined : editing} onSaved={() => { setEditing(null); setMessage('List saved.'); }} onCancel={() => setEditing(null)} />}
    </Sheet>
  </Page>;
}
