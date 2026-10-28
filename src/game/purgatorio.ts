import { BOSS_IDS, MINIBOSS_IDS, ENEMY_DEFS, type EnemyId } from './enemyCatalog';
import { difficultyTuning, type Difficulty } from './difficulty';

export type SpecialEnemyId = (typeof MINIBOSS_IDS)[number] | (typeof BOSS_IDS)[number];
/** Append new encounters: preserve the completed frontier of existing saves. */
export const PURGATORIO_ROSTER: readonly SpecialEnemyId[] = [...MINIBOSS_IDS, ...BOSS_IDS.filter(id => id !== 'archer-bandit')];
export const BANDIT_ENCOUNTER_NAME = 'Archer and Dagger';
export function canonicalPurgatorioEnemy(id: SpecialEnemyId): SpecialEnemyId {
  'worklet';
  return id === 'archer-bandit' ? 'dagger-bandit' : id;
}
export function purgatorioName(id: SpecialEnemyId): string {
  'worklet';
  return canonicalPurgatorioEnemy(id) === 'dagger-bandit' ? BANDIT_ENCOUNTER_NAME : ENEMY_DEFS[id].name;
}
export const PURGATORIO_CONFIG = {
  transitionMs: 1400, spawnRetryMs: 200, growthHorizon: 18,
  extraHp: 2, extraSpeed: 0.3, extraTempo: 0.24, maxTempo: 1.65,
  extraPressure: 0.25,
};
export const PURGATORIO_DIFFICULTY_NAMES = { easy: 'Fácil', hard: 'Difícil', dystopia: 'Dystopia' };
export type RunSelection = { mode: 'survival' } | { mode: 'purgatorio'; encounter: SpecialEnemyId | 'infinite' };
export const SURVIVAL_SELECTION: RunSelection = { mode: 'survival' };
export type PurgatorioState = {
  kind: 'single' | 'infinite'; currentId: SpecialEnemyId; number: number; cleared: number;
  phase: 'between' | 'combat' | 'defeated'; elapsedMs: number; retryAtMs: number;
  lastClearedId: SpecialEnemyId | null; randomSeed: number;
};
export function isSpecialEnemy(id: unknown): id is SpecialEnemyId {
  'worklet';
  return typeof id === 'string' && (id === 'archer-bandit' || PURGATORIO_ROSTER.includes(id as SpecialEnemyId));
}
export function createPurgatorio(selection: RunSelection, seed: number): PurgatorioState | null {
  'worklet';
  if (selection.mode !== 'purgatorio') return null;
  return { kind: selection.encounter === 'infinite' ? 'infinite' : 'single',
    currentId: isSpecialEnemy(selection.encounter) ? canonicalPurgatorioEnemy(selection.encounter) : PURGATORIO_ROSTER[0],
    number: 1, cleared: 0, phase: 'between', elapsedMs: PURGATORIO_CONFIG.transitionMs,
    retryAtMs: 0, lastClearedId: null, randomSeed: (seed ^ 0x70757267) >>> 0 };
}
/** Fixed first pass, then seeded random picks without an immediate repeat. */
export function nextPurgatorioEnemy(run: PurgatorioState): SpecialEnemyId {
  'worklet';
  if (run.cleared < PURGATORIO_ROSTER.length) return PURGATORIO_ROSTER[run.cleared];
  run.randomSeed = (Math.imul(run.randomSeed, 1664525) + 1013904223) >>> 0;
  const pool = PURGATORIO_ROSTER.filter(id => id !== canonicalPurgatorioEnemy(run.currentId));
  return pool[Math.floor(run.randomSeed / 4294967296 * pool.length)];
}
/** Asymptotic growth; fixed one-unit damage and unchanged minimum tells/recovery. */
export function purgatorioTuning(number: number, difficulty: Difficulty) {
  'worklet';
  const base = difficultyTuning(1, difficulty), n = Math.max(0, Math.floor(number) - 1);
  const progress = n / (n + PURGATORIO_CONFIG.growthHorizon);
  return { ...base, hpMultiplier: 1 + PURGATORIO_CONFIG.extraHp * progress,
    speed: base.speed * (1 + PURGATORIO_CONFIG.extraSpeed * progress),
    combatRate: Math.min(PURGATORIO_CONFIG.maxTempo, base.combatRate * (1 + PURGATORIO_CONFIG.extraTempo * progress)),
    pressureRate: 1 + PURGATORIO_CONFIG.extraPressure * progress };
}
export type PurgatorioProgress = { cleared: SpecialEnemyId[] };
export function readPurgatorioProgress(raw: string | null): PurgatorioProgress {
  try {
    const data = raw ? JSON.parse(raw) : null;
    const list = data?.version === 1 && Array.isArray(data.cleared) ? data.cleared : [];
    const cleared: SpecialEnemyId[] = [];
    let cursor = 0;
    for (const id of PURGATORIO_ROSTER) {
      if (list[cursor] !== id) break;
      cleared.push(id); cursor++;
      // v1 saves had two completed entries for the same joint encounter. Skip
      // only that adjacent legacy duplicate; keep validating the entire frontier.
      if (id === 'dagger-bandit' && list[cursor] === 'archer-bandit') cursor++;
    }
    return { cleared };
  } catch { return { cleared: [] }; }
}
export function canSelectPurgatorio(id: EnemyId | string, progress: PurgatorioProgress): id is SpecialEnemyId {
  const index = PURGATORIO_ROSTER.indexOf(canonicalPurgatorioEnemy(id as SpecialEnemyId));
  return index >= 0 && index <= progress.cleared.length;
}
export function progressAfterVictory(progress: PurgatorioProgress, id: SpecialEnemyId): PurgatorioProgress {
  const canonical = canonicalPurgatorioEnemy(id);
  return PURGATORIO_ROSTER[progress.cleared.length] === canonical ? { cleared: [...progress.cleared, canonical] } : progress;
}
