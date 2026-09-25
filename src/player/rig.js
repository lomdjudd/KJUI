import * as THREE from 'three';
import { makeCanvas, damp } from '../engine/utils.js';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'lShoulder', 'lElbow', 'rShoulder', 'rElbow', 'lHip', 'lKnee', 'rHip', 'rKnee'];

// ---------- Textures de costume ----------
function suitTexture(main, second, lines, emblem, { side = true, spider = true, back = true, w = 256, h = 256, dense = 14, lw = 1.6, panel = 0.12, emblemScale = 1 } = {}) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, w, h);
  if (side && second) {
    // Panneaux latéraux (u = 0 et u = 0.5 sont les flancs)
    ctx.fillStyle = second;
    const pw = w * panel;
    ctx.fillRect(0, 0, pw, h * 0.75);
    ctx.fillRect(w - pw, 0, pw, h * 0.75);
    ctx.fillRect(w * 0.5 - pw, 0, pw * 2, h * 0.75);
  }
  // Toile : lignes verticales + arcs horizontaux
  ctx.strokeStyle = lines;
  ctx.lineWidth = lw * (w / 256);
  ctx.globalAlpha = 0.9;
  for (let x = 0; x <= w; x += w / dense) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = h / 12; y < h; y += h / 10) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / dense) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w / dense / 2, y + 5, x + w / dense, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const drawSpider = (cx, cy, s, color) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.18, s * 0.1, s * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, s * 0.12, s * 0.12, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const sx of [-1, 1]) {
      const legs = [
        [0.1, -0.2, 0.35, -0.45, 0.4, -0.7],
        [0.1, -0.1, 0.45, -0.15, 0.55, -0.35],
        [0.1, 0.05, 0.45, 0.1, 0.55, 0.35],
        [0.1, 0.15, 0.3, 0.4, 0.35, 0.7],
      ];
      for (const l of legs) {
        ctx.beginPath();
        ctx.moveTo(sx * l[0] * s, l[1] * s);
        ctx.lineTo(sx * l[2] * s, l[3] * s);
        ctx.lineTo(sx * l[4] * s, l[5] * s);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  if (spider && emblem) {
    drawSpider(w * 0.25, h * 0.52, h * 0.28 * emblemScale, emblem); // devant
    if (back) drawSpider(w * 0.75, h * 0.5, h * 0.4 * emblemScale, emblem); // dos
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeSuitMaterials(suit) {
  // emissiveMap = map : permet de garder le costume lisible la nuit (intensité réglée en jeu)
  const std = (map, color) =>
    new THREE.MeshStandardMaterial({
      map: map || null,
      color: map ? 0xffffff : color,
      emissiveMap: map || null,
      emissive: map ? 0xffffff : color,
      emissiveIntensity: 0,
      roughness: suit.metal ? 0.32 : 0.55,
      metalness: suit.metal ? 0.55 : 0.05,
    });
  const lw = suit.lineWidth || 1.6;
  const torso = suitTexture(suit.main, suit.second, suit.lines, suit.emblem, { w: 512, h: 512, dense: 20, lw, panel: suit.panel || 0.12, emblemScale: suit.emblemScale || 1 });
  const head = suitTexture(suit.main, null, suit.lines, null, { side: false, spider: false, w: 512, h: 256, dense: 26, lw });
  const limbMain = suitTexture(suit.main, null, suit.lines, null, { side: false, spider: false, w: 256, h: 256, dense: 10, lw });
  const limbSecond = suitTexture(suit.limb2, null, suit.limb2 === suit.main ? suit.lines : shade(suit.limb2), null, {
    side: false,
    spider: false,
    w: 128,
    h: 128,
    dense: suit.limb2 === suit.main ? 6 : 4,
    lw,
  });
  return {
    head: std(head),
    torso: std(torso),
    pelvis: std(limbSecond),
    upperArm: std(limbSecond),
    foreArm: std(limbMain),
    hand: std(limbMain),
    thigh: std(limbSecond),
    shin: std(limbMain),
    foot: std(limbMain),
    eye: new THREE.MeshStandardMaterial({ color: suit.eyes, emissive: suit.eyes, emissiveIntensity: suit.eyes === '#ffffff' ? 0.25 : 1.2, roughness: 0.3 }),
    eyeRim: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 }),
  };
}

function shade(hex) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(0.6);
  return `#${c.getHexString()}`;
}

