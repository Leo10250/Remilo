import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import type {
  CommandResult,
  RoutineAlarmActionRequest,
  RoutineAlarmCommand,
} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, type Tone } from '../domain/actions';
import { CapturedOperation } from '../domain/operation';
import { useLocalizedState, useTranslation } from '../localization/react';
import { ActionFeedback, Button, Sheet } from './components';
import { apply, CommandError, engine } from './native';
import { notify } from './feedback';

type Action = 'start' | 'snooze' | 'dismiss';
type Job = { command: RoutineAlarmCommand; action: Action };

export function RoutineAlarmActions({
  capture,
  onClose,
}: {
  capture: RoutineAlarmActionRequest;
  onClose: () => void;
}) {
  const t = useTranslation();
  const client = useQueryClient();
  const [operation] = useState(
    () =>
      new CapturedOperation<Job, CommandResult>(
        (job) => apply(job.command),
        (error) => error instanceof CommandError,
      ),
  );
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [settled, setSettled] = useState(false);
  const [snoozeChanged, setSnoozeChanged] = useState(false);
  const [openedAt] = useState(Date.now);
  const [feedback, setFeedback] = useLocalizedState<{ message: string; tone: Tone }>();
  const snoozeUnavailable = openedAt + capture.expectedSnoozeMinutes * 60_000 >= capture.closesAtMs;

  const submit = async (job: Job) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const result = await operation.run(job);
      if (result.status === 'Applied' || result.status === 'Scheduled') {
        if (job.action === 'start') {
          router.navigate({
            pathname: '/routine-session',
            params: { id: capture.routineId, date: capture.date },
          });
        } else if (job.action === 'snooze') {
          notify({ message: t('m_5550d1a27260'), tone: 'success' });
        }
        onClose();
      } else {
        setSettled(true);
        setFeedback(commandFeedback(result, ''));
      }
    } catch (error) {
      if (error instanceof CommandError) {
        if (error.code === 'STALE_SNOOZE') {
          setSnoozeChanged(true);
          setFeedback({ message: t('m_77e7bd27b278'), tone: 'warning' });
        } else if (
          error.code === 'DAY_ENDED' &&
          job.action === 'snooze' &&
          Date.now() < capture.closesAtMs
        ) {
          setSnoozeChanged(true);
          setFeedback({ message: t('routine_snooze_day_end'), tone: 'warning' });
        } else {
          setSettled(true);
          setFeedback({ message: t('m_47061ba3e427'), tone: 'warning' });
        }
      } else {
        setFeedback({ message: t('m_df24f6cb25c5'), tone: 'warning' });
      }
    } finally {
      running.current = false;
      setBusy(false);
      void client.invalidateQueries();
    }
  };
  const choose = (action: Action) => {
    if (settled || operation.pending || running.current) return;
    const common = {
      occurrenceId: capture.occurrenceId,
      date: capture.date,
      expectedGeneration: capture.expectedGeneration,
      expectedSessionId: capture.expectedSessionId,
      operationId: engine().createOperationId(),
    };
    const command: RoutineAlarmCommand =
      action === 'snooze'
        ? {
            ...common,
            kind: 'SnoozeRoutineAlarm',
            expectedSnoozeMinutes: capture.expectedSnoozeMinutes,
          }
        : { ...common, kind: 'DismissRoutineAlarm' };
    void submit({ action, command });
  };
  const retry = operation.captured;
  const disabled = busy || !!retry || settled;

  return (
    <Sheet
      title={t('m_8c648567f73c')}
      visible
      onClose={() => {
        if (!running.current && !operation.pending) onClose();
      }}
    >
      <View style={{ gap: 8 }}>
        <Button
          label={t('routine_alarm_start')}
          disabled={disabled}
          onPress={() => choose('start')}
        />
        <Button
          label={t('m_ba743825e921', { arg0: capture.expectedSnoozeMinutes })}
          variant="secondary"
          disabled={disabled || snoozeUnavailable || snoozeChanged}
          onPress={() => choose('snooze')}
        />
        <Button
          label={t('routine_alarm_dismiss')}
          variant="neutral"
          disabled={disabled}
          onPress={() => choose('dismiss')}
        />
        <ActionFeedback
          loading={busy}
          message={
            feedback?.message ?? (snoozeUnavailable ? t('routine_snooze_day_end') : undefined)
          }
          tone={feedback?.tone}
        />
        {!!retry && !busy && (
          <Button label={t('widget_retry_same_action')} onPress={() => void submit(retry)} />
        )}
      </View>
    </Sheet>
  );
}
