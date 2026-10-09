import { useQueryClient } from '@tanstack/react-query';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { Occurrence } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import type { Tone } from '../domain/actions';
import { BulkOperation, bulkSummary, captureBulk, type BulkKind } from '../domain/bulk-actions';
import { ActionFeedback, Button, Copy, Sheet } from './components';
import { useAppearanceConfirmation } from './confirmation';
import { engine } from './native';
import { useAppearanceHold } from './theme';

export function useBulkActions() {
  const client = useQueryClient(), confirm = useAppearanceConfirmation();
  const [, render] = useState(0);
  const [operation] = useState(() => new BulkOperation(command => engine().applyCommand(command), () => render(value => value + 1)));
  const running = useRef(false), [busy, setBusy] = useState(false), [guarded, setGuarded] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: Tone }>();
  const isGuarded = () => running.current || operation.pending;
  useAppearanceHold(busy || guarded);
  usePreventRemove(busy || guarded, () => confirm('Actions not yet confirmed', 'Wait for these actions, or retry the same batch before leaving.'));
  const perform = async (kind?: BulkKind, items?: readonly Occurrence[]) => {
    if (running.current || kind && operation.pending) return;
    const captured = operation.pending ? operation.job : kind && items ? captureBulk(kind, items, () => engine().createOperationId()) : undefined;
    if (!captured) return;
    running.current = true; setBusy(true); setGuarded(true); setFeedback(undefined);
    try {
      await operation.run(captured);
      const progress = operation.progress;
      setFeedback({ message: bulkSummary(captured, progress), tone: progress.rejected || progress.deliveryProblems ? 'warning' : 'success' });
    } catch (error) {
      setFeedback({ message: bulkSummary(captured, operation.progress) + ' ' + (error instanceof Error ? error.message : 'Could not confirm this action.'), tone: 'danger' });
    } finally {
      running.current = false; setBusy(false); setGuarded(operation.pending); render(value => value + 1);
      void client.invalidateQueries();
    }
  };
  return { busy, guarded, isGuarded, job: operation.job, progress: operation.progress, outcomes: operation.outcomes, feedback,
    execute: (kind: BulkKind, items: readonly Occurrence[]) => { void perform(kind, items).catch(error => setFeedback({ message: error instanceof Error ? error.message : 'Could not capture this selection.', tone: 'danger' })); },
    retry: () => { void perform(); }, clear: () => { if (!isGuarded()) { operation.clear(); setFeedback(undefined); } } };
}

export function BulkRecovery({ action }: { action: ReturnType<typeof useBulkActions> }) {
  const [results, showResults] = useState(false), failures = action.outcomes.filter(outcome => outcome.result.status === 'Rejected');
  const unresolved = action.guarded && !action.busy ? action.job?.entries[action.outcomes.length] : undefined;
  return <>
    <ActionFeedback loading={action.busy} message={action.busy ? `${action.progress.confirmed + action.progress.rejected} of ${action.progress.total} results received…` : action.feedback?.message} tone={action.feedback?.tone} />
    {action.guarded && !action.busy && <>
      {unresolved && <Copy>{'Awaiting confirmation: ' + unresolved.title}</Copy>}
      <Copy muted size={14}>The batch is not confirmed. Retry keeps the same selected reminders and actions.</Copy>
    </>}
    {!action.guarded && !!failures.length && <Button label="Review results" variant="secondary" onPress={() => { if (!action.isGuarded()) showResults(true); }} />}
    <Sheet title="Bulk action results" visible={results} onClose={() => showResults(false)}>
      {action.job && <Copy>{bulkSummary(action.job, action.progress)}</Copy>}
      {failures.map(outcome => <View key={outcome.entry.id} style={{ gap: 4, padding: 16 }}>
        <Copy>{outcome.entry.title}</Copy><Copy muted size={14}>{outcome.result.errorMessage ?? 'This reminder changed or is unavailable. Refresh before selecting it again.'}</Copy>
      </View>)}
    </Sheet>
  </>;
}
