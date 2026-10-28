/** Immutable, seeded shuffle bags. Peeking prepares a round, never consumes it. */
export type Rotation<T extends string>={remaining:T[];last:T|null;seed:number;round:number};
export function createRotation<T extends string>(seed:number):Rotation<T>{
  'worklet';return {remaining:[],last:null,seed:seed>>>0,round:0};
}
export function peekRotation<T extends string>(rotation:Rotation<T>,pool:readonly T[]):{rotation:Rotation<T>;id:T|undefined}{
  'worklet';
  const valid=rotation.remaining.filter(id=>pool.includes(id));
  if(valid.length)return {rotation:valid.length===rotation.remaining.length?rotation:{...rotation,remaining:valid},id:valid[0]};
  const remaining=[...pool];let seed=rotation.seed;
  for(let i=remaining.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));const swap=remaining[i];remaining[i]=remaining[j];remaining[j]=swap;}
  if(remaining.length>1&&remaining[0]===rotation.last){const swap=remaining[0];remaining[0]=remaining[1];remaining[1]=swap;}
  return {rotation:{...rotation,remaining,seed,round:rotation.round+1},id:remaining[0]};
}
export function consumeRotation<T extends string>(rotation:Rotation<T>,id:T):Rotation<T>{
  'worklet';return rotation.remaining[0]===id?{...rotation,remaining:rotation.remaining.slice(1),last:id}:rotation;
}
