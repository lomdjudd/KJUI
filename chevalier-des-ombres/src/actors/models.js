// Modèles procéduraux : chevalier (tenues), humanoïdes (squelettes, goules, liches,
// chevaliers corrompus…), bêtes, araignées, chauves-souris, slimes, serpents, feux follets,
// yeux du néant, horreurs tentaculaires, mimics, dragon ; armes et boucliers.
import * as THREE from 'three';
import { RigBuilder, PropBuilder, G, xf, SURF } from './rig.js';

const PI = Math.PI;

// Corne incurvée faite de segments coniques
function horn(rb, bone, base, dir, len, r, color, curl = 0.8, segs = 4, surf = SURF.bone) {
  let p = new THREE.Vector3(...base);
  let ang = 0;
  const sideSign = Math.sign(dir[0]) || 1;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const segLen = len / segs;
    const rr = r * (1 - t * 0.8);
    const rr2 = r * (1 - (t + 1 / segs) * 0.8);
    // direction : part vers l'extérieur puis remonte (courbure)
    const a = ang;
    const dx = dir[0] * Math.cos(a) * 0.9;
    const dy = Math.sin(a) * 1 + dir[1];
    const dz = dir[2];
    const d = new THREE.Vector3(dx, dy, dz).normalize();
    const mid = p.clone().addScaledVector(d, segLen / 2);
    const g = G.cyl(Math.max(0.004, rr2), rr, segLen * 1.1, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const e = new THREE.Euler().setFromQuaternion(q);
    rb.add(bone, xf(g, mid.toArray(), [e.x, e.y, e.z]), color, surf);
    p = p.addScaledVector(d, segLen);
    ang += curl / segs * 1.6 * sideSign * sideSign;
  }
}

// ======================= HUMANOÏDES =======================
// spec : { torso, head, arms, legs, extras[], c:{main,trim,cloth,skin,eyes,cape,dark,glow}, bulk, thick, armLen, legLen, hunch }
export function buildHumanoid(spec, material) {
  const B = spec.bulk || 1;
  const T = (spec.thick || 1) * B;
  const A = spec.armLen || 1;
  const L = spec.legLen || 1;
  const c = Object.assign(
    { main: 0x5a5a66, trim: 0x8a7a50, cloth: 0x3a1a4a, skin: 0x9a8a78, eyes: null, cape: 0x2a0a38, dark: 0x0a0a0e, glow: 0x7a3cff, leather: 0x3a2a1c, bone: 0xd8cfb0 },
    spec.c || {},
  );
  const rb = new RigBuilder();
  const ankleY = 0.08;
  const kneeY = ankleY + 0.44 * L;
  const thighY = kneeY + 0.44 * L;
  const hipsY = thighY + 0.05;
  rb.bone('hips', 'root', 0, hipsY, 0);
  rb.bone('spine', 'hips', 0, 0.1, 0);
  rb.bone('chest', 'spine', 0, 0.22, 0);
  rb.bone('neck', 'chest', 0, 0.25, 0);
  rb.bone('head', 'neck', 0, 0.08, 0);
  const sx = 0.2 * B + 0.02;
  rb.bone('armL', 'chest', sx, 0.2, 0);
  rb.bone('foreL', 'armL', 0, -0.29 * A, 0);
  rb.bone('handL', 'foreL', 0, -0.27 * A, 0);
  rb.bone('armR', 'chest', -sx, 0.2, 0);
  rb.bone('foreR', 'armR', 0, -0.29 * A, 0);
  rb.bone('handR', 'foreR', 0, -0.27 * A, 0);
  rb.bone('thighL', 'hips', 0.11 * B, -0.05, 0);
  rb.bone('shinL', 'thighL', 0, -0.44 * L, 0);
  rb.bone('footL', 'shinL', 0, -0.44 * L + 0.0, 0);
  rb.bone('thighR', 'hips', -0.11 * B, -0.05, 0);
  rb.bone('shinR', 'thighR', 0, -0.44 * L, 0);
  rb.bone('footR', 'shinR', 0, -0.44 * L + 0.0, 0);
  const ex = new Set(spec.extras || []);
  if (ex.has('cape')) {
    rb.bone('cape1', 'chest', 0, 0.2, -0.15 * B);
    rb.bone('cape2', 'cape1', 0, -0.38, 0);
    rb.bone('cape3', 'cape2', 0, -0.38, 0);
  }
  if (ex.has('wings') || ex.has('batwings') || ex.has('stoneWings') || ex.has('angelWings')) {
    rb.bone('wingL', 'chest', 0.1, 0.14, -0.16 * B);
    rb.bone('wingL2', 'wingL', 0.55, 0.1, 0);
    rb.bone('wingR', 'chest', -0.1, 0.14, -0.16 * B);
    rb.bone('wingR2', 'wingR', -0.55, 0.1, 0);
  }
  if (ex.has('tail')) {
    rb.bone('tail1', 'hips', 0, -0.02, -0.14);
    rb.bone('tail2', 'tail1', 0, 0, -0.35);
    rb.bone('tail3', 'tail2', 0, 0, -0.32);
  }

  torsoParts(rb, spec.torso || 'armor', c, B, T);
  headParts(rb, spec.head || 'helm_great', c, B);
  armParts(rb, spec.arms || 'armor', c, T, A, 'L');
  armParts(rb, spec.arms || 'armor', c, T, A, 'R');
  legParts(rb, spec.legs || 'armor', c, T, L, 'L', B);
  legParts(rb, spec.legs || 'armor', c, T, L, 'R', B);
  extraParts(rb, ex, c, B, spec);

  const built = rb.build(material, { castShadow: spec.castShadow !== false });
  built.height = hipsY + 0.95;
  built.rig = 'humanoid';
  return built;
}

