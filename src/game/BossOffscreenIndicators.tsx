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
import{PLAGUE_BOUNDS,PLAGUE_VISUALS}from'./plagueAssets';
import{PIXEL_GLYPHS}from'../ui/pixelGlyphs';
import{PIXEL_FONT_SOURCE}from'../ui/pixelFontAsset';
import{edgeIndicator,projectWorld,type CameraTransform,type ScreenBox}from'./indicatorGeometry';
import type{BossState,SurvivalState}from'./survival';
import type{Viewport,CameraBounds}from'./camera';
function bossScreenBounds(b:BossState,camera:CameraTransform){
  'worklet';
  const variant=b.plague?.variant;
  const p=projectWorld({x:b.x,y:b.y-(b.plague?.height??0)},camera);
  const bounds=variant?PLAGUE_BOUNDS[variant]:ENEMY_PRESENTATION_BOUNDS[b.id];
  const clip=variant?PLAGUE_VISUALS[variant].idle:ENEMY_VISUALS[b.id].idle,scale=clip.scale*p.scale;
  const mirror=b.facingX*clip.authoredFacing,left=(bounds.x-clip.pivotX)*scale*mirror,right=(bounds.x+bounds.width-clip.pivotX)*scale*mirror;
  const top=p.y+(bounds.y-clip.pivotY)*scale;
  return {point:p,x:p.x+Math.min(left,right),y:top,width:Math.abs(right-left),height:bounds.height*scale};
}
function isOnScreen(b:ReturnType<typeof bossScreenBounds>,width:number,height:number){
  'worklet';return b.x+b.width>=0&&b.x<=width&&b.y+b.height>=0&&b.y<=height;
}
function Arrow({index,indicators}:{index:number;indicators:SharedValue<{x:number;y:number;angle:number;letter:string}[]>}){
  const path=useDerivedValue(()=>{const p=Skia.PathBuilder.Make(),a=indicators.value[index];if(a){const x=a.x,y=a.y,c=Math.cos(a.angle),s=Math.sin(a.angle);p.moveTo(x+c*14,y+s*14);p.lineTo(x-c*8-s*9,y-s*8+c*9);p.lineTo(x-c*3,y-s*3);p.lineTo(x-c*8+s*9,y-s*8-c*9);p.close();}return p.detach();});
  return <Path path={path} color={index?'#bfa9e1':'#ec879c'} style="stroke" strokeWidth={2}/>;
}
export default function BossOffscreenIndicators({survival,view,camera,visible}:{survival:SharedValue<SurvivalState>;view:SharedValue<Viewport&CameraBounds>;camera:SharedValue<CameraTransform>;visible:boolean}){
  const{settings}=useControlSettings(),insets=useSafeAreaInsets(),font=useImage(PIXEL_FONT_SOURCE);
  const controls=useMemo(()=>({settings,insets}),[settings,insets]);
  const indicators=useDerivedValue(()=>{
    const s=survival.value,v=view.value;if(!visible||s.presentation||s.mode!=='playing'||!s.boss&&!s.partner&&!s.minibosses.some(b=>(b.packMember||b.id==='the-plague')&&b.hp>0))return [];
    const area=controlArea(v.width,v.height,controls.insets),layout=resolveElementLayout(controls.settings,area);
    const blocked:ScreenBox[]=ELEMENT_IDS.map(id=>elementBox(id,layout[id],area));
    let principal=s.boss&&s.boss.hp>0?s.boss:s.minibosses.find(b=>(b.packMember||b.id==='the-plague')&&b.hp>0)??null;
    // One shared encounter marker: suppress it while any insect is visible;
    // otherwise guide toward the closest survivor, even after its leader dies.
    if(s.plague){
      const insects=[s.boss,...s.minibosses].filter((b):b is BossState=>Boolean(b&&b.id==='the-plague'&&b.hp>0&&b.phase!=='death'));
      principal=null;let distance=Infinity;
      for(const insect of insects){const box=bossScreenBounds(insect,camera.value);if(isOnScreen(box,v.width,v.height)){principal=insect;break;}const next=Math.hypot(box.point.x-v.width/2,box.point.y-v.height/2);if(next<distance){principal=insect;distance=next;}}
    }
    const targets=[principal,s.partner],result:{x:number;y:number;angle:number;letter:string}[]=[];
    for(const b of targets){if(!b||b.hp<=0||b.phase==='death')continue;
      const box=bossScreenBounds(b,camera.value),p=box.point;
      if(isOnScreen(box,v.width,v.height))continue;
      const a=edgeIndicator(p,v.width,v.height,blocked,Math.max(40,controls.insets.top+40),Math.max(20,controls.insets.bottom+18));
      if(a){result.push({...a,letter:b.id==='dagger-bandit'?'D':b.id==='archer-bandit'?'A':'!'});blocked.push({x:a.x-22,y:a.y-22,width:44,height:44});}
    }return result;
  });
  const sprites=useDerivedValue(()=>indicators.value.map(a=>{const g=PIXEL_GLYPHS[a.letter as keyof typeof PIXEL_GLYPHS];return rect(g.x,g.y,g.width,g.height);}));
  const transforms=useDerivedValue(()=>indicators.value.map(a=>Skia.RSXform(.55,0,a.x-3,a.y-30)));
  if(!visible)return null;
  return <View testID="boss-offscreen-indicators" pointerEvents="none" style={StyleSheet.absoluteFill}><Canvas style={StyleSheet.absoluteFill}><Arrow index={0} indicators={indicators}/><Arrow index={1} indicators={indicators}/>{font&&<Atlas image={font} sprites={sprites} transforms={transforms} sampling={{filter:FilterMode.Nearest,mipmap:MipmapMode.None}}/>}</Canvas></View>;
}
