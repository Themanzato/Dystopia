/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Reconciler = require('react-reconciler');
const { sksgHostConfig } = require('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const ids = new Map();
Module._extensions['.png'] = (module, filename) => { if (!ids.has(filename)) ids.set(filename, ids.size + 1); module.exports = ids.get(filename); };
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
let release, failOnce = true, active = 0, peak = 0, encodes = 0, disposed = 0, decodedData = 0;
const downloads = [], decodes = [], prefetches = [], resourceReads = [];
const native = {
  Image: Object.assign(props => React.createElement('Image', props), { async prefetch(uri) { assert(uri.includes(':'),'APK resource names must not reach Image.prefetch');prefetches.push(uri); return true; }, getSize(uri,_success,failure) { resourceReads.push(uri);failure(Error('Unsupported uri scheme for encoded image fetch! uri res:/2131230934')); } }),
  View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', Pressable: 'Pressable',
  Animated: { Image: 'AnimatedImage' }, PixelRatio: { get: () => 2 }, Platform: { OS: 'android' },
  StyleSheet: { create: value => value, absoluteFill: {} }, useWindowDimensions: () => ({ width: 844, height: 390 }),
};
const skia = { FilterMode: { Nearest: 'nearest' }, MipmapMode: { None: 'none' }, rect: (...args) => args, Skia: {
  Color: c => c,
  Data: { async fromURI(uri) { const source = Number(uri.split('_').at(-1)); return { source, dispose() { disposed++; } }; } },
  Image: { MakeImageFromEncoded(data) { decodes.push(data.source); decodedData++; return { source: data.source }; } },
  Surface: { Make: () => ({ getCanvas: () => ({ clear() {}, scale() {}, drawImageRectOptions() {} }), flush() {},
    makeImageSnapshot: () => ({ encodeToBase64() { encodes++; return `raster${encodes}`; }, dispose() {} }), dispose() {} }) },
} };
Module._load = function(name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@shopify/react-native-skia') return skia;
  if (name === './usePixelFlicker') return { usePixelFlicker: () => [1, 1] };
  if (name === 'expo-asset') return { Asset: { fromModule(source) { return { uri: `drawable_resource_${source}`, localUri: `drawable_resource_${source}`,
    async downloadAsync() {
      downloads.push(source); active++; peak = Math.max(peak, active);
      try {
        if (source === blocked) await new Promise(resolve => { release = resolve; });
        if (source === failed && failOnce) { failOnce = false; throw Error('fixture failure'); }
        return this;
      } finally { active--; }
    },
  }; } } };
  return originalLoad.call(this, name, parent, main);
};
const { MENU_ASSETS } = require(root + '/src/ui/menuAssets.ts');
const blocked = MENU_ASSETS.npc, failed = MENU_ASSETS.summoner;
const preparation = require(root + '/src/ui/menuResources.ts');
const MenuPreparation = require(root + '/src/ui/MenuPreparation.tsx').default;
const renderer = Reconciler({ ...sksgHostConfig, createTextInstance: text => ({ type: '#text', props: { text }, children: [] }) });
const container = { root: [], redraw() {} };
const tree = renderer.createContainer(container, 0, null, false, null, '', error => { throw error; }, null);
const find = (predicate, nodes = container.root) => { for (const node of nodes) { if (predicate(node)) return node; const child = find(predicate, node.children || []); if (child) return child; } };
const update = element => act(async () => { renderer.updateContainer(element, tree, null); });
(async () => {
  await update(React.createElement(MenuPreparation, null, React.createElement('MenuProbe')));
  assert(find(n => n.props?.testID === 'menu-preparation'));
  assert(!find(n => n.type === 'MenuProbe'), 'Partial menus never become interactive');
  assert(peak <= 6, 'Startup limits simultaneous jobs to six');
  await act(async () => release());
  assert(!find(n => n.type === 'MenuProbe'));
  const retry = find(n => n.props?.accessibilityLabel === 'Reintentar carga del menú');
  assert(find(n=>n.props?.testID==='menu-preparation-error'),'Startup surfaces the actual failing resource');
  assert(retry, 'A failed resource offers recovery, not an eternal blank button');
  assert(!preparation.isMenuPrepared());
  await act(async () => retry.props.onPress());
  assert(find(n => n.type === 'MenuProbe'), 'Only successful completion reveals the menu');
  assert(preparation.isMenuPrepared());assert.equal(prefetches.length,0,'APK boot uses drawable-aware loading');assert.equal(resourceReads.length,0,'Release resources never reach getSize');for(const letter of require(root+'/src/ui/titleAssets.ts').TITLE_LETTERS)assert.equal(decodes.filter(x=>x===letter.source).length,1,'Title letters decoded with the actual shared loader');
  const { PIXEL_FONT_SOURCE } = require(root + '/src/ui/pixelFontAsset.ts');
  assert.equal(decodes.filter(x => x === PIXEL_FONT_SOURCE).length, 1, 'Font is decoded exactly once before text mounts');
  const { UI_ASSETS } = require(root + '/src/ui/uiAssets.ts');
  const { LOADING_ENTITIES } = require(root + '/src/ui/loadingCatalog.ts');
  for (const source of new Set([...Object.values(UI_ASSETS), ...Object.values(MENU_ASSETS), ...LOADING_ENTITIES.map(e => e.source)])) {
    assert.equal(decodes.filter(x => x === source).length, 1, `Bundled image ${source} decoded once across retries`);
  }
  assert.equal(disposed, decodedData, 'All encoded buffers released');
  const before = { downloads: downloads.length, decodes: decodes.length, prefetches: prefetches.length };
  const pixelModule = require(root + '/src/ui/PixelText.tsx');
  const PixelText = pixelModule.default;
  const preparedLabels=[];await pixelModule.preparePixelLabels([{text:'Bloqueado',size:12}],(c,total)=>preparedLabels.push([c,total]));assert.equal(encodes,1,'Native readiness prewarms the actual PixelText raster cache');assert.deepEqual(preparedLabels,[[0,1],[1,1]]);
  const { UIArtProvider } = require(root + '/src/ui/PixelArtRenderer.tsx');
  const labels = () => React.createElement(UIArtProvider, null, Array.from({ length: 40 }, (_, i) => React.createElement(PixelText, { key: i, text: 'Bloqueado', size: 12, color: i % 2 ? '#fff' : '#aaa' })));
  await update(labels());
  assert.equal(encodes, 1, 'Forty identical labels reuse one raster despite different tints');
  assert.equal(find(n => n.type === 'Image').props.fadeDuration, 0);
  await update(null);
  await update(labels());
  assert.equal(encodes, 1, 'Route remount reuses the same font identity and raster');
  await preparation.prepareMenu();
  assert.deepEqual({ downloads: downloads.length, decodes: decodes.length, prefetches: prefetches.length }, before, 'Warm routes do not perform image I/O or decode work');
  await update(React.createElement(MenuPreparation, null, React.createElement('MenuProbe')));
  assert(!find(n => n.props?.testID === 'menu-preparation'), 'Already-prepared routes never show a loader');
  await update(null);
  // Verify hung operations leave a recoverable state and late completions
  // receive the expiry signal instead of being published as ready.
  const deadlines = new Map(); let timerId = 0;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + '/src/ui/assetDeadline.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports,
    setTimeout(callback, duration) { assert.equal(duration, 20000); deadlines.set(++timerId, callback); return timerId; },
    clearTimeout(id) { deadlines.delete(id); },
  });
  const { assetDeadline } = module.exports;
  assert.equal(await assetDeadline(async () => 'ready'), 'ready'); assert.equal(deadlines.size, 0);
  await assert.rejects(assetDeadline(() => { throw Error('sync failure'); }), /sync failure/); assert.equal(deadlines.size, 0);
  let finishLate, expiry;
  const hung = assetDeadline(expired => { expiry = expired; return new Promise(resolve => { finishLate = resolve; }); });
  const timedOut = assert.rejects(hung, /tardó demasiado/);
  assert.equal(expiry(), false);
  for (const callback of deadlines.values()) callback();
  await timedOut; assert.equal(expiry(), true);
  finishLate('obsolete'); await Promise.resolve(); assert.equal(deadlines.size, 0);
  console.log('Menu preparation passed: real readiness gate, bounded concurrency, failed-resource recovery, decoded UI/font/backdrop/gallery reuse, forty labels sharing one raster and warm navigation with zero image I/O. Native display mocked.');
})().catch(error => { console.error(error); process.exitCode = 1; });
