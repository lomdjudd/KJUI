import * as THREE from 'three';
import { makeCanvas, mulberry32 } from '../engine/utils.js';

// Dimensions d'une tuile de façade : 8 colonnes x 8 étages.
export const FACADE_TILE_W = 25.6; // mètres couverts horizontalement
export const FACADE_TILE_H = 28.8; // mètres couverts verticalement

function tex(canvas, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function noise(ctx, w, h, amount, rng, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(rng() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
  }
}

// Styles de façade : chaque style produit une texture couleur + une texture de fenêtres éclairées.
const FACADES = [
  {
    // 0 : brique
    wall: '#8a4b3a',
    wall2: '#7a3f30',
    frame: '#d8cfc0',
    glass: ['#2a3441', '#34414f', '#1e2731'],
    win: { x: 0.24, y: 0.22, w: 0.52, h: 0.56 },
    brick: true,
  },
  {
    // 1 : pierre beige art déco
    wall: '#c9b99a',
    wall2: '#b9a988',
    frame: '#8d7f66',
    glass: ['#3b4a5a', '#2f3b48', '#46576a'],
    win: { x: 0.2, y: 0.18, w: 0.6, h: 0.64 },
    pilasters: true,
  },
  {
    // 2 : verre bleu (gratte-ciel)
    wall: '#5f7f9e',
    wall2: '#56748f',
    frame: '#b7c7d6',
    glass: ['#4d7aa6', '#5b8bb8', '#3f6c96', '#6f9cc6'],
    win: { x: 0.03, y: 0.04, w: 0.94, h: 0.92 },
    curtain: true,
  },
  {
    // 3 : verre sombre / acier
    wall: '#232a33',
    wall2: '#1b2129',
    frame: '#5a6573',
    glass: ['#1d2b3a', '#26384b', '#15202c'],
    win: { x: 0.05, y: 0.1, w: 0.9, h: 0.8 },
    curtain: true,
  },
  {
    // 4 : béton gris
    wall: '#9a9a96',
    wall2: '#8c8c88',
    frame: '#6e6e6a',
    glass: ['#2c3440', '#384250', '#232a33'],
    win: { x: 0.18, y: 0.25, w: 0.64, h: 0.5 },
  },
];

export const FACADE_COUNT = FACADES.length;

export function makeFacadeTextures(styleIndex, seed = 1) {
  const s = FACADES[styleIndex];
  const rng = mulberry32(seed * 977 + styleIndex * 131);
  const W = 512;
  const H = 512;
  const cols = 8;
  const rows = 8;
  const cw = W / cols;
  const ch = H / rows;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const e = makeCanvas(W, H);
  const ectx = e.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);

  ctx.fillStyle = s.wall;
  ctx.fillRect(0, 0, W, H);

  if (s.brick) {
    for (let y = 0; y < H; y += 6) {
      const off = (y / 6) % 2 ? 6 : 0;
      for (let x = -12; x < W; x += 12) {
        const v = rng();
        ctx.fillStyle = v < 0.5 ? s.wall : v < 0.8 ? s.wall2 : '#95533f';
        ctx.fillRect(x + off, y, 11, 5);
      }
    }
  }
  if (s.pilasters) {
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = s.wall2;
      ctx.fillRect(i * cw, 0, 6, H);
    }
    for (let j = 0; j < rows; j++) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, j * ch + ch - 5, W, 5);
    }
  }
  noise(ctx, W, H, 4000, rng);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + s.win.x * cw;
      const y = j * ch + s.win.y * ch;
      const w = s.win.w * cw;
      const h = s.win.h * ch;
      // Cadre
      ctx.fillStyle = s.frame;
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      // Vitre avec dégradé (reflet du ciel)
      const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
      const base = s.glass[Math.floor(rng() * s.glass.length)];
      g.addColorStop(0, lighten(base, 0.25));
      g.addColorStop(0.5, base);
      g.addColorStop(1, lighten(base, -0.2));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Montants
      ctx.fillStyle = s.frame;
      if (s.curtain) {
        ctx.fillRect(x + w / 2 - 1, y, 2, h);
      } else {
        ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
        ctx.fillRect(x, y + h * 0.45, w, 3);
      }
      // Stores / rideaux
      if (!s.curtain && rng() < 0.3) {
        ctx.fillStyle = `rgba(${200 + rng() * 55},${180 + rng() * 60},${140 + rng() * 60},0.55)`;
        ctx.fillRect(x, y, w, h * (0.2 + rng() * 0.5));
      }
      // Fenêtres éclairées la nuit
      if (rng() < 0.42) {
        const warm = rng();
        ectx.fillStyle = warm < 0.7 ? `rgb(255,${200 + rng() * 40},${120 + rng() * 60})` : 'rgb(200,225,255)';
        ectx.globalAlpha = 0.55 + rng() * 0.45;
        ectx.fillRect(x, y, w, h);
        ectx.globalAlpha = 1;
      }
    }
  }
  if (s.curtain) {
    // Bandeaux horizontaux entre étages
    ctx.fillStyle = s.frame;
    for (let j = 0; j < rows; j++) ctx.fillRect(0, j * ch, W, 3);
  }

  return { map: tex(c), emissive: tex(e) };
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt > 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function makeRoofTexture() {
  const rng = mulberry32(42);
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5b5b58';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 6000, rng, 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  return tex(c);
}

