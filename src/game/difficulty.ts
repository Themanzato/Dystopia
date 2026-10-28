/** Pure balance data captured by worklets. Easy retains the original starting balance. */
export type Difficulty = 'easy' | 'hard' | 'dystopia';
export const DIFFICULTIES = {
  easy: { name: 'Fácil', color: '#a9c8b0', hp: 5, maxHp: 10, count: 1, spawn: 1, speed: 1, speedGrowth: 0.28, combat: 1, combatGrowth: 0.12, summonMs: 12000 },
  hard: { name: 'Difícil', color: '#daa875', hp: 5, maxHp: 10, count: 1.3, spawn: 0.84, speed: 1.2, speedGrowth: 0.3, combat: 1.12, combatGrowth: 0.15, summonMs: 10500 },
  dystopia: { name: 'Dystopia', color: '#a4425d', hp: 1, maxHp: 1, count: 1.6, spawn: 0.68, speed: 1.4, speedGrowth: 0.32, combat: 1.25, combatGrowth: 0.18, summonMs: 9000 },
} as const;
export const WAVE_BALANCE = { baseCounts: [7, 10, 12, 15, 3, 9, 14, 17, 20, 2], maxEnemies: 60,
  intervalMs: 350, minIntervalMs: 150, groupPauseMs: 1550, minGroupPauseMs: 650, presentationMs: 1800,
  minWarningMs: 500, minRecoveryMs: 650, attackGapMs: 260, maxSummons: 3 };
export function difficultyTuning(wave: number, mode: Difficulty = 'easy') {
  'worklet';
  const spec = DIFFICULTIES[mode], w = Math.max(1, Math.floor(wave));
  const cycle = Math.floor((w - 1) / 10), step = (w - 1) % 10;
  // Bounded, continuous velocity/tempo curve; never exponential enemy speed.
  const progress = (w - 1) / (w + 35);
  return { count: Math.min(WAVE_BALANCE.maxEnemies, Math.ceil((WAVE_BALANCE.baseCounts[step] + cycle * (step === 4 || step === 9 ? 2 : 6)) * spec.count)),
    intervalMs: Math.max(WAVE_BALANCE.minIntervalMs, (WAVE_BALANCE.intervalMs - (w - 1) * 1.5) * spec.spawn),
    groupPauseMs: Math.max(WAVE_BALANCE.minGroupPauseMs, (WAVE_BALANCE.groupPauseMs - (w - 1) * 5.5) * spec.spawn),
    groupSize: Math.min(5, 3 + Math.floor(cycle / 3)), speed: spec.speed + spec.speedGrowth * progress,
    combatRate: spec.combat + spec.combatGrowth * progress, summonMs: Math.max(7500, spec.summonMs - progress * 1500),
    maxEnemies: WAVE_BALANCE.maxEnemies };
}
