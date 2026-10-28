import { createMissionTelemetry } from './missionTelemetry';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { screenToFrenesisWorld, teleportFrenesis } from './frenesis';
import type { PlayerState } from './player';
import type { SurvivalState } from './survival';

// This is a sibling BEHIND all interactive panels and controls, never a parent
// recognizer. Native hit-testing therefore cannot turn a control touch into a tap.
export default function FrenesisMapInput({ survival, player, enabled, camera, clock }: {
  survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>; enabled: boolean;
  camera: SharedValue<({ translateX: number } | { translateY: number } | { scale: number })[]>;
  clock: SharedValue<{ running: boolean; firstFrame: boolean }>;
}) {
  const gesture = useMemo(() => Gesture.Tap().enabled(enabled).maxDuration(250).maxDistance(12).runOnJS(false).onEnd((e, success) => {
    'worklet';
    const state = survival.value;
    if (!success || !clock.value.running || state.mode !== 'playing' || state.presentation || state.purgatorio?.phase === 'between') return;
    let tx = 0, ty = 0, scale = 1;
    for (const t of camera.value) { if ('translateX' in t) tx = t.translateX; else if ('translateY' in t) ty = t.translateY; else scale = t.scale; }
    const destination = screenToFrenesisWorld(e.x, e.y, tx, ty, scale);
    const result = teleportFrenesis(state.frenesis, player.value, destination.x, destination.y, !state.tutorial || !state.encounter.enemies.some(n => n.active && n.action !== 'death' && Math.hypot(n.x-destination.x,n.y-destination.y)<32));
    if (result.frenesis !== state.frenesis) { survival.set({ ...state, frenesis: result.frenesis, missions: { ...(state.missions ?? createMissionTelemetry()), teleports: (state.missions?.teleports ?? 0) + 1 } }); player.set(result.player); }
  }), [enabled, survival, player, camera, clock]);
  return <GestureDetector gesture={gesture}><View testID="frenesis-map-input" style={StyleSheet.absoluteFill} collapsable={false} /></GestureDetector>;
}
