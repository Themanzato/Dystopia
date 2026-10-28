/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.join(root,relative);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 const source=fs.readFileSync(file,'utf8');const code=/[\\/](survival|worldEvents|frenesis|player|combat)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module:m,exports:m.exports,require:id=>{assert(id.startsWith('.'));const p=path.resolve(path.dirname(file),id);return id.endsWith('.png')?p:load(path.relative(root,p+'.ts'));}},{filename:file});return m.exports;}

const api=load('src/game/survival.ts'), f=load('src/game/frenesis.ts'), p=load('src/game/player.ts'), n=load('src/game/npc.ts'), nav=load('src/game/navigation.ts'), combat=load('src/game/combat.ts'),collision=load('src/game/collision.ts');
const {REWARD_SITES}=load('src/game/worldEventSites.ts'), {FRENESIS:C}=f, site=REWARD_SITES[0], hero={...p.createPlayer(),x:site.x,y:site.y}, field=nav.buildFlowField(hero);
function scene(){const s=api.createSurvival();s.encounter={...s.encounter,wave:2,phase:'spawning',remaining:1,spawnMs:1e9};s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=2;s.world.reinforcementMs=1e9;s.invulnerableMs=1e9;return s;}
const step=(s,b=hero,a=b,dt=40)=>api.advanceSurvival(s,b,a,field,dt);
const ready=()=>({...scene(),frenesis:{...f.createFrenesis(),charge:100}});
const active=()=>api.activateFrenesis(ready());
const npc=(id=1,x=hero.x+30,y=hero.y)=>({...n.emptyNpc(),id,x,y,active:true,action:'move',kind:'ghoul',facingX:1});
const tapPlayer=base=>f.releaseFrenesisAttack(p.requestAttack(base));
function heldPlayer(base,dt=8){let player=p.requestAttack(base);for(let n=0;n<100&&player.frenesisAttack!=='slices';n++)player=p.advancePlayer(player,p.REST_INPUT,dt);assert.equal(player.frenesisAttack,'slices');return player;}
let cases=0;function test(name,fn){fn();cases++;console.log('PASS '+name)}
test('Only real damage and accepted deaths charge, slowly and with a finite boss budget',()=>{
 let a=f.createFrenesis();assert.equal(f.chargeFrenesis(a,0,true),a);a=f.chargeFrenesis(a,1,true);assert.equal(a.charge,1.5);
 assert(f.chargeFrenesis(f.createFrenesis(),1e9,false,true).charge<=1);
 for(let i=0;i<1000;i++)a=f.chargeFrenesis(a,100,false,true);assert.equal(a.bossCharge,25);assert.equal(a.charge,26.5);
 for(let i=0;i<100;i++)a=f.chargeFrenesis(a,1,true);assert.equal(a.charge,100);
 let s=scene();s.xp=10;s.orbs=[{id:1,x:hero.x,y:hero.y,value:80,lifeMs:2000}];s=step(s);assert(s.level>1);assert.equal(s.frenesis.charge,0);
});
test('One-hit NPC death and actual boss HP loss award once; shields and overkill do not award',()=>{
 const b={...hero,action:'attack',actionMs:60,attackSerial:1,attackIndex:0},a={...b,actionMs:100};let s=scene();s.encounter.enemies[0]=npc();s=step(s,b,a);assert.equal(s.events.kill,1);assert.equal(s.frenesis.charge,1.5);s=step(s,b,a);assert.equal(s.events.kill,1);assert.equal(s.frenesis.charge,1.5);
 const boss={id:'shielder',name:'Shielder',entityId:800,x:hero.x+30,y:hero.y,hp:10,maxHp:10,phase:'recover',phaseMs:0,animationMs:0,pattern:0,lastHitSerial:-1,facingX:-1,aimAngle:0,summonMs:0};
 s=scene();s.boss=boss;s=step(s,b,a);assert.equal(s.boss.hp,10);assert.equal(s.frenesis.charge,0);
 s=scene();s.boss={...boss,facingX:1,hp:0.5};s=step(s,b,a);assert.equal(s.boss.hp,0);assert.equal(s.frenesis.charge,0.5*C.bossDamageCharge);s=step(s,b,a);assert.equal(s.frenesis.charge,0.5*C.bossDamageCharge);
});
test('Activation gates and the fifteen second lifetime, speed restore and no stacking',()=>{
 const s=scene();assert.equal(api.activateFrenesis(s),s);let a=active();assert(a.frenesis.active);assert.equal(api.activateFrenesis(a),a);assert.equal(a.frenesis.charge,0);
 for(const mode of ['upgrade','dead','won']){const q=ready();q.mode=mode;assert.equal(api.activateFrenesis(q),q)}
 const q=ready();q.presentation={entityId:1,elapsedMs:0,durationMs:1000};assert.equal(api.activateFrenesis(q),q);
 let player=api.applyPlayerUpgrades(hero,a);assert.equal(player.speedMultiplier,C.moveMultiplier);assert.equal(player.attackSpeedMultiplier,C.attackMultiplier);assert.equal(api.applyPlayerUpgrades(player,a).speedMultiplier,C.moveMultiplier);
 for(let i=0;i<374;i++)a=step(a);assert(a.frenesis.active);a=step(a);assert(!a.frenesis.active);assert.equal(a.hp,5);player=api.applyPlayerUpgrades({...player,attackHeld:true,action:'attack'},a);assert(!player.frenesis&&!player.attackHeld);assert.equal(player.action,'idle');assert.equal(player.speedMultiplier,1);
});
test('Temporary HP absorbs overflow without touching normal HP, uses iframes and ends immediately',()=>{
 let s=active();s.invulnerableMs=0;s.frenesis.hp=1;s.world.pendingCaptureDamage={id:1,amount:2};s=step(s);assert.equal(s.hp,5);assert(!s.frenesis.active);assert.equal(s.events.damage,1);assert(s.invulnerableMs>0);
 s=step(s);assert.equal(s.events.damage,1);assert.equal(s.hp,5);
 s=active();s.invulnerableMs=0;s.encounter.enemies[0]=npc(2,hero.x+3);s=step(s);assert.equal(s.frenesis.hp,4);assert.equal(s.hp,5);assert(s.frenesis.active);
});
test('Teleport uses exact rendered camera coordinates, solid rejection and exactly 3000ms cooldown',()=>{
 for(const v of [{tx:-100,ty:-300,scale:1.5},{tx:400,ty:80,scale:0.75}]){const point=f.screenToFrenesisWorld(hero.x*v.scale+v.tx,hero.y*v.scale+v.ty,v.tx,v.ty,v.scale);assert(Math.abs(point.x-hero.x)<1e-7);assert(Math.abs(point.y-hero.y)<1e-7)}
 let state=active().frenesis;assert.equal(f.teleportFrenesis(state,hero,-1,100,true).frenesis,state);assert.equal(f.teleportFrenesis(state,hero,hero.x,hero.y,false).frenesis,state);
 const building=load('src/game/map.ts').PROPS.find(b=>b.footprint);const box=building.footprint;assert(!collision.isWalkable(box.x+box.width/2,box.y+box.height/2));assert.equal(f.teleportFrenesis(state,hero,box.x+box.width/2,box.y+box.height/2,true).frenesis,state);
 let result=f.teleportFrenesis(state,hero,hero.x+10,hero.y,true);assert.equal(result.player.x,hero.x+10);assert.equal(result.frenesis.teleportMs,3000);state=f.advanceFrenesis(result.frenesis,2999);assert.equal(state.teleportMs,1);assert.equal(f.teleportFrenesis(state,hero,hero.x,hero.y,true).frenesis,state);state=f.advanceFrenesis(state,1);assert.equal(f.teleportFrenesis(state,hero,hero.x,hero.y,true).frenesis.teleportMs,3000);
});
test('Held spin moves, hits once per interval, stops on release, and cannot cross solids',()=>{
 let s=active(),b=heldPlayer(api.applyPlayerUpgrades(hero,s)),hits=0;const target=npc();let last=-1;
 for(let i=0;i<25;i++){const a=p.advancePlayer(b,{x:1,y:0,strength:0.3},40);const hit=combat.swordHitsNpc(b,a,{...target,x:a.x+30,lastHitSerial:last});if(hit){hits++;last=a.attackSerial;assert(!combat.swordHitsNpc(b,a,{...target,x:a.x+30,lastHitSerial:last}))}b=a}
 assert(b.x>hero.x);assert(hits>=2&&hits<=4,`${hits} bounded pulses`);const stopped=f.stopFrenesisSpin(b);assert(!stopped.attackHeld&&!stopped.spinStrike);assert(!combat.swordHitsNpc(stopped,stopped,target));
 const wall=load('src/game/map.ts').PROPS.find(b=>b.footprint).footprint;const bad={...b,x:wall.x-15,y:wall.y+wall.height/2,spinStrike:true,attackHeld:true,action:'attack'};assert(!combat.swordHitsNpc(bad,bad,{...target,x:wall.x+wall.width/2,y:bad.y,lastHitSerial:-1}));
});
test('Repeated taps and duplicate begins cannot bypass the spin cooldown',()=>{
 let b=api.applyPlayerUpgrades(hero,active()),hits=0;
 for(let i=0;i<50;i++){b=tapPlayer(b);const a=p.advancePlayer(b,p.REST_INPUT,20);if(a.spinStrike)hits++;b=f.releaseFrenesisAttack(a)}
 assert(hits>=2&&hits<=5,`${hits} hits in one second despite fifty taps`);
});
test('Pause, terminal cleanup and expiry cannot leave damage or teleport effects active',()=>{
 let s=active();s.frenesis=f.teleportFrenesis(s.frenesis,hero,hero.x+5,hero.y,true).frenesis;s.mode='upgrade';const json=JSON.stringify(s);assert.equal(step(s),s);assert.equal(JSON.stringify(s),json);
 for(const mode of ['dead','won']){let q={...s,mode};q=step(q);assert(!q.frenesis.active);assert.equal(q.frenesis.teleport,null)}
 s=active();s.frenesis.remainingMs=10;s.encounter.enemies[0]=npc();const player={...api.applyPlayerUpgrades(hero,s),action:'attack',attackHeld:true,spinStrike:true,attackSerial:50};s=step(s,player,player);assert.equal(s.events.kill,0);assert(!s.frenesis.active);
 s=active();s.encounter.enemies[0]=npc();let b=p.beginAttack(api.applyPlayerUpgrades(hero,s)),a=p.advancePlayer(b,p.REST_INPUT,40);while(!a.spinStrike){b=a;a=p.advancePlayer(b,p.REST_INPUT,40)}s=step(s,b,a);assert.equal(s.events.kill,1);assert.equal(s.frenesis.charge,0);
});

