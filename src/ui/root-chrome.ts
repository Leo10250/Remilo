import { createContext } from 'react';
import type { RootTab } from '../domain/navigation';

export type RootBarState = { disabled: boolean; isGuarded: () => boolean };

export const RootChrome = createContext<{
  selected: RootTab;
  shown: RootTab;
  select: (tab: RootTab) => void;
  register: (bar: RootBarState) => () => void;
} | null>(null);
