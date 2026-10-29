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


async function finish(h){for(let n=0;n<40;n++){for(const op of h.operations)op.completion.resolve();await flush();}}
async function main(){
 const late=session(),R=late.data.PURGATORIO_ROSTER;late.state();const loading=late.store.loadPurgatorioProgress();assert.equal(loading,late.store.loadPurgatorioProgress());assert.equal(late.reads(),1);
 late.store.recordPurgatorioVictory(R[9]);late.store.recordPurgatorioVictory(R[1]);assert.equal(late.state().progress.cleared.length,2);assert.equal(late.operations.length,0);
 late.read.resolve(JSON.stringify({version:1,cleared:Array.from(R.slice(0,4))}));await loading;await flush();assert.deepEqual(plain(late.state().progress.cleared),[...R.slice(0,4),R[9]],'Late hydration merges exact IDs, not a frontier');assert.equal(late.operations[0].value.version,2);await finish(late);
 const fresh=session();fresh.state();fresh.read.resolve(null);await fresh.store.loadPurgatorioProgress();assert.equal(fresh.operations.length,0);for(const id of R)assert(!fresh.data.canSelectPurgatorio(id,fresh.state().progress),'Every first-run card is locked');
 fresh.store.recordPurgatorioVictory(R[7]);fresh.store.recordPurgatorioVictory(R[7]);await flush();assert.equal(fresh.operations.length,1);assert.deepEqual(plain(fresh.state().progress.cleared),[R[7]]);assert(fresh.data.canSelectPurgatorio(R[7],fresh.state().progress));assert(!fresh.data.canSelectPurgatorio(R[8],fresh.state().progress));
 fresh.operations[0].completion.reject(new Error('write failure'));await flush();assert(fresh.state().error);fresh.store.recordPurgatorioVictory(R[7]);await flush();assert.equal(fresh.operations.length,2,'An idempotent victory retries a failed write');await finish(fresh);assert.equal(fresh.state().error,null);
 const reload=session();reload.state();reload.read.resolve(JSON.stringify(fresh.operations.at(-1).value));await reload.store.loadPurgatorioProgress();assert.deepEqual(plain(reload.state().progress.cleared),[R[7]]);assert.equal(reload.operations.length,0);
 const denied=session();denied.state();denied.store.recordPurgatorioVictory(R[9]);denied.read.reject(new Error('read failure'));await denied.store.loadPurgatorioProgress();await flush();assert.equal(denied.operations.length,0,'An unread save is never replaced');assert(denied.state().error);await flush();denied.read.promise=Promise.resolve(JSON.stringify({version:2,cleared:[R[5]]}));await denied.store.loadPurgatorioProgress();await flush();assert.deepEqual(plain(denied.state().progress.cleared),[R[5],R[9]]);await finish(denied);
 const oldRoster=R.filter(id=>id!=='the-plague'),pair=oldRoster.indexOf('dagger-bandit'),legacy=[...oldRoster.slice(0,pair+1),'archer-bandit',...oldRoster.slice(pair+1)];
 for(let n=0;n<=legacy.length;n++){const h=session();h.state();h.read.resolve(JSON.stringify({version:1,cleared:legacy.slice(0,n)}));await h.store.loadPurgatorioProgress();await flush();assert.deepEqual(plain(h.state().progress.cleared),legacy.slice(0,n).filter(id=>id!=='archer-bandit'));assert(!h.state().progress.cleared.includes('the-plague'),'Adding a new mini boss does not grant it in legacy migration');assert.equal(h.operations[0].value.version,2);await finish(h);}
 const alias=session();alias.read.resolve(JSON.stringify({version:2,cleared:['archer-bandit','dagger-bandit','bogus','skeleton-unarmed',R[12],R[12]]}));await alias.store.loadPurgatorioProgress();assert.deepEqual(plain(alias.state().progress.cleared),['dagger-bandit',R[12]]);assert(alias.data.canSelectPurgatorio('archer-bandit',alias.state().progress));
 for(const raw of ['bad','[]',JSON.stringify({version:99,cleared:[R[0]]})]){const h=session();h.read.resolve(raw);await h.store.loadPurgatorioProgress();assert.equal(h.state().progress.cleared.length,0);assert.equal(h.operations.length,0,'Opening invalid/unknown data does not overwrite it');}
 const bulk=session();bulk.read.resolve(null);await bulk.store.loadPurgatorioProgress();for(const id of [...R].reverse()){bulk.store.recordPurgatorioVictory(id);bulk.store.recordPurgatorioVictory(id);}await finish(bulk);assert.deepEqual(plain(bulk.state().progress.cleared),Array.from(R));assert.deepEqual(bulk.operations.at(-1).value.cleared,Array.from(R));assert(bulk.operations.every(op=>op.key==='@dystopia/purgatorio/v1'),'No wallet, scores, tutorial or mission save is touched');
 console.log('Identification storage passed: all initially locked, independent stable IDs, immediate notification, v1->v2 migration of every legacy prefix, pair alias, async hydration union, dedup/retry, ordered writes, cold reload, malformed data and isolated save key.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
