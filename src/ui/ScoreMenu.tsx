import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RANKING_NAMES, survivalTime, type RankingMode } from '../game/scores';
import { WORKSHOP_ITEMS } from '../game/workshop';
import { DIFFICULTIES } from '../game/difficulty';
import { useScores, loadScores } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelBadge from './PixelBadge';
import PixelText from './PixelText';

const VISIBLE_RANKING_MODES: readonly RankingMode[] = ['survival','purgatorio-infinite'];

export default function ScoreMenu() {
  const { archive, ready, error } = useScores(), session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets();
  const [mode, setMode] = useState<RankingMode>('survival');
  const { width, height } = useWindowDimensions(), compact = width < 740 || height < 360;
  const usable = width - Math.max(16, insets.left) - Math.max(16, insets.right), cardWidth = Math.min(250, (usable - 20) / 3);
  return <View testID="scores-menu" style={[s.screen, { paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right), paddingTop: Math.max(10, insets.top), paddingBottom: Math.max(10, insets.bottom) }]}>
    <View style={s.header}><PixelBadge kind="record" /><PixelText text="Mejores puntuaciones" size={compact ? 23 : 29} maxWidth={usable - 150} />
      <Pressable accessibilityRole="button" accessibilityLabel="Volver al menú" onPressIn={() => audio.playUi()} onPress={session.closeSettings}><UIFrame variant="button" style={s.back}><PixelText text="Volver" size={14} /></UIFrame></Pressable>
    </View>
    <View style={s.tabs}>{VISIBLE_RANKING_MODES.map(id => <Pressable key={id} accessibilityRole="tab" accessibilityLabel={RANKING_NAMES[id]} accessibilityState={{ selected: mode === id }} onPressIn={() => audio.playUi()} onPress={() => setMode(id)}>
      <UIFrame variant={mode === id ? 'primary' : 'button'} style={[s.tab, { width: cardWidth }]}><PixelText text={RANKING_NAMES[id]} size={compact ? 11 : 14} maxWidth={cardWidth - 14} align="center" color={mode === id ? '#e7c7d5' : '#a5aaa6'} /></UIFrame>
    </Pressable>)}</View>
    {error ? <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar puntuaciones" onPress={() => { void loadScores().catch(() => {}); }}><PixelText text={`${error} Toca para reintentar.`} size={11} color="#d99ba7" maxWidth={usable} /></Pressable> : !ready ? <PixelText text="Leyendo puntuaciones..." size={12} /> : <ScrollView contentContainerStyle={s.results}>
      {[0, 1, 2].map(index => {
        const result = archive.rankings[mode][index];
        return <UIFrame key={index} variant="panel" style={[s.card, { width: cardWidth, minHeight: compact ? 156 : 188 }]}>
          <PixelText text={`0${index + 1}`} size={compact ? 18 : 23} color="#bd9d7c" />
          {result ? <View testID={`score-slot-${index + 1}`} style={s.copy}>
            <PixelText text={`${result.score} PTS`} size={compact ? 22 : 29} maxWidth={cardWidth - 24} color="#e6d4bc" />
            <PixelText text={`${DIFFICULTIES[result.difficulty].name} - ${result.outcome === 'victory' ? 'Victoria' : 'Derrota'}`} size={10} maxWidth={cardWidth - 24} />
            <PixelText text={new Date(result.date).toLocaleDateString('es-MX')} size={10} color="#a9a5a9" />

            <PixelText text={`${mode === 'survival' ? 'Oleada ' + result.wave : 'Encuentros ' + result.encounters} / Nv ${result.level}`} size={10} maxWidth={cardWidth - 24} />
            <PixelText text={`Enemigos ${result.stats.npcKills + result.stats.bossKills + result.stats.minibossKills} / Jefes ${result.stats.bossKills + result.stats.minibossKills}`} size={10} maxWidth={cardWidth - 24} />
            {!!result.equipment?.length && <PixelText text={result.equipment.map(id => WORKSHOP_ITEMS[id].name).join(' / ')} size={8} maxWidth={cardWidth - 24} color="#baa58d" />}
            <PixelText text={survivalTime(result.durationMs)} size={10} color="#accbbf" />
          </View> : <View testID={`score-empty-${index + 1}`} style={s.copy}><PixelText text="Sin registro" size={compact ? 15 : 18} color="#8b858a" maxWidth={cardWidth - 24} /><PixelText text="Juega una partida" size={10} color="#8b858a" maxWidth={cardWidth - 24} /></View>}
        </UIFrame>;
      })}
    </ScrollView>}
  </View>;
}
const s = StyleSheet.create({ screen: { ...StyleSheet.absoluteFill, backgroundColor: '#05070aef', gap: 10 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' }, back: { minHeight: 44, minWidth: 96, padding: 8, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 10 }, tab: { minHeight: 44, padding: 7, alignItems: 'center', justifyContent: 'center' },
  results: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 4 }, card: { padding: 12, gap: 8 }, copy: { gap: 7 } });
