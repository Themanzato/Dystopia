/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { PNG } = require('pngjs');
const ts = require('typescript');
const root = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const filename = path.join(root, 'src/game/bossEffects.ts'), moduleFx = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
  { module: moduleFx, exports: moduleFx.exports, require: id => { const file = path.resolve(path.dirname(filename), id); assert(fs.existsSync(file), `Original exists: ${id}`); return file; } }, { filename });
const fx = moduleFx.exports, sheets = fx.BOSS_FX_KEYS.map(key => PNG.sync.read(fs.readFileSync(fx.BOSS_FX_ASSETS[key])));
assert.equal(sheets.length, 12);
const expected = [[656,65],[1918,39],[548,156],[174,350],[256,37],[980,103],[88,300],[1938,70],[592,111],[1148,65],[189,10],[2826,122]];
expected.forEach(([width,height], i) => { assert.equal(sheets[i].width,width); assert.equal(sheets[i].height,height); });
function checkCrop(sheet, crop, label) {
  assert(crop.x>=0 && crop.y>=0 && crop.width>0 && crop.height>0);
  assert(crop.x+crop.width<=sheet.width && crop.y+crop.height<=sheet.height, label);
  let alpha = 0;
  for(let y=crop.y;y<crop.y+crop.height;y++)for(let x=crop.x;x<crop.x+crop.width;x++)alpha += sheet.data[(y*sheet.width+x)*4+3];
  assert(alpha>0, `${label} contains real artwork`);
}
let frames = 0;
for (const [key, clip] of Object.entries(fx.BOSS_FX_CLIPS)) for(let i=0;i<clip.frames;i++) {
  const crop = fx.fxFrame(clip, (i+0.05)/clip.frames);
  checkCrop(sheets[clip.image], crop, `${key} frame ${i}`); frames++;
}
assert.equal(fx.BOSS_FX_CLIPS.sageDark.frames,13,'Empty final cells excluded');
assert.equal(fx.BOSS_FX_CLIPS.sageCyan.frames,13,'4x4 layout has only 13 populated cells');
const hazard = { id:1,owner:3,kind:'beam',fx:'archerBeam',x:100,y:140,angle:Math.PI/3,radius:10,length:973,ageMs:600,warningMs:600,activeMs:450,damage:1 };
assert(!fx.hazardIsActive({...hazard,ageMs:599})); assert(fx.hazardIsActive(hazard)); assert(!fx.hazardIsActive({...hazard,ageMs:1050}));
assert.equal(fx.hazardDraws({...hazard,ageMs:599}).length,0,'Beam warning cannot draw an active laser');
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/3]) {
  const draws=fx.beamDraws({...hazard,angle}); let end=0;
  for(const d of draws) {
    const start=(d.x-hazard.x)*Math.cos(angle)+(d.y-hazard.y)*Math.sin(angle);
    assert(Math.abs(start-end)<1e-8,'Adjacent tiles meet exactly');
    assert.equal(d.scale,4,'Pixel scale is uniform and integral');
    checkCrop(sheets[d.image],d.source,'laser tile'); end=start+d.source.width*d.scale;
  }
  assert(Math.abs(end-hazard.length)<1e-8,'Last tile ends at exact collision length');
  assert(draws.length<=193,'Bounded per-beam draw count');
}
const sage={...hazard,kind:'blast',fx:'sageCyan',warningMs:700,activeMs:700};
assert.equal(fx.hazardDraws({...sage,ageMs:699})[0].source.y,0,'Charging frames precede the explosion');
assert.equal(fx.hazardDraws({...sage,ageMs:700})[0].source.y,39,'Explosion starts on its impact frame');
assert.equal(fx.hazardDraws({...sage,ageMs:1400}).length,0,'Expired effects leave no sprite');
const source=fs.readFileSync(path.join(root,'src/game/BossCombatEffects.tsx'),'utf8');
assert(source.includes("move.clip !== 'bow'"),'Separate bow only renders during its real shooting action');
assert(source.includes('state.poisonMs')&&source.includes('state.stunMs'),'Status sprites follow simulation lifetime');
assert(!/useFrameCallback|setInterval|setTimeout/.test(source),'No independent visual clock survives pause/unmount');
console.log(`Boss FX: ${frames} original nonempty frames, exact laser tiling/rotation, real charge/impact timing and bounded atlas rendering passed.`);
