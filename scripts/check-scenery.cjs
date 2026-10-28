/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
function loadTs(relative) {
  const filename = path.join(project, relative);
  const context = { exports: {}, require: id => {
    assert(id.endsWith('.png'), `Unexpected scenery dependency: ${id}`);
    return path.resolve(path.dirname(filename), id);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context, { filename });
  return context.exports;
}

// Decode original alpha bytes so a valid atlas rectangle cannot silently add an opaque floor patch.
function readRgbaPng(filename) {
  const png = fs.readFileSync(filename), compressed = [];
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8, 'Terrain audit expects 8-bit original pixels');
      assert.equal(chunk[9], 6, 'Terrain audit expects original RGBA pixels');
      assert.equal(chunk[12], 0, 'Terrain audit expects a non-interlaced image');
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
const sourceKey = s => [s.x, s.y, s.width, s.height].join(',');
const center = p => ({ x: p.destination.x + p.destination.width / 2, y: p.destination.y + p.destination.height / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const { WORLD, ARENA, DISTRICTS, FLOOR_COLOR, PROPS, ANIMATED_PROPS, ROUTES, TERRAIN_SOURCES } = loadTs('src/game/map.ts');
const { ASSETS } = loadTs('src/game/assets.ts');
assert.equal(FLOOR_COLOR, '#513a3d');
const images = Object.fromEntries(Object.entries(ASSETS).map(([key, filename]) => {
  const normalized = filename.replaceAll('\\', '/');
  assert(normalized.includes('/assets/assets/escenario/'), 'Only scenery images belong in this scene');
  assert(!normalized.includes('/Chests/'), `Chests are reserved for future encounters: ${key}`);
  assert(!['chest', 'cargo', 'smallChest'].includes(key), `Inactive chest atlas still loaded: ${key}`);
  const bytes = fs.readFileSync(filename);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  return [key, { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }];
}));
const all = [...PROPS, ...ANIMATED_PROPS];
assert.equal(new Set(all.map(p => p.id)).size, all.length, 'Scenery identifiers must be unique');
for (const p of all) {
  const s = p.source, d = p.destination, image = images[p.sheet];
  assert(!['chest', 'cargo', 'smallChest'].includes(p.sheet), `No fixed or animated chests should spawn: ${p.id}`);
  assert(image, `Missing image for ${p.id}`);
  const frames = p.animation?.frames ?? 1;
  assert(Object.values(s).every(Number.isFinite) && Object.values(d).every(Number.isFinite), `Non-finite geometry: ${p.id}`);
  assert(Number.isFinite(p.depth), `Invalid draw depth: ${p.id}`);
  assert(s.x >= 0 && s.y >= 0 && s.width > 0 && s.height > 0);
  assert(s.x + frames * s.width <= image.width && s.y + s.height <= image.height, `Invalid source frames: ${p.id}`);
  assert(d.width > 0 && d.height > 0 && d.x >= 0 && d.y >= 0 && d.x + d.width <= WORLD.width && d.y + d.height <= WORLD.height, `Outside world: ${p.id}`);
  assert(Math.abs(d.width / d.height - s.width / s.height) < 1e-8, `Distorted sprite: ${p.id}`);
  if (p.animation) {
    assert(Number.isInteger(frames) && Number.isInteger(p.animation.phase) && p.animation.fps > 0);
    assert(p.sheet === 'kiln' && frames === 10 && s.width === 32 && s.height === 33, `Unreviewed environmental sequence: ${p.id}`);
  }
  if (p.footprint) {
    const f = p.footprint;
    assert(f.width > 0 && f.height > 0 && Object.values(f).every(Number.isFinite), `Invalid collision footprint: ${p.id}`);
    assert(f.x >= d.x && f.y >= d.y && f.x + f.width <= d.x + d.width && f.y + f.height <= d.y + d.height, `Footprint must belong to its object: ${p.id}`);
  }
}
for (const animated of ANIMATED_PROPS) {
  for (const fixed of PROPS.filter(p => !p.groundDetail)) assert(!intersects(animated.destination, fixed.destination), `Animation would occlude ${fixed.id}: ${animated.id}`);
}
const buildings = PROPS.filter(p => ['gunShop', 'medic', 'restaurant', 'shed', 'tower'].includes(p.sheet));
assert(buildings.length > 0, 'The city must retain its buildings');
for (let i = 0; i < buildings.length; i++) for (let j = i + 1; j < buildings.length; j++) assert(!intersects(buildings[i].destination, buildings[j].destination), `Overlapping buildings: ${buildings[i].id}, ${buildings[j].id}`);

assert(TERRAIN_SOURCES && Object.keys(TERRAIN_SOURCES).length, 'Terrain must use reviewed original atlas cells');
const tileImage = readRgbaPng(ASSETS.tiles);
const catalog = new Map();
for (const [type, sources] of Object.entries(TERRAIN_SOURCES)) {
  assert(sources.length > 0, `Missing terrain cells: ${type}`);
  const hashes = new Set();
  const keys = new Set();
  for (const s of sources) {
    assert([s.x, s.y, s.width, s.height].every(Number.isInteger), 'Terrain must use whole source pixels');
    assert(s.x >= 0 && s.y >= 0 && s.width > 0 && s.height > 0 && s.x + s.width <= tileImage.width && s.y + s.height <= tileImage.height, `Terrain cell outside atlas: ${type}`);
    const bytes = [], key = sourceKey(s);
    let visible = 0, transparent = 0;
    for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
      const offset = (y * tileImage.width + x) * 4;
      if (tileImage.pixels[offset + 3]) visible++; else transparent++;
      bytes.push(...tileImage.pixels.subarray(offset, offset + 4));
    }
    assert(visible > 0 && transparent > visible / 2, `Terrain must contain a discrete transparent sprite, not an opaque floor tile: ${type} ${key}`);
    assert(!keys.has(key), `Duplicate terrain cell: ${type} ${key}`);
    keys.add(key);
    hashes.add(crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  }
  assert.equal(hashes.size, sources.length, `Terrain variants must contain different original pixels: ${type}`);
  catalog.set(type, keys);
}
const terrain = PROPS.filter(p => p.terrain);
assert(terrain.length > 0, 'The rebuilt city must include vegetation and stones');
for (const p of terrain) {
  assert(p.sheet === 'tiles' && catalog.get(p.terrain)?.has(sourceKey(p.source)), `Unreviewed terrain sprite: ${p.id}`);
  assert(p.groundDetail && !p.footprint && !p.animation, `Small terrain must stay passable and static: ${p.id}`);
  assert(p.destination.width <= 48 && p.destination.height <= 48, `Terrain is too large relative to doorways and the character: ${p.id}`);
}
const used = type => new Set(terrain.filter(p => p.terrain === type).map(p => sourceKey(p.source)));
assert(used('grass').size >= 4, 'Vegetation must use several visibly distinct grass types');
assert(used('stone').size >= 3, 'Stones must use several visibly distinct rock types');

// Determine coverage from world coordinates rather than ids or district labels.
const closestDistrict = p => DISTRICTS.reduce((best, district) => distance(p, district.center) < distance(p, best.center) ? district : best);
let clumps = 0;
for (const district of DISTRICTS) {
  const local = terrain.filter(p => closestDistrict(center(p)).id === district.id);
  assert(local.some(p => p.terrain === 'grass'), `No vegetation reaches ${district.id}`);
  assert(local.some(p => p.terrain === 'stone'), `No rocks reach ${district.id}`);
  const groups = [];
  // A clump has at least three nearby details. Separated witnesses prevent one pile
  // from satisfying all three locations in a district.
  for (const p of local) {
    const location = center(p);
    if (groups.some(other => distance(location, other) < 180)) continue;
    if (local.filter(other => distance(location, center(other)) <= 90).length >= 3) groups.push(location);
  }
  assert(groups.length >= 3, `Terrain must form several separated groups across ${district.id}, found ${groups.length}`);
  clumps += groups.length;
}
for (const type of ['grass', 'stone']) {
  const covered = new Set();
  for (const p of terrain.filter(p => p.terrain === type)) {
    const location = center(p);
    if (distance(location, ARENA) >= ARENA.radius) continue;
    const column = Math.floor((location.x - (ARENA.x - ARENA.radius)) / (ARENA.radius * 2 / 3));
    const row = Math.floor((location.y - (ARENA.y - ARENA.radius)) / (ARENA.radius * 2 / 3));
    if (column >= 0 && column < 3 && row >= 0 && row < 3) covered.add(`${column},${row}`);
  }
  assert.equal(covered.size, 9, `${type} coverage must extend through the whole arena, not one central neighborhood`);
}

const distanceToBox = (point, b) => Math.hypot(point.x - Math.max(b.x, Math.min(point.x, b.x + b.width)), point.y - Math.max(b.y, Math.min(point.y, b.y + b.height)));
for (const p of all.filter(p => p.footprint)) for (const route of ROUTES) {
  for (let segment = 1; segment < route.points.length; segment++) {
    const a = route.points[segment - 1], b = route.points[segment];
    const samples = Math.ceil(distance(a, b) / 4);
    for (let i = 0; i <= samples; i++) {
      const location = { x: a.x + (b.x - a.x) * i / samples, y: a.y + (b.y - a.y) * i / samples };
      assert(distanceToBox(location, p.footprint) >= route.width / 2, `Obstructed route ${route.id}: ${p.id}`);
    }
  }
}
assert(ROUTES.length > 0, 'The city needs an explorable street network');
const connected = new Set([0]);
let previous = 0;
while (previous !== connected.size) {
  previous = connected.size;
  ROUTES.forEach((candidate, index) => {
    for (const other of connected) if (candidate.points.some(a => ROUTES[other].points.some(b => a.x === b.x && a.y === b.y))) connected.add(index);
  });
}
assert.equal(connected.size, ROUTES.length, 'All streets must connect');
console.log(`Scenery checks passed: ${WORLD.width}x${WORLD.height}, ${buildings.length} buildings, ${all.length} elements, ${terrain.length} transparent terrain details in ${clumps} separated groups across ${DISTRICTS.length} districts and all 9 arena sectors, no chests, ${ROUTES.length} connected clear routes, intact proportions and reviewed environmental frames.`);
