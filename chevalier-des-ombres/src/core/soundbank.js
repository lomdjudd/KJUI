// Banque de sons générée à l'installation des données : instruments (chœurs, cordes,
// orgue, harpe, luth, boîte à musique, cloches, cuivres, percussions) et bruitages avec
// variantes. Le rendu se fait hors temps réel (OfflineAudioContext + DSP en JavaScript),
// puis les échantillons sont conservés (entiers 16 bits) et rejoués par le moteur audio.

const TAU = Math.PI * 2;
export const BANK_VERSION = 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------
// Outils DSP
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// Filtre biquad (formules RBJ) appliqué sur place
class Biquad {
  constructor(type, freq, q, rate, gainDb = 0) {
    this.set(type, freq, q, rate, gainDb);
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, freq, q, rate, gainDb = 0) {
    const w = (TAU * Math.min(freq, rate * 0.45)) / rate;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const al = sn / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
    } else if (type === 'highpass') {
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
    } else if (type === 'bandpass') {
      b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
    } else {
      // peaking
      b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Supprime la composante continue (évite les « clics » graves à l'attaque)
function dcBlock(a, rate) {
  const R = Math.exp((-TAU * 25) / rate);
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < a.length; i++) {
    const y = a[i] - x1 + R * y1;
    x1 = a[i];
    y1 = y;
    a[i] = y;
  }
  return a;
}

function normalize(a, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < a.length; i++) a[i] *= k;
  }
  return a;
}

function fadeEdges(a, rate, fin = 0.002, fout = 0.05) {
  const ni = Math.floor(fin * rate);
  const no = Math.floor(fout * rate);
  for (let i = 0; i < ni && i < a.length; i++) a[i] *= i / ni;
  for (let i = 0; i < no && i < a.length; i++) a[a.length - 1 - i] *= i / no;
  return a;
}

function toInt16(a) {
  const out = new Int16Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Math.max(-32767, Math.min(32767, Math.round(a[i] * 32767)));
  return out;
}

// Karplus-Strong (corde pincée), retard fractionnaire
function pluck(freq, rate, dur, { bright = 0.5, decay = 0.996, strings = 1, detune = 0.0015, seed = 7, body = null } = {}) {
  const n = Math.floor(rate * dur);
  const out = new Float32Array(n);
  const r = rng(seed);
  for (let sI = 0; sI < strings; sI++) {
    const f = freq * (1 + (sI - (strings - 1) / 2) * detune);
    const period = rate / f;
    const len = Math.ceil(period) + 2;
    const buf = new Float32Array(len);
    // Excitation : bruit filtré selon la brillance
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp += (r() - lp) * (0.2 + bright * 0.8);
      buf[i] = lp;
    }
    let idx = 0;
    const frac = period - Math.floor(period);
    const d = Math.floor(period);
    let prev = 0;
    const damp = 0.5 - (1 - bright) * 0.25;
    for (let i = 0; i < n; i++) {
      const a = buf[(idx + len - d) % len];
      const b = buf[(idx + len - d - 1) % len];
      const x = a + (b - a) * frac;
      const y = (x * (1 - damp) + prev * damp) * decay;
      prev = x;
      buf[idx] = y;
      idx = (idx + 1) % len;
      out[i] += y / strings;
    }
  }
  if (body) for (const bq of body) for (let i = 0; i < n; i++) out[i] = out[i] * 0.7 + bq.p(out[i]) * 0.6;
  return out;
}

// Somme de partiels sinusoïdaux à décroissance exponentielle (cloches, boîtes à musique)
function partials(rate, dur, list, { attack = 0.002, tremolo = 0 } = {}) {
  const n = Math.floor(rate * dur);
  const out = new Float32Array(n);
  for (const [f, amp, decay, phase = 0] of list) {
    const w = (TAU * f) / rate;
    const k = Math.exp(-1 / (decay * rate));
    let e = amp;
    for (let i = 0; i < n; i++) {
      out[i] += Math.sin(w * i + phase) * e;
      e *= k;
    }
  }
  const na = Math.floor(attack * rate);
  for (let i = 0; i < na; i++) out[i] *= i / na;
  if (tremolo) for (let i = 0; i < n; i++) out[i] *= 1 + Math.sin((TAU * 5.5 * i) / rate) * tremolo;
  return out;
}

function noise(n, seed = 3) {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r();
  return out;
}

// Bruit filtré avec enveloppe et balayage de fréquence
function sweepNoise(rate, dur, { type = 'bandpass', f0 = 1000, f1 = null, q = 1, attack = 0.005, curve = 3, seed = 5 } = {}) {
  const n = Math.floor(rate * dur);
  const src = noise(n, seed);
  const out = new Float32Array(n);
  const bq = new Biquad(type, f0, q, rate);
  for (let i = 0; i < n; i++) {
    if (f1 && i % 32 === 0) bq.set(type, f0 * Math.pow(f1 / f0, i / n), q, rate);
    const t = i / n;
    const env = Math.min(1, i / (attack * rate + 1)) * Math.pow(1 - t, curve);
    out[i] = bq.p(src[i]) * env;
  }
  return out;
}

