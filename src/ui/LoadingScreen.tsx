import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Atlas, Canvas, Circle, Fill, FilterMode, Group, LinearGradient, MipmapMode, RadialGradient, Skia, rect } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InfectedTitle from './InfectedTitle';
import MenuBackdrop from './MenuBackdrop';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';
import type { chooseLoading } from './loadingCatalog';
import { loadingEntrance, loadingFrame, loadingLayout } from './loadingPresentation';
import { useLoadingImage } from './loadingImages';
import { useLoadingMinimum } from './useLoadingMinimum';
import { LOADING_BANNER, LOADING_BANNER_SIZE } from './loadingArt';

type Props = {
  progress?: number; selection: ReturnType<typeof chooseLoading>;
  active: boolean;
  presented: boolean;
  ready: boolean;
  error: string | null;
  onReady: () => void;
  onExited: () => void;
  onDismiss: () => void;
};
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

export default function LoadingScreen({ progress=0, selection, active, presented, ready, error, onReady, onExited, onDismiss }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { entity, tip } = selection;
  const { image, error: imageError } = useLoadingImage(entity.source);
  const { image: banner, error: bannerError } = useLoadingImage(LOADING_BANNER);
  const [backgroundReady, setBackgroundReady] = useState(false);
  const backgroundLoaded = useCallback(() => setBackgroundReady(true), []);
  const [nameReady, setNameReady] = useState(false);
  const [tipReady, setTipReady] = useState(false);
  const nameLoaded = useCallback(() => setNameReady(true), []);
  const tipLoaded = useCallback(() => setTipReady(true), []);
  const artReady = Boolean((image || imageError) && (banner || bannerError) && nameReady && tipReady && backgroundReady);
  const layout = useMemo(() => loadingLayout(width, height, entity), [width, height, entity]);
  const minimumComplete = useLoadingMinimum(active && presented && artReady && !error);
  const notified = useRef(false);
  const time = useSharedValue(0);
  const running = useSharedValue(false);
  const firstFrame = useSharedValue(true);
  const frame = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!running.value) return;
    if (firstFrame.value || timeSincePreviousFrame === null) { firstFrame.set(false); return; }
    time.set(time.value + Math.max(0, Math.min(64, timeSincePreviousFrame)));
  }, [time, running, firstFrame]), false);
  useEffect(() => {
    // Enter during the reveal so the creature is already visible as darkness lifts.
    const enabled = active && artReady;
    running.set(enabled); firstFrame.set(true); frame.setActive(enabled);
    return () => { running.set(false); firstFrame.set(true); frame.setActive(false); };
  }, [active, artReady, frame, running, firstFrame]);
  useEffect(() => { if (artReady) onReady(); }, [artReady, onReady]);
  useEffect(() => {
    if (minimumComplete && ready && active && presented && !error && !notified.current) {
      notified.current = true;
      // Release the prepared destination directly; fades only introduce this card.
      running.set(false);
      onExited();
    }
  }, [minimumComplete, ready, active, presented, error, onExited,running]);

  const sceneOpacity=useDerivedValue(()=>running.value?1:0);
  const sprites = useDerivedValue(() => {
    const crop = loadingFrame(entity, time.value);
    return [rect(crop.x, crop.y, crop.width, crop.height)];
  });
  const transforms = useMemo(() => [Skia.RSXform(layout.scale, 0, layout.x, layout.y)], [layout]);
  const entityTransform = useDerivedValue(() => {
    const entry = loadingEntrance(width, layout.x, time.value);
    return [{ translateX: entry.x }, { translateY: entry.y }];
  });
  const mistTransform = useDerivedValue(() => [{ translateX: Math.sin(time.value / 10000) * 24 }]);
  const glow = useDerivedValue(() => 0.20 + Math.sin(time.value / 2300) * 0.025);
  const bannerScale = layout.bannerWidth / LOADING_BANNER_SIZE.width;
  const bannerHeight = LOADING_BANNER_SIZE.height * bannerScale;
  const bannerX = (width - layout.bannerWidth) / 2;
  const bannerY = height - bannerHeight - Math.max(0, insets.bottom);
  const bannerSprites = useMemo(() => [rect(0, 0, LOADING_BANNER_SIZE.width, LOADING_BANNER_SIZE.height)], []);
  const bannerTransforms = useMemo(() => [Skia.RSXform(bannerScale, 0, bannerX, bannerY)], [bannerScale, bannerX, bannerY]);
  const left = Math.max(26, insets.left + 14);
  const compact = width < 740 || height < 360;
  const tipWidth = Math.min(layout.bannerWidth * 0.86, width - insets.left - insets.right - 48);
  const tipSize = compact ? 13 : height >= 550 ? 18 : 15;
  const percentage=Math.max(0,Math.min(ready?100:99,Math.floor(progress)));
  return <View collapsable={false} testID="loading-screen" accessibilityViewIsModal accessibilityLabel="Cargando Dystopia" style={s.screen}>
    <MenuBackdrop active={false} onReady={backgroundLoaded} onError={backgroundLoaded} />
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={sceneOpacity}>
      <Fill color="rgba(3,5,7,0.42)" />
      <Fill><LinearGradient start={{ x: width * 0.35, y: 0 }} end={{ x: width, y: height }}
        colors={['rgba(6,10,12,0.65)', 'rgba(6,10,12,0.12)', 'rgba(6,10,12,0.35)']} /></Fill>
      <Group transform={mistTransform} opacity={glow}>
        <Circle cx={width * 0.83} cy={height * 0.31} r={height * 0.82}>
          <RadialGradient c={{ x: width * 0.83, y: height * 0.31 }} r={height * 0.82} colors={['#657563', 'transparent']} />
        </Circle>
      </Group>
      <Group transform={entityTransform}>
        <Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling} />
      </Group>
      <Fill><LinearGradient start={{ x: width * 0.39, y: 0 }} end={{ x: width * 0.65, y: 0 }}
        colors={['#060a0c', 'transparent']} /></Fill>
      <Fill><LinearGradient start={{ x: 0, y: height * 0.43 }} end={{ x: 0, y: height * 0.88 }}
        colors={['transparent', 'rgba(4,8,10,0.94)']} /></Fill>
      <Atlas image={banner} sprites={bannerSprites} transforms={bannerTransforms} sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.None }} />
      </Group>
    </Canvas>
    <View pointerEvents="none" style={[s.title, { left, top: height * 0.29, width: layout.titleWidth }]}>
      <InfectedTitle width={layout.titleWidth} />
    </View>
    <View pointerEvents="none" testID="loading-entity-info" style={[s.name, { left: layout.infoLeft, top: layout.nameY,
      width: layout.infoWidth, paddingRight: Math.max(0, insets.right - 8) }]}>
      <PixelText text={entity.name} size={compact ? 21 : height >= 550 ? 30 : 25} color="#c4c6b4"
        maxWidth={layout.infoWidth - Math.max(0, insets.right - 8)} align={entity.category === 'Enemigos' ? 'left' : 'center'} accessibilityRole="header" onReady={nameLoaded} onError={nameLoaded} />
    </View>
    <View pointerEvents="none" testID="loading-tip" style={[s.tip, {
      left: (width - tipWidth) / 2, width: tipWidth, bottom: Math.max(16, insets.bottom + 12),
    }]}>
      <PixelText text={tip} size={tipSize} color="#a3aa94" maxWidth={tipWidth} align="center"
        dim flicker active={active} onReady={tipLoaded} onError={tipLoaded} />
    </View>
    <View testID="loading-progress" pointerEvents="none" style={{position:'absolute',left,width:Math.min(240,width*.34),top:Math.max(18,insets.top+12),gap:6}}>
      <PixelText text={`Cargando ${percentage}%`} size={compact?11:13} color="#bca9b4"/>
      <View accessibilityRole="progressbar" accessibilityLabel="Carga de la partida" accessibilityValue={{min:0,max:100,now:percentage}} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} style={{height:5,backgroundColor:'#211923',borderWidth:1,borderColor:'#6c4d60'}}><View style={{height:3,width:`${percentage}%`,backgroundColor:'#b26f89'}}/></View>
    </View>
    {error && <View style={s.failure} accessibilityRole="alert">
      <UIFrame style={s.failurePanel}>
        <PixelText text="No se pudo cargar" size={21} maxWidth={440} color="#c4c6b4" />
        <PixelText text={error} size={12} maxWidth={440} color="#9ca28e" />
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al menú" onPress={onDismiss}>
          <UIFrame variant="button" style={s.failureButton}><PixelText text="Volver al menú" size={16} /></UIFrame>
        </Pressable>
      </UIFrame>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: '#060a0c', overflow: 'hidden' },
  title: { position: 'absolute', alignItems: 'flex-start' },
  name: { position: 'absolute' }, tip: { position: 'absolute' },
  failure: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,5,7,0.96)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  failurePanel: { padding: 24, gap: 18, width: '90%', maxWidth: 540 },
  failureButton: { minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center' },
});
