export type DarknessPhase = 'cover' | 'reveal';
export const DARKNESS_COVER_MS = 500;
export const DARKNESS_REVEAL_MS = 560;

// Opacity is separate from the spreading shadows so the hand-off frame is
// guaranteed opaque, even on exceptionally wide displays.
export function darknessAt(elapsedMs: number, phase: DarknessPhase) {
  'worklet';
  const duration = phase === 'cover' ? DARKNESS_COVER_MS : DARKNESS_REVEAL_MS;
  const p = Math.min(1, Math.max(0, elapsedMs / duration));
  const q = phase === 'cover' ? p : 1 - p;
  const spread = q * q * (3 - 2 * q);
  // Continuous ease-in/out across the entire fade; no late opacity jump.
  return { opacity: spread, spread, ink: spread, done: p === 1 };
}