// Sons synthétisés (Web Audio) : moteurs, vent, explosions, interface,
// et musique d'ambiance générative. Aucun fichier audio externe.

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.engine = null;
    this.wind = null;
    this.musicOn = true;
  }

  unlock() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol * 0.5;
    this.music.connect(this.master);
    // réverbération pour la musique
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(3.2);
    const rv = c.createGain();
    rv.gain.value = 0.7;
    this.reverb.connect(rv).connect(this.music);
    this.noiseBuf = this.makeNoise(4);
    this.brownBuf = this.makeBrown(4);
    this.ready = true;
    this.startEngineVoice();
    this.startWindVoice();
    this.startMusic();
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ready) return;
    this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.2);
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.2);
  }

  makeNoise(sec) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  makeBrown(sec) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return b;
  }

  impulse(sec) {
    const c = this.ctx;
    const len = c.sampleRate * sec;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  loopSource(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start();
    return s;
  }

  // Grondement moteur : bruit brun filtré + crépitement
  startEngineVoice() {
    const c = this.ctx;
    const src = this.loopSource(this.brownBuf);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(lp).connect(g).connect(this.sfx);
    const crack = this.loopSource(this.noiseBuf);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.6;
    const cg = c.createGain();
    cg.gain.value = 0;
    crack.connect(bp).connect(cg).connect(this.sfx);
    const rum = c.createOscillator();
    rum.type = 'sawtooth';
    rum.frequency.value = 38;
    const rlp = c.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 90;
    const rg = c.createGain();
    rg.gain.value = 0;
    rum.connect(rlp).connect(rg).connect(this.sfx);
    rum.start();
    this.engine = { lp, g, cg, bp, rg };
  }

  // Intensité 0..1, air 0..1 (0 = vide : son étouffé), solid : crépitement
  setEngine(level, air, solid = 0, ion = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const e = this.engine;
    const a = 0.15 + 0.85 * air;
    e.g.gain.setTargetAtTime(level * 0.9 * a, t, 0.08);
    e.lp.frequency.setTargetAtTime(160 + 900 * air * level, t, 0.1);
    e.cg.gain.setTargetAtTime(level * (0.08 + solid * 0.22) * air, t, 0.08);
    e.rg.gain.setTargetAtTime(level * 0.25 * (0.3 + 0.7 * air), t, 0.1);
    void ion;
  }

  startWindVoice() {
    const c = this.ctx;
    const src = this.loopSource(this.noiseBuf);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 0.9;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.sfx);
    this.wind = { bp, g };
  }

  setWind(level, pitch = 0.5) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(Math.min(0.5, level * 0.5), t, 0.2);
    this.wind.bp.frequency.setTargetAtTime(250 + pitch * 1800, t, 0.3);
  }

  blip(freq = 880, dur = 0.08, type = 'sine', vol = 0.15, delay = 0) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseBurst(dur = 0.3, freq = 800, vol = 0.4, q = 0.8, type = 'bandpass', delay = 0) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.05);
    return f;
  }

  click() { this.blip(1500, 0.04, 'triangle', 0.06); }
  attach() { this.noiseBurst(0.12, 2600, 0.25, 2); this.blip(180, 0.12, 'square', 0.08); }
  detach() { this.noiseBurst(0.18, 900, 0.25, 1.2); }
  stage() {
    this.noiseBurst(0.35, 700, 0.6, 0.7);
    this.blip(90, 0.25, 'sine', 0.35);
  }
  explosion(size = 1) {
    if (!this.ready) return;
    const f = this.noiseBurst(1.6 + size, 1400, 0.9, 0.4, 'lowpass');
    if (f) f.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 1.2 + size);
    this.blip(55, 1.2, 'sine', 0.5);
  }
  chute() { this.noiseBurst(0.6, 500, 0.35, 0.6); }
  alarm() { this.blip(980, 0.12, 'square', 0.08); this.blip(760, 0.12, 'square', 0.08, 0.15); }
  science() { [660, 880, 1320].forEach((f, i) => this.blip(f, 0.25, 'sine', 0.09, i * 0.09)); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.5, 'triangle', 0.08, i * 0.11)); }
  countdown(last = false) { this.blip(last ? 1320 : 880, last ? 0.5 : 0.12, 'sine', 0.12); }
  thud(v = 0.5) { this.blip(70, 0.3, 'sine', v); this.noiseBurst(0.25, 300, v * 0.6, 0.7, 'lowpass'); }

  // Musique générative : nappes lentes sur une progression modale
  startMusic() {
    const c = this.ctx;
    const chords = [
      [146.83, 220.0, 277.18, 329.63],
      [130.81, 196.0, 246.94, 329.63],
      [110.0, 164.81, 246.94, 293.66],
      [123.47, 185.0, 233.08, 311.13],
    ];
    let i = 0;
    const play = () => {
      if (!this.musicOn) { setTimeout(play, 4000); return; }
      const t = c.currentTime;
      const ch = chords[i % chords.length];
      i++;
      for (const f of ch) {
        for (const det of [-4, 4]) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det;
          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(300, t);
          lp.frequency.linearRampToValueAtTime(900, t + 5);
          lp.frequency.linearRampToValueAtTime(300, t + 11);
          const g = c.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.028, t + 4);
          g.gain.linearRampToValueAtTime(0, t + 12);
          o.connect(lp).connect(g);
          g.connect(this.reverb);
          g.connect(this.music);
          o.start(t);
          o.stop(t + 12.5);
        }
      }
      // petites notes cristallines
      for (let k = 0; k < 3; k++) {
        const f = ch[Math.floor(Math.random() * ch.length)] * 4;
        const tt = t + 1 + Math.random() * 8;
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(0.02, tt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + 3);
        o.connect(g).connect(this.reverb);
        o.start(tt);
        o.stop(tt + 3.2);
      }
      setTimeout(play, 9500);
    };
    play();
  }

  ambience() { /* réservé : ambiance par écran */ }
}
