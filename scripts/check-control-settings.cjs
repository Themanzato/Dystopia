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
    getItem(key) { reads++; assert.equal(key, '@dystopia/controls/v1'); return read.promise; },
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
  const data = load('src/ui/controlSettings.ts'), store = load('src/ui/ControlPreferences.ts');
  return { data, store, read, operations, state: () => store.useControlSettings(),
    reads: () => reads, notifications: () => notifications };
}
async function main() {
  const initial = session(), { DEFAULT_CONTROLS, validControlPatch, readControlSettings } = initial.data;
  for (const raw of [null, '', '{broken', '[]', 'null', '3', '"controls"']) {
    assert.deepEqual(plain(readControlSettings(raw)), plain(DEFAULT_CONTROLS));
  }
  for (const value of [null, [], 3, 'controls']) assert.deepEqual(plain(validControlPatch(value)), {});
  assert.deepEqual(plain(validControlPatch({ stickScale: -100, deadZone: 100, opacity: 7, lift: -8, swapped: true, unknown: 42 })),
    { stickScale: 0.85, deadZone: 12, opacity: 1, lift: 0, swapped: true });
  assert.deepEqual(plain(validControlPatch({ stickScale: 100, deadZone: -8, opacity: -100, lift: 100 })),
    { stickScale: 1.15, deadZone: 4, opacity: 0.15, lift: 48 });
  assert.deepEqual(plain(validControlPatch({ stickScale: NaN, deadZone: Infinity, opacity: '0.7', lift: undefined, swapped: 1 })), {});

  assert.equal(readControlSettings('{"opacity":0.4}').hudOpacity,1,'Old settings receive an opaque HUD default');
  assert.deepEqual(plain(validControlPatch({opacity:-3,hudOpacity:4})),{opacity:.15,hudOpacity:1});
  assert.deepEqual(plain(validControlPatch({opacity:.3,hudOpacity:.7})),{opacity:.3,hudOpacity:.7});
  // A user may change controls while native storage is still reading. Disk
  // supplies untouched fields, while every early user edit wins over old data.
  const late = session();
  assert.deepEqual(plain(late.state().settings), plain(DEFAULT_CONTROLS));
  const loading = late.store.loadControls();
  assert.equal(loading, late.store.loadControls()); assert.equal(late.reads(), 1);
  late.store.updateControls({ stickScale: 1.1, opacity: 0.75, swapped: true });
  late.store.updateControls({ stickScale: 1.14, swapped: false });
  assert.equal(late.state().settings.stickScale, 1.14); assert.equal(late.operations.length, 0);
  late.read.resolve(JSON.stringify({ stickScale: 0.9, deadZone: 10, opacity: 0.52, swapped: true, lift: 22 }));
  await loading; await flush();
  assert.deepEqual(plain(late.state().settings), { stickScale: 1.14, deadZone: 10, opacity: 0.75, hudOpacity:1, swapped: false, lift: 22 });
  assert.equal(late.operations.length, 1);
  assert.deepEqual(late.operations[0].value, plain(late.state().settings));
  late.operations[0].completion.resolve(); await flush();
  assert.equal(late.state().error, null); assert(late.notifications() > 0);

  // Writes must begin in order. A rejected write keeps the current session
  // values, reports an error, and cannot poison the next successful write.
  const ordered = session(); ordered.state(); ordered.read.resolve(null);
  await ordered.store.loadControls(); await flush();
  assert.equal(ordered.operations.length, 0, 'Hydrating untouched defaults does not write unnecessarily');
  ordered.store.updateControls({ opacity: 0.6 });
  ordered.store.updateControls({ opacity: 0.8, hudOpacity:.35, lift: 12 });
  await flush(); assert.equal(ordered.operations.length, 1);
  assert.equal(ordered.operations[0].value.opacity, 0.6);
  assert.equal(ordered.state().settings.opacity, 0.8);
  ordered.operations[0].completion.resolve(); await flush();
  assert.equal(ordered.operations.length, 2); assert.equal(ordered.operations[1].value.opacity, 0.8);assert.equal(ordered.operations[1].value.hudOpacity,.35);
  ordered.operations[1].completion.reject(new Error('disk unavailable')); await flush();
  assert.equal(ordered.state().settings.opacity, 0.8); assert.equal(ordered.state().settings.lift, 12);
  assert.match(ordered.state().error, /guardar/);
  ordered.store.updateControls({ swapped: true }); await flush();
  assert.equal(ordered.operations.length, 3); assert.equal(ordered.operations[2].value.swapped, true);
  assert.equal(ordered.operations[2].key, ordered.data.CONTROL_SETTINGS_KEY);
  ordered.operations[2].completion.resolve(); await flush(); assert.equal(ordered.state().error, null);
  ordered.store.updateControls({ ...ordered.data.DEFAULT_CONTROLS }); await flush();
  assert.deepEqual(plain(ordered.state().settings), plain(DEFAULT_CONTROLS));
  assert.deepEqual(ordered.operations[3].value, plain(DEFAULT_CONTROLS));
  ordered.operations[3].completion.resolve(); await flush();

  for (const raw of ['{broken', '{"deadZone":999,"opacity":"bad","swapped":true}', '[]']) {
    const corrupt = session(); corrupt.state(); corrupt.read.resolve(raw);
    await corrupt.store.loadControls(); await flush();
    const result = corrupt.state().settings;
    assert.equal(result.deadZone, raw.includes('999') ? 12 : DEFAULT_CONTROLS.deadZone);
    assert.equal(result.opacity, DEFAULT_CONTROLS.opacity);
    assert.equal(result.swapped, raw.includes('true'));
    assert.equal(corrupt.operations.length, 0);
  }
  const failed = session(); failed.state(); failed.store.updateControls({ lift: 30 });
  failed.read.reject(new Error('read failed')); await failed.store.loadControls(); await flush();
  assert.equal(failed.state().settings.lift, 30); assert.match(failed.state().error, /recuperar/);
  assert.equal(failed.operations.length, 1);
  failed.operations[0].completion.resolve(); await flush();
  assert.equal(failed.state().error, null); assert.equal(failed.state().settings.lift, 30);
  const custom=session();custom.state();custom.read.resolve(null);await custom.store.loadControls();await flush();
  const elements={attack:{x:.3,y:.4,scale:1.2,opacity:.6},vitals:{x:.6,y:.3,scale:.8,opacity:.7},frenesis:{x:.7,y:.8,scale:.9,opacity:.4}};
  custom.store.updateControls({elements,opacity:.8,hudOpacity:.5});await flush();assert.equal(custom.operations.length,1);
  const disk=JSON.stringify(custom.operations[0].value);custom.operations[0].completion.resolve();await custom.store.flushControls();
  const reopened=session();reopened.state();reopened.read.resolve(disk);await reopened.store.loadControls();await flush();assert.deepEqual(plain(reopened.state().settings.elements),elements);assert.equal(reopened.state().settings.opacity,.8);assert.equal(reopened.state().settings.hudOpacity,.5);
  reopened.store.resetControls();await flush();assert.deepEqual(plain(reopened.state().settings),plain(DEFAULT_CONTROLS));assert(!reopened.operations[0].value.elements);assert(!reopened.operations[0].value.layout);reopened.operations[0].completion.resolve();await reopened.store.flushControls();
  const partial=readControlSettings(JSON.stringify({layout:{broken:true},elements:{attack:elements.attack,boss:{x:NaN,y:.5,scale:1,opacity:1}}}));assert.deepEqual(plain(partial.elements.attack),elements.attack);assert(!partial.elements.boss);
  const manual=session();manual.state();manual.read.resolve(null);await manual.store.loadControls();await flush();
  const manualDraft={...DEFAULT_CONTROLS,opacity:.3,elements:{attack:{x:.4,y:.3,scale:1.1,opacity:.65}}};
  let commit=manual.store.saveControls(manualDraft);await flush();assert.equal(manual.operations.length,1);assert.deepEqual(plain(manual.state().settings),plain(DEFAULT_CONTROLS),'Unfinished disk write cannot apply the draft');
  manual.operations[0].completion.reject(Error('disk'));assert.equal(await commit,false);assert.deepEqual(plain(manual.state().settings),plain(DEFAULT_CONTROLS),'Failed Save keeps the previously applied profile');
  commit=manual.store.saveControls(manualDraft);await flush();manual.operations[1].completion.resolve();assert.equal(await commit,true);assert.deepEqual(plain(manual.state().settings),plain(manualDraft));
  commit=manual.store.saveControls({...DEFAULT_CONTROLS,layout:null,elements:null});await flush();assert.equal(manual.state().settings.opacity,.3,'Reset is not applied before successful Save');manual.operations[2].completion.resolve();assert.equal(await commit,true);assert.equal(manual.state().settings.opacity,DEFAULT_CONTROLS.opacity);assert.equal(manual.state().settings.elements,null);
  console.log('Control settings passed: bounds/type rejection; shared hydration; early edits win; corrupt/read-error fallback; ordered persistence; write failure retains settings; subsequent recovery; persisted reset defaults.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });