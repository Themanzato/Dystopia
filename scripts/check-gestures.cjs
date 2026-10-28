/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
function load(relative, dependencies = {}) {
  const filename = path.join(project, relative);
  const context = { exports: {}, require: id => {
    if (id in dependencies) return dependencies[id];
    if (id === '../ui/CurrentRun') return {publishCurrentRun:()=>()=>{}};
    if (id === './workshop') return load('src/game/workshop.ts',{'./difficulty':difficulty});
    if (id === './actionSounds') return load('src/game/actionSounds.ts');
    if (id === './rotation') return load('src/game/rotation.ts');
    if (id === './upgradeBalance') return load('src/game/upgradeBalance.ts');
    if (id === './bossBalance') return load('src/game/bossBalance.ts');
    if (id === './chestPlacement') return load('src/game/chestPlacement.ts',{'./collision':collision,'./map':map});
    if (id === './missionTelemetry') return load('src/game/missionTelemetry.ts');
    if (id === './missions') return load('src/game/missions.ts');
    if (id === './scores') return load('src/game/scores.ts',{'./enemyCatalog':enemyCatalog});
    if (id === './optionalEvents') return load('src/game/optionalEvents.ts',{'./difficulty':difficulty});
    if (id === './frenesis') return load('src/game/frenesis.ts', { './collision': collision });
    if (id.endsWith('.png')) return path.resolve(path.dirname(filename), id);
    throw new Error(`Unexpected control dependency: ${id}`);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context, { filename });
  return context.exports;
}
const map = load('src/game/map.ts');
const collision = load('src/game/collision.ts', { './map': map });
const playerApi = load('src/game/player.ts', { './map': map, './collision': collision });
const camera = load('src/game/camera.ts', { './map': map });
const navigation = load('src/game/navigation.ts', { './map': map, './collision': collision });
const npc = load('src/game/npc.ts');
const combat = load('src/game/combat.ts', { './collision': collision, './player': playerApi, './npc': npc });
const encounter = load('src/game/encounter.ts', { './map': map, './collision': collision, './navigation': navigation, './npc': npc, './combat': combat });
const damageFeedback = load('src/game/damageFeedback.ts');
const enemyCatalog = load('src/game/enemyCatalog.ts');
const difficulty = load('src/game/difficulty.ts');
const bossAttacks = load('src/game/bossAttacks.ts', { './enemyCatalog': enemyCatalog });
const bossBalance = load('src/game/bossBalance.ts');
const bossHazards = load('src/game/bossHazards.ts', { './collision': collision, './enemyAnimations': load('src/game/enemyAnimations.ts'), './enemyMotion': load('src/game/enemyMotion.ts') });
const survival = load('src/game/survival.ts', { './bossBalance': bossBalance, './dustJumper': load('src/game/dustJumper.ts', { './bossBalance': bossBalance }), './bossHazards': bossHazards, './purgatorio': load('src/game/purgatorio.ts',{'./enemyCatalog':enemyCatalog,'./difficulty':difficulty}), './enemyMotion': load('src/game/enemyMotion.ts'), './enemyAnimations': load('src/game/enemyAnimations.ts'), './worldEvents': load('src/game/worldEvents.ts', {'./enemyCatalog':enemyCatalog}), './worldEventSites':load('src/game/worldEventSites.ts'), './difficulty': difficulty, './bossAttacks': bossAttacks, './enemyCatalog': enemyCatalog, './collision': collision, './combat': combat, './encounter': encounter, './navigation': navigation, './npc': npc, './player': playerApi, './map': map });
const { createPlayer, advancePlayer, REST_INPUT, JOYSTICK_SIZE, JOYSTICK_TRAVEL } = playerApi;
const shared = value => ({ value, writes: 0, set(next) { this.value = typeof next === 'function' ? next(this.value) : next; this.writes++; } });
const close = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
function harness(states = []) {
  const h = { rnQueue: [], gestures: [], shared: [], derived: [], frames: [], effects: [], stateSets: [], statesRead: 0, appStateListener: null };
  function gesture(kind) {
    const g = { kind, config: {}, callbacks: {}, simultaneous: [] };
    for (const key of ['enabled', 'maxDuration', 'maxDistance', 'minDistance', 'minPointers', 'maxPointers', 'enableTrackpadTwoFingerGesture', 'shouldCancelWhenOutside', 'runOnJS']) {
      g[key] = value => { g.config[key] = value; return g; };
    }
    for (const key of ['onBegin', 'onUpdate', 'onFinalize', 'onEnd']) g[key] = callback => { g.callbacks[key] = callback; return g; };
    g.simultaneousWithExternalGesture = (...others) => { g.simultaneous.push(...others); return g; };
    h.gestures.push(g); return g;
  }
  const jsx = (type, props) => ({ type, props });
  h.dependencies = {
    react: {
      useMemo: fn => fn(), useCallback: fn => fn,
      useEffect: fn => { const cleanup = fn(); if (cleanup) h.effects.push(cleanup); },
      useState: initial => { const index = h.statesRead++; return [index < states.length ? states[index] : typeof initial === 'function' ? initial() : initial, next => h.stateSets.push({ index, next })]; },
    },
    'react-native-worklets': { scheduleOnRN: (fn,...args) => { h.rnQueue.push(()=>fn(...args)); } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      useWindowDimensions: () => ({ width: 844, height: 390 }), StyleSheet: { create: styles => styles, absoluteFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
      Text: 'Text', View: 'View',
      AppState: { currentState: 'active', addEventListener: (_name, callback) => { h.appStateListener = callback; return { remove() {} }; } },
    },
    'react-native-gesture-handler': {
      Gesture: { Tap: () => gesture('Tap'), Pan: () => gesture('Pan') },
      GestureDetector: 'GestureDetector', GestureHandlerRootView: 'GestureHandlerRootView',
    },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: initial => { const value = shared(initial); h.shared.push(value); return value; },
      useDerivedValue: fn => { const value = { get value() { return fn(); } }; h.derived.push(value); return value; },
      useAnimatedStyle: fn => ({ current: fn }),
      useFrameCallback: callback => { const frame = { callback, active: false, setActive(value) { this.active = value; } }; h.frames.push(frame); return frame; },
    },
    '@shopify/react-native-skia': {
      Canvas: 'Canvas', Fill: 'Fill', Group: 'Group', Atlas: 'Atlas',
      FilterMode: { Nearest: 'nearest' }, MipmapMode: { None: 'none' },
      Skia: { RSXform: (scos, ssin, tx, ty) => ({ scos, ssin, tx, ty }) },
      rect: (x, y, width, height) => ({ x, y, width, height }),
      useImage: source => ({ source }),
    },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    '../ui/PixelArt': { UIFrame: 'UIFrame', UIIcon: 'UIIcon' },
    '../ui/ControlArt': { ControlArt: 'ControlArt' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ left:0,right:0,top:0,bottom:0 }) }, '../ui/ControlVisual': { ControlVisual: () => null }, '../ui/controlLayout': load('src/ui/controlLayout.ts', {'./controlSettings':load('src/ui/controlSettings.ts')}), '../ui/ControlPreferences': { useControlSettings: () => ({ settings: { stickScale: 1, deadZone: 6, opacity: 0.86, swapped: false, lift: 0 } }) },
    '../ui/TutorialHUD':{default:()=>null},'./TutorialEffects':{default:()=>null},'./tutorialInstructions':{tutorialMapTargets:()=>[]},
    './tutorial':{TUTORIAL_SPAWN:playerApi.PLAYER_SPAWN,constrainTutorialPlayer:(_before,after)=>after,advanceTutorial:()=>{throw Error('Normal game must not run tutorial');}},
    '../ui/PixelText': {default:()=>null}, '../ui/GameUIOpacity': {default:({children})=>children}, '../ui/useResumeCountdown': {useResumeCountdown:()=>({number:null,start(){},cancel(){}})}, '../ui/prepareGameInterface': {prepareGameInterface:()=>({then(done){done();return {catch(){}};}})},
    '../ui/MerchantPanel': {default:()=>null}, './MerchantIndicator': {default:()=>null}, './merchantGameplay': {advanceMerchants:s=>s},
    '../ui/MissionBridge': {default:()=>null}, './BossOffscreenIndicators': {default:()=>null},
    './OptionalEventEffects': {ReactorVision:()=>null,EliteMarkers:()=>null,OptionalEventHUD:()=>null},
    './FrenesisScreenEffects': {default:()=>null}, './FrenesisEffects': {default:()=>null}, './FrenesisMapInput': {default:()=>null},
    './purgatorio': load('src/game/purgatorio.ts',{'./enemyCatalog':enemyCatalog,'./difficulty':difficulty}), './map': map, './camera': camera, './player': playerApi, './navigation': navigation, './encounter': encounter, './survival': survival, './damageFeedback': damageFeedback, '../ui/SurvivalHUD': { default: () => null }, './BattleEffects': { BattleEffects: () => null }, './WorldEventEffects': { WorldEventHUD:()=>null, WorldEventEffects:()=>null },
  };
  return h;
}
function nodes(element, predicate) {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(child => nodes(child, predicate));
  return [...(predicate(element) ? [element] : []), ...nodes(element.props?.children, predicate)];
}
function tick(player, input, milliseconds) {
  for (let elapsed = 0; elapsed < milliseconds;) {
    const delta = Math.min(1000 / 120, milliseconds - elapsed);
    player.set(advancePlayer(player.value, input.value, delta)); elapsed += delta;
  }
}
const h = harness();
const { TouchControls } = load('src/game/TouchControls.tsx', h.dependencies);
const player = shared(createPlayer()), input = shared(REST_INPUT);
const controls = TouchControls({ player, input, enabled: true });
const [attack, dash, stick] = h.gestures;
assert.equal(stick.kind, 'Pan'); assert.equal(attack.kind, 'Pan'); assert.equal(attack.config.minDistance, 0); assert.equal(attack.config.shouldCancelWhenOutside, false); assert.equal(dash.kind, 'Tap');
assert.equal(h.gestures.length, 3, 'Only a local joystick and two buttons may own gestures');
for (const g of h.gestures) {
  assert.equal(g.config.runOnJS, false, 'Controls must stay on the UI thread');
  assert.equal(g.config.enabled, true);
  for (const callback of Object.values(g.callbacks)) assert(callback.toString().includes('worklet'));
  for (const other of h.gestures.filter(value => value !== g)) assert(g.simultaneous.includes(other), 'Both thumbs must have simultaneous native recognizers');
}
assert.equal(stick.config.maxPointers, 1); assert.equal(stick.config.minPointers, 1);
assert.equal(stick.config.enableTrackpadTwoFingerGesture, false);
assert.equal(stick.config.shouldCancelWhenOutside, false, 'Dragging beyond the joystick must keep control until release');
assert(!('onUpdate' in attack.callbacks) && !('onUpdate' in dash.callbacks), 'Buttons must not auto-repeat as a held finger moves');
assert.equal(nodes(controls, node => node.type === 'GestureDetector').length, 3);
const center = JOYSTICK_SIZE / 2;
stick.callbacks.onBegin({ x: center, y: center });
assert.equal(input.value, REST_INPUT);
stick.callbacks.onUpdate({ x: center + 1000, y: center + 1000 });
close(input.value.x, Math.SQRT1_2); close(input.value.y, Math.SQRT1_2); close(input.value.strength, 1);
close(Math.hypot(h.shared[0].value.x, h.shared[0].value.y), JOYSTICK_TRAVEL);
stick.callbacks.onUpdate({ x: center - 44, y: center });
const movingInput = input.value;
tick(player, input, 20);
assert.equal(player.value.facingX, -1);
attack.callbacks.onBegin();
assert.equal(player.value.action, 'attack'); assert.equal(player.value.attackSerial, 1, 'Each tap creates one distinct sword swing');
assert.equal(input.value, movingInput, 'Right-hand attack must not release the left joystick');
const activeAttack = player.value;
attack.callbacks.onBegin(); assert.equal(player.value, activeAttack, 'A duplicate activation cannot restart its swing');
tick(player, input, 1000);
assert.equal(player.value.nextAttack, 1, 'Holding attack cannot silently start another sword sequence');
assert.notEqual(player.value.action, 'attack');
attack.callbacks.onFinalize(); assert.equal(input.value, movingInput);
dash.callbacks.onBegin();
assert.equal(player.value.action, 'dash'); close(player.value.dashX, -1);
assert.equal(input.value, movingInput, 'Dash must coexist with the movement recognizer');
const activeDash = player.value;
dash.callbacks.onBegin(); assert.equal(player.value, activeDash);
attack.callbacks.onBegin(); assert.equal(player.value, activeDash, 'Attack cannot interrupt a dash');
attack.callbacks.onFinalize(); dash.callbacks.onFinalize();
assert.equal(input.value, movingInput, 'Releasing action buttons must not release the joystick');
stick.callbacks.onFinalize({ state: 'CANCELLED' });
assert.equal(input.value, REST_INPUT, 'Cancellation must release movement');
close(h.shared[0].value.x, 0); close(h.shared[0].value.y, 0);
tick(player, input, 300);
assert.equal(player.value.action, 'idle'); assert(player.value.dashCooldownMs > 0);
const cooling = player.value;
dash.callbacks.onBegin(); assert.equal(player.value, cooling, 'Repeated taps cannot bypass recovery'); dash.callbacks.onFinalize();
tick(player, input, 700);
dash.callbacks.onBegin(); assert.equal(player.value.action, 'dash'); dash.callbacks.onFinalize();
stick.callbacks.onBegin({ x: center, y: center - 44 });
assert(input.value.strength > 0);
stick.callbacks.onFinalize({ state: 'END' }); assert.equal(input.value, REST_INPUT);
input.set({ x: 1, y: 0, strength: 1 });
assert.equal(TouchControls({ player, input, enabled: false }), null);
assert.equal(input.value, REST_INPUT, 'Disabled/background controls must not leave a stuck joystick');
assert(h.gestures.slice(3).every(g => g.config.enabled === false));

