import { BOSS_BALANCE } from './bossBalance';

/** Bounded health pressure, composed with the existing difficulty/wave tuning. */
export function dustPressure(hp: number, maxHp: number) {
  'worklet';
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  const lost = 1 - ratio;
  return { movement: 1 + lost * BOSS_BALANCE.dustMoveGain,
    tempo: 1 + lost * BOSS_BALANCE.dustTempoGain,
    bombs: Math.min(BOSS_BALANCE.dustMaxBombs, ratio <= 1 / 3 ? 3 : ratio < 2 / 3 ? 2 : 1) };
}

/** Freeze this timeline at attack start. Critical jumps track for one second and fall without a lock. */
export function dustJumpTimeline(rate = 1, critical = false) {
  'worklet';
  const speed = Math.max(0.1, rate);
  const takeoffMs = BOSS_BALANCE.dustTakeoffMs / speed;
  const trackEndMs = takeoffMs + (critical ? BOSS_BALANCE.dustCriticalTrackingMs : BOSS_BALANCE.dustTrackingMs / speed);
  const landingStartMs = trackEndMs + (critical ? 0 : BOSS_BALANCE.dustMarkerLockMs);
  const landingMs = (critical ? BOSS_BALANCE.dustCriticalLandingMs : BOSS_BALANCE.dustLandingMs) / speed;
  const impactMs = landingStartMs + landingMs * 2 / 10;
  return { takeoffMs, trackEndMs, landingStartMs, landingMs,
    followEndMs: critical ? impactMs : trackEndMs, impactMs, durationMs: landingStartMs + landingMs };
}

/** Discrete cues follow the paused game clock, with a quicker beep during the lock. */
export function dustBeepTick(ageMs: number, startMs: number, lockMs: number, landingMs: number): number {
  'worklet';
  if (ageMs < startMs || ageMs >= landingMs) return -1;
  if (ageMs < lockMs) return Math.floor((ageMs - startMs) / BOSS_BALANCE.dustTrackingBeepMs);
  return Math.floor((lockMs - startMs) / BOSS_BALANCE.dustTrackingBeepMs) + 1
    + Math.floor((ageMs - lockMs) / BOSS_BALANCE.dustLockedBeepMs);
}
