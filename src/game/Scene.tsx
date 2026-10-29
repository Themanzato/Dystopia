import React, { useCallback, useEffect, useMemo } from 'react';
import { Atlas, Fill, FilterMode, Group, MipmapMode, Picture, RadialGradient, Skia, rect, type SkCanvas, type SkColor, type SkImage, type SkPicture, type SkRect } from '@shopify/react-native-skia';
import { useSharedImage as useImage } from '../ui/sharedImages';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { ASSETS } from './assets';
import { ActorLayers, type StaticActorLayers } from './ActorLayers';
import type { RenderActor } from './renderTypes';
import { ANIMATED_PROPS, ARENA, FLOOR_COLOR, OUTSIDE_COLOR, PROPS, WORLD, type Box, type Prop } from './map';

type Sheet = keyof typeof ASSETS;
type LoadedSheets = Record<Sheet, SkImage>;
type AnimatedProp = (typeof ANIMATED_PROPS)[number];
type AnimationGroup = { sheet: Sheet; fps: number; slot: number; props: AnimatedProp[] };
type StaticLayers = { ground: SkPicture; depths: number[]; behind: SkPicture[]; ahead: SkPicture[] };
type SceneryLayer = 'all' | 'behind' | 'ahead';
// These immutable pictures belong to the shared image set, not a game session.
// A restart only replaces actor/state values and reuses the recorded city.
const pictureCache=new WeakMap<SkImage,{sheets:LoadedSheets;static?:StaticLayers;actors?:StaticActorLayers}>();
function cachedLayers(sheets:LoadedSheets,actors:true):StaticActorLayers;
function cachedLayers(sheets:LoadedSheets,actors:false):StaticLayers;
function cachedLayers(sheets:LoadedSheets,actors:boolean):StaticActorLayers|StaticLayers {
  let entry=pictureCache.get(sheets.tiles);
  if(!entry||Object.keys(ASSETS).some(key=>entry!.sheets[key as Sheet]!==sheets[key as Sheet])){
    entry={sheets};pictureCache.set(sheets.tiles,entry);
  }
  if(actors)return entry.actors??=recordActorStaticLayers(sheets);
  return entry.static??=recordStaticLayers(sheets);
}
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };
const VISIBLE_COLOR = Skia.Color('white');
const HIDDEN_COLOR = Skia.Color('transparent');
const FRAME_RATES = [...new Set(ANIMATED_PROPS.map((prop) => prop.animation.fps))].sort((a, b) => a - b);
const ANIMATION_GROUPS: AnimationGroup[] = [];
for (const prop of ANIMATED_PROPS) {
  let group = ANIMATION_GROUPS.find((candidate) => candidate.sheet === prop.sheet && candidate.fps === prop.animation.fps);
  if (!group) {
    group = { sheet: prop.sheet, fps: prop.animation.fps, slot: FRAME_RATES.indexOf(prop.animation.fps), props: [] };
    ANIMATION_GROUPS.push(group);
  }
  group.props.push(prop);
}

const groundDepth = (prop: Prop) => {
  'worklet';
  return prop.footprint ? prop.footprint.y + prop.footprint.height : prop.depth;
};
const SOLID_PROPS = PROPS.filter((prop) => !prop.groundDetail).sort((a, b) => groundDepth(a) - groundDepth(b));

function recordPicture(draw: (canvas: SkCanvas) => void, bounds: Box = { x: 0, y: 0, ...WORLD }): SkPicture {
  const recorder = Skia.PictureRecorder();
  try {
    const canvas = recorder.beginRecording(rect(bounds.x, bounds.y, bounds.width, bounds.height));
    draw(canvas);
    return recorder.finishRecordingAsPicture();
  } finally {
    recorder.dispose();
  }
}

function drawProp(canvas: SkCanvas, sheets: LoadedSheets, prop: Prop) {
  const s = prop.source;
  const d = prop.destination;
  canvas.drawImageRectOptions(sheets[prop.sheet], rect(s.x, s.y, s.width, s.height), rect(d.x, d.y, d.width, d.height), FilterMode.Nearest, MipmapMode.None);
}