function torsoParts(rb, type, c, B, T) {
  switch (type) {
    case 'armor':
    case 'plate': {
      rb.add('chest', xf(G.cyl(0.2 * B, 0.16 * B, 0.36, 10), [0, 0.1, 0.01], [0, 0, 0], [1, 1, 0.72]), c.main, SURF.metal);
      rb.add('chest', xf(G.box(0.05, 0.3, 0.05), [0, 0.1, 0.145 * B], [0.1, 0, PI / 4], [1, 1, 0.6]), c.trim, SURF.gold);
      rb.add('chest', xf(G.cyl(0.11, 0.14, 0.1, 10), [0, 0.3, 0], [0, 0, 0], [1, 1, 0.85]), c.main, SURF.metal);
      rb.add('spine', xf(G.cyl(0.15 * B, 0.165 * B, 0.2, 10), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.75]), c.dark === 0x0a0a0e ? 0x2a2a30 : c.dark, SURF.leather);
      rb.add('spine', xf(G.cyl(0.155 * B, 0.155 * B, 0.05, 10), [0, 0.07, 0], [0, 0, 0], [1, 1, 0.78]), c.main, SURF.metal);
      rb.add('hips', xf(G.torus(0.165 * B, 0.028, 6, 14), [0, 0.02, 0], [PI / 2, 0, 0], [1, 0.76, 1]), c.leather, SURF.leather);
      rb.add('hips', xf(G.box(0.07, 0.06, 0.03), [0, 0.02, 0.13 * B]), c.trim, SURF.gold);
      // Tassettes
      rb.add('hips', xf(G.box(0.2 * B, 0.2, 0.03), [0, -0.1, 0.12 * B], [0.15, 0, 0]), c.main, SURF.metal);
      rb.add('hips', xf(G.box(0.2 * B, 0.2, 0.03), [0, -0.1, -0.12 * B], [-0.15, 0, 0]), c.main, SURF.metal);
      rb.add('hips', xf(G.box(0.03, 0.18, 0.16), [0.16 * B, -0.08, 0], [0, 0, 0.2]), c.main, SURF.metal);
      rb.add('hips', xf(G.box(0.03, 0.18, 0.16), [-0.16 * B, -0.08, 0], [0, 0, -0.2]), c.main, SURF.metal);
      break;
    }
    case 'tabard': {
      rb.add('chest', xf(G.cyl(0.2 * B, 0.16 * B, 0.36, 10), [0, 0.1, 0.01], [0, 0, 0], [1, 1, 0.72]), c.main, SURF.metal);
      rb.add('chest', xf(G.box(0.26 * B, 0.34, 0.02), [0, 0.07, 0.15 * B]), c.cloth, SURF.cloth);
      rb.add('chest', xf(G.box(0.08, 0.14, 0.021), [0, 0.1, 0.155 * B]), c.trim, SURF.gold);
      rb.add('chest', xf(G.cyl(0.11, 0.14, 0.1, 10), [0, 0.3, 0]), c.main, SURF.metal);
      rb.add('spine', xf(G.cyl(0.15 * B, 0.165 * B, 0.2, 10), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.75]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.torus(0.165 * B, 0.028, 6, 14), [0, 0.02, 0], [PI / 2, 0, 0], [1, 0.76, 1]), c.leather, SURF.leather);
      rb.add('hips', xf(G.box(0.24 * B, 0.42, 0.02), [0, -0.2, 0.13 * B], [0.06, 0, 0]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.box(0.24 * B, 0.42, 0.02), [0, -0.2, -0.13 * B], [-0.06, 0, 0]), c.cloth, SURF.cloth);
      break;
    }
    case 'robe': {
      rb.add('chest', xf(G.cyl(0.19 * B, 0.16 * B, 0.38, 10), [0, 0.1, 0], [0, 0, 0], [1, 1, 0.75]), c.cloth, SURF.cloth);
      rb.add('chest', xf(G.cyl(0.12, 0.17, 0.12, 10), [0, 0.3, -0.01]), c.cloth, SURF.cloth);
      rb.add('spine', xf(G.cyl(0.16 * B, 0.18 * B, 0.22, 10), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.8]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.torus(0.175 * B, 0.025, 6, 14), [0, 0.04, 0], [PI / 2, 0, 0], [1, 0.8, 1]), c.trim, SURF.gold);
      rb.add('hips', xf(G.cyl(0.18 * B, 0.36 * B, 0.92, 12, true), [0, -0.42, 0], [0, 0, 0], [1, 1, 0.85]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.box(0.1, 0.8, 0.02), [0, -0.38, 0.19 * B], [0.2, 0, 0]), c.trim, SURF.cloth);
      break;
    }
    case 'tattered': {
      // Robe en lambeaux (fantômes, banshees, liches)
      rb.add('chest', xf(G.cyl(0.18 * B, 0.15 * B, 0.38, 8), [0, 0.1, 0], [0, 0, 0], [1, 1, 0.75]), c.cloth, SURF.cloth);
      rb.add('spine', xf(G.cyl(0.15 * B, 0.2 * B, 0.24, 8), [0, 0.02, 0]), c.cloth, SURF.cloth);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        const len = 0.8 + (i % 3) * 0.2;
        rb.add('hips', xf(G.box(0.14 * B, len, 0.02), [Math.sin(a) * 0.22 * B, -len / 2 + 0.05, Math.cos(a) * 0.2 * B], [Math.cos(a) * 0.15, a, -Math.sin(a) * 0.15]), c.cloth, SURF.cloth);
      }
      break;
    }
    case 'bones': {
      rb.add('spine', xf(G.cyl(0.03, 0.03, 0.34, 6), [0, 0.1, -0.05]), c.bone, SURF.bone);
      for (let i = 0; i < 4; i++) {
        const w = (0.15 - i * 0.012) * B;
        rb.add('chest', xf(G.torus(w, 0.016, 4, 10, PI * 1.5), [0, 0.2 - i * 0.07, 0.0], [PI / 2, 0, PI * 0.75 + PI], [1, 0.75, 1]), c.bone, SURF.bone);
      }
      rb.add('chest', xf(G.box(0.03, 0.22, 0.03), [0, 0.12, 0.1 * B]), c.bone, SURF.bone);
      rb.add('chest', xf(G.box(0.36 * B, 0.03, 0.05), [0, 0.28, -0.02]), c.bone, SURF.bone);
      rb.add('hips', xf(G.torus(0.1 * B, 0.03, 4, 10), [0, 0, 0], [PI / 2, 0, 0], [1.2, 0.8, 1]), c.bone, SURF.bone);
      break;
    }
    case 'flesh': {
      rb.add('chest', xf(G.cyl(0.18 * B, 0.15 * B, 0.36, 8), [0, 0.1, 0], [0, 0, 0], [1, 1, 0.75]), c.skin, SURF.skin);
      rb.add('spine', xf(G.cyl(0.14 * B, 0.16 * B, 0.22, 8), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.8]), c.skin, SURF.skin);
      rb.add('chest', xf(G.box(0.3 * B, 0.2, 0.02), [0.02, 0.0, 0.13 * B], [0.1, 0, 0.25]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.cyl(0.17 * B, 0.2 * B, 0.2, 8), [0, -0.05, 0], [0, 0, 0], [1, 1, 0.8]), c.cloth, SURF.cloth);
      // Côtes apparentes
      for (let i = 0; i < 3; i++) rb.add('chest', xf(G.box(0.18 * B, 0.015, 0.02), [0, 0.12 - i * 0.05, 0.135 * B], [0, 0, 0]), c.bone, SURF.bone);
      break;
    }
    case 'fur': {
      rb.add('chest', xf(G.cyl(0.26 * B, 0.18 * B, 0.42, 8), [0, 0.12, 0], [0, 0, 0], [1, 1, 0.8]), c.skin, SURF.leather);
      rb.add('spine', xf(G.cyl(0.17 * B, 0.2 * B, 0.24, 8), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.85]), c.skin, SURF.leather);
      for (let i = 0; i < 6; i++) rb.add('chest', xf(G.cone(0.05, 0.16, 5), [((i % 3) - 1) * 0.1, 0.3 - Math.floor(i / 3) * 0.12, -0.16 * B], [-2.2, 0, 0]), c.dark, SURF.leather);
      rb.add('hips', xf(G.cyl(0.19 * B, 0.22 * B, 0.18, 8), [0, -0.05, 0]), c.cloth, SURF.cloth);
      break;
    }
    case 'leather': {
      rb.add('chest', xf(G.cyl(0.18 * B, 0.15 * B, 0.36, 8), [0, 0.1, 0], [0, 0, 0], [1, 1, 0.75]), c.leather, SURF.leather);
      rb.add('chest', xf(G.box(0.04, 0.45, 0.02), [0, 0.1, 0.14 * B], [0, 0, 0.7]), c.dark, SURF.leather);
      rb.add('chest', xf(G.cyl(0.11, 0.14, 0.1, 8), [0, 0.3, 0]), c.cloth, SURF.cloth);
      rb.add('spine', xf(G.cyl(0.14 * B, 0.16 * B, 0.22, 8), [0, 0.02, 0], [0, 0, 0], [1, 1, 0.8]), c.cloth, SURF.cloth);
      rb.add('hips', xf(G.torus(0.16 * B, 0.025, 6, 14), [0, 0.02, 0], [PI / 2, 0, 0], [1, 0.78, 1]), c.dark, SURF.leather);
      rb.add('hips', xf(G.box(0.2 * B, 0.3, 0.02), [0, -0.15, 0.12 * B], [0.1, 0, 0]), c.cloth, SURF.cloth);
      break;
    }
    case 'stone': {
      rb.add('chest', xf(G.dodeca(0.26 * B), [0, 0.12, 0], [0.3, 0.5, 0], [1.1, 0.9, 0.8]), c.main, SURF.stone);
      rb.add('chest', xf(G.dodeca(0.13 * B), [0.18 * B, 0.28, 0], [0.5, 0.1, 0]), c.main, SURF.stone);
      rb.add('chest', xf(G.dodeca(0.13 * B), [-0.18 * B, 0.28, 0], [0.2, 0.8, 0]), c.main, SURF.stone);
      rb.add('spine', xf(G.dodeca(0.17 * B), [0, 0.02, 0], [0.4, 0.2, 0.1]), c.main, SURF.stone);
      rb.add('hips', xf(G.dodeca(0.17 * B), [0, -0.04, 0], [0.1, 0.5, 0.3], [1.2, 0.8, 1]), c.main, SURF.stone);
      // Veines lumineuses
      rb.add('chest', xf(G.box(0.03, 0.3, 0.03), [0, 0.12, 0.21 * B], [0, 0, 0.3]), c.glow, SURF.glow);
      rb.add('chest', xf(G.box(0.2, 0.03, 0.03), [0.02, 0.18, 0.2 * B]), c.glow, SURF.glow);
      break;
    }
    case 'crystal': {
      rb.add('chest', xf(G.octa(0.26 * B), [0, 0.12, 0], [0, 0.4, 0], [1, 1.3, 0.8]), c.main, SURF.crystal);
      rb.add('chest', xf(G.octa(0.1), [0.2 * B, 0.3, -0.05], [0.4, 0, 0.5], [1, 2, 1]), c.glow, SURF.glow);
      rb.add('chest', xf(G.octa(0.1), [-0.2 * B, 0.3, -0.05], [0.4, 0, -0.5], [1, 2, 1]), c.glow, SURF.glow);
      rb.add('spine', xf(G.octa(0.16 * B), [0, 0, 0], [0, 0.2, 0], [1, 1.2, 0.8]), c.main, SURF.crystal);
      rb.add('chest', xf(G.sphere(0.08, 8, 6), [0, 0.12, 0.12]), c.glow, SURF.glow);
      break;
    }
    case 'bark': {
      rb.add('chest', xf(G.cyl(0.24 * B, 0.2 * B, 0.44, 7), [0, 0.12, 0], [0, 0, 0], [1, 1, 0.8]), c.main, SURF.wood);
      rb.add('spine', xf(G.cyl(0.2 * B, 0.22 * B, 0.26, 7), [0, 0.02, 0]), c.main, SURF.wood);
      rb.add('hips', xf(G.cyl(0.22 * B, 0.26 * B, 0.2, 7), [0, -0.04, 0]), c.main, SURF.wood);
      for (let i = 0; i < 5; i++) rb.add('chest', xf(G.sphere(0.07, 6, 4), [(i - 2) * 0.09, 0.05 + (i % 2) * 0.15, 0.17 * B]), c.glow, SURF.glowSoft);
      break;
    }
    case 'magma': {
      rb.add('chest', xf(G.dodeca(0.27 * B), [0, 0.12, 0], [0.3, 0.2, 0], [1.1, 0.95, 0.85]), c.main, SURF.stone);
      rb.add('chest', xf(G.sphere(0.2 * B, 8, 6), [0, 0.12, 0.02]), c.glow, SURF.glow);
      rb.add('spine', xf(G.dodeca(0.18 * B), [0, 0.02, 0]), c.main, SURF.stone);
      rb.add('hips', xf(G.dodeca(0.18 * B), [0, -0.04, 0], [0.2, 0.3, 0], [1.2, 0.8, 1]), c.main, SURF.stone);
      break;
    }
    default:
      break;
  }
}

function eyes(rb, bone, y, z, sep, color, size = 0.022, shape = 'box') {
  if (!color) return;
  for (const s of [-1, 1]) {
    const g = shape === 'box' ? G.box(size * 1.8, size * 0.8, 0.02) : G.sphere(size, 6, 4);
    rb.add(bone, xf(g, [s * sep, y, z]), color, SURF.glow);
  }
}

