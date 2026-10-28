import type { RunResult } from './scores';
import { DIFFICULTIES, type Difficulty } from './difficulty';
import type { MerchantReceipt } from './merchantConfig';
export const WORKSHOP_IDS = ['field-kit', 'attack-servo', 'assault-boots', 'frenesis-coil'] as const;
export type WorkshopId = typeof WORKSHOP_IDS[number];
export const WORKSHOP_ITEMS = {
  'field-kit': { name: 'Botiquín de campaña', cost: 150, effect: '+1 de vida inicial', icon: 'vitality' as const },
  'attack-servo': { name: 'Servo de ataque', cost: 125, effect: '+8% de velocidad de ataque', icon: 'rhythm' as const },
  'assault-boots': { name: 'Botas de asalto', cost: 110, effect: '+8% de movimiento', icon: 'speed' as const },
  'frenesis-coil': { name: 'Bobina de Frenesis', cost: 100, effect: 'Carga inicial de Frenesis: 15%', icon: 'frenesis' as const },
};
export const WORKSHOP_BALANCE = { slots: 2, health: 1, speed: .08, attack: .08, charge: 15 };
export const CELL_BALANCE = { scoreDivisor: 1000, wave: 3, miniboss: 8, boss: 15, event: 5,
  difficulty: { easy: 1, hard: 1.25, dystopia: 1.5 } };
export type Settlement = { earned: number; balance: number };
export const CREATOR_REWARD = 200;
export const CREATOR_SECTIONS = ['support', 'about'] as const;
export type CreatorSection = typeof CREATOR_SECTIONS[number];
export type PreparedAdvantage = { id: WorkshopId; cost: number };
export type WorkshopWallet = { version: 2; cells: number; prepared: PreparedAdvantage[]; starts: Record<string, WorkshopId[]>; creatorRewards: CreatorSection[]; settlements: Record<string, Settlement>; merchantReceipts?:Record<string,MerchantReceipt>; adFreePreview?:boolean };
export function emptyWallet(): WorkshopWallet { return { version: 2, cells: 0, prepared: [], starts: Object.create(null), creatorRewards: [], settlements: Object.create(null),merchantReceipts:Object.create(null),adFreePreview:false }; }
export function normalizeEquipment(ids: readonly unknown[]): WorkshopId[] {
  'worklet';
  const selected: WorkshopId[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && WORKSHOP_IDS.includes(id as WorkshopId) && !selected.includes(id as WorkshopId)) selected.push(id as WorkshopId);
    if (selected.length === WORKSHOP_BALANCE.slots) break;
  }
  return selected;
}
export function workshopBonuses(ids: readonly WorkshopId[], difficulty: Difficulty) {
  'worklet';
  const equipped = normalizeEquipment(ids);
  return { health: DIFFICULTIES[difficulty].hp > 1 && equipped.includes('field-kit') ? WORKSHOP_BALANCE.health : 0,
    speed: equipped.includes('assault-boots') ? WORKSHOP_BALANCE.speed : 0,
    attack: equipped.includes('attack-servo') ? WORKSHOP_BALANCE.attack : 0,
    charge: equipped.includes('frenesis-coil') ? WORKSHOP_BALANCE.charge : 0 };
}
export function earnedCells(result: RunResult): number {
  const s = result.stats;
  const base = Math.floor(result.score / CELL_BALANCE.scoreDivisor) + s.wavesCleared * CELL_BALANCE.wave
    + s.minibossKills * CELL_BALANCE.miniboss + s.bossKills * CELL_BALANCE.boss + s.objectivesCompleted * CELL_BALANCE.event;
  return Math.floor(base * CELL_BALANCE.difficulty[result.difficulty]);
}
const safeMoney = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
export function readWallet(raw: unknown): WorkshopWallet {
  if (!raw || typeof raw !== 'object') return emptyWallet();
  const data = raw as WorkshopWallet & { unlocked?: unknown[] };
  let cells = safeMoney(data.cells) ? data.cells : 0;
  const prepared: PreparedAdvantage[] = [];
  // Retire permanent unlocks without destroying their original purchase value.
  if (data.version !== 2) {
    const legacyCosts = { 'field-kit': 100, 'attack-servo': 80, 'assault-boots': 80, 'frenesis-coil': 90 };
    for (const id of WORKSHOP_IDS) if (Array.isArray(data.unlocked) && data.unlocked.includes(id)) cells += legacyCosts[id];
  } else if (Array.isArray(data.prepared)) for (const item of data.prepared) {
    if (item && WORKSHOP_IDS.includes(item.id) && safeMoney(item.cost) && item.cost > 0 && !prepared.some(p=>p.id===item.id) && prepared.length < WORKSHOP_BALANCE.slots) prepared.push({ id:item.id, cost:item.cost });
  }
  const starts: Record<string, WorkshopId[]> = Object.create(null);
  if(data.starts && typeof data.starts==='object') for(const [id,items] of Object.entries(data.starts)) if(id.length>0 && id.length<=128 && Array.isArray(items)) starts[id]=normalizeEquipment(items);
  const creatorRewards = CREATOR_SECTIONS.filter(id=>Array.isArray(data.creatorRewards)&&data.creatorRewards.includes(id));
  const settlements: Record<string, Settlement> = Object.create(null);
  if (data.settlements && typeof data.settlements === 'object') for (const [id, receipt] of Object.entries(data.settlements)) {
    if (id.length > 0 && id.length <= 128 && receipt && safeMoney(receipt.earned) && safeMoney(receipt.balance)) settlements[id] = { earned: receipt.earned, balance: receipt.balance };
  }
  const merchantReceipts:Record<string,MerchantReceipt>=Object.create(null);
  if(data.merchantReceipts&&typeof data.merchantReceipts==='object')for(const [id,r]of Object.entries(data.merchantReceipts)){
    if(id.length>0&&id.length<=200&&r&&typeof r.itemId==='string'&&r.itemId.length<64&&safeMoney(r.cost)&&safeMoney(r.cells))merchantReceipts[id]={itemId:r.itemId,cost:r.cost,cells:r.cells,refunded:r.refunded===true,applied:r.applied===true};
  }
  return { version:2, cells: safeMoney(cells)?cells:0, prepared, starts, creatorRewards, settlements,merchantReceipts,adFreePreview:data.adFreePreview===true };
}
