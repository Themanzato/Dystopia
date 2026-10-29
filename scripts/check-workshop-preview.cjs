/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);const text=fs.readFileSync(file,'utf8');
 const code=file.endsWith('workshopPreviewModel.ts')?babel.transformSync(text,{filename:file,babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-typescript')],plugins:[require.resolve('react-native-worklets/plugin'),require.resolve('@babel/plugin-transform-modules-commonjs')]}).code:ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module:m,exports:m.exports,global:{Error},require:id=>{assert(id.startsWith('.'),'Preview cannot reach external services: '+id);const target=path.resolve(path.dirname(file),id);return target.endsWith('.png')?target:load(path.relative(root,target+'.ts'));}},{filename:file});return m.exports;
}
const api=load('src/ui/workshopPreviewModel.ts'),workshop=load('src/game/workshop.ts'),player=load('src/game/player.ts');
const source=fs.readFileSync(root+'/src/ui/WorkshopDemoCanvas.tsx','utf8'),pure=fs.readFileSync(root+'/src/ui/workshopPreviewModel.ts','utf8');
const wrapper=fs.readFileSync(root+'/src/ui/WorkshopDemonstration.tsx','utf8');
assert(!/react-native-skia|sharedImages|useDerivedValue|useSharedValue/.test(wrapper.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'')),'The eagerly discovered Workshop route cannot initialize Skia');
assert(wrapper.includes("lazy(() => import('./WorkshopDemoCanvas'))")&&wrapper.includes('<Suspense'),'The canvas must be evaluated only when Taller mounts');
const gate={exports:{}},factories=[];let prematureCanvas=0;
vm.runInNewContext(ts.transpileModule(wrapper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:gate,exports:gate.exports,require:id=>{
 if(id==='react')return {lazy:factory=>{factories.push(factory);return 'LazyCanvas';},Suspense:'Suspense'};
 if(id==='react/jsx-runtime')return {jsx:(type,props)=>({type,props})};
 prematureCanvas++;throw Error('Premature preview dependency '+id);
}});
assert.equal(factories.length,1);assert.equal(prematureCanvas,0,'Route discovery cannot evaluate the canvas');
const guarded=gate.exports.default({id:'field-kit',difficulty:'easy',width:200,height:160});assert.equal(guarded.type,'Suspense');assert.equal(guarded.props.children.type,'LazyCanvas');assert.equal(prematureCanvas,0,'Rendering the wrapper still delegates initialization to React.lazy');
assert(!/ScoreStorage|purchaseUpgrade|withdrawAdvantage|createSurvival|advanceSurvival|AsyncStorage|useGameAudio/.test(source+pure),'The preview has no live economy/simulation/progression path');
const png=fs.readFileSync(root+'/assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png');assert.equal(png.readUInt32BE(16),900);assert.equal(png.readUInt32BE(20),999);
const sample=api.sampleWorkshopPreview;assert(sample.__initData?.code,'Preview sampler must serialize for the UI runtime');
const isolated=(...args)=>vm.runInNewContext('('+sample.__initData.code+')',{}).apply({__closure:sample.__closure},args);
let frames=0;
for(const difficulty of ['easy','hard','dystopia'])for(const id of workshop.WORKSHOP_IDS){
 const v=api.workshopPreviewValues(id,difficulty),before=JSON.stringify(v),bonus=workshop.workshopBonuses([id],difficulty);
 assert.equal(v.health-v.baseHealth,bonus.health);assert.equal(v.attackMultiplier,1+bonus.attack);assert.equal(v.moveMultiplier,1+bonus.speed);assert.equal(v.charge,bonus.charge);
 for(let ms=0;ms<12000;ms+=17){const f=isolated(id,ms,v);assert(f.frame>=0&&f.frame<10);assert(f.row*37+37<=999);assert(Number.isFinite(f.offset));assert(f.opacity>=0&&f.opacity<=1);assert(f.healthGain>=0&&f.healthGain<=bonus.health);assert(f.charge>=0&&f.charge<=bonus.charge);frames++;}
 assert.equal(JSON.stringify(v),before,'Sampling never mutates input values');
}
const kit=api.workshopPreviewValues('field-kit','easy');assert.equal(kit.health,6);assert.equal(isolated('field-kit',1200,kit).healthGain,1);
const one=api.workshopPreviewValues('field-kit','dystopia');assert.equal(one.baseHealth,1);assert.equal(one.health,1);assert.equal(one.blocked,true);assert.equal(isolated('field-kit',1200,one).healthGain,0);
const servo=api.workshopPreviewValues('attack-servo','easy'),a=player.PLAYER_ANIMATIONS.attack[0],duration=a.frames*1000/a.fps/servo.attackMultiplier;
assert.equal(servo.attackMultiplier,1.08);let last=-1;
for(let ms=0;ms<duration;ms+=3){const f=isolated('attack-servo',300+ms,servo);assert.equal(f.row,a.row);assert(f.frame>=last,'Attack frames stay ordered until completion');last=f.frame;}
assert.equal(last,a.frames-1);assert.equal(isolated('attack-servo',300+duration+.01,servo).row,player.PLAYER_ANIMATIONS.idle.row);
const boots=api.workshopPreviewValues('assault-boots','easy'),base={...boots,moveMultiplier:1};assert.equal(boots.moveMultiplier,1.08);
const improved=isolated('assault-boots',1200,boots),normal=isolated('assault-boots',1200,base);assert(Math.abs(improved.offset/normal.offset-1.08)<1e-10,'Travel shows the actual 8% gain');assert(Math.abs(isolated('assault-boots',2599,boots).offset-isolated('assault-boots',2600,boots).offset)<1e-9,'Movement never teleports at a loop boundary');
const coil=api.workshopPreviewValues('frenesis-coil','easy');assert.equal(coil.charge,15);assert.equal(isolated('frenesis-coil',0,coil).charge,0);assert.equal(isolated('frenesis-coil',1400,coil).charge,15);
assert(source.includes('key={`${id}-${difficulty}`}'),'Selecting another item replaces one isolated model, not a second simultaneous animation');assert(source.includes('listener.remove()'));assert(source.includes('frame.setActive(false)'));assert(source.includes('if (!c.running) return'));
console.log('Workshop preview passed: '+frames+' isolated worklet samples, real +1 HP/+8% attack/+8% movement/15% charge, one-life restriction, complete ordered attack clips, continuous travel, original sheet dimensions, bounded frames, no input mutation/economy side effects and animation lifecycle guards. No physical-device claim.');
