import { useSyncExternalStore } from 'react';
import type { Tone } from '../domain/actions';
import type { OriginParams } from '../domain/navigation';
import { captureFeedback, presentFeedback, subscribeLanguage } from '../localization';
export type Notice = { message: string; tone?: Tone; persistent?: boolean;
  action?: { label: string; occurrenceId?: string; segmentId?: string; origin?: OriginParams; alarmCheck?: OriginParams; undoRoutineTrash?: { id: string; revision: number; operationId: string }; undoDelete?: { id: string; revision: number; operationId: string } }; id: number };
let notice: Notice | null = null;
let retainedNotice: unknown;
let sequence = 0;
const listeners = new Set<() => void>();
subscribeLanguage(() => { if (notice) { notice = presentFeedback<Notice>(retainedNotice); listeners.forEach(listener => listener()); } });
export function notify(value: Omit<Notice, 'id'>) { retainedNotice = captureFeedback({ ...value, id: ++sequence }); notice = presentFeedback<Notice>(retainedNotice); listeners.forEach((listener) => listener()); }
export function dismissNotice(id: number) { if (notice?.id === id) { notice = null; retainedNotice = undefined; listeners.forEach((listener) => listener()); } }
export function useNotice() { return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => notice, () => notice); }
