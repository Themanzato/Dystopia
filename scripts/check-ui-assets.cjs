/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript'), React = req('react');
const cache = new Map(), imageLoads = [], draws = [], surfaces = [];
const imageObjects = new Map();
const imageFor = filename => {
  if (!imageObjects.has(filename)) imageObjects.set(filename, { filename });
  return imageObjects.get(filename);
};
let images, mockState, pixelRatio = 1, disposedSurfaces = 0, disposedSnapshots = 0;
const react = { ...React, createContext: () => ({}), useContext: () => images,
  useMemo: factory => factory(), useState: value => [mockState ?? value, () => {}] };
const skia = {
  FilterMode: { Nearest: 'nearest' }, MipmapMode: { None: 'none' },
  useImage: image => { imageLoads.push(image); return imageFor(image); },
  rect: (x, y, width, height) => ({ x, y, width, height }),
  Skia: { Color: color => color, Surface: { Make: (width, height) => {
    const surface = { width, height, clear: null, scale: null, flushed: false, snapshot: false };
    surfaces.push(surface);
    const id = surfaces.length;
    return {
      getCanvas: () => ({
        clear: color => { surface.clear = color; },
        scale: (x, y) => { surface.scale = [x, y]; },
        drawImageRectOptions: (image, source, destination, filter, mipmap) => draws.push({ image, source, destination, filter, mipmap }),
      }),
      flush: () => { surface.flushed = true; },
      makeImageSnapshot: () => {
        assert(surface.flushed, 'Raster operations are flushed before encoding');
        surface.snapshot = true;
        return { encodeToBase64: () => Buffer.from(`raster${id}`).toString('base64'),
          dispose: () => { disposedSnapshots++; } };
      },
      dispose: () => { disposedSurfaces++; },
    };
  } } },
};
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const requireLocal = id => {
    if (id === './sharedImages') return { useSharedImage: skia.useImage };
    if (id === 'react') return react;
    if (id === 'react-native') return { View: 'View', Image: 'Image', PixelRatio: { get: () => pixelRatio },
      StyleSheet: { create: styles => styles, absoluteFill: {} } };
    if (id === '@shopify/react-native-skia') return skia;
    if (!id.startsWith('.')) return req(id);
    const target = path.resolve(path.dirname(filename), id);
    if (target.endsWith('.png')) return target;
    return load(path.relative(project, `${target}${fs.existsSync(`${target}.ts`) ? '.ts' : '.tsx'}`));
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require: requireLocal }, { filename });
  return module.exports;
}
function readPng(filename) {
  const png = fs.readFileSync(filename), compressed = [];
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8); assert.equal(chunk[9], 6); assert.equal(chunk[12], 0, 'Original non-interlaced RGBA PNG');
    }
    if (type === 'IDAT') compressed.push(chunk);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0, above = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined);
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}
function crop(image, box) {
  assert(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0);
  assert(box.x + box.width <= image.width && box.y + box.height <= image.height, 'Crop fits its own source image');
  const pixels = Buffer.alloc(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const offset = ((box.y + row) * image.width + box.x) * 4;
    image.pixels.copy(pixels, row * box.width * 4, offset, offset + box.width * 4);
  }
  return { width: box.width, height: box.height, pixels };
}
function stats(image) {
  let count = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const colors = new Set();
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const i = (y * image.width + x) * 4;
    const alpha = image.pixels[i + 3];
    assert(alpha === 0 || alpha === 255, 'Original UI pixel art has hard alpha edges');
    if (!alpha) continue;
    count++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    colors.add(image.pixels.subarray(i, i + 4).toString('hex'));
  }
  return { count, box: count ? [minX, minY, maxX - minX + 1, maxY - minY + 1] : null, colors };
}
const plain = value => JSON.parse(JSON.stringify(value));
function imageElement(node) {
  if (!node || typeof node !== 'object') return null;
  assert.notEqual(node.type, 'Canvas', 'Static UI never allocates a per-element GL Canvas');
  if (node.type === 'Image') return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = imageElement(child);
    if (found) return found;
  }
  return null;
}
function rasterElement(output) {
  const view = output.type(output.props);
  assert.equal(view.type, 'View');
  assert.equal(view.props.pointerEvents, 'none', 'Decorative UI raster never steals touches');
  assert.equal(view.props.children.props.pointerEvents, 'none', 'Absolute image wrapper also passes touches through');
  const image = imageElement(view);
  assert(image, 'Static art is displayed with a native Image');
  assert.equal(image.props.accessible, false);
  assert(image.props.source.uri.startsWith('data:image/png;base64,'));
  return { view, image };
}
const { UI_ASSETS, UI_WORD_CROPS, UI_ICON_CROPS, UI_FRAME_CROPS, UI_ORNAMENT_CROP, UI_SLIDER, sliderSource } = load('src/ui/uiAssets.ts');
const components = load('src/ui/PixelArt.tsx');
images = Object.fromEntries(Object.entries(UI_ASSETS).map(([key, filename]) => [key, imageFor(filename)]));
for (const filename of Object.values(UI_ASSETS)) {
  assert(path.relative(project, filename).replaceAll('\\', '/').startsWith('assets/assets/UI/'), 'Every UI image comes from the existing UI folder');
  assert(!/with glow/i.test(filename), 'Unfiltered original art is used');
}
components.UIArtProvider({ children: null });
assert.deepEqual(imageLoads, Object.values(UI_ASSETS), 'Provider loads each original once with static useImage calls');

