import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { HandoffScope, type HandoffTicket } from '../domain/handoff';

/** Defers acknowledgement feedback while the captured OS share owns focus. */
export function usePageHandoff(onActive: () => void) {
  const [scope] = useState(() => new HandoffScope(AppState.currentState === 'active'));
  const activeCallback = useRef(onActive), queued = useRef<{ ticket: HandoffTicket; apply: () => void }[]>([]);
  useEffect(() => { activeCallback.current = onActive; }, [onActive]);
  const flush = useCallback(() => {
    if (!scope.active()) return;
    activeCallback.current();
    const waiting = queued.current; queued.current = [];
    waiting.forEach(({ ticket, apply }) => { if (scope.canPublish(ticket)) apply(); });
  }, [scope]);
  useFocusEffect(useCallback(() => {
    scope.focus(true); scope.foregroundChanged(AppState.currentState === 'active'); flush();
    return () => { scope.focus(false); queued.current = []; };
  }, [scope, flush]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { scope.foregroundChanged(state === 'active'); flush(); });
    return () => { subscription.remove(); scope.focus(false); queued.current = []; };
  }, [scope, flush]);
  const commit = useCallback((ticket: HandoffTicket, apply: () => void) => {
    if (!scope.current(ticket)) return;
    if (scope.canPublish(ticket)) apply();
    else queued.current.push({ ticket, apply });
  }, [scope]);
  return { scope, commit };
}
