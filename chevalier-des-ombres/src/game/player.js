// Le Chevalier : déplacements, saut, sprint, roulades (invulnérabilité), garde et parade,
// enchaînements d'armes, attaques lourdes, pouvoirs, fioles, verrouillage de cible.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { buildHumanoid } from '../actors/models.js';
import { H_CLIPS } from '../actors/anims.js';
import { createCharMaterial } from '../gfx/materials.js';
import { computeStats, xpForLevel } from './state.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { native } from '../core/storage.js';
import { clamp, damp, dampAngle, angleDiff, rand } from '../core/utils.js';
import { ELEMENT_COLORS } from '../gfx/effects.js';

const ARCS = {
  slashR: 2.3, slashL: 2.3, overhead: 1.3, thrust: 0.75, spin: 6.3, rising: 1.5, sweep2h: 2.7, slam: 1.5, stab: 0.9, stabL: 0.9,
  claw: 1.6, clawL: 1.6, bite: 1.2, jumpAtk: 1.6, kick: 1.2, bashL: 1.2, hammer: 1.2, castAoe: 6.3,
};

const _v = new THREE.Vector3();
const _base = new THREE.Vector3();
const _tip = new THREE.Vector3();

export class Player extends Actor {
  constructor(game) {
    super(game, 'player');
    this.radius = 0.45;
    this.height = 1.9;
    this.state = 'move';
    this.stamina = 100;
    this.mana = 60;
    this.staminaDelay = 0;
    this.iframes = 0;
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.queuedAttack = null;
    this.hitSet = new Set();
    this.blocking = false;
    this.blockTime = 0;
    this.lockTarget = null;
    this.buffs = {};
    this.cooldowns = {};
    this.flasks = 3;
    this.manaFlasks = 1;
    this.sprinting = false;
    this.moving = false;
    this.attacking = false;
    this.rollDir = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.riposte = false;
    this.secondWindUsed = false;
    this.fallStart = 0;
    this.stepTimer = 0;
    this.lastHitTime = 0;
    this.inLiquid = false;
    this.mat = null;
  }

  get profile() {
    return this.game.profile;
  }

  // (Re)construit le modèle selon la tenue et l'arme
  rebuild() {
    const p = this.profile;
    this.stats = computeStats(p);
    const st = this.stats;
    const look = st.outfit.look;
    const spec = { ...look, c: { ...(look.c || {}) }, extras: [...(look.extras || [])] };
    spec.thick = (look.thick || 1) * 1.12;
    const mat = createCharMaterial({ rim: look.c && look.c.eyes ? look.c.eyes : 0x000000 });
    mat.userData.u.uRim.value.multiplyScalar(0.25);
    const built = buildHumanoid(spec, mat);
    const keep = { yaw: this.yaw };
    this.setModel(built, { stance: st.weaponClass.stance, twoHanded: !!st.weaponClass.twoHanded });
    this.yaw = keep.yaw;
    this.attachWeapon(st.weapon, mat);
    this.attachShield(st.weaponClass.shield ? st.shield : null, mat);
    if (!this.trail) this.trail = this.game.effects.createTrail(0xffffff);
    this.trail.color.setHex(ELEMENT_COLORS[st.weapon.element] || 0xdde6ff);
    this.maxHp = st.maxHp;
    this.hp = Math.min(this.hp || st.maxHp, st.maxHp);
    this.maxStamina = st.maxStamina;
    this.maxMana = st.maxMana;
    this.mana = Math.min(this.mana, st.maxMana);
    this.resist = st.res;
    this.game.viewModel.build(st.outfit, st.weapon, st.weaponClass.shield ? st.shield : null, !!st.weaponClass.twoHanded);
    this.updateFirstPerson();
  }

  refreshStats() {
    const ratio = this.hp / this.maxHp;
    this.stats = computeStats(this.profile);
    this.maxHp = this.stats.maxHp;
    this.maxStamina = this.stats.maxStamina;
    this.maxMana = this.stats.maxMana;
    this.hp = Math.min(this.maxHp, Math.max(1, ratio * this.maxHp));
    this.resist = this.stats.res;
  }

  updateFirstPerson() {
    const fp = this.game.camRig.mode === 'first';
    if (this.mesh) this.mesh.visible = !fp;
  }

