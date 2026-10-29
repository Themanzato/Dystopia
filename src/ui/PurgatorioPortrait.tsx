import React, { useMemo } from 'react';
import { Image, PixelRatio, View } from 'react-native';
import { Skia, FilterMode, MipmapMode, rect, type SkImage } from '@shopify/react-native-skia';
import type { SpecialEnemyId } from '../game/purgatorio';
import { LOADING_ENTITIES, type LoadingEntity } from './loadingCatalog';
import { useLoadingImage } from './loadingImages';

const cache = new Map<string,string>();
function portraitRaster(image: SkImage, entity: LoadingEntity, width: number, height: number, pixelScale?: number): string | null {
  const ratio = PixelRatio.get(), pw = Math.round(width*ratio), ph = Math.round(height*ratio);
  const key = [entity.id,pw,ph,pixelScale ?? 'auto'].join(':');
  const saved = cache.get(key);
  if (saved) return saved;
  const surface = Skia.Surface.Make(pw,ph);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas(), b = entity.bounds;
    canvas.clear(Skia.Color('transparent'));
    const scale = Math.max(1,Math.floor(Math.min((pw-8*ratio)/b.width,(ph-6*ratio)/b.height,pixelScale === undefined ? Infinity : pixelScale*ratio)));
    canvas.drawImageRectOptions(image,rect(b.x,entity.row*entity.cell.height+b.y,b.width,b.height),
      rect(Math.floor((pw-b.width*scale)/2),Math.floor((ph-b.height*scale)/2),b.width*scale,b.height*scale),FilterMode.Nearest,MipmapMode.None);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const uri = 'data:image/png;base64,'+snapshot.encodeToBase64();
      cache.set(key,uri);
      if (cache.size>64) cache.delete(cache.keys().next().value!);
      return uri;
    } finally { snapshot.dispose(); }
  } finally { surface.dispose(); }
}
/** Native portraits rasterize once at physical pixel size with nearest sampling.
 * The original gallery image is shared with loading screens. No live canvas,
 * animation loop or React update per frame is allocated for a roster card. */
export default function PurgatorioPortrait({id,width=96,height=68,pixelScale,entity:providedEntity}:{id:SpecialEnemyId;width?:number;height?:number;pixelScale?:number;entity?:LoadingEntity;sheetSize?:{width:number;height:number}}) {
  const entity = providedEntity ?? LOADING_ENTITIES.find(e=>e.id===id)!;
  const {image} = useLoadingImage(entity.source);
  const uri = useMemo(()=>image?portraitRaster(image,entity,width,height,pixelScale):null,[image,entity,width,height,pixelScale]);
  return <View accessibilityLabel={entity.name} pointerEvents="none" style={{width,height}}>
    {uri&&<Image accessible={false} source={{uri}} resizeMode="contain" fadeDuration={0} style={{width,height}}/>}
  </View>;
}