function tone(rate, dur, { f0 = 440, f1 = null, type = 'sine', attack = 0.003, curve = 2, amp = 1 } = {}) {
  const n = Math.floor(rate * dur);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f1 ? f0 * Math.pow(f1 / f0, t) : f0;
    ph += (TAU * f) / rate;
    let v = Math.sin(ph);
    if (type === 'tri') v = (2 / Math.PI) * Math.asin(Math.sin(ph));
    else if (type === 'saw') v = ((ph / TAU) % 1) * 2 - 1;
    else if (type === 'square') v = Math.sin(ph) > 0 ? 0.7 : -0.7;
    out[i] = v * amp * Math.min(1, i / (attack * rate + 1)) * Math.pow(1 - t, curve);
  }
  return out;
}

function mix(...arrs) {
  let n = 0;
  for (const [a] of arrs) n = Math.max(n, a.length);
  const out = new Float32Array(n);
  for (const [a, g = 1, off = 0] of arrs) for (let i = 0; i < a.length && i + off < n; i++) out[i + off] += a[i] * g;
  return out;
}

// Distorsion douce (grognements)
function drive(a, k = 3) {
  for (let i = 0; i < a.length; i++) a[i] = Math.tanh(a[i] * k);
  return a;
}

// Rendu hors temps réel d'un graphe Web Audio (instruments à oscillateurs et filtres)
async function offline(rate, dur, build) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(rate * dur), rate);
  build(ctx, ctx.destination);
  const buf = await ctx.startRendering();
  return new Float32Array(buf.getChannelData(0));
}

// Voix d'ensemble (oscillateurs désaccordés + vibrato) vers une destination
function ensemble(ctx, dest, freq, dur, { voices = 6, spread = 12, type = 'sawtooth', vib = 5.5, vibDepth = 8, vibDelay = 0.4, seed = 11 } = {}) {
  const r = rng(seed);
  for (let v = 0; v < voices; v++) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = r() * spread;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vib * (1 + r() * 0.08);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0, 0);
    lg.gain.linearRampToValueAtTime(vibDepth, vibDelay + 0.3);
    lfo.connect(lg).connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = 1 / voices;
    o.connect(g).connect(dest);
    o.start(Math.max(0, r() * 0.02 + 0.02));
    lfo.start(0);
    o.stop(dur);
    lfo.stop(dur);
  }
}

function envNode(ctx, dest, dur, attack, release, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(peak, attack);
  g.gain.setValueAtTime(peak, Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, dur);
  g.connect(dest);
  return g;
}

// ---------------------------------------------------------------------------
// Instruments (échantillons par note racine)
// ---------------------------------------------------------------------------
const VOWELS = {
  ah: [[800, 1, 9], [1150, 0.55, 10], [2900, 0.22, 12], [3900, 0.1, 12]],
  oo: [[400, 1, 9], [800, 0.4, 10], [2600, 0.12, 12], [3300, 0.06, 12]],
};

export const INSTRUMENTS = {
  choirAh: { roots: [48, 60, 72], dur: 4.6, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 0.55, 0.9, 1);
      const sum = ctx.createGain();
      for (const [ff, gg, q] of VOWELS.ah) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gg * 3;
        sum.connect(bp).connect(g).connect(env);
      }
      ensemble(ctx, sum, f, this.dur, { voices: 7, spread: 14, vib: 5.2, vibDepth: 10, seed: Math.round(f) });
    });
  } },
  choirOo: { roots: [48, 60, 72], dur: 4.6, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 0.6, 0.9, 1);
      const sum = ctx.createGain();
      for (const [ff, gg, q] of VOWELS.oo) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gg * 3;
        sum.connect(bp).connect(g).connect(env);
      }
      ensemble(ctx, sum, f, this.dur, { voices: 6, spread: 10, type: 'triangle', vib: 5, vibDepth: 9, seed: Math.round(f) + 3 });
    });
  } },
  strings: { roots: [36, 48, 60, 72], dur: 4.4, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 0.35, 0.8, 1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = Math.min(4200, 900 + f * 6); lp.Q.value = 0.6;
      const body = ctx.createBiquadFilter();
      body.type = 'peaking'; body.frequency.value = 420; body.Q.value = 1; body.gain.value = 5;
      lp.connect(body).connect(env);
      ensemble(ctx, lp, f, this.dur, { voices: 8, spread: 16, vib: 5.6, vibDepth: 7, vibDelay: 0.6, seed: Math.round(f) + 5 });
    });
  } },
  spiccato: { roots: [36, 48, 60], dur: 0.7, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, 0);
      g.gain.linearRampToValueAtTime(1, 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, 0.45);
      g.connect(out);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(3500, 0); lp.frequency.exponentialRampToValueAtTime(900, 0.3);
      lp.connect(g);
      ensemble(ctx, lp, f, this.dur, { voices: 6, spread: 14, vibDepth: 0, seed: Math.round(f) + 9 });
    });
  } },
  cello: { roots: [36, 48], dur: 4.2, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 0.18, 0.6, 1);
      const sum = ctx.createGain();
      for (const [ff, gg, q] of [[240, 1, 3], [720, 0.7, 4], [1700, 0.35, 5], [3000, 0.12, 6]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        const g = ctx.createGain(); g.gain.value = gg * 2.2;
        sum.connect(bp).connect(g).connect(env);
      }
      ensemble(ctx, sum, f, this.dur, { voices: 2, spread: 5, vib: 5.4, vibDepth: 14, vibDelay: 0.3, seed: Math.round(f) + 13 });
    });
  } },
  brass: { roots: [36, 48, 60], dur: 3, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 0.07, 0.5, 1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 1.4;
      lp.frequency.setValueAtTime(300, 0);
      lp.frequency.exponentialRampToValueAtTime(Math.min(4000, f * 9), 0.09);
      lp.frequency.exponentialRampToValueAtTime(Math.min(2200, f * 5), 0.6);
      lp.connect(env);
      ensemble(ctx, lp, f, this.dur, { voices: 4, spread: 8, vib: 4.8, vibDepth: 5, vibDelay: 0.8, seed: Math.round(f) + 17 });
    });
  } },
  drone: { roots: [36], dur: 6, sustain: true, async render(f, rate) {
    return offline(rate, this.dur, (ctx, out) => {
      const env = envNode(ctx, out, this.dur, 1.2, 1.5, 1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
      const lg = ctx.createGain(); lg.gain.value = 160;
      lfo.connect(lg).connect(lp.frequency); lfo.start(0); lfo.stop(this.dur);
      lp.connect(env);
      ensemble(ctx, lp, f, this.dur, { voices: 4, spread: 18, vibDepth: 3, seed: 21 });
      ensemble(ctx, lp, f * 1.5, this.dur, { voices: 3, spread: 18, vibDepth: 3, seed: 22 });
    });
  } },
};

