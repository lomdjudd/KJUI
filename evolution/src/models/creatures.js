// Modèles procéduraux des êtres vivants (hors humains).
// Convention : regard vers +Z, taille normalisée ~1, mise à l'échelle par l'appelant.
// Les modèles terrestres ont leur origine aux pieds ; les nageurs au centre.
import * as THREE from 'three';
import { mat, part, sph, cyl, cone, box, pivot, limb, shade, G_SPH, G_CONE, G_ICO, G_HEMI, G_CYL, G_BOX } from './kit.js';

const BLACK = 0x111111;
const WHITE = 0xf5f5f0;

function eyes(parent, y, z, x, r = 0.08, color = BLACK) {
  sph(parent, WHITE, [x, y, z], r, { r: 0.3 }, 8);
  sph(parent, WHITE, [-x, y, z], r, { r: 0.3 }, 8);
  sph(parent, color, [x * 1.05, y, z + r * 0.6], r * 0.55, { r: 0.2 }, 6);
  sph(parent, color, [-x * 1.05, y, z + r * 0.6], r * 0.55, { r: 0.2 }, 6);
}

// ===================== MICROSCOPIQUE =====================

export function buildCell(color = 0x6fd6ff, muts = [], opts = {}) {
  const g = new THREE.Group();
  const rig = { flag: [], gait: 6 };
  const body = pivot(g);
  rig.pulse = body;
  // Membrane translucide + cytoplasme
  part(body, G_SPH(20), mat(color, { op: 0.45, r: 0.2, e: color, ei: 0.25 }), [0, 0, 0], 1, null, false);
  if (muts.includes('membrane')) part(body, G_SPH(20), mat(shade(color, 0.7), { op: 0.25, r: 0.3 }), [0, 0, 0], 1.12, null, false);
  // Noyau(x)
  const nuc = muts.includes('noyau') ? [[-0.2, 0.05, 0], [0.22, -0.05, 0.05]] : [[0, 0.05, -0.05]];
  for (const p of nuc) {
    sph(body, 0x5a3a9a, p, 0.32, { r: 0.4, e: 0x2a1a5a, ei: 0.5 });
    sph(body, 0x9a6aff, [p[0] + 0.08, p[1] + 0.08, p[2] + 0.1], 0.1, { e: 0x6a3aff, ei: 0.6 }, 6);
  }
  // Organites
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    sph(body, 0xffc46a, [Math.cos(a) * 0.55, Math.sin(a * 1.7) * 0.3, Math.sin(a) * 0.5], 0.08, { e: 0x8a5a10, ei: 0.4 }, 6);
  }
  if (muts.includes('chloroplaste')) {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4;
      part(body, G_SPH(8), mat(0x2aaa3a, { e: 0x0a5a1a, ei: 0.4 }), [Math.cos(a) * 0.5, Math.sin(a * 2) * 0.35, Math.sin(a) * 0.5], [0.16, 0.09, 0.09], [0, a, 0], false);
    }
  }
  if (muts.includes('epines')) {
    const sc = muts.includes('toxine') ? 0xb04aff : 0xfff0d0;
    const N = 14;
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const th = Math.PI * (1 + Math.sqrt(5)) * i;
      const d = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
      const c = part(body, G_CONE(5), mat(sc, { e: muts.includes('toxine') ? 0x6a1aaa : undefined, ei: 0.6 }), d.clone().multiplyScalar(1.05).toArray(), [0.08, 0.35, 0.08]);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    }
  }
  if (muts.includes('cils')) {
    const ring = pivot(g);
    rig.cilia = ring;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const c = part(ring, G_CYL(3), mat(0xd0f0ff, { op: 0.8 }), d.clone().multiplyScalar(1.08).toArray(), [0.015, 0.3, 0.015], null, false);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    }
  }
  if (muts.includes('flagelle') || opts.flagellum) {
    let prev = pivot(g, [0, 0, -0.95]);
    for (let i = 0; i < 6; i++) {
      rig.flag.push(prev);
      cyl(prev, 0xd0f0ff, [0, 0, -0.18], [0.04 - i * 0.005, 0.36, 0.04 - i * 0.005], [Math.PI / 2, 0, 0], { op: 0.9 }, 4);
      prev = pivot(prev, [0, 0, -0.36]);
    }
  }
  if (opts.eyes) eyes(body, 0.3, 0.85, 0.3, 0.14);
  g.userData.rig = rig;
  return g;
}

export function buildBacteria(color) {
  const g = new THREE.Group();
  const rig = { flag: [] };
  cyl(g, color, [0, 0, 0], [0.4, 1.2, 0.4], [Math.PI / 2, 0, 0], { op: 0.85, e: color, ei: 0.2 }, 10);
  sph(g, color, [0, 0, 0.6], 0.4, { op: 0.85, e: color, ei: 0.2 }, 10);
  sph(g, color, [0, 0, -0.6], 0.4, { op: 0.85, e: color, ei: 0.2 }, 10);
  sph(g, shade(color, 0.5), [0, 0.05, 0], 0.18, {}, 6);
  let prev = pivot(g, [0, 0, -0.95]);
  for (let i = 0; i < 4; i++) {
    rig.flag.push(prev);
    cyl(prev, shade(color, 1.2), [0, 0, -0.15], [0.03, 0.3, 0.03], [Math.PI / 2, 0, 0], {}, 4);
    prev = pivot(prev, [0, 0, -0.3]);
  }
  g.userData.rig = rig;
  return g;
}

