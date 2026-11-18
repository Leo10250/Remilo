import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { AppState, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { PostponeDraft, type PostponeCapture } from '../domain/postpone';
import { PostponeController, postponeHostPresentation } from '../domain/postpone-controller';
import {
  parsePostponeRequest,
  postponeRequestIdentity,
  subscribePostponeLinks,
  takePostponeLink,
  type PostponeRequest,
} from '../domain/postpone-request';
import { commandFeedback, recoveryPresentation } from '../domain/actions';
import { deviceZone } from '../domain/time';
import { ringingMembersRemain } from '../domain/ringing-session';
import { errorText } from '../localization';
import { useTranslation } from '../localization/react';
import { ActionFeedback, Copy } from './components';
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
      if (controller.snapshot().request) return;
      for (let request = pending.shift(); request; request = pending.shift()) {
        if (request.kind === 'ReminderActions') {
          router.navigate({ pathname: '/reminder/[id]', params: { id: request.occurrenceId } });
        } else if (iosReminders && request.kind === 'AlarmReminderActions') {
          router.push({
            pathname: '/reminder/[id]',
            params: {
              id: request.occurrenceId,
              alarmGeneration: String(request.expectedGeneration),
            },
          });
        } else if (request.kind === 'Routine') {
          router.navigate({
            pathname: '/routine-session',
            params: { id: request.routineId, date: request.date },
          });
        } else if (request.kind === 'RoutineAlarmActions') {
          currentRoutineAlarm.current = request;
          setRoutineAlarm(request);
          return;
        } else if (request.kind === 'Single' && openPostpone(request)) {
          router.navigate('/');
          return;
        }
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
            if (request.kind === 'Single') {
              const matches = (other: Request | PostponeRequest | null) =>
                other?.kind === 'Single' &&
                other.occurrenceId === request.occurrenceId &&
                other.expectedGeneration === request.expectedGeneration;
              if (matches(controller.snapshot().request) || pending.some(matches)) continue;
            }
            pending.push(request);
          }
          present();
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
    // Wait until a close has also handed off any draft already in the controller queue.
    const unsubscribe = controller.subscribe(() => queueMicrotask(present));
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
      onDismissed={() => {
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
  const [closing, setClosing] = useState(false);
  const exit = useRef<{ request: PostponeRequest; after?: () => void } | null>(null);
  const close = useCallback(
    (after?: () => void) => {
      const request = controller.snapshot().request;
      if (!request || controller.isGuarded() || exit.current) return;
      exit.current = { request, after };
      setClosing(true);
    },
    [controller],
  );
  // The request owns the presentation until the shared sheet finishes dismissing.
  const dismissed = () => {
    const job = exit.current;
    exit.current = null;
    setClosing(false);
    if (job && controller.snapshot().request === job.request && controller.close()) job.after?.();
  };
  useEffect(
    () => () => {
      if (exit.current && exit.current.request === controller.snapshot().request)
        controller.close();
    },
    [controller],
  );
  const presentation = postponeHostPresentation(
    state.destination,
    destination,
    focused,
    action.guarded,
  );
  const visible = presentation.visible && !!state.request && !closing;
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
    close();
  }, [visible, state.acknowledged, state.result, resultFeedback, close]);
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
  const settings = () => {
    close(() => {
      if (onAlarmSettings) onAlarmSettings();
      else router.push('/alarm-check');
    });
  };
  return (
    <PostponeChooser
      key={state.request ? postponeRequestIdentity(state.request) : undefined}
      draftOwner={draft}
      visible={visible}
      capture={state.capture}
      loading={state.loading}
      loadFailed={state.failure === 'load'}
      onLoadRetry={() => void controller.load()}
      busy={state.submitting}
      uncertain={state.uncertain}
      acknowledged={state.acknowledged}
      eligible={state.eligible}
      feedback={feedback}
      retryLabel={recovery.retry}
      progressLabel={recovery.progress}
      acknowledgedLabel={destination === 'home' ? t('postpone_return_home') : t('m_59f6ec7bb281')}
      returnFocusRef={returnFocusRef}
      returnFocusWhen={() => focused && !exit.current?.after}
      onClose={() => close()}
      onDismissed={dismissed}
      onSubmit={(target) => {
        if (exit.current) return;
        controller.submit(target);
        draft?.setFrozen(controller.isGuarded());
      }}
      onRetry={() => controller.retry()}
      onSelectionChange={() => controller.select()}
      onAlarmSettings={settings}
    />
  );
}
