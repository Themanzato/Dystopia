/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(project, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const requireLocal = id => {
    if (!id.startsWith('.')) throw new Error(`Unexpected game dependency: ${id}`);
    const target = path.resolve(path.dirname(filename), id);
    return target.endsWith('.png') ? target : load(path.relative(project, `${target}.ts`));
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require: requireLocal }, { filename });
  return module.exports;
}
const map = load('src/game/map.ts');
const collision = load('src/game/collision.ts');
const nav = load('src/game/navigation.ts');
const playerApi = load('src/game/player.ts');
const npcApi = load('src/game/npc.ts');
const combat = load('src/game/combat.ts');
const api = load('src/game/encounter.ts');
const { createPlayer, beginAttack, advancePlayer, PLAYER_ANIMATIONS, PLAYER_CELL, PLAYER_SCALE, REST_INPUT } = playerApi;
const { emptyNpc, NPC_POOL_SIZE, NPC_ANIMATIONS, NPC_BODY } = npcApi;
const { createEncounter, advanceEncounter, spawnIsClear, waveSize, WAVE_CONFIG } = api;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function openOrigin(radius) {
  for (let y = 950; y <= 1900; y += 24) for (let x = 900; x <= 2000; x += 24) {
    let free = collision.isWalkable(x, y);
    for (let r = 8; free && r <= radius; r += 8) for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      if (!collision.isWalkable(x + Math.cos(angle) * r, y + Math.sin(angle) * r)) { free = false; break; }
    }
    if (free) return { ...createPlayer(), x, y };
  }
  throw new Error('No clear city plaza for combat fixture');
}
const origin = openOrigin(160);
const originField = nav.buildFlowField(origin);
const makeNpc = (position = origin, id = 1) => ({ ...emptyNpc(), ...position, id, active: true, action: 'move' });
function encounterWith(npcs, state = {}) {
  const result = { ...createEncounter(), phase: 'clearing', remaining: 0, ...state };
  npcs.forEach((npc, i) => { result.enemies[i] = npc; });
  return result;
}
function tick(encounter, player, milliseconds, config = WAVE_CONFIG, field = nav.buildFlowField(player)) {
  for (let elapsed = 0; elapsed < milliseconds - 1e-8;) {
    const dt = Math.min(40, milliseconds - elapsed);
    encounter = advanceEncounter(encounter, player, player, field, dt, config);
    elapsed += dt;
    assert.equal(encounter.enemies.length, NPC_POOL_SIZE, 'Fixed pool cardinality');
    assert(encounter.enemies.filter(n => n.active).length <= Math.min(config.maxSimultaneous, NPC_POOL_SIZE));
    for (const npc of encounter.enemies) if (npc.active) assert(collision.isWalkable(npc.x, npc.y), 'NPC feet remain walkable');
  }
  return encounter;
}
assert.equal(createEncounter().enemies.length, 60);
assert.equal(waveSize(1), 6); assert.equal(waveSize(2), 8); assert.equal(waveSize(100), 36);
assert.equal(advanceEncounter(createEncounter(), origin, origin, originField, 0).wave, 0);
assert.equal(advanceEncounter(createEncounter(), origin, origin, originField, -40).wave, 0);
assert.equal(beginAttack(createPlayer()).attackSerial, 1);
assert.equal(beginAttack(beginAttack(createPlayer())).attackSerial, 1, 'Repressing cannot issue a new hit serial');

