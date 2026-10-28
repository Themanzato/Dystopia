import { ENEMY_VISUALS } from './enemyAnimations';
import { attackMotionRoot } from './enemyMotion';
import type { BossAttack } from './bossAttacks';
import type { EnemyId } from './enemyCatalog';
import type { BossHazard } from './bossEffects';
import type { PlayerState } from './player';
import { isWalkable } from './collision';

export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  'worklet';
  const dx = bx - ax, dy = by - ay, size = dx * dx + dy * dy;
  const t = size > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / size)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
export function hazardHits(h: BossHazard, player: PlayerState, previousX = h.x, previousY = h.y): boolean {
  'worklet';
  if (h.kind === 'teleport') return false;
  if (h.kind === 'beam') {
    const dx = player.x - h.x, dy = player.y - h.y;
    const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
    return along >= -10 && along <= h.length + 10 && Math.abs(-dx * Math.sin(h.angle) + dy * Math.cos(h.angle)) < h.radius + 10;
  }
  if (h.kind === 'ball' || h.kind === 'arrow') return distanceToSegment(player.x, player.y, previousX, previousY, h.x, h.y) < h.radius + 10;
  if (h.kind === 'bomb') return Math.abs(player.x - h.x) < h.radius + 9 && Math.abs(player.y - h.y) < (h.halfHeight ?? h.radius) + 9;
  return Math.hypot(player.x - h.x, player.y - h.y) < h.radius + 9;
}
export function projectilePathClear(ax: number, ay: number, bx: number, by: number): boolean {
  'worklet';
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 12));
  for (let i = 1; i <= steps; i++) if (!isWalkable(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps)) return false;
  return true;
}

/** Conservative world-space envelope of the REAL charge path, including the
 * horizontal translation authored inside cells. The tell contains every active
 * body position; a sparse center line alone would understate Mush's reach. */
export function chargeWarningCorners(boss: { id: EnemyId; x: number; y: number; facingX: number; aimAngle: number; attackRate?: number }, move: BossAttack, speedMultiplier: number): { x: number; y: number }[] {
  'worklet';
  const rate = boss.attackRate ?? 1, clip = ENEMY_VISUALS[boss.id][move.clip] ?? ENEMY_VISUALS[boss.id].attack;
  const root = attackMotionRoot(boss.id, Math.min(move.durationMs, move.activeEndMs + 40 * rate) / rate, move.durationMs / rate, move.clip) * clip.scale * boss.facingX * clip.authoredFacing;
  const forward = move.speed * speedMultiplier * (Math.max(0, move.activeEndMs - move.activeStartMs * 0.8) / rate + 40) / 1000;
  const c = Math.cos(boss.aimAngle), s = Math.sin(boss.aimAngle), radius = move.range * 0.65;
  const rootAlong = root * c, rootSide = -root * s;
  const low = Math.min(0, rootAlong) - radius, high = forward + Math.max(0, rootAlong) + radius;
  const near = Math.min(0, rootSide) - radius, far = Math.max(0, rootSide) + radius;
  return [[low, near], [high, near], [high, far], [low, far]].map(p => ({ x: boss.x + p[0] * c - p[1] * s, y: boss.y + p[0] * s + p[1] * c }));
}
