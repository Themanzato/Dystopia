/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module,exports:module.exports,require(id){assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return id.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return module.exports;
}

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
let healthCases=0;
for(const mode of ['easy','hard','dystopia']){
 const s=start('rock-boss',mode),old=Math.ceil(ENEMY_DEFS['rock-boss'].hp*bossMode(mode).hp*purgatorioTuning(1,mode).hpMultiplier);
 assert.equal(s.boss.maxHp,old*.70*(mode==='easy'?.8:1)); assert.equal(s.boss.hp,s.boss.maxHp);healthCases++;
}
let s=game.createSurvival(1,'dystopia');
s.encounter.phase='spawning';s.encounter.remaining=1;s.encounter.spawnMs=1e8;
s.encounter.enemies[0]={...emptyNpc(),active:true,action:'move',x:hero.x,y:hero.y,id:1};
s=tick(s);assert.equal(s.hp,0);assert.equal(s.mode,'dead');assert.equal(s.ending.animationMs,600);assert(!s.ending.ready);
const deadClock=s.clockMs,damage=s.events.damage,events=JSON.stringify(s.events),wave=s.encounter.wave;
for(let n=0;n<64;n++)s=tick(s);assert(!s.ending.ready,'No menu before six death frames plus 2 seconds');
s=tick(s);assert.equal(s.ending.elapsedMs,2600);assert(s.ending.ready);assert.equal(s.clockMs,deadClock);assert.equal(s.events.damage,damage);assert.equal(JSON.stringify(s.events),events);assert.equal(s.encounter.wave,wave);
const corpse={...hero,action:'death',actionMs:600};assert.equal(players.beginAttack(corpse),corpse);assert.equal(players.beginDash(corpse,{x:1,y:0,strength:1}),corpse);assert.equal(players.advancePlayer(corpse,{x:1,y:0,strength:1},40).x,hero.x);assert.equal(players.playerFrame(corpse).x,450,'Death holds the final original cell');
s=start('evil-sage');
const p={...hero,action:'attack',attackIndex:0,attackSerial:99,actionMs:180};
const before={...p,actionMs:140};
s.boss={...s.boss,x:hero.x+25,y:hero.y,hp:1,phase:'recover',phaseMs:0};s.invulnerableMs=0;
s=tick(s,40,before,p);assert.equal(s.mode,'won');assert.equal(s.purgatorio.cleared,1);assert.equal(s.boss.phase,'death');assert.equal(s.boss.phaseMs,0);assert(!s.ending.ready);
const duration=ENEMY_DEFS['evil-sage'].deathDurationMs, hp=s.hp;
assert.equal(s.ending.animationMs,duration);
let elapsed=0;while(elapsed+40<duration+3000){s=tick(s);elapsed+=40;assert(!s.ending.ready);assert.equal(s.hp,hp);assert.equal(s.purgatorio.cleared,1);assert.equal(s.hazards.length,0);}
s=tick(s);assert(s.ending.ready);assert.equal(s.purgatorio.cleared,1);assert.equal(s.events.death,0);
const ended=s;s=tick(s);assert.equal(s,ended,'A completed terminal sequence is idempotent');
const fresh=game.createSurvival();assert.equal(fresh.ending,undefined);assert.equal(fresh.mode,'playing');
for(const mode of ['easy','hard','dystopia']){
 const summoner=start('skeleton-summoner',mode),old=Math.ceil(ENEMY_DEFS['skeleton-summoner'].hp*bossMode(mode).hp*purgatorioTuning(1,mode).hpMultiplier);
 assert.equal(summoner.boss.maxHp,old*1.2);assert.equal(summoner.boss.hp,summoner.boss.maxHp);
}
console.log('Summoner health passed: exactly +20% after the existing mode/encounter scaling, without double application.');
console.log('End sequences passed: real lethal contact, six-frame death + 2000ms, actual boss kill/death + 3000ms, frozen damage/spawns/rewards, once-only clear, input lock, fresh retry; exact 30% Rock health reduction in '+healthCases+' modes.');
