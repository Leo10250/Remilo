import { errorText, t as currentText, t } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';
import { useTimeFormatting, useTimeDisplay } from '../ui/time-display';
import { useQuery } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import type { CalendarCreationDisposition, Command, CommandResult, RecurrenceDraft, RoutinePlan, Series } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { changeCalendarAllDay, changeDraftZone, chooseConflict, editorDraft, editorPreviewPayload, hasSeparateEvent, moveDraftAlert, moveDraftCalendarEvent, moveDraftDue, moveDraftEvent, relinkTimedSnapshot, reviewedTimedSnapshot, reviewChoicesComplete, reviewEditorDraft, type DraftConflict, type EditorDraft, type EditorState, type TimedDraftSnapshot } from '../domain/editor-draft';
import { saveFeedback, type SaveContext } from '../domain/save-feedback';

import { cleanRepeat, repeatLabel } from '../domain/repeat';
import { creationOrigin, retainedOriginParams, secondaryOriginRoute, type OriginParams } from '../domain/navigation';
import { modeLabel } from '../domain/presentation';
import { civilAt, deviceZone } from '../domain/time';
import { ActionFeedback, BottomActionBar, Button, Choice, ConnectedGroup, Copy, DateField, Disclosure, Field, Group, IconButton, Page, QueryState, RowSupport, SettingRow, Sheet, Status, Toggle } from '../ui/components';
import { RoutineActions } from '../ui/routine-actions';
import { useExerciseImageLeases } from '../ui/exercise-images';
import { ReminderTypeSelector, RoutineChangeReview, RoutineWeekFields, routineDayKeys } from '../ui/routine-editor';
import { canChangeReminderType, changeRoutineClock, routinePayload, switchReminderDraftType, validRoutineDays, weeklyEditorDraft, type ReminderType, type WeeklyEditorDraft } from '../domain/routine-editor-draft';
import { AlertModeSelector } from '../ui/alert-mode-selector';
import { DateTimeFields } from '../ui/date-time-fields';
import { notify } from '../ui/feedback';
import { CommandError, engine, nativeAvailable, useCommand, useSettings, useCapabilities } from '../ui/native';
import { RepeatForm } from '../ui/recurrence';
import { useAppearanceHold } from '../ui/theme';
import { TimeZoneField } from '../ui/time-zone';
import { ListPicker, returnToOrigin } from '../ui/navigation';
import { SoundPicker } from '../ui/sound-picker';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { space } from '../ui/tokens';

