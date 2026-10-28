import React, { useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { UI_ASSETS, UI_FRAME_CROPS, UI_ICON_CROPS, UI_ORNAMENT_CROP, UI_WORD_CROPS, sliderSource,
  type UIFrameVariant, type UIIconName, type UIRect, type UIWordName } from './uiAssets';

// Browser UI uses clipped original PNGs. It never creates a CanvasKit surface,
// WebGL context or image encoder while the animated scene is rendering.
export function UIArtProvider({ children }: { children: ReactNode }) { return <>{children}</>; }

type Sheet = keyof typeof UI_ASSETS;
type Slice = { source: UIRect; destination: UIRect };
function sheetSize(sheet: Sheet) {
  if (sheet === 'borders') return { width: 336, height: 272 };
  if (sheet === 'sliders') return { width: 525, height: 48 };
  if (sheet.startsWith('icon')) return { width: 32, height: 32 };
  return { width: 93, height: 33 };
}
const nearest: ImageStyle & { imageRendering: 'pixelated' } = { imageRendering: 'pixelated' };
function Sprite({ sheet, source, destination }: { sheet: Sheet; source: UIRect; destination: UIRect }) {
  if (destination.width <= 0 || destination.height <= 0) return null;
  const size = sheetSize(sheet);
  const sx = destination.width / source.width, sy = destination.height / source.height;
  return <View pointerEvents="none" accessible={false} style={{ position: 'absolute', overflow: 'hidden',
    left: destination.x, top: destination.y, width: destination.width, height: destination.height }}>
    <Image accessible={false} source={UI_ASSETS[sheet]} resizeMode="stretch" style={[nearest, {
      position: 'absolute', left: -source.x * sx, top: -source.y * sy,
      width: size.width * sx, height: size.height * sy,
    }]} />
  </View>;
}

// Source and destination use independent edge lengths, preserving each corner
// instead of stretching the entire frame. Crops never include neighboring art.
export function nineSlice(source: UIRect, width: number, height: number, cap: number, scale = 1): Slice[] {
  const corner = Math.min(cap * scale, width / 2, height / 2);
  const sw = [cap, source.width - 2 * cap, cap], sh = [cap, source.height - 2 * cap, cap];
  const dw = [corner, Math.max(0, width - 2 * corner), corner], dh = [corner, Math.max(0, height - 2 * corner), corner];
  const slices: Slice[] = [];
  let sy = source.y, dy = 0;
  for (let row = 0; row < 3; row++) {
    let sx = source.x, dx = 0;
    for (let column = 0; column < 3; column++) {
      slices.push({ source: { x: sx, y: sy, width: sw[column], height: sh[row] },
        destination: { x: dx, y: dy, width: dw[column], height: dh[row] } });
      sx += sw[column]; dx += dw[column];
    }
    sy += sh[row]; dy += dh[row];
  }
  return slices;
}
export function UIFrame({ children, style, variant = 'panel' }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; variant?: UIFrameVariant;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frame = UI_FRAME_CROPS[variant];
  const slices = useMemo(() => size.width > 0 && size.height > 0
    ? nineSlice(frame, size.width, size.height, frame.cap, frame.scale) : [], [frame, size]);
  return <View style={[styles.frame, variant === 'primary' && styles.primary, variant === 'danger' && styles.danger, style]}
    onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }}>
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      {slices.map((slice, index) => <Sprite key={index} sheet={frame.sheet} {...slice} />)}
    </View>
    {children}
  </View>;
}
function ArtCrop({ sheet, source, width, height, contain = false, opacity = 1 }: {
  sheet: Sheet; source: UIRect; width: number; height: number; contain?: boolean; opacity?: number;
}) {
  const scale = Math.min(width / source.width, height / source.height);
  const drawWidth = contain ? source.width * scale : width;
  const drawHeight = contain ? source.height * scale : height;
  return <View pointerEvents="none" accessible={false} style={{ width, height, opacity, overflow: 'hidden' }}>
    <Sprite sheet={sheet} source={source} destination={{ x: (width - drawWidth) / 2, y: (height - drawHeight) / 2,
      width: drawWidth, height: drawHeight }} />
  </View>;
}
export function UIWord({ word, scale = 1.5, width }: { word: UIWordName; scale?: number; width?: number }) {
  const source = UI_WORD_CROPS[word], drawWidth = width ?? source.width * scale;
  return <ArtCrop sheet={word} source={source} width={drawWidth} height={source.height * drawWidth / source.width} />;
}
export function UIIcon({ icon, size = 24 }: { icon: UIIconName; size?: number }) {
  const source = UI_ICON_CROPS[icon];
  return <ArtCrop sheet={source.sheet} source={source} width={size} height={size} contain />;
}
export function UISliderArt({ value, muted = false, width, height = 40 }: {
  value: number; muted?: boolean; width: number; height?: number;
}) {
  return <ArtCrop sheet="sliders" source={sliderSource(value)} width={width} height={height} contain opacity={muted ? 0.38 : 1} />;
}
export function UIOrnament({ width = 136 }: { width?: number }) {
  return <ArtCrop sheet="borders" source={UI_ORNAMENT_CROP} width={width}
    height={width * UI_ORNAMENT_CROP.height / UI_ORNAMENT_CROP.width} />;
}
const styles = StyleSheet.create({
  frame: { backgroundColor: 'rgba(14,15,20,0.94)' },
  primary: { backgroundColor: 'rgba(40,36,39,0.98)' },
  danger: { backgroundColor: 'rgba(47,20,25,0.96)' },
});
