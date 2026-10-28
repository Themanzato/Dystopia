import { createRotation, type Rotation } from './rotation';
import { ENEMY_DEFS } from './enemyCatalog';
import type { BossState } from './survival';
import type { Point } from './map';
import { createOptionalEvents, type OptionalKind, type OptionalScheduler } from './optionalEvents';
export const ADVANCED_EVENT_OVERLAP_WAVE = 25;
export const WORLD_EVENT_CONFIG = {
  rewardDurationMs: 10000, rewardFirstMs: 45000, rewardRepeatMs: 90000, rewardFirstWave: 2, rewardWaveGap: 4,
  rewardXp: 32, noticeMs: 2800, shipWaves: [3, 7], shipArmDelayMs: 6000, shipTriggerDistance: 350,
  shipWarningMs: 3000, shipRetryMs: 200, shipSpawnGraceMs: 2200, shipCooldownMs: 75000, shipSafeDistance: 140,
  specialSpawnDeadlineMs: 5000, pressureLimit: { easy: 12, hard: 18, dystopia: 24 }, pressureMs: { easy: 2400, hard: 2000, dystopia: 1600 },
  captureDeadlineMs: 90000, captureOutsidePenaltyRate: 1, captureMaxPenaltyMs: 30000,
  captureFailureDamage: 2, captureDamageNoticeMs: 1200, eventSeparationMs: 8000,
};
export const MISSION_EVENT_KINDS=['capture','elite','nest','reactor'] as const;
export type MissionKind='capture'|OptionalKind;
export type ZoneReward = 'vitality' | 'rhythm' | 'speed' | 'xp';
export type RewardZone = Point & { id: number; siteId: string; radius: number; reward: ZoneReward; elapsedMs: number; inside: boolean;
  requiredMs?: number; deadlineElapsedMs?: number; penaltyMs?: number; started?: boolean; leftZone?: boolean };
export type ShipEvent = { siteId: string; phase: 'armed' | 'alarm'; elapsedMs: number; enemyId: BossState['id']; nextTryMs: number };
export type WorldEvents = { missionRotation?:Rotation<MissionKind>;missionCooldownUntilMs?:number; randomSeed: number; zone: RewardZone | null; ship: ShipEvent | null;
  optional: OptionalScheduler;
  lastEventStartMs: number; pendingCaptureDamage: { id: number; amount: number } | null;
  damageNotice: { amount: number; elapsedMs: number } | null;
  pendingShipWave: number | null;
  notice: (Point & { text: string; elapsedMs: number }) | null; nextRewardAtMs: number; nextRewardWave: number;
  specialDeadlineMs: number; specialRetryAtMs: number; lastRewardSite: string; lastShipSite: string; checkedShipWave: number; nextShipAtMs: number; reinforcementMs: number };
