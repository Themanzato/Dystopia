export const CONTROL_IDS = ['joystick', 'attack', 'dash', 'pause'] as const;
export type ControlId = (typeof CONTROL_IDS)[number];
export const HUD_IDS = ['frenesis', 'vitals', 'wave', 'boss', 'objectives', 'notifications'] as const;
export const ELEMENT_IDS = [...CONTROL_IDS, ...HUD_IDS] as const;
export type ElementId = typeof ELEMENT_IDS[number];
export type ElementPlacement = { x:number; y:number; scale:number; opacity:number };
export type ElementLayout = Record<ElementId, ElementPlacement>;
export type ControlPlacement = { x: number; y: number; scale: number };
export type ControlLayout = Record<ControlId, ControlPlacement>;
export const CONTROL_SCALE_LIMITS = { joystick: [0.65, 1.4], attack: [0.65, 1.6], dash: [0.65, 1.6], pause: [0.8, 1.4] } as const;
export type ControlSettings = { stickScale: number; deadZone: number; opacity: number; hudOpacity: number; swapped: boolean; lift: number; layout?: ControlLayout | null; elements?: Partial<ElementLayout> | null };
export const CONTROL_SETTINGS_KEY = '@dystopia/controls/v1';
export const DEFAULT_CONTROLS: ControlSettings = { stickScale: 1, deadZone: 6, opacity: 0.86, hudOpacity: 1, swapped: false, lift: 0 };
export function validControlPatch(value: unknown): Partial<ControlSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>, result: Partial<ControlSettings> = {};
  for (const [key, min, max] of [['stickScale', 0.85, 1.15], ['deadZone', 4, 12], ['opacity', 0.15, 1], ['hudOpacity', 0.15, 1], ['lift', 0, 48]] as const) {
    if (typeof v[key] === 'number' && Number.isFinite(v[key])) result[key] = Math.max(min, Math.min(max, v[key] as number));
  }
  if (typeof v.swapped === 'boolean') result.swapped = v.swapped;
  if (v.layout === null) result.layout = null;
  else if (v.layout && typeof v.layout === 'object' && !Array.isArray(v.layout)) {
    const layout = {} as ControlLayout;let complete=true;
    for (const id of CONTROL_IDS) {
      const p = (v.layout as Record<string, unknown>)[id] as Partial<ControlPlacement> | undefined;
      if (!p || ![p.x, p.y, p.scale].every(n => typeof n === 'number' && Number.isFinite(n))) {complete=false;break;}
      layout[id] = { x: Math.max(0, Math.min(1, p.x!)), y: Math.max(0, Math.min(1, p.y!)),
        scale: Math.max(CONTROL_SCALE_LIMITS[id][0], Math.min(CONTROL_SCALE_LIMITS[id][1], p.scale!)) };
    }
    if(complete)result.layout = layout;
  }
  if(v.elements===null)result.elements=null;
  else if(v.elements&&typeof v.elements==='object'&&!Array.isArray(v.elements)){
    const elements:Partial<ElementLayout>={};
    for(const id of ELEMENT_IDS){
      const p=(v.elements as Record<string,unknown>)[id] as Partial<ElementPlacement>|undefined;
      if(!p||![p.x,p.y,p.scale,p.opacity].every(n=>typeof n==='number'&&Number.isFinite(n)))continue;
      const limits=CONTROL_IDS.includes(id as ControlId)?CONTROL_SCALE_LIMITS[id as ControlId]:[.5,1.6];
      elements[id]={x:Math.max(0,Math.min(1,p.x!)),y:Math.max(0,Math.min(1,p.y!)),scale:Math.max(limits[0],Math.min(limits[1],p.scale!)),opacity:Math.max(.15,Math.min(1,p.opacity!))};
    }
    result.elements=elements;
  }
  return result;
}
export function readControlSettings(raw: string | null): ControlSettings {
  try { return { ...DEFAULT_CONTROLS, ...validControlPatch(raw === null ? null : JSON.parse(raw)) }; }
  catch { return { ...DEFAULT_CONTROLS }; }
}
