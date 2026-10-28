import React from 'react';
import { View } from 'react-native';
import { Canvas, Image, FilterMode, MipmapMode } from '@shopify/react-native-skia';
import { useSharedImage } from './sharedImages';
import { rewardIconId, rewardIconSource } from './rewardIcons';

/** Exact original PNG and nearest sampling everywhere, including native screens. */
export default function UpgradeIcon({id,size=32}:{id:string;size?:number}) {
  const image=useSharedImage(rewardIconSource(id));
  return <View testID={`upgrade-icon-${rewardIconId(id)}`} pointerEvents="none" style={{width:size,height:size}}>
    {image&&<Canvas style={{width:size,height:size}} pointerEvents="none"><Image image={image} x={0} y={0} width={size} height={size} sampling={{filter:FilterMode.Nearest,mipmap:MipmapMode.None}}/></Canvas>}
  </View>;
}
