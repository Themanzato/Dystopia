/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const root = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(root, 'package.json'));
const ts = req('typescript'), react = req('react');
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
Module._extensions['.png'] = (module, filename) => { module.exports = filename; };
const original = Module._load;
const Scene = () => null;
Module._load = function(name, parent, main) {
  if (name === './OptionalEventEffects') return {OptionalEventGround:()=>null};
  if (name === 'react') return { ...react, useEffect: callback => callback(), useMemo: callback => callback() };
  if (name === 'react-native-reanimated') return { useDerivedValue: callback => ({ get value() { return callback(); } }) };
  if (name === '@shopify/react-native-skia') return {
    Atlas: 'Atlas', Group: 'Group', Path: 'Path', FilterMode: { Nearest: 'Nearest' }, MipmapMode: { None: 'None' },
    rect: (x, y, width, height) => ({ x, y, width, height }), useImage: source => source,
    Skia: { RSXform: (scale, skew, x, y) => ({ scale, skew, x, y }), Color: color => color,
      PathBuilder: { Make() { const commands = []; return { addCircle(...args) { commands.push(['circle', ...args]); },
        addOval(box) { commands.push(['oval', box]); }, addRect(box) { commands.push(['rect', box]); }, moveTo(...args) { commands.push(['move', ...args]); }, lineTo(...args) { commands.push(['line', ...args]); }, close() { commands.push(['close']); }, detach: () => commands }; } } },
  };
  if (name === '../ui/sharedImages') return { useSharedImage: source=>source, useSharedImageState: source => ({ image: source, error: false }) };
  if (name === '../ui/pixelFontAsset') return { PIXEL_FONT_SOURCE: 'original-ui-font' };
  if (name === './WorldEventEffects') return {WorldEventGround:()=>null};
  if (name === './Scene') return { Scene };
  return original.call(this, name, parent, main);
};
const { createSurvival, SURVIVAL_CONFIG } = req('./src/game/survival.ts');
const { createPlayer } = req('./src/game/player.ts');
const { createEncounter } = req('./src/game/encounter.ts');
const { ActorsScene } = req('./src/game/ActorsScene.tsx');
const { BattleEffects } = req('./src/game/BattleEffects.tsx');
const player = { value: createPlayer() }, encounter = { value: createEncounter() }, survival = { value: createSurvival() };
const boss = id => ({ id, name: id, x: 120, y: 150, hp: 8, maxHp: 8, facingX: 1, phase: 'warning', phaseMs: 200,
  animationMs: 200, pattern: 0, lastHitSerial: -1, aimAngle: 0 });
