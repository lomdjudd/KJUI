// Anatomie HD des humanoïdes (modèles sculptés à l'installation) : volumes musculaires,
// crânes creusés, côtes, plis de robes, plaques d'armure en lames, fissures lumineuses…
// Mêmes os et même description (torse / tête / bras / jambes) que les modèles classiques :
// les animations restent identiques. Les petites pièces (doigts, dents, griffes, sangles)
// restent nettes par-dessus la surface sculptée.
import * as THREE from 'three';
import { G, xf, SURF } from './rig.js';

const PI = Math.PI;
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// ---------- Outils de modelage ----------
// Segment arrondi de a à b (rayons r1 → r2)
export function limb(rb, bone, a, b, r1, r2, color, surf, carve = false) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(1e-4, _d.length());
  _d.normalize();
  _q.setFromUnitVectors(_up, _d);
  _e.setFromQuaternion(_q);
  const g = xf(G.rcone(r1, r2, len), a, [_e.x, _e.y, _e.z]);
  if (carve) rb.carve(bone, g, color, surf);
  else rb.add(bone, g, color, surf);
}
// Ellipsoïde
export function ell(rb, bone, c, r, rot, color, surf) {
  rb.add(bone, xf(G.sphere(1, 16, 12), c, rot || [0, 0, 0], r), color, surf);
}
export function ellC(rb, bone, c, r, rot, color = 0x050505, surf = SURF.cloth) {
  rb.carve(bone, xf(G.sphere(1, 12, 8), c, rot || [0, 0, 0], r), color, surf);
}
function box(rb, bone, c, s, rot, color, surf) {
  rb.add(bone, xf(G.box(s[0], s[1], s[2]), c, rot || [0, 0, 0]), color, surf);
}
function boxC(rb, bone, c, s, rot, color = 0x050505, surf = SURF.cloth) {
  rb.carve(bone, xf(G.box(s[0], s[1], s[2]), c, rot || [0, 0, 0]), color, surf);
}
// Chaîne de segments (cornes, queues, tentacules, doigts)
export function chain(rb, bone, pts, r0, r1, color, surf) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) limb(rb, bone, pts[i], pts[i + 1], r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), color, surf);
}
// Corne incurvée (points générés)
export function hornHD(rb, bone, base, dir, len, r, color, curl = 0.9, surf = SURF.bone, segs = 5) {
  const pts = [base.slice()];
  let p = new THREE.Vector3(...base);
  const d = new THREE.Vector3(...dir).normalize();
  const axis = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 0, 1)).normalize();
  if (axis.lengthSq() < 0.01) axis.set(1, 0, 0);
  for (let i = 0; i < segs; i++) {
    d.applyAxisAngle(axis, (curl / segs) * -Math.sign(dir[0] || 1));
    p = p.clone().addScaledVector(d, len / segs);
    pts.push(p.toArray());
  }
  chain(rb, bone, pts, r, Math.max(0.004, r * 0.12), color, surf);
}
function glowEyes(rb, bone, y, z, sep, color, size = 0.016) {
  if (!color) return;
  for (const s of [-1, 1]) rb.add(bone, xf(G.sphere(size, 8, 6), [s * sep, y, z]), color, SURF.glow);
}
function teeth(rb, bone, y, z, w, n, color, len = 0.018, down = true) {
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    rb.add(bone, xf(G.cone(0.006, len, 4), [x, y, z], [down ? PI : 0, 0, 0]), color, SURF.bone);
  }
}

// ======================= TORSES =======================
// Torse musclé commun (poitrine, abdomen, bassin) ; bulk B, matière surf, couleur col
function fleshTorso(rb, c, B, col, surf, o = {}) {
  const lean = o.lean || 1;
  // Cage thoracique et pectoraux
  ell(rb, 'chest', [0, 0.1, -0.005], [0.165 * B * lean, 0.2, 0.115 * B], null, col, surf);
  for (const s of [-1, 1]) ell(rb, 'chest', [s * 0.075 * B, 0.15, 0.07 * B], [0.075 * B * lean, 0.06, 0.05], [0.15, 0, s * 0.25], col, surf);
  // Trapèzes et haut du dos
  ell(rb, 'chest', [0, 0.25, -0.035], [0.13 * B, 0.05, 0.075], null, col, surf);
  for (const s of [-1, 1]) ell(rb, 'chest', [s * 0.08 * B, 0.08, -0.07 * B], [0.07 * B, 0.13, 0.05], [0, 0, s * 0.2], col, surf);
  // Abdomen et flancs
  ell(rb, 'spine', [0, 0.05, 0.01], [0.135 * B * lean, 0.14, 0.095 * B], null, col, surf);
  if (o.abs !== false) {
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) ell(rb, 'spine', [s * 0.034, 0.12 - i * 0.052, 0.085 * B], [0.03, 0.022, 0.02], null, col, surf);
    boxC(rb, 'spine', [0, 0.07, 0.1 * B], [0.008, 0.16, 0.03], null, col, surf);
  }
  // Bassin et fessiers
  ell(rb, 'hips', [0, -0.02, 0], [0.155 * B, 0.1, 0.105 * B], null, col, surf);
  for (const s of [-1, 1]) ell(rb, 'hips', [s * 0.065 * B, -0.07, -0.055 * B], [0.07 * B, 0.08, 0.06], null, col, surf);
  // Cou
  limb(rb, 'neck', [0, -0.05, -0.005], [0, 0.1, 0.012], 0.058 * Math.sqrt(B), 0.05 * Math.sqrt(B), col, surf);
  if (o.ribs) for (let i = 0; i < 4; i++) for (const s of [-1, 1]) boxC(rb, 'chest', [s * 0.1 * B, 0.1 - i * 0.045, 0.06 * B], [0.13, 0.011, 0.12], [0.1, s * 0.5, s * -0.15], o.ribColor || 0x2a1810, surf);
}
function loincloth(rb, c, B, col = c.cloth) {
  ell(rb, 'hips', [0, -0.05, 0], [0.165 * B, 0.09, 0.115 * B], null, col, SURF.cloth);
  boxC(rb, 'hips', [0, -0.13, 0.13 * B], [0.07, 0.08, 0.08], null, col, SURF.cloth);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2 + 0.3;
    const len = 0.16 + (i % 2) * 0.08;
    box(rb, 'hips', [Math.sin(a) * 0.14 * B, -0.1 - len / 2, Math.cos(a) * 0.1 * B], [0.1 * B, len, 0.014], [Math.cos(a) * 0.12, a, -Math.sin(a) * 0.12], col, SURF.cloth);
  }
  rb.add('hips', xf(G.torus(0.162 * B, 0.018, 6, 16), [0, 0.03, 0], [PI / 2, 0, 0], [1, 0.72, 1]), c.leather, SURF.leather);
}
// Plastron d'armure en lames
function armorTorso(rb, c, B, T) {
  const m = c.main;
  // Plastron bombé, arête centrale
  ell(rb, 'chest', [0, 0.11, 0.01], [0.19 * B, 0.2, 0.135 * B], null, m, SURF.metal);
  ell(rb, 'chest', [0, 0.13, 0.05], [0.16 * B, 0.15, 0.11 * B], [0.1, 0, 0], m, SURF.metal);
  box(rb, 'chest', [0, 0.12, 0.155 * B], [0.018, 0.26, 0.02], [0.12, 0, 0], c.trim, SURF.gold);
  boxC(rb, 'chest', [0, -0.07, 0.1], [0.36 * B, 0.012, 0.2], [0.1, 0, 0], c.dark, SURF.darkMetal);
  // Dossière et épaulières du col
  ell(rb, 'chest', [0, 0.1, -0.05], [0.18 * B, 0.19, 0.1 * B], null, m, SURF.metal);
  limb(rb, 'neck', [0, -0.06, 0], [0, 0.06, 0.005], 0.085, 0.07, m, SURF.metal);
  rb.add('neck', xf(G.torus(0.078, 0.012, 6, 16), [0, 0.0, 0], [PI / 2, 0, 0]), c.trim, SURF.gold);
  // Lames de la taille (faltes)
  for (let i = 0; i < 3; i++) {
    const y = 0.13 - i * 0.055;
    const r = (0.155 + i * 0.006) * B;
    rb.add('spine', xf(G.cyl(r, r + 0.012, 0.06, 16), [0, y, 0.005], [0.04, 0, 0], [1, 1, 0.74]), m, SURF.metal);
  }
  // Ceinture et tassettes
  rb.add('hips', xf(G.torus(0.162 * B, 0.022, 6, 18), [0, 0.03, 0], [PI / 2, 0, 0], [1, 0.74, 1]), c.leather, SURF.leather);
  ell(rb, 'hips', [0, -0.02, 0], [0.155 * B, 0.1, 0.11 * B], null, c.dark === 0x0a0a0e ? 0x2a2a30 : c.dark, SURF.leather);
  box(rb, 'hips', [0, 0.03, 0.125 * B], [0.07, 0.06, 0.03], null, c.trim, SURF.gold);
  for (const [x, z, ry] of [[0, 0.12, 0], [0, -0.12, PI], [0.15, 0, PI / 2], [-0.15, 0, -PI / 2]]) {
    for (let k = 0; k < 2; k++) box(rb, 'hips', [x * B, -0.08 - k * 0.08, z * B], [0.19 * B, 0.1, 0.03], [0.14 + k * 0.06, ry, 0], m, SURF.metal);
  }
}
function robeSkirt(rb, c, B, col, len = 0.95, tattered = false) {
  // Jupe de robe : cône plein, plis creusés, ourlet
  rb.add('hips', xf(G.cyl(0.17 * B, 0.33 * B, len, 18), [0, -len / 2 + 0.02, 0], [0, 0, 0], [1, 1, 0.85]), col, SURF.cloth);
  const nf = 9;
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * PI * 2 + 0.2;
    boxC(rb, 'hips', [Math.sin(a) * 0.3 * B, -len * 0.62, Math.cos(a) * 0.26 * B], [0.035, len * 0.8, 0.07], [0, a, 0], col, SURF.cloth);
  }
  if (!tattered) rb.add('hips', xf(G.torus(0.325 * B, 0.02, 6, 20), [0, -len + 0.03, 0], [PI / 2, 0, 0], [1, 0.85, 1]), c.trim, SURF.gold);
  else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const l2 = 0.2 + (i % 3) * 0.12;
      box(rb, 'hips', [Math.sin(a) * 0.3 * B, -len - l2 / 2 + 0.06, Math.cos(a) * 0.26 * B], [0.13 * B, l2, 0.015], [Math.cos(a) * 0.1, a, -Math.sin(a) * 0.1], col, SURF.cloth);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.6;
      ellC(rb, 'hips', [Math.sin(a) * 0.29 * B, -len * (0.55 + (i % 2) * 0.2), Math.cos(a) * 0.25 * B], [0.05, 0.07, 0.06], null, 0x050508, SURF.cloth);
    }
  }
}
function ribcage(rb, c, B) {
  const bone = c.bone;
  // Cage : coque creusée puis fendue entre les côtes
  ell(rb, 'chest', [0, 0.1, 0.01], [0.15 * B, 0.19, 0.11 * B], null, bone, SURF.bone);
  ellC(rb, 'chest', [0, 0.09, 0.012], [0.125 * B, 0.175, 0.087 * B], null, 0x050505, SURF.cloth);
  // Fentes entre les côtes, de chaque côté (le sternum et la colonne restent entiers)
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) boxC(rb, 'chest', [s * 0.12, 0.2 - i * 0.052, 0.04], [0.19, 0.02, 0.26], [0.18, 0, 0], 0x050505, SURF.cloth);
  boxC(rb, 'chest', [0, -0.07, 0.03], [0.4, 0.07, 0.3], null, 0x050505, SURF.cloth);
  // Sternum, clavicules, colonne
  box(rb, 'chest', [0, 0.11, 0.12 * B], [0.032, 0.22, 0.022], [0.1, 0, 0], bone, SURF.bone);
  for (const s of [-1, 1]) limb(rb, 'chest', [s * 0.02, 0.26, 0.08], [s * 0.19 * B, 0.27, 0.0], 0.016, 0.014, bone, SURF.bone);
  for (let i = 0; i < 4; i++) ell(rb, 'chest', [0, 0.25 - i * 0.075, -0.1 * B], [0.022, 0.024, 0.02], null, bone, SURF.bone);
  for (let i = 0; i < 3; i++) ell(rb, 'spine', [0, 0.16 - i * 0.06, -0.03], [0.026, 0.024, 0.024], null, bone, SURF.bone);
  limb(rb, 'spine', [0, -0.02, -0.03], [0, 0.2, -0.04], 0.014, 0.014, bone, SURF.bone);
  // Bassin : ailes iliaques et sacrum
  for (const s of [-1, 1]) ell(rb, 'hips', [s * 0.08 * B, 0.0, -0.01], [0.07 * B, 0.07, 0.045], [0.2, s * 0.5, s * 0.3], bone, SURF.bone);
  ellC(rb, 'hips', [0, -0.01, 0.04], [0.07, 0.06, 0.08], null, 0x050505, SURF.cloth);
  ell(rb, 'hips', [0, -0.03, -0.05], [0.04, 0.06, 0.03], null, bone, SURF.bone);
}
function rockTorso(rb, c, B, surf, crackCol, crackSurf) {
  const m = c.main;
  rb.add('chest', xf(G.dodeca(0.25 * B), [0, 0.12, 0], [0.3, 0.5, 0], [1.15, 0.95, 0.85]), m, surf);
  for (const s of [-1, 1]) rb.add('chest', xf(G.dodeca(0.14 * B), [s * 0.19 * B, 0.27, -0.01], [0.5, s * 0.4, 0]), m, surf);
  rb.add('chest', xf(G.dodeca(0.12 * B), [0, 0.02, 0.1], [0.1, 0.9, 0.3]), m, surf);
  rb.add('spine', xf(G.dodeca(0.17 * B), [0, 0.03, 0], [0.4, 0.2, 0.1], [1.05, 1, 0.9]), m, surf);
  rb.add('hips', xf(G.dodeca(0.17 * B), [0, -0.03, 0], [0.1, 0.5, 0.3], [1.2, 0.8, 1]), m, surf);
  // Fissures lumineuses creusées dans la roche
  if (crackCol) {
    const cracks = [[0, 0.14, 0.2, 0.3, 0.2], [0.07, 0.2, 0.19, -0.9, 0.12], [-0.08, 0.06, 0.19, 0.8, 0.14], [0.12, 0.3, 0.12, 1.3, 0.1], [-0.13, 0.25, 0.13, -1.2, 0.1]];
    for (const [x, y, z, rz, l] of cracks) boxC(rb, 'chest', [x * B, y, z * B], [0.013, l, 0.08], [0, 0, rz], crackCol, crackSurf);
    boxC(rb, 'spine', [0.03, 0.04, 0.14 * B], [0.013, 0.12, 0.08], [0, 0, 0.5], crackCol, crackSurf);
  }
}

export function torsoHD(rb, type, c, B, T) {
  switch (type) {
    case 'armor':
    case 'plate':
      armorTorso(rb, c, B, T);
      break;
    case 'tabard': {
      armorTorso(rb, c, B, T);
      box(rb, 'chest', [0, 0.06, 0.16 * B], [0.26 * B, 0.36, 0.016], [0.08, 0, 0], c.cloth, SURF.cloth);
      box(rb, 'chest', [0, 0.1, 0.17 * B], [0.07, 0.12, 0.012], [0.08, 0, 0], c.trim, SURF.gold);
      box(rb, 'hips', [0, -0.22, 0.14 * B], [0.24 * B, 0.42, 0.016], [0.06, 0, 0], c.cloth, SURF.cloth);
      box(rb, 'hips', [0, -0.22, -0.14 * B], [0.24 * B, 0.42, 0.016], [-0.06, 0, 0], c.cloth, SURF.cloth);
      break;
    }
    case 'robe': {
      ell(rb, 'chest', [0, 0.1, 0], [0.18 * B, 0.21, 0.13 * B], null, c.cloth, SURF.cloth);
      ell(rb, 'chest', [0, 0.25, -0.01], [0.2 * B, 0.07, 0.14 * B], null, c.cloth, SURF.cloth);
      for (const s of [-1, 1]) boxC(rb, 'chest', [s * 0.06, 0.08, 0.13 * B], [0.02, 0.3, 0.05], [0, 0, s * 0.15], c.cloth, SURF.cloth);
      ell(rb, 'spine', [0, 0.04, 0], [0.16 * B, 0.15, 0.12 * B], null, c.cloth, SURF.cloth);
      limb(rb, 'neck', [0, -0.05, -0.01], [0, 0.08, 0], 0.06, 0.05, c.skin, SURF.skin);
      rb.add('hips', xf(G.torus(0.172 * B, 0.024, 6, 18), [0, 0.05, 0], [PI / 2, 0, 0], [1, 0.8, 1]), c.trim, SURF.gold);
      robeSkirt(rb, c, B, c.cloth, 0.95);
      box(rb, 'hips', [0, -0.4, 0.21 * B], [0.1, 0.78, 0.016], [0.2, 0, 0], c.trim, SURF.cloth);
      break;
    }
    case 'tattered': {
      ell(rb, 'chest', [0, 0.1, 0], [0.16 * B, 0.2, 0.12 * B], null, c.cloth, SURF.cloth);
      ell(rb, 'chest', [0, 0.26, -0.01], [0.19 * B, 0.07, 0.13 * B], null, c.cloth, SURF.cloth);
      ellC(rb, 'chest', [0.08, 0.05, 0.12 * B], [0.05, 0.06, 0.05], null, 0x050508, SURF.cloth);
      ell(rb, 'spine', [0, 0.03, 0], [0.14 * B, 0.15, 0.11 * B], null, c.cloth, SURF.cloth);
      limb(rb, 'neck', [0, -0.05, -0.01], [0, 0.08, 0], 0.05, 0.045, c.cloth, SURF.cloth);
      robeSkirt(rb, c, B * 0.92, c.cloth, 0.6, true);
      break;
    }
    case 'bones':
      ribcage(rb, c, B);
      limb(rb, 'neck', [0, -0.04, -0.02], [0, 0.1, -0.01], 0.022, 0.02, c.bone, SURF.bone);
      break;
    case 'flesh':
      fleshTorso(rb, c, B, c.skin, SURF.skin, { ribs: true, lean: 0.9 });
      box(rb, 'chest', [0.02, 0.02, 0.125 * B], [0.3 * B, 0.07, 0.016], [0.12, 0, 0.35], c.cloth, SURF.cloth);
      loincloth(rb, c, B);
      break;
    case 'fur': {
      fleshTorso(rb, c, B * 1.08, c.skin, SURF.fur, { abs: false });
      // Crinière du poitrail et touffes du dos
      ell(rb, 'chest', [0, 0.2, 0.06], [0.2 * B, 0.12, 0.12 * B], [0.3, 0, 0], c.skin, SURF.fur);
      for (let i = 0; i < 9; i++) {
        const x = ((i % 3) - 1) * 0.09 * B;
        const y = 0.32 - Math.floor(i / 3) * 0.11;
        limb(rb, 'chest', [x, y, -0.09 * B], [x * 1.2, y + 0.05, -0.2 * B], 0.045, 0.008, c.dark, SURF.fur);
      }
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        limb(rb, 'chest', [Math.sin(a) * 0.14 * B, 0.2, 0.1 * B], [Math.sin(a) * 0.2 * B, 0.08, 0.16 * B], 0.04, 0.008, c.skin, SURF.fur);
      }
      loincloth(rb, c, B * 1.08);
      break;
    }
    case 'leather': {
      fleshTorso(rb, c, B, c.skin, SURF.skin, { abs: false, lean: 0.95 });
      ell(rb, 'chest', [0, 0.09, 0], [0.175 * B, 0.2, 0.125 * B], null, c.leather, SURF.leather);
      ell(rb, 'spine', [0, 0.05, 0.005], [0.145 * B, 0.15, 0.105 * B], null, c.leather, SURF.leather);
      for (let i = 0; i < 4; i++) boxC(rb, 'chest', [0, 0.18 - i * 0.07, 0.12 * B], [0.3 * B, 0.01, 0.06], null, c.dark, SURF.leather);
      box(rb, 'chest', [0, 0.1, 0.14 * B], [0.04, 0.46, 0.018], [0.1, 0, 0.7], c.dark, SURF.leather);
      ell(rb, 'chest', [0, 0.28, -0.02], [0.13, 0.05, 0.1], null, c.cloth, SURF.cloth);
      rb.add('hips', xf(G.torus(0.16 * B, 0.024, 6, 16), [0, 0.02, 0], [PI / 2, 0, 0], [1, 0.76, 1]), c.dark, SURF.leather);
      box(rb, 'hips', [0, -0.15, 0.12 * B], [0.2 * B, 0.28, 0.016], [0.1, 0, 0], c.cloth, SURF.cloth);
      box(rb, 'hips', [0.13, -0.05, 0.08], [0.05, 0.08, 0.04], [0, -0.4, 0], c.dark, SURF.leather);
      break;
    }
    case 'stone':
      rockTorso(rb, c, B, SURF.stone, c.glow, SURF.glow);
      limb(rb, 'neck', [0, -0.05, 0], [0, 0.08, 0.01], 0.07, 0.06, c.main, SURF.stone);
      break;
    case 'magma':
      rockTorso(rb, c, B * 1.05, SURF.stone, c.glow || 0xff6a1a, SURF.glow);
      limb(rb, 'neck', [0, -0.05, 0], [0, 0.08, 0.01], 0.075, 0.065, c.main, SURF.stone);
      break;
    case 'crystal': {
      rb.add('chest', xf(G.octa(0.26 * B), [0, 0.12, 0], [0, 0.4, 0], [1, 1.3, 0.8]), c.main, SURF.crystal);
      for (const s of [-1, 1]) {
        rb.add('chest', xf(G.octa(0.12), [s * 0.2 * B, 0.3, -0.04], [0.4, 0, s * 0.5], [1, 2, 1]), c.main, SURF.crystal);
        rb.add('chest', xf(G.octa(0.07), [s * 0.12, 0.34, -0.12], [0.6, 0, s * 0.3], [1, 2.4, 1]), c.glow, SURF.crystal);
      }
      rb.add('chest', xf(G.sphere(0.07, 10, 8), [0, 0.12, 0.13]), c.glow, SURF.glow);
      rb.add('spine', xf(G.octa(0.17 * B), [0, 0.02, 0], [0, 0.2, 0], [1, 1.2, 0.8]), c.main, SURF.crystal);
      rb.add('hips', xf(G.octa(0.15 * B), [0, -0.02, 0], [0, 0.7, 0], [1.2, 0.8, 0.9]), c.main, SURF.crystal);
      limb(rb, 'neck', [0, -0.05, 0], [0, 0.08, 0], 0.05, 0.04, c.main, SURF.crystal);
      break;
    }
    case 'bark': {
      rb.add('chest', xf(G.cyl(0.23 * B, 0.19 * B, 0.44, 12), [0, 0.12, 0], [0, 0, 0], [1, 1, 0.82]), c.main, SURF.wood);
      rb.add('spine', xf(G.cyl(0.19 * B, 0.21 * B, 0.26, 12), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.85]), c.main, SURF.wood);
      rb.add('hips', xf(G.cyl(0.21 * B, 0.25 * B, 0.2, 12), [0, -0.04, 0], [0, 0, 0], [1, 1, 0.85]), c.main, SURF.wood);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        boxC(rb, 'chest', [Math.sin(a) * 0.21 * B, 0.12, Math.cos(a) * 0.17 * B], [0.02, 0.5, 0.05], [0, a, 0.05 * (i % 3 - 1)], 0x1a1008, SURF.wood);
      }
      for (const [x, y] of [[0.08, 0.2], [-0.1, 0.02], [0.02, -0.04]]) ell(rb, 'chest', [x, y, 0.17 * B], [0.05, 0.04, 0.035], null, c.dark || 0x2a1a10, SURF.wood);
      for (let i = 0; i < 5; i++) rb.add('chest', xf(G.sphere(0.035, 8, 6), [(i - 2) * 0.08, 0.05 + (i % 2) * 0.15, 0.185 * B]), c.glow, SURF.glowSoft);
      limb(rb, 'neck', [0, -0.05, 0], [0, 0.08, 0.01], 0.07, 0.06, c.main, SURF.wood);
      break;
    }
    default:
      break;
  }
}