function headParts(rb, type, c, B) {
  const H = 'head';
  switch (type) {
    case 'helm_great':
    case 'helm_plume':
    case 'helm_crown': {
      rb.add(H, xf(G.cyl(0.125, 0.13, 0.25, 12), [0, 0.12, 0]), c.main, SURF.metal);
      rb.add(H, xf(G.hemi(0.125, 12, 5), [0, 0.245, 0]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.2, 0.022, 0.02), [0, 0.15, 0.123]), c.dark, SURF.cloth);
      rb.add(H, xf(G.box(0.022, 0.12, 0.02), [0, 0.07, 0.126]), c.trim, SURF.gold);
      for (let i = 0; i < 5; i++) rb.add(H, xf(G.box(0.012, 0.012, 0.02), [((i % 3) - 1) * 0.04 + 0.05 * Math.sign(i - 2), 0.06 + Math.floor(i / 3) * 0.03, 0.127]), c.dark, SURF.cloth);
      eyes(rb, H, 0.15, 0.13, 0.045, c.eyes, 0.018);
      if (type === 'helm_plume') {
        for (let i = 0; i < 6; i++) rb.add(H, xf(G.box(0.03, 0.1 - i * 0.008, 0.07), [0, 0.35 - i * 0.01, 0.08 - i * 0.055], [-0.3 - i * 0.12, 0, 0]), c.cloth, SURF.cloth);
      }
      if (type === 'helm_crown') {
        rb.add(H, xf(G.torus(0.13, 0.018, 5, 14), [0, 0.25, 0], [PI / 2, 0, 0]), c.trim, SURF.gold);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * PI * 2;
          rb.add(H, xf(G.cone(0.022, 0.09, 4), [Math.sin(a) * 0.13, 0.3, Math.cos(a) * 0.13]), c.trim, SURF.gold);
        }
        rb.add(H, xf(G.octa(0.02), [0, 0.28, 0.14]), c.glow, SURF.glow);
      }
      break;
    }
    case 'helm_horned': {
      // Heaume cornu (cf. chevalier violet de référence)
      rb.add(H, xf(G.sphere(0.14, 12, 8), [0, 0.13, 0], [0, 0, 0], [1, 1.12, 1.05]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.2, 0.14, 0.06), [0, 0.08, 0.1], [0.15, 0, 0]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.03, 0.2, 0.03), [0, 0.18, 0.145], [0.25, 0, PI / 4], [1, 1, 0.5]), c.trim, SURF.metal);
      rb.add(H, xf(G.box(0.19, 0.035, 0.03), [0, 0.13, 0.138]), c.dark, SURF.cloth);
      rb.add(H, xf(G.octa(0.022), [0, 0.2, 0.15]), c.glow, SURF.glow);
      eyes(rb, H, 0.13, 0.152, 0.045, c.eyes || 0xff2020, 0.02, 'sphere');
      horn(rb, H, [0.1, 0.24, 0], [1, 0.25, 0], 0.5, 0.045, c.main, 1.4, 5, SURF.metal);
      horn(rb, H, [-0.1, 0.24, 0], [-1, 0.25, 0], 0.5, 0.045, c.main, 1.4, 5, SURF.metal);
      break;
    }
    case 'helm_winged': {
      rb.add(H, xf(G.sphere(0.135, 12, 8), [0, 0.13, 0], [0, 0, 0], [1, 1.1, 1.05]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.2, 0.03, 0.02), [0, 0.13, 0.135]), c.dark, SURF.cloth);
      rb.add(H, xf(G.box(0.03, 0.12, 0.03), [0, 0.07, 0.14]), c.main, SURF.metal);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rb.add(H, xf(G.box(0.02, 0.05, 0.18 - i * 0.04), [s * 0.14, 0.2 + i * 0.05, -0.04 - i * 0.02], [0.5 + i * 0.1, 0, s * -0.3]), c.trim, SURF.gold);
      eyes(rb, H, 0.13, 0.14, 0.045, c.eyes, 0.018);
      break;
    }
    case 'helm_bascinet': {
      rb.add(H, xf(G.sphere(0.13, 12, 8), [0, 0.14, -0.01], [0, 0, 0], [1, 1.2, 1.05]), c.main, SURF.metal);
      rb.add(H, xf(G.cone(0.1, 0.2, 8), [0, 0.11, 0.14], [PI / 2, 0, 0], [1, 1, 1]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.16, 0.015, 0.1), [0, 0.15, 0.16]), c.dark, SURF.cloth);
      rb.add(H, xf(G.cyl(0.14, 0.16, 0.08, 10), [0, 0.0, 0]), c.dark, SURF.cloth);
      eyes(rb, H, 0.15, 0.2, 0.04, c.eyes, 0.016);
      break;
    }
    case 'helm_open': {
      rb.add(H, xf(G.sphere(0.12, 10, 8), [0, 0.12, 0.01], [0, 0, 0], [1, 1.1, 1.1]), c.skin, SURF.skin);
      rb.add(H, xf(G.hemi(0.135, 12, 5), [0, 0.15, 0]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.02, 0.1, 0.03), [0, 0.13, 0.13]), c.main, SURF.metal);
      rb.add(H, xf(G.box(0.1, 0.02, 0.02), [0, 0.06, 0.12]), 0x3a2418, SURF.cloth);
      eyes(rb, H, 0.14, 0.125, 0.04, c.eyes || 0x10101a, 0.012, 'sphere');
      break;
    }
    case 'hood':
    case 'lich':
    case 'plague':
    case 'hag': {
      rb.add(H, xf(G.sphere(0.16, 10, 8), [0, 0.12, -0.02], [0, 0, 0], [1, 1.15, 1.15]), c.cloth, SURF.cloth);
      rb.add(H, xf(G.cone(0.1, 0.18, 8), [0, 0.28, -0.08], [-0.6, 0, 0]), c.cloth, SURF.cloth);
      rb.add(H, xf(G.cyl(0.18, 0.21, 0.12, 10, true), [0, -0.02, 0]), c.cloth, SURF.cloth);
      if (type === 'lich') {
        // Visage bleu-gris décharné aux yeux rouges (cf. image de référence)
        rb.add(H, xf(G.sphere(0.1, 10, 8), [0, 0.1, 0.07], [0, 0, 0], [0.95, 1.2, 0.8]), c.skin, SURF.skin);
        rb.add(H, xf(G.box(0.07, 0.02, 0.02), [0, 0.03, 0.14]), 0x101018, SURF.cloth);
        rb.add(H, xf(G.box(0.02, 0.05, 0.03), [0, 0.09, 0.15]), c.skin, SURF.skin);
        eyes(rb, H, 0.13, 0.14, 0.038, c.eyes || 0xff1a1a, 0.02, 'sphere');
      } else if (type === 'plague') {
        rb.add(H, xf(G.sphere(0.1, 8, 6), [0, 0.1, 0.07]), 0x2a2420, SURF.leather);
        rb.add(H, xf(G.cone(0.05, 0.24, 6), [0, 0.07, 0.24], [PI / 2 + 0.3, 0, 0]), 0x3a3028, SURF.leather);
        eyes(rb, H, 0.13, 0.15, 0.045, c.eyes || 0xffd24d, 0.02, 'sphere');
      } else if (type === 'hag') {
        rb.add(H, xf(G.sphere(0.1, 8, 6), [0, 0.1, 0.07], [0, 0, 0], [0.9, 1.15, 0.85]), c.skin, SURF.skin);
        rb.add(H, xf(G.cone(0.025, 0.12, 5), [0, 0.09, 0.19], [PI / 2 + 0.4, 0, 0]), c.skin, SURF.skin);
        eyes(rb, H, 0.14, 0.15, 0.035, c.eyes || 0xc8ff3a, 0.016, 'sphere');
      } else {
        rb.add(H, xf(G.sphere(0.1, 8, 6), [0, 0.1, 0.06]), 0x050508, SURF.cloth);
        eyes(rb, H, 0.13, 0.15, 0.04, c.eyes || 0xff3030, 0.018, 'sphere');
      }
      break;
    }
    case 'skull': {
      rb.add(H, xf(G.sphere(0.115, 10, 8), [0, 0.14, 0], [0, 0, 0], [0.95, 1, 1.1]), c.bone, SURF.bone);
      rb.add(H, xf(G.box(0.12, 0.06, 0.1), [0, 0.04, 0.04]), c.bone, SURF.bone);
      rb.add(H, xf(G.sphere(0.03, 6, 4), [0.045, 0.13, 0.1]), 0x050505, SURF.cloth);
      rb.add(H, xf(G.sphere(0.03, 6, 4), [-0.045, 0.13, 0.1]), 0x050505, SURF.cloth);
      eyes(rb, H, 0.13, 0.115, 0.045, c.eyes || 0x39ff9a, 0.013, 'sphere');
      rb.add(H, xf(G.box(0.02, 0.03, 0.02), [0, 0.085, 0.12]), 0x080808, SURF.cloth);
      if (c.helmet) rb.add(H, xf(G.hemi(0.13, 10, 5), [0, 0.16, 0]), c.helmet, SURF.darkMetal);
      break;
    }
    case 'zombie':
    case 'ghoul': {
      const g = type === 'ghoul';
      rb.add(H, xf(G.sphere(0.11, 10, 8), [0, 0.12, g ? 0.03 : 0], [0, 0, 0], g ? [0.85, 1, 1.35] : [1, 1.05, 1.05]), c.skin, SURF.skin);
      rb.add(H, xf(G.box(0.11, 0.05, 0.08), [0, 0.03, g ? 0.1 : 0.05], [0.3, 0, 0]), c.skin, SURF.skin);
      rb.add(H, xf(G.box(0.08, 0.02, 0.02), [0, 0.04, g ? 0.155 : 0.1]), 0x200808, SURF.cloth);
      eyes(rb, H, 0.14, g ? 0.14 : 0.1, 0.04, c.eyes || 0xffe050, 0.014, 'sphere');
      if (g) for (const s of [-1, 1]) rb.add(H, xf(G.cone(0.025, 0.12, 4), [s * 0.1, 0.18, 0], [0, 0, -s * 1.1]), c.skin, SURF.skin);
      break;
    }
    case 'demon': {
      rb.add(H, xf(G.sphere(0.12, 10, 8), [0, 0.12, 0.02], [0, 0, 0], [1, 1.05, 1.1]), c.skin, SURF.skin);
      rb.add(H, xf(G.box(0.12, 0.06, 0.08), [0, 0.03, 0.08]), c.skin, SURF.skin);
      eyes(rb, H, 0.14, 0.13, 0.042, c.eyes || 0xffb020, 0.018);
      horn(rb, H, [0.08, 0.2, 0], [0.6, 0.6, -0.4], 0.35, 0.04, c.dark, 1.2, 4);
      horn(rb, H, [-0.08, 0.2, 0], [-0.6, 0.6, -0.4], 0.35, 0.04, c.dark, 1.2, 4);
      break;
    }
    case 'wolf': {
      rb.add(H, xf(G.sphere(0.13, 10, 8), [0, 0.12, 0], [0, 0, 0], [1, 1, 1.05]), c.skin, SURF.leather);
      rb.add(H, xf(G.box(0.1, 0.09, 0.2), [0, 0.07, 0.15], [0.15, 0, 0]), c.skin, SURF.leather);
      rb.add(H, xf(G.box(0.09, 0.03, 0.18), [0, 0.02, 0.14]), c.dark, SURF.leather);
      for (const s of [-1, 1]) rb.add(H, xf(G.cone(0.04, 0.12, 4), [s * 0.08, 0.25, -0.02], [-0.2, 0, -s * 0.3]), c.skin, SURF.leather);
      eyes(rb, H, 0.15, 0.12, 0.05, c.eyes || 0xffcc22, 0.016, 'sphere');
      rb.add(H, xf(G.sphere(0.02, 5, 4), [0, 0.1, 0.26]), 0x050505, SURF.wet);
      break;
    }
    case 'sack': {
      rb.add(H, xf(G.sphere(0.13, 8, 6), [0, 0.12, 0], [0, 0, 0], [1, 1.1, 1]), 0x8a7048, SURF.cloth);
      rb.add(H, xf(G.box(0.1, 0.012, 0.02), [0, 0.05, 0.13]), 0x201008, SURF.cloth);
      for (let i = 0; i < 5; i++) rb.add(H, xf(G.box(0.006, 0.03, 0.02), [-0.04 + i * 0.02, 0.05, 0.132]), 0x201008, SURF.cloth);
      eyes(rb, H, 0.15, 0.125, 0.045, c.eyes || 0xff8a1a, 0.022, 'sphere');
      rb.add(H, xf(G.cyl(0.26, 0.26, 0.015, 12), [0, 0.25, 0]), 0x3a2a14, SURF.cloth);
      rb.add(H, xf(G.cone(0.13, 0.22, 10), [0, 0.36, 0], [0.1, 0, 0.1]), 0x3a2a14, SURF.cloth);
      break;
    }
    case 'mushroom': {
      rb.add(H, xf(G.sphere(0.1, 8, 6), [0, 0.08, 0]), c.skin, SURF.skin);
      rb.add(H, xf(G.hemi(0.26, 12, 5), [0, 0.14, 0], [0, 0, 0], [1, 0.7, 1]), c.cloth, SURF.cloth);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2;
        rb.add(H, xf(G.sphere(0.03, 5, 4), [Math.sin(a) * 0.17, 0.25, Math.cos(a) * 0.17]), c.glow, SURF.glow);
      }
      eyes(rb, H, 0.09, 0.09, 0.035, c.eyes || 0xfff080, 0.016, 'sphere');
      break;
    }
    case 'faceless': {
      rb.add(H, xf(G.sphere(0.12, 12, 10), [0, 0.13, 0], [0, 0, 0], [0.95, 1.2, 1]), c.skin, SURF.wet);
      rb.add(H, xf(G.torus(0.16, 0.012, 4, 20), [0, 0.3, -0.05], [PI / 2 - 0.3, 0, 0]), c.glow, SURF.glow);
      break;
    }
    case 'elemental': {
      rb.add(H, xf(G.octa(0.14), [0, 0.14, 0], [0, 0.5, 0], [1, 1.3, 1]), c.main, SURF.crystal);
      eyes(rb, H, 0.14, 0.1, 0.04, c.eyes || 0xffffff, 0.02, 'sphere');
      break;
    }
    case 'stone': {
      rb.add(H, xf(G.dodeca(0.13), [0, 0.12, 0.02], [0.3, 0.3, 0]), c.main, SURF.stone);
      eyes(rb, H, 0.13, 0.12, 0.05, c.eyes || c.glow, 0.02);
      break;
    }
    case 'monk': {
      rb.add(H, xf(G.sphere(0.11, 10, 8), [0, 0.12, 0.01], [0, 0, 0], [1, 1.1, 1.05]), c.skin, SURF.skin);
      rb.add(H, xf(G.cyl(0.17, 0.19, 0.1, 10, true), [0, -0.03, -0.02]), c.cloth, SURF.cloth);
      eyes(rb, H, 0.14, 0.11, 0.04, c.eyes || 0xffffff, 0.013, 'sphere');
      break;
    }
    case 'executioner': {
      rb.add(H, xf(G.cone(0.14, 0.42, 8), [0, 0.2, 0]), c.cloth, SURF.cloth);
      eyes(rb, H, 0.14, 0.1, 0.04, c.eyes || 0xff3030, 0.018, 'sphere');
      break;
    }
    case 'none': {
      rb.add('neck', xf(G.cyl(0.06, 0.07, 0.05, 8), [0, 0.02, 0]), 0x5a0a0a, SURF.wet);
      rb.add('neck', xf(G.sphere(0.05, 6, 4), [0, 0.06, 0]), c.glow || 0xff3030, SURF.glowSoft);
      break;
    }
    case 'yeti': {
      rb.add(H, xf(G.sphere(0.16, 10, 8), [0, 0.12, 0.02], [0, 0, 0], [1.1, 1, 1]), c.skin, SURF.cloth);
      rb.add(H, xf(G.box(0.14, 0.07, 0.1), [0, 0.05, 0.12]), 0x5a6a7a, SURF.skin);
      for (const s of [-1, 1]) rb.add(H, xf(G.cone(0.025, 0.1, 4), [s * 0.05, 0.02, 0.16], [PI, 0, 0]), 0xf0f0e0, SURF.bone);
      eyes(rb, H, 0.15, 0.14, 0.05, c.eyes || 0x5ad4ff, 0.018, 'sphere');
      break;
    }
    case 'vampire': {
      rb.add(H, xf(G.sphere(0.11, 10, 8), [0, 0.12, 0.01], [0, 0, 0], [0.95, 1.15, 1]), c.skin, SURF.skin);
      rb.add(H, xf(G.hemi(0.118, 10, 4), [0, 0.15, -0.01]), 0x0a0a0c, SURF.cloth);
      rb.add(H, xf(G.cone(0.03, 0.08, 4), [0, 0.24, 0.1], [0.6, 0, 0]), 0x0a0a0c, SURF.cloth);
      eyes(rb, H, 0.14, 0.11, 0.04, c.eyes || 0xff1030, 0.015, 'sphere');
      // Grand col relevé
      rb.add('neck', xf(G.cyl(0.2, 0.12, 0.3, 10, true), [0, 0.12, -0.04], [0.25, 0, 0]), c.cape, SURF.cloth);
      break;
    }
    default:
      break;
  }
}

