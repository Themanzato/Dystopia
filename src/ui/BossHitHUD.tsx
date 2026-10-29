import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated,{useAnimatedStyle,type SharedValue}from'react-native-reanimated';
import type{SurvivalState}from'../game/survival';
import{bossHitOffset}from'../game/bossHitFeedback';

/** Wrap only the boss name/bar, not the rest of the player's HUD. */
export default function BossHitHUD({survival,children,style}:{survival:SharedValue<SurvivalState>;children:React.ReactNode;style?:StyleProp<ViewStyle>}){
  const motion=useAnimatedStyle(()=>{
    const state=survival.value;
    let remaining=Math.max(state.boss?.hitFlashMs??0,state.partner?.hitFlashMs??0);
    for(const mini of state.minibosses)if(mini.packMember||mini.id==='the-plague')remaining=Math.max(remaining,mini.hitFlashMs??0);
    const offset=bossHitOffset(remaining);
    return {transform:[{translateX:offset.x},{translateY:offset.y}]};
  });
  return <Animated.View testID="boss-hit-hud" pointerEvents="box-none" style={[StyleSheet.absoluteFill,style,motion]}>{children}</Animated.View>;
}
