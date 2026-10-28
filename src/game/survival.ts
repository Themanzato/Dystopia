import type { TutorialState } from './tutorialTypes';
import { playActionSound, stopActionSound, stopOwnerSounds, hasAuthoredAttackSound, type ActionSoundEvents } from './actionSounds';
import { createRotation, peekRotation, consumeRotation, type Rotation } from './rotation';
import { milestoneChestPosition } from './chestPlacement';
import type { MerchantSystem } from './merchantConfig';
import { createMissionTelemetry, type MissionTelemetry } from './missionTelemetry';
import { normalizeEquipment, workshopBonuses, type WorkshopId } from './workshop';
import { UPGRADE_EFFECTS } from './upgradeBalance';
import { createRunStats, type RunStats } from './scores';
import { OPTIONAL_EVENT_CONFIG, createOptionalEvents, clearOptionalEvents, optionalTuning, advanceEventPoint, type OptionalEvent } from './optionalEvents';
import { hazardHits, projectilePathClear } from './bossHazards';
import { FRENESIS, createFrenesis, startFrenesis, endFrenesis, advanceFrenesis, chargeFrenesis, stopFrenesisSpin, type FrenesisState } from './frenesis';
import { BOSS_BALANCE, bossMode } from './bossBalance';
import { dustBeepTick, dustJumpTimeline, dustPressure } from './dustJumper';
import type { BossHazard } from './bossEffects';
import { BANDIT_ENCOUNTER_NAME, createPurgatorio, nextPurgatorioEnemy, purgatorioTuning, PURGATORIO_CONFIG, type PurgatorioState, type RunSelection } from './purgatorio';
import { attackMotionRoot, banditExitRoot } from './enemyMotion';
import { ENEMY_VISUALS } from './enemyAnimations';
import { ADVANCED_EVENT_OVERLAP_WAVE, MISSION_EVENT_KINDS, type MissionKind, WORLD_EVENT_CONFIG, createWorldEvents, worldRandom, canStartOptional, canRunWorldEvent, advanceCapture, canStartSpecial, hasLivingSpecial, type WorldEvents, type ZoneReward } from './worldEvents';
import { REWARD_SITES, SHIP_SITES } from './worldEventSites';
import { DIFFICULTIES, WAVE_BALANCE, difficultyTuning, type Difficulty } from './difficulty';
import { bossAttack, bossAttackCount } from './bossAttacks';
import { isWalkable, moveWithCollisions } from './collision';
import { swordHitsNpc } from './combat';
import { createEncounter, spawnIsClear, WAVE_CONFIG, type Encounter } from './encounter';
import { navigationDirection, isReachable, type FlowField } from './navigation';
import { emptyNpc, NPC_ANIMATIONS, npcAnimation, type Npc } from './npc';
import { PROPS, ANIMATED_PROPS } from './map';
import { PLAYER_SPAWN, PLAYER_ANIMATIONS, type PlayerState } from './player';
import { BOSS_IDS, MINIBOSS_IDS, MINION_IDS, ENEMY_DEFS, type EnemyId } from './enemyCatalog';

// Shared simulation limits. difficulty.ts owns mode/wave tuning; bossAttacks.ts
// owns authored attack windows. Worklets capture pure values, never JS globals.
export const SURVIVAL_CONFIG = {
  startingHp: 5, maxHp: 10, invulnerableMs: 1100,
  intermissionMs: 3000, maxEnemies: 60, maxProjectiles: 96, maxOrbs: 64, maxChests: 6,
  projectileSpeed: 128, projectileLifetimeMs: 5500,
  orbLifetimeMs: 45000, pickupRadius: 68, chestRadius: 36,
  miniHp: 8, bossHp: 18, introMs: 1100, warningMs: 650,
  maxMinibosses: 18, summonIntervalMs: 12000, chestOpeningMs: 900, chestRewardMs: 1800,
};
export type CommonKind = 'ghoul' | 'spitter' | 'summoner';
type CommonNpc = Npc & { kind?: CommonKind };
export type BossState = {
  id: EnemyId; name: string; x: number; y: number; facingX: number;
  hp: number; maxHp: number; phase: 'intro' | 'warning' | 'attack' | 'recover' | 'death';
  phaseMs: number; pattern: number; animationMs: number; lastHitSerial: number; aimAngle: number;
  hitFlashMs?: number; hitSerial?: number; powerPhase?: number; damage?: number; hitCueAtMs?: number; teleportCooldownMs?: number; shockSummonCooldownMs?: number;
  cloneOf?:number;cloneMs?:number;dustCritical?:boolean;
  targetX?: number; targetY?: number; startX?: number; startY?: number; moveDone?: boolean; comboLeft?: number;
  groupId?:number;packRemaining?: number; packMs?: number; packWaitMs?: number; packMember?: boolean; corpseHidden?: boolean;
  sweepX?: number; sweepStartX?: number; sweepY?: number; sweepPlanMs?: number; sweepStageMs?: number; siblingRage?: boolean;
  origin?: 'scheduled' | 'ship' | 'purgatorio'; attackRootX?: number; entityId?: number; summonMs?: number; attackIndex?: number; attackRate?: number; summonDone?: boolean;
};
export type Projectile = { id: number; x: number; y: number; vx: number; vy: number; lifeMs: number };
export type Orb = { id: number; x: number; y: number; value: number; lifeMs: number };
export type Chest = { id: number; x: number; y: number; charges?: number; upgradeCharges?: number;
  kind?: 'upgrade' | 'supply'; phase?: 'closed' | 'opening' | 'reward'; phaseMs?: number;
  rewardId?: string; rewardName?: string; rewardEffect?: string; rewardText?: string; rewardGranted?: boolean }; 
export type UpgradeId = 'speed' | 'dash' | 'reach' | 'magnet' | 'vitality' | 'rhythm';
export const UPGRADE_INFO = {
  speed: { name: 'Paso ligero', description: 'Velocidad +8 por ciento', cap: 5 },
  dash: { name: 'Dash calibrado', description: 'Espera del dash -8 por ciento', cap: 5 },
  reach: { name: 'Filo amplio', description: 'Alcance +10 por ciento', cap: 4 },
  magnet: { name: 'Imán de suministros', description: 'Radio +22 por ciento', cap: 5 },
  vitality: { name: 'Vitalidad', description: '+1 de vida máxima y recupera 1', cap: 5 },
  rhythm: { name: 'Ritmo de acero', description: 'Ataques 8 por ciento más rápidos', cap: 5 },
};
export const CHEST_INFO = {
  heal: { name: 'Recuperar vida', description: 'Restaura hasta 2 de vida' },
  xp: { name: 'Reserva de EXP', description: 'Recibe 12 puntos de EXP' },
};
const BOSS_BLOCKERS = [...PROPS, ...ANIMATED_PROPS].filter(p => !p.groundDetail).map(p => p.destination);
const UPGRADE_IDS: UpgradeId[] = ['speed', 'dash', 'reach', 'magnet', 'vitality', 'rhythm'];
export type BossPresentationState = { entityId: number; elapsedMs: number; durationMs: number };
export const END_SEQUENCE = { deathDelayMs: 2000, victoryDelayMs: 3000 };
export type Ending = { kind: 'death' | 'victory'; elapsedMs: number; animationMs: number; ready: boolean };
export type SurvivalState = {
  tutorial?: TutorialState;
  rotations?:{mini:Rotation<EnemyId>;boss:Rotation<EnemyId>};
  droidGroup?:{id:number;rewarded:boolean;killed:number[];x:number;y:number};
  merchants?: MerchantSystem; armor?: number;
  missions?: MissionTelemetry; startingEquipment?: WorkshopId[]; stats: RunStats; ending?: Ending;
  frenesis: FrenesisState;
  purgatorio: PurgatorioState | null; world: WorldEvents; difficulty: Difficulty; presentation: BossPresentationState | null; bossActionUntilMs: number;
  partner: BossState | null; encounterName?: string; encounterMaxHp?: number;
  hazards: BossHazard[]; stunMs: number; poisonMs: number; poisonTickMs: number; phaseFlashMs: number; npcBoostMs: number;
  combatView?: { left: number; right: number; top: number; bottom: number };
  encounter: Encounter; boss: BossState | null; minibosses: BossState[]; projectiles: Projectile[]; orbs: Orb[]; chests: Chest[];
  hp: number; maxHp: number; level: number; xp: number; xpNeeded: number;
  upgrades: Record<UpgradeId, number>; mode: 'playing' | 'upgrade' | 'chest' | 'merchant' | 'dead' | 'won';
  choices: string[]; chestChoices: string[];
  events: ActionSoundEvents & { electricCharge?:number;electricImpact?:number;eventStart?: number; eventComplete?: number; eventCue?: number; dash: number; attack: number; damage: number; kill: number; pickup: number; level: number; chest: number; wave: number; boss: number; bossAttack: number; bossIntro: number; bossHit: number; bossPhase: number; bossBeep: number; shipAlarm: number; zoneReward: number; death: number };
  clockMs: number; invulnerableMs: number; pendingBoss: boolean; pendingChests: number; pendingUpgrades: number; upgradeOfferId: number;
  lastMinibossId: EnemyId | null; lastBossId: EnemyId | null; lastMinionId: EnemyId | null;
  nextPickupId: number; lastAttackSerial: number; lastDashCooldown: number; rewardX: number; rewardY: number;
};
export function xpRequirement(level: number): number {
  'worklet';
  const n = Math.max(0, level - 1);
  return 40 + n * 20 + n * n * 5;
}
export function createSurvival(seed = 0x64797374, difficulty: Difficulty = 'easy', selection: RunSelection = { mode: 'survival' }, equipment: readonly WorkshopId[] = []): SurvivalState {
  'worklet';
  const startingEquipment = normalizeEquipment(equipment), initial = workshopBonuses(startingEquipment, difficulty);
  return { rotations:{mini:createRotation<EnemyId>(seed^0x4d494e49),boss:createRotation<EnemyId>(seed^0x424f5353)},missions: createMissionTelemetry(), startingEquipment, stats: createRunStats(), frenesis: { ...createFrenesis(), charge: initial.charge }, purgatorio: createPurgatorio(selection, seed), world: createWorldEvents(seed), difficulty, presentation: null, bossActionUntilMs: 0, encounter: createEncounter(seed), boss: null, partner: null, hazards: [], stunMs: 0, poisonMs: 0, poisonTickMs: 0, phaseFlashMs: 0, npcBoostMs: 0, minibosses: [], projectiles: [], orbs: [], chests: [],
    hp: DIFFICULTIES[difficulty].hp + initial.health, maxHp: DIFFICULTIES[difficulty].hp + initial.health, level: 1, xp: 0, xpNeeded: xpRequirement(1),
    upgrades: { speed: 0, dash: 0, reach: 0, magnet: 0, vitality: 0, rhythm: 0 },
    mode: 'playing', choices: [], chestChoices: [], clockMs: 0, invulnerableMs: 0,
    pendingBoss: false, pendingChests: 0, pendingUpgrades: 0, upgradeOfferId: 0, lastMinibossId: null, lastBossId: null, lastMinionId: null, nextPickupId: 1, lastAttackSerial: 0, lastDashCooldown: 0,
    rewardX: PLAYER_SPAWN.x, rewardY: PLAYER_SPAWN.y,
    events: { authoredAudio:true,bossAttackSound:0,soundSerial:0,electricCharge:0,electricImpact:0,dash: 0, attack: 0, damage: 0, kill: 0, pickup: 0, level: 0, chest: 0, wave: 0, boss: 0, bossAttack: 0, bossIntro: 0, bossHit: 0, bossPhase: 0, bossBeep: 0, shipAlarm: 0, zoneReward: 0, death: 0 } };
}
export function wavePlan(wave: number, difficulty: Difficulty = 'easy') {
  'worklet';
  const plan = difficultyTuning(wave, difficulty), step = (Math.max(1, wave) - 1) % 10 + 1;
  return { ...plan, boss: step === 5 ? 'mini' as const : step === 10 ? 'boss' as const : null };
}
export function applyPlayerUpgrades(player: PlayerState, state: SurvivalState): PlayerState {
  'worklet';
  const initial = workshopBonuses(state.startingEquipment ?? [], state.difficulty);
  const active = state.frenesis?.active ?? false;
  const base = player.frenesis && !active ? stopFrenesisSpin(player) : active && !player.frenesis && player.action === 'attack' ? { ...player, action: 'idle' as const, actionMs: 0 } : player;
  return { ...base, frenesis: active, spinStrike: active ? base.spinStrike : false, attackHeld: active ? base.attackHeld : false,
    spinCooldownMs: active ? base.spinCooldownMs : 0,
    frenesisBlink: active && Boolean(state.frenesis.teleport),
    stunMs: state.stunMs, speedMultiplier: (1 + state.upgrades.speed * UPGRADE_EFFECTS.speed + initial.speed) * (active ? FRENESIS.moveMultiplier : 1),
    dashCooldownMultiplier: 1 - state.upgrades.dash * UPGRADE_EFFECTS.dash,
    attackSpeedMultiplier: (1 + state.upgrades.rhythm * UPGRADE_EFFECTS.rhythm + initial.attack) * (active ? FRENESIS.attackMultiplier : 1),
    strikeMultiplier: 1 + state.upgrades.reach * UPGRADE_EFFECTS.reach };
}
export function activateFrenesis(state: SurvivalState): SurvivalState {
  'worklet';
  const f = startFrenesis(state.frenesis, state.mode === 'playing' && !state.presentation && (!state.purgatorio || state.purgatorio.phase === 'combat'));
  return f === state.frenesis ? state : { ...state, frenesis: f, missions: { ...(state.missions ?? createMissionTelemetry()), activations: (state.missions?.activations ?? 0) + 1 } };
}
export function upgradeOptions(state: SurvivalState): UpgradeId[] {
  'worklet';
  const available = UPGRADE_IDS.filter(id => state.upgrades[id] < UPGRADE_INFO[id].cap && (id !== 'vitality' || state.maxHp < DIFFICULTIES[state.difficulty].maxHp));
  // Rotate deterministically by level/seed; no duplicate choices, no RNG shared
  // with React, and every available upgrade eventually appears.
  if (!available.length) return [];
  const start = (state.level + (state.encounter.randomSeed >>> 8)) % available.length;
  return Array.from({ length: Math.min(3, available.length) }, (_, i) => available[(start + i) % available.length]);
}
export function chestOptions(): string[] {
  'worklet';
  return ['heal', 'xp'];
}
function enqueueChest(state: SurvivalState, x: number, y: number, kind: 'upgrade' | 'supply' = 'supply'): void {
  'worklet';
  if (state.chests.length < SURVIVAL_CONFIG.maxChests) state.chests.push({ id: state.nextPickupId++, x, y,
    charges: 1, upgradeCharges: kind === 'upgrade' ? 1 : 0, kind, phase: 'closed', phaseMs: 0 });
  else {
    // Bounded pool, lossless rewards: overflow becomes another opening of the
    // same chest. Upgrade and supply charges remain independently accounted.
    const index = state.chests.findIndex(c => c.phase !== 'reward');
    const slot = Math.max(0, index), first = state.chests[slot];
    state.chests[slot] = { ...first, charges: (first.charges ?? 1) + 1,
      upgradeCharges: (first.upgradeCharges ?? (first.kind === 'upgrade' ? 1 : 0)) + (kind === 'upgrade' ? 1 : 0) };
  }
}
function resolveProgress(state: SurvivalState): SurvivalState {
  'worklet';
  if (state.mode === 'dead' || state.mode === 'won') return state;
  while (state.xp >= state.xpNeeded) {
    state.xp -= state.xpNeeded; state.level++; state.xpNeeded = xpRequirement(state.level);
    state.events.level++;
    if (state.level % 3 === 0) { state.pendingChests++; state.pendingUpgrades++; }
  }
  while (state.pendingChests > 0) {
    if(state.chests.length>=SURVIVAL_CONFIG.maxChests)break;
    const player={x:state.rewardX,y:state.rewardY};
    const view=state.combatView??{left:player.x-250,right:player.x+250,top:player.y-150,bottom:player.y+150};
    // A just-offered magnet upgrade can enlarge pickup before the scene resumes.
    const magnet=Math.min(UPGRADE_INFO.magnet.cap,state.upgrades.magnet+1);
    const radius=SURVIVAL_CONFIG.chestRadius*(1+magnet*UPGRADE_EFFECTS.magnet);
    const zones=[...(state.world.zone?[state.world.zone]:[]),...(state.world.optional.active?.points??[]).filter(p=>!p.complete).map(p=>({...p,radius:OPTIONAL_EVENT_CONFIG.zoneRadius}))];
    const position=milestoneChestPosition(player,radius,view,BOSS_BLOCKERS,state.chests,zones);
    if(!position)break; // Keep the reward queued; never fall back to the player's feet.
    enqueueChest(state, position.x, position.y, 'upgrade'); state.pendingChests--;
  }
  state.chestChoices = [];
  // Every third level offers one choice in addition to its automatic physical
  // chest. Queue all crossed milestones before presenting the first offer.
  const options = state.pendingUpgrades > 0 ? upgradeOptions(state) : [];
  if (options.length) {
    if (state.mode !== 'upgrade') state.upgradeOfferId++;
    state.mode = 'upgrade'; state.choices = options;
  } else {
    state.mode = 'playing'; state.choices = [];
    // Every upgrade has a finite cap. When all caps are reached there is no
    // valid choice; chests still award their documented fallback recovery.
    state.pendingUpgrades = 0;
  }
  return state;
}
export function applyUpgrade(state: SurvivalState, id: UpgradeId): void {
  'worklet';
  if (id === 'vitality' && state.difficulty === 'dystopia') return;
  state.upgrades[id]++;
  if (id === 'vitality') {
    state.maxHp = Math.min(DIFFICULTIES[state.difficulty].maxHp, state.maxHp + 1);
    state.hp = Math.min(state.maxHp, state.hp + 1);
  }
}
export function chooseUpgrade(current: SurvivalState, id: string, offerId = current.upgradeOfferId): SurvivalState {
  'worklet';
  if (current.mode !== 'upgrade' || current.pendingUpgrades <= 0 || offerId !== current.upgradeOfferId || !current.choices.includes(id)) return current;
  const selected = id as UpgradeId;
  if (current.upgrades[selected] >= UPGRADE_INFO[selected].cap || (selected === 'vitality' && current.maxHp >= DIFFICULTIES[current.difficulty].maxHp)) return current;
  const state = { ...current, upgrades: { ...current.upgrades }, events: { ...current.events }, chests: [...current.chests],
    pendingUpgrades: current.pendingUpgrades - 1, mode: 'playing' as SurvivalState['mode'], choices: [] };
  applyUpgrade(state, selected);
  return resolveProgress(state);
}
export function chooseChest(current: SurvivalState, _id: string): SurvivalState {
  'worklet';
  return current;
}
function advanceChests(state: SurvivalState, player: PlayerState, dt: number): void {
  'worklet';
  const chests: Chest[] = [];
  for (const source of state.chests) {
    let chest = { ...source, phase: source.phase ?? 'closed', phaseMs: (source.phaseMs ?? 0) + dt } as Chest;
    if (chest.phase === 'closed') {
      if (Math.hypot(chest.x - player.x, chest.y - player.y) < SURVIVAL_CONFIG.chestRadius * (1 + state.upgrades.magnet * UPGRADE_EFFECTS.magnet)) {
        chest = { ...chest, phase: 'opening', phaseMs: 0, rewardGranted: false, rewardText: '' };
        state.events.chest++;
      }
    } else if (chest.phase === 'opening' && chest.phaseMs! >= SURVIVAL_CONFIG.chestOpeningMs && !chest.rewardGranted) {
      const upgrades = chest.upgradeCharges ?? (chest.kind === 'upgrade' ? 1 : 0);
      let text = '',rewardId='heal',rewardName='Vitalidad',rewardEffect='';
      if (upgrades > 0) {
        const options = upgradeOptions(state);
        if (options.length) {
          const id = options[(chest.id + state.level) % options.length];
          applyUpgrade(state, id);
          text = UPGRADE_INFO[id].name;rewardId=id;rewardName=text;rewardEffect=UPGRADE_INFO[id].description;
        } else if(state.hp<state.maxHp) { const healed=Math.min(2,state.maxHp-state.hp);state.hp+=healed;text='Vida +'+healed;rewardEffect='+'+healed+' de vida'; } else {state.xp+=16;text='EXP +16';rewardId='xp';rewardName='Experiencia';rewardEffect='+16 EXP';}
      } else if (state.hp < state.maxHp) { const healed = Math.min(2, state.maxHp - state.hp); state.hp += healed; text = 'Vida +' + healed;rewardEffect='+'+healed+' de vida'; }
      else { state.xp += 16; text = 'EXP +16';rewardId='xp';rewardName='Experiencia';rewardEffect='+16 EXP'; }
      chest = { ...chest, phase: 'reward', phaseMs: 0, rewardGranted: true, rewardText: text, rewardId,rewardName,rewardEffect,
        charges: (chest.charges ?? 1) - 1, upgradeCharges: Math.max(0, upgrades - 1) };
    } else if (chest.phase === 'reward' && chest.phaseMs! >= SURVIVAL_CONFIG.chestRewardMs) {
      if ((chest.charges ?? 0) <= 0) continue;
      chest = { ...chest, phase: 'closed', phaseMs: 0, rewardGranted: false, rewardText: '', kind: (chest.upgradeCharges ?? 0) > 0 ? 'upgrade' : 'supply' };
    }
    chests.push(chest);
  }
  state.chests = chests;
}
function dropOrb(state: SurvivalState, x: number, y: number, value: number): void {
  'worklet';
  if (state.tutorial) return;
  if (state.orbs.length < SURVIVAL_CONFIG.maxOrbs) state.orbs.push({ id: state.nextPickupId++, x, y, value, lifeMs: SURVIVAL_CONFIG.orbLifetimeMs });
  else {
    const last = state.orbs[state.orbs.length - 1];
    state.orbs[state.orbs.length - 1] = { ...last, value: last.value + value, lifeMs: SURVIVAL_CONFIG.orbLifetimeMs };
  }
}
function nearbyPosition(state: SurvivalState, center: { x: number; y: number }, player: PlayerState, field: FlowField, minRadius = 75, maxRadius = 210, safeDistance = 95): { x: number; y: number } | null {
  'worklet';
  for (let i = 0; i < 48; i++) {
    const angle = worldRandom(state.world) * Math.PI * 2, r = minRadius + worldRandom(state.world) * (maxRadius - minRadius);
    const p = { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r };
    if (!spawnIsClear(p, player, state.encounter.enemies, field, { ...WAVE_CONFIG, spawnMinDistance: safeDistance, spawnMaxDistance: 5000 })) continue;
    if (BOSS_BLOCKERS.some(b => p.x - 22 < b.x + b.width && p.x + 22 > b.x && p.y - 65 < b.y + b.height && p.y + 8 > b.y)) continue;
    if ([...(state.boss ? [state.boss] : []), ...(state.partner ? [state.partner] : []), ...state.minibosses].some(b => b.hp > 0 && Math.hypot(p.x - b.x, p.y - b.y) < 70)) continue;
    return p;
  }
  return null;
}

