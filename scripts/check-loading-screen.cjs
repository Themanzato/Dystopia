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
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
};
Module._extensions['.png'] = (module, filename) => {
  assert(fs.existsSync(filename), `The loading screen must use an existing asset: ${filename}`);
  module.exports = filename;
};
const { LOADING_ENTITIES, LOADING_TIPS } = req('./src/ui/loadingCatalog.ts');
const { loadingLayout, loadingFrame, loadingEntrance } = req('./src/ui/loadingPresentation.ts');
let verifiedFrames = 0, verifiedLayouts = 0;
for (const entity of LOADING_ENTITIES) {
  const sources = new Set();
  for (let index = 0; index < entity.frames; index++) {
    const crop = loadingFrame(entity, (index + 0.1) * 1000 / entity.fps);
    assert.equal(crop.width, entity.bounds.width);
    assert.equal(crop.height, entity.bounds.height);
    const columns = entity.columns ?? entity.frames;
    const column = index % columns, row = entity.row + Math.floor(index / columns);
    assert(crop.x >= column * entity.cell.width, 'A frame starts inside its own verified cell');
    assert(crop.x + crop.width <= (column + 1) * entity.cell.width, 'A crop cannot overlap the next sprite');
    assert(crop.y >= row * entity.cell.height);
    assert(crop.y + crop.height <= (row + 1) * entity.cell.height);
    sources.add(`${crop.x},${crop.y}`); verifiedFrames++;
  }
  assert.equal(sources.size, entity.frames, `${entity.name}: every authored frame is reachable`);
  assert.deepEqual(loadingFrame(entity, -100), loadingFrame(entity, 0), 'Negative presentation time stays at the first frame');
  assert.deepEqual(loadingFrame(entity, (entity.frames + 0.1) * 1000 / entity.fps), loadingFrame(entity, 0), 'Animation loops at the authored strip boundary');
  for (const [width, height] of [[667, 375], [844, 390], [932, 430], [1200, 675]]) {
    const layout = loadingLayout(width, height, entity);
    assert(Number.isInteger(layout.scale) && layout.scale >= 1, 'Integer magnification keeps source pixels sharp');
    const bodyWidth = entity.bounds.width * layout.scale, bodyHeight = entity.bounds.height * layout.scale;
    const entranceStart = loadingEntrance(width, layout.x, 0);
    assert(layout.x + entranceStart.x >= width + 20, 'Every sprite begins completely beyond the right edge');
    assert(loadingEntrance(width, layout.x, 16).x < entranceStart.x, 'The creature enters on the first advancing frame, without a delay');
    const halfway = loadingEntrance(width, layout.x, 200);
    assert(halfway.x > 0 && halfway.x < entranceStart.x, 'The entity slides progressively toward its resting position');
    assert.equal(loadingEntrance(width, layout.x, 400).x, 0, 'A complete 400 ms slide settles at the audited composition');
    assert.equal(loadingEntrance(width, layout.x, 60000).x, 0, 'Ambient motion never slides the monster out again');
    assert(Math.abs(halfway.y) <= 3, 'Vertical ambience remains subtle');
    const visibleWidth = Math.min(width, layout.x + bodyWidth) - Math.max(0, layout.x);
    const visibleHeight = Math.min(height, layout.y + bodyHeight) - Math.max(0, layout.y);
    const npc = entity.category === 'Enemigos';
    assert(bodyHeight >= height * (npc ? 0.70 : 0.15) || bodyWidth >= width * (npc ? 0.48 : 0.12), `${entity.name}: the entity remains recognizable at its presentation size`);
    assert(bodyWidth / bodyHeight === entity.bounds.width / entity.bounds.height, 'Uniform scale preserves sprite proportions');
    if (!npc) {
      assert(layout.y + bodyHeight + 3 <= layout.nameY - 10, 'Boss animation stays above its name without overlap');
      const anchor = entity.focusX === undefined ? bodyWidth / 2 : (entity.focusX - entity.bounds.x) * layout.scale;
      assert(Math.abs(layout.x + anchor - (layout.infoLeft + layout.infoWidth / 2)) <= 1, 'Boss body is centered over its name column');
    }
    assert(visibleWidth >= bodyWidth * 0.6 && visibleHeight >= bodyHeight * 0.65, `${entity.name}: enough of the body remains recognizable at ${width}x${height}`);
    if (entity.focusX === undefined) assert(layout.x >= width * 0.45, 'The body keeps the left title area clear');
    else { const focus = layout.x + (entity.focusX - entity.bounds.x) * layout.scale; assert(focus > width * 0.65 && focus < width * 0.95, 'An asymmetrical weapon cannot push the body out of frame'); }
    assert(layout.titleWidth >= width * 0.3 && 28 + layout.titleWidth < layout.infoLeft, 'Large title and entity information have separate reading columns');
    assert(layout.infoLeft >= width * 0.5 && layout.infoLeft + layout.infoWidth <= width, 'Entity copy remains within the screen');
    assert(height - layout.tipTop >= 70 && layout.tipTop >= height * 0.65, 'The diagonal advice panel retains a usable reading area');
    verifiedLayouts++;
  }
}
assert.equal(verifiedFrames, LOADING_ENTITIES.reduce((count, entity) => count + entity.frames, 0));
// Static assets, if added later, must remain static rather than gaining fake frames.
const staticEntity = { ...LOADING_ENTITIES[0], frames: 1, fps: 0 };
assert.deepEqual(loadingFrame(staticEntity, 0), loadingFrame(staticEntity, 60000));

