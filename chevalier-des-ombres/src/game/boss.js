// Boss : bibliothèque de schémas d'attaque, phases, arène (mur de brume) et récompenses.
import * as THREE from 'three';
import { Enemy } from './enemy.js';
import { H_CLIPS } from '../actors/anims.js';
import { tierStats } from '../data/enemies.js';
import { settings } from '../core/settings.js';
import { audio } from '../core/audio.js';
import { clamp, rand, angleDiff, weightedPick } from '../core/utils.js';
import { ELEMENT_COLORS } from '../gfx/effects.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const RAIN_VISUAL = { meteor: 'meteor', ice: 'iceFall', bone: 'boneFall', boulder: 'boulder', dirt: 'dirt', shadowOrb: 'shadowOrb', root: 'root', tentacle: 'tentacle', acid: 'acidSpike' };
const SPIKE_VISUAL = { bone: 'bone', ice: 'ice', root: 'root', acid: 'acidSpike', fire: 'fireSpike', shadow: 'shadowSpike' };

// Définition d'ennemi dérivée pour la classe Enemy
function enemyDefFromBoss(b) {
  return { ...b, ai: 'boss', attacks: [], poise: b.poise, hpMul: b.hpMul, dmgMul: b.dmgMul, speed: b.speed, keepDist: 0 };
}

export function cloneDefFromBoss(b) {
  return {
    ...b, id: b.id + '_clone', name: 'Illusion', ai: 'caster', keepDist: 8, hpMul: 0.05, dmgMul: b.dmgMul * 0.6, poise: 1, scale: b.scale * 0.85, rim: 0x9a4dff,
    attacks: [{ anim: b.rig === 'humanoid' ? 'cast' : 'breath', type: 'projectile', proj: 'shadow', range: 22, dmg: 0.6, cd: 2.4, homing: 1.5, dur: 0.8, hit: [0.5, 0.55] }],
  };
}

export class Boss extends Enemy {
  constructor(game, def, arena) {
    super(game, enemyDefFromBoss(def), arena.x, arena.z - arena.r * 0.35, { tier: def.tier, yaw: 0 });
    this.isBoss = true;
    this.bossDef = def;
    this.arena = arena;
    const ts = tierStats(def.tier);
    this.xp = ts.xp * 22 * (def.rewards.xp || 1) * settings.difficulty.xp;
    this.shards = ts.shards * 18 * (def.rewards.shards || 1);
    this.attacks = def.attacks.map((a) => ({ ...a, cdLeft: rand(0, 2) }));
    this.phaseIdx = 0;
    this.speedMul = 1;
    this.dmgMul = 1;
    this.engaged = false;
    this.globalCd = 1.2;
    this.aggro = 999;
    this.yaw = Math.atan2(game.player.pos.x - this.pos.x, game.player.pos.z - this.pos.z);
    this.state = 'wait';
    this.hover = def.hover ? 0.3 : 0;
    this.hoverBase = this.hover;
    this.baseRadius = this.radius;
  }

  engage() {
    this.engaged = true;
    this._setState('intro');
    this.anim.play(this.def.rig === 'humanoid' ? 'roar' : this.def.rig === 'quad' || this.def.rig === 'dragon' ? 'roar' : 'charge', 1, this.def.rig === 'humanoid' ? null : { dur: 1.6 });
    audio.play('roar', { pos: this.pos });
  }

  // Durée et fenêtre de coup d'une animation
  _clip(name, a = {}) {
    const tel = settings.difficulty.telegraph;
    const sp = (this.speedMul / tel) / Math.max(0.85, Math.sqrt(this.scale) * 0.72);
    const clip = H_CLIPS[name];
    if (this.def.rig === 'humanoid' && clip) {
      this.anim.play(name, sp);
      return { dur: clip.dur / sp, hit: clip.hit || [0.5, 0.55] };
    }
    const dur = (a.dur || 1) / sp;
    this.anim.play(name, 1, { dur });
    return { dur, hit: a.hit || [0.5, 0.6] };
  }

  get reach() {
    return 2.2 + this.scale * 0.9;
  }

