import { ENEMY_DEFS } from '../game/enemyCatalog';
import { CHEST_ASSET } from '../game/survivalAssets';
import { BANDIT_ENCOUNTER_NAME } from '../game/purgatorio';
import { ORB_FX_ASSET } from '../game/rewardVisuals';
import { REWARD_ICON_ASSETS } from './rewardIcons';
import { prepareControlArt } from './ControlArt';
import { preparePixelLabels } from './PixelText';
import { loadSharedImage } from './sharedImages';

/** Names use the same raster cache/layout as the real boss HUD and introduction. */
const prepared=new Map<string,Promise<void>>();
export function prepareGameInterface(width:number,height:number):Promise<void> {
  const key=width+'x'+height,existing=prepared.get(key);if(existing)return existing;
  const request=prepare(width).catch(error=>{prepared.delete(key);throw error;});prepared.set(key,request);return request;
}
async function prepare(width:number):Promise<void> {
  const bossWidth=Math.min(240,width*.33);
  const names=[...new Set([...Object.values(ENEMY_DEFS).map(e=>e.name),BANDIT_ENCOUNTER_NAME])];
  const labels=names.flatMap(text=>[
    {text,size:14,maxWidth:bossWidth,align:'center' as const},
    {text,size:width<740?25:32,maxWidth:width*.4,align:'left' as const},
  ]);
  await Promise.all([preparePixelLabels(labels),prepareControlArt(),loadSharedImage(CHEST_ASSET),loadSharedImage(ORB_FX_ASSET),
    Promise.allSettled(REWARD_ICON_ASSETS.map(source=>loadSharedImage(source))).then(results=>{for(const result of results)if(result.status==='rejected')console.warn('Dystopia: icono opcional no disponible; se conserva el nombre de la recompensa.',result.reason);})]);
}
