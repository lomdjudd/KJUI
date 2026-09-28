import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { N, PITCH, X0, STREET, BLOCK, HALF } from './city.js';
import { mulberry32 } from '../engine/utils.js';
import { signalOffset, SIGNAL_CYCLE } from './traffic.js';

// ---------- Mobilier urbain ----------
// Feux tricolores (synchronisés avec la circulation), bouches à incendie, poubelles, bancs, boîtes à journaux,
// boîtes aux lettres, abribus, plaques de rue. Géométrie fusionnée par secteur : peu d'appels de dessin.

const SIDEWALK = 4.5;
const CORNER = STREET / 2 + 0.75; // position des mâts (sur le trottoir, au coin)
const ARM = 5.4;

function paint(geo, color) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

const box = (w, h, d, x, y, z, c) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), c);
const cyl = (r0, r1, h, seg, x, y, z, c) => paint(new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y + h / 2, z), c);

// Modèles (origine au sol, face avant vers +z)
function hydrantParts(yellow) {
  const c = yellow ? '#d8b020' : '#b8231c';
  return [
    cyl(0.12, 0.15, 0.58, 7, 0, 0, 0, c),
    paint(new THREE.SphereGeometry(0.125, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.58, 0), c),
    paint(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 5, 1, true).rotateZ(Math.PI / 2).translate(0, 0.42, 0), c),
  ];
}
function trashParts() {
  return [cyl(0.27, 0.23, 0.84, 8, 0, 0, 0, '#2d4a33'), cyl(0.22, 0.22, 0.02, 8, 0, 0.84, 0, '#101010')];
}
function benchParts() {
  const wood = '#7a5638';
  const metal = '#23272a';
  const p = [box(1.8, 0.05, 0.42, 0, 0.45, 0, wood), paint(new THREE.BoxGeometry(1.8, 0.28, 0.04).rotateX(-0.2).translate(0, 0.7, -0.24), wood)];
  for (const x of [-0.75, 0.75]) p.push(box(0.06, 0.45, 0.44, x, 0.225, 0, metal));
  return p;
}
function newsParts(color) {
  return [box(0.44, 0.92, 0.42, 0, 0.46, 0, color), paint(new THREE.PlaneGeometry(0.3, 0.3).translate(0, 0.72, 0.212), '#c9d2da')];
}
function mailParts() {
  const blue = '#1f3f8a';
  return [
    box(0.5, 0.62, 0.5, 0, 0.62, 0, blue),
    paint(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 6, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.93, 0), blue),
    box(0.44, 0.32, 0.44, 0, 0.16, 0, '#15203a'),
  ];
}
function shelterParts() {
  const frame = '#3a3f44';
  const glass = '#6d8a9a';
  const p = [box(4.2, 0.1, 1.6, 0, 2.55, -0.1, frame), box(4.3, 0.04, 1.7, 0, 2.62, -0.1, '#23272a')];
  for (const x of [-2, 2]) {
    p.push(box(0.08, 2.5, 0.08, x, 1.25, 0.6, frame));
    p.push(box(0.08, 2.5, 0.08, x, 1.25, -0.75, frame));
  }
  p.push(box(3.9, 2.1, 0.03, 0, 1.3, -0.78, glass));
  p.push(box(0.03, 2.1, 1.25, 2.0, 1.3, -0.12, glass));
  p.push(box(1.3, 1.9, 0.12, -2.0, 1.2, -0.12, '#e8e2d4')); // panneau publicitaire
  p.push(box(1.1, 1.6, 0.13, -2.0, 1.25, -0.12, '#d05a2a'));
  p.push(...benchParts().map((g) => g.translate(0.4, 0, -0.35)));
  return p;
}
function treePitParts() {
  return [paint(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2).translate(0, 0.025, 0), '#3a2c20')];
}

