import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from '../localization/react';
import { CommandRecovery, useCapturedCommand } from './navigation';
import { notify } from './feedback';
import { engine, nativeAvailable } from './native';
import { QueryState, SettingRow, Sheet } from './components';
import { WidgetSetupRow } from './widget-setup';

export type RoutineActionTarget = { id: string; date?: string };
/** Mounted by each origin. Opening/closing changes no route or underlying scroll state. */
export function RoutineActions({ target, onClose, onRemoved, onCorrect }: {
  target: RoutineActionTarget | null; onClose: () => void; onRemoved?: () => void; onCorrect?: () => void;
}) {
  const t = useTranslation();
  const plans = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable && !!target });
  const session = useQuery({ queryKey: ['routine-menu-session', target?.id, target?.date], queryFn: () => engine().getRoutineSession(target!.id, target?.date ?? null), enabled: nativeAvailable && !!target });
  const plan = plans.data?.find(p => p.id === target?.id), day = session.data;
  const action = useCapturedCommand((job, result) => {
    if (job.command.kind === 'TrashRoutine' && result.routine) {
      notify({ message: t('routine_trashed'), action: { label: t('routine_undo'), undoRoutineTrash: { id: result.routine.id, revision: result.routine.revision, operationId: engine().createOperationId() } } });
      onClose(); onRemoved?.(); return false;
    }
  });
  const close = () => { if (!action.isGuarded()) onClose(); };
  const navigate = (task: () => void) => { close(); task(); };
  const mutate = (kind: 'TrashRoutine' | 'PauseRoutine' | 'ResumeRoutine') => {
    if (!plan || action.isGuarded()) return;
    void action.execute({ command: { kind, routineId: plan.id, expectedRevision: plan.revision, operationId: engine().createOperationId() }, success: t(kind === 'TrashRoutine' ? 'routine_trashed' : kind === 'PauseRoutine' ? 'routine_paused' : 'routine_ready') });
  };
  return <><CommandRecovery action={action} /><Sheet title={plan?.title ?? t('routine_more')} visible={!!target} onClose={close}>
    <QueryState loading={plans.isLoading && !!target} error={plans.error} empty={!!target && !plans.isLoading && !plan} emptyMessage={t('routine_load_error')} onRetry={() => void plans.refetch()} />
    <CommandRecovery action={action} />
    <SettingRow intent="action" label={t('routine_open_today')} disabled={action.guarded || !plan} onPress={() => navigate(() => router.push({ pathname: '/routine-session', params: { id: target!.id } }))} />
    <SettingRow intent="action" label={t('routine_edit')} icon="edit" disabled={action.guarded || !plan} onPress={() => navigate(() => router.push({ pathname: '/edit', params: { routineId: target!.id } }))} />
    <WidgetSetupRow routineId={target?.id} disabled={action.guarded || !plan} onOpen={close} />
    <SettingRow intent="action" label={t('routine_duplicate')} icon="content_copy" disabled={action.guarded || !plan} onPress={() => navigate(() => router.push({ pathname: '/edit', params: { copyRoutine: target!.id } }))} />
    {day?.occurrenceId && day.totalCount > 0 && !day.ended && !day.skipped && !day.completed && !day.deleted && <SettingRow intent="action" label={t('routine_skip')} icon="block" disabled={action.guarded} onPress={() => {
      void action.execute({ command: { kind: 'SkipRoutineDay', occurrenceId: day.occurrenceId!, date: day.date, expectedRevision: day.revision, operationId: engine().createOperationId() }, success: t('routine_skipped_saved') });
    }} />}
    {onCorrect && day?.ended && <SettingRow intent="action" label={t('routine_correct_checkmarks')} icon="edit" disabled={action.guarded} onPress={() => navigate(onCorrect)} />}
    {plan && <SettingRow intent="action" label={t(plan.state === 'Paused' ? 'routine_resume' : 'routine_pause')} icon={plan.state === 'Paused' ? 'play_arrow' : 'pause'} disabled={action.guarded} onPress={() => mutate(plan.state === 'Paused' ? 'ResumeRoutine' : 'PauseRoutine')} />}
    <SettingRow intent="action" destructive label={t('m_9adcdf33dce1')} icon="delete" description={t('routine_trash_hint')} disabled={action.guarded || !plan} onPress={() => mutate('TrashRoutine')} />
  </Sheet></>;
}
