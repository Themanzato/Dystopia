import { ORB_FX_ASSET, ORB_FX_SOURCE, orbVisualScale } from './rewardVisuals';
import { useSharedImage } from '../ui/sharedImages';
import { REWARD_ICON_SOURCES, rewardIconId, type RewardIconId } from '../ui/rewardIcons';
import { BossEffects } from './BossCombatEffects';
import React from 'react';
import { Atlas, FilterMode, Group, MipmapMode, Skia, rect } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { PIXEL_FONT_SOURCE } from '../ui/pixelFontAsset';
import { PIXEL_GLYPHS } from '../ui/pixelGlyphs';
import { CHEST_ASSET, chestFrame } from './survivalAssets';
import { SURVIVAL_CONFIG, type SurvivalState } from './survival';
import type { PlayerState } from './player';

const sampling = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };
/** Bounded world-space atlases: six chests and at most 480 reward glyphs.
 * No React updates, projectile nodes, or sprite allocations per entity render. */
function RewardIconAtlas({id,survival}:{id:RewardIconId;survival:SharedValue<SurvivalState>}){
  const image=useSharedImage(REWARD_ICON_SOURCES[id]);
  const rewards=useDerivedValue(()=>survival.value.chests.filter(c=>c.phase==='reward'&&c.rewardId&&rewardIconId(c.rewardId)===id));
  const sprites=useDerivedValue(()=>rewards.value.map(()=>rect(0,0,32,32)));
  const transforms=useDerivedValue(()=>rewards.value.map(c=>Skia.RSXform(.5,0,c.x-8,c.y-94-Math.min(12,(c.phaseMs??0)/100))));
  const colors=useDerivedValue(()=>rewards.value.map(c=>Skia.Color('rgba(255,255,255,'+Math.min(1,Math.max(0,(SURVIVAL_CONFIG.chestRewardMs-(c.phaseMs??0))/400))+')')));
  return image?<Atlas image={image} sprites={sprites} transforms={transforms} colors={colors} colorBlendMode="modulate" sampling={sampling}/>:null;
}
export function BattleEffects({ survival, player, onError }: {
  survival: SharedValue<SurvivalState>; player: SharedValue<PlayerState>; onError?: (error: Error) => void;
}) {
  const chest = useSharedImage(CHEST_ASSET, onError);
  const font = useSharedImage(PIXEL_FONT_SOURCE, onError);
  const orbImage=useSharedImage(ORB_FX_ASSET,onError);
  const orbCount=useDerivedValue(()=>survival.value.orbs.length);
  const orbSprites=useDerivedValue(()=>Array.from({length:orbCount.value},()=>rect(ORB_FX_SOURCE.x,ORB_FX_SOURCE.y,ORB_FX_SOURCE.width,ORB_FX_SOURCE.height)));
  const orbTransforms=useDerivedValue(()=>{
    const state=survival.value,pulse=orbVisualScale(1,state.clockMs);
    return state.orbs.map(orb=>{
      const scale=orb.value>3?pulse*1.25:pulse;
      return Skia.RSXform(scale,0,orb.x-ORB_FX_SOURCE.width*scale/2,orb.y-ORB_FX_SOURCE.height*scale/2);
    });
  });
  const sprites = useDerivedValue(() => survival.value.chests.map(c => {
    const source = chestFrame(c.phase, c.phaseMs, SURVIVAL_CONFIG.chestOpeningMs);
    return rect(source.x, source.y, source.width, source.height);
  }));
  const chestTransforms = useDerivedValue(() => survival.value.chests.map(c => Skia.RSXform(1.5, 0, c.x - 16.5, c.y - 36)));
  const chestColors = useDerivedValue(() => survival.value.chests.map(c => {
    const alpha = c.phase === 'reward' ? Math.min(1, Math.max(0, (SURVIVAL_CONFIG.chestRewardMs - (c.phaseMs ?? 0)) / 350)) : 1;
    return Skia.Color('rgba(255,255,255,' + alpha + ')');
  }));
  // This primitive key changes on rewards, not on every clock tick. Glyph
  // crops/centering are calculated only when the actual reward text changes.
  const labelKey = useDerivedValue(() => JSON.stringify(survival.value.chests.map(c => ({
    id:c.id, name:c.phase==='reward'?(c.rewardName??c.rewardText??''):'', effect:c.phase==='reward'?(c.rewardEffect??''):'',
  }))));
  const glyphs = useDerivedValue(() => {
    const labels=JSON.parse(labelKey.value) as {id:number;name:string;effect:string}[];
    const result:{id:number;x:number;line:number;source:{x:number;y:number;width:number;height:number}}[]=[];
    for(const label of labels)for(const [line,text] of [label.name,label.effect].entries()){
      const chars=Array.from(text.toUpperCase().slice(0,40));
      let width=0;
      for(const character of chars)width+=(PIXEL_GLYPHS[character as keyof typeof PIXEL_GLYPHS]??PIXEL_GLYPHS['?']).width+2;
      let x=-Math.max(0,width-2)*.65/2;
      for(const character of chars){
        const source=PIXEL_GLYPHS[character as keyof typeof PIXEL_GLYPHS]??PIXEL_GLYPHS['?'];
        if(character!==' ')result.push({id:label.id,x,line,source});x+=(source.width+2)*.65;
      }
    }
    return result;
  });
  const letterSprites = useDerivedValue(() => glyphs.value.map(g => rect(g.source.x, g.source.y, g.source.width, g.source.height)));
  const letterTransforms = useDerivedValue(() => glyphs.value.map(g => {
    const c = survival.value.chests.find(c => c.id === g.id);
    const rise = Math.min(12, (c?.phaseMs ?? 0) / 100);
    return c ? Skia.RSXform(.65, 0, c.x + g.x, c.y - 76 + g.line*16 - rise) : Skia.RSXform(0, 0, 0, 0);
  }));
  const letterColors = useDerivedValue(() => glyphs.value.map(g => {
    const c = survival.value.chests.find(c => c.id === g.id);
    const alpha = c ? Math.min(1, Math.max(0, (SURVIVAL_CONFIG.chestRewardMs - (c.phaseMs ?? 0)) / 400)) : 0;
    return Skia.Color((g.line?'rgba(167,226,210,':'rgba(243,223,167,')+alpha+')');
  }));
  const shadowColors = useDerivedValue(() => glyphs.value.map(g => {
    const c = survival.value.chests.find(c => c.id === g.id);
    const alpha = c ? Math.min(1, Math.max(0, (SURVIVAL_CONFIG.chestRewardMs - (c.phaseMs ?? 0)) / 400)) : 0;
    return Skia.Color('rgba(0,0,0,' + alpha + ')');
  }));
  return <Group>
    {orbImage&&<Atlas image={orbImage} sprites={orbSprites} transforms={orbTransforms} sampling={sampling}/>}
    <BossEffects survival={survival} player={player} onError={onError} />
    {chest && <Atlas image={chest} sprites={sprites} transforms={chestTransforms} colors={chestColors} colorBlendMode="modulate" sampling={sampling} />}
    {(Object.keys(REWARD_ICON_SOURCES) as RewardIconId[]).map(id=><RewardIconAtlas key={id} id={id} survival={survival}/>)}
    {font && <Group>
      <Group transform={[{ translateX: 1.5 }, { translateY: 1.5 }]}><Atlas image={font} sprites={letterSprites} transforms={letterTransforms} colors={shadowColors} colorBlendMode="modulate" sampling={sampling} /></Group>
      <Atlas image={font} sprites={letterSprites} transforms={letterTransforms} colors={letterColors} colorBlendMode="modulate" sampling={sampling} />
    </Group>}
  </Group>;
}