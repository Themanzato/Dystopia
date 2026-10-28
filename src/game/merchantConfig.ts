import type { UpgradeId } from './survival';

export const MERCHANT_CONFIG = {
  waveStep:5, lifetimeMs:30000, departureMs:600, markerMs:3000,
  retryMs:1000, interactionRadius:52, leaveRadius:78, armorCost:35, armorCap:3, healCost:50,
};
export const MERCHANT_KINDS=['traveler','gem','fruit','scavenger'] as const;
export type MerchantKind=typeof MERCHANT_KINDS[number];
export const TRAVELER_PRICES:Record<UpgradeId,number>={speed:330,dash:340,reach:360,magnet:320,vitality:450,rhythm:375};
/** Proposed MXN prices are display-only. No billing/ad SDK or money is involved. */
export const CELL_PACKS=[
  {id:'cells-150',name:'150 Celdas',cells:150,price:'MX$29.00'},
  {id:'cells-300',name:'300 Celdas',cells:300,price:'MX$49.00'},
  {id:'cells-1000',name:'1000 Celdas',cells:1000,price:'MX$129.00'},
  {id:'no-ads',name:'Eliminar anuncios',cells:0,price:'MX$79.00'},
] as const;
export type MerchantOffer={id:string;cost:number;cells:number;upgrade?:UpgradeId;kind:'upgrade'|'heal'|'armor'|'cells'|'no-ads'};
export function merchantOffer(id:string):MerchantOffer|null {
  'worklet';
  if(id==='heal')return {id,cost:MERCHANT_CONFIG.healCost,cells:0,kind:'heal'};
  if(id==='armor')return {id,cost:MERCHANT_CONFIG.armorCost,cells:0,kind:'armor'};
  if(id==='ad-preview')return {id,cost:0,cells:25,kind:'cells'};
  for(const p of CELL_PACKS)if(p.id===id)return {id,cost:0,cells:p.cells,kind:p.id==='no-ads'?'no-ads':'cells'};
  if(id.startsWith('upgrade-')){
    const upgrade=id.slice(8) as UpgradeId;
    if(Object.hasOwn(TRAVELER_PRICES,upgrade))return {id,cost:TRAVELER_PRICES[upgrade],cells:0,kind:'upgrade',upgrade};
  }
  return null;
}
export type MerchantReceipt={itemId:string;cost:number;cells:number;refunded?:boolean;applied?:boolean};
export type Merchant={id:number;kind:MerchantKind;x:number;y:number;ageMs:number;phase?:'available'|'departing';departureMs?:number;offers:string[];sold:string[];nonce:number;applied:string[]};
export type MerchantSystem={active:Merchant|null;lastMilestone:number;pendingMilestone:number|null;retryAtMs:number;randomSeed:number;serial:number;lastKind:MerchantKind|null;open:boolean;rearm:boolean};
export type MerchantQuote={id:string;merchantId:number;nonce:number;itemId:string};
