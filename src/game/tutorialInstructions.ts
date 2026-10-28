import type { ElementId, ControlSettings } from '../ui/controlSettings';
import { CONTROL_IDS } from '../ui/controlSettings';
import { elementBox, resolveElementLayout, type ControlArea } from '../ui/controlLayout';
import { layoutPixelText } from '../ui/pixelTextLayout';

export const TUTORIAL_STEPS = ['move','dummy','wave','dash','hud','charge','activate','transform','teleport','spin','finish'] as const;
export type TutorialStep = typeof TUTORIAL_STEPS[number];
export const TUTORIAL_INSTRUCTIONS: Record<TutorialStep, { text: string; highlights: readonly ElementId[]; continue: boolean }> = {
  move: { text: 'Mueve el joystick para desplazarte.', highlights: ['joystick'], continue: false },
  dummy: { text: 'Acércate al maniquí y usa ATACAR.', highlights: ['attack'], continue: false },
  wave: { text: 'Ahora derrota a los enemigos usando tus ataques.', highlights: ['attack'], continue: false },
  dash: { text: 'Usa DASH para impulsarte y esquivar.', highlights: ['dash'], continue: false },
  hud: { text: 'Vigila tu vida y los enemigos restantes.', highlights: ['vitals','wave'], continue: true },
  charge: { text: 'Frenesis se carga al hacer daño y derrotar enemigos, no al recoger EXP.', highlights: ['frenesis'], continue: true },
  activate: { text: 'Activa Frenesis cuando esté lista.', highlights: ['frenesis'], continue: false },
  transform: { text: 'Ahora eres Glitch Samurai. La vida temporal protege tu vida normal.', highlights: ['vitals'], continue: true },
  teleport: { text: 'Toca un punto libre del mapa para teletransportarte.', highlights: [], continue: false },
  spin: { text: 'Mantén ATACAR para girar y dañar a los enemigos cercanos.', highlights: ['attack'], continue: false },
  finish: { text: 'Entrenamiento completado', highlights: [], continue: false },
};
export function tutorialStep(value: unknown): TutorialStep | null {
  'worklet';
  return typeof value === 'string' && (TUTORIAL_STEPS as readonly string[]).includes(value) ? value as TutorialStep : null;
}
export type TutorialPanelBox = { x:number; y:number; width:number; height:number; textSize:number };
export type TutorialBox = { x:number; y:number; width:number; height:number };
const overlap = (a:TutorialBox,b:TutorialBox) => Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)) * Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
/** Place the brief card in free space around the actual configured hit targets.
 * The center is reserved for the followed player. The card itself is transparent
 * to touches; only its small explicit actions receive input. */
export function tutorialPanelBox(step:TutorialStep, settings:ControlSettings, area:ControlArea):TutorialPanelBox {
  const layout=resolveElementLayout(settings,area);
  const ids:ElementId[]=[...CONTROL_IDS,'frenesis','vitals','wave'];
  const blocked:TutorialBox[]=ids.map(id=>{const b=elementBox(id,layout[id],area);return {x:b.x-5,y:b.y-5,width:b.width+10,height:b.height+10};});
  blocked.push({x:area.width/2-52,y:area.height/2-52,width:104,height:104});
  const text=TUTORIAL_INSTRUCTIONS[step].text,margin=8;
  const textSize=area.width<700?10:12;
  const widths=[Math.min(340,area.width*.52),Math.min(280,area.width-16),Math.min(220,area.width-16)];
  let best:TutorialPanelBox|null=null,bestScore=Infinity;
  for(const width of widths){
    const textHeight=layoutPixelText(text,textSize,width-24).height;
    const height=Math.min(area.height-16,Math.max(70,Math.ceil(textHeight)+62));
    const xs=[(area.width-width)/2,margin,area.width-width-margin,...blocked.flatMap(b=>[b.x+b.width+8,b.x-width-8])];
    const ys=[Math.max(margin,area.insets?.top??0),area.height-height-Math.max(margin,area.insets?.bottom??0),...blocked.flatMap(b=>[b.y+b.height+8,b.y-height-8])];
    for(const rawY of ys)for(const rawX of xs){
      const x=Math.max(margin,Math.min(area.width-width-margin,rawX)),y=Math.max(margin,Math.min(area.height-height-margin,rawY));
      const candidate={x,y,width,height,textSize};
      const coverage=blocked.reduce((sum,b)=>sum+overlap(candidate,b),0);
      // Prefer a stable top card and the widest legible candidate when space is free.
      const score=coverage*10000+y*.2+Math.abs(x+width/2-area.width/2)*.02+(340-width)*.1;
      if(score<bestScore){best=candidate;bestScore=score;}
    }
  }
  return best!;
}


/** Candidate tap points in the real gameplay viewport, not world coordinates.
 * The caller converts through the current camera, then validates world collision
 * and enemy clearance. No candidate sits under a configured control or card. */
export function tutorialMapTargets(area:ControlArea,settings:ControlSettings):{x:number;y:number}[]{
  const layout=resolveElementLayout(settings,area),padding=18;
  const ids:ElementId[]=[...CONTROL_IDS,'frenesis','vitals','wave'];
  const blocked:TutorialBox[]=ids.map(id=>{const b=elementBox(id,layout[id],area);return {x:b.x-padding,y:b.y-padding,width:b.width+padding*2,height:b.height+padding*2};});
  const card=tutorialPanelBox('teleport',settings,area);
  blocked.push({x:card.x-10,y:card.y-10,width:card.width+20,height:card.height+20});
  const center={x:area.left+area.width/2,y:area.top+area.height/2};
  const left=area.left+Math.max(20,area.insets?.left??0),right=area.left+area.width-Math.max(20,area.insets?.right??0);
  const top=area.top+Math.max(26,(area.insets?.top??0)+12),bottom=area.top+area.height-Math.max(20,area.insets?.bottom??0);
  const angles=[0,Math.PI,-Math.PI/2,Math.PI/2,Math.PI/4,3*Math.PI/4,-Math.PI/4,-3*Math.PI/4,
    Math.PI/8,7*Math.PI/8,3*Math.PI/8,5*Math.PI/8,-Math.PI/8,-7*Math.PI/8,-3*Math.PI/8,-5*Math.PI/8];
  const candidates:{x:number;y:number}[]=[];
  for(const radius of [64,88,112,136])for(const angle of angles){
    const point={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
    if(point.x<left||point.x>right||point.y<top||point.y>bottom)continue;
    if(blocked.some(b=>point.x>=b.x&&point.x<=b.x+b.width&&point.y>=b.y&&point.y<=b.y+b.height))continue;
    if(candidates.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<24))continue;
    candidates.push(point);if(candidates.length===16)return candidates;
  }
  // A physically saturated user layout may leave fewer than four valid points;
  // never invent an unsafe tap target merely to fill the list.
  return candidates;
}