function armParts(rb, type, c, T, A, side) {
  const s = side === 'L' ? 1 : -1;
  const arm = 'arm' + side;
  const fore = 'fore' + side;
  const hand = 'hand' + side;
  const ua = 0.29 * A;
  const fa = 0.27 * A;
  switch (type) {
    case 'armor': {
      rb.add(arm, xf(G.hemi(0.13 * T, 10, 4), [s * 0.03, 0.03, 0], [0, 0, s * -0.35], [1.1, 0.8, 1.1]), c.main, SURF.metal);
      rb.add(arm, xf(G.torus(0.1 * T, 0.012, 4, 12), [s * 0.04, -0.04, 0], [PI / 2, s * 0.35, 0]), c.trim, SURF.gold);
      rb.add(arm, xf(G.cyl(0.055 * T, 0.05 * T, ua, 8), [0, -ua / 2, 0]), 0x2a2a30, SURF.leather);
      rb.add(fore, xf(G.sphere(0.055 * T, 8, 6), [0, 0, 0]), c.main, SURF.metal);
      rb.add(fore, xf(G.cyl(0.062 * T, 0.05 * T, fa * 0.8, 8), [0, -fa * 0.45, 0]), c.main, SURF.metal);
      rb.add(hand, xf(G.box(0.08 * T, 0.1, 0.09 * T), [0, -0.04, 0.01]), c.main, SURF.darkMetal);
      break;
    }
    case 'robe': {
      rb.add(arm, xf(G.cyl(0.06 * T, 0.07 * T, ua, 8), [0, -ua / 2, 0]), c.cloth, SURF.cloth);
      rb.add(fore, xf(G.cyl(0.07 * T, 0.11 * T, fa, 8, true), [0, -fa / 2, 0]), c.cloth, SURF.cloth);
      rb.add(hand, xf(G.box(0.06, 0.09, 0.07), [0, -0.03, 0]), c.skin, SURF.skin);
      break;
    }
    case 'bone': {
      rb.add(arm, xf(G.cyl(0.022, 0.02, ua, 5), [0, -ua / 2, 0]), c.bone, SURF.bone);
      rb.add(fore, xf(G.sphere(0.03, 5, 4), [0, 0, 0]), c.bone, SURF.bone);
      rb.add(fore, xf(G.cyl(0.02, 0.018, fa, 5), [0.012, -fa / 2, 0]), c.bone, SURF.bone);
      rb.add(fore, xf(G.cyl(0.015, 0.015, fa, 5), [-0.015, -fa / 2, 0]), c.bone, SURF.bone);
      rb.add(hand, xf(G.box(0.05, 0.08, 0.04), [0, -0.03, 0]), c.bone, SURF.bone);
      rb.add(arm, xf(G.sphere(0.045, 6, 4), [0, 0, 0]), c.bone, SURF.bone);
      break;
    }
    case 'flesh':
    case 'claws': {
      rb.add(arm, xf(G.cyl(0.05 * T, 0.045 * T, ua, 7), [0, -ua / 2, 0]), c.skin, SURF.skin);
      rb.add(fore, xf(G.cyl(0.045 * T, 0.04 * T, fa, 7), [0, -fa / 2, 0]), c.skin, SURF.skin);
      rb.add(hand, xf(G.box(0.07 * T, 0.09, 0.07 * T), [0, -0.03, 0]), c.skin, SURF.skin);
      if (type === 'claws') for (let i = 0; i < 3; i++) rb.add(hand, xf(G.cone(0.012, 0.1, 4), [(i - 1) * 0.022, -0.12, 0.02], [PI + 0.3, 0, 0]), c.bone, SURF.bone);
      break;
    }
    case 'fur': {
      rb.add(arm, xf(G.cyl(0.08 * T, 0.065 * T, ua, 7), [0, -ua / 2, 0]), c.skin, SURF.leather);
      rb.add(fore, xf(G.cyl(0.07 * T, 0.055 * T, fa, 7), [0, -fa / 2, 0]), c.skin, SURF.leather);
      rb.add(hand, xf(G.box(0.1 * T, 0.1, 0.1 * T), [0, -0.04, 0]), c.skin, SURF.leather);
      for (let i = 0; i < 3; i++) rb.add(hand, xf(G.cone(0.016, 0.14, 4), [(i - 1) * 0.03, -0.15, 0.03], [PI + 0.35, 0, 0]), c.bone, SURF.bone);
      break;
    }
    case 'leather': {
      rb.add(arm, xf(G.cyl(0.05 * T, 0.045 * T, ua, 7), [0, -ua / 2, 0]), c.cloth, SURF.cloth);
      rb.add(fore, xf(G.cyl(0.05 * T, 0.042 * T, fa, 7), [0, -fa / 2, 0]), c.leather, SURF.leather);
      rb.add(hand, xf(G.box(0.065, 0.09, 0.07), [0, -0.03, 0]), c.dark, SURF.leather);
      break;
    }
    case 'stone':
    case 'magma':
    case 'crystal':
    case 'bark': {
      const surf = type === 'crystal' ? SURF.crystal : type === 'bark' ? SURF.wood : SURF.stone;
      const shape = type === 'crystal' ? G.octa : G.dodeca;
      rb.add(arm, xf(shape(0.1 * T), [s * 0.02, -0.02, 0], [0.3, 0.2, 0.1], [1.2, 1, 1.1]), c.main, surf);
      rb.add(arm, xf(G.cyl(0.07 * T, 0.065 * T, ua, 6), [0, -ua / 2, 0]), c.main, surf);
      rb.add(fore, xf(G.cyl(0.08 * T, 0.1 * T, fa, 6), [0, -fa / 2, 0]), c.main, surf);
      rb.add(hand, xf(shape(0.1 * T), [0, -0.06, 0], [0.5, 0.3, 0]), c.main, surf);
      if (type === 'magma' || type === 'crystal') rb.add(fore, xf(G.box(0.02, fa * 0.8, 0.02), [0, -fa / 2, 0.08 * T]), c.glow, SURF.glow);
      break;
    }
    default:
      break;
  }
}

function legParts(rb, type, c, T, L, side, B) {
  const s = side === 'L' ? 1 : -1;
  const th = 'thigh' + side;
  const sh = 'shin' + side;
  const ft = 'foot' + side;
  const tl = 0.44 * L;
  const sl = 0.44 * L;
  switch (type) {
    case 'armor': {
      rb.add(th, xf(G.cyl(0.075 * T, 0.062 * T, tl, 8), [0, -tl / 2, 0]), 0x2a2a30, SURF.leather);
      rb.add(th, xf(G.cyl(0.08 * T, 0.068 * T, tl * 0.7, 8, false), [0, -tl * 0.45, 0.012], [0, 0, 0], [1, 1, 0.9]), c.main, SURF.metal);
      rb.add(sh, xf(G.sphere(0.065 * T, 8, 6), [0, 0, 0.02]), c.main, SURF.metal);
      rb.add(sh, xf(G.cyl(0.065 * T, 0.05 * T, sl * 0.9, 8), [0, -sl * 0.48, 0.005]), c.main, SURF.metal);
      rb.add(ft, xf(G.box(0.1 * T, 0.07, 0.22), [0, -0.04, 0.05]), c.main, SURF.darkMetal);
      break;
    }
    case 'robe': {
      rb.add(ft, xf(G.box(0.09, 0.06, 0.18), [0, -0.04, 0.04]), c.dark, SURF.leather);
      rb.add(th, xf(G.cyl(0.07 * T, 0.06 * T, tl, 6), [0, -tl / 2, 0]), c.cloth, SURF.cloth);
      rb.add(sh, xf(G.cyl(0.06 * T, 0.05 * T, sl, 6), [0, -sl / 2, 0]), c.cloth, SURF.cloth);
      break;
    }
    case 'bone': {
      rb.add(th, xf(G.cyl(0.024, 0.02, tl, 5), [0, -tl / 2, 0]), c.bone, SURF.bone);
      rb.add(sh, xf(G.sphere(0.035, 6, 4), [0, 0, 0]), c.bone, SURF.bone);
      rb.add(sh, xf(G.cyl(0.02, 0.018, sl, 5), [0, -sl / 2, 0]), c.bone, SURF.bone);
      rb.add(ft, xf(G.box(0.06, 0.04, 0.14), [0, -0.03, 0.04]), c.bone, SURF.bone);
      break;
    }
    case 'flesh':
    case 'fur':
    case 'leather': {
      const col = type === 'leather' ? c.leather : type === 'fur' ? c.skin : c.cloth;
      rb.add(th, xf(G.cyl(0.07 * T, 0.058 * T, tl, 7), [0, -tl / 2, 0]), col, type === 'fur' ? SURF.leather : SURF.cloth);
      rb.add(sh, xf(G.cyl(0.055 * T, 0.045 * T, sl, 7), [0, -sl / 2, 0]), type === 'flesh' ? c.skin : col, SURF.skin);
      rb.add(ft, xf(G.box(0.08 * T, 0.06, 0.18), [0, -0.035, 0.04]), type === 'fur' ? c.skin : c.dark, SURF.leather);
      if (type === 'fur') for (let i = 0; i < 3; i++) rb.add(ft, xf(G.cone(0.014, 0.07, 4), [(i - 1) * 0.025, -0.05, 0.14], [PI / 2, 0, 0]), c.bone, SURF.bone);
      break;
    }
    case 'stone':
    case 'magma':
    case 'crystal':
    case 'bark': {
      const surf = type === 'crystal' ? SURF.crystal : type === 'bark' ? SURF.wood : SURF.stone;
      rb.add(th, xf(G.cyl(0.1 * T, 0.085 * T, tl, 6), [0, -tl / 2, 0]), c.main, surf);
      rb.add(sh, xf(G.cyl(0.085 * T, 0.11 * T, sl, 6), [0, -sl / 2, 0]), c.main, surf);
      rb.add(ft, xf(G.box(0.16 * T, 0.09, 0.24), [0, -0.04, 0.04]), c.main, surf);
      break;
    }
    case 'none':
    default:
      break;
  }
}

