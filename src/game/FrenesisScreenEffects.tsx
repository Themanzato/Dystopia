import React from 'react';
import { Group, Path, Skia, rect } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { FRENESIS } from './frenesis';
import type { SurvivalState } from './survival';
import type { PlayerState } from './player';

/** Short bursts of screen-space static behind HUD, never a persistent CRT filter. */
export default function FrenesisScreenEffects({ survival, player, view }: {
  survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>; view: Pick<SharedValue<{width:number;height:number}>, 'value'>;
}) {
  const staticLines = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make(), f = survival.value.frenesis, v = view.value;
    if (!f.active) return path.detach();
    const elapsed = FRENESIS.durationMs - f.remainingMs, cycle = elapsed % 2700;
    const burst = elapsed < 110 || cycle > 1850 && cycle < 1960 || f.teleport && f.teleport.elapsedMs < 80;
    if (!burst) return path.detach();
    const tick = Math.floor(elapsed / 28);
    for (let band = 0; band < 3; band++) {
      const y = (0.12 + ((tick * 17 + band * 29) % 76) / 100) * v.height;
      for (let i = 0; i < 8; i++) {
        const hash = (tick * 31 + i * 19 + band * 7) % 97;
        path.addRect(rect(hash / 100 * v.width, y + i % 3, 8 + hash % 53, 1 + i % 2));
      }
    }
    return path.detach();
  });
  const speed = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make(), f = survival.value.frenesis, v = view.value;
    if (!f.active) return path.detach();
    const elapsed = FRENESIS.durationMs - f.remainingMs, moving = player.value.action !== 'idle';
    for (let i = 0; i < 8; i++) {
      const offset = (elapsed * (moving ? 0.9 : 0.55) + i * 127) % (v.width * 0.18);
      const y = v.height * (0.08 + i / 9), length = moving ? 38 : 18;
      const x = i % 2 ? v.width - offset : offset;
      path.moveTo(x, y); path.lineTo(x + (i % 2 ? -length : length), y + (y - v.height / 2) * 0.04);
    }
    return path.detach();
  });
  return <Group><Path path={speed} color="#b8e0df" opacity={0.12} style="stroke" strokeWidth={1} />
    <Group transform={[{translateX:2}]}><Path path={staticLines} color="#e884bc" opacity={0.2} /></Group>
    <Group transform={[{translateX:-2}]}><Path path={staticLines} color="#55dcca" opacity={0.25} /></Group>
    <Path path={staticLines} color="#e9f1ef" opacity={0.18} />
  </Group>;
}
