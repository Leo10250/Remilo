import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { AppState, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PostponeDraft, type PostponeCapture } from '../domain/postpone';
import { PostponeController, postponeHostPresentation } from '../domain/postpone-controller';
import {
  parsePostponeRequest,
  subscribePostponeLinks,
  takePostponeLink,
  type PostponeRequest,
} from '../domain/postpone-request';
import { commandFeedback, recoveryPresentation } from '../domain/actions';
import { deviceZone } from '../domain/time';
import { ringingMembersRemain } from '../domain/ringing-session';
import { errorText } from '../localization';
import { useTranslation } from '../localization/react';
import { ActionFeedback, BottomActionBar, Button, Copy, Sheet } from './components';
import { engine, iosReminders, nativeAvailable } from './native';
import { PostponeChooser } from './postpone-chooser';
import { useAppearanceConfirmation } from './confirmation';
import { useAppearanceHold } from './theme';
import { useTimeFormatting } from './time-display';
import { notify } from './feedback';
import type { RoutineAlarmActionRequest } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { RoutineAlarmActions } from './routine-alarm-actions';

let homeController: PostponeController | undefined;
const drafts = new WeakMap<PostponeCapture, PostponeDraft>();
function draftFor(capture: PostponeCapture | null) {
  if (!capture) return undefined;
  let draft = drafts.get(capture);
  if (!draft) {
    draft = new PostponeDraft(capture, (input) => engine().resolvePostponeTime(input));
    drafts.set(capture, draft);
  }
  return draft;
}
/** A single in-memory owner survives a Home route replacement during a warm link. */
function getHomeController() {
  return (homeController ??= new PostponeController({
    read: async (request) => {
      const members =
        request.kind === 'Single' ? [{ occurrenceId: request.occurrenceId }] : request.members;
      const [items, settings, capabilities] = await Promise.all([
        Promise.all(members.map((member) => engine().getOccurrence(member.occurrenceId))),
        engine().getSettings(),
        request.kind === 'Group' ? engine().getCapabilities() : Promise.resolve(null),
      ]);
      const sessionId =
        iosReminders &&
        request.kind === 'Group' &&
        ringingMembersRemain(request.members, capabilities?.activeSessionActions)
          ? request.expectedSessionId
          : capabilities?.activeSessionId;
      return { items, settings, sessionId };
    },
    send: (command) => engine().applyCommand(command),
    id: () => engine().createOperationId(),
    now: Date.now,
    zone: deviceZone,
  }));
}