// Every existing sword combo hits once on its authored visible sweep and mirrors.
for (let combo = 0; combo < 4; combo++) for (const facingX of [-1, 1]) {
  const animation = PLAYER_ANIMATIONS.attack[combo];
  const strike = combat.SWORD_STRIKES[combo];
  const frameMs = 1000 / animation.fps;
  const swing = { ...beginAttack({ ...origin, facingX, nextAttack: combo, comboMs: 1000 }), actionMs: strike.firstFrame * frameMs + 0.1 };
  assert.equal(swing.attackIndex, combo);
  const target = makeNpc({ x: origin.x + facingX * 60, y: origin.y });
  const after = advancePlayer(swing, REST_INPUT, 4);
  assert(combat.swordHitsNpc(swing, after, target), `Combo ${combo} facing ${facingX} hits visible forward arc`);
  let encounter = advanceEncounter(encounterWith([target]), swing, after, originField, 4);
  assert.equal(encounter.defeated, 1); assert.equal(encounter.enemies[0].action, 'death');
  assert.equal(encounter.enemies[0].lastHitSerial, swing.attackSerial);
  const corpse = encounter.enemies[0];
  assert(!combat.swordHitsNpc(swing, after, corpse));
  encounter = advanceEncounter(encounter, swing, after, originField, 4);
  assert.equal(encounter.defeated, 1, 'Same attack cannot count a death twice');
  assert(!combat.swordHitsNpc(swing, after, { ...target, lastHitSerial: swing.attackSerial }), 'Same NPC serial cannot hit twice');
  if (strike.firstFrame > 0) {
    const startup = { ...swing, actionMs: 0 };
    assert(!combat.swordHitsNpc(startup, { ...startup, actionMs: frameMs * 0.4 }, target), 'Startup never hits');
  }
  const recovery = { ...swing, actionMs: (strike.lastFrame + 1) * frameMs + 0.1 };
  assert(!combat.swordHitsNpc(recovery, advancePlayer(recovery, REST_INPUT, 4), target), 'Recovery never hits');
  const farBehind = makeNpc({ x: origin.x - facingX * 100, y: origin.y });
  assert(!combat.swordHitsNpc(swing, after, farBehind), 'An attack cannot hit far behind its real sweep');
  assert(!combat.swordHitsNpc(swing, after, makeNpc({ x: origin.x, y: origin.y + 100 })), 'No radial damage outside real VFX');
  assert(!combat.swordHitsNpc({ ...swing, action: 'idle' }, after, target));
  assert(!combat.swordHitsNpc({ ...swing, action: 'dash' }, after, target));
  assert(!combat.swordHitsNpc(swing, { ...after, attackSerial: swing.attackSerial + 1 }, target));
  // Sample a one-pixel strip outside the authored rear boundary plus body radius.
  const left = (strike.x - PLAYER_CELL.pivotX) * PLAYER_SCALE;
  const rearOutside = makeNpc({ x: origin.x + facingX * (left - NPC_BODY.radius - 1), y: origin.y });
  assert(!combat.swordHitsNpc(swing, after, rearOutside), 'Mirrored rear extent follows source coordinates');
  if (combo === 3) {
    const realBacksweep = makeNpc({ x: origin.x - facingX * 35, y: origin.y });
    assert(combat.swordHitsNpc(swing, after, realBacksweep), 'Fourth original swing includes its real back sweep');
  }
}
// A visible sword rectangle cannot damage a target through a solid scenery base.
let checkedWall = false;
for (const prop of [...map.PROPS, ...map.ANIMATED_PROPS]) {
  const box = prop.footprint;
  if (!box || box.width > 84) continue;
  const from = { ...origin, x: box.x - 10, y: box.y + box.height / 2 };
  const to = { x: box.x + box.width + 10, y: from.y };
  if (!collision.isWalkable(from.x, from.y) || !collision.isWalkable(to.x, to.y)) continue;
  const swing = { ...beginAttack(from), actionMs: 65 };
  const target = makeNpc(to);
  const clearEquivalent = makeNpc({ x: origin.x + to.x - from.x, y: origin.y });
  const clearSwing = { ...beginAttack(origin), actionMs: 65 };
  if (!combat.swordHitsNpc(clearSwing, advancePlayer(clearSwing, REST_INPUT, 4), clearEquivalent)) continue;
  assert(!combat.swordHitsNpc(swing, advancePlayer(swing, REST_INPUT, 4), target), 'No damage through a real scenery obstacle');
  checkedWall = true; break;
}
assert(checkedWall, 'A narrow real solid exists to verify melee line-of-sight');
const crossedSwing = { ...beginAttack(origin), actionMs: 40 };
assert(combat.strikeOverlapsFrame(crossedSwing, { ...crossedSwing, actionMs: 180 }), 'Interval crossing an active frame cannot lose the hit');
let corpseEncounter = encounterWith([{ ...makeNpc({ x: origin.x + 60, y: origin.y }), action: 'death', lastHitSerial: 4 }], { defeated: 1, phase: 'spawning', remaining: 1, spawnMs: 10000 });
corpseEncounter = tick(corpseEncounter, origin, NPC_ANIMATIONS.death.frames * 1000 / NPC_ANIMATIONS.death.fps + 1);
assert(!corpseEncounter.enemies[0].active); assert.equal(corpseEncounter.defeated, 1);
const reused = makeNpc({ x: origin.x + 60, y: origin.y }, 2);
const reusedSwing = { ...beginAttack(origin), actionMs: 65 };
assert(combat.swordHitsNpc(reusedSwing, advancePlayer(reusedSwing, REST_INPUT, 4), reused), 'A new ID in a recycled slot does not inherit a prior NPC hit');

