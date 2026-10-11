import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ListRecord } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { creationOrigin, originParams, type OriginParams } from '../../domain/navigation';
import { ActionFeedback, AtmosphericHeader, Button, ConnectedGroup, Copy, Icon, IconButton, Page, QueryState, SettingRow, Sheet, Status } from '../../ui/components';
import { CommandRecovery, ListNameSheet, RootMore, RootNavigation, RootNotice, useCapturedCommand, useDestinationNavigation } from '../../ui/navigation';
import { engine, nativeAvailable } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAppearanceConfirmation } from '../../ui/confirmation';
import { space } from '../../ui/tokens';

export default function Lists() { return <ListLibrary />; }
export function ManageLists() { return <ListLibrary management />; }
function ListLibrary({ management = false }: { management?: boolean }) {
  const confirm = useAppearanceConfirmation();
  const params = useLocalSearchParams<OriginParams>(), origin = creationOrigin(params);
  const query = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const noList = useQuery({ queryKey: ['no-list-overdue'], queryFn: () => engine().queryReminders({ view: 'overdue', listId: null }, null), enabled: nativeAvailable && !management });
  const [editing, setEditing] = useState<ListRecord | 'create' | null>(null), [selected, setSelected] = useState<ListRecord | null>(null), [formGuarded, setFormGuarded] = useState(false);
  const [footerHeight, setFooterHeight] = useState(64), insets = useSafeAreaInsets(), colors = useTheme();
  const action = useCapturedCommand();
  const guarded = action.guarded || formGuarded;
  const groupFeedback = (!!query.error && !!query.data || !management && !!noList.error) ? <>
    {!!query.error && !!query.data && <Copy muted>Showing previously loaded lists.</Copy>}
    {!management && !!noList.error && <><ActionFeedback message={noList.data ? 'Could not refresh the No list count. Showing the previous count.' : 'Could not check the No list overdue count.'} tone="danger" />
      <Button label="Retry No list count" variant="secondary" onPress={() => void noList.refetch()} /></>}
  </> : undefined;
  const back = useDestinationNavigation({ kind: 'lists' }, () => {
    if (selected) { setSelected(null); return true; }
    if (editing) { setEditing(null); return true; }
    return false;
  }, guarded, management ? origin : undefined);
  const open = (id: string | null) => router.push({ pathname: '/lists/[id]', params: { id: id ?? 'none', ...(id === null ? { noList: 'true' } : {}), ...originParams({ kind: 'lists' }) } });
  const remove = (list: ListRecord) => { setSelected(null); confirm('Remove list?', 'Reminders in “' + list.name + '” move to No list. Their schedules and completion stay the same.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove list', style: 'destructive', onPress: () => void action.execute({ command: { kind: 'RemoveList', listId: list.id, expectedRevision: list.revision, operationId: engine().createOperationId() }, success: 'List removed. Reminders moved to No list.' }) }]); };
  const row = (name: string, id: string | null, count: number, record?: ListRecord) => <View key={'list:' + JSON.stringify(id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ flex: 1 }}><SettingRow label={name} icon="checklist" minHeight={72} disabled={guarded || !nativeAvailable}
      statusLabel={count ? count + ' overdue occurrences' : undefined} supporting={count > 0 ? <Status label={count + ' overdue'} tone="warning" /> : undefined}
      onPress={() => open(id)} /></View>
    {record && <IconButton icon="more_vert" label={'More actions for ' + name} disabled={guarded || !nativeAvailable} onPress={() => setSelected(record)} />}
  </View>;
  return <View style={{ flex: 1 }}>
    <Page compact={management} title={management ? 'Manage lists' : 'Lists'} back={management} onBack={back} scrollKey={management ? 'manage-lists' : 'lists'} scrollReady={!query.isLoading}
      header={<AtmosphericHeader title={management ? 'Manage lists' : 'Lists'} back={management} onBack={back} actions={!management ? <RootMore origin={{ kind: 'lists' }} disabled={guarded} /> : undefined} />}
      footer={<View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}><CommandRecovery action={action} /><RootNotice />{!management && <RootNavigation destination="lists" disabled={guarded} />}</View>}>
      <View style={{ gap: space.md }}>
      {management && <><Copy muted>No list is the default. Lists organize reminders without changing their alerts.</Copy>
        <Button label="Create new list" icon="add" disabled={!nativeAvailable || guarded} onPress={() => setEditing('create')} /></>}
      {!management && <ConnectedGroup title="Built-in views"><SettingRow key="repeats" label="Repeats" icon="repeat" description="Manage recurring reminders" disabled={guarded || !nativeAvailable}
        onPress={() => router.push({ pathname: '/series', params: originParams({ kind: 'repeats' }) })} /></ConnectedGroup>}
      <QueryState loading={query.isLoading && nativeAvailable} error={query.error}
        empty={!nativeAvailable || management && !query.data?.length} emptyMessage={!nativeAvailable ? 'Use the Android app to manage lists.' : 'No named lists yet.'} onRetry={() => void query.refetch()} />
      {management ? <ConnectedGroup footer={groupFeedback}>{query.data?.map((list) => <SettingRow key={list.id} label={list.name} icon="checklist" minHeight={72} disabled={guarded} onPress={() => setSelected(list)} />)}</ConnectedGroup> :
        <ConnectedGroup title="Your lists" footer={groupFeedback}>{row('No list', null, noList.data?.total ?? 0)}{query.data?.map((list) => row(list.name, list.id, list.overdueCount, list))}</ConnectedGroup>}
      {!management && <View style={{ height: 88 }} />}
      </View>
    </Page>
    {!management && <Pressable accessibilityRole="button" accessibilityLabel="Create list" accessibilityState={{ disabled: guarded || !nativeAvailable }} disabled={guarded || !nativeAvailable}
      onPress={() => setEditing('create')} style={{ position: 'absolute', right: 16, bottom: footerHeight + insets.bottom + 16, width: 56, height: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 3 }}>
      <Icon name="add" color={colors.accentInk} size={28} /></Pressable>}
    <Sheet title={selected?.name ?? 'List actions'} visible={!!selected} onClose={() => setSelected(null)}>
      <SettingRow label="Rename list" icon="edit" disabled={guarded} onPress={() => { setEditing(selected); setSelected(null); }} />
      <SettingRow label="Remove list" icon="delete" disabled={guarded} onPress={() => { if (selected) remove(selected); }} />
    </Sheet>
    {!!editing && <ListNameSheet key={editing === 'create' ? 'create' : editing.id} visible list={editing === 'create' ? undefined : editing} onGuardChange={setFormGuarded}
      onClose={() => setEditing(null)} onSaved={(id) => { const created = editing === 'create'; setEditing(null); if (created && !management) open(id); }} />}
  </View>;
}
