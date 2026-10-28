import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { emptyScoreArchive, insertScore, readScoreArchive, validResult, type RunResult, type ScoreArchive } from '../game/scores';
import { CREATOR_REWARD, CREATOR_SECTIONS, type CreatorSection, earnedCells, WORKSHOP_ITEMS, WORKSHOP_IDS, WORKSHOP_BALANCE, type Settlement, type WorkshopId } from '../game/workshop';
import { DIFFICULTIES, type Difficulty } from '../game/difficulty';
import { merchantOffer, type MerchantQuote } from '../game/merchantConfig';
import { advanceMissions, MISSIONS, missionStatus, pendingMissions, type MissionPulse } from '../game/missions';

export const SCORE_STORAGE_KEY = '@dystopia/scores/v1';
let archive = emptyScoreArchive(), hydrated = false;
let error: string | null = null, loading: Promise<void> | undefined;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const notify = () => listeners.forEach(fn => fn());
export const getScores = () => archive;
export function loadScores(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (loading) return loading;
  loading = AsyncStorage.getItem(SCORE_STORAGE_KEY).then(async raw => {
    const next = readScoreArchive(raw);
    // A crash between disk payment and the UI-thread effect cannot lose Celdas.
    // Runs are not restored; unfinished paid deliveries are refunded on boot.
    let recovered=false;
    for(const r of Object.values(next.economy.merchantReceipts??{}))if(r.cost>0&&!r.applied&&!r.refunded){
      const cells=next.economy.cells+r.cost;
      if(Number.isSafeInteger(cells)){next.economy.cells=cells;r.refunded=true;recovered=true;}
    }
    // A migrated refund must be durable before any screen can spend it.
    let legacy = false;
    try { legacy = Boolean(raw && JSON.parse(raw)?.version===1 && JSON.parse(raw)?.economy?.version!==2); } catch { /* Invalid saves use safe defaults. */ }
    if(legacy||recovered) await AsyncStorage.setItem(SCORE_STORAGE_KEY,JSON.stringify(next));
    archive = next; hydrated = true; error = null; notify();
  }).catch(cause => {
    loading = undefined; error = 'No se pudieron leer las puntuaciones.'; notify(); throw cause;
  });
  return loading;
}
// Serialize read/merge/write. Publish only after disk acknowledges the result;
// a failed read never overwrites an unknown archive with empty defaults.
export function saveRunResult(result: RunResult): Promise<Settlement> {
  const operation = writes.then(async () => {
    await loadScores();
    if (!validResult(result)) throw new Error('Resultado no válido.');
    if (Object.hasOwn(archive.economy.settlements, result.id)) return archive.economy.settlements[result.id];
    const earned = earnedCells(result), balance = archive.economy.cells + earned;
    if (!Number.isSafeInteger(balance)) throw new Error('Saldo fuera de rango.');
    const receipt = { earned, balance };
    const next = { ...insertScore(archive, result), missions: result.missionValues ? advanceMissions(archive.missions,{runId:result.id,values:result.missionValues,close:true}) : archive.missions, economy: { ...archive.economy, cells: balance,
      settlements: { ...archive.economy.settlements, [result.id]: receipt } } };
    // Write failures belong to the result panel's retry flow. The previously
    // persisted leaderboard remains readable if the player leaves unsaved.
    await AsyncStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
    archive = next; error = null; notify();
    return receipt;
  });
  writes = operation.then(() => {}, () => {});
  return operation;
}
type PurchaseResult = { ok: boolean; message: string };
function updateArchive<T>(change: (current: ScoreArchive) => { next: ScoreArchive; result: T }): Promise<T> {
  const operation = writes.then(async () => {
    await loadScores();
    const { next, result } = change(archive);
    if (next !== archive) {
      await AsyncStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
      archive = next; notify();
    }
    return result;
  });
  writes = operation.then(() => {}, () => {});
  return operation;
}
export function purchaseUpgrade(id: WorkshopId, oneLife = false) {
  return updateArchive<PurchaseResult>(current => {
    const wallet = current.economy;
    if (!WORKSHOP_IDS.includes(id)) return { next: current, result: { ok: false, message: 'Ventaja desconocida.' } };
    if (oneLife && id === 'field-kit') return { next:current, result:{ok:false,message:'El Botiquín no está disponible con vida única.'} };
    if (wallet.prepared.some(p=>p.id===id)) return { next:current, result:{ok:false,message:'Esta ventaja ya está preparada.'} };
    if (wallet.prepared.length >= WORKSHOP_BALANCE.slots) return { next:current, result:{ok:false,message:'Solo puedes preparar dos ventajas distintas.'} };
    const cost=WORKSHOP_ITEMS[id].cost;
    if(wallet.cells<cost)return {next:current,result:{ok:false,message:`Faltan ${cost-wallet.cells} Celdas.`}};
    return { next:{...current,economy:{...wallet,cells:wallet.cells-cost,prepared:[...wallet.prepared,{id,cost}]}}, result:{ok:true,message:'Preparada solo para la próxima partida.'} };
  });
}
export function withdrawAdvantage(id: WorkshopId) {
  return updateArchive<PurchaseResult>(current=>{
    const wallet=current.economy,item=wallet.prepared.find(p=>p.id===id);
    if(!item)return {next:current,result:{ok:false,message:'La ventaja ya no está preparada.'}};
    const cells=wallet.cells+item.cost;if(!Number.isSafeInteger(cells))throw Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...wallet,cells,prepared:wallet.prepared.filter(p=>p.id!==id)}},result:{ok:true,message:`Retirada: +${item.cost} Celdas de reembolso.`}};
  });
}
/** Disk consumption precedes mounting the simulation. The receipt guards repeated effects/callbacks. */
export function consumePreparedAdvantages(runId: string, difficulty: Difficulty): Promise<WorkshopId[]> {
  return updateArchive<WorkshopId[]>(current=>{
    const wallet=current.economy;
    if(!runId||runId.length>128)throw Error('Partida no válida.');
    if(Object.hasOwn(wallet.starts,runId))return {next:current,result:wallet.starts[runId]};
    const oneLife=DIFFICULTIES[difficulty].hp<=1;
    const rejected=wallet.prepared.filter(p=>oneLife&&p.id==='field-kit');
    const items=wallet.prepared.filter(p=>!oneLife||p.id!=='field-kit').map(p=>p.id);
    const cells=wallet.cells+rejected.reduce((sum,p)=>sum+p.cost,0);if(!Number.isSafeInteger(cells))throw Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...wallet,cells,prepared:[],starts:{...wallet.starts,[runId]:items}}},result:items};
  });
}
/** Called only after the OS has acknowledged successful external URL opening. */
export function grantCreatorVisit(section: CreatorSection) {
  return updateArchive<PurchaseResult>(current=>{
    const wallet=current.economy;
    if(!CREATOR_SECTIONS.includes(section))return {next:current,result:{ok:false,message:'Sección desconocida.'}};
    if(wallet.creatorRewards.includes(section))return {next:current,result:{ok:true,message:'Recompensa ya obtenida.'}};
    const cells=wallet.cells+CREATOR_REWARD;if(!Number.isSafeInteger(cells))throw Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...wallet,cells,creatorRewards:[...wallet.creatorRewards,section]}},result:{ok:true,message:`Primera visita: +${CREATOR_REWARD} Celdas.`}};
  });
}
export function recordMissionProgress(pulse: MissionPulse): Promise<string[]> {
  const operation = writes.then(async () => {
    await loadScores();
    const previous = archive.missions, next = advanceMissions(previous,pulse);
    if(next===previous)return [];
    const before=new Set(pendingMissions(previous).map(m=>m.id));
    const completed=pendingMissions(next).filter(m=>!before.has(m.id)).map(m=>m.id);
    const updated={...archive,missions:next};
    await AsyncStorage.setItem(SCORE_STORAGE_KEY,JSON.stringify(updated));
    archive=updated;notify();return completed;
  });
  writes=operation.then(()=>{},()=>{});return operation;
}
export function claimMission(id: string) {
  return updateArchive<PurchaseResult>(current=>{
    const mission=MISSIONS.find(m=>m.id===id);
    if(!mission||missionStatus(current.missions,mission)!=='pending')return {next:current,result:{ok:false,message:'Esta recompensa no está disponible.'}};
    const cells=current.economy.cells+mission.reward;
    if(!Number.isSafeInteger(cells))throw new Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...current.economy,cells},missions:{...current.missions,claimed:[...current.missions.claimed,id]}},result:{ok:true,message:`Recompensa reclamada: ${mission.reward} Celdas.`}};
  });
}
export function useScoreReadiness() {
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  const storageError = useSyncExternalStore(subscribe, () => error, () => null);
  useEffect(() => { void loadScores().catch(() => {}); }, []);
  return { ready, error: storageError };
}

