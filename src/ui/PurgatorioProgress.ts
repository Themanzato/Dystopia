import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { progressAfterVictory, readPurgatorioProgress, type PurgatorioProgress, type SpecialEnemyId } from '../game/purgatorio';
export const PURGATORIO_PROGRESS_KEY = '@dystopia/purgatorio/v1';
let snapshot: PurgatorioProgress = { cleared: [] };
let hydrated = false, error: string | null = null;
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let pending: SpecialEnemyId[] = [];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());
export const getPurgatorioProgress = () => snapshot;
function persist(value: PurgatorioProgress) {
  const raw = JSON.stringify({ version: 1, cleared: value.cleared });
  writes = writes.then(() => AsyncStorage.setItem(PURGATORIO_PROGRESS_KEY, raw)).then(() => {
    error = null; notify();
  }).catch(() => { error = 'No se pudo guardar el progreso. Se conserva durante esta sesión.'; notify(); });
}
export function loadPurgatorioProgress(): Promise<void> {
  if (loading) return loading;
  loading = AsyncStorage.getItem(PURGATORIO_PROGRESS_KEY).then(raw => {
    let value = readPurgatorioProgress(raw);
    for (const id of pending) value = progressAfterVictory(value, id);
    snapshot = value; hydrated = true; error = null;
    const dirty = pending.length > 0;
    pending = []; notify();
    if (dirty) persist(snapshot);
  }).catch(() => {
    // Do not overwrite an unknown disk frontier with temporary session defaults.
    // A later menu mount retries the read and merges these bounded pending wins.
    error = 'No se pudo leer el progreso. Se conserva durante esta sesión.';
    loading = undefined; notify();
  });
  return loading;
}
export function recordPurgatorioVictory(id: SpecialEnemyId): void {
  const next = progressAfterVictory(snapshot, id);
  if (next === snapshot) return;
  if (!hydrated) pending.push(id);
  snapshot = next; notify();
  if (hydrated) persist(snapshot);
}
export function usePurgatorioProgress() {
  const progress = useSyncExternalStore(subscribe, getPurgatorioProgress, getPurgatorioProgress);
  const storageError = useSyncExternalStore(subscribe, () => error, () => null);
  useEffect(() => { void loadPurgatorioProgress(); }, []);
  return { progress, error: storageError };
}