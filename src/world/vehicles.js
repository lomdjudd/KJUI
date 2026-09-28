import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- Véhicules procéduraux ----------
// Chaque carrosserie est « lissée » à partir de sections en super-ellipse (comme un loft en modélisation 3D).
// Les propriétés de surface (peinture, vitre, chrome, feux) sont stockées par sommet : un seul appel de dessin
// par modèle de véhicule, les roues tournent dans le shader et les feux s'allument par instance.

// Interpolation cubique monotone (Fritsch-Carlson) d'une liste de [x, y]
function curve(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Section : y0 bas, y1 haut, ym hauteur de la plus grande largeur, w largeur (demi) à ym,
// wt demi-largeur en haut, wb demi-largeur en bas, nt/nb exposants de super-ellipse (arrondi)
function sectionFn(spec) {
  const f = {};
  for (const k of Object.keys(spec)) f[k] = typeof spec[k] === 'number' ? () => spec[k] : curve(spec[k]);
  return (z) => ({ y0: f.y0(z), y1: f.y1(z), ym: f.ym(z), w: f.w(z), wt: f.wt(z), wb: f.wb(z), nt: f.nt(z), nb: f.nb(z) });
}

const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

function sePoint(s, th, grow = 0) {
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const n = sn >= 0 ? s.nt : s.nb;
  const ex = spow(c, 2 / n);
  const ey = spow(sn, 2 / n);
  const Y = ey >= 0 ? s.ym + ey * (s.y1 - s.ym) : s.ym + ey * (s.ym - s.y0);
  const w = Y >= s.ym ? s.w + (s.wt - s.w) * ((Y - s.ym) / Math.max(1e-4, s.y1 - s.ym)) : s.w + (s.wb - s.w) * ((s.ym - Y) / Math.max(1e-4, s.ym - s.y0));
  return [ex * (w + grow), Y + ey * grow];
}

// Angle (côté droit) où la surface passe à la hauteur Y
function thetaAtY(s, Y) {
  if (Y >= s.ym) return Math.asin(Math.min(1, Math.pow(Math.min(1, (Y - s.ym) / (s.y1 - s.ym)), s.nt / 2)));
  return -Math.asin(Math.min(1, Math.pow(Math.min(1, (s.ym - Y) / (s.ym - s.y0)), s.nb / 2)));
}

const range = (a, b, n) => [...Array(n + 1)].map((_, i) => a + ((b - a) * i) / n);

// Carreau de surface sur la carrosserie (zs croissants, ths croissants = sens trigonométrique vu de l'avant)
function patch(sec, zs, ths, { grow = 0, capStart = false, capEnd = false } = {}) {
  const pos = [];
  const idx = [];
  const thAt = typeof ths === 'function' ? ths : () => ths;
  const nt = thAt(sec(zs[0]), zs[0]).length;
  for (const z of zs) {
    const s = sec(z);
    for (const th of thAt(s, z)) {
      const [x, y] = sePoint(s, th, grow);
      pos.push(x, y, z);
    }
  }
  for (let a = 0; a < zs.length - 1; a++) {
    for (let i = 0; i < nt - 1; i++) {
      const p = a * nt + i;
      const q = p + nt;
      idx.push(p, p + 1, q, p + 1, q + 1, q);
    }
  }
  let base = pos.length / 3;
  const cap = (z, flip) => {
    const s = sec(z);
    const c = base;
    pos.push(0, s.ym, z);
    for (const th of thAt(s, z)) {
      const [x, y] = sePoint(s, th, grow);
      pos.push(x, y, z);
    }
    for (let i = 0; i < nt - 1; i++) {
      if (flip) idx.push(c, c + 2 + i, c + 1 + i);
      else idx.push(c, c + 1 + i, c + 2 + i);
    }
    base = pos.length / 3;
  };
  if (capStart) cap(zs[0], true);
  if (capEnd) cap(zs[zs.length - 1], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const ring = (n) => range(-Math.PI / 2, (Math.PI * 3) / 2, n);
const mirrorTh = (ths) => ths.map((t) => Math.PI - t).reverse();

// Rassemble les pièces et leurs propriétés de surface
class Kit {
  constructor() {
    this.parts = [];
  }
  add(geo, o = {}) {
    let g = geo.index ? geo : BufferGeometryUtils.mergeVertices(geo);
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const fill = (size, vals) => {
      const a = new Float32Array(n * size);
      for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) a[i * size + c] = vals[c];
      return new THREE.BufferAttribute(a, size);
    };
    const col = new THREE.Color(o.color !== undefined ? o.color : 0xffffff);
    g.setAttribute('color', fill(3, [col.r, col.g, col.b]));
    g.setAttribute('surf', fill(3, [o.paint || 0, o.rough !== undefined ? o.rough : 0.6, o.metal || 0]));
    g.setAttribute('glow', fill(4, o.glow || [0, 0, 0, 0]));
    g.setAttribute('wheel', fill(4, o.wheel || [0, 0, 0, 0]));
    this.parts.push(g);
    return g;
  }
  // Pièce symétrique gauche/droite
  addMirrored(geo, o) {
    this.add(geo, o);
    const m = geo.clone();
    m.scale(-1, 1, 1);
    const idx = m.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    m.computeVertexNormals();
    this.add(m, o);
  }
  build() {
    const g = BufferGeometryUtils.mergeGeometries(this.parts);
    g.computeBoundingSphere();
    return g;
  }
}

// Matières
const PAINT = { paint: 1, rough: 0.28, metal: 0.55, color: 0xffffff };
const GLASS = { color: 0x10151c, rough: 0.04, metal: 0.95 };
const TRIM = { color: 0x16171a, rough: 0.7, metal: 0 };
const CHROME = { color: 0xd8dde2, rough: 0.12, metal: 1 };
const RUBBER = { color: 0x151515, rough: 0.92, metal: 0 };
const RIM = { color: 0xbfc4c9, rough: 0.28, metal: 0.9 };
const DARK = { color: 0x0b0b0c, rough: 0.9, metal: 0 };
const PLATE = { color: 0xf0f0e6, rough: 0.5, metal: 0.1 };
const LAMP_HEAD = { color: 0xe8edf2, rough: 0.08, metal: 0.6, glow: [0, 1, 0, 0] };
const LAMP_TAIL = { color: 0x6a0a0c, rough: 0.15, metal: 0.2, glow: [1, 0, 0, 0] };
const LAMP_IND = { color: 0x8a5a10, rough: 0.2, metal: 0.2, glow: [0, 0, 1, 0] };

// Roue : pneu profilé, jante alliage à 5 branches, moyeu chromé
function addWheel(kit, x, y, z, r, width, detail) {
  const side = Math.sign(x);
  const wheel = [x, y, z, 1];
  const seg = detail ? 14 : 8;
  const tireProfile = [
    [r * 0.62, -width / 2],
    [r * 0.9, -width / 2 - 0.004],
    [r * 0.975, -width * 0.42],
    [r, -width * 0.25],
    [r, width * 0.25],
    [r * 0.975, width * 0.42],
    [r * 0.9, width / 2 + 0.004],
    [r * 0.62, width / 2],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const tire = new THREE.LatheGeometry(tireProfile, seg);
  tire.rotateZ(Math.PI / 2);
  tire.translate(x, y, z);
  kit.add(tire, { ...RUBBER, wheel });
  // Face de jante (côté extérieur)
  const face = new THREE.CircleGeometry(r * 0.64, seg);
  face.rotateY((side * Math.PI) / 2);
  face.translate(x + side * (width / 2 - 0.02), y, z);
  kit.add(face, { ...RIM, wheel });
  if (detail) {
    for (let k = 0; k < 5; k++) {
      const hole = new THREE.RingGeometry(r * 0.2, r * 0.52, 3, 1, (k / 5) * Math.PI * 2 + 0.25, (Math.PI * 2) / 5 - 0.5);
      hole.rotateY((side * Math.PI) / 2);
      hole.translate(x + side * (width / 2 - 0.012), y, z);
      kit.add(hole, { ...DARK, wheel });
    }
    const hub = new THREE.CircleGeometry(r * 0.14, 12);
    hub.rotateY((side * Math.PI) / 2);
    hub.translate(x + side * (width / 2 - 0.008), y, z);
    kit.add(hub, { ...CHROME, wheel });
    // Disque de frein visible derrière les branches
    const disc = new THREE.CircleGeometry(r * 0.5, 14);
    disc.rotateY((side * Math.PI) / 2);
    disc.translate(x + side * (width / 2 - 0.05), y, z);
    kit.add(disc, { color: 0x55585c, rough: 0.5, metal: 0.8 });
  }
}

// Boîte arrondie simple (rétroviseurs, enseignes, gyrophares)
function rbox(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Plaque plane tournée vers +z (ou -z)
function plate(w, h, x, y, z, back) {
  const g = new THREE.PlaneGeometry(w, h);
  if (back) g.rotateY(Math.PI);
  g.translate(x, y, z);
  return g;
}

// ---------- Silhouettes ----------
// Voiture particulière générique : paramètres d'une berline, adaptés par type
// Bande de surface entre deux hauteurs (côté droit), recalculée à chaque section
const band = (ya, yb, n) => (s) => {
  const a = thetaAtY(s, typeof ya === 'function' ? ya(s) : ya);
  const b = thetaAtY(s, typeof yb === 'function' ? yb(s) : yb);
  return range(a, Math.max(a + 1e-3, b), n);
};

function buildCar(t, detail) {
  const kit = new Kit();
  const L = t.len / 2;
  const R = t.wheelR;
  const wy = R;
  const archR = R + 0.09;
  const wz = [t.wheelBase / 2 + t.wheelOff, -t.wheelBase / 2 + t.wheelOff];
  const arch = (z) => {
    let v = t.sill;
    for (const c of wz) {
      const d = Math.abs(z - c);
      if (d < archR) v = Math.max(v, wy + Math.sqrt(archR * archR - d * d) * 0.95);
    }
    return v;
  };
  const W = t.width / 2;
  const nose = t.nose || 1;
  const top = curve(t.bodyTop(L));
  const bodySec = sectionFn({
    y0: [[-L, t.rearY0], [-L + 0.15, t.sill + 0.03], [L - 0.2, t.sill + 0.03], [L, t.frontY0]],
    y1: t.bodyTop(L),
    ym: 0,
    w: [[-L, W - 0.2], [-L + 0.1, W - 0.1], [-L + 0.3, W - 0.03], [-L + 0.7, W], [L - 0.6, W], [L - 0.3, W - 0.04 * nose], [L - 0.1, W - 0.13 * nose], [L, W - 0.26 * nose]],
    wt: [[-L, W - 0.32], [-L + 0.4, W - 0.13], [L - 0.5, W - 0.13], [L, W - 0.36 * nose]],
    wb: W - 0.06,
    nt: [[-L, 3.2], [-L + 0.4, t.nt || 6], [L - 0.5, t.nt || 6], [L, 3.2]],
    nb: 5,
  });
  const sec = (z) => {
    const s = bodySec(z);
    s.y0 = Math.max(s.y0, arch(z));
    s.ym = Math.max(s.y0 + 0.08, Math.min(t.shoulder, top(z) - 0.14));
    return s;
  };
  const zs = range(-L, L, detail ? 36 : 16);
  kit.add(patch(sec, zs, ring(detail ? 26 : 14), { capStart: true, capEnd: true }), PAINT);

  // Habitacle vitré
  const cab = t.cabin;
  const cabSec = sectionFn({
    y0: t.belt - 0.12,
    y1: cab.roof,
    ym: t.belt,
    w: [[cab.z0, W - 0.13], [cab.z1, W - 0.11]],
    wt: [[cab.z0, W - 0.36], [(cab.z0 + cab.z1) / 2, W - 0.25], [cab.z1, W - 0.36]],
    wb: W - 0.2,
    nt: 4,
    nb: 3,
  });
  const czs = range(cab.z0, cab.z1, detail ? 14 : 8);
  kit.add(patch(cabSec, czs, ring(detail ? 22 : 12), { capStart: true, capEnd: true }), GLASS);
  // Toit peint (partie plate) et montants (arêtes du vitrage)
  const C = Math.PI / 4;
  kit.add(patch(cabSec, range(cab.r0, cab.r1, detail ? 6 : 4), range(C + 0.12, Math.PI - C - 0.12, detail ? 8 : 6), { grow: 0.006, capStart: true, capEnd: true }), PAINT);
  if (detail) {
    kit.addMirrored(patch(cabSec, range(cab.r1 - 0.02, cab.z1 - 0.06, 6), range(C - 0.16, C + 0.14, 2), { grow: 0.005 }), PAINT);
    kit.addMirrored(patch(cabSec, range(cab.z0 + 0.05, cab.r0 + 0.02, 6), range(C - (cab.cWide || 0.3), C + 0.14, 3), { grow: 0.005 }), PAINT);
    for (const bz of cab.b) kit.addMirrored(patch(cabSec, range(bz - 0.05, bz + 0.05, 1), band(t.belt, (s) => s.y1 - 0.06, 6), { grow: 0.005 }), { ...TRIM, color: 0x101114 });
    // Joint noir en bas des vitres
    kit.addMirrored(patch(cabSec, range(cab.z0 + 0.15, cab.z1 - 0.15, 8), band(t.belt, t.belt + 0.035, 1), { grow: 0.003 }), TRIM);
  } else {
    kit.addMirrored(patch(cabSec, range(cab.r1, cab.z1 - 0.06, 2), range(C - 0.16, C + 0.14, 1), { grow: 0.005 }), PAINT);
  }

  // Dessous sombre (remplit les passages de roue)
  kit.add(rbox(t.width - 0.72, 0.12, t.len - 1.0, 0, t.sill - 0.05, 0), DARK);
  for (const c of wz) kit.add(rbox(t.width - 0.4, archR * 1.05, archR * 2, 0, wy + 0.06, c), DARK);

  // Pare-chocs : bande plastique en bas de l'avant et de l'arrière
  const lowBand = (s) => {
    const a = thetaAtY(s, s.y0 + 0.09);
    return range(-Math.PI - a, a, detail ? 12 : 4);
  };
  kit.add(patch(sec, range(L - 0.36, L, 5), lowBand, { grow: 0.004 }), TRIM);
  kit.add(patch(sec, range(-L, -L + 0.3, 5), lowBand, { grow: 0.004 }), TRIM);

  // Phares enveloppants (suivent la ligne d'aile), feux arrière, clignotants
  const hb = band((s) => s.ym + 0.01, (s) => s.ym + 0.1, 3);
  kit.addMirrored(patch(sec, range(L - 0.28, L - 0.005, 5), hb, { grow: 0.005 }), LAMP_HEAD);
  kit.addMirrored(patch(sec, range(L - 0.4, L - 0.3, 2), hb, { grow: 0.005 }), LAMP_IND);
  const tb = band((s) => s.ym + 0.02, (s) => s.ym + 0.12, 3);
  kit.addMirrored(patch(sec, range(-L + 0.005, -L + 0.24, 5), tb, { grow: 0.005 }), LAMP_TAIL);
  kit.addMirrored(patch(sec, range(-L + 0.26, -L + 0.34, 2), tb, { grow: 0.005 }), LAMP_IND);
  // Calandre, feux sur la face avant, plaques
  const sF = sec(L);
  const gw = Math.min(0.7, sF.w * 0.9);
  const gh = Math.min(0.2, (sF.y1 - sF.y0) * 0.36);
  kit.add(plate(gw, gh, 0, sF.ym - 0.02, L + 0.004), { ...TRIM, color: 0x0c0d0f, rough: 0.35, metal: 0.5 });
  if (detail) kit.add(plate(gw + 0.04, 0.02, 0, sF.ym - 0.02 + gh / 2 + 0.01, L + 0.006), CHROME);
  kit.add(plate(0.5, 0.11, 0, sF.y0 + 0.09, L + 0.012), PLATE);
  kit.addMirrored(plate(Math.min(0.3, sF.w * 0.35), 0.08, sF.w * 0.72, sF.ym + 0.03, L + 0.006), LAMP_HEAD);
  const sB = sec(-L);
  kit.add(plate(0.5, 0.11, 0, sB.ym - 0.05, -L - 0.008, true), PLATE);
  kit.addMirrored(plate(0.2, 0.08, (sB.w - 0.1) * 0.8, sB.ym + 0.07, -L - 0.006, true), LAMP_TAIL);

  if (detail) {
    // Rétroviseurs
    const mz = cab.z1 - 0.22;
    kit.addMirrored(rbox(0.1, 0.1, 0.17, W + 0.05, t.belt + 0.08, mz), PAINT);
    kit.addMirrored(rbox(0.16, 0.035, 0.05, W - 0.04, t.belt + 0.04, mz + 0.03), TRIM);
    // Poignées de porte
    for (const hz of t.handles) kit.addMirrored(patch(sec, range(hz - 0.11, hz + 0.11, 1), band(t.belt - 0.11, t.belt - 0.08, 1), { grow: 0.01 }), CHROME);
    // Lignes de portes (fines rainures sombres)
    for (const dz of t.doors) kit.addMirrored(patch(sec, range(dz - 0.007, dz + 0.007, 1), band(t.sill + 0.1, t.belt - 0.01, 6), { grow: 0.003 }), DARK);
    // Échappement
    kit.add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8).rotateX(Math.PI / 2).translate(W - 0.4, t.rearY0 - 0.02, -L - 0.02), CHROME);
  }
  if (t.extra) t.extra(kit, { sec, cabSec, L, W, detail, band });

  const wx = W - 0.13;
  for (const c of wz) {
    addWheel(kit, wx, wy, c, R, t.tireW, detail);
    addWheel(kit, -wx, wy, c, R, t.tireW, detail);
  }
  return kit.build();
}

export const CAR_TYPES = {
  sedan: {
    len: 4.75,
    width: 1.86,
    wheelBase: 2.82,
    wheelOff: 0.05,
    wheelR: 0.335,
    tireW: 0.23,
    sill: 0.25,
    rearY0: 0.4,
    frontY0: 0.3,
    shoulder: 0.86,
    belt: 0.99,
    bodyTop: (L) => [[-L, 0.88], [-L + 0.1, 0.98], [-L + 0.35, 1.02], [-1.3, 1.03], [0.95, 1.0], [1.6, 0.96], [L - 0.3, 0.89], [L - 0.08, 0.8], [L, 0.72]],
    cabin: { z0: -1.42, z1: 1.02, roof: [[-1.42, 1.0], [-1.05, 1.3], [-0.62, 1.44], [0, 1.47], [0.3, 1.44], [0.66, 1.24], [1.02, 0.98]], r0: -0.6, r1: 0.3, b: [-0.1] },
    handles: [0.2, -0.8],
    doors: [0.92, -0.1, -1.1],
  },
  compact: {
    len: 4.1,
    width: 1.78,
    wheelBase: 2.56,
    wheelOff: 0.02,
    wheelR: 0.32,
    tireW: 0.21,
    sill: 0.25,
    rearY0: 0.42,
    frontY0: 0.32,
    shoulder: 0.88,
    belt: 1.0,
    bodyTop: (L) => [[-L, 0.98], [-L + 0.08, 1.04], [-L + 0.3, 1.06], [0.7, 1.02], [1.2, 0.97], [L - 0.25, 0.9], [L - 0.06, 0.8], [L, 0.72]],
    cabin: { z0: -1.98, z1: 0.9, roof: [[-1.98, 1.02], [-1.9, 1.3], [-1.7, 1.48], [-1.2, 1.52], [0, 1.52], [0.3, 1.46], [0.6, 1.26], [0.9, 1.0]], r0: -1.72, r1: 0.26, b: [-0.35], cWide: 0.45 },
    handles: [0.1, -0.9],
    doors: [0.8, -0.35, -1.5],
  },
  suv: {
    len: 4.9,
    width: 1.96,
    wheelBase: 2.9,
    wheelOff: 0,
    wheelR: 0.38,
    tireW: 0.26,
    sill: 0.4,
    rearY0: 0.55,
    frontY0: 0.46,
    shoulder: 1.06,
    nose: 0.55,
    nt: 7,
    belt: 1.2,
    bodyTop: (L) => [[-L, 1.16], [-L + 0.08, 1.23], [-L + 0.3, 1.25], [0.9, 1.22], [1.5, 1.18], [L - 0.3, 1.12], [L - 0.06, 1.02], [L, 0.94]],
    cabin: { z0: -2.36, z1: 1.05, roof: [[-2.36, 1.22], [-2.3, 1.6], [-2.1, 1.8], [-1.5, 1.84], [0, 1.85], [0.35, 1.8], [0.7, 1.52], [1.05, 1.2]], r0: -2.12, r1: 0.32, b: [-0.25, -1.2], cWide: 0.45 },
    handles: [0.15, -0.95],
    doors: [0.95, -0.25, -1.4],
    extra: (kit, { W, detail }) => {
      if (!detail) return;
      // Barres de toit
      for (const s of [1, -1]) kit.add(rbox(0.05, 0.05, 2.4, s * (W - 0.34), 1.9, -0.8), CHROME);
    },
  },
  taxi: null, // défini plus bas (berline + enseigne)
  police: null,
};

CAR_TYPES.taxi = {
  ...CAR_TYPES.sedan,
  extra: (kit, { sec, detail, band }) => {
    // Enseigne lumineuse sur le toit
    kit.add(rbox(0.62, 0.2, 0.26, 0, 1.58, -0.2), { color: 0xfff2c0, rough: 0.3, glow: [0, 0, 0, 0.3] });
    kit.add(rbox(0.66, 0.04, 0.3, 0, 1.475, -0.2), TRIM);
    if (detail) {
      // Damier noir sur les flancs
      for (let k = 0; k < 12; k++) {
        const z = -1.25 + k * 0.2;
        const y = 0.8 + (k % 2) * 0.05;
        kit.addMirrored(patch(sec, range(z, z + 0.1, 1), band(y, y + 0.05, 1), { grow: 0.004 }), DARK);
      }
    }
  },
};

CAR_TYPES.police = {
  ...CAR_TYPES.sedan,
  extra: (kit, { sec, detail, band }) => {
    // Rampe de gyrophares (rouge à gauche, bleu à droite) et bandes bleues
    kit.add(rbox(0.5, 0.12, 0.26, 0.28, 1.54, -0.15), { color: 0x3040ff, rough: 0.2, glow: [0, 0, 0, 1] });
    kit.add(rbox(0.5, 0.12, 0.26, -0.28, 1.54, -0.15), { color: 0xff2030, rough: 0.2, glow: [0, 0, 0, 1] });
    kit.add(rbox(1.1, 0.05, 0.3, 0, 1.475, -0.15), TRIM);
    kit.addMirrored(patch(sec, range(-2.05, 2.0, detail ? 40 : 8), band(0.64, 0.74, 2), { grow: 0.004 }), { color: 0x1a3aa0, rough: 0.35, metal: 0.3 });
    if (detail) kit.addMirrored(patch(sec, range(-2.0, 1.9, 40), band(0.76, 0.79, 1), { grow: 0.004 }), { color: 0x1a3aa0, rough: 0.35, metal: 0.3 });
    // Pare-buffle
    if (detail) kit.add(rbox(0.8, 0.26, 0.06, 0, 0.52, 2.41), TRIM);
  },
};

// Fourgon de livraison : cabine avancée + caisse
function buildVan(detail) {
  const kit = new Kit();
  const L = 2.9;
  const W = 1.02;
  const R = 0.37;
  const wz = [1.75, -1.55];
  const archR = R + 0.09;
  const arch = (z) => {
    let v = 0.36;
    for (const c of wz) {
      const d = Math.abs(z - c);
      if (d < archR) v = Math.max(v, R + Math.sqrt(archR * archR - d * d) * 0.95);
    }
    return v;
  };
  // Cabine
  const cabSecBase = sectionFn({
    y0: 0.38,
    y1: [[1.0, 2.55], [1.4, 2.5], [2.2, 2.05], [2.6, 1.3], [2.8, 1.05], [L, 0.95]],
    ym: 1.0,
    w: [[1.0, W], [2.5, W - 0.02], [L, W - 0.1]],
    wt: [[1.0, W - 0.08], [L, W - 0.25]],
    wb: W - 0.06,
    nt: [[1.0, 6], [2.4, 4], [L, 3]],
    nb: 5,
  });
  const cabSec = (z) => {
    const s = cabSecBase(z);
    s.y0 = Math.max(s.y0, arch(z));
    return s;
  };
  const cz = range(1.0, L, detail ? 26 : 8);
  kit.add(patch(cabSec, cz, ring(detail ? 22 : 12), { capStart: true, capEnd: true }), PAINT);
  // Pare-brise et vitres latérales de cabine
  const sw = cabSec(2.3);
  const wTh0 = thetaAtY(sw, 1.45);
  kit.add(patch(cabSec, range(2.0, 2.62, detail ? 10 : 3), range(wTh0, Math.PI - wTh0, detail ? 16 : 6), { grow: 0.006 }), GLASS);
  {
    const s = cabSec(1.65);
    const [sx] = sePoint(s, thetaAtY(s, 1.8));
    const side = new THREE.PlaneGeometry(0.62, 0.62);
    side.rotateY(Math.PI / 2);
    side.translate(sx + 0.012, 1.8, 1.65);
    kit.addMirrored(side, GLASS);
  }
  // Caisse (blanche) avec arrondis
  const boxSec = sectionFn({ y0: 0.62, y1: 2.85, ym: 1.7, w: W + 0.06, wt: W + 0.03, wb: W + 0.03, nt: 12, nb: 12 });
  const bs = (z) => {
    const s = boxSec(z);
    s.y0 = Math.max(0.62, arch(z) + 0.04);
    return s;
  };
  kit.add(patch(bs, range(-L, 1.02, detail ? 18 : 6), ring(detail ? 22 : 12), { capStart: true, capEnd: true }), { color: 0xf2f2ee, rough: 0.5, metal: 0.1 });
  // Châssis, pare-chocs, feux
  kit.add(rbox(1.6, 0.3, 5.4, 0, 0.42, -0.1), DARK);
  for (const c of wz) kit.add(rbox(1.7, archR * 1.1, archR * 2, 0, R + 0.1, c), DARK);
  kit.add(rbox(2.0, 0.22, 0.14, 0, 0.5, L + 0.02), TRIM);
  kit.add(rbox(2.0, 0.2, 0.12, 0, 0.5, -L - 0.04), TRIM);
  kit.addMirrored(rbox(0.3, 0.16, 0.04, 0.7, 1.0, L - 0.08), LAMP_HEAD);
  kit.addMirrored(rbox(0.12, 0.4, 0.04, 1.0, 1.1, -L - 0.03), LAMP_TAIL);
  kit.addMirrored(rbox(0.1, 0.1, 0.04, 0.95, 0.85, L - 0.1), LAMP_IND);
  kit.add(plate(0.9, 0.22, 0, 0.72, L + 0.05), { ...TRIM, color: 0x0c0d0f, rough: 0.4, metal: 0.4 });
  kit.add(plate(0.5, 0.12, 0, 0.72, -L - 0.11, true), PLATE);
  if (detail) {
    kit.addMirrored(rbox(0.08, 0.3, 0.14, W + 0.12, 1.75, 2.1), TRIM);
    // Portes arrière (rainure)
    kit.add(plate(0.02, 2.0, 0, 1.72, -L - 0.005, true), DARK);
    kit.add(plate(0.9, 0.08, 0, 2.2, -L - 0.006, true), { color: 0x2b6fd1, rough: 0.5 });
    // Bande de couleur sur les flancs
    for (const s of [1, -1]) {
      const g = new THREE.PlaneGeometry(3.4, 0.35);
      g.rotateY((s * Math.PI) / 2);
      g.translate(s * (W + 0.066), 1.9, -0.9);
      kit.add(g, { color: 0x2b6fd1, rough: 0.5 });
    }
  }
  for (const c of wz) for (const s of [1, -1]) addWheel(kit, s * (W - 0.14), R, c, R, 0.24, detail);
  return kit.build();
}

// Bus urbain
function buildBus(detail) {
  const kit = new Kit();
  const L = 6.0;
  const W = 1.27;
  const R = 0.5;
  const wz = [3.6, -2.4];
  const archR = R + 0.1;
  const arch = (z) => {
    let v = 0.4;
    for (const c of wz) {
      const d = Math.abs(z - c);
      if (d < archR) v = Math.max(v, R + Math.sqrt(archR * archR - d * d));
    }
    return v;
  };
  const secB = sectionFn({
    y0: 0.4,
    y1: [[-L, 3.05], [L - 0.3, 3.05], [L, 2.9]],
    ym: 1.4,
    w: W,
    wt: W - 0.06,
    wb: W - 0.04,
    nt: 9,
    nb: 10,
  });
  const sec = (z) => {
    const s = secB(z);
    s.y0 = Math.max(s.y0, arch(z));
    return s;
  };
  kit.add(patch(sec, range(-L, L, detail ? 30 : 10), ring(detail ? 22 : 12), { capStart: true, capEnd: true }), PAINT);
  // Bandeau vitré continu sur les flancs
  const s0 = sec(0);
  const g0 = thetaAtY(s0, 1.35);
  const g1 = thetaAtY(s0, 2.55);
  kit.addMirrored(patch(sec, range(-L + 0.4, L - 0.25, detail ? 40 : 6), range(g0, g1, 3), { grow: 0.008 }), GLASS);
  if (detail) {
    // Montants entre les vitres
    for (let z = -L + 1.3; z < L - 0.6; z += 1.5) kit.addMirrored(patch(sec, range(z - 0.06, z + 0.06, 1), range(g0, g1, 3), { grow: 0.012 }), PAINT);
    // Portes
    for (const dz of [4.4, 0.4]) kit.add(plate(1.1, 2.1, W + 0.02, 1.45, dz).rotateY(0), GLASS);
    // Girouette lumineuse
    kit.add(plate(1.6, 0.25, 0, 2.78, L + 0.012), { color: 0xffb030, rough: 0.3, glow: [0, 0, 0, 0.3] });
  }
  // Pare-brise, lunette
  kit.add(plate(2.3, 1.45, 0, 1.95, L + 0.01), GLASS);
  kit.add(plate(2.0, 0.9, 0, 2.2, -L - 0.01, true), GLASS);
  kit.add(rbox(2.3, 0.3, 11.4, 0, 0.45, 0), DARK);
  for (const c of wz) kit.add(rbox(2.2, archR * 1.1, archR * 2, 0, R + 0.1, c), DARK);
  kit.addMirrored(rbox(0.3, 0.14, 0.04, 0.9, 0.8, L + 0.01), LAMP_HEAD);
  kit.addMirrored(rbox(0.16, 0.34, 0.04, 1.1, 0.95, -L - 0.01), LAMP_TAIL);
  kit.addMirrored(rbox(0.12, 0.12, 0.04, 1.12, 0.55, L + 0.01), LAMP_IND);
  kit.add(rbox(2.5, 0.28, 0.16, 0, 0.55, L + 0.05), TRIM);
  kit.add(rbox(2.5, 0.28, 0.16, 0, 0.55, -L - 0.05), TRIM);
  // Bande bleue MTA
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(11.4, 0.3);
    g.rotateY((s * Math.PI) / 2);
    g.translate(s * (W + 0.012), 1.08, 0);
    kit.add(g, { color: 0x1f5fd1, rough: 0.4 });
  }
  for (const c of wz) for (const s of [1, -1]) addWheel(kit, s * (W - 0.2), R, c, R, 0.3, detail);
  return kit.build();
}

export const VEHICLE_KINDS = [
  { key: 'sedan', build: (d) => buildCar(CAR_TYPES.sedan, d), len: 4.75, radius: 2.6, weight: 0.3 },
  { key: 'compact', build: (d) => buildCar(CAR_TYPES.compact, d), len: 4.1, radius: 2.3, weight: 0.17 },
  { key: 'suv', build: (d) => buildCar(CAR_TYPES.suv, d), len: 4.9, radius: 2.7, weight: 0.18 },
  { key: 'taxi', build: (d) => buildCar(CAR_TYPES.taxi, d), len: 4.75, radius: 2.6, weight: 0.22, paint: '#f2b705' },
  { key: 'van', build: (d) => buildVan(d), len: 5.8, radius: 3.3, weight: 0.08 },
  { key: 'bus', build: (d) => buildBus(d), len: 12, radius: 6.4, weight: 0.05, paint: '#e8ecef' },
  { key: 'police', build: (d) => buildCar(CAR_TYPES.police, d), len: 4.75, radius: 2.6, weight: 0.0, paint: '#f4f6f8' },
];

export const PAINTS = ['#9e1b1b', '#1d3a7a', '#e8e8e8', '#1b1c1e', '#6c757c', '#2d5a3a', '#a5abb2', '#4e1d42', '#b8661c', '#0f2238', '#c9c2b0', '#7a0f12', '#3a4a5a'];

// Matériau partagé : peinture par instance, feux, clignotants, gyrophares, roues tournantes
export function makeVehicleMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uVehTime = uniforms.time;
    sh.uniforms.uNight = uniforms.night;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 surf;
        attribute vec4 glow;
        attribute vec4 wheel;
        attribute vec3 iPaint;
        attribute vec4 iState;
        varying vec3 vSurf;
        varying vec4 vGlow;
        varying vec3 vPaint;
        varying vec4 vState;
        varying float vSideX;
        mat3 wheelRot(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = vec3(normal);
        if (wheel.w > 0.5) objectNormal = wheelRot(iState.w) * objectNormal;
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        if (wheel.w > 0.5) transformed = wheel.xyz + wheelRot(iState.w) * (position - wheel.xyz);
        vSurf = surf; vGlow = glow; vPaint = iPaint; vState = iState; vSideX = position.x;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uVehTime;
        uniform float uNight;
        varying vec3 vSurf;
        varying vec4 vGlow;
        varying vec3 vPaint;
        varying vec4 vState;
        varying float vSideX;`,
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vPaint, vSurf.x);')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.z;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float headOn = vState.y;
        totalEmissiveRadiance += vGlow.r * vec3(1.0, 0.03, 0.02) * (0.25 + headOn * 0.9 + vState.x * 3.2);
        totalEmissiveRadiance += vGlow.g * vec3(1.0, 0.95, 0.86) * (headOn * 5.0);
        float blinkSide = vState.z > 1.5 ? 0.0 : (vState.z * vSideX > 0.0 ? 1.0 : 0.0);
        float blink = step(0.5, fract(uVehTime * 1.6));
        totalEmissiveRadiance += vGlow.b * vec3(1.0, 0.45, 0.02) * blinkSide * blink * 3.0;
        float bar = step(0.5, vGlow.a);
        float siren = step(1.5, vState.z);
        float ph = fract(uVehTime * 2.2);
        float flashL = step(0.5, ph) * step(0.0, -vSideX);
        float flashR = (1.0 - step(0.5, ph)) * step(0.0, vSideX);
        totalEmissiveRadiance += bar * siren * diffuseColor.rgb * (flashL + flashR) * 12.0;
        totalEmissiveRadiance += (1.0 - bar) * step(0.05, vGlow.a) * vec3(1.0, 0.85, 0.55) * (0.3 + uNight * 2.2);`,
      );
  };
  return mat;
}

// Géométries des véhicules (LOD proche / lointain), créées une seule fois
let _cache = null;
export function vehicleGeometries() {
  if (_cache) return _cache;
  _cache = VEHICLE_KINDS.map((k) => ({ ...k, near: k.build(true), far: k.build(false) }));
  return _cache;
}

// Ajoute les attributs d'instance (peinture, état des feux) à une géométrie partagée
export function instancedVehicleGeometry(geo, count) {
  const g = new THREE.BufferGeometry();
  for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
  g.setIndex(geo.index);
  g.boundingSphere = geo.boundingSphere;
  g.setAttribute('iPaint', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3));
  g.setAttribute('iState', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
  return g;
}
