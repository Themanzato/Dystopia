import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useControlSettings } from '../ui/ControlPreferences';
import { controlArea } from '../ui/controlLayout';
import { tutorialMapTargets } from './tutorialInstructions';
import TutorialHUD from '../ui/TutorialHUD';
import TutorialEffects from './TutorialEffects';
import { advanceTutorial, continueTutorial, createTutorialPlayer, createTutorialSurvival, constrainTutorialPlayer, TUTORIAL_SPAWN } from './tutorial';
import PixelText from '../ui/PixelText';
import MerchantPanel from '../ui/MerchantPanel';
import MerchantIndicator from './MerchantIndicator';
import { advanceMerchants } from './merchantGameplay';
import GameUIOpacity from '../ui/GameUIOpacity';
import { useResumeCountdown } from '../ui/useResumeCountdown';
import { prepareGameInterface } from '../ui/prepareGameInterface';
import type { WorkshopId } from './workshop';
import { createRunId } from './scores';
import { publishCurrentRun } from '../ui/CurrentRun';
import { ReactorVision, EliteMarkers, OptionalEventHUD } from './OptionalEventEffects';
import FrenesisScreenEffects from './FrenesisScreenEffects';
import FrenesisMapInput from './FrenesisMapInput';
import { suspendFrenesisAttack, frenesisVisualPosition } from './frenesis';
import { SURVIVAL_SELECTION, type RunSelection, type SpecialEnemyId } from './purgatorio';
import type { CanvasRef, SkImage } from '@shopify/react-native-skia';
import { BATTLE_AUDIO_TOTAL, type BattleAudioSnapshot } from '../ui/BattleAudio';
import type { Difficulty } from './difficulty';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, AppState, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Canvas, Fill, Group } from '@shopify/react-native-skia';
import { scheduleOnUI } from 'react-native-worklets';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { OUTSIDE_COLOR } from './map';
import { clampCamera, getCameraBounds, type CameraBounds, type Viewport } from './camera';
import { advancePlayer, createPlayer, PLAYER_SPAWN, REST_INPUT, type MoveInput } from './player';
import { ActorsScene } from './ActorsScene';
import { WorldEventEffects, WorldEventHUD } from './WorldEventEffects';
import { BattleEffects } from './BattleEffects';
import { createEncounter } from './encounter';
import { createSurvival, advanceSurvival, applyPlayerUpgrades, SURVIVAL_CONFIG, type SurvivalState } from './survival';
import MissionBridge from '../ui/MissionBridge';
import BossOffscreenIndicators from './BossOffscreenIndicators';
import SurvivalHUD from '../ui/SurvivalHUD';
import { damageFeedback } from './damageFeedback';
import { buildFlowField, navigationCell, NAV_REFRESH_MS } from './navigation';
import { TouchControls } from './TouchControls';

type CameraView = CameraBounds & Viewport;
// Immutable initial field is built once on JS before gameplay starts.
const INITIAL_FIELD = buildFlowField(PLAYER_SPAWN);
const TUTORIAL_FIELD = buildFlowField(TUTORIAL_SPAWN);
type Props = { tutorial?:boolean; onTutorialComplete?:()=>void; onTutorialStartGame?:()=>void; resumeRequest?:number; onProgress?:(completed:number,total:number)=>void; initialEquipment?: WorkshopId[]; selection?: RunSelection; onPurgatorioClear?: (id: SpecialEnemyId) => void; difficulty?: Difficulty; paused?: boolean; onPause?: () => void; onPausePressIn?: () => void; onRetry?: () => void; onExit?: () => void; onChangeDifficulty?: () => void; onReady?: () => void; onError?: (message: string) => void };
export default function CourtyardScreen({ externalAudioProgress,onAudioState,tutorial=false,onTutorialComplete,onTutorialStartGame,resumeRequest=0,onProgress, initialEquipment = [], selection = SURVIVAL_SELECTION, onPurgatorioClear, difficulty = 'easy', paused = false, onPause, onPausePressIn, onRetry, onExit, onChangeDifficulty, onReady, onError: onLoadError }: Props & {externalAudioProgress?:{completed:number;total:number};onAudioState?:(state:BattleAudioSnapshot)=>void} = {}) {
  const dimensions=useWindowDimensions(),insets=useSafeAreaInsets(),{settings:controlSettings}=useControlSettings();
  const tutorialTargets=useMemo(()=>tutorial?tutorialMapTargets(controlArea(dimensions.width,dimensions.height,insets),controlSettings):[],[tutorial,dimensions.width,dimensions.height,insets,controlSettings]);
  const interfaceKey=`${dimensions.width}x${dimensions.height}`;
  const [preparedInterface,setPreparedInterface]=useState('');
  const interfaceReady=preparedInterface===interfaceKey;
  const [localAudioProgress,setAudioProgress]=useState({completed:0,total:BATTLE_AUDIO_TOTAL});
  const audioProgress=externalAudioProgress??localAudioProgress;
  const canvas=useRef<CanvasRef|null>(null),live=useRef(true);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const [hudReady,setHudReady]=useState(false),[renderedKey,setRenderedKey]=useState('');
  const [controlsReady,setControlsReady]=useState(false);
  const onControlsPrepared=useCallback(()=>{if(live.current)setControlsReady(true);},[]);
  const onHudPrepared=useCallback(()=>{if(live.current)setHudReady(true);},[]);
  const onAudioPrepared=useCallback((completed:number,total:number)=>setAudioProgress(old=>old.completed===completed&&old.total===total?old:{completed,total}),[]);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [actorsReady, setActorsReady] = useState(false);
  const [actorImages, setActorImages] = useState<SkImage[] | null>(null);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const player = useSharedValue(tutorial?createTutorialPlayer():createPlayer());
  const input = useSharedValue<MoveInput>(REST_INPUT);
  const view = useSharedValue<CameraView>({ width: 1, height: 1, ...getCameraBounds({ width: 1, height: 1 }) });
  const encounter = useSharedValue(createEncounter());
  const navigationField = useSharedValue(tutorial?TUTORIAL_FIELD:INITIAL_FIELD);
  const navigationTimer = useSharedValue(0);
  const [mode, setMode] = useState<SurvivalState['mode']>('playing');
  const [runSeed] = useState(() => (Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0);
  const [resultId] = useState(createRunId);
  const [endingReady, setEndingReady] = useState(false);
  const [practiceFinished,setPracticeFinished]=useState(false);
  const onHudMode = useCallback((mode: SurvivalState['mode'], complete = false) => { setMode(mode); setEndingReady(complete); }, []);
  const resourcesReady = sceneReady && actorsReady && interfaceReady && audioProgress.completed===audioProgress.total;
  const ready = resourcesReady && hudReady && controlsReady && renderedKey===interfaceKey;
  // A real Skia draw acknowledgement, not a delay standing in for readiness.
  // Only one pixel is read back; the snapshot does not retain a second scene.
  useEffect(()=>{
    if(!resourcesReady||!hudReady||!controlsReady||!active||assetError||renderedKey===interfaceKey)return;
    let mounted=true,frame=0;
    frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
      if(!mounted)return;
      canvas.current?.redraw();
      void canvas.current?.makeImageSnapshotAsync({x:0,y:0,width:1,height:1}).then(image=>{
        const drawn=image.width()>0&&image.height()>0;image.dispose();
        if(mounted){if(drawn)setRenderedKey(interfaceKey);else setAssetError('La escena no se pudo preparar. Reintenta.');}
      }).catch(cause=>{if(mounted)setAssetError('Escena: '+String(cause));});
    });});
    return()=>{mounted=false;cancelAnimationFrame(frame);};
  },[resourcesReady,hudReady,controlsReady,active,assetError,renderedKey,interfaceKey]);
  useEffect(()=>{
    if(!resourcesReady||ready||!active||assetError)return;
    const timeout=setTimeout(()=>setAssetError('No se pudo preparar el HUD o dibujar la primera escena. Reintenta la carga.'),20000);
    return()=>clearTimeout(timeout);
  },[resourcesReady,ready,active,assetError]);
  useEffect(() => {
    if (assetError) onLoadError?.(assetError);
    else if (ready) onReady?.();
  }, [ready, assetError, onReady, onLoadError]);
  // The UI-thread gate also blocks an already queued callback during pause.
  const clock = useSharedValue({ running: false, firstFrame: true });
  const survival = useSharedValue(tutorial?createTutorialSurvival(runSeed):createSurvival(runSeed, difficulty, selection, initialEquipment));
  const resumeBlocked=useSharedValue(false);
  const stopControls=useCallback(()=>{clock.set({running:false,firstFrame:true});input.set(REST_INPUT);player.set(suspendFrenesisAttack(player.value));},[clock,input,player]);
  const countdown=useResumeCountdown(resumeBlocked,ready&&active&&!paused&&!assetError&&mode!=='dead'&&mode!=='won',resumeRequest,stopControls);
  const enabled=ready&&active&&!paused&&!assetError&&mode==='playing'&&countdown.number===null&&!practiceFinished;
  const presenting=ready&&active&&!paused&&!assetError&&countdown.number===null&&!practiceFinished&&(mode==='playing'||!endingReady&&(mode==='dead'||mode==='won'));
  useEffect(()=>{let mounted=true;void prepareGameInterface(dimensions.width,dimensions.height).then(()=>{if(mounted)setPreparedInterface(interfaceKey);}).catch(cause=>{if(mounted)setAssetError('Interfaz: '+String(cause));});return()=>{mounted=false;};},[dimensions.width,dimensions.height,interfaceKey]);
  useEffect(()=>onProgress?.(Number(sceneReady)+Number(actorsReady)+Number(interfaceReady)+Number(hudReady)+Number(controlsReady)+Number(renderedKey===interfaceKey)+audioProgress.completed,6+audioProgress.total),[sceneReady,actorsReady,interfaceReady,hudReady,controlsReady,renderedKey,interfaceKey,audioProgress,onProgress]);

  useEffect(() => publishCurrentRun(survival), [survival]);
  const tutorialState=useDerivedValue(()=>survival.value.tutorial??null);
  const onPracticeCompleted=useCallback(()=>{stopControls();setPracticeFinished(true);onTutorialComplete?.();},[stopControls,onTutorialComplete]);
  const onTutorialContinue=useCallback(()=>{
    scheduleOnUI(()=>{'worklet';if(clock.value.running&&!resumeBlocked.value)survival.set(continueTutorial(survival.value));});
  },[clock,resumeBlocked,survival]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      input.set(REST_INPUT);
    });
    return () => subscription.remove();
  }, [input]);

  const frame = useFrameCallback(useCallback(({ timeSincePreviousFrame }) => {
    'worklet';
    if (!clock.value.running || resumeBlocked.value) return;
    if (clock.value.firstFrame) { clock.set({ running: true, firstFrame: false }); return; }
    if (survival.value.mode !== 'playing') {
      if (survival.value.ending && !survival.value.ending.ready) {
        const battle = advanceSurvival(survival.value, player.value, player.value, navigationField.value, timeSincePreviousFrame ?? 0);
        survival.set(battle);
        if (battle.ending?.kind === 'death') player.set({ ...player.value, action: 'death', actionMs: Math.min(battle.ending.animationMs, battle.ending.elapsedMs), frenesis: false, attackHeld: false, spinStrike: false });
      }
      return;
    }
    if (timeSincePreviousFrame === null) return;
    const dt = Math.max(0, Math.min(40, timeSincePreviousFrame));
    const before = applyPlayerUpgrades(player.value, survival.value);
    const after = constrainTutorialPlayer(before, advancePlayer(before, input.value, dt),survival.value);
    const navigationMs = navigationTimer.value + dt;
    if (navigationMs >= NAV_REFRESH_MS) {
      navigationTimer.set(0);
      if (navigationCell(after) !== navigationField.value.targetCell) navigationField.set(buildFlowField(after));
    } else navigationTimer.set(navigationMs);
    const v = view.value, camera = clampCamera(frenesisVisualPosition(after, survival.value.frenesis), v);
    const combatView = { left: camera.x - v.width / (2 * v.scale), right: camera.x + v.width / (2 * v.scale), top: camera.y - v.height / (2 * v.scale), bottom: camera.y + v.height / (2 * v.scale) };
    const battle = tutorial ? advanceTutorial(survival.value,before,after,navigationField.value,dt,combatView,survival.value.tutorial?.step==='teleport'?tutorialTargets.map(p=>({x:combatView.left+p.x/v.width*(combatView.right-combatView.left),y:combatView.top+p.y/v.height*(combatView.bottom-combatView.top)})):undefined) : advanceMerchants(advanceSurvival(survival.value, before, after, navigationField.value, dt, combatView),after,navigationField.value,dt);
    if(battle.mode==='merchant')clock.set({running:false,firstFrame:true});
    survival.set(battle);
    encounter.set(battle.encounter);
    const finalPlayer = applyPlayerUpgrades(after, battle);
    player.set({ ...finalPlayer, ...(battle.mode === 'dead' ? { action: 'death' as const, actionMs: 0, attackHeld: false, spinStrike: false } : {}), stunMs: battle.stunMs, ...(battle.stunMs > 0 ? { action: 'idle' as const, actionMs: 0 } : {}) });
  }, [player, input, encounter, navigationField, navigationTimer, clock, survival, view, resumeBlocked,tutorial,tutorialTargets]), false);
  useEffect(() => {
    input.set(REST_INPUT);
    if (!enabled) player.set(suspendFrenesisAttack(player.value));
    clock.set({ running: presenting && !resumeBlocked.value, firstFrame: true });
    frame.setActive(presenting);
    return () => {
      clock.set({ running: false, firstFrame: true });
      frame.setActive(false);
    };
  }, [frame, enabled, presenting, input, clock, player, resumeBlocked]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    view.set({ width, height, ...getCameraBounds({ width, height }) });
  }, [view]);
  const onError = useCallback((error: Error) => {if(live.current)setAssetError(error.message);}, []);
  const onSceneReady = useCallback(() => {if(live.current)setSceneReady(true);}, []);
  const onActorsReady = useCallback(() => {if(live.current)setActorsReady(true);}, []);
  const phaseTint = useDerivedValue(() => Math.min(0.18, (survival.value.phaseFlashMs ?? 0) / 2600));
  const damageTint = useDerivedValue(() => damageFeedback(survival.value.invulnerableMs, SURVIVAL_CONFIG.invulnerableMs).tint);
  const cameraTransform = useDerivedValue(() => {
    const current = view.value;
    const hit = damageFeedback(survival.value.invulnerableMs, SURVIVAL_CONFIG.invulnerableMs);
    const flash = survival.value.phaseFlashMs ?? 0;
    const shake = flash > 0 ? Math.sin(flash / 24) * Math.min(4, flash / 100) : 0;
    const visual = frenesisVisualPosition(player.value, survival.value.frenesis);
    const camera = clampCamera({ x: visual.x + (hit.x + shake) / current.scale, y: visual.y + (hit.y - shake * 0.6) / current.scale }, current);
    return [{ translateX: current.width / 2 - camera.x * current.scale }, { translateY: current.height / 2 - camera.y * current.scale }, { scale: current.scale }];
  });

  return <GestureHandlerRootView style={styles.screen}>
    <View style={styles.screen} onLayout={onLayout} collapsable={false} accessibilityLabel="Dystopia. Ciudad abandonada con The Swordmaster. Joystick a la izquierda, ataque y dash a la derecha. Cámara de seguimiento con escala fija.">
      <StatusBar hidden />
      <Canvas ref={canvas} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fill color={OUTSIDE_COLOR} />
        <Group transform={cameraTransform}>
          <ActorsScene training={tutorial} player={player} encounter={encounter} survival={survival} active={enabled} onError={onError} onReady={onSceneReady} onActorsReady={onActorsReady} onImages={setActorImages} />
          {tutorial&&<TutorialEffects tutorial={tutorialState} renderDummy={false} onError={onError}/>}
          <ReactorVision survival={survival} player={player}/>
          <EliteMarkers survival={survival}/>
          <WorldEventEffects survival={survival} player={player} />
          <BattleEffects survival={survival} player={player} onError={onError} />
        </Group>
        <FrenesisScreenEffects survival={survival} player={player} view={view} />
        <Fill color="#b82743" opacity={damageTint} />
        <Fill color="#d5bbc8" opacity={phaseTint} />
      </Canvas>
      <FrenesisMapInput survival={survival} player={player} enabled={enabled} camera={cameraTransform} clock={clock} />
      <GameUIOpacity>
      <WorldEventHUD camera={cameraTransform} survival={survival} player={player} view={view} visible={ready && !paused && !assetError && mode === 'playing'} />
      <OptionalEventHUD survival={survival} player={player} view={view} visible={ready && !paused && !assetError && mode === 'playing'} />
      {!tutorial&&<MissionBridge runId={resultId} survival={survival} player={player} view={view} camera={cameraTransform} visible={ready && !paused && !assetError} />}
      <BossOffscreenIndicators survival={survival} view={view} camera={cameraTransform} visible={ready && !paused && !assetError} />
      <MerchantIndicator survival={survival} player={player} view={view} camera={cameraTransform} visible={ready && !paused && !assetError && mode==='playing'}/>
      </GameUIOpacity>
      <SurvivalHUD practice={tutorial} onAudioState={onAudioState} onAudioPrepared={onAudioPrepared} onPrepared={onHudPrepared} onError={onError} obscured={!ready||paused} onResumeAfterChoice={countdown.start} resumeBlocked={resumeBlocked} runId={resultId} clock={clock} images={actorImages} survival={survival} active={ready && active && !paused && !assetError && countdown.number===null} visible={resourcesReady && !assetError}
        onMode={onHudMode} onPurgatorioClear={onPurgatorioClear} onRetry={onRetry} onExit={onExit} onChangeDifficulty={onChangeDifficulty} />
      <TouchControls preparing={!ready&&!assetError} onPrepared={onControlsPrepared} onError={onError} gameState={survival} clock={clock} player={player} input={input} enabled={enabled} pauseAvailable={countdown.number!==null} onPause={onPause} onPausePressIn={onPausePressIn} />
      {!tutorial&&<MerchantPanel survival={survival} clock={clock} resumeBlocked={resumeBlocked} runId={resultId} visible={ready&&active&&!paused&&!assetError&&countdown.number===null} onClose={countdown.start}/>}
      {tutorial&&<TutorialHUD survival={survival} player={player} view={view} visible={ready&&active&&!paused&&!assetError&&countdown.number===null} onContinue={onTutorialContinue} onCompleted={onPracticeCompleted} onStartGame={()=>onTutorialStartGame?.()} onExit={()=>onExit?.()}/>}
      {countdown.number!==null&&<View testID="resume-countdown" pointerEvents="none" style={[StyleSheet.absoluteFill,{alignItems:'center',justifyContent:'center'}]}><PixelText key={countdown.number} text={String(countdown.number)} size={30} color="#e0c8c5"/></View>}
      {(assetError || (!ready && !onReady)) && <View style={styles.message} pointerEvents="none">
        <Text style={styles.messageText}>{assetError ? `No se pudo cargar Dystopia: ${assetError}` : 'Cargando ciudad, Swordmaster y enemigos…'}</Text>
      </View>}
    </View>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OUTSIDE_COLOR },
  pause: { position: 'absolute', top: 18, right: 28, minWidth: 48, minHeight: 44 },
  pauseFace: { minWidth: 48, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  pausePressed: { opacity: 0.72 },
  pauseText: { color: '#e5d9c4', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  message: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: OUTSIDE_COLOR, padding: 24 },
  messageText: { color: '#c1a6a4', fontSize: 13, textAlign: 'center' },
});
