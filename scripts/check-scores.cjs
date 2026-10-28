/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio|scores|activePowerups)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module,exports:module.exports,require(id){if(id==='@react-native-async-storage/async-storage')return storage;if(id==='react')return {};assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return id.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return module.exports;
}

const disk=new Map();let writeCount=0,failRead=false,failWrite=false;
const storage={getItem:async key=>{if(failRead)throw Error('read');return disk.get(key)??null},setItem:async(key,value)=>{if(failWrite)throw Error('write');writeCount++;disk.set(key,value)}};
const game=load('src/game/survival.ts'), players=load('src/game/player.ts'), nav=load('src/game/navigation.ts');
const {ENEMY_DEFS}=load('src/game/enemyCatalog.ts'),{bossMode}=load('src/game/bossBalance.ts'),{purgatorioTuning}=load('src/game/purgatorio.ts');
const {emptyNpc}=load('src/game/npc.ts');
const hero=players.createPlayer(), field=nav.buildFlowField(hero);
function tick(s,dt=40,before=hero,after=before){return game.advanceSurvival(s,before,after,field,dt);}
function start(id,mode='easy'){
 let s=game.createSurvival(82,mode,{mode:'purgatorio',encounter:id});
 for(let n=0;n<300&&(!s.boss||s.presentation);n++)s=tick(s);
 assert(s.boss&&!s.presentation);s.invulnerableMs=1e8;
 s.encounter.enemies=s.encounter.enemies.map(()=>emptyNpc());s.world.reinforcementMs=1e8;
 return s;
}

