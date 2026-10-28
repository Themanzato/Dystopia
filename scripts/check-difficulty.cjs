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
  const code = /(?:survival|difficulty|bossAttacks|survivalAssets)\.ts$/.test(filename) ? babel.transformSync(fs.readFileSync(filename, 'utf8'), {
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
const players = load('src/game/player.ts');
const nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts'), npcApi = load('src/game/npc.ts');
const catalog = load('src/game/enemyCatalog.ts');
const { bossAttack } = load('src/game/bossAttacks.ts');
const { MINIBOSS_IDS, BOSS_IDS, MINION_IDS, ENEMY_DEFS } = catalog;
const { createSurvival, advanceSurvival, chooseUpgrade, wavePlan } = api;
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

const { DIFFICULTIES, difficultyTuning } = load('src/game/difficulty.ts');
const { bossAttackCount } = load('src/game/bossAttacks.ts');
const { bossFrame } = load('src/game/survivalAssets.ts');
const { bossMode, BOSS_BALANCE } = load('src/game/bossBalance.ts');
const { ENEMY_VISUALS } = load('src/game/enemyAnimations.ts');
const maximumImage = Math.max(...Object.values(ENEMY_VISUALS).flatMap(visual => Object.values(visual).filter(Boolean).map(clip => clip.image)));
const legacyImpactKinds = new Set(['melee','area','charge','line']);
const hazardImpactKinds = new Set(['projectile','laser','volley','explosion','slam','jump','lightning']);
function checkPreparedHazard(id,index) {
 let state=fixture(id,index,'recover');state.invulnerableMs=0;state.boss.x=origin.x-140;state.boss.y=origin.y;state.boss.pattern=index;state.boss.phaseMs=1e9;
 if(id==='dust-jumper' && index===1)state.boss.hp=Math.floor(state.boss.maxHp*0.6);
 state=step(state,4);assert.equal(state.boss.attackIndex,index,id+'/'+index+' prepares the requested pattern');assert.equal(state.boss.phase,'warning');
 const first=state.hazards.find(h=>h.owner===state.boss.entityId);assert(first,id+'/'+index+' creates a real simulation hazard');
 let target={...origin};
 if(first.kind==='beam')target={...origin,x:first.x+Math.cos(first.angle)*90,y:first.y+Math.sin(first.angle)*90};
 else if(first.kind==='ball'||first.kind==='arrow')target={...origin,x:first.x+Math.cos(first.angle)*110,y:first.y+Math.sin(first.angle)*110};
 else if(id!=='dust-jumper'||index!==1) target={...origin,x:first.x,y:first.y};
 for(let tick=0;tick<2000&&state.hp===5;tick++){
  const h=state.hazards.find(h=>h.id===first.id);assert(h,id+'/'+index+' hazard survives until its impact');
  if(h.kind==='beam')target={...target,x:h.x+Math.cos(h.angle)*90,y:h.y+Math.sin(h.angle)*90};
  const harmless=h.ageMs+4<h.warningMs;state=step(state,4,target,target);
  if(harmless)assert.equal(state.hp,5,id+'/'+index+' warning cannot hurt');
 }
 assert.equal(state.hp,4,id+'/'+index+' real hazard deals damage during its active interval');
 assert(state.hazards.length<=BOSS_BALANCE.maxHazards);
}

let s;
for (const mode of ['easy','hard','dystopia']) {
  const start = isolated(createSurvival, 91, mode);
  assert.equal(start.difficulty, mode); assert.equal(start.hp, DIFFICULTIES[mode].hp);
  let speed = 0, tempo = 0;
  for (let wave=1;wave<=5000;wave++) {
    const t = difficultyTuning(wave, mode), serialized = isolated(difficultyTuning, wave, mode);
    assert.equal(JSON.stringify(t), JSON.stringify(serialized));
    assert(t.count>0 && t.count<=60); assert(t.intervalMs>=150 && t.groupPauseMs>=650); assert(t.speed>=speed && t.speed<1.73); assert(t.combatRate>=tempo && t.combatRate<1.44);
    assert(wave===1 || t.speed-speed<0.01); speed=t.speed;tempo=t.combatRate;
    assert.equal(wavePlan(wave, mode).boss, wave%10===0?'boss':wave%10===5?'mini':null);
    if(wave>1 && ![1,5,6,10].includes((wave-1)%10+1)) assert(t.count>=difficultyTuning(wave-1,mode).count);
  }
}
assert.equal(wavePlan(1,'easy').count,7); assert.equal(wavePlan(1,'easy').intervalMs,350); assert.equal(wavePlan(1,'easy').groupPauseMs,1550);
for(let w=1;w<=10;w++)assert.equal(wavePlan(w,'easy').count,[7,10,12,15,3,9,14,17,20,2][w-1]);
for(const w of [1,9,49,999]) { const a=difficultyTuning(w,'easy'),b=difficultyTuning(w,'hard'),c=difficultyTuning(w,'dystopia'); assert(a.count<=b.count&&b.count<=c.count);assert(a.speed<b.speed&&b.speed<c.speed);assert(a.intervalMs>=b.intervalMs&&b.intervalMs>=c.intervalMs); }
function sandbox(mode='easy',wave=1){const state=createSurvival(981,mode);return {...emptyPlay(state),encounter:{...emptyPlay(state).encounter,wave}}}
function fixture(id,index=0,phase='recover',mode='easy') { const state=sandbox(mode);const d=ENEMY_DEFS[id];return {...state,invulnerableMs:1e9,boss:{id,name:d.name,entityId:900,x:origin.x+100,y:origin.y,facingX:-1,hp:d.hp,maxHp:d.hp,phase,phaseMs:0,animationMs:0,pattern:0,lastHitSerial:-1,aimAngle:Math.PI,attackIndex:index,attackRate:1,summonMs:0}} }
function motion(mode,wave){let state=sandbox(mode,wave);state.encounter.enemies[0]={...npcApi.emptyNpc(),active:true,id:10,kind:'ghoul',action:'move',x:origin.x+120,y:origin.y,facingX:-1};const x=state.encounter.enemies[0].x;state=step(state,40);return x-state.encounter.enemies[0].x}
assert(motion('easy',49)>motion('easy',1));assert(motion('hard',1)>motion('easy',1));assert(motion('dystopia',1)>motion('hard',1));
// One life cannot be increased by chosen upgrades or physical chests, and death
// is terminal. Retry creates an entirely new one-life run, never resumes death.
s=sandbox('dystopia');s.orbs=[{id:1,x:origin.x,y:origin.y,value:105,lifeMs:10000}];s=step(s);assert.equal(s.level,3);assert.equal(s.mode,'upgrade');assert(!s.choices.includes('vitality'));assert(!api.upgradeOptions(s).includes('vitality'));s=chooseUpgrade(s,s.choices[0]);assert.equal(s.maxHp,1);assert.equal(s.hp,1);
s.encounter.enemies[0]={...npcApi.emptyNpc(),active:true,id:11,kind:'ghoul',action:'move',x:origin.x,y:origin.y};s=step(s);assert.equal(s.mode,'dead');assert.equal(s.hp,0);assert.equal(s.events.death,1);const dead=s;for(let i=0;i<100;i++)s=step(s);assert.equal(s.clockMs,dead.clockMs);assert.equal(s.events.death,1);assert.equal(s.hp,0);assert(s.ending.ready);assert.equal(step(s),s);assert.equal(createSurvival(92,'dystopia').hp,1);
// Every scheduled boss and mini has a single intro. Combat/spawn/reward clocks
// freeze during its simulation-owned presentation while zero-dt/pause is exact.
const introduced=new Set();for(let seed=1;seed<=70;seed++){
 let state={...createSurvival(Math.imul(seed,2654435761)),invulnerableMs:900,encounter:{...createSurvival(Math.imul(seed,2654435761)).encounter,wave:9,phase:'intermission',timerMs:0}};state=step(state);for(let retry=0;retry<250&&!state.presentation;retry++)state=step(state);assert(state.presentation&&state.boss, 'Bounded valid spawn search at seed '+seed);introduced.add(state.boss.id);assert.equal(state.events.bossIntro,1);const remaining=state.encounter.remaining,clock=state.clockMs,initialActive=active(state).length;
 const freeze=state;assert.equal(step(state,0),freeze);
 while(state.presentation){assert.equal(state.encounter.remaining,remaining);assert.equal(state.clockMs,clock);assert.equal(active(state).length,initialActive);state=step(state)}assert.equal(state.boss.phase,'recover');assert.equal(state.events.bossIntro,1);state=step(state);assert.equal(state.events.bossIntro,1);
}assert.equal(introduced.size,BOSS_IDS.filter(id=>id!=='archer-bandit').length);
let mini={...createSurvival(2),encounter:{...createSurvival(2).encounter,wave:4,phase:'intermission',timerMs:0}};mini=step(mini);for(let retry=0;retry<250&&!mini.presentation;retry++)mini=step(mini);assert(MINIBOSS_IDS.includes(mini.boss.id)&&mini.presentation);
// Every alternative uses real clips. Boundary samples exercise follow-up strips
// and frame-rate acceleration without changing the animation/impact alignment.
for(const id of BOSS_IDS){assert(bossAttackCount(id)>1);for(let i=0;i<bossAttackCount(id);i++){
 const move=bossAttack(id,i);for(const rate of [1,1.25,1.4])for(const fraction of [0,.25,.55,.9,1,10]){const f=isolated(bossFrame,{id,phase:'attack',phaseMs:move.durationMs/rate*fraction,animationMs:0,attackIndex:i,attackRate:rate});assert(f.image>=5&&f.image<=maximumImage);assert(f.source.x>=0&&f.source.y>=0)}
 let state=fixture(id,i,'attack');state.invulnerableMs=0;state.boss.x=origin.x-Math.max(45,move.range*(move.kind==='charge'?.5:.7));state.boss.facingX=1;state.boss.aimAngle=0;
 if(legacyImpactKinds.has(move.kind)) {state.boss.phaseMs=move.activeStartMs-8;state=step(state,4);assert.equal(state.hp,5,id+'/'+i+' tell is harmless');for(let n=0;n<6;n++)state=step(state,4);assert.equal(state.hp,4,id+'/'+i+' hits only in its active window');}
 else if(hazardImpactKinds.has(move.kind))checkPreparedHazard(id,i);
 else {assert(['summon','evade','teleport','burrow'].includes(move.kind),'Every authored kind is classified');state.boss.phaseMs=Math.max(0,move.activeStartMs-8);for(let n=0;n<8;n++)state=step(state,4);assert.equal(state.hp,5,id+'/'+i+' neutral action does not invent contact damage');}
}}
// A full summon cast shows its pose first and emits one mode-sized group on
// its authored active frame. Regular melee continues between recurring casts.
s=fixture('skeleton-summoner');s.boss.x=origin.x+280;s.boss.phaseMs=2000;s.boss.summonMs=12000;s=step(s);assert.equal(s.boss.attackIndex,1);assert.equal(s.boss.phase,'warning');assert.equal(s.minibosses.length,0);
while(s.boss.phase==='warning')s=step(s);assert.equal(s.boss.phase,'attack');assert.equal(s.minibosses.length,0);while(s.minibosses.length===0)s=step(s);assert.equal(s.minibosses.length,bossMode('easy').skeletonGroup);assert(s.minibosses.every(m=>MINION_IDS.includes(m.id)));const firstId=s.minibosses[0].entityId;const firstGroup=s.minibosses.map(m=>m.entityId);for(let n=0;n<6;n++)s=step(s);assert.deepEqual(s.minibosses.map(m=>m.entityId),firstGroup,'The same cast does not emit its group again every frame');
let sawMelee=false,summonIds=new Set([firstId]);for(let n=0;n<1400;n++){s=step(s);if(s.boss.phase==='attack'&&s.boss.attackIndex===0)sawMelee=true;assert(s.minibosses.length<=bossMode('easy').skeletonLimit);for(const m of s.minibosses){summonIds.add(m.entityId);assert(MINION_IDS.includes(m.id)&&m.hp===1)}}assert(sawMelee);assert(summonIds.size>=bossMode('easy').skeletonGroup*2);assert.equal(s.minibosses.length,bossMode('easy').skeletonLimit);
s.minibosses=[];for(let n=0;n<500&&s.minibosses.length===0;n++)s=step(s);assert(s.minibosses.length>0,'Summoning resumes after support slots are cleared');
// The principal and its three ordinary supports share one action reservation. No overlapping
// dangerous specials, including Dystopia's highest combat tempo.
for(const mode of ['easy','hard','dystopia']){let state=fixture('rock-boss',0,'recover',mode);state.encounter.wave=99;state.minibosses=['skeleton-unarmed','skeleton-archer','skeleton-swordsman'].map((id,i)=>({...fixture(id).boss,entityId:100+i,x:origin.x+[80,-80,0][i],y:origin.y+[0,0,80][i]}));let attacks=0;for(let n=0;n<1100;n++){state=step(state);const busy=[state.boss,...state.minibosses].filter(b=>b&&['warning','attack'].includes(b.phase));assert(busy.length<=1,'Only one announced boss special at a time');attacks=state.events.bossAttack;assert(state.minibosses.length<=3);assert.equal(state.projectiles.length,0);assert(state.hazards.length<=BOSS_BALANCE.maxHazards)}assert(attacks>=4);}
console.log('Difficulty checks passed: 15000 bounded wave plans/native worklets; Easy original starts; perceptible speed/count/tempo per mode; Dystopia terminal one-life; 7 bosses+minis single paused introductions; all authored move variants and real active hazards; recurring grouped Summoner and intervening melee; mode-bounded skeletons and ordinary supports; serialized boss actions in all modes.');
