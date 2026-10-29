const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const cache = new Map();
let harness;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  createContext: () => ({ Provider: 'provider' }),
  useRef(value) {
    const i = harness.cursor++;
    return harness.slots[i] ??= { current: value };
  },
  useState(value) {
    const i = harness.cursor++;
    const slot = harness.slots[i] ??= { value: typeof value === 'function' ? value() : value };
    return [slot.value, next => {
      const value = typeof next === 'function' ? next(slot.value) : next;
      if (!Object.is(slot.value, value)) { slot.value = value; harness.dirty = true; }
    }];
  },
  useMemo(factory, deps) {
    const i = harness.cursor++;
    let slot = harness.slots[i];
    if (!slot || !sameDeps(slot.deps, deps)) harness.slots[i] = slot = { value: factory(), deps };
    return slot.value;
  },
  useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  useEffect(effect, deps) {
    const i = harness.cursor++;
    const slot = harness.slots[i];
    if (!slot || !sameDeps(slot.deps, deps)) {
      const next = { deps, cleanup: slot?.cleanup };
      harness.slots[i] = next;
      harness.effects.push(() => { next.cleanup?.(); next.cleanup = effect(); });
    }
  },
};
react.useLayoutEffect = react.useEffect;
function load(filename) {
  const resolved = path.resolve(root, filename);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: resolved,
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, console,setTimeout,clearTimeout,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
      if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
      if (name === 'expo-audio') return {
        useAudioPlayer(source, options) {
          const player = react.useMemo(() => {
            const player = {
              source, options, isLoaded:true,duration:.25, playing: false, volume: 1, loop: false, playCount: 0, pauseCount: 0,
              seeks: [], listeners: [],
              play() { this.playing = true; this.playCount++; },
              pause() { this.playing = false; this.pauseCount++; },
              seekTo(seconds) {
                assert.equal(seconds, 0);
                const operation = deferred(); this.seeks.push(operation); return operation.promise;
              },
              addListener(event, fn) {
                assert.equal(event, 'playbackStatusUpdate'); this.listeners.push(fn);
                return { remove: () => { this.listeners = this.listeners.filter(listener => listener !== fn); } };
              },
            };
            harness.players.push(player);
            return player;
          }, [source]);
          // Expo's useAudioPlayer releases its native SharedObject on unmount.
          react.useEffect(() => () => { player.pause(); player.released = true; }, [player]);
          return player;
        },
        setAudioModeAsync: options => { harness.mode = options; return harness.modeReady.promise; },
      };
      if (/\.(wav|mp3)$/.test(name)) {
        assert.ok(fs.existsSync(path.resolve(path.dirname(resolved), name)), `Missing original asset ${name}`);
        return name;
      }
      return load(path.relative(root, path.resolve(path.dirname(resolved), `${name}.ts`)));
    },
  }, { filename: resolved });
  return module.exports;
}
const storage = {
  getItem: () => harness.read.promise,
  setItem: async (key, value) => { harness.writes.push({ key, value }); },
};
const { AudioProvider } = load('src/ui/AudioProvider.tsx');
const { readAudioSettings, validAudioPatch, AUDIO_SETTINGS_KEY } = load('src/ui/audioSettings.ts');
function render() {
  harness.cursor = 0;
  harness.dirty = false;
  harness.value = AudioProvider(harness.props).props.value;
  for (const effect of harness.effects.splice(0)) effect();
}
async function settle() {
  for (let i = 0; i < 12; i++) {
    if (harness.dirty) render();
    await Promise.resolve();
  }
}
function changeProps(patch) { Object.assign(harness.props, patch); render(); }
function start() {
  harness = { slots: [], cursor: 0, effects: [], dirty: true, players: [], writes: [], read: deferred(), modeReady: deferred(), props: { children: null, active: true, menuActive: true } };
  render();
}
(async () => {
  assert.deepEqual(JSON.parse(JSON.stringify(validAudioPatch({ music: 8, effects: -3, muted: true }))), { music: 1, effects: 0, muted: true });
  assert.equal(Object.keys(validAudioPatch({ music: NaN, effects: 'loud', muted: 1 })).length, 0);
  assert.equal(readAudioSettings('null').music, 0.45);
  assert.equal(readAudioSettings('{"music":0.8}').effects, 0.65);
  assert.throws(() => readAudioSettings('{broken'));
  start();
  await settle();
  const [music, glitched, press, pause, resume] = harness.players;
  assert.ok(music.source.endsWith('menu.mp3'), 'Menu restores the original menu track');
  assert.equal(harness.players.length, 5, 'Exactly two persistent music tracks and three UI cues');
  assert.equal(music.playing, false, 'Do not play before settings hydrate');
  assert.equal(glitched.playing, false);
  assert.equal(harness.writes.length, 0, 'Do not overwrite saved settings with defaults');
  harness.value.updateSettings({ effects: 0.25 });
  harness.read.resolve('{"music":0.7,"effects":0.9,"muted":false}');
  await settle();
  assert.equal(harness.value.ready, false,'Settings alone cannot mark the native audio engine ready');
  assert.equal(harness.value.settings.music, 0.7);
  assert.equal(harness.value.settings.effects, 0.25, 'Early edits survive late storage response');
  assert.equal(music.playing, false, 'Hydrated settings must also wait for audio mode initialization');
  assert.equal(glitched.playing, false);
  harness.modeReady.resolve(); await settle();
  assert.equal(harness.value.ready,true);
  assert.equal(music.playing, true);
  assert.equal(glitched.playing, false);
  assert.equal(music.volume, 0.7);
  assert.equal(glitched.volume, 0.7);
  assert.equal(music.loop, true);
  assert.equal(harness.mode.shouldPlayInBackground, false);
  assert.equal(harness.mode.allowsRecording, false);
  assert.equal(harness.writes.at(-1).key, AUDIO_SETTINGS_KEY);
  harness.value.playUi();
  assert.equal(press.options.downloadFirst, true, 'Short cues are prepared ahead of interaction');
  assert.equal(press.seeks.length, 1);
  assert.equal(press.playCount, 1, 'Playback is dispatched in the gesture without waiting for seek completion');
  harness.value.updateSettings({ effects: 0.4 });
  assert.equal(press.volume, 0.4, 'Volume applies before next React render');
  press.seeks[0].resolve(); await settle();
  assert.equal(press.playCount, 1);
  assert.equal(press.volume, 0.4);
  harness.value.playUi('pause');
  harness.value.playUi('resume');
  pause.seeks[0].resolve(); resume.seeks[0].resolve(); await settle();
  assert.equal(pause.playCount, 1, 'Resolving a previous seek never replays a cue');
  assert.equal(pause.playing, false, 'A newer cue stops the previous effect');
  assert.equal(resume.playCount, 1);
  harness.value.playUi();
  harness.value.updateSettings({ muted: true });
  assert.equal(music.volume, 0); assert.equal(press.volume, 0);
  press.seeks[1].resolve(); await settle();
  assert.equal(press.playCount, 2, 'Seek completion after mute cannot replay a cue');
  assert.equal(press.playing, false);
  assert.equal(music.playing, false);
  harness.value.updateSettings({ muted: false }); await settle();
  changeProps({ menuActive: false }); await settle();
  assert.equal(music.playing, false, 'Starting game stops menu music');
  changeProps({ menuActive: true }); await settle();
  assert.equal(music.playing, true, 'Returning to menu reuses the same player');
  assert.equal(harness.players.length, 5);
  harness.value.playUi('pause');
  changeProps({ active: false }); await settle();
  pause.seeks[1].resolve(); await settle();
  assert.equal(pause.playCount, 2, 'Seek completion after backgrounding cannot replay a cue');
  assert.ok(harness.players.every(player => !player.playing));
  changeProps({ active: true }); await settle();
  assert.equal(music.playing, true);
  harness.value.updateSettings({ music: 0.3 });
  harness.value.updateSettings({ music: 0.6 }); await settle();
  assert.equal(JSON.parse(harness.writes.at(-1).value).music, 0.6);
  changeProps({ loadingActive: true }); await settle();
  assert.equal(music.playing, false, 'Loading takes precedence even while the menu remains active');
  assert.equal(glitched.playing, true);
  assert.equal(glitched.loop, true);
  assert.equal(glitched.volume, 0.6);
  assert.equal(harness.players.filter(player => player.playing).length, 1);
  // Browsers can reject initial autoplay. A gesture must unlock the current
  // loading track rather than accidentally starting the menu underneath it.
  glitched.pause();
  const oldMenuPlays = music.playCount;
  harness.value.playUi('resume');
  assert.equal(glitched.playing, true);
  assert.equal(music.playCount, oldMenuPlays);
  assert.equal(music.playing, false);
  const backgroundCue = resume.seeks.at(-1);
  changeProps({ active: false }); await settle();
  backgroundCue.resolve(); await settle();
  assert.equal(resume.playCount, 2, 'Backgrounded loading never replays a resolved cue');
  assert.ok(harness.players.every(player => !player.playing));
  changeProps({ active: true }); await settle();
  assert.equal(glitched.playing, true, 'Foreground restores the current loading track only');
  assert.equal(music.playing, false);
  harness.value.updateSettings({ music: 0 });
  assert.equal(glitched.volume, 0);
  assert.equal(glitched.playing, false, 'Zero music volume stops loading playback immediately');
  await settle();
  harness.value.updateSettings({ music: 0.4 }); await settle();
  assert.equal(glitched.playing, true);
  assert.equal(glitched.volume, 0.4);
  harness.value.updateSettings({ muted: true });
  assert.equal(glitched.playing, false, 'Mute stops Glitched before the next render');
  assert.equal(glitched.volume, 0);
  await settle();
  harness.value.updateSettings({ muted: false }); await settle();
  assert.equal(glitched.playing, true);
  changeProps({ loadingActive: false, menuActive: false }); await settle();
  assert.equal(glitched.playing, false, 'Starting gameplay stops loading audio');
  assert.equal(music.playing, false);
  harness.value.playUi();
  assert.equal(glitched.playing, false, 'A later gameplay gesture cannot restart stale loading audio');
  assert.equal(music.playing, false);
  changeProps({ menuActive: true }); await settle();
  assert.equal(music.playing, true, 'Menu track resumes after loading without another player');
  assert.equal(glitched.playing, false);
  changeProps({ loadingActive: true }); await settle();
  assert.equal(glitched.playing, true);
  assert.equal(music.playing, false);
  assert.equal(harness.players.length, 5, 'Repeated loads reuse persistent players');

  harness.modeReady=deferred();harness.value.retryAudio();await settle();assert.equal(harness.value.ready,false);
  harness.modeReady.reject(new Error('native initialization failed'));await settle();assert(harness.value.initializationError);assert.equal(harness.value.ready,false);
  harness.modeReady=deferred();harness.value.retryAudio();await settle();assert.equal(harness.value.initializationError,null);harness.modeReady.resolve();await settle();assert.equal(harness.value.ready,true);assert.equal(harness.value.error,null,'A successful explicit retry clears the old initialization error');
  storage.setItem = async () => { throw new Error('full'); };
  harness.value.updateSettings({ music: 0.2 }); await settle();
  assert.match(harness.value.error, /guardar/);
  assert.equal(harness.value.settings.music, 0.2);
  const oldPlays=press.playCount;press.isLoaded=false;press.duration=0;harness.value.playUi('press');assert.equal(press.playCount,oldPlays,'Initial UI cues never queue play before source readiness');press.duration=.25;harness.value.playUi('press');assert.equal(press.playCount,oldPlays+1,'Finished Android clips remain replayable through their known duration');press.isLoaded=true;
  harness.value.playUi('press');
  const pending = press.seeks.at(-1);
  const playsBeforeUnmount = press.playCount;
  for (const slot of harness.slots) slot?.cleanup?.();
  pending.resolve(); await settle();
  assert.equal(press.playCount, playsBeforeUnmount, 'No seek completion schedules playback after unmount');
  assert.ok(harness.players.every(player => player.listeners.length === 0));
  assert.ok(harness.players.every(player => player.released && !player.playing), 'Unmount releases all music and cue players');
  console.log('Audio OK: hydrated/initialized playback, persistence, immediate volume/mute, exclusive menu/Glitched transitions, correct gesture unlock, background/unmount cleanup and immediate gesture playback without stale-seek replays. Native audio output requires device verification.');
})().catch(error => { console.error(error); process.exitCode = 1; });
