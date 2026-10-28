/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/ui/TutorialStorage.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function create(raw=null){const m={exports:{}},writes=[],warnings=[];let disk=raw,fail=false,readFail=false;vm.runInNewContext(code,{module:m,exports:m.exports,console:{warn:m=>warnings.push(m)},require:name=>{assert.equal(name,'@react-native-async-storage/async-storage');return{__esModule:true,default:{getItem:async()=>{if(readFail)throw Error('read');return disk;},setItem:async(key,value)=>{writes.push({key,value});if(fail)throw Error('disk');disk=value;}}};}});return {api:m.exports,writes,warnings,get disk(){return disk;},fail:()=>fail=true,recover:()=>fail=false,readFail:()=>readFail=true};}
const plain=v=>JSON.parse(JSON.stringify(v));
(async()=>{
 const h=create(),api=h.api;
 for(const raw of [null,'broken','null','[]','42','{"completed":"true","skipped":1}'])assert.deepEqual(plain(api.readTutorialProgress(raw)),{version:1,offered:false,skipped:false,completed:false});
 assert(api.shouldOfferTutorial(await api.loadTutorialProgress()));
 await Promise.all([api.markTutorialOffered(),api.markTutorialOffered()]);assert.equal(h.writes.length,1);assert.equal((await api.loadTutorialProgress()).offered,true);assert(!api.shouldOfferTutorial(await api.loadTutorialProgress()));
 await Promise.all([api.markTutorialSkipped(),api.markTutorialSkipped()]);assert.equal(h.writes.length,2);assert.equal((await api.loadTutorialProgress()).skipped,true);assert.equal((await api.loadTutorialProgress()).completed,false);
 const reopened=create(h.disk);assert.equal((await reopened.api.loadTutorialProgress()).skipped,true);assert(!reopened.api.shouldOfferTutorial(await reopened.api.loadTutorialProgress()));
 await Promise.all([api.markTutorialCompleted(),api.markTutorialCompleted()]);assert.equal(h.writes.length,3);assert.equal((await api.loadTutorialProgress()).completed,true);assert.equal((await api.loadTutorialProgress()).skipped,false);
 await api.markTutorialSkipped();assert.equal(h.writes.length,3,'Skip after completion cannot regress or re-save completion');
 const final=create(h.disk);assert.equal((await final.api.loadTutorialProgress()).completed,true);assert(h.writes.every(w=>w.key===api.TUTORIAL_STORAGE_KEY),'Tutorial never touches scores, wallet, missions or equipment storage');
 const quick=create();await Promise.all([quick.api.markTutorialOffered(),quick.api.markTutorialSkipped(),quick.api.markTutorialCompleted()]);assert.equal(JSON.parse(quick.disk).completed,true);assert.equal(JSON.parse(quick.disk).skipped,false);
 const failed=create();failed.fail();await failed.api.markTutorialCompleted();assert.equal((await failed.api.loadTutorialProgress()).completed,true);assert.equal(failed.warnings.length,1);failed.recover();await failed.api.markTutorialCompleted();assert.equal(failed.writes.length,2,'Same explicit action retries a failed disk write');assert.equal(JSON.parse(failed.disk).completed,true);
 const readFailed=create();readFailed.readFail();assert(readFailed.api.shouldOfferTutorial(await readFailed.api.loadTutorialProgress()),'An unavailable save does not prevent training');
 console.log('Tutorial persistence passed: invalid/default saves, separate offer/skip/completed states, reopen, duplicate callbacks, write serialization, retry after failure and independent storage key.');
})().catch(e=>{console.error(e);process.exitCode=1;});
