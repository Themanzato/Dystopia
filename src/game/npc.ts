import type { Box } from './map';

export const NPC_POOL_SIZE = 60;
export const NPC_SCALE = 1.75;
export const NPC_CELL = { width: 62, height: 33, pivotX: 31, pivotY: 32 };
export const NPC_BODY = { radius: 9, topAboveFeet: 32, bottomAboveFeet: 9 };
export const NPC_ANIMATIONS = {
  spawn: { row: 5, frames: 11, fps: 14 },
  wake: { row: 0, frames: 4, fps: 10 },
  move: { row: 1, frames: 9, fps: 12 },
  death: { row: 4, frames: 8, fps: 14 },
};
export type NpcKind = 'ghoul' | 'spitter' | 'summoner';
export type NpcAction = 'idle' | keyof typeof NPC_ANIMATIONS;
export type Npc = {
  summonOwner?: number;
  eventOwner?: number; eliteEventId?: number; hp?: number; maxHp?: number; eliteSpeed?: number;
  id: number; active: boolean; x: number; y: number; facingX: number;
  kind?: NpcKind; action: NpcAction; actionMs: number; lastHitSerial: number;
};
export function emptyNpc(): Npc {
  'worklet';
  return { id: 0, active: false, x: 0, y: 0, facingX: 1, action: 'idle', actionMs: 0, lastHitSerial: -1 };
}
export function npcAnimation(npc: Npc): { row: number; frames: number; fps: number } {
  'worklet';
  if (!npc.kind || npc.kind === 'ghoul') return npc.action === 'idle' ? { row: 0, frames: 1, fps: 1 } : NPC_ANIMATIONS[npc.action];
  if (npc.action === 'death') return { row: 4, frames: npc.kind === 'spitter' ? 9 : 10, fps: 14 };
  if (npc.action === 'move') return { row: 1, frames: npc.kind === 'spitter' ? 7 : 6, fps: 12 };
  // These two originals have no emergence animation: use the authored idle strip.
  return { row: 0, frames: 6, fps: 8 };
}
export function npcCell(npc: Npc) {
  'worklet';
  if (npc.kind === 'spitter') return { width: 57, height: 39, pivotX: 38, pivotY: 38, scale: 1.6 };
  if (npc.kind === 'summoner') return { width: 46, height: 44, pivotX: 30, pivotY: 43, scale: 1.25 };
  return { ...NPC_CELL, scale: NPC_SCALE };
}
export function npcFrame(npc: Npc): { image: number; source: Box } {
  'worklet';
  // The Ghoul idle PNG is a single static cell, never a fabricated animation.
  if ((!npc.kind || npc.kind === 'ghoul') && npc.action === 'idle') return { image: 2, source: { x: 0, y: 0, width: 62, height: 33 } };
  const animation = npcAnimation(npc);
  const cell = npcCell(npc);
  const index = Math.floor(npc.actionMs * animation.fps / 1000);
  const loops = npc.action === 'move' || npc.action === 'idle' || (npc.kind !== undefined && npc.kind !== 'ghoul' && npc.action !== 'death');
  const frame = loops ? index % animation.frames : Math.min(animation.frames - 1, index);
  return { image: npc.kind === 'spitter' ? 3 : npc.kind === 'summoner' ? 4 : 1,
    source: { x: frame * cell.width, y: animation.row * cell.height, width: cell.width, height: cell.height } };
}