// Startup, pacing, rising wave size, and a hard pool/cap even if a wave is larger.
let encounter = tick(createEncounter(123), createPlayer(), WAVE_CONFIG.initialDelayMs - 1);
assert.equal(encounter.wave, 0); assert.equal(encounter.enemies.filter(n => n.active).length, 0);
encounter = tick(encounter, createPlayer(), 1);
assert.equal(encounter.wave, 1); assert.equal(encounter.remaining, 5);
assert.equal(encounter.enemies.filter(n => n.active).length, 1);
const first = encounter.enemies.find(n => n.active);
assert(distance(first, createPlayer()) >= WAVE_CONFIG.spawnMinDistance);
assert(distance(first, createPlayer()) <= WAVE_CONFIG.spawnMaxDistance);
assert.equal(first.action, 'spawn');
const firstPosition = { x: first.x, y: first.y };
encounter = tick(encounter, createPlayer(), 200);
assert.equal(encounter.enemies.filter(n => n.active).length, 1);
assert.equal(encounter.enemies.find(n => n.id === first.id).x, firstPosition.x, 'Emergence stays anchored');
encounter = tick(encounter, createPlayer(), 500);
assert.equal(encounter.enemies.filter(n => n.active).length, 2, 'Spawns are spaced apart');
encounter = tick(encounter, createPlayer(), 5000);
assert.equal(encounter.phase, 'clearing'); assert.equal(encounter.remaining, 0);
assert.equal(encounter.enemies.filter(n => n.active).length, 6);

const cappedConfig = { ...WAVE_CONFIG, firstWaveCount: 36, maxSimultaneous: 3, spawnIntervalMs: 40, speed: 0, initialDelayMs: 40 };
let capped = tick({ ...createEncounter(400), timerMs: 40 }, createPlayer(), 5000, cappedConfig);
assert.equal(capped.enemies.filter(n => n.active).length, 3); assert.equal(capped.remaining, 33);
const poolCapConfig = { ...cappedConfig, firstWaveCount: 80, maxPerWave: 80, maxSimultaneous: 100 };
const saturatedPool = tick({ ...createEncounter(401), timerMs: 40 }, createPlayer(), 10000, poolCapConfig);
assert.equal(saturatedPool.enemies.filter(n => n.active).length, NPC_POOL_SIZE, 'Configuration cannot exceed the physical 60-sprite pool');
assert.equal(saturatedPool.remaining, 80 - NPC_POOL_SIZE);
const cappedId = capped.nextId;
capped = tick(capped, createPlayer(), 2000, cappedConfig);
assert.equal(capped.nextId, cappedId, 'A full cap cannot keep spawning');
const deathBlocks = { ...capped, enemies: capped.enemies.map(n => n.active ? { ...n, action: 'death', actionMs: 0 } : n), spawnMs: 0 };
const waitingForSlot = tick(deathBlocks, createPlayer(), 80, cappedConfig);
assert.equal(waitingForSlot.nextId, cappedId, 'Dying sprites still occupy the rendering pool');
const recycled = tick(waitingForSlot, createPlayer(), 700, cappedConfig);
assert(recycled.nextId > cappedId); assert.equal(new Set(recycled.enemies.filter(n => n.active).map(n => n.id)).size, recycled.enemies.filter(n => n.active).length);
assert(recycled.enemies.filter(n => n.active && n.action !== 'death').every(n => n.lastHitSerial === -1));

const pauseConfig = { ...WAVE_CONFIG, firstWaveCount: 1, initialDelayMs: 40, intermissionMs: 500, speed: 0 };
let pause = tick({ ...createEncounter(90), timerMs: 40 }, origin, 40, pauseConfig, originField);
assert.equal(pause.phase, 'clearing');
pause.enemies[0] = makeNpc({ x: origin.x + 60, y: origin.y }, pause.enemies[0].id);
const pauseSwing = { ...beginAttack(origin), actionMs: 65 };
pause = advanceEncounter(pause, pauseSwing, advancePlayer(pauseSwing, REST_INPUT, 4), originField, 4, pauseConfig);
assert.equal(pause.phase, 'intermission'); assert.equal(pause.timerMs, 500);
pause = tick(pause, origin, 499, pauseConfig, originField);
assert.equal(pause.wave, 1); assert.equal(pause.phase, 'intermission');
pause = tick(pause, origin, 1, pauseConfig, originField);
assert.equal(pause.wave, 2); assert.equal(pause.remaining, 2, 'Wave two schedules 3 and immediately spawns its first');

