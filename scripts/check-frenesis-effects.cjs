/* global __dirname */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
const jsx=(type,props)=>({type,props});
const shared=value=>({value});
const dependencies={react:{default:{},__esModule:true},'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-native-reanimated':{useDerivedValue:fn=>({get value(){return fn()}})},
 '@shopify/react-native-skia':{Group:'Group',Path:'Path',Atlas:'Atlas',FilterMode:{Nearest:0},MipmapMode:{None:0},
  rect:(x,y,width,height)=>({x,y,width,height}),Skia:{RSXform:(scale,r,x,y)=>({scale,r,x,y}),PathBuilder:{Make(){const ops=[];return {addRect:r=>ops.push({rect:r}),moveTo:(x,y)=>ops.push({move:[x,y]}),lineTo:(x,y)=>ops.push({line:[x,y]}),detach:()=>ops}}}}}};
function load(file){const filename=path.join(root,file);if(cache.has(filename))return cache.get(filename).exports;const module={exports:{}};cache.set(filename,module);
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports:module.exports,module,require:id=>{if(id in dependencies)return dependencies[id];assert(id.startsWith('.'));const target=path.resolve(path.dirname(filename),id);return id.endsWith('.png')?target:load(path.relative(root,target+(/\.tsx?$/.test(target)?'':fs.existsSync(target+'.tsx')?'.tsx':'.ts')))}},{filename});return module.exports;}
const f=load('src/game/frenesis.ts'), art=load('src/game/frenesisAssets.ts');
const Screen=load('src/game/FrenesisScreenEffects.tsx').default,World=load('src/game/FrenesisEffects.tsx').default;
function nodes(tree,type){if(!tree)return [];if(Array.isArray(tree))return tree.flatMap(t=>nodes(t,type));return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)]}
const survival=shared({mode:'playing',frenesis:f.createFrenesis()}),player=shared({x:1300,y:603.75,action:'run',actionMs:0,facingX:1}),view=shared({width:844,height:390});
let scene=Screen({survival,player,view}),paths=nodes(scene,'Path');assert(paths.every(n=>n.props.path.value.length===0),'No screen effect outside the ultimate');
survival.value.frenesis=f.startFrenesis({...f.createFrenesis(),charge:100},true);survival.value.frenesis.remainingMs=13100;
assert.equal(paths[1].props.path.value.length,24);assert.equal(paths[0].props.path.value.length,16);
for(const op of paths[1].props.path.value){assert(op.rect.height<=2);assert(op.rect.y>0&&op.rect.y<390)}
const frozen=JSON.stringify(paths.map(p=>p.props.path.value));assert.equal(JSON.stringify(paths.map(p=>p.props.path.value)),frozen,'Effects depend exclusively on the paused simulation clock');
survival.value.frenesis.remainingMs=14000;assert.equal(paths[1].props.path.value.length,0,'Quiet gaps have no static bands');
for(const dimensions of [{width:568,height:320},{width:1200,height:600}]){view.value=dimensions;survival.value.frenesis.remainingMs=13100;for(const op of paths[1].props.path.value)assert(op.rect.y<dimensions.height)}
const enemy=load('src/game/enemyVisuals.ts');const actorImages=[...Array(5+enemy.ENEMY_IMAGE_SOURCES.length).fill('other'),...art.FRENESIS_SOURCES,'merchant0','merchant1','merchant2','merchant3'];
scene=World({survival,player,images:actorImages});assert.equal(nodes(scene,'Path').length,0);
const atlases=nodes(scene,'Atlas');assert.equal(atlases.length,1,'Only the existing blink trail, no Slices effect renderer');assert.equal(atlases[0].props.image,art.FRENESIS_SOURCES[5]);
for(const action of ['idle','run','attack','dash'])for(const kind of ['slash1','slash2','slices']){player.value={...player.value,action,frenesisAttack:kind};assert(atlases[0].props.transforms.value.every(t=>t.scale===0),'No ghost/extra body while attacking');}
survival.value.frenesis={...survival.value.frenesis,teleport:{fromX:1200,fromY:600,x:1300,y:603,elapsedMs:200}};assert(atlases[0].props.transforms.value.some(t=>t.scale>0));
const paused=World({survival,player,images:actorImages,active:false});assert(nodes(paused,'Atlas')[0].props.transforms.value.every(t=>t.scale===0));
survival.value.frenesis=f.endFrenesis(survival.value.frenesis);assert(paths.every(n=>n.props.path.value.length===0));assert(atlases[0].props.transforms.value.every(t=>t.scale===0));
console.log('Frenesis effects passed: Slices removed entirely from overlays; single main actor owns the spin, existing blink trail and bounded screen glitches retain pause/end cleanup.');
