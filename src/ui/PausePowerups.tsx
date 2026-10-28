import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { SurvivalState } from '../game/survival';
import { activePowerups, POWERUP_DESCRIPTIONS, type Powerup } from '../game/activePowerups';
import { useCurrentRun } from './CurrentRun';
import UpgradeIcon from './UpgradeIcon';
import PixelBadge from './PixelBadge';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';

type InfoProps = { dismissToken?: number; onInfoOpenChange?: (open: boolean) => void };
function RunPowerups({ run, ...info }: { run: SharedValue<SurvivalState> } & InfoProps) {
  const [items, setItems] = useState(() => activePowerups(run.value));
  const update = useCallback((next: Powerup[]) => setItems(next), []);
  useAnimatedReaction(() => JSON.stringify(activePowerups(run.value)), (next, old) => {
    if (next !== old) scheduleOnRN(update, JSON.parse(next));
  }, [run, update]);
  return <PowerupGrid items={items} {...info} />;
}
export function PowerupGrid({ items, dismissToken, onInfoOpenChange }: { items: Powerup[] } & InfoProps) {
  const [selection, setSelection] = useState<{id:Powerup['id'];token?:number}|null>(null);
  const selectedId=selection?.token===dismissToken?selection?.id:null;
  const select=(id:Powerup['id']|null)=>setSelection(id?{id,token:dismissToken}:null);
  const selected = items.find(item => item.id === selectedId);
  const open = !!selected;
  useEffect(() => { onInfoOpenChange?.(open); }, [open, onInfoOpenChange]);
  return <Pressable testID="pause-powerups" onPress={() => select(null)} style={s.panel}>
    <PixelText text="Potenciadores activos" size={16} maxWidth={330} color="#d8adbd" />
    {!items.length ? <PixelText text="Sin potenciadores activos" size={12} color="#a5aaa6" maxWidth={270} /> : <ScrollView contentContainerStyle={s.grid}>
      {items.map(item => <UIFrame key={item.id} variant="button" style={s.card}>
        <Pressable onPress={() => select(item.id)} accessibilityRole="button" testID={`powerup-${item.id}`} accessibilityLabel={`${item.name}: ${item.value}${item.detail ? ', ' + item.detail : ''}, ${item.stacks} acumulaciones${item.remainingSeconds ? `, ${item.remainingSeconds} segundos, efecto total` : ''}`} style={s.content}>
          {item.id==='armor'?<PixelBadge kind="armor"/>:<UpgradeIcon id={item.id} size={32}/>}
          <PixelText text={item.value} size={12} color="#acdacb" maxWidth={88} align="center" />
          {!!item.remainingSeconds&&<PixelText text={`${item.remainingSeconds}s`} size={9} color="#a59da3"/>}
          {item.detail && <PixelText text={item.detail} size={8} color="#c99ed5" />}
        </Pressable>
      </UIFrame>)}
    </ScrollView>}
    {selected && <UIFrame variant="button" style={s.info}>
      <Pressable testID="powerup-info" onPress={() => {}} style={{ gap: 6 }}>
        <PixelText text={selected.name} size={15} maxWidth={300} color="#e0c6cd" />
        <PixelText text={POWERUP_DESCRIPTIONS[selected.id]} size={11} maxWidth={300} color="#bcb9b4" />
        <PixelText text={`${selected.value}${selected.detail ? ' / ' + selected.detail : ''} / x${selected.stacks}`} size={12} maxWidth={300} color="#acdacb" />
        {!!selected.remainingSeconds && <PixelText text={`${selected.remainingSeconds}s restantes`} size={10} color="#bcb9b4" />}
        <Pressable testID="powerup-info-close" accessibilityRole="button" accessibilityLabel="Cerrar información" onPress={() => select(null)} style={{paddingVertical:8}}><PixelText text="Cerrar" size={12} color="#d8adbd" /></Pressable>
      </Pressable>
    </UIFrame>}
  </Pressable>;
}
export default function PausePowerups(info: InfoProps) {
  const run = useCurrentRun();
  return run ? <RunPowerups run={run} {...info} /> : <PowerupGrid items={[]} {...info} />;
}
const s = StyleSheet.create({ panel: { flex: 1, maxWidth: 380, height: '100%', paddingVertical: 10, gap: 12 },
  info: { padding: 12, maxHeight: '60%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }, card: { width: 102, height: 102 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, padding: 5 } });
