// Sculpture des créatures (données installées). Les pièces d'un modèle procédural (boîtes,
// cylindres, sphères, cônes, tores…) deviennent un champ de distance signée : les pièces d'un
// même os, et celles d'un os et de son parent, se fondent en douceur (articulations organiques,
// sans palmure entre membres voisins). Le champ reçoit un relief selon la matière (fourrure,
// écailles, pierre, plis de tissu…), puis il est polygonisé (« surface nets »), reprojeté sur la
// surface, et reçoit des poids de skinning progressifs aux articulations. Les pièces fines
// (lames, plaques, yeux lumineux…) restent des pièces nettes par-dessus.
import * as THREE from 'three';

export const SCULPT = { enabled: true };

// ---------- Stockage en mémoire des sculptures installées ----------
const store = new Map();
export const sculptStore = {
  get: (sig) => store.get(sig),
  set: (sig, rec) => store.set(sig, rec),
  has: (sig) => store.has(sig),
  clear: () => store.clear(),
  get size() {
    return store.size;
  },
  memoryMb() {
    let b = 0;
    for (const r of store.values()) b += r.bytes || 0;
    return b / 1048576;
  },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const _m4 = new THREE.Matrix4();
const _c = new THREE.Color();

// ---------- Signature géométrique d'un modèle (sans les couleurs) ----------
export function partsSignature(rb) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const mix = (v) => {
    const x = Math.round(v * 1e4) | 0;
    h1 = Math.imul(h1 ^ x, 16777619);
    h2 = Math.imul(h2 ^ (x + 0x7f4a7c15), 2246822519) ^ (h2 >>> 13);
  };
  mix(rb.bones.length);
  for (const b of rb.bones) {
    mix(b.position.x);
    mix(b.position.y);
    mix(b.position.z);
  }
  for (const p of rb.parts) {
    mix(rb.bones.indexOf(rb.map[p.bone]));
    const sd = p.geo.userData.sdf;
    if (sd) {
      mix(sd.t);
      for (const a of sd.a) mix(a);
      const m = p.geo.userData.m || IDENT;
      for (let i = 0; i < 16; i++) mix(m[i]);
    } else mix(-1 - p.geo.attributes.position.count);
    mix(p.surf[2] >= 0.3 ? 1 : 0);
    mix(p.surf[3] ?? 0);
    mix(p.carve ? 7 : 0);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

// ---------- Distances des primitives (repère local, avant échelle) ----------
function primDist(t, a, x, y, z) {
  switch (t) {
    case 1: {
      // boîte aux arêtes adoucies
      const r = a[3];
      const qx = Math.abs(x) - a[0] + r;
      const qy = Math.abs(y) - a[1] + r;
      const qz = Math.abs(z) - a[2] + r;
      const ox = qx > 0 ? qx : 0;
      const oy = qy > 0 ? qy : 0;
      const oz = qz > 0 ? qz : 0;
      const inner = Math.max(qx, qy, qz);
      return Math.sqrt(ox * ox + oy * oy + oz * oz) + (inner < 0 ? inner : 0) - r;
    }
    case 2: {
      // cône tronqué : a = [rayon haut, rayon bas, demi-hauteur]
      const qx = Math.sqrt(x * x + z * z);
      const qy = y;
      const h = a[2];
      const r1 = a[1];
      const r2 = a[0];
      const k2x = r2 - r1;
      const k2y = 2 * h;
      const cax = qx - Math.min(qx, qy < 0 ? r1 : r2);
      const cay = Math.abs(qy) - h;
      const tt = clamp(((r2 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y), 0, 1);
      const cbx = qx - r2 + k2x * tt;
      const cby = qy - h + k2y * tt;
      const s = cbx < 0 && cay < 0 ? -1 : 1;
      return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
    }
    case 3:
      return Math.sqrt(x * x + y * y + z * z) - a[0];
    case 4:
      return Math.max(Math.sqrt(x * x + y * y + z * z) - a[0], -y);
    case 5: {
      const q = Math.sqrt(x * x + y * y) - a[0];
      return Math.sqrt(q * q + z * z) - a[1];
    }
    case 6:
      return (Math.abs(x) + Math.abs(y) + Math.abs(z) - a[0]) * 0.57735027;
    case 7: {
      const yy = y - clamp(y, -a[1], a[1]);
      return Math.sqrt(x * x + yy * yy + z * z) - a[0];
    }
    case 8: {
      // cône arrondi : a = [r1 (y = 0), r2 (y = len), len, b, c] (b, c précalculés)
      const qx = Math.sqrt(x * x + z * z);
      const k = -a[3] * qx + a[4] * y;
      if (k < 0) return Math.sqrt(qx * qx + y * y) - a[0];
      if (k > a[4] * a[2]) return Math.sqrt(qx * qx + (y - a[2]) * (y - a[2])) - a[1];
      return qx * a[4] + y * a[3] - a[0];
    }
    case 9: {
      // dodécaèdre (rayon inscrit a[0])
      const P = 0.5257311;
      const Q = 0.8506508;
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      const az = Math.abs(z);
      const d = Math.max(P * ay + Q * az, P * ax + Q * ay, Q * ax + P * az, Math.abs(P * y - Q * z), Math.abs(P * x - Q * y), Math.abs(Q * x - P * z));
      return d - a[0];
    }
    default:
      return 1e3;
  }
}

function smin(a, b, k) {
  const h = k - Math.abs(a - b);
  if (h <= 0) return a < b ? a : b;
  const hh = h / k;
  return (a < b ? a : b) - hh * hh * k * 0.25;
}

// Bruit de valeur 3D (relief des matières)
function hash3(ix, iy, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz);
  const b = hash3(ix + 1, iy, iz);
  const c = hash3(ix, iy + 1, iz);
  const d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1);
  const f = hash3(ix + 1, iy, iz + 1);
  const g = hash3(ix, iy + 1, iz + 1);
  const h = hash3(ix + 1, iy + 1, iz + 1);
  const x1 = a + (b - a) * fx;
  const x2 = c + (d - c) * fx;
  const x3 = e + (f - e) * fx;
  const x4 = g + (h - g) * fx;
  const y1 = x1 + (x2 - x1) * fy;
  const y2 = x3 + (x4 - x3) * fy;
  return y1 + (y2 - y1) * fz;
}

// Relief par matière : [amplitude (m), fréquence (1/m), étirement vertical]
const RELIEF = {
  2: [0.0045, 9, 0.25], // tissu : plis verticaux
  3: [0.002, 14, 1], // cuir
  4: [0.003, 11, 1], // peau : muscles, bosses
  5: [0.0028, 17, 1], // os : aspérités
  6: [0.008, 8, 1], // pierre : éclats
  7: [0.003, 12, 0.3], // bois : veinage
  9: [0.0075, 19, 0.45], // fourrure : touffes
  10: [0.0042, 16, 1], // écailles
};

// ---------- Description transférable d'un modèle (pour les workers) ----------
export function describeRig(rb) {
  rb.root.updateMatrixWorld(true);
  const bIndex = new Map(rb.bones.map((b, i) => [b, i]));
  const bones = rb.bones.map((b) => ({ parent: b.parent && bIndex.has(b.parent) ? bIndex.get(b.parent) : -1, mw: b.matrixWorld.toArray() }));
  const parts = rb.parts.map((p) => {
    const g = p.geo;
    g.computeBoundingBox();
    return {
      bi: bIndex.get(rb.map[p.bone]),
      sdf: g.userData.sdf ? { t: g.userData.sdf.t, a: g.userData.sdf.a.slice() } : null,
      m: g.userData.m || null,
      surf: p.surf.slice(),
      carve: !!p.carve,
      bb: [...g.boundingBox.min.toArray(), ...g.boundingBox.max.toArray()],
    };
  });
  return { bones, parts };
}

// ---------- Sculpture d'un modèle ----------
// opts.N : résolution maximale (cellules sur le plus grand axe) ; opts.target : budget de sommets
export function sculptRig(rb, opts = {}) {
  return sculptDesc(describeRig(rb), opts);
}

export function sculptDesc(desc, opts = {}) {
  const N = opts.N || 96;
  const nb = desc.bones.length;
  const boneMW = desc.bones.map((b) => new THREE.Matrix4().fromArray(b.mw));
  const parts = desc.parts;
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const bbs = parts.map((p) => {
    tmp.min.fromArray(p.bb, 0);
    tmp.max.fromArray(p.bb, 3);
    tmp.applyMatrix4(boneMW[p.bi]);
    box.union(tmp);
    return tmp.clone();
  });
  const size = box.getSize(new THREE.Vector3());
  const maxExt = Math.max(size.x, size.y, size.z);
  const sizeScale = clamp(maxExt / 2, 1, 5);
  let h = Math.max(0.006, maxExt / N);

  // Primitives du champ ; les autres pièces restent des « accessoires » nets
  const prims = [];
  const acc = [];
  const choose = () => {
    prims.length = 0;
    acc.length = 0;
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi];
      const sd = p.sdf;
      if (p.carve && !sd) continue;
      if (!sd || (p.surf[2] >= 0.3 && !p.carve)) {
        acc.push(pi);
        continue;
      }
      const M = new THREE.Matrix4().multiplyMatrices(boneMW[p.bi], _m4.fromArray(p.m || IDENT));
      const e = M.elements;
      const sx = Math.hypot(e[0], e[1], e[2]);
      const sy = Math.hypot(e[4], e[5], e[6]);
      const sz = Math.hypot(e[8], e[9], e[10]);
      const smn = Math.min(sx, sy, sz);
      const a = sd.a.slice();
      let thick;
      if (sd.t === 8) {
        const bb = (a[0] - a[1]) / Math.max(1e-6, a[2]);
        a[3] = bb;
        a[4] = Math.sqrt(Math.max(0, 1 - bb * bb));
      }
      if (sd.t === 1) thick = 2 * Math.min(a[0] * sx, a[1] * sy, a[2] * sz);
      else if (sd.t === 8) thick = 2 * Math.max(a[0], a[1]) * Math.min(sx, sz);
      else if (sd.t === 2) thick = Math.min(2 * Math.max(a[0], a[1]) * Math.min(sx, sz), 2 * a[2] * sy);
      else if (sd.t === 5) thick = 2 * a[1] * smn;
      else thick = 2 * a[0] * smn;
      if (thick < 2.1 * h && !p.carve) {
        acc.push(pi);
        continue;
      }
      if (sd.t === 1) a[3] = Math.min(0.25 * Math.min(a[0], a[1], a[2]), (0.012 * sizeScale) / smn);
      const kind = p.surf[3] ?? 0;
      const k = (kind === 1 ? 0.014 : kind === 4 || kind === 5 || kind === 6 || kind === 9 || kind === 10 ? 0.05 : 0.03) * sizeScale;
      const c = bbs[pi].getCenter(new THREE.Vector3());
      const r = bbs[pi].getSize(new THREE.Vector3()).length() / 2;
      prims.push({ pi, carve: !!p.carve, bi: p.bi, t: sd.t, a, inv: new Float64Array(M.clone().invert().elements), s: smn, k, kind, cx: c.x, cy: c.y, cz: c.z, r });
    }
  };
  choose();
  // Résolution adaptée au budget de sommets (surface estimée à partir des primitives)
  if (opts.target) {
    const area = () => {
      let a = 0;
      for (const P of prims) {
        const w = P.carve ? 0.35 : 1;
        const a0 = a;
        const e = P.inv;
        const m = new THREE.Matrix4().fromArray(e).invert().elements;
        const sx = Math.hypot(m[0], m[1], m[2]);
        const sy = Math.hypot(m[4], m[5], m[6]);
        const sz = Math.hypot(m[8], m[9], m[10]);
        const q = P.a;
        switch (P.t) {
          case 1:
            a += 8 * (q[0] * sx * q[1] * sy + q[0] * sx * q[2] * sz + q[1] * sy * q[2] * sz);
            break;
          case 2:
          case 8: {
            const r1 = q[0] * Math.max(sx, sz);
            const r2 = q[1] * Math.max(sx, sz);
            const l = (P.t === 8 ? q[2] : 2 * q[2]) * sy;
            a += Math.PI * (r1 + r2) * Math.hypot(l, r1 - r2) + 2 * Math.PI * (r1 * r1 + r2 * r2) * (P.t === 8 ? 1 : 0.5);
            break;
          }
          case 5:
            a += 4 * Math.PI * Math.PI * q[0] * q[1] * sx * sx;
            break;
          default: {
            const A = q[0] * sx;
            const Bq = q[0] * sy;
            const C = q[0] * sz;
            const p16 = 1.6;
            a += 4 * Math.PI * Math.pow((Math.pow(A * Bq, p16) + Math.pow(A * C, p16) + Math.pow(Bq * C, p16)) / 3, 1 / p16) * (P.t === 4 ? 0.6 : 1);
          }
        }
        a = a0 + (a - a0) * w;
      }
      return a * 0.7;
    };
    const hT = Math.sqrt(area() / opts.target);
    const h2 = clamp(hT, maxExt / (N * 1.25), maxExt / 40);
    if (Math.abs(h2 - h) / h > 0.08) {
      h = h2;
      choose();
    }
  }
  if (!prims.some((P) => !P.carve)) return null;
  // Les creusements sont évalués après les pièces de leur os
  prims.sort((p, q) => (p.carve ? 1 : 0) - (q.carve ? 1 : 0));

  // Os « effectifs » : le parent le plus proche qui porte des pièces du champ
  const hasPrim = new Uint8Array(nb);
  for (const P of prims) if (!P.carve) hasPrim[P.bi] = 1;
  const effParent = new Int16Array(nb).fill(-1);
  for (let i = 0; i < nb; i++) {
    let b = desc.bones[i].parent;
    while (b >= 0 && !hasPrim[b]) b = desc.bones[b].parent;
    effParent[i] = b;
  }

  const T0 = performance.now();
  // Grille (limitée en nombre de cellules)
  let kmax = 0;
  for (const P of prims) kmax = Math.max(kmax, P.k);
  const reliefMax = 0.009 * sizeScale;
  let margin, nx, ny, nz;
  const setup = () => {
    margin = 2 * h + reliefMax;
    nx = Math.ceil((size.x + 2 * margin) / h);
    ny = Math.ceil((size.y + 2 * margin) / h);
    nz = Math.ceil((size.z + 2 * margin) / h);
  };
  setup();
  while (nx * ny * nz > 2.6e6) {
    h *= 1.12;
    setup();
  }
  const ox = box.min.x - margin;
  const oy = box.min.y - margin;
  const oz = box.min.z - margin;
  const NX = nx + 1;
  const NY = ny + 1;
  const NZ = nz + 1;
  const field = new Float32Array(NX * NY * NZ);

  // Évaluation du champ
  const boneD = new Float64Array(nb).fill(1e9);
  const boneK = new Float64Array(nb);
  const touched = new Int32Array(nb);
  let lastPrim = -1;
  const evalField = (x, y, z, list, len, relief) => {
    let nt = 0;
    let best = 1e9;
    let bestP = -1;
    for (let li = 0; li < len; li++) {
      const P = prims[list[li]];
      const m = P.inv;
      const lx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ly = m[1] * x + m[5] * y + m[9] * z + m[13];
      const lz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const d = primDist(P.t, P.a, lx, ly, lz) * P.s;
      const b = P.bi;
      const cur = boneD[b];
      if (P.carve) {
        // soustraction douce (la paroi creusée devient la surface la plus proche)
        if (cur < 1e8) {
          const sm = -smin(-cur, d, P.k * (P.kind === 0 ? 0.3 : 0.6));
          boneD[b] = sm;
          if (-d > cur - 0.004 && sm > best - 1e-4) {
            best = sm;
            bestP = list[li];
          }
        }
        continue;
      }
      if (d < best) {
        best = d;
        bestP = list[li];
      }
      if (cur > 1e8) {
        touched[nt++] = b;
        boneD[b] = d;
        boneK[b] = P.k;
      } else {
        const k = boneK[b] < P.k ? boneK[b] : P.k;
        boneK[b] = k;
        boneD[b] = smin(cur, d, k);
      }
    }
    let res = 1e9;
    for (let i = 0; i < nt; i++) {
      const b = touched[i];
      const db = boneD[b];
      if (db < res) res = db;
      const p = effParent[b];
      if (p >= 0 && boneD[p] < 1e8) {
        const sm = smin(db, boneD[p], boneK[b] < boneK[p] ? boneK[b] : boneK[p]);
        if (sm < res) res = sm;
      }
    }
    for (let i = 0; i < nt; i++) boneD[touched[i]] = 1e9;
    lastPrim = bestP;
    if (relief && bestP >= 0 && res < 3 * h && res > -3 * h) {
      const R = RELIEF[prims[bestP].kind];
      if (R) {
        const f = Math.min(R[1] / sizeScale, 0.33 / h);
        const n = vnoise(x * f + 17.3, y * f * R[2], z * f + 5.1) * 0.7 + vnoise(x * f * 2.1, y * f * 2.1 * R[2] + 3.7, z * f * 2.1) * 0.3;
        res += (n - 0.5) * 2 * R[0] * sizeScale;
      }
    }
    return res;
  };

  // Blocs : liste des primitives proches (sphères englobantes)
  const B = 8;
  const bxN = Math.ceil(NX / B);
  const byN = Math.ceil(NY / B);
  const bzN = Math.ceil(NZ / B);
  const blockLists = new Array(bxN * byN * bzN);
  const blockFlat = new Uint8Array(bxN * byN * bzN);
  const reach = kmax + 2 * h + reliefMax;
  const tmpList = new Int32Array(prims.length);
  for (let bz = 0; bz < bzN; bz++) {
    for (let by = 0; by < byN; by++) {
      for (let bx = 0; bx < bxN; bx++) {
        const i0 = bx * B;
        const j0 = by * B;
        const k0 = bz * B;
        const i1 = Math.min(NX - 1, i0 + B);
        const j1 = Math.min(NY - 1, j0 + B);
        const k1 = Math.min(NZ - 1, k0 + B);
        const cx = ox + ((i0 + i1) / 2) * h;
        const cy = oy + ((j0 + j1) / 2) * h;
        const cz = oz + ((k0 + k1) / 2) * h;
        const brad = (Math.hypot(i1 - i0, j1 - j0, k1 - k0) * h) / 2;
        let n = 0;
        for (let pi = 0; pi < prims.length; pi++) {
          const P = prims[pi];
          const dc = Math.hypot(cx - P.cx, cy - P.cy, cz - P.cz);
          if (dc - P.r - brad <= reach) tmpList[n++] = pi;
        }
        const list = n ? tmpList.slice(0, n) : null;
        blockLists[bx + bxN * (by + byN * bz)] = list;
        // Bloc loin de la surface (champ lipschitzien) : valeur uniforme, pas d'évaluation fine
        let fill = list ? null : 1e3;
        if (list) {
          const dc = evalField(cx, cy, cz, list, n, false);
          if (Math.abs(dc) > brad + reliefMax + 1.5 * h) fill = dc;
        }
        if (fill !== null) {
          blockFlat[bx + bxN * (by + byN * bz)] = 1;
          for (let k = k0; k < Math.min(NZ, k0 + B); k++) {
            for (let j = j0; j < Math.min(NY, j0 + B); j++) {
              const idx = i0 + NX * (j + NY * k);
              field.fill(fill, idx, idx + Math.min(B, NX - i0));
            }
          }
          continue;
        }
        for (let k = k0; k < Math.min(NZ, k0 + B); k++) {
          for (let j = j0; j < Math.min(NY, j0 + B); j++) {
            let idx = i0 + NX * (j + NY * k);
            for (let i = i0; i < Math.min(NX, i0 + B); i++, idx++) {
              field[idx] = evalField(ox + i * h, oy + j * h, oz + k * h, list, n, true);
            }
          }
        }
      }
    }
  }
  const listAt = (x, y, z) => {
    const i = clamp(Math.floor((x - ox) / h / B), 0, bxN - 1);
    const j = clamp(Math.floor((y - oy) / h / B), 0, byN - 1);
    const k = clamp(Math.floor((z - oz) / h / B), 0, bzN - 1);
    return blockLists[i + bxN * (j + byN * k)];
  };

  const T1 = performance.now();
  // ---------- Surface nets ----------
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const vx = [];
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  const cv = new Float64Array(8);
  // Cellules à examiner : seulement dans les blocs non uniformes (et leurs bords)
  const cellsToVisit = [];
  for (let bz = 0; bz < bzN; bz++) {
    for (let by = 0; by < byN; by++) {
      for (let bx = 0; bx < bxN; bx++) {
        let flat = true;
        for (let dz = 0; dz <= 1 && flat; dz++) for (let dy = 0; dy <= 1 && flat; dy++) for (let dx = 0; dx <= 1 && flat; dx++) {
          const X = bx + dx, Y = by + dy, Z = bz + dz;
          if (X < bxN && Y < byN && Z < bzN && !blockFlat[X + bxN * (Y + byN * Z)]) flat = false;
        }
        if (!flat) cellsToVisit.push(bx, by, bz);
      }
    }
  }
  for (let q = 0; q < cellsToVisit.length; q += 3) {
    const i0 = cellsToVisit[q] * B;
    const j0 = cellsToVisit[q + 1] * B;
    const k0 = cellsToVisit[q + 2] * B;
    for (let k = k0; k < Math.min(nz, k0 + B); k++) {
    for (let j = j0; j < Math.min(ny, j0 + B); j++) {
      for (let i = i0; i < Math.min(nx, i0 + B); i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[i + (c & 1) + NX * (j + ((c >> 1) & 1) + NY * (k + ((c >> 2) & 1)))];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e];
          const b = EDGES[e + 1];
          const va = cv[a];
          const vb = cv[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + ((b & 1) - (a & 1)) * t;
          sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t;
          sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t;
          cnt++;
        }
        cellVert[i + nx * (j + ny * k)] = vx.length / 3;
        vx.push(ox + (i + sx / cnt) * h, oy + (j + sy / cnt) * h, oz + (k + sz / cnt) * h);
      }
    }
    }
  }
  const nv = vx.length / 3;
  if (nv < 8) return null;
  const pos = new Float32Array(vx);
  const tris = [];
  const quad = (a, b, c, d, nxw, nyw, nzw) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    // orientation : la normale du quad suit la sortie du volume
    const ax = pos[b * 3] - pos[a * 3];
    const ay = pos[b * 3 + 1] - pos[a * 3 + 1];
    const az = pos[b * 3 + 2] - pos[a * 3 + 2];
    const bx = pos[c * 3] - pos[a * 3];
    const by = pos[c * 3 + 1] - pos[a * 3 + 1];
    const bz = pos[c * 3 + 2] - pos[a * 3 + 2];
    const flip = (ay * bz - az * by) * nxw + (az * bx - ax * bz) * nyw + (ax * by - ay * bx) * nzw < 0;
    if (flip) {
      const t = b;
      b = d;
      d = t;
    }
    const d1 = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
    const d2 = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
    if (d1 <= d2) tris.push(a, b, c, a, c, d);
    else tris.push(a, b, d, b, c, d);
  };
  const cell = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : cellVert[i + nx * (j + ny * k)]);
  for (let q = 0; q < cellsToVisit.length; q += 3) {
    const i0 = cellsToVisit[q] * B;
    const j0 = cellsToVisit[q + 1] * B;
    const k0 = cellsToVisit[q + 2] * B;
    for (let k = k0; k < Math.min(NZ, k0 + B); k++) {
      for (let j = j0; j < Math.min(NY, j0 + B); j++) {
        for (let i = i0; i < Math.min(NX, i0 + B); i++) {
          const v0 = field[i + NX * (j + NY * k)];
          const in0 = v0 < 0;
          if (i < nx) {
            const v1 = field[i + 1 + NX * (j + NY * k)];
            if (in0 !== v1 < 0) quad(cell(i, j - 1, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i, j - 1, k), in0 ? 1 : -1, 0, 0);
          }
          if (j < ny) {
            const v1 = field[i + NX * (j + 1 + NY * k)];
            if (in0 !== v1 < 0) quad(cell(i - 1, j, k - 1), cell(i, j, k - 1), cell(i, j, k), cell(i - 1, j, k), 0, in0 ? 1 : -1, 0);
          }
          if (k < nz) {
            const v1 = field[i + NX * (j + NY * (k + 1))];
            if (in0 !== v1 < 0) quad(cell(i - 1, j - 1, k), cell(i, j - 1, k), cell(i, j, k), cell(i - 1, j, k), 0, 0, in0 ? 1 : -1);
          }
        }
      }
    }
  }

  const T2 = performance.now();
  // ---------- Reprojection, normales, matières, poids ----------
  const nrm = new Float32Array(nv * 3);
  const si = new Uint8Array(nv * 4);
  const sw = new Uint8Array(nv * 4);
  const pa = new Uint16Array(nv);
  const pb = new Uint16Array(nv);
  const bl = new Uint8Array(nv);
  const eps = h * 0.5;
  const sigma = Math.max(1.5 * h, 0.018 * sizeScale);
  const bdist = new Float64Array(nb);
  const cand = new Int32Array(8);
  const cw = new Float64Array(8);
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3];
    let y = pos[v * 3 + 1];
    let z = pos[v * 3 + 2];
    const list = listAt(x, y, z);
    if (!list) continue;
    // Reprojection sur la surface (arêtes plus nettes) ; le gradient sert aussi de normale
    const d0 = evalField(x, y, z, list, list.length, true);
    let gx = evalField(x + eps, y, z, list, list.length, true) - d0;
    let gy = evalField(x, y + eps, z, list, list.length, true) - d0;
    let gz = evalField(x, y, z + eps, list, list.length, true) - d0;
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    const step = clamp(d0, -h * 0.6, h * 0.6);
    x -= gx * step;
    y -= gy * step;
    z -= gz * step;
    pos[v * 3] = x;
    pos[v * 3 + 1] = y;
    pos[v * 3 + 2] = z;
    nrm[v * 3] = gx;
    nrm[v * 3 + 1] = gy;
    nrm[v * 3 + 2] = gz;
    // Matière : pièce la plus proche et sa voisine (fondu des couleurs aux jonctions)
    bdist.fill(1e9);
    let dA = 1e9;
    let dB = 1e9;
    let A = -1;
    let Bp = -1;
    let carveHit = -1;
    let carveD = 1e9;
    for (let li = 0; li < list.length; li++) {
      const P = prims[list[li]];
      const m = P.inv;
      const lx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const ly = m[1] * x + m[5] * y + m[9] * z + m[13];
      const lz = m[2] * x + m[6] * y + m[10] * z + m[14];
      const d = primDist(P.t, P.a, lx, ly, lz) * P.s;
      if (P.carve) {
        if (Math.abs(d) < carveD) {
          carveD = Math.abs(d);
          carveHit = list[li];
        }
        continue;
      }
      if (d < dA) {
        if (A >= 0 && prims[A].pi !== P.pi) {
          dB = dA;
          Bp = A;
        }
        dA = d;
        A = list[li];
      } else if (d < dB && prims[A].pi !== P.pi) {
        dB = d;
        Bp = list[li];
      }
      if (d < bdist[P.bi]) bdist[P.bi] = d;
    }
    if (A < 0) A = list[0];
    // Paroi creusée : couleur / matière du creusement (fondu sur le bord)
    const cw0 = Math.max(0.6 * h, 0.005);
    if (carveHit >= 0 && carveD < cw0 && dA < cw0) {
      pa[v] = prims[carveHit].pi;
      pb[v] = prims[A].pi;
      bl[v] = Math.round(clamp(carveD / cw0, 0, 1) * 0.5 * 510);
    } else {
      pa[v] = prims[A].pi;
      pb[v] = Bp >= 0 ? prims[Bp].pi : prims[A].pi;
      bl[v] = Bp >= 0 ? Math.round(clamp(0.5 - (dB - dA) / (0.024 * sizeScale), 0, 0.5) * 510) : 0;
    }
    // Poids : os dominant + parent / enfants effectifs, selon la distance
    let b0 = 0;
    for (let b = 1; b < nb; b++) if (bdist[b] < bdist[b0]) b0 = b;
    let nc = 0;
    cand[nc++] = b0;
    if (effParent[b0] >= 0 && bdist[effParent[b0]] < 1e8) cand[nc++] = effParent[b0];
    for (let b = 0; b < nb && nc < 8; b++) if (effParent[b] === b0 && bdist[b] < 1e8) cand[nc++] = b;
    let tot = 0;
    for (let c = 0; c < nc; c++) {
      cw[c] = Math.exp(-(bdist[cand[c]] - bdist[b0]) / sigma);
      tot += cw[c];
    }
    // 4 plus forts
    const order = Array.from({ length: nc }, (_, c) => c).sort((p, q) => cw[q] - cw[p]).slice(0, 4);
    let tot4 = 0;
    for (const c of order) tot4 += cw[c];
    // Quantification sur 255 : la somme reste exacte (le plus fort absorbe l'arrondi)
    const q = order.map((c) => Math.round((cw[c] / tot4) * 255));
    let sum = 0;
    for (const w of q) sum += w;
    q[0] = Math.max(0, q[0] + 255 - sum);
    order.forEach((c, n) => {
      si[v * 4 + n] = cand[c];
      sw[v * 4 + n] = q[n];
    });
    if (tot === 0) {
      si[v * 4] = b0;
      sw[v * 4] = 255;
    }
  }

  const T3 = performance.now();
  // ---------- Compression ----------
  const bmin = [Infinity, Infinity, Infinity];
  const bmax = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < nv; v++) {
    for (let c = 0; c < 3; c++) {
      const p = pos[v * 3 + c];
      if (p < bmin[c]) bmin[c] = p;
      if (p > bmax[c]) bmax[c] = p;
    }
  }
  const bsize = bmax.map((m, c) => Math.max(1e-6, m - bmin[c]));
  const qp = new Uint16Array(nv * 3);
  const qn = new Int8Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    for (let c = 0; c < 3; c++) {
      qp[v * 3 + c] = Math.round(((pos[v * 3 + c] - bmin[c]) / bsize[c]) * 65535);
      qn[v * 3 + c] = Math.round(clamp(nrm[v * 3 + c], -1, 1) * 127);
    }
  }
  const idx = nv > 65535 ? new Uint32Array(tris) : new Uint16Array(tris);
  const rec = { n: nv, bmin, bsize, pos: qp, nrm: qn, si, sw, pa, pb, bl, idx, acc: new Uint16Array(acc), nParts: parts.length, h };
  rec.timing = [Math.round(T1 - T0), Math.round(T2 - T1), Math.round(T3 - T2), nx * ny * nz];
  rec.bytes = qp.byteLength + qn.byteLength + si.byteLength + sw.byteLength + pa.byteLength + pb.byteLength + bl.byteLength + idx.byteLength + rec.acc.byteLength;
  return rec;
}

