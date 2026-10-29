import type { Difficulty } from './difficulty';
import type { BossAttack } from './bossAttacks';
/** One mode table for HP, packs, summons and ranged pressure. Common NPC HP stays one. */
export const BOSS_MODES = {
  easy: { hp: 1, balls: 3, droids: 2, skeletonGroup: 2, skeletonLimit: 8, burstExtra: 0 },
  hard: { hp: 1.15, balls: 4, droids: 3, skeletonGroup: 3, skeletonLimit: 12, burstExtra: 2 },
  dystopia: { hp: 1.25, balls: 5, droids: 4, skeletonGroup: 4, skeletonLimit: 16, burstExtra: 4 },
} as const;
export const BOSS_BALANCE = {
  easyReducedHealthIds: ['tarnished-widow', 'rock-boss', 'dagger-bandit', 'archer-bandit'], easyHealthMultiplier: .8,
  widowSummonCooldownMs: 9000, widowSummonLimit: { easy: 20, hard: 30, dystopia: 40 },
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

/** Only the original Sage/Archer IDs read these phase modifiers. */
export const RANGED_PHASE_BALANCE = {
  sage: { chargeMultiplier: .75, minWarningMs: 550, predictionMs: 180, maxPrediction: 64,
    blastSpacing: 80, blastOffset: 90, blastWideOffset: 130, recoveryBetweenMs: 180,
    easy: { speed: 1.35, retreat: 1.15, explosions: 1 },
    hard: { speed: 1.5, retreat: 1.15, explosions: 2 },
    dystopia: { speed: 1.65, retreat: 1.15, explosions: 3 } },
  archer: { minWarningMs: 600, minRecoveryMs: 650, maxAttackRate: 1.8, beamSpeed: 2800, minShotsBetweenTeleports: 2,
    easy: { speed: 1.25, attackRate: 1.3, recovery: .7, teleportMs: 4800, projectileSpeed: 1.2 },
    hard: { speed: 1.45, attackRate: 1.45, recovery: .6, teleportMs: 3800, projectileSpeed: 1.4 },
    dystopia: { speed: 1.65, attackRate: 1.6, recovery: .5, teleportMs: 2900, projectileSpeed: 1.6 } },
};
export function rangedPreparation(id: string, powered: boolean, move: BossAttack, rate: number): number {
  'worklet';
  const multiplier = id === 'evil-sage' && powered ? RANGED_PHASE_BALANCE.sage.chargeMultiplier : 1;
  const minimum = id === 'archer' && powered ? RANGED_PHASE_BALANCE.archer.minWarningMs
    : id === 'evil-sage' && powered ? RANGED_PHASE_BALANCE.sage.minWarningMs : BOSS_BALANCE.warningMinMs;
  return Math.max(minimum, move.warningMs / rate * multiplier);
}
