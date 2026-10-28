/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const project = process.env.DYSTOPIA_PROJECT || path.resolve(__dirname, '..');
const req = Module.createRequire(path.join(project, 'package.json'));
const ts = req('typescript'), React = req('react'), Reconciler = req('react-reconciler');
const { sksgHostConfig } = req('@shopify/react-native-skia/lib/commonjs/sksg/HostConfig');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
};
Module._extensions['.png'] = (module, filename) => { assert(fs.existsSync(filename)); module.exports = filename; };
const reactions = new Set(), uiQueue = [], clicks = [], modes = [];
let rnCalls = 0, width = 844, height = 390; const seenText = new Set();
function useAnimatedReaction(prepare, react) {
  const latestRef = React.useRef({ prepare, react }); React.useLayoutEffect(() => { latestRef.current = { prepare, react }; });
  React.useEffect(() => {
    const token = { latestRef, previous: latestRef.current.prepare() }; reactions.add(token);
    return () => reactions.delete(token);
  }, []);
}
const originalLoad = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'react-native') return {
    View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView',
    StyleSheet: { create: v => v, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
    useWindowDimensions: () => ({ width, height }),
  };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({top:0,bottom:0,left:0,right:0}) };
  if (name === 'react-native-reanimated') return { useAnimatedReaction };
  if (name === 'react-native-worklets') return {
    scheduleOnRN(fn, ...args) { rnCalls++; fn(...args); },
    scheduleOnUI(fn, ...args) { uiQueue.push(() => fn(...args)); },
  };
  if(name==='./GameplayElement')return {__esModule:true,default:({id,children})=>{const g=req('./src/ui/controlLayout.ts'),d=req('./src/ui/controlSettings.ts'),a=g.controlArea(width,height,{left:0,right:0,top:0,bottom:0}),l=g.resolveElementLayout(d.DEFAULT_CONTROLS,a);return React.createElement('GameElementProbe',{testID:'game-element-'+id,style:g.elementBox(id,l[id],a)},children);}};
  if(name==='./GameUIOpacity'||name==='./BossHitHUD')return {__esModule:true,default:({children})=>children};
  if(name==='./UpgradeIcon')return {__esModule:true,default:props=>React.createElement('UpgradeIconProbe',props)};
  if (parent?.filename.endsWith('RunResultPanel.tsx') && name === './ScoreStorage') return {saveRunResult:async()=>{}};
  if (/(?:SurvivalHUD|RunResultPanel|GameHudVisuals)\.tsx$/.test(parent?.filename||'')) {
    if (name === './FrenesisHUD') return {__esModule:true,default:props=>React.createElement('FrenesisProbe',props)};
    if (name === './PurgatorioInterlude') return {__esModule:true,default:props=>React.createElement('InterludeProbe',props)};
    if (name === './BossPresentation') return { __esModule: true, default: props => React.createElement('BossPresentationProbe', props) };
    if (name === './PixelText') return { __esModule: true, default: props => { seenText.add(props.text); return React.createElement('PixelProbe', props); } };
    if (name === './PixelArt') return { UIFrame: ({ children, ...props }) => React.createElement('FrameProbe', props, children) };
    if (name === './AudioProvider') return { useGameAudio: () => ({ playUi: () => clicks.push('press') }) };
    if (name === './BattleAudio') return { BattleAudio: props => React.createElement('BattleAudioProbe', props) };
  }
  return originalLoad.call(this, name, parent, main);
};
const api = req('./src/game/survival.ts');
const { emptyNpc } = req('./src/game/npc.ts');
const HUD = req('./src/ui/SurvivalHUD.tsx').default;
const survival = { value: api.createSurvival(), set(next) { this.value = next; } };
const container = { root: [], redraw() {} };
const renderer = Reconciler({ ...sksgHostConfig, createTextInstance: text => ({ type: '#text', props: { text }, children: [] }) });
const root = renderer.createContainer(container, 0, null, false, null, '', error => { throw error; }, null);
const clears=[];
let retries = 0, exits = 0, difficulties = 0;
let props = { onChangeDifficulty:()=>difficulties++, onPurgatorioClear:id=>clears.push(id), survival, active: true, visible: true, onMode: mode => { modes.push(mode); }, onRetry: () => retries++, onExit: () => exits++ };
function all(predicate, nodes = container.root) {
  const out = [];
  for (const node of nodes) { if (predicate(node)) out.push(node); out.push(...all(predicate, node.children)); }
  return out;
}
const one = predicate => { const found = all(predicate); assert.equal(found.length, 1); return found[0]; };
const probe = type => one(n => n.type === type);
const texts = () => all(n => n.type === 'PixelProbe').map(n => n.props.text);
const modal = () => one(n => n.props.testID === 'survival-modal');
const buttons = () => all(n => n.type === 'Pressable');
const button = label => one(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const style = node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
async function render(patch = {}) {
  props = { ...props, ...patch };
  await act(async () => renderer.updateContainer(React.createElement(HUD, props), root, null));
}
async function flush() {
  await act(async () => {
    for (const token of reactions) {
      const key = token.latestRef.current.prepare(); token.latestRef.current.react(key, token.previous); token.previous = key;
    }
  });
}
async function change(patch) { survival.set({ ...survival.value, ...patch }); await flush(); }
async function press(label) {
  const target = button(label).props;
  const before = clicks.length;
  await act(async () => target.onPressIn());
  assert.equal(clicks.length, before + 1, 'Reward and retry clicks start on touch down');
  await act(async () => target.onPress());
}
async function runUI() { await act(async () => { for (const fn of uiQueue.splice(0)) fn(); }); await flush(); }
(async () => {
  survival.value.encounter.wave = 4;
  survival.value.encounter.remaining = 4;
  survival.value.encounter.enemies = [
    { ...emptyNpc(), id: 1, active: true, action: 'move' },
    { ...emptyNpc(), id: 2, active: true, action: 'spawn' },
    { ...emptyNpc(), id: 3, active: true, action: 'idle' },
    { ...emptyNpc(), id: 4, active: true, action: 'death' },
    { ...emptyNpc(), id: 5, active: false, action: 'move' },
  ];
  await render();
  assert(texts().includes('Oleada 4') && texts().includes('Enemigos 7'), 'Remaining count includes pending plus living/spawning NPC, excluding dead/inactive slots');
  assert(texts().includes('Vida 5/5') && texts().includes('Nv 1'));
  assert.equal(all(n => n.props.testID === 'player-vitals').length, 1);
  assert.equal(all(n=>n.props.testID==='game-element-enemies').length,0,'Enemy count is rendered only within the wave panel');
  assert.equal(style(one(n=>n.props.testID==='enemy-counter')).borderWidth,undefined,'Enemy text has no second independent frame');
  assert.equal(style(one(n=>n.props.testID==='player-vitals')).minHeight,68,'Life frame is stable with and without armor');
  assert.equal(probe('BattleAudioProbe').props.suspended, false);
  assert.deepEqual(modes, ['playing']);
  const beforeMotion = rnCalls;
  survival.value.encounter.enemies[0].x += 100;
  survival.value.clockMs += 1000;
  survival.value.projectiles.push({ id: 1, x: 10, y: 10, vx: 0, vy: 0, lifeMs: 100 });
  await flush();
  assert.equal(rnCalls, beforeMotion, 'Position, animation clock and projectile updates do not cross to React HUD');
  await change({ boss: { id: 'shielder', name: 'Shielder', hp: 6, maxHp: 8, phase: 'warning', phaseMs: 100, pattern: 0, animationMs: 100, lastHitSerial: -1, aimAngle: 0, x: 0, y: 0, facingX: 1 } });
  const boss = one(n => n.props.testID === 'boss-hud');
  assert.equal(boss.children[0].props.text, 'Shielder', 'Name precedes the health bar in the same centered column');
  const bossBar = one(n => n.props.accessibilityLabel === 'Vida de Shielder: 6 de 8');
  assert.equal(bossBar.props.accessibilityValue.now, 75);
  assert.equal(style(one(n=>n.props.testID==='game-element-boss')).x + style(one(n=>n.props.testID==='game-element-boss')).width / 2, width / 2);
  assert(texts().includes('Oleada 4') && texts().includes('Enemigos 7'), 'Boss health never changes the separate NPC count');
  const previousBoss = survival.value.boss;
  const phaseCalls = rnCalls;
  await change({ boss: { ...previousBoss, powerPhase: 1 } });
  assert.equal(one(n => n.props.testID === 'boss-hud').children[0].props.color, '#b34462', 'Phase transition changes boss name to wine red');
  assert.equal(rnCalls, phaseCalls + 1, 'Power phase reaches HUD without requiring HP to change');
  const dagger = { ...previousBoss, id: 'dagger-bandit', name: 'Dagger Bandit', hp: 18, maxHp: 24, phase: 'attack', powerPhase: 0 };
  const archer = { ...previousBoss, id: 'archer-bandit', name: 'Archer Bandit', hp: 12, maxHp: 24, phase: 'warning', powerPhase: 0 };
  await change({ boss: dagger, partner: archer, encounterName: 'Archer and Dagger', encounterMaxHp: 48 });
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Archer and Dagger: 30 de 48').props.accessibilityValue.now, 63);
  assert.equal(all(n => n.props.testID === 'boss-partner-health').length, 1);
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida individual de Dagger Bandit: 18 de 24').props.accessibilityValue.now, 75);
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida individual de Archer Bandit: 12 de 24').props.accessibilityValue.now, 50);
  await change({ partner: { ...archer, hp: 0, phase: 'death' }, boss: { ...dagger, hp: 22, powerPhase: 1 } });
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Archer and Dagger: 22 de 48').props.accessibilityValue.now, 46, 'A dead partner preserves the combined denominator while the survivor heals');
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida individual de Archer Bandit: 0 de 24').props.accessibilityValue.now, 0, 'Individual defeat remains visible in the compact segments');
  assert.equal(one(n => n.props.testID === 'boss-hud').children[0].props.color, '#b34462');
  assert(texts().includes('Enemigos 7'), 'Neither bandit enters the separate NPC count');
  const beforeHit = rnCalls;
  await change({ events: { ...survival.value.events, bossHit: 1, bossPhase: 1 } });
  assert.equal(rnCalls, beforeHit + 1, 'Discrete damage and phase audio events cross to RN');
  assert.equal(probe('BattleAudioProbe').props.events.bossHit, 1);
  await change({ boss: previousBoss, partner: null, encounterName: undefined, encounterMaxHp: undefined });
  assert.equal(all(n => n.props.testID === 'boss-partner-health').length, 0);
  assert.equal(one(n => n.props.testID === 'boss-hud').children[0].props.color, '#e3b8a9');
  const supportsBeforePack = survival.value.minibosses;
  const droid = { ...previousBoss, id: 'bomb-droid', name: 'Bomb Droid', hp: 6, maxHp: 6, phase: 'recover', packRemaining: 2 };
  await change({ boss: droid, minibosses: [], encounterMaxHp: 18 });
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Bomb Droid: 18 de 18').props.accessibilityValue.now, 100, 'The fixed group total includes its staggered pending members');
  const member = { ...droid, entityId: 92, packRemaining: 0, packMember: true };
  await change({ boss: { ...droid, packRemaining: 1 }, minibosses: [member] });
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Bomb Droid: 18 de 18').props.accessibilityValue.now, 100, 'Spawning a member does not change the group denominator or progress');
  const beforeMemberDamage = rnCalls;
  await change({ minibosses: [{ ...member, hp: 3 }] });
  assert.equal(rnCalls, beforeMemberDamage + 1, 'Individual pack HP changes update its shared health bar');
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Bomb Droid: 15 de 18').props.accessibilityValue.now, 83);
  await change({ boss: { ...droid, hp: 0, phase: 'death', packRemaining: 0 }, minibosses: [{ ...member, hp: 3 }, { ...member, entityId: 93 }] });
  assert.equal(one(n => n.props.accessibilityLabel === 'Vida de Bomb Droid: 9 de 18').props.accessibilityValue.now, 50, 'Defeating the leader never leaves a zero bar while companions live');
  assert.equal(all(n => n.props.testID === 'boss-partner-health').length, 0, 'Droid group stays one compact bar');
  await change({ boss: previousBoss, minibosses: supportsBeforePack, encounterMaxHp: undefined });
  await change({ xp: 20 });
  assert.equal(one(n => n.props.accessibilityLabel === 'EXP 20 de 40').props.accessibilityValue.now, 50);
  for (const dimensions of [[667, 375], [844, 390], [740, 320]]) {
    [width, height] = dimensions; await render();
    const b = one(n => n.props.testID === 'boss-hud');
    assert.equal(style(one(n=>n.props.testID==='game-element-boss')).x + style(one(n=>n.props.testID==='game-element-boss')).width / 2, width / 2, 'Boss name/bar remain centered at compact landscape sizes');
    assert.equal(one(n => n.props.testID === 'survival-hud').props.pointerEvents, 'auto', 'Stats block map teleport hit testing');
  }
  const hudCallsBeforeChest = rnCalls;
  await change({ chests: [{ id: 90, x: 20, y: 20, phase: 'opening', phaseMs: 300, kind: 'upgrade' }] });
  assert.equal(buttons().length, 0, 'Approaching a chest never opens a choice panel');
  assert.equal(all(n => n.props.testID === 'survival-modal').length, 0);
  assert.equal(rnCalls, hudCallsBeforeChest, 'Chest animation frames stay off React HUD');
  await change({ level: 3, xp: 0, events: { ...survival.value.events, level: 2, chest: 1 } });
  assert.equal(modes.at(-1), 'playing', 'Levels and automatic chests do not suspend the game');
  assert.equal(probe('BattleAudioProbe').props.suspended, false);
  assert.equal(buttons().length, 0);
  const choices = api.upgradeOptions(survival.value);
  await change({ mode: 'upgrade', pendingUpgrades: 1, upgradeOfferId: 42, choices });
  assert.equal(buttons().length, 3);
  assert.equal(all(n => n.props.testID === 'upgrade-modal').length, 1);
  assert.equal(probe('BattleAudioProbe').props.suspended, true);
  const picked = choices[0], previousRank = survival.value.upgrades[picked];
  const previousChests = survival.value.chests;
  await press(api.UPGRADE_INFO[picked].name);
  assert.equal(survival.value.upgrades[picked], previousRank, 'Reward crosses to the UI queue');
  await runUI();
  assert.equal(survival.value.upgrades[picked], previousRank + 1);
  assert.equal(survival.value.mode, 'playing');
  assert.equal(survival.value.chests.length, previousChests.length, 'Chosen power-up does not consume the automatic chest');
  assert.equal(all(n => n.props.testID === 'upgrade-modal').length, 0);
  for (const dimensions of [[568, 320], [667, 375], [844, 390]]) {
    [width, height] = dimensions; await render();
    const vitals = one(n => n.props.testID === 'player-vitals');
    assert(style(vitals).backgroundColor,'Life panel remains separate from the ultimate');
    assert.equal(style(one(n=>n.props.testID==='survival-hud')).borderWidth,1);
    const box=style(one(n=>n.props.testID==='game-element-vitals'));
    assert.equal(box.y+box.height,height-8);
    assert(box.x>172&&box.x+box.width<width-200,'Default life/EXP fits between actual controls');
    assert.equal(probe('FrenesisProbe').props.survival,survival);
    assert.deepEqual(probe('FrenesisProbe').props.viewport,{width,height},'Ultimate uses the same measured gameplay viewport as life and the editor');
  }
  await render({ active: false, visible: false });
  assert.equal(probe('BattleAudioProbe').props.active, false);
  assert.equal(all(n => n.type === 'Pressable').length, 0, 'Pause hides reward controls as well as the HUD');
  await render({ active: true, visible: true });
  await change({ mode: 'dead', hp: 0, ending: {kind:'death',elapsedMs:599,animationMs:600,ready:false} });
  assert.equal(all(n=>n.props.testID==='survival-modal').length,0,'No menu during death animation or its delay');
  await change({ending:{kind:'death',elapsedMs:2600,animationMs:600,ready:true}});
  assert.equal(probe('BattleAudioProbe').props.dead, true);
  assert.equal(modes.at(-1), 'dead'); assert(texts().includes('Derrota'));
  await press('Reintentar'); assert.equal(retries, 1);
  await press('Menú principal'); assert.equal(exits, 1);
  assert.equal(uiQueue.length, 0, 'Retry/exit are navigation callbacks rather than reward worklets');

  const {createPurgatorio,PURGATORIO_ROSTER}=req('./src/game/purgatorio.ts');
  const run=createPurgatorio({mode:'purgatorio',encounter:'shielder'},123);
  await change({ending:undefined,mode:'playing',hp:1,difficulty:'dystopia',purgatorio:{...run,phase:'combat'}});assert(texts().includes('Encuentro 1'));assert(texts().includes('Individual'));
  await change({purgatorio:{...run,phase:'defeated',cleared:1,lastClearedId:'shielder'}});assert.deepEqual(clears,['shielder']);
  await change({xp:30});assert.deepEqual(clears,['shielder'],'Other HUD events never duplicate an unlock');
  await change({mode:'won',boss:null});assert.equal(probe('BattleAudioProbe').props.suspended,true);assert.equal(probe('BattleAudioProbe').props.dead,false);assert.equal(modes.at(-1),'won');assert.equal(all(n=>n.props.testID==='purgatorio-victory').length,1);assert(texts().includes('Victoria'));await press('Volver a intentar');await press('Salir al menú');await press('Cambiar de dificultad');assert.equal(difficulties,1);assert.equal(retries,2);assert.equal(exits,2);
  const completedRoster=PURGATORIO_ROSTER.length;
  await change({mode:'playing',purgatorio:{...run,kind:'infinite',phase:'between',number:completedRoster+1,cleared:completedRoster,lastClearedId:PURGATORIO_ROSTER.at(-1),elapsedMs:500}});assert(texts().includes('Cadena '+completedRoster+'/'+completedRoster));assert(texts().includes('Aleatorio - dificultad +'));assert.equal(probe('InterludeProbe').props.run.number,completedRoster+1);

  // Deliver several shared-value snapshots in one React batch. Each victory
  // callback must run in order even if only the final HUD state is rendered.
  const beforeBatch=clears.length;
  await act(async()=>{
    for(const [n,id] of [[completedRoster+1,'shielder'],[completedRoster+2,'evil-sage']]){
      survival.set({...survival.value,purgatorio:{...survival.value.purgatorio,cleared:n,lastClearedId:id}});
      for(const token of reactions){const key=token.latestRef.current.prepare();token.latestRef.current.react(key,token.previous);token.previous=key;}
    }
  });assert.deepEqual(clears.slice(beforeBatch),['shielder','evil-sage'],'React batching never loses the earlier frontier victory');
  const normalHp = survival.value.hp;
  await change({frenesis:{...survival.value.frenesis,active:true,hp:5,remainingMs:15000}});
  assert.equal(all(n=>n.props.testID==='frenesis-temporary-hp').length,1);
  assert(texts().includes('Glitch 5/5'));
  const callsBeforeFrenesisFrame=rnCalls;
  await change({clockMs:survival.value.clockMs+16,frenesis:{...survival.value.frenesis,remainingMs:14984}});
  assert.equal(rnCalls,callsBeforeFrenesisFrame,'Duration/bar animation does not render the React HUD every frame');
  await change({frenesis:{...survival.value.frenesis,hp:3}});assert(texts().includes('Glitch 3/5'));assert.equal(survival.value.hp,normalHp);
  await change({frenesis:{...survival.value.frenesis,active:false,hp:0}});assert.equal(all(n=>n.props.testID==='frenesis-temporary-hp').length,0);
  const { PIXEL_GLYPHS } = req('./src/ui/pixelGlyphs.ts');
  const { normalizePixelText } = req('./src/ui/pixelTextLayout.ts');
  for (const info of [...Object.values(api.UPGRADE_INFO), ...Object.values(api.CHEST_INFO)]) {
    seenText.add(info.name); seenText.add(info.description);
  }
  for (const text of seenText) for (const character of normalizePixelText(text)) {
    assert(character === '\n' || Object.hasOwn(PIXEL_GLYPHS, character), `Unsupported pixel-font character ${JSON.stringify(character)} in ${text}`);
  }
  await act(async () => renderer.updateContainer(null, root, null));
  assert.equal(reactions.size, 0, 'HUD observers detach on unmount');
  console.log('Survival HUD checks passed: exact enemy count, a single compact wave/enemy container and bottom vitals, centered combined/individual bandit bars, wine phase names and discrete hit/phase audio events, discrete React updates, nonmodal chests plus independent third-level choices, touch-safe compact layouts, audio gates and death/retry/exit callbacks.');
})().catch(error => { console.error(error); process.exitCode = 1; });