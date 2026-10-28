/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module,exports:module.exports,require(id){assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return id.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return module.exports;
}
const game=load('src/game/survival.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts'),collision=load('src/game/collision.ts');
const {BOSS_ATTACKS}=load('src/game/bossAttacks.ts'),{BOSS_BALANCE}=load('src/game/bossBalance.ts'),{hazardDraws}=load('src/game/bossEffects.ts');
let hero;
for(let y=950;!hero&&y<1900;y+=24)for(let x=900;!hero&&x<2000;x+=24){let clear=collision.isWalkable(x,y);for(let r=8;clear&&r<=150;r+=8)for(let i=0;i<32;i++)if(!collision.isWalkable(x+Math.cos(i*Math.PI/16)*r,y+Math.sin(i*Math.PI/16)*r)){clear=false;break;}if(clear)hero={...players.createPlayer(),x,y};}
assert(hero);const field=nav.buildFlowField(hero);
const actor=(s,id)=>s.boss?.id===id?s.boss:s.partner;
function setActor(s,id,patch){const key=s.boss?.id===id?'boss':'partner';s[key]={...s[key],...patch};}
const step=(s,p=hero,dt=8)=>game.advanceSurvival(s,p,p,field,dt);
function begin(id,index,mode='easy',rage=false){let s=game.createSurvival(71,mode,{mode:'purgatorio',encounter:'dagger-bandit'});s.invulnerableMs=1e9;
 for(let n=0;n<500&&(!s.boss||s.presentation);n++)s=step(s,hero,40);
 assert(s.boss&&s.partner);s.encounter.enemies=s.encounter.enemies.map(n=>({...n,active:false}));s.encounter.remaining=0;s.world.reinforcementMs=1e9;s.hazards=[];s.bossActionUntilMs=0;
 for(const b of [s.boss,s.partner])setActor(s,b.id,{phase:'recover',phaseMs:-1e6,summonMs:0});
 setActor(s,id,{x:hero.x+120,y:hero.y,phase:'recover',phaseMs:10000,pattern:index,attackIndex:index,attackRootX:0,attackRate:1,siblingRage:rage,damage:rage?2:1});
 s=step(s);assert.equal(actor(s,id).phase,'warning');assert.equal(actor(s,id).attackIndex,index);return s;
}
let burrows=0,shots=0,dodges=0;
for(const id of ['dagger-bandit','archer-bandit']){
 assert.equal(BOSS_ATTACKS[id].length,id==='archer-bandit'?2:3);assert(BOSS_ATTACKS[id].every(m=>m.clip!=='roll'&&m.kind!=='evade'),'No spherical locomotion is selectable');
 for(const mode of ['easy','hard','dystopia']){
  let s=begin(id,BOSS_ATTACKS[id].findIndex(m=>m.kind==='burrow'),mode),p={...hero};const owner=actor(s,id).entityId,origin={x:actor(s,id).x,y:actor(s,id).y};
  const marker=()=>s.hazards.find(h=>h.owner===owner&&h.kind==='teleport');let h=marker();assert(h.followMs>0);assert(Math.abs(h.warningMs-h.followMs-BOSS_BALANCE.burrowLockMs)<1e-8);
  while(h.ageMs<h.followMs){p=players.advancePlayer(p,{x:1,y:0,strength:.3},8);s=step(s,p);h=marker();assert(h);if(h.ageMs<h.followMs)assert(Math.hypot(h.x-p.x,h.y-p.y)<1e-8);assert.equal(actor(s,id).x,origin.x,'No visible rolling/displacement before underground relocation');assert.equal(actor(s,id).y,origin.y);}
  const locked={x:h.x,y:h.y};let n=0;
  while(!actor(s,id).moveDone&&n++<200){p=players.advancePlayer(p,{x:1,y:0,strength:.3},8);s=step(s,p);h=marker();assert.equal(h.x,locked.x);assert.equal(h.y,locked.y);}
  assert(n<200);assert(Math.hypot(actor(s,id).x-locked.x,actor(s,id).y-locked.y)<1e-8,'The bandit exits exactly at the announced player position');
  assert(Math.hypot(p.x-locked.x,p.y-locked.y)>10&&Math.hypot(p.x-locked.x,p.y-locked.y)<80,'A brief committed exit permits an actual dodge without reverting to a far random spawn');
  let previousBody; const {bossFrame}=load('src/game/survivalAssets.ts');
  const rootX=id==='dagger-bandit'?75.5:69.5,nextRootX=id==='dagger-bandit'?43:36;
  while(actor(s,id).phase==='attack') {
    const b=actor(s,id),f=bossFrame(b),m=BOSS_ATTACKS[id][b.attackIndex];
    if(b.phaseMs*b.attackRate/m.durationMs>.99)previousBody=b.x+(rootX-f.pivotX)*f.scale*b.facingX;
    s=step(s,p);
  }
  const end=actor(s,id);assert(Math.hypot(end.x-origin.x,end.y-origin.y)>1,'Exit never restores takeoff position');
  assert(previousBody!==undefined);const first=bossFrame(end),nextBody=end.x+(nextRootX-first.pivotX)*first.scale*end.facingX;assert(Math.abs(nextBody-previousBody)<.01,'Next clip and hitbox preserve the final visible foot position');burrows++;
 }
 let s=begin(id,BOSS_ATTACKS[id].findIndex(m=>m.kind==='burrow'));for(let n=0;n<400&&!actor(s,id).moveDone;n++)s=step(s);assert(actor(s,id).moveDone);assert.equal(actor(s,id).x,hero.x);assert.equal(actor(s,id).y,hero.y,'Standing on the marker no longer cancels the requested exit');
}
for(const mode of ['easy','hard','dystopia']){
 let s=begin('archer-bandit',0,mode);s.invulnerableMs=0;const owner=actor(s,'archer-bandit').entityId;
 const h=s.hazards.find(h=>h.owner===owner&&h.kind==='volley');assert(h.launchMs>0);assert.equal(h.followMs,h.launchMs);
 assert(Math.abs(h.warningMs-h.launchMs-320)<1e-8,'Fall remains a short readable 320ms even in higher difficulty');
 assert.equal(hazardDraws({...h,ageMs:h.launchMs-1}).length,0,'No slow falling arrow during windup');
 const top=hazardDraws({...h,ageMs:h.launchMs})[0],half=hazardDraws({...h,ageMs:h.launchMs+160})[0];
 assert.equal(top.y,h.y-145);assert.equal(half.y,h.y-72.5,'The original falling sprite crosses half its height in 160ms');
 const hp=s.hp;let n=0;
 while(s.hp===hp&&n++<500){const active=s.hazards.find(x=>x.id===h.id);if(active&&active.ageMs+8<h.warningMs)assert.equal(s.hp,hp);s=step(s);}
 assert(n<500);assert.equal(s.hp,mode==='dystopia'?0:hp-1,'Actual impact removes life promptly after release');shots++;
 s=begin('archer-bandit',0,mode);s.invulnerableMs=0;let p={...hero};const first=s.hazards.find(h=>h.kind==='volley');
 while(s.hazards.find(h=>h.id===first.id).ageMs<first.launchMs)s=step(s,p);
 while(s.hazards.find(h=>h.id===first.id).ageMs<first.warningMs+16){p=players.advancePlayer(p,{x:1,y:0,strength:1},8);s=step(s,p);}
 assert.equal(s.hp,hp,'Walking after seeing the archer release is sufficient to evade the fixed landing marker');dodges++;
}
const enraged=begin('archer-bandit',0,'hard',true),triple=enraged.hazards.filter(h=>h.kind==='volley');assert.equal(triple.length,3);assert.equal(new Set(triple.map(h=>h.x+':'+h.y)).size,3);assert(triple.every(h=>h.warningMs-h.launchMs<=430&&h.damage===2));
console.log('Bandit refinements passed: 12 unique selectable encounters covered by roster tests; '+burrows+' tracked/locked burrows plus stationary exits; no rolling moves; '+shots+' real fast-arrow impacts and '+dodges+' post-shot walking dodges in all modes; separated enraged triple.');
