/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(filename, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = { exports: {}, require: id => {
    assert(id in dependencies, `Unexpected camera dependency: ${id}`);
    return dependencies[id];
  } };
  vm.runInNewContext(code, context, { filename });
  return context.exports;
}
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const cameraFile = process.env.DYSTOPIA_CAMERA_SOURCE || path.join(project, 'src/game/camera.ts');
const map = loadTs(path.join(project, 'src/game/map.ts'));
const api = loadTs(cameraFile, { './map': map });
const { WORLD, CAMERA_START } = map;
const { cameraScale, getCameraBounds, clampCamera, constrainCamera } = api;
const close = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
const same = (a, b) => { close(a.x, b.x); close(a.y, b.y); };
assert.deepEqual(Object.keys(api).sort(), ['cameraScale', 'clampCamera', 'constrainCamera', 'getCameraBounds'].sort(), 'Camera exposes fixed-scale follow helpers only, without drag or zoom');

let samples = 0;
for (const [width, height] of [[844,390], [1280,720], [1024,768], [390,844], [320,180]]) {
  const viewport = { width, height };
  const bounds = getCameraBounds(viewport);
  const scale = cameraScale(viewport);
  assert(scale > 0);
  close(scale, bounds.scale);
  same(clampCamera(CAMERA_START, bounds), constrainCamera(CAMERA_START, viewport));
  // Follow a continuous player trajectory across the world, including coordinates
  // beyond its bounds. The camera uses the current position without accumulated drag.
  for (let i = 0; i <= 100; i++) {
    const player = { x: -WORLD.width / 2 + WORLD.width * 2 * i / 100, y: -WORLD.height / 2 + WORLD.height * 2 * (100 - i) / 100, action: 'run' };
    const camera = clampCamera(player, bounds);
    same(camera, constrainCamera(player, viewport));
    assert.deepEqual(Object.keys(camera).sort(), ['x', 'y']);
    assert(camera.x - width / (2 * scale) >= -0.00001);
    assert(camera.y - height / (2 * scale) >= -0.00001);
    assert(camera.x + width / (2 * scale) <= WORLD.width + 0.00001);
    assert(camera.y + height / (2 * scale) <= WORLD.height + 0.00001);
    if (player.x >= bounds.minX && player.x <= bounds.maxX) close(camera.x, player.x);
    else close(camera.x, player.x < bounds.minX ? bounds.minX : bounds.maxX);
    if (player.y >= bounds.minY && player.y <= bounds.maxY) close(camera.y, player.y);
    else close(camera.y, player.y < bounds.minY ? bounds.minY : bounds.maxY);
    close(cameraScale(viewport), scale);
    samples++;
  }
  // In the interior the character stays at screen center in all eight directions.
  const center = { x: WORLD.width / 2, y: WORLD.height / 2 };
  for (const [dx, dy] of [[25,0],[-25,0],[0,25],[0,-25],[25,25],[25,-25],[-25,25],[-25,-25]]) {
    const player = { x: center.x + dx, y: center.y + dy };
    const camera = clampCamera(player, bounds);
    close(width / 2 + (player.x - camera.x) * scale, width / 2);
    close(height / 2 + (player.y - camera.y) * scale, height / 2);
    same(camera, player);
  }
  // Each edge clamps independently, then responds on the very next inward step.
  const edges = [
    [{ x: -10000, y: center.y }, { x: bounds.minX, y: center.y }, { x: bounds.minX + 1, y: center.y }],
    [{ x: 10000, y: center.y }, { x: bounds.maxX, y: center.y }, { x: bounds.maxX - 1, y: center.y }],
    [{ x: center.x, y: -10000 }, { x: center.x, y: bounds.minY }, { x: center.x, y: bounds.minY + 1 }],
    [{ x: center.x, y: 10000 }, { x: center.x, y: bounds.maxY }, { x: center.x, y: bounds.maxY - 1 }],
  ];
  for (const [outside, expected, inward] of edges) {
    same(clampCamera(outside, bounds), expected);
    same(clampCamera(inward, bounds), inward);
  }
}
// Follow the visual feet (including Frenesis blink) through the shared clamp.
const screen = fs.readFileSync(path.join(project, 'src/game/CourtyardScreen.tsx'), 'utf8');
assert(/useDerivedValue\([\s\S]*?clampCamera\(\{ x: visual\.x \+ \(hit\.x \+ shake\) \/ current\.scale, y: visual\.y \+ \(hit\.y - shake \* 0\.6\) \/ current\.scale \}, current\)/.test(screen), 'Visual player following, damage and phase shake pass through the same camera clamp');
assert(/const flash = survival\.value\.phaseFlashMs \?\? 0/.test(screen) && /Math\.min\(4, flash \/ 100\)/.test(screen), 'Phase shake has a finite simulation lifetime and maximum four screen pixels');
assert(!/Gesture\.(Pan|Pinch)|advancePan|IDLE_PAN/.test(screen), 'Screen camera must not be wired to dragging or zoom gestures');
console.log(`Camera checks passed: ${samples} player positions across 5 viewport sizes, direct follow, all eight directions, fixed scale, world bounds, immediate edge recovery and no drag/zoom API.`);
