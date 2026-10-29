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
const api = load('src/game/survival.ts'), players = load('src/game/player.ts');
const nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts');
const { BOSS_BALANCE, BOSS_MODES, RANGED_PHASE_BALANCE } = load('src/game/bossBalance.ts');
const { hazardHits } = load('src/game/bossHazards.ts');
const { beamDraws, hazardIsActive } = load('src/game/bossEffects.ts');
const { worldRandom } = load('src/game/worldEvents.ts');
const { bossFrame } = load('src/game/survivalAssets.ts');
let origin;
for (let y = 950; !origin && y <= 1900; y += 24) for (let x = 900; !origin && x <= 2000; x += 24) {
  let clear = collision.isWalkable(x,y);
  for (let r = 8; clear && r <= 150; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r)) {clear=false;break;}
  if (clear) origin = {...players.createPlayer(),x,y};
}
assert(origin,'Real city has a connected open arena for deterministic combat tests');
const field = nav.buildFlowField(origin), fixtures = new Map(), failures = [];
let cases = 0, simulated = 0;
const copy = value => JSON.parse(JSON.stringify(value));
function step(state,dt=40,before=origin,after=before,view) {simulated++;return api.advanceSurvival(state,before,after,field,dt,view);}
function test(name,fn) {if(process.env.DYSTOPIA_BOSS_CASE&&!name.includes(process.env.DYSTOPIA_BOSS_CASE))return;try {fn();cases++;console.log('PASS '+name);} catch(error) {failures.push(name+': '+error.message);console.error('FAIL '+name+': '+error.stack);}}
function liveNpcs(state) {return state.encounter.enemies.filter(n=>n.active&&n.action!=='death');}
function silence(state) {
  state.invulnerableMs=1e9; state.world.reinforcementMs=1e9;
  state.encounter={...state.encounter,remaining:0,phase:'clearing',spawnMs:1e9,enemies:state.encounter.enemies.map(n=>({...n,active:false}))};
  state.orbs=[];state.chests=[];state.pendingUpgrades=0;state.pendingChests=0;
  return state;
}
function fixture(id,mode='easy') {
  const key=id+'/'+mode;
  if (!fixtures.has(key)) {
    let state=api.createSurvival(71,mode,{mode:'purgatorio',encounter:id});state.invulnerableMs=1e9;
    for(let n=0;n<250&&(!state.boss||state.presentation);n++)state=step(state);
    assert(state.boss,'Real encounter creates '+id);assert.equal(state.boss.id,id);assert.equal(state.presentation,null);
    fixtures.set(key,copy(state));
  }
  const state=silence(copy(fixtures.get(key)));
  state.boss={...state.boss,x:origin.x+120,y:origin.y,facingX:-1,phase:'recover',phaseMs:0,animationMs:0,
    attackRootX:0,pattern:0,attackIndex:0,attackRate:1,summonMs:0};
  state.bossActionUntilMs=0;state.hazards=[];state.minibosses=[];state.partner=null;
  return state;
}
function begin(id,index=0,mode='easy',options={}) {
  let state=fixture(id,mode);
  Object.assign(state.boss,{phaseMs:10000,pattern:index},options);
  if(id==='dagger-mush') {
    for(let seed=1;seed<100000;seed++) {const world={...state.world,randomSeed:seed};if(Math.floor(worldRandom(world)*3)===index){state.world.randomSeed=seed;break;}}
  }
  state=step(state);
  assert.equal(state.boss.phase,'warning',id+' enters its real warning state');
  assert.equal(state.boss.attackIndex,index,id+' selects intended authored attack');
  return state;
}
function until(state,predicate,max=400,dt=40,player=origin) {
  for(let n=0;n<max&&!predicate(state);n++)state=step(state,dt,player);
  assert(predicate(state),'Timed simulation reached requested state');return state;
}
function recover(state,dt=40) {return until(state,s=>s.boss.phase==='recover',400,dt);}
function killBoss(state) {
  state.boss={...state.boss,hp:1,x:origin.x+60,y:origin.y,facingX:1,phase:'warning',phaseMs:0,attackIndex:0,attackRate:1};
  state.bossActionUntilMs=1e9;
  let p=players.beginAttack({...origin,comboMs:0,attackSerial:state.lastAttackSerial+1});
  for(let n=0;n<30&&state.boss.phase!=='death';n++) {const next=players.advancePlayer(p,players.REST_INPUT,20);state=step(state,20,p,next);p=next;}
  assert.equal(state.boss.phase,'death','Actual sword strike kills the actor');return state;
}

