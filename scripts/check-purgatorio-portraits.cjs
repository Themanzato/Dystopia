/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();let ratio=1,draws=[],surfaces=[];
const image={kind:'original-gallery-image'};
const jsx=(type,props)=>({type,props});
function load(relative){const f=path.resolve(root,relative);if(cache.has(f))return cache.get(f).exports;const module={exports:{}};cache.set(f,module);const code=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:id=>{
 if(id==='react')return {useMemo:fn=>fn()};
 if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(id==='react-native')return {Image:'Image',View:'View',Platform:{OS:'web'},PixelRatio:{get:()=>ratio}};
 if(id==='./loadingImages')return {useLoadingImage:()=>({image,error:false})};
 if(id==='@shopify/react-native-skia')return {FilterMode:{Nearest:'nearest'},MipmapMode:{None:'none'},rect:(x,y,width,height)=>({x,y,width,height}),Skia:{Color:c=>c,Surface:{Make:(width,height)=>{
  const record={width,height,disposed:false,snapshotDisposed:false};surfaces.push(record);return {getCanvas:()=>({clear:c=>assert.equal(c,'transparent'),drawImageRectOptions:(original,source,destination,filter,mipmap)=>{draws.push({record,original,source,destination,filter,mipmap})}}),flush(){},makeImageSnapshot:()=>({encodeToBase64:()=>String(surfaces.length),dispose:()=>record.snapshotDisposed=true}),dispose:()=>record.disposed=true};
 }}}};
 assert(id.startsWith('.'));const target=path.resolve(path.dirname(f),id);return id.endsWith('.png')?target:load(path.relative(root,target+(fs.existsSync(target+'.ts')?'.ts':'.tsx')));
}},{filename:f});return module.exports;}
const native=load('src/ui/PurgatorioPortrait.tsx').default,web=load('src/ui/PurgatorioPortrait.web.tsx').default;
const {LOADING_ENTITIES}=load('src/ui/loadingCatalog.ts');const {PURGATORIO_ROSTER:R}=load('src/game/purgatorio.ts');
for(ratio of [1,2,3])for(const id of [...R,'archer-bandit']){
 const entity=LOADING_ENTITIES.find(e=>e.id===id),before=draws.length;let tree=native({id});assert.equal(draws.length,before+1);const d=draws.at(-1),b=entity.bounds;
 assert.equal(d.record.width,96*ratio);assert.equal(d.record.height,68*ratio);assert.equal(d.original,image);assert.equal(d.filter,'nearest');assert.equal(d.mipmap,'none');assert.equal(d.source.x,b.x);assert.equal(d.source.y,entity.row*entity.cell.height+b.y);assert.equal(d.source.width,b.width);assert.equal(d.source.height,b.height);
 assert(Number.isInteger(d.destination.width/b.width));assert.equal(d.destination.width/b.width,d.destination.height/b.height);assert(d.destination.x>=0&&d.destination.y>=0);assert(d.destination.x+d.destination.width<=d.record.width&&d.destination.y+d.destination.height<=d.record.height);assert(d.record.disposed&&d.record.snapshotDisposed);assert.equal(tree.props.children.type,'Image');assert(tree.props.children.props.source.uri.startsWith('data:image/png;base64,'));
 native({id});assert.equal(draws.length,before+1,'Same physical-size portrait reuses cached raster');
 tree=web({id});const viewport=tree.props.children,img=viewport.props.children,png=fs.readFileSync(entity.source);const styles=Object.assign({},...img.props.style);
 assert.equal(styles.imageRendering,'pixelated');const scale=viewport.props.style.width/b.width;assert.equal(styles.width,png.readUInt32BE(16)*scale);assert.equal(styles.height,png.readUInt32BE(20)*scale);assert.equal(styles.left,-b.x*scale);assert.equal(styles.top,-(entity.row*entity.cell.height+b.y)*scale);assert.equal(img.props.source,entity.source);assert.equal(viewport.props.style.overflow,'hidden');
}
const pair=load('src/ui/PurgatorioEncounterPortrait.tsx').default;
for(ratio of [1,2,3]){
 const group=pair({id:'dagger-bandit',width:150,height:68});assert.equal(group.props.testID,'bandit-pair-preview');
 assert.deepEqual(JSON.parse(JSON.stringify(group.props.children.map(c=>c.props.id))),['archer-bandit','dagger-bandit']);
 const physicalHeights=[];for(const child of group.props.children){child.type(child.props);physicalHeights.push(draws.at(-1).destination.height);}
 assert.equal(physicalHeights[0],physicalHeights[1],'Both original bodies share one physical pixel scale and aligned feet');
 const webHeights=group.props.children.map(child=>web(child.props).props.children.props.style.height);
 assert.equal(webHeights[0],webHeights[1]);
}
console.log('Purgatorio portraits passed: all14 original sources, native physical-pixel nearest sampling at DPR1/2/3, bounded cached surfaces/disposal and proportional web alpha crops with original PNG dimensions. Native rendering API mocked; actual web gallery reviewed separately.');