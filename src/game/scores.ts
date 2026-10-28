import { emptyMissions, readMissions, missionPulse, type MissionValues, type MissionProfile } from './missions';
import type { SurvivalState } from './survival';
import type { Difficulty } from './difficulty';
import { ENEMY_DEFS, type EnemyId } from './enemyCatalog';
import { emptyWallet, readWallet, WORKSHOP_IDS, normalizeEquipment, type WorkshopId, type WorkshopWallet } from './workshop';

export const SCORE_WEIGHTS = { npc: 10, miniboss: 250, boss: 1000, wave: 100, objective: 150 };
export const RANKING_MODES = ['survival', 'purgatorio-single', 'purgatorio-infinite'] as const;
export type RankingMode = typeof RANKING_MODES[number];
export const RANKING_NAMES: Record<RankingMode, string> = {
  survival: 'Supervivencia', 'purgatorio-single': 'Purgatorio individual', 'purgatorio-infinite': 'Purgatorio Infinito',
};
export type RunStats = { npcKills: number; minibossKills: number; bossKills: number; wavesCleared: number; objectivesCompleted: number };
export function createRunStats(): RunStats {
  'worklet';
  return { npcKills: 0, minibossKills: 0, bossKills: 0, wavesCleared: 0, objectivesCompleted: 0 };
}
export function scoreRun(stats: RunStats): number {
  'worklet';
  return stats.npcKills * SCORE_WEIGHTS.npc + stats.minibossKills * SCORE_WEIGHTS.miniboss + stats.bossKills * SCORE_WEIGHTS.boss
    + stats.wavesCleared * SCORE_WEIGHTS.wave + stats.objectivesCompleted * SCORE_WEIGHTS.objective;
}
export type RunResult = {
  id: string; mode: RankingMode; difficulty: Difficulty; date: string; outcome: 'victory' | 'defeat'; score: number;
  stats: RunStats; wave: number; level: number; durationMs: number; encounters: number; encounterId?: string;
  equipment?: WorkshopId[]; missionValues?: MissionValues;
};
let serial = 0;
export function createRunId(): string { return `${Date.now().toString(36)}-${(++serial).toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
export function finalRunResult(state: SurvivalState, id: string, date = new Date().toISOString()): RunResult {
  if (state.mode !== 'dead' && state.mode !== 'won') throw new Error('Una partida activa o abandonada no se liquida.');
  const stats = { ...(state.stats ?? createRunStats()) };
  const run = state.purgatorio;
  return { id, date, missionValues: missionPulse(state,id,true).values, mode: run ? run.kind === 'single' ? 'purgatorio-single' : 'purgatorio-infinite' : 'survival',
    difficulty: state.difficulty, outcome: state.mode === 'won' ? 'victory' : 'defeat', score: scoreRun(stats), stats,
    wave: state.encounter.wave, level: state.level, durationMs: Math.floor(state.clockMs), encounters: run?.cleared ?? 0,
    equipment: normalizeEquipment(state.startingEquipment ?? []), ...(run ? { encounterId: run.kind === 'single' ? run.currentId : 'infinite' } : {}) };
}
export function survivalTime(ms: number): string {
  const seconds = Math.floor(ms / 1000), minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export type ScoreArchive = { version: 1; rankings: Record<RankingMode, RunResult[]>; seen: string[]; economy: WorkshopWallet; missions: MissionProfile };
export function emptyScoreArchive(): ScoreArchive {
  return { version: 1, rankings: { survival: [], 'purgatorio-single': [], 'purgatorio-infinite': [] }, seen: [], economy: emptyWallet(), missions: emptyMissions() };
}
const validCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function validResult(value: unknown): value is RunResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as RunResult;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 128 && RANKING_MODES.includes(v.mode)
    && ['easy', 'hard', 'dystopia'].includes(v.difficulty) && ['victory', 'defeat'].includes(v.outcome)
    && typeof v.date === 'string' && Number.isFinite(Date.parse(v.date)) && validCount(v.score)
    && validCount(v.wave) && validCount(v.level) && v.level > 0 && validCount(v.durationMs) && validCount(v.encounters)
    && Boolean(v.stats) && Object.keys(createRunStats()).every(key => validCount(v.stats[key as keyof RunStats]))
    && (v.equipment === undefined || Array.isArray(v.equipment) && v.equipment.length <= 2 && new Set(v.equipment).size === v.equipment.length && v.equipment.every(id => WORKSHOP_IDS.includes(id)))
    && (v.encounterId === undefined || v.encounterId === 'infinite' || typeof v.encounterId === 'string'
      && ['mini', 'boss'].includes(ENEMY_DEFS[v.encounterId as EnemyId]?.tier));
}
export function insertScore(archive: ScoreArchive, result: RunResult): ScoreArchive {
  if (!validResult(result) || archive.seen.includes(result.id) || RANKING_MODES.some(mode => archive.rankings[mode].some(r => r.id === result.id))) return archive;
  const rankings = { ...archive.rankings, [result.mode]: [...archive.rankings[result.mode], result]
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, 3) };
  return { ...archive, rankings, seen: [...archive.seen, result.id].slice(-256) };
}
export function readScoreArchive(raw: string | null): ScoreArchive {
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.version !== 1 || !data.rankings) return emptyScoreArchive();
    let archive = emptyScoreArchive();
    for (const mode of RANKING_MODES) for (const result of Array.isArray(data.rankings[mode]) ? data.rankings[mode] : []) {
      if (validResult(result) && result.mode === mode) archive = insertScore(archive, result);
    }
    const seen = Array.isArray(data.seen) ? data.seen.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 128) : [];
    archive.seen = [...new Set([...archive.seen, ...seen])].slice(-256);
    archive.economy = readWallet(data.economy);
    archive.missions = readMissions(data.missions);
    // Existing records and incomplete saves never grant retrospective coins.
    for (const id of [...archive.seen, ...RANKING_MODES.flatMap(mode => archive.rankings[mode].map(r => r.id))]) {
      if (!Object.hasOwn(archive.economy.settlements, id)) archive.economy.settlements[id] = { earned: 0, balance: archive.economy.cells };
    }
    return archive;
  } catch { return emptyScoreArchive(); }
}