function findSpawn(state: SurvivalState, player: PlayerState, field: FlowField, boss = false): { x: number; y: number } | null {
  'worklet';
  for (let i = 0; i < 36; i++) {
    state.encounter.randomSeed = (Math.imul(state.encounter.randomSeed, 1664525) + 1013904223) >>> 0;
    const angle = state.encounter.randomSeed / 4294967296 * Math.PI * 2;
    state.encounter.randomSeed = (Math.imul(state.encounter.randomSeed, 1664525) + 1013904223) >>> 0;
    const radius = WAVE_CONFIG.spawnMinDistance + state.encounter.randomSeed / 4294967296 * (WAVE_CONFIG.spawnMaxDistance - WAVE_CONFIG.spawnMinDistance);
    const position = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius };
    if (!spawnIsClear(position, player, state.encounter.enemies, field)) continue;
    if (state.boss && Math.hypot(position.x - state.boss.x, position.y - state.boss.y) < 140) continue;
    if (state.partner && Math.hypot(position.x - state.partner.x, position.y - state.partner.y) < 140) continue;
    if (state.minibosses.some(m => Math.hypot(position.x - m.x, position.y - m.y) < 110)) continue;
    if (boss && BOSS_BLOCKERS.some(b => position.x - 70 < b.x + b.width + 5 && position.x + 70 > b.x - 5 && position.y - 120 < b.y + b.height + 5 && position.y + 10 > b.y - 5)) continue;
    return position;
  }
  return null;
}
function countSpinKill(state: SurvivalState, player: PlayerState): void {
  'worklet';
  if(!player.frenesis||player.frenesisAttack!=='slices'||!player.spinStrike)return;
  const t=state.missions!;
  t.spinKills=t.spinSerial===player.attackSerial?t.spinKills+1:1;t.spinSerial=player.attackSerial;t.bestSpin=Math.max(t.bestSpin,t.spinKills);
}
function hurtPlayer(state: SurvivalState, amount = 1): boolean {
  'worklet';
  if (state.invulnerableMs > 0 || state.mode !== 'playing') return false;
  if (state.frenesis?.active && state.frenesis.teleport) return false;
  state.missions ??= createMissionTelemetry();
  state.missions.damage++; state.missions.streak = 0;
  if (state.frenesis?.active) {
    const hp = Math.max(0, state.frenesis.hp - amount);
    state.frenesis = hp > 0 ? { ...state.frenesis, hp } : endFrenesis(state.frenesis);
    state.events.damage++; state.invulnerableMs = SURVIVAL_CONFIG.invulnerableMs;
    return true;
  }
  const absorbed=Math.min(state.armor??0,amount);
  state.armor=Math.max(0,(state.armor??0)-absorbed);
  state.hp = Math.max(state.tutorial ? 1 : 0, state.hp - (amount-absorbed)); state.events.damage++;
  state.invulnerableMs = SURVIVAL_CONFIG.invulnerableMs;
  if (state.hp === 0) { state.droidGroup=undefined;state.frenesis = endFrenesis(state.frenesis); state.mode = 'dead'; state.ending = { kind: 'death', elapsedMs: 0, animationMs: PLAYER_ANIMATIONS.death.frames * 1000 / PLAYER_ANIMATIONS.death.fps, ready: false }; state.presentation = null; state.projectiles = []; state.minibosses=state.minibosses.filter(m=>!m.cloneOf); state.events.death++; state.stunMs = 0; state.poisonMs = 0; state.hazards = []; if(state.world.optional){state.world.optional=clearOptionalEvents(state.world.optional);state.encounter.enemies=state.encounter.enemies.map(n=>n.eventOwner?emptyNpc():n);} }
  return true;
}
function applyCapturePenalty(state: SurvivalState): void {
  'worklet';
  const penalty = state.world.pendingCaptureDamage;
  if (penalty && hurtPlayer(state, penalty.amount)) {
    state.world.pendingCaptureDamage = null;
    state.world.damageNotice = { amount: penalty.amount, elapsedMs: 0 };
  }
}
function moveEnemy(npc: CommonNpc, player: PlayerState, nearby: Record<string, Npc[]>, field: FlowField, dt: number, clock: number, speedMultiplier: number): CommonNpc {
  'worklet';
  const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
  if (distance <= 20) return { ...npc, action: 'idle', actionMs: npc.action === 'idle' ? npc.actionMs + dt : 0 };
  const direction = navigationDirection(npc, player, field);
  const kind = npc.kind ?? 'ghoul';
  let x = direction.x, y = direction.y;
  // The three common species remain melee-only. Their movement silhouette is
  // readable: steady pursuit, a shallow lateral weave, and deliberate bursts.
  if (kind === 'spitter' && distance < 210) {
    const weave = Math.sin(clock / 650 + npc.id) * 0.42;
    x += -direction.y * weave; y += direction.x * weave;
  }
  const cellX = Math.floor(npc.x / 32), cellY = Math.floor(npc.y / 32);
  for (let cy = cellY - 1; cy <= cellY + 1; cy++) for (let cx = cellX - 1; cx <= cellX + 1; cx++) for (const other of nearby[cx + ":" + cy] ?? []) {
    if (!other.active || other.id === npc.id || other.action === 'death') continue;
    const dx = npc.x - other.x, dy = npc.y - other.y, length = Math.hypot(dx, dy);
    if (length > 0.001 && length < 25) { const push = (1 - length / 25) * 0.65; x += dx / length * push; y += dy / length * push; }
  }
  const speed = kind === 'spitter' ? 74 : kind === 'summoner' ? (clock % 1500 < 1000 ? 48 : 12) : 60;
  const step = Math.min(speed * speedMultiplier * dt / 1000, distance - 20), length = Math.hypot(x, y);
  let position = length > 0 ? moveWithCollisions(npc, x / length * step, y / length * step) : npc;
  if (Math.hypot(position.x - npc.x, position.y - npc.y) < step * 0.25) position = moveWithCollisions(npc, direction.x * step, direction.y * step);
  const moving = Math.hypot(position.x - npc.x, position.y - npc.y) > 0.001;
  return { ...npc, ...position, facingX: Math.abs(position.x - npc.x) > 0.01 ? Math.sign(position.x - npc.x) : npc.facingX,
    action: moving ? 'move' : 'idle', actionMs: (moving && npc.action === 'move' || !moving && npc.action === 'idle') ? npc.actionMs + dt : 0 };
}
/** One bag per category, shared by scheduled waves and derelict ships. */
export function selectEnemy(state:SurvivalState,tier:'mini'|'boss'|'minion',consume=true):EnemyId {
  'worklet';
  if(tier==='minion'){
    const pool=MINION_IDS.filter(id=>id!==state.lastMinionId);state.encounter.randomSeed=(Math.imul(state.encounter.randomSeed,1664525)+1013904223)>>>0;
    const id=pool[Math.floor(state.encounter.randomSeed/4294967296*pool.length)];state.lastMinionId=id;return id;
  }
  // The Bandits are one encounter; their legacy second ID must not double its probability.
  const pool=tier==='mini'?MINIBOSS_IDS:BOSS_IDS.filter(id=>id!=='archer-bandit');
  const rotations=state.rotations??{mini:createRotation<EnemyId>(state.encounter.randomSeed^0x4d494e49),boss:createRotation<EnemyId>(state.encounter.randomSeed^0x424f5353)};
  const next=peekRotation<EnemyId>(rotations[tier],pool),id=next.id!;
  state.rotations={...rotations,[tier]:consume?consumeRotation(next.rotation,id):next.rotation};
  if(consume){if(tier==='mini')state.lastMinibossId=id;else state.lastBossId=id;}
  return id;
}
function commitSpecialRotation(state:SurvivalState,id:EnemyId):void {
  'worklet';const tier=ENEMY_DEFS[id].tier;if(tier==='minion')return;
  const key=tier==='mini'?'mini':'boss';if(!state.rotations)return;
  state.rotations={...state.rotations,[key]:consumeRotation(state.rotations[key],id)};
  if(key==='mini')state.lastMinibossId=id;else state.lastBossId=id;
}
function missionCandidate(state:SurvivalState):MissionKind {
  'worklet';const next=peekRotation(state.world.missionRotation??createRotation<MissionKind>(state.world.randomSeed^0x45564e54),MISSION_EVENT_KINDS);
  state.world.missionRotation=next.rotation;return next.id!;
}
function missionStarted(state:SurvivalState,kind:MissionKind):void {
  'worklet';if(state.world.missionRotation)state.world.missionRotation=consumeRotation(state.world.missionRotation,kind);
}
function announceOptional(state:SurvivalState,event:OptionalEvent):void {
  'worklet';missionStarted(state,event.kind);state.world.optional.lastKind=event.kind;state.world.lastEventStartMs=state.clockMs;
  state.events.eventStart=(state.events.eventStart??0)+1;state.events.eventCue=event.kind==='elite'?0:event.kind==='nest'?1:2;
}
function makeBoss(state: SurvivalState, id: EnemyId, position: { x: number; y: number }, player: PlayerState): BossState {
  'worklet';
  const spec = ENEMY_DEFS[id];
  const growth = state.purgatorio ? purgatorioTuning(state.purgatorio.number, state.difficulty).hpMultiplier : 1 + Math.min(0.6, Math.floor((state.encounter.wave - 1) / 10) * 0.08);
  const scaledHp = spec.tier === 'minion' ? 1 : id === 'bomb-droid' ? spec.hp : Math.ceil(spec.hp * bossMode(state.difficulty).hp * growth);
  const hp = scaledHp * (id === 'rock-boss' ? BOSS_BALANCE.rockHealthMultiplier : id === 'skeleton-summoner' ? BOSS_BALANCE.summonerHealthMultiplier : 1);
  return { ...position, id, name: spec.name, entityId: state.nextPickupId++,
    facingX: player.x < position.x ? -1 : 1, hp, maxHp: hp,
    phase: 'intro', phaseMs: 0, animationMs: 0, pattern: 0, powerPhase: 0, damage: 1, teleportCooldownMs: BOSS_BALANCE.teleportCooldownMs, lastHitSerial: -1, aimAngle: 0, attackRootX: 0 };
}
function commonNpcLimit(state: SurvivalState): number {
  'worklet';
  const shock = state.boss?.id === 'shock-sweeper' && state.boss.hp > 0 && state.boss.phase !== 'death'
    || state.partner?.id === 'shock-sweeper' && state.partner.hp > 0 && state.partner.phase !== 'death'
    || state.minibosses.some(b => b.id === 'shock-sweeper' && b.hp > 0 && b.phase !== 'death');
  return shock ? BOSS_BALANCE.shockNpcLimit : SURVIVAL_CONFIG.maxEnemies;
}
function spawnCommon(state: SurvivalState, player: PlayerState, field: FlowField, requestedPosition?: { x: number; y: number } | null): boolean {
  'worklet';
  // All common sources share the encounter cap: waves, support pressure and slam bursts.
  if (state.encounter.enemies.filter(n => n.active && n.action !== 'death').length >= commonNpcLimit(state)) return false;
  // Worklet closure bindings are installed inside the body, after parameters.
  // Preserve explicit null (failed spawn) and consume RNG only when omitted.
  const position = requestedPosition === undefined ? findSpawn(state, player, field) : requestedPosition;
  const encounter = state.encounter, slot = encounter.enemies.findIndex(n => !n.active);
  if (!position || slot < 0 || (state.boss && Math.hypot(position.x - state.boss.x, position.y - state.boss.y) < 70)) return false;
  const kinds: CommonKind[] = ['ghoul', 'spitter', 'summoner'];
  const kind = kinds[(encounter.nextId + encounter.wave - 2 + kinds.length) % kinds.length];
  encounter.enemies[slot] = { ...emptyNpc(), ...position, id: encounter.nextId++, kind, active: true, action: 'spawn', facingX: player.x < position.x ? -1 : 1 } as CommonNpc;
  const event=state.world.optional?.active;
  if(event?.kind==='elite'&&event.phase==='active'&&event.wave===encounter.wave){
    const total=wavePlan(encounter.wave,state.difficulty).count,ordinal=total-encounter.remaining;
    if(Math.floor((ordinal+1)*event.eliteQuota/total)>Math.floor(ordinal*event.eliteQuota/total)&&event.eliteSpawned<event.eliteQuota){
      const balance=optionalTuning(encounter.wave,state.difficulty);
      encounter.enemies[slot]={...encounter.enemies[slot],eventOwner:event.id,eliteEventId:event.id,hp:balance.eliteHp,maxHp:balance.eliteHp,eliteSpeed:balance.eliteSpeed};
      event.eliteSpawned++;
    }
  }
  return true;
}
export function spawnTutorialEnemy(state:SurvivalState,player:PlayerState,field:FlowField,position:{x:number;y:number}):boolean {
  'worklet';return !!state.tutorial && spawnCommon(state,player,field,position);
}
function spawnBossSupport(state: SurvivalState, owner: BossState, player: PlayerState, field: FlowField): boolean {
  'worklet';
  // Only normal NPCs may reinforce an occupied special slot. Skeletons retain
  // their original one-hit art/animations, while other bosses use the common pool.
  if (owner.id !== 'skeleton-summoner') {
    if (state.encounter.enemies.filter(n => n.active && n.action !== 'death').length >= WORLD_EVENT_CONFIG.pressureLimit[state.difficulty]) return false;
    return spawnCommon(state, player, field);
  }
  const limit = bossMode(state.difficulty).skeletonLimit;
  let count = state.minibosses.filter(b => ENEMY_DEFS[b.id].tier === 'minion' && b.phase !== 'death').length;
  let spawned = 0;
  for (let i = 0; i < bossMode(state.difficulty).skeletonGroup && count < limit && state.minibosses.length < BOSS_BALANCE.maxSupports; i++) {
    const position = nearbyPosition(state, owner, player, field, 85, 240, 100);
    if (!position) continue;
    state.minibosses.push(makeBoss(state, selectEnemy(state, 'minion'), position, player)); count++; spawned++;
  }
  return spawned > 0;
}
function beginSpecial(state: SurvivalState, id: EnemyId, position: { x: number; y: number }, player: PlayerState, origin: 'scheduled' | 'ship' | 'purgatorio', field: FlowField): boolean {
  'worklet';
  if (ENEMY_DEFS[id].tier === 'minion' || !canStartSpecial(state, origin)) return false;
  state.boss = { ...makeBoss(state, id, position, player), origin };
  if(state.world.optional){state.world.optional.notice=null;state.world.optional.visibility=0;}
  state.partner = null; state.encounterName = undefined; state.encounterMaxHp = undefined;
  if (id === 'dagger-bandit' || id === 'archer-bandit') {
    const other = id === 'dagger-bandit' ? 'archer-bandit' : 'dagger-bandit';
    const spot = nearbyPosition(state, position, player, field, 150, 260);
    if (!spot) { state.boss = null; return false; }
    state.partner = { ...makeBoss(state, other, spot, player), origin };
    state.encounterName = BANDIT_ENCOUNTER_NAME; state.encounterMaxHp = state.boss.maxHp + state.partner.maxHp;
  }
  if (id === 'bomb-droid') { state.boss.groupId=state.boss.entityId;state.droidGroup={id:state.boss.entityId!,rewarded:false,killed:[],x:state.boss.x,y:state.boss.y};state.boss.packRemaining = bossMode(state.difficulty).droids - 1; state.boss.packMs = 0; state.encounterMaxHp = state.boss.maxHp * bossMode(state.difficulty).droids; }
  state.missions ??= createMissionTelemetry();
  state.missions.specialDamage = state.missions.damage;
  state.missions.specialBoss = ENEMY_DEFS[id].tier === 'boss'; state.missions.specialCounted = false;
  state.pendingBoss = false;
  state.world.reinforcementMs = WORLD_EVENT_CONFIG.pressureMs[state.difficulty];
  if (origin !== 'ship') {
    state.events.bossIntro++;
    state.presentation = { entityId: state.boss.entityId!, elapsedMs: 0, durationMs: WAVE_BALANCE.presentationMs };
  } else { state.events.boss++; state.world.ship = null; state.world.lastEventStartMs = state.clockMs; }
  if(origin!=='purgatorio')commitSpecialRotation(state,id);
  return true;
}
function chooseZoneReward(state: SurvivalState, sheet: string): ZoneReward {
  'worklet';
  const candidates: ZoneReward[] = [];
  if (sheet === 'medic' && state.maxHp < DIFFICULTIES[state.difficulty].maxHp && state.upgrades.vitality < UPGRADE_INFO.vitality.cap) candidates.push('vitality');
  if (state.upgrades.rhythm < UPGRADE_INFO.rhythm.cap) candidates.push('rhythm');
  if (state.upgrades.speed < UPGRADE_INFO.speed.cap) candidates.push('speed');
  return candidates.length ? candidates[Math.floor(worldRandom(state.world) * candidates.length)] : 'xp';
}