function extraParts(rb, ex, c, B, spec) {
  if (ex.has('cape')) {
    const cc = c.cape;
    rb.add('cape1', xf(G.box(0.46 * B, 0.42, 0.02), [0, -0.19, 0]), cc, SURF.cloth);
    rb.add('cape2', xf(G.box(0.5 * B, 0.42, 0.02), [0, -0.19, 0]), cc, SURF.cloth);
    rb.add('cape3', xf(G.box(0.54 * B, 0.4, 0.02), [0, -0.18, 0]), cc, SURF.cloth);
    rb.add('cape1', xf(G.box(0.48 * B, 0.03, 0.03), [0, 0.01, 0]), c.trim, SURF.gold);
  }
  if (ex.has('wings') || ex.has('batwings') || ex.has('stoneWings') || ex.has('angelWings')) {
    const col = ex.has('angelWings') ? 0xe8e0ff : c.wing || c.dark;
    const surf = ex.has('stoneWings') ? SURF.stone : ex.has('angelWings') ? SURF.glowSoft : SURF.leather;
    for (const s of [1, -1]) {
      const w1 = s > 0 ? 'wingL' : 'wingR';
      const w2 = s > 0 ? 'wingL2' : 'wingR2';
      rb.add(w1, xf(G.cyl(0.02, 0.03, 0.6, 5), [s * 0.28, 0.05, 0], [0, 0, s * -PI / 2 + s * 0.2]), col, SURF.bone);
      rb.add(w1, xf(G.box(0.55, 0.5, 0.015), [s * 0.28, -0.2, 0]), col, surf);
      rb.add(w2, xf(G.box(0.6, 0.65, 0.015), [s * 0.3, -0.25, 0], [0, 0, s * 0.2]), col, surf);
      rb.add(w2, xf(G.cone(0.03, 0.2, 4), [s * 0.62, 0.05, 0], [0, 0, s * -0.8]), c.bone, SURF.bone);
    }
  }
  if (ex.has('tail')) {
    rb.add('tail1', xf(G.cyl(0.05, 0.04, 0.36, 6), [0, 0, -0.17], [PI / 2, 0, 0]), c.tail || c.skin, SURF.leather);
    rb.add('tail2', xf(G.cyl(0.04, 0.025, 0.34, 6), [0, 0, -0.16], [PI / 2, 0, 0]), c.tail || c.skin, SURF.leather);
    rb.add('tail3', xf(G.cone(0.05, 0.16, 4), [0, 0, -0.12], [-PI / 2, 0, 0]), c.dark, SURF.leather);
  }
  if (ex.has('spikes')) {
    for (let i = 0; i < 4; i++) rb.add('chest', xf(G.cone(0.04, 0.2, 5), [0, 0.3 - i * 0.09, -0.14 * B], [-2.1, 0, 0]), c.trim, SURF.metal);
    for (const s of ['armL', 'armR']) rb.add(s, xf(G.cone(0.04, 0.18, 5), [0, 0.12, 0]), c.trim, SURF.metal);
  }
  if (ex.has('hunchSpikes')) for (let i = 0; i < 5; i++) rb.add('chest', xf(G.cone(0.03, 0.15, 4), [(i % 2 ? 1 : -1) * 0.05, 0.28 - i * 0.07, -0.14], [-2.3, 0, 0]), c.bone, SURF.bone);
  if (ex.has('halo')) rb.add('head', xf(G.torus(0.18, 0.015, 4, 24), [0, 0.42, -0.04], [PI / 2 - 0.2, 0, 0]), c.glow, SURF.glow);
  if (ex.has('chains')) for (let i = 0; i < 6; i++) rb.add('hips', xf(G.torus(0.025, 0.007, 4, 8), [0.12 * B, -0.1 - i * 0.04, 0.08], [0, i % 2 ? PI / 2 : 0, 0]), 0x4a4a52, SURF.metal);
  if (ex.has('lantern')) {
    rb.add('hips', xf(G.box(0.07, 0.1, 0.07), [-0.19 * B, -0.12, 0.05]), 0x2a2218, SURF.darkMetal);
    rb.add('hips', xf(G.sphere(0.03, 6, 4), [-0.19 * B, -0.12, 0.05]), 0xffa040, SURF.glow);
  }
  if (ex.has('shoulderSkulls')) for (const s of ['armL', 'armR']) rb.add(s, xf(G.sphere(0.06, 6, 5), [0, 0.1, 0.02]), c.bone, SURF.bone);
  if (ex.has('branches')) {
    horn(rb, 'chest', [0.15, 0.35, -0.05], [0.5, 1, -0.3], 0.6, 0.05, c.main, 0.8, 4, SURF.wood);
    horn(rb, 'chest', [-0.15, 0.35, -0.05], [-0.5, 1, -0.2], 0.7, 0.05, c.main, 0.9, 4, SURF.wood);
    horn(rb, 'head', [0.05, 0.2, 0], [0.3, 1, 0.1], 0.4, 0.035, c.main, 0.6, 3, SURF.wood);
  }
  if (ex.has('iceSpikes')) for (let i = 0; i < 5; i++) rb.add('chest', xf(G.cone(0.05, 0.3, 5), [(i - 2) * 0.08, 0.3, -0.12], [-2.4 + Math.abs(i - 2) * 0.1, 0, (i - 2) * 0.2]), c.glow, SURF.crystal);
  if (ex.has('flameHead')) for (let i = 0; i < 5; i++) rb.add('head', xf(G.cone(0.05, 0.25, 5), [(i - 2) * 0.04, 0.3, (i % 2) * 0.03], [0, 0, (i - 2) * 0.2]), c.glow, SURF.glow);
  if (ex.has('tentacleBeard')) for (let i = 0; i < 4; i++) rb.add('head', xf(G.cone(0.02, 0.2, 5), [(i - 1.5) * 0.03, 0.0, 0.1], [PI - 0.3, 0, 0]), c.skin, SURF.wet);
  if (ex.has('backpack')) {
    rb.add('chest', xf(G.box(0.26, 0.3, 0.14), [0, 0.1, -0.2]), c.leather, SURF.leather);
  }
  if (ex.has('orbs')) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    rb.add('chest', xf(G.sphere(0.06, 6, 5), [Math.sin(a) * 0.45, 0.45, Math.cos(a) * 0.45]), c.glow, SURF.glow);
  }
  if (spec.gut) rb.add('spine', xf(G.sphere(0.24 * B, 10, 8), [0, 0, 0.08], [0, 0, 0], [1, 0.9, 1]), c.skin, SURF.skin);
}

// ======================= QUADRUPÈDES =======================
// type : wolf | hound | rat | toad | boar
export function buildQuadruped(spec, material) {
  const c = Object.assign({ main: 0x2a2a30, belly: 0x3a3a40, eyes: 0xffcc22, dark: 0x0a0a0a, glow: 0xff5a1a, bone: 0xe0d8c0 }, spec.c || {});
  const t = spec.type || 'wolf';
  const rb = new RigBuilder();
  const legH = t === 'rat' ? 0.18 : t === 'toad' ? 0.25 : 0.5;
  const bodyLen = t === 'rat' ? 0.35 : t === 'toad' ? 0.35 : 0.55;
  rb.bone('body', 'root', 0, legH + 0.12, -bodyLen / 2);
  rb.bone('chest', 'body', 0, 0.02, bodyLen);
  rb.bone('neck', 'chest', 0, 0.08, 0.12);
  rb.bone('head', 'neck', 0, 0.06, 0.14);
  rb.bone('jaw', 'head', 0, -0.04, 0.05);
  const lx = t === 'toad' ? 0.2 : 0.13;
  for (const [n, par, x, z] of [['FL', 'chest', lx, 0.02], ['FR', 'chest', -lx, 0.02], ['BL', 'body', lx, 0], ['BR', 'body', -lx, 0]]) {
    rb.bone('leg' + n, par, x, -0.06, z);
    rb.bone('leg' + n + '2', 'leg' + n, 0, -legH * 0.5, 0);
  }
  rb.bone('tail1', 'body', 0, 0.04, -0.12);
  rb.bone('tail2', 'tail1', 0, 0, -0.25);
  const W = t === 'toad' ? 1.6 : t === 'rat' ? 0.7 : t === 'boar' ? 1.3 : 1;
  // Corps
  if (t === 'toad') {
    rb.add('body', xf(G.sphere(0.3, 10, 8), [0, 0.02, 0.15], [0, 0, 0], [1.2, 0.75, 1.2]), c.main, SURF.wet);
    rb.add('body', xf(G.sphere(0.26, 10, 8), [0, -0.06, 0.18], [0, 0, 0], [1.1, 0.6, 1.1]), c.belly, SURF.wet);
    for (let i = 0; i < 8; i++) rb.add('body', xf(G.sphere(0.04, 5, 4), [Math.sin(i * 1.7) * 0.22, 0.2, 0.15 + Math.cos(i * 2.3) * 0.2]), c.glow, SURF.glowSoft);
  } else {
    rb.add('body', xf(G.cyl(0.14 * W, 0.17 * W, bodyLen, 8), [0, 0, bodyLen * 0.5], [PI / 2, 0, 0], [1, 1, 0.85]), c.main, SURF.leather);
    rb.add('chest', xf(G.sphere(0.19 * W, 8, 6), [0, 0, 0], [0, 0, 0], [1, 1.05, 1.1]), c.main, SURF.leather);
    rb.add('body', xf(G.sphere(0.16 * W, 8, 6), [0, 0, 0]), c.main, SURF.leather);
    if (t === 'wolf' || t === 'hound') for (let i = 0; i < 5; i++) rb.add('chest', xf(G.cone(0.04 * W, 0.14, 4), [0, 0.15 * W, -0.05 - i * 0.12], [-1.9, 0, 0]), c.dark, SURF.leather);
    if (t === 'hound') for (let i = 0; i < 4; i++) rb.add('body', xf(G.box(0.02, 0.02, 0.18), [(i - 1.5) * 0.06, 0.12, 0.3]), c.glow, SURF.glow);
  }
  // Tête
  const HS = t === 'toad' ? 1.3 : t === 'rat' ? 0.6 : t === 'boar' ? 1.2 : 1;
  rb.add('neck', xf(G.cyl(0.08 * W, 0.11 * W, 0.2, 7), [0, 0, 0.02], [1.1, 0, 0]), c.main, SURF.leather);
  if (t === 'toad') {
    rb.add('head', xf(G.sphere(0.2, 10, 8), [0, 0, 0.05], [0, 0, 0], [1.3, 0.7, 1]), c.main, SURF.wet);
    rb.add('jaw', xf(G.box(0.4, 0.05, 0.2), [0, -0.02, 0.04]), c.belly, SURF.wet);
    for (const s of [-1, 1]) {
      rb.add('head', xf(G.sphere(0.06, 8, 6), [s * 0.14, 0.1, 0.05]), 0xe0d040, SURF.wet);
      rb.add('head', xf(G.sphere(0.03, 6, 4), [s * 0.15, 0.11, 0.1]), c.eyes, SURF.glow);
    }
  } else {
    rb.add('head', xf(G.sphere(0.11 * HS, 8, 6), [0, 0, 0], [0, 0, 0], [1, 0.95, 1.1]), c.main, SURF.leather);
    rb.add('head', xf(G.box(0.1 * HS, 0.07 * HS, 0.18 * HS), [0, 0, 0.13 * HS]), c.main, SURF.leather);
    rb.add('jaw', xf(G.box(0.08 * HS, 0.03, 0.16 * HS), [0, -0.01, 0.1 * HS]), c.belly, SURF.leather);
    for (let i = 0; i < 4; i++) rb.add('jaw', xf(G.cone(0.008, 0.035, 3), [(i - 1.5) * 0.02 * HS, 0.02, 0.15 * HS], [0, 0, 0]), c.bone, SURF.bone);
    rb.add('head', xf(G.sphere(0.022 * HS, 5, 4), [0, 0.01, 0.23 * HS]), 0x050505, SURF.wet);
    for (const s of [-1, 1]) {
      rb.add('head', xf(G.cone(0.035 * HS, 0.1 * HS, 4), [s * 0.06 * HS, 0.1 * HS, -0.02], [-0.3, 0, -s * 0.3]), c.main, SURF.leather);
      rb.add('head', xf(G.sphere(0.016 * HS, 5, 4), [s * 0.05 * HS, 0.04 * HS, 0.08 * HS]), c.eyes, SURF.glow);
    }
    if (t === 'boar') for (const s of [-1, 1]) rb.add('jaw', xf(G.cone(0.02, 0.12, 5), [s * 0.05, 0.05, 0.18], [-0.4, 0, s * 0.3]), c.bone, SURF.bone);
    if (t === 'hound') for (const s of [-1, 1]) horn(rb, 'head', [s * 0.05, 0.08, 0], [s * 0.4, 0.7, -0.6], 0.2, 0.025, c.dark, 1, 3);
  }
  // Pattes
  for (const n of ['FL', 'FR', 'BL', 'BR']) {
    const th = t === 'toad' ? 0.07 : 0.055 * W;
    rb.add('leg' + n, xf(G.cyl(th, th * 0.8, legH * 0.5, 6), [0, -legH * 0.25, 0]), c.main, SURF.leather);
    rb.add('leg' + n + '2', xf(G.cyl(th * 0.75, th * 0.6, legH * 0.5, 6), [0, -legH * 0.25, 0]), c.main, SURF.leather);
    rb.add('leg' + n + '2', xf(G.box(th * 2, 0.04, th * 2.6), [0, -legH * 0.5, 0.02]), c.dark, SURF.leather);
  }
  // Queue
  const tl = t === 'rat' ? 0.4 : 0.28;
  rb.add('tail1', xf(G.cyl(0.04 * W, 0.03 * W, tl, 5), [0, 0, -tl / 2], [PI / 2, 0, 0]), c.main, SURF.leather);
  rb.add('tail2', xf(G.cyl(0.03 * W, t === 'rat' ? 0.008 : 0.04 * W, tl, 5), [0, 0, -tl / 2], [PI / 2, 0, 0]), t === 'hound' ? c.glow : c.main, t === 'hound' ? SURF.glow : SURF.leather);
  const built = rb.build(material);
  built.rig = 'quad';
  built.height = legH + 0.4;
  return built;
}

