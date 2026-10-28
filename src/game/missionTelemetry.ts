export type MissionTelemetry = {
  captures: number; nests: number; reactors: number; elites: number; activations: number; teleports: number;
  spinSerial: number; spinKills: number; bestSpin: number; perfectCaptures: number;
  damage: number; waveDamage: number; streak: number; bestStreak: number;
  specialDamage: number; specialBoss: boolean; specialCounted: boolean; perfectHard: number; perfectImpossible: number;
};
export function createMissionTelemetry(): MissionTelemetry {
  'worklet';
  return { captures: 0, nests: 0, reactors: 0, elites: 0, activations: 0, teleports: 0, spinSerial: -1, spinKills: 0, bestSpin: 0,
    perfectCaptures: 0, damage: 0, waveDamage: 0, streak: 0, bestStreak: 0, specialDamage: 0, specialBoss: false, specialCounted: true, perfectHard: 0, perfectImpossible: 0 };
}
