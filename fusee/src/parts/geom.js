// Outils de géométrie : révolution avec UV en mètres, fusion par matériau.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Surface de révolution autour de Y. pts = [[r, y], ...] du bas vers le haut
// (ou dans l'ordre voulu : la normale pointe « à droite » du profil parcouru).
export function lathe(pts, seg = 48, phiStart = 0, phiLen = Math.PI * 2, flipNormals = false) {
  const n = pts.length;
  const s = [0];
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let rMax = 0;
  for (const p of pts) rMax = Math.max(rMax, p[0]);
  const period = 2;
  const reps = Math.max(1, Math.round((2 * Math.PI * rMax) / period));
  const uScale = phiLen >= Math.PI * 2 - 1e-6 ? (reps * period) / (Math.PI * 2) : rMax;
  // normales 2D par point
  const nr = [], ny = [];
  for (let i = 0; i < n; i++) {
    let tx = 0, ty = 0;
    const add = (a, b) => {
      const dx = pts[b][0] - pts[a][0], dy = pts[b][1] - pts[a][1];
      const l = Math.hypot(dx, dy);
      if (l > 1e-9) { tx += dx / l; ty += dy / l; return true; }
      return false;
    };
    // arêtes vives : point dupliqué => normale d'un seul côté
    const dupPrev = i > 0 && Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < 1e-9;
    const dupNext = i < n - 1 && Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) < 1e-9;
    if (i > 0 && !dupPrev) add(i - 1, i);
    if (i < n - 1 && !dupNext) add(i, i + 1);
    if (dupPrev && i < n - 1) add(i, i + 1);
    if (dupNext && i > 0) add(i - 1, i);
    let a = ty, b = -tx;
    const l = Math.hypot(a, b) || 1;
    a /= l; b /= l;
    if (flipNormals) { a = -a; b = -b; }
    nr.push(a); ny.push(b);
  }
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= seg; j++) {
    const phi = phiStart + (j / seg) * phiLen;
    const c = Math.cos(phi), sn = Math.sin(phi);
    for (let i = 0; i < n; i++) {
      const [r, y] = pts[i];
      pos.push(r * c, y, r * sn);
      nor.push(nr[i] * c, ny[i], nr[i] * sn);
      uv.push((phi - phiStart) * uScale, s[i]);
    }
  }
  for (let j = 0; j < seg; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = (j + 1) * n + i, c = (j + 1) * n + i + 1, d = j * n + i + 1;
    if (flipNormals) idx.push(a, b, d, b, c, d);
    else idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Disque (couvercle) horizontal
export function disc(r, y, up = true, seg = 40, r0 = 0) {
  return up ? lathe([[r, y], [r0, y]], seg) : lathe([[r0, y], [r, y]], seg);
}

export function cyl(rTop, rBot, h, seg = 32, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  return g;
}

export function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

export function sphere(r, ws = 24, hs = 16) {
  return new THREE.SphereGeometry(r, ws, hs);
}

export function torus(R, r, rs = 8, ts = 48) {
  const g = new THREE.TorusGeometry(R, r, rs, ts);
  g.rotateX(Math.PI / 2);
  return g;
}

// Tube le long d'une liste de points 3D
export function tube(points, r, seg = 24, rs = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, rs, false);
}

// Barre entre deux points (pour treillis, vérins…)
export function strut(a, b, r, rs = 6) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.CylinderGeometry(r, r, len, rs, 1, false);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

export function extrudeShape(shape, depth, bevel = 0.01) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Ramène une géométrie à des attributs standard (position, normal, uv) indexés
export function normalize(g) {
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    g.setIndex(idx);
  }
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  g.morphAttributes = {};
  return g;
}

// Accumulateur : géométries regroupées par clé de matériau
export class GeoBag {
  constructor() {
    this.map = new Map();
  }
  add(key, g, { p, r, s } = {}) {
    if (s) g.scale(...(Array.isArray(s) ? s : [s, s, s]));
    if (r) {
      const e = new THREE.Euler(...r);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(e));
    }
    if (p) g.translate(...p);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(normalize(g));
    return this;
  }
  // Ajoute avec une matrice de transformation
  addM(key, g, m) {
    g.applyMatrix4(m);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(normalize(g));
    return this;
  }
  // Construit un groupe de maillages ; resolve(key) -> matériau
  build(resolve, name = '') {
    const grp = new THREE.Group();
    grp.name = name;
    for (const [key, list] of this.map) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!g) continue;
      g.computeBoundingSphere();
      const mat = resolve(key);
      const mesh = new THREE.Mesh(g, mat);
      mesh.userData.matKey = key;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      grp.add(mesh);
    }
    return grp;
  }
}
