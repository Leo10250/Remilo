import { useLocale, useTranslation } from '../../localization/react';

import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ListRecord } from '../../../modules/remilo-alarm/src/RemiloAlarm.types';
import { creationOrigin, originParams, type OriginParams } from '../../domain/navigation';
import {
  ActionFeedback,
  AtmosphericHeader,
  Button,
  ConnectedGroup,
  Copy,
  Icon,
  Page,
  QueryState,
  SectionStack,
  SettingRow,
  Sheet,
  SplitDestinationRow,
  Status,
} from '../../ui/components';
import {
  CommandRecovery,
  ListNameSheet,
  RootMore,
  RootNavigation,
  RootNotice,
  useCapturedCommand,
  useDestinationNavigation,
} from '../../ui/navigation';
import { engine, nativeAvailable } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAppearanceConfirmation } from '../../ui/confirmation';
import { space } from '../../ui/tokens';

export default function Lists() {
  'use no memo';
  useLocale();
  return <ListLibrary />;
}
export function ManageLists() {
  'use no memo';
  useLocale();
  return <ListLibrary management />;
}
function ListLibrary({ management = false }: { management?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const confirm = useAppearanceConfirmation();
  const params = useLocalSearchParams<OriginParams>(),
    origin = creationOrigin(params);
  const query = useQuery({
    queryKey: ['lists'],
    queryFn: () => engine().queryLists(),
    enabled: nativeAvailable,
  });
  const noList = useQuery({
    queryKey: ['no-list-overdue'],
    queryFn: () => engine().queryReminders({ view: 'overdue', listId: null }, null),
    enabled: nativeAvailable && !management,
  });
  const [editing, setEditing] = useState<ListRecord | 'create' | null>(null),
    [selected, setSelected] = useState<ListRecord | null>(null),
    [formGuarded, setFormGuarded] = useState(false);
  const menuTrigger = useRef<View>(null);
  const menuButtons = useRef(new Map<string, View>());
  const createTrigger = useRef<View>(null);
  const [footerHeight, setFooterHeight] = useState(64),
    insets = useSafeAreaInsets(),
    colors = useTheme();
  const action = useCapturedCommand();
  const guarded = action.guarded || formGuarded;
  const groupFeedback =
    (!!query.error && !!query.data) || (!management && !!noList.error) ? (
      <>
        {!!query.error && !!query.data && <Copy muted>{t('m_681249f877d8')}</Copy>}
        {!management && !!noList.error && (
          <>
            <ActionFeedback
              message={noList.data ? t('m_fbdcfe720b26') : t('m_958b2d3a27c2')}
              tone="danger"
            />
            <Button
              label={t('m_95f979075b92')}
              variant="secondary"
              onPress={() => void noList.refetch()}
            />
          </>
        )}
      </>
    ) : undefined;
  const back = useDestinationNavigation(
    { kind: 'lists' },
    () => {
      if (selected) {
        setSelected(null);
        return true;
      }
      if (editing) {
        setEditing(null);
        return true;
      }
      return false;
    },
    guarded,
    management ? origin : undefined,
  );
  const open = (id: string | null) =>
    router.push({
      pathname: '/lists/[id]',
      params: {
        id: id ?? 'none',
        ...(id === null ? { noList: 'true' } : {}),
        ...originParams({ kind: 'lists' }),
      },
    });
  const remove = (list: ListRecord) => {
    setSelected(null);
    confirm(t('m_0c08198f562b'), t('remove_list_confirmation', { name: list.name }), [
      { text: t('m_19766ed6ccb2'), style: 'cancel' },
      {
        text: t('m_669f24b0f91d'),
        style: 'destructive',
        onPress: () =>
          void action.execute({
            command: {
              kind: 'RemoveList',
              listId: list.id,
              expectedRevision: list.revision,
              operationId: engine().createOperationId(),
            },
            success: t('m_3e8157774f26'),
          }),
      },
    ]);
  };
  const rememberMenuButton = (id: string, node: View | null) => {
    if (node) menuButtons.current.set(id, node);
    else menuButtons.current.delete(id);
  };
  const showMenu = (record: ListRecord) => {
    menuTrigger.current = menuButtons.current.get(record.id) ?? null;
    setSelected(record);
  };
  const row = (name: string, id: string | null, count: number, record?: ListRecord) => {
    const props = {
      label: name,
      icon: 'checklist' as const,
      disabled: guarded || !nativeAvailable,
      statusLabel: count > 0 ? t('ui_list_overdue_spoken_count', { count }) : undefined,
      supporting:
        count > 0 ? (
          <Status label={t('ui_list_overdue_count', { count })} tone="warning" />
        ) : undefined,
      onPress: () => open(id),
    };
    return record ? (
      <SplitDestinationRow
        key={record.id}
        {...props}
        overflowLabel={t('ui_more_actions', { name })}
        overflowButtonRef={(node) => rememberMenuButton(record.id, node)}
        onOverflowPress={() => showMenu(record)}
      />
    ) : (
      <SettingRow key="no-list" intent="navigation" {...props} />
    );
  };
  return (
    <View style={{ flex: 1 }}>
      <Page
        compact={management}
        title={management ? t('m_ab81e9366bfe') : t('m_308d5a0903f2')}
        back={management}
        onBack={back}
        scrollKey={management ? 'manage-lists' : 'lists'}
        scrollReady={!query.isLoading}
        header={
          <AtmosphericHeader
            title={management ? t('m_ab81e9366bfe') : t('m_308d5a0903f2')}
            back={management}
            onBack={back}
            actions={
              !management ? <RootMore origin={{ kind: 'lists' }} disabled={guarded} /> : undefined
            }
          />
        }
        footer={
          <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
            <CommandRecovery action={action} />
            <RootNotice />
            {!management && (
              <RootNavigation
                destination="lists"
                disabled={guarded}
                isGuarded={() => action.isGuarded() || formGuarded}
              />
            )}
          </View>
        }
      >
        <SectionStack>
          {management && (
            <View style={{ gap: space.sm }}>
              <Copy muted>{t('m_6395ef0c2432')}</Copy>
              <Button
                label={t('m_3fb9aa9bdbb5')}
                icon="add"
                buttonRef={createTrigger}
                disabled={!nativeAvailable || guarded}
                onPress={() => setEditing('create')}
              />
            </View>
          )}
          {!management && (
            <ConnectedGroup title={t('m_ff3b424445ad')}>
              <SettingRow
                intent="navigation"
                key="repeats"
                label={t('m_92ee0233f013')}
                icon="repeat"
                description={t('ui_repeats_summary')}
                disabled={guarded || !nativeAvailable}
                onPress={() =>
                  router.push({ pathname: '/series', params: originParams({ kind: 'repeats' }) })
                }
              />
              <SettingRow
                intent="navigation"
                key="routines"
                label={t('routine_library')}
                icon="format_list_numbered"
                description={t('ui_routines_summary')}
                disabled={guarded || !nativeAvailable}
                onPress={() => router.push('/routines')}
              />
            </ConnectedGroup>
          )}
          <QueryState
            loading={query.isLoading && nativeAvailable}
            error={query.error}
            empty={!nativeAvailable || (management && !query.data?.length)}
            emptyMessage={!nativeAvailable ? t('m_76edd8d2cf44') : t('m_230fe389ffc2')}
            onRetry={() => void query.refetch()}
          />
          {management ? (
            <ConnectedGroup footer={groupFeedback}>
              {query.data?.map((list) => (
                <SettingRow
                  intent="action"
                  key={list.id}
                  label={list.name}
                  icon="checklist"
                  disabled={guarded}
                  buttonRef={(node) => rememberMenuButton(list.id, node)}
                  onPress={() => showMenu(list)}
                />
              ))}
            </ConnectedGroup>
          ) : (
            <ConnectedGroup title={t('m_b3d21ebfbaf7')} footer={groupFeedback}>
              {row(t('m_eacd31d849f9'), null, noList.data?.total ?? 0)}
              {query.data?.map((list) => row(list.name, list.id, list.overdueCount, list))}
            </ConnectedGroup>
          )}
          {!management && <View style={{ height: 88 }} />}
        </SectionStack>
      </Page>
      {!management && (
        <Pressable
          ref={createTrigger}
          accessibilityRole="button"
          accessibilityLabel={t('m_4408d1a48e1e')}
          accessibilityState={{ disabled: guarded || !nativeAvailable }}
          disabled={guarded || !nativeAvailable}
          onPress={() => setEditing('create')}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 16,
            bottom: footerHeight + insets.bottom + 16,
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 3,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name="add" color={colors.accentInk} size={28} />
        </Pressable>
      )}
      <Sheet
        title={selected?.name ?? t('m_abc46aaef9ad')}
        visible={!!selected}
        onClose={() => setSelected(null)}
        returnFocusRef={editing ? undefined : menuTrigger}
      >
        <SettingRow
          intent="action"
          label={t('m_e01205cfdbd9')}
          icon="edit"
          disabled={guarded}
          onPress={() => {
            setEditing(selected);
            setSelected(null);
          }}
        />
        <SettingRow
          intent="action"
          label={t('m_669f24b0f91d')}
          icon="delete"
          disabled={guarded}
          onPress={() => {
            if (selected) remove(selected);
          }}
        />
      </Sheet>
      {!!editing && (
        <ListNameSheet
          key={editing === 'create' ? 'create' : editing.id}
          visible
          list={editing === 'create' ? undefined : editing}
          onGuardChange={setFormGuarded}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            const created = editing === 'create';
            setEditing(null);
            if (created && !management) open(id);
          }}
        />
      )}
    </View>
  );
}
