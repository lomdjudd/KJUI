// Bâtiments et décors fixes, fusionnés par matériau (très peu de draw calls) :
// autels, portail, mausolées, chapelle, château gothique aux fenêtres vertes, catacombes,
// huttes sur pilotis, temple gelé, autels démoniaques, citadelle du Néant…
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Mats } from '../gfx/materials.js';
import { makeRng } from '../core/utils.js';

const PI = Math.PI;

const MAT = {
  stone: () => Mats.stone(),
  darkStone: () => Mats.darkStone(),
  tiles: () => Mats.tiles(),
  cobble: () => Mats.cobble(),
  rock: () => Mats.rock(),
  wood: () => Mats.wood(),
  bark: () => Mats.bark(),
  iron: () => Mats.iron(),
  gold: () => Mats.gold(),
  bone: () => Mats.bone(),
  clothPurple: () => Mats.cloth(0x3a1450),
  clothRed: () => Mats.cloth(0x5a0a14),
  clothGreen: () => Mats.cloth(0x1a3a1a),
  clothTan: () => Mats.cloth(0x5a4a34),
  glowGreen: () => Mats.glow(0x39ff6a, 3),
  glowPurple: () => Mats.glow(0x9a4dff, 3),
  glowOrange: () => Mats.glow(0xff8a2a, 3),
  glowBlue: () => Mats.glow(0x7ad4ff, 2.5),
  glowRed: () => Mats.glow(0xff2a2a, 3),
  crystal: () => Mats.crystal(0x9a4dff),
  crystalBlue: () => Mats.crystal(0x7ad4ff),
  ice: () => Mats.ice(),
  snow: () => Mats.snow(),
  lava: () => Mats.lava(),
};

// Boîte dont les UV suivent les dimensions réelles (textures non étirées)
function uvBox(w, h, d, ts = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts);
  }
  return g;
}
function uvCyl(rt, rb, h, seg = 10, ts = 2, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv;
  const circ = (2 * PI * Math.max(rt, rb)) / ts;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h / ts);
  return g;
}
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
function place(g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
  g.applyMatrix4(_m);
  return g;
}
function clean(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.index) {
    const n = g.attributes.position.count;
    g.setIndex([...Array(n).keys()]);
  }
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

export class StructureBuilder {
  constructor(colliders, terrain, seed) {
    this.col = colliders;
    this.t = terrain;
    this.rng = makeRng(seed);
    this.buckets = new Map();
    this.lights = [];
    this.fires = [];
  }

  add(mat, geo) {
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(clean(geo));
  }

  // Repère local (x, z, rotation) pour construire un bâtiment
  frame(x, z, rot = 0, y = null) {
    const baseY = y ?? this.t.heightAt(x, z);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const w = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    const self = this;
    return {
      y: baseY,
      w,
      box(mat, lx, ly, lz, bw, bh, bd, o = {}) {
        const [wx, wz] = w(lx, lz);
        const r = rot + (o.ry || 0);
        self.add(mat, place(uvBox(bw, bh, bd, o.ts || 2), wx, baseY + ly + bh / 2, wz, o.rx || 0, r, o.rz || 0));
        if (o.collide !== false) self.col.addBox(wx, wz, bw / 2, bd / 2, r, baseY + ly - 0.5, baseY + ly + bh);
      },
      cyl(mat, lx, ly, lz, rt, rb, h, seg = 10, o = {}) {
        const [wx, wz] = w(lx, lz);
        self.add(mat, place(uvCyl(rt, rb, h, seg, o.ts || 2, o.open), wx, baseY + ly + h / 2, wz, o.rx || 0, rot + (o.ry || 0), o.rz || 0));
        if (o.collide !== false) self.col.addCircle(wx, wz, Math.max(rt, rb), baseY + ly - 0.5, baseY + ly + h);
      },
      cone(mat, lx, ly, lz, r, h, seg = 8, o = {}) {
        const [wx, wz] = w(lx, lz);
        self.add(mat, place(new THREE.ConeGeometry(r, h, seg), wx, baseY + ly + h / 2, wz, o.rx || 0, rot + (o.ry || 0), o.rz || 0));
        if (o.collide) self.col.addCircle(wx, wz, r * 0.8, baseY + ly - 0.5, baseY + ly + h);
      },
      geo(mat, g, lx, ly, lz, o = {}) {
        const [wx, wz] = w(lx, lz);
        self.add(mat, place(g, wx, baseY + ly, wz, o.rx || 0, rot + (o.ry || 0), o.rz || 0, o.s || 1));
      },
      light(lx, ly, lz, color, intensity = 20, dist = 12, flicker = 1) {
        const [wx, wz] = w(lx, lz);
        self.lights.push({ x: wx, y: baseY + ly, z: wz, color, intensity, dist, flicker });
      },
      fire(lx, ly, lz, scale = 1, color = 0xff7a2a) {
        const [wx, wz] = w(lx, lz);
        self.fires.push({ x: wx, y: baseY + ly, z: wz, scale, color });
      },
    };
  }

