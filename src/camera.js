import * as THREE from 'three';
import { clamp, damp, angleLerp } from './engine/utils.js';

const _f = new THREE.Vector3();
const _hit = {};

// Caméra à la troisième personne : orbite, suivi automatique, collisions, tremblements
export class CameraRig {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.yaw = 0;
    this.pitch = 0.15;
    this.dist = 5;
    this.target = new THREE.Vector3();
    this.trauma = 0;
    this.punch = 0;
    this.fov = 70;
    this.lastLook = 0;
  }

  shake(a) {
    this.trauma = Math.min(1, this.trauma + a);
  }

  punchIn(d) {
    this.punch = d;
  }

  snapBehind() {
    const p = this.game.player;
    this.yaw = p.facing + Math.PI;
    this.target.copy(p.pos).setY(p.pos.y + 1.6);
  }

  update(dt, input) {
    const g = this.game;
    const p = g.player;
    const look = input.consumeLook();
    if (look.x || look.y) this.lastLook = performance.now();
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, -1.15, 1.3);

    const hs = Math.hypot(p.vel.x, p.vel.z);
    const moving = p.state === 'swing' || p.state === 'air' || p.state === 'zip';
    // suivi automatique derrière le joueur lorsqu'il file à toute vitesse
    if (moving && hs > 12 && performance.now() - this.lastLook > 1200 && performance.now() - input.lookInputTime > 1200) {
      const want = Math.atan2(-p.vel.x, -p.vel.z);
      this.yaw = angleLerp(this.yaw, want, damp(1.4, dt));
      this.pitch += (0.18 - this.pitch) * damp(0.8, dt);
    }

    let want = 4.8;
    if (moving) want = 5.8 + clamp(hs / 50, 0, 1) * 3;
    if (g.combat.inCombat) want = 6.5;
    if (p.state === 'wall') want = 5.5;
    if (g.boss && g.boss.active) want = 8.5;
    if (this.punch > 0) {
      this.punch -= dt;
      want *= 0.65;
    }
    this.dist += (want - this.dist) * damp(3, dt);

    // cible : lissée verticalement
    const tx = p.pos.x;
    const ty = p.pos.y + 1.55;
    const tz = p.pos.z;
    const kxz = damp(p.state === 'swing' ? 14 : 20, dt);
    this.target.x += (tx - this.target.x) * kxz;
    this.target.z += (tz - this.target.z) * kxz;
    this.target.y += (ty - this.target.y) * damp(p.state === 'ground' ? 12 : 8, dt);

    _f.set(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    let d = this.dist;
    // collision avec les immeubles
    const back = _f.clone().negate();
    const h = g.city.raycast(this.target, back, d + 0.5, _hit);
    if (h && h.dist < d + 0.5) d = Math.max(1.2, h.dist - 0.5);
    const cam = this.camera;
    cam.position.copy(this.target).addScaledVector(_f, -d);
    // ne passe pas sous le sol
    const gy = g.city.groundHeight(cam.position.x, cam.position.z, cam.position.y) + 0.4;
    if (cam.position.y < gy) cam.position.y = gy;

    // tremblement
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    if (s > 0) {
      cam.position.x += (Math.random() - 0.5) * s * 0.6;
      cam.position.y += (Math.random() - 0.5) * s * 0.6;
      cam.position.z += (Math.random() - 0.5) * s * 0.6;
    }
    cam.lookAt(this.target.x + _f.x * 10, this.target.y + _f.y * 10, this.target.z + _f.z * 10);
    if (s > 0) cam.rotation.z += (Math.random() - 0.5) * s * 0.05;

    const speed = p.speed;
    const fovWant = 68 + clamp((speed - 15) / 40, 0, 1) * 20;
    this.fov += (fovWant - this.fov) * damp(3, dt);
    if (Math.abs(cam.fov - this.fov) > 0.05) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
