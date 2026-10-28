import React from 'react';
import { pendingMissions } from '../game/missions';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScores } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelBadge from './PixelBadge';
import PixelText from './PixelText';
export default function MenuEconomy() {
  const { archive, ready, error } = useScores(), session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets();
  return <View testID="menu-economy" style={{ position: 'absolute', top: Math.max(16, insets.top), right: Math.max(20, insets.right), zIndex: 2, flexDirection: 'row', gap: 8 }}>
    <View testID="menu-cell-balance" accessible accessibilityRole="text" accessibilityLabel={`Saldo de Celdas: ${ready ? archive.economy.cells : error ? 'no disponible' : 'cargando'}`} pointerEvents="none">
      <UIFrame variant="button" style={{ width: 112, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <PixelBadge kind="cell" scale={1} color="#d9c58c" /><View><PixelText text="Celdas" size={8} color="#c8b584" /><PixelText text={ready ? String(archive.economy.cells) : error ? '--' : '...'} size={Math.min(14, 90 / Math.max(1, String(archive.economy.cells).length))} maxWidth={76} color="#e3d2a6" /></View>
      </UIFrame>
    </View>
    <Pressable testID="workshop-button" accessibilityRole="button" accessibilityLabel="Taller" onPressIn={() => audio.playUi()} onPress={session.openWorkshop}><UIFrame variant="button" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><PixelBadge kind="wrench" /></UIFrame></Pressable>
    <Pressable testID="scores-button" accessibilityRole="button" accessibilityLabel="Récords" onPressIn={() => audio.playUi()} onPress={session.openScores}><UIFrame variant="button" style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><PixelBadge kind="record" /></UIFrame></Pressable>
    <Pressable testID="missions-button" accessibilityRole="button" accessibilityLabel="Misiones" onPressIn={() => audio.playUi()} onPress={session.openMissions}><UIFrame variant="button" style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><PixelBadge kind="trophy"/>{pendingMissions(archive.missions).length>0&&<View testID="missions-pending-badge" style={{position:'absolute',right:4,top:4,width:8,height:8,backgroundColor:'#da658a',borderWidth:1,borderColor:'#efc3b7'}}/>}</UIFrame></Pressable>
  </View>;
}