// ======================= TÊTES =======================
function skull(rb, c, col, surf, o = {}) {
  const H = 'head';
  const long = o.long || 1;
  ell(rb, H, [0, 0.145, -0.01], [0.098, 0.108, 0.118], null, col, surf); // crâne
  ell(rb, H, [0, 0.135, 0.08], [0.085, 0.03, 0.035], [0.1, 0, 0], col, surf); // arcades
  for (const s of [-1, 1]) ell(rb, H, [s * 0.058, 0.09, 0.07], [0.03, 0.026, 0.035], null, col, surf); // pommettes
  ell(rb, H, [0, 0.075, 0.075 * long], [0.055, 0.04, 0.045 * long], null, col, surf); // maxillaire
  ell(rb, H, [0, 0.022, 0.058 * long], [0.058, 0.03, 0.055 * long], [0.15, 0, 0], col, surf); // mandibule
  for (const s of [-1, 1]) ell(rb, H, [s * 0.055, 0.05, 0.01], [0.018, 0.045, 0.03], [0.3, 0, 0], col, surf);
  // Orbites, cavité nasale, bouche
  for (const s of [-1, 1]) ellC(rb, H, [s * 0.04, 0.12, 0.108], [0.03, 0.028, 0.032], null, o.socket || 0x050505, SURF.cloth);
  ellC(rb, H, [0, 0.083, 0.122 * long], [0.012, 0.02, 0.02], null, o.socket || 0x050505, SURF.cloth);
  if (o.mouth !== false) boxC(rb, H, [0, 0.048, 0.1 * long], [0.07, 0.012, 0.05], null, o.socket || 0x050505, SURF.cloth);
  if (o.teeth !== false) {
    teeth(rb, H, 0.058, 0.107 * long, 0.06, 6, o.teethCol || c.bone, 0.014);
    teeth(rb, H, 0.038, 0.102 * long, 0.055, 6, o.teethCol || c.bone, 0.012, false);
  }
}
function hood(rb, c, B, col, o = {}) {
  const H = 'head';
  // Capuche : volume creusé à l'avant (le visage reste dans l'ombre)
  ell(rb, H, [0, 0.13, -0.025], [0.155, 0.175, 0.17], null, col, SURF.cloth);
  limb(rb, H, [0, 0.24, -0.08], [0, 0.34, -0.2], 0.08, 0.02, col, SURF.cloth);
  ellC(rb, H, [0, 0.11, 0.12], [0.1, 0.13, 0.13], null, o.inner || 0x050508, SURF.cloth);
  rb.add(H, xf(G.cyl(0.17, 0.2, 0.12, 16, true), [0, -0.03, -0.01]), col, SURF.cloth);
  for (const s of [-1, 1]) boxC(rb, H, [s * 0.13, 0.12, 0.02], [0.02, 0.22, 0.12], [0, 0, s * 0.15], col, SURF.cloth);
}

