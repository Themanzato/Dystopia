import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { progressAfterVictory, readPurgatorioProgress, type PurgatorioProgress, type SpecialEnemyId } from '../game/purgatorio';
export const PURGATORIO_PROGRESS_KEY = '@dystopia/purgatorio/v1';
let snapshot: PurgatorioProgress = { cleared: [] };
let hydrated = false, error: string | null = null;
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let pending: SpecialEnemyId[] = [];
let saved = '', queued = '';
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(listener => listener());
export const getPurgatorioProgress = () => snapshot;
function persist(value: PurgatorioProgress) {
  const raw = JSON.stringify({ version: 2, cleared: value.cleared });
  if (raw === saved || raw === queued) return;
  queued = raw;
  writes = writes.then(() => AsyncStorage.setItem(PURGATORIO_PROGRESS_KEY, raw)).then(() => {
    saved = raw; error = null; notify();
  }).catch(() => { error = 'No se pudo guardar el progreso. Se conserva durante esta sesión.'; notify(); })
    .finally(() => { if (queued === raw) queued = ''; });
}
export function loadPurgatorioProgress(): Promise<void> {
  if (loading) return loading;
  loading = AsyncStorage.getItem(PURGATORIO_PROGRESS_KEY).then(raw => {
    let value = readPurgatorioProgress(raw);
    for (const id of pending) value = progressAfterVictory(value, id);
    snapshot = value; hydrated = true; error = null;
    saved = raw ?? '';
    let legacy = false;
    try { const old = raw ? JSON.parse(raw) : null; legacy = old?.version === 1 && Array.isArray(old.cleared); } catch { /* Invalid data is not overwritten merely by opening the selector. */ }
    const dirty = pending.length > 0 || legacy;
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
  if (next === snapshot) { if (hydrated && error) persist(snapshot); else if (!hydrated) void loadPurgatorioProgress(); return; }
  if (!hydrated) pending.push(id);
  snapshot = next; notify();
  if (hydrated) persist(snapshot); else void loadPurgatorioProgress();
}
export function usePurgatorioProgress() {
  const progress = useSyncExternalStore(subscribe, getPurgatorioProgress, getPurgatorioProgress);
  const storageError = useSyncExternalStore(subscribe, () => error, () => null);
  useEffect(() => { void loadPurgatorioProgress().then(() => { if (hydrated && error) persist(snapshot); }); }, []);
  return { progress, error: storageError };
}