for(const mode of ['easy','hard','dystopia'])test('Widow '+mode+' own summons respect cap, release deaths and leave other sources independent',()=>{
  let s=fixture('tarnished-widow',mode);s.bossActionUntilMs=1e9;
  const owner=s.boss.entityId,cap=BOSS_BALANCE.widowSummonLimit[mode],otherOwner=owner+999;
  s.encounter.enemies=s.encounter.enemies.map((n,i)=>({...n,active:i<cap+2,action:'idle',x:origin.x+260,y:origin.y+80,summonOwner:i<cap-2?owner:i<cap?otherOwner:undefined}));
  const own=state=>liveNpcs(state).filter(n=>n.summonOwner===owner).length;
  const burst=()=>{s.hazards=[{id:9000+s.clockMs,owner,kind:'blast',x:origin.x+140,y:origin.y,angle:0,radius:70,ageMs:0,warningMs:0,activeMs:500,damage:1,npcBurst:10}];s=step(s);};
  burst();assert.equal(own(s),cap);assert.equal(liveNpcs(s).filter(n=>n.summonOwner===otherOwner).length,2);assert.equal(liveNpcs(s).filter(n=>n.summonOwner===undefined).length,2);
  burst();assert.equal(own(s),cap,'A second impact cannot exceed the owner-specific cap');
  const victim=s.encounter.enemies.findIndex(n=>n.active&&n.summonOwner===owner);s.encounter.enemies[victim]={...s.encounter.enemies[victim],active:false,action:'death'};
  burst();assert.equal(own(s),cap,'A death releases one slot for a later invocation');
  s.encounter={...s.encounter,phase:'spawning',remaining:1,spawnMs:0};s=step(s);assert.equal(s.encounter.remaining,0,'Normal wave spawns continue despite the full Widow quota');assert(liveNpcs(s).length>cap);
});
test('Widow natural cycles reduce invocation frequency and never summon on consecutive attacks',()=>{
  let s=fixture('tarnished-widow');const summoned=[],seen=new Set();
  for(let turn=0;turn<24;turn++){
    s.encounter.enemies=s.encounter.enemies.map(n=>({...n,active:false}));s.hazards=[];
    s.boss={...s.boss,x:origin.x+140,y:origin.y,phase:'recover',phaseMs:10000};s.bossActionUntilMs=0;s=step(s);
    for(let n=0;n<260&&s.boss.phase!=='recover';n++){
      s=step(s);for(const h of s.hazards)if(h.npcBurst&&!seen.has(h.id)){seen.add(h.id);summoned.push(turn);}
    }
    assert.equal(s.boss.phase,'recover');
  }
  assert(summoned.length>=4&&summoned.length<=9,'Previously 16 of these 24 attacks invoked; the cooldown approximately halves it: '+summoned.length);
  assert(summoned.every((turn,i)=>!i||turn-summoned[i-1]>1),'No consecutive summoning attacks');
});
for(const mode of ['easy','hard','dystopia'])test('Final HP modifiers '+mode+' affect only Widow, Rock and both bandits exactly once',()=>{
  for(const id of ['tarnished-widow','rock-boss','dagger-bandit','dagger-mush','archer']){
    const s=fixture(id,mode),spec=load('src/game/enemyCatalog.ts').ENEMY_DEFS[id];
    const tuning=load('src/game/purgatorio.ts').purgatorioTuning(1,mode);
    const baseline=Math.ceil(spec.hp*BOSS_MODES[mode].hp*tuning.hpMultiplier)*(id==='rock-boss'?.7:1);
    const expected=baseline*(mode==='easy'&&BOSS_BALANCE.easyReducedHealthIds.includes(id)?.8:1);
    assert.equal(s.boss.maxHp,expected);assert.equal(s.boss.hp,expected);assert.equal(step(s).boss.maxHp,expected);
    if(s.partner)assert.equal(s.partner.maxHp,s.boss.maxHp);
  }
});
test('native serialized entry point and pause keep every combat timer inert',()=>{
  const native=api.advanceSurvival;
  assert(native.__initData?.code);
  const fn=vm.runInNewContext('('+native.__initData.code+')',{});
  const state=begin('evil-sage');
  assert.equal(fn.apply({__closure:native.__closure},[state,origin,origin,field,0]),state);
  const updated=fn.apply({__closure:native.__closure},[state,origin,origin,field,16]);
  assert.equal(updated.clockMs,state.clockMs+16);
});
for(const mode of ['easy','hard','dystopia']) test('Shielder '+mode+' charged fan and owner/lifetime cleanup',()=>{
  let state=begin('shielder',1,mode), shots=state.hazards;
  assert.equal(shots.length,BOSS_MODES[mode].balls);
  assert(shots.every(h=>h.kind==='ball'&&h.warningMs>=BOSS_BALANCE.warningMinMs&&h.damage===1));
  assert.equal(new Set(shots.map(h=>h.angle)).size,shots.length);
  for(let i=1;i<shots.length;i++)assert(Math.abs(shots[i].angle-shots[i-1].angle-.22)<1e-10,'Fan has narrow dodgeable spaces');
  const ids=new Set(shots.map(h=>h.id));
  state=until(state,s=>s.boss.phase==='attack');
  state=until(state,s=>!s.hazards.some(h=>ids.has(h.id)),200);
  assert(state.clockMs<20000,'Projectiles impact/expire, never accumulate');
  state=killBoss(begin('shielder',1,mode));
  assert.equal(state.hazards.length,0,'Killing owner cancels its charged shots');
});
for(const mode of ['easy','hard','dystopia'])test('Shielder '+mode+' projectile really impacts player once',()=>{
  let state=begin('shielder',1,mode);state.invulnerableMs=0;const hp=state.hp;
  state=until(state,s=>s.events.damage>0,200);
  assert.equal(state.hp,hp-1);assert.equal(state.events.damage,1);
  if(mode==='dystopia'){assert.equal(state.mode,'dead');assert.equal(state.hazards.length,0);}
  else{for(let n=0;n<8;n++)state=step(state,16);assert.equal(state.hp,hp-1,'Invulnerability rejects overlapping fan damage');}
});
test('Sage retreats, stays still while charging, alternates self and distant actual explosions',()=>{
  for(const index of [0,1]) {
    let state=begin('evil-sage',index), b=state.boss, h=state.hazards[0];
    assert(h&&h.kind==='blast');assert.equal(h.fx,index===0?'sageDark':'sageCyan');
    assert.equal(h.x,index===0?b.x:origin.x);assert.equal(h.y,index===0?b.y:origin.y);
    assert(b.x>origin.x+120,'Sage creates distance before charging');
    const x=b.x,y=b.y,hp=b.hp;
    for(let n=0;n<8;n++){state=step(state);assert.equal(state.boss.x,x);assert.equal(state.boss.y,y);}
    assert.equal(bossFrame(state.boss).source.y,189,'Charge animation is separate from movement');
    state=until(state,s=>s.hazards.some(h=>hazardIsActive(h)),100);
    assert.equal(state.boss.hp,hp,'Its own real explosion never damages Sage');
    if(index===1) {state.invulnerableMs=0;const before=state.hp;state=step(state);assert.equal(state.hp,before-1,'Distant explosion really damages player');}
  }
});
test('Archer laser has rotated continuous geometry, active-only collision, and low-HP gated cooldown teleport',()=>{
  let state=begin('archer',0,'easy',{y:origin.y+70}),h=state.hazards[0];
  assert(h.kind==='beam'&&Math.abs(Math.sin(h.angle))>.1,'Laser aims along diagonal to player');
  assert.equal(beamDraws({...h,length:h.maxLength})[0].angle,h.angle);
  assert.equal(hazardIsActive(h),false);
  const offset={...origin,x:h.x+Math.cos(h.angle)*180,y:h.y+Math.sin(h.angle)*180};
  assert(hazardHits({...h,length:h.maxLength},offset));assert(!hazardHits({...h,length:h.maxLength},{...offset,x:offset.x-Math.sin(h.angle)*100,y:offset.y+Math.cos(h.angle)*100}));
  state=until(state,s=>s.hazards.some(h=>hazardIsActive(h)),100);
  h=state.hazards[0];state.invulnerableMs=0;const hp=state.hp;state=until(state,s=>s.hp<hp,40,8);assert.equal(state.hp,hp-1,'Propagating active ray damages player');
  for(const ratio of [1,.51]) {let high=fixture('archer');Object.assign(high.boss,{phaseMs:10000,pattern:2,hp:high.boss.maxHp*ratio,teleportCooldownMs:0});high=step(high);assert.equal(high.boss.attackIndex,0,'No teleport above half HP');}
  let tele=fixture('archer');Object.assign(tele.boss,{phaseMs:10000,pattern:2,hp:7,teleportCooldownMs:0});tele=step(tele);
  assert.equal(tele.boss.attackIndex,1);const tell=tele.hazards[0];assert.equal(tell.kind,'teleport');assert(Math.hypot(tell.x-origin.x,tell.y-origin.y)>=150);
  tele=until(tele,s=>s.boss.moveDone===true);assert.equal(tele.boss.x,tell.x);assert.equal(tele.boss.y,tell.y);assert(tele.boss.teleportCooldownMs<=RANGED_PHASE_BALANCE.archer.easy.teleportMs&&tele.boss.teleportCooldownMs>0);
  tele.boss={...tele.boss,phase:'recover',phaseMs:10000,pattern:2};tele.bossActionUntilMs=0;tele=step(tele);assert.equal(tele.boss.attackIndex,0,'Cooldown prevents consecutive teleports');
});
for(const mode of ['easy','hard','dystopia'])test('Bomb Droid '+mode+' staggered real group preserves six HP',()=>{
  let state=fixture('bomb-droid',mode);state.bossActionUntilMs=1e9;
  const times=[];let previous=0;
  for(let n=0;n<90;n++){state=step(state);if(state.minibosses.length>previous){times.push(state.clockMs);previous=state.minibosses.length;}}
  const pack=[state.boss,...state.minibosses];assert.equal(pack.length,BOSS_MODES[mode].droids);
  assert(pack.every(b=>b.id==='bomb-droid'&&b.maxHp===6&&b.hp===6));
  for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=BOSS_BALANCE.packIntervalMs);
  assert.equal(new Set(pack.map(b=>b.entityId)).size,pack.length);
  assert(pack.every(b=>collision.isWalkable(b.x,b.y)));
});
test('Mush real single/double/return sequences retain committed slash and spin world motion',()=>{
  const seen=new Set();
  for(const index of [0,1,2]) {
    let state=begin('dagger-mush',index);seen.add(state.boss.attackIndex);
    if(index===2)state.boss.comboLeft=1;
    const start={x:state.boss.x,y:state.boss.y};
    let attacks=0,firstAim=null,secondAim=null,lastX=null,excursion=0;
    for(let n=0;n<250;n++){
      const prior=state.boss.phase;state=step(state);excursion=Math.max(excursion,Math.hypot(state.boss.x-start.x,state.boss.y-start.y));
      if(prior==='warning'&&state.boss.phase==='attack'){attacks++;if(firstAim===null)firstAim=state.boss.aimAngle;else secondAim=state.boss.aimAngle;}
      if(state.boss.phase==='recover'){lastX=state.boss.x;break;}
    }
    assert(lastX!==null);assert(excursion>20,'Attack has real collision-aware displacement before a possible return');
    assert.equal(attacks,index===2?2:1);
    if(index===2)assert(Math.abs(Math.cos(firstAim-secondAim)+1)<1e-9,'Return strike reverses its committed direction');
    state.bossActionUntilMs=1e9;state=step(state,8);
    assert(Math.abs(state.boss.x-lastX)<2,'Recover never restores pre-attack location');
  }
  assert.equal(seen.size,3);
});
test('Shock slam applies finite stun, one ten-NPC burst and a temporary speed boost',()=>{
  let state=begin('shock-sweeper',1,'easy',{x:origin.x+80});
  const h=state.hazards[0];assert(h&&h.fx==='shockSlam');
  assert.equal(h.npcBurst,10);state.invulnerableMs=0;
  state=until(state,s=>s.stunMs>0,150);
  assert.equal(state.hp,4);assert.equal(state.stunMs,650);
  assert.equal(liveNpcs(state).length,10,'Shock burst has space for 10 at '+JSON.stringify({player:[origin.x,origin.y],impact:[h.x,h.y],spawned:liveNpcs(state).map(n=>[n.x,n.y])}));assert.equal(state.npcBoostMs,5000);
  const ids=liveNpcs(state).map(n=>n.id);assert.equal(new Set(ids).size,10);
  assert(liveNpcs(state).every(n=>collision.isWalkable(n.x,n.y)&&Math.hypot(n.x-origin.x,n.y-origin.y)>=95));
  let p=api.applyPlayerUpgrades(origin,state);assert.equal(players.beginAttack(p),p);assert.equal(players.beginDash(p,{x:1,y:0,strength:1}),p);
  assert.equal(players.advancePlayer(p,{x:1,y:0,strength:1},40).x,p.x,'Stun prevents movement');
  state.bossActionUntilMs=1e9;state.boss={...state.boss,phase:'recover',phaseMs:0};
  for(let i=0;i<35;i++)state=step(state);
  assert.equal(state.stunMs,0);assert.equal(liveNpcs(state).length,10,'Multi-frame slam cannot multiply summons');
  assert.equal(state.npcBoostMs,3600);
});
for(const mode of ['easy','hard','dystopia']) test('Shock '+mode+' spaces summons by 16s and at least three normal strikes',()=>{
  let state=fixture('shock-sweeper',mode),normal=0;const slams=[];
  for(let n=0;n<1900;n++) {
    state.encounter.enemies=state.encounter.enemies.map(n=>n.active?{...n,action:'spawn',actionMs:-1e6}:n);
    if(state.boss.phase==='recover'){state.boss.x=origin.x+80;state.boss.y=origin.y;}
    const prior=state.boss.phase;state=step(state);
    if(prior==='recover'&&state.boss.phase==='warning') {
      if(state.boss.attackIndex===1) {
        if(slams.length){assert(state.clockMs-slams.at(-1)>=16000);assert(normal>=3);}
        slams.push(state.clockMs);normal=0;
        const paused={...state,mode:'upgrade'};assert.equal(step(paused),paused,'Pause freezes the summon cooldown');
      } else normal++;
    }
    assert(liveNpcs(state).length<=30,'Natural repeated slams cannot exceed 30 common monsters');
  }
  assert(slams.length>=2&&slams.length<=5,'Summoning remains available without dominating the attack cycle');
});