const wordIndices = { start: 5, settings: 4, resume: 11, mainMenu: 10, back: 8, quit: 3, continue: 1, credits: 6 };
for (const [word, source] of Object.entries(UI_WORD_CROPS)) {
  assert.equal(path.basename(UI_ASSETS[word]), `UI - Words${wordIndices[word]}.png`, 'Correct authored label file');
  const original = readPng(UI_ASSETS[word]);
  assert.equal(original.width, 93); assert.equal(original.height, 33);
  const interior = stats(crop(original, { x: 3, y: 3, width: 87, height: 27 }));
  const expected = [interior.box[0] + 3, interior.box[1] + 3, interior.box[2], interior.box[3]];
  assert.deepEqual([source.x, source.y, source.width, source.height], expected, `${word} includes every glyph pixel and no frame pixels`);
  const result = stats(crop(original, source));
  assert.equal(result.count, interior.count, 'No letter is clipped');
  assert.deepEqual([...result.colors].sort(), [...interior.colors].sort(), 'Crop preserves the complete original glyph palette');
  assert(result.colors.size >= 2 && [...result.colors].every(color => ['abababff', 'c1c1c1ff', 'f5f5f5ff'].includes(color)), 'Original worn lettering is preserved');
  for (const props of [{ word }, { word, scale: 2 }, { word, width: 123 }]) {
    const output = components.UIWord(props);
    assert(Math.abs(output.props.width / output.props.height - source.width / source.height) < 1e-12, 'UIWord preserves authored aspect ratio');
    assert.equal(output.props.width, props.width ?? source.width * (props.scale ?? 1.5));
    draws.length = 0;
    rasterElement(output);
    assert.equal(draws.length, 1);
    assert.deepEqual(plain(draws[0].source), plain(source));
    assert.equal(draws[0].filter, 'nearest'); assert.equal(draws[0].mipmap, 'none');
  }
}
for (const [icon, source] of Object.entries(UI_ICON_CROPS)) {
  const original = readPng(UI_ASSETS[source.sheet]);
  assert.equal(original.width, 32); assert.equal(original.height, 32);
  const entire = stats(original), result = stats(crop(original, source));
  assert.deepEqual([source.x, source.y, source.width, source.height], entire.box, `${icon} crop matches its entire original silhouette`);
  assert.equal(result.count, entire.count, 'All icon pixels fit inside the crop');
  assert.deepEqual([...result.colors].sort(), ['777777ff', 'f5f5f5ff']);
  const output = components.UIIcon({ icon, size: 28 });
  draws.length = 0; rasterElement(output);
  const d = draws[0].destination;
  assert(Math.abs(d.width / d.height - source.width / source.height) < 1e-12, 'Icon is not stretched into a square');
  assert(Math.abs(d.x * 2 + d.width - 28) < 1e-12 && Math.abs(d.y * 2 + d.height - 28) < 1e-12, 'Tightly cropped icon stays centered');
}
const slider = readPng(UI_ASSETS.sliders);
assert.equal(slider.width, UI_SLIDER.sheetWidth); assert.equal(slider.height, UI_SLIDER.sheetHeight);
assert.deepEqual(plain(sliderSource(-1)), { x: 0, y: 16, width: 35, height: 16 });
assert.deepEqual(plain(sliderSource(2)), { x: 420, y: 16, width: 35, height: 16 });
assert.equal(sliderSource(NaN).x, 0);
const sliderHashes = new Set();
for (let frame = 0; frame < 13; frame++) {
  const source = sliderSource(frame / 12);
  assert.equal(source.x, frame * 35); assert.equal(source.y, 16);
  const originalFrame = crop(slider, source), pixels = stats(originalFrame);
  assert(pixels.count > 0);
  assert.deepEqual([...pixels.colors], ['f5f5f5ff']);
  sliderHashes.add(crypto.createHash('sha256').update(originalFrame.pixels).digest('hex'));
  if (frame === 0 || frame === 12) {
    const knob = [];
    for (let x = 2; x < 33; x++) if (originalFrame.pixels[(8 * 35 + x) * 4 + 3]) knob.push(x);
    assert.deepEqual(knob, frame === 0 ? [3, 4, 5, 6, 7] : [27, 28, 29, 30, 31], 'Original left/right knob endpoint, not another slider row');
  }
}
assert.equal(sliderHashes.size, 13, 'Every selected slider position is a genuine distinct authored state');
assert.equal(stats(crop(slider, { x: 455, y: 16, width: 70, height: 16 })).count, 0, 'Do not advance beyond the thirteen authored slider cells');
const sliderOutput = components.UISliderArt({ value: 0.5, width: 140, height: 44 });
draws.length = 0; rasterElement(sliderOutput);
assert.equal(draws[0].source.x, 210); assert.equal(draws[0].source.y, 16);
assert.equal(draws[0].destination.width / draws[0].destination.height, 35 / 16, 'Slider fits without horizontal elongation');
assert.equal(components.UISliderArt({ value: 0.5, width: 140, muted: true }).props.opacity, 0.38);

