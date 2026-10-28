import React from 'react';
import { Image, View, type ImageStyle } from 'react-native';
import { rewardIconId, rewardIconSource } from './rewardIcons';

const nearest: ImageStyle & { imageRendering: 'pixelated' } = { imageRendering: 'pixelated' };

// Router evaluates menu modules before WithSkiaWeb finishes. Browser icons use
// the identical PNG registry without instantiating a Skia API before CanvasKit.
export default function UpgradeIcon({ id, size = 32 }: { id: string; size?: number }) {
  return <View testID={`upgrade-icon-${rewardIconId(id)}`} pointerEvents="none" style={{ width: size, height: size }}>
    <Image accessible={false} source={rewardIconSource(id)} resizeMode="contain" fadeDuration={0}
      style={[nearest, { width: size, height: size }]} />
  </View>;
}
