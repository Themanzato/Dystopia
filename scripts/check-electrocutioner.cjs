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
const { BOSS_BALANCE, BOSS_MODES } = load('src/game/bossBalance.ts');
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

const {PNG}=require('pngjs'),{ENEMY_VISUALS}=load('src/game/enemyAnimations.ts'),fx=load('src/game/bossEffects.ts');
const assets=path.join(project,'assets/assets/bosses/Electrocutioner');
test('Electrocutioner original strips, all 101 actor + 18 FX cells and stable pivots',()=>{
 for(const [file,frames,h]of [['Idle',12,107],['Attack',39,107],['Range Attack',16,107],['Teleport',12,107],['Appear',6,107],['Death',16,107]]){
  const im=PNG.sync.read(fs.readFileSync(path.join(assets,`Electricuitioner-${file}.png`)));assert.equal(im.width,157*frames);assert.equal(im.height,h);assert(im.width<=8192);
 }
 const im=PNG.sync.read(fs.readFileSync(path.join(assets,'Volley Projectile 157x122.png')));assert.equal(im.width,2826);assert.equal(im.height,122);
 for(const clip of Object.values(ENEMY_VISUALS.electrocutioner)){assert.equal(clip.pivotX,73);assert.equal(clip.pivotY,96);assert.equal(clip.x+clip.frames*157<=({33:1884,34:6123,35:2512,36:1884,37:942,38:2512})[clip.image],true);}
 for(let t=0;t<2200;t+=15){const draws=fx.hazardDraws({id:1,owner:1,kind:'blast',fx:'electroLightning',x:400,y:500,angle:0,radius:40,length:0,ageMs:t,launchMs:950,warningMs:1130,activeMs:900,damageMs:220,damage:1});for(const d of draws){const sheet=d.image===11?im:PNG.sync.read(fs.readFileSync(fx.BOSS_FX_ASSETS.electric));assert(d.source.x>=0&&d.source.x+d.source.width<=sheet.width);assert(d.source.y+d.source.height<=sheet.height);assert.equal(d.x,400);}}
});
test('Electrocutioner normal cast locks the initial player point and telegraphs before damage',()=>{
 let s=begin('electrocutioner');assert.equal(s.hazards.length,1);const h=s.hazards[0];assert.equal(h.x,origin.x);assert.equal(h.y,origin.y);assert.equal(h.followMs,undefined);assert.equal(s.events.electricCharge,1);
 assert(h.warningMs>=1000);assert(fx.hazardDraws(h).every(d=>d.image===0));s.invulnerableMs=0;
 while(s.hazards[0]?.ageMs+40<h.warningMs){s=step(s);assert.equal(s.hp,5);assert.equal(s.hazards[0].x,h.x);assert.equal(s.hazards[0].y,h.y);}
 s=until(s,s=>s.events.damage>0,80);assert.equal(s.hp,4);assert.equal(s.events.electricImpact,1);
 for(let i=0;i<15;i++)s=step(s);assert.equal(s.hp,4);assert.equal(s.events.electricImpact,1);
 const faded={...h,ageMs:h.warningMs+h.damageMs+1};assert(!fx.hazardIsActive(faded));assert(fx.hazardDraws(faded).length,'Remaining authored particles stay visual only');
 let dodged=begin('electrocutioner');dodged.invulnerableMs=0;const escaped={...origin,y:origin.y+140};
 for(let i=0;i<55;i++)dodged=step(dodged,40,escaped,escaped);assert.equal(dodged.hp,5,'Moving out of the fixed target avoids the bolt');
});
test('Electrocutioner exact inclusive phase thresholds signal once and increase real movement',()=>{
 let base=fixture('electrocutioner'),fast=copy(base);base.boss.x=origin.x+120;fast.boss.x=base.boss.x;fast.boss.hp=36;const x=base.boss.x;
 base=step(base);fast=step(fast);assert.equal(fast.boss.powerPhase,1);assert.equal(fast.events.bossPhase,base.events.bossPhase+1);assert(Math.abs(fast.boss.x-x)>Math.abs(base.boss.x-x)*1.8);
 const count=fast.events.bossPhase;fast.boss.hp=44;for(let i=0;i<10;i++)fast=step(fast);assert.equal(fast.boss.powerPhase,1);assert.equal(fast.events.bossPhase,count,'Healing never retriggers the previous transition');
 fast.boss.hp=18;fast=step(fast);assert.equal(fast.boss.powerPhase,2);assert.equal(fast.events.bossPhase,count+1);assert.equal(fast.boss.cloneMs,0);
 fast.boss.hp=30;fast=step(fast);assert.equal(fast.boss.powerPhase,2);assert.equal(fast.events.bossPhase,count+1);
});
for(const mode of ['easy','hard','dystopia'])test('Electrocutioner '+mode+' fair staggered lightning burst and fixed positions',()=>{
 let s=begin('electrocutioner',0,mode,{hp:Math.floor(54*2/3),powerPhase:1});
 const bolts=s.hazards.filter(h=>h.fx==='electroLightning');assert.equal(bolts.length,BOSS_BALANCE.electroBolts[mode]);
 assert(bolts.every(h=>h.damage===1&&!h.followMs&&h.warningMs>700));
 for(let i=1;i<bolts.length;i++){assert.equal(bolts[i].warningMs-bolts[i-1].warningMs,240);assert(Math.hypot(bolts[i].x-bolts[i-1].x,bolts[i].y-bolts[i-1].y)>2*(bolts[i].radius+9)+18);}
 const locked=bolts.map(h=>({x:h.x,y:h.y}));const moving={...origin,y:origin.y+125};
 for(let n=0;n<15;n++){s=step(s,40,moving,moving);s.hazards.forEach((h,i)=>{assert.equal(h.x,locked[i].x);assert.equal(h.y,locked[i].y);});}
});
test('Electrocutioner teleport relocates once while invisible and retains final feet through arrival/recovery',()=>{
 let s=begin('electrocutioner',2,'easy',{hp:36,powerPhase:1,teleportCooldownMs:0});const target={x:s.boss.targetX,y:s.boss.targetY},start={x:s.boss.x,y:s.boss.y};assert(Math.hypot(target.x-origin.x,target.y-origin.y)>=150);
 s=until(s,s=>s.boss.phase==='attack');while(!s.boss.moveDone){const prior=s.boss;s=step(s,16);if(!s.boss.moveDone){assert.equal(s.boss.x,start.x);assert.equal(s.boss.y,start.y);}else{assert(prior.phaseMs<780);}}
 assert.equal(s.boss.x,target.x);assert.equal(s.boss.y,target.y);assert.equal(bossFrame(s.boss).image,37,'Arrival uses the original Appear strip at the new world point');
 s=recover(s,16);assert.equal(s.boss.x,target.x);assert.equal(s.boss.y,target.y);assert(s.boss.teleportCooldownMs>7000);const f=bossFrame(s.boss);assert.equal(f.image,33);assert.equal(f.pivotX,73);assert.equal(f.pivotY,96);
});
function clonesFixture(mode='easy'){
 let s=fixture('electrocutioner',mode);s.boss.hp=Math.floor(s.boss.maxHp/3);s.boss.summonMs=-1e9;s.bossActionUntilMs=1e9;s=step(s);assert.equal(s.boss.powerPhase,2);return s;
}
for(const mode of ['easy','hard','dystopia'])test('Electrocutioner '+mode+' clones every exact6s, cap, one-hit death and no recursive/reward boss logic',()=>{
 let s=clonesFixture(mode);for(let i=0;i<149;i++)s=step(s);assert.equal(s.minibosses.length,0);assert.equal(s.boss.cloneMs,5960);
 s=step(s);assert.equal(s.minibosses.length,1);assert.equal(s.boss.cloneMs,0);const first=s.minibosses[0];assert.equal(first.hp,1);assert.equal(first.maxHp,1);assert.equal(first.cloneOf,s.boss.entityId);assert.equal(first.phase,'intro');assert.equal(bossFrame(first).image,37);
 const frozen=s;assert.equal(step(s,0),frozen);assert.equal(step({...s,mode:'upgrade'}).boss.cloneMs,0);
 const limit=BOSS_BALANCE.electroCloneLimit[mode];for(let i=0;i<(limit+1)*150;i++)s=step(s);assert.equal(s.minibosses.filter(b=>b.hp>0).length,limit);assert(s.minibosses.every(b=>b.cloneOf===s.boss.entityId&&b.powerPhase===0));
 const ids=s.minibosses.map(b=>b.entityId),target=s.minibosses[0];s.boss={...s.boss,x:origin.x+280,y:origin.y,cloneMs:0};s.minibosses=s.minibosses.map((b,i)=>i===0?{...b,x:origin.x+60,y:origin.y,phase:'warning',phaseMs:0,lastHitSerial:-1}:b);
 const before={...players.beginAttack(origin),actionMs:65},after=players.advancePlayer(before,players.REST_INPUT,5),orbs=s.orbs.length,chests=s.chests.length;
 s=step(s,5,before,after);assert.equal(s.minibosses.find(b=>b.entityId===target.entityId).phase,'death');assert.equal(s.stats.bossKills,0);assert.equal(s.stats.minibossKills,0);assert.equal(s.orbs.length,orbs);assert.equal(s.chests.length,chests);assert.equal(s.mode,'playing');assert.equal(s.purgatorio.cleared,0);
 for(let i=0;i<149;i++)s=step(s);assert(!s.minibosses.some(b=>!ids.includes(b.entityId)),'Freeing a slot does not trigger an accumulated spawn');s=step(s);assert(s.minibosses.some(b=>!ids.includes(b.entityId)));assert.equal(s.minibosses.filter(b=>b.hp>0).length,limit);
});
test('Electrocutioner clones chase and cast real electric damage but never take the principal HUD slot',()=>{
 let s=clonesFixture();s.boss.cloneMs=5960;s=step(s);let c=s.minibosses[0];s.minibosses=[{...c,x:origin.x+180,y:origin.y,phase:'recover',phaseMs:10000}];s.bossActionUntilMs=0;
 s=step(s);c=s.minibosses[0];assert.equal(c.phase,'warning');assert.equal(c.attackIndex,0);assert.equal(s.hazards.filter(h=>h.owner===c.entityId).length,1);assert.equal(s.boss.id,'electrocutioner');assert(s.boss.maxHp>1);assert.equal(c.maxHp,1);
 s.invulnerableMs=0;s=until(s,s=>s.events.damage>0,100);assert.equal(s.hp,4);assert(s.hazards.some(h=>h.owner===c.entityId));
});
test('Electrocutioner original death immediately clears clones and owned FX, awards exactly one boss',()=>{
 let s=clonesFixture();s.boss.cloneMs=5960;s=step(s);const clone=s.minibosses[0];s.invulnerableMs=0;s.boss={...s.boss,hp:1,x:origin.x+60,y:origin.y,phase:'warning',phaseMs:0};s.minibosses=[{...clone,x:origin.x,y:origin.y,phase:'recover'}];
 s.hazards=[{id:999,owner:clone.entityId,kind:'blast',fx:'electroLightning',x:origin.x,y:origin.y,angle:0,radius:40,length:0,ageMs:1200,warningMs:1100,activeMs:900,damage:1}];
 const before={...players.beginAttack(origin),actionMs:65},after=players.advancePlayer(before,players.REST_INPUT,5);s=step(s,5,before,after);
 assert.equal(s.hp,5,'A clone cannot land a final attack after its owner dies');assert.equal(s.minibosses.length,0);assert.equal(s.hazards.length,0);assert.equal(s.stats.bossKills,1);assert.equal(s.chests.length,1);assert.equal(s.mode,'won');assert.equal(s.boss.phase,'death');
 for(let i=0;i<150;i++)s=step(s);assert(s.ending.ready);assert.equal(s.stats.bossKills,1);assert.equal(s.minibosses.length,0);
 let dead=clonesFixture();dead.boss.cloneMs=5960;dead=step(dead);dead.hp=1;dead.invulnerableMs=0;dead.encounter.enemies[0]={...dead.encounter.enemies[0],id:9999,active:true,x:origin.x,y:origin.y,action:'move'};dead=step(dead);assert.equal(dead.mode,'dead');assert.equal(dead.minibosses.length,0);assert.equal(dead.hazards.length,0);
});
test('Electrocutioner powered repertoire includes storm, bolt and occasional teleport without unbounded hazards',()=>{
 let s=fixture('electrocutioner');s.boss.hp=36;s.boss.summonMs=-1e9;const seen=new Set();let max=0;
 for(let i=0;i<1500;i++){s=step(s);if(s.boss.phase==='attack')seen.add(s.boss.attackIndex);max=Math.max(max,s.hazards.length);}
 assert(seen.has(0)&&seen.has(1)&&seen.has(2));assert(max<12);assert(s.events.electricImpact>0);
});
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`Electrocutioner passed: ${cases} functional scenarios, ${simulated} native-transformed simulation frames, all modes, real attacks/HP/collision/rewards/cleanup. No hardware claim.`);

