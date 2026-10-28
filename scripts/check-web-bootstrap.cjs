/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const project = path.resolve(__dirname, '..');
const source = relative => fs.readFileSync(path.join(project, relative), 'utf8');
const resolveWeb = (parent, id) => {
  const target = path.resolve(path.dirname(parent), id);
  return ['.web.tsx','.web.ts','.tsx','.ts','.png','.wav','.mp3'].map(ext => target+ext).find(file => fs.existsSync(file))
    ?? (fs.existsSync(target) ? target : null);
};

// Match Metro's platform resolution and TypeScript's emitted runtime imports.
// Do not follow import() lazy boundaries: WithSkiaWeb awaits CanvasKit there.
const visited = new Set();
function inspect(file, chain = []) {
  if (visited.has(file) || !/\.tsx?$/.test(file)) return;
  visited.add(file);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const ast = ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true);
  for (const node of ast.statements) {
    if (!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
    const id = node.moduleSpecifier.text;
    assert(!id.startsWith('@shopify/react-native-skia') || id.endsWith('/web'),
      'Eager Skia initialization before CanvasKit: '+[...chain,path.relative(project,file),id].join(' -> '));
    if (!id.startsWith('.')) continue;
    const child = resolveWeb(file,id);
    assert(child,'Missing runtime import '+id+' in '+file);
    inspect(child,[...chain,path.relative(project,file)]);
  }
}
for (const name of fs.readdirSync(path.join(project,'src/app'))) {
  if(name.endsWith('.tsx')) inspect(path.join(project,'src/app',name));
}

const cache = new Map();
let uri='https://assets.test/icon.png',localUri=null,prefetchResult=true,prefetchCalls=[];
let afterPrefetch=()=>{};
function load(relative) {
  const filename = path.join(project,relative);
  if(cache.has(filename))return cache.get(filename).exports;
  const module={exports:{}};cache.set(filename,module);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,
  }}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>{
    if(id==='react'||id==='react/jsx-runtime')return require(id);
    if(id==='react-native')return filename.endsWith('prepareImage.web.ts')?{Image:{prefetch:async target=>{prefetchCalls.push(target);afterPrefetch();return prefetchResult;}}}:{Image:'Image',View:'View'};
    if(id==='expo-asset')return{Asset:{fromModule:()=>({downloadAsync:async()=>({uri,localUri})})}};
    assert(!id.startsWith('@shopify/react-native-skia'),'Web icons never import Skia');
    const child=resolveWeb(filename,id);assert(child,'Missing '+id);
    if(child.endsWith('.png'))return child;
    return load(path.relative(project,child));
  }},{filename});
  return module.exports;
}
const {default:Icon}=load('src/ui/UpgradeIcon.web.tsx');
const registry=load('src/ui/rewardIcons.ts');
for(const id of [...Object.keys(registry.REWARD_ICON_SOURCES),'field-kit','attack-servo','assault-boots','frenesis-coil']) {
  const element=Icon({id,size:32}),image=element.props.children;
  assert.equal(element.props.testID,'upgrade-icon-'+registry.rewardIconId(id));
  assert.equal(image.props.source,registry.rewardIconSource(id));
  assert.equal(image.props.resizeMode,'contain');
  assert.equal(image.props.style[0].imageRendering,'pixelated');
  assert.equal(image.props.fadeDuration,0);
}
assert(!source('src/ui/UpgradeIcon.web.tsx').includes("from './sharedImages'"));
assert(React.isValidElement(Icon({id:'magnet',size:28})));
const {prepareImage}=load('src/ui/prepareImage.web.ts');
(async()=>{
  await prepareImage(1);assert.deepEqual(prefetchCalls,[uri]);
  localUri='blob:ready';await prepareImage(1);assert.equal(prefetchCalls.at(-1),localUri);
  const before=prefetchCalls.length;
  await assert.rejects(prepareImage(1,()=>true),/venci/);assert.equal(prefetchCalls.length,before);
  let expired=false;afterPrefetch=()=>{expired=true;};await assert.rejects(prepareImage(1,()=>expired),/venci/);
  afterPrefetch=()=>{};prefetchResult=false;await assert.rejects(prepareImage(1),/preparar/);
  prefetchResult=true;uri='';localUri=null;await assert.rejects(prepareImage(1),/ubicaci/);
  console.log('Web bootstrap passed: eager route imports never initialize Skia before CanvasKit; browser upgrade icons share the original registry and nearest sampling; browser preparation checks downloads, local URI, failures and cancellation without native Skia.');
})().catch(error=>{console.error(error);process.exitCode=1;});
