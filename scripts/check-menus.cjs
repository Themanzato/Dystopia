/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript');
const React = req('react');
const Reconciler = req('react-reconciler');
// Reuse the existing renderer's persistence protocol without loading CanvasKit.
const { sksgHostConfig } = req('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
  };
}
Module._extensions['.png'] = (module, filename) => {
  assert.ok(fs.existsSync(filename), `Missing original image ${filename}`);
  module.exports = filename;
};
const appListeners = new Set(), backListeners = new Set(), routeListeners = new Set();
let pathname = '/', mounts = 0, unmounts = 0;
const uiSounds = [], openedLinks = [], preparations = [];
const saved=new Map([['@dystopia/tutorial/v1',JSON.stringify({version:1,offered:true,skipped:true,completed:false})]]);
let rejectLink = false;
const router = { replace(next) { pathname = next; for (const listener of routeListeners) listener(); } };
const subscribeRoute = listener => { routeListeners.add(listener); return () => routeListeners.delete(listener); };
const usePathname = () => React.useSyncExternalStore(subscribeRoute, () => pathname, () => pathname);
const AudioContext = React.createContext(null);
const AudioProvider = ({ children, menuActive, loadingActive, active }) => {
  const [settings, setSettings] = React.useState({ music: 0.45, effects: 0.65, muted: false });
  const value = {
    settings, error: null,
    updateSettings: patch => setSettings(previous => ({ ...previous, ...patch })),
    playUi: sound => uiSounds.push(sound || 'press'),
  };
  return React.createElement(AudioContext.Provider, { value },
    React.createElement('AudioProbe', { menuActive, loadingActive, active, settings }), children);
};
const GameProbe = ({ paused, onPause, onPausePressIn, onReady, onError, difficulty, selection, onPurgatorioClear, onRetry, onExit, onChangeDifficulty, tutorial, initialEquipment, onTutorialComplete, onTutorialStartGame }) => {
  const [sessionId] = React.useState(() => ++mounts);
  React.useEffect(() => () => { unmounts++; }, []);
  return React.createElement('GameProbe', { paused, onPause, onPausePressIn, onReady, onError, difficulty, selection, onPurgatorioClear, onRetry, onExit, onChangeDifficulty, sessionId, tutorial, initialEquipment, onTutorialComplete, onTutorialStartGame });
};
const native = {
  AppState: { currentState: 'active', addEventListener: (_event, callback) => {
    appListeners.add(callback); return { remove: () => appListeners.delete(callback) };
  } },
  BackHandler: { addEventListener: (_event, callback) => {
    backListeners.add(callback); return { remove: () => backListeners.delete(callback) };
  } },
  Linking: { _validateURL(url) { assert.ok(url.startsWith('https://')); }, async openURL(url) { this._validateURL(url); openedLinks.push(url); if (rejectLink) throw new Error('Browser unavailable'); } },
  StyleSheet: { create: styles => styles, absoluteFill: {} },
  Image:'Image',Platform:{OS:'test'}, View: 'View', Text: 'Text', Pressable: 'Pressable', Switch: 'Switch', ScrollView: 'ScrollView',
  useWindowDimensions: () => ({ width: 844, height: 390 }),
};
let Menus, DifficultyMenu, PurgatorioMenu, ScoreMenu, WorkshopMenu, TutorialOffer;
function Slot() {
  const current = usePathname();
  const Screen = ({ '/': Menus.MainMenu, '/pause': Menus.PauseMenu, '/settings': Menus.SettingsMenu, '/difficulty': DifficultyMenu, '/purgatorio': PurgatorioMenu, '/scores': ScoreMenu, '/workshop': WorkshopMenu, '/tutorial': TutorialOffer })[current];
  return Screen ? React.createElement(Screen) : null;
}
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === '@react-native-async-storage/async-storage') return {__esModule:true,default:{getItem:async key=>saved.get(key)??null,setItem:async(key,value)=>{saved.set(key,value)}}};
  if (name === './PixelText' && /(?:Menus|DifficultyMenu|PurgatorioMenu|PausePowerups|ScoreMenu|MenuEconomy|EquipmentPreview|WorkshopMenu|TutorialOffer)\.tsx$/.test(parent?.filename||'')) return { __esModule: true, default: props => React.createElement('PixelProbe', props) };
  if (name === './UpgradeIcon') return {__esModule:true,default:props=>React.createElement('UpgradeIconProbe',props)};
  if (name === './PurgatorioPortrait') return {__esModule:true,default:props=>React.createElement('PortraitProbe',props)};
  if (name === './ControlSettingsPanel') return { __esModule: true, default: props => React.createElement('ControlSettingsProbe', props) };
  if (name === './ControlVisual') return { ControlLayoutIcon: props => React.createElement('ControlLayoutIconProbe', props) };
  if (name === './MenuMotion') return { MenuButtonMotion: ({ children }) => children, useMenuMotionTime: () => ({ value: 0 }) };
  if (name === './InfectedTitle') return { __esModule: true, default: () => React.createElement('TitleProbe') };
  if (name === 'react-native-reanimated') return {useAnimatedReaction:()=>{}};
  if (name === 'react-native-worklets') return {scheduleOnRN:fn=>fn()};
  if (name === 'react-native') return native;
  if (name === 'expo-router') return { Slot, router, usePathname };
  if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureRoot' };
  if (name === 'react-native-safe-area-context') return {
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
  if (parent?.filename.endsWith('Application.tsx')) {
    if (name === './MenuPreparation') return { __esModule: true, default: ({ children }) => children };
    if (name === '../game/CourtyardScreen') return { __esModule: true, default: GameProbe };
    if (name === './MenuBackdrop') return { __esModule: true, default: props => React.createElement('BackdropProbe', props) };
    if (name === './LoadingScreen') return { __esModule: true, default: props => React.createElement('LoadingProbe', props) };
    if (name === './DarknessTransition') return { __esModule: true, default: props => React.createElement('DarknessProbe', props) };
    if (name === './loadingImages') return { preloadLoadingImages: async source => { preparations.push({ kind: 'images', source, pathname }); } };
    if (name === './pixelFontAsset') return { preloadPixelFont: async () => { preparations.push({ kind: 'font', pathname }); } };
  }
  if (name === './PixelArt' && /(?:Application|Menus|DifficultyMenu|PurgatorioMenu|PausePowerups|ScoreMenu|MenuEconomy|EquipmentPreview|WorkshopMenu|TutorialOffer)\.tsx$/.test(parent?.filename || '')) {
    return {
      UIArtProvider: ({ children }) => children,
      UIFrame: ({ children, ...props }) => React.createElement('UIFrameProbe', props, children),
      UIWord: props => React.createElement('UIWordProbe', props),
      UIIcon: props => React.createElement('UIIconProbe', props),
      UIOrnament: props => React.createElement('UIOrnamentProbe', props),
      UISliderArt: props => React.createElement('UISliderProbe', props),
    };
  }
  if (name === './AudioProvider' && /(?:Application|Menus|DifficultyMenu|PurgatorioMenu|PausePowerups|ScoreMenu|MenuEconomy|EquipmentPreview|WorkshopMenu|TutorialOffer)\.tsx$/.test(parent?.filename || '')) {
    return { AudioProvider, useGameAudio: () => React.useContext(AudioContext) };
  }
  return originalLoad.call(this, name, parent, main);
};
const Application = req('./src/ui/Application.tsx').default;
Menus = req('./src/ui/Menus.tsx');
TutorialOffer = req('./src/ui/TutorialOffer.tsx').default;
ScoreMenu = req('./src/ui/ScoreMenu.tsx').default;
WorkshopMenu = req('./src/ui/WorkshopMenu.tsx').default;
DifficultyMenu = req('./src/ui/DifficultyMenu.tsx').default;
PurgatorioMenu = req('./src/ui/PurgatorioMenu.tsx').default;
const { CREATOR_LINKS, openCreatorLink } = req('./src/ui/links.ts');
const container = { root: [], redraw() {} };
const renderer = Reconciler({
  ...sksgHostConfig,
  createTextInstance: text => ({ type: '#text', props: { text }, children: [] }),
});
const root = renderer.createContainer(container, 0, null, false, null, '', error => { throw error; }, null);
function find(predicate, nodes = container.root) {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const result = find(predicate, node.children);
    if (result) return result;
  }
}
function one(type) {
  const match = find(node => node.type === type);
  assert(match, `Missing ${type}`);
  return match;
}
function button(label) {
  const match = find(node => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  assert(match, `Missing button: ${label}`);
  return match;
}
const press = async label => { await act(async () => { const props = button(label).props; props.onPressIn?.(); props.onPress(); }); };
const setAppState = async state => { await act(async () => { for (const listener of [...appListeners]) listener(state); }); };
const back = async () => { await act(async () => { for (const listener of [...backListeners]) assert.equal(listener(), true); }); };
const gameId = () => one('GameProbe').props.sessionId;
const paused = value => assert.equal(one('GameProbe').props.paused, value);
const loading = () => one('LoadingProbe').props;
const noLoading = () => assert.equal(find(node => node.type === 'LoadingProbe'), undefined, 'Navigation within a prepared session must not reload assets');
const noDarkness = () => assert.equal(find(node => node.type === 'DarknessProbe'), undefined);
async function completeDarkness(phase) {
  const probe = one('DarknessProbe').props;
  assert.equal(probe.phase, phase, `Expected ${phase} darkness phase`);
  await act(async () => probe.onComplete());
  return probe;
}
async function presentLoad() {
  await act(async () => loading().onReady());
  assert.equal(loading().presented, false, 'The loading timer waits until its reveal finishes');
  await completeDarkness('reveal');
  assert.equal(loading().presented, true);
  assert.equal(loading().active, true);
  noDarkness();
}
async function leavePreparedLoad() {
  await act(async () => loading().onExited());
  noLoading(); noDarkness();
  assert.equal(one('AudioProbe').props.loadingActive, false, 'Prepared destinations open without another fade or loading track');
}
async function finishLoad(target = 'BackdropProbe') {
  await act(async () => one(target).props.onReady());
  await presentLoad();
  assert.equal(loading().ready, true, 'Destination and featured-art readiness are both required');
  await leavePreparedLoad();
}
(async () => {
  await act(async () => { renderer.updateContainer(React.createElement(Application), root, null); });
  noLoading(); noDarkness();
  assert.equal(preparations.length, 0, 'Cold launch goes directly to menu without loading cards');
  button('Comenzar partida'); button('Ajustes');
  assert(find(node => node.type === 'UIWordProbe' && node.props.word === 'start'), 'Main menu uses the original START sprite');
  assert(find(node => node.type === 'UIWordProbe' && node.props.word === 'settings'), 'Settings action uses the original SETTINGS sprite');
  assert(find(node => node.type === 'UIFrameProbe'), 'Original art frames wrap interactive menu content');
  assert(find(node => node.type === 'BackdropProbe'));
  assert.equal(find(node => node.type === 'GameProbe'), undefined);
  assert.equal(one('AudioProbe').props.menuActive, true);

  const initialSounds = uiSounds.length;
  await act(async () => button('Ajustes').props.onPressIn());
  assert.equal(uiSounds.length, initialSounds + 1, 'Click audio fires on touch down');
  assert.equal(pathname, '/', 'Touch down does not activate navigation');
  noLoading(); noDarkness();
  await act(async () => button('Ajustes').props.onPress());
  assert.equal(uiSounds.length, initialSounds + 1, 'Release does not play a second click');
  assert.equal(pathname, '/settings');
  noLoading(); noDarkness();
  button('Apoya a un creador'); button('Sobre el creador');
  await press('Configurar controles');
  one('ControlSettingsProbe'); noLoading(); noDarkness();
  await act(async () => one('ControlSettingsProbe').props.onBack());
  await press('Bajar Música');
  assert.equal(one('AudioProbe').props.settings.music, 0.4);
  await press('Efectos al 80%');
  assert.equal(one('AudioProbe').props.settings.effects, 0.8);
  const muteButton = button('Silenciar todo');
  assert.equal(muteButton.props.accessibilityRole, 'switch');
  assert.equal(muteButton.props.accessibilityState.checked, false);
  await press('Silenciar todo');
  assert.equal(button('Silenciar todo').props.accessibilityState.checked, true);
  assert.equal(one('AudioProbe').props.settings.muted, true);
  await press('Volver');
  assert.equal(pathname, '/', 'Settings opened from main returns to main');

  await press('Taller');assert.equal(pathname,'/workshop');noLoading();noDarkness();
  await press('Comprar Botiquín de campaña');assert(find(n=>n.props?.text==='Faltan 150 Celdas.'));
  await press('Volver del Taller');assert.equal(pathname,'/');
  await press('Récords');assert.equal(pathname,'/scores');noLoading();noDarkness();
  for(const i of [1,2,3])assert(find(n=>n.props?.testID==='score-empty-'+i));
  const {saveRunResult}=req('./src/ui/ScoreStorage.ts'),scoreApi=req('./src/game/scores.ts'),sim=req('./src/game/survival.ts');
  function finishRecord(id,n,mode='survival'){const state=sim.createSurvival();state.stats.npcKills=n;state.mode='dead';return {...scoreApi.finalRunResult(state,id,'2026-10-24T12:00:00.000Z'),mode};}
  await act(async()=>saveRunResult(finishRecord('menu-1',3)));assert(find(n=>n.props?.testID==='score-slot-1'));assert(find(n=>n.props?.testID==='score-empty-2'));
  await act(async()=>saveRunResult(finishRecord('menu-2',5)));assert(find(n=>n.props?.testID==='score-slot-2'));assert(find(n=>n.props?.testID==='score-empty-3'));
  for(let i=1;i<=4;i++)await act(async()=>saveRunResult(finishRecord('menu-inf-'+i,i,'purgatorio-infinite')));
  await press('Purgatorio Infinito');for(const i of [1,2,3])assert(find(n=>n.props?.testID==='score-slot-'+i));
  assert(!find(n=>n.props?.accessibilityRole==='tab'&&n.props?.accessibilityLabel==='Purgatorio individual'),'Individual records remain stored but are hidden from the public ranking');
  await back();assert.equal(pathname,'/');
  await press('Comenzar partida');
  assert.equal(pathname, '/difficulty'); noLoading(); noDarkness();
  button('Fácil'); button('Difícil'); button('Dystopia');
  await press('Volver al menú'); assert.equal(pathname, '/');
  await press('Comenzar partida'); await back(); assert.equal(pathname, '/');
  await press('Comenzar partida'); await press('Difícil');
  assert.equal(pathname, '/difficulty', 'The source menu remains mounted until darkness fully covers it');
  const preparedGame = preparations.filter(item => item.kind === 'images').at(-1);
  assert.equal(preparations.filter(item => item.kind === 'images').length, 1, 'Selected creature/banner preload starts during coverSource');
  assert.equal(preparedGame.pathname, '/difficulty', 'Art starts decoding before routing away from the menu');
  assert.equal(preparations.filter(item => item.kind === 'font').length, 1, 'UI font preparation starts alongside the selected sprite');
  assert.equal(find(node => node.type === 'GameProbe'), undefined);
  assert.equal(one('DarknessProbe').props.phase, 'cover');
  const oldSourceCover = await completeDarkness('cover');
  assert.equal(pathname, '/game'); paused(true);
  assert.equal(one('GameProbe').props.difficulty, 'hard', 'Selected mode reaches the actual playable host');
  const firstGameLoad = loading();
  assert.equal(firstGameLoad.selection.entity.source, preparedGame.source, 'The mounted card reuses the source selected before navigation');
  assert.equal(firstGameLoad.presented, false);

  await act(async () => oldSourceCover.onComplete());
  assert.equal(loading().selection, firstGameLoad.selection, 'Old loading and cover callbacks cannot advance a new stage');
  noDarkness();
  await act(async () => one('GameProbe').props.onReady());
  assert.equal(loading().ready, false, 'Game readiness still waits for its featured sprite and text assets');
  await presentLoad();
  assert.equal(loading().ready, true); paused(true);
  await back();
  assert.equal(pathname, '/game'); paused(true);
  assert.equal(loading().presented, true, 'Hardware back cannot expose gameplay during loading');
  await setAppState('background');
  assert.equal(pathname,'/game','Background during preparation cannot expose the loading card over pause');
  await setAppState('active');
  const oldGameExit = loading().onExited;
  await leavePreparedLoad();
  assert.equal(pathname,'/pause','Pause requested while loading is deferred until the loading overlay unmounts');
  noLoading(); noDarkness();
  await press('Reanudar');
  paused(false);
  assert.equal(one('AudioProbe').props.menuActive, false);
  assert.equal(one('AudioProbe').props.settings.muted, true, 'Audio preferences survive starting a session');
  assert.equal(find(node => node.type === 'BackdropProbe'), undefined);
  const firstSession = gameId();
  const oldGameReady = one('GameProbe').props.onReady;
  await act(async () => { const props = one('GameProbe').props; props.onPausePressIn(); props.onPause(); });
  assert.equal(pathname, '/pause'); paused(true);
  noLoading(); noDarkness();
  assert.equal(gameId(), firstSession);
  button('Reanudar'); button('Menú principal');
  assert(uiSounds.includes('pause'), 'The game pause action emits its dedicated UI sound');

  await press('Ajustes');
  assert.equal(pathname, '/settings'); paused(true);
  noLoading(); noDarkness();
  assert.equal(button('Silenciar todo').props.accessibilityState.checked, true, 'The art switch keeps mute state when opened from pause');
  assert(find(node => node.type === 'UISliderProbe' && node.props.value === 0.4 && node.props.muted), 'The original slider art receives the current volume and mute state');
  assert.equal(gameId(), firstSession);
  await press('Apoya a un creador');
  await press('Sobre el creador');
  assert.deepEqual(openedLinks, [
    'https://buymeacoffee.com/manzato',
    'https://portfolio-two-gamma-if8rur9x6r.vercel.app/',
  ], 'Both creator buttons use external Linking with the exact URLs');
  await setAppState('background'); paused(true);
  assert.equal(one('AudioProbe').props.active, false);
  await setAppState('active');
  assert.equal(pathname, '/settings'); paused(true);
  assert.equal(gameId(), firstSession, 'Returning from browser preserves the paused session');
  rejectLink = true;
  await press('Sobre el creador');
  const alert = find(node => node.type === 'View' && node.props.accessibilityRole === 'alert');
  assert(alert, 'An external browser failure is shown to the player');
  assert(alert.children.some(node => node.props.text?.includes('No se pudo abrir el navegador')));
  rejectLink = false;
  await press('Volver');
  assert.equal(pathname, '/pause'); paused(true);

  await press('Menú principal');
  assert.equal(pathname, '/pause'); paused(true);
  assert.equal(gameId(), firstSession, 'Requesting abandonment preserves the session until confirmation');
  button('Abandonar partida');
  await press('Seguir en pausa');
  assert.equal(gameId(), firstSession); paused(true);
  button('Reanudar');
  await press('Reanudar');
  assert.equal(pathname, '/game'); paused(false);
  assert.equal(gameId(), firstSession);
  assert(uiSounds.includes('resume'));

  await setAppState('background');
  assert.equal(pathname, '/pause', 'An interruption automatically opens pause'); paused(true);
  await setAppState('active');
  assert.equal(pathname, '/pause', 'Foregrounding requires an explicit resume'); paused(true);
  assert.equal(gameId(), firstSession);
  await back();
  assert.equal(pathname, '/game'); paused(false);
  await back();
  assert.equal(pathname, '/pause'); paused(true);
  await press('Ajustes');
  await back();
  assert.equal(pathname, '/pause'); paused(true);
  await press('Menú principal');
  await press('Abandonar partida');
  assert.equal(pathname, '/pause', 'Returning to menu waits for darkness before switching destinations');
  const preparedReturn = preparations.filter(item => item.kind === 'images').at(-1);
  assert.equal(preparations.filter(item => item.kind === 'images').length, 2);
  assert.equal(preparedReturn.pathname, '/pause', 'Menu-return art also preloads beneath the outgoing paused game');
  assert.equal(gameId(), firstSession, 'The source session survives the cover animation');
  paused(true);
  assert.equal(unmounts, 0);
  await completeDarkness('cover');
  assert.equal(pathname, '/');
  assert.equal(find(node => node.type === 'GameProbe'), undefined);
  assert.equal(unmounts, 1, 'Confirmed abandonment unmounts the session only beneath opaque darkness');
  const returnLoad = loading();
  assert.equal(returnLoad.selection.entity.source, preparedReturn.source);
  await act(async () => returnLoad.onReady());
  await act(async () => oldGameReady());
  assert.equal(loading().ready, false, 'Discarded game readiness cannot prepare the new menu');
  await act(async () => oldGameExit());
  assert.equal(loading().selection, returnLoad.selection, 'A stale game exit cannot close a newly mounted menu load');
  assert.equal(one('DarknessProbe').props.phase, 'reveal');
  await completeDarkness('reveal');
  await act(async () => one('BackdropProbe').props.onReady());
  assert.equal(loading().ready, true);
  await leavePreparedLoad();
  await press('Comenzar partida'); await press('Fácil');
  assert.equal(pathname, '/difficulty');
  await completeDarkness('cover');
  assert.notEqual(gameId(), firstSession, 'A new session receives fresh state after abandonment');
  assert.equal(mounts, 2, 'Pause, settings and browser returns never remount gameplay');
  paused(true);
  await act(async () => loading().onReady());
  await act(async () => oldGameReady());
  assert.equal(loading().ready, false, 'An old session cannot mark the next game session ready');
  await completeDarkness('reveal');
  await act(async () => one('GameProbe').props.onError('No se pudo cargar el recurso de prueba.'));
  assert.match(loading().error, /recurso de prueba/);
  assert.equal(loading().ready, false, 'An asset failure cannot expose a broken playable scene');
  assert.equal(typeof loading().onDismiss, 'function', 'Loading errors always offer recovery');
  await act(async () => loading().onDismiss());
  assert.equal(pathname, '/');
  assert.equal(find(node => node.type === 'GameProbe'), undefined, 'Dismissing a failed game load returns safely beneath black');
  assert.equal(unmounts, 2);
  assert.equal(loading().presented, false);
  noDarkness();
  await finishLoad();
  button('Comenzar partida'); button('Ajustes');

  // Real Session methods guard locked selection, preserve difficulty through a
  // fresh retry, persist only ordered victories, and route the infinite chain.
  await press('Purgatorio');assert.equal(pathname,'/purgatorio');noLoading();noDarkness();
  const {PURGATORIO_ROSTER:R,purgatorioName}=req('./src/game/purgatorio.ts');const D=req('./src/game/enemyCatalog.ts').ENEMY_DEFS;
  for(let i=0;i<R.length;i++){const b=button(purgatorioName(R[i])+(i?', bloqueado':''));assert.equal(b.props.disabled,i>0);}
  assert.equal(R.length,13); assert(!find(n=>n.props.testID==='purgatorio-archer-bandit'));
  assert(find(n=>n.props.testID==='bandit-pair-preview'),'One card previews both original bandits');
  for(const id of ['dagger-bandit','archer-bandit']) assert(find(n=>n.type==='PortraitProbe'&&n.props.id===id));
  await press('Dystopia');assert.equal(button('Dystopia').props.accessibilityState.selected,true);
  await act(async()=>button(D[R[1]].name+', bloqueado').props.onPress());noLoading();assert.equal(pathname,'/purgatorio');
  await back();assert.equal(pathname,'/');noLoading();await press('Purgatorio');
  await press(D[R[0]].name);await completeDarkness('cover');await finishLoad('GameProbe');paused(false);
  assert.equal(one('GameProbe').props.selection.mode,'purgatorio');assert.equal(one('GameProbe').props.selection.encounter,R[0]);assert.equal(one('GameProbe').props.difficulty,'dystopia');
  await act(async()=>one('GameProbe').props.onPurgatorioClear(R[0]));assert(saved.get('@dystopia/purgatorio/v1').includes(R[0]));
  await act(async()=>one('GameProbe').props.onChangeDifficulty());
  await completeDarkness('cover'); assert.equal(pathname,'/difficulty');
  await finishLoad(); noLoading(); noDarkness();
  await press('Difícil'); await completeDarkness('cover'); await finishLoad('GameProbe');
  assert.equal(one('GameProbe').props.selection.encounter,R[0],'Changing difficulty retries the same Purgatorio encounter');
  assert.equal(one('GameProbe').props.difficulty,'hard');
  const priorId=gameId();await act(async()=>one('GameProbe').props.onRetry());assert.notEqual(gameId(),priorId);assert.equal(one('GameProbe').props.selection.encounter,R[0]);assert.equal(one('GameProbe').props.difficulty,'hard');
  await act(async()=>one('GameProbe').props.onExit());await completeDarkness('cover');await finishLoad();await press('Purgatorio');
  assert.equal(button(D[R[1]].name).props.disabled,false);assert.equal(button(D[R[2]].name+', bloqueado').props.disabled,true);
  await press('Difícil');await press(D[R[1]].name);await completeDarkness('cover');await finishLoad('GameProbe');assert.equal(one('GameProbe').props.selection.encounter,R[1]);assert.equal(one('GameProbe').props.difficulty,'hard');
  await act(async()=>one('GameProbe').props.onExit());await completeDarkness('cover');await finishLoad();await press('Purgatorio');await press('Infinito');await completeDarkness('cover');await finishLoad('GameProbe');assert.equal(one('GameProbe').props.selection.encounter,'infinite');assert.equal(one('GameProbe').props.difficulty,'hard');

  await act(async () => renderer.updateContainer(null, root, null));
  assert.equal(appListeners.size, 0); assert.equal(backListeners.size, 0);

  const { PowerupGrid } = req('./src/ui/PausePowerups.tsx');
  const powers=[{id:'speed',name:'Paso ligero',value:'+24%',stacks:3},{id:'rhythm',name:'Ritmo de acero',value:'+16%',stacks:2}];
  let infoOpen=false;
  const grid=token=>React.createElement(PowerupGrid,{items:powers,dismissToken:token,onInfoOpenChange:open=>{infoOpen=open;}});
  await act(async()=>renderer.updateContainer(grid(0),root,null));
  const byTest=id=>find(n=>n.props.testID===id);
  await act(async()=>byTest('powerup-speed').props.onPress());assert(infoOpen);assert(byTest('powerup-info'));
  assert(find(n=>n.type==='PixelProbe'&&n.props.text==='+24% / x3'));
  await act(async()=>byTest('powerup-rhythm').props.onPress());assert(find(n=>n.type==='PixelProbe'&&n.props.text==='Ritmo de acero'));assert(!find(n=>n.type==='PixelProbe'&&n.props.text==='Paso ligero'));
  await act(async()=>byTest('pause-powerups').props.onPress());assert(!infoOpen);assert(!byTest('powerup-info'));
  await act(async()=>byTest('powerup-speed').props.onPress());await act(async()=>renderer.updateContainer(grid(1),root,null));assert(!infoOpen);
  await act(async()=>renderer.updateContainer(null,root,null));
  console.log('Powerup details passed: selection, effective value/stacks, separate effects, outside dismissal and parent dismissal.');
  const calls = [], errors = [];
  for (const destination of ['support', 'about']) {
    assert.equal(await openCreatorLink(destination, async url => { calls.push(url); }, message => errors.push(message)), true);
    assert.equal(calls.at(-1), CREATOR_LINKS[destination]);
  }
  assert.equal(errors.length, 0);
  assert.equal(await openCreatorLink('support', async () => { throw new Error('Offline'); }, message => errors.push(message)), false);
  assert.equal(errors.length, 1, 'A failed launch reports exactly one actionable error');
  assert(errors[0].includes('No se pudo abrir el navegador'));
  console.log('Menu integration passed: loading-only source fade, immediate prepared destination, touch-down audio, visual-ready entrance, loading stage guards, frozen gameplay through reveal, stale callback protection, recovery, stable pause/settings/browser sessions, abandonment confirmation, audio settings, hardware back and external links. Native browser/audio and presentation duration are mocked.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });
