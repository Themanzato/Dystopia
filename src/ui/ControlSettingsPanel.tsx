import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useControlSettings } from './ControlPreferences';
import { DEFAULT_CONTROLS, ELEMENT_IDS, type ElementId, type ElementLayout, type ElementPlacement, type ControlSettings } from './controlSettings';
import { ELEMENT_NAMES, ELEMENT_DESCRIPTIONS, controlArea, elementBox, elementSize, elementLimits, elementOpacity, elementOverlaps, moveElement, resolveElementLayout, type ControlArea } from './controlLayout';
import ControlElementPreview from './ControlElementPreview';
import { fitControlPreview, controlDraftForSave } from './controlEditorPreview';
import { useGameAudio } from './AudioProvider';
import { UIFrame } from './PixelArt';
import PixelText from './PixelText';
import Slider from './ControlSlider';
const ControlScenePreview=lazy(()=>import('./ControlScenePreview'));
function EditorButton({label,onPress,primary=false,disabled=false,compact=false}:{label:string;onPress:()=>void;primary?:boolean;disabled?:boolean;compact?:boolean}){
  const{playUi}=useGameAudio();return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPressIn={()=>playUi()} onPress={onPress} style={({pressed})=>({opacity:disabled ? .4 : pressed ? .65 : 1})}><UIFrame variant={primary?'primary':'button'} style={s.button}><PixelText text={label} size={10} maxWidth={compact?72:145}/></UIFrame></Pressable>;
}
function Handle({id,layout,area,settings,selected,previewScale,enabled,onSelect,onCommit}:{id:ElementId;layout:ElementLayout;area:ControlArea;settings:ControlSettings;selected:boolean;previewScale:number;enabled:boolean;onSelect:(id:ElementId)=>void;onCommit:(id:ElementId,p:ElementPlacement)=>void}){
  const position=useSharedValue(layout[id]),start=useSharedValue(layout[id]);
  useEffect(()=>position.set(layout[id]),[layout,id,position]);
  const pan=useMemo(()=>Gesture.Pan().enabled(enabled).minDistance(0).maxPointers(1).shouldCancelWhenOutside(false).runOnJS(false)
    .onBegin(()=>{'worklet';start.set(position.value);scheduleOnRN(onSelect,id);})
    .onUpdate(e=>{'worklet';position.set(moveElement(layout,id,{...start.value,x:start.value.x+e.translationX/previewScale/area.width,y:start.value.y+e.translationY/previewScale/area.height},area)[id]);})
    .onEnd(()=>{'worklet';scheduleOnRN(onCommit,id,position.value);})
    .onFinalize((_e,success)=>{'worklet';if(!success)position.set(layout[id]);}),[id,layout,area,position,start,onSelect,onCommit,previewScale,enabled]);
  const b=elementBox(id,layout[id],area),base=elementSize(id,area);
  const moving=useAnimatedStyle(()=>{const p=elementBox(id,position.value,area);return {left:p.x,top:p.y};});
  return <GestureDetector gesture={pan} touchAction="none" userSelect="none"><Animated.View testID={`editor-control-${id}`} accessible accessibilityRole="button" accessibilityLabel={`Mover ${ELEMENT_NAMES[id]}`} accessibilityState={{selected}} style={[s.handle,{width:b.width,height:b.height,zIndex:selected?50:10},moving]}>
    <View pointerEvents="none" style={{position:'absolute',left:(b.width-base.width)/2,top:(b.height-base.height)/2,width:base.width,height:base.height,transform:[{scale:b.scale}],opacity:elementOpacity(settings,id)}}><ControlElementPreview id={id} area={area}/></View>
    <View testID={`editor-box-${id}`} pointerEvents="none" style={[StyleSheet.absoluteFill,s.outline,{borderColor:selected?'#f5bdd5':'#987786',borderWidth:selected?2:1,backgroundColor:selected?'#c3678b16':'transparent'}]}/>
    {selected&&<View pointerEvents="none" style={s.tag}><PixelText text={ELEMENT_NAMES[id]} size={8} maxWidth={Math.max(55,b.width)} color="#f4dce6"/></View>}
  </Animated.View></GestureDetector>;
}
// Unchanged preview controls keep their native gestures and shared positions.
const MemoHandle=React.memo(Handle,(a,b)=>{
  const p=a.layout[a.id],q=b.layout[b.id];
  return a.id===b.id&&a.area===b.area&&a.previewScale===b.previewScale&&a.selected===b.selected&&a.enabled===b.enabled&&a.onSelect===b.onSelect&&a.onCommit===b.onCommit
    &&p.x===q.x&&p.y===q.y&&p.scale===q.scale&&p.opacity===q.opacity&&elementOpacity(a.settings,a.id)===elementOpacity(b.settings,b.id);
});
function Editor({onBack}:{onBack:()=>void}){
  const store=useControlSettings(),window=useWindowDimensions(),insets=useSafeAreaInsets();
  const[viewport,setViewport]=useState({width:window.width,height:window.height}),[stage,setStage]=useState({width:1,height:1});
  const area=useMemo(()=>controlArea(viewport.width,viewport.height,insets),[viewport,insets]);
  const[original]=useState(()=>store.settings),[draft,setDraft]=useState<ControlSettings>(()=>({...store.settings}));
  const[selected,select]=useState<ElementId>('joystick'),[hidden,setHidden]=useState(false),[confirmReset,setConfirmReset]=useState(false),[confirmOverlap,setConfirmOverlap]=useState(false);
  const[saving,setSaving]=useState(false),[saveError,setSaveError]=useState<string|null>(null),busy=useRef(false),panelScroll=useRef<ScrollView>(null);
  useEffect(()=>{panelScroll.current?.scrollTo({y:0,animated:false});},[selected]);
  const settings=draft,layout=useMemo(()=>resolveElementLayout(settings,area),[settings,area]);
  const overlaps=useMemo(()=>elementOverlaps(layout,area),[layout,area]);
  const dirty=JSON.stringify(draft)!==JSON.stringify(original);
  const change=useCallback((next:ControlSettings)=>{if(!busy.current){setDraft(next);setSaveError(null);}},[]);
  const commit=useCallback((id:ElementId,p:ElementPlacement)=>{
    if(busy.current)return;
    setDraft(previous=>{const next=moveElement(resolveElementLayout(previous,area),id,p,area);return {...previous,elements:{...previous.elements,[id]:next[id]}};});setSaveError(null);
  },[area]);
  const leave=useCallback(()=>{if(!busy.current)onBack();},[onBack]);
  useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{leave();return true;});return()=>listener.remove();},[leave]);
  const save=async(allowOverlap=false)=>{
    if(busy.current)return;
    if(overlaps.length&&!allowOverlap){setConfirmOverlap(true);return;}
    busy.current=true;setSaving(true);setSaveError(null);setConfirmOverlap(false);
    let saved=false;
    try{saved=await store.save(controlDraftForSave(draft,area));}
    catch{setSaveError('No se pudieron guardar los controles. Intenta de nuevo.');}
    busy.current=false;setSaving(false);if(saved)onBack();
  };
  const limits=elementLimits(selected),box=elementBox(selected,layout[selected],area),base=elementSize(selected,area);
  const panelWidth=Math.min(300,Math.max(220,viewport.width*.30));
  const preview=fitControlPreview(viewport,{width:stage.width-4,height:stage.height-4});
  return <View testID="control-editor" style={[s.screen,{paddingLeft:Math.max(10,insets.left),paddingRight:Math.max(10,insets.right),paddingTop:Math.max(6,insets.top),paddingBottom:Math.max(6,insets.bottom)}]} onLayout={e=>{const{width,height}=e.nativeEvent.layout;setViewport(old=>old.width===width&&old.height===height?old:{width,height});}}>
    <View testID="editor-toolbar" style={s.header}>
      <View style={{flex:1,gap:4}}><PixelText text="Configurar controles" size={viewport.width<700?12:16} maxWidth={viewport.width<700?180:280}/><PixelText testID="editor-save-status" text={saving?'Guardando...':dirty?'Cambios sin guardar':'Guardar para aplicar'} size={8} color={dirty?'#e4ad8f':'#abc5b8'} maxWidth={180}/></View>
      <EditorButton label="Volver" compact disabled={saving} onPress={leave}/><EditorButton label={saving?'Guardando...':'Guardar'} compact primary disabled={saving} onPress={()=>void save()}/>
    </View>
    <View style={s.body} pointerEvents={saving?'none':'auto'}>
      <View testID="editor-preview-stage" style={s.stage} onLayout={e=>{const{width,height}=e.nativeEvent.layout;setStage(old=>old.width===width&&old.height===height?old:{width,height});}}>
        {preview.scale>0&&<View testID="editor-preview-frame" style={[s.previewFrame,{width:preview.width+4,height:preview.height+4}]}>
          <View testID="control-editor-preview" style={{width:preview.width,height:preview.height,overflow:'hidden'}}>
            <View testID="editor-logical-scene" style={{position:'absolute',left:(preview.width-viewport.width)/2,top:(preview.height-viewport.height)/2,width:viewport.width,height:viewport.height,transform:[{scale:preview.scale}]}}>
              <Suspense fallback={null}><ControlScenePreview width={viewport.width} height={viewport.height}/></Suspense>
              {ELEMENT_IDS.map(id=><MemoHandle key={id} id={id} layout={layout} area={area} settings={settings} selected={selected===id} enabled={!saving&&!confirmReset&&!confirmOverlap} previewScale={preview.scale} onSelect={select} onCommit={commit}/>)}
            </View>
          </View>
        </View>}
      </View>
      {!hidden&&<View testID="editor-settings-panel" style={[s.panel,{width:panelWidth}]}>
        <PixelText text="Elementos (desliza)" size={9} maxWidth={panelWidth-16} color="#b9a4af"/>
        <ScrollView horizontal testID="editor-element-list" style={s.list} contentContainerStyle={{gap:5}} showsHorizontalScrollIndicator accessibilityLabel="Elementos de la interfaz">
          {ELEMENT_IDS.map(id=><Pressable key={id} testID={`editor-select-${id}`} accessibilityRole="button" accessibilityLabel={`Seleccionar ${ELEMENT_NAMES[id]}`} accessibilityState={{selected:selected===id}} onPress={()=>select(id)} style={[s.tab,selected===id&&s.selectedTab]}><PixelText text={ELEMENT_NAMES[id]} size={10} color={selected===id?'#f2c5da':'#b9a4af'}/></Pressable>)}
        </ScrollView>
        <ScrollView ref={panelScroll} style={{flex:1}} contentContainerStyle={{gap:12,paddingVertical:10}}>
          <View style={{gap:5}}><PixelText text={ELEMENT_NAMES[selected]} size={15} maxWidth={panelWidth-20} color="#efc3d5"/><PixelText text={ELEMENT_DESCRIPTIONS[selected]} size={9} maxWidth={panelWidth-20} color="#bfb4bb"/><PixelText text="Arrastra dentro de la vista previa." size={8} maxWidth={panelWidth-20} color="#b79aab"/></View>
          <Slider key={`size-${selected}`} id="editor-size" label="Tamaño del elemento" description={`Cambia el tamaño de ${ELEMENT_NAMES[selected]}.`} value={layout[selected].scale} min={limits[0]} max={limits[1]} onChange={scale=>commit(selected,{...layout[selected],scale})}/>
          <Slider key={`opacity-${selected}`} id="editor-element-opacity" label="Opacidad del elemento" description="Transparencia individual; se combina con su grupo." value={layout[selected].opacity} min={.15} max={1} onChange={opacity=>change({...settings,elements:{...settings.elements,[selected]:{...layout[selected],opacity}}})}/>
          <PixelText text={`Opacidad efectiva: ${Math.round(elementOpacity(settings,selected)*1000)/10}%`} size={9} maxWidth={panelWidth-20} color="#b6cfbf"/>
          <View style={s.divider}/><PixelText text="Ajustes globales" size={12} color="#d8b4c5"/>
          <Slider id="editor-buttons-opacity" label="Opacidad de botones" description="Transparencia de joystick, ataque, dash, pausa y Frenesis." value={settings.opacity} min={.15} max={1} onChange={opacity=>change({...settings,opacity})}/>
          <Slider id="editor-hud-opacity" label="Opacidad del HUD" description="Transparencia de vida, EXP, oleada, enemigos, jefes y avisos. No cambia los menús." value={settings.hudOpacity??1} min={.15} max={1} onChange={hudOpacity=>change({...settings,hudOpacity})}/>
          {overlaps.length>0&&<View testID="editor-overlap-warning"><PixelText text={`Se superponen: ${overlaps.slice(0,2).map(([a,b])=>ELEMENT_NAMES[a]+' / '+ELEMENT_NAMES[b]).join(', ')}`} size={9} maxWidth={panelWidth-20} color="#e5ad8e"/></View>}
          {(saveError||store.error)&&<PixelText text={saveError||store.error||''} size={9} maxWidth={panelWidth-20} color="#e9a292"/>}
          <PixelText text={`Elemento: ${Math.round(base.width*box.scale)} x ${Math.round(base.height*box.scale)}`} size={8} maxWidth={panelWidth-20} color="#9fa9a5"/>
        </ScrollView>
      </View>}
    </View>
    <View testID="editor-footer" style={s.footer}><EditorButton label={hidden?'Mostrar panel':'Ocultar panel'} disabled={saving} onPress={()=>setHidden(!hidden)}/><EditorButton label="Restablecer por defecto" disabled={saving} onPress={()=>setConfirmReset(true)}/>{viewport.width>=740&&<PixelText text="Volver descarta el borrador" size={9} maxWidth={220} color="#b6a3af"/>}</View>
    {confirmOverlap&&<View style={s.confirm} accessibilityViewIsModal><UIFrame variant="panel" style={s.dialog}><PixelText text="Hay elementos superpuestos" size={16} maxWidth={320}/><PixelText text="Guardar esta distribución de todas formas?" size={11} maxWidth={320}/><EditorButton label="Guardar así" primary onPress={()=>void save(true)}/><EditorButton label="Seguir editando" onPress={()=>setConfirmOverlap(false)}/></UIFrame></View>}
    {confirmReset&&<View style={s.confirm} accessibilityViewIsModal><UIFrame variant="panel" style={s.dialog}><PixelText text="Restablecer predeterminados?" size={16} maxWidth={320}/><PixelText text="Recupera posiciones, tamaños y opacidades originales en el borrador. Pulsa Guardar para aplicarlos." size={11} maxWidth={320}/><EditorButton label="Seguir editando" onPress={()=>setConfirmReset(false)}/><EditorButton label="Restablecer" primary onPress={()=>{change({...DEFAULT_CONTROLS,layout:null,elements:null});setConfirmReset(false);}}/></UIFrame></View>}
  </View>;
}
export default function ControlSettingsPanel({onBack}:{onBack:()=>void}){const store=useControlSettings();return store.ready?<Editor onBack={onBack}/>:<View style={s.screen}><PixelText text="Cargando controles..." size={16}/><EditorButton label="Volver" onPress={onBack}/></View>;}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#110c14',gap:8},button:{minWidth:44,minHeight:40,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},handle:{position:'absolute',alignItems:'center',justifyContent:'center'},outline:{borderStyle:'dashed'},tag:{position:'absolute',bottom:0,alignSelf:'center',backgroundColor:'#160e1bd9',padding:2},header:{height:46,flexDirection:'row',alignItems:'center',gap:8},body:{flex:1,minHeight:0,flexDirection:'row',gap:12},stage:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center'},previewFrame:{borderWidth:2,borderColor:'#8b6079',backgroundColor:'#08090d',overflow:'hidden'},list:{height:38,maxHeight:38,flexGrow:0},tab:{minWidth:68,minHeight:36,alignItems:'center',justifyContent:'center',paddingHorizontal:9,borderWidth:1,borderColor:'#5e4055'},selectedTab:{backgroundColor:'#542b44',borderColor:'#e0a6c4'},panel:{padding:8,backgroundColor:'#1c111d',borderWidth:1,borderColor:'#755166'},divider:{height:1,backgroundColor:'#624057'},footer:{minHeight:42,flexDirection:'row',alignItems:'center',gap:8},confirm:{...StyleSheet.absoluteFill,zIndex:200,backgroundColor:'#100a16e8',alignItems:'center',justifyContent:'center',padding:16},dialog:{maxWidth:370,padding:20,gap:16}});
