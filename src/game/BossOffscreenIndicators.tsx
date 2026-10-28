import React,{useMemo}from'react';
import{StyleSheet,View}from'react-native';
import{useSafeAreaInsets}from'react-native-safe-area-context';
import{Canvas,Path,Atlas,Skia,rect,useImage,FilterMode,MipmapMode}from'@shopify/react-native-skia';
import{useDerivedValue,type SharedValue}from'react-native-reanimated';
import{useControlSettings}from'../ui/ControlPreferences';
import{controlArea,elementBox,resolveElementLayout}from'../ui/controlLayout';
import{ELEMENT_IDS}from'../ui/controlSettings';
import{ENEMY_PRESENTATION_BOUNDS}from'./enemyPresentation';
import{ENEMY_VISUALS}from'./enemyAnimations';
import{PIXEL_GLYPHS}from'../ui/pixelGlyphs';
import{PIXEL_FONT_SOURCE}from'../ui/pixelFontAsset';
import{edgeIndicator,projectWorld,type CameraTransform,type ScreenBox}from'./indicatorGeometry';
import type{SurvivalState}from'./survival';
import type{Viewport,CameraBounds}from'./camera';
function Arrow({index,indicators}:{index:number;indicators:SharedValue<{x:number;y:number;angle:number;letter:string}[]>}){
  const path=useDerivedValue(()=>{const p=Skia.PathBuilder.Make(),a=indicators.value[index];if(a){const x=a.x,y=a.y,c=Math.cos(a.angle),s=Math.sin(a.angle);p.moveTo(x+c*14,y+s*14);p.lineTo(x-c*8-s*9,y-s*8+c*9);p.lineTo(x-c*3,y-s*3);p.lineTo(x-c*8+s*9,y-s*8-c*9);p.close();}return p.detach();});
  return <Path path={path} color={index?'#bfa9e1':'#ec879c'} style="stroke" strokeWidth={2}/>;
}
export default function BossOffscreenIndicators({survival,view,camera,visible}:{survival:SharedValue<SurvivalState>;view:SharedValue<Viewport&CameraBounds>;camera:SharedValue<CameraTransform>;visible:boolean}){
  const{settings}=useControlSettings(),insets=useSafeAreaInsets(),font=useImage(PIXEL_FONT_SOURCE);
  const controls=useMemo(()=>({settings,insets}),[settings,insets]);
  const indicators=useDerivedValue(()=>{
    const s=survival.value,v=view.value;if(!visible||s.presentation||s.mode!=='playing'||!s.boss&&!s.partner&&!s.minibosses.some(b=>b.packMember&&b.hp>0))return [];
    const area=controlArea(v.width,v.height,controls.insets),layout=resolveElementLayout(controls.settings,area);
    const blocked:ScreenBox[]=ELEMENT_IDS.map(id=>elementBox(id,layout[id],area));
    const principal=s.boss&&s.boss.hp>0?s.boss:s.minibosses.find(b=>b.packMember&&b.hp>0)??null;
    const targets=[principal,s.partner],result:{x:number;y:number;angle:number;letter:string}[]=[];
    for(const b of targets){if(!b||b.hp<=0||b.phase==='death')continue;
      const p=projectWorld(b,camera.value),bounds=ENEMY_PRESENTATION_BOUNDS[b.id],clip=ENEMY_VISUALS[b.id].idle,scale=clip.scale*p.scale;
      const mirror=b.facingX*clip.authoredFacing,left=(bounds.x-clip.pivotX)*scale*mirror,right=(bounds.x+bounds.width-clip.pivotX)*scale*mirror;
      const top=p.y+(bounds.y-clip.pivotY)*scale,bottom=top+bounds.height*scale;
      if(p.x+Math.max(left,right)>=0&&p.x+Math.min(left,right)<=v.width&&bottom>=0&&top<=v.height)continue;
      const a=edgeIndicator(p,v.width,v.height,blocked,Math.max(40,controls.insets.top+40),Math.max(20,controls.insets.bottom+18));
      if(a){result.push({...a,letter:b.id==='dagger-bandit'?'D':b.id==='archer-bandit'?'A':'!'});blocked.push({x:a.x-22,y:a.y-22,width:44,height:44});}
    }return result;
  });
  const sprites=useDerivedValue(()=>indicators.value.map(a=>{const g=PIXEL_GLYPHS[a.letter as keyof typeof PIXEL_GLYPHS];return rect(g.x,g.y,g.width,g.height);}));
  const transforms=useDerivedValue(()=>indicators.value.map(a=>Skia.RSXform(.55,0,a.x-3,a.y-30)));
  if(!visible)return null;
  return <View testID="boss-offscreen-indicators" pointerEvents="none" style={StyleSheet.absoluteFill}><Canvas style={StyleSheet.absoluteFill}><Arrow index={0} indicators={indicators}/><Arrow index={1} indicators={indicators}/>{font&&<Atlas image={font} sprites={sprites} transforms={transforms} sampling={{filter:FilterMode.Nearest,mipmap:MipmapMode.None}}/>}</Canvas></View>;
}