for (const [variant, frame] of Object.entries(UI_FRAME_CROPS)) {
  const original = readPng(UI_ASSETS[frame.sheet]);
  assert(stats(crop(original, frame)).count > 0);
  assert.equal(stats(crop(original, { x: frame.x + frame.cap, y: frame.y + frame.cap,
    width: frame.width - 2 * frame.cap, height: frame.height - 2 * frame.cap })).count, 0, 'Frame center contains no unrelated decoration');
  for (const [width, height] of [[320, 200], [140, 44], [44, 44], [12, 8]]) {
    const slices = components.nineSlice(frame, width, height, frame.cap, frame.scale);
    assert.equal(slices.length, 9);
    let area = 0;
    for (let i = 0; i < slices.length; i++) {
      const { source: s, destination: d } = slices[i];
      assert(s.x >= frame.x && s.y >= frame.y && s.x + s.width <= frame.x + frame.width && s.y + s.height <= frame.y + frame.height);
      assert(d.x >= 0 && d.y >= 0 && d.x + d.width <= width && d.y + d.height <= height);
      area += d.width * d.height;
      for (let j = i + 1; j < slices.length; j++) {
        const other = slices[j].destination;
        const intersection = Math.max(0, Math.min(d.x + d.width, other.x + other.width) - Math.max(d.x, other.x)) *
          Math.max(0, Math.min(d.y + d.height, other.y + other.height) - Math.max(d.y, other.y));
        assert.equal(intersection, 0, '9-slice regions never overlap');
      }
    }
    assert.equal(area, width * height, `${variant} covers the destination exactly without seams`);
    for (const index of [0, 2, 6, 8]) {
      const { source: s, destination: d } = slices[index];
      assert.equal(s.width, frame.cap); assert.equal(s.height, frame.cap);
      assert.equal(d.width, Math.min(frame.cap * frame.scale, width / 2, height / 2));
      assert.equal(d.width, d.height, 'Corner ornaments remain square');
    }
  }
}
assert(stats(crop(readPng(UI_ASSETS.borders), UI_ORNAMENT_CROP)).count > 0);

