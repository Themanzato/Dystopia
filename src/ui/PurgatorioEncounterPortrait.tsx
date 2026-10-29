import React from 'react';
import { View } from 'react-native';
import { canonicalPurgatorioEnemy, BANDIT_ENCOUNTER_NAME, type SpecialEnemyId } from '../game/purgatorio';
import PurgatorioPortrait from './PurgatorioPortrait';
import { LOADING_ENTITIES } from './loadingCatalog';
import { PLAGUE_PORTRAITS } from './plaguePortraits';

/** Reuse the cached original portraits; one selectable card contains both actors. */
export default function PurgatorioEncounterPortrait({ id, width = 96, height = 68 }: { id: SpecialEnemyId; width?: number; height?: number }) {
  if (id === 'the-plague') {
    const slotWidth=width/2,slotHeight=height/2;
    const pixelScale=Math.min((slotWidth-8)/25,(slotHeight-6)/30);
    return <View testID="plague-swarm-preview" accessibilityLabel="THE PLAGUE" pointerEvents="none" style={{width,height,flexDirection:'row',flexWrap:'wrap'}}>
      {[PLAGUE_PORTRAITS[3],PLAGUE_PORTRAITS[2],PLAGUE_PORTRAITS[0],PLAGUE_PORTRAITS[1]].map(entity=><PurgatorioPortrait key={entity.id} id="the-plague" entity={entity} sheetSize={entity.sheetSize} width={slotWidth} height={slotHeight} pixelScale={pixelScale}/>)}
    </View>;
  }
  if (canonicalPurgatorioEnemy(id) !== 'dagger-bandit') return <PurgatorioPortrait id={id} width={width} height={height} />;
  const bodies = LOADING_ENTITIES.filter(e => e.id === 'archer-bandit' || e.id === 'dagger-bandit');
  const pixelScale = Math.min((width / 2 - 8) / Math.max(...bodies.map(e => e.bounds.width)), (height - 6) / Math.max(...bodies.map(e => e.bounds.height)));
  return <View testID="bandit-pair-preview" accessibilityLabel={BANDIT_ENCOUNTER_NAME} pointerEvents="none"
    style={{ width, height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <PurgatorioPortrait id="archer-bandit" width={width / 2} height={height} pixelScale={pixelScale} />
    <PurgatorioPortrait id="dagger-bandit" width={width / 2} height={height} pixelScale={pixelScale} />
  </View>;
}
