import { isWalkable, moveWithCollisions } from './collision';
import { DIFFICULTIES, difficultyTuning, type Difficulty } from './difficulty';
import { ANIMATED_PROPS, ARENA, PROPS, WORLD, type Point } from './map';
import { isReachable, navigationDirection, type FlowField } from './navigation';
import { PLAGUE_BOUNDS, PLAGUE_TIMING, PLAGUE_VISUALS, type PlagueVariant } from './plagueAssets';
import { purgatorioTuning } from './purgatorio';
import type { PlayerState } from './player';
import type { BossState, SurvivalState } from './survival';

export type { PlagueVariant } from './plagueAssets';
export type PlagueStage = 'roam' | 'orbit' | 'approach' | 'windup' | 'dive' | 'retreat';
export type PlagueFlight = {
  variant: PlagueVariant; stage: PlagueStage; height: number; seed: number;
  elapsedMs: number; routeMs: number; cooldownMs: number; vx: number; vy: number;
  goalX: number; goalY: number; targetX: number; targetY: number; side: number;
};
export type PlagueEncounter = { id: number; memberIds: number[]; killed: number[]; maxHp: number; rewarded: boolean };
export type PlagueView = { left: number; right: number; top: number; bottom: number };
/** Individual small HP never scales. Pressure grows through the existing speed/
 * tempo tuning and a bounded count, rather than invisible tiny damage sponges. */
export const PLAGUE_BALANCE = {
  startingCount: { easy: 6, hard: 8, dystopia: 10 }, maxInsects: 14, extraPerCycle: 1,
  maxWaveExtra: 4, spawnSafeDistance: 140, separation: 42, viewMargin: 34,
  warningMs: 780, minWarningMs: 620, maxAttackers: { easy: 1, hard: 2, dystopia: 2 },
  routeMinMs: 650, routeRangeMs: 900, attackDistance: 220, predictionMs: 170,
  hp: { small: 2, medium: 4, medium2: 5, big: 12 },
  speed: { small: 106, medium: 86, medium2: 96, big: 66 },
  recoveryMs: { small: 1650, medium: 2100, medium2: 1850, big: 2700 },
  stingRadius: { small: 21, medium: 24, medium2: 24, big: 29 },
  orb: { small: 4, medium: 5, medium2: 5, big: 8 },
};
const COMPOSITION: PlagueVariant[] = ['small', 'medium', 'small', 'medium2', 'small', 'big', 'medium', 'small', 'medium2', 'small', 'big', 'medium', 'small', 'medium2'];
const SPAWN_BLOCKERS = [...PROPS, ...ANIMATED_PROPS].filter(p => !p.groundDetail).map(p => p.destination);
function clearSpawn(point: Point, variant: PlagueVariant): boolean {
  'worklet';
  const bounds = PLAGUE_BOUNDS[variant], clip = PLAGUE_VISUALS[variant].idle;
  const halfWidth = Math.max(Math.abs(bounds.x - clip.pivotX), Math.abs(bounds.x + bounds.width - clip.pivotX)) * clip.scale;
  const top = point.y + (bounds.y - clip.pivotY) * clip.scale - 10, bottom = point.y + (bounds.y + bounds.height - clip.pivotY) * clip.scale;
  return isWalkable(point.x, point.y) && !SPAWN_BLOCKERS.some(b => point.x - halfWidth < b.x + b.width + 5 && point.x + halfWidth > b.x - 5 && top < b.y + b.height + 5 && bottom > b.y - 5);
}

