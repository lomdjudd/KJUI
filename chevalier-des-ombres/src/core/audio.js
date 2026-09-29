// Moteur audio : musiques orchestrales et bruitages enregistrés (données installées), avec en
// secours la banque de sons de synthèse et une musique composée en temps réel (thème principal,
// harpe, chœurs, cordes, orgue, cloches). Gère les fondus exploration / combat / boss, les
// ambiances, la spatialisation, la réverbération et les ralentis.
import { settings } from './settings.js';
import { clamp } from './utils.js';
import { soundbank } from './soundbank.js';
import { recorded } from './recorded.js';
import { AUDIO_MANIFEST } from '../data/audioCredits.js';

// Musique enregistrée de chaque ambiance : [piste, vitesse] (vitesse < 1 : plus lente et plus grave)
const REC_TRACKS = {
  title: ['title', 1],
  hub: ['town', 1],
  graveyard: ['unrest', 1],
  forest: ['forest', 1],
  swamp: ['magical', 0.96],
  catacombs: ['dungeon', 1],
  castle: ['overworld', 1],
  frost: ['safe', 1],
  inferno: ['dungeon', 0.92],
  void: ['magical', 0.86],
};
// Niveau des musiques enregistrées par rapport au bus musique (équilibré avec les bruitages)
const REC_MUSIC_GAIN = 1.2;

// Bruitages enregistrés : remplacent (ou complètent, mix) ceux de la banque de synthèse
const steps = (k) => [1, 2, 3, 4].map((i) => k + i);
const REC_VARIANTS = {
  swing: { ids: ['swish'] },
  swingHeavy: { ids: ['swish'] },
  hitFlesh: { ids: ['hitFlesh'], mix: true },
  hitBone: { ids: ['hitBone'], mix: true },
  block: { ids: ['block'] },
  stepDirt: { ids: steps('stepLeather') },
  stepStone: { ids: steps('stepEcho') },
  stepSnow: { ids: steps('stepCloth') },
  armor: { ids: steps('stepMetal') },
  drink: { ids: ['potion'] },
  fire: { ids: ['fireball', 'burn'] },
  frost: { ids: ['freeze'] },
  lightning: { ids: ['shock', 'thunder'] },
  arcane: { ids: ['teleport'] },
  holy: { ids: ['heal', 'shield'] },
  shadow: { ids: ['timestop'], mix: true },
  slam: { ids: ['quake'], mix: true },
  growl: { ids: ['zombieGrowl', 'zombiePhys', 'beastPhys'] },
  screech: { ids: ['insect', 'wyvernMent'] },
  wail: { ids: ['ghost'] },
  roar: { ids: ['wyvernRoar', 'beastHit'] },
  die: { ids: ['zombieDie', 'skeletonDie', 'squishDie', 'beastDie'] },
  pickup: { ids: ['coins', 'gem'] },
  chestOpen: { ids: ['chest'] },
  portal: { ids: ['portal'] },
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Accords (demi-tons depuis la tonique)
const CHORDS = {
  i: [0, 3, 7], i7: [0, 3, 7, 10], I: [0, 4, 7], ii0: [2, 5, 8], III: [3, 7, 10], iv: [5, 8, 12], IV: [5, 9, 12],
  v: [7, 10, 14], V: [7, 11, 14], V7: [7, 11, 14, 17], VI: [8, 12, 15], VII: [10, 14, 17], bII: [1, 5, 8], vii0: [11, 14, 17],
};

// Thème principal (« Le Serment de Cendre ») : 8 mesures à 3 temps, degrés de la gamme mineure harmonique
const LEITMOTIF = {
  beats: 3,
  notes: [[4, 2], [3, 1], [2, 2], [1, 1], [0, 1], [1, 1], [2, 1], [4, 3], [5, 2], [4, 1], [3, 2], [2, 1], [1, 1], [2, 1], [-1, 1], [0, 3]],
  prog: ['i', 'VII', 'VI', 'V', 'VI', 'iv', 'V', 'i'],
};

// Ambiances musicales par zone : tonalité, mesure, tempo, progression, instruments
export const MOODS = {
  title: { key: 50, scale: 'harmonic', beats: 3, bpm: 62, prog: LEITMOTIF.prog, melody: 'leit', pad: 'strings', pad2: 'choirOo', arp: 'harp', mel: 'choirAh', bass: 'cello', bells: 0.5, melEvery: 1 },
  hub: { key: 50, scale: 'harmonic', beats: 3, bpm: 54, prog: LEITMOTIF.prog, melody: 'leit', pad: 'strings', arp: 'harp', mel: 'cello', mel2: 'musicBox', bass: null, bells: 0.35, melEvery: 1, soft: 0.8 },
  graveyard: { key: 45, scale: 'harmonic', beats: 4, bpm: 60, prog: ['i', 'VI', 'III', 'VII', 'i', 'iv', 'V', 'i'], pad: 'choirAh', arp: 'piano', arpSparse: true, mel: 'musicBox', bass: 'strings', bells: 0.6, melEvery: 2 },
  forest: { key: 43, scale: 'dorian', beats: 3, bpm: 66, prog: ['i', 'VII', 'VI', 'VII', 'i', 'v', 'iv', 'V'], pad: 'strings', arp: 'lute', mel: 'cello', bass: null, bells: 0.15, melEvery: 2 },
  swamp: { key: 41, scale: 'phrygian', beats: 4, bpm: 50, prog: ['i', 'bII', 'i', 'VII', 'i', 'bII', 'iv', 'i'], pad: 'drone', pad2: 'choirOo', arp: 'harp', arpSparse: true, mel: 'choirOo', bass: null, bells: 0.1, melEvery: 3 },
  catacombs: { key: 40, scale: 'harmonic', beats: 4, bpm: 48, prog: ['i', 'bII', 'VI', 'V', 'i', 'iv', 'bII', 'V'], pad: 'organ', pad2: 'drone', arp: null, mel: 'choirAh', bass: 'organ', bells: 0.25, melEvery: 2 },
  castle: { key: 47, scale: 'harmonic', beats: 3, bpm: 70, prog: ['i', 'iv', 'VII', 'III', 'VI', 'ii0', 'V', 'i'], pad: 'organ', arp: 'lute', mel: 'strings', bass: 'cello', bells: 0.4, melEvery: 1 },
  frost: { key: 52, scale: 'minor', beats: 3, bpm: 56, prog: ['i', 'VI', 'III', 'VII', 'iv', 'VI', 'V', 'i'], pad: 'choirOo', arp: 'musicBox', mel: 'piano', bass: null, bells: 0.7, melEvery: 2 },
  inferno: { key: 38, scale: 'phrygian', beats: 4, bpm: 76, prog: ['i', 'bII', 'i', 'bII', 'VI', 'V', 'bII', 'i'], pad: 'brass', pad2: 'choirAh', arp: 'spiccato', mel: 'choirAh', bass: 'strings', bells: 0.1, melEvery: 2, drums: true },
  void: { key: 44, scale: 'locrian', beats: 4, bpm: 52, prog: ['i', 'bII', 'iv', 'V', 'VI', 'bII', 'ii0', 'i'], pad: 'choirAh', pad2: 'drone', arp: 'musicBox', arpSparse: true, mel: 'cello', bass: null, bells: 0.3, melEvery: 2, eerie: true },
};

// Ambiances ponctuelles par zone (échantillons de la banque)
const AMB_ONESHOTS = {
  hub: [['owl', 0.05], ['bellFar', 0.04]],
  graveyard: [['crow', 0.08], ['owl', 0.03], ['bellFar', 0.03]],
  forest: [['crow', 0.05], ['owl', 0.06]],
  swamp: [['bubble', 0.12], ['crow', 0.02]],
  catacombs: [['drip', 0.2], ['whisper', 0.03]],
  castle: [['bellFar', 0.05], ['whisper', 0.02]],
  frost: [['iceCrack', 0.08]],
  inferno: [['bubble', 0.1], ['crack', 0.03]],
  void: [['whisper', 0.1], ['drip', 0.04]],
};

// Petite suite pseudo-aléatoire déterministe (mélodies reproductibles par zone)
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.targetIntensity = 0;
    this.moodName = 'title';
    this.mood = MOODS.title;
    this.step = 0;
    this.buffers = {};
    this.roots = {};
    this.slow = false;
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
    this._build(new AC({ latencyHint: 'interactive' }));
    this._nextStep = this.ctx.currentTime + 0.3;
    this._timer = setInterval(() => this._schedule(), 60);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      const R = this.recMusic;
      if (document.hidden && settings.get('muteBackground')) {
        this.ctx.suspend();
        if (R && R.cur >= 0) R.decks[R.cur].el.pause();
      } else if (!document.hidden) {
        this.ctx.resume();
        if (R && R.cur >= 0) R.decks[R.cur].el.play().catch(() => {});
      }
    });
  }

  // Construit le graphe audio sur un contexte (temps réel, ou hors ligne pour les tests)
  _build(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    // Filtre global (Temps des Ombres : son étouffé)
    this.slowFilter = ctx.createBiquadFilter();
    this.slowFilter.type = 'lowpass';
    this.slowFilter.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(this.slowFilter).connect(comp).connect(ctx.destination);

    // Réverbération de cathédrale (réponse impulsionnelle générée)
    const q = settings.get('audioQuality');
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(q === 'low' ? 1.8 : q === 'high' ? 3.4 : 2.6, 2.4);
    this.reverbGain = ctx.createGain();
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.sfxSend = ctx.createGain();
    this.sfxSend.gain.value = 0.22;
    this.sfxBus.connect(this.sfxSend).connect(this.reverb);

    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.musicSend = ctx.createGain();
    this.musicSend.gain.value = 0.55;
    this.musicBus.connect(this.musicSend).connect(this.reverb);
    // Musiques enregistrées (lecteur à deux pistes pour les fondus enchaînés)
    this.recBus = ctx.createGain();
    this.recBus.gain.value = REC_MUSIC_GAIN;
    this.recBus.connect(this.musicBus);

    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.master);
    this.ambSend = ctx.createGain();
    this.ambSend.gain.value = 0.4;
    this.ambBus.connect(this.ambSend).connect(this.reverb);

    // Couches musicales (fondus selon l'intensité)
    this.layerExplore = ctx.createGain();
    this.layerCombat = ctx.createGain();
    this.layerBoss = ctx.createGain();
    this.layerCombat.gain.value = 0;
    this.layerBoss.gain.value = 0;
    this.layerExplore.connect(this.musicBus);
    this.layerCombat.connect(this.musicBus);
    this.layerBoss.connect(this.musicBus);
    // Panoramiques fixes par pupitre (largeur stéréo de l'orchestre)
    this.pans = {};

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._loadBank();
    this._startAmbience();
    this.applyVolumes();
    // Contexte temps réel uniquement (pas pour les rendus hors ligne des tests)
    const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    if (!offline) {
      this._initRecMusic();
      this._loadRecordedSfx();
    }
  }

  // ---------- Bruitages enregistrés ----------
  async _loadRecordedSfx() {
    const ctx = this.ctx;
    const ids = Object.keys(AUDIO_MANIFEST.sfx);
    const out = {};
    await Promise.all(
      ids.map(async (id) => {
        try {
          const b = await recorded.blob(AUDIO_MANIFEST.sfx[id]);
          if (!b) return;
          const buf = await ctx.decodeAudioData(await b.arrayBuffer());
          out[id] = this._prepRec(buf);
        } catch {
          // format non pris en charge : le son de synthèse reste utilisé
        }
      }),
    );
    if (!Object.keys(out).length) return;
    this.recSfx = out;
    this._applyRecSfx();
  }

  // Retire le silence initial et normalise le niveau (les sons viennent d'auteurs différents)
  _prepRec(buf) {
    const nc = buf.numberOfChannels;
    const n = buf.length;
    const data = [];
    for (let c = 0; c < nc; c++) data.push(buf.getChannelData(c));
    let start = 0;
    let peak = 0;
    search: for (let i = 0; i < n; i++) {
      for (let c = 0; c < nc; c++) {
        if (Math.abs(data[c][i]) > 0.012) {
          start = i;
          break search;
        }
      }
    }
    for (let c = 0; c < nc; c++) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[c][i]));
    start = Math.max(0, start - Math.floor(buf.sampleRate * 0.004));
    if (start > buf.sampleRate * 0.4) start = 0;
    const g = peak > 0 ? Math.min(3, 0.89 / peak) : 1;
    const out = this.ctx.createBuffer(nc, Math.max(1, n - start), buf.sampleRate);
    for (let c = 0; c < nc; c++) {
      const src = data[c].subarray(start);
      const dst = out.getChannelData(c);
      for (let i = 0; i < src.length; i++) dst[i] = src[i] * g;
    }
    return out;
  }

  _applyRecSfx() {
    if (!this.recSfx || !this._procVariants) return;
    this.sfxVariants = { ...this._procVariants };
    for (const [name, spec] of Object.entries(REC_VARIANTS)) {
      const rec = spec.ids.map((id) => this.recSfx[id]).filter(Boolean);
      if (!rec.length) continue;
      this.sfxVariants[name] = spec.mix ? [...rec, ...(this._procVariants[name] || [])] : rec;
    }
  }

  // Joue un bruitage enregistré précis (voix du chevalier, fanfare…)
  _rec(id, { gain = 1, rate = 1, delay = 0, out = null } = {}) {
    const buf = this.recSfx && this.recSfx[id];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.97 + Math.random() * 0.06) * (this.slow ? 0.78 : 1);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out || this.sfxBus);
    src.start(this.ctx.currentTime + delay);
    return true;
  }

  // ---------- Musiques enregistrées ----------
  _initRecMusic() {
    const ctx = this.ctx;
    if (typeof ctx.createMediaElementSource !== 'function' || typeof Audio === 'undefined') return;
    try {
      const mk = () => {
        const el = new Audio();
        el.loop = true;
        el.preload = 'auto';
        const src = ctx.createMediaElementSource(el);
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g).connect(this.recBus);
        return { el, g };
      };
      this.recMusic = { decks: [mk(), mk()], cur: -1, track: null, want: null, rate: 1, pos: {}, urls: {}, combatT: 0, calmT: 99, last: 0, retryAt: 0 };
    } catch {
      this.recMusic = null;
    }
  }

  _useRecordedMusic() {
    return !!(this.recMusic && settings.get('musicSource') !== 'composed' && recorded.hasMusic && recorded.canPlayMusic());
  }

  async _trackUrl(id) {
    const R = this.recMusic;
    if (R.urls[id]) return R.urls[id];
    const path = AUDIO_MANIFEST.music[id];
    if (!path) return null;
    const b = await recorded.blob(path);
    if (!b) return null;
    R.urls[id] = URL.createObjectURL(b);
    return R.urls[id];
  }

  // Choix de la piste : ambiance de la zone, combat (après quelques secondes) ou boss
  _updateRecMusic(now, it) {
    const R = this.recMusic;
    const dt = Math.min(0.5, Math.max(0, now - (R.last || now)));
    R.last = now;
    if (it === 1) {
      R.combatT += dt;
      R.calmT = 0;
    } else {
      R.calmT += dt;
      R.combatT = 0;
    }
    let want = REC_TRACKS[this.moodName] || REC_TRACKS.graveyard;
    if (this.moodName !== 'title' && this.moodName !== 'hub') {
      if (it >= 2) want = ['boss', 1];
      else if (it === 1 && R.combatT > 1.2) want = ['battle', 1];
      else if (R.track === 'battle' && R.calmT < 7) want = ['battle', 1];
    }
    if (want[0] !== R.want && now >= R.retryAt) this._switchTrack(want[0], want[1]);
  }

  async _switchTrack(id, rate = 1) {
    const R = this.recMusic;
    R.want = id;
    const url = await this._trackUrl(id);
    if (!url || R.want !== id) return;
    const next = R.cur === 0 ? 1 : 0;
    const deck = R.decks[next];
    const prev = R.cur >= 0 ? R.decks[R.cur] : null;
    if (prev && R.track) R.pos[R.track] = prev.el.currentTime;
    deck.el.src = url;
    deck.el.preservesPitch = false;
    deck.el.mozPreservesPitch = false;
    deck.el.webkitPreservesPitch = false;
    deck.el.playbackRate = rate * (this.slow ? 0.8 : 1);
    try {
      // Les combats et les boss repartent du début ; les ambiances reprennent où elles en étaient
      deck.el.currentTime = id === 'battle' || id === 'boss' ? 0 : R.pos[id] || 0;
    } catch {
      /* position non encore disponible */
    }
    try {
      await deck.el.play();
    } catch {
      // lecture refusée (pas encore d'interaction) : nouvel essai un peu plus tard
      R.want = null;
      R.retryAt = this.ctx.currentTime + 1;
      return;
    }
    if (R.want !== id) {
      deck.el.pause();
      return;
    }
    const t = this.ctx.currentTime;
    const fast = id === 'boss' || id === 'battle';
    deck.g.gain.cancelScheduledValues(t);
    deck.g.gain.setTargetAtTime(1, t, fast ? 0.35 : 1.1);
    if (prev) {
      prev.g.gain.cancelScheduledValues(t);
      prev.g.gain.setTargetAtTime(0, t, fast ? 0.5 : 1.2);
      const old = prev.el;
      setTimeout(() => {
        if (R.decks[R.cur].el !== old) old.pause();
      }, 6000);
    }
    R.cur = next;
    R.track = id;
    R.rate = rate;
  }

  _stopRecMusic() {
    const R = this.recMusic;
    if (!R || R.cur < 0) return;
    const t = this.ctx.currentTime;
    for (const d of R.decks) d.g.gain.setTargetAtTime(0, t, 0.8);
    const decks = R.decks.map((d) => d.el);
    setTimeout(() => decks.forEach((el) => el.pause()), 4000);
    if (R.track) R.pos[R.track] = R.decks[R.cur].el.currentTime;
    R.cur = -1;
    R.track = null;
    R.want = null;
  }

  // Rendu hors ligne de la musique d'une zone (tests, aperçu) → AudioBuffer stéréo
  static async renderPreview(mood, seconds = 20, intensity = 0, rate = 44100) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(seconds * rate), rate);
    const sys = new AudioSys();
    sys._build(ctx);
    sys.setMood(mood);
    sys.targetIntensity = intensity;
    sys.layerExplore.gain.value = intensity >= 2 ? 0.25 : intensity === 1 ? 0.55 : 1;
    sys.layerCombat.gain.value = intensity >= 1 ? 1 : 0;
    sys.layerBoss.gain.value = intensity >= 2 ? 1 : 0;
    sys.ambTarget = { wind: 0, rumble: 0, crackle: 0, water: 0 };
    const bpm = sys.mood.bpm * (intensity >= 2 ? 1.18 : intensity === 1 ? 1.08 : 1);
    const sd = 60 / bpm / 2;
    for (let st = 0, t = 0.1; t < seconds - 1; st++, t += sd) sys._playStep(t, st, sd);
    return ctx.startRendering();
  }

  // Décode la banque installée en AudioBuffers ; à défaut, la génère à la volée (qualité légère)
  _loadBank() {
    const bank = soundbank.data;
    if (!bank) {
      if (this._bankPending) return;
      this._bankPending = true;
      soundbank.render('low').then((b) => {
        soundbank.load(b);
        this._bankPending = false;
        this._loadBank();
      });
      return;
    }
    const ctx = this.ctx;
    this.buffers = {};
    this.roots = {};
    for (const [key, s] of Object.entries(bank.samples)) {
      const n = s.data.length;
      const buf = ctx.createBuffer(1, n, bank.rate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = s.data[i] / 32767;
      this.buffers[key] = buf;
      if (key.includes('@')) {
        const [inst] = key.split('@');
        (this.roots[inst] = this.roots[inst] || []).push({ root: s.root, buf, sustain: s.sustain });
      }
    }
    for (const k in this.roots) this.roots[k].sort((a, b) => a.root - b.root);
    this.sfxVariants = {};
    for (const key of Object.keys(this.buffers)) {
      if (!key.startsWith('sfx:')) continue;
      const name = key.split(':')[1];
      (this.sfxVariants[name] = this.sfxVariants[name] || []).push(this.buffers[key]);
    }
    this._procVariants = { ...this.sfxVariants };
    this._applyRecSfx();
    this.ready = true;
  }

  _impulse(dur, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const n = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      // Premières réflexions + queue diffuse
      for (let i = 0; i < n; i++) {
        const t = i / n;
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < rate * 0.08 ? 0.5 + 0.5 * Math.random() : 1);
      }
      for (let k = 1; k <= 6; k++) {
        const at = Math.floor(rate * (0.012 * k + c * 0.004 + Math.random() * 0.01));
        if (at < n) ch[at] += (Math.random() < 0.5 ? -1 : 1) * (0.9 - k * 0.1);
      }
    }
    return buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.get('master'), t, 0.05);
    this.sfxBus.gain.setTargetAtTime(settings.get('sfx'), t, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.get('music') * 1.25 * (this.mood.soft || 1), t, 0.05);
    this.ambBus.gain.setTargetAtTime(settings.get('ambience') * 0.6, t, 0.05);
    this.reverbGain.gain.setTargetAtTime(0.5 * (settings.get('reverb') ?? 0.8), t, 0.1);
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Temps des Ombres : son étouffé et plus grave
  setSlowmo(on) {
    this.slow = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.slowFilter.frequency.setTargetAtTime(on ? 900 : 20000, t, on ? 0.05 : 0.3);
    this.musicSend.gain.setTargetAtTime(on ? 1.1 : 0.55, t, 0.2);
    const R = this.recMusic;
    if (R && R.cur >= 0) R.decks[R.cur].el.playbackRate = R.rate * (on ? 0.8 : 1);
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
    this.wind = mk('bandpass', 380, 0.8);
    this.windHowl = mk('bandpass', 700, 9);
    this.rumble = mk('lowpass', 90, 0.8);
    this.crackle = mk('highpass', 2500, 0.5);
    this.water = mk('bandpass', 1200, 2);
    this.ambTarget = { wind: 0.25, rumble: 0.1, crackle: 0, water: 0 };
  }

  setAmbience(a) {
    this.ambTarget = Object.assign({ wind: 0.2, rumble: 0.1, crackle: 0, water: 0 }, a);
  }

  // ---------- Musique ----------
  setMood(name) {
    if (!MOODS[name]) name = 'graveyard';
    if (name === this.moodName) return;
    this.moodName = name;
    this.mood = MOODS[name];
    this._melody = null;
    this.step = 0;
    this._voicing = null;
    if (this.ctx) {
      this._nextStep = Math.max(this._nextStep, this.ctx.currentTime + 0.4);
      this.applyVolumes();
    }
  }

  setIntensity(level) {
    this.targetIntensity = level;
  }

  // Mélodie de la zone : thème principal ou phrase de 8 mesures générée (reproductible)
  _getMelody() {
    if (this._melody) return this._melody;
    const m = this.mood;
    const beats = m.beats;
    let notes;
    if (m.melody === 'leit') notes = LEITMOTIF.notes;
    else {
      const r = seeded(this.moodName);
      const rhythms = beats === 3 ? [[2, 1], [1, 1, 1], [3], [1, 2]] : [[2, 2], [1, 1, 2], [3, 1], [2, 1, 1], [4], [1, 1, 1, 1]];
      notes = [];
      let deg = 4;
      for (let bar = 0; bar < 8; bar++) {
        const chord = CHORDS[m.prog[bar]] || CHORDS.i;
        const rh = bar === 7 ? [beats] : rhythms[Math.floor(r() * rhythms.length)];
        rh.forEach((dur, k) => {
          if (bar === 7) deg = 0;
          else if (k === 0) {
            // Temps fort : note de l'accord la plus proche de la précédente
            const sc = SCALES[m.scale];
            let best = deg;
            let bd = 99;
            for (let d = -3; d <= 9; d++) {
              const semi = sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
              if (chord.some((c) => (c - semi) % 12 === 0) && Math.abs(d - deg) < bd) {
                bd = Math.abs(d - deg);
                best = d;
              }
            }
            deg = best;
          } else deg += r() < 0.5 ? -1 : 1;
          deg = Math.max(-2, Math.min(9, deg));
          notes.push([deg, dur]);
        });
      }
    }
    // Conversion en temps (en croches)
    const out = [];
    let pos = 0;
    for (const [deg, dur] of notes) {
      out.push({ at: pos, deg, len: dur * 2 });
      pos += dur * 2;
    }
    this._melody = { notes: out, len: pos };
    return this._melody;
  }

  _degToMidi(deg, octave) {
    const m = this.mood;
    const sc = SCALES[m.scale];
    const o = Math.floor(deg / 7);
    const i = ((deg % 7) + 7) % 7;
    return m.key + sc[i] + 12 * (o + octave);
  }

  // Voicing d'accord proche du précédent (conduite des voix)
  _voice(chordName, center) {
    const c = CHORDS[chordName] || CHORDS.i;
    const key = this.mood.key;
    let best = null;
    let bd = 1e9;
    for (let inv = 0; inv < c.length; inv++) {
      for (let oct = -1; oct <= 1; oct++) {
        const v = c.map((s, i) => key + s + 12 * (oct + (i < inv ? 1 : 0)));
        const avg = v.reduce((a, b) => a + b, 0) / v.length;
        let d = Math.abs(avg - center) * 2;
        if (this._voicing) for (let i = 0; i < Math.min(v.length, this._voicing.length); i++) d += Math.abs(v[i] - this._voicing[i]);
        if (d < bd) {
          bd = d;
          best = v;
        }
      }
    }
    this._voicing = best;
    return best;
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const it = this.targetIntensity;
    this.layerExplore.gain.setTargetAtTime(it >= 2 ? 0.25 : it === 1 ? 0.55 : 1, now, 1.2);
    this.layerCombat.gain.setTargetAtTime(it >= 1 ? 1 : 0, now, it >= 1 ? 0.5 : 2.5);
    this.layerBoss.gain.setTargetAtTime(it >= 2 ? 1 : 0, now, it >= 2 ? 0.4 : 2.5);
    // Vent et ambiance
    const a = this.ambTarget;
    const wob = 0.6 + 0.4 * Math.sin(now * 0.23) * Math.sin(now * 0.071);
    this.wind.g.gain.setTargetAtTime(a.wind * wob, now, 0.8);
    this.wind.f.frequency.setTargetAtTime(260 + 260 * wob, now, 0.8);
    this.windHowl.g.gain.setTargetAtTime(a.wind * 0.35 * Math.max(0, wob - 0.55), now, 1.2);
    this.windHowl.f.frequency.setTargetAtTime(500 + 500 * Math.sin(now * 0.13), now, 1);
    this.rumble.g.gain.setTargetAtTime(a.rumble, now, 1);
    this.crackle.g.gain.setTargetAtTime(a.crackle * (Math.random() < 0.3 ? 1.6 : 0.4), now, 0.03);
    this.water.g.gain.setTargetAtTime(a.water * (0.5 + Math.random() * 0.5), now, 0.2);
    this._ambOneShots(now);
    if (this._useRecordedMusic()) {
      this._updateRecMusic(now, it);
      this.layerExplore.gain.setTargetAtTime(0, now, 0.8);
      this.layerCombat.gain.setTargetAtTime(0, now, 0.8);
      this.layerBoss.gain.setTargetAtTime(0, now, 0.8);
      this._nextStep = now + 0.3;
      return;
    }
    if (this.recMusic && this.recMusic.cur >= 0) this._stopRecMusic();
    if (!this.ready) return;
    // Pas de croche ; le combat et les boss accélèrent légèrement le tempo
    const bpm = this.mood.bpm * (it >= 2 ? 1.18 : it === 1 ? 1.08 : 1);
    const stepDur = 60 / bpm / 2;
    while (this._nextStep < now + 0.35) {
      this._playStep(this._nextStep, this.step, stepDur);
      this._nextStep += stepDur;
      this.step++;
    }
  }

  _ambOneShots(now) {
    const list = AMB_ONESHOTS[this.moodName];
    if (!list || !this.ready || this.moodName === 'title') return;
    for (const [name, chance] of list) {
      if (Math.random() < chance * 0.06) {
        const pan = Math.random() * 1.6 - 0.8;
        if (name === 'bellFar') this._note('bell', this.mood.key + 12, now, 5, 0.12, this.ambBus, { pan });
        else this._sample(name, { dest: this.ambBus, gain: 0.25 + Math.random() * 0.2, rate: 0.9 + Math.random() * 0.2, pan, delay: Math.random() * 0.2 });
      }
    }
  }

  _playStep(t, step, sd) {
    const m = this.mood;
    const spb = m.beats * 2; // croches par mesure
    const bar = Math.floor(step / spb);
    const inBar = step % spb;
    const cycle = Math.floor(bar / 8);
    const chordName = m.prog[bar % 8];
    const barDur = sd * spb;
    const expl = this.layerExplore;
    const soft = m.soft || 1;
    // ----- Exploration -----
    if (inBar === 0) {
      const v = this._voice(chordName, m.key + 12);
      for (const n of v) this._note(m.pad, n, t, barDur * 1.05, 0.2 * soft, expl, { attack: 0.4, release: 0.8, pan: 0 });
      if (m.pad2) for (const n of v.slice(0, 2)) this._note(m.pad2, n + (m.pad2 === 'drone' ? -12 : 12), t, barDur * 1.05, 0.12 * soft, expl, { attack: 0.8, release: 1 });
      if (m.bass) this._note(m.bass, m.key - 12 + ((CHORDS[chordName] || CHORDS.i)[0] % 12), t, barDur, 0.28 * soft, expl, { attack: 0.2, release: 0.6, pan: 0.15 });
      if (bar % 4 === 0 && Math.random() < m.bells) this._note('bell', m.key + 12 + (CHORDS[chordName] || [0])[0], t, 6, 0.16, expl, { pan: -0.3 });
    }
    // Arpège (harpe, luth, boîte à musique…)
    if (m.arp && this._voicing) {
      const pat = m.beats === 3 ? [0, 1, 2, 1, 2, 1] : [0, 1, 2, 3, 2, 1, 2, 1];
      const k = pat[inBar % pat.length];
      const v = this._voicing;
      const note = v[k % v.length] + (k >= v.length ? 12 : 0) + (m.arp === 'musicBox' ? 24 : 12);
      if (!m.arpSparse || inBar % 2 === 0 || Math.random() < 0.25) {
        const vel = (inBar === 0 ? 0.3 : 0.2) * soft * (m.arpSparse ? 0.9 : 1);
        this._note(m.arp, note, t, sd * (m.arp === 'spiccato' ? 1 : 3), vel, expl, { pan: -0.35, rate: m.eerie ? 1 + (Math.random() - 0.5) * 0.012 : 1 });
      }
    }
    // Mélodie (thème) : un cycle sur `melEvery`
    if (m.mel && cycle % (m.melEvery || 1) === 0) {
      const mel = this._getMelody();
      const pos = (step - cycle * 8 * spb) % mel.len;
      for (const n of mel.notes) {
        if (n.at !== pos) continue;
        const inst = m.mel2 && cycle % 2 === 1 ? m.mel2 : m.mel;
        const oct = inst === 'musicBox' ? 2 : inst === 'cello' ? 0 : 1;
        this._note(inst, this._degToMidi(n.deg, oct), t, sd * n.len * 0.98, 0.32 * soft, expl, { attack: inst === 'cello' || inst === 'strings' ? 0.12 : 0.02, release: 0.5, pan: 0.25 });
      }
    }
    if (m.drums && inBar % (m.beats === 3 ? 6 : 4) === 0) this._note('taiko', 36, t, 1.2, 0.35, expl);
    // ----- Combat : cordes piquées, timbales, cuivres -----
    if (this.targetIntensity >= 1 || this.layerCombat.gain.value > 0.02) {
      const root = m.key - 12 + ((CHORDS[chordName] || CHORDS.i)[0] % 12);
      const pat = m.beats === 3 ? [0, 12, 7, 12, 7, 12] : [0, 0, 12, 0, 7, 0, 12, 7];
      this._note('spiccato', root + pat[inBar % pat.length], t, sd * 0.9, 0.3, this.layerCombat, { pan: 0.3 });
      if (inBar === 0 || (m.beats === 4 && inBar === 4)) this._note('timpani', 41 + (((CHORDS[chordName] || [0])[0] + m.key - 41) % 12 + 12) % 12 - (inBar === 0 ? 0 : 5), t, 1.8, 0.5, this.layerCombat);
      if (inBar === spb - 1 && bar % 2 === 1) this._note('timpani', 41, t, 1, 0.3, this.layerCombat);
      if (inBar === 0 && bar % 2 === 0) for (const n of (this._voicing || []).slice(0, 2)) this._note('brass', n - 12, t, sd * 3, 0.22, this.layerCombat, { attack: 0.05, release: 0.3 });
    }
    // ----- Boss : chœur scandé, tambours, orgue, cymbales, thème aux cuivres -----
    if (this.targetIntensity >= 2 || this.layerBoss.gain.value > 0.02) {
      const B = this.layerBoss;
      if (inBar % 2 === 0) this._note('taiko', 36, t, 1.2, inBar === 0 ? 0.6 : 0.35, B);
      if (inBar === spb - 2) this._note('taiko', 36, t + sd * 0.5, 1.2, 0.3, B);
      if (inBar % (m.beats === 3 ? 3 : 2) === 0 && this._voicing) {
        const v = this._voicing;
        for (const n of v) this._note('choirAh', n + 12, t, sd * 1.6, 0.16, B, { attack: 0.03, release: 0.25 });
      }
      if (inBar === 0) {
        for (const n of this._voicing || []) this._note('organ', n, t, barDur, 0.12, B, { attack: 0.05, release: 0.4 });
        this._note('brass', m.key - 12 + ((CHORDS[chordName] || [0])[0] % 12), t, barDur * 0.9, 0.3, B, { attack: 0.05, release: 0.4 });
        if (bar % 4 === 0) this._note('cymbal', 60, t, 3, 0.25, B);
      }
      // Thème principal aux cuivres (un cycle sur deux), étiré sur la mesure de la zone
      if (cycle % 2 === 1) {
        const pos = step % (8 * spb);
        const k = spb / 6;
        let at = 0;
        for (const [deg, dur] of LEITMOTIF.notes) {
          if (Math.round(at * k) === pos) this._note('brass', this._degToMidi(deg, 1), t, sd * dur * 2 * k * 0.95, 0.24, B, { attack: 0.04, release: 0.3 });
          at += dur * 2;
        }
      }
    }
  }

  _pan(val, dest) {
    if (!val || !this.ctx.createStereoPanner) return dest;
    const key = val.toFixed(2) + (dest === this.layerExplore ? 'e' : dest === this.layerCombat ? 'c' : dest === this.layerBoss ? 'b' : dest === this.ambBus ? 'a' : 's');
    let p = this.pans[key];
    if (!p) {
      p = this.pans[key] = this.ctx.createStereoPanner();
      p.pan.value = val;
      p.connect(dest);
    }
    return p;
  }

  // Joue une note d'instrument (échantillon le plus proche transposé). Les instruments
  // pincés/frappés résonnent naturellement ; les instruments tenus enchaînent des segments
  // en fondu croisé pour les notes plus longues que l'échantillon.
  _note(inst, midi, t, dur, vel, dest, opts = {}) {
    const list = this.roots[inst];
    if (!list || !list.length) return;
    let s = list[0];
    for (const x of list) if (Math.abs(x.root - midi) < Math.abs(s.root - midi)) s = x;
    const ctx = this.ctx;
    const rate = Math.pow(2, (midi - s.root) / 12) * (opts.rate || 1);
    const bufDur = s.buf.duration;
    const attack = opts.attack ?? 0.008;
    const out = this._pan(opts.pan || 0, dest);
    if (!s.sustain) {
      const src = ctx.createBufferSource();
      src.buffer = s.buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + attack);
      src.connect(g).connect(out);
      src.start(t);
      if (opts.cut) {
        g.gain.setValueAtTime(vel, t + dur);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
        src.stop(t + dur + 0.1);
      } else src.stop(t + bufDur / rate + 0.02);
      return;
    }
    const release = opts.release ?? 0.5;
    const xf = 0.4;
    const tail = 0.9; // fin de l'échantillon (relâchement intégré) à éviter
    let st = t;
    let rem = dur;
    let first = true;
    for (let guard = 0; rem > 0.01 && guard < 12; guard++) {
      const off = first ? 0 : 0.6;
      const seg = Math.max(0.8, (bufDur - tail - off) / rate - 0.1);
      const len = Math.min(rem, seg);
      const last = rem <= seg;
      const r = last ? release : xf;
      const src = ctx.createBufferSource();
      src.buffer = s.buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      const a = first ? attack : xf;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vel, st + a);
      g.gain.setValueAtTime(vel, Math.max(st + a, st + len));
      g.gain.linearRampToValueAtTime(0, st + len + r);
      src.connect(g).connect(out);
      src.start(st, off);
      src.stop(st + len + r + 0.05);
      st += len;
      rem -= len;
      first = false;
    }
  }

  // Joue une variante d'un bruitage de la banque
  _sample(name, { dest = this.sfxBus, gain = 1, rate = 1, pan = 0, delay = 0, out = null } = {}) {
    const vars = this.sfxVariants && this.sfxVariants[name];
    if (!vars || !vars.length) return;
    const buf = vars[Math.floor(Math.random() * vars.length)];
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (0.95 + Math.random() * 0.1) * (this.slow ? 0.78 : 1);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out || this._pan(pan, dest));
    src.start(ctx.currentTime + delay);
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
    if (att <= 0) return null;
    g.gain.value = att * att;
    let node = g;
    // Les sons lointains perdent leurs aigus
    if (d > 12) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = clamp(18000 - d * 350, 1500, 18000);
      g.connect(lp);
      node = lp;
    }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const ang = Math.atan2(dx, dz) - this.listener.yaw;
      p.pan.value = clamp(-Math.sin(ang) * 0.8, -1, 1);
      node.connect(p).connect(this.sfxBus);
    } else node.connect(this.sfxBus);
    return g;
  }

  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.ready) return;
    const fn = SFX_MAP[name];
    if (!fn) return;
    const out = this._out(opts.pos, opts.range || 45);
    if (!out) return;
    fn.call(this, out, opts);
  }
}