const decoded = new Set(), imageErrors = new Map(), imageSources = new Set();
const frameCallbacks = [], sharedValues = [];
let imageRequests = 0, now = 100000, nextTimer = 1;
const timers = new Map();
const actualDateNow = Date.now, actualSetTimeout = global.setTimeout, actualClearTimeout = global.clearTimeout;
Date.now = () => now;
global.setTimeout = (callback, delay = 0) => {
  const id = nextTimer++;
  timers.set(id, { at: now + Math.max(0, Number(delay) || 0), callback });
  return id;
};
global.clearTimeout = id => timers.delete(id);
async function advance(milliseconds) {
  const end = now + milliseconds;
  let count = 0;
  while (true) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    assert(count++ < 200, 'A loading timer cannot busy-loop');
    now = next[1].at;
    timers.delete(next[0]);
    await act(async () => next[1].callback());
  }
  now = end;
}
const image = { source: 'decoded-original' };
const native = {
  Platform: { OS: 'android' },
  StyleSheet: { create: value => value, absoluteFill: {} },
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  useWindowDimensions: () => ({ width: 844, height: 390 }),
};
const skia = {
  Atlas: 'Atlas', Canvas: 'Canvas', Circle: 'Circle', Fill: 'Fill', Group: 'Group',
  LinearGradient: 'LinearGradient', Path: 'Path', RadialGradient: 'RadialGradient',
  FilterMode: { Nearest: 'nearest', Linear: 'linear' }, MipmapMode: { None: 'none' },
  rect: (x, y, width, height) => ({ x, y, width, height }),
  Skia: {
    RSXform: (scaleX, scaleY, x, y) => ({ scaleX, scaleY, x, y }),
    PathBuilder: { Make: () => ({ moveTo() {}, lineTo() {}, close() {}, detach() { return {}; }, dispose() {} }) },
  },
};
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'react-native') return native;
  if (name === '@shopify/react-native-skia') return skia;
  if (name === 'react-native-reanimated') return {
    useSharedValue(initial) {
      return React.useState(() => {
        const shared = { value: initial, set(next) { this.value = next; } };
        sharedValues.push(shared); return shared;
      })[0];
    },
    useFrameCallback(callback, active) {
      const [frame] = React.useState(() => {
        const value = { active, setActive(next) { this.active = next; } };
        frameCallbacks.push(value); return value;
      });
      frame.callback = callback; return frame;
    },
    View:'AnimatedView',default:{View:'AnimatedView'},useAnimatedStyle:callback=>({get opacity(){return callback().opacity;}}),
    useDerivedValue: callback => ({ get value() { return callback(); } }),
  };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
  if (parent?.filename.endsWith('LoadingScreen.tsx')||parent?.filename.endsWith('BossPresentation.tsx')) {
    if (name === './MenuBackdrop') return { __esModule: true, default: props => { React.useEffect(() => props.onReady(), [props.onReady]); return React.createElement('BackgroundProbe'); } };
    if (name === './loadingImages') return { useLoadingImage(source) {
      const [error, setError] = React.useState(false);
      imageRequests++; imageSources.add(source); imageErrors.set(source, () => setError(true));
      return { image: decoded.has(source) ? image : null, error };
    } };
    if (name === './InfectedTitle') return { __esModule: true, default: props => React.createElement('TitleProbe', props) };
    if (name === './PixelText') return { __esModule: true, default: props => React.createElement('PixelProbe', props) };
    if (name === './PixelArt') return {
      UIFrame: ({ children, ...props }) => React.createElement('FrameProbe', props, children),
      UIOrnament: props => React.createElement('OrnamentProbe', props),
    };
  }
  return originalLoad.call(this, name, parent, main);
};
const Screen = req('./src/ui/LoadingScreen.tsx').default;
const renderer = Reconciler({ ...sksgHostConfig, createTextInstance: text => ({ type: '#text', props: { text }, children: [] }) });
function harness(entity) {
  const container = { root: [], redraw() {} };
  const root = renderer.createContainer(container, 0, null, false, null, '', error => { throw error; }, null);
  const signals = { ready: 0, exited: 0, dismissed: 0 };
  const frameIndex = frameCallbacks.length, sharedIndex = sharedValues.length;
  let props = {
    selection: { entity, tip: LOADING_TIPS[0], tipIndex: 0 }, kind: 'game',
    active: false, presented: false, ready: false, error: null,
    onReady: () => { signals.ready++; }, onExited: () => { signals.exited++; }, onDismiss: () => { signals.dismissed++; },
  };
  const update = async patch => {
    props = { ...props, ...patch };
    await act(async () => renderer.updateContainer(React.createElement(Screen, props), root, null));
  };
  function findAll(predicate, nodes = container.root) {
    const matches = [];
    for (const node of nodes) {
      if (predicate(node)) matches.push(node);
      matches.push(...findAll(predicate, node.children));
    }
    return matches;
  }
  return {
    signals, update, findAll, find: predicate => findAll(predicate)[0],
    get frame() { return frameCallbacks[frameIndex]; },
    get time() { return sharedValues[sharedIndex]; },
    async typographyReady() {
      const text = findAll(node => node.type === 'PixelProbe' && node.props.onReady);
      assert(text.length >= 2, 'The name and advice both contribute font readiness');
      await act(async () => { for (const node of text) node.props.onReady(); });
    },
    unmount: async () => { await act(async () => renderer.updateContainer(null, root, null)); },
  };
}
(async () => {
  // Keep a stale React card mounted while the UI-thread presentation changes.
  const BossPresentation=req('./src/ui/BossPresentation.tsx').default;
  const overlayContainer={root:[],redraw(){}},overlayRoot=renderer.createContainer(overlayContainer,0,null,false,null,'',e=>{throw e;},null);
  const card={id:'shielder',name:'Shielder',entityId:7};
  const live={value:{mode:'playing',presentation:{entityId:7,elapsedMs:500,durationMs:1800},boss:{id:'shielder',entityId:7,hp:10}}};
  await act(async()=>renderer.updateContainer(React.createElement(BossPresentation,{card,survival:live,images:Array(40).fill(image)}),overlayRoot,null));
  const walk=nodes=>nodes.flatMap(n=>[n,...walk(n.children)]);
  const mask=walk(overlayContainer.root).find(n=>n.type==='Group'&&n.props.opacity&&'value'in n.props.opacity).props.opacity;
  assert.equal(mask.value,1);
  const initial=live.value;
  live.value={...initial,presentation:null};assert.equal(mask.value,0,'A queued HUD snapshot cannot resurrect the sprite or shading');
  live.value={...initial,presentation:{...initial.presentation,entityId:8}};assert.equal(mask.value,0,'A later encounter never illuminates the previous card');
  live.value={...initial,boss:{...initial.boss,hp:0}};assert.equal(mask.value,0,'Death clears native presentation');
  live.value={...initial,mode:'dead'};assert.equal(mask.value,0);
  live.value=initial;assert.equal(mask.value,1);
  await act(async()=>renderer.updateContainer(null,overlayRoot,null));assert.equal(mask.value,0,'Unmount invalidates even retained native draws');
  const entity = LOADING_ENTITIES[0], app = harness(entity);
  await app.update({});
  assert.equal(app.signals.ready, 0, 'Featured image, advice banner and bitmap letters participate in real loading');
  assert.equal(imageSources.size, 2, 'Only the selected entity and advice backing are decoded by this screen');
  const banner = [...imageSources].find(source => source !== entity.source);
  assert(banner.endsWith('loading-tip-mist.png') && fs.existsSync(banner), 'The advice uses its generated transparent asset');
  const tick = delta => app.frame.callback({ timeSincePreviousFrame: delta });
  tick(9000); assert.equal(app.time.value, 0, 'An inactive loading screen has no queued-frame work');
  await advance(10000);
  assert.equal(app.signals.exited, 0, 'Time before visual readiness never satisfies the display minimum');
  decoded.add(entity.source);
  await app.update({});
  assert.equal(app.signals.ready, 0, 'An entity alone is insufficient while the advice asset is unavailable');
  decoded.add(banner);
  await app.update({});
  assert.equal(app.signals.ready, 0, 'Images do not release the visual gate before bitmap letters appear');
  await app.typographyReady();
  assert.equal(app.signals.ready, 1);
  await app.update({});
  assert.equal(app.signals.ready, 1, 'Readiness is emitted once per presentation');
  const loadingMask=app.find(n=>n.type==='Group'&&n.props.opacity&&'value'in n.props.opacity);
  assert.equal(loadingMask.props.opacity.value,0,'Awaiting/loading art cannot retain a native Canvas overlay');
  const atlases = app.findAll(node => node.type === 'Atlas');
  assert(atlases.length >= 2, 'Both sprite animation and decorative banner use image rendering');
  assert.deepEqual(atlases[0].props.sampling, { filter: 'nearest', mipmap: 'none' });
  assert.deepEqual(atlases[1].props.sampling, { filter: 'linear', mipmap: 'none' });
  assert.equal(app.find(node => node.type === 'TitleProbe').props.width, loadingLayout(844, 390, entity).titleWidth);
  const texts = app.findAll(node => node.type === 'PixelProbe').map(node => node.props.text);
  assert.deepEqual(texts.sort(), [entity.name, LOADING_TIPS[0], 'Cargando 0%'].sort(), 'Entity name, advice and real preparation percentage remain');
  await app.update({progress:73});assert(app.find(node=>node.props.accessibilityRole==='progressbar'&&node.props.accessibilityValue.now===73));
  await app.update({progress:100,ready:false});assert(app.find(node=>node.props.accessibilityRole==='progressbar'&&node.props.accessibilityValue.now===99),'100% requires real destination readiness');
  assert.equal(app.findAll(node => node.type === 'Text' || node.type === '#text').length, 0, 'Loading typography exclusively uses the UI bitmap font');
  const tip = app.find(node => node.type === 'PixelProbe' && node.props.text === LOADING_TIPS[0]);
  assert(tip.props.dim || tip.props.color, 'Advice is restrained against the dark backing');
  assert.equal(tip.props.flicker, true, 'A few advice letters reproduce the faulty-bulb animation');

  await app.update({ active: true, ready: true, presented: false });
  tick(16); tick(9000);
  assert.equal(app.time.value, 64, 'The creature starts moving during the loading reveal, before the minimum timer');
  await advance(6000);
  assert.equal(app.signals.exited, 0, 'A screen still hidden behind the transition cannot consume its five seconds');
  await app.update({ presented: true });
  assert.equal(app.frame.active, true);assert.equal(loadingMask.props.opacity.value,1);
  tick(9000); assert.equal(app.time.value, 128, 'Finishing the reveal does not reset or stall the creature entrance');
  const renderCount = imageRequests;
  tick(16); tick(9000);
  assert.equal(app.time.value, 208, 'A stalled frame is capped to bounded presentation work');
  assert.equal(imageRequests, renderCount, 'Shared-value animation never reconstructs React per frame');
  const firstCrop = atlases[0].props.sprites.value[0];
  tick(64);
  assert.notDeepEqual(atlases[0].props.sprites.value[0], firstCrop, 'The visible monster advances to its next authored animation cell');
  assert.equal(imageRequests, renderCount, 'Sprite frame changes still do not rebuild React');
  await advance(4800);
  assert.equal(app.signals.exited, 0, 'Prepared gameplay still waits for five complete visible seconds');
  const frozen = app.time.value;
  await app.update({ active: false });
  tick(9000); assert.equal(app.time.value, frozen);
  assert.equal(app.frame.active, false);
  await advance(20000);
  assert.equal(app.signals.exited, 0, 'Background time cannot finish the loading minimum');
  await app.update({ active: true });
  await advance(199);
  assert.equal(app.signals.exited, 0);
  await advance(1);
  assert.equal(loadingMask.props.opacity.value,0,'The native monster and shading clear before navigation, without waiting for unmount');
  assert.equal(app.signals.exited, 1, 'Five visible foreground seconds release an already-prepared destination');
  await advance(20000);
  await app.update({});
  assert.equal(app.signals.exited, 1, 'A later render or elapsed timer cannot dismiss the same loading screen twice');
  await app.unmount();
  tick(9000); assert.equal(app.time.value, frozen, 'Queued frame callbacks cannot advance an unmounted presentation');
  assert.equal(app.frame.active, false);

  const cancelled = harness(entity);
  await cancelled.update({ active: true, ready: true, presented: true });
  await cancelled.typographyReady();
  await advance(1000);
  const cancelledFrame = cancelled.frame;
  const lateTimers = [...timers.values()].map(t=>t.callback);
  await cancelled.unmount();
  await act(async()=>{for(const callback of lateTimers)callback();});
  await advance(10000);
  assert.equal(cancelledFrame.active, false);
  assert.equal(cancelled.signals.exited, 0, 'Unmount cancels pending minimum timers instead of dismissing a later screen');

  const awaitingDestination = harness(entity);
  await awaitingDestination.update({ active: true, ready: false, presented: true });
  await awaitingDestination.typographyReady();
  await advance(6000);
  assert.equal(awaitingDestination.signals.exited, 0, 'The display minimum never substitutes for actual destination readiness');
  await awaitingDestination.update({ ready: true, error: 'Fixture destination load failure' });
  await advance(6000);
  assert.equal(awaitingDestination.signals.exited, 0, 'Real errors remain visible instead of triggering the destination transition');
  const dismiss = awaitingDestination.find(node => node.type === 'Pressable');
  assert(dismiss, 'Destination errors retain a return action');
  dismiss.props.onPress();
  assert.equal(awaitingDestination.signals.dismissed, 1);
  assert.equal(awaitingDestination.findAll(node => node.type === 'Text' || node.type === '#text').length, 0, 'Error copy also uses bitmap typography');
  await awaitingDestination.update({ error: null });
  assert.equal(awaitingDestination.signals.exited, 1, 'A resolved destination error can release an elapsed minimum without restarting it');
  await awaitingDestination.unmount();

  const broken = harness(LOADING_ENTITIES[1]);
  await broken.update({});
  assert.equal(broken.signals.ready, 0);
  await broken.typographyReady();
  await act(async () => imageErrors.get(LOADING_ENTITIES[1].source)(new Error('Fixture featured image failure')));
  assert.equal(broken.signals.ready, 1, 'A failed showcase image releases its art gate rather than trapping destination loading');
  await broken.update({});
  assert.equal(broken.signals.ready, 1);
  await broken.unmount();
  assert.equal(timers.size, 0, 'No loading timers survive screen cleanup');
  console.log(`Loading screen passed: ${verifiedFrames} authored frame crops, ${verifiedLayouts} landscape layouts, nearest sampling, banner/font readiness, bitmap-only minimal copy, advice flicker, shared-value animation, five foreground seconds, transition visibility gating, destination readiness/error handling and unmount cleanup.`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Date.now = actualDateNow;
  global.setTimeout = actualSetTimeout;
  global.clearTimeout = actualClearTimeout;
});