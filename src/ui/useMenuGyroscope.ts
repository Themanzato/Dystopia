import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Gyroscope } from 'expo-sensors';
import { useSharedValue } from 'react-native-reanimated';
import { startMenuGyroscope } from './menuAmbient';

export function useMenuGyroscope(active: boolean) {
  const rotation = useSharedValue({ x: 0, y: 0, receivedAtMs: 0 });
  useEffect(() => {
    // Mobile browsers may require a user permission gesture. Keep the deliberate
    // ambient drift there; never surprise the player with a motion permission UI.
    if (!active || Platform.OS === 'web') return;
    const stop = startMenuGyroscope(Gyroscope, value => {
      rotation.set({ x: value.x, y: value.y, receivedAtMs: Date.now() });
    });
    return () => { stop(); rotation.set({ x: 0, y: 0, receivedAtMs: 0 }); };
  }, [active, rotation]);
  return rotation;
}
