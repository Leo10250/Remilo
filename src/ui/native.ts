import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alarm from '../../modules/remilo-alarm/src/RemiloAlarmModule';
import type { Command, CommandResult } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { useEffect, useSyncExternalStore } from 'react';
import { Preferences } from '../domain/preferences';

export function engine() {
  if (!Alarm) throw new Error('Install the Android build to use reminders on this device.');
  return Alarm;
}
export class CommandError extends Error {
  field?: string;
  code?: string;
  constructor(result: CommandResult) {
    super(result.errorMessage ?? (result.errorCode?.startsWith('STALE')
      ? 'This reminder changed. Refresh it and try again.' : 'The action could not be applied. Refresh and try again.'));
    this.field = result.errorField;
    this.code = result.errorCode;
  }
}
export async function apply(command: Command) {
  const clean = Object.fromEntries(Object.entries(command).filter(([, value]) => value !== undefined)) as Command;
  const result = await engine().applyCommand(clean);
  if (result.status === 'Rejected') throw new CommandError(result);
  return result;
}
export function useCommand() {
  const client = useQueryClient();
  return useMutation({ mutationFn: apply, onSettled: () => void client.invalidateQueries() });
}
export function useSettings() {
  const query = useQuery({ queryKey: ['settings'], queryFn: () => engine().getSettings(), enabled: !!Alarm });
  const state = useSyncExternalStore(preferences.subscribe, preferences.snapshot, preferences.snapshot);
  useEffect(() => { if (query.data) preferences.prime(query.data); }, [query.data]);
  return { ...query, data: state.data ?? query.data, saving: state.saving, saveError: state.error };
}
export const preferences = new Preferences({
  read: () => engine().getSettings(),
  id: () => engine().createOperationId(),
  write: async (job) => { await apply({ ...job.patch, kind: 'Settings', expectedRevision: job.revision, operationId: job.operationId }); },
});
export function useCapabilities() {
  return useQuery({ queryKey: ['capabilities'], queryFn: () => engine().getCapabilities(), enabled: !!Alarm });
}
export const nativeAvailable = !!Alarm;
