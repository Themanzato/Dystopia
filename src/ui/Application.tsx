import { loadTutorialProgress, shouldOfferTutorial, markTutorialOffered, markTutorialSkipped, markTutorialCompleted } from './TutorialStorage';
import { consumePreparedAdvantages, useScoreReadiness } from './ScoreStorage';
import { createRunId } from '../game/scores';
import type { WorkshopId } from '../game/workshop';
import MenuPreparation from './MenuPreparation';
import { canSelectPurgatorio, SURVIVAL_SELECTION, type RunSelection, type SpecialEnemyId } from '../game/purgatorio';
import { getPurgatorioProgress, loadPurgatorioProgress, recordPurgatorioVictory } from './PurgatorioProgress';
import type { Difficulty } from '../game/difficulty';
import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CourtyardScreen from '../game/CourtyardScreen';
import MenuBackdrop from './MenuBackdrop';
import LoadingScreen from './LoadingScreen';
import DarknessTransition from './DarknessTransition';
import { chooseLoading, type LoadingSelection } from './loadingCatalog';
import { preloadLoadingImages } from './loadingImages';
import { preloadPixelFont } from './pixelFontAsset';
import { AudioProvider, useGameAudio } from './AudioProvider';
import { SessionContext } from './session';
import { UIArtProvider } from './PixelArt';
import { BattleAudio, BATTLE_AUDIO_TOTAL, type BattleAudioSnapshot, type BattleAudioEvents } from './BattleAudio';

type Stage = 'coverSource' | 'awaitVisual' | 'revealLoading' | 'loading';
type Load = { id: number; kind: 'menu' | 'game'; selection: LoadingSelection; stage: Stage;
  restart?: boolean; destination?: '/difficulty'; progress?:number; targetReady: boolean; visualReady: boolean; error: string | null };