// Mât de feux : poteau au coin, potence au-dessus des voies (+x local), tête tournée vers -z local
function signalMastParts(nameA, nameB) {
  const c = '#2c3236';
  const p = [
    paint(new THREE.CylinderGeometry(0.1, 0.13, 6.4, 6, 1, true).translate(0, 3.2, 0), c),
    paint(new THREE.CylinderGeometry(0.065, 0.08, ARM, 5, 1, true).rotateZ(Math.PI / 2).translate(ARM / 2, 6.1, 0), c),
    // tête de feux et plaque arrière
    box(0.4, 1.12, 0.3, ARM - 0.1, 5.35, 0, '#262a1e'),
    paint(new THREE.PlaneGeometry(0.5, 1.22).rotateY(Math.PI).translate(ARM - 0.1, 5.35, 0.16), '#1b1d16'),
  ];
  for (let k = 0; k < 3; k++) p.push(paint(new THREE.PlaneGeometry(0.32, 0.18).rotateX(Math.PI / 2).translate(ARM - 0.1, 5.72 - k * 0.34, -0.23), '#1b1d16'));
  // feu piéton sur le poteau
  p.push(box(0.3, 0.32, 0.22, 0.18, 3.0, 0, '#262a1e'));
  // plaques de rue vertes (deux directions)
  if (nameA) {
    p.push(box(1.1, 0.2, 0.02, 0.55, 6.75, 0.14, '#1f6b3a'));
    p.push(box(0.02, 0.2, 1.1, 0.14, 6.98, -0.55, '#1f6b3a'));
  }
  return p;
}

// Ampoules de feux : couleur calculée dans le shader à partir de l'horloge de la circulation
function makeLampMaterial(uniforms) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uClock = uniforms.clock;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 iSig;\nvarying vec3 vSig;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSig = iSig;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uClock;\nvarying vec3 vSig;`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float u = mod(uClock + vSig.x, ${SIGNAL_CYCLE.toFixed(1)});
        float st;
        if (vSig.y < 0.5) st = u < 10.5 ? 0.0 : (u < 13.0 ? 1.0 : 2.0);
        else st = u < 14.0 ? 2.0 : (u < 23.5 ? 0.0 : 1.0);
        float type = vSig.z;
        vec3 col = type < 0.5 ? vec3(1.0, 0.08, 0.05) : (type < 1.5 ? vec3(1.0, 0.62, 0.05) : vec3(0.1, 1.0, 0.45));
        float on = (type < 0.5 && st > 1.5) || (type > 0.5 && type < 1.5 && st > 0.5 && st < 1.5) || (type > 1.5 && st < 0.5) ? 1.0 : 0.0;
        if (type > 2.5) { col = st < 0.5 ? vec3(0.95) : vec3(1.0, 0.45, 0.1); on = 1.0; }
        diffuseColor.rgb = mix(col * 0.08, col * 3.2, on);`,
      );
  };
  return m;
}

export class StreetProps {
  constructor(city, quality) {
    this.city = city;
    this.group = new THREE.Group();
    this.uniforms = { clock: { value: 0 } };
    const rng = mulberry32(9090);
    const detail = quality.detail !== false;
    const nC = 7;
    const chunk = (N * PITCH) / nC;
    this.chunkSize = chunk;
    const cidx = (x, z) => Math.min(nC - 1, Math.max(0, Math.floor((z - X0) / chunk))) * nC + Math.min(nC - 1, Math.max(0, Math.floor((x - X0) / chunk)));
    const chunks = [...Array(nC * nC)].map(() => []);
    const put = (x, z) => chunks[cidx(x, z)];
    const qk = quality.detail === false ? 0 : quality.bloom ? 2 : 1; // 0 bas, 1 moyen, 2 élevé
    const m4 = new THREE.Matrix4();
    const add = (parts, x, z, rotY) => {
      m4.makeRotationY(rotY).setPosition(x, 0, z);
      const list = put(x, z);
      for (const p of parts) list.push(p.clone().applyMatrix4(m4));
    };
    const models = {
      hydrantR: hydrantParts(false),
      hydrantY: hydrantParts(true),
      trash: trashParts(),
      bench: benchParts(),
      news: ['#2a5fb0', '#b02a2a', '#d8b020', '#2a8a4a', '#6a3a8a'].map((c) => newsParts(c)),
      mail: mailParts(),
      shelter: shelterParts(),
      pit: treePitParts(),
    };
    this.streetTrees = [];

    // Mobilier le long des trottoirs de chaque bloc
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (city.isPark(i, j)) continue;
        const bx0 = X0 + i * PITCH + STREET / 2;
        const bz0 = X0 + j * PITCH + STREET / 2;
        // 4 côtés : position le long (t de 0 à BLOCK), repère du côté
        for (let side = 0; side < 4; side++) {
          const at = (t, inset) => {
            // inset : distance depuis la bordure vers l'intérieur du bloc
            if (side === 0) return [bx0 + t, bz0 + inset, Math.PI];
            if (side === 1) return [bx0 + BLOCK - inset, bz0 + t, Math.PI / 2];
            if (side === 2) return [bx0 + BLOCK - t, bz0 + BLOCK - inset, 0];
            return [bx0 + inset, bz0 + BLOCK - t, -Math.PI / 2];
          };
          // rotY : la face avant des objets regarde la rue
          const used = [];
          const free = (t, w) => t > 6 && t < BLOCK - 6 && Math.abs(t - BLOCK / 2) > 2.2 && Math.abs(t - BLOCK / 2 - 20) > 2 && used.every((u) => Math.abs(u - t) > w);
          const place = (w, fn) => {
            for (let k = 0; k < 6; k++) {
              const t = 6 + rng() * (BLOCK - 12);
              if (free(t, w)) {
                used.push(t);
                fn(t);
                return;
              }
            }
          };
          // arbres d'alignement (certaines rues)
          const leafy = (i * 7 + j * 3 + side) % 3 !== 0;
          if (leafy) {
            for (let t = 9; t < BLOCK - 8; t += 9 + rng() * 3) {
              if (!free(t, 2.5)) continue;
              used.push(t);
              const [x, z] = at(t, 1.3);
              add(models.pit, x, z, 0);
              this.streetTrees.push({ x, z, s: 0.62 + rng() * 0.25 });
            }
          }
          // tirages toujours effectués (même disposition quelle que soit la qualité), pose selon la qualité
          const r1 = rng();
          const r2 = rng();
          const r3 = rng();
          const r4 = rng();
          const r5 = rng();
          const r6 = rng();
          if (r1 < 0.5) place(1.2, (t) => { const [x, z, r] = at(t, 0.55); add(rng() < 0.85 ? models.hydrantR : models.hydrantY, x, z, r); });
          if (r2 < 0.6 && qk >= 1) place(1.2, (t) => { const [x, z, r] = at(t, 0.7); add(models.trash, x, z, r); });
          if (r3 < 0.4 && qk >= 1) place(2.4, (t) => { const [x, z, r] = at(t, 3.8); add(models.bench, x, z, r); });
          if (r4 < 0.3 && qk >= 2) place(1.6, (t) => { const [x, z, r] = at(t, 0.8); for (let k = 0; k < 1 + Math.floor(rng() * 3); k++) { const [x2, z2] = at(t + k * 0.5 - 0.5, 0.8); add(models.news[Math.floor(rng() * models.news.length)], x2, z2, r); } });
          if (r5 < 0.18 && qk >= 2) place(1.2, (t) => { const [x, z, r] = at(t, 0.7); add(models.mail, x, z, r); });
          if (r6 < 0.1 && qk >= 1) place(5, (t) => { const [x, z, r] = at(t, 1.2); add(models.shelter, x, z, r); });
        }
      }
    }

    // Mâts de feux aux carrefours + ampoules instanciées
    const lamps = [];
    const corners = [
      // [sx, sz, rotY, axe du trafic contrôlé]
      [-1, 1, 0, 'z'],
      [1, -1, Math.PI, 'z'],
      [1, 1, Math.PI / 2, 'x'],
      [-1, -1, -Math.PI / 2, 'x'],
    ];
    const mast = signalMastParts(true, true);
    const lampLocal = [];
    for (let k = 0; k < 3; k++) lampLocal.push([ARM - 0.1, 5.7 - k * 0.34, -0.155, k === 0 ? 0 : k === 1 ? 1 : 2]);
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const cx = X0 + i * PITCH;
        const cz = X0 + j * PITCH;
        if (Math.abs(cx) > HALF + 1 || Math.abs(cz) > HALF + 1) continue;
        for (const [sx, sz, rot, axis] of corners) {
          const x = cx + sx * CORNER;
          const z = cz + sz * CORNER;
          add(mast, x, z, rot);
          const off = signalOffset(i, j);
          m4.makeRotationY(rot).setPosition(x, 0, z);
          for (const [lx, ly, lz, type] of lampLocal) {
            const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(m4);
            lamps.push({ v, rot, off, axis: axis === 'x' ? 0 : 1, type });
          }
          // feu piéton : suit la rue perpendiculaire (marche = vert pour l'autre axe)
          const pv = new THREE.Vector3(0.18, 3.0, -0.115).applyMatrix4(m4);
          lamps.push({ v: pv, rot, off, axis: axis === 'x' ? 1 : 0, type: 3 });
        }
      }
    }
    const lampGeo = new THREE.CircleGeometry(0.12, 10).rotateY(Math.PI);
    const inst = new THREE.InstancedMesh(lampGeo, makeLampMaterial(this.uniforms), lamps.length);
    const sig = new Float32Array(lamps.length * 3);
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const small = new THREE.Vector3(0.8, 0.8, 0.8);
    lamps.forEach((l, k) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), l.rot);
      m4.compose(l.v, q, l.type === 3 ? small : one);
      inst.setMatrixAt(k, m4);
      sig[k * 3] = l.off;
      sig[k * 3 + 1] = l.axis;
      sig[k * 3 + 2] = l.type;
    });
    inst.geometry.setAttribute('iSig', new THREE.InstancedBufferAttribute(sig, 3));
    inst.computeBoundingSphere();
    this.group.add(inst);
    this.lamps = inst;

    // Fusion par secteur, masqués au-delà d'une certaine distance
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25 });
    this.chunks = [];
    chunks.forEach((list, k) => {
      if (!list.length) return;
      const g = BufferGeometryUtils.mergeGeometries(list);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = detail;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.chunks.push({ mesh, x: X0 + ((k % nC) + 0.5) * chunk, z: X0 + (Math.floor(k / nC) + 0.5) * chunk });
    });
    this.viewDist = qk === 0 ? 170 : qk === 1 ? 230 : 300;
    // Arbres d'alignement instanciés par secteur (tronc + feuillage)
    this.treeChunks = [];
    this._treeCidx = cidx;
    this._nC = nC;
    // collisions : poteaux de feux (fins) ignorés, abribus et bancs non bloquants
  }

  // Arbres d'alignement : géométries fournies par la ville, un maillage instancié par secteur
  buildTrees(trunkG, leafG, trunkMat, leafMat, rng) {
    const per = new Map();
    for (const t of this.streetTrees) {
      const k = this._treeCidx(t.x, t.z);
      if (!per.has(k)) per.set(k, []);
      per.get(k).push(t);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [k, list] of per) {
      const trunk = new THREE.InstancedMesh(trunkG, trunkMat, list.length);
      const leaves = new THREE.InstancedMesh(leafG, leafMat, list.length);
      list.forEach((t, i) => {
        q.setFromAxisAngle(up, rng() * 6);
        m4.compose(new THREE.Vector3(t.x, 0, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
        trunk.setMatrixAt(i, m4);
        leaves.setMatrixAt(i, m4);
        c.setHSL(0.24 + rng() * 0.1, 0.45 + rng() * 0.2, 0.25 + rng() * 0.12);
        leaves.setColorAt(i, c);
      });
      trunk.computeBoundingSphere();
      leaves.computeBoundingSphere();
      trunk.castShadow = true;
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      this.group.add(trunk, leaves);
      const nC = this._nC;
      const x = X0 + ((k % nC) + 0.5) * this.chunkSize;
      const z = X0 + (Math.floor(k / nC) + 0.5) * this.chunkSize;
      this.chunks.push({ mesh: trunk, x, z }, { mesh: leaves, x, z });
    }
  }

  update(clock, camera) {
    this.uniforms.clock.value = clock;
    if (!camera) return;
    const r = this.viewDist + this.chunkSize * 0.72;
    const cp = camera.position;
    for (const c of this.chunks) c.mesh.visible = Math.hypot(c.x - cp.x, c.z - cp.z) < r;
  }
}
