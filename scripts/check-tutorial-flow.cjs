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
const saved=new Map();
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
  await act(async () => renderer.updateContainer(React.createElement(Application),root,null));
  const store=req('./src/ui/TutorialStorage.ts');
  await press('Comenzar partida');assert.equal(pathname,'/tutorial');button('Comenzar');button('Saltar');
  assert.equal(find(n=>n.type==='GameProbe'),undefined,'An offer does not create a game or consume advantages');
  await press('Saltar');assert.equal(pathname,'/difficulty');assert.equal((await store.loadTutorialProgress()).skipped,true);assert.equal((await store.loadTutorialProgress()).completed,false);
  await press('Volver al menú');await press('Comenzar partida');assert.equal(pathname,'/difficulty','First-run offer is not repeated after skip');await press('Volver al menú');
  await press('Ajustes');button('Repetir tutorial');await press('Repetir tutorial');assert.equal(pathname,'/tutorial');await press('Volver');assert.equal(pathname,'/settings','Offer returns to the menu that opened it');
  const scores=req('./src/ui/ScoreStorage.ts'),balance=req('./src/game/workshop.ts');await scores.loadScores();
  await act(async()=>{await scores.grantCreatorVisit('support');await scores.purchaseUpgrade('assault-boots');});
  const original=JSON.parse(JSON.stringify(scores.getScores()));assert.equal(original.economy.prepared.length,1);
  await press('Repetir tutorial');await press('Comenzar');assert.equal(pathname,'/tutorial');await completeDarkness('cover');await finishLoad('GameProbe');
  assert.equal(pathname,'/game');assert.equal(one('GameProbe').props.tutorial,true);assert.deepEqual(one('GameProbe').props.initialEquipment,[]);assert.equal(one('GameProbe').props.onPurgatorioClear,undefined);
  assert.equal(JSON.stringify(scores.getScores()),JSON.stringify(original),'Entering training never consumes preparation or grants currency');
  const first=gameId(),oldComplete=one('GameProbe').props.onTutorialComplete;
  await act(async()=>one('GameProbe').props.onPause());assert.equal(pathname,'/pause');paused(true);assert(!find(n=>n.props.testID==='pause-powerups'),'Practice pause never displays persistent-run powerups');await press('Ajustes');assert.equal(button('Repetir tutorial').props.disabled,true);await press('Volver');await press('Reanudar');assert.equal(gameId(),first);paused(false);
  await act(async()=>one('GameProbe').props.onTutorialComplete());await act(async()=>one('GameProbe').props.onTutorialComplete());assert.equal((await store.loadTutorialProgress()).completed,true);assert.equal((await store.loadTutorialProgress()).skipped,false);
  await act(async()=>one('GameProbe').props.onTutorialStartGame());assert.equal(pathname,'/game');assert.equal(one('GameProbe').props.tutorial,true,'Never turn a mounted training session into EquippedRun');
  await completeDarkness('cover');assert.equal(pathname,'/difficulty');assert.equal(find(n=>n.type==='GameProbe'),undefined);await finishLoad();
  assert.equal(JSON.stringify(scores.getScores()),JSON.stringify(original),'Tutorial completion changes only its independent storage key');
  await press('Difícil');await completeDarkness('cover');await finishLoad('GameProbe');assert.equal(one('GameProbe').props.tutorial,undefined);assert.equal(one('GameProbe').props.difficulty,'hard');assert.notEqual(gameId(),first);assert.deepEqual(one('GameProbe').props.initialEquipment,['assault-boots'],'Prepared workshop advantage is consumed only by the subsequent normal run');assert.equal(scores.getScores().economy.prepared.length,0);
  const snapshot=JSON.stringify(await store.loadTutorialProgress());await act(async()=>oldComplete());assert.equal(JSON.stringify(await store.loadTutorialProgress()),snapshot,'Stale training completion cannot mutate later sessions');
  await act(async()=>one('GameProbe').props.onPause());await press('Menú principal');await press('Abandonar partida');await completeDarkness('cover');await finishLoad();
  await press('Ajustes');await press('Repetir tutorial');await press('Comenzar');await completeDarkness('cover');await finishLoad('GameProbe');assert.equal(one('GameProbe').props.tutorial,true);
  const stale=one('GameProbe').props.onTutorialStartGame;await act(async()=>one('GameProbe').props.onExit());await completeDarkness('cover');await finishLoad();assert.equal(pathname,'/');await act(async()=>stale());assert.equal(pathname,'/','A stale training start cannot reopen gameplay after exit');
  await press('Comenzar partida');assert.equal(pathname,'/difficulty','Completed tutorial stays dismissed');
  await act(async()=>renderer.updateContainer(null,root,null));assert.equal(appListeners.size,0);assert.equal(backListeners.size,0);
  assert.equal(balance.WORKSHOP_BALANCE.slots,2);
  console.log('Tutorial entry passed: first offer, skip, repeat/settings return, practice equipment isolation, stable pause, completion persistence, clean normal start, early exit and stale callback guards. Native presentation mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;});
