import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform } from 'react-native';

const CYCLE = 9200;
const TIMES = [0, 45, 100, 170, 235, 330, 390, 490, 600];
const VALUES = [1, 0.19, 1, 0.25, 0.25, 1, 0.14, 1, 1];
export function usePixelFlicker(active: boolean, enabled: boolean) {
  const [clock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!enabled || !active) return;
    const animation = Animated.loop(Animated.timing(clock, { toValue: 1, duration: CYCLE,
      easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }));
    if (AppState.currentState === 'active') animation.start();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') animation.start(); else animation.stop();
    });
    return () => { listener.remove(); animation.stop(); clock.stopAnimation(); };
  }, [clock, active, enabled]);
  return [0.14, 0.40].map(start => clock.interpolate({
    inputRange: [0, ...TIMES.map(ms => start + ms / CYCLE), 1],
    outputRange: [1, ...VALUES, 1],
  }));
}
