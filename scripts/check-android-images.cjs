/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
let os='android',uri='assets_title_letters_d',readFail=false,decodeFail=false,prefetchResult=true,nextId=0,reads=[],prefetches=[],frescoCalls=0,disposed=0;
const native={Platform:{get OS(){return os;}},Image:{
 getSize(_uri,_success,failure){frescoCalls++;failure(Error('Unsupported uri scheme for encoded image fetch! uri res:/2131230934'));},
 prefetch:async value=>{if(!value.includes(':')||value.startsWith('res:')){frescoCalls++;throw Error('Unsupported uri scheme for encoded image fetch! uri res:/2131230934');}prefetches.push(value);return prefetchResult;}
}};
function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{setTimeout,clearTimeout,module:m,exports:m.exports,require(id){
 if(id==='expo-asset')return {Asset:{fromModule:()=>({localUri:uri,uri,downloadAsync:async()=>({localUri:uri,uri})})}};
 if(id==='react')return {};if(id==='react-native')return native;
 if(id==='@shopify/react-native-skia')return {Skia:{Data:{fromURI:async value=>{reads.push(value);assert(!value.startsWith('res:'),'Native Skia receives resource name/id, not Fresco URI');if(readFail)throw Error('missing drawable');return {dispose(){disposed++;}};}},Image:{MakeImageFromEncoded:()=>decodeFail?null:{decoded:true}}}};
 if(id.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(file),id+'.ts')));throw Error(id);
 }},{filename:file});return m.exports;
}
const {prepareImage}=load('src/ui/prepareImage.ts'),shared=load('src/ui/sharedImages.ts');
const prepare=(expired)=>prepareImage(++nextId,expired);
(async()=>{
 await prepare();assert.deepEqual(reads,['assets_title_letters_d']);assert.equal(frescoCalls,0);
 uri='res:/2131230934';await prepare();assert.equal(reads.at(-1),'2131230934');assert.equal(frescoCalls,0,'Exact reported URI bypasses both Fresco APIs');
 uri='res://2131230935';await prepare();assert.equal(reads.at(-1),'2131230935');
 readFail=true;await assert.rejects(prepare(),/missing drawable/);readFail=false;decodeFail=true;await assert.rejects(prepare(),/Cannot decode/);decodeFail=false;
 uri='assets_title_letters_d';const id=++nextId;await prepareImage(id);const count=reads.length;await prepareImage(id);assert.equal(reads.length,count,'Successful resource decode is shared');
 for(const value of ['file:///data/user/0/com.datasaints.dystopia/cache/test.png','http://localhost:8081/assets/test.png','https://example.invalid/test.png']){uri=value;await prepare();assert.equal(prefetches.at(-1),value);assert.equal(shared.skiaResourceUri(value),value);}
 const before=reads.length+prefetches.length;await assert.rejects(prepare(()=>true),/venci/);assert.equal(reads.length+prefetches.length,before);
 let checks=0;await assert.rejects(prepare(()=>++checks>1),/venci/);
 prefetchResult=false;await assert.rejects(prepare(),/No se pudo/);prefetchResult=undefined;os='web';await prepare();os='ios';await prepare();
 uri='';await assert.rejects(prepare(),/ubicaci/);assert(disposed>0);assert.equal(frescoCalls,0);
 console.log('APK regression passed: exact res:/2131230934 and drawable-name startup through real shared Skia loader, Fresco getSize/prefetch configured to reject resources, numeric ID normalization, failed reads/decodes, cache reuse, file/HTTP/web/iOS/deadline paths. Native APIs mocked; not a device test.');
})().catch(e=>{console.error(e);process.exitCode=1;});
