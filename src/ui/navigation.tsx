import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { destinationRoute, originParams, rootRoute, type secondaryOriginRoute, type DestinationOrigin, type RootDestination } from '../domain/navigation';
import { CapturedOperation } from '../domain/operation';
import { ActionFeedback, Button, Choice, Field, Icon, IconButton, QueryState, SettingRow, Sheet, Snackbar } from './components';
import { dismissNotice, notify, useNotice, type Notice } from './feedback';
import { apply, CommandError, engine, nativeAvailable } from './native';
import type { Command, CommandResult, ListRecord, Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { commandFeedback, recoveryPresentation, restoreDeleted, type Tone } from '../domain/actions';
import { useAppearanceHold, useFontScaleOverride, useTheme } from './theme';
import { typography } from './tokens';
import { rootLabelsFit } from '../domain/navigation-fit';
import { useTimeDisplay } from './time-display';
import { useAppearanceConfirmation } from './confirmation';

export function switchRoot(destination: RootDestination) { Keyboard.dismiss(); if (router.canDismiss()) router.dismissAll(); router.replace(rootRoute(destination)); }
export function returnToOrigin(destination: DestinationOrigin) { Keyboard.dismiss(); router.dismissTo(destinationRoute(destination)); }
export function goBack(origin: DestinationOrigin, fallback?: ReturnType<typeof secondaryOriginRoute>) { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace(fallback ?? destinationRoute(origin)); }

/** Navigation resolves mounted transient state before changing a root or origin. */
export function useDestinationNavigation(destination: DestinationOrigin, beforeBack?: () => boolean, guarded = false, secondaryOrigin?: DestinationOrigin, secondaryFallback?: ReturnType<typeof secondaryOriginRoute>) {
  const back = useCallback(() => {
    if (guarded) return true;
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
    if (beforeBack?.()) return true;
    if (destination.kind === 'list' || destination.kind === 'repeats' || secondaryOrigin) { goBack(secondaryOrigin ?? { kind: 'lists' }, secondaryFallback); return true; }
    if (destination.kind !== 'agenda') { switchRoot({ kind: 'agenda' }); return true; }
    return false;
  }, [destination, beforeBack, guarded, secondaryOrigin, secondaryFallback]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', back);
    return () => subscription.remove();
  }, [back]));
  return back;
}

const rootEntries = [{ kind: 'agenda', label: 'Agenda', icon: 'event' }, { kind: 'lists', label: 'Lists', icon: 'checklist' },
  { kind: 'completed', label: 'Completed', icon: 'check_circle' }, { kind: 'trash', label: 'Trash', icon: 'delete' }] as const;
export function RootNavigation({ destination, disabled = false, atRoot = true, isGuarded }: { destination: RootDestination['kind']; disabled?: boolean; atRoot?: boolean; isGuarded?: () => boolean }) {
  const colors = useTheme(), scale = useFontScaleOverride(), { width, fontScale } = useWindowDimensions(), locale = useTimeDisplay().localeTag;
  const focused = useIsFocused();
  const [available, setAvailable] = useState(width), [open, setOpen] = useState(false);
  const key = [available, fontScale, scale, locale].join('|');
  const [measurement, setMeasurement] = useState<{ key: string; widths: Record<string, number>; fits: boolean }>({ key: '', widths: {}, fits: !(Math.max(scale, fontScale) >= 1.6 && width < 600) });
  const widths = rootEntries.map(entry => measurement.widths[entry.kind]);
  const ready = measurement.key === key && widths.every(value => value != null);
  const fits = ready ? rootLabelsFit(available, widths) : measurement.fits;
  const measure = (kind: string, measured: number) => setMeasurement(previous => {
    const values = previous.key === key ? previous.widths : {};
    const next = { ...values, [kind]: measured };
    const resolved = rootEntries.map(entry => next[entry.kind]);
    return previous.key === key && values[kind] === measured ? previous : { key, widths: next, fits: resolved.every(value => value != null) ? rootLabelsFit(available, resolved) : previous.fits };
  });
  const compact = open || !fits, trigger = useRef<View>(null);
  const blocked = () => disabled || !!isGuarded?.();
  const current = rootEntries.find(entry => entry.kind === destination)!;
  const choose = (entry: typeof rootEntries[number]) => {
    if (blocked()) return;
    setOpen(false);
    if (entry.kind !== destination || !atRoot) switchRoot({ kind: entry.kind });
  };
  return <View onLayout={event => setAvailable(event.nativeEvent.layout.width)} style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 8 }}>
    <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: available, opacity: 0 }}>
      {rootEntries.map(entry => <Text key={key + entry.kind} onLayout={event => measure(entry.kind, Math.ceil(event.nativeEvent.layout.width))} onTextLayout={event => {
        const measured = Math.ceil(event.nativeEvent.lines.reduce((sum, line) => sum + line.width, 0));
        measure(entry.kind, measured);
      }} style={{ alignSelf: 'flex-start', fontSize: typography.supporting * scale, lineHeight: typography.supporting * scale * 1.4, fontWeight: '600' }}>{entry.label}</Text>)}
    </View>
    {compact ? <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={'Current destination: ' + current.label + '. Open navigation.'}
      aria-expanded={open} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => { if (!blocked()) { Keyboard.dismiss(); setOpen(true); } }}
      style={({ pressed }) => ({ minHeight: 64, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, backgroundColor: pressed ? colors.soft : 'transparent' })}>
      <Icon name={current.icon} color={colors.accent} /><Text style={{ flex: 1, color: colors.accent, fontSize: typography.supporting * scale, lineHeight: typography.supporting * scale * 1.4, fontWeight: '600' }}>{current.label}</Text><Icon name="expand_more" color={colors.muted} />
    </Pressable> : <View accessibilityRole="tablist" style={{ flexDirection: 'row' }}>
      {rootEntries.map(entry => { const selected = destination === entry.kind; return <Pressable key={entry.kind} ref={selected ? trigger : undefined} accessibilityRole="tab" accessibilityLabel={entry.label}
        aria-selected={selected} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => choose(entry)}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 64, padding: 8, gap: 4, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: selected ? colors.soft : 'transparent' }}><Icon name={entry.icon} color={selected ? colors.accent : colors.muted} /></View>
        <Text style={{ color: selected ? colors.accent : colors.muted, fontSize: typography.supporting * scale, lineHeight: typography.supporting * scale * 1.4, alignSelf: 'stretch', textAlign: 'center', fontWeight: selected ? '600' : '400' }}>{entry.label}</Text>
      </Pressable>; })}
    </View>}
    <Sheet title="Go to" visible={open} onClose={() => setOpen(false)} returnFocusRef={trigger} returnFocusWhen={() => focused}>
      {rootEntries.map(entry => <Choice key={entry.kind} icon={entry.icon} label={entry.label} selected={entry.kind === destination} disabled={disabled} onPress={() => choose(entry)} />)}
    </Sheet>
  </View>;
}

