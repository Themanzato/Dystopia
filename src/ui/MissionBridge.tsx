import { elementSize, controlArea } from './controlLayout';
import GameplayElement from './GameplayElement';
import React,{useCallback,useEffect,useRef,useState}from'react';
import{AppState,View,useWindowDimensions}from'react-native';
import Animated,{useAnimatedReaction,useAnimatedStyle,type SharedValue}from'react-native-reanimated';
import{scheduleOnRN}from'react-native-worklets';
import{MISSIONS,MISSION_BALANCE,missionPulse,pendingMissions,advanceMissions,type MissionPulse}from'../game/missions';
import{type CameraTransform}from'../game/indicatorGeometry';
import type{SurvivalState}from'../game/survival';
import type{PlayerState}from'../game/player';
import type{Viewport,CameraBounds}from'../game/camera';
import{getScores,recordMissionProgress}from'./ScoreStorage';
import PixelText from'./PixelText';
import PixelBadge from'./PixelBadge';
export default function MissionBridge({survival,runId,visible}:{survival:SharedValue<SurvivalState>;player:SharedValue<PlayerState>;view:SharedValue<Viewport&CameraBounds>;camera:SharedValue<CameraTransform>;runId:string;visible:boolean}){
  const dimensions=useWindowDimensions(),labelWidth=elementSize('notifications',controlArea(dimensions.width,dimensions.height,{left:0,right:0,top:0,bottom:0})).width-40;
  const[queue,setQueue]=useState<string[]>([]),latest=useRef<MissionPulse|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(false);
  const noticed=useRef(new Set(pendingMissions(getScores().missions).map(m=>m.id)));
  const flush=useCallback(()=>{
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
    const pulse=latest.current;if(!pulse)return;
    void recordMissionProgress(pulse).then(()=>{
      if(!mounted.current)return;
      const fresh=pendingMissions(getScores().missions).filter(m=>!noticed.current.has(m.id)).map(m=>m.id);
      if(fresh.length){fresh.forEach(id=>noticed.current.add(id));setQueue(old=>[...old,...fresh]);}
    }).catch(()=>{/* Retain the latest monotonic checkpoint for the next flush. */});
  },[]);
  const accept=useCallback((pulse:MissionPulse)=>{
    latest.current=pulse;
    const p=getScores().missions,next=advanceMissions(p,pulse),before=new Set(pendingMissions(p).map(m=>m.id));
    const completes=pendingMissions(next).some(m=>!before.has(m.id));
    if(pulse.close||completes)flush();else if(!timer.current)timer.current=setTimeout(flush,MISSION_BALANCE.checkpointMs);
  },[flush]);
  useAnimatedReaction(()=>JSON.stringify(missionPulse(survival.value,runId)),(next,old)=>{if(next!==old)scheduleOnRN(accept,JSON.parse(next));},[survival,runId,accept]);
  useEffect(()=>{
    mounted.current=true;
    const listener=AppState.addEventListener('change',()=>{latest.current=missionPulse(survival.value,runId);flush();});
    return()=>{mounted.current=false;listener.remove();latest.current=missionPulse(survival.value,runId);flush();};
  },[survival,runId,flush]);
  useEffect(()=>{if(!visible)flush();},[visible,flush]);
  const current=queue[0];
  useEffect(()=>{if(!current||!visible)return;const handle=setTimeout(()=>setQueue(old=>old.slice(1)),MISSION_BALANCE.toastMs);return()=>clearTimeout(handle);},[current,visible]);
  const placement=useAnimatedStyle(()=>({opacity:visible&&current&&!survival.value.presentation?1:0}),[current,visible]);
  const mission=MISSIONS.find(m=>m.id===current);
  if(!mission)return null;
  return <GameplayElement id="notifications"><Animated.View testID="mission-completed-toast" pointerEvents="none" style={[{width:'100%',minHeight:42,padding:6,backgroundColor:'#120d16c9',borderLeftWidth:2,borderColor:'#cc9bad',flexDirection:'row',gap:7,alignItems:'center'},placement]}><PixelBadge kind="trophy" scale={1}/><View><PixelText text={mission.name} size={11} maxWidth={labelWidth} color="#e3c9a5"/><PixelText text="Reclama en Misiones" size={9} maxWidth={labelWidth} color="#b7c5b9"/></View></Animated.View></GameplayElement>;
}
