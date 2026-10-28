import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Atlas, Canvas, Circle, Fill, FilterMode, Group, LinearGradient, MipmapMode, Picture, RadialGradient, Skia, rect, type SkCanvas, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { MENU_ASSETS } from './menuAssets';
import { useSharedImage } from './sharedImages';
import { NPC_CELL } from '../game/npc';
import { advanceMenuTilt, MENU_NPC_SCALE, MENU_NPC_SPOTS, menuNpcAt } from './menuAmbient';
import { useMenuGyroscope } from './useMenuGyroscope';

export { MENU_ASSETS } from './menuAssets';
export type MenuSheets = Record<Exclude<keyof typeof MENU_ASSETS, 'summoner' | 'npc'>, SkImage>;
export const MENU_SIZE = { width: 1200, height: 675 };
// Visually checked: twelve 132x83 cells in the 1584x83 RGBA walk strip.
// The body stays near x=34..77, and the feet at y=82 in all twelve frames.
export const MENU_BOSS = { width: 132, height: 83, frames: 12, fps: 10, scale: 2.35, pivotX: 55, pivotY: 82 };
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

type Decoration = { sheet: keyof MenuSheets; source: number[]; x: number; y: number; scale: number };
const BACKGROUND: Decoration[] = [
  { sheet: 'tower', source: [0, 0, 50, 99], x: 1055, y: 12, scale: 1.6 },
  { sheet: 'shed', source: [0, 0, 80, 81], x: 860, y: 92, scale: 1.65 },
  { sheet: 'gunShop', source: [0, 0, 118, 118], x: 603, y: 130, scale: 2.05 },
  { sheet: 'restaurant', source: [0, 0, 113, 135], x: 968, y: 162, scale: 1.9 },
  // Broken slabs and containers stay beside the buildings, leaving a street.
  { sheet: 'tiles', source: [16, 16, 32, 32], x: 843, y: 284, scale: 1.8 },
  { sheet: 'tiles', source: [112, 16, 32, 32], x: 885, y: 299, scale: 1.8 },
  { sheet: 'tiles', source: [48, 48, 32, 32], x: 809, y: 346, scale: 1.8 },
  { sheet: 'tiles', source: [80, 80, 32, 16], x: 1132, y: 350, scale: 2 },
  { sheet: 'tiles', source: [128, 208, 80, 80], x: 1116, y: 330, scale: 1.4 },
  { sheet: 'tiles', source: [0, 160, 48, 48], x: 543, y: 345, scale: 2 },
  { sheet: 'tiles', source: [0, 80, 16, 16], x: 635, y: 399, scale: 2 },
  { sheet: 'tiles', source: [32, 80, 16, 16], x: 609, y: 418, scale: 2 },
  { sheet: 'tiles', source: [112, 80, 16, 16], x: 918, y: 359, scale: 2 },
  { sheet: 'tiles', source: [128, 80, 16, 16], x: 1013, y: 439, scale: 2 },
  { sheet: 'tiles', source: [144, 96, 16, 16], x: 929, y: 441, scale: 2 },
  { sheet: 'tiles', source: [96, 96, 16, 16], x: 723, y: 421, scale: 2 },
];
const FOREGROUND: Decoration[] = [
  { sheet: 'tiles', source: [80, 48, 32, 32], x: 869, y: 547, scale: 2 },
  { sheet: 'tiles', source: [0, 80, 16, 16], x: 932, y: 563, scale: 2.5 },
  { sheet: 'shed', source: [0, 0, 80, 81], x: 1029, y: 461, scale: 2.5 },
  { sheet: 'gunShop', source: [0, 0, 118, 118], x: 538, y: 506, scale: 2.65 },
];

// This separate composition only renders decorative NPCs; it never starts game AI or waves.
// Picture commands and source crops are immutable between window resizes.
export function recordMenuScenery(sheets: MenuSheets, foreground = false) {
  const recorder = Skia.PictureRecorder();
  try {
    const canvas: SkCanvas = recorder.beginRecording(rect(0, 0, MENU_SIZE.width, MENU_SIZE.height));
    for (const prop of foreground ? FOREGROUND : BACKGROUND) {
      const [x, y, width, height] = prop.source;
      canvas.drawImageRectOptions(sheets[prop.sheet], rect(x, y, width, height),
        rect(prop.x, prop.y, width * prop.scale, height * prop.scale), FilterMode.Nearest, MipmapMode.None);
    }
    return recorder.finishRecordingAsPicture();
  } finally {
    recorder.dispose();
  }
}

