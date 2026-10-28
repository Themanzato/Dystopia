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
const filename = path.join(project, 'src/ui/loadingCatalog.ts');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: moduleValue, exports: moduleValue.exports,
  require: id => {
    assert(id.endsWith('.png'), 'The catalog has only existing PNG dependencies');
    return path.resolve(path.dirname(filename), id);
  },
}, { filename });
const { LOADING_ENTITIES, LOADING_TIPS, chooseLoading } = moduleValue.exports;

function readPng(filename) {
  const png = fs.readFileSync(filename), chunks = [];
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.equal(data[9], 6, 'Original RGBA PNG');
      assert.equal(data[12], 0, 'Non-interlaced original PNG');
    }
    if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const offset = y * stride + x;
      const left = x >= 4 ? pixels[offset - 4] : 0;
      const above = y ? pixels[offset - stride] : 0;
      const upperLeft = y && x >= 4 ? pixels[offset - stride - 4] : 0;
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, upperLeft)][filter];
      assert.notEqual(predictor, undefined);
      pixels[offset] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

const expected = {
  ghoul: [558, 33, 9], spitter: [342, 39, 6], summoner: [276, 44, 6],
  shielder: [774, 46, 6], 'evil-sage': [832, 294, 9], guardian: [3984, 96, 24],
  'skeleton-summoner': [1584, 83, 12], 'dagger-bandit': [1024, 78, 8],
  archer: [174, 500, 20], 'bomb-droid': [32, 192, 6], 'dagger-mush': [144, 400, 5],
  'shock-sweeper': [88, 240, 8], 'archer-bandit': [680, 112, 8],
  'electrocutioner': [1884,107,12], 'dust-jumper': [588, 819, 12], 'rock-boss': [4824, 94, 24], 'tarnished-widow': [3384, 720, 9],
};
assert.equal(LOADING_ENTITIES.length, Object.keys(expected).length);
assert.equal(new Set(LOADING_ENTITIES.map(entity => entity.id)).size, LOADING_ENTITIES.length);
assert.equal(new Set(LOADING_ENTITIES.map(entity => entity.source)).size, LOADING_ENTITIES.length);
assert.deepEqual([...new Set(LOADING_ENTITIES.map(entity => entity.category))].sort(), ['Boss', 'Enemigos', 'Mini boss']);
let frameCount = 0;
for (const entity of LOADING_ENTITIES) {
  const relative = path.relative(project, entity.source).replaceAll('\\', '/');
  const folder = entity.category === 'Enemigos' ? 'assets/assets/enemies/npc/' :
    entity.category === 'Mini boss' ? 'assets/assets/enemies/mini bosses/' : 'assets/assets/bosses/';
  assert(relative.startsWith(folder), `${entity.name}: correct source category`);
  assert(entity.name.length && entity.description.length, 'Verified label and neutral description');
  const image = readPng(entity.source);
  assert.deepEqual([image.width, image.height, entity.frames], expected[entity.id], `${entity.name}: audited strip`);
  const columns = entity.columns ?? entity.frames;
  assert(Number.isInteger(columns) && columns > 0);
  assert(entity.cell.width * columns <= image.width);
  assert((entity.row + Math.ceil(entity.frames / columns)) * entity.cell.height <= image.height);
  assert(entity.frames > 1 && entity.fps > 0 && entity.fps <= 24);
  const bounds = { x: entity.cell.width, y: entity.cell.height, right: 0, bottom: 0 };
  const hashes = new Set();
  for (let frame = 0; frame < entity.frames; frame++) {
    const pixels = Buffer.alloc(entity.cell.width * entity.cell.height * 4);
    let opaquePixels = 0, transparentPixels = 0;
    for (let y = 0; y < entity.cell.height; y++) {
      const sourceX = (frame % columns) * entity.cell.width;
      const sourceY = (entity.row + Math.floor(frame / columns)) * entity.cell.height;
      const offset = ((sourceY + y) * image.width + sourceX) * 4;
      image.pixels.copy(pixels, y * entity.cell.width * 4, offset, offset + entity.cell.width * 4);
      for (let x = 0; x < entity.cell.width; x++) {
        if (image.pixels[offset + x * 4 + 3]) {
          opaquePixels++;
          bounds.x = Math.min(bounds.x, x); bounds.y = Math.min(bounds.y, y);
          bounds.right = Math.max(bounds.right, x + 1); bounds.bottom = Math.max(bounds.bottom, y + 1);
        } else transparentPixels++;
      }
    }
    assert(opaquePixels > 0, `${entity.name}: frame ${frame} is not an empty cell`);
    assert(transparentPixels > 0, `${entity.name}: original transparency remains available`);
    hashes.add(crypto.createHash('sha256').update(pixels).digest('hex'));
    frameCount++;
  }
  assert(hashes.size > 1, `${entity.name}: genuine differing animation frames, not a static image`);
  assert.deepEqual(JSON.parse(JSON.stringify(entity.bounds)), {
    x: bounds.x, y: bounds.y, width: bounds.right - bounds.x, height: bounds.bottom - bounds.y,
  }, `${entity.name}: the stable crop contains all original visible pixels`);
  if (['evil-sage', 'dust-jumper', 'tarnished-widow'].includes(entity.id)) {
    // The remaining cells of the selected row are transparent; other rows are different actions.

    for (let y = 0; y < entity.cell.height; y++) for (let x = entity.frames * entity.cell.width; x < image.width; x++) {
      assert.equal(image.pixels[(y * image.width + x) * 4 + 3], 0, 'No extra presentation frame is silently discarded');
    }
  } else if (columns === 1) {
    assert.equal(image.width, entity.cell.width);
    assert.equal(image.height, entity.cell.height * entity.frames, 'Entire original vertical strip is used');
  } else assert.equal(image.width, entity.cell.width * entity.frames, 'Entire original horizontal strip is used');
}
assert.equal(frameCount, 184);
assert(LOADING_TIPS.length >= 12);
assert.equal(new Set(LOADING_TIPS).size, LOADING_TIPS.length, 'Advice messages are distinct');
assert(LOADING_TIPS.every(tip => tip.length > 15 && tip.length <= 60));
for (const topic of ['joystick', 'dash', 'ataque', 'oleadas', 'Ghoul', 'mini bosses', 'bosses', 'Explora']) {
  assert(LOADING_TIPS.some(tip => tip.includes(topic)), `Advice covers ${topic}`);
}
for (let index = 0; index < LOADING_ENTITIES.length; index++) {
  const selection = chooseLoading(undefined, () => (index + 0.5) / LOADING_ENTITIES.length);
  assert.equal(selection.entity.id, LOADING_ENTITIES[index].id, 'Every entity can be selected');
}
let previous;
let seed = 0x64797374;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
for (let i = 0; i < 1000; i++) {
  const selection = chooseLoading(previous, random);
  assert(LOADING_ENTITIES.includes(selection.entity));
  assert.equal(selection.tip, LOADING_TIPS[selection.tipIndex]);
  if (previous) {
    assert.notEqual(selection.entity.id, previous.entityId, 'No immediately repeated entity');
    assert.notEqual(selection.tipIndex, previous.tipIndex, 'No immediately repeated tip');
  }
  previous = { entityId: selection.entity.id, tipIndex: selection.tipIndex };
}
for (const value of [0, 1, -100, 100, NaN, Infinity]) {
  const selection = chooseLoading({ entityId: 'ghoul', tipIndex: 0 }, () => value);
  assert(LOADING_ENTITIES.includes(selection.entity));
  assert.notEqual(selection.entity.id, 'ghoul'); assert.notEqual(selection.tipIndex, 0);
  assert.equal(selection.tip, LOADING_TIPS[selection.tipIndex]);
}
console.log(`Loading catalog passed: ${LOADING_ENTITIES.length} verified entities, ${frameCount} authentic frames, ${LOADING_TIPS.length} tips and 1000 non-repeating selections.`);
if (process.env.DYSTOPIA_LOADING_AUDIT) {
  fs.writeFileSync(process.env.DYSTOPIA_LOADING_AUDIT, JSON.stringify(LOADING_ENTITIES.map(({ source, ...entity }) => ({
    ...entity, sourcepath: path.relative(project, source).replaceAll('\\', '/'),
  })), null, 2));
}
