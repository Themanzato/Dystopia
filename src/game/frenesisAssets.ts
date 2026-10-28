import type { PlayerState } from './player';
import { FRENESIS, type FrenesisState } from './frenesis';

// Original horizontal strips, visually audited at 140x46 per cell. Alpha below
// 128 includes faint guide pixels: the visible feet stay at (66,44), not center.
export const FRENESIS_SOURCES = [
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Idle Gltich.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Run.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Slash 1.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Slash 2.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Glitch Sweep.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Glitch Out.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Glitch Slices.png'),
  require('../../assets/assets/characters/Glitch Samurai/Glitch Samurai-Jump Glitch.png'),
] as const;
export const FRENESIS_CELL = { width: 140, height: 46, pivotX: 66, pivotY: 44, scale: 1.75 };
export const FRENESIS_CLIPS = [{frames:11,fps:11},{frames:12,fps:16},{frames:7,fps:20},{frames:5,fps:18},{frames:6,fps:25},{frames:5,fps:16},{frames:11,fps:20},{frames:4,fps:25}];
// The normal sword clips point LEFT; run and the radial spin retain their original orientation.
export const FRENESIS_AUTHORED_FACING=[1,1,-1,-1,1,1,1,1] as const;
export function frenesisFrame(p: PlayerState, f?: FrenesisState) {
  'worklet';
  const blink = f?.active ? f.teleport : null;
  if (blink) {
    const ms = blink.elapsedMs, travelEnd = FRENESIS.blinkOutMs + FRENESIS.blinkTravelMs;
    const image = ms < FRENESIS.blinkOutMs ? 5 : 7;
    const frame = ms < FRENESIS.blinkOutMs ? Math.min(4, Math.floor(ms / FRENESIS.blinkOutMs * 5))
      : ms < travelEnd ? Math.min(3, Math.floor((ms - FRENESIS.blinkOutMs) / FRENESIS.blinkTravelMs * 4))
        : Math.max(0, 3 - Math.floor((ms - travelEnd) / (FRENESIS.effectMs - travelEnd) * 4));
    return { image, authoredFacing:FRENESIS_AUTHORED_FACING[image], source: { x: frame * 140, y: 0, width: 140, height: 46 } };
  }
  // One complete authored body clip: normal slashes OR the held spin.
  const image=p.action==='dash'?4:p.action==='attack'?(p.frenesisAttack==='slices'?6:p.frenesisAttack==='slash2'?3:2):p.action==='run'||p.action==='walk'?1:0;
  const clip=FRENESIS_CLIPS[image];
  const index=p.action==='attack'||p.action==='dash'?Math.min(clip.frames-1,Math.floor(p.actionMs*clip.fps/1000))
    :Math.floor(p.actionMs*clip.fps*(image===1?Math.min(1.5,p.speedMultiplier??1):1)/1000)%clip.frames;
  return { image, authoredFacing:FRENESIS_AUTHORED_FACING[image], source: { x: index * 140, y: 0, width: 140, height: 46 } };
}
