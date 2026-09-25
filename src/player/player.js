import * as THREE from 'three';
import { Rig, makeSuitMaterials } from './rig.js';
import { SUITS } from './suits.js';
import * as A from './anims.js';
import { clamp, damp, angleLerp } from '../engine/utils.js';

const G = 30; // gravité (m/s²)
const RADIUS = 0.42;
const HEIGHT = 1.8;
const RUN = 9.5;
const SPRINT = 18;
const UP = new THREE.Vector3(0, 1, 0);

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _hit = {};

export class Player {
  constructor(game) {
    this.game = game;
    this.city = game.city;
    this.pos = game.city.spawn.clone();
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.state = 'ground';
    this.stateTime = 0;
    this.time = 0;
    this.maxHealth = 100;
    this.health = 100;
    this.focus = 0;
    this.action = null;
    this.invuln = 0;
    this.lastHurt = -99;
    this.lastCombat = -99;
    this.airBoosts = 0;
    this.boostCd = 0;
    this.swingCd = 0;
    this.runPhase = 0;
    this.landT = 1;
    this.idleTime = 0;
    this.zipTarget = null;
    this.zipPoint = null; // point de lancement visé (affiché dans le HUD)
    this._zipScan = 0;
    this.anchor = new THREE.Vector3();
    this.ropeLen = 0;
    this.swingSide = 1;
    this.webLine = null;
    this.wall = { normal: new THREE.Vector3(), box: null };
    this.ground = 0;
    this.speed = 0;
    this._boxes = [];
    this.lastSwingRelease = -99;
    this.suits = {};
    this.suitKey = 'classique';
    this.suits.classique = makeSuitMaterials(SUITS.classique);
    this.rig = new Rig({ materials: this.suits.classique, kind: 'hero' });
    game.scene.add(this.rig.group);
    this.chestPos = new THREE.Vector3();
  }

  setSuit(key) {
    if (key === this.suitKey) return;
    if (!this.suits[key]) this.suits[key] = makeSuitMaterials(SUITS[key]);
    this.rig.swapMaterials(this.suits[this.suitKey], this.suits[key]);
    this.suitKey = key;
    this._glow = -1; // force la mise à jour de la lueur nocturne
    if (this.game.refreshStats) this.game.refreshStats();
  }

  get grounded() {
    return this.state === 'ground';
  }

  get inAir() {
    return this.state === 'air' || this.state === 'swing' || this.state === 'zip';
  }

  setState(s) {
    if (this.state === s) return;
    this.charging = null;
    if (this.state === 'swing') this._endSwingVisual();
    this.state = s;
    this.stateTime = 0;
  }

  teleport(p) {
    this.pos.copy(p);
    this.prevPos.copy(p);
    this.vel.set(0, 0, 0);
    this.action = null;
    this.setState('air');
  }

  // Direction souhaitée dans le repère caméra
  wishDir(input, out) {
    const mv = input.moveVector();
    const yaw = this.game.cam.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    out.set(fx * mv.y + rx * mv.x, 0, fz * mv.y + rz * mv.x);
    return Math.hypot(mv.x, mv.y);
  }

  update(dt, input) {
    this.time += dt;
    this.stateTime += dt;
    this.prevPos.copy(this.pos);
    this.boostCd -= dt;
    this.swingCd -= dt;
    this.invuln -= dt;

    const wish = _v1;
    const amt = this.wishDir(input, wish);
    if (amt > 0.01) wish.normalize();

    const locked = this.action && this.action.lock;
    if (!locked) {
      switch (this.state) {
        case 'ground':
          this._ground(dt, input, wish, amt);
          break;
        case 'air':
          this._air(dt, input, wish, amt);
          break;
        case 'swing':
          this._swing(dt, input, wish, amt);
          break;
        case 'wall':
          this._wall(dt, input, wish, amt);
          break;
        case 'zip':
          this._zip(dt, input);
          break;
      }
    } else {
      this._actionMove(dt);
    }

    // Régénération hors combat
    if (this.time - this.lastHurt > 4 && this.time - this.lastCombat > 3 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 10 * this.game.stats.regenMul * dt);
    }

    // Tombé à l'eau
    if (this.pos.y < -1.2 && !this.city.inIsland(this.pos.x, this.pos.z)) {
      this.game.onFellInWater();
    }

