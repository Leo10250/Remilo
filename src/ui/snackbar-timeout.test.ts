import { afterEach, expect, it, vi } from 'vitest';
import { scheduleSnackbarDismiss } from './snackbar-timeout';

afterEach(() => vi.useRealTimers());

it('expires ordinary feedback and gives Undo its longer action deadline', async () => {
  vi.useFakeTimers();
  const message = vi.fn(), undo = vi.fn(), accessibility = { isScreenReaderEnabled: async () => false };
  scheduleSnackbarDismiss(message, accessibility, 5_000);
  scheduleSnackbarDismiss(undo, accessibility, 10_000);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(message).toHaveBeenCalledOnce(); expect(undo).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(undo).toHaveBeenCalledOnce();
});

it('honors a longer Android accessibility action timeout', async () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  scheduleSnackbarDismiss(dismiss, { isScreenReaderEnabled: async () => false,
    getRecommendedTimeoutMillis: async () => 30_000 }, 10_000);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(dismiss).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(20_000);
  expect(dismiss).toHaveBeenCalledOnce();
});

it('still dismisses when either platform accessibility query rejects', async () => {
  vi.useFakeTimers();
  const readerFailure = vi.fn(), timeoutFailure = vi.fn();
  scheduleSnackbarDismiss(readerFailure, { isScreenReaderEnabled: async () => { throw new Error('Unavailable'); } }, 5_000);
  scheduleSnackbarDismiss(timeoutFailure, { isScreenReaderEnabled: async () => false,
    getRecommendedTimeoutMillis: async () => { throw new Error('Unavailable'); } }, 5_000);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(readerFailure).toHaveBeenCalledOnce(); expect(timeoutFailure).toHaveBeenCalledOnce();
});

it('retains screen-reader feedback for explicit dismissal', async () => {
  vi.useFakeTimers();
  const dismiss = vi.fn(), recommended = vi.fn(async () => 5_000);
  scheduleSnackbarDismiss(dismiss, { isScreenReaderEnabled: async () => true, getRecommendedTimeoutMillis: recommended }, 5_000);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(dismiss).not.toHaveBeenCalled(); expect(recommended).not.toHaveBeenCalled();
});

it('cancels an old notice while its platform query is still resolving', async () => {
  vi.useFakeTimers();
  let resolve!: (value: number) => void;
  const pending = new Promise<number>(done => { resolve = done; }), oldDismiss = vi.fn(), nextDismiss = vi.fn();
  const cancel = scheduleSnackbarDismiss(oldDismiss, { isScreenReaderEnabled: async () => false,
    getRecommendedTimeoutMillis: () => pending }, 5_000);
  await vi.advanceTimersByTimeAsync(0);
  cancel();
  scheduleSnackbarDismiss(nextDismiss, { isScreenReaderEnabled: async () => false }, 10_000);
  resolve(5_000);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(oldDismiss).not.toHaveBeenCalled(); expect(nextDismiss).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(nextDismiss).toHaveBeenCalledOnce();
});

it('clears a scheduled deadline and rejects invalid or shorter platform durations', async () => {
  vi.useFakeTimers();
  const cancelled = vi.fn(), short = vi.fn(), invalid = vi.fn();
  const cancel = scheduleSnackbarDismiss(cancelled, { isScreenReaderEnabled: async () => false }, 5_000);
  scheduleSnackbarDismiss(short, { isScreenReaderEnabled: async () => false, getRecommendedTimeoutMillis: async () => 0 }, 5_000);
  scheduleSnackbarDismiss(invalid, { isScreenReaderEnabled: async () => false, getRecommendedTimeoutMillis: async () => NaN }, 5_000);
  await vi.advanceTimersByTimeAsync(1_000);
  cancel();
  await vi.advanceTimersByTimeAsync(3_999);
  expect(short).not.toHaveBeenCalled(); expect(invalid).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(cancelled).not.toHaveBeenCalled(); expect(short).toHaveBeenCalledOnce(); expect(invalid).toHaveBeenCalledOnce();
});
