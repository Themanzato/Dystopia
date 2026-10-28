const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let h, now = 1000, listener;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useState(initial) {const i=h.cursor++;if(!h.slots[i])h.slots[i]={value:typeof initial==='function'?initial():initial};return[h.slots[i].value,next=>{h.slots[i].value=typeof next==='function'?next(h.slots[i].value):next}];},
  useRef(value) { const i = h.cursor++; return h.slots[i] ??= { current: value }; },
  useMemo(factory, deps) { const i = h.cursor++; if (!h.slots[i] || !same(h.slots[i].deps, deps)) h.slots[i] = { value: factory(), deps }; return h.slots[i].value; },
  useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  useEffect(effect, deps) { const i = h.cursor++; const old = h.slots[i]; if (!old || !same(old.deps, deps)) { const slot = h.slots[i] = { deps, cleanup: old?.cleanup }; h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); }); } },
};
react.useLayoutEffect = react.useEffect;
const filename = path.join(root, 'src/ui/BattleAudio.tsx');
const moduleObject = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, {
  module: moduleObject, exports: moduleObject.exports, console: { warn: text => h.warnings.push(text) }, Date: { now: () => now },
  require: function resolve(name) {
    if (name === 'react') return react;
    if (name === './useQueuedAudioPlayer') return {useQueuedAudioPlayer:(source,options)=>resolve('expo-audio').useAudioPlayer(source,options),loadQueuedAudioPlayer:()=>Promise.resolve()};
    if (name === '../game/actionSounds' || name === './useActionSoundPlayers' || name === './audioMix') {
      const m={exports:{}},f=path.resolve(path.dirname(filename),name+'.ts');
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:resolve});return m.exports;
    }
    if (name === './audioPreparation') {const m={exports:{}};const f=path.join(root,'src/ui/audioPreparation.ts');vm.runInNewContext(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,setTimeout(fn,ms){assert.equal(ms,8000);h.audioTimers??=new Map();const id=h.nextAudioTimer=(h.nextAudioTimer??0)+1;h.audioTimers.set(id,fn);return id;},clearTimeout(id){h.audioTimers?.delete(id);}});return m.exports;}
    if (name === './AudioProvider') return { useGameAudio: () => h.audio };
    if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener(type, callback) { assert.equal(type, 'change'); listener = callback; return { remove: () => { listener = null; } }; } } };
    if (name === 'expo-audio') return { useAudioPlayer(source, options) { return react.useMemo(() => {
      const player = { source, options, isLoaded:h.loadInitially??true,currentStatus:{isLoaded:h.loadInitially??true,error:null},statusListeners:new Set(),addListener(_event,cb){this.statusListeners.add(cb);return{remove:()=>this.statusListeners.delete(cb)};},emit(status){this.isLoaded=status.isLoaded;this.currentStatus=status;for(const cb of [...this.statusListeners])cb(status);}, playing: false, volume: 1, loop: false, plays: 0, pauses: 0, seeks: [],
        play() { this.plays++; this.playing = true; this.startedAt=now; }, pause() { this.pauses++; this.playing = false; },
        seekTo(second) { assert.equal(second, 0); let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); this.seeks.push({ resolve, reject }); return promise; },
      }; h.players.push(player); return player;
    }, [source]); } };
    if (/\.(mp3|wav|ogg)$/.test(name)) { assert.ok(fs.existsSync(path.resolve(path.dirname(filename), name)), name); return name; }
    throw new Error(`Unexpected ${name}`);
  },
}, { filename });
const { BattleAudio } = moduleObject.exports;
h = { slots: [], cursor: 0, effects: [], players: [], warnings: [], audio: { ready: true, settings: { music: .5, effects: .8, muted: false } }, props: { active: true, suspended: false, dead: false, events: { attack: 0, dash: 0, damage: 0, kill: 0, pickup: 0, level: 0, chest: 0, wave: 0, boss: 0, bossAttack: 0, bossHit: 0, bossPhase: 0, death: 0 } } };
function render(patch = {}) { for(const p of h.players)if(p.playing&&p.source.endsWith('.wav')){const b=fs.readFileSync(path.resolve(path.dirname(filename),p.source));const duration=(b.length-44)/b.readUInt32LE(28)*1000;if(now-p.startedAt>=duration)p.pause();} Object.assign(h.props, patch); h.cursor = 0; BattleAudio(h.props); for (const effect of h.effects.splice(0)) effect(); }
function event(patch) { now += 300; render({ events: { ...h.props.events, ...patch } }); }
function settings(patch) { h.audio.settings = { ...h.audio.settings, ...patch }; render(); }
render();
const music = h.players.find(p => p.source.endsWith('heavy_battle_1_bpm190.mp3'));
const deathMusic = h.players.find(p => p.source.endsWith('die menu.mp3'));
const cue = name => h.players.find(p => p.source.endsWith(`/mixed/${name==='dash'?'dash-jugador':'legacy-'+name}.wav`));
const [attack, dash, damage, level, chest, bossAttack] = ['attack', 'dash', 'damage', 'level', 'chest', 'bossAttack'].map(cue);
const hurt = h.players.find(p => p.source.includes('Single_Low_O_No_Reverb'));
const phase = h.players.find(p => p.source.includes('Single_Low_AU_No_Reverb'));
assert(hurt && phase, 'Existing distinct dry low creature voices for boss damage and phase');
const monster = h.players.find(p => p.source.includes('Single_Low_AU_Reverb'));
assert(monster, 'Existing low creature-like voice for boss entrances');
const effects = h.players.filter(p => p !== music && p !== deathMusic);
assert.ok(music && deathMusic, 'Exciting licensed battle track and exact existing die menu asset');
assert.ok(h.players.every(p => !p.source.includes('/battle/')), 'No audio player references retired battle folder');
assert.equal(h.players.length, 34); assert.equal(music.loop, true); assert.equal(music.volume, .5 * .16); assert.equal(music.plays, 1);
assert.equal(deathMusic.playing, false);
const beep = cue('dust-beep'); assert(beep, 'Original tone1 has a portable short PCM beep');
const electricCharge=cue('electro-charge'),electricImpact=cue('electro-impact');assert(electricCharge&&electricImpact);
event({electricCharge:1});assert.equal(electricCharge.plays,1);render();assert.equal(electricCharge.plays,1,'Charge cue is edge-triggered');
event({electricImpact:1});assert.equal(electricImpact.plays,1);render();assert.equal(electricImpact.plays,1);
render({active:false});event({electricImpact:2});render({active:true});assert.equal(electricImpact.plays,1,'Paused electric impacts are consumed rather than replayed');
event({ bossBeep: 1 }); assert.equal(beep.plays, 1); render(); assert.equal(beep.plays, 1);
render({ active: false }); event({ bossBeep: 2 }); render({ active: true }); assert.equal(beep.plays, 1, 'Paused beep is consumed, never queued');
event({ bossBeep: 3 }); assert.equal(beep.plays, 2);
event({ bossIntro: 1 }); assert.equal(monster.plays, 1); render(); assert.equal(monster.plays, 1, 'Entrance voice exactly once');
const alarm=h.players.filter(p=>p.source.endsWith('/mixed/legacy-wave.wav')).at(-1);
for(let i=1;i<=3;i++){now+=1000;event({shipAlarm:i});assert.equal(alarm.plays,i)}
render();assert.equal(alarm.plays,3,'No duplicate alarm on unrelated render');
const wavePlayer=cue('wave'),wavePlays=wavePlayer.plays;now+=1000;event({shipAlarm:4,wave:1});assert.equal(alarm.plays,4);assert.equal(wavePlayer.plays,wavePlays,'Wave cue never doubles the ship alarm');
event({zoneReward:1});assert.equal(chest.plays,1,'Reward uses existing reward cue once');
chest.plays=0;
event({ dash: 1 }); assert.equal(dash.plays, 1, 'Dash immediate teleport cue'); assert.equal(dash.volume, .8);
event({ attack: 1 }); assert.equal(attack.plays, 1, 'Starts without awaiting seek'); render(); assert.equal(attack.plays, 1, 'No replay on same event');
settings({ muted: true }); assert.equal(music.playing, false); assert.equal(attack.playing, false);
event({ dash: 2 }); assert.equal(dash.plays, 1, 'Muted dash not queued');
event({ attack: 2 }); settings({ muted: false }); assert.equal(attack.plays, 1, 'Muted events not queued');
event({ attack: 3 }); assert.equal(attack.plays, 2);
render({ active: false }); assert.ok(h.players.every(p => !p.playing)); event({ damage: 1 }); render({ active: true }); assert.equal(damage.plays, 0, 'Paused events not queued');
event({ damage: 2 }); assert.equal(damage.plays, 1);
render({ suspended: true, events: { ...h.props.events, level: 1, attack: 4 } }); assert.equal(music.playing, false); assert.equal(level.plays, 1); assert.equal(attack.plays, 2);
event({ chest: 1 }); assert.equal(chest.plays, 1);
render({ active: false, events: { ...h.props.events, level: 2 } }); assert.equal(level.plays, 1); assert.ok(h.players.every(p => !p.playing));
render({ active: true, suspended: false }); assert.equal(level.plays, 1); assert.equal(music.playing, true);
listener('background'); assert.ok(h.players.every(p => !p.playing)); event({ pickup: 1 }); listener('active'); render();
const beforePickup = h.players.map(p => p.plays);
event({ pickup: 2 }); assert.deepEqual(h.players.map(p => p.plays), beforePickup, 'EXP pickup is always silent');
event({ bossHit: 1 }); assert.equal(hurt.plays, 1, 'Boss damage gets its own short hurt cue');
assert.equal(hurt.volume, .8);
now += 50; render({ events: { ...h.props.events, bossHit: 2 } }); assert.equal(hurt.plays, 1, 'Hit sound cannot retrigger each frame');
now += 220; render({ events: { ...h.props.events, bossHit: 3 } }); assert.equal(hurt.plays, 2);
event({ bossPhase: 1 }); assert.equal(phase.plays, 1, 'Phase transition has a distinct growl');
assert.equal(phase.volume, .8);
event({ bossPhase: 2 }); assert.equal(phase.plays, 1, 'Simultaneous bandit phases share the phase sound cooldown');
now += 701; event({ bossPhase: 3 }); assert.equal(phase.plays, 2);
render({ suspended: true }); event({ bossHit: 4, bossPhase: 4 }); render({ suspended: false });
assert.equal(hurt.plays, 2); assert.equal(phase.plays, 2, 'Suspended phase/hit counters are consumed without delayed replay');
settings({ muted: true }); event({ bossHit: 5, bossPhase: 5 }); settings({ muted: false });
assert.equal(hurt.plays, 2); assert.equal(phase.plays, 2, 'Muted monster voices never queue');
event({ bossAttack: 1 }); assert.equal(bossAttack.plays, 1, 'Miniboss and boss attack counter triggers cue');
render({ suspended: true }); event({ bossAttack: 2 }); render({ suspended: false }); assert.equal(bossAttack.plays, 1, 'Attacks paused, never replayed on resume');
now += 300;
for(const p of effects)p.pause();
const beforeAll = h.players.map(p => p.plays);
render({ events: Object.fromEntries(Object.entries(h.props.events).map(([key, value]) => [key, value + 10])) });
assert.equal(h.players.reduce((sum, p, i) => sum + p.plays - beforeAll[i], 0), 3, 'Batched events capped to 3 cues');
assert.ok(effects.filter(p => p.playing).length <= 3, 'Bounded polyphony');
assert.equal(h.players.length, 34, 'No player creation after updates');
const beforeRate = attack.plays;
render({ events: { ...h.props.events, attack: h.props.events.attack + 1 } });
render({ events: { ...h.props.events, attack: h.props.events.attack + 1 } });
assert.ok(attack.plays <= beforeRate + 1, 'Rapid attacks rate limited');
settings({ effects: 0 }); assert.ok(effects.every(p => !p.playing)); event({ attack: 99 }); settings({ effects: .2 }); assert.equal(attack.volume, .2);
// Defeat replaces battle music and survives settings/background without rewinding.
render({ suspended: true, dead: true, events: { ...h.props.events, death: 1 } });
assert.equal(music.playing, false); assert.equal(deathMusic.playing, true); assert.equal(deathMusic.seeks.length, 1); assert.ok(effects.every(p => !p.playing));
settings({ music: .7 }); assert.equal(deathMusic.seeks.length, 1); assert.equal(deathMusic.volume, .7 * .8);
listener('background'); assert.ok(h.players.every(p => !p.playing)); listener('active'); assert.equal(deathMusic.playing, true); assert.equal(music.playing, false);
settings({ muted: true }); assert.ok(h.players.every(p => !p.playing)); settings({ muted: false }); assert.equal(deathMusic.playing, true);
render({ active: false }); assert.ok(h.players.every(p => !p.playing)); render({ active: true }); assert.equal(deathMusic.playing, true);
render({ dead: false, suspended: false }); assert.equal(deathMusic.playing, false); assert.equal(music.playing, true);
render({ dead: true, suspended: true }); assert.equal(deathMusic.seeks.length, 2, 'Each new defeat rewinds exactly once');
render({ active: false, dead: false, suspended: false }); render({ events: Object.fromEntries(Object.keys(h.props.events).map(key => [key, 0])) }); render({ active: true }); event({ attack: 1 }); assert.equal(attack.playing, true, 'New run resets counters safely');

