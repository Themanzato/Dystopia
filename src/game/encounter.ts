import { ANIMATED_PROPS, PROPS, type Point } from './map';
import { isWalkable, moveWithCollisions } from './collision';
import { isReachable, navigationDirection, type FlowField } from './navigation';
import { NPC_ANIMATIONS, NPC_CELL, NPC_POOL_SIZE, NPC_SCALE, emptyNpc, type Npc } from './npc';
import { swordHitsNpc } from './combat';
import type { PlayerState } from './player';

export const WAVE_CONFIG = {
  firstWaveCount: 6, increasePerWave: 2, maxPerWave: 36,
  maxSimultaneous: NPC_POOL_SIZE, spawnIntervalMs: 650,
  intermissionMs: 2500, initialDelayMs: 1200, retrySpawnMs: 200,
  spawnMinDistance: 300, spawnMaxDistance: 460,
  speed: 60, stoppingDistance: 23, separationDistance: 26,
};
export type WaveConfig = typeof WAVE_CONFIG;
export type Encounter = {
  wave: number; remaining: number; phase: 'intermission' | 'spawning' | 'clearing';
  timerMs: number; spawnMs: number; randomSeed: number; nextId: number;
  defeated: number; enemies: Npc[];
};
const SPAWN_BLOCKERS = [...PROPS, ...ANIMATED_PROPS].filter(p => !p.groundDetail).map(p => p.destination);
export function createEncounter(seed = 0x64797374): Encounter {
  'worklet';
  return { wave: 0, remaining: 0, phase: 'intermission', timerMs: WAVE_CONFIG.initialDelayMs,
    spawnMs: 0, randomSeed: seed, nextId: 1, defeated: 0, enemies: Array.from({ length: NPC_POOL_SIZE }, () => emptyNpc()) };
}
export function waveSize(wave: number, options?: WaveConfig): number {
  'worklet';
  const config = options ?? WAVE_CONFIG;
  return Math.min(config.maxPerWave, config.firstWaveCount + Math.max(0, wave - 1) * config.increasePerWave);
}
export function spawnIsClear(position: Point, player: Point, enemies: readonly Npc[], field: FlowField, options?: WaveConfig): boolean {
  'worklet';
  const config = options ?? WAVE_CONFIG;
  const distance = Math.hypot(position.x - player.x, position.y - player.y);
  if (distance < config.spawnMinDistance || distance > config.spawnMaxDistance || !isWalkable(position.x, position.y) || !isReachable(position, field)) return false;
  const halfWidth = 12;
  const top = position.y - NPC_CELL.pivotY * NPC_SCALE;
  // A valid foot position alone may be hidden beneath a projected roof. Keep
  // the whole spawning body clear of buildings, machines and solid scenery.
  for (const b of SPAWN_BLOCKERS) if (position.x - halfWidth < b.x + b.width + 5 && position.x + halfWidth > b.x - 5 && top < b.y + b.height + 5 && position.y + 5 > b.y - 5) return false;
  for (const other of enemies) if (other.active && other.action !== 'death' && Math.hypot(position.x - other.x, position.y - other.y) < config.separationDistance + 8) return false;
  return true;
}
function findSpawn(encounter: Encounter, player: Point, field: FlowField, config: WaveConfig): { position: Point | null; seed: number } {
  'worklet';
  let seed = encounter.randomSeed;
  for (let attempt = 0; attempt < 36; attempt++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const angle = seed / 4294967296 * Math.PI * 2;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const radius = config.spawnMinDistance + seed / 4294967296 * (config.spawnMaxDistance - config.spawnMinDistance);
    const position = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
    if (spawnIsClear(position, player, encounter.enemies, field, config)) return { position, seed };
  }
  return { position: null, seed };
}
export function advanceEncounter(current: Encounter, before: PlayerState, player: PlayerState, field: FlowField, elapsedMs: number, options?: WaveConfig): Encounter {
  'worklet';
  const config = options ?? WAVE_CONFIG;
  const dt = Math.max(0, Math.min(40, elapsedMs));
  if (!dt) return current;
  let defeated = current.defeated;
  const enemies = current.enemies.map(npc => {
    if (!npc.active) return npc;
    const ms = npc.actionMs + dt;
    if (npc.action === 'death') return ms >= NPC_ANIMATIONS.death.frames * 1000 / NPC_ANIMATIONS.death.fps ? emptyNpc() : { ...npc, actionMs: ms };
    if (swordHitsNpc(before, player, npc)) {
      defeated++;
      // Changing state immediately makes death non-collidable/non-hittable. The
      // serial and monotonically increasing id also protect against pooled reuse.
      return { ...npc, action: 'death' as const, actionMs: 0, lastHitSerial: before.attackSerial };
    }
    if (npc.action === 'spawn' || npc.action === 'wake') {
      const animation = NPC_ANIMATIONS[npc.action];
      const duration = animation.frames * 1000 / animation.fps;
      return ms < duration ? { ...npc, actionMs: ms } : { ...npc, action: npc.action === 'spawn' ? 'wake' as const : 'move' as const, actionMs: ms - duration };
    }
    const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
    const facingX = Math.abs(player.x - npc.x) > 1 ? Math.sign(player.x - npc.x) : npc.facingX;
    if (distance <= config.stoppingDistance) return { ...npc, facingX, action: 'idle' as const, actionMs: npc.action === 'idle' ? ms : 0 };
    const direction = navigationDirection(npc, player, field);
    let separateX = 0, separateY = 0;
    for (const other of current.enemies) {
      if (!other.active || other.id === npc.id || other.action === 'death') continue;
      const dx = npc.x - other.x, dy = npc.y - other.y, separation = Math.hypot(dx, dy);
      if (separation > 0.001 && separation < config.separationDistance) {
        const push = (1 - separation / config.separationDistance) * 0.65;
        separateX += dx / separation * push; separateY += dy / separation * push;
      }
    }
    const x = direction.x + separateX, y = direction.y + separateY, length = Math.hypot(x, y);
    const step = Math.min(config.speed * dt / 1000, Math.max(0, distance - config.stoppingDistance));
    let position = length > 0 ? moveWithCollisions(npc, x / length * step, y / length * step) : npc;
    if (Math.hypot(position.x - npc.x, position.y - npc.y) < step * 0.25) position = moveWithCollisions(npc, direction.x * step, direction.y * step);
    const moving = Math.hypot(position.x - npc.x, position.y - npc.y) > 0.001;
    return { ...npc, x: position.x, y: position.y, facingX: moving && Math.abs(position.x - npc.x) > 0.01 ? Math.sign(position.x - npc.x) : facingX, action: moving ? 'move' as const : 'idle' as const, actionMs: moving && npc.action === 'move' || !moving && npc.action === 'idle' ? ms : 0 };
  });
  let next: Encounter = { ...current, enemies, defeated };
  if (next.phase === 'intermission') {
    next.timerMs = Math.max(0, next.timerMs - dt);
    if (next.timerMs > 0) return next;
    next.wave++; next.remaining = waveSize(next.wave, config); next.phase = 'spawning'; next.spawnMs = 0;
  }
  if (next.phase === 'spawning') {
    next.spawnMs = Math.max(0, next.spawnMs - dt);
    const occupied = enemies.filter(npc => npc.active).length;
    if (next.remaining > 0 && next.spawnMs <= 0 && occupied < Math.min(NPC_POOL_SIZE, config.maxSimultaneous)) {
      const found = findSpawn(next, player, field, config);
      next.randomSeed = found.seed;
      if (found.position) {
        const slot = enemies.findIndex(npc => !npc.active);
        enemies[slot] = { ...emptyNpc(), ...found.position, id: next.nextId++, active: true, action: 'spawn', facingX: player.x < found.position.x ? -1 : 1 };
        next.remaining--; next.spawnMs = config.spawnIntervalMs;
      } else next.spawnMs = config.retrySpawnMs;
    }
    if (!next.remaining) next.phase = 'clearing';
  }
  if (next.phase === 'clearing' && !enemies.some(npc => npc.active && npc.action !== 'death')) {
    next.phase = 'intermission'; next.timerMs = config.intermissionMs;
  }
  return next;
}