export function headHD(rb, type, c, B) {
  const H = 'head';
  switch (type) {
    case 'helm_great':
    case 'helm_plume':
    case 'helm_crown': {
      rb.add(H, xf(G.cyl(0.125, 0.132, 0.25, 18), [0, 0.12, 0]), c.main, SURF.metal);
      rb.add(H, xf(G.hemi(0.126, 18, 8), [0, 0.245, 0]), c.main, SURF.metal);
      box(rb, H, [0, 0.12, 0.13], [0.02, 0.22, 0.02], null, c.trim, SURF.gold);
      boxC(rb, H, [0, 0.15, 0.13], [0.2, 0.018, 0.05], null, 0x050505, SURF.cloth);
      for (let i = 0; i < 6; i++) ellC(rb, H, [0.045 * (i % 2 ? 1 : -1) + (i < 2 ? 0 : i < 4 ? 0.02 : -0.02) * Math.sign(i % 2 - 0.5), 0.06 + Math.floor(i / 2) * 0.022, 0.13], [0.006, 0.006, 0.02], null, 0x050505, SURF.cloth);
      rb.add(H, xf(G.torus(0.13, 0.012, 6, 18), [0, 0.02, 0], [PI / 2, 0, 0]), c.trim, SURF.gold);
      glowEyes(rb, H, 0.15, 0.118, 0.045, c.eyes, 0.012);
      if (type === 'helm_plume') chain(rb, H, [[0, 0.36, 0.06], [0, 0.4, -0.06], [0, 0.35, -0.2], [0, 0.22, -0.3]], 0.04, 0.015, c.cloth, SURF.cloth);
      if (type === 'helm_crown') {
        rb.add(H, xf(G.torus(0.13, 0.018, 6, 18), [0, 0.25, 0], [PI / 2, 0, 0]), c.trim, SURF.gold);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * PI * 2;
          rb.add(H, xf(G.cone(0.022, 0.09, 6), [Math.sin(a) * 0.13, 0.3, Math.cos(a) * 0.13]), c.trim, SURF.gold);
        }
        rb.add(H, xf(G.octa(0.02), [0, 0.28, 0.14]), c.glow, SURF.glow);
      }
      break;
    }
    case 'helm_horned': {
      ell(rb, H, [0, 0.13, 0], [0.14, 0.155, 0.148], null, c.main, SURF.metal);
      ell(rb, H, [0, 0.08, 0.09], [0.1, 0.075, 0.05], [0.15, 0, 0], c.main, SURF.metal);
      box(rb, H, [0, 0.18, 0.145], [0.028, 0.2, 0.03], [0.25, 0, 0], c.trim, SURF.metal);
      boxC(rb, H, [0, 0.13, 0.14], [0.19, 0.03, 0.06], null, 0x050505, SURF.cloth);
      rb.add(H, xf(G.octa(0.022), [0, 0.2, 0.15]), c.glow, SURF.glow);
      glowEyes(rb, H, 0.13, 0.13, 0.045, c.eyes || 0xff2020, 0.017);
      for (const s of [-1, 1]) hornHD(rb, H, [s * 0.1, 0.24, 0], [s, 0.3, 0], 0.5, 0.05, c.main, 1.5, SURF.metal);
      break;
    }
    case 'helm_winged': {
      ell(rb, H, [0, 0.13, 0], [0.135, 0.15, 0.142], null, c.main, SURF.metal);
      boxC(rb, H, [0, 0.13, 0.135], [0.2, 0.026, 0.05], null, 0x050505, SURF.cloth);
      box(rb, H, [0, 0.07, 0.14], [0.03, 0.12, 0.03], null, c.main, SURF.metal);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(rb, H, [s * 0.14, 0.2 + i * 0.05, -0.04 - i * 0.02], [0.02, 0.05, 0.18 - i * 0.04], [0.5 + i * 0.1, 0, s * -0.3], c.trim, SURF.gold);
      glowEyes(rb, H, 0.13, 0.12, 0.045, c.eyes, 0.012);
      break;
    }
    case 'helm_bascinet': {
      ell(rb, H, [0, 0.14, -0.01], [0.13, 0.155, 0.137], null, c.main, SURF.metal);
      limb(rb, H, [0, 0.11, 0.06], [0, 0.1, 0.23], 0.1, 0.02, c.main, SURF.metal);
      boxC(rb, H, [0, 0.15, 0.15], [0.16, 0.015, 0.14], null, 0x050505, SURF.cloth);
      for (let i = 0; i < 4; i++) ellC(rb, H, [0.03 * (i - 1.5), 0.08, 0.19 - Math.abs(i - 1.5) * 0.02], [0.008, 0.008, 0.03], null, 0x050505, SURF.cloth);
      rb.add(H, xf(G.cyl(0.14, 0.16, 0.08, 16), [0, 0.0, 0]), c.dark, SURF.cloth);
      glowEyes(rb, H, 0.15, 0.17, 0.04, c.eyes, 0.011);
      break;
    }
    case 'helm_open': {
      ell(rb, H, [0, 0.12, 0.01], [0.105, 0.12, 0.115], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.07, 0.07], [0.06, 0.045, 0.05], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.1, 0.12], [0.014, 0.025, 0.02], null, c.skin, SURF.skin);
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.038, 0.13, 0.105], [0.018, 0.012, 0.012], null, 0x2a1a14, SURF.skin);
      ell(rb, H, [0, 0.03, 0.06], [0.065, 0.035, 0.06], null, c.hair || 0x3a2418, SURF.fur);
      rb.add(H, xf(G.hemi(0.13, 18, 8), [0, 0.15, 0]), c.main, SURF.metal);
      box(rb, H, [0, 0.13, 0.13], [0.02, 0.1, 0.025], null, c.main, SURF.metal);
      glowEyes(rb, H, 0.13, 0.118, 0.038, c.eyes || 0x10101a, 0.009);
      break;
    }
    case 'hood':
    case 'lich':
    case 'plague':
    case 'hag': {
      hood(rb, c, B, c.cloth);
      if (type === 'lich') {
        // Visage décharné, joues creuses, yeux rouges
        ell(rb, H, [0, 0.11, 0.06], [0.078, 0.1, 0.075], null, c.skin, SURF.skin);
        ell(rb, H, [0, 0.03, 0.1], [0.045, 0.035, 0.04], null, c.skin, SURF.skin);
        for (const s of [-1, 1]) {
          ellC(rb, H, [s * 0.05, 0.07, 0.12], [0.022, 0.03, 0.02], null, 0x1a1a24, SURF.skin);
          ellC(rb, H, [s * 0.033, 0.125, 0.125], [0.022, 0.018, 0.02], null, 0x050508, SURF.cloth);
        }
        boxC(rb, H, [0, 0.04, 0.14], [0.05, 0.008, 0.03], null, 0x050508, SURF.cloth);
        glowEyes(rb, H, 0.125, 0.125, 0.033, c.eyes || 0xff1a1a, 0.014);
      } else if (type === 'plague') {
        ell(rb, H, [0, 0.1, 0.07], [0.08, 0.085, 0.07], null, 0x2a2420, SURF.leather);
        limb(rb, H, [0, 0.08, 0.12], [0, 0.0, 0.33], 0.045, 0.008, 0x3a3028, SURF.leather);
        for (const s of [-1, 1]) ell(rb, H, [s * 0.038, 0.12, 0.125], [0.024, 0.024, 0.012], null, 0x100c08, SURF.metal);
        glowEyes(rb, H, 0.12, 0.13, 0.038, c.eyes || 0xffd24d, 0.014);
      } else if (type === 'hag') {
        ell(rb, H, [0, 0.1, 0.07], [0.075, 0.1, 0.07], null, c.skin, SURF.skin);
        limb(rb, H, [0, 0.11, 0.13], [0, 0.07, 0.21], 0.018, 0.01, c.skin, SURF.skin);
        ell(rb, H, [0, 0.025, 0.11], [0.03, 0.03, 0.03], null, c.skin, SURF.skin);
        for (const [x, y] of [[0.04, 0.06], [-0.05, 0.1], [0.02, 0.14]]) rb.add(H, xf(G.sphere(0.008, 6, 4), [x, y, 0.13]), c.skin, SURF.skin);
        for (const s of [-1, 1]) ellC(rb, H, [s * 0.032, 0.12, 0.13], [0.02, 0.014, 0.018], null, 0x100c08, SURF.cloth);
        glowEyes(rb, H, 0.12, 0.13, 0.032, c.eyes || 0xc8ff3a, 0.012);
      } else {
        glowEyes(rb, H, 0.12, 0.13, 0.04, c.eyes || 0xff3030, 0.016);
      }
      break;
    }
    case 'skull':
      skull(rb, c, c.bone, SURF.bone);
      glowEyes(rb, H, 0.12, 0.1, 0.04, c.eyes || 0x39ff9a, 0.012);
      if (c.helmet) {
        rb.add(H, xf(G.hemi(0.128, 18, 8), [0, 0.165, -0.005]), c.helmet, SURF.darkMetal);
        rb.add(H, xf(G.torus(0.128, 0.012, 6, 18), [0, 0.165, -0.005], [PI / 2, 0, 0]), c.helmet, SURF.darkMetal);
      }
      break;
    case 'zombie':
    case 'ghoul': {
      const g = type === 'ghoul';
      skull(rb, c, c.skin, SURF.skin, { long: g ? 1.35 : 1.05, socket: 0x1a0808, teethCol: 0xc8b890, mouth: true });
      ell(rb, H, [0, 0.09, g ? 0.145 : 0.12], [0.016, 0.022, 0.02], null, c.skin, SURF.skin);
      if (g) for (const s of [-1, 1]) limb(rb, H, [s * 0.09, 0.15, 0], [s * 0.2, 0.22, -0.04], 0.03, 0.006, c.skin, SURF.skin);
      else for (const s of [-1, 1]) ell(rb, H, [s * 0.1, 0.12, 0], [0.012, 0.03, 0.022], null, c.skin, SURF.skin);
      if (!g) ell(rb, H, [0.03, 0.22, -0.03], [0.07, 0.03, 0.08], [0.2, 0, 0.3], c.hair || 0x2a2218, SURF.fur);
      glowEyes(rb, H, 0.12, g ? 0.115 : 0.1, 0.04, c.eyes || 0xffe050, 0.013);
      break;
    }
    case 'demon': {
      skull(rb, c, c.skin, SURF.skin, { long: 1.1, socket: 0x1a0505, teethCol: 0xe8dcc0 });
      ell(rb, H, [0, 0.14, 0.09], [0.095, 0.035, 0.04], [0.2, 0, 0], c.skin, SURF.skin);
      for (const s of [-1, 1]) {
        limb(rb, H, [s * 0.09, 0.14, 0.02], [s * 0.19, 0.2, -0.05], 0.028, 0.005, c.skin, SURF.skin);
        rb.add(H, xf(G.cone(0.01, 0.05, 5), [s * 0.03, 0.03, 0.1], [PI, 0, 0]), 0xf0e8d0, SURF.bone);
        hornHD(rb, H, [s * 0.075, 0.22, 0], [s * 0.6, 0.7, -0.4], 0.38, 0.042, c.dark, 1.3, SURF.bone);
      }
      glowEyes(rb, H, 0.12, 0.11, 0.042, c.eyes || 0xffb020, 0.016);
      break;
    }
    case 'wolf': {
      ell(rb, H, [0, 0.13, -0.01], [0.115, 0.11, 0.12], null, c.skin, SURF.fur);
      limb(rb, H, [0, 0.1, 0.05], [0, 0.085, 0.25], 0.07, 0.038, c.skin, SURF.fur);
      ell(rb, H, [0, 0.15, 0.08], [0.08, 0.035, 0.05], [0.3, 0, 0], c.skin, SURF.fur);
      limb(rb, H, [0, 0.04, 0.05], [0, 0.045, 0.22], 0.045, 0.028, c.dark, SURF.leather);
      boxC(rb, H, [0, 0.065, 0.16], [0.08, 0.012, 0.16], null, 0x2a0808, SURF.wet);
      ell(rb, H, [0, 0.105, 0.285], [0.025, 0.02, 0.02], null, 0x050505, SURF.wet);
      for (const s of [-1, 1]) {
        limb(rb, H, [s * 0.075, 0.2, -0.03], [s * 0.1, 0.32, -0.06], 0.04, 0.008, c.skin, SURF.fur);
        ell(rb, H, [s * 0.09, 0.08, 0.0], [0.05, 0.07, 0.06], [0, 0, s * 0.3], c.skin, SURF.fur);
        rb.add(H, xf(G.cone(0.009, 0.045, 5), [s * 0.03, 0.055, 0.2], [PI, 0, 0]), 0xf0e8d0, SURF.bone);
        ellC(rb, H, [s * 0.05, 0.14, 0.1], [0.02, 0.014, 0.02], null, 0x100804, SURF.cloth);
      }
      teeth(rb, H, 0.072, 0.2, 0.05, 5, 0xf0e8d0, 0.014);
      glowEyes(rb, H, 0.14, 0.108, 0.05, c.eyes || 0xffcc22, 0.014);
      break;
    }
    case 'sack': {
      ell(rb, H, [0, 0.12, 0], [0.13, 0.145, 0.13], null, 0x8a7048, SURF.cloth);
      boxC(rb, H, [0, 0.05, 0.13], [0.1, 0.012, 0.04], null, 0x201008, SURF.cloth);
      for (let i = 0; i < 5; i++) box(rb, H, [-0.04 + i * 0.02, 0.05, 0.128], [0.005, 0.03, 0.012], null, 0x201008, SURF.cloth);
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.045, 0.15, 0.12], [0.026, 0.028, 0.03], null, 0x100804, SURF.cloth);
      glowEyes(rb, H, 0.15, 0.108, 0.045, c.eyes || 0xff8a1a, 0.018);
      rb.add(H, xf(G.cyl(0.26, 0.26, 0.015, 18), [0, 0.25, 0]), 0x3a2a14, SURF.cloth);
      limb(rb, H, [0, 0.24, 0], [0.04, 0.47, -0.03], 0.12, 0.02, 0x3a2a14, SURF.cloth);
      break;
    }
    case 'mushroom': {
      ell(rb, H, [0, 0.08, 0.01], [0.09, 0.1, 0.09], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.2, 0], [0.26, 0.13, 0.26], null, c.cloth, SURF.cloth);
      ellC(rb, H, [0, 0.13, 0], [0.24, 0.07, 0.24], null, c.skin, SURF.skin);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2;
        boxC(rb, H, [Math.sin(a) * 0.17, 0.15, Math.cos(a) * 0.17], [0.012, 0.03, 0.16], [0, a, 0], 0x6a5a48, SURF.cloth);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        rb.add(H, xf(G.sphere(0.028, 8, 6), [Math.sin(a) * 0.16, 0.3, Math.cos(a) * 0.16]), c.glow, SURF.glow);
      }
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.032, 0.09, 0.085], [0.015, 0.015, 0.02], null, 0x100804, SURF.cloth);
      glowEyes(rb, H, 0.09, 0.08, 0.032, c.eyes || 0xfff080, 0.012);
      break;
    }
    case 'faceless': {
      ell(rb, H, [0, 0.14, 0], [0.11, 0.15, 0.12], null, c.skin, SURF.wet);
      for (let i = 0; i < 3; i++) boxC(rb, H, [0, 0.08 + i * 0.05, 0.12], [0.12 - i * 0.02, 0.006, 0.04], null, 0x0a0810, SURF.wet);
      ellC(rb, H, [0, 0.05, 0.115], [0.03, 0.01, 0.02], null, 0x0a0810, SURF.wet);
      rb.add(H, xf(G.torus(0.16, 0.012, 4, 24), [0, 0.3, -0.05], [PI / 2 - 0.3, 0, 0]), c.glow, SURF.glow);
      break;
    }
    case 'elemental': {
      rb.add(H, xf(G.octa(0.14), [0, 0.14, 0], [0, 0.5, 0], [1, 1.3, 1]), c.main, SURF.crystal);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + 0.4;
        rb.add(H, xf(G.octa(0.05), [Math.sin(a) * 0.1, 0.26, Math.cos(a) * 0.08], [0.3, a, 0.3], [1, 2.2, 1]), c.main, SURF.crystal);
      }
      glowEyes(rb, H, 0.14, 0.1, 0.04, c.eyes || 0xffffff, 0.018);
      break;
    }
    case 'stone': {
      rb.add(H, xf(G.dodeca(0.13), [0, 0.12, 0.02], [0.3, 0.3, 0]), c.main, SURF.stone);
      rb.add(H, xf(G.dodeca(0.07), [0, 0.06, 0.1], [0.5, 0.1, 0.2]), c.main, SURF.stone);
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.045, 0.13, 0.11], [0.025, 0.018, 0.03], null, c.glow || 0xff5a1a, SURF.glow);
      boxC(rb, H, [0, 0.06, 0.15], [0.07, 0.015, 0.05], null, c.glow || 0xff5a1a, SURF.glow);
      break;
    }
    case 'monk': {
      ell(rb, H, [0, 0.12, 0.01], [0.1, 0.12, 0.11], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.07, 0.07], [0.055, 0.045, 0.05], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.1, 0.115], [0.013, 0.024, 0.02], null, c.skin, SURF.skin);
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.035, 0.13, 0.1], [0.016, 0.01, 0.012], null, 0x2a1a14, SURF.skin);
      rb.add(H, xf(G.cyl(0.17, 0.19, 0.1, 16, true), [0, -0.03, -0.02]), c.cloth, SURF.cloth);
      glowEyes(rb, H, 0.13, 0.108, 0.035, c.eyes || 0xffffff, 0.009);
      break;
    }
    case 'executioner': {
      limb(rb, H, [0, -0.02, 0], [0, 0.42, -0.02], 0.15, 0.02, c.cloth, SURF.cloth);
      for (const s of [-1, 1]) ellC(rb, H, [s * 0.045, 0.14, 0.12], [0.025, 0.018, 0.04], null, 0x050505, SURF.cloth);
      glowEyes(rb, H, 0.14, 0.1, 0.045, c.eyes || 0xff3030, 0.016);
      break;
    }
    case 'none': {
      limb(rb, 'neck', [0, -0.02, 0], [0, 0.05, 0], 0.065, 0.06, 0x5a0a0a, SURF.wet);
      ellC(rb, 'neck', [0, 0.07, 0], [0.04, 0.02, 0.04], null, c.glow || 0xff3030, SURF.glowSoft);
      break;
    }
    case 'yeti': {
      ell(rb, H, [0, 0.13, 0.0], [0.17, 0.15, 0.16], null, c.skin, SURF.fur);
      ell(rb, H, [0, 0.08, 0.1], [0.11, 0.08, 0.07], null, 0x5a6a7a, SURF.skin);
      ell(rb, H, [0, 0.16, 0.11], [0.1, 0.035, 0.05], [0.3, 0, 0], c.skin, SURF.fur);
      boxC(rb, H, [0, 0.05, 0.16], [0.09, 0.014, 0.05], null, 0x1a0808, SURF.wet);
      ell(rb, H, [0, 0.1, 0.165], [0.022, 0.018, 0.02], null, 0x2a3440, SURF.skin);
      for (const s of [-1, 1]) {
        limb(rb, H, [s * 0.045, 0.04, 0.14], [s * 0.06, 0.12, 0.2], 0.018, 0.005, 0xf0f0e0, SURF.bone);
        ellC(rb, H, [s * 0.05, 0.13, 0.15], [0.02, 0.014, 0.02], null, 0x0a1018, SURF.cloth);
      }
      for (let i = 0; i < 6; i++) {
        const a = -1.2 + i * 0.48;
        limb(rb, H, [Math.sin(a) * 0.14, 0.22, Math.cos(a) * 0.05 - 0.04], [Math.sin(a) * 0.2, 0.3, -0.08], 0.04, 0.006, c.skin, SURF.fur);
      }
      glowEyes(rb, H, 0.13, 0.138, 0.05, c.eyes || 0x5ad4ff, 0.013);
      break;
    }
    case 'vampire': {
      ell(rb, H, [0, 0.12, 0.01], [0.098, 0.125, 0.105], null, c.skin, SURF.skin);
      ell(rb, H, [0, 0.055, 0.06], [0.055, 0.04, 0.05], [0.2, 0, 0], c.skin, SURF.skin);
      ell(rb, H, [0, 0.1, 0.11], [0.012, 0.025, 0.018], null, c.skin, SURF.skin);
      for (const s of [-1, 1]) {
        ellC(rb, H, [s * 0.035, 0.13, 0.095], [0.018, 0.01, 0.012], null, 0x1a0a10, SURF.skin);
        limb(rb, H, [s * 0.09, 0.12, 0.0], [s * 0.13, 0.19, -0.03], 0.018, 0.004, c.skin, SURF.skin);
        rb.add(H, xf(G.cone(0.005, 0.022, 4), [s * 0.016, 0.045, 0.1], [PI, 0, 0]), 0xf8f0e8, SURF.bone);
      }
      ell(rb, H, [0, 0.17, -0.01], [0.108, 0.07, 0.112], null, 0x0a0a0c, SURF.fur);
      limb(rb, H, [0, 0.2, 0.08], [0, 0.13, 0.11], 0.025, 0.006, 0x0a0a0c, SURF.fur);
      glowEyes(rb, H, 0.13, 0.1, 0.035, c.eyes || 0xff1030, 0.01);
      rb.add('neck', xf(G.cyl(0.2, 0.12, 0.3, 16, true), [0, 0.12, -0.04], [0.25, 0, 0]), c.cape, SURF.cloth);
      break;
    }
    default:
      return false;
  }
  return true;
}