// Exercise the real screen callback and derived camera, independently of React renders.
const sh = harness(['844x390',{completed:15,total:15},null,true,true,null,true]);
const ActorsScene = () => null, MockControls = () => null;
const { default: Screen } = load('src/game/CourtyardScreen.tsx', {
  ...sh.dependencies, './ActorsScene': { ActorsScene }, './TouchControls': { TouchControls: MockControls },
});
const screen = Screen();
assert.equal(nodes(screen, node => node.type === 'GestureDetector').length, 0, 'The scene must not retain a pan/pinch camera recognizer');
assert.equal(sh.gestures.length, 0, 'The screen must not install wheel, pinch or other zoom gestures');
const gamePlayer = sh.shared[0], gameInput = sh.shared[1], gameEncounter = sh.shared[3];
assert.equal(sh.shared.length, 9, 'Gameplay also shares the survival simulation without React per-frame state');
const actorsNode = nodes(screen, node => node.type === ActorsScene)[0];
assert.equal(actorsNode.props.player, gamePlayer); assert.equal(actorsNode.props.encounter, gameEncounter);
const layoutNode = nodes(screen, node => Boolean(node.props?.onLayout))[0];
layoutNode.props.onLayout({ nativeEvent: { layout: { width: 844, height: 390 } } });
const transform = sh.derived[sh.derived.length - 1];
const scale = transform.value[2].scale;
const firstX = transform.value[0].translateX;
assert.equal(sh.frames.length, 1); assert.equal(sh.frames[0].active, true);
const initializationStateWrites=sh.stateSets.length;
gameInput.set({ x: -1, y: 0, strength: 1 });
const initialPlayer = gamePlayer.value, initialEncounter = gameEncounter.value;
sh.frames[0].callback({ timeSincePreviousFrame: null }); assert.equal(gamePlayer.value, initialPlayer);
assert.equal(gameEncounter.value, initialEncounter, 'A missing delta cannot advance waves');
sh.frames[0].callback({ timeSincePreviousFrame: 1000 / 120 });
assert(gamePlayer.value.x < initialPlayer.x);
close(gameEncounter.value.timerMs, initialEncounter.timerMs - 1000 / 120);
assert.equal(gameEncounter.writes, 1, 'The shared screen callback advances encounters exactly once');
assert.equal(gamePlayer.writes, 1, 'The shared screen callback advances the hero exactly once');
assert(transform.value[0].translateX > firstX, 'Camera must track the shared player position');
assert.equal(sh.stateSets.length, initializationStateWrites, 'A movement frame must not trigger a React state update');
close(transform.value[2].scale, scale);
for (const position of [{ x: -99999, y: -99999 }, { x: 99999, y: 99999 }]) {
  gamePlayer.set({ ...gamePlayer.value, ...position });
  const current = transform.value;
  close(current[2].scale, scale);
  const bounds = camera.getCameraBounds({ width: 844, height: 390 });
  const expected = camera.clampCamera(position, bounds);
  close(current[0].translateX, 844 / 2 - expected.x * scale);
  close(current[1].translateY, 390 / 2 - expected.y * scale);
}
sh.appStateListener('background'); assert.equal(gameInput.value, REST_INPUT);
for (const cleanup of sh.effects) cleanup();
assert.equal(sh.frames[0].active, false, 'Unmounting/background cleanup must stop frame callbacks');

