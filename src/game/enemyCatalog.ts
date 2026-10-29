/** Authored enemy families. Pure data: safe to capture in the UI worklet runtime.
 * Animation cadences are gameplay tuning; active windows follow authored strike poses.
 * Attack behavior and bounded hazards are configured in bossAttacks/bossBalance.
 */
export const MINIBOSS_IDS = ["shielder", "evil-sage", "archer", "bomb-droid", "dagger-mush", "shock-sweeper", "the-plague"] as const;
export const BOSS_IDS = ["guardian", "skeleton-summoner", "dagger-bandit", "archer-bandit", "dust-jumper", "rock-boss", "tarnished-widow", "electrocutioner"] as const;
export const MINION_IDS = ["skeleton-unarmed", "skeleton-archer", "skeleton-swordsman"] as const;
export type EnemyId = (typeof MINIBOSS_IDS)[number] | (typeof BOSS_IDS)[number] | (typeof MINION_IDS)[number];
export type EnemyDefinition = { name: string; tier: 'mini' | 'boss' | 'minion'; hp: number; speed: number;
  attackDurationMs: number; activeStartMs: number; activeEndMs: number; attackRange: number; attackSpeed: number; deathDurationMs: number };
export const ENEMY_DEFS: Record<EnemyId, EnemyDefinition> = {
  'the-plague': { name: 'The Plague', tier: 'mini', hp: 4, speed: 70, attackDurationMs: 560, activeStartMs: 210, activeEndMs: 420, attackRange: 42, attackSpeed: 220, deathDurationMs: 845 },
  electrocutioner:{name:'Electrocutioner',tier:'boss',hp:54,speed:58,attackDurationMs:2200,activeStartMs:930,activeEndMs:1600,attackRange:105,attackSpeed:0,deathDurationMs:1334},
  "shielder": {"name": "Shielder", "tier": "mini", "hp": 18, "speed": 42, "attackDurationMs": 1000, "activeStartMs": 350, "activeEndMs": 650, "attackRange": 94, "attackSpeed": 150, "deathDurationMs": 1143},
  "evil-sage": {"name": "The Evil Sage", "tier": "mini", "hp": 16, "speed": 55, "attackDurationMs": 1167, "activeStartMs": 250, "activeEndMs": 850, "attackRange": 105, "attackSpeed": 100, "deathDurationMs": 667},
  "archer": {"name": "Archer", "tier": "mini", "hp": 16, "speed": 64, "attackDurationMs": 1167, "activeStartMs": 300, "activeEndMs": 850, "attackRange": 110, "attackSpeed": 95, "deathDurationMs": 500},
  "bomb-droid": {"name": "Bomb Droid", "tier": "mini", "hp": 6, "speed": 72, "attackDurationMs": 1333, "activeStartMs": 500, "activeEndMs": 1000, "attackRange": 85, "attackSpeed": 105, "deathDurationMs": 917},
  "dagger-mush": {"name": "Dagger Mush", "tier": "mini", "hp": 17, "speed": 76, "attackDurationMs": 833, "activeStartMs": 250, "activeEndMs": 650, "attackRange": 106, "attackSpeed": 190, "deathDurationMs": 1000},
  "shock-sweeper": {"name": "Shock Sweeper", "tier": "mini", "hp": 20, "speed": 52, "attackDurationMs": 667, "activeStartMs": 160, "activeEndMs": 500, "attackRange": 115, "attackSpeed": 120, "deathDurationMs": 417},
  "guardian": {"name": "Guardian", "tier": "boss", "hp": 24, "speed": 34, "attackDurationMs": 2000, "activeStartMs": 550, "activeEndMs": 1550, "attackRange": 120, "attackSpeed": 52, "deathDurationMs": 1000},
  "skeleton-summoner": {"name": "Skeleton Summoner", "tier": "boss", "hp": 26, "speed": 38, "attackDurationMs": 1583, "activeStartMs": 500, "activeEndMs": 1000, "attackRange": 116, "attackSpeed": 85, "deathDurationMs": 1417},
  "dagger-bandit": {"name": "Dagger Bandit", "tier": "boss", "hp": 24, "speed": 78, "attackDurationMs": 583, "activeStartMs": 100, "activeEndMs": 420, "attackRange": 115, "attackSpeed": 220, "deathDurationMs": 1333},
  "archer-bandit": {"name": "Archer Bandit", "tier": "boss", "hp": 24, "speed": 60, "attackDurationMs": 1583, "activeStartMs": 450, "activeEndMs": 1150, "attackRange": 110, "attackSpeed": 125, "deathDurationMs": 1333},
  "dust-jumper": {"name": "Dust Jumper", "tier": "boss", "hp": 36, "speed": 64, "attackDurationMs": 750, "activeStartMs": 200, "activeEndMs": 550, "attackRange": 100, "attackSpeed": 180, "deathDurationMs": 1083},
  "rock-boss": {"name": "Rock boss", "tier": "boss", "hp": 120, "speed": 38, "attackDurationMs": 1917, "activeStartMs": 450, "activeEndMs": 1100, "attackRange": 120, "attackSpeed": 125, "deathDurationMs": 1750},
  "tarnished-widow": {"name": "The Tarnished Widow", "tier": "boss", "hp": 88, "speed": 66, "attackDurationMs": 1333, "activeStartMs": 250, "activeEndMs": 900, "attackRange": 125, "attackSpeed": 150, "deathDurationMs": 1083},
  "skeleton-unarmed": {"name": "Skeleton Unarmed", "tier": "minion", "hp": 1, "speed": 65, "attackDurationMs": 750, "activeStartMs": 250, "activeEndMs": 550, "attackRange": 60, "attackSpeed": 90, "deathDurationMs": 1250},
  "skeleton-archer": {"name": "Skeleton Archer", "tier": "minion", "hp": 1, "speed": 58, "attackDurationMs": 750, "activeStartMs": 250, "activeEndMs": 550, "attackRange": 65, "attackSpeed": 85, "deathDurationMs": 1250},
  "skeleton-swordsman": {"name": "Skeleton Swordsman", "tier": "minion", "hp": 1, "speed": 70, "attackDurationMs": 750, "activeStartMs": 250, "activeEndMs": 550, "attackRange": 75, "attackSpeed": 110, "deathDurationMs": 1250},
};
