import type { CommandResult, CreateCommand } from '../../modules/remilo-alarm/src/RemiloAlarm.types';

export function quickReminder(title: string, minutes: string, now: number, operationId: string): CreateCommand {
  const delay = Number(minutes);
  if (!title.trim() || title.trim().length > 200) throw new Error('Enter a title of 1–200 characters.');
  if (!minutes.trim() || !Number.isFinite(delay) || delay < 1) throw new Error('Choose a delay of at least one minute.');
  const alarmAtMs = now + Math.round(delay * 60_000);
  if (!Number.isSafeInteger(alarmAtMs) || alarmAtMs > 8_640_000_000_000_000) throw new Error('Choose a valid future time.');
  return { kind: 'Create', operationId, title: title.trim(), alarmAtMs };
}

export function commandFeedback(result: CommandResult): string {
  switch (result.status) {
    case 'Scheduled': return 'Saved and registered with Android. Sound depends on your device settings.';
    case 'Blocked': return 'Saved, but alarm delivery is blocked. Check permissions and notification settings.';
    case 'Pending': return 'Saved. Scheduling is still pending; refresh to check its state.';
    case 'Applied': return 'Action applied. The reminder remains unfinished.';
    case 'Rejected': return result.errorCode === 'STALE_GENERATION'
      ? 'This reminder changed. Refresh and try again.' : `Action rejected (${result.errorCode ?? 'unknown'}).`;
  }
}
