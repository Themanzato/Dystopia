/** One source of artwork for the workshop, paused effects and all reward previews. */
export const REWARD_ICON_SOURCES = {
  vitality: require('../../assets/ui/rewards/field-kit.png'),
  rhythm: require('../../assets/ui/rewards/attack-servo.png'),
  speed: require('../../assets/ui/rewards/assault-boots.png'),
  frenesis: require('../../assets/ui/rewards/frenesis-coil.png'),
  magnet: require('../../assets/ui/rewards/magnet.png'),
  dash: require('../../assets/ui/rewards/dash.png'),
  reach: require('../../assets/ui/rewards/reach.png'),
  xp: require('../../assets/ui/rewards/experience.png'),
  heal: require('../../assets/ui/rewards/heal.png'),
} as const;
export type RewardIconId = keyof typeof REWARD_ICON_SOURCES;
export const REWARD_ICON_ASSETS: number[] = [...new Set<number>(Object.values(REWARD_ICON_SOURCES))];
const ALIASES: Record<string, RewardIconId> = {
  'field-kit':'vitality', 'attack-servo':'rhythm', 'assault-boots':'speed', 'frenesis-coil':'frenesis',
  health:'heal', charge:'frenesis', experience:'xp',
};
export function rewardIconId(id: string): RewardIconId {
  'worklet';
  return Object.hasOwn(REWARD_ICON_SOURCES,id) ? id as RewardIconId : ALIASES[id] ?? 'xp';
}
export function rewardIconSource(id: string): number {
  'worklet';
  return REWARD_ICON_SOURCES[rewardIconId(id)];
}
