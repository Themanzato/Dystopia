import React, { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { TITLE_CYCLE_MS, TITLE_GAP, TITLE_HEIGHT, TITLE_LETTERS, TITLE_WIDTH } from './titleAssets';

// Only three faulty bulbs flicker, at different moments. The other letters stay
// lit, preserving the title silhouette. Animation never rebuilds React per frame.
const FAULTY_LETTERS: Record<number, number> = { 1: 0.18, 3: 0.46, 6: 0.75 };
const PULSE_MS = [0, 45, 130, 180, 250, 390, 460, 620, 670, 820, 900];
const PULSE_LIGHT = [1, 0.12, 0.12, 1, 0.22, 1, 1, 0.08, 0.08, 1, 1];
export default function InfectedTitle({ width }: { width?: number } = {}) {
  const scale = width === undefined ? 1 : width / TITLE_WIDTH;
  const [clock] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(clock, {
      toValue: 1, duration: TITLE_CYCLE_MS, easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    }));
    if (AppState.currentState === 'active') animation.start();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') animation.start(); else animation.stop();
    });
    return () => { listener.remove(); animation.stop(); clock.stopAnimation(); };
  }, [clock]);
  return <View accessibilityRole="header" accessibilityLabel="Dystopia" style={[s.container, width !== undefined && { width, height: 72 * scale, marginBottom: 12 * scale }]} pointerEvents="none">
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.letters, { width: TITLE_WIDTH * scale, height: 94 * scale, top: 7 * scale }]}>
      {TITLE_LETTERS.map((letter, index) => {
        const left = TITLE_LETTERS.slice(0, index).reduce((offset, glyph) => offset + glyph.width + TITLE_GAP, 0);
        const start = FAULTY_LETTERS[index];
        const opacity = start === undefined ? 1 : clock.interpolate({
          inputRange: [0, ...PULSE_MS.map(ms => start + ms / TITLE_CYCLE_MS), 1],
          outputRange: [1, ...PULSE_LIGHT, 1],
        });
        return <View key={letter.character} style={{ position: 'absolute', left: left * scale, width: letter.width * scale, height: TITLE_HEIGHT * scale }}>
          <Image source={letter.source} fadeDuration={0} style={[s.glyph, { width: letter.width * scale, height: TITLE_HEIGHT * scale, tintColor: '#111d19', transform: [{ translateX: 2 * scale }, { translateY: 4 * scale }] }]} />
          <Animated.Image source={letter.source} fadeDuration={0} style={[s.glyph, { width: letter.width * scale, height: TITLE_HEIGHT * scale, opacity }]} />
        </View>;
      })}
    </View>
  </View>;
}
const s = StyleSheet.create({
  container: { width: 300, height: 94, marginBottom: 18 },
  letters: { width: TITLE_WIDTH, height: 94, top: 7 },
  glyph: { position: 'absolute', top: 0, left: 0, height: TITLE_HEIGHT, resizeMode: 'stretch' },
});
