import { elementSize } from './controlLayout';
import GameplayElement from './GameplayElement';
import { WaveReadout, PlayerVitals, BossReadout } from './GameHudVisuals';
import BossHitHUD from './BossHitHUD';
import GameUIOpacity from './GameUIOpacity';
import UpgradeIcon from './UpgradeIcon';
import RunResultPanel from './RunResultPanel';
import { createRunId } from '../game/scores';
import { type PurgatorioState, type SpecialEnemyId } from '../game/purgatorio';
import FrenesisHUD from './FrenesisHUD';
import { ENEMY_DEFS } from '../game/enemyCatalog';
import PurgatorioInterlude from './PurgatorioInterlude';
import type { SkImage } from '@shopify/react-native-skia';
import BossPresentation, { type BossCard } from './BossPresentation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { chooseUpgrade, UPGRADE_INFO, type SurvivalState } from '../game/survival';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';
import { useGameAudio } from './AudioProvider';
import { BattleAudio } from './BattleAudio';

type Snapshot = {
  frenesis: { active: boolean; hp: number };
  purgatorio: PurgatorioState | null;
  wave: number; remaining: number; hp: number; maxHp: number; armor:number; level: number; xp: number; xpNeeded: number;
  endingReady: boolean; choices: string[]; offerId: number; mode: SurvivalState['mode']; boss: { name: string; hp: number; maxHp: number; powered: boolean; members: { name: string; hp: number; maxHp: number }[] } | null;
  presentation: BossCard | null; difficulty: SurvivalState['difficulty']; events: SurvivalState['events'];
};
function snapshot(s: SurvivalState): Snapshot {
  'worklet';
  let remaining = s.encounter.remaining;
  for (const npc of s.encounter.enemies) if (npc.active && npc.action !== 'death') remaining++;
  // Summoned normal skeletons count as remaining enemies, separately from the named
  // principal boss's health. Otherwise a boss wave could misleadingly show zero.
  remaining += s.minibosses?.filter(m => m.phase !== 'death').length ?? 0;
  const pack = (s.minibosses ?? []).filter(b => b.packMember);
  const members = [s.boss, s.partner, ...pack].filter(b => b != null);
  const leader = s.boss ?? s.partner;
  const paired = Boolean(s.partner);
  const livingHp = (b: NonNullable<SurvivalState['boss']>) => { 'worklet'; return b.phase === 'death' ? 0 : Math.max(0, b.hp); };
  const boss = leader ? {
    name: s.encounterName || leader.name,
    hp: members.reduce((sum, b) => sum + livingHp(b), 0) + (leader.id === 'bomb-droid' ? (s.boss?.packRemaining ?? 0) * ENEMY_DEFS['bomb-droid'].hp : 0),
    maxHp: (s.encounterMaxHp ?? 0) > 0 ? s.encounterMaxHp! : members.reduce((sum, b) => sum + b.maxHp, 0),
    powered: members.some(b => (b.powerPhase ?? 0) > 0 || b.siblingRage === true),
    members: paired ? members.map(b => ({ name: b.name, hp: livingHp(b), maxHp: b.maxHp })) : [],
  } : null;
  return { frenesis: { active: s.frenesis?.active ?? false, hp: s.frenesis?.hp ?? 0 }, purgatorio: s.purgatorio ?? null, wave: s.encounter.wave, remaining, hp: s.hp, maxHp: s.maxHp,armor:s.armor??0,
    level: s.level, xp: s.xp, xpNeeded: s.xpNeeded, endingReady: !s.ending || s.ending.ready, mode: s.mode, choices: s.choices, offerId: s.upgradeOfferId,
    boss,
    presentation: s.presentation && s.boss ? { id: s.boss.id, name: s.encounterName || s.boss.name, entityId: s.presentation.entityId } : null,
    difficulty: s.difficulty, events: s.events };
}
export default function SurvivalHUD({ practice=false,survival, active, visible, onMode, onRetry, onExit, images, onPurgatorioClear, clock, onChangeDifficulty, runId: providedRunId, onAudioPrepared,onResumeAfterChoice,resumeBlocked }: {
  practice?:boolean; onAudioPrepared?:(completed:number,total:number)=>void; onResumeAfterChoice?:()=>void;resumeBlocked?:SharedValue<boolean>;
  runId?: string; clock?: SharedValue<{ running: boolean; firstFrame: boolean }>;
  onPurgatorioClear?: (id: SpecialEnemyId) => void;
  images?: SkImage[] | null; survival: SharedValue<SurvivalState>; active: boolean; visible: boolean;
  onChangeDifficulty?: () => void; onMode: (mode: SurvivalState['mode'], endingReady?: boolean) => void; onRetry?: () => void; onExit?: () => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [layout, setLayout] = useState({ width: windowWidth, height: windowHeight, windowWidth, windowHeight });
  const { width, height } = layout.windowWidth === windowWidth && layout.windowHeight === windowHeight ? layout : { width: windowWidth, height: windowHeight };
  const { playUi } = useGameAudio();
  const [hud, setHud] = useState(() => snapshot(survival.value));
  const acknowledgedClear = useRef(0);
  const [fallbackRunId] = useState(createRunId);
  const runId = providedRunId ?? fallbackRunId;
  const update = useCallback((next: Snapshot) => {
    // Process each queued UI-thread victory before React batches HUD renders.
    // A delayed JS frame must not skip the frontier's earlier unlock.
    const run = next.purgatorio;
    if (run?.lastClearedId && run.cleared > acknowledgedClear.current) {
      acknowledgedClear.current = run.cleared;
      onPurgatorioClear?.(run.lastClearedId);
    }
    // A queued RN callback can arrive after pause/intro completion. Render the
    // current simulation, never re-open an earlier card from its old snapshot.
    setHud(snapshot(survival.value));
  }, [onPurgatorioClear,survival]);
  useAnimatedReaction(() => {
    const s = survival.value;
    let count = s.encounter.remaining + (s.minibosses?.filter(m => m.phase !== 'death').length ?? 0);
    for (const npc of s.encounter.enemies) if (npc.active && npc.action !== 'death') count++;
    const e = s.events;
    return [s.armor??0,s.frenesis?.active ?? false, s.frenesis?.hp ?? 0, s.encounter.wave, count, s.hp, s.maxHp, s.level, s.xp, s.xpNeeded, s.mode, s.ending?.ready ?? true,
      s.boss?.hp ?? 0, s.minibosses?.filter(b=>b.packMember).reduce((sum,b)=>sum+Math.max(0,b.hp),0) ?? 0, s.boss?.packRemaining ?? 0, s.boss?.name ?? '', s.boss?.phase ?? '', s.boss?.powerPhase ?? 0, s.boss?.siblingRage ?? false, s.partner?.hp ?? 0, s.partner?.phase ?? '', s.partner?.powerPhase ?? 0, s.partner?.siblingRage ?? false, s.encounterName ?? '', s.encounterMaxHp ?? 0, e.soundSerial??0,e.electricCharge??0,e.electricImpact??0,e.eventStart??0,e.eventComplete??0,e.eventCue??0,e.attack, e.damage, e.kill, e.pickup, e.level, e.chest, e.wave, e.boss, e.dash ?? 0, e.bossAttack ?? 0, e.death ?? 0, s.upgradeOfferId, e.bossIntro ?? 0, s.presentation?.entityId ?? 0, e.shipAlarm ?? 0, e.zoneReward ?? 0, e.bossHit ?? 0, e.bossPhase ?? 0, e.bossBeep ?? 0, s.purgatorio?.number ?? 0, s.purgatorio?.cleared ?? 0, s.purgatorio?.phase ?? '', s.purgatorio?.currentId ?? ''].join('|');
  }, (key, previous) => { if (key !== previous) scheduleOnRN(update, snapshot(survival.value)); }, [survival, update]);
  useEffect(() => onMode(hud.mode, hud.endingReady), [hud.mode, hud.endingReady, onMode]);
  const compact = width < 740 || height < 360;
  return <>
    <BattleAudio onPrepared={onAudioPrepared} active={active} suspended={hud.mode !== 'playing'} dead={hud.mode === 'dead'} events={hud.events} />
    {visible && <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={e => { const { width, height } = e.nativeEvent.layout; setLayout(old => old.width === width && old.height === height ? old : { width, height, windowWidth, windowHeight }); }}>
      <GameUIOpacity>
      <GameplayElement id="wave" viewport={{width,height}}><WaveReadout wave={hud.wave} run={hud.purgatorio} remaining={hud.remaining} width={elementSize('wave',{left:0,top:0,width,height}).width}/></GameplayElement>
      <GameplayElement id="vitals" viewport={{width,height}}><View style={{flex:1,justifyContent:'flex-end'}}><PlayerVitals hud={hud}/></View></GameplayElement>
      {hud.boss&&<BossHitHUD survival={survival}><GameplayElement id="boss" viewport={{width,height}}><BossReadout boss={hud.boss} width={Math.min(240,width*.33)}/></GameplayElement></BossHitHUD>}
      </GameUIOpacity>
      <FrenesisHUD viewport={{width,height}} survival={survival} active={active&&hud.mode==='playing'} clock={clock}/>
      {hud.purgatorio?.phase === 'between' && <PurgatorioInterlude run={hud.purgatorio} survival={survival} />}
      {active && hud.presentation && images && <BossPresentation key={hud.presentation.entityId} card={hud.presentation} survival={survival} images={images} />}
      {hud.mode === 'upgrade' && <View testID="upgrade-modal" accessibilityViewIsModal style={s.veil}>
        <UIFrame variant="panel" style={[s.modal, { maxHeight: height - 24 }]}>
          <PixelText text={`Nivel ${hud.level}`} size={compact ? 22 : 27} color="#e0cfb0" />
          <PixelText text="Elige un power up" size={13} color="#bac8b6" />
          <View style={s.cards}>{hud.choices.map(id => {
            const info = UPGRADE_INFO[id as keyof typeof UPGRADE_INFO];
            const cardWidth = Math.min(205, (width - 90) / 3);
            return <Pressable key={id} accessibilityRole="button" accessibilityLabel={info.name} onPressIn={() => playUi()}
              onPress={() => { const offer = hud.offerId; scheduleOnUI(() => { 'worklet'; if(resumeBlocked?.value)return;const current=survival.value,next=chooseUpgrade(current,id,offer);if(next!==current){if(next.mode==='playing'){resumeBlocked?.set(true);clock?.set({running:false,firstFrame:true});}survival.set(next);if(next.mode==='playing'&&onResumeAfterChoice)scheduleOnRN(onResumeAfterChoice);} }); }}>
              <UIFrame variant="button" style={[s.card, { width: cardWidth, minHeight: compact ? 116 : 140 }]}>
                <UpgradeIcon id={id} size={compact?26:32}/>
                <PixelText text={info.name} size={compact ? 15 : 18} color="#e1d9b3" maxWidth={cardWidth - 24} />
                <PixelText text={info.description} size={compact ? 11 : 12} color="#b6c5b5" maxWidth={cardWidth - 24} />
              </UIFrame>
            </Pressable>;
          })}</View>
        </UIFrame>
      </View>}

    </View>}
    {!practice&&(hud.mode === 'dead' || hud.mode === 'won') && <RunResultPanel survival={survival} runId={runId} visible={visible && hud.endingReady} onRetry={onRetry} onExit={onExit} onChangeDifficulty={onChangeDifficulty} />}
  </>;
}
const s = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFill, backgroundColor: '#04080bea', alignItems: 'center', justifyContent: 'center' },
  modal: { padding: 18, gap: 14, alignItems: 'center', backgroundColor: '#0c1517' },
  cards: { flexDirection: 'row', gap: 10 }, card: { padding: 12, gap: 14, justifyContent: 'center' },
  action: { minWidth: 230, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
