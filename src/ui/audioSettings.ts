export type AudioSettings = {
  music: number;
  effects: number;
  muted: boolean;
};

export const AUDIO_SETTINGS_KEY = '@dystopia/audio/v1';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  music: 0.45,
  effects: 0.65,
  muted: false,
};

export function validAudioPatch(value: unknown): Partial<AudioSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const patch: Partial<AudioSettings> = {};
  for (const key of ['music', 'effects'] as const) {
    const volume = source[key];
    if (typeof volume === 'number' && Number.isFinite(volume)) {
      patch[key] = Math.max(0, Math.min(1, volume));
    }
  }
  if (typeof source.muted === 'boolean') patch.muted = source.muted;
  return patch;
}

export function readAudioSettings(raw: string | null): AudioSettings {
  return {
    ...DEFAULT_AUDIO_SETTINGS,
    ...validAudioPatch(raw === null ? null : JSON.parse(raw)),
  };
}
