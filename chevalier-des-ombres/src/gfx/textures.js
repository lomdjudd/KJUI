// Textures procédurales (aucune image externe) : couleur + normal map générée depuis
// une carte de hauteur. Toutes les textures sont raccordables (tileables) et mises en cache.
// L'installation des données les génère une fois en haute résolution et les conserve
// (WebP dans IndexedDB) : au lancement suivant elles sont simplement rechargées.
import * as THREE from 'three';
import { tileNoise, clamp, makeRng } from '../core/utils.js';
import { settings } from '../core/settings.js';
import { textureRegistry } from '../core/device.js';

const cache = new Map();
// Définitions : clé → { fn(u, v, out), strength }
const DEFS = new Map();
// Textures installées (ImageBitmap décodées) : clé → { map, normalMap }
const preloaded = new Map();
let installedSize = 0;

function texSize() {
  const base = installedSize || 256;
  return settings.get('textureQuality') === 'low' ? Math.max(128, base / 2) : base;
}

// Construit couleur + hauteur via une fonction par pixel (u, v dans [0,1[)
function generate(size, fn) {
  const col = new Uint8ClampedArray(size * size * 4);
  const hgt = new Float32Array(size * size);
  const out = { r: 0, g: 0, b: 0, h: 0 };
  for (let y = 0; y < size; y++) genRow(y, size, fn, col, hgt, out);
  return { col, hgt };
}

function genRow(y, size, fn, col, hgt, out) {
  for (let x = 0; x < size; x++) {
    fn(x / size, y / size, out);
    const i = y * size + x;
    col[i * 4] = out.r * 255;
    col[i * 4 + 1] = out.g * 255;
    col[i * 4 + 2] = out.b * 255;
    col[i * 4 + 3] = 255;
    hgt[i] = out.h;
  }
}

function normalFromHeight(hgt, size, strength) {
  const n = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = hgt[y * size + ((x - 1 + size) % size)];
      const r = hgt[y * size + ((x + 1) % size)];
      const u = hgt[((y - 1 + size) % size) * size + x];
      const d = hgt[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      n[i] = (nx * 0.5 + 0.5) * 255;
      n[i + 1] = (ny * 0.5 + 0.5) * 255;
      n[i + 2] = (nz * 0.5 + 0.5) * 255;
      n[i + 3] = 255;
    }
  }
  return n;
}

function setupTex(t, srgb) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function toTexture(data, size, srgb) {
  return setupTex(new THREE.DataTexture(data, size, size, THREE.RGBAFormat), srgb);
}

function build(key, fn, normalStrength = 3) {
  if (!DEFS.has(key)) DEFS.set(key, { fn, strength: normalStrength });
  if (cache.has(key)) return cache.get(key);
  if (listing) return null;
  if (preloaded.has(key)) {
    const res = preloaded.get(key);
    cache.set(key, res);
    return res;
  }
  const size = texSize();
  const { col, hgt } = generate(size, fn);
  const res = {
    map: toTexture(col, size, true),
    normalMap: toTexture(normalFromHeight(hgt, size, normalStrength * (size / 256)), size, false),
  };
  textureRegistry.add('w:' + key, size, size);
  textureRegistry.add('w:' + key + ':n', size, size);
  cache.set(key, res);
  return res;
}

// ----- API pour l'installation des données -----
let listing = false;
// Liste de toutes les textures du monde (chaque constructeur enregistre sa définition sans générer)
export function worldTextureKeys() {
  listing = true;
  try {
    Textures.stone(); Textures.tiles(); Textures.cobble(); Textures.rock(); Textures.bark(); Textures.wood();
    Textures.metal(); Textures.detail(); Textures.lava(); Textures.water(); Textures.ice();
    for (const k of ['dirt', 'grass', 'mud', 'snow', 'ash', 'void', 'sand']) Textures.ground(k);
  } finally {
    listing = false;
  }
  return [...DEFS.keys()];
}

