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
function step(s, dt = 40, before = origin, after = before) { return advanceSurvival(s, before, after, field, dt); }
function active(s) { return s.encounter.enemies.filter(n => n.active && n.action !== 'death'); }
function emptyPlay(s = createSurvival(123)) { return { ...s, encounter: { ...s.encounter, phase: 'spawning', remaining: 1, spawnMs: 1e9, enemies: s.encounter.enemies.map(n => ({ ...n, active: false })) } }; }
function isolated(fn, ...args) {
  assert(fn.__initData?.code, 'Use actual native serialized worklet');
  const f = vm.runInNewContext(`(${fn.__initData.code})`, {});
  return f.apply({ __closure: fn.__closure }, args);
}

const { bossMode } = load('src/game/bossBalance.ts');
const hpFor = (id, mode, number=1) => id==='bomb-droid' ? ENEMY_DEFS[id].hp : Math.ceil(ENEMY_DEFS[id].hp*bossMode(mode).hp*purgatorioTuning(number,mode).hpMultiplier)*(id==='rock-boss'?.7:id==='skeleton-summoner'?1.2:1);
const purga=load('src/game/purgatorio.ts');
const {PURGATORIO_ROSTER:R,PURGATORIO_CONFIG:C,createPurgatorio,nextPurgatorioEnemy,purgatorioTuning,readPurgatorioProgress,progressAfterVictory,canSelectPurgatorio}=purga;
assert.equal(R.length,13);assert.equal(new Set(R).size,13);assert.deepEqual(Array.from(R),[...MINIBOSS_IDS,...BOSS_IDS.filter(id=>id!=='archer-bandit')]);
assert.equal(createSurvival().purgatorio,null);assert.equal(isolated(createSurvival,5,'easy',{mode:'survival'}).purgatorio,null);
let progress=readPurgatorioProgress(null);assert.equal(progress.cleared.length,0);
for(let i=0;i<R.length;i++){
 for(let j=0;j<R.length;j++)assert.equal(canSelectPurgatorio(R[j],progress),j<=i);
 const unchanged=progressAfterVictory(progress,R[(i+1)%R.length]);if(i<R.length-1)assert.equal(unchanged,progress,'Cannot skip a locked enemy');
 progress=progressAfterVictory(progress,R[i]);assert.equal(progress.cleared.length,i+1);assert.equal(progressAfterVictory(progress,R[i]),progress,'Replay never unlocks twice');
 const raw=JSON.stringify({version:1,cleared:progress.cleared});assert.deepEqual(Array.from(readPurgatorioProgress(raw).cleared),Array.from(progress.cleared));
}
for(const raw of ['invalid','null','[]','{"version":1,"cleared":["guardian"]}','{"version":2,"cleared":["shielder"]}'])assert.equal(readPurgatorioProgress(raw).cleared.length,0);
assert.equal(readPurgatorioProgress(JSON.stringify({version:1,cleared:[R[0],'bad',R[2]]})).cleared.length,1);
assert(!canSelectPurgatorio('skeleton-unarmed',progress));assert(!canSelectPurgatorio('nonexistent',progress));
// First complete roster is deterministic; later picks are reproducible, random,
// include only real specials, and never repeat the previous encounter immediately.
for(const seed of [1,55,991]){
 const a=createPurgatorio({mode:'purgatorio',encounter:'infinite'},seed),b=createPurgatorio({mode:'purgatorio',encounter:'infinite'},seed),seen=[];
 for(let i=0;i<600;i++){seen.push(a.currentId);assert.equal(a.currentId,b.currentId);a.cleared++;b.cleared++;const next=isolated(nextPurgatorioEnemy,a);assert.equal(next,nextPurgatorioEnemy(b));if(i>=R.length-1)assert.notEqual(next,a.currentId);a.currentId=next;b.currentId=next;}
 assert.deepEqual(seen.slice(0,R.length),Array.from(R));assert.equal(new Set(seen.slice(R.length)).size,R.length);
}
for(const mode of ['easy','hard','dystopia']){
 let last=purgatorioTuning(1,mode);
 for(let n=2;n<=10000;n++) {const t=isolated(purgatorioTuning,n,mode);assert(t.hpMultiplier>=last.hpMultiplier&&t.hpMultiplier<3);assert(t.speed>=last.speed);assert(t.combatRate>=last.combatRate&&t.combatRate<=C.maxTempo);assert(t.pressureRate<=1.25);last=t;}
 assert(purgatorioTuning(14,mode).hpMultiplier>purgatorioTuning(13,mode).hpMultiplier);
}
function start(id,mode='easy'){
 let state=createSurvival(71,mode,{mode:'purgatorio',encounter:id});
 for(let i=0;i<180&&!state.boss;i++)state=step(state);
 assert(state.boss);assert.equal(state.boss.id,id==='infinite'?R[0]:id);assert.equal(state.boss.origin,'purgatorio');assert(state.presentation);assert.equal(state.events.bossIntro,1);assert.equal(state.encounter.remaining,0);assert.equal(state.world.ship,null);assert.equal(state.world.zone,null);
 const frozen=JSON.stringify(state);assert.equal(step(state,0),state);assert.equal(JSON.stringify(state),frozen);
 while(state.presentation)state=step(unpause(state));
 return state;
}
function unpause(s){while(s.mode==='upgrade')s=chooseUpgrade(s,s.choices[0],s.upgradeOfferId);return s;}
function killWithSword(state){
 let p={...players.createPlayer(),...origin},ticks=0;state.invulnerableMs=1e9;
 const id=state.purgatorio.currentId,seenPack=new Set();
 while(state.purgatorio.phase==='combat'&&ticks++<20000){
   state=unpause(state);
   // Keep the same real sword/animation/contact engine. Position all required
   // actors in reach for this deterministic test; never fake HP or death.
   for(const key of ['boss','partner'])if(state[key]&&state[key].phase!=='death')state[key]={...state[key],x:origin.x+60,y:origin.y,facingX:1,phase:'recover',phaseMs:0,animationMs:0};
   state.minibosses=state.minibosses.map(m=>{
     if(m.packMember)seenPack.add(m.entityId);
     return m.phase==='death'?m:{...m,x:origin.x+60,y:origin.y,facingX:1,phase:'recover',phaseMs:0,animationMs:0};
   });
   state.encounter.enemies=state.encounter.enemies.map(n=>n.active?{...n,x:origin.x+60,y:origin.y,action:'move'}:n);
   p=applyPlayerUpgrades(p,state);if(p.action!=='attack')p=players.beginAttack({...p,comboMs:0});
   const after=players.advancePlayer(p,players.REST_INPUT,40);state=advanceSurvival(state,p,after,field,40);p=after;
 }
 assert(ticks<20000,'Actual sword clears full encounter '+id);
 if(id==='bomb-droid')assert.equal(seenPack.size,bossMode(state.difficulty).droids-1,'All difficulty-scaled droids must spawn and be defeated');
 assert.equal(state.purgatorio.phase,'defeated');assert.equal(active(state).length,0);assert(state.minibosses.every(m=>m.packMember&&m.phase==='death'&&m.hp===0),'Only completed droid death clips can remain at victory');
 assert(!state.partner||state.partner.hp===0,'Joint bandit encounter cannot complete with a living sibling');
 assert.equal(state.hazards.length,0,'Victory cleans owned attacks');return state;
}
// All 13 unique individual encounters, shared melee, real death clip, terminal victory,
// clean retry, and each difficulty's health cap (including the one-life alias).
let singleKills=0;
for(const mode of ['easy','hard','dystopia'])for(const id of R){
 let s=start(id,mode);assert.equal(s.hp,mode==='dystopia'?1:5);assert.equal(s.maxHp,s.hp);assert.equal(s.boss.maxHp,hpFor(id,mode));if(id==='dagger-bandit'||id==='archer-bandit'){assert(s.partner);assert.equal(s.encounterMaxHp,s.boss.maxHp+s.partner.maxHp);}else assert.equal(s.partner,null);
 s=killWithSword(s);assert.equal(s.purgatorio.cleared,1);assert.equal(s.purgatorio.lastClearedId,id);
 for(let n=0;n<200&&(!s.ending?.ready||s.mode!=='won');n++)s=step(unpause(s));
 assert.equal(s.mode,'won');assert.equal(s.boss,null);assert.equal(s.partner,null);assert.equal(s.minibosses.length,0,'Terminal victory waits for pack death clips');assert.equal(s.events.bossIntro,1);assert.equal(step(s),s);
 assert.equal(createSurvival(99,mode,{mode:'purgatorio',encounter:id}).purgatorio.cleared,0);singleKills++;
}
// Complete 40 successive actual shared-engine fights: initial roster then random,
// no overlap, no legacy 5/10 bosses, no pending ship/calendar, no support softlocks.
let state=start('infinite'),spawned=[state.boss.id],lastHp=state.boss.maxHp,scaledSeen=false;
for(let index=0;index<40;index++){
 assert.equal(state.purgatorio.number,index+1);state=killWithSword(state);assert.equal(state.purgatorio.cleared,index+1);
 for(let n=0;n<200&&(state.boss||state.partner||state.minibosses.length);n++)state=step(unpause(state));
 assert.equal(state.boss,null);assert.equal(state.partner,null);assert.equal(state.minibosses.length,0,'Interlude waits for every required death animation');
 assert.equal(state.purgatorio.phase,'between');const freeze=state;assert.equal(step(state,0),freeze);
 const number=state.purgatorio.number;for(let i=0;i<Math.floor(C.transitionMs/40)-1;i++){state=step(unpause(state));assert.equal(state.boss,null,'No overlap through interlude');assert.equal(active(state).length,0);}
 for(let i=0;i<200&&!state.boss;i++)state=step(unpause(state));
 assert(state.boss,'Next encounter always gets a valid clear spawn');assert.equal(state.purgatorio.number,number);assert.equal(state.boss.id,state.purgatorio.currentId);assert.equal(state.boss.origin,'purgatorio');assert.equal(state.pendingBoss,false);assert.equal(state.world.ship,null);assert.equal(state.encounter.remaining,0);assert(state.minibosses.every(m=>ENEMY_DEFS[m.id].tier==='minion'||m.packMember));
 const expectedHp=hpFor(state.boss.id,'easy',state.purgatorio.number);assert.equal(state.boss.maxHp,expectedHp);lastHp=expectedHp;if(state.boss.id==='bomb-droid')assert.equal(expectedHp,6,'Droid HP remains six at every chain depth');else if(state.purgatorio.number>R.length){assert(expectedHp>ENEMY_DEFS[state.boss.id].hp);scaledSeen=true;}spawned.push(state.boss.id);
 while(state.presentation)state=step(unpause(state));
}
assert.deepEqual(spawned.slice(0,R.length),Array.from(R));for(let i=R.length;i<spawned.length;i++)assert.notEqual(spawned[i],spawned[i-1]);assert.equal(state.events.bossIntro,41);assert(scaledSeen,'The random chain raises HP for eligible bosses without changing droid HP');
// NPC pressure persists, capped, while the single special lives; killing it
// clears those NPCs and even normal Summoner supports before the next intro.
for(const mode of ['easy','hard','dystopia']){
 let s=start('skeleton-summoner',mode);s.invulnerableMs=1e9;
 for(let n=0;n<1200;n++){s=step(s);assert.equal(s.boss.id,'skeleton-summoner');assert(s.minibosses.every(b=>MINION_IDS.includes(b.id)));assert(active(s).length<=({easy:12,hard:18,dystopia:24}[mode]));assert(s.minibosses.filter(b=>b.phase!=='death').length<=bossMode(mode).skeletonLimit);}
 assert(active(s).length>0);assert.equal(s.purgatorio.number,1);s=killWithSword(s);assert.equal(active(s).length,0);assert.equal(s.minibosses.length,0);
}
// One life remains strict, death freezes the whole run and never unlocks a win.
state=start('infinite','dystopia');state.invulnerableMs=0;state.encounter.enemies[0]={...npcApi.emptyNpc(),active:true,id:900,kind:'ghoul',x:origin.x,y:origin.y,action:'move'};state=step(state);assert.equal(state.hp,0);assert.equal(state.mode,'dead');assert.equal(state.purgatorio.cleared,0);assert.equal(step(state).clockMs,state.clockMs);assert.equal(step(state).events.death,1);assert.equal(step(state,0),state);