export function plagueCount(wave: number, difficulty: Difficulty): number {
  'worklet';
  return Math.min(PLAGUE_BALANCE.maxInsects, PLAGUE_BALANCE.startingCount[difficulty]
    + Math.min(PLAGUE_BALANCE.maxWaveExtra, Math.max(0, Math.floor((wave - 1) / 10))) * PLAGUE_BALANCE.extraPerCycle);
}
export function plagueVariant(index: number): PlagueVariant { 'worklet'; return COMPOSITION[index % COMPOSITION.length]; }
export function plagueHealth(variant: PlagueVariant, largeHpMultiplier: number): number {
  'worklet';
  return variant === 'big' ? Math.ceil(PLAGUE_BALANCE.hp.big * largeHpMultiplier) : PLAGUE_BALANCE.hp[variant];
}
function random(flight: PlagueFlight): number {
  'worklet';
  flight.seed = (Math.imul(flight.seed, 1664525) + 1013904223) >>> 0;
  return flight.seed / 4294967296;
}
export function plagueView(view: PlagueView | undefined, player: Point): PlagueView {
  'worklet';
  const v = view ?? { left: player.x - 450, right: player.x + 450, top: player.y - 230, bottom: player.y + 230 };
  return { left: Math.max(16, v.left + PLAGUE_BALANCE.viewMargin), right: Math.min(WORLD.width - 16, v.right - PLAGUE_BALANCE.viewMargin),
    top: Math.max(16, v.top + PLAGUE_BALANCE.viewMargin), bottom: Math.min(WORLD.height - 16, v.bottom - PLAGUE_BALANCE.viewMargin) };
}
function bounded(point: Point, view: PlagueView): Point {
  'worklet';
  const x = Math.max(view.left, Math.min(view.right, point.x)), y = Math.max(view.top, Math.min(view.bottom, point.y));
  const dx = x - ARENA.x, dy = y - ARENA.y, length = Math.hypot(dx, dy), limit = ARENA.radius - 24;
  return length <= limit ? { x, y } : { x: ARENA.x + dx / length * limit, y: ARENA.y + dy / length * limit };
}
/** All actors are prepared before admitting an encounter. Failure neither
 * consumes its rotation nor creates a partially spawned swarm. */
export function plagueSpawnPoints(count: number, player: Point, field: FlowField, view: PlagueView | undefined, seed: number): Point[] {
  'worklet';
  const bounds = plagueView(view, player), points: Point[] = [];
  let rng = seed >>> 0;
  // Uniform candidates, then a deterministic scan: bounded work on spawn only.
  for (let attempt = 0; attempt < 1200 && points.length < count; attempt++) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const u = attempt < 500 ? rng / 4294967296 : ((attempt - 500) % 35 + .5) / 35;
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const v = attempt < 500 ? rng / 4294967296 : (Math.floor((attempt - 500) / 35) % 20 + .5) / 20;
    const point = bounded({ x: bounds.left + (bounds.right - bounds.left) * u, y: bounds.top + (bounds.bottom - bounds.top) * v }, bounds);
    if (Math.hypot(point.x - player.x, point.y - player.y) < PLAGUE_BALANCE.spawnSafeDistance
      || points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < PLAGUE_BALANCE.separation)
      || !clearSpawn(point, plagueVariant(points.length)) || !isReachable(point, field)) continue;
    points.push(point);
  }
  return points;
}
export function createPlagueFlight(variant: PlagueVariant, point: Point, seed: number, index: number): PlagueFlight {
  'worklet';
  return { variant, stage: index % 2 ? 'orbit' : 'roam', height: 0, seed: (seed ^ Math.imul(index + 1, 0x45d9f3b)) >>> 0,
    elapsedMs: 0, routeMs: 0, cooldownMs: 900 + index * 270, vx: 0, vy: 0,
    goalX: point.x, goalY: point.y, targetX: point.x, targetY: point.y, side: index % 2 ? -1 : 1 };
}
function chooseRoute(f: PlagueFlight, boss: Point, player: Point, view: PlagueView, field: FlowField): void {
  'worklet';
  const choice = random(f), orbitEnd = f.variant === 'big' ? .82 : f.variant === 'medium2' ? .5 : .67;
  f.stage = choice < .32 ? 'roam' : choice < orbitEnd ? 'orbit' : 'approach';
  const angle = Math.atan2(boss.y - player.y, boss.x - player.x) + f.side * (.5 + random(f) * 1.2);
  const radius = f.stage === 'approach' ? 95 + random(f) * 45 : 150 + random(f) * 125;
  for (let i = 0; i < 9; i++) {
    const point = bounded(f.stage === 'roam'
      ? { x: view.left + random(f) * (view.right - view.left), y: view.top + random(f) * (view.bottom - view.top) }
      : { x: player.x + Math.cos(angle + i * .36) * radius, y: player.y + Math.sin(angle + i * .36) * radius }, view);
    if (isWalkable(point.x, point.y) && isReachable(point, field)) { f.goalX = point.x; f.goalY = point.y; break; }
  }
  if (random(f) < .3) f.side *= -1;
  f.routeMs = PLAGUE_BALANCE.routeMinMs + random(f) * PLAGUE_BALANCE.routeRangeMs;
  f.elapsedMs = 0;
}
/** One simulation-owned flight action per actor. Visual altitude never changes
 * world hitboxes. Warnings freeze aim; only the authored sting frames hurt. */