  update(dt) {
    const g = this.game;
    const p = this.player;
    if (!this.alive) {
      this.deadT += dt;
      this.dissolve = Math.min(1, Math.max(0, (this.deadT - 1.2) / 2.5));
      if (Math.random() < 0.5) g.effects.souls({ x: this.pos.x, y: this.pos.y + this.height * 0.4, z: this.pos.z }, 2);
      this.anim.update(dt, { speed: 0 });
      this.pos.y = Math.max(g.world.heightAt(this.pos.x, this.pos.z), this.pos.y - dt * 4);
      this.updateVisual(dt);
      if (this.deadT > 4) this.remove = true;
      return;
    }
    if (this.mesh) this.mesh.visible = true;
    this.updateStatus(dt);
    this.stateT += dt;
    this.globalCd -= dt;
    for (const a of this.attacks) a.cdLeft -= dt;
    if (g.time - this.lastHit > 4) this.poise = Math.min(this.maxPoise, this.poise + this.maxPoise * 0.08 * dt);
    let move = 0;
    const d = this.distTo(p);
    switch (this.state) {
      case 'wait':
        this.anim.update(dt, { speed: 0 });
        this.updateVisual(dt);
        return;
      case 'intro':
        this.faceTowards(p.pos.x, p.pos.z, 3, dt);
        if (this.stateT > 1.8) this._setState('chase');
        break;
      case 'phase':
        if (this.stateT > 1.8) {
          this.untargetable = false;
          this._setState('chase');
        }
        break;
      case 'chase': {
        if (!p.alive) break;
        this.faceTowards(p.pos.x, p.pos.z, 6 * this.speedMul, dt);
        if (this.globalCd <= 0) {
          const atk = this._choose(d);
          if (atk) {
            this._begin(atk);
            break;
          }
        }
        if (d > this.reach * 0.9 && !this.def.static) move = this.speed * this.speedMul * (d > 10 ? 1.1 : 0.8);
        break;
      }
      case 'attack': {
        const done = this.handler.update(this, this.curAtk, this.run, dt);
        move = this.run.move || 0;
        if (done) {
          this.curAtk = null;
          this.untargetable = false;
          this.leaping = false;
          this._setState('recover');
          this.recoverT = rand(0.5, 1.1) / this.speedMul * settings.difficulty.telegraph;
        }
        break;
      }
      case 'recover':
        this.faceTowards(p.pos.x, p.pos.z, 3, dt);
        if (this.stateT > this.recoverT) this._setState('chase');
        break;
      case 'stagger':
        if (this.stateT > this.staggerT) this._setState('chase');
        break;
      default:
        this._setState('chase');
    }
    if (this.stunned) move = 0;
    if (move > 0 && !this.def.static) {
      const fx = this.run && this.run.dirX !== undefined && this.state === 'attack' ? this.run.dirX : Math.sin(this.yaw);
      const fz = this.run && this.run.dirZ !== undefined && this.state === 'attack' ? this.run.dirZ : Math.cos(this.yaw);
      this.pos.x += fx * move * dt;
      this.pos.z += fz * move * dt;
      g.world.colliders.resolve(this.pos, this.radius, this.pos.y + 0.3, this.height);
      this._keepInArena();
    }
    if (!this.leaping && !this.flying) {
      const gh = g.world.heightAt(this.pos.x, this.pos.z);
      this.pos.y = this.def.rig === 'serpent' ? Math.max(gh, g.world.liquidLevel - 0.4) : gh;
    }
    this.anim.update(dt, { speed: move, grounded: true, flying: this.flying, lookYaw: clamp(this.angleTo(p), -0.7, 0.7) });
    this.updateVisual(dt);
    if (this.def.aura && p.alive && d < this.def.aura.radius * this.scale * 0.5 + 1.5) {
      this.auraT = (this.auraT || 0) - dt;
      if (this.auraT <= 0) {
        this.auraT = 0.5;
        g.combat.hit(p, { amount: this.dmg * this.def.aura.dps, element: this.def.aura.element, source: this, kind: 'hazard', canBlock: false, poise: 0, silent: true });
      }
    }
  }

  _keepInArena() {
    const a = this.arena;
    const dx = this.pos.x - a.x;
    const dz = this.pos.z - a.z;
    const d = Math.hypot(dx, dz);
    const max = a.r - 1;
    if (d > max) {
      this.pos.x = a.x + (dx / d) * max;
      this.pos.z = a.z + (dz / d) * max;
    }
  }

  _choose(d) {
    const opts = this.attacks.filter((a) => {
      if (a.cdLeft > 0) return false;
      if ((a.type === 'combo' || a.type === 'slam') && d > (a.range || 3) * Math.sqrt(this.scale) * 0.75 + 2) return false;
      if (a.type === 'summon' && this.summons.filter((s) => s.alive).length >= 5) return false;
      if (a.type === 'clones' && this.game.enemies.filter((e) => e.alive && e.clone).length >= 3) return false;
      if (a.type === 'tailSweep' && d > (a.radius || 6) + 1) return false;
      if (a.type === 'drain' && d > (a.range || 10)) return false;
      return true;
    });
    if (!opts.length) return null;
    // Favorise les attaques à distance si le joueur est loin
    const a = weightedPick(opts, (o) => (o.weight || 1) * (d > 9 && ['combo', 'slam', 'spin'].includes(o.type) ? 0.25 : 1) * (d < 5 && ['fan', 'homing', 'rain'].includes(o.type) ? 0.6 : 1));
    a.cdLeft = (a.cd || 3) * rand(0.9, 1.2);
    return a;
  }