// ======================= BRAS =======================
export function armHD(rb, type, c, T, A, side) {
  const s = side === 'L' ? 1 : -1;
  const arm = 'arm' + side;
  const fore = 'fore' + side;
  const hand = 'hand' + side;
  const ua = 0.29 * A;
  const fa = 0.27 * A;
  const fingers = (col, surf, r = 0.011, claw = null, clawLen = 0.05) => {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.019 * s * -1;
      limb(rb, hand, [x, -0.075, 0.01], [x * 1.1, -0.125, 0.026], r, r * 0.8, col, surf);
      if (claw) rb.add(hand, xf(G.cone(r * 0.9, clawLen, 5), [x * 1.1, -0.13 - clawLen / 2, 0.034], [PI + 0.35, 0, 0]), claw, SURF.bone);
    }
    limb(rb, hand, [s * 0.03, -0.035, 0.02], [s * 0.045, -0.08, 0.045], r * 1.05, r * 0.85, col, surf);
  };
  const handBody = (col, surf, w = 1) => {
    ell(rb, hand, [0, -0.045, 0.008], [0.042 * w, 0.048, 0.022 * w], null, col, surf);
  };
  switch (type) {
    case 'armor': {
      // Spalière en lames, canon d'arrière-bras, cubitière, avant-bras, gantelet
      for (let i = 0; i < 3; i++) ell(rb, arm, [s * (0.025 + i * 0.01), 0.04 - i * 0.045, 0], [0.12 * T - i * 0.012, 0.075, 0.12 * T - i * 0.01], [0, 0, s * (-0.35 - i * 0.12)], c.main, SURF.metal);
      rb.add(arm, xf(G.torus(0.1 * T, 0.013, 6, 16), [s * 0.04, -0.03, 0], [PI / 2, s * 0.35, 0]), c.trim, SURF.gold);
      limb(rb, arm, [0, -0.04, 0], [0, -ua, 0], 0.058 * T, 0.05 * T, c.main, SURF.metal);
      boxC(rb, arm, [0, -ua * 0.55, 0.06], [0.14, 0.01, 0.06], null, c.dark, SURF.darkMetal);
      ell(rb, fore, [0, 0, -0.01], [0.055 * T, 0.05, 0.06 * T], null, c.main, SURF.metal);
      rb.add(fore, xf(G.cone(0.045, 0.06, 8), [0, 0.0, -0.05], [-PI / 2, 0, 0], [1, 1, 0.5]), c.main, SURF.metal);
      limb(rb, fore, [0, -0.02, 0], [0, -fa * 0.92, 0.005], 0.062 * T, 0.045 * T, c.main, SURF.metal);
      rb.add(fore, xf(G.torus(0.05 * T, 0.009, 6, 14), [0, -fa * 0.85, 0.005], [PI / 2, 0, 0]), c.trim, SURF.gold);
      ell(rb, hand, [0, -0.045, 0.008], [0.048, 0.052, 0.03], null, c.main, SURF.darkMetal);
      fingers(c.main, SURF.darkMetal, 0.012);
      break;
    }
    case 'robe': {
      limb(rb, arm, [0, 0.0, 0], [0, -ua, 0], 0.07 * T, 0.068 * T, c.cloth, SURF.cloth);
      ell(rb, arm, [s * 0.02, 0.0, 0], [0.085 * T, 0.07, 0.085], null, c.cloth, SURF.cloth);
      // Manche évasée (creusée à l'intérieur)
      rb.add(fore, xf(G.cyl(0.07 * T, 0.12 * T, fa, 16), [0, -fa / 2, 0]), c.cloth, SURF.cloth);
      rb.carve(fore, xf(G.cyl(0.05 * T, 0.1 * T, fa * 0.7, 12), [0, -fa * 0.75, 0]), 0x050508, SURF.cloth);
      for (let i = 0; i < 3; i++) boxC(rb, fore, [Math.sin(i * 2.1) * 0.1 * T, -fa * 0.6, Math.cos(i * 2.1) * 0.1 * T], [0.02, fa * 0.6, 0.05], [0, i * 2.1, 0], c.cloth, SURF.cloth);
      handBody(c.skin, SURF.skin, 0.9);
      fingers(c.skin, SURF.skin, 0.009);
      break;
    }
    case 'bone': {
      ell(rb, arm, [0, 0.0, 0], [0.036, 0.034, 0.034], null, c.bone, SURF.bone);
      limb(rb, arm, [0, -0.02, 0], [0, -ua + 0.02, 0], 0.02, 0.018, c.bone, SURF.bone);
      for (const x of [-0.015, 0.015]) ell(rb, arm, [x, -ua + 0.01, 0], [0.018, 0.02, 0.02], null, c.bone, SURF.bone);
      ell(rb, fore, [0, -0.005, -0.012], [0.022, 0.025, 0.022], null, c.bone, SURF.bone);
      limb(rb, fore, [0.012, -0.02, 0], [0.014, -fa + 0.01, 0], 0.017, 0.014, c.bone, SURF.bone);
      limb(rb, fore, [-0.013, -0.02, 0], [-0.01, -fa + 0.01, 0], 0.013, 0.013, c.bone, SURF.bone);
      ell(rb, hand, [0, -0.03, 0], [0.028, 0.03, 0.012], null, c.bone, SURF.bone);
      fingers(c.bone, SURF.bone, 0.007);
      break;
    }
    case 'flesh':
    case 'claws': {
      ell(rb, arm, [s * 0.015, -0.005, 0], [0.072 * T, 0.075, 0.075 * T], null, c.skin, SURF.skin);
      limb(rb, arm, [0, -0.02, 0], [0, -ua, 0], 0.052 * T, 0.04 * T, c.skin, SURF.skin);
      ell(rb, arm, [0, -ua * 0.48, 0.022], [0.043 * T, 0.085, 0.043 * T], null, c.skin, SURF.skin);
      ell(rb, arm, [0, -ua * 0.42, -0.022], [0.042 * T, 0.1, 0.04 * T], null, c.skin, SURF.skin);
      ell(rb, fore, [0, -0.005, -0.025], [0.025, 0.028, 0.022], null, c.skin, SURF.skin);
      limb(rb, fore, [0, -0.01, 0], [0, -fa, 0.005], 0.043 * T, 0.028 * T, c.skin, SURF.skin);
      ell(rb, fore, [0, -fa * 0.28, 0.01], [0.048 * T, 0.09, 0.043 * T], null, c.skin, SURF.skin);
      handBody(c.skin, SURF.skin, T);
      fingers(c.skin, SURF.skin, 0.01, type === 'claws' ? c.bone : null, 0.06);
      break;
    }
    case 'fur': {
      ell(rb, arm, [s * 0.02, 0.0, 0], [0.1 * T, 0.095, 0.1 * T], null, c.skin, SURF.fur);
      limb(rb, arm, [0, -0.02, 0], [0, -ua, 0], 0.078 * T, 0.06 * T, c.skin, SURF.fur);
      ell(rb, arm, [0, -ua * 0.45, 0.02], [0.065 * T, 0.11, 0.062 * T], null, c.skin, SURF.fur);
      for (let i = 0; i < 3; i++) limb(rb, arm, [s * 0.05, -0.05 - i * 0.07, -0.04], [s * 0.1, -0.1 - i * 0.07, -0.07], 0.03, 0.006, c.skin, SURF.fur);
      limb(rb, fore, [0, -0.01, 0], [0, -fa, 0.01], 0.068 * T, 0.05 * T, c.skin, SURF.fur);
      ell(rb, fore, [0, -fa * 0.3, 0.01], [0.07 * T, 0.1, 0.064 * T], null, c.skin, SURF.fur);
      for (let i = 0; i < 2; i++) limb(rb, fore, [s * 0.04, -0.05 - i * 0.08, -0.04], [s * 0.09, -0.09 - i * 0.08, -0.07], 0.028, 0.006, c.skin, SURF.fur);
      ell(rb, hand, [0, -0.05, 0.01], [0.06 * T, 0.06, 0.035 * T], null, c.skin, SURF.fur);
      fingers(c.skin, SURF.fur, 0.014, c.bone, 0.08);
      break;
    }
    case 'leather': {
      ell(rb, arm, [s * 0.015, -0.005, 0], [0.07 * T, 0.07, 0.072 * T], null, c.cloth, SURF.cloth);
      limb(rb, arm, [0, -0.02, 0], [0, -ua, 0], 0.052 * T, 0.045 * T, c.cloth, SURF.cloth);
      limb(rb, fore, [0, -0.01, 0], [0, -fa, 0.005], 0.05 * T, 0.04 * T, c.leather, SURF.leather);
      for (let i = 0; i < 3; i++) boxC(rb, fore, [0, -0.06 - i * 0.06, 0.04], [0.12, 0.008, 0.05], null, c.dark, SURF.leather);
      handBody(c.dark, SURF.leather, T);
      fingers(c.dark, SURF.leather, 0.011);
      break;
    }
    case 'stone':
    case 'magma':
    case 'crystal':
    case 'bark': {
      const surf = type === 'crystal' ? SURF.crystal : type === 'bark' ? SURF.wood : SURF.stone;
      const shape = type === 'crystal' ? G.octa : G.dodeca;
      rb.add(arm, xf(shape(0.11 * T), [s * 0.02, -0.02, 0], [0.3, 0.2, 0.1], [1.2, 1, 1.1]), c.main, surf);
      limb(rb, arm, [0, -0.02, 0], [0, -ua, 0], 0.075 * T, 0.065 * T, c.main, surf);
      rb.add(arm, xf(shape(0.07 * T), [s * 0.03, -ua * 0.5, 0.03], [0.6, 0.3, 0.2]), c.main, surf);
      limb(rb, fore, [0, -0.01, 0], [0, -fa, 0], 0.08 * T, 0.1 * T, c.main, surf);
      rb.add(fore, xf(shape(0.08 * T), [0, -fa * 0.4, -0.03], [0.2, 0.9, 0.4]), c.main, surf);
      rb.add(hand, xf(shape(0.1 * T), [0, -0.06, 0], [0.5, 0.3, 0]), c.main, surf);
      if (type === 'magma' || type === 'crystal' || type === 'stone') {
        const gc = c.glow || 0xff6a1a;
        boxC(rb, fore, [0, -fa * 0.5, 0.075 * T], [0.013, fa * 0.7, 0.05], [0, 0, 0.2], gc, SURF.glow);
        boxC(rb, arm, [0, -ua * 0.5, 0.06 * T], [0.013, ua * 0.6, 0.05], [0, 0, -0.3], gc, SURF.glow);
      }
      if (type === 'bark') for (let i = 0; i < 4; i++) boxC(rb, fore, [Math.sin(i * 1.6) * 0.09, -fa / 2, Math.cos(i * 1.6) * 0.09], [0.015, fa, 0.04], [0, i * 1.6, 0], 0x1a1008, SURF.wood);
      break;
    }
    default:
      break;
  }
}

