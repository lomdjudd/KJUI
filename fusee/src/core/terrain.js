// Relief et couleurs des astres, générés procéduralement.
// height()  : hauteur en mètres pour une direction unitaire (repère du corps)
// color()   : couleur de surface (0..1) utilisée pour les textures
// Le même module est utilisé par le worker de génération de textures.

import { Simplex3, craterField, smoothstep, hash3 } from './noise.js';

const DEG = Math.PI / 180;

export const EARTH_SITES = {
  pad: { lon: -52.77 * DEG, half: 1400, h: 14, name: 'Pas de tir équatorial' },
  lz: { lon: -52.77 * DEG - 5200 / 600e3, half: 380, h: 12, name: 'Zone d\'atterrissage LZ-1' },
};

function lonLat(x, y, z) {
  return [Math.atan2(y, x), Math.asin(Math.max(-1, Math.min(1, z)))];
}

// Distance angulaire entre une direction et un point (lon, lat)
function angDist(x, y, z, lon, lat) {
  const cx = Math.cos(lat) * Math.cos(lon), cy = Math.cos(lat) * Math.sin(lon), cz = Math.sin(lat);
  const d = x * cx + y * cy + z * cz;
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class Terrain {
  constructor(body) {
    const t = body.terrain || { kind: 'none', amp: 0, seed: 1 };
    this.kind = t.kind;
    this.amp = t.amp || 0;
    this.seed = t.seed || 1;
    this.cfg = t;
    this.radius = body.radius;
    this.S = new Simplex3(this.seed);
    this.D = new Simplex3(this.seed + 1000);
    this.detailAmp = Math.min(60, this.amp * 0.02) + 4;
    this.detailFreq = body.radius / 900;
    this.hasLiquid = !!(body.ocean || body.liquid);
    this.earth = null; // données d'élévation réelles (Terre)
    this.bodyId = body.id;
  }

  // Données réelles de la Terre : élévation (R) et masque terre/mer (G)
  setEarthData(elev, land, w, h) {
    this.earth = { elev, land, w, h };
  }

  sampleEarth(arr, lon, lat) {
    const e = this.earth;
    const u = (lon / (2 * Math.PI) + 0.5) * e.w - 0.5;
    const v = (0.5 - lat / Math.PI) * e.h - 0.5;
    let x0 = Math.floor(u), y0 = Math.floor(v);
    const fx = u - x0, fy = v - y0;
    const W = e.w, H = e.h;
    const xa = ((x0 % W) + W) % W, xb = (((x0 + 1) % W) + W) % W;
    const ya = Math.max(0, Math.min(H - 1, y0)), yb = Math.max(0, Math.min(H - 1, y0 + 1));
    const a = arr[ya * W + xa], b = arr[ya * W + xb], c = arr[yb * W + xa], d = arr[yb * W + xb];
    return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) / 255;
  }

  // Hauteur « grande échelle » (textures, maillage de la sphère)
  base(x, y, z) {
    const S = this.S;
    const A = this.amp;
    switch (this.kind) {
      case 'none':
        return 0;
      case 'earth': {
        if (!this.earth) return 0;
        const [lon, lat] = lonLat(x, y, z);
        const land = this.sampleEarth(this.earth.land, lon, lat);
        if (land < 0.5) return 0;
        const el = this.sampleEarth(this.earth.elev, lon, lat);
        let h = 8 + Math.pow(el, 1.35) * A * 1.25;
        h *= smoothstep(0.5, 0.62, land);
        return this.sites(lon, lat, h);
      }
      case 'moon': {
        const m = smoothstep(0.02, 0.22, S.fbm(x * 1.3 + 3, y * 1.3, z * 1.3, 4));
        const hills = S.fbm(x * 2.5, y * 2.5, z * 2.5, 6) * 0.35 + S.ridged(x * 4, y * 4, z * 4, 4) * 0.18;
        const cr = craterField(x, y, z, this.seed, this.cfg.craterFreq, this.cfg.craterDensity, 3, 0.35);
        return A * ((1 - m) * hills - m * 0.35 + cr * (1.2 - 0.6 * m));
      }
      case 'cratered':
      case 'ceres': {
        const hills = S.fbm(x * 2, y * 2, z * 2, 6) * 0.35 + S.ridged(x * 3, y * 3, z * 3, 4) * 0.1;
        const cr = craterField(x, y, z, this.seed, this.cfg.craterFreq || 2.4, this.cfg.craterDensity || 0.5, 3, 0.4);
        return A * (hills + cr * 1.2);
      }
      case 'mars': {
        const [lon, lat] = lonLat(x, y, z);
        let h = S.fbm(x * 1.6, y * 1.6, z * 1.6, 7) * 0.45;
        // Dichotomie nord/sud
        h += smoothstep(-0.3, 0.5, -z + S.fbm(x, y, z, 3) * 0.4) * 0.25;
        // Olympus Mons (sur l'équateur)
        const dOly = angDist(x, y, z, 1.25, 0.02);
        h += 1.7 * Math.exp(-(dOly * dOly) / (0.19 * 0.19)) - 0.35 * Math.exp(-(dOly * dOly) / (0.022 * 0.022));
        // Tharsis Montes
        for (let i = 0; i < 3; i++) {
          const d = angDist(x, y, z, 1.75 + i * 0.17, 0.12 - i * 0.12);
          h += 0.8 * Math.exp(-(d * d) / 0.006);
        }
        // Valles Marineris : canyon allongé
        const canyonLat = lat + 0.08 + S.fbm(x * 4, y * 4, z * 4, 3) * 0.05;
        const inLon = smoothstep(2.3, 2.45, lon) * (1 - smoothstep(3.0, 3.2, lon));
        h -= 0.9 * inLon * Math.exp(-(canyonLat * canyonLat) / 0.0016);
        h += craterField(x, y, z, this.seed, 2.2, 0.35, 3, 0.3) * 0.8;
        // Hellas
        const dH = angDist(x, y, z, -1.2, -0.7);
        h -= 0.9 * Math.exp(-(dH * dH) / 0.05);
        return A * h;
      }
      case 'volcanic': {
        let h = S.fbm(x * 1.8, y * 1.8, z * 1.8, 7) * 0.4;
        h += S.ridged(x * 1.2 + 9, y * 1.2, z * 1.2, 5) * smoothstep(0.1, 0.4, S.fbm(x * 0.8, y * 0.8, z * 0.8, 3)) * 0.8;
        // Volcans boucliers : cratères inversés
        h -= craterField(x, y, z, this.seed + 5, 1.6, 0.3, 2, 0.8) * 0.9;
        return A * h;
      }
      case 'io': {
        let h = S.fbm(x * 2, y * 2, z * 2, 6) * 0.25;
        h += Math.pow(S.ridged(x * 3.5, y * 3.5, z * 3.5, 4), 3) * 1.2 * smoothstep(0.2, 0.5, S.noise(x * 2 + 4, y * 2, z * 2));
        h += craterField(x, y, z, this.seed + 3, 3.2, 0.35, 2, 0.9) * 0.9;
        return A * h;
      }
      case 'europa': {
        let h = S.fbm(x * 3, y * 3, z * 3, 5) * 0.4;
        const r = S.ridged(x * 6, y * 6, z * 6, 3);
        h += Math.pow(r, 6) * 0.9;
        h += craterField(x, y, z, this.seed, 1.5, 0.12, 2, 0.8) * 0.3;
        return A * h;
      }
      case 'ganymede': {
        const w = S.warp(x * 2, y * 2, z * 2, 0.6, 2);
        let h = S.fbm(x * 2, y * 2, z * 2, 6) * 0.35;
        const grooves = Math.sin(w[0] * 30 + w[1] * 12) * 0.5 + 0.5;
        const bright = smoothstep(-0.1, 0.2, S.fbm(x * 1.5 + 7, y * 1.5, z * 1.5, 4));
        h += grooves * bright * 0.25;
        h += craterField(x, y, z, this.seed, this.cfg.craterFreq || 2, this.cfg.craterDensity || 0.35, 3, 0.4) * (1.2 - bright * 0.6);
        return A * h;
      }
      case 'enceladus': {
        const [, lat] = lonLat(x, y, z);
        let h = S.fbm(x * 3, y * 3, z * 3, 5) * 0.3;
        const south = smoothstep(-0.6, -1.0, lat);
        h += craterField(x, y, z, this.seed, 3, 0.5, 2, 0.4) * (1 - south) * 1.1;
        h += Math.pow(Math.abs(Math.sin(lat * 60 + S.noise(x * 4, y * 4, z * 4) * 3)), 8) * south * 0.8;
        return A * h;
      }
      case 'titan': {
        const [lon, lat] = lonLat(x, y, z);
        let h = S.fbm(x * 2.2, y * 2.2, z * 2.2, 6) * 0.6;
        const eq = 1 - smoothstep(0.25, 0.5, Math.abs(lat));
        h += Math.pow(Math.abs(Math.sin(lon * 180 + S.noise(x * 6, y * 6, z * 6) * 4)), 3) * eq * 0.15;
        h += Math.pow(S.ridged(x * 2, y * 2, z * 2, 4), 2) * 0.5 * (1 - eq);
        return A * (h - 0.05);
      }
      case 'triton': {
        let h = S.fbm(x * 2.5, y * 2.5, z * 2.5, 6) * 0.35;
        // Terrain « peau de cantaloup »
        const c = craterField(x, y, z, this.seed, 9, 0.9, 1, 0.9);
        h += c * 0.5;
        return A * h;
      }
      case 'pluto': {
        let h = S.fbm(x * 2, y * 2, z * 2, 6) * 0.4 + Math.pow(S.ridged(x * 3, y * 3, z * 3, 4), 2) * 0.6;
        const dHeart = angDist(x, y, z, 3.0, 0.15);
        const heart = smoothstep(0.55, 0.35, dHeart + S.fbm(x * 3, y * 3, z * 3, 3) * 0.12);
        h = h * (1 - heart) - heart * 0.4;
        h += craterField(x, y, z, this.seed, 2.2, 0.3, 2, 0.5) * (1 - heart);
        return A * h;
      }
      case 'potato': {
        let h = S.fbm(x * 0.9, y * 0.9, z * 0.9, 3) * 1.1 + S.fbm(x * 3, y * 3, z * 3, 4) * 0.15;
        const dS = angDist(x, y, z, 0.3, 0.1);
        h -= 0.9 * Math.exp(-(dS * dS) / 0.12);
        h += craterField(x, y, z, this.seed, 3, 0.6, 2, 0.5) * 0.5;
        return A * h;
      }
      case 'nyx': {
        let h = S.fbm(x * 1.8, y * 1.8, z * 1.8, 6) * 0.35;
        h += Math.pow(S.ridged(x * 2.6, y * 2.6, z * 2.6, 5), 2.5) * 0.9 * smoothstep(0.0, 0.3, S.noise(x + 3, y, z));
        h += craterField(x, y, z, this.seed, 1.8, 0.2, 2, 0.8) * 0.4;
        return A * h;
      }
      default:
        return A * S.fbm(x * 2, y * 2, z * 2, 6) * 0.5;
    }
  }

  // Aplanissement du pas de tir et de la zone d'atterrissage (Terre)
  sites(lon, lat, h) {
    if (Math.abs(lat) > 0.02) return h;
    for (const k in EARTH_SITES) {
      const s = EARTH_SITES[k];
      let d = Math.abs(lon - s.lon) * this.radius;
      const dl = Math.abs(lat) * this.radius;
      d = Math.max(d, dl);
      const f = smoothstep(s.half * 2.4, s.half, d);
      h = h * (1 - f) + s.h * f;
    }
    return h;
  }

  // Petits détails (quelques dizaines de mètres) pour le relief proche
  detail(x, y, z) {
    const f = this.detailFreq;
    if (this.kind === 'none') return 0;
    let d = this.D.fbm(x * f, y * f, z * f, 3) * this.detailAmp;
    if (this.kind === 'earth') {
      if (!this.earth) return 0;
      const [lon, lat] = lonLat(x, y, z);
      if (this.sampleEarth(this.earth.land, lon, lat) < 0.5) return 0;
      // pas de détail sur les zones aménagées
      if (Math.abs(lat) < 0.02) {
        for (const k in EARTH_SITES) {
          const s = EARTH_SITES[k];
          const dd = Math.abs(lon - s.lon) * this.radius;
          d *= smoothstep(s.half, s.half * 2.4, dd);
        }
      }
      d = Math.abs(d) * 0.6;
    }
    return d;
  }

  height(x, y, z) {
    return this.base(x, y, z) + this.detail(x, y, z);
  }

  // Hauteur sur l'équateur (plan de vol) à une longitude donnée
  atLon(lon) {
    return this.height(Math.cos(lon), Math.sin(lon), 0);
  }

  // Est-ce une surface liquide (océan, lac de méthane) ?
  isLiquid(x, y, z) {
    if (!this.hasLiquid) return false;
    if (this.kind === 'earth') {
      if (!this.earth) return false;
      const [lon, lat] = lonLat(x, y, z);
      return this.sampleEarth(this.earth.land, lon, lat) < 0.5;
    }
    return this.base(x, y, z) < 0;
  }

  // ------------------------------------------------------------------
  // Couleurs (utilisées par le générateur de textures)
  color(x, y, z, h) {
    const S = this.S;
    const A = Math.max(1, this.amp);
    const n = h / A;
    const [lon, lat] = lonLat(x, y, z);
    const v = S.fbm(x * 6 + 11, y * 6, z * 6, 4);
    const v2 = S.fbm(x * 20 + 3, y * 20, z * 20, 3);
    switch (this.kind) {
      case 'cratered': {
        const pal = {
          mercure: [[0.44, 0.41, 0.38], [0.66, 0.62, 0.58]],
          callisto: [[0.24, 0.21, 0.18], [0.72, 0.7, 0.66]],
          titania: [[0.46, 0.44, 0.43], [0.72, 0.7, 0.69]],
          charon: [[0.5, 0.49, 0.48], [0.72, 0.7, 0.68]],
        }[this.bodyId] || [[0.4, 0.4, 0.4], [0.7, 0.7, 0.7]];
        let c = mix(pal[0], pal[1], Math.max(0, Math.min(1, 0.5 + n * 0.8 + v * 0.3 + v2 * 0.1)));
        if (this.bodyId === 'callisto') {
          const bright = hash3(Math.floor(x * 40), Math.floor(y * 40), Math.floor(z * 40), 5) > 0.93 ? 0.35 : 0;
          c = mix(c, pal[1], bright + smoothstep(0.15, 0.4, n) * 0.5);
        }
        if (this.bodyId === 'charon') c = mix(c, [0.42, 0.24, 0.17], smoothstep(1.0, 1.3, lat + v * 0.2));
        return c;
      }
      case 'ceres': {
        let c = mix([0.36, 0.35, 0.34], [0.55, 0.54, 0.52], 0.5 + n * 0.8 + v * 0.3);
        const d = angDist(x, y, z, 2.1, 0.35);
        c = mix(c, [0.97, 0.97, 0.94], smoothstep(0.035, 0.012, d + v2 * 0.01));
        return c;
      }
      case 'mars': {
        let c = mix([0.62, 0.3, 0.16], [0.82, 0.5, 0.3], 0.5 + v * 0.8);
        const dark = smoothstep(0.05, 0.25, S.fbm(x * 2.2 + 5, y * 2.2, z * 2.2, 5));
        c = mix(c, [0.32, 0.2, 0.14], dark * 0.75);
        c = mix(c, [0.5, 0.26, 0.15], smoothstep(0.0, -0.4, n) * 0.5);
        c = mix(c, [0.86, 0.62, 0.45], smoothstep(0.5, 1.2, n) * 0.5);
        const cap = smoothstep(1.2, 1.32, Math.abs(lat) + v * 0.08);
        c = mix(c, [0.95, 0.93, 0.92], cap);
        return c;
      }
      case 'volcanic': {
        let c = mix([0.42, 0.28, 0.17], [0.64, 0.45, 0.28], 0.5 + n * 0.6 + v * 0.4);
        c = mix(c, [0.2, 0.13, 0.09], smoothstep(-0.2, -0.6, n) * 0.6);
        return c;
      }
      case 'io': {
        let c = mix([0.92, 0.84, 0.38], [0.95, 0.94, 0.8], smoothstep(-0.2, 0.3, v));
        c = mix(c, [0.86, 0.46, 0.14], smoothstep(0.1, 0.4, S.fbm(x * 3 + 2, y * 3, z * 3, 4)) * 0.8);
        const pits = smoothstep(-0.25, -0.55, n);
        c = mix(c, [0.08, 0.06, 0.05], pits);
        const ring = smoothstep(-0.05, -0.2, n) * (1 - pits);
        c = mix(c, [0.7, 0.2, 0.08], ring * 0.7);
        return c;
      }
      case 'europa': {
        let c = mix([0.86, 0.83, 0.76], [0.96, 0.95, 0.92], 0.5 + v * 0.8);
        const lines = Math.pow(S.ridged(x * 6, y * 6, z * 6, 3), 7);
        c = mix(c, [0.55, 0.34, 0.2], Math.min(1, lines * 1.4));
        c = mix(c, [0.65, 0.45, 0.33], smoothstep(0.2, 0.45, S.fbm(x * 2 + 9, y * 2, z * 2, 4)) * 0.5);
        return c;
      }
      case 'ganymede': {
        const bright = smoothstep(-0.1, 0.2, S.fbm(x * 1.5 + 7, y * 1.5, z * 1.5, 4));
        let c = mix([0.34, 0.31, 0.27], [0.72, 0.69, 0.64], bright);
        c = mix(c, [0.85, 0.84, 0.82], smoothstep(1.1, 1.3, Math.abs(lat)) * 0.6);
        return mix(c, [0.9, 0.9, 0.88], smoothstep(0.2, 0.45, n) * 0.4);
      }
      case 'enceladus': {
        let c = mix([0.9, 0.93, 0.97], [1, 1, 1], 0.5 + v);
        const south = smoothstep(-0.6, -1.0, lat);
        c = mix(c, [0.5, 0.72, 0.95], south * smoothstep(0.3, 0.7, n) * 0.9);
        return c;
      }
      case 'titan': {
        if (h < 0) return mix([0.03, 0.04, 0.06], [0.08, 0.09, 0.1], v * 0.5 + 0.5);
        let c = mix([0.3, 0.2, 0.12], [0.62, 0.46, 0.28], smoothstep(-0.2, 0.5, n + v * 0.3));
        return c;
      }
      case 'triton': {
        let c = mix([0.78, 0.68, 0.64], [0.93, 0.86, 0.82], 0.5 + v);
        c = mix(c, [0.4, 0.33, 0.3], smoothstep(0.3, 0.6, S.ridged(x * 5, y * 5, z * 5, 3)) * 0.35);
        c = mix(c, [0.78, 0.84, 0.8], smoothstep(-0.4, -0.8, lat) * 0.7);
        return c;
      }
      case 'pluto': {
        const dHeart = angDist(x, y, z, 3.0, 0.15);
        const heart = smoothstep(0.62, 0.4, dHeart + S.fbm(x * 3, y * 3, z * 3, 3) * 0.12);
        let c = mix([0.72, 0.58, 0.44], [0.86, 0.76, 0.64], 0.5 + v);
        const dark = smoothstep(0.1, -0.35, lat + S.fbm(x * 2, y * 2, z * 2, 4) * 0.3) * smoothstep(-0.9, -0.3, lat);
        c = mix(c, [0.33, 0.18, 0.12], dark * (1 - heart) * 0.9);
        c = mix(c, [0.96, 0.93, 0.89], heart);
        return c;
      }
      case 'potato': {
        const b = this.bodyId === 'deimos' ? [[0.5, 0.46, 0.42], [0.66, 0.62, 0.56]] : [[0.3, 0.27, 0.25], [0.46, 0.42, 0.38]];
        return mix(b[0], b[1], 0.5 + n * 0.5 + v * 0.3);
      }
      case 'nyx': {
        let c = mix([0.36, 0.34, 0.72], [0.62, 0.58, 0.92], 0.5 + v * 0.8 + n * 0.3);
        c = mix(c, [0.93, 0.93, 1.0], smoothstep(0.3, 0.8, n) * 0.8);
        c = mix(c, [0.2, 0.25, 0.55], smoothstep(-0.1, -0.5, n) * 0.6);
        return c;
      }
      default:
        return mix([0.4, 0.4, 0.4], [0.7, 0.7, 0.7], 0.5 + v);
    }
  }
}