for(const mode of ['easy','hard','dystopia']) test('Shock '+mode+' shares its 30-NPC cap with bursts and wave spawns',()=>{
  let state=begin('shock-sweeper',1,mode,{x:origin.x+80});const sites=[];
  for(let y=400;sites.length<29&&y<2600;y+=60)for(let x=400;sites.length<29&&x<2600;x+=60)
    if(collision.isWalkable(x,y)&&Math.hypot(x-origin.x,y-origin.y)>300)sites.push({x,y});
  assert.equal(sites.length,29);
  state.encounter.enemies=state.encounter.enemies.map((npc,i)=>i<29?{...npc,...sites[i],id:7000+i,active:true,action:'spawn',actionMs:-1e6}:npc);
  state=until(state,s=>s.hazards.some(h=>h.fx==='shockSlam'&&h.emitted),150);
  assert.equal(liveNpcs(state).length,30,'Only one NPC fits when the slam lands with 29 alive');
  state.purgatorio=null;state.pendingBoss=false;state.encounter.phase='spawning';state.encounter.remaining=6;state.encounter.spawnMs=0;
  for(let n=0;n<20;n++)state=step(state,8);
  assert.equal(liveNpcs(state).length,30);assert.equal(state.encounter.remaining,6,'Ordinary wave spawns also respect the limit');
  state.encounter.enemies[0]={...state.encounter.enemies[0],action:'death',actionMs:0};
  for(let n=0;n<20&&liveNpcs(state).length<30;n++){state.encounter.spawnMs=0;state=step(state,8);}
  assert.equal(liveNpcs(state).length,30);assert.equal(state.encounter.remaining,5,'Spawns resume when a monster dies');
  state.boss=null;state.encounter.spawnMs=0;state=step(state,8);
  assert.equal(liveNpcs(state).length,31,'The original cap remains available outside Shock encounters');
});

test('Guardian crosses both thresholds once, retains phase under healing and accelerates',()=>{
  let high=fixture('guardian');high.bossActionUntilMs=1e9;const x=high.boss.x;high=step(high);const normal=Math.abs(high.boss.x-x);
  let state=fixture('guardian');state.bossActionUntilMs=1e9;state.boss.hp=15;
  const start=state.boss.x;state=step(state);assert.equal(state.boss.powerPhase,1);assert.equal(state.events.bossPhase,1);assert(Math.abs(state.boss.x-start)>normal*1.7);
  state.boss.hp=state.boss.maxHp;state=step(state);assert.equal(state.boss.powerPhase,1);assert.equal(state.events.bossPhase,1);
  state.boss.hp=7;state=step(state);assert.equal(state.boss.powerPhase,2);assert.equal(state.events.bossPhase,2);assert(state.phaseFlashMs>0);
  state.boss.hp=state.boss.maxHp;state=step(state);assert.equal(state.events.bossPhase,2);
  state.boss={...state.boss,hp:7,teleportCooldownMs:0,phase:'recover',phaseMs:10000};state.bossActionUntilMs=0;state=step(state);assert.equal(state.boss.attackIndex,3,'Only final phase enables quick teleport');
});
for(const mode of ['easy','hard','dystopia'])test('Summoner '+mode+' repeats groups, caps living skeletons and boosts both speeds',()=>{
  let state=fixture('skeleton-summoner',mode),first;
  for(let group=0;group<30;group++) {
    state.boss={...state.boss,x:origin.x+130,y:origin.y,phase:'recover',phaseMs:10000,summonMs:1e6};state.bossActionUntilMs=0;
    state=step(state);assert.equal(state.boss.attackIndex,1);
    state=until(state,s=>s.boss.summonDone===true,150);
    if(first===undefined)first=state.minibosses.filter(b=>b.phase!=='death').length;
    assert(state.minibosses.length<=BOSS_BALANCE.maxSupports);
    assert(state.minibosses.filter(b=>b.phase!=='death').length<=BOSS_MODES[mode].skeletonLimit);
    for(const minion of state.minibosses) {minion.phase='intro';minion.phaseMs=0;}
  }
  assert.equal(first,BOSS_MODES[mode].skeletonGroup);
  assert.equal(state.minibosses.filter(b=>b.phase!=='death').length,BOSS_MODES[mode].skeletonLimit);
  state.minibosses[0]={...state.minibosses[0],hp:0,phase:'death',phaseMs:10000};
  state=step(state);state.boss={...state.boss,x:origin.x+130,y:origin.y,phase:'recover',phaseMs:10000,summonMs:1e6};state.bossActionUntilMs=0;
  state=step(state);state=until(state,s=>s.boss.summonDone===true,150);
  assert.equal(state.minibosses.filter(b=>b.phase!=='death').length,BOSS_MODES[mode].skeletonLimit,'Invocations resume when a slot is free');
  let normal=fixture('skeleton-summoner',mode);normal.bossActionUntilMs=1e9;
  normal.minibosses=[{...state.minibosses[0],x:origin.x-120,y:origin.y,hp:1,phase:'recover',phaseMs:0,animationMs:0,summonMs:0}];
  let powered=copy(normal);powered.boss.hp=1;
  const bx=normal.boss.x,mx=normal.minibosses[0].x;normal=step(normal);powered=step(powered);
  assert(Math.abs(powered.boss.x-bx)>Math.abs(normal.boss.x-bx)*1.5);
  assert(Math.abs(powered.minibosses[0].x-mx)>Math.abs(normal.minibosses[0].x-mx)*1.5);
});
for(const mode of ['easy','hard','dystopia'])test('Dust Jumper '+mode+' bomb spread remains separated while tracking and jump unlocks below two thirds',()=>{
  let low=begin('dust-jumper',0,mode,{hp:1});
  const bombs=low.hazards.filter(h=>h.kind==='bomb');assert.equal(bombs.length,3);
  assert.equal(new Set(bombs.map(h=>h.x+':'+h.y)).size,bombs.length,'Tracking retains offset formation, not stacked bombs');
  const target={...origin,x:origin.x+20,y:origin.y+20};low=step(low,40,target);
  assert.equal(new Set(low.hazards.map(h=>h.x+':'+h.y)).size,bombs.length);
  let high=fixture('dust-jumper',mode);Object.assign(high.boss,{phaseMs:10000,pattern:1});high=step(high);assert.equal(high.boss.attackIndex,0);
  let jump=begin('dust-jumper',1,mode,{hp:1});const h=jump.hazards[0];assert.equal(h.kind,'slam');assert(h.followMs>0);assert.equal(h.followMs,h.warningMs,'Critical jump pursues through contact without a stationary lock');
  jump=until(jump,s=>s.boss.phase==='attack');jump=recover(jump);assert(Math.hypot(jump.boss.x-origin.x,jump.boss.y-origin.y)<5,'Boss really lands on the fixed marker');
  const landed={x:jump.boss.x,y:jump.boss.y};jump.bossActionUntilMs=1e9;jump=step(jump,8);assert(Math.hypot(jump.boss.x-landed.x,jump.boss.y-landed.y)<3);
});
test('Rock laser traverses camera left/right, remains aligned and boosts below half HP',()=>{
  for(const direction of [-1,1]) {
    const view={left:origin.x-150,right:origin.x+150,top:origin.y-120,bottom:origin.y+120};
    let state=fixture('rock-boss');state.combatView=view;Object.assign(state.boss,{x:origin.x+direction*95,phaseMs:10000,pattern:2});state=step(state);
    state=until(state,s=>s.boss.phase==='warning'&&s.boss.attackIndex===2);
    assert.equal(state.boss.attackIndex,2);const start=state.boss.x;
    state=until(state,s=>s.boss.phase==='attack');
    for(let n=0;n<50&&state.boss.phase==='attack';n++) {state=step(state,40,origin,origin,view);const beam=state.hazards.find(h=>h.kind==='beam');if(beam){assert(Math.abs(beam.x-state.boss.x-Math.cos(beam.angle)*28)<1e-8);assert(Math.abs(beam.y-state.boss.y+26-Math.sin(beam.angle)*28)<1e-8);assert.equal(beam.angle,Math.PI/2);}assert(state.boss.x>=view.left+54&&state.boss.x<=view.right-54);}
    assert(direction*(state.boss.x-start)<-80,'Rock crosses toward opposite camera edge');
  }
  let state=fixture('rock-boss');state.bossActionUntilMs=1e9;let powered=copy(state);powered.boss.hp=powered.boss.maxHp*.45;const x=state.boss.x;state=step(state);powered=step(powered);assert(Math.abs(powered.boss.x-x)>Math.abs(state.boss.x-x)*1.7);
});
test('Widow explosion inflicts actual impact plus two finite poison ticks and exactly ten NPCs',()=>{
  let state=begin('tarnished-widow',1);state.hp=10;state.maxHp=10;state.invulnerableMs=0;
  state=until(state,s=>s.poisonMs>0,150);assert.equal(state.hp,9);assert.equal(state.poisonMs,4000);assert.equal(liveNpcs(state).length,10);
  const start=state.clockMs,events=state.events.damage;
  state.boss={...state.boss,phase:'recover',phaseMs:0,x:origin.x+140,y:origin.y};state.bossActionUntilMs=1e9;
  while(state.clockMs-start<4050) {state.encounter.enemies=state.encounter.enemies.map(n=>({...n,active:false}));state=step(state);}
  assert.equal(state.hp,5);assert.equal(state.events.damage,events+2);assert.equal(state.poisonMs,0);assert.equal(state.poisonTickMs,0);
});
for(const dt of [8,16,40])test('Widow jumping impact preserves poison despite landing contact at '+dt+'ms frames',()=>{
  let state=begin('tarnished-widow',2);state.hp=10;state.maxHp=10;state.invulnerableMs=0;
  state=until(state,s=>s.hazards.some(h=>h.emitted),500,dt);
  assert.equal(state.hp,9,'One impact must not double damage from body contact');
  assert(state.poisonMs>0,'Actual jumping explosion applies poison even on the landing contact frame');
  assert.equal(liveNpcs(state).length,10);
});

