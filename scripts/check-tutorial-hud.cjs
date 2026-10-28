/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),req=Module.createRequire(path.join(root,'package.json')),ts=req('typescript'),React=req('react'),Reconciler=req('react-reconciler'),{sksgHostConfig}=req('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {act}=React;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const data=req('./src/ui/controlSettings.ts'),geometry=req('./src/ui/controlLayout.ts'),instructions=req('./src/game/tutorialInstructions.ts'),settingsDefault=data.DEFAULT_CONTROLS;
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
let layouts=0;
for(const [width,height]of [[568,320],[667,375],[844,390],[1024,600]])for(const insets of [{left:0,right:0,top:0,bottom:0},{left:44,right:24,top:0,bottom:20}]){
 const area=geometry.controlArea(width,height,insets);
 for(const step of instructions.TUTORIAL_STEPS.filter(x=>x!=='finish')){
  const box=instructions.tutorialPanelBox(step,settingsDefault,area),layout=geometry.resolveElementLayout(settingsDefault,area);
  assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
  for(const id of [...data.CONTROL_IDS,'frenesis','vitals','wave'])assert(!overlap(box,geometry.elementBox(id,layout[id],area)),`${step}: instruction overlaps ${id} at ${width}x${height}`);
  layouts++;
 }
}
for(const [width,height]of [[568,320],[844,390]]){
 const area=geometry.controlArea(width,height,{left:0,right:0,top:0,bottom:0});
 const custom={...settingsDefault,elements:{joystick:{x:.8,y:.3,scale:1,opacity:.3},attack:{x:.15,y:.3,scale:1.2,opacity:.8}}};
 const layout=geometry.resolveElementLayout(custom,area);
 for(const step of instructions.TUTORIAL_STEPS.filter(x=>x!=='finish')){const box=instructions.tutorialPanelBox(step,custom,area);for(const id of [...data.CONTROL_IDS,'frenesis','vitals','wave'])assert(!overlap(box,geometry.elementBox(id,layout[id],area)),`${step}: customized instruction overlaps ${id}`);layouts++;}
}
for(const [width,height]of [[568,320],[667,375],[844,390],[1024,600]])for(const custom of [false,true]){
 const area=geometry.controlArea(width,height,{left:0,right:0,top:0,bottom:0});
 const config=custom?{...settingsDefault,elements:{joystick:{x:.8,y:.3,scale:1,opacity:.3},attack:{x:.15,y:.3,scale:1.2,opacity:.8}}}:settingsDefault;
 const layout=geometry.resolveElementLayout(config,area),card=instructions.tutorialPanelBox('teleport',config,area),targets=instructions.tutorialMapTargets(area,config);
 assert(targets.length>=4&&targets.length<=16,`${width} custom ${custom}: ${targets.length} useful destinations`);
 for(const p of targets){const distance=Math.hypot(p.x-width/2,p.y-height/2);assert(distance>=60&&distance<=150);assert(p.x>=20&&p.x<=width-20&&p.y>=26&&p.y<=height-20);assert(!overlap({x:p.x-9,y:p.y-9,width:18,height:18},card));for(const id of [...data.CONTROL_IDS,'frenesis','vitals','wave'])assert(!overlap({x:p.x-17,y:p.y-17,width:34,height:34},geometry.elementBox(id,layout[id],area)),`${width} tap destination overlaps ${id}`);}
}
assert(!Object.values(instructions.TUTORIAL_INSTRUCTIONS).some(i=>/\bNPC\b/i.test(i.text)));
assert.equal(instructions.tutorialStep('invalid'),null);assert.equal(instructions.TUTORIAL_INSTRUCTIONS.charge.continue,true);assert(instructions.TUTORIAL_INSTRUCTIONS.charge.text.includes('no al recoger EXP'));
const reactions=new Set(),rnQueue=[];let rnCalls=0,settings=settingsDefault,completed=0,continued=0,exited=0,started=0;
const originalLoad=Module._load;
Module._load=function(name,parent,main){
 if(name==='react-native')return {View:'View',Pressable:'Pressable',StyleSheet:{create:s=>s,absoluteFill:{position:'absolute',left:0,right:0,top:0,bottom:0}}};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({left:0,right:0,top:0,bottom:0})};
 if(name==='react-native-reanimated')return {__esModule:true,default:{View:'AnimatedView'},useAnimatedStyle:fn=>fn(),useAnimatedReaction:(prepare,react)=>{const latest=React.useRef({prepare,react});React.useLayoutEffect(()=>{latest.current={prepare,react};});React.useEffect(()=>{const item={latest,old:latest.current.prepare()};reactions.add(item);return()=>reactions.delete(item);},[]);}};
 if(name==='react-native-worklets')return {scheduleOnRN:(fn,...a)=>{rnCalls++;rnQueue.push(()=>fn(...a));}};
 if(parent?.filename.endsWith('TutorialHUD.tsx')){
  if(name==='./ControlPreferences')return {useControlSettings:()=>({settings})};
  if(name==='./PixelText')return {__esModule:true,default:props=>React.createElement('PixelProbe',props)};
  if(name==='./PixelArt')return {UIFrame:({children,...p})=>React.createElement('FrameProbe',p,children)};
  if(name==='./AudioProvider')return {useGameAudio:()=>({playUi:()=>{}})};
 }
 return originalLoad.call(this,name,parent,main);
};
const HUD=req('./src/ui/TutorialHUD.tsx').default;
const survival={value:{tutorial:{step:'move'},clockMs:0},set(next){this.value=next}},player={value:{x:100,y:100}},view={value:{width:844,height:390,scale:1,minX:0,maxX:1000,minY:0,maxY:1000}};
const container={root:[],redraw(){}};const renderer=Reconciler({...sksgHostConfig,createTextInstance:text=>({type:'#text',props:{text},children:[]})}),fiber=renderer.createContainer(container,0,null,false,null,'',e=>{throw e;},null);
let props={survival,player,view,visible:true,onContinue:()=>continued++,onExit:()=>exited++,onStartGame:()=>started++,onCompleted:()=>completed++};
function all(predicate,nodes=container.root){const out=[];for(const n of nodes){if(predicate(n))out.push(n);out.push(...all(predicate,n.children));}return out;}
function one(id){const nodes=all(n=>n.props.testID===id);assert.equal(nodes.length,1,id);return nodes[0];}
async function render(patch={}){props={...props,...patch};await act(async()=>renderer.updateContainer(React.createElement(HUD,props),fiber,null,()=>{}));}
async function react(){await act(async()=>{for(const r of reactions){const next=r.latest.current.prepare();if(next!==r.old){const old=r.old;r.old=next;r.latest.current.react(next,old);}}for(const fn of rnQueue.splice(0))fn();});}
async function step(step){survival.value={...survival.value,tutorial:{step}};await react();}
async function press(label){const n=all(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);assert.equal(n.length,1,label);await act(async()=>n[0].props.onPress());}
(async()=>{
 settings={...settingsDefault,opacity:.3,elements:{attack:{x:.3,y:.2,scale:1.2,opacity:.6},joystick:{x:.8,y:.6,scale:1,opacity:.5}}};
 await render();assert.equal(one('tutorial-instruction').props.text,instructions.TUTORIAL_INSTRUCTIONS.move.text);assert.equal(all(n=>n.props.testID==='tutorial-highlight-joystick').length,1);assert.equal(all(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Continuar').length,0);
 const area=geometry.controlArea(844,390,{left:0,right:0,top:0,bottom:0}),box=geometry.elementBox('joystick',geometry.resolveElementLayout(settings,area).joystick,area),highlight=one('tutorial-highlight-joystick');const style=Object.assign({},...highlight.props.style);assert.equal(style.left,Math.max(0,box.x-4));assert.equal(style.top,Math.max(0,box.y-4));assert.equal(highlight.props.pointerEvents,'none');
 const initialCalls=rnCalls;survival.value={...survival.value,clockMs:16};player.value={x:120,y:100};await react();assert.equal(rnCalls,initialCalls,'Movement and animation frames do not reconstruct the instructional React tree');
 await step('hud');await press('Continuar');await press('Continuar');assert.equal(continued,1,'Duplicate Continue presses cannot skip milestones');
 await step('charge');await press('Continuar');assert.equal(continued,2);assert.equal(all(n=>n.props.testID==='tutorial-highlight-frenesis').length,1);
 for(const s of ['dummy','wave','dash','activate','teleport','spin']){await step(s);assert.equal(all(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Continuar').length,0,'Interactive milestone '+s+' requires its actual action');}
 await render({visible:false});assert.equal(container.root.length,0,'Paused/hidden tutorial has no cards, buttons or highlighted touch overlays');await render({visible:true});await press('Saltar');await press('Saltar');assert.equal(exited,1);
 await step('finish');assert.equal(completed,1);assert.equal(all(n=>n.props.testID==='tutorial-completed').length,1);await render();assert.equal(completed,1);await press('Iniciar partida');await press('Iniciar partida');assert.equal(started,1);assert.equal(completed,1);
 await act(async()=>renderer.updateContainer(null,fiber,null,()=>{}));assert.equal(reactions.size,0);
 console.log(`Tutorial HUD passed: ${layouts} landscape/inset instruction placements, actual customized control highlight, no per-frame React updates, interactive/informational steps, duplicate-button guards, pause cleanup and one-shot completion.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
