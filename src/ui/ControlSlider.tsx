import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type FrameInfo } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import PixelText from './PixelText';

const PREVIEW_INTERVAL_MS=32;
export function sliderValueAt(x:number,width:number,min:number,max:number){
  'worklet';return min+(max-min)*Math.max(0,Math.min(1,(x-12)/Math.max(1,width-24)));
}
export function roundedSliderValue(value:number){'worklet';return Math.round(value*100)/100;}

/** The thumb follows the UI pointer, never a React render or a timing animation. */
export default function ControlSlider({id,label,description,value,min,max,onChange}:{id:string;label:string;description:string;value:number;min:number;max:number;onChange:(v:number)=>void}){
  const [contentWidth,setContentWidth]=useState(240),change=useRef(onChange),alive=useRef(true);
  const live=useSharedValue(value),width=useSharedValue(160),dragging=useSharedValue(false),awaiting=useSharedValue(false);
  const queued=useSharedValue(false),dirty=useSharedValue(false),lastSent=useSharedValue(value),lastAt=useSharedValue(-1e12);
  useLayoutEffect(()=>{change.current=onChange;},[onChange]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useLayoutEffect(()=>{
    if(dragging.value)return;
    if(awaiting.value){
      // A delayed intermediate React render must not rewind the finger's final value.
      if(Math.abs(value-roundedSliderValue(live.value))<.00001)awaiting.set(false);
      return;
    }
    live.set(value);
  });
  const deliver=useCallback(()=>{
    try{
      if(!alive.current)return;
      // Read at execution time: at most one RN job exists, always carrying the latest value.
      const latest=roundedSliderValue(live.value);lastSent.set(latest);change.current(latest);
    }finally{queued.set(false);}
  },[live,lastSent,queued]);
  useFrameCallback(useCallback((frame:FrameInfo)=>{
    'worklet';
    if(!dirty.value||queued.value)return;
    if(dragging.value&&(frame.timestamp-lastAt.value<PREVIEW_INTERVAL_MS||roundedSliderValue(live.value)===lastSent.value))return;
    queued.set(true);dirty.set(false);lastAt.set(frame.timestamp);scheduleOnRN(deliver);
  },[dirty,queued,dragging,lastAt,live,lastSent,deliver]));
  const gesture=useMemo(()=>{
    const update=(x:number)=>{'worklet';live.set(sliderValueAt(x,width.value,min,max));dirty.set(true);};
    return Gesture.Pan().minDistance(0).maxPointers(1).shouldCancelWhenOutside(false).runOnJS(false)
      .onBegin(e=>{'worklet';dragging.set(true);awaiting.set(true);lastAt.set(-1e12);update(e.x);})
      .onUpdate(e=>{'worklet';update(e.x);})
      .onFinalize(()=>{
        'worklet';dragging.set(false);dirty.set(true);lastAt.set(-1e12);
        if(!queued.value){queued.set(true);dirty.set(false);scheduleOnRN(deliver);}
      });
  },[live,width,min,max,dirty,dragging,awaiting,lastAt,queued,deliver]);
  const thumbStyle=useAnimatedStyle(()=>({transform:[{translateX:Math.max(0,Math.min(1,(live.value-min)/(max-min)))*Math.max(1,width.value-24)}]}));
  const fillStyle=useAnimatedStyle(()=>({width:`${Math.max(0,Math.min(1,(live.value-min)/(max-min)))*100}%`}));
  const step=(delta:number)=>{
    const next=Math.max(min,Math.min(max,roundedSliderValue(live.value+delta)));
    awaiting.set(false);live.set(next);change.current(next);
  };
  return <View style={s.setting} onLayout={e=>setContentWidth(e.nativeEvent.layout.width)}>
    <View style={s.row}><PixelText text={label} size={11} maxWidth={Math.max(80,contentWidth-58)}/><PixelText testID={`${id}-value`} text={`${Math.round(value*100)}%`} size={11} color="#e9bdcf"/></View>
    <PixelText text={description} size={9} maxWidth={contentWidth} color="#bbb0b8"/>
    <View style={s.row}><Pressable accessibilityRole="button" accessibilityLabel={`Reducir ${label}`} onPress={()=>step(-.05)} style={s.step}><PixelText text="-" size={19}/></Pressable>
      <GestureDetector gesture={gesture} touchAction="none"><View testID={id} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{min:Math.round(min*100),max:Math.round(max*100),now:Math.round(value*100)}} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={e=>step(e.nativeEvent.actionName==='increment'?.05:-.05)} onLayout={e=>width.set(e.nativeEvent.layout.width)} collapsable={false} style={s.slider}>
        <View pointerEvents="none" style={s.track}><Animated.View testID={`${id}-fill`} style={[s.fill,fillStyle]}/></View><Animated.View testID={`${id}-thumb`} pointerEvents="none" style={[s.thumb,thumbStyle]}/>
      </View></GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel={`Aumentar ${label}`} onPress={()=>step(.05)} style={s.step}><PixelText text="+" size={19}/></Pressable>
    </View>
  </View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},setting:{gap:5},step:{width:32,height:40,alignItems:'center',justifyContent:'center'},slider:{height:40,flex:1},track:{position:'absolute',left:12,right:12,top:18,height:4,backgroundColor:'#4d3448'},fill:{height:4,backgroundColor:'#c287a9'},thumb:{position:'absolute',left:4,top:10,width:16,height:20,backgroundColor:'#ead1de',borderWidth:2,borderColor:'#53364a'}});
