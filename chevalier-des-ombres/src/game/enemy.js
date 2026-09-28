// Ennemis : construction du modèle selon le bestiaire et IA (patrouille, alerte, poursuite,
// jetons d'attaque, attaques au corps à corps/à distance/zone/bond/charge/souffle,
// téléportation, invocation, explosion, embuscade, vol, invisibilité).
import * as THREE from 'three';
import { Actor } from './actor.js';
import { buildHumanoid, buildQuadruped, buildSpider, buildBat, buildBlob, buildSerpent, buildWisp, buildEye, buildTentacle, buildMimic, buildDragon } from '../actors/models.js';
import { H_CLIPS } from '../actors/anims.js';
import { createCharMaterial, createSpectralMaterial } from '../gfx/materials.js';
import { createGlbCharacter, hasModel } from '../actors/glb.js';
import { tierStats } from '../data/enemies.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { clamp, rand, angleDiff, dampAngle, pick } from '../core/utils.js';
import { ELEMENT_COLORS } from '../gfx/effects.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export function buildModelFor(def) {
  // Modèle 3D texturé (données installées) quand il existe pour ce type d'ennemi
  if (def.glb && settings.get('charModel') !== 'classic' && hasModel(def.glb.model)) {
    const built = createGlbCharacter(def.glb.model, def.glb.variant, { rim: def.rim || 0x1a1428, glow: def.glb.glow || 1.6, height: 1.92 });
    if (built) {
      built.weaponMat = createCharMaterial({ rim: def.rim || 0x000000 });
      return built;
    }
  }
  const spec = { ...(def.model || {}) };
  if (def.extras) spec.extras = [...(spec.extras || []), ...def.extras];
  const mat = def.spectral ? createSpectralMaterial(def.spectral, { fadeLow: def.hover ? 0.5 : 0.1 }) : createCharMaterial({ rim: def.rim || 0x000000 });
  let built;
  switch (def.rig) {
    case 'quad':
      built = buildQuadruped(spec, mat);
      break;
    case 'spider':
      built = buildSpider(spec, mat);
      break;
    case 'bat':
      built = buildBat(spec, mat);
      break;
    case 'blob':
      built = buildBlob(spec, mat);
      break;
    case 'serpent':
      built = buildSerpent(spec, mat);
      break;
    case 'wisp':
      built = buildWisp(spec, mat);
      break;
    case 'eye':
      built = buildEye(spec, mat);
      break;
    case 'tentacle':
      built = buildTentacle(spec, mat);
      break;
    case 'mimic':
      built = buildMimic(spec, mat);
      break;
    case 'dragon':
      built = buildDragon(spec, mat);
      break;
    default:
      built = buildHumanoid(spec, mat);
  }
  if (def.spectral) built.mesh.castShadow = false;
  return built;
}

export class Enemy extends Actor {
  constructor(game, def, x, z, opts = {}) {
    super(game, 'enemy');
    this.def = def;
    this.isBoss = false;
    this.tier = opts.tier || 1;
    this.camp = opts.camp || null;
    this.scale = (def.scale || 1) * (opts.scaleMul || 1);
    this.home = new THREE.Vector3(x, 0, z);
    this.pos.set(x, game.world.heightAt(x, z), z);
    this.yaw = opts.yaw ?? rand(0, Math.PI * 2);
    const diff = settings.difficulty;
    const ts = tierStats(this.tier);
    this.maxHp = Math.round(ts.hp * (def.hpMul || 1) * diff.enemyHp * (opts.hpMul || 1));
    this.hp = this.maxHp;
    this.dmg = ts.dmg * (def.dmgMul || 1) * diff.enemyDmg;
    this.xp = ts.xp * (def.hpMul || 1) * (opts.xpMul || 1) * diff.xp;
    this.shards = ts.shards * (def.shardMul || 1) * (0.7 + (def.hpMul || 1) * 0.3);
    this.maxPoise = this.poise = def.poise || 20;
    this.speed = def.speed || 3;
    this.kind = def.kind || 'flesh';
    this.undead = !!def.undead;
    this.resist = def.resist || {};
    this.weak = def.weak || [];
    this.radius = def.rig === 'quad' ? 0.55 * this.scale : def.rig === 'spider' ? 0.9 * this.scale : def.rig === 'blob' ? 0.55 * this.scale : def.rig === 'tentacle' ? 1.2 * this.scale : def.rig === 'serpent' ? 0.6 * this.scale : 0.45 * this.scale;
    this.hoverBase = def.hover ? 0.25 : 0;
    this.flyAlt = def.flying || 0;
    this.state = def.dormant ? 'dormant' : 'idle';
    this.stateT = 0;
    this.cooldowns = def.attacks.map(() => rand(0.5, 2));
    this.curAtk = null;
    this.hasToken = false;
    this.aggro = def.ai === 'ranged' || def.ai === 'caster' ? 22 : def.ai === 'ambusher' ? 5 : 17;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.lastHit = -10;
    this.teleportCd = rand(3, 6);
    this.summons = [];
    this.revives = def.revives || 0;
    this.remove = false;
    this.clone = !!opts.clone;
    this.opts = opts;
    this.lastPos = new THREE.Vector3();
    this.stuckT = 0;
    this.buildModel();
  }

