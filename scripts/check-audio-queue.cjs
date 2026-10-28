/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
let now=0,id=0;const timers=new Map();
function timer(fn,ms){assert.equal(ms,8000);timers.set(++id,{at:now+ms,fn});return id;}
function tick(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
function compile(file,require=()=>{throw Error('Unexpected dependency')}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/ui',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require,setTimeout:timer,clearTimeout:key=>timers.delete(key)});return m.exports;}
const {prepareAudioQueue,AUDIO_PREPARATION_CONCURRENCY}=compile('audioPreparation.ts');assert.equal(AUDIO_PREPARATION_CONCURRENCY,3);
function player(){const listeners=new Set();return {isLoaded:false,currentStatus:{isLoaded:false},listeners,replaceCount:0,replace(){this.replaceCount++;},emit(s){this.isLoaded=s.isLoaded;this.currentStatus=s;for(const cb of [...listeners])cb(s);},addListener(_event,cb){listeners.add(cb);return{remove:()=>listeners.delete(cb)};}};}
const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function setup(n){
 const players=Object.fromEntries(Array.from({length:n},(_,i)=>['sound'+i,player()]));const loads=[],progress=[],failures=[],recoveries=[],defers=[];let completes=0;
 const stop=prepareAudioQueue(players,(p,live)=>new Promise((resolve,reject)=>loads.push({p,live,resolve(){if(live())p.replace();resolve();},reject})),(c,t)=>progress.push([c,t]),()=>completes++,(key,reason)=>failures.push([key,reason]),key=>recoveries.push(key),keys=>defers.push(...keys));
 return {players,loads,progress,failures,recoveries,defers,stop,get completes(){return completes;}};
}
(async()=>{
 // Every native state may be initially false on Android. The total transfer can
 // exceed 8s legitimately; queued entries must never time out before their turn.
 let h=setup(34);await flush();assert.equal(h.loads.length,3);let done=0,maxActive=0;
 while(done<34){const batch=h.loads.slice(done);maxActive=Math.max(maxActive,batch.length);assert(batch.length<=3);tick(900);for(const job of batch){job.resolve();await flush();job.p.emit({isLoaded:true});done++;}await flush();}
 assert(now>8000);assert.equal(h.completes,1);assert.equal(h.progress.at(-1)[0],34);assert.equal(h.failures.length,0);assert.equal(h.defers.length,0);assert.equal(maxActive,3);assert.equal(timers.size,0);h.stop();
 console.log('PASS 34 real readiness transitions, >8s total, <=3 transfers/preparations, no false expiry');
 h=setup(5);await flush();tick(8000);assert.equal(h.completes,1,'Idle fallback cannot freeze scene forever');assert.equal(h.failures.length,0,'Slow files are not decode errors');assert.equal(h.loads.length,3,'A slow transfer does not start 34 concurrent downloads');assert.equal(h.defers.length,5);
 for(let n=0;n<5;n++){const job=h.loads[n];assert(job);job.resolve();await flush();job.p.emit({isLoaded:true});await flush();}
 assert.equal(h.recoveries.length,5);assert.equal(new Set(h.recoveries).size,5);assert.equal(h.completes,1);assert.equal(timers.size,0);h.stop();
 console.log('PASS delayed downloads recover automatically and never permanently disable valid audio');
 h=setup(4);await flush();for(const j of h.loads.slice())j.resolve();await flush();tick(8000);await flush();assert.equal(h.completes,1);assert.equal(h.loads.length,4,'Native preparation timeout frees the bounded slot');for(const j of h.loads){j.resolve();await flush();j.p.emit({isLoaded:true});}assert.equal(h.failures.length,0);assert.equal(h.recoveries.length,4);h.stop();assert.equal(timers.size,0);
 console.log('PASS a delayed Android STATE_READY recovers once after fallback; native stalls do not block queue');
 h=setup(3);await flush();h.loads[0].reject(new Error('missing source'));h.loads[1].p.emit({isLoaded:false,error:'invalid format'});h.loads[2].resolve();await flush();h.loads[2].p.emit({isLoaded:true});assert.equal(h.failures.length,2);assert.equal(h.completes,1);h.stop();
 console.log('PASS genuine file/decode errors remain reported and do not hang the loading fence');
 h=setup(4);await flush();h.stop();const previous=h.progress.length;for(const j of h.loads){j.resolve();j.p.emit({isLoaded:true});}await flush();assert.equal(h.progress.length,previous);assert.equal(h.loads.length,3);assert(h.loads.every(j=>j.p.replaceCount===0));assert.equal(timers.size,0);assert(Object.values(h.players).every(p=>!p.listeners.size));
 console.log('PASS unmount/exit cancels listeners, native replacement, queue and late callbacks');
 const race=player();race.addListener=function(_event,cb){this.listeners.add(cb);this.isLoaded=true;this.currentStatus={isLoaded:true};cb(this.currentStatus);return {remove:()=>this.listeners.delete(cb)};};let raced=0;
 const cancelRace=prepareAudioQueue({race},()=>{throw Error('Already-ready race must not reload');},()=>{},()=>raced++,()=>{},()=>{},()=>{});assert.equal(raced,1);assert.equal(race.listeners.size,0);cancelRace();assert.equal(timers.size,0);
 console.log('PASS synchronous readiness during subscription leaves no listener or unnecessary load');
 const empty=player();empty.currentStatus={isLoaded:true};let invoked=0,readyCount=0;
 const cancelEmpty=prepareAudioQueue({empty},async p=>{invoked++;p.emit({isLoaded:true});},()=>{},()=>readyCount++,()=>{},()=>{},()=>{});assert.equal(readyCount,0,'An empty SDK57 web status must not bypass source loading');await flush();assert.equal(invoked,1);assert.equal(readyCount,1);cancelEmpty();assert.equal(timers.size,0);
 console.log('PASS SDK57 empty-player currentStatus cannot skip real source loading');
 // Test the actual Expo-facing hook, not the passthrough mock in battle UI tests.
 let cleanup,assetResolve;const native=player(),sources=[],assets=[];
 const expo=compile('useQueuedAudioPlayer.ts',name=>{
  if(name==='react')return {useCallback:fn=>fn,useLayoutEffect:fn=>{cleanup=fn();}};
  if(name==='expo-audio')return {useAudioPlayer:(s,o)=>{sources.push([s,o]);return native;}};
  if(name==='expo-asset')return {Asset:{fromModule:source=>{assets.push(source);return {uri:'http://metro/sound.wav',localUri:'file:///cache/sound.wav',downloadAsync:()=>new Promise(resolve=>assetResolve=resolve)};}}};
  throw Error(name);
 });
 const p=expo.useQueuedAudioPlayer(123,{downloadFirst:true,updateInterval:1000});assert.equal(sources[0][0],null);assert.equal(sources[0][1].downloadFirst,false);assert.equal(assets.length,0,'No implicit render-time download');const loading=expo.loadQueuedAudioPlayer(p,()=>true);assert.equal(assets.length,1);assert.equal(native.replaceCount,0);assetResolve();await loading;assert.equal(native.replaceCount,1);cleanup();
 expo.useQueuedAudioPlayer(124,{});let alive=true;const cancelled=expo.loadQueuedAudioPlayer(p,()=>alive);alive=false;cleanup();assetResolve();await cancelled;assert.equal(native.replaceCount,1);
 console.log('PASS SDK57 hook starts empty, resolves the local asset first, then replaces; cancellation never replaces a released player');
})().catch(e=>{console.error(e);process.exitCode=1;});
