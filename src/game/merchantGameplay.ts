import { MERCHANT_CONFIG as C, MERCHANT_KINDS, merchantOffer, type MerchantSystem, type MerchantQuote } from './merchantConfig';
import { MERCHANT_ART } from './merchantAssets';
import { UPGRADE_INFO, applyUpgrade, type SurvivalState, type UpgradeId } from './survival';
import { DIFFICULTIES } from './difficulty';
import { PROPS, ANIMATED_PROPS, type Point } from './map';
import { isWalkable } from './collision';
import { isReachable, type FlowField } from './navigation';
const BLOCKERS=[...PROPS,...ANIMATED_PROPS].filter(p=>!p.groundDetail).map(p=>p.destination);
function random(s:MerchantSystem){'worklet';s.randomSeed=(Math.imul(s.randomSeed,1664525)+1013904223)>>>0;return s.randomSeed/4294967296;}
export function createMerchants(seed:number):MerchantSystem {
  'worklet';return {active:null,lastMilestone:0,pendingMilestone:null,retryAtMs:0,randomSeed:seed^0x4d455243,serial:0,lastKind:null,open:false,rearm:false};
}
export function merchantSpawn(state:SurvivalState,system:MerchantSystem,player:Point,field:FlowField,view:NonNullable<SurvivalState['combatView']>){
  'worklet';const m=system.active;if(!m)return null;
  const art=MERCHANT_ART[m.kind],w=art.width*art.scale/2,h=art.height*art.scale;
  const radius=Math.hypot(view.right-view.left,view.bottom-view.top)/2+Math.max(w,h)+70;
  for(let n=0;n<64;n++){
    const angle=random(system)*Math.PI*2,r=radius+random(system)*180,x=player.x+Math.cos(angle)*r,y=player.y+Math.sin(angle)*r;
    const left=x-w,right=x+w,top=y-h,bottom=y+6;
    if(!(right<view.left-24||left>view.right+24||bottom<view.top-24||top>view.bottom+24))continue;
    if(!isWalkable(x,y)||!isReachable({x,y},field)||!isWalkable(left,top)||!isWalkable(right,top)||!isWalkable(left,bottom)||!isWalkable(right,bottom))continue;
    if(BLOCKERS.some(b=>left<b.x+b.width+6&&right>b.x-6&&top<b.y+b.height+6&&bottom>b.y-6))continue;
    if(state.chests.some(c=>Math.hypot(c.x-x,c.y-y)<w+65)||state.encounter.enemies.some(e=>e.active&&Math.hypot(e.x-x,e.y-y)<w+45))continue;
    return {x,y};
  }return null;
}
export function advanceMerchants(state:SurvivalState,player:Point,field:FlowField,dt:number):SurvivalState {
  'worklet';if(state.mode==='dead'||state.mode==='won')return state.merchants?{...state,merchants:{...state.merchants,active:null,pendingMilestone:null,open:false}}:state;
  if(state.purgatorio||state.mode!=='playing'||dt<=0)return state;
  const original=state.merchants??createMerchants(state.encounter.randomSeed),system={...original,active:original.active?{...original.active}:null};
  const milestone=Math.floor(state.encounter.wave/C.waveStep)*C.waveStep;
  if(milestone>system.lastMilestone){
    system.lastMilestone=milestone;
    // One pending opportunity, never a queue. An occupied shop skips a new milestone.
    if(!system.active)system.pendingMilestone=milestone;
  }
  const m=system.active;
  if(m){
    if(m.phase==='departing'){
      m.departureMs=(m.departureMs??0)+dt;
      if(m.departureMs>=C.departureMs){system.active=null;system.open=false;system.rearm=false;}
    }else{
      m.ageMs+=dt;
      if(m.ageMs>=C.lifetimeMs){
        m.departureMs=m.ageMs-C.lifetimeMs;m.ageMs=C.lifetimeMs;m.phase='departing';system.open=false;system.rearm=false;
        if(m.departureMs>=C.departureMs)system.active=null;
      }else{
        const distance=Math.hypot(player.x-m.x,player.y-m.y);
        if(distance>C.leaveRadius)system.rearm=false;
        if(distance<=C.interactionRadius&&!system.rearm&&!state.presentation){system.open=true;return {...state,merchants:system,mode:'merchant'};}
      }
    }
  }else if(system.pendingMilestone!==null&&state.clockMs>=system.retryAtMs){
    system.retryAtMs=state.clockMs+C.retryMs;
    if(!state.boss&&!state.partner&&!state.minibosses.length&&!state.pendingBoss&&!state.presentation&&!state.world.zone&&!state.world.ship&&!state.world.optional?.active&&!state.world.optional?.notice&&!state.world.pendingCaptureDamage&&!state.world.notice&&state.combatView){
      const kinds=MERCHANT_KINDS.filter(k=>k!==system.lastKind),kind=kinds[Math.floor(random(system)*kinds.length)];
      const ids=(Object.keys(UPGRADE_INFO) as UpgradeId[]).filter(id=>state.upgrades[id]<UPGRADE_INFO[id].cap&&(id!=='vitality'||state.maxHp<DIFFICULTIES[state.difficulty].maxHp));
      const offers:string[]=[];
      while(ids.length&&offers.length<2){const index=Math.floor(random(system)*ids.length);offers.push('upgrade-'+ids.splice(index,1)[0]);}
      system.active={id:system.serial+1,kind,x:0,y:0,ageMs:0,phase:'available',departureMs:0,offers:kind==='traveler'?offers:kind==='fruit'?['heal']:kind==='scavenger'?['armor']:['cells-150','cells-300','cells-1000','no-ads','ad-preview'],sold:[],nonce:0,applied:[]};
      if(kind==='traveler'&&offers.length<2)system.active=null;
      else {const position=merchantSpawn(state,system,player,field,state.combatView);if(position){Object.assign(system.active!,position);system.serial++;system.lastKind=kind;system.pendingMilestone=null;}else system.active=null;}
    }
  }
  return {...state,merchants:system};
}
export function merchantUnavailable(state:SurvivalState,itemId:string):string|null {
  'worklet';const offer=merchantOffer(itemId),m=state.merchants?.active;
  if(!offer||!m||m.phase==='departing'||m.ageMs>=C.lifetimeMs||!m.offers.includes(itemId)||m.sold.includes(itemId))return 'No disponible.';
  if(offer.upgrade&&(state.upgrades[offer.upgrade]>=UPGRADE_INFO[offer.upgrade].cap||offer.upgrade==='vitality'&&state.maxHp>=DIFFICULTIES[state.difficulty].maxHp))return 'Mejora al máximo.';
  if(offer.kind==='heal'&&state.hp>=state.maxHp)return 'Vida completa.';
  if(offer.kind==='armor'&&DIFFICULTIES[state.difficulty].hp<=1)return 'No disponible con vida única.';
  if(offer.kind==='armor'&&(state.armor??0)>=C.armorCap)return 'Armadura al máximo.';
  return null;
}
export function quoteMerchant(state:SurvivalState,itemId:string,runId:string):MerchantQuote|null {
  'worklet';const m=state.merchants?.active;
  if(state.mode!=='merchant'||!state.merchants?.open||!m||merchantUnavailable(state,itemId))return null;
  return {id:`${runId}/merchant/${m.id}/${m.nonce}`,merchantId:m.id,nonce:m.nonce,itemId};
}
export function applyMerchantPurchase(state:SurvivalState,q:MerchantQuote):{state:SurvivalState;status:'applied'|'duplicate'|'invalid'} {
  'worklet';const system=state.merchants,m=system?.active;
  if(m?.applied.includes(q.id))return {state,status:'duplicate'};
  if(state.mode!=='merchant'||!system?.open||!m||m.id!==q.merchantId||m.nonce!==q.nonce||merchantUnavailable(state,q.itemId))return {state,status:'invalid'};
  const offer=merchantOffer(q.itemId)!;
  const next={...state,upgrades:{...state.upgrades},events:{...state.events},merchants:{...system,active:{...m,sold:[...m.sold],applied:[...m.applied,q.id],nonce:m.nonce+1}}};
  if(offer.upgrade){applyUpgrade(next,offer.upgrade);next.merchants.active.sold.push(q.itemId);}
  if(offer.kind==='heal')next.hp=Math.min(next.maxHp,next.hp+1);
  if(offer.kind==='armor')next.armor=(next.armor??0)+1;
  if(offer.kind==='no-ads')next.merchants.active.sold.push(q.itemId);
  next.events.chest++;
  return {state:next,status:'applied'};
}
export function closeMerchant(state:SurvivalState):SurvivalState {
  'worklet';if(state.mode!=='merchant')return state;
  return {...state,mode:'playing',merchants:state.merchants?{...state.merchants,open:false,rearm:true}:undefined};
}
