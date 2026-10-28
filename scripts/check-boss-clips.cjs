/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript');
const { PNG } = req('pngjs');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };
const { ENEMY_VISUALS } = req('./src/game/enemyAnimations.ts');
const { bossFrame } = req('./src/game/survivalAssets.ts');
const { BOSS_ATTACKS } = req('./src/game/bossAttacks.ts');
const { ATTACK_ROOT_X, CLIP_ROOT_X, attackFrameRoot, attackMotionRoot } = req('./src/game/enemyMotion.ts');
const sources = Array.from(fs.readFileSync(path.join(project, 'src/game/enemyVisuals.ts'), 'utf8').matchAll(/require\('([^']+\.png)'\)/g),
  match => path.resolve(project, 'src/game', match[1]));
const textures = sources.map(filename => PNG.sync.read(fs.readFileSync(filename)));
function source(relative) { return PNG.sync.read(fs.readFileSync(path.join(project, 'assets/assets', relative))); }
function compareCell(texture, x, y, reference, rx, ry, width, height) {
  let mismatches = 0;
  for (let yy = 0; yy < height; yy++) for (let xx = 0; xx < width; xx++) {
    const left = ((y + yy) * texture.width + x + xx) * 4, right = ((ry + yy) * reference.width + rx + xx) * 4;
    if (!texture.data.subarray(left, left + 4).equals(reference.data.subarray(right, right + 4))) mismatches++;
  }
  return mismatches;
}
// The new laser is the body portion of the authored second firing sequence.
// Its original root is 24px, not the normal 75px; no embedded beam is repeated.
const laser = ENEMY_VISUALS.archer.laser;
assert.deepEqual([laser.width, laser.height, laser.frames, laser.pivotX, laser.pivotY], [44, 25, 15, 24, 24]);
const archerSpecial = source('enemies/mini bosses/Archer/special attack.png');
for (let i = 0; i < laser.frames; i++) assert.equal(compareCell(textures[laser.image - 5], laser.x, laser.y + i * laser.stepY,
  archerSpecial, 0, (i + 11) * 25, laser.width, laser.height), 0, `Laser body frame ${i} matches its authored crop`);
// Both supplied Shielder versions are original art. The sheet changes nine
// orb-highlight pixels on range frame 8; all other range cells match the strip.
const range = ENEMY_VISUALS.shielder.range, rangeStrip = source('enemies/mini bosses/Shielder/range.png');
for (let i = 0; i < range.frames; i++) assert.equal(compareCell(textures[range.image - 5], range.x + i * range.stepX, range.y,
  rangeStrip, i * 129, 0, 129, 46), i === 8 ? 9 : 0, `Shielder original range cell ${i}`);
const bow = ENEMY_VISUALS['archer-bandit'].bow;
assert.equal(bow.image, 32); assert.equal(bow.height, 32); assert.equal(bow.frames, 8); assert.equal(bow.pivotY, 31);
assert.equal(ENEMY_VISUALS['archer-bandit'].evade.frames, 18, 'The vanish sequence must include all 18 original cells');
assert.equal(ENEMY_VISUALS['tarnished-widow'].leap.y, 360);
assert.equal(ENEMY_VISUALS['tarnished-widow'].landing.y, 450);
const charging = bossFrame({ id: 'evil-sage', phase: 'warning', phaseMs: 250, animationMs: 250 });
assert.equal(charging.source.y, 189, 'Sage plays charge, without moving/running, during its warning');
for (const [id, attacks] of Object.entries(BOSS_ATTACKS)) for (const move of attacks) {
  assert(ENEMY_VISUALS[id][move.clip], `${id} has the authored ${move.clip} clip`);
  if (move.followup) assert(ENEMY_VISUALS[id][move.followup], `${id} has authored followup ${move.followup}`);
}
// Every root curve stays bound to its exact clip, including after long frames.
// A different attack never inherits the slash's saved translation.
for (const [id, curve] of Object.entries(ATTACK_ROOT_X)) {
  assert.equal(attackFrameRoot(id, 1e6), curve.at(-1));
  assert.equal(attackMotionRoot(id, 1e6, 1000), curve.at(-1));
  assert.equal(attackMotionRoot(id, 1000, 1000, 'idle'), 0);
}
for (const [id, clips] of Object.entries(CLIP_ROOT_X)) for (const [clipName, curve] of Object.entries(clips)) {
  const clip = ENEMY_VISUALS[id][clipName];
  assert.equal(curve.length, clip.frames, `${id}/${clipName} uses exactly one root sample per cell`);
  assert.equal(attackMotionRoot(id, -100, 1000, clipName), curve[0]);
  assert.equal(attackMotionRoot(id, 10000, 1000, clipName), curve.at(-1));
  for (const facing of [-1, 1]) for (const step of [8, 17, 33, 151]) {
    let worldX = 1000, last = 0;
    for (let elapsed = step; elapsed <= 1000 + step; elapsed += step) {
      const root = attackMotionRoot(id, Math.min(1000, elapsed), 1000, clipName);
      worldX += (root - last) * clip.scale * facing * clip.authoredFacing;
      last = root;
    }
    assert(Math.abs(worldX - (1000 + curve.at(-1) * clip.scale * facing * clip.authoredFacing)) < 1e-6,
      `${id}/${clipName}: committed final root is independent of frame interval and facing`);
  }
}
assert.equal(attackFrameRoot('archer', 25, 'tele'), 0);
assert.equal(attackFrameRoot('shock-sweeper', 99, 'slam'), 9);
assert.equal(attackFrameRoot('dagger-mush', 99, 'spin'), 86);
console.log('Boss clips checks passed: exact laser/charge/vanish/jump crops, original Shielder variation, separate bow body, clip-bound root motion and complete attack references.');
