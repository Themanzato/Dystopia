/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);
 const code=/\/(survival|purgatorio|bossBalance)\.ts$/.test(file.replaceAll('\\','/'))?babel.transformSync(fs.readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module:m,exports:m.exports,global:{Error},require:id=>{assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return target.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return m.exports;
}
function isolated(fn,...args){assert(fn.__initData?.code);return vm.runInNewContext('('+fn.__initData.code+')',{}).apply({__closure:fn.__closure},args);}
const api=load('src/game/survival.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts'),collision=load('src/game/collision.ts');
const {RANGED_PHASE_BALANCE:C,rangedPreparation}=load('src/game/bossBalance.ts'),{bossAttack}=load('src/game/bossAttacks.ts'),{bossFrame}=load('src/game/survivalAssets.ts');
const {ENEMY_DEFS}=load('src/game/enemyCatalog.ts');
let origin;
for(let y=950;!origin&&y<=1900;y+=24)for(let x=900;!origin&&x<=2000;x+=24){let clear=collision.isWalkable(x,y);for(let r=8;clear&&r<=150;r+=8)for(let i=0;i<32;i++)if(!collision.isWalkable(x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r)){clear=false;break;}if(clear)origin={...players.createPlayer(),x,y};}
assert(origin);const field=nav.buildFlowField(origin),view={left:origin.x-450,right:origin.x+450,top:origin.y-230,bottom:origin.y+230};
let frames=0;
function step(s,dt=16,before=origin,after=before,v=view){frames++;return isolated(api.advanceSurvival,s,before,after,field,dt,v);}
function start(id,mode='easy'){
 let s=api.createSurvival(71,mode,{mode:'purgatorio',encounter:id});s.invulnerableMs=1e9;
 for(let n=0;n<300&&(!s.boss||s.presentation);n++)s=step(s,40);
 assert(s.boss&&!s.presentation);if(id==='archer-bandit'){s.boss=s.partner;s.partner=null;}assert.equal(s.boss.id,id);s.world.reinforcementMs=1e9;s.encounter.enemies=s.encounter.enemies.map(n=>({...n,active:false}));s.minibosses=[];
 s.boss={...s.boss,x:origin.x+115,y:origin.y,phase:'recover',phaseMs:0,animationMs:0,attackIndex:0,attackRate:1};s.bossActionUntilMs=1e9;return s;
}
function request(s,index){s.boss.pattern=index;s.boss.phaseMs=10000;s.bossActionUntilMs=0;return step(s);}
function until(s,predicate,max=1200,p=origin){for(let n=0;n<max&&!predicate(s);n++)s=step(s,16,p);assert(predicate(s),'Simulation reached requested animation state');return s;}
for(const mode of ['easy','hard','dystopia'])for(const id of ['evil-sage','archer']){
 let high=start(id,mode),low=start(id,mode);low.boss.hp=low.boss.maxHp/2;
 const a=high.boss.x,b=low.boss.x;high=step(high);low=step(low);
 assert(low.boss.x-b>high.boss.x-a,id+' really moves faster at the inclusive half-health threshold');assert.equal(low.boss.powerPhase,1);assert.equal(low.events.bossPhase,1);assert(low.phaseFlashMs>0);
 low.boss.hp=low.boss.maxHp;for(let n=0;n<10;n++)low=step(low);assert.equal(low.boss.powerPhase,1);assert.equal(low.events.bossPhase,1,'Healing never repeats the phase signal');
 assert.equal(step(low,0),low);const paused={...low,mode:'upgrade'};assert.equal(step(paused),paused);
}
for(const mode of ['easy','hard','dystopia']){
 let s=start('evil-sage',mode);s.boss.hp=s.boss.maxHp/2;s=request(s,1);
 assert.equal(s.boss.phase,'warning');assert.equal(s.boss.attackIndex,1);
 const move=bossAttack('evil-sage',1),rate=s.boss.attackRate;
 assert.equal(s.boss.preparationMs,isolated(rangedPreparation,'evil-sage',true,move,rate));
 assert(Math.abs(s.boss.preparationMs-Math.max(C.sage.minWarningMs,move.warningMs/rate*.75))<1e-9);
 const seen=new Map(),impacts=new Map(),attackFrames=new Map();let p=origin;
 for(let n=0;n<1300;n++){
  for(const h of s.hazards.filter(h=>h.owner===s.boss.entityId&&h.kind==='blast')){
   if(!seen.has(h.id)){seen.set(h.id,{x:h.x,y:h.y,at:s.clockMs,warning:h.warningMs});assert(!h.followMs,'Each powered explosion has a locked target');}
   const locked=seen.get(h.id);assert.equal(h.x,locked.x);assert.equal(h.y,locked.y);
   if(h.ageMs>=h.warningMs&&!impacts.has(h.id))impacts.set(h.id,s.clockMs);
  }
  if(s.boss.phase==='attack'){const index=s.boss.sageBurstIndex??0;const frame=bossFrame(s.boss).source.x/52;if(!attackFrames.has(index))attackFrames.set(index,new Set());attackFrames.get(index).add(frame);}
  if(s.boss.phase==='recover')break;
  const before=p;p={...origin,y:origin.y+Math.min(90,n*.28)};s=step(s,16,before,p);
 }
 assert.equal(s.boss.phase,'recover');assert.equal(seen.size,C.sage[mode].explosions);assert.equal(impacts.size,seen.size);
 const blasts=[...seen.values()],times=[...impacts.values()];for(let n=1;n<blasts.length;n++){for(let j=0;j<n;j++)assert(Math.hypot(blasts[n].x-blasts[j].x,blasts[n].y-blasts[j].y)>=C.sage.blastSpacing-1e-6);assert(times[n]-times[n-1]>C.sage.minWarningMs);}
 for(const set of attackFrames.values())assert(set.has(13),'Each full original attack reaches its final frame');
 assert.equal(s.boss.hp,s.boss.maxHp/2,'Sage never damages itself');
 const doomed={...s,mode:'dead',hp:0,ending:undefined};const stopped=step(doomed);assert.equal(stopped.clockMs,doomed.clockMs);
}
// Crossing the threshold during a charge cannot shorten that action mid-clip.
let locked=request(start('evil-sage'),1),oldWarning=locked.boss.preparationMs;locked.boss.hp=locked.boss.maxHp/2;locked=step(locked);assert.equal(locked.boss.preparationMs,oldWarning);
for(const mode of ['easy','hard','dystopia']){
 const data={};
 for(const powered of [false,true]){
  let s=start('archer',mode);if(powered)s.boss.hp=s.boss.maxHp/2;
  s.boss.teleportCooldownMs=1e9;s=request(s,0);const rate=s.boss.attackRate,warn=s.boss.preparationMs;
  assert(warn>= (powered?C.archer.minWarningMs:550));s=until(s,q=>q.boss.phase==='attack');
  const beam=s.hazards.find(h=>h.kind==='beam');assert(beam);data[powered?'low':'high']={rate,warn,speed:beam.travelSpeed};
  const startX=s.boss.x,startY=s.boss.y;let full=false;
  for(let n=0;n<200&&s.boss.phase==='attack';n++){
   s=step(s);const h=s.hazards.find(h=>h.kind==='beam');if(h){assert(h.length<=h.maxLength);if(h.length===h.maxLength)full=true;assert(Math.abs(h.x-s.boss.x-Math.cos(h.angle)*28)<1e-8);}
  }
  assert(full,'The original continuous laser still crosses its complete range');assert.equal(s.boss.phase,'recover');assert(Math.hypot(s.boss.x-startX,s.boss.y-startY)<22,'Only the authored laser root changes its world anchor');
 }
 assert(data.low.rate>data.high.rate);assert(data.low.speed>data.high.speed);assert(data.low.warn<data.high.warn);
 let tele=start('archer',mode);tele.boss.hp=tele.boss.maxHp/2;tele.boss.teleportCooldownMs=0;tele=request(tele,0);assert.equal(tele.boss.attackIndex,1);
 const target={x:tele.boss.targetX,y:tele.boss.targetY};assert(collision.isWalkable(target.x,target.y));assert(Math.hypot(target.x-origin.x,target.y-origin.y)>=150);
 assert(target.x>=view.left+35&&target.x<=view.right-35&&target.y>=view.top+75&&target.y<=view.bottom-20);
 tele=until(tele,q=>q.boss.moveDone===true);assert.equal(tele.boss.x,target.x);assert.equal(tele.boss.y,target.y);assert(tele.boss.teleportCooldownMs<=C.archer[mode].teleportMs);
 tele=until(tele,q=>q.boss.phase==='recover');assert.equal(tele.boss.x,target.x);assert.equal(tele.boss.y,target.y,'The next clip keeps the teleport exit anchor');
}
// Arrival reuses the existing disappearance cells in reverse, ending on its
// original body pivot before the next locomotion clip, never on an empty tail.
const visuals=load('src/game/enemyAnimations.ts').ENEMY_VISUALS.archer;
const teleMove=bossAttack('archer',1);
for(let frame=0;frame<11;frame++){
 const a=bossFrame({id:'archer',phase:'attack',phaseMs:(frame+.1)/11*500,animationMs:0,attackIndex:1,attackRate:1});
 const b=bossFrame({id:'archer',phase:'attack',phaseMs:500+(frame+.1)/11*500,animationMs:0,attackIndex:1,attackRate:1});
 assert.equal(a.source.y,frame*25);assert.equal(b.source.y,(10-frame)*25);assert.equal(b.pivotX,visuals.idle.pivotX);assert.equal(b.pivotY,visuals.idle.pivotY);
}
assert.equal(teleMove.split,.5);
const cadence=[];
for(const mode of ['easy','hard','dystopia']){
 const counts=[];
 for(const powered of [false,true]){
  let s=start('archer',mode);if(powered)s.boss.hp=s.boss.maxHp/2;s.boss.teleportCooldownMs=0;s.bossActionUntilMs=0;let lasers=0,warps=0;
  for(let n=0;n<1500;n++){
   const oldPhase=s.boss.phase;s=step(s,40);
   if(oldPhase==='recover'&&s.boss.phase==='warning'){if(s.boss.attackIndex===0)lasers++;else warps++;}
  }
  counts.push({lasers,warps});
 }
 assert(counts[1].warps>counts[0].warps);cadence.push({mode,normal:counts[0],powered:counts[1]});
}
assert(cadence.every(c=>c.powered.lasers>c.normal.lasers),'The complete powered cycle, including teleports, must increase shot frequency: '+JSON.stringify(cadence));
for(const id of ['evil-sage','archer']){
 let dying=start(id,'dystopia');dying.boss.hp=1;dying.boss.teleportCooldownMs=1e9;dying=request(dying,id==='evil-sage'?1:0);
 if(id==='evil-sage')assert.equal(dying.boss.sageBurstsLeft,2);
 dying.boss={...dying.boss,x:origin.x+60,y:origin.y,facingX:1};
 const before={...origin,action:'attack',actionMs:65,attackIndex:0,attackSerial:999},after={...before,actionMs:105};
 dying=step(dying,40,before,after);assert.equal(dying.boss.hp,0);assert.equal(dying.hazards.length,0);
 const attacks=dying.events.bossAttack;for(let n=0;n<250;n++)dying=step(dying,40);assert.equal(dying.events.bossAttack,attacks);assert.equal(dying.hazards.length,0,'A real lethal sword cancels every remaining charge/beam/burst');
}
// Shared names/assets never opt Archer Bandit into Archer phase modifiers.
let bandit=start('archer-bandit');bandit.boss.hp=bandit.boss.maxHp/2;bandit=step(bandit);assert.equal(bandit.boss.powerPhase,0);assert.equal(bandit.events.bossPhase,0);
console.log('Ranged phases passed: inclusive/one-time thresholds in all3 modes, real retreat gains, 1/2/3 sequential locked and spaced Sage impacts/full clips, locked in-flight charge duration, Archer speed/rate/propagation and full map laser, visible safe teleport/final anchor, pause/terminal guards and Archer Bandit isolation; '+frames+' serialized frames. Cadence='+JSON.stringify(cadence));