// ======================= ARAIGNÉE =======================
export function buildSpider(spec, material) {
  const c = Object.assign({ main: 0x1a1418, mark: 0xb03030, eyes: 0xff3030, bone: 0xd0c8b0 }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 0.45, 0);
  rb.bone('abdomen', 'body', 0, 0.08, -0.25);
  rb.bone('head', 'body', 0, 0, 0.22);
  rb.add('body', xf(G.sphere(0.22, 10, 8), [0, 0, 0], [0, 0, 0], [1, 0.7, 1.1]), c.main, SURF.leather);
  rb.add('abdomen', xf(G.sphere(0.34, 12, 8), [0, 0.05, -0.2], [0, 0, 0], [1, 0.85, 1.2]), c.main, SURF.leather);
  rb.add('abdomen', xf(G.box(0.12, 0.04, 0.28), [0, 0.32, -0.2], [0.15, 0, 0]), c.mark, SURF.glowSoft);
  rb.add('head', xf(G.sphere(0.13, 8, 6), [0, 0, 0.05]), c.main, SURF.leather);
  for (let i = 0; i < 6; i++) rb.add('head', xf(G.sphere(0.022, 5, 4), [((i % 3) - 1) * 0.045, 0.06 + Math.floor(i / 3) * 0.035, 0.15]), c.eyes, SURF.glow);
  for (const s of [-1, 1]) rb.add('head', xf(G.cone(0.025, 0.13, 4), [s * 0.04, -0.07, 0.15], [PI - 0.4, 0, 0]), c.bone, SURF.bone);
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1;
    const k = i % 4;
    const n = 'leg' + i;
    rb.bone(n, 'body', side * 0.15, 0.02, 0.12 - k * 0.1);
    rb.bone(n + 'b', n, side * 0.36, 0.22, 0);
    rb.add(n, xf(G.cyl(0.035, 0.028, 0.46, 5), [side * 0.18, 0.11, 0], [0, 0, side * -1.1]), c.main, SURF.leather);
    rb.add(n + 'b', xf(G.cyl(0.028, 0.01, 0.72, 5), [side * 0.12, -0.33, 0], [0, 0, side * 0.35]), c.main, SURF.leather);
  }
  const built = rb.build(material);
  built.rig = 'spider';
  built.height = 0.8;
  return built;
}

// ======================= CHAUVE-SOURIS =======================
export function buildBat(spec, material) {
  const c = Object.assign({ main: 0x2a1a24, wing: 0x3a1a2a, eyes: 0xff2040 }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 1.6, 0);
  rb.bone('head', 'body', 0, 0.12, 0.08);
  rb.bone('wingL', 'body', 0.08, 0.05, 0);
  rb.bone('wingL2', 'wingL', 0.35, 0, 0);
  rb.bone('wingR', 'body', -0.08, 0.05, 0);
  rb.bone('wingR2', 'wingR', -0.35, 0, 0);
  rb.add('body', xf(G.sphere(0.12, 8, 6), [0, 0, 0], [0, 0, 0], [1, 1.2, 1]), c.main, SURF.leather);
  rb.add('head', xf(G.sphere(0.08, 8, 6)), c.main, SURF.leather);
  for (const s of [-1, 1]) {
    rb.add('head', xf(G.cone(0.03, 0.1, 4), [s * 0.05, 0.08, 0]), c.main, SURF.leather);
    rb.add('head', xf(G.sphere(0.015, 5, 4), [s * 0.03, 0.01, 0.07]), c.eyes, SURF.glow);
    const w = s > 0 ? 'wingL' : 'wingR';
    rb.add(w, xf(G.box(0.36, 0.02, 0.26), [s * 0.18, 0, -0.04]), c.wing, SURF.leather);
    rb.add(w + '2', xf(G.box(0.38, 0.015, 0.3), [s * 0.18, 0, -0.06], [0, s * 0.2, 0]), c.wing, SURF.leather);
  }
  for (const s of [-1, 1]) rb.add('head', xf(G.cone(0.008, 0.03, 3), [s * 0.02, -0.05, 0.06], [PI, 0, 0]), 0xffffff, SURF.bone);
  const built = rb.build(material);
  built.rig = 'bat';
  built.height = 1.8;
  return built;
}

// ======================= SLIME =======================
export function buildBlob(spec, material) {
  const c = Object.assign({ main: 0x5aff3a, core: 0x1a6a10, eyes: 0x101010 }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 0, 0);
  rb.bone('eyes', 'body', 0, 0.5, 0.3);
  rb.add('body', xf(G.sphere(0.5, 14, 10), [0, 0.42, 0], [0, 0, 0], [1, 0.85, 1]), c.main, [0.1, 0.1, 0.35]);
  rb.add('body', xf(G.sphere(0.2, 8, 6), [0.05, 0.4, -0.05]), c.core, [0.3, 0, 0.8]);
  for (let i = 0; i < 3; i++) rb.add('body', xf(G.sphere(0.05, 5, 4), [Math.sin(i * 2) * 0.25, 0.3 + i * 0.1, Math.cos(i * 2) * 0.2]), 0xe8e0d0, SURF.bone);
  for (const s of [-1, 1]) {
    rb.add('eyes', xf(G.sphere(0.08, 8, 6), [s * 0.14, 0, 0.1]), 0xf0f0e0, SURF.wet);
    rb.add('eyes', xf(G.sphere(0.04, 6, 4), [s * 0.14, 0, 0.17]), c.eyes, SURF.wet);
  }
  const built = rb.build(material);
  built.rig = 'blob';
  built.height = 0.9;
  return built;
}

// ======================= SERPENT =======================
export function buildSerpent(spec, material) {
  const c = Object.assign({ main: 0x2a4a2a, belly: 0x8a9a5a, eyes: 0xffe030, mark: 0x1a2a1a }, spec.c || {});
  const segs = spec.segments || 9;
  const rb = new RigBuilder();
  rb.bone('seg0', 'root', 0, 0.3, 0);
  let prev = 'seg0';
  for (let i = 1; i < segs; i++) {
    rb.bone('seg' + i, prev, 0, 0, -0.42);
    prev = 'seg' + i;
  }
  rb.bone('neck', 'seg0', 0, 0.05, 0.3);
  rb.bone('head', 'neck', 0, 0.35, 0.2);
  rb.bone('jaw', 'head', 0, -0.05, 0.05);
  for (let i = 0; i < segs; i++) {
    const r = 0.22 * (1 - (i / segs) * 0.75);
    rb.add('seg' + i, xf(G.cyl(r, r * 0.92, 0.46, 8), [0, 0, -0.21], [PI / 2, 0, 0]), i % 2 ? c.main : c.mark, SURF.wet);
    rb.add('seg' + i, xf(G.box(r * 1.1, 0.03, 0.4), [0, -r * 0.9, -0.21]), c.belly, SURF.leather);
  }
  rb.add('neck', xf(G.cyl(0.18, 0.22, 0.5, 8), [0, 0.18, 0.1], [0.5, 0, 0]), c.main, SURF.wet);
  rb.add('head', xf(G.sphere(0.2, 10, 8), [0, 0, 0.08], [0, 0, 0], [1.2, 0.75, 1.5]), c.main, SURF.wet);
  rb.add('jaw', xf(G.box(0.26, 0.05, 0.3), [0, -0.02, 0.12]), c.belly, SURF.leather);
  for (const s of [-1, 1]) {
    rb.add('head', xf(G.sphere(0.04, 6, 4), [s * 0.14, 0.07, 0.15]), c.eyes, SURF.glow);
    rb.add('jaw', xf(G.cone(0.02, 0.1, 4), [s * 0.08, 0.06, 0.24]), 0xf0f0e0, SURF.bone);
    rb.add('head', xf(G.cone(0.05, 0.25, 4), [s * 0.12, 0.12, -0.12], [-1.2, 0, s * 0.4]), c.mark, SURF.leather);
  }
  const built = rb.build(material);
  built.rig = 'serpent';
  built.height = 1.2;
  built.segments = segs;
  return built;
}

// ======================= FEU FOLLET =======================
export function buildWisp(spec, material) {
  const c = Object.assign({ core: 0x7affd0, shell: 0x1a6a5a }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('core', 'root', 0, 1.3, 0);
  rb.bone('orb1', 'core', 0.3, 0, 0);
  rb.bone('orb2', 'core', -0.3, 0, 0);
  rb.add('core', xf(G.ico(0.22, 1)), c.core, [1, 0, 1.2]);
  rb.add('core', xf(G.ico(0.32, 0)), c.shell, [0.2, 0.3, 0.3]);
  rb.add('orb1', xf(G.sphere(0.06, 6, 4)), c.core, SURF.glow);
  rb.add('orb2', xf(G.sphere(0.06, 6, 4)), c.core, SURF.glow);
  const built = rb.build(material, { castShadow: false });
  built.rig = 'wisp';
  built.height = 1.5;
  return built;
}

// ======================= ŒIL DU NÉANT =======================
export function buildEye(spec, material) {
  const c = Object.assign({ main: 0x2a1a3a, iris: 0xff3a8a, white: 0xd8c8e0, tent: 0x3a1a4a }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 2, 0);
  rb.bone('lidT', 'body', 0, 0, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    rb.bone('t' + i + 'a', 'body', Math.sin(a) * 0.25, -0.3, Math.cos(a) * 0.25 - 0.1);
    rb.bone('t' + i + 'b', 't' + i + 'a', 0, -0.35, 0);
    rb.add('t' + i + 'a', xf(G.cyl(0.05, 0.035, 0.38, 5), [0, -0.18, 0]), c.tent, SURF.wet);
    rb.add('t' + i + 'b', xf(G.cyl(0.035, 0.008, 0.4, 5), [0, -0.2, 0]), c.tent, SURF.wet);
  }
  rb.add('body', xf(G.sphere(0.42, 14, 10)), c.white, SURF.wet);
  rb.add('body', xf(G.sphere(0.2, 10, 8), [0, 0, 0.3], [0, 0, 0], [1, 1, 0.5]), c.iris, SURF.glow);
  rb.add('body', xf(G.sphere(0.08, 8, 6), [0, 0, 0.4], [0, 0, 0], [0.5, 1.4, 0.5]), 0x050505, SURF.wet);
  rb.add('lidT', xf(G.sphereP(0.45, 14, 6, 0, PI * 2, 0, PI * 0.45), [0, 0, 0], [-0.6, 0, 0]), c.main, SURF.leather);
  rb.add('body', xf(G.sphereP(0.45, 14, 6, 0, PI * 2, 0, PI * 0.45), [0, 0, 0], [PI + 0.7, 0, 0]), c.main, SURF.leather);
  const built = rb.build(material);
  built.rig = 'eye';
  built.height = 2.5;
  return built;
}

// ======================= HORREUR TENTACULAIRE =======================
export function buildTentacle(spec, material) {
  const c = Object.assign({ main: 0x2a1236, tip: 0xb04dff, eye: 0x7aff4d, mound: 0x1a0a22 }, spec.c || {});
  const n = spec.count || 6;
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 0.4, 0);
  rb.bone('eye', 'body', 0, 1.1, 0.2);
  rb.add('body', xf(G.sphere(0.9, 12, 8), [0, 0, 0], [0, 0, 0], [1, 0.6, 1]), c.mound, SURF.wet);
  rb.add('eye', xf(G.sphere(0.32, 12, 10)), 0xe0d0c0, SURF.wet);
  rb.add('eye', xf(G.sphere(0.16, 8, 6), [0, 0, 0.22], [0, 0, 0], [1, 1, 0.5]), c.eye, SURF.glow);
  rb.add('eye', xf(G.sphere(0.06, 6, 4), [0, 0, 0.3], [0, 0, 0], [0.5, 1.5, 0.5]), 0x050505, SURF.wet);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const x = Math.sin(a) * 0.7;
    const z = Math.cos(a) * 0.7;
    let prev = 'body';
    for (let k = 0; k < 5; k++) {
      const name = 't' + i + '_' + k;
      rb.bone(name, prev, k === 0 ? x : 0, k === 0 ? 0.2 : 0.55, k === 0 ? z : 0);
      const r = 0.2 * (1 - k * 0.17);
      rb.add(name, xf(G.cyl(r * 0.8, r, 0.6, 7), [0, 0.28, 0]), k === 4 ? c.tip : c.main, k === 4 ? SURF.glowSoft : SURF.wet);
      prev = name;
    }
  }
  const built = rb.build(material);
  built.rig = 'tentacle';
  built.height = 3;
  built.count = n;
  return built;
}

