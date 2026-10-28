import PausePowerups from './PausePowerups';
import MenuEconomy from './MenuEconomy';
import React, { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from './session';
import { useGameAudio, type UiSound } from './AudioProvider';
import { visitCreator } from './CreatorVisit';
import { useScores } from './ScoreStorage';
import { CREATOR_REWARD } from '../game/workshop';
import type { SharedValue } from 'react-native-reanimated';
import { MenuButtonMotion, useMenuMotionTime } from './MenuMotion';
import PixelText from './PixelText';
import InfectedTitle from './InfectedTitle';
import ControlSettingsPanel from './ControlSettingsPanel';
import { ControlLayoutIcon } from './ControlVisual';
import { UIFrame, UIIcon, UISliderArt, UIWord } from './PixelArt';

const colors = { text: '#e9e2d3', muted: '#b3b7b3', accent: '#a4c4b5', red: '#cc7865' };
type ButtonProps = { label: string; detail?: string; detailTestID?: string; onPress: () => void; primary?: boolean; danger?: boolean; index?: string; sound?: UiSound; motion?: SharedValue<number>; motionIndex?: number; disabled?: boolean };
const BUTTON_WORDS = {
  'Comenzar partida': 'start', Ajustes: 'settings', Reanudar: 'resume', 'Menú principal': 'mainMenu',
  'Seguir en pausa': 'continue', 'Abandonar partida': 'quit', 
} as const;
function MenuButton({ label, detail, detailTestID, onPress, primary, danger, sound = 'press', motion, motionIndex, disabled }: ButtonProps) {
  const { playUi } = useGameAudio();
  const word = BUTTON_WORDS[label as keyof typeof BUTTON_WORDS];
  const icon = word === 'settings' ? 'settings' : word === 'start' ? 'gamepad' : word === 'mainMenu' ? 'menu' : word === 'quit' ? 'close' : 'right';
  return <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={label} onPressIn={() => playUi(sound)} onPress={onPress}
    style={({ pressed }) => [s.button, pressed && s.pressed]}>
    <MenuButtonMotion time={motion} index={motionIndex}><UIFrame variant={danger ? 'danger' : primary ? 'primary' : 'button'} style={s.buttonFrame}>
      {label === 'Configurar controles' ? <ControlLayoutIcon /> : <UIIcon icon={icon} size={24} />}
      <View style={s.buttonCopy}>
        {word && <UIWord word={word} scale={1.1} />}
        {!word && <PixelText text={label} size={label==='Purgatorio'?19:14} maxWidth={155} color="#d7a1b1" />}
        {!!detail&&<View style={{paddingTop:5}}><PixelText testID={detailTestID} text={detail} size={9} maxWidth={155} color="#c4bb93"/></View>}
      </View>
    </UIFrame></MenuButtonMotion>
  </Pressable>;
}
function Frame({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.screen, dark && s.veil, { paddingTop: Math.max(16, insets.top), paddingBottom: Math.max(14, insets.bottom), paddingLeft: Math.max(26, insets.left), paddingRight: Math.max(26, insets.right) }]}>{children}</View>;
}
export function MainMenu() {
  const session = useSession();
  const motion = useMenuMotionTime();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <Frame><MenuEconomy /><View style={s.mainBody}><View style={s.mainCopy}>
    <InfectedTitle width={Math.min(300, Math.max(100, width - Math.max(26,insets.left) - Math.max(20,insets.right) - 300))} />
    <View style={s.mainButtons}><MenuButton label="Comenzar partida" motion={motion} motionIndex={0} primary onPress={session.selectDifficulty} /><MenuButton label="Purgatorio" motion={motion} motionIndex={1} onPress={session.openPurgatorio} /><MenuButton label="Ajustes" motion={motion} motionIndex={2} onPress={session.settings} /></View>
  </View></View></Frame>;
}
export function PauseMenu() {
  const session = useSession();
  const [confirm, setConfirm] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false), [dismissInfo, setDismissInfo] = useState(0);
  return <Frame dark>
    {infoOpen && <Pressable testID="powerup-info-backdrop" accessibilityLabel="Cerrar información" style={StyleSheet.absoluteFill} onPress={() => setDismissInfo(n => n + 1)} />}
    <View style={s.pauseBody} pointerEvents="box-none">
      <View style={s.pauseButtons} pointerEvents={infoOpen ? "none" : "auto"}>{confirm ? <><MenuButton label="Seguir en pausa" primary onPress={() => setConfirm(false)} /><MenuButton label="Abandonar partida" danger onPress={session.abandon} /></> : <>
        <MenuButton label="Reanudar" index="01" primary sound="resume" onPress={session.resume} />
        <MenuButton label="Ajustes" index="02" onPress={session.settings} />
        <MenuButton label="Menú principal" index="03" onPress={() => setConfirm(true)} />
      </>}</View>
      {!confirm && !session.tutorial && <PausePowerups dismissToken={dismissInfo} onInfoOpenChange={setInfoOpen} />}
    </View>
  </Frame>;
}
function VolumeControl({ label, value, change, muted }: { label: string; value: number; change: (value: number) => void; muted: boolean }) {
  return <View style={s.volume}>
    <View style={s.volumeTitle}><View style={s.volumeName}><UIIcon icon={label === 'Música' ? 'music' : muted ? 'muted' : 'volume'} size={22} /><PixelText text={label} size={13} color={colors.text}/></View><View style={{width:48,alignItems:'flex-end'}}><PixelText text={`${Math.round(value * 100)}%`} size={13} color={colors.accent}/></View></View>
    <View style={s.volumeRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Bajar ${label}`} onPress={() => change(Math.max(0, Math.round((value - 0.1) * 10) / 10))} style={s.step}><UIIcon icon="left" size={20} /></Pressable>
      <View style={s.track} accessibilityRole="adjustable" accessibilityLabel={`Volumen de ${label}`} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => change(Math.max(0, Math.min(1, value + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))}>
        <UISliderArt value={value} muted={muted} width={140} height={44} />
        <View style={s.segmentHitArea}>{Array.from({ length: 10 }, (_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${label} al ${(i + 1) * 10}%`} onPress={() => change((i + 1) / 10)} style={s.segmentTouch} />)}</View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Subir ${label}`} onPress={() => change(Math.min(1, Math.round((value + 0.1) * 10) / 10))} style={s.step}><UIIcon icon="right" size={20} /></Pressable>
    </View>
  </View>;
}
export function SettingsMenu() {
  const session = useSession();
  const audio = useGameAudio();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const {archive,ready,error:storageError}=useScores();
  const [linkBusy,setLinkBusy]=useState(false),[linkMessage,setLinkMessage]=useState('');
  const linkFlight=useRef(false);
  const open = async (destination: 'support' | 'about') => {
    if(linkFlight.current||!ready)return;
    linkFlight.current=true;setLinkBusy(true);setLinkError(null);setLinkMessage('');
    try { const result=await visitCreator(destination,url=>Linking.openURL(url),setLinkError);if(result)setLinkMessage(result.message); }
    finally {linkFlight.current=false;setLinkBusy(false);}
  };
  if (controlsOpen) return <ControlSettingsPanel onBack={() => setControlsOpen(false)} />;
  return <Frame dark>
    <View style={s.settingsTop}><UIWord word="settings" scale={1.6} /><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPressIn={() => audio.playUi()} onPress={() => controlsOpen ? setControlsOpen(false) : session.closeSettings()} style={s.back}><UIFrame variant="button" style={s.backFrame}><UIIcon icon="left" size={18} /><UIWord word="back" scale={1} /></UIFrame></Pressable></View>
    {controlsOpen ? <ControlSettingsPanel onBack={() => setControlsOpen(false)} /> : <ScrollView style={s.settingsScroll} contentContainerStyle={s.settingsContent} showsVerticalScrollIndicator={false}>
      <UIFrame variant="panel" style={s.settingsPanel}>
        <View style={s.audioRow}><VolumeControl label="Música" value={audio.settings.music} muted={audio.settings.muted} change={music => audio.updateSettings({ music })} /><VolumeControl label="Efectos" value={audio.settings.effects} muted={audio.settings.muted} change={effects => { audio.updateSettings({ effects }); audio.playUi(); }} /></View>
        <View style={s.muteRow}><View><PixelText text="Silenciar todo" size={13} color={colors.text}/></View><Pressable accessibilityRole="switch" accessibilityLabel="Silenciar todo" accessibilityState={{ checked: audio.settings.muted }} onPress={() => audio.updateSettings({ muted: !audio.settings.muted })}><UIFrame variant={audio.settings.muted ? 'primary' : 'button'} style={s.muteButton}><UIIcon icon={audio.settings.muted ? 'muted' : 'volume'} size={24} /><PixelText text={audio.settings.muted ? 'SÍ' : 'NO'} size={13}/></UIFrame></Pressable></View>
        <MenuButton label="Configurar controles" onPress={() => setControlsOpen(true)} />
        <MenuButton label="Repetir tutorial" disabled={session.playing} detail={session.playing?'Disponible desde el menú principal':undefined} onPress={session.openTutorial} />
        <View style={s.creatorRow}>{(['support','about'] as const).map(destination=><View key={destination} style={s.creatorButton}>
          <MenuButton label={destination==='support'?'Apoya a un creador':'Sobre el creador'} disabled={!ready||linkBusy} onPress={()=>{void open(destination);}}
            detailTestID={`creator-reward-${destination}`} detail={!ready?'Cargando recompensa...':archive.economy.creatorRewards.includes(destination)?'Recompensa ya obtenida':`Primera visita: +${CREATOR_REWARD} Celdas`}/>
        </View>)}</View>
        {!!linkMessage&&<PixelText text={linkMessage} size={11} maxWidth={450} color="#b5ccbf"/>}
        {(linkError || audio.error || storageError) && <View accessibilityRole="alert"><PixelText text={linkError || audio.error || storageError || ''} size={12} maxWidth={450} color="#efa08b"/></View>}
      </UIFrame>
    </ScrollView>}
  </Frame>;
}
const s = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, veil: { backgroundColor: 'rgba(5,10,12,0.89)' },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, signal: { width: 5, height: 5, backgroundColor: colors.red }, eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '600', letterSpacing: 1.6 }, serial: { color: '#9a9f95', fontSize: 9, letterSpacing: 2 },
  mainBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, mainCopy: { width: 340, maxWidth: '65%' }, title: { color: colors.text, fontWeight: '900', letterSpacing: 4, marginLeft: -3 }, ornament: { marginVertical: 7 }, tagline: { color: '#bbbcb1', fontSize: 13, lineHeight: 19, letterSpacing: 0.4 }, mainButtons: { gap: 8, marginTop: 14, width: 300, maxWidth: '100%' },
  button: { minHeight: 60 }, buttonFrame: { minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed: { opacity: 0.72, transform: [{ translateY: 1 }] }, buttonCopy: { flex: 1, gap: 4 }, buttonText: { color: colors.text, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 }, translation: { color: '#d1d4ca', fontSize: 11, fontWeight: '400' }, detail: { color: colors.muted, fontSize: 9, letterSpacing: 1.2, marginTop: 1 }, index: { color: colors.accent, fontSize: 10, letterSpacing: 1 },
  sceneNote: { alignSelf: 'flex-end', marginBottom: 25, alignItems: 'flex-end' }, sceneNoteNumber: { fontSize: 45, color: '#b1c5b0', fontWeight: '200' }, sceneNoteText: { color: '#a4b6a5', fontSize: 9, lineHeight: 15, textAlign: 'right', letterSpacing: 2 }, footer: { flexDirection: 'row', justifyContent: 'space-between' }, footerText: { color: '#9baba4', fontSize: 9, letterSpacing: 1.5 },
  pauseBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }, pauseCopy: { width: 330, maxWidth: '47%' }, smallLabel: { color: colors.accent, fontSize: 10, letterSpacing: 2, marginBottom: 10 }, pauseTitle: { color: colors.text, fontSize: 30, fontWeight: '600', lineHeight: 36 }, description: { color: colors.muted, fontSize: 13, lineHeight: 20 }, pauseButtons: { width: 280, maxWidth: '45%', gap: 10 },
  settingsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 }, settingsHeading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 }, settingsTitle: { color: colors.muted, fontSize: 13 }, back: { minWidth: 130 }, backFrame: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', gap: 9, alignItems: 'center' }, backText: { color: colors.muted, fontSize: 10 }, settingsScroll: { flex: 1 }, settingsContent: { alignItems: 'center', paddingBottom: 8 }, settingsPanel: { width: '100%', maxWidth: 810, padding: 20 }, audioRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 }, volume: { flex: 1 }, volumeTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, volumeName: { flexDirection: 'row', alignItems: 'center', gap: 8 }, volumeLabel: { color: colors.text, fontSize: 14, fontWeight: '600' }, percent: { color: colors.accent, fontSize: 12 }, volumeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 3 }, step: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, track: { width: 140, height: 44 }, segmentHitArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }, segmentTouch: { flex: 1 }, muteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#2b3835' }, muteHint: { color: colors.muted, fontSize: 10, marginTop: 4 }, muteButton: { width: 84, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, muteStatus: { color: colors.text, fontSize: 10 }, creatorRow: { flexDirection: 'row', gap: 12, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#2b3835' }, creatorButton: { flex: 1 }, error: { color: '#efa08b', fontSize: 12, lineHeight: 18, marginTop: 10 }, settingsFoot: { color: colors.muted, fontSize: 9, letterSpacing: 1.3, marginTop: 12 },
});