export function buildAlgae(color) {
  const g = new THREE.Group();
  const b = pivot(g);
  sph(b, color, [0, 0, 0], 1, { op: 0.6, e: color, ei: 0.3 }, 14);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.8;
    sph(b, 0x1a8a2a, [Math.cos(a) * 0.5, Math.sin(a * 1.5) * 0.4, Math.sin(a) * 0.5], 0.2, { e: 0x0a4a0a, ei: 0.4 }, 6);
  }
  g.userData.rig = { pulse: b };
  return g;
}

export function buildVirus(color) {
  const g = new THREE.Group();
  const b = pivot(g);
  part(b, G_ICO(), mat(color, { flat: true, e: color, ei: 0.4 }), [0, 0, 0], 0.7);
  // 12 pointes (sommets de l'icosaèdre)
  const t = (1 + Math.sqrt(5)) / 2;
  const dirs = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  for (const d0 of dirs) {
    const d = new THREE.Vector3(...d0).normalize();
    const c = part(b, G_CYL(4), mat(0xffd0e0), d.clone().multiplyScalar(0.9).toArray(), [0.05, 0.55, 0.05]);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  }
  g.userData.rig = { pulse: b };
  return g;
}

export function buildWorm(color) {
  const g = new THREE.Group();
  const rig = { snake: [] };
  let prev = pivot(g, [0, 0, 0.6]);
  sph(prev, color, [0, 0, 0], 0.32, { op: 0.9 }, 10);
  eyes(prev, 0.12, 0.22, 0.12, 0.07);
  for (let i = 0; i < 7; i++) {
    const p = pivot(prev, [0, 0, -0.32]);
    sph(p, i % 2 ? color : shade(color, 0.85), [0, 0, 0], 0.3 - i * 0.025, { op: 0.9 }, 10);
    rig.snake.push(p);
    prev = p;
  }
  g.userData.rig = rig;
  return g;
}

export function buildMulti(color = 0x6fd6ff, muts = [], opts = {}) {
  const g = new THREE.Group();
  const rig = { tent: [], flag: [] };
  const body = pivot(g);
  rig.pulse = body;
  const long = muts.includes('corde');
  const N = long ? 11 : 8;
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996;
    const r = 0.45 * Math.sqrt(i / N) + 0.1;
    const z = long ? (i / N - 0.5) * 1.6 : Math.sin(a) * r;
    const p = [Math.cos(a) * r, Math.sin(a * 0.7) * 0.25, z];
    part(body, G_SPH(12), mat(i % 3 ? color : shade(color, 0.8), { op: 0.7, r: 0.3, e: color, ei: 0.15 }), p, 0.42, null, false);
    sph(body, 0x5a3a9a, p, 0.14, { e: 0x2a1a5a, ei: 0.4 }, 6);
  }
  if (muts.includes('carapace')) part(body, G_HEMI(), mat(0xc8a070, { r: 0.5, flat: true }), [0, 0.1, 0], [0.85, 0.6, long ? 1.1 : 0.85]);
  if (muts.includes('oeil') || opts.eyes) eyes(body, 0.25, long ? 0.85 : 0.6, 0.22, 0.14);
  if (muts.includes('machoire_p')) {
    cone(body, 0xfff0d0, [0.15, -0.1, long ? 1 : 0.75], [0.07, 0.3, 0.07], [Math.PI / 2, 0, 0]);
    cone(body, 0xfff0d0, [-0.15, -0.1, long ? 1 : 0.75], [0.07, 0.3, 0.07], [Math.PI / 2, 0, 0]);
  }
  if (muts.includes('nageoire_p')) {
    for (const sx of [-1, 1]) {
      const f = pivot(body, [sx * 0.55, 0, 0]);
      box(f, shade(color, 1.2), [sx * 0.25, 0, 0], [0.5, 0.04, 0.35], null, { op: 0.8 });
      (rig.fins ||= []).push({ pv: f, ph: 0, sign: sx });
    }
  }
  if (muts.includes('tentacules')) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      let prev = pivot(body, [Math.cos(a) * 0.35, Math.sin(a) * 0.35, long ? -0.9 : -0.55]);
      for (let k = 0; k < 4; k++) {
        cyl(prev, shade(color, 0.9), [0, 0, -0.15], [0.05 - k * 0.01, 0.3, 0.05 - k * 0.01], [Math.PI / 2, 0, 0], {}, 4);
        rig.tent.push(prev);
        prev = pivot(prev, [0, 0, -0.3]);
      }
    }
  }
  g.userData.rig = rig;
  return g;
}

// ===================== OCÉAN =====================