// Couleurs des géantes gazeuses (et des nuages de Vénus)
export function gasColor(id, S, x, y, z) {
  const lat = Math.asin(Math.max(-1, Math.min(1, z)));
  const lon = Math.atan2(y, x);
  const w = S.warp(x * 3, y * 3, z * 3, 0.35, 3);
  const turb = S.fbm(w[0] * 2, w[1] * 2, w[2] * 2, 5);
  const band = lat * 1 + turb * 0.05;
  switch (id) {
    case 'jupiter': {
      const b = Math.sin(band * 14) * 0.5 + 0.5;
      const b2 = Math.sin(band * 31 + 1.3) * 0.5 + 0.5;
      let c = mix([0.74, 0.54, 0.38], [0.95, 0.91, 0.82], smoothstep(0.35, 0.65, b));
      c = mix(c, [0.62, 0.42, 0.3], b2 * 0.25);
      c = mix(c, [0.52, 0.55, 0.6], smoothstep(1.0, 1.35, Math.abs(lat)) * 0.7);
      // Grande Tache rouge
      const dl = (lon - 1.0), dt = (lat + 0.38);
      const d = Math.sqrt(dl * dl * 0.35 + dt * dt * 2.5);
      c = mix(c, [0.78, 0.36, 0.22], smoothstep(0.09, 0.04, d + turb * 0.02));
      c = mix(c, [0.95, 0.88, 0.8], smoothstep(0.11, 0.095, d) * smoothstep(0.08, 0.1, d) * 0.6);
      return c;
    }
    case 'saturne': {
      const b = Math.sin(band * 18) * 0.5 + 0.5;
      let c = mix([0.8, 0.68, 0.46], [0.95, 0.88, 0.68], b);
      c = mix(c, [0.6, 0.62, 0.62], smoothstep(1.1, 1.4, Math.abs(lat)) * 0.6);
      return c;
    }
    case 'uranus': {
      const b = Math.sin(band * 10) * 0.5 + 0.5;
      return mix([0.58, 0.82, 0.86], [0.7, 0.9, 0.93], b * 0.5 + turb * 0.2);
    }
    case 'neptune': {
      const b = Math.sin(band * 12) * 0.5 + 0.5;
      let c = mix([0.18, 0.32, 0.8], [0.3, 0.5, 0.95], b);
      const dl = lon + 0.8, dt = lat + 0.35;
      const d = Math.sqrt(dl * dl * 0.4 + dt * dt * 3);
      c = mix(c, [0.08, 0.12, 0.4], smoothstep(0.12, 0.06, d));
      const streak = smoothstep(0.55, 0.8, S.fbm(x * 8, y * 8, z * 2, 3)) * smoothstep(0.1, 0.6, Math.abs(lat));
      c = mix(c, [0.92, 0.95, 1.0], streak * 0.8);
      return c;
    }
    case 'venus_nuages': {
      const ch = lat * 3 + Math.abs(Math.sin(lon * 2)) * 0.5 * Math.sign(lat) + turb * 0.3;
      const b = Math.sin(ch * 6) * 0.5 + 0.5;
      return mix([0.84, 0.72, 0.5], [0.97, 0.92, 0.78], b * 0.6 + turb * 0.4 + 0.2);
    }
    default:
      return [0.8, 0.8, 0.8];
  }
}
