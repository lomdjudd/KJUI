// Base commune aux personnages (chevalier, ennemis, boss, alliés) : modèle, animation,
// effets d'état (brûlure, poison, lenteur, gel, étourdissement), clignotement, dissolution.
import * as THREE from 'three';
import { Animator } from '../actors/anims.js';
import { buildWeapon, buildShield } from '../actors/models.js';
import { angleDiff, dampAngle } from '../core/utils.js';

let NEXT_ID = 1;

export const STATUS_COLORS = { burn: 0xff6a1a, poison: 0x7aff3a, slow: 0x7ad4ff, freeze: 0xa8e8ff, stun: 0xffe066, shock: 0xb8d8ff };

export class Actor {
  constructor(game, team) {
    this.id = NEXT_ID++;
    this.game = game;
    this.team = team;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.vy = 0;
    this.radius = 0.5;
    this.height = 1.9;
    this.scale = 1;
    this.hp = 100;
    this.maxHp = 100;
    this.poise = 30;
    this.maxPoise = 30;
    this.poiseRegen = 0;
    this.alive = true;
    this.grounded = true;
    this.status = {};
    this.flashT = 0;
    this.dissolve = 0;
    this.deadT = 0;
    this.speedNow = 0;
    this.hover = 0;
    this.kind = 'flesh';
    this.resist = {};
    this.weak = [];
  }

  setModel(built, animOpts = {}) {
    if (this.mesh) this.removeModel();
    this.built = built;
    this.mesh = built.mesh;
    this.mat = built.mesh.material;
    this.anim = new Animator(built, animOpts);
    this.mesh.scale.setScalar(this.scale);
    this.game.scene.add(this.mesh);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  removeModel() {
    if (!this.mesh) return;
    this.game.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isSkinnedMesh) o.skeleton.dispose();
    });
    if (this.mat && this.mat.dispose) this.mat.dispose();
    this.mesh = null;
  }

  attachWeapon(def, material) {
    if (this.weaponMesh) {
      this.weaponMesh.parent && this.weaponMesh.parent.remove(this.weaponMesh);
      this.weaponMesh.geometry.dispose();
    }
    if (!def) return null;
    const w = buildWeapon(def, material || this.mat);
    w.rotation.x = Math.PI / 2;
    if (def.type === 'bow') {
      w.rotation.set(0, 0, 0);
      this.built.bones.handL.add(w);
    } else this.built.bones.handR.add(w);
    this.weaponMesh = w;
    return w;
  }

  attachShield(def, material) {
    if (this.shieldMesh) {
      this.shieldMesh.parent && this.shieldMesh.parent.remove(this.shieldMesh);
      this.shieldMesh.geometry.dispose();
      this.shieldMesh = null;
    }
    if (!def || !def.shape) return null;
    const s = buildShield(def, material || this.mat);
    s.position.set(0.04, -0.3, 0);
    s.rotation.set(Math.PI / 2, 0, 0);
    this.built.bones.foreL.add(s);
    this.shieldMesh = s;
    return s;
  }

  get forwardX() {
    return Math.sin(this.yaw);
  }
  get forwardZ() {
    return Math.cos(this.yaw);
  }

  distTo(o) {
    return Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
  }

  // Angle entre la direction du regard et la direction vers `o`
  angleTo(o) {
    return angleDiff(this.yaw, Math.atan2(o.pos.x - this.pos.x, o.pos.z - this.pos.z));
  }

  faceTowards(x, z, rate, dt) {
    const target = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw = rate <= 0 ? target : dampAngle(this.yaw, target, rate, dt);
  }

  get stunned() {
    return (this.status.freeze && this.status.freeze.t > 0) || (this.status.stun && this.status.stun.t > 0);
  }

  get slowFactor() {
    let f = 1;
    if (this.status.slow && this.status.slow.t > 0) f *= 0.55;
    if (this.status.freeze && this.status.freeze.t > 0) f = 0;
    return f;
  }

  applyStatus(type, dur, dps = 0) {
    const s = this.status[type];
    if (s && s.t > 0) {
      s.t = Math.max(s.t, dur);
      s.dps = Math.max(s.dps, dps);
    } else this.status[type] = { t: dur, dps, tick: 0 };
  }

  updateStatus(dt) {
    for (const [type, s] of Object.entries(this.status)) {
      if (s.t <= 0) continue;
      s.t -= dt;
      if (s.dps > 0) {
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick = 0.5;
          this.game.combat.dot(this, s.dps * 0.5, type);
        }
      }
      if (Math.random() < dt * 14 && this.mesh && this.mesh.visible) {
        const p = this.game.particles;
        const y = this.pos.y + this.height * (0.3 + Math.random() * 0.6);
        const c = STATUS_COLORS[type] || 0xffffff;
        if (type === 'stun') p.spawn(this.pos.x + Math.cos(this.game.time * 6) * 0.4, this.pos.y + this.height + 0.2, this.pos.z + Math.sin(this.game.time * 6) * 0.4, 0, 0.2, 0, 0.4, 0.2, c, { intensity: 2 });
        else p.spawn(this.pos.x + (Math.random() - 0.5) * this.radius * 2, y, this.pos.z + (Math.random() - 0.5) * this.radius * 2, 0, type === 'burn' ? 1.5 : 0.5, 0, 0.6, 0.25, c, { intensity: 1.6 });
      }
    }
  }

  flash(color = 0xffffff, amount = 1) {
    this.flashT = amount;
    if (this.mat && this.mat.userData.u) this.mat.userData.u.uFlashColor.value.setHex(color);
  }

  updateVisual(dt) {
    if (!this.mesh) return;
    this.mesh.position.set(this.pos.x, this.pos.y + this.hover, this.pos.z);
    this.mesh.rotation.y = this.yaw + (this.anim ? this.anim.extraYaw : 0);
    const u = this.mat && this.mat.userData.u;
    if (u) {
      this.flashT = Math.max(0, this.flashT - dt * 6);
      let f = this.flashT * 1.2;
      if (this.status.freeze && this.status.freeze.t > 0) {
        f = Math.max(f, 0.35);
        u.uFlashColor.value.setHex(0x7ad4ff);
      }
      u.uFlash.value = f;
      u.uDissolve.value = this.dissolve;
    }
  }
}
