/** Derive portable PCM copies. Original OGG/music files are never modified.
 * Dev-only: DYSTOPIA_PLAYWRIGHT and DYSTOPIA_CHROME select existing tools.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.DYSTOPIA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cues = {
  attack: 'spaceTrash3.ogg', dash: 'phaseJump4.ogg', damage: 'highDown.ogg', kill: 'spaceTrash4.ogg',
  level: 'powerUp7.ogg', chest: 'powerUp2.ogg',
  wave: 'twoTone2.ogg', boss: 'lowRandom.ogg', bossAttack: 'spaceTrash2.ogg',
  'dust-beep': 'tone1.ogg',
  'electro-charge':'zapThreeToneUp.ogg','electro-impact':'zap1.ogg',
};
const onlyDustBeep = process.argv.includes('--dust-beep');
const onlyElectro = process.argv.includes('--electrocutioner');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DYSTOPIA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage();
    const out = path.join(root, 'assets/sounds/gameplay'); fs.mkdirSync(out, { recursive: true });
    async function derive(source, target, kind) {
      const bytes = fs.readFileSync(source);
      const decoded = await page.evaluate(async ({ base64, kind }) => {
        const context = new OfflineAudioContext(1, 1, 22050);
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const buffer = await context.decodeAudioData(bytes.buffer);
        let data = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const channel = buffer.getChannelData(c);
          for (let i = 0; i < data.length; i++) data[i] += channel[i] / buffer.numberOfChannels;
        }
        let first = 0;
        if (kind !== 'music') {
          first = Math.max(0, data.findIndex(value => Math.abs(value) > 0.001) - Math.round(buffer.sampleRate * 0.002));
          data = data.slice(first);
        }
        if (kind === 'attack') {
          // A brief airy blade swish from the existing noisy effect, with its
          // low rumble removed and the sharp high end softened. No synthesized art.
          data = data.slice(0, Math.round(buffer.sampleRate * 0.17));
          const hp = 1 / (1 + 2 * Math.PI * 650 / buffer.sampleRate);
          const lp = 1 - Math.exp(-2 * Math.PI * 4300 / buffer.sampleRate);
          let last = 0, high = 0, low = 0, max = 0;
          for (let i = 0; i < data.length; i++) {
            const sample = data[i]; high = hp * (high + sample - last); last = sample;
            low += lp * (high - low);
            const envelope = Math.min(1, i / (buffer.sampleRate * 0.006)) * Math.pow(1 - i / data.length, 1.5);
            data[i] = low * envelope; max = Math.max(max, Math.abs(data[i]));
          }
          if (max > 0) for (let i = 0; i < data.length; i++) data[i] *= 0.5 / max;
        } else if (kind === 'dust-beep') {
          data = data.slice(0, Math.round(buffer.sampleRate * 0.13));
          for (let i = 0; i < data.length; i++) data[i] *= Math.min(1, i / 22, (data.length - 1 - i) / 110);
        } else if (kind !== 'music') {
          for (let i = 0; i < Math.min(22, data.length); i++) data[i] *= i / 22;
        }
        // Trim near-silence after filtering too, so action feedback starts at once.
        const audible = data.findIndex(value => Math.abs(value) > 0.01);
        if (audible > 44) { first += audible - 44; data = data.slice(audible - 44); }
        let peak = 0, energy = 0, onset = -1;
        const pcm = new Uint8Array(data.length * 2), view = new DataView(pcm.buffer);
        for (let i = 0; i < data.length; i++) {
          const value = Math.max(-1, Math.min(1, data[i]));
          peak = Math.max(peak, Math.abs(value)); energy += value * value;
          if (onset < 0 && Math.abs(value) > 0.01) onset = i / buffer.sampleRate;
          view.setInt16(i * 2, Math.round(value * 32767), true);
        }
        let binary = '';
        for (let i = 0; i < pcm.length; i += 8192) binary += String.fromCharCode(...pcm.subarray(i, i + 8192));
        return { sampleRate: buffer.sampleRate, duration: data.length / buffer.sampleRate, trimmedSeconds: first / buffer.sampleRate, peak, rms: Math.sqrt(energy / data.length), onset, pcm: btoa(binary) };
      }, { base64: bytes.toString('base64'), kind });
      const pcm = Buffer.from(decoded.pcm, 'base64'); delete decoded.pcm;
      const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4);
      header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
      header.writeUInt32LE(decoded.sampleRate, 24); header.writeUInt32LE(decoded.sampleRate * 2, 28);
      header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
      const wav = Buffer.concat([header, pcm]); fs.writeFileSync(target, wav);
      return { originalSHA256: hash(bytes), derivedSHA256: hash(wav), ...decoded };
    }
    const manifest = [];
    for (const [cue, filename] of Object.entries(cues)) {
      if (onlyDustBeep && cue !== 'dust-beep') continue;
      if (onlyElectro && !cue.startsWith('electro-')) continue;
      const original = `../Audio sounds effect/${filename}`;
      manifest.push({ cue, original, processing: cue === 'attack' ? '170ms, 650Hz highpass / 4300Hz lowpass, soft amplitude envelope, peak 0.5' : cue === 'dust-beep' ? 'Mono PCM, onset trim, 130ms maximum, 1ms fade-in/5ms fade-out' : 'Mono, onset trim, 1ms fade-in', ...await derive(path.join(out, original), path.join(out, `${cue}.wav`), cue) });
    }

    const previous = onlyDustBeep||onlyElectro ? JSON.parse(fs.readFileSync(path.join(out, 'sources.json'), 'utf8')) : null;
    fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify({ note: 'Portable derived mono PCM WAVs; original assets unchanged. All cue originals differ from the retired battle folder; no original files modified.', music: 'music/heavy_battle_1_bpm190.mp3 (CC0; see ../music/BATTLE_LICENSE.md)', cues: [...(previous?.cues ?? []).filter(cue => !manifest.some(next=>next.cue===cue.cue)), ...manifest] }, null, 2) + '\n');
    console.log(JSON.stringify({ cues: manifest }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
