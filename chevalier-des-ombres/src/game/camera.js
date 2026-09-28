// Caméra : 3e personne (épaule, collisions, verrouillage de cible) et 1re personne,
// tremblements « trauma », champ de vision dynamique.
import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDiff, valueNoise } from '../core/utils.js';
import { settings } from '../core/settings.js';

const _v = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _want = new THREE.Vector3();

export class CameraRig {
  constructor(camera, world) {
    this.cam = camera;
    this.world = world;
    this.yaw = Math.PI;
    this.pitch = 0.28;
    this.dist = 4.3;
    this.curDist = 4.3;
    this.mode = settings.get('camMode');
    this.trauma = 0;
    this.time = 0;
    this.idleLook = 0;
    this.fovBoost = 0;
    this.pos = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.cinematic = null;
  }

  get forward() {
    return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount * settings.get('shake'));
  }

  toggleMode() {
    this.mode = this.mode === 'first' ? 'third' : 'first';
  }

  applyLook(look, dt) {
    if (look.x || look.y) this.idleLook = 0;
    this.yaw -= look.x;
    this.pitch = clamp(this.pitch + look.y, this.mode === 'first' ? -1.35 : -0.55, this.mode === 'first' ? 1.35 : 1.2);
  }

  // Plan cinématique (présentation des boss, menu titre)
  setCinematic(c) {
    this.cinematic = c;
  }

  update(dt, player, lockTarget) {
    this.time += dt;
    this.idleLook += dt;
    const cam = this.cam;
    const baseFov = settings.get('fov');
    this.fovBoost = damp(this.fovBoost, player.sprinting ? 7 : 0, 4, dt);
    const fov = baseFov + this.fovBoost;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (this.cinematic) {
      const c = this.cinematic;
      c.t += dt;
      cam.position.lerpVectors(c.from, c.to, Math.min(1, c.t / c.dur));
      this.lookTarget.lerp(c.look, 1 - Math.exp(-6 * dt));
      cam.lookAt(this.lookTarget);
      this._applyShake(dt);
      if (c.t >= c.dur + (c.hold || 0)) this.cinematic = null;
      return;
    }
    const scale = player.scale || 1;
    // Verrouillage : oriente la caméra vers la cible
    if (lockTarget && lockTarget.alive) {
      const dx = lockTarget.pos.x - player.pos.x;
      const dz = lockTarget.pos.z - player.pos.z;
      const targetYaw = Math.atan2(dx, dz);
      this.yaw = dampAngle(this.yaw, targetYaw, 8, dt);
      const d = Math.hypot(dx, dz);
      const h = (lockTarget.height || 2) * 0.5 + (lockTarget.pos.y - player.pos.y);
      const wantPitch = clamp(0.22 - Math.atan2(h - 1.4, Math.max(2, d)) * 0.6, 0.05, 0.6);
      if (this.mode !== 'first') this.pitch = damp(this.pitch, wantPitch, 4, dt);
    } else if (settings.get('autoCenter') && this.mode !== 'first' && player.moving && this.idleLook > 1.6 && !player.attacking) {
      // Recentrage doux derrière le chevalier
      const diff = angleDiff(this.yaw, player.yaw);
      if (Math.abs(diff) < 2.2) this.yaw += diff * (1 - Math.exp(-1.2 * dt));
    }
    if (this.mode === 'first') {
      const head = player.headPosition(_pivot);
      cam.position.copy(head);
      cam.position.x += Math.sin(player.yaw) * 0.12;
      cam.position.z += Math.cos(player.yaw) * 0.12;
      const f = Math.cos(this.pitch);
      _want.set(cam.position.x + Math.sin(this.yaw) * f, cam.position.y - Math.sin(this.pitch), cam.position.z + Math.cos(this.yaw) * f);
      cam.lookAt(_want);
      this._applyShake(dt);
      this.pos.copy(cam.position);
      return;
    }
    const dist = this.dist * settings.get('camDistance') * (0.85 + scale * 0.15) * (lockTarget ? 1.08 : 1);
    _pivot.set(player.pos.x, player.pos.y + 1.55 * scale, player.pos.z);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -fz;
    const rz = fx;
    const shoulder = 0.45;
    _want.set(_pivot.x - fx * cp * dist + rx * shoulder, _pivot.y + sp * dist, _pivot.z - fz * cp * dist + rz * shoulder);
    // Collisions caméra : obstacles + relief
    const t = this.world.colliders.segment(_pivot.x, _pivot.y, _pivot.z, _want.x, _want.y, _want.z, 1.2);
    let allowed = dist * Math.max(0.15, t - 0.05);
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const x = _pivot.x + (_want.x - _pivot.x) * k;
      const y = _pivot.y + (_want.y - _pivot.y) * k;
      const z = _pivot.z + (_want.z - _pivot.z) * k;
      if (y < this.world.heightAt(x, z) + 0.35) {
        allowed = Math.min(allowed, dist * Math.max(0.15, k - 0.12));
        break;
      }
    }
    if (this.world.zone && this.world.zone.indoor) allowed = Math.min(allowed, dist * 0.85);
    this.curDist = allowed < this.curDist ? allowed : damp(this.curDist, allowed, 3, dt);
    const d = this.curDist / dist;
    cam.position.set(_pivot.x + (_want.x - _pivot.x) * d, _pivot.y + (_want.y - _pivot.y) * d, _pivot.z + (_want.z - _pivot.z) * d);
    const minY = this.world.heightAt(cam.position.x, cam.position.z) + 0.3;
    if (cam.position.y < minY) cam.position.y = minY;
    if (this.world.zone && this.world.zone.indoor && cam.position.y > 5.8) cam.position.y = 5.8;
    this.lookTarget.set(_pivot.x + rx * shoulder * 0.6, _pivot.y, _pivot.z + rz * shoulder * 0.6);
    if (lockTarget && lockTarget.alive) {
      _v.set(lockTarget.pos.x, lockTarget.pos.y + (lockTarget.height || 2) * 0.45, lockTarget.pos.z);
      this.lookTarget.lerp(_v, 0.25);
    }
    cam.lookAt(this.lookTarget);
    this._applyShake(dt);
    this.pos.copy(cam.position);
  }

  _applyShake(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma;
    const t = this.time * 25;
    this.cam.rotation.z += (valueNoise(t, 1) - 0.5) * 0.12 * s;
    this.cam.rotation.x += (valueNoise(t, 7) - 0.5) * 0.1 * s;
    this.cam.rotation.y += (valueNoise(t, 13) - 0.5) * 0.1 * s;
  }
}
