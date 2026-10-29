/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), babel = require('@babel/core');
const root = path.resolve(__dirname, '..'), cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const raw = fs.readFileSync(filename, 'utf8');
  const code = /(?:survival|plague|purgatorio)\.ts$/.test(filename) ? babel.transformSync(raw, {
    filename, babelrc: false, configFile: false, presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('react-native-worklets/plugin'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code : ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, global: { Error }, require(id) {
    assert(id.startsWith('.'), 'Simulation has no native or React dependencies');
    const target = path.resolve(path.dirname(filename), id);
    return target.endsWith('.png') ? target : load(path.relative(root, target + '.ts'));
  } }, { filename });
  return module.exports;
}
function isolated(fn, ...args) {
  assert(fn.__initData?.code, 'Exercise the actual serialized worklet');
  return vm.runInNewContext('(' + fn.__initData.code + ')', {}).apply({ __closure: fn.__closure }, args);
}
const api = load('src/game/survival.ts'), playerApi = load('src/game/player.ts'), nav = load('src/game/navigation.ts');
const collision = load('src/game/collision.ts'), flies = load('src/game/plague.ts'), { PLAGUE_VISUALS, PLAGUE_BOUNDS } = load('src/game/plagueAssets.ts');
const city = load('src/game/map.ts');
const { MINIBOSS_IDS } = load('src/game/enemyCatalog.ts'), { canStartSpecial, hasLivingSpecial, WORLD_EVENT_CONFIG } = load('src/game/worldEvents.ts');
const { SHIP_SITES } = load('src/game/worldEventSites.ts'), { bossMode } = load('src/game/bossBalance.ts');
let origin;
for (let y = 950; !origin && y <= 1900; y += 24) for (let x = 900; !origin && x <= 2000; x += 24) {
  let clear = collision.isWalkable(x, y);
  for (let r = 8; clear && r <= 150; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x + Math.cos(i * Math.PI / 16) * r, y + Math.sin(i * Math.PI / 16) * r)) { clear = false; break; }
  if (clear) origin = { ...playerApi.createPlayer(), x, y };
}
assert(origin);
const field = nav.buildFlowField(origin), view = { left: origin.x - 450, right: origin.x + 450, top: origin.y - 230, bottom: origin.y + 230 };
const clone = value => JSON.parse(JSON.stringify(value));
let steps = 0, kills = 0;
function step(s, dt = 40, before = origin, after = before, f = field, v = view) { steps++; return isolated(api.advanceSurvival, s, before, after, f, dt, v); }
function unpause(s) { while (s.mode === 'upgrade') s = api.chooseUpgrade(s, s.choices[0], s.upgradeOfferId); return s; }
function members(s) { return [s.boss, ...s.minibosses].filter(b => b?.plague); }
function living(s) { return members(s).filter(b => b.hp > 0 && b.phase !== 'death'); }
function assertClearSpriteSpawn(fly) {
  const clip=PLAGUE_VISUALS[fly.plague.variant].idle,bounds=PLAGUE_BOUNDS[fly.plague.variant];
  const halfWidth=Math.max(Math.abs(bounds.x-clip.pivotX),Math.abs(bounds.x+bounds.width-clip.pivotX))*clip.scale;
  const top=fly.y+(bounds.y-clip.pivotY)*clip.scale-10,bottom=fly.y+(bounds.y+bounds.height-clip.pivotY)*clip.scale;
  for(const prop of [...city.PROPS,...city.ANIMATED_PROPS].filter(p=>!p.groundDetail)){
    const b=prop.destination;assert(!(fly.x-halfWidth<b.x+b.width+5&&fly.x+halfWidth>b.x-5&&top<b.y+b.height+5&&bottom>b.y-5),'Every original insect silhouette, including flight-height clearance, spawns outside buildings');
  }
}
function start(mode = 'easy', wave = 1, kind = 'single') {
  let s = api.createSurvival(71, mode, { mode: 'purgatorio', encounter: 'the-plague' });
  s.purgatorio.number = wave; s.encounter.wave = wave; s.invulnerableMs = 1e9;
  for (let n = 0; n < 250 && (!s.boss || s.presentation); n++) s = step(s);
  assert(s.boss && s.plague && !s.presentation, 'The actual encounter prepares all insects before entering combat');
  if (kind === 'infinite') s.purgatorio.kind = 'infinite';
  if (kind === 'survival') { s.purgatorio = null; s.boss.origin = 'scheduled'; }
  s.encounter.enemies = s.encounter.enemies.map(n => ({ ...n, active: false }));
  s.encounter.remaining = 0; s.encounter.spawnMs = 1e9; s.world.reinforcementMs = 1e9;
  return s;
}
for (const mode of ['easy', 'hard', 'dystopia']) {
  let previous = 0;
  for (const wave of [1, 5, 11, 21, 51, 1000]) {
    const count = isolated(flies.plagueCount, wave, mode);
    assert(count >= previous && count <= flies.PLAGUE_BALANCE.maxInsects); previous = count;
    const s = start(mode, wave), swarm = members(s);
    assert.equal(swarm.length, count, 'Count scaling reaches real actor creation, not only configuration');
    assert.equal(s.plague.memberIds.length, count); assert.equal(new Set(s.plague.memberIds).size, count);
    assert.equal(new Set(swarm.map(b => b.plague.variant)).size, 4, 'All four original insect types participate');
    assert(swarm.filter(b => b.plague.variant === 'small').every(b => b.hp === 2 && b.maxHp === 2), 'Small insect HP never secretly scales');
    assert(swarm.filter(b => b.plague.variant === 'big').every(b => b.hp >= 12 && b.hp > 2));
    assert.equal(s.encounterMaxHp, swarm.reduce((sum, b) => sum + b.maxHp, 0));
    assert.equal(s.plague.maxHp, s.encounterMaxHp);
    for (const b of swarm) {
      assertClearSpriteSpawn(b);
      assert(collision.isWalkable(b.x, b.y) && nav.isReachable(b, field));
      assert(Math.hypot(b.x - origin.x, b.y - origin.y) >= flies.PLAGUE_BALANCE.spawnSafeDistance);
      assert(b.x >= view.left && b.x <= view.right && b.y >= view.top && b.y <= view.bottom);
    }
    assert(hasLivingSpecial(s)); assert(!canStartSpecial(s, 'scheduled')); assert(!canStartSpecial(s, 'ship')); assert(!canStartSpecial(s, 'purgatorio'));
  }
}
assert.equal(members(start('easy')).length, 6, 'Easy begins with at least six active insects');
assert.equal(members(start('hard')).length, 8); assert.equal(members(start('dystopia')).length, 10);
assert.equal(isolated(flies.plagueHealth, 'small', 999), 2); assert.equal(isolated(flies.plagueHealth, 'big', 1.5), 18);

