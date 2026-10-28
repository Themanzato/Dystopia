# Gameplay audio selection

The runtime uses no files from `assets/sounds/battle/`. That older directory is
preserved as requested. These ten cues use **different** existing originals:

| Cue | Existing original in `Audio sounds effect/` |
| --- | --- |
| Sword attack | spaceTrash3.ogg (short filtered airy swish, low playback volume) |
| Dash | phaseJump4.ogg |
| Player damage | highDown.ogg |
| Enemy death | spaceTrash4.ogg |
| Level up | powerUp7.ogg |
| Chest opens | powerUp2.ogg |
| Wave begins | twoTone2.ogg |
| Boss introduction/defeat | Existing `DialogTextSoundEffects/Voices_03/Single_Low_AU_Reverb_v1_wav.wav` (runtime) |
| Miniboss/boss attack | spaceTrash2.ogg |

These are portable mono 16-bit PCM WAV derivatives at 22050 Hz, with initial
near-silence trimmed for responsive feedback. The originals are unchanged;
`sources.json` records original/derived SHA256 hashes and measured signal data.
`node scripts/build-gameplay-audio.cjs` reproduces them using an installed
Playwright/Chrome (`DYSTOPIA_PLAYWRIGHT`, `DYSTOPIA_CHROME` can select paths).
No sound is allocated or played for EXP pickups. Only the level-up event sounds.

Menu: original `../music/menu.mp3`.
Gameplay: existing `../music/heavy_battle_1_bpm190.mp3`, CC0, MintoDog;
see `../music/BATTLE_LICENSE.md` for source/license/hash.
Defeat: exact existing `../music/die menu.mp3`, looped only while defeated.
All tracks respect music volume/mute and stop on exit/background; battle music
also pauses for pause and choice screens. Effects respect their own volume and
are rate-limited with at most three simultaneous voices.

Compatibility: existing expo-audio ~57.0.5 (SDK 57, included in Expo Go).
https://docs.expo.dev/versions/v57.0.0/sdk/audio/
The original user-supplied menu, defeat and effect assets retain their existing
licensing/provenance; this change does not claim ownership or a new license.

Boss entrances now use the existing low reverberant voice above, triggered once by
`bossIntro`. The older derived `boss.wav` and its manifest remain preserved for
reproducibility but are no longer loaded by the runtime. All twelve persistent
battle players and the three-voice cap are retained.
Derelict-ship warnings reuse `wave.wav` in a dedicated persistent alarm player:
three separated pulses at 0/1/2 seconds of the 3-second simulation warning.
No loop or queued replay on pause/resume. The existing chest cue also acknowledges
completion of a building reward zone. Original sound files and manifests remain
unchanged; the two wave/alarm players reference the same existing PCM resource.
Dust Jumper marker: `dust-beep.wav`, derived from the existing `../Audio sounds effect/tone1.ogg`, mono PCM 22050 Hz, onset trimmed and capped at 130ms with short edge fades. Reproduce only this derivative with `node scripts/build-gameplay-audio.cjs --dust-beep`; the command preserves all other files and manifest entries. Simulation cues stop during pause, death and scene exit.