  buildModel() {
    const def = this.def;
    const built = buildModelFor(def);
    this.setModel(built, { stance: def.stance || 'none', twoHanded: !!def.twoHanded, hunch: def.hunch || 0, hover: def.hover || 0, limp: def.limp || 0 });
    this.height = (built.height || 1.9) * this.scale;
    if (def.rig === 'humanoid') {
      if (def.weapon) this.attachWeapon(def.weapon);
      if (def.shield) this.attachShield(def.shield);
    }
    if (def.spectral) this.mat.uniforms.uOpacity.value = 0.95;
    if (this.clone) {
      this.maxHp = this.hp = 1;
      if (this.mat.userData.u && this.mat.userData.u.uRim) this.mat.userData.u.uRim.value.setHex(0x9a4dff);
    }
  }

  get staggered() {
    return this.state === 'stagger';
  }

  get player() {
    return this.game.player;
  }

  // ---------------- IA ----------------
  update(dt) {
    const g = this.game;
    const p = this.player;
    if (!this.alive) {
      this.deadT += dt;
      this.dissolve = Math.min(1, Math.max(0, (this.deadT - 0.6) / 1.2));
      this.anim.update(dt, { speed: 0 });
      if (this.def.rig === 'bat' || this.flyAlt) this.pos.y = Math.max(g.world.heightAt(this.pos.x, this.pos.z), this.pos.y - dt * 6);
      this.updateVisual(dt);
      if (this.deadT > 2) this.remove = true;
      return;
    }
    const d = this.distTo(p);
    // Mise en sommeil loin du joueur
    const far = d > 75 && !this.isBoss;
    if (this.mesh) this.mesh.visible = !far;
    if (far) {
      if (this.state !== 'idle' && this.state !== 'dormant') this._setState('idle');
      return;
    }
    // En veille (hors du budget d'ennemis actifs) : animation au ralenti, pas d'IA
    if (this.sleeping) {
      this.sleepT = (this.sleepT || 0) + dt;
      if (this.sleepT > 0.12) {
        this.anim.update(this.sleepT, { speed: 0 });
        this.updateVisual(this.sleepT);
        this.sleepT = 0;
      }
      return;
    }
    this.updateStatus(dt);
    this.stateT += dt;
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] -= dt;
    this.teleportCd -= dt;
    if (g.time - this.lastHit > 3) this.poise = Math.min(this.maxPoise, this.poise + this.maxPoise * 0.3 * dt);
    let moveSpeed = 0;
    let lookYaw = 0;
    if (this.stunned) {
      this.anim.update(dt, { speed: 0 });
      this.updateVisual(dt);
      return;
    }
    const ai = this.def.ai;
    switch (this.state) {
      case 'dormant': {
        if (this.def.rig === 'mimic') this.anim.update(dt, { speed: 0, dormant: true });
        if (p.alive && d < (this.def.rig === 'mimic' ? 2.6 : 4.5)) {
          this._setState('alert');
          if (this.def.rig === 'mimic') this.anim.play('awaken', 1, { dur: 0.8 });
          audio.play('growl', { pos: this.pos, pitch: 0.8 });
        }
        this.updateVisual(dt);
        this._invisibility(dt, d);
        return;
      }
      case 'idle': {
        // Errance autour du point de départ
        if (!this.wanderT || this.stateT > this.wanderT) {
          this.stateT = 0;
          this.wanderT = rand(2.5, 6);
          const a = rand(0, Math.PI * 2);
          const r = rand(0, 5);
          this.wander = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r, move: Math.random() < 0.6 };
        }
        if (this.wander && this.wander.move && !this.def.static) {
          const wd = Math.hypot(this.wander.x - this.pos.x, this.wander.z - this.pos.z);
          if (wd > 0.8) {
            this.faceTowards(this.wander.x, this.wander.z, 4, dt);
            moveSpeed = this.speed * 0.35;
          }
        }
        // Furtivité : détection réduite, surtout de dos
        const stealth = p.sneaking ? (Math.abs(this.angleTo(p)) > 1.7 ? 0.2 : 0.45) : 1;
        if (p.alive && d < this.aggro * stealth && this._canSee(p)) this._setState('alert');
        break;
      }
      case 'alert': {
        this.faceTowards(p.pos.x, p.pos.z, 8, dt);
        if (this.stateT < 0.02) {
          const s = this.def.kind === 'spirit' ? 'screech' : 'growl';
          audio.play(s, { pos: this.pos, pitch: 1.2 / this.scale });
          g.alertNearby(this);
        }
        if (this.stateT > 0.5) this._setState('chase');
        break;
      }
      case 'chase': {
        if (!p.alive) {
          this._setState('return');
          break;
        }
        if (Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) > 50 && !this.opts.summoned) {
          this._setState('return');
          break;
        }
        lookYaw = clamp(this.angleTo(p), -0.8, 0.8);
        // Téléportation
        if ((ai === 'teleporter') && this.teleportCd <= 0 && d > 3.5 && d < 25) {
          this._startTeleport();
          break;
        }
        const atk = this._chooseAttack(d);
        if (atk) {
          this._startAttack(atk);
          break;
        }
        moveSpeed = this._approach(dt, d);
        break;
      }
      case 'attack':
        moveSpeed = this._updateAttack(dt, d);
        break;
      case 'recover':
        this.faceTowards(p.pos.x, p.pos.z, 3, dt);
        if (this.stateT > this.recoverT) this._setState('chase');
        break;
      case 'stagger':
        if (this.stateT > this.staggerT) this._setState('chase');
        break;
      case 'teleport':
        this._updateTeleport(dt);
        break;
      case 'return': {
        const hd = Math.hypot(this.home.x - this.pos.x, this.home.z - this.pos.z);
        this.faceTowards(this.home.x, this.home.z, 6, dt);
        moveSpeed = this.speed;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * dt);
        if (hd < 2) this._setState('idle');
        if (p.alive && d < this.aggro * 0.6) this._setState('chase');
        break;
      }
      default:
    }
    // Déplacement
    moveSpeed *= this.slowFactor;
    if (this.def.static) moveSpeed = 0;
    if (moveSpeed > 0 || this.knockV) {
      const fx = this.moveDirX ?? Math.sin(this.yaw);
      const fz = this.moveDirZ ?? Math.cos(this.yaw);
      this.pos.x += fx * moveSpeed * dt + (this.knockV ? this.knockV.x * dt : 0);
      this.pos.z += fz * moveSpeed * dt + (this.knockV ? this.knockV.z * dt : 0);
      if (this.knockV) {
        this.knockV.multiplyScalar(Math.exp(-7 * dt));
        if (this.knockV.lengthSq() < 0.05) this.knockV = null;
      }
      this._separate();
      g.world.colliders.resolve(this.pos, this.radius, this.pos.y + 0.3, this.height);
    }
    this.moveDirX = undefined;
    this.moveDirZ = undefined;
    // Hauteur (sol, vol, flottement)
    const gh = g.world.heightAt(this.pos.x, this.pos.z);
    if (this.flyAlt && !this.leaping) {
      const want = gh + (this.diving ? 0.2 : this.flyAlt) + Math.sin(g.time * 2 + this.id) * 0.2;
      this.pos.y += (want - this.pos.y) * (1 - Math.exp(-4 * dt));
    } else if (!this.leaping) {
      const liq = g.world.liquidLevel;
      this.pos.y = Math.max(gh, this.def.rig === 'serpent' ? Math.max(gh, liq - 0.35) : gh);
    }
    this.hover = this.hoverBase;
    this.speedNow = moveSpeed;
    this.anim.update(dt, { speed: moveSpeed, grounded: true, lookYaw, flying: this.flyAlt > 0 });
    this._invisibility(dt, d);
    this.updateVisual(dt);
    // Aura (élémentaire de feu)
    if (this.def.aura && p.alive && d < this.def.aura.radius) {
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0) {
        this.auraT = 0.5;
        g.combat.hit(p, { amount: this.dmg * this.def.aura.dps, element: this.def.aura.element, source: this, kind: 'hazard', canBlock: false, poise: 0, silent: true });
      }
    }
  }

  _invisibility(dt, d) {
    if (!this.def.invisible) return;
    const visible = this.state === 'attack' || this.state === 'stagger' || this.game.time - this.lastHit < 2 || d < 2.5;
    const target = visible ? 0 : 0.88;
    this.dissolve += (target - this.dissolve) * (1 - Math.exp(-5 * dt));
  }

  _setState(s) {
    if (this.state === 'attack' && s !== 'attack') this._releaseToken();
    this.state = s;
    this.stateT = 0;
  }

  _canSee(p) {
    if (Math.abs(p.pos.y - this.pos.y) > 12) return false;
    const t = this.game.world.colliders.segment(this.pos.x, this.pos.y + 1.5, this.pos.z, p.pos.x, p.pos.y + 1.5, p.pos.z, 2);
    return t >= 1;
  }

  _separate() {
    for (const o of this.game.enemies) {
      if (o === this || !o.alive) continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const rr = this.radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const dd = Math.sqrt(d2);
        const push = (rr - dd) * 0.5;
        this.pos.x += (dx / dd) * push;
        this.pos.z += (dz / dd) * push;
      }
    }
    // Ne pas traverser le joueur
    const p = this.player;
    const dx = this.pos.x - p.pos.x;
    const dz = this.pos.z - p.pos.z;
    const rr = this.radius + p.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6 && !this.flyAlt) {
      const dd = Math.sqrt(d2);
      this.pos.x += (dx / dd) * (rr - dd);
      this.pos.z += (dz / dd) * (rr - dd);
    }
  }

  // Se rapprocher / garder ses distances / tourner autour
  _approach(dt, d) {
    const p = this.player;
    const def = this.def;
    this.faceTowards(p.pos.x, p.pos.z, 7, dt);
    const keep = def.keepDist || 0;
    if (keep) {
      if (d < keep * 0.6) {
        this.moveDirX = -Math.sin(this.yaw);
        this.moveDirZ = -Math.cos(this.yaw);
        return this.speed * 0.7;
      }
      if (d < keep * 1.3) {
        this.moveDirX = Math.cos(this.yaw) * this.strafeDir;
        this.moveDirZ = -Math.sin(this.yaw) * this.strafeDir;
        if (Math.random() < dt * 0.3) this.strafeDir *= -1;
        return this.speed * 0.4;
      }
      return this.speed;
    }
    // Pas de jeton : tourne autour à distance
    const meleeRange = Math.max(...def.attacks.filter((a) => a.type === 'melee').map((a) => a.range), 2);
    if (d < meleeRange + 2.5 && !this.hasToken && !this.game.requestToken(this, true)) {
      if (d < 3.5) {
        this.moveDirX = -Math.sin(this.yaw);
        this.moveDirZ = -Math.cos(this.yaw);
        return this.speed * 0.4;
      }
      this.moveDirX = Math.cos(this.yaw) * this.strafeDir;
      this.moveDirZ = -Math.sin(this.yaw) * this.strafeDir;
      if (Math.random() < dt * 0.4) this.strafeDir *= -1;
      return this.speed * 0.45;
    }
    if (d < meleeRange * 0.8) return 0;
    return this.speed * (d > 8 ? 1 : 0.85);
  }

  _chooseAttack(d) {
    const def = this.def;
    const opts = [];
    def.attacks.forEach((a, i) => {
      if (this.cooldowns[i] > 0) return;
      if (d > a.range || (a.minRange && d < a.minRange)) return;
      if (a.type === 'summon' && this.summons.filter((s) => s.alive).length >= 4) return;
      opts.push(i);
    });
    if (!opts.length) return null;
    const i = pick(opts);
    const a = def.attacks[i];
    if (a.type === 'melee' || a.type === 'leap' || a.type === 'explode') {
      if (!this.hasToken && !this.game.requestToken(this)) return null;
    }
    if (a.type !== 'melee' && a.type !== 'explode' && !this._canSee(this.player)) return null;
    this.cooldowns[i] = a.cd * rand(0.8, 1.25);
    return a;
  }

  _startAttack(atk) {
    const g = this.game;
    this._setState('attack');
    this.curAtk = atk;
    this.hitDone = false;
    this.fired = false;
    this.atkT = 0;
    const tel = settings.difficulty.telegraph;
    const speed = (atk.speed || 1) / tel / Math.max(0.8, Math.sqrt(this.scale) * 0.9);
    let clip = H_CLIPS[atk.anim];
    if (this.def.rig === 'humanoid' && clip) {
      this.anim.play(atk.anim, speed);
      this.atkDur = clip.dur / speed;
      this.atkHit = clip.hit || [0.45, 0.55];
    } else {
      const dur = (atk.dur || 0.8) / speed;
      this.anim.play(atk.anim, 1, { dur });
      this.atkDur = dur;
      this.atkHit = atk.hit || [0.45, 0.6];
    }
    // Signal visuel de l'attaque (reflet orangé)
    this.flash(0xffa040, 0.6);
    if (atk.type === 'aoe' || atk.type === 'meteor') {
      const p = this.player;
      const delay = (atk.telegraph || this.atkDur * this.atkHit[0]) * tel;
      const center = atk.atTarget ? { x: p.pos.x, z: p.pos.z } : { x: this.pos.x, z: this.pos.z };
      if (atk.type === 'meteor') {
        for (let k = 0; k < (atk.count || 3); k++) {
          const a = rand(0, Math.PI * 2);
          const r = k === 0 ? 0 : rand(2, 6);
          g.combat.zone({ x: p.pos.x + Math.cos(a) * r, z: p.pos.z + Math.sin(a) * r, radius: atk.radius, delay: delay + k * 0.2, dmg: this.dmg * atk.dmg, element: atk.element, team: 'enemy', source: this, visual: 'meteor', status: atk.status });
        }
      } else {
        g.combat.zone({ x: center.x, z: center.z, radius: atk.radius, delay, dmg: this.dmg * atk.dmg, element: atk.element || 'physical', team: 'enemy', source: this, status: atk.status, visual: this.def.rig === 'tentacle' ? 'tentacle' : undefined });
      }
    }
    if (atk.type === 'leap') {
      const p = this.player;
      this.leapFrom = this.pos.clone();
      this.leapTo = new THREE.Vector3(p.pos.x, 0, p.pos.z);
      const back = Math.hypot(this.leapTo.x - this.pos.x, this.leapTo.z - this.pos.z);
      if (back > atk.range) this.leapTo.lerpVectors(this.pos, this.leapTo, atk.range / back);
      g.effects.telegraph({ x: this.leapTo.x, z: this.leapTo.z, radius: atk.radius || 2.5, duration: this.atkDur * this.atkHit[0] });
    }
    if (atk.type === 'breath' || atk.type === 'beam') this.tickT = 0;
    if (atk.type === 'scream') g.effects.telegraph({ x: this.pos.x, z: this.pos.z, radius: atk.radius, duration: this.atkDur * this.atkHit[0], follow: this.pos });
    if (atk.type === 'explode') g.effects.telegraph({ x: this.pos.x, z: this.pos.z, radius: atk.radius, duration: this.atkDur * this.atkHit[0], follow: this.pos });
  }

  _updateAttack(dt, d) {
    const g = this.game;
    const p = this.player;
    const atk = this.curAtk;
    this.atkT += dt;
    const t = this.atkT / this.atkDur;
    const [h0, h1] = this.atkHit;
    let move = 0;
    // Suivi de la cible pendant l'élan
    if (t < h0 * 0.85 && atk.type !== 'charge') this.faceTowards(p.pos.x, p.pos.z, 9, dt);
    switch (atk.type) {
      case 'melee': {
        if (t > 0.1 && t < h1 && d > atk.range * 0.6) move = this.speed * 0.9;
        if (atk.anim === 'dive') {
          this.diving = t > 0.3 && t < 0.8;
          move = t < 0.8 ? this.speed * 1.4 : 0;
        }
        if (!this.hitDone && t >= h0 && t <= h1) {
          const ang = Math.abs(this.angleTo(p));
          const arc = atk.arc || 1.3;
          if (d <= atk.range * this.scale ** 0.5 + p.radius && (arc >= 6 || ang <= arc / 2 + 0.3) && Math.abs(p.pos.y - this.pos.y - this.hover) < 2.5 + this.flyAlt) {
            this.hitDone = true;
            this._hitPlayer(atk, 'melee');
          }
        }
        break;
      }
      case 'projectile':
        if (!this.fired && t >= h0) {
          this.fired = true;
          this._fire(atk);
        }
        break;
      case 'leap': {
        const k = clamp((t - 0.15) / (h0 - 0.15), 0, 1);
        if (t > 0.15 && t <= h0) {
          this.leaping = true;
          this.pos.x = this.leapFrom.x + (this.leapTo.x - this.leapFrom.x) * k;
          this.pos.z = this.leapFrom.z + (this.leapTo.z - this.leapFrom.z) * k;
          const gh = g.world.heightAt(this.pos.x, this.pos.z);
          this.pos.y = gh + Math.sin(k * Math.PI) * 3.5;
        }
        if (t > h0 && !this.hitDone) {
          this.hitDone = true;
          this.leaping = false;
          this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
          const r = atk.radius || 2.5;
          g.effects.ring(this.pos, 0xffc080, r * 1.2, 0.4);
          g.effects.dust(this.pos, 12);
          g.camRig.shake(0.3);
          audio.play('land', { pos: this.pos, heavy: true });
          if (Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < r + p.radius) this._hitPlayer(atk, 'aoe');
        }
        break;
      }
      case 'breath': {
        if (t >= h0 && t <= h1) {
          this.faceTowards(p.pos.x, p.pos.z, 1.5, dt);
          const col = ELEMENT_COLORS[atk.element] || 0xff6a1a;
          const hx = this.pos.x + this.forwardX * 0.8 * this.scale;
          const hz = this.pos.z + this.forwardZ * 0.8 * this.scale;
          const hy = this.pos.y + this.height * 0.6;
          for (let k = 0; k < 3; k++) {
            const a = this.yaw + rand(-atk.arc, atk.arc) * 0.6;
            const sp = rand(7, 11);
            g.particles.spawn(hx, hy, hz, Math.sin(a) * sp, rand(-0.5, 0.5), Math.cos(a) * sp, atk.range / sp, rand(0.4, 0.8), col, { intensity: 2, grow: 1.5, drag: 0.98 });
          }
          this.tickT -= dt;
          if (this.tickT <= 0) {
            this.tickT = 0.25;
            const ang = Math.abs(this.angleTo(p));
            if (d < atk.range && ang < atk.arc) this._hitPlayer(atk, 'aoe', true);
          }
        }
        break;
      }
      case 'beam': {
        if (t >= h0 && t <= h1) {
          this.faceTowards(p.pos.x, p.pos.z, 1.2, dt);
          const from = _v.set(this.pos.x, this.pos.y + this.hover + this.height * 0.6, this.pos.z);
          const len = atk.range;
          const to = _w.set(from.x + this.forwardX * len, p.pos.y + 1, from.z + this.forwardZ * len);
          g.effects.beam(from, to, ELEMENT_COLORS[atk.element] || 0xff3a8a, 0.25, 0.06);
          this.tickT -= dt;
          if (this.tickT <= 0) {
            this.tickT = 0.2;
            const ang = Math.abs(this.angleTo(p));
            if (d < len && ang < Math.atan2(1, d)) this._hitPlayer(atk, 'aoe', true);
          }
        }
        break;
      }
      case 'drain': {
        if (t >= 0.25 && t <= 0.95 && d < atk.range && this._canSee(p)) {
          const from = _v.set(this.pos.x, this.pos.y + this.hover + this.height * 0.7, this.pos.z);
          const to = _w.set(p.pos.x, p.pos.y + 1.2, p.pos.z);
          g.effects.beam(from, to, 0x7affd0, 0.12, 0.06);
          this.tickT = (this.tickT || 0) - dt;
          if (this.tickT <= 0) {
            this.tickT = 0.35;
            const r = g.combat.hit(p, { amount: this.dmg * atk.dmg, element: 'shadow', source: this, kind: 'aoe', canBlock: false, poise: 0 });
            if (r && r.dmg) this.hp = Math.min(this.maxHp, this.hp + r.dmg);
          }
        }
        break;
      }
      case 'summon':
        if (!this.fired && t >= h0) {
          this.fired = true;
          this._summon(atk);
        }
        break;
      case 'scream':
        if (!this.fired && t >= h0) {
          this.fired = true;
          g.effects.ring(this.pos, 0xb8c8ff, atk.radius * 1.2, 0.5, 1.2);
          g.camRig.shake(0.25);
          audio.play('screech', { pos: this.pos, pitch: 0.8 });
          if (d < atk.radius + p.radius) this._hitPlayer({ ...atk, stun: atk.stun || 1 }, 'aoe');
        }
        break;
      case 'explode':
        move = t < h0 ? this.speed * 0.5 : 0;
        if (!this.fired && t >= h0) {
          this.fired = true;
          const col = ELEMENT_COLORS[atk.element] || 0x7affd0;
          g.effects.elementBurst(this.pos, atk.element || 'shadow', 1.4);
          g.effects.ring(this.pos, col, atk.radius * 1.3, 0.4, 0.8);
          audio.play('explosion', { pos: this.pos });
          if (d < atk.radius + p.radius) this._hitPlayer(atk, 'aoe');
          if (atk.status && atk.status.poison) g.combat.hazard({ x: this.pos.x, z: this.pos.z, radius: atk.radius, duration: 4, dps: this.dmg * 0.3, element: 'poison', team: 'enemy', source: this, status: { poison: 3 } });
          this.die(true);
          return 0;
        }
        break;
      default:
    }
    if (t >= 1) {
      this.leaping = false;
      this.diving = false;
      this.curAtk = null;
      this._setState('recover');
      this.recoverT = rand(0.3, 0.9) * settings.difficulty.telegraph;
    }
    return move;
  }

  _hitPlayer(atk, kind, tick = false) {
    const p = this.player;
    const amount = this.dmg * (atk.dmg || 1) * (tick ? 1 : 1);
    const status = atk.status ? { ...atk.status } : null;
    this.game.combat.hit(p, {
      amount, element: atk.element || this.def.element || 'physical', source: this, kind, canBlock: !tick, poise: tick ? 0 : 20 * (atk.dmg || 1) * Math.sqrt(this.scale),
      knock: atk.knock || (kind === 'aoe' ? 5 : 2.5), status, stun: atk.stun, lifesteal: atk.lifesteal, dirX: p.pos.x - this.pos.x, dirZ: p.pos.z - this.pos.z,
    });
  }

  _fire(atk) {
    const g = this.game;
    const p = this.player;
    const n = atk.count || 1;
    const from = new THREE.Vector3(this.pos.x + this.forwardX * 0.6 * this.scale, this.pos.y + this.hover + this.height * 0.65, this.pos.z + this.forwardZ * 0.6 * this.scale);
    const target = new THREE.Vector3(p.pos.x + p.vel.x * 0.25, p.pos.y + 1.1, p.pos.z + p.vel.z * 0.25);
    const base = Math.atan2(target.x - from.x, target.z - from.z);
    const hd = Math.hypot(target.x - from.x, target.z - from.z);
    const pitch = Math.atan2(target.y - from.y, hd);
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i / (n - 1) - 0.5) * (atk.spread || 0.3) * 2 : 0);
      const dir = new THREE.Vector3(Math.sin(a) * Math.cos(pitch), Math.sin(pitch), Math.cos(a) * Math.cos(pitch));
      g.combat.projectile({ type: atk.proj, from, dir, target, team: 'enemy', dmg: this.dmg * atk.dmg, element: atk.element, status: atk.status, homing: atk.homing || 0, homingTarget: p, source: this });
    }
    audio.play(atk.proj === 'arrow' ? 'shoot' : 'cast', { pos: this.pos, kind: atk.proj === 'arrow' ? 'arrow' : null, element: atk.element });
  }

  _summon(atk) {
    const g = this.game;
    const n = atk.count || 1;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(2, 4);
      const x = this.pos.x + Math.cos(a) * r;
      const z = this.pos.z + Math.sin(a) * r;
      const e = g.spawnEnemy(atk.summon, x, z, { tier: this.tier, summoned: true, xpMul: 0.3 });
      if (e) {
        e.state = 'chase';
        this.summons.push(e);
        g.effects.smoke({ x, y: g.world.heightAt(x, z), z }, 8, 0x1a3a2a);
        g.particles.burst({ x, y: g.world.heightAt(x, z) + 0.5, z }, 0x39ff9a, 16, 3, 0.35, 0.8, { intensity: 2 });
      }
    }
    audio.play('cast', { pos: this.pos, element: 'shadow' });
  }

  _startTeleport() {
    this._setState('teleport');
    this.tpPhase = 0;
    this.teleportCd = rand(5, 9);
  }

  _updateTeleport(dt) {
    const g = this.game;
    const p = this.player;
    if (this.tpPhase === 0) {
      this.dissolve = Math.min(1, this.dissolve + dt * 4);
      if (this.dissolve >= 1) {
        const a = p.yaw + Math.PI + rand(-0.8, 0.8);
        const r = rand(2.2, 3.5);
        const nx = p.pos.x + Math.sin(a) * r;
        const nz = p.pos.z + Math.cos(a) * r;
        g.particles.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, this.def.spectral || 0x9a4dff, 14, 3, 0.4, 0.6, { intensity: 2 });
        this.pos.set(nx, g.world.heightAt(nx, nz), nz);
        g.world.colliders.resolve(this.pos, this.radius);
        this.faceTowards(p.pos.x, p.pos.z, -1, 0);
        this.tpPhase = 1;
        audio.play('cast', { pos: this.pos, element: 'shadow' });
      }
    } else {
      this.dissolve = Math.max(this.def.invisible ? 0.3 : 0, this.dissolve - dt * 4);
      if (this.dissolve <= (this.def.invisible ? 0.3 : 0)) {
        const melee = this.def.attacks.find((a) => a.type === 'melee');
        if (melee) {
          this.game.requestToken(this);
          this._startAttack(melee);
        } else this._setState('chase');
      }
    }
    this.anim.update(dt, { speed: 0 });
    this.updateVisual(dt);
  }

  // ---------------- Dégâts reçus ----------------
  receiveHit(info) {
    if (!this.alive) return null;
    const g = this.game;
    if (this.untargetable) return null;
    let amount = info.amount;
    // Ennemis qui bloquent de face (chevaliers squelettes)
    if (this.def.blocks && info.kind === 'melee' && !info.noBlock && this.state !== 'stagger' && this.state !== 'attack' && info.source) {
      const ang = Math.abs(angleDiff(this.yaw, Math.atan2(info.source.pos.x - this.pos.x, info.source.pos.z - this.pos.z)));
      if (ang < 1.1 && Math.random() < this.def.blocks) {
        amount *= 0.2;
        this.poise -= (info.poise || 10) * 0.6;
        audio.play('block', { pos: this.pos });
        if (this.poise <= 0) this._stagger(1.4);
        this.hp -= amount;
        this.lastHit = g.time;
        if (this.hp <= 0) this.die();
        return { dmg: amount, blocked: true };
      }
    }
    // Parade ennemie (chevaliers déchus, Valdric…)
    if (this.def.parries && info.kind === 'melee' && !info.noBlock && this.state === 'chase' && Math.random() < this.def.parries * 0.5 && info.source === g.player) {
      audio.play('parry', { pos: this.pos });
      g.effects.hitSpark({ x: this.pos.x, y: this.pos.y + 1.4, z: this.pos.z }, 'metal', true);
      this.anim.play('parry', 1.2);
      const counter = this.def.attacks.find((a) => a.type === 'melee');
      if (counter && info.source) {
        g.player.anim.hitReact();
        g.player.stamina -= 15;
      }
      return { dmg: 0, blocked: true };
    }
    this.hp -= amount;
    this.lastHit = g.time;
    if (!info.dot) this.flash(0xffffff, 1);
    if (!info.dot && info.poise) {
      this.poise -= info.poise;
      if (this.poise <= 0) {
        this._stagger(this.isBoss ? 2.8 : 1.2);
        this.poise = this.maxPoise;
      } else if (!this.isBoss && this.state !== 'attack') this.anim.hitReact();
      else if (!this.isBoss) this.anim.hitReact();
    }
    if (info.knock && !this.isBoss && !this.def.static && this.scale < 1.6) {
      const dx = info.dirX ?? 0;
      const dz = info.dirZ ?? 0;
      const l = Math.hypot(dx, dz) || 1;
      this.knockV = new THREE.Vector3((dx / l) * info.knock * 1.5, 0, (dz / l) * info.knock * 1.5);
    }
    if (info.status) {
      for (const [k, v] of Object.entries(info.status)) {
        const dps = info.statusDps || this.maxHp * 0.02;
        if (k === 'burn') this.applyStatus('burn', v, dps);
        else if (k === 'poison') this.applyStatus('poison', v, dps * 0.7);
        else if (k === 'slow') {
          this.applyStatus('slow', v);
          if (Math.random() < 0.1 && !this.isBoss) this.applyStatus('freeze', 1.2);
        } else if (k === 'freeze' && !this.isBoss) this.applyStatus('freeze', v);
        else if (k === 'stun' && !this.isBoss) this.applyStatus('stun', v);
      }
    }
    if (info.stun && !this.isBoss) this.applyStatus('stun', info.stun);
    // Réveil
    if (this.state === 'idle' || this.state === 'dormant' || this.state === 'return') this._setState('chase');
    if (this.hp <= 0) {
      this.hp = 0;
      this.lastElement = info.element;
      this.die();
    }
    return { dmg: amount };
  }

  _stagger(t) {
    this._setState('stagger');
    this.staggerT = t;
    this.leaping = false;
    this.diving = false;
    this.curAtk = null;
    if (this.def.rig === 'humanoid') this.anim.play('stagger', 1.1 / t);
    else this.anim.play('hit', 1, { dur: t });
    if (this.isBoss) this.game.hud.toast('Vulnérable !');
  }

  // Exécution / assassinat par le joueur : immobilisé le temps de l'animation
  onExecuted(player, assassin) {
    this._stagger(1.7);
    this.execImmune = this.game.time + 5;
    if (assassin) this._setState('stagger');
  }

  onParried() {
    this._stagger(this.isBoss ? 1.8 : 1.6);
    this.poise = this.isBoss ? this.poise - this.maxPoise * 0.35 : this.maxPoise;
  }

  die(silent = false) {
    if (!this.alive) return;
    // Revenant : se relève une fois (sauf s'il est brûlé)
    if (this.revives > 0 && this.lastElement !== 'fire' && this.lastElement !== 'holy') {
      this.revives--;
      this.hp = this.maxHp * 0.5;
      this._stagger(3);
      this.game.hud.toast(this.def.name + ' se relève…');
      return;
    }
    this.alive = false;
    this.deadT = 0;
    this._releaseToken();
    if (this.def.rig === 'humanoid') this.anim.play('die', 1);
    else this.anim.play('die', 1, { dur: 1.2, hold: true });
    if (!silent) audio.play('enemyDie', { pos: this.pos, kind: this.kind });
    this.game.onEnemyKilled(this);
  }

  _releaseToken() {
    if (this.hasToken) this.game.releaseToken(this);
  }
}