export function buildFish(color = 0x7ab8ff, o = {}) {
  const g = new THREE.Group();
  const rig = { tail: [], fins: [], tailF: 7, tailAmp: 0.35 };
  const belly = o.belly ?? shade(color, 1.4);
  const len = o.len ?? 1;
  const body = pivot(g);
  part(body, G_SPH(14), mat(color, { r: o.metal ? 0.3 : 0.5, m: o.metal ? 0.6 : 0.1 }), [0, 0, 0], [0.32 * (o.fat ?? 1), 0.4 * (o.fat ?? 1), len]);
  part(body, G_SPH(12), mat(belly, { r: 0.5 }), [0, -0.12, 0.05], [0.27 * (o.fat ?? 1), 0.27, len * 0.9]);
  // Rayures
  if (o.stripes) for (let i = -1; i <= 1; i++) part(body, G_SPH(10), mat(o.stripes), [0, 0.02, i * 0.35], [0.33, 0.41, 0.06]);
  // Tête et yeux
  eyes(body, 0.12, len * 0.72, 0.18, 0.07);
  if (o.teeth) {
    for (let i = -2; i <= 2; i++) cone(body, WHITE, [i * 0.05, -0.08, len * 0.95], [0.025, 0.08, 0.025], [Math.PI, 0, 0], {}, 4);
  }
  // Queue
  let prev = pivot(body, [0, 0, -len * 0.85]);
  rig.tail.push(prev);
  const t2 = pivot(prev, [0, 0, -0.25]);
  rig.tail.push(t2);
  part(t2, G_BOX(), mat(shade(color, 0.85), { op: 0.95 }), [0, 0.18, -0.15], [0.03, 0.45, 0.3], [0.5, 0, 0]);
  part(t2, G_BOX(), mat(shade(color, 0.85), { op: 0.95 }), [0, -0.18, -0.15], [0.03, 0.45, 0.3], [-0.5, 0, 0]);
  // Nageoires
  part(body, G_BOX(), mat(shade(color, 0.85)), [0, 0.42, -0.1], [0.03, o.dorsal ?? 0.3, 0.4], [-0.3, 0, 0]);
  for (const sx of [-1, 1]) {
    const f = pivot(body, [sx * 0.28, -0.1, len * 0.3]);
    if (o.lobed) {
      cyl(f, shade(color, 0.8), [sx * 0.15, -0.05, 0], [0.06, 0.32, 0.06], [0, 0, Math.PI / 2], {}, 6);
      box(f, shade(color, 0.7), [sx * 0.32, -0.06, 0], [0.12, 0.03, 0.18]);
    } else box(f, shade(color, 0.9), [sx * 0.18, 0, 0], [0.35, 0.025, 0.2], [0, 0, sx * -0.3], { op: 0.9 });
    rig.fins.push({ pv: f, ph: sx, sign: sx });
  }
  if (o.glow) for (let i = 0; i < 6; i++) sph(body, 0x6af0ff, [0.3 * (i % 2 ? 1 : -1), 0, len * (0.6 - i * 0.2)], 0.04, { e: 0x6af0ff, ei: 2 }, 5);
  g.userData.rig = rig;
  return g;
}

export function buildShark(color = 0x7a8a9a, o = {}) {
  const g = buildFish(color, { len: 1, fat: 0.85, belly: 0xe8e8e8, dorsal: 0.6, teeth: true, metal: o.armored });
  if (o.armored) {
    // Plaques osseuses sur la tête (Dunkleosteus)
    const head = g.children[0];
    part(head, G_SPH(8), mat(0x8a7a5a, { flat: true, r: 0.4 }), [0, 0.05, 0.65], [0.36, 0.42, 0.4]);
  }
  return g;
}

export function buildJelly(color) {
  const g = new THREE.Group();
  const rig = { tent: [] };
  const b = pivot(g);
  rig.pulse = b;
  part(b, G_HEMI(), mat(color, { op: 0.55, e: color, ei: 0.4, side: THREE.DoubleSide }), [0, 0, 0], [1, 0.8, 1], null, false);
  sph(b, shade(color, 1.3), [0, 0.2, 0], 0.4, { op: 0.7, e: color, ei: 0.6 }, 10);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    let prev = pivot(g, [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6]);
    for (let k = 0; k < 4; k++) {
      cyl(prev, color, [0, -0.25, 0], [0.025, 0.5, 0.025], null, { op: 0.7, e: color, ei: 0.5 }, 3);
      rig.tent.push(prev);
      prev = pivot(prev, [0, -0.5, 0]);
    }
  }
  g.userData.rig = rig;
  return g;
}

export function buildSquid(color) {
  const g = new THREE.Group();
  const rig = { tent: [] };
  part(g, G_CONE(10), mat(color, { r: 0.4 }), [0, 0, -0.3], [0.35, 1.2, 0.35], [-Math.PI / 2, 0, 0]);
  sph(g, color, [0, 0, 0.35], 0.33, {}, 10);
  eyes(g, 0.1, 0.45, 0.24, 0.1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    let prev = pivot(g, [Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.6]);
    for (let k = 0; k < 3; k++) {
      cyl(prev, shade(color, 1.1), [0, 0, 0.17], [0.05 - k * 0.012, 0.34, 0.05 - k * 0.012], [Math.PI / 2, 0, 0], {}, 5);
      rig.tent.push(prev);
      prev = pivot(prev, [0, 0, 0.34]);
    }
  }
  g.userData.rig = rig;
  return g;
}

