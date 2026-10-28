/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const babel = require('@babel/core');
const project = path.resolve(__dirname, '..'), cache = new Map();
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const code = filename.endsWith('survival.ts') ? babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('react-native-worklets/plugin'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code : ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, global: { Error }, require: id => {
    assert(id.startsWith('.'), `Unexpected pure simulation dependency ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    return target.endsWith('.png') ? target : load(path.relative(project, `${target}.ts`));
  } }, { filename });
  return module.exports;
}
const api = load('src/game/survival.ts'), players = load('src/game/player.ts');
const nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts');
const { BOSS_BALANCE, BOSS_MODES } = load('src/game/bossBalance.ts');
const { hazardHits } = load('src/game/bossHazards.ts');
const { beamDraws, hazardIsActive } = load('src/game/bossEffects.ts');
const { worldRandom } = load('src/game/worldEvents.ts');
const { bossFrame } = load('src/game/survivalAssets.ts');
let origin;
for (let y = 950; !origin && y <= 1900; y += 24) for (let x = 900; !origin && x <= 2000; x += 24) {
  let clear = collision.isWalkable(x,y);
  for (let r = 8; clear && r <= 150; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r)) {clear=false;break;}
  if (clear) origin = {...players.createPlayer(),x,y};
}
assert(origin,'Real city has a connected open arena for deterministic combat tests');
const field = nav.buildFlowField(origin), fixtures = new Map(), failures = [];
let cases = 0, simulated = 0;
const copy = value => JSON.parse(JSON.stringify(value));
function step(state,dt=40,before=origin,after=before,view) {simulated++;return api.advanceSurvival(state,before,after,field,dt,view);}
function test(name,fn) {if(process.env.DYSTOPIA_BOSS_CASE&&!name.includes(process.env.DYSTOPIA_BOSS_CASE))return;try {fn();cases++;console.log('PASS '+name);} catch(error) {failures.push(name+': '+error.message);console.error('FAIL '+name+': '+error.stack);}}
function liveNpcs(state) {return state.encounter.enemies.filter(n=>n.active&&n.action!=='death');}
function silence(state) {
  state.invulnerableMs=1e9; state.world.reinforcementMs=1e9;
  state.encounter={...state.encounter,remaining:0,phase:'clearing',spawnMs:1e9,enemies:state.encounter.enemies.map(n=>({...n,active:false}))};
  state.orbs=[];state.chests=[];state.pendingUpgrades=0;state.pendingChests=0;
  return state;
}
function fixture(id,mode='easy') {
  const key=id+'/'+mode;
  if (!fixtures.has(key)) {
    let state=api.createSurvival(71,mode,{mode:'purgatorio',encounter:id});state.invulnerableMs=1e9;
    for(let n=0;n<250&&(!state.boss||state.presentation);n++)state=step(state);
    assert(state.boss,'Real encounter creates '+id);assert.equal(state.boss.id,id);assert.equal(state.presentation,null);
    fixtures.set(key,copy(state));
  }
  const state=silence(copy(fixtures.get(key)));
  state.boss={...state.boss,x:origin.x+120,y:origin.y,facingX:-1,phase:'recover',phaseMs:0,animationMs:0,
    attackRootX:0,pattern:0,attackIndex:0,attackRate:1,summonMs:0};
  state.bossActionUntilMs=0;state.hazards=[];state.minibosses=[];state.partner=null;
  return state;
}
function begin(id,index=0,mode='easy',options={}) {
  let state=fixture(id,mode);
  Object.assign(state.boss,{phaseMs:10000,pattern:index},options);
  if(id==='dagger-mush') {
    for(let seed=1;seed<100000;seed++) {const world={...state.world,randomSeed:seed};if(Math.floor(worldRandom(world)*3)===index){state.world.randomSeed=seed;break;}}
  }
  state=step(state);
  assert.equal(state.boss.phase,'warning',id+' enters its real warning state');
  assert.equal(state.boss.attackIndex,index,id+' selects intended authored attack');
  return state;
}
function until(state,predicate,max=400,dt=40,player=origin) {
  for(let n=0;n<max&&!predicate(state);n++)state=step(state,dt,player);
  assert(predicate(state),'Timed simulation reached requested state');return state;
}
function recover(state,dt=40) {return until(state,s=>s.boss.phase==='recover',400,dt);}
function killBoss(state) {
  state.boss={...state.boss,hp:1,x:origin.x+60,y:origin.y,facingX:1,phase:'warning',phaseMs:0,attackIndex:0,attackRate:1};
  state.bossActionUntilMs=1e9;
  let p=players.beginAttack({...origin,comboMs:0,attackSerial:state.lastAttackSerial+1});
  for(let n=0;n<30&&state.boss.phase!=='death';n++) {const next=players.advancePlayer(p,players.REST_INPUT,20);state=step(state,20,p,next);p=next;}
  assert.equal(state.boss.phase,'death','Actual sword strike kills the actor');return state;
}


for(const mode of ['easy','hard','dystopia'])for(const leaderFirst of [false,true]){
 let s=fixture('bomb-droid',mode),expected=BOSS_MODES[mode].droids;
 assert(s.droidGroup&&s.boss.groupId===s.droidGroup.id);
 if(leaderFirst){s=killBoss(s);assert.equal(s.chests.length,0);}
 for(let i=0;i<80&&(s.boss?.packRemaining??0)>0;i++)s=step(s);
 const ids=[s.boss,...s.minibosses].filter(b=>b?.hp>0).map(b=>b.entityId);
 assert.equal(ids.length,expected-Number(leaderFirst));
 for(let i=0;i<ids.length;i++){
   const id=ids[i];let b=[s.boss,...s.minibosses].find(b=>b?.entityId===id);
   Object.assign(b,{hp:1,x:origin.x+55,y:origin.y,phase:'recover',phaseMs:0,facingX:1});
   s.bossActionUntilMs=1e9;const serial=s.lastAttackSerial+1,p={...origin,action:'attack',actionMs:70,attackSerial:serial,attackIndex:0,facingX:1,aimX:1,aimY:0};
   s=step(s,40,p,{...p,actionMs:110});
   assert.equal(s.chests.length,i===ids.length-1?1:0,'Only the last actual death gives the group chest');
 }
 assert.equal(s.chests[0].kind,'upgrade');assert.equal(s.chests[0].upgradeCharges,1);
 const chests=JSON.stringify(s.chests);for(let i=0;i<10;i++)s=step(s);assert.equal(JSON.stringify(s.chests),chests);
 assert.equal(s.droidGroup,undefined,'Terminal encounters release the group reference');
 let aborted=fixture('bomb-droid',mode);aborted.mode='dead';aborted=step(aborted);assert.equal(aborted.droidGroup,undefined);assert.equal(aborted.chests.length,0);
 console.log('PASS one Bomb Droid group chest: '+mode+', leader first '+leaderFirst);
}
console.log('Droid groups: real spawning, shared IDs, ordered deaths, one upgrade chest, duplicate callbacks and terminal cleanup passed.');
