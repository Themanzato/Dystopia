import { difficultyTuning, type Difficulty } from './difficulty';
import type { Point } from './map';

export type OptionalKind = 'elite' | 'nest' | 'reactor';
export const OPTIONAL_EVENT_CONFIG = {
  opportunityMinMs: 150000, opportunityMaxMs: 240000, cooldownMs: 120000,
  retryMinMs: 12000, retryMaxMs: 20000,
  startSteps: [1, 2, 3, 6, 7, 8],
  warningMs: 3000, queuedDeadlineMs: 60000, eliteDeadlineMs: 90000,
  nestDeadlineMs: 90000, reactorDeadlineMs: 120000, nestCaptureMs: 8000, energyCaptureMs: 4000,
  zoneRadius: 76, siteMinDistance: 160, siteMaxDistance: 950, siteSeparation: 220,
  visionFadeMs: 850, visionRadius: 180, visionRecoveredRadius: 460,
  rewards: { elite: { xp: 16, frenesis: 8 }, nest: { xp: 12, frenesis: 4 }, reactor: { xp: 20, frenesis: 6 } },
  modes: {
    easy: { eliteFraction: 0.25, eliteHp: 2, eliteSpeed: 1.12, nestGroup: 1, nestLimit: 6 },
    hard: { eliteFraction: 0.32, eliteHp: 2, eliteSpeed: 1.16, nestGroup: 2, nestLimit: 8 },
    dystopia: { eliteFraction: 0.4, eliteHp: 3, eliteSpeed: 1.2, nestGroup: 2, nestLimit: 10 },
  },
};
export const OPTIONAL_EVENT_NAMES = { elite: 'OLEADA ELITE', nest: 'DESACTIVAR NIDO', reactor: 'REACTOR INESTABLE' };
export type EventPoint = Point & { progressMs: number; complete: boolean };
export type OptionalEvent = {
  id: number; kind: OptionalKind; phase: 'queued' | 'warning' | 'active'; elapsedMs: number;
  wave: number; points: EventPoint[]; spawnMs: number; eliteQuota: number; eliteSpawned: number;
};
export type OptionalScheduler = {
  active: OptionalEvent | null; nextOpportunityMs: number; nextCheckMs: number; cooldownUntilMs: number;
  lastKind: OptionalKind | null; nextId: number; checkedWave: number; checkedPhase: string;
  visibility: number; completed: number; failed: number;
  pendingCharge: number;
  notice: { kind: OptionalKind; success: boolean; elapsedMs: number } | null;
};
export function createOptionalEvents(seed: number): OptionalScheduler {
  'worklet';
  const delay = OPTIONAL_EVENT_CONFIG.opportunityMinMs + ((Math.imul(seed,1664525)+1013904223)>>>0)/4294967296*(OPTIONAL_EVENT_CONFIG.opportunityMaxMs-OPTIONAL_EVENT_CONFIG.opportunityMinMs);
  return { active:null,nextOpportunityMs:delay,nextCheckMs:delay,cooldownUntilMs:0,lastKind:null,nextId:1,checkedWave:0,checkedPhase:'',visibility:0,completed:0,failed:0,notice:null,pendingCharge:0 };
}
export function optionalTuning(wave: number, mode: Difficulty) {
  'worklet';
  const normal = difficultyTuning(wave,mode);
  return { ...OPTIONAL_EVENT_CONFIG.modes[mode], nestIntervalMs: Math.max(2000,3200/normal.combatRate) };
}
export function advanceEventPoint(point: EventPoint, player: Point, dt: number, requiredMs: number): EventPoint {
  'worklet';
  if(point.complete)return point;
  const inside=Math.hypot(point.x-player.x,point.y-player.y)<=OPTIONAL_EVENT_CONFIG.zoneRadius;
  const progressMs=Math.min(requiredMs,point.progressMs+(inside?dt:0));
  return {...point,progressMs,complete:progressMs>=requiredMs};
}
export function clearOptionalEvents(value: OptionalScheduler): OptionalScheduler {
  'worklet';
  return {...value,active:null,visibility:0,notice:null,pendingCharge:0};
}
