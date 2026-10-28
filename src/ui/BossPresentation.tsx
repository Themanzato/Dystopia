import React, { useLayoutEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Atlas, Canvas, Group, Fill, FilterMode, LinearGradient, MipmapMode, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { ENEMY_VISUALS } from '../game/enemyAnimations';
import { ENEMY_PRESENTATION_BOUNDS } from '../game/enemyPresentation';
import type { EnemyId } from '../game/enemyCatalog';
import type { SurvivalState } from '../game/survival';
import PixelText from './PixelText';
export type BossCard = { id: EnemyId; name: string; entityId: number };
/** Uses the very same decoded SkImages as the playable scene. No loading wait,
 * extra animation clock, network resources or per-frame React updates. */
export default function BossPresentation({ card, survival, images }: { card: BossCard; survival: SharedValue<SurvivalState>; images: SkImage[] }) {
  const { width, height } = useWindowDimensions();
  const alive=useSharedValue(true);
  useLayoutEffect(()=>{alive.set(true);return()=>alive.set(false);},[alive]);
  const visibility=useDerivedValue(()=>{
    const s=survival.value,p=s.presentation;
    return alive.value&&s.mode==='playing'&&p?.entityId===card.entityId&&s.boss?.entityId===card.entityId&&s.boss.id===card.id&&s.boss.hp>0
      ? Math.max(0,Math.min(1,p.elapsedMs/140,(p.durationMs-p.elapsedMs)/260)):0;
  });
  const visual = ENEMY_VISUALS[card.id], clip = visual.idle.frames > 1 ? visual.idle : visual.move;
  const bounds = ENEMY_PRESENTATION_BOUNDS[card.id];
  const scale = Math.max(1, Math.floor(Math.min(width * 0.36 / bounds.width, height * 0.47 / bounds.height, 7) * 2) / 2);
  const sprites = useDerivedValue(() => {
    const n = Math.floor((survival.value.presentation?.elapsedMs ?? 0) * 12 / 1000) % clip.frames;
    return [rect(clip.x + n * clip.stepX + bounds.x, clip.y + n * clip.stepY + bounds.y, bounds.width, bounds.height)];
  });
  const transforms = useDerivedValue(() => {
    const ms = survival.value.presentation?.elapsedMs ?? 1800;
    const entry = 1 - Math.pow(1 - Math.min(1, ms / 360), 3);
    return [Skia.RSXform(scale, 0, width * 0.73 - bounds.width * scale / 2 + (1 - entry) * width * 0.4,
      height * 0.47 - bounds.height * scale / 2 + Math.sin(ms / 450) * 2)];
  });
  const opacity = useAnimatedStyle(() => {
    return { opacity: visibility.value };
  });
  return <Animated.View collapsable={false} testID="boss-presentation" pointerEvents="none" style={[StyleSheet.absoluteFill, opacity]}>
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={visibility}>
      <Fill><LinearGradient start={{ x: 0, y: height * 0.12 }} end={{ x: 0, y: height * 0.85 }} colors={['transparent', '#08080eea', '#0b0810ee', 'transparent']} positions={[0, 0.28, 0.7, 1]} /></Fill>
      <Atlas image={images[clip.image]} sprites={sprites} transforms={transforms} sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }} />
      </Group>
    </Canvas>
    <View style={{ position: 'absolute', left: width * 0.08, top: height * 0.38, width: width * 0.4 }}>
      <PixelText text={card.name} size={width < 740 ? 25 : 32} maxWidth={width * 0.4} color="#d8bec3" />
    </View>
  </Animated.View>;
}