// Tuile de sol : un pâté de maisons entouré de rues (se répète sur toute la ville).
export function makeGroundTexture(pitch, street) {
  const S = 1024;
  const m = S / pitch; // pixels par mètre
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const rng = mulberry32(7);
  const half = (street / 2) * m;
  // Asphalte
  ctx.fillStyle = '#2d2f33';
  ctx.fillRect(0, 0, S, S);
  noise(ctx, S, S, 20000, rng, 0.07);
  // Trottoir (bloc)
  const sw = 4.5 * m;
  ctx.fillStyle = '#8f8e8a';
  ctx.fillRect(half, half, S - 2 * half, S - 2 * half);
  // Dalles
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let p = half; p < S - half; p += 1.5 * m) {
    ctx.beginPath();
    ctx.moveTo(p, half);
    ctx.lineTo(p, half + sw);
    ctx.moveTo(p, S - half - sw);
    ctx.lineTo(p, S - half);
    ctx.moveTo(half, p);
    ctx.lineTo(half + sw, p);
    ctx.moveTo(S - half - sw, p);
    ctx.lineTo(S - half, p);
    ctx.stroke();
  }
  // Bordure de trottoir
  ctx.strokeStyle = '#b5b3ad';
  ctx.lineWidth = 0.35 * m;
  ctx.strokeRect(half, half, S - 2 * half, S - 2 * half);
  // Intérieur du bloc (sous les immeubles)
  ctx.fillStyle = '#6f6e6a';
  ctx.fillRect(half + sw, half + sw, S - 2 * (half + sw), S - 2 * (half + sw));
  noise(ctx, S, S, 3000, rng, 0.05);

  // Lignes centrales pointillées (sur les bords de la tuile = milieu des rues)
  ctx.fillStyle = '#d9c24a';
  const dash = 3 * m;
  for (let p = half + 2 * m; p < S - half - 2 * m; p += dash * 2) {
    ctx.fillRect(p, -0.1 * m, dash, 0.3 * m);
    ctx.fillRect(p, S - 0.2 * m, dash, 0.3 * m);
    ctx.fillRect(-0.1 * m, p, 0.3 * m, dash);
    ctx.fillRect(S - 0.2 * m, p, 0.3 * m, dash);
  }
  // Lignes de voies blanches
  ctx.fillStyle = 'rgba(230,230,230,0.7)';
  for (let p = half + 2 * m; p < S - half - 2 * m; p += dash * 2.5) {
    const o = half * 0.5;
    ctx.fillRect(p, o, dash, 0.18 * m);
    ctx.fillRect(p, S - o, dash, 0.18 * m);
    ctx.fillRect(o, p, 0.18 * m, dash);
    ctx.fillRect(S - o, p, 0.18 * m, dash);
  }
  // Passages piétons aux coins
  ctx.fillStyle = 'rgba(235,235,235,0.85)';
  const cw = 0.6 * m;
  const cl = 3.2 * m;
  const gap = 1 * m;
  const starts = [half + gap, S - half - gap - cl];
  for (let p = cw * 0.5; p < half; p += cw * 2) {
    for (const a of starts) {
      // rues horizontales (haut et bas de la tuile)
      ctx.fillRect(a, p - cw * 0.5, cl, cw);
      ctx.fillRect(a, S - p - cw * 0.5, cl, cw);
      // rues verticales (gauche et droite)
      ctx.fillRect(p - cw * 0.5, a, cw, cl);
      ctx.fillRect(S - p - cw * 0.5, a, cw, cl);
    }
  }
  return tex(c, { aniso: 16 });
}

export function makeGrassTexture() {
  const rng = mulberry32(11);
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a7a36';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const g = 90 + rng() * 70;
    ctx.fillStyle = `rgba(${40 + rng() * 40},${g},${30 + rng() * 25},0.5)`;
    ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 2, 2 + rng() * 3);
  }
  return tex(c);
}

export function makeWaterNormal() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  // Somme de sinus périodiques => normal map tuilable
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * Math.PI * 2;
      const v = (y / S) * Math.PI * 2;
      const dx = Math.cos(u * 3 + v * 2) * 0.5 + Math.cos(u * 7 - v * 3) * 0.3 + Math.cos(u * 13 + v * 5) * 0.15;
      const dy = Math.cos(v * 4 + u) * 0.5 + Math.cos(v * 9 - u * 4) * 0.3 + Math.cos(v * 11 + u * 6) * 0.15;
      const i = (y * S + x) * 4;
      img.data[i] = 128 + dx * 60;
      img.data[i + 1] = 128 + dy * 60;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.3, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return tex(c, { repeat: false });
}

// Dégradé vertical (faisceaux lumineux de mission)
export function makeBeamTexture() {
  const c = makeCanvas(4, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return tex(c, { repeat: false });
}

export function makeSignTexture(text, color = '#e8f4ff', bg = 'rgba(0,0,0,0)') {
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.font = 'bold 170px Arial Black, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 135);
  return tex(c, { repeat: false });
}
