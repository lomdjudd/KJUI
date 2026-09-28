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

// Bruit fin pixel par pixel (grain) : plus doux que les petits rectangles
export function grain(ctx, w, h, rng, amount = 10) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Carte de normales à partir d'une carte de hauteur en niveaux de gris (bouclée)
export function normalFromHeight(hc, strength) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (y * w + x) * 4;
      d[o] = (-dx * inv * 0.5 + 0.5) * 255;
      d[o + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      d[o + 2] = (inv * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return tex(out, { srgb: false });
}

const gray = (v) => `rgb(${v},${v},${v})`;
// Rugosité (vert) et métal (bleu) dans une même texture
const rm = (rough, metal) => `rgb(255,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

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
    glass: ['#4a6f90', '#557c9c', '#3e6280', '#6589a6'],
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
  const layer = (fill) => {
    const cv = makeCanvas(W, H);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = fill;
    cx.fillRect(0, 0, W, H);
    return [cv, cx];
  };
  const [c, ctx] = layer(s.wall); // couleur
  const [e, ectx] = layer('#000'); // fenêtres éclairées la nuit
  const [hc, hctx] = layer(gray(128)); // relief
  const [r, rctx] = layer(rm(0.92, 0)); // rugosité / métal
  // rectangle sur plusieurs couches à la fois
  const rect = (x, y, w, h, { col, hgt, rough }) => {
    if (col) {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    }
    if (hgt !== undefined) {
      hctx.fillStyle = gray(hgt);
      hctx.fillRect(x, y, w, h);
    }
    if (rough) {
      rctx.fillStyle = rough;
      rctx.fillRect(x, y, w, h);
    }
  };

  if (s.brick) {
    hctx.fillStyle = gray(96);
    hctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) {
      const off = (y / 6) % 2 ? 6 : 0;
      for (let x = -12; x < W; x += 12) {
        const v = rng();
        ctx.fillStyle = v < 0.5 ? s.wall : v < 0.8 ? s.wall2 : '#95533f';
        ctx.fillRect(x + off, y, 11, 5);
        hctx.fillStyle = gray(128 + Math.floor(rng() * 12));
        hctx.fillRect(x + off, y, 11, 5);
      }
    }
  }
  if (s.pilasters) {
    for (let i = 0; i < cols; i++) rect(i * cw, 0, 6, H, { col: s.wall2, hgt: 175 });
    for (let j = 0; j < rows; j++) rect(0, j * ch + ch - 5, W, 5, { col: 'rgba(0,0,0,0.1)', hgt: 165 });
  }
  if (!s.curtain) {
    // Joints de dalles entre étages
    for (let j = 0; j < rows; j++) rect(0, j * ch + ch - 2, W, 1, { col: 'rgba(0,0,0,0.08)', hgt: 110 });
  }
  grain(ctx, W, H, rng, 9);

  // Fenêtres allumées : bureaux par étages entiers, logements au hasard
  const litFloor = [...Array(rows)].map(() => rng() < 0.3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + s.win.x * cw;
      const y = j * ch + s.win.y * ch;
      const w = s.win.w * cw;
      const h = s.win.h * ch;
      // Traînées de salissure sous l'appui
      if (!s.curtain) {
        const sg = ctx.createLinearGradient(0, y + h, 0, y + h + ch * 0.4);
        sg.addColorStop(0, 'rgba(20,16,12,0.14)');
        sg.addColorStop(1, 'rgba(20,16,12,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x + 2, y + h, w - 4, ch * 0.4);
      }
      // Cadre en saillie
      rect(x - 2, y - 2, w + 4, h + 4, { col: s.frame, hgt: 160, rough: rm(0.5, s.curtain ? 0.6 : 0) });
      // Vitre en retrait : reflet du ciel (clair en haut) et variation par vitre
      const base = s.glass[Math.floor(rng() * s.glass.length)];
      const g = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
      const var_ = (rng() - 0.5) * 0.18;
      g.addColorStop(0, lighten(base, 0.3 + var_));
      g.addColorStop(0.55, lighten(base, var_));
      g.addColorStop(1, lighten(base, -0.25 + var_));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      hctx.fillStyle = gray(40);
      hctx.fillRect(x, y, w, h);
      rctx.fillStyle = rm(0.06 + rng() * 0.06, s.curtain ? 0.45 : 0.15);
      rctx.fillRect(x, y, w, h);
      // Rideaux et stores (intérieur visible)
      if (!s.curtain) {
        const k = rng();
        if (k < 0.25) {
          ctx.fillStyle = `rgba(${200 + rng() * 55},${180 + rng() * 60},${140 + rng() * 60},0.5)`;
          ctx.fillRect(x, y, w, h * (0.2 + rng() * 0.5));
        } else if (k < 0.4) {
          ctx.fillStyle = 'rgba(225,220,205,0.35)';
          for (let yy = y; yy < y + h * (0.3 + rng() * 0.6); yy += 3) ctx.fillRect(x, yy, w, 1.5);
        }
      }
      // Ombre portée du linteau dans l'embrasure
      const depth = s.curtain ? 2 : 5;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x, y, w, depth);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, y, 2, h);
      // Montants
      if (s.curtain) {
        rect(x + w / 2 - 1, y, 2, h, { col: s.frame, hgt: 150, rough: rm(0.4, 0.7) });
      } else {
        rect(x + w / 2 - 1.5, y, 3, h, { col: s.frame, hgt: 150, rough: rm(0.5, 0) });
        rect(x, y + h * 0.45, w, 3, { col: s.frame, hgt: 150, rough: rm(0.5, 0) });
        // Appui de fenêtre clair
        rect(x - 4, y + h + 2, w + 8, 3, { col: lighten(s.frame, 0.25), hgt: 190, rough: rm(0.7, 0) });
      }
      // Éclairage nocturne
      const lit = s.curtain ? (litFloor[j] ? rng() < 0.85 : rng() < 0.07) : rng() < 0.3;
      if (lit) {
        const kind = rng();
        const bright = s.curtain ? 0.35 + rng() * 0.35 : 0.45 + rng() * 0.55;
        const col = s.curtain
          ? rng() < 0.7
            ? [235, 232, 220]
            : [205, 222, 255]
          : kind < 0.72
            ? [255, 196 + rng() * 40, 120 + rng() * 50]
            : kind < 0.9
              ? [255, 240, 215]
              : [150, 190, 255];
        const lg = ectx.createRadialGradient(x + w / 2, y + h * 0.25, 0, x + w / 2, y + h * 0.25, Math.max(w, h));
        lg.addColorStop(0, `rgba(${col[0]},${col[1] | 0},${col[2] | 0},${bright})`);
        lg.addColorStop(1, `rgba(${col[0]},${col[1] | 0},${col[2] | 0},${bright * 0.45})`);
        ectx.fillStyle = lg;
        ectx.fillRect(x, y, w, h);
        if (!s.curtain && rng() < 0.3) {
          // stores à moitié baissés
          ectx.fillStyle = 'rgba(0,0,0,0.55)';
          for (let yy = y; yy < y + h * (0.3 + rng() * 0.4); yy += 3) ectx.fillRect(x, yy, w, 1.5);
        }
        ectx.fillStyle = 'rgba(0,0,0,0.9)';
        if (s.curtain) ectx.fillRect(x + w / 2 - 1, y, 2, h);
        else {
          ectx.fillRect(x + w / 2 - 1.5, y, 3, h);
          ectx.fillRect(x, y + h * 0.45, w, 3);
        }
      }
    }
  }
  if (s.curtain) {
    // Bandeaux horizontaux entre étages
    for (let j = 0; j < rows; j++) rect(0, j * ch, W, 3, { col: s.frame, hgt: 170, rough: rm(0.35, 0.8) });
  }

  return { map: tex(c), emissive: tex(e), rough: tex(r, { srgb: false }), normal: normalFromHeight(hc, s.curtain ? 1.5 : 3) };
}

// Rez-de-chaussée : 4 variantes de devantures empilées (hauteur STORE_H chacune)
export const STORE_H = 4.4;
export const STORE_VARIANTS = 4;
const SHOP_SIGNS = ['#b3261e', '#1f5fa8', '#2a7d3b', '#d9a21b', '#6b2a86', '#1b1b1b', '#c2410c', '#0f766e'];
export function makeStorefrontTextures() {
  const rng = mulberry32(777);
  const W = 1024;
  const VH = 128;
  const H = VH * STORE_VARIANTS;
  const mk = (fill) => {
    const cv = makeCanvas(W, H);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = fill;
    cx.fillRect(0, 0, W, H);
    return [cv, cx];
  };
  const [c, ctx] = mk('#555');
  const [e, ectx] = mk('#000');
  const [r, rctx] = mk(rm(0.9, 0));
  const pxm = VH / STORE_H; // pixels par mètre (vertical)
  const ppm = W / FACADE_TILE_W; // pixels par mètre (horizontal)
  for (let vi = 0; vi < STORE_VARIANTS; vi++) {
    const top = (STORE_VARIANTS - 1 - vi) * VH; // v croissant vers le haut
    const Y = (m) => top + VH - m * pxm; // hauteur en mètres -> pixel
    const lobby = vi === 3;
    const wall = ['#6d6258', '#7a6f63', '#4b4f55', '#2b3037'][vi];
    ctx.fillStyle = wall;
    ctx.fillRect(0, top, W, VH);
    // Soubassement sombre
    ctx.fillStyle = '#2c2c2e';
    ctx.fillRect(0, Y(0.45), W, 0.45 * pxm);
    const bays = lobby ? 8 : 5;
    const bw = W / bays;
    for (let b = 0; b < bays; b++) {
      const x0 = b * bw + (lobby ? 3 : 0.35 * ppm);
      const x1 = (b + 1) * bw - (lobby ? 3 : 0.35 * ppm);
      const gTop = lobby ? 4.0 : 3.05;
      const gBot = lobby ? 0.05 : 0.5;
      const door = !lobby && rng() < 0.45;
      // Vitrine
      const g = ctx.createLinearGradient(0, Y(gTop), 0, Y(gBot));
      g.addColorStop(0, lobby ? '#5d7890' : '#6f8599');
      g.addColorStop(0.5, lobby ? '#2a3a4a' : '#34424f');
      g.addColorStop(1, '#1d242c');
      ctx.fillStyle = g;
      ctx.fillRect(x0, Y(gTop), x1 - x0, (gTop - gBot) * pxm);
      rctx.fillStyle = rm(0.06, lobby ? 0.5 : 0.1);
      rctx.fillRect(x0, Y(gTop), x1 - x0, (gTop - gBot) * pxm);
      // Intérieur : étagères, silhouettes
      if (!lobby) {
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = `rgba(${150 + rng() * 100},${120 + rng() * 100},${90 + rng() * 100},0.25)`;
          const sx = x0 + rng() * (x1 - x0 - 20);
          ctx.fillRect(sx, Y(0.6 + rng() * 1.8), 10 + rng() * 30, 4 + rng() * 10);
        }
      }
      // Montants métalliques
      ctx.fillStyle = lobby ? '#8c96a0' : '#1e1e1e';
      ctx.fillRect(x0 - 2, Y(gTop), 4, (gTop - gBot) * pxm);
      ctx.fillRect(x1 - 2, Y(gTop), 4, (gTop - gBot) * pxm);
      ctx.fillRect(x0, Y(gTop) - 2, x1 - x0, 4);
      if (lobby) ctx.fillRect(x0, Y(2.6), x1 - x0, 3);
      // Lumière des vitrines la nuit
      const warm = rng();
      const col = lobby ? '255,236,205' : warm < 0.6 ? '255,214,160' : warm < 0.85 ? '255,244,225' : '190,220,255';
      const lg = ectx.createLinearGradient(0, Y(gTop), 0, Y(gBot));
      lg.addColorStop(0, `rgba(${col},${lobby ? 0.42 : 0.9})`);
      lg.addColorStop(1, `rgba(${col},${lobby ? 0.18 : 0.4})`);
      ectx.fillStyle = lg;
      ectx.fillRect(x0, Y(gTop), x1 - x0, (gTop - gBot) * pxm);
      if (door) {
        const dx = x0 + (x1 - x0) * 0.62;
        const dw = 1.0 * ppm;
        ctx.fillStyle = '#15191e';
        ctx.fillRect(dx, Y(2.4), dw, 1.95 * pxm);
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(dx + dw - 6, Y(1.2), 3, 10);
        ectx.fillStyle = 'rgba(0,0,0,0.7)';
        ectx.fillRect(dx, Y(2.4), dw, 1.95 * pxm);
      }
      // Enseigne
      if (!lobby) {
        const sc = SHOP_SIGNS[Math.floor(rng() * SHOP_SIGNS.length)];
        ctx.fillStyle = sc;
        ctx.fillRect(x0, Y(3.95), x1 - x0, 0.7 * pxm);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const n = 4 + Math.floor(rng() * 5);
        const lw = ((x1 - x0) * 0.6) / n;
        for (let k = 0; k < n; k++) ctx.fillRect(x0 + (x1 - x0) * 0.2 + k * lw, Y(3.72), lw * 0.7, 0.25 * pxm);
        ectx.fillStyle = sc;
        ectx.globalAlpha = 0.7;
        ectx.fillRect(x0, Y(3.95), x1 - x0, 0.7 * pxm);
        ectx.globalAlpha = 1;
        ectx.fillStyle = 'rgba(255,255,255,0.95)';
        for (let k = 0; k < n; k++) ectx.fillRect(x0 + (x1 - x0) * 0.2 + k * lw, Y(3.72), lw * 0.7, 0.25 * pxm);
      }
    }
    // Bandeau supérieur
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, Y(STORE_H), W, 3);
  }
  grain(ctx, W, H, rng, 8);
  return { map: tex(c), emissive: tex(e), rough: tex(r, { srgb: false }) };
}

// Pierre claire des corniches et rebords (UV monde)
export function makeTrimTexture() {
  const rng = mulberry32(31);
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#b9b4aa';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) {
    const g = ctx.createRadialGradient(rng() * S, rng() * S, 0, rng() * S, rng() * S, 20 + rng() * 60);
    g.addColorStop(0, `rgba(${rng() < 0.5 ? '70,65,60' : '255,250,240'},0.07)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < S; x += 64) ctx.fillRect(x, 0, 1, S);
  grain(ctx, S, S, rng, 12);
  return tex(c);
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