// ======================= JAMBES =======================
export function legHD(rb, type, c, T, L, side, B) {
  const s = side === 'L' ? 1 : -1;
  const th = 'thigh' + side;
  const sh = 'shin' + side;
  const ft = 'foot' + side;
  const tl = 0.44 * L;
  const sl = 0.44 * L;
  const muscleLeg = (colT, surfT, colS, surfS, k = 1) => {
    limb(rb, th, [0, 0.0, 0], [0, -tl, 0.005], 0.075 * T * k, 0.05 * T * k, colT, surfT);
    ell(rb, th, [s * 0.008, -tl * 0.38, 0.03], [0.068 * T * k, 0.15, 0.06 * T * k], null, colT, surfT);
    ell(rb, th, [0, -tl * 0.45, -0.03], [0.058 * T * k, 0.14, 0.052 * T * k], null, colT, surfT);
    ell(rb, sh, [0, 0.0, 0.035], [0.033, 0.035, 0.028], null, colS, surfS);
    limb(rb, sh, [0, 0.0, 0], [0, -sl, 0], 0.05 * T * k, 0.034 * T * k, colS, surfS);
    ell(rb, sh, [0, -sl * 0.3, -0.03], [0.05 * T * k, 0.11, 0.05 * T * k], null, colS, surfS);
  };
  const footBody = (col, surf, w = 1, toes = true, claws = null) => {
    ell(rb, ft, [0, -0.035, -0.015], [0.042 * w, 0.038, 0.05], null, col, surf);
    rb.add(ft, xf(G.box(0.085 * w, 0.05, 0.15), [0, -0.05, 0.06]), col, surf);
    if (toes) for (let i = 0; i < 4; i++) limb(rb, ft, [(i - 1.5) * 0.02 * w, -0.065, 0.12], [(i - 1.5) * 0.022 * w, -0.07, 0.16], 0.012, 0.01, col, surf);
    if (claws) for (let i = 0; i < 3; i++) rb.add(ft, xf(G.cone(0.012, 0.06, 5), [(i - 1) * 0.026 * w, -0.06, 0.19], [PI / 2, 0, 0]), claws, SURF.bone);
  };
  switch (type) {
    case 'armor': {
      limb(rb, th, [0, 0, 0], [0, -tl, 0], 0.075 * T, 0.062 * T, 0x2a2a30, SURF.leather);
      limb(rb, th, [0, -0.04, 0.015], [0, -tl * 0.85, 0.018], 0.082 * T, 0.068 * T, c.main, SURF.metal);
      boxC(rb, th, [0, -tl * 0.4, 0.08], [0.18, 0.01, 0.06], null, c.dark, SURF.darkMetal);
      ell(rb, sh, [0, 0, 0.03], [0.06 * T, 0.06, 0.055 * T], null, c.main, SURF.metal);
      rb.add(sh, xf(G.cone(0.05, 0.06, 8), [0, 0, 0.07], [PI / 2, 0, 0], [1, 1, 0.6]), c.main, SURF.metal);
      limb(rb, sh, [0, -0.03, 0.005], [0, -sl * 0.92, 0.005], 0.066 * T, 0.05 * T, c.main, SURF.metal);
      boxC(rb, sh, [0, -sl * 0.5, 0.07], [0.012, sl * 0.6, 0.05], null, c.dark, SURF.darkMetal);
      ell(rb, ft, [0, -0.035, -0.01], [0.05, 0.042, 0.06], null, c.main, SURF.darkMetal);
      rb.add(ft, xf(G.box(0.1 * T, 0.065, 0.2), [0, -0.045, 0.06]), c.main, SURF.darkMetal);
      for (let i = 0; i < 3; i++) boxC(rb, ft, [0, -0.02, 0.07 + i * 0.045], [0.14, 0.01, 0.02], null, c.dark, SURF.darkMetal);
      break;
    }
    case 'robe': {
      muscleLeg(c.cloth, SURF.cloth, c.cloth, SURF.cloth, 0.9);
      footBody(c.dark, SURF.leather, 1, false);
      break;
    }
    case 'bone': {
      ell(rb, th, [0, -0.01, 0], [0.03, 0.03, 0.03], null, c.bone, SURF.bone);
      limb(rb, th, [0, -0.02, 0], [0, -tl + 0.02, 0], 0.022, 0.019, c.bone, SURF.bone);
      for (const x of [-0.018, 0.018]) ell(rb, th, [x, -tl + 0.01, 0], [0.02, 0.022, 0.024], null, c.bone, SURF.bone);
      ell(rb, sh, [0, 0, 0.03], [0.022, 0.024, 0.016], null, c.bone, SURF.bone);
      limb(rb, sh, [0.008, -0.02, 0], [0.008, -sl + 0.01, 0], 0.02, 0.016, c.bone, SURF.bone);
      limb(rb, sh, [-0.018, -0.02, -0.005], [-0.014, -sl + 0.01, -0.005], 0.011, 0.011, c.bone, SURF.bone);
      ell(rb, ft, [0, -0.025, 0.0], [0.028, 0.025, 0.035], null, c.bone, SURF.bone);
      for (let i = 0; i < 4; i++) limb(rb, ft, [(i - 1.5) * 0.017, -0.035, 0.02], [(i - 1.5) * 0.02, -0.05, 0.13], 0.008, 0.007, c.bone, SURF.bone);
      break;
    }
    case 'flesh': {
      muscleLeg(c.cloth, SURF.cloth, c.skin, SURF.skin);
      boxC(rb, th, [0, -tl * 0.95, 0], [0.2, 0.05, 0.2], [0.3, 0, 0.2], c.skin, SURF.skin);
      footBody(c.skin, SURF.skin, T);
      break;
    }
    case 'fur': {
      // Jambe digitigrade velue
      limb(rb, th, [0, 0, 0], [0, -tl, 0.01], 0.09 * T, 0.062 * T, c.skin, SURF.fur);
      ell(rb, th, [0, -tl * 0.38, 0.03], [0.085 * T, 0.16, 0.075 * T], null, c.skin, SURF.fur);
      for (let i = 0; i < 3; i++) limb(rb, th, [s * 0.06, -0.08 - i * 0.1, -0.03], [s * 0.1, -0.13 - i * 0.1, -0.07], 0.035, 0.006, c.skin, SURF.fur);
      ell(rb, sh, [0, 0, 0.03], [0.045, 0.045, 0.04], null, c.skin, SURF.fur);
      limb(rb, sh, [0, 0, 0], [0, -sl, -0.02], 0.062 * T, 0.042 * T, c.skin, SURF.fur);
      ell(rb, sh, [0, -sl * 0.28, -0.035], [0.062 * T, 0.11, 0.06 * T], null, c.skin, SURF.fur);
      footBody(c.skin, SURF.fur, T * 1.1, false, c.bone);
      break;
    }
    case 'leather': {
      muscleLeg(c.leather, SURF.leather, c.leather, SURF.leather, 0.95);
      limb(rb, sh, [0, -sl * 0.35, 0.005], [0, -sl, 0.005], 0.052 * T, 0.045 * T, c.dark, SURF.leather);
      rb.add(sh, xf(G.torus(0.052 * T, 0.008, 6, 14), [0, -sl * 0.38, 0.005], [PI / 2, 0, 0]), c.dark, SURF.leather);
      footBody(c.dark, SURF.leather, T, false);
      break;
    }
    case 'stone':
    case 'magma':
    case 'crystal':
    case 'bark': {
      const surf = type === 'crystal' ? SURF.crystal : type === 'bark' ? SURF.wood : SURF.stone;
      const shape = type === 'crystal' ? G.octa : G.dodeca;
      limb(rb, th, [0, 0, 0], [0, -tl, 0], 0.1 * T, 0.085 * T, c.main, surf);
      rb.add(th, xf(shape(0.09 * T), [s * 0.02, -tl * 0.45, 0.03], [0.3, 0.6, 0.1]), c.main, surf);
      limb(rb, sh, [0, 0, 0], [0, -sl, 0], 0.085 * T, 0.11 * T, c.main, surf);
      rb.add(sh, xf(shape(0.07 * T), [0, 0, 0.05], [0.5, 0.2, 0.3]), c.main, surf);
      rb.add(ft, xf(G.box(0.16 * T, 0.09, 0.24), [0, -0.04, 0.04]), c.main, surf);
      if (type !== 'bark') boxC(rb, sh, [0, -sl * 0.5, 0.08 * T], [0.013, sl * 0.6, 0.05], [0, 0, 0.25], c.glow || 0xff6a1a, SURF.glow);
      break;
    }
    case 'none':
    default:
      break;
  }
}

// Queue articulée (3 os) en segments arrondis
export function tailHD(rb, c) {
  const col = c.tail || c.skin;
  limb(rb, 'tail1', [0, 0, 0], [0, -0.02, -0.36], 0.055, 0.042, col, SURF.leather);
  limb(rb, 'tail2', [0, 0, 0], [0, 0, -0.34], 0.042, 0.026, col, SURF.leather);
  limb(rb, 'tail3', [0, 0, 0], [0, 0.01, -0.2], 0.026, 0.01, col, SURF.leather);
  rb.add('tail3', xf(G.cone(0.05, 0.16, 6), [0, 0, -0.24], [-PI / 2, 0, 0], [1, 1, 0.3]), c.dark, SURF.leather);
}

