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
test('Separate deadline, accumulated capture and capped outside penalty',()=>{
 assert.equal(C.rewardDurationMs,10000);
 let z=events.advanceCapture(zone(),true,4000).zone;assert.equal(z.elapsedMs,4000);
 z=events.advanceCapture(z,false,5000).zone;assert.equal(z.elapsedMs,4000);assert.equal(z.requiredMs,15000);assert.equal(z.deadlineElapsedMs,9000);
 const result=events.advanceCapture(z,true,11000);assert(result.complete&&!result.failed);assert.equal(result.zone.elapsedMs,15000);assert.equal(result.zone.deadlineElapsedMs,20000);
 const capped=events.advanceCapture(z,false,100000);assert(capped.failed);assert.equal(capped.zone.requiredMs,40000);assert.equal(capped.zone.elapsedMs,4000);assert.equal(capped.zone.deadlineElapsedMs,90000);
 const travel=events.advanceCapture(zone(),false,20000);assert.equal(travel.zone.requiredMs,10000);assert.equal(travel.zone.deadlineElapsedMs,20000);
 assert(events.advanceCapture(travel.zone,true,10000).complete);

});
test('Normal-wave capture queues a single ship opportunity across wave changes',()=>{
 let s=scene();s.encounter.wave=3;s.world.zone=zone();s.world.lastEventStartMs=0;
 for(let i=0;i<100;i++)s=step(s);assert(s.world.zone);assert.equal(s.world.ship,null);assert.equal(s.world.pendingShipWave,3);assert.equal(s.events.shipAlarm,0);
 s.encounter.wave=4;s.world.zone={...s.world.zone,elapsedMs:C.rewardDurationMs-40,requiredMs:C.rewardDurationMs};s=step(s);assert.equal(s.world.zone,null);assert.equal(s.world.pendingShipWave,3);
 for(let i=0;i<200&&!s.world.ship;i++)s=step(s);assert(s.world.ship);assert.equal(s.world.pendingShipWave,null);assert.equal(s.events.zoneReward,1);assert(s.clockMs>=C.eventSeparationMs);
});
test('Ship alarm and living ship miniboss postpone capture until encounter cleanup',()=>{
 const ship=SHIP_SITES[0],p={...hero,...ship.spawnPoints[0]};let s=scene();s.encounter.wave=3;s.world.checkedShipWave=3;s.world.nextRewardWave=2;
 s.world.ship={siteId:ship.id,phase:'alarm',elapsedMs:0,enemyId:'dagger-mush',nextTryMs:0};
 for(let i=0;i<150&&!s.boss;i++){s=step(s,p);assert.equal(s.world.zone,null);}
 assert(s.boss);assert.equal(s.boss.origin,'ship');const entity=s.boss.entityId;
 for(let i=0;i<80;i++){s=step(s,p);assert.equal(s.world.zone,null);assert.equal(s.boss.entityId,entity);}
 s.boss={...s.boss,hp:0,phase:'death',phaseMs:ENEMY_DEFS[s.boss.id].deathDurationMs};
 for(let i=0;i<250&&!s.world.zone;i++)s=step(s,p);assert.equal(s.boss,null);assert(s.world.zone);assert.equal(s.world.ship,null);
});
test('Wave 25 admission exception still separates starts by eight seconds',()=>{
 assert.equal(events.ADVANCED_EVENT_OVERLAP_WAVE,25);
 for(const wave of [24,25]){const s=scene();s.encounter.wave=wave;s.clockMs=20000;s.world.zone=zone();s.world.lastEventStartMs=10000;
   assert.equal(events.canRunWorldEvent(s,'ship',wave,s.clockMs),wave===25);
   s.world.lastEventStartMs=s.clockMs;assert(!events.canRunWorldEvent(s,'ship',wave,s.clockMs));
 }
 let s=scene();s.encounter.wave=27;s.world.nextRewardWave=2;s.world.checkedShipWave=26;
 s=step(s,outside);const first=s.world.lastEventStartMs;assert(s.world.zone);assert.equal(s.world.ship,null);
 for(let i=0;i<199;i++){s=step(s,outside);assert.equal(s.world.ship,null);}
 for(let i=0;i<5&&!s.world.ship;i++)s=step(s,outside);assert(s.world.ship&&s.world.zone);assert(s.world.lastEventStartMs-first>=8000);
});
test('Advanced captures may join only ship encounters, never scheduled bosses',()=>{
 for(const origin of ['ship','scheduled']){let s=scene();s.encounter.wave=27;s.world.checkedShipWave=27;s.clockMs=20000;s.world.lastEventStartMs=0;s.world.nextRewardWave=2;s.boss=boss(origin);
   s=step(s);assert.equal(Boolean(s.world.zone),origin==='ship');assert.equal(s.world.ship,null);assert.equal(s.boss.entityId,902);
 }
 let s=scene();s.encounter.wave=27;s.world.nextRewardWave=2;s.pendingBoss=true;assert(!events.canRunWorldEvent(s,'capture',27,20000));assert(!events.canRunWorldEvent(s,'ship',27,20000));
});
test('Timeout deals two damage once, keeps normal damage feedback and grants no reward',()=>{
 let s=scene();s.invulnerableMs=0;s.world.zone={...zone(),elapsedMs:1000,started:true,deadlineElapsedMs:89960};const hp=s.hp,xp=s.xp;
 s=step(s,outside);assert.equal(s.hp,hp-2);assert.equal(s.events.damage,1);assert.equal(s.world.zone,null);assert.equal(s.world.pendingCaptureDamage,null);assert.equal(s.world.damageNotice.amount,2);assert(s.invulnerableMs>0);assert.equal(s.events.zoneReward,0);assert.equal(s.xp,xp);assert.equal(s.upgrades.rhythm,0);
 for(let i=0;i<80;i++)s=step(s,outside);assert.equal(s.hp,hp-2);assert.equal(s.events.damage,1);assert.equal(s.world.damageNotice,null);
});
test('Existing invulnerability delays, then applies exactly one timeout penalty',()=>{
 let s=scene();s.invulnerableMs=200;s.world.zone={...zone(),deadlineElapsedMs:89960};s=step(s,outside);assert.equal(s.hp,5);assert(s.world.pendingCaptureDamage);assert.equal(s.world.damageNotice,null);
 for(let i=0;i<4;i++)s=step(s,outside);assert.equal(s.hp,3);assert.equal(s.events.damage,1);assert.equal(s.world.pendingCaptureDamage,null);assert.equal(s.world.damageNotice.amount,2);
 for(let i=0;i<50;i++)s=step(s,outside);assert.equal(s.hp,3);assert.equal(s.events.damage,1);
});
test('Timeout follows one-life death rules, while completion at the deadline wins',()=>{
 let s=scene('dystopia');s.invulnerableMs=0;s.world.zone={...zone(),deadlineElapsedMs:89960};s=step(s,outside);assert.equal(s.hp,0);assert.equal(s.mode,'dead');assert.equal(s.events.death,1);assert.equal(step(s).events.death,s.events.death);assert.equal(step(s).clockMs,s.clockMs);
 s=scene();s.invulnerableMs=0;s.world.zone={...zone(),elapsedMs:C.rewardDurationMs-40,started:true,deadlineElapsedMs:89960};s=step(s);assert.equal(s.hp,5);assert.equal(s.events.damage,0);assert.equal(s.events.zoneReward,1);assert.equal(s.upgrades.rhythm,1);assert.equal(s.world.zone,null);assert.equal(s.missions.captures,1);assert.equal(s.missions.perfectCaptures,1);
});
test('Pause freezes all capture timers, queued damage and ship warnings',()=>{
 const s=scene();s.world.zone={...zone(),elapsedMs:10000,requiredMs:C.rewardDurationMs+5000,penaltyMs:5000,deadlineElapsedMs:89960};s.world.pendingCaptureDamage={id:999,amount:2};s.mode='upgrade';const before=JSON.stringify(s);
 assert.equal(step(s,outside),s);assert.equal(JSON.stringify(s),before);s.mode='playing';assert.equal(step(s,outside,0),s);
});
test('Failure releases a postponed ship without duplicating the penalty',()=>{
 let s=scene();s.encounter.wave=3;s.world.checkedShipWave=3;s.clockMs=20000;s.world.lastEventStartMs=0;s.world.pendingShipWave=3;s.invulnerableMs=0;s.world.zone={...zone(),deadlineElapsedMs:89960};
 s=step(s,outside);assert.equal(s.world.zone,null);assert(s.world.ship);assert.equal(s.hp,3);assert.equal(s.events.damage,1);assert.equal(s.world.pendingShipWave,null);
});
console.log(`Capture coordination passed: ${cases} scenarios; native-transformed simulation, normal/advanced exclusion, deferred encounters, separate deadline/penalty, once-only normal damage/death and rewards, pause and cleanup.`);
