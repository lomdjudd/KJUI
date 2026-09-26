// Interface : bruitages, voix, mascotte, notifications, confettis, fiche d'un astre.
import { PLANETS } from './data.js';

export const $ = (id) => document.getElementById(id);

// ---------- Réglages ----------
export const settings = { sound: true, voice: false, music: false, labels: true };

// ---------- Bruitages synthétisés ----------
let ctx = null;
let master = null;
let musicNodes = null;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function tone(freq, dur, { type = 'sine', vol = 0.2, delay = 0, slide = 0 } = {}) {
  if (!ctx || !settings.sound) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, { vol = 0.2, from = 400, to = 3000, delay = 0, q = 1 } = {}) {
  if (!ctx || !settings.sound) return;
  const t = ctx.currentTime + delay;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone(660, 0.08, { type: 'triangle', vol: 0.15 }),
  pop: () => tone(420, 0.14, { type: 'sine', vol: 0.22, slide: 2.2 }),
  open: () => { tone(520, 0.1, { type: 'triangle', vol: 0.14 }); tone(780, 0.14, { type: 'triangle', vol: 0.12, delay: 0.07 }); },
  good: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.18, delay: i * 0.08 })),
  bad: () => { tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: 0.7 }); },
  whoosh: () => noise(1.4, { vol: 0.25, from: 200, to: 2500, q: 0.8 }),
  warp: () => { noise(2.6, { vol: 0.2, from: 150, to: 4000, q: 0.6 }); tone(110, 2.6, { type: 'sine', vol: 0.12, slide: 4 }); },
  launch: () => { noise(3.5, { vol: 0.35, from: 80, to: 600, q: 0.5 }); tone(55, 3, { type: 'sawtooth', vol: 0.06, slide: 1.8 }); },
  arrive: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.14, delay: i * 0.09 })),
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.16, delay: i * 0.11 })),
};

// Musique d'ambiance : nappe douce de quelques oscillateurs
export function setMusic(on) {
  settings.music = on;
  if (!ctx) return;
  if (on && !musicNodes) {
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    g.connect(f).connect(master);
    const notes = [110, 164.8, 220, 277.2, 329.6];
    const oscs = notes.map((n, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = n;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = 0.18;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = ctx.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg).connect(og.gain);
      o.connect(og).connect(g);
      o.start(); lfo.start();
      return [o, lfo];
    });
    musicNodes = { g, oscs };
  } else if (!on && musicNodes) {
    const { g, oscs } = musicNodes;
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => oscs.forEach(([o, l]) => { o.stop(); l.stop(); }), 1200);
    musicNodes = null;
  }
}

// ---------- Voix (synthèse vocale du navigateur) ----------
let frVoice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  frVoice = vs.find((v) => /fr[-_]FR/i.test(v.lang) && /google|amélie|amelie|thomas|audrey|natural/i.test(v.name))
    || vs.find((v) => /^fr/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function speak(text, force = false) {
  if (!window.speechSynthesis || (!settings.voice && !force)) return;
  speechSynthesis.cancel();
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/−/g, 'moins ');
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'fr-FR';
  if (frVoice) u.voice = frVoice;
  u.rate = 0.98;
  u.pitch = 1.1;
  const bot = $('bot');
  u.onstart = () => bot.classList.add('talk');
  u.onend = u.onerror = () => bot.classList.remove('talk');
  speechSynthesis.speak(u);
}
export function stopSpeaking() { if (window.speechSynthesis) speechSynthesis.cancel(); }

// ---------- Mascotte ----------
let bubbleTimer = 0;
let lastSay = '';
let sayAt = 0;
// Quand l'enfant touche l'espace, la bulle se replie (on la rouvre en touchant Cosmo)
export function collapseBubble() {
  if (performance.now() - sayAt > 2500) $('bubble').classList.add('gone');
}
export function say(text, { speakIt = true, stay = 12000 } = {}) {
  lastSay = text;
  sayAt = performance.now();
  $('mascot').classList.remove('hidden');
  const b = $('bubble');
  b.classList.remove('gone');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  $('bubble-text').textContent = text;
  clearTimeout(bubbleTimer);
  if (stay) bubbleTimer = setTimeout(() => b.classList.add('gone'), stay);
  if (speakIt) speak(text);
}
export function initMascot() {
  $('bubble-voice').addEventListener('click', (e) => { e.stopPropagation(); speak(lastSay, true); });
  $('bot').addEventListener('click', () => {
    const b = $('bubble');
    if (b.classList.contains('gone')) { b.classList.remove('gone'); speak(lastSay); } else b.classList.add('gone');
  });
}