test('Natural Mush seeded cycles contain singles, doubles and marked return combos',()=>{
  let state=fixture('dagger-mush'),sawSingle=false,sawDouble=false,sawReturn=false;
  for(let turn=0;turn<24;turn++) {
    state.boss={...state.boss,x:origin.x+120,y:origin.y,phase:'recover',phaseMs:10000};state.bossActionUntilMs=0;
    state=step(state);assert.equal(state.boss.phase,'warning');
    let attacks=0,firstAngle=null,secondAngle=null;
    for(let n=0;n<250;n++) {
      const prior=state.boss.phase;state=step(state);
      if(prior==='warning'&&state.boss.phase==='attack') {attacks++;if(firstAngle===null)firstAngle=state.boss.aimAngle;else secondAngle=state.boss.aimAngle;}
      if(state.boss.phase==='recover')break;
    }
    if(attacks===1)sawSingle=true;
    if(attacks===2) {sawDouble=true;if(state.boss.attackIndex===2&&Math.cos(firstAngle-secondAngle)<-.99)sawReturn=true;}
    assert(attacks>=1&&attacks<=2,'Seeded combo is bounded by two prepared strikes');
  }
  assert(sawSingle&&sawDouble&&sawReturn,'All three real sequence choices occur with the seeded encounter RNG');
});
test('Shock NPC acceleration changes actual movement and expires',()=>{
  let state=fixture('shock-sweeper');state.bossActionUntilMs=1e9;
  const enemy={...state.encounter.enemies[0],id:900,kind:'ghoul',active:true,action:'move',actionMs:0,x:origin.x-100,y:origin.y};
  state.encounter.enemies[0]=enemy;let boosted=copy(state);boosted.npcBoostMs=5000;
  state=step(state,16);boosted=step(boosted,16);
  const normal=Math.hypot(state.encounter.enemies[0].x-enemy.x,state.encounter.enemies[0].y-enemy.y);
  const faster=Math.hypot(boosted.encounter.enemies[0].x-enemy.x,boosted.encounter.enemies[0].y-enemy.y);
  assert(faster>normal*1.3,'Boost increases physical NPC displacement, not just its timer');
  boosted.npcBoostMs=1;boosted=step(boosted,16);assert.equal(boosted.npcBoostMs,0);
});
test('Sage retreat can turn along a real collision boundary instead of freezing',()=>{
  let spot;
  for(let y=700;!spot&&y<2100;y+=16)for(let x=700;!spot&&x<2100;x+=4)if(collision.isWalkable(x,y)&&!collision.isWalkable(x+8,y)&&collision.isWalkable(x-60,y))spot={x,y};
  assert(spot,'Find a real city obstacle edge');
  let state=fixture('evil-sage');state.boss={...state.boss,...spot,phase:'recover',phaseMs:0};state.bossActionUntilMs=1e9;
  const player={...origin,x:spot.x-60,y:spot.y};state=step(state,40,player);
  assert(collision.isWalkable(state.boss.x,state.boss.y));assert(Math.hypot(state.boss.x-spot.x,state.boss.y-spot.y)>.2,'Retreat chooses a lateral walkable escape');
});
test('Damage cue is one per sword serial, rate-limited, with death cleanup and clean retry',()=>{
  let state=begin('evil-sage');state.boss={...state.boss,x:origin.x+60,y:origin.y,facingX:1,phase:'warning',phaseMs:0};
  const max=state.boss.hp;let p=players.beginAttack({...origin,comboMs:0});
  for(let n=0;n<15;n++) {const after=players.advancePlayer(p,players.REST_INPUT,16);state=step(state,16,p,after);p=after;}
  assert.equal(state.boss.hp,max-1,'One sword swing cannot hit a boss on every animation frame');assert.equal(state.events.bossHit,1);
  state.boss.hitCueAtMs=state.clockMs;
  p=players.beginAttack({...origin,attackSerial:state.lastAttackSerial+1,attackSpeedMultiplier:8});
  for(let n=0;n<4;n++){const after=players.advancePlayer(p,players.REST_INPUT,16);state=step(state,16,p,after);p=after;}
  assert.equal(state.boss.hp,max-2,'A different real swing applies its own damage');assert.equal(state.events.bossHit,1,'Damage audio cooldown suppresses a second cue within 220ms');
  state.stunMs=300;state.poisonMs=1500;state.poisonTickMs=500;
  state=killBoss(state);assert.equal(state.hazards.length,0);assert.equal(state.stunMs,0);assert.equal(state.poisonMs,0);
  const retry=api.createSurvival(71,'easy',{mode:'purgatorio',encounter:'evil-sage'});
  assert.equal(retry.events.bossHit,0);assert.equal(retry.hazards.length,0);assert.equal(retry.stunMs,0);assert.equal(retry.poisonMs,0);
});

