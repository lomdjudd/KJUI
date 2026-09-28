// Construction de personnages en « skinning rigide » : chaque pièce (boîte, cylindre…)
// est attachée à un os, puis tout est fusionné dans UN SEUL SkinnedMesh (1 draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// ---------- Primitives ----------
export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open),
  sphere: (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs),
  sphereP: (r, ws, hs, ps, pl, ts, tl) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl),
  cylP: (rt, rb, h, seg, ts, tl) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, ts, tl),
  hemi: (r, ws = 10, hs = 5) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg),
  capsule: (r, len, seg = 6) => new THREE.CapsuleGeometry(r, len, 3, seg),
  torus: (r, t, rs = 6, ts = 12, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  octa: (r) => new THREE.OctahedronGeometry(r),
  dodeca: (r) => new THREE.DodecahedronGeometry(r),
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
  const am = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
    am[i * 3] = mat[0];
    am[i * 3 + 1] = mat[1];
    am[i * 3 + 2] = mat[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMat', new THREE.BufferAttribute(am, 3));
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
export const SURF = {
  metal: [0.35, 0.95, 0],
  darkMetal: [0.5, 0.85, 0],
  gold: [0.3, 1, 0],
  cloth: [0.95, 0, 0],
  leather: [0.75, 0.05, 0],
  skin: [0.7, 0, 0],
  bone: [0.6, 0, 0],
  stone: [0.9, 0.05, 0],
  wood: [0.85, 0, 0],
  glow: [1, 0, 1],
  glowSoft: [1, 0, 0.45],
  wet: [0.25, 0.1, 0],
  crystal: [0.15, 0.3, 0.5],
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

  build(material, opts = {}) {
    this.root.updateMatrixWorld(true);
    const geos = [];
    for (const p of this.parts) {
      const bone = this.map[p.bone];
      const idx = this.bones.indexOf(bone);
      const g = p.geo;
      g.applyMatrix4(bone.matrixWorld);
      paint(g, p.color, p.surf, idx);
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.add(this.root);
    mesh.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    mesh.bind(skeleton);
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = false;
    // Sphère englobante élargie (les animations procédurales dépassent la pose de repos)
    mesh.geometry.boundingSphere.radius *= 1.6;
    mesh.frustumCulled = true;
    return { mesh, bones: this.map, skeleton };
  }
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
