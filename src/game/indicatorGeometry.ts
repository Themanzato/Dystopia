export type ScreenBox={x:number;y:number;width:number;height:number};
export type CameraTransform=({translateX:number}|{translateY:number}|{scale:number})[];
export function projectWorld(p:{x:number;y:number},transforms:CameraTransform){
  'worklet';let x=0,y=0,scale=1;for(const t of transforms){if('translateX'in t)x=t.translateX;else if('translateY'in t)y=t.translateY;else scale=t.scale;}
  return {x:x+p.x*scale,y:y+p.y*scale,scale};
}
export function boxesMeet(a:ScreenBox,b:ScreenBox,pad=0){'worklet';return a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;}
export function captureArrowVisible(player:{x:number;y:number},zone:{x:number;y:number;radius:number}){
  'worklet';return Math.hypot(player.x-zone.x,player.y-zone.y)>zone.radius+28;
}
export function edgeIndicator(target:{x:number;y:number},width:number,height:number,blocked:ScreenBox[],top=16,bottom=16){
  'worklet';
  const margin=20,cx=width/2,cy=height/2,dx=target.x-cx,dy=target.y-cy;
  const t=Math.min((cx-margin)/Math.max(.001,Math.abs(dx)),(cy-Math.max(top,bottom))/Math.max(.001,Math.abs(dy)));
  const wanted={x:cx+dx*t,y:cy+dy*t},candidates:{x:number;y:number}[]=[wanted];
  for(let x=margin;x<=width-margin;x+=20){candidates.push({x,y:top},{x,y:height-bottom});}
  for(let y=top;y<=height-bottom;y+=20){candidates.push({x:margin,y},{x:width-margin,y});}
  let best:{x:number;y:number;angle:number}|null=null,score=Infinity;
  for(const p of candidates){
    if(p.x<margin||p.x>width-margin||p.y<top||p.y>height-bottom||blocked.some(b=>boxesMeet({x:p.x-16,y:p.y-32,width:32,height:48},b,5)))continue;
    const distance=Math.hypot(p.x-wanted.x,p.y-wanted.y);
    if(distance<score){score=distance;best={...p,angle:Math.atan2(target.y-p.y,target.x-p.x)};}
  }
  return best;
}
