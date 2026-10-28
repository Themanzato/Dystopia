import { useSharedImage } from './sharedImages';
import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Image, PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FilterMode, MipmapMode, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { UI_ASSETS, UI_FRAME_CROPS, UI_ICON_CROPS, UI_ORNAMENT_CROP, UI_WORD_CROPS, sliderSource,
  type UIFrameVariant, type UIIconName, type UIRect, type UIWordName } from './uiAssets';

type UIImages = Record<keyof typeof UI_ASSETS, SkImage | null>;
const ArtContext = createContext<UIImages | null>(null);

// Load each original once for every screen, including controls. Hook calls are
// deliberately static so this provider keeps the same hook order on all routes.
export function UIArtProvider({ children }: { children: ReactNode }) {
  const borders = useSharedImage(UI_ASSETS.borders);
  const blank = useSharedImage(UI_ASSETS.blank);
  const sliders = useSharedImage(UI_ASSETS.sliders);
  const start = useSharedImage(UI_ASSETS.start);
  const settings = useSharedImage(UI_ASSETS.settings);
  const resume = useSharedImage(UI_ASSETS.resume);
  const mainMenu = useSharedImage(UI_ASSETS.mainMenu);
  const back = useSharedImage(UI_ASSETS.back);
  const quit = useSharedImage(UI_ASSETS.quit);
  const continueWord = useSharedImage(UI_ASSETS.continue);
  const credits = useSharedImage(UI_ASSETS.credits);
  const iconSettings = useSharedImage(UI_ASSETS.iconSettings);
  const iconGamepad = useSharedImage(UI_ASSETS.iconGamepad);
  const iconVolume = useSharedImage(UI_ASSETS.iconVolume);
  const iconMuted = useSharedImage(UI_ASSETS.iconMuted);
  const iconCheck = useSharedImage(UI_ASSETS.iconCheck);
  const iconClose = useSharedImage(UI_ASSETS.iconClose);
  const iconMenu = useSharedImage(UI_ASSETS.iconMenu);
  const iconLeft = useSharedImage(UI_ASSETS.iconLeft);
  const iconRight = useSharedImage(UI_ASSETS.iconRight);
  const iconMusic = useSharedImage(UI_ASSETS.iconMusic);
  const images = useMemo<UIImages>(() => ({ borders, blank, sliders, start, settings, resume,
    mainMenu, back, quit, continue: continueWord, credits, iconSettings, iconGamepad, iconVolume,
    iconMuted, iconCheck, iconClose, iconMenu, iconLeft, iconRight, iconMusic }),
  [borders, blank, sliders, start, settings, resume, mainMenu, back, quit, continueWord, credits,
    iconSettings, iconGamepad, iconVolume, iconMuted, iconCheck, iconClose, iconMenu, iconLeft, iconRight, iconMusic]);
  return <ArtContext.Provider value={images}>{children}</ArtContext.Provider>;
}

function useArt() {
  const images = useContext(ArtContext);
  if (!images) throw new Error('La interfaz debe estar dentro de UIArtProvider.');
  return images;
}

type Slice = { source: UIRect; destination: UIRect };
// Keep the corners square and unchanged when the panel grows. A 9-slice only
// stretches edge runs and the transparent center, never an entire UI sheet.
export function nineSlice(source: UIRect, width: number, height: number, cap: number, scale = 1): Slice[] {
  const corner = Math.min(cap * scale, width / 2, height / 2);
  const sourceWidths = [cap, source.width - cap * 2, cap];
  const sourceHeights = [cap, source.height - cap * 2, cap];
  const destinationWidths = [corner, Math.max(0, width - corner * 2), corner];
  const destinationHeights = [corner, Math.max(0, height - corner * 2), corner];
  const slices: Slice[] = [];
  let sy = source.y;
  let dy = 0;
  for (let row = 0; row < 3; row++) {
    let sx = source.x;
    let dx = 0;
    for (let column = 0; column < 3; column++) {
      slices.push({ source: { x: sx, y: sy, width: sourceWidths[column], height: sourceHeights[row] },
        destination: { x: dx, y: dy, width: destinationWidths[column], height: destinationHeights[row] } });
      sx += sourceWidths[column];
      dx += destinationWidths[column];
    }
    sy += sourceHeights[row];
    dy += destinationHeights[row];
  }
  return slices;
}