// Toit : membrane goudronnée en lés, taches d'humidité, grain fin (tuile de 8 m)
export function makeRoofTexture() {
  const rng = mulberry32(42);
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#6b665f';
  ctx.fillRect(0, 0, S, S);
  // Taches (humidité, salissures) douces et bouclées
  for (let i = 0; i < 70; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const rad = 20 + rng() * 90;
    const dark = rng() < 0.6;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, dark ? 'rgba(35,30,25,0.16)' : 'rgba(215,208,195,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
  // Lés de membrane (tous les 2 m) avec recouvrement clair et ombre
  for (let y = 0; y < S; y += S / 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y, S, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, y + 2, S, 3);
  }
  grain(ctx, S, S, rng, 14);
  // Gravillons épars
  for (let i = 0; i < 2500; i++) {
    const v = 60 + rng() * 120;
    ctx.fillStyle = `rgba(${v},${v * 0.97},${v * 0.93},0.35)`;
    ctx.fillRect(rng() * S, rng() * S, 1, 1);
  }
  return tex(c);
}

// Tuile de sol : un pâté de maisons entouré de rues (se répète sur toute la ville).
export function makeGroundTexture(pitch, street) {
  const S = 1024;
  const m = S / pitch; // pixels par mètre
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const rng = mulberry32(7);
  const half = (street / 2) * m;
  // Asphalte : grain fin, rapiéçages et traces d'usure au milieu des voies
  ctx.fillStyle = '#2e3034';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = (1 + rng() * 5) * m;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rng() < 0.5 ? 'rgba(10,10,12,0.18)' : 'rgba(90,90,92,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let k = 0; k < 14; k++) {
    // rapiéçages rectangulaires
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '20,20,22' : '60,60,62'},0.25)`;
    const along = half + rng() * (S - 2 * half);
    const across = rng() * half * 0.9;
    const w = (2 + rng() * 5) * m;
    const h = (1 + rng() * 2) * m;
    if (k % 2) ctx.fillRect(along, across, w, h);
    else ctx.fillRect(across, along, h, w);
  }
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
  // Occlusion au pied des façades : le trottoir s'assombrit contre les immeubles
  const ao = 1.6 * m;
  const i0 = half + sw;
  const i1 = S - half - sw;
  for (const [x0, y0, x1, y1] of [
    [i0, i0 - ao, i0, i0],
    [i0, i1 + ao, i0, i1],
    [i0 - ao, i0, i0, i0],
    [i1 + ao, i0, i1, i0],
  ]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g;
    if (y0 !== y1) ctx.fillRect(i0 - ao, Math.min(y0, y1), i1 - i0 + 2 * ao, ao);
    else ctx.fillRect(Math.min(x0, x1), i0 - ao, ao, i1 - i0 + 2 * ao);
  }
  // Caniveau sombre le long de la bordure
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.5 * m;
  ctx.strokeRect(half - 0.45 * m, half - 0.45 * m, S - 2 * half + 0.9 * m, S - 2 * half + 0.9 * m);
  grain(ctx, S, S, rng, 12);

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
  const ctx = c.getContext('2d', { willReadFrequently: true });
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

// Police d'affichage (embarquée) ajustée pour que le texte tienne dans la largeur
function fitFont(ctx, text, maxW, maxSize) {
  let size = maxSize;
  ctx.font = `400 ${size}px "Bebas Neue", "Arial Black", Impact, sans-serif`;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.floor((size * maxW) / w);
    ctx.font = `400 ${size}px "Bebas Neue", "Arial Black", Impact, sans-serif`;
  }
  return size;
}

export function makeSignTexture(text, color = '#e8f4ff', bg = 'rgba(0,0,0,0)') {
  const c = makeCanvas(1024, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 256);
  fitFont(ctx, text, 960, 210);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 135);
  return tex(c, { repeat: false });
}

// Panneau publicitaire lumineux (texte néon sur fond coloré)
export function makeBillboardTexture(text, fg, bg, seed = 0) {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
  const rng = mulberry32(seed * 31 + 7);
  // motifs décoratifs
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(rng() * 512, rng() * 256, 20 + rng() * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 236);
  fitFont(ctx, text, 440, 130);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = fg;
  ctx.shadowBlur = 24;
  ctx.fillStyle = fg;
  ctx.fillText(text, 256, 138);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, 256, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Escalier de secours : garde-corps (moitié gauche) et marches (moitié droite), avec transparence
export function makeFireEscapeTexture() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const metal = '#2a2d2f';
  const rust = 'rgba(110,60,30,0.35)';
  ctx.fillStyle = metal;
  // Garde-corps : lisses haute/milieu/basse et barreaux
  const H = S / 2;
  ctx.fillRect(0, 0, H, 10);
  ctx.fillRect(0, S * 0.5 - 4, H, 6);
  ctx.fillRect(0, S - 10, H, 10);
  for (let x = 2; x < H; x += 10) ctx.fillRect(x, 0, 3, S);
  // Marches : limons sur les bords, marches horizontales
  ctx.fillRect(H, 0, 12, S);
  ctx.fillRect(S - 12, 0, 12, S);
  for (let y = 4; y < S; y += 20) ctx.fillRect(H, y, H, 7);
  // Rouille légère
  const rng = mulberry32(3);
  ctx.fillStyle = rust;
  for (let i = 0; i < 300; i++) ctx.fillRect(rng() * S, rng() * S, 2 + rng() * 4, 2 + rng() * 4);
  // Zone pleine (plancher) : coin en haut à gauche, 10 px
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
