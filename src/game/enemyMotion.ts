import type { EnemyId } from './enemyCatalog';
/** Body-root X measured in the original cells, excluding sword/beam VFX.
 * This is authored cell translation, not the movement speed of an attack.
 * Physics commits its delta exactly once; rendering removes the cell offset.
 * Curves belong to a clip: a slash root must not be reused for a charge/laser.
 * Ending, interruption or death never restores an initial world position. */
export const ATTACK_ROOT_X: Partial<Record<EnemyId, readonly number[]>> = {
  'dagger-mush': [0, 0, 20, 42, 42, 42, 54, 54, 54, 54],
  'shock-sweeper': [0, 0, 0, 26, 27, 28, 28, 28],
  archer: [0, -1, -2, -2, -2, -2, -9, -10, -10, -10, -10, -10, -10, -10],
};
export const CLIP_ROOT_X: Partial<Record<EnemyId, Record<string, readonly number[]>>> = {
  'dagger-bandit': { roll: [0, 1, 3, 6, 8] },
  'archer-bandit': { roll: [0, 1, 3, 6, 8] },
  'dagger-mush': { spin: [0, 0, 0, 6, 6, 6, 6, 6, 48, 86, 86, 86] },
  'shock-sweeper': { slam: [0, 0, 1, 1, 1, 7, 9, 9, 9, 9] },
  archer: { laser: [0, -1, -2, -2, -2, -2, -2, -9, -10, -10, -10, -10, -10, -10, -10] },
};
function clipRoot(id: EnemyId, clipName: string): readonly number[] | undefined {
  'worklet';
  return clipName === 'attack' ? ATTACK_ROOT_X[id] : CLIP_ROOT_X[id]?.[clipName];
}
export function attackFrameRoot(id: EnemyId, frame: number, clipName = 'attack'): number {
  'worklet';
  const curve = clipRoot(id, clipName);
  return curve ? curve[Math.max(0, Math.min(curve.length - 1, frame))] : 0;
}
export function attackMotionRoot(id: EnemyId, elapsedMs: number, durationMs: number, clipName = 'attack'): number {
  'worklet';
  const curve = clipRoot(id, clipName);
  if (!curve) return 0;
  const cursor = Math.max(0, Math.min(curve.length - 1, elapsedMs / Math.max(1, durationMs) * curve.length));
  const index = Math.floor(cursor), fraction = cursor - index;
  return curve[index] + (curve[Math.min(index + 1, curve.length - 1)] - curve[index]) * fraction;
}

export function banditExitRoot(id: EnemyId, progress: number, discrete = false): number {
  'worklet';
  if (id !== 'dagger-bandit' && id !== 'archer-bandit') return 0;
  const roots = id === 'dagger-bandit'
    ? [0, 0, 8, 19, 30, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5, 32.5]
    : [0, 0, 8, 19, 30, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5, 33.5];
  const cursor = Math.max(0, Math.min(15, progress * 16)), index = Math.floor(cursor);
  return discrete ? roots[index] : roots[index] + (roots[Math.min(15, index + 1)] - roots[index]) * (cursor - index);
}
