import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { UIFrame, UIIcon } from './PixelArt';
import { ControlArt } from './ControlArt';
import type { ControlId } from './controlSettings';

/** One visual for the editor and the real touch controls. No gameplay callbacks. */
export function ControlVisual({ id, width, height, knobStyle, recoveryStyle,onReady,onError }: {
  onReady?:()=>void;onError?:(error:Error)=>void;
  id: ControlId; width: number; height: number; knobStyle?: ReturnType<typeof useAnimatedStyle<ViewStyle>>; recoveryStyle?: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
}) {
  const scale = width / (id === 'joystick' ? 144 : id === 'pause' ? 48 : id === 'attack' ? 88 : 72);
  return <View pointerEvents="none" style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
    {id === 'joystick' ? <View style={{ width: 128 * scale, height: 128 * scale, alignItems: 'center', justifyContent: 'center' }}>
      <UIFrame variant="panel" style={StyleSheet.absoluteFill} />
      <Animated.View style={[{ width: 46 * scale, height: 46 * scale }, knobStyle]}><UIFrame variant="primary" style={StyleSheet.absoluteFill} /></Animated.View>
    </View> : id === 'pause' ? <UIFrame variant="button" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><UIIcon icon="menu" size={24 * scale} /></UIFrame>
      : <><ControlArt kind={id} onReady={onReady} onError={onError}/>{id === 'dash' && <View style={{ position: 'absolute', width: 28 * scale, height: 2 * scale, bottom: 9 * scale, backgroundColor: '#384448' }}>
        <Animated.View style={[{ width: 28 * scale, height: 2 * scale, backgroundColor: '#b7ddda' }, recoveryStyle]} />
      </View>}</>}
  </View>;
}
export function ControlLayoutIcon() {
  return <View testID="control-layout-icon" pointerEvents="none" style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#755260' }}>
    <UIIcon icon="gamepad" size={22} />
    {[[0,0],[0,25],[25,0],[25,25]].map(([left,top]) => <View key={`${left}-${top}`} style={{ position: 'absolute', left, top, width: 4, height: 4, backgroundColor: '#d4a0b4' }} />)}
  </View>;
}
