// Profil de l'appareil : mémoire vive, processeur graphique, cœurs, stockage, puis un court
// test de performance. On en déduit un palier de qualité et un budget mémoire pour que le jeu
// reste stable (textures, ombres, nombre d'ennemis, qualité audio…).
import * as THREE from 'three';
import { native, storage } from './storage.js';
import { isMobile, clamp } from './utils.js';

const KEY = 'cdo_device_v1';

export const TIERS = ['low', 'medium', 'high', 'ultra'];
export const TIER_LABEL = { low: 'Faible', medium: 'Moyen', high: 'Élevé', ultra: 'Ultra' };

// Réglages recommandés par palier
export const TIER_REC = {
  low: { preset: 'low', charTexture: 512, worldTexture: 256, maxEnemies: 10, fxQuality: 'low', audioQuality: 'low', distortion: true, afterimages: true, maxDpr: 1.5 },
  medium: { preset: 'medium', charTexture: 1024, worldTexture: 512, maxEnemies: 16, fxQuality: 'medium', audioQuality: 'medium', distortion: true, afterimages: true, maxDpr: 2 },
  high: { preset: 'high', charTexture: 1024, worldTexture: 512, maxEnemies: 24, fxQuality: 'high', audioQuality: 'high', distortion: true, afterimages: true, maxDpr: 2 },
  ultra: { preset: 'ultra', charTexture: 2048, worldTexture: 1024, maxEnemies: 32, fxQuality: 'high', audioQuality: 'high', distortion: true, afterimages: true, maxDpr: 2.5 },
};

function gpuInfo() {
  const out = { renderer: '', vendor: '', maxTex: 4096, webgl2: false };
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    out.webgl2 = !!gl;
    const g = gl || c.getContext('webgl');
    if (!g) return out;
    const ext = g.getExtension('WEBGL_debug_renderer_info');
    out.renderer = String(ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER));
    out.vendor = String(ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR));
    out.maxTex = g.getParameter(g.MAX_TEXTURE_SIZE) || 4096;
    const lose = g.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch {
    /* ignore */
  }
  return out;
}

// Estimation de la mémoire vive (Go) : le pont Android donne la valeur exacte
function ramInfo() {
  const info = native.deviceInfo();
  if (info && info.ramGb) return { gb: info.ramGb, source: 'système', model: info.model || '' };
  if (navigator.deviceMemory) return { gb: navigator.deviceMemory, source: 'arrondie par le navigateur', model: '' };
  const pm = performance.memory;
  if (pm && pm.jsHeapSizeLimit) return { gb: clamp((pm.jsHeapSizeLimit / 1073741824) * 2, 1, 16), source: 'estimation', model: '' };
  return { gb: isMobile ? 3 : 8, source: 'supposée', model: '' };
}

// Palier « a priori » d'après le nom du GPU (utilisé si le test de performance est impossible)
function gpuTierGuess(name) {
  if (/SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(name)) return 0;
  const adreno = name.match(/Adreno[^\d]*(\d{3})/i);
  if (adreno) {
    const n = +adreno[1];
    return n >= 730 ? 3 : n >= 640 ? 2 : n >= 610 ? 1 : 0;
  }
  const mali = name.match(/Mali-G(\d+)/i);
  if (mali) {
    const n = +mali[1];
    return n >= 710 ? 2 : n >= 57 ? 1 : 0;
  }
  if (/Mali-T|PowerVR|SGX/i.test(name)) return 0;
  if (/Apple/i.test(name)) return 2;
  if (/NVIDIA|GeForce|RTX|Radeon|AMD/i.test(name)) return 3;
  if (/Intel/i.test(name)) return 2;
  return isMobile ? 1 : 2;
}

// Mini test CPU : bruit pseudo-aléatoire (représentatif de la génération procédurale)
function cpuBench() {
  const t0 = performance.now();
  let acc = 0;
  let n = 0;
  while (performance.now() - t0 < 60) {
    for (let i = 0; i < 20000; i++) {
      const x = Math.sin(i * 12.9898 + acc) * 43758.5453;
      acc += x - Math.floor(x);
    }
    n += 20000;
  }
  return n / (performance.now() - t0) / 1000; // millions d'opérations / s (approx.)
}

// Mini test GPU : shader lourd rendu dans une cible 256×256, synchronisé par une lecture de pixel
function gpuBench(renderer) {
  if (!renderer) return null;
  const size = 256;
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false });
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform float t; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vUv * 8.0 + t; float a = 0.0;
        for (int i = 0; i < 48; i++) { a += h(p + float(i)) * 0.02; p = p * 1.07 + a; }
        gl_FragColor = vec4(vec3(fract(a)), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const px = new Uint8Array(4);
  const prev = renderer.getRenderTarget();
  let score = null;
  try {
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam); // compilation
    renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    const t0 = performance.now();
    let frames = 0;
    while (frames < 40 && performance.now() - t0 < 400) {
      mat.uniforms.t.value = frames;
      renderer.render(scene, cam);
      frames++;
      if (frames % 4 === 0) renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    }
    renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
    const ms = Math.max(0.5, performance.now() - t0);
    score = (size * size * frames * 48) / ms / 1000; // millions d'itérations shader / s
  } catch {
    score = null;
  }
  renderer.setRenderTarget(prev);
  rt.dispose();
  mat.dispose();
  quad.geometry.dispose();
  return score;
}