// Each four-type flight executes varied routes and complete telegraphed attacks
// in the real world/collision model. No fake projectiles or display-only damage.
const flightStages = new Set(), routePositions = new Set();
for (const variant of ['small', 'medium', 'medium2', 'big']) {
  let state = start(), b = { ...state.boss, x: origin.x + 115, y: origin.y, phase: 'recover', phaseMs: 0,
    plague: flies.createPlagueFlight(variant, { x: origin.x + 115, y: origin.y }, 123, 0) };
  state.minibosses = []; state.boss = b; state.plague.memberIds = [b.entityId];
  let warningStart = null, dives = 0, retreats = 0;
  for (let n = 0; n < 2000; n++) {
    const old = b, next = isolated(flies.advancePlagueFlight, state, { ...b, phaseMs: b.phaseMs + 16, animationMs: b.animationMs + 16 }, origin, origin, field, 16, [b]);
    b = next.boss; state.boss = b;
    const stage = b.plague.stage; flightStages.add(stage); routePositions.add(Math.floor(b.x / 45) + ':' + Math.floor(b.y / 45));
    assert(collision.isWalkable(b.x, b.y)); assert(Number.isFinite(b.x) && Number.isFinite(b.y));
    assert(Math.hypot(b.x - old.x, b.y - old.y) < 12, 'Steering never teleports an insect');
    if (stage === 'windup' && old.plague.stage !== stage) warningStart = n * 16;
    if (stage === 'dive' && old.plague.stage !== stage) { dives++; assert(n * 16 - warningStart >= flies.PLAGUE_BALANCE.minWarningMs - 16); }
    if (stage === 'retreat' && old.plague.stage !== stage) retreats++;
    if (stage === 'windup') assert.equal(next.sting, false, 'Preparation cannot deal damage');
    if (next.sting) assert.equal(stage, 'dive', 'Only authored active sting frames deal attack damage');
  }
  assert(dives >= 2 && retreats >= 2, variant + ' repeatedly prepares, stings and retreats');
}
for (const stage of ['roam', 'orbit', 'approach', 'windup', 'dive', 'retreat']) assert(flightStages.has(stage), 'Flight uses ' + stage);
assert(routePositions.size > 12, 'The flight explores several distinct camera locations');

