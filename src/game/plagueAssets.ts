import type { EnemyClip, EnemyVisual } from './enemyAnimations';

/** Original The Plague exports, audited against all four .aseprite timelines.
 * The three rows are idle/move, attack, death. Empty row padding is never used.
 * These indices append to enemyVisuals; existing actor image indices stay stable.
 */
export const PLAGUE_VARIANTS = ['small', 'medium', 'medium2', 'big'] as const;
export type PlagueVariant = (typeof PLAGUE_VARIANTS)[number];
// Documentation/test paths only. Bitmap requires live in enemyVisuals, keeping
// animation timing and combat modules pure in the worklet runtime.
export const PLAGUE_SOURCE_PATHS = [
  'assets/assets/enemies/mini bosses/The plague/Small Bug/Small Insect without shadow 20x28.png',
  'assets/assets/enemies/mini bosses/The plague/Medium Bug/Medium Insect without shadow 34x37.png',
  'assets/assets/enemies/mini bosses/The plague/Medium bug 2/Medium2 bug 88x37.png',
  'assets/assets/enemies/mini bosses/The plague/Big Bug/Big Insect without shadow 72x44 sprite sheet.png',
] as const;

// Durations come from the source frame timings, not a guessed global FPS.
export const PLAGUE_TIMING = {
  small: { frameMs: 65, idleFrames: 4, attackFrames: 6, deathFrames: 10, attackMs: 390, deathMs: 650, activeStartMs: 130, activeEndMs: 260 },
  medium: { frameMs: 65, idleFrames: 8, attackFrames: 10, deathFrames: 10, attackMs: 650, deathMs: 650, activeStartMs: 260, activeEndMs: 455 },
  medium2: { frameMs: 70, idleFrames: 8, attackFrames: 8, deathFrames: 11, attackMs: 560, deathMs: 770, activeStartMs: 210, activeEndMs: 420 },
  big: { frameMs: 65, idleFrames: 8, attackFrames: 6, deathFrames: 13, attackMs: 390, deathMs: 845, activeStartMs: 130, activeEndMs: 260 },
} as const;

const cell = (image: number, width: number, height: number, pivotX: number, pivotY: number, frames: number, row: number): EnemyClip =>
  ({ image, width, height, frames, x: 0, y: row * height, stepX: width, stepY: 0, pivotX, pivotY, scale: 2, authoredFacing: 1 });
function insect(image: number, width: number, height: number, pivotX: number, pivotY: number, variant: PlagueVariant): EnemyVisual {
  const timing = PLAGUE_TIMING[variant];
  return { idle: cell(image, width, height, pivotX, pivotY, timing.idleFrames, 0),
    move: cell(image, width, height, pivotX, pivotY, timing.idleFrames, 0),
    attack: cell(image, width, height, pivotX, pivotY, timing.attackFrames, 1),
    death: cell(image, width, height, pivotX, pivotY, timing.deathFrames, 2) };
}
export const PLAGUE_VISUALS: Record<PlagueVariant, EnemyVisual> = {
  small: insect(39, 20, 28, 8, 25, 'small'),
  medium: insect(40, 34, 37, 15, 34, 'medium'),
  medium2: insect(41, 88, 37, 31, 35, 'medium2'),
  big: insect(42, 72, 44, 30, 42, 'big'),
};
export const PLAGUE_BOUNDS = {
  small: { x: 3, y: 8, width: 10, height: 10 },
  medium: { x: 7, y: 8, width: 16, height: 17 },
  medium2: { x: 23, y: 9, width: 17, height: 26 },
  big: { x: 17, y: 7, width: 25, height: 30 },
} as const;

export type PlagueVisualState = { phase: 'intro' | 'warning' | 'attack' | 'recover' | 'death'; phaseMs: number; animationMs: number; attackRate?: number;
  plague?: { variant: PlagueVariant } };
/** A preparation-only body pulse, never a geometric hitbox or a second attack.
 * It stays visible throughout the cue, including when other damage flashes run.
 */
export function plagueWarningOpacity(boss: Pick<PlagueVisualState, 'phase' | 'phaseMs'>): number {
  'worklet';
  if (boss.phase !== 'warning') return 1;
  return .68 + .32 * (.5 + .5 * Math.cos(Math.max(0, boss.phaseMs) * Math.PI * 2 / 180));
}
export function plagueFrame(boss: PlagueVisualState) {
  'worklet';
  const variant = boss.plague?.variant ?? 'medium2', visual = PLAGUE_VISUALS[variant], timing = PLAGUE_TIMING[variant];
  const attack = boss.phase === 'attack', death = boss.phase === 'death';
  const clip = death ? visual.death : attack ? visual.attack : visual.move;
  // Full authored attack, once. Death has its own unscaled duration; flutter loops
  // throughout preparation/roaming rather than replaying a second attack layer.
  const elapsed = death || attack || boss.phase === 'warning' ? boss.phaseMs : boss.animationMs;
  // Faster authored wing flutter + the preparation pulse clearly distinguish
  // winding up from roaming. No sting frames are borrowed, replayed or skipped.
  const frameMs = timing.frameMs / (attack ? boss.attackRate ?? 1 : boss.phase === 'warning' ? 1.7 : 1);
  const index = death || attack ? Math.min(clip.frames - 1, Math.floor(Math.max(0, elapsed) / frameMs))
    : Math.floor(Math.max(0, elapsed) / frameMs) % clip.frames;
  return { image: clip.image, source: { x: clip.x + index * clip.stepX, y: clip.y, width: clip.width, height: clip.height },
    scale: clip.scale, pivotX: clip.pivotX, pivotY: clip.pivotY, authoredFacing: clip.authoredFacing,
    visible: !death || boss.phaseMs < timing.deathMs };
}