// ======================= MIMIC =======================
export function buildMimic(spec, material) {
  const c = Object.assign({ wood: 0x4a2a18, metal: 0x8a7a40, tongue: 0xb02040, teeth: 0xf0e8d0, eyes: 0xffd030 }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 0.02, 0);
  rb.bone('lid', 'body', 0, 0.5, -0.3);
  rb.bone('tongue', 'body', 0, 0.45, 0.1);
  rb.add('body', xf(G.box(0.9, 0.5, 0.6), [0, 0.25, 0]), c.wood, SURF.wood);
  rb.add('body', xf(G.box(0.94, 0.06, 0.64), [0, 0.1, 0]), c.metal, SURF.gold);
  rb.add('body', xf(G.box(0.94, 0.06, 0.64), [0, 0.44, 0]), c.metal, SURF.gold);
  for (let i = 0; i < 7; i++) rb.add('body', xf(G.cone(0.035, 0.1, 4), [-0.36 + i * 0.12, 0.52, 0.28]), c.teeth, SURF.bone);
  rb.add('lid', xf(G.cylP(0.3, 0.3, 0.9, 10, 0, PI), [0, 0, 0.3], [0, 0, PI / 2], [1, 1, 1]), c.wood, SURF.wood);
  rb.add('lid', xf(G.box(0.1, 0.12, 0.08), [0, -0.02, 0.62]), c.metal, SURF.gold);
  for (let i = 0; i < 7; i++) rb.add('lid', xf(G.cone(0.035, 0.1, 4), [-0.36 + i * 0.12, -0.05, 0.58], [PI, 0, 0]), c.teeth, SURF.bone);
  for (const s of [-1, 1]) rb.add('lid', xf(G.sphere(0.05, 6, 4), [s * 0.2, 0.05, 0.55]), c.eyes, SURF.glow);
  rb.add('tongue', xf(G.box(0.18, 0.05, 0.5), [0, 0, 0.25]), c.tongue, SURF.wet);
  const built = rb.build(material);
  built.rig = 'mimic';
  built.height = 0.9;
  return built;
}

// ======================= DRAGON =======================
export function buildDragon(spec, material) {
  const c = Object.assign({ main: 0x1a1024, belly: 0x3a2a4a, wing: 0x2a0a3a, eyes: 0xb04dff, horn: 0x0a0a0a, glow: 0x9a3cff }, spec.c || {});
  const rb = new RigBuilder();
  rb.bone('body', 'root', 0, 1.3, -0.6);
  rb.bone('chest', 'body', 0, 0.1, 1.2);
  let prev = 'chest';
  for (let i = 0; i < 4; i++) {
    rb.bone('neck' + i, prev, 0, 0.18, 0.35);
    prev = 'neck' + i;
  }
  rb.bone('head', prev, 0, 0.1, 0.3);
  rb.bone('jaw', 'head', 0, -0.1, 0.1);
  prev = 'body';
  for (let i = 0; i < 6; i++) {
    rb.bone('tail' + i, prev, 0, 0, i === 0 ? -0.5 : -0.55);
    prev = 'tail' + i;
  }
  for (const [n, par, x, z] of [['FL', 'chest', 0.4, 0], ['FR', 'chest', -0.4, 0], ['BL', 'body', 0.45, 0], ['BR', 'body', -0.45, 0]]) {
    rb.bone('leg' + n, par, x, -0.1, z);
    rb.bone('leg' + n + '2', 'leg' + n, 0, -0.6, 0.1);
    rb.add('leg' + n, xf(G.cyl(0.16, 0.12, 0.65, 7), [0, -0.3, 0]), c.main, SURF.leather);
    rb.add('leg' + n + '2', xf(G.cyl(0.11, 0.09, 0.6, 7), [0, -0.3, 0]), c.main, SURF.leather);
    rb.add('leg' + n + '2', xf(G.box(0.26, 0.08, 0.36), [0, -0.6, 0.08]), c.horn, SURF.darkMetal);
  }
  for (const s of [1, -1]) {
    const w = s > 0 ? 'wingL' : 'wingR';
    rb.bone(w, 'chest', s * 0.35, 0.35, -0.2);
    rb.bone(w + '2', w, s * 1.6, 0.2, 0);
    rb.add(w, xf(G.cyl(0.06, 0.05, 1.7, 6), [s * 0.8, 0.1, 0], [0, 0, s * -PI / 2]), c.main, SURF.leather);
    rb.add(w, xf(G.box(1.6, 0.03, 1.4), [s * 0.8, 0, -0.7]), c.wing, SURF.leather);
    rb.add(w + '2', xf(G.box(1.8, 0.025, 1.6), [s * 0.9, 0, -0.8], [0, s * 0.3, 0]), c.wing, SURF.leather);
    rb.add(w + '2', xf(G.cone(0.05, 0.3, 4), [s * 1.8, 0, 0.1], [0, 0, s * -PI / 2]), c.horn, SURF.bone);
  }
  rb.add('body', xf(G.sphere(0.6, 12, 8), [0, 0, 0.3], [0, 0, 0], [1, 0.85, 1.4]), c.main, SURF.leather);
  rb.add('chest', xf(G.sphere(0.62, 12, 8), [0, 0, 0], [0, 0, 0], [1, 0.95, 1.1]), c.main, SURF.leather);
  rb.add('chest', xf(G.sphere(0.5, 10, 8), [0, -0.2, 0.1], [0, 0, 0], [1, 0.8, 1.1]), c.belly, SURF.leather);
  for (let i = 0; i < 7; i++) rb.add('body', xf(G.cone(0.08, 0.35, 4), [0, 0.52, 1 - i * 0.3], [-0.4, 0, 0]), c.horn, SURF.bone);
  for (let i = 0; i < 4; i++) {
    rb.add('neck' + i, xf(G.cyl(0.26 - i * 0.03, 0.3 - i * 0.03, 0.5, 8), [0, 0.08, 0.15], [1.0, 0, 0]), c.main, SURF.leather);
    rb.add('neck' + i, xf(G.cone(0.05, 0.2, 4), [0, 0.28, 0.1], [-0.5, 0, 0]), c.horn, SURF.bone);
  }
  rb.add('head', xf(G.box(0.4, 0.3, 0.6), [0, 0, 0.2]), c.main, SURF.leather);
  rb.add('head', xf(G.box(0.3, 0.18, 0.4), [0, -0.02, 0.6]), c.main, SURF.leather);
  rb.add('jaw', xf(G.box(0.28, 0.08, 0.6), [0, -0.05, 0.4]), c.belly, SURF.leather);
  for (let i = 0; i < 6; i++) {
    rb.add('jaw', xf(G.cone(0.02, 0.08, 3), [0.1, 0.02, 0.2 + i * 0.1]), 0xf0f0e0, SURF.bone);
    rb.add('jaw', xf(G.cone(0.02, 0.08, 3), [-0.1, 0.02, 0.2 + i * 0.1]), 0xf0f0e0, SURF.bone);
  }
  for (const s of [-1, 1]) {
    rb.add('head', xf(G.sphere(0.05, 6, 4), [s * 0.17, 0.1, 0.42]), c.eyes, SURF.glow);
    horn(rb, 'head', [s * 0.14, 0.14, 0.05], [s * 0.3, 0.5, -1], 0.7, 0.07, c.horn, 0.6, 4);
  }
  for (let i = 0; i < 6; i++) {
    const r = 0.36 * (1 - i / 6.5);
    rb.add('tail' + i, xf(G.cyl(r * 0.85, r, 0.6, 8), [0, 0, -0.28], [PI / 2, 0, 0]), c.main, SURF.leather);
    rb.add('tail' + i, xf(G.cone(0.05, 0.22, 4), [0, r, -0.28], [-0.4, 0, 0]), c.horn, SURF.bone);
  }
  rb.add('tail5', xf(G.octa(0.2), [0, 0, -0.65], [0, 0, 0], [0.4, 1, 1.4]), c.glow, SURF.glow);
  const built = rb.build(material);
  built.rig = 'dragon';
  built.height = 3;
  return built;
}

