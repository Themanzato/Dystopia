/** Normalized effects share -26 LUFS. The battle track measures about -11 LUFS,
 * so its bus needs separate attenuation to remain beneath audible attack cues.
 * These gains multiply the user's independent music/effects preferences. */
export const AUDIO_MIX = { effects: 1, battleMusic: 0.16, deathMusic: 0.8 } as const;
