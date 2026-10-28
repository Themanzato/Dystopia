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
const cache = new Map(), loadedImages = [];
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const requireLocal = id => {
    if (!id.startsWith('.')) throw new Error(`Unexpected NPC dependency: ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    if (target.endsWith('.png')) { loadedImages.push(target); return target; }
    return load(path.relative(project, `${target}.ts`));
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require: requireLocal }, { filename });
  return module.exports;
}
function readRgbaPng(filename) {
  const png = fs.readFileSync(filename), compressed = [];
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', 'Real PNG input');
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4);
      assert.equal(chunk[8], 8); assert.equal(chunk[9], 6); assert.equal(chunk[12], 0, 'Non-interlaced original RGBA');
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
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const above = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined, 'Supported PNG row filter');
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}
function crop(image, box) {
  assert(box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0);
  assert(box.x + box.width <= image.width && box.y + box.height <= image.height, 'Crop inside original PNG');
  const result = Buffer.alloc(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const offset = ((box.y + row) * image.width + box.x) * 4;
    image.pixels.copy(result, row * box.width * 4, offset, offset + box.width * 4);
  }
  return result;
}
const { NPC_ASSETS } = load('src/game/npcAssets.ts');
const { NPC_ANIMATIONS, NPC_CELL, NPC_SCALE, NPC_POOL_SIZE, npcFrame, npcAnimation, emptyNpc } = load('src/game/npc.ts');
assert.equal(Object.keys(NPC_ASSETS).length, 4);
assert.equal(loadedImages.length, 4);
for (const filename of loadedImages) {
  const relative = path.relative(project, filename).replaceAll('\\', '/');
  assert(relative.startsWith('assets/assets/enemies/npc/'), 'Only the audited common NPC source is loaded');
  assert(!/boss|projectile/i.test(relative), 'NPC catalog contains only common enemy sheets');
}
assert.equal(path.basename(NPC_ASSETS.sheet), 'Ghoul Sprite Sheet 62 x 33.png');
assert.equal(path.basename(NPC_ASSETS.idle), 'static idle.png');
const sheet = readRgbaPng(NPC_ASSETS.sheet), idle = readRgbaPng(NPC_ASSETS.idle);
assert.equal(sheet.width, 682); assert.equal(sheet.height, 198);
assert.equal(idle.width, 62); assert.equal(idle.height, 33);
assert.equal(NPC_CELL.width, 62); assert.equal(NPC_CELL.height, 33);
assert.equal(NPC_CELL.pivotX, 31); assert.equal(NPC_CELL.pivotY, 32);
assert.equal(NPC_SCALE, 1.75); assert.equal(NPC_POOL_SIZE, 60);
const audited = [['wake', 'Wake.png', 0, 4], ['move', 'Walk.png', 1, 9], ['death', 'death.png', 4, 8], ['spawn', 'spawn.png', 5, 11]];
assert.equal(Object.keys(NPC_ANIMATIONS).length, audited.length, 'No invented idle loop or unused ranged attack');
let frameCount = 0;
for (const [action, filename, row, count] of audited) {
  const animation = NPC_ANIMATIONS[action];
  assert.equal(animation.row, row); assert.equal(animation.frames, count);
  assert(animation.fps > 0 && animation.fps <= 30);
  const standalone = readRgbaPng(path.join(path.dirname(NPC_ASSETS.sheet), filename));
  assert.equal(standalone.width, count * 62); assert.equal(standalone.height, 33);
  assert.deepEqual(crop(sheet, { x: 0, y: row * 33, width: count * 62, height: 33 }), standalone.pixels, `${filename} is exactly the audited fullsheet row`);
  const hashes = new Set();
  for (let i = 0; i < count; i++) {
    const frame = npcFrame({ ...emptyNpc(), action, actionMs: (i + 0.05) * 1000 / animation.fps });
    assert.equal(frame.image, 1); assert.equal(frame.source.x, i * 62); assert.equal(frame.source.y, row * 33);
    assert.equal(frame.source.width, 62); assert.equal(frame.source.height, 33);
    const rgba = crop(sheet, frame.source);
    let alphaCount = 0, maxAlpha = 0;
    for (let p = 3; p < rgba.length; p += 4) { if (rgba[p]) alphaCount++; maxAlpha = Math.max(maxAlpha, rgba[p]); }
    assert(alphaCount > 0, `${action} frame ${i} contains genuine visible original pixels`);
    if (action === 'death' && i === 7) {
      assert.equal(alphaCount, 18); assert.equal(maxAlpha, 28, 'Final original death cell is almost transparent, not omitted');
    } else assert.equal(maxAlpha, 255);
    hashes.add(crypto.createHash('sha256').update(rgba).digest('hex'));
    frameCount++;
  }
  assert(hashes.size > 1, `${action} contains real animation frames`);
  const last = npcFrame({ ...emptyNpc(), action, actionMs: (count + 0.01) * 1000 / animation.fps });
  assert.equal(last.source.x, action === 'move' ? 0 : (count - 1) * 62, 'Only genuine walk animation loops; one-shots clamp their last authored cell');
}
// Static idle never walks through empty cells or invents an animation.
for (const actionMs of [0, 50, 1000, 1e6]) {
  const frame = npcFrame({ ...emptyNpc(), action: 'idle', actionMs });
  assert.equal(frame.image, 2);
  assert.equal(frame.source.x, 0); assert.equal(frame.source.y, 0);
  assert.equal(frame.source.width, idle.width); assert.equal(frame.source.height, idle.height);
}
let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
for (let y = 0; y < idle.height; y++) for (let x = 0; x < idle.width; x++) if (idle.pixels[(y * idle.width + x) * 4 + 3]) {
  minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
}
assert.deepEqual([minX, minY, maxX + 1, maxY + 1], [27, 9, 36, 32], 'Transparent margins and original static silhouette retained');

// Every authored move/idle/death strip matches its exact region in the fullsheet.
for (const [kind, cellWidth, cellHeight, definitions] of [
  ['spitter', 57, 39, [['idle', 'idle.png', 0, 6], ['move', 'walk.png', 1, 7], ['death', 'death.png', 4, 9]]],
  ['summoner', 46, 44, [['idle', 'idle.png', 0, 6], ['move', 'move.png', 1, 6], ['death', 'death.png', 4, 10]]],
]) {
  const full = readRgbaPng(NPC_ASSETS[kind]);
  for (const [action, filename, row, count] of definitions) {
    const strip = readRgbaPng(path.join(path.dirname(NPC_ASSETS[kind]), filename));
    assert.equal(strip.width, count * cellWidth); assert.equal(strip.height, cellHeight);
    assert.deepEqual(crop(full, { x: 0, y: row * cellHeight, width: count * cellWidth, height: cellHeight }), strip.pixels);
    const animation = npcAnimation({ ...emptyNpc(), kind, action });
    assert.equal(animation.frames, count);
    for (let index = 0; index < count; index++) {
      const frame = npcFrame({ ...emptyNpc(), kind, action, actionMs: (index + 0.01) * 1000 / animation.fps });
      assert.equal(frame.image, kind === 'spitter' ? 3 : 4);
      assert.equal(frame.source.x, index * cellWidth); assert.equal(frame.source.y, row * cellHeight);
      crop(full, frame.source); frameCount++;
    }
    if (action === 'death') assert.equal(npcFrame({ ...emptyNpc(), kind, action, actionMs: 100000 }).source.x, (count - 1) * cellWidth);
  }
}
const { SURVIVAL_ASSETS, CHEST_ASSET, CHEST_SOURCE, chestFrame, bossFrame } = load('src/game/survivalAssets.ts');
const bossImages = { 5: readRgbaPng(SURVIVAL_ASSETS.shielder), 6: readRgbaPng(SURVIVAL_ASSETS.rockIdle),
  7: readRgbaPng(SURVIVAL_ASSETS.rockMelee), 8: readRgbaPng(SURVIVAL_ASSETS.rockWake), 9: readRgbaPng(SURVIVAL_ASSETS.rockMove) };
for (const id of ['shielder', 'rock-boss']) for (const phase of ['intro', 'warning', 'attack', 'recover']) {
  for (let ms = 0; ms < 3000; ms += 17) {
    const frame = bossFrame({ id, phase, phaseMs: ms, animationMs: ms });
    crop(bossImages[frame.image], frame.source);
    assert(frame.scale > 0); assert(frame.pivotY <= frame.source.height);
  }
}
const chestImage = readRgbaPng(CHEST_ASSET);
assert.equal(CHEST_SOURCE.width, 22); assert.equal(CHEST_SOURCE.height, 26);
assert.equal(chestImage.width / CHEST_SOURCE.width, 40); crop(chestImage, CHEST_SOURCE);

// Melee animations must exactly match authored attack strips and their configured duration.
const { bossAttack } = load('src/game/bossAttacks.ts');
const shielderAttack = readRgbaPng(path.join(path.dirname(SURVIVAL_ASSETS.shielder), 'attack.png'));
assert.equal(shielderAttack.width, 17 * 129);
assert.deepEqual(crop(bossImages[5], { x: 0, y: 46, width: 17 * 129, height: 46 }), shielderAttack.pixels);
for (let i = 0; i < 17; i++) {
  const frame = bossFrame({ id: 'shielder', phase: 'attack', phaseMs: (i + .01) * bossAttack('shielder', 0).durationMs / 17, animationMs: 0 });
  assert.equal(frame.source.x, i * 129); assert.equal(frame.source.y, 46);
  assert.deepEqual(crop(bossImages[5], frame.source), crop(shielderAttack, { x: i * 129, y: 0, width: 129, height: 46 }));
}
assert.equal(path.basename(SURVIVAL_ASSETS.rockMelee), 'Melee attack.png');
assert.equal(bossImages[7].width, 23 * 201);
for (let i = 0; i < 23; i++) {
  const frame = bossFrame({ id: 'rock-boss', phase: 'attack', phaseMs: (i + .01) * bossAttack('rock-boss', 0).durationMs / 23, animationMs: 0 });
  assert.equal(frame.image, 7); assert.equal(frame.source.x, i * 201);
  crop(bossImages[7], frame.source);
}
assert.equal(chestFrame('closed', 50000).x, 0);
assert.equal(chestFrame('reward', 50000).x, 39 * 22);
const chestHashes = new Set();
for (let i = 0; i < 16; i++) {
  const box = chestFrame('opening', (i + .01) * 900 / 16);
  assert.equal(box.width, 22); assert.equal(box.height, 26); assert.equal(box.x, (24 + i) * 22);
  const rgba = crop(chestImage, box);
  assert(rgba.some((value, index) => index % 4 === 3 && value > 0), 'Each opening frame contains authored visible pixels');
  chestHashes.add(crypto.createHash('sha256').update(rgba).digest('hex'));
}
assert(chestHashes.size > 8, 'Real changing lid/flash/particle frames, not static sprite motion');
assert.equal(chestFrame('opening', 99999).x, 39 * 22, 'Opening clamps without wrapping into a second chest');
console.log(`NPC/boss asset checks passed: ${frameCount} common cells, 17 exact Shielder melee cells, 23 Rock melee cells, 16 real 22x26 chest opening cells.`);