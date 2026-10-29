import EquipmentPreview from './EquipmentPreview';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PURGATORIO_ROSTER, PURGATORIO_DIFFICULTY_NAMES, canSelectPurgatorio, purgatorioName } from '../game/purgatorio';
import type { Difficulty } from '../game/difficulty';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { usePurgatorioProgress } from './PurgatorioProgress';
import PurgatorioPortrait from './PurgatorioEncounterPortrait';
import PixelText from './PixelText';
import { UIFrame, UIIcon } from './PixelArt';

export default function PurgatorioMenu() {
  const session=useSession(),audio=useGameAudio(),insets=useSafeAreaInsets();
  const {progress,error}=usePurgatorioProgress();
  const [requirement,setRequirement]=useState(false);
  const {width,height}=useWindowDimensions();
  const compact=width<740||height<360;
  const left=Math.max(20,insets.left),right=Math.max(20,insets.right);
  const featureWidth=compact?168:220, columns=compact?2:3;
  const rosterWidth=width-left-right-featureWidth-18;
  const cardWidth=Math.floor((rosterWidth-(columns-1)*10)/columns);
  return <View testID="purgatorio-menu" style={[s.screen,{paddingLeft:left,paddingRight:right,paddingTop:Math.max(12,insets.top),paddingBottom:Math.max(12,insets.bottom)}]}>
    <View style={s.header}>
      <PixelText text="Purgatorio" size={compact?24:31} color="#d4a6b3" maxWidth={compact?170:220}/>
      <View style={s.difficulties}>{(['easy','hard','dystopia'] as Difficulty[]).map(id=><Pressable key={id}
        accessibilityRole="button" accessibilityLabel={PURGATORIO_DIFFICULTY_NAMES[id]} accessibilityState={{selected:session.difficulty===id}} aria-pressed={session.difficulty===id}
        onPressIn={()=>audio.playUi()} onPress={()=>session.setDifficulty(id)}>
        <UIFrame variant={session.difficulty===id?'primary':'button'} style={[s.difficulty,{minWidth:compact?70:82},id==='dystopia'&&s.wine]}>
          <PixelText text={PURGATORIO_DIFFICULTY_NAMES[id]} size={compact?10:12} color={session.difficulty===id?'#edd1c2':'#b7a8ae'}/>
        </UIFrame>
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver al menú" onPressIn={()=>audio.playUi()} onPress={session.closeSettings}>
        <UIFrame variant="button" style={s.back}><UIIcon icon="left" size={17}/><PixelText text="Volver" size={12}/></UIFrame>
      </Pressable>
    </View>
    <View style={s.body}>
      <Pressable accessibilityRole="button" accessibilityLabel="Infinito" onPressIn={()=>audio.playUi()} onPress={()=>session.startPurgatorio('infinite')} style={{width:featureWidth}}>
        <UIFrame variant="danger" style={[s.infinite,{height:'100%'}]}>
          <PixelText text="Purgatorio infinito" size={compact?19:25} maxWidth={featureWidth-24} color="#edbfcc" align="center"/>
          <View testID="purgatorio-infinite-art" style={{alignItems:'center',justifyContent:'center',paddingTop:6}}>{canSelectPurgatorio('tarnished-widow',progress)?<PurgatorioPortrait id="tarnished-widow" width={featureWidth-28} height={Math.max(52,Math.min(128,height-272))}/>:<UIIcon icon="gamepad" size={compact?48:64}/>}</View>
        </UIFrame>
      </Pressable>
      <ScrollView testID="purgatorio-roster" style={{width:rosterWidth}} contentContainerStyle={s.list} showsVerticalScrollIndicator>
        {PURGATORIO_ROSTER.map((id,index)=>{
          const unlocked=canSelectPurgatorio(id,progress),name=unlocked?purgatorioName(id):'NO IDENTIFICADO';
          return <Pressable key={id} testID={unlocked?`purgatorio-${id}`:`purgatorio-unknown-${index}`} accessibilityRole="button" accessibilityLabel={unlocked?name:'NO IDENTIFICADO, bloqueado'}
            accessibilityHint={unlocked?'Iniciar encuentro individual':'Derrota a este jefe en Supervivencia o Purgatorio infinito para identificarlo'}
            onPressIn={()=>audio.playUi()} onPress={()=>{if(unlocked)session.startPurgatorio(id);else setRequirement(true);}}>
            <UIFrame variant="button" style={[s.card,{width:cardWidth},!unlocked&&s.locked]}>
              <View style={s.cardTop}><PixelText text={String(index+1).padStart(2,'0')} size={9} color="#b6a2a6"/><UIIcon icon={unlocked?'check':'close'} size={14}/></View>
              <View style={s.portrait}>{unlocked?<PurgatorioPortrait id={id} width={id==='dagger-bandit'||id==='the-plague'?cardWidth-18:Math.min(96,cardWidth-18)} height={68}/>:<PixelText text="?" size={44} color="#d4a6b3"/>}</View>
              <View style={s.name}><PixelText text={name} size={compact?10:11} maxWidth={cardWidth-18} align="center" color={unlocked?'#ded3bd':'#b59ba7'}/></View>
              <PixelText text={unlocked?'Identificado':'Bloqueado'} size={8} color={unlocked?'#93b6a0':'#aa7f90'}/>
            </UIFrame>
          </Pressable>;
        })}
      </ScrollView>
    </View>
    <EquipmentPreview />
    {requirement&&<Pressable testID="purgatorio-identification-requirement" accessibilityRole="button" accessibilityLabel="Cerrar requisito" onPress={()=>setRequirement(false)} style={s.requirement}><UIFrame variant="panel" style={s.requirementCard}><PixelText text="Derrota a este jefe en Supervivencia o Purgatorio infinito para identificarlo" size={compact?11:13} maxWidth={Math.min(410,width-left-right-36)} align="center"/><PixelText text="Cerrar" size={10}/></UIFrame></Pressable>}
    {error&&<PixelText text={error} size={10} maxWidth={width-left-right} color="#d9a28e"/>}
  </View>;
}
const s=StyleSheet.create({
  screen:{...StyleSheet.absoluteFill,backgroundColor:'#09070df0',gap:14},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  difficulties:{flexDirection:'row',gap:5},difficulty:{minHeight:40,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},wine:{backgroundColor:'#35111e'},
  back:{minHeight:42,paddingHorizontal:10,flexDirection:'row',gap:6,alignItems:'center'},body:{flex:1,flexDirection:'row',gap:18},
  infinite:{backgroundColor:'#29101c',padding:12,alignItems:'center',justifyContent:'center',gap:10},
  list:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingBottom:14},card:{height:164,padding:8,alignItems:'center',gap:5,backgroundColor:'#101017'},
  portrait:{height:68,alignItems:'center',justifyContent:'center'},name:{height:32,alignItems:'center',justifyContent:'center'},
  requirement:{...StyleSheet.absoluteFill,backgroundColor:'#040309b8',alignItems:'center',justifyContent:'center'},requirementCard:{padding:20,gap:16,alignItems:'center'},
  cardTop:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},locked:{opacity:0.55},
});
