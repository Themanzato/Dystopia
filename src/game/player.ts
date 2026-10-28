import { moveWithCollisions } from './collision';
import { FRENESIS, frenesisAttackDuration, startFrenesisAction } from './frenesis';

export type MoveInput = { x: number; y: number; strength: number };
export type PlayerAction = 'idle' | 'walk' | 'run' | 'attack' | 'dash' | 'death';
export type PlayerState = {
  frenesis?: boolean; attackHeld?: boolean; spinMs?: number; spinStrike?: boolean; spinCooldownMs?: number;
  attackPending?:boolean;attackPressMs?:number;frenesisAttack?: 'slash1' | 'slash2' | 'slices'; spinHitDone?: boolean; frenesisBlink?: boolean;
  stunMs?: number; speedMultiplier?: number; dashCooldownMultiplier?: number; attackSpeedMultiplier?: number; strikeMultiplier?: number;
  x: number; y: number; facingX: number; aimX: number; aimY: number;
  action: PlayerAction; actionMs: number; attackIndex: number; nextAttack: number;
  attackSerial: number; comboMs: number; dashX: number; dashY: number; dashCooldownMs: number;
};
export const PLAYER_SPAWN = { x: 1425, y: 1345 };
export const REST_INPUT: MoveInput = { x: 0, y: 0, strength: 0 };
export const JOYSTICK_SIZE = 144;
export const JOYSTICK_TRAVEL = 44;
export const WALK_SPEED = 180;
export const DASH_SPEED = 600;
export const DASH_DURATION_MS = 240;
export const DASH_COOLDOWN_MS = 900;
export const PLAYER_SCALE = 1.75;
export const PLAYER_CELL = { width: 90, height: 37, pivotX: 28, pivotY: 34 };
// Audited against the complete original 900 x 999 RGBA image. Row zero is a
// single reference pose. Empty cells at the end of each row are never sampled.
export const PLAYER_ANIMATIONS = {
  idle: { row: 1, frames: 9, fps: 9 },
  walk: { row: 2, frames: 8, fps: 10 },
  run: { row: 3, frames: 8, fps: 13 },
  attack: [
    { row: 7, frames: 7, fps: 18 },
    { row: 8, frames: 5, fps: 16 },
    { row: 9, frames: 5, fps: 16 },
    { row: 10, frames: 6, fps: 18 },
  ],
  dash: { row: 12, frames: 6, fps: 25 },
  death: { row: 26, frames: 6, fps: 10 },
};

export function createPlayer(): PlayerState {
  'worklet';
  return { ...PLAYER_SPAWN, facingX: 1, aimX: 1, aimY: 0, action: 'idle', actionMs: 0,
    attackIndex: 0, nextAttack: 0, attackSerial: 0, comboMs: 0, dashX: 1, dashY: 0, dashCooldownMs: 0 };
}

// Quantize the stick to eight equally fast directions. The small dead zone
// prevents drift; its remaining travel controls walking versus running.
export function joystickInput(x: number, y: number, deadZone = 6): MoveInput {
  'worklet';
  const length = Math.hypot(x, y);
  if (length <= deadZone) return REST_INPUT;
  const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: Math.cos(angle), y: Math.sin(angle), strength: Math.min(1, (length - deadZone) / (JOYSTICK_TRAVEL - deadZone)) };
}

export function beginAttack(player: PlayerState): PlayerState {
  'worklet';
  if (player.action === 'death' || player.frenesisBlink) return player;
  if(player.frenesis){
    if((player.stunMs??0)>0||player.action==='dash'||player.action==='attack'||(player.spinCooldownMs??0)>0)return player;
    return startFrenesisAction({...player,attackHeld:false,attackPressMs:0},'slash1');
  }
  if ((player.stunMs ?? 0) > 0 || player.action === 'dash' || player.action === 'attack') return player;
  const attackIndex = player.comboMs > 0 ? player.nextAttack : 0;
  return { ...player, action: 'attack', actionMs: 0, attackIndex, attackSerial: player.attackSerial + 1,
    nextAttack: (attackIndex + 1) % PLAYER_ANIMATIONS.attack.length, comboMs: 1100 };
}

