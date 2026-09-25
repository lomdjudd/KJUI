import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { N, PITCH, HALF, X0, STREET, BLOCK } from './city.js';
import { mulberry32 } from '../engine/utils.js';

function colored(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

export function makeCarGeometry() {
  const body = colored(new THREE.BoxGeometry(1.9, 0.75, 4.4), 1, 1, 1);
  body.translate(0, 0.65, 0);
  const cabin = colored(new THREE.BoxGeometry(1.7, 0.7, 2.3), 0.16, 0.19, 0.24);
  cabin.translate(0, 1.36, -0.2);
  const roof = colored(new THREE.BoxGeometry(1.6, 0.06, 2.0), 1, 1, 1);
  roof.translate(0, 1.73, -0.2);
  const parts = [body, cabin, roof];
  for (const [x, z] of [
    [0.9, 1.4],
    [-0.9, 1.4],
    [0.9, -1.4],
    [-0.9, -1.4],
  ]) {
    const w = colored(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), 0.05, 0.05, 0.05);
    w.rotateZ(Math.PI / 2);
    w.translate(x, 0.36, z);
    parts.push(w);
  }
  for (const x of [0.65, -0.65]) {
    const l = colored(new THREE.BoxGeometry(0.4, 0.18, 0.05), 3, 3, 2.6);
    l.translate(x, 0.8, 2.21);
    parts.push(l);
    const t = colored(new THREE.BoxGeometry(0.4, 0.15, 0.05), 2.5, 0.1, 0.1);
    t.translate(x, 0.8, -2.21);
    parts.push(t);
  }
  return BufferGeometryUtils.mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

const PAINTS = ['#b8231f', '#1f3f8a', '#e8e8e8', '#222222', '#6f7a80', '#2f6b3a', '#8a8f96', '#5a1f4a', '#c46a1c'];

export class Traffic {
  constructor(scene, city, quality) {
    this.city = city;
    const rng = mulberry32(1234);
    this.cars = [];
    const lanes = [];
    for (let i = 0; i <= N; i++) {
      const s = X0 + i * PITCH;
      for (const off of [3.4]) {
        lanes.push({ axis: 'z', c: s - off, dir: 1 });
        lanes.push({ axis: 'z', c: s + off, dir: -1 });
        lanes.push({ axis: 'x', c: s + off, dir: 1 });
        lanes.push({ axis: 'x', c: s - off, dir: -1 });
      }
    }
    const perLane = quality.cars;
    const len = 2 * HALF + 40;
    for (const lane of lanes) {
      const speed = 9 + rng() * 6;
      for (let k = 0; k < perLane; k++) {
        this.cars.push({
          lane,
          t: (k / perLane) * len + rng() * 40,
          speed,
          cur: speed,
          color: rng() < 0.3 ? '#f2c230' : PAINTS[Math.floor(rng() * PAINTS.length)],
        });
      }
    }
    this.len = len;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 });
    this.mesh = new THREE.InstancedMesh(makeCarGeometry(), mat, this.cars.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    const c = new THREE.Color();
    this.cars.forEach((car, k) => this.mesh.setColorAt(k, c.set(car.color)));
    scene.add(this.mesh);

    // Piétons
    this.peds = [];
    const nPeds = quality.peds;
    for (let k = 0; k < nPeds; k++) {
      let i;
      let j;
      do {
        i = Math.floor(rng() * N);
        j = Math.floor(rng() * N);
      } while (city.isPark(i, j));
      this.peds.push({
        i,
        j,
        s: rng() * 4,
        speed: 1.1 + rng() * 0.7,
        dir: rng() < 0.5 ? 1 : -1,
        phase: rng() * 10,
        flee: 0,
        pos: new THREE.Vector3(),
      });
    }
    const legs = colored(new THREE.BoxGeometry(0.34, 0.85, 0.22), 0.25, 0.25, 0.3);
    legs.translate(0, 0.43, 0);
    const torso = colored(new THREE.BoxGeometry(0.46, 0.62, 0.26), 1, 1, 1);
    torso.translate(0, 1.16, 0);
    const bodyG = BufferGeometryUtils.mergeGeometries([legs.toNonIndexed(), torso.toNonIndexed()]);
    const headG = new THREE.SphereGeometry(0.13, 8, 6);
    headG.translate(0, 1.63, 0);
    this.pedBody = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), nPeds);
    this.pedHead = new THREE.InstancedMesh(headG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), nPeds);
    this.pedBody.frustumCulled = false;
    this.pedHead.frustumCulled = false;
    const skins = ['#f1c7a5', '#d9a07a', '#a86e4a', '#6b4430', '#e8b894'];
    this.peds.forEach((p, k) => {
      this.pedBody.setColorAt(k, c.setHSL(rng(), 0.4 + rng() * 0.4, 0.3 + rng() * 0.35));
      this.pedHead.setColorAt(k, c.set(skins[Math.floor(rng() * skins.length)]));
    });
    this.pedBody.castShadow = true;
    scene.add(this.pedBody, this.pedHead);

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._up = new THREE.Vector3(0, 1, 0);
    this.obstacles = [];
  }

  // Position d'un piéton sur le périmètre du trottoir de son bloc
  _pedPos(p, out) {
    const bx0 = X0 + p.i * PITCH + STREET / 2 + 2.2;
    const bz0 = X0 + p.j * PITCH + STREET / 2 + 2.2;
    const L = BLOCK - 4.4;
    let s = ((p.s % 4) + 4) % 4;
    const side = Math.floor(s);
    const f = (s - side) * L;
    let yaw;
    if (side === 0) {
      out.set(bx0 + f, 0, bz0);
      yaw = Math.PI / 2;
    } else if (side === 1) {
      out.set(bx0 + L, 0, bz0 + f);
      yaw = 0;
    } else if (side === 2) {
      out.set(bx0 + L - f, 0, bz0 + L);
      yaw = -Math.PI / 2;
    } else {
      out.set(bx0, 0, bz0 + L - f);
      yaw = Math.PI;
    }
    if (p.dir < 0) yaw += Math.PI;
    return yaw;
  }

  update(dt, playerPos, danger) {
    const { _m: m, _q: q, _p: p, _s: s, _up: up } = this;
    const obs = this.obstacles;
    for (let k = 0; k < this.cars.length; k++) {
      const car = this.cars[k];
      const L = car.lane;
      // Position courante
      const along = -HALF - 20 + car.t;
      const x = L.axis === 'x' ? along * L.dir : L.c;
      const z = L.axis === 'z' ? along * L.dir : L.c;
      // Freine devant un obstacle (joueur, ennemis...)
      let target = car.speed;
      for (const o of obs) {
        const ox = o.x - x;
        const oz = o.z - z;
        if (o.y > 4) continue;
        const ahead = L.axis === 'x' ? ox * L.dir : oz * L.dir;
        const lat = L.axis === 'x' ? oz : ox;
        if (ahead > 0 && ahead < 14 && Math.abs(lat) < 2.6) {
          target = 0;
          break;
        }
      }
      car.cur += (target - car.cur) * Math.min(1, dt * (target < car.cur ? 6 : 1.5));
      car.t = (car.t + car.cur * dt) % this.len;
      const along2 = -HALF - 20 + car.t;
      p.set(L.axis === 'x' ? along2 * L.dir : L.c, 0, L.axis === 'z' ? along2 * L.dir : L.c);
      const yaw = L.axis === 'x' ? (L.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : L.dir > 0 ? 0 : Math.PI;
      q.setFromAxisAngle(up, yaw);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(k, m);
      car.x = p.x;
      car.z = p.z;
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    for (let k = 0; k < this.peds.length; k++) {
      const ped = this.peds[k];
      const near = danger && Math.hypot(ped.pos.x - danger.x, ped.pos.z - danger.z) < 45;
      ped.flee += ((near ? 1 : 0) - ped.flee) * Math.min(1, dt * 2);
      const sp = ped.speed * (1 + ped.flee * 2.5);
      ped.s += (ped.dir * sp * dt) / (BLOCK - 4.4);
      ped.phase += dt * sp * 4;
      const yaw = this._pedPos(ped, ped.pos);
      p.copy(ped.pos);
      p.y = Math.abs(Math.sin(ped.phase)) * 0.06;
      q.setFromAxisAngle(up, yaw);
      m.compose(p, q, s);
      this.pedBody.setMatrixAt(k, m);
      this.pedHead.setMatrixAt(k, m);
    }
    this.pedBody.instanceMatrix.needsUpdate = true;
    this.pedHead.instanceMatrix.needsUpdate = true;
  }
}
