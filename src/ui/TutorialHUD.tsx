import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { CameraBounds, Viewport } from '../game/camera';
import type { PlayerState } from '../game/player';
import type { SurvivalState } from '../game/survival';
import { tutorialStep, tutorialPanelBox, TUTORIAL_INSTRUCTIONS, type TutorialStep } from '../game/tutorialInstructions';
import { controlArea, elementBox, elementOpacity, resolveElementLayout } from './controlLayout';
import type { ElementId } from './controlSettings';
import { useControlSettings } from './ControlPreferences';
import PixelText from './PixelText';
import { UIFrame } from './PixelArt';
import { useGameAudio } from './AudioProvider';

type TutorialSnapshot={step:TutorialStep|null;width:number;height:number};
type TutorialSurvival=SurvivalState & {tutorial?:{step:string}|null};
type Props={survival:SharedValue<SurvivalState>;player:SharedValue<PlayerState>;view:SharedValue<Viewport&CameraBounds>;visible:boolean;onContinue:()=>void;onExit:()=>void;onStartGame:()=>void;onCompleted?:()=>void};
function TutorialButton({text,onPress,primary=false}:{text:string;onPress:()=>void;primary?:boolean}){
  const {playUi}=useGameAudio();
  return <Pressable accessibilityRole="button" accessibilityLabel={text} onPressIn={()=>playUi()} onPress={onPress} style={({pressed})=>({opacity:pressed ? .65 : 1})}><UIFrame variant={primary?'primary':'button'} style={styles.button}><PixelText text={text} size={10}/></UIFrame></Pressable>;
}
function Highlight({id,settings,area,survival}:{id:ElementId;settings:ReturnType<typeof useControlSettings>['settings'];area:ReturnType<typeof controlArea>;survival:SharedValue<SurvivalState>}){
  const layout=resolveElementLayout(settings,area),box=elementBox(id,layout[id],area);
  const pulse=useAnimatedStyle(()=>({opacity:(.68+.32*Math.abs(Math.sin(survival.value.clockMs/240)))*(.65+.35*elementOpacity(settings,id))}));
  const x=Math.max(0,box.x-4),y=Math.max(0,box.y-4);
  return <Animated.View testID={`tutorial-highlight-${id}`} pointerEvents="none" style={[styles.highlight,{left:x,top:y,width:Math.min(area.width-x,box.width+8),height:Math.min(area.height-y,box.height+8)},pulse]}/>;
}
/** Observes discrete tutorial milestones. No private gameplay controls, clocks,
 * attack callbacks or renderer updates are created by the instructional overlay. */
export default function TutorialHUD({survival,view,visible,onContinue,onExit,onStartGame,onCompleted}:Props){
  const {settings}=useControlSettings(),insets=useSafeAreaInsets();
  const read=useCallback(():TutorialSnapshot=>({step:tutorialStep((survival.value as TutorialSurvival).tutorial?.step),width:view.value.width,height:view.value.height}),[survival,view]);
  const [snapshot,setSnapshot]=useState(read);
  const sync=useCallback(()=>setSnapshot(read()),[read]);
  useAnimatedReaction(()=>{
    const t=(survival.value as TutorialSurvival).tutorial,v=view.value;
    return `${t?.step??''}|${v.width}|${v.height}`;
  },(key,old)=>{if(key!==old)scheduleOnRN(sync);},[survival,view,sync]);
  const completed=useRef(false),pressed=useRef<string|null>(null);
  const reportCompleted=useCallback(()=>{
    if(!completed.current&&(survival.value as TutorialSurvival).tutorial?.step==='finish'){completed.current=true;onCompleted?.();}
  },[survival,onCompleted]);
  useEffect(()=>{if(snapshot.step==='finish')reportCompleted();},[snapshot.step,reportCompleted]);
  useEffect(()=>{pressed.current=null;},[snapshot.step,visible]);
  const once=useCallback((action:string,callback:()=>void)=>{
    if(pressed.current!==null)return;
    pressed.current=action;callback();
  },[]);
  const area=useMemo(()=>controlArea(snapshot.width,snapshot.height,insets),[snapshot.width,snapshot.height,insets]);
  const info=snapshot.step?TUTORIAL_INSTRUCTIONS[snapshot.step]:null;
  if(!visible||!snapshot.step||!info)return null;
  if(snapshot.step==='finish')return <View testID="tutorial-completed" accessibilityViewIsModal style={styles.finish}>
    <UIFrame variant="panel" style={[styles.finishCard,{width:Math.min(440,area.width-32)}]}>
      <PixelText text="Entrenamiento completado" size={area.width<700?20:25} maxWidth={Math.min(390,area.width-68)} align="center" color="#e3c7d1"/>
      <PixelText text="Ya estás listo para sobrevivir a las oleadas" size={12} maxWidth={Math.min(370,area.width-72)} align="center"/>
      <View style={styles.finishButtons}><TutorialButton text="Iniciar partida" primary onPress={()=>once('start',()=>{reportCompleted();onStartGame();})}/><TutorialButton text="Menú" onPress={()=>once('exit',()=>{reportCompleted();onExit();})}/></View>
    </UIFrame>
  </View>;
  const box=tutorialPanelBox(snapshot.step,settings,area);
  return <View testID="tutorial-hud" pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    {info.highlights.map(id=><Highlight key={id} id={id} settings={settings} area={area} survival={survival}/>)}
    <View pointerEvents="box-none" testID="tutorial-instruction-panel" style={{position:'absolute',left:box.x,top:box.y,width:box.width,height:box.height}}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}><UIFrame variant="panel" style={styles.cardBackground}/></View>
      <View pointerEvents="none" style={styles.text}><PixelText testID="tutorial-instruction" text={info.text} size={box.textSize} maxWidth={box.width-24} color="#edcfda"/></View>
      <View pointerEvents="box-none" style={styles.actions}>
        {info.continue&&<TutorialButton text="Continuar" primary onPress={()=>once(snapshot.step!,onContinue)}/>}
        <TutorialButton text="Saltar" onPress={()=>once('exit',onExit)}/>
      </View>
    </View>
  </View>;
}
const styles=StyleSheet.create({
  highlight:{position:'absolute',borderWidth:2,borderColor:'#e3b2d4',borderRadius:4,backgroundColor:'transparent'},
  cardBackground:{width:'100%',height:'100%',backgroundColor:'#0a0a12e8',borderLeftWidth:2,borderLeftColor:'#9e4e72'},
  text:{paddingHorizontal:12,paddingTop:9},
  actions:{position:'absolute',bottom:5,right:7,left:7,flexDirection:'row',justifyContent:'flex-end',gap:8},
  button:{minHeight:44,minWidth:62,paddingHorizontal:12,justifyContent:'center',alignItems:'center'},
  finish:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',backgroundColor:'#09070edb'},
  finishCard:{padding:22,gap:18,alignItems:'center'},
  finishButtons:{flexDirection:'row',gap:12,justifyContent:'center',flexWrap:'wrap'},
});