/** Same serialized wallet as rewards/Workshop. Never bills money or plays ads. */
export function purchaseMerchant(q:MerchantQuote) {
  return updateArchive<PurchaseResult>(current=>{
    const offer=merchantOffer(q.itemId),wallet=current.economy,prior=wallet.merchantReceipts?.[q.id];
    if(!offer||!q.id||q.id.length>200)return {next:current,result:{ok:false,message:'Compra no válida.'}};
    if(prior)return {next:current,result:{ok:!prior.refunded&&prior.itemId===q.itemId,message:prior.refunded?'Compra cancelada.':'Compra registrada.'}};
    if(offer.kind==='no-ads'&&wallet.adFreePreview)return {next:current,result:{ok:false,message:'La simulación sin anuncios ya está activada.'}};
    if(wallet.cells<offer.cost)return {next:current,result:{ok:false,message:`Faltan ${offer.cost-wallet.cells} Celdas.`}};
    const cells=wallet.cells-offer.cost+offer.cells;
    if(!Number.isSafeInteger(cells))throw Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...wallet,cells,adFreePreview:wallet.adFreePreview||offer.kind==='no-ads',merchantReceipts:{...wallet.merchantReceipts,[q.id]:{itemId:q.itemId,cost:offer.cost,cells:offer.cells}}}},result:{ok:true,message:offer.cells?`+${offer.cells} Celdas. Prueba gratuita.`:offer.kind==='no-ads'?'Simulación activada. No se realizó ningún cobro.':'Mejora aplicada a esta partida.'}};
  });
}
/** A closed/unmounted run cannot keep a debit for an effect it never received. */
export function refundMerchant(id:string) {
  return updateArchive<boolean>(current=>{
    const wallet=current.economy,r=wallet.merchantReceipts?.[id];
    if(!r||r.refunded||r.applied||r.cost<=0)return {next:current,result:false};
    const cells=wallet.cells+r.cost;if(!Number.isSafeInteger(cells))throw Error('Saldo fuera de rango.');
    return {next:{...current,economy:{...wallet,cells,merchantReceipts:{...wallet.merchantReceipts,[id]:{...r,refunded:true}}}},result:true};
  });
}
export function acknowledgeMerchant(id:string) {
  return updateArchive<boolean>(current=>{
    const wallet=current.economy,r=wallet.merchantReceipts?.[id];
    if(!r||r.refunded)return {next:current,result:false};
    if(r.applied)return {next:current,result:true};
    return {next:{...current,economy:{...wallet,merchantReceipts:{...wallet.merchantReceipts,[id]:{...r,applied:true}}}},result:true};
  });
}
export function useScores() {
  const data = useSyncExternalStore(subscribe, getScores, getScores);
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  const storageError = useSyncExternalStore(subscribe, () => error, () => null);
  useEffect(() => { void loadScores().catch(() => {}); }, []);
  return { archive: data, ready, error: storageError };
}
