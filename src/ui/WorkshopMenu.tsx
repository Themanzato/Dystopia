import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WORKSHOP_IDS, WORKSHOP_ITEMS, WORKSHOP_BALANCE, type WorkshopId } from '../game/workshop';
import { DIFFICULTIES } from '../game/difficulty';
import { useScores, loadScores, purchaseUpgrade, withdrawAdvantage } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
import PixelBadge from './PixelBadge';
import UpgradeIcon from './UpgradeIcon';
import WorkshopPreview from './WorkshopDemonstration';

const LABELS = {
  'field-kit': { name: 'Botiquín', effect: `+${WORKSHOP_BALANCE.health} vida inicial` },
  'attack-servo': { name: 'Servo de ataque', effect: `Ataca ${Math.round(WORKSHOP_BALANCE.attack * 100)}% más rápido` },
  'assault-boots': { name: 'Botas de asalto', effect: `+${Math.round(WORKSHOP_BALANCE.speed * 100)}% movimiento` },
  'frenesis-coil': { name: 'Bobina de Frenesis', effect: `Frenesis inicia al ${WORKSHOP_BALANCE.charge}%` },
};

export default function WorkshopMenu() {
  const session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions(), { archive, ready, error } = useScores(), wallet = archive.economy;
  const [selected, setSelected] = useState<WorkshopId>('field-kit');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const compact = width < 740 || height < 360;
  const left = Math.max(16, insets.left), right = Math.max(16, insets.right);
  const top = Math.max(10, insets.top), bottom = Math.max(10, insets.bottom);
  const usable = width - left - right, previewWidth = Math.round(Math.max(164, Math.min(252, usable * .31)));
  const rowWidth = usable - previewWidth - 12;
  const bodyHeight = Math.max(130, height - top - bottom - 84);
  const panelHeight = Math.min(340, bodyHeight), previewHeight = Math.max(84, panelHeight - 76);
  const oneLife = DIFFICULTIES[session.difficulty].hp <= 1;
  const act = async (id: WorkshopId, purchased: boolean) => {
    if (inFlight.current || session.playing) return;
    inFlight.current = true; setBusy(true);
    try {
      const paid = wallet.prepared.find(p => p.id === id)?.cost ?? 0;
      const result = await (purchased ? withdrawAdvantage(id) : purchaseUpgrade(id, oneLife));
      setMessage(result.ok && purchased ? `Reembolso: +${paid} Celdas.` : result.message);
    } catch { setMessage('No se pudo guardar. Reintenta.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const renderCard = (id: WorkshopId) => {
    const item = WORKSHOP_ITEMS[id], label = LABELS[id], prepared = wallet.prepared.find(p => p.id === id);
    const restricted = oneLife && id === 'field-kit' && !prepared;
    const full = !prepared && wallet.prepared.length >= WORKSHOP_BALANCE.slots;
    const missing = !prepared ? Math.max(0, item.cost - wallet.cells) : 0;
    const blocked = restricted || full || missing > 0;
    const state = prepared ? 'Preparada' : restricted ? 'Vida única' : full ? 'Dos preparadas' : missing ? `Faltan ${missing} Celdas` : 'Disponible';
    const textWidth = Math.max(92, rowWidth - (compact ? 162 : 216));
    return <View key={id} testID={`workshop-card-${id}`}><UIFrame variant={selected === id ? 'primary' : 'button'} style={[s.card,{minHeight:compact?86:64},prepared && s.prepared]}>
      <Pressable testID={`workshop-select-${id}`} accessibilityRole="button" accessibilityLabel={`Vista previa de ${item.name}`} accessibilityHint={label.effect}
        accessibilityState={{ selected: selected === id }} onPressIn={() => audio.playUi()} onPress={() => setSelected(id)} style={[s.select,{minHeight:compact?66:44}]}>
        <View style={s.icon}><UpgradeIcon id={id} size={compact ? 36 : 40}/></View>
        <View style={[s.copy,!compact&&s.wideCopy]}>
          <PixelText text={label.name} size={compact ? 12 : 14} maxWidth={textWidth} color="#e0c5bd"/>
          <PixelText text={label.effect} size={compact ? 9 : 10} maxWidth={textWidth} color="#bdcbc0"/>
          <PixelText testID={`workshop-status-${id}`} text={state} size={8} maxWidth={textWidth} color={prepared ? '#a7d9ba' : blocked ? '#ce94a5' : '#9d969e'}/>
        </View>
      </Pressable>
      <View testID={`workshop-price-${id}`} style={[s.purchase,!compact&&s.widePurchase]}>
        <View accessible accessibilityLabel={`${prepared ? 'Reembolso' : 'Precio'}: ${prepared?.cost ?? item.cost} Celdas`} style={s.price}>
          <PixelBadge kind="cell" scale={1} color="#dbc58a"/>
          <PixelText text={`${prepared ? '+' : ''}${prepared?.cost ?? item.cost}`} size={compact ? 14 : 16} color="#e2cc91"/>
        </View>
        <Pressable testID={`workshop-${id}`} accessibilityRole="button" accessibilityLabel={`${prepared ? 'Retirar y reembolsar' : 'Comprar'} ${item.name}`}
          accessibilityHint={prepared ? 'Retira la ventaja pendiente y devuelve el costo completo.' : blocked ? state : 'Prepara esta ventaja solo para la próxima partida.'}
          disabled={busy || restricted} onPressIn={() => audio.playUi()} onPress={() => { void act(id, !!prepared); }}>
          <UIFrame variant={prepared ? 'button' : 'primary'} style={[s.buy,{width:compact?88:80},(blocked && !prepared || busy) && s.unaffordable]}>
            <PixelText text={prepared ? 'Retirar' : restricted ? 'Bloqueado' : full ? 'Límite' : missing ? 'Sin celdas' : 'Comprar'} size={compact ? 9 : 10} maxWidth={72} align="center"/>
          </UIFrame>
        </Pressable>
      </View>
    </UIFrame></View>;
  };
  return <View testID="workshop-menu" style={[s.screen, { paddingLeft: left, paddingRight: right, paddingTop: top, paddingBottom: bottom }]}>
    <View style={s.header}>
      <View style={s.title}><PixelBadge kind="wrench" scale={compact ? 1 : 2}/><PixelText text="Taller" size={compact ? 24 : 28} color="#d9b4bd"/></View>
      <View accessible accessibilityLabel={`Saldo: ${wallet.cells} Celdas`} style={s.balance}><PixelBadge kind="cell" scale={compact ? 1 : 2} color="#dbc58a"/><PixelText testID="workshop-balance" text={`${wallet.cells} Celdas`} size={compact ? 12 : 15} maxWidth={Math.max(96, usable - 270)} color="#e2cc91"/></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver del Taller" onPressIn={() => audio.playUi()} onPress={session.closeSettings}><UIFrame variant="button" style={s.back}><PixelText text="Volver" size={12}/></UIFrame></Pressable>
    </View>
    <View style={s.status}>
      <PixelText testID="workshop-prepared-count" text={`Próxima partida ${wallet.prepared.length}/${WORKSHOP_BALANCE.slots}`} size={compact ? 9 : 11} color="#bdcbbd"/>
      <View style={s.slots}>{Array.from({length:WORKSHOP_BALANCE.slots},(_,i)=><View key={i} testID={`workshop-slot-${i}`} style={s.slot}>{wallet.prepared[i] ? <UpgradeIcon id={wallet.prepared[i].id} size={20}/> : <PixelText text="-" size={10} color="#6d636d"/>}</View>)}</View>
      <View style={s.feedback}>{message ? <PixelText testID="workshop-message" text={message} size={9} maxWidth={Math.max(140,usable-260)} color="#dfc2ad"/> : null}</View>
    </View>
    {session.playing ? <PixelText text="El Taller solo está disponible fuera de la partida." size={13} maxWidth={usable}/> : error ? <Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar Taller" onPress={() => { void loadScores().catch(() => {}); }}><PixelText text={`${error} Toca para reintentar.`} size={12} maxWidth={usable}/></Pressable> : !ready ? <PixelText text="Cargando Taller..." size={13}/> : <View style={[s.body,{height:bodyHeight}]}>
      <UIFrame variant="panel" style={[s.preview,{width:previewWidth,height:panelHeight}]}>
        <PixelText text="Vista previa" size={10} color="#cba9b8"/>
        <WorkshopPreview id={selected} difficulty={session.difficulty} width={previewWidth-20} height={previewHeight}/>
        <PixelText text="Solo la próxima partida" size={compact ? 8 : 10} maxWidth={previewWidth-24} align="center" color="#a39ba6"/>
      </UIFrame>
      <ScrollView testID="workshop-items" style={{width:rowWidth}} contentContainerStyle={s.list} showsVerticalScrollIndicator>
        {WORKSHOP_IDS.map(renderCard)}
      </ScrollView>
    </View>}
  </View>;
}
const s=StyleSheet.create({
  screen:{...StyleSheet.absoluteFill,backgroundColor:'#08090df5',gap:8},header:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  title:{flexDirection:'row',alignItems:'center',gap:10},balance:{flexDirection:'row',alignItems:'center',gap:7},back:{minHeight:44,minWidth:76,padding:8,alignItems:'center',justifyContent:'center'},
  status:{minHeight:24,flexDirection:'row',alignItems:'center',gap:8},slots:{flexDirection:'row',gap:4},slot:{width:24,height:24,backgroundColor:'#19131d',borderWidth:1,borderColor:'#53404e',alignItems:'center',justifyContent:'center'},feedback:{flex:1,alignItems:'flex-end'},
  body:{flexDirection:'row',gap:12},preview:{padding:10,alignItems:'center',justifyContent:'space-between',gap:8,backgroundColor:'#100d15'},list:{gap:8,paddingBottom:4},
  card:{padding:8,flexDirection:'row',gap:8,alignItems:'center',minHeight:86,backgroundColor:'#141019'},prepared:{backgroundColor:'#19201e'},select:{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:66},
  icon:{width:40,alignItems:'center'},copy:{flex:1,gap:5},purchase:{width:88,alignItems:'center',gap:3},price:{height:20,flexDirection:'row',alignItems:'center',gap:5},buy:{width:88,height:44,alignItems:'center',justifyContent:'center',paddingHorizontal:4},unaffordable:{opacity:.55},
  widePurchase:{width:142,flexDirection:'row',justifyContent:'space-between',gap:8},
  wideCopy:{gap:1},
});
