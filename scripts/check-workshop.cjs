/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio|scores|activePowerups|workshop)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
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


const scores=load('src/game/scores.ts'),shop=load('src/game/workshop.ts'),power=load('src/game/activePowerups.ts');
function result(id,mode='easy',npc=3500){const s=game.createSurvival(1,mode);s.mode='dead';s.stats={npcKills:npc,wavesCleared:4,minibossKills:2,bossKills:1,objectivesCompleted:2};return scores.finalRunResult(s,id,'2026-10-24T12:00:00.000Z');}
assert.equal(result('a').score,37200);
for(const [mode,expected] of [['easy',90],['hard',112],['dystopia',135]])assert.equal(shop.earnedCells(result('a',mode)),expected);
assert.equal(shop.earnedCells({...result('a','hard'),score:1999,stats:{npcKills:0,wavesCleared:0,minibossKills:1,bossKills:0,objectivesCompleted:0}}),11,'Floor score share first, then floor the final difficulty multiplier');
assert.throws(()=>scores.finalRunResult(game.createSurvival(),'abandon'),'Active/abandoned sessions cannot become results');
const combinations=[[],...shop.WORKSHOP_IDS.map(id=>[id])];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)combinations.push([shop.WORKSHOP_IDS[i],shop.WORKSHOP_IDS[j]]);
let starts=0;
for(const mode of ['easy','hard','dystopia'])for(const items of combinations){
 let s=game.createSurvival(1,mode,{mode:'survival'},items),b=shop.workshopBonuses(items,mode),p=players.createPlayer();
 assert.equal(s.hp,(mode==='dystopia'?1:5)+b.health);assert.equal(s.maxHp,s.hp);assert.equal(s.frenesis.charge,b.charge);
 assert.equal(s.upgrades.speed,0);assert.equal(s.upgrades.rhythm,0,'Starter effects never consume in-run upgrade ranks');
 for(let n=0;n<100;n++)p=game.applyPlayerUpgrades(p,s);
 assert.equal(p.speedMultiplier,1+b.speed);assert.equal(p.attackSpeedMultiplier,1+b.attack);
 assert.equal(s.frenesis.charge,b.charge);assert.equal(s.hp,(mode==='dystopia'?1:5)+b.health);
 const final={...s,mode:'dead'},saved=scores.finalRunResult(final,'start-'+starts);assert.equal(saved.equipment.length,items.length);starts++;
}
let s=game.createSurvival(1,'easy',{mode:'survival'},['assault-boots','attack-servo']);s.upgrades.speed=2;s.upgrades.rhythm=2;let p=game.applyPlayerUpgrades(hero,s);assert.equal(p.speedMultiplier,1.24);assert.equal(p.attackSpeedMultiplier,1.24);
let shown=power.activePowerups(s);assert.equal(shown.filter(x=>x.id==='speed').length,1);assert.equal(shown.find(x=>x.id==='speed').value,'+24%');
s=game.createSurvival(1,'easy',{mode:'survival'},['field-kit','frenesis-coil']);s.frenesis.charge=2;for(let n=0;n<100;n++)game.applyPlayerUpgrades(hero,s);assert.equal(s.frenesis.charge,2,'Coil charge is not reapplied by rendering/movement');
function fresh(){cache.delete(path.resolve(root,'src/ui/ScoreStorage.ts'));return load('src/ui/ScoreStorage.ts');}
(async()=>{
 let store=fresh(),r=result('finished','hard');const receipts=await Promise.all([store.saveRunResult(r),store.saveRunResult(r),store.saveRunResult(r)]);
 assert(receipts.every(x=>x.earned===112&&x.balance===112));assert.equal(writeCount,1);assert.equal(store.getScores().economy.cells,112);
 store=fresh();await store.loadScores();await store.saveRunResult(r);assert.equal(writeCount,1,'Reloaded receipt prevents duplicate coins');
 await Promise.all([store.purchaseUpgrade('frenesis-coil'),store.purchaseUpgrade('frenesis-coil')]);assert.equal(store.getScores().economy.cells,12);assert.equal(store.getScores().economy.prepared.length,1);assert.equal(writeCount,2,'Concurrent purchase deducts once');
 let old=store.getScores(),writes=writeCount;const poor=await store.purchaseUpgrade('field-kit');assert(!poor.ok);assert(poor.message.includes('138'));assert.equal(store.getScores(),old);assert.equal(writeCount,writes);
 await store.saveRunResult(result('funds','easy',50000));const funded=store.getScores().economy.cells;
 failWrite=true;await assert.rejects(store.purchaseUpgrade('assault-boots'));assert.equal(store.getScores().economy.cells,funded);assert(!store.getScores().economy.prepared.some(p=>p.id==='assault-boots'));failWrite=false;
 assert((await store.purchaseUpgrade('assault-boots')).ok);assert(!(await store.purchaseUpgrade('attack-servo')).ok,'Two slots only');assert.equal(store.getScores().economy.cells,funded-110);
 await Promise.all([store.withdrawAdvantage('frenesis-coil'),store.withdrawAdvantage('frenesis-coil')]);assert.equal(store.getScores().economy.cells,funded-10,'Refund once at exact purchase cost');
 assert(!(await store.purchaseUpgrade('field-kit',true)).ok,'One-life purchase guard');assert((await store.purchaseUpgrade('attack-servo')).ok);
 const prepared=store.getScores().economy.prepared.slice(),snapshot=JSON.stringify(store.getScores().rankings),before=store.getScores().economy.cells;store=fresh();await store.loadScores();assert.equal(JSON.stringify(store.getScores().economy.prepared),JSON.stringify(prepared));assert.equal(store.getScores().economy.cells,before);assert.equal(JSON.stringify(store.getScores().rankings),snapshot);
 failWrite=true;await assert.rejects(store.consumePreparedAdvantages('run-fail','easy'));assert.equal(store.getScores().economy.prepared.length,2);assert(!Object.hasOwn(store.getScores().economy.starts,'run-fail'));failWrite=false;
 const consumed=await Promise.all([store.consumePreparedAdvantages('run-once','easy'),store.consumePreparedAdvantages('run-once','easy')]);assert.equal(JSON.stringify(consumed[0]),JSON.stringify(consumed[1]));assert.equal(consumed[0].length,2);assert.equal(store.getScores().economy.prepared.length,0);
 const run=game.createSurvival(9,'easy',{mode:'survival'},consumed[0]);assert.equal(game.applyPlayerUpgrades(hero,run).speedMultiplier,1.08);assert.equal(game.applyPlayerUpgrades(hero,run).attackSpeedMultiplier,1.08);const retry=await store.consumePreparedAdvantages('run-retry','easy');assert.equal(retry.length,0);assert.equal(game.applyPlayerUpgrades(hero,game.createSurvival(10,'easy',{mode:'survival'},retry)).speedMultiplier,1);
 assert((await store.purchaseUpgrade('field-kit')).ok);assert((await store.purchaseUpgrade('frenesis-coil')).ok);const preImpossible=store.getScores().economy.cells;
 const oneLife=await store.consumePreparedAdvantages('one-life','dystopia');assert.equal(oneLife.length,1);assert.equal(oneLife[0],'frenesis-coil');assert.equal(store.getScores().economy.cells,preImpossible+150);assert.equal(game.createSurvival(10,'dystopia',{mode:'survival'},oneLife).hp,1);
 store=fresh();await store.loadScores();await store.consumePreparedAdvantages('one-life','dystopia');assert.equal(store.getScores().economy.cells,preImpossible+150);assert.equal((await store.consumePreparedAdvantages('new-life','easy')).length,0);
 assert.equal(shop.WORKSHOP_ITEMS['frenesis-coil'].cost,100);assert.equal(shop.WORKSHOP_ITEMS['assault-boots'].cost,110);assert.equal(shop.WORKSHOP_ITEMS['attack-servo'].cost,125);assert.equal(shop.WORKSHOP_ITEMS['field-kit'].cost,150);
 const visit=load('src/ui/CreatorVisit.ts'),links=load('src/ui/links.ts');let errors=[],opened=[];const walletBefore=store.getScores().economy.cells;
 await visit.visitCreator('support',async()=>{throw Error('open failed')},m=>errors.push(m));assert.equal(store.getScores().economy.cells,walletBefore);assert.equal(errors.length,1);
 await Promise.all([visit.visitCreator('support',async u=>opened.push(u),m=>errors.push(m)),visit.visitCreator('support',async u=>opened.push(u),m=>errors.push(m))]);assert.equal(store.getScores().economy.cells,walletBefore+200);assert(opened.every(u=>u===links.CREATOR_LINKS.support));
 failWrite=true;await visit.visitCreator('about',async u=>opened.push(u),m=>errors.push(m));assert.equal(store.getScores().economy.cells,walletBefore+200);assert(!store.getScores().economy.creatorRewards.includes('about'));failWrite=false;
 await visit.visitCreator('about',async u=>opened.push(u),m=>errors.push(m));assert.equal(opened.at(-1),links.CREATOR_LINKS.about);assert.equal(store.getScores().economy.cells,walletBefore+400);
 store=fresh();await store.loadScores();await Promise.all([store.grantCreatorVisit('about'),store.grantCreatorVisit('support')]);assert.equal(store.getScores().economy.cells,walletBefore+400);assert.equal(store.getScores().economy.creatorRewards.length,2);
 for(let i=0;i<260;i++)await store.saveRunResult(result('later-'+i,'easy',50001+i));
 old=store.getScores();assert(!old.seen.includes(r.id));const balance=old.economy.cells;store=fresh();await store.loadScores();await store.saveRunResult(r);assert.equal(store.getScores().economy.cells,balance,'Permanent receipt outlives the bounded score history');
 const legacy=JSON.parse(JSON.stringify(store.getScores()));delete legacy.economy;disk.set(store.SCORE_STORAGE_KEY,JSON.stringify(legacy));store=fresh();await store.loadScores();assert.equal(store.getScores().economy.cells,0);const prior=store.getScores().rankings.survival[0];await store.saveRunResult(prior);assert.equal(store.getScores().economy.cells,0,'Legacy scores migrate without retrospective payouts');
 const legacyWallet={cells:500,unlocked:['field-kit','attack-servo','attack-servo','assault-boots','frenesis-coil'],equipped:['field-kit'],settlements:{}};
 const oldSave={...store.getScores(),economy:legacyWallet};disk.set(store.SCORE_STORAGE_KEY,JSON.stringify(oldSave));store=fresh();await store.loadScores();assert.equal(store.getScores().economy.cells,850);assert.equal(store.getScores().economy.prepared.length,0);store=fresh();await store.loadScores();assert.equal(store.getScores().economy.cells,850,'Legacy refund persists exactly once');
 for(const raw of [null,{}, {version:2,cells:-1,prepared:[{id:'unknown',cost:4}]},{version:2,cells:'bad',prepared:[{id:'attack-servo',cost:125},{id:'attack-servo',cost:125},{id:'field-kit',cost:-1}]}]){const w=shop.readWallet(raw);assert(w.cells>=0);assert(w.prepared.length<=2);assert.equal(new Set(w.prepared.map(p=>p.id)).size,w.prepared.length);}
 console.log('Workshop/creator rewards passed: prices100/110/125/150, all '+starts+' base loadouts, two pending slots, exact refunds, atomic consumption, repeated callbacks/retry/reload, one-life refund, failure recovery, legacy migration once, independent200+200 visits, failed links unpaid, once-only settlement and rankings preserved.');
})().catch(e=>{console.error(e);process.exitCode=1});