export function NativeDeliveryRequestHost() {
  const [routineAlarm, setRoutineAlarm] = useState<RoutineAlarmActionRequest>();
  const currentRoutineAlarm = useRef<RoutineAlarmActionRequest | undefined>(undefined);
  const presentNext = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (!nativeAvailable) return;
    const module = engine();
    if (!module.takePendingDeliveryRequests) return;
    let reading = false;
    let queued = false;
    let mounted = true;
    type Request = Awaited<
      ReturnType<NonNullable<typeof module.takePendingDeliveryRequests>>
    >[number];
    const pending: Request[] = [];
    const controller = getHomeController();
    const openPostpone = (request: Extract<Request, { kind: 'Single' }>) => {
      const parsed = parsePostponeRequest(JSON.stringify(request));
      if (parsed.kind === 'valid') {
        controller.open(parsed.request, 'home');
        return true;
      }
      if (parsed.kind === 'invalid') controller.invalidRequest();
      return false;
    };
    const present = () => {
      if (
        !mounted ||
        currentRoutineAlarm.current ||
        controller.isGuarded() ||
        AppState.currentState !== 'active'
      )
        return;
      if (pending[0]?.kind === 'RoutineAlarmActions' && controller.snapshot().request) return;
      const request = pending.shift();
      if (request?.kind === 'ReminderActions') {
        router.navigate({ pathname: '/reminder/[id]', params: { id: request.occurrenceId } });
      } else if (iosReminders && request?.kind === 'AlarmReminderActions') {
        router.push({
          pathname: '/reminder/[id]',
          params: {
            id: request.occurrenceId,
            alarmGeneration: String(request.expectedGeneration),
          },
        });
      } else if (request?.kind === 'Routine') {
        router.navigate({
          pathname: '/routine-session',
          params: { id: request.routineId, date: request.date },
        });
      } else if (request?.kind === 'RoutineAlarmActions') {
        currentRoutineAlarm.current = request;
        setRoutineAlarm(request);
      } else if (request?.kind === 'Single' && openPostpone(request) && !controller.isGuarded()) {
        router.navigate('/');
      }
    };
    const receive = () => {
      if (!mounted || (AppState.currentState && AppState.currentState !== 'active')) return;
      if (reading) {
        queued = true;
        return;
      }
      reading = true;
      void module.takePendingDeliveryRequests!()
        .then((requests) => {
          if (!mounted) return;
          let opened = false;
          for (const request of requests) {
            if (
              request.kind === 'RoutineAlarmActions' &&
              (currentRoutineAlarm.current?.expectedSessionId === request.expectedSessionId ||
                pending.some(
                  (next) =>
                    next.kind === 'RoutineAlarmActions' &&
                    next.expectedSessionId === request.expectedSessionId,
                ))
            )
              continue;
            if (request.kind === 'Single' && !currentRoutineAlarm.current) {
              opened = openPostpone(request) || opened;
              continue;
            }
            pending.push(request);
          }
          if (opened && !controller.isGuarded()) router.navigate('/');
          else present();
        })
        .catch(() => getHomeController().invalidRequest())
        .finally(() => {
          reading = false;
          if (queued) {
            queued = false;
            receive();
          }
        });
    };
    const native = module.addListener('onDeliveryRequested', receive);
    const unsubscribe = controller.subscribe(present);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') receive();
    });
    presentNext.current = present;
    receive();
    return () => {
      mounted = false;
      presentNext.current = undefined;
      native.remove();
      app.remove();
      unsubscribe();
    };
  }, []);
  return routineAlarm ? (
    <RoutineAlarmActions
      key={routineAlarm.expectedSessionId}
      capture={routineAlarm}
      onClose={() => {
        currentRoutineAlarm.current = undefined;
        setRoutineAlarm(undefined);
        presentNext.current?.();
      }}
    />
  ) : null;
}