// Exercise the real module's private cache through public components. Hook
// memoization is intentionally disabled, so reuse must come from rasterArt.
const rasterWord = width => rasterElement(components.UIWord({ word: 'start', width })).image.props.source.uri;
const firstUri = rasterWord(1000);
let before = surfaces.length;
assert.equal(rasterWord(1000), firstUri);
assert.equal(surfaces.length, before, 'Unchanged UI reuses its encoded raster rather than making another surface');
for (let width = 1001; width <= 1127; width++) rasterWord(width);
before = surfaces.length;
assert.equal(rasterWord(1000), firstUri);
assert.equal(surfaces.length, before, 'Oldest item still fits in the 128-entry cache and is refreshed on access');
rasterWord(1128);
before = surfaces.length;
rasterWord(1001);
assert.equal(surfaces.length, before + 1, 'The 129th unique raster evicts the least recently used entry');
before = surfaces.length;
assert.equal(rasterWord(1000), firstUri);
assert.equal(surfaces.length, before, 'Recently used entries survive eviction');

pixelRatio = 2;
const highDensityUri = rasterWord(125);
assert.equal(surfaces.at(-1).width, 250);
assert.equal(surfaces.at(-1).height, 90, 'Rasters use physical display pixels');
assert.equal(surfaces.at(-1).scale[0], 2); assert.equal(surfaces.at(-1).scale[1], 2);
before = surfaces.length;
assert.equal(rasterWord(125), highDensityUri);
assert.equal(surfaces.length, before, 'High-density raster is also reused');
pixelRatio = 1;
assert.notEqual(rasterWord(125), highDensityUri, 'Cache keys distinguish physical pixel sizes');
before = surfaces.length;
images.start = { filename: UI_ASSETS.start };
rasterWord(125);
assert.equal(surfaces.length, before + 1, 'Different loaded SkImage identities cannot reuse stale source pixels');

mockState = { width: 220, height: 130 };
draws.length = 0;
const frameNode = components.UIFrame({ variant: 'panel', children: 'interactive-content' });
assert.equal(draws.length, 9, 'Frame raster uses nine independent source cells');
assert.equal(frameNode.props.children[1], 'interactive-content', 'Frame preserves its interactive children');
assert.equal(frameNode.props.children[0].props.pointerEvents, 'none');
assert(imageElement(frameNode));
before = surfaces.length;
components.UIFrame({ variant: 'panel', children: 'interactive-content' });
assert.equal(surfaces.length, before, 'Panel layout reuses its completed CPU raster');
mockState = undefined;

assert.equal(disposedSurfaces, surfaces.length, 'Every temporary CPU surface is released');
assert.equal(disposedSnapshots, surfaces.length, 'Every encoded snapshot is released');
for (const surface of surfaces) {
  assert.equal(surface.clear, 'transparent', 'Original alpha is rasterized on transparency');
  assert(surface.flushed && surface.snapshot);
}
for (const draw of draws) { assert.equal(draw.filter, 'nearest'); assert.equal(draw.mipmap, 'none'); }
console.log('UI asset checks passed: original PNG palettes/alpha, eight complete labels, ten centered icons, thirteen authored slider states, proportional nearest raster rendering, seam-free 9-slice corners, physical pixel sizing, bounded 128-entry LRU reuse and released CPU surfaces/snapshots. Static UI uses native Images, not GL Canvases. Native image display is mocked.');
