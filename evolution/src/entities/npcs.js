// Personnages non joueurs : villageois, peuples rivaux, envahisseurs, robots.
import * as THREE from 'three';
import { G, bus, toast } from '../core/state.js';
import { buildPerson, buildRobot, randomLook, soldierWeapon } from '../models/humans.js';
import { animateRig } from '../models/kit.js';
import { eraIndex } from '../data/tech.js';
import { rand, pick, clamp, dampAngle, mulberry } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { JOBS } from '../systems/civdata.js';

const tmp = new THREE.Vector3();

export class NPC {
  constructor(o) {
    Object.assign(this, o);
    this.era = eraIndex(G.time.year);
    this.radius = 0.45;
    this.alive = true;
    this.maxHp = o.maxHp ?? (o.role === 'soldat' ? 120 + this.era * 30 : o.kind === 'robot' ? (o.robotKind === 'combat' ? 600 : 250) : 60 + this.era * 10);
    this.hp = o.hp ?? this.maxHp;
    this.vel = new THREE.Vector3();
    this.yaw = rand(0, 6.28);
    this.goal = o.pos.clone();
    this.timer = 0;
    this.anim = rand(0, 10);
    this.atkCd = rand(0, 1);
    this.atkAnim = 0;
    this.build();
  }

  build() {
    if (this.kind === 'robot') this.model = buildRobot(this.robotKind);
    else this.model = buildPerson(this.look, this.era, this.role);
    this.model.scale.setScalar(this.kind === 'robot' ? (this.robotKind === 'combat' ? 2.4 : this.robotKind === 'drone' ? 2.5 : 1.8) : 1.7);
    this.model.position.copy(this.pos);
    this.pos = this.model.position;
  }

  get armed() {
    return this.role === 'soldat' || (this.kind === 'robot' && this.robotKind !== 'worker') || this.kind === 'raider';
  }

  prompt() {
    if (this.kind === 'robot') return `Donner un ordre : ${this.name}`;
    if (this.kind === 'faction') {
      const f = G.factions.find((x) => x.id === this.factionId);
      if (f && f.war && f.mil <= 0 && this.role === 'chef') return `Conquérir ${f.name} !`;
      return `Parler à ${this.name} (${f ? f.name : ''})`;
    }
    return `Parler à ${this.name} (${JOBS[this.role]?.name || 'Villageois'})`;
  }

  damage(amount, side) {
    if (!this.alive) return;
    this.hp -= amount;
    G.fx.burst(tmp.copy(this.pos).setY(this.pos.y + 1), this.kind === 'robot' ? 0xffd040 : 0xa01010, 6, 3, 0.5);
    if (side === 'player') G.fx.text(tmp.clone().setY(this.pos.y + 2), '-' + Math.round(amount), '#ffd040');
    if (side === 'player') bus.emit('npcHit', this);
    if (this.hp <= 0) {
      this.alive = false;
      this.dead = 8;
      this.model.rotation.z = Math.PI / 2;
      this.model.position.y += 0.3;
      bus.emit('npcDied', this, side);
      return;
    }
    if (side === 'player' && this.kind !== 'robot') {
      if (this.armed || this.kind === 'faction') this.aggro = 20;
      else this.fear = 8;
    }
    if (side === 'enemy' && !this.armed) this.fear = 6;
  }

  infect(level) {
    this.sick = level;
  }
}

export class NPCManager {
  constructor() {
    this.list = [];
    this.scene = null;
    this.timer = 0;
  }

  attach(scene) {
    this.scene = scene;
  }

  clear() {
    for (const n of this.list) n.model.parent?.remove(n.model);
    this.list = [];
  }

  add(o) {
    const n = new NPC(o);
    this.scene.add(n.model);
    this.list.push(n);
    return n;
  }

  remove(n) {
    n.model.parent?.remove(n.model);
    const i = this.list.indexOf(n);
    if (i >= 0) this.list.splice(i, 1);
  }

  spawnRobot(kind, pos) {
    const id = 'r' + Date.now().toString(36) + Math.floor(rand(0, 999));
    const names = { worker: 'Robot ouvrier', drone: 'Drone', combat: 'Robot de combat' };
    const data = { id, kind, name: `${names[kind]} #${G.robots.length + 1}`, mode: kind === 'combat' ? 'combat' : kind === 'drone' ? 'suivre' : 'recolter' };
    G.robots.push(data);
    this.spawnRobotEntity(data, pos);
  }

