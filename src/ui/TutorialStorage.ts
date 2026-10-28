import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIAL_STORAGE_KEY = '@dystopia/tutorial/v1';
export type TutorialProgress = { version: 1; offered: boolean; skipped: boolean; completed: boolean };
const DEFAULT: TutorialProgress = { version: 1, offered: false, skipped: false, completed: false };
let state = { ...DEFAULT };
let loading: Promise<void> | undefined;
let writes = Promise.resolve();
let persisted = JSON.stringify(state), scheduled: string | null = null;
export function readTutorialProgress(raw: string | null): TutorialProgress {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT };
    const v = value as Partial<TutorialProgress>;
    const completed = v.completed === true, skipped = !completed && v.skipped === true;
    return { version: 1, completed, skipped, offered: completed || skipped || v.offered === true };
  } catch { return { ...DEFAULT }; }
}
export async function loadTutorialProgress(): Promise<TutorialProgress> {
  loading ??= AsyncStorage.getItem(TUTORIAL_STORAGE_KEY).then(raw => { state = readTutorialProgress(raw); persisted = JSON.stringify(state); })
    .catch(() => { /* First-run training remains available when storage cannot be read. */ });
  await loading;
  return state;
}
export function shouldOfferTutorial(progress: TutorialProgress): boolean {
  return !progress.offered && !progress.skipped && !progress.completed;
}
async function record(kind: 'offered' | 'skipped' | 'completed'): Promise<TutorialProgress> {
  await loadTutorialProgress();
  const next: TutorialProgress = { version: 1, offered: true,
    completed: state.completed || kind === 'completed',
    skipped: kind === 'completed' || state.completed ? false : kind === 'skipped' || state.skipped };
  state = next;
  const saved = JSON.stringify(next);
  if (saved !== persisted && saved !== scheduled) {
    scheduled = saved;
    // Serialize writes; repeated callbacks cannot duplicate a pending write.
    writes = writes.then(() => AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, saved)).then(() => {
      persisted = saved;
    }).catch(() => {
      // A later explicit action retries an unsuccessful write.
      console.warn('Dystopia: no se pudo guardar el estado del tutorial.');
    }).finally(() => { if (scheduled === saved) scheduled = null; });
  }
  await writes;
  return state;
}
export const markTutorialOffered = () => record('offered');
export const markTutorialSkipped = () => record('skipped');
export const markTutorialCompleted = () => record('completed');