  fullRestore() {
    this.stats = computeStats(this.profile);
    this.hp = this.maxHp = this.stats.maxHp;
    this.stamina = this.maxStamina = this.stats.maxStamina;
    this.mana = this.maxMana = this.stats.maxMana;
    this.flasks = this.stats.flasks;
    this.manaFlasks = this.stats.manaFlasks;
    this.status = {};
    this.secondWindUsed = false;
    this.alive = true;
    this.dissolve = 0;
    this.state = 'move';
    this.anim && this.anim.stop();
  }

  spawn(x, z, yaw) {
    this.pos.set(x, this.game.world.heightAt(x, z), z);
    this.yaw = yaw;
    this.vy = 0;
    this.knock.set(0, 0, 0);
    this.game.camRig.yaw = yaw;
    this.game.camRig.pitch = 0.25;
    this.lockTarget = null;
  }

  headPosition(out) {
    if (this.built && this.built.bones.head) {
      this.built.bones.head.getWorldPosition(out);
      out.y += 0.12;
      return out;
    }
    return out.set(this.pos.x, this.pos.y + 1.7, this.pos.z);
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  // ---------------- Mise à jour ----------------
  update(dt, input) {
    const st = this.stats;
    const g = this.game;
    this.updateStatus(dt);
    // Minuteurs
    this.staminaDelay -= dt;
    this.iframes -= dt;
    this.comboTimer -= dt;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    for (const k in this.buffs) {
      this.buffs[k].t -= dt;
      if (this.buffs[k].t <= 0) delete this.buffs[k];
    }
    if (!this.alive) {
      this.deadT += dt;
      this.anim.update(dt, { speed: 0, grounded: true });
      this.updateVisual(dt);
      return;
    }
    // Régénérations
    if (this.staminaDelay <= 0 && !this.sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + st.staminaRegen * (this.blocking ? 0.35 : 1) * dt);
    this.mana = Math.min(this.maxMana, this.mana + st.manaRegen * dt);
    if (st.hpRegen) this.heal(st.hpRegen * dt);
    // Verrouillage : cible perdue
    if (this.lockTarget && (!this.lockTarget.alive || this.distTo(this.lockTarget) > 30)) this.lockTarget = null;
    const camYaw = g.camRig.yaw;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    // Direction de déplacement voulue (relative à la caméra)
    const mx = input.move.x;
    const my = input.move.y;
    const wantX = fx * -my + -fz * mx;
    const wantZ = fz * -my + fx * mx;
    const wantLen = Math.min(1, Math.hypot(wantX, wantZ));
    const canAct = !this.stunned && this.state !== 'stagger';
    if (canAct) this._handleActions(dt, input, wantX, wantZ, wantLen);
    // États
    let speed = 0;
    let dirX = 0;
    let dirZ = 0;
    const slow = this.slowFactor * (this.inLiquid ? 0.72 : 1);
    this.sprinting = false;
    this.attacking = this.state === 'attack';
    switch (this.state) {
      case 'move': {
        if (!canAct) break;
        this.blocking = input.isDown('block') && this.grounded;
        if (this.blocking && !this.wasBlocking) this.blockTime = 0;
        if (this.blocking) this.blockTime += dt;
        this.wasBlocking = this.blocking;
        if (wantLen > 0.1) {
          const locked = !!this.lockTarget;
          const sprintWanted = input.isDown('sprint') && !this.blocking && this.stamina > 1;
          const sp = this.blocking ? 2.2 : sprintWanted ? 7.4 : locked ? 4.2 : 4.9;
          speed = sp * st.speedMul * wantLen * slow * (this.buffs.berserk ? 1.15 : 1);
          dirX = wantX / wantLen;
          dirZ = wantZ / wantLen;
          if (sprintWanted) {
            this.sprinting = true;
            this.stamina -= 13 * st.sprintCost * dt;
            this.staminaDelay = 0.4;
          }
          if (!this.lockTarget || this.sprinting) this.yaw = dampAngle(this.yaw, Math.atan2(dirX, dirZ), this.sprinting ? 9 : 12, dt);
        }
        if (this.lockTarget && !this.sprinting) this.faceTowards(this.lockTarget.pos.x, this.lockTarget.pos.z, 12, dt);
        if (g.camRig.mode === 'first') this.yaw = camYaw;
        break;
      }
      case 'attack':
        speed = this._updateAttack(dt, wantX, wantZ, wantLen) * slow;
        dirX = this.forwardX;
        dirZ = this.forwardZ;
        this.blocking = false;
        break;
      case 'roll': {
        const t = this.anim.actionT;
        const clipT = this.rollT = (this.rollT || 0) + dt;
        const dur = this.rollDur;
        const k = clipT / dur;
        speed = (k < 0.7 ? 8.5 : 8.5 * (1 - (k - 0.7) / 0.3)) * slow * (this.backstep ? 0.75 : 1);
        if (this.dashBoost) speed = this.dashBoost;
        dirX = this.rollDir.x;
        dirZ = this.rollDir.z;
        if (clipT >= dur || t < 0) {
          this.state = 'move';
          this.dashBoost = 0;
        }
        this.blocking = false;
        break;
      }
      case 'cast':
      case 'drink': {
        this.blocking = false;
        if (wantLen > 0.1 && this.state === 'drink') {
          speed = 1.6 * wantLen;
          dirX = wantX / wantLen;
          dirZ = wantZ / wantLen;
        }
        const t = this.anim.actionT;
        if (this.state === 'cast' && this.pendingPower && t >= this.castAt) {
          const pw = this.pendingPower;
          this.pendingPower = null;
          g.powers.execute(pw, this);
        }
        if (this.state === 'drink' && this.pendingDrink && t >= 0.55) {
          const kind = this.pendingDrink;
          this.pendingDrink = null;
          if (kind === 'heal') {
            this.heal(this.maxHp * st.flaskHeal);
            g.effects.souls({ x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z }, 10);
            g.particles.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, 0xff9a4a, 20, 2, 0.35, 0.8, { intensity: 2 });
          } else {
            this.mana = Math.min(this.maxMana, this.mana + this.maxMana * 0.6);
            g.particles.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, 0x4dd8ff, 20, 2, 0.35, 0.8, { intensity: 2 });
          }
        }
        if (t < 0 || t >= 1) this.state = 'move';
        break;
      }
      case 'stagger':
        this.blocking = false;
        if (this.anim.actionT < 0 || this.anim.actionT >= 1) this.state = 'move';
        break;
      default:
    }
    if (this.stunned) {
      speed = 0;
      this.blocking = false;
    }
    // Physique
    this.vel.x = dirX * speed + this.knock.x;
    this.vel.z = dirZ * speed + this.knock.z;
    this.knock.multiplyScalar(Math.exp(-8 * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const w = g.world;
    w.colliders.resolve(this.pos, this.radius, this.pos.y + 0.3, this.height);
    const gh = w.heightAt(this.pos.x, this.pos.z);
    this.vy -= 24 * dt;
    this.pos.y += this.vy * dt;
    const wasGrounded = this.grounded;
    if (this.pos.y <= gh) {
      if (!wasGrounded && this.vy < -9) {
        audio.play('land', { pos: this.pos, heavy: this.vy < -14 });
        g.effects.dust({ x: this.pos.x, y: gh, z: this.pos.z }, 6);
      }
      this.pos.y = gh;
      this.vy = 0;
      this.grounded = true;
    } else if (this.pos.y > gh + 0.25) this.grounded = false;
    else if (this.vy <= 0) {
      this.pos.y = gh;
      this.vy = 0;
      this.grounded = true;
    }
    // Liquides
    const liq = w.liquidLevel;
    this.inLiquid = this.pos.y < liq - 0.25;
    if (this.inLiquid && w.zone.terrain.lava) {
      this.applyStatus('burn', 1.5, this.maxHp * 0.08);
    }
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.speedNow > 0.3;
    // Bruits de pas
    if (this.grounded && this.speedNow > 1 && this.state === 'move') {
      this.stepTimer -= dt * this.speedNow;
      if (this.stepTimer <= 0) {
        this.stepTimer = 2.2;
        audio.play('step', { surface: w.zone.indoor ? 'stone' : 'dirt', heavy: this.stats.outfit.def > 25 });
      }
    }
    // Animation
    const lookYaw = this.lockTarget ? clamp(this.angleTo(this.lockTarget), -0.9, 0.9) : 0;
    this.anim.update(dt, { speed: this.state === 'move' ? this.speedNow : 0, grounded: this.grounded, blocking: this.blocking, sprint: this.sprinting, lookYaw });
    this.updateVisual(dt);
    this._updateTrail();
    // Vue 1re personne
    if (g.camRig.mode === 'first') {
      const act = this.anim.action;
      g.viewModel.update(dt, g.camera, {
        action: this.state === 'attack' && act ? act.name : null,
        t: act ? this.anim.actionT : 0,
        moving: this.moving,
        speed: this.speedNow,
        blocking: this.blocking,
        casting: this.state === 'cast',
        castT: this.state === 'cast' ? this.anim.actionT : 0,
        drinking: this.state === 'drink',
        drinkT: this.state === 'drink' ? this.anim.actionT : 0,
      });
    }
  }

  _handleActions(dt, input, wantX, wantZ, wantLen) {
    const g = this.game;
    const st = this.stats;
    const free = this.state === 'move';
    // Verrouillage
    if (input.wasPressed('lock')) {
      if (this.lockTarget) this.lockTarget = null;
      else this.lockTarget = g.findLockTarget();
      audio.play('uiHover');
    }
    // Changement de vue
    if (input.wasPressed('camera')) {
      g.camRig.toggleMode();
      this.updateFirstPerson();
      g.hud.toast(g.camRig.mode === 'first' ? 'Vue à la première personne' : 'Vue à la troisième personne');
    }
    // Sélection du pouvoir
    if (input.wasPressed('powerNext') || input.wasPressed('powerPrev')) {
      const dir = input.wasPressed('powerNext') ? 1 : -1;
      const p = this.profile;
      for (let i = 1; i <= 4; i++) {
        const idx = (p.powerIndex + dir * i + 8) % 4;
        if (p.powerSlots[idx]) {
          p.powerIndex = idx;
          break;
        }
      }
      g.hud.refreshPowers();
    }
    // Roulade (annule la fin d'une attaque)
    const canCancel = this.state === 'attack' && this.anim.actionT > (this.curClip && this.curClip.hit ? this.curClip.hit[1] : 0.6);
    if (input.wasPressed('dodge') && (free || canCancel) && this.grounded) {
      const cost = 22 * st.rollCost;
      if (this.stamina > 1) {
        this.stamina -= cost;
        this.staminaDelay = 0.7;
        this.state = 'roll';
        this.rollT = 0;
        this.backstep = wantLen < 0.1 && !!this.lockTarget;
        if (wantLen > 0.1) this.rollDir.set(wantX / wantLen, 0, wantZ / wantLen);
        else this.rollDir.set(-this.forwardX * (this.backstep ? 1 : -1), 0, -this.forwardZ * (this.backstep ? 1 : -1));
        if (!this.backstep) this.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
        this.rollDur = this.backstep ? 0.45 : 0.62;
        this.anim.play(this.backstep ? 'backstep' : 'roll', H_CLIPS[this.backstep ? 'backstep' : 'roll'].dur / this.rollDur);
        this.iframes = this.backstep ? 0.28 : st.rollIframes;
        this.rollStart = g.time;
        audio.play('roll', { pos: this.pos });
        this.queuedAttack = null;
        return;
      }
    }
    // Saut
    if (input.wasPressed('jump') && free && this.grounded && !this.blocking && this.stamina > 5) {
      this.vy = 8;
      this.grounded = false;
      this.stamina -= 8;
      this.staminaDelay = 0.5;
      audio.play('jump', { pos: this.pos });
    }
    // Attaques
    const atk = input.wasPressed('attack');
    const heavy = input.wasPressed('heavy');
    if (atk || heavy) {
      if (free && this.stamina > 1) this.startAttack(heavy);
      else if (this.state === 'attack') this.queuedAttack = heavy ? 'heavy' : 'light';
    }
    // Pouvoir
    const p = this.profile;
    let powerSlot = -1;
    if (input.wasPressed('power')) powerSlot = p.powerIndex;
    for (let i = 0; i < 4; i++) if (input.wasPressed('power' + i)) powerSlot = i;
    if (powerSlot >= 0 && free) {
      const id = p.powerSlots[powerSlot];
      if (id) g.powers.tryCast(id, this);
    }
    // Fioles
    if (free && input.wasPressed('heal')) this.drink('heal');
    if (free && input.wasPressed('mana')) this.drink('mana');
  }

  drink(kind) {
    const g = this.game;
    if (kind === 'heal') {
      if (this.flasks <= 0) return g.hud.toast('Plus de Fiole de Braise', true);
      this.flasks--;
    } else {
      if (this.manaFlasks <= 0) return g.hud.toast('Plus de Fiole d’Éther', true);
      this.manaFlasks--;
    }
    this.state = 'drink';
    this.pendingDrink = kind;
    this.anim.play('drink', 1);
    audio.play('drink', { pos: this.pos });
    g.hud.refreshFlasks();
  }

  startAttack(heavy) {
    const st = this.stats;
    const cls = st.weaponClass;
    let name;
    if (!this.grounded) name = 'overhead';
    else if (heavy) name = cls.heavy;
    else {
      if (this.comboTimer <= 0) this.comboIndex = 0;
      name = cls.combo[this.comboIndex % cls.combo.length];
    }
    const clip = H_CLIPS[name];
    if (!clip) return;
    const cost = st.weapon.stamina * (heavy ? 1.6 : 1);
    this.stamina -= cost;
    this.staminaDelay = 0.8;
    this.state = 'attack';
    this.heavy = heavy;
    this.curClip = clip;
    this.curAttack = name;
    this.hitSet.clear();
    this.queuedAttack = null;
    const speed = st.weapon.speed * st.comboSpeed * (heavy ? 0.82 : 1) * (this.buffs.berserk ? 1.15 : 1);
    this.anim.play(name, speed);
    this.attackSpeed = speed;
    this.swung = false;
    // Aide à la visée : se tourne vers l'ennemi proche
    const g = this.game;
    let target = this.lockTarget;
    if (!target && settings.get('autoLock')) target = g.nearestEnemy(this.pos, 5, this.yaw, 1.3);
    if (target) this.faceTowards(target.pos.x, target.pos.z, -1, 0);
    else if (g.camRig.mode === 'first') this.yaw = g.camRig.yaw;
    else {
      const inp = g.input.move;
      if (Math.hypot(inp.x, inp.y) > 0.3) {
        const cy = g.camRig.yaw;
        const wx = Math.sin(cy) * -inp.y + -Math.cos(cy) * inp.x;
        const wz = Math.cos(cy) * -inp.y + Math.sin(cy) * inp.x;
        this.yaw = Math.atan2(wx, wz);
      }
    }
  }

  _updateAttack(dt, wantX, wantZ, wantLen) {
    const clip = this.curClip;
    const t = this.anim.actionT;
    const g = this.game;
    if (t < 0) {
      this._endAttack();
      return 0;
    }
    // Petite correction de direction pendant l'élan
    if (t < clip.hit[0] && wantLen > 0.2 && !this.lockTarget) this.yaw = dampAngle(this.yaw, Math.atan2(wantX, wantZ), 4, dt);
    if (this.lockTarget && t < clip.hit[0]) this.faceTowards(this.lockTarget.pos.x, this.lockTarget.pos.z, 10, dt);
    // Fenêtre active
    if (t >= clip.hit[0] - 0.05 && !this.swung) {
      this.swung = true;
      audio.play('swing', { pos: this.pos, weight: this.stats.weaponClass.twoHanded ? 1.6 : 1 });
      this.trail.active = true;
    }
    if (t >= clip.hit[0] && t <= clip.hit[1]) this._meleeCheck();
    if (t > clip.hit[1] + 0.08) this.trail.active = false;
    // Onde de choc des coups lourds au sol
    if ((this.curAttack === 'slam' || this.curAttack === 'jumpAtk') && !this.slamDone && t >= clip.hit[0]) {
      this.slamDone = true;
      const r = 3.2;
      const px = this.pos.x + this.forwardX * 1.8;
      const pz = this.pos.z + this.forwardZ * 1.8;
      g.effects.ring({ x: px, z: pz }, 0xffd8a0, r, 0.4);
      g.effects.dust({ x: px, y: this.pos.y, z: pz }, 14);
      g.camRig.shake(0.35);
      for (const e of g.combat.actorsInRadius(px, pz, r, 'player')) if (!this.hitSet.has(e.id)) this._applyHit(e, 0.6);
    }
    // Enchaînement
    if (this.queuedAttack && t > clip.hit[1] - 0.05 && this.stamina > 1) {
      const heavy = this.queuedAttack === 'heavy';
      if (!heavy) this.comboIndex++;
      else this.comboIndex = 0;
      this.slamDone = false;
      this.startAttack(heavy);
      return 0;
    }
    // Élan vers l'avant
    const lunge = clip.lunge || 0;
    const lk = t > 0.1 && t < clip.hit[1] ? 1 : 0;
    return lk * lunge * 2.6 * this.attackSpeed;
  }

  _endAttack() {
    this.state = 'move';
    this.trail.active = false;
    this.slamDone = false;
    if (!this.heavy) {
      this.comboIndex++;
      this.comboTimer = 0.45;
    } else this.comboIndex = 0;
  }

  _meleeCheck() {
    const g = this.game;
    const reach = this.stats.weapon.reach * (this.heavy ? 1.12 : 1);
    const arc = ARCS[this.curAttack] || 1.5;
    const yaw = this.yaw + (this.anim.extraYaw || 0);
    for (const e of g.enemies) {
      if (!e.alive || this.hitSet.has(e.id) || e.untargetable) continue;
      const dx = e.pos.x - this.pos.x;
      const dz = e.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + e.radius) continue;
      const ey = e.pos.y + (e.hover || 0);
      if (ey > this.pos.y + 2.8 || ey + e.height < this.pos.y - 0.5) continue;
      const ang = Math.abs(angleDiff(yaw, Math.atan2(dx, dz)));
      if (arc < 6 && ang > arc / 2 + Math.atan2(e.radius, Math.max(0.5, d))) continue;
      this._applyHit(e, 1);
    }
  }

