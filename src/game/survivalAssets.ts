import { attackFrameRoot, banditExitRoot } from './enemyMotion';
import { bossAttack } from './bossAttacks';
import { dustJumpTimeline } from './dustJumper';
import type { Box } from './map';
import { ENEMY_DEFS, type EnemyId } from './enemyCatalog';
import { ENEMY_VISUALS } from './enemyAnimations';
import { plagueFrame, type PlagueVariant } from './plagueAssets';

export const SURVIVAL_ASSETS = {
  shielder: require('../../assets/assets/enemies/mini bosses/Shielder/Shielder 129x46 Sprite Sheet.png'),
  rockIdle: require('../../assets/assets/bosses/rock boss/idle.png'),
  rockMelee: require('../../assets/assets/bosses/rock boss/Melee attack.png'),
  rockWake: require('../../assets/assets/bosses/rock boss/wake.png'),
  rockMove: require('../../assets/assets/bosses/rock boss/move.png'),
};
export const CHEST_ASSET = require('../../assets/assets/escenario/Chests/Chest 3-Silver.png');
export const CHEST_SOURCE = { x: 0, y: 0, width: 22, height: 26 };
// Original strip: 0–23 closed/light activity, 24–31 opening flash, 32–39
// raised lid and fading particles. Never crop two adjacent 22px chests as one.
export const CHEST_OPENING_FRAMES = 16;
export function chestFrame(phase: 'closed' | 'opening' | 'reward' = 'closed', phaseMs = 0, openingMs = 900): Box {
  'worklet';
  const index = phase === 'closed' ? 0 : phase === 'reward' ? 39 : 24 + Math.min(15, Math.floor(Math.max(0, phaseMs) / Math.max(1, openingMs) * 16));
  return { x: index * 22, y: 0, width: 22, height: 26 };
}
export type BossVisualState = { id: EnemyId; phase: 'intro' | 'warning' | 'attack' | 'recover' | 'death'; phaseMs: number; animationMs: number; attackIndex?: number; attackRate?: number; preparationMs?: number; dustCritical?:boolean; plague?: { variant: PlagueVariant } };
export function bossFrame(boss: BossVisualState): { image: number; source: Box; scale: number; pivotX: number; pivotY: number; authoredFacing: number; visible: boolean } {
  'worklet';
  if (boss.id === 'the-plague') return plagueFrame(boss);
  const visual = ENEMY_VISUALS[boss.id], definition = ENEMY_DEFS[boss.id];
  const move = bossAttack(boss.id, boss.attackIndex ?? 0);
  const rate = boss.attackRate ?? 1;
  const fraction = Math.max(0, boss.phaseMs) / (move.durationMs / rate);
  const secondary = boss.phase === 'attack' && move.followup && fraction >= (move.split ?? 1);
  const attackClip = secondary ? visual[move.followup!] : visual[move.clip];
  let clip = boss.phase === 'attack' ? attackClip ?? visual.attack : boss.phase === 'death' ? visual.death
    : boss.phase === 'intro' ? visual.intro ?? visual.idle : boss.phase === 'warning' ? visual.charge ?? visual.idle : boss.phase === 'recover' ? visual.move : visual.idle;
  const once = boss.phase === 'attack' || boss.phase === 'death' || (boss.phase === 'intro' && Boolean(visual.intro));
  const duration = boss.phase === 'attack' ? move.durationMs / rate : boss.phase === 'death' ? definition.deathDurationMs : 1100;
  const clipFraction = secondary ? (fraction - (move.split ?? 0)) / (1 - (move.split ?? 0)) : fraction / (move.followup ? (move.split ?? 1) : 1);
  let frame = boss.phase === 'attack' ? Math.min(clip.frames - 1, Math.floor(clipFraction * clip.frames)) : once ? Math.min(clip.frames - 1, Math.floor(Math.max(0, boss.phaseMs) / Math.max(1, duration) * clip.frames))
    : Math.floor(Math.max(0, boss.animationMs) * 12 / 1000) % clip.frames;
  if(boss.id==='electrocutioner'&&boss.phase==='warning'){
    clip=move.clip==='storm'?visual.stormCharge!:move.kind==='teleport'?visual.idle:visual.charge!;
    frame=Math.min(clip.frames-1,Math.floor(boss.phaseMs/Math.max(1,move.warningMs/rate)*clip.frames));
  }
  if (boss.id === 'evil-sage' && boss.phase === 'warning' && boss.preparationMs) {
    frame = Math.min(clip.frames - 1, Math.floor(Math.max(0, boss.phaseMs) / boss.preparationMs * clip.frames));
  }
  let visible = true;
  if (boss.id === 'dust-jumper' && boss.phase === 'attack' && move.kind === 'jump') {
    const jump = dustJumpTimeline(rate,boss.dustCritical);
    const landing = boss.phaseMs >= jump.landingStartMs;
    clip = (landing ? visual.landing : visual.leap) ?? visual.attack;
    visible = boss.phaseMs < jump.takeoffMs || landing;
    const progress = landing ? (boss.phaseMs - jump.landingStartMs) / jump.landingMs : boss.phaseMs / jump.takeoffMs;
    frame = Math.max(0, Math.min(clip.frames - 1, Math.floor(progress * clip.frames)));
  }
  return { image: clip.image, source: { x: clip.x + frame * clip.stepX, y: clip.y + frame * clip.stepY, width: clip.width, height: clip.height },
    scale: clip.scale, pivotX: clip.pivotX + (clip === visual.intro ? banditExitRoot(boss.id, frame / clip.frames, true) : 0) + (boss.phase === 'attack' ? attackFrameRoot(boss.id, frame, secondary ? move.followup! : move.clip) : 0), pivotY: clip.pivotY, authoredFacing: clip.authoredFacing, visible };
}