/** One scheduler owns the optional slot; legacy admission reads this same state. */
function finishOptionalEvent(state: SurvivalState, success: boolean, silent = false): void {
  'worklet';
  const o=state.world.optional,e=o.active;
  if(!e)return;
  o.active=null;
  state.world.missionCooldownUntilMs=state.clockMs+OPTIONAL_EVENT_CONFIG.cooldownMs;
  state.encounter.enemies=state.encounter.enemies.map(n=>n.eventOwner===e.id?emptyNpc():n);
  o.cooldownUntilMs=state.clockMs+OPTIONAL_EVENT_CONFIG.cooldownMs;
  o.nextOpportunityMs=state.clockMs+OPTIONAL_EVENT_CONFIG.opportunityMinMs+worldRandom(state.world)*(OPTIONAL_EVENT_CONFIG.opportunityMaxMs-OPTIONAL_EVENT_CONFIG.opportunityMinMs);
  o.nextCheckMs=o.nextOpportunityMs;
  state.world.lastEventStartMs=state.clockMs;
  o.notice=silent?null:{kind:e.kind,success,elapsedMs:0};
  if(success){
    state.stats.objectivesCompleted++;state.missions ??= createMissionTelemetry();
    if(e.kind==='nest')state.missions.nests++;else if(e.kind==='reactor')state.missions.reactors++;else state.missions.elites++;
    o.completed++;state.events.eventComplete=(state.events.eventComplete??0)+1;
    const reward=OPTIONAL_EVENT_CONFIG.rewards[e.kind];state.xp+=reward.xp;
    // Explicit event reward, separate from damage/XP charge accounting.
    if(state.frenesis.active)o.pendingCharge+=reward.frenesis;
    else state.frenesis={...state.frenesis,charge:Math.min(FRENESIS.capacity,state.frenesis.charge+reward.frenesis)};
  }else o.failed++;
}
function optionalSites(state: SurvivalState, player: PlayerState, field: FlowField, count: number) {
  'worklet';
  const candidates=REWARD_SITES.filter(p=>{
    const d=Math.hypot(p.x-player.x,p.y-player.y);
    return d>=OPTIONAL_EVENT_CONFIG.siteMinDistance&&d<=OPTIONAL_EVENT_CONFIG.siteMaxDistance&&isWalkable(p.x,p.y)&&isReachable(p,field);
  }).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  const selected:{x:number;y:number;progressMs:number;complete:boolean}[]=[];
  while(candidates.length&&selected.length<count){
    const index=Math.floor(worldRandom(state.world)*Math.min(4,candidates.length)),point=candidates.splice(index,1)[0];
    if(selected.every(p=>Math.hypot(point.x-p.x,point.y-p.y)>=OPTIONAL_EVENT_CONFIG.siteSeparation))selected.push({x:point.x,y:point.y,progressMs:0,complete:false});
  }
  return selected.length===count?selected:[];
}
function advanceOptionalEvents(state: SurvivalState, player: PlayerState, field: FlowField, dt: number): void {
  'worklet';
  if(state.purgatorio)return;
  const o=state.world.optional??(state.world.optional=createOptionalEvents(state.encounter.randomSeed));
  if(o.notice){o.notice={...o.notice,elapsedMs:o.notice.elapsedMs+dt};if(o.notice.elapsedMs>=3500)o.notice=null;}
  if(o.pendingCharge>0&&!state.frenesis.active){state.frenesis={...state.frenesis,charge:Math.min(FRENESIS.capacity,state.frenesis.charge+o.pendingCharge)};o.pendingCharge=0;}
  const event=o.active;
  const target=event?.kind==='reactor'&&event.phase==='active'?1-event.points.filter(p=>p.complete).length/3:0;
  o.visibility+=Math.sign(target-o.visibility)*Math.min(Math.abs(target-o.visibility),dt/OPTIONAL_EVENT_CONFIG.visionFadeMs);
  const wave=state.encounter.wave,phase=state.encounter.phase;
  if(event){
    // A scheduled boss has priority; cancellation never creates a deferred boss queue.
    if(state.pendingBoss||state.presentation||state.boss||state.partner||state.minibosses.length||wavePlan(wave,state.difficulty).boss){
      finishOptionalEvent(state,false,true);o.visibility=0;return;
    }
    event.elapsedMs+=dt;
    if(event.phase==='queued'){
      if(event.elapsedMs>=OPTIONAL_EVENT_CONFIG.queuedDeadlineMs){finishOptionalEvent(state,false);return;}
      if(phase==='intermission'){event.phase='warning';event.elapsedMs=0;announceOptional(state,event);}
      return;
    }
    if(event.phase==='warning'){
      if(event.elapsedMs<OPTIONAL_EVENT_CONFIG.warningMs)return;
      event.phase='active';event.elapsedMs=0;
    }
    if(event.kind==='elite'){
      if(wave>event.wave){finishOptionalEvent(state,false);return;}
      if(wave===event.wave&&state.encounter.remaining===0&&!state.encounter.enemies.some(n=>n.active&&n.action!=='death')){finishOptionalEvent(state,true);return;}
      if(event.elapsedMs>=OPTIONAL_EVENT_CONFIG.eliteDeadlineMs)finishOptionalEvent(state,false);
      return;
    }
    const required=event.kind==='nest'?OPTIONAL_EVENT_CONFIG.nestCaptureMs:OPTIONAL_EVENT_CONFIG.energyCaptureMs;
    event.points=event.points.map(p=>advanceEventPoint(p,player,dt,required));
    if(event.points.every(p=>p.complete)){finishOptionalEvent(state,true);return;}
    if(event.elapsedMs>=(event.kind==='nest'?OPTIONAL_EVENT_CONFIG.nestDeadlineMs:OPTIONAL_EVENT_CONFIG.reactorDeadlineMs)){finishOptionalEvent(state,false);return;}
    if(event.kind==='nest'){
      event.spawnMs=Math.max(0,event.spawnMs-dt);
      if(!event.spawnMs){
        const tuning=optionalTuning(wave,state.difficulty),center=event.points[0];
        let own=state.encounter.enemies.filter(n=>n.active&&n.action!=='death'&&n.eventOwner===event.id).length;
        for(let i=0;i<tuning.nestGroup&&own<tuning.nestLimit;i++){
          for(let attempt=0;attempt<12;attempt++){
            const angle=worldRandom(state.world)*Math.PI*2,radius=80+worldRandom(state.world)*90;
            const p={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
            if(!isReachable(p,field)||!spawnIsClear(p,player,state.encounter.enemies,field,{...WAVE_CONFIG,spawnMinDistance:100,spawnMaxDistance:5000}))continue;
            const id=state.encounter.nextId;
            if(spawnCommon(state,player,field,p)){const spawned=state.encounter.enemies.find(n=>n.id===id);if(spawned)spawned.eventOwner=event.id;own++;}
            break;
          }
        }
        event.spawnMs=tuning.nestIntervalMs;
      }
    }
    return;
  }
  // Timer comparisons are cheap. RNG, eligibility and site searches happen only
  // at an opportunity/retry or a wave boundary while an opportunity is due.
  const boundary=o.checkedWave!==wave||o.checkedPhase!==phase;o.checkedWave=wave;o.checkedPhase=phase;
  if(state.clockMs<o.nextOpportunityMs||state.clockMs<o.cooldownUntilMs||state.clockMs<o.nextCheckMs&&!boundary)return;
  o.nextCheckMs=state.clockMs+OPTIONAL_EVENT_CONFIG.retryMinMs+worldRandom(state.world)*(OPTIONAL_EVENT_CONFIG.retryMaxMs-OPTIONAL_EVENT_CONFIG.retryMinMs);
  if(!canStartOptional(state)||wave<2||!OPTIONAL_EVENT_CONFIG.startSteps.includes((wave-1)%10+1)||wavePlan(wave,state.difficulty).boss||phase==='intermission'&&wavePlan(wave+1,state.difficulty).boss)return;
  const kind=missionCandidate(state);if(kind==='capture')return;
  if(kind==='elite'&&wavePlan(wave+1,state.difficulty).boss)return;
  const points=kind==='elite'?[]:optionalSites(state,player,field,kind==='nest'?1:3);
  if(kind!=='elite'&&!points.length)return;
  const targetWave=kind==='elite'?wave+1:wave;
  const e:OptionalEvent={id:o.nextId++,kind,phase:kind==='elite'&&phase!=='intermission'?'queued':'warning',elapsedMs:0,wave:targetWave,points,
    spawnMs:1000,eliteQuota:Math.ceil(wavePlan(targetWave,state.difficulty).count*optionalTuning(targetWave,state.difficulty).eliteFraction),eliteSpawned:0};
  o.active=e;o.notice=null;if(e.phase==='warning')announceOptional(state,e);
}

function advanceWorldEvents(state: SurvivalState, player: PlayerState, field: FlowField, dt: number): void {
  'worklet';
  const world = state.world, wave = state.encounter.wave;
  if (world.notice) { world.notice = { ...world.notice, elapsedMs: world.notice.elapsedMs + dt }; if (world.notice.elapsedMs >= WORLD_EVENT_CONFIG.noticeMs) world.notice = null; }
  if (!world.zone && wave > 0 && canRunWorldEvent(state, 'capture', wave, state.clockMs) && (wave >= world.nextRewardWave || state.clockMs >= world.nextRewardAtMs) && missionCandidate(state)==='capture') {
    const candidates = REWARD_SITES.filter(s => s.id !== world.lastRewardSite).slice().sort((a,b) => Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,4);
    const site = candidates[Math.floor(worldRandom(world) * candidates.length)];
    if (site) {
      world.zone = { id: state.nextPickupId++, siteId: site.id, x: site.x, y: site.y, radius: site.radius, reward: chooseZoneReward(state, site.sheet), elapsedMs: 0, inside: false,
        requiredMs: WORLD_EVENT_CONFIG.rewardDurationMs, deadlineElapsedMs: 0, penaltyMs: 0, started: false };missionStarted(state,'capture');
      world.lastRewardSite = site.id;
      world.lastEventStartMs = state.clockMs;
    }
  }
  if (world.zone) {
    let zone = { ...world.zone };
    // If another legitimate upgrade reached its cap, advertise EXP instead of
    // silently promising an impossible bonus. Preserve all accumulated time.
    if (zone.reward !== 'xp' && (state.upgrades[zone.reward] >= UPGRADE_INFO[zone.reward].cap || (zone.reward === 'vitality' && state.maxHp >= DIFFICULTIES[state.difficulty].maxHp))) zone.reward = 'xp';
    const result = advanceCapture(zone, Math.hypot(zone.x-player.x,zone.y-player.y) <= zone.radius, dt);
    zone = result.zone;
    world.zone = zone;
    if (result.complete) {
      if (zone.reward === 'xp') state.xp += WORLD_EVENT_CONFIG.rewardXp;
      else applyUpgrade(state, zone.reward);
      state.events.zoneReward++; state.stats.objectivesCompleted++;
      state.missions!.captures++; if(!zone.leftZone)state.missions!.perfectCaptures++;
      world.notice = { x: zone.x, y: zone.y, text: zone.reward === 'xp' ? 'EXP +32' : UPGRADE_INFO[zone.reward].name, elapsedMs: 0 };
      world.zone = null;
      world.missionCooldownUntilMs=state.clockMs+OPTIONAL_EVENT_CONFIG.cooldownMs;
      world.nextRewardAtMs = state.clockMs + WORLD_EVENT_CONFIG.rewardRepeatMs;
      world.nextRewardWave = wave + WORLD_EVENT_CONFIG.rewardWaveGap;
    } else if (result.failed) {
      world.zone = null;
      world.missionCooldownUntilMs=state.clockMs+OPTIONAL_EVENT_CONFIG.cooldownMs;
      world.nextRewardAtMs = state.clockMs + WORLD_EVENT_CONFIG.rewardRepeatMs;
      world.nextRewardWave = wave + WORLD_EVENT_CONFIG.rewardWaveGap;
      world.pendingCaptureDamage = { id: zone.id, amount: WORLD_EVENT_CONFIG.captureFailureDamage };
      // The floating damage is the failure feedback; keep its area free of labels.
      world.notice = null;
      applyCapturePenalty(state);
      if (state.mode === 'dead') return;
    }
  }
  if (world.checkedShipWave !== wave) {
    world.checkedShipWave = wave;
    if (WORLD_EVENT_CONFIG.shipWaves.includes(wave % 10) && state.clockMs >= world.nextShipAtMs) world.pendingShipWave = wave;
  }
  // Coalesce a capture-delayed opportunity, never a backlog behind another boss.
  if (state.pendingBoss || state.boss || state.partner || hasLivingSpecial(state)) world.pendingShipWave = null;
  if (!world.ship && world.pendingShipWave != null && state.encounter.phase !== 'intermission'
    && state.clockMs >= world.nextShipAtMs && canRunWorldEvent(state, 'ship', wave, state.clockMs) && canStartSpecial(state, 'alarm')) {
      const nearest = SHIP_SITES.filter(s => s.id !== world.lastShipSite).slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,3);
      const ship = nearest[Math.floor(worldRandom(world) * nearest.length)];
      if (ship) { world.ship = { siteId: ship.id, enemyId: selectEnemy(state,'mini',false), phase: 'armed', elapsedMs: 0, nextTryMs: 0 }; world.pendingShipWave = null; world.lastEventStartMs = state.clockMs; }
  }
  if (!world.ship) return;
  let event = { ...world.ship };
  const ship = SHIP_SITES.find(s => s.id === event.siteId);
  if (!ship) { world.ship = null; return; }
  if (world.zone && wave < ADVANCED_EVENT_OVERLAP_WAVE && !state.pendingBoss && !state.boss && !state.partner) {
    world.ship = { ...event, phase: 'armed', elapsedMs: 0 }; return;
  }
  if (event.phase === 'armed') {
    // An omitted encounter is discarded, never queued behind a scheduled boss.
    if (!canStartSpecial(state,'alarm')) { world.ship = null; return; }
    if (state.encounter.phase === 'intermission') return;
    event.elapsedMs += dt;
    if (event.elapsedMs >= WORLD_EVENT_CONFIG.shipArmDelayMs || Math.hypot(ship.x-player.x,ship.y-player.y) <= WORLD_EVENT_CONFIG.shipTriggerDistance) {
      event = { ...event, phase: 'alarm', elapsedMs: 0 };
      state.events.shipAlarm++;
      world.lastEventStartMs = state.clockMs;
      world.lastShipSite = ship.id; world.nextShipAtMs = state.clockMs + WORLD_EVENT_CONFIG.shipCooldownMs;
    }
  } else {
    if (!canStartSpecial(state,'ship')) { world.ship = null; return; }
    const previous = event.elapsedMs; event.elapsedMs += dt;
    if (Math.floor(event.elapsedMs/1000) > Math.floor(previous/1000) && event.elapsedMs < WORLD_EVENT_CONFIG.shipWarningMs) state.events.shipAlarm++;
    if (event.elapsedMs >= WORLD_EVENT_CONFIG.shipWarningMs && state.clockMs >= event.nextTryMs) {
      // Favor nearby exits at the hull, keeping the arrival readable from the
      // player's position instead of drawing a random exit behind the camera.
      const exits = ship.spawnPoints.slice().sort((a,b) =>
        Math.hypot(a.x-ship.x,a.y-ship.y) + Math.hypot(a.x-player.x,(a.y-player.y)*1.6)
        - Math.hypot(b.x-ship.x,b.y-ship.y) - Math.hypot(b.x-player.x,(b.y-player.y)*1.6));
      for (const p of exits) {
        if (!spawnIsClear(p,player,state.encounter.enemies,field,{ ...WAVE_CONFIG, spawnMinDistance: WORLD_EVENT_CONFIG.shipSafeDistance, spawnMaxDistance: 5000 })) continue;
        if (BOSS_BLOCKERS.some(b=>p.x-40<b.x+b.width+5&&p.x+40>b.x-5&&p.y-110<b.y+b.height+5&&p.y+5>b.y-5)) continue;
        if (state.minibosses.some(m=>Math.hypot(m.x-p.x,m.y-p.y)<60)) continue;
        if (beginSpecial(state,selectEnemy(state,'mini',false),p,player,'ship',field)) return;
      }
      event.nextTryMs = state.clockMs + WORLD_EVENT_CONFIG.shipRetryMs;
      if (event.elapsedMs >= WORLD_EVENT_CONFIG.shipWarningMs + WORLD_EVENT_CONFIG.shipSpawnGraceMs) { world.ship = null; return; }
    }
  }
  world.ship = event;
}
function attackPathClear(boss: BossState, player: PlayerState): boolean {
  'worklet';
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y), steps = Math.ceil(distance / 20);
  for (let i = 1; i < steps; i++) if (!isWalkable(boss.x + (player.x - boss.x) * i / steps, boss.y + (player.y - boss.y) * i / steps)) return false;
  return true;
}

