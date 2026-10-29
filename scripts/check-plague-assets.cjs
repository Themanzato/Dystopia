/* global __dirname */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),{PNG}=require('pngjs'),root=path.resolve(__dirname,'..');
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
Module._extensions['.png']=(m,f)=>m.exports=f;
const {PLAGUE_VARIANTS,PLAGUE_SOURCE_PATHS,PLAGUE_VISUALS,PLAGUE_TIMING,plagueFrame,plagueWarningOpacity}=require(root+'/src/game/plagueAssets.ts');
const expected={small:[20,28,4,6,10,65],medium:[34,37,8,10,10,65],medium2:[88,37,8,8,11,70],big:[72,44,8,6,13,65]};
const aseprite={small:'Small Bug/Small Insect.aseprite',medium:'Medium Bug/Medium Insect.aseprite',medium2:'Medium bug 2/Medium2 bug.aseprite',big:'Big Bug/Big Insect.aseprite'};
const strips={small:['Small Bug/Small insect - idle move.png','Small Bug/Small Insect-Attack.png','Small Bug/Small Insect-Death.png'],medium:['Medium Bug/Medium Insect-idleMove.png','Medium Bug/Medium Insect-Attack.png','Medium Bug/Medium Insect-Death.png'],medium2:['Medium bug 2/Medium2 bug-Idle Move.png','Medium bug 2/Medium2 bug-Attack.png','Medium bug 2/Medium2 bug-Death.png'],big:['Big Bug/Big Insect-moveidle.png','Big Bug/Big Insect-Attack.png','Big Bug/Big Insect-Death.png']};
let checked=0;
for(const [index,id]of PLAGUE_VARIANTS.entries()){
 const visual=PLAGUE_VISUALS[id],timing=PLAGUE_TIMING[id],png=PNG.sync.read(fs.readFileSync(path.join(root,PLAGUE_SOURCE_PATHS[index]))),[w,h,idle,attack,death,frameMs]=expected[id];
 assert.deepEqual([visual.idle.width,visual.idle.height,visual.idle.frames,visual.attack.frames,visual.death.frames,timing.frameMs],[w,h,idle,attack,death,frameMs]);
 const ase=fs.readFileSync(path.join(root,'assets/assets/enemies/mini bosses/The plague',aseprite[id]));
 let offset=128;const frames=ase.readUInt16LE(6),tags=[];
 // The original files also contain untagged working frames. Exported actions
 // follow their actual named tags, never the full document timeline length.
 for(let i=0;i<frames;i++){
  assert.equal(ase.readUInt16LE(offset+8),frameMs,id+' source timing');const end=offset+ase.readUInt32LE(offset);
  for(let chunk=offset+16;chunk<end;){const size=ase.readUInt32LE(chunk);if(ase.readUInt16LE(chunk+4)===0x2018){let at=chunk+16;for(let n=0;n<ase.readUInt16LE(chunk+6);n++){const length=ase.readUInt16LE(at+17);tags.push({name:ase.toString('utf8',at+19,at+19+length),from:ase.readUInt16LE(at),to:ase.readUInt16LE(at+2)});at+=19+length;}}chunk+=size;}
  offset=end;
 }
 assert.equal(tags.length,3);assert.deepEqual(tags.map(t=>t.to-t.from+1),[idle,attack,death],'Real named source tags match each exported clip');
 assert.equal(timing.attackMs,attack*frameMs);assert.equal(timing.deathMs,death*frameMs);
 for(const [action,count]of [['idle',idle],['attack',attack],['death',death]]){
  const clip=visual[action];assert.equal(clip.y,action==='idle'?0:action==='attack'?h:2*h);assert.equal(clip.scale,2);
  const reference=PNG.sync.read(fs.readFileSync(path.join(root,'assets/assets/enemies/mini bosses/The plague',strips[id][action==='idle'?0:action==='attack'?1:2])));
  assert.equal(reference.width,w*count);assert.equal(reference.height,h,'Use the entire audited exported animation strip');
  const hashes=new Set();let visibleFrames=0;
  for(let frame=0;frame<count;frame++){
   const x=clip.x+frame*clip.stepX,y=clip.y+frame*clip.stepY;assert(x+w<=png.width&&y+h<=png.height);
   const pixels=[];let opaque=0,transparent=0;
   for(let yy=0;yy<h;yy++){
    const actual=((y+yy)*png.width+x)*4,original=(yy*reference.width+frame*w)*4;
    assert(png.data.subarray(actual,actual+w*4).equals(reference.data.subarray(original,original+w*4)),id+'/'+action+'/'+frame+' every source pixel matches the original strip');
   }
   for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const at=((y+yy)*png.width+x+xx)*4;pixels.push(...png.data.subarray(at,at+4));if(png.data[at+3])opaque++;else transparent++;}
   if(opaque>0)visibleFrames++;
   assert(transparent>0&&(action==='death'||opaque>0),id+'/'+action+'/'+frame+' original transparency and authored disappearance');hashes.add(pixels.join(','));checked++;
  }
  assert(hashes.size>1&&visibleFrames>0,id+'/'+action+' genuine animation, not static art');
 }
 for(const phase of ['intro','warning','recover','attack','death'])for(const ms of [0,65,130,420,850,99999]){
  const frame=plagueFrame({phase,phaseMs:ms,animationMs:ms,plague:{variant:id},attackRate:1.2});assert.equal(frame.image,index+39);
  assert(frame.source.x>=0&&frame.source.x+frame.source.width<=png.width&&frame.source.y+frame.source.height<=png.height);
  assert(Number.isFinite(frame.pivotX)&&Number.isFinite(frame.pivotY));
 }
 for(let i=0;i<attack;i++){
  const frame=plagueFrame({phase:'attack',phaseMs:i*frameMs+0.1,animationMs:999999,plague:{variant:id}});
  assert.equal(frame.source.x,i*w,'Attack follows the authored frame order independently of the flight clock');assert.equal(frame.source.y,h);
 }
 for(let ms=0;ms<800;ms+=7){
  const warning=plagueFrame({phase:'warning',phaseMs:ms,animationMs:999999,plague:{variant:id}});
  assert.equal(warning.source.y,0,'Windup uses authored wing flutter rather than premature strike poses');
  assert.equal(warning.source.x,Math.floor(ms/(frameMs/1.7))%idle*w,'Windup advances independently of roaming clock');
  const opacity=plagueWarningOpacity({phase:'warning',phaseMs:ms});assert(opacity>=.68&&opacity<=1,'The warning pulse remains visible and bounded');
 }
 assert.equal(plagueWarningOpacity({phase:'recover',phaseMs:999}),1,'No warning pulse leaks into locomotion');
 assert.equal(plagueWarningOpacity({phase:'attack',phaseMs:999}),1,'No warning pulse competes with the attack');
 assert.equal(plagueFrame({phase:'death',phaseMs:timing.deathMs,animationMs:0,plague:{variant:id}}).visible,false,'Finished death cells leave no permanent corpse');
}
console.log('The Plague assets passed: four original sheets, '+checked+' authored cells (including transparent death tails), exact .aseprite tags/frame durations/order, bounded runtime crops and once-only death playback.');
