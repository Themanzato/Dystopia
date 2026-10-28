/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function session() {
  const read = deferred(), operations = [], cache = new Map();
  let reads = 0, notifications = 0;
  const storage = {
    getItem(key) { reads++; assert.equal(key, '@dystopia/purgatorio/v1'); return read.promise; },
    setItem(key, value) {
      const completion = deferred();
      operations.push({ key, value: JSON.parse(value), completion });
      return completion.promise;
    },
  };
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
    }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, require(id) {
      if (id === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
      if (id === 'react') return {
        useEffect(effect) { effect(); },
        useSyncExternalStore(subscribe, getSnapshot) {
          subscribe(() => { notifications++; });
          return getSnapshot();
        },
      };
      assert(id.startsWith('.'), `Unexpected control-settings dependency ${id}`);
      return load(path.relative(root, `${path.resolve(path.dirname(filename), id)}.ts`));
    } }, { filename });
    return module.exports;
  }
  const data = load('src/game/purgatorio.ts'), store = load('src/ui/PurgatorioProgress.ts');
  return { data, store, read, operations, state: () => store.usePurgatorioProgress(),
    reads: () => reads, notifications: () => notifications };
}

async function main(){
 const late=session(),R=late.data.PURGATORIO_ROSTER;late.state();const loading=late.store.loadPurgatorioProgress();assert.equal(loading,late.store.loadPurgatorioProgress());assert.equal(late.reads(),1);
 late.store.recordPurgatorioVictory(R[0]);late.store.recordPurgatorioVictory(R[1]);assert.equal(late.state().progress.cleared.length,2);assert.equal(late.operations.length,0);
 late.read.resolve(JSON.stringify({version:1,cleared:Array.from(R.slice(0,4))}));await loading;await flush();assert.equal(late.state().progress.cleared.length,4,'Late hydration never rolls stored or session progress backward');assert.equal(late.operations.length,1);assert.equal(late.operations[0].value.cleared.length,4);late.operations[0].completion.resolve();await flush();
 const ordered=session();ordered.state();ordered.read.resolve(null);await ordered.store.loadPurgatorioProgress();await flush();assert.equal(ordered.operations.length,0);
 ordered.store.recordPurgatorioVictory(R[3]);assert.equal(ordered.state().progress.cleared.length,0);ordered.store.recordPurgatorioVictory(R[0]);ordered.store.recordPurgatorioVictory(R[0]);ordered.store.recordPurgatorioVictory(R[1]);await flush();assert.equal(ordered.operations.length,1);assert.equal(ordered.operations[0].value.cleared.length,1);assert.equal(ordered.state().progress.cleared.length,2);
 ordered.operations[0].completion.reject(new Error('disk unavailable'));await flush();assert(ordered.state().error);assert.equal(ordered.operations.length,2);assert.equal(ordered.operations[1].value.cleared.length,2);ordered.operations[1].completion.resolve();await flush();assert.equal(ordered.state().error,null);
 const reloaded=session();reloaded.state();reloaded.read.resolve(JSON.stringify(ordered.operations[1].value));await reloaded.store.loadPurgatorioProgress();assert.equal(reloaded.state().progress.cleared.length,2);assert(reloaded.data.canSelectPurgatorio(R[2],reloaded.state().progress));assert(!reloaded.data.canSelectPurgatorio(R[3],reloaded.state().progress));
 const denied=session();denied.state();denied.store.recordPurgatorioVictory(R[0]);denied.read.reject(new Error('unavailable'));await denied.store.loadPurgatorioProgress();await flush();assert.equal(denied.state().progress.cleared.length,1);assert(denied.state().error);assert.equal(denied.operations.length,0,'Read failure never overwrites an unknown existing disk frontier');await flush();denied.read.promise=Promise.resolve(JSON.stringify({version:1,cleared:Array.from(R.slice(0,5))}));await denied.store.loadPurgatorioProgress();await flush();assert.equal(denied.state().progress.cleared.length,5);assert.equal(denied.operations[0].value.cleared.length,5,'Retry preserves older advanced disk progress');denied.operations[0].completion.resolve();await flush();
 for(const raw of ['bad','[]',JSON.stringify({version:1,cleared:[R[2]]})]){const corrupt=session();corrupt.state();corrupt.read.resolve(raw);await corrupt.store.loadPurgatorioProgress();assert.equal(corrupt.state().progress.cleared.length,0);assert(corrupt.data.canSelectPurgatorio(R[0],corrupt.state().progress));}
 const pairIndex=R.indexOf('dagger-bandit'),legacy=[...R.slice(0,pairIndex+1),'archer-bandit',...R.slice(pairIndex+1)];
 for(let size=0;size<=legacy.length;size++){
   const old=legacy.slice(0,size),expected=old.filter(id=>id!=='archer-bandit');
   assert.deepEqual(plain(late.data.readPurgatorioProgress(JSON.stringify({version:1,cleared:old})).cleared),expected,'Every old prefix migrates without losing a unique victory');
 }
 const migrated=session();migrated.state();migrated.read.resolve(JSON.stringify({version:1,cleared:legacy}));await migrated.store.loadPurgatorioProgress();
 assert.deepEqual(plain(migrated.state().progress.cleared),Array.from(R));assert.equal(migrated.operations.length,0,'Reading a valid legacy save never forces an unnecessary overwrite');
 const alias=session();alias.state();alias.read.resolve(JSON.stringify({version:1,cleared:legacy.slice(0,pairIndex)}));await alias.store.loadPurgatorioProgress();
 assert(alias.data.canSelectPurgatorio('archer-bandit',alias.state().progress),'Old selection aliases preserve their original unlock');
 alias.store.recordPurgatorioVictory('archer-bandit');await flush();assert.equal(alias.state().progress.cleared.at(-1),'dagger-bandit');
 const count=alias.state().progress.cleared.length;alias.store.recordPurgatorioVictory('dagger-bandit');assert.equal(alias.state().progress.cleared.length,count,'The two names cannot grant two unlocks');
 assert(!alias.operations[0].value.cleared.includes('archer-bandit'));alias.operations[0].completion.resolve();await flush();
 console.log('Purgatorio storage passed: isolated key, validated contiguous frontier, race-safe hydration, idempotent wins, ordered writes/recovery, cold reload persistence and session fallback on storage errors.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