export function buildShrimp(color) {
  const g = new THREE.Group();
  const rig = { tail: [] };
  let prev = g;
  for (let i = 0; i < 6; i++) {
    const p = pivot(prev, [0, i === 0 ? 0 : 0.02, i === 0 ? 0.4 : -0.18]);
    sph(p, i % 2 ? color : shade(color, 0.9), [0, 0, 0], 0.18 - i * 0.02, {}, 8);
    if (i > 0) rig.tail.push(p);
    prev = p;
  }
  cyl(g, color, [0.1, 0.1, 0.8], [0.01, 0.6, 0.01], [1.2, 0.3, 0]);
  cyl(g, color, [-0.1, 0.1, 0.8], [0.01, 0.6, 0.01], [1.2, -0.3, 0]);
  eyes(g, 0.1, 0.5, 0.08, 0.04);
  g.userData.rig = rig;
  return g;
}

export function buildTrilobite(color) {
  const g = new THREE.Group();
  part(g, G_SPH(12), mat(color, { r: 0.6, flat: true }), [0, 0.15, 0], [0.55, 0.18, 0.9]);
  for (let i = -3; i <= 3; i++) part(g, G_BOX(), mat(shade(color, 0.75)), [0, 0.28, i * 0.2], [0.9, 0.05, 0.05]);
  sph(g, shade(color, 1.2), [0, 0.22, 0.75], [0.35, 0.12, 0.2], {}, 8);
  eyes(g, 0.32, 0.7, 0.18, 0.05);
  g.userData.rig = {};
  return g;
}

// ===================== TERRE FERME =====================

