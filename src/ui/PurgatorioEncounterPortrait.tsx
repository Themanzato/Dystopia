import React from 'react';
import { View } from 'react-native';
import { canonicalPurgatorioEnemy, BANDIT_ENCOUNTER_NAME, type SpecialEnemyId } from '../game/purgatorio';
import PurgatorioPortrait from './PurgatorioPortrait';
import { LOADING_ENTITIES } from './loadingCatalog';

/** Reuse the cached original portraits; one selectable card contains both actors. */
export default function PurgatorioEncounterPortrait({ id, width = 96, height = 68 }: { id: SpecialEnemyId; width?: number; height?: number }) {
  if (canonicalPurgatorioEnemy(id) !== 'dagger-bandit') return <PurgatorioPortrait id={id} width={width} height={height} />;
  const bodies = LOADING_ENTITIES.filter(e => e.id === 'archer-bandit' || e.id === 'dagger-bandit');
  const pixelScale = Math.min((width / 2 - 8) / Math.max(...bodies.map(e => e.bounds.width)), (height - 6) / Math.max(...bodies.map(e => e.bounds.height)));
  return <View testID="bandit-pair-preview" accessibilityLabel={BANDIT_ENCOUNTER_NAME} pointerEvents="none"
    style={{ width, height, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
    <PurgatorioPortrait id="archer-bandit" width={width / 2} height={height} pixelScale={pixelScale} />
    <PurgatorioPortrait id="dagger-bandit" width={width / 2} height={height} pixelScale={pixelScale} />
  </View>;
}
