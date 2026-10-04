// Faune sauvage : apparition, intelligence artificielle, combat, cadavres.
import * as THREE from 'three';
import { G, bus } from '../core/state.js';
import { SPECIES } from '../data/species.js';
import { buildSpecies } from '../models/creatures.js';
import { buildApe } from '../models/humans.js';
import { animateRig, noShadow } from '../models/kit.js';
import { rand, pick, clamp, dampAngle } from '../core/util.js';
import { MICRO_R, MICRO_FLOOR, MICRO_CEIL } from '../world/micro.js';
import { WATER, SIZE } from '../world/terrain.js';
import { sfx } from '../core/audio.js';

const tmp = new THREE.Vector3();

export class Creature {
  constructor(id, pos) {
    const def = SPECIES[id];
    this.id = id;
    this.def = def;
    this.env = def.env;
    this.size = def.size * rand(0.85, 1.15);
    this.radius = this.size * (def.env === 'land' ? 0.5 : 0.8);
    this.maxHp = def.hp * (this.size / def.size);
    this.hp = this.maxHp;
    this.alive = true;
    this.side = 'wild';
    this.model = def.model === 'ape' ? buildApe(def.color) : buildSpecies(id, def);
    this.model.scale.setScalar(def.model === 'ape' ? this.size * 1.3 : this.size);
    if (this.size < 1.2 || def.env !== 'land') noShadow(this.model);
    this.pos = this.model.position;
    this.pos.copy(pos);
    this.vel = new THREE.Vector3();
    this.yaw = rand(0, Math.PI * 2);
    this.pitch = 0;
    this.state = 'wander';
    this.goal = pos.clone();
    this.timer = 0;
    this.atkCd = 0;
    this.atkAnim = 0;
    this.anim = rand(0, 10);
    this.target = null;
    this.angry = 0;
    this.burn = 0;
    this.infected = 0;
    this.home = pos.clone();
    this.corpseTime = 0;
    this.hitFlash = 0;
  }

  get hostile() {
    return this.def.behavior === 'predator' || this.angry > 0;
  }

  damage(amount, side, from) {
    if (!this.alive) return;
    const armor = this.def.armored ? 0.6 : 1;
    this.hp -= amount * armor;
    this.hitFlash = 0.15;
    G.fx.burst(tmp.copy(this.pos).setY(this.pos.y + this.size * 0.5), this.env === 'land' ? 0xa01010 : 0xffffff, 6, 3, 0.5);
    if (side === 'player') G.fx.text(tmp.clone().setY(this.pos.y + this.size + 0.5), '-' + Math.round(amount * armor), '#ffd040');
    if (this.hp <= 0) {
      this.die(side);
      return;
    }
    if (this.def.behavior === 'prey' || this.def.behavior === 'hazard') {
      this.state = 'flee';
      this.timer = 6;
    } else {
      this.angry = 15;
      this.state = 'chase';
      this.target = side === 'player' ? G.player : null;
    }
  }

  infect(level) {
    this.infected = Math.max(this.infected, level);
  }

  die(side) {
    this.alive = false;
    this.state = 'dead';
    sfx('hit');
    if (side === 'player') {
      G.stats.kills++;
      bus.emit('kill', this);
    }
    if (this.env === 'land') {
      this.corpse = true;
      this.corpseTime = 150;
      if (this.def.flying) this.pos.y = G.world.height(this.pos.x, this.pos.z);
      this.model.rotation.z = Math.PI / 2;
      this.model.position.y += this.size * 0.15;
    } else {
      G.fx.burst(this.pos, this.def.color, 20, 4, 1);
      if (side === 'player') bus.emit('eatCreature', this);
      this.remove = true;
    }
  }
}

export class CreatureManager {
  constructor() {
    this.list = [];
    this.scene = null;
    this.spawnTimer = 0;
  }

