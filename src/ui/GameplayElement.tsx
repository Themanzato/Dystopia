import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useControlSettings } from './ControlPreferences';
import { controlArea, elementBox, elementSize, resolveElementLayout } from './controlLayout';
import type { ElementId } from './controlSettings';

/** Geometry and hit target shared with the editor. Global HUD opacity stays on GameUIOpacity. */
export default function GameplayElement({ id, children, gesture, viewport }: { id:ElementId; children:React.ReactNode; gesture?:GestureType; viewport?:{width:number;height:number} }){
  const window=useWindowDimensions(),insets=useSafeAreaInsets(),{settings}=useControlSettings();
  const area=controlArea(viewport?.width??window.width,viewport?.height??window.height,insets),p=resolveElementLayout(settings,area)[id],box=elementBox(id,p,area),base=elementSize(id,area);
  const content=<View testID={`game-element-${id}`} collapsable={false} pointerEvents={gesture?'auto':'box-none'} style={{position:'absolute',left:box.x,top:box.y,width:box.width,height:box.height}}>
    <View pointerEvents={gesture?'none':'box-none'} style={{position:'absolute',left:(box.width-base.width)/2,top:(box.height-base.height)/2,width:base.width,height:base.height,transform:[{scale:box.scale}],opacity:p.opacity*(id==='frenesis'?settings.opacity:1)}}>{children}</View>
  </View>;
  return gesture?<GestureDetector gesture={gesture} touchAction="none" userSelect="none">{content}</GestureDetector>:content;
}
