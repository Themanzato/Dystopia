/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
let downloads = 0, decodes = 0, fail = false, voidResult = false;
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
Module._extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
Module._extensions['.png'] = module => { module.exports = 1; };
Module._load = function(name, parent, main) {
  if (name === './sharedImages' && parent?.filename.endsWith('prepareImage.ts')) return {loadSharedImage:()=>{throw Error('Web must not use Android resource loader');}};
  if (name === 'expo-asset') return { Asset: { fromModule() { return { async downloadAsync() { downloads++; return { localUri: 'atlas.png' }; } }; } } };
  if (name === 'react-native') return { Platform:{OS:'web'}, Image: { async prefetch() { decodes++; if (fail) throw Error('decode failed'); return voidResult ? undefined : true; } } };
  return originalLoad.call(this, name, parent, main);
};
const { PIXEL_GLYPHS, PIXEL_FONT_WIDTH, PIXEL_FONT_HEIGHT } = require(path.join(root, 'src/ui/pixelGlyphs.ts'));
const { layoutPixelText, normalizePixelText, pixelFlickerIndices } = require(path.join(root, 'src/ui/pixelTextLayout.ts'));
const { LOADING_ENTITIES, LOADING_TIPS } = require(path.join(root, 'src/ui/loadingCatalog.ts'));
for (const text of [...LOADING_ENTITIES.map(entity => entity.name), ...LOADING_TIPS, 'VEL +68.2% / ATA +74% / x2', 'No se pudo cargar. Reintentar. Volver al menu.', 'ÁÉÍÓÚÑÜ ¿¡!']) {
  for (const character of normalizePixelText(text)) assert(PIXEL_GLYPHS[character], `Unsupported character ${character} in ${text}`);
  for (const width of [160, 230, 360, 620]) {
    const layout = layoutPixelText(text, 18, width);
    assert(layout.height >= 26 && layout.width === width);
    for (const glyph of layout.glyphs) {
      assert(glyph.x >= -0.00001 && glyph.x + glyph.width <= width + 0.00001, `${text} overflows ${width}`);
      assert(glyph.y >= 0 && glyph.y + glyph.height <= layout.height);
    }
    assert.deepEqual(layoutPixelText(text, 18, width), layout, 'Layout is deterministic');
  }
}
for (const [character, glyph] of Object.entries(PIXEL_GLYPHS)) {
  assert(glyph.x >= 0 && glyph.y >= 0 && glyph.x + glyph.width <= PIXEL_FONT_WIDTH && glyph.y + glyph.height <= PIXEL_FONT_HEIGHT, `${character} atlas crop outside bounds`);
}
const centered = layoutPixelText('GHOUL', 18, 200, 'center');
const left = layoutPixelText('GHOUL', 18, 200, 'left');
assert.equal(centered.glyphs[0].x, (200 - (left.glyphs.at(-1).x + left.glyphs.at(-1).width)) / 2);
assert(layoutPixelText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 18, 160).lines > 1, 'Long unbroken names wrap');
assert.equal(layoutPixelText('GHOUL\nSPITTER', 18).lines, 2);
for (let count = 4; count < 80; count++) {
  const indices = pixelFlickerIndices('Consejo de Dystopia', count);
  assert.equal(new Set(indices).size, 2);
  assert(indices.every(index => index >= 0 && index < count));
  assert.deepEqual(indices, pixelFlickerIndices('Consejo de Dystopia', count));
}
const effects = []; let foregroundListener, removed = false, starts = 0, stops = 0, clockStops = 0;
const react = require('react');
Module._load = function(name, parent, main) {
  if (name === 'react') return { ...react, useState: factory => [factory()], useEffect: fn => effects.push(fn) };
  if (name === 'react-native') return {
    Platform: { OS: 'android' }, Easing: { linear: 'linear' },
    AppState: { currentState: 'active', addEventListener: (_event, fn) => { foregroundListener = fn; return { remove() { removed = true; } }; } },
    Animated: { Value: class { interpolate(config) { return config; } stopAnimation() { clockStops++; } },
      timing: (_clock, config) => { assert(config.useNativeDriver); return config; },
      loop: () => ({ start() { starts++; }, stop() { stops++; } }) },
  };
  return originalLoad.call(this, name, parent, main);
};
const { usePixelFlicker } = require(path.join(root, 'src/ui/usePixelFlicker.ts'));
const flickers = usePixelFlicker(true, true);
assert.equal(flickers.length, 2);
const stopFlicker = effects[0](); assert.equal(starts, 1);
foregroundListener('background'); assert.equal(stops, 1);
foregroundListener('active'); assert.equal(starts, 2);
stopFlicker(); assert(removed); assert.equal(stops, 2); assert.equal(clockStops, 1);
usePixelFlicker(false, true); effects[1](); assert.equal(starts, 2, 'Inactive text does not start animations');
Module._load = function(name, parent, main) {
  if (name === './sharedImages' && parent?.filename.endsWith('prepareImage.ts')) return {loadSharedImage:()=>{throw Error('Web must not use Android resource loader');}};
  if (name === 'expo-asset') return { Asset: { fromModule() { return { async downloadAsync() { downloads++; return { localUri: 'atlas.png' }; } }; } } };
  if (name === 'react-native') return { Platform:{OS:'web'}, Image: { async prefetch() { decodes++; if (fail) throw Error('decode failed'); return voidResult ? undefined : true; } } };
  return originalLoad.call(this, name, parent, main);
};
async function run() {
  const assetPath = path.join(root, 'src/ui/pixelFontAsset.ts');
  let font = require(assetPath);
  const one = font.preloadPixelFont(), two = font.preloadPixelFont();
  assert.equal(one, two); await one; await font.preloadPixelFont();
  assert.equal(downloads, 1); assert.equal(decodes, 1);
  delete require.cache[assetPath]; font = require(assetPath); fail = true;
  await assert.rejects(font.preloadPixelFont(), /decode failed/);
  fail = false; voidResult = true;
  await font.preloadPixelFont();
  assert.equal(downloads, 3, 'Failures retry, while web prefetch resolving void is success');
  const webLabels=require(path.join(root,'src/ui/PixelText.web.tsx'));const checkpoints=[];await webLabels.preparePixelLabels([{text:'Guardian',size:18,maxWidth:200},{text:'Archer and Dagger',size:13,maxWidth:240}],(c,total)=>checkpoints.push([c,total]));assert.deepEqual(checkpoints,[[0,2],[1,2],[2,2]]);
  console.log('Pixel font passed: all loading names/tips covered, 61 atlas crops bounded, responsive wrapping/alignment, deterministic sparse flicker, shared preload and retry.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
