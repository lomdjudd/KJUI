// Le Chevalier : déplacements, saut, sprint, roulades (invulnérabilité), garde et parade,
// enchaînements d'armes, attaques lourdes, pouvoirs, fioles, verrouillage de cible.
import * as THREE from 'three';
import { Actor } from './actor.js';
import { buildHumanoid } from '../actors/models.js';
import { H_CLIPS } from '../actors/anims.js';
import { createCharMaterial } from '../gfx/materials.js';
import { createGlbCharacter, hasModel } from '../actors/glb.js';
import { computeStats, xpForLevel } from './state.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { native } from '../core/storage.js';
import { clamp, damp, dampAngle, angleDiff, rand } from '../core/utils.js';
import { ELEMENT_COLORS } from '../gfx/effects.js';

const ARCS = {
  slashR: 2.3, slashL: 2.3, overhead: 1.3, thrust: 0.75, spin: 6.3, rising: 1.5, sweep2h: 2.7, slam: 1.5, stab: 0.9, stabL: 0.9,
  claw: 1.6, clawL: 1.6, bite: 1.2, jumpAtk: 1.6, kick: 1.2, bashL: 1.2, hammer: 1.2, castAoe: 6.3,
  lungeSlash: 2.4, counter: 6.3, artWhirl: 6.3, artPierce: 1.8, artFlurry: 1.2, execute: 1.2, plungeLand: 6.3,
};

// Esquives : durée, vitesse de départ/fin, invulnérabilité, coût, animation
const DODGES = {
  roll: { dur: 0.62, v0: 8.5, v1: 0, iframes: null, cost: 22, clip: 'roll' },
  rollBack: { dur: 0.62, v0: 7.6, v1: 0, iframes: null, cost: 22, clip: 'rollBack', keepYaw: true },
  rollLeft: { dur: 0.56, v0: 8.2, v1: 0, iframes: null, cost: 20, clip: 'rollLeft', keepYaw: true },
  rollRight: { dur: 0.56, v0: 8.2, v1: 0, iframes: null, cost: 20, clip: 'rollRight', keepYaw: true },
  backstep: { dur: 0.45, v0: 7.4, v1: 0, iframes: 0.3, cost: 14, clip: 'backstep', keepYaw: true },
  sidestep: { dur: 0.32, v0: 10.5, v1: 2, iframes: 0.2, cost: 14, clip: 'sidestepL' },
  slide: { dur: 0.7, v0: 10, v1: 3, iframes: 0.32, cost: 16, clip: 'slide' },
  airDash: { dur: 0.26, v0: 13, v1: 6, iframes: 0.16, cost: 16, clip: 'dash', noGravity: true },
};

