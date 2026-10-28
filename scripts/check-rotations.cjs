/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.join(root,relative);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const source=fs.readFileSync(file,'utf8');const code=/[\\/](survival|worldEvents)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module:m,exports:m.exports,require:id=>{assert(id.startsWith('.'));const p=path.resolve(path.dirname(file),id);return id.endsWith('.png')?p:load(path.relative(root,p+'.ts'));}},{filename:file});return m.exports;}
const api=load('src/game/survival.ts'),events=load('src/game/worldEvents.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts');
const {REWARD_SITES,SHIP_SITES}=load('src/game/worldEventSites.ts'),{ENEMY_DEFS}=load('src/game/enemyCatalog.ts');
const C=events.WORLD_EVENT_CONFIG,site=REWARD_SITES[0],hero={...players.createPlayer(),x:site.x,y:site.y},outside={...hero,x:site.x+site.radius+25};
const fields=new Map();function field(p){const key=p.x+':'+p.y;if(!fields.has(key))fields.set(key,nav.buildFlowField(p));return fields.get(key);}
function scene(mode='easy'){const s=api.createSurvival(123,mode);s.encounter={...s.encounter,wave:2,phase:'spawning',remaining:1,spawnMs:1e9};s.invulnerableMs=1e9;s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=2;s.world.reinforcementMs=1e9;s.world.missionRotation={remaining:['capture','elite','nest','reactor'],last:null,seed:1,round:1};return s;}
const step=(s,p=hero,dt=40)=>api.advanceSurvival(s,p,p,field(p),dt);
const zone=(id=800)=>({id,siteId:site.id,x:site.x,y:site.y,radius:site.radius,reward:'rhythm',elapsedMs:0,inside:false,requiredMs:C.rewardDurationMs,deadlineElapsedMs:0,penaltyMs:0,started:false});
const boss=(origin='ship')=>({id:'shielder',name:'Shielder',entityId:902,x:hero.x+200,y:hero.y,hp:18,maxHp:18,phase:'intro',phaseMs:0,animationMs:0,pattern:0,lastHitSerial:-1,facingX:-1,aimAngle:0,origin});
let cases=0;function test(name,fn){fn();cases++;console.log('PASS '+name);}

const rotation=load('src/game/rotation.ts'),catalog=load('src/game/enemyCatalog.ts');
for(let seed=0;seed<100;seed++){
 let r=rotation.createRotation(Math.imul(seed,2654435761)),last;
 for(let round=0;round<8;round++){
  const picks=[];for(let n=0;n<4;n++){const p=rotation.peekRotation(r,events.MISSION_EVENT_KINDS);r=p.rotation;
   assert.equal(rotation.peekRotation(r,events.MISSION_EVENT_KINDS).id,p.id);assert.equal(rotation.consumeRotation(r,'invalid'),r);
   if(n===0)assert.notEqual(p.id,last);picks.push(p.id);r=rotation.consumeRotation(r,p.id);last=p.id;
  }assert.equal(new Set(picks).size,4);
 }
}
// Actual start paths, including a queued elite reservation that must not consume a turn.
let bag=rotation.createRotation(3876),missionNames=[];
for(let n=0;n<24;n++){
 let s=scene();s.world.missionRotation=bag;s.world.nextRewardAtMs=0;s.world.nextRewardWave=0;s.world.optional.nextOpportunityMs=0;s.world.optional.nextCheckMs=0;s.clockMs=500000+n*300000;
 const peek=rotation.peekRotation(bag,events.MISSION_EVENT_KINDS);bag=peek.rotation;s.world.missionRotation=bag;
 const blocked={...s,pendingBoss:true};let denied=step(blocked);assert.equal(denied.world.missionRotation.last,bag.last);assert.equal(denied.world.missionRotation.remaining.length,bag.remaining.length);
 s=step(s);
 if(peek.id==='capture')assert(s.world.zone);
 else {assert.equal(s.world.optional.active?.kind,peek.id);
  if(peek.id==='elite'){assert.equal(s.world.optional.active.phase,'queued');assert.equal(s.world.missionRotation.remaining.length,bag.remaining.length);assert.equal(s.events.eventStart??0,0);s.encounter.phase='intermission';s.encounter.timerMs=3000;s=step(s);assert.equal(s.world.optional.active.phase,'warning');assert.equal(s.events.eventStart,1);}
 }
 assert.equal(s.world.missionRotation.remaining.length,bag.remaining.length-1);assert.equal(s.world.missionRotation.last,peek.id);bag=s.world.missionRotation;missionNames.push(peek.id);
}
for(let n=0;n<missionNames.length;n+=4){assert.equal(new Set(missionNames.slice(n,n+4)).size,4);if(n)assert.notEqual(missionNames[n-1],missionNames[n]);}
// Spawn through alternating ship and wave sources, sharing one bag per category.
for(const tier of ['mini','boss']){
 const pool=tier==='mini'?catalog.MINIBOSS_IDS:catalog.BOSS_IDS.filter(id=>id!=='archer-bandit');let bags,draws=[];
 for(let n=0;n<pool.length*4;n++){
  let s=scene();s.rotations=bags??s.rotations;s.clockMs=20000;s.world.checkedShipWave=50;
  const expected=api.selectEnemy(s,tier,false),remaining=s.rotations[tier].remaining.length;
  if(tier==='mini'&&n%2){const ship=SHIP_SITES[0],p={...hero,...ship.spawnPoints[0]};s.world.ship={siteId:ship.id,phase:'alarm',elapsedMs:C.shipWarningMs,enemyId:'shielder',nextTryMs:0};s.encounter.wave=3;s=step(s,p);}
  else {s.encounter.wave=tier==='mini'?4:9;s.encounter.phase='intermission';s.encounter.timerMs=0;s=step(s);}
  for(let retry=0;retry<100&&!s.boss;retry++)s=step(s);
  assert(s.boss);assert.equal(s.boss.id,expected);assert.equal(s.rotations[tier].remaining.length,remaining-1);bags=s.rotations;draws.push(expected);
 }
 for(let n=0;n<draws.length;n+=pool.length){assert.equal(new Set(draws.slice(n,n+pool.length)).size,pool.length);if(n)assert.notEqual(draws[n-1],draws[n]);}
 assert.equal(api.createSurvival().rotations[tier].remaining.length,0,'Each run starts a fresh bag');
}
console.log('Rotation integration passed: 800 shuffled rounds, 24 actual mission starts, queued/denied admission without consumption, 4 boss and mini rounds through shared wave/ship paths, paired Bandits and fresh-run reset.');
