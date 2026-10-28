/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
function loadTs(relative, dependencies = {}) {
  const filename = path.join(project, relative);
  const context = { exports: {}, require: id => {
    if (id === './frenesis') return loadTs('src/game/frenesis.ts', { './collision': collision });
    assert(id in dependencies, `Unexpected collision dependency: ${id}`);
    return dependencies[id];
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context, { filename });
  return context.exports;
}
const map = loadTs('src/game/map.ts');
const collision = loadTs('src/game/collision.ts', { './map': map });
const { PLAYER_RADIUS: radius, isWalkable, moveWithCollisions } = collision;
const { PLAYER_SPAWN } = loadTs('src/game/player.ts', { './collision': collision });
const { PROPS, ANIMATED_PROPS, ARENA, WORLD, ROUTES } = map;
const solids = [...PROPS, ...ANIMATED_PROPS].filter(prop => prop.footprint);
const close = (a, b) => assert(Math.abs(a - b) < 0.00001, `${a} differs from ${b}`);
const bruteWalkable = (x, y) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < radius || y < radius || x > WORLD.width - radius || y > WORLD.height - radius) return false;
  if ((x - ARENA.x) ** 2 + (y - ARENA.y) ** 2 > (ARENA.radius - radius) ** 2 + 0.000001) return false;
  return !solids.some(({ footprint: b }) => {
    const dx = x - Math.max(b.x, Math.min(x, b.x + b.width));
    const dy = y - Math.max(b.y, Math.min(y, b.y + b.height));
    return dx * dx + dy * dy < radius * radius - 0.000001;
  });
};
assert(isWalkable(PLAYER_SPAWN.x, PLAYER_SPAWN.y), 'The initial player position must be clear');
assert(!isWalkable(NaN, 0));
assert(!isWalkable(Infinity, 100));
// Independent brute-force oracle checks spatial-hash coverage, including cell seams,
// corner contacts, every animated/static footprint and non-solid scenery.
let checked = 0;
for (let y = 0; y <= WORLD.height; y += 17) for (let x = 0; x <= WORLD.width; x += 17) {
  assert.equal(isWalkable(x, y), bruteWalkable(x, y), `Hash differs at ${x},${y}`);
  checked++;
}
for (const { footprint: b, id } of solids) {
  for (const x of [b.x - radius, b.x - radius + 0.01, b.x, b.x + b.width / 2, b.x + b.width + radius]) {
    for (const y of [b.y - radius, b.y - radius + 0.01, b.y, b.y + b.height / 2, b.y + b.height + radius]) {
      assert.equal(isWalkable(x, y), bruteWalkable(x, y), `Footprint query differs: ${id}`);
      checked++;
    }
  }
}
// Preserve requested displacement in all eight directions in an empty street.
const open = { x: 1425, y: 1400 };
assert(isWalkable(open.x, open.y));
for (const [dx, dy] of [[30,0],[-30,0],[0,30],[0,-30],[20,20],[20,-20],[-20,20],[-20,-20]]) {
  const moved = moveWithCollisions(open, dx, dy);
  close(moved.x, open.x + dx);
  close(moved.y, open.y + dy);
}
// A dash must not tunnel through a building or a thin animated kiln footprint.
for (const target of [PROPS.find(p => p.id === 'market-pharmacy'), ANIMATED_PROPS.find(p => p.id === 'salvage-working-kiln')]) {
  assert(target?.footprint, 'The anti-tunneling test requires an existing solid target');
  const b = target.footprint;
  const start = { x: b.x + b.width / 2, y: b.y - radius - 2 };
  assert(isWalkable(start.x, start.y), `Test approach is blocked: ${target.id}`);
  const moved = moveWithCollisions(start, 0, b.height + 2 * radius + 300);
  assert(isWalkable(moved.x, moved.y));
  assert(moved.y <= b.y - radius + 0.00001, `Tunneled through ${target.id}`);
  assert(moved.y >= b.y - radius - 4.01, 'Collision should stop close to the solid face');
}
const pharmacy = PROPS.find(p => p.id === 'market-pharmacy').footprint;
const beside = { x: pharmacy.x - radius - 2, y: pharmacy.y + pharmacy.height / 2 };
const sliding = moveWithCollisions(beside, 30, 6);
assert(sliding.x <= pharmacy.x - radius);
close(sliding.y, beside.y + 6);
assert(isWalkable(sliding.x, sliding.y));
// Follow every connected route and its usable lateral margins. Decorations must
// remain walkable and the street network must stay traversable by a feet collider.
let routeChecks = 0;
for (const route of ROUTES) for (let segment = 1; segment < route.points.length; segment++) {
  const a = route.points[segment - 1], b = route.points[segment];
  const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  const steps = Math.ceil(length / 5);
  for (let i = 0; i <= steps; i++) for (const offset of [0, -route.width * 0.35, route.width * 0.35]) {
    const x = a.x + dx * i / steps - dy / length * offset;
    const y = a.y + dy * i / steps + dx / length * offset;
    assert(isWalkable(x, y), `Blocked route ${route.id} at ${x},${y}`);
    routeChecks++;
  }
  const moved = moveWithCollisions(a, dx, dy);
  close(moved.x, b.x);
  close(moved.y, b.y);
}
// Circle projection keeps a dash inside the world while retaining tangential motion.
const edge = { x: ARENA.x + ARENA.radius - radius - 2, y: ARENA.y };
assert(isWalkable(edge.x, edge.y));
const alongEdge = moveWithCollisions(edge, 400, 80);
assert(isWalkable(alongEdge.x, alongEdge.y));
assert(Math.hypot(alongEdge.x - ARENA.x, alongEdge.y - ARENA.y) <= ARENA.radius - radius + 0.00001);
assert(alongEdge.y > edge.y + 50, 'The circular boundary should allow sliding');
const stopped = moveWithCollisions(edge, 1000, 0);
close(stopped.x, ARENA.x + ARENA.radius - radius);
close(stopped.y, ARENA.y);
console.log(`Collision checks passed: ${solids.length} footprints, ${checked} independent hash comparisons, ${routeChecks} clear-route samples, eight directions, sliding, dash anti-tunneling and circular world limits.`);
