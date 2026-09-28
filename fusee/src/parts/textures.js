// Textures procédurales (canvas) pour les matériaux des pièces.
// Les coordonnées UV des pièces sont exprimées en mètres : les motifs
// (soudures, rivets, tuiles) gardent la même échelle quelle que soit la taille.

import * as THREE from 'three';
import { Simplex3, mulberry32 } from '../core/noise.js';

const S = new Simplex3(4242);

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { repeat = 1, srgb = true, aniso = 8, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Convertit une carte de hauteur (Float32Array) en carte de normales
function heightToNormal(hgt, w, h, strength = 2, wrap = true) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); }
    return hgt[y * w + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function grayCanvas(vals, w, h, lo = 0, hi = 1) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, (lo + (hi - lo) * vals[i]) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// bruit périodique (tuile) : on échantillonne un tore dans l'espace 3D
function tileNoise(u, v, freq, oct = 4, seedOff = 0) {
  const a = u * Math.PI * 2, b = v * Math.PI * 2;
  const R = freq / (Math.PI * 2);
  const x = Math.cos(a) * R, y = Math.sin(a) * R;
  const z = Math.cos(b) * R + seedOff, w = Math.sin(b) * R;
  // approximation 3D : on mélange deux coupes
  return S.fbm(x + w * 0.7, y + seedOff, z, oct) * 0.7 + S.fbm(x * 0.5, y * 0.5 + w, z * 0.5 + 3, oct) * 0.3;
}

const cache = {};
function memo(k, f) {
  if (!cache[k]) cache[k] = f();
  return cache[k];
}

// ---------------------------------------------------------------------------
// Peinture : soudures horizontales, panneaux, rivets. Tuile = 2 m x 2 m.
export function panelTextures() {
  return memo('panel', () => {
    const W = 512;
    const hgt = new Float32Array(W * W);
    const rough = new Float32Array(W * W);
    const rnd = mulberry32(7);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      let h = 0;
      // soudures horizontales tous les 1 m
      const dv = Math.min(Math.abs(v - 0.5), Math.abs(v), Math.abs(v - 1)) * 2; // en m
      h -= Math.exp(-(dv * dv) / 0.00004) * 0.6;
      // joints verticaux faibles tous les 0,5 m
      const du = Math.abs(((u * 4) % 1) - 0.5) * 0.5;
      h -= Math.exp(-((0.25 - du) * (0.25 - du)) / 0.00002) * 0.15;
      // rivets le long des soudures
      const rx = (u * 64) % 1 - 0.5, ry = (dv * 64);
      if (dv < 0.03) h += Math.exp(-(rx * rx + (ry - 0.9) * (ry - 0.9)) / 0.03) * 0.25;
      h += tileNoise(u, v, 6, 3) * 0.04;
      hgt[y * W + x] = h;
      const streak = tileNoise(u, v * 0.15, 12, 3, 5) * 0.5 + 0.5;
      rough[y * W + x] = 0.55 + streak * 0.25 + (rnd() - 0.5) * 0.04;
    }
    return {
      normal: tex(heightToNormal(hgt, W, W, 3), { srgb: false, repeat: 0.5 }),
      rough: tex(grayCanvas(rough, W, W), { srgb: false, repeat: 0.5 }),
    };
  });
}

// Mousse isolante orange (réservoirs cryogéniques)
export function foamTextures() {
  return memo('foam', () => {
    const W = 512;
    const hgt = new Float32Array(W * W);
    const c = canvas(W);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      const n = tileNoise(u, v, 24, 5, 1);
      const n2 = tileNoise(u, v, 6, 3, 9);
      const dv = Math.min(Math.abs(v - 0.5), Math.abs(v), Math.abs(v - 1)) * 2;
      hgt[y * W + x] = n * 0.5 + n2 * 0.4 - Math.exp(-(dv * dv) / 0.0002) * 0.3;
      const i = (y * W + x) * 4;
      const k = 0.85 + n2 * 0.18 + n * 0.05;
      img.data[i] = Math.min(255, 205 * k);
      img.data[i + 1] = Math.min(255, 104 * k * (0.95 + n * 0.1));
      img.data[i + 2] = Math.min(255, 45 * k);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { repeat: 0.5 }), normal: tex(heightToNormal(hgt, W, W, 5), { srgb: false, repeat: 0.5 }) };
  });
}

// Inox : soudures, reflets brossés, et tuiles thermiques hexagonales noires
export function steelTextures() {
  return memo('steel', () => {
    const W = 512;
    const hgt = new Float32Array(W * W);
    const rough = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      const dv = Math.min(Math.abs(v - 0.5), Math.abs(v), Math.abs(v - 1)) * 2;
      let h = Math.exp(-(dv * dv) / 0.00003) * 0.5;
      h += tileNoise(u * 0.2, v, 40, 2, 3) * 0.03;
      h += tileNoise(u, v, 3, 3, 7) * 0.08;
      hgt[y * W + x] = h;
      rough[y * W + x] = 0.22 + tileNoise(u, v, 5, 3, 11) * 0.12 + Math.abs(tileNoise(u * 0.1, v, 60, 2, 2)) * 0.1;
    }
    return {
      normal: tex(heightToNormal(hgt, W, W, 2.5), { srgb: false, repeat: 0.5 }),
      rough: tex(grayCanvas(rough, W, W), { srgb: false, repeat: 0.5 }),
    };
  });
}

