/* global __dirname */
const assert = require('node:assert/strict');
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const zlib = require('node:zlib');
const root = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };
const { ENEMY_DEFS, BOSS_IDS, MINIBOSS_IDS, MINION_IDS } = req('./src/game/enemyCatalog.ts');
const { ENEMY_VISUALS } = req('./src/game/enemyAnimations.ts');
const { bossFrame } = req('./src/game/survivalAssets.ts');
const vm=require('node:vm');
const baseline={exports:{}};
const rawSource=fs.readFileSync(path.join(root,'src/game/enemyAnimations.ts'),'utf8').split('// Apply once to every authored clip')[0];
vm.runInNewContext(ts.transpileModule(rawSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:baseline,exports:baseline.exports,require:id=>req(path.resolve(root,'src/game',id+'.ts'))});
const requested={shielder:1.2,'evil-sage':1.2,'dagger-mush':1.2,'shock-sweeper':1.2,guardian:1.3,'skeleton-summoner':1.2,'dust-jumper':1.2,electrocutioner:1.2};
for(const [id,visual]of Object.entries(baseline.exports.ENEMY_VISUALS))for(const [action,clip]of Object.entries(visual)){
 const actual=ENEMY_VISUALS[id][action];assert(Math.abs(actual.scale/clip.scale-(requested[id]??1))<1e-12,id+' '+action+' exact requested world size');
 for(const key of ['x','y','width','height','frames','pivotX','pivotY','image'])assert.equal(actual[key],clip[key],id+' keeps original crops and feet');
}
console.log('Boss scales passed: all clips +20%, Guardian +30%, unrelated enemies unchanged; original crops, pivots and frame counts preserved.');
const sources = Array.from(fs.readFileSync(path.join(root, 'src/game/enemyVisuals.ts'), 'utf8')
  .matchAll(/require\('([^']+\.png)'\)/g), match => path.resolve(root, 'src/game', match[1]));
assert.equal(sources.length, 34);
assert.equal(MINIBOSS_IDS.length, 6); assert.equal(BOSS_IDS.length, 8); assert.equal(MINION_IDS.length, 3);
const ids = [...MINIBOSS_IDS, ...BOSS_IDS, ...MINION_IDS];
assert.equal(new Set(ids).size, 17); assert.equal(Object.keys(ENEMY_VISUALS).length, 17);
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

const pngs = sources.map(readRgbaPng);
let totalFrames = 0;
for (const id of ids) {
  const def = ENEMY_DEFS[id], visual = ENEMY_VISUALS[id];
  assert(def.hp >= 1 && def.speed > 0 && def.attackDurationMs > def.activeEndMs && def.activeEndMs > def.activeStartMs);
  if (def.tier === 'minion') assert.equal(def.hp, 1);
  for (const [phase, clip] of Object.entries(visual)) {
    const png = pngs[clip.image - 5]; assert(png, `Loaded original texture for ${id}/${phase}`);
    assert(clip.frames >= 1 && clip.scale > 0 && [1, -1].includes(clip.authoredFacing));
    let visibleFrames = 0;
    for (let i = 0; i < clip.frames; i++) {
      const x = clip.x + i * clip.stepX, y = clip.y + i * clip.stepY;
      assert(x >= 0 && y >= 0 && x + clip.width <= png.width && y + clip.height <= png.height, `${id}/${phase}/${i} stays in its sheet`);
      let alpha = false;
      for (let yy = y; yy < y + clip.height && !alpha; yy++) for (let xx = x; xx < x + clip.width; xx++) {
        if (png.pixels[(yy * png.width + xx) * 4 + 3]) { alpha = true; break; }
      }
      if (alpha) visibleFrames++;
      totalFrames++;
    }
    assert(visibleFrames > 0, `${id}/${phase} contains authored art`);
  }
  for (const phase of ['intro', 'warning', 'attack', 'recover', 'death']) {
    for (const ms of [0, 83, 500, 1000, 10000]) {
      const frame = bossFrame({ id, phase, phaseMs: ms, animationMs: ms });
      const png = pngs[frame.image - 5], s = frame.source;
      assert(s.x >= 0 && s.y >= 0 && s.x + s.width <= png.width && s.y + s.height <= png.height, `${id}/${phase} runtime crop`);
      assert(Number.isFinite(frame.pivotX) && Number.isFinite(frame.pivotY));
    }
  }
  const death0 = bossFrame({ id, phase: 'death', phaseMs: 0, animationMs: 0 });
  const deathEnd = bossFrame({ id, phase: 'death', phaseMs: def.deathDurationMs, animationMs: 1e6 });
  assert.notDeepEqual(death0.source, deathEnd.source, `${id} has a real authored death sequence`);
}
// Compare every authored cell, not just the first frame: several strips begin
// with identical poses on different rows (notably Shock Sweeper wake vs idle).
const stripChecks = [["shielder", "idle", "enemies/mini bosses/Shielder/walk.png"], ["shielder", "move", "enemies/mini bosses/Shielder/walk.png"], ["shielder", "attack", "enemies/mini bosses/Shielder/attack.png"], ["shielder", "death", "enemies/mini bosses/Shielder/death.png"], ["archer", "idle", "enemies/mini bosses/Archer/idle.png"], ["archer", "move", "enemies/mini bosses/Archer/run.png"], ["archer", "attack", "enemies/mini bosses/Archer/attack.png"], ["archer", "death", "enemies/mini bosses/Archer/death.png"], ["dagger-mush", "idle", "enemies/mini bosses/Dagger Mush/idle.png"], ["dagger-mush", "move", "enemies/mini bosses/Dagger Mush/run.png"], ["dagger-mush", "attack", "enemies/mini bosses/Dagger Mush/attacks.png"], ["dagger-mush", "death", "enemies/mini bosses/Dagger Mush/death.png"], ["shock-sweeper", "idle", "enemies/mini bosses/Shock Sweeper/static idle.png"], ["shock-sweeper", "move", "enemies/mini bosses/Shock Sweeper/shuffe(move).png"], ["shock-sweeper", "attack", "enemies/mini bosses/Shock Sweeper/Sweep with VFX.png"], ["shock-sweeper", "intro", "enemies/mini bosses/Shock Sweeper/wake.png"], ["shock-sweeper", "death", "enemies/mini bosses/Shock Sweeper/death.png"], ["guardian", "idle", "bosses/ancient guard/Guardian-Idle.png"], ["guardian", "attack", "bosses/ancient guard/Guardian-AOE.png"], ["guardian", "intro", "bosses/ancient guard/Guardian-Appear.png"], ["guardian", "death", "bosses/ancient guard/Guardian-death.png"], ["skeleton-summoner", "idle", "bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Idle.png"], ["skeleton-summoner", "move", "bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Walk.png"], ["skeleton-summoner", "attack", "bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Attack.png"], ["skeleton-summoner", "death", "bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Death.png"], ["dagger-bandit", "idle", "bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Idle.png"], ["dagger-bandit", "move", "bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Run.png"], ["dagger-bandit", "attack", "bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Attack.png"], ["dagger-bandit", "intro", "bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Appear.png"], ["dagger-bandit", "death", "bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Death.png"], ["archer-bandit", "idle", "bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Idle.png"], ["archer-bandit", "move", "bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Run.png"], ["archer-bandit", "attack", "bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Attack 1.png"], ["archer-bandit", "intro", "bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Appear.png"], ["archer-bandit", "death", "bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Death.png"], ["skeleton-unarmed", "idle", "bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed-Idle.png"], ["skeleton-unarmed", "move", "bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed-Run.png"], ["skeleton-unarmed", "attack", "bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed-Attack.png"], ["skeleton-unarmed", "intro", "bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed-Summonned.png"], ["skeleton-unarmed", "death", "bosses/SKELETON SUMMONER/Skeleton - Unarmed/Skeleton - Unarmed-Death.png"], ["skeleton-archer", "idle", "bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer-Idle.png"], ["skeleton-archer", "move", "bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer-Run.png"], ["skeleton-archer", "attack", "bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer-Attack.png"], ["skeleton-archer", "intro", "bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer-Summonned.png"], ["skeleton-archer", "death", "bosses/SKELETON SUMMONER/Skeleton Archer/Skeleton Archer-Death.png"], ["skeleton-swordsman", "idle", "bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman-Idle.png"], ["skeleton-swordsman", "move", "bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman-Run.png"], ["skeleton-swordsman", "attack", "bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman-Attack.png"], ["skeleton-swordsman", "intro", "bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman-Summonned.png"], ["skeleton-swordsman", "death", "bosses/SKELETON SUMMONER/Skeleton Swordsman/Skeleton - Armored Swordsman-Death.png"]];
stripChecks.push(['guardian','blast','bosses/ancient guard/Guardian-Blast.png'], ['guardian','laser','bosses/ancient guard/Guardian-Laser.png'], ['skeleton-summoner','summon','bosses/SKELETON SUMMONER/Summoner/Skeleton Summoner-Summon.png'], ['dagger-bandit','fang','bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Bat Fang Attack.png'], ['archer-bandit','evade','bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit-Vanish.png']);
stripChecks.push(['archer','special','enemies/mini bosses/Archer/special attack.png'], ['dagger-mush','spin','enemies/mini bosses/Dagger Mush/Air attack.png'], ['dagger-mush','fast','enemies/mini bosses/Dagger Mush/run fast.png'], ['shock-sweeper','slam','enemies/mini bosses/Shock Sweeper/slam with VFX.png'], ['shock-sweeper','spin','enemies/mini bosses/Shock Sweeper/Spin Slam with VFX.png'], ['guardian','tele','bosses/ancient guard/Guardian-tele.png'], ['dagger-bandit','evade','bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit-Vanish.png']);
let comparedCells = 0;
for (const [id, phase, relative] of stripChecks) {
  const clip = ENEMY_VISUALS[id][phase], sheet = pngs[clip.image - 5];
  const strip = readRgbaPng(path.join(root, 'assets/assets', relative));
  const columns = strip.width / clip.width;
  assert.equal(columns % 1, 0);
  for (let n = 0; n < clip.frames; n++) {
    const sx = clip.x + n * clip.stepX, sy = clip.y + n * clip.stepY;
    const rx = n % columns * clip.width, ry = Math.floor(n / columns) * clip.height;
    for (let y = 0; y < clip.height; y++) {
      const first = ((sy + y) * sheet.width + sx) * 4, second = ((ry + y) * strip.width + rx) * 4;
      assert(sheet.pixels.subarray(first, first + clip.width * 4).equals(strip.pixels.subarray(second, second + clip.width * 4)), `${id}/${phase}/${n} matches original strip`);
    }
    comparedCells++;
  }
}
assert(comparedCells > 300);
assert.equal(ENEMY_VISUALS['shock-sweeper'].idle.frames, 1, 'A single original static idle stays static');
assert.equal(ENEMY_VISUALS.archer.attack.stepY, 25, 'Archer vertical strip uses 25px cells');
assert.equal(ENEMY_VISUALS['bomb-droid'].attack.stepY, 77, 'Bomb Droid attack uses its larger 116x77 cells');
assert.equal(ENEMY_VISUALS['rock-boss'].attack.authoredFacing, -1);
console.log(`Enemy catalog checks passed: 6 minibosses + 8 bosses + 3 Skeleton supports, ${totalFrames} authored cells, 34 original textures and clamped intro/attack/death animation.`);