  clear() {
    for (const c of this.list) c.model.parent?.remove(c.model);
    this.list = [];
  }

  attach(scene) {
    this.scene = scene;
  }

  allowed() {
    const st = G.stage;
    const out = [];
    for (const [id, s] of Object.entries(SPECIES)) {
      if (st < s.stages[0] || st > s.stages[1]) continue;
      if (G.mode === 'micro' && s.env !== 'micro') continue;
      if (G.mode === 'world' && s.env === 'micro') continue;
      if (s.yearMax !== undefined && G.time.year > s.yearMax) continue;
      if (s.needTech && !G.techs.includes(s.needTech)) continue;
      out.push(id);
    }
    return out;
  }

  spawn(id, pos) {
    const c = new Creature(id, pos);
    this.scene.add(c.model);
    this.list.push(c);
    return c;
  }

  spawnPoint(id, near) {
    const s = SPECIES[id];
    if (s.env === 'micro') {
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * MICRO_R * 0.95;
        const p = new THREE.Vector3(Math.cos(a) * r, rand(MICRO_FLOOR + 3, MICRO_CEIL - 3), Math.sin(a) * r);
        if (!near || p.distanceTo(near) > 25) return p;
      }
      return null;
    }
    const w = G.world;
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(45, 160);
      const x = near.x + Math.cos(a) * r;
      const z = near.z + Math.sin(a) * r;
      if (Math.abs(x) > SIZE / 2 - 10 || Math.abs(z) > SIZE / 2 - 10) continue;
      const h = w.height(x, z);
      if (s.env === 'ocean') {
        if (h > -4) continue;
        const y = s.bottom ? h + 0.5 : rand(h + 1.5, WATER - 1.5);
        return new THREE.Vector3(x, y, z);
      }
      if (h < 1.2 || h > 58) continue;
      if (s.flying) return new THREE.Vector3(x, h + rand(12, 22), z);
      return new THREE.Vector3(x, h, z);
    }
    return null;
  }

  populate() {
    if (!this.scene) return;
    const near = G.player ? G.player.pos : new THREE.Vector3();
    const allowed = this.allowed();
    const counts = {};
    for (const c of this.list) if (c.alive) counts[c.id] = (counts[c.id] || 0) + 1;
    const cap = G.mode === 'micro' ? 260 : G.settings.quality === 'low' ? 45 : 75;
    let total = this.list.filter((c) => c.alive).length;
    for (const id of allowed) {
      const s = SPECIES[id];
      let want = s.count;
      if (G.mode === 'world') {
        // Densité plus forte dans le bon milieu
        const inWater = G.player && G.player.inWater;
        want = Math.ceil(s.count * (s.env === 'ocean' ? (inWater || G.stage === 2 ? 0.5 : 0.1) : inWater && G.stage === 2 ? 0 : 0.28));
      }
      let have = counts[id] || 0;
      while (have < want && total < cap) {
        const p = this.spawnPoint(id, near);
        if (!p) break;
        const n = s.group ? Math.min(s.group, want - have) : 1;
        for (let k = 0; k < n; k++) {
          const q = p.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
          if (s.env === 'land') q.y = s.flying ? q.y : G.world.height(q.x, q.z);
          this.spawn(id, q);
          have++;
          total++;
        }
      }
    }
  }

  update(dt) {
    const P = G.player;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2;
      this.populate();
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (c.remove) {
        c.model.parent?.remove(c.model);
        this.list.splice(i, 1);
        continue;
      }
      // Hors de portée : on supprime
      if (G.mode === 'world' && P) {
        const d = c.pos.distanceTo(P.pos);
        if (d > 230) {
          c.remove = true;
          continue;
        }
        c.model.visible = d < 200;
      }
      if (!c.alive) {
        if (c.corpse) {
          c.corpseTime -= dt;
          if (c.corpseTime <= 0) c.remove = true;
        }
        continue;
      }
      this.think(c, dt, P);
    }
  }

  think(c, dt, P) {
    const def = c.def;
    c.anim += dt;
    c.timer -= dt;
    c.atkCd -= dt;
    c.angry -= dt;
    c.atkAnim = Math.max(0, c.atkAnim - dt * 3);
    if (c.burn > 0) {
      c.burn -= dt;
      c.hp -= 8 * dt;
      if (Math.random() < 0.3) G.fx.burst(c.pos, 0xff6010, 1, 1, 0.4, 2);
    }
    if (c.infected > 0) {
      c.hp -= c.infected * 3 * dt;
      if (Math.random() < 0.05) G.fx.burst(c.pos, 0x80ff40, 2, 1, 0.6, 1);
    }
    if (c.hp <= 0) {
      c.die('player');
      return;
    }
    if (!c.alive) return;
    const swim = c.env !== 'land';
    const flying = def.flying;
    let speed = def.speed * 0.35;
    const pPos = P ? P.pos : null;
    const dP = pPos ? c.pos.distanceTo(pPos) : 999;
    const pSize = P ? P.size : 1;
    const invisible = P && P.effects.invis > 0;

    // Décision
    if (P && P.alive && !invisible) {
      if (def.behavior === 'predator' || c.angry > 0) {
        const bigEnough = c.env !== 'micro' || c.size > pSize * 1.05 || c.angry > 0;
        const scared = P.monster && c.size < 3;
        if (scared && dP < 25) {
          c.state = 'flee';
          c.timer = 3;
        } else if (bigEnough && dP < 18 + c.size * 3 && (c.state !== 'flee' || c.timer <= 0)) c.state = 'chase';
        else if (c.state === 'chase' && dP > 55) c.state = 'wander';
        if (c.env === 'micro' && !bigEnough && dP < 10 && c.angry <= 0) {
          c.state = 'flee';
          c.timer = 2;
        }
      } else if (def.behavior === 'prey' || def.behavior === 'neutral') {
        const threat = c.env === 'micro' ? pSize > c.size * 0.9 : def.behavior === 'prey' || P.monster;
        if (threat && dP < (c.env === 'micro' ? 12 : 14)) {
          c.state = 'flee';
          c.timer = 3;
        }
      } else if (def.behavior === 'friendly') {
        c.state = G.stage === 6 && dP < 40 && dP > 6 ? 'follow' : c.state === 'follow' ? 'wander' : c.state;
      }
    }
    if (c.state === 'flee' && c.timer <= 0) c.state = 'wander';

    // Cible de déplacement
    const goal = c.goal;
    if (c.state === 'chase' && pPos) {
      goal.copy(pPos);
      speed = def.speed * (c.env === 'micro' ? 0.75 : 0.85);
      const reach = c.radius + (P ? P.radius : 1) + 0.6;
      if (dP < reach && c.atkCd <= 0) {
        c.atkCd = def.behavior === 'hazard' ? 0.6 : 1.3;
        c.atkAnim = 1;
        if (def.atk > 0) {
          P.damage(def.atk * (c.size / def.size), c);
          if (def.trait === 'poison' || def.trait === 'venin') P.poison = Math.max(P.poison, 4);
        }
      }
    } else if (c.state === 'flee' && pPos) {
      goal.copy(c.pos).sub(pPos).normalize().multiplyScalar(20).add(c.pos);
      speed = def.speed;
    } else if (c.state === 'follow' && pPos) {
      goal.copy(pPos);
      speed = def.speed * 0.6;
    } else {
      if (c.timer <= 0 || c.pos.distanceTo(goal) < 2) {
        c.timer = rand(3, 8);
        const r = c.env === 'micro' ? 25 : 30;
        goal.set(c.home.x + rand(-r, r), c.pos.y + rand(-6, 6), c.home.z + rand(-r, r));
        if (Math.random() < 0.25) {
          goal.copy(c.pos);
          c.timer = rand(2, 4);
        }
      }
    }
    // Contact dangereux (virus, méduses)
    if (def.behavior === 'hazard' && P && dP < c.radius + P.radius && c.atkCd <= 0) {
      c.atkCd = 0.8;
      P.damage(def.atk, c);
      if (def.trait === 'poison') P.poison = Math.max(P.poison, 3);
    }

    // Mouvement
    tmp.copy(goal).sub(c.pos);
    if (!swim && !flying) tmp.y = 0;
    const dist = tmp.length();
    if (dist > 0.3) {
      tmp.normalize();
      const targetYaw = Math.atan2(tmp.x, tmp.z);
      c.yaw = dampAngle(c.yaw, targetYaw, swim ? 3 : 5, dt);
      const fwd = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
      const sp = dist < 1 ? speed * dist : speed;
      c.vel.x = fwd.x * sp;
      c.vel.z = fwd.z * sp;
      c.vel.y = swim || flying ? tmp.y * sp * 0.6 : 0;
    } else {
      c.vel.multiplyScalar(0.9);
    }
    c.pos.addScaledVector(c.vel, dt);

    // Contraintes de milieu
    if (c.env === 'micro') {
      G.micro.clamp(c.pos, c.radius);
    } else if (c.env === 'ocean') {
      const h = G.world.height(c.pos.x, c.pos.z);
      if (h > -2) {
        // Ne pas s'échouer
        c.pos.addScaledVector(c.vel, -dt * 2);
        c.goal.copy(c.home);
      }
      c.pos.y = clamp(c.pos.y, h + 0.4 + (def.bottom ? 0 : c.radius), WATER - 0.6);
      if (def.bottom) c.pos.y = h + 0.3;
    } else if (flying) {
      const h = G.world.height(c.pos.x, c.pos.z);
      c.pos.y = Math.max(h + 6, Math.min(h + 30, c.pos.y));
      if (c.state === 'wander') {
        c.goal.y = h + 18;
      }
    } else {
      const h = G.world.height(c.pos.x, c.pos.z);
      if (h < 0.3) {
        // Évite l'eau
        c.pos.addScaledVector(c.vel, -dt * 1.5);
        c.goal.copy(c.home);
      }
      c.pos.y = G.world.height(c.pos.x, c.pos.z);
      if (c.size > 0.8) G.world.collide(c.pos, c.radius * 0.6);
    }

    c.model.rotation.y = c.yaw;
    if (swim) {
      c.pitch = clamp(-c.vel.y * 0.08, -0.6, 0.6);
      c.model.rotation.x = c.pitch;
    }
    animateRig(c.model, c.anim, c.vel.length(), c.atkAnim > 0 ? 1 - c.atkAnim : 0);
    if (c.hitFlash > 0) {
      c.hitFlash -= dt;
      c.model.scale.setScalar((def.model === 'ape' ? c.size * 1.3 : c.size) * (1 + c.hitFlash));
    }
  }

  // Cadavre le plus proche (pour manger / dépecer)
  nearestCorpse(pos, r) {
    let best = null;
    let bd = r;
    for (const c of this.list) {
      if (!c.corpse || c.remove) continue;
      const d = c.pos.distanceTo(pos) - c.radius;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  // Créature vivante la plus proche dans un cône devant
  inFront(pos, yaw, range, cone = 0.8, pitch = null) {
    let best = null;
    let bd = Infinity;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const c of this.list) {
      if (!c.alive) continue;
      tmp.copy(c.pos).sub(pos);
      if (pitch === null) tmp.y = 0;
      const d = tmp.length() - c.radius;
      if (d > range) continue;
      tmp.normalize();
      const dot = pitch === null ? tmp.dot(fwd) : tmp.dot(pitch);
      if (dot < cone && d > 0.6) continue;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }
}

export function randomSpeciesOfStage() {
  return pick(Object.keys(SPECIES));
}
