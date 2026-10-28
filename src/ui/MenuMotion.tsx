import React, { useCallback, useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { menuButtonPose } from './menuButtonPose';

export function useMenuMotionTime() {
  const time = useSharedValue(0);
  const gate = useSharedValue({ running: false, first: true });
  const frame = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!gate.value.running) return;
    if (gate.value.first) { gate.set({ running: true, first: false }); return; }
    if (timeSincePreviousFrame !== null) time.set(time.value + Math.min(64, Math.max(0, timeSincePreviousFrame)));
  }, [time, gate]), false);
  useEffect(() => {
    const setActive = (active: boolean) => { gate.set({ running: active, first: true }); frame.setActive(active); };
    setActive(AppState.currentState === 'active');
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { listener.remove(); setActive(false); };
  }, [frame, gate]);
  return time;
}
function MovingFace({ children, time, index }: { children: ReactNode; time: SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => {
    const pose = menuButtonPose(time.value, index);
    return { transform: [{ translateX: pose.x }, { translateY: pose.y }, { rotate: `${pose.angle}deg` }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}
export function MenuButtonMotion({ children, time, index = 0 }: { children: ReactNode; time?: SharedValue<number>; index?: number }) {
  return time ? <MovingFace time={time} index={index}>{children}</MovingFace> : <>{children}</>;
}