function burstNpcs(state: SurvivalState, center: { x: number; y: number }, player: PlayerState, field: FlowField, count: number): number {
  'worklet';
  const alive = state.encounter.enemies.filter(n => n.active && n.action !== 'death').length;
  const wanted = Math.min(count, Math.max(0, commonNpcLimit(state) - alive));
  let spawned = 0;
  for (let i = 0; i < wanted * 3 && spawned < wanted && state.encounter.enemies.some(n => !n.active); i++) {
    const p = nearbyPosition(state, center, player, field, 75, 230, 100);
    if (p && spawnCommon(state, player, field, p)) spawned++;
  }
  return spawned;
}
function addHazard(state: SurvivalState, boss: BossState, options: Omit<BossHazard, 'id' | 'owner' | 'ageMs'>): void {
  'worklet';
  if (state.hazards.length >= BOSS_BALANCE.maxHazards) return;
  state.hazards.push({ ...options, id: state.nextPickupId++, owner: boss.entityId ?? -1, ageMs: 0 });
}
function phaseSignal(state: SurvivalState, boss: BossState, phase: number): void {
  'worklet';
  if (phase <= (boss.powerPhase ?? 0)) return;
  boss.powerPhase = phase; state.events.bossPhase++; state.phaseFlashMs = BOSS_BALANCE.phaseFlashMs;
}
function advanceHazards(state: SurvivalState, player: PlayerState, field: FlowField, dt: number): void {
  'worklet';
  const owners = [...(state.boss ? [state.boss] : []), ...(state.partner ? [state.partner] : []), ...state.minibosses];
  const live: BossHazard[] = [];
  for (const old of state.hazards) {
    const owner = owners.find(b => (b.entityId ?? -1) === old.owner && b.hp > 0 && b.phase !== 'death');
    if (!owner) continue;
    const h = { ...old, ageMs: old.ageMs + dt };
    if (h.ageMs >= h.warningMs + h.activeMs) continue;
    if (h.fx === 'dustSlam' && h.markerStartMs !== undefined && h.followMs !== undefined && h.landingStartMs !== undefined) {
      const tick = dustBeepTick(h.ageMs, h.markerStartMs, h.followMs, h.landingStartMs);
      if (tick >= 0 && tick > dustBeepTick(old.ageMs, h.markerStartMs, h.followMs, h.landingStartMs)) {
        state.events.bossBeep = (state.events.bossBeep ?? 0) + 1;
        playActionSound(state.events,h.ageMs < h.followMs ? 'dustBeepTrack' : 'dustBeepFast',h.owner);
      }
      if (old.ageMs < h.followMs && h.ageMs >= h.markerStartMs && isWalkable(player.x, player.y)) {
        const trackingMs = Math.max(0, Math.min(h.ageMs, h.followMs) - Math.max(old.ageMs, h.markerStartMs));
        const dx = player.x - h.x, dy = player.y - h.y, d = Math.hypot(dx, dy);
        const travel = Math.min(d, BOSS_BALANCE.dustMarkerSpeed * trackingMs / 1000);
        if (d > 0) { h.x += dx / d * travel; h.y += dy / d * travel; }
        // The last tracking sample locks a valid point directly under the hero.
        if (h.ageMs >= h.followMs) { h.x = player.x; h.y = player.y; }
      }
    } else if (h.followMs && old.ageMs < h.followMs && isWalkable(player.x, player.y)) {
      const x = player.x + (h.followOffsetX ?? 0), y = player.y + (h.followOffsetY ?? 0);
      if (isWalkable(x, y)) { h.x = x; h.y = y; }
    }
    if (h.kind === 'beam') { h.x = owner.x + Math.cos(h.angle) * 28; h.y = owner.y - 26 + Math.sin(h.angle) * 28; }
    // Sound follows the visible projectile release, not the later collision.
    if (h.launchMs !== undefined && old.ageMs < h.launchMs && h.ageMs >= h.launchMs) {
      if (h.fx === 'electroLightning') playActionSound(state.events,'electroProjectile',h.owner);
      else if (h.fx === 'volley') playActionSound(state.events,'archerShot',h.owner);
    }
    const active = h.ageMs >= h.warningMs;
    if (active && old.ageMs < h.warningMs) {
      if (h.fx === 'dustSlam') playActionSound(state.events,'dustSlam',h.owner);
      else if (h.fx === 'sageDark' || h.fx === 'sageCyan') playActionSound(state.events,'sageExplosion',h.owner);
    }
    if (!active) { live.push(h); continue; }
    if (h.npcBurst && !h.emitted) {
      burstNpcs(state, h, player, field, h.npcBurst); h.emitted = true;
      if (h.fx === 'shockSlam') state.npcBoostMs = BOSS_BALANCE.npcBoostMs;
    }
    const movingMs = Math.max(0, Math.min(dt, h.ageMs - h.warningMs));
    if (h.kind === 'ball' || h.kind === 'arrow') {
      const x = h.x + (h.vx ?? 0) * movingMs / 1000, y = h.y + (h.vy ?? 0) * movingMs / 1000;
      if (Math.hypot(x - player.x, y - player.y) > 1600 || !projectilePathClear(h.x, h.y, x, y)) continue;
      h.x = x; h.y = y;
    }
    if(h.fx==='electroLightning'&&old.ageMs<h.warningMs&&h.ageMs>=h.warningMs)state.events.electricImpact=(state.events.electricImpact??0)+1;
    if (!h.hit && h.damage > 0 && h.ageMs<h.warningMs+(h.damageMs??h.activeMs) && player.action !== 'dash' && hazardHits(h, player, old.x, old.y)) {
      if (hurtPlayer(state, h.damage)) {
        h.hit = true;
        if (h.stunMs) state.stunMs = Math.max(state.stunMs, Math.min(900, h.stunMs));
        if (h.poison) { state.poisonMs = BOSS_BALANCE.poisonDurationMs; state.poisonTickMs = BOSS_BALANCE.poisonIntervalMs; }
      }
      if (h.kind === 'ball' || h.kind === 'arrow') continue;
    }
    if (state.mode === 'dead') { state.hazards = []; return; }
    live.push(h);
  }
  state.hazards = live;
}
function moveBossAway(boss: BossState, player: PlayerState, step: number): BossState {
  'worklet';
  const angle = Math.atan2(boss.y - player.y, boss.x - player.x);
  let best = boss, score = -Infinity;
  for (const turn of [0, 0.55, -0.55, 1.1, -1.1, 1.57, -1.57, 2.2, -2.2, Math.PI]) {
    const p = moveWithCollisions(boss, Math.cos(angle + turn) * step, Math.sin(angle + turn) * step);
    const travelled = Math.hypot(p.x - boss.x, p.y - boss.y);
    const candidate = travelled * 3 + Math.hypot(p.x - player.x, p.y - player.y) - Math.abs(turn) * 0.4;
    if (candidate > score) { best = { ...boss, ...p }; score = candidate; }
  }
  return best;
}
function sweepCorridor(state: SurvivalState, boss: BossState): { x: number; y: number; endX: number } | null {
  'worklet';
  const v = state.combatView;
  if (!v) return null;
  let best: { x: number; y: number; endX: number } | null = null, bestScore = -Infinity;
  for (let y = v.top + 145; y <= v.bottom - 45; y += 24) {
    let start = -1;
    for (let x = v.left + 65; x <= v.right - 40; x += 24) {
      const clear = x <= v.right - 65 && isWalkable(x, y);
      if (clear && start < 0) start = x;
      if ((!clear || x + 24 > v.right - 65) && start >= 0) {
        const end = clear ? x : x - 24, width = end - start;
        if (width >= 168) {
          const leftFirst = boss.x < (start + end) / 2, entry = leftFirst ? start + 8 : end - 8;
          const score = width - Math.hypot(entry - boss.x, y - boss.y) * 0.35;
          if (score > bestScore) { bestScore = score; best = { x: entry, y, endX: leftFirst ? end - 8 : start + 8 }; }
        }
        start = -1;
      }
    }
  }
  return best;
}