  // Calcul des dégâts d'arme (physique + élément) et application
  _applyHit(e, mul) {
    const g = this.game;
    const st = this.stats;
    const w = st.weapon;
    this.hitSet.add(e.id);
    let phys = st.weaponDmg * st.dmgMul * mul;
    let elem = st.weaponElem * st.dmgMul * st.elemMul * mul;
    if (this.heavy) {
      phys *= st.heavyMul;
      elem *= st.heavyMul;
    }
    const comboLast = !this.heavy && this.comboIndex % st.weaponClass.combo.length === st.weaponClass.combo.length - 1;
    let k = comboLast ? 1.2 : 1;
    if (this.buffs.fury) k *= 1.2;
    if (this.buffs.berserk) k *= 1.4;
    let riposte = false;
    if (this.riposte) {
      k *= 1 + st.riposte;
      this.riposte = false;
      riposte = true;
    }
    // Coup dans le dos
    const behind = Math.abs(angleDiff(e.yaw, Math.atan2(this.pos.x - e.pos.x, this.pos.z - e.pos.z))) > 2.1;
    if (behind && !e.isBoss) k *= st.backstab;
    if (e.staggered) k *= 1.3 * st.staggerMul;
    let crit = Math.random() < st.crit + (riposte ? 0.5 : 0);
    if (crit) k *= st.critMul;
    // Résistances de la cible
    const resP = clamp((e.resist && e.resist.physical) || 0, -0.5, 0.95);
    const resE = clamp((e.resist && e.resist[w.element]) || 0, -0.5, 0.95);
    let weakE = e.weak && e.weak.includes(w.element) && w.element !== 'physical' ? 1.3 : 1;
    if (w.element === 'holy' && e.undead) weakE *= 1.4;
    let weakP = e.weak && e.weak.includes('physical') ? 1.15 : 1;
    const amount = (phys * (1 - resP) * weakP + elem * (1 - resE) * weakE) * k;
    const status = {};
    if (elem > 0) {
      if (w.element === 'fire') status.burn = 3;
      if (w.element === 'frost') status.slow = 2;
      if (w.element === 'poison') status.poison = 5;
      if (w.element === 'lightning' && Math.random() < 0.3) status.shock = 1;
    }
    const res = g.combat.hit(e, {
      amount, element: elem > 0 ? w.element : 'physical', source: this, crit, poise: w.poise * st.poiseMul * (this.heavy ? 2 : 1) * mul, kind: 'melee', knock: this.heavy ? 5 : 2.5,
      status, statusDps: elem * 0.3, preResisted: true, bonusVs: w.bonusVs, dirX: e.pos.x - this.pos.x, dirZ: e.pos.z - this.pos.z,
      lifesteal: st.lifesteal + (w.element === 'shadow' ? 0.03 : 0),
    });
    if (res && res.dmg > 0) {
      if (settings.get('hitStop')) g.hitStop = Math.max(g.hitStop, crit || this.heavy ? 0.085 : 0.05);
      g.camRig.shake(crit || this.heavy ? 0.28 : 0.14);
      if (settings.get('vibration')) native.vibrate(crit ? 35 : 18);
      if (st.manaOnHit) this.mana = Math.min(this.maxMana, this.mana + st.manaOnHit);
      if (w.element === 'lightning' && status.shock) {
        const other = g.nearestEnemy(e.pos, 6, null, null, e);
        if (other) {
          g.effects.beam(new THREE.Vector3(e.pos.x, e.pos.y + 1.2, e.pos.z), new THREE.Vector3(other.pos.x, other.pos.y + 1.2, other.pos.z), 0xb8d8ff, 0.08, 0.15);
          g.combat.hit(other, { amount: elem * 0.6, element: 'lightning', source: this, poise: 5 });
        }
      }
    }
  }

