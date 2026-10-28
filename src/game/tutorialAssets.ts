/** Audited original 80×48 RGBA cells. No sheet is edited or re-packed.
 * The PNGs contain sRGB metadata only, not FPS/durations. The one-shot timings
 * below are explicit playback choices and the gameplay clock owns their age. */
export const TUTORIAL_DUMMY_SOURCES = [
  require('../../assets/assets/tutorial/Training dummy/IDLE.png'),
  require('../../assets/assets/tutorial/Training dummy/HIT.png'),
  require('../../assets/assets/tutorial/Training dummy/BREAKING.png'),
] as const;

export const DUMMY_CELL = { width: 80, height: 48, pivotX: 40, pivotY: 44, scale: 1.25 } as const;
export const DUMMY_ANIMATIONS = {
  idle: { image: 0, frames: 1, fps: 0, durationMs: 0 },
  hit: { image: 1, frames: 7, fps: 14, durationMs: 500 },
  breaking: { image: 2, frames: 9, fps: 12, durationMs: 750 },
} as const;
export const DUMMY_HIT_MS = DUMMY_ANIMATIONS.hit.durationMs;
export const DUMMY_BREAK_MS = DUMMY_ANIMATIONS.breaking.durationMs;
export type DummyAction = keyof typeof DUMMY_ANIMATIONS | 'gone';
export type TutorialDummyVisual = { x: number; y: number; action: DummyAction; elapsedMs: number };
export type TutorialRenderState = {
  step: string;
  dummy: TutorialDummyVisual;
  target: { x: number; y: number } | null;
};

/** First HIT/BREAKING cells are legitimate white flashes, not empty padding.
 * Reactions/destruction clamp their final cell; only gameplay may finish them.
 * IDLE is a single static pose, regardless of how long the player waits. */
export function tutorialDummyFrame(action: DummyAction, elapsedMs: number) {
  'worklet';
  const clip = DUMMY_ANIMATIONS[action === 'gone' ? 'idle' : action];
  const frame = Math.max(0, Math.min(clip.frames - 1, Math.floor(Math.max(0, elapsedMs) * clip.fps / 1000)));
  return {
    image: clip.image, frame, visible: action !== 'gone',
    source: { x: frame * DUMMY_CELL.width, y: 0, width: DUMMY_CELL.width, height: DUMMY_CELL.height },
  };
}
