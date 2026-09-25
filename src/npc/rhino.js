import * as THREE from 'three';
import { Rig } from '../player/rig.js';
import * as A from '../player/anims.js';
import { clamp, damp, angleLerp, rand } from '../engine/utils.js';

const _v = new THREE.Vector3();

// Le Rhino : boss terrestre qui charge. S'il percute un immeuble, il est sonné et vulnérable.
export class Rhino {
  constructor(game, center) {
    this.game = game;
    this.isBoss = true;
    this.name = 'Le Rhino';
    this.maxHp = 900;
    this.hp = this.maxHp;
    this.alive = true;
    this.active = true;
    this.center = center.clone();
    this.pos = center.clone().add(new THREE.Vector3(18, 0, 0));
    this.pos.y = game.city.groundHeight(this.pos.x, this.pos.z, 5);
    this.vel = new THREE.Vector3();
    this.facing = -Math.PI / 2;
    this.chest = new THREE.Vector3();
    this.radius = 1.5;
    this.state = 'intro';
    this.stateT = 0;
    this.t = 0;
    this.web = 0;
    this.slowT = 0;
    this.phase = 1;
    this.stunned = false;
    this.chargeCd = 4;
    this.hitFlash = 0;
    this._boxes = [];

    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.3, ...o });
    this.mats = {
      head: std('#8a8d90'),
      torso: std('#7a7d80'),
      pelvis: std('#55585c'),
      upperArm: std('#7a7d80'),
      foreArm: std('#55585c'),
      hand: std('#55585c'),
      thigh: std('#7a7d80'),
      shin: std('#55585c'),
      foot: std('#3a3c40'),
    };
    this.rig = new Rig({ materials: this.mats, scale: 1.55, bulk: 1.85, kind: 'boss' });
    const head = this.rig.j.head;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 10), std('#e8e2d0', { metalness: 0.1 }));
    horn.position.set(0, 0.13, 0.17);
    horn.rotation.x = 1.0;
    head.add(horn);
    const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 8), horn.material);
    horn2.position.set(0, 0.2, 0.1);
    horn2.rotation.x = 0.7;
    head.add(horn2);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), std('#c89a78', { metalness: 0 }));
    face.scale.set(0.9, 0.7, 0.5);
    face.position.set(0, 0.07, 0.1);
    head.add(face);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), eyeMat);
      eye.position.set(sx * 0.035, 0.1, 0.14);
      head.add(eye);
    }
    // plaques d'armure
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), std('#6a6d70'));
    plate.scale.set(1.3, 0.8, 1.1);
    plate.position.set(0, 0.15, -0.05);
    this.rig.j.chest.add(plate);
    this.rig.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    game.scene.add(this.rig.group);
    this.stars = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
    for (let k = 0; k < 4; k++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), starMat);
      st.position.set(Math.cos((k / 4) * Math.PI * 2) * 0.5, 0, Math.sin((k / 4) * Math.PI * 2) * 0.5);
      this.stars.add(st);
    }
    this.stars.visible = false;
    game.scene.add(this.stars);
  }

  get targetable() {
    return this.alive;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  threatTime() {
    if (this.state === 'chargeWindup') return 1.0 - this.stateT + 0.3;
    if (this.state === 'smashWindup') return 0.8 - this.stateT;
    if (this.state === 'charge' && this.pos.distanceTo(this.game.player.pos) < 10) return 0.2;
    return Infinity;
  }

  addWeb(n) {
    if (!this.alive) return;
    this.web += n;
    this.game.hud.floatText(this.chest, `Toile ${Math.min(8, this.web)}/8`, '#ffffff');
    if (this.web >= 8) {
      this.web = 0;
      this.slowT = 5;
      this.game.hud.toast('Le Rhino est englué et ralenti !');
    }
  }

  hit(info) {
    if (!this.alive) return { killed: false, blocked: false };
    const vulnerable = this.state === 'stunned' || this.state === 'tired';
    let dmg = info.dmg * (vulnerable ? 1 : 0.25);
    if (info.source === 'finisher') dmg = info.dmg;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.game.hud.toast('Le Rhino devient fou furieux !');
      this.game.audio.play('heavy');
      if (this.onPhase2) this.onPhase2();
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.stunned = false;
      this.setState('defeated');
      this.game.slowmo(1.2, 0.25);
      this.game.cam.shake(0.8);
      this.game.fx.dust(this.pos, 20);
      return { killed: true, blocked: false };
    }
    return { killed: false, blocked: !vulnerable && info.source === 'melee' };
  }

  // Repousse hors des immeubles ; renvoie la normale du mur touché (ou null)
  _hitsBuilding() {
    const p = this.pos;
    const r = this.radius;
    const boxes = this.game.city.queryAABB(p.x - r, p.z - r, p.x + r, p.z + r, this._boxes);
    for (const b of boxes) {
      if (b.maxY < p.y + 1.5 || b.minY > p.y + 2) continue;
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      const dx = p.x - cx;
      const dz = p.z - cz;
      if (dx * dx + dz * dz < r * r - 1e-4) {
        const d = Math.hypot(dx, dz) || 1;
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
        return new THREE.Vector3(dx / d, 0, dz / d);
      }
    }
    return null;
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.hitFlash -= dt;
    this.slowT -= dt;
    const game = this.game;
    const player = game.player;
    const toP = _v.subVectors(player.pos, this.pos).setY(0);
    const dist = toP.length();
    if (dist > 0.01) toP.multiplyScalar(1 / dist);
    const faceP = Math.atan2(toP.x, toP.z);
    const fury = this.phase === 2 ? 1.2 : 1;
    const slow = this.slowT > 0 ? 0.5 : 1;
    let pose = A.guard(this.t);
    let blend = 10;
    let move = 0;
    this.stunned = this.state === 'stunned' || this.state === 'tired';

    switch (this.state) {
      case 'intro': {
        pose = A.cheer(this.t);
        this.facing = angleLerp(this.facing, faceP, damp(4, dt));
        if (this.stateT > 2.5) this.setState('approach');
        break;
      }
      case 'approach': {
        this.facing = angleLerp(this.facing, faceP, damp(5, dt));
        this.chargeCd -= dt;
        if (dist < 4) {
          this.setState('smashWindup');
          game.onSpiderSense(this, 0.8);
        } else if (this.chargeCd <= 0 && dist > 7 && dist < 55 && Math.abs(player.pos.y - this.pos.y) < 6) {
          this.setState('chargeWindup');
          game.onSpiderSense(this, 1.0);
          game.audio.play('heavy', 0.6);
        } else {
          move = 5.2 * fury * slow;
        }
        break;
      }
      case 'smashWindup': {
        pose = A.lerpPose(A.guard(this.t), A.ATTACKS.bruteSmash.windup, Math.min(1, this.stateT / 0.4));
        this.facing = angleLerp(this.facing, faceP, damp(6, dt));
        if (this.stateT > 0.8 / fury) {
          this.setState('smash');
          game.fx.dust(this.pos.clone().addScaledVector(toP, 2), 16);
          game.cam.shake(0.5);
          game.audio.play('heavy');
          if (dist < 4.6 && Math.abs(player.pos.y - this.pos.y) < 2) player.takeDamage(22, this.pos, 'heavy');
        }
        break;
      }
      case 'smash': {
        pose = A.ATTACKS.bruteSmash.strike;
        blend = 25;
        if (this.stateT > 0.7) this.setState('approach');
        break;
      }
      case 'chargeWindup': {
        this.facing = angleLerp(this.facing, faceP, damp(8, dt));
        pose = { ...A.run(this.t * 6, 0.3, 1), spine: [0.9, 0, 0], hipsY: -0.25, head: [-0.6, 0, 0] };
        if (Math.random() < dt * 12) game.fx.dust(this.pos, 2);
        if (this.stateT > 1.0 / fury) {
          this.chargeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
          this.setState('charge');
          this.didHit = false;
          game.audio.play('whoosh', 1.3);
        }
        break;
      }
      case 'charge': {
        const sp = 30 * fury * slow;
        this.pos.addScaledVector(this.chargeDir, sp * dt);
        this.runPhase = (this.runPhase || 0) + dt * 18;
        pose = { ...A.run(this.runPhase, 1, 1), spine: [0.8, 0, 0], head: [-0.5, 0, 0] };
        blend = 18;
        if (Math.random() < dt * 20) game.fx.dust(this.pos, 1);
        if (!this.didHit && player.pos.distanceTo(this.pos) < 2.6) {
          this.didHit = true;
          player.takeDamage(28, this.pos.clone().addScaledVector(this.chargeDir, -2), 'heavy');
          game.cam.shake(0.6);
        }
        const wall = this._hitsBuilding();
        // sonné seulement s'il fonce vraiment dans le mur
        if (wall && this.stateT > 0.12 && wall.dot(this.chargeDir) < -0.35) {
          this.setState('stunned');
          game.cam.shake(0.9);
          game.audio.play('explosion', 0.8);
          game.fx.dust(this.pos, 26);
          game.fx.sparks(this.chest, 20, '#ffd27a', 10);
          game.hud.toast('Le Rhino s’est assommé contre le mur ! Frappe-le !');
        } else if (this.stateT > 2.4 || !game.city.inIsland(this.pos.x, this.pos.z)) {
          this.setState('tired');
          game.hud.toast('Le Rhino est essoufflé : attaque !');
        }
        break;
      }
      case 'stunned': {
        pose = { ...A.hit(0.3), spine: [0.5, Math.sin(this.t * 3) * 0.3, 0], hipsY: -0.3, head: [0.4, Math.sin(this.t * 4) * 0.5, 0] };
        if (this.stateT > 4.8) {
          this.setState('approach');
          this.chargeCd = rand(2.5, 4);
        }
        break;
      }
      case 'tired': {
        pose = { ...A.guard(this.t), spine: [0.7, 0, 0], hipsY: -0.2, lShoulder: [-0.6, 0, 0.3], rShoulder: [-0.6, 0, -0.3] };
        if (this.stateT > 1.8) {
          this.setState('approach');
          this.chargeCd = rand(3, 5) / fury;
        }
        break;
      }
      case 'defeated': {
        pose = A.knockdown();
        blend = 6;
        break;
      }
    }

    if (move > 0) {
      this.pos.x += toP.x * move * dt;
      this.pos.z += toP.z * move * dt;
      this._hitsBuilding();
      this.runPhase = (this.runPhase || 0) + dt * 7;
      pose = A.run(this.runPhase, 0.8, 0);
    }
    this.pos.y = game.city.groundHeight(this.pos.x, this.pos.z, this.pos.y + 1);
    this.rig.group.position.copy(this.pos);
    this.rig.group.rotation.y = this.facing;
    this.rig.apply(pose, dt, blend);
    const flash = this.hitFlash > 0;
    for (const m of Object.values(this.mats)) m.emissive.setScalar(flash ? 0.5 : 0);
    this.chest.set(this.pos.x, this.pos.y + 1.9, this.pos.z);
    this.stars.visible = this.state === 'stunned';
    if (this.stars.visible) {
      this.stars.position.set(this.pos.x, this.pos.y + 3.3, this.pos.z);
      this.stars.rotation.y += dt * 4;
    }
  }

  dispose() {
    this.game.scene.remove(this.rig.group);
    this.game.scene.remove(this.stars);
    this.active = false;
  }
}
