import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';

import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { darknessAt, DARKNESS_COVER_MS, DARKNESS_REVEAL_MS, type DarknessPhase } from './darknessMotion';

type Props = { phase: DarknessPhase; active: boolean; onComplete: () => void };

// A fresh keyed instance owns each half of a transition. The caller can swap
// routes after cover completes: its last frame is entirely opaque.
export function useDarknessClock(phase: DarknessPhase, active: boolean, onComplete: () => void) {
  const elapsed = useSharedValue(0);
  const gate = useSharedValue({ running: false, first: true, finished: false });
  const callback = useRef(onComplete);
  const mounted = useRef(false);
  const notified = useRef(false);
  const requested = useRef(active);
  const foreground = useRef(AppState.currentState === 'active');
  useEffect(() => { callback.current = onComplete; }, [onComplete]);
  const complete = useCallback(() => {
    if (!mounted.current || notified.current || !foreground.current || !requested.current) return;
    notified.current = true;
    callback.current();
  }, []);
  const frame = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!gate.value.running || gate.value.finished) return;
    if (gate.value.first || timeSincePreviousFrame === null) {
      gate.set({ ...gate.value, first: false }); return;
    }
    const duration = phase === 'cover' ? DARKNESS_COVER_MS : DARKNESS_REVEAL_MS;
    const next = Math.min(duration, elapsed.value + Math.max(0, Math.min(64, timeSincePreviousFrame)));
    const paintedEnd = elapsed.value === duration;
    elapsed.set(next);
    if (paintedEnd) {
      gate.set({ running: false, first: true, finished: true });
      scheduleOnRN(complete);
    }
  }, [phase, elapsed, gate, complete]), false);
  useEffect(() => {
    const sync = () => {
      const running = requested.current && foreground.current && !gate.value.finished;
      gate.set({ ...gate.value, running, first: true });
      frame.setActive(running);
      if (requested.current && foreground.current && gate.value.finished) complete();
    };
    mounted.current = true;
    sync();
    const listener = AppState.addEventListener('change', state => {
      foreground.current = state === 'active'; sync();
    });
    return () => {
      mounted.current = false;
      listener.remove();
      gate.set({ ...gate.value, running: false, first: true });
      frame.setActive(false);
    };
  }, [frame, gate, complete]);
  useEffect(() => {
    requested.current = active;
    const running = active && foreground.current && !gate.value.finished;
    gate.set({ ...gate.value, running, first: true });
    frame.setActive(running);
    if (active && foreground.current && gate.value.finished) complete();
  }, [active, frame, gate, complete]);
  return elapsed;
}

export default function DarknessTransition({ phase, active, onComplete }: Props) {
  const elapsed = useDarknessClock(phase, active, onComplete);
  const fade = useAnimatedStyle(() => ({ opacity: darknessAt(elapsed.value, phase).opacity }));
  // The native black view exists on the first reveal frame, independently of
  // Canvas initialization. Cover/hold/reveal share the exact same black.
  return <Animated.View testID={`darkness-${phase}`} style={[s.overlay, fade]} pointerEvents="auto"
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
const s = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100, backgroundColor: '#030507' } });