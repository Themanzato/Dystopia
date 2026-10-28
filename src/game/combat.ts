import { isWalkable } from './collision';
import { FRENESIS } from './frenesis';
import { PLAYER_ANIMATIONS, PLAYER_CELL, PLAYER_SCALE, type PlayerState } from './player';
import { NPC_BODY, type Npc } from './npc';

// Rectangles are authored in the ORIGINAL Swordmaster cell coordinate space,
// around the visible sword/VFX sweep. They are mirrored about the real foot pivot.
// Startup/recovery poses never deal damage. The fourth authored swing sweeps behind too.
export const SWORD_STRIKES = [
  { firstFrame: 1, lastFrame: 2, x: 24, y: 18, width: 65, height: 17 },
  { firstFrame: 1, lastFrame: 1, x: 8, y: 16, width: 81, height: 18 },
  { firstFrame: 1, lastFrame: 1, x: 16, y: 0, width: 73, height: 34 },
  { firstFrame: 0, lastFrame: 1, x: 0, y: 19, width: 89, height: 15 },
];
export function strikeOverlapsFrame(before: PlayerState, after: PlayerState): boolean {
  'worklet';
  if (before.action !== 'attack' || before.attackSerial <= 0 || before.attackSerial !== after.attackSerial) return false;
  const strike = SWORD_STRIKES[before.attackIndex];
  const animation = PLAYER_ANIMATIONS.attack[before.attackIndex];
  const endMs = after.action === 'attack' ? after.actionMs : animation.frames * 1000 / animation.fps;
  return endMs >= strike.firstFrame * 1000 / animation.fps && before.actionMs < (strike.lastFrame + 1) * 1000 / animation.fps;
}
export function swordHitsNpc(before: PlayerState, after: PlayerState, npc: Npc): boolean {
  'worklet';
  if (before.frenesis || after.frenesis) {
    if (!after.frenesis || after.frenesisBlink || !after.spinStrike || after.action !== 'attack' || !npc.active || npc.action === 'death' || npc.lastHitSerial === after.attackSerial) return false;
    const distance = Math.hypot(npc.x - after.x, npc.y - after.y);
    if (distance > FRENESIS.spinRadius * FRENESIS.rangeMultiplier * (after.strikeMultiplier ?? 1)) return false;
    // Normal slashes strike toward the current aim; the held spin remains radial.
    if(after.frenesisAttack!=='slices'&&(npc.x-after.x)*after.aimX+(npc.y-after.y)*after.aimY < -NPC_BODY.radius)return false;
    const steps = Math.max(1, Math.ceil(distance / 6));
    for (let i = 1; i <= steps; i++) if (!isWalkable(after.x + (npc.x - after.x) * i / steps, after.y + (npc.y - after.y) * i / steps)) return false;
    return true;
  }
  if (!npc.active || npc.action === 'death' || npc.lastHitSerial === before.attackSerial || !strikeOverlapsFrame(before, after)) return false;
  const strike = SWORD_STRIKES[before.attackIndex];
  const left = (strike.x - PLAYER_CELL.pivotX) * PLAYER_SCALE;
  const right = left + strike.width * PLAYER_SCALE;
  const padding = ((before.strikeMultiplier ?? 1) - 1) * 42;
  const minX = before.x + (before.facingX > 0 ? left : -right) - padding;
  const maxX = before.x + (before.facingX > 0 ? right : -left) + padding;
  const minY = before.y + (strike.y - PLAYER_CELL.pivotY) * PLAYER_SCALE - padding;
  const maxY = minY + strike.height * PLAYER_SCALE + padding * 2;
  const bodyTop = npc.y - NPC_BODY.topAboveFeet;
  const bodyBottom = npc.y - NPC_BODY.bottomAboveFeet;
  const dx = npc.x - Math.max(minX, Math.min(maxX, npc.x));
  const dy = Math.max(0, bodyTop - maxY, minY - bodyBottom);
  if (dx * dx + dy * dy > NPC_BODY.radius * NPC_BODY.radius) return false;
  // Sword VFX can overlap a facade; an NPC on the other side of its solid base
  // must not be struck through the wall. Only in-range targets pay this cost.
  const distance = Math.hypot(npc.x - before.x, npc.y - before.y);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable(before.x + (npc.x - before.x) * t, before.y + (npc.y - before.y) * t)) return false;
  }
  return true;
}
