import { DIFFICULTIES, type Difficulty } from '../game/difficulty';
import { PLAYER_ANIMATIONS, WALK_SPEED } from '../game/player';
import { SWORD_STRIKES } from '../game/combat';
import { workshopBonuses, type WorkshopId } from '../game/workshop';

/** Read-only values for one visual sample. Never a live player or a purchase. */
export function workshopPreviewValues(id: WorkshopId, difficulty: Difficulty) {
  const bonus = workshopBonuses([id], difficulty);
  return { baseHealth: DIFFICULTIES[difficulty].hp, health: DIFFICULTIES[difficulty].hp + bonus.health,
    attackMultiplier: 1 + bonus.attack, moveMultiplier: 1 + bonus.speed,
    charge: bonus.charge, blocked: id === 'field-kit' && bonus.health === 0 };
}
export type WorkshopPreviewValues = ReturnType<typeof workshopPreviewValues>;
const unit = (n: number) => { 'worklet'; return Math.max(0, Math.min(1, n)); };

/** One body/clip at a time. Sampling only returns draw data; no game mutation,
 * timers, rewards, audio or random state are reachable from this module. */
export function sampleWorkshopPreview(id: WorkshopId, elapsedMs: number, values: WorkshopPreviewValues) {
  'worklet';
  const age = Math.max(0, elapsedMs);
  let row = PLAYER_ANIMATIONS.idle.row, frame = Math.floor(age * PLAYER_ANIMATIONS.idle.fps / 1000) % PLAYER_ANIMATIONS.idle.frames;
  let offset = 0, facing = 1, impact = 0, pace = 0;
  const cycle = age % 3000;
  if (id === 'attack-servo') {
    const animation = PLAYER_ANIMATIONS.attack[0], strike = SWORD_STRIKES[0];
    const duration = animation.frames * 1000 / animation.fps / values.attackMultiplier;
    const local = age % (300 + (duration + 160) * 3 + 500) - 300;
    const hit = local % (duration + 160);
    if (local >= 0 && local < (duration + 160) * 3 && hit < duration) {
      row = animation.row; frame = Math.min(animation.frames - 1, Math.floor(hit * animation.fps * values.attackMultiplier / 1000));
      impact = frame >= strike.firstFrame && frame <= strike.lastFrame ? 1 : 0;
      pace = hit / duration;
    }
  } else if (id === 'assault-boots') {
    // Symmetric journeys preserve position at loop boundaries. The display maps
    // world travel to pixels at a fixed ratio, retaining the actual +8% ratio.
    const t = age % 2600, distance = WALK_SPEED * values.moveMultiplier * .24;
    offset = -distance / 2;
    let runAge = 0, running = false;
    if (t >= 200 && t < 1200) { running = true; runAge = t - 200; offset += distance * runAge / 1000; }
    else if (t >= 1200 && t < 1400) offset = distance / 2;
    else if (t >= 1400 && t < 2400) { running = true; runAge = t - 1400; facing = -1; offset = distance / 2 - distance * runAge / 1000; }
    if (running) { row = PLAYER_ANIMATIONS.run.row; frame = Math.floor(runAge * PLAYER_ANIMATIONS.run.fps * values.moveMultiplier / 1000) % PLAYER_ANIMATIONS.run.frames; }
  }
  return { row, frame, offset, facing, impact, pace, opacity: unit(age / 140),
    healthGain: id === 'field-kit' ? unit((cycle - 500) / 350) * (values.health - values.baseHealth) : 0,
    charge: id === 'frenesis-coil' ? unit((cycle - 450) / 700) * values.charge : 0 };
}
