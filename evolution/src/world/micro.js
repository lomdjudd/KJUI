// Le monde microscopique : une goutte de soupe primitive en 3D.
import * as THREE from 'three';
import { mulberry, rand } from '../core/util.js';

export const MICRO_R = 110;
export const MICRO_FLOOR = -36;
export const MICRO_CEIL = 36;

export class MicroWorld {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06252a);
    this.scene.fog = new THREE.FogExp2(0x0a3a3a, 0.012);
    const hemi = new THREE.HemisphereLight(0x9affe0, 0x103020, 1.4);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xe0fff0, 1.4);
    sun.position.set(30, 100, 20);
    this.scene.add(sun);
    this.time = 0;
    this.build();
  }

  build() {
    const rnd = mulberry(42);
    // Fond : sédiments
    const floorGeo = new THREE.PlaneGeometry(MICRO_R * 3, MICRO_R * 3, 80, 80);
    floorGeo.rotateX(-Math.PI / 2);
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      p.setY(i, Math.sin(x * 0.08) * Math.cos(z * 0.07) * 3 + Math.sin(x * 0.21 + z * 0.13) * 1.2);
    }
    floorGeo.computeVertexNormals();
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 1 }));
    floor.position.y = MICRO_FLOOR - 3;
    this.scene.add(floor);

    // Grosses bulles et rochers de sédiment
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a5a4a, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 40; i++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(2, 7), 0), rockMat);
      r.position.set((rnd() - 0.5) * MICRO_R * 2.4, MICRO_FLOOR - 2, (rnd() - 0.5) * MICRO_R * 2.4);
      r.rotation.set(rnd() * 3, rnd() * 3, 0);
      this.scene.add(r);
    }
    const bubbleMat = new THREE.MeshStandardMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false });
    this.bubbles = [];
    for (let i = 0; i < 25; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(rand(1.5, 5), 16, 12), bubbleMat);
      b.position.set((rnd() - 0.5) * MICRO_R * 2, rand(MICRO_FLOOR, MICRO_CEIL), (rnd() - 0.5) * MICRO_R * 2);
      b.userData.v = rand(0.5, 1.5);
      this.scene.add(b);
      this.bubbles.push(b);
    }
    // Filaments d'algues géantes
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x3a9a5a, roughness: 0.6, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 30; i++) {
      const h = rand(15, 50);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, h, 6), stalkMat);
      s.position.set((rnd() - 0.5) * MICRO_R * 2.2, MICRO_FLOOR + h / 2 - 3, (rnd() - 0.5) * MICRO_R * 2.2);
      s.rotation.z = rand(-0.2, 0.2);
      this.scene.add(s);
    }
    // Particules en suspension
    const N = 3000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * MICRO_R * 2.4;
      pos[i * 3 + 1] = rand(MICRO_FLOOR, MICRO_CEIL + 10);
      pos[i * 3 + 2] = (rnd() - 0.5) * MICRO_R * 2.4;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xbfffe8, size: 0.25, transparent: true, opacity: 0.6, depthWrite: false }));
    this.scene.add(this.dust);
    // Rayons de lumière
    const rayMat = new THREE.MeshBasicMaterial({ color: 0xbfffe0, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(new THREE.ConeGeometry(rand(6, 14), 120, 12, 1, true), rayMat);
      r.position.set((rnd() - 0.5) * MICRO_R * 1.8, 20, (rnd() - 0.5) * MICRO_R * 1.8);
      r.rotation.z = 0.2;
      this.scene.add(r);
    }

    // Nutriments (nourriture)
    const NF = 260;
    this.food = [];
    const fg = new THREE.IcosahedronGeometry(0.28, 0);
    const fm = new THREE.MeshStandardMaterial({ color: 0xfff27a, emissive: 0xffc020, emissiveIntensity: 0.8, roughness: 0.4 });
    this.foodMesh = new THREE.InstancedMesh(fg, fm, NF);
    for (let i = 0; i < NF; i++) {
      const f = { p: this.randomPoint(), v: new THREE.Vector3(rand(-0.3, 0.3), rand(-0.2, 0.2), rand(-0.3, 0.3)), alive: true, t: 0, idx: i };
      this.food.push(f);
    }
    this.scene.add(this.foodMesh);
    this.mtx = new THREE.Matrix4();
  }

  randomPoint() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * MICRO_R * 0.95;
    return new THREE.Vector3(Math.cos(a) * r, rand(MICRO_FLOOR + 2, MICRO_CEIL - 2), Math.sin(a) * r);
  }

  clamp(pos, radius = 1) {
    const r = Math.hypot(pos.x, pos.z);
    if (r > MICRO_R) {
      pos.x *= MICRO_R / r;
      pos.z *= MICRO_R / r;
    }
    pos.y = Math.max(MICRO_FLOOR + radius, Math.min(MICRO_CEIL - radius, pos.y));
  }

  update(dt) {
    this.time += dt;
    for (const b of this.bubbles) {
      b.position.y += b.userData.v * dt;
      if (b.position.y > MICRO_CEIL + 10) b.position.y = MICRO_FLOOR;
    }
    this.dust.rotation.y += dt * 0.005;
    for (const f of this.food) {
      if (!f.alive) {
        f.t -= dt;
        if (f.t <= 0) {
          f.alive = true;
          f.p.copy(this.randomPoint());
        }
      } else {
        f.p.addScaledVector(f.v, dt);
        this.clamp(f.p, 0.5);
      }
      const s = f.alive ? 1 + Math.sin(this.time * 3 + f.idx) * 0.15 : 0.0001;
      this.mtx.makeRotationY(this.time + f.idx);
      this.mtx.scale(new THREE.Vector3(s, s, s));
      this.mtx.setPosition(f.p);
      this.foodMesh.setMatrixAt(f.idx, this.mtx);
    }
    this.foodMesh.instanceMatrix.needsUpdate = true;
  }

  eatFoodNear(pos, radius) {
    let n = 0;
    for (const f of this.food) {
      if (!f.alive) continue;
      if (f.p.distanceToSquared(pos) < (radius + 0.4) ** 2) {
        f.alive = false;
        f.t = rand(8, 20);
        n++;
      }
    }
    return n;
  }
}