export function usePostponeController() {
  const [controller] = useState(getHomeController);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  );
  const client = useQueryClient(),
    confirm = useAppearanceConfirmation(),
    t = useTranslation();
  const guarded = controller.isGuarded();
  useAppearanceHold(guarded);
  usePreventRemove(guarded, () => {
    void confirm(t('m_62b815b59b7a'), t('m_c4f0744f25b1'));
  });
  useEffect(() => {
    if (!nativeAvailable) return;
    const refresh = () => {
      void controller.refresh();
    };
    refresh();
    const native = engine().addListener('onChange', refresh);
    const app = AppState.addEventListener('change', (value) => {
      if (value === 'active') refresh();
    });
    return () => {
      native.remove();
      app.remove();
    };
  }, [controller]);
  useEffect(() => {
    const receive = () => {
      const event = takePostponeLink();
      if (!event) return;
      const parsed = parsePostponeRequest(event.value);
      if (parsed.kind === 'valid') controller.open(parsed.request, 'home');
      else if (parsed.kind === 'invalid') controller.invalidRequest();
    };
    const stop = subscribePostponeLinks(receive);
    receive();
    return stop;
  }, [controller]);
  useEffect(() => {
    if (state.result) void client.invalidateQueries();
  }, [state.result, client]);
  return {
    controller,
    state,
    guarded,
    open: (request: PostponeRequest) => controller.open(request),
  };
}
export function PostponeHost({
  action,
  returnFocusRef,
  destination = 'home',
  onAlarmSettings,
}: {
  action: ReturnType<typeof usePostponeController>;
  returnFocusRef?: RefObject<View | null>;
  destination?: 'home' | 'details';
  onAlarmSettings?: () => void;
}) {
  const { controller, state } = action,
    focused = useIsFocused(),
    t = useTranslation(),
    { formatTime } = useTimeFormatting();
  const draft = draftFor(state.capture);
  const presentation = postponeHostPresentation(
    state.destination,
    destination,
    focused,
    action.guarded,
  );
  const visible = presentation.visible;
  useEffect(() => {
    if (presentation.navigateHome && state.request) router.navigate('/');
  }, [presentation.navigateHome, state.request]);
  const recovery = recoveryPresentation(
    state.request?.kind === 'Group' ? 'PostponeAll' : 'Postpone',
  );
  const resultFeedback = state.result
    ? commandFeedback(
        state.result,
        t('m_b47059d04e58') +
          (state.capture && state.targetMs != null
            ? formatTime(state.targetMs, state.capture.zoneId)
            : ''),
      )
    : null;
  useEffect(() => {
    if (
      !visible ||
      !state.acknowledged ||
      !state.result ||
      !['Scheduled', 'Applied'].includes(state.result.status) ||
      !resultFeedback
    )
      return;
    notify({ message: resultFeedback.message, tone: resultFeedback.tone });
    controller.close();
  }, [visible, state.acknowledged, state.result, resultFeedback, controller]);
  // The exact chosen target is already visible in the persistent chooser preview.
  const feedback = (
    <>
      {state.uncertain ? (
        <ActionFeedback message={recovery.message} tone="warning" />
      ) : resultFeedback ? (
        <ActionFeedback message={resultFeedback.message} tone={resultFeedback.tone} />
      ) : state.failure === 'stale' ? (
        <ActionFeedback message={t('postpone_stale')} tone="warning" />
      ) : state.failure === 'submit' ? (
        <ActionFeedback message={errorText(state.error, t('m_e47c7ded09d7'))} tone="danger" />
      ) : null}
      {state.queued && <Copy muted>{t('postpone_request_waiting')}</Copy>}
      {state.invalidRequest && (
        <ActionFeedback message={t('postpone_invalid_request')} tone="warning" />
      )}
    </>
  );
  const close = () => {
    controller.close();
  };
  const settings = () => {
    if (controller.close()) {
      if (onAlarmSettings) onAlarmSettings();
      else router.push('/alarm-check');
    }
  };
  return (
    <>
      <Sheet
        visible={visible && !!state.request && !state.capture}
        title={t('postpone_action')}
        onClose={close}
        returnFocusRef={returnFocusRef}
        footer={
          <BottomActionBar>
            {!state.loading && (
              <Button
                label={t('m_942087cc2d41')}
                onPress={() => {
                  void controller.load();
                }}
              />
            )}
            <Button label={t('m_19766ed6ccb2')} variant="secondary" onPress={close} />
          </BottomActionBar>
        }
      >
        <ActionFeedback
          loading={state.loading}
          message={state.failure === 'load' ? t('postpone_load_failed') : undefined}
          tone="danger"
        />
        {state.queued && <Copy muted>{t('postpone_request_waiting')}</Copy>}
      </Sheet>
      <PostponeChooser
        key={
          state.capture ? JSON.stringify([state.request, state.capture.referenceAtMs]) : 'closed'
        }
        draftOwner={draft}
        visible={visible && !!state.capture}
        capture={state.capture}
        busy={state.submitting}
        uncertain={state.uncertain}
        acknowledged={state.acknowledged}
        eligible={state.eligible}
        feedback={feedback}
        retryLabel={recovery.retry}
        progressLabel={recovery.progress}
        acknowledgedLabel={destination === 'home' ? t('postpone_return_home') : t('m_59f6ec7bb281')}
        returnFocusRef={returnFocusRef}
        returnFocusWhen={() => focused}
        onClose={close}
        onSubmit={(target) => {
          controller.submit(target);
          draft?.setFrozen(controller.isGuarded());
        }}
        onRetry={() => controller.retry()}
        onSelectionChange={() => controller.select()}
        onAlarmSettings={settings}
      />
    </>
  );
}
