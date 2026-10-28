import { MERCHANT_CONFIG, type Merchant, type MerchantKind } from './merchantConfig';
export const MERCHANT_SOURCES=[
  require('../../assets/assets/merchants/Traveler merchant/01 Traveler Merchant-Idle Blue.png'),
  require('../../assets/assets/merchants/Gem Merchant/Gem Merchant.png'),
  require('../../assets/assets/merchants/Fruit merchant/03 Fruit Merchant-Red.png'),
  require('../../assets/assets/merchants/Merchant 1 - Scavenger Merchant/Merchant 1 - Scavenger Merchant 199x106.png'),
];
/** Visually audited complete cells; Gem's 12 frames run vertically. */
export const MERCHANT_ART={
  traveler:{image:0,width:24,height:32,frames:10,vertical:false,fps:8,scale:1.6,pivotX:12,pivotY:31},
  gem:{image:1,width:101,height:37,frames:12,vertical:true,fps:8,scale:1.35,pivotX:50,pivotY:36},
  fruit:{image:2,width:46,height:38,frames:12,vertical:false,fps:8,scale:1.5,pivotX:23,pivotY:36},
  scavenger:{image:3,width:199,height:106,frames:12,vertical:false,fps:8,scale:1.15,pivotX:99,pivotY:104},
};
export function merchantFrame(kind:MerchantKind,ageMs:number){
  'worklet';const art=MERCHANT_ART[kind],n=Math.floor(ageMs*art.fps/1000)%art.frames;
  return {x:art.vertical?0:n*art.width,y:art.vertical?n*art.height:0,width:art.width,height:art.height};
}

/** A stepped pixel dissolve. Cropping and pivot move together, keeping the feet fixed. */
export function merchantVisual(merchant:Merchant){
  'worklet';const art=MERCHANT_ART[merchant.kind],source=merchantFrame(merchant.kind,merchant.ageMs);
  const progress=merchant.phase==='departing'?Math.min(1,(merchant.departureMs??0)/MERCHANT_CONFIG.departureMs):0;
  const cut=Math.min(art.height-1,Math.floor(art.height*progress/4)*4);
  return {source:{...source,y:source.y+cut,height:source.height-cut},pivotY:art.pivotY-cut,
    opacity:(1-progress)*(Math.floor(progress*12)%2?0.45:1)};
}
