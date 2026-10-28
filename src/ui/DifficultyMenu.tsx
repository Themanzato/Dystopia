import EquipmentPreview from './EquipmentPreview';
import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DIFFICULTIES, type Difficulty } from '../game/difficulty';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
export default function DifficultyMenu() {
  const session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(240, (width - insets.left - insets.right - 68) / 3), compact = height < 360 || width < 740;
  return <View testID="difficulty-menu" style={[s.screen, { paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right), paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(12, insets.bottom), gap: compact ? 8 : 12 }]}>
    <PixelText text="Elige la dificultad" size={compact ? 24 : 30} maxWidth={width - 60} align="center" />
    <View style={s.cards}>{(Object.keys(DIFFICULTIES) as Difficulty[]).map(id => {
      const mode = DIFFICULTIES[id];
      return <Pressable key={id} accessibilityRole="button" accessibilityLabel={mode.name} onPressIn={() => audio.playUi()} onPress={() => session.start(id)}>
        <UIFrame variant={id === 'dystopia' ? 'danger' : 'button'} style={[s.card, { width: cardWidth, minHeight: compact ? 96 : 122 }, id === 'dystopia' && s.wine]}>
          <PixelText text={mode.name} size={compact ? 23 : 28} maxWidth={cardWidth - 24} color={mode.color} align="center" />

        </UIFrame>
      </Pressable>;
    })}</View>
    <EquipmentPreview />
    <Pressable accessibilityRole="button" accessibilityLabel="Volver al menú" onPressIn={() => audio.playUi()} onPress={session.closeSettings}>
      <UIFrame variant="button" style={s.back}><PixelText text="Volver" size={16} /></UIFrame>
    </Pressable>
  </View>;
}
const s = StyleSheet.create({ screen: { ...StyleSheet.absoluteFill, backgroundColor: '#03070be8', justifyContent: 'center', alignItems: 'center', gap: 20 },
  cards: { flexDirection: 'row', gap: 12 }, card: { padding: 12, justifyContent: 'center', alignItems: 'center', gap: 20 },
  wine: { backgroundColor: '#38101d' }, back: { minWidth: 150, minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 10 } });
