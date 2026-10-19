import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useState, type RefObject } from 'react';
import { AppState, Linking, View } from 'react-native';
import type { RoutineCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { nextRoutineFocus, routineDayEnded } from '../domain/routine-focus';
import { routineSessionQueryKey, RoutineSessionViewDates } from '../domain/routine-session-view';
import { routineExerciseEditContext, type RoutineExerciseEditContext } from '../domain/routine-exercise-edit';
import { RoutineExerciseEditSheet } from '../ui/routine-exercise-edit';
import { RoutineSessionContent, type RoutineUndo } from '../ui/routine-focus';
import { RoutineActions } from '../ui/routine-actions';
import { useTranslation } from '../localization/react';
import { exerciseTargetText } from '../domain/exercise-target';
import { ActionFeedback, Button, ConnectedGroup, Copy, Disclosure, IconButton, Page, QueryState, SettingRow, Sheet } from '../ui/components';
import { CommandRecovery, RootNotice, useCapturedCommand } from '../ui/navigation';
import { engine, nativeAvailable } from '../ui/native';
import { useTimeDisplay, useTimeFormatting } from '../ui/time-display';

const stateKeys = { Ready: 'routine_ready', InProgress: 'routine_in_progress', Completed: 'routine_completed', Skipped: 'routine_skipped', NotCompleted: 'routine_not_completed',
  PartiallyCompleted: 'routine_partial', Rest: 'routine_rest', Paused: 'routine_paused', Upcoming: 'routine_upcoming' } as const;

export default function RoutineSessionScreen() {
  const { id, date, stepId } = useLocalSearchParams<{ id: string; date?: string; stepId?: string }>();
  return <RoutineSessionView key={JSON.stringify([id, date, stepId])} />;
}
function RoutineSessionView() {
  'use no memo';
  const t = useTranslation(), { id, date, history: showHistory, menu: showMenu, stepId: requestedStep } = useLocalSearchParams<{ id: string; date?: string; history?: string; menu?: string; stepId?: string }>(), client = useQueryClient();
  const { shortDateTime, formatDate } = useTimeFormatting();
  const { localeTag } = useTimeDisplay();
  const [viewDates] = useState(() => new RoutineSessionViewDates()), [, refreshViewDate] = useState(0), viewId = useId();
  const request = viewDates.request(id, date), key = routineSessionQueryKey(request, viewId);
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const result = await engine().getRoutineSession(request.routineId, request.date);
    if (result && viewDates.resolve(request, result.date)) {
      client.setQueryData(['routine-session', request.routineId, result.date], result);
      refreshViewDate(value => value + 1);
    }
    return result;
  }, enabled: nativeAvailable });
  const session = query.data;
  const historyCorrections = session?.changes?.filter(change => change.kind === 'CorrectRoutineExercise') ?? [];
  const [selected, setSelected] = useState<{ date: string; stepId: string } | undefined>(() => date && requestedStep ? { date, stepId: requestedStep } : undefined), [menu, setMenu] = useState(!!showMenu), [history, setHistory] = useState(!!showHistory);
  const [corrections, setCorrections] = useState(false), [now, setNow] = useState(Date.now);
  const [undo, setUndo] = useState<RoutineUndo | null>(null);
  const [editTarget, setEditTarget] = useState<RoutineExerciseEditContext | null>(null), [editTrigger, setEditTrigger] = useState<RefObject<View | null>>(() => ({ current: null }));
  // An identical launcher link can arrive while this destination is already
  // mounted. Consume the new intent, without reselecting after ordinary Done.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      let destination: URL;
      try { destination = new URL(url); } catch { return; }
      if (destination.protocol !== 'remilo:' || destination.hostname !== 'routine-session' ||
          destination.searchParams.get('id') !== id || destination.searchParams.get('date') !== date) return;
      const stepId = destination.searchParams.get('stepId');
      setSelected(date && stepId ? { date, stepId } : undefined); setUndo(null);
    });
    return () => subscription.remove();
  }, [id, date]);
  const action = useCapturedCommand((job, result) => {
    if (result.status !== 'Applied') return;
    if (result.routineSession) {
      client.setQueryData(key, result.routineSession);
      const command = job.command;
      if (command.kind === 'SetRoutineExercise') {
        const confirmed = result.routineSession, step = confirmed.steps.find(value => value.id === command.stepId);
        if (command.completed && step?.completed) {
          setUndo({ stepId: step.id, name: step.name, date: confirmed.date, revision: confirmed.revision });
          const nextId = nextRoutineFocus(confirmed, step.id);
          setSelected(nextId ? { date: confirmed.date, stepId: nextId } : undefined);
          // The named completion and its Undo stay beside the Focus card.
          return false;
        }
        if (!command.completed) { setUndo(null); setSelected(step ? { date: confirmed.date, stepId: step.id } : undefined); }
      }
    }
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch])); // Native resolves midnight/travel on every read.
  useEffect(() => {
    const refresh = () => { setNow(Date.now()); void client.invalidateQueries({ queryKey: ['routine-session'] }); };
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const remaining = (session?.endsAtMs ?? 0) - Date.now();
    // This timer only refreshes presentation. Native expiry and action guards own correctness.
    const timer = remaining > 0 && remaining < 172800000 ? setTimeout(refresh, remaining + 20) : undefined;
    return () => { subscription.remove(); if (timer) clearTimeout(timer); };
  }, [session?.endsAtMs, client]);
  const historyQuery = useInfiniteQuery({ queryKey: ['routine-history', id], queryFn: ({ pageParam }) => engine().queryRoutineHistory(id, pageParam),
    initialPageParam: null as string | null, getNextPageParam: page => page.nextCursor, enabled: nativeAvailable && history });
  const ended = session ? routineDayEnded(session, now) : false;
  const mutate = (kind: Extract<RoutineCommand, { occurrenceId: string }>['kind'], stepId?: string, completed?: boolean) => {
    if (!session?.occurrenceId || action.isGuarded() || session.deleted) return;
    const closed = routineDayEnded(session, Date.now());
    if (kind === 'CorrectRoutineExercise' ? !closed : closed) return;
    void action.execute({ command: { kind, occurrenceId: session.occurrenceId, date: session.date, expectedRevision: session.revision, stepId, completed, operationId: engine().createOperationId() },
      success: t(kind === 'CorrectRoutineExercise' ? 'routine_correction_saved' : kind === 'SkipRoutineDay' ? 'routine_skipped_saved' : kind === 'UndoSkipRoutineDay' ? 'routine_skip_undone' : 'routine_progress_saved') });
  };
  const changeStep = (stepId: string, completed: boolean) => mutate('SetRoutineExercise', stepId, completed);
  const openToday = () => { setUndo(null); setSelected(undefined); viewDates.openToday(id); refreshViewDate(value => value + 1);
    void client.invalidateQueries({ queryKey: ['routine-session', id, null, viewId] });
    router.replace({ pathname: '/routine-session', params: { id } }); };
  const title = session ? t('routine_dated_title', { day: new Intl.DateTimeFormat(localeTag, { weekday: 'long' }).format(new Date(session.date + 'T12:00:00')) }) : t('routine_title');
  return <Page title={title} footer={<RootNotice disabled={action.guarded} />} actions={<IconButton icon="more_vert" label={t('routine_more')} disabled={action.guarded} onPress={() => setMenu(true)} />}>
    <QueryState loading={query.isLoading} error={query.error} empty={!session && !query.isLoading} emptyMessage={t('routine_load_error')} onRetry={() => void query.refetch()} />
    <CommandRecovery action={action} />
    {session && <View style={{ gap: 12 }}>
      {session.deleted && <ActionFeedback message={t('routine_deleted')} tone="warning" />}
      {session.skipped && !ended && <Button label={t('routine_undo_skip')} icon="undo" variant="secondary" disabled={action.guarded || session.deleted} onPress={() => mutate('UndoSkipRoutineDay')} />}
      <RoutineSessionContent session={session} selectedId={selected?.date === session.date ? selected.stepId : undefined} ended={ended} guarded={action.guarded}
        editDay={new Intl.DateTimeFormat(localeTag, { weekday: 'long' }).format(new Date(session.date + 'T12:00:00'))}
        onEditStep={(stepId, trigger) => { if (!action.isGuarded() && !routineDayEnded(session, Date.now()) && !session.deleted) {
          setEditTrigger(trigger); setEditTarget(routineExerciseEditContext(id, session.date, stepId));
        } }}
        onSelect={stepId => setSelected({ date: session.date, stepId })} onChangeStep={changeStep} undo={undo} onUndo={() => { if (undo?.date === session.date) changeStep(undo.stepId, false); }} onOpenToday={openToday} />
      {historyCorrections.length > 0 && <Disclosure title={t('routine_history_changes')} icon="history">{historyCorrections.map(change => <View key={change.id}>
        <Copy>{session.steps.find(s => s.id === change.stepId)?.name}</Copy><Copy muted size={14}>{t('routine_correction_at', { time: shortDateTime(change.atMs) })}</Copy>
      </View>)}</Disclosure>}
      <ConnectedGroup><SettingRow intent="action" label={t('routine_history')} icon="history" disabled={action.guarded} onPress={() => setHistory(true)} /></ConnectedGroup>
    </View>}
    <RoutineExerciseEditSheet target={editTarget} onClose={() => setEditTarget(null)} returnFocusRef={editTrigger} />
    <RoutineActions target={menu ? { id, date: session?.date ?? date } : null} onClose={() => setMenu(false)} onCorrect={() => setCorrections(true)} onRemoved={() => { if (router.canGoBack()) router.back(); else router.replace('/routines'); }} />
    <Sheet title={t('routine_correct_checkmarks')} visible={corrections} onClose={() => { if (!action.guarded) setCorrections(false); }}>
      <Copy muted>{t('routine_day_ended')}</Copy>
      <CommandRecovery action={action} />
      <ConnectedGroup>{session?.steps.map(step => <View key={step.id} style={{ padding: 16, gap: 8 }}>
        <Copy>{step.name}</Copy>{!!exerciseTargetText(step) && <Copy muted size={14}>{exerciseTargetText(step)}</Copy>}{step.completed && <Copy muted size={14}>{t('routine_completed')}</Copy>}
        <Button label={t(step.completed ? 'routine_undo_completion' : 'routine_correction_done')} variant="secondary" accessibilityLabel={t(step.completed ? 'routine_undo_named' : 'routine_mark_named', { name: step.name })}
          disabled={action.guarded || !ended || session.deleted} onPress={() => mutate('CorrectRoutineExercise', step.id, !step.completed)} />
      </View>)}</ConnectedGroup>
    </Sheet>
    <Sheet title={t('routine_history')} visible={history} onClose={() => setHistory(false)}>
      <QueryState loading={historyQuery.isLoading} error={historyQuery.error} empty={!historyQuery.data?.pages[0]?.items.length} emptyMessage={t('routine_empty_history')} onRetry={() => void historyQuery.refetch()} />
      <ConnectedGroup>{historyQuery.data?.pages.flatMap(p => p.items).map(past => <SettingRow intent="navigation" key={past.occurrenceId} label={formatDate(new Date(past.date + 'T12:00:00').getTime())} value={t(past.state === 'Rest' && past.presentationPreset === 'General' ? 'routine_not_scheduled' : stateKeys[past.state])}
        description={t('routine_progress', { done: past.completedCount, total: past.totalCount })} disabled={action.guarded} onPress={() => { setHistory(false); setUndo(null); setSelected(undefined); router.push({ pathname: '/routine-session', params: { id, date: past.date } }); }} />)}</ConnectedGroup>
      {historyQuery.hasNextPage && <Button label={t('m_964e5f88d036')} variant="secondary" busy={historyQuery.isFetchingNextPage} onPress={() => void historyQuery.fetchNextPage()} />}
    </Sheet>
  </Page>;
}
