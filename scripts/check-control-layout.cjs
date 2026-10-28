/* global __dirname */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){const p=path.join(root,file);if(cache.has(p))return cache.get(p).exports;const m={exports:{}};cache.set(p,m);vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:id=>load(path.relative(root,path.resolve(path.dirname(p),id+'.ts')))});return m.exports;}
const data=load('src/ui/controlSettings.ts'),g=load('src/ui/controlLayout.ts'),plain=x=>JSON.parse(JSON.stringify(x));

function valid(layout,area){for(const id of data.ELEMENT_IDS){const b=g.elementBox(id,layout[id],area);assert(b.x>=0&&b.y>=0);assert(b.x+b.width<=area.width+1e-7&&b.y+b.height<=area.height+1e-7);if(data.CONTROL_IDS.includes(id)||id==='frenesis')assert(b.width>=48&&b.height>=48);}}
let samples=0;
for(const [w,h] of [[568,320],[667,375],[844,390],[1024,600]])for(const insets of [{left:0,right:0,top:0,bottom:0},{left:44,right:24,top:0,bottom:20}]){
 const a=g.controlArea(w,h,insets);let layout=g.resolveElementLayout(data.DEFAULT_CONTROLS,a);valid(layout,a);
 assert.equal(g.elementOverlaps(layout,a).length,0,'No default overlaps: '+w+'x'+h+' '+JSON.stringify(g.elementOverlaps(layout,a)));
 for(const id of data.ELEMENT_IDS){for(const p of [{x:-10,y:4,scale:.01,opacity:.3},{x:.5,y:.5,scale:4,opacity:.6},{x:.2,y:.3,scale:1.2,opacity:1}]){
   const others=plain(layout);layout=g.moveElement(layout,id,p,a);valid(layout,a);samples++;
   for(const other of data.ELEMENT_IDS)if(other!==id)assert.deepEqual(plain(layout[other]),others[other],'Dragging must never push another element');
 }}
 const stored=data.readControlSettings(JSON.stringify({...data.DEFAULT_CONTROLS,elements:layout}));assert.deepEqual(plain(stored.elements),plain(layout));
 assert.deepEqual(plain(g.resolveElementLayout(stored,a)),plain(layout),'Editor and runtime use exact same geometry');
 const other=g.controlArea(w===568?844:568,320,insets);valid(g.resolveElementLayout(stored,other),other);
 assert.deepEqual(plain(g.resolveElementLayout(stored,a)),plain(layout),'Adapting to another screen cannot rewrite stored centers');
}
const physical=g.controlArea(844,390,{left:44,right:24,top:0,bottom:20});assert.equal(physical.left,0);assert.equal(physical.top,0);assert.equal(physical.width,844);assert.equal(physical.height,390);
const defaults=g.resolveElementLayout(data.DEFAULT_CONTROLS,physical);
let corner=g.moveElement(defaults,'joystick',{...defaults.joystick,x:0,y:0},physical);assert.equal(g.elementBox('joystick',corner.joystick,physical).x,0);assert.equal(g.elementBox('joystick',corner.joystick,physical).y,0);
corner=g.moveElement(corner,'attack',{...corner.attack,x:corner.joystick.x,y:corner.joystick.y},physical);assert(g.elementOverlaps(corner,physical).some(pair=>pair.includes('joystick')&&pair.includes('attack')),'Intentional overlap is preserved');
const legacy={joystick:{x:.3,y:.3,scale:1.1},attack:{x:.8,y:.8,scale:1},dash:{x:.7,y:.8,scale:1},pause:{x:.9,y:.1,scale:1}};
const old=g.resolveControlLayout({...data.DEFAULT_CONTROLS,layout:legacy},physical),migrated=g.resolveElementLayout({...data.DEFAULT_CONTROLS,layout:legacy},physical);for(const id of data.CONTROL_IDS)assert.deepEqual(plain(g.controlBox(id,old[id],physical)),plain(g.elementBox(id,migrated[id],physical)));
const legacyJoy=g.elementBox('joystick',migrated.joystick,physical);assert(Math.abs(legacyJoy.x+legacyJoy.width/2-(46+.3*(844-46-24-2)))<1e-8,'Legacy safe-area center is migrated exactly');
for(const opacity of [.15,.5,1]){const setting={...data.DEFAULT_CONTROLS,opacity,hudOpacity:1-opacity,elements:{attack:{...defaults.attack,opacity:.5}}};assert.equal(g.elementOpacity(setting,'attack'),opacity*.5);assert.equal(g.elementOpacity(setting,'vitals'),1-opacity);assert.equal(g.elementOpacity(setting,'frenesis'),opacity);}
const bad=data.validControlPatch({elements:{attack:{x:NaN,y:.5,scale:1,opacity:1},boss:{x:.4,y:.3,scale:999,opacity:0},unknown:{x:1,y:1,scale:1,opacity:1}}});assert(!bad.elements.attack);assert(!bad.elements.unknown);assert.equal(bad.elements.boss.scale,1.6);assert.equal(bad.elements.boss.opacity,.15);
console.log(`Control/HUD layout passed: ${samples} drags/resizes, 10 editable elements (one combined wave/enemy panel), physical borders, non-overlapping defaults in four landscape sizes/insets, intentional overlaps without pushing, exact geometry/migration/persistence, resolution roundtrip and independent opacity.`);

const preview=load('src/ui/controlEditorPreview.ts');
for(const viewport of [{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:1024,height:600}])for(const hidden of [false,true]){
 const fit=preview.fitControlPreview(viewport,{width:viewport.width-24-(hidden?0:232),height:viewport.height-120});
 assert(fit.scale>0&&fit.scale<=1);assert(Math.abs(fit.width/fit.height-viewport.width/viewport.height)<1e-9);assert(fit.width<=viewport.width-24-(hidden?0:232)+1e-8&&fit.height<=viewport.height-120+1e-8);
}
const cfg={...data.DEFAULT_CONTROLS,elements:{attack:{...defaults.attack,x:defaults.joystick.x,y:defaults.joystick.y}}},before=JSON.stringify(cfg),prepared=preview.controlDraftForSave(cfg,physical);assert.equal(JSON.stringify(cfg),before,'Preparing explicit Save cannot mutate the stored profile');assert(prepared.elements.joystick,'Save freezes both sides of a deliberately overlapping pair');
console.log('Framed preview passed: landscape fit with/without panel, proportional coordinates, no mutation while preparing explicit Save.');

assert(!data.ELEMENT_IDS.includes('enemies'),'Counter is part of the wave element, never a duplicate configurable box');
const legacyHud=data.readControlSettings(JSON.stringify({elements:{wave:{x:.2,y:.25,scale:1.1,opacity:.8},enemies:{x:.9,y:.9,scale:1,opacity:1},frenesis:{x:.5,y:.7,scale:1.2,opacity:.6}}}));
assert.equal(legacyHud.elements.wave.x,.2);assert.equal(legacyHud.elements.frenesis.y,.7);assert(!legacyHud.elements.enemies,'Old independent enemy placement is ignored without resetting other saved positions');
for(const size of [[568,320],[844,390]]){const a=g.controlArea(...size,{left:0,right:0,top:0,bottom:0}),l=g.defaultElementLayout(data.DEFAULT_CONTROLS,a),v=g.elementBox('vitals',l.vitals,a),f=g.elementBox('frenesis',l.frenesis,a);assert.equal(v.y+v.height,f.y+f.height,'Shared 68px visible baseline aligns life and ultimate');}
