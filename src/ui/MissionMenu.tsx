import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MISSIONS, missionStatus, type MissionCategory } from '../game/missions';
import { useScores, claimMission, loadScores } from './ScoreStorage';
import { useSession } from './session';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
import PixelBadge from './PixelBadge';
const CATEGORIES:Record<MissionCategory,string>={initiation:'Iniciación',mastery:'Dominio',extreme:'Extremos'};
const STATES={locked:'Bloqueada',available:'',progress:'',pending:'Por reclamar',claimed:'Reclamada'};
export default function MissionMenu(){
  const {archive,ready,error}=useScores(),session=useSession(),audio=useGameAudio(),insets=useSafeAreaInsets(),{width}=useWindowDimensions();
  const [category,setCategory]=useState<MissionCategory>('initiation'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),flight=useRef(false);
  const usable=width-Math.max(16,insets.left)-Math.max(16,insets.right),cardWidth=Math.min(380,(usable-12)/2);
  const claim=async(id:string)=>{if(flight.current)return;flight.current=true;setBusy(true);try{setMessage((await claimMission(id)).message);}catch{setMessage('No se pudo guardar. Puedes reintentar el reclamo.');}finally{flight.current=false;setBusy(false);}};
  return <View testID="missions-menu" style={[s.screen,{paddingLeft:Math.max(16,insets.left),paddingRight:Math.max(16,insets.right),paddingTop:Math.max(10,insets.top),paddingBottom:Math.max(10,insets.bottom)}]}>
    <View style={s.header}><PixelBadge kind="trophy"/><PixelText text="Misiones" size={26}/><PixelText text={`${archive.economy.cells} Celdas`} size={13} maxWidth={usable-280} color="#d9c58c"/><Pressable accessibilityRole="button" accessibilityLabel="Volver de Misiones" onPressIn={()=>audio.playUi()} onPress={session.closeSettings}><UIFrame variant="button" style={s.button}><PixelText text="Volver" size={12}/></UIFrame></Pressable></View>
    <View style={s.tabs}>{(Object.keys(CATEGORIES) as MissionCategory[]).map(id=><Pressable key={id} accessibilityRole="tab" accessibilityLabel={CATEGORIES[id]} accessibilityState={{selected:id===category}} onPressIn={()=>audio.playUi()} onPress={()=>setCategory(id)}><UIFrame variant={id===category?'primary':'button'} style={[s.button,{width:Math.min(225,(usable-20)/3)}]}><PixelText text={CATEGORIES[id]} size={13}/></UIFrame></Pressable>)}</View>
    {!!message&&<PixelText text={message} size={11} maxWidth={usable} color="#c4d7ae"/>}
    {error?<Pressable accessibilityRole="button" accessibilityLabel="Reintentar cargar Misiones" onPress={()=>{void loadScores().catch(()=>{});}}><PixelText text={`${error} Toca para reintentar.`} size={12} maxWidth={usable}/></Pressable>:!ready?<PixelText text="Cargando misiones..." size={13}/>:<ScrollView testID="mission-list" contentContainerStyle={s.grid}>
      {MISSIONS.filter(m=>m.category===category).map(m=>{const status=missionStatus(archive.missions,m),progress=Math.min(m.target,archive.missions.progress[m.id]??0),requirement=MISSIONS.find(x=>x.id===m.requires);return <UIFrame key={m.id} variant={status==='pending'?'primary':'button'} style={[s.card,{width:cardWidth}]}>
        <View testID={`mission-${m.id}`} style={s.copy}><View style={s.header}><PixelBadge kind={status==='claimed'?'trophy':'record'} scale={1}/><PixelText text={m.name} size={16} maxWidth={cardWidth-60} color={status==='pending'?'#e4c897':'#d6bbc7'}/></View>
          <PixelText text={m.description} size={11} maxWidth={cardWidth-24}/>
          {!!STATES[status]&&<PixelText text={STATES[status]} size={9} maxWidth={cardWidth-24} color="#abaca6"/>}
          <View style={s.progressRow}>
            <View style={s.progressCopy}><View accessibilityRole="progressbar" accessibilityLabel={`Progreso de ${m.name}`} accessibilityValue={{min:0,max:m.target,now:progress}} style={s.track}><View style={[s.fill,{width:`${progress/m.target*100}%`}]}/></View><PixelText text={`${progress}/${m.target}`} size={11} color="#c1c7bb"/></View>
            <View testID={`mission-reward-${m.id}`} style={s.reward}><PixelBadge kind="cell" scale={1}/><PixelText text={`${m.reward} Celdas`} size={11} maxWidth={82} align="center" color="#d9c58c"/></View>
          </View>
          {status==='locked'&&requirement&&<PixelText text={`Reclama antes: ${requirement.name}`} size={9} maxWidth={cardWidth-24} color="#ad8796"/>}
          {status==='pending'&&<Pressable accessibilityRole="button" accessibilityLabel={`Reclamar ${m.name}`} disabled={busy} onPressIn={()=>audio.playUi()} onPress={()=>{void claim(m.id);}}><UIFrame variant="primary" style={s.button}><PixelText text="Reclamar" size={13}/></UIFrame></Pressable>}
        </View></UIFrame>;})}
    </ScrollView>}
  </View>;
}
const s=StyleSheet.create({screen:{...StyleSheet.absoluteFill,backgroundColor:'#08090df5',gap:10},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},tabs:{flexDirection:'row',justifyContent:'center',gap:10},button:{minHeight:44,minWidth:86,padding:8,alignItems:'center',justifyContent:'center'},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center',paddingBottom:12},card:{padding:12},copy:{gap:9},progressRow:{flexDirection:'row',alignItems:'center',gap:12},progressCopy:{flex:1,gap:8},reward:{width:94,minHeight:44,paddingLeft:10,borderLeftWidth:1,borderColor:'#68505c',alignItems:'center',justifyContent:'center',gap:5},track:{height:4,backgroundColor:'#382b35'},fill:{height:4,backgroundColor:'#bb7995'}});
