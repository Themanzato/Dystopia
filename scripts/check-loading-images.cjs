/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript');
const React = req('react');
const Reconciler = req('react-reconciler');
const { sksgHostConfig } = req('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const sourceIds = new Map();
Module._extensions['.png'] = (module, filename) => {
  assert(fs.existsSync(filename));
  if (!sourceIds.has(filename)) sourceIds.set(filename, sourceIds.size + 1);
  module.exports = sourceIds.get(filename);
};
const { LOADING_ENTITIES } = req('./src/ui/loadingCatalog.ts');
const { LOADING_BANNER } = req('./src/ui/loadingArt.ts');
const gallerySources = LOADING_ENTITIES.map(entity => entity.source);
const calls = { from: [], download: [], network: [], read: [], decode: [], dispose: [] };
const assets = new Map(), pendingDownloads = new Map(), failDecode = new Set(), failRead = new Set();
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const expo = { Asset: { fromModule(source) {
  calls.from.push(source);
  if (!assets.has(source)) assets.set(source, {
    uri: `remote:${source}`, localUri: null, downloaded: false,
    async downloadAsync() {
      calls.download.push(source);
      if (!this.downloaded) {
        calls.network.push(source);
        const wait = deferred(); pendingDownloads.set(source, wait);
        await wait.promise;
        this.downloaded = true;
        // Web may keep localUri null; the hook must fall back to the asset URI.
        this.localUri = source === 4 ? null : `local:${source}`;
      }
      return this;
    },
  });
  return assets.get(source);
} } };
const skia = { Skia: {
  Data: { async fromURI(uri) {
    calls.read.push(uri);
    const source = Number(uri.split(':')[1]);
    if (failRead.delete(source)) throw new Error('Fixture data failure');
    return { source, dispose() { calls.dispose.push(source); } };
  } },
  Image: { MakeImageFromEncoded(data) {
    calls.decode.push(data.source);
    return failDecode.delete(data.source) ? null : { source: data.source, decoded: true };
  } },
} };
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'expo-asset') return expo;
  if (name === '@shopify/react-native-skia') return skia;
  return originalLoad.call(this, name, parent, main);
};
const { useLoadingImage, preloadLoadingImages } = req('./src/ui/loadingImages.ts');
const renderer = Reconciler({ ...sksgHostConfig, createTextInstance: text => ({ type: '#text', props: { text }, children: [] }) });
function harness() {
  const container = { root: [], redraw() {} };
  const root = renderer.createContainer(container, 0, null, false, null, '', error => { throw error; }, null);
  const snapshots = [];
  function Probe({ source }) {
    const result = useLoadingImage(source);
    snapshots.push({ source, ...result });
    return React.createElement('ImageProbe', result);
  }
  return {
    snapshots,
    get current() { return snapshots[snapshots.length - 1]; },
    update: async source => { await act(async () => renderer.updateContainer(React.createElement(Probe, { source }), root, null)); },
    unmount: async () => { await act(async () => renderer.updateContainer(null, root, null)); },
  };
}
async function finish(source, reject = false) {
  const wait = pendingDownloads.get(source);
  assert(wait, `Missing requested source ${source}`);
  await act(async () => {
    if (reject) wait.reject(new Error('Fixture download failure')); else wait.resolve();
    await Promise.resolve();
  });
}
const count = (list, value) => list.filter(item => item === value).length;
(async () => {
  const preparation = preloadLoadingImages(1);
  const concurrentPreparation = preloadLoadingImages(1);
  let prepared = false;
  void preparation.then(() => { prepared = true; });
  assert.deepEqual(calls.from, [1, LOADING_BANNER], 'Preloading resolves only the selected monster and the shared advice banner');
  assert.deepEqual(calls.download, [1, LOADING_BANNER], 'Concurrent preparation shares both requests');
  assert.equal(new Set(calls.from).size, 2, 'Preloading never pulls in unrelated monsters');
  const first = harness(), concurrent = harness(), bannerConsumer = harness();
  await bannerConsumer.update(LOADING_BANNER);
  assert.equal(bannerConsumer.current.image, null);
  await first.update(1); await concurrent.update(1);
  assert.deepEqual(calls.from, [1, LOADING_BANNER], 'Mounted consumers share the existing preload asset resolutions');
  assert.deepEqual(calls.download, [1, LOADING_BANNER], 'Mounted consumers share the existing preload download requests');
  assert.equal(first.current.image, null); assert.equal(concurrent.current.error, false);
  const firstRenders = first.snapshots.length;
  await first.unmount();
  await finish(1);
  assert.equal(first.snapshots.length, firstRenders, 'Completing a pending load does not render an unmounted consumer');
  assert.equal(concurrent.current.image.source, 1);
  assert.equal(count(calls.decode, 1), 1, 'Concurrent consumers share exactly one decoded SkImage');
  assert.deepEqual(calls.read, ['local:1'], 'Downloaded native assets use their cached local URI');
  assert.equal(prepared, false, 'Preparation stays pending until its advice art is also ready');
  await finish(LOADING_BANNER);
  await Promise.all([preparation, concurrentPreparation]);
  assert.equal(prepared, true);
  assert.equal(bannerConsumer.current.image.source, LOADING_BANNER);
  assert.equal(count(calls.decode, LOADING_BANNER), 1, 'The banner shares one decoded SkImage between preload and mounted consumers');
  await bannerConsumer.unmount();
  await concurrent.unmount();
  const revisit = harness();
  await revisit.update(1);
  assert.equal(revisit.snapshots[0].image.source, 1, 'A revisited loading screen receives its decoded image immediately');
  assert.equal(count(calls.from, 1), 1); assert.equal(count(calls.read, 'local:1'), 1);
  assert.equal(count(calls.decode, 1), 1, 'Unmounting never discards successfully decoded loading art');

  // Switching away before decoding must not install the old sprite in the new selection.
  await revisit.update(2);
  assert.equal(revisit.current.image, null, 'A changed source cannot flash the previous sheet');
  await revisit.update(3);
  await finish(2);
  assert.equal(revisit.current.source, 3); assert.equal(revisit.current.image, null);
  assert.equal(revisit.current.error, false, 'An obsolete completion cannot change the new selection');
  await finish(3, true);
  assert.equal(revisit.current.image, null); assert.equal(revisit.current.error, true);
  await revisit.unmount();
  const retry = harness();
  await retry.update(3);
  assert.equal(count(calls.from, 3), 2, 'A rejected request is removed so a later loading screen can retry');
  assert.equal(retry.current.error, false, 'A new attempt clears the prior consumer error');
  await finish(3);
  assert.equal(retry.current.image.source, 3);
  assert.equal(count(calls.decode, 3), 1);

  await retry.update(4); await finish(4);
  assert.equal(retry.current.image.source, 4);
  assert(calls.read.includes('remote:4'), 'Web assets fall back to their URI when no local URI exists');
  failDecode.add(5);
  await retry.update(5); await finish(5);
  assert.equal(retry.current.error, true, 'A null decoder result is treated as a load failure');
  assert.equal(count(calls.dispose, 5), 1, 'Encoded data is released even when image decoding fails');
  await retry.unmount();
  const decodedRetry = harness();
  await decodedRetry.update(5);
  assert.equal(decodedRetry.current.image.source, 5);
  assert.equal(count(calls.network, 5), 1, 'Decode retries reuse Expo cached bytes instead of downloading again');
  assert.equal(count(calls.decode, 5), 2);
  failRead.add(6);
  await decodedRetry.update(6); await finish(6);
  assert.equal(decodedRetry.current.error, true, 'Data-read failures release the screen through its error result');
  await decodedRetry.unmount();
  const readRetry = harness();
  await readRetry.update(6);
  assert.equal(readRetry.current.image.source, 6);
  assert.equal(count(calls.network, 6), 1, 'Read retries also reuse Expo cached bytes');

  for (const source of gallerySources.slice(6)) { await readRetry.update(source); await finish(source); }
  const beforeUnknown = calls.from.length;
  const unknownSource = gallerySources.length + 2;
  assert(!gallerySources.includes(unknownSource) && unknownSource !== LOADING_BANNER);
  await readRetry.update(unknownSource);
  assert.equal(readRetry.current.error, true);
  assert.equal(calls.from.length, beforeUnknown, 'Only audited gallery sources and the advice asset may enter the persistent cache');
  await assert.rejects(preloadLoadingImages(unknownSource), /Unknown loading-gallery asset/);
  assert.equal(calls.from.length, beforeUnknown, 'Preparation also rejects unknown assets before native I/O');
  await readRetry.unmount();
  const cacheReads = calls.read.length, cacheDecodes = calls.decode.length, cacheResolutions = calls.from.length;
  const allCached = harness();
  for (const source of [...gallerySources, LOADING_BANNER]) {
    await allCached.update(source); assert.equal(allCached.current.image.source, source);
  }
  await preloadLoadingImages(gallerySources[0]);
  await preloadLoadingImages(gallerySources[gallerySources.length - 1]);
  assert.equal(calls.from.length, cacheResolutions, 'Revisiting or preparing the cached gallery and banner creates no new asset requests');
  assert.equal(calls.read.length, cacheReads); assert.equal(calls.decode.length, cacheDecodes);
  assert.equal(calls.dispose.length, calls.decode.length, 'Every acquired encoded buffer is released after decode');
  await allCached.unmount();
  console.log('Loading image cache passed: selected-and-banner preloading, selected-only lazy loading, preload/hook concurrent deduplication, persistent bounded decode cache, native/web URI handling, obsolete/unmounted consumer cleanup, download/read/decode retries, Expo cached-byte reuse and encoded-data disposal.');
})().catch(error => { console.error(error); process.exitCode = 1; });