const optionalPlayers=[wavePlayer,phase,beep];
for(let type=0;type<3;type++){now+=1000;const plays=optionalPlayers[type].plays,waves=wavePlayer.plays;event({eventStart:type+1,eventCue:type,wave:20+type});assert.equal(optionalPlayers[type].plays,plays+1,'One distinct existing cue identifies this event');if(type!==0)assert.equal(wavePlayer.plays,waves,'Optional warning suppresses simultaneous normal wave alert');render();assert.equal(optionalPlayers[type].plays,plays+1)}
now+=1000;const rewardPlays=chest.plays;event({eventComplete:1});assert.equal(chest.plays,rewardPlays+1);render();assert.equal(chest.plays,rewardPlays+1,'Completion reward cue is once-only');
settings({muted:true});const mutedPlays=phase.plays;event({eventStart:4,eventCue:1});settings({muted:false});assert.equal(phase.plays,mutedPlays,'Muted event alerts never replay later');


settings({effects:.8});render({active:true,suspended:false,dead:false});for(const p of effects)p.pause();
const authoredCue=h.players.find(p=>p.source.endsWith('/mixed/charge-explosion-evil-sage.wav'));
const actionEvent=(serial,owner=7)=>({actionSounds:{sageCharge:{serial,owner}}});
event(actionEvent(1));assert.equal(authoredCue.plays,1);assert.equal(authoredCue.volume,.8);render();assert.equal(authoredCue.plays,1);
event({actionStops:{sageCharge:1}});assert.equal(authoredCue.playing,false);
event({...actionEvent(2),actionStops:{sageCharge:2}});assert.equal(authoredCue.plays,1,'Start and death coalesced before RN cannot replay a dead owner');
event(actionEvent(3));assert.equal(authoredCue.plays,2);
render({suspended:true});assert.equal(authoredCue.playing,false);event(actionEvent(4));render({suspended:false});assert.equal(authoredCue.plays,2,'No stale charge on resume');
settings({muted:true});event(actionEvent(5));settings({muted:false});assert.equal(authoredCue.plays,2);
event(actionEvent(6));assert.equal(authoredCue.plays,3);listener('background');assert.equal(authoredCue.playing,false);listener('active');render();assert.equal(authoredCue.plays,3);
event({authoredAudio:true,bossAttackSound:0,bossAttack:500,bossBeep:500,electricCharge:500,electricImpact:500});
const oldVoiceCounts=[bossAttack,beep,electricCharge,electricImpact].map(p=>p.plays);render();assert.deepEqual([bossAttack,beep,electricCharge,electricImpact].map(p=>p.plays),oldVoiceCounts,'Authored attacks do not double with generic effects');

