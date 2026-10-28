import React from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { TITLE_GAP, TITLE_HEIGHT, TITLE_LETTERS, TITLE_WIDTH } from './titleAssets';

// Deliberately independent of Skia, the UI atlas and its font: usable even while
// CanvasKit or a failed menu resource is still being prepared.
export default function BootLogo({ error = false, errorDetail, onRetry }: { error?: boolean; errorDetail?: string; onRetry?: () => void }) {
  const { width } = useWindowDimensions();
  const scale = Math.min(1.3, (width - 80) / TITLE_WIDTH);
  const nearest = Platform.OS === 'web' ? { imageRendering: 'pixelated' } as ImageStyle : undefined;
  return <View testID="menu-preparation" style={s.root} accessibilityLabel="Preparando Dystopia">
    <View accessibilityRole="header" accessibilityLabel="Dystopia" style={{ flexDirection: 'row', gap: TITLE_GAP * scale }}>
      {TITLE_LETTERS.map(letter => <Image key={letter.character} accessible={false} source={letter.source} fadeDuration={0}
        style={[{ width: letter.width * scale, height: TITLE_HEIGHT * scale, resizeMode: 'stretch' }, nearest]} />)}
    </View>
    {error ? <View style={s.recovery}><Text accessibilityRole="alert" style={s.text}>No se pudo preparar el menú.</Text>
      {!!errorDetail && <Text testID="menu-preparation-error" numberOfLines={5} style={[s.text,{maxWidth:width-64,fontSize:12,textAlign:'center'}]}>{errorDetail}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel="Reintentar carga del menú" onPress={onRetry} style={s.retry}><Text style={s.text}>Reintentar</Text></Pressable>
    </View> : <ActivityIndicator color="#77535e" size="small" style={s.indicator} />}
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030507', alignItems: 'center', justifyContent: 'center' },
  indicator: { marginTop: 28 }, recovery: { marginTop: 24, gap: 12, alignItems: 'center' },
  text: { color: '#c8bfb1', fontSize: 14 }, retry: { minHeight: 48, paddingHorizontal: 26, justifyContent: 'center', borderColor: '#77535e', borderWidth: 1 },
});
