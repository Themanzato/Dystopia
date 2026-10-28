import { CONTROL_IDS, CONTROL_SCALE_LIMITS, ELEMENT_IDS, type ElementId, type ElementLayout, type ElementPlacement, type ControlId, type ControlLayout, type ControlPlacement, type ControlSettings } from './controlSettings';

export const CONTROL_NAMES: Record<ControlId, string> = { joystick: 'Joystick', attack: 'Ataque', dash: 'Dash', pause: 'Pausa' };
export const CONTROL_SIZES = { joystick: { width: 144, height: 144 }, attack: { width: 88, height: 88 }, dash: { width: 72, height: 72 }, pause: { width: 48, height: 44 } };
export type ControlArea = { left: number; top: number; width: number; height: number; insets?: ControlInsets };
export type ControlInsets = { left: number; right: number; top: number; bottom: number };
export function controlArea(width: number, height: number, insets: ControlInsets): ControlArea {
  'worklet';
  // Only physical screen bounds constrain editing. Insets guide defaults, not dragging.
  return { left:0,top:0,width:Math.max(1,width),height:Math.max(1,height),insets };
}
export function controlBox(id: ControlId, placement: ControlPlacement, area: ControlArea) {
  'worklet';
  const base = CONTROL_SIZES[id];
  const scale = Math.min(placement.scale, area.width / base.width, area.height / base.height);
  const visualWidth = base.width * scale, visualHeight = base.height * scale;
  const width = Math.min(area.width, Math.max(48, visualWidth)), height = Math.min(area.height, Math.max(48, visualHeight));
  const x = Math.max(area.left, Math.min(area.left + area.width - width, area.left + placement.x * area.width - width / 2));
  const y = Math.max(area.top, Math.min(area.top + area.height - height, area.top + placement.y * area.height - height / 2));
  return { x, y, width, height, visualWidth, visualHeight, scale };
}
function centered(id: ControlId, p: ControlPlacement, area: ControlArea): ControlPlacement {
  'worklet';
  const scale = Math.max(CONTROL_SCALE_LIMITS[id][0], Math.min(CONTROL_SCALE_LIMITS[id][1], p.scale));
  const b = controlBox(id, { ...p, scale }, area);
  return { x: (b.x + b.width / 2 - area.left) / area.width, y: (b.y + b.height / 2 - area.top) / area.height, scale };
}
export function controlsOverlap(a: ReturnType<typeof controlBox>, b: ReturnType<typeof controlBox>, gap = 8): boolean {
  'worklet';
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
/** Same constraints in the editor and runtime, including the actual touch rectangles. */
export function moveControl(layout: ControlLayout, id: ControlId, desired: ControlPlacement, area: ControlArea) {
  'worklet';
  const placement=centered(id,desired,area);
  return {layout:{...layout,[id]:placement},constrained:Math.abs(placement.x-desired.x)+Math.abs(placement.y-desired.y)>.0001||placement.scale!==desired.scale};
}

export function defaultControlLayout(settings: ControlSettings, area: ControlArea): ControlLayout {
  'worklet';
  const right = area.left + area.width - Math.max(0,(area.insets?.right??0)-16), bottom = area.top + area.height;
  const at = (x: number, y: number, scale: number): ControlPlacement => ({ x: (x - area.left) / area.width, y: (y - area.top) / area.height, scale });
  return {
    joystick: at(area.left + Math.max(20,area.insets?.left??0) + 72 * settings.stickScale, bottom - 10 - 72 * settings.stickScale - settings.lift, settings.stickScale),
    attack: at(right - 24 - (settings.swapped ? 72 + 18 + 44 : 44), bottom - 20 - 14 - 44 - settings.lift, 1),
    dash: at(right - 24 - (settings.swapped ? 36 : 88 + 18 + 36), bottom - 20 - 36 - settings.lift, 1),
    pause: at(right - 20 - 24, area.top + Math.max(10,area.insets?.top??0) + 22, 1),
  };
}
export function resolveControlLayout(settings: ControlSettings, area: ControlArea): ControlLayout {
  'worklet';
  let requested=defaultControlLayout(settings,area);
  if(settings.layout){
    // Profiles from the old editor used safe-area centers plus a 2px inset.
    const left=Math.max(0,area.insets?.left??0)+2,top=Math.max(0,area.insets?.top??0)+2;
    const width=Math.max(1,area.width-left-Math.max(0,area.insets?.right??0)-2),height=Math.max(1,area.height-top-Math.max(0,area.insets?.bottom??0)-2);
    requested={} as ControlLayout;
    for(const id of CONTROL_IDS){const p=settings.layout[id];requested[id]={...p,x:(left+p.x*width)/area.width,y:(top+p.y*height)/area.height};}
  }
  let layout = {} as ControlLayout;
  for (const id of CONTROL_IDS) layout[id] = centered(id, requested[id], area);
  for (const id of CONTROL_IDS) if(settings.elements?.[id])layout[id]=centered(id,settings.elements[id]!,area);
  return layout;
}

export const ELEMENT_NAMES:Record<ElementId,string>={...CONTROL_NAMES,frenesis:'Frenesis',vitals:'Vida y EXP',wave:'Oleada y enemigos',boss:'Vida del jefe',objectives:'Objetivos',notifications:'Avisos de misiones'};
export const ELEMENT_DESCRIPTIONS:Record<ElementId,string>={joystick:'Mueve al personaje. Su zona táctil sigue el dibujo.',attack:'Botón de ataque y giro de Frenesis.',dash:'Impulso en la dirección del personaje.',pause:'Abre la pausa de la partida.',frenesis:'Carga y activación de la ultimate.',vitals:'Vida, EXP, nivel y protección del jugador.',wave:'Oleada o encuentro, enemigos restantes y cadena de Purgatorio en un solo panel.',boss:'Nombre y barras de vida del encuentro especial.',objectives:'Captura, alarma de nave o evento opcional activo.',notifications:'Avisos breves de misiones completadas.'};
export function elementSize(id:ElementId,area:ControlArea){
  'worklet';
  if(CONTROL_IDS.includes(id as ControlId))return CONTROL_SIZES[id as ControlId];
  switch(id){
    case 'frenesis':return {width:54,height:68};
    case 'vitals':return {width:Math.max(86,Math.min(218,area.width-500)),height:96};
    case 'wave':return {width:Math.min(156,area.width*.23),height:80};
    case 'boss':return {width:Math.min(240,area.width*.33),height:62};
    case 'objectives':return {width:184,height:140};
    default:return {width:Math.min(240,area.width*.38),height:46};
  }
}
export function elementLimits(id:ElementId):readonly[number,number]{
  'worklet';return CONTROL_IDS.includes(id as ControlId)?CONTROL_SCALE_LIMITS[id as ControlId]:[.5,1.6];
}
export function elementBox(id:ElementId,p:ElementPlacement,area:ControlArea){
  'worklet';const base=elementSize(id,area),scale=Math.min(p.scale,area.width/base.width,area.height/base.height);
  const visualWidth=base.width*scale,visualHeight=base.height*scale,touch=CONTROL_IDS.includes(id as ControlId)||id==='frenesis';
  const width=Math.min(area.width,Math.max(touch?48:1,visualWidth)),height=Math.min(area.height,Math.max(touch?48:1,visualHeight));
  return {x:Math.max(area.left,Math.min(area.left+area.width-width,area.left+p.x*area.width-width/2)),y:Math.max(area.top,Math.min(area.top+area.height-height,area.top+p.y*area.height-height/2)),width,height,visualWidth,visualHeight,scale};
}
export function defaultElementLayout(settings:ControlSettings,area:ControlArea):ElementLayout{
  'worklet';const controls=defaultControlLayout(settings,area),result={} as ElementLayout;
  for(const id of CONTROL_IDS)result[id]={...controls[id],opacity:1};
  const at=(x:number,y:number,scale=1):ElementPlacement=>({x:(x-area.left)/area.width,y:(y-area.top)/area.height,scale,opacity:1});
  const left=Math.max(14,area.insets?.left??0),top=Math.max(10,area.insets?.top??0),bottom=area.height-Math.max(8,area.insets?.bottom??0);
  const vw=elementSize('vitals',area).width,group=vw+60;
  result.vitals=at((area.width-group)/2+60+vw/2,bottom-48);
  result.frenesis=at((area.width-group)/2+27,bottom-34);
  result.wave=at(left+elementSize('wave',area).width/2,top+40);
  result.boss=at(area.width/2,top+31);
  const os=Math.max(.5,Math.min(1,(area.height-210)/140));
  result.objectives=at(area.width-Math.max(22,area.insets?.right??0)-92*os,top+70+70*os,os);
  result.notifications=at(left+elementSize('notifications',area).width/2,top+120);
  return result;
}
export function resolveElementLayout(settings:ControlSettings,area:ControlArea):ElementLayout{
  'worklet';const result=defaultElementLayout(settings,area),controls=resolveControlLayout(settings,area);
  for(const id of CONTROL_IDS)result[id]={...controls[id],opacity:settings.elements?.[id]?.opacity??1};
  for(const id of ELEMENT_IDS)if(settings.elements?.[id])result[id]={...settings.elements[id]!};
  return result;
}
export function moveElement(layout:ElementLayout,id:ElementId,desired:ElementPlacement,area:ControlArea){
  'worklet';const limits=elementLimits(id),p={...desired,scale:Math.max(limits[0],Math.min(limits[1],desired.scale))},b=elementBox(id,p,area);
  return {...layout,[id]:{...p,x:(b.x+b.width/2-area.left)/area.width,y:(b.y+b.height/2-area.top)/area.height}};
}
export function elementOpacity(settings:ControlSettings,id:ElementId){
  'worklet';return (settings.elements?.[id]?.opacity??1)*(CONTROL_IDS.includes(id as ControlId)||id==='frenesis'?settings.opacity:settings.hudOpacity??1);
}
export function elementOverlaps(layout:ElementLayout,area:ControlArea){
  'worklet';const pairs:[ElementId,ElementId][]=[];
  for(let i=0;i<ELEMENT_IDS.length;i++)for(let j=i+1;j<ELEMENT_IDS.length;j++){
    const a=ELEMENT_IDS[i],b=ELEMENT_IDS[j];if(controlsOverlap(elementBox(a,layout[a],area),elementBox(b,layout[b],area),0))pairs.push([a,b]);
  }return pairs;
}