/** Distinguish touch intent before drawing either mutually exclusive attack. */
export function requestAttack(player:PlayerState):PlayerState {
  'worklet';
  if(!player.frenesis)return beginAttack(player);
  if(player.action==='death'||player.frenesisBlink||(player.stunMs??0)>0||player.action==='dash'||player.attackHeld)return player;
  return {...player,attackHeld:true,attackPending:true,attackPressMs:0};
}

export function beginDash(player: PlayerState, input: MoveInput): PlayerState {
  'worklet';
  if (player.action === 'death' || player.frenesisBlink || (player.stunMs ?? 0) > 0 || player.action === 'dash' || player.dashCooldownMs > 0) return player;
  const x = input.strength > 0 ? input.x : player.aimX;
  const y = input.strength > 0 ? input.y : player.aimY;
  return { ...player, ...(player.frenesis ? { spinStrike: false, spinHitDone:false,frenesisAttack: undefined,attackPending:player.attackHeld } : {}), action: 'dash', actionMs: 0, dashX: x, dashY: y, aimX: x, aimY: y,
    facingX: Math.abs(x) > 0.1 ? Math.sign(x) : player.facingX, dashCooldownMs: DASH_COOLDOWN_MS * (player.dashCooldownMultiplier ?? 1) };
}

export function advancePlayer(player: PlayerState, input: MoveInput, elapsedMs: number): PlayerState {
  'worklet';
  // A stalled frame must never teleport the player. Background time is paused
  // by the frame callback, rather than being caught up on resuming the app.
  const dt = Math.max(0, Math.min(40, elapsedMs));
  if (!dt) return player;
  if (player.action === 'death') return { ...player, actionMs: Math.min(600, player.actionMs + dt) };
  if (player.frenesis) player = { ...player, spinCooldownMs: Math.max(0, (player.spinCooldownMs ?? 0) - dt),attackPressMs:player.attackHeld?(player.attackPressMs??0)+dt:0 };
  const cooldown = Math.max(0, player.dashCooldownMs - dt);
  if (player.frenesisBlink) return { ...player, action: 'idle', actionMs: 0, spinStrike: false, dashCooldownMs: cooldown };
  if ((player.stunMs ?? 0) > 0) return { ...player, action: 'idle', actionMs: 0, comboMs: 0, dashCooldownMs: cooldown, attackHeld:false,attackPending:false,attackPressMs:0,spinStrike:false, spinHitDone:false, frenesisAttack:undefined,spinMs:0 };
  if(player.frenesis&&player.attackHeld&&(player.attackPressMs??0)>=FRENESIS.holdThresholdMs&&player.action!=='attack'&&player.action!=='dash'&&(player.spinCooldownMs??0)<=0)player=startFrenesisAction(player,'slices');
  const comboMs = Math.max(0, player.comboMs - dt);
  const actionMs = player.actionMs + dt * (player.action === 'attack' ? (player.attackSpeedMultiplier ?? 1) : 1);
  if (player.action === 'dash') {
    const movingMs = Math.min(dt, Math.max(0, DASH_DURATION_MS - player.actionMs));
    const position = moveWithCollisions(player, player.dashX * DASH_SPEED * movingMs / 1000, player.dashY * DASH_SPEED * movingMs / 1000);
    return { ...player, ...position, action: actionMs >= DASH_DURATION_MS ? 'idle' : 'dash',
      actionMs: actionMs >= DASH_DURATION_MS ? 0 : actionMs, dashCooldownMs: cooldown, comboMs };
  }
  if (player.frenesis && player.action === 'attack') {
    const duration = frenesisAttackDuration(player);
    const moving = input.strength > 0;
    const position = moving ? moveWithCollisions(player, input.x * input.strength * WALK_SPEED * (player.speedMultiplier ?? 1) * dt / 1000, input.y * input.strength * WALK_SPEED * (player.speedMultiplier ?? 1) * dt / 1000) : player;
    // Looking can change while moving, without replacing the attack clip.
    const direction={facingX:moving&&Math.abs(input.x)>.1?Math.sign(input.x):player.facingX,
      aimX:moving?input.x:player.aimX,aimY:moving?input.y:player.aimY};
    player={...player,...direction};
    if(player.actionMs>=duration){
      if(player.frenesisAttack==='slash1')return {...player,x:position.x,y:position.y,frenesisAttack:'slash2',actionMs:0,spinMs:0,spinStrike:false,dashCooldownMs:cooldown};
      const readyHold=player.attackHeld&&(player.attackPressMs??0)>=FRENESIS.holdThresholdMs;
      if(readyHold&&(player.spinCooldownMs??0)>0)return {...player,x:position.x,y:position.y,spinStrike:false,dashCooldownMs:cooldown};
      const resumed=moving?(input.strength<.55?'walk':'run'):'idle';
      const finished:PlayerState={...player,x:position.x,y:position.y,action:resumed,actionMs:0,frenesisAttack:undefined,spinStrike:false,spinHitDone:false,spinMs:0,dashCooldownMs:cooldown};
      return readyHold?startFrenesisAction(finished,'slices'):finished;
    }
    const elapsed=Math.min(duration,actionMs);
    const hitMs=player.frenesisAttack==='slices'?0:FRENESIS.slashHitMs;
    const pulse=player.frenesisAttack!=='slash2'&&!player.spinHitDone&&elapsed>=hitMs;
    return {...player,x:position.x,y:position.y,action:'attack',actionMs:elapsed,spinMs:elapsed,spinStrike:pulse,
      spinHitDone:Boolean(player.spinHitDone||pulse),dashCooldownMs:cooldown,comboMs:0};
  }
  if (player.action === 'attack') {
    const animation = PLAYER_ANIMATIONS.attack[player.attackIndex];
    const duration = animation.frames * 1000 / animation.fps;
    const finished = player.actionMs >= duration;
    // The asset's sword arcs face left/right. Keep that facing locked through
    // the swing; no invented vertical frames, projectiles or damage system.
    return { ...player, action: finished ? 'idle' : 'attack', actionMs: finished ? 0 : Math.min(duration,actionMs), dashCooldownMs: cooldown, comboMs };
  }
  const moving = input.strength > 0;
  const position = moving ? moveWithCollisions(player, input.x * input.strength * WALK_SPEED * (player.speedMultiplier ?? 1) * dt / 1000, input.y * input.strength * WALK_SPEED * (player.speedMultiplier ?? 1) * dt / 1000) : player;
  const travelled = Math.hypot(position.x - player.x, position.y - player.y) > 0.001;
  const action: PlayerAction = travelled ? (input.strength < 0.55 ? 'walk' : 'run') : 'idle';
  return { ...player, x: position.x, y: position.y, action,
    actionMs: action === player.action ? actionMs : 0,
    facingX: moving && Math.abs(input.x) > 0.1 ? Math.sign(input.x) : player.facingX,
    aimX: moving ? input.x : player.aimX, aimY: moving ? input.y : player.aimY,
    dashCooldownMs: cooldown, comboMs };
}

export function playerFrame(player: PlayerState) {
  'worklet';
  const animation = player.action === 'attack' ? PLAYER_ANIMATIONS.attack[player.attackIndex] : PLAYER_ANIMATIONS[player.action];
  const index = Math.floor(player.actionMs * animation.fps / 1000);
  const frame = player.action === 'death' || player.action === 'attack' || player.action === 'dash' ? Math.min(animation.frames - 1, index) : index % animation.frames;
  return { x: frame * PLAYER_CELL.width, y: animation.row * PLAYER_CELL.height, width: PLAYER_CELL.width, height: PLAYER_CELL.height };
}
