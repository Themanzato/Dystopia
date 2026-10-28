/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PNG } = require('pngjs');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { module, exports: module.exports, require: id => {
      assert(id.startsWith('.'), 'Landing frame logic stays asset/pure-data dependent');
      const target = path.resolve(path.dirname(filename), id);
      return target.endsWith('.png') ? target : load(path.relative(project, `${target}.ts`));
    } }, { filename });
  return module.exports;
}
const { bossFrame } = load('src/game/survivalAssets.ts');
const { bossAttack } = load('src/game/bossAttacks.ts');
const { dustJumpTimeline } = load('src/game/dustJumper.ts');
const { ENEMY_VISUALS } = load('src/game/enemyAnimations.ts');
function alphaBounds(image, source, mask = () => true) {
  assert(source.x>=0 && source.y>=0 && source.x+source.width<=image.width && source.y+source.height<=image.height);
  let minX=source.width,minY=source.height,maxX=-1,maxY=-1,count=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(mask(x,y) && image.data[((y+source.y)*image.width+x+source.x)*4+3]>0){
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;
  }
  return {minX,minY,maxX,maxY,count};
}
const cases = [
  {id:'dust-jumper',index:1,file:'assets/assets/bosses/Dust Jumper/Dust Jumper/Dust Jumper Sprite Sheet 42x91.png',size:[588,819],first:2,mask:(_x,y)=>y<78},
  {id:'tarnished-widow',index:2,file:'assets/assets/bosses/The Tarnished Widow 188x90/The Tarnished Widow 188x90.png',size:[3384,720],first:1,mask:(x)=>x>=52&&x<=115},
];
const results=[];
for(const item of cases){
  const sheet=PNG.sync.read(fs.readFileSync(path.join(project,item.file))),visual=ENEMY_VISUALS[item.id],clip=visual.landing,move=bossAttack(item.id,item.index);
  assert.equal(sheet.width,item.size[0]);assert.equal(sheet.height,item.size[1]);
  assert.equal(move.kind,'jump');assert.equal(move.followup,'landing');assert.equal(clip.frames,10);
  const source=frame=>({x:clip.x+frame*clip.stepX,y:clip.y+frame*clip.stepY,width:clip.width,height:clip.height});
  const airborne=alphaBounds(sheet,source(item.first-1),item.mask),landed=alphaBounds(sheet,source(item.first),item.mask);
  assert(airborne.count>20 && airborne.minY<20 && airborne.maxY<70,item.id+' previous frame has the real body airborne, not its ground shadow');
  assert(landed.count>100 && landed.minY>=45 && landed.maxY>=75,item.id+' first impact frame is the original grounded body');
  const groundFeet=alphaBounds(sheet,source(item.first));
  assert(Math.abs(groundFeet.maxY-clip.pivotY)*clip.scale<=3,item.id+' grounded feet align with the physical landing point');
  const firstImpactMs=move.durationMs*(move.split+(1-move.split)*item.first/clip.frames),frameMs=move.durationMs*(1-move.split)/clip.frames;
  assert(move.activeStartMs>=firstImpactMs,item.id+' damage cannot start while its body is still airborne');
  assert(move.activeStartMs<firstImpactMs+frameMs,item.id+' first damage stays inside the authored impact frame');
  assert(move.activeEndMs>move.activeStartMs && move.activeEndMs<=move.durationMs);
  for(const rate of [1,1.12,1.25,1.4]){
    const state={id:item.id,phase:'attack',animationMs:0,attackIndex:item.index,attackRate:rate};
    const contact = item.id==='dust-jumper' ? dustJumpTimeline(rate).impactMs : firstImpactMs/rate;
    const before=bossFrame({...state,phaseMs:contact-0.01}),first=bossFrame({...state,phaseMs:contact+0.01});
    assert.equal(before.image,clip.image);assert.equal(first.image,clip.image);
    assert.deepEqual(JSON.parse(JSON.stringify(before.source)),source(item.first-1),item.id+' actual bossFrame before contact');
    assert.deepEqual(JSON.parse(JSON.stringify(first.source)),source(item.first),item.id+' actual bossFrame on contact');
    const active=bossFrame({...state,phaseMs:item.id==='dust-jumper'?contact:move.activeStartMs/rate}),body=alphaBounds(sheet,active.source,item.mask);
    assert(body.minY>=45 && body.maxY>=75,item.id+' accelerated attack damage is rendered grounded');
  }
  results.push({id:item.id,authoredLandingFrame:item.first,visualContactMs:firstImpactMs,activeStartMs:move.activeStartMs});
}
console.log('Boss landing checks passed: original body alpha excludes Dust shadows, exact airborne/contact cells, feet/pivot alignment, damage timing and four animation rates. '+JSON.stringify(results));

// Original bottom-foot pixels, not the sword/body bounding box, define the
// transition anchor. Camera projection must not change this equality.
for(const [id,file,index] of [
 ['dagger-bandit','assets/assets/bosses/ARCHER AND DAGER/Dagger Bandit/Dagger Bandit Sprite Sheet 128x78.png',2],
 ['archer-bandit','assets/assets/bosses/ARCHER AND DAGER/Archer Bandit/Archer Bandit Sprite Sheet 85x112.png',1]]){
 const image=PNG.sync.read(fs.readFileSync(path.join(project,file))),move=bossAttack(id,index);
 const end=bossFrame({id,phase:'attack',phaseMs:move.durationMs-.01,animationMs:0,attackIndex:index,attackRate:1});
 const next=bossFrame({id,phase:'recover',phaseMs:0,animationMs:0,attackIndex:index,attackRate:1});
 function feet(frame){const c=frame.source;for(let y=c.height-1;y>=0;y--){const xs=[];for(let x=0;x<c.width;x++)if(image.data[((c.y+y)*image.width+c.x+x)*4+3]>128)xs.push(x);if(xs.length>2)return {x:((xs[0]+xs.at(-1))/2-frame.pivotX)*frame.scale,y:(y-frame.pivotY)*frame.scale};}throw Error('Missing feet');}
 const a=feet(end),b=feet(next);assert.equal(a.x,b.x,id+' foot X is identical across the real exit/recovery cells');assert.equal(a.y,b.y,id+' foot Y is identical across the real exit/recovery cells');
 for(const facing of [-1,1])for(const camera of [{x:500,y:300,scale:.7},{x:1400,y:1200,scale:1.2},{x:1800,y:2500,scale:2}]){
  assert.equal((1500+a.x*facing-camera.x)*camera.scale,(1500+b.x*facing-camera.x)*camera.scale);
  assert.equal((1400+a.y-camera.y)*camera.scale,(1400+b.y-camera.y)*camera.scale);
 }
}
console.log('Bandit foot anchors passed: original PNG alpha at final exit/first recovery, both facings and three camera projections.');