export type CapturedJob = { command: Command; success: string; item?: Occurrence };
export function useCapturedCommand(onApplied?: (job: CapturedJob, result: CommandResult) => string | false | void) {
  const confirm = useAppearanceConfirmation();
  const client = useQueryClient(), applied = useRef(onApplied);
  useEffect(() => { applied.current = onApplied; }, [onApplied]);
  const [operation] = useState(() => new CapturedOperation<CapturedJob, CommandResult>((job) => apply(job.command), (error) => error instanceof CommandError));
  const running = useRef(false), [busy, setBusy] = useState(false), [guarded, setGuarded] = useState(false);
  useAppearanceHold(busy || guarded);
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone }>();
  usePreventRemove(busy || guarded, () => confirm('Change not yet confirmed', 'Wait for this change, or retry the same change before leaving.'));
  const execute = async (job: CapturedJob) => {
    if (running.current) return;
    running.current = true; setBusy(true); setGuarded(true); setFeedback(undefined);
    const captured = operation.captured ?? job;
    try {
      const result = await operation.run(captured);
      const success = applied.current?.(captured, result);
      const feedback = commandFeedback(result, typeof success === 'string' ? success : captured.success);
      // A caller showing a snackbar owns confirmed success; recovery stays here.
      setFeedback(success === false && feedback.tone === 'success' ? undefined : feedback);
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Could not confirm this change. Retry the same change.', tone: 'danger' }); }
    finally { running.current = false; setBusy(false); setGuarded(operation.pending); void client.invalidateQueries(); }
  };
  return { busy, guarded, feedback, recovery: recoveryPresentation(operation.captured?.command.kind), execute, isGuarded: () => running.current || operation.pending, retry: () => { if (operation.captured) void execute(operation.captured); } };
}
export function CommandRecovery({ action }: { action: ReturnType<typeof useCapturedCommand> }) {
  return <><ActionFeedback loading={action.busy} message={action.busy ? action.recovery.progress : action.guarded ? action.recovery.message : action.feedback?.message} tone={action.guarded ? 'warning' : action.feedback?.tone} />
    {action.guarded && !action.busy && <Button label={action.recovery.retry} onPress={action.retry} />}</>;
}

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
  if (notice.action?.alarmCheck) router.push({ pathname: '/alarm-check', params: notice.action.alarmCheck });
  else if (notice.action?.occurrenceId) router.navigate({ pathname: '/reminder/[id]', params: { ...notice.action.origin, id: notice.action.occurrenceId } });
  else if (notice.action?.segmentId) router.navigate({ pathname: '/series/[id]', params: { ...notice.action.origin, id: notice.action.segmentId } });
  dismissNotice(notice.id);
}
export function RootNotice({ disabled = false }: { disabled?: boolean } = {}) {
  const focused = useIsFocused();
  const notice = useNotice(), client = useQueryClient();
  if (!notice || !focused) return null;
  return <Snackbar key={notice.id} message={notice.message} action={notice.action?.label} persistent={notice.persistent || disabled} actionDisabled={disabled}
    onAction={() => { if (!disabled) void activateNotice(notice).finally(() => { void client.invalidateQueries(); }); }}
    onClose={() => dismissNotice(notice.id)} />;
}

