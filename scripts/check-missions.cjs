/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio|scores|activePowerups|missions|missionTelemetry|indicatorGeometry|player|frenesis)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module,exports:module.exports,require(id){if(id==='@react-native-async-storage/async-storage')return storage;if(id==='react')return {};assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return id.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return module.exports;
}

const disk=new Map();let writeCount=0,failRead=false,failWrite=false;
const storage={getItem:async key=>{if(failRead)throw Error('read');return disk.get(key)??null},setItem:async(key,value)=>{if(failWrite)throw Error('write');writeCount++;disk.set(key,value)}};
const game=load('src/game/survival.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts');
const M=load('src/game/missions.ts'),G=load('src/game/indicatorGeometry.ts'),F=load('src/game/frenesis.ts'),E=load('src/game/worldEvents.ts');
const {emptyNpc}=load('src/game/npc.ts');
const hero=players.createPlayer(),field=nav.buildFlowField(hero);
function tick(s,b=hero,a=b,dt=40){return game.advanceSurvival(s,b,a,field,dt);}
function isolated(fn,...args){assert(fn.__initData?.code);const f=vm.runInNewContext(`(${fn.__initData.code})`,{});return f.apply({__closure:fn.__closure},args);}
function scene(){const s=game.createSurvival();s.encounter={...s.encounter,phase:'spawning',remaining:1,spawnMs:1e9};s.invulnerableMs=1e9;s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=1;s.world.optional.nextOpportunityMs=1e12;return s;}
assert.equal(M.MISSIONS.length,35);assert.equal(new Set(M.MISSIONS.map(m=>m.id)).size,35);
let s=scene(),profile=M.emptyMissions();
const hit={...hero,action:'attack',attackSerial:42,attackIndex:0,actionMs:180};
s.encounter.enemies[0]={...emptyNpc(),id:1,active:true,action:'move',x:hero.x+25,y:hero.y};
s=isolated(game.advanceSurvival,s,{...hit,actionMs:140},hit,field,40);
assert.equal(s.stats.npcKills,1);profile=M.advanceMissions(profile,isolated(M.missionPulse,s,'a'));
assert.equal(profile.progress['first-kill'],1);assert.equal(M.missionStatus(profile,M.MISSIONS[0]),'pending');
assert.equal(M.advanceMissions(profile,M.missionPulse(s,'a')),profile,'Repeated snapshots are no-ops');
for(let i=0;i<10;i++)s=tick(s);profile=M.advanceMissions(profile,M.missionPulse(s,'a',true));
assert.equal(profile.progress['street-cleaner'],1);assert.equal(M.advanceMissions(profile,M.missionPulse({...s,stats:{...s.stats,npcKills:500}},'a')),profile,'Closed runs reject delayed callbacks');
let other=scene();other.stats.npcKills=99;other.encounter.wave=15;other.level=10;profile=M.advanceMissions(profile,M.missionPulse(other,'b'));
assert.equal(profile.progress['street-cleaner'],100);assert.equal(profile.progress.unstoppable,15);
assert.equal(M.missionStatus(profile,M.MISSIONS.find(m=>m.id==='street-cleaner')),'locked');
profile.claimed.push('first-kill');assert.equal(M.missionStatus(profile,M.MISSIONS.find(m=>m.id==='street-cleaner')),'pending');
other=scene();other.encounter.wave=5;profile=M.advanceMissions(profile,M.missionPulse(other,'c'));
assert.equal(profile.progress.unstoppable,15,'Single-run wave objectives use maxima, never summed runs');
assert.equal(JSON.stringify(M.readMissions(JSON.parse(JSON.stringify(profile)))),JSON.stringify(profile));
const bad=M.readMissions({progress:{'first-kill':-9,'street-cleaner':Infinity},claimed:['unknown'],runs:{bad:null}});assert.equal(bad.progress['first-kill'],undefined);assert.equal(bad.claimed.length,0);
const purg=game.createSurvival(2,'hard',{mode:'purgatorio',encounter:'guardian'});purg.mode='won';
assert.equal(M.missionPulse(purg,'p').values.hardWins,1);assert.equal(M.missionPulse(purg,'p').values.wave,0);
purg.purgatorio.kind='infinite';assert.equal(M.missionPulse(purg,'p').values.wins,0);
let impossible=game.createSurvival(1,'dystopia');impossible.encounter.wave=30;assert.equal(M.missionPulse(impossible,'i').values.impossibleWave,30);impossible.maxHp=2;assert.equal(M.missionPulse(impossible,'i').values.impossibleWave,0);
s=scene();s.frenesis.charge=100;s=game.activateFrenesis(s);assert.equal(s.missions.activations,1);assert.equal(game.activateFrenesis(s).missions.activations,1);
s.missions.nests=1;s.missions.reactors=1;s.missions.elites=1;assert.equal(M.missionPulse(s,'o').values.specials,3);
// Every catalog entry can reach pending, with its real scope and prerequisite satisfied.
for(const def of M.MISSIONS){const base=M.emptyMissions();base.claimed=def.requires?[def.requires]:[];const values={...M.missionPulse(scene(),'catalog').values};for(const key of Object.keys(values))values[key]=0;values[def.metric]=def.target;
 const completed=M.advanceMissions(base,{runId:'catalog-'+def.id,values,close:false});assert.equal(M.missionStatus(completed,def),'pending',def.id);assert(def.reward>0&&Number.isSafeInteger(def.reward));}
