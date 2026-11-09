import { useQuery } from '@tanstack/react-query';
import type { CalendarConnection } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { engine, iosReminders, nativeAvailable, useIOSCalendarManualLink } from './native';

export function useCalendarLinks(enabled = true) {
  const manual = useIOSCalendarManualLink();
  const connection = useQuery({
    queryKey: ['calendar', 'connection'],
    queryFn: () => engine().getCalendarConnection(),
    enabled: enabled && manual,
  });
  const current = !connection.error ? connection.data : undefined;
  const revision = current?.revision;
  const links = useQuery({
    queryKey: iosReminders ? ['calendar', 'links', revision] : ['calendar', 'links'],
    queryFn: () =>
      iosReminders ? engine().getCalendarLinks(revision!) : engine().getCalendarLinks(),
    enabled: enabled && nativeAvailable && (!iosReminders || (manual && !!current?.connected)),
  });
  return { manual, connection, current, links };
}

export function useIOSCalendarLinkCandidate(
  id: string,
  current: CalendarConnection | undefined,
  enabled = true,
) {
  const manual = useIOSCalendarManualLink();
  const candidate = useQuery({
    queryKey: ['calendar', 'manual-candidate', id, current?.revision],
    queryFn: () => engine().getCalendarLinkCandidate!(id, current!.revision),
    enabled: enabled && manual && !!current?.connected && !!id,
  });
  return {
    eligible:
      enabled && manual && !!current?.connected && !candidate.error && candidate.data === true,
    loading: candidate.isLoading,
    error: candidate.error,
  };
}