// Check the actual sprite renderer's sampling and stable mirror/pivot transforms.
const ph = harness();
const { PlayerSprite: ActualSprite } = load('src/game/PlayerSprite.tsx', ph.dependencies);
const spritePlayer = shared(createPlayer());
const sprite = ActualSprite({ player: spritePlayer, onError: error => { throw error; } });
const atlas = nodes(sprite, node => node.type === 'Atlas')[0];
assert(atlas.props.image.source.endsWith('Sword Master Sprite Sheet 90x37.png'), 'Use the original sheet containing authored VFX');
assert.equal(atlas.props.sampling.filter, 'nearest'); assert.equal(atlas.props.sampling.mipmap, 'none');
const atlasTransform = atlas.props.transforms[0];
close(atlasTransform.tx, -playerApi.PLAYER_CELL.pivotX * playerApi.PLAYER_SCALE);
close(atlasTransform.ty, -playerApi.PLAYER_CELL.pivotY * playerApi.PLAYER_SCALE);
spritePlayer.set({ ...spritePlayer.value, facingX: -1 });
assert.equal(sprite.props.transform.value[2].scaleX, -1);
assert.equal(atlas.props.sprites.value[0].y, 37, 'Mirroring must not change the sprite source row');
console.log('Touch control checks passed: simultaneous local joystick/buttons, eight-direction input, held-button guards, dash recovery, release/cancel/background reset, shared player/encounter frame updates without React renders, UI-thread callbacks, player-follow camera bounds without zoom and original nearest-filtered sprite pivots. Native multitouch hardware and device FPS are not measured by this mock.');