// Instruments rendus en DSP JavaScript
Object.assign(INSTRUMENTS, {
  organ: { roots: [36, 48, 60, 72], dur: 4.2, sustain: true, async render(f, rate) {
    const dur = this.dur;
    const a = partials(rate, dur, [[f * 0.5, 0.55, 99], [f, 1, 99], [f * 2, 0.65, 99], [f * 3, 0.35, 99], [f * 4, 0.3, 99], [f * 6, 0.14, 99], [f * 8, 0.1, 99], [f * 1.003, 0.5, 99, 1.3]], { attack: 0.06 });
    const n = a.length;
    for (let i = 0; i < n; i++) a[i] *= 1 + Math.sin((TAU * 6.2 * i) / rate) * 0.06;
    const rel = Math.floor(0.25 * rate);
    for (let i = 0; i < rel; i++) a[n - 1 - i] *= i / rel;
    return a;
  } },
  harp: { roots: [48, 60, 72], dur: 3.2, async render(f, rate) {
    return pluck(f, rate, this.dur, { bright: 0.55, decay: 0.9985 - (f > 500 ? 0.0012 : 0), seed: Math.round(f) });
  } },
  lute: { roots: [48, 60], dur: 2, async render(f, rate) {
    const body = [new Biquad('peaking', 280, 1.2, rate, 6), new Biquad('peaking', 2200, 1.5, rate, 4)];
    return pluck(f, rate, this.dur, { bright: 0.75, decay: 0.9968, strings: 2, detune: 0.002, seed: Math.round(f) + 1, body });
  } },
  piano: { roots: [48, 60, 72], dur: 3.6, async render(f, rate) {
    const s = pluck(f, rate, this.dur, { bright: 0.42, decay: 0.9992, strings: 3, detune: 0.0012, seed: Math.round(f) + 4 });
    const hammer = sweepNoise(rate, 0.05, { type: 'lowpass', f0: 1800, q: 0.7, curve: 4 });
    const out = mix([s, 1], [hammer, 0.15]);
    const lp = new Biquad('lowpass', Math.min(5000, f * 10), 0.7, rate);
    for (let i = 0; i < out.length; i++) out[i] = lp.p(out[i]);
    return out;
  } },
  musicBox: { roots: [72, 84], dur: 2.6, async render(f, rate) {
    return partials(rate, this.dur, [[f, 1, 1.1], [f * 3.01, 0.32, 0.45], [f * 5.43, 0.12, 0.2], [f * 7.9, 0.05, 0.1], [f * 2, 0.08, 0.6]], { attack: 0.0015, tremolo: 0.02 });
  } },
  bell: { roots: [48, 60], dur: 6.5, async render(f, rate) {
    const list = [[0.5, 0.45, 6], [1, 1, 4.5], [1.19, 0.5, 3], [1.5, 0.35, 2.4], [2, 0.5, 2], [2.52, 0.22, 1.5], [3.01, 0.18, 1.2], [4.16, 0.12, 0.8], [5.43, 0.06, 0.5]];
    const b = partials(rate, this.dur, list.map(([m, a, d], i) => [f * m * (1 + i * 0.0007), a, d]), { attack: 0.001 });
    const strike = sweepNoise(rate, 0.08, { type: 'bandpass', f0: f * 4, q: 1, curve: 5 });
    return mix([b, 1], [strike, 0.2]);
  } },
  timpani: { roots: [41], dur: 2.2, async render(f, rate) {
    const n = Math.floor(rate * this.dur);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const fr = f * (1 + 0.04 * Math.exp(-t * 18));
      ph += (TAU * fr) / rate;
      out[i] = (Math.sin(ph) + Math.sin(ph * 1.5) * 0.35 * Math.exp(-t * 3) + Math.sin(ph * 1.99) * 0.25 * Math.exp(-t * 4)) * Math.exp(-t * 1.9);
    }
    const hit = sweepNoise(rate, 0.12, { type: 'lowpass', f0: 900, q: 0.7, curve: 3 });
    return mix([out, 1], [hit, 0.5]);
  } },
  taiko: { roots: [36], dur: 1.4, async render(f, rate) {
    const body = tone(rate, this.dur, { f0: 95, f1: 48, attack: 0.001, curve: 3 });
    const skin = sweepNoise(rate, 0.25, { type: 'lowpass', f0: 600, q: 0.8, curve: 4 });
    return drive(mix([body, 1], [skin, 0.7]), 1.4);
  } },
  cymbal: { roots: [60], dur: 3.2, async render(f, rate) {
    const n = Math.floor(rate * this.dur);
    const src = noise(n, 91);
    const hp = new Biquad('highpass', 4200, 0.7, rate);
    const bp = new Biquad('bandpass', 8000, 0.8, rate);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out[i] = (hp.p(src[i]) * 0.6 + bp.p(src[i]) * 0.5) * Math.pow(1 - t, 2.2) * Math.min(1, i / 60);
    }
    return out;
  } },
});