function AmbientNpc({ image, time, index }: { image: SkImage | null; time: { readonly value: number }; index: number }) {
  const pose = useDerivedValue(() => menuNpcAt(time.value, index));
  const sprites = useDerivedValue(() => {
    const source = pose.value.source;
    return [rect(source.x, source.y, source.width, source.height)];
  });
  const transform = useDerivedValue(() => [
    { translateX: pose.value.x }, { translateY: pose.value.y }, { scaleX: pose.value.facing },
  ]);
  const transforms = useMemo(() => [Skia.RSXform(MENU_NPC_SCALE, 0,
    -NPC_CELL.pivotX * MENU_NPC_SCALE, -NPC_CELL.pivotY * MENU_NPC_SCALE)], []);
  const opacity = useDerivedValue(() => pose.value.visible ? 0.92 : 0);
  return <Group opacity={opacity} transform={transform}><Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling} /></Group>;
}

type Props = { active?: boolean; previewTimeMs?: number; onReady?: () => void; onError?: (message: string) => void };
export default function MenuBackdrop({ active = true, previewTimeMs, onReady, onError }: Props) {
  const { width, height } = useWindowDimensions();
  const onImageError = useCallback((error: Error) => onError?.(error.message), [onError]);
  // Asset decoding stays enabled while an overlay suspends ambient movement.
  const tiles = useSharedImage(MENU_ASSETS.tiles, onImageError);
  const gunShop = useSharedImage(MENU_ASSETS.gunShop, onImageError);
  const restaurant = useSharedImage(MENU_ASSETS.restaurant, onImageError);
  const shed = useSharedImage(MENU_ASSETS.shed, onImageError);
  const tower = useSharedImage(MENU_ASSETS.tower, onImageError);
  const summoner = useSharedImage(MENU_ASSETS.summoner, onImageError);
  const npc = useSharedImage(MENU_ASSETS.npc, onImageError);
  const rotation = useMenuGyroscope(active && previewTimeMs === undefined);
  const tilt = useSharedValue({ x: 0, y: 0 });
  const smoothedTilt = useSharedValue({ x: 0, y: 0 });
  const sheets = useMemo<MenuSheets | null>(() => tiles && gunShop && restaurant && shed && tower
    ? { tiles, gunShop, restaurant, shed, tower } : null, [tiles, gunShop, restaurant, shed, tower]);
  const pictures = useMemo(() => sheets ? [recordMenuScenery(sheets), recordMenuScenery(sheets, true)] : null, [sheets]);
  const ready = Boolean(pictures && summoner && npc);
  useEffect(() => { if (ready) onReady?.(); }, [ready, onReady]);
  const elapsed = useSharedValue(0);
  const running = useSharedValue(false);
  const skipFrame = useSharedValue(true);
  const time = useDerivedValue(() => previewTimeMs ?? elapsed.value);
  const callback = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!running.value) return;
    // A frame can already be queued during suspension. Skip the first resumed
    // callback entirely so none of the hidden/background time enters the clock.
    if (skipFrame.value || timeSincePreviousFrame === null) { skipFrame.set(false); return; }
    const dt = Math.min(64, timeSincePreviousFrame);
    elapsed.set(elapsed.value + dt);
    const reading = rotation.value;
    const fresh = Date.now() - reading.receivedAtMs < 200;
    const next = advanceMenuTilt(tilt.value, fresh ? reading : { x: 0, y: 0 }, dt);
    tilt.set(next);
    const blend = 1 - Math.exp(-dt / 110);
    const prior = smoothedTilt.value;
    smoothedTilt.set({ x: prior.x + (next.x - prior.x) * blend, y: prior.y + (next.y - prior.y) * blend });
  }, [elapsed, rotation, tilt, smoothedTilt, running, skipFrame]), false);
  useEffect(() => {
    const enabled = active && ready && previewTimeMs === undefined;
    skipFrame.set(true);
    running.set(enabled);
    callback.setActive(enabled);
    return () => { running.set(false); skipFrame.set(true); callback.setActive(false); };
  }, [active, callback, ready, previewTimeMs, running, skipFrame]);

  const cityTransform = useDerivedValue(() => [
    { translateX: Math.sin(time.value / 12000) * 3 + smoothedTilt.value.x },
    { translateY: Math.sin(time.value / 15000) * 2 + smoothedTilt.value.y },
  ]);
  // First passage starts after 3.5 seconds; subsequent passages are 31 s apart.
  // Only this environmental animation uses boss art: no encounter is created.
  const passage = useDerivedValue(() => (time.value - 3500) % 31000);
  const bossOpacity = useDerivedValue(() => {
    const t = passage.value;
    if (time.value < 3500 || t < 0 || t > 11500) return 0;
    return Math.min(1, t / 1200, (11500 - t) / 1200) * 0.9;
  });
  const bossTransform = useDerivedValue(() => [
    { translateX: 1170 - Math.max(0, passage.value) / 11500 * 530 },
    { translateY: 469 }, { scaleX: -1 },
  ]);
  const frame = useDerivedValue(() => Math.floor(time.value * MENU_BOSS.fps / 1000) % MENU_BOSS.frames);
  const sprites = useDerivedValue(() => [rect(frame.value * MENU_BOSS.width, 0, MENU_BOSS.width, MENU_BOSS.height)]);
  const bossAtlasTransform = useMemo(() => [Skia.RSXform(MENU_BOSS.scale, 0,
    -MENU_BOSS.pivotX * MENU_BOSS.scale, -MENU_BOSS.pivotY * MENU_BOSS.scale)], []);
  const glow = useDerivedValue(() => 0.09 + Math.sin(time.value / 2600) * 0.025);
  const fogTransform = useDerivedValue(() => [
    { translateX: Math.sin(time.value / 17000) * 32 + smoothedTilt.value.x * 1.4 },
    { translateY: smoothedTilt.value.y * 1.4 },
  ]);
  const scale = Math.max(width / MENU_SIZE.width, height / MENU_SIZE.height);
  const fitTransform = useMemo(() => [
    { translateX: (width - MENU_SIZE.width * scale) / 2 },
    { translateY: (height - MENU_SIZE.height * scale) / 2 }, { scale },
  ], [width, height, scale]);

  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Fill color="#513a3d" />
      <Group transform={fitTransform}>
        <Group transform={cityTransform}>
          {pictures && <Picture picture={pictures[0]} />}
          <Group opacity={glow}>
            <Circle cx={1203} cy={414} r={104}>
              <RadialGradient c={{ x: 1203, y: 414 }} r={104} colors={['#3bcbda', 'transparent']} />
            </Circle>
          </Group>
          {MENU_NPC_SPOTS.map((spot, index) => spot.y < 469
            ? <AmbientNpc key={index} image={npc} time={time} index={index} /> : null)}
          <Group opacity={bossOpacity} transform={bossTransform}>
            <Atlas image={summoner} sprites={sprites} transforms={bossAtlasTransform} sampling={sampling} />
          </Group>
          {MENU_NPC_SPOTS.map((spot, index) => spot.y >= 469
            ? <AmbientNpc key={index} image={npc} time={time} index={index} /> : null)}
          {pictures && <Picture picture={pictures[1]} />}
        </Group>
        <Group transform={fogTransform} opacity={0.14}>
          <Circle cx={980} cy={410} r={410}>
            <RadialGradient c={{ x: 980, y: 410 }} r={410} colors={['#9c9490', 'transparent']} />
          </Circle>
        </Group>
      </Group>
      <Fill color="rgba(8,11,14,0.36)" />
      <Fill>
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: width, y: height * 0.12 }}
          positions={[0, 0.28, 0.56, 1]} colors={['#090d10', 'rgba(9,13,16,0.95)', 'rgba(9,13,16,0.23)', 'rgba(9,13,16,0.12)']} />
      </Fill>
      <Fill>
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: height }}
          positions={[0, 0.38, 0.76, 1]} colors={['rgba(6,9,12,0.3)', 'transparent', 'rgba(6,9,12,0.1)', 'rgba(6,9,12,0.91)']} />
      </Fill>
    </Canvas>
  </View>;
}