function prepareBossHazards(state: SurvivalState, boss: BossState, player: PlayerState, field: FlowField): void {
  'worklet';
  const move = bossAttack(boss.id, boss.attackIndex ?? 0), rate = boss.attackRate ?? 1;
  const preparation = Math.max(BOSS_BALANCE.warningMinMs, move.warningMs / rate);
  if (boss.id === 'evil-sage') playActionSound(state.events,'sageCharge',boss.entityId!);
  const launchMs = move.kind === 'volley' ? preparation + move.durationMs * BOSS_BALANCE.volleyReleaseFraction / rate : undefined;
  const bombMarkerMs = boss.id === 'dust-jumper' && move.kind === 'projectile'
    ? preparation + move.durationMs / rate : undefined;
  const jump = boss.id === 'dust-jumper' && move.kind === 'jump' ? dustJumpTimeline(rate,boss.dustCritical) : null;
  const wait = launchMs !== undefined ? launchMs + BOSS_BALANCE.volleyFallMs
    : bombMarkerMs !== undefined ? bombMarkerMs + BOSS_BALANCE.dustBombMarkerMs
    : jump ? preparation + jump.impactMs : preparation + move.activeStartMs / rate;
  const damage = boss.damage ?? 1;
  const base = { angle: boss.aimAngle, radius: move.range, length: 0, warningMs: wait, activeMs: 650, damage };
  const target = { x: player.x, y: player.y };
  boss.targetX = target.x; boss.targetY = target.y; boss.startX = boss.x; boss.startY = boss.y; boss.moveDone = false;
  if(move.kind==='lightning'){
    const count=!boss.cloneOf&&(boss.powerPhase??0)>=1?BOSS_BALANCE.electroBolts[state.difficulty]:1;
    for(let i=0;i<count;i++){
      const offset=i===0?0:(i%2?1:-1)*BOSS_BALANCE.electroBoltSpacing;
      const x=target.x+Math.cos(boss.aimAngle+Math.PI/2)*offset,y=target.y+Math.sin(boss.aimAngle+Math.PI/2)*offset;
      if(!isWalkable(x,y))continue;
      const launch=preparation+i*BOSS_BALANCE.electroBoltStaggerMs;
      addHazard(state,boss,{...base,x,y,kind:'blast',fx:'electroLightning',radius:BOSS_BALANCE.electroBoltRadius,launchMs:launch,warningMs:launch+BOSS_BALANCE.electroFallMs,activeMs:BOSS_BALANCE.electroBoltFxMs,damageMs:BOSS_BALANCE.electroBoltDamageMs});
    }
    state.events.electricCharge=(state.events.electricCharge??0)+1;
  } else if (move.kind === 'burrow') {
    // Track the player's feet while vanishing, then visibly lock the exit long
    // enough to dodge before the real appearance animation begins.
    addHazard(state, boss, { ...base, x: target.x, y: target.y, kind: 'teleport', radius: 38,
      followMs: Math.max(0, wait - BOSS_BALANCE.burrowLockMs), damage: 0, fx: 'teleport' });
  } else if (move.kind === 'teleport') {
    const spot = nearbyPosition(state, player, player, field, BOSS_BALANCE.teleportSafeDistance, 310, BOSS_BALANCE.teleportSafeDistance);
    boss.targetX = spot?.x ?? boss.x; boss.targetY = spot?.y ?? boss.y;
    addHazard(state, boss, { ...base, x: boss.targetX, y: boss.targetY, kind: 'teleport', radius: 38, warningMs: wait, damage: 0, fx: 'teleport' });
  } else if (move.kind === 'laser') {
    if (boss.id === 'rock-boss') {
      const v = state.combatView ?? { left: player.x - 450, right: player.x + 450, top: player.y - 230, bottom: player.y + 230 };
      boss.sweepX = boss.sweepX ?? (boss.x < (v.left + v.right) / 2 ? v.right - 65 : v.left + 65);
      boss.aimAngle = Math.PI / 2;
    }
    addHazard(state, boss, { ...base, kind: 'beam', x: boss.x + Math.cos(boss.aimAngle) * 28, y: boss.y - 26 + Math.sin(boss.aimAngle) * 28, angle: boss.aimAngle,
      radius: move.halfWidth, length: BOSS_BALANCE.beamLength, activeMs: (move.activeEndMs - move.activeStartMs) / rate,
      fx: boss.id === 'rock-boss' ? 'rockBeam' : 'archerBeam' });
  } else if (move.kind === 'projectile' && boss.id !== 'dust-jumper') {
    const count = boss.id === 'shielder' ? bossMode(state.difficulty).balls : boss.siblingRage ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const angle = boss.aimAngle + (i - (count - 1) / 2) * 0.22, speed = boss.id === 'shielder' ? 190 : BOSS_BALANCE.banditArrowSpeed;
      addHazard(state, boss, { ...base, x: boss.x + Math.cos(angle) * 26, y: boss.y - 12 + Math.sin(angle) * 26,
        angle, kind: boss.id === 'shielder' ? 'ball' : 'arrow', radius: boss.id === 'shielder' ? 10 : 7,
        activeMs: BOSS_BALANCE.projectileMs, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        fx: boss.id === 'shielder' ? 'shielderBall' : 'arrow' });
    }
  } else if (move.kind === 'projectile' || move.kind === 'volley') {
    const count = boss.id === 'dust-jumper' ? dustPressure(boss.hp, boss.maxHp).bombs : boss.siblingRage ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const a = boss.aimAngle + Math.PI / 2, offset = (i - (count - 1) / 2) * 110;
      const p = { x: target.x + Math.cos(a) * offset, y: target.y + Math.sin(a) * offset };
      if (!isWalkable(p.x, p.y)) continue;
      const markerStartMs = bombMarkerMs !== undefined ? bombMarkerMs + i * 110 : undefined;
      addHazard(state, boss, { ...base, ...p, kind: move.kind === 'volley' ? 'volley' : 'bomb', radius: move.kind === 'volley' ? 38 : 48,
        halfHeight: move.kind === 'volley' ? undefined : 36, activeMs: 650, launchMs, markerStartMs,
        followMs: launchMs ?? markerStartMs ?? 350, followOffsetX: Math.cos(a) * offset, followOffsetY: Math.sin(a) * offset,
        warningMs: wait + i * (move.kind === 'volley' ? 55 : 110), fx: move.kind === 'volley' ? 'volley' : 'dustBomb' });
    }
  } else if (move.kind === 'explosion' || move.kind === 'jump' || move.kind === 'slam') {
    const self = boss.id === 'evil-sage' && (boss.attackIndex ?? 0) === 0 || move.kind === 'slam';
    const widow = boss.id === 'tarnished-widow';
    const p = self || jump ? { x: boss.x, y: boss.y } : target;
    addHazard(state, boss, { ...base, ...p, kind: widow ? 'poisonBlast' : move.kind === 'slam' || move.kind === 'jump' ? 'slam' : 'blast',
      markerStartMs: jump ? preparation + jump.takeoffMs : undefined,
      landingStartMs: jump ? preparation + jump.landingStartMs : undefined,
      followMs: jump ? preparation + jump.followEndMs : !self ? 400 : undefined, activeMs: 700,
      fx: boss.id === 'evil-sage' ? self ? 'sageDark' : 'sageCyan' : boss.id === 'shock-sweeper' ? 'shockSlam' : widow ? 'widowPoison' : 'dustSlam',
      stunMs: boss.id === 'shock-sweeper' ? BOSS_BALANCE.stunMs : undefined,
      poison: widow, npcBurst: widow ? 10 : boss.id === 'shock-sweeper' ? 10 + bossMode(state.difficulty).burstExtra : undefined });
  }
}

function advanceDroidGroup(state: SurvivalState, boss: BossState, player: PlayerState, field: FlowField, dt: number): void {
  'worklet';
  if (boss.id !== 'bomb-droid' || (boss.packRemaining ?? 0) <= 0) return;
  boss.packMs = (boss.packMs ?? 0) + dt; boss.packWaitMs = (boss.packWaitMs ?? 0) + dt;
  if (boss.packMs >= BOSS_BALANCE.packIntervalMs) {
    const p = nearbyPosition(state, boss, player, field, 90, 220, 130);
    if (p && state.minibosses.length < BOSS_BALANCE.maxSupports) {
      state.minibosses.push({ ...makeBoss(state, 'bomb-droid', p, player), packMember: true,groupId:boss.groupId }); boss.packRemaining!--;
    }
    boss.packMs = 0;
  }
  // The group belongs to the encounter, not the leader's lifespan. A fast kill
  // cannot erase pending companions. A saturated/invalid location still times out.
  if (boss.packWaitMs >= BOSS_BALANCE.packMaxWaitMs) boss.packRemaining = 0;
}

function advanceElectroClones(state:SurvivalState,boss:BossState,player:PlayerState,field:FlowField,dt:number,entered:boolean):void {
  'worklet';
  if(boss.id!=='electrocutioner'||boss.cloneOf||(boss.powerPhase??0)<2||boss.hp<=0)return;
  boss.cloneMs=entered?0:(boss.cloneMs??0)+dt;
  if(boss.cloneMs<BOSS_BALANCE.electroCloneIntervalMs)return;
  boss.cloneMs%=BOSS_BALANCE.electroCloneIntervalMs;
  // Consume a full interval even at cap or on a failed position: no backlog.
  const living=state.minibosses.filter(c=>c.cloneOf===boss.entityId&&c.hp>0&&c.phase!=='death').length;
  if(living>=BOSS_BALANCE.electroCloneLimit[state.difficulty]||state.minibosses.length>=BOSS_BALANCE.maxSupports)return;
  const p=nearbyPosition(state,boss,player,field,130,280,150);
  if(!p)return;
  state.minibosses.push({...makeBoss(state,'electrocutioner',p,player),hp:1,maxHp:1,cloneOf:boss.entityId,cloneMs:0,powerPhase:0,pattern:0});
}