test('Bandits never choose a rolling locomotion attack',()=>{
  const {BOSS_ATTACKS}=load('src/game/bossAttacks.ts');
  for(const id of ['dagger-bandit','archer-bandit']) {
    assert.equal(BOSS_ATTACKS[id].length,id==='archer-bandit'?2:3);
    assert(BOSS_ATTACKS[id].every(move=>move.clip!=='roll'&&move.kind!=='evade'));
    assert(BOSS_ATTACKS[id].some(move=>move.kind==='burrow'));
  }
});
test('Widow keeps fast physical movement during her spit attack at any health',()=>{
  for(const hp of [88,20]) {
    let state=begin('tarnished-widow',1,'easy',{hp});const warningPosition={x:state.boss.x,y:state.boss.y};
    for(let n=0;n<8;n++){state=step(state);assert.equal(state.boss.x,warningPosition.x);assert.equal(state.boss.y,warningPosition.y);}
    state=until(state,s=>s.boss.phase==='attack');let path=0;
    for(let n=0;n<10;n++){const before={x:state.boss.x,y:state.boss.y};state=step(state);path+=Math.hypot(state.boss.x-before.x,state.boss.y-before.y);}
    assert(path>=80,'Spit must move at least 200 world units/second through its first 400ms, HP='+hp+' path='+path);
  }
});
for(const side of [-1,1])test('Rock enters visible laser corridor from '+(side<0?'above':'below')+' before its beam activates',()=>{
  const view={left:origin.x-480,right:origin.x+480,top:origin.y-240,bottom:origin.y+240};let spot;
  for(const dx of [120,-120,0,200,-200,260,-260])for(const dy of [280,300,320,360])if(!spot&&collision.isWalkable(origin.x+dx,origin.y+side*dy)&&nav.isReachable({x:origin.x+dx,y:origin.y+side*dy},field))spot={x:origin.x+dx,y:origin.y+side*dy};
  assert(spot,'Real walkable approach outside the camera');
  let state=fixture('rock-boss');state.combatView=view;Object.assign(state.boss,{...spot,phaseMs:10000,pattern:2});
  let active=0,minX=Infinity,maxX=-Infinity;
  for(let n=0;n<650;n++) {
    state=step(state,40,origin,origin,view);
    const beam=state.hazards.find(h=>h.kind==='beam'&&hazardIsActive(h));
    if(beam){
      active++;minX=Math.min(minX,state.boss.x);maxX=Math.max(maxX,state.boss.x);
      assert(state.boss.y>=view.top+65&&state.boss.y<=view.bottom-45,'Active laser body stays inside visible vertical corridor: '+state.boss.y);
      assert(state.boss.x>=view.left+54&&state.boss.x<=view.right-54,'Active crossing stays between camera edges');
    }else if(active)break;
  }
  assert(active>5,'The boss enters the camera and performs its real laser instead of stalling/skipping');
  assert(maxX-minX>=160,'The visible crossing occurs while firing, not entirely during charge: '+(maxX-minX));
});
test('Charge warning encloses real authored-root trajectories and spin contact ends with its active frames',()=>{
  const {chargeWarningCorners}=load('src/game/bossHazards.ts');
  const {bossAttack}=load('src/game/bossAttacks.ts');
  for(const mode of ['easy','dystopia'])for(const [id,index] of [['dagger-mush',0],['dagger-mush',1],['dagger-bandit',1],['rock-boss',1]])for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5]) {
    let state=fixture(id,mode);const move=bossAttack(id,index),rate=mode==='easy'?1:1.25;
    Object.assign(state.boss,{x:origin.x,y:origin.y,phase:'warning',phaseMs:0,attackIndex:index,attackRate:rate,aimAngle:angle,facingX:Math.cos(angle)<-.1?-1:1,attackRootX:0});
    state.bossActionUntilMs=1e9;
    const speedMultiplier=mode==='easy'?1:1.35;
    const corners=chargeWarningCorners(state.boss,move,speedMultiplier),radius=move.range*.65;
    const inside=p=>corners.every((a,i)=>{const b=corners[(i+1)%corners.length];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-1e-5;});
    let active=0;
    for(let n=0;n<1000&&state.boss.phase!=='recover';n++) {
      state=step(state,8);
      const b=state.boss,ms=b.phaseMs*rate;
      if(b.phase==='attack'&&ms>=move.activeStartMs&&ms<move.activeEndMs) {
        for(const theta of [0,Math.PI/2,Math.PI,Math.PI*1.5]) assert(inside({x:b.x+Math.cos(theta)*radius,y:b.y+Math.sin(theta)*radius}),id+'/'+index+' angle '+angle+' live charge escapes its warning');
        active++;
      }
    }
    assert(active>0);
  }
  let state=fixture('dagger-mush');state.invulnerableMs=0;state.bossActionUntilMs=1e9;
  Object.assign(state.boss,{...origin,phase:'attack',phaseMs:900,attackIndex:1,attackRootX:86,attackRate:1});
  state=step(state,8);assert.equal(state.hp,5,'Fading spin residue cannot still damage through invisible contact');
});

