const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = fs.readFileSync(filename, 'utf8');
  const code = (['frenesis.ts', 'player.ts', 'combat.ts', 'frenesisAssets.ts'].some(name => filename.endsWith(name)) || filename.endsWith('survival.ts') || filename.endsWith('encounter.ts') || filename.endsWith('loadingPresentation.ts') || filename.endsWith('darknessMotion.ts')) ? babel.transformSync(source, {
    filename, babelrc: false, configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('react-native-worklets/plugin'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code : ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { global: { Error }, module, exports: module.exports, require: id => {
    assert(id.startsWith('.'), `Unexpected dependency: ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    return target.endsWith('.png') ? target : load(`${target}.ts`);
  } }, { filename });
  return module.exports;
}
const api = load(path.join(project, 'src/game/encounter.ts'));
function isolated(fn, ...args) {
  assert(fn.__initData?.code, 'Exercise the actual serialized UI worklet');
  const worklet = vm.runInNewContext(`(${fn.__initData.code})`, {});
  return worklet.apply({ __closure: fn.__closure }, args);
}
assert.equal(isolated(api.waveSize, 1), 6);
assert.equal(isolated(api.waveSize, 100), 36);
assert.equal(isolated(api.waveSize, 1, { ...api.WAVE_CONFIG, firstWaveCount: 3 }), 3);
assert.equal(isolated(api.spawnIsClear, { x: 0, y: 0 }, { x: 0, y: 0 }, [], {}), false);
const initial = api.createEncounter();
assert.equal(isolated(api.advanceEncounter, initial, {}, {}, {}, 16).timerMs, initial.timerMs - 16);
assert.equal(isolated(api.advanceEncounter, initial, {}, {}, {}, 0), initial);
console.log('Serialized encounter worklets resolve default configuration without global WAVE_CONFIG.');

const presentation = load(path.join(project, 'src/ui/loadingPresentation.ts'));
const strip = { frames: 6, fps: 10, columns: 1, row: 0,
  cell: { width: 32, height: 32 }, bounds: { x: 3, y: 4, width: 20, height: 24 } };
for (let frame = 0; frame < strip.frames; frame++) {
  const crop = isolated(presentation.loadingFrame, strip, (frame + 0.1) * 1000 / strip.fps);
  assert.equal(crop.x, 3); assert.equal(crop.y, frame * 32 + 4);
  assert.equal(crop.width, 20); assert.equal(crop.height, 24);
}
assert.equal(isolated(presentation.loadingFrame, { ...strip, columns: undefined }, 110).x, 35);
assert.equal(isolated(presentation.loadingFrame, { ...strip, frames: 1, fps: 0 }, 60000).x, 3);
console.log('Serialized loading frame worklet supports horizontal, vertical and static originals without JS globals.');
assert.equal(isolated(presentation.loadingEntrance, 844, 600, 0).x + 600, 872);
assert.equal(isolated(presentation.loadingEntrance, 844, 600, 400).x, 0);
const darkness = load(path.join(project, 'src/ui/darknessMotion.ts'));
assert.equal(isolated(darkness.darknessAt, 500, 'cover').opacity, 1);
assert.equal(isolated(darkness.darknessAt, 0, 'reveal').opacity, 1);
assert.equal(isolated(darkness.darknessAt, 560, 'reveal').opacity, 0);
console.log('Serialized entry and darkness worklets resolve their constants on the native UI runtime.');
// Default parameter expressions are not captured by the Worklets transform.
// Exercise the PRIVATE helper in its serialized runtime, rather than invoking
// its original JS function through advanceSurvival's closure.
const survival = load(path.join(project, 'src/game/survival.ts'));
const spawnCommon = survival.advanceSurvival.__closure.spawnCommon;
assert(spawnCommon?.__initData?.code, 'Common spawning is a serialized worklet');
const nativeSpawn = vm.runInNewContext('(' + spawnCommon.__initData.code + ')', {});
let searches = 0, candidate = { x: 500, y: 600 };
const spawnRuntime = { __closure: { ...spawnCommon.__closure, findSpawn: () => { searches++; return candidate; } } };
const spawnState = survival.createSurvival();
const player = { x: 100, y: 100 };
assert.equal(nativeSpawn.call(spawnRuntime, spawnState, player, {}), true, 'Omitted position resolves inside the worklet closure');
assert.equal(searches, 1);
assert.equal(spawnState.encounter.enemies.filter(n => n.active).length, 1);
assert.equal(spawnState.encounter.enemies.find(n => n.active).x, 500);
assert.equal(nativeSpawn.call(spawnRuntime, spawnState, player, {}, { x: 700, y: 800 }), true);
assert.equal(searches, 1, 'Explicit positions never consume another random spawn search');
assert.equal(nativeSpawn.call(spawnRuntime, spawnState, player, {}, null), false);
assert.equal(searches, 1, 'Explicit null remains a failed spawn, not a new random search');
candidate = null;
assert.equal(nativeSpawn.call(spawnRuntime, spawnState, player, {}), false);
assert.equal(searches, 2);
assert.equal(spawnState.encounter.enemies.filter(n => n.active).length, 2, 'A failed search cannot activate a slot');
console.log('Serialized survival spawning resolves findSpawn without a global, preserves explicit positions/null and handles failed searches.');

const frenzy = load(path.join(project, 'src/game/frenesis.ts'));
const heroApi = load(path.join(project, 'src/game/player.ts'));
const spinCombat = load(path.join(project, 'src/game/combat.ts'));
const ff = isolated(frenzy.startFrenesis, {...frenzy.createFrenesis(),charge:100},true);
assert(ff.active);
const hh = {...heroApi.createPlayer(),frenesis:true,attackSpeedMultiplier:1.5};
const held = isolated(heroApi.beginAttack,hh);
let spinning = isolated(heroApi.advancePlayer,held,{x:0,y:0,strength:0},40);
assert.equal(spinning.frenesisAttack,'slash1');assert(!spinning.spinStrike,'The hit waits for the real release cell');
spinning=isolated(heroApi.advancePlayer,spinning,{x:0,y:0,strength:0},40);assert(!spinning.spinStrike);
spinning=isolated(heroApi.advancePlayer,spinning,{x:0,y:0,strength:0},40);assert(spinning.spinStrike);
assert(isolated(spinCombat.swordHitsNpc,held,spinning,{id:1,x:spinning.x+20,y:spinning.y,active:true,action:'move',lastHitSerial:-1}));
spinning=isolated(heroApi.advancePlayer,spinning,{x:0,y:0,strength:0},40);
assert(!spinning.spinStrike,'The next frame cannot duplicate the interval hit');
let pending=isolated(heroApi.requestAttack,hh);assert.notEqual(pending.action,'attack');
const tapped=isolated(frenzy.releaseFrenesisAttack,pending);assert.equal(tapped.frenesisAttack,'slash1');assert(!tapped.attackHeld);
for(let i=0;i<4;i++){pending=isolated(heroApi.advancePlayer,pending,{x:0,y:0,strength:0},40);assert.notEqual(pending.action,'attack');}
pending=isolated(heroApi.advancePlayer,pending,{x:0,y:0,strength:0},20);assert.equal(pending.frenesisAttack,'slices');
assert.equal(isolated(heroApi.requestAttack,pending),pending,'Repeated native requests cannot restart a held animation');
const heroArt=load(path.join(project,'src/game/frenesisAssets.ts'));
for(const [phase,image,facing]of [['slash1',2,-1],['slash2',3,-1],['slices',6,1]]){
 const frame=isolated(heroArt.frenesisFrame,{...hh,action:'attack',frenesisAttack:phase,actionMs:150});assert.equal(frame.image,image);assert.equal(frame.authoredFacing,facing);
}
assert.equal(isolated(frenzy.teleportFrenesis,ff,hh,-1,0,true).frenesis,ff);
assert.equal(isolated(frenzy.teleportFrenesis,ff,hh,hh.x,hh.y,true).frenesis.teleportMs,3000);
assert.equal(isolated(frenzy.advanceFrenesis,ff,15000).active,false);
console.log('Serialized Frenesis activation, timed spin, collision and teleport resolve their real closures without JS globals.');