// Arts d'armes (touche Art) : animation, multiplicateur, coût en mana
const ARTS = {
  '1h': { clip: 'artWhirl', name: 'Lame tourbillonnante', mul: 0.85, mana: 22, arc: 6.3 },
  '2h': { clip: 'jumpAtk', name: 'Fracas tellurique', mul: 1.5, mana: 25, quake: 5.2 },
  polearm: { clip: 'artPierce', name: 'Percée spectrale', mul: 1.25, mana: 22, dash: 17, arc: 1.8 },
  dagger: { clip: 'artFlurry', name: 'Danse des lames', mul: 0.5, mana: 20, crit: 0.25 },
  staff: { clip: 'castAoe', name: 'Onde arcane', mul: 1.6, mana: 28, nova: 6 },
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
    // Mouvements avancés
    this.dodge = DODGES.roll;
    this.dodgeKind = 'roll';
    this.doubleJumped = false;
    this.airDashed = false;
    this.sneaking = false;
    this.sprintT = 0;
    this.chargeT = 0;
    this.chargeLevel = 0;
    this.counterUntil = 0;
    this.perfectUntil = 0;
    this.artCd = 0;
    this.hitWin = -1;
    this.atkMul = 1;
    this.atkFlags = {};
    this.execTarget = null;
    this.ghostT = 0;
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
    const mat = createCharMaterial({ rim: 0x5a4a8a });
    mat.userData.u.uRim.value.multiplyScalar(0.7);
    // Modèle 3D haute définition (données installées) ou modèle procédural classique
    let built = null;
    if (settings.get('charModel') !== 'classic' && hasModel('knight')) {
      built = createGlbCharacter('knight', st.outfit.glb || 'shadow', { rim: 0x3a2e5a, glow: 1.8, height: 1.92 });
      if (built) built.weaponMat = mat;
    }
    if (!built) built = buildHumanoid(spec, mat);
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
    const head = this.built && (this.built.headBone || this.built.bones.head);
    if (head) {
      head.getWorldPosition(out);
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
    this.artCd = Math.max(0, this.artCd - dt);
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
          if (sprintWanted && this.sneaking) this.setSneak(false);
          const sp = this.blocking ? 2.2 : sprintWanted ? 7.4 : this.sneaking ? 2.5 : locked ? 4.2 : 4.9;
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
        const d = this.dodge;
        this.rollT = (this.rollT || 0) + dt;
        const k = this.rollT / d.dur;
        speed = (k < 0.6 ? d.v0 : d.v0 + (d.v1 - d.v0) * clamp((k - 0.6) / 0.4, 0, 1)) * slow;
        if (this.dashBoost) speed = this.dashBoost;
        dirX = this.rollDir.x;
        dirZ = this.rollDir.z;
        if (d.noGravity) this.vy = 0;
        // Silhouettes rémanentes : denses pour les ruées, espacées pour les roulades
        if (this.dodgeKind.startsWith('roll') || this.dodgeKind === 'backstep') {
          if (k < 0.75) this._ghost(dt, 0.09);
          if (this.grounded && Math.random() < dt * 10) g.effects.dust({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, 2);
        } else {
          this._ghost(dt, 0.045);
          if (this.dodgeKind === 'airDash' || this.dodgeKind === 'powerDash') g.renderer.fx.radial = Math.max(g.renderer.fx.radial || 0, 0.7);
        }
        if (this.rollT >= d.dur) {
          this.state = 'move';
          this.dashBoost = 0;
          this.counterUntil = Math.max(this.counterUntil, g.time + 0.4);
        }
        this.blocking = false;
        break;
      }
      case 'charge': {
        // Attaque lourde chargée : 3 niveaux, relâcher pour frapper
        this.blocking = false;
        this.chargeT += dt;
        this.stamina -= 5 * dt;
        this.staminaDelay = 0.6;
        const lvl = this.chargeT > 1.4 ? 3 : this.chargeT > 0.9 ? 2 : this.chargeT > 0.45 ? 1 : 0;
        if (lvl > this.chargeLevel) {
          this.chargeLevel = lvl;
          this.flash([0xffffff, 0xffd08a, 0xff9a3a, 0xc06aff][lvl], 0.6);
          audio.play('charge', { pos: this.pos, level: lvl });
          if (g.effects.chargePulse) g.effects.chargePulse(this, lvl);
        }
        if (Math.random() < dt * (8 + this.chargeLevel * 10) && this.weaponMesh) {
          this.weaponMesh.getWorldPosition(_v);
          g.particles.spawn(_v.x + rand(-0.4, 0.4), _v.y + rand(0, 0.6), _v.z + rand(-0.4, 0.4), 0, 0.8, 0, 0.5, 0.12 + this.chargeLevel * 0.05, [0xffffff, 0xffd08a, 0xff9a3a, 0xc06aff][this.chargeLevel], { intensity: 2.5 });
        }
        if (this.lockTarget) this.faceTowards(this.lockTarget.pos.x, this.lockTarget.pos.z, 10, dt);
        else if (wantLen > 0.2) this.yaw = dampAngle(this.yaw, Math.atan2(wantX, wantZ), 6, dt);
        if (!input.isDown('heavy') || this.chargeT > 2.6 || this.stamina <= 0) {
          const level = this.chargeT < 0.2 ? 0 : this.chargeLevel;
          this.state = 'move';
          this.startAttack(true, { charge: level });
        }
        break;
      }
      case 'plunge': {
        // Attaque plongeante : chute rapide puis impact au sol
        this.blocking = false;
        this.plungeT += dt;
        if (this.plungeT > 0.16) this.vy = Math.min(this.vy, -24);
        else this.vy = Math.max(this.vy, 2);
        this._ghost(dt, 0.05);
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
    const fallV = this.vy;
    if (this.pos.y <= gh) {
      this.pos.y = gh;
      this.vy = 0;
      this.grounded = true;
    } else if (this.pos.y > gh + 0.25) this.grounded = false;
    else if (this.vy <= 0) {
      this.pos.y = gh;
      this.vy = 0;
      this.grounded = true;
    }
    // Atterrissage
    if (this.grounded && !wasGrounded) {
      if (fallV < -9) {
        audio.play('land', { pos: this.pos, heavy: fallV < -14 });
        g.effects.dust({ x: this.pos.x, y: gh, z: this.pos.z }, 6);
      }
      this.doubleJumped = false;
      this.airDashed = false;
      if (this.state === 'plunge') this._plungeImpact(gh);
    }
    // Sécurité : une plongeante ne peut pas durer indéfiniment
    if (this.state === 'plunge' && this.plungeT > 3) this.state = 'move';
    // Liquides
    const liq = w.liquidLevel;
    this.inLiquid = this.pos.y < liq - 0.25;
    if (this.inLiquid && w.zone.terrain.lava) {
      this.applyStatus('burn', 1.5, this.maxHp * 0.08);
    }
    this.speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.speedNow > 0.3;
    this.sprintT = this.sprinting ? this.sprintT + dt : 0;
    // Bruits de pas (silencieux en mode furtif)
    if (this.grounded && this.speedNow > 1 && this.state === 'move' && !this.sneaking) {
      this.stepTimer -= dt * this.speedNow;
      if (this.stepTimer <= 0) {
        this.stepTimer = 2.2;
        audio.play('step', { surface: w.zone.indoor ? 'stone' : w.zone.terrain.ground || 'dirt', heavy: this.stats.outfit.def > 25, sprint: this.sprinting });
        if (this.sprinting && settings.get('fxQuality') !== 'low') g.effects.dust({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, 2);
      }
    }
    // Animation
    const lookYaw = this.lockTarget ? clamp(this.angleTo(this.lockTarget), -0.9, 0.9) : 0;
    this.anim.update(dt, { speed: this.state === 'move' ? this.speedNow : 0, grounded: this.grounded, blocking: this.blocking, sprint: this.sprinting, sneak: this.sneaking && this.state === 'move', lookYaw });
    this.updateVisual(dt);
    this._updateTrail();
    this._updateExecPrompt();
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
    // Mode furtif (Ctrl, ou L3 à l'arrêt sur manette)
    if (input.wasPressed('sneak') || (input.wasPressed('l3') && wantLen < 0.2)) {
      if (free && this.grounded) this.setSneak(!this.sneaking);
    }
    // Esquives : roulades (avant, arrière, côtés), bond arrière (sans direction), pas de côté
    // (garde levée), glissade (en sprint), ruée aérienne
    const canCancel = this.state === 'attack' && this.anim.actionT > (this.curClip && this.curClip.hit ? this.curClip.hit[1] : 0.6) && !this.atkFlags.execute;
    const dodgeOk = free || canCancel || this.state === 'charge';
    if (input.wasPressed('dodge') && !dodgeOk) this.dodgeBuffer = 0.3;
    if (this.dodgeBuffer > 0) this.dodgeBuffer -= dt;
    if ((input.wasPressed('dodge') || this.dodgeBuffer > 0) && dodgeOk && this.stamina > 1) {
      this.dodgeBuffer = 0;
      let kind = 'roll';
      let dx = wantLen > 0.1 ? wantX / wantLen : 0;
      let dz = wantLen > 0.1 ? wantZ / wantLen : 0;
      const guard = input.isDown('block');
      if (!this.grounded) {
        if (this.airDashed) kind = null;
        else kind = 'airDash';
      } else if (wantLen <= 0.1) kind = 'backstep';
      else if (this.sprintT > 0.25 && !guard) kind = 'slide';
      else if (guard) kind = 'sidestep';
      else if (this.lockTarget) {
        // Cible verrouillée : on garde la cible en face et on roule dans la direction demandée
        const toT = Math.atan2(this.lockTarget.pos.x - this.pos.x, this.lockTarget.pos.z - this.pos.z);
        this.yaw = toT;
        const rel = angleDiff(Math.atan2(dx, dz), toT);
        if (Math.abs(rel) < 0.75) kind = 'roll';
        else if (Math.abs(rel) > 2.4) kind = 'rollBack';
        else kind = Math.sin(Math.atan2(dx, dz) - toT) > 0 ? 'rollLeft' : 'rollRight';
      }
      if (kind) {
        if (wantLen <= 0.1) {
          const back = kind === 'backstep' ? -1 : 1;
          dx = this.forwardX * back;
          dz = this.forwardZ * back;
        }
        this.startDodge(kind, dx, dz);
        return;
      }
    }
    // Saut et double saut spectral
    const interacting = g.interactTarget && input.wasPressed('interact');
    if (input.wasPressed('jump') && !interacting && free && !this.blocking && this.stamina > 5) {
      if (this.grounded) {
        this.vy = 8;
        this.grounded = false;
        this.stamina -= 8;
        this.staminaDelay = 0.5;
        if (this.sneaking) this.setSneak(false);
        audio.play('jump', { pos: this.pos });
      } else if (!this.doubleJumped && this.stamina > 10) {
        this.doubleJumped = true;
        this.vy = 7.6;
        this.stamina -= 10;
        this.staminaDelay = 0.5;
        this.anim.play('doubleJump', 1);
        audio.play('doubleJump', { pos: this.pos });
        g.particles.burst({ x: this.pos.x, y: this.pos.y + 0.2, z: this.pos.z }, 0xb07aff, 16, 2.5, 0.3, 0.6, { intensity: 2.5 });
        if (g.effects.ring) g.effects.ring({ x: this.pos.x, z: this.pos.z, y: this.pos.y + 0.1 }, 0xb07aff, 1.6, 0.35);
      }
    }
    // Attaques (avec mémoire tampon)
    const atk = input.wasPressed('attack');
    const heavyPress = input.wasPressed('heavy');
    // Coup de pied (lourde en garde) : brise la garde adverse
    if (heavyPress && free && this.blocking && this.grounded && this.stamina > 1) {
      this.startAttack(false, { kick: true });
    } else if (heavyPress && free && this.grounded && this.stamina > 1) {
      // Charge de l'attaque lourde (maintenir) ; relâcher tôt = attaque lourde normale
      this.state = 'charge';
      this.chargeT = 0;
      this.chargeLevel = 0;
      this.anim.play('chargeHold', 1);
    } else if (atk || heavyPress) {
      if (free && this.stamina > 1) this.startAttack(heavyPress);
      else if (this.state === 'attack') this.queuedAttack = heavyPress ? 'heavy' : 'light';
      else if (this.state === 'roll' && atk && this.dodgeKind === 'slide' && this.rollT > 0.18) this.startAttack(false, { slideAtk: true });
      else if (this.state === 'roll' && atk && this.rollT > this.dodge.dur * 0.55) this.buffered = { heavy: false, t: 0.35 };
      else this.buffered = { heavy: heavyPress, t: 0.35 };
    }
    if (this.buffered) {
      this.buffered.t -= dt;
      if (this.buffered.t <= 0) this.buffered = null;
      else if (free && this.stamina > 1) {
        const h = this.buffered.heavy;
        this.buffered = null;
        this.startAttack(h);
      }
    }
    // Art d'arme
    if (input.wasPressed('art')) {
      if (free && this.grounded) this.startArt();
      else if (this.state === 'attack') this.queuedArt = true;
    }
    if (this.queuedArt && free) {
      this.queuedArt = false;
      if (this.grounded) this.startArt();
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

  // ---------------- Esquives et déplacements ----------------
  startDodge(kind, dx, dz, override = null) {
    const g = this.game;
    const st = this.stats;
    const d = { ...(DODGES[kind] || DODGES.roll), ...(override || {}) };
    this.stamina -= d.cost * st.rollCost;
    this.staminaDelay = 0.7;
    this.state = 'roll';
    this.dodge = d;
    this.dodgeKind = kind;
    this.rollT = 0;
    this.rollDur = d.dur;
    this.backstep = kind === 'backstep';
    this.rollDir.set(dx, 0, dz);
    if (!d.keepYaw && kind !== 'sidestep') this.yaw = Math.atan2(dx, dz);
    let clip = d.clip;
    if (kind === 'sidestep') {
      // Pas de garde : de côté, vers l'avant ou en arrière selon la direction demandée
      const rel = Math.atan2(dx, dz) - this.yaw;
      const side = Math.sin(rel);
      clip = Math.abs(side) >= 0.5 ? (side > 0 ? 'sidestepL' : 'sidestepR') : Math.cos(rel) > 0 ? 'dash' : 'backstep';
    }
    const c = H_CLIPS[clip];
    this.anim.play(clip, c ? c.dur / d.dur : 1);
    this.iframes = d.iframes ?? st.rollIframes;
    this.rollStart = g.time;
    this.trail.active = false;
    this.queuedAttack = null;
    if (kind === 'airDash') {
      this.airDashed = true;
      this.vy = 0;
    }
    const rolling = kind.startsWith('roll');
    if (this.sneaking && !rolling) this.setSneak(false);
    audio.play(rolling || kind === 'backstep' ? 'roll' : kind === 'slide' ? 'slide' : 'dash', { pos: this.pos });
    g.effects.dust({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, kind === 'slide' ? 10 : rolling ? 7 : 5);
    this.ghostT = rolling || kind === 'backstep' ? 0.08 : 0;
  }

  setSneak(on) {
    if (this.sneaking === on) return;
    this.sneaking = on;
    this.game.hud.setSneak && this.game.hud.setSneak(on);
    audio.play(on ? 'sneakOn' : 'sneakOff');
  }

  // Silhouette spectrale laissée derrière soi (esquives, ruées)
  _ghost(dt, every) {
    if (!settings.get('afterimages')) return;
    this.ghostT -= dt;
    if (this.ghostT > 0) return;
    this.ghostT = every;
    if (this.game.effects.afterimage && this.mesh && this.mesh.visible) this.game.effects.afterimage(this.mesh, 0x9a6aff);
  }

  // ---------------- Attaques ----------------
  // opts : { charge, kick, slideAtk, art, execute:{target, assassin} }
  startAttack(heavy, opts = {}) {
    const st = this.stats;
    const cls = st.weaponClass;
    const g = this.game;
    let name;
    let mul = 1;
    const flags = {};
    // Exécution / assassinat d'un ennemi vulnérable
    if (!heavy && !opts.kick && !opts.art && this.grounded) {
      const ex = this._findExecTarget();
      if (ex) opts.execute = ex;
    }
    if (opts.execute) {
      name = 'execute';
      flags.execute = opts.execute;
      mul = opts.execute.assassin ? 4 : opts.execute.target.isBoss ? 1.6 : 3;
    } else if (opts.art) {
      name = opts.art.clip;
      flags.art = opts.art;
      mul = opts.art.mul;
    } else if (opts.kick) {
      name = 'kick';
      flags.kick = true;
      mul = 0.4;
    } else if (!this.grounded) {
      const h = this.pos.y - g.world.heightAt(this.pos.x, this.pos.z);
      if (h > 1.2 || (h > 0.7 && this.vy < -3)) return this.startPlunge();
      name = cls.combo[0];
      flags.air = true;
      this.vy = Math.max(this.vy, 2.5);
    } else if (opts.slideAtk) {
      name = 'rising';
      mul = 1.35;
      flags.slide = true;
    } else if (!heavy && g.time < this.counterUntil) {
      // Contre-attaque juste après une esquive (bonus après une esquive parfaite)
      name = 'counter';
      mul = g.time < this.perfectUntil ? 1.8 : 1.3;
      flags.counter = true;
      if (g.time < this.perfectUntil) this.riposte = true;
      this.counterUntil = 0;
      this.perfectUntil = 0;
    } else if (!heavy && this.sprintT > 0.35) {
      name = 'lungeSlash';
      mul = 1.25;
      flags.sprint = true;
    } else if (heavy) name = cls.heavy;
    else {
      if (this.comboTimer <= 0) this.comboIndex = 0;
      name = cls.combo[this.comboIndex % cls.combo.length];
    }
    if (opts.charge) {
      mul *= 1 + opts.charge * 0.45;
      flags.charge = opts.charge;
    }
    const clip = H_CLIPS[name];
    if (!clip) return;
    const cost = opts.execute ? 0 : st.weapon.stamina * (heavy ? 1.6 : opts.kick ? 0.8 : 1) * (opts.art ? 0.6 : 1);
    this.stamina -= cost;
    this.staminaDelay = 0.8;
    this.state = 'attack';
    this.heavy = heavy;
    this.curClip = clip;
    this.curAttack = name;
    this.atkMul = mul;
    this.atkFlags = flags;
    this.hitWin = -1;
    this.hitSet.clear();
    this.queuedAttack = null;
    if (this.sneaking && !opts.execute) this.setSneak(false);
    let speed = st.weapon.speed * st.comboSpeed * (heavy ? 0.82 : 1) * (this.buffs.berserk ? 1.15 : 1);
    if (opts.execute || opts.art) speed = 1;
    if (flags.air) speed *= 1.25;
    this.anim.play(name, speed);
    this.attackSpeed = speed;
    this.swung = false;
    this.slamDone = false;
    if (opts.execute) {
      // Mise en place : face à la cible, à portée de lame, invulnérable
      const t = opts.execute.target;
      this.faceTowards(t.pos.x, t.pos.z, -1, 0);
      const d = this.distTo(t);
      const want = t.radius + 0.9;
      if (d > want) {
        this.pos.x += this.forwardX * (d - want);
        this.pos.z += this.forwardZ * (d - want);
      }
      this.iframes = clip.dur + 0.2;
      this.attackTarget = t;
      if (t.onExecuted) t.onExecuted(this, opts.execute.assassin);
      g.hud.toast(opts.execute.assassin ? 'Assassinat !' : 'Exécution !');
      if (settings.get('slowmo')) g.slowMo(0.45, 0.35);
      if (g.effects.shockwave) g.effects.shockwave(t.pos, 0.6, 0x9a6aff);
      return;
    }
    // Aide à la visée : se tourne vers l'ennemi proche
    let target = this.lockTarget;
    if (!target && settings.get('autoLock')) target = g.nearestEnemy(this.pos, flags.sprint ? 8 : 5.5, this.yaw, 1.4);
    this.attackTarget = target || null;
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
    if (flags.charge >= 2 && g.effects.shockwave) g.effects.shockwave(this.pos, 0.3 + flags.charge * 0.15, 0xffc080);
  }

  startArt() {
    const g = this.game;
    const art = ARTS[this.stats.weapon.cls] || ARTS['1h'];
    if (this.artCd > 0) return g.hud.toast(`${art.name} : encore ${Math.ceil(this.artCd)} s`, true);
    const cost = art.mana;
    if (this.mana < cost) return g.hud.toast(`Pas assez de mana pour « ${art.name} »`, true);
    this.mana -= cost;
    this.artCd = 6;
    this.startAttack(false, { art });
    g.hud.toast(art.name);
    audio.play('art', { pos: this.pos });
    this.flash(0xc06aff, 0.7);
    if (g.effects.shockwave) g.effects.shockwave(this.pos, 0.45, 0xc06aff);
  }

  startPlunge() {
    const g = this.game;
    this.state = 'plunge';
    this.plungeT = 0;
    this.heavy = true;
    this.curAttack = 'plungeLand';
    this.curClip = H_CLIPS.plungeLand;
    this.atkMul = 1.7;
    this.atkFlags = { plunge: true };
    this.hitSet.clear();
    this.anim.play('plunge', 1);
    this.trail.pts.length = 0;
    this.trail.active = true;
    audio.play('swing', { pos: this.pos, weight: 1.8 });
    g.hud.toast('Attaque plongeante');
  }

  // Impact de l'attaque plongeante
  _plungeImpact(gh) {
    const g = this.game;
    const r = 3.6;
    const px = this.pos.x + this.forwardX * 0.8;
    const pz = this.pos.z + this.forwardZ * 0.8;
    g.effects.ring({ x: px, z: pz }, 0xc0a0ff, r, 0.45);
    g.effects.dust({ x: px, y: gh, z: pz }, 18);
    if (g.effects.shockwave) g.effects.shockwave({ x: px, y: gh, z: pz }, 0.9, 0xc0a0ff);
    if (g.effects.cracks) g.effects.cracks({ x: px, y: gh, z: pz }, 2.6);
    g.camRig.shake(0.5);
    audio.play('slam', { pos: this.pos });
    for (const e of g.combat.actorsInRadius(px, pz, r, 'player')) if (!this.hitSet.has(e.id)) this._applyHit(e, 1);
    // Récupération : fin de l'animation d'impact
    this.state = 'attack';
    this.anim.play('plungeLand', 1);
    this.attackSpeed = 1;
    this.swung = true;
    this.hitWin = 0;
    this.attackTarget = null;
  }

  // Cible d'exécution : ennemi étourdi devant soi, ou ennemi inconscient pris à revers en mode furtif
  _findExecTarget() {
    const g = this.game;
    let best = null;
    let bd = 2.8;
    for (const e of g.enemies) {
      if (!e.alive || e.untargetable || e.def.rig === 'wisp') continue;
      const d = this.distTo(e) - e.radius;
      if (d > bd) continue;
      const ang = Math.abs(this.angleTo(e));
      const unaware = this.sneaking && !e.isBoss && (e.state === 'idle' || e.state === 'return' || e.state === 'dormant') && e.def.rig !== 'mimic';
      const behind = Math.abs(angleDiff(e.yaw, Math.atan2(this.pos.x - e.pos.x, this.pos.z - e.pos.z))) > 2.0;
      if (e.staggered && ang < 1.2 && (e.execImmune || 0) < g.time) {
        best = { target: e, assassin: false };
        bd = d;
      } else if (unaware && behind && ang < 1.0 && d < 2.2) {
        best = { target: e, assassin: true };
        bd = d;
      }
    }
    return best;
  }

  _updateExecPrompt() {
    const g = this.game;
    this.execCheckT = (this.execCheckT || 0) - 1 / 60;
    if (this.execCheckT > 0) return;
    this.execCheckT = 0.1;
    const ex = this.state === 'move' && this.grounded ? this._findExecTarget() : null;
    this.execTarget = ex;
    if (g.hud.execPrompt) g.hud.execPrompt(ex ? (ex.assassin ? 'Assassinat' : 'Exécution') : null);
  }

  _updateAttack(dt, wantX, wantZ, wantLen) {
    const clip = this.curClip;
    const t = this.anim.actionT;
    const g = this.game;
    const flags = this.atkFlags;
    if (t < 0) {
      const q = this.queuedAttack;
      this._endAttack();
      if (q && this.stamina > 1) {
        if (q === 'light') this.comboTimer = 0.45;
        this.startAttack(q === 'heavy');
      }
      return 0;
    }
    // Petite correction de direction pendant l'élan
    if (t < clip.hit[0] && wantLen > 0.2 && !this.lockTarget && !flags.execute) this.yaw = dampAngle(this.yaw, Math.atan2(wantX, wantZ), 4, dt);
    if (this.lockTarget && t < clip.hit[0] && !flags.execute) this.faceTowards(this.lockTarget.pos.x, this.lockTarget.pos.z, 10, dt);
    // Fenêtres actives (plusieurs pour les arts et les exécutions)
    const wins = clip.hits || [clip.hit];
    let wi = -1;
    for (let i = 0; i < wins.length; i++) if (t >= wins[i][0] - 0.05 && t <= wins[i][1]) wi = i;
    if (wi >= 0 && wi !== this.hitWin) {
      this.hitWin = wi;
      if (wi > 0) this.hitSet.clear();
      audio.play('swing', { pos: this.pos, weight: this.stats.weaponClass.twoHanded ? 1.6 : 1 });
      this.trail.pts.length = 0;
      this.trail.active = true;
      this.swung = true;
      this._onWindow(wi);
    }
    if (wi >= 0 && t >= wins[wi][0]) this._meleeCheck();
    if (t > wins[wins.length - 1][1] + 0.08) this.trail.active = false;
    // Onde de choc des coups lourds au sol
    if ((this.curAttack === 'slam' || this.curAttack === 'jumpAtk') && !this.slamDone && t >= clip.hit[0]) {
      this.slamDone = true;
      const quake = flags.art && flags.art.quake;
      const r = quake || 3.2;
      const px = this.pos.x + this.forwardX * 1.8;
      const pz = this.pos.z + this.forwardZ * 1.8;
      g.effects.ring({ x: px, z: pz }, quake ? 0xc06aff : 0xffd8a0, r, 0.4);
      g.effects.dust({ x: px, y: this.pos.y, z: pz }, quake ? 24 : 14);
      if (g.effects.shockwave) g.effects.shockwave({ x: px, y: this.pos.y, z: pz }, quake ? 1 : 0.5, quake ? 0xc06aff : 0xffd8a0);
      if (quake && g.effects.cracks) g.effects.cracks({ x: px, y: this.pos.y, z: pz }, 3.5);
      g.camRig.shake(quake ? 0.6 : 0.35);
      if (quake) audio.play('slam', { pos: this.pos });
      for (const e of g.combat.actorsInRadius(px, pz, r, 'player')) if (!this.hitSet.has(e.id)) this._applyHit(e, quake ? 1 : 0.6);
    }
    // Onde arcane (art du bâton)
    if (flags.art && flags.art.nova && !this.slamDone && t >= clip.hit[0]) {
      this.slamDone = true;
      const r = flags.art.nova;
      g.effects.ring({ x: this.pos.x, z: this.pos.z }, 0x9a6aff, r, 0.5);
      if (g.effects.shockwave) g.effects.shockwave(this.pos, 1, 0x9a6aff);
      g.particles.burst({ x: this.pos.x, y: this.pos.y + 1, z: this.pos.z }, 0xb07aff, 40, 7, 0.4, 0.7, { intensity: 3 });
      g.camRig.shake(0.35);
      for (const e of g.combat.actorsInRadius(this.pos.x, this.pos.z, r, 'player')) if (!this.hitSet.has(e.id)) this._applyHit(e, 1);
    }
    // Enchaînement
    if (this.queuedAttack && t > wins[wins.length - 1][1] - 0.05 && this.stamina > 1 && !flags.art && !flags.execute) {
      const heavy = this.queuedAttack === 'heavy';
      if (!heavy) this.comboIndex++;
      else this.comboIndex = 0;
      this.slamDone = false;
      this.startAttack(heavy);
      return 0;
    }
    if (flags.execute) return 0;
    // Élan vers l'avant (+ rapprochement de la cible visée)
    const lunge = clip.lunge || 0;
    const lk = t > 0.1 && t < clip.hit[1] ? 1 : 0;
    let speed = lk * lunge * 2.6 * this.attackSpeed;
    if (flags.sprint && t < 0.45) speed = Math.max(speed, 9 * (1 - t / 0.45) + 2);
    if (flags.slide && t < 0.3) speed = Math.max(speed, 5);
    if (flags.art && flags.art.dash && t > 0.18 && t < 0.62) {
      speed = flags.art.dash;
      this._ghost(dt, 0.04);
    }
    const tg = this.attackTarget;
    if (tg && tg.alive && t < clip.hit[0] + 0.05 && !(flags.art && flags.art.dash)) {
      this.faceTowards(tg.pos.x, tg.pos.z, 14, dt);
      const reach = this.stats.weapon.reach;
      const d = this.distTo(tg) - tg.radius;
      if (d > reach * 0.7) speed = Math.max(speed, Math.min(flags.sprint ? 10 : 6, (d - reach * 0.6) * 5));
      else if (d < reach * 0.35) speed = 0;
    }
    return speed;
  }

  // Début d'une fenêtre active : effets propres aux attaques spéciales
  _onWindow(i) {
    const g = this.game;
    const f = this.atkFlags;
    if (f.execute) {
      const tg = f.execute.target;
      if (i === 0 && settings.get('slowmo')) g.slowMo(0.3, 0.45);
      if (i === 1) {
        if (g.effects.shockwave) g.effects.shockwave(tg.pos, 0.8, 0xff4a6a);
        g.camRig.shake(0.45);
      }
      // L'exécution touche toujours sa cible
      if (tg.alive) this._applyHit(tg, 1, { forceCrit: i === 1 });
    }
    if (f.art && f.art.clip === 'artWhirl') g.particles.burst({ x: this.pos.x, y: this.pos.y + 1.1, z: this.pos.z }, 0xc0a0ff, 12, 4, 0.25, 0.4, { intensity: 2 });
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
      if (d > reach + e.radius + 0.35) continue;
      const ey = e.pos.y + (e.hover || 0);
      if (ey > this.pos.y + 2.8 || ey + e.height < this.pos.y - 0.5) continue;
      const ang = Math.abs(angleDiff(yaw, Math.atan2(dx, dz)));
      if (arc < 6 && ang > arc / 2 + Math.atan2(e.radius, Math.max(0.5, d))) continue;
      this._applyHit(e, 1);
    }
  }

  // Calcul des dégâts d'arme (physique + élément) et application
  _applyHit(e, mul, extra = {}) {
    const g = this.game;
    const st = this.stats;
    const w = st.weapon;
    const f = this.atkFlags || {};
    this.hitSet.add(e.id);
    mul *= this.atkMul || 1;
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
    let crit = extra.forceCrit || Math.random() < st.crit + (riposte ? 0.5 : 0) + (f.art && f.art.crit ? f.art.crit : 0) + (f.counter ? 0.2 : 0);
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
    // Déséquilibre : coups de pied et charges brisent la garde
    let poise = w.poise * st.poiseMul * (this.heavy ? 2 : 1) * mul * (1 + (f.charge || 0) * 0.8);
    if (f.kick) poise = Math.max(poise, 70);
    if (f.kick && e.def && e.def.blocks && e.state !== 'stagger' && e._stagger) e._stagger(1.3);
    const knock = f.kick ? 6 : f.charge ? 4 + f.charge * 1.5 : this.heavy ? 4.5 : comboLast || f.counter ? 2.5 : 0.8;
    const res = g.combat.hit(e, {
      amount, element: elem > 0 ? w.element : 'physical', source: this, crit, poise, kind: 'melee', knock, noBlock: !!(f.execute || f.kick),
      status, statusDps: elem * 0.3, preResisted: true, bonusVs: w.bonusVs, dirX: e.pos.x - this.pos.x, dirZ: e.pos.z - this.pos.z,
      lifesteal: st.lifesteal + (w.element === 'shadow' ? 0.03 : 0),
    });
    if (res && res.dmg > 0) {
      const big = crit || this.heavy || f.charge || f.execute;
      if (settings.get('hitStop')) g.hitStop = Math.max(g.hitStop, f.execute ? 0.12 : big ? 0.085 : 0.05);
      g.camRig.shake(f.execute ? 0.4 : big ? 0.28 : 0.14);
      if (g.effects.impact) g.effects.impact(e, crit, big, w.element);
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
    // Esquive (invulnérabilité) ; au dernier moment : esquive parfaite → Temps des Ombres
    if (this.iframes > 0) {
      const window = st.dodgeCounter ? 0.3 : 0.22;
      if (this.state === 'roll' && g.time - (this.rollStart || 0) < window && g.time > (this.perfectCdUntil || 0)) {
        this.perfectCdUntil = g.time + 2;
        this.perfectUntil = g.time + 1.6;
        this.counterUntil = g.time + 1.6;
        g.shadowTime(st.dodgeCounter ? 1.6 : 1.15);
        g.hud.toast('Esquive parfaite !');
        audio.play('perfectDodge');
        this.flash(0xb07aff, 0.8);
        if (g.effects.shockwave) g.effects.shockwave(this.pos, 0.7, 0xb07aff);
        if (settings.get('vibration')) native.vibrate(30);
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
        g.effects.shockwave({ x: this.pos.x + this.forwardX, y: this.pos.y, z: this.pos.z + this.forwardZ }, 0.55, 0xffe8b0);
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