// Génère une texture en rendant la main régulièrement (barre de progression fluide)
export async function generateWorldTexture(key, size, yieldFn) {
  const def = DEFS.get(key);
  const col = new Uint8ClampedArray(size * size * 4);
  const hgt = new Float32Array(size * size);
  const out = { r: 0, g: 0, b: 0, h: 0 };
  let t0 = performance.now();
  for (let y = 0; y < size; y++) {
    genRow(y, size, def.fn, col, hgt, out);
    if (performance.now() - t0 > 24) {
      await yieldFn(y / size);
      t0 = performance.now();
    }
  }
  const nrm = normalFromHeight(hgt, size, def.strength * (size / 256));
  return { col, nrm };
}

// Enregistre les textures installées (décodées) avant tout usage
export function setInstalledWorldTextures(size, entries) {
  installedSize = size;
  for (const [key, colBitmap, nrmBitmap] of entries) {
    const map = setupTex(new THREE.Texture(colBitmap), true);
    const normalMap = setupTex(new THREE.Texture(nrmBitmap), false);
    map.flipY = normalMap.flipY = false;
    textureRegistry.add('w:' + key, colBitmap.width, colBitmap.height);
    textureRegistry.add('w:' + key + ':n', nrmBitmap.width, nrmBitmap.height);
    preloaded.set(key, { map, normalMap });
  }
}

const mixc = (a, b, t) => a + (b - a) * t;

// Motif de blocs de pierre (murs du château)
function blocks(u, v, rows, cols, mortar, seed) {
  const ry = v * rows;
  const row = Math.floor(ry);
  const off = (row % 2) * 0.5;
  const rx = u * cols + off;
  const col = Math.floor(rx);
  const fx = rx - col;
  const fy = ry - row;
  const edge = Math.min(fx, 1 - fx, fy * (cols / rows), (1 - fy) * (cols / rows));
  const id = ((col % cols) + cols) % cols + row * 131 + seed;
  return { edge, id, fx, fy, inMortar: edge < mortar };
}

function hashId(id) {
  const r = makeRng(id * 7919 + 13);
  return r();
}