test('Droid encounter retains staggered companions after a very fast leader kill',()=>{
  let state=fixture('bomb-droid','dystopia');state.boss.packRemaining=3;state.boss.packMs=0;state.boss.packWaitMs=0;
  state=killBoss(state);assert.equal(state.purgatorio.phase,'combat');assert.equal(state.boss.hp,0);assert(state.boss.packRemaining>0);
  for(let n=0;n<45;n++)state=step(state,40);
  assert.equal(state.minibosses.filter(b=>b.packMember&&b.hp>0).length,3,'The already-planned group cannot disappear with its leader');
  assert(state.minibosses.every(b=>b.maxHp===6));assert.equal(state.purgatorio.cleared,0);assert.equal(state.purgatorio.phase,'combat');
});

test('Every special enemy flashes only on accepted health damage, once per sword impact',()=>{
  const {MINIBOSS_IDS,BOSS_IDS}=load('src/game/enemyCatalog.ts');
  for(const id of [...MINIBOSS_IDS,...BOSS_IDS]) {
    let state=fixture('guardian');
    Object.assign(state.boss,{id,hp:20,maxHp:20,x:origin.x+60,y:origin.y,facingX:1,phase:'warning',phaseMs:0,animationMs:0,hitFlashMs:0,hitSerial:0,lastHitSerial:-1});
    state.bossActionUntilMs=1e9;
    let p=players.beginAttack({...origin,comboMs:0,attackSerial:state.lastAttackSerial+1});
    for(let n=0;n<30&&state.boss.hp===20;n++){const next=players.advancePlayer(p,players.REST_INPUT,16);state=step(state,16,p,next);p=next;}
    assert.equal(state.boss.hp,19,id+' receives actual sword damage');
    assert.equal(state.boss.hitFlashMs,220,id+' starts visual feedback on that impact');
    assert.equal(state.boss.hitSerial,1,id+' increments its feedback serial once');
    const frozen=step(state,0,p,p);assert.equal(frozen,state,'Paused simulation freezes flash too');
    const next=players.advancePlayer(p,players.REST_INPUT,16);state=step(state,16,p,next);
    assert.equal(state.boss.hp,19,id+' rejects duplicate damage from the same attack');
    assert.equal(state.boss.hitSerial,1);assert.equal(state.boss.hitFlashMs,204,id+' decays instead of retriggering every frame');
  }
  let blocked=fixture('shielder');
  Object.assign(blocked.boss,{x:origin.x+60,y:origin.y,facingX:-1,phase:'warning',phaseMs:0,hitFlashMs:0,hitSerial:0,lastHitSerial:-1});
  blocked.bossActionUntilMs=1e9;
  const hp=blocked.boss.hp;let p=players.beginAttack({...origin,comboMs:0,attackSerial:blocked.lastAttackSerial+1});
  for(let n=0;n<30;n++){const next=players.advancePlayer(p,players.REST_INPUT,16);blocked=step(blocked,16,p,next);p=next;}
  assert.equal(blocked.boss.hp,hp,'Shielded front strikes do not reduce HP');
  assert.equal(blocked.boss.hitSerial,0);assert.equal(blocked.boss.hitFlashMs,0,'Rejected damage never flashes');
});

if(failures.length) {console.error('\nBoss mechanics failures:\n'+failures.join('\n'));process.exitCode=1;}
else console.log(`Boss mechanics passed: ${cases} functional scenarios and ${simulated} simulation frames, native worklet entry, all three modes. Simulation only.`);