// Actual wave/hit transitions and perfect boss admission, not reconstructed from end-of-run totals.
s=scene();s.encounter={...s.encounter,phase:'clearing',remaining:0};s=tick(s);assert.equal(s.missions.streak,1);
s.invulnerableMs=0;s.world.pendingCaptureDamage={id:1,amount:2};s=tick(s);assert.equal(s.missions.streak,0);assert.equal(s.missions.damage,1);
for(const mode of ['hard','dystopia'])for(const damaged of [false,true]){
 let b=game.createSurvival(82,mode,{mode:'purgatorio',encounter:'guardian'});for(let i=0;i<300&&(!b.boss||b.presentation);i++)b=tick(b);assert(b.boss&&!b.presentation);b.invulnerableMs=1e9;b.world.reinforcementMs=1e9;b.encounter.enemies=b.encounter.enemies.map(()=>emptyNpc());if(damaged)b.missions.damage++;
 b.boss={...b.boss,hp:1,x:hero.x+25,y:hero.y,phase:'recover',phaseMs:0};b=tick(b,{...hit,actionMs:140},hit);assert.equal(b.stats.bossKills,1);assert.equal(b.missions[mode==='hard'?'perfectHard':'perfectImpossible'],damaged?0:1);const count=b.missions.perfectHard+b.missions.perfectImpossible;for(let n=0;n<8;n++)b=tick(b);assert.equal(b.missions.perfectHard+b.missions.perfectImpossible,count);
}
// Base capture, travel, outside grace, capped penalty, exact completion and failure.
assert.equal(E.WORLD_EVENT_CONFIG.rewardDurationMs,10000);assert(E.WORLD_EVENT_CONFIG.captureDeadlineMs>45000);
let z={id:1,siteId:'test',x:0,y:0,radius:80,reward:'xp',elapsedMs:0,inside:false};
z=E.advanceCapture(z,false,10000).zone;assert(!z.leftZone);assert.equal(z.requiredMs,10000);
z=E.advanceCapture(z,true,4000).zone;z=E.advanceCapture(z,false,2000).zone;assert.equal(z.elapsedMs,4000);assert.equal(z.requiredMs,12000);assert(z.leftZone);assert.equal(z.deadlineElapsedMs,16000);
assert(E.advanceCapture(z,true,8000).complete);assert(E.advanceCapture(z,false,90000).failed);
assert(!G.captureArrowVisible({x:70,y:0},{x:0,y:0,radius:80}));assert(!G.captureArrowVisible({x:100,y:0},{x:0,y:0,radius:80}));assert(G.captureArrowVisible({x:120,y:0},{x:0,y:0,radius:80}));
const project=isolated(G.projectWorld,{x:1000,y:700},[{translateX:-900},{translateY:-600},{scale:1.5}]);assert.equal(project.x,600);assert.equal(project.y,450);
for(const [w,h] of [[640,360],[844,390],[1280,720]])for(const target of [{x:-1000,y:100},{x:3000,y:300},{x:400,y:-1000},{x:400,y:2000}]){
 const blocked=[{x:0,y:0,width:170,height:78},{x:0,y:h-180,width:200,height:180},{x:w-200,y:h-180,width:200,height:180}],a=G.edgeIndicator(target,w,h,blocked,40,30);
 assert(a);assert(a.x>=20&&a.x<=w-20&&a.y>=40&&a.y<=h-30);assert(!blocked.some(b=>G.boxesMeet({x:a.x-16,y:a.y-16,width:32,height:32},b,5)));
}
// Continuous authored clips, movement, no restart on taps; damage cadence independent of display rate.
for(const dt of [1000/120,1000/60,40]){
 let p=players.requestAttack({...hero,frenesis:true,attackSpeedMultiplier:1.5}),t=0,lastPulse=-1e6,pulses=0,wraps=0,lastMs=0;
 for(;t<5000;t+=dt){const prev=p;p=players.advancePlayer(p,{x:1,y:0,strength:.3},dt);assert(p.action==='attack'||(p.attackPressMs??0)<F.FRENESIS.holdThresholdMs);assert(p.attackHeld);if(p.actionMs<lastMs)wraps++;lastMs=p.actionMs;
  if(p.spinStrike){assert(t-lastPulse+0.01>=F.FRENESIS.spinIntervalMs/1.5);lastPulse=t;pulses++;}
  assert.equal(players.requestAttack(p),p,'Repeated held requests do not reset clips');assert(p.x>=prev.x);
 }
 assert(wraps>=8&&pulses>=8);p=F.releaseFrenesisAttack(p);const releasedSerial=p.attackSerial;let afterReleaseHits=0;for(let n=0;n<100;n++){p=players.advancePlayer(p,players.REST_INPUT,dt);afterReleaseHits+=Number(p.spinStrike);assert.equal(p.attackSerial,releasedSerial);}assert(afterReleaseHits<=1);assert.equal(p.action,'idle');
 p=players.requestAttack({...hero,frenesis:true});p=players.beginDash(p,{x:1,y:0,strength:1});assert(p.attackHeld);for(let n=0;n<40;n++)p=players.advancePlayer(p,players.REST_INPUT,dt);for(let n=0;n<40&&p.action==='dash';n++)p=players.advancePlayer(p,players.REST_INPUT,dt);for(let n=0;n<100&&p.action!=='attack';n++)p=players.advancePlayer(p,players.REST_INPUT,dt);assert.equal(p.frenesisAttack,'slices');assert(p.attackHeld);
 p={...p,frenesisBlink:true};p=players.advancePlayer(p,players.REST_INPUT,dt);assert(p.attackHeld&&!p.spinStrike);p={...p,frenesisBlink:false};for(let i=0;i<100&&p.action!=='attack';i++)p=players.advancePlayer(p,players.REST_INPUT,dt);assert.equal(p.frenesisAttack,'slices');
}
// Real simultaneous spin kills, once per enemy; orbs never count as Frenesis activations.
s=scene();s.frenesis=F.startFrenesis({...s.frenesis,charge:100},true);let spin={...hero,frenesis:true,action:'attack',frenesisAttack:'slices',attackHeld:true,spinStrike:true,attackSerial:90,actionMs:0};
for(let i=0;i<5;i++)s.encounter.enemies[i]={...emptyNpc(),id:i+1,active:true,action:'move',x:hero.x+12+i*3,y:hero.y+8};
s=tick(s,spin,spin);assert.equal(s.missions.bestSpin,5);assert.equal(s.stats.npcKills,5);s=tick(s,spin,spin);assert.equal(s.stats.npcKills,5);assert.equal(s.missions.activations,0);
// Actual pickup source, no synthetic or rejected XP counted.
s=scene();s.orbs=[{id:1,x:hero.x,y:hero.y,value:2,lifeMs:5000}];s=tick(s);assert.equal(M.missionPulse(s,'orb').values.orbs,1);assert.equal(s.missions.activations,0);
function freshStore(){cache.delete(path.resolve(root,'src/ui/ScoreStorage.ts'));return load('src/ui/ScoreStorage.ts');}
(async()=>{
 let store=freshStore();await store.loadScores();const before=store.getScores().economy.cells;
 const pulse=M.missionPulse({...scene(),stats:{...scene().stats,npcKills:1}},'persist');
 await Promise.all([store.recordMissionProgress(pulse),store.recordMissionProgress(pulse)]);
 assert.equal(store.getScores().economy.cells,before,'Completion grants no currency');assert.equal(store.getScores().missions.progress['first-kill'],1);
 store=freshStore();await store.loadScores();assert.equal(M.missionStatus(store.getScores().missions,M.MISSIONS[0]),'pending');
 failWrite=true;await assert.rejects(store.claimMission('first-kill'));assert.equal(store.getScores().economy.cells,before);assert.equal(store.getScores().missions.claimed.length,0);failWrite=false;
 await Promise.all([store.claimMission('first-kill'),store.claimMission('first-kill'),store.claimMission('first-kill')]);assert.equal(store.getScores().economy.cells,before+M.MISSIONS[0].reward);
 store=freshStore();await store.loadScores();assert.equal(M.missionStatus(store.getScores().missions,M.MISSIONS[0]),'claimed');await store.claimMission('first-kill');assert.equal(store.getScores().economy.cells,before+M.MISSIONS[0].reward);
 const scoring=load('src/game/scores.ts');s=scene();s.stats.npcKills=99;s.mode='dead';const final=scoring.finalRunResult(s,'end');await Promise.all([store.saveRunResult(final),store.recordMissionProgress(M.missionPulse(s,'end',true))]);assert.equal(store.getScores().missions.progress['street-cleaner'],100,'Final settlement and checkpoints share one transaction queue');
 const wallet=store.getScores().economy.cells;await store.saveRunResult(final);await store.claimMission('unknown');assert.equal(store.getScores().economy.cells,wallet);
 console.log('Missions: 35 measurable objectives; real kill/pickup/activation/spin telemetry, cumulative/best-run/locked/pending/claimed, reload/atomic claim/write failure/concurrency/final settlement, 15s capture/deadline/penalty, 120/60/25Hz held clips/cadence/release/dash/blink, camera/safe edge geometry passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
