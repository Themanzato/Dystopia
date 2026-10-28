import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { CONTROL_SETTINGS_KEY, DEFAULT_CONTROLS, readControlSettings, validControlPatch, type ControlSettings } from './controlSettings';
let snapshot = DEFAULT_CONTROLS;
let hydrated = false;
let pending: Partial<ControlSettings> = {};
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let error: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const notify = () => listeners.forEach(listener => listener());
function persist(value: ControlSettings) {
  writes = writes.then(() => AsyncStorage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify(value))).then(() => {
    error = null; notify();
  }).catch(() => { error = 'No se pudieron guardar los controles. Se mantienen durante esta sesión.'; notify(); });
}
export function loadControls() {
  loading ??= AsyncStorage.getItem(CONTROL_SETTINGS_KEY).then(raw => {
    snapshot = { ...readControlSettings(raw), ...pending };
  }).catch(() => { error = 'No se pudieron recuperar los controles guardados.'; }).then(() => {
    hydrated = true; notify();
    if (Object.keys(pending).length) persist(snapshot);
    pending = {};
  });
  return loading;
}
export function updateControls(patch: Partial<ControlSettings>) {
  const valid = validControlPatch(patch);
  if (!hydrated) pending = { ...pending, ...valid };
  snapshot = { ...snapshot, ...valid }; notify();
  if (hydrated) persist(snapshot);
}
/** Commit the editor draft only after storage succeeds; Back never changes the store. */
export async function saveControls(patch: Partial<ControlSettings>): Promise<boolean> {
  await loadControls();
  const next = { ...snapshot, ...validControlPatch(patch) };
  let saved = false;
  const job = writes.then(() => AsyncStorage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify(next))).then(() => {
    snapshot = next; error = null; saved = true; notify();
  }).catch(() => { error = 'No se pudieron guardar los controles. Intenta guardar de nuevo.'; notify(); });
  writes = job;
  await job;
  return saved;
}
export function resetControls(){
  snapshot={...DEFAULT_CONTROLS};pending=hydrated?{}:{...DEFAULT_CONTROLS,layout:null,elements:null};notify();if(hydrated)persist(snapshot);
}
export function flushControls(){return writes;}
export function useControlSettings() {
  const settings = useSyncExternalStore(subscribe, () => snapshot, () => DEFAULT_CONTROLS);
  const storageError = useSyncExternalStore(subscribe, () => error, () => null);
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  useEffect(() => { void loadControls(); }, []);
  return { settings, ready, error: storageError, update: updateControls, save: saveControls, reset:resetControls, flush:flushControls };
}
