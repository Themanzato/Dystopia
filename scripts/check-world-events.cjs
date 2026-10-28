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

const {WORLD_EVENT_CONFIG:C,canStartSpecial,hasLivingSpecial}=load('src/game/worldEvents.ts');
const {REWARD_SITES,SHIP_SITES}=load('src/game/worldEventSites.ts');
const {attackFrameRoot,attackMotionRoot}=load('src/game/enemyMotion.ts');
const {bossFrame}=load('src/game/survivalAssets.ts');
const {ENEMY_VISUALS}=load('src/game/enemyAnimations.ts');
function quiet(){const s=emptyPlay();s.encounter.wave=2;s.invulnerableMs=1e9;s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=2;s.world.missionRotation={remaining:['capture','elite','nest','reactor'],last:null,seed:1,round:1};return s;}
function localStep(s,p,dt=40){return advanceSurvival(s,p,p,nav.buildFlowField(p),dt)}
function boss(id,p=origin){const d=ENEMY_DEFS[id];return {id,name:d.name,entityId:800,x:p.x+100,y:p.y,hp:d.hp,maxHp:d.hp,facingX:-1,phase:'recover',phaseMs:0,animationMs:0,pattern:0,lastHitSerial:-1,aimAngle:Math.PI,attackRootX:0};}
// Verified clear yards, real existing buildings and six derelict source cells.
assert.equal(REWARD_SITES.length,21);assert.equal(SHIP_SITES.length,6);
for(const site of REWARD_SITES){assert(map.PROPS.some(p=>p.id===site.id));assert(collision.isWalkable(site.x,site.y));assert(nav.isReachable(site,nav.buildFlowField(origin)));for(let i=0;i<32;i++)assert(collision.isWalkable(site.x+Math.cos(i*Math.PI/16)*site.radius,site.y+Math.sin(i*Math.PI/16)*site.radius));}
for(const ship of SHIP_SITES){const prop=map.PROPS.find(p=>p.id===ship.id);assert(prop);assert.equal(prop.source.width,80);assert.equal(prop.source.height,80);assert(ship.spawnPoints.length>=12);for(const point of ship.spawnPoints)assert(collision.isWalkable(point.x,point.y));}
const site=REWARD_SITES[0],inside={...origin,x:site.x,y:site.y},outside={...inside,x:site.x+site.radius+25};
let s=quiet();s.world.zone={...site,id:500,siteId:site.id,reward:'rhythm',elapsedMs:0,inside:false};
const insideField=nav.buildFlowField(inside),outsideField=nav.buildFlowField(outside);
for(let i=0;i<200;i++)s=advanceSurvival(s,inside,inside,insideField,40);
assert.equal(s.world.zone.elapsedMs,8000);assert(s.world.zone.inside);const frozen=JSON.stringify(s);assert.equal(advanceSurvival(s,inside,inside,insideField,0),s);assert.equal(JSON.stringify(s),frozen);
for(let i=0;i<200;i++)s=advanceSurvival(s,outside,outside,outsideField,40);
assert.equal(s.world.zone.elapsedMs,8000);assert.equal(s.world.zone.inside,false);
assert.equal(s.world.zone.requiredMs,18000);assert.equal(s.world.zone.deadlineElapsedMs,16000);
const paused={...s,mode:'upgrade'};assert.equal(advanceSurvival(paused,inside,inside,insideField,40),paused);
for(let i=0;i<249;i++)s=advanceSurvival(s,inside,inside,insideField,40);
assert.equal(s.upgrades.rhythm,0);assert.equal(s.world.zone.elapsedMs,17960);
s=advanceSurvival(s,inside,inside,insideField,40);assert.equal(s.world.zone,null);assert.equal(s.events.zoneReward,1);assert.equal(s.upgrades.rhythm,1);assert(s.world.notice.text.includes('acero'));
for(let i=0;i<100;i++)s=advanceSurvival(s,inside,inside,insideField,40);
assert.equal(s.events.zoneReward,1);assert.equal(s.world.notice,null);assert.equal(s.upgrades.rhythm,1);
// Exactly one active yard; capped rewards become the advertised EXP fallback.
s=quiet();s.encounter.wave=6;s.world.nextRewardWave=2;s=step(s);const id=s.world.zone.id;for(let i=0;i<100;i++)s=step(s);assert.equal(s.world.zone.id,id);
s=quiet();s.upgrades.rhythm=UPGRADE_INFO.rhythm.cap;s.world.zone={...site,id:600,siteId:site.id,reward:'rhythm',elapsedMs:9960,inside:false};s=advanceSurvival(s,inside,inside,insideField,40);assert.equal(s.xp,32);assert.equal(s.upgrades.rhythm,UPGRADE_INFO.rhythm.cap);assert.equal(s.events.zoneReward,1);
// Own alarm reserves the single special slot; no other special may enter it.
s=quiet();assert(canStartSpecial(s,'scheduled'));s.world.ship={siteId:SHIP_SITES[0].id,phase:'alarm',elapsedMs:0,enemyId:'dagger-mush',nextTryMs:0};assert(!canStartSpecial(s,'scheduled'));assert(canStartSpecial(s,'ship'));s.pendingBoss=true;assert(!canStartSpecial(s,'ship'));s.pendingBoss=false;s.boss=boss('shielder');assert(!canStartSpecial(s,'ship'));assert(hasLivingSpecial(s));s.boss.phase='death';assert(!hasLivingSpecial(s));assert(!canStartSpecial(s,'ship'),'Death clip retains slot');s.boss=null;s.world.ship=null;s.minibosses=[boss('skeleton-unarmed')];assert(canStartSpecial(s,'scheduled'),'Normal skeleton is not a special');s.minibosses=[boss('evil-sage')];assert(!canStartSpecial(s,'scheduled'));
// All six ships warn for the entire 3 seconds and release one clear miniboss.
for(const ship of SHIP_SITES){
 const p={...origin,...ship.spawnPoints[0]},f=nav.buildFlowField(p);let scene=quiet();scene.encounter.wave=3;scene.world.checkedShipWave=3;scene.world.ship={siteId:ship.id,phase:'armed',elapsedMs:6000,enemyId:'dagger-mush',nextTryMs:0};
 scene=advanceSurvival(scene,p,p,f,40);assert.equal(scene.world.ship.phase,'alarm');assert.equal(scene.events.shipAlarm,1);assert.equal(scene.boss,null);
 for(let i=0;i<74;i++)scene=advanceSurvival(scene,p,p,f,40);assert.equal(scene.boss,null);assert.equal(scene.world.ship.elapsedMs,2960);assert.equal(scene.events.shipAlarm,3);
 for(let i=0;i<60&&!scene.boss;i++)scene=advanceSurvival(scene,p,p,f,40);
 assert(scene.boss,'Each ship has a usable exit');assert.equal(scene.boss.origin,'ship');assert.equal(scene.world.ship,null);assert.equal(scene.boss.phase,'intro');assert.equal(scene.events.boss,1);assert.equal(scene.events.bossIntro,0);assert.equal(scene.presentation,null);assert(Math.hypot(scene.boss.x-p.x,scene.boss.y-p.y)>=C.shipSafeDistance);assert(collision.isWalkable(scene.boss.x,scene.boss.y));
}
// A competing special cancels an armed/alarming ship immediately, no late queue.
for(const phase of ['armed','alarm']){s=quiet();s.world.ship={siteId:SHIP_SITES[0].id,phase,elapsedMs:2990,enemyId:'shielder',nextTryMs:0};s.boss=boss('rock-boss');s=step(s);assert.equal(s.world.ship,null);assert.equal(s.events.shipAlarm,0);assert.equal(s.boss.id,'rock-boss');}
// An occupied scheduled slot skips this special without blocking common spawns.
s=quiet();s.boss=boss('shielder');s.boss.phase='intro';s.encounter.phase='intermission';s.encounter.wave=4;s.encounter.timerMs=0;s=step(s);assert.equal(s.encounter.wave,5);assert.equal(s.pendingBoss,false);assert(active(s).length>0);assert.equal(s.boss.id,'shielder');
// Pressure continues even after the wave's original ordinary quota is exhausted.
s=quiet();s.boss=boss('rock-boss');s.encounter.remaining=0;s.encounter.phase='clearing';for(let i=0;i<1000;i++){s=step(s);assert(s.minibosses.every(m=>ENEMY_DEFS[m.id].tier==='minion'));assert.equal(s.boss.id,'rock-boss');}assert(active(s).length>0&&active(s).length<=12);assert.equal(s.encounter.wave,2);
s.boss=null;s.minibosses=[];s.encounter.enemies=s.encounter.enemies.map(n=>({...n,active:false}));s=step(s);assert.equal(s.encounter.phase,'intermission');for(let i=0;i<76;i++)s=step(s);assert.equal(s.encounter.wave,3);assert.equal(s.boss,null);assert.equal(s.pendingBoss,false);
// Authored horizontal root translation belongs to world physics, not a reset.
let attacks=0;
for(const id of MINIBOSS_IDS)for(const facing of [-1,1])for(const offset of [-24,0,24]){
 const p={...origin,y:origin.y+offset},f=nav.buildFlowField(p);let scene=quiet();scene.boss={...boss(id,p),x:p.x+facing*90,facingX:facing,aimAngle:facing>0?0:Math.PI,phase:'attack',phaseMs:0,attackRootX:0};
 const move=bossAttack(id);let ticks=0,previous=scene.boss;
 while(scene.boss.phase==='attack'&&ticks++<500){scene=advanceSurvival(scene,p,p,f,8);const b=scene.boss;assert(Math.hypot(b.x-previous.x,b.y-previous.y)<12,id+' continuous attack translation');const frame=bossFrame(b);if(b.phase==='attack'){const clip=ENEMY_VISUALS[id][move.clip]??ENEMY_VISUALS[id].attack;const index=Math.min(clip.frames-1,Math.floor(b.phaseMs/move.durationMs*clip.frames));assert.equal(frame.pivotX,clip.pivotX+attackFrameRoot(id,index,move.clip));}previous=b;}
 assert(ticks<500);const end={x:scene.boss.x,y:scene.boss.y};assert.equal(scene.boss.attackRootX,0);scene=advanceSurvival(scene,p,p,f,8);assert(Math.hypot(scene.boss.x-end.x,scene.boss.y-end.y)<3,id+' keeps final world location');
 // Repeating the authored attack never restores its earlier world position.
 scene.boss={...scene.boss,phase:'attack',phaseMs:0,animationMs:0,attackRootX:0};for(let i=0;i<Math.ceil(move.durationMs/8)+1;i++)scene=advanceSurvival(scene,p,p,f,8);assert(collision.isWalkable(scene.boss.x,scene.boss.y));attacks+=2;
}
// An attack interrupted by a lethal rear sword strike keeps the committed feet.
s=quiet();const swing={...players.beginAttack(origin),actionMs:65};s.boss={...boss('dagger-mush'),x:origin.x+60,hp:1,facingX:1,phase:'attack',phaseMs:500,attackRootX:42};const deathX=s.boss.x;s=step(s,4,swing,players.advancePlayer(swing,players.REST_INPUT,4));assert.equal(s.boss.phase,'death');assert.equal(s.boss.x,deathX);assert.equal(s.boss.attackRootX,0);
s=quiet();s.boss={...boss('dagger-mush'),phase:'recover',attackRootX:42};const interrupted={x:s.boss.x,y:s.boss.y};s=step(s,8);assert.equal(s.boss.attackRootX,0);assert(Math.hypot(s.boss.x-interrupted.x,s.boss.y-interrupted.y)<3,'External state interruption clears only visual cursor');
s=quiet();s.boss={...boss('dagger-mush'),x:origin.x+60,facingX:1,phase:'attack',phaseMs:500,attackRootX:attackMotionRoot('dagger-mush',500,bossAttack('dagger-mush').durationMs)};const hpBefore=s.boss.hp,hitX=s.boss.x;s=step(s,4,swing,players.advancePlayer(swing,players.REST_INPUT,4));assert.equal(s.boss.hp,hpBefore-1);assert.equal(s.boss.phase,'attack');assert(Math.abs(s.boss.x-hitX)<5,'Nonlethal hit preserves committed movement');
assert.equal(attackMotionRoot('dagger-mush',1e5,1000),54);assert.equal(attackFrameRoot('shock-sweeper',99),28);assert.equal(attackFrameRoot('shielder',4),0);
console.log('World events passed: 21 clear reward yards, 10s enter/leave/resume/once-only reward, 6 ships with 3s warning and valid exits, shared special exclusion/skip/no backlog, sustained normal NPC pressure, '+attacks+' miniboss attack cycles/both facings/interruption with no reset. Simulation, not physical mobile FPS.');
