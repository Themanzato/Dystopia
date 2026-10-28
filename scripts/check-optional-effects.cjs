/* global __dirname */
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
const jsx=(type,props)=>({type,props});
const shared=value=>({value});
const dependencies={react:{default:{},__esModule:true,useState:fn=>[fn(),()=>{}]},'react/jsx-runtime':{jsx,jsxs:jsx},
 'react-native':{View:'View',StyleSheet:{create:s=>s,absoluteFill:{}}},'react-native-worklets':{scheduleOnRN:()=>{}},
 'react-native-reanimated':{useAnimatedReaction:()=>{},useDerivedValue:fn=>({get value(){return fn()}})},
 '@shopify/react-native-skia':{Group:'Group',Path:'Path',Atlas:'Atlas',Canvas:'Canvas',RadialGradient:'RadialGradient',Fill:'Fill',useImage:source=>source,FilterMode:{Nearest:0},MipmapMode:{None:0},
  rect:(x,y,width,height)=>({x,y,width,height}),Skia:{RSXform:(scale,r,x,y)=>({scale,r,x,y}),PathBuilder:{Make(){const ops=[];return {addCircle:(x,y,r)=>ops.push({circle:{x,y,r}}),close:()=>ops.push({close:true}),addRect:r=>ops.push({rect:r}),moveTo:(x,y)=>ops.push({move:[x,y]}),lineTo:(x,y)=>ops.push({line:[x,y]}),detach:()=>ops}}}}}};
function load(file){const filename=path.join(root,file);if(cache.has(filename))return cache.get(filename).exports;const module={exports:{}};cache.set(filename,module);
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports:module.exports,module,require:id=>{if(id in dependencies)return dependencies[id];if(id==='../ui/GameplayElement')return {__esModule:true,default:'GameplayElement'};if(id==='../ui/UpgradeIcon')return {__esModule:true,default:'UpgradeIcon'};if(id==='../ui/pixelFontAsset')return {PIXEL_FONT_SOURCE:path.join(root,'assets/ui/font/ui-alphabet.png')};if(id==='../ui/PixelText')return {__esModule:true,default:'PixelText'};assert(id.startsWith('.'));const target=path.resolve(path.dirname(filename),id);return id.endsWith('.png')?target:load(path.relative(root,target+(/\.tsx?$/.test(target)?'':fs.existsSync(target+'.tsx')?'.tsx':'.ts')))}},{filename});return module.exports;}

const api=load('src/game/optionalEvents.ts'),{OPTIONAL_EVENT_CONFIG:C}=api;
const render=load('src/game/OptionalEventEffects.tsx');
function nodes(tree,type){if(!tree)return [];if(Array.isArray(tree))return tree.flatMap(t=>nodes(t,type));return [...(tree.type===type?[tree]:[]),...nodes(tree.props?.children,type)]}
const survival=shared({world:{optional:api.createOptionalEvents(1)},encounter:{enemies:[]},frenesis:{active:false}}),player=shared({x:1300,y:604});
let vision=render.ReactorVision({survival,player});assert.equal(vision.props.opacity.value,0);const gradient=nodes(vision,'RadialGradient')[0];assert.equal(gradient.props.r.value,C.visionRecoveredRadius);assert.equal(gradient.props.colors[0].slice(-2),'00');
survival.value.world.optional.visibility=1;assert.equal(vision.props.opacity.value,1);assert.equal(gradient.props.r.value,C.visionRadius);survival.value.world.optional.visibility=1/3;assert(gradient.props.r.value>C.visionRadius);survival.value.world.optional.visibility=0;assert.equal(vision.props.opacity.value,0);
const points=[{x:1300,y:604,progressMs:1000,complete:false},{x:1050,y:860,progressMs:4000,complete:true},{x:2096,y:973,progressMs:0,complete:false}];
survival.value.world.optional.active={id:1,kind:'reactor',phase:'active',points,elapsedMs:1234};
const ground=render.OptionalEventGround({survival}),zones=nodes(ground,'Path')[0].props.path.value;assert.equal(zones.length,3);assert(zones.every(op=>op.circle.r===76));
const atlas=nodes(ground,'Atlas')[0],source=atlas.props.image,header=fs.readFileSync(source);assert.equal(header.readUInt32BE(16),320);assert.equal(header.readUInt32BE(20),33);assert.equal(header[25],6);
assert.equal(atlas.props.transforms.value[0].scale,0,'No shrine sprite in reactor zones');
survival.value.world.optional.active={...survival.value.world.optional.active,kind:'nest',points:[points[0]]};
for(let ms=0;ms<2000;ms+=17){survival.value.world.optional.active.elapsedMs=ms;const crop=atlas.props.sprites.value[0];assert(crop.x%32===0&&crop.width===32&&crop.x+crop.width<=320);assert.equal(crop.height,33)}assert.equal(atlas.props.transforms.value[0].scale,1.5);
survival.value.encounter.enemies=[{id:1,active:true,action:'move',x:1300,y:604,hp:2,eliteEventId:1},{id:2,active:true,action:'move',x:1400,y:604}];const elite=render.EliteMarkers({survival});assert(elite.props.path.value.length>0);survival.value.encounter.enemies[0].action='death';assert.equal(elite.props.path.value.length,0);
survival.value.world.optional=api.clearOptionalEvents(survival.value.world.optional);assert.equal(atlas.props.transforms.value[0].scale,0);assert.equal(nodes(ground,'Path')[0].props.path.value.length,0);
console.log('Optional event rendering passed: real RGBA shrine frames, zone count/geometry, elite-only markers, transparent near-vision with partial recovery and full cleanup. Native APIs mocked.');
