// Complexe de lancement : pas de tir, tour ombilicale à bras rétractables,
// paratonnerres, sphères d'ergols, bâtiments, et zone d'atterrissage LZ-1.

import * as THREE from 'three';
import { EARTH_SITES } from '../core/terrain.js';
import { mulberry32 } from '../core/noise.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const M = {};
function mats() {
  if (M.concrete) return M;
  M.concrete = new THREE.MeshStandardMaterial({
    map: canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#8f8d88';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) {
        const v = 110 + Math.random() * 50;
        ctx.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.strokeStyle = 'rgba(50,50,50,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo((i * w) / 8, 0); ctx.lineTo((i * w) / 8, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, (i * h) / 8); ctx.lineTo(w, (i * h) / 8); ctx.stroke();
      }
      // traces de brûlure
      const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.4);
      g.addColorStop(0, 'rgba(20,18,16,0.7)');
      g.addColorStop(1, 'rgba(20,18,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }),
    roughness: 0.92,
  });
  M.steelRed = new THREE.MeshStandardMaterial({ color: '#b8452c', roughness: 0.6, metalness: 0.45 });
  M.steelGrey = new THREE.MeshStandardMaterial({ color: '#6d737b', roughness: 0.5, metalness: 0.6 });
  M.white = new THREE.MeshStandardMaterial({ color: '#dedbd3', roughness: 0.82, metalness: 0, envMapIntensity: 0.5 });
  M.dark = new THREE.MeshStandardMaterial({ color: '#222428', roughness: 0.7, metalness: 0.3 });
  M.glass = new THREE.MeshStandardMaterial({ color: '#10141c', roughness: 0.1, metalness: 0.5, emissive: new THREE.Color('#ffd89a'), emissiveIntensity: 0 });
  M.lamp = new THREE.MeshStandardMaterial({ color: '#fff', emissive: new THREE.Color('#fff1d6'), emissiveIntensity: 0 });
  M.redLamp = new THREE.MeshStandardMaterial({ color: '#300', emissive: new THREE.Color('#ff2020'), emissiveIntensity: 3 });
  M.asphalt = new THREE.MeshStandardMaterial({
    map: canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#34363a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const v = 40 + Math.random() * 40;
        ctx.fillStyle = `rgba(${v},${v},${v + 3},0.5)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }),
    roughness: 0.95,
  });
  M.asphalt.map.wrapS = M.asphalt.map.wrapT = THREE.RepeatWrapping;
  M.paintLine = new THREE.MeshStandardMaterial({ color: '#e9e6d8', roughness: 0.8 });
  M.trunk = new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.95 });
  M.leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true, envMapIntensity: 0.35 });
  M.trunk.envMapIntensity = 0.35;
  M.lz = new THREE.MeshStandardMaterial({
    map: canvasTex(1024, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#6f6e6a';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        const v = 95 + Math.random() * 40;
        ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      ctx.strokeStyle = '#f2f2ee';
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 60;
      ctx.beginPath(); ctx.moveTo(w * 0.36, h * 0.36); ctx.lineTo(w * 0.64, h * 0.64); ctx.moveTo(w * 0.64, h * 0.36); ctx.lineTo(w * 0.36, h * 0.64); ctx.stroke();
      ctx.fillStyle = '#f2f2ee';
      ctx.font = '700 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LZ-1', w / 2, h * 0.12);
    }),
    roughness: 0.9,
  });
  return M;
}

function box(w, h, d, mat, x, y, z, parts) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  parts.push([g, mat]);
}

function beam(a, b, r, mat, parts) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(r, len, r);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.applyQuaternion(q);
  const m = va.clone().add(vb).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  parts.push([g, mat]);
}

function mergeParts(parts) {
  const byMat = new Map();
  for (const [g, m] of parts) {
    if (!byMat.has(m)) byMat.set(m, []);
    const gg = g.index ? g : g;
    for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
    byMat.get(m).push(gg.index ? gg.toNonIndexed() : gg);
  }
  const grp = new THREE.Group();
  for (const [m, list] of byMat) {
    const g = mergeGeometries(list, false);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
  }
  return grp;
}

// Tour en treillis
function tower(H, W, parts, mat) {
  for (const x of [-W / 2, W / 2]) for (const z of [-W / 2, W / 2]) box(0.5, H, 0.5, mat, x, H / 2, z, parts);
  for (let y = 0; y < H - 1; y += 4) {
    const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]];
    for (const [a, b] of faces) {
      beam([(a[0] * W) / 2, y, (a[1] * W) / 2], [(b[0] * W) / 2, y + 4, (b[1] * W) / 2], 0.22, mat, parts);
      box(Math.abs(a[0] - b[0]) * W / 2 + 0.3, 0.25, Math.abs(a[1] - b[1]) * W / 2 + 0.3, mat, ((a[0] + b[0]) * W) / 4, y, ((a[1] + b[1]) * W) / 4, parts);
    }
    if (y % 16 === 0) box(W + 1.5, 0.3, W + 1.5, M.steelGrey, 0, y, 0, parts);
  }
}

export class LaunchSite {
  constructor(sys) {
    this.sys = sys;
    this.body = sys.home;
    this.group = new THREE.Group();
    this.pad = new THREE.Group();
    this.lz = new THREE.Group();
    this.group.add(this.pad);
    this.group.add(this.lz);
    this.arms = [];
    this.lampMats = [];
    this.lights = [];
    this.env = new THREE.Group();
    this.group.add(this.env);
    mats();
    this.buildPad(40);
    this.buildLZ();
    this.buildEnv();
  }

  // Routes et forêt tropicale autour du complexe (construit une fois)
  buildEnv() {
    const g = this.env;
    const parts = [];
    const road = (x0, z0, x1, z1, w) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const geo = new THREE.BoxGeometry(w, 0.45, L);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 12, uv.getY(i) * L / 12);
      geo.rotateY(Math.atan2(x1 - x0, z1 - z0));
      geo.translate((x0 + x1) / 2, -0.07, (z0 + z1) / 2);
      parts.push([geo, M.asphalt]);
    };
    road(0, -45, 0, -200, 16); // voie des chenilles vers le hall d'assemblage
    road(-150, -88, 150, -88, 9);
    road(95, -88, 95, -72, 9);
    road(-110, -88, -110, -50, 9);
    road(-85, -88, -85, 48, 7); // accès aux sphères d'ergols
    road(70, -88, 70, 10, 7);
    for (let z = -60; z > -196; z -= 12) box(0.35, 0.46, 5, M.paintLine, 0, -0.06, z, parts);
    g.add(mergeParts(parts));
    // forêt : troncs et houppiers instanciés, couleurs variées
    const rnd = mulberry32(7);
    const spots = [];
    const blocked = (x, z) => (Math.abs(x) < 70 && Math.abs(z) < 70) || (Math.abs(x) < 20 && z < 0 && z > -330) || (Math.abs(z + 88) < 12 && Math.abs(x) < 170)
      || (x > 50 && x < 140 && z < -40 && z > -100) || (x < -60 && x > -140 && z > -100 && z < 95) || (Math.abs(x) < 110 && z < -180 && z > -340);
    let tries = 0;
    while (spots.length < 2600 && tries++ < 40000) {
      const a = rnd() * Math.PI * 2;
      const r = 150 + Math.pow(rnd(), 0.7) * 1150;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z)) continue;
      // couloir dégagé vers la caméra au sol du décollage (420 m à l'ouest, 650 m au sud)
      const tc = Math.max(0, Math.min(1, (x * 420 - z * 650) / (420 * 420 + 650 * 650)));
      if (Math.hypot(x - 420 * tc, z + 650 * tc) < 45 + 30 * tc) continue;
      // lisière de forêt : clairières et bosquets denses
      const clump = Math.sin(x * 0.009) * Math.cos(z * 0.011) + 0.6 * Math.sin((x - z) * 0.0045) + (r - 260) / 300;
      if (clump < 0 && rnd() < 0.92) continue;
      spots.push([x, z]);
    }
    const trunkG = new THREE.CylinderGeometry(0.22, 0.38, 1, 5);
    trunkG.translate(0, 0.5, 0);
    const crownG = new THREE.IcosahedronGeometry(1, 1);
    const pos = crownG.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = 1 + 0.18 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(y * 4.2);
      pos.setXYZ(i, x * n, y * n * 0.72, z * n);
    }
    crownG.computeVertexNormals();
    const trunks = new THREE.InstancedMesh(trunkG, M.trunk, spots.length);
    const crowns = new THREE.InstancedMesh(crownG, M.leaves, spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const col = new THREE.Color();
    spots.forEach(([x, z], i) => {
      const hgt = 7 + rnd() * 13;
      const cw = 3.5 + rnd() * 4.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      m4.compose(p.set(x, -0.4, z), q, sc.set(1 + cw * 0.1, hgt, 1 + cw * 0.1));
      trunks.setMatrixAt(i, m4);
      m4.compose(p.set(x, hgt, z), q, sc.set(cw, cw * (0.7 + rnd() * 0.4), cw * (0.85 + rnd() * 0.3)));
      crowns.setMatrixAt(i, m4);
      col.setHSL(0.22 + rnd() * 0.12, 0.38 + rnd() * 0.22, 0.1 + rnd() * 0.09);
      crowns.setColorAt(i, col);
    });
    trunks.frustumCulled = crowns.frustumCulled = false;
    crowns.castShadow = true;
    g.add(trunks, crowns);
  }

  buildPad(rocketH, rocketR = 1.5) {
    const g = this.pad;
    g.clear();
    this.arms = [];
    const parts = [];
    // dalle et tranchée de flammes
    const slab = new THREE.Mesh(new THREE.BoxGeometry(90, 6, 90), M.concrete);
    slab.position.y = -3;
    slab.receiveShadow = true;
    g.add(slab);
    box(12, 0.2, 60, M.dark, 0, 0.02, 30, parts);
    // socle de lancement
    box(10, 1.2, 1.2, M.steelGrey, 0, -0.5, -rocketR - 2.4, parts);
    box(10, 1.2, 1.2, M.steelGrey, 0, -0.5, rocketR + 2.4, parts);
    // tour ombilicale derrière la fusée (vue 2D depuis -Z : derrière = +Z)
    const TH = Math.max(35, Math.ceil((rocketH + 12) / 4) * 4);
    const tw = [];
    tower(TH, 6, tw, M.steelRed);
    const towerG = mergeParts(tw);
    towerG.position.set(0, 0, rocketR + 12);
    g.add(towerG);
    // bras d'accès (se rétractent au décollage)
    const armHeights = [rocketH - 3, rocketH * 0.55, rocketH * 0.25].filter((y) => y > 4);
    for (const y of armHeights) {
      const arm = new THREE.Group();
      const ap = [];
      const L = rocketR + 12 - 3 - rocketR - 0.4;
      box(1.8, 0.4, L, M.steelGrey, 0, 0, -L / 2, ap);
      box(1.8, 2.4, 0.2, M.steelGrey, 0, 1.2, -L / 2 + L / 2 - 0.1, ap);
      beam([0.9, 0, 0], [0.9, 2.2, -L * 0.8], 0.12, M.steelGrey, ap);
      beam([-0.9, 0, 0], [-0.9, 2.2, -L * 0.8], 0.12, M.steelGrey, ap);
      box(2.2, 2.2, 1.2, M.white, 0, 1.1, -L + 0.6, ap);
      arm.add(mergeParts(ap));
      arm.position.set(0, y, rocketR + 12 - 3);
      g.add(arm);
      this.arms.push(arm);
    }
    // paratonnerres
    for (const [x, z] of [[-40, -30], [40, -30], [-40, 40], [40, 40]]) {
      beam([x, 0, z], [x, 90, z], 1.1, M.steelGrey, parts);
      box(0.6, 6, 0.6, M.dark, x, 93, z, parts);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), M.redLamp);
      lamp.position.set(x, 96.5, z);
      g.add(lamp);
    }
    // câbles des paratonnerres
    const lg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-40, 95, -30), new THREE.Vector3(0, TH + 15, 0), new THREE.Vector3(40, 95, -30),
      new THREE.Vector3(0, TH + 15, 0), new THREE.Vector3(-40, 95, 40), new THREE.Vector3(0, TH + 15, 0), new THREE.Vector3(40, 95, 40), new THREE.Vector3(0, TH + 15, 0),
    ]);
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#555' })));
    // château d'eau et sphères d'ergols
    for (let k = 0; k < 4; k++) beam([70 + (k % 2) * 8 - 4, 0, 20 + Math.floor(k / 2) * 8 - 4], [70, 30, 20], 0.6, M.steelGrey, parts);
    const wt = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), M.white);
    wt.position.set(70, 36, 20);
    wt.castShadow = true;
    g.add(wt);
    for (const [x, z, r] of [[-75, 55, 8], [-95, 55, 8], [-85, 75, 7]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), M.white);
      s.position.set(x, r + 3, z);
      s.castShadow = true;
      g.add(s);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        beam([x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8], [x + Math.cos(a) * r * 0.9, r + 3, z + Math.sin(a) * r * 0.9], 0.5, M.steelGrey, parts);
      }
    }
    // bâtiments
    const bld = (x, z, w, h, d) => {
      box(w, h, d, M.white, x, h / 2, z, parts);
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1.2, 0.1), M.glass);
      win.position.set(x, h * 0.6, z - d / 2 - 0.06);
      g.add(win);
    };
    bld(95, -60, 40, 14, 22);
    bld(-110, -40, 26, 9, 16);
    bld(0, -260, 160, 110, 120); // hall d'assemblage lointain
    // projecteurs
    for (const [x, z] of [[-30, -30], [30, -30]]) {
      beam([x, 0, z], [x, 22, z], 0.5, M.steelGrey, parts);
      const lp = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 0.6), M.lamp);
      lp.position.set(x, 22.5, z);
      lp.lookAt(0, 20, 0);
      g.add(lp);
      const sl = new THREE.SpotLight('#fff1d6', 0, 260, 0.5, 0.5, 1.2);
      sl.position.set(x, 22.5, z);
      sl.target.position.set(0, rocketH * 0.5, 0);
      g.add(sl);
      g.add(sl.target);
      this.lights.push(sl);
    }
    g.add(mergeParts(parts));
    this.rocketH = rocketH;
  }

  buildLZ() {
    const g = this.lz;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(42, 44, 4, 64), [M.concrete, M.lz, M.concrete]);
    pad.position.y = -2;
    pad.receiveShadow = true;
    g.add(pad);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), M.redLamp);
      l.position.set(Math.cos(a) * 41, 0.2, Math.sin(a) * 41);
      g.add(l);
    }
  }

  // Place un groupe sur la surface (repère local : X est, Y haut, Z nord)
  placeAt(obj, lon, h, ut, bodyRel) {
    const b = this.body;
    const rot = b.rotationAt(ut);
    const a = lon + rot;
    const R = b.radius + h;
    obj.position.set(bodyRel[0] + Math.cos(a) * R, bodyRel[1] + Math.sin(a) * R, 0);
    // base directe : X = ouest, Y = haut, Z = +Z monde (comme le repère des fusées)
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(Math.sin(a), -Math.cos(a), 0), new THREE.Vector3(Math.cos(a), Math.sin(a), 0), new THREE.Vector3(0, 0, 1));
    obj.quaternion.setFromRotationMatrix(m);
  }

  update(ut, bodyRel, dist, night, liftoffT) {
    const vis = dist < 120000;
    this.group.visible = vis;
    if (!vis) return;
    this.placeAt(this.pad, EARTH_SITES.pad.lon, EARTH_SITES.pad.h, ut, bodyRel);
    this.placeAt(this.env, EARTH_SITES.pad.lon, EARTH_SITES.pad.h, ut, bodyRel);
    this.placeAt(this.lz, EARTH_SITES.lz.lon, EARTH_SITES.lz.h, ut, bodyRel);
    // bras rétractés après le décollage
    const t = liftoffT == null ? 0 : Math.min(1, liftoffT / 2.5);
    for (const a of this.arms) a.rotation.y = t * 1.35;
    M.lamp.emissiveIntensity = night ? 6 : 0;
    M.glass.emissiveIntensity = night ? 1.2 : 0;
    for (const l of this.lights) l.intensity = night ? 2500 : 0;
  }
}