// Real dashes must remain audible when a delayed RN update batches several
// boss cues with the player action. Only three effect voices may play at once.
for (const p of effects) p.pause();
const dashBeforeBurst=dash.plays;
for(let n=1;n<=12;n++){
  now+=1000;
  event({dash:(h.props.events.dash??0)+1,actionSounds:{
    archerShot:{serial:100+n,owner:7},sageCharge:{serial:100+n,owner:8},
    sageExplosion:{serial:100+n,owner:8},electroStorm:{serial:100+n,owner:9},
  }});
  assert.equal(dash.plays,dashBeforeBurst+n,'Boss cues cannot consume the voice budget before a valid dash');
  assert(dash.playing,'The dash voice survives admission of competing effects');
  assert(effects.filter(p=>p.playing).length<=3);
  const seeks=dash.seeks.length,pauses=dash.pauses;
  for(let tap=0;tap<20;tap++)render({events:{...h.props.events}});
  assert.equal(dash.seeks.length,seeks,'Repeated rejected dash presses do not restart its player');
  assert.equal(dash.pauses,pauses,'Repeated input without a successful dash cannot mute its sound');
  event({actionSounds:{guardianLasers:{serial:200+n,owner:9},
    dustSlam:{serial:200+n,owner:10},electroProjectile:{serial:200+n,owner:9}}});
  assert(dash.playing,'New boss cues cannot immediately evict an ongoing dash');
  assert(effects.filter(p=>p.playing).length<=3);
}