// ======================= QUADRUPÈDES =======================
// Mêmes os que le modèle classique (body, chest, neck, head, jaw, legXX / legXX2, tail1-2)
export function quadHD(rb, t, c, W, legH, bodyLen) {
  const fur = t === 'toad' ? SURF.wet : t === 'rat' || t === 'wolf' || t === 'hound' ? SURF.fur : SURF.leather;
  const m = c.main;
  if (t === 'toad') {
    ell(rb, 'body', [0, 0.03, 0.16], [0.36, 0.22, 0.34], null, m, SURF.wet);
    ell(rb, 'body', [0, -0.07, 0.18], [0.3, 0.14, 0.28], null, c.belly, SURF.wet);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = 0.12 + (i % 4) * 0.05;
      ell(rb, 'body', [Math.sin(a) * r, 0.2 + (i % 3) * 0.02, 0.16 + Math.cos(a) * r * 0.9], [0.035, 0.03, 0.035], null, m, SURF.wet);
    }
    for (let i = 0; i < 7; i++) rb.add('body', xf(G.sphere(0.028, 8, 6), [Math.sin(i * 1.7) * 0.2, 0.235, 0.15 + Math.cos(i * 2.3) * 0.18]), c.glow, SURF.glowSoft);
    ell(rb, 'chest', [0, -0.02, 0], [0.26, 0.17, 0.16], null, m, SURF.wet);
    ell(rb, 'neck', [0, 0, 0.02], [0.2, 0.12, 0.12], null, m, SURF.wet);
    ell(rb, 'head', [0, 0.02, 0.06], [0.24, 0.12, 0.17], null, m, SURF.wet);
    boxC(rb, 'head', [0, -0.05, 0.16], [0.44, 0.02, 0.2], null, 0x3a0a14, SURF.wet);
    ell(rb, 'jaw', [0, -0.02, 0.04], [0.23, 0.05, 0.15], null, c.belly, SURF.wet);
    for (const s of [-1, 1]) {
      ell(rb, 'head', [s * 0.13, 0.11, 0.05], [0.06, 0.055, 0.06], null, 0xd8c840, SURF.wet);
      rb.add('head', xf(G.sphere(0.028, 8, 6), [s * 0.15, 0.13, 0.1]), c.eyes, SURF.glow);
    }
  } else {
    const R = t === 'rat' ? 0.8 : 1;
    // Arrière-train, ventre rentré, cage thoracique, poitrail
    ell(rb, 'body', [0, 0.01, 0.12], [0.15 * W, 0.15 * W * R, 0.24], null, m, fur);
    ell(rb, 'body', [0, -0.02, bodyLen * 0.5], [0.12 * W, 0.12 * W, bodyLen * 0.35], null, m, fur);
    ell(rb, 'chest', [0, -0.01, -0.02], [0.17 * W, 0.19 * W, 0.2 * W], null, m, fur);
    ell(rb, 'chest', [0, -0.09 * W, 0.1 * W], [0.12 * W, 0.12 * W, 0.1 * W], [0.3, 0, 0], c.belly || m, fur);
    // Épaules et hanches (sur les pattes pour bien plier)
    for (const n of ['FL', 'FR']) ell(rb, 'leg' + n, [0, -0.03, 0], [0.065 * W, 0.12 * W, 0.1 * W], null, m, fur);
    for (const n of ['BL', 'BR']) ell(rb, 'leg' + n, [0, -0.04, 0.02], [0.07 * W, 0.14 * W, 0.12 * W], null, m, fur);
    // Crinière / crête
    if (t !== 'rat') for (let i = 0; i < 8; i++) limb(rb, i < 4 ? 'chest' : 'body', [0, (i < 4 ? 0.16 : 0.13) * W, i < 4 ? 0.08 - i * 0.08 : 0.5 - (i - 4) * 0.12], [0, (i < 4 ? 0.26 : 0.2) * W, i < 4 ? -0.02 - i * 0.08 : 0.4 - (i - 4) * 0.12], 0.045 * W, 0.006, c.dark, SURF.fur);
    if (t === 'hound') {
      for (let i = 0; i < 6; i++) boxC(rb, i < 3 ? 'chest' : 'body', [(i % 2 ? 1 : -1) * 0.1 * W, 0.08, i < 3 ? 0.02 - i * 0.06 : 0.4 - (i - 3) * 0.1], [0.02, 0.12, 0.08], [0.3, 0, (i % 2 ? 1 : -1) * 0.8], c.glow, SURF.glow);
      for (let i = 0; i < 5; i++) limb(rb, 'body', [0, 0.14, 0.45 - i * 0.12], [0, 0.26, 0.4 - i * 0.12], 0.025, 0.004, c.bone, SURF.bone);
    }
    // Cou
    limb(rb, 'neck', [0, -0.05, -0.08], [0, 0.03, 0.1], 0.1 * W * R, 0.075 * W * R, m, fur);
    ell(rb, 'neck', [0, -0.04, 0.0], [0.12 * W, 0.1 * W, 0.1 * W], null, m, fur);
    // Tête
    const HS = t === 'rat' ? 0.62 : 1;
    ell(rb, 'head', [0, 0.02 * HS, 0], [0.095 * HS, 0.085 * HS, 0.1 * HS], null, m, fur);
    ell(rb, 'head', [0, 0.06 * HS, 0.06 * HS], [0.07 * HS, 0.03 * HS, 0.05 * HS], [0.3, 0, 0], m, fur);
    limb(rb, 'head', [0, 0.0, 0.05 * HS], [0, -0.015 * HS, t === 'rat' ? 0.2 * HS : 0.23 * HS], 0.058 * HS, t === 'rat' ? 0.018 : 0.03 * HS, m, fur);
    ell(rb, 'head', [0, -0.002, (t === 'rat' ? 0.215 : 0.245) * HS], [0.022 * HS, 0.018 * HS, 0.018 * HS], null, 0x050505, SURF.wet);
    for (const s of [-1, 1]) {
      if (t === 'rat') {
        ell(rb, 'head', [s * 0.06 * HS, 0.09 * HS, -0.02], [0.012, 0.05 * HS, 0.045 * HS], [0, s * 0.3, 0], 0xb08a8a, SURF.skin);
      } else limb(rb, 'head', [s * 0.05 * HS, 0.07 * HS, -0.02], [s * 0.07 * HS, 0.17 * HS, -0.05], 0.035 * HS, 0.006, m, fur);
      ell(rb, 'head', [s * 0.065 * HS, -0.01, 0.02], [0.045 * HS, 0.06 * HS, 0.06 * HS], [0, 0, s * 0.3], m, fur);
      ellC(rb, 'head', [s * 0.045 * HS, 0.045 * HS, 0.085 * HS], [0.018 * HS, 0.012 * HS, 0.016 * HS], null, 0x100804, SURF.cloth);
      rb.add('head', xf(G.sphere(0.013 * HS, 8, 6), [s * 0.047 * HS, 0.045 * HS, 0.083 * HS]), c.eyes, SURF.glow);
    }
    if (t === 'hound') for (const s of [-1, 1]) hornHD(rb, 'head', [s * 0.05, 0.08, 0], [s * 0.4, 0.7, -0.6], 0.22, 0.028, c.dark, 1, SURF.bone);
    // Mâchoire, dents, crocs
    limb(rb, 'jaw', [0, -0.01, -0.01], [0, -0.02, (t === 'rat' ? 0.13 : 0.16) * HS], 0.038 * HS, 0.022 * HS, c.belly || m, SURF.leather);
    teeth(rb, 'jaw', 0.012, 0.13 * HS, 0.045 * HS, 4, c.bone, 0.018 * HS, false);
    for (const s of [-1, 1]) rb.add('head', xf(G.cone(0.008 * HS, 0.04 * HS, 5), [s * 0.022 * HS, -0.03 * HS, 0.17 * HS], [PI, 0, 0]), c.bone, SURF.bone);
    if (t === 'rat') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(rb, 'head', [s * 0.03, -0.005, 0.19 * HS], [0.07, 0.002, 0.002], [0, s * (0.3 + i * 0.15), 0.1 * (i - 1)], 0xd0c0b0, SURF.bone);
  }
  // Pattes
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const th = t === 'toad' ? 0.075 : 0.055 * W;
    const back = n[0] === 'B';
    limb(rb, 'leg' + n, [0, 0, 0], [0, -legH * 0.5, back ? -0.03 : 0.01], th, th * 0.72, c.main, fur);
    ell(rb, 'leg' + n, [0, -legH * 0.2, back ? -0.01 : 0.01], [th * 1.1, legH * 0.2, th * 1.2], null, c.main, fur);
    limb(rb, 'leg' + n + '2', [0, 0, back ? -0.03 : 0.01], [0, -legH * 0.5 + 0.03, 0.02], th * 0.68, th * 0.52, c.main, fur);
    ell(rb, 'leg' + n + '2', [0, -legH * 0.5 + 0.02, 0.04], [th * 1.05, 0.028, th * 1.45], null, t === 'toad' ? c.main : c.dark, t === 'toad' ? SURF.wet : SURF.leather);
    for (let i = 0; i < 3; i++) rb.add('leg' + n + '2', xf(G.cone(0.008 * W, 0.04, 5), [(i - 1) * th * 0.6, -legH * 0.5 + 0.015, 0.04 + th * 1.4], [PI / 2 + 0.3, 0, 0]), c.bone, SURF.bone);
  }
  // Queue
  if (t === 'rat') {
    limb(rb, 'tail1', [0, 0, 0], [0, -0.03, -0.4], 0.03, 0.018, 0xb08a8a, SURF.skin);
    limb(rb, 'tail2', [0, 0, 0], [0, -0.05, -0.4], 0.018, 0.005, 0xb08a8a, SURF.skin);
  } else if (t === 'toad') {
    // pas de queue
  } else {
    limb(rb, 'tail1', [0, 0, 0], [0, -0.03, -0.26], 0.045 * W, 0.06 * W, m, fur);
    limb(rb, 'tail2', [0, 0, 0], [0, -0.06, -0.3], 0.06 * W, 0.012, t === 'hound' ? c.glow : m, t === 'hound' ? SURF.glowSoft : fur);
  }
}

// ======================= ARAIGNÉE =======================
export function spiderHD(rb, c) {
  const m = c.main;
  ell(rb, 'body', [0, 0, 0], [0.21, 0.13, 0.24], null, m, SURF.leather);
  for (let i = 0; i < 4; i++) boxC(rb, 'body', [0, 0.12, -0.12 + i * 0.07], [0.3, 0.012, 0.03], [0, 0, 0], 0x0a0808, SURF.leather);
  ell(rb, 'body', [0, 0.1, 0.02], [0.08, 0.04, 0.12], null, m, SURF.leather);
  // Abdomen velu avec motif creusé lumineux
  ell(rb, 'abdomen', [0, 0.06, -0.22], [0.34, 0.28, 0.42], null, m, SURF.fur);
  ell(rb, 'abdomen', [0, -0.02, -0.02], [0.14, 0.12, 0.12], null, m, SURF.leather);
  boxC(rb, 'abdomen', [0, 0.32, -0.2], [0.05, 0.05, 0.36], [0.15, 0, 0], c.mark, SURF.glowSoft);
  for (const s of [-1, 1]) boxC(rb, 'abdomen', [s * 0.1, 0.28, -0.28], [0.03, 0.05, 0.16], [0.2, s * 0.5, 0], c.mark, SURF.glowSoft);
  for (let i = 0; i < 3; i++) boxC(rb, 'abdomen', [0, 0.1, -0.55 + i * 0.12], [0.5, 0.3, 0.012], [0.4, 0, 0], 0x0a0808, SURF.fur);
  limb(rb, 'abdomen', [0, -0.05, -0.55], [0, -0.1, -0.66], 0.05, 0.02, m, SURF.leather);
  // Tête, chélicères, crochets, yeux
  ell(rb, 'head', [0, 0.01, 0.05], [0.12, 0.1, 0.11], null, m, SURF.leather);
  for (let i = 0; i < 8; i++) rb.add('head', xf(G.sphere(i < 2 ? 0.026 : 0.017, 8, 6), [((i % 4) - 1.5) * (i < 4 ? 0.045 : 0.07), 0.06 + (i < 4 ? 0 : 0.035), 0.14 - (i < 4 ? 0 : 0.03)]), c.eyes, SURF.glow);
  for (const s of [-1, 1]) {
    limb(rb, 'head', [s * 0.04, -0.03, 0.1], [s * 0.045, -0.1, 0.16], 0.035, 0.025, m, SURF.fur);
    rb.add('head', xf(G.cone(0.016, 0.1, 6), [s * 0.04, -0.16, 0.17], [PI - 0.3, 0, s * 0.2]), c.bone, SURF.bone);
    limb(rb, 'head', [s * 0.07, -0.02, 0.08], [s * 0.12, -0.08, 0.2], 0.022, 0.014, m, SURF.fur);
  }
  // Pattes articulées
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1;
    const n = 'leg' + i;
    ell(rb, n, [0, 0, 0], [0.04, 0.04, 0.04], null, m, SURF.leather);
    limb(rb, n, [0, 0, 0], [side * 0.36, 0.22, 0], 0.038, 0.03, m, SURF.fur);
    ell(rb, n + 'b', [0, 0, 0], [0.034, 0.034, 0.034], null, m, SURF.leather);
    limb(rb, n + 'b', [0, 0, 0], [side * 0.14, -0.36, 0], 0.03, 0.022, m, SURF.fur);
    limb(rb, n + 'b', [side * 0.14, -0.36, 0], [side * 0.24, -0.66, 0], 0.022, 0.006, m, SURF.leather);
    for (let k = 0; k < 3; k++) boxC(rb, n + 'b', [side * (0.06 + k * 0.05), -0.15 - k * 0.13, 0], [0.08, 0.006, 0.08], [0, 0, side * 0.4], 0x0a0808, SURF.leather);
  }
}

// ======================= SERPENT =======================
export function serpentHD(rb, c, segs) {
  for (let i = 0; i < segs; i++) {
    const r0 = 0.22 * (1 - (i / segs) * 0.75);
    const r1 = 0.22 * (1 - ((i + 1) / segs) * 0.75);
    limb(rb, 'seg' + i, [0, 0, 0], [0, 0, -0.44], r0, i === segs - 1 ? 0.02 : r1, i % 2 ? c.main : c.mark, SURF.scales);
    // Ventre en plaques
    ell(rb, 'seg' + i, [0, -r0 * 0.55, -0.21], [r0 * 0.85, r0 * 0.45, 0.26], null, c.belly, SURF.leather);
    for (let k = 0; k < 3; k++) boxC(rb, 'seg' + i, [0, -r0 * 0.95, -0.07 - k * 0.14], [r0 * 2, 0.02, 0.014], null, c.mark, SURF.leather);
    // Crête dorsale
    rb.add('seg' + i, xf(G.cone(0.035 * (r0 / 0.22 + 0.3), 0.12 * (r0 / 0.22 + 0.3), 5), [0, r0 * 0.95, -0.2], [-0.5, 0, 0]), c.mark, SURF.bone);
  }
  limb(rb, 'neck', [0, 0, 0], [0, 0.36, 0.2], 0.22, 0.18, c.main, SURF.scales);
  ell(rb, 'neck', [0, 0.14, 0.14], [0.17, 0.2, 0.12], [0.5, 0, 0], c.belly, SURF.leather);
  for (const s of [-1, 1]) ell(rb, 'neck', [s * 0.18, 0.28, 0.1], [0.14, 0.2, 0.03], [0.4, s * 0.3, s * 0.4], c.mark, SURF.scales);
  // Tête
  ell(rb, 'head', [0, 0.01, 0.06], [0.2, 0.13, 0.22], null, c.main, SURF.scales);
  limb(rb, 'head', [0, 0.0, 0.1], [0, -0.02, 0.36], 0.14, 0.07, c.main, SURF.scales);
  for (const s of [-1, 1]) {
    ell(rb, 'head', [s * 0.11, 0.09, 0.15], [0.07, 0.035, 0.1], [0, s * 0.2, 0], c.mark, SURF.scales);
    rb.add('head', xf(G.sphere(0.035, 8, 6), [s * 0.14, 0.07, 0.17]), c.eyes, SURF.glow);
    ellC(rb, 'head', [s * 0.14, 0.07, 0.17], [0.045, 0.03, 0.04], null, 0x0a0a06, SURF.cloth);
    ellC(rb, 'head', [s * 0.04, 0.02, 0.4], [0.012, 0.01, 0.02], null, 0x050505, SURF.cloth);
    hornHD(rb, 'head', [s * 0.12, 0.1, -0.05], [s * 0.3, 0.2, -1], 0.26, 0.04, c.mark, 0.4, SURF.bone);
    rb.add('jaw', xf(G.cone(0.018, 0.1, 6), [s * 0.08, 0.06, 0.26]), 0xf0f0e0, SURF.bone);
  }
  limb(rb, 'jaw', [0, -0.02, 0.0], [0, -0.03, 0.3], 0.1, 0.05, c.belly, SURF.leather);
}

