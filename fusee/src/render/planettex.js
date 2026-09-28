// Textures des astres : vraies images pour la Terre et la Lune,
// génération procédurale (worker) pour les autres.

import * as THREE from 'three';
import GenWorker from './planetgen.worker.js?worker&inline';
import earthDayUrl from '../assets/textures/earth_day.jpg';
import earthNightUrl from '../assets/textures/earth_night.jpg';
import earthBrcUrl from '../assets/textures/earth_brc.jpg';
import moonUrl from '../assets/textures/moon.jpg';

const SIZES = {
  high: { planet: [2048, 1024], moon: [1024, 512], small: [512, 256], gas: [1024, 512] },
  medium: { planet: [1024, 512], moon: [1024, 512], small: [512, 256], gas: [1024, 512] },
  low: { planet: [1024, 512], moon: [512, 256], small: [256, 128], gas: [512, 256] },
};

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function imgTexture(img, srgb = true) {
  const t = new THREE.Texture(img);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export class PlanetTextures {
  constructor(sys, quality = 'medium') {
    this.sys = sys;
    this.q = SIZES[quality] || SIZES.medium;
    this.tex = new Map(); // id -> { color, normal, heights, hw, hh, colorData, w, h }
    this.waiting = new Map();
    this.queue = [];
    this.workers = [];
    this.busy = [];
    const n = Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) {
      try {
        const w = new GenWorker();
        w.onmessage = (e) => this.onResult(i, e.data);
        w.onerror = (e) => { console.warn('worker planètes', e.message); this.busy[i] = false; this.pump(); };
        this.workers.push(w);
        this.busy.push(false);
      } catch (e) {
        console.warn('Workers indisponibles', e);
      }
    }
    this.listeners = [];
  }

  // Charge les textures réelles de la Terre et de la Lune + données d'élévation
  async loadReal() {
    const [day, night, brc, moon] = await Promise.all([loadImage(earthDayUrl), loadImage(earthNightUrl), loadImage(earthBrcUrl), loadImage(moonUrl)]);
    // données CPU : élévation (R) et masque terre/mer (G)
    const W = brc.width, H = brc.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(brc, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const elev = new Uint8Array(W * H), land = new Uint8Array(W * H), clouds = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { elev[i] = d[i * 4]; land[i] = d[i * 4 + 1]; clouds[i] = d[i * 4 + 2]; }
    this.sys.home.ground.setEarthData(elev, land, W, H);
    // nuages : texture alpha
    const cc = document.createElement('canvas');
    cc.width = W;
    cc.height = H;
    const cctx = cc.getContext('2d');
    const img = cctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = clouds[i];
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = Math.min(255, Math.max(0, (v - 20) * 1.35));
    }
    cctx.putImageData(img, 0, 0);
    // couleur de jour réduite pour l'échantillonnage (terrain proche)
    const sw = 2048, sh = 1024;
    const sc = document.createElement('canvas');
    sc.width = sw;
    sc.height = sh;
    const sctx = sc.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(day, 0, 0, sw, sh);
    const colorData = sctx.getImageData(0, 0, sw, sh).data;
    const cloudTex = new THREE.CanvasTexture(cc);
    cloudTex.colorSpace = THREE.SRGBColorSpace;
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.anisotropy = 8;
    const brcTex = imgTexture(brc, false);
    this.tex.set('terre', { color: imgTexture(day), night: imgTexture(night), spec: brcTex, clouds: cloudTex, colorData, w: sw, h: sh, real: true });
    // Lune
    const mc = document.createElement('canvas');
    mc.width = moon.width;
    mc.height = moon.height;
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    mctx.drawImage(moon, 0, 0);
    this.tex.set('lune', { color: imgTexture(moon), colorData: mctx.getImageData(0, 0, moon.width, moon.height).data, w: moon.width, h: moon.height, real: true });
  }

  sizeFor(b) {
    if (b.type === 'gas') return this.q.gas;
    if (b.type === 'planet' || b.type === 'dwarf') return b.radius < 60e3 ? this.q.small : this.q.planet;
    if (b.radius < 30e3) return this.q.small;
    return this.q.moon;
  }

  // Demande la génération (prioritaire si urgent)
  request(id, urgent = false) {
    const b = this.sys.get(id);
    if (!b || b.type === 'star') return;
    if (this.tex.has(id) && (id !== 'venus' || this.tex.has('venus_nuages'))) return;
    const jobs = [];
    if (b.type === 'gas') jobs.push({ id, mode: 'gas' });
    else if (!this.tex.has(id)) jobs.push({ id, mode: 'surface' });
    if (id === 'venus' && !this.tex.has('venus_nuages')) jobs.push({ id: 'venus', mode: 'clouds', key: 'venus_nuages' });
    for (const j of jobs) {
      const key = j.key || j.id;
      if (this.waiting.has(key)) {
        if (urgent) { const i = this.queue.findIndex((q) => (q.key || q.id) === key); if (i > 0) this.queue.unshift(...this.queue.splice(i, 1)); }
        continue;
      }
      const [w, h] = j.mode === 'clouds' ? this.q.gas : this.sizeFor(b);
      const exag = b.radius < 30e3 ? 1.2 : b.radius < 100e3 ? 3 : 7;
      const job = { ...j, w, h, exag };
      this.waiting.set(key, true);
      if (urgent) this.queue.unshift(job); else this.queue.push(job);
    }
    this.pump();
  }

  requestAll() {
    const order = ['lune', 'mars', 'venus', 'jupiter', 'mercure', 'saturne', 'phobos', 'deimos', 'io', 'europe', 'ganymede', 'callisto', 'titan', 'encelade', 'ceres', 'uranus', 'neptune', 'titania', 'triton', 'pluton', 'charon', 'nyx'];
    for (const id of order) this.request(id);
  }

  pump() {
    for (let i = 0; i < this.workers.length; i++) {
      if (this.busy[i] || !this.queue.length) continue;
      const job = this.queue.shift();
      this.busy[i] = true;
      this.workers[i].postMessage(job);
    }
  }

  onResult(wi, d) {
    this.busy[wi] = false;
    const key = d.mode === 'clouds' ? 'venus_nuages' : d.id;
    this.waiting.delete(key);
    const color = new THREE.DataTexture(d.color, d.w, d.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    color.colorSpace = THREE.SRGBColorSpace;
    color.flipY = false;
    color.wrapS = THREE.RepeatWrapping;
    color.magFilter = THREE.LinearFilter;
    color.minFilter = THREE.LinearMipmapLinearFilter;
    color.generateMipmaps = true;
    color.anisotropy = 8;
    color.needsUpdate = true;
    const entry = { color, colorData: d.color, w: d.w, h: d.h };
    if (d.normal) {
      const n = new THREE.DataTexture(d.normal, d.w, d.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      n.flipY = false;
      n.wrapS = THREE.RepeatWrapping;
      n.magFilter = THREE.LinearFilter;
      n.minFilter = THREE.LinearMipmapLinearFilter;
      n.generateMipmaps = true;
      n.needsUpdate = true;
      entry.normal = n;
      entry.heights = d.heights;
      entry.hw = d.hw;
      entry.hh = d.hh;
    }
    this.tex.set(key, entry);
    for (const l of this.listeners) l(key, entry);
    this.pump();
  }

  get(id) {
    return this.tex.get(id);
  }

  onReady(fn) {
    this.listeners.push(fn);
  }

  // Couleur de surface (0..1, sRGB) pour une direction (repère du corps)
  sampleColor(id, lon, lat) {
    const t = this.tex.get(id);
    if (!t || !t.colorData) return null;
    // images réelles : ligne 0 = nord ; textures générées : ligne 0 = sud
    const u = (lon / (Math.PI * 2) + 0.5) * t.w;
    const v = t.real ? (0.5 - lat / Math.PI) * t.h : (lat / Math.PI + 0.5) * t.h;
    const x = ((Math.floor(u) % t.w) + t.w) % t.w;
    const y = Math.max(0, Math.min(t.h - 1, Math.floor(v)));
    const i = (y * t.w + x) * 4;
    const d = t.colorData;
    return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, d[i + 3] / 255];
  }
}
