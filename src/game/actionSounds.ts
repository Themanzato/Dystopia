import type { EnemyId } from './enemyCatalog';

/** Simulation-clock cues, emitted at animation/FX boundaries, never native timers. */
export const ACTION_SOUND_KEYS = ["archerShot", "sageCharge", "sageExplosion", "daggerSlash", "electroStorm", "guardianSquare", "guardianLaser", "electroProjectile", "widowVoice1", "widowVoice2", "electroTeleport", "guardianTeleport", "guardianLasers", "dustBeepFast", "dustBeepTrack", "dustBomb", "dustSlam"] as const;
export type ActionSound = typeof ACTION_SOUND_KEYS[number];
export type ActionSoundEvents = {
  soundSerial?: number;
  authoredAudio?: boolean;
  bossAttackSound?: number;
  actionSounds?: Partial<Record<ActionSound, { serial: number; owner: number }>>;
  actionStops?: Partial<Record<ActionSound, number>>;
};
export function playActionSound(events: ActionSoundEvents, cue: ActionSound, owner: number): void {
  'worklet';
  events.actionSounds = { ...events.actionSounds, [cue]: { serial: (events.actionSounds?.[cue]?.serial ?? 0) + 1, owner } };
  events.soundSerial = (events.soundSerial ?? 0) + 1;
}
export function stopActionSound(events: ActionSoundEvents, cue: ActionSound, owner: number): void {
  'worklet';
  const entry = events.actionSounds?.[cue];
  if (!entry || entry.owner !== owner) return;
  const serial = entry.serial;
  if ((events.actionStops?.[cue] ?? 0) >= serial) return;
  events.actionStops = { ...events.actionStops, [cue]: serial };
  events.soundSerial = (events.soundSerial ?? 0) + 1;
}
export function stopOwnerSounds(events: ActionSoundEvents, owner: number): void {
  'worklet';
  for (const key of ACTION_SOUND_KEYS) stopActionSound(events, key, owner);
}
export function hasAuthoredAttackSound(id: EnemyId): boolean {
  'worklet';
  return id === 'guardian' || id === 'evil-sage' || id === 'archer' || id === 'archer-bandit'
    || id === 'dagger-bandit' || id === 'dagger-mush' || id === 'dust-jumper' || id === 'electrocutioner' || id === 'tarnished-widow';
}