// ======================= ARMES =======================
// Géométrie orientée +Y (poignée à l'origine). Retourne { mesh, length }.
export function buildWeapon(def, material) {
  const pb = new PropBuilder();
  const L = def.look || {};
  const blade = L.blade ?? 0xb8bcc8;
  const hilt = L.hilt ?? 0x3a2418;
  const guard = L.guard ?? 0x8a7a50;
  const glow = L.glow ?? null;
  const k = L.len ?? 1;
  const bladeSurf = L.bladeSurf || SURF.metal;
  let length = 1;
  const grip = (len = 0.2, r = 0.022) => {
    pb.add(xf(G.cyl(r, r, len, 6), [0, 0, 0]), hilt, SURF.leather);
    pb.add(xf(G.sphere(r * 1.7, 6, 5), [0, -len / 2 - 0.02, 0]), guard, SURF.gold);
  };
  const runes = (y0, y1, x = 0, z = 0.012) => {
    if (!glow) return;
    const n = 4;
    for (let i = 0; i < n; i++) pb.add(xf(G.box(0.012, (y1 - y0) / (n * 1.8), 0.008), [x, y0 + ((i + 0.5) * (y1 - y0)) / n, z]), glow, SURF.glow);
    pb.add(xf(G.box(0.012, (y1 - y0) / (n * 1.8), 0.008), [x, y0 + (0.5 * (y1 - y0)) / n, -z]), glow, SURF.glow);
  };
  switch (def.type) {
    case 'sword':
    case 'rapier': {
      const bl = (def.type === 'rapier' ? 0.95 : 0.85) * k;
      const w = def.type === 'rapier' ? 0.022 : 0.045;
      grip(0.2);
      pb.add(xf(G.box(def.type === 'rapier' ? 0.16 : 0.24, 0.035, 0.05), [0, 0.11, 0]), guard, SURF.gold);
      pb.add(xf(G.cyl(w, w * 1.15, bl, 4), [0, 0.13 + bl / 2, 0], [0, PI / 4, 0], [1, 1, 0.25]), blade, bladeSurf);
      pb.add(xf(G.cone(w * 1.02, 0.12, 4), [0, 0.13 + bl + 0.06, 0], [0, PI / 4, 0], [1, 1, 0.25]), blade, bladeSurf);
      if (def.type === 'rapier') pb.add(xf(G.torus(0.06, 0.008, 4, 10, PI), [0, 0.06, 0.02], [0, PI / 2, 0]), guard, SURF.gold);
      runes(0.2, 0.13 + bl * 0.8);
      length = 0.13 + bl + 0.12;
      break;
    }
    case 'greatsword': {
      const bl = 1.25 * k;
      grip(0.36, 0.026);
      pb.add(xf(G.box(0.4, 0.05, 0.06), [0, 0.19, 0]), guard, SURF.gold);
      for (const s of [-1, 1]) pb.add(xf(G.cone(0.03, 0.08, 4), [s * 0.21, 0.19, 0], [0, 0, -s * PI / 2]), guard, SURF.gold);
      pb.add(xf(G.cyl(0.065, 0.08, bl, 4), [0, 0.21 + bl / 2, 0], [0, PI / 4, 0], [1, 1, 0.22]), blade, bladeSurf);
      pb.add(xf(G.cone(0.066, 0.18, 4), [0, 0.21 + bl + 0.09, 0], [0, PI / 4, 0], [1, 1, 0.22]), blade, bladeSurf);
      runes(0.3, 0.21 + bl * 0.85);
      length = 0.21 + bl + 0.18;
      break;
    }
    case 'katana': {
      const bl = 0.95 * k;
      grip(0.28, 0.022);
      pb.add(xf(G.cyl(0.05, 0.05, 0.02, 10), [0, 0.15, 0]), guard, SURF.gold);
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        pb.add(xf(G.box(0.02, bl / 6 + 0.01, 0.045 - t * 0.012), [0, 0.16 + (t + 1 / 12) * bl, t * t * 0.1], [-t * 0.25, 0, 0]), blade, bladeSurf);
      }
      runes(0.2, 0.16 + bl * 0.7);
      length = 0.16 + bl;
      break;
    }
    case 'dagger': {
      const bl = 0.38 * k;
      grip(0.13, 0.02);
      pb.add(xf(G.box(0.14, 0.025, 0.04), [0, 0.075, 0]), guard, SURF.gold);
      pb.add(xf(G.cyl(0.028, 0.038, bl, 4), [0, 0.09 + bl / 2, 0], [0, PI / 4, 0], [1, 1, 0.3]), blade, bladeSurf);
      pb.add(xf(G.cone(0.03, 0.08, 4), [0, 0.09 + bl + 0.04, 0], [0, PI / 4, 0], [1, 1, 0.3]), blade, bladeSurf);
      runes(0.12, 0.09 + bl * 0.8);
      length = 0.09 + bl + 0.08;
      break;
    }
    case 'axe':
    case 'greataxe': {
      const big = def.type === 'greataxe';
      const hl = (big ? 1.4 : 0.8) * k;
      pb.add(xf(G.cyl(0.026, 0.03, hl, 6), [0, hl / 2 - 0.15, 0]), hilt, SURF.wood);
      const r = big ? 0.32 : 0.2;
      pb.add(xf(G.disc(r, 0.035, PI * 0.9, 12), [0, hl - 0.28, 0.02], [0, PI / 2, PI / 2 + PI * 0.05], [1, 1, 1]), blade, bladeSurf);
      pb.add(xf(G.box(0.07, big ? 0.24 : 0.16, 0.08), [0, hl - 0.28, 0]), 0x2a2a30, SURF.darkMetal);
      if (big) pb.add(xf(G.disc(r * 0.75, 0.03, PI * 0.9, 10), [0, hl - 0.28, -0.02], [0, -PI / 2, PI / 2 + PI * 0.05]), blade, bladeSurf);
      if (glow) pb.add(xf(G.box(0.01, r * 1.2, 0.012), [0, hl - 0.28, r * 0.75]), glow, SURF.glow);
      length = hl;
      break;
    }
    case 'mace':
    case 'hammer': {
      const hammer = def.type === 'hammer';
      const hl = (hammer ? 1.3 : 0.75) * k;
      pb.add(xf(G.cyl(0.025, 0.028, hl, 6), [0, hl / 2 - 0.12, 0]), hilt, SURF.wood);
      if (hammer) {
        pb.add(xf(G.box(0.46, 0.24, 0.24), [0, hl - 0.2, 0]), blade, bladeSurf);
        pb.add(xf(G.box(0.5, 0.05, 0.28), [0, hl - 0.2, 0]), guard, SURF.gold);
        if (glow) pb.add(xf(G.box(0.3, 0.1, 0.25), [0, hl - 0.2, 0]), glow, SURF.glow);
      } else {
        pb.add(xf(G.sphere(0.1, 8, 6), [0, hl - 0.1, 0]), blade, bladeSurf);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2;
          pb.add(xf(G.box(0.02, 0.18, 0.08), [Math.sin(a) * 0.1, hl - 0.1, Math.cos(a) * 0.1], [0, a, 0]), blade, bladeSurf);
        }
        if (glow) pb.add(xf(G.sphere(0.06, 6, 5), [0, hl + 0.02, 0]), glow, SURF.glow);
      }
      length = hl + 0.05;
      break;
    }
    case 'spear':
    case 'halberd': {
      const hl = 1.8 * k;
      pb.add(xf(G.cyl(0.024, 0.026, hl, 6), [0, hl / 2 - 0.5, 0]), hilt, SURF.wood);
      pb.add(xf(G.cyl(0.035, 0.03, 0.08, 6), [0, hl - 0.52, 0]), guard, SURF.gold);
      pb.add(xf(G.cyl(0.03, 0.06, 0.3, 4), [0, hl - 0.33, 0], [0, PI / 4, 0], [1, 1, 0.3]), blade, bladeSurf);
      pb.add(xf(G.cone(0.062, 0.18, 4), [0, hl - 0.09, 0], [0, PI / 4, 0], [1, 1, 0.3]), blade, bladeSurf);
      if (def.type === 'halberd') {
        pb.add(xf(G.disc(0.22, 0.03, PI * 0.8, 10), [0, hl - 0.45, 0.02], [0, PI / 2, PI / 2 + 0.3]), blade, bladeSurf);
        pb.add(xf(G.cone(0.03, 0.15, 4), [0, hl - 0.45, -0.1], [-PI / 2, 0, 0]), blade, bladeSurf);
      }
      if (glow) pb.add(xf(G.box(0.01, 0.3, 0.02), [0, hl - 0.3, 0]), glow, SURF.glow);
      length = hl - 0.5;
      break;
    }
    case 'scythe': {
      const hl = 1.7 * k;
      pb.add(xf(G.cyl(0.024, 0.026, hl, 6), [0, hl / 2 - 0.45, 0]), hilt, SURF.wood);
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        const a = t * 1.3;
        pb.add(xf(G.box(0.02, 0.06, 0.16), [0, hl - 0.45 - Math.sin(a) * 0.3 + 0.02, 0.08 + t * 0.7 - t * t * 0.1], [a * 0.5, 0, 0], [1, 1 - t * 0.5, 1]), blade, bladeSurf);
      }
      if (glow) pb.add(xf(G.box(0.01, 0.02, 0.6), [0.013, hl - 0.55, 0.4], [0.3, 0, 0]), glow, SURF.glow);
      length = hl - 0.45;
      break;
    }
    case 'staff': {
      const hl = 1.7 * k;
      pb.add(xf(G.cyl(0.024, 0.03, hl, 6), [0, hl / 2 - 0.5, 0]), hilt, SURF.wood);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * PI * 2;
        pb.add(xf(G.cone(0.02, 0.22, 4), [Math.sin(a) * 0.06, hl - 0.45, Math.cos(a) * 0.06], [Math.cos(a) * -0.4, 0, Math.sin(a) * 0.4]), guard, SURF.gold);
      }
      pb.add(xf(G.octa(0.08), [0, hl - 0.38, 0], [0, 0, 0], [1, 1.6, 1]), glow || 0x7a3cff, SURF.glow);
      length = hl - 0.5;
      break;
    }
    case 'claws': {
      pb.add(xf(G.box(0.1, 0.1, 0.1), [0, 0, 0]), guard, SURF.darkMetal);
      for (let i = 0; i < 3; i++) pb.add(xf(G.cone(0.015, 0.35, 4), [(i - 1) * 0.03, 0.2, 0.03]), blade, bladeSurf);
      length = 0.38;
      break;
    }
    case 'shovel': {
      const hl = 1.5 * k;
      pb.add(xf(G.cyl(0.03, 0.035, hl, 6), [0, hl / 2 - 0.4, 0]), hilt, SURF.wood);
      pb.add(xf(G.box(0.34, 0.42, 0.03), [0, hl - 0.25, 0]), blade, SURF.darkMetal);
      length = hl - 0.2;
      break;
    }
    case 'club': {
      const hl = 1.2 * k;
      pb.add(xf(G.cyl(0.04, 0.12, hl, 7), [0, hl / 2 - 0.2, 0]), hilt, SURF.wood);
      for (let i = 0; i < 6; i++) pb.add(xf(G.cone(0.025, 0.1, 4), [Math.sin(i * 1.7) * 0.11, hl - 0.4 + (i % 3) * 0.12, Math.cos(i * 1.7) * 0.11], [Math.cos(i * 1.7) * 1.5, 0, -Math.sin(i * 1.7) * 1.5]), 0xcfc8b0, SURF.bone);
      length = hl - 0.2;
      break;
    }
    case 'bow': {
      for (let i = 0; i < 8; i++) {
        const t = i / 7 - 0.5;
        pb.add(xf(G.cyl(0.018, 0.018, 0.2, 5), [0, t * 1.2, -Math.abs(t) * t * 0.4 - (0.25 - t * t) * 0.3], [t * 1.2, 0, 0]), hilt, SURF.wood);
      }
      pb.add(xf(G.cyl(0.003, 0.003, 1.2, 3), [0, 0, 0.05]), 0xe0e0e0, SURF.cloth);
      length = 0.6;
      break;
    }
    default: {
      grip(0.2);
      pb.add(xf(G.box(0.05, 0.8, 0.015), [0, 0.5, 0]), blade, bladeSurf);
      length = 0.9;
    }
  }
  const mesh = pb.build(material);
  // L'arme pointe vers l'avant quand le bras pend (rotation de la main)
  mesh.userData.length = length;
  return mesh;
}

// ======================= BOUCLIERS =======================
export function buildShield(def, material) {
  const pb = new PropBuilder();
  const L = def.look || {};
  const face = L.face ?? 0x5a5a66;
  const rim = L.rim ?? 0x8a7a50;
  const emblem = L.emblem ?? 0x7a1a2a;
  const glow = L.glow ?? null;
  switch (def.shape) {
    case 'round': {
      pb.add(xf(G.cyl(0.32, 0.32, 0.04, 16), [0, 0, 0], [PI / 2, 0, 0]), face, SURF.wood);
      pb.add(xf(G.torus(0.32, 0.025, 5, 20), [0, 0, 0]), rim, SURF.metal);
      pb.add(xf(G.hemi(0.08, 8, 4), [0, 0, 0.02], [PI / 2, 0, 0]), rim, SURF.metal);
      break;
    }
    case 'kite': {
      pb.add(xf(G.box(0.5, 0.5, 0.04), [0, 0.12, 0]), face, SURF.metal);
      pb.add(xf(G.cone(0.36, 0.5, 4), [0, -0.38, 0], [0, PI / 4, PI], [1, 1, 0.11]), face, SURF.metal);
      pb.add(xf(G.box(0.06, 0.9, 0.05), [0, -0.05, 0.01]), emblem, SURF.cloth);
      pb.add(xf(G.box(0.4, 0.06, 0.05), [0, 0.18, 0.01]), emblem, SURF.cloth);
      pb.add(xf(G.box(0.52, 0.03, 0.05), [0, 0.37, 0]), rim, SURF.gold);
      break;
    }
    case 'tower': {
      pb.add(xf(G.box(0.55, 1.05, 0.06), [0, 0, 0]), face, SURF.metal);
      pb.add(xf(G.box(0.6, 0.05, 0.07), [0, 0.5, 0]), rim, SURF.gold);
      pb.add(xf(G.box(0.6, 0.05, 0.07), [0, -0.5, 0]), rim, SURF.gold);
      pb.add(xf(G.box(0.05, 1.05, 0.07), [0.28, 0, 0]), rim, SURF.gold);
      pb.add(xf(G.box(0.05, 1.05, 0.07), [-0.28, 0, 0]), rim, SURF.gold);
      pb.add(xf(G.sphere(0.1, 8, 6), [0, 0.1, 0.03], [0, 0, 0], [1, 1, 0.4]), emblem, SURF.metal);
      break;
    }
    case 'heater':
    default: {
      pb.add(xf(G.box(0.46, 0.36, 0.04), [0, 0.1, 0]), face, SURF.metal);
      pb.add(xf(G.cone(0.33, 0.36, 4), [0, -0.26, 0], [0, PI / 4, PI], [1, 1, 0.12]), face, SURF.metal);
      pb.add(xf(G.box(0.48, 0.03, 0.05), [0, 0.28, 0]), rim, SURF.gold);
      pb.add(xf(G.octa(0.09), [0, 0.02, 0.03], [0, 0, 0], [1, 1.4, 0.3]), emblem, SURF.gold);
    }
  }
  if (glow) pb.add(xf(G.octa(0.06), [0, 0.05, 0.05], [0, 0, 0], [1, 1.5, 0.4]), glow, SURF.glow);
  return pb.build(material);
}