for (const mode of ['easy', 'hard', 'dystopia']) {
  let s = start(mode);
  const ready = (actor,i) => ({...actor,x:origin.x+Math.cos(i)*115,y:origin.y+Math.sin(i)*115,
    plague:{...actor.plague,stage:'approach',cooldownMs:0,routeMs:1e6,goalX:origin.x,goalY:origin.y}});
  s.boss=ready(s.boss,0);s.minibosses=s.minibosses.map((actor,i)=>ready(actor,i+1));
  for(let n=0;n<500;n++){
    s=step(s,16);
    assert(living(s).filter(b=>b.plague.stage==='windup'||b.plague.stage==='dive').length<=flies.PLAGUE_BALANCE.maxAttackers[mode], 'Attack admission is shared across every insect, including same-frame transitions');
  }
}
function preparedSting(variant) {
  const s=start();s.invulnerableMs=0;s.hp=10;s.maxHp=10;s.minibosses=[];
  s.boss={...s.boss,x:origin.x+115,y:origin.y,phase:'warning',phaseMs:0,aimAngle:Math.PI,
    plague:{...flies.createPlagueFlight(variant,{x:origin.x+115,y:origin.y},123,0),stage:'windup',elapsedMs:flies.PLAGUE_BALANCE.warningMs-32,targetX:origin.x,targetY:origin.y,cooldownMs:1e6}};
  return s;
}
for(const variant of ['small','medium','medium2','big']){
  let s=preparedSting(variant),damage=0;
  for(let n=0;n<100;n++){s=step(s,16);damage=s.events.damage;if(s.boss.plague.stage==='retreat')break;}
  assert.equal(damage,1,variant+' authored sting actually reduces player health');assert.equal(s.hp,9);
  let dodge=preparedSting(variant),p=origin;
  for(let n=0;n<100;n++){
    const before=p;if(dodge.boss.plague.stage==='dive')p={...origin,y:origin.y+110};
    dodge=step(dodge,16,before,p);if(dodge.boss.plague.stage==='retreat')break;
  }
  assert.equal(dodge.hp,10,variant+' fixed telegraphed sting can be sidestepped before impact');
  assert.equal(dodge.events.damage,0);
}
{
 let s=preparedSting('small');s.hp=1;s.maxHp=1;s.difficulty='dystopia';
 for(let n=0;n<100&&s.mode==='playing';n++)s=step(s,16);
 assert.equal(s.mode,'dead');assert.equal(s.events.death,1);assert.equal(s.boss,null,'A lethal sting cannot restore the fly after normal player-death cleanup');
 assert.equal(s.plague,undefined);assert(!s.minibosses.some(b=>b.plague));assert.equal(s.hazards.length,0);assert.equal(s.projectiles.length,0);
 const deathEvents=s.events.bossAttack;
 for(let n=0;n<250;n++)s=step(s,16);
 assert.equal(s.events.death,1);assert.equal(s.events.bossAttack,deathEvents,'No surviving swarm attack callbacks run after death');assert.equal(s.boss,null);assert.equal(s.minibosses.length,0);
}

for(const kind of ['survival','infinite']){
 let s=start('easy',1,kind);s.world.reinforcementMs=0;
 for(let n=0;n<250;n++){
  s=step(s);assert.equal(s.boss.id,'the-plague');assert(s.minibosses.every(b=>b.plague),'Ordinary pressure cannot add a second special encounter');
  assert(s.encounter.enemies.filter(n=>n.active&&n.action!=='death').length<=WORLD_EVENT_CONFIG.pressureLimit.easy);
 }
 assert(s.encounter.enemies.some(n=>n.active&&n.action!=='death'),'Normal enemies continue to spawn while the swarm lives in '+kind);
 assert.equal(s.stats.minibossKills,0);assert.equal(s.plague.rewarded,false);
}