const art=load('src/game/frenesisAssets.ts');
for(let i=0;i<art.FRENESIS_SOURCES.length;i++){
 const bytes=fs.readFileSync(art.FRENESIS_SOURCES[i]);assert.equal(bytes.readUInt32BE(16),art.FRENESIS_CLIPS[i].frames*140);assert.equal(bytes.readUInt32BE(20),46);assert.equal(bytes[25],6,'Original RGBA transparency preserved');
}
for(const action of ['idle','walk','run','attack','dash'])for(let ms=0;ms<16000;ms+=17){const frame=art.frenesisFrame({...hero,action,actionMs:ms,spinMs:ms%240,attackSpeedMultiplier:1.5});assert(frame.source.x>=0&&frame.source.x+140<=art.FRENESIS_CLIPS[frame.image].frames*140);assert.equal(frame.source.height,46)}
console.log('Frenesis art passed: eight real RGBA strips, exact 140x46 cells and all idle/run/spin/dash crops inside original frame bounds.');

test('Exclusive Slash 1 then Slash 2 completes all original cells on taps, hold, movement and release',()=>{
 for(const speed of [1,1.5,2.22])for(const held of [false]){
  let b=tapPlayer({...api.applyPlayerUpgrades(hero,active()),attackSpeedMultiplier:speed});
  let seen=[],serial=b.attackSerial,cycles=0,hits=0;
  for(let i=0;i<750;i++){
   if(b.action==='attack'){
    const frame=art.frenesisFrame(b),key=frame.image+':'+frame.source.x/140;
    assert([2,3].includes(frame.image),'Only one slash body is drawn, never run/idle/spin');
    if(seen.at(-1)!==key)seen.push(key);
    const duplicate=p.beginAttack(b);assert.equal(duplicate.actionMs,b.actionMs);assert.equal(duplicate.frenesisAttack,b.frenesisAttack);assert.equal(duplicate.attackSerial,b.attackSerial);
   }
   const a=p.advancePlayer(b,{x:1,y:0,strength:.1},8);if(a.spinStrike)hits++;
   if(a.attackSerial!==serial||a.action!=='attack'){
    assert.deepEqual(seen,[...Array.from({length:7},(_,i)=>'2:'+i),...Array.from({length:5},(_,i)=>'3:'+i)],'All twelve cells appear in order before another action');
    assert.equal(hits,1,'One real area hit per complete sequence, not an extra hit for each visual slash');
    cycles++;seen=[];hits=0;serial=a.attackSerial;if(!held){assert.equal(a.action,'walk');assert(a.x>hero.x);break;}
   }
   b=a;if(cycles===4)break;
  }
  assert.equal(cycles,held?4:1);
 }
});
test('A held touch draws only main Glitch Slices after180ms, with complete cycles and controlled damage',()=>{
 for(const speed of [1,1.5,2.22]){
  let b=p.requestAttack({...api.applyPlayerUpgrades(hero,active()),attackSpeedMultiplier:speed});
  for(let ms=0;ms<176;ms+=8){assert.notEqual(b.action,'attack');b=p.advancePlayer(b,p.REST_INPUT,8);}assert(b.attackHeld);
  b=p.advancePlayer(b,p.REST_INPUT,8);assert.equal(b.frenesisAttack,'slices');
  let seen=new Set([art.frenesisFrame(b).source.x/140]),serial=b.attackSerial,cycles=0;
  for(let i=0;i<600&&cycles<4;i++){
   assert.equal(p.requestAttack(b),b);assert.equal(art.frenesisFrame(b).image,6,'No idle/slash body or FX overlay during the spin');
   const a=p.advancePlayer(b,{x:1,y:0,strength:.1},8);
   if(a.attackSerial!==serial){assert.deepEqual([...seen].sort((a,b)=>a-b),Array.from({length:11},(_,i)=>i));seen.clear();serial=a.attackSerial;cycles++;}
   seen.add(art.frenesisFrame(a).source.x/140);b=a;
  }
  assert.equal(cycles,4);b=f.releaseFrenesisAttack(b);const last=b.attackSerial;
  while(b.action==='attack'){assert.equal(art.frenesisFrame(b).image,6);b=p.advancePlayer(b,p.REST_INPUT,8);}assert.equal(b.attackSerial,last);
 }
});
test('Normal aim mirrors immediately, actual hits face eight directions, and all Frenesis range is exactly +20%',()=>{
 const base=api.applyPlayerUpgrades(hero,active());assert.equal(C.rangeMultiplier,1.2);
 let b=tapPlayer({...base,facingX:-1,aimX:1,aimY:0});assert.equal(b.facingX,1);
 let a=p.advancePlayer(b,{x:-1,y:0,strength:.1},40);assert.equal(a.facingX,-1);assert.equal(a.aimX,-1);assert.equal(art.frenesisFrame(a).image,2);
 for(let i=0;i<8;i++){
  const x=Math.cos(i*Math.PI/4),y=Math.sin(i*Math.PI/4),hit={...base,aimX:x,aimY:y,action:'attack',frenesisAttack:'slash1',spinStrike:true,attackSerial:50};
  assert(combat.swordHitsNpc(hit,hit,npc(1,hit.x+x*95,hit.y+y*95)),'New reach includes a target beyond the previous82');
  assert(!combat.swordHitsNpc(hit,hit,npc(1,hit.x+x*99,hit.y+y*99)),'No range beyond98.4');
  assert(!combat.swordHitsNpc(hit,hit,npc(1,hit.x-x*95,hit.y-y*95)),'Normal slash cannot hit behind its facing');
  assert(combat.swordHitsNpc(hit,{...hit,frenesisAttack:'slices'},npc(1,hit.x-x*95,hit.y-y*95)),'Spin remains radial');
 }
});
test('Pending touch cancelled by pause/stun never starts a phantom tap',()=>{
 const pending=p.requestAttack(api.applyPlayerUpgrades(hero,active()));const paused=f.suspendFrenesisAttack(pending);
 assert(!paused.attackHeld&&!paused.attackPending);assert.equal(f.releaseFrenesisAttack(paused).action,'idle');
 const stunned={...pending,stunMs:400};assert.notEqual(f.releaseFrenesisAttack(stunned).action,'attack');
 let b=tapPlayer(api.applyPlayerUpgrades(hero,active()));b=p.requestAttack(b);for(let i=0;i<100&&b.frenesisAttack!=='slices';i++)b=p.advancePlayer(b,p.REST_INPUT,8);assert.equal(b.frenesisAttack,'slices','A fresh hold waits for the existing normal sequence');
});
test('Pause preserves either slash, stun cancels once, and the existing cooldown gates a full new sequence',()=>{
 for(const phase of ['slash1','slash2']){
  let b=p.beginAttack(api.applyPlayerUpgrades(hero,active()));while(b.frenesisAttack!==phase)b=p.advancePlayer(b,p.REST_INPUT,8);
  b=p.advancePlayer(b,p.REST_INPUT,24);const suspended=f.suspendFrenesisAttack(b);assert.equal(suspended.actionMs,b.actionMs);assert.equal(suspended.frenesisAttack,phase);assert(!suspended.attackHeld&&!suspended.spinStrike);
  assert.deepEqual(art.frenesisFrame(suspended),art.frenesisFrame(b));assert.equal(p.advancePlayer(suspended,p.REST_INPUT,0),suspended);
  let next=suspended;for(let i=0;i<150&&next.action==='attack';i++)next=p.advancePlayer(next,p.REST_INPUT,8);assert.equal(next.action,'idle');assert.equal(next.attackSerial,b.attackSerial);
  const stunned=p.advancePlayer({...b,stunMs:500},p.REST_INPUT,16);assert.equal(stunned.action,'idle');assert(!stunned.attackHeld&&!stunned.spinStrike);assert.equal(stunned.frenesisAttack,undefined);
 }
 let b=p.beginAttack({...api.applyPlayerUpgrades(hero,active()),spinCooldownMs:100});assert.notEqual(b.action,'attack');b=f.releaseFrenesisAttack(b);b=p.advancePlayer(b,p.REST_INPUT,40);assert.notEqual(b.action,'attack');
});
test('Base attacks keep the last authored frame, reject restart, and yield only to dash/death priorities',()=>{
 for(const speed of [1,1.48,2.22])for(let index=0;index<4;index++){
  let b=p.beginAttack({...hero,comboMs:1,nextAttack:index,attackSpeedMultiplier:speed});const serial=b.attackSerial,frames=p.PLAYER_ANIMATIONS.attack[index].frames;
  const seen=new Set();for(let i=0;i<400&&b.action==='attack';i++){assert.equal(p.beginAttack(b),b);seen.add(p.playerFrame(b).x/90);b=p.advancePlayer(b,p.REST_INPUT,8);}
  assert.equal(b.action,'idle');assert.equal(b.attackSerial,serial);assert.equal(seen.size,frames);assert(seen.has(frames-1));
 }
 let b=p.beginAttack(hero);b=p.beginDash(b,{x:1,y:0,strength:1});assert.equal(b.action,'dash');assert(!combat.swordHitsNpc(b,b,npc()));
 b={...b,action:'death',attackHeld:false,spinStrike:false};assert.equal(p.beginAttack(b),b);assert.equal(p.beginDash(b,p.REST_INPUT),b);
});
test('Blink dash uses monotonic visual travel, both real clips, protection and exact final feet',()=>{
 const start=active(),dest={x:hero.x+30,y:hero.y};const result=f.teleportFrenesis(start.frenesis,api.applyPlayerUpgrades(hero,start),dest.x,dest.y,true);let fs=result.frenesis;assert(result.player.frenesisBlink);
 assert.equal(f.frenesisVisualPosition(result.player,fs).x,hero.x);assert.equal(art.frenesisFrame(result.player,fs).image,5);
 let previous=hero.x;for(let ms=0;ms<C.effectMs;ms+=10){const state={...fs,teleport:{...fs.teleport,elapsedMs:ms}};const v=f.frenesisVisualPosition(result.player,state);assert(v.x>=previous&&v.x<=dest.x);previous=v.x;const frame=art.frenesisFrame(result.player,state);assert([5,7].includes(frame.image));assert(frame.source.x>=0&&frame.source.x+140<=art.FRENESIS_CLIPS[frame.image].frames*140)}
 const stopped=p.advancePlayer(result.player,{x:1,y:0,strength:1},40);assert.equal(stopped.x,dest.x);assert.equal(p.beginAttack(stopped),stopped);assert.equal(p.beginDash(stopped,p.REST_INPUT),stopped);
 let s={...start,invulnerableMs:0,frenesis:fs};s.world.pendingCaptureDamage={id:1,amount:2};s=step(s);assert.equal(s.frenesis.hp,5);assert(s.world.pendingCaptureDamage,'Damage waits until the blink is visible');
 fs=f.advanceFrenesis(fs,C.effectMs);assert.equal(fs.teleport,null);assert.equal(f.frenesisVisualPosition(result.player,fs).x,dest.x);
});

console.log(`Frenesis passed: ${cases} native-transformed simulation scenarios; no physical-device measurements.`);
