import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Atlas, Canvas, Fill, FilterMode, Group, MipmapMode, Rect, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { PLAYER_CELL } from '../game/player';
import type { Difficulty } from '../game/difficulty';
import type { WorkshopId } from '../game/workshop';
import { useSharedImageState } from './sharedImages';
import { sampleWorkshopPreview, workshopPreviewValues, type WorkshopPreviewValues } from './workshopPreviewModel';
import PixelText from './PixelText';

const HERO = require('../../assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png');
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

function Animation({ id, image, values, width, height, active }: {
  id: WorkshopId; image: SkImage; values: WorkshopPreviewValues; width: number; height: number; active: boolean;
}) {
  const clock = useSharedValue({ running: false, firstFrame: true, elapsedMs: 0 });
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const frame = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    const c = clock.value;
    if (!c.running) return;
    if (c.firstFrame) { clock.set({ ...c, firstFrame: false }); return; }
    clock.set({ ...c, elapsedMs: c.elapsedMs + Math.max(0, Math.min(40, timeSincePreviousFrame ?? 0)) });
  }, [clock]), false);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') clock.set({ ...clock.value, running: false, firstFrame: true });
      setForeground(state === 'active');
    });
    return () => listener.remove();
  }, [clock]);
  useEffect(() => {
    clock.set({ ...clock.value, running: active && foreground, firstFrame: true });
    frame.setActive(active && foreground);
    return () => { clock.set({ ...clock.value, running: false, firstFrame: true }); frame.setActive(false); };
  }, [active, foreground, frame, clock]);
  const sample = useDerivedValue(() => sampleWorkshopPreview(id, clock.value.elapsedMs, values));
  const scale = Math.max(1, Math.min(3, Math.floor(Math.min((width - 8) / PLAYER_CELL.width, (height - 44) / PLAYER_CELL.height) * 4) / 4));
  const foot = height - 24, originX = id === 'attack-servo' ? (width - PLAYER_CELL.width * scale) / 2 + PLAYER_CELL.pivotX * scale : width / 2;
  const sprites = useDerivedValue(() => [rect(sample.value.frame * PLAYER_CELL.width, sample.value.row * PLAYER_CELL.height, PLAYER_CELL.width, PLAYER_CELL.height)]);
  // Atlas RSXform is a rotation + uniform scale: a negative scos would also
  // invert Y. Mirror only X on a parent group, around the real foot pivot.
  const transforms = useDerivedValue(() => [Skia.RSXform(scale, 0, -PLAYER_CELL.pivotX * scale, foot - PLAYER_CELL.pivotY * scale)]);
  const bodyTransform = useDerivedValue(() => [{ translateX: Math.round(originX + sample.value.offset) }, { scaleX: sample.value.facing }]);
  const opacity = useDerivedValue(() => sample.value.opacity);
  const pulse = useDerivedValue(() => sample.value.impact * sample.value.opacity * .75);
  const chargeWidth = useDerivedValue(() => (width - 36) * sample.value.charge / 100);
  const gainedWidth = useDerivedValue(() => (width - 36) * sample.value.healthGain / values.health);
  const gainX = 18 + (width - 36) * values.baseHealth / values.health;
  return <Canvas testID="workshop-preview-canvas" style={{ width, height }} pointerEvents="none">
    <Fill color="#111017" />
    <Rect x={0} y={height - 34} width={width} height={34} color="#32262e" />
    <Rect x={10} y={height - 24} width={width - 20} height={2} color="#78616b" />
    <Rect x={Math.round(width / 2 - 36)} y={foot - 2} width={72} height={5} color="#121018" />
    {id === 'field-kit' && <Group>
      <Rect x={16} y={17} width={width - 32} height={12} color="#50313d" />
      <Rect x={18} y={19} width={(width - 36) * values.baseHealth / values.health} height={8} color="#b87389" />
      <Rect x={gainX} y={19} width={gainedWidth} height={8} color="#b5dcac" />
    </Group>}
    {id === 'frenesis-coil' && <Group>
      <Rect x={16} y={17} width={width - 32} height={12} color="#50313d" />
      <Rect x={18} y={19} width={chargeWidth} height={8} color="#b4cfde" />
    </Group>}
    <Group opacity={opacity} transform={bodyTransform}><Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling}/></Group>
    {id === 'attack-servo' && <Group opacity={pulse}>
      <Rect x={Math.min(width - 12, originX + 44 * scale)} y={foot - 19 * scale} width={4} height={4} color="#f0ded2" />
      <Rect x={Math.min(width - 8, originX + 47 * scale)} y={foot - 23 * scale} width={3} height={3} color="#b9a8a1" />
    </Group>}
  </Canvas>;
}

/** Dedicated visual model. It has no access to the wallet, player shared values,
 * simulation, purchases or progression, and never emits combat/audio events. */
export default function WorkshopPreview({ id, difficulty, width, height, active = true }: {
  id: WorkshopId; difficulty: Difficulty; width: number; height: number; active?: boolean;
}) {
  const { image, error } = useSharedImageState(HERO);
  const values = useMemo(() => workshopPreviewValues(id, difficulty), [id, difficulty]);
  const label = id === 'field-kit' ? values.blocked ? 'Vida única' : `${values.baseHealth} A ${values.health} VIDA`
    : id === 'attack-servo' ? `+${Math.round((values.attackMultiplier - 1) * 100)}% ATAQUES`
    : id === 'assault-boots' ? `+${Math.round((values.moveMultiplier - 1) * 100)}% MOVIMIENTO`
    : `${values.charge}% FRENESIS`;
  return <View testID="workshop-preview" accessibilityLabel={`Demostración visual: ${label}. No aplica mejoras ni realiza compras.`} pointerEvents="none" style={[styles.root, { width, height }]}>
    {image ? <Animation key={`${id}-${difficulty}`} id={id} image={image} values={values} width={width} height={height} active={active}/>
      : <View style={styles.fallback}><PixelText text={error ? 'Vista no disponible' : 'Cargando...'} size={10} maxWidth={width - 20} align="center"/></View>}
    <View style={styles.label}><PixelText text={label} size={Math.min(11, width / 17)} maxWidth={width - 16} color={values.blocked ? '#b88c9d' : '#d9c3b6'} align="center"/></View>
  </View>;
}
const styles = StyleSheet.create({ root: { backgroundColor: '#111017', overflow: 'hidden' }, label: { position: 'absolute', left: 8, right: 8, bottom: 5, alignItems: 'center' }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
