// Audio 100 % synthétisé (Web Audio) : bruitages, ambiances et musique procédurale
// dark fantasy (nappes, chœurs, cloches, tambours de guerre), avec niveaux d'intensité.
import { settings } from './settings.js';
import { clamp } from './utils.js';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Ambiances musicales par zone
export const MOODS = {
  title: { root: 45, scale: 'harmonic', tempo: 60, prog: [0, 5, 3, 4], choir: 0.7, bells: 0.6, pad: 1 },
  hub: { root: 50, scale: 'dorian', tempo: 58, prog: [0, 3, 5, 4], choir: 0.4, bells: 0.8, pad: 0.8 },
  graveyard: { root: 45, scale: 'minor', tempo: 62, prog: [0, 5, 6, 4], choir: 0.6, bells: 0.5, pad: 1 },
  forest: { root: 43, scale: 'dorian', tempo: 64, prog: [0, 6, 5, 3], choir: 0.3, bells: 0.4, pad: 1 },
  swamp: { root: 41, scale: 'phrygian', tempo: 56, prog: [0, 1, 0, 6], choir: 0.3, bells: 0.2, pad: 1 },
  catacombs: { root: 40, scale: 'locrian', tempo: 54, prog: [0, 1, 4, 3], choir: 0.8, bells: 0.3, pad: 0.9 },
  castle: { root: 47, scale: 'harmonic', tempo: 66, prog: [0, 5, 3, 4], choir: 0.9, bells: 0.7, pad: 1 },
  frost: { root: 52, scale: 'minor', tempo: 58, prog: [0, 3, 5, 6], choir: 0.5, bells: 1, pad: 0.8 },
  inferno: { root: 38, scale: 'phrygian', tempo: 70, prog: [0, 1, 3, 1], choir: 0.6, bells: 0.2, pad: 1 },
  void: { root: 44, scale: 'locrian', tempo: 60, prog: [0, 4, 1, 5], choir: 1, bells: 0.6, pad: 1 },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.intensity = 0;
    this.targetIntensity = 0;
    this.mood = MOODS.title;
    this.beat = 0;
    this.lowHp = 0;
    settings.onChange(() => this.applyVolumes());
  }

  init() {
    if (this.failed) return;
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      this._init();
    } catch (e) {
      console.warn('Audio indisponible', e);
      this.failed = true;
      this.ctx = null;
    }
  }

  _init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    // Réverbération de cathédrale (réponse impulsionnelle générée)
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.sfxSend = ctx.createGain();
    this.sfxSend.gain.value = 0.25;
    this.sfxBus.connect(this.sfxSend).connect(this.reverb);

    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.musicSend = ctx.createGain();
    this.musicSend.gain.value = 0.6;
    this.musicBus.connect(this.musicSend).connect(this.reverb);

    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);

    // Couches musicales (fondus selon l'intensité)
    this.layerExplore = ctx.createGain();
    this.layerCombat = ctx.createGain();
    this.layerBoss = ctx.createGain();
    this.layerCombat.gain.value = 0;
    this.layerBoss.gain.value = 0;
    this.layerExplore.connect(this.musicBus);
    this.layerCombat.connect(this.musicBus);
    this.layerBoss.connect(this.musicBus);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._startAmbience();
    this.applyVolumes();
    this._nextNote = ctx.currentTime + 0.2;
    this._timer = setInterval(() => this._schedule(), 90);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden && settings.get('muteBackground')) this.ctx.suspend();
      else if (!document.hidden) this.ctx.resume();
    });
  }

  _impulse(dur, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const n = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.get('master'), t, 0.05);
    this.sfxBus.gain.setTargetAtTime(settings.get('sfx'), t, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.get('music') * 0.55, t, 0.05);
    this.ambBus.gain.setTargetAtTime(settings.get('ambience') * 0.6, t, 0.05);
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- Ambiances ----------
  _startAmbience() {
    const ctx = this.ctx;
    const mk = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.ambBus);
      src.start(0, Math.random() * 1.5);
      return { f, g };
    };
    this.wind = mk('bandpass', 380, 0.6);
    this.rumble = mk('lowpass', 90, 0.8);
    this.crackle = mk('highpass', 2500, 0.5);
    this.water = mk('bandpass', 1200, 2);
    this.ambTarget = { wind: 0.25, rumble: 0.1, crackle: 0, water: 0 };
  }

  setAmbience(a) {
    this.ambTarget = Object.assign({ wind: 0.2, rumble: 0.1, crackle: 0, water: 0 }, a);
  }

  // ---------- Musique procédurale ----------
  setMood(name) {
    this.mood = MOODS[name] || MOODS.graveyard;
  }
  setIntensity(level) {
    this.targetIntensity = level;
  }

  _scaleNote(deg, octave = 0) {
    const sc = SCALES[this.mood.scale];
    const n = sc.length;
    const o = Math.floor(deg / n);
    const i = ((deg % n) + n) % n;
    return this.mood.root + sc[i] + 12 * (o + octave);
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Fondus des couches
    const it = this.targetIntensity;
    this.layerExplore.gain.setTargetAtTime(it >= 2 ? 0.35 : it === 1 ? 0.7 : 1, now, 1.2);
    this.layerCombat.gain.setTargetAtTime(it >= 1 ? 1 : 0, now, it >= 1 ? 0.4 : 2);
    this.layerBoss.gain.setTargetAtTime(it >= 2 ? 1 : 0, now, it >= 2 ? 0.3 : 2);
    // Ambiance
    const a = this.ambTarget;
    const wob = 0.6 + 0.4 * Math.sin(now * 0.23) * Math.sin(now * 0.071);
    this.wind.g.gain.setTargetAtTime(a.wind * wob, now, 0.8);
    this.wind.f.frequency.setTargetAtTime(280 + 240 * wob, now, 0.8);
    this.rumble.g.gain.setTargetAtTime(a.rumble, now, 1);
    this.crackle.g.gain.setTargetAtTime(a.crackle * (Math.random() < 0.3 ? 1.6 : 0.4), now, 0.03);
    this.water.g.gain.setTargetAtTime(a.water * (0.5 + Math.random() * 0.5), now, 0.2);

    const spb = 60 / (this.mood.tempo * (it >= 2 ? 2 : it === 1 ? 1.6 : 1));
    while (this._nextNote < now + 0.25) {
      this._playBeat(this._nextNote, this.beat, spb);
      this._nextNote += spb / 2;
      this.beat++;
    }
  }

  _playBeat(t, b, spb) {
    const m = this.mood;
    const barLen = 16; // croches
    const chordIdx = Math.floor(b / (barLen * 2)) % m.prog.length;
    const deg = m.prog[chordIdx];
    const inBar = b % (barLen * 2);
    // Nappe : nouvel accord toutes les 2 mesures
    if (inBar === 0) {
      const dur = spb * barLen;
      const notes = [this._scaleNote(deg, -1), this._scaleNote(deg + 2, -1), this._scaleNote(deg + 4, -1), this._scaleNote(deg, -2)];
      for (const n of notes) this._pad(t, mtof(n), dur * 1.05, 0.05 * m.pad);
      if (Math.random() < m.choir) this._choir(t + spb, mtof(this._scaleNote(deg + 4, 0)), dur * 0.9, 0.05);
    }
    // Cloches clairsemées
    if (b % 4 === 0 && Math.random() < 0.13 * m.bells) {
      const n = this._scaleNote(deg + [0, 2, 4, 7][Math.floor(Math.random() * 4)], 1);
      this._bell(t, mtof(n), 0.05, this.layerExplore);
    }
    // Couche combat : ostinato de cordes + tambours
    if (this.targetIntensity >= 1 || this.layerCombat.gain.value > 0.02) {
      const pat = [0, 0, 7, 0, 3, 0, 7, 5];
      const n = this._scaleNote(deg, -1) + (pat[b % 8] === 7 ? 7 : pat[b % 8] === 5 ? 5 : pat[b % 8] === 3 ? 3 : 0);
      this._pluck(t, mtof(n), spb * 0.45, 0.06, this.layerCombat);
      if (b % 4 === 0) this._drum(t, 70, 0.4, this.layerCombat);
      if (b % 8 === 6) this._drum(t, 110, 0.18, this.layerCombat);
    }
    // Couche boss : cuivres, chœur martelé, grosse caisse
    if (this.targetIntensity >= 2 || this.layerBoss.gain.value > 0.02) {
      if (b % 2 === 0) this._drum(t, 55, 0.45, this.layerBoss);
      if (b % 8 === 4) this._drum(t, 180, 0.25, this.layerBoss, true);
      if (inBar % 8 === 0) this._brass(t, mtof(this._scaleNote(deg, -1)), spb * 3.5, 0.06);
      if (inBar % 16 === 12) this._brass(t, mtof(this._scaleNote(deg + 1, -1)), spb * 2, 0.05);
      if (inBar === 0) this._choir(t, mtof(this._scaleNote(deg + 2, 0)), spb * 6, 0.07, this.layerBoss);
    }
  }

  _env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _pad(t, f, dur, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(400, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(this.layerExplore);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  _choir(t, f, dur, vol, dest) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest || this.layerExplore);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 750;
    f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1150;
    f2.Q.value = 6;
    f1.connect(g);
    f2.connect(g);
    for (const [mul, det] of [[1, -9], [1, 8], [2, 3]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * mul;
      o.detune.value = det;
      const vib = ctx.createOscillator();
      vib.frequency.value = 5 + Math.random();
      const vg = ctx.createGain();
      vg.gain.value = 6;
      vib.connect(vg).connect(o.detune);
      o.connect(f1);
      o.connect(f2);
      o.start(t);
      vib.start(t);
      o.stop(t + dur + 0.1);
      vib.stop(t + dur + 0.1);
    }
  }

  _bell(t, f, vol, dest) {
    const ctx = this.ctx;
    for (const [mul, v, d] of [[1, 1, 3], [2.76, 0.5, 1.6], [5.4, 0.25, 0.8], [0.5, 0.4, 3.5]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      this._env(g, t, 0.004, vol * v, d);
      o.connect(g).connect(dest || this.layerExplore);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }

  _pluck(t, f, dur, vol, dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = ctx.createGain();
    this._env(g, t, 0.005, vol, dur);
    o.connect(lp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _brass(t, f, dur, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(1600, t + 0.12);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    lp.connect(g).connect(this.layerBoss);
    for (const [mul, det] of [[1, 0], [1, 10], [0.5, -5]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * mul;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  _drum(t, f, vol, dest, snare = false) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    const g = ctx.createGain();
    this._env(g, t, 0.003, vol, 0.45);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.5);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = snare ? 'highpass' : 'lowpass';
    nf.frequency.value = snare ? 1500 : 400;
    const ng = ctx.createGain();
    this._env(ng, t, 0.002, vol * (snare ? 0.6 : 0.35), snare ? 0.2 : 0.12);
    src.connect(nf).connect(ng).connect(dest);
    src.start(t, Math.random());
    src.stop(t + 0.3);
  }

  // ---------- Bruitages ----------
  setListener(x, z, yaw) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  // Sortie spatialisée (volume selon la distance + panoramique)
  _out(pos, maxDist = 45) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    if (!pos) {
      g.connect(this.sfxBus);
      return g;
    }
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const d = Math.hypot(dx, dz);
    const att = clamp(1 - d / maxDist, 0, 1);
    g.gain.value = att * att;
    if (att <= 0) return null;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const ang = Math.atan2(dx, dz) - this.listener.yaw;
      p.pan.value = clamp(-Math.sin(ang) * 0.8, -1, 1);
      g.connect(p).connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  }

  _noise({ t = this.t, dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.5, sweepTo = null, attack = 0.005, out }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this._env(g, t, attack, gain, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone({ t = this.t, type = 'sine', freq = 440, to = null, dur = 0.2, gain = 0.3, attack = 0.005, out }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    this._env(g, t, attack, gain, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const out = this._out(opts.pos, opts.range || 45);
    if (!out) return;
    const fn = this.sfx[name];
    if (fn) fn.call(this, out, opts);
  }

  sfx = {
    swing(out, o) {
      const w = o.weight || 1;
      this._noise({ dur: 0.18 + w * 0.08, freq: 2400 / w, sweepTo: 500 / w, q: 1.5, gain: 0.25, attack: 0.03, out });
    },
    hit(out, o) {
      const k = o.kind || 'flesh';
      if (k === 'metal') {
        this._tone({ type: 'square', freq: 1800 + Math.random() * 600, to: 900, dur: 0.12, gain: 0.08, out });
        this._tone({ type: 'sine', freq: 3200, dur: 0.4, gain: 0.05, out });
        this._noise({ dur: 0.12, freq: 3000, q: 0.8, gain: 0.35, out });
      } else if (k === 'bone') {
        this._noise({ dur: 0.1, freq: 1800, q: 3, gain: 0.5, out });
        this._tone({ type: 'triangle', freq: 400, to: 180, dur: 0.1, gain: 0.25, out });
      } else if (k === 'spirit') {
        this._tone({ type: 'sine', freq: 900, to: 200, dur: 0.35, gain: 0.2, out });
        this._noise({ dur: 0.3, freq: 600, q: 4, gain: 0.25, sweepTo: 2000, out });
      } else {
        this._noise({ dur: 0.14, freq: 700, q: 0.7, gain: 0.6, out });
        this._tone({ type: 'sine', freq: 160, to: 60, dur: 0.18, gain: 0.5, out });
      }
      if (o.crit) this._tone({ type: 'sawtooth', freq: 220, to: 55, dur: 0.35, gain: 0.25, out });
    },
    block(out) {
      this._tone({ type: 'square', freq: 700, to: 500, dur: 0.1, gain: 0.1, out });
      this._noise({ dur: 0.18, freq: 2200, q: 1.2, gain: 0.4, out });
      this._tone({ type: 'sine', freq: 2100, dur: 0.5, gain: 0.05, out });
    },
    parry(out) {
      this._tone({ type: 'sine', freq: 2600, dur: 0.9, gain: 0.12, out });
      this._tone({ type: 'sine', freq: 3900, dur: 0.6, gain: 0.08, out });
      this._noise({ dur: 0.1, freq: 5000, q: 1, gain: 0.5, out });
      this._tone({ type: 'sawtooth', freq: 120, to: 60, dur: 0.3, gain: 0.2, out });
    },
    step(out, o) {
      this._noise({ dur: 0.06, freq: o.surface === 'stone' ? 1400 : 500, q: 1, gain: 0.06 + (o.heavy ? 0.06 : 0), out });
    },
    roll(out) {
      this._noise({ dur: 0.35, freq: 500, sweepTo: 200, q: 0.8, gain: 0.2, attack: 0.05, out });
      this._tone({ type: 'sine', freq: 120, dur: 0.1, gain: 0.08, out });
    },
    jump(out) {
      this._noise({ dur: 0.15, freq: 800, sweepTo: 1600, q: 1, gain: 0.08, out });
    },
    land(out, o) {
      this._tone({ type: 'sine', freq: 110, to: 45, dur: 0.18, gain: 0.3 * (o.heavy ? 2 : 1), out });
      this._noise({ dur: 0.12, freq: 400, q: 0.7, gain: 0.2, out });
    },
    drink(out) {
      for (let i = 0; i < 3; i++) this._tone({ t: this.t + i * 0.18, type: 'sine', freq: 500 + i * 60, to: 300, dur: 0.12, gain: 0.08, out });
      this._tone({ t: this.t + 0.6, type: 'sine', freq: 660, dur: 0.8, gain: 0.08, out });
      this._tone({ t: this.t + 0.6, type: 'sine', freq: 990, dur: 0.8, gain: 0.05, out });
    },
    cast(out, o) {
      const e = o.element || 'arcane';
      if (e === 'fire') {
        this._noise({ dur: 0.6, freq: 300, sweepTo: 1800, q: 0.6, gain: 0.45, attack: 0.05, out });
        this._tone({ type: 'sawtooth', freq: 90, to: 180, dur: 0.5, gain: 0.12, out });
      } else if (e === 'frost') {
        for (let i = 0; i < 4; i++) this._tone({ t: this.t + i * 0.05, type: 'sine', freq: 2000 + Math.random() * 2000, dur: 0.5, gain: 0.05, out });
        this._noise({ dur: 0.5, freq: 6000, q: 2, gain: 0.2, out });
      } else if (e === 'lightning') {
        this._noise({ dur: 0.5, freq: 3000, q: 0.3, gain: 0.7, attack: 0.001, out });
        this._tone({ type: 'sawtooth', freq: 60, to: 30, dur: 0.6, gain: 0.3, out });
      } else if (e === 'holy') {
        for (const f of [523, 659, 784, 1046]) this._tone({ type: 'sine', freq: f, dur: 1.2, gain: 0.06, attack: 0.08, out });
      } else if (e === 'shadow') {
        this._tone({ type: 'sawtooth', freq: 200, to: 50, dur: 0.7, gain: 0.18, out });
        this._noise({ dur: 0.7, freq: 400, sweepTo: 100, q: 3, gain: 0.3, out });
      } else if (e === 'poison') {
        this._noise({ dur: 0.5, freq: 900, q: 6, gain: 0.3, sweepTo: 300, out });
      } else {
        this._tone({ type: 'triangle', freq: 400, to: 1200, dur: 0.4, gain: 0.15, out });
        this._noise({ dur: 0.4, freq: 1500, q: 4, gain: 0.2, out });
      }
    },
    explosion(out, o) {
      const big = o.big ? 1.6 : 1;
      this._noise({ dur: 0.8 * big, freq: 800, sweepTo: 80, type: 'lowpass', q: 0.5, gain: 0.8, out });
      this._tone({ type: 'sine', freq: 90, to: 30, dur: 0.7 * big, gain: 0.6, out });
    },
    shoot(out, o) {
      if (o.kind === 'arrow') this._noise({ dur: 0.15, freq: 3000, sweepTo: 1200, q: 2, gain: 0.2, out });
      else this._noise({ dur: 0.3, freq: 700, sweepTo: 1500, q: 2, gain: 0.25, out });
    },
    growl(out, o) {
      const p = o.pitch || 1;
      const ctx = this.ctx;
      const oo = ctx.createOscillator();
      oo.type = 'sawtooth';
      oo.frequency.setValueAtTime(110 * p, this.t);
      oo.frequency.linearRampToValueAtTime(80 * p, this.t + 0.5);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 500 * p;
      f.Q.value = 3;
      const g = ctx.createGain();
      this._env(g, this.t, 0.05, 0.18, 0.6);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 25;
      const lg = ctx.createGain();
      lg.gain.value = 20;
      lfo.connect(lg).connect(oo.frequency);
      oo.connect(f).connect(g).connect(out);
      oo.start();
      lfo.start();
      oo.stop(this.t + 0.7);
      lfo.stop(this.t + 0.7);
    },
    screech(out, o) {
      const p = o.pitch || 1;
      this._tone({ type: 'sawtooth', freq: 1200 * p, to: 700 * p, dur: 0.5, gain: 0.08, out });
      this._noise({ dur: 0.5, freq: 2500 * p, q: 5, gain: 0.2, out });
    },
    roar(out) {
      const ctx = this.ctx;
      for (const [f, d] of [[60, 1.6], [90, 1.4], [45, 1.8]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 1.4, this.t);
        o.frequency.exponentialRampToValueAtTime(f, this.t + d);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g = ctx.createGain();
        this._env(g, this.t, 0.15, 0.2, d);
        o.connect(lp).connect(g).connect(out);
        o.start();
        o.stop(this.t + d + 0.1);
      }
      this._noise({ dur: 1.5, freq: 600, q: 1, gain: 0.35, attack: 0.1, out });
    },
    enemyDie(out, o) {
      if (o.kind === 'spirit') this._tone({ type: 'sine', freq: 1200, to: 100, dur: 1, gain: 0.15, out });
      else {
        this._tone({ type: 'sawtooth', freq: 180, to: 50, dur: 0.6, gain: 0.12, out });
        this._noise({ dur: 0.5, freq: 400, q: 1, gain: 0.25, out });
      }
    },
    playerHurt(out) {
      this._tone({ type: 'sawtooth', freq: 220, to: 110, dur: 0.25, gain: 0.15, out });
      this._noise({ dur: 0.2, freq: 900, q: 1, gain: 0.35, out });
    },
    death(out) {
      for (let i = 0; i < 4; i++) this._tone({ t: this.t + i * 0.35, type: 'sine', freq: 330 / (1 + i * 0.25), dur: 1.4, gain: 0.12, out });
      this._tone({ type: 'sawtooth', freq: 55, to: 30, dur: 3, gain: 0.2, out });
    },
    levelUp(out) {
      [0, 4, 7, 12, 16].forEach((s, i) => this._tone({ t: this.t + i * 0.09, type: 'triangle', freq: mtof(62 + s), dur: 0.9, gain: 0.1, out }));
      this._tone({ t: this.t + 0.45, type: 'sine', freq: mtof(86), dur: 1.5, gain: 0.06, out });
    },
    pickup(out) {
      this._tone({ type: 'sine', freq: 880, dur: 0.15, gain: 0.1, out });
      this._tone({ t: this.t + 0.07, type: 'sine', freq: 1320, dur: 0.25, gain: 0.08, out });
    },
    shards(out) {
      for (let i = 0; i < 3; i++) this._tone({ t: this.t + i * 0.04, type: 'sine', freq: 1800 + i * 400, dur: 0.2, gain: 0.04, out });
    },
    uiHover(out) {
      this._tone({ type: 'sine', freq: 1400, dur: 0.05, gain: 0.03, out });
    },
    uiClick(out) {
      this._tone({ type: 'triangle', freq: 660, to: 990, dur: 0.08, gain: 0.08, out });
      this._noise({ dur: 0.05, freq: 3000, q: 2, gain: 0.08, out });
    },
    uiBack(out) {
      this._tone({ type: 'triangle', freq: 660, to: 330, dur: 0.1, gain: 0.08, out });
    },
    uiError(out) {
      this._tone({ type: 'square', freq: 160, dur: 0.15, gain: 0.06, out });
    },
    buy(out) {
      this._tone({ type: 'sine', freq: 1200, dur: 0.1, gain: 0.08, out });
      this._tone({ t: this.t + 0.08, type: 'sine', freq: 1600, dur: 0.3, gain: 0.08, out });
      this._noise({ dur: 0.2, freq: 5000, q: 2, gain: 0.1, out });
    },
    forge(out) {
      for (let i = 0; i < 3; i++) {
        this._tone({ t: this.t + i * 0.25, type: 'square', freq: 1500, to: 800, dur: 0.15, gain: 0.08, out });
        this._noise({ t: this.t + i * 0.25, dur: 0.1, freq: 3500, q: 1, gain: 0.3, out });
      }
    },
    altar(out) {
      this._noise({ dur: 1.2, freq: 300, sweepTo: 1200, q: 0.5, gain: 0.3, attack: 0.3, out });
      [0, 7, 12].forEach((s, i) => this._tone({ t: this.t + i * 0.15, type: 'sine', freq: mtof(57 + s), dur: 2, gain: 0.08, attack: 0.2, out }));
    },
    portal(out) {
      this._tone({ type: 'sawtooth', freq: 80, to: 600, dur: 1.2, gain: 0.1, out });
      this._noise({ dur: 1.4, freq: 400, sweepTo: 4000, q: 3, gain: 0.3, out });
    },
    quest(out) {
      [0, 5, 7, 12].forEach((s, i) => this._tone({ t: this.t + i * 0.12, type: 'sine', freq: mtof(64 + s), dur: 1, gain: 0.09, out }));
    },
    victory(out) {
      [0, 3, 7, 12, 15, 19].forEach((s, i) => this._tone({ t: this.t + i * 0.16, type: 'sawtooth', freq: mtof(50 + s), dur: 2.5, gain: 0.05, attack: 0.05, out }));
      this._drum(this.t, 55, 0.6, out);
      this._drum(this.t + 0.8, 55, 0.6, out);
    },
    fogwall(out) {
      this._noise({ dur: 1, freq: 200, sweepTo: 800, q: 2, gain: 0.3, attack: 0.2, out });
    },
    chest(out) {
      this._tone({ type: 'triangle', freq: 200, to: 120, dur: 0.3, gain: 0.15, out });
      [0, 4, 7, 11].forEach((s, i) => this._tone({ t: this.t + 0.3 + i * 0.07, type: 'sine', freq: mtof(72 + s), dur: 0.8, gain: 0.07, out }));
    },
    heartbeat(out) {
      this._tone({ type: 'sine', freq: 60, to: 40, dur: 0.15, gain: 0.35, out });
      this._tone({ t: this.t + 0.2, type: 'sine', freq: 55, to: 38, dur: 0.15, gain: 0.25, out });
    },
    stun(out) {
      for (let i = 0; i < 5; i++) this._tone({ t: this.t + i * 0.06, type: 'sine', freq: 1500 + (i % 2) * 400, dur: 0.1, gain: 0.05, out });
    },
  };
}

export const audio = new AudioSys();
