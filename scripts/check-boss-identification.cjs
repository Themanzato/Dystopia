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
  const code = /(?:survival|purgatorio)\.ts$/.test(filename) ? babel.transformSync(fs.readFileSync(filename, 'utf8'), {
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
const api = load('src/game/survival.ts');
const players = load('src/game/player.ts'), combat = load('src/game/combat.ts');
const nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts'), npcApi = load('src/game/npc.ts');
const map = load('src/game/map.ts');
const catalog = load('src/game/enemyCatalog.ts');
const { bossAttack } = load('src/game/bossAttacks.ts');
const { MINIBOSS_IDS, BOSS_IDS, MINION_IDS, ENEMY_DEFS } = catalog;
const { createSurvival, advanceSurvival, chooseUpgrade, chooseChest, wavePlan, applyPlayerUpgrades, xpRequirement, SURVIVAL_CONFIG, UPGRADE_INFO, selectEnemy } = api;
let origin;
for (let y = 950; !origin && y <= 1900; y += 24) for (let x = 900; !origin && x <= 2000; x += 24) {
  let clear = collision.isWalkable(x, y);
  for (let r = 8; clear && r <= 150; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x + Math.cos(i * Math.PI / 16) * r, y + Math.sin(i * Math.PI / 16) * r)) { clear = false; break; }
  if (clear) origin = { ...players.createPlayer(), x, y };
}
assert(origin);
const field = nav.buildFlowField(origin);
function step(s, dt = 40, before = origin, after = before) { return isolated(advanceSurvival,s,before,after,field,dt); }
function active(s) { return s.encounter.enemies.filter(n => n.active && n.action !== 'death'); }
function emptyPlay(s = createSurvival(123)) { return { ...s, encounter: { ...s.encounter, phase: 'spawning', remaining: 1, spawnMs: 1e9, enemies: s.encounter.enemies.map(n => ({ ...n, active: false })) } }; }
function isolated(fn, ...args) {
  assert(fn.__initData?.code, 'Use actual native serialized worklet');
  const f = vm.runInNewContext(`(${fn.__initData.code})`, {});
  return f.apply({ __closure: fn.__closure }, args);
}


const {PURGATORIO_ROSTER:R,canonicalPurgatorioEnemy}=load('src/game/purgatorio.ts');
let checks=0;
function spawn(id,kind='survival',difficulty='easy'){
 let s=createSurvival(71,difficulty,{mode:'purgatorio',encounter:'infinite'});s.purgatorio.currentId=id;
 for(let n=0;n<200&&(!s.boss||s.presentation);n++){s.invulnerableMs=1e9;s=step(s);}
 assert(s.boss&&!s.presentation);s.invulnerableMs=1e9;
 if(kind==='survival'){s.purgatorio=null;s.boss.origin='scheduled';}
 else if(kind==='single')s.purgatorio.kind='single';
 else if(kind==='tutorial'){s.tutorial={step:'dummy'};s.purgatorio=null;}
 s.encounter.enemies=s.encounter.enemies.map(()=>npcApi.emptyNpc());s.encounter.remaining=1;s.encounter.spawnMs=1e9;
 return s;
}
let serial=100;
function strike(s,key='boss',index=0){
 const b=key==='mini'?s.minibosses[index]:s[key];assert(b&&b.phase!=='death');
 for(const name of ['boss','partner'])if(s[name]&&s[name]!==b&&s[name].phase!=='death')s[name]={...s[name],x:origin.x+260,y:origin.y};
 const target={...b,x:origin.x+60,y:origin.y,facingX:1,phase:'recover',phaseMs:0,animationMs:0,hp:1};
 if(key==='mini')s.minibosses=s.minibosses.map((v,i)=>i===index?target:v);else s[key]=target;
 const before={...origin,action:'attack',actionMs:65,attackIndex:0,attackSerial:++serial},after={...before,actionMs:105};
 const next=step(s,40,before,after);checks++;
 assert((key==='mini'?next.minibosses[index]:next[key])?.hp===0,'Real sword must apply lethal damage');return next;
}
for(const mode of ['easy','hard','dystopia'])for(const kind of ['survival','infinite'])for(const id of R){
 let s=spawn(id,kind,mode);assert.equal((s.identifiedDefeats??[]).length,0,'Appearance and introduction never identify');
 s=strike(s);
 if(id==='dagger-bandit'){assert.equal((s.identifiedDefeats??[]).length,0,'One sibling is not the joint encounter');s=strike(s,'partner');}
 if(id==='bomb-droid'){
   for(let n=0;n<1000&&!(s.identifiedDefeats??[]).length;n++){
     for(const key of ['boss','partner'])if(s[key]?.hp>0)s=strike(s,key);
     for(let i=0;i<s.minibosses.length;i++)if(s.minibosses[i].hp>0)s=strike(s,'mini',i);
     if((s.boss?.packRemaining??0)>0||s.minibosses.some(m=>m.packMember&&m.hp>0))assert.equal((s.identifiedDefeats??[]).length,0,'Unfinished droid group never identifies');
     s=step(s);
   }
 }
 if(id==='the-plague'){
   assert.equal((s.identifiedDefeats??[]).length,0,'One insect cannot identify the whole swarm');
   for(let i=0;i<s.minibosses.length;i++)if(s.minibosses[i].hp>0){
     const last=s.minibosses.filter(m=>m.hp>0).length===1;
     s=strike(s,'mini',i);
     if(!last)assert.equal((s.identifiedDefeats??[]).length,0,'Every real insect must be defeated to identify The Plague');
   }
 }
 assert.deepEqual(Array.from(s.identifiedDefeats??[]),[canonicalPurgatorioEnemy(id)],kind+'/'+mode+'/'+id);
 for(let n=0;n<8;n++)s=step(s);assert.equal(s.identifiedDefeats.length,1,'Death frames cannot duplicate a defeat');
}
for(const kind of ['single','tutorial']){let s=spawn('evil-sage',kind);s=strike(s);assert.equal((s.identifiedDefeats??[]).length,0,kind+' cannot grant progress');}
let s=spawn('electrocutioner');const owner=s.boss.entityId;
s.boss={...s.boss,x:origin.x+300,y:origin.y};s.minibosses=[{...s.boss,entityId:999,cloneOf:owner,x:origin.x+60,y:origin.y,hp:1,maxHp:1,phase:'recover'}];s=strike(s,'mini');assert.equal((s.identifiedDefeats??[]).length,0,'A clone is not a principal boss');
s=spawn('guardian');s.boss={...s.boss,hp:0,phase:'death',phaseMs:9999};s=step(s);assert.equal((s.identifiedDefeats??[]).length,0,'Skipping a death animation is not lethal damage confirmation');
s=spawn('guardian');s.mode='dead';s.hp=0;s=step(s);assert.equal((s.identifiedDefeats??[]).length,0,'Losing before the kill never identifies');
s=spawn('guardian');const target=s.boss;s.boss={...target,x:origin.x+60,y:origin.y,hp:2,phase:'recover'};const p={...origin,action:'attack',actionMs:65,attackIndex:0,attackSerial:++serial};s=step(s,40,p,{...p,actionMs:105});assert.equal(s.boss.hp,1);assert.equal((s.identifiedDefeats??[]).length,0,'Nonlethal real damage never identifies');
const first=spawn('archer');let a=strike(first);const second=spawn('guardian');second.identifiedDefeats=a.identifiedDefeats;a=strike(second);assert.deepEqual(Array.from(a.identifiedDefeats),['archer','guardian'],'Cumulative victories keep earlier IDs in a batched update');
console.log('Boss identification combat passed: '+checks+' real lethal sword strikes, all 14 encounters in Survival/Infinite and all 3 difficulties; joint pair/group gates, clone exclusion, tutorial/single exclusion, nonlethal damage, early loss, animation skipping and dedup. Pure serialized-worklet simulation; no persistent test writes.');