// Tuiles hexagonales (côté « au vent » d'un vaisseau en inox)
export function hexTileTextures() {
  return memo('hex', () => {
    const W = 512;
    const c = canvas(W);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16181b';
    ctx.fillRect(0, 0, W, W);
    const hgt = new Float32Array(W * W);
    const size = W / 8;
    const hexH = size * Math.sqrt(3) / 2;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      // distance au bord de l'hexagone le plus proche (grille décalée)
      const row = Math.floor(y / hexH);
      const ox = row % 2 ? size / 2 : 0;
      const cx = Math.round((x - ox) / size) * size + ox;
      const cy = (row + 0.5) * hexH;
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const edge = Math.max(dx * 0.866 + dy * 0.5, dy) / (size * 0.5);
      hgt[y * W + x] = edge > 0.92 ? -0.6 : 0.1 * S.noise(cx * 0.1, cy * 0.1, 3);
    }
    const img = ctx.getImageData(0, 0, W, W);
    for (let i = 0; i < W * W; i++) {
      const g = hgt[i] < -0.3 ? 8 : 26 + hgt[i] * 60;
      img.data[i * 4] = g; img.data[i * 4 + 1] = g + 1; img.data[i * 4 + 2] = g + 3;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { repeat: 0.5 }), normal: tex(heightToNormal(hgt, W, W, 0.08), { srgb: false, repeat: 0.5 }) };
  });
}

// Feuille d'or froissée (isolation multicouche)
export function foilTextures() {
  return memo('foil', () => {
    const W = 512;
    const hgt = new Float32Array(W * W);
    const rough = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      const r = S.ridged(u * 18 + 3, v * 18, 1.5, 4) ;
      const w = tileNoise(u, v, 10, 3, 4);
      hgt[y * W + x] = r * 0.6 + w * 0.5;
      rough[y * W + x] = 0.25 + r * 0.25;
    }
    return {
      normal: tex(heightToNormal(hgt, W, W, 6), { srgb: false, repeat: 1 }),
      rough: tex(grayCanvas(rough, W, W), { srgb: false, repeat: 1 }),
    };
  });
}

// Tissage de carbone
export function carbonTextures() {
  return memo('carbon', () => {
    const W = 256;
    const hgt = new Float32Array(W * W);
    const c = canvas(W);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, W);
    const N = 32;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const cx = Math.floor((x / W) * N), cy = Math.floor((y / W) * N);
      const fx = ((x / W) * N) % 1, fy = ((y / W) * N) % 1;
      const horiz = (cx + cy) % 2 === 0;
      const h = horiz ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      hgt[y * W + x] = h * 0.5;
      const i = (y * W + x) * 4;
      const g = 18 + h * 26;
      img.data[i] = g; img.data[i + 1] = g + 1; img.data[i + 2] = g + 3; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { repeat: 2 }), normal: tex(heightToNormal(hgt, W, W, 1.5), { srgb: false, repeat: 2 }) };
  });
}

// Tubes de refroidissement régénératif (tuyères) : lignes verticales fines
export function regenTextures() {
  return memo('regen', () => {
    const W = 512, H = 64;
    const hgt = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = ((x / W) * 96) % 1;
      hgt[y * W + x] = Math.sin(t * Math.PI) * 0.6;
    }
    const n = tex(heightToNormal(hgt, W, H, 2), { srgb: false });
    n.repeat.set(1, 1);
    return { normal: n };
  });
}

// Nid d'abeille ablatif (bouclier thermique)
export function honeycombTextures() {
  return memo('honey', () => {
    const W = 256;
    const hgt = new Float32Array(W * W);
    const c = canvas(W);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, W);
    const size = W / 16;
    const hexH = size * Math.sqrt(3) / 2;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor(y / hexH);
      const ox = row % 2 ? size / 2 : 0;
      const cx = Math.round((x - ox) / size) * size + ox;
      const cy = (row + 0.5) * hexH;
      const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
      const edge = Math.max(dx * 0.866 + dy * 0.5, dy) / (size * 0.5);
      const h = edge > 0.85 ? 0.4 : -0.1;
      hgt[y * W + x] = h;
      const n = S.noise(x * 0.05, y * 0.05, 1) * 0.5 + 0.5;
      const i = (y * W + x) * 4;
      const k = edge > 0.85 ? 0.8 : 1;
      img.data[i] = (58 + n * 20) * k; img.data[i + 1] = (42 + n * 14) * k; img.data[i + 2] = (32 + n * 10) * k; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { map: tex(c, { repeat: 2 }), normal: tex(heightToNormal(hgt, W, W, 1.2), { srgb: false, repeat: 2 }) };
  });
}