function tierFromRam(gb) {
  return gb < 2.5 ? 0 : gb < 4.5 ? 1 : gb < 7 ? 2 : 3;
}
function tierFromGpuScore(s) {
  // Repères : rendu logiciel ≈ 50–150 ; mobile d'entrée de gamme ≈ 1 000 ; milieu ≈ 4 000 ; haut ≈ 12 000+
  return s < 600 ? 0 : s < 2500 ? 1 : s < 9000 ? 2 : 3;
}

class Device {
  constructor() {
    this.profile = storage.getJSON(KEY);
    this.lost = false;
  }

  get tier() {
    return (this.profile && this.profile.tier) || (isMobile ? 'medium' : 'high');
  }
  get rec() {
    return TIER_REC[this.tier];
  }
  get budgetMb() {
    return (this.profile && this.profile.budgetMb) || (isMobile ? 384 : 1024);
  }

  // Analyse complète (avec tests de performance si un moteur de rendu est fourni)
  analyze(renderer = null) {
    const ram = ramInfo();
    const gpu = gpuInfo();
    const cores = navigator.hardwareConcurrency || 4;
    const cpu = cpuBench();
    const gpuScore = gpuBench(renderer);
    const screenPx = Math.round(window.screen.width * window.screen.height * Math.min(3, window.devicePixelRatio || 1) ** 2);
    const tr = tierFromRam(ram.gb);
    const guess = gpuTierGuess(gpu.renderer);
    const tg = gpuScore != null ? Math.max(tierFromGpuScore(gpuScore), guess === 3 ? 2 : 0) : guess;
    let t = Math.min(tr, tg);
    if (cores <= 2) t = Math.min(t, 0);
    else if (cores <= 4) t = Math.min(t, 1);
    if (!gpu.webgl2) t = 0;
    // Budget pour les ressources graphiques et audio : une fraction de la mémoire vive
    const frac = isMobile ? 0.12 : 0.2;
    const budgetMb = Math.round(clamp(ram.gb * 1024 * frac, 160, 1536));
    this.profile = {
      date: Date.now(),
      ramGb: Math.round(ram.gb * 10) / 10,
      ramSource: ram.source,
      model: ram.model,
      cores,
      gpu: gpu.renderer || 'inconnu',
      maxTex: gpu.maxTex,
      webgl2: gpu.webgl2,
      mobile: isMobile,
      screenPx,
      cpuScore: Math.round(cpu * 10) / 10,
      gpuScore: gpuScore != null ? Math.round(gpuScore) : null,
      tier: TIERS[t],
      budgetMb,
    };
    storage.setJSON(KEY, this.profile);
    return this.profile;
  }

  ensure(renderer) {
    if (!this.profile) this.analyze(renderer);
    return this.profile;
  }

  // Estimation de la mémoire graphique utilisée (Mo) : cibles de rendu, textures suivies,
  // géométries de la scène et ombres
  estimateUsage(game) {
    const r = game.renderer;
    let mb = 0;
    if (r.size) {
      const px = r.size.w * r.size.h;
      mb += (px * (r.hdr ? 8 : 4) * 1.6) / 1048576; // scène + halo
      mb += (px * 4) / 1048576; // tampon d'écran
    }
    const sm = game.moon && game.moon.castShadow ? game.moon.shadow.mapSize.x : 0;
    mb += (sm * sm * 4) / 1048576;
    mb += textureRegistry.totalMb();
    mb += game._geoMb || 0;
    return Math.round(mb);
  }

  storageEstimate() {
    if (!navigator.storage || !navigator.storage.estimate) return Promise.resolve(null);
    return navigator.storage.estimate().then(
      (e) => ({ usageMb: Math.round((e.usage || 0) / 1048576), quotaMb: Math.round((e.quota || 0) / 1048576) }),
      () => null,
    );
  }
}

// Suivi approximatif de la mémoire occupée par les textures chargées
export const textureRegistry = {
  items: new Map(),
  add(key, w, h, mips = true) {
    this.items.set(key, (w * h * 4 * (mips ? 1.33 : 1)) / 1048576);
  },
  remove(key) {
    this.items.delete(key);
  },
  totalMb() {
    let t = 0;
    for (const v of this.items.values()) t += v;
    return t;
  },
};

export const device = new Device();
