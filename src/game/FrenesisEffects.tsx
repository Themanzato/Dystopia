import React from 'react';
import { Atlas, FilterMode, Group, MipmapMode, type SkImage, Skia, rect } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { FRENESIS } from './frenesis';
import { ENEMY_IMAGE_SOURCES } from './enemyVisuals';
import type { SurvivalState } from './survival';
import type { PlayerState } from './player';

/** Existing blink afterimages only. Slices is exclusively the main actor animation. */
export default function FrenesisEffects({ survival, player, images, active = true }: { active?:boolean; survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>; images: SkImage[] | null }) {
  // Explicit actor-library offsets survive appended merchants and future sheets.
  const offset=5+ENEMY_IMAGE_SOURCES.length;
  const image = images?.[offset+5];
  const sprites = useDerivedValue(() => [rect(140, 0, 140, 46), rect(280, 0, 140, 46), rect(420, 0, 140, 46)]);
  const transforms = useDerivedValue(() => {
    const t = survival.value.frenesis.teleport;
    if (!active || survival.value.mode!=='playing' || player.value.action==='death' || !t || t.elapsedMs < FRENESIS.blinkOutMs || t.elapsedMs > FRENESIS.blinkOutMs + FRENESIS.blinkTravelMs + 70) return [0, 1, 2].map(() => Skia.RSXform(0, 0, 0, 0));
    const phase = Math.max(0, Math.min(1, (t.elapsedMs - FRENESIS.blinkOutMs) / FRENESIS.blinkTravelMs));
    return [0, 1, 2].map(i => {
      const v = Math.max(0, phase - (i + 1) * 0.16);
      return Skia.RSXform(1.75, 0, t.fromX + (t.x - t.fromX) * v - 66 * 1.75, t.fromY + (t.y - t.fromY) * v - 44 * 1.75);
    });
  });
  return <Group>{image && <Group opacity={0.22}><Atlas image={image} sprites={sprites} transforms={transforms} sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }} /></Group>}</Group>;
}