export const Textures = {
  stone() {
    return build('stone', (u, v, o) => {
      const b = blocks(u, v, 8, 4, 0.035, 1);
      const n = tileNoise(u, v, 8, 4, 3);
      const n2 = tileNoise(u, v, 32, 2, 9);
      const shade = 0.75 + hashId(b.id) * 0.35;
      const bevel = clamp(b.edge / 0.08, 0, 1);
      let h = b.inMortar ? 0.1 : 0.5 + bevel * 0.35 + n * 0.2 + n2 * 0.08;
      const base = b.inMortar ? 0.12 : (0.28 + n * 0.22 + n2 * 0.1) * shade;
      const moss = clamp((tileNoise(u, v, 4, 3, 21) - 0.55) * 4, 0, 1) * (1 - bevel * 0.5);
      o.r = mixc(base * 0.95, 0.12, moss * 0.6);
      o.g = mixc(base * 0.93, 0.2, moss * 0.6);
      o.b = mixc(base * 1.05, 0.1, moss * 0.6);
      o.h = h;
    }, 4);
  },
  // Dalles violettes des catacombes (cf. image de référence)
  tiles() {
    return build('tiles', (u, v, o) => {
      const cu = u * 4;
      const cv = v * 4;
      const fx = cu - Math.floor(cu);
      const fy = cv - Math.floor(cv);
      const id = Math.floor(cu) + Math.floor(cv) * 17;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      const grout = edge < 0.035;
      const n = tileNoise(u, v, 16, 4, 5);
      const crack = Math.abs(tileNoise(u, v, 6, 3, 44) - 0.5) < 0.015 ? 1 : 0;
      const shade = 0.75 + hashId(id) * 0.3;
      const bevel = clamp(edge / 0.07, 0, 1);
      const base = grout ? 0.08 : (0.5 + n * 0.35) * shade * (0.85 + bevel * 0.15) * (1 - crack * 0.5);
      o.r = base * 0.62;
      o.g = base * 0.32;
      o.b = base * 0.85;
      o.h = grout ? 0 : 0.55 + bevel * 0.3 + n * 0.15 - crack * 0.3;
    }, 5);
  },
  cobble() {
    return build('cobble', (u, v, o) => {
      // Pavés irréguliers (Voronoï simplifié)
      const cells = 6;
      const x = u * cells;
      const y = v * cells;
      let d1 = 9;
      let d2 = 9;
      let cid = 0;
      for (let j = -1; j <= 1; j++)
        for (let i = -1; i <= 1; i++) {
          const cx = Math.floor(x) + i;
          const cy = Math.floor(y) + j;
          const wx = ((cx % cells) + cells) % cells;
          const wy = ((cy % cells) + cells) % cells;
          const r = makeRng(wx * 97 + wy * 31 + 5);
          const px = cx + 0.2 + r() * 0.6;
          const py = cy + 0.2 + r() * 0.6;
          const d = Math.hypot(x - px, y - py);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            cid = wx * 97 + wy;
          } else if (d < d2) d2 = d;
        }
      const edge = d2 - d1;
      const n = tileNoise(u, v, 16, 3, 8);
      const shade = 0.7 + hashId(cid) * 0.4;
      const gap = edge < 0.08;
      const base = gap ? 0.07 : (0.25 + n * 0.2) * shade;
      o.r = base * 0.95;
      o.g = base * 0.92;
      o.b = base;
      o.h = gap ? 0 : clamp(edge * 3, 0, 0.6) + n * 0.3;
    }, 4);
  },
  ground(kind) {
    const pal = {
      dirt: [[0.26, 0.22, 0.19], [0.16, 0.2, 0.13]],
      grass: [[0.16, 0.2, 0.11], [0.09, 0.15, 0.08]],
      mud: [[0.2, 0.21, 0.13], [0.11, 0.16, 0.08]],
      snow: [[0.78, 0.82, 0.9], [0.6, 0.66, 0.78]],
      ash: [[0.2, 0.15, 0.13], [0.1, 0.08, 0.07]],
      void: [[0.15, 0.11, 0.22], [0.08, 0.06, 0.13]],
      sand: [[0.3, 0.25, 0.18], [0.2, 0.17, 0.13]],
    }[kind] || [[0.15, 0.13, 0.1], [0.1, 0.1, 0.08]];
    return build('ground_' + kind, (u, v, o) => {
      const n = tileNoise(u, v, 4, 5, 11);
      const n2 = tileNoise(u, v, 24, 3, 12);
      const pebble = tileNoise(u, v, 40, 2, 13);
      const t = clamp((n - 0.35) * 2, 0, 1);
      let r = mixc(pal[0][0], pal[1][0], t);
      let g = mixc(pal[0][1], pal[1][1], t);
      let b = mixc(pal[0][2], pal[1][2], t);
      const k = 0.8 + n2 * 0.4;
      r *= k;
      g *= k;
      b *= k;
      if (pebble > 0.72) {
        const p = (pebble - 0.72) * 3;
        r += p * 0.15;
        g += p * 0.15;
        b += p * 0.15;
      }
      if (kind === 'ash') {
        const crack = Math.abs(tileNoise(u, v, 5, 3, 77) - 0.5);
        if (crack < 0.02) {
          r = 1;
          g = 0.35;
          b = 0.05;
        }
      }
      if (kind === 'void') {
        const vein = Math.abs(tileNoise(u, v, 4, 4, 55) - 0.5);
        if (vein < 0.012) {
          r = 0.5;
          g = 0.2;
          b = 0.9;
        }
      }
      o.r = r;
      o.g = g;
      o.b = b;
      o.h = n * 0.6 + n2 * 0.3 + (pebble > 0.72 ? 0.2 : 0);
    }, 2.5);
  },
  rock() {
    return build('rock', (u, v, o) => {
      const n = tileNoise(u, v, 4, 5, 31);
      const strata = Math.sin((v * 12 + n * 4) * Math.PI) * 0.5 + 0.5;
      const n2 = tileNoise(u, v, 16, 3, 32);
      const base = 0.2 + n * 0.2 + strata * 0.08 + n2 * 0.08;
      o.r = base * 0.95;
      o.g = base * 0.92;
      o.b = base * 1.02;
      o.h = n * 0.7 + strata * 0.2 + n2 * 0.2;
    }, 4);
  },
  bark() {
    return build('bark', (u, v, o) => {
      const n = tileNoise(u * 4, v * 0.5, 4, 4, 41);
      const ridges = Math.abs(Math.sin((u * 18 + n * 3) * Math.PI));
      const base = 0.1 + ridges * 0.1 + n * 0.08;
      o.r = base * 1.1;
      o.g = base * 0.9;
      o.b = base * 0.75;
      o.h = ridges * 0.8 + n * 0.3;
    }, 5);
  },
  wood() {
    return build('wood', (u, v, o) => {
      const plank = Math.floor(u * 5);
      const fx = u * 5 - plank;
      const n = tileNoise(u, v * 0.25, 8, 3, 51 + plank);
      const grain = Math.sin((v * 40 + n * 6 + plank * 3) * Math.PI) * 0.5 + 0.5;
      const gap = fx < 0.03 || fx > 0.97;
      const base = gap ? 0.03 : 0.18 + grain * 0.08 + hashId(plank) * 0.06;
      o.r = base * 1.2;
      o.g = base * 0.85;
      o.b = base * 0.6;
      o.h = gap ? 0 : 0.5 + grain * 0.2;
    }, 3);
  },
  metal() {
    return build('metal', (u, v, o) => {
      const brushed = tileNoise(u * 0.2, v * 40, 8, 2, 61);
      const n = tileNoise(u, v, 8, 4, 62);
      const scratch = Math.abs(tileNoise(u, v, 12, 2, 63) - 0.5) < 0.01 ? 0.25 : 0;
      const base = 0.55 + brushed * 0.2 + n * 0.2 + scratch;
      o.r = base;
      o.g = base;
      o.b = base;
      o.h = brushed * 0.3 + n * 0.4 - scratch;
    }, 1.5);
  },
  // Détail neutre pour les personnages (martelé / usé), multiplié par les couleurs de sommets
  detail() {
    return build('detail', (u, v, o) => {
      const n = tileNoise(u, v, 8, 4, 71);
      const n2 = tileNoise(u, v, 32, 2, 72);
      const dent = tileNoise(u, v, 16, 2, 73);
      const base = 0.78 + n * 0.25 + n2 * 0.1 - (dent > 0.75 ? 0.08 : 0);
      o.r = o.g = o.b = clamp(base, 0, 1);
      o.h = n * 0.5 + n2 * 0.3 + (dent > 0.75 ? -0.2 : 0);
    }, 2);
  },
  lava() {
    return build('lava', (u, v, o) => {
      const n = tileNoise(u, v, 4, 5, 81);
      const cell = Math.abs(tileNoise(u, v, 6, 3, 82) - 0.5);
      const crust = clamp((cell - 0.05) * 6, 0, 1);
      o.r = mixc(1, 0.12, crust) * (0.8 + n * 0.4);
      o.g = mixc(0.35, 0.05, crust) * (0.8 + n * 0.3);
      o.b = mixc(0.04, 0.04, crust);
      o.h = crust * 0.8 + n * 0.2;
    }, 3);
  },
  water() {
    return build('water', (u, v, o) => {
      const n = tileNoise(u, v, 4, 4, 91);
      const n2 = tileNoise(u, v, 12, 3, 92);
      o.r = 0.5;
      o.g = 0.5;
      o.b = 1;
      o.h = n * 0.7 + n2 * 0.3;
    }, 2);
  },
  ice() {
    return build('ice', (u, v, o) => {
      const n = tileNoise(u, v, 4, 4, 101);
      const crack = Math.abs(tileNoise(u, v, 8, 3, 102) - 0.5) < 0.012 ? 1 : 0;
      const base = 0.55 + n * 0.3 + crack * 0.3;
      o.r = base * 0.75;
      o.g = base * 0.9;
      o.b = base * 1.1;
      o.h = n * 0.5 - crack * 0.4;
    }, 2);
  },
  // Texture de lueur ronde (sprites, halos)
  glow() {
    if (cache.has('glow')) return cache.get('glow');
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    cache.set('glow', t);
    return t;
  },
};
