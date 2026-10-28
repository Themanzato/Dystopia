/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const original = Module._load;
const effects = [], values = [], frames = [];
let listener, removed = false;
const react = require('react');
Module._extensions['.ts'] = Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
Module._load = function(name, parent, main) {
  if (name === 'react') return { ...react, useCallback: fn => fn, useEffect: fn => effects.push(fn) };
  if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: (_event, callback) => { listener = callback; return { remove() { removed = true; } }; } } };
  if (name === 'react-native-reanimated') return { __esModule: true, default: { View: 'AnimatedView' },
    useSharedValue: initial => { const value = { value: initial, set(next) { this.value = next; } }; values.push(value); return value; },
    useFrameCallback: fn => { const frame = { callback: fn, active: false, setActive(active) { this.active = active; } }; frames.push(frame); return frame; },
  };
  return original.call(this, name, parent, main);
};
const { menuButtonPose } = require(path.join(root, 'src/ui/menuButtonPose.ts'));
for (let index = 0; index < 2; index++) {
  let bursts = 0;
  for (let t = 0; t < 42000; t += 10) {
    const pose = menuButtonPose(t, index);
    assert(Math.abs(pose.x) <= 1.76 && Math.abs(pose.y) <= 1.91 && Math.abs(pose.angle) <= 0.231);
    const base = Math.sin(t / 3100 + index) * 0.65;
    if (Math.abs(pose.x - base) > 0.05) bursts++;
  }
  assert(bursts > 0 && bursts < 200, 'Tremor is occasional, not constant');
}
const { useMenuMotionTime } = require(path.join(root, 'src/ui/MenuMotion.tsx'));
const time = useMenuMotionTime(); const cleanup = effects[0]();
const tick = dt => frames[0].callback({ timeSincePreviousFrame: dt });
tick(9000); assert.equal(time.value, 0);
tick(16); assert.equal(time.value, 16);
listener('background'); tick(9000); assert.equal(time.value, 16);
listener('active'); tick(9000); assert.equal(time.value, 16);
tick(16); assert.equal(time.value, 32);
cleanup(); tick(16); assert.equal(time.value, 32); assert(removed); assert.equal(frames[0].active, false);
console.log('Menu motion passed: gentle bounded float, rare staggered tremors, background/cleanup freeze and no resume catch-up.');
