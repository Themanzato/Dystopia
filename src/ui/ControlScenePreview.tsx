import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Fill, Group, useImage } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { Scene } from '../game/Scene';
import { cameraScale } from '../game/camera';
import { createPlayer, playerFrame, PLAYER_CELL, PLAYER_SCALE } from '../game/player';
import type { RenderActor } from '../game/renderTypes';
import PixelText from './PixelText';
const HERO = require('../../assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png');
/** Static real map and Swordmaster: no encounter, simulation, audio or input. */
export default React.memo(function ControlScenePreview({ width, height }: { width: number; height: number }) {
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []), onError = useCallback(() => setFailed(true), []);
  const image = useImage(HERO, onError), hero = useMemo(() => createPlayer(), []);
  const actors = useSharedValue<RenderActor[]>([{ id: 0, image: 0, source: playerFrame(hero), x: hero.x, y: hero.y, depth: hero.y,
    scale: PLAYER_SCALE, pivotX: PLAYER_CELL.pivotX, pivotY: PLAYER_CELL.pivotY, facingX: 1, visible: true }]);
  const images = useMemo(() => image ? [image] : [], [image]);
  const scale = cameraScale({ width, height });
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#513a3d' }]} testID="control-scene-preview">
    <Canvas style={StyleSheet.absoluteFill}><Fill color="#513a3d" />
      <Group transform={[{ translateX: width / 2 - hero.x * scale }, { translateY: height / 2 - hero.y * scale }, { scale }]}>
        {image && <Scene active={false} previewTimeMs={0} actors={actors} actorImages={images} actorCapacity={1} onError={onError} onReady={onReady} />}
      </Group><Fill color="#120b14" opacity={0.22} />
    </Canvas>
    {(!ready || failed) && <View style={{ position: 'absolute', left: width / 2 - 110, top: height / 2 + 45 }}><PixelText text={failed ? 'Vista previa no disponible' : 'Cargando ciudad...'} size={12} maxWidth={220} /></View>}
  </View>;
});