// Associations nom de bruitage → échantillons de la banque (avec variations)
const SFX_MAP = {
  swing(out, o) {
    this._sample((o.weight || 1) > 1.3 ? 'swingHeavy' : 'swing', { out, gain: 0.55, rate: 1.05 / Math.sqrt(o.weight || 1) });
  },
  hit(out, o) {
    const k = o.kind || 'flesh';
    const name = k === 'metal' ? 'hitMetal' : k === 'bone' ? 'hitBone' : k === 'spirit' ? 'hitSpirit' : 'hitFlesh';
    this._sample(name, { out, gain: 0.8 });
    if (k === 'metal' || k === 'bone') this._sample('hitFlesh', { out, gain: 0.35, rate: 0.8 });
    if (o.crit) this._sample('slam', { out, gain: 0.35, rate: 1.4 });
  },
  block(out) {
    this._sample('block', { out, gain: 0.8 });
  },
  parry(out) {
    this._sample('parry', { out, gain: 0.9 });
  },
  step(out, o) {
    const s = o.surface;
    const name = s === 'stone' || s === 'tiles' || s === 'cobble' ? 'stepStone' : s === 'snow' ? 'stepSnow' : s === 'water' || s === 'mud' ? 'stepWater' : 'stepDirt';
    this._sample(name, { out, gain: o.sprint ? 0.35 : 0.25 });
    if (o.heavy) this._sample('armor', { out, gain: 0.12 });
  },
  roll(out) {
    this._sample('roll', { out, gain: 0.55 });
    this._sample('armor', { out, gain: 0.15, delay: 0.2 });
  },
  jump(out) {
    this._sample('dash', { out, gain: 0.18, rate: 0.7 });
  },
  land(out, o) {
    this._sample('land', { out, gain: o.heavy ? 0.9 : 0.55 });
  },
  drink(out) {
    this._sample('drink', { out, gain: 0.6 });
  },
  cast(out, o) {
    const e = o.element || 'arcane';
    const map = { fire: 'fire', frost: 'frost', lightning: 'lightning', holy: 'holy', shadow: 'shadow', poison: 'poison', blood: 'shadow' };
    this._sample(map[e] || 'arcane', { out, gain: 0.7 });
  },
  explosion(out, o) {
    this._sample('explosion', { out, gain: o.big ? 0.95 : 0.7, rate: o.big ? 0.85 : 1 });
  },
  slam(out) {
    this._sample('slam', { out, gain: 0.95 });
    this._sample('crack', { out, gain: 0.4, delay: 0.05 });
  },
  shoot(out, o) {
    if (o.kind === 'arrow') {
      if (!this._rec('arrow', { out, gain: 0.55 })) this._sample('dash', { out, gain: 0.35, rate: 1.6 });
    }
    else this._sample('arcane', { out, gain: 0.45 });
  },
  growl(out, o) {
    this._sample('growl', { out, gain: 0.55, rate: o.pitch || 1 });
  },
  screech(out, o) {
    this._sample(Math.random() < 0.5 ? 'screech' : 'wail', { out, gain: 0.5, rate: o.pitch || 1 });
  },
  roar(out) {
    this._sample('roar', { out, gain: 0.95 });
  },
  enemyDie(out, o) {
    this._sample(o.kind === 'spirit' ? 'wail' : 'die', { out, gain: 0.55, rate: o.kind === 'spirit' ? 1.3 : 1 });
  },
  playerHurt(out) {
    this._sample('hitFlesh', { out, gain: 0.8, rate: 0.85 });
    this._sample('armor', { out, gain: 0.25 });
    if (Math.random() < 0.7) this._rec('playerHurt', { out, gain: 0.5, rate: 0.95 + Math.random() * 0.1 });
  },
  death(out) {
    this._rec('playerDie', { gain: 0.7 });
    const k = this.mood.key;
    const t = this.t;
    this._note('bell', k, t, 6, 0.4, this.sfxBus);
    for (const [s, d] of [[0, 0.3], [3, 0.6], [7, 0.9]]) this._note('choirOo', k + 12 + s, t + d, 3.5, 0.18, this.sfxBus, { attack: 0.5, release: 1.2 });
    this._note('cello', k - 12, t, 4, 0.3, this.sfxBus, { attack: 0.3, release: 1 });
  },
  levelUp(out) {
    const t = this.t;
    const rec = this._rec('levelUp', { gain: 0.75 });
    [0, 4, 7, 12, 16].forEach((s, i) => this._note('harp', 62 + s, t + i * 0.08, 1.5, rec ? 0.18 : 0.35, this.sfxBus));
    for (const s of [0, 4, 7]) this._note('choirAh', 74 + s, t + 0.35, 2.2, 0.18, this.sfxBus, { attack: 0.2, release: 0.8 });
    this._note('bell', 62, t + 0.35, 4, 0.25, this.sfxBus);
  },
  pickup(out) {
    this._sample('pickup', { out, gain: 0.45 });
  },
  shards(out) {
    const t = this.t;
    for (let i = 0; i < 3; i++) this._note('musicBox', 84 + [0, 7, 12][i], t + i * 0.05, 0.6, 0.12, this.sfxBus);
  },
  uiHover() {
    this._sample('uiHover', { gain: 0.25 });
  },
  uiClick() {
    this._sample('uiClick', { gain: 0.45 });
  },
  uiBack() {
    this._sample('uiBack', { gain: 0.35 });
  },
  uiError() {
    this._sample('uiError', { gain: 0.3 });
  },
  buy(out) {
    if (!this._rec('coins', { out, gain: 0.6 })) this._sample('pickup', { out, gain: 0.5 });
    this._sample('armor', { out, gain: 0.3, delay: 0.05 });
  },
  forge(out) {
    for (let i = 0; i < 3; i++) this._sample('hitMetal', { out, gain: 0.6, delay: i * 0.25 });
    this._rec('heavyItem', { out, gain: 0.5, delay: 0.8 });
  },
  altar(out) {
    const t = this.t;
    for (const s of [0, 7, 12]) this._note('choirOo', 57 + s, t, 3, 0.2, this.sfxBus, { attack: 0.6, release: 1.2 });
    this._note('harp', 69, t + 0.2, 2, 0.3, this.sfxBus);
    this._sample('fire', { out, gain: 0.35 });
  },
  portal(out) {
    this._sample('portal', { out, gain: 0.7 });
  },
  quest(out) {
    const t = this.t;
    [0, 5, 7, 12].forEach((s, i) => this._note('harp', 64 + s, t + i * 0.1, 1.5, 0.35, this.sfxBus));
  },
  victory(out) {
    const t = this.t;
    const k = 50;
    this._note('timpani', 41, t, 2, 0.7, this.sfxBus);
    this._note('cymbal', 60, t, 3, 0.35, this.sfxBus);
    for (const s of [0, 7, 12, 16]) this._note('brass', k + s, t, 2.5, 0.28, this.sfxBus, { attack: 0.05, release: 0.8 });
    for (const s of [12, 16, 19]) this._note('choirAh', k + s, t + 0.1, 3, 0.2, this.sfxBus, { attack: 0.2, release: 1 });
    this._note('bell', k + 12, t + 0.2, 5, 0.3, this.sfxBus);
  },
  fogwall(out) {
    this._sample('fogwall', { out, gain: 0.6 });
  },
  chest(out) {
    this._sample('chestOpen', { out, gain: 0.6 });
    const t = this.t;
    [0, 4, 7, 11].forEach((s, i) => this._note('musicBox', 84 + s, t + 0.3 + i * 0.08, 1, 0.18, this.sfxBus));
  },
  heartbeat(out) {
    this._sample('heartbeat', { out, gain: 0.8 });
  },
  stun(out) {
    const t = this.t;
    for (let i = 0; i < 4; i++) this._note('musicBox', 88 + (i % 2) * 3, t + i * 0.07, 0.3, 0.1, this.sfxBus);
  },
  perfectDodge() {
    this._sample('perfectDodge', { gain: 0.8, rate: 1 });
  },
  charge(out, o) {
    const vars = this.sfxVariants && this.sfxVariants.charge;
    if (!vars) return;
    const buf = vars[Math.min(vars.length - 1, Math.max(0, (o.level || 1) - 1))];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.55;
    src.connect(g).connect(out);
    src.start();
  },
  art(out) {
    this._sample('art', { out, gain: 0.75 });
    this._rec('warcry', { out, gain: 0.45 });
  },
  dash(out) {
    this._sample('dash', { out, gain: 0.55 });
  },
  slide(out) {
    this._sample('slide', { out, gain: 0.55 });
  },
  doubleJump(out) {
    this._sample('doubleJump', { out, gain: 0.55 });
  },
  sneakOn() {
    this._sample('roll', { gain: 0.15, rate: 1.4 });
  },
  sneakOff() {
    this._sample('roll', { gain: 0.12, rate: 1.6 });
  },
};

export const audio = new AudioSys();
