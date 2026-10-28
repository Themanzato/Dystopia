/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/game/tutorialAssets.ts');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  module: moduleObject, exports: moduleObject.exports,
  require: name => {
    assert(name.endsWith('.png'), 'No gameplay/system dependency in the asset frame helper');
    return path.resolve(path.dirname(filename), name);
  },
});
const { TUTORIAL_DUMMY_SOURCES, DUMMY_CELL, DUMMY_ANIMATIONS, DUMMY_HIT_MS, DUMMY_BREAK_MS, tutorialDummyFrame } = moduleObject.exports;
const originalHashes = {
  IDLE: '9df25633cfbf03921577bc836edfb55b0f190710222ee5ff91c463a67bd15001',
  HIT: 'af0d081c09d25f4cb880546529c412344e75d4e0741947a0f9670fe4a8fe7e2b',
  BREAKING: 'c83e8c9d5bf549a8ffb89680c8e53acecb027c4cd27153d628011651e0aaf93e',
};
const images = Array.from(TUTORIAL_DUMMY_SOURCES, source => {
  const bytes = fs.readFileSync(source), name = path.basename(source, '.png');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), originalHashes[name], 'Original image is preserved: ' + name);
  return PNG.sync.read(bytes);
});
assert.deepEqual(images.map(image => [image.width,image.height]), [[80,48],[560,48],[720,48]]);
assert.equal(DUMMY_CELL.width, 80); assert.equal(DUMMY_CELL.height, 48);
assert.equal(DUMMY_CELL.pivotX, 40); assert.equal(DUMMY_CELL.pivotY, 44);
assert.equal(DUMMY_CELL.scale, 1.25);
assert.equal(DUMMY_HIT_MS, 500); assert.equal(DUMMY_BREAK_MS, 750);
let auditedFrames = 0;
for (const [action, clip] of Object.entries(DUMMY_ANIMATIONS)) {
  const image = images[clip.image];
  assert.equal(image.width, clip.frames * 80, action + ' uses every cell and no neighboring object');
  for (let index=0;index<clip.frames;index++) {
    const age = clip.fps ? index * 1000 / clip.fps + 0.01 : 100000;
    const frame = tutorialDummyFrame(action, age), s=frame.source;
    assert.equal(frame.frame,index); assert.equal(frame.visible,true);
    assert.equal(s.x,index*80); assert.equal(s.y,0); assert.equal(s.width,80); assert.equal(s.height,48);
    assert(s.x>=0 && s.x+s.width<=image.width && s.y+s.height<=image.height);
    let pixels=0,transparent=0,maxY=-1;
    for(let y=0;y<48;y++)for(let x=0;x<80;x++){
      const offset=(y*image.width+s.x+x)*4,alpha=image.data[offset+3];
      if(alpha){pixels++;maxY=Math.max(maxY,y);}else transparent++;
    }
    assert(pixels>0 && transparent>pixels,'Each crop contains one transparent original sprite');
    assert.equal(maxY,43,'Every pose/debris frame retains its original grounded foot anchor');
    auditedFrames++;
  }
  assert.equal(tutorialDummyFrame(action,-100).frame,0,'No negative crop');
  assert.equal(tutorialDummyFrame(action,100000).frame,clip.frames-1,'One-shots clamp instead of looping/resetting');
  if(clip.fps)assert.equal(clip.durationMs,clip.frames*1000/clip.fps,'Duration agrees with full frame count');
}
// A white silhouette is the authored first impact/destruction frame, not an
// accidental wrong crop. Keep it, and retain the final visible destruction debris.
for(const image of [images[1],images[2]]){
  for(let y=0;y<48;y++)for(let x=0;x<80;x++){
    const p=(y*image.width+x)*4;if(image.data[p+3])assert.equal(image.data[p]+image.data[p+1]+image.data[p+2],765);
  }
}
assert.equal(tutorialDummyFrame('idle',0).frame,0); assert.equal(tutorialDummyFrame('idle',999999999).frame,0);
assert.equal(tutorialDummyFrame('gone',0).visible,false);
const component=fs.readFileSync(path.join(root,'src/game/TutorialEffects.tsx'),'utf8');
assert(component.includes('FilterMode.Nearest') && component.includes('MipmapMode.None'));
assert(component.includes('useSharedImage'),'Reuse Android-safe source resolution and decoded image cache');
assert(!/setInterval|setTimeout|useFrameCallback/.test(component),'Renderer has no private clock/timer that can run after pause');
assert.equal((component.match(/<DummyAtlas /g)||[]).length,3,'Bounded atlas nodes, only the active clip emits its single sprite');
console.log(`Tutorial assets passed: ${auditedFrames} original cells, stable transparent foot anchors, exact crops, static idle, full one-shot frames, original SHA-256 and nearest pixel-art rendering; chosen 500/750ms playback, no physical-device claim.`);
