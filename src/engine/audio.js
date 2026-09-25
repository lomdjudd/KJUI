// Sons 100 % synthétisés avec la Web Audio API (aucun fichier externe).

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.35;
    this.intensity = 0;
  }

  init() {
    try {
      this._init();
    } catch (e) {
      console.warn('Audio indisponible', e);
      this.ctx = null;
      this.failed = true;
    }
  }

  _init() {
    if (this.failed) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVolume;
    this.sfx.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? this.musicVolume : 0;
    this.musicGain.connect(this.master);

    // Bruit blanc réutilisable
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Vent (vitesse)
    this.wind = ctx.createBufferSource();
    this.wind.buffer = this.noise;
    this.wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.wind.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    this.wind.start();

    // Ambiance ville
    this.city = ctx.createBufferSource();
    this.city.buffer = this.noise;
    this.city.loop = true;
    const cf = ctx.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 300;
    this.cityGain = ctx.createGain();
    this.cityGain.gain.value = 0.05;
    this.city.connect(cf).connect(this.cityGain).connect(this.sfx);
    this.city.start();

    this._startMusic();
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _noiseBurst({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', gain = 0.5, sweepTo = null, attack = 0.005, dest = null }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, this.t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, this.t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.exponentialRampToValueAtTime(gain, this.t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + dur);
    src.connect(f).connect(g).connect(dest || this.sfx);
    src.start(this.t, Math.random() * Math.max(0, 1.9 - dur));
    src.stop(this.t + dur + 0.05);
  }

  _tone({ freq = 440, to = null, dur = 0.2, type = 'sine', gain = 0.3, attack = 0.005, delay = 0, dest = null }) {
    const ctx = this.ctx;
    const t0 = this.t + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  play(name, vol = 1) {
    if (!this.ctx) return;
    try {
      this._play(name, vol);
    } catch {
      /* son ignoré */
    }
  }

  _play(name, vol) {
    const v = vol;
    switch (name) {
      case 'thwip':
        this._noiseBurst({ dur: 0.18, freq: 5000, sweepTo: 1200, q: 2, gain: 0.35 * v });
        this._tone({ freq: 1800, to: 600, dur: 0.12, type: 'triangle', gain: 0.05 * v });
        break;
      case 'webshot':
        this._noiseBurst({ dur: 0.12, freq: 4000, sweepTo: 2000, q: 3, gain: 0.25 * v });
        break;
      case 'punch':
        this._tone({ freq: 160, to: 50, dur: 0.14, type: 'sine', gain: 0.7 * v });
        this._noiseBurst({ dur: 0.08, freq: 1800, q: 0.8, gain: 0.45 * v });
        break;
      case 'kick':
        this._tone({ freq: 120, to: 40, dur: 0.18, type: 'sine', gain: 0.8 * v });
        this._noiseBurst({ dur: 0.1, freq: 1200, q: 0.8, gain: 0.5 * v });
        break;
      case 'heavy':
        this._tone({ freq: 90, to: 30, dur: 0.35, type: 'sine', gain: 0.9 * v });
        this._noiseBurst({ dur: 0.25, freq: 600, q: 0.5, gain: 0.6 * v });
        break;
      case 'whoosh':
        this._noiseBurst({ dur: 0.22, freq: 800, sweepTo: 2500, q: 1.2, gain: 0.18 * v, attack: 0.05 });
        break;
      case 'block':
        this._tone({ freq: 800, to: 500, dur: 0.1, type: 'square', gain: 0.1 * v });
        this._noiseBurst({ dur: 0.06, freq: 3000, q: 2, gain: 0.3 * v });
        break;
      case 'gun':
        this._noiseBurst({ dur: 0.25, freq: 2500, sweepTo: 300, q: 0.6, gain: 0.6 * v });
        this._tone({ freq: 200, to: 60, dur: 0.12, type: 'square', gain: 0.2 * v });
        break;
      case 'explosion':
        this._noiseBurst({ dur: 1.2, freq: 500, sweepTo: 60, q: 0.4, type: 'lowpass', gain: 0.9 * v, attack: 0.01 });
        this._tone({ freq: 70, to: 25, dur: 0.8, type: 'sine', gain: 0.8 * v });
        break;
      case 'sense':
        for (let i = 0; i < 3; i++) this._tone({ freq: 2400 + i * 400, dur: 0.15, type: 'sine', gain: 0.07 * v, delay: i * 0.04 });
        break;
      case 'hurt':
        this._tone({ freq: 220, to: 110, dur: 0.2, type: 'sawtooth', gain: 0.12 * v });
        this._noiseBurst({ dur: 0.12, freq: 900, q: 1, gain: 0.4 * v });
        break;
      case 'land':
        this._noiseBurst({ dur: 0.15, freq: 300, q: 0.7, type: 'lowpass', gain: 0.5 * v });
        break;
      case 'zap':
        this._tone({ freq: 900, to: 120, dur: 0.3, type: 'sawtooth', gain: 0.2 * v });
        this._noiseBurst({ dur: 0.3, freq: 3500, q: 4, gain: 0.3 * v });
        break;
      case 'ui':
        this._tone({ freq: 880, dur: 0.08, type: 'triangle', gain: 0.15 * v });
        break;
      case 'coin':
        this._tone({ freq: 988, dur: 0.1, type: 'square', gain: 0.08 * v });
        this._tone({ freq: 1319, dur: 0.25, type: 'square', gain: 0.08 * v, delay: 0.08 });
        break;
      case 'checkpoint':
        this._tone({ freq: 660, dur: 0.12, type: 'triangle', gain: 0.2 * v });
        this._tone({ freq: 990, dur: 0.2, type: 'triangle', gain: 0.2 * v, delay: 0.07 });
        break;
      case 'level':
        [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, dur: 0.35, type: 'triangle', gain: 0.18 * v, delay: i * 0.1 }));
        break;
      case 'mission':
        [392, 523, 659, 784, 659, 784].forEach((f, i) =>
          this._tone({ freq: f, dur: i === 5 ? 0.7 : 0.18, type: 'sawtooth', gain: 0.08 * v, delay: i * 0.13 }),
        );
        break;
      case 'fail':
        [392, 330, 262].forEach((f, i) => this._tone({ freq: f, dur: 0.4, type: 'triangle', gain: 0.18 * v, delay: i * 0.22 }));
        break;
      case 'laugh':
        for (let i = 0; i < 6; i++)
          this._tone({ freq: 380 - i * 20, to: 300 - i * 20, dur: 0.12, type: 'sawtooth', gain: 0.12 * v, delay: i * 0.13 });
        break;
      case 'slowmo':
        this._tone({ freq: 400, to: 120, dur: 0.6, type: 'sine', gain: 0.25 * v });
        break;
      case 'finisher':
        this._tone({ freq: 60, to: 30, dur: 0.6, type: 'sine', gain: 1 * v });
        this._noiseBurst({ dur: 0.5, freq: 900, sweepTo: 200, q: 0.5, gain: 0.7 * v });
        break;
      case 'heal':
        [523, 784, 1047].forEach((f, i) => this._tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.15 * v, delay: i * 0.06 }));
        break;
      case 'car':
        this._tone({ freq: 70, to: 90, dur: 0.6, type: 'sawtooth', gain: 0.06 * v });
        break;
      case 'horn':
        this._tone({ freq: 415, dur: 0.35, type: 'square', gain: 0.06 * v });
        this._tone({ freq: 523, dur: 0.35, type: 'square', gain: 0.05 * v });
        break;
    }
  }

  setWind(speed) {
    if (!this.ctx || !this.windGain) return;
    const s = Math.min(1, Math.max(0, (speed - 8) / 45));
    this.windGain.gain.setTargetAtTime(s * 0.35, this.t, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + s * 1400, this.t, 0.1);
  }

  setIntensity(x) {
    this.intensity = x;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicOn ? this.musicVolume : 0, this.t, 0.3);
    return this.musicOn;
  }

  // Petite musique héroïque procédurale (La mineur, progression Am - F - C - G).
  _startMusic() {
    const ctx = this.ctx;
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ];
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const bpm = 104;
    const step = 60 / bpm / 2; // croches
    let next = ctx.currentTime + 0.2;
    let i = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1800;
    filt.connect(this.musicGain);
    const schedule = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 0.4) {
        const bar = Math.floor(i / 8) % chords.length;
        const ch = chords[bar];
        const s = i % 8;
        const combat = this.intensity > 0.5;
        // Basse
        if (s % 2 === 0) this._note(midi(ch[0] - 12), next, step * 1.8, 'sawtooth', combat ? 0.1 : 0.07, filt);
        // Arpège
        const arp = [0, 1, 2, 1, 2, 0, 1, 2][s];
        this._note(midi(ch[arp] + 12), next, step * 0.9, 'triangle', 0.045, filt);
        // Nappe au début de chaque mesure
        if (s === 0) ch.forEach((n) => this._note(midi(n), next, step * 8, 'sawtooth', 0.018, filt, 0.3));
        // Percussions en combat
        if (combat) {
          if (s % 4 === 0) this._kick(next);
          if (s % 4 === 2) this._snare(next);
          this._hat(next);
        }
        next += step;
        i++;
      }
      setTimeout(schedule, 100);
    };
    schedule();
  }

  _note(freq, t, dur, type, gain, dest, attack = 0.01) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.25);
  }

  _snare(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  _hat(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random());
    src.stop(t + 0.08);
  }
}