export function RootMore({ origin, disabled = false, extra, listActions }: { origin: DestinationOrigin; disabled?: boolean; extra?: ReactNode; listActions?: { rename: () => void; remove: () => void } }) {
  const [open, setOpen] = useState(false);
  const close = () => { Keyboard.dismiss(); setOpen(false); };
  const record = (view: 'completed' | 'deleted') => { close(); router.push({ pathname: '/records', params: { view, ...originParams(origin) } }); };
  return <><IconButton icon="more_vert" label="More destinations" disabled={disabled} onPress={() => { Keyboard.dismiss(); setOpen(true); }} />
    <Sheet title="More" visible={open} onClose={close}>
      {origin.kind === 'list' && <><SettingRow label="Completed in this list" icon="check_circle" onPress={() => record('completed')} />
        <SettingRow label="Trash in this list" icon="delete" onPress={() => record('deleted')} /></>}
      {extra}
      {listActions && <><SettingRow label="Rename list" icon="edit" onPress={() => { close(); listActions.rename(); }} />
        <SettingRow label="Remove list" icon="delete" onPress={() => { close(); listActions.remove(); }} /></>}
      {origin.kind === 'lists' && <SettingRow label="Manage lists" icon="edit" onPress={() => { close(); router.push({ pathname: '/lists/manage', params: originParams(origin) }); }} />}
      <SettingRow label="Settings" icon="settings" onPress={() => { close(); router.push({ pathname: '/settings', params: originParams(origin) }); }} />
    </Sheet></>;
}

export function ListNameSheet({ visible, list, onSaved, onClose, onGuardChange }: { visible: boolean; list?: ListRecord; onSaved: (id: string) => void; onClose: () => void; onGuardChange?: (guarded: boolean) => void }) {
  const [name, setName] = useState(list?.name ?? '');
  const action = useCapturedCommand((_job, result) => { if (result.list) onSaved(result.list.id); });
  useEffect(() => { onGuardChange?.(action.guarded); return () => onGuardChange?.(false); }, [action.guarded, onGuardChange]);
  const save = () => void action.execute({ command: list ? { kind: 'RenameList', listId: list.id, name, expectedRevision: list.revision, operationId: engine().createOperationId() }
    : { kind: 'CreateList', name, operationId: engine().createOperationId() }, success: 'List saved.' });
  const title = list ? 'Rename list' : 'Create list';
  return <Sheet title={title} visible={visible} onClose={() => { if (!action.guarded) onClose(); }} footer={<View style={{ padding: 16, gap: 8 }}>
    <ActionFeedback message={action.guarded && !action.busy ? action.recovery.message : action.feedback?.message} tone={action.guarded ? 'warning' : action.feedback?.tone} />
    <Button label={action.busy ? 'Saving…' : action.guarded ? 'Retry save' : title} disabled={action.busy || !name.trim()} onPress={action.guarded ? action.retry : save} />
    <Button label="Cancel" variant="secondary" disabled={action.guarded} onPress={onClose} />
  </View>}><Field label="List name" autoFocus value={name} onChangeText={setName} maxLength={60} editable={!action.guarded} error={action.guarded ? undefined : action.feedback?.tone === 'danger' ? action.feedback.message : undefined} /></Sheet>;
}

export function ListPicker({ value, onChange, disabled = false }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const query = useQuery({ queryKey: ['lists'], queryFn: () => engine().queryLists(), enabled: nativeAvailable });
  const [open, setOpen] = useState(false), [create, setCreate] = useState(false);
  return <><SettingRow label="List" icon="checklist" value={value === null ? 'No list' : query.data?.find((list) => list.id === value)?.name ?? 'List unavailable'} onPress={() => setOpen(true)} disabled={disabled} />
    <Sheet title="Choose list" visible={open && !create} onClose={() => setOpen(false)}>
      <Choice label="No list" selected={value === null} onPress={() => { onChange(null); setOpen(false); }} />
      <QueryState loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} />
      {query.data?.map((list) => <Choice key={list.id} label={list.name} selected={value === list.id} onPress={() => { onChange(list.id); setOpen(false); }} />)}
      <Button label="Create new list" icon="add" variant="secondary" onPress={() => setCreate(true)} />
    </Sheet>
    {create && <ListNameSheet visible onClose={() => setCreate(false)} onSaved={(id) => { onChange(id); setCreate(false); setOpen(false); }} />}
  </>;
}