// Quadrupède générique. Origine aux pieds, longueur ~1.6, hauteur au garrot ~0.8
export function buildQuad(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0x8a6a4a;
  const len = o.len ?? 1;
  const legLen = o.legLen ?? 0.5;
  const legW = o.legW ?? 0.07;
  const sprawl = o.sprawl ?? 0;
  const bodyY = legLen + (o.bodyH ?? 0.25) * 0.6 - sprawl * legLen * 0.6;
  const rig = { legs: [], tail: [], gait: o.gait ?? 6, freq: o.freq ?? 9, bob: 0.04, bodyY, legAmp: o.legAmp ?? 0.7 };
  const body = pivot(g, [0, bodyY, 0]);
  rig.body = body;
  const furO = o.fur ? { r: 1 } : { r: 0.7 };
  part(body, G_SPH(14), mat(c, furO), [0, 0, 0], [o.bodyW ?? 0.3, o.bodyH ?? 0.25, len * 0.55]);
  if (o.belly) part(body, G_SPH(10), mat(o.belly), [0, -0.06, 0.05], [(o.bodyW ?? 0.3) * 0.85, (o.bodyH ?? 0.25) * 0.8, len * 0.48]);
  if (o.hump) sph(body, shade(c, 0.9), [0, (o.bodyH ?? 0.25) * 0.7, len * 0.2], [0.3, 0.3, 0.35], furO);
  if (o.spots) for (let i = 0; i < 6; i++) sph(body, o.spots, [((i % 3) - 1) * 0.15, (o.bodyH ?? 0.25) * 0.85, (i / 6 - 0.4) * len], 0.06, {}, 6);
  if (o.spikes) for (let i = 0; i < 6; i++) cone(body, o.spikes, [0, (o.bodyH ?? 0.25) * 0.95, (0.35 - i * 0.14) * len], [0.04, 0.15, 0.04], null, { flat: true }, 4);
  if (o.shaggy) for (let i = 0; i < 8; i++) cone(body, shade(c, 0.85), [((i % 2) * 2 - 1) * (o.bodyW ?? 0.3) * 0.9, -(o.bodyH ?? 0.25) * 0.7, (i / 8 - 0.45) * len], [0.06, 0.25, 0.06], [Math.PI, 0, 0], furO, 4);

  // Pattes
  const lx = (o.bodyW ?? 0.3) * 0.75 + sprawl * 0.15;
  const lz = len * 0.38;
  const legs = [
    [lx, lz, 0],
    [-lx, lz, Math.PI],
    [lx, -lz, Math.PI],
    [-lx, -lz, 0],
  ];
  for (const [x, z, ph] of legs) {
    const pv = pivot(g, [x, legLen + 0.02 - sprawl * legLen * 0.6, z]);
    if (sprawl) {
      cyl(pv, c, [Math.sign(x) * 0.1, -0.02, 0], [legW, 0.22, legW], [0, 0, Math.PI / 2], furO, 5);
      cyl(pv, c, [Math.sign(x) * 0.2, -legLen * 0.25, 0], [legW * 0.9, legLen * 0.5, legW * 0.9], null, furO, 5);
      box(pv, shade(c, 0.8), [Math.sign(x) * 0.22, -legLen * 0.5, 0.04], [0.12, 0.03, 0.12]);
    } else {
      cyl(pv, c, [0, -legLen * 0.5, 0], [legW, legLen, legW], null, furO, 6);
      box(pv, o.hoof ?? shade(c, 0.5), [0, -legLen + 0.02, 0.02], [legW * 2, 0.05, legW * 2.4]);
      if (o.claws) for (let k = -1; k <= 1; k++) cone(pv, 0xf0f0e0, [k * legW * 0.6, -legLen + 0.02, legW * 1.4], [0.015, 0.06, 0.015], [Math.PI / 2, 0, 0], {}, 3);
    }
    rig.legs.push({ pv, ph });
  }

  // Cou et tête
  const neck = pivot(body, [0, (o.bodyH ?? 0.25) * 0.3, len * 0.5]);
  const neckLen = o.neck ?? 0.2;
  if (neckLen > 0.05) cyl(neck, c, [0, neckLen * 0.4, neckLen * 0.3], [0.09 * (o.neckW ?? 1), neckLen, 0.09 * (o.neckW ?? 1)], [0.7, 0, 0], furO, 6);
  const head = pivot(neck, [0, neckLen * 0.75, neckLen * 0.6]);
  rig.head = head;
  const hs = o.head ?? 0.16;
  part(head, G_SPH(12), mat(c, furO), [0, 0, 0.05], [hs * (o.headW ?? 1), hs * 0.9, hs * 1.15]);
  const snout = o.snout ?? 0.12;
  if (snout > 0) part(head, G_SPH(10), mat(o.snoutColor ?? shade(c, 1.1)), [0, -hs * 0.25, hs + snout * 0.5], [hs * 0.55, hs * 0.5, snout]);
  sph(head, BLACK, [0, -hs * 0.15, hs + snout * 1.4], 0.025, {}, 5);
  eyes(head, hs * 0.35, hs * 0.75, hs * 0.55, o.eyeSize ?? 0.035);
  if (o.ears === 'long') {
    for (const sx of [-1, 1]) part(head, G_SPH(8), mat(c), [sx * hs * 0.4, hs * 1.4, -0.02], [0.04, 0.2, 0.07], [0, 0, sx * -0.15]);
  } else if (o.ears === 'round') {
    for (const sx of [-1, 1]) sph(head, c, [sx * hs * 0.7, hs * 0.8, -0.02], 0.06, furO, 6);
  } else if (o.ears !== false) {
    for (const sx of [-1, 1]) cone(head, c, [sx * hs * 0.55, hs * 0.85, -0.02], [0.045, 0.13, 0.03], [0, 0, sx * -0.2], furO, 4);
  }
  if (o.antlers) {
    for (const sx of [-1, 1]) {
      const a = pivot(head, [sx * hs * 0.4, hs * 0.8, 0]);
      cyl(a, 0xd8c8a0, [sx * 0.08, 0.15, 0], [0.02, 0.35, 0.02], [0, 0, sx * -0.5], {}, 4);
      cyl(a, 0xd8c8a0, [sx * 0.2, 0.3, 0.05], [0.015, 0.25, 0.015], [0.3, 0, sx * -0.9], {}, 4);
      cyl(a, 0xd8c8a0, [sx * 0.12, 0.38, -0.02], [0.015, 0.2, 0.015], [-0.3, 0, sx * -0.2], {}, 4);
    }
  }
  if (o.tusks) {
    for (const sx of [-1, 1]) {
      const t = pivot(head, [sx * hs * 0.35, -hs * 0.45, hs + snout * 0.5]);
      cyl(t, 0xf5f0e0, [0, -0.05, 0.12 * o.tusks], [0.025 * o.tusks, 0.35 * o.tusks, 0.025 * o.tusks], [1.2, 0, sx * 0.2], {}, 5);
    }
  }
  if (o.trunk) {
    let prev = pivot(head, [0, -hs * 0.3, hs * 1.1]);
    for (let k = 0; k < 4; k++) {
      cyl(prev, c, [0, -0.1, 0], [0.07 - k * 0.012, 0.22, 0.07 - k * 0.012], null, furO, 6);
      const n = pivot(prev, [0, -0.2, 0]);
      n.rotation.x = 0.25;
      prev = n;
    }
  }
  if (o.teeth) for (const sx of [-1, 1]) cone(head, WHITE, [sx * hs * 0.25, -hs * 0.55, hs + snout * 1.2], [0.015, 0.07, 0.015], [Math.PI, 0, 0], {}, 3);
  if (o.comb) box(head, 0xd02020, [0, hs * 1, 0.05], [0.03, 0.08, 0.12]);
  if (o.beak) cone(head, 0xe8b030, [0, -hs * 0.1, hs * 1.2], [0.04, 0.12, 0.04], [Math.PI / 2, 0, 0], {}, 4);

  // Queue
  const tl = o.tail ?? 0.3;
  if (tl > 0) {
    let prev = pivot(body, [0, (o.bodyH ?? 0.25) * 0.2, -len * 0.52]);
    const segs = o.tailSegs ?? 3;
    for (let k = 0; k < segs; k++) {
      const w = (o.tailW ?? 0.05) * (1 - k / (segs + 1));
      cyl(prev, o.tailTip && k === segs - 1 ? o.tailTip : c, [0, 0, -tl / segs / 2], [w, tl / segs, w], [Math.PI / 2 + (o.tailUp ?? 0), 0, 0], furO, 5);
      rig.tail.push(prev);
      prev = pivot(prev, [0, (o.tailUp ?? 0) * 0.1, -tl / segs]);
    }
    if (o.puff) sph(prev, WHITE, [0, 0, 0.05], 0.08, {}, 6);
  }
  g.userData.rig = rig;
  return g;
}

