import { isWalkable } from './collision';
import type { Box, Point } from './map';

export const CHEST_PLACEMENT = { extraDistance: 34, halfWidth: 18, height: 40, spacing: 48 };
/** A milestone may open a modal in this tick: its chest must remain visible,
 * reachable and beyond the *upgraded* pickup radius when that modal closes. */
export function milestoneChestPosition(player: Point, pickupRadius: number, view: { left:number;right:number;top:number;bottom:number },
  blockers: Box[], occupied: Point[], interactionZones: {x:number;y:number;radius:number}[]): Point | null {
  'worklet';
  const c=CHEST_PLACEMENT,minDistance=pickupRadius+c.extraDistance;
  const left=view.left+c.halfWidth+8,right=view.right-c.halfWidth-8,top=view.top+c.height+8,bottom=view.bottom-8;
  if(right<left||bottom<top)return null;
  for(const distance of [minDistance,minDistance+38,minDistance+80])for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,x=player.x+Math.cos(angle)*distance,y=player.y+Math.sin(angle)*distance;
    if(x<left||x>right||y<top||y>bottom)continue;
    if(!isWalkable(x,y)||!isWalkable(x-c.halfWidth,y)||!isWalkable(x+c.halfWidth,y))continue;
    if(blockers.some(b=>x-c.halfWidth<b.x+b.width+3&&x+c.halfWidth>b.x-3&&y-c.height<b.y+b.height+3&&y>b.y-3))continue;
    if(occupied.some(p=>Math.hypot(x-p.x,y-p.y)<c.spacing)||interactionZones.some(z=>Math.hypot(x-z.x,y-z.y)<z.radius+c.halfWidth+8))continue;
    return {x,y};
  }
  return null;
}
