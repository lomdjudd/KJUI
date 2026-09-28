// Worker : génère les textures (couleur, normales en repère objet, relief)
// des astres procéduraux, sans bloquer l'affichage.

import { SolarSystem } from '../core/bodies.js';
import { gasColor } from '../core/terrain.js';
import { Simplex3 } from '../core/noise.js';

const sys = new SolarSystem();

function lonLatDir(i, j, w, h) {
  const lon = ((i + 0.5) / w - 0.5) * Math.PI * 2;
  const lat = ((j + 0.5) / h - 0.5) * Math.PI; // ligne 0 = pôle sud (pas de retournement)
  const cl = Math.cos(lat);
  return [cl * Math.cos(lon), cl * Math.sin(lon), Math.sin(lat), lon, lat];
}

function srgb(v) {
  v = Math.max(0, Math.min(1, v));
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
}

self.onmessage = (e) => {
  const { id, w, h, mode, exag } = e.data;
  const body = sys.get(id);
  const color = new Uint8Array(w * h * 4);
  let normal = null, heights = null;
  if (mode === 'gas' || mode === 'clouds') {
    const S = new Simplex3((body.terrain && body.terrain.seed) || 5 + id.length * 13);
    const key = mode === 'clouds' ? 'venus_nuages' : id;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const [x, y, z] = lonLatDir(i, j, w, h);
      const c = gasColor(key, S, x, y, z);
      const k = (j * w + i) * 4;
      // les couleurs sont données en espace sRGB perceptuel
      color[k] = Math.round(Math.max(0, Math.min(1, c[0])) * 255);
      color[k + 1] = Math.round(Math.max(0, Math.min(1, c[1])) * 255);
      color[k + 2] = Math.round(Math.max(0, Math.min(1, c[2])) * 255);
      color[k + 3] = 255;
    }
    self.postMessage({ id, mode, w, h, color }, [color.buffer]);
    return;
  }
  const G = body.ground;
  heights = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = lonLatDir(i, j, w, h);
    heights[j * w + i] = G.base(x, y, z);
  }
  // normales (repère objet) par différences finies, relief exagéré
  normal = new Uint8Array(w * h * 4);
  const R = body.radius;
  const k = exag || 6;
  const H = (i, j) => heights[Math.max(0, Math.min(h - 1, j)) * w + ((i % w) + w) % w];
  const dLon = (Math.PI * 2) / w, dLat = Math.PI / h;
  for (let j = 0; j < h; j++) {
    const lat = ((j + 0.5) / h - 0.5) * Math.PI;
    const cl = Math.max(0.02, Math.cos(lat));
    for (let i = 0; i < w; i++) {
      const dhE = (H(i + 1, j) - H(i - 1, j)) * k / (2 * dLon * R * cl);
      const dhN = (H(i, j + 1) - H(i, j - 1)) * k / (2 * dLat * R);
      // normale locale (est, nord, haut) puis passage au repère objet
      let ne = -dhE, nn = -dhN, nu = 1;
      const l = Math.hypot(ne, nn, nu);
      ne /= l; nn /= l; nu /= l;
      const lon = ((i + 0.5) / w - 0.5) * Math.PI * 2;
      const sl = Math.sin(lat), co = Math.cos(lon), so = Math.sin(lon);
      const ex = -so, ey = co, ez = 0;
      const nx_ = -sl * co, ny_ = -sl * so, nz_ = cl;
      const ux = cl * co, uy = cl * so, uz = sl;
      const X = ne * ex + nn * nx_ + nu * ux;
      const Y = ne * ey + nn * ny_ + nu * uy;
      const Z = ne * ez + nn * nz_ + nu * uz;
      const q = (j * w + i) * 4;
      normal[q] = Math.round((X * 0.5 + 0.5) * 255);
      normal[q + 1] = Math.round((Y * 0.5 + 0.5) * 255);
      normal[q + 2] = Math.round((Z * 0.5 + 0.5) * 255);
      normal[q + 3] = 255;
    }
  }
  // couleurs avec légère occlusion des creux
  const amp = Math.max(1, G.amp);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = lonLatDir(i, j, w, h);
    const hh = heights[j * w + i];
    const c = G.color(x, y, z, hh);
    const avg = (H(i - 2, j) + H(i + 2, j) + H(i, j - 2) + H(i, j + 2)) / 4;
    const cav = Math.max(-0.25, Math.min(0.12, ((hh - avg) / amp) * 3));
    const f = 1 + cav;
    const q = (j * w + i) * 4;
    color[q] = srgb(c[0] * c[0] * f);
    color[q + 1] = srgb(c[1] * c[1] * f);
    color[q + 2] = srgb(c[2] * c[2] * f);
    color[q + 3] = hh < 0 && G.hasLiquid ? 0 : 255; // alpha 0 = liquide (reflets)
  }
  // relief réduit pour le maillage
  const hw = Math.min(w, 256), hh2 = Math.min(h, 128);
  const small = new Float32Array(hw * hh2);
  for (let j = 0; j < hh2; j++) for (let i = 0; i < hw; i++) {
    small[j * hw + i] = heights[Math.floor(((j + 0.5) / hh2) * h) * w + Math.floor(((i + 0.5) / hw) * w)];
  }
  self.postMessage({ id, mode, w, h, color, normal, heights: small, hw, hh: hh2 }, [color.buffer, normal.buffer, small.buffer]);
};
