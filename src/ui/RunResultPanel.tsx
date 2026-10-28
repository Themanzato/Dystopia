import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';
import type { SurvivalState } from '../game/survival';
import { finalRunResult, RANKING_NAMES, survivalTime } from '../game/scores';
import { DIFFICULTIES } from '../game/difficulty';
import { purgatorioName, type SpecialEnemyId } from '../game/purgatorio';
import type { Settlement } from '../game/workshop';
import { saveRunResult } from './ScoreStorage';
import { useGameAudio } from './AudioProvider';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';

function Action({ label, onPress, compact }: { label: string; onPress: () => void; compact: boolean }) {
  const audio = useGameAudio();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPressIn={() => audio.playUi()} onPress={onPress}>
    <UIFrame variant="button" style={s.action}><PixelText text={label} size={compact ? 12 : 15} maxWidth={compact ? 150 : 205} align="center" /></UIFrame>
  </Pressable>;
}
export default function RunResultPanel({ survival, runId, visible, onRetry, onExit, onChangeDifficulty }: {
  survival: SharedValue<SurvivalState>; runId: string; visible: boolean; onRetry?: () => void; onExit?: () => void; onChangeDifficulty?: () => void;
}) {
  // One terminal snapshot and one persistent settlement, shared by both views.
  const [result] = useState(() => finalRunResult(survival.value, runId));
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [attempt, setAttempt] = useState(0), [expanded,setExpanded] = useState(false);
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), audio = useGameAudio();
  useEffect(() => {
    let mounted = true;
    void saveRunResult(result).then(receipt => { if (mounted) { setSettlement(receipt); setStatus('saved'); } }, () => { if (mounted) setStatus('error'); });
    return () => { mounted = false; };
  }, [result, attempt]);
  if (!visible) return null;
  const compact = width < 740 || height < 360;
  const available = width - Math.max(16, insets.left) - Math.max(16, insets.right);
  const victory = result.outcome === 'victory';
  const enemies = result.stats.npcKills + result.stats.bossKills + result.stats.minibossKills;
  const maxHeight=height-Math.max(12,insets.top)-Math.max(12,insets.bottom);
  const panel=[s.panel,{padding:compact?12:16,gap:compact?8:10,width:Math.min(820,available),maxHeight}];
  const rows = [
    ['Puntuación',result.score],['Celdas ganadas',settlement?.earned??0],['Saldo de Celdas',settlement?.balance??0],
    ['Enemigos comunes', result.stats.npcKills], ['Bosses', result.stats.bossKills], ['Mini bosses', result.stats.minibossKills],
    ['Supervivencia', survivalTime(result.durationMs)], ['Nivel', result.level],
    ['Oleadas superadas', result.stats.wavesCleared], ['Objetivos', result.stats.objectivesCompleted],
    ...(result.mode!=='survival'?[['Encuentros superados',result.encounters]]:[]),
  ];
  return <View testID={victory ? 'purgatorio-victory' : 'survival-modal'} accessibilityViewIsModal style={s.veil}>
    <UIFrame variant="panel" style={panel}>
      {status !== 'saved' ? <View style={s.pending}>
        <PixelText text={status === 'saving' ? 'Guardando resultado...' : 'No se pudo guardar el resultado'} size={compact ? 17 : 22} maxWidth={available - 60} align="center" />
        {status === 'error' && <>
          <Pressable accessibilityRole="button" accessibilityLabel="Reintentar guardado" onPressIn={() => audio.playUi()} onPress={() => { setStatus('saving'); setAttempt(n => n + 1); }}><UIFrame variant="button" style={s.action}><PixelText text="Reintentar guardado" size={14} /></UIFrame></Pressable>
          {onExit && <Action label="Salir sin guardar" onPress={onExit} compact={compact} />}
        </>}
      </View> : <View testID="run-summary" pointerEvents={expanded?'none':'auto'} accessibilityElementsHidden={expanded} aria-hidden={expanded} importantForAccessibility={expanded?'no-hide-descendants':'auto'} style={{gap:compact?8:12}}>
        <PixelText text={victory ? 'Victoria' : 'Derrota'} size={compact ? 28 : 36} color={victory ? '#e7cbb5' : '#d18d9f'} />
        <PixelText text={`${RANKING_NAMES[result.mode]} / ${DIFFICULTIES[result.difficulty].name}`} size={compact ? 11 : 14} maxWidth={available - 50} color="#bcb2ba" />
        <View style={s.body}>
          <View style={s.summaryStats}>
            <View style={s.summaryStat}><PixelText text="Oleada alcanzada" size={compact?10:12} color="#ada6ae"/><PixelText text={String(result.wave)} size={compact?26:32} color="#e0d4c1"/></View>
            <View style={s.summaryStat}><PixelText text="Enemigos eliminados" size={compact?10:12} maxWidth={available-245} color="#ada6ae"/><PixelText text={String(enemies)} size={compact?26:32} color="#e0d4c1"/></View>
            <Action label="Mostrar más" onPress={()=>setExpanded(true)} compact={compact}/>
          </View>
          <View style={[s.actions,{width:compact?170:230}]}>
            {onRetry && <Action label={victory ? 'Volver a intentar' : 'Reintentar'} onPress={onRetry} compact={compact} />}
            {onExit && <Action label={victory ? 'Salir al menú' : 'Menú principal'} onPress={onExit} compact={compact} />}
            {victory && onChangeDifficulty && <Action label="Cambiar de dificultad" onPress={onChangeDifficulty} compact={compact} />}
          </View>
        </View>
      </View>}
    </UIFrame>
    {status==='saved'&&expanded&&<View testID="run-details-modal" accessibilityViewIsModal style={[s.veil,{backgroundColor:'#020407ed'}]}>
      <UIFrame variant="panel" style={panel}>
        <View style={s.heading}><PixelText text="Estadísticas" size={compact?23:29} color="#d9becb"/><Action label="Volver al resumen" onPress={()=>setExpanded(false)} compact={compact}/></View>
        {result.mode==='purgatorio-single'&&result.encounterId&&<PixelText text={purgatorioName(result.encounterId as SpecialEnemyId)} size={12} maxWidth={available-50} color="#b9aaa8"/>}
        <ScrollView testID="run-details-statistics" style={{maxHeight:Math.max(80,maxHeight-120)}} contentContainerStyle={s.stats}>
          {rows.map(([label,value])=><View key={label} style={s.stat}><PixelText text={String(label)} size={compact?10:12} maxWidth={compact?175:260} color="#aaa5ac"/><PixelText testID={label==='Celdas ganadas'?'run-cells':undefined} text={String(value)} size={compact?20:25} color="#e0d4c1"/></View>)}
        </ScrollView>
      </UIFrame>
    </View>}
  </View>;
}
const s = StyleSheet.create({ veil: { ...StyleSheet.absoluteFill, backgroundColor: '#04080bea', justifyContent: 'center', alignItems: 'center' },
  panel: { padding: 16, gap: 10, backgroundColor: '#0c1215' }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',gap:12 },
  body: { flexDirection: 'row', gap: 16 }, summaryStats:{flex:1,gap:8},summaryStat:{gap:2}, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12,paddingBottom:8 },
  stat: { width: '46%', gap: 4, paddingVertical: 3 }, actions: { gap: 8, justifyContent: 'center' }, action: { minHeight: 44, padding: 9, justifyContent: 'center', alignItems: 'center' },
  pending: { gap: 16, padding: 20, alignItems: 'center' } });
