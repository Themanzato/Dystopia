import React from 'react';
import { Image, Platform, StyleSheet, View, type ImageStyle } from 'react-native';
import { prepareImage } from './prepareImage';
import { assetDeadline } from './assetDeadline';
export const CONTROL_ART = {
  attack: require('../../assets/ui/controls/pixel/attack.png'),
  dash: require('../../assets/ui/controls/pixel/dash.png'),
};
let prepared:Promise<void>|null=null;
export function prepareControlArt():Promise<void> {
  prepared??=Promise.all(Object.values(CONTROL_ART).map(source=>assetDeadline(expired=>prepareImage(source,expired)))).then(()=>{}).catch(error=>{prepared=null;throw error;});
  return prepared;
}
/** Integer-grid RGBA pixel art; originals remain available and unchanged. */
export function ControlArt({ kind,onReady,onError }: { kind: keyof typeof CONTROL_ART;onReady?:()=>void;onError?:(error:Error)=>void }) {
  const nearest=Platform.OS==='web'?{imageRendering:'pixelated'} as ImageStyle:undefined;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image source={CONTROL_ART[kind]} onLoad={onReady} onError={event=>onError?.(new Error(event.nativeEvent.error))} accessible={false} resizeMode="contain" fadeDuration={0} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' },nearest]} /></View>;
}
