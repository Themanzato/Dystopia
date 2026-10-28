/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.join(root,relative);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const source=fs.readFileSync(file,'utf8');const code=/[\\/](survival|worldEvents|optionalEvents)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module:m,exports:m.exports,require:id=>{assert(id.startsWith('.'));const p=path.resolve(path.dirname(file),id);return id.endsWith('.png')?p:load(path.relative(root,p+'.ts'));}},{filename:file});return m.exports;}

const api=load('src/game/survival.ts'),events=load('src/game/worldEvents.ts'),opt=load('src/game/optionalEvents.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts'),npcApi=load('src/game/npc.ts');
const {REWARD_SITES}=load('src/game/worldEventSites.ts'),{OPTIONAL_EVENT_CONFIG:C}=opt;
const hero={...players.createPlayer(),x:REWARD_SITES[0].x,y:REWARD_SITES[0].y},fields=new Map();
function field(p){const key=p.x+':'+p.y;if(!fields.has(key))fields.set(key,nav.buildFlowField(p));return fields.get(key)}
function scene(mode='easy',seed=123){const s=api.createSurvival(seed,mode);s.encounter={...s.encounter,wave:2,phase:'spawning',remaining:1,spawnMs:1e9};s.invulnerableMs=1e9;s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=2;s.world.nextShipAtMs=1e12;s.world.reinforcementMs=1e9;return s;}
const step=(s,p=hero,dt=40,b=p)=>api.advanceSurvival(s,b,p,field(p),dt);
function start(kind,mode='easy'){for(let seed=1;seed<120;seed++){let s=scene(mode,seed);s.clockMs=s.world.optional.nextOpportunityMs;s.world.missionRotation={remaining:[kind,...['capture','elite','nest','reactor'].filter(k=>k!==kind)],last:null,seed,round:1};s=step(s);if(s.world.optional.active?.kind===kind)return s}throw Error('No seeded '+kind)}
function activate(s){s.world.optional.active.phase='active';s.world.optional.active.elapsedMs=0;return s}
const living=s=>s.encounter.enemies.filter(n=>n.active&&n.action!=='death');
const owned=s=>living(s).filter(n=>n.eventOwner);
let cases=0;function test(name,fn){fn();cases++;console.log('PASS '+name)}
test('Seeded 150-240s opportunities and actual starts from the shared mission bag',()=>{
 for(let seed=0;seed<1200;seed++){const s=opt.createOptionalEvents(seed);assert(s.nextOpportunityMs>=150000&&s.nextOpportunityMs<240000);}
 for(const k of ['elite','nest','reactor']){const s=start(k);assert.equal(s.world.optional.active.kind,k);assert.equal(s.events.eventStart??0,s.world.optional.active.phase==='queued'?0:1);assert.equal(s.world.zone,null);assert.equal(s.world.ship,null)}
});
test('Central exclusion postpones captures, ships and bosses without a backlog, even on wave 27',()=>{
 for(const blocker of ['zone','ship','boss','pendingBoss'])for(const wave of [2,27]){
  let s=scene();s.clockMs=s.world.optional.nextOpportunityMs;s.encounter.wave=wave;s.world.checkedShipWave=wave;
  if(blocker==='zone')s.world.zone={...REWARD_SITES[0],id:1,siteId:REWARD_SITES[0].id,reward:'rhythm',elapsedMs:0,inside:false};
  if(blocker==='ship')s.world.ship={siteId:'power-relay-a',phase:'armed',elapsedMs:0,enemyId:'shielder',nextTryMs:0};
  if(blocker==='boss')s.boss={id:'shielder',name:'Shielder',entityId:99,x:hero.x+250,y:hero.y,hp:30,maxHp:30,phase:'intro',phaseMs:0,animationMs:0,pattern:0,lastHitSerial:-1,facingX:-1,aimAngle:0};
  if(blocker==='pendingBoss')s.pendingBoss=true;
  assert(!events.canStartOptional(s));s=step(s);assert.equal(s.world.optional.active,null);assert(s.world.optional.nextCheckMs>s.clockMs);
 }
 const s=start('nest');assert(!events.canRunWorldEvent(s,'capture',27,s.clockMs+20000));assert(!events.canRunWorldEvent(s,'ship',27,s.clockMs+20000));assert(!events.canStartSpecial(s,'scheduled'));
});
test('Elite reserves a normal wave, warns for 3s, replaces an exact fraction and shares the existing cap',()=>{
 for(const mode of ['easy','hard','dystopia']){
  let s=start('elite',mode),e=s.world.optional.active;const target=e.wave,quota=e.eliteQuota;
  s.encounter.remaining=0;s.encounter.phase='clearing';s=step(s);assert.equal(s.encounter.phase,'intermission');s=step(s);assert.equal(s.world.optional.active.phase,'warning');
  for(let i=0;i<74;i++){s=step(s);assert(s.encounter.wave<target)}
  for(let i=0;i<600&&s.encounter.remaining>0||s.encounter.wave<target;i++){s=step(s);assert(i<650)}
  assert.equal(s.encounter.wave,target);assert.equal(living(s).length,api.wavePlan(target,mode).count);assert(living(s).length<=60);
  const elites=living(s).filter(n=>n.eliteEventId);assert.equal(elites.length,quota);assert(elites.every(n=>n.hp===opt.optionalTuning(target,mode).eliteHp&&n.eliteSpeed>1));
  assert.equal(s.events.eventComplete??0,0);
 }
});
test('Elite HP is real, one serial hits once, normal NPC remain one-hit and rewards wait for full clear',()=>{
 let s=activate(start('elite'));s.world.optional.active.wave=2;s.encounter.enemies[0]={...npcApi.emptyNpc(),id:1,active:true,action:'move',x:hero.x+30,y:hero.y,hp:2,maxHp:2,eliteEventId:s.world.optional.active.id,eventOwner:s.world.optional.active.id,eliteSpeed:1.12};
 const b={...hero,action:'attack',actionMs:60,attackSerial:1,attackIndex:0},a={...b,actionMs:100};s=step(s,a,40,b);assert.equal(s.encounter.enemies[0].hp,1);assert.equal(s.events.kill,0);s=step(s,a,40,b);assert.equal(s.encounter.enemies[0].hp,1);
 s=step(s,{...a,attackSerial:2},40,{...b,attackSerial:2});assert.equal(s.events.kill,1);assert.equal(s.events.eventComplete??0,0);
 s.encounter.enemies[1]={...npcApi.emptyNpc(),id:2,active:true,action:'move',x:hero.x+30,y:hero.y};s=step(s,{...a,attackSerial:3},40,{...b,attackSerial:3});assert.equal(s.events.kill,2);
 const xp=s.xp,charge=s.frenesis.charge;s.encounter.remaining=0;s.encounter.phase='clearing';s=step(s);assert.equal(s.world.optional.active,null);assert.equal(s.xp,xp+16);assert.equal(s.frenesis.charge,charge+8);assert.equal(s.missions.elites,1);assert.equal(s.events.eventComplete,1);s=step(s);assert.equal(s.events.eventComplete,1);
 assert(s.world.optional.cooldownUntilMs>=s.clockMs+119900);assert(s.world.optional.nextOpportunityMs>=s.clockMs+149900);
});
test('Nest spawns only bounded reachable common NPCs and removes its own entities on completion',()=>{
 let s=activate(start('nest'));for(let i=0;i<400;i++)s=step(s);assert(owned(s).length>0);assert(owned(s).length<=6);for(const n of owned(s))assert(nav.isReachable(n,field(hero)));
 const center={...hero,...s.world.optional.active.points[0]};for(let i=0;i<100;i++)s=step(s,center);const progress=s.world.optional.active.points[0].progressMs;assert.equal(progress,4000);
 for(let i=0;i<100;i++)s=step(s,hero);assert.equal(s.world.optional.active.points[0].progressMs,progress);
 for(let i=0;i<100;i++)s=step(s,center);assert.equal(s.world.optional.active,null);assert.equal(owned(s).length,0);assert.equal(s.events.eventComplete,1);assert.equal(s.xp,12);assert.equal(s.frenesis.charge,4);assert.equal(s.missions.nests,1);
 for(let i=0;i<150;i++)s=step(s,center);assert.equal(owned(s).length,0);assert.equal(s.events.eventComplete,1);
});
test('Nest respects the global 60 cap and its per-mode 6/8/10 owned cap',()=>{
 for(const mode of ['easy','hard','dystopia']){let s=activate(start('nest',mode));s.world.optional.active.spawnMs=0;s.encounter.enemies=s.encounter.enemies.map((n,i)=>({...n,id:i+1,active:true,action:'move',x:hero.x+200+i%5*20,y:hero.y+200+Math.floor(i/5)*10}));s=step(s);assert(living(s).length<=60);assert.equal(owned(s).length,0);assert.equal(opt.optionalTuning(2,mode).nestLimit,C.modes[mode].nestLimit)}
});
test('All three timeouts fail once, grant no reward and clear owned NPCs/markers',()=>{
 for(const kind of ['elite','nest','reactor']){let s=activate(start(kind));s.encounter.enemies[0]={...npcApi.emptyNpc(),id:100,active:true,action:'move',x:hero.x+100,y:hero.y,eventOwner:s.world.optional.active.id};s.encounter.enemies[1]={...npcApi.emptyNpc(),id:101,active:true,action:'move',x:hero.x+120,y:hero.y};s.world.optional.active.wave=2;s.world.optional.active.elapsedMs=(kind==='elite'?C.eliteDeadlineMs:kind==='nest'?C.nestDeadlineMs:C.reactorDeadlineMs)-40;s=step(s);assert.equal(s.world.optional.active,null);assert.equal(s.world.optional.failed,1);assert.equal(owned(s).length,0);assert(s.encounter.enemies.some(n=>n.active&&n.id===101),'Regular NPC survive event cleanup');assert.equal(s.xp,0);assert.equal(s.events.eventComplete??0,0);assert.equal(s.missions.nests+s.missions.reactors+s.missions.elites,0);for(let i=0;i<30;i++)s=step(s);assert.equal(s.world.optional.failed,1);assert.equal(s.world.optional.visibility,0)}
});
test('Reactor has three separated reachable points, preserves progress and restores vision in thirds',()=>{
 let s=activate(start('reactor'));const points=s.world.optional.active.points;assert.equal(points.length,3);for(let i=0;i<3;i++){assert(nav.isReachable(points[i],field(hero)));for(let j=i+1;j<3;j++)assert(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>=220)}
 for(let i=0;i<25;i++)s=step(s);assert.equal(s.world.optional.visibility,1);
 for(let index=0;index<3;index++){const p={...hero,...points[index]};for(let i=0;i<50;i++)s=step(s,p);const progress=s.world.optional.active.points[index].progressMs;assert.equal(progress,2000);for(let i=0;i<10;i++)s=step(s,hero);assert.equal(s.world.optional.active.points[index].progressMs,progress);for(let i=0;i<50;i++)s=step(s,p);if(index<2){assert.equal(s.world.optional.active.points.filter(p=>p.complete).length,index+1);for(let i=0;i<24;i++)s=step(s,hero);assert(Math.abs(s.world.optional.visibility-(1-(index+1)/3))<1e-6)}}
 assert.equal(s.world.optional.active,null);assert.equal(s.events.eventComplete,1);assert.equal(s.xp,20);assert.equal(s.frenesis.charge,6);assert.equal(s.missions.reactors,1);for(let i=0;i<25;i++)s=step(s);assert.equal(s.world.optional.visibility,0);
});
test('Scheduled boss priority cancels cleanly without skipping its calendar or retaining darkness',()=>{
 let s=activate(start('reactor'));s.world.optional.visibility=1;s.encounter.wave=4;s.world.checkedShipWave=4;s.encounter.phase='intermission';s.encounter.timerMs=0;
 s=step(s);assert.equal(s.world.optional.active,null);assert.equal(s.world.optional.visibility,0);assert.equal(s.world.optional.notice,null);assert.equal(s.world.optional.failed,1);assert.equal(s.encounter.wave,5);assert(s.boss||s.pendingBoss,'Scheduled miniboss was not skipped');assert.equal(s.events.eventComplete??0,0);
});
test('Pause, zero delta and terminal states freeze or clean every event-owned system',()=>{
 for(const kind of ['elite','nest','reactor']){let s=activate(start(kind));s.world.optional.visibility=kind==='reactor'?1:0;s.mode='upgrade';const frozen=JSON.stringify(s);assert.equal(step(s),s);assert.equal(JSON.stringify(s),frozen);s.mode='playing';assert.equal(step(s,hero,0),s);for(const mode of ['dead','won']){const q=step({...s,mode});assert.equal(q.world.optional.active,null);assert.equal(q.world.optional.visibility,0)}}
 let s=activate(start('nest'));s.hp=1;s.invulnerableMs=0;s.encounter.enemies[0]={...npcApi.emptyNpc(),id:1,active:true,action:'move',x:hero.x+2,y:hero.y,eventOwner:s.world.optional.active.id};s=step(s);assert.equal(s.mode,'dead');assert.equal(owned(s).length,0);assert.equal(s.world.optional.active,null);
});
test('Explicit Frenesis rewards defer during the ultimate and are applied once afterwards',()=>{
 let s=activate(start('nest'));s.frenesis={...s.frenesis,active:true,remainingMs:15000,hp:5};const p={...hero,...s.world.optional.active.points[0]};s.world.optional.active.points[0].progressMs=7960;s=step(s,p);assert.equal(s.frenesis.charge,0);assert.equal(s.world.optional.pendingCharge,4);s.frenesis.active=false;s=step(s);assert.equal(s.frenesis.charge,4);assert.equal(s.world.optional.pendingCharge,0);s=step(s);assert.equal(s.frenesis.charge,4);
});
test('Normal wave changes preserve zone progress; Purgatorio never starts optional events',()=>{
 let s=activate(start('nest'));s.world.optional.active.points[0].progressMs=3000;s.encounter.phase='intermission';s.encounter.timerMs=0;s=step(s);assert.equal(s.encounter.wave,3);assert.equal(s.world.optional.active.points[0].progressMs,3000);
 s=scene();s.purgatorio=load('src/game/purgatorio.ts').createPurgatorio({mode:'purgatorio',encounter:'shielder'},1);s.clockMs=300000;s=step(s);assert.equal(s.world.optional.active,null);
});