// Dinosaure bipède (raptor / T-rex). Origine aux pieds.
export function buildTheropod(o = {}) {
  const g = new THREE.Group();
  const c = o.color ?? 0x8a6a3a;
  const legLen = o.legLen ?? 0.55;
  const rig = { legs: [], tail: [], gait: o.gait ?? 8, freq: o.freq ?? 7, bob: 0.06, bodyY: legLen + 0.15, legAmp: 0.8, tailAmp: 0.15 };
  const body = pivot(g, [0, legLen + 0.15, 0]);
  rig.body = body;
  part(body, G_SPH(14), mat(c, { r: 0.7 }), [0, 0, 0], [0.22, 0.24, 0.45]);
  part(body, G_SPH(10), mat(o.belly ?? shade(c, 1.35)), [0, -0.07, 0.03], [0.18, 0.18, 0.4]);
  if (o.stripes) for (let i = 0; i < 4; i++) part(body, G_SPH(8), mat(o.stripes), [0, 0.06, 0.25 - i * 0.15], [0.23, 0.2, 0.04]);
  for (const sx of [-1, 1]) {
    const pv = pivot(g, [sx * 0.14, legLen + 0.1, -0.05]);
    cyl(pv, c, [0, -0.12, 0.04], [0.08, 0.3, 0.08], [0.3, 0, 0], {}, 6);
    cyl(pv, c, [0, -legLen * 0.65, -0.02], [0.05, legLen * 0.6, 0.05], [-0.2, 0, 0], {}, 6);
    box(pv, shade(c, 0.7), [0, -legLen - 0.08, 0.06], [0.1, 0.04, 0.2]);
    if (o.claw) cone(pv, WHITE, [0, -legLen - 0.02, 0.12], [0.02, 0.1, 0.02], [1, 0, 0], {}, 3);
    rig.legs.push({ pv, ph: sx > 0 ? 0 : Math.PI });
    // Petits bras
    const arm = pivot(body, [sx * 0.15, -0.02, 0.35]);
    cyl(arm, c, [0, -0.06, 0.03], [0.025, o.armLen ?? 0.14, 0.025], [0.6, 0, 0], {}, 5);
  }
  const neck = pivot(body, [0, 0.1, 0.4]);
  cyl(neck, c, [0, 0.08, 0.05], [0.09, 0.22, 0.09], [0.5, 0, 0], {}, 6);
  const head = pivot(neck, [0, 0.2, 0.12]);
  rig.head = head;
  const hs = o.head ?? 0.13;
  part(head, G_BOX(), mat(c, { r: 0.7 }), [0, 0.02, 0.1], [hs * 1.3, hs * 1.1, hs * 2.6]);
  const jaw = pivot(head, [0, -hs * 0.45, 0]);
  rig.jaw = jaw;
  box(jaw, shade(c, 0.9), [0, -0.02, hs * 1.1], [hs * 1.15, hs * 0.4, hs * 2.2]);
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) cone(head, WHITE, [sx * hs * 0.5, -hs * 0.48, hs * (1.9 - i * 0.4)], [0.012, 0.05, 0.012], [Math.PI, 0, 0], {}, 3);
  }
  eyes(head, hs * 0.4, hs * 0.8, hs * 0.62, 0.03, 0xaa8800);
  if (o.crest) for (let i = 0; i < 3; i++) cone(head, o.crest, [0, hs * 0.7, hs * (0.6 - i * 0.4)], [0.03, 0.12, 0.03], null, {}, 3);
  let prev = pivot(body, [0, 0.03, -0.42]);
  for (let k = 0; k < 5; k++) {
    const w = 0.14 * (1 - k / 6);
    cyl(prev, c, [0, 0, -0.12], [w, 0.24, w], [Math.PI / 2 + 0.05, 0, 0], {}, 6);
    rig.tail.push(prev);
    prev = pivot(prev, [0, -0.01, -0.24]);
  }
  g.userData.rig = rig;
  return g;
}