export function advancePlagueFlight(state: SurvivalState, source: BossState, before: PlayerState, player: PlayerState, field: FlowField, dt: number, peers?: readonly (BossState | null)[]): { boss: BossState; sting: boolean } {
  'worklet';
  const boss = { ...source }, f = { ...boss.plague! };
  boss.plague = f;
  const tuning = state.purgatorio ? purgatorioTuning(state.purgatorio.number, state.difficulty) : difficultyTuning(state.encounter.wave, state.difficulty);
  const view = plagueView(state.combatView, player), rate = Math.min(1.3, tuning.combatRate);
  const previousMs = f.elapsedMs;
  f.elapsedMs += dt; f.routeMs -= dt; f.cooldownMs = Math.max(0, f.cooldownMs - dt);
  const phase = boss.animationMs / 1000 + (boss.entityId ?? 0) * 1.71;
  f.height = (f.variant === 'big' ? 3 : 7) + Math.sin(phase * (f.variant === 'big' ? 2.2 : 3.5)) * 2;
  if (boss.phase === 'intro') {
    if (boss.phaseMs < 1100) return { boss, sting: false };
    boss.phase = 'recover'; boss.phaseMs = 0;
  }
  const others = (peers ?? [state.boss, ...state.minibosses]).filter((b): b is BossState => Boolean(b?.plague && b.hp > 0 && b.entityId !== boss.entityId));
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  const slots = others.filter(b => b.plague!.stage === 'windup' || b.plague!.stage === 'dive').length;
  if (!['windup', 'dive', 'retreat'].includes(f.stage) && f.cooldownMs === 0 && distance < PLAGUE_BALANCE.attackDistance
    && slots < PLAGUE_BALANCE.maxAttackers[state.difficulty]) {
    const factor = PLAGUE_BALANCE.predictionMs / Math.max(1, dt);
    const target = bounded({ x: player.x + Math.max(-40, Math.min(40, (player.x - before.x) * factor)),
      y: player.y + Math.max(-40, Math.min(40, (player.y - before.y) * factor)) }, view);
    f.targetX = target.x; f.targetY = target.y; f.stage = 'windup'; f.elapsedMs = 0;
    boss.phase = 'warning'; boss.phaseMs = 0; boss.aimAngle = Math.atan2(target.y - boss.y, target.x - boss.x);
  }
  let sting = false, speed = PLAGUE_BALANCE.speed[f.variant] * Math.min(1.65, tuning.speed / DIFFICULTIES.easy.speed);
  let goal = { x: f.goalX, y: f.goalY };
  if (f.stage === 'windup') {
    goal = bounded({ x: boss.x - Math.cos(boss.aimAngle) * 24, y: boss.y - Math.sin(boss.aimAngle) * 24 }, view);
    speed *= .3;
    boss.facingX = Math.cos(boss.aimAngle) < 0 ? -1 : 1;
    if (f.elapsedMs >= Math.max(PLAGUE_BALANCE.minWarningMs, PLAGUE_BALANCE.warningMs / rate)) {
      f.stage = 'dive'; f.elapsedMs = 0; boss.phase = 'attack'; boss.phaseMs = 0; boss.attackRate = rate;
      // Finish the whole authored strike, rather than restarting it while steering.
      f.goalX = f.targetX + Math.cos(boss.aimAngle) * 44; f.goalY = f.targetY + Math.sin(boss.aimAngle) * 44;
    }
  } else if (f.stage === 'dive') {
    const clip = PLAGUE_TIMING[f.variant], ms = f.elapsedMs * rate;
    const remaining = Math.max(.08, ((clip.activeStartMs + clip.activeEndMs) / (2 * rate) - f.elapsedMs) / 1000);
    speed = Math.min(650, Math.max(speed * 2.2, Math.hypot(f.targetX - boss.x, f.targetY - boss.y) / remaining));
    goal = bounded({ x: f.goalX, y: f.goalY }, view);
    sting = ms >= clip.activeStartMs && previousMs * rate < clip.activeEndMs;
    if (ms >= clip.attackMs) {
      f.stage = 'retreat'; f.elapsedMs = 0; f.routeMs = 650 + random(f) * 400;
      f.cooldownMs = PLAGUE_BALANCE.recoveryMs[f.variant] / rate + random(f) * 750;
      const angle = Math.atan2(boss.y - player.y, boss.x - player.x) + f.side * .8;
      const retreat = bounded({ x: player.x + Math.cos(angle) * 255, y: player.y + Math.sin(angle) * 180 }, view);
      f.goalX = retreat.x; f.goalY = retreat.y;
      boss.phase = 'recover'; boss.phaseMs = 0; boss.pattern++;
    }
  } else if (f.stage === 'retreat') {
    goal = { x: f.goalX, y: f.goalY }; speed *= 1.4;
    if (f.routeMs <= 0) chooseRoute(f, boss, player, view, field);
  } else if (f.routeMs <= 0 || Math.hypot(goal.x - boss.x, goal.y - boss.y) < 24) {
    chooseRoute(f, boss, player, view, field); goal = { x: f.goalX, y: f.goalY };
  }
  let dx = goal.x - boss.x, dy = goal.y - boss.y, length = Math.hypot(dx, dy);
  dx /= Math.max(1, length); dy /= Math.max(1, length);
  if (f.stage !== 'dive' && f.stage !== 'windup') {
    const sway = Math.sin(phase * 2.3) * .35;
    const x = dx - dy * sway; dy += dx * sway; dx = x;
    let sx = 0, sy = 0, cx = 0, cy = 0;
    for (const other of others) {
      const ox = boss.x - other.x, oy = boss.y - other.y, d = Math.hypot(ox, oy);
      if (d < 60) { const safe = Math.max(1, d); sx += ox / safe * (60 - d) / 60; sy += oy / safe * (60 - d) / 60; }
      cx += other.x; cy += other.y;
    }
    if (others.length) { dx += sx * .85 + Math.max(-.12, Math.min(.12, (cx / others.length - boss.x) / 1800)); dy += sy * .85 + Math.max(-.12, Math.min(.12, (cy / others.length - boss.y) / 1800)); }
  }
  // Soft steering back into a moving camera; no teleport or world-position snap.
  const outside = boss.x < view.left || boss.x > view.right || boss.y < view.top || boss.y > view.bottom;
  if (outside) { const point = bounded(boss, view); dx = point.x - boss.x; dy = point.y - boss.y; speed = Math.max(speed, 220); }
  length = Math.hypot(dx, dy);
  const smooth = f.stage === 'dive' ? Math.min(1, dt / 45) : Math.min(1, dt / 145);
  f.vx += (dx / Math.max(.001, length) * speed - f.vx) * smooth;
  f.vy += (dy / Math.max(.001, length) * speed - f.vy) * smooth;
  let next = moveWithCollisions(boss, f.vx * dt / 1000, f.vy * dt / 1000);
  if (Math.hypot(next.x - boss.x, next.y - boss.y) < speed * dt / 1000 * .15 && f.stage !== 'windup') {
    const nav = navigationDirection(boss, player, field);
    next = moveWithCollisions(boss, nav.x * speed * dt / 1000, nav.y * speed * dt / 1000);
    // A blocked turn retries on the route clock, never resamples RNG every frame.
    f.routeMs = Math.min(Math.max(250, f.routeMs), 400);
  }
  if (!outside) {
    const safe = bounded(next, view);
    if (isWalkable(safe.x, safe.y)) next = safe;
  }
  boss.x = next.x; boss.y = next.y;
  if (f.stage !== 'windup' && Math.abs(f.vx) > 3) boss.facingX = f.vx < 0 ? -1 : 1;
  // Swept contact prevents fast small stings from skipping a player between
  // display frames. It remains limited to the authored active animation window.
  const mx = boss.x - source.x, my = boss.y - source.y;
  const projection = Math.max(0, Math.min(1, ((player.x - source.x) * mx + (player.y - source.y) * my) / Math.max(.001, mx * mx + my * my)));
  const hitDistance = Math.hypot(player.x - (source.x + mx * projection), player.y - (source.y + my * projection));
  return { boss, sting: sting && hitDistance < PLAGUE_BALANCE.stingRadius[f.variant] };
}