  // ---------------- Éléments ----------------
  altar(x, z) {
    const f = this.frame(x, z, 0);
    f.cyl('darkStone', 0, 0, 0, 1.3, 1.5, 0.35, 12, { collide: false });
    f.cyl('stone', 0, 0.35, 0, 0.7, 0.85, 0.5, 8);
    f.cyl('stone', 0, 0.85, 0, 0.9, 0.7, 0.15, 8, { collide: false });
    // Épée plantée
    f.box('iron', 0, 0.9, 0, 0.07, 1.1, 0.02, { collide: false, ry: 0.4 });
    f.box('gold', 0, 1.95, 0, 0.35, 0.06, 0.06, { collide: false, ry: 0.4 });
    f.box('clothRed', 0, 2.0, 0, 0.05, 0.25, 0.05, { collide: false, ry: 0.4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI * 2;
      f.box('stone', Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9, 0.35, 0.6 + (i % 2) * 0.4, 0.35, { collide: false, ry: a });
    }
    f.fire(0, 1.1, 0, 1.2, 0xff8a3a);
    f.light(0, 1.8, 0, 0xff8a3a, 26, 14, 1);
  }

  brazier(x, z, color = 0xff7a2a, h = 1.1) {
    const f = this.frame(x, z, 0);
    f.cyl('iron', 0, 0, 0, 0.08, 0.12, h, 6);
    f.cyl('iron', 0, h, 0, 0.45, 0.25, 0.35, 8, { collide: false });
    f.fire(0, h + 0.4, 0, 0.9, color);
    f.light(0, h + 1, 0, color, 18, 11, 1);
  }

  lantern(x, z, color = 0x9affb0) {
    const f = this.frame(x, z, this.rng() * PI);
    f.cyl('iron', 0, 0, 0, 0.06, 0.08, 2.8, 6);
    f.box('iron', 0.3, 2.7, 0, 0.7, 0.06, 0.06, { collide: false });
    f.box('iron', 0.55, 2.2, 0, 0.22, 0.35, 0.22, { collide: false });
    f.box(color === 0x9affb0 ? 'glowGreen' : 'glowOrange', 0.55, 2.25, 0, 0.14, 0.24, 0.14, { collide: false });
    f.light(0.55, 2.3, 0, color, 10, 9, 0.5);
  }

  portal(x, z, rot = 0) {
    const f = this.frame(x, z, rot);
    f.cyl('darkStone', 0, 0, 0, 5.5, 6, 0.6, 16, { collide: false });
    f.cyl('stone', 0, 0.6, 0, 4.5, 5, 0.4, 16, { collide: false });
    const ring = new THREE.TorusGeometry(4, 0.55, 8, 32);
    f.geo('stone', ring, 0, 5, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2;
      const g = new THREE.OctahedronGeometry(0.3);
      f.geo('glowPurple', g, Math.cos(a) * 4, 5 + Math.sin(a) * 4, 0.5);
    }
    this.col.addCircle(f.w(-4, 0)[0], f.w(-4, 0)[1], 0.8, f.y, f.y + 9);
    this.col.addCircle(f.w(4, 0)[0], f.w(4, 0)[1], 0.8, f.y, f.y + 9);
    f.light(0, 5, 1.5, 0x9a4dff, 30, 16, 0.3);
    return { x, z, y: f.y + 5, rot };
  }

  gate(x, z, rot = 0, mat = 'stone') {
    const f = this.frame(x, z, rot);
    f.box(mat, -3.2, 0, 0, 1.2, 6, 1.2);
    f.box(mat, 3.2, 0, 0, 1.2, 6, 1.2);
    f.box(mat, 0, 6, 0, 7.8, 1.2, 1.4, { collide: false });
    f.cone('darkStone', -3.2, 6, 0, 0.9, 2.2, 4);
    f.cone('darkStone', 3.2, 6, 0, 0.9, 2.2, 4);
    f.box('iron', 0, 7.2, 0, 1.2, 1.2, 0.3, { collide: false });
    f.light(0, 4.5, 1.5, 0x9affb0, 8, 10, 0.6);
  }

  fenceLine(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az) + PI / 2;
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = this.t.heightAt(x, z);
      this.add('iron', place(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), x, y + 0.9, z));
      this.add('iron', place(new THREE.ConeGeometry(0.07, 0.25, 4), x, y + 1.9, z));
      if (i < n) {
        const x2 = ax + (bx - ax) * (t + 0.5 / n);
        const z2 = az + (bz - az) * (t + 0.5 / n);
        const y2 = this.t.heightAt(x2, z2);
        for (const hh of [0.4, 1.4]) this.add('iron', place(new THREE.BoxGeometry(len / n, 0.05, 0.05), x2, y2 + hh, z2, 0, rot));
        for (let k = 1; k < 4; k++) {
          const tt = t + k / (4 * n);
          const x3 = ax + (bx - ax) * tt;
          const z3 = az + (bz - az) * tt;
          const y3 = this.t.heightAt(x3, z3);
          this.add('iron', place(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 3), x3, y3 + 0.85, z3));
        }
      }
    }
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    this.col.addBox(cx, cz, len / 2, 0.15, rot, this.t.heightAt(cx, cz) - 1, this.t.heightAt(cx, cz) + 2);
  }

  wallLine(ax, az, bx, bz, h = 5, mat = 'stone', crenel = true, gap = null) {
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az) + PI / 2;
    const segs = Math.max(1, Math.round(len / 8));
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const tm = (t0 + t1) / 2;
      const x = ax + (bx - ax) * tm;
      const z = az + (bz - az) * tm;
      if (gap && Math.hypot(x - gap.x, z - gap.z) < gap.r) continue;
      const y = this.t.heightAt(x, z) - 1;
      const sl = len / segs;
      this.add(mat, place(uvBox(sl + 0.05, h + 1, 1.4, 2.5), x, y + (h + 1) / 2, z, 0, rot));
      this.col.addBox(x, z, sl / 2, 0.7, rot, y, y + h + 1);
      if (crenel) {
        for (let k = 0; k < 4; k++) {
          const tk = t0 + ((k + 0.5) / 4) * (t1 - t0);
          const xk = ax + (bx - ax) * tk;
          const zk = az + (bz - az) * tk;
          this.add(mat, place(uvBox(0.9, 0.8, 1.5, 2.5), xk, y + h + 1.4, zk, 0, rot));
        }
      }
    }
  }

  tower(x, z, r = 3, h = 14, windows = 'glowGreen', roofMat = 'darkStone') {
    const f = this.frame(x, z, this.rng() * PI);
    f.cyl('stone', 0, -1, 0, r, r * 1.08, h + 1, 12, { ts: 2.5 });
    f.cyl('darkStone', 0, h, 0, r * 1.18, r * 1.18, 0.8, 12, { collide: false });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * PI * 2;
      f.box('stone', Math.cos(a) * r * 1.1, h + 0.8, Math.sin(a) * r * 1.1, 0.8, 0.8, 0.8, { collide: false, ry: -a });
    }
    f.cone(roofMat, 0, h + 0.8, 0, r * 1.25, h * 0.55, 12);
    if (windows) {
      for (let k = 0; k < 6; k++) {
        const a = this.rng() * PI * 2;
        const wy = 2 + this.rng() * (h - 4);
        f.box(windows, Math.cos(a) * (r + 0.02), wy, Math.sin(a) * (r + 0.02), 0.5, 1.3, 0.1, { collide: false, ry: -a + PI / 2 });
      }
      f.light(0, h * 0.6, 0, windows === 'glowGreen' ? 0x39ff6a : windows === 'glowPurple' ? 0x9a4dff : 0xff8a2a, 14, 14, 0.15);
    }
  }

  mausoleum(x, z, rot, big = false, doorGlow = null) {
    const s = big ? 1.5 : 1;
    const f = this.frame(x, z, rot);
    f.box('stone', 0, -0.5, 0, 5 * s, 0.9, 6 * s);
    f.box('stone', 0, 0.4, -0.3 * s, 4 * s, 3.6 * s, 4.6 * s);
    for (const cx of [-1.6, 1.6]) f.cyl('stone', cx * s, 0.4, 2.3 * s, 0.25 * s, 0.3 * s, 3.4 * s, 8);
    f.box('stone', 0, 0.4 + 3.4 * s, 1.0 * s, 4.4 * s, 0.4, 3.2 * s, { collide: false });
    const roof = new THREE.CylinderGeometry(0.01, 3.0 * s, 1.6 * s, 3, 1);
    roof.rotateZ(PI / 2);
    roof.rotateY(PI / 2);
    roof.scale(1, 1, 1.9);
    f.geo('darkStone', roof, 0, 0.4 + 3.8 * s + 0.6 * s, 0);
    f.box(doorGlow || 'darkStone', 0, 0.4, 2.0 * s + 0.02, 1.4 * s, 2.4 * s, 0.1, { collide: false });
    f.box('stone', 0, 0.4 + 5.2 * s, 2.2 * s, 0.15, 0.9, 0.15, { collide: false });
    f.box('stone', 0, 0.4 + 5.6 * s, 2.2 * s, 0.6, 0.15, 0.15, { collide: false });
    if (doorGlow) f.light(0, 1.5, 3 * s, doorGlow === 'glowGreen' ? 0x39ff6a : 0x9a4dff, 14, 10, 0.3);
  }

  chapelRuin(x, z, rot) {
    const f = this.frame(x, z, rot);
    f.box('stone', 0, -0.3, 0, 12, 0.4, 20, { collide: false });
    // Murs percés
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const lz = -8 + i * 5.3;
        const h = [6, 4.5, 7, 3][i];
        f.box('stone', side * 5.8, 0, lz, 0.9, h, 3.2);
        f.box('glowGreen', side * 5.4, 2.5, lz + 2.2, 0.05, 2.2, 0.8, { collide: false });
      }
    }
    f.box('stone', -3.5, 0, -10, 4, 8, 0.9);
    f.box('stone', 3.5, 0, -10, 4, 6, 0.9);
    f.box('stone', 0, 8, -10, 3, 1.5, 0.9, { collide: false });
    f.box('glowGreen', 0, 4.5, -9.5, 1.4, 3, 0.05, { collide: false });
    // Colonnes cassées
    for (const [cx, cz, h] of [[-3, -4, 5], [3, -4, 2.5], [-3, 2, 3.5], [3, 2, 6], [-3, 7, 1.5], [3, 7, 4]]) f.cyl('stone', cx, 0, cz, 0.35, 0.4, h, 8);
    // Poutres effondrées
    f.box('wood', 1, 0, 3, 0.3, 0.3, 6, { collide: false, rz: 0.3, rx: 0.2 });
    f.box('wood', -2, 0.3, -2, 0.3, 0.3, 7, { collide: false, ry: 0.5, rx: -0.15 });
    f.light(0, 4.5, -8, 0x39ff6a, 12, 12, 0.2);
  }

  bigCross(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    f.box('stone', 0, 0, 0, 0.5, 5, 0.5);
    f.box('stone', 0, 3.2, 0, 2.4, 0.5, 0.5, { collide: false });
    f.box('stone', 0, -0.3, 0, 1.4, 0.6, 1.4);
  }

  well(x, z) {
    const f = this.frame(x, z, 0);
    f.cyl('stone', 0, 0, 0, 1.3, 1.4, 1, 12);
    f.cyl('darkStone', 0, 0.95, 0, 1.05, 1.05, 0.06, 12, { collide: false });
    f.box('wood', -1.1, 0, 0, 0.18, 2.8, 0.18, { collide: false });
    f.box('wood', 1.1, 0, 0, 0.18, 2.8, 0.18, { collide: false });
    f.box('wood', 0, 2.7, 0, 2.6, 0.18, 0.18, { collide: false });
    f.box('glowGreen', 0, 0.9, 0, 1.6, 0.05, 1.6, { collide: false });
    f.light(0, 1.5, 0, 0x39ff6a, 12, 8, 0.4);
  }

  ossuary(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    for (let i = 0; i < 18; i++) {
      const a = this.rng() * PI * 2;
      const r = this.rng() * 3;
      f.geo('bone', new THREE.SphereGeometry(0.25, 7, 5), Math.cos(a) * r, 0.2 + this.rng() * 0.5, Math.sin(a) * r);
    }
    for (let i = 0; i < 25; i++) {
      const a = this.rng() * PI * 2;
      const r = this.rng() * 3.5;
      f.geo('bone', new THREE.CylinderGeometry(0.06, 0.06, 1, 4), Math.cos(a) * r, 0.2, Math.sin(a) * r, { rx: PI / 2, ry: this.rng() * 3 });
    }
    f.box('stone', 0, 0, -4, 6, 3.5, 0.8);
    f.box('stone', -3, 0, -2, 0.8, 3.5, 4);
    this.col.addCircle(x, z, 2.2, f.y - 1, f.y + 1.2);
  }

  arenaRing(x, z, r, style = 'stone') {
    const n = Math.max(8, Math.round(r * 0.8));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      const px = x + Math.cos(a) * (r + 1.5);
      const pz = z + Math.sin(a) * (r + 1.5);
      const f = this.frame(px, pz, -a);
      if (style === 'ice') f.cone('ice', 0, 0, 0, 0.7, 4 + this.rng() * 3, 5, { collide: true });
      else if (style === 'crystal') f.geo('crystal', new THREE.OctahedronGeometry(0.8), 0, 2, 0, { s: 1.4 });
      else if (style === 'spike') f.cone('darkStone', 0, 0, 0, 0.6, 3 + this.rng() * 2, 5, { collide: true });
      else if (style === 'root') f.geo('bark', new THREE.CylinderGeometry(0.2, 0.5, 4, 5), 0, 1.5, 0, { rx: 0.3, rz: this.rng() - 0.5 });
      else f.box('stone', 0, 0, 0, 0.9, 2 + (i % 3) * 0.8, 0.6, { ts: 1.5 });
      if (i % Math.max(2, Math.round(n / 4)) === 0) {
        const bx = x + Math.cos(a) * (r + 3);
        const bz = z + Math.sin(a) * (r + 3);
        const col = style === 'ice' ? 0x7ad4ff : style === 'crystal' || style === 'void' ? 0xb04dff : style === 'root' ? 0x9aff5a : 0xff7a2a;
        this.brazier(bx, bz, col);
      }
    }
  }

  house(x, z, rot, ruined = true) {
    const f = this.frame(x, z, rot);
    const w = 7;
    const d = 6;
    f.box('stone', 0, -0.4, 0, w + 0.4, 0.5, d + 0.4, { collide: false });
    f.box('stone', 0, 0, -d / 2, w, ruined ? 3.5 : 4, 0.6);
    f.box('stone', -w / 2, 0, 0, 0.6, 4, d);
    f.box('stone', w / 2, 0, 0.8, 0.6, ruined ? 2.2 : 4, d - 1.6);
    f.box('stone', -2, 0, d / 2, 3, 4, 0.6);
    f.box('stone', 2.6, 0, d / 2, 1.8, ruined ? 1.6 : 4, 0.6);
    f.box('wood', 0.3, 0, d / 2 + 0.02, 1.3, 2.4, 0.1, { collide: false });
    if (!ruined) {
      const roof = new THREE.CylinderGeometry(0.01, 4.8, 2.6, 4, 1);
      roof.rotateY(PI / 4);
      roof.scale(1.05, 1, 0.9);
      f.geo('darkStone', roof, 0, 5.3, 0);
      f.box('glowOrange', -w / 2 - 0.02, 1.6, 0, 0.05, 1, 0.8, { collide: false });
    } else {
      f.box('wood', 0, 3.2, 0, 0.25, 0.25, d + 1, { collide: false, rx: 0.3 });
      f.box('wood', 1.5, 2.6, 0, 0.25, 0.25, d, { collide: false, rx: -0.4, ry: 0.2 });
    }
  }

  forge(x, z, rot) {
    const f = this.frame(x, z, rot);
    f.box('stone', 0, -0.3, 0, 9, 0.4, 7, { collide: false });
    for (const [px, pz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) f.box('wood', px, 0, pz, 0.35, 4.2, 0.35);
    const roof = new THREE.CylinderGeometry(0.01, 6, 2.2, 4, 1);
    roof.rotateY(PI / 4);
    roof.scale(1.1, 1, 0.85);
    f.geo('wood', roof, 0, 5.2, 0);
    // Four
    f.box('stone', -2.5, 0, -2.5, 3, 2.4, 2);
    f.box('glowOrange', -2.5, 0.6, -1.49, 1.4, 0.9, 0.05, { collide: false });
    f.cyl('stone', -2.5, 2.4, -2.8, 0.6, 0.8, 4, 8, { collide: false });
    f.fire(-2.5, 0.9, -1.8, 0.8, 0xff7a2a);
    f.light(-2.5, 1.5, -1, 0xff7a2a, 30, 12, 1);
    // Enclume
    f.box('darkStone', 1.5, 0, 0.5, 0.8, 0.6, 0.8);
    f.box('iron', 1.5, 0.6, 0.5, 1.1, 0.35, 0.45, { collide: false });
    f.cone('iron', 2.2, 0.62, 0.5, 0.2, 0.5, 4, { rz: -PI / 2 });
    // Râtelier d'armes
    f.box('wood', 3.6, 0, -1.5, 0.3, 1.8, 2.5);
    for (let i = 0; i < 4; i++) f.box('iron', 3.4, 0.3, -2.4 + i * 0.6, 0.05, 1.6, 0.08, { collide: false, rz: 0.15 });
  }

  tent(x, z, rot, mat = 'clothPurple', r = 3) {
    const f = this.frame(x, z, rot);
    f.cone(mat, 0, 0, 0, r, r * 1.3, 8, { collide: true });
    f.cyl('wood', 0, r * 1.2, 0, 0.06, 0.06, 1.2, 4, { collide: false });
    f.box('darkStone', 0, 0, r * 0.75, 1, 1.6, 0.05, { collide: false });
  }

  statue(x, z, rot, h = 4) {
    const f = this.frame(x, z, rot);
    f.box('darkStone', 0, 0, 0, 2.2, 1.4, 2.2);
    // Chevalier stylisé appuyé sur son épée
    f.cyl('stone', 0, 1.4, 0, 0.35, 0.45, h * 0.35, 8, { collide: false });
    f.cyl('stone', 0, 1.4 + h * 0.35, 0, 0.55, 0.4, h * 0.35, 8, { collide: false });
    f.geo('stone', new THREE.SphereGeometry(0.3, 8, 6), 0, 1.4 + h * 0.78, 0);
    f.cone('stone', 0, 1.4 + h * 0.84, 0, 0.3, 0.3, 8);
    f.box('stone', 0, 1.4, 0.7, 0.14, h * 0.55, 0.05, { collide: false });
    f.box('stone', 0, 1.4 + h * 0.52, 0.7, 0.8, 0.1, 0.1, { collide: false });
    f.box('stone', -0.55, 1.4 + h * 0.4, 0.35, 0.2, h * 0.28, 0.2, { collide: false, rx: -0.4 });
    f.box('stone', 0.55, 1.4 + h * 0.4, 0.35, 0.2, h * 0.28, 0.2, { collide: false, rx: -0.4 });
    f.geo('stone', new THREE.SphereGeometry(0.35, 8, 5), 0.6, 1.4 + h * 0.66, 0);
    f.geo('stone', new THREE.SphereGeometry(0.35, 8, 5), -0.6, 1.4 + h * 0.66, 0);
  }

  crates(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    f.box('wood', 0, 0, 0, 1, 1, 1);
    f.box('wood', 1.1, 0, 0.2, 0.9, 0.9, 0.9, { ry: 0.3 });
    f.box('wood', 0.4, 1, 0.1, 0.8, 0.8, 0.8, { ry: 0.6, collide: false });
    f.cyl('wood', -1, 0, 0.8, 0.4, 0.4, 1.1, 10);
  }

  campfire(x, z) {
    const f = this.frame(x, z, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      f.geo('rock', new THREE.DodecahedronGeometry(0.25), Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8);
    }
    f.box('wood', 0, 0.1, 0, 0.15, 0.15, 1.2, { collide: false, ry: 0.5 });
    f.box('wood', 0, 0.1, 0, 0.15, 0.15, 1.2, { collide: false, ry: -0.6 });
    f.fire(0, 0.3, 0, 1, 0xff7a2a);
    f.light(0, 1, 0, 0xff7a2a, 22, 12, 1);
  }

  cart(x, z, rot) {
    const f = this.frame(x, z, rot);
    f.box('wood', 0, 0.3, 0, 2, 0.8, 3.2, { rz: 1.2 });
    f.cyl('wood', 1, 0, -1, 0.6, 0.6, 0.15, 10, { rz: PI / 2, collide: false });
    f.cyl('wood', -0.6, 0.6, 1.4, 0.6, 0.6, 0.15, 10, { rx: 0.4, collide: false });
    f.box('clothTan', 0, 0.9, 0.5, 1.8, 0.1, 2, { collide: false, rz: 1.2 });
  }

  watchtower(x, z, rot) {
    const f = this.frame(x, z, rot);
    for (const [px, pz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) f.box('wood', px, 0, pz, 0.3, 7, 0.3);
    f.box('wood', 0, 6, 0, 4, 0.3, 4, { collide: false });
    for (const [px, pz, w, d] of [[0, -2, 4, 0.1], [0, 2, 4, 0.1], [-2, 0, 0.1, 4], [2, 0, 0.1, 4]]) f.box('wood', px, 6.3, pz, w, 1, d, { collide: false });
    const roof = new THREE.ConeGeometry(3.2, 2, 4);
    roof.rotateY(PI / 4);
    f.geo('wood', roof, 0, 9, 0);
    f.box('wood', 0, 7.3, -1.8, 0.2, 1.7, 0.2, { collide: false });
    f.box('wood', 0, 7.3, 1.8, 0.2, 1.7, 0.2, { collide: false });
  }

  stoneCircle(x, z, r = 5, glow = 'glowPurple') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2;
      const f = this.frame(x + Math.cos(a) * r, z + Math.sin(a) * r, -a);
      f.box('rock', 0, 0, 0, 1.2, 3 + this.rng() * 1.5, 0.8, { ts: 1.5 });
      f.box(glow, 0, 1.2, 0.41, 0.2, 0.9, 0.02, { collide: false });
    }
    const f = this.frame(x, z, 0);
    f.cyl('rock', 0, 0, 0, 1.2, 1.4, 0.8, 8);
    f.light(0, 2, 0, glow === 'glowPurple' ? 0x9a4dff : 0x39ff6a, 14, 12, 0.3);
  }

  hut(x, z, rot) {
    const f = this.frame(x, z, rot);
    const y0 = Math.max(f.y, 0.2) - f.y + 1.6;
    for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) f.box('wood', px, -1, pz, 0.25, y0 + 1, 0.25);
    f.box('wood', 0, y0, 0, 5, 0.25, 5, { collide: false });
    f.box('wood', 0, y0 + 0.25, -2.3, 4.6, 2.6, 0.2);
    f.box('wood', -2.3, y0 + 0.25, 0, 0.2, 2.6, 4.6);
    f.box('wood', 2.3, y0 + 0.25, 0, 0.2, 2.6, 4.6);
    f.box('wood', -1.4, y0 + 0.25, 2.3, 1.8, 2.6, 0.2);
    f.box('wood', 1.6, y0 + 0.25, 2.3, 1.4, 2.6, 0.2);
    const roof = new THREE.ConeGeometry(4.2, 2.6, 4);
    roof.rotateY(PI / 4);
    f.geo('clothTan', roof, 0, y0 + 4.1, 0);
    f.box('glowGreen', 0.2, y0 + 1.2, 2.41, 0.6, 0.6, 0.02, { collide: false });
    f.light(0, y0 + 1.5, 3, 0x9aff5a, 10, 9, 0.6);
  }

  totem(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    f.cyl('wood', 0, 0, 0, 0.35, 0.45, 5, 7);
    for (let i = 0; i < 3; i++) f.geo('bone', new THREE.SphereGeometry(0.28, 8, 6), 0, 1.6 + i * 1.2, 0.35);
    f.box('wood', 0, 3.8, 0, 2.4, 0.25, 0.25, { collide: false });
    f.box('glowGreen', 0, 4.2, 0, 0.5, 0.5, 0.5, { collide: false, ry: PI / 4 });
    f.light(0, 4.3, 0, 0x9aff5a, 14, 10, 0.6);
  }

  boat(x, z, rot) {
    const f = this.frame(x, z, rot);
    const hull = new THREE.CylinderGeometry(1, 0.6, 4, 8, 1, true, 0, PI);
    hull.rotateX(PI / 2);
    hull.rotateZ(PI);
    f.geo('wood', hull, 0, 0.6, 0, { rz: 0.4 });
    this.col.addBox(x, z, 1, 2, rot, f.y - 1, f.y + 1);
  }

  walkway(ax, az, bx, bz, y = 0.8) {
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az);
    const n = Math.round(len / 0.7);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      this.add('wood', place(uvBox(2, 0.12, 0.6, 1.5), x, y + Math.sin(i) * 0.03, z, 0, rot + (this.rng() - 0.5) * 0.08));
      if (i % 4 === 0) {
        for (const s of [-1, 1]) this.add('wood', place(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 5), x + Math.cos(rot) * s, y - 0.9, z - Math.sin(rot) * s));
      }
    }
  }

  sarcophagus(x, z, rot) {
    const f = this.frame(x, z, rot);
    f.box('stone', 0, 0, 0, 1.2, 0.9, 2.4);
    f.box('darkStone', 0, 0.9, 0, 1.35, 0.2, 2.55, { collide: false });
    f.geo('stone', new THREE.SphereGeometry(0.25, 8, 6), 0, 1.15, -0.8);
  }

  seal(x, z) {
    const f = this.frame(x, z, 0);
    const ring = new THREE.RingGeometry(1.6, 2, 32);
    ring.rotateX(-PI / 2);
    f.geo('glowPurple', ring, 0, 0.05, 0);
    const ring2 = new THREE.RingGeometry(0.6, 0.8, 6);
    ring2.rotateX(-PI / 2);
    f.geo('glowPurple', ring2, 0, 0.06, 0);
    f.cyl('darkStone', 0, 0, 0, 0.5, 0.6, 1, 6);
    f.light(0, 1.5, 0, 0x9a4dff, 14, 9, 0.4);
  }

  obsidianSpire(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    const h = 6 + this.rng() * 10;
    f.cone('darkStone', 0, -0.5, 0, 1.2 + this.rng(), h, 5, { collide: true });
    f.box('glowOrange', 0.5, h * 0.2, 0.5, 0.08, h * 0.4, 0.08, { collide: false, rz: 0.2 });
  }

  demonAltar(x, z) {
    const f = this.frame(x, z, this.rng() * PI);
    f.box('darkStone', 0, 0, 0, 3, 1, 2);
    f.box('glowRed', 0, 1, 0, 2.6, 0.04, 1.6, { collide: false });
    for (const [px, pz] of [[-1.8, -1.2], [1.8, -1.2], [-1.8, 1.2], [1.8, 1.2]]) f.cone('bone', px, 0, pz, 0.25, 2.5, 5, { collide: true });
    const ring = new THREE.RingGeometry(3, 3.4, 5);
    ring.rotateX(-PI / 2);
    f.geo('glowRed', ring, 0, 0.06, 0);
    f.light(0, 2, 0, 0xff2a2a, 16, 10, 0.8);
  }

  crystalSpire(x, z, h = 8) {
    const f = this.frame(x, z, this.rng() * PI);
    const g = new THREE.OctahedronGeometry(1);
    g.scale(1, h / 2, 1);
    f.geo('crystal', g, 0, h / 2, 0);
    this.col.addCircle(x, z, 1, f.y - 1, f.y + h);
    f.light(0, h * 0.5, 0, 0xb04dff, 12, 12, 0.2);
  }

  shardPedestal(x, z) {
    const f = this.frame(x, z, 0);
    f.cyl('darkStone', 0, 0, 0, 1.2, 1.5, 0.8, 8);
    f.cyl('stone', 0, 0.8, 0, 0.5, 0.7, 1, 6);
    f.geo('crystal', new THREE.OctahedronGeometry(0.5), 0, 2.6, 0, { s: 1 });
    f.light(0, 2.6, 0, 0xc06aff, 16, 10, 0.3);
  }

  voidArch(x, z, rot) {
    const f = this.frame(x, z, rot);
    f.box('darkStone', -3, 0, 0, 1.2, 8, 1.2);
    f.box('darkStone', 3, 0, 0, 1.2, 5, 1.2, { rz: 0.1 });
    f.box('darkStone', -1.5, 8, 0, 4, 1, 1.2, { collide: false, rz: -0.2 });
    f.box('glowPurple', -3, 2, 0.62, 0.15, 5, 0.02, { collide: false });
  }

  iceTemple(x, z) {
    const f = this.frame(x, z, 0);
    f.cyl('stone', 0, -0.4, 0, 9, 9.5, 0.6, 16, { collide: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      const h = i % 3 === 0 ? 3 : 7;
      f.cyl('stone', Math.cos(a) * 7.5, 0, Math.sin(a) * 7.5, 0.5, 0.6, h, 8);
      if (h > 5) f.box('snow', Math.cos(a) * 7.5, h, Math.sin(a) * 7.5, 1.4, 0.3, 1.4, { collide: false });
    }
    const ring = new THREE.TorusGeometry(7.5, 0.5, 6, 24, PI * 1.2);
    ring.rotateX(PI / 2);
    f.geo('stone', ring, 0, 7.2, 0);
    f.geo('ice', new THREE.OctahedronGeometry(1.2), 0, 4, 0, { s: 1 });
    f.light(0, 4, 0, 0x7ad4ff, 18, 14, 0.2);
  }

  caveArch(x, z, rot) {
    const f = this.frame(x, z, rot);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * PI;
      f.geo('rock', new THREE.DodecahedronGeometry(1.8 + this.rng() * 0.8), Math.cos(a) * 5, Math.sin(a) * 5, 0, { s: 1 });
    }
    this.col.addCircle(f.w(-5, 0)[0], f.w(-5, 0)[1], 2, f.y - 1, f.y + 6);
    this.col.addCircle(f.w(5, 0)[0], f.w(5, 0)[1], 2, f.y - 1, f.y + 6);
    f.light(0, 2, -2, 0x7ad4ff, 12, 10, 0.2);
  }

  castleKeep(x, z) {
    const f = this.frame(x, z, 0);
    f.box('stone', 0, -1, 0, 30, 22, 16, { ts: 3 });
    f.box('darkStone', 0, 21, 0, 31, 1, 17, { collide: false });
    for (let i = 0; i < 12; i++) f.box('stone', -14.5 + i * 2.64, 22, 8.2, 1.2, 1.2, 1, { collide: false });
    // Fenêtres gothiques vertes (cf. image du château)
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) f.box('glowGreen', -11 + c * 4.4, 4 + r * 5.5, 8.02, 0.9, 2.6, 0.05, { collide: false });
    f.box('darkStone', 0, 0, 8.1, 5, 7, 0.4, { collide: false });
    f.box('glowGreen', 0, 0, 8.2, 3.8, 5.8, 0.05, { collide: false });
    f.light(0, 4, 11, 0x39ff6a, 30, 20, 0.2);
    for (const [tx, tz, r, h] of [[-15, 8, 3.5, 30], [15, 8, 3.5, 30], [-15, -8, 3, 26], [15, -8, 3, 26], [0, -4, 4.5, 42]]) this.tower(x + tx, z + tz, r, h, 'glowGreen');
  }

  webs(x, z, r) {
    for (let i = 0; i < 14; i++) {
      const a = this.rng() * PI * 2;
      const d = r * (0.6 + this.rng() * 0.6);
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const y = this.t.heightAt(px, pz);
      const g = new THREE.CylinderGeometry(0.02, 0.02, 8 + this.rng() * 6, 3);
      this.add('bone', place(g, px, y + 3, pz, (this.rng() - 0.5) * 1.8, 0, (this.rng() - 0.5) * 1.8));
    }
  }

  // Dalles au sol (place, parvis)
  floorDisc(x, z, r, mat = 'cobble', y = null) {
    const g = new THREE.CircleGeometry(r, 32);
    g.rotateX(-PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r / 2, uv.getY(i) * r / 2);
    const yy = y ?? this.t.heightAt(x, z);
    this.add(mat, place(g, x, yy + 0.04, z));
  }

  // Catacombes : labyrinthe de salles et couloirs
  catacombMaze(size, rooms) {
    const cell = 10;
    const n = Math.floor(size / cell) - 2;
    const half = (n * cell) / 2;
    const idx = (i, j) => j * n + i;
    const open = new Array(n * n).fill(false);
    // murs entre cellules : h[i][j] (entre (i,j) et (i+1,j)), v[i][j] (entre (i,j) et (i,j+1))
    const wallE = new Array(n * n).fill(true);
    const wallS = new Array(n * n).fill(true);
    const toCell = (x, z) => [Math.floor((x + half) / cell), Math.floor((z + half) / cell)];
    // Parcours en profondeur
    const stack = [[Math.floor(n / 2), n - 1]];
    open[idx(stack[0][0], stack[0][1])] = true;
    const rng = this.rng;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [];
      if (i > 0 && !open[idx(i - 1, j)]) nb.push([i - 1, j, 'W']);
      if (i < n - 1 && !open[idx(i + 1, j)]) nb.push([i + 1, j, 'E']);
      if (j > 0 && !open[idx(i, j - 1)]) nb.push([i, j - 1, 'N']);
      if (j < n - 1 && !open[idx(i, j + 1)]) nb.push([i, j + 1, 'S']);
      if (!nb.length) {
        stack.pop();
        continue;
      }
      const [ni, nj, dir] = nb[Math.floor(rng() * nb.length)];
      if (dir === 'E') wallE[idx(i, j)] = false;
      if (dir === 'W') wallE[idx(ni, nj)] = false;
      if (dir === 'S') wallS[idx(i, j)] = false;
      if (dir === 'N') wallS[idx(ni, nj)] = false;
      open[idx(ni, nj)] = true;
      stack.push([ni, nj]);
    }
    // Boucles supplémentaires
    for (let k = 0; k < n * n * 0.35; k++) {
      const i = Math.floor(rng() * (n - 1));
      const j = Math.floor(rng() * (n - 1));
      if (rng() < 0.5) wallE[idx(i, j)] = false;
      else wallS[idx(i, j)] = false;
    }
    // Salles : on retire les murs internes
    for (const rm of rooms) {
      const [ci, cj] = toCell(rm.x, rm.z);
      const rr = Math.max(0, Math.ceil(rm.r / cell) - 1);
      for (let i = ci - rr; i <= ci + rr; i++)
        for (let j = cj - rr; j <= cj + rr; j++) {
          if (i < 0 || j < 0 || i >= n || j >= n) continue;
          if (i < ci + rr) wallE[idx(i, j)] = false;
          if (j < cj + rr) wallS[idx(i, j)] = false;
        }
    }
    const H = 6.5;
    const wallAt = (x, z, w, d) => {
      this.add('stone', place(uvBox(w, H, d, 3), x, H / 2 - 0.2, z));
      this.col.addBox(x, z, w / 2, d / 2, 0, -1, H);
    };
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x0 = -half + i * cell;
        const z0 = -half + j * cell;
        if (i === n - 1 || wallE[idx(i, j)]) wallAt(x0 + cell, z0 + cell / 2, 1, cell + 1);
        if (j === n - 1 || wallS[idx(i, j)]) {
          // Entrée au sud (couloir d'arrivée)
          if (!(j === n - 1 && i === Math.floor(n / 2))) wallAt(x0 + cell / 2, z0 + cell, cell + 1, 1);
        }
        if (i === 0) wallAt(x0, z0 + cell / 2, 1, cell + 1);
        if (j === 0) wallAt(x0 + cell / 2, z0, cell + 1, 1);
        // Piliers aux angles + torches
        this.add('darkStone', place(uvCyl(0.8, 0.9, H, 8, 2), x0, H / 2 - 0.2, z0));
        if ((i + j) % 3 === 0) {
          this.add('iron', place(new THREE.BoxGeometry(0.2, 0.5, 0.2), x0 + 0.9, 3.2, z0));
          this.fires.push({ x: x0 + 0.9, y: 3.6, z: z0, scale: 0.5, color: 0xb04dff });
          this.lights.push({ x: x0 + 1.3, y: 3.8, z: z0, color: 0xb04dff, intensity: 12, dist: 11, flicker: 0.8 });
        }
      }
    // Plafond (voûte sombre)
    const ceil = new THREE.PlaneGeometry(n * cell + 4, n * cell + 4);
    ceil.rotateX(PI / 2);
    const uv = ceil.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n * 3, uv.getY(i) * n * 3);
    this.add('darkStone', place(ceil, 0, H - 0.2, 0));
    // Couloir d'entrée
    wallAt(-5.5, half + 8, 1, 16);
    wallAt(5.5, half + 8, 1, 16);
    wallAt(0, half + 16, 12, 1);
    this.catacombHalf = half + 16;
    return { cell, n, half };
  }

  finalize(parent) {
    const meshes = [];
    for (const [key, geos] of this.buckets) {
      if (!geos.length) continue;
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geo) continue;
      geo.computeBoundingSphere();
      const mat = MAT[key] ? MAT[key]() : Mats.stone();
      const mesh = new THREE.Mesh(geo, mat);
      const glow = key.startsWith('glow');
      mesh.castShadow = !glow && key !== 'tiles' && key !== 'cobble';
      mesh.receiveShadow = !glow;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}
