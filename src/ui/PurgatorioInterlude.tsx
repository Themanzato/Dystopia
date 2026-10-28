import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { PURGATORIO_CONFIG, PURGATORIO_ROSTER, purgatorioName, type PurgatorioState } from '../game/purgatorio';
import type { SurvivalState } from '../game/survival';
import PixelText from './PixelText';
/** Driven only by the paused simulation clock, not an independent UI timer. */
export default function PurgatorioInterlude({run,survival}:{run:PurgatorioState;survival:SharedValue<SurvivalState>}) {
  const motion=useAnimatedStyle(()=>{
    const t=survival.value.purgatorio?.elapsedMs??PURGATORIO_CONFIG.transitionMs;
    return {opacity:Math.max(0,Math.min(1,t/180,(PURGATORIO_CONFIG.transitionMs-t)/260))};
  });
  return <Animated.View pointerEvents="none" testID="purgatorio-interlude" style={[s.veil,motion]}>
    <View style={s.rule}/><PixelText text={`Encuentro ${run.number}`} size={17} color="#bd9fac"/>
    <PixelText text={purgatorioName(run.currentId)} size={28} color="#e1c7c6" align="center" maxWidth={380}/>
    {run.cleared>=PURGATORIO_ROSTER.length&&<PixelText text="Aleatorio - dificultad aumentada" size={12} color="#b98c9c" maxWidth={380} align="center"/>}
    <View style={s.rule}/>
  </Animated.View>;
}
const s=StyleSheet.create({veil:{...StyleSheet.absoluteFill,backgroundColor:'#05040ae8',alignItems:'center',justifyContent:'center',gap:15},rule:{width:200,height:1,backgroundColor:'#75364f'}});