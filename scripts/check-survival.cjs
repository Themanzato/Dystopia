/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const babel = require('@babel/core');
const project = path.resolve(__dirname, '..'), cache = new Map();
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const code = filename.endsWith('survival.ts') ? babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    presets: [require.resolve('@babel/preset-typescript')],
    plugins: [require.resolve('react-native-worklets/plugin'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code : ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, global: { Error }, require: id => {
    assert(id.startsWith('.'), `Unexpected pure simulation dependency ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    return target.endsWith('.png') ? target : load(path.relative(project, `${target}.ts`));
  } }, { filename });
  return module.exports;
}
const api = load('src/game/survival.ts');
const players = load('src/game/player.ts'), combat = load('src/game/combat.ts');
const nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts'), npcApi = load('src/game/npc.ts');
const map = load('src/game/map.ts');
const catalog = load('src/game/enemyCatalog.ts');
const { bossAttack } = load('src/game/bossAttacks.ts');
const { MINIBOSS_IDS, BOSS_IDS, MINION_IDS, ENEMY_DEFS } = catalog;
const { PLAGUE_BALANCE } = load('src/game/plague.ts');
const { PLAGUE_VISUALS, PLAGUE_BOUNDS } = load('src/game/plagueAssets.ts');
const { createSurvival, advanceSurvival, chooseUpgrade, chooseChest, wavePlan, applyPlayerUpgrades, xpRequirement, SURVIVAL_CONFIG, UPGRADE_INFO, selectEnemy } = api;
let origin;
for (let y = 950; !origin && y <= 1900; y += 24) for (let x = 900; !origin && x <= 2000; x += 24) {
  let clear = collision.isWalkable(x, y);
  for (let r = 8; clear && r <= 150; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x + Math.cos(i * Math.PI / 16) * r, y + Math.sin(i * Math.PI / 16) * r)) { clear = false; break; }
  if (clear) origin = { ...players.createPlayer(), x, y };
}
assert(origin);
const field = nav.buildFlowField(origin);
function step(s, dt = 40, before = origin, after = before) { return advanceSurvival(s, before, after, field, dt); }
function active(s) { return s.encounter.enemies.filter(n => n.active && n.action !== 'death'); }
function emptyPlay(s = createSurvival(123)) { return { ...s, encounter: { ...s.encounter, phase: 'spawning', remaining: 1, spawnMs: 1e9, enemies: s.encounter.enemies.map(n => ({ ...n, active: false })) } }; }
function isolated(fn, ...args) {
  assert(fn.__initData?.code, 'Use actual native serialized worklet');
  const f = vm.runInNewContext(`(${fn.__initData.code})`, {});
  return f.apply({ __closure: fn.__closure }, args);
}
let s = createSurvival();
assert.equal(s.hp, 5); assert.equal(s.level, 1);
assert.equal(step(s, 0), s); assert.equal(step(s, -1), s);
assert.equal(isolated(advanceSurvival, s, origin, origin, field, 0), s);
assert.equal(isolated(advanceSurvival, s, origin, origin, field, 16).clockMs, 16);
assert.equal(isolated(createSurvival).hp, 5);
assert.equal(isolated(wavePlan, 5).boss, 'mini'); assert.equal(isolated(wavePlan, 10).boss, 'boss');
for (let wave = 1; wave <= 1000; wave++) {
  const p = wavePlan(wave); assert(p.count > 0 && p.count <= 60);
  assert.equal(p.boss, wave % 10 === 0 ? 'boss' : wave % 10 === 5 ? 'mini' : null);
}
assert(wavePlan(1).count >= 6 && wavePlan(1).count <= 8); assert.equal(wavePlan(9).count, 20); assert(wavePlan(6).count < wavePlan(4).count);

// Seeded draws cover every existing mini/boss/minion and never repeat their
// own tier immediately, including serialized execution on the UI runtime.
for (const [tier, pool] of [['mini', MINIBOSS_IDS], ['boss', BOSS_IDS.filter(id=>id!=='archer-bandit')], ['minion', MINION_IDS]]) {
  const a = createSurvival(891), b = createSurvival(891), seen = new Set(); let previous;
  for (let i = 0; i < 1000; i++) {
    const id = isolated(selectEnemy, a, tier);
    assert.equal(id, selectEnemy(b, tier)); assert(pool.includes(id));
    if (pool.length > 1) assert.notEqual(id, previous);
    previous = id; seen.add(id);
  }
  assert.equal(seen.size, pool.length, `Entire ${tier} asset catalog is reachable`);
}
assert.equal(MINIBOSS_IDS.length, 7); assert.equal(BOSS_IDS.length, 8); assert.equal(MINION_IDS.length, 3);

// All three actual species are scheduled, slots stay bounded and spawns remain
// outside the player/buildings against real geometry, not a mocked empty map.
s = { ...createSurvival(12), invulnerableMs: 1e9 };
const species = new Set(); let spawnChecks = 0;
for (let i = 0; i < 500; i++) {
  const previousIds = new Set(s.encounter.enemies.filter(n => n.active).map(n => n.id));
  s = step(s);
  for (const n of s.encounter.enemies) if (n.active && !previousIds.has(n.id)) {
    species.add(n.kind); spawnChecks++;
    assert(Math.hypot(n.x - origin.x, n.y - origin.y) >= 300);
    assert(collision.isWalkable(n.x, n.y)); assert(nav.isReachable(n, field));
    for (const prop of [...map.PROPS, ...map.ANIMATED_PROPS].filter(p => !p.groundDetail)) {
      const b = prop.destination;
      assert(!(n.x - 12 < b.x + b.width + 5 && n.x + 12 > b.x - 5 && n.y - 56 < b.y + b.height + 5 && n.y + 5 > b.y - 5));
    }
  }
}
assert.equal(species.size, 3); assert.equal(spawnChecks, 7);
assert.equal(s.encounter.phase, 'clearing'); assert.equal(s.encounter.enemies.length, 60);
// Saturate a late common wave without kills: pending spawns wait for a real
// free pool slot, then resume after the death clip releases one.
let saturated = { ...createSurvival(516), invulnerableMs: 1e9 };
saturated.encounter = { ...saturated.encounter, wave: 99, phase: 'spawning', remaining: 90, spawnMs: 0 };
for (let i = 0; i < 3000; i++) saturated = step(saturated);
assert.equal(saturated.encounter.wave, 99); assert.equal(active(saturated).length, 60);
assert(saturated.encounter.remaining > 0); const saturatedId = saturated.encounter.nextId;
for (let i = 0; i < 200; i++) saturated = step(saturated);
assert.equal(saturated.encounter.nextId, saturatedId);
saturated = { ...saturated, encounter: { ...saturated.encounter, enemies: saturated.encounter.enemies.map((n, i) => i === 0 ? { ...n, action: 'death', actionMs: 0 } : n) } };
for (let i = 0; i < 100; i++) saturated = step(saturated);
assert(saturated.encounter.nextId > saturatedId); assert.equal(active(saturated).length, 60);

// Large boss silhouettes get additional projected-roof clearance. Verify both
// species across the city's real route junctions, with bounded retry searches.
let bossSpawns = 0;
const stations = [origin, ...map.ROUTES.flatMap(r => r.points).filter((p, i, all) => all.findIndex(q => p.x === q.x && p.y === q.y) === i)];
for (const station of stations) for (const priorWave of [4, 9]) {
  const player = { ...origin, ...station }, localField = nav.buildFlowField(player);
  let scene = createSurvival(1241 + bossSpawns); scene.encounter = { ...scene.encounter, wave: priorWave, timerMs: 0 };
  for (let i = 0; i < 100 && !scene.boss; i++) scene = advanceSurvival(scene, player, player, localField, 40);
  assert(scene.boss, `Boss spawn remains available near route ${station.x},${station.y}`);
  const b = scene.boss;
  if (b.id === 'the-plague') {
    const swarm = [b, ...scene.minibosses].filter(m => m.plague);
    assert(swarm.length >= 6 && swarm.length <= PLAGUE_BALANCE.maxInsects, 'The entire bounded swarm is admitted together');
    assert.equal(swarm.length, scene.plague.memberIds.length);
    for (const fly of swarm) {
      const clip = PLAGUE_VISUALS[fly.plague.variant].idle, alpha = PLAGUE_BOUNDS[fly.plague.variant];
      assert.equal(clip.width, fly.plague.variant === 'small' ? 20 : fly.plague.variant === 'medium' ? 34 : fly.plague.variant === 'medium2' ? 88 : 72);
      assert(alpha.x >= 0 && alpha.y >= 0 && alpha.x + alpha.width <= clip.width && alpha.y + alpha.height <= clip.height, 'Spawn checks use real insect silhouettes rather than a humanoid roof box');
      assert(collision.isWalkable(fly.x, fly.y) && nav.isReachable(fly, localField));
      assert(Math.hypot(fly.x - player.x, fly.y - player.y) >= PLAGUE_BALANCE.spawnSafeDistance, 'Every actual insect starts safely away from the player');
      const facing = fly.facingX * clip.authoredFacing;
      const x0 = fly.x + (alpha.x - clip.pivotX) * clip.scale * facing, x1 = x0 + alpha.width * clip.scale * facing;
      const left = Math.min(x0, x1), right = Math.max(x0, x1), top = fly.y + (alpha.y - clip.pivotY) * clip.scale, bottom = top + alpha.height * clip.scale;
      assert(!(left < player.x + 9 && right > player.x - 9 && top < player.y && bottom > player.y - 40), 'The visible original insect body never starts on the hero');
    }
  } else {
    assert(Math.hypot(b.x - player.x, b.y - player.y) >= 300);
    for (const prop of [...map.PROPS, ...map.ANIMATED_PROPS].filter(p => !p.groundDetail)) {
      const r = prop.destination;
      assert(!(b.x - 70 < r.x + r.width + 5 && b.x + 70 > r.x - 5 && b.y - 120 < r.y + r.height + 5 && b.y + 10 > r.y - 5));
    }
  }
  bossSpawns++;
}


// Actual authored melee sweep: one hit per NPC and serial, with unique EXP drop.
for (const kind of ['ghoul', 'spitter', 'summoner']) {
  let swing = { ...players.beginAttack(origin), actionMs: 65 };
  let state = emptyPlay(); state.encounter.enemies[0] = { ...npcApi.emptyNpc(), kind, id: 10, active: true, action: 'move', x: origin.x + 60, y: origin.y };
  state = step(state, 4, swing, players.advancePlayer(swing, players.REST_INPUT, 4));
  assert.equal(state.encounter.defeated, 1); assert.equal(state.events.kill, 1); assert.equal(state.orbs.length, 1);
  const value = state.orbs[0].value;
  state = step(state, 4, swing, players.advancePlayer(swing, players.REST_INPUT, 4));
  assert.equal(state.events.kill, 1); assert.equal(state.orbs[0].value, value);
}
// Damage shares one cooldown across contact and bullets, dash is a short escape.
s = emptyPlay(); s.encounter.enemies[0] = { ...npcApi.emptyNpc(), active: true, id: 1, action: 'move', x: origin.x, y: origin.y };
s.projectiles.push({ id: 2, x: origin.x, y: origin.y - 14, vx: 0, vy: 0, lifeMs: 1000 });
s = step(s); assert.equal(s.hp, 4); assert.equal(s.events.damage, 1);
for (let i = 0; i < 20; i++) s = step(s);
assert.equal(s.hp, 4);
s = { ...s, invulnerableMs: 0 }; const dashing = { ...origin, action: 'dash' };
s = step(s, 40, dashing, dashing); assert.equal(s.hp, 4);
s = { ...s, hp: 1, invulnerableMs: 0 }; s = step(s); assert.equal(s.mode, 'dead'); assert.equal(s.hp, 0); assert.equal(s.events.death, 1); assert.equal(step(s).events.death, 1); assert.equal(step(s).clockMs,s.clockMs); assert.equal(step(s,0),s);

// Slow EXP; exactly one three-choice offer AND one independent automatic
// physical chest every three levels. Ordinary level-ups do not stop gameplay.
assert.equal(xpRequirement(1), 40); assert.equal(xpRequirement(2), 65);
assert.equal(xpRequirement(10), 625);
s = emptyPlay(); s.orbs = [{ id: 1, ...origin, value: 39, lifeMs: 5000 }]; s = step(s);
assert.equal(s.level, 1); assert.equal(s.xp, 39); assert.equal(s.chests.length, 0);
s.orbs = [{ id: 2, ...origin, value: 1, lifeMs: 5000 }]; s = step(s);
assert.equal(s.mode, 'playing'); assert.equal(s.level, 2); assert.equal(s.xp, 0);
assert.equal(s.chests.length, 0); assert(Object.values(s.upgrades).every(n => n === 0));
s.orbs = [{ id: 3, ...origin, value: 65, lifeMs: 5000 }]; s = step(s);
assert.equal(s.level, 3); assert.equal(s.mode, 'upgrade'); assert.equal(s.pendingUpgrades, 1);
assert.equal(new Set(s.choices).size, 3); assert.equal(step(s), s, 'Upgrade choice freezes all simulation');
assert.equal(chooseUpgrade(s, 'invalid', s.upgradeOfferId), s);
const milestoneOffer = s.upgradeOfferId; const milestoneChoice = s.choices[0];
s = isolated(chooseUpgrade, s, milestoneChoice, milestoneOffer);
assert.equal(s.mode, 'playing'); assert.equal(s.pendingUpgrades, 0); assert.equal(s.upgrades[milestoneChoice], 1);
assert.equal(chooseUpgrade(s, milestoneChoice, milestoneOffer), s, 'A choice cannot grant twice');
assert.equal(s.chests.length, 1); assert.equal(s.chests[0].kind, 'upgrade');
assert.equal(s.chests[0].phase, 'closed'); assert.equal(s.events.chest, 0);
assert.equal(chooseUpgrade(s, 'speed'), s); assert.equal(chooseChest(s, 'xp'), s);
const atChest = { ...origin, x: s.chests[0].x, y: s.chests[0].y };
s = step(s, 40, atChest); assert.equal(s.chests[0].phase, 'opening'); assert.equal(s.events.chest, 1);
for (let i = 0; i < 22; i++) s = step(s, 40, atChest);
assert.equal(s.chests[0].phase, 'opening'); assert.equal(Object.values(s.upgrades).reduce((a,b) => a+b,0), 1);
s = step(s, 40, atChest);
assert.equal(s.chests[0].phase, 'reward'); assert.equal(s.chests[0].rewardGranted, true);
assert.equal(Object.values(s.upgrades).reduce((a,b) => a + b, 0), 2); assert(s.chests[0].rewardText.length > 0);
for (let i = 0; i < 60; i++) s = step(s, 40, atChest);
assert.equal(s.chests.length, 0); assert.equal(Object.values(s.upgrades).reduce((a,b) => a + b, 0), 2);
assert.equal(s.events.chest, 1);
// Milestone overflow preserves EXP and queues every choice independently. A full
// pool defers excess chests, so opening a selection never drops one at our feet.
s = emptyPlay(); const thresholds = Array.from({ length: 20 }, (_,i) => xpRequirement(i+1));
s.xp = thresholds.reduce((a,b) => a+b,0); s = step(s);
assert.equal(s.level, 21); assert.equal(s.xp, 0); assert.equal(s.mode, 'upgrade'); assert.equal(s.pendingUpgrades, 7);
assert.equal(s.chests.length, 6); assert.equal(s.pendingChests,1);
assert.equal(s.chests.reduce((sum,c) => sum + c.charges,0)+s.pendingChests, 7);
assert.equal(s.chests.reduce((sum,c) => sum + c.upgradeCharges,0)+s.pendingChests, 7);
for (let remaining = 7; remaining > 0; remaining--) {
  assert.equal(s.pendingUpgrades, remaining); assert.equal(s.mode, 'upgrade');
  assert.equal(new Set(s.choices).size, s.choices.length);
  const prior = s, token = s.upgradeOfferId, id = s.choices[0];
  s = chooseUpgrade(s, id, token);
  assert.notEqual(s, prior); assert.equal(s.xp, 0);
  assert.equal(chooseUpgrade(s, id, token), s, 'Stale double touch cannot consume the next queued reward');
}
assert.equal(s.mode, 'playing'); assert.equal(s.pendingUpgrades, 0);
assert.equal(Object.values(s.upgrades).reduce((sum,n) => sum+n,0), 7);
assert.equal(s.chests.reduce((sum,c) => sum+c.charges,0)+s.pendingChests, 7);
// Once an existing chest expires, the deferred milestone gets a real safe spot.
const openingPoint={...origin,x:s.chests[0].x,y:s.chests[0].y};
const queuedId=s.nextPickupId;
for(let i=0;i<100;i++)s=step(s,40,openingPoint);
assert.equal(s.pendingChests,0,'A full pool delays, rather than loses, its extra reward');
assert(s.nextPickupId>queuedId,'The pending milestone materializes when the pool frees a slot');
assert(s.chests.length<=6);
// A supply cache crossing level 3 also offers a choice without losing excess.
s = emptyPlay(); s.level = 2; s.xpNeeded = xpRequirement(2); s.xp = s.xpNeeded - 3;
s.chests = [{ id: 1, ...origin, kind: 'supply', charges: 1, phase: 'closed' }];
for (let i = 0; i < 25; i++) s = step(s);
assert.equal(s.mode, 'upgrade'); assert.equal(s.level, 3); assert.equal(s.xp, 13);
assert.equal(s.pendingUpgrades, 1); assert.equal(s.chests.filter(c => c.kind === 'upgrade').length, 1);
// Supply is automatic and has an immediate implemented effect, not a card.
s = emptyPlay(); s.hp = 2; s.chests = [{ id: 1, ...origin, kind: 'supply', charges: 1, phase: 'closed' }];
for (let i = 0; i < 25; i++) s = step(s);
assert.equal(s.hp, 4); assert.equal(s.chests[0].rewardText, 'Vida +2');
const hpAfterChest = s.hp; for (let i = 0; i < 20; i++) s = step(s);
assert.equal(s.hp, hpAfterChest); assert.equal(s.events.chest, 1);
s = emptyPlay(); s.chests = [{ id: 1, ...origin, kind: 'supply', charges: 1, phase: 'closed' }];
for (let i = 0; i < 25; i++) s = step(s);
assert.equal(s.xp, 16); assert.equal(s.chests[0].rewardText, 'EXP +16');
const maxed = Object.fromEntries(Object.entries(UPGRADE_INFO).map(([id, v]) => [id, v.cap]));
const boosts = applyPlayerUpgrades(origin, { ...createSurvival(), upgrades: maxed });
assert(boosts.speedMultiplier > 1 && boosts.dashCooldownMultiplier < 1 && boosts.attackSpeedMultiplier > 1 && boosts.strikeMultiplier > 1);
const dash = players.beginDash(boosts, players.REST_INPUT); assert(dash.dashCooldownMs < players.DASH_COOLDOWN_MS);
s = step(emptyPlay(), 4, dash, players.advancePlayer(dash, players.REST_INPUT, 4));
assert.equal(s.events.dash, 1); const dashAfter = players.advancePlayer(dash, players.REST_INPUT, 4); s = step(s, 4, dashAfter, players.advancePlayer(dashAfter, players.REST_INPUT, 4)); assert.equal(s.events.dash, 1);
const oldAttack = { ...players.beginAttack(origin), actionMs: 0 }, fasterAttack = { ...players.beginAttack(boosts), actionMs: 0 };
assert(players.advancePlayer(fasterAttack, players.REST_INPUT, 40).actionMs > players.advancePlayer(oldAttack, players.REST_INPUT, 40).actionMs);
assert(combat.swordHitsNpc({ ...fasterAttack, actionMs: 65 }, { ...fasterAttack, actionMs: 70 }, { ...npcApi.emptyNpc(), active: true, x: origin.x + 112, y: origin.y }));

// Actual shield rule, unique hit serial, bounded movement and active melee windows.
// Ranged hazard damage/cleanup is exercised through real tells in check-boss-mechanics.
function bossFixture(id = 'shielder', phase = 'warning') {
  const b = { id, name: id === 'shielder' ? 'Shielder' : 'Rock boss', x: origin.x + 60, y: origin.y, facingX: -1, hp: 8, maxHp: 8,
    phase, phaseMs: 0, animationMs: 0, pattern: 0, lastHitSerial: -1, aimAngle: Math.PI };
  return { ...emptyPlay(), boss: b, invulnerableMs: 1e9 };
}
const swing = { ...players.beginAttack(origin), actionMs: 65 }, swingAfter = players.advancePlayer(swing, players.REST_INPUT, 4);
s = bossFixture(); s = step(s, 4, swing, swingAfter);
assert.equal(s.boss.hp, 8, 'Front-facing shield blocks damage');
assert.equal(s.boss.lastHitSerial, swing.attackSerial);
s = { ...s, boss: { ...s.boss, facingX: 1 } }; s = step(s, 4, swing, swingAfter);
assert.equal(s.boss.hp, 8, 'The blocked swing cannot hit again by rotating');
s = bossFixture(); s.boss.facingX = 1; s = step(s, 4, swing, swingAfter);
assert.equal(s.boss.hp, 7, 'Rear swing hurts the Shielder');
s = step(s, 4, swing, swingAfter); assert.equal(s.boss.hp, 7);
// These fixtures model a single legacy actor. The Plague's real shared swarm,
// sting windows, deaths and once-only reward are exercised in check-plague.cjs.
const legacySingleActors = [...MINIBOSS_IDS.filter(id => id !== 'the-plague'), ...BOSS_IDS, ...MINION_IDS];
for (const id of legacySingleActors) {
  s = bossFixture(id); const startX = s.boss.x;
  for (let i = 0; i < 70; i++) { s = step(s); assert.equal(s.projectiles.length, 0); }
  if (bossAttack(id).speed > 0 && id !== 'shock-sweeper') assert(s.boss.x < startX, id + ' advances toward its locked direction');
  else if (!['shock-sweeper','archer','evil-sage','archer-bandit','dust-jumper','electrocutioner'].includes(id)) assert(s.boss.x <= startX, id + ' uses a stationary authored area/beam attack');
  assert(collision.isWalkable(s.boss.x,s.boss.y));
  const frozen = JSON.stringify(s); assert.equal(step(s, 0), s); assert.equal(JSON.stringify(s), frozen);
  // Match authored contact frames: safe telegraph, impact damage, dodge escape.
  if (!['melee','area','line','charge'].includes(bossAttack(id).kind)) continue;
  s = bossFixture(id, 'attack'); s.invulnerableMs = 0; s.boss.x = origin.x - 55; s.boss.facingX = 1; s.boss.aimAngle = 0;
  const spec = bossAttack(id); s.boss.x = origin.x - Math.max(32, spec.range * (spec.kind === 'charge' ? 0.5 : 0.8));
  s.boss.phaseMs = spec.activeStartMs - 8;
  s = step(s, 4); assert.equal(s.hp, 5);
  for (let i = 0; i < 6; i++) s = step(s, 4);
  assert.equal(s.hp, 4, 'Melee contact occurs inside authored impact window');
}
s = bossFixture('rock-boss', 'recover'); s.boss.x += 200;
for (let i = 0; i < 8; i++) { s.boss.summonMs = SURVIVAL_CONFIG.summonIntervalMs; s = step(s); }
assert.equal(s.minibosses.length, 0, 'Occupied special slot only reinforces common NPCs');
assert(active(s).length > 0 && active(s).length <= 12);
assert(active(s).every(n=>collision.isWalkable(n.x,n.y)));
const summonedScene = s;
let skeleton = bossFixture('skeleton-summoner', 'recover'); skeleton.boss.x += 200;
for (let cycle = 0; cycle < 3; cycle++) {
  skeleton.boss.summonMs = SURVIVAL_CONFIG.summonIntervalMs; skeleton.boss.phase = 'recover'; skeleton.boss.phaseMs = 2000; skeleton.bossActionUntilMs = 0;
  const previousCount = skeleton.minibosses.length;
  for (let i = 0; i < 800 && skeleton.minibosses.length <= previousCount; i++) skeleton = step(skeleton);
}
assert.equal(skeleton.minibosses.length, 6, 'Three authored casts create three groups of two');
assert(skeleton.minibosses.every(n => MINION_IDS.includes(n.id) && n.hp === 1));
// Death is an authored clip, not an immediately re-hittable/rewardable actor.
for (const id of legacySingleActors) {
  let dying = bossFixture(id, 'warning'); dying.boss.hp = 1; dying.boss.facingX = 1;
  dying = step(dying, 4, swing, swingAfter);
  assert.equal(dying.events.kill, 1); assert.equal(dying.orbs.length, 1);
  assert.equal(dying.chests.length, MINION_IDS.includes(id) ? 0 : 1);
  if (ENEMY_DEFS[id].deathDurationMs > 0) assert.equal(dying.boss.phase, 'death');
  for (let i = 0; i < 250; i++) dying = step(dying, 40, swing, swingAfter);
  assert.equal(dying.boss, null); assert.equal(dying.events.kill, 1);
}
// Attack cues fire once on the tell-to-attack transition.
s = bossFixture('shielder', 'warning'); s.boss.phaseMs = bossAttack('shielder').warningMs - 1;
s = step(s, 4); assert.equal(s.events.bossAttack, 1); s = step(s, 4); assert.equal(s.events.bossAttack, 1);
s = summonedScene; s.encounter.phase = 'clearing'; s.encounter.remaining = 0; s.boss = null; s = step(s);
assert.equal(s.encounter.phase, 'clearing', 'Wave waits for common supports too');

// Clear twenty real scheduled waves with an automated invulnerable melee fixture.
// Position/face enemies for an actual rear sword impact; not a difficulty/FPS test.
s = { ...createSurvival(77), invulnerableMs: 1e9 };
let hero = origin, saw5 = false, saw10 = false, saw15 = false, saw20 = false, maxActive = 0, ticks = 0, bossKills = 0;
for (; ticks < 40000 && !(s.encounter.wave === 20 && s.encounter.phase === 'intermission'); ticks++) {
  while (s.mode === 'upgrade') s = chooseUpgrade(s, s.choices[0], s.upgradeOfferId);
  assert.equal(s.mode, 'playing');
  s = { ...s, invulnerableMs: 1e9, encounter: { ...s.encounter, enemies: s.encounter.enemies.map(n => n.active && n.action !== 'death' ? { ...n, action: 'move', x: origin.x + 60, y: origin.y } : n) } };
  if (s.boss) {
    assert((s.encounter.wave % 10 === 0 ? BOSS_IDS : MINIBOSS_IDS).includes(s.boss.id));
    if (s.encounter.wave === 5) saw5 = true; if (s.encounter.wave === 10) saw10 = true; if (s.encounter.wave === 15) saw15 = true; if (s.encounter.wave === 20) saw20 = true;
    s = { ...s, boss: { ...s.boss, x: origin.x + 60, y: origin.y, facingX: 1 } };
  }
  if (s.partner) s.partner = { ...s.partner, x: origin.x + 60, y: origin.y, facingX: 1 };
  s.minibosses = s.minibosses.map(b => ({ ...b, x: origin.x + 60, y: origin.y, facingX: 1 }));
  // Pull drops to the fixture to verify their complete physical lifecycle too.
  s.orbs = s.orbs.map(o => ({ ...o, x: origin.x, y: origin.y }));
  s.chests = s.chests.map(c => ({ ...c, x: origin.x, y: origin.y }));
  hero = applyPlayerUpgrades(hero, s);
  if (hero.action !== 'attack') hero = players.beginAttack({ ...hero, comboMs: 0 });
  const after = players.advancePlayer(hero, players.REST_INPUT, 40), priorBoss = s.boss;
  s = advanceSurvival(s, hero, after, field, 40); hero = after;
  if (priorBoss && !s.boss && priorBoss.origin !== 'ship') bossKills++;
  maxActive = Math.max(maxActive, active(s).length);
  assert(active(s).length <= 60); assert.equal(s.projectiles.length, 0); assert(s.orbs.length <= 64); assert(s.chests.length <= 6);
}
assert(ticks < 40000, '20 waves finish without lifecycle/reward softlocks');
assert(saw5 && saw10 && saw15 && saw20); assert.equal(bossKills, 4);
assert(s.events.kill > 200); assert(s.events.level > 0); assert(s.events.chest > 0);
assert.equal(s.encounter.wave, 20); assert.equal(s.encounter.timerMs, 3000);
const fresh = createSurvival(); assert.equal(fresh.level, 1); assert.equal(fresh.hp, 5); assert(Object.values(fresh.upgrades).every(n => n === 0));
console.log(`Survival checks passed: native serialized worklets; 3 species/${spawnChecks} clear NPC spawns/${bossSpawns} large boss spawns; 60 simultaneous NPCs; slow EXP; queued milestone choices PLUS physical chests at level 3/6/9; 6 random minis/8 bosses/3 minions; authored melee/death windows; rear-only Shielder/bounded hazards/one encounter and bounded normal supports; pause freeze; 20 waves/${bossKills} bosses (${ticks} frames, peak ${maxActive} NPCs). No physical-device FPS measured.`);