type Seed = { state: EditorState; revision?: number; series?: Series; routineId?: string; routinePlan?: RoutinePlan };
async function readSeed(id?: string, segmentId?: string, following?: string): Promise<Seed> {
  let draft: EditorDraft, recurrence: RecurrenceDraft | undefined, revision: number | undefined, series: Series | undefined, routineId: string | undefined;
  if (segmentId) {
    series = await engine().getSeries(segmentId) ?? undefined;
    if (!series) throw new Error(t('m_c32e5d8380a5'));
    routineId = (series.template as { routineId?: string }).routineId;
    const source = following ? await engine().getSeriesDraft(segmentId, following) : undefined;
    draft = editorDraft(source?.template ?? series.template);
    recurrence = cleanRepeat({ ...series.rule, zoneMode: series.rule.zoneId ? 'pinned' : 'floating',
      count: following ? source?.remainingCount ?? undefined : series.rule.count ?? undefined, until: series.rule.until ?? undefined });
    if (recurrence.zoneMode === 'floating') draft = (await changeDraftZone(draft, deviceZone(), (input) => engine().convertTime(input))).draft;
  } else if (id) {
    const record = await engine().getOccurrence(id);
    if (!record) throw new Error(t('m_7f00c5392527'));
    routineId = record.routine?.routineId;
    draft = editorDraft(record); revision = record.revision;
  } else draft = editorDraft();
  return { state: { draft, recurrence }, revision, series, routineId };
}
function routineSeed(plan: RoutinePlan): Seed {
  const when = new Date(plan.startsOn + 'T' + String(Math.floor(plan.minutes / 60)).padStart(2, '0') + ':' + String(plan.minutes % 60).padStart(2, '0') + ':00').getTime();
  return { routineId: plan.id, routinePlan: plan, state: { draft: editorDraft({ title: plan.title, notes: plan.notes, listId: plan.listId,
    mode: plan.mode, eventStartMs: when, alarmAtMs: when, sound: plan.sound, vibration: plan.vibration }) } };
}
export default function Editor() {
  'use no memo';
  const t = useTranslation();
  const params = useLocalSearchParams<OriginParams & { id?: string; duplicate?: string; segmentId?: string; following?: string; routine?: string; routineId?: string; copyRoutine?: string }>();
  const id = params.id ?? params.duplicate, routineId = params.routineId ?? params.copyRoutine;
  const editing = !!id || !!params.segmentId || !!routineId, duplicate = !!params.duplicate || !!params.copyRoutine;
  const source = useQuery({ queryKey: ['editor-source', id, params.segmentId, params.following, routineId], enabled: nativeAvailable && editing,
    queryFn: async () => {
      const seed = routineId ? undefined : await readSeed(id, params.segmentId, params.following), planId = routineId ?? seed?.routineId;
      if (!planId) return seed!;
      const plan = (await engine().queryRoutines()).find(value => value.id === planId);
      if (!plan) throw new Error(t('routine_load_error'));
      return routineSeed(plan);
    } });
  if (!nativeAvailable) return <Page compact title={t('m_31757bbfa17e')}><Copy>{t('m_00b26ac6b4a0')}</Copy></Page>;
  if (editing && !source.data) return <Page compact title={t('m_1f1353b055df')} onBack={() => router.canGoBack() ? router.back() : router.replace(secondaryOriginRoute(retainedOriginParams(params)))}><QueryState loading={source.isLoading} error={source.error}
    empty={false} onRetry={() => void source.refetch()} /></Page>;
  const origin = creationOrigin(params);
  const seed = source.data ?? { state: { draft: editorDraft({ title: '', listId: origin.kind === 'list' ? origin.listId : null, ...(params.routine ? { mode: 'Notification' as const } : {}) }) } };
  return <EditorForm key={routineId ?? id ?? params.segmentId ?? 'new'} seed={seed} id={params.id} duplicate={duplicate} following={params.following} newRoutine={!!params.routine} originParams={retainedOriginParams(params)} />;
}
type Review = { latest: Seed; merged: EditorState; conflicts: DraftConflict[]; choices: Partial<Record<DraftConflict['key'], 'yours' | 'latest'>> };
function EditorForm({ seed, id, duplicate, following, newRoutine, originParams }: { seed: Seed; id?: string; duplicate: boolean; following?: string; newRoutine: boolean; originParams: OriginParams }) {
  'use no memo';
  const t = useTranslation();
  const { formatTime, eventRange } = useTimeFormatting();
  const settings = useSettings(), command = useCommand(), navigation = useNavigation();
  const confirm = useAppearanceConfirmation();
  useAppearanceHold(true);
  const [origin] = useState(() => creationOrigin(originParams));
  const lists = useQuery({ queryKey: ['lists'], queryFn: () => engine().getLists(), enabled: nativeAvailable });
  const [state, setState] = useState<EditorState>(() => ({ ...seed.state, draft: { ...seed.state.draft,
    title: duplicate ? seed.state.draft.title.slice(0, 193) + t('m_d75612450689') : seed.state.draft.title } }));
  const { draft, recurrence } = state, zone = draft.zoneId ?? deviceZone();
  const [baseline, setBaseline] = useState(state);
  const [editorType, setEditorType] = useState<ReminderType>(seed.routinePlan || newRoutine ? 'Routine' : 'Reminder');
  const [weekly, setWeekly] = useState<WeeklyEditorDraft>(() => weeklyEditorDraft(seed.state.draft, seed.routinePlan, duplicate));
  const [baselineWeekly, setBaselineWeekly] = useState(weekly), [baselineType] = useState(editorType);
  const [loadedRoutine, setLoadedRoutine] = useState(duplicate ? undefined : seed.routinePlan);
  const [routineMenu, setRoutineMenu] = useState(false);
  useExerciseImageLeases(weekly.days.flatMap(day => day.exercises));
  const [routineReviewOpen, setRoutineReviewOpen] = useState(false);
  const routine = editorType === 'Routine';
  const routineWeekdays = weekly.days.flatMap((day, index) => day.type === 'Exercises' ? [t(routineDayKeys[index])] : []).join(' · ');
  const [loadedRevision, setLoadedRevision] = useState(seed.revision), [loadedSeries, setLoadedSeries] = useState(seed.series);
  const [followingScope, setFollowingScope] = useState(following), [saveAsNew, setSaveAsNew] = useState(false);
  const [message, setMessage] = useLocalizedState(''), [fieldError, setFieldError] = useState<string | undefined>(), [zoneWarning, setZoneWarning] = useState('');
  const pendingSave = useRef<Command | null>(null);
  const savedContext = useRef<SaveContext>(null);
  const savedNotified = useRef(false);
  const caps = useCapabilities(), timeDisplay = useTimeDisplay();
  const timingWork = useRef(false);
  const timedSnapshot = useRef<TimedDraftSnapshot | null>(null);
  const titleInput = useRef<TextInput>(null), notesInput = useRef<TextInput>(null);
  const [initialTitleFocus] = useState(() => !id && !seed.series && !duplicate && !seed.state.draft.title.trim());
  const finishEditing = useCallback(() => {
    titleInput.current?.blur(); notesInput.current?.blur(); Keyboard.dismiss();
  }, []);
  const [retrySave, setRetrySave] = useState(false), [saved, setSaved] = useState<CommandResult | null>(null);
  const [removed, setRemoved] = useState(false);
  useEffect(() => { if (removed) { if (router.canGoBack()) router.back(); else router.replace('/routines'); } }, [removed]);
  const [preparing, setPreparing] = useState(false), [reviewLoading, setReviewLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null), [reviewOpen, setReviewOpen] = useState(false), [scopeChanged, setScopeChanged] = useState(false);
  const editingId = saveAsNew || routine ? undefined : id, editingSeries = saveAsNew || routine ? undefined : loadedSeries;
  const creation = !editingId && !editingSeries && !loadedRoutine;
  const typeEditable = canChangeReminderType(creation, duplicate, !!seed.routinePlan, !!seed.series);
  const routinePlans = useQuery({ queryKey: ['routines'], queryFn: () => engine().queryRoutines(), enabled: nativeAvailable && !!loadedRoutine });
  const latestRoutine = routinePlans.data?.find(plan => plan.id === loadedRoutine?.id);
  const routineStale = !!latestRoutine && latestRoutine.revision !== loadedRoutine?.revision;
  const managed = useQuery({ queryKey: ['calendar', 'managed'], queryFn: () => engine().getManagedCalendarState(), enabled: nativeAvailable && creation && !routine });
  const [calendarDisposition, setCalendarDisposition] = useState<CalendarCreationDisposition>('Default');
  const calendar = useQuery({ queryKey: ['calendar', 'publications'], queryFn: () => engine().getCalendarPublications(),
    enabled: nativeAvailable && !!editingId && !editingSeries });
  // An unavailable publication read must not let a coincident published event move.
  const calendarLinks = useQuery({ queryKey: ['calendar', 'links'], queryFn: () => engine().getCalendarLinks(),
    enabled: nativeAvailable && !!editingId && !editingSeries });
  const hasCalendarContext = calendar.data?.some(item => item.occurrenceId === editingId) || calendarLinks.data?.some(item => item.occurrenceId === editingId);
  const preserveEvent = !!editingId && !editingSeries && (!calendar.data || !!calendar.error || !calendarLinks.data || !!calendarLinks.error || !!hasCalendarContext);
  const dirty = saveAsNew || calendarDisposition !== 'Default' || JSON.stringify(state) !== JSON.stringify(baseline) || editorType !== baselineType || JSON.stringify(weekly) !== JSON.stringify(baselineWeekly);
  const busy = preparing || command.isPending || reviewLoading;
  usePreventRemove(!removed && !saved && (dirty || retrySave || preparing || command.isPending), ({ data }) => {
    if (retrySave || pendingSave.current || command.isPending) { confirm(t('m_31442c166f10'), t('m_341b6b4fb929')); return; }
    if (preparing) { confirm(t('m_d8eb10e04288'), t('m_27b05dc65c32')); return; }
    confirm(t('m_85bcf41666a5'), t('m_2a6bb39d73ff'), [{ text: t('m_e76fd2add010'), style: 'cancel' },
      { text: t('m_eb1a70e39274'), style: 'destructive', onPress: () => { finishEditing(); navigation.dispatch(data.action); } }]);
  });
  useEffect(() => {
    if (!saved) return;
    if (savedNotified.current) return;
    savedNotified.current = true;
    if (savedContext.current?.kind === 'CreateRoutine' || savedContext.current?.kind === 'EditRoutine') {
      notify({ message: saved.status === 'Blocked' ? t('m_3e527a715fb1') : t(savedContext.current.kind === 'CreateRoutine' ? 'routine_saved' : 'routine_saved_changes'),
        tone: saved.status === 'Blocked' ? 'warning' : 'success', persistent: saved.status === 'Blocked' });
      finishEditing();
      if (router.canGoBack()) router.back(); else returnToOrigin(origin);
      return;
    }
    const feedback = saveFeedback(savedContext.current!, saved, { access: caps.data, failed: !!caps.error, checking: caps.isFetching }, Date.now(), timeDisplay);
    notify({ message: feedback.message, tone: feedback.tone === 'accent' ? 'muted' : feedback.tone, persistent: feedback.persistent,
      action: { label: feedback.review === 'access' ? currentText('m_5ddb6f051115') : feedback.review === 'schedule' ? currentText('m_98c00356c056') : feedback.review === 'reminder' ? currentText('m_5ded6845709d') : currentText('m_dcc839a4015c'),
        occurrenceId: saved.occurrence?.id, segmentId: saved.segmentId, origin: originParams,
        ...(feedback.review === 'access' ? { alarmCheck: { ...originParams, ...(saved.occurrence ? { originReminderId: saved.occurrence.id } : {}) } } : {}) } });
    finishEditing();
    if (creation) returnToOrigin(origin);
    else if (router.canGoBack()) router.back();
    else if (originParams.originReminderId || originParams.originFamily || originParams.originCollection) router.replace(secondaryOriginRoute(originParams));
    else if (saved.segmentId) router.replace({ pathname: '/series/[id]', params: { id: saved.segmentId } });
    else if (saved.occurrence) router.replace({ pathname: '/reminder/[id]', params: { id: saved.occurrence.id } });
    else router.replace('/');
  }, [saved, creation, origin, originParams, finishEditing, caps.data, caps.error, caps.isFetching, timeDisplay, t]);
  const patch = (value: Partial<EditorDraft>) => { if (!pendingSave.current && !timingWork.current) setState((current) => ({ ...current, draft: { ...current.draft, ...value } })); };
  const updateTiming = async (resolve: () => Promise<{ draft: EditorDraft; warnings: string[] }>, field: string, nextRepeat?: { value?: RecurrenceDraft }) => {
    if (pendingSave.current || timingWork.current || busy || review) throw new Error(t('m_3f7c29473312'));
    timingWork.current = true; setPreparing(true); setMessage(''); setFieldError(undefined); setZoneWarning('');
    try {
      const changed = await resolve();
      setState((current) => ({ draft: changed.draft, recurrence: nextRepeat ? nextRepeat.value : current.recurrence })); setZoneWarning(changed.warnings.join(' '));
    } catch (error) {
      setMessage(errorText(error, t('m_9e4765aa42db'))); setFieldError(field); throw error;
    } finally { timingWork.current = false; setPreparing(false); }
  };
  const moveEvent = (value: number) => { void updateTiming(() => moveDraftEvent(draft, value, (input) => engine().convertTime(input)), 'eventStartMs').catch(() => {}); };
  const moveAlert = (value: number) => { void updateTiming(() => moveDraftAlert(draft, value, (input) => engine().convertTime(input), preserveEvent), 'alarmAtMs').catch(() => {}); };
  const moveCalendarEvent = (value: number) => { void updateTiming(() => moveDraftCalendarEvent(draft, value, (input) => engine().convertTime(input)), 'eventStartMs').catch(() => {}); };
  const changeDue = (value: number) => { void updateTiming(() => moveDraftDue(draft, value, (input) => engine().convertTime(input)), 'dueAtMs').catch(() => {}); };
  const changeZone = (nextZone: string, nextRepeat: RecurrenceDraft | undefined) => updateTiming(() => changeDraftZone(draft, nextZone, (input) => engine().convertTime(input)), 'zoneId', { value: nextRepeat });
  const changeAllDay = (allDay: boolean) => {
    void updateTiming(async () => {
      const changed = await changeCalendarAllDay(draft, allDay, timedSnapshot.current, (input) => engine().convertTime(input));
      timedSnapshot.current = changed.snapshot;
      return changed;
    }, 'allDay').catch(() => {});
  };
  const applyRepeat = async (next?: RecurrenceDraft, nextZone?: string) => {
    if (pendingSave.current || timingWork.current || review) return;
    if (nextZone && nextZone !== zone) await changeZone(nextZone, next);
    else setState((current) => ({ ...current, recurrence: next }));
  };
  const payload = Object.fromEntries(Object.entries({ ...draft,
    ...(recurrence ? { recurrence: cleanRepeat(recurrence) } : {}),
    ...(draft.allDay && draft.dueLinked ? { dueAtMs: undefined } : {}), ...(draft.allDay && draft.alarmLinked ? { alarmAtMs: undefined } : {}) })
    .filter(([key, value]) => key !== 'listName' && value !== undefined));
  const previewPayload = editorPreviewPayload(state);
  const preview = useQuery({ queryKey: ['schedule-preview', previewPayload], queryFn: () => engine().previewSchedule(previewPayload),
    enabled: nativeAvailable && !busy && !routine });
  const weeklyPayload = { ...routinePayload(draft, weekly), sound: draft.sound ?? settings.data?.sound ?? 'remilo', vibration: draft.vibration ?? settings.data?.vibration ?? true };
  const routinePreview = useQuery({ queryKey: ['routine-preview', weeklyPayload, weekly.startsOn, loadedRoutine?.id],
    queryFn: () => engine().previewRoutine({ ...weeklyPayload, startsOn: weekly.startsOn, ...(loadedRoutine ? { routineId: loadedRoutine.id } : {}) }),
    enabled: nativeAvailable && routine && validRoutineDays(weekly.days) && !busy });
  const loadReview = async () => {
    setReviewLoading(true); setMessage('');
    try {
      if (routine) { await routinePlans.refetch({ throwOnError: true }); setRoutineReviewOpen(true); return; }
      const latest = await readSeed(editingId, editingSeries?.id, followingScope);
      if (latest.series?.state === 'Archived') { setScopeChanged(true); setReview(null); return; }
      const result = reviewEditorDraft(baseline, state, latest.state);
      setReview({ latest, ...result, choices: {} }); setReviewOpen(true);
    } catch (error) {
      // A following boundary can be retired by a concurrent series edit.
      if (editingSeries) {
        const current = await engine().getSeries(editingSeries.id).catch(() => null);
        if (current?.state === 'Archived') { setScopeChanged(true); setReview(null); return; }
      }
      setMessage(errorText(error, t('m_161bd3c92d03')));
    } finally { setReviewLoading(false); }
  };
  const applyReview = (reload = false) => {
    if (!review || !reload && !reviewChoicesComplete(review.conflicts, review.choices)) return;
    const next = reload ? review.latest.state : review.conflicts.reduce((value, conflict) => chooseConflict(value, conflict, review.choices[conflict.key]!), review.merged);
    timedSnapshot.current = reviewedTimedSnapshot(timedSnapshot.current, state, next, reload);
    setBaseline(review.latest.state); setState(next); setLoadedRevision(review.latest.revision); setLoadedSeries(review.latest.series);
    setReview(null); setReviewOpen(false); setMessage(''); setFieldError(undefined); command.reset();
  };
  const reloadCurrent = async () => {
    setReviewLoading(true); setMessage('');
    try {
      const family = (await engine().queryRepeatFamilies()).find((item) => item.seriesId === loadedSeries?.seriesId);
      if (!family) throw new Error(t('m_2c5f96cdbb2a'));
      const latest = await readSeed(undefined, family.current.id);
      timedSnapshot.current = null;
      setBaseline(latest.state); setState(latest.state); setLoadedSeries(latest.series); setLoadedRevision(undefined);
      setFollowingScope(undefined); setScopeChanged(false); setReview(null); setReviewOpen(false); setFieldError(undefined); command.reset();
    } catch (error) { setMessage(errorText(error, t('m_c264c7d2dcca'))); }
    finally { setReviewLoading(false); }
  };
  const save = async () => {
    if (busy || timingWork.current || review || scopeChanged || routineStale && !retrySave) return;
    setPreparing(true); setMessage(''); setFieldError(undefined);
    try {
      if (!pendingSave.current) {
        if (routine) {
          if (!validRoutineDays(weekly.days)) { setMessage(t('routine_validation')); setFieldError('days'); return; }
          pendingSave.current = loadedRoutine ? { ...weeklyPayload, kind: 'EditRoutine', routineId: loadedRoutine.id, expectedRevision: loadedRoutine.revision, operationId: engine().createOperationId() }
            : { ...weeklyPayload, kind: 'CreateRoutine', startsOn: weekly.startsOn, operationId: engine().createOperationId() };
        } else {
        const resolved = preview.data;
        if (recurrence && resolved && !resolved.upcoming.length) { setMessage(t('m_dfe0e46b0c94')); setFieldError('recurrence'); return; }
        if (creation && !recurrence && resolved?.warnings.length && draft.mode !== 'None') { setMessage(resolved.warnings.join('\n')); setFieldError('alarmAtMs'); return; }
        if (editingSeries && !recurrence) { setMessage(t('m_2ebc6e5d9ec6')); setFieldError('recurrence'); return; }
        pendingSave.current = (editingSeries && recurrence ? { ...payload, recurrence: cleanRepeat(recurrence),
          kind: followingScope ? 'EditFollowing' : 'EditSeries', segmentId: editingSeries.id, expectedRevision: editingSeries.revision,
          nominalSlot: followingScope, operationId: engine().createOperationId() }
          : editingId ? { ...payload, kind: 'Edit', occurrenceId: editingId, expectedRevision: loadedRevision!, operationId: engine().createOperationId() }
          : recurrence ? { ...payload, recurrence: cleanRepeat(recurrence), kind: 'CreateSeries', calendarDisposition, operationId: engine().createOperationId() }
          : { ...payload, kind: 'Create', calendarDisposition, operationId: engine().createOperationId() }) as Command;
        }
      }
      const captured = pendingSave.current;
      savedContext.current = { kind: captured.kind, mode: 'mode' in captured ? captured.mode : draft.mode };
      const result = await command.mutateAsync(captured);
      setRetrySave(false); setSaved(result);
    } catch (error) {
      if (error instanceof CommandError) {
        pendingSave.current = null; setRetrySave(false); setFieldError(error.field);
        if (error.code?.startsWith('STALE')) { await loadReview(); return; }
      } else setRetrySave(pendingSave.current !== null);
      setMessage(errorText(error, t('m_fe32924b26f0')));
    } finally { setPreparing(false); }
  };
  const invalid = (fields: string[]) => fieldError && fields.includes(fieldError) ? message : undefined;
  const dateError = (text: string) => { setMessage(text); };
  const conflictValue = (conflict: DraftConflict, side: 'yours' | 'latest') => {
    const value = conflict[side];
    if (conflict.key === 'schedule') {
      const timing = value as EditorDraft & { recurrence?: RecurrenceDraft };
      return t('m_133a152e6e79') + formatTime(timing.eventStartMs, timing.zoneId) + (timing.allDay ? t('m_b3d544d5d55c') : t('m_b9831a000bec') + formatTime(timing.eventEndMs, timing.zoneId)) +
        t('m_7b882799eb7b') + formatTime(timing.dueAtMs, timing.zoneId) + (timing.dueLinked ? t('m_ff97751a740a') : t('m_f35ccd40f211')) + ' · ' +
        (timing.mode === 'None' ? t('m_d1af410eb4d0') : timing.mode + ' ' + formatTime(timing.alarmAtMs, timing.zoneId) + (timing.alarmLinked ? t('m_ff97751a740a') : t('m_f35ccd40f211'))) +
        ' · ' + repeatLabel(timing.recurrence) + ' · ' + timing.zoneId;
    }
    if (conflict.key === 'vibration') return value ? t('m_130011756125') : t('m_ca7981b46ecf');
    if (conflict.key === 'listId') return value == null ? t('m_eacd31d849f9') : lists.data?.find((list) => list.id === value)?.name ?? t('m_3331733936a8');
    return typeof value === 'string' && value.length ? value : t('m_dc937b598926');
  };
  const disabled = !nativeAvailable || busy || !!review || scopeChanged || routineStale && !retrySave || !draft.title.trim() || routine && !validRoutineDays(weekly.days);
  const frozen = busy || retrySave || !!review;
  const resolvedDraft = { ...draft, ...preview.data };
  const noAlert = draft.mode === 'None';
  const timingLabel = noAlert ? t('m_75ba69e3a8b7') : modeLabel(draft.mode) + t('m_4a8f540240f1');
  const calendarSummary = hasSeparateEvent(resolvedDraft) || preserveEvent ? eventRange(resolvedDraft) : undefined;
  const reviewed = review?.conflicts.reduce((value, conflict) => chooseConflict(value, conflict, review.choices[conflict.key] ?? 'yours'), review.merged);
  const chooseType = (type: ReminderType) => {
    if (!typeEditable || frozen || pendingSave.current || type === editorType) return;
    finishEditing(); setMessage(''); setFieldError(undefined);
    void updateTiming(() => switchReminderDraftType(draft, type, input => engine().convertTime(input)), 'eventStartMs').then(() => setEditorType(type)).catch(() => {});
  };
  const restoreRoutine = () => {
    if (!latestRoutine) return;
    const latest = routineSeed(latestRoutine).state;
    setState(latest); setBaseline(latest); setLoadedRoutine(latestRoutine);
    const nextWeekly = weeklyEditorDraft(latest.draft, latestRoutine);
    setWeekly(nextWeekly); setBaselineWeekly(nextWeekly); setRoutineReviewOpen(false); setMessage(''); setFieldError(undefined); command.reset();
  };
  const keepRoutineDraft = () => {
    if (!latestRoutine) return;
    const latest = routineSeed(latestRoutine).state;
    setBaseline(latest); setBaselineWeekly(weeklyEditorDraft(latest.draft, latestRoutine));
    setLoadedRoutine(latestRoutine); setRoutineReviewOpen(false); setMessage(''); setFieldError(undefined); command.reset();
  };
  return <Page compact title={routine ? t(creation ? 'routine_editor_new' : 'routine_editor_edit') : creation ? t('m_70f22f445886') : editingSeries ? followingScope ? t('m_3e60c726a1d3') : t('m_3ca78b60c94f') : t('m_1f1353b055df')}
    actions={loadedRoutine ? <IconButton icon="more_vert" label={t('routine_more')} disabled={frozen} onPress={() => setRoutineMenu(true)} /> : undefined}
    onBack={() => {
      if (!dirty && !retrySave && !busy) finishEditing();
      if (router.canGoBack()) router.back(); else router.replace(secondaryOriginRoute(originParams));
    }}
    footer={<BottomActionBar><View style={{ flex: 1, gap: 8 }}>
      {!!zoneWarning && <ActionFeedback message={zoneWarning} tone="warning" />}
      {!!message && !retrySave && <ActionFeedback message={message} tone="danger" />}
      {retrySave && <ActionFeedback message={t('m_3f0dfa9a5e39')} tone="warning" />}
      <Button label={command.isPending ? t('m_23e39291d613') : preparing ? t('m_dfe40efe921f') : reviewLoading ? t('m_fcc53388888f') : retrySave ? t('m_71fdfa790e50') : t('m_1509f561f241')}
        accessibilityHint={!draft.title.trim() ? t('m_8b71decd932a') : undefined} busy={busy} disabled={disabled} onPress={() => void save()} />
    </View></BottomActionBar>}>
    {loadedRoutine && <RoutineActions target={routineMenu ? { id: loadedRoutine.id } : null} onClose={() => setRoutineMenu(false)} onRemoved={() => { finishEditing(); setRemoved(true); }} />}
    {scopeChanged && <Group title={t('m_f5f54f060066')}><View style={{ padding: 14, gap: 12 }}>
      <Status label={t('m_2ebc23f04668')} tone="warning" />
      <Button label={t('m_0daa33738c8e')} variant="secondary" onPress={() => {
        setSaveAsNew(true); setScopeChanged(false); setReview(null); setMessage(''); setFieldError(undefined); command.reset();
      }} />
      <Button label={t('m_e40b0b94375d')} variant="secondary" disabled={busy} onPress={() => confirm(t('m_4f1821a7834e'),
        t('m_6f634e9038d9'), [{ text: t('m_bbcc810f654f'), style: 'cancel' }, { text: t('m_bdc090ec61e3'), style: 'destructive', onPress: () => void reloadCurrent() }])} />
    </View></Group>}
    {review && <Group><View style={{ padding: 14, gap: 10 }}><Status label={t('m_bc45a4c01ee7')} tone="warning" />
      <Button label={t('m_6a47708f4e14')} variant="secondary" onPress={() => setReviewOpen(true)} /></View></Group>}
    {reviewLoading && <ActionFeedback loading message={t('m_914801fd4cfa')} />}
    {saveAsNew && <Copy muted>{t('m_77bcd00eca3e')}</Copy>}
    {/* Keep the native parent stable when Save freezes/unfreezes its descendants. */}
    <View collapsable={false} pointerEvents={frozen ? 'none' : 'auto'} importantForAccessibility={frozen ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={frozen} style={{ gap: 16 }}>
      <Field required label={t('m_7e8cd2056da7')} placeholder={t('m_41f45aa7f7ff')} inputRef={titleInput} autoFocus={initialTitleFocus} value={draft.title}
        multiline compactMultiline submitBehavior="blurAndSubmit" enterKeyHint="done" onSubmitEditing={() => titleInput.current?.blur()}
        editable={!frozen} onChangeText={(title) => patch({ title })} maxLength={200} error={invalid(['title'])} />
      <ConnectedGroup>
        {typeEditable ? <ReminderTypeSelector key="type" value={editorType} disabled={frozen} onChange={chooseType} /> : <SettingRow intent="action" key="type" label={t('routine_type_label')} value={t(routine ? 'routine_type_weekly' : 'routine_type_reminder')} />}
        {(!routine || !loadedRoutine || !noAlert) && <View key="timing">
          {(!routine || !noAlert) && <RowSupport><Copy muted size={14}>{routine ? t('routine_shared_time') : timingLabel}</Copy></RowSupport>}
          {routine ? <>
            {!loadedRoutine && <DateTimeFields dateLabel={t('routine_starts')} dateZoneId={deviceZone()} dateValue={new Date(weekly.startsOn + 'T12:00:00').getTime()}
              value={draft.alarmAtMs} zoneId={zone} allDay={noAlert} disabled={frozen} onError={dateError}
              onDateChange={value => setWeekly(current => ({ ...current, startsOn: civilAt(value).slice(0, 10) }))}
              onChange={value => setState(current => ({ ...current, draft: changeRoutineClock(current.draft, value) }))} />}
            {loadedRoutine && !noAlert && <DateField label={t('m_33b93476cf59')} value={draft.alarmAtMs} zoneId={zone} timeOnly disabled={frozen} onError={dateError}
              onChange={value => setState(current => ({ ...current, draft: changeRoutineClock(current.draft, value) }))} />}
          </> : <DateTimeFields labelPrefix={noAlert ? t('m_4724f344c1c0') : modeLabel(draft.mode)} value={noAlert ? resolvedDraft.eventStartMs : resolvedDraft.alarmAtMs} zoneId={zone} allDay={noAlert && !!draft.allDay}
            onError={dateError} onChange={noAlert ? moveEvent : moveAlert} disabled={frozen || !preview.data} />}
          {!routine && (preview.error || preview.isPending) && <RowSupport>{preview.error ? <><ActionFeedback message={t('m_f5c72a8860c3')} tone="warning" />
              <Button label={t('m_942087cc2d41')} variant="secondary" disabled={frozen} onPress={() => void preview.refetch()} /></> :
              <ActionFeedback loading message={t('m_aa0d9f285325')} />}</RowSupport>}
          {noAlert && invalid(['eventStartMs']) && <RowSupport><Status label={message} tone="danger" /></RowSupport>}
          {invalid(['alarmAtMs']) && <RowSupport><Status label={message} tone="danger" /></RowSupport>}
        </View>}
        <View key="alert"><AlertModeSelector value={draft.mode ?? 'Alarm'} disabled={frozen} onChange={(mode) => patch({ mode })} /></View>
        {routine ? <SettingRow intent="action" key="repeat" label={t('routine_repeat_label')} icon="repeat" value={routineWeekdays ? t('routine_repeat', { days: routineWeekdays }) : t('routine_repeat_empty')} /> : !editingId && <View key="repeat">
          <RepeatForm disabled={frozen} value={recurrence} onChange={applyRepeat} startMs={draft.eventStartMs} zoneId={zone} previewDraft={draft} hasPublication={hasCalendarContext} />
          {invalid(['recurrence']) && <RowSupport><Status label={message} tone="danger" /></RowSupport>}
        </View>}
        {!routine && <View key="list"><ListPicker value={draft.listId ?? null} onChange={(listId) => patch({ listId })} disabled={frozen} />
          {invalid(['listId']) && <RowSupport><Status label={message} tone="danger" /></RowSupport>}
        </View>}
      </ConnectedGroup>
      {routine && <>
        <RoutineWeekFields days={weekly.days} disabled={frozen} onChange={days => setWeekly(current => ({ ...current, days }))} />
        {invalid(['days']) && <ActionFeedback message={message} tone="danger" />}
        <ConnectedGroup><ListPicker value={draft.listId ?? null} onChange={listId => patch({ listId })} disabled={frozen} /></ConnectedGroup>
        {loadedRoutine && <RoutineChangeReview plan={loadedRoutine} draft={weeklyPayload} listName={lists.data?.find(list => list.id === draft.listId)?.name} />}
        {routineStale && <><ActionFeedback message={t('m_fe8e0e6d9197')} tone="warning" /><Button label={t('routine_change_review')} variant="secondary" onPress={() => void loadReview()} /></>}
        {routinePreview.data?.nextAlertMs != null && draft.mode !== 'None' && <Copy muted size={14}>{t(loadedRoutine ? 'routine_next_after_changes' : 'routine_next_prompt', { time: formatTime(routinePreview.data.nextAlertMs) })}</Copy>}
        {!!routinePreview.error && <Button label={t('m_942087cc2d41')} variant="secondary" onPress={() => void routinePreview.refetch()} />}
        {draft.mode === 'Notification' && <>
          <Copy muted size={14}>{t('routine_no_catchup')}</Copy>
          {caps.data && (!caps.data.notifications || !caps.data.routineChannelEnabled) && <ActionFeedback tone="warning" message={t('routine_notification_warning')} />}
          {caps.data?.routineChannelQuiet === false && <Copy muted size={14}>{t('routine_channel_changed')}</Copy>}
          <Button label={t('routine_channel_settings')} variant="neutral" onPress={() => void engine().openSettings('routineChannel')} />
        </>}
      </>}
      <Disclosure title={t('m_6239b93e96e9')} initial={!!draft.notes} forceOpen={!!invalid(['notes'])}>
        <Field label={t('m_8a7525b1492f')} inputRef={notesInput} value={draft.notes} onChangeText={(notes) => patch({ notes })} multiline maxLength={10_000} error={invalid(['notes'])} />
      </Disclosure>
      {!routine && creation && !!managed.data?.calendarId && managed.data.mode !== 'Disabled' && <ConnectedGroup title={t('m_b074310e911f')} footer={<Copy muted>{managed.data.mode === 'Paused' ? t('m_6191bfd04e38') : t('m_7c56eff50082')}</Copy>}>
        <Toggle key="sync" label={t('m_3e44eada38e6')} value={calendarDisposition === 'Managed' || calendarDisposition === 'Default' && managed.data.policy.exportNewReminders}
          disabled={frozen} onChange={value => setCalendarDisposition(value ? 'Managed' : 'LocalOnly')} />
        <Copy muted>{calendarDisposition === 'LocalOnly' ? t('m_c905013aab29') : managed.data.calendarName}</Copy>
        {recurrence?.zoneMode === 'floating' && calendarDisposition !== 'LocalOnly' && <Copy muted>{t('m_09f21e33c391')}{zone} {t('m_0bdc93934138')}</Copy>}
        {draft.allDay && managed.data.calendarZone !== zone && calendarDisposition !== 'LocalOnly' && <Copy muted>{t('m_4171fe0e2802')}{zone}{t('m_2307d01ab2a5')}{managed.data.calendarZone}{t('m_6e558a290d11')}</Copy>}
      </ConnectedGroup>}
      {!routine && creation && managed.error && <ActionFeedback message={t('m_7ef8b1a640de')} tone="warning" />}
      {!routine && <Disclosure title={t('m_22609ce661b0')} icon="event" summary={calendarSummary} forceOpen={!noAlert && !!invalid(['eventStartMs', 'allDay', 'eventEndMs']) || !!invalid(['eventEndMs'])}>
        <Copy muted size={13}>{creation && managed.data?.calendarId && managed.data.mode !== 'Disabled' && calendarDisposition !== 'LocalOnly' ? t('m_dcfcd4d17b81') : t('m_5da6242c60ee')}</Copy>
        <ConnectedGroup footer={invalid(['eventStartMs', 'allDay', 'eventEndMs']) ? <Status label={message} tone="danger" /> : undefined}>
          {!noAlert && <View key="start"><RowSupport><Copy muted size={14}>{t('m_1d7fc661c9ce')}</Copy></RowSupport>
            <DateTimeFields labelPrefix={t('m_4e1f49a9c8ae')} value={resolvedDraft.eventStartMs} zoneId={zone} allDay={!!draft.allDay}
              onError={dateError} onChange={moveCalendarEvent} disabled={frozen} /></View>}
          {!noAlert && <Toggle key="all-day" label={t('m_5770b00a6ef5')} value={draft.allDay ?? false} disabled={frozen} onChange={changeAllDay} />}
          {!draft.allDay && <DateField key="ends" label={t('m_e98982c9f2ba')} value={draft.eventEndMs} zoneId={zone} onError={dateError} onChange={(eventEndMs) => {
            if (eventEndMs !== draft.eventEndMs) patch({ eventEndMs, ...(!noAlert ? { alarmLinked: false } : {}) });
          }} disabled={frozen} />}
        </ConnectedGroup>
      </Disclosure>}
      {!routine && <Disclosure title={t('m_fd7a9893f84d')} icon="settings" forceOpen={!!invalid(['dueAtMs', 'zoneId']) || noAlert && !!invalid(['allDay'])}>
        <View style={{ gap: space.md }}>
          {noAlert && <ConnectedGroup footer={invalid(['allDay']) ? <Status label={message} tone="danger" /> : undefined}>
            <Toggle key="all-day" label={t('m_34233e542b7b')} value={draft.allDay ?? false} disabled={frozen} onChange={changeAllDay} />
          </ConnectedGroup>}
          <ConnectedGroup footer={invalid(['dueAtMs']) ? <Status label={message} tone="danger" /> : undefined}>
            <Toggle key="due-link" label={t('m_507753221ac2')} value={draft.dueLinked ?? true} disabled={frozen} onChange={(dueLinked) => {
              if (dueLinked && !pendingSave.current && !timingWork.current) timedSnapshot.current = relinkTimedSnapshot(timedSnapshot.current, 'due');
              const dueAtMs = dueLinked ? draft.allDay ? preview.data?.eventEndMs ?? draft.eventEndMs : draft.eventStartMs : preview.data?.dueAtMs ?? draft.dueAtMs;
              patch({ dueLinked, dueAtMs, ...(dueLinked && draft.alarmLinked && !draft.allDay ? { alarmAtMs: dueAtMs } : {}) });
            }} />
            {!draft.dueLinked && <DateField key="due" label={t('m_9071738f1459')} value={draft.dueAtMs} zoneId={zone} onError={dateError} onChange={changeDue} disabled={frozen} />}
          </ConnectedGroup>
          {draft.mode !== 'None' && <ConnectedGroup>
            <Toggle key="alert-link" label={draft.allDay ? modeLabel(draft.mode) + t('m_292c0d004ff0') : modeLabel(draft.mode) + t('m_5be8b201f432')} value={draft.alarmLinked ?? true} disabled={frozen} onChange={(alarmLinked) => {
              if (alarmLinked && !pendingSave.current && !timingWork.current) timedSnapshot.current = relinkTimedSnapshot(timedSnapshot.current, 'alarm');
              patch({ alarmLinked, alarmAtMs: alarmLinked && !draft.allDay ? preview.data?.dueAtMs ?? draft.dueAtMs : preview.data?.alarmAtMs ?? draft.alarmAtMs });
            }} />
          </ConnectedGroup>}
          {!recurrence && <ConnectedGroup footer={<Copy muted size={13}>{t('m_a367dcc89451')}</Copy>}>
            <TimeZoneField key="zone" value={zone} atMs={draft.eventStartMs} disabled={frozen} onChange={(next) => { void changeZone(next, undefined).catch(() => {}); }} error={invalid(['zoneId'])} />
          </ConnectedGroup>}
        </View>
      </Disclosure>}
      {draft.mode === 'Alarm' && <Disclosure title={t('m_8c648567f73c')} forceOpen={!!invalid(['sound', 'vibration'])}>
        <ConnectedGroup>
          <SoundPicker key="sound" value={draft.sound ?? settings.data?.sound ?? 'remilo'} onChange={(sound) => patch({ sound })} disabled={frozen} />
          <Toggle key="vibration" icon="vibration" label={t('m_59e1fd02f6c2')} value={draft.vibration ?? settings.data?.vibration ?? true} disabled={frozen} onChange={(vibration) => patch({ vibration })} />
        </ConnectedGroup>
      </Disclosure>}
      {!routine && preview.data && <>
        {recurrence && <Group title={t('m_2cc2a7090f66')}>{preview.data.upcoming.map((slot) => <View key={slot.nominalSlot} style={{ padding: 12, gap: 3 }}>
          <Copy size={14}>{formatTime(noAlert ? slot.eventStartMs : slot.alarmAtMs, slot.zoneId)}</Copy><Copy muted size={13}>{slot.adjusted ? t('m_05aa0106edd0') : ''}{noAlert ? t('m_d1af410eb4d0') : modeLabel(draft.mode)}</Copy>
        </View>)}{preview.data.upcoming.length < 3 && <Copy muted size={13}>{t('m_07714689fced')}</Copy>}</Group>}
        {preview.data.warnings.map((warning) => <ActionFeedback tone="warning" message={warning} key={warning} />)}
      </>}
      {editingSeries && <Copy muted size={13}>{t('m_197c9d025305')}{editingSeries.state === 'Paused' ? t('m_dd7df50aa500') : ''}</Copy>}
      {!routine && preview.error && <Status label={t('m_034ec8f75aa9')} tone="warning" />}
    </View>
    {command.error instanceof CommandError && command.error.code?.startsWith('STALE') && !review && !scopeChanged && <Button label={t('m_ba805b089799')} variant="secondary" disabled={busy} onPress={() => void loadReview()} />}
    <Sheet title={t('routine_change_review')} visible={routineReviewOpen} onClose={() => setRoutineReviewOpen(false)}>
      <Copy muted>{t('m_fe8e0e6d9197')}</Copy>
      <QueryState loading={routinePlans.isFetching} error={routinePlans.error} empty={!latestRoutine && !routinePlans.isFetching} emptyMessage={t('routine_load_error')} onRetry={() => void loadReview()} />
      {latestRoutine && <><Copy heading>{latestRoutine.title}</Copy><Copy muted>{modeLabel(latestRoutine.mode)}</Copy>
        <Copy muted>{formatTime(routineSeed(latestRoutine).state.draft.alarmAtMs)}</Copy>
        <Copy muted>{lists.data?.find(list => list.id === latestRoutine.listId)?.name ?? t('m_eacd31d849f9')}</Copy>
        {!!latestRoutine.notes && <Copy muted>{latestRoutine.notes}</Copy>}
        {latestRoutine.days.map((day, index) => <View key={index}><Copy heading>{t(routineDayKeys[index])}</Copy>
          <Copy muted>{day.type === 'Rest' ? t('routine_rest') : day.exercises.map(exercise => [exercise.name, exercise.target].filter(Boolean).join(' · ')).join('\n')}</Copy></View>)}</>}
      <Button label={t('routine_keep_draft')} disabled={!latestRoutine || !!routinePlans.error || routinePlans.isFetching} onPress={keepRoutineDraft} />
      <Button label={t('routine_load_latest')} variant="secondary" disabled={!latestRoutine || !!routinePlans.error || routinePlans.isFetching} onPress={restoreRoutine} />
    </Sheet>
    <Sheet title={t('m_6a47708f4e14')} visible={reviewOpen && !!review} onClose={() => setReviewOpen(false)}>
      <Copy muted>{t('m_bfc89b6b5977')}</Copy>
      {review?.conflicts.map((conflict) => <Group key={conflict.key} title={conflict.label}>
        <Choice label={t('m_8b49b125b4f7') + conflictValue(conflict, 'yours')} selected={review.choices[conflict.key] === 'yours'}
          onPress={() => setReview((current) => current && ({ ...current, choices: { ...current.choices, [conflict.key]: 'yours' } }))} />
        <Choice label={t('m_12b314ec08eb') + conflictValue(conflict, 'latest')} selected={review.choices[conflict.key] === 'latest'}
          onPress={() => setReview((current) => current && ({ ...current, choices: { ...current.choices, [conflict.key]: 'latest' } }))} />
      </Group>)}
      {!review?.conflicts.length && <Copy>{t('m_9f44826b3291')}</Copy>}
      {reviewed && <Group title={t('m_a7af60ac4952')}><View style={{ padding: 14, gap: 8 }}>
        <Copy>{reviewed.draft.title}</Copy>
        <Copy size={14}>{t('m_81e3da2d16a6')}{formatTime(reviewed.draft.eventStartMs, reviewed.draft.zoneId)}{reviewed.draft.allDay ? t('m_b3d544d5d55c') : ''}</Copy>
        <Copy size={14}>{t('m_df5b477708b5')}{formatTime(reviewed.draft.dueAtMs, reviewed.draft.zoneId)}</Copy>
        <Copy size={14}>{reviewed.draft.mode === 'None' ? t('m_d1af410eb4d0') : reviewed.draft.mode + ': ' + formatTime(reviewed.draft.alarmAtMs, reviewed.draft.zoneId)}</Copy>
        <Copy size={14}>{repeatLabel(reviewed.recurrence)}</Copy>
        <Copy muted size={13}>{reviewed.draft.zoneId} · {reviewed.draft.listId == null ? t('m_eacd31d849f9') : lists.data?.find((list) => list.id === reviewed.draft.listId)?.name ?? t('m_3331733936a8')}</Copy>
        {!!reviewed.draft.notes && <Disclosure title={t('m_8a7525b1492f')}><Copy>{reviewed.draft.notes}</Copy></Disclosure>}
      </View></Group>}
      <Button label={t('m_afbcdf6df605')} disabled={!!review && !reviewChoicesComplete(review.conflicts, review.choices)} onPress={() => applyReview()} />
      <Button label={t('m_cb5bbbf3fd17')} variant="secondary" onPress={() => confirm(t('m_429d9268fd98'), t('m_7f95399f0f5d'),
        [{ text: t('m_bbcc810f654f'), style: 'cancel' }, { text: t('m_bdc090ec61e3'), style: 'destructive', onPress: () => applyReview(true) }])} />
    </Sheet>
  </Page>;
}