// Cellules photovoltaïques
export function solarTextures() {
  return memo('solar', () => {
    const W = 256;
    const c = canvas(W);
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, W, W);
    grd.addColorStop(0, '#1b2a63');
    grd.addColorStop(1, '#10183d');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, W);
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i * W) / n, y = (j * W) / n;
      ctx.fillStyle = `hsl(${226 + ((i * 7 + j * 3) % 5)}, 60%, ${16 + ((i + j) % 3) * 2}%)`;
      ctx.fillRect(x + 2, y + 2, W / n - 4, W / n - 4);
      ctx.strokeStyle = 'rgba(200,210,230,0.35)';
      ctx.lineWidth = 0.6;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 2, y + (k * W) / n / 4);
        ctx.lineTo(x + W / n - 2, y + (k * W) / n / 4);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = '#b8bec8';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, W - 2);
    return { map: tex(c, { repeat: 1 }) };
  });
}

// Voilure de parachute : fuseaux orange et blancs
export function canopyTexture() {
  return memo('canopy', () => {
    const W = 512, H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const n = 16;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#f4f1ea' : '#ea6a1f';
      ctx.fillRect((i * W) / n, 0, W / n + 1, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let j = 0; j < 6; j++) ctx.fillRect(0, (j * H) / 6, W, 2);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, H * 0.82, W, H * 0.06);
    return tex(c, { repeat: 1 });
  });
}

// Bandes de sécurité (découpleurs)
export function hazardTexture() {
  return memo('hazard', () => {
    const W = 256, H = 32;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f1c21b';
    for (let x = -H; x < W + H; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 16, H);
      ctx.lineTo(x + 16 + H, 0);
      ctx.lineTo(x + H, 0);
      ctx.fill();
    }
    const t = tex(c);
    t.repeat.set(1, 1);
    return t;
  });
}

// Décalcomanie texte vertical (nom du programme)
export function textDecal(text, color = '#1c2230', accent = '#e8552a') {
  return memo('txt:' + text + color, () => {
    const W = 128, H = 1024;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = color;
    ctx.font = '700 86px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(-H * 0.45, 42, H * 0.9, 6);
    ctx.restore();
    const t = tex(c, { wrap: false });
    return t;
  });
}

// Drapeau et logo de l'agence
export function flagDecal() {
  return memo('flag', () => {
    const W = 256, H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // drapeau tricolore
    const fx = 48, fy = 20, fw = 160, fh = 106;
    ctx.fillStyle = '#1f3f9a'; ctx.fillRect(fx, fy, fw / 3, fh);
    ctx.fillStyle = '#f6f6f2'; ctx.fillRect(fx + fw / 3, fy, fw / 3, fh);
    ctx.fillStyle = '#d8283a'; ctx.fillRect(fx + (2 * fw) / 3, fy, fw / 3, fh);
    // logo : orbite stylisée
    ctx.strokeStyle = '#1c2230';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(W / 2, 196, 70, 26, -0.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8552a';
    ctx.beginPath();
    ctx.arc(W / 2, 196, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2230';
    ctx.beginPath();
    ctx.arc(W / 2 + 62, 180, 7, 0, Math.PI * 2);
    ctx.fill();
    return tex(c, { wrap: false });
  });
}

// Symbole radioactif / danger (moteur nucléaire, RTG)
export function trefoilDecal() {
  return memo('trefoil', () => {
    const W = 128;
    const c = canvas(W);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#151515';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, W / 2);
      ctx.arc(W / 2, W / 2, W * 0.42, a - 0.52, a + 0.52);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c230';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#151515';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W * 0.08, 0, Math.PI * 2);
    ctx.fill();
    return tex(c, { wrap: false });
  });
}

// Taches de lumière douces (particules, halos)
export function glowTexture() {
  return memo('glow', () => {
    const W = 128;
    const c = canvas(W);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);
    return tex(c, { wrap: false, srgb: false });
  });
}

// Bouffée de fumée (particules) : 4 variantes dans un atlas 2x2
export function smokeTexture() {
  return memo('smoke', () => {
    const W = 256;
    const c = canvas(W * 2, W * 2);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W * 2, W * 2);
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * W, oy = Math.floor(q / 2) * W;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const u = x / W - 0.5, v = y / W - 0.5;
        const r = Math.sqrt(u * u + v * v) * 2;
        const n = S.fbm(u * 4 + q * 10, v * 4, q * 3.3, 5) * 0.5 + 0.5;
        const n2 = S.fbm(u * 9 + q * 5, v * 9, q + 1, 3) * 0.5 + 0.5;
        let a = Math.max(0, 1 - r * (1.05 - n * 0.45));
        a = Math.pow(a, 1.4) * (0.55 + n2 * 0.6);
        const i = ((oy + y) * W * 2 + ox + x) * 4;
        const shade = 200 + n * 55 - r * 30;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, shade));
        img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    return tex(c, { wrap: false, srgb: false });
  });
}

// Texture de bruit générique (sol, détails)
export function detailNoiseTexture() {
  return memo('detail', () => {
    const W = 256;
    const vals = new Float32Array(W * W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) vals[y * W + x] = tileNoise(x / W, y / W, 8, 5, 2) * 0.5 + 0.5;
    const t = tex(grayCanvas(vals, W, W), { srgb: false });
    return t;
  });
}
