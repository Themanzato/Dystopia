import type { SurvivalState, UpgradeId } from './survival';
import { workshopBonuses } from './workshop';
import { DIFFICULTIES } from './difficulty';
import { UPGRADE_EFFECTS } from './upgradeBalance';
import { FRENESIS } from './frenesis';
export type Powerup = { id: UpgradeId | 'frenesis' | 'armor'; name: string; value: string; detail?: string; stacks: number; remainingSeconds?: number };
export function activePowerups(state: SurvivalState): Powerup[] {
  'worklet';
  const initial = workshopBonuses(state.startingEquipment ?? [], state.difficulty);
  const u = state.upgrades, result: Powerup[] = [];
  if((state.armor??0)>0)result.push({id:'armor',name:'Armadura',value:`+${state.armor} PA`,stacks:state.armor!});
  const percent = (value: number) => Math.round(value * 1000) / 10;
  if (u.speed > 0 || initial.speed) result.push({ id: 'speed', name: u.speed ? 'Paso ligero' : 'Botas de asalto', value: `+${percent(u.speed * UPGRADE_EFFECTS.speed + initial.speed)}%`, stacks: u.speed + Number(initial.speed > 0) });
  if (u.dash > 0) result.push({ id: 'dash', name: 'Dash calibrado', value: `-${percent(u.dash * UPGRADE_EFFECTS.dash)}%`, stacks: u.dash });
  if (u.reach > 0) result.push({ id: 'reach', name: 'Filo amplio', value: `+${percent(u.reach * UPGRADE_EFFECTS.reach)}%`, stacks: u.reach });
  if (u.magnet > 0) result.push({ id: 'magnet', name: 'Imán de suministros', value: `+${percent(u.magnet * UPGRADE_EFFECTS.magnet)}%`, stacks: u.magnet });
  if ((u.vitality > 0 || initial.health) && state.difficulty !== 'dystopia') result.push({ id: 'vitality', name: u.vitality ? 'Vitalidad' : 'Botiquín de campaña', value: `+${state.maxHp - DIFFICULTIES[state.difficulty].hp} PV`, stacks: u.vitality + Number(initial.health > 0) });
  if (u.rhythm > 0 || initial.attack) result.push({ id: 'rhythm', name: u.rhythm ? 'Ritmo de acero' : 'Servo de ataque', value: `+${percent(u.rhythm * UPGRADE_EFFECTS.rhythm + initial.attack)}%`, stacks: u.rhythm + Number(initial.attack > 0) });
  if (state.frenesis.active && state.frenesis.remainingMs > 0) result.push({ id: 'frenesis', name: 'Frenesis',
    value: `VEL +${percent((1 + u.speed * UPGRADE_EFFECTS.speed + initial.speed) * FRENESIS.moveMultiplier - 1)}%`,
    detail: `ATA +${percent((1 + u.rhythm * UPGRADE_EFFECTS.rhythm + initial.attack) * FRENESIS.attackMultiplier - 1)}%`,
    stacks: 1, remainingSeconds: Math.ceil(state.frenesis.remainingMs / 1000) });
  return result;
}

/** Descriptions share the same IDs as the effective values above. */
export const POWERUP_DESCRIPTIONS: Record<Powerup['id'], string> = {
  speed: 'Aumenta la velocidad de movimiento.',
  dash: 'Reduce el tiempo de recuperación del dash.',
  reach: 'Aumenta el alcance del ataque.',
  magnet: 'Amplía el radio de recogida de experiencia y objetos.',
  vitality: 'Aumenta la vida máxima de esta partida.',
  rhythm: 'Aumenta la velocidad de ataque.',
  armor: 'Absorbe daño antes de perder vida. No se regenera.',
  frenesis: 'Transformación temporal: movimiento y ataques más rápidos.',
};
