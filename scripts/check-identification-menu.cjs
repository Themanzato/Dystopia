/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require('typescript'),React=require('react'),Reconciler=require('react-reconciler');
const {sksgHostConfig}=require('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig'),{act}=React;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.png']=(m,file)=>{assert(fs.existsSync(file));m.exports=file;};
let width=844,height=390,saves=0,claims=0,openedWorkshop=0,retries=0,exits=0,changeDifficulty=0;
const session={difficulty:'dystopia',playing:false,closeSettings(){},openWorkshop(){openedWorkshop++;},setDifficulty(){},start(){},startPurgatorio(){}};
let archive,identified={cleared:[]};const observers=new Set(),started=[];session.startPurgatorio=id=>started.push(id);
const original=Module._load;
Module._load=function(name,parent,main){
 if(name==='react-native')return {View:'View',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',left:0,right:0,top:0,bottom:0}},useWindowDimensions:()=>({width,height})};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,right:0,bottom:0,left:0})};
 if(name==='./PixelText')return {__esModule:true,default:p=>React.createElement('PixelProbe',p)};
 if(name==='./PixelBadge')return {__esModule:true,default:p=>React.createElement('BadgeProbe',p)};
 if(name==='./PixelArt')return {UIFrame:({children,...p})=>React.createElement('FrameProbe',p,children),UIIcon:p=>React.createElement('IconProbe',p)};
 if(name==='./PurgatorioPortrait')return {__esModule:true,default:p=>React.createElement('PortraitProbe',p)};
 if(name==='./PurgatorioProgress')return {usePurgatorioProgress:()=>({progress:React.useSyncExternalStore(fn=>{observers.add(fn);return()=>observers.delete(fn);},()=>identified,()=>identified),error:null})};
 if(name==='./session')return {useSession:()=>session};
 if(name==='./AudioProvider')return {useGameAudio:()=>({playUi(){}})};
 if(name==='./ScoreStorage')return {useScores:()=>({archive,ready:true,error:null}),loadScores:async()=>{},claimMission:async id=>{claims++;archive={...archive,missions:{...archive.missions,claimed:[...archive.missions.claimed,id]}};return {ok:true,message:'Recompensa reclamada.'};},saveRunResult:async()=>{saves++;return {earned:42,balance:900};}};
 return original.call(this,name,parent,main);
};
const scores=require(root+'/src/game/scores.ts'),game=require(root+'/src/game/survival.ts');archive=scores.emptyScoreArchive();
const Purgatorio=require(root+'/src/ui/PurgatorioMenu.tsx').default,Difficulty=require(root+'/src/ui/DifficultyMenu.tsx').default,Scores=require(root+'/src/ui/ScoreMenu.tsx').default,Missions=require(root+'/src/ui/MissionMenu.tsx').default,Results=require(root+'/src/ui/RunResultPanel.tsx').default;
const container={root:[],redraw(){}},renderer=Reconciler({...sksgHostConfig,createTextInstance:text=>({type:'#text',props:{text},children:[]})});
const tree=renderer.createContainer(container,0,null,false,null,'',e=>{throw e;},null);
const all=(pred,nodes=container.root)=>nodes.flatMap(n=>[...(pred(n)?[n]:[]),...all(pred,n.children||[])]),texts=()=>all(n=>n.type==='PixelProbe').map(n=>n.props.text),buttons=()=>all(n=>n.type==='Pressable');
const render=async el=>act(async()=>renderer.updateContainer(el,tree,null));
const press=async label=>{const found=buttons().find(n=>n.props.accessibilityLabel===label);assert(found,'Missing '+label);await act(async()=>found.props.onPress());};
function checkNoNpc(){for(const n of all(()=>true)){for(const text of[n.props.text,n.props.accessibilityLabel])if(typeof text==='string')assert(!/\bNPC\b/i.test(text),text);}}

const {PURGATORIO_ROSTER:R,purgatorioName}=require(root+'/src/game/purgatorio.ts');
async function identify(ids){await act(async()=>{identified={cleared:ids};for(const fn of observers)fn();});}
const cards=()=>all(n=>n.type==='FrameProbe'&&Array.isArray(n.props.style)&&n.props.style[0]?.height===164);
const geometry=()=>cards().map(n=>({height:n.props.style[0].height,width:n.props.style[1].width}));
(async()=>{
 for(const size of [[568,320],[667,375],[844,390],[1280,720]]){
  [width,height]=size;await render(null);identified={cleared:[]};await render(React.createElement(Purgatorio));
  assert.equal(texts().filter(t=>t==='NO IDENTIFICADO').length,R.length);assert.equal(texts().filter(t=>t==='?').length,R.length);
  assert.equal(all(n=>n.type==='PortraitProbe').length,0,'No hidden portrait is mounted, including the featured infinite art');
  const serialized=JSON.stringify(container.root);for(const id of R)assert(!serialized.includes(purgatorioName(id)),'A locked name cannot leak through text/accessibility/portrait props');
  const before=geometry();assert.equal(before.length,R.length);assert(before.every(b=>b.width>=100&&b.height===164));
  const pending=started.length;await act(async()=>buttons().find(b=>b.props.testID==='purgatorio-unknown-0').props.onPress());assert.equal(started.length,pending);assert(texts().includes('Derrota a este jefe en Supervivencia o Purgatorio infinito para identificarlo'));await press('Cerrar requisito');
  await identify(['electrocutioner']);assert.equal(texts().filter(t=>t==='NO IDENTIFICADO').length,R.length-1);assert(texts().includes('Electrocutioner'));assert.equal(all(n=>n.type==='PortraitProbe').length,1);assert.deepEqual(geometry(),before,'Unlocking does not move or resize cards');await press('Electrocutioner');assert.equal(started.at(-1),'electrocutioner');
  await identify(['electrocutioner','dagger-bandit']);assert(all(n=>n.props.testID==='bandit-pair-preview').length);assert.equal(texts().filter(t=>t==='NO IDENTIFICADO').length,R.length-2);assert.deepEqual(geometry(),before);await press('Archer and Dagger');assert.equal(started.at(-1),'dagger-bandit');
 }
 await render(null);assert.equal(observers.size,0);console.log('Identification selector passed: all 14 hidden names/portraits/accessibility fields, generic requirement/no start, immediate independent unlocks, real joint preview, unchanged card geometry at 568/667/844/1280 horizontal and subscription cleanup. Mock renderer, no physical-device claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