const Game = memo(CourtyardScreen);
const EMPTY_BATTLE_EVENTS: BattleAudioEvents = {attack:0,dash:0,damage:0,kill:0,pickup:0,level:0,chest:0,wave:0,boss:0,bossAttack:0,bossIntro:0,death:0,shipAlarm:0,zoneReward:0,bossHit:0,bossPhase:0,bossBeep:0};
function EquippedRun({attempt=0,...props}: React.ComponentProps<typeof Game> & {attempt?:number} = {}) {
  const [startId] = useState(createRunId);
  const [equipment,setEquipment] = useState<WorkshopId[] | null>(null);
  const onError=props.onError;
  useEffect(()=>{
    let alive=true;
    void consumePreparedAdvantages(startId,props.difficulty ?? 'easy').then(items=>{if(alive)setEquipment(items);}).catch(()=>{if(alive)onError?.('No se pudieron preparar las ventajas. Regresa al menú y reintenta.');});
    return()=>{alive=false;};
  },[startId,props.difficulty,onError]);
  return equipment ? <Game key={attempt} {...props} initialEquipment={equipment} /> : null;
}
function GameHost({ runId, attempt, foreground, preparing, onRestart, resumeRequest,onProgress,paused, onPause, onReady, onError, onExit, onChangeDifficulty, difficulty, selection, tutorial, onTutorialComplete, onTutorialStartGame }: {
  runId:number; attempt:number; foreground:boolean; preparing:boolean; onRestart:()=>void;
  tutorial: boolean; onTutorialComplete: () => void; onTutorialStartGame: () => void;
  resumeRequest:number; onProgress:(completed:number,total:number)=>void;onChangeDifficulty: () => void; selection: RunSelection;
  difficulty: Difficulty; paused: boolean; onPause: () => void; onReady: () => void; onError: (message: string) => void; onExit: () => void;
}) {
  const epoch=useRef(attempt);useLayoutEffect(()=>{epoch.current=attempt;return()=>{epoch.current=-1;};},[attempt]);
  const [audioState,setAudioState]=useState<{attempt:number;value:BattleAudioSnapshot}|null>(null);
  const [audioProgress,setAudioProgress]=useState({attempt,completed:0,total:BATTLE_AUDIO_TOTAL});
  const publishAudio=useCallback((value:BattleAudioSnapshot)=>{if(epoch.current===attempt)setAudioState({attempt,value});},[attempt]);
  const preparedAudio=useCallback((completed:number,total:number)=>{if(epoch.current===attempt)setAudioProgress(old=>old.attempt===attempt&&old.completed===completed&&old.total===total?old:{attempt,completed,total});},[attempt]);
  const snapshot=audioState?.attempt===attempt?audioState.value:null;
  const preparation=audioProgress.attempt===attempt?audioProgress:{completed:0,total:BATTLE_AUDIO_TOTAL};
  const { ready, error } = useScoreReadiness();
  useEffect(() => { if (error && !tutorial) onError(error); }, [error, onError, tutorial]);
  const {playUi,initializationError,retryAudio}=useGameAudio();
  const audioAttempt=useRef(attempt);
  useLayoutEffect(()=>{if(audioAttempt.current!==attempt){audioAttempt.current=attempt;if(initializationError)retryAudio?.();}},[attempt,initializationError,retryAudio]);
  const pauseSound = useCallback(() => playUi('pause'), [playUi]);
  const recordIdentified = useCallback((id: SpecialEnemyId) => {
    if (!tutorial && (selection.mode === 'survival' || selection.encounter === 'infinite')) recordPurgatorioVictory(id);
  }, [tutorial, selection]);
  return <View style={{ flex: 1 }}>
    <BattleAudio sessionKey={attempt} preparationActive={foreground&&(preparing||!paused)} onPrepared={preparedAudio} onError={onError} active={!paused&&snapshot?.active===true} suspended={snapshot?.mode!=='playing'} dead={snapshot?.mode==='dead'} events={snapshot?.events??EMPTY_BATTLE_EVENTS}/>
    {tutorial ? <Game key={`tutorial-${attempt}`} externalAudioProgress={preparation} onAudioState={publishAudio} tutorial initialEquipment={[]} difficulty="easy" selection={SURVIVAL_SELECTION} resumeRequest={resumeRequest} onProgress={onProgress} paused={paused} onPause={onPause} onPausePressIn={pauseSound} onReady={onReady} onError={onError} onExit={onExit} onTutorialComplete={onTutorialComplete} onTutorialStartGame={onTutorialStartGame}/> : ready && <EquippedRun attempt={attempt} externalAudioProgress={preparation} onAudioState={publishAudio} resumeRequest={resumeRequest} onProgress={onProgress} key={runId} difficulty={difficulty} selection={selection} onPurgatorioClear={recordIdentified} onRetry={onRestart} onExit={onExit} onChangeDifficulty={onChangeDifficulty} paused={paused} onPause={onPause} onPausePressIn={pauseSound} onReady={onReady} onError={onError} />}
  </View>;
}
export default function Application() {
  return <MenuPreparation><PreparedApplication /></MenuPreparation>;
}
function PreparedApplication() {
  const path = usePathname();
  const [resumeRequest,setResumeRequest]=useState(0);
  const resumeQueued=useRef(false);
  const [playing, setPlaying] = useState(false);
  const [tutorial,setTutorial] = useState(false);
  const [tutorialId,setTutorialId] = useState(0);
  const tutorialEpoch = useRef(0);
  const tutorialReturn = useRef<'/difficulty' | '/settings'>('/difficulty');
  const entryBusy = useRef(false), mounted = useRef(true), pathRef = useRef(path);
  useLayoutEffect(() => { pathRef.current = path; }, [path]);
  useEffect(() => { mounted.current=true; void loadTutorialProgress(); return () => { mounted.current=false; }; }, []);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [selection, setSelection] = useState<RunSelection>(SURVIVAL_SELECTION);
  const [runId,setRunId]=useState(0),[attempt,setAttempt]=useState(0);
  useEffect(() => { void loadPurgatorioProgress(); }, []);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [loading, setLoading] = useState<Load | null>(null);
  const generation = useRef(1);
  const previous = useRef({ entityId: loading?.selection.entity.id ?? '', tipIndex: loading?.selection.tipIndex ?? -1 });
  const flow = useRef(loading);
  const pauseAfterLoading = useRef(false);
  const retrySelection = useRef<RunSelection | null>(null);
  const workshopReturn = useRef<'/' | '/difficulty' | '/purgatorio'>('/');
  useLayoutEffect(() => { flow.current = loading; }, [loading]);
  const beginLoading = useCallback((kind: Load['kind'], stage: Stage = 'coverSource', destination?: '/difficulty', restart=false) => {
    const selection = chooseLoading(previous.current);
    previous.current = { entityId: selection.entity.id, tipIndex: selection.tipIndex };
    const next: Load = { id: ++generation.current, kind, stage, selection, destination, restart, progress:0,targetReady: false, visualReady: false, error: null };
    flow.current = next;
    pauseAfterLoading.current = false;
    setLoading(next);
  }, []);
  const restart=useCallback(()=>{
    if(!playing||flow.current)return;
    beginLoading('game','awaitVisual',undefined,true);setRunId(id=>id+1);setAttempt(id=>id+1);router.replace('/game');
  },[playing,beginLoading]);
  const retryLoad=useCallback(()=>{
    if(!flow.current?.error||flow.current.kind!=='game')return;
    beginLoading('game','awaitVisual',undefined,true);setAttempt(id=>id+1);router.replace('/game');
  },[beginLoading]);
  const loadingSource = loading?.selection.entity.source;
  useEffect(() => {
    if (loadingSource === undefined) return;
    // Decode behind the outgoing screen/black curtain, never after its reveal.
    // Both loaders deduplicate requests, so the mounted card reuses this work.
    void preloadLoadingImages(loadingSource).catch(() => {});
    void preloadPixelFont().catch(() => {});
  }, [loadingSource]);
  const selectDifficulty = useCallback(() => {
    if (playing || flow.current || entryBusy.current) return;
    retrySelection.current = null; entryBusy.current = true;
    void loadTutorialProgress().then(progress => {
      if (!mounted.current || flow.current || pathRef.current !== path) return;
      if (shouldOfferTutorial(progress)) {
        tutorialReturn.current = '/difficulty'; void markTutorialOffered(); router.replace('/tutorial');
      } else router.replace('/difficulty');
    }).finally(() => { entryBusy.current = false; });
  }, [playing,path]);
  const openTutorial = useCallback(() => {
    if (playing || flow.current || entryBusy.current) return;
    tutorialReturn.current = '/settings'; router.replace('/tutorial');
  }, [playing]);
  const beginTutorial = useCallback(() => {
    if (playing || flow.current || pathRef.current !== '/tutorial') return;
    setTutorialId(++tutorialEpoch.current);
    void markTutorialOffered(); retrySelection.current = null;
    setTutorial(true); setSelection(SURVIVAL_SELECTION); beginLoading('game');
  }, [playing,beginLoading]);
  const skipTutorial = useCallback(() => {
    if (playing || flow.current || pathRef.current !== '/tutorial') return;
    void markTutorialSkipped(); router.replace(tutorialReturn.current);
  }, [playing]);
  const completeTutorial = useCallback(() => { if (mounted.current && tutorialEpoch.current === tutorialId && playing && tutorial && !flow.current) void markTutorialCompleted(); }, [tutorialId,playing,tutorial]);
  const tutorialStartGame = useCallback(() => {
    if (!playing || !tutorial || flow.current || tutorialEpoch.current !== tutorialId) return;
    tutorialEpoch.current++; retrySelection.current = null; beginLoading('menu','coverSource','/difficulty');
  }, [playing,tutorial,beginLoading,tutorialId]);
  const start = useCallback((selected: Difficulty = 'easy') => {
    if (playing || flow.current) return;
    setTutorial(false); setSelection(retrySelection.current ?? SURVIVAL_SELECTION);
    retrySelection.current = null;
    setDifficulty(selected);
    beginLoading('game');
  }, [playing, beginLoading]);
  const openWorkshop = useCallback(() => { if (!playing && !flow.current) { workshopReturn.current = path === '/difficulty' || path === '/purgatorio' ? path : '/'; router.replace('/workshop'); } }, [playing, path]);
  const openMissions = useCallback(() => { if (!playing && !flow.current) router.replace('/missions'); }, [playing]);
  const openScores = useCallback(() => { if (!playing && !flow.current) router.replace('/scores'); }, [playing]);
  const openPurgatorio = useCallback(() => { if (!playing && !flow.current) router.replace('/purgatorio'); }, [playing]);
  const selectModeDifficulty = useCallback((selected: Difficulty) => { if (!playing && !flow.current) setDifficulty(selected); }, [playing]);
  const startPurgatorio = useCallback((encounter: SpecialEnemyId | 'infinite') => {
    if (playing || flow.current || (encounter !== 'infinite' && !canSelectPurgatorio(encounter, getPurgatorioProgress()))) return;
    setTutorial(false); setSelection({ mode: 'purgatorio', encounter });
    beginLoading('game');
  }, [playing, beginLoading]);
  const abandon = useCallback(() => {
    const current = flow.current;
    if (current?.kind === 'menu') return;
    tutorialEpoch.current++; retrySelection.current = null;
    if (current && current.stage !== 'coverSource') {
      // Recovering a failed preparation already has an opaque loading surface.
      beginLoading('menu', 'awaitVisual'); setPlaying(false); setTutorial(false); router.replace('/');
    } else beginLoading('menu');
  }, [beginLoading]);
  const pause = useCallback(() => {
    resumeQueued.current=false;
    if (flow.current) { if (flow.current.kind === 'game') pauseAfterLoading.current = true; return; }
    router.replace('/pause');
  }, []);
  const resume = useCallback(() => { if (!flow.current&&playing&&path==='/pause'&&!resumeQueued.current) {resumeQueued.current=true;setResumeRequest(n=>n+1);router.replace('/game');} }, [playing,path]);
  const settings = useCallback(() => { if (!flow.current) router.replace('/settings'); }, []);
  const changeDifficulty = useCallback(() => {
    if (flow.current) return;
    retrySelection.current = selection;
    beginLoading('menu', 'coverSource', '/difficulty');
  }, [selection, beginLoading]);
  const closeSettings = useCallback(() => { if (flow.current) return; if (path === '/tutorial' && !playing) { router.replace(tutorialReturn.current === '/settings' ? '/settings' : '/'); return; } if (path === '/workshop' && !playing) { router.replace(workshopReturn.current); return; } if (!playing) retrySelection.current = null; router.replace(playing ? '/pause' : '/'); }, [playing, path]);
  const loadId = loading?.id;
  const stage = loading?.stage;
  const markMenuReady = useCallback(() => setLoading(current => current !== null && current.id === loadId && current.kind === 'menu' && !current.targetReady
    ? { ...current, targetReady: true, progress:1 } : current), [loadId]);
  const markGameProgress=useCallback((completed:number,total:number)=>setLoading(current=>current&&current.id===loadId&&current.kind==='game'?{...current,progress:Math.max(current.progress??0,Math.min(1,completed/Math.max(1,total)))}:current),[loadId]);
  const markGameReady = useCallback(() => setLoading(current => current !== null && current.id === loadId && current.kind === 'game' && !current.targetReady
    ? { ...current, targetReady: true, progress:1 } : current), [loadId]);
  const markVisualReady = useCallback(() => setLoading(current => current !== null && current.id === loadId && !current.visualReady
    ? { ...current, visualReady: true, stage: current.stage === 'awaitVisual' ? 'revealLoading' : current.stage } : current), [loadId]);
  const menuError = useCallback((message: string) => setLoading(current => current !== null && current.id === loadId && current.kind === 'menu'
    ? { ...current, error: message } : current), [loadId]);
  const gameError = useCallback((message: string) => setLoading(current => current !== null && current.id === loadId && current.kind === 'game'
    ? { ...current, error: message } : current), [loadId]);
  const finishLoading = useCallback(() => {
    const current = flow.current;
    if (!current || current.id !== loadId || current.stage !== 'loading' || !current.targetReady || !current.visualReady || current.error) return;
    flow.current = null;
    setLoading(null);
    if (current.kind === 'game' && pauseAfterLoading.current) router.replace('/pause');
    pauseAfterLoading.current = false;
  }, [loadId]);
  const transitionComplete = useCallback(() => {
    const current = flow.current;
    if (!current || current.id !== loadId || current.stage !== stage) return;
    if (stage === 'coverSource') {
      // The last cover frame is fully black before navigation or unmounting.
      setPlaying(current.kind === 'game');
      if (current.kind === 'menu') setTutorial(false);
      router.replace(current.kind === 'game' ? '/game' : current.destination ?? '/');
    }
    setLoading(latest => {
      if (!latest || latest.id !== loadId || latest.stage !== stage) return latest;
      switch (stage) {
        case 'coverSource': return { ...latest, stage: 'awaitVisual' };
        case 'revealLoading': return { ...latest, stage: 'loading' };
        default: return latest;
      }
    });
  }, [loadId, stage]);
  const dismissLoading = useCallback(() => {
    if (loading?.kind === 'game') abandon();
    else { flow.current = null; pauseAfterLoading.current = false; setLoading(null); }
  }, [loading?.kind, abandon]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active' && (flow.current?.kind === 'game' || playing && path === '/game')) pause();
    });
    return () => listener.remove();
  }, [path, playing, pause]);
  useEffect(() => {
    const current = flow.current;
    if (current && current.stage !== 'coverSource') {
      const target = current.kind === 'game' ? '/game' : current.destination ?? '/';
      if (path !== target) {
        if (current.kind === 'game' && path === '/pause') pauseAfterLoading.current = true;
        router.replace(target);
      }
    } else if (!playing && (path === '/game' || path === '/pause')) router.replace('/');
  }, [path, playing, loading]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (loading) return true;
      if (path === '/game') { pause(); return true; }
      if (path === '/pause') { resume(); return true; }
      if (path === '/settings' || path === '/difficulty' || path === '/purgatorio' || path === '/missions' || path === '/scores' || path === '/workshop' || path === '/tutorial') { closeSettings(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [path, loading, pause, resume, closeSettings]);
  const showCard = Boolean(loading && stage !== 'coverSource');
  const cardActive = active && (stage === 'revealLoading' || stage === 'loading');
  const darknessPhase = stage === 'coverSource' ? 'cover' : stage === 'revealLoading' ? 'reveal' : null;
  return <GestureHandlerRootView style={styles.root}><SafeAreaProvider>
    <StatusBar hidden />
    <AudioProvider menuActive={!playing} loadingActive={showCard} active={active}>
      <UIArtProvider><SessionContext.Provider value={{ playing, tutorial, openTutorial, beginTutorial, skipTutorial, difficulty, openWorkshop, openScores, openMissions, openPurgatorio, startPurgatorio, setDifficulty: selectModeDifficulty, start, selectDifficulty, abandon, pause, resume, settings, closeSettings }}>
        <View style={styles.root}>
          <View style={StyleSheet.absoluteFill} pointerEvents={loading ? 'none' : 'box-none'}>
            {playing ? <GameHost runId={runId} attempt={attempt} foreground={active} preparing={loading?.kind==='game'} onRestart={restart} tutorial={tutorial} onTutorialComplete={completeTutorial} onTutorialStartGame={tutorialStartGame} resumeRequest={resumeRequest} onProgress={markGameProgress} selection={selection} difficulty={difficulty} paused={Boolean(loading) || path !== '/game' || !active} onPause={pause} onReady={markGameReady} onError={gameError} onExit={abandon} onChangeDifficulty={changeDifficulty} />
              : <MenuBackdrop active={active && !loading} onReady={markMenuReady} onError={menuError} />}
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents={loading ? 'none' : 'box-none'}
            aria-hidden={Boolean(loading)} accessibilityElementsHidden={Boolean(loading)} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
            <Slot />
          </View>
          {loading && showCard && <LoadingScreen key={loading.id} selection={loading.selection} active={cardActive}
            minimumMs={loading.restart?0:undefined} onRetry={loading.kind==='game'?retryLoad:undefined}
            progress={loading.targetReady&&loading.visualReady?100:Math.min(99,Math.floor((loading.progress??0)*90+(loading.visualReady?10:0)))} presented={stage === 'loading'} ready={loading.targetReady && loading.visualReady && !loading.error} error={loading.error}
            onReady={markVisualReady} onExited={finishLoading} onDismiss={dismissLoading} />}
          {loading && stage === 'awaitVisual' && !loading.error && <View testID="loading-curtain" style={styles.curtain} />}
          {loading && darknessPhase && <DarknessTransition key={`${loading.id}-${stage}`} phase={darknessPhase}
            active={active} onComplete={transitionComplete} />}
        </View>
      </SessionContext.Provider></UIArtProvider>
    </AudioProvider>
  </SafeAreaProvider></GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030507' },
  curtain: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100, backgroundColor: '#030507' },
});
