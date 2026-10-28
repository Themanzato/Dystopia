/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const original = Module._load;
const react = require('react');
let effects, frames, listeners, queued;
Module._extensions['.ts'] = Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
Module._load = function(name, parent, main) {
  if (name === 'react') return { ...react, useCallback: fn => fn, useEffect: fn => effects.push(fn), useRef: current => ({ current }) };
  if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: (_event, callback) => {
    listeners.push(callback); return { remove() { listeners.splice(listeners.indexOf(callback), 1); } };
  } }, StyleSheet: { create: x => x, absoluteFill: {} } };
  if (name === '@shopify/react-native-skia') return {};
  if (name === 'react-native-reanimated') return {
    useSharedValue: value => ({ value, set(next) { this.value = next; } }),
    useFrameCallback: callback => { const frame = { callback, active: false, setActive(active) { this.active = active; } }; frames.push(frame); return frame; },
  };
  if (name === 'react-native-worklets') return { scheduleOnRN: fn => queued.push(fn) };
  return original.call(this, name, parent, main);
};
const { darknessAt, DARKNESS_COVER_MS, DARKNESS_REVEAL_MS } = require(path.join(root, 'src/ui/darknessMotion.ts'));
assert.deepEqual(darknessAt(0, 'cover'), { opacity: 0, spread: 0, ink: 0, done: false });
assert.deepEqual(darknessAt(DARKNESS_COVER_MS, 'cover'), { opacity: 1, spread: 1, ink: 1, done: true });
assert.deepEqual(darknessAt(0, 'reveal'), { opacity: 1, spread: 1, ink: 1, done: false });
assert.deepEqual(darknessAt(DARKNESS_REVEAL_MS, 'reveal'), { opacity: 0, spread: 0, ink: 0, done: true });
for (const phase of ['cover', 'reveal']) {
  for (let t = -100; t <= 1500; t += 3) {
    const result = darknessAt(t, phase);
    assert.deepEqual(result, darknessAt(t, phase), 'Transition must be deterministic');
    for (const key of ['opacity', 'spread', 'ink']) assert(result[key] >= 0 && result[key] <= 1);
  }
}
for (let t = 1; t <= DARKNESS_COVER_MS; t++) assert(darknessAt(t, 'cover').opacity >= darknessAt(t - 1, 'cover').opacity, 'Fade never jumps backwards');
const { useDarknessClock } = require(path.join(root, 'src/ui/DarknessTransition.tsx'));
function mount(phase = 'cover', active = true) {
  effects = []; frames = []; listeners = []; queued = [];
  let calls = 0;
  const time = useDarknessClock(phase, active, () => { calls++; });
  const cleanup = effects.map(effect => effect()).filter(Boolean);
  const tick = dt => frames[0].callback({ timeSincePreviousFrame: dt });
  return { time, tick, cleanup: () => cleanup.forEach(fn => fn()), calls: () => calls };
}
let instance = mount();
instance.tick(8000); assert.equal(instance.time.value, 0);
instance.tick(16); assert.equal(instance.time.value, 16);
listeners[0]('background'); instance.tick(8000); assert.equal(instance.time.value, 16); assert.equal(frames[0].active, false);
listeners[0]('active'); instance.tick(8000); assert.equal(instance.time.value, 16);
instance.tick(16); assert.equal(instance.time.value, 32);
while (instance.time.value < DARKNESS_COVER_MS) instance.tick(64);
instance.tick(16); assert.equal(queued.length, 1);
instance.tick(64); instance.tick(16); assert.equal(queued.length, 1);
queued.shift()(); assert.equal(instance.calls(), 1);
instance.cleanup(); instance.tick(1000); assert.equal(instance.time.value, DARKNESS_COVER_MS); assert.equal(listeners.length, 0);
instance = mount('reveal'); instance.tick(null);
while (instance.time.value < DARKNESS_REVEAL_MS) instance.tick(64);
instance.tick(16); assert.equal(queued.length, 1);
instance.cleanup(); queued.shift()(); assert.equal(instance.calls(), 0, 'Unmounted transition cannot complete a stale navigation');
instance = mount('cover');
instance.tick(16);for(let i=0;i<100&&!queued.length;i++)instance.tick(64);
assert.equal(queued.length,1);listeners[0]('background');queued.shift()();
assert.equal(instance.calls(),0,'A queued end callback cannot navigate while backgrounded');
listeners[0]('active');assert.equal(instance.calls(),1,'Foregrounding delivers the completed transition exactly once');
instance.cleanup();
instance = mount('cover', false); instance.tick(64); instance.tick(64); assert.equal(instance.time.value, 0); assert.equal(frames[0].active, false); instance.cleanup();
console.log('Darkness transition passed: opaque hand-off, bounded irregular shadows, cover/reveal clocks, background freeze, no resume jump, one completion and stale callback cleanup.');