function advanceBoss(state: SurvivalState, source: BossState, before: PlayerState, player: PlayerState, field: FlowField, dt: number): BossState | null {
  'worklet';
  const spec = ENEMY_DEFS[source.id], tuning = state.purgatorio ? purgatorioTuning(state.purgatorio.number, state.difficulty) : difficultyTuning(state.encounter.wave, state.difficulty);
  let boss: BossState = { ...source, hitFlashMs: Math.max(0,(source.hitFlashMs??0)-dt), attackRootX: source.phase === 'attack' ? (source.attackRootX ?? 0) : 0,
    phaseMs: source.phaseMs + dt, animationMs: source.animationMs + dt, summonMs: (source.summonMs ?? 0) + dt,
    shockSummonCooldownMs: source.id === 'shock-sweeper' ? Math.max(0, (source.shockSummonCooldownMs ?? 0) - dt) : source.shockSummonCooldownMs,
    teleportCooldownMs: Math.max(0, (source.teleportCooldownMs ?? BOSS_BALANCE.teleportCooldownMs) - dt) };
  advanceDroidGroup(state, boss, player, field, dt);
  if (boss.phase === 'death') {
    const ownsLivingPack = boss.id === 'bomb-droid' && !boss.packMember && state.minibosses.some(b => b.packMember && b.hp > 0);
    return boss.phaseMs >= spec.deathDurationMs && (boss.packRemaining ?? 0) <= 0 && !ownsLivingPack ? null : boss;
  }
  const currentMove = bossAttack(boss.id, boss.attackIndex ?? 0);
  const intangible = boss.phase === 'attack' && (currentMove.kind === 'teleport' || currentMove.kind === 'burrow' || currentMove.kind === 'jump' && (boss.id === 'dust-jumper'
    ? boss.phaseMs < dustJumpTimeline(boss.attackRate ?? 1,boss.dustCritical).impactMs : boss.phaseMs * (boss.attackRate ?? 1) < currentMove.activeStartMs));
  if (boss.phase !== 'intro' && !intangible && (!before.frenesis || state.frenesis.active) && swordHitsNpc(before, player, { ...emptyNpc(), ...boss, id: -1, active: true, action: 'move' })) {
    boss.lastHitSerial = player.attackSerial;
    if (boss.id !== 'shielder' || (before.x - boss.x) * boss.facingX < -8) {
      const actualDamage = Math.min(boss.hp, before.frenesis ? FRENESIS.spinDamage : 1);
      boss.hp -= actualDamage;
      if(actualDamage>0){boss.hitFlashMs=220;boss.hitSerial=(boss.hitSerial??0)+1;}
      state.frenesis = chargeFrenesis(state.frenesis, actualDamage, spec.tier === 'minion' && boss.hp <= 0, spec.tier !== 'minion');
      if (state.clockMs - (boss.hitCueAtMs ?? -1000) >= BOSS_BALANCE.hitCueMs) { boss.hitCueAtMs = state.clockMs; state.events.bossHit++; }
    }
    if (boss.hp <= 0) {
      stopOwnerSounds(state.events,boss.entityId!);
      state.events.kill++;
      if(!boss.cloneOf){
        if (spec.tier !== 'minion') state.events.boss++;
        if (spec.tier === 'boss') state.stats.bossKills++;
        else if (spec.tier === 'mini') state.stats.minibossKills++;
        else { state.stats.npcKills++; countSpinKill(state,player); }
        dropOrb(state, boss.x, boss.y, spec.tier === 'mini' ? 22 : spec.tier === 'minion' ? 4 : 45);
        if(boss.id==='bomb-droid'&&boss.groupId&&state.droidGroup?.id===boss.groupId){const g=state.droidGroup;if(!g.killed.includes(boss.entityId!))state.droidGroup={...g,killed:[...g.killed,boss.entityId!],x:boss.x,y:boss.y};}
        else if(spec.tier!=='minion')enqueueChest(state,boss.x,boss.y);
      }
      state.hazards = state.hazards.filter(h => h.owner !== boss.entityId);
      return { ...boss, hp: 0, phase: 'death', phaseMs: 0, animationMs: 0, attackRootX: 0, packRemaining: boss.id === 'bomb-droid' ? boss.packRemaining : 0 };
    }
  }
  const ratio = boss.hp / boss.maxHp;
  if(boss.id==='electrocutioner'&&!boss.cloneOf){
    const oldPhase=boss.powerPhase??0;
    // Integer comparisons include the exact thresholds, independently of FPS.
    phaseSignal(state,boss,boss.hp*3<=boss.maxHp?2:boss.hp*3<=boss.maxHp*2?1:0);
    advanceElectroClones(state,boss,player,field,dt,oldPhase<2&&(boss.powerPhase??0)>=2);
  }else if (boss.id === 'guardian') phaseSignal(state, boss, ratio < 1 / 3 ? 2 : ratio < 2 / 3 ? 1 : 0);
  else if (boss.id === 'dust-jumper') phaseSignal(state, boss, ratio < 2 / 3 ? 1 : 0);
  else if (boss.id === 'skeleton-summoner' || boss.id === 'rock-boss' || boss.id === 'archer') phaseSignal(state, boss, ratio < 0.5 ? 1 : 0);
  const sibling = state.partner ? (boss.entityId === state.partner.entityId ? state.boss : state.partner) : null;
  if ((boss.id === 'dagger-bandit' || boss.id === 'archer-bandit') && sibling && sibling.hp <= 0 && !boss.siblingRage) {
    boss.siblingRage = true; boss.damage = 2; boss.hp = Math.min(boss.maxHp, boss.hp + Math.ceil(boss.maxHp * BOSS_BALANCE.siblingHeal)); phaseSignal(state, boss, 1);
  }
  const minionBoost = spec.tier === 'minion' && state.boss?.id === 'skeleton-summoner' && (state.boss.powerPhase ?? 0) > 0;
  const powerSpeed = boss.id === 'guardian' && boss.powerPhase ? 1.85 : boss.id === 'rock-boss' && boss.powerPhase ? 1.8
    : boss.id === 'skeleton-summoner' && boss.powerPhase || minionBoost ? 1.6 : boss.siblingRage ? 1.55
    : boss.id==='electrocutioner'&&boss.powerPhase?BOSS_BALANCE.electroSpeedMultiplier:boss.id === 'dust-jumper' ? dustPressure(boss.hp, boss.maxHp).movement : 1;
  const speed = spec.speed * tuning.speed * powerSpeed * (boss.id === 'bomb-droid' ? 1.6 : 1);
  if (spec.tier === 'boss' && !boss.cloneOf && boss.id !== 'skeleton-summoner' && boss.summonMs! >= tuning.summonMs && boss.phase === 'recover') {
    if (spawnBossSupport(state, boss, player, field)) boss.summonMs = 0; else boss.summonMs = tuning.summonMs - 1000;
  }
  const move = bossAttack(boss.id, boss.attackIndex ?? 0), rate = boss.attackRate ?? 1;
  // Commit the exit's authored body translation before changing animation.
  // The same root is removed from the current cell by bossFrame, so rendering,
  // collision and the next clip all share the same persistent world position.
  const exitIntro = boss.phase === 'intro';
  const exitAttack = boss.phase === 'attack' && move.kind === 'burrow';
  let exitRootDelta = 0;
  if (exitIntro || exitAttack) {
    const split = move.split ?? 0.5;
    const progress = exitIntro ? boss.phaseMs / SURVIVAL_CONFIG.introMs : (boss.phaseMs * rate / move.durationMs - split) / (1 - split);
    const previous = exitIntro ? source.phaseMs / SURVIVAL_CONFIG.introMs : (source.phaseMs * rate / move.durationMs - split) / (1 - split);
    exitRootDelta = (banditExitRoot(boss.id, progress) - banditExitRoot(boss.id, previous)) * (ENEMY_VISUALS[boss.id].intro?.scale ?? 1) * boss.facingX;
    if (exitIntro && exitRootDelta) boss = { ...boss, ...moveWithCollisions(boss, exitRootDelta, 0) };
  }
  const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
  const contactActive = boss.phase !== 'attack' || (boss.phaseMs * rate >= move.activeStartMs && boss.phaseMs * rate < move.activeEndMs && ['melee','area','charge','line','evade'].includes(move.kind));
  if (boss.phase !== 'intro' && !intangible && contactActive && distance < 27 && player.action !== 'dash') hurtPlayer(state, boss.damage ?? 1);
  if (state.hp === 0) return boss;
  if (boss.phase === 'intro' && boss.phaseMs >= SURVIVAL_CONFIG.introMs) boss = { ...boss, phase: 'recover', phaseMs: 0, animationMs: 0 };
  else if (boss.phase === 'recover') {
    const ranged = boss.id === 'evil-sage' || boss.id === 'archer' || boss.id === 'archer-bandit' || boss.id === 'dust-jumper'||boss.id==='electrocutioner';
    if (ranged && distance < 220 || boss.id === 'rock-boss' && boss.pattern % 4 === 2 && distance < 180) boss = moveBossAway(boss, player, speed * dt / 1000);
    else if (distance > (ranged ? 310 : 45)) {
      const direction = navigationDirection(boss, player, field);
      boss = { ...boss, ...moveWithCollisions(boss, direction.x * speed * dt / 1000, direction.y * speed * dt / 1000) };
    }
    let stagingSweep = false;
    if (boss.id === 'rock-boss' && boss.pattern % bossAttackCount(boss.id) === 2 && state.combatView) {
      const v = state.combatView;
      boss.sweepStageMs = (source.sweepStageMs ?? 0) + dt;
      const stale = boss.sweepY === undefined || boss.sweepStartX === undefined || boss.sweepY < v.top + 125 || boss.sweepY > v.bottom - 35 || boss.sweepStartX < v.left + 45 || boss.sweepStartX > v.right - 45;
      if (stale && state.clockMs >= (boss.sweepPlanMs ?? 0)) {
        const corridor = sweepCorridor(state, boss);
        boss.sweepStartX = corridor?.x; boss.sweepY = corridor?.y; boss.sweepX = corridor?.endX; boss.sweepPlanMs = state.clockMs + 600;
      }
      if (boss.sweepStartX !== undefined && boss.sweepY !== undefined) {
        const dx = boss.sweepStartX - boss.x, dy = boss.sweepY - boss.y, d = Math.hypot(dx, dy);
        stagingSweep = d > 16;
        if (stagingSweep) {
          const step = Math.min(d, 255 * dt / 1000), p = moveWithCollisions(boss, dx / d * step, dy / d * step);
          boss = { ...boss, ...p };
          if (Math.hypot(p.x - source.x, p.y - source.y) < 0.2) { boss.sweepStartX = undefined; boss.sweepY = undefined; }
        }
      } else stagingSweep = true;
      // Remain a pursuing threat if there is no reachable visible lane; never
      // fire a camera-crossing beam from above/below the actual viewport.
      if (stagingSweep && (boss.sweepStageMs ?? 0) > 6000) { boss.pattern++; boss.phaseMs = 0; boss.sweepStageMs = 0; stagingSweep = false; }
    }
    if (Math.abs(player.x - boss.x) > 6) boss.facingX = player.x < boss.x ? -1 : 1;
    const summonInterval = Math.max(2400, tuning.summonMs * 0.34);
    const summonDue = boss.id === 'skeleton-summoner' && boss.summonMs! >= summonInterval;
    const rangedReady = ranged && distance < 850 || boss.id === 'rock-boss' && distance < 1000;
    if (!stagingSweep && (summonDue || rangedReady || distance < spec.attackRange + 90) && boss.phaseMs >= Math.max(WAVE_BALANCE.minRecoveryMs, move.recoveryMs / rate) && state.clockMs >= state.bossActionUntilMs) {
      let index = boss.pattern % bossAttackCount(boss.id);
      if (boss.id === 'shock-sweeper') {
        const slamTurn = boss.pattern % (BOSS_BALANCE.shockMeleePerSlam + 1) === 1;
        index = slamTurn && (boss.shockSummonCooldownMs ?? 0) === 0 ? 1 : 0;
      }
      if (boss.id === 'skeleton-summoner') index = summonDue ? 1 : 0;
      if (boss.id === 'guardian' && ((boss.powerPhase ?? 0) < 2 || boss.teleportCooldownMs! > 0) && index === 3) index = 0;
      if (boss.id === 'dust-jumper' && !boss.powerPhase) index = 0;
      if (boss.id === 'archer') index = boss.powerPhase && boss.teleportCooldownMs === 0 && boss.pattern % 3 === 2 ? 1 : 0;
      if (boss.id === 'guardian' && (boss.powerPhase ?? 0) >= 2 && boss.teleportCooldownMs === 0) index = 3;
      if(boss.id==='electrocutioner')index=boss.cloneOf?0:boss.powerPhase&&boss.teleportCooldownMs===0&&boss.pattern%3===2?2:boss.pattern%2;
      // Dagger Mush mixes one, two, and return strikes using seeded encounter RNG.
      if (boss.id === 'dagger-mush') index = Math.floor(worldRandom(state.world) * 3);
      const next = bossAttack(boss.id, index), nextRate = tuning.combatRate * (boss.id === 'dust-jumper' ? dustPressure(boss.hp, boss.maxHp).tempo : 1);
      boss = { ...boss, phase: 'warning', phaseMs: 0, animationMs: 0, attackRootX: 0, attackIndex: index, attackRate: nextRate, summonDone: false, dustCritical: boss.id==='dust-jumper'&&boss.hp*3<boss.maxHp,
        aimAngle: Math.atan2(player.y - boss.y, player.x - boss.x) };
      if (boss.id === 'shock-sweeper' && index === 1) boss.shockSummonCooldownMs = BOSS_BALANCE.shockSummonCooldownMs;
      prepareBossHazards(state, boss, player, field);
      const preparation = Math.max(BOSS_BALANCE.warningMinMs, next.warningMs / nextRate);
      const duration = boss.id === 'dust-jumper' ? next.kind === 'jump' ? dustJumpTimeline(nextRate,boss.dustCritical).durationMs
        : next.durationMs / nextRate + BOSS_BALANCE.dustBombMarkerMs + 650 : next.durationMs / nextRate;
      state.bossActionUntilMs = state.clockMs + preparation + duration + WAVE_BALANCE.attackGapMs;
    }
  } else if (boss.phase === 'warning') {
    const tracking = state.hazards.find(h => h.owner === boss.entityId && h.followMs && h.ageMs < h.warningMs);
    if (tracking) { boss.targetX = tracking.x; boss.targetY = tracking.y; }
    if (boss.phaseMs >= Math.max(BOSS_BALANCE.warningMinMs, move.warningMs / rate)) {
      if (boss.id === 'dust-jumper') {
        // The warning can end between display frames. Start Dust's authored
        // timeline and its ground effects on exactly the same simulation frame.
        const preparation = Math.max(BOSS_BALANCE.warningMinMs, move.warningMs / rate);
        state.hazards = state.hazards.map(h => h.owner === boss.entityId ? { ...h, ageMs: preparation - dt } : h);
      }
      boss = { ...boss, phase: 'attack', phaseMs: 0, animationMs: 0, attackRootX: 0, startX: boss.x, startY: boss.y };
      state.events.bossAttack++;
      // This recording includes the throw, descent and explosion. Play it once
      // with the throwing animation, never restart it at each ground impact.
      if (boss.id === 'dust-jumper' && move.kind === 'projectile') playActionSound(state.events,'dustBomb',boss.entityId!);
      if (!hasAuthoredAttackSound(boss.id)) state.events.bossAttackSound = (state.events.bossAttackSound ?? 0) + 1;
      if (boss.id === 'evil-sage') stopActionSound(state.events,'sageCharge',boss.entityId!);
      if (move.kind === 'teleport' && (boss.id === 'guardian' || boss.id === 'electrocutioner'))
        playActionSound(state.events,boss.id === 'guardian' ? 'guardianTeleport' : 'electroTeleport',boss.entityId!);
      if (boss.id === 'tarnished-widow') playActionSound(state.events,move.clip === 'attack' ? 'widowVoice1' : 'widowVoice2',boss.entityId!);
    }
  } else if (boss.phase === 'attack') {
    const root = attackMotionRoot(boss.id, boss.phaseMs, move.durationMs / rate, move.clip);
    const previousRoot = source.attackRootX ?? attackMotionRoot(boss.id, source.phaseMs, move.durationMs / rate, move.clip);
    const visual = ENEMY_VISUALS[boss.id][move.clip] ?? ENEMY_VISUALS[boss.id].attack;
    const rootDelta = (root - previousRoot) * visual.scale * boss.facingX * visual.authoredFacing;
    if (rootDelta) boss = { ...boss, ...moveWithCollisions(boss, rootDelta, 0) };
    boss.attackRootX = root;
    const ms = boss.phaseMs * rate, previousMs = source.phaseMs * rate;
    const first = move.activeStartMs, last = move.activeEndMs;
    if (previousMs < first && ms >= first) {
      if (boss.id === 'guardian' && move.kind !== 'teleport')
        playActionSound(state.events,move.clip === 'attack' ? 'guardianLasers' : move.clip === 'blast' ? 'guardianSquare' : 'guardianLaser',boss.entityId!);
      else if (boss.id === 'electrocutioner' && move.clip === 'storm') playActionSound(state.events,'electroStorm',boss.entityId!);
      else if (boss.id === 'archer' && move.kind === 'laser') playActionSound(state.events,'archerShot',boss.entityId!);
      else if ((boss.id === 'dagger-bandit' || boss.id === 'dagger-mush') && move.kind !== 'burrow') playActionSound(state.events,'daggerSlash',boss.entityId!);
    }
    if (move.kind === 'summon') {
      if (ms >= first && !boss.summonDone) { spawnBossSupport(state, boss, player, field); boss.summonDone = true; boss.summonMs = 0; }
    } else if (move.kind === 'teleport' || move.kind === 'burrow') {
      if (move.kind === 'burrow') {
        const exit = state.hazards.find(h => h.owner === boss.entityId && h.kind === 'teleport');
        if (exit) { boss.targetX = exit.x; boss.targetY = exit.y; }
      }
      if (ms >= first && !boss.moveDone) {
        if (boss.targetX !== undefined && boss.targetY !== undefined && isWalkable(boss.targetX, boss.targetY) && (move.kind === 'burrow' || Math.hypot(player.x - boss.targetX, player.y - boss.targetY) >= BOSS_BALANCE.teleportSafeDistance)) {
          boss.x = boss.targetX; boss.y = boss.targetY;
        }
        boss.moveDone = true; boss.teleportCooldownMs = boss.id==='electrocutioner'?BOSS_BALANCE.electroTeleportCooldownMs:BOSS_BALANCE.teleportCooldownMs;
      }
      // Commit after relocation, including a fast frame crossing the exit boundary.
      if (move.kind === 'burrow' && boss.moveDone && exitRootDelta) boss = { ...boss, ...moveWithCollisions(boss, exitRootDelta, 0) };
    } else if (move.kind === 'jump') {
      const h = state.hazards.find(h => h.owner === boss.entityId && (h.kind === 'slam' || h.kind === 'poisonBlast'));
      const x = h?.x ?? boss.targetX ?? boss.x, y = h?.y ?? boss.targetY ?? boss.y;
      // Dust Jumper leaves from its exact takeoff point and stays hidden while
      // airborne. Normal jumps commit the locked marker once; critical jumps
      // pursue through contact, then retain that exact world/FX anchor.
      if (boss.id === 'dust-jumper') {
        const jump=dustJumpTimeline(rate,boss.dustCritical);
        if(boss.dustCritical && !boss.moveDone && h && isWalkable(player.x,player.y)){h.x=player.x;h.y=player.y;}
        const landingX=h?.x??x,landingY=h?.y??y;
        if(boss.phaseMs>=jump.landingStartMs && !boss.moveDone && isWalkable(landingX,landingY)){
          boss.x=landingX;boss.y=landingY;boss.moveDone=!boss.dustCritical||boss.phaseMs>=jump.impactMs;
        }
      } else {
        const travel = Math.min(1, ms / Math.max(1, first));
        const targetX = (boss.startX ?? boss.x) + (x - (boss.startX ?? boss.x)) * travel;
        const targetY = (boss.startY ?? boss.y) + (y - (boss.startY ?? boss.y)) * travel;
        if (isWalkable(targetX, targetY)) { boss.x = targetX; boss.y = targetY; }
      }
    } else if (move.kind === 'evade') {
      if (ms > move.activeStartMs && ms < move.activeEndMs) boss = { ...boss, ...moveWithCollisions(boss, -Math.cos(boss.aimAngle) * move.speed * dt / 1000, -Math.sin(boss.aimAngle) * move.speed * dt / 1000) };
    } else if (move.kind === 'explosion' && boss.id === 'tarnished-widow') {
      if (ms < move.activeEndMs) boss = { ...boss, ...moveWithCollisions(boss, Math.cos(boss.aimAngle) * move.speed * dt / 1000, Math.sin(boss.aimAngle) * move.speed * dt / 1000) };
    } else if (move.kind === 'laser' && boss.id === 'rock-boss') {
      const v = state.combatView;
      if (v && (boss.y < v.top + 100 || boss.y > v.bottom - 25)) {
        state.hazards = state.hazards.filter(h => h.owner !== boss.entityId || h.kind !== 'beam');
        return { ...boss, phase: 'recover', phaseMs: 0, animationMs: 0, pattern: boss.pattern + 1, attackRootX: 0, sweepStartX: undefined, sweepY: undefined };
      }
      let x = boss.sweepX ?? boss.x;
      if (v) x = Math.max(v.left + 55, Math.min(v.right - 55, x));
      if (ms >= first && previousMs < last) {
        const laneDistance = Math.abs((boss.sweepX ?? boss.x) - (boss.startX ?? boss.x));
        const crossingSpeed = Math.max(220, Math.min(1000, laneDistance / Math.max(0.5, (last - first) / rate / 1000) * 1.05));
        const step = Math.sign(x - boss.x) * Math.min(Math.abs(x - boss.x), crossingSpeed * dt / 1000);
        boss = { ...boss, ...moveWithCollisions(boss, step, 0) };
        // A lane became obstructed or left the camera: cancel safely rather than
        // firing an unseen/stuck beam or relocating the boss instantaneously.
        if (Math.abs(step) > 0.2 && Math.abs(boss.x - source.x) < Math.abs(step) * 0.2) {
          state.hazards = state.hazards.filter(h => h.owner !== boss.entityId || h.kind !== 'beam');
          return { ...boss, phase: 'recover', phaseMs: 0, animationMs: 0, pattern: boss.pattern + 1, attackRootX: 0, sweepStartX: undefined, sweepY: undefined, sweepStageMs: 0 };
        }
      }
    } else if (move.kind === 'melee' || move.kind === 'area' || move.kind === 'charge' || move.kind === 'line') {
      if (ms >= first * 0.8 && previousMs < last && move.speed > 0) boss = { ...boss,
        ...moveWithCollisions(boss, Math.cos(boss.aimAngle) * move.speed * Math.min(1.35, tuning.speed) * dt / 1000,
          Math.sin(boss.aimAngle) * move.speed * Math.min(1.35, tuning.speed) * dt / 1000) };
      if (ms >= first && previousMs < last && player.action !== 'dash') {
        const dx = player.x - boss.x, dy = player.y - boss.y;
        const hit = move.kind === 'area' ? Math.hypot(dx, dy) < move.range : move.kind === 'charge' ? Math.hypot(dx, dy) < move.range * 0.65
          : move.kind === 'line' ? dx * boss.facingX > -12 && dx * boss.facingX < move.range && Math.abs(dy) < move.halfWidth
          : dx * boss.facingX > -14 && Math.abs(dy) < move.halfWidth && Math.hypot(dx, dy) < move.range;
        if (hit && attackPathClear(boss, player)) hurtPlayer(state, boss.damage ?? 1);
      }
    }
    if (previousMs < last && ms >= last) {
      if (boss.id === 'guardian' && move.kind !== 'teleport')
        stopActionSound(state.events,move.clip === 'attack' ? 'guardianLasers' : move.clip === 'blast' ? 'guardianSquare' : 'guardianLaser',boss.entityId!);
      else if (boss.id === 'archer' && move.kind === 'laser') stopActionSound(state.events,'archerShot',boss.entityId!);
      else if (boss.id === 'electrocutioner' && move.clip === 'storm') stopActionSound(state.events,'electroStorm',boss.entityId!);
    }
    if (boss.id === 'dust-jumper' && move.kind === 'jump' ? boss.phaseMs >= dustJumpTimeline(rate,boss.dustCritical).durationMs : ms >= move.durationMs) {
      const nextPattern = boss.pattern + 1;
      if (boss.id === 'dagger-mush' && (boss.comboLeft ?? 0) > 0) {
        boss.comboLeft!--; state.bossActionUntilMs = state.clockMs + Math.max(BOSS_BALANCE.warningMinMs, move.warningMs / rate) + move.durationMs / rate + WAVE_BALANCE.attackGapMs; boss.phase = 'warning'; boss.phaseMs = 0; boss.animationMs = 0;
        boss.aimAngle = boss.attackIndex === 2 ? boss.aimAngle + Math.PI : Math.atan2(player.y - boss.y, player.x - boss.x);
        if (Math.abs(Math.cos(boss.aimAngle)) > 0.1) boss.facingX = Math.sign(Math.cos(boss.aimAngle));
      } else {
        if (boss.id === 'dagger-mush') boss.comboLeft = nextPattern % 3 === 0 ? 1 : 0;
        boss = { ...boss, phase: 'recover', phaseMs: 0, animationMs: 0, attackRootX: 0, pattern: nextPattern };
      }
    }
  }
  return boss;
}