// Failed spawn searches are bounded to 36 candidates and retry after a delay.
const invalidPlayer = { ...createPlayer(), x: -100, y: -100 };
const invalidField = nav.buildFlowField(invalidPlayer);
const failure = { ...createEncounter(1234), phase: 'spawning', remaining: 6, spawnMs: 0 };
let failed = advanceEncounter(failure, invalidPlayer, invalidPlayer, invalidField, 40);
let expectedSeed = failure.randomSeed;
for (let i = 0; i < 72; i++) expectedSeed = (Math.imul(expectedSeed, 1664525) + 1013904223) >>> 0;
assert.equal(failed.randomSeed, expectedSeed); assert.equal(failed.remaining, 6); assert.equal(failed.spawnMs, WAVE_CONFIG.retrySpawnMs);
failed = advanceEncounter(failed, invalidPlayer, invalidPlayer, invalidField, 40);
assert.equal(failed.randomSeed, expectedSeed, 'No repeated expensive search before retry delay');
assert(!spawnIsClear(origin, origin, [], originField), 'No spawn on the player');
assert(!spawnIsClear({ x: -10, y: -10 }, origin, [], originField));

// Audit spawning at all district route junctions against real scene bounds.
let spawns = 0;
const stations = [createPlayer(), ...map.ROUTES.flatMap(r => r.points).filter((p, i, all) => all.findIndex(q => q.x === p.x && q.y === p.y) === i)];
for (const station of stations) {
  const player = { ...createPlayer(), ...station };
  assert(collision.isWalkable(player.x, player.y));
  const field = nav.buildFlowField(player);
  const spawned = advanceEncounter({ ...createEncounter(100 + spawns), timerMs: 0 }, player, player, field, 40);
  const npc = spawned.enemies.find(n => n.active);
  assert(npc, `A connected clear spawn must exist near ${player.x},${player.y}`);
  assert(spawnIsClear(npc, player, [], field));
  assert(nav.isReachable(npc, field));
  assert(!spawnIsClear(npc, player, [npc], field), 'No overlapping spawn with existing living NPC');
  const top = npc.y - npcApi.NPC_CELL.pivotY * npcApi.NPC_SCALE;
  for (const prop of [...map.PROPS, ...map.ANIMATED_PROPS].filter(p => !p.groundDetail)) {
    const b = prop.destination;
    assert(!(npc.x - 12 < b.x + b.width + 5 && npc.x + 12 > b.x - 5 && top < b.y + b.height + 5 && npc.y + 5 > b.y - 5), 'Full projected spawn body stays clear of roofs/equipment');
  }
  spawns++;
}

// Real navigation/collision, with no mocked geometry, around every city route.
let routeSegments = 0;
for (const route of map.ROUTES) for (let i = 1; i < route.points.length; i++) {
  const from = route.points[i - 1], to = route.points[i];
  const player = { ...createPlayer(), ...to }, field = nav.buildFlowField(player);
  let scene = encounterWith([makeNpc(from)], { phase: 'spawning', remaining: 1, spawnMs: 1e9 });
  const limit = Math.ceil((distance(from, to) * 4 / WAVE_CONFIG.speed + 15) * 25);
  for (let step = 0; step < limit && distance(scene.enemies[0], player) > WAVE_CONFIG.stoppingDistance + 0.1; step++) {
    scene = advanceEncounter(scene, player, player, field, 40);
    assert(collision.isWalkable(scene.enemies[0].x, scene.enemies[0].y));
  }
  assert(distance(scene.enemies[0], player) <= WAVE_CONFIG.stoppingDistance + 0.1, `NPC follows connected route ${route.id}/${i} without getting trapped`);
  routeSegments++;
}
// Moving targets refresh the shared flow field rather than freezing the first goal.
let chasePlayer = { ...origin, x: origin.x + 110 }, chase = encounterWith([makeNpc({ x: origin.x - 100, y: origin.y })], { phase: 'spawning', remaining: 1, spawnMs: 1e9 });
chase = tick(chase, chasePlayer, 1000);
assert(chase.enemies[0].x > origin.x - 100);
chasePlayer = { ...origin, x: origin.x - 130 };
const reversedAt = chase.enemies[0].x;
chase = tick(chase, chasePlayer, 1500);
assert(chase.enemies[0].x < reversedAt, 'NPC redirects toward a moving player');
assert.equal(chase.enemies[0].facingX, -1);
console.log(`Encounter checks passed: 4 mirrored one-hit combos, startup/recovery/rear extents, death/serial/pooled-ID guards, paced capped waves and intermissions, bounded failed searches, ${spawns} valid city spawn locations, ${routeSegments} real navigation routes, moving-target chase. Simulation checks do not measure device FPS.`);
