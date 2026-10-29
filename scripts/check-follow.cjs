/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript');
const react = req('react');
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
  };
}
const playerApi = req('./src/game/player.ts');
const cameraApi = req('./src/game/camera.ts');
const encounterApi = req('./src/game/encounter.ts');
const survivalApi = req('./src/game/survival.ts');
const navigationApi = req('./src/game/navigation.ts');
const state = [], shared = [], effects = [], frames = [];
const refs=[];let refIndex=0;const draws=[];
global.requestAnimationFrame=fn=>{draws.push(fn);return draws.length;};global.cancelAnimationFrame=()=>{};
let stateIndex = 0, sharedIndex = 0, effectIndex = 0, frameIndex = 0, stateWrites = 0;
let queuedEffects = [], appStateListener;
const calls = { player: 0, encounter: 0, navigation: 0 };
const ActorsScene = () => null;
const TouchControls = () => null;
let skiaMock = { Canvas: 'Canvas', Fill: 'Fill', Group: 'SkiaGroup' };
const hooks = {
  useRef(initial){return refs[refIndex++]??={current:initial};},
  useState(initial) {
    const index = stateIndex++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => { stateWrites++; state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  },
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useEffect(fn, dependencies) {
    const index = effectIndex++;
    const previous = effects[index];
    if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous.dependencies[i]))) {
      queuedEffects.push(() => {
        previous?.cleanup?.();
        effects[index] = { dependencies, cleanup: fn() };
      });
    }
  },
};
const original = Module._load;
Module._load = function(name, parent, main) {
  if(name==='../ui/sharedImages'&&parent?.filename.endsWith('Scene.tsx'))return {useSharedImage:(...args)=>skiaMock.useImage(...args)};
  if (name === './sharedImages' && parent?.filename.endsWith('MenuBackdrop.tsx')) return { useSharedImage: (...args) => skiaMock.useImage(...args) };
  if (name === 'react') return { ...react, ...hooks };
  if (name === 'react-native') return {
    AppState: { currentState: 'active', addEventListener: (_name, callback) => {
      appStateListener = callback;
      return { remove() { appStateListener = undefined; } };
    } },
    StyleSheet: { create: value => value, absoluteFill: {} }, Text: 'Text', View: 'View', Pressable: 'PauseButton',
    useWindowDimensions: () => ({ width: 844, height: 390 }),
  };
  if (name === 'react-native-gesture-handler') return { GestureHandlerRootView: 'GestureRoot' };
  if (name === 'react-native-reanimated') return {
    useSharedValue(value) {
      const index = sharedIndex++;
      if (!shared[index]) shared[index] = { value, writes: 0, set(next) { this.value = next; this.writes++; } };
      return shared[index];
    },
    useDerivedValue: callback => ({ get value() { return callback(); } }),
    useFrameCallback(callback, autostart) {
      const index = frameIndex++;
      if (!frames[index]) frames[index] = { active: autostart, setActive(active) { this.active = active; } };
      frames[index].callback = callback;
      return frames[index];
    },
  };
  if (name === '@shopify/react-native-skia') return skiaMock;
  if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
  if (name === 'react-native-worklets') return { scheduleOnUI: (fn, ...args) => fn(...args) };
  if (parent?.filename.endsWith('MenuBackdrop.tsx') && name === './useMenuGyroscope') {
    return { useMenuGyroscope: () => ({ value: { x: 0, y: 0, receivedAtMs: 0 } }) };
  }
  if (parent?.filename.endsWith('CourtyardScreen.tsx')) {
    if(name==='../ui/BattleAudio')return {BATTLE_AUDIO_TOTAL:36};
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
    if (name === '../ui/ControlPreferences') return { useControlSettings: () => ({ settings: {} }) };
    if (name === '../ui/controlLayout') return { controlArea: () => ({ width: 844, height: 390 }) };
    if (name === './tutorialInstructions') return { tutorialMapTargets: () => [] };
    if (name === '../ui/TutorialHUD' || name === './TutorialEffects') return { __esModule: true, default: () => null };
    if (name === './tutorial') return { TUTORIAL_SPAWN: playerApi.PLAYER_SPAWN, constrainTutorialPlayer: (_before, after) => after, advanceTutorial() { throw new Error('A normal run must not advance the tutorial'); } };
    if(name==='../ui/MerchantPanel'||name==='./MerchantIndicator')return {__esModule:true,default:()=>null};
    if(name==='./merchantGameplay')return {advanceMerchants:s=>s};
    if (name === '../ui/PixelText') return {__esModule:true,default:()=>null};
    if (name === '../ui/GameUIOpacity') return {__esModule:true,default:({children})=>children};
    if (name === '../ui/useResumeCountdown') return {useResumeCountdown:()=>({number:null,start(){},cancel(){}})};
    if (name === '../ui/prepareGameInterface') return {prepareGameInterface:()=>({then(done){done();return {catch(){}};}})};
    if (name === './OptionalEventEffects') return {ReactorVision:()=>null,EliteMarkers:()=>null,OptionalEventHUD:()=>null};
    if (name === './FrenesisEffects' || name === './FrenesisMapInput') return {__esModule:true,default:()=>null};
    if (name === '../ui/PixelArt') return { UIFrame: 'UIFrame', UIIcon: 'UIIcon' };
    if (name === './ActorsScene') return { ActorsScene };
    if (name === './damageFeedback') return req('./src/game/damageFeedback.ts');
    if (name === '../ui/MissionBridge' || name === './BossOffscreenIndicators') return {__esModule:true,default:()=>null};
    if (name === './WorldEventEffects') return {WorldEventHUD:()=>null,WorldEventEffects:()=>null};
    if (name === './BattleEffects') return { BattleEffects: () => null };
    if (name === '../ui/SurvivalHUD') return { __esModule: true, default: () => null };
    if (name === './survival') return { ...survivalApi, advanceSurvival(...args) { calls.encounter++; return survivalApi.advanceSurvival(...args); } };
    if (name === './TouchControls') return { TouchControls };
    if (name === './player') return { ...playerApi, advancePlayer(...args) { calls.player++; return playerApi.advancePlayer(...args); } };
    if (name === './encounter') return { ...encounterApi, advanceEncounter(...args) { calls.encounter++; return encounterApi.advanceEncounter(...args); } };
    if (name === './navigation') return { ...navigationApi, buildFlowField(...args) { calls.navigation++; return navigationApi.buildFlowField(...args); } };
  }
  return original.call(this, name, parent, main);
};
const Screen = req('./src/game/CourtyardScreen.tsx').default;
function render(props = {}) {
  stateIndex = sharedIndex = effectIndex = frameIndex = refIndex = 0;
  queuedEffects = [];
  const tree = Screen(props);
  const canvas=find(tree,node=>node.type==='Canvas');if(canvas)canvas.props.ref.current={redraw(){},makeImageSnapshotAsync(){return {then(done){done({width:()=>1,height:()=>1,dispose(){}});return {catch(){}};}};}};
  for (const effect of queuedEffects) effect();
  return tree;
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (predicate(tree)) return tree;
  const children = Array.isArray(tree.props?.children) ? tree.props.children.flat(Infinity) : [tree.props?.children];
  for (const child of children) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
const byType = (tree, type) => {
  const match = find(tree, element => element.type === type);
  assert(match, 'Missing expected scene integration element');
  return match;
};
const close = (actual, expected) => assert(Math.abs(actual - expected) < 0.00001, actual + ' differs from ' + expected);
const tick = delta => { if (frames[0].active) frames[0].callback({ timeSincePreviousFrame: delta }); };
let readySignals = 0;
const loadErrors = [];
const readiness = { onReady: () => { readySignals++; }, onError: message => loadErrors.push(message) };
let tree = render(readiness);
assert.equal(readySignals, 0);
assert.equal(find(tree, element => element.type === 'Text'), undefined, 'The integrated loading overlay owns ordinary loading text');
assert.equal(find(tree, element => element.type === 'PauseButton'), undefined, 'Loading never shows an active pause control');
assert.equal(frames.length, 1, 'Player and encounters use one simulation callback');
assert.equal(frames[0].active, false, 'Simulation starts paused while assets load');
assert.equal(byType(tree, TouchControls).props.enabled, false);
byType(tree, ActorsScene).props.onReady();
tree = render(readiness);
assert.equal(readySignals, 0, 'Scenery alone cannot dismiss the real loading screen');
assert.equal(frames[0].active, false, 'Scenery alone must not enable simulation');
byType(tree, ActorsScene).props.onActorsReady();
tree = render(readiness);
assert.equal(readySignals,0,'Visual readiness alone waits for real audio task completion');
find(tree,node=>typeof node.props?.onAudioPrepared==='function').props.onAudioPrepared(15,15);
tree=render(readiness);
assert.equal(readySignals,0,'Resources alone cannot dismiss loading before the real HUD and first draw');
assert.equal(frames[0].active,false);
find(tree,node=>typeof node.props?.onPrepared==='function').props.onPrepared();
tree=render(readiness);assert.equal(readySignals,0,'HUD waits for real controls as well as Skia');
byType(tree,TouchControls).props.onPrepared();
tree=render(readiness);assert.equal(readySignals,0,'HUD and control images still wait for Skia draw acknowledgement');
while(draws.length)draws.shift()();
tree=render(readiness);
assert.equal(readySignals, 1, 'Complete scenery, actors, prepared HUD, audio and drawn scene announce readiness');
tree = render(readiness);
assert.equal(readySignals, 1, 'Stable readiness is not emitted on every render');
assert.equal(frames[0].active, true, 'Scenery, player and NPC assets unlock simulation');
assert.equal(byType(tree, TouchControls).props.enabled, true);
const player = byType(tree, ActorsScene).props.player;
const encounter = byType(tree, ActorsScene).props.encounter;
const input = byType(tree, TouchControls).props.input;
assert.equal(player, byType(tree, TouchControls).props.player);
assert.equal(shared.length, 9, 'Shared state owns the simulation and the synchronous resume gate');
const survival = shared[7];
assert.equal(encounter, shared[3]);
const field = shared[4], navigationTimer = shared[5];
assert.equal(field.value.targetCell, navigationApi.navigationCell(player.value));
const layout = byType(tree, 'View').props.onLayout;
const transform = byType(tree, 'SkiaGroup').props.transform;
let positionChecks = 0;
for (const [width, height] of [[844, 390], [640, 360], [390, 844], [1280, 720]]) {
  layout({ nativeEvent: { layout: { width, height } } });
  const bounds = cameraApi.getCameraBounds({ width, height });
  for (const position of [playerApi.createPlayer(), { x: 1536, y: 1536 }, { x: -100, y: -100 }, { x: 3172, y: 3172 }]) {
    player.set({ ...player.value, ...position });
    const expected = cameraApi.clampCamera(position, bounds);
    const current = transform.value;
    close(current[0].translateX, width / 2 - expected.x * bounds.scale);
    close(current[1].translateY, height / 2 - expected.y * bounds.scale);
    close(current[2].scale, cameraApi.cameraScale({ width, height }));
    close(player.value.x, position.x); close(player.value.y, position.y);
    positionChecks++;
  }
}
const previousTransform = JSON.stringify(transform.value);
layout({ nativeEvent: { layout: { width: 0, height: 0 } } });
assert.equal(JSON.stringify(transform.value), previousTransform);
player.set(playerApi.createPlayer());
input.set(playerApi.joystickInput(44, 0));
const beforeFrame = player.value, beforeEncounter = encounter.value;
const priorWrites = { player: player.writes, encounter: encounter.writes, state: stateWrites };
tick(null);
assert.equal(player.value, beforeFrame);
assert.equal(encounter.value, beforeEncounter);
assert.equal(calls.player, 0); assert.equal(calls.encounter, 0);
tick(1000 / 120);
assert(player.value.x > beforeFrame.x);
close(player.value.y, beforeFrame.y);
close(encounter.value.timerMs, beforeEncounter.timerMs - 1000 / 120);
assert.equal(calls.player, 1); assert.equal(calls.encounter, 1);
assert.equal(player.writes, priorWrites.player + 1, 'A frame must not double-update the player');
assert.equal(encounter.writes, priorWrites.encounter + 1, 'A frame must not double-update waves or collisions');
assert.equal(stateWrites, priorWrites.state, 'Simulation must not rebuild React state');
// A stalled callback advances both simulations by the same capped delta.
const beforeStall = encounter.value.timerMs;
tick(9000);
close(encounter.value.timerMs, beforeStall - 40);
assert.equal(calls.player, 2); assert.equal(calls.encounter, 2);
// The initial field is shared until the player changes cells and the bounded timer expires.
input.set(playerApi.REST_INPUT);
const initialFieldWrites = field.writes;
for (let i = 0; i < 9; i++) tick(40);
assert.equal(field.writes, initialFieldWrites, 'Resting in the same cell reuses the field');
input.set(playerApi.joystickInput(44, 0));
for (let i = 0; i < 9; i++) tick(40);
assert(field.writes > initialFieldWrites, 'Changing cells refreshes one shared field');
assert(navigationTimer.value >= 0 && navigationTimer.value < navigationApi.NAV_REFRESH_MS);
// A menu pause preserves the exact live state and blocks a callback that was
// already queued before React disabled the animation frame callback.
const normalCamera = JSON.stringify(transform.value);
survival.set({ ...survival.value, hp: 4, invulnerableMs: 1050 });
assert.notEqual(JSON.stringify(transform.value), normalCamera, 'Losing HP visibly shakes the world camera');
const damagedCamera = JSON.stringify(transform.value);
let pauseRequests = 0;
const onPause = () => pauseRequests++;
tree = render({ onPause });
byType(tree, TouchControls).props.onPause();
assert.equal(pauseRequests, 1, 'The in-game pause button delegates to the menu');
const menuPlayer = player.value, menuEncounter = encounter.value, menuField = field.value;
const menuTimer = navigationTimer.value;
const menuSurvival = survival.value;
tree = render({ paused: true, onPause });
assert.equal(frames[0].active, false);
assert.equal(byType(tree, TouchControls).props.enabled, false);
assert.equal(byType(tree, ActorsScene).props.active, false, 'Environmental animations pause with the simulation');
assert.equal(find(tree, element => element.type === 'PauseButton'), undefined, 'Paused overlays own interaction');
assert.deepEqual(input.value, playerApi.REST_INPUT);
frames[0].callback({ timeSincePreviousFrame: 9000 });
assert.equal(player.value, menuPlayer, 'A queued frame cannot move a paused player');
assert.equal(encounter.value, menuEncounter, 'Pause freezes NPC positions, actions, wave phase and timers');
assert.equal(survival.value, menuSurvival, 'Pause freezes projectiles, EXP, rewards, boss patterns and invulnerability');
assert.equal(JSON.stringify(transform.value), damagedCamera, 'Damage feedback also freezes during pause');
assert.equal(field.value, menuField);
assert.equal(navigationTimer.value, menuTimer);
// Opening an external link from pause must not resume when the app returns.
appStateListener('background');
tree = render({ paused: true, onPause });
appStateListener('active');
tree = render({ paused: true, onPause });
assert.equal(frames[0].active, false, 'Foregrounding preserves the explicit menu pause');
assert.equal(byType(tree, ActorsScene).props.active, false);
tree = render({ paused: false, onPause });
assert.equal(frames[0].active, true);
assert.equal(byType(tree, TouchControls).props.enabled, true);
assert.equal(byType(tree, ActorsScene).props.active, true);
tick(9000);
assert.equal(player.value, menuPlayer);
assert.equal(encounter.value, menuEncounter, 'The first resumed delta never catches up paused time');
tick(16);
close(encounter.value.timerMs, menuEncounter.timerMs - 16);
assert.deepEqual(input.value, playerApi.REST_INPUT, 'Joystick movement requires a fresh touch after resume');
const pausedPlayer = player.value, pausedEncounter = encounter.value, pausedField = field.value;
appStateListener('background');
tree = render();
assert.equal(frames[0].active, false);
assert.equal(byType(tree, TouchControls).props.enabled, false);
assert.equal(byType(tree, ActorsScene).props.active, false);
assert.deepEqual(input.value, playerApi.REST_INPUT);
tick(9000);
assert.equal(player.value, pausedPlayer, 'Backgrounding freezes the player');
assert.equal(encounter.value, pausedEncounter, 'Backgrounding freezes waves and NPCs');
assert.equal(field.value, pausedField);
appStateListener('active');
tree = render();
assert.equal(frames[0].active, true);
tick(null);
assert.equal(player.value, pausedPlayer);
assert.equal(encounter.value, pausedEncounter, 'Resume must not catch up background time');
// Terminal presentation remains independently pausable, without waking combat.
const terminalSaved=survival.value,terminalPlayer=player.value;
survival.set({...terminalSaved,mode:'dead',hp:0,ending:{kind:'death',elapsedMs:0,animationMs:600,ready:false}});
const hud=find(tree,e=>typeof e.props?.onMode==='function');hud.props.onMode('dead',false);
tree=render();assert.equal(frames[0].active,true);assert.equal(byType(tree,TouchControls).props.enabled,false);
tick(9000);assert.equal(survival.value.ending.elapsedMs,0);tick(40);assert.equal(survival.value.ending.elapsedMs,40);assert.equal(player.value.action,'death');
const deathFrozen=survival.value;tree=render({paused:true});frames[0].callback({timeSincePreviousFrame:9000});assert.equal(survival.value,deathFrozen);
tree=render();tick(9000);assert.equal(survival.value,deathFrozen,'Ending ignores suspended frame time');tick(40);assert.equal(survival.value.ending.elapsedMs,80);
hud.props.onMode('dead',true);tree=render();assert.equal(frames[0].active,false,'The ending clock stops after the menu is ready');
survival.set(terminalSaved);player.set(terminalPlayer);hud.props.onMode('playing',true);tree=render();
byType(tree, ActorsScene).props.onError(new Error('Fixture NPC image loading failure'));
tree = render(readiness);
assert.deepEqual(loadErrors, ['Fixture NPC image loading failure'], 'Asset failures reach the loading owner');
assert.equal(readySignals, 1, 'A load failure cannot announce a ready scene');
assert(find(tree, element => element.type === 'Text' && String(element.props.children).includes('Fixture NPC image loading failure')), 'The standalone error stays visible');
assert.equal(frames[0].active, false);
assert.equal(byType(tree, TouchControls).props.enabled, false);
const failedEncounter = encounter.value;
tick(100);
assert.equal(encounter.value, failedEncounter, 'Asset errors stop waves too');
console.log('Follow integration passed: actor/scenery readiness, one shared simulation without duplicate updates, capped deltas, shared navigation refresh, ' + positionChecks + ' clamped fixed-zoom camera positions, menu/background pause of all actors, scenery gating, input reset, foregrounding during explicit pause, first-frame restart without catch-up, and asset-error gating.');

// Exercise the real environmental animation clock separately, without a GPU.
// Rendering pictures is stubbed; lifecycle, shared values and frame code are real.
state.length = shared.length = effects.length = frames.length = 0;
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };
const image = {};
skiaMock = {
  ...skiaMock,
  FilterMode: { Nearest: 0 }, MipmapMode: { None: 0 },
  Atlas: 'Atlas', Picture: 'Picture', RadialGradient: 'RadialGradient',
  rect: (x, y, width, height) => ({ x, y, width, height }),
  useImage: () => image,
  Skia: {
    Color: value => value,
    PictureRecorder: () => ({
      beginRecording: () => ({ drawImageRectOptions() {}, drawPicture() {} }),
      finishRecordingAsPicture: () => ({}), dispose() {},
    }),
  },
};
const { Scene } = req('./src/game/Scene.tsx');
const onError = error => { throw error; };
function renderScene(active) {
  stateIndex = sharedIndex = effectIndex = frameIndex = 0;
  queuedEffects = [];
  const tree = Scene({ active, onError });
  for (const effect of queuedEffects) effect();
  return tree;
}
renderScene(true);
assert.equal(frames[0].active, true);
tick(9000);
assert.equal(shared[0].value, 0, 'A new environmental clock drops stale frame time');
for (let i = 0; i < 3; i++) tick(40);
assert.equal(shared[0].value, 120);
assert(shared[1].value.some(value => value > 0), 'The environmental animation advances during gameplay');
const pausedTime = shared[0].value, pausedTicks = shared[1].value;
renderScene(false);
assert.equal(frames[0].active, false);
frames[0].callback({ timeSincePreviousFrame: 9000 });
assert.equal(shared[0].value, pausedTime, 'Paused scenery cannot accumulate time in a queued callback');
assert.equal(shared[1].value, pausedTicks, 'Paused scenery preserves the exact animation frames');
renderScene(true);
tick(9000);
assert.equal(shared[0].value, pausedTime, 'Resuming scenery ignores the first stale delta');
tick(16);
assert.equal(shared[0].value, pausedTime + 16, 'Scenery resumes from its preserved time');
console.log('Environmental clock passed: exact-frame freeze, queued-frame guard and no time catch-up on resume.');


