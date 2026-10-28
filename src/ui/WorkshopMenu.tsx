import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WORKSHOP_IDS, WORKSHOP_ITEMS, type WorkshopId } from '../game/workshop';
import { DIFFICULTIES } from '../game/difficulty';
import { useScores, loadScores, purchaseUpgrade, withdrawAdvantage } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
import PixelBadge from './PixelBadge';
import UpgradeIcon from './UpgradeIcon';

export default function WorkshopMenu() {
  const session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets(), { width } = useWindowDimensions();
  const { archive, ready, error } = useScores(), wallet = archive.economy;
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const usable = width - Math.max(16, insets.left) - Math.max(16, insets.right), cardWidth = Math.min(370, (usable - 12) / 2);
  const oneLife = DIFFICULTIES[session.difficulty].hp <= 1;
  const act = async (id: WorkshopId, purchased: boolean) => {
    if (inFlight.current || session.playing) return;
    inFlight.current = true;
    setBusy(true);
    try { const result = await (purchased ? withdrawAdvantage(id) : purchaseUpgrade(id, oneLife)); setMessage(result.message); }
    catch { setMessage('No se pudo guardar. Tu saldo no ha cambiado. Reintenta.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const renderCard = (id: WorkshopId) => {
        const item = WORKSHOP_ITEMS[id], purchased = wallet.prepared.some(p=>p.id===id);
        return <UIFrame key={id} variant={purchased ? 'primary' : 'button'} style={[s.card, { width: cardWidth }]}>
          <View style={s.itemHeader}><UpgradeIcon id={id} size={32}/><PixelText text={item.name} size={16} maxWidth={cardWidth - 65} color="#decbb7" /></View>
          <PixelText text={`${item.cost} Celdas / ${purchased ? 'Preparada' : 'Disponible'}`} size={10} color="#beaa95" maxWidth={cardWidth - 24} />
          <PixelText text={item.effect} size={11} maxWidth={cardWidth - 24} color="#b5ccbf" />
          <Pressable testID={`workshop-${id}`} accessibilityRole="button" accessibilityLabel={`${purchased ? 'Retirar y reembolsar' : 'Comprar'} ${item.name}`} disabled={busy || oneLife && id==='field-kit' && !purchased} onPressIn={() => audio.playUi()} onPress={() => { void act(id, purchased); }}>
            <UIFrame variant="button" style={s.back}><PixelText text={purchased ? 'Retirar y reembolsar' : 'Comprar'} size={12} maxWidth={cardWidth-48} /></UIFrame>
          </Pressable>
        </UIFrame>;
  };
  return <View testID="workshop-menu" style={[s.screen, { paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right), paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(12, insets.bottom) }]}>
    <View style={s.header}><PixelBadge kind="wrench" /><PixelText text="Taller" size={28} color="#d9b4bd" />
      <PixelText testID="workshop-balance" text={`${wallet.cells} Celdas`} size={15} maxWidth={usable - 265} color="#d9c58c" />
      <Pressable accessibilityRole="button" accessibilityLabel="Volver del Taller" onPressIn={() => audio.playUi()} onPress={session.closeSettings}><UIFrame variant="button" style={s.back}><PixelText text="Volver" size={13} /></UIFrame></Pressable>
    </View>
    <PixelText text={`Preparadas para la próxima partida ${wallet.prepared.length}/2${oneLife ? ' / Sin Botiquín con vida única' : ''}`} size={11} maxWidth={usable} color="#b8caba" />
    {message ? <PixelText testID="workshop-message" text={message} size={11} maxWidth={usable} color="#dec5a8" /> : !wallet.prepared.length && <PixelText text="Compra hasta dos ventajas. Se consumen al iniciar una partida." size={11} maxWidth={usable} color="#99979e" />}
    {session.playing ? <PixelText text="El Taller solo está disponible fuera de la partida." size={15} maxWidth={usable} /> : error ? <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar Taller" onPress={() => { void loadScores().catch(() => {}); }}><PixelText text={`${error} Toca para reintentar.`} size={12} maxWidth={usable} /></Pressable> : !ready ? <PixelText text="Cargando Taller..." size={13} /> : <ScrollView contentContainerStyle={s.grid}>
      <View style={{width:'100%'}}><PixelText text="Preparadas para la próxima partida" size={14} maxWidth={usable}/></View>
      {wallet.prepared.length ? wallet.prepared.map(p=>renderCard(p.id)) : <View style={{width:'100%'}}><PixelText text="Ninguna ventaja preparada." size={11} color="#99979e"/></View>}
      <View style={{width:'100%',paddingTop:8}}><PixelText text="Disponibles para comprar" size={14}/></View>
      {WORKSHOP_IDS.filter(id=>!wallet.prepared.some(p=>p.id===id)).map(renderCard)}
    </ScrollView>}
  </View>;
}
const s = StyleSheet.create({ screen: { ...StyleSheet.absoluteFill, backgroundColor: '#08090df5', gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingBottom: 10 }, card: { padding: 12, gap: 10 }, itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { minHeight: 44, minWidth: 92, padding: 8, justifyContent: 'center', alignItems: 'center' } });
