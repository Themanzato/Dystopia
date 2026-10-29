import React from 'react';
import { Image, Platform, View, type ImageStyle } from 'react-native';
import { LOADING_ENTITIES, type LoadingEntity } from './loadingCatalog';
import type { SpecialEnemyId } from '../game/purgatorio';

// Original PNG dimensions; the gallery already audits each cell and alpha union.
// Cropped Views reuse those sources without new bitmaps or per-card canvases.
const SHEET_SIZES: Record<SpecialEnemyId, {width:number;height:number}> = {
  'the-plague':{width:704,height:37},
  electrocutioner:{width:1884,height:107},
  "shielder": {
    "width": 774,
    "height": 46
  },
  "evil-sage": {
    "width": 832,
    "height": 294
  },
  "guardian": {
    "width": 3984,
    "height": 96
  },
  "skeleton-summoner": {
    "width": 1584,
    "height": 83
  },
  "dagger-bandit": {
    "width": 1024,
    "height": 78
  },
  "archer": {
    "width": 174,
    "height": 500
  },
  "bomb-droid": {
    "width": 32,
    "height": 192
  },
  "dagger-mush": {
    "width": 144,
    "height": 400
  },
  "shock-sweeper": {
    "width": 88,
    "height": 240
  },
  "archer-bandit": {
    "width": 680,
    "height": 112
  },
  "dust-jumper": {
    "width": 588,
    "height": 819
  },
  "rock-boss": {
    "width": 4824,
    "height": 94
  },
  "tarnished-widow": {
    "width": 3384,
    "height": 720
  }
};
export default function PurgatorioPortrait({ id, width = 96, height = 68, pixelScale,entity:providedEntity,sheetSize }: {id:SpecialEnemyId;width?:number;height?:number;pixelScale?:number;entity?:LoadingEntity;sheetSize?:{width:number;height:number}}) {
  const entity = providedEntity ?? LOADING_ENTITIES.find(e=>e.id===id)!;
  const b = entity.bounds, sheet = sheetSize ?? SHEET_SIZES[id];
  const scale = Math.min((width-8)/b.width,(height-6)/b.height,pixelScale ?? Infinity);
  const nearest = Platform.OS === 'web' ? {imageRendering:'pixelated'} as ImageStyle : undefined;
  return <View accessibilityLabel={entity.name} pointerEvents="none" style={{width,height,alignItems:'center',justifyContent:'center'}}>
    <View style={{width:b.width*scale,height:b.height*scale,overflow:'hidden'}}>
      <Image accessible={false} source={entity.source} resizeMode="stretch" fadeDuration={0}
        style={[nearest,{position:'absolute',left:-b.x*scale,top:-(entity.row*entity.cell.height+b.y)*scale,width:sheet.width*scale,height:sheet.height*scale}]}/>
    </View>
  </View>;
}