  _begin(atk) {
    this._setState('attack');
    this.curAtk = atk;
    this.run = { t: 0, step: 0, move: 0, hits: new Set() };
    this.handler = BOSS_ATTACKS[atk.type] || BOSS_ATTACKS.combo;
    this.handler.start(this, atk, this.run);
    this.flash(0xffa040, 0.5);
    this.globalCd = 0.3;
  }

  // Coup au corps à corps sur le joueur (arc devant le boss)
  meleeCheck(atk, range, arc = 1.8) {
    const p = this.player;
    const d = this.distTo(p);
    const ang = Math.abs(this.angleTo(p));
    if (d <= range + p.radius && ang <= arc / 2 + 0.35) this.hurt(atk, 'melee');
  }

  hurt(atk, kind = 'aoe', mul = 1) {
    const p = this.player;
    this.game.combat.hit(p, {
      amount: this.dmg * this.dmgMul * (atk.dmg || 1) * mul, element: atk.element || 'physical', source: this, kind, canBlock: kind !== 'tick', poise: kind === 'tick' ? 0 : 35 * (atk.dmg || 1),
      knock: kind === 'melee' ? 4 : 6, status: atk.status, stun: atk.stun, lifesteal: atk.lifesteal, dirX: p.pos.x - this.pos.x, dirZ: p.pos.z - this.pos.z,
    });
  }

  front(dist) {
    return { x: this.pos.x + Math.sin(this.yaw) * dist, z: this.pos.z + Math.cos(this.yaw) * dist };
  }

  receiveHit(info) {
    if (this.state === 'wait' || this.state === 'intro' || this.untargetable) return null;
    const r = super.receiveHit(info);
    // Changement de phase
    const ph = this.bossDef.phases && this.bossDef.phases[this.phaseIdx];
    if (this.alive && ph && this.hp / this.maxHp <= ph.at) {
      this.phaseIdx++;
      this.speedMul *= ph.speed || 1;
      this.dmgMul *= ph.dmg || 1;
      for (const a of ph.add || []) this.attacks.push({ ...a, cdLeft: 0.5 });
      this.game.hud.bossPhase(ph.msg);
      this.game.effects.ring(this.pos, 0xffffff, 10, 0.8);
      this.game.effects.shockwave(this.pos, 1, 0xffffff);
      if (settings.get('slowmo')) this.game.slowMo(0.35, 0.6);
      this.game.camRig.shake(0.5);
      audio.play('roar', { pos: this.pos });
      this.untargetable = true;
      this.curAtk = null;
      this.leaping = false;
      this.flying = false;
      this.dissolve = 0;
      this._setState('phase');
      if (this.def.rig === 'humanoid') this.anim.play('roar', 1.2);
      else this.anim.play('roar', 1, { dur: 1.6 });
      this.game.combat.zone({ x: this.pos.x, z: this.pos.z, radius: 4 + this.scale, delay: 1.2, dmg: this.dmg * 0.8, team: 'enemy', source: this, element: this.bossDef.attacks[0].element || 'physical' });
    }
    return r;
  }

  onParried() {
    this.poise -= this.maxPoise * 0.3;
    if (this.poise <= 0) {
      this._stagger(2.5);
      this.poise = this.maxPoise;
    }
  }
}