// Loading readiness includes both decorative actors, not only static city pictures.
state.length = shared.length = effects.length = frames.length = 0;
const decoded = new Set();
let imageRequests = [], imageErrorHandlers = [];
skiaMock = {
  ...skiaMock,
  Circle: 'Circle', LinearGradient: 'LinearGradient',
  useImage(source, onError) {
    imageRequests.push(source); imageErrorHandlers.push(onError);
    return decoded.has(source) ? image : null;
  },
  Skia: { ...skiaMock.Skia, RSXform: (...args) => args },
};
const { default: MenuBackdrop, MENU_ASSETS } = req('./src/ui/MenuBackdrop.tsx');
let backdropReady = 0;
const backdropErrors = [];
const backdropCallbacks = { onReady: () => { backdropReady++; }, onError: message => backdropErrors.push(message) };
function renderBackdrop(active) {
  stateIndex = sharedIndex = effectIndex = frameIndex = 0;
  queuedEffects = []; imageRequests = []; imageErrorHandlers = [];
  const tree = MenuBackdrop({ active, ...backdropCallbacks });
  for (const effect of queuedEffects) effect();
  return tree;
}
renderBackdrop(false);
assert.equal(imageRequests.length, 7, 'An inactive backdrop still requests every asset behind the loading screen');
assert.equal(backdropReady, 0);
assert.equal(frames[0].active, false);
for (const [key, source] of Object.entries(MENU_ASSETS)) if (key !== 'npc') decoded.add(source);
renderBackdrop(false);
assert.equal(backdropReady, 0, 'Static pictures and the boss alone do not finish menu loading');
decoded.add(MENU_ASSETS.npc);
renderBackdrop(false);
assert.equal(backdropReady, 1, 'All seven images and recorded pictures announce menu readiness');
assert.equal(frames[0].active, false, 'Decoding assets while covered never starts ambient animation');
renderBackdrop(false);
assert.equal(backdropReady, 1);
renderBackdrop(true);
assert.equal(frames[0].active, true);
imageErrorHandlers[0](new Error('Fixture menu image failure'));
assert.deepEqual(backdropErrors, ['Fixture menu image failure']);
console.log('Loading readiness passed: complete menu assets, inactive loading, no ambient work under overlays, stable ready notifications and error forwarding.');