  spawnRobotEntity(data, pos) {
    return this.add({ kind: 'robot', robotKind: data.kind, name: data.name, data, pos: pos.clone(), side: 'ally', role: 'robot' });
  }

  // Remet les entités en cohérence avec les données (villages, robots...)
  sync() {
    const P = G.player;
    if (!P || G.mode !== 'world') return;
    // Robots : toujours près du joueur
    for (const r of G.robots) {
      if (!this.list.some((n) => n.data === r)) {
        const p = P.pos.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
        p.y = G.world.height(p.x, p.z);
        this.spawnRobotEntity(r, p);
      }
    }
    // Villageois visibles quand on est près du village
    const V = G.village;
    if (V) {
      const near = Math.hypot(P.pos.x - V.x, P.pos.z - V.z) < 230;
      for (const person of V.people) {
        const ent = this.list.find((n) => n.data === person);
        if (near && !ent && !person.dead) {
          const p = new THREE.Vector3(V.x + rand(-15, 15), 0, V.z + rand(-15, 15));
          p.y = G.world.height(p.x, p.z);
          this.add({ kind: 'villager', data: person, name: person.name, look: person.look, role: person.job, pos: p, side: 'villager', home: new THREE.Vector3(V.x, 0, V.z) });
        } else if (!near && ent) this.remove(ent);
      }
    }
    // Peuples rivaux
    for (const f of G.factions) {
      if (f.conquered || f.pop <= 0) {
        for (const n of this.list.filter((x) => x.factionId === f.id)) this.remove(n);
        continue;
      }
      const d = Math.hypot(P.pos.x - f.x, P.pos.z - f.z);
      const ents = this.list.filter((n) => n.factionId === f.id && n.kind === 'faction');
      if (d < 230) {
        const want = Math.min(10, 3 + Math.floor(f.pop / 4));
        const soldiersWant = Math.min(5, Math.ceil(f.mil / 15));
        const soldiers = ents.filter((n) => n.role === 'soldat' && n.alive).length;
        if (!ents.some((n) => n.role === 'chef')) this.spawnFactionMember(f, 'chef');
        if (soldiers < soldiersWant && ents.length < want + soldiersWant) this.spawnFactionMember(f, 'soldat');
        else if (ents.length < want) this.spawnFactionMember(f, pick(['fermier', 'bucheron', 'marchand', 'chasseur']));
      } else for (const n of ents) this.remove(n);
    }
  }

  spawnFactionMember(f, role) {
    const rnd = Math.random;
    const look = randomLook(rnd);
    look.top = f.color;
    const p = new THREE.Vector3(f.x + rand(-12, 12), 0, f.z + rand(-12, 12));
    p.y = G.world.height(p.x, p.z);
    const names = f.names || ['Ako', 'Bria', 'Tano', 'Yel', 'Mio', 'Rax'];
    return this.add({ kind: 'faction', factionId: f.id, name: role === 'chef' ? f.leader : pick(names), look, role, pos: p, side: f.war ? 'enemy' : 'neutral', home: new THREE.Vector3(f.x, 0, f.z) });
  }

