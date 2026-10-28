import React, { useMemo } from 'react';
import { Animated, Image, View, type ImageStyle } from 'react-native';
import { PIXEL_FONT_SOURCE, preloadPixelFont } from './pixelFontAsset';
import { PIXEL_FONT_HEIGHT, PIXEL_FONT_WIDTH } from './pixelGlyphs';
import { layoutPixelText, pixelFlickerIndices } from './pixelTextLayout';
import { usePixelFlicker } from './usePixelFlicker';
import type { PixelTextProps } from './pixelTextTypes';

const nearest: ImageStyle & { imageRendering: 'pixelated' } = { imageRendering: 'pixelated' };
export type PixelLabelSpec = Pick<PixelTextProps,'text'|'size'|'maxWidth'|'align'>;
/** Web labels share the already-prefetched atlas and deterministic glyph layout. */
export async function preparePixelLabels(specs: readonly PixelLabelSpec[], progress?: (completed:number,total:number)=>void): Promise<void> {
  await preloadPixelFont();
  progress?.(0,specs.length);
  for(let index=0;index<specs.length;index++){
    const spec=specs[index];layoutPixelText(spec.text,spec.size??18,spec.maxWidth,spec.align??'left');
    progress?.(index+1,specs.length);
  }
}
/** Clip the shared atlas directly in browsers; no CanvasKit surfaces or encoders. */
export default function PixelText({ text, size = 18, color, maxWidth, dim = false, flicker = false,
  active = true, align = 'left', testID, accessibilityRole = 'text', onReady, onError }: PixelTextProps) {
  const tintColor = color ?? (dim ? '#99a18e' : undefined);
  const layout = useMemo(() => layoutPixelText(text, size, maxWidth, align), [text, size, maxWidth, align]);
  const indices = useMemo(() => flicker ? pixelFlickerIndices(text, layout.glyphs.length) : [], [flicker, text, layout]);
  const opacity = usePixelFlicker(active, flicker);
  return <View accessible accessibilityRole={accessibilityRole} accessibilityLabel={text} testID={testID}
    pointerEvents="none" style={{ width: layout.width, height: layout.height, opacity: dim ? 0.7 : 1 }}>
    {layout.glyphs.map((glyph, index) => {
      const fault = indices.indexOf(glyph.index);
      return <Animated.View key={glyph.index} accessible={false} style={{ position: 'absolute', overflow: 'hidden',
        left: glyph.x, top: glyph.y, width: glyph.width, height: glyph.height, opacity: fault < 0 ? 1 : opacity[fault] }}>
        <Image accessible={false} source={PIXEL_FONT_SOURCE} resizeMode="stretch" fadeDuration={0}
          onLoad={index === 0 ? onReady : undefined}
          onError={event => onError?.(new Error(event.nativeEvent.error))}
          style={[nearest, { position: 'absolute', left: -glyph.source.x * layout.scale, top: -glyph.source.y * layout.scale,
            width: PIXEL_FONT_WIDTH * layout.scale, height: PIXEL_FONT_HEIGHT * layout.scale, tintColor }]} />
      </Animated.View>;
    })}
  </View>;
}
