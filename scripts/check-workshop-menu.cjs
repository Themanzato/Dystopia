/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ts=require('typescript'),React=require('react'),Reconciler=require('react-reconciler');
const {sksgHostConfig}=require('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig'),{act}=React;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.png']=(m,file)=>{assert(fs.existsSync(file));m.exports=file;};
let width=844,height=390,writes=0,exits=0;
const disk=new Map(),session={playing:false,difficulty:'easy',closeSettings:()=>exits++};
const original=Module._load;
Module._load=function(name,parent,main){
 if(name==='react-native')return {View:'View',Pressable:'Pressable',ScrollView:'ScrollView',StyleSheet:{create:x=>x,absoluteFill:{position:'absolute',left:0,right:0,top:0,bottom:0}},useWindowDimensions:()=>({width,height})};
 if(name==='react-native-safe-area-context')return {useSafeAreaInsets:()=>({top:0,right:0,bottom:0,left:0})};
 if(name==='@react-native-async-storage/async-storage')return {__esModule:true,default:{getItem:async key=>disk.get(key)??null,setItem:async(key,value)=>{writes++;disk.set(key,value);}}};
 if(name==='./PixelText')return {__esModule:true,default:p=>React.createElement('PixelProbe',p)};
 if(name==='./PixelBadge')return {__esModule:true,default:p=>React.createElement('BadgeProbe',p)};
 if(name==='./UpgradeIcon')return {__esModule:true,default:p=>React.createElement('IconProbe',p)};
 if(name==='./WorkshopDemonstration')return {__esModule:true,default:p=>React.createElement('PreviewProbe',p)};
 if(name==='./PixelArt')return {UIFrame:({children,...p})=>React.createElement('FrameProbe',p,children)};
 if(name==='./session')return {useSession:()=>session};
 if(name==='./AudioProvider')return {useGameAudio:()=>({playUi(){}})};
 return original.call(this,name,parent,main);
};
const scores=require(root+'/src/game/scores.ts'),shop=require(root+'/src/game/workshop.ts'),store=require(root+'/src/ui/ScoreStorage.ts');
const initial=scores.emptyScoreArchive();initial.economy.cells=600;disk.set(store.SCORE_STORAGE_KEY,JSON.stringify(initial));
const Workshop=require(root+'/src/ui/WorkshopMenu.tsx').default;
const container={root:[],redraw(){}},renderer=Reconciler({...sksgHostConfig,createTextInstance:text=>({type:'#text',props:{text},children:[]})});
const tree=renderer.createContainer(container,0,null,false,null,'',e=>{throw e;},null);
const all=(pred,nodes=container.root)=>nodes.flatMap(n=>[...(pred(n)?[n]:[]),...all(pred,n.children||[])]);
const one=id=>{const n=all(n=>n.props.testID===id)[0];assert(n,'Missing '+id);return n;};
const texts=(nodes=container.root)=>all(n=>n.type==='PixelProbe',nodes).map(n=>n.props.text);
const render=async el=>act(async()=>renderer.updateContainer(el,tree,null));
const click=async id=>act(async()=>{one(id).props.onPress();for(let n=0;n<30;n++)await Promise.resolve();});
const wallet=()=>store.getScores().economy;
(async()=>{
 await store.loadScores();
 for(const size of [[568,320],[667,375],[844,390],[1280,720]]){
  [width,height]=size;await render(React.createElement(Workshop));assert.equal(all(n=>n.type==='PreviewProbe').length,1);
  for(const id of shop.WORKSHOP_IDS){
   const price=one('workshop-price-'+id);assert(texts([price]).includes(String(shop.WORKSHOP_ITEMS[id].cost)));assert(all(n=>n.type==='BadgeProbe'&&n.props.kind==='cell',[price]).length);
   const buy=one('workshop-'+id),face=all(n=>n.type==='FrameProbe',[buy])[0],label=all(n=>n.type==='PixelProbe',[buy])[0];
   const style=Object.assign({},...(Array.isArray(face.props.style)?face.props.style:[face.props.style]));assert.equal(style.height,44);assert.equal(style.alignItems,'center');assert.equal(style.justifyContent,'center');assert.equal(label.props.align,'center');assert.equal(label.props.maxWidth,72);
   const before=store.getScores(),raw=disk.get(store.SCORE_STORAGE_KEY),count=writes;
   await click('workshop-select-'+id);assert.equal(all(n=>n.type==='PreviewProbe')[0].props.id,id);assert.equal(store.getScores(),before);assert.equal(disk.get(store.SCORE_STORAGE_KEY),raw);assert.equal(writes,count,'A demonstration cannot write or buy');
   assert.equal(one('workshop-select-'+id).props.accessibilityState.selected,true);
   const priceStyle=Object.assign({},...one('workshop-price-'+id).props.style.filter(Boolean));
   assert.equal(priceStyle.width,width<740||height<360?88:142,'Price column stays at the right');
  }
 }
 const order=all(n=>String(n.props.testID).startsWith('workshop-card-')).map(n=>n.props.testID);
 await act(async()=>{const b=one('workshop-field-kit');b.props.onPress();b.props.onPress();for(let n=0;n<30;n++)await Promise.resolve();});
 assert.equal(wallet().cells,450);assert.equal(wallet().prepared.length,1);assert(texts().includes('Preparada'));assert.equal(one('workshop-field-kit').props.accessibilityLabel,'Retirar y reembolsar Botiquín de campaña');assert(texts([one('workshop-price-field-kit')]).includes('+150'));
 assert.deepEqual(all(n=>String(n.props.testID).startsWith('workshop-card-')).map(n=>n.props.testID),order,'Purchase does not reorder cards');
 await click('workshop-field-kit');assert.equal(wallet().cells,600);assert.equal(wallet().prepared.length,0);
 for(let pass=0;pass<2;pass++){
  await click('workshop-field-kit');await click('workshop-attack-servo');assert.equal(wallet().prepared.length,2);
  const before=wallet(),count=writes;await click('workshop-assault-boots');assert.equal(wallet(),before);assert.equal(writes,count,'A third purchase cannot charge');
  let equipment;await act(async()=>{equipment=await store.consumePreparedAdvantages('workshop-ui-'+pass,'easy');});assert.deepEqual(equipment,['field-kit','attack-servo']);assert.equal(wallet().prepared.length,0);
  let repeated,retry;await act(async()=>{repeated=await store.consumePreparedAdvantages('workshop-ui-'+pass,'easy');retry=await store.consumePreparedAdvantages('workshop-ui-retry-'+pass,'easy');});
  assert.deepEqual(repeated,equipment,'Repeated start consumes once');assert.deepEqual(retry,[],'A retry cannot reuse a spent advantage');
 }
 assert.equal(wallet().cells,50);const count=writes;await click('workshop-frenesis-coil');assert.equal(wallet().cells,50);assert.equal(writes,count);assert(texts().includes('Faltan 50 Celdas.'));
 session.difficulty='dystopia';await render(React.createElement(Workshop));assert.equal(one('workshop-field-kit').props.disabled,true);assert(texts([one('workshop-status-field-kit')]).includes('Vida única'));await click('workshop-select-field-kit');assert.equal(all(n=>n.type==='PreviewProbe')[0].props.difficulty,'dystopia');
 session.playing=true;await render(React.createElement(Workshop));assert.equal(all(n=>n.type==='PreviewProbe').length,0);assert.equal(all(n=>String(n.props.testID).startsWith('workshop-card-')).length,0);
 await render(null);console.log('Workshop menu passed: real prices/right-hand currency, four responsive layouts, one selected preview/no writes, explicit purchase/double-touch guard, immediate balance/prepared slots, full refund, two-item limit, one-run consumption/retry, insufficient funds and one-life restriction. Renderer/storage simulated; no hardware claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});
