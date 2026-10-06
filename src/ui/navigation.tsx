import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { rootKey, rootRoute, type RootDestination } from '../domain/navigation';
import { Button, Choice, Copy, Field, Group, Icon, IconButton, QueryState, SettingRow, Sheet, Snackbar, type IconName } from './components';
import { dismissNotice, notify, useNotice, type Notice } from './feedback';
import { apply, CommandError, engine, nativeAvailable, useCommand } from './native';
import type { CommandResult, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, restoreDeleted } from '../domain/actions';
import { useTheme } from './theme';

export function switchRoot(destination: RootDestination) { if (router.canDismiss()) router.dismissAll(); router.replace(rootRoute(destination)); }
export function returnToOrigin(destination: RootDestination) { switchRoot(destination); }
export function notifyTrash(item: Occurrence, result: CommandResult) {
  const deleted = result.occurrence;
  notify({ message: 'Moved to Trash', ...(deleted?.id === item.id && deleted.deleted ? { action: { label: 'Undo', undoDelete: { id: item.id, revision: deleted.revision, operationId: engine().createOperationId() } } } : {}) });
}
export async function activateNotice(notice: Notice) {
  const captured = notice.action?.undoDelete;
  if (captured) {
    try {
      const latest = await engine().getOccurrence(captured.id), command = restoreDeleted(latest, captured.revision, captured.operationId);
      if (!command) { notify({ message: latest && !latest.deleted ? 'Reminder is already restored' : 'Reminder changed; this deletion can no longer be undone', persistent: true }); return; }
      const result = await apply(command), feedback = commandFeedback(result, 'Reminder restored');
      notify({ ...feedback, persistent: feedback.tone !== 'success' });
    } catch (error) { notify({ message: error instanceof Error ? error.message : 'Could not undo. Retry.', persistent: true, action: notice.action }); }
    return;
  }
  if (notice.action?.occurrenceId) router.push({ pathname: '/reminder/[id]', params: { id: notice.action.occurrenceId } });
  else if (notice.action?.segmentId) router.push({ pathname: '/series/[id]', params: { id: notice.action.segmentId } });
  dismissNotice(notice.id);
}
export function useBrowseNavigation(destination: RootDestination, beforeBack?: () => boolean) {
  const [open, setOpen] = useState(false), key = rootKey(destination);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (open) { setOpen(false); return true; }
      if (beforeBack?.()) return true;
      if (key !== 'agenda') { switchRoot({ kind: 'agenda' }); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [key, open, beforeBack]));
  return { leading: <IconButton icon="menu" label="Browse Remilo" onPress={() => setOpen(true)} />,
    overlay: <BrowseSheet destination={destination} visible={open} onClose={() => setOpen(false)} /> };
}
function BrowseSheet({ destination, visible, onClose }: { destination: RootDestination; visible: boolean; onClose: () => void }) {
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable }), colors = useTheme();
  const [creating, setCreating] = useState(false), [guarded, setGuarded] = useState(false);
  const close = () => { if (guarded) return; if (creating) setCreating(false); else onClose(); };
  const item = (label: string, target: RootDestination, icon: IconName, count?: number) => {
    const selected = rootKey(destination) === rootKey(target);
    const countLabel = count ? `${count} overdue occurrence${count === 1 ? '' : 's'}` : '';
    return <Pressable key={rootKey(target)} accessibilityRole="button" accessibilityLabel={label + (countLabel ? ', ' + countLabel : '')}
      accessibilityState={{ selected }} onPress={() => { onClose(); if (!selected) switchRoot(target); }}
      style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: selected || pressed ? colors.soft : 'transparent' })}>
      <Icon name={icon} color={selected ? colors.accent : colors.muted} /><View style={{ flex: 1 }}><Copy>{label}</Copy></View>
      {!!countLabel && <View style={{ maxWidth: '45%', flexShrink: 1 }}><Copy muted size={14}>{countLabel}</Copy></View>}{selected && <Icon name="check" color={colors.accent} size={20} />}
    </Pressable>;
  };
  return <Sheet title={creating ? 'Create list' : 'Browse'} visible={visible} onClose={close}>
    {creating ? <ListNameForm onGuardChange={setGuarded} onCancel={() => setCreating(false)} onSaved={(id) => { setCreating(false); onClose(); switchRoot({ kind: 'list', listId: id }); }} /> : <>
    <Group title="Reminders">{item('Agenda', { kind: 'agenda' }, 'event')}{item('Repeats', { kind: 'repeats' }, 'repeat')}</Group>
    <Group title="Lists">{item('No list', { kind: 'list', listId: null }, 'checklist')}
      <QueryState loading={lists.isLoading && nativeAvailable} error={lists.error} onRetry={() => void lists.refetch()} />
      {lists.data?.map((list) => item(list.name, { kind: 'list', listId: list.id }, 'checklist', list.overdueCount))}
      <SettingRow label="Create list" icon="add" onPress={() => setCreating(true)} />
      <SettingRow label="Manage lists" icon="edit" onPress={() => { onClose(); router.push('/lists'); }} />
    </Group>
    <Group title="History">{item('Completed', { kind: 'completed' }, 'check_circle')}{item('Trash', { kind: 'trash' }, 'delete')}</Group>
    <Group><SettingRow label="Settings" icon="settings" onPress={() => { onClose(); router.push('/settings'); }} /></Group></>}
  </Sheet>;
}
export function RootNotice() {
  const notice = useNotice(), client = useQueryClient();
  if (!notice) return null;
  return <Snackbar message={notice.message} action={notice.action?.label} persistent={notice.persistent}
    onAction={() => { void activateNotice(notice).finally(() => { void client.invalidateQueries(); }); }}
    onClose={() => dismissNotice(notice.id)} />;
}
export function ListPicker({ value, onChange, disabled = false }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const query = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const [open, setOpen] = useState(false), [create, setCreate] = useState(false), [guarded, setGuarded] = useState(false);
  return <><SettingRow label="List" icon="checklist" value={value === null ? 'No list' : query.data?.find((list) => list.id === value)?.name ?? 'List unavailable'} onPress={() => setOpen(true)} disabled={disabled} />
    <Sheet title={create ? 'Create list' : 'Choose list'} visible={open} onClose={() => { if (!guarded) { if (create) setCreate(false); else setOpen(false); } }}>
      {create ? <ListNameForm onGuardChange={setGuarded} onCancel={() => setCreate(false)} onSaved={(id) => { onChange(id); setCreate(false); setOpen(false); }} /> : <>
        <Choice label="No list" selected={value === null} onPress={() => { onChange(null); setOpen(false); }} />
        <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
        {query.data?.map((list) => <Choice key={list.id} label={list.name} selected={value === list.id} onPress={() => { onChange(list.id); setOpen(false); }} />)}
        <Button label="Create new list" icon="add" variant="secondary" onPress={() => setCreate(true)} />
      </>}
    </Sheet>
  </>;
}
export function ListNameForm({ list, onSaved, onCancel, onGuardChange }: { list?: { id: string; name: string; revision: number }; onSaved: (id: string) => void; onCancel: () => void; onGuardChange?: (guarded: boolean) => void }) {
  const [name, setName] = useState(list?.name ?? ''), [error, setError] = useState('');
  const [job, setJob] = useState<Parameters<ReturnType<typeof engine>['applyCommand']>[0]>();
  const command = useCommand();
  useEffect(() => { onGuardChange?.(!!job); return () => onGuardChange?.(false); }, [job, onGuardChange]);
  const save = async () => {
    const operation = job ?? (list ? { kind: 'RenameList' as const, listId: list.id, name, expectedRevision: list.revision, operationId: engine().createOperationId() }
      : { kind: 'CreateList' as const, name, operationId: engine().createOperationId() });
    setJob(operation); setError('');
    try { const result = await command.mutateAsync(operation); setJob(undefined); if (result.list) onSaved(result.list.id); }
    catch (failure) { if (failure instanceof CommandError) setJob(undefined); setError(failure instanceof Error ? failure.message : 'Could not save this list. Retry the same save.'); }
  };
  return <><Field label="List name" autoFocus value={name} onChangeText={setName} maxLength={60} editable={!job} error={error} />
    <Button label={command.isPending ? 'Saving…' : job ? 'Retry save' : list ? 'Rename list' : 'Create list'} disabled={command.isPending || !name.trim()} onPress={() => void save()} />
    <Button label="Cancel" variant="secondary" disabled={!!job} onPress={onCancel} />
    {!!job && !command.isPending && <Copy muted size={14}>The save is unconfirmed. Retry to confirm it before leaving.</Copy>}
  </>;
}