  // Envahisseurs lors d'une guerre
  spawnRaid(f, count) {
    const V = G.village;
    if (!V) return;
    const a = Math.atan2(f.z - V.z, f.x - V.x);
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3(V.x + Math.cos(a) * 60 + rand(-6, 6), 0, V.z + Math.sin(a) * 60 + rand(-6, 6));
      p.y = G.world.height(p.x, p.z);
      const look = randomLook();
      look.top = f.color;
      this.add({ kind: 'raider', factionId: f.id, name: 'Soldat de ' + f.name, look, role: 'soldat', pos: p, side: 'enemy', home: new THREE.Vector3(V.x, 0, V.z) });
    }
  }

  nearest(pos, r) {
    let best = null;
    let bd = r;
    for (const n of this.list) {
      if (!n.alive) continue;
      if (n.side === 'enemy' && n.kind === 'raider') continue;
      const d = n.pos.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  inFront(pos, yaw, range) {
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    let best = null;
    let bd = Infinity;
    for (const n of this.list) {
      if (!n.alive || n.kind === 'robot') continue;
      tmp.copy(n.pos).sub(pos);
      tmp.y = 0;
      const d = tmp.length() - n.radius;
      if (d > range) continue;
      if (tmp.normalize().dot(fwd) < 0.55 && d > 0.6) continue;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  findEnemyFor(n, range) {
    let best = null;
    let bd = range;
    const hostile = (t) => {
      if (!t.alive || t === n) return false;
      if (n.side === 'enemy') return t.side === 'villager' || t.side === 'ally';
      if (n.side === 'ally' || n.side === 'villager') return t.side === 'enemy';
      return false;
    };
    for (const t of this.list) {
      if (!hostile(t)) continue;
      const d = t.pos.distanceTo(n.pos);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    // Les robots de combat attaquent aussi les prédateurs
    if ((n.side === 'ally' || (n.side === 'villager' && n.role === 'soldat')) && G.creatures) {
      for (const c of G.creatures.list) {
        if (!c.alive || !(c.hostile)) continue;
        const d = c.pos.distanceTo(n.pos);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    }
    const P = G.player;
    if (n.side === 'enemy' && P?.alive && P.effects.invis <= 0) {
      const d = P.pos.distanceTo(n.pos);
      if (d < bd) best = P;
    }
    return best;
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1.5;
      this.sync();
    }
    const P = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      if (!n.alive) {
        n.dead -= dt;
        if (n.dead <= 0) this.remove(n);
        continue;
      }
      if (P && n.pos.distanceTo(P.pos) > 260 && n.kind !== 'robot') {
        if (n.kind === 'raider') this.remove(n);
        continue;
      }
      this.think(n, dt, P);
    }
  }

  think(n, dt, P) {
    n.anim += dt;
    n.timer -= dt;
    n.atkCd -= dt;
    n.atkAnim = Math.max(0, n.atkAnim - dt * 3);
    if (n.fear > 0) n.fear -= dt;
    if (n.aggro > 0) n.aggro -= dt;
    if (n.sick) {
      n.hp -= n.sick * 2 * dt;
      if (n.hp <= 0) return n.damage(1, 'virus');
    }
    let speed = 2.2;
    let target = null;
    const night = G.time.hour < 6 || G.time.hour > 21;

    // Combat
    if (n.armed || n.aggro > 0) {
      target = n.aggro > 0 && P ? P : this.findEnemyFor(n, n.kind === 'raider' ? 70 : 35);
    }
    if (n.kind === 'faction') {
      const f = G.factions.find((x) => x.id === n.factionId);
      n.side = f && f.war ? 'enemy' : 'neutral';
      if (f && f.war && n.role === 'soldat' && P && P.pos.distanceTo(n.pos) < 45) target = P;
      if (n.role === 'chef' && !(n.aggro > 0)) target = null;
    }

    if (n.kind === 'robot') {
      const d = n.data;
      if (d.mode === 'combat' || n.robotKind === 'combat' || d.mode === 'garder') target = this.findEnemyFor(n, 40);
      else target = null;
      if (!target) {
        if (d.mode === 'garder' && G.village) n.goal.set(G.village.x + Math.sin(n.anim * 0.1) * 8, 0, G.village.z + Math.cos(n.anim * 0.1) * 8);
        else if (P) {
          const off = new THREE.Vector3(Math.sin(P.yaw + 2.4) * 3, 0, Math.cos(P.yaw + 2.4) * 3);
          n.goal.copy(P.pos).add(off);
        }
        speed = P && n.pos.distanceTo(P.pos) > 8 ? 9 : 4;
      }
    } else if (target) {
      // rien : on fonce sur la cible
    } else if (n.fear > 0 && P) {
      n.goal.copy(n.pos).sub(P.pos).setY(0).normalize().multiplyScalar(15).add(n.pos);
      speed = 5;
    } else if (n.kind === 'raider') {
      n.goal.copy(n.home);
      speed = 3.5;
    } else if (n.timer <= 0) {
      n.timer = rand(4, 10);
      const h = n.home;
      const r = night ? 6 : n.kind === 'villager' ? 22 : 16;
      n.goal.set(h.x + rand(-r, r), 0, h.z + rand(-r, r));
      if (Math.random() < 0.3) n.goal.copy(n.pos);
    }

    if (target) {
      const tp = target.pos;
      const d = tp.distanceTo(n.pos);
      const ranged = this.isRanged(n);
      const reach = ranged ? 28 : 1.8 + (target.radius || 0.5);
      speed = n.kind === 'robot' ? 7 : 4.5;
      if (d > reach * 0.8) n.goal.copy(tp);
      else n.goal.copy(n.pos);
      tmp.copy(tp).sub(n.pos);
      n.yaw = dampAngle(n.yaw, Math.atan2(tmp.x, tmp.z), 8, dt);
      if (d < reach && n.atkCd <= 0) {
        n.atkCd = ranged ? 1.4 : 1.1;
        n.atkAnim = 1;
        const dmg = this.npcDamage(n);
        if (ranged) {
          const from = n.pos.clone().add(new THREE.Vector3(0, 1.3, 0));
          const dir = tp.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(from).normalize();
          const kind = n.era >= 9 || n.robotKind === 'combat' ? 'laser' : n.era >= 5 ? 'bullet' : 'arrow';
          G.fx.spawnProjectile({ pos: from, vel: dir.multiplyScalar(kind === 'arrow' ? 45 : 110), dmg, kind, side: n.side === 'villager' ? 'ally' : n.side, life: 2 });
          sfx(kind === 'laser' ? 'laser' : 'shoot');
        } else {
          if (target === P) P.damage(dmg, n);
          else target.damage(dmg, n.side === 'villager' ? 'ally' : n.side, n.pos);
          sfx('hit');
        }
      }
    }

    // Déplacement
    tmp.copy(n.goal).sub(n.pos);
    tmp.y = 0;
    const dist = tmp.length();
    const flying = n.robotKind === 'drone';
    if (dist > 0.6) {
      tmp.normalize();
      if (!target) n.yaw = dampAngle(n.yaw, Math.atan2(tmp.x, tmp.z), 6, dt);
      n.vel.set(tmp.x * speed, 0, tmp.z * speed);
    } else n.vel.multiplyScalar(0.8);
    n.pos.addScaledVector(n.vel, dt);
    const gh = G.world.height(n.pos.x, n.pos.z);
    if (gh < 0.2 && !flying) {
      n.pos.addScaledVector(n.vel, -dt);
      n.timer = 0;
    }
    n.pos.y = flying ? Math.max(gh, 0) + 4 + Math.sin(n.anim * 2) * 0.3 : gh;
    G.world.collide(n.pos, 0.35);
    G.buildingsSys?.collide(n.pos, 0.35);
    n.model.rotation.y = n.yaw;
    if (flying && n.model.userData.rig.rotors) for (const r of n.model.userData.rig.rotors) r.rotation.y += dt * 40;
    // Travail : petits gestes quand immobile
    const work = !target && dist < 1 && n.kind === 'villager' && !night;
    animateRig(n.model, n.anim, n.vel.length() * 0.7, n.atkAnim > 0 ? 1 - n.atkAnim : work ? (n.anim * 0.8) % 1 : 0);
  }

  isRanged(n) {
    if (n.kind === 'robot') return n.robotKind !== 'worker';
    const w = soldierWeapon(n.era, 'soldat');
    return n.role === 'soldat' && ['mousquet', 'fusil', 'pistolet_laser'].includes(w);
  }

  npcDamage(n) {
    if (n.kind === 'robot') return n.robotKind === 'combat' ? 45 : n.robotKind === 'drone' ? 18 : 12;
    const base = n.role === 'soldat' ? 10 + n.era * 6 : 5;
    const bar = G.buildings.some((b) => b.type === 'caserne') && n.side === 'villager' ? 1.5 : 1;
    return base * bar * rand(0.8, 1.2);
  }
}

// Noms aléatoires
const N1 = ['Ka', 'Lo', 'Mi', 'Ta', 'Ru', 'Za', 'Ne', 'Bo', 'Li', 'Sa', 'Yo', 'Fa', 'Da', 'Ni', 'Te', 'Va'];
const N2 = ['ra', 'lo', 'mi', 'na', 'ko', 'ri', 'sa', 'ta', 'lia', 'no', 'ro', 'ka', 'vin', 'del', 'mar', 'zo'];
export function randomName(rnd = Math.random) {
  const a = N1[Math.floor(rnd() * N1.length)];
  const b = N2[Math.floor(rnd() * N2.length)];
  const c = rnd() < 0.4 ? N2[Math.floor(rnd() * N2.length)] : '';
  return a + b + c;
}

export function seededLook(seed) {
  return randomLook(mulberry(seed));
}
