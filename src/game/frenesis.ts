import { isWalkable } from './collision';
import type { PlayerState } from './player';

export const FRENESIS = {
  capacity: 100, damageCharge: 0.25, npcKillCharge: 1.25,
  bossDamageCharge: 0.35, maxChargePerHit: 1, bossChargeLimit: 25,
  durationMs: 15000, temporaryHp: 5, moveMultiplier: 1.45, attackMultiplier: 1.5,
  teleportCooldownMs: 3000, effectMs: 420, blinkOutMs: 160, blinkTravelMs: 120,
  slashDurationMs: 350, slash2DurationMs: 5 * 1000 / 18, slicesDurationMs: 550, slashHitMs: 150,
  holdThresholdMs:180, rangeMultiplier:1.2,
  spinIntervalMs: 550, spinRadius: 82, spinDamage: 1,
};
export type FrenesisState = {
  charge: number; bossCharge: number; active: boolean; remainingMs: number; hp: number;
  teleportMs: number; flashMs: number;
  teleport: { fromX: number; fromY: number; x: number; y: number; elapsedMs: number } | null;
};
export function createFrenesis(): FrenesisState {
  'worklet';
  return { charge: 0, bossCharge: 0, active: false, remainingMs: 0, hp: 0, teleportMs: 0, flashMs: 0, teleport: null };
}
export function endFrenesis(f: FrenesisState): FrenesisState {
  'worklet';
  return { ...f, active: false, remainingMs: 0, hp: 0, teleportMs: 0, flashMs: 0, teleport: null };
}
export function advanceFrenesis(f: FrenesisState, dt: number): FrenesisState {
  'worklet';
  if (!f.active) return f;
  if (f.remainingMs <= dt || f.hp <= 0) return endFrenesis(f);
  return { ...f, remainingMs: f.remainingMs - dt, teleportMs: Math.max(0, f.teleportMs - dt), flashMs: Math.max(0, f.flashMs - dt),
    teleport: f.teleport && f.teleport.elapsedMs + dt < FRENESIS.effectMs ? { ...f.teleport, elapsedMs: f.teleport.elapsedMs + dt } : null };
}
/** Call only after changing enemy HP or accepting its first death transition. */
export function chargeFrenesis(f: FrenesisState, actualDamage: number, npcKilled: boolean, boss = false): FrenesisState {
  'worklet';
  if (f.active || actualDamage <= 0 || !Number.isFinite(actualDamage)) return f;
  const hit = Math.min(FRENESIS.maxChargePerHit, actualDamage * (boss ? FRENESIS.bossDamageCharge : FRENESIS.damageCharge));
  const damage = boss ? Math.min(hit, Math.max(0, FRENESIS.bossChargeLimit - f.bossCharge)) : hit;
  return { ...f, charge: Math.min(FRENESIS.capacity, f.charge + damage + (npcKilled && !boss ? FRENESIS.npcKillCharge : 0)), bossCharge: f.bossCharge + (boss ? damage : 0) };
}
export function startFrenesis(f: FrenesisState, allowed: boolean): FrenesisState {
  'worklet';
  if (!allowed || f.active || f.charge < FRENESIS.capacity) return f;
  return { ...createFrenesis(), active: true, remainingMs: FRENESIS.durationMs, hp: FRENESIS.temporaryHp, flashMs: FRENESIS.effectMs };
}
/** Uses the same translation and scale as the rendered camera, including shake. */
export function screenToFrenesisWorld(x: number, y: number, tx: number, ty: number, scale: number) {
  'worklet';
  return { x: (x - tx) / scale, y: (y - ty) / scale };
}
/** Start one logical attack; hit serials and cooldown belong to this action. */
export function startFrenesisAction(p:PlayerState,kind:'slash1'|'slices'):PlayerState {
  'worklet';
  return {...p,action:'attack',actionMs:0,frenesisAttack:kind,spinMs:0,spinStrike:false,spinHitDone:false,attackPending:false,
    facingX:Math.abs(p.aimX)>.1?Math.sign(p.aimX):p.facingX,
    spinCooldownMs:FRENESIS.spinIntervalMs/(p.attackSpeedMultiplier??1),attackSerial:p.attackSerial+1};
}
export function stopFrenesisSpin(p: PlayerState): PlayerState {
  'worklet';
  if (!p.frenesis) return p;
  return { ...p, attackHeld: false, attackPending:false,attackPressMs:0,spinStrike: false, spinMs: 0, frenesisAttack: undefined, spinHitDone: false, action: p.action === 'attack' ? 'idle' : p.action, actionMs: p.action === 'attack' ? 0 : p.actionMs };
}
export function teleportFrenesis(f: FrenesisState, player: PlayerState, x: number, y: number, allowed: boolean) {
  'worklet';
  if (!allowed || !f.active || f.teleportMs > 0 || (player.stunMs ?? 0) > 0 || !isWalkable(x, y)) return { frenesis: f, player };
  return { player: { ...stopFrenesisSpin(player), attackHeld: player.attackHeld, attackPending:player.attackHeld,attackPressMs:player.attackHeld?FRENESIS.holdThresholdMs:0,x, y, frenesisBlink: true }, frenesis: { ...f, teleportMs: FRENESIS.teleportCooldownMs,
    teleport: { fromX: player.x, fromY: player.y, x, y, elapsedMs: 0 } } };
}
/** Pause/layout changes release input but preserve the complete attack timeline. */
export function suspendFrenesisAttack(p: PlayerState): PlayerState {
  'worklet';
  return p.frenesis ? { ...p, attackHeld:false, attackPending:false,attackPressMs:0,spinStrike:false } : p;
}
/** A quick tap selects the normal sequence; releasing a hold finishes its current spin. */
export function releaseFrenesisAttack(p: PlayerState): PlayerState {
  'worklet';
  if(!p.frenesis)return p;
  const tap=p.attackPending&&p.attackHeld&&(p.attackPressMs??0)<FRENESIS.holdThresholdMs&&p.action!=='attack'&&p.action!=='dash'&&p.action!=='death'&&!p.frenesisBlink&&(p.stunMs??0)<=0&&(p.spinCooldownMs??0)<=0;
  const released={...p,attackHeld:false,attackPending:false,attackPressMs:0,spinStrike:false};
  return tap?startFrenesisAction(released,'slash1'):released;
}
export function frenesisAttackDuration(p: PlayerState): number {
  'worklet';
  return p.frenesisAttack==='slices'?FRENESIS.slicesDurationMs:p.frenesisAttack === 'slash2' ? FRENESIS.slash2DurationMs : FRENESIS.slashDurationMs;
}
export function frenesisVisualPosition(p: PlayerState, f?: FrenesisState) {
  'worklet';
  const t = f?.active ? f.teleport : null;
  if (!t) return { x: p.x, y: p.y };
  const phase = Math.max(0, Math.min(1, (t.elapsedMs - FRENESIS.blinkOutMs) / FRENESIS.blinkTravelMs));
  const travel = phase * phase * (3 - 2 * phase);
  return { x: t.fromX + (t.x - t.fromX) * travel, y: t.fromY + (t.y - t.fromY) * travel };
}