/** Purgatorio owns only encounter scheduling; all combat, animation, collision,
 * rewards and audio above remain the exact shared survival implementation. */
function advancePurgatorio(state: SurvivalState, player: PlayerState, field: FlowField, dt: number): void {
  'worklet';
  const run = state.purgatorio!;
  const encounter = state.encounter;
  encounter.remaining = 0; state.pendingBoss = false;
  // City events and the normal 5/10 calendar never participate in this mode.
  state.world.ship = null; state.world.zone = null;
  if (run.phase === 'defeated' && !state.boss && !state.partner && !state.minibosses.length) {
    if (run.kind === 'single') { state.frenesis = endFrenesis(state.frenesis); state.mode = 'won'; return; }
    run.currentId = nextPurgatorioEnemy(run); run.number = run.cleared + 1;
    run.phase = 'between'; run.elapsedMs = 0; run.retryAtMs = 0;
    encounter.wave = run.number; encounter.phase = 'intermission';
    return;
  }
  if (run.phase === 'between') {
    run.elapsedMs = Math.min(PURGATORIO_CONFIG.transitionMs, run.elapsedMs + dt);
    if (run.elapsedMs < PURGATORIO_CONFIG.transitionMs || state.clockMs < run.retryAtMs || !canStartSpecial(state, 'purgatorio')) return;
    const position = findSpawn(state, player, field, true);
    if (position && beginSpecial(state, run.currentId, position, player, 'purgatorio', field)) {
      run.phase = 'combat'; encounter.wave = run.number; encounter.phase = 'clearing';
    } else run.retryAtMs = state.clockMs + PURGATORIO_CONFIG.spawnRetryMs;
    return;
  }
  if (run.phase !== 'combat' || !hasLivingSpecial(state) || state.presentation) return;
  const rate = purgatorioTuning(run.number, state.difficulty).pressureRate;
  state.world.reinforcementMs = Math.max(0, state.world.reinforcementMs - dt);
  if (!state.world.reinforcementMs) {
    const count = encounter.enemies.filter(n=>n.active && n.action !== 'death').length;
    if (count < WORLD_EVENT_CONFIG.pressureLimit[state.difficulty]) spawnCommon(state, player, field);
    state.world.reinforcementMs = WORLD_EVENT_CONFIG.pressureMs[state.difficulty] / rate;
  }
}

// The actor renderer has no completion callback. Authored clip durations are
// the deterministic fallback, advanced only by the foreground presentation clock.
function advanceEnding(current: SurvivalState, dt: number): SurvivalState {
  'worklet';
  const ending = current.ending;
  if (!ending || ending.ready || !dt) return current;
  const elapsedMs = ending.elapsedMs + dt;
  const delay = ending.kind === 'death' ? END_SEQUENCE.deathDelayMs : END_SEQUENCE.victoryDelayMs;
  const corpse = (b: BossState | null): BossState | null => { 'worklet'; return b?.phase === 'death' ? b.phaseMs + dt >= ENEMY_DEFS[b.id].deathDurationMs ? null : { ...b, phaseMs: b.phaseMs + dt, animationMs: b.animationMs + dt } : b; };
  return { ...current, ending: { ...ending, elapsedMs, ready: elapsedMs >= ending.animationMs + delay },
    boss: corpse(current.boss), partner: corpse(current.partner), minibosses: current.minibosses.map(b => corpse(b)).filter((b): b is BossState => b !== null),
    invulnerableMs: 0, phaseFlashMs: 0 };
}

