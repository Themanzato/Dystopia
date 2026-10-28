import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameAudio } from './AudioProvider';
import { useSession } from './session';
import { UIFrame, UIIcon } from './PixelArt';
import PixelText from './PixelText';

export default function TutorialOffer() {
  const session = useSession(), audio = useGameAudio(), insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = width < 740 || height < 360;
  const cardWidth=Math.min(610,width-Math.max(16,insets.left)-Math.max(16,insets.right));
  const actions=[{label:'Comenzar',run:session.beginTutorial},{label:'Saltar',run:session.skipTutorial}];
  return <View testID="tutorial-offer" style={[s.screen, { paddingLeft: Math.max(16,insets.left), paddingRight: Math.max(16,insets.right), paddingTop: Math.max(10,insets.top), paddingBottom: Math.max(10,insets.bottom) }]}>
    <UIFrame variant="panel" style={[s.panel,{width:cardWidth,gap:compact?12:18,padding:compact?18:28}]}>
      <UIIcon icon="gamepad" size={34}/>
      <PixelText text="Entrenamiento" size={compact?23:29} align="center" maxWidth={cardWidth-36}/>
      <PixelText text="Aprende a moverte, combatir y usar Frenesis." size={compact?12:14} align="center" maxWidth={Math.min(470,cardWidth-36)} color="#bfc5be"/>
      <View style={s.actions}>{actions.map(({label,run})=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPressIn={()=>audio.playUi()} onPress={run}>
        <UIFrame variant={label==='Comenzar'?'primary':'button'} style={[s.button,{minWidth:compact?132:172}]}><PixelText text={label} size={compact?15:18}/></UIFrame>
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" style={s.back} onPressIn={()=>audio.playUi()} onPress={session.closeSettings}><PixelText text="Volver" size={12} color="#ad98a6"/></Pressable>
    </UIFrame>
  </View>;
}
const s=StyleSheet.create({screen:{...StyleSheet.absoluteFill,backgroundColor:'#04070be8',alignItems:'center',justifyContent:'center'},panel:{alignItems:'center'},actions:{flexDirection:'row',gap:12},back:{minWidth:96,minHeight:44,alignItems:'center',justifyContent:'center'},button:{minHeight:52,paddingHorizontal:16,paddingVertical:12,alignItems:'center',justifyContent:'center'}});
