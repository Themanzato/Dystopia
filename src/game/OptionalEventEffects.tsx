import GameplayElement from '../ui/GameplayElement';
import UpgradeIcon from '../ui/UpgradeIcon';
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Atlas, Canvas, FilterMode, Group, MipmapMode, Path, RadialGradient, Fill, Skia, rect } from '@shopify/react-native-skia';
import { useSharedImage as useImage } from '../ui/sharedImages';
import { useDerivedValue, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { OPTIONAL_EVENT_CONFIG as C, OPTIONAL_EVENT_NAMES, type OptionalKind } from './optionalEvents';
import type { SurvivalState } from './survival';
import type { PlayerState } from './player';
import { frenesisVisualPosition } from './frenesis';
import { clampCamera, type CameraBounds, type Viewport } from './camera';
import { ASSETS } from './assets';
import PixelText from '../ui/PixelText';
import { PIXEL_FONT_SOURCE } from '../ui/pixelFontAsset';
import { PIXEL_GLYPHS } from '../ui/pixelGlyphs';

type Props={survival:SharedValue<SurvivalState>};
const sampling={filter:FilterMode.Nearest,mipmap:MipmapMode.None};
/** Ground signals and a real ten-cell shrine. Bodies remain above these marks. */
export function OptionalEventGround({survival}:Props){
  const shrine=useImage(ASSETS.kiln),font=useImage(PIXEL_FONT_SOURCE);
  const zones=useDerivedValue(()=>{
    const path=Skia.PathBuilder.Make(),e=survival.value.world.optional?.active;
    if(e)for(const p of e.points)path.addCircle(p.x,p.y,C.zoneRadius);
    return path.detach();
  });
  const progress=useDerivedValue(()=>{
    const path=Skia.PathBuilder.Make(),e=survival.value.world.optional?.active;
    if(e)for(const p of e.points){
      const ratio=p.progressMs/(e.kind==='nest'?C.nestCaptureMs:C.energyCaptureMs);
      for(let i=0;i<Math.floor(ratio*40);i++){const a=-Math.PI/2+i*Math.PI/20,b=a+0.12;path.moveTo(p.x+C.zoneRadius*Math.cos(a),p.y+C.zoneRadius*Math.sin(a));path.lineTo(p.x+C.zoneRadius*Math.cos(b),p.y+C.zoneRadius*Math.sin(b));}
      if(e.kind==='reactor'){path.moveTo(p.x-12,p.y+8);path.lineTo(p.x,p.y+2);path.lineTo(p.x+12,p.y+8);path.lineTo(p.x,p.y+14);path.close();}
    }
    return path.detach();
  });
  const cells=useDerivedValue(()=>{const e=survival.value.world.optional?.active;return [rect(Math.floor((e?.elapsedMs??0)*10/1000)%10*32,0,32,33)];});
  const anchors=useDerivedValue(()=>{const e=survival.value.world.optional?.active,p=e?.points[0];return [e?.kind==='nest'&&p?Skia.RSXform(1.5,0,p.x-24,p.y-46.5):Skia.RSXform(0,0,0,0)];});
  const glyphs=useDerivedValue(()=>{
    const e=survival.value.world.optional?.active,result:{source:{x:number;y:number;width:number;height:number};x:number;y:number}[]=[];
    if(e)e.points.forEach((p,index)=>{
      const required=e.kind==='nest'?C.nestCaptureMs:C.energyCaptureMs;
      const text=p.complete?'OK':`${e.kind==='reactor'?index+1+' / ':''}${Math.ceil((required-p.progressMs)/1000)} S`;
      let x=p.x-text.length*3;
      for(const ch of text){const source=PIXEL_GLYPHS[ch as keyof typeof PIXEL_GLYPHS]??PIXEL_GLYPHS['?'];if(ch!==' ')result.push({source,x,y:p.y+C.zoneRadius+10});x+=(source.width+2)*0.6;}
    });return result;
  });
  const sprites=useDerivedValue(()=>glyphs.value.map(g=>rect(g.source.x,g.source.y,g.source.width,g.source.height)));
  const transforms=useDerivedValue(()=>glyphs.value.map(g=>Skia.RSXform(0.6,0,g.x,g.y)));
  return <Group><Path path={zones} color="#943c60" opacity={0.1}/><Path path={zones} color="#ba6e93" opacity={0.7} style="stroke" strokeWidth={2}/>
    <Path path={progress} color="#80cfc5" style="stroke" strokeWidth={4}/>
    {shrine&&<Atlas image={shrine} sprites={cells} transforms={anchors} sampling={sampling}/>}
    {font&&<Atlas image={font} sprites={sprites} transforms={transforms} sampling={sampling}/>}</Group>;
}
/** Darkness is below hazards/projectiles and all HUD. It never hides warning FX. */
export function ReactorVision({survival,player}:Props&{player:SharedValue<PlayerState>}){
  const center=useDerivedValue(()=>{const p=frenesisVisualPosition(player.value,survival.value.frenesis);return {x:p.x,y:p.y-18};});
  const radius=useDerivedValue(()=>C.visionRecoveredRadius-(C.visionRecoveredRadius-C.visionRadius)*(survival.value.world.optional?.visibility??0));
  const opacity=useDerivedValue(()=>survival.value.world.optional?.visibility??0);
  return <Group opacity={opacity}><Fill><RadialGradient c={center} r={radius} colors={['#03060b00','#03060b00','#03060bc2']} positions={[0,0.65,1]}/></Fill></Group>;
}
/** Elite identity is a small wine crown and HP ticks, not a different NPC asset. */
export function EliteMarkers({survival}:Props){
  const markers=useDerivedValue(()=>{const p=Skia.PathBuilder.Make();for(const n of survival.value.encounter.enemies){if(!n.active||n.action==='death'||!n.eliteEventId)continue;
    const y=n.y-74;p.moveTo(n.x-9,y+6);p.lineTo(n.x-9,y);p.lineTo(n.x-4,y+3);p.lineTo(n.x,y-3);p.lineTo(n.x+4,y+3);p.lineTo(n.x+9,y);p.lineTo(n.x+9,y+6);
    for(let i=0;i<(n.hp??1);i++)p.addRect(rect(n.x-9+i*7,y+10,5,2));}return p.detach();});
  return <Path path={markers} color="#e7a1c0" style="stroke" strokeWidth={1.5}/>;
}
function status(s:SurvivalState){
  'worklet';
  const o=s.world.optional,e=o?.active;
  const limit=e?.phase==='queued'?C.queuedDeadlineMs:e?.phase==='warning'?C.warningMs:e?.kind==='elite'?C.eliteDeadlineMs:e?.kind==='nest'?C.nestDeadlineMs:C.reactorDeadlineMs;
  return {kind:e?.kind??o?.notice?.kind??null,phase:e?.phase??'',wave:e?.wave??0,seconds:e?Math.max(0,Math.ceil((limit-e.elapsedMs)/1000)):0,
    progress:e?.points.reduce((sum,p)=>sum+p.progressMs,0)??0,activated:e?.points.filter(p=>p.complete).length??0,
    success:o?.notice?.success??false,notice:!e&&Boolean(o?.notice)};
}
export function OptionalEventHUD({survival,player,view,visible}:Props&{player:SharedValue<PlayerState>;view:SharedValue<CameraBounds&Viewport>;visible:boolean}){
  const [value,setValue]=useState(()=>status(survival.value));
  useAnimatedReaction(()=>{const o=survival.value.world.optional,e=o?.active;return [e?.id,e?.phase,e?Math.ceil(e.elapsedMs/1000):0,e?.points.filter(p=>p.complete).length,e?.points.map(p=>Math.floor(p.progressMs/1000)).join(','),o?.notice?.kind,o?.notice?.success].join('|');},
    (next,old)=>{if(next!==old)scheduleOnRN(setValue,status(survival.value));},[survival]);
  const arrow=useDerivedValue(()=>{
    const path=Skia.PathBuilder.Make(),e=survival.value.world.optional?.active,v=view.value,p=frenesisVisualPosition(player.value,survival.value.frenesis);
    const point=e?.points.filter(p=>!p.complete).slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    if(!point||Math.hypot(point.x-p.x,point.y-p.y)<C.zoneRadius)return path.detach();
    const camera=clampCamera(p,v),a=Math.atan2(point.y-p.y,point.x-p.x),dx=Math.cos(a),dy=Math.sin(a);
    const x=Math.max(24,Math.min(v.width-24,v.width/2+(p.x-camera.x)*v.scale+dx*72)),y=Math.max(76,Math.min(v.height-118,v.height/2+(p.y-camera.y)*v.scale+dy*72));
    path.moveTo(x+dx*11,y+dy*11);path.lineTo(x-dx*8-dy*7,y-dy*8+dx*7);path.lineTo(x-dx*3,y-dy*3);path.lineTo(x-dx*8+dy*7,y-dy*8-dx*7);path.close();return path.detach();
  });
  if(!visible||!value.kind)return null;
  const reward=C.rewards[value.kind as OptionalKind];
  const copy=value.notice?(value.success?'COMPLETADO':'EVENTO FALLIDO'):value.phase==='queued'?`PROXIMA OLEADA ${value.wave}`:value.phase==='warning'?`COMIENZA EN ${value.seconds}`:value.kind==='elite'?`OLEADA ${value.wave} / ${value.seconds} S`:value.kind==='nest'?`DESACTIVAR / ${value.seconds} S`:`ENERGIA ${value.activated}/3 / ${value.seconds} S`;
  const total=value.kind==='nest'?C.nestCaptureMs:C.energyCaptureMs*3;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}><Canvas style={StyleSheet.absoluteFill}><Path path={arrow} color="#d1a0c2" style="stroke" strokeWidth={2}/></Canvas></View>
    <GameplayElement id="objectives"><View pointerEvents="auto" testID="optional-event-hud" style={styles.panel}>
      <PixelText text={OPTIONAL_EVENT_NAMES[value.kind]} size={11} maxWidth={170} color="#e8b2c9"/>
      <PixelText text={copy} size={9} maxWidth={170}/>
      {value.phase==='active'&&value.kind!=='elite'&&<View style={styles.track}><View style={[styles.fill,{width:`${Math.min(100,value.progress/total*100)}%`}]}/></View>}
      {(!value.notice||value.success)&&<View style={{flexDirection:'row',gap:10}}>{[{id:'xp',name:'Experiencia',effect:`+${reward.xp} EXP`},{id:'frenesis',name:'Frenesis',effect:`+${reward.frenesis}%`}].map(r=><View key={r.id} style={{flexDirection:'row',gap:4,alignItems:'center'}}><UpgradeIcon id={r.id} size={18}/><View><PixelText text={r.name} size={7}/><PixelText text={r.effect} size={8} color="#a4c8c2"/></View></View>)}</View>}
    </View></GameplayElement>
  </View>;
}
const styles=StyleSheet.create({panel:{width:'100%',padding:8,gap:7,backgroundColor:'#130d19e8',borderLeftWidth:2,borderColor:'#a15c82'},track:{height:3,backgroundColor:'#352633'},fill:{height:3,backgroundColor:'#80cfc5'}});
