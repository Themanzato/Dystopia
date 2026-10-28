/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const requireLocal = id => load(path.relative(project, path.resolve(path.dirname(filename), `${id}.ts`)));
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require: requireLocal }, { filename });
  return module.exports;
}
const { advanceMenuTilt, startMenuGyroscope, menuNpcAt, MENU_NPC_SPOTS } = load('src/ui/menuAmbient.ts');
let tilt = { x: 0, y: 0 };
for (let i = 0; i < 36000; i++) {
  tilt = advanceMenuTilt(tilt, { x: 500, y: -500 }, 1000 / 120);
  assert(Math.abs(tilt.x) <= 18 && Math.abs(tilt.y) <= 12, 'Long-running sensor bias cannot move the city beyond safe bounds');
}
for (let i = 0; i < 1200; i++) tilt = advanceMenuTilt(tilt, { x: 0, y: 0 }, 1000 / 120);
assert(Math.abs(tilt.x) < 0.01 && Math.abs(tilt.y) < 0.01, 'Stationary phone naturally returns to neutral');
for (const elapsed of [0, -100, 16, 1e9]) {
  const result = advanceMenuTilt({ x: 0, y: 0 }, { x: NaN, y: Infinity }, elapsed);
  assert(Number.isFinite(result.x) && Number.isFinite(result.y), 'Invalid sensor input never poisons the transform');
}
const bounded = advanceMenuTilt({ x: 0, y: 0 }, { x: 1, y: 1 }, 1e9);
assert(Math.abs(bounded.x) < 6 && Math.abs(bounded.y) < 6, 'Suspend/resume delta cannot jump parallax');
const frameRateSample = hz => {
  let point = { x: 0, y: 0 };
  for (let i = 0; i < hz; i++) point = advanceMenuTilt(point, { x: 0.1, y: -0.1 }, 1000 / hz);
  return point;
};
assert(Math.abs(frameRateSample(30).x - frameRateSample(120).x) < 0.06, 'Motion is substantially frame-rate independent');
assert.equal(MENU_NPC_SPOTS.length, 4, 'Small fixed pool, no game encounter');
for (let i = 0; i < MENU_NPC_SPOTS.length; i++) {
  const actions = new Set(); let disappearing = false, reappearing = false;
  for (let time = 0; time < 22000; time += 10) {
    const actor = menuNpcAt(time, i);
    if (!actor.visible) disappearing = true;
    else { actions.add(actor.action); if (disappearing) reappearing = true; }
    assert(actor.source.x >= 0 && actor.source.x + 62 <= 682);
    assert(actor.source.y >= 0 && actor.source.y + 33 <= 198);
    assert([0, 1, 4, 5].includes(actor.source.y / 33), 'Only real wake, walk, death and spawn rows');
    assert(Math.abs(actor.x - MENU_NPC_SPOTS[i].x) <= 30, 'Actors remain in their clear street location');
    assert(Math.abs(actor.y - MENU_NPC_SPOTS[i].y) <= 7);
  }
  assert.deepEqual([...actions].sort(), ['death', 'move', 'spawn', 'wake']);
  assert(reappearing, 'NPCs disappear then repeat their authored appearance/death cycle');
}
async function main() {
  const nextTurn = () => new Promise(resolve => setImmediate(resolve));
  let resolveAvailable, added = 0, removed = 0, interval, listener, received = 0;
  const sensor = {
    isAvailableAsync: () => new Promise(resolve => { resolveAvailable = resolve; }),
    setUpdateInterval: ms => { interval = ms; },
    addListener: callback => { added++; listener = callback; return { remove: () => { removed++; } }; },
  };
  const earlyStop = startMenuGyroscope(sensor, () => { received++; });
  earlyStop(); resolveAvailable(true); await nextTurn();
  assert.equal(added, 0, 'Unmount during availability check never leaks a listener');
  const stop = startMenuGyroscope(sensor, () => { received++; });
  resolveAvailable(true); await nextTurn();
  assert.equal(added, 1); assert(interval >= 33, 'Sensor stays at or below 30 Hz');
  listener({ x: 1, y: 2 }); assert.equal(received, 1);
  stop(); assert.equal(removed, 1);
  listener({ x: 1, y: 2 }); assert.equal(received, 1, 'Late callbacks after cleanup are ignored');
  const unavailable = { ...sensor, isAvailableAsync: async () => false };
  startMenuGyroscope(unavailable, () => { received++; }); await nextTurn(); assert.equal(added, 1);
  const denied = { ...sensor, isAvailableAsync: async () => { throw new Error('No motion access'); } };
  startMenuGyroscope(denied, () => { received++; }); await nextTurn(); assert.equal(added, 1);
  console.log('Menu atmosphere checks passed: bounded/damped gyro, stale-gap safety, 30/120 Hz agreement, async listener cleanup, unavailable fallback and four real NPC spawn/wake/walk/death loops.');
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