const fh=harness(), frenzyApi=load('src/game/frenesis.ts',{'./collision':collision});
const frState=survival.activateFrenesis({...survival.createSurvival(),frenesis:{...frenzyApi.createFrenesis(),charge:100}});
const frPlayer=shared(survival.applyPlayerUpgrades(createPlayer(),frState)), frInput=shared(REST_INPUT);
const frControls=load('src/game/TouchControls.tsx',fh.dependencies).TouchControls({player:frPlayer,input:frInput,enabled:true});
assert(frControls);const [frAttack,,frStick]=fh.gestures;
frStick.callbacks.onBegin({x:JOYSTICK_SIZE/2+44,y:JOYSTICK_SIZE/2});frAttack.callbacks.onBegin();
const startX=frPlayer.value.x;tick(frPlayer,frInput,100);assert(frPlayer.value.x>startX);assert(frPlayer.value.attackHeld);frAttack.callbacks.onFinalize();assert(!frPlayer.value.attackHeld&&!frPlayer.value.spinStrike);
const mh=harness(), battle=shared(frState), clock=shared({running:true,firstFrame:false});
const MapInput=load('src/game/FrenesisMapInput.tsx',mh.dependencies).default;
MapInput({survival:battle,player:frPlayer,enabled:true,camera:shared([{translateX:-100},{translateY:-200},{scale:0.75}]),clock});
const tap=mh.gestures[0];clock.value.running=false;tap.callbacks.onEnd({x:100,y:100},true);assert.equal(battle.value,frState,'A queued map callback cannot act while paused');
clock.value.running=true;tap.callbacks.onEnd({x:-1e6,y:0},true);assert.equal(battle.value.frenesis.teleportMs,0,'Invalid map taps preserve cooldown');
const destination={x:frPlayer.value.x+5,y:frPlayer.value.y};tap.callbacks.onEnd({x:destination.x*0.75-100,y:destination.y*0.75-200},true);
close(frPlayer.value.x,destination.x);close(frPlayer.value.y,destination.y);assert.equal(battle.value.frenesis.teleportMs,3000);
console.log('Frenesis input passed: actual held-attack/release and simultaneous stick handlers, UI-thread map conversion, paused queued callback guard and valid-only cooldown.');

