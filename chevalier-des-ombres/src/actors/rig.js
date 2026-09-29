// Construction de personnages en « skinning rigide » : chaque pièce (boîte, cylindre…)
// est attachée à un os, puis tout est fusionné dans UN SEUL SkinnedMesh (1 draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SCULPT, sculptStore, partsSignature, sculptGeometry } from './sculpt.js';

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// ---------- Primitives ----------
// Tessellation minimale (arrondis plus doux ; réduite en qualité d'effets « sobre »)
export const DETAIL = { seg: 1 };
const seg = (n) => Math.max(3, Math.round(n * DETAIL.seg));
// Chaque primitive garde sa description analytique (pour la sculpture en champ de distance)
const tag = (g, t, a) => {
  g.userData.sdf = { t, a };
  return g;
};
export const G = {
  box: (w, h, d) => tag(new THREE.BoxGeometry(w, h, d), 1, [w / 2, h / 2, d / 2]),
  cyl: (rt, rb, h, s = 8, open = false) => tag(new THREE.CylinderGeometry(rt, rb, h, seg(Math.max(s, s >= 6 ? 10 : s)), 1, open), 2, [rt, rb, h / 2]),
  sphere: (r, ws = 10, hs = 8) => tag(new THREE.SphereGeometry(r, seg(Math.max(ws, ws >= 8 ? 14 : ws)), seg(Math.max(hs, hs >= 6 ? 10 : hs))), 3, [r]),
  sphereP: (r, ws, hs, ps, pl, ts, tl) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl),
  cylP: (rt, rb, h, seg, ts, tl) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, ts, tl),
  hemi: (r, ws = 10, hs = 5) => tag(new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2), 4, [r]),
  cone: (r, h, seg = 8) => tag(new THREE.ConeGeometry(r, h, seg), 2, [0, r, h / 2]),
  capsule: (r, len, s = 6) => tag(new THREE.CapsuleGeometry(r, len, 4, seg(Math.max(s, 10))), 7, [r, len / 2]),
  torus: (r, t, rs = 6, ts = 12, arc = Math.PI * 2) => {
    const g = new THREE.TorusGeometry(r, t, rs, ts, arc);
    return arc >= Math.PI * 2 - 1e-3 ? tag(g, 5, [r, t]) : g;
  },
  ico: (r, d = 0) => tag(new THREE.IcosahedronGeometry(r, d), 3, [r * 0.92]),
  octa: (r) => tag(new THREE.OctahedronGeometry(r), 6, [r]),
  dodeca: (r) => tag(new THREE.DodecahedronGeometry(r), 9, [r * 0.7947]),
  // Cône arrondi le long de +Y, de 0 (rayon r1) à len (rayon r2) : membres, griffes, cornes
  rcone: (r1, r2, len, s = 10) => {
    const cyl = new THREE.CylinderGeometry(r2, r1, len, seg(s), 1, true);
    cyl.translate(0, len / 2, 0);
    const a = new THREE.SphereGeometry(r1, seg(s), seg(Math.max(4, s * 0.6)));
    const b = new THREE.SphereGeometry(r2, seg(s), seg(Math.max(4, s * 0.6)));
    b.translate(0, len, 0);
    const g = mergeGeometries([cyl, a, b], false);
    [cyl, a, b].forEach((x) => x.dispose());
    return tag(g, 8, [r1, r2, len]);
  },
  tetra: (r) => new THREE.TetrahedronGeometry(r),
  // Demi-cylindre plat (lame de hache, croissant…)
  disc: (r, t, arc = Math.PI, seg = 10) => {
    const g = new THREE.CylinderGeometry(r, r, t, seg, 1, false, 0, arc);
    g.rotateX(Math.PI / 2);
    return g;
  },
};

// Applique position / rotation / échelle à une géométrie
export function xf(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _e.set(r[0], r[1], r[2]);
  _q.setFromEuler(_e);
  _v.set(p[0], p[1], p[2]);
  _s.set(s[0], s[1], s[2]);
  _m.compose(_v, _q, _s);
  geo.applyMatrix4(_m);
  if (geo.userData.sdf) geo.userData.m = (geo.userData.m ? _m.clone().multiply(_m2.fromArray(geo.userData.m)) : _m).toArray();
  return geo;
}

function ensureIndexed(g) {
  if (g.index) return g;
  const n = g.attributes.position.count;
  const idx = new Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(idx);
  return g;
}