// ---------- Notifications ----------
export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ---------- Confettis ----------
const conf = { parts: [], raf: 0 };
export function confetti(n = 140) {
  const c = $('confetti');
  const g = c.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const colors = ['#ffc93c', '#ff6bb5', '#5ad1ff', '#4fe39a', '#b28dff', '#ff8a5c'];
  for (let i = 0; i < n; i++) {
    conf.parts.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 6, r: 4 + Math.random() * 6,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], life: 1, star: Math.random() < 0.3,
    });
  }
  if (conf.raf) return;
  const step = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    conf.parts = conf.parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
    conf.parts.forEach((p) => {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.006;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c;
      if (p.star) { g.font = `${p.r * 3}px serif`; g.fillText('⭐', -p.r, p.r); } else g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      g.restore();
    });
    if (conf.parts.length) conf.raf = requestAnimationFrame(step);
    else { conf.raf = 0; g.clearRect(0, 0, innerWidth, innerHeight); }
  };
  conf.raf = requestAnimationFrame(step);
}

// ---------- Fiche d'un astre ----------
const EARTH_D = 12742;
export function showInfo(body, actions = []) {
  const d = body.data;
  $('info-emoji').textContent = d.emoji;
  $('info-kind').textContent = d.kind || 'Engin spatial';
  $('info-name').textContent = d.name;
  $('info-story').textContent = d.story;
  $('info-wow').textContent = d.wow;

  const facts = $('info-facts');
  facts.innerHTML = '';
  Object.entries(d.facts || {}).forEach(([k, v]) => {
    const el = document.createElement('div');
    el.className = 'fact';
    el.innerHTML = `<small></small><b></b>`;
    el.querySelector('small').textContent = k;
    el.querySelector('b').textContent = v;
    facts.appendChild(el);
  });
  if (d.travel && d.id !== 'earth') {
    const el = document.createElement('div');
    el.className = 'fact';
    el.innerHTML = '<small>🚀 Voyage depuis la Terre</small><b></b>';
    el.querySelector('b').textContent = d.travel;
    facts.appendChild(el);
  }

  // Comparaison de taille avec la Terre
  const cmp = $('info-compare');
  cmp.innerHTML = '';
  if (d.realDiameter && d.id !== 'earth') {
    const ratio = d.realDiameter / EARTH_D;
    const maxPx = 110;
    let e = 40, p = 40 * ratio;
    if (p > maxPx) { e = Math.max(4, (maxPx / p) * 40); p = maxPx; }
    const planetCol = d.color;
    const txt = ratio >= 1 ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1).replace('.', ',')} fois plus grand${d.id === 'sun' ? '' : 'e'} que la Terre` : `${Math.round(ratio * 100)} % de la taille de la Terre`;
    cmp.innerHTML = `
      <div><i style="width:${e}px;height:${e}px;background:radial-gradient(circle at 35% 35%,#9fe0ff,#2f7bff)"></i>Terre</div>
      <div><i style="width:${p}px;height:${p}px;background:radial-gradient(circle at 35% 35%,#fff8,${planetCol})"></i>${d.short || d.name}</div>`;
    const cap = document.createElement('div');
    cap.style.cssText = 'align-self:center;max-width:120px;color:#fff;font-size:13px';
    cap.textContent = txt;
    cmp.appendChild(cap);
  }

  const act = $('info-actions');
  act.innerHTML = '';
  actions.forEach(({ label, onClick, primary }) => {
    const b = document.createElement('button');
    b.className = 'btn' + (primary ? ' primary' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    act.appendChild(b);
  });

  $('info').classList.remove('hidden');
  document.body.classList.add('info-open');
  $('info').style.animation = 'none';
  void $('info').offsetWidth;
  $('info').style.animation = '';
  $('info').querySelector('.info-body').scrollTop = 0;
}
export function hideInfo() {
  $('info').classList.add('hidden');
  document.body.classList.remove('info-open');
}

// ---------- Panneau d'activité ----------
export function showPanel(html) {
  const p = $('panel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  document.body.classList.add('panel-open');
  p.style.animation = 'none';
  void p.offsetWidth;
  p.style.animation = '';
  return p;
}
export function hidePanel() {
  $('panel').classList.add('hidden');
  $('panel').innerHTML = '';
  document.body.classList.remove('panel-open');
}

export const planetById = (id) => PLANETS.find((p) => p.id === id);