// Countdown leaves only pause available; combat zones and recognizers cannot receive touches.
const countdownHarness=harness(),countdownPlayer=shared(createPlayer()),countdownInput=shared(REST_INPUT);let pauseCount=0;
const CountdownControls=load('src/game/TouchControls.tsx',countdownHarness.dependencies).TouchControls;
const countdownControls=CountdownControls({player:countdownPlayer,input:countdownInput,enabled:false,pauseAvailable:true,onPause:()=>{pauseCount++;}});
assert.equal(nodes(countdownControls,node=>node.type==='GestureDetector').length,1);
const countdownPause=nodes(countdownControls,node=>node.props?.testID==='game-control-pause')[0];assert(countdownPause);countdownHarness.gestures[3].callbacks.onBegin();assert.equal(pauseCount,0);countdownHarness.rnQueue.splice(0).forEach(fn=>fn());assert.equal(pauseCount,1);countdownHarness.gestures[3].callbacks.onBegin();assert.equal(countdownHarness.rnQueue.length,0);
assert.equal(countdownPause.props.style[1].opacity,.86,'Pause icon respects only the game controls opacity');
assert(!nodes(countdownControls,node=>node.props?.testID==='game-control-attack').length);
console.log('Countdown controls passed: combat zones absent, pause remains interactive at its configured geometry/opacity.');