// ---------- Squelette humanoïde procédural ----------
export class Rig {
  constructor({ materials, scale = 1, bulk = 1, kind = 'hero' }) {
    this.kind = kind;
    this.scale = scale;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);
    this.pivot.position.y = 0.98;
    this.j = {};
    const J = (name, parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      this.j[name] = g;
      return g;
    };
    const m = materials;
    this.materials = m;
    const cap = (r, len, mat, parent, y, sx = 1, sz = 1) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 12), mat);
      mesh.position.y = y;
      mesh.scale.set(sx, 1, sz);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const ball = (r, mat, parent, y) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
      mesh.position.y = y;
      parent.add(mesh);
      return mesh;
    };
    const hips = J('hips', this.pivot, 0, 0, 0);
    this.meshes = {};
    this.meshes.pelvis = cap(0.14, 0.08, m.pelvis, hips, 0, 1.25 * bulk, 0.85 * bulk);
    const spine = J('spine', hips, 0, 0.1, 0);
    const chest = J('chest', spine, 0, 0.18, 0);
    this.meshes.torso = cap(0.16, 0.26, m.torso, chest, 0.06, 1.3 * bulk, 0.8 * bulk);
    const neck = J('neck', chest, 0, 0.3, 0);
    const neckMesh = cap(0.055, 0.06, m.head, neck, 0.02);
    neckMesh.castShadow = false;
    const head = J('head', neck, 0, 0.07, 0);
    const hg = new THREE.SphereGeometry(0.125, 20, 16);
    hg.rotateX(Math.PI / 2);
    const headMesh = new THREE.Mesh(hg, m.head);
    headMesh.scale.set(0.9, 1.12, 1);
    headMesh.position.y = 0.09;
    headMesh.castShadow = true;
    head.add(headMesh);
    this.meshes.head = headMesh;
    this.headMesh = headMesh;

    for (const side of ['l', 'r']) {
      const sx = side === 'l' ? 1 : -1;
      const sh = J(`${side}Shoulder`, chest, sx * 0.235 * bulk, 0.23, 0);
      ball(0.07 * bulk, m.upperArm, sh, 0);
      cap(0.056 * bulk, 0.22, m.upperArm, sh, -0.14);
      const el = J(`${side}Elbow`, sh, 0, -0.3, 0);
      ball(0.05 * bulk, m.foreArm, el, 0);
      cap(0.046 * bulk, 0.21, m.foreArm, el, -0.14);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052 * bulk, 10, 8), m.hand);
      hand.position.y = -0.31;
      hand.scale.set(0.85, 1.1, 1);
      hand.castShadow = true;
      el.add(hand);
      this.j[`${side}Hand`] = hand;
      const hp = J(`${side}Hip`, hips, sx * 0.1 * bulk, -0.06, 0);
      ball(0.08 * bulk, m.thigh, hp, -0.02);
      cap(0.078 * bulk, 0.28, m.thigh, hp, -0.21);
      const kn = J(`${side}Knee`, hp, 0, -0.43, 0);
      ball(0.063 * bulk, m.shin, kn, 0);
      cap(0.06 * bulk, 0.3, m.shin, kn, -0.2);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1 * bulk, 0.07, 0.22), m.foot);
      foot.position.set(0, -0.44, 0.05);
      foot.castShadow = true;
      kn.add(foot);
    }

    if (kind === 'hero') this._addEyes();

    this.group.scale.setScalar(scale);
    this.cur = new Float32Array(JOINTS.length * 3);
    this.curRoot = new Float32Array(3);
    this.curHipsY = 0;
    this.blendSpeed = 16;
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  _addEyes() {
    const head = this.j.head;
    for (const sx of [1, -1]) {
      const rim = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), this.materials.eyeRim);
      rim.scale.set(1.15, 0.72, 0.32);
      rim.position.set(sx * 0.047, 0.115, 0.105);
      rim.rotation.set(-0.2, sx * 0.45, sx * -0.5);
      head.add(rim);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 8), this.materials.eye);
      eye.scale.set(1.05, 0.62, 0.3);
      eye.position.set(sx * 0.048, 0.116, 0.112);
      eye.rotation.copy(rim.rotation);
      head.add(eye);
    }
  }

  // Remplace les matériaux par clé (pour changer de costume)
  swapMaterials(oldM, newM) {
    const map = new Map();
    for (const k of Object.keys(oldM)) if (newM[k]) map.set(oldM[k], newM[k]);
    this.group.traverse((o) => {
      if (o.isMesh && map.has(o.material)) o.material = map.get(o.material);
    });
    this.materials = newM;
  }

  // Applique une pose cible avec un lissage
  apply(pose, dt, speed = this.blendSpeed) {
    const k = dt <= 0 ? 1 : damp(speed, dt);
    for (let i = 0; i < JOINTS.length; i++) {
      const t = pose[JOINTS[i]];
      const o = i * 3;
      const tx = t ? t[0] : 0;
      const ty = t ? t[1] : 0;
      const tz = t ? t[2] : 0;
      this.cur[o] += (tx - this.cur[o]) * k;
      this.cur[o + 1] += (ty - this.cur[o + 1]) * k;
      this.cur[o + 2] += (tz - this.cur[o + 2]) * k;
      this.j[JOINTS[i]].rotation.set(this.cur[o], this.cur[o + 1], this.cur[o + 2]);
    }
    const r = pose.root || [0, 0, 0];
    // les rotations complètes (salto) ne sont pas lissées
    const kr = pose.rootSnap ? 1 : k;
    for (let a = 0; a < 3; a++) {
      if (!pose.rootSnap) {
        // évite de « rembobiner » un salto : on ramène l'écart dans [-π, π]
        const d = r[a] - this.curRoot[a];
        const w = d - Math.round(d / (Math.PI * 2)) * Math.PI * 2;
        this.curRoot[a] = r[a] - w;
      }
      this.curRoot[a] += (r[a] - this.curRoot[a]) * kr;
    }
    this.pivot.rotation.set(this.curRoot[0], this.curRoot[1], this.curRoot[2]);
    const hy = pose.hipsY || 0;
    this.curHipsY += (hy - this.curHipsY) * k;
    this.pivot.position.y = 0.98 + this.curHipsY;
  }

  // Oriente un bras vers une direction monde (bras tendu vers l'ancrage de toile)
  pointArm(side, worldDir, weight = 1) {
    const sh = this.j[`${side}Shoulder`];
    const el = this.j[`${side}Elbow`];
    this.group.updateMatrixWorld(true);
    sh.parent.getWorldQuaternion(this._q).invert();
    const local = this._v.copy(worldDir).applyQuaternion(this._q).normalize();
    this._q2.setFromUnitVectors(new THREE.Vector3(0, -1, 0), local);
    sh.quaternion.slerp(this._q2, weight);
    el.rotation.x *= 1 - weight;
    const idx = JOINTS.indexOf(`${side}Shoulder`) * 3;
    this.cur[idx] = sh.rotation.x;
    this.cur[idx + 1] = sh.rotation.y;
    this.cur[idx + 2] = sh.rotation.z;
  }

  handWorld(side, out) {
    return this.j[`${side}Hand`].getWorldPosition(out);
  }
}
