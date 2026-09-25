import * as THREE from 'three';
import { Rig } from '../player/rig.js';
import * as A from '../player/anims.js';
import { damp, angleLerp, rand } from '../engine/utils.js';

// Le Bouffon Vert sur son planeur
export class Boss {
  constructor(game, center, roofY) {
    this.game = game;
    this.center = center.clone();
    this.roofY = roofY;
    this.isBoss = true;
    this.name = 'Le Bouffon Vert';
    this.maxHp = 520;
    this.hp = this.maxHp;
    this.alive = true;
    this.active = true;
    this.state = 'intro';
    this.stateT = 0;
    this.t = 0;
    this.angle = 0;
    this.pos = new THREE.Vector3(center.x + 60, roofY + 40, center.z);
    this.vel = new THREE.Vector3();
    this.chest = new THREE.Vector3();
    this.facing = 0;
    this.web = 0;
    this.radius = 1.3;
    this.throwCd = 3;
    this.diveCd = 8;
    this.phase = 1;
    this.stunned = false;
    this.hitFlash = 0;

    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, ...o });
    this.mats = {
      head: std('#4f8f2f'),
      torso: std('#3f7a2a'),
      pelvis: std('#5b2a7a'),
      upperArm: std('#3f7a2a'),
      foreArm: std('#5b2a7a'),
      hand: std('#5b2a7a'),
      thigh: std('#3f7a2a'),
      shin: std('#5b2a7a'),
      foot: std('#5b2a7a'),
    };
    this.rig = new Rig({ materials: this.mats, scale: 1.08, bulk: 1.15, kind: 'boss' });
    const head = this.rig.j.head;
    // yeux jaunes et oreilles pointues
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffd000, emissiveIntensity: 2 });
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeMat);
      eye.scale.set(1.3, 0.7, 0.5);
      eye.position.set(sx * 0.05, 0.11, 0.11);
      eye.rotation.z = sx * -0.4;
      head.add(eye);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), this.mats.head);
      ear.position.set(sx * 0.12, 0.16, 0);
      ear.rotation.z = sx * -0.6;
      head.add(ear);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.02), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    mouth.position.set(0, 0.03, 0.115);
    head.add(mouth);
    // sacoche
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.1), std('#5b2a7a'));
    bag.position.set(0.18, -0.02, 0.05);
    this.rig.j.hips.add(bag);

    // Planeur en forme d'ailes de chauve-souris
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.9);
    shape.lineTo(0.35, 0.3);
    shape.lineTo(1.6, 0.6);
    shape.lineTo(1.2, 0.0);
    shape.lineTo(1.5, -0.45);
    shape.lineTo(0.5, -0.2);
    shape.lineTo(0, -0.8);
    shape.lineTo(-0.5, -0.2);
    shape.lineTo(-1.5, -0.45);
    shape.lineTo(-1.2, 0.0);
    shape.lineTo(-1.6, 0.6);
    shape.lineTo(-0.35, 0.3);
    shape.lineTo(0, 0.9);
    const gg = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    gg.rotateX(-Math.PI / 2);
    gg.translate(0, 0, 0);
    this.glider = new THREE.Mesh(gg, std('#2f4a1f', { metalness: 0.6, roughness: 0.35 }));
    this.glider.castShadow = true;
    const lights = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0xffc000, emissiveIntensity: 2.5 }));
    lights.position.set(0, 0.1, -0.5);
    this.glider.add(lights);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20 }));
    jet.rotation.x = -Math.PI / 2;
    jet.position.set(0, 0, -0.95);
    this.glider.add(jet);
    this.jet = jet;
    this.group = new THREE.Group();
    this.group.add(this.glider);
    this.group.add(this.rig.group);
    this.rig.group.position.y = 0.2;
    game.scene.add(this.group);
    this.cocoon = null;
  }

  get targetable() {
    return this.alive;
  }

  threatTime() {
    if (this.state === 'diveWindup') return 0.8 - this.stateT + 0.5;
    if (this.state === 'dive') return 0.2;
    return Infinity;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  addWeb(n) {
    if (this.stunned || !this.alive) return;
    this.web += n;
    this.game.hud.floatText(this.chest, `Planeur ${Math.min(4, this.web)}/4`, '#ffffff');
    if (this.web >= 4) {
      this.web = 0;
      this.stunned = true;
      this.setState('fall');
      this.vel.set(0, 2, 0);
      this.game.hud.toast('Le planeur est englué ! Frappe le Bouffon !');
      this.game.audio.play('zap');
    }
  }

  hit(info) {
    if (!this.alive) return { killed: false, blocked: false };
    let dmg = info.dmg;
    if (!this.stunned) dmg *= info.source === 'web' ? 1 : 0.4;
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.game.hud.toast('Le Bouffon Vert enrage !');
      this.game.audio.play('laugh');
      if (this.onPhase2) this.onPhase2();
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.setState('defeated');
      this.vel.set(0, 6, 0);
      this.game.fx.explosion(this.pos, 1.5);
      this.game.audio.play('explosion');
      this.game.slowmo(1.2, 0.25);
      return { killed: true, blocked: false };
    }
    if (this.stunned && info.knock > 8) this.stateT = Math.max(0, this.stateT - 0.5);
    return { killed: false, blocked: !this.stunned && info.source === 'melee' };
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.hitFlash -= dt;
    const game = this.game;
    const player = game.player;
    const c = this.center;
    const speedMul = this.phase === 2 ? 1.35 : 1;
    let pose = A.guard(this.t);
    let gliderOn = true;
    const toP = new THREE.Vector3().subVectors(player.chestPos, this.pos);

    switch (this.state) {
      case 'intro': {
        const target = new THREE.Vector3(c.x + 34, this.roofY + 14, c.z);
        this.pos.lerp(target, damp(1.2, dt));
        pose = A.cheer(this.t);
        if (this.stateT > 3) this.setState('fly');
        break;
      }
      case 'fly': {
        this.angle += dt * 0.45 * speedMul;
        const r = 32 + Math.sin(this.t * 0.7) * 6;
        const target = new THREE.Vector3(c.x + Math.cos(this.angle) * r, this.roofY + 12 + Math.sin(this.t * 1.3) * 5, c.z + Math.sin(this.angle) * r);
        this.vel.subVectors(target, this.pos).multiplyScalar(2.2);
        this.pos.addScaledVector(this.vel, dt);
        this.throwCd -= dt;
        this.diveCd -= dt;
        if (this.throwCd <= 0) {
          this.setState('throw');
        } else if (this.diveCd <= 0 && player.pos.y > this.roofY - 3) {
          this.setState('diveWindup');
          game.onSpiderSense(this, 0.9);
          game.audio.play('laugh', 0.7);
        }
        break;
      }
      case 'throw': {
        pose = A.attackPose('crossR', Math.min(this.stateT, 0.6), 0.8, 0.45);
        if (this.stateT > 0.45 && !this.thrown) {
          this.thrown = true;
          const n = this.phase === 2 ? 3 : 1;
          for (let k = 0; k < n; k++) {
            const tgt = player.pos.clone().addScaledVector(player.vel, 0.6);
            tgt.x += (k - (n - 1) / 2) * 4;
            const from = this.chest.clone();
            const flight = 1.1;
            const v = tgt.sub(from).multiplyScalar(1 / flight);
            v.y += 0.5 * 26 * flight;
            game.projectiles.spawn('pumpkin', from, v, {});
          }
          game.audio.play('whoosh');
        }
        if (this.stateT > 0.8) {
          this.thrown = false;
          this.throwCd = rand(2.6, 3.6) / speedMul;
          this.setState('fly');
        }
        break;
      }
      case 'diveWindup': {
        this.vel.multiplyScalar(1 - Math.min(1, dt * 4));
        this.pos.addScaledVector(this.vel, dt);
        this.diveTarget = player.chestPos.clone();
        pose = A.ATTACKS.bruteSmash.windup;
        if (this.stateT > 0.9) {
          this.setState('dive');
          this.diveDir = new THREE.Vector3().subVectors(this.diveTarget, this.pos).normalize();
          this.didHit = false;
          game.audio.play('whoosh', 1.2);
        }
        break;
      }
      case 'dive': {
        this.pos.addScaledVector(this.diveDir, 34 * speedMul * dt);
        pose = A.ATTACKS.bruteSmash.strike;
        if (!this.didHit && this.pos.distanceTo(player.chestPos) < 2.4) {
          this.didHit = true;
          player.takeDamage(20, this.pos, 'heavy');
        }
        if (this.stateT > 1.4 || this.pos.y < this.roofY + 1.5) {
          if (this.pos.y < this.roofY + 1.5) this.pos.y = this.roofY + 1.5;
          this.diveCd = rand(7, 10) / speedMul;
          this.setState('fly');
        }
        break;
      }
      case 'fall': {
        // planeur englué : chute sur le toit
        this.vel.y -= 20 * dt;
        this.vel.x = (c.x - this.pos.x) * 0.8;
        this.vel.z = (c.z - this.pos.z) * 0.8;
        this.pos.addScaledVector(this.vel, dt);
        pose = A.airborne(this.t);
        const b = game.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
        if (this.pos.y <= b) {
          this.pos.y = b;
          this.setState('stunned');
          game.fx.dust(this.pos, 16);
          game.cam.shake(0.5);
          game.audio.play('heavy');
        }
        break;
      }
      case 'stunned': {
        gliderOn = false;
        pose = A.knockdown();
        pose.root = [-1.2, 0, 0];
        if (Math.random() < dt * 8) game.fx.electric(this.pos.clone().setY(this.pos.y + 0.5), 3);
        if (this.stateT > 6.5) {
          this.stunned = false;
          this.setState('fly');
          this.vel.set(0, 10, 0);
          game.audio.play('laugh');
          this.throwCd = 1.5;
        }
        break;
      }
      case 'defeated': {
        this.vel.y -= 20 * dt;
        this.pos.addScaledVector(this.vel, dt);
        pose = A.knockdown();
        const b = game.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
        if (this.pos.y <= b) {
          this.pos.y = b;
          this.vel.set(0, 0, 0);
        }
        gliderOn = false;
        break;
      }
    }

    // le planeur, une fois englué, reste au sol à côté
    this.glider.visible = true;
    if (gliderOn) {
      this.glider.position.set(0, 0, 0);
      this.rig.group.position.set(0, 0.2, 0);
    } else {
      this.glider.position.set(1.5, 0.1, 0.5);
      this.rig.group.position.set(0, 0, 0);
    }
    this.jet.scale.setScalar(0.8 + Math.random() * 0.5);
    this.group.position.copy(this.pos);
    const hv = Math.hypot(this.vel.x, this.vel.z);
    let face = Math.atan2(toP.x, toP.z);
    if (this.state === 'fly' && hv > 4) face = Math.atan2(this.vel.x, this.vel.z) * 0.3 + face * 0.7;
    this.facing = angleLerp(this.facing, face, damp(5, dt));
    this.group.rotation.y = this.facing;
    this.glider.rotation.z = gliderOn ? Math.sin(this.t * 2) * 0.1 : 0;
    this.rig.apply(pose, dt, 10);
    const flash = this.hitFlash > 0;
    for (const m of Object.values(this.mats)) m.emissive.setScalar(flash ? 0.6 : 0);
    this.chest.set(this.pos.x, this.pos.y + (this.stunned ? 0.4 : 1.4), this.pos.z);
    if (gliderOn && Math.random() < 0.6) game.fx.trail(this.pos.clone().add(new THREE.Vector3(-Math.sin(this.facing), 0, -Math.cos(this.facing))), '#ff9a3a', 0.5, 0.25);
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.active = false;
  }
}
