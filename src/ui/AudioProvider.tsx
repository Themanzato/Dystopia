import { AUDIO_MIX } from './audioMix';
/* eslint-disable react-hooks/immutability -- Expo Audio exposes mutable native SharedObjects; volume and loop are documented setters. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  readAudioSettings,
  validAudioPatch,
  type AudioSettings,
} from './audioSettings';

export type UiSound = 'press' | 'pause' | 'resume';
type GameAudio = {
  initializationError?: string | null; retryAudio?: () => void;
  settings: AudioSettings;
  ready: boolean;
  error: string | null;
  updateSettings: (patch: Partial<AudioSettings>) => void;
  playUi: (kind?: UiSound) => void;
};
const AudioContext = createContext<GameAudio | null>(null);

// Original PCM WAV clicks keep UI playback compatible with Android and iOS.
const MENU_MUSIC = require('../../assets/sounds/music/menu.mp3');
const LOADING_MUSIC = require('../../assets/sounds/music/glitched.mp3');
const PRESS_SOUND = require('../../assets/sounds/mixed/legacy-Skeleton_Single_v1_wav.wav');
const PAUSE_SOUND = require('../../assets/sounds/mixed/legacy-Skeleton_Single_v2_wav.wav');
const RESUME_SOUND = require('../../assets/sounds/mixed/legacy-Skeleton_Single_v3_wav.wav');
const PLAYER_OPTIONS = { updateInterval: 1000, keepAudioSessionActive: true };
const CUE_OPTIONS = { ...PLAYER_OPTIONS, downloadFirst: true };

export function AudioProvider({
  children,
  menuActive,
  loadingActive = false,
  active,
}: {
  children: ReactNode;
  menuActive: boolean;
  loadingActive?: boolean;
  active: boolean;
}) {
  // Persistent menu/loading tracks and short UI cues. Expo releases these
  // players on unmount; changing screens never creates extra copies.
  const music = useAudioPlayer(MENU_MUSIC, PLAYER_OPTIONS);
  const glitched = useAudioPlayer(LOADING_MUSIC, PLAYER_OPTIONS);
  const press = useAudioPlayer(PRESS_SOUND, CUE_OPTIONS);
  const pause = useAudioPlayer(PAUSE_SOUND, CUE_OPTIONS);
  const resume = useAudioPlayer(RESUME_SOUND, CUE_OPTIONS);
  const effects = useMemo(() => ({ press, pause, resume }), [press, pause, resume]);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [ready, setReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [audioAttempt, setAudioAttempt] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const retryAudio = useCallback(() => { setAudioReady(false); setInitializationError(null); setAudioError(null); setAudioAttempt(n => n + 1); }, []);
  const mounted = useRef(true);
  const hydrated = useRef(false);
  const pendingPatch = useRef<Partial<AudioSettings>>({});
  const settingsRef = useRef(settings);
  const activeRef = useRef(active);
  const menuRef = useRef(menuActive);
  const loadingRef = useRef(loadingActive);
  const writes = useRef(Promise.resolve());
  useLayoutEffect(() => {
    activeRef.current = active;
    menuRef.current = menuActive;
    loadingRef.current = loadingActive;
  }, [active, menuActive, loadingActive]);

  const reportAudioError = useCallback(() => {
    if (mounted.current) setAudioError('No se pudo reproducir el audio. Puedes continuar sin sonido.');
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let stored: AudioSettings = DEFAULT_AUDIO_SETTINGS;
      try {
        stored = readAudioSettings(await AsyncStorage.getItem(AUDIO_SETTINGS_KEY));
      } catch {
        if (!cancelled) {
          setStorageError('No se pudieron recuperar tus ajustes. Puedes ajustarlos de nuevo.');
        }
      }
      if (cancelled) return;
      // An early interaction must take precedence over a slower storage read.
      const restored = { ...stored, ...pendingPatch.current };
      settingsRef.current = restored;
      hydrated.current = true;
      setSettings(restored);
      setReady(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Serialize writes so slow storage cannot persist an older slider value last.
    writes.current = writes.current.then(async () => {
      await AsyncStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
      if (mounted.current) setStorageError(null);
    }).catch(() => {
      if (mounted.current) {
        setStorageError('No se pudieron guardar tus ajustes. Se mantienen durante esta sesión.');
      }
    });
  }, [ready, settings]);

  useEffect(() => {
    let cancelled = false, settled = false;
    const fail=()=>{if(!cancelled&&!settled){settled=true;setInitializationError('No se pudo inicializar el audio. Reintenta.');reportAudioError();}};
    const timeout=setTimeout(fail,20000);
    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    }).then(() => {
      clearTimeout(timeout);
      if (!cancelled&&!settled) { settled=true;setAudioReady(true); setInitializationError(null); }
    }).catch(() => {clearTimeout(timeout);fail();});
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [reportAudioError, audioAttempt]);

  useEffect(() => {
    // Listen only for actual failures, not playback time: no React render loop.
    const listeners = [music, glitched, ...Object.values(effects)].map(player =>
      player.addListener('playbackStatusUpdate', status => {
        if (status.error) reportAudioError();
      }),
    );
    return () => { listeners.forEach(listener => listener.remove()); };
  }, [music, glitched, effects, reportAudioError]);

  const applyVolumes = useCallback((next: AudioSettings) => {
    try {
      music.volume = next.muted ? 0 : next.music;
      glitched.volume = next.muted ? 0 : next.music;
      // Silence immediately, including before React commits the new settings.
      if (next.muted || next.music === 0) {
        music.pause();
        glitched.pause();
      }
      for (const player of Object.values(effects)) {
        player.volume = next.muted ? 0 : next.effects * AUDIO_MIX.effects;
        if (next.muted || next.effects === 0) player.pause();
      }
    } catch {
      reportAudioError();
    }
  }, [music, glitched, effects, reportAudioError]);

  const updateSettings = useCallback((patch: Partial<AudioSettings>) => {
    const valid = validAudioPatch(patch);
    if (!hydrated.current) pendingPatch.current = { ...pendingPatch.current, ...valid };
    const next = { ...settingsRef.current, ...valid };
    settingsRef.current = next;
    // Apply synchronously so the next button preview uses the new volume.
    applyVolumes(next);
    setSettings(next);
  }, [applyVolumes]);

  useEffect(() => {
    applyVolumes(settings);
  }, [settings, applyVolumes]);

  useLayoutEffect(() => {
    try {
      music.loop = true;
      glitched.loop = true;
      const canPlay = ready && audioReady && active && !settings.muted && settings.music > 0;
      // Stop the previous track first: a loading screen always takes precedence
      // over the menu, including startup when both modes can be requested.
      if (!canPlay || loadingActive || !menuActive) music.pause();
      if (!canPlay || !loadingActive) glitched.pause();
      if (canPlay && loadingActive) glitched.play();
      else if (canPlay && menuActive) music.play();
      if (!active) {
        for (const player of Object.values(effects)) player.pause();
      }
    } catch {
      reportAudioError();
    }
  }, [music, glitched, effects, ready, audioReady, menuActive, loadingActive, active, settings.muted, settings.music, reportAudioError]);

  const playUi = useCallback((kind: UiSound = 'press') => {
    const current = settingsRef.current;
    if (!hydrated.current || !audioReady || !activeRef.current) return;
    try {
      // Also unlock browser audio on a real user gesture after autoplay rejection.
      if (!current.muted && current.music > 0) {
        const track = loadingRef.current ? glitched : menuRef.current ? music : null;
        if (track && !track.playing) track.play();
      }
      if (current.muted || current.effects === 0) return;
      for (const player of Object.values(effects)) player.pause();
      const player = effects[kind];
      // An empty downloadFirst player must never queue play(): SDK57 web
      // replace() would later replay it with a fresh media element at volume 1.
      // Finished Android clips keep a known duration even when isLoaded is false.
      if (!player.isLoaded && !(player.duration > 0)) return;
      player.volume = current.effects * AUDIO_MIX.effects;
      // SDK 57 documents seekTo(0) followed by play() in the same gesture.
      // Do not defer playback to the seek promise: it delays feedback and can
      // restart an obsolete cue after mute, backgrounding or unmount.
      void player.seekTo(0).catch(reportAudioError);
      player.play();
    } catch {
      reportAudioError();
    }
  }, [audioReady, music, glitched, effects, reportAudioError]);

  const value = useMemo<GameAudio>(() => ({
    settings,
    ready: ready && audioReady, initializationError, retryAudio,
    error: storageError ?? audioError,
    updateSettings,
    playUi,
  }), [settings, ready, audioReady, initializationError, retryAudio, storageError, audioError, updateSettings, playUi]);

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useGameAudio(): GameAudio {
  const audio = useContext(AudioContext);
  if (!audio) throw new Error('useGameAudio debe usarse dentro de AudioProvider.');
  return audio;
}
