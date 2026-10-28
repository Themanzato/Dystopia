import React, { useEffect, useMemo } from 'react';
import { Atlas, FilterMode, Group, MipmapMode, Skia, rect, type SkImage } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { useSharedImageState } from '../ui/sharedImages';
import { bossAttack } from './bossAttacks';
import { BOSS_FX_ASSETS, BOSS_FX_KEYS, BOSS_FX_CLIPS, fxFrame, hazardDraws, type FxDraw } from './bossEffects';
import type { SurvivalState } from './survival';
import type { PlayerState } from './player';

const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };
function useEffectImage(source: number, enabled: boolean, onError?: (error: Error) => void) {
  const { image, error } = useSharedImageState(source, enabled);
  useEffect(() => { if (enabled && error) onError?.(new Error('No se pudo cargar un efecto de combate.')); }, [enabled, error, onError]);
  return image;
}
/** Fixed hooks, one shared decode per original sheet. Actor readiness also waits for these effects. */
export function useBossEffectImages(enabled: boolean, onError?: (error: Error) => void): SkImage[] | null {
  const a = useEffectImage(BOSS_FX_ASSETS.electric, enabled, onError);
  const b = useEffectImage(BOSS_FX_ASSETS.sageDark, enabled, onError);
  const c = useEffectImage(BOSS_FX_ASSETS.sageCyan, enabled, onError);
  const d = useEffectImage(BOSS_FX_ASSETS.beam, enabled, onError);
  const e = useEffectImage(BOSS_FX_ASSETS.bomb, enabled, onError);
  const f = useEffectImage(BOSS_FX_ASSETS.slam, enabled, onError);
  const g = useEffectImage(BOSS_FX_ASSETS.shock, enabled, onError);
  const h = useEffectImage(BOSS_FX_ASSETS.bow, enabled, onError);
  const i = useEffectImage(BOSS_FX_ASSETS.volley, enabled, onError);
  const j = useEffectImage(BOSS_FX_ASSETS.poison, enabled, onError);
  const k = useEffectImage(BOSS_FX_ASSETS.indicator, enabled, onError);
  const l = useEffectImage(BOSS_FX_ASSETS.electroVolley, enabled, onError);
  return useMemo(() => a && b && c && d && e && f && g && h && i && j && k && l ? [a,b,c,d,e,f,g,h,i,j,k,l] : null, [a,b,c,d,e,f,g,h,i,j,k,l]);
}
function EffectAtlas({ image, index, draws }: { image: SkImage; index: number; draws: SharedValue<FxDraw[]> }) {
  const items = useDerivedValue(() => draws.value.filter(item => item.image === index));
  const sprites = useDerivedValue(() => items.value.map(item => rect(item.source.x, item.source.y, item.source.width, item.source.height)));
  const transforms = useDerivedValue(() => items.value.map(item => {
    const c = Math.cos(item.angle) * item.scale, s = Math.sin(item.angle) * item.scale;
    return Skia.RSXform(c, s, item.x - item.pivotX * c + item.pivotY * s, item.y - item.pivotX * s - item.pivotY * c);
  }));
  return <Atlas image={image} sprites={sprites} transforms={transforms} sampling={sampling} />;
}
/** Only bounded atlases and paths change on the UI thread; React never renders per hazard/frame. */
export function BossEffects({ survival, player, onError }: { survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>; onError?: (error: Error) => void }) {
  const images = useBossEffectImages(true, onError);
  const draws = useDerivedValue<FxDraw[]>(() => {
    const state = survival.value, result: FxDraw[] = [];
    for (const hazard of state.hazards ?? []) result.push(...hazardDraws(hazard));
    const bosses = [...(state.boss ? [state.boss] : []), ...(state.partner ? [state.partner] : []), ...state.minibosses];
    for (const boss of bosses) {
      if (boss.id !== 'archer-bandit' || boss.hp <= 0 || (boss.phase !== 'warning' && boss.phase !== 'attack')) continue;
      const move = bossAttack(boss.id, boss.attackIndex ?? 0);
      if (move.clip !== 'bow') continue;
      // The original bow is a separate layer, pivoted at the hand and aimed in world space.
      const frame = boss.phase === 'warning' ? Math.min(8, Math.floor(boss.phaseMs / 90)) : Math.min(9, 7 + Math.floor(boss.phaseMs / 120));
      const angle = boss.aimAngle;
      result.push({ image: 7, source: { x: frame * 114, y: 35, width: 29, height: 35 },
        x: boss.x + Math.cos(angle) * 18, y: boss.y - 28 + Math.sin(angle) * 18,
        pivotX: 12, pivotY: 18, scale: 2, angle });
    }
    const p = player.value;
    if ((state.poisonMs ?? 0) > 0) {
      const clip = BOSS_FX_CLIPS.widowPoison;
      result.push({ image: clip.image, source: fxFrame(clip, (state.clockMs % 1200) / 1200), x: p.x, y: p.y - 70,
        pivotX: clip.pivotX, pivotY: clip.pivotY, scale: 0.8, angle: 0 });
    }
    if ((state.stunMs ?? 0) > 0) {
      const clip = BOSS_FX_CLIPS.teleport;
      result.push({ image: clip.image, source: fxFrame(clip, ((state.clockMs % 600) / 600) * 0.65 + 0.2), x: p.x, y: p.y - 66,
        pivotX: clip.pivotX, pivotY: clip.pivotY, scale: 0.9, angle: 0 });
    }
    return result;
  });
  return <Group>
    {images && BOSS_FX_KEYS.map((key, index) => <EffectAtlas key={key} image={images[index]} index={index} draws={draws} />)}
  </Group>;
}
