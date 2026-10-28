export const BOSS_HIT_FLASH_MS=220;
/** Brief opacity pulse; it never changes the actor, frame crop or world anchor. */
export function bossHitOpacity(remainingMs:number):number {
  'worklet';
  if(remainingMs<=0)return 1;
  return Math.floor((BOSS_HIT_FLASH_MS-Math.min(BOSS_HIT_FLASH_MS,remainingMs))/45)%2===0 ? .38 : 1;
}
export function bossHitOffset(remainingMs:number):{x:number;y:number} {
  'worklet';
  if(remainingMs<=0)return {x:0,y:0};
  const remaining=Math.max(0,Math.min(BOSS_HIT_FLASH_MS,remainingMs)),elapsed=BOSS_HIT_FLASH_MS-remaining;
  return {x:Math.sin(elapsed/13)*2.2*remaining/BOSS_HIT_FLASH_MS,y:Math.sin(elapsed/19)*.9*remaining/BOSS_HIT_FLASH_MS};
}
