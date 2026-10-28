import GameplayElement from './GameplayElement';
import React, { useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { activateFrenesis, type SurvivalState } from '../game/survival';
import { FRENESIS } from '../game/frenesis';
import { FRENESIS_SOURCES } from '../game/frenesisAssets';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';

export default function FrenesisHUD({ survival, active, clock, viewport }: { survival: SharedValue<SurvivalState>; active: boolean; viewport?:{width:number;height:number}; clock?: SharedValue<{ running: boolean; firstFrame: boolean }> }) {
  const read = () => { 'worklet'; const f = survival.value.frenesis; return { ready: f.charge >= FRENESIS.capacity, active: f.active,
    amount: f.active ? Math.ceil(f.remainingMs / 1000) : Math.floor(f.charge) }; };
  const [status, setStatus] = useState(read);
  useAnimatedReaction(() => {
    // Read the shared value directly so Reanimated tracks this input on web and
    // native. Hiding the read in a captured function misses charge-only changes.
    const f = survival.value.frenesis;
    return {ready:f.charge >= FRENESIS.capacity,active:f.active,amount:f.active ? Math.ceil(f.remainingMs/1000) : Math.floor(f.charge)};
  }, (next, old) => {
    if (!old || next.ready !== old.ready || next.active !== old.active || next.amount !== old.amount) scheduleOnRN(setStatus,next);
  }, [survival]);
  const press = useMemo(() => Gesture.Tap().enabled(active).runOnJS(false).onEnd((_e, success) => {
    'worklet';
    if (success && (!clock || clock.value.running)) survival.set(activateFrenesis(survival.value));
  }), [active, survival, clock]);
  const flash = useAnimatedStyle(() => {
    const s = survival.value, f = s.frenesis;
    return { opacity: f.active ? 1 : f.charge >= FRENESIS.capacity ? 0.72 + 0.28 * Math.abs(Math.sin(s.clockMs / 150)) : 0.55,
      borderWidth: f.active || f.charge >= FRENESIS.capacity ? 2 : 0, borderColor: f.active ? '#76e6de' : '#ecd6fa' };
  });
  const fill = useAnimatedStyle(() => ({ width: `${(survival.value.frenesis.active ? survival.value.frenesis.remainingMs / FRENESIS.durationMs : survival.value.frenesis.charge / FRENESIS.capacity) * 100}%` }));
  return <GameplayElement id="frenesis" gesture={press} viewport={viewport}><FrenesisVisual status={status} flash={flash} fill={fill} active={active}/></GameplayElement>;
}
export function FrenesisVisual({status,flash,fill,active=true,preview=false}:{status:{active:boolean;ready:boolean;amount:number};flash?:ReturnType<typeof useAnimatedStyle>;fill?:ReturnType<typeof useAnimatedStyle>;active?:boolean;preview?:boolean}){
  return <View testID="frenesis-control" accessible={!preview} accessibilityRole={preview?undefined:"button"} accessibilityLabel={status.active ? `Frenesis activa: ${status.amount} segundos` : status.ready ? 'Frenesis lista: tocar para activar' : `Cargando Frenesis: ${status.amount} por ciento`}
    accessibilityState={{disabled: !active || !status.ready || status.active}} style={{ width: 54, height: 68 }} collapsable={false}>
    <Animated.View style={[{position:'absolute',left:3,top:12,width:48,height:48},flash]}><UIFrame variant={status.active || status.ready ? 'primary' : 'button'} style={{ width: 44, height: 44, overflow: 'hidden' }}>
      <Image source={FRENESIS_SOURCES[0]} fadeDuration={0} style={{ position: 'absolute', width: 1540 * 1.3, height: 46 * 1.3, left: 24 - 66 * 1.3, top: 39 - 44 * 1.3, resizeMode: 'stretch' }} />
    </UIFrame></Animated.View>
    <View pointerEvents="none" style={{ position: 'absolute', left: 4, right: 4, bottom: 10, height: 4, backgroundColor: '#30353e' }}><Animated.View testID="frenesis-charge" style={[{ height: 4, backgroundColor: status.ready ? '#ecd6fa' : '#6fcfc7' }, fill]} /></View>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 3 }}><PixelText text={status.active ? 'ACTIVA' : status.ready ? 'LISTA' : 'FRENESIS'} size={8} maxWidth={48} color={status.ready ? '#ecd6fa' : '#b5e9e3'} /></View>
    <View pointerEvents="none" style={{position:'absolute',bottom:0,left:3,width:48,alignItems:'center'}}><PixelText text={status.active ? `${status.amount} S` : status.ready ? 'TOCA' : `${status.amount}%`} size={8} color="#d8ece8" maxWidth={48} /></View>
  </View>;
}
