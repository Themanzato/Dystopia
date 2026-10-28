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


const {ACTION_SOUND_KEYS,playActionSound,stopActionSound,stopOwnerSounds}=load('src/game/actionSounds.ts');
const count=(s,key)=>s.events.actionSounds?.[key]?.serial??0;
const seen=new Set();
function hear(id,index,key,options={}) {
 let s=begin(id,index,'easy',options);const previous=count(s,key);let peak=previous;
 for(let i=0;i<260;i++) {s=step(s);peak=Math.max(peak,count(s,key));if(peak>0&&s.boss.phase==='recover')break;}
 assert(peak>0,`${id}/${index} emits ${key} during the real action`);seen.add(key);return s;
}
test('All original action sounds map to actual boss attack timelines',()=>{
 for(const [id,index,key,options] of [
  ['evil-sage',0,'sageCharge'],['evil-sage',0,'sageExplosion'],['evil-sage',1,'sageExplosion'],
  ['guardian',0,'guardianLasers'],['guardian',1,'guardianSquare'],['guardian',2,'guardianLaser'],
  ['guardian',3,'guardianTeleport',{powerPhase:2,teleportCooldownMs:0}],
  ['archer',0,'archerShot'],['dagger-bandit',0,'daggerSlash'],['dagger-mush',1,'daggerSlash'],
  ['electrocutioner',0,'electroProjectile'],['electrocutioner',1,'electroStorm'],
  ['electrocutioner',2,'electroTeleport',{powerPhase:1,teleportCooldownMs:0}],
  ['tarnished-widow',0,'widowVoice1'],['tarnished-widow',1,'widowVoice2'],
  ['dust-jumper',0,'dustBomb'],['dust-jumper',1,'dustBeepTrack',{powerPhase:1}],
  ['dust-jumper',1,'dustBeepFast',{powerPhase:1}],['dust-jumper',1,'dustSlam',{powerPhase:1}],
 ])hear(id,index,key,options);
 assert.equal(seen.size,ACTION_SOUND_KEYS.length,'Every new action sound is reachable');
});
test('Sage charge stops when the charge animation ends; its explosion waits for impact',()=>{
 let s=begin('evil-sage');assert.equal(count(s,'sageCharge'),1);assert.equal(count(s,'sageExplosion'),0);
 s=until(s,s=>s.boss.phase==='attack');assert.equal(s.events.actionStops.sageCharge,1);assert.equal(count(s,'sageExplosion'),0);
 s=until(s,s=>count(s,'sageExplosion')>0);assert.equal(count(s,'sageExplosion'),1);
 for(let i=0;i<4;i++)s=step(s);assert.equal(count(s,'sageExplosion'),1,'No per-frame explosion replay');
});
test('Guardian cues begin with the authored visible beam, then end with its active interval',()=>{
 for(const [index,key] of [[0,'guardianLasers'],[1,'guardianSquare'],[2,'guardianLaser']]){
  let s=begin('guardian',index);assert.equal(count(s,key),0);
  s=until(s,s=>count(s,key)>0);assert(s.boss.phase==='attack');assert.equal(count(s,key),1);
  s=until(s,s=>s.boss.phase==='recover');assert.equal(s.events.actionStops[key],1);
 }
});
test('Dust bomb recording starts with throw animation and never restarts on its three impacts',()=>{
 let s=begin('dust-jumper',0,'easy',{hp:10,maxHp:36,powerPhase:1});
 assert.equal(count(s,'dustBomb'),0,'Warning is not the throwing animation');
 s=until(s,s=>s.boss.phase==='attack');assert.equal(s.boss.phaseMs,0);assert.equal(count(s,'dustBomb'),1);
 assert(s.hazards.filter(h=>h.fx==='dustBomb').length>=2);
 assert(s.hazards.filter(h=>h.fx==='dustBomb').every(h=>h.ageMs<h.warningMs),'Flight/marker/impact have not occurred yet');
 s.bossActionUntilMs=1e9;
 for(let i=0;i<65;i++)s=step(s);
 assert.equal(count(s,'dustBomb'),1,'Single supplied recording covers throw, flight and explosions');
});
test('Dust tracking/locked pulses and impact use the paused simulation clock',()=>{
 let s=begin('dust-jumper',1,'easy',{powerPhase:1});s=until(s,s=>count(s,'dustBeepTrack')>0);
 assert.equal(count(s,'dustBeepFast'),0);assert.equal(count(s,'dustSlam'),0);
 const unchanged=api.advanceSurvival({...s,mode:'upgrade'},origin,origin,field,1000);assert.equal(unchanged.events.soundSerial,s.events.soundSerial);
 s=until(s,s=>count(s,'dustBeepFast')>0);assert.equal(count(s,'dustSlam'),0);
 s=until(s,s=>count(s,'dustSlam')>0);assert.equal(count(s,'dustSlam'),1);
 for(let i=0;i<5;i++)s=step(s);assert.equal(count(s,'dustSlam'),1);
});
test('Owner stops are idempotent, cancel coalesced starts and do not silence another owner',()=>{
 const e={};playActionSound(e,'sageCharge',7);stopOwnerSounds(e,7);assert.equal(e.actionStops.sageCharge,e.actionSounds.sageCharge.serial);
 const n=e.soundSerial;stopOwnerSounds(e,7);assert.equal(e.soundSerial,n,'Repeated death/cancel does not emit more stops');
 playActionSound(e,'sageCharge',8);stopActionSound(e,'sageCharge',7);assert(e.actionSounds.sageCharge.serial>e.actionStops.sageCharge);
});
test('Killing the real boss cancels its ongoing native sound exactly once',()=>{
 let s=begin('evil-sage');assert.equal(count(s,'sageCharge'),1);s=killBoss(s);
 assert.equal(s.events.actionStops.sageCharge,1);const n=s.events.soundSerial;s=step(s);assert.equal(s.events.soundSerial,n);
});
test('New player dash is reachable for normal dash and successful Frenesis blink only',()=>{
 const s=fixture('guardian');s.bossActionUntilMs=1e9;
 const p=players.beginDash(origin,{x:1,y:0,strength:1});let next=step(s,20,p,players.advancePlayer(p,players.REST_INPUT,20));assert.equal(next.events.dash,s.events.dash+1);
 const blink={...origin,frenesisBlink:true};next=step(s,20,origin,blink);assert.equal(next.events.dash,s.events.dash+1);
});
test('Normalized files cover all new originals and retain original/derived hashes and loudness headroom',()=>{
 const crypto=require('node:crypto');const manifest=JSON.parse(fs.readFileSync(path.join(project,'assets/sounds/mixed/sources.json'),'utf8'));
 const added=fs.readdirSync(path.join(project,'assets/sounds/sonidos por agregar'),{recursive:true}).filter(p=>p.endsWith('.mp3'));
 const mapped=manifest.cues.filter(c=>c.source.includes('/sonidos por agregar/'));assert.equal(mapped.length,added.length);
 for(const c of manifest.cues){
  const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(project,f))).digest('hex');
  assert.equal(hash(c.source),c.sourceSha256,'Original asset unchanged');assert.equal(hash(c.output),c.outputSha256);
  assert(Math.abs(c.outputLufs-manifest.targetLufs)<.5,`${c.output} shares gated loudness target`);assert(c.peakDbfs<=-3);
  const wav=fs.readFileSync(path.join(project,c.output));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(20),1);assert.equal(wav.readUInt32LE(24),48000);assert.equal(wav.readUInt16LE(34),16);
 }
 for(const c of mapped.filter(c=>c.firstPulseOnly))assert(c.durationMs<200,'Never restart a multi-beep countdown on each simulation tick');
});
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}else console.log(`Action audio passed: ${cases} scenarios, ${simulated} simulated frames, every new clip mapped; no physical-device claim.`);