// Retained for scenery-only exports and regression comparisons.
export function recordStaticScene(sheets: LoadedSheets): SkPicture {
  return recordPicture((canvas) => {
    for (const prop of PROPS) drawProp(canvas, sheets, prop);
  });
}

const GROUND_CHUNK_SIZE = 512;
const EMPTY_BOUNDS: Box = { x: 0, y: 0, width: 1, height: 1 };

function unionBounds(a: Box | undefined, b: Box): Box {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

function propBounds(props: readonly Prop[]): Box {
  let bounds: Box | undefined;
  for (const prop of props) bounds = unionBounds(bounds, prop.destination);
  return bounds ?? EMPTY_BOUNDS;
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Overlapping details must retain their original painter order even when their
// images cross a cell boundary. Connected overlap groups stay in the same cache.
function groupGroundDetails(props: Prop[]): Prop[][] {
  const parents = props.map((_, index) => index);
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const spatial = new Map<string, number[]>();
  props.forEach((prop, index) => {
    const d = prop.destination;
    const minX = Math.floor(d.x / GROUND_CHUNK_SIZE);
    const minY = Math.floor(d.y / GROUND_CHUNK_SIZE);
    const maxX = Math.floor((d.x + d.width) / GROUND_CHUNK_SIZE);
    const maxY = Math.floor((d.y + d.height) / GROUND_CHUNK_SIZE);
    const checked = new Set<number>();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = x + ',' + y;
        const cell = spatial.get(key) ?? [];
        for (const candidate of cell) {
          if (!checked.has(candidate) && intersects(d, props[candidate].destination)) {
            parents[find(index)] = find(candidate);
          }
          checked.add(candidate);
        }
        cell.push(index);
        spatial.set(key, cell);
      }
    }
  });
  const components = new Map<number, number[]>();
  props.forEach((_, index) => {
    const root = find(index);
    const members = components.get(root) ?? [];
    members.push(index);
    components.set(root, members);
  });
  const cells = new Map<string, number[]>();
  for (const members of components.values()) {
    const bounds = propBounds(members.map((index) => props[index]));
    const key = Math.floor((bounds.x + bounds.width / 2) / GROUND_CHUNK_SIZE)
      + ',' + Math.floor((bounds.y + bounds.height / 2) / GROUND_CHUNK_SIZE);
    const cell = cells.get(key) ?? [];
    cell.push(...members);
    cells.set(key, cell);
  }
  return [...cells.values()].map((indices) => indices.sort((a, b) => a - b).map((index) => props[index]));
}

const GROUND_CHUNKS = groupGroundDetails(PROPS.filter((prop) => prop.groundDetail));

function recordGroundDetails(sheets: LoadedSheets): SkPicture {
  const chunks = GROUND_CHUNKS.map((props) => recordPicture((canvas) => {
    for (const prop of props) drawProp(canvas, sheets, prop);
  }, propBounds(props)));
  // Native Skia uses an R-tree for explicitly bounded recordings. Offscreen
  // chunks can be rejected without replaying their grass and rock commands.
  return recordPicture((canvas) => {
    for (const chunk of chunks) canvas.drawPicture(chunk);
  }, propBounds(GROUND_CHUNKS.flat()));
}

