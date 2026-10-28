import React from 'react';
import { Pressable, View } from 'react-native';
import { WORKSHOP_ITEMS } from '../game/workshop';
import { useScores } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
import PixelBadge from './PixelBadge';
export default function EquipmentPreview() {
  const { archive, ready } = useScores(), session = useSession(), audio = useGameAudio();
  return <View testID="equipment-preview" style={{ width: '100%', maxWidth: 780, flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
    <View style={{ flex: 1 }}><PixelText text={`Preparadas ${archive.economy.prepared.length}/2`} size={9} color="#c2aa92" /><PixelText text={!ready ? 'Cargando...' : archive.economy.prepared.length ? archive.economy.prepared.map(id => WORKSHOP_ITEMS[id.id].name).join(' / ') : 'Sin mejoras iniciales'} size={10} maxWidth={410} color="#b2c8bb" />{archive.economy.prepared.some(p=>p.id==='field-kit') && <PixelText text="Botiquín: reembolso al iniciar con vida única" size={8} color="#b28b95" />}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Cambiar mejoras en Taller" onPressIn={() => audio.playUi()} onPress={session.openWorkshop}><UIFrame variant="button" style={{ minHeight: 44, width: 48, minWidth: 48, padding: 8, justifyContent: 'center', alignItems: 'center' }}><PixelBadge kind="wrench" /></UIFrame></Pressable>
  </View>;
}