// ---------- Géométrie d'exécution à partir d'une sculpture installée ----------
// Les couleurs et matières viennent des pièces du modèle (variantes de couleurs possibles)
export function sculptGeometry(rec, parts) {
  const n = rec.n;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const am = new Float32Array(n * 4);
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  const pc = parts.map((p) => {
    _c.set(p.color);
    return [_c.r, _c.g, _c.b];
  });
  for (let v = 0; v < n; v++) {
    for (let c = 0; c < 3; c++) {
      pos[v * 3 + c] = rec.bmin[c] + (rec.pos[v * 3 + c] / 65535) * rec.bsize[c];
      nrm[v * 3 + c] = rec.nrm[v * 3 + c] / 127;
    }
    const A = rec.pa[v];
    const Bp = rec.pb[v];
    const t = rec.bl[v] / 510;
    const ca = pc[A] || pc[0];
    const cb = pc[Bp] || ca;
    col[v * 3] = ca[0] + (cb[0] - ca[0]) * t;
    col[v * 3 + 1] = ca[1] + (cb[1] - ca[1]) * t;
    col[v * 3 + 2] = ca[2] + (cb[2] - ca[2]) * t;
    const sa = (parts[A] || parts[0]).surf;
    const sb = (parts[Bp] || parts[A] || parts[0]).surf;
    am[v * 4] = sa[0] + (sb[0] - sa[0]) * t;
    am[v * 4 + 1] = sa[1] + (sb[1] - sa[1]) * t;
    am[v * 4 + 2] = sa[2] + (sb[2] - sa[2]) * t;
    am[v * 4 + 3] = sa[3] ?? (sa[2] > 0.3 ? 0 : sa[1] > 0.5 ? 1 : 0);
    for (let c = 0; c < 4; c++) {
      si[v * 4 + c] = rec.si[v * 4 + c];
      sw[v * 4 + c] = rec.sw[v * 4 + c] / 255;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMat', new THREE.BufferAttribute(am, 4));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(new THREE.BufferAttribute(rec.idx, 1));
  return geo;
}