// Each cache entry references its preceding picture instead of duplicating all
// sprite commands or textures. No picture is recorded during movement.
export function recordStaticLayers(sheets: LoadedSheets): StaticLayers {
  const ground = recordGroundDetails(sheets);
  const empty = recordPicture(() => {}, EMPTY_BOUNDS);
  const depths = SOLID_PROPS.map(groundDepth);
  const behind: SkPicture[] = [empty];
  const ahead: SkPicture[] = new Array(SOLID_PROPS.length + 1);
  ahead[SOLID_PROPS.length] = empty;
  let behindBounds: Box | undefined;
  for (let index = 0; index < SOLID_PROPS.length; index++) {
    behindBounds = unionBounds(behindBounds, SOLID_PROPS[index].destination);
    behind.push(recordPicture((canvas) => {
      canvas.drawPicture(behind[index]);
      drawProp(canvas, sheets, SOLID_PROPS[index]);
    }, behindBounds));
  }
  let aheadBounds: Box | undefined;
  for (let index = SOLID_PROPS.length - 1; index >= 0; index--) {
    aheadBounds = unionBounds(aheadBounds, SOLID_PROPS[index].destination);
    ahead[index] = recordPicture((canvas) => {
      drawProp(canvas, sheets, SOLID_PROPS[index]);
      canvas.drawPicture(ahead[index + 1]);
    }, aheadBounds);
  }
  return { ground, depths, behind, ahead };
}

// A second immutable cache supports multiple moving actors. Every leaf holds
// one obstacle; each parent references its two children in painter order. The
// live renderer selects disjoint ranges between sorted actors, so every object
// is drawn exactly once and transparencies keep the same composition as before.
export function recordActorStaticLayers(sheets: LoadedSheets): StaticActorLayers {
  const ground = recordGroundDetails(sheets);
  const empty = recordPicture(() => {}, EMPTY_BOUNDS);
  const depths = SOLID_PROPS.map(groundDepth);
  const leafCount = 2 ** Math.ceil(Math.log2(Math.max(1, depths.length)));
  const pictures: SkPicture[] = new Array(leafCount * 2).fill(empty);
  const bounds: (Box | undefined)[] = new Array(leafCount * 2);
  for (let index = 0; index < SOLID_PROPS.length; index++) {
    const prop = SOLID_PROPS[index];
    bounds[leafCount + index] = prop.destination;
    pictures[leafCount + index] = recordPicture((canvas) => drawProp(canvas, sheets, prop), prop.destination);
  }
  for (let index = leafCount - 1; index > 0; index--) {
    const first = bounds[index * 2];
    const second = bounds[index * 2 + 1];
    const combined = second ? unionBounds(first, second) : first;
    bounds[index] = combined;
    if (combined) pictures[index] = recordPicture((canvas) => {
      canvas.drawPicture(pictures[index * 2]);
      canvas.drawPicture(pictures[index * 2 + 1]);
    }, combined);
  }
  return { ground, depths, pictures, leafCount };
}

// At equal foot depth, the actor is in front of the environment object.
export function findLayerIndex(depths: readonly number[], depth: number): number {
  'worklet';
  let low = 0;
  let high = depths.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (depths[middle] <= depth) low = middle + 1;
    else high = middle;
  }
  return low;
}

function AnimatedScenery({ group, image, ticks, previewTimeMs, playerDepth, layer = 'all' }: {
  group: AnimationGroup;
  image: SkImage;
  ticks: SharedValue<number[]>;
  previewTimeMs?: number;
  playerDepth?: SharedValue<number>;
  layer?: SceneryLayer;
}) {
  const transforms = useMemo(() => group.props.map(({ source: s, destination: d }) => Skia.RSXform(d.width / s.width, 0, d.x, d.y)), [group]);
  // Only animation-frame changes are propagated; camera and actor updates do
  // not rebuild the sprite rectangles or the static scenery caches.
  const tick = useDerivedValue(() => previewTimeMs === undefined ? ticks.value[group.slot] : Math.floor(previewTimeMs * group.fps / 1000));
  const sprites = useDerivedValue<SkRect[]>(() => group.props.map((prop) => {
    const frame = (tick.value + prop.animation.phase) % prop.animation.frames;
    const s = prop.source;
    return rect(s.x + frame * s.width, s.y, s.width, s.height);
  }));
  const depths = useMemo(() => group.props.map(groundDepth), [group]);
  const colors = useDerivedValue<SkColor[]>(() => depths.map((depth) => {
    const visible = !playerDepth || layer === 'all'
      || (layer === 'behind' ? depth <= playerDepth.value : depth > playerDepth.value);
    return visible ? VISIBLE_COLOR : HIDDEN_COLOR;
  }));
  return <Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" sampling={sampling} />;
}

