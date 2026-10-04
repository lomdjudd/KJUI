// Bruitages et ambiance entièrement synthétisés (WebAudio).
import { G } from './state.js';

let ctx = null;
let master = null;
let amb = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = G.settings.volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setVolume(v) {
  G.settings.volume = v;
  if (master) master.gain.value = v;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, filt = 1200, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filt;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

const SFX = {
  eat: () => {
    tone(520, 0.08, 'triangle', 0.15, 1.6);
    tone(780, 0.08, 'triangle', 0.1, 1.4, 0.06);
  },
  hit: () => {
    noise(0.12, 0.35, 900);
    tone(140, 0.12, 'square', 0.12, 0.5);
  },
  hurt: () => {
    tone(260, 0.25, 'sawtooth', 0.15, 0.4);
  },
  craft: () => {
    tone(660, 0.07, 'square', 0.08);
    tone(880, 0.07, 'square', 0.08, 1, 0.08);
    tone(1320, 0.12, 'triangle', 0.1, 1, 0.16);
  },
  build: () => {
    noise(0.1, 0.4, 500);
    noise(0.1, 0.4, 500, 0.15);
    tone(200, 0.2, 'triangle', 0.15, 0.8, 0.3);
  },
  harvest: () => {
    noise(0.07, 0.3, 2000);
    tone(330, 0.06, 'triangle', 0.08);
  },
  evolve: () => {
    [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.5, 'sine', 0.14, 1, i * 0.1));
  },
  click: () => tone(900, 0.04, 'square', 0.05),
  error: () => tone(160, 0.18, 'square', 0.1, 0.8),
  explode: () => {
    noise(1.2, 0.8, 400);
    tone(70, 0.9, 'sine', 0.5, 0.3);
  },
  shoot: () => {
    noise(0.1, 0.4, 3000);
    tone(400, 0.1, 'square', 0.1, 0.3);
  },
  laser: () => tone(1800, 0.2, 'sawtooth', 0.12, 0.2),
  swoosh: () => noise(0.15, 0.2, 2500),
  splash: () => noise(0.3, 0.3, 1500),
  coin: () => {
    tone(988, 0.08, 'square', 0.08);
    tone(1319, 0.18, 'square', 0.08, 1, 0.08);
  },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 1, i * 0.09)),
  drink: () => {
    tone(300, 0.1, 'sine', 0.1, 1.5);
    tone(350, 0.1, 'sine', 0.1, 1.5, 0.12);
  },
  roar: () => {
    tone(90, 0.8, 'sawtooth', 0.3, 0.6);
    noise(0.8, 0.3, 600);
  },
  type: () => tone(1200 + Math.random() * 400, 0.02, 'square', 0.03),
};

export function sfx(name) {
  if (!ctx || G.settings.volume <= 0) return;
  SFX[name]?.();
}

// Nappe d'ambiance qui change selon l'environnement
export function ambience(kind) {
  if (!ctx) return;
  if (amb) {
    const old = amb;
    old.g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 2);
    setTimeout(() => old.oscs.forEach((o) => o.stop()), 2200);
    amb = null;
  }
  const chords = {
    micro: [110, 164.8, 220, 277],
    ocean: [98, 147, 196, 247],
    land: [130.8, 196, 261.6, 329.6],
    modern: [146.8, 220, 293.7, 370],
  };
  const fs = chords[kind] || chords.land;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 3);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 700;
  g.connect(f).connect(master);
  const oscs = fs.map((fr, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = fr;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.05 + i * 0.03;
    lg.gain.value = fr * 0.006;
    lfo.connect(lg).connect(o.frequency);
    lfo.start();
    o.connect(g);
    o.start();
    return o;
  });
  amb = { g, oscs };
}
