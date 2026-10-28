import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { projectWorld, type CameraTransform } from './indicatorGeometry';
import { MERCHANT_CONFIG } from './merchantConfig';
import type { SurvivalState } from './survival';
import type { PlayerState } from './player';
import type { Viewport, CameraBounds } from './camera';

type Props = { survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>;
  camera: SharedValue<CameraTransform>; view: SharedValue<Viewport & CameraBounds>; visible: boolean };

/** Same centered, player-relative arrow as the ship alarm; only the first 3s. */
export default function MerchantIndicator({ survival, player, camera, view, visible }: Props) {
  const opacity = useDerivedValue(() => {
    const m = survival.value.merchants?.active;
    return visible && survival.value.mode === 'playing' && m && m.phase !== 'departing'
      ? Math.max(0, Math.min(1, (MERCHANT_CONFIG.markerMs - m.ageMs) / 350)) : 0;
  });
  const path = useDerivedValue(() => {
    const arrow = Skia.PathBuilder.Make(), m = survival.value.merchants?.active;
    if (!visible || !m || m.phase === 'departing' || m.ageMs >= MERCHANT_CONFIG.markerMs || survival.value.mode !== 'playing') return arrow.detach();
    const p = player.value, v = view.value, dx = m.x - p.x, dy = m.y - p.y;
    if (Math.hypot(dx, dy) < 35) return arrow.detach();
    const angle = Math.atan2(dy, dx), point = projectWorld(p, camera.value);
    const a = Math.cos(angle), b = Math.sin(angle);
    const x = Math.max(24, Math.min(v.width - 24, point.x + a * 66));
    const y = Math.max(76, Math.min(v.height - 118, point.y + b * 66));
    arrow.moveTo(x + a * 12, y + b * 12);
    arrow.lineTo(x - a * 8 - b * 8, y - b * 8 + a * 8);
    arrow.lineTo(x - a * 3, y - b * 3);
    arrow.lineTo(x - a * 8 + b * 8, y - b * 8 - a * 8);
    arrow.close();
    return arrow.detach();
  });
  return visible ? <View testID="merchant-indicator" pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Canvas style={StyleSheet.absoluteFill}><Path path={path} color="#ddc79e" style="stroke" strokeWidth={2} opacity={opacity} /></Canvas>
  </View> : null;
}
