/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),babel=require('@babel/core'),root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);
 const source=fs.readFileSync(file,'utf8'),code=/[\\/](survival|purgatorio|scores|activePowerups|workshop|merchantGameplay|merchantConfig|merchantAssets)\.ts$/.test(file)?babel.transformSync(source,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{global:{Error},module,exports:module.exports,require(id){if(id==='@react-native-async-storage/async-storage')return storage;if(id==='react')return {};assert(id.startsWith('.'));const target=path.resolve(path.dirname(file),id);return id.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return module.exports;
}

const disk=new Map();let failWrite=false,writes=0;
const storage={getItem:async key=>disk.get(key)??null,setItem:async(key,value)=>{if(failWrite)throw Error('disk');writes++;disk.set(key,value);}};
const game=load('src/game/survival.ts'),m=load('src/game/merchantGameplay.ts'),config=load('src/game/merchantConfig.ts'),art=load('src/game/merchantAssets.ts');
const players=load('src/game/player.ts'),nav=load('src/game/navigation.ts'),camera=load('src/game/camera.ts'),collision=load('src/game/collision.ts'),world=load('src/game/worldEvents.ts');
const scores=load('src/game/scores.ts'),{PNG}=require('pngjs'),hero=players.createPlayer(),field=nav.buildFlowField(hero);
const bounds=camera.getCameraBounds({width:844,height:390}),at=camera.clampCamera(hero,bounds),view={left:at.x-422/bounds.scale,right:at.x+422/bounds.scale,top:at.y-195/bounds.scale,bottom:at.y+195/bounds.scale};
for(const kind of config.MERCHANT_KINDS){const a=art.MERCHANT_ART[kind],im=PNG.sync.read(fs.readFileSync(art.MERCHANT_SOURCES[a.image]));assert.equal(im.width,a.width*(a.vertical?1:a.frames));assert.equal(im.height,a.height*(a.vertical?a.frames:1));let previous='';for(let n=0;n<a.frames;n++){const crop=art.merchantFrame(kind,n*1000/a.fps+.01);assert(crop.x+crop.width<=im.width&&crop.y+crop.height<=im.height);let alpha=0;for(let y=crop.y;y<crop.y+crop.height;y++)for(let x=crop.x;x<crop.x+crop.width;x++)alpha+=im.data[(y*im.width+x)*4+3];assert(alpha>0);previous=JSON.stringify(crop);}assert(previous);}
const found=new Set();let spawned=0;
for(let seed=1;seed<100;seed++){
 let s=game.createSurvival(seed);s.combatView=view;s.merchants=m.createMerchants(Math.imul(seed,2654435761));assert.equal(s.merchants.lastMilestone,0);s.encounter.wave=4;assert(!m.advanceMerchants(s,hero,field,16).merchants.active);s.encounter.wave=5;
 s.clockMs=5000;s=m.advanceMerchants(s,hero,field,16);
 const a=s.merchants.active;if(!a)continue;spawned++;found.add(a.kind);const sheet=art.MERCHANT_ART[a.kind],w=sheet.width*sheet.scale/2,h=sheet.height*sheet.scale;
 assert(a.x+w<view.left-24||a.x-w>view.right+24||a.y+6<view.top-24||a.y-h>view.bottom+24,'The complete merchant is outside the actual camera');assert(collision.isWalkable(a.x,a.y)&&nav.isReachable(a,field));
 if(a.kind==='traveler'){assert.equal(a.offers.length,2);assert.notEqual(a.offers[0],a.offers[1]);assert(a.offers.every(id=>config.merchantOffer(id).cost>300));}
 const opened=m.advanceMerchants(s,a,field,16);assert.equal(opened.mode,'merchant');assert(opened.merchants.open);assert.equal(m.advanceMerchants(opened,a,field,40),opened,'Shopping freezes merchant lifetime');
 const closed=m.closeMerchant(opened);assert.equal(closed.mode,'playing');assert(!closed.merchants.open);assert.equal(m.advanceMerchants(closed,a,field,16).mode,'playing','No instant re-open while standing still');
 let rearmed=m.advanceMerchants(closed,{x:a.x+100,y:a.y},field,16);rearmed=m.advanceMerchants(rearmed,a,field,16);assert.equal(rearmed.mode,'merchant');
 let expired=m.advanceMerchants({...s,merchants:{...s.merchants,active:{...a,ageMs:29990}}},hero,field,16);assert.equal(expired.merchants.active.phase,'departing');assert.equal(expired.merchants.active.departureMs,6);
 assert.equal(m.quoteMerchant({...expired,mode:'merchant',merchants:{...expired.merchants,open:true}},a.offers[0],'run'),null);
 for(let i=0;i<6;i++){const v=art.merchantVisual({...expired.merchants.active,departureMs:i*100});assert(v.source.height>0);assert(v.opacity<=1);assert.equal(v.source.height-v.pivotY,sheet.height-sheet.pivotY);}
 expired=m.advanceMerchants(expired,hero,field,594);assert.equal(expired.merchants.active,null);assert.equal(m.advanceMerchants(expired,hero,field,40).merchants.active,null);
 const busy=m.advanceMerchants({...s,encounter:{...s.encounter,wave:10}},hero,field,16);assert.equal(busy.merchants.active.id,a.id);assert.equal(busy.merchants.pendingMilestone,null);
 assert(!world.canStartSpecial(s,'scheduled')&&!world.canRunWorldEvent(s,'capture',1,s.clockMs)&&!world.canStartOptional(s));
}
assert.equal(found.size,4);assert(spawned>30);
let s=game.createSurvival(9);s.combatView=view;s.merchants=m.createMerchants(9);s.clockMs=5000;s.encounter.wave=5;s.pendingBoss=true;const delayed=m.advanceMerchants(s,hero,field,16);assert(!delayed.merchants.active);assert.equal(delayed.merchants.pendingMilestone,5);assert.equal(delayed.merchants.retryAtMs,s.clockMs+1000);
const deferred=m.advanceMerchants({...delayed,pendingBoss:false,clockMs:6000},hero,field,16);assert(deferred.merchants.active);assert.equal(deferred.merchants.pendingMilestone,null);
assert.equal(m.advanceMerchants({...deferred,mode:'upgrade'},hero,field,1000).merchants.active.ageMs,0);
assert.equal(m.advanceMerchants(deferred,hero,field,0),deferred);assert.equal(m.advanceMerchants({...deferred,mode:'dead'},hero,field,16).merchants.active,null);
assert.equal(m.advanceMerchants({...s,purgatorio:{}},hero,field,40).merchants.active,null);
function shop(kind='traveler',difficulty='easy') {const s=game.createSurvival(4,difficulty);s.mode='merchant';s.merchants={...m.createMerchants(4),open:true,active:{id:1,kind,...hero,ageMs:1000,offers:kind==='traveler'?['upgrade-speed','upgrade-rhythm']:kind==='fruit'?['heal']:kind==='scavenger'?['armor']:['cells-150','cells-300','cells-1000','no-ads','ad-preview'],sold:[],nonce:0,applied:[]}};return s;}
s=shop();let q=m.quoteMerchant(s,'upgrade-speed','run'),out=m.applyMerchantPurchase(s,q);assert.equal(out.state.upgrades.speed,1);assert.equal(out.status,'applied');assert.equal(m.applyMerchantPurchase(out.state,q).status,'duplicate');assert.equal(m.quoteMerchant(out.state,'upgrade-speed','run'),null);assert.equal(s.upgrades.speed,0);
s=shop('fruit');assert.equal(m.quoteMerchant(s,'heal','run'),null,'No payment for a full health bar');s.hp=3;q=m.quoteMerchant(s,'heal','run');s=m.applyMerchantPurchase(s,q).state;assert.equal(s.hp,4);q=m.quoteMerchant(s,'heal','run');s=m.applyMerchantPurchase(s,q).state;assert.equal(s.hp,5);assert.equal(m.quoteMerchant(s,'heal','run'),null);
s=shop('scavenger','dystopia');assert.equal(m.quoteMerchant(s,'armor','run'),null,'One-life difficulty cannot buy extra damage absorption');
s=shop('scavenger');for(let n=0;n<3;n++){q=m.quoteMerchant(s,'armor','run');s=m.applyMerchantPurchase(s,q).state;}assert.equal(s.armor,3);assert.equal(m.quoteMerchant(s,'armor','run'),null);
s=m.closeMerchant(s);s.encounter.remaining=0;s.encounter.spawnMs=1e9;s.encounter.enemies=s.encounter.enemies.map((n,i)=>({...n,active:i===0,id:100+i,x:hero.x,y:hero.y,action:'move',actionMs:0}));s.invulnerableMs=0;
let hurt=game.advanceSurvival(s,hero,hero,field,16);assert.equal(hurt.hp,5);assert.equal(hurt.armor,2);assert(hurt.invulnerableMs>0);assert.equal(game.advanceSurvival(hurt,hero,hero,field,16).armor,2);
for(let n=0;n<3;n++){hurt={...hurt,invulnerableMs:0};hurt=game.advanceSurvival(hurt,hero,hero,field,16);}assert.equal(hurt.armor,0);assert.equal(hurt.hp,4);assert.equal(game.createSurvival().armor??0,0);
let poison=game.createSurvival(3);poison.armor=1;poison.poisonMs=1000;poison.poisonTickMs=0;poison.invulnerableMs=0;
poison=game.advanceSurvival(poison,hero,hero,field,16);assert.equal(poison.armor,0);assert.equal(poison.hp,4,'Two-point poison damage spills past one armor point instead of being discarded');
let frenzy=game.createSurvival(3);frenzy.armor=2;frenzy.frenesis={...frenzy.frenesis,active:true,hp:4,remainingMs:1000};frenzy.poisonMs=1000;frenzy.poisonTickMs=0;
frenzy=game.advanceSurvival(frenzy,hero,hero,field,16);assert.equal(frenzy.frenesis.hp,2);assert.equal(frenzy.armor,2);assert.equal(frenzy.hp,5,'Frenesis keeps its temporary protection ahead of armor and normal HP');
function freshStore(){cache.delete(path.resolve(root,'src/ui/ScoreStorage.ts'));return load('src/ui/ScoreStorage.ts');}
(async()=>{
 const archive=scores.emptyScoreArchive();archive.economy.cells=1000;disk.set('@dystopia/scores/v1',JSON.stringify(archive));let store=freshStore();await store.loadScores();
 s=shop();q=m.quoteMerchant(s,'upgrade-speed','wallet');const receipts=await Promise.all([store.purchaseMerchant(q),store.purchaseMerchant(q),store.purchaseMerchant(q)]);assert(receipts.every(r=>r.ok));assert.equal(store.getScores().economy.cells,670);assert.equal(writes,1);
 let poor={...q,id:'poor',itemId:'upgrade-vitality'};assert((await store.purchaseMerchant(poor)).ok);assert.equal(store.getScores().economy.cells,220);await store.acknowledgeMerchant(poor.id);assert(!(await store.purchaseMerchant({...q,id:'insufficient'})).ok);assert.equal(store.getScores().economy.cells,220);
 await Promise.all([store.refundMerchant(q.id),store.refundMerchant(q.id)]);assert.equal(store.getScores().economy.cells,550);assert(!(await store.purchaseMerchant(q)).ok,'Refunded transaction cannot replay');
 failWrite=true;await assert.rejects(store.purchaseMerchant({...q,id:'write-error'}));assert.equal(store.getScores().economy.cells,550);failWrite=false;
 for(const[id,amount]of[['cells-150',150],['cells-300',300],['cells-1000',1000],['ad-preview',25]]){const before=store.getScores().economy.cells,p={...q,id:'demo-'+id,itemId:id};await Promise.all([store.purchaseMerchant(p),store.purchaseMerchant(p)]);assert.equal(store.getScores().economy.cells,before+amount);}
 const before=store.getScores().economy.cells;assert((await store.purchaseMerchant({...q,id:'no-ads',itemId:'no-ads'})).ok);assert(store.getScores().economy.adFreePreview);assert(!(await store.purchaseMerchant({...q,id:'other-no-ads',itemId:'no-ads'})).ok);assert.equal(store.getScores().economy.cells,before);
 store=freshStore();await store.loadScores();assert.equal(store.getScores().economy.cells,before);assert(store.getScores().economy.adFreePreview);await store.purchaseMerchant({...q,id:'demo-cells-150',itemId:'cells-150'});assert.equal(store.getScores().economy.cells,before);
 assert.equal(await store.refundMerchant(poor.id),false,'Confirmed effects cannot be refunded again');
 assert((await store.purchaseMerchant({...q,id:'crash-after-debit',itemId:'armor'})).ok);assert.equal(store.getScores().economy.cells,before-35);
 store=freshStore();await store.loadScores();assert.equal(store.getScores().economy.cells,before,'Pending paid deliveries recover on boot');assert(store.getScores().economy.merchantReceipts['crash-after-debit'].refunded);
 store=freshStore();await store.loadScores();assert.equal(store.getScores().economy.cells,before,'Crash recovery refunds only once');
 const native=m.advanceMerchants;assert(native.__initData?.code);const isolated=vm.runInNewContext(`(${native.__initData.code})`,{});assert.equal(isolated.apply({__closure:native.__closure},[s,hero,field,0]),s);
 const nativeCase=game.createSurvival(57);nativeCase.combatView=view;nativeCase.merchants=m.createMerchants(57);nativeCase.clockMs=5000;nativeCase.encounter.wave=5;
 assert(isolated.apply({__closure:native.__closure},[nativeCase,hero,field,16]).merchants.active,'Serialized UI entry executes an actual hidden spawn with its captured constants');
 console.log(`Merchants passed: four audited sheets/46 frames; ${spawned} hidden/reachable placements; five-wave milestones, deferred/occupied milestones, 30 active seconds and pixel departure, single shop and exclusion, proximity/rearm/pause, two unique expensive upgrades, repeat healing, armor damage/invulnerability/one-life rules, serialized persistent purchases/refunds/errors, four free demo packs + ad, idempotence and native worklet entry. No hardware claim.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

