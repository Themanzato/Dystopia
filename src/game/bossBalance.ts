import type { Difficulty } from './difficulty';
/** One mode table for HP, packs, summons and ranged pressure. Common NPC HP stays one. */
export const BOSS_MODES = {
  easy: { hp: 1, balls: 3, droids: 2, skeletonGroup: 2, skeletonLimit: 8, burstExtra: 0 },
  hard: { hp: 1.15, balls: 4, droids: 3, skeletonGroup: 3, skeletonLimit: 12, burstExtra: 2 },
  dystopia: { hp: 1.25, balls: 5, droids: 4, skeletonGroup: 4, skeletonLimit: 16, burstExtra: 4 },
} as const;
export const BOSS_BALANCE = {
  visualScale: { shielder:1.2, 'evil-sage':1.2, 'dagger-mush':1.2, 'shock-sweeper':1.2, guardian:1.3, 'skeleton-summoner':1.2, 'dust-jumper':1.2, electrocutioner:1.2 },
  summonerHealthMultiplier:1.2,
  dustCriticalTrackingMs:1000, dustCriticalLandingMs:180,
  electroCloneIntervalMs:6000,electroCloneLimit:{easy:2,hard:3,dystopia:4},
  electroBolts:{easy:2,hard:3,dystopia:3},electroSpeedMultiplier:1.85,
  electroTeleportCooldownMs:8500,electroBoltSpacing:130,electroBoltStaggerMs:240,
  electroFallMs:180,electroBoltDamageMs:220,electroBoltFxMs:900,electroBoltRadius:40,
  rockHealthMultiplier: 0.70, maxHazards: 96, maxSupports: 18, hitCueMs: 220, phaseFlashMs: 480,
  poisonDurationMs: 4000, poisonIntervalMs: 1800, poisonDamage: 2, stunMs: 650,
  burrowLockMs: 420, volleyReleaseFraction: 6 / 19, volleyFallMs: 320,
  banditArrowSpeed: 390,
  dustBombMarkerMs: 750, dustTakeoffMs: 900, dustTrackingMs: 1200,
  dustMarkerLockMs: 1000, dustLandingMs: 600, dustMarkerSpeed: 720,
  dustMoveGain: 0.65, dustTempoGain: 0.4, dustMaxBombs: 3,
  dustTrackingBeepMs: 350, dustLockedBeepMs: 180,
  shockSummonCooldownMs: 16000, shockMeleePerSlam: 3, shockNpcLimit: 30,
  teleportCooldownMs: 6800, teleportSafeDistance: 150, packIntervalMs: 450, packMaxWaitMs: 6000,
  npcBoostMs: 5000, npcBoostMultiplier: 1.35, siblingHeal: 0.18,
  warningMinMs: 550, beamLength: 1200, projectileMs: 4800,
};
export function bossMode(mode: Difficulty) { 'worklet'; return BOSS_MODES[mode]; }