function DepthScenery({ layers, sheets, ticks, playerDepth, previewTimeMs, children }: {
  layers: StaticLayers;
  sheets: LoadedSheets;
  ticks: SharedValue<number[]>;
  playerDepth?: SharedValue<number>;
  previewTimeMs?: number;
  children?: React.ReactNode;
}) {
  const { depths, behind, ahead } = layers;
  const index = useDerivedValue(() => playerDepth ? findLayerIndex(depths, playerDepth.value) : depths.length);
  const behindPicture = useDerivedValue(() => behind[index.value]);
  const aheadPicture = useDerivedValue(() => ahead[index.value]);

  return <Group>
    <Picture picture={layers.ground} />
    <Picture picture={behindPicture} />
    {ANIMATION_GROUPS.map((group) => <AnimatedScenery key={'behind-' + group.sheet + '-' + group.fps} group={group} image={sheets[group.sheet]} ticks={ticks} previewTimeMs={previewTimeMs} playerDepth={playerDepth} layer={playerDepth ? 'behind' : 'all'} />)}
    {children}
    <Picture picture={aheadPicture} />
    {playerDepth && ANIMATION_GROUPS.map((group) => <AnimatedScenery key={'ahead-' + group.sheet + '-' + group.fps} group={group} image={sheets[group.sheet]} ticks={ticks} previewTimeMs={previewTimeMs} playerDepth={playerDepth} layer="ahead" />)}
  </Group>;
}

function ActorsScenery({ layers, sheets, ticks, actors, images, capacity, previewTimeMs }: {
  layers: StaticActorLayers;
  sheets: LoadedSheets;
  ticks: SharedValue<number[]>;
  actors: SharedValue<RenderActor[]>;
  images: SkImage[];
  capacity: number;
  previewTimeMs?: number;
}) {
  const animatedSheets = useMemo(() => [...new Set(ANIMATED_PROPS.map((prop) => prop.sheet))], []);
  const allImages = useMemo(() => [...images, ...animatedSheets.map((sheet) => sheets[sheet])], [images, animatedSheets, sheets]);
  const ordered = useDerivedValue<RenderActor[]>(() => {
    const result = actors.value.filter((actor) => actor.visible).slice(0, capacity);
    for (let index = 0; index < ANIMATED_PROPS.length; index++) {
      const prop = ANIMATED_PROPS[index];
      const s = prop.source;
      const d = prop.destination;
      const slot = FRAME_RATES.indexOf(prop.animation.fps);
      const tick = previewTimeMs === undefined ? ticks.value[slot] : Math.floor(previewTimeMs * prop.animation.fps / 1000);
      const frame = (tick + prop.animation.phase) % prop.animation.frames;
      result.push({ id: -index - 1, image: images.length + animatedSheets.indexOf(prop.sheet),
        source: { x: s.x + frame * s.width, y: s.y, width: s.width, height: s.height },
        x: d.x, y: d.y, depth: groundDepth(prop), scale: d.width / s.width,
        pivotX: 0, pivotY: 0, facingX: 1, visible: true });
    }
    return result.sort((a, b) => a.depth - b.depth || a.id - b.id);
  });
  return <ActorLayers layers={layers} actors={ordered} images={allImages} capacity={capacity + ANIMATED_PROPS.length} />;
}

type SceneProps = {
  onError: (error: Error) => void;
  onReady?: () => void;
  active?: boolean;
  playerDepth?: SharedValue<number>;
  children?: React.ReactNode;
  groundOverlay?: React.ReactNode;
  actors?: SharedValue<RenderActor[]>;
  actorImages?: SkImage[];
  actorCapacity?: number;
  // Deterministic export/review only. Gameplay never updates this prop per frame.
  previewTimeMs?: number;
};

