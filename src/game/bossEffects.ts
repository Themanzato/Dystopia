/** Original, audited pixel-art effects. No encoded sheet is modified. */
export const BOSS_FX_ASSETS = {
  electric: require('../../assets/assets/FX/Electric Hit 3.png'),
  sageDark: require('../../assets/assets/enemies/mini bosses/Evil sage/evil shockwave.png'),
  sageCyan: require('../../assets/assets/enemies/mini bosses/Evil sage/shockwave VFX 137x39.png'),
  beam: require('../../assets/assets/enemies/mini bosses/Archer/attack.png'),
  bomb: require('../../assets/assets/bosses/Dust Jumper/Dusk Bomb/Dusk Bomb.png'),
  slam: require('../../assets/assets/bosses/Dust Jumper/Dust Jumper/Slam VFX 98x103.png'),
  shock: require('../../assets/assets/enemies/mini bosses/Shock Sweeper/VFX for Slam.png'),
  bow: require('../../assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Bow sprite 114x35.png'),
  volley: require('../../assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Volley VFX 74x111.png'),
  poison: require('../../assets/assets/FX/Poison 2.png'),
  indicator: require('../../assets/assets/bosses/Dust Jumper/Dust Jumper/Indicator Sprite Sheet 21x10.png'),
  electroVolley:require('../../assets/assets/bosses/Electrocutioner/Volley Projectile 157x122.png'),
};
export const BOSS_FX_KEYS = ['electric', 'sageDark', 'sageCyan', 'beam', 'bomb', 'slam', 'shock', 'bow', 'volley', 'poison', 'indicator','electroVolley'] as const;
export type BossFxKey = 'shielderBall' | 'sageDark' | 'sageCyan' | 'archerBeam' | 'rockBeam' | 'dustBomb' | 'dustSlam' | 'dustIndicator' | 'shockSlam' | 'arrow' | 'volley' | 'widowPoison' | 'teleport' | 'electroLightning';
export type BossHazard = {
  id: number; owner: number; kind: 'ball' | 'beam' | 'blast' | 'bomb' | 'arrow' | 'volley' | 'slam' | 'poisonBlast' | 'teleport';
  x: number; y: number; angle: number; radius: number; length: number;
  ageMs: number; warningMs: number; launchMs?: number; markerStartMs?: number; landingStartMs?: number; activeMs: number; damage: number;
  vx?: number; vy?: number; stunMs?: number; poison?: boolean; hit?: boolean;
  fx?: BossFxKey | string; scale?: number; visualLift?: number; npcBurst?: number; followMs?: number; followOffsetX?: number; followOffsetY?: number; emitted?: boolean;
  halfHeight?: number;
  damageMs?:number;
  travelSpeed?: number; maxLength?: number;
};
export type FxClip = { image: number; x: number; y: number; width: number; height: number; frames: number; columns: number; stepX: number; stepY: number; pivotX: number; pivotY: number; scale: number };
export const BOSS_FX_CLIPS = {
  electroLightning:{image:11,x:0,y:0,width:157,height:122,frames:18,columns:18,stepX:157,stepY:0,pivotX:73,pivotY:110,scale:1.5},
  shielderBall: { image: 0, x: 82 * 2, y: 0, width: 82, height: 65, frames: 1, columns: 1, stepX: 0, stepY: 0, pivotX: 41, pivotY: 32, scale: 1 },
  sageDark: { image: 1, x: 0, y: 0, width: 137, height: 39, frames: 13, columns: 14, stepX: 137, stepY: 0, pivotX: 68, pivotY: 32, scale: 2 },
  sageCyan: { image: 2, x: 0, y: 0, width: 137, height: 39, frames: 13, columns: 4, stepX: 137, stepY: 39, pivotX: 68, pivotY: 32, scale: 2 },
  dustBomb: { image: 4, x: 0, y: 0, width: 32, height: 37, frames: 8, columns: 8, stepX: 32, stepY: 0, pivotX: 16, pivotY: 25, scale: 3 },
  dustIndicator: { image: 10, x: 0, y: 0, width: 21, height: 10, frames: 9, columns: 9, stepX: 21, stepY: 0, pivotX: 10, pivotY: 5, scale: 3 },
  dustSlam: { image: 5, x: 196, y: 0, width: 98, height: 103, frames: 8, columns: 8, stepX: 98, stepY: 0, pivotX: 49, pivotY: 86, scale: 2.5 },
  shockSlam: { image: 6, x: 0, y: 0, width: 88, height: 30, frames: 10, columns: 1, stepX: 0, stepY: 30, pivotX: 44, pivotY: 29, scale: 2 },
  // The dark arrow is already painted inside the bow strip's release cell.
  // Full horizontal arrow as authored in Archer Bandit's bow sheet, cell 10.
  // Alpha bounds [5,6]-[113,34] preserve its head and feathered tail.
  arrow: { image: 7, x: 1140 + 5, y: 35 + 6, width: 109, height: 29, frames: 1, columns: 1, stepX: 0, stepY: 0, pivotX: 54, pivotY: 14, scale: 0.9 },
  volley: { image: 8, x: 0, y: 0, width: 74, height: 111, frames: 8, columns: 8, stepX: 74, stepY: 0, pivotX: 37, pivotY: 110, scale: 1.5 },
  widowPoison: { image: 9, x: 0, y: 0, width: 82, height: 65, frames: 13, columns: 14, stepX: 82, stepY: 0, pivotX: 41, pivotY: 43, scale: 2.5 },
  teleport: { image: 0, x: 0, y: 0, width: 82, height: 65, frames: 8, columns: 8, stepX: 82, stepY: 0, pivotX: 41, pivotY: 32, scale: 2 },
} satisfies Partial<Record<BossFxKey, FxClip>>;
export const BOSS_BEAM = { image: 3, tile: { x: 100, y: 111, width: 16, height: 5 }, cap: { x: 86, y: 111, width: 14, height: 5 } };
export type FxDraw = { image: number; source: { x: number; y: number; width: number; height: number }; x: number; y: number; pivotX: number; pivotY: number; scale: number; angle: number };
export function fxFrame(clip: FxClip, progress: number): FxDraw['source'] {
  'worklet';
  const frame = Math.max(0, Math.min(clip.frames - 1, Math.floor(Math.max(0, Math.min(0.999999, progress)) * clip.frames)));
  return { x: clip.x + (frame % clip.columns) * clip.stepX, y: clip.y + Math.floor(frame / clip.columns) * clip.stepY, width: clip.width, height: clip.height };
}
export function hazardIsActive(hazard: BossHazard): boolean {
  'worklet';
  return hazard.ageMs >= hazard.warningMs && hazard.ageMs < hazard.warningMs + (hazard.damageMs??hazard.activeMs);
}
/** Tiling keeps pixel proportions, including the final partial tile. No gaps or long stretched sprite. */
export function beamDraws(hazard: BossHazard): FxDraw[] {
  'worklet';
  const source = BOSS_BEAM.tile, scale = Math.max(1, Math.round(hazard.radius * 2 / source.height));
  const result: FxDraw[] = [], dx = Math.cos(hazard.angle), dy = Math.sin(hazard.angle);
  const length = Math.max(0, Math.min(3000, hazard.length));
  const capWidth = Math.min(BOSS_BEAM.cap.width, length / scale);
  if (capWidth > 0) result.push({ image: BOSS_BEAM.image, source: { ...BOSS_BEAM.cap, width: capWidth }, x: hazard.x, y: hazard.y,
    scale, angle: hazard.angle, pivotX: 0, pivotY: BOSS_BEAM.cap.height / 2 });
  for (let start = capWidth * scale; start < length && result.length < 192; start += source.width * scale) {
    const width = Math.min(source.width, (length - start) / scale);
    result.push({ image: BOSS_BEAM.image, source: { ...source, width }, x: hazard.x + dx * start, y: hazard.y + dy * start,
      scale, angle: hazard.angle, pivotX: 0, pivotY: source.height / 2 });
  }
  return result;
}
export function hazardDraws(hazard: BossHazard): FxDraw[] {
  'worklet';
  if (hazard.kind === 'beam') return hazardIsActive(hazard) ? beamDraws(hazard) : [];
  const key = hazard.fx ?? (hazard.kind === 'ball' ? 'shielderBall' : hazard.kind === 'bomb' ? 'dustBomb' : hazard.kind === 'volley' ? 'volley' : hazard.kind === 'arrow' ? 'arrow' : hazard.kind === 'poisonBlast' ? 'widowPoison' : hazard.kind === 'slam' ? 'dustSlam' : hazard.kind === 'teleport' ? 'teleport' : 'sageCyan');
  const clip = (BOSS_FX_CLIPS as Record<string, FxClip>)[key];
  if (!clip) return [];
  if (hazard.ageMs >= hazard.warningMs + hazard.activeMs) return [];
  if(key==='electroLightning'){
    const launch=hazard.launchMs??0;
    if(hazard.ageMs<launch){const charge=BOSS_FX_CLIPS.teleport;return [{image:charge.image,source:fxFrame(charge,(Math.floor(hazard.ageMs/120)%3)/charge.frames),x:hazard.x,y:hazard.y,pivotX:charge.pivotX,pivotY:charge.pivotY,scale:.9,angle:0}];}
    const falling=hazard.ageMs<hazard.warningMs;
    const progress=falling?0:(1+(hazard.ageMs-hazard.warningMs)/Math.max(1,hazard.activeMs)*(clip.frames-1))/clip.frames;
    const lift=falling?80*(1-(hazard.ageMs-launch)/Math.max(1,hazard.warningMs-launch)):0;
    return [{image:clip.image,source:fxFrame(clip,progress),x:hazard.x,y:hazard.y-lift,pivotX:clip.pivotX,pivotY:clip.pivotY,scale:clip.scale,angle:0}];
  }
  // Gameplay hitboxes remain in bossHazards; exact target markers are hidden.
  if (key === 'dustSlam' && hazard.ageMs < hazard.warningMs) {
    if(hazard.markerStartMs===undefined||hazard.ageMs<hazard.markerStartMs)return [];
    const marker=BOSS_FX_CLIPS.dustIndicator;
    return [{image:marker.image,source:fxFrame(marker,((hazard.ageMs-hazard.markerStartMs)%600)/600),x:hazard.x,y:hazard.y,
      pivotX:marker.pivotX,pivotY:marker.pivotY,scale:marker.scale,angle:0}];
  }
  if (hazard.kind === 'bomb') {
    if (hazard.ageMs < hazard.warningMs) return [];
    // Skip the authored green targeting square (cell zero). Preserve all seven
    // impact frames at their existing cadence and leave collision timing intact.
    const progress=(1+(hazard.ageMs-hazard.warningMs)/Math.max(1,hazard.activeMs)*(clip.frames-1))/clip.frames;
    return [{ image: clip.image, source: fxFrame(clip, progress), x: hazard.x, y: hazard.y,
      pivotX: clip.pivotX, pivotY: clip.pivotY, scale: hazard.scale ?? clip.scale, angle: 0 }];
  }
  const flying = hazard.kind === 'volley';
  if (hazard.kind === 'volley' && hazard.ageMs < (hazard.launchMs ?? 0)) return [];
  const chargeFrames = key === 'sageDark' || key === 'sageCyan' ? 4 : key === 'shockSlam' ? 5 : key === 'widowPoison' ? 3 : 0;
  if (!flying && chargeFrames === 0 && !hazardIsActive(hazard)) return [];
  const age = Math.max(0, hazard.ageMs - hazard.warningMs), progress = age / Math.max(1, hazard.activeMs);
  // The falling volley starts only at the authored release frame.
  let frameProgress = flying && hazard.ageMs < hazard.warningMs ? 0 : progress;
  if (chargeFrames > 0) frameProgress = (hazard.ageMs < hazard.warningMs
    ? Math.min(chargeFrames - 0.001, hazard.ageMs / Math.max(1, hazard.warningMs) * chargeFrames) : chargeFrames + progress * (clip.frames - chargeFrames)) / clip.frames;
  if (hazard.kind === 'volley' && hazardIsActive(hazard)) frameProgress = (1 + progress * (clip.frames - 1)) / clip.frames;
  const lift = flying && hazard.ageMs < hazard.warningMs ? (1 - Math.min(1, Math.max(0, hazard.ageMs - (hazard.launchMs ?? 0)) / Math.max(1, hazard.warningMs - (hazard.launchMs ?? 0)))) * 145 : (hazard.visualLift ?? 0);
  return [{ image: clip.image, source: fxFrame(clip, frameProgress), x: hazard.x, y: hazard.y - lift,
    pivotX: clip.pivotX, pivotY: clip.pivotY, scale: hazard.scale ?? clip.scale,
    angle: hazard.kind === 'arrow' || hazard.kind === 'ball' ? hazard.angle : 0 }];
}
