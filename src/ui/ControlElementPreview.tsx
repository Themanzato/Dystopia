import React from 'react';
import { View } from 'react-native';
import type { ElementId, ControlId } from './controlSettings';
import { CONTROL_IDS } from './controlSettings';
import { elementSize, type ControlArea } from './controlLayout';
import { ControlVisual } from './ControlVisual';
import { FrenesisVisual } from './FrenesisHUD';
import { WaveReadout, PlayerVitals, BossReadout } from './GameHudVisuals';
import PixelText from './PixelText';
import UpgradeIcon from './UpgradeIcon';
import PixelBadge from './PixelBadge';
export default React.memo(function ControlElementPreview({id,area}:{id:ElementId;area:ControlArea}){
  const size=elementSize(id,area);
  if(CONTROL_IDS.includes(id as ControlId))return <ControlVisual id={id as ControlId} width={size.width} height={size.height}/>;
  switch(id){
    case 'frenesis':return <FrenesisVisual preview status={{active:false,ready:true,amount:100}}/>;
    case 'vitals':return <View style={{flex:1,justifyContent:'flex-end'}}><PlayerVitals hud={{hp:4,maxHp:5,armor:1,level:6,xp:40,xpNeeded:120,frenesis:{active:false,hp:0}}}/></View>;
    case 'wave':return <WaveReadout wave={7} run={null} remaining={12} width={size.width}/>;
    case 'boss':return <BossReadout width={size.width} boss={{name:'Guardian',hp:65,maxHp:100,powered:false,members:[]}}/>;
    case 'objectives':return <View style={{padding:8,gap:7,backgroundColor:'#160c16d9',borderLeftWidth:2,borderColor:'#93415e'}}><View style={{flexDirection:'row',alignItems:'center',gap:7}}><UpgradeIcon id="rhythm" size={26}/><View><PixelText text="RITMO DE ACERO" size={10} maxWidth={132} color="#e2adbd"/><PixelText text="Ataques 8 por ciento más rápidos" size={8} maxWidth={132}/></View></View><PixelText text="10 S CAPTURA / 90 S PLAZO" size={9} maxWidth={166}/><PixelText text="EN ZONA" size={9}/><View style={{height:3,backgroundColor:'#382531'}}><View style={{height:3,width:'40%',backgroundColor:'#c16c8a'}}/></View></View>;
    case 'notifications':return <View style={{minHeight:42,padding:6,backgroundColor:'#120d16c9',borderLeftWidth:2,borderColor:'#cc9bad',flexDirection:'row',gap:7,alignItems:'center'}}><PixelBadge kind="trophy" scale={1}/><View><PixelText text="Zona asegurada" size={11} maxWidth={size.width-40}/><PixelText text="Reclama en Misiones" size={9} maxWidth={size.width-40}/></View></View>;
  }
});
