import React from 'react';
import { StyleSheet, View } from 'react-native';
import PixelText from './PixelText';
import { PURGATORIO_ROSTER, type PurgatorioState } from '../game/purgatorio';
import { FRENESIS } from '../game/frenesis';
export function HudBar({value,color,label}:{value:number;color:string;label:string}){
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(Math.max(0,Math.min(1,value))*100)}} style={s.track}><View style={[s.fill,{width:`${Math.max(0,Math.min(1,value))*100}%`,backgroundColor:color}]}/></View>;
}
export function WaveReadout({wave,run,remaining,width=156}:{wave:number;run:PurgatorioState|null;remaining:number;width?:number}){
  const textWidth=Math.max(56,width-14);
  return <View testID="survival-hud" pointerEvents="auto" style={s.frame}>
    <PixelText text={run?'Encuentro '+run.number:'Oleada '+(wave||1)} size={12} maxWidth={textWidth}/>
    <View testID="enemy-counter"><PixelText text={'Enemigos '+remaining} size={10} maxWidth={textWidth} color="#bac4b7"/></View>
    {run&&<View testID="purgatorio-chain" style={{gap:3}}><PixelText text={run.kind==='single'?'Individual':'Cadena '+Math.min(run.cleared,PURGATORIO_ROSTER.length)+'/'+PURGATORIO_ROSTER.length} size={8} maxWidth={textWidth} color="#c9a3b1"/>
      {run.kind==='infinite'&&<HudBar value={run.cleared/PURGATORIO_ROSTER.length} color="#a55678" label={'Progreso de cadena '+Math.min(run.cleared,PURGATORIO_ROSTER.length)+' de '+PURGATORIO_ROSTER.length}/>}
      {run.kind==='infinite'&&run.cleared>=PURGATORIO_ROSTER.length&&<PixelText text="Aleatorio - dificultad +" size={7} maxWidth={textWidth} color="#b78b9e"/>}</View>}
  </View>;
}
export type VitalData={hp:number;maxHp:number;armor:number;level:number;xp:number;xpNeeded:number;frenesis:{active:boolean;hp:number}};
export function PlayerVitals({hud}:{hud:VitalData}){
  return <View testID="player-vitals" pointerEvents="auto" style={[s.frame,{gap:4,width:'100%',minHeight:68,justifyContent:'center',marginTop:'auto'}]}><View testID="life-container" style={{gap:4}}>
    {hud.frenesis.active&&<View testID="frenesis-temporary-hp" style={{gap:3}}><PixelText text={`Glitch ${hud.frenesis.hp}/${FRENESIS.temporaryHp}`} size={8} color="#d490cb"/><HudBar value={hud.frenesis.hp/FRENESIS.temporaryHp} color="#d490cb" label={`Vida temporal ${hud.frenesis.hp} de ${FRENESIS.temporaryHp}`}/></View>}
    <View style={{flexDirection:'row',justifyContent:'space-between',gap:4}}><PixelText text={`Vida ${hud.hp}/${hud.maxHp}`} size={8}/><PixelText text={`Nv ${hud.level}`} size={8} color="#bed1c1"/></View>
    <HudBar value={hud.hp/Math.max(1,hud.maxHp)} color="#c77577" label={`Vida ${hud.hp} de ${hud.maxHp}`}/>
    {hud.armor>0&&<><PixelText text={`Armadura ${hud.armor}`} size={8} color="#93b6c6"/><HudBar value={hud.armor/3} color="#93b6c6" label={`Armadura ${hud.armor}`}/></>}
    <HudBar value={hud.xp/Math.max(1,hud.xpNeeded)} color="#85b9ae" label={`EXP ${hud.xp} de ${hud.xpNeeded}`}/>
  </View></View>;
}
export type BossData={name:string;hp:number;maxHp:number;powered:boolean;members:{name:string;hp:number;maxHp:number}[]};
export function BossReadout({boss,width}:{boss:BossData;width:number}){
  return <View pointerEvents="auto" testID="boss-hud" style={{width:'100%',alignItems:'center',gap:5}}>
    <PixelText text={boss.name} size={14} align="center" maxWidth={width} color={boss.powered?'#b34462':'#e3b8a9'}/>
    <HudBar value={boss.hp/Math.max(1,boss.maxHp)} color="#b05762" label={`Vida de ${boss.name}: ${boss.hp} de ${boss.maxHp}`}/>
    {boss.members.length>1&&<View testID="boss-partner-health" style={{flexDirection:'row',gap:5,width:'100%'}}>{boss.members.map((m,index)=><View key={m.name} style={{flex:1}}><HudBar value={m.hp/Math.max(1,m.maxHp)} color={m.hp<=0?'#353239':index===0?'#ae7c85':'#8a749d'} label={`Vida individual de ${m.name}: ${m.hp} de ${m.maxHp}`}/></View>)}</View>}
  </View>;
}
const s=StyleSheet.create({frame:{paddingHorizontal:6,paddingVertical:5,gap:4,backgroundColor:'#080f13bc',borderWidth:1,borderColor:'#75616c',borderRadius:2},track:{height:5,width:'100%',backgroundColor:'#23292b',borderWidth:1,borderColor:'#53615a',overflow:'hidden'},fill:{height:'100%'}});