{
 let s=api.createSurvival(71);s.invulnerableMs=1e9;s.pendingBoss=true;s.encounter.wave=5;s.encounter.phase='spawning';s.encounter.remaining=3;s.encounter.spawnMs=1e9;
 s.world.nextRewardAtMs=1e12;s.world.nextRewardWave=1e9;s.world.checkedShipWave=5;
 s.rotations.mini={remaining:['the-plague',...MINIBOSS_IDS.filter(id=>id!=='the-plague')],last:null,seed:1,round:1};
 const tiny={left:origin.x-25,right:origin.x+25,top:origin.y-25,bottom:origin.y+25};
 s=step(s,40,origin,origin,field,tiny);assert.equal(s.boss,null);assert.equal(s.plague,undefined,'An invalid combat view never admits a partial swarm');
 const retryAt=s.world.specialRetryAtMs;assert.equal(retryAt,s.clockMs+200,'Failed whole-swarm admission uses the shared scheduled-spawn retry delay');
 assert.equal(s.rotations.mini.remaining[0],'the-plague','A failed attempt does not consume the shuffle bag');
 for(let n=0;n<4;n++){s=step(s,40,origin,origin,field,tiny);assert.equal(s.world.specialRetryAtMs,retryAt,'Do not retry every frame before the retry deadline');assert.equal(s.boss,null);}
 for(let n=0;n<30&&!s.boss;n++)s=step(s);
 assert(s.boss&&s.plague&&members(s).length===6,'The same scheduled event recovers as soon as a valid full-swarm view is available');
 assert(!s.rotations.mini.remaining.includes('the-plague'));assert.equal(s.events.bossIntro,1);
}

// Moving the camera does not snap real positions. A displaced insect returns
// into the visible combat area through physical movement in finite time.
let returning = start(), b = { ...returning.boss, x: origin.x + 115, y: origin.y };
const shiftedView = { left: origin.x - 300, right: origin.x + 40, top: origin.y - 180, bottom: origin.y + 180 };
returning.combatView = shiftedView;
for (let n = 0; n < 250; n++) {
  const old = b; b = isolated(flies.advancePlagueFlight, returning, { ...b, phase: 'recover', phaseMs: b.phaseMs + 16, animationMs: b.animationMs + 16 }, origin, origin, field, 16, [b]).boss;
  assert(Math.hypot(b.x - old.x, b.y - old.y) < 12);
}
assert(b.x <= shiftedView.right && b.x >= shiftedView.left, 'Camera-relative route steering recovers visibility');

// Full fights use real sword overlap and health subtraction, not death flags.
let serial = 1000;
function hit(s, entityId) {
  const put = actor => !actor?.plague || actor.hp <= 0 ? actor : { ...actor,
    x: origin.x + (actor.entityId === entityId ? 60 : 260), y: origin.y,
    phase: 'recover', phaseMs: 0, animationMs: 0, facingX: 1,
    plague: { ...actor.plague, stage: 'windup', elapsedMs: 0, cooldownMs: 1e6, vx: 0, vy: 0 } };
  s.boss = put(s.boss); s.minibosses = s.minibosses.map(put);
  const before = { ...origin, action: 'attack', actionMs: 65, attackIndex: 0, attackSerial: ++serial }, after = { ...before, actionMs: 105 };
  return step(unpause(s), 40, before, after);
}
for (const mode of ['easy', 'hard', 'dystopia']) for (const kind of ['survival', 'infinite', 'single']) {
  let s = start(mode, 1, kind), count = living(s).length;
  const maxHp = s.encounterMaxHp, initialMini = s.stats.minibossKills, initialBossReward = s.events.boss;
  for (const id of [...s.plague.memberIds]) {
    for (let n = 0; n < 100 && members(s).find(m => m.entityId === id)?.hp > 0; n++) s = hit(s, id);
    assert(!members(s).some(m => m.entityId === id && m.hp > 0), 'Every real fly can be killed'); kills++;
    count--;
    assert.equal(living(s).length, count);
    assert.equal(s.encounterMaxHp, maxHp, 'Individual deaths never shrink the shared HP denominator');
    if (count) {
      assert.equal(s.stats.minibossKills, initialMini, 'No insect grants a separate mini-boss reward');
      assert.equal(s.events.boss, initialBossReward); assert.equal(s.chests.length, 0); assert.equal(s.pendingChests, 0);
      assert(!s.identifiedDefeats?.includes('the-plague')); assert(hasLivingSpecial(s)); assert(!canStartSpecial(s, 'scheduled'));
      if (s.purgatorio) assert.equal(s.purgatorio.phase, 'combat');
    }
  }
  assert.equal(s.stats.minibossKills, initialMini + 1); assert.equal(s.events.boss, initialBossReward + 1);
  assert.equal(s.chests.length + s.pendingChests, 1, 'Only the completed swarm grants one guaranteed mini-boss chest');
  assert.equal(Boolean(s.identifiedDefeats?.includes('the-plague')), kind !== 'single');
  const totalKills = s.events.kill;
  for (let n = 0; n < 100; n++) s = step(unpause(s));
  assert.equal(s.stats.minibossKills, initialMini + 1); assert.equal(s.events.boss, initialBossReward + 1); assert.equal(s.events.kill, totalKills);
  if (kind === 'single') { assert.equal(s.mode, 'won'); assert.equal(s.boss, null); assert.equal(s.minibosses.length, 0); }
}