export function Scene({ onError, onReady, active = true, previewTimeMs, playerDepth, children, groundOverlay, actors, actorImages, actorCapacity = 25 }: SceneProps) {
  const tiles = useImage(ASSETS.tiles, onError);
  const gunShop = useImage(ASSETS.gunShop, onError);
  const medic = useImage(ASSETS.medic, onError);
  const restaurant = useImage(ASSETS.restaurant, onError);
  const shed = useImage(ASSETS.shed, onError);
  const tower = useImage(ASSETS.tower, onError);
  const kiln = useImage(ASSETS.kiln, onError);
  const door = useImage(ASSETS.door, onError);
  const sheets = useMemo<LoadedSheets | null>(() => {
    if (!tiles || !gunShop || !medic || !restaurant || !shed || !tower || !kiln || !door) return null;
    return { tiles, gunShop, medic, restaurant, shed, tower, kiln, door };
  }, [tiles, gunShop, medic, restaurant, shed, tower, kiln, door]);
  // Pictures are JSI resources released with their last JS/native reference.
  // Strict Mode effect cleanup must not dispose resources still being rendered.
  const hasActors = Boolean(actors && actorImages);
  const layers = useMemo(() => sheets && !hasActors ? cachedLayers(sheets,false) : null, [sheets, hasActors]);
  const actorLayers = useMemo(() => sheets && hasActors ? cachedLayers(sheets,true) : null, [sheets, hasActors]);
  const loaded = layers !== null || actorLayers !== null;
  const elapsed = useSharedValue(0);
  const ticks = useSharedValue<number[]>(FRAME_RATES.map(() => 0));
  const clock = useSharedValue({ running: false, firstFrame: true });
  const callback = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!clock.value.running) return;
    if (clock.value.firstFrame) {
      clock.set({ running: true, firstFrame: false });
      return;
    }
    if (timeSincePreviousFrame === null) return;
    const time = elapsed.value + Math.max(0, Math.min(40, timeSincePreviousFrame));
    elapsed.set(time);
    const previous = ticks.value;
    let changed = false;
    for (let index = 0; index < FRAME_RATES.length; index++) {
      if (Math.floor(time * FRAME_RATES[index] / 1000) !== previous[index]) { changed = true; break; }
    }
    if (changed) ticks.set(FRAME_RATES.map((fps) => Math.floor(time * fps / 1000)));
  }, [elapsed, ticks, clock]), false);

  useEffect(() => {
    const running = active && loaded && previewTimeMs === undefined && FRAME_RATES.length > 0;
    clock.set({ running, firstFrame: true });
    callback.setActive(running);
    return () => {
      clock.set({ running: false, firstFrame: true });
      callback.setActive(false);
    };
  }, [callback, active, loaded, previewTimeMs, clock]);
  useEffect(() => { if (loaded) onReady?.(); }, [loaded, onReady]);
  if (!loaded || !sheets) return null;

  return <Group>
    <Fill color={FLOOR_COLOR} />
    {groundOverlay}
    {actorLayers && actors && actorImages
      ? <ActorsScenery layers={actorLayers} sheets={sheets} ticks={ticks} actors={actors} images={actorImages} capacity={actorCapacity} previewTimeMs={previewTimeMs} />
      : layers && <DepthScenery layers={layers} sheets={sheets} ticks={ticks} playerDepth={playerDepth} previewTimeMs={previewTimeMs}>{children}</DepthScenery>}
    <Fill>
      <RadialGradient
        c={{ x: ARENA.x, y: ARENA.y }}
        r={ARENA.shadowEnd}
        positions={[0, ARENA.shadowStart / ARENA.shadowEnd, ARENA.radius / ARENA.shadowEnd, 0.96, 1]}
        colors={['transparent', 'transparent', 'rgba(16,13,16,0.46)', 'rgba(16,13,16,0.91)', OUTSIDE_COLOR]}
      />
    </Fill>
  </Group>;
}

