/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require('typescript'),React=require('react'),Reconciler=require('react-reconciler');
const {sksgHostConfig}=require('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig'),{act}=React;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.png']=(m,file)=>{assert(fs.existsSync(file));m.exports=file;};
let width=844,height=390,saves=0,claims=0,openedWorkshop=0,retries=0,exits=0,changeDifficulty=0;
const session={difficulty:'dystopia',playing:false,closeSettings(){},openWorkshop(){openedWorkshop++;},setDifficulty(){},start(){},startPurgatorio(){}};
let archive;
const original=Module._load;
Module._load=function(name,parent,main){
 if(name==='react-native')return {View:'View',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',left:0,right:0,top:0,bottom:0}},useWindowDimensions:()=>({width,height})};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,right:0,bottom:0,left:0})};
 if(name==='./PixelText')return {__esModule:true,default:p=>React.createElement('PixelProbe',p)};
 if(name==='./PixelBadge')return {__esModule:true,default:p=>React.createElement('BadgeProbe',p)};
 if(name==='./PixelArt')return {UIFrame:({children,...p})=>React.createElement('FrameProbe',p,children),UIIcon:p=>React.createElement('IconProbe',p)};
 if(name==='./PurgatorioPortrait')return {__esModule:true,default:p=>React.createElement('PortraitProbe',p)};
 if(name==='./PurgatorioProgress')return {usePurgatorioProgress:()=>({progress:{cleared:[]},error:null})};
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
(async()=>{
 for(const size of [[844,390],[667,375],[568,320]]){[width,height]=size;await render(React.createElement(Purgatorio));const copy=texts();assert(copy.includes('Purgatorio infinito'));assert(!copy.includes('Cadena sin fin'));assert(!copy.some(t=>/\d+ encuentros|\d+\/\d+ superados/.test(t)));assert(copy.includes('Dystopia'));assert(!copy.includes('Imposible'));assert.equal(all(n=>n.type==='PortraitProbe').length,0,'Unidentified portraits are not mounted');assert.equal(texts().filter(t=>t==='NO IDENTIFICADO').length,14);const workshop=buttons().find(n=>n.props.accessibilityLabel==='Cambiar mejoras en Taller');assert(workshop);assert(all(n=>n.type==='BadgeProbe'&&n.props.kind==='wrench').length);assert(!copy.includes('Taller'),'Workshop access is an accessible icon');checkNoNpc();
 await render(React.createElement(Difficulty));assert(texts().includes('Fácil')&&texts().includes('Difícil')&&texts().includes('Dystopia'));assert(!texts().some(t=>/ritmo original|Cinco de vida|Más enemigos|resurrección/.test(t)));checkNoNpc();}
 // Legacy individual records remain untouched but never become a public tab.
 archive.rankings['purgatorio-single']=[{id:'legacy'}];const legacy=JSON.stringify(archive.rankings['purgatorio-single']);await render(React.createElement(Scores));const tabs=buttons().filter(n=>n.props.accessibilityRole==='tab').map(n=>n.props.accessibilityLabel);assert.deepEqual(tabs,['Supervivencia','Purgatorio Infinito']);assert.equal(JSON.stringify(archive.rankings['purgatorio-single']),legacy);
 await render(null);archive.missions.progress['first-kill']=1;await render(React.createElement(Missions));assert(!texts().some(t=>/Acumulativa|En progreso/.test(t)));assert(all(n=>n.props.testID==='mission-reward-first-kill').length===1);assert(texts().includes('1/1'));await press('Reclamar Primera baja');assert.equal(claims,1);assert(texts().includes('Reclamada'));checkNoNpc();
 for(const outcome of ['dead','won']){
  await render(null);const s=game.createSurvival(1,'hard',outcome==='won'?{mode:'purgatorio',encounter:'guardian'}:{mode:'survival'});s.mode=outcome;s.stats={npcKills:100,minibossKills:2,bossKills:1,wavesCleared:7,objectivesCompleted:3};s.encounter.wave=8;s.level=5;s.clockMs=123400;
  const shared={value:s},props={survival:shared,runId:'compact-'+outcome,visible:false,onRetry:()=>retries++,onExit:()=>exits++,onChangeDifficulty:()=>changeDifficulty++};const count=saves;
  await render(React.createElement(Results,props));assert.equal(all(n=>n.props.testID==='run-summary').length,0,'The parent death/victory readiness gate is retained');assert.equal(saves,count+1);
  await render(React.createElement(Results,{...props,visible:true}));assert(texts().includes(outcome==='won'?'Victoria':'Derrota'));assert(texts().includes('Oleada alcanzada'));assert(texts().includes('Enemigos eliminados'));assert(texts().includes('103'));assert(!texts().includes('Celdas ganadas'));assert(!texts().includes('Objetivos'));assert(!texts().some(t=>/ PTS$/.test(t)));checkNoNpc();
  await press('Mostrar más');assert(all(n=>n.props.testID==='run-details-modal').length===1);assert(texts().includes('Puntuación'));assert(texts().includes('Celdas ganadas'));assert(texts().includes('900'));assert(texts().includes('Objetivos'));assert.equal(saves,count+1,'Opening statistics never settles a result again');
  shared.value={...s,stats:{...s.stats,npcKills:9999}};await press('Volver al resumen');assert(all(n=>n.props.testID==='run-details-modal').length===0);assert(texts().includes('103'),'Expanded statistics preserve the immutable terminal result');await press(outcome==='won'?'Volver a intentar':'Reintentar');await press(outcome==='won'?'Salir al menú':'Menú principal');if(outcome==='won')await press('Cambiar de dificultad');assert.equal(saves,count+1);
 }
 assert.equal(retries,2);assert.equal(exits,2);assert.equal(changeDifficulty,1);await render(null);
 console.log('Compact menus passed: Purgatorio title/art without chain counters, icon workshop access, three name-only difficulties, two visible rankings preserving legacy data, mission reward column/claim, immutable compact death/victory results + reversible detailed statistics, no duplicate settlement and no visible NPC. Rendering mocked at 844/667/568 landscape; not native hardware.');
})().catch(e=>{console.error(e);process.exitCode=1;});