  onDealtDamage(target, dmg) {
    this.profile.stats.damageDealt += dmg;
  }

  onKill(enemy) {
    const st = this.stats;
    if (st.furyOnKill) this.buffs.fury = { t: 6 };
    if (st.weapon.manaOnKill) this.mana = Math.min(this.maxMana, this.mana + st.weapon.manaOnKill);
  }

  _updateTrail() {
    const w = this.weaponMesh;
    if (!w || !this.trail || !this.mesh || !this.mesh.visible) {
      if (this.trail) this.trail.active = false;
      return;
    }
    if (!this.trail.active && this.trail.pts.length === 0) return;
    const len = w.userData.length || 1;
    _base.set(0, len * 0.3, 0);
    _tip.set(0, len, 0);
    w.localToWorld(_base);
    w.localToWorld(_tip);
    if (this.trail.active) this.game.effects.pushTrail(this.trail, _base, _tip);
  }

  // ---------------- Dégâts reçus ----------------
  receiveHit(info) {
    if (!this.alive) return null;
    const g = this.game;
    const st = this.stats;
    if (info.dot || info.kind === 'hazard') {
      this._takeDamage(info.amount, info, false);
      return { dmg: info.amount };
    }
    // Esquive (invulnérabilité)
    if (this.iframes > 0) {
      if (st.dodgeCounter && g.time - (this.rollStart || 0) < 0.2 && !this.perfectDodgeCd) {
        g.slowMo(0.7, 0.35);
        g.hud.toast('Esquive parfaite !');
        this.perfectDodgeCd = true;
        setTimeout(() => (this.perfectDodgeCd = false), 1500);
      }
      return { dmg: 0, dodged: true };
    }
    let amount = info.amount;
    // Garde
    const src = info.source;
    let fromAngle = 0;
    if (src && src.pos) fromAngle = Math.abs(angleDiff(this.yaw, Math.atan2(src.pos.x - this.pos.x, src.pos.z - this.pos.z)));
    else if (info.dirX !== undefined) fromAngle = Math.abs(angleDiff(this.yaw, Math.atan2(-info.dirX, -info.dirZ)));
    if (this.blocking && info.canBlock !== false && fromAngle < 1.7) {
      if (this.blockTime < st.parryWindow && info.kind === 'melee' && src && src.onParried) {
        src.onParried(this);
        this.riposte = true;
        audio.play('parry', { pos: this.pos });
        g.effects.hitSpark({ x: this.pos.x + this.forwardX, y: this.pos.y + 1.4, z: this.pos.z + this.forwardZ }, 'metal', true);
        g.slowMo(0.5, 0.25);
        g.hud.toast('Parade !');
        g.camRig.shake(0.2);
        if (st.shield.id === 'holy_bulwark') this.heal(this.maxHp * 0.05);
        if (settings.get('vibration')) native.vibrate(40);
        return { dmg: 0, parried: true };
      }
      const cost = amount * 1.3 * st.shield.stability * st.blockCost + 6;
      this.stamina -= cost;
      this.staminaDelay = 0.9;
      audio.play('block', { pos: this.pos });
      g.camRig.shake(0.12);
      if (this.stamina <= 0) {
        // Garde brisée
        this.stamina = 0;
        this.blocking = false;
        this.state = 'stagger';
        this.anim.play('stagger', 1);
        g.hud.toast('Garde brisée !', true);
        amount *= 0.6;
      } else {
        amount *= 1 - st.shield.block;
        if (st.shield.id === 'void_aegis') this.mana = Math.min(this.maxMana, this.mana + amount * 0.5);
        this._takeDamage(amount, info, true);
        this.knock.set(Math.sin(this.yaw) * -2.5, 0, Math.cos(this.yaw) * -2.5);
        return { dmg: amount, blocked: true };
      }
    }
    this._takeDamage(amount, info, false);
    return { dmg: this._lastDmg };
  }