// ---------------------------------------------------------------------------
// Bruitages (plusieurs variantes pour éviter la répétition)
// ---------------------------------------------------------------------------
export const SFX = {
  swing: { n: 4, render: (rate, v) => sweepNoise(rate, 0.26, { type: 'bandpass', f0: 2600 + v * 300, f1: 420, q: 1.6, attack: 0.05, curve: 1.6, seed: 10 + v }) },
  swingHeavy: { n: 3, render: (rate, v) => mix([sweepNoise(rate, 0.42, { type: 'bandpass', f0: 1400 + v * 150, f1: 180, q: 1.3, attack: 0.09, curve: 1.4, seed: 20 + v }), 1], [tone(rate, 0.4, { f0: 90, f1: 45, attack: 0.1, curve: 2 }), 0.25]) },
  hitFlesh: { n: 4, render: (rate, v) => mix([sweepNoise(rate, 0.16, { type: 'lowpass', f0: 1400 - v * 150, q: 0.8, curve: 3, seed: 30 + v }), 1], [tone(rate, 0.2, { f0: 150 + v * 10, f1: 55, curve: 3 }), 0.8], [sweepNoise(rate, 0.08, { type: 'bandpass', f0: 3000, q: 2, curve: 4, seed: 35 + v }), 0.25]) },
  hitMetal: { n: 4, render: (rate, v) => {
    const f = 1700 + v * 330;
    const ring = partials(rate, 0.9, [[f, 0.5, 0.35], [f * 1.51, 0.35, 0.25], [f * 2.76, 0.2, 0.15], [f * 0.53, 0.3, 0.3]], { attack: 0.0008 });
    return mix([ring, 1], [sweepNoise(rate, 0.1, { type: 'highpass', f0: 2500, q: 0.7, curve: 3, seed: 40 + v }), 0.9], [tone(rate, 0.12, { f0: 180, f1: 90, curve: 3 }), 0.4]);
  } },
  hitBone: { n: 3, render: (rate, v) => mix([sweepNoise(rate, 0.1, { type: 'bandpass', f0: 1900 + v * 200, q: 3, curve: 3, seed: 50 + v }), 1], [tone(rate, 0.12, { f0: 420, f1: 170, type: 'tri', curve: 3 }), 0.5], [sweepNoise(rate, 0.05, { type: 'highpass', f0: 4000, q: 1, curve: 5, seed: 55 + v }), 0.4, Math.floor(rate * 0.03)]) },
  hitSpirit: { n: 2, render: (rate, v) => mix([tone(rate, 0.45, { f0: 1100 - v * 150, f1: 180, curve: 1.5 }), 0.6], [sweepNoise(rate, 0.4, { type: 'bandpass', f0: 500, f1: 2600, q: 5, curve: 1.8, seed: 60 + v }), 0.8]) },
  block: { n: 3, render: (rate, v) => mix([partials(rate, 0.7, [[1150 + v * 90, 0.5, 0.25], [1860 + v * 120, 0.3, 0.18], [620, 0.3, 0.2]], { attack: 0.001 }), 1], [sweepNoise(rate, 0.14, { type: 'bandpass', f0: 2000, q: 1, curve: 3, seed: 70 + v }), 0.8], [tone(rate, 0.15, { f0: 110, f1: 60, curve: 3 }), 0.6]) },
  parry: { n: 2, render: (rate, v) => mix([partials(rate, 1.6, [[2600 + v * 150, 0.5, 0.6], [3900 + v * 200, 0.35, 0.45], [5200, 0.15, 0.3], [1300, 0.25, 0.7]], { attack: 0.0006 }), 1], [sweepNoise(rate, 0.08, { type: 'highpass', f0: 5000, q: 0.8, curve: 4, seed: 80 + v }), 0.9], [tone(rate, 0.35, { f0: 130, f1: 55, curve: 2 }), 0.5]) },
  stepDirt: { n: 4, render: (rate, v) => sweepNoise(rate, 0.09, { type: 'lowpass', f0: 650 + v * 60, q: 0.7, curve: 3, attack: 0.004, seed: 90 + v }) },
  stepStone: { n: 4, render: (rate, v) => mix([sweepNoise(rate, 0.07, { type: 'bandpass', f0: 1500 + v * 150, q: 1.2, curve: 4, seed: 95 + v }), 1], [tone(rate, 0.05, { f0: 220, f1: 140, curve: 4 }), 0.35]) },
  stepSnow: { n: 3, render: (rate, v) => sweepNoise(rate, 0.16, { type: 'bandpass', f0: 2600 + v * 200, q: 0.6, curve: 1.8, attack: 0.02, seed: 100 + v }) },
  stepWater: { n: 3, render: (rate, v) => mix([sweepNoise(rate, 0.25, { type: 'bandpass', f0: 900, f1: 2200, q: 2.5, curve: 2, seed: 105 + v }), 1], [tone(rate, 0.08, { f0: 900 + v * 100, f1: 1500, curve: 2 }), 0.2]) },
  armor: { n: 3, render: (rate, v) => partials(rate, 0.35, [[2400 + v * 300, 0.3, 0.08], [3700 + v * 200, 0.2, 0.06], [5100, 0.12, 0.05], [2900 + v * 100, 0.2, 0.07, 0.4]], { attack: 0.002 }) },
  roll: { n: 2, render: (rate, v) => mix([sweepNoise(rate, 0.4, { type: 'bandpass', f0: 700, f1: 220, q: 0.8, attack: 0.06, curve: 1.5, seed: 110 + v }), 1], [tone(rate, 0.12, { f0: 120, f1: 70, curve: 3 }), 0.4, Math.floor(rate * 0.25)]) },
  land: { n: 2, render: (rate, v) => mix([tone(rate, 0.22, { f0: 120, f1: 45, curve: 2.5 }), 1], [sweepNoise(rate, 0.16, { type: 'lowpass', f0: 500, q: 0.7, curve: 3, seed: 115 + v }), 0.7]) },
  slam: { n: 2, render: (rate, v) => drive(mix([tone(rate, 1.2, { f0: 85, f1: 28, curve: 1.6 }), 1], [sweepNoise(rate, 1.1, { type: 'lowpass', f0: 1200, f1: 90, q: 0.6, curve: 1.7, seed: 120 + v }), 0.9], [sweepNoise(rate, 0.2, { type: 'bandpass', f0: 2500, q: 1, curve: 3, seed: 125 + v }), 0.4]), 1.6) },
  explosion: { n: 2, render: (rate, v) => drive(mix([tone(rate, 1.3, { f0: 70, f1: 25, curve: 1.4 }), 1], [sweepNoise(rate, 1.3, { type: 'lowpass', f0: 1800, f1: 60, q: 0.5, curve: 1.3, seed: 130 + v }), 1.1]), 1.8) },
  crack: { n: 2, render: (rate, v) => mix([sweepNoise(rate, 0.5, { type: 'bandpass', f0: 3000, f1: 600, q: 2, curve: 2, seed: 135 + v }), 0.8], [tone(rate, 0.6, { f0: 60, f1: 30, curve: 2 }), 0.6]) },
  fire: { n: 2, render: (rate, v) => mix([sweepNoise(rate, 0.8, { type: 'bandpass', f0: 320, f1: 2200, q: 0.6, attack: 0.08, curve: 1.3, seed: 140 + v }), 1], [sweepNoise(rate, 0.8, { type: 'highpass', f0: 3000, q: 0.5, curve: 2, seed: 142 + v }), 0.2]) },
  frost: { n: 2, render: (rate, v) => mix(...[0, 1, 2, 3, 4, 5].map((k) => [partials(rate, 0.9, [[2200 + ((k * 677 + v * 311) % 2400), 0.3, 0.3]], { attack: 0.001 }), 0.5, Math.floor(rate * k * 0.045)]), [sweepNoise(rate, 0.7, { type: 'highpass', f0: 6000, q: 1.5, curve: 2, seed: 145 + v }), 0.4]) },
  lightning: { n: 2, render: (rate, v) => drive(mix([sweepNoise(rate, 0.7, { type: 'highpass', f0: 1800, q: 0.3, attack: 0.0005, curve: 2.2, seed: 150 + v }), 1.2], [tone(rate, 0.9, { f0: 65, f1: 28, type: 'saw', curve: 2 }), 0.5]), 2) },
  shadow: { n: 2, render: (rate, v) => {
    const a = mix([sweepNoise(rate, 0.8, { type: 'bandpass', f0: 180, f1: 900, q: 3, attack: 0.5, curve: 0.4, seed: 155 + v }), 1], [tone(rate, 0.8, { f0: 55, f1: 110, type: 'saw', attack: 0.4, curve: 0.5 }), 0.25]);
    const n = a.length;
    for (let i = 0; i < n; i++) a[i] *= Math.pow(i / n, 1.5) * (i > n * 0.92 ? (n - i) / (n * 0.08) : 1);
    return a;
  } },
  holy: { n: 1, render: (rate) => mix(...[0, 4, 7, 12, 16].map((s, i) => [partials(rate, 1.8, [[mtof(72 + s), 0.3, 0.9], [mtof(84 + s), 0.08, 0.5]], { attack: 0.02 }), 0.5, Math.floor(rate * i * 0.05)])) },
  poison: { n: 1, render: (rate) => mix(...[0, 1, 2, 3, 4, 5, 6].map((k) => [tone(rate, 0.12, { f0: 300 + ((k * 137) % 400), f1: 900 + k * 80, curve: 2 }), 0.4, Math.floor(rate * k * 0.07)])) },
  arcane: { n: 1, render: (rate) => mix([tone(rate, 0.5, { f0: 400, f1: 1300, type: 'tri', curve: 1.5 }), 0.6], [sweepNoise(rate, 0.5, { type: 'bandpass', f0: 1500, q: 4, curve: 2, seed: 160 }), 0.5]) },
  growl: { n: 3, render: (rate, v) => {
    const n = Math.floor(rate * 0.8);
    const out = new Float32Array(n);
    let ph = 0;
    const r = rng(170 + v);
    const bp = new Biquad('bandpass', 480 + v * 60, 2.5, rate);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const f = (105 - t * 30 + v * 8) * (1 + Math.sin((TAU * 24 * i) / rate) * 0.18 + r() * 0.05);
      ph += (TAU * f) / rate;
      const saw = ((ph / TAU) % 1) * 2 - 1;
      out[i] = bp.p(saw + r() * 0.3) * Math.min(1, t * 10) * Math.pow(1 - t, 1.3);
    }
    return drive(out, 2.5);
  } },
  screech: { n: 2, render: (rate, v) => mix([tone(rate, 0.55, { f0: 1300 + v * 200, f1: 680, type: 'saw', attack: 0.02, curve: 1.5 }), 0.35], [sweepNoise(rate, 0.55, { type: 'bandpass', f0: 2600 + v * 300, q: 6, curve: 1.5, seed: 175 + v }), 0.9]) },
  wail: { n: 2, render: (rate, v) => {
    const n = Math.floor(rate * 1.6);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const f = (520 + v * 90) * (1 + Math.sin(t * Math.PI) * 0.35) * (1 + Math.sin((TAU * 6 * i) / rate) * 0.02);
      ph += (TAU * f) / rate;
      out[i] = (Math.sin(ph) + Math.sin(ph * 2.01) * 0.3) * Math.sin(t * Math.PI);
    }
    const bp = new Biquad('bandpass', 900, 1.5, rate);
    for (let i = 0; i < n; i++) out[i] = out[i] * 0.4 + bp.p(out[i]) * 0.8;
    return out;
  } },
  roar: { n: 2, render: (rate, v) => {
    const n = Math.floor(rate * 1.9);
    const out = new Float32Array(n);
    const r = rng(180 + v);
    const lp = new Biquad('lowpass', 800, 1, rate);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const env = Math.min(1, t * 6) * Math.pow(1 - t, 1.2);
      const f = (75 + v * 10) * (1.35 - t * 0.35) * (1 + Math.sin((TAU * 17 * i) / rate) * 0.12);
      p1 += (TAU * f) / rate;
      p2 += (TAU * f * 1.498) / rate;
      out[i] = lp.p(((p1 / TAU) % 1) * 2 - 1 + (((p2 / TAU) % 1) * 2 - 1) * 0.6 + r() * 0.5) * env;
    }
    return drive(out, 2.2);
  } },
  die: { n: 2, render: (rate, v) => mix([tone(rate, 0.7, { f0: 190 - v * 20, f1: 50, type: 'saw', curve: 2 }), 0.3], [sweepNoise(rate, 0.6, { type: 'lowpass', f0: 700, q: 1, curve: 2, seed: 185 + v }), 0.7]) },
  // Interface
  uiHover: { n: 1, render: (rate) => partials(rate, 0.12, [[1760, 0.25, 0.04], [2640, 0.1, 0.03]], { attack: 0.001 }) },
  uiClick: { n: 1, render: (rate) => mix([partials(rate, 0.35, [[880, 0.4, 0.1], [1320, 0.25, 0.08], [2200, 0.1, 0.05]], { attack: 0.001 }), 1], [sweepNoise(rate, 0.04, { type: 'highpass', f0: 3000, q: 1, curve: 4, seed: 190 }), 0.3]) },
  uiBack: { n: 1, render: (rate) => mix([tone(rate, 0.14, { f0: 700, f1: 380, type: 'tri', curve: 2 }), 0.6]) },
  uiError: { n: 1, render: (rate) => tone(rate, 0.2, { f0: 150, type: 'square', curve: 1.5, amp: 0.5 }) },
  // Techniques et événements
  perfectDodge: { n: 1, render: (rate) => {
    const rev = sweepNoise(rate, 0.5, { type: 'bandpass', f0: 400, f1: 3000, q: 2, curve: 0.3, seed: 195 });
    const n = rev.length;
    for (let i = 0; i < n; i++) rev[i] *= Math.pow(i / n, 2);
    return mix([rev, 0.9], [partials(rate, 1.8, [[1568, 0.4, 0.8], [2349, 0.3, 0.6], [3136, 0.15, 0.4]], { attack: 0.001 }), 0.8, n - 200], [tone(rate, 1, { f0: 70, f1: 35, curve: 1.5 }), 0.7, n - 200]);
  } },
  charge: { n: 3, render: (rate, v) => mix([tone(rate, 0.5, { f0: 220 * (1 + v * 0.5), f1: 440 * (1 + v * 0.5), type: 'tri', attack: 0.05, curve: 1.5 }), 0.4], [sweepNoise(rate, 0.5, { type: 'bandpass', f0: 800 + v * 600, f1: 3000, q: 4, curve: 1.5, seed: 200 + v }), 0.6]) },
  art: { n: 1, render: (rate) => mix([sweepNoise(rate, 0.7, { type: 'bandpass', f0: 300, f1: 4000, q: 3, attack: 0.1, curve: 1.2, seed: 205 }), 0.8], [partials(rate, 1.2, [[587, 0.3, 0.6], [880, 0.25, 0.5], [1175, 0.15, 0.4]], { attack: 0.05 }), 0.6]) },
  dash: { n: 2, render: (rate, v) => sweepNoise(rate, 0.3, { type: 'bandpass', f0: 3500 + v * 400, f1: 700, q: 1.2, attack: 0.02, curve: 1.8, seed: 210 + v }) },
  slide: { n: 1, render: (rate) => sweepNoise(rate, 0.65, { type: 'bandpass', f0: 1100, f1: 500, q: 0.7, attack: 0.03, curve: 1.2, seed: 215 }) },
  doubleJump: { n: 1, render: (rate) => mix([sweepNoise(rate, 0.35, { type: 'bandpass', f0: 900, f1: 3500, q: 1.5, curve: 1.6, seed: 220 }), 0.7], [partials(rate, 0.8, [[1318, 0.25, 0.4], [1976, 0.18, 0.3]], { attack: 0.01 }), 0.5]) },
  heartbeat: { n: 1, render: (rate) => mix([tone(rate, 0.16, { f0: 62, f1: 40, curve: 2 }), 1], [tone(rate, 0.16, { f0: 56, f1: 38, curve: 2 }), 0.7, Math.floor(rate * 0.2)]) },
  drink: { n: 1, render: (rate) => mix(...[0, 1, 2].map((k) => [tone(rate, 0.12, { f0: 480 + k * 60, f1: 300, curve: 2 }), 0.3, Math.floor(rate * k * 0.18)]), [partials(rate, 1, [[660, 0.2, 0.5], [990, 0.12, 0.4]], { attack: 0.03 }), 0.5, Math.floor(rate * 0.6)]) },
  pickup: { n: 1, render: (rate) => mix([partials(rate, 0.5, [[1318, 0.3, 0.2]], { attack: 0.001 }), 1], [partials(rate, 0.6, [[1976, 0.25, 0.25]], { attack: 0.001 }), 1, Math.floor(rate * 0.07)]) },
  chestOpen: { n: 1, render: (rate) => mix([tone(rate, 0.35, { f0: 200, f1: 110, type: 'tri', curve: 2 }), 0.5], [sweepNoise(rate, 0.3, { type: 'bandpass', f0: 500, q: 2, curve: 2, seed: 225 }), 0.4]) },
  portal: { n: 1, render: (rate) => mix([tone(rate, 1.4, { f0: 80, f1: 600, type: 'saw', attack: 0.2, curve: 1 }), 0.25], [sweepNoise(rate, 1.5, { type: 'bandpass', f0: 400, f1: 4000, q: 3, attack: 0.3, curve: 1, seed: 230 }), 0.7]) },
  fogwall: { n: 1, render: (rate) => sweepNoise(rate, 1.2, { type: 'bandpass', f0: 200, f1: 900, q: 2, attack: 0.3, curve: 1, seed: 235 }) },
  // Ambiances ponctuelles
  crow: { n: 2, render: (rate, v) => {
    const out = new Float32Array(Math.floor(rate * 0.9));
    for (let k = 0; k < 2 + v; k++) {
      const off = Math.floor(rate * k * 0.28);
      const c = drive(mix([tone(rate, 0.2, { f0: 900 - v * 60, f1: 620, type: 'saw', attack: 0.01, curve: 1.5 }), 0.5], [sweepNoise(rate, 0.2, { type: 'bandpass', f0: 1400, q: 3, curve: 1.5, seed: 240 + k }), 0.6]), 2);
      for (let i = 0; i < c.length && i + off < out.length; i++) out[i + off] += c[i];
    }
    return out;
  } },
  owl: { n: 1, render: (rate) => mix([tone(rate, 0.35, { f0: 420, f1: 380, attack: 0.05, curve: 1.2 }), 1], [tone(rate, 0.6, { f0: 440, f1: 360, attack: 0.08, curve: 1.2 }), 1, Math.floor(rate * 0.45)]) },
  drip: { n: 3, render: (rate, v) => tone(rate, 0.12, { f0: 1200 + v * 300, f1: 2400 + v * 200, attack: 0.001, curve: 3 }) },
  whisper: { n: 2, render: (rate, v) => {
    const a = sweepNoise(rate, 1.6, { type: 'bandpass', f0: 1800 + v * 400, f1: 1200, q: 6, attack: 0.4, curve: 0.8, seed: 250 + v });
    const n = a.length;
    for (let i = 0; i < n; i++) a[i] *= 0.5 + 0.5 * Math.sin((TAU * 7 * i) / rate + v);
    return a;
  } },
  iceCrack: { n: 2, render: (rate, v) => mix([sweepNoise(rate, 0.3, { type: 'highpass', f0: 3500, q: 1, curve: 3, seed: 255 + v }), 0.8], [partials(rate, 0.6, [[3100 + v * 400, 0.2, 0.2], [4700, 0.12, 0.15]], { attack: 0.001 }), 0.6]) },
  bubble: { n: 2, render: (rate, v) => mix(...[0, 1, 2].map((k) => [tone(rate, 0.15, { f0: 160 + k * 40 + v * 30, f1: 420 + k * 50, curve: 2 }), 0.5, Math.floor(rate * k * 0.12)])) },
};