const lastPlays = h.players.map(p => p.plays);
for (const slot of h.slots) slot?.cleanup?.();
assert.equal(listener, null); assert.ok(h.players.every(p => !p.playing), 'Unmount pauses everything');
(async () => {
  for (const player of h.players) for (const pending of player.seeks) pending.resolve();
  await Promise.resolve(); assert.deepEqual(h.players.map(p => p.plays), lastPlays, 'No stale seek replay after cleanup');
  const normalized=JSON.parse(fs.readFileSync(path.join(root,'assets/sounds/mixed/sources.json'),'utf8'));
  for(const player of effects)assert(normalized.cues.some(c=>player.source.endsWith(c.output.slice('assets/sounds'.length))),'Every playable effect is normalized with preserved provenance');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/sounds/gameplay/sources.json')));
  for (const player of effects.filter(p => p.source.includes('/gameplay/'))) {
    assert(manifest.cues.some(entry => player.source.endsWith('/'+entry.cue+'.wav')), 'Each derived effect has its provenance entry');
  }
  for (const player of [hurt, phase, monster]) {
    const original = fs.readFileSync(path.resolve(path.dirname(filename), player.source));
    assert.equal(original.toString('ascii', 0, 4), 'RIFF');
    assert.equal(original.readUInt16LE(20), 1, 'Existing monster voices are Expo-compatible PCM');
  }
  const retired = JSON.parse(fs.readFileSync(path.join(root, 'assets/sounds/battle/sources.json'))).cues;
  const crypto = require('node:crypto');
  for (const entry of manifest.cues) {
    assert.ok(!retired.some(old => old.originalSHA256 === entry.originalSHA256), 'New cues use different original assets, not renamed old cues');
    const original = fs.readFileSync(path.resolve(root, 'assets/sounds/gameplay', entry.original));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), entry.originalSHA256, 'Original preserved');
    const wav = fs.readFileSync(path.join(root, `assets/sounds/gameplay/${entry.cue}.wav`));
    assert.equal(crypto.createHash('sha256').update(wav).digest('hex'), entry.derivedSHA256);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.readUInt16LE(20), 1); assert.equal(wav.readUInt16LE(34), 16);
    assert.ok(entry.duration > .04 && entry.duration < 2 && entry.peak < 1 && entry.rms > .01, 'Valid audible short PCM effect');
    assert.ok(entry.onset <= .003, 'Feedback audible within 3ms of WAV start');
  }
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/sounds/music/heavy_battle_1_bpm190.mp3'))).digest('hex'), '790bf97caead77553df5b75aa658323750ba2816df3071616c207612c6d69d7e');
  assert.ok(fs.readFileSync(path.join(root, 'assets/sounds/music/BATTLE_LICENSE.md'), 'utf8').includes('CC0'));
  const oldHarness=h;const checkpoints=[];h={slots:[],cursor:0,effects:[],players:[],warnings:[],loadInitially:false,audio:oldHarness.audio,props:{...oldHarness.props,active:true,suspended:false,dead:false,events:Object.fromEntries(Object.keys(oldHarness.props.events).map(k=>[k,0])),onPrepared:(c,total)=>checkpoints.push([c,total])}};
  render();assert(h.players.every(p=>!p.playing),'No soundtrack/effect can start during actual pending readiness');const lateAttack=h.players.find(p=>p.source.endsWith('/mixed/legacy-attack.wav')),lateLevel=h.players.find(p=>p.source.endsWith('/mixed/legacy-level.wav'));
  for(const p of h.players)if(p!==lateAttack&&p!==lateLevel)p.emit({isLoaded:true,error:null});lateAttack.emit({isLoaded:false,error:'fixture optional failure'});assert.equal(checkpoints.at(-1)[0],33);assert(h.players.every(p=>!p.playing));
  for(const fn of [...h.audioTimers.values()])fn();assert.deepEqual(checkpoints.at(-1),[34,34]);assert.equal(h.audioTimers.size,0);render();assert(h.players.find(p=>p.source.endsWith('heavy_battle_1_bpm190.mp3')).playing,'Valid ready track starts without an extra fixed wait');event({attack:1,level:1});assert.equal(lateAttack.plays,0);assert.equal(lateLevel.plays,0);
  lateAttack.emit({isLoaded:true,error:null});lateLevel.emit({isLoaded:true,error:null});event({attack:2,level:2});assert.equal(lateAttack.plays,0);assert.equal(lateLevel.plays,1,'A delayed cue recovers after real native readiness; actual decode failures stay disabled');for(const slot of h.slots)slot?.cleanup?.();h=oldHarness;
  console.log('Battle audio OK: 34 persistent players, original menu restored, new source cues, silent EXP, attack cues, exact death track, volume/mute, pause/background/retry, rate limits and <=3 effect voices.');
})().catch(error => { console.error(error); process.exitCode = 1; });
