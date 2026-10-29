/* eslint-disable react-hooks/immutability -- Expo Audio SharedObjects expose native volume/loop setters. */
import { useQueuedAudioPlayer as useAudioPlayer, loadQueuedAudioPlayer } from './useQueuedAudioPlayer';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ACTION_SOUND_KEYS, type ActionSound, type ActionSoundEvents } from '../game/actionSounds';
import { useActionSoundPlayers } from './useActionSoundPlayers';
import { prepareAudioQueue } from './audioPreparation';
import { useGameAudio } from './AudioProvider';
import { AUDIO_MIX } from './audioMix';

/** Monotonic simulation counters; pickup is deliberately consumed without a cue. */
export type BattleAudioEvents = ActionSoundEvents & Record<'attack' | 'dash' | 'damage' | 'kill' | 'pickup' | 'level' | 'chest' | 'wave' | 'boss' | 'bossAttack' | 'bossIntro' | 'death' | 'shipAlarm' | 'zoneReward' | 'bossHit' | 'bossPhase' | 'bossBeep', number> & Partial<Record<'eventStart'|'eventComplete'|'eventCue'|'electricCharge'|'electricImpact',number>>;
export type BattleAudioSnapshot = { events: BattleAudioEvents; mode: 'playing' | 'upgrade' | 'chest' | 'merchant' | 'dead' | 'won'; active:boolean };
export const BATTLE_AUDIO_TOTAL = 36;
const OPTIONAL_CUES = ['deathMusic', 'boss', 'bossHit', 'bossPhase', 'widowVoice1', 'widowVoice2'];
type LegacyCue = Exclude<keyof Omit<BattleAudioEvents, keyof ActionSoundEvents>, 'pickup' | 'death' | 'bossIntro' | 'zoneReward'|'eventStart'|'eventComplete'|'eventCue'>;
type Cue = LegacyCue | ActionSound;
const OPTIONS = { updateInterval: 1000, keepAudioSessionActive: true, downloadFirst: false };
// Existing licensed original; see assets/sounds/music/BATTLE_LICENSE.md.
const MUSIC = require('../../assets/sounds/music/heavy_battle_1_bpm190.mp3');
const DEATH_MUSIC = require('../../assets/sounds/music/die menu.mp3');
// Admit immediate player feedback before the bounded boss/ambient cue batch.
// Otherwise three simultaneous boss cues consume the budget and swallow dash.
const ORDER: Cue[] = ['damage', 'dash', ...ACTION_SOUND_KEYS,'electricImpact','electricCharge', 'bossBeep', 'bossPhase', 'bossHit', 'shipAlarm', 'bossAttack', 'boss', 'level', 'chest', 'wave', 'attack', 'kill'];
const ACTION_COOLDOWN: Record<ActionSound,number> = { archerShot:240,sageCharge:500,sageExplosion:200,daggerSlash:160,electroStorm:600,guardianSquare:300,guardianLaser:240,electroProjectile:180,widowVoice1:1800,widowVoice2:1800,electroTeleport:500,guardianTeleport:500,guardianLasers:300,dustBeepFast:100,dustBeepTrack:160,dustBomb:100,dustSlam:300 };
const COOLDOWN: Record<LegacyCue, number> = { electricCharge:300,electricImpact:200, bossBeep: 120, bossHit: 220, bossPhase: 700, shipAlarm: 500, attack: 100, dash: 180, damage: 180, kill: 180, level: 250, chest: 250, wave: 250, boss: 250, bossAttack: 240 };
// All effect files share a measured -26 LUFS target, with mix headroom.
const EFFECT_GAIN = AUDIO_MIX.effects;
const isAction = (key: Cue): key is ActionSound => (ACTION_SOUND_KEYS as readonly string[]).includes(key);
// A later boss cue must not immediately steal the dash voice just admitted.
const priority = (key: Cue) => key === 'damage' || key === 'dash' ? 4 : isAction(key) ? 3 : key === 'kill' || key === 'attack' ? 1 : 2;