function paint(geo, color, mat, boneIndex) {
  ensureIndexed(geo);
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const am = new Float32Array(n * 4);
  _c.set(color);
  const kind = mat[3] ?? (mat[2] > 0.3 ? 0 : mat[1] > 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
    am[i * 4] = mat[0];
    am[i * 4 + 1] = mat[1];
    am[i * 4 + 2] = mat[2];
    am[i * 4 + 3] = kind;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMat', new THREE.BufferAttribute(am, 4));
  if (boneIndex !== undefined) {
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = boneIndex;
      sw[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  return geo;
}

// Préréglages de surfaces : [rugosité, métal, émission]
// 4e valeur : type de surface (motif procédural du shader) — 0 aucun, 1 métal, 2 tissu,
// 3 cuir, 4 peau, 5 os, 6 pierre, 7 bois, 8 cristal, 9 fourrure, 10 écailles
export const SURF = {
  metal: [0.32, 0.78, 0, 1],
  darkMetal: [0.45, 0.7, 0, 1],
  gold: [0.3, 1, 0, 1],
  cloth: [0.95, 0, 0, 2],
  leather: [0.75, 0.05, 0, 3],
  skin: [0.7, 0, 0, 4],
  bone: [0.6, 0, 0, 5],
  stone: [0.9, 0.05, 0, 6],
  wood: [0.85, 0, 0, 7],
  glow: [1, 0, 1, 0],
  glowSoft: [1, 0, 0.45, 0],
  wet: [0.25, 0.1, 0, 4],
  crystal: [0.15, 0.3, 0.5, 8],
  fur: [0.88, 0, 0, 9],
  scales: [0.42, 0.12, 0, 10],
};

export class RigBuilder {
  constructor() {
    this.bones = [];
    this.map = {};
    this.parts = [];
    this.root = this.bone('root', null, 0, 0, 0);
  }

  bone(name, parent, x, y, z) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    b.userData.rest = new THREE.Vector3(x, y, z);
    if (parent) this.map[parent].add(b);
    this.map[name] = b;
    this.bones.push(b);
    return b;
  }

  has(name) {
    return !!this.map[name];
  }

  // Ajoute une pièce attachée à l'os `boneName` (géométrie exprimée dans le repère de l'os)
  add(boneName, geo, color, surf = SURF.cloth) {
    if (!this.map[boneName]) boneName = 'root';
    this.parts.push({ bone: boneName, geo, color, surf });
    return this;
  }

  // Creuse la forme (sculpture uniquement) : orbites, bouches, fentes, plis, côtes, fissures.
  // N'affecte que les pièces du même os ; la paroi creusée prend la couleur / matière donnée.
  carve(boneName, geo, color = 0x050505, surf = SURF.cloth) {
    if (!this.map[boneName]) boneName = 'root';
    this.parts.push({ bone: boneName, geo, color, surf, carve: true });
    return this;
  }

  build(material, opts = {}) {
    this.root.updateMatrixWorld(true);
    // Installation : capture des pièces pour la sculpture (avant toute transformation)
    let sig = null;
    if (RigBuilder.capture || (SCULPT.enabled && sculptStore.size)) sig = partsSignature(this);
    if (RigBuilder.capture) RigBuilder.capture(this, sig);
    const rec = SCULPT.enabled && sig ? sculptStore.get(sig) : null;
    const geo = rec ? this._sculpted(rec, sig) : this._merged(this.parts.filter((p) => !p.carve || (p.geo.dispose(), false)));
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(this.root);
    mesh.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    mesh.bind(skeleton);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    return { mesh, bones: this.map, skeleton, sculpted: !!rec };
  }

  // Pièces rigides fusionnées (modèle classique, accessoires)
  _merged(parts, finalize = true) {
    const geos = [];
    for (const p of parts) {
      const bone = this.map[p.bone];
      const g = p.geo;
      g.applyMatrix4(bone.matrixWorld);
      paint(g, p.color, p.surf, this.bones.indexOf(bone));
      geos.push(g);
    }
    const geo = geos.length ? mergeGeometries(geos, false) : null;
    geos.forEach((g) => g.dispose());
    if (geo && finalize) finalizeGeo(geo);
    return geo;
  }

  // Corps sculpté (données installées) + accessoires nets ; partagé entre ennemis identiques
  _sculpted(rec, sig) {
    let key = sig;
    for (const p of this.parts) key += ':' + (typeof p.color === 'number' ? p.color.toString(36) : String(p.color));
    const cached = sculptCache.get(key);
    if (cached) {
      this.parts.forEach((p) => p.geo.dispose());
      return cached;
    }
    const body = sculptGeometry(rec, this.parts);
    const acc = this._merged(Array.from(rec.acc, (i) => this.parts[i]), false);
    const used = new Set(rec.acc);
    this.parts.forEach((p, i) => used.has(i) || p.geo.dispose());
    const geo = acc ? mergeGeometries([body, acc], false) : body;
    if (acc) {
      body.dispose();
      acc.dispose();
    }
    finalizeGeo(geo);
    geo.userData.shared = true;
    sculptCache.set(key, geo);
    return geo;
  }
}
RigBuilder.capture = null;

// Géométries sculptées déjà construites (clé : sculpture + couleurs)
const sculptCache = new Map();
export function clearSculptCache() {
  for (const g of sculptCache.values()) g.dispose();
  sculptCache.clear();
}

function finalizeGeo(geo) {
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  // Sphère englobante élargie (les animations procédurales dépassent la pose de repos)
  geo.boundingSphere.radius *= 1.6;
}

// Maillage statique (armes, boucliers, accessoires) avec le même matériau que les personnages
export class PropBuilder {
  constructor() {
    this.parts = [];
  }
  add(geo, color, surf = SURF.metal) {
    this.parts.push({ geo, color, surf });
    return this;
  }
  build(material, castShadow = true) {
    const geos = this.parts.map((p) => paint(p.geo, p.color, p.surf));
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = castShadow;
    return mesh;
  }
  buildGeometry() {
    const geos = this.parts.map((p) => paint(p.geo, p.color, p.surf));
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    return geo;
  }
}
