import React, { useEffect, useMemo } from 'react';
import { Atlas, FilterMode, Group, MipmapMode, Skia, rect, useImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { PLAYER_CELL, PLAYER_SCALE, playerFrame, type PlayerState } from './player';

const SWORDMASTER = require('../../assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png');
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

type Props = { player: SharedValue<PlayerState>; onError: (error: Error) => void; onReady?: () => void };
export function PlayerSprite({ player, onError, onReady }: Props) {
  const image = useImage(SWORDMASTER, onError);
  useEffect(() => { if (image) onReady?.(); }, [image, onReady]);
  const x = useDerivedValue(() => player.value.x);
  const y = useDerivedValue(() => player.value.y);
  const facingX = useDerivedValue(() => player.value.facingX);
  const transform = useDerivedValue(() => [
    { translateX: x.value }, { translateY: y.value }, { scaleX: facingX.value },
  ]);
  // Propagate only real frame changes, rather than reallocating a crop at the
  // display refresh rate when this 9–25 fps animation is between frames.
  const frameIndex = useDerivedValue(() => {
    const frame = playerFrame(player.value);
    return frame.y / PLAYER_CELL.height * 10 + frame.x / PLAYER_CELL.width;
  });
  const source = useDerivedValue(() => [rect(
    frameIndex.value % 10 * PLAYER_CELL.width,
    Math.floor(frameIndex.value / 10) * PLAYER_CELL.height,
    PLAYER_CELL.width, PLAYER_CELL.height,
  )]);
  // Crop the complete cell, including the real VFX, without changing its pivot
  // between poses. Only the whole character is mirrored, never the source rect.
  const atlasTransform = useMemo(() => [Skia.RSXform(PLAYER_SCALE, 0,
    -PLAYER_CELL.pivotX * PLAYER_SCALE, -PLAYER_CELL.pivotY * PLAYER_SCALE)], []);
  if (!image) return null;
  return <Group transform={transform}>
    <Atlas image={image} sprites={source} transforms={atlasTransform} sampling={sampling} />
  </Group>;
}
