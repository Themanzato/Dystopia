/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
function load(relative, dependencies = {}) {
  const filename = path.join(project, relative);
  const context = { exports: {}, require: id => {
    if (id in dependencies) return dependencies[id];
    throw new Error(`Unexpected navigation dependency: ${id}`);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context, { filename });
  return context.exports;
}
const map = load('src/game/map.ts');
const collision = load('src/game/collision.ts', { './map': map });
const navigation = load('src/game/navigation.ts', { './map': map, './collision': collision });
const { NAV_CELL_SIZE, NAV_COLUMNS, NAV_ROWS, navigationCell, buildFlowField, navigationDirection, isReachable } = navigation;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const center = cell => ({ x: (cell % NAV_COLUMNS + 0.5) * NAV_CELL_SIZE, y: (Math.floor(cell / NAV_COLUMNS) + 0.5) * NAV_CELL_SIZE });
const target = { x: 1425, y: 1225 };
const field = buildFlowField(target);
assert.equal(NAV_COLUMNS, 96);
assert.equal(NAV_ROWS, 96);
assert.equal(field.distances.length, NAV_COLUMNS * NAV_ROWS);
assert.equal(field.next.length, field.distances.length);
assert.equal(field.targetCell, navigationCell(target));
assert.equal(field.distances[field.rootCell], 0);
assert(isReachable(target, field));
assert.equal(navigationCell({ x: -1, y: 100 }), -1);
assert.equal(navigationCell({ x: map.WORLD.width, y: 100 }), -1);
assert.equal(navigationCell({ x: NaN, y: 100 }), -1);
assert.equal(isReachable({ x: 0, y: 0 }, field), false);
const invalidField = buildFlowField({ x: 0, y: 0 });
assert.equal(invalidField.rootCell, -1);
assert(invalidField.distances.every(d => d === -1));
// Each graph edge both descends toward the target and stays inside actual collision geometry.
let reachable = 0;
for (let cell = 0; cell < field.distances.length; cell++) {
  if (field.distances[cell] < 0) continue;
  reachable++;
  assert(collision.isWalkable(center(cell).x, center(cell).y));
  if (cell === field.rootCell) continue;
  const next = field.next[cell];
  assert.equal(field.distances[next], field.distances[cell] - 1);
  const a = center(cell), b = center(next);
  const ax = cell % NAV_COLUMNS, ay = Math.floor(cell / NAV_COLUMNS);
  const bx = next % NAV_COLUMNS, by = Math.floor(next / NAV_COLUMNS);
  if (ax !== bx && ay !== by) {
    assert(collision.isWalkable(center(ay * NAV_COLUMNS + bx).x, center(ay * NAV_COLUMNS + bx).y));
    assert(collision.isWalkable(center(by * NAV_COLUMNS + ax).x, center(by * NAV_COLUMNS + ax).y));
  }
  for (let i = 0; i <= 16; i++) assert(collision.isWalkable(a.x + (b.x - a.x) * i / 16, a.y + (b.y - a.y) * i / 16));
}
assert(reachable > 4500, 'The connected city should expose thousands of reachable spawn cells');
function follow(origin, goal, field, maximumSteps = 16000) {
  let position = { ...origin };
  for (let i = 0; i < maximumSteps; i++) {
    if (distance(position, goal) < 6) return { position, steps: i };
    const direction = navigationDirection(position, goal, field);
    assert(Math.hypot(direction.x, direction.y) <= 1.000001);
    const next = collision.moveWithCollisions(position, direction.x * 0.75, direction.y * 0.75);
    assert(collision.isWalkable(next.x, next.y));
    position = next;
  }
  assert.fail(`Route did not reach goal: ${JSON.stringify({ origin, goal, position })}`);
}
// Spawn points in all six districts must be able to traverse the city to the player.
let routed = 0;
for (const district of map.DISTRICTS) {
  let spawn = null;
  for (let r = 0; r <= 96 && !spawn; r += 16) for (let angle = 0; angle < 16; angle++) {
    const candidate = { x: district.center.x + Math.cos(angle * Math.PI / 8) * r, y: district.center.y + Math.sin(angle * Math.PI / 8) * r };
    if (isReachable(candidate, field)) { spawn = candidate; break; }
  }
  assert(spawn, `No reachable spawn in ${district.id}`);
  follow(spawn, target, field);
  routed++;
}
// Choose opposite sides of a real building: the route must leave the blocked direct line.
const building = map.PROPS.find(p => p.id === 'market-repair');
assert(building?.footprint);
const footprint = building.footprint;
const left = { x: footprint.x - 42, y: footprint.y + footprint.height / 2 };
const right = { x: footprint.x + footprint.width + 42, y: left.y };
assert(collision.isWalkable(left.x, left.y));
assert(collision.isWalkable(right.x, right.y));
const around = buildFlowField(right);
assert(isReachable(left, around));
const result = follow(left, right, around);
assert(result.steps * 0.75 > distance(left, right) + 10, 'Building detour must exceed the blocked direct line');
// A walkable point whose cell center is occupied still attaches to a visible graph node.
let edge = null;
for (let y = footprint.y - 40; y < footprint.y + footprint.height + 40 && !edge; y += 2) for (let x = footprint.x - 40; x < footprint.x + footprint.width + 40; x += 2) {
  const position = { x, y };
  const cell = navigationCell(position);
  if (collision.isWalkable(x, y) && field.distances[cell] < 0 && isReachable(position, field)) { edge = position; break; }
}
assert(edge, 'Fixture should include reachable edges of blocked grid cells');
follow(edge, target, field);
console.log(`Navigation checks passed: ${reachable} connected cells, ${routed} district routes, building detour, blocked-cell attachment, and collision-safe graph edges.`);
