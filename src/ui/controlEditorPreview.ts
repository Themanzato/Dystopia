import { elementOverlaps, resolveElementLayout, type ControlArea } from './controlLayout';
import type { ControlSettings } from './controlSettings';
/** Uniform fit: preview pixels never become saved world/UI coordinates. */
export function fitControlPreview(viewport:{width:number;height:number},available:{width:number;height:number}){
  const scale=Math.max(0,Math.min(1,Math.max(0,available.width)/Math.max(1,viewport.width),Math.max(0,available.height)/Math.max(1,viewport.height)));
  return {width:viewport.width*scale,height:viewport.height*scale,scale};
}
/** Preserve both members of a deliberate overlap when committing a draft. */
export function controlDraftForSave(settings:ControlSettings,area:ControlArea):ControlSettings{
  const layout=resolveElementLayout(settings,area),pairs=elementOverlaps(layout,area);
  if(!pairs.length)return settings;
  const elements={...settings.elements};for(const pair of pairs)for(const id of pair)elements[id]=layout[id];
  return {...settings,elements};
}