  _takeDamage(amount, info, blocked) {
    const g = this.game;
    const st = this.stats;
    if (!info.dot && info.kind !== 'hazard') amount *= 100 / (100 + st.def);
    if (this.buffs.soulShield) amount *= 1 - this.buffs.soulShield.absorb;
    amount = Math.max(info.dot ? 0 : 1, amount);
    this._lastDmg = amount;
    this.hp -= amount;
    this.lastHitTime = g.time;
    if (!info.dot && info.kind !== 'hazard') {
      this.flash(0xff2020, 0.8);
      g.renderer.fx.damage = Math.min(1, g.renderer.fx.damage + amount / this.maxHp * 3 + 0.25);
      if (!blocked) {
        audio.play('playerHurt', { pos: this.pos });
        g.camRig.shake(0.25 + (amount / this.maxHp) * 1.5);
        if (settings.get('vibration')) native.vibrate(60);
        // Étourdissement si le coup est lourd
        const poiseDmg = info.poise ?? 20;
        const armored = this.state === 'attack' && this.heavy;
        if (poiseDmg > st.poise && !armored && this.state !== 'roll') {
          this.state = 'stagger';
          this.anim.play(poiseDmg > st.poise * 2 ? 'stagger' : 'hit', 1);
          this.trail.active = false;
        } else this.anim.hitReact();
        if (info.knock) {
          const dx = info.dirX ?? (info.source ? this.pos.x - info.source.pos.x : 0);
          const dz = info.dirZ ?? (info.source ? this.pos.z - info.source.pos.z : 0);
          const l = Math.hypot(dx, dz) || 1;
          this.knock.set((dx / l) * info.knock, 0, (dz / l) * info.knock);
        }
      }
      if (info.status) {
        for (const [k, v] of Object.entries(info.status)) {
          if (k === 'burn' || k === 'poison') this.applyStatus(k, v, Math.max(2, (info.amount || 10) * 0.12));
          else if (k === 'freeze' && !blocked) this.applyStatus('freeze', v);
          else if (k === 'slow') this.applyStatus('slow', v);
        }
      }
      if (info.stun && !blocked) this.applyStatus('stun', info.stun);
    }
    if (this.hp <= 0) {
      if (st.secondWind && !this.secondWindUsed) {
        this.secondWindUsed = true;
        this.hp = this.maxHp * 0.3;
        g.hud.toast('Second souffle !');
        g.effects.souls({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, 20);
        g.slowMo(0.4, 0.6);
        return;
      }
      this.hp = 0;
      this.die();
    }
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.deadT = 0;
    this.blocking = false;
    this.anim.play('die', 1);
    this.trail.active = false;
    this.lockTarget = null;
    audio.play('death');
    this.game.onPlayerDeath();
  }

  // Gains
  addXp(n) {
    const p = this.profile;
    p.xp += Math.round(n * this.stats.xpMul);
    let leveled = false;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.skillPoints++;
      leveled = true;
    }
    if (leveled) {
      this.refreshStats();
      this.hp = this.maxHp;
      this.stamina = this.maxStamina;
      this.mana = this.maxMana;
      this.game.onLevelUp();
    }
  }
}