survival.value.boss = boss('rock-boss');
survival.value.minibosses = ['skeleton-unarmed', 'skeleton-archer', 'skeleton-swordsman'].map((id,i) => ({ ...boss(id), entityId:i+1 }));
for (let i = 0; i < 60; i++) survival.value.encounter.enemies[i] = { ...survival.value.encounter.enemies[i], active: true, id: i + 1, action: 'move' };
let tree = ActorsScene({ player, encounter, survival, active: true, onError: e => { throw e; }, onReady() {}, onActorsReady() {} });
assert.equal(tree.type, Scene); assert.equal(tree.props.actorCapacity, 82);
const actors = tree.props.actors.value;
assert.equal(actors.length, 65); assert.equal(new Set(actors.map(a => a.id)).size, 65, 'All 60 NPC + hero + one special + three normal supports fit unique bounded slots');
assert.equal(actors.find(a => a.image === 6).opacity,1);survival.value.boss.hitFlashMs=200;assert(tree.props.actors.value.find(a=>a.image===6).opacity<1,'Real damage timer briefly blinks the existing actor without replacing its frame');survival.value.boss.hitFlashMs=0;
assert.equal(actors.find(a => a.image === 6).facingX, -1, 'Left-facing Rock artwork is flipped for logical right');
assert.equal(actors.filter(a => a.id>=1000001).length,3,'Three normal supports retain unique drawing slots');
survival.value.chests = [{ id: 1, x: 200, y: 300, phase: 'opening', phaseMs: 450 }];
tree = BattleEffects({ survival, player });
function all(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  const children = Array.isArray(tree.props?.children) ? tree.props.children.flat(Infinity) : [tree.props?.children];
  return [...(tree.type === type ? [tree] : []), ...children.flatMap(child => all(child, type))];
}
const allAtlases=all(tree,'Atlas'),atlases=allAtlases.slice(1), paths=all(tree,'Path');
assert(allAtlases[0].props.image.endsWith('Electric Hit 2.png'),'Only EXP atlas uses the reviewed existing effect');
assert.equal(paths.length,0,'No exact boss hitbox geometry remains; EXP uses its own original FX texture');
assert.equal(atlases[0].props.sprites.value[0].x, 32 * 22, 'Half-opened chest uses authored opening cell');
assert.equal(atlases[0].props.sprites.value[0].width, 22);
assert.equal(atlases[2].props.sprites.value.length, 0, 'No reward text before opening finishes');
survival.value.chests[0] = { ...survival.value.chests[0], phase: 'reward', phaseMs: 0, rewardText: 'Paso ligero', rewardGranted: true };
assert.equal(atlases[0].props.sprites.value[0].x, 39 * 22);
assert.equal(atlases[2].props.sprites.value.length, 10);
const positions = atlases[2].props.transforms.value;
assert(positions.every(p => p.y < 300 - 39), 'Reward glyphs stay above the chest, never below it');
assert(positions[0].x < 200 && positions.at(-1).x > 200, 'Reward label is centered on its chest');
assert.equal(atlases[0].props.colors.value[0], 'rgba(255,255,255,1)');
survival.value.chests[0].phaseMs = SURVIVAL_CONFIG.chestRewardMs - 100;
assert(!atlases[0].props.colors.value[0].endsWith(',1)'), 'Chest fades before removal');
survival.value.chests = [];
assert.equal(atlases[0].props.sprites.value.length, 0); assert.equal(atlases[2].props.sprites.value.length, 0);
assert(atlases.every(a => a.props.sampling.filter === 'Nearest'), 'Original pixel sprites and letters remain nearest sampled');
const originalPlayer=player.value,originalFrenesis=survival.value.frenesis;
const frTree=ActorsScene({player,encounter,survival,active:true,onError:e=>{throw e;},onReady(){},onActorsReady(){}});
const {FRENESIS_SOURCES}=req('./src/game/frenesisAssets.ts');
survival.value.frenesis={...originalFrenesis,active:true,remainingMs:14000};
for(const [kind,index]of [['slash1',2],['slash2',3],['slices',6]])for(const facing of [-1,1]){
 player.value={...originalPlayer,frenesis:true,action:'attack',frenesisAttack:kind,actionMs:150,facingX:facing};
 const drawn=frTree.props.actors.value.filter(a=>a.id===0);assert.equal(drawn.length,1,'Exactly one principal body, never a duplicate spin overlay');
 assert.equal(frTree.props.actorImages[drawn[0].image],FRENESIS_SOURCES[index]);assert.equal(drawn[0].facingX,facing*([2,3].includes(index)?-1:1),'Left-authored slash art is mirrored into the logical aim; spin remains radial');
}
player.value=originalPlayer;survival.value.frenesis=originalFrenesis;
console.log('Frenesis actor rendering passed: exclusive Slash1/Slash2/Slices original main image in both facings, one actor and no idle body fallback.');
console.log('Battle render checks passed: 60 NPC + special + 3 normal supports, correct facing, hidden hitbox geometry, EXP texture, true chest opening, centered reward glyphs and cleanup.');
// The joint bandit encounter has two independent draw actors and no permanent corpse.
survival.value.partner = { ...boss('archer-bandit'), entityId: 900 };
tree = ActorsScene({ player, encounter, survival, active: true, onError: e => { throw e; }, onReady() {}, onActorsReady() {} });
assert.equal(tree.props.actors.value.length, 66);
assert(tree.props.actors.value.some(a => a.id === 1000900), 'The living partner is rendered independently');
survival.value.partner = { ...survival.value.partner, hp: 0, phase: 'death', phaseMs: 999999 };
assert.equal(tree.props.actors.value.length, 65, 'A finished bandit corpse does not stick to its encounter');
const { BossEffects } = req('./src/game/BossCombatEffects.tsx');
survival.value.hazards = [{id:1,owner:2,kind:'beam',fx:'archerBeam',x:120,y:150,angle:Math.PI/4,radius:10,length:750,warningMs:600,activeMs:700,ageMs:100,damage:1}];
let effects = BossEffects({survival,player});
const effectPaths = all(effects,'Path');
assert.equal(effectPaths.length,0,'No explicit warning/hitbox shape is drawn for a boss attack');
survival.value.hazards[0].ageMs = 700;
assert.equal(all(effects,'Path').length,0,'Active attacks also retain sprites without overlaid hitbox shapes');
assert.equal(effects.props.children.flat(Infinity).filter(Boolean).length,12,'Twelve bounded original FX atlases, without geometry overlays');
console.log('Joint partner, corpse cleanup, sprite-only hazard effects and fixed-size effect tree passed.');
const {MERCHANT_ART,MERCHANT_SOURCES,merchantFrame}=req('./src/game/merchantAssets.ts');
for(const kind of ['traveler','gem','fruit','scavenger']){
  const art=MERCHANT_ART[kind];
  survival.value.merchants={active:{id:11,kind,x:300,y:400,ageMs:650}};
  const a=tree.props.actors.value.find(a=>a.id===2000011);
  assert(a);assert.equal(tree.props.actorImages[a.image],MERCHANT_SOURCES[art.image]);
  assert.deepEqual(a.source,merchantFrame(kind,650));assert.equal(a.depth,400);assert.equal(a.pivotY,art.pivotY);assert.equal(a.scale,art.scale);
}
survival.value.merchants=null;assert(!tree.props.actors.value.some(a=>a.id===2000011),'Expired merchants leave no render actor');
console.log('Four merchant actors passed: bounded extra slot, original images/frames, stable feet/depth/scale and expiry cleanup.');

