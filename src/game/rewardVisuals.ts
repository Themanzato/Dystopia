/** Electric Hit 2 was reviewed complete and as 82x65 cells. Its third original
 * cell is a cyan nucleus with a pale ring; crop its alpha union, not the strip.
 * The static cell is an EXP texture; no invented animation or projectile edits. */
export const ORB_FX_ASSET = require('../../assets/assets/FX/Electric Hit 2.png');
export const ORB_FX_SOURCE = {x:194,y:24,width:22,height:22};
export function orbVisualScale(value:number,clockMs:number):number {
  'worklet';
  return (value>3 ? .5 : .4)*(1+Math.sin(clockMs/460)*.035);
}