// =================== Bibliothèque d'attaques ===================
const BOSS_ATTACKS = {
  combo: {
    start(b, a, r) {
      r.idx = 0;
      r.clip = b._clip(a.anims[0], a);
      r.hit = false;
    },
    update(b, a, r, dt) {
      r.t += dt;
      const t = r.t / r.clip.dur;
      const p = b.player;
      const d = b.distTo(p);
      if (t < r.clip.hit[0]) b.faceTowards(p.pos.x, p.pos.z, 7, dt);
      r.move = t > 0.05 && t < r.clip.hit[1] && d > b.reach * 0.7 ? b.speed * 1.2 * b.speedMul : 0;
      if (!r.hit && t >= r.clip.hit[0] && t <= r.clip.hit[1]) {
        const range = (a.range || 3) * Math.sqrt(b.scale) * 0.62 + 0.6;
        const p2 = b.player;
        if (b.distTo(p2) <= range + p2.radius && Math.abs(b.angleTo(p2)) <= 1.2) {
          r.hit = true;
          b.hurt(a, 'melee');
        }
        if (t >= r.clip.hit[0] + 0.02 && !r.swung) {
          r.swung = true;
          audio.play('swing', { pos: b.pos, weight: 2 });
        }
      }
      if (t >= 1) {
        r.idx++;
        if (r.idx >= a.anims.length) return true;
        r.t = 0;
        r.hit = false;
        r.swung = false;
        r.clip = b._clip(a.anims[r.idx], a);
      }
      return false;
    },
  },
  slam: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'slam', a);
      const f = b.front(1.5 + b.scale * 0.6);
      b.game.combat.zone({ x: f.x, z: f.z, radius: a.radius || 4, delay: r.clip.dur * r.clip.hit[0], dmg: b.dmg * b.dmgMul * (a.dmg || 1.5), element: a.element || 'physical', team: 'enemy', source: b, status: a.status, visual: 'burst', shake: 0.5, poise: 60 });
      if (a.pools) r.pool = f;
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (r.pool && r.t / r.clip.dur >= r.clip.hit[0]) {
        b.game.combat.hazard({ x: r.pool.x, z: r.pool.z, radius: (a.radius || 4) * 0.8, duration: 6, dps: b.dmg * 0.3, element: 'poison', team: 'enemy', source: b, status: { poison: 3 } });
        r.pool = null;
      }
      return r.t >= r.clip.dur;
    },
  },
  spin: {
    start(b, a, r) {
      r.n = 0;
      r.clip = b._clip('spin', a);
      b.game.effects.telegraph({ x: b.pos.x, z: b.pos.z, radius: a.radius, duration: r.clip.dur * r.clip.hit[0], follow: b.pos });
    },
    update(b, a, r, dt) {
      r.t += dt;
      const t = r.t / r.clip.dur;
      const p = b.player;
      b.faceTowards(p.pos.x, p.pos.z, 2, dt);
      r.move = t > 0.2 ? b.speed * 0.6 * b.speedMul : 0;
      if (t >= r.clip.hit[0] && t <= r.clip.hit[1] && !r.hit && b.distTo(p) < a.radius + p.radius) {
        r.hit = true;
        b.hurt(a, 'aoe');
      }
      if (t >= 0.3 && !r.fx) {
        r.fx = true;
        b.game.effects.ring(b.pos, ELEMENT_COLORS[a.element] || 0xffffff, a.radius, 0.3, 1);
        audio.play('swing', { pos: b.pos, weight: 2.5 });
      }
      if (t >= 1) {
        r.n++;
        if (r.n >= (a.spins || 2)) return true;
        r.t = 0;
        r.hit = false;
        r.fx = false;
        r.clip = b._clip('spin', a);
      }
      return false;
    },
  },
  charge: {
    start(b, a, r) {
      const p = b.player;
      b.faceTowards(p.pos.x, p.pos.z, -1, 0);
      r.dirX = Math.sin(b.yaw);
      r.dirZ = Math.cos(b.yaw);
      r.len = Math.min(20, b.distTo(p) + 6);
      r.wind = 0.8 * settings.difficulty.telegraph / b.speedMul;
      b.game.effects.telegraph({ x: b.pos.x, z: b.pos.z, shape: 'line', dir: b.yaw, length: r.len, width: 2 + b.scale * 0.5, duration: r.wind });
      if (b.def.rig === 'humanoid') b.anim.play('roar', 1.6);
      else b.anim.play('roar', 1, { dur: r.wind });
      r.phase = 0;
      r.moved = 0;
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (r.phase === 0) {
        r.move = 0;
        if (r.t >= r.wind) {
          r.phase = 1;
          b._clip(a.anim || 'thrust', a);
          audio.play('roar', { pos: b.pos });
        }
        return false;
      }
      const sp = 20 * Math.min(1.3, b.speedMul);
      r.move = sp;
      r.moved += sp * dt;
      b.yaw = Math.atan2(r.dirX, r.dirZ);
      const p = b.player;
      if (!r.hit && b.distTo(p) < b.radius + p.radius + 0.8) {
        r.hit = true;
        b.hurt(a, 'melee');
      }
      if (Math.random() < 0.6) b.game.effects.dust(b.pos, 2);
      if (r.moved >= r.len) {
        r.move = 0;
        return true;
      }
      return false;
    },
  },
  leap: {
    start(b, a, r) {
      const p = b.player;
      r.clip = b._clip(a.anim || 'jumpAtk', a);
      r.from = b.pos.clone();
      r.to = new THREE.Vector3(p.pos.x, 0, p.pos.z);
      const land = r.clip.dur * r.clip.hit[0];
      b.game.combat.zone({ x: r.to.x, z: r.to.z, radius: a.radius || 4, delay: land, dmg: b.dmg * b.dmgMul * (a.dmg || 1.5), element: a.element || 'physical', team: 'enemy', source: b, visual: 'burst', shake: 0.55, poise: 60 });
      r.land = land;
    },
    update(b, a, r, dt) {
      r.t += dt;
      const k = clamp((r.t - r.land * 0.25) / (r.land * 0.75), 0, 1);
      if (r.t < r.land) {
        b.leaping = true;
        b.pos.x = r.from.x + (r.to.x - r.from.x) * k;
        b.pos.z = r.from.z + (r.to.z - r.from.z) * k;
        b.pos.y = b.game.world.heightAt(b.pos.x, b.pos.z) + Math.sin(k * Math.PI) * (4 + b.scale);
        b.faceTowards(r.to.x, r.to.z, 8, dt);
      } else b.leaping = false;
      return r.t >= r.clip.dur;
    },
  },
  fan: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'cast', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      const p = b.player;
      if (r.t / r.clip.dur < r.clip.hit[0]) b.faceTowards(p.pos.x, p.pos.z, 8, dt);
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        const n = a.count || 5;
        const from = new THREE.Vector3(b.pos.x + Math.sin(b.yaw) * b.scale * 0.6, b.pos.y + b.hover + b.height * 0.55, b.pos.z + Math.cos(b.yaw) * b.scale * 0.6);
        const ground = a.proj === 'shadowWave' || a.proj === 'fireWave';
        if (ground) from.y = b.pos.y;
        const base = Math.atan2(p.pos.x - from.x, p.pos.z - from.z);
        const pitch = ground ? 0 : Math.atan2(p.pos.y + 1 - from.y, Math.max(1, b.distTo(p)));
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) - 0.5) * (a.spread || 0.8) : 0);
          const dir = new THREE.Vector3(Math.sin(ang) * Math.cos(pitch), Math.sin(pitch), Math.cos(ang) * Math.cos(pitch));
          b.game.combat.projectile({ type: a.proj || 'shadow', from, dir, target: p.pos, team: 'enemy', dmg: b.dmg * b.dmgMul * (a.dmg || 1), element: a.element, status: a.status, source: b });
        }
        audio.play('cast', { pos: b.pos, element: a.element || 'arcane' });
      }
      return r.t >= r.clip.dur;
    },
  },
  homing: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'cast', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        const p = b.player;
        const n = a.count || 3;
        for (let i = 0; i < n; i++) {
          const ang = b.yaw + (i / Math.max(1, n - 1) - 0.5) * 2.2;
          const from = new THREE.Vector3(b.pos.x, b.pos.y + b.hover + b.height * 0.7, b.pos.z);
          const dir = new THREE.Vector3(Math.sin(ang), 0.5, Math.cos(ang)).normalize();
          b.game.combat.projectile({ type: a.proj || 'soul', from, dir, team: 'enemy', dmg: b.dmg * b.dmgMul * (a.dmg || 0.8), element: a.element || 'shadow', homing: 2.4, homingTarget: p, source: b, speed: 9, life: 6 });
        }
        audio.play('cast', { pos: b.pos, element: 'shadow' });
      }
      return r.t >= r.clip.dur;
    },
  },
  spikes: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'slam', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      const p = b.player;
      if (r.t / r.clip.dur < r.clip.hit[0]) b.faceTowards(p.pos.x, p.pos.z, 8, dt);
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        const n = a.count || 7;
        const dx = Math.sin(b.yaw);
        const dz = Math.cos(b.yaw);
        for (let i = 0; i < n; i++) {
          const dist = 2 + b.scale * 0.5 + i * 2;
          b.game.combat.zone({ x: b.pos.x + dx * dist, z: b.pos.z + dz * dist, radius: 1.4, delay: 0.35 + i * 0.09, dmg: b.dmg * b.dmgMul * (a.dmg || 1.2), element: a.element || 'physical', team: 'enemy', source: b, visual: SPIKE_VISUAL[a.proj] || 'spike', quiet: i % 2 === 1, shake: 0.1 });
        }
      }
      return r.t >= r.clip.dur;
    },
  },
  rain: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', a);
      const p = b.player;
      const n = a.count || 8;
      const tel = (a.telegraph || 1.1) * settings.difficulty.telegraph;
      for (let i = 0; i < n; i++) {
        const ang = rand(0, Math.PI * 2);
        const rr = i === 0 ? 0 : rand(2, 8);
        let x = p.pos.x + Math.cos(ang) * rr;
        let z = p.pos.z + Math.sin(ang) * rr;
        const ar = b.arena;
        const da = Math.hypot(x - ar.x, z - ar.z);
        if (da > ar.r) {
          x = ar.x + ((x - ar.x) / da) * ar.r;
          z = ar.z + ((z - ar.z) / da) * ar.r;
        }
        b.game.combat.zone({ x, z, radius: a.radius || 2.5, delay: tel + i * 0.14, dmg: b.dmg * b.dmgMul * (a.dmg || 1), element: a.element || 'physical', team: 'enemy', source: b, visual: RAIN_VISUAL[a.proj] || 'meteor', quiet: i % 2 === 1 });
      }
    },
    update(b, a, r, dt) {
      r.t += dt;
      return r.t >= r.clip.dur;
    },
  },
  nova: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castAoe', a);
      b.game.combat.zone({ x: b.pos.x, z: b.pos.z, radius: a.radius || 7, delay: r.clip.dur * r.clip.hit[0], dmg: b.dmg * b.dmgMul * (a.dmg || 1.4), element: a.element || 'physical', team: 'enemy', source: b, status: a.status, shake: 0.5 });
    },
    update(b, a, r, dt) {
      r.t += dt;
      return r.t >= r.clip.dur;
    },
  },
  summon: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        b._summon({ summon: a.summon, count: a.count || 2 });
      }
      return r.t >= r.clip.dur;
    },
  },
  teleport: {
    start(b, a, r) {
      r.phase = 0;
      b.untargetable = true;
      audio.play('cast', { pos: b.pos, element: 'shadow' });
    },
    update(b, a, r, dt) {
      r.t += dt;
      const g = b.game;
      const p = b.player;
      if (r.phase === 0) {
        b.dissolve = Math.min(1, b.dissolve + dt * 3);
        if (b.dissolve >= 1) {
          const ang = p.yaw + Math.PI + rand(-0.7, 0.7);
          const rr = 2.5 + b.scale * 0.6;
          b.pos.set(p.pos.x + Math.sin(ang) * rr, 0, p.pos.z + Math.cos(ang) * rr);
          b._keepInArena();
          b.pos.y = g.world.heightAt(b.pos.x, b.pos.z);
          b.faceTowards(p.pos.x, p.pos.z, -1, 0);
          g.particles.burst({ x: b.pos.x, y: b.pos.y + 1.5, z: b.pos.z }, 0xb04dff, 25, 4, 0.5, 0.7, { intensity: 2 });
          r.phase = 1;
          if (a.nova) g.combat.zone({ x: b.pos.x, z: b.pos.z, radius: a.nova, delay: 0.6, dmg: b.dmg * b.dmgMul * a.dmg, element: 'shadow', team: 'enemy', source: b });
        }
        return false;
      }
      if (r.phase === 1) {
        b.dissolve = Math.max(0, b.dissolve - dt * 4);
        if (b.dissolve <= 0) {
          b.untargetable = false;
          r.phase = 2;
          r.t = 0;
          r.clip = b._clip(a.anim || 'overhead', a);
        }
        return false;
      }
      const t = r.t / r.clip.dur;
      if (t < r.clip.hit[0]) b.faceTowards(p.pos.x, p.pos.z, 6, dt);
      if (!r.hit && t >= r.clip.hit[0] && t <= r.clip.hit[1]) {
        const range = 2 + b.scale * 0.8;
        if (b.distTo(p) <= range + p.radius && Math.abs(b.angleTo(p)) < 1.3) {
          r.hit = true;
          b.hurt(a, 'melee');
        }
      }
      return t >= 1;
    },
  },
  beam: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', { dur: (a.duration || 3) + 0.8, hit: [0.2, 0.95] });
      r.dur = r.clip.dur;
      r.tick = 0;
      r.angle = b.yaw - 0.9;
      b.faceTowards(b.player.pos.x, b.player.pos.z, -1, 0);
      r.angle = b.yaw - 0.9 * (Math.random() < 0.5 ? 1 : -1);
      r.sweep = (b.yaw - r.angle) * 2;
      r.warn = 0.7;
      b.game.effects.telegraph({ x: b.pos.x, z: b.pos.z, shape: 'cone', dir: b.yaw, radius: 20, angle: 1.0, duration: r.warn });
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (r.t < r.warn) return false;
      const k = clamp((r.t - r.warn) / (r.dur - r.warn), 0, 1);
      const ang = r.angle + r.sweep * k;
      const from = _a.set(b.pos.x, b.pos.y + b.hover + b.height * 0.55, b.pos.z);
      const len = 22;
      const to = _b.set(from.x + Math.sin(ang) * len, b.pos.y + 0.5, from.z + Math.cos(ang) * len);
      b.game.effects.beam(from, to, ELEMENT_COLORS[a.element] || 0xb04dff, 0.5, 0.05);
      if (Math.random() < 0.5) b.game.particles.burst(to, ELEMENT_COLORS[a.element] || 0xb04dff, 3, 3, 0.4, 0.4, { intensity: 2 });
      r.tick -= dt;
      if (r.tick <= 0) {
        r.tick = 0.2;
        const p = b.player;
        const dx = p.pos.x - from.x;
        const dz = p.pos.z - from.z;
        const along = dx * Math.sin(ang) + dz * Math.cos(ang);
        const side = Math.abs(dx * Math.cos(ang) - dz * Math.sin(ang));
        if (along > 0 && along < len && side < 1.1 + p.radius) b.hurt(a, 'tick', 1);
      }
      return r.t >= r.dur;
    },
  },
  breath: {
    start(b, a, r) {
      const dur = (a.duration || 2.2) + 0.6;
      r.clip = b._clip(a.anim || 'roar', { dur, hit: [0.2, 0.95] });
      r.dur = r.clip.dur;
      r.tick = 0;
      r.warn = 0.6;
      b.game.effects.telegraph({ x: b.pos.x, z: b.pos.z, shape: 'cone', dir: b.yaw, radius: a.range || 10, angle: a.arc || 0.6, duration: r.warn, follow: { get x() { return b.pos.x; }, get z() { return b.pos.z; }, get dir() { return b.yaw; } } });
    },
    update(b, a, r, dt) {
      r.t += dt;
      const p = b.player;
      b.faceTowards(p.pos.x, p.pos.z, 1.3 * b.speedMul, dt);
      if (r.t < r.warn) return false;
      const g = b.game;
      const col = ELEMENT_COLORS[a.element] || 0xff6a1a;
      const hx = b.pos.x + Math.sin(b.yaw) * b.scale * 0.8;
      const hz = b.pos.z + Math.cos(b.yaw) * b.scale * 0.8;
      const hy = b.pos.y + b.hover + b.height * 0.55;
      const range = a.range || 10;
      for (let k = 0; k < 4; k++) {
        const ang = b.yaw + rand(-1, 1) * (a.arc || 0.6) * 0.7;
        const sp = rand(9, 14);
        g.particles.spawn(hx, hy, hz, Math.sin(ang) * sp, rand(-1.5, 0), Math.cos(ang) * sp, range / sp, rand(0.5, 1), col, { intensity: 2.5, grow: 2, drag: 0.985 });
      }
      r.tick -= dt;
      if (r.tick <= 0) {
        r.tick = 0.22;
        const d = b.distTo(p);
        if (d < range && Math.abs(b.angleTo(p)) < (a.arc || 0.6)) b.hurt(a, 'tick');
      }
      return r.t >= r.dur;
    },
  },
  drain: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', { dur: (a.duration || 3) + 0.4, hit: [0.1, 0.95] });
      r.tick = 0;
    },
    update(b, a, r, dt) {
      r.t += dt;
      const p = b.player;
      if (r.t > 0.4 && b.distTo(p) < (a.range || 10) && b._canSee(p)) {
        const from = _a.set(b.pos.x, b.pos.y + b.hover + b.height * 0.65, b.pos.z);
        const to = _b.set(p.pos.x, p.pos.y + 1.2, p.pos.z);
        b.game.effects.beam(from, to, 0xff2244, 0.15, 0.05);
        r.tick -= dt;
        if (r.tick <= 0) {
          r.tick = 0.3;
          const res = b.game.combat.hit(p, { amount: b.dmg * b.dmgMul * (a.dmg || 0.25), element: 'blood', source: b, kind: 'tick', canBlock: false, poise: 0 });
          if (res && res.dmg) b.hp = Math.min(b.maxHp, b.hp + res.dmg * 2);
        }
      }
      return r.t >= r.clip.dur;
    },
  },
  pools: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        const p = b.player;
        for (let i = 0; i < (a.count || 4); i++) {
          const ang = rand(0, Math.PI * 2);
          const rr = i === 0 ? 0.5 : rand(3, 9);
          b.game.combat.hazard({ x: p.pos.x + Math.cos(ang) * rr, z: p.pos.z + Math.sin(ang) * rr, radius: a.radius || 2.5, duration: a.duration || 8, dps: b.dmg * b.dmgMul * (a.dmg || 0.15) * 2, element: a.element || 'poison', team: 'enemy', source: b, status: a.element === 'fire' ? { burn: 2 } : { poison: 3 } });
        }
        audio.play('cast', { pos: b.pos, element: a.element || 'poison' });
      }
      return r.t >= r.clip.dur;
    },
  },
  scream: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'roar', a);
      b.game.combat.zone({ x: b.pos.x, z: b.pos.z, radius: a.radius || 7, delay: 0.9 * settings.difficulty.telegraph, dmg: b.dmg * b.dmgMul * (a.dmg || 0.6), element: 'shadow', team: 'enemy', source: b, stun: a.stun || 1, canBlock: false, visual: 'none' });
      r.fxAt = 0.9 * settings.difficulty.telegraph;
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (!r.fx && r.t >= r.fxAt) {
        r.fx = true;
        b.game.effects.ring(b.pos, 0xc8d8ff, (a.radius || 7) * 1.2, 0.6, 1.4);
        b.game.effects.ring(b.pos, 0xc8d8ff, (a.radius || 7) * 0.8, 0.5, 0.6);
        audio.play('screech', { pos: b.pos, pitch: 0.6 });
      }
      return r.t >= Math.max(r.clip.dur, r.fxAt + 0.3);
    },
  },
  clones: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', a);
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (!r.fired && r.t / r.clip.dur >= r.clip.hit[0]) {
        r.fired = true;
        const g = b.game;
        for (let i = 0; i < (a.count || 2); i++) {
          const ang = (i / (a.count || 2)) * Math.PI * 2 + rand(0, 1);
          const x = b.arena.x + Math.cos(ang) * b.arena.r * 0.6;
          const z = b.arena.z + Math.sin(ang) * b.arena.r * 0.6;
          const c = g.spawnClone(b.bossDef, x, z, b.tier);
          if (c) g.particles.burst({ x, y: c.pos.y + 1.5, z }, 0x9a4dff, 20, 3, 0.4, 0.7, { intensity: 2 });
        }
        audio.play('cast', { pos: b.pos, element: 'shadow' });
      }
      return r.t >= r.clip.dur;
    },
  },
  pillars: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'castUp', a);
      r.n = 0;
      r.next = r.clip.dur * r.clip.hit[0];
    },
    update(b, a, r, dt) {
      r.t += dt;
      if (r.n < (a.count || 5) && r.t >= r.next) {
        const p = b.player;
        b.game.combat.zone({ x: p.pos.x + p.vel.x * 0.3, z: p.pos.z + p.vel.z * 0.3, radius: 2, delay: 0.85 * settings.difficulty.telegraph, dmg: b.dmg * b.dmgMul * (a.dmg || 1.2), element: a.element || 'lightning', team: 'enemy', source: b, visual: a.element === 'lightning' ? 'lightning' : 'pillar' });
        r.n++;
        r.next += 0.5 / b.speedMul;
      }
      return r.n >= (a.count || 5) && r.t >= r.clip.dur;
    },
  },
  tailSweep: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'sweep', a);
      b.game.combat.zone({ x: b.pos.x, z: b.pos.z, radius: a.radius || 7, delay: r.clip.dur * r.clip.hit[0], dmg: b.dmg * b.dmgMul * (a.dmg || 1.3), element: a.element || 'physical', team: 'enemy', source: b, groundOnly: true, visual: 'burst', knock: 9 });
    },
    update(b, a, r, dt) {
      r.t += dt;
      return r.t >= r.clip.dur;
    },
  },
  fly: {
    start(b, a, r) {
      r.phase = 0;
      b.flying = true;
      b.untargetable = true;
      b.anim.play(b.def.rig === 'humanoid' ? 'castUp' : 'roar', b.def.rig === 'humanoid' ? 0.6 : 1, b.def.rig === 'humanoid' ? null : { dur: 1.2 });
      r.base = b.pos.y;
      r.n = 0;
      r.next = 1.2;
      audio.play('roar', { pos: b.pos });
    },
    update(b, a, r, dt) {
      r.t += dt;
      const g = b.game;
      const p = b.player;
      const gh = g.world.heightAt(b.pos.x, b.pos.z);
      const up = r.t < 1 ? r.t : r.t < r.next + (a.count || 8) * 0.35 + 0.8 ? 1 : Math.max(0, 1 - (r.t - (r.next + (a.count || 8) * 0.35 + 0.8)));
      b.pos.y = gh + up * 8;
      b.faceTowards(p.pos.x, p.pos.z, 3, dt);
      if (r.n < (a.count || 8) && r.t >= r.next) {
        const ang = rand(0, Math.PI * 2);
        const rr = r.n % 3 === 0 ? 0 : rand(1.5, 6);
        const vis = a.proj === 'blood' ? 'shadowOrb' : a.proj === 'shadowOrb' ? 'shadowOrb' : 'meteor';
        g.combat.zone({ x: p.pos.x + Math.cos(ang) * rr, z: p.pos.z + Math.sin(ang) * rr, radius: 2.4, delay: 1 * settings.difficulty.telegraph, dmg: b.dmg * b.dmgMul * (a.dmg || 1), element: a.proj === 'blood' ? 'blood' : a.proj === 'shadowOrb' ? 'shadow' : 'fire', team: 'enemy', source: b, visual: vis, quiet: r.n % 2 === 1 });
        r.n++;
        r.next += 0.35;
      }
      if (r.n >= (a.count || 8) && up <= 0 && !r.landed) {
        r.landed = true;
        b.flying = false;
        b.untargetable = false;
        g.combat.zone({ x: b.pos.x, z: b.pos.z, radius: 5, delay: 0.05, dmg: b.dmg * b.dmgMul, team: 'enemy', source: b, visual: 'burst', shake: 0.6 });
        return true;
      }
      return r.t > 12;
    },
  },
  shockwaves: {
    start(b, a, r) {
      r.clip = b._clip(a.anim || 'slam', a);
      r.n = 0;
      r.waves = [];
      r.next = r.clip.dur * r.clip.hit[0];
    },
    update(b, a, r, dt) {
      r.t += dt;
      const g = b.game;
      const p = b.player;
      if (r.n < (a.count || 3) && r.t >= r.next) {
        r.waves.push({ x: b.pos.x, z: b.pos.z, rad: 0.5, hit: false });
        g.effects.ring(b.pos, ELEMENT_COLORS[a.element] || 0xffc080, 16, 16 / 10, 0.3);
        g.camRig.shake(0.25);
        audio.play('explosion', { pos: b.pos });
        r.n++;
        r.next += 0.65 / b.speedMul;
      }
      for (const w of r.waves) {
        w.rad += dt * 10;
        if (w.hit || w.rad > 17) continue;
        const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
        const airborne = p.pos.y > g.world.heightAt(p.pos.x, p.pos.z) + 0.5;
        if (Math.abs(d - w.rad) < 0.7 && !airborne) {
          w.hit = true;
          b.hurt(a, 'aoe');
        }
      }
      return r.n >= (a.count || 3) && r.t >= r.next + 1;
    },
  },
};