const scoring=load('src/game/scores.ts'),powers=load('src/game/activePowerups.ts');
function isolated(fn,...args){assert(fn.__initData?.code);const f=vm.runInNewContext(`(${fn.__initData.code})`,{});return f.apply({__closure:fn.__closure},args)}
let s=game.createSurvival();s.encounter={...s.encounter,phase:'spawning',remaining:1,spawnMs:1e9};s.invulnerableMs=1e9;
const p={...hero,action:'attack',attackIndex:0,attackSerial:90,actionMs:180},before={...p,actionMs:140};
s.encounter.enemies[0]={...emptyNpc(),id:1,active:true,action:'move',x:hero.x+25,y:hero.y};
s=tick(s,40,before,p);assert.equal(s.stats.npcKills,1);assert.equal(scoring.scoreRun(s.stats),10);
for(let i=0;i<80;i++)s=tick(s);assert.equal(s.stats.npcKills,1,'Death animation and repeated ticks cannot recount a kill');
for(const [id,key] of [['evil-sage','minibossKills'],['guardian','bossKills']]){
 let b=start(id);assert.equal(b.stats[key],0,'Presentation/audio appearance is not a defeat');b.boss={...b.boss,hp:1,x:hero.x+25,y:hero.y,phase:'recover',phaseMs:0};
 b=isolated(game.advanceSurvival,b,before,p,field,40);assert.equal(b.stats[key],1);assert.equal(b.mode,'won');const points=scoring.scoreRun(b.stats);for(let i=0;i<150;i++)b=tick(b);assert.equal(b.stats[key],1);assert.equal(scoring.scoreRun(b.stats),points);
}
s=game.createSurvival();s.encounter={...s.encounter,wave:1,phase:'clearing',remaining:0};s=tick(s);assert.equal(s.stats.wavesCleared,1);s=tick(s);assert.equal(s.stats.wavesCleared,1);
const {REWARD_SITES}=load('src/game/worldEventSites.ts'),site=REWARD_SITES[0],at={...hero,x:site.x,y:site.y},atField=nav.buildFlowField(at);
s=game.createSurvival();s.invulnerableMs=1e9;s.encounter={...s.encounter,wave:2,phase:'spawning',remaining:1,spawnMs:1e9};s.world.zone={...site,id:801,siteId:site.id,reward:'rhythm',elapsedMs:29960,requiredMs:30000,deadlineElapsedMs:0,started:true};
s=game.advanceSurvival(s,at,at,atField,40);assert.equal(s.stats.objectivesCompleted,1);for(let i=0;i<10;i++)s=game.advanceSurvival(s,at,at,atField,40);assert.equal(s.stats.objectivesCompleted,1);
const stats={npcKills:5,minibossKills:2,bossKills:1,wavesCleared:3,objectivesCompleted:2};assert.equal(isolated(scoring.scoreRun,stats),2150);
let upgraded=game.createSurvival();upgraded.upgrades={speed:2,dash:2,reach:2,magnet:2,vitality:2,rhythm:2};upgraded.maxHp=7;
let list=isolated(powers.activePowerups,upgraded);assert.equal(list.length,6);assert.equal(new Set(list.map(p=>p.id)).size,6);assert(list.every(p=>p.stacks===2));
const mod=game.applyPlayerUpgrades(hero,upgraded),get=id=>list.find(p=>p.id===id).value;
assert.equal(get('speed'),'+16%');assert.equal(mod.speedMultiplier,1.16);assert.equal(get('rhythm'),'+16%');assert.equal(mod.attackSpeedMultiplier,1.16);assert.equal(get('dash'),'-16%');assert.equal(mod.dashCooldownMultiplier,.84);assert.equal(get('magnet'),'+44%');assert.equal(get('vitality'),'+2 PV');
upgraded.choices=['speed','rhythm'];upgraded.upgrades.speed=0;assert(!powers.activePowerups(upgraded).some(p=>p.id==='speed'),'Rejected/offered upgrades are not active');
upgraded.upgrades.speed=2;upgraded.frenesis={...upgraded.frenesis,active:true,remainingMs:4321};assert.equal(powers.activePowerups(upgraded).find(p=>p.id==='frenesis').value,'VEL +68.2%');assert.equal(powers.activePowerups(upgraded).find(p=>p.id==='frenesis').detail,'ATA +74%');assert.equal(powers.activePowerups(upgraded).find(p=>p.id==='frenesis').remainingSeconds,5);upgraded.frenesis.remainingMs=0;assert(!powers.activePowerups(upgraded).some(p=>p.id==='frenesis'),'Expired temporary effects disappear');
assert.equal(powers.activePowerups(game.createSurvival()).length,0);
function result(id,mode='survival',n=1){const q=game.createSurvival();q.stats={...stats,npcKills:n};q.mode='dead';const r=scoring.finalRunResult(q,id,'2026-10-24T12:00:00.000Z');return {...r,mode};}
let archive=scoring.emptyScoreArchive();assert.equal(archive.rankings.survival.length,0);
for(const mode of scoring.RANKING_MODES){for(let i=1;i<=5;i++){archive=scoring.insertScore(archive,result(mode+i,mode,i));assert.equal(archive.rankings[mode].length,Math.min(i,3));}assert.equal(archive.rankings[mode][0].stats.npcKills,5);assert.equal(archive.rankings[mode][2].stats.npcKills,3);}
const same=scoring.insertScore(archive,result('survival5'));assert.equal(same,archive,'ID deduplication covers every ranking');
const reloaded=scoring.readScoreArchive(JSON.stringify(archive));assert.equal(JSON.stringify(reloaded.rankings),JSON.stringify(archive.rankings));assert.equal(scoring.insertScore(reloaded,result('survival5')),reloaded);
for(const bad of ['bad','null','[]','{"version":5}'])assert.equal(scoring.readScoreArchive(bad).rankings.survival.length,0);
assert(!scoring.validResult({...result('bad'),score:Infinity}));assert(!scoring.validResult({...result('bad'),stats:{...stats,npcKills:-1}}));
function freshStore(){cache.delete(path.resolve(root,'src/ui/ScoreStorage.ts'));return load('src/ui/ScoreStorage.ts');}
(async()=>{
 let store=freshStore();await store.loadScores();assert.equal(store.getScores().rankings.survival.length,0);
 const a=result('unique');await Promise.all([store.saveRunResult(a),store.saveRunResult(a),store.saveRunResult(a)]);assert.equal(writeCount,1,'Concurrent closes write one result');
 store=freshStore();await store.loadScores();await store.saveRunResult(a);assert.equal(writeCount,1,'Deduplication survives module/device reload');
 await Promise.all([store.saveRunResult(result('second','survival',3)),store.saveRunResult(result('third','survival',4)),store.saveRunResult(result('fourth','survival',5)),store.saveRunResult(result('other','purgatorio-infinite',8))]);assert.equal(store.getScores().rankings.survival.length,3);assert.equal(store.getScores().rankings['purgatorio-infinite'].length,1);assert.equal(store.getScores().rankings['purgatorio-single'].length,0);
 store=freshStore();failRead=true;const old=disk.get(store.SCORE_STORAGE_KEY);await assert.rejects(store.saveRunResult(result('read-error')));assert.equal(disk.get(store.SCORE_STORAGE_KEY),old);failRead=false;
 failWrite=true;await assert.rejects(store.saveRunResult(result('write-error')));assert(!store.getScores().seen.includes('write-error'),'Failed writes are retryable, not falsely acknowledged');failWrite=false;await store.saveRunResult(result('write-error'));assert(store.getScores().seen.includes('write-error'));
 console.log('Scores/powerups passed: actual native combat counters, once-only deaths/objectives/waves, configurable scoring, real aggregated effects, rejected/expired filtering, empty/1/2/3/top3 separated modes, concurrent duplicates, persistent reload, serialized writes and read/write recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
