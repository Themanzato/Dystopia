import { useSyncExternalStore } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import type { SurvivalState } from '../game/survival';
let current: SharedValue<SurvivalState> | null = null;
const listeners = new Set<() => void>();
export function publishCurrentRun(run: SharedValue<SurvivalState>) {
  current = run; listeners.forEach(fn => fn());
  return () => { if (current === run) { current = null; listeners.forEach(fn => fn()); } };
}
export function useCurrentRun() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current, () => null);
}
