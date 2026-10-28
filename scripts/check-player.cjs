/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ts = require('typescript');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
function load(relative, dependencies = {}) {
  const filename = path.join(project, relative);
  const context = { exports: {}, require: id => {
    if (id in dependencies) return dependencies[id];
    if (id === './frenesis') return load('src/game/frenesis.ts', { './collision': collision });
    throw new Error(`Unexpected player dependency: ${id}`);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context, { filename });
  return context.exports;
}
const map = load('src/game/map.ts');
const collision = load('src/game/collision.ts', { './map': map });
const api = load('src/game/player.ts', { './map': map, './collision': collision });
const { createPlayer, joystickInput, beginAttack, beginDash, advancePlayer, playerFrame,
  PLAYER_CELL, PLAYER_ANIMATIONS, REST_INPUT, WALK_SPEED, DASH_SPEED, DASH_DURATION_MS, DASH_COOLDOWN_MS } = api;
const close = (a, b, tolerance = 0.000001) => assert(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function advance(player, input, milliseconds, hz = 120) {
  for (let elapsed = 0; elapsed < milliseconds - 1e-8;) {
    const dt = Math.min(1000 / hz, milliseconds - elapsed);
    player = advancePlayer(player, input, dt);
    assert(collision.isWalkable(player.x, player.y), 'Every simulated position must remain walkable');
    elapsed += dt;
  }
  return player;
}
function freeOrigin(radius) {
  for (let y = 950; y <= 1900; y += 24) for (let x = 900; x <= 2000; x += 24) {
    let free = collision.isWalkable(x, y);
    for (let r = 8; free && r <= radius; r += 8) for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16;
      if (!collision.isWalkable(x + Math.cos(angle) * r, y + Math.sin(angle) * r)) { free = false; break; }
    }
    if (free) return { ...createPlayer(), x, y };
  }
  throw new Error('No open plaza found for movement checks');
}
assert(collision.isWalkable(createPlayer().x, createPlayer().y), 'Spawn must be free');
const origin = freeOrigin(160);
assert.equal(createPlayer().action, 'idle');
assert.equal(joystickInput(0, 0), REST_INPUT);
assert.equal(joystickInput(6, 0), REST_INPUT);
close(joystickInput(1000, 1000).strength, 1);
for (let direction = 0; direction < 8; direction++) {
  const angle = direction * Math.PI / 4;
  const input = joystickInput(Math.cos(angle) * 44, Math.sin(angle) * 44);
  close(Math.hypot(input.x, input.y), 1);
  const end60 = advance(origin, input, 500, 60);
  const end120 = advance(origin, input, 500, 120);
  close(distance(origin, end60), WALK_SPEED * 0.5);
  close(end60.x, end120.x); close(end60.y, end120.y);
  assert.equal(end120.action, 'run');
  if (Math.abs(input.x) > 0.1) assert.equal(end120.facingX, Math.sign(input.x));
}
const walkingInput = joystickInput(16, 0);
const walking = advance(origin, walkingInput, 200);
assert.equal(walking.action, 'walk');
close(distance(origin, walking), WALK_SPEED * walkingInput.strength * 0.2);
const stopped = advance(walking, REST_INPUT, 100);
assert.equal(stopped.action, 'idle'); close(stopped.x, walking.x); close(stopped.y, walking.y);
assert.equal(advancePlayer(origin, REST_INPUT, 0), origin);
assert.equal(advancePlayer(origin, REST_INPUT, -50), origin);
close(distance(origin, advancePlayer(origin, joystickInput(44, 0), 1000)), WALK_SPEED * 0.04);

// Four complete authored sword sequences, including locking facing while swinging.
let chain = origin;
for (let attack = 0; attack < 4; attack++) {
  chain = beginAttack(chain);
  assert.equal(chain.attackIndex, attack);
  assert.equal(beginAttack(chain), chain, 'Holding/repressing attack must not restart an active swing');
  const animation = PLAYER_ANIMATIONS.attack[attack];
  const visited = new Set();
  const initial = chain;
  for (let guard = 0; chain.action === 'attack' && guard < 300; guard++) {
    const frame = playerFrame(chain);
    assert.equal(frame.y, animation.row * PLAYER_CELL.height);
    visited.add(frame.x / PLAYER_CELL.width);
    chain = advancePlayer(chain, joystickInput(-44, 0), 4);
    close(chain.x, initial.x); close(chain.y, initial.y);
    assert.equal(chain.facingX, initial.facingX, 'The sword facing must remain locked during its swing');
  }
  assert.equal(chain.action, 'idle', 'Attack must finish');
  assert.equal(visited.size, animation.frames, 'Every original attack frame must be reachable');
}
assert.equal(beginAttack(chain).attackIndex, 0, 'The fourth attack wraps to the first');
chain = advance(chain, REST_INPUT, 1200);
assert.equal(beginAttack(chain).attackIndex, 0, 'An expired combo starts with its first swing');

for (let direction = 0; direction < 8; direction++) {
  const angle = direction * Math.PI / 4;
  const input = joystickInput(Math.cos(angle) * 44, Math.sin(angle) * 44);
  const dashing = beginDash(origin, input);
  assert.equal(beginDash(dashing, input), dashing);
  assert.equal(beginAttack(dashing), dashing, 'Attacks must not interrupt a dash');
  const end = advance(dashing, REST_INPUT, DASH_DURATION_MS + 1);
  close(distance(origin, end), DASH_SPEED * DASH_DURATION_MS / 1000);
  assert.equal(end.action, 'idle');
  assert(end.dashCooldownMs > 0);
  assert.equal(beginDash(end, input), end, 'Dash remains blocked after animation until recovery finishes');
  const recovered = advance(end, REST_INPUT, DASH_COOLDOWN_MS);
  assert.equal(recovered.dashCooldownMs, 0);
  assert.equal(beginDash(recovered, input).action, 'dash');
}
const leftAim = { ...origin, facingX: -1, aimX: -1, aimY: 0 };
const stationaryDash = beginDash(leftAim, REST_INPUT);
close(stationaryDash.dashX, -1); close(stationaryDash.dashY, 0);
const verticalDash = beginDash(leftAim, joystickInput(0, -44));
close(verticalDash.dashX, 0); close(verticalDash.dashY, -1);
assert.equal(verticalDash.facingX, -1, 'Pure vertical movement retains the authored lateral facing');
const dash60 = advance(beginDash(origin, joystickInput(44, 0)), REST_INPUT, 500, 60);
const dash120 = advance(beginDash(origin, joystickInput(44, 0)), REST_INPUT, 500, 120);
close(dash60.x, dash120.x); close(dash60.y, dash120.y);

// Integrate every existing street centerline, independently of display cadence.
let routeSegments = 0;
for (const route of map.ROUTES) for (let i = 1; i < route.points.length; i++) {
  const start = route.points[i - 1], finish = route.points[i];
  const length = distance(start, finish);
  const input = { x: (finish.x - start.x) / length, y: (finish.y - start.y) / length, strength: 1 };
  const initial = { ...origin, ...start };
  const end60 = advance(initial, input, length / WALK_SPEED * 1000, 60);
  const end120 = advance(initial, input, length / WALK_SPEED * 1000, 120);
  close(end60.x, finish.x); close(end60.y, finish.y);
  close(end120.x, finish.x); close(end120.y, finish.y);
  routeSegments++;
}

// Read actual alpha bytes rather than assuming that all cells contain sprites.
function readRgbaPng(filename) {
  const png = fs.readFileSync(filename), compressed = [];
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8); assert.equal(chunk[9], 6); assert.equal(chunk[12], 0);
    }
    if (type === 'IDAT') compressed.push(chunk);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(compressed)), stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const above = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined, 'Unsupported PNG filter');
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}
const image = readRgbaPng(path.join(project, 'assets/assets/characters/The SwordMaster/Sword Master Sprite Sheet 90x37.png'));
assert.equal(image.width, 900); assert.equal(image.height, 999);
assert.equal(PLAYER_CELL.width, 90); assert.equal(PLAYER_CELL.height, 37);
assert.equal(PLAYER_CELL.pivotX, 28); assert.equal(PLAYER_CELL.pivotY, 34);
const audited = [
  ['idle', 1, 9], ['walk', 2, 8], ['run', 3, 8], ['dash', 12, 6], ['death', 26, 6],
  ...[7, 8, 9, 10].map((row, i) => [`attack${i}`, row, [7, 5, 5, 6][i]]),
];
let verifiedFrames = 0;
for (const [name, row, count] of audited) {
  const action = name.startsWith('attack') ? 'attack' : name;
  const attackIndex = action === 'attack' ? Number(name.slice(6)) : 0;
  const animation = action === 'attack' ? PLAYER_ANIMATIONS.attack[attackIndex] : PLAYER_ANIMATIONS[action];
  assert.equal(animation.row, row); assert.equal(animation.frames, count);
  const hashes = new Set();
  for (let i = 0; i < count; i++) {
    const frame = playerFrame({ ...origin, action, attackIndex, actionMs: (i + 0.05) * 1000 / animation.fps });
    assert.equal(frame.x, i * 90); assert.equal(frame.y, row * 37);
    assert(frame.x + frame.width <= image.width && frame.y + frame.height <= image.height);
    const bytes = [];
    let opaque = 0;
    for (let y = frame.y; y < frame.y + frame.height; y++) for (let x = frame.x; x < frame.x + frame.width; x++) {
      const offset = (y * image.width + x) * 4;
      if (image.pixels[offset + 3]) opaque++;
      bytes.push(...image.pixels.subarray(offset, offset + 4));
    }
    assert(opaque > 10, `${name} frame ${i} must contain the original character/effect`);
    hashes.add(crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
    verifiedFrames++;
  }
  assert(hashes.size > 1, `${name} must contain actual distinct frames`);
  const last = playerFrame({ ...origin, action, attackIndex, actionMs: count * 1000 / animation.fps + 1 });
  assert.equal(last.x, action === 'death' || action === 'attack' || action === 'dash' ? (count - 1) * 90 : 0);
}
console.log(`Player checks passed: 8 equally fast directions, idle/walk/run, four complete attacks, guarded dash/recovery/facing, ${routeSegments} street segments at 60/120 Hz and ${verifiedFrames} original RGBA sprite frames. These simulations do not measure device FPS.`);