// Qualité : fréquence d'échantillonnage, notes racines conservées, bruitages
const QUALITY = {
  low: { rate: 22050, rootsMax: 2 },
  medium: { rate: 32000, rootsMax: 3 },
  high: { rate: 44100, rootsMax: 4 },
};

// Réduit la liste des notes racines selon la qualité (en gardant les extrêmes)
function pickRoots(roots, max) {
  if (roots.length <= max) return roots;
  if (max === 1) return [roots[Math.floor(roots.length / 2)]];
  const out = [];
  for (let i = 0; i < max; i++) out.push(roots[Math.round((i * (roots.length - 1)) / (max - 1))]);
  return [...new Set(out)];
}

export const soundbank = {
  data: null,

  // Rend toute la banque ; onProgress(fraction, détail)
  async render(quality = 'medium', onProgress = () => {}) {
    const q = QUALITY[quality] || QUALITY.medium;
    const rate = q.rate;
    const samples = {};
    const jobs = [];
    for (const [name, inst] of Object.entries(INSTRUMENTS)) {
      if (!inst.render) continue;
      for (const root of pickRoots(inst.roots, q.rootsMax)) jobs.push({ kind: 'inst', name, inst, root });
    }
    for (const [name, s] of Object.entries(SFX)) for (let v = 0; v < s.n; v++) jobs.push({ kind: 'sfx', name, s, v });
    const labels = { choirAh: 'chœur (ah)', choirOo: 'chœur (oh)', strings: 'cordes', spiccato: 'cordes piquées', cello: 'violoncelle', brass: 'cuivres', drone: 'bourdon', organ: 'orgue', harp: 'harpe', lute: 'luth', piano: 'piano', musicBox: 'boîte à musique', bell: 'cloche', timpani: 'timbales', taiko: 'tambours', cymbal: 'cymbale' };
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (j.kind === 'inst') {
        await onProgress(i / jobs.length, `Instrument : ${labels[j.name] || j.name}`);
        const a = await j.inst.render(mtof(j.root), rate);
        dcBlock(a, rate);
        normalize(a, 0.85);
        fadeEdges(a, rate, 0.001, 0.08);
        samples[`${j.name}@${j.root}`] = { data: toInt16(a), root: j.root, sustain: !!j.inst.sustain };
      } else {
        if (j.v === 0) await onProgress(i / jobs.length, `Bruitage : ${j.name}`);
        const a = j.s.render(rate, j.v);
        dcBlock(a, rate);
        normalize(a, 0.9);
        fadeEdges(a, rate, 0.0005, 0.03);
        samples[`sfx:${j.name}:${j.v}`] = { data: toInt16(a) };
      }
    }
    await onProgress(1, '');
    return { version: BANK_VERSION, quality, rate, samples };
  },

  load(data) {
    this.data = data && data.version === BANK_VERSION ? data : null;
  },

  // Taille mémoire décodée (Mo, flottants 32 bits)
  memoryMb() {
    if (!this.data) return 0;
    let n = 0;
    for (const s of Object.values(this.data.samples)) n += s.data.length;
    return (n * 4) / 1048576;
  },
};