// ======================= CHAUVE-SOURIS =======================
export function batHD(rb, c) {
  ell(rb, 'body', [0, 0, 0], [0.11, 0.15, 0.1], null, c.main, SURF.fur);
  ell(rb, 'body', [0, 0.06, 0.04], [0.09, 0.07, 0.07], null, c.main, SURF.fur);
  ell(rb, 'head', [0, 0, 0], [0.075, 0.07, 0.075], null, c.main, SURF.fur);
  limb(rb, 'head', [0, -0.01, 0.04], [0, -0.03, 0.1], 0.035, 0.02, c.main, SURF.leather);
  ell(rb, 'head', [0, -0.02, 0.105], [0.022, 0.015, 0.012], null, 0x2a1016, SURF.wet);
  for (const s of [-1, 1]) {
    limb(rb, 'head', [s * 0.04, 0.05, 0], [s * 0.08, 0.16, -0.02], 0.035, 0.006, c.main, SURF.leather);
    ellC(rb, 'head', [s * 0.06, 0.1, 0.01], [0.012, 0.04, 0.02], [0, 0, s * 0.3], 0x5a2030, SURF.skin);
    rb.add('head', xf(G.sphere(0.014, 8, 6), [s * 0.03, 0.015, 0.065]), c.eyes, SURF.glow);
    rb.add('head', xf(G.cone(0.007, 0.03, 4), [s * 0.015, -0.05, 0.085], [PI, 0, 0]), 0xffffff, SURF.bone);
    const w = s > 0 ? 'wingL' : 'wingR';
    limb(rb, w, [0, 0, 0], [s * 0.35, 0.02, 0], 0.025, 0.018, c.main, SURF.leather);
    limb(rb, w + '2', [0, 0, 0], [s * 0.36, -0.02, -0.12], 0.016, 0.006, c.main, SURF.leather);
    limb(rb, w + '2', [0, 0, 0], [s * 0.28, -0.02, -0.26], 0.014, 0.005, c.main, SURF.leather);
    rb.add(w, xf(G.box(0.36, 0.012, 0.26), [s * 0.18, 0, -0.1]), c.wing, SURF.leather);
    rb.add(w + '2', xf(G.box(0.36, 0.01, 0.3), [s * 0.17, 0, -0.14], [0, s * 0.2, 0]), c.wing, SURF.leather);
  }
  for (const s of [-1, 1]) limb(rb, 'body', [s * 0.05, -0.12, 0], [s * 0.06, -0.24, 0.02], 0.02, 0.01, c.main, SURF.leather);
}

// ======================= HORREUR TENTACULAIRE =======================
export function tentacleHD(rb, c, n) {
  ell(rb, 'body', [0, 0, 0], [0.9, 0.55, 0.9], null, c.mound, SURF.wet);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.2;
    ell(rb, 'body', [Math.sin(a) * 0.55, 0.28, Math.cos(a) * 0.55], [0.16, 0.12, 0.16], null, c.mound, SURF.wet);
    ellC(rb, 'body', [Math.sin(a + 1) * 0.6, 0.3, Math.cos(a + 1) * 0.6], [0.07, 0.05, 0.07], null, c.tip, SURF.glowSoft);
  }
  ell(rb, 'eye', [0, 0, 0], [0.34, 0.34, 0.34], null, 0xe0d0c0, SURF.wet);
  ellC(rb, 'eye', [0, 0, 0.3], [0.18, 0.18, 0.1], null, c.eye, SURF.glow);
  rb.add('eye', xf(G.sphere(0.06, 8, 6), [0, 0, 0.27], [0, 0, 0], [0.5, 1.5, 0.5]), 0x050505, SURF.wet);
  for (const s of [-1, 1]) ell(rb, 'eye', [0, s * 0.22, 0.12], [0.36, 0.14, 0.3], [s * -0.4, 0, 0], c.main, SURF.wet);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 5; k++) {
      const name = 't' + i + '_' + k;
      const r = 0.2 * (1 - k * 0.17);
      limb(rb, name, [0, 0, 0], [0, 0.56, 0], r, r * 0.83, k === 4 ? c.tip : c.main, k === 4 ? SURF.glowSoft : SURF.wet);
      for (let v = 0; v < 2; v++) ellC(rb, name, [0, 0.15 + v * 0.25, r * 0.85], [r * 0.3, r * 0.3, r * 0.3], null, c.tip, SURF.glowSoft);
    }
  }
}

// ======================= ŒIL DU NÉANT =======================
export function eyeHD(rb, c) {
  for (let i = 0; i < 5; i++) {
    limb(rb, 't' + i + 'a', [0, 0.05, 0], [0, -0.36, 0], 0.055, 0.035, c.tent, SURF.wet);
    limb(rb, 't' + i + 'b', [0, 0, 0], [0, -0.4, 0.03], 0.035, 0.006, c.tent, SURF.wet);
  }
  ell(rb, 'body', [0, 0, 0], [0.42, 0.42, 0.42], null, c.white, SURF.wet);
  ellC(rb, 'body', [0, 0, 0.4], [0.2, 0.2, 0.08], null, c.iris, SURF.glow);
  rb.add('body', xf(G.sphere(0.08, 8, 6), [0, 0, 0.36], [0, 0, 0], [0.5, 1.4, 0.5]), 0x050505, SURF.wet);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2;
    boxC(rb, 'body', [Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0.28], [0.01, 0.2, 0.08], [0, 0, -a], 0x6a1030, SURF.wet);
  }
  rb.add('lidT', xf(G.sphereP(0.45, 18, 8, 0, PI * 2, 0, PI * 0.45), [0, 0, 0], [-0.6, 0, 0]), c.main, SURF.leather);
  rb.add('body', xf(G.sphereP(0.45, 18, 8, 0, PI * 2, 0, PI * 0.45), [0, 0, 0], [PI + 0.7, 0, 0]), c.main, SURF.leather);
}

// ======================= DRAGON =======================
export function dragonHD(rb, c) {
  const m = c.main;
  // Corps, poitrail, ventre en plaques
  ell(rb, 'body', [0, 0, 0.3], [0.6, 0.52, 0.85], null, m, SURF.scales);
  ell(rb, 'chest', [0, 0, 0], [0.62, 0.6, 0.68], null, m, SURF.scales);
  ell(rb, 'chest', [0, -0.22, 0.1], [0.48, 0.38, 0.52], null, c.belly, SURF.leather);
  for (let i = 0; i < 5; i++) boxC(rb, 'chest', [0, -0.52, -0.25 + i * 0.13], [0.7, 0.03, 0.02], null, c.horn, SURF.leather);
  for (let i = 0; i < 7; i++) limb(rb, 'body', [0, 0.45, 1 - i * 0.3], [0, 0.78, 0.9 - i * 0.3], 0.09, 0.01, c.horn, SURF.bone);
  // Cou
  for (let i = 0; i < 4; i++) {
    limb(rb, 'neck' + i, [0, -0.08, -0.12], [0, 0.18, 0.35], 0.3 - i * 0.03, 0.27 - i * 0.03, m, SURF.scales);
    ell(rb, 'neck' + i, [0, -0.08, 0.1], [0.2 - i * 0.02, 0.14, 0.2], [0.8, 0, 0], c.belly, SURF.leather);
    limb(rb, 'neck' + i, [0, 0.2, 0.1], [0, 0.42, 0.0], 0.06, 0.008, c.horn, SURF.bone);
  }
  // Tête : crâne, museau, arcades, cornes, mâchoire
  ell(rb, 'head', [0, 0.02, 0.15], [0.23, 0.18, 0.28], null, m, SURF.scales);
  limb(rb, 'head', [0, -0.01, 0.25], [0, -0.04, 0.8], 0.17, 0.1, m, SURF.scales);
  for (const s of [-1, 1]) {
    ell(rb, 'head', [s * 0.13, 0.14, 0.38], [0.08, 0.05, 0.15], [0.2, s * 0.15, 0], m, SURF.scales);
    rb.add('head', xf(G.sphere(0.045, 8, 6), [s * 0.16, 0.1, 0.43]), c.eyes, SURF.glow);
    ellC(rb, 'head', [s * 0.16, 0.1, 0.43], [0.06, 0.035, 0.05], null, 0x050505, SURF.cloth);
    ellC(rb, 'head', [s * 0.05, 0.02, 0.84], [0.02, 0.02, 0.03], null, 0x050505, SURF.cloth);
    hornHD(rb, 'head', [s * 0.13, 0.15, 0.08], [s * 0.3, 0.5, -1], 0.75, 0.075, c.horn, 0.7, SURF.bone);
    hornHD(rb, 'head', [s * 0.2, 0.0, 0.1], [s * 0.8, 0.1, -0.6], 0.32, 0.04, c.horn, 0.4, SURF.bone);
    for (let i = 0; i < 6; i++) rb.add('head', xf(G.cone(0.02, 0.08, 5), [s * 0.1, -0.12, 0.35 + i * 0.08], [PI, 0, 0]), 0xf0f0e0, SURF.bone);
  }
  limb(rb, 'jaw', [0, -0.04, 0.05], [0, -0.08, 0.68], 0.13, 0.07, c.belly, SURF.leather);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) rb.add('jaw', xf(G.cone(0.02, 0.08, 5), [s * 0.09, 0.0, 0.22 + i * 0.08]), 0xf0f0e0, SURF.bone);
  // Pattes
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    ell(rb, 'leg' + n, [0, -0.1, 0], [0.2, 0.3, 0.24], null, m, SURF.scales);
    limb(rb, 'leg' + n, [0, 0, 0], [0, -0.62, 0.1], 0.17, 0.12, m, SURF.scales);
    limb(rb, 'leg' + n + '2', [0, 0, 0], [0, -0.56, 0.06], 0.12, 0.09, m, SURF.scales);
    ell(rb, 'leg' + n + '2', [0, -0.6, 0.1], [0.14, 0.06, 0.18], null, m, SURF.scales);
    for (let i = 0; i < 3; i++) rb.add('leg' + n + '2', xf(G.cone(0.03, 0.14, 5), [(i - 1) * 0.08, -0.62, 0.3], [PI / 2 + 0.3, 0, 0]), c.horn, SURF.bone);
  }
  // Ailes : os arrondis + membranes
  for (const s of [1, -1]) {
    const w = s > 0 ? 'wingL' : 'wingR';
    limb(rb, w, [0, 0, 0], [s * 1.6, 0.2, 0], 0.08, 0.05, m, SURF.leather);
    rb.add(w, xf(G.box(1.6, 0.03, 1.4), [s * 0.8, 0, -0.7]), c.wing, SURF.leather);
    for (let k = 0; k < 3; k++) limb(rb, w + '2', [0, 0, 0], [s * (1.6 - k * 0.4), -0.05, -0.4 - k * 0.55], 0.045, 0.012, m, SURF.leather);
    rb.add(w + '2', xf(G.box(1.8, 0.025, 1.6), [s * 0.9, 0, -0.8], [0, s * 0.3, 0]), c.wing, SURF.leather);
    rb.add(w + '2', xf(G.cone(0.05, 0.3, 5), [s * 1.8, 0, 0.1], [0, 0, s * -PI / 2]), c.horn, SURF.bone);
  }
  // Queue
  for (let i = 0; i < 6; i++) {
    const r = 0.36 * (1 - i / 6.5);
    const r2 = 0.36 * (1 - (i + 1) / 6.5);
    limb(rb, 'tail' + i, [0, 0, 0], [0, 0, -0.56], r, r2, m, SURF.scales);
    limb(rb, 'tail' + i, [0, r * 0.8, -0.2], [0, r * 0.8 + 0.2, -0.32], 0.05, 0.006, c.horn, SURF.bone);
  }
  rb.add('tail5', xf(G.octa(0.2), [0, 0, -0.65], [0, 0, 0], [0.4, 1, 1.4]), c.glow, SURF.glow);
}
