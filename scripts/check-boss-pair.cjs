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


const { canStartSpecial, hasLivingSpecial } = load('src/game/worldEvents.ts');
const { PURGATORIO_ROSTER } = load('src/game/purgatorio.ts');
assert.equal(PURGATORIO_ROSTER.length, 14, 'Pair has exactly one selectable encounter and The Plague is one swarm encounter');
assert(!PURGATORIO_ROSTER.includes('archer-bandit'));
function unpause(s) { while (s.mode === 'upgrade') s = chooseUpgrade(s, s.choices[0], s.upgradeOfferId); return s; }
function start(id, difficulty) {
  let state = createSurvival(71, difficulty, { mode: 'purgatorio', encounter: id });
  state.invulnerableMs = 1e9;
  for (let i = 0; i < 200 && !state.boss; i++) state = step(unpause(state));
  assert(state.boss && state.partner, id+' creates both bandits as one encounter');
  assert.equal(state.boss.id, 'dagger-bandit');
  assert.equal(state.partner.id, 'archer-bandit');
  assert.equal(new Set([state.boss.entityId, state.partner.entityId]).size, 2, 'Each actor owns its own attack/entity identity');
  assert.equal(state.encounterMaxHp, state.boss.maxHp + state.partner.maxHp);
  assert.equal(state.encounterName, 'Archer and Dagger');
  assert.equal(state.events.bossIntro, 1, 'One presentation for the joint fight');
  assert.equal(canStartSpecial(state, 'scheduled'), false);
  assert.equal(hasLivingSpecial(state), true);
  while (state.presentation) state = step(unpause(state));
  return state;
}
function alive(s, id) { return [s.boss, s.partner].find(b => b && b.id === id); }
function killOne(state, id) {
  let p = { ...players.createPlayer(), ...origin }, ticks = 0;
  const kills = state.events.kill;
  state.invulnerableMs = 1e9;
  while (alive(state,id)?.phase !== 'death' && ticks++ < 4000) {
    state = unpause(state);
    for (const key of ['boss', 'partner']) {
      const b = state[key];
      if (!b || b.phase === 'death') continue;
      state[key] = { ...b, x: origin.x + (b.id === id ? 60 : -130), y: origin.y,
        facingX: 1, phase: 'recover', phaseMs: 0, animationMs: 0, attackRootX: 0 };
    }
    state.encounter.enemies = state.encounter.enemies.map(n => ({ ...n, active: false }));
    p = applyPlayerUpgrades(p,state);
    if (p.action !== 'attack') p = players.beginAttack({ ...p, comboMs: 0 });
    const after = players.advancePlayer(p, players.REST_INPUT, 40);
    state = advanceSurvival(state,p,after,field,40); p = after;
  }
  assert(ticks < 4000, 'Real sword reaches and defeats '+id);
  assert.equal(state.events.kill, kills + 1, 'One lethal sword strike registers exactly one defeat');
  return state;
}
let fights = 0;
for (const difficulty of ['easy', 'hard', 'dystopia']) for (const chosen of ['dagger-bandit', 'archer-bandit']) for (const first of ['dagger-bandit', 'archer-bandit']) {
  let s = start(chosen,difficulty);
  const maxHp = s.encounterMaxHp, second = first === 'dagger-bandit' ? 'archer-bandit' : 'dagger-bandit';
  const survivor = alive(s,second), initialHp = Math.floor(survivor.maxHp / 2);
  for (const key of ['boss', 'partner']) if (s[key].id === second) s[key] = { ...s[key], hp: initialHp };
  const firstOwner = alive(s,first).entityId, secondOwner = alive(s,second).entityId;
  s.hazards = [firstOwner, secondOwner].map((owner,index)=>({
    id:80000+index,owner,kind:'arrow',fx:'arrow',x:origin.x+120,y:origin.y+100,
    angle:0,radius:8,length:0,ageMs:0,warningMs:1e6,activeMs:1000,damage:0,vx:0,vy:0,
  }));
  s = killOne(s,first);
  // Actor ordering may observe the sibling death on the next simulation tick.
  s = step(unpause(s),8);
  assert.equal(s.purgatorio.phase, 'combat', 'First death never wins a two-actor encounter');
  assert.equal(s.purgatorio.cleared, 0);
  assert(!s.hazards.some(h=>h.owner===firstOwner),'First death clears only its owned attacks');
  assert(s.hazards.some(h=>h.owner===secondOwner),'The living partner keeps its own independent attack');
  assert.equal(s.encounterMaxHp, maxHp, 'First death preserves original combined-health denominator');
  assert(s.boss && s.partner, 'Retain both actor records until the pair is defeated');
  assert.equal(alive(s,first).hp, 0);
  assert.equal(alive(s,second).hp, Math.min(survivor.maxHp, initialHp + Math.ceil(survivor.maxHp * .18)), 'Surviving sibling receives one moderate heal');
  assert.equal(alive(s,second).damage, 2);
  assert.equal(alive(s,second).siblingRage, true);
  assert.equal(s.events.bossPhase, 1, 'Sibling death emits one phase signal');
  assert(s.phaseFlashMs > 0 && s.phaseFlashMs <= 480, 'Phase signal owns a finite visual lifetime');
  const hp = alive(s,second).hp;
  const living = { ...s, boss: null, partner: alive(s,second) };
  assert(hasLivingSpecial(living), 'Partner alone retains special exclusivity');
  assert.equal(canStartSpecial(living,'ship'), false, 'A ship cannot enter while only the partner survives');
  for (let i = 0; i < 12; i++) {
    for (const key of ['boss','partner']) if (s[key]?.phase !== 'death') s[key] = { ...s[key], phase:'recover',phaseMs:0,x:origin.x+140,y:origin.y };
    s = step(unpause(s));
  }
  assert.equal(alive(s,second).hp,hp,'Repeated death frames never repeat sibling healing');
  assert.equal(s.events.bossPhase,1);
  assert.equal(s.encounterMaxHp,maxHp);
  assert.equal(step(s,0),s,'Pause leaves both actors, phase timers and progression unchanged');
  // Damage is functional, rather than a field/UI-only enrage. Remove unrelated
  // ordinary pressure and touch the survivor in recovery for one simulation step.
  let damageScene = JSON.parse(JSON.stringify(s));
  damageScene.hp = difficulty === 'dystopia' ? 1 : 5; damageScene.maxHp = damageScene.hp;
  damageScene.invulnerableMs = 0;
  damageScene.encounter.enemies = damageScene.encounter.enemies.map(n => ({...n,active:false}));
  damageScene.minibosses=[];damageScene.projectiles=[];
  for (const key of ['boss','partner']) if (damageScene[key]?.id===second) damageScene[key]={...damageScene[key],phase:'recover',phaseMs:0,x:origin.x+12,y:origin.y};
  const beforeDamage=damageScene.events.damage; damageScene=step(damageScene,8);
  assert.equal(damageScene.hp,difficulty==='dystopia'?0:3,'Enraged contact really removes two life units');
  assert.equal(damageScene.events.damage,beforeDamage+1);
  if(difficulty==='dystopia')assert.equal(damageScene.mode,'dead','The one-life mode still ends immediately');
  else { const damagedHp=damageScene.hp;damageScene=step(damageScene,8);assert.equal(damageScene.hp,damagedHp,'Invulnerability prevents repeated contact damage'); }
  s = killOne(s,second);
  assert.equal(s.purgatorio.phase,'defeated','Victory requires both actual deaths');
  assert.equal(s.purgatorio.cleared,1,'Two actors count as one roster encounter');
  assert.equal(s.purgatorio.lastClearedId,'dagger-bandit');
  const bossRewards=s.events.boss,killRewards=s.events.kill;
  for(let n=0;n<200&&(!s.ending?.ready||s.mode!=='won');n++)s=step(unpause(s));
  assert.equal(s.mode,'won'); assert.equal(s.boss,null);assert.equal(s.partner,null);
  assert.equal(s.projectiles.length,0);assert.equal(s.hazards.length,0);assert.equal(s.stunMs,0);assert.equal(s.poisonMs,0);assert.equal(s.minibosses.length,0);assert.equal(active(s).length,0);
  assert.equal(s.events.boss,bossRewards,'Death animation cleanup never doubles rewards');
  assert.equal(s.events.kill,killRewards);
  assert.equal(step(s),s,'Terminal victory is inert');
  const retry=createSurvival(71,difficulty,{mode:'purgatorio',encounter:chosen});
  assert.equal(retry.boss,null);assert.equal(retry.partner,null);assert.equal(retry.events.bossPhase,0);assert.equal(retry.purgatorio.cleared,0);
  fights++;
}
console.log('Joint boss encounter passed: '+fights+' actual sword fights, canonical selection/legacy alias and both kill orders in all three modes; persistent combined HP, one-time sibling heal/double damage, independent actor deaths, shared special exclusion, one-life defeat, once-only progress/rewards and clean retry. Simulation only.');
