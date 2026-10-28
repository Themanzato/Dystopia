import { loadSharedImage, useSharedImage } from './sharedImages';
import React, { useEffect, useMemo } from 'react';
import { Animated, Image, PixelRatio, StyleSheet, View } from 'react-native';
import { FilterMode, MipmapMode, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { PIXEL_FONT_SOURCE } from './pixelFontAsset';
import { layoutPixelText, pixelFlickerIndices, type PixelGlyph } from './pixelTextLayout';
import { usePixelFlicker } from './usePixelFlicker';
import type { PixelTextProps } from './pixelTextTypes';

const cache = new Map<string, string>();
const imageIds = new WeakMap<SkImage, number>();
let nextId = 1;
function rasterText(image: SkImage, glyphs: PixelGlyph[], width: number, height: number): string | null {
  const ratio = PixelRatio.get();
  const pw = Math.max(1, Math.round(width * ratio)), ph = Math.max(1, Math.round(height * ratio));
  let id = imageIds.get(image);
  if (!id) { id = nextId++; imageIds.set(image, id); }
  const key = JSON.stringify([id, pw, ph, glyphs]);
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
  const surface = Skia.Surface.Make(pw, ph);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    canvas.scale(pw / width, ph / height);
    for (const glyph of glyphs) {
      const s = glyph.source;
      canvas.drawImageRectOptions(image, rect(s.x, s.y, s.width, s.height),
        rect(glyph.x, glyph.y, glyph.width, glyph.height), FilterMode.Nearest, MipmapMode.None);
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const uri = `data:image/png;base64,${snapshot.encodeToBase64()}`;
      cache.set(key, uri);
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
      return uri;
    } finally { snapshot.dispose(); }
  } finally { surface.dispose(); }
}
export type PixelLabelSpec = Pick<PixelTextProps,'text'|'size'|'maxWidth'|'align'>;
/** Prewarm exactly the raster cache used by native PixelText; no parallel font renderer. */
export async function preparePixelLabels(specs: readonly PixelLabelSpec[], progress?: (completed:number,total:number)=>void): Promise<void> {
  const image=await loadSharedImage(PIXEL_FONT_SOURCE);
  progress?.(0,specs.length);
  for(let index=0;index<specs.length;index++){
    const spec=specs[index],layout=layoutPixelText(spec.text,spec.size??18,spec.maxWidth,spec.align??'left');
    if(layout.width>0&&!rasterText(image,layout.glyphs,layout.width,layout.height))throw new Error(`No se pudo preparar el texto: ${spec.text}`);
    progress?.(index+1,specs.length);
  }
}
/** One cached raster for static letters, plus at most two small faulty-bulb overlays. */
export default function PixelText({ text, size = 18, color, maxWidth, dim = false, flicker = false,
  active = true, align = 'left', testID, accessibilityRole = 'text', onReady, onError }: PixelTextProps) {
  const image = useSharedImage(PIXEL_FONT_SOURCE, onError);
  const tintColor = color ?? (dim ? '#99a18e' : undefined);
  const layout = useMemo(() => layoutPixelText(text, size, maxWidth, align), [text, size, maxWidth, align]);
  const indices = useMemo(() => flicker ? pixelFlickerIndices(text, layout.glyphs.length) : [], [flicker, text, layout]);
  const opacity = usePixelFlicker(active, flicker);
  const rasters = useMemo(() => {
    if (!image || layout.width <= 0) return null;
    const selected = indices.map(index => layout.glyphs[index]);
    const base = rasterText(image, layout.glyphs.filter(glyph => !indices.includes(glyph.index)), layout.width, layout.height);
    const faults = selected.map(glyph => ({ ...glyph, uri: rasterText(image,
      [{ ...glyph, x: 0, y: 0 }], glyph.width, glyph.height) }));
    return { base, faults };
  }, [image, layout, indices]);
  useEffect(() => { if (rasters?.base) onReady?.(); }, [rasters, onReady]);
  return <View accessible accessibilityRole={accessibilityRole} accessibilityLabel={text} testID={testID}
    pointerEvents="none" style={{ width: layout.width, height: layout.height, opacity: dim ? 0.7 : 1 }}>
    {rasters?.base && <Image accessible={false} source={{ uri: rasters.base }} fadeDuration={0}
      style={[StyleSheet.absoluteFill, { tintColor }]} resizeMode="stretch" />}
    {rasters?.faults.map((glyph, index) => glyph.uri && <Animated.Image key={glyph.index} accessible={false}
      source={{ uri: glyph.uri }} fadeDuration={0} resizeMode="stretch" style={{ position: 'absolute',
        left: glyph.x, top: glyph.y, width: glyph.width, height: glyph.height, tintColor, opacity: opacity[index] }} />)}
  </View>;
}