// Preserve the committed end position in scaled Purgatorio attacks too.
for(const mode of ['easy','dystopia'])for(const id of MINIBOSS_IDS)for(const facingX of [-1,1]){
 let s=start(id,mode);s.invulnerableMs=1e9;s.purgatorio.number=40;s.purgatorio.kind='infinite';
 const rate=purgatorioTuning(40,mode).combatRate;
 s.boss={...s.boss,x:origin.x+facingX*90,y:origin.y,facingX,phase:'attack',phaseMs:0,animationMs:0,attackRootX:0,attackRate:rate,aimAngle:facingX>0?0:Math.PI};
 let n=0,previous=s.boss;
 while(s.boss.phase==='attack'&&n++<1000){s=step(s,8);assert(Math.hypot(s.boss.x-previous.x,s.boss.y-previous.y)<12,id+' scaled root remains continuous');previous=s.boss;}
 assert(n<1000);const end={x:s.boss.x,y:s.boss.y};s=step(s,8);assert(Math.hypot(s.boss.x-end.x,s.boss.y-end.y)<3,id+' no post-attack position reset in Purgatorio');
}
console.log('Purgatorio passed: 13 unique ordered unlocks/safe saves; 30k bounded difficulty samples/native worklets; '+singleKills+' full-HP individual sword victories (joint bandits and complete droid packs) in all3 modes; 40 successive fights with all13 encounters before random repeats, bounded HP/tempo, paused interludes and no special overlap; ordinary/Summoner support pressure; terminal one-life; 24 scaled miniboss attack endings; normal survival remains separate. Simulation, not physical mobile FPS.');