/** Persistent bounded players; animation/physics frames never create audio objects. */
export function BattleAudio({ active, events, suspended = false, dead = false, onPrepared, onError, sessionKey = 0, preparationActive = true }: { active: boolean; events: BattleAudioEvents; suspended?: boolean; dead?: boolean; onPrepared?: (completed:number,total:number)=>void; onError?: (message:string)=>void; sessionKey?:number; preparationActive?:boolean }) {
  const audio = useGameAudio();
  const music = useAudioPlayer(MUSIC, OPTIONS);
  const deathMusic = useAudioPlayer(DEATH_MUSIC, OPTIONS);
  const attack = useAudioPlayer(require('../../assets/sounds/mixed/legacy-attack.wav'), OPTIONS);
  const dash = useAudioPlayer(require('../../assets/sounds/mixed/dash-jugador.wav'), OPTIONS);
  const damage = useAudioPlayer(require('../../assets/sounds/mixed/legacy-damage.wav'), OPTIONS);
  const kill = useAudioPlayer(require('../../assets/sounds/mixed/legacy-kill.wav'), OPTIONS);
  const level = useAudioPlayer(require('../../assets/sounds/mixed/legacy-level.wav'), OPTIONS);
  const chest = useAudioPlayer(require('../../assets/sounds/mixed/legacy-chest.wav'), OPTIONS);
  const wave = useAudioPlayer(require('../../assets/sounds/mixed/legacy-wave.wav'), OPTIONS);
  const shipAlarm = useAudioPlayer(require('../../assets/sounds/mixed/legacy-wave.wav'), OPTIONS);
  const boss = useAudioPlayer(require('../../assets/sounds/mixed/legacy-Single_Low_AU_Reverb_v1_wav.wav'), OPTIONS);
  const bossAttack = useAudioPlayer(require('../../assets/sounds/mixed/legacy-bossAttack.wav'), OPTIONS);
  // Existing dry low voices: a short hurt vowel and a distinct phase growl.
  // Their players are bounded and the cue budget is shared with all combat FX.
  const bossHit = useAudioPlayer(require('../../assets/sounds/mixed/legacy-Single_Low_O_No_Reverb_v1_wav.wav'), OPTIONS);
  const bossPhase = useAudioPlayer(require('../../assets/sounds/mixed/legacy-Single_Low_AU_No_Reverb_v1_wav.wav'), OPTIONS);
  const bossBeep = useAudioPlayer(require('../../assets/sounds/mixed/legacy-dust-beep.wav'), OPTIONS);
  const electricCharge=useAudioPlayer(require('../../assets/sounds/mixed/legacy-electro-charge.wav'),OPTIONS);
  const electricImpact=useAudioPlayer(require('../../assets/sounds/mixed/legacy-electro-impact.wav'),OPTIONS);
  const authored = useActionSoundPlayers();
  const effects = useMemo(() => ({ ...authored, electricCharge,electricImpact,attack, dash, damage, kill, level, chest, wave, boss, bossAttack, shipAlarm, bossHit, bossPhase, bossBeep }), [authored,electricCharge,electricImpact,attack, dash, damage, kill, level, chest, wave, boss, bossAttack, shipAlarm, bossHit, bossPhase, bossBeep]);
  const players=useMemo(()=>({music,deathMusic,...effects}),[music,deathMusic,effects]);
  const [prepared,setPrepared]=useState(()=>Object.values(players).every(player=>player.isLoaded&&!player.currentStatus?.error));
  const [progress,setProgress]=useState({completed:0,total:Object.keys(players).length});
  const [reset,setReset]=useState({key:sessionKey,ready:false});
  const resetReady=reset.key===sessionKey&&reset.ready;
  const criticalFailed=useRef(false), onErrorRef=useRef(onError);
  const failed=useRef(new Set<string>());
  const [recovery, setRecovery] = useState(0);
  const onPreparedRef=useRef(onPrepared);
  useLayoutEffect(()=>{onPreparedRef.current=onPrepared;onErrorRef.current=onError;},[onPrepared,onError]);
  useEffect(()=>{ onPreparedRef.current?.(progress.completed+Number(audio.ready)+Number(resetReady),progress.total+2); },[progress,audio.ready,resetReady,sessionKey]);
  useEffect(()=>{ if(audio.initializationError)onErrorRef.current?.(audio.initializationError); },[audio.initializationError]);
  useEffect(()=>{
    if(!preparationActive)return;
    criticalFailed.current=false;
    for(const [key,player] of Object.entries(players))if(player.isLoaded&&!player.currentStatus?.error)failed.current.delete(key);
    // Returning from pause with resident players must not reset readiness or
    // rewind the music. Only a new session key rewinds the existing players.
    // Synchronize the gate with the external native players before subscribing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrepared(Object.entries(players).every(([key,player])=>OPTIONAL_CUES.includes(key)||player.isLoaded&&!player.currentStatus?.error));
    return prepareAudioQueue(players,loadQueuedAudioPlayer,(completed,total)=>setProgress({completed,total}),()=>{if(!criticalFailed.current)setPrepared(true);},(key,reason)=>{
    failed.current.add(key);
    try{players[key as keyof typeof players].pause();}catch{/* An optional failed player must remain silent. */}
    console.warn(`Dystopia: audio ${key} desactivado: ${reason}`);
  }, key => {
    failed.current.delete(key); setRecovery(value => value + 1);
  }, keys => {
    // These are pending, not corrupt or permanently disabled. Their listeners
    // and bounded queue stay alive, but no stale combat event is replayed.
    for (const key of keys) failed.current.add(key);
  },{essential:Object.keys(players).filter(key=>!OPTIONAL_CUES.includes(key)),essentialError:(key,reason)=>{criticalFailed.current=true;setPrepared(false);onErrorRef.current?.(`Audio ${key}: ${reason}`);}});
  },[players,sessionKey,preparationActive]);
  const previous = useRef<BattleAudioEvents>({ ...events });
  const lastCue = useRef<Partial<Record<Cue, number>>>({});
  const voices = useRef<Cue[]>([]);
  const foreground = useRef(AppState.currentState === 'active');
  const current = useRef({ active, suspended, dead, ready: audio.ready && prepared && resetReady, settings: audio.settings });
  const wasDead = useRef(false);
  const warned = useRef(false);
  const report = useCallback(() => {
    if (!warned.current) { warned.current = true; console.warn('Dystopia: battle audio unavailable; continuing silently.'); }
  }, []);

  useLayoutEffect(()=>{
    previous.current={...events};lastCue.current={};voices.current=[];wasDead.current=false;
    try{music.pause();deathMusic.pause();for(const player of Object.values(effects))player.pause();}catch{report();}
    // New run identity clears cue history without recreating a native player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sessionKey,music,deathMusic,effects,report]);
  useLayoutEffect(()=>{
    let live=true;
    let timeout:ReturnType<typeof setTimeout>|undefined;
    if(prepared&&!criticalFailed.current){
      const fail=()=>{if(live){live=false;onErrorRef.current?.('No se pudo reiniciar el audio de la partida. Reintenta.');}};
      timeout=setTimeout(fail,20000);
      void Promise.resolve().then(()=>live?music.seekTo(0):undefined).then(()=>{clearTimeout(timeout);if(live)setReset({key:sessionKey,ready:true});}).catch(()=>{clearTimeout(timeout);fail();});
    }
    return()=>{live=false;clearTimeout(timeout);};
  },[sessionKey,prepared,music,deathMusic]);

  useLayoutEffect(() => {
    current.current = { active, suspended, dead, ready: audio.ready && prepared && resetReady, settings: audio.settings };
    try {
      music.loop = true;
      deathMusic.loop = true;
      music.volume = audio.settings.muted ? 0 : audio.settings.music * AUDIO_MIX.battleMusic;
      deathMusic.volume = audio.settings.muted ? 0 : audio.settings.music * AUDIO_MIX.deathMusic;
      for (const key of ORDER) {
        effects[key].volume = audio.settings.muted ? 0 : audio.settings.effects * EFFECT_GAIN;
        if (failed.current.has(key) || !prepared || !active || suspended || dead || !audio.ready || audio.settings.muted || audio.settings.effects === 0) effects[key].pause();
      }
      // Rewind on each new defeat, never on a settings change or background return.
      if (dead && !wasDead.current) { deathMusic.pause(); void deathMusic.seekTo(0).catch(report); }
      wasDead.current = dead;
      const canPlay = prepared && resetReady && active && foreground.current && audio.ready && !audio.settings.muted && audio.settings.music > 0;
      // Stop the old track first, so defeat never overlaps battle music.
      if (!canPlay || suspended || dead) music.pause();
      if (!canPlay || !dead) deathMusic.pause();
      if (canPlay && dead && !failed.current.has('deathMusic')) { if (!deathMusic.playing) deathMusic.play(); }
      else if (canPlay && !dead && !suspended && !failed.current.has('music') && !music.playing) music.play();
    } catch { report(); }
  }, [active, suspended, dead, audio.ready, audio.settings, music, deathMusic, effects, report, prepared, resetReady, recovery]);

  useLayoutEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      try {
        if (!foreground.current) {
          music.pause(); deathMusic.pause();
          for (const player of Object.values(effects)) player.pause();
          voices.current = [];
        } else {
          const latest = current.current;
          if (latest.active && latest.ready && !latest.settings.muted && latest.settings.music > 0) {
            const track = latest.dead ? !failed.current.has('deathMusic') ? deathMusic : null : !latest.suspended&&!failed.current.has('music') ? music : null;
            if (track && !track.playing) track.play();
          }
        }
      } catch { report(); }
    });
    return () => {
      subscription.remove();
      try {
        music.pause(); deathMusic.pause();
        for (const player of Object.values(effects)) player.pause();
      } catch { /* useAudioPlayer also releases each native player on unmount. */ }
    };
  }, [music, deathMusic, effects, report]);

  useEffect(() => {
    const before = previous.current;
    previous.current = { ...events };
    // Consume muted/paused/dead events, including silent EXP pickups. No burst on resume.
    if (!prepared || !resetReady || !active || dead || !foreground.current || !audio.ready || audio.settings.muted || audio.settings.effects <= 0) return;
    const now = Date.now();
    let budget = 3;
    // Stop events carry their owner's last cue counter; no late promise/timer
    // can resurrect a charge or a dead enemy's sound after a screen change.
    for (const key of ACTION_SOUND_KEYS) if ((events.actionStops?.[key] ?? 0) > (before.actionStops?.[key] ?? 0)) {
      effects[key].pause(); voices.current = voices.current.filter(voice => voice !== key);
    }
    for (const key of ORDER) {
      if(failed.current.has(key))continue;
      if (events.authoredAudio && (key === 'bossBeep' && !((events.eventStart??0)>(before.eventStart??0) && events.eventCue===2) || key === 'electricCharge' || key === 'electricImpact')) continue;
      if (isAction(key) && (events.actionSounds?.[key]?.serial ?? 0) <= (events.actionStops?.[key] ?? 0)) continue;
      // The ship owns this shared two-tone warning when a new wave and alarm
      // begin in the same frame. Never double the same audio on two players.
      if (key === 'wave' && (events.shipAlarm ?? 0) > (before.shipAlarm ?? 0)) continue;
      if (key === 'wave' && (events.eventStart??0)>(before.eventStart??0) && events.eventCue!==0) continue;
      if (suspended && key !== 'damage' && key !== 'level' && key !== 'chest' && key !== 'boss') continue;
      const eventStarted=(events.eventStart??0)>(before.eventStart??0);
      const eventCue=events.eventCue===1?'bossPhase':events.eventCue===2?'bossBeep':'wave';
      const changed = (isAction(key)
        ? (events.actionSounds?.[key]?.serial ?? 0) > (before.actionSounds?.[key]?.serial ?? 0)
        : key === 'bossAttack' ? (events.bossAttackSound ?? events.bossAttack ?? 0) > (before.bossAttackSound ?? before.bossAttack ?? 0)
        : (events[key] ?? 0) > (before[key] ?? 0)) || eventStarted&&key===eventCue
        || (key === 'boss' && (events.bossIntro ?? 0) > (before.bossIntro ?? 0))
        || (key === 'chest' && ((events.zoneReward ?? 0) > (before.zoneReward ?? 0)||(events.eventComplete??0)>(before.eventComplete??0)));
      if (!changed || now - (lastCue.current[key] ?? -Infinity) < (isAction(key) ? ACTION_COOLDOWN[key] : COOLDOWN[key]) || budget <= 0) continue;
      // Common kills/swings must not cut off a boss tell or a landing beep.
      voices.current = voices.current.filter(voice => voice !== key && effects[voice].playing);
      if (voices.current.length >= 3) {
        const victim = [...voices.current].sort((a,b) => priority(a)-priority(b))[0];
        if (priority(victim) > priority(key)) continue;
        effects[victim].pause(); voices.current = voices.current.filter(voice => voice !== victim);
      }
      lastCue.current[key] = now;
      budget--;
      try {
        const player = effects[key];
        player.pause();
        // SDK 57 replay starts in the same event, without awaiting seek completion.
        void player.seekTo(0).catch(report);
        player.play();
        voices.current.push(key);
      } catch { report(); }
    }
  }, [active, suspended, dead, events, audio.ready, audio.settings, effects, report, prepared, resetReady]);

  return null;
}

export default BattleAudio;