export function buildSauropod(color) {
  const g = buildQuad({ color, len: 1.3, legLen: 0.55, legW: 0.1, bodyW: 0.38, bodyH: 0.35, neck: 0, head: 0.08, snout: 0.06, ears: false, tail: 0, gait: 3, freq: 4 });
  const rig = g.userData.rig;
  const body = rig.body;
  let prev = pivot(body, [0, 0.2, 0.6]);
  for (let k = 0; k < 6; k++) {
    cyl(prev, color, [0, 0.12, 0.06], [0.11 - k * 0.01, 0.28, 0.11 - k * 0.01], [0.45 - k * 0.07, 0, 0], {}, 6);
    prev = pivot(prev, [0, 0.25, 0.1 - k * 0.01]);
  }
  part(prev, G_SPH(8), mat(color), [0, 0.03, 0.08], [0.09, 0.08, 0.16]);
  eyes(prev, 0.05, 0.12, 0.07, 0.02);
  rig.tail = [];
  let t = pivot(body, [0, 0.05, -0.65]);
  for (let k = 0; k < 7; k++) {
    cyl(t, color, [0, 0, -0.12], [0.12 * (1 - k / 8), 0.24, 0.12 * (1 - k / 8)], [Math.PI / 2 + 0.06, 0, 0], {}, 6);
    rig.tail.push(t);
    t = pivot(t, [0, -0.015, -0.24]);
  }
  rig.tailAmp = 0.12;
  return g;
}

export function buildSnake(color) {
  const g = new THREE.Group();
  const rig = { snake: [] };
  let prev = pivot(g, [0, 0.08, 0.6]);
  part(prev, G_SPH(8), mat(color), [0, 0, 0.05], [0.09, 0.06, 0.14]);
  eyes(prev, 0.04, 0.12, 0.06, 0.02, 0xaa2200);
  cyl(prev, 0xd02040, [0, -0.01, 0.22], [0.008, 0.1, 0.008], [Math.PI / 2, 0, 0], {}, 3);
  for (let i = 0; i < 10; i++) {
    const p = pivot(prev, [0, 0, -0.14]);
    sph(p, i % 3 === 0 ? shade(color, 0.6) : color, [0, 0, 0], [0.075 - i * 0.004, 0.06, 0.1], {}, 7);
    rig.snake.push(p);
    prev = p;
  }
  g.userData.rig = rig;
  return g;
}

export function buildBird(color) {
  const g = new THREE.Group();
  const rig = { wingF: 7 };
  part(g, G_SPH(10), mat(color), [0, 0, 0], [0.18, 0.18, 0.4]);
  sph(g, 0xf0f0f0, [0, 0.12, 0.35], 0.13, {}, 10);
  cone(g, 0xe8b030, [0, 0.1, 0.52], [0.04, 0.12, 0.04], [Math.PI / 2, 0, 0], {}, 4);
  eyes(g, 0.16, 0.42, 0.08, 0.025, 0x885500);
  box(g, shade(color, 0.7), [0, 0, -0.45], [0.25, 0.03, 0.25]);
  rig.wings = [];
  for (const sx of [-1, 1]) {
    const w = pivot(g, [sx * 0.15, 0.06, 0]);
    box(w, shade(color, 0.9), [sx * 0.45, 0, 0], [0.9, 0.03, 0.32]);
    box(w, shade(color, 0.6), [sx * 0.85, 0, -0.08], [0.3, 0.025, 0.25]);
    rig.wings.push(w);
  }
  g.userData.rig = rig;
  return g;
}

export function buildBug(color) {
  const g = new THREE.Group();
  const rig = { legs: [], gait: 3, freq: 22, legAmp: 0.5, wings: [], wingF: 30 };
  sph(g, color, [0, 0.12, -0.12], [0.12, 0.1, 0.2], { r: 0.3, m: 0.3 }, 8);
  sph(g, shade(color, 0.7), [0, 0.12, 0.12], 0.09, {}, 8);
  eyes(g, 0.14, 0.18, 0.05, 0.035, 0x660000);
  for (let i = -1; i <= 1; i++) {
    for (const sx of [-1, 1]) {
      const pv = pivot(g, [sx * 0.06, 0.1, i * 0.08]);
      cyl(pv, BLACK, [sx * 0.08, -0.05, 0], [0.012, 0.18, 0.012], [0, 0, sx * 0.9], {}, 3);
      rig.legs.push({ pv, ph: i * 2 + (sx > 0 ? 0 : Math.PI) });
    }
  }
  for (const sx of [-1, 1]) {
    const w = pivot(g, [sx * 0.04, 0.2, -0.05]);
    box(w, 0xddeeff, [sx * 0.12, 0, -0.05], [0.22, 0.01, 0.1], null, { op: 0.5 });
    rig.wings.push(w);
  }
  g.userData.rig = rig;
  return g;
}

