/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const raw=fs.readFileSync(file,'utf8');const code=/(survival|purgatorio)\.ts$/.test(file)?babel.transformSync(raw,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,global:{Error},require:id=>{assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return target.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return m.exports;}
function isolated(fn,...args){assert(fn.__initData?.code);return vm.runInNewContext('('+fn.__initData.code+')',{}).apply({__closure:fn.__closure},args);}
const p=load('src/game/purgatorio.ts'),api=load('src/game/survival.ts'),players=load('src/game/player.ts'),nav=load('src/game/navigation.ts');
const R=p.PURGATORIO_ROSTER,orders=new Set(),firsts=new Set();let draws=0;
for(let seed=0;seed<100;seed++){
 const run=isolated(p.createPurgatorio,{mode:'purgatorio',encounter:'infinite'},seed),initial=run.currentId;firsts.add(initial);
 assert.equal(run.bag.remaining.length,R.length,'Preparing a candidate does not count as appearing');
 const pending=JSON.stringify(run.bag);for(let n=0;n<3;n++)assert.equal(isolated(p.nextPurgatorioEnemy,run),initial);assert.equal(JSON.stringify(run.bag),pending);
 let last=null;
 for(let cycle=0;cycle<12;cycle++){
  const seen=[];
  for(let n=0;n<R.length;n++){
   const id=isolated(p.nextPurgatorioEnemy,run);assert(R.includes(id));if(n===0&&last)assert.notEqual(id,last);
   seen.push(id);isolated(p.confirmPurgatorioAppearance,run,id);run.currentId=id;run.cleared++;draws++;last=id;
   assert.equal(run.bag.remaining.length,R.length-n-1);
  }
  assert.equal(new Set(seen).size,R.length);assert.deepEqual([...seen].sort(),[...R].sort());if(cycle===0)orders.add(seen.join(','));
 }
 const fresh=p.createPurgatorio({mode:'purgatorio',encounter:'infinite'},seed);assert.equal(fresh.currentId,initial);assert.equal(fresh.bag.remaining.length,R.length);
}
assert(firsts.size>8,'A fresh session can start with many different encounters');assert.equal(orders.size,100,'Independent session seeds give different first-cycle permutations');
assert.equal(p.readPurgatorioProgress(null).cleared.length,0);assert(firsts.has('the-plague')&&firsts.has('electrocutioner'),'Unidentified new encounters are eligible without a save filter');
const hero=players.createPlayer(),field=nav.buildFlowField(hero),blocked=nav.buildFlowField({x:0,y:0});
function step(s,f=field,dt=40){return isolated(api.advanceSurvival,s,hero,hero,f,dt);}
let s=api.createSurvival(77,'easy',{mode:'purgatorio',encounter:'infinite'});s.invulnerableMs=1e9;const saved=JSON.stringify(s.purgatorio.bag),candidate=s.purgatorio.currentId;
for(let n=0;n<20;n++)s=step(s,blocked);assert.equal(s.boss,null);assert.equal(JSON.stringify(s.purgatorio.bag),saved);assert.equal(s.purgatorio.currentId,candidate,'Failed real spawns preserve the same candidate');
for(let n=0;n<300&&!s.boss;n++)s=step(s);assert(s.boss);assert.equal(s.boss.id,candidate);assert.equal(s.purgatorio.bag.remaining.length,R.length-1);assert.equal(s.purgatorio.bag.last,candidate);
assert.equal(step(s,field,0),s,'Pause never consumes or refills a bag');
// Clones are support actors and never call the actual encounter admission path.
let seed=0;while(p.createPurgatorio({mode:'purgatorio',encounter:'infinite'},seed).currentId!=='electrocutioner')seed++;
s=api.createSurvival(seed,'easy',{mode:'purgatorio',encounter:'infinite'});s.invulnerableMs=1e9;
for(let n=0;n<300&&(!s.boss||s.presentation);n++)s=step(s);assert.equal(s.boss.id,'electrocutioner');const electroBag=JSON.stringify(s.purgatorio.bag);
s.boss.hp=s.boss.maxHp/3;for(let n=0;n<220;n++)s=step(s);assert(s.minibosses.some(b=>b.cloneOf===s.boss.entityId));assert.equal(JSON.stringify(s.purgatorio.bag),electroBag,'A real clone spawn never consumes a special slot in the shuffle');
console.log('Purgatorio shuffle passed: '+draws+' native-worklet draws across100freshseeds/12completecycles, no repeats percycle/boundary, diverse first bosses, unknown roster eligibility, real failed-spawn retry/one-time admission, pause and real Electrocutioner clones without bag consumption.');
