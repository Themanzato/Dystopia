/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),babel=require('@babel/core');
const project=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){
 const filename=path.resolve(project,relative);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 const code=/[\\/](survival|tutorial)\.ts$/.test(filename)?babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,global:{Error},require:id=>{assert(id.startsWith('.'),'Tutorial gameplay must not access storage/network/UI: '+id);const target=path.resolve(path.dirname(filename),id);return target.endsWith('.png')?target:load(path.relative(project,target+'.ts'));}},{filename});return module.exports;
}
const tutorial=load('src/game/tutorial.ts'),api=load('src/game/survival.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts'),collision=load('src/game/collision.ts'),frenesis=load('src/game/frenesis.ts');
const {DUMMY_HIT_MS,DUMMY_BREAK_MS}=load('src/game/tutorialAssets.ts'),{createRunStats,scoreRun}=load('src/game/scores.ts'),{createMissionTelemetry}=load('src/game/missionTelemetry.ts');
const clone=v=>JSON.parse(JSON.stringify(v));let ticks=0,cases=0;
function session(seed=71){let state=tutorial.createTutorialSurvival(seed),player=tutorial.createTutorialPlayer();return {state,player,field:nav.buildFlowField(player)};}
function step(h,input=players.REST_INPUT,dt=40){
 const before=api.applyPlayerUpgrades(h.player,h.state),after=tutorial.constrainTutorialPlayer(before,players.advancePlayer(before,input,dt),h.state);
 if(nav.navigationCell(after)!==h.field.targetCell)h.field=nav.buildFlowField(after);
 const view={left:after.x-210,right:after.x+210,top:after.y-120,bottom:after.y+120};
 h.state=tutorial.advanceTutorial(h.state,before,after,h.field,dt,view);h.player=api.applyPlayerUpgrades(after,h.state);ticks++;return h.state;
}
function until(h,predicate,max=800,input=players.REST_INPUT){for(let n=0;n<max&&!predicate(h.state);n++)step(h,input);assert(predicate(h.state),'Tutorial reached '+predicate.toString());return h.state;}
function test(name,fn){try{fn();cases++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name+'\n'+e.stack);process.exitCode=1;}}
function approach(h,target){
 const spots=[-42,42,-30,30];let spot;
 for(const dx of spots)if(collision.isWalkable(target.x+dx,target.y)){spot={x:target.x+dx,y:target.y};break;}
 assert(spot,'Actual actor has reachable melee position');h.player={...h.player,...spot,facingX:target.x>=spot.x?1:-1,aimX:target.x>=spot.x?1:-1,aimY:0,action:'idle',actionMs:0};h.field=nav.buildFlowField(h.player);
}
function slash(h){h.player=players.beginAttack(h.player);for(let n=0;n<40&&h.player.action==='attack';n++)step(h);}
function completeMovement(h){until(h,s=>s.tutorial.step==='dummy',30,{x:1,y:0,strength:1});assert.equal(h.state.tutorial.dummy.action,'idle');}
function defeatDummy(h){
 for(let i=0;i<3;i++){approach(h,h.state.tutorial.dummy);const hp=h.state.tutorial.dummy.hp;slash(h);assert.equal(h.state.tutorial.dummy.hp,hp-1,'One actual attack serial applies one valid hit');}
 until(h,s=>s.tutorial.dummy.action==='breaking');until(h,s=>s.tutorial.step==='wave');
}
function defeatWave(h){
 for(let n=0;n<1400&&h.state.tutorial.step!=='hud';n++){
  if(h.state.tutorial.step==='dash'){h.player=players.beginDash(h.player,{x:1,y:0,strength:1});step(h);continue;}
  const enemy=h.state.encounter.enemies.find(n=>n.active&&n.action!=='death');
  if(enemy&&!h.player.frenesis){approach(h,enemy);slash(h);}else step(h);
 }
 assert.equal(h.state.tutorial.step,'hud','Finite first wave and dash lead to HUD explanation');
}
function isolate(h){
 assert.deepEqual(clone(h.state.stats),clone(createRunStats()));assert.equal(scoreRun(h.state.stats),0);assert.deepEqual(clone(h.state.missions),clone(createMissionTelemetry()));
 assert.equal(h.state.xp,0);assert.equal(h.state.level,1);assert.equal(h.state.orbs.length,0);assert.equal(h.state.chests.length,0);assert.equal(h.state.pendingChests,0);assert.equal(h.state.pendingUpgrades,0);assert.equal(h.state.boss,null);assert.equal(h.state.partner,null);assert.equal(h.state.minibosses.length,0);assert.equal(h.state.hazards.length,0);
}
test('Fresh practice uses a clear city location, finite movement gate and no run rewards',()=>{
 const h=session();assert(collision.isWalkable(h.player.x,h.player.y));assert.equal(h.state.tutorial.step,'move');assert.equal(h.state.tutorial.dummy.action,'gone');
 for(let n=0;n<10;n++)step(h);assert.equal(h.state.tutorial.step,'move','Idle cannot auto-complete movement');
 const start={...h.player};completeMovement(h);assert(Math.hypot(h.player.x-start.x,h.player.y-start.y)>=tutorial.TUTORIAL_CONFIG.moveDistance);assert(collision.isWalkable(h.state.tutorial.dummy.x,h.state.tutorial.dummy.y));isolate(h);
});
test('Real dummy attacks are serial-deduplicated, preserve queued full HITs and destroy once',()=>{
 const h=session();completeMovement(h);let hitStarted=-1,breakingAt=-1,breakStarts=0,lastAction=h.state.tutorial.dummy.action;
 for(let n=0;n<3;n++){
  approach(h,h.state.tutorial.dummy);h.player=players.beginAttack(h.player);
  while(h.player.action==='attack'){
   const previous=h.state,before=clone(h.state.tutorial);step(h);assert.deepEqual(clone(previous.tutorial),before,'A tick must not mutate the prior shared tutorial object');const d=h.state.tutorial.dummy;
   if(hitStarted<0&&d.action==='hit')hitStarted=h.state.tutorial.elapsedMs;
   if(d.action==='breaking'&&lastAction!=='breaking'){breakStarts++;breakingAt=h.state.tutorial.elapsedMs;}
   lastAction=d.action;
  }
  assert.equal(h.state.tutorial.dummy.hp,2-n);
 }
 while(h.state.tutorial.step==='dummy'){
  step(h);const d=h.state.tutorial.dummy;if(d.action==='breaking'&&lastAction!=='breaking'){breakStarts++;breakingAt=h.state.tutorial.elapsedMs;}lastAction=d.action;
 }
 assert.equal(breakStarts,1);assert(breakingAt-hitStarted>=DUMMY_HIT_MS*2,'A lethal hit cannot cut either earlier complete reaction');assert(h.state.tutorial.elapsedMs-breakingAt>=DUMMY_BREAK_MS);assert.equal(h.state.tutorial.dummy.action,'gone');assert.equal(h.state.tutorial.planned,4);isolate(h);
});
test('First wave spawns only four common enemies, requires real dash and waits for corpse animations',()=>{
 const h=session();completeMovement(h);defeatDummy(h);const ids=new Set();
 for(let n=0;n<180;n++){const s=step(h);for(const e of s.encounter.enemies)if(e.active)ids.add(e.id);assert(s.encounter.enemies.filter(e=>e.active&&e.action!=='death').length<=8);}
 assert.equal(ids.size,4);assert.equal(h.state.tutorial.spawned,4);assert.equal(h.state.encounter.remaining,0);defeatWave(h);assert(h.state.tutorial.dashDone);assert.equal(h.state.encounter.enemies.filter(e=>e.active).length,0);assert.equal(h.state.encounter.defeated,4);isolate(h);
});
test('Complete tutorial uses real ultimate activation, exact 3s teleport cooldown and a finite held spin wave',()=>{
 const h=session();completeMovement(h);defeatDummy(h);defeatWave(h);
 h.state=tutorial.continueTutorial(h.state);assert.equal(h.state.tutorial.step,'charge');h.state=tutorial.continueTutorial(h.state);assert.equal(h.state.tutorial.step,'activate');assert.equal(h.state.frenesis.charge,100);assert.equal(h.state.tutorial.planned,12);
 h.state=api.activateFrenesis(h.state);step(h);assert.equal(h.state.tutorial.step,'transform');assert(h.state.frenesis.active);assert.equal(h.state.hp,h.state.maxHp);h.state=tutorial.continueTutorial(h.state);step(h);assert.equal(h.state.tutorial.step,'teleport');
 const target=h.state.tutorial.target;assert(target);const tele=frenesis.teleportFrenesis(h.state.frenesis,h.player,target.x,target.y,true);assert.equal(tele.frenesis.teleportMs,3000);h.state={...h.state,frenesis:tele.frenesis};h.player=tele.player;assert.equal(frenesis.teleportFrenesis(h.state.frenesis,h.player,h.player.x+20,h.player.y,true).frenesis,h.state.frenesis);
 const almost=frenesis.advanceFrenesis(tele.frenesis,2999);assert.equal(almost.teleportMs,1);assert.equal(frenesis.teleportFrenesis(almost,h.player,target.x,target.y,true).frenesis,almost,'2999 ms cannot teleport');const ready=frenesis.advanceFrenesis(almost,1);assert.equal(ready.teleportMs,0);assert.notEqual(frenesis.teleportFrenesis(ready,h.player,target.x,target.y,true).frenesis,ready,'Exactly 3000 ms permits another valid teleport');assert.equal(frenesis.teleportFrenesis(ready,h.player,target.x,target.y,false).frenesis,ready,'Rejected destinations do not consume cooldown');
 until(h,s=>s.tutorial.step==='spin');assert.equal(h.state.tutorial.teleported,true);assert(h.state.frenesis.teleportMs>0);h.state.frenesis={...h.state.frenesis,teleport:null};h.player={...h.player,frenesisBlink:false};
 const normalHp=h.state.hp;h.player=players.requestAttack(h.player);
 for(let n=0;n<2500&&h.state.tutorial.step!=='finish';n++){
  const e=h.state.encounter.enemies.find(e=>e.active&&e.action!=='death');
  if(e&&collision.isWalkable(e.x+24,e.y))h.player={...h.player,x:e.x+24,y:e.y};
  step(h);if(!h.state.frenesis.active&&h.state.tutorial.step==='activate'){h.state=api.activateFrenesis(h.state);step(h);if(h.state.tutorial.step==='transform')h.state=tutorial.continueTutorial(h.state);step(h);h.player=players.requestAttack(h.player);}
 }
 assert.equal(h.state.tutorial.step,'finish');assert.equal(h.state.tutorial.spawned,12);assert(h.state.tutorial.spinMs>=1100);assert.equal(h.state.frenesis.active,false);assert.equal(h.state.encounter.enemies.filter(e=>e.active).length,0);assert(h.state.hp>=1);assert.equal(normalHp,h.state.maxHp);isolate(h);
 const fresh=api.createSurvival(777,'easy');assert.equal(fresh.tutorial,undefined);assert.equal(fresh.frenesis.charge,0);assert.equal(fresh.encounter.defeated,0);assert.equal(fresh.encounter.enemies.filter(e=>e.active).length,0);assert.equal(fresh.xp,0);assert.equal(fresh.pendingChests,0);
});
test('Pause/no-time guard freezes practice ages, ultimate and seeded spawn progress',()=>{
 const h=session();completeMovement(h);const before=h.state;assert.equal(tutorial.advanceTutorial(before,h.player,h.player,h.field,0),before);
 const paused={...h.state,mode:'upgrade'};assert.equal(tutorial.advanceTutorial(paused,h.player,h.player,h.field,4000),paused);assert.equal(paused.tutorial.elapsedMs,before.tutorial.elapsedMs);assert.equal(paused.encounter.randomSeed,before.encounter.randomSeed);isolate(h);
});
test('Practice cannot die and expired Frenesis re-arms practice without extending the real 15s timer',()=>{
 const h=session();h.state.tutorial={...h.state.tutorial,step:'spin',planned:12,spawned:12,spinMs:0};h.state.hp=1;
 h.state.frenesis={...frenesis.startFrenesis({...h.state.frenesis,charge:100},true),remainingMs:20};step(h);assert.equal(h.state.tutorial.step,'activate');assert.equal(h.state.frenesis.active,false);assert.equal(h.state.frenesis.charge,100);
 h.state=api.activateFrenesis(h.state);assert.equal(h.state.frenesis.remainingMs,15000);
 h.state.frenesis=frenesis.endFrenesis(h.state.frenesis);h.state.hp=1;h.state.tutorial={...h.state.tutorial,step:'wave',spawned:4,planned:4,dashDone:true};h.state.invulnerableMs=0;h.state.encounter.enemies[0]={...h.state.encounter.enemies[0],active:true,action:'move',x:h.player.x,y:h.player.y,id:99};step(h);assert.equal(h.state.hp,1);assert.equal(h.state.mode,'playing');assert.equal(h.state.ending,undefined);isolate(h);
});
if(!process.exitCode)console.log(`Tutorial gameplay passed: ${cases} scenarios, ${ticks} serialized-worklet simulation frames, real movement/slashes/dash/Frenesis/teleport/spin, finite 4+12 enemies, pause and zero persistent reward data. No hardware claim.`);