// Training art is appended only to a tutorial session, never between existing
// player/enemy/Frenesis/merchant images. ActorLayers sorts this practice actor
// by its real foot coordinate just like the Swordmaster and city obstacles.
const normalImages = tree.props.actorImages.slice();
const { TUTORIAL_DUMMY_SOURCES, DUMMY_CELL } = req('./src/game/tutorialAssets.ts');
assert(normalImages.every(image=>!TUTORIAL_DUMMY_SOURCES.includes(image)),'Normal games contain no practice sheets');
survival.value.tutorial={step:'dummy',target:null,dummy:{x:player.value.x+45,y:player.value.y+10,action:'idle',elapsedMs:0}};
tree=ActorsScene({player,encounter,survival,training:true,active:true,onError:e=>{throw e;},onReady(){},onActorsReady(){}});
assert.equal(tree.props.actorCapacity,83,'One bounded extra actor slot, only for tutorial');
assert.deepEqual(tree.props.actorImages.slice(0,normalImages.length),normalImages,'Every preexisting actor image index remains stable');
assert.deepEqual(tree.props.actorImages.slice(normalImages.length),Array.from(TUTORIAL_DUMMY_SOURCES));
for(const [action,elapsedMs,imageIndex,frame] of [['idle',99999,0,0],['hit',320,1,4],['breaking',720,2,8]]){
 survival.value.tutorial.dummy={...survival.value.tutorial.dummy,action,elapsedMs};
 const actor=tree.props.actors.value.find(a=>a.id===3000000);assert(actor);
 assert.equal(tree.props.actorImages[actor.image],TUTORIAL_DUMMY_SOURCES[imageIndex]);
 assert.equal(actor.source.x,frame*80);assert.equal(actor.source.width,80);assert.equal(actor.source.height,48);
 assert.equal(actor.scale,DUMMY_CELL.scale);assert.equal(actor.pivotX,40);assert.equal(actor.pivotY,44);assert.equal(actor.depth,actor.y);
}
for(const delta of [-20,20]){survival.value.tutorial.dummy.y=player.value.y+delta;const actor=tree.props.actors.value.find(a=>a.id===3000000);assert.equal(actor.depth-player.value.y,delta,'Depth follows the feet on either side of the player');}
survival.value.tutorial.dummy.action='gone';assert(!tree.props.actors.value.some(a=>a.id===3000000));
delete survival.value.tutorial;
console.log('Tutorial dummy actor passed: 3 conditional sheets appended after existing indices, exact frame sources, stable scale/feet/depth, one extra slot and gone cleanup.');
