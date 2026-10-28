import { ENEMY_DEFS, type EnemyId } from './enemyCatalog';
export type BossAttackKind = 'melee' | 'area' | 'line' | 'charge' | 'summon' | 'evade' | 'projectile' | 'explosion' | 'laser' | 'slam' | 'teleport' | 'burrow' | 'volley' | 'jump' | 'lightning';
export type BossAttack = { clip: string; followup?: string; split?: number; kind: BossAttackKind;
  durationMs: number; activeStartMs: number; activeEndMs: number; range: number; halfWidth: number; speed: number; warningMs: number; recoveryMs: number };
const attack = (clip: string, kind: BossAttackKind, durationMs: number, activeStartMs: number, activeEndMs: number, range: number, speed: number, warningMs = 750, recoveryMs = 1150, halfWidth = 45): BossAttack =>
  ({ clip, kind, durationMs, activeStartMs, activeEndMs, range, speed, warningMs, recoveryMs, halfWidth });
export const BOSS_ATTACKS: Partial<Record<EnemyId, BossAttack[]>> = {
  electrocutioner:[attack('release','lightning',750,0,220,40,0,950,1150),attack('storm','area',2200,930,1600,82,0,850,1300),{...attack('tele','teleport',1200,780,800,0,0,850,1150),followup:'intro',split:.65}],
  shielder: [attack('attack','melee',1200,380,720,94,145),attack('range','projectile',1400,580,1080,520,0,850,1400)],
  'evil-sage': [attack('attack','explosion',1200,500,820,115,0,900,1300),attack('attack','explosion',1200,500,820,95,0,1050,1350)],
  archer: [attack('laser','laser',1500,350,1150,1200,0,1000,1400,16),attack('tele','teleport',1000,500,550,0,0,850,1200)],
  'bomb-droid': [attack('attack','area',1333,500,1000,85,105,800,900)],
  'dagger-mush': [attack('attack','charge',833,250,650,85,245,700,1000),attack('spin','charge',1000,240,740,78,285,650,1100),attack('attack','charge',833,250,650,85,260,650,950)],
  'shock-sweeper': [attack('attack','melee',667,160,500,115,120),attack('slam','slam',1200,620,900,110,0,1000,1600)],
  guardian: [attack('attack','area',2000,550,1550,112,0,850,1200),attack('blast','melee',2000,600,1400,130,0,800,1100),attack('laser','line',2000,580,1450,190,0,950,1250,23),attack('tele','teleport',1000,600,650,0,0,850,1150)],
  'skeleton-summoner': [attack('attack','melee',1583,500,1000,116,85,650,1000),attack('summon','summon',1600,650,1150,0,0,800,1000)],
  'dagger-bandit': [attack('attack','melee',583,100,420,115,220,650,900),attack('fang','charge',1667,500,1250,95,270,850,1250),{...attack('evade','burrow',1500,750,1000,0,0,950,1250),followup:'intro',split:0.5}],
  'archer-bandit': [attack('attack','volley',1200,700,1050,74,0,650,1450),{...attack('evade','burrow',1700,850,1150,0,0,950,1300),followup:'intro',split:0.5}],
  // Dust's fixed marker lock and authored takeoff/landing use dustJumpTimeline.
  'dust-jumper': [attack('attack','projectile',900,350,650,400,0,950,1200),{...attack('leap','jump',3700,3220,3460,45,0,1100,1450),followup:'landing',split:3100 / 3700}],
  'rock-boss': [attack('attack','melee',1917,450,1100,120,125,750,1200),{...attack('spin','charge',1250,250,850,95,235,900,1450),followup:'spinEnd',split:0.7},attack('super','laser',2200,650,1900,1200,120,1200,1650,20),attack('reach','line',1750,600,1100,160,30,850,1250,28)],
  'tarnished-widow': [attack('attack','melee',1333,250,900,125,275,750,1100),attack('spit','explosion',1500,650,1050,105,245,1000,1450),{...attack('leap','jump',1700,1090,1380,110,0,1150,1500),followup:'landing',split:0.6}],
};
export function bossAttack(id: EnemyId, index = 0): BossAttack {
  'worklet';
  const list = BOSS_ATTACKS[id];
  if (list) return list[Math.max(0,index)%list.length];
  const s = ENEMY_DEFS[id];
  return {clip:'attack',kind:'melee',durationMs:s.attackDurationMs,activeStartMs:s.activeStartMs,activeEndMs:s.activeEndMs,range:s.attackRange,halfWidth:s.attackRange*0.58,speed:s.attackSpeed,warningMs:650,recoveryMs:900};
}
export function bossAttackCount(id: EnemyId): number { 'worklet'; return BOSS_ATTACKS[id]?.length ?? 1; }
