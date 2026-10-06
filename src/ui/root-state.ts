import { useCallback, useState, type SetStateAction } from 'react';
import { readRootSnapshot, writeRootSnapshot } from '../domain/navigation';
export function useRootState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readRootSnapshot(key, fallback));
  const update = useCallback((next: SetStateAction<T>) => setValue((current) => {
    const resolved = typeof next === 'function' ? (next as (prior: T) => T)(current) : next;
    writeRootSnapshot(key, resolved); return resolved;
  }), [key]);
  return [value, update] as const;
}