test('One overdue opportunity resumes after capture cleanup with no burst or repeated alerts',()=>{
 let s=scene();s.world.missionRotation={remaining:['nest','reactor','elite'],last:'capture',seed:1,round:1};s.clockMs=s.world.optional.nextOpportunityMs;s.world.zone={...REWARD_SITES[0],id:1,siteId:REWARD_SITES[0].id,reward:'rhythm',elapsedMs:29960,inside:true};s=step(s);assert.equal(s.world.zone,null);assert.equal(s.world.optional.active,null);
 for(let i=0;i<200;i++){s=step(s);assert.equal(s.world.optional.active,null)}
 for(let i=0;i<4000&&!s.world.optional.active;i++)s=step(s);assert(s.world.optional.active);assert.equal(s.events.eventStart,1);
 for(let i=0;i<100;i++)s=step(s);assert.equal(s.events.eventStart,1);
});
test('Opportunity RNG/site decisions stay idle between configured checks',()=>{
 let s=scene(),seed=s.world.randomSeed;for(let i=0;i<2500;i++)s=step(s);assert.equal(s.world.randomSeed,seed);assert.equal(s.world.optional.active,null);
 s.world.missionRotation={remaining:['nest','reactor','elite'],last:'capture',seed:1,round:1};s.clockMs=s.world.optional.nextOpportunityMs;s=step(s);assert(s.world.optional.active);seed=s.world.randomSeed;for(let i=0;i<20;i++)s=step(s);assert.equal(s.world.randomSeed,seed);
});

test('Serialized active-event tick resolves its scheduler and captures without JS globals',()=>{
 const native=vm.runInNewContext(`(${api.advanceSurvival.__initData.code})`,{});let s=activate(start('reactor'));const point={...hero,...s.world.optional.active.points[0]};s.world.optional.active.points[0].progressMs=3960;
 const next=native.apply({__closure:api.advanceSurvival.__closure},[s,point,point,field(point),40]);assert(next.world.optional.active.points[0].complete);assert.equal(next.events.eventComplete??0,0);
});
console.log(`Optional events passed: ${cases} native-transformed scenarios; scheduler/exclusion, authentic elite HP, bounded nests, reactor recovery, rewards, death and pause. No physical-device FPS measured.`);
