import GameplayElement from '../ui/GameplayElement';
import { captureArrowVisible, projectWorld, type CameraTransform } from './indicatorGeometry';
import UpgradeIcon from '../ui/UpgradeIcon';
import { UPGRADE_INFO } from './survival';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Atlas, Canvas, FilterMode, Group, MipmapMode, Path, Skia, rect, useImage } from '@shopify/react-native-skia';
import { useAnimatedReaction, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { clampCamera, type CameraBounds, type Viewport } from './camera';
import type { PlayerState } from './player';
import type { SurvivalState } from './survival';
import { REWARD_SITES, SHIP_SITES } from './worldEventSites';
import { WORLD_EVENT_CONFIG, type ZoneReward } from './worldEvents';
import PixelText from '../ui/PixelText';
import { PIXEL_FONT_SOURCE } from '../ui/pixelFontAsset';
import { PIXEL_GLYPHS } from '../ui/pixelGlyphs';

const NAMES: Record<ZoneReward,string> = { vitality: 'VITALIDAD', rhythm: 'RITMO DE ACERO', speed: 'PASO LIGERO', xp: `EXP +${WORLD_EVENT_CONFIG.rewardXp}` };
const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };
type Props = { survival: SharedValue<SurvivalState> };
/** Ground-only signals retain the immutable city's original depth ordering. */
export function WorldEventGround({ survival }: Props) {
  const zone = useDerivedValue(() => {
    const p = Skia.PathBuilder.Make(), z = survival.value.world.zone;
    if (z) {
      p.addCircle(z.x,z.y,z.radius);
      const b = REWARD_SITES.find(s=>s.id===z.siteId)?.building;
      if (b) p.addRect(rect(b.x-5,b.y-5,b.width+10,b.height+10));
    }
    return p.detach();
  });
  const link = useDerivedValue(() => {
    const p=Skia.PathBuilder.Make(), z=survival.value.world.zone;
    const b=z && REWARD_SITES.find(s=>s.id===z.siteId)?.building;
    if(z&&b){p.moveTo(b.x+b.width/2,b.y+b.height);p.lineTo(z.x,z.y);}
    return p.detach();
  });
  return <Group><Path path={zone} color="#8b274c" opacity={0.23}/><Path path={zone} color="#b75a78" style="stroke" strokeWidth={2}/><Path path={link} color="#b75a78" opacity={0.45} style="stroke" strokeWidth={2}/></Group>;
}
/** At most three labels and two icons. Glyph layout changes only with the text. */
export function WorldEventEffects({ survival, player }: Props & { player?: SharedValue<PlayerState> }) {
  const font=useImage(PIXEL_FONT_SOURCE);
  const rings=useDerivedValue(()=>{
    const p=Skia.PathBuilder.Make(), w=survival.value.world;
    if(w.ship?.phase==='alarm'){
      const s=SHIP_SITES.find(s=>s.id===w.ship?.siteId);
      if(s){p.addCircle(s.x,s.y,46+(w.ship.elapsedMs%750)/750*32);p.addRect(rect(s.bounds.x-7,s.bounds.y-7,s.bounds.width+14,s.bounds.height+14));}
    }
    return p.detach();
  });
  const progress=useDerivedValue(()=>{
    const p=Skia.PathBuilder.Make(), z=survival.value.world.zone;
    if(z){const count=Math.floor(z.elapsedMs/(z.requiredMs??WORLD_EVENT_CONFIG.rewardDurationMs)*60);for(let i=0;i<count;i++){const a=-Math.PI/2+i*Math.PI/30,b=a+0.07;p.moveTo(z.x+z.radius*Math.cos(a),z.y+z.radius*Math.sin(a));p.lineTo(z.x+z.radius*Math.cos(b),z.y+z.radius*Math.sin(b));}}
    return p.detach();
  });
  const labels=useDerivedValue(()=>{
    const w=survival.value.world;
    return JSON.stringify([
      ...(w.zone?[{id:'zone',text:Math.ceil(((w.zone.requiredMs??WORLD_EVENT_CONFIG.rewardDurationMs)-w.zone.elapsedMs)/1000)+' S'}]:[]),
      ...(w.ship?.phase==='alarm'?[{id:'ship',text:'PELIGRO  '+Math.max(0,Math.ceil((WORLD_EVENT_CONFIG.shipWarningMs-w.ship.elapsedMs)/1000))}]:[]),
      ...(w.notice?[{id:'notice',text:w.notice.text}]:[]),
      ...(w.damageNotice?[{id:'damage',text:'-'+w.damageNotice.amount}]:[]),
    ]);
  });
  const glyphs=useDerivedValue(()=>{
    const result:{id:string;x:number;scale:number;source:{x:number;y:number;width:number;height:number}}[]=[];
    for(const l of JSON.parse(labels.value) as {id:string;text:string}[]){
      const chars=Array.from(l.text.toUpperCase()), sources=chars.map(c=>PIXEL_GLYPHS[c as keyof typeof PIXEL_GLYPHS]??PIXEL_GLYPHS['?']);
      const scale=l.id==='damage'?1.2:0.75;
      let x=-sources.reduce((n,s)=>n+s.width+2,0)*scale/2;
      sources.forEach((source,i)=>{if(chars[i]!==' ')result.push({id:l.id,x,scale,source});x+=(source.width+2)*scale;});
    }
    return result;
  });
  const sprites=useDerivedValue(()=>glyphs.value.map(g=>rect(g.source.x,g.source.y,g.source.width,g.source.height)));
  const transforms=useDerivedValue(()=>glyphs.value.map(g=>{
    const w=survival.value.world;
    const p=g.id==='damage'?player?.value:g.id==='zone'?w.zone:g.id==='ship'?SHIP_SITES.find(s=>s.id===w.ship?.siteId):w.notice;
    const offset=g.id==='damage'?-70-(w.damageNotice?.elapsedMs??0)/60:g.id==='zone'?((w.zone?.radius??96)+12):g.id==='ship'?-90:-60-(w.notice?.elapsedMs??0)/160;
    return p?Skia.RSXform(g.scale,0,p.x+g.x,p.y+offset):Skia.RSXform(0,0,0,0);
  }));
  const colors=useDerivedValue(()=>glyphs.value.map(g=>{
    const n=survival.value.world.notice;
    const damage=survival.value.world.damageNotice;
    const a=g.id==='damage'&&damage?Math.min(1,(WORLD_EVENT_CONFIG.captureDamageNoticeMs-damage.elapsedMs)/300):g.id==='notice'&&n?Math.min(1,(WORLD_EVENT_CONFIG.noticeMs-n.elapsedMs)/500):1;
    return Skia.Color((g.id==='damage'?'rgba(255,132,154,':'rgba(248,211,184,')+Math.max(0,a)+')');
  }));
  return <Group>
    <Path path={rings} color="#df7080" style="stroke" strokeWidth={2}/>
    <Path path={progress} color="#e9a0b6" style="stroke" strokeWidth={5}/>
    {font&&<Group><Group transform={[{translateX:1.5},{translateY:1.5}]}><Atlas image={font} sprites={sprites} transforms={transforms} color="#100c12" sampling={sampling}/></Group><Atlas image={font} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" sampling={sampling}/></Group>}
  </Group>;
}
/** Marker originates beside the player and stays clear of the touch controls. */
export function WorldEventHUD({ survival, player, view, visible, camera: actualCamera }: Props & {camera?:SharedValue<CameraTransform>;player:SharedValue<PlayerState>;view:SharedValue<CameraBounds&Viewport>;visible:boolean}) {
  const read=useCallback(()=>{
    'worklet';
    const w=survival.value.world,z=w.zone;
    const required=z?.requiredMs??WORLD_EVENT_CONFIG.rewardDurationMs;
    return {reward:z?.reward??null,seconds:z?Math.ceil((required-z.elapsedMs)/1000):0,deadline:z?Math.ceil((WORLD_EVENT_CONFIG.captureDeadlineMs-(z.deadlineElapsedMs??0))/1000):0,
      progress:z?z.elapsedMs/required:0,inside:z?.inside??false,started:z?.started??(z?.elapsedMs??0)>0,alarm:w.ship?.phase==='alarm'};
  },[survival]);
  const [status,setStatus]=useState(read);
  useAnimatedReaction(()=>{
    const w=survival.value.world,z=w.zone;
    return [z?.id,z?.reward,z?Math.ceil(((z.requiredMs??WORLD_EVENT_CONFIG.rewardDurationMs)-z.elapsedMs)/1000):0,
      z?Math.ceil((WORLD_EVENT_CONFIG.captureDeadlineMs-(z.deadlineElapsedMs??0))/1000):0,z?.inside,(z?.elapsedMs??0)>0,w.ship?.phase==='alarm'].join('|');
  },(key,old)=>{if(key!==old)scheduleOnRN(setStatus,read());},[read,survival]);
  const arrow=useDerivedValue(()=>{
    const path=Skia.PathBuilder.Make(), w=survival.value.world,v=view.value,p=player.value;
    const target=w.ship?.phase==='alarm'?SHIP_SITES.find(s=>s.id===w.ship?.siteId):w.zone;
    if(!target)return path.detach();
    const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy);
    if(w.ship?.phase!=='alarm'&&w.zone&&!captureArrowVisible(p,w.zone))return path.detach();
    if(distance<35)return path.detach();
    const camera=clampCamera(p,v),angle=Math.atan2(dy,dx);
    const point=actualCamera?projectWorld(p,actualCamera.value):{x:v.width/2+(p.x-camera.x)*v.scale,y:v.height/2+(p.y-camera.y)*v.scale};
    const px=point.x,py=point.y;
    const x=Math.max(24,Math.min(v.width-24,px+Math.cos(angle)*66)),y=Math.max(76,Math.min(v.height-118,py+Math.sin(angle)*66));
    const a=Math.cos(angle),b=Math.sin(angle);
    path.moveTo(x+a*12,y+b*12);path.lineTo(x-a*8-b*8,y-b*8+a*8);path.lineTo(x-a*3,y-b*3);path.lineTo(x-a*8+b*8,y-b*8-a*8);path.close();
    return path.detach();
  });
  if(!visible)return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Canvas style={StyleSheet.absoluteFill}><Path path={arrow} color={status.alarm?'#e6a36d':'#d690ad'} style="stroke" strokeWidth={2}/></Canvas></View>
    {(status.reward||status.alarm)&&<GameplayElement id="objectives"><View pointerEvents="auto" testID="world-event-hud" style={styles.panel}>
      {status.alarm&&<PixelText text="ALARMA DE NAVE" size={11} color="#f1ac88" maxWidth={172}/>}
      {status.reward&&<>
        <View style={styles.row}><UpgradeIcon id={status.reward} size={26}/><View><PixelText text={NAMES[status.reward]} size={10} color="#e2adbd" maxWidth={132}/><PixelText text={status.reward==='xp'?`+${WORLD_EVENT_CONFIG.rewardXp} EXP`:UPGRADE_INFO[status.reward].description} size={8} maxWidth={132} color="#b5ccbf"/></View></View>
        <PixelText text={`${status.seconds} S CAPTURA / ${status.deadline} S PLAZO`} size={9} maxWidth={166} color="#edcbd7"/>
        <PixelText text={status.inside?'EN ZONA':status.started?'FUERA +1 S/S':'ENTRAR'} size={9} color={status.inside?'#edcbd7':'#b79eaa'}/>
        <View style={styles.track}><View style={[styles.fill,{width:`${Math.max(0,Math.min(1,status.progress))*100}%`}]}/></View>
      </>}
    </View></GameplayElement>}
  </View>;
}
const styles=StyleSheet.create({panel:{width:'100%',padding:8,gap:7,backgroundColor:'#160c16d9',borderLeftWidth:2,borderColor:'#93415e'},row:{flexDirection:'row',alignItems:'center',gap:7},icon:{width:26,height:26,resizeMode:'contain'},track:{height:3,backgroundColor:'#382531'},fill:{height:3,backgroundColor:'#c16c8a'}});
