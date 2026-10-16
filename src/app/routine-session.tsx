import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import type { RoutineCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { WidgetSetupRow } from '../ui/widget-setup';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Button, Card, ConnectedGroup, Copy, Disclosure, IconButton, Page, QueryState, SettingRow, Sheet } from '../ui/components';
import { CommandRecovery, RootNotice, useCapturedCommand } from '../ui/navigation';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeFormatting } from '../ui/time-display';

const stateKeys = { Ready: 'routine_ready', InProgress: 'routine_in_progress', Completed: 'routine_completed', Skipped: 'routine_skipped', NotCompleted: 'routine_not_completed',
  PartiallyCompleted: 'routine_partial', Rest: 'routine_rest', Paused: 'routine_paused', Upcoming: 'routine_upcoming' } as const;

export default function RoutineSessionScreen() {
  const t = useTranslation(), { id, date, history: showHistory, menu: showMenu } = useLocalSearchParams<{ id: string; date?: string; history?: string; menu?: string }>(), client = useQueryClient();
  const { shortDateTime, formatDate } = useTimeFormatting();
  const key = ['routine-session', id, date ?? null];
  const query = useQuery({ queryKey: key, queryFn: () => engine().getRoutineSession(id, date ?? null), enabled: nativeAvailable });
  const plans = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable });
  const session = query.data, plan = plans.data?.find(p => p.id === id);
  const [selected, setSelected] = useState<string>(), [menu, setMenu] = useState(!!showMenu), [history, setHistory] = useState(!!showHistory);
  const [undo, setUndo] = useState<{ stepId: string; completed: boolean } | null>(null);
  const action = useCapturedCommand((job, result) => {
    if (result.routineSession) {
      client.setQueryData(key, result.routineSession);
      const command = job.command;
      if (command.kind === 'SetRoutineExercise' || command.kind === 'CorrectRoutineExercise') {
        setUndo({ stepId: command.stepId!, completed: !command.completed });
        if (command.completed) {
          const current = result.routineSession.steps.findIndex(s => s.id === command.stepId);
          setSelected(result.routineSession.steps.slice(current + 1).find(s => !s.completed)?.id ?? command.stepId);
        }
      }
    }
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch])); // Native resolves midnight/travel on every read.
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ['routine-session'] }); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const remaining = (session?.endsAtMs ?? 0) - Date.now();
    // This timer only refreshes presentation. Native expiry and action guards own correctness.
    const timer = remaining > 0 && remaining < 172800000 ? setTimeout(refresh, remaining + 20) : undefined;
    return () => { subscription.remove(); if (timer) clearTimeout(timer); };
  }, [session?.endsAtMs, client]);
  const historyQuery = useInfiniteQuery({ queryKey: ['routine-history', id], queryFn: ({ pageParam }) => engine().queryRoutineHistory(id, pageParam),
    initialPageParam: null as string | null, getNextPageParam: page => page.nextCursor, enabled: nativeAvailable && history });
  const current = session?.steps.find(s => s.id === selected) ?? session?.steps.find(s => !s.completed) ?? session?.steps[0];
  const currentIndex = session?.steps.findIndex(s => s.id === current?.id) ?? -1;
  const mutate = (kind: Extract<RoutineCommand, { occurrenceId: string }>['kind'], stepId?: string, completed?: boolean) => {
    if (!session?.occurrenceId || action.isGuarded()) return;
    void action.execute({ command: { kind, occurrenceId: session.occurrenceId, date: session.date, expectedRevision: session.revision, stepId, completed, operationId: engine().createOperationId() },
      success: t(kind === 'CorrectRoutineExercise' ? 'routine_correction_saved' : kind === 'SkipRoutineDay' ? 'routine_skipped_saved' : kind === 'UndoSkipRoutineDay' ? 'routine_skip_undone' : 'routine_progress_saved') });
  };
  const changeStep = (stepId: string, completed: boolean) => mutate(session?.ended ? 'CorrectRoutineExercise' : 'SetRoutineExercise', stepId, completed);
  const openToday = () => { setUndo(null); setSelected(undefined); router.replace({ pathname: '/routine-session', params: { id } }); };
  const openPlan = () => { setMenu(false); router.push({ pathname: '/edit', params: { routineId: id } }); };
  const state = session?.state ?? 'Upcoming';
  return <Page title={session?.title ?? t('routine_title')} subtitle={session ? formatDate(new Date(session.date + 'T12:00:00').getTime()) : undefined} footer={<RootNotice disabled={action.guarded} />} actions={<IconButton icon="more_vert" label={t('routine_more')} disabled={action.guarded} onPress={() => setMenu(true)} />}>
    <QueryState loading={query.isLoading} error={query.error} empty={!session && !query.isLoading} emptyMessage={t('routine_load_error')} onRetry={() => void query.refetch()} />
    <CommandRecovery action={action} />
    {session && <View style={{ gap: 12 }}>
      <View accessibilityLiveRegion="polite"><Copy heading>{t(stateKeys[state])}</Copy>
        {!!session.steps.length && <Copy muted>{t('routine_progress', { done: session.completedCount, total: session.totalCount })}</Copy>}</View>
      {session.ended && <><Copy muted>{t('routine_day_ended')}</Copy><Button label={t('routine_open_today')} variant="secondary" onPress={openToday} disabled={action.guarded} /></>}
      {session.deleted && <ActionFeedback message={t('routine_deleted')} tone="warning" />}
      {state === 'Rest' && <Copy muted>{t('routine_rest_hint')}</Copy>}
      {state === 'Paused' && <Copy muted>{t('routine_paused_hint')}</Copy>}
      {session.skipped && !session.ended && <Button label={t('routine_undo_skip')} icon="undo" variant="secondary" disabled={action.guarded || session.deleted} onPress={() => mutate('UndoSkipRoutineDay')} />}
      {current && <Card><View style={{ gap: 12 }}>
        <Copy muted size={14}>{t('routine_focus')}</Copy><Copy heading>{current.name}</Copy>
        {!!current.target && <Copy>{current.target}</Copy>}
        {!!current.notes && <Copy muted>{current.notes}</Copy>}
        <Button label={t(current.completed ? 'routine_undo_completion' : session.ended ? 'routine_correction_done' : 'routine_done')} icon={current.completed ? 'undo' : 'check'}
          disabled={action.guarded || !session.occurrenceId || session.deleted || session.skipped && !session.ended || state === 'Upcoming'} onPress={() => changeStep(current.id, !current.completed)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ flexGrow: 1, flexBasis: 140 }}><Button label={t('routine_previous')} variant="neutral" disabled={currentIndex <= 0 || action.guarded} onPress={() => setSelected(session.steps[currentIndex - 1].id)} /></View>
          <View style={{ flexGrow: 1, flexBasis: 140 }}><Button label={t('routine_next')} variant="neutral" disabled={currentIndex >= session.steps.length - 1 || action.guarded} onPress={() => setSelected(session.steps[currentIndex + 1].id)} /></View>
        </View>
      </View></Card>}
      {undo && <View accessibilityLiveRegion="polite"><Button label={t('routine_undo')} icon="undo" variant="secondary" disabled={action.guarded || session.deleted || session.skipped && !session.ended}
        onPress={() => { setSelected(undo.stepId); changeStep(undo.stepId, undo.completed); setUndo(null); }} /></View>}
      <ConnectedGroup title={t('routine_sequence')}>{session.steps.map(step => <SettingRow key={step.id} label={step.name} description={step.target || undefined}
        icon={step.completed ? 'check_circle' : 'radio_button_unchecked'} value={step.completed ? t('routine_completed') : undefined} disabled={action.guarded} onPress={() => setSelected(step.id)} />)}</ConnectedGroup>
      {!!session.changes?.length && <Disclosure title={t('routine_history_changes')} icon="history">{session.changes.filter(c => c.kind === 'CorrectRoutineExercise').map(change => <View key={change.id}>
        <Copy>{session.steps.find(s => s.id === change.stepId)?.name}</Copy><Copy muted size={14}>{t('routine_correction_at', { time: shortDateTime(change.atMs) })}</Copy>
      </View>)}</Disclosure>}
    </View>}
    <Sheet title={t('routine_more')} visible={menu} onClose={() => setMenu(false)}>
      <WidgetSetupRow routineId={id} disabled={action.guarded || session?.deleted} onOpen={() => setMenu(false)} />
      {session?.occurrenceId && !session.ended && !session.skipped && !session.completed && !session.deleted && <SettingRow label={t('routine_skip')} icon="block" disabled={action.guarded} onPress={() => { setMenu(false); mutate('SkipRoutineDay'); }} />}
      <SettingRow label={t('routine_history')} icon="history" disabled={action.guarded} onPress={() => { setMenu(false); setHistory(true); }} />
      <SettingRow label={t('routine_edit')} icon="edit" disabled={action.guarded} onPress={openPlan} />
      <SettingRow label={t('routine_duplicate')} icon="content_copy" disabled={action.guarded} onPress={() => { setMenu(false); router.push({ pathname: '/edit', params: { copyRoutine: id } }); }} />
      {plan && <SettingRow label={t(plan.state === 'Paused' ? 'routine_resume' : 'routine_pause')} icon={plan.state === 'Paused' ? 'play_arrow' : 'pause'} disabled={action.guarded} onPress={() => {
        setMenu(false); void action.execute({ command: { kind: plan.state === 'Paused' ? 'ResumeRoutine' : 'PauseRoutine', routineId: id, expectedRevision: plan.revision, operationId: engine().createOperationId() }, success: t(plan.state === 'Paused' ? 'routine_ready' : 'routine_paused') });
      }} />}
    </Sheet>
    <Sheet title={t('routine_history')} visible={history} onClose={() => setHistory(false)}>
      <QueryState loading={historyQuery.isLoading} error={historyQuery.error} empty={!historyQuery.data?.pages[0]?.items.length} emptyMessage={t('routine_empty_history')} onRetry={() => void historyQuery.refetch()} />
      <ConnectedGroup>{historyQuery.data?.pages.flatMap(p => p.items).map(past => <SettingRow key={past.occurrenceId} label={formatDate(new Date(past.date + 'T12:00:00').getTime())} value={t(stateKeys[past.state])}
        description={t('routine_progress', { done: past.completedCount, total: past.totalCount })} disabled={action.guarded} onPress={() => { setHistory(false); setUndo(null); setSelected(undefined); router.push({ pathname: '/routine-session', params: { id, date: past.date } }); }} />)}</ConnectedGroup>
      {historyQuery.hasNextPage && <Button label={t('m_964e5f88d036')} variant="secondary" busy={historyQuery.isFetchingNextPage} onPress={() => void historyQuery.fetchNextPage()} />}
    </Sheet>
  </Page>;
}