    this.speed = this.vel.length();
    this._scanZipPoint(dt);
    this.animate(dt);
    this.chestPos.set(this.pos.x, this.pos.y + 1.2, this.pos.z);
  }

  // ---------- Au sol ----------
  _ground(dt, input, wish, amt) {
    const sprint = input.isDown('swing');
    const target = (sprint ? SPRINT : RUN) * amt;
    const hv = _v2.set(this.vel.x, 0, this.vel.z);
    const desired = _v3.copy(wish).multiplyScalar(target);
    const accel = amt > 0.01 ? 55 : 40;
    hv.lerp(desired, clamp(accel * dt / Math.max(1, hv.distanceTo(desired)), 0, 1));
    this.vel.x = hv.x;
    this.vel.z = hv.z;
    this.vel.y = 0;
    if (amt > 0.05) this.facing = angleLerp(this.facing, Math.atan2(wish.x, wish.z), damp(14, dt));

    // Super-saut : maintenir Espace à l'arrêt puis relâcher
    if (this.charging !== null && this.charging !== undefined) {
      if (input.isDown('jump')) {
        this.charging += dt;
        this.vel.x *= 0.8;
        this.vel.z *= 0.8;
        if (this.charging > 0.25 && Math.random() < dt * 20) this.game.fx.dust(this.pos, 1);
      } else {
        const c = clamp((this.charging - 0.15) / 0.85, 0, 1);
        this.charging = null;
        this.vel.y = 12.5 + c * 17 * this.game.stats.superJump;
        if (c > 0.3) {
          this.game.fx.dust(this.pos, 14);
          this.game.cam.shake(0.15 + c * 0.2);
          this.game.audio.play('whoosh', 1.2);
          if (c > 0.9) this.game.hud.floatText(this.chestPos, 'SUPER-SAUT !', '#9fd0ff');
        } else this.game.audio.play('whoosh', 0.6);
        this.setState('air');
        this._integrate(dt);
        this._collide(false);
        return;
      }
    }
    if (input.wasPressed('jump') && !sprint && Math.hypot(this.vel.x, this.vel.z) < 3) {
      this.charging = 0;
    } else if (input.wasPressed('jump')) {
      this.vel.y = sprint ? 15 : 12.5;
      if (sprint) {
        this.vel.x *= 1.15;
        this.vel.z *= 1.15;
      }
      this.setState('air');
      this.game.audio.play('whoosh', 0.6);
      this._integrate(dt);
      this._collide(false);
      return;
    }
    if (input.wasPressed('zip') && this.zipPoint) {
      this._startZip();
      return;
    }

    this._integrate(dt);
    const contact = this._collide(sprint || amt > 0.5);
    if (contact && sprint && amt > 0.3 && _v3.copy(wish).dot(contact.normal) < -0.5) {
      this._enterWall(contact);
      return;
    }
    const g = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y, RADIUS * 0.5);
    this.ground = g;
    if (this.pos.y - g > 0.35) {
      this.setState('air');
    } else this.pos.y = g;
    if (hv.lengthSq() < 0.2) this.idleTime += dt;
    else this.idleTime = 0;
  }

  // ---------- En l'air ----------
  _air(dt, input, wish, amt) {
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (amt > 0.01) {
      const along = this.vel.x * wish.x + this.vel.z * wish.z;
      if (along < 16) {
        this.vel.x += wish.x * 16 * dt;
        this.vel.z += wish.z * 16 * dt;
      }
      // légère rotation de la trajectoire vers l'entrée
      if (hs > 5) {
        const cur = Math.atan2(this.vel.x, this.vel.z);
        const tgt = Math.atan2(wish.x, wish.z);
        const na = angleLerp(cur, tgt, damp(1.2, dt));
        this.vel.x = Math.sin(na) * hs;
        this.vel.z = Math.cos(na) * hs;
      }
    }
    const fastFall = this.vel.y < 0 && !input.isDown('swing');
    this.vel.y -= G * (fastFall ? 1.15 : 1) * dt;
    this.vel.y = Math.max(this.vel.y, -65);
    // traînée horizontale légère
    const drag = hs > 30 ? 0.35 : 0.08;
    this.vel.x *= 1 - drag * dt;
    this.vel.z *= 1 - drag * dt;
    if (hs > 2) this.facing = angleLerp(this.facing, Math.atan2(this.vel.x, this.vel.z), damp(6, dt));

    // Propulsion (web-zip) : saut en l'air
    if (input.wasPressed('jump') && this.boostCd <= 0 && this.airBoosts < this.game.stats.airBoosts) this._airBoost(wish, amt);

    if (input.wasPressed('zip') && this.zipPoint) {
      this._startZip();
      return;
    }

    // Balancement
    const hold = input.isDown('swing');
    if (hold && this.swingCd <= 0 && this.time - this.lastSwingRelease > 0.18) {
      if (this.pos.y - this.ground > 3.5 || this.vel.y < -2) {
        if (this._startSwing(wish, amt)) return;
      }
    }

    this._integrate(dt);
    const contact = this._collide(true);
    if (contact && contact.normal.y === 0) {
      const into = contact.speed;
      const push = amt > 0.3 && wish.dot(contact.normal) < -0.3;
      if (into > 2 || push || hold) {
        this._enterWall(contact);
        return;
      }
    }
    this.ground = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y, RADIUS * 0.5);
    if (this.pos.y <= this.ground && this.vel.y <= 0) this._land();
  }

  // Plongeon : piqué vers le sol pour prendre de la vitesse
  dive() {
    const cam = this.game.cam;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const dir = hs > 4 ? _v2.set(this.vel.x / hs, 0, this.vel.z / hs) : _v2.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const sp = Math.max(hs, 24);
    this.vel.x = dir.x * sp;
    this.vel.z = dir.z * sp;
    this.vel.y = Math.min(this.vel.y - 22, -32);
    this.diveT = 1.4;
    this.game.audio.play('whoosh', 1.3);
    this.game.cam.shake(0.1);
  }

  _airBoost(wish, amt) {
    const cam = this.game.cam;
    const dir = _v2;
    if (amt > 0.1) dir.copy(wish);
    else dir.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    const hs = Math.max(Math.hypot(this.vel.x, this.vel.z), 22);
    this.vel.x = dir.x * hs;
    this.vel.z = dir.z * hs;
    this.vel.y = Math.max(this.vel.y, 0) + 8;
    this.facing = Math.atan2(dir.x, dir.z);
    this.boostCd = 0.45;
    this.airBoosts++;
    this.game.audio.play('thwip', 0.8);
    this.boostT = 0.35;
    // deux fils vers l'avant
    const hl = this.rig.handWorld('l', new THREE.Vector3());
    const hr = this.rig.handWorld('r', new THREE.Vector3());
    const tgt = _v3.copy(this.pos).addScaledVector(dir, 16).add(new THREE.Vector3(0, 4, 0));
    this.game.webs.flash(hl, tgt.clone().add(new THREE.Vector3(dir.z * 2, 0, -dir.x * 2)), 0.18);
    this.game.webs.flash(hr, tgt.clone().add(new THREE.Vector3(-dir.z * 2, 0, dir.x * 2)), 0.18);
  }

  _land() {
    const impact = -this.vel.y;
    this.pos.y = this.ground;
    this.vel.y = 0;
    this.airBoosts = 0;
    this.setState('ground');
    if (impact > 22) {
      this.landT = 0;
      this.game.fx.dust(this.pos, 12);
      this.game.cam.shake(Math.min(0.5, impact / 120));
      this.game.audio.play('land', 1);
      // conserve un peu d'élan (roulade)
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    } else if (impact > 8) {
      this.landT = 0.5;
      this.game.audio.play('land', 0.4);
    }
  }

  // ---------- Balancement ----------
  _findAnchor(wish, amt) {
    const city = this.city;
    const cam = this.game.cam;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    let heading;
    if (amt > 0.2) heading = Math.atan2(wish.x, wish.z);
    else if (hs > 6) heading = Math.atan2(this.vel.x, this.vel.z);
    else heading = Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw));
    const origin = _v2.set(this.pos.x, this.pos.y + 1.4, this.pos.z);
    // plus on est haut, plus on vise des ancrages bas (l'altitude se régule d'elle-même)
    const alt = this.pos.y - this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    const prefH = clamp(30 - (alt - 30) * 0.45, 9, 30);
    let best = null;
    let bestScore = -Infinity;
    const dir = new THREE.Vector3();
    const sides = [0.35, -0.35, 0.65, -0.65, 0.1, -0.1, 0.95, -0.95];
    for (const side of sides) {
      for (const elev of [0.85, 1.05, 0.65, 0.42]) {
        const yaw = heading + side;
        dir.set(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev));
        const h = city.raycast(origin, dir, 85, _hit);
        if (!h || h.ground) continue;
        const d = h.dist;
        const height = h.point.y - this.pos.y;
        if (height < 7 || d < 9) continue;
        let score = -Math.abs(d - 32) * 0.6 - Math.abs(height - prefH) * 0.4 - Math.abs(side) * 8;
        // alterner gauche / droite pour un balancement naturel
        if (Math.sign(side) === -this.swingSide) score += 4;
        if (score > bestScore) {
          bestScore = score;
          best = h.point.clone();
          best.side = Math.sign(side) || 1;
        }
      }
    }
    if (!best && this.pos.y > 12 && this.pos.y < 110) {
      // Pas d'immeuble : ancrage « dans le ciel » pour ne jamais frustrer
      best = new THREE.Vector3(this.pos.x + Math.sin(heading) * 22, this.pos.y + 22, this.pos.z + Math.cos(heading) * 22);
      best.side = 1;
    }
    return best;
  }

  _startSwing(wish, amt) {
    const a = this._findAnchor(wish, amt);
    if (!a) return false;
    this.anchor.copy(a);
    this.swingSide = a.side;
    const dist = this.anchor.distanceTo(this.pos);
    const g = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    this.ropeLen = Math.min(dist, Math.max(8, this.anchor.y - g - 3));
    this.setState('swing');
    this.game.stat('swings');
    this.webLine = this.game.webs.acquire();
    this.game.audio.play('thwip');
    this.airBoosts = 0;
    // petit gain de vitesse à l'accroche
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs < 12) {
      const hd = _v3.set(this.anchor.x - this.pos.x, 0, this.anchor.z - this.pos.z).normalize();
      this.vel.addScaledVector(hd, 12 - hs);
    }
    return true;
  }

  _endSwingVisual() {
    if (this.webLine) this.game.webs.release(this.webLine);
    this.webLine = null;
  }

  _releaseSwing(boost = true) {
    this.lastSwingRelease = this.time;
    if (boost) {
      const v = this.vel;
      const sp = v.length();
      // bonus de relâche : envol vers l'avant et le haut
      const hd = _v2.set(v.x, 0, v.z);
      if (hd.lengthSq() > 0.01) hd.normalize();
      v.addScaledVector(hd, 4 + Math.min(sp, 40) * 0.06);
      // petit envol, limité pour ne pas monter indéfiniment
      const high = clamp((this.pos.y - this.ground - 45) / 60, 0, 1);
      v.y = Math.min(Math.max(v.y + 4 * (1 - high), 3), 15 - high * 8);
      this.game.audio.play('whoosh', 0.8);
    }
    this.setState('air');
    this.swingCd = 0.08;
  }

  _swing(dt, input, wish, amt) {
    const hold = input.isDown('swing');
    if (!hold) {
      this._releaseSwing(true);
      this._air(dt, input, wish, amt);
      return;
    }
    if (input.wasPressed('jump')) {
      this._releaseSwing(true);
      this.vel.y += 6;
      return;
    }
    const v = this.vel;
    // Gravité + pompage vers l'avant
    v.y -= 36 * dt;
    const rope = _v2.subVectors(this.anchor, this.pos);
    const dist = rope.length();
    rope.multiplyScalar(1 / dist);
    if (amt > 0.05) {
      // composante tangentielle de l'entrée
      const t = _v3.copy(wish).addScaledVector(rope, -wish.dot(rope));
      v.addScaledVector(t, 10 * this.game.stats.swingMul * dt);
    } else {
      // assistance : accélère dans le sens du mouvement
      const hv = _v3.set(v.x, 0, v.z);
      if (hv.lengthSq() > 1) v.addScaledVector(hv.normalize(), 6 * dt);
    }
    // raccourcit légèrement la corde au début (effet de traction)
    if (this.stateTime < 0.35) this.ropeLen = Math.max(8, this.ropeLen - 10 * dt);
    const sp = v.length();
    const maxSp = 58 * this.game.stats.swingMul;
    if (sp > maxSp) v.multiplyScalar(maxSp / sp);
    v.multiplyScalar(1 - 0.1 * dt);
    // vitesse minimale : on ne cale jamais en plein balancement
    if (sp < 17 && sp > 0.1) v.multiplyScalar(1 + Math.min(1, ((17 - sp) / sp) * 3 * dt));

    this._integrate(dt);
    // Contrainte de corde
    const r = _v2.subVectors(this.pos, this.anchor);
    const d = r.length();
    if (d > this.ropeLen) {
      r.multiplyScalar(1 / d);
      this.pos.copy(this.anchor).addScaledVector(r, this.ropeLen);
      const radial = v.dot(r);
      if (radial > 0) v.addScaledVector(r, -radial);
    }
    const hs = Math.hypot(v.x, v.z);
    if (hs > 1) this.facing = angleLerp(this.facing, Math.atan2(v.x, v.z), damp(8, dt));

    const contact = this._collide(true);
    if (contact && contact.normal.y === 0) {
      this._endSwingVisual();
      this._enterWall(contact);
      return;
    }
    this.ground = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y, RADIUS * 0.5);
    if (this.pos.y - this.ground < 0.4 && v.y < 0) {
      this._releaseSwing(false);
      this._land();
      return;
    }
    // Relâche automatique en haut de l'arc (enchaînement en maintenant la touche)
    const above = this.pos.y - this.anchor.y;
    const hdist = Math.hypot(this.pos.x - this.anchor.x, this.pos.z - this.anchor.z);
    const passed = (this.pos.x - this.anchor.x) * v.x + (this.pos.z - this.anchor.z) * v.z > 0;
    if ((passed && above > -this.ropeLen * 0.5 && v.y > 0) || above > -1 || this.stateTime > 3.2) {
      this._releaseSwing(true);
      this.swingCd = 0.12;
    } else if (passed && hdist > this.ropeLen * 0.8 && v.y < 2) {
      this._releaseSwing(true);
    }
    if (this.webLine) {
      const hand = this.rig.handWorld(this.swingSide > 0 ? 'l' : 'r', _v3);
      this.game.webs.update(this.webLine, hand, this.anchor, 0.025);
    }
  }

  // ---------- Murs ----------
  _enterWall(contact) {
    this.wall.normal.copy(contact.normal);
    this.wall.box = contact.box;
    this.setState('wall');
    this.vel.set(0, Math.max(0, this.vel.y * 0.3), 0);
    this.airBoosts = 0;
    this.facing = Math.atan2(-contact.normal.x, -contact.normal.z);
  }

  _wall(dt, input, wish, amt) {
    const n = this.wall.normal;
    const box = this.wall.box;
    const mv = input.moveVector();
    const sprint = input.isDown('swing');
    const sp = sprint ? 16 : 7.5;
    // tangente horizontale « droite » quand on fait face au mur
    const right = _v2.set(0, 1, 0).cross(n);
    const cam = this.game.cam;
    const camRight = _v3.set(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    const sideSign = camRight.dot(right) >= 0 ? 1 : -1;
    const climbing = mv.y;
    this.vel.set(right.x * mv.x * sp * sideSign, climbing * sp, right.z * mv.x * sp * sideSign);
    if (sprint && Math.abs(mv.x) < 0.2 && Math.abs(mv.y) < 0.2) this.vel.y = sp;
    this.pos.addScaledVector(this.vel, dt);
    this.facing = Math.atan2(-n.x, -n.z);

    // Coller au mur
    if (box) {
      if (n.x > 0.5) this.pos.x = box.maxX + RADIUS;
      else if (n.x < -0.5) this.pos.x = box.minX - RADIUS;
      else if (n.z > 0.5) this.pos.z = box.maxZ + RADIUS;
      else if (n.z < -0.5) this.pos.z = box.minZ - RADIUS;
    }

    if (input.wasPressed('jump')) {
      this.vel.copy(n).multiplyScalar(11);
      this.vel.y = 10;
      if (amt > 0.1) this.vel.addScaledVector(wish, 6);
      this.facing = Math.atan2(n.x, n.z);
      this.setState('air');
      this.game.audio.play('whoosh', 0.7);
      return;
    }
    if (input.wasPressed('zip') && this.zipPoint) {
      this._startZip();
      return;
    }

    if (box) {
      // Sommet atteint : on passe par-dessus
      if (this.pos.y + 0.6 >= box.maxY) {
        this.pos.y = box.maxY + 0.05;
        this.pos.addScaledVector(n, -1.2);
        this.vel.set(-n.x * 5, 7, -n.z * 5);
        this.setState('air');
        this.game.audio.play('whoosh', 0.5);
        return;
      }
      // Sorti du mur latéralement
      const off = 0.2;
      const outside =
        Math.abs(n.x) > 0.5
          ? this.pos.z < box.minZ - off || this.pos.z > box.maxZ + off
          : this.pos.x < box.minX - off || this.pos.x > box.maxX + off;
      if (outside) {
        this.vel.addScaledVector(n, 2);
        this.setState('air');
        return;
      }
    }
    const g = this.city.groundHeight(this.pos.x + n.x * 0.5, this.pos.z + n.z * 0.5, this.pos.y);
    if (this.pos.y <= g + 0.02) {
      this.pos.y = g;
      if (climbing <= 0.1 && this.stateTime > 0.15) {
        this.pos.addScaledVector(n, 0.3);
        this.setState('ground');
      }
    }
  }

  // ---------- Point de lancement (zip) ----------
  _scanZipPoint(dt) {
    this._zipScan -= dt;
    if (this._zipScan > 0) return;
    this._zipScan = 0.1;
    this.zipPoint = null;
    if (this.state === 'zip' || this.action) return;
    const cam = this.game.cam;
    const f = _v2.set(-Math.sin(cam.yaw) * Math.cos(cam.pitch), -Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch));
    const R = 70;
    const boxes = this.city.queryAABB(this.pos.x - R, this.pos.z - R, this.pos.x + R, this.pos.z + R, this._boxes);
    let best = null;
    let bestScore = -Infinity;
    const probe = _v3.copy(this.pos).addScaledVector(f, 30);
    for (const b of boxes) {
      if (b.type === 'bridge') continue;
      if (b.maxY < this.pos.y - 25 || b.maxY > this.pos.y + 70) continue;
      if (b.maxX - b.minX < 3 || b.maxZ - b.minZ < 3) continue;
      // point du bord du toit le plus proche de la sonde
      const px = clamp(probe.x, b.minX, b.maxX);
      const pz = clamp(probe.z, b.minZ, b.maxZ);
      const dxm = Math.min(px - b.minX, b.maxX - px);
      const dzm = Math.min(pz - b.minZ, b.maxZ - pz);
      let ex = px;
      let ez = pz;
      if (dxm < dzm) ex = px - b.minX < b.maxX - px ? b.minX : b.maxX;
      else ez = pz - b.minZ < b.maxZ - pz ? b.minZ : b.maxZ;
      const to = new THREE.Vector3(ex - this.pos.x, b.maxY - this.pos.y - 1, ez - this.pos.z);
      const d = to.length();
      if (d < 8 || d > R) continue;
      to.multiplyScalar(1 / d);
      const align = to.dot(f);
      if (align < 0.8) continue;
      const score = align * 40 - d * 0.25;
      if (score > bestScore) {
        bestScore = score;
        // léger retrait vers l'intérieur du toit
        const cx = (b.minX + b.maxX) / 2;
        const cz = (b.minZ + b.maxZ) / 2;
        const inward = new THREE.Vector3(cx - ex, 0, cz - ez).normalize();
        best = new THREE.Vector3(ex, b.maxY, ez).addScaledVector(inward, 0.6);
        best.inward = inward;
      }
    }
    this.zipPoint = best;
  }

  _startZip() {
    this.zipTarget = this.zipPoint.clone();
    this.zipTarget.inward = this.zipPoint.inward;
    this.setState('zip');
    this.vel.set(0, 0, 0);
    this.game.audio.play('thwip');
    this.zipLine = this.game.webs.acquire();
    this.zipLaunch = false;
  }

  _zip(dt, input) {
    const to = _v2.subVectors(this.zipTarget, this.pos);
    const d = to.length();
    const sp = Math.min(60, 20 + this.stateTime * 90);
    if (input.wasPressed('jump')) this.zipLaunch = true;
    if (d < sp * dt + 0.5) {
      this.pos.copy(this.zipTarget);
      this.game.webs.release(this.zipLine);
      this.zipLine = null;
      const inward = this.zipTarget.inward || _v3.set(0, 0, 0);
      if (this.zipLaunch || this.game.input.isDown('jump')) {
        // Point de lancement : propulsion vers le haut
        this.vel.set(inward.x * 14, 20, inward.z * 14);
        this.setState('air');
        this.game.audio.play('whoosh');
      } else {
        this.vel.set(inward.x * 3, 0, inward.z * 3);
        this.setState('ground');
        this.idleTime = 1.5;
        this.facing = Math.atan2(-inward.x, -inward.z);
      }
      return;
    }
    to.multiplyScalar(1 / d);
    this.vel.copy(to).multiplyScalar(sp);
    this.pos.addScaledVector(this.vel, dt);
    this.facing = Math.atan2(to.x, to.z);
    if (this.zipLine) {
      const hand = this.rig.handWorld('r', _v3);
      this.game.webs.update(this.zipLine, hand, this.zipTarget, 0.02);
    }
    if (this.stateTime > 3) {
      this.game.webs.release(this.zipLine);
      this.zipLine = null;
      this.setState('air');
    }
  }

  // Déplacement pendant une action (attaque, esquive, coup reçu...)
  _actionMove(dt) {
    const a = this.action;
    const fixedY = a.vel && typeof a.vel.y === 'number';
    if (a.vel) {
      this.vel.x = a.vel.x;
      this.vel.z = a.vel.z;
      if (fixedY) this.vel.y = a.vel.y;
    } else {
      this.vel.x *= 1 - Math.min(1, 12 * dt);
      this.vel.z *= 1 - Math.min(1, 12 * dt);
    }
    if (this.state === 'swing' || this.state === 'wall' || this.state === 'zip') this.setState('air');
    const airborne = this.pos.y - this.ground > 0.3 || this.vel.y > 0;
    if (airborne && !fixedY) {
      if (a.hover) this.vel.y = Math.max(this.vel.y - 4 * dt, -1);
      else this.vel.y -= G * dt;
    }
    this._integrate(dt);
    this._collide(false);
    this.ground = this.city.groundHeight(this.pos.x, this.pos.z, this.pos.y, RADIUS * 0.5);
    if (this.pos.y <= this.ground && this.vel.y <= 0) {
      this.pos.y = this.ground;
      this.vel.y = 0;
      this.airBoosts = 0;
      if (this.state !== 'ground') this.setState('ground');
    } else if (this.pos.y - this.ground > 0.4 && this.state === 'ground') {
      this.setState('air');
    }
    if (a.face !== undefined) this.facing = angleLerp(this.facing, a.face, damp(25, dt));
  }

  _integrate(dt) {
    const d = this.vel.length() * dt;
    const steps = Math.min(4, Math.max(1, Math.ceil(d / 0.9)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.pos.addScaledVector(this.vel, sdt);
      if (steps > 1) this._collide(false, true);
    }
  }

  // Collisions cylindre / boîtes. Renvoie le contact mural principal.
  _collide(stepUp, quiet = false) {
    const p = this.pos;
    const boxes = this.city.queryAABB(p.x - RADIUS - 0.1, p.z - RADIUS - 0.1, p.x + RADIUS + 0.1, p.z + RADIUS + 0.1, this._boxes);
    let contact = null;
    for (const b of boxes) {
      if (p.y >= b.maxY - 0.05) continue;
      if (p.y + HEIGHT <= b.minY) continue;
      const cx = clamp(p.x, b.minX, b.maxX);
      const cz = clamp(p.z, b.minZ, b.maxZ);
      let dx = p.x - cx;
      let dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) continue;
      // marche : petit rebord franchissable
      if (stepUp && this.state === 'ground' && b.maxY - p.y < 0.6) {
        p.y = b.maxY;
        continue;
      }
      // plafond (dessous du pont)
      if (b.minY > 1 && this.prevPos.y + HEIGHT <= b.minY + 0.2) {
        p.y = b.minY - HEIGHT;
        if (this.vel.y > 0) this.vel.y = 0;
        continue;
      }
      let nx = 0;
      let nz = 0;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d;
        nz = dz / d;
        p.x = cx + nx * RADIUS;
        p.z = cz + nz * RADIUS;
        // normale franche (face du bâtiment)
        if (Math.abs(nx) > Math.abs(nz)) {
          nx = Math.sign(nx);
          nz = 0;
        } else {
          nz = Math.sign(nz);
          nx = 0;
        }
      } else {
        const pen = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
        const m = Math.min(...pen);
        const k = pen.indexOf(m);
        if (k === 0) {
          p.x = b.minX - RADIUS;
          nx = -1;
        } else if (k === 1) {
          p.x = b.maxX + RADIUS;
          nx = 1;
        } else if (k === 2) {
          p.z = b.minZ - RADIUS;
          nz = -1;
        } else {
          p.z = b.maxZ + RADIUS;
          nz = 1;
        }
      }
      if (quiet) continue; // sous-pas : on corrige seulement la position
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn < 0) {
        contact = { normal: new THREE.Vector3(nx, 0, nz), box: b, speed: -vn };
        this.vel.x -= nx * vn;
        this.vel.z -= nz * vn;
      }
      if (!contact) contact = { normal: new THREE.Vector3(nx, 0, nz), box: b, speed: 0 };
    }
    return contact;
  }

  // ---------- Dégâts ----------
  takeDamage(amount, from, kind = 'hit') {
    if (this.invuln > 0 || this.game.godMode) return false;
    if (this.action && this.action.iframes) return false;
    amount *= this.game.stats.dmgTakenMul;
    this.health -= amount;
    this.lastHurt = this.time;
    this.lastCombat = this.time;
    this.game.combat.onPlayerHurt();
    this.game.audio.play('hurt');
    this.game.cam.shake(0.35);
    this.game.hud.hurtFlash();
    this.game.fx.sparks(this.chestPos, 10, '#ff6060', 6);
    if (from) {
      const d = _v2.subVectors(this.pos, from);
      d.y = 0;
      if (d.lengthSq() > 0.001) d.normalize();
      const k = kind === 'heavy' || kind === 'explosion' ? 12 : 5;
      this.action = { kind: 'hit', t: 0, dur: kind === 'heavy' || kind === 'explosion' ? 0.7 : 0.35, lock: true, vel: { x: d.x * k, z: d.z * k, y: kind === 'explosion' ? 9 : null } };
      if (kind === 'explosion') this.vel.y = 9;
      this.facing = Math.atan2(-d.x, -d.z);
    }
    this.invuln = 0.25;
    if (this.health <= 0) {
      this.health = 0;
      this.game.onPlayerDeath();
    }
    return true;
  }

  // ---------- Animation ----------
  animate(dt) {
    const rig = this.rig;
    // lueur nocturne du costume
    const glow = this.game.env ? this.game.env.night * 0.32 : 0;
    if (Math.abs(glow - (this._glow || 0)) > 0.01) {
      this._glow = glow;
      const mats = this.suits[this.suitKey];
      for (const k of ['head', 'torso', 'pelvis', 'upperArm', 'foreArm', 'hand', 'thigh', 'shin', 'foot']) mats[k].emissiveIntensity = glow;
    }
    const g = rig.group;
    g.position.copy(this.pos);
    g.rotation.set(0, this.facing, 0);
    let pose;
    let speed = 14;
    const a = this.action;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.landT = Math.min(1, this.landT + dt * 2.5);
    if (this.boostT > 0) this.boostT -= dt;
    let armTarget = null;
    if (a && a.pose) {
      pose = a.pose;
      speed = a.blend || 30;
    } else if (this.state === 'ground') {
      if (this.charging > 0.15) {
        const c = Math.min(1, this.charging);
        pose = A.lerpPose(A.idle(this.time), A.land(0), 0.5 + c * 0.5);
        speed = 12;
      } else if (this.landT < 1 && hs < 12) {
        pose = A.land(this.landT);
        speed = 20;
      } else if (hs > 0.6) {
        this.runPhase += dt * (4 + hs * 0.55);
        const sprint = clamp((hs - RUN) / (SPRINT - RUN), 0, 1);
        pose = A.run(this.runPhase, clamp(hs / RUN, 0.3, 1), sprint);
        speed = 18;
      } else if (this.game.combat.inCombat) {
        pose = A.guard(this.time);
      } else if (this.idleTime > 2.5 && this.pos.y > 4) {
        pose = A.perch(this.time);
        speed = 6;
      } else pose = A.idle(this.time);
    } else if (this.state === 'air') {
      if (this.diveT > 0) this.diveT -= dt;
      if (this.boostT > 0) pose = A.zip(this.time);
      else if (this.diveT > 0 || (this.vel.y < -20 && hs < 25)) pose = A.dive(this.time);
      else pose = A.jump(this.vel.y);
      speed = 8;
    } else if (this.state === 'swing') {
      const rope = _v2.subVectors(this.anchor, this.pos).normalize();
      // direction de la corde dans le repère du personnage
      const cf = Math.cos(this.facing);
      const sf = Math.sin(this.facing);
      const lx = rope.x * cf - rope.z * sf;
      const lz = rope.x * sf + rope.z * cf;
      const pitch = Math.atan2(lz, rope.y) * 0.8;
      const roll = Math.atan2(-lx, rope.y) * 0.6;
      const fwdV = this.vel.y / Math.max(1, this.vel.length());
      pose = A.swing(clamp(fwdV * 1.5, -1, 1), pitch, roll, this.time);
      speed = 10;
      armTarget = rope.clone();
    } else if (this.state === 'wall') {
      this.runPhase += dt * (this.vel.length() * 1.2);
      pose = A.climb(this.runPhase, this.vel.lengthSq() > 0.5 ? 1 : 0);
    } else if (this.state === 'zip') {
      pose = A.zip(this.time);
      armTarget = this.zipTarget ? _v3.subVectors(this.zipTarget, this.pos).normalize().clone() : null;
    }
    rig.apply(pose, dt, speed);
    if (this.aim && this.aim.t > 0) {
      this.aim.t -= dt;
      rig.pointArm('r', this.aim.dir, 1);
    }
    if (armTarget) rig.pointArm(this.state === 'zip' ? 'r' : this.swingSide > 0 ? 'l' : 'r', armTarget, 1);
    if (this.state === 'wall') {
      // plaqué contre le mur
      g.position.addScaledVector(this.wall.normal, -0.12);
    }
  }
}
