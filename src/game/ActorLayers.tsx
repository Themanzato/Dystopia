import React, { useMemo } from 'react';
import { Atlas, FilterMode, Group, MipmapMode, Picture, Skia, rect, type SkImage, type SkPicture } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { RenderActor } from './renderTypes';

export type StaticActorLayers = {
  ground: SkPicture;
  depths: number[];
  // Heap-ordered, immutable segment tree. Index zero is the shared empty picture.
  pictures: SkPicture[];
  leafCount: number;
};
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

export function depthInsertionIndex(depths: readonly number[], depth: number): number {
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

// The selected pictures cover [start, end) once, in painter order. Querying the
// immutable tree needs at most 2*log2(N) references, without recording pictures.
export function rangePictureIndices(leafCount: number, start: number, end: number): number[] {
  'worklet';
  let left = start + leafCount;
  let right = end + leafCount;
  const before: number[] = [];
  const after: number[] = [];
  while (left < right) {
    if (left % 2 === 1) before.push(left++);
    if (right % 2 === 1) after.push(--right);
    left = Math.floor(left / 2);
    right = Math.floor(right / 2);
  }
  return before.concat(after.reverse());
}

function RangePicture({ pictures, selected, slot }: { pictures: SkPicture[]; selected: SharedValue<number[]>; slot: number }) {
  // This mapper runs when a depth interval changes, rather than on every actor
  // position update. Unused slots reference one tiny, empty cached picture.
  const picture = useDerivedValue(() => pictures[selected.value[slot] ?? 0]);
  return <Picture picture={picture} />;
}

function StaticGap({ layers, actors, slot }: { layers: StaticActorLayers; actors: SharedValue<RenderActor[]>; slot: number }) {
  const { depths, pictures, leafCount } = layers;
  const stride = depths.length + 1;
  const key = useDerivedValue(() => {
    const current = actors.value;
    const start = slot === 0 ? 0 : depthInsertionIndex(depths, current[slot - 1]?.depth ?? Infinity);
    const end = depthInsertionIndex(depths, current[slot]?.depth ?? Infinity);
    return start * stride + end;
  });
  // A primitive key stops all downstream picture selectors from responding to
  // movement within the same interval of environment-object foot depths.
  const selected = useDerivedValue(() => rangePictureIndices(leafCount,
    Math.floor(key.value / stride), key.value % stride));
  const slots = useMemo(() => Array.from({ length: Math.max(1, Math.ceil(Math.log2(leafCount)) * 2) }, (_, index) => index), [leafCount]);
  return <Group>{slots.map((index) => <RangePicture key={index} pictures={pictures} selected={selected} slot={index} />)}</Group>;
}

function ActorSlot({ actors, images, slot }: { actors: SharedValue<RenderActor[]>; images: SkImage[]; slot: number }) {
  const visible = useDerivedValue(() => actors.value[slot]?.visible ? (actors.value[slot]?.opacity??1) : 0);
  const image = useDerivedValue(() => images[actors.value[slot]?.image ?? 0]);
  const transform = useDerivedValue(() => {
    const actor = actors.value[slot];
    return [{ translateX: actor?.x ?? 0 }, { translateY: actor?.y ?? 0 }, { scaleX: actor?.facingX ?? 1 }];
  });
  const sourceKey = useDerivedValue(() => {
    const source = actors.value[slot]?.source;
    return source ? source.x + ',' + source.y + ',' + source.width + ',' + source.height : '0,0,1,1';
  });
  // Original frame crops are rebuilt only when the frame or actor occupying
  // this sorted slot changes, not on every display refresh.
  const sprites = useDerivedValue(() => {
    const source = sourceKey.value.split(',').map(Number);
    return [rect(source[0], source[1], source[2], source[3])];
  });
  const pivotKey = useDerivedValue(() => {
    const actor = actors.value[slot];
    return actor ? actor.scale + ',' + actor.pivotX + ',' + actor.pivotY : '1,0,0';
  });
  const transforms = useDerivedValue(() => {
    const pivot = pivotKey.value.split(',').map(Number);
    return [Skia.RSXform(pivot[0], 0, -pivot[1] * pivot[0], -pivot[2] * pivot[0])];
  });
  return <Group opacity={visible} transform={transform}>
    <Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling} />
  </Group>;
}

export function ActorLayers({ layers, actors, images, capacity }: {
  layers: StaticActorLayers;
  actors: SharedValue<RenderActor[]>;
  images: SkImage[];
  capacity: number;
}) {
  const slots = useMemo(() => Array.from({ length: capacity }, (_, index) => index), [capacity]);
  return <Group>
    <Picture picture={layers.ground} />
    {slots.map((slot) => <Group key={slot}>
      <StaticGap layers={layers} actors={actors} slot={slot} />
      <ActorSlot actors={actors} images={images} slot={slot} />
    </Group>)}
    <StaticGap layers={layers} actors={actors} slot={capacity} />
  </Group>;
}