export function buildChicken(color) {
  const g = new THREE.Group();
  const rig = { legs: [], gait: 3, freq: 14, legAmp: 0.6 };
  const body = pivot(g, [0, 0.28, 0]);
  sph(body, color, [0, 0, 0], [0.16, 0.15, 0.22], {}, 10);
  box(body, shade(color, 0.9), [0, 0.1, -0.2], [0.05, 0.18, 0.12], [-0.5, 0, 0]);
  const head = pivot(body, [0, 0.15, 0.15]);
  sph(head, color, [0, 0.04, 0], 0.08, {}, 8);
  cone(head, 0xe8b030, [0, 0.03, 0.1], [0.025, 0.07, 0.025], [Math.PI / 2, 0, 0], {}, 4);
  box(head, 0xd02020, [0, 0.12, 0], [0.02, 0.05, 0.07]);
  eyes(head, 0.06, 0.05, 0.05, 0.018);
  for (const sx of [-1, 1]) {
    const pv = pivot(g, [sx * 0.06, 0.18, 0]);
    cyl(pv, 0xe8b030, [0, -0.09, 0], [0.012, 0.18, 0.012], null, {}, 4);
    box(pv, 0xe8b030, [0, -0.17, 0.03], [0.05, 0.01, 0.07]);
    rig.legs.push({ pv, ph: sx > 0 ? 0 : Math.PI });
  }
  g.userData.rig = rig;
  return g;
}

// ===================== FABRIQUE PAR ESPÈCE =====================

export function buildSpecies(id, s) {
  const c = s.color;
  switch (s.model) {
    case 'cell':
      return buildCell(c, id === 'amibe' ? ['membrane'] : ['cils'], { eyes: id === 'amibe' });
    case 'bact':
      return buildBacteria(c);
    case 'algae':
      return buildAlgae(c);
    case 'virus':
      return buildVirus(c);
    case 'worm':
      return buildWorm(c);
    case 'multi':
      return buildMulti(c, ['tentacules', 'machoire_p'], { eyes: true });
    case 'fish':
      return buildFish(c, { stripes: Math.random() < 0.5 ? 0xffd040 : null });
    case 'shark':
      return buildShark(c, { armored: s.armored });
    case 'jelly':
      return buildJelly(c);
    case 'squid':
      return buildSquid(c);
    case 'shrimp':
      return buildShrimp(c);
    case 'trilobite':
      return buildTrilobite(c);
    case 'bug':
      return buildBug(c);
    case 'lizard':
      return buildQuad({ color: c, len: 0.9, legLen: 0.14, legW: 0.04, sprawl: 1, bodyW: 0.14, bodyH: 0.1, neck: 0.03, head: 0.09, snout: 0.08, ears: false, tail: 0.7, tailSegs: 4, tailW: 0.05, spots: 0x3a5a1a, freq: 16 });
    case 'snake':
      return buildSnake(c);
    case 'raptor':
      return buildTheropod({ color: c, stripes: 0x5a3a1a, claw: true, crest: 0x3a6a8a });
    case 'trex':
      return buildTheropod({ color: c, head: 0.2, armLen: 0.08, gait: 6, freq: 5, belly: 0x9a8a6a });
    case 'sauropod':
      return buildSauropod(c);
    case 'rabbit':
      return buildQuad({ color: c, len: 0.6, legLen: 0.18, legW: 0.05, bodyW: 0.2, bodyH: 0.2, neck: 0.05, head: 0.13, snout: 0.05, ears: 'long', tail: 0.05, puff: true, gait: 7, freq: 14, belly: 0xe8dcc8 });
    case 'deer':
      return buildQuad({ color: c, len: 1, legLen: 0.65, legW: 0.045, bodyW: 0.22, bodyH: 0.24, neck: 0.35, head: 0.12, snout: 0.12, antlers: true, tail: 0.1, tailSegs: 1, belly: 0xe0c8a0, gait: 8 });
    case 'boar':
      return buildQuad({ color: c, len: 0.9, legLen: 0.28, legW: 0.06, bodyW: 0.3, bodyH: 0.3, neck: 0.05, head: 0.2, snout: 0.14, snoutColor: 0x8a6a5a, tusks: 0.4, tail: 0.15, tailSegs: 1, fur: true, spikes: 0x2a2010 });
    case 'wolf':
      return buildQuad({ color: c, len: 1, legLen: 0.45, legW: 0.05, bodyW: 0.22, bodyH: 0.24, neck: 0.15, head: 0.15, snout: 0.16, teeth: true, tail: 0.45, tailW: 0.07, tailUp: -0.3, fur: true, belly: 0xc8c8c8, gait: 8 });
    case 'bear':
      return buildQuad({ color: c, len: 1, legLen: 0.4, legW: 0.11, bodyW: 0.42, bodyH: 0.4, neck: 0.1, head: 0.22, snout: 0.13, snoutColor: 0x8a6a4a, ears: 'round', tail: 0.06, tailSegs: 1, fur: true, claws: true, hump: true, gait: 6, freq: 7 });
    case 'mammoth':
      return buildQuad({ color: c, len: 1, legLen: 0.5, legW: 0.13, bodyW: 0.42, bodyH: 0.42, neck: 0.05, head: 0.26, snout: 0, ears: 'round', trunk: true, tusks: 1.4, tail: 0.25, tailSegs: 2, fur: true, shaggy: true, hump: true, gait: 4, freq: 5 });
    case 'ape':
      return null; // construit par humans.js
    case 'bird':
      return buildBird(c);
    case 'chicken':
      return buildChicken(c);
    default:
      return buildCell(c);
  }
}
