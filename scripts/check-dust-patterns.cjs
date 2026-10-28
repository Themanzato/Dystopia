/* global __dirname */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), babel = require('@babel/core'), root = path.resolve(__dirname, '..'), cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative); if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = fs.readFileSync(file, 'utf8');
  const code = /[\\/](survival|dustJumper|bossEffects|survivalAssets)\.ts$/.test(file)
    ? babel.transformSync(source, { filename: file, babelrc: false, configFile: false, presets: [require.resolve('@babel/preset-typescript')], plugins: [require.resolve('react-native-worklets/plugin'), require.resolve('@babel/plugin-transform-modules-commonjs')] }).code
    : ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { global: { Error }, module, exports: module.exports, require(id) {
    assert(id.startsWith('.')); const target = path.resolve(path.dirname(file), id);
    return id.endsWith('.png') ? target : load(path.relative(root, target + '.ts'));
  } }, { filename: file }); return module.exports;
}
const game = load('src/game/survival.ts'), players = load('src/game/player.ts'), nav = load('src/game/navigation.ts'), collision = load('src/game/collision.ts');
const { bossFrame } = load('src/game/survivalAssets.ts'), { hazardDraws } = load('src/game/bossEffects.ts');
const { dustJumpTimeline, dustPressure } = load('src/game/dustJumper.ts'), { BOSS_ATTACKS } = load('src/game/bossAttacks.ts');
let hero;
for (let y = 950; !hero && y < 1900; y += 24) for (let x = 900; !hero && x < 2000; x += 24) {
  let clear = true; for (let r = 0; clear && r <= 160; r += 8) for (let i = 0; i < 32; i++) if (!collision.isWalkable(x + Math.cos(i * Math.PI / 16) * r, y + Math.sin(i * Math.PI / 16) * r)) { clear = false; break; }
  if (clear) hero = { ...players.createPlayer(), x, y };
}
assert(hero); const field = nav.buildFlowField(hero);
const step = (s, p = hero, dt = 8) => game.advanceSurvival(s, p, p, field, dt);
function begin(index, mode, hpRatio) {
  let s = game.createSurvival(71, mode, { mode: 'purgatorio', encounter: 'dust-jumper' }); s.invulnerableMs = 1e9;
  for (let n = 0; n < 300 && (!s.boss || s.presentation); n++) s = step(s, hero, 40);
  assert(s.boss); s.encounter.remaining = 0; s.encounter.enemies = s.encounter.enemies.map(n => ({ ...n, active: false })); s.world.reinforcementMs = 1e9;
  Object.assign(s.boss, { hp: hpRatio === undefined ? 1 : Math.ceil(s.boss.maxHp * hpRatio), x: hero.x + 120, y: hero.y, phase: 'recover', phaseMs: 10000, pattern: index, attackIndex: index, summonMs: 0 }); s.bossActionUntilMs = 0; s.hazards = [];
  s = step(s); assert.equal(s.boss.phase, 'warning'); assert.equal(s.boss.attackIndex, index);
  for (let n = 0; n < 250 && s.boss.phase !== 'attack'; n++) s = step(s);
  assert.equal(s.boss.phase, 'attack'); return s;
}
let bombs = 0, jumps = 0;
for (const mode of ['easy', 'hard', 'dystopia']) {
  let s = begin(0, mode), p = { ...hero }, h = s.hazards.find(h => h.kind === 'bomb'), id = h.id;
  assert.equal(h.warningMs - h.markerStartMs, 750); assert.equal(hazardDraws(h).length, 0, 'Nothing falls while Dust throws');
  while ((h = s.hazards.find(h => h.id === id)).ageMs < h.markerStartMs) s = step(s, p);
  const locked = {x:h.x,y:h.y};assert.equal(hazardDraws(h).length,0,'Exact green target square is no longer visible');
  while ((h = s.hazards.find(h => h.id === id)).ageMs < h.warningMs) {
    assert.equal(hazardDraws(h).length,0);assert.equal(h.x,locked.x);assert.equal(h.y,locked.y);
    p = { ...p, x: hero.x + 75 }; s = step(s, p);
  }
  assert.equal(hazardDraws(h)[0].source.x, 32, 'The filled second cell starts the real impact'); bombs++;
  let hit = begin(0, mode); const bombId = hit.hazards.find(h => h.kind === 'bomb').id;
  while (hit.hazards.find(h=>h.id===bombId).ageMs < hit.hazards.find(h=>h.id===bombId).markerStartMs) hit = step(hit);
  const ground = hit.hazards.find(h=>h.id===bombId), standing = { ...hero, x: ground.x, y: ground.y };
  hit.invulnerableMs = 0; const hp = hit.hp, count = hit.events.damage;
  for (let n = 0; n < 600 && hit.hp === hp; n++) hit = step(hit, standing);
  assert.equal(hit.hp, mode === 'dystopia' ? 0 : hp - 1); assert.equal(hit.events.damage, count + 1);

  s = begin(1, mode,0.5); p = { ...hero }; h = s.hazards[0]; const jumpId = h.id, takeoff = { x: s.boss.x, y: s.boss.y };
  const t = dustJumpTimeline(s.boss.attackRate); assert(Math.abs(t.landingStartMs - t.trackEndMs - 1000) < 1e-8);
  assert(Math.abs(h.landingStartMs - h.followMs - 1000) < 1e-8); assert.equal(bossFrame(s.boss).visible, true);
  assert.equal(bossFrame(s.boss).source.y, 182, 'Real leap frames play at the original takeoff point');
  while ((h = s.hazards.find(h => h.id === jumpId)).ageMs < h.markerStartMs) {
    assert.equal(hazardDraws(h).length, 0); assert.equal(s.boss.x, takeoff.x); assert.equal(s.boss.y, takeoff.y); s = step(s, p);
  }
  assert.equal(hazardDraws(h)[0].image,10,'Original nine-frame tracking sprite is restored, without primitive hitboxes');
  while (h.ageMs < h.followMs) {
    p = { ...p, x: hero.x + 24 }; s = step(s, p); h = s.hazards.find(h => h.id === jumpId);
    if (s.boss.phaseMs >= t.takeoffMs) assert.equal(bossFrame(s.boss).visible, false);
  }
  assert.equal(h.x, p.x); assert.equal(h.y, p.y); const target = { x: h.x, y: h.y };
  const paused = { ...s, mode: 'upgrade' }; assert.equal(step(paused, p, 40), paused, 'Pause freezes marker, beeps and attack timers');
  while (s.boss.phaseMs < t.landingStartMs) {
    p = { ...p, x: hero.x + 100 }; s = step(s, p); h = s.hazards.find(h => h.id === jumpId);
    assert.equal(h.x, target.x); assert.equal(h.y, target.y);
  }
  assert.equal(s.boss.x, target.x); assert.equal(s.boss.y, target.y); assert.equal(bossFrame(s.boss).visible, true);
  const beeps = s.events.bossBeep; assert(beeps >= 6 && beeps <= 12);
  while ((h = s.hazards.find(h => h.id === jumpId)).ageMs < h.warningMs) s = step(s, p);
  assert.equal(bossFrame(s.boss).source.y, 273); assert(bossFrame(s.boss).source.x >= 84, 'Contact uses authored landing frame 2');
  assert.equal(hazardDraws(h)[0].image, 5); assert.equal(hazardDraws(h)[0].x, target.x); assert.equal(hazardDraws(h)[0].y, target.y);
  assert.equal(s.events.bossBeep, beeps, 'Beeping stops when the boss starts falling');
  while (s.boss.phase === 'attack') s = step(s, p);
  assert.equal(s.boss.x, target.x); assert.equal(s.boss.y, target.y, 'No return to the takeoff point after landing'); jumps++;
  s.boss.hp = 0; s.boss.phase = 'death'; s = step(s, p); assert.equal(s.hazards.length, 0); assert.equal(s.events.bossBeep, beeps, 'Death removes markers and pending beeps');
}
assert(BOSS_ATTACKS['archer-bandit'].filter(m => m.kind !== 'burrow').every(m => m.kind === 'volley'));
for (const mode of ['easy', 'hard', 'dystopia']) {
  let previousSpeed = 0, previousRate = 0;
  for (const [ratio, count] of [[1,1],[0.8,1],[0.6,2],[0.45,2],[0.3,3],[0.1,3]]) {
    const s = begin(0, mode, ratio), pressure = dustPressure(s.boss.hp, s.boss.maxHp);
    assert.equal(s.hazards.filter(h=>h.kind==='bomb').length, count, 'Health selects one, two, then three actual bombs');
    assert(pressure.movement >= previousSpeed && pressure.movement <= 1.65);
    assert(s.boss.attackRate >= previousRate); previousSpeed = pressure.movement; previousRate = s.boss.attackRate;
    assert(dustJumpTimeline(s.boss.attackRate).landingMs <= dustJumpTimeline(begin(0,mode,1).boss.attackRate).landingMs);
  }
  const high=begin(0,mode,1), low=begin(0,mode,0.1);
  for(const state of [high,low]) { state.boss.phase='recover';state.boss.phaseMs=0;state.bossActionUntilMs=1e9;state.hazards=[]; }
  const highX=high.boss.x,lowX=low.boss.x,highNext=step(high),lowNext=step(low);
  assert(Math.abs(lowNext.boss.x-lowX)>Math.abs(highNext.boss.x-highX)*1.5,'Lower health increases actual movement');
}
const fx=load('src/game/bossEffects.ts').BOSS_FX_CLIPS;
assert.equal(fx.dustIndicator.scale,3);assert.equal(fx.dustSlam.scale,2.5);assert.equal(BOSS_ATTACKS['dust-jumper'][1].range,45,'Smaller marker, restored original Slam visual and preserved targeted damage');
let impacts = 0, dodges = 0;
for (const mode of ['easy', 'hard', 'dystopia']) for (const dt of [8, 16, 40]) for (const dodge of [false, true]) {
  let s = begin(1, mode,0.5), p = { ...hero }, id = s.hazards[0].id;
  while (s.hazards.find(h=>h.id===id).ageMs < s.hazards.find(h=>h.id===id).followMs) s = step(s, p, dt);
  const atLock = { x: p.x, y: p.y }, hp = s.hp; s.invulnerableMs = 0;
  const impactMs = s.hazards.find(h=>h.id===id).warningMs;
  for (let n = 0; n < 250; n++) {
    const h = s.hazards.find(h=>h.id===id); if (!h || h.ageMs >= impactMs + dt) break;
    if (dodge && p.x - atLock.x < 145) p = players.advancePlayer(p, { x: 1, y: 0, strength: 1 }, dt);
    const before = h.ageMs; s = step(s, p, dt);
    if (before + dt < impactMs) assert.equal(s.hp, hp, 'The indicator/landing warning cannot damage the player');
  }
  if (dodge) { assert.equal(s.hp, hp, 'Normal movement during the one-second lock escapes the actual Slam'); dodges++; }
  else { assert.equal(s.hp, mode === 'dystopia' ? 0 : hp - 1, 'Standing on the fixed indicator receives exactly one actual impact'); impacts++; }
}
// Critical jumps have a real one-second pursuit, no stationary lock and a fast authored landing.
let criticalImpacts=0,criticalDodges=0;
for(const mode of ['easy','hard','dystopia'])for(const dt of [8,16,40])for(const dodge of [false,true]){
  let s=begin(1,mode,.2),p={...hero},h=s.hazards[0];const id=h.id,t=dustJumpTimeline(s.boss.attackRate,true);
  assert.equal(s.boss.dustCritical,true);assert(Math.abs(t.trackEndMs-t.takeoffMs-1000)<1e-8);assert.equal(t.landingStartMs,t.trackEndMs);assert(t.landingMs<180);
  assert.equal(h.followMs,h.warningMs,'Pursuit continues throughout the fast fall, without a hidden lock');
  while((h=s.hazards.find(h=>h.id===id)).ageMs<h.markerStartMs)s=step(s,p,dt);
  let samples=0;
  while((h=s.hazards.find(h=>h.id===id)).ageMs<h.landingStartMs-dt){
    p={...p,x:hero.x+24+Math.sin(samples/8)*15};s=step(s,p,dt);h=s.hazards.find(h=>h.id===id);
    assert.equal(hazardDraws(h)[0].image,10);assert(Math.hypot(h.x-p.x,h.y-p.y)<1e-6);samples++;
  }
  const paused={...s,mode:'upgrade'};assert.equal(step(paused,p,dt),paused);
  const hp=s.hp;s.invulnerableMs=0;
  if(dodge)p={...p,action:'dash',actionMs:0};
  while((h=s.hazards.find(h=>h.id===id)).ageMs<h.warningMs+dt){
    p={...p,x:p.x+.1};s=step(s,p,dt);
    if(s.mode==='dead')break;
  }
  if(dodge){assert.equal(s.hp,hp);criticalDodges++;}else{assert.equal(s.hp,mode==='dystopia'?0:hp-1);criticalImpacts++;}
  if(s.mode!=='dead'){
    h=s.hazards.find(h=>h.id===id);assert.equal(hazardDraws(h)[0].image,5);assert(Math.hypot(s.boss.x-h.x,s.boss.y-h.y)<1e-6);
    const final={x:s.boss.x,y:s.boss.y};while(s.boss.phase==='attack')s=step(s,p,dt);assert.equal(s.boss.x,final.x);assert.equal(s.boss.y,final.y);
  }
}
console.log('Critical Dust jumps passed: '+criticalImpacts+' impacts, '+criticalDodges+' dash escapes, one second pursuit/no lock/fast contact/final feet/pause in all modes at 8/16/40ms.');
console.log(`Dust patterns passed: ${bombs} grounded 750ms bombs, ${jumps} authored takeoffs/tracking targets/fixed one-second locks/landings; health-scaled actual movement, tempo and 1/2/3 bombs in all modes; authored tracking marker/hidden bomb square/impacts; ${impacts} actual Slam impacts and ${dodges} walking dodges at 8/16/40ms, pause and cleanup.`);