export function createWorldEvents(seed: number): WorldEvents {
  'worklet';
  return { missionRotation:createRotation<MissionKind>(seed^0x45564e54),missionCooldownUntilMs:0,optional:createOptionalEvents(seed), randomSeed: (seed ^ 0x776f726c) >>> 0, zone: null, ship: null, notice: null, nextRewardAtMs: WORLD_EVENT_CONFIG.rewardFirstMs,
    lastEventStartMs: -1e12, pendingCaptureDamage: null, damageNotice: null, pendingShipWave: null,
    nextRewardWave: WORLD_EVENT_CONFIG.rewardFirstWave, specialDeadlineMs: 0, specialRetryAtMs: 0, lastRewardSite: '', lastShipSite: '', checkedShipWave: 0, nextShipAtMs: 0, reinforcementMs: 0 };
}
export function worldRandom(world: WorldEvents): number {
  'worklet';
  world.randomSeed = (Math.imul(world.randomSeed, 1664525) + 1013904223) >>> 0;
  return world.randomSeed / 4294967296;
}
type SpecialState = { merchants?:{active:unknown}; partner?: BossState | null; boss: BossState | null; minibosses: BossState[]; pendingBoss: boolean; presentation: unknown; world: WorldEvents; encounter?: { wave: number }; clockMs?: number };
export function hasLivingSpecial(state: Pick<SpecialState, 'boss' | 'minibosses' | 'partner'>): boolean {
  'worklet';
  return Boolean(state.boss && state.boss.hp > 0 && state.boss.phase !== 'death' && ENEMY_DEFS[state.boss.id].tier !== 'minion')
    || Boolean(state.partner && state.partner.hp > 0 && state.partner.phase !== 'death')
    || state.minibosses.some(b => b.hp > 0 && b.phase !== 'death' && ENEMY_DEFS[b.id].tier !== 'minion');
}
/** Admission is derived from the actual zone, ship and encounter. No second lock can drift. */
export function canRunWorldEvent(state: SpecialState, kind: 'capture' | 'ship', wave: number, clockMs: number, starting = true): boolean {
  'worklet';
  if(state.merchants?.active)return false;
  if (state.world.optional?.active) return false;
  if(starting&&kind==='capture'&&clockMs<(state.world.missionCooldownUntilMs??0))return false;
  const advanced = wave >= ADVANCED_EVENT_OVERLAP_WAVE;
  if (state.pendingBoss || state.presentation) return false;
  const occupied = Boolean(state.boss || state.partner || state.minibosses.some(b => ENEMY_DEFS[b.id].tier !== 'minion'));
  if (occupied && !(kind === 'capture' && advanced && state.boss?.origin === 'ship' && hasLivingSpecial(state))) return false;
  if (kind === 'capture' ? state.world.ship && !advanced : state.world.zone && !advanced) return false;
  if (starting && (kind === 'capture' ? state.world.zone : state.world.ship)) return false;
  if (starting && kind === 'capture' && state.world.pendingCaptureDamage) return false;
  if (starting && clockMs - (state.world.lastEventStartMs ?? -1e12) < WORLD_EVENT_CONFIG.eventSeparationMs) return false;
  return true;
}
/** Total deadline runs from activation. Only leaving after entering adds required capture time. */
export function advanceCapture(zone: RewardZone, inside: boolean, dt: number) {
  'worklet';
  const available = Math.max(0, WORLD_EVENT_CONFIG.captureDeadlineMs - (zone.deadlineElapsedMs ?? 0));
  const elapsed = Math.min(Math.max(0, dt), available), started = Boolean(zone.started || zone.elapsedMs > 0 || inside);
  const penaltyMs = Math.min(WORLD_EVENT_CONFIG.captureMaxPenaltyMs, (zone.penaltyMs ?? 0) + (!inside && started ? elapsed * WORLD_EVENT_CONFIG.captureOutsidePenaltyRate : 0));
  const requiredMs = WORLD_EVENT_CONFIG.rewardDurationMs + penaltyMs;
  const next = { ...zone, leftZone: Boolean(zone.leftZone || !inside && (zone.started || zone.elapsedMs > 0)), inside, started, penaltyMs, requiredMs, deadlineElapsedMs: (zone.deadlineElapsedMs ?? 0) + elapsed,
    elapsedMs: inside ? Math.min(requiredMs, zone.elapsedMs + elapsed) : zone.elapsedMs };
  return { zone: next, complete: next.elapsedMs >= requiredMs, failed: next.elapsedMs < requiredMs && next.deadlineElapsedMs >= WORLD_EVENT_CONFIG.captureDeadlineMs };
}
/** The single admission rule for scheduled and derelict encounters. Skeleton
 * supports are normal one-hit NPCs, never another special. Keep a dying actor's
 * slot until its real death clip finishes, so new spawns cannot overwrite it. */
export function canStartSpecial(state: SpecialState, owner: 'scheduled' | 'ship' | 'alarm' | 'purgatorio'): boolean {
  'worklet';
  if(state.merchants?.active)return false;
  if (state.world.optional?.active) return false;
  if (state.boss || state.partner || state.presentation || state.minibosses.some(b => ENEMY_DEFS[b.id].tier !== 'minion')) return false;
  if (state.pendingBoss && owner !== 'scheduled') return false;
  if (state.world.ship?.phase === 'alarm' && owner !== 'ship') return false;
  if ((owner === 'ship' || owner === 'alarm') && !canRunWorldEvent(state, 'ship', state.encounter?.wave ?? 0, state.clockMs ?? 0, false)) return false;
  return true;
}
/** New optional events never use the capture/ship wave-25 overlap exception. */
export function canStartOptional(state: SpecialState): boolean {
  'worklet';
  if(state.merchants?.active)return false;
  return (state.clockMs??0)>=(state.world.missionCooldownUntilMs??0) && !state.world.optional?.active && !state.world.optional?.notice && !state.world.notice && !state.world.zone && !state.world.ship && !state.world.pendingCaptureDamage
    && !state.pendingBoss && !state.presentation && !state.boss && !state.partner && !state.minibosses.length
    && (state.clockMs??0)-(state.world.lastEventStartMs??-1e12)>=WORLD_EVENT_CONFIG.eventSeparationMs;
}