// Scheduled and capsule arrivals use the same shuffled mini-boss rotation.
for (const mode of ['easy', 'hard', 'dystopia']) {
  const s = api.createSurvival(4, mode), picked = [];
  for (let n = 0; n < MINIBOSS_IDS.length * 5; n++) picked.push(isolated(api.selectEnemy, s, 'mini'));
  for (let n = 0; n < picked.length; n += MINIBOSS_IDS.length) assert.equal(new Set(picked.slice(n, n + MINIBOSS_IDS.length)).size, MINIBOSS_IDS.length);
  assert(picked.includes('the-plague'));
}
for (const ship of SHIP_SITES) {
  const p = { ...origin, ...ship.spawnPoints[0] }, f = nav.buildFlowField(p);
  let s = api.createSurvival(71); s.encounter.wave = 3; s.encounter.phase = 'spawning'; s.encounter.remaining = 1; s.encounter.spawnMs = 1e9; s.invulnerableMs = 1e9;
  s.world.nextRewardAtMs = 1e12; s.world.nextRewardWave = 1e9; s.world.checkedShipWave = 3;
  s.rotations.mini = { remaining: ['the-plague', ...MINIBOSS_IDS.filter(id => id !== 'the-plague')], last: null, seed: 1, round: 1 };
  s.world.ship = { siteId: ship.id, phase: 'alarm', elapsedMs: WORLD_EVENT_CONFIG.shipWarningMs - 40, enemyId: 'the-plague', nextTryMs: 0 };
  for (let n = 0; n < 200 && !s.boss; n++) s = step(s, 40, p, p, f, undefined);
  assert(s.plague && s.boss.id === 'the-plague' && s.boss.origin === 'ship', 'A real derelict ship creates the same swarm encounter');
  for(const insect of members(s))assertClearSpriteSpawn(insect);
  assert.equal(living(s).length, 6); assert(!s.rotations.mini.remaining.includes('the-plague'), 'Ship admission consumes the same shuffle bag');
  assert.equal(s.world.ship, null); assert(!canStartSpecial(s, 'scheduled'));
}

let paused = start(); const pauseSave = JSON.stringify(paused); assert.equal(step(paused, 0), paused); assert.equal(JSON.stringify(paused), pauseSave);
paused.mode = 'upgrade'; assert.equal(step(paused, 40), paused, 'Reward pause freezes every flight and attack timer');
const retry = api.createSurvival(71); assert.equal(retry.plague, undefined); assert.equal(retry.boss, null); assert.equal(retry.minibosses.length, 0);
assert.equal(bossMode('easy').hp, 1); // New tuning does not alter the original global difficulty table.
console.log('The Plague passed: 18 real scaled spawns (6/8/10 initial, max14), four authored variants/fixed small HP/shared totals, all six flight states and finite camera return, ' + kills + ' real insect kills with one encounter reward/identification, whole-roster rotations, all six real capsule paths, pause and clean restart; ' + steps + ' serialized simulation frames. No physical-device performance claim.');
