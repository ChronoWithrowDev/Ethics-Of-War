// Fully procedural WebAudio: no asset files needed.
import type { MusicDef } from './data';
import { STOCK_SAMPLES } from './stockAudio';

type OscType = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxBus!: GainNode; musicBus!: GainNode;
  noiseBuf!: AudioBuffer;
  masterVol = 0.7; musicVol = 0.5;
  private musicTimer: number | null = null;
  private step = 0; private nextTime = 0; private music: MusicDef | null = null; private pat: number[] = []; private arp: number[] = [];
  intensity = 0.3;
  private arcNodes: { osc: OscillatorNode; osc2: OscillatorNode; g: GainNode } | null = null;
  private arcSource: AudioBufferSourceNode | null = null;
  private sampleBuffers = new Map<string, AudioBuffer>();
  private sampleLoading = new Set<string>();

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.masterVol;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.35; this.musicBus.connect(this.master);
    this.preloadSamples();
    const len = this.ctx.sampleRate * 3;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  /** Decode the bundled stock recordings. Playback falls back to synthesis until a clip is ready. */
  preloadSamples() {
    if (!this.ctx) return;
    for (const [name, url] of Object.entries(STOCK_SAMPLES)) {
      if (this.sampleBuffers.has(name) || this.sampleLoading.has(name)) continue;
      this.sampleLoading.add(name);
      fetch(url).then(r => r.arrayBuffer()).then(ab => this.ctx!.decodeAudioData(ab)).then(buf => { this.sampleBuffers.set(name, buf); this.sampleLoading.delete(name); })
        .catch(() => { this.sampleLoading.delete(name); });
    }
  }
  sampleReady(name: string) { return this.sampleBuffers.has(name); }
  /** Play a stock recording. Returns false when it is not decoded yet. */
  playSample(name: string, vol = 1, pan = 0, rate = 1, maxDur = 0): boolean {
    const c = this.ctx; if (!c || vol <= 0.01) return false;
    const buf = this.sampleBuffers.get(name); if (!buf) return false;
    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = Math.min(1, vol);
    src.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); } else g.connect(this.sfxBus);
    src.start(); if (maxDur > 0) src.stop(c.currentTime + maxDur);
    return true;
  }

  setVolumes(master: number, music: number) {
    this.masterVol = master; this.musicVol = music;
    if (this.ctx) { this.master.gain.value = master; this.musicBus.gain.value = music * 0.35; }
  }

  private tone(f0: number, f1: number, dur: number, type: OscType, vol: number, delay = 0, bus?: AudioNode, pan = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus || this.sfxBus); } else g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, f0: number, f1: number, ftype: BiquadFilterType = 'lowpass', delay = 0, pan = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); } else g.connect(this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** Port of GameSFX._playTone: exponential gain envelope from gainStart → gainEnd (may rise), optional delay. */
  private sfxTone(type: OscType, f0: number, f1: number, dur: number, g0: number, g1 = 0.001, delay = 0, pan = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(Math.max(0.0001, g0), t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, g1), t + dur);
    o.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); } else g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.01);
  }
  /** Port of GameSFX._playNoise. */
  private sfxNoise(dur: number, ftype: BiquadFilterType, f0: number, f1: number, g0: number, g1 = 0.001, delay = 0, pan = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(Math.max(0.0001, g0), t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, g1), t + dur);
    src.connect(f); f.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); } else g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.01);
  }

  play(name: string, v = 1, pan = 0) {
    if (!this.ctx || v <= 0.01) return;
    const T = (a: number, b: number, d: number, ty: OscType, vol: number, dl = 0) => this.tone(a, b, d, ty, vol * v, dl, undefined, pan);
    const N = (d: number, vol: number, a: number, b: number, ft: BiquadFilterType = 'lowpass', dl = 0) => this.noise(d, vol * v, a, b, ft, dl, pan);
    switch (name) {
      // ---- GameSFX ports (weapon + explosion recipes) ----
      case 'revolver': // Huerfano .45 — recorded CZ-52 pistol
        if (!this.playSample('revolver', v, pan, 0.98 + Math.random() * 0.05)) { this.sfxTone('sawtooth', 420, 75, 0.11, 0.75 * v, 0.001, 0, pan); this.sfxNoise(0.16, 'bandpass', 2200, 450, 0.9 * v, 0.001, 0, pan); this.sfxNoise(0.45, 'lowpass', 950, 180, 0.28 * v, 0.001, 0.09, pan); } break;
      case 'fan': if (!this.playSample('revolver', v * 0.8, pan, 1.3)) { N(0.1, 0.6, 3000, 400); T(200, 60, 0.09, 'sawtooth', 0.3); } break;
      case 'powerline': // Powerline 880 — real air-rifle/BB-gun snap + pressurized air puff
        if (!this.playSample('powerline', v, pan, 0.98 + Math.random() * 0.06)) { this.sfxTone('sine', 920, 180, 0.06, 0.55 * v, 0.001, 0, pan); this.sfxNoise(0.08, 'highpass', 2500, 1200, 0.75 * v, 0.001, 0, pan); } break;
      case 'pump': // Powerline 880 under-lever air pump stroke
        if (!this.playSample('pump', v * 0.95, pan, 0.96 + Math.random() * 0.08)) { N(0.14, 0.35, 900, 500, 'bandpass'); T(130, 80, 0.12, 'triangle', 0.4); T(500, 800, 0.05, 'square', 0.08, 0.1); } break;
      case 'load': N(0.08, 0.3, 2500, 1500, 'bandpass'); T(700, 350, 0.06, 'square', 0.15); break;
      case 'loadDone': T(300, 150, 0.08, 'square', 0.25); N(0.08, 0.3, 1500, 600, 'bandpass'); break;
      case 'scatter': // Cucharas Scattergun — recorded shotgun
        if (!this.playSample('scatter', v, pan, 0.97 + Math.random() * 0.05)) { this.sfxTone('sine', 165, 38, 0.28, 0.95 * v, 0.001, 0, pan); this.sfxTone('sawtooth', 140, 45, 0.22, 0.5 * v, 0.001, 0, pan); this.sfxNoise(0.38, 'lowpass', 2800, 280, 0.9 * v, 0.001, 0, pan); } break;
      case 'scatterPump': // Real pump-action shotgun slide click-clack
        if (!this.playSample('scatterPump', v * 0.9, pan, 0.98 + Math.random() * 0.04)) { N(0.18, 0.4, 1200, 400, 'bandpass'); T(150, 90, 0.1, 'triangle', 0.4); T(400, 700, 0.05, 'square', 0.1, 0.12); } break;
      case 'chaingun': // Twin Peaks — recorded SKS shot, retriggered at full-auto rate
        if (!this.playSample('chaingun', v * 0.85, pan, 1.05 + Math.random() * 0.08, 0.16)) { this.sfxTone('sawtooth', 190, 52, 0.09, 0.65 * v, 0.001, 0, pan); this.sfxNoise(0.11, 'bandpass', 1600, 320, 0.75 * v, 0.001, 0, pan); this.sfxTone('triangle', 145, 140, 0.08, 0.25 * v, 0.001, 0, pan); } break;
      case 'chainSpinUp': this.sfxNoise(0.35, 'bandpass', 800, 2600, 0.05 * v, 0.3 * v, 0, pan); break;
      case 'chainSpinDown': this.sfxNoise(0.5, 'bandpass', 2400, 400, 0.25 * v, 0.001, 0, pan); break;
      case 'rivet': // Rivet Driver — Kenney metal-impact recording
        if (!this.playSample('rivet', v, pan, 0.9 + Math.random() * 0.25)) { this.sfxTone('square', 380, 110, 0.08, 0.5 * v, 0.001, 0, pan); this.sfxTone('triangle', 1250, 900, 0.06, 0.35 * v, 0.001, 0, pan); this.sfxNoise(0.09, 'highpass', 1800, 900, 0.55 * v, 0.001, 0, pan); } break;
      case 'thump': // Coal-Mine Thumper — recorded 40mm M203/M320 grenade launcher blooper
        if (!this.playSample('thumper', v, pan, 0.96 + Math.random() * 0.06)) { this.sfxTone('sine', 160, 42, 0.16, 0.9 * v, 0.001, 0, pan); this.sfxNoise(0.12, 'lowpass', 500, 120, 0.6 * v, 0.001, 0, pan); } break;
      case 'rocket': // Sunburst Launcher — punchy RPG ignition + rocket leaving the launcher
        if (!this.playSample('launch', v, pan, 0.98 + Math.random() * 0.05)) { this.sfxTone('sine', 210, 55, 0.22, 0.85 * v, 0.001, 0, pan); this.sfxTone('triangle', 320, 95, 0.14, 0.4 * v, 0.001, 0, pan); this.sfxNoise(0.18, 'bandpass', 650, 250, 0.45 * v, 0.001, 0, pan); } break;
      case 'rail': // Piercer Rail Cannon — Kenney large-laser recording
        if (!this.playSample('rail', v, pan, 1.05)) { this.sfxNoise(0.45, 'bandpass', 3200, 400, 0.9 * v, 0.001, 0, pan); this.sfxTone('sawtooth', 1600, 90, 0.4, 0.6 * v, 0.001, 0, pan); this.sfxTone('triangle', 950, 880, 0.5, 0.25 * v, 0.001, 0, pan); } break;
      case 'railCharge': // capacitor whine: stock force-field layer + a quiet rising synth guide
        if (!this.playSample('vectorCharge', v * 0.7, pan, 1.2)) { this.sfxTone('sine', 400, 2800, 0.22, 0.01, 0.35 * v, 0, pan); this.sfxTone('sawtooth', 200, 1400, 0.22, 0.01, 0.2 * v, 0, pan); } break;
      case 'vector': if (!this.playSample('vector', v, pan, 0.9)) { T(40, 900, 1.1, 'sine', 0.9); T(300, 30, 1.4, 'sawtooth', 0.35); N(1.2, 0.6, 200, 3000, 'bandpass'); } this.playSample('vectorCharge', v * 0.55, pan, 0.8, 1.2); break;
      case 'vectorEnd': if (!this.playSample('explosionLow', v, pan, 0.8)) { T(900, 25, 0.9, 'sine', 1); N(0.9, 1, 3000, 80); T(60, 25, 0.9, 'sine', 1); } break;
      case 'explode': // realistic layered explosion blast + deep boom tail
        if (!this.playSample('explosion', v, pan, 0.96 + Math.random() * 0.08)) { this.sfxTone('sine', 130, 24, 0.9, 1.0 * v, 0.001, 0, pan); this.sfxNoise(1.4, 'lowpass', 1200, 90, 0.95 * v, 0.001, 0, pan); this.sfxNoise(0.8, 'bandpass', 2400, 300, 0.4 * v, 0.001, 0.05, pan); } else { this.playSample('explosionLow', v * 0.45, pan, 0.95); } break;
      case 'hit': T(900, 500, 0.04, 'square', 0.18); break;
      case 'headshot': T(1400, 900, 0.06, 'square', 0.25); T(2000, 1200, 0.05, 'triangle', 0.18, 0.04); break;
      case 'kill': T(320, 70, 0.22, 'sawtooth', 0.35); N(0.2, 0.4, 1800, 200); break;
      case 'hurt': T(220, 80, 0.2, 'sawtooth', 0.7); N(0.12, 0.5, 1500, 300); break;
      case 'pickup': T(600, 1200, 0.08, 'square', 0.18); T(900, 1600, 0.08, 'square', 0.18, 0.07); break;
      case 'weapon': [0, 4, 7, 12].forEach((s, i) => T(330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 0.18, 'square', 0.2, i * 0.07)); break;
      case 'door': if (!this.playSample('door', v * 0.8, pan, 1)) { N(0.5, 0.35, 300, 1400, 'bandpass'); T(70, 130, 0.4, 'triangle', 0.5); } break;
      case 'secret': [0, 3, 7, 10, 14].forEach((s, i) => T(440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), 0.35, 'triangle', 0.3, i * 0.1)); N(0.9, 0.3, 200, 600, 'bandpass'); break;
      case 'enemyShot': T(520, 180, 0.12, 'square', 0.16); break;
      case 'enemyBig': N(0.3, 0.5, 1500, 200); T(150, 60, 0.3, 'sawtooth', 0.4); break;
      case 'roar': T(95, 45, 0.55, 'sawtooth', 0.5); N(0.5, 0.35, 700, 120); break;
      case 'bossTaunt': T(70, 40, 1.0, 'sawtooth', 0.6); T(140, 60, 1.0, 'square', 0.25); N(1.0, 0.4, 500, 100); break;
      case 'jump': T(220, 420, 0.1, 'sine', 0.25); break;
      case 'land': N(0.1, 0.35, 500, 100); break;
      case 'dash': N(0.28, 0.5, 800, 4000, 'highpass'); break;
      case 'portal': T(200, 1200, 0.9, 'sine', 0.35); T(205, 1210, 0.9, 'sine', 0.35); break;
      case 'teleport': T(1500, 200, 0.2, 'sine', 0.25); N(0.15, 0.3, 4000, 800, 'highpass'); break;
      case 'click': N(0.03, 0.4, 3000, 1500, 'highpass'); break;
      case 'swing': N(0.15, 0.3, 400, 1500, 'bandpass'); break;
      case 'equip': N(0.1, 0.3, 1500, 800, 'bandpass'); T(260, 330, 0.06, 'square', 0.1); break;
      case 'ui': T(500, 700, 0.06, 'square', 0.12); break;
      default: break;
    }
  }

  arcStart() {
    const c = this.ctx; if (!c || this.arcNodes) return;
    const t = c.currentTime;
    // --- opening thunderclap: crack, body and a ~2 second reverberant tail (feedback delay)
    const delay = c.createDelay(1); delay.delayTime.value = 0.14;
    const fb = c.createGain(); fb.gain.value = 0.42; const wet = c.createGain(); wet.gain.value = 0.5;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.sfxBus);
    const boom = c.createOscillator(); const bg = c.createGain(); boom.type = 'sine';
    boom.frequency.setValueAtTime(120, t); boom.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    bg.gain.setValueAtTime(0.65, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    boom.connect(bg); bg.connect(this.sfxBus); bg.connect(delay); boom.start(t); boom.stop(t + 1.15);
    for (let i = 0; i < 3; i++) { // crack + two rolling echoes fed into the reverb
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3800 - i * 1100, t + i * 0.16); f.frequency.exponentialRampToValueAtTime(220, t + i * 0.16 + 0.5);
      const g = c.createGain(); const v0 = 0.55 - i * 0.16; g.gain.setValueAtTime(v0, t + i * 0.16); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + (i === 0 ? 0.35 : 0.7));
      src.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(delay); src.start(t + i * 0.16, Math.random() * 0.4); src.stop(t + i * 0.16 + 0.8);
    }
    window.setTimeout(() => { try { delay.disconnect(); fb.disconnect(); wet.disconnect(); } catch { /* already gone */ } }, 2600);
    // --- recorded Tesla-coil loop for as long as the trigger is held (soft synth hum is only a fallback)
    const arcBuf = this.sampleBuffers.get('arcLoop');
    if (arcBuf) {
      const src = c.createBufferSource(); src.buffer = arcBuf; src.loop = true;
      const ag = c.createGain(); ag.gain.value = 0.0001; ag.gain.exponentialRampToValueAtTime(0.22, t + 0.18);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      src.connect(lp); lp.connect(ag); ag.connect(this.sfxBus); src.start(t + 0.03); this.arcSource = src;
      this.playSample('arcSpark', 0.55, 0, 1.05);
    }
    const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(arcBuf ? 0.018 : 0.05, t + 0.25);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 58;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 116.5;
    const g2 = c.createGain(); g2.gain.value = 0.35;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(this.sfxBus); o.start(); o2.start();
    this.arcNodes = { osc: o, osc2: o2, g };
  }
  arcStop() {
    const c = this.ctx; if (!c || !this.arcNodes) return;
    const { osc, osc2, g } = this.arcNodes; this.arcNodes = null;
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    if (this.arcSource) { try { this.arcSource.stop(c.currentTime + 0.05); } catch { /* already stopped */ } this.arcSource = null; }
    osc.stop(c.currentTime + 0.2); osc2.stop(c.currentTime + 0.2);
  }

  // ------------------------------------------------------------ music
  startMusic(m: MusicDef, seed = 1) {
    if (!this.ctx) return;
    this.stopMusic();
    this.music = m; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    let s = seed * 9301 + 49297;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    this.pat = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 0 : Math.floor(r() * m.scale.length)));
    this.arp = Array.from({ length: 16 }, () => Math.floor(r() * m.scale.length));
    this.musicTimer = window.setInterval(() => this.schedule(), 40);
  }
  stopMusic() { if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; } this.music = null; }
  private schedule() {
    const c = this.ctx, m = this.music; if (!c || !m) return;
    const stepDur = 60 / (m.bpm * (0.9 + this.intensity * 0.2)) / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, m); this.step = (this.step + 1) % 64; this.nextTime += stepDur;
    }
  }
  private playStep(step: number, t: number, m: MusicDef) {
    const c = this.ctx!; const s = step % 16; const inten = this.intensity;
    const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
    const mk = (f: number, dur: number, type: OscType, vol: number, cut: number) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(120, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.02);
    };
    const bar = Math.floor(step / 16); const trans = [0, 0, 3, 5][bar % 4] * (m.scale.length > 5 ? 0 : 1);
    if (s % 4 === 0) { const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.16); }
    if (s % 2 === 1 && inten > 0.2) { const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); n.connect(f); f.connect(g); g.connect(this.musicBus); n.start(t); n.stop(t + 0.05); }
    if (s === 4 || s === 12) { const n = c.createBufferSource(); n.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); n.connect(f); f.connect(g); g.connect(this.musicBus); n.start(t); n.stop(t + 0.12); }
    if (s % 2 === 0 || (inten > 0.6 && s % 4 === 3)) mk(hz(m.root + m.scale[this.pat[s]] + trans), 0.2, 'sawtooth', 0.45, 900 + inten * 1500);
    if (inten > 0.5 && s % 2 === 1) mk(hz(m.root + 24 + m.scale[this.arp[s]] + trans), 0.14, 'square', 0.12, 3000);
  }
}

export const audio = new AudioEngine();