{
const pauseHarness=harness(),pp=shared(createPlayer()),pi=shared(REST_INPUT),pc=shared({running:true,firstFrame:false});let notified=0;
const PC=load('src/game/TouchControls.tsx',{'./player':playerApi,...pauseHarness.dependencies}).TouchControls;
PC({player:pp,input:pi,enabled:true,clock:pc,onPause:()=>notified++});
const [pa,pd,ps,pg]=pauseHarness.gestures;ps.callbacks.onBegin({x:130,y:100});pa.callbacks.onBegin();assert(pi.value.strength>0);
pg.callbacks.onBegin();assert.equal(pc.value.running,false);assert.equal(pi.value,REST_INPUT);assert.equal(notified,0);
for(const g of [pa,pd,ps])assert(g.simultaneous.includes(pg)&&pg.simultaneous.includes(g));
pa.callbacks.onBegin();pd.callbacks.onBegin();ps.callbacks.onUpdate({x:0,y:0});assert.equal(pi.value,REST_INPUT);assert.notEqual(pp.value.action,'dash');
pg.callbacks.onBegin();assert.equal(pauseHarness.rnQueue.length,1);pauseHarness.rnQueue.shift()();assert.equal(notified,1);
console.log('Pause passed: UI clock/input freeze before a blocked RN callback; simultaneous relations and first-touch latch.');

}