export function advanceSurvival(current: SurvivalState, before: PlayerState, player: PlayerState, field: FlowField, elapsedMs: number, combatView?: SurvivalState['combatView']): SurvivalState {
  'worklet';
  const dt = Math.max(0, Math.min(40, elapsedMs));
  if (current.ending) return advanceEnding(current.droidGroup ? {...current,droidGroup:undefined} : current, dt);
  if ((current.mode==='dead'||current.mode==='won')&&(current.world.optional?.active||(current.world.optional?.visibility??0)>0||current.world.optional?.notice||(current.world.optional?.pendingCharge??0)>0)){
    return {...current,frenesis:endFrenesis(current.frenesis),world:{...current.world,optional:clearOptionalEvents(current.world.optional)},encounter:{...current.encounter,enemies:current.encounter.enemies.map(n=>n.eventOwner?emptyNpc():n)}};
  }
  if ((current.mode === 'dead' || current.mode === 'won') && current.frenesis?.active) return { ...current, frenesis: endFrenesis(current.frenesis) };
  if(current.droidGroup&&(current.mode==='dead'||current.mode==='won'))return {...current,droidGroup:undefined};
  if (!dt || current.mode !== 'playing') return current;
  if (current.presentation && current.boss) {
    const intro = current.presentation, elapsed = intro.elapsedMs + dt, finished = elapsed >= intro.durationMs;
    // Freeze all combat/spawn timers. Movement and dash remain responsive and
    // harmless; a pause/background also stops this simulation-owned timeline.
    return { ...current, presentation: finished ? null : { ...intro, elapsedMs: elapsed },
      boss: { ...current.boss, phase: finished ? 'recover' : 'intro', phaseMs: finished ? 0 : Math.min(SURVIVAL_CONFIG.introMs, elapsed), animationMs: elapsed },
      partner: current.partner ? { ...current.partner, phase: finished ? 'recover' : 'intro', phaseMs: finished ? 0 : Math.min(SURVIVAL_CONFIG.introMs, elapsed), animationMs: elapsed } : null,
      lastAttackSerial: player.attackSerial, lastDashCooldown: player.dashCooldownMs };
  }
  const tuning = current.purgatorio ? purgatorioTuning(current.purgatorio.number, current.difficulty) : difficultyTuning(current.encounter.wave, current.difficulty);
  const state: SurvivalState = { ...current, missions: { ...(current.missions ?? createMissionTelemetry()) }, stats: { ...(current.stats ?? createRunStats()) }, frenesis: advanceFrenesis(current.frenesis ?? createFrenesis(), dt), purgatorio: current.purgatorio ? { ...current.purgatorio } : null, encounter: { ...current.encounter, enemies: [...current.encounter.enemies] },
    world: { ...current.world, optional:current.world.optional?{...current.world.optional,
      active:current.world.optional.active?{...current.world.optional.active,points:current.world.optional.active.points.map(p=>({...p}))}:null,
      notice:current.world.optional.notice?{...current.world.optional.notice}:null}:createOptionalEvents(current.encounter.randomSeed), zone: current.world.zone ? { ...current.world.zone } : null, ship: current.world.ship ? { ...current.world.ship } : null,
      damageNotice: current.world.damageNotice && current.world.damageNotice.elapsedMs + dt < WORLD_EVENT_CONFIG.captureDamageNoticeMs
        ? { ...current.world.damageNotice, elapsedMs: current.world.damageNotice.elapsedMs + dt } : null },
    partner: current.partner ?? null, combatView: combatView ?? current.combatView,
    hazards: [...(current.hazards ?? [])], stunMs: Math.max(0, (current.stunMs ?? 0) - dt),
    poisonMs: Math.max(0, (current.poisonMs ?? 0) - dt), poisonTickMs: Math.max(0, (current.poisonTickMs ?? 0) - dt),
    phaseFlashMs: Math.max(0, (current.phaseFlashMs ?? 0) - dt), npcBoostMs: Math.max(0, (current.npcBoostMs ?? 0) - dt),
    boss: current.boss, minibosses: [...current.minibosses], upgrades: { ...current.upgrades }, projectiles: [], orbs: [...current.orbs], chests: [...current.chests],
    events: { ...current.events }, clockMs: current.clockMs + dt, invulnerableMs: Math.max(0, current.invulnerableMs - dt), rewardX: player.x, rewardY: player.y };
  applyCapturePenalty(state);
  if (current.poisonMs > 0 && state.poisonTickMs <= 0 && hurtPlayer(state, BOSS_BALANCE.poisonDamage)) state.poisonTickMs = BOSS_BALANCE.poisonIntervalMs;
  if (state.poisonMs === 0) state.poisonTickMs = 0;
  if (state.hp === 0) return state;
  if (player.attackSerial > state.lastAttackSerial) { state.events.attack++; state.lastAttackSerial = player.attackSerial; }
  if (before.dashCooldownMs > current.lastDashCooldown + 1 || player.frenesisBlink && !before.frenesisBlink) state.events.dash++;
  state.lastDashCooldown = player.dashCooldownMs;
  const nearby: Record<string, Npc[]> = {};
  for (const npc of current.encounter.enemies) if (npc.active && npc.action !== 'death') {
    const key = Math.floor(npc.x / 32) + ":" + Math.floor(npc.y / 32);
    (nearby[key] ?? (nearby[key] = [])).push(npc);
  }
  const encounter = state.encounter;
  encounter.enemies = encounter.enemies.map((raw): Npc => {
    let npc = raw as CommonNpc;
    if (!npc.active || state.hp === 0) return npc;
    const ms = npc.actionMs + dt, kind = npc.kind ?? 'ghoul';
    if (npc.action === 'death') {
      const animation = npcAnimation(npc);
      const duration = animation.frames * 1000 / animation.fps;
      return ms >= duration ? emptyNpc() : { ...npc, actionMs: ms };
    }
    if ((!before.frenesis || state.frenesis.active) && swordHitsNpc(before, player, npc)) {
      const amount=Math.min(npc.hp??1,before.frenesis?FRENESIS.spinDamage:1),hp=(npc.hp??1)-amount;
      state.frenesis=chargeFrenesis(state.frenesis,amount,hp<=0);
      npc={...npc,hp,lastHitSerial:player.attackSerial};
      if(hp<=0){
      encounter.defeated++; state.events.kill++; state.stats.npcKills++; countSpinKill(state,player);
      dropOrb(state, npc.x, npc.y, kind === 'ghoul' ? 2 : kind === 'spitter' ? 3 : 4);
      return { ...npc, action: 'death', actionMs: 0, lastHitSerial: player.attackSerial };
      }
    }
    if (npc.action === 'spawn' || npc.action === 'wake') {
      const animation = NPC_ANIMATIONS[npc.action];
      const duration = kind === 'ghoul' ? animation.frames * 1000 / animation.fps : 350;
      return ms < duration ? { ...npc, actionMs: ms } : { ...npc, action: npc.action === 'spawn' ? 'wake' : 'move', actionMs: 0 };
    }
    if (Math.hypot(player.x - npc.x, player.y - npc.y) < 23 && player.action !== 'dash') hurtPlayer(state);
    return moveEnemy(npc, player, nearby, field, dt, state.clockMs, tuning.speed * (npc.eliteSpeed??1) * (state.npcBoostMs > 0 ? BOSS_BALANCE.npcBoostMultiplier : 1));
  });
  if (state.mode === 'dead') { state.encounter.enemies = state.encounter.enemies.map(n => n.eventOwner ? emptyNpc() : n); return state; }
  // Summons are separate from the common-NPC pool, so their HP and shield rules
  // cannot turn a common one-hit kill into a multi-hit enemy.
  let existingMinis = [...state.minibosses];
  const oldBoss = state.boss, oldPartner = state.partner;
  if (state.boss) state.boss = advanceBoss(state, state.boss, before, player, field, dt);
  if (state.hp === 0) return state;
  if (state.partner) state.partner = advanceBoss(state, state.partner, before, player, field, dt);
  if (state.hp === 0) return state;
  const newMinis = state.minibosses.slice(existingMinis.length);
  state.minibosses = [];
  for (const mini of existingMinis) {
    if(mini.cloneOf&&(!state.boss||state.boss.entityId!==mini.cloneOf||state.boss.hp<=0)){stopOwnerSounds(state.events,mini.entityId!);continue;}
    if (state.hp === 0) { state.minibosses.push(mini); continue; }
    const next = advanceBoss(state, mini, before, player, field, dt);
    if (next) state.minibosses.push(next);
  }
  state.minibosses.push(...newMinis.filter(m=>!m.cloneOf||state.boss?.entityId===m.cloneOf&&state.boss.hp>0));
  const group=state.droidGroup;
  if(group&&!group.rewarded&&group.killed.length&&!(state.boss?.packRemaining??0)&&![state.boss,...state.minibosses].some(b=>b?.groupId===group.id&&b.hp>0)){
    enqueueChest(state,group.x,group.y,'upgrade');state.droidGroup={...group,rewarded:true};
  }
  const livingPack = (state.boss?.packRemaining ?? 0) > 0 || state.minibosses.some(m => m.packMember && m.hp > 0 && m.phase !== 'death');
  // Keep each member's identity/max HP after its death animation, so the pair
  // cannot accidentally become two encounters or retrigger the survivor heal.
  if (!state.boss && oldBoss && (state.partner?.hp || livingPack)) state.boss = { ...oldBoss, hp: 0, phase: 'death', phaseMs: oldBoss.phaseMs + dt, corpseHidden: true };
  if (!state.partner && oldPartner && (state.boss?.hp ?? 0) > 0) state.partner = { ...oldPartner, hp: 0, phase: 'death', phaseMs: oldPartner.phaseMs + dt, corpseHidden: true };
  const defeated = Boolean((state.boss || oldBoss) && (state.boss?.hp ?? 0) <= 0 && (state.partner?.hp ?? 0) <= 0 && !livingPack);
  if (defeated) {
    const t=state.missions!;
    if(!t.specialCounted){
      if(t.specialBoss&&t.damage===t.specialDamage){if(state.difficulty==='hard')t.perfectHard++;if(state.difficulty==='dystopia'&&state.maxHp===1)t.perfectImpossible++;}
      t.specialCounted=true;
    }
    // Normal skeleton supports and all attacks/statuses belong to their encounter.
    state.minibosses = state.minibosses.filter(m => m.packMember && m.phase === 'death');
    state.hazards = []; state.poisonMs = 0; state.poisonTickMs = 0; state.stunMs = 0; state.npcBoostMs = 0;
    if (state.purgatorio?.phase === 'combat' && state.hp > 0) {
      const run = state.purgatorio;
      run.phase = 'defeated'; run.cleared++; run.lastClearedId = run.currentId;
      state.encounter.enemies = state.encounter.enemies.map(() => emptyNpc());
      state.minibosses = state.minibosses.filter(m => m.packMember && m.phase === 'death'); state.bossActionUntilMs = 0;
      if (run.kind === 'single') {
        const corpses = [state.boss, state.partner, ...state.minibosses];
        const animationMs = corpses.reduce((ms, b) => Math.max(ms, b ? ENEMY_DEFS[b.id].deathDurationMs - b.phaseMs : 0), 0);
        state.droidGroup=undefined;state.mode = 'won'; state.ending = { kind: 'victory', elapsedMs: 0, animationMs, ready: false };
        state.frenesis = endFrenesis(state.frenesis); state.presentation = null;
        state.projectiles = []; state.world.zone = null; state.world.ship = null;
        state.world.optional = clearOptionalEvents(state.world.optional);
        return state;
      }
    }
  }
  if(state.droidGroup?.rewarded&&!state.boss&&!state.minibosses.some(m=>m.groupId===state.droidGroup!.id))state.droidGroup=undefined;
  if (!state.boss && state.partner?.hp === 0 && state.partner.phaseMs >= ENEMY_DEFS[state.partner.id].deathDurationMs) state.partner = null;
  if (!defeated && state.mode === 'playing') advanceHazards(state, player, field, dt);
  const radius = SURVIVAL_CONFIG.pickupRadius * (1 + state.upgrades.magnet * UPGRADE_EFFECTS.magnet);
  const liveOrbs: Orb[] = [];
  for (const orb of state.orbs) {
    const lifeMs = orb.lifeMs - dt, dx = player.x - orb.x, dy = player.y - orb.y, distance = Math.hypot(dx, dy);
    if (lifeMs <= 0) continue;
    if (distance < 18) { state.xp += orb.value; state.events.pickup++; continue; }
    if (distance < radius) {
      const step = Math.min(distance, 300 * dt / 1000);
      liveOrbs.push({ ...orb, x: orb.x + dx / distance * step, y: orb.y + dy / distance * step, lifeMs });
    } else liveOrbs.push({ ...orb, lifeMs });
  }
  state.orbs = liveOrbs;
  if (state.hp === 0) {state.world.optional=clearOptionalEvents(state.world.optional);state.encounter.enemies=state.encounter.enemies.map(n=>n.eventOwner?emptyNpc():n);return state;}
  if (state.tutorial) return state; // Tutorial owns finite spawns and progression, reusing this combat only.
  if (state.purgatorio) {
    advancePurgatorio(state, player, field, dt);
  } else {
    advanceOptionalEvents(state,player,field,dt);
    if (encounter.phase === 'intermission') {
      encounter.timerMs = Math.max(0, encounter.timerMs - dt);
      if (encounter.timerMs === 0 && !(state.world.optional.active?.kind==='elite'&&state.world.optional.active.phase==='warning')) {
        if(wavePlan(encounter.wave+1,state.difficulty).boss&&state.world.optional.active){finishOptionalEvent(state,false,true);state.world.optional.visibility=0;}
        state.missions!.waveDamage=state.missions!.damage;
        encounter.wave++; encounter.remaining = wavePlan(encounter.wave, state.difficulty).count;
        encounter.phase = 'spawning'; encounter.spawnMs = 0;
        state.pendingBoss = wavePlan(encounter.wave,state.difficulty).boss !== null && canStartSpecial(state,'scheduled');
        state.world.specialDeadlineMs = state.clockMs + WORLD_EVENT_CONFIG.specialSpawnDeadlineMs;
        state.world.specialRetryAtMs = 0; state.events.wave++;
      }
    }
    advanceWorldEvents(state, player, field, dt);
    if (state.pendingBoss && (!wavePlan(encounter.wave,state.difficulty).boss || !canStartSpecial(state,'scheduled') || (state.world.specialDeadlineMs > 0 && state.clockMs > state.world.specialDeadlineMs))) state.pendingBoss = false;
    if (encounter.phase === 'spawning') {
      encounter.spawnMs = Math.max(0, encounter.spawnMs - dt);
      if (state.pendingBoss && state.clockMs >= state.world.specialRetryAtMs) {
        const position = findSpawn(state,player,field,true);
        if (position) beginSpecial(state,selectEnemy(state,wavePlan(encounter.wave,state.difficulty).boss!,false),position,player,'scheduled',field);
        else state.world.specialRetryAtMs = state.clockMs + 200;
      }
      // A busy/failed special attempt never blocks common spawns or accumulates
      // past scheduled bosses. Only the short existing presentation suspends them.
      if (!state.presentation && encounter.remaining > 0 && encounter.spawnMs === 0) {
        if (spawnCommon(state,player,field)) {
          encounter.remaining--;
          const plan=wavePlan(encounter.wave,state.difficulty),spawned=plan.count-encounter.remaining;
          encounter.spawnMs=spawned%plan.groupSize===0?plan.groupPauseMs:plan.intervalMs;
        } else encounter.spawnMs=200;
      }
      if (!encounter.remaining && !state.pendingBoss) encounter.phase='clearing';
    }
    if (hasLivingSpecial(state) && !state.presentation && encounter.remaining === 0) {
      state.world.reinforcementMs = Math.max(0,state.world.reinforcementMs-dt);
      if (!state.world.reinforcementMs) {
        const count=encounter.enemies.filter(n=>n.active&&n.action!=='death').length;
        if (count<WORLD_EVENT_CONFIG.pressureLimit[state.difficulty]) spawnCommon(state,player,field);
        state.world.reinforcementMs=WORLD_EVENT_CONFIG.pressureMs[state.difficulty];
      }
    }
    if (encounter.phase === 'clearing' && state.world.ship?.phase !== 'alarm' && !state.boss && !state.partner && !state.minibosses.length && !encounter.enemies.some(npc => npc.active && npc.action !== 'death')) {
      const t=state.missions!;t.streak=t.damage===t.waveDamage?t.streak+1:0;t.bestStreak=Math.max(t.bestStreak,t.streak);
      state.stats.wavesCleared++;
      encounter.phase = 'intermission'; encounter.timerMs = SURVIVAL_CONFIG.intermissionMs;
      state.projectiles = [];
    }
  }
  resolveProgress(state);
  if (state.mode === 'playing') { advanceChests(state, player, dt); resolveProgress(state); }
  return state;
}
