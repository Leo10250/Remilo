import { useSyncExternalStore } from 'react';
import type { Tone } from '../domain/actions';
export type Notice = { message: string; tone?: Tone; persistent?: boolean;
  action?: { label: string; occurrenceId?: string; segmentId?: string }; id: number };
let notice: Notice | null = null;
let sequence = 0;
const listeners = new Set<() => void>();
export function notify(value: Omit<Notice, 'id'>) { notice = { ...value, id: ++sequence }; listeners.forEach((listener) => listener()); }
export function dismissNotice(id: number) { if (notice?.id === id) { notice = null; listeners.forEach((listener) => listener()); } }
export function useNotice() { return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => notice, () => notice); }