// The UI is static. Rasterize only on load/resize/value changes and reuse PNGs
// at the device's physical resolution instead of allocating a GL Canvas per icon.
// Nearest sampling happens before displaying the 1:1 cached image.
const imageIds = new WeakMap<SkImage, number>();
let nextImageId = 1;
const rasterCache = new Map<string, string>();
function rasterArt(image: SkImage, slices: Slice[], width: number, height: number): string | null {
  const ratio = PixelRatio.get();
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  let id = imageIds.get(image);
  if (!id) { id = nextImageId++; imageIds.set(image, id); }
  const key = JSON.stringify([id, pixelWidth, pixelHeight, slices]);
  const existing = rasterCache.get(key);
  if (existing) { rasterCache.delete(key); rasterCache.set(key, existing); return existing; }
  const surface = Skia.Surface.Make(pixelWidth, pixelHeight);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('transparent'));
    canvas.scale(pixelWidth / width, pixelHeight / height);
    for (const { source: s, destination: d } of slices) {
      if (d.width <= 0 || d.height <= 0) continue;
      canvas.drawImageRectOptions(image, rect(s.x, s.y, s.width, s.height),
        rect(d.x, d.y, d.width, d.height), FilterMode.Nearest, MipmapMode.None);
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const uri = `data:image/png;base64,${snapshot.encodeToBase64()}`;
      rasterCache.set(key, uri);
      if (rasterCache.size > 128) rasterCache.delete(rasterCache.keys().next().value!);
      return uri;
    } finally { snapshot.dispose(); }
  } finally { surface.dispose(); }
}

export function UIFrame({ children, style, variant = 'panel' }: {
  children?: ReactNode; style?: StyleProp<ViewStyle>; variant?: UIFrameVariant;
}) {
  const images = useArt();
  const frame = UI_FRAME_CROPS[variant];
  const image = images[frame.sheet];
  const [size, setSize] = useState({ width: 0, height: 0 });
  const uri = useMemo(() => image && size.width > 0 && size.height > 0
    ? rasterArt(image, nineSlice(frame, size.width, size.height, frame.cap, frame.scale), size.width, size.height)
    : null, [image, frame, size]);
  return <View style={[styles.frame, variant === 'primary' && styles.primary,
    variant === 'danger' && styles.danger, style]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
  }}>
    {uri && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image accessible={false} fadeDuration={0} source={{ uri }} resizeMode="stretch" style={StyleSheet.absoluteFill} /></View>}
    {children}
  </View>;
}

function ArtCrop({ image, source, width, height, contain = false, opacity = 1 }: {
  image: SkImage | null; source: UIRect; width: number; height: number; contain?: boolean; opacity?: number;
}) {
  const { x, y, width: sourceWidth, height: sourceHeight } = source;
  const uri = useMemo(() => {
    if (!image || width <= 0 || height <= 0) return null;
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = contain ? sourceWidth * scale : width;
    const drawHeight = contain ? sourceHeight * scale : height;
    return rasterArt(image, [{ source: { x, y, width: sourceWidth, height: sourceHeight },
      destination: { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight } }], width, height);
  }, [image, x, y, sourceWidth, sourceHeight, width, height, contain]);
  return <View pointerEvents="none" accessible={false} style={{ width, height, opacity }}>
    {uri && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Image accessible={false} fadeDuration={0} source={{ uri }} resizeMode="stretch" style={StyleSheet.absoluteFill} /></View>}
  </View>;
}

export function UIWord({ word, scale = 1.5, width }: { word: UIWordName; scale?: number; width?: number }) {
  const images = useArt();
  const source = UI_WORD_CROPS[word];
  const drawWidth = width ?? source.width * scale;
  return <ArtCrop image={images[word]} source={source} width={drawWidth} height={source.height * drawWidth / source.width} />;
}
export function UIIcon({ icon, size = 24 }: { icon: UIIconName; size?: number }) {
  const images = useArt();
  const source = UI_ICON_CROPS[icon];
  return <ArtCrop image={images[source.sheet]} source={source} width={size} height={size} contain />;
}
export function UISliderArt({ value, muted = false, width, height = 40 }: {
  value: number; muted?: boolean; width: number; height?: number;
}) {
  const images = useArt();
  return <ArtCrop image={images.sliders} source={sliderSource(value)} width={width} height={height} contain opacity={muted ? 0.38 : 1} />;
}
export function UIOrnament({ width = 136 }: { width?: number }) {
  const images = useArt();
  return <ArtCrop image={images.borders} source={UI_ORNAMENT_CROP} width={width}
    height={width * UI_ORNAMENT_CROP.height / UI_ORNAMENT_CROP.width} />;
}
const styles = StyleSheet.create({
  frame: { backgroundColor: 'rgba(14,15,20,0.94)' },
  primary: { backgroundColor: 'rgba(40,36,39,0.98)' },
  danger: { backgroundColor: 'rgba(47,20,25,0.96)' },
});